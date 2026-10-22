import AppKit
import Carbon.HIToolbox
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.static", category: "wheel")

/// Holding ⌥Q opens the wheel, mouse movement and scrolling pick a station,
/// and letting go tunes in. Resting on a station tunes in while the wheel is
/// still open, and a quicker tap skips to the next station without showing
/// the wheel. Ported from `prototype/src/useWheel.ts`.
@MainActor @Observable
final class RadioWheelModel {
    /// Stations on the ring, not counting Radio Off.
    static let maxStations = 25

    let style: WheelStyle
    /// Slot 0 is Radio Off, so station `i` is in slot `i + 1`.
    private(set) var stations: [Playlist] = []
    private(set) var highlighted = 0
    var slotCount: Int { stations.count + 1 }

    @ObservationIgnored private let availableStations: () -> [Playlist]
    @ObservationIgnored private let hotkey = Hotkey(keyCode: kVK_ANSI_Q, modifiers: .option)
    // The wheel is only open while ⌥ is held, so Escape arrives as ⌥Esc. It's
    // registered only while the wheel is open.
    @ObservationIgnored private let escape = Hotkey(keyCode: kVK_Escape, modifiers: .option)
    @ObservationIgnored private lazy var panel = makePanel()
    @ObservationIgnored private var holdTimer: Task<Void, Never>?
    @ObservationIgnored private var dwellTimer: Task<Void, Never>?
    @ObservationIgnored private var isOpen = false
    /// Whether the highlight has moved since the wheel opened. Letting go
    /// without picking leaves Music alone, even when what it's playing isn't
    /// on the ring and the wheel opened on Radio Off.
    @ObservationIgnored private var picked = false
    @ObservationIgnored private var cursor: PickCursor
    @ObservationIgnored private var scroller: ScrollStepper
    /// The playlist Music is playing from, which may not be on the ring. Nil
    /// is Radio Off: paused, stopped or not running.
    @ObservationIgnored private var tunedID: String?
    @ObservationIgnored private var playingRead: Task<Void, Never>?
    /// Tunes whose commands haven't reached Music yet.
    @ObservationIgnored private var tunesInFlight = 0

    init(style: WheelStyle, stations: @escaping () -> [Playlist]) {
        self.style = style
        availableStations = stations
        cursor = PickCursor(pickRadius: style.behaviour.pickRadius, deadZone: 0)
        scroller = ScrollStepper(step: style.behaviour.scrollStep)
    }

    func start() {
        hotkey.onPress = { [weak self] in self?.press() }
        hotkey.onRelease = { [weak self] optionFirst in self?.release(optionFirst: optionFirst) }
        escape.onPress = { [weak self] in self?.dismiss() }
        do {
            try hotkey.register()
            log.notice("Registered ⌥Q")
        } catch {
            log.error("Couldn't register ⌥Q: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: Hotkey

    private func press() {
        guard !isOpen, holdTimer == nil else { return }
        readPlaying()
        let delay = style.behaviour.holdDelayMs
        holdTimer = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(delay))
            guard let self, !Task.isCancelled else { return }
            holdTimer = nil
            open()
        }
    }

    private func release(optionFirst: Bool) {
        if optionFirst { log.notice("⌥ came up before Q, which ends the hold") }
        if let holdTimer {
            holdTimer.cancel()
            self.holdTimer = nil
            tapNext()
        } else if isOpen {
            if picked { tune(highlighted, because: "released") }
            close()
        }
    }

    private func dismiss() {
        guard isOpen else { return }
        log.notice("Closed with Escape")
        close()
    }

    // MARK: Wheel

    private func open() {
        guard let screen = NSScreen.withMouse else { return }
        stations = Array(availableStations().prefix(Self.maxStations))
        highlighted = tunedSlot
        picked = false
        let unit = screen.frame.height / 100
        cursor = PickCursor(pickRadius: style.behaviour.pickRadius, deadZone: style.behaviour.deadzone * unit)
        scroller = ScrollStepper(step: style.behaviour.scrollStep)
        isOpen = true
        panel.show(on: screen)
        do {
            try escape.register()
        } catch {
            log.error("Couldn't register ⌥Esc: \(error.localizedDescription, privacy: .public)")
        }
        log.notice("""
            Opened on a \(Int(screen.frame.width))×\(Int(screen.frame.height)) screen \
            with \(self.stations.count) stations, on \(self.stationName(self.highlighted), privacy: .public)
            """)
        if let displayID = screen.displayID { timeCapture(of: displayID) }
    }

    private func close() {
        dwellTimer?.cancel()
        isOpen = false
        escape.unregister()
        panel.hide()
    }

    private func moveMouse(dx: Double, dy: Double) {
        guard isOpen, let slot = cursor.move(dx: dx, dy: dy, count: slotCount) else { return }
        highlight(slot)
    }

    private func scroll(by delta: Double, at time: TimeInterval) {
        guard isOpen, let direction = scroller.scroll(by: delta, at: time) else { return }
        let next = (highlighted + direction + slotCount) % slotCount
        // Mouse movement after scrolling carries on from this station.
        cursor.point(at: next, count: slotCount)
        highlight(next)
    }

    /// Like GTA, the station changes while you hover once the pick has rested,
    /// so a sweep across the ring doesn't send Music a play command for every
    /// station on the way.
    private func highlight(_ slot: Int) {
        guard slot != highlighted else { return }
        highlighted = slot
        picked = true
        dwellTimer?.cancel()
        let delay = style.behaviour.dwellMs
        dwellTimer = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(delay))
            guard let self, !Task.isCancelled else { return }
            tune(slot, because: "rested on it")
        }
    }

    // MARK: Tuning

    private var tunedSlot: Int {
        guard let tunedID, let index = stations.firstIndex(where: { $0.id == tunedID }) else { return 0 }
        return index + 1
    }

    /// Music can change station without Static, so each press asks what's
    /// playing before the wheel opens on it. Asking would launch Music, so
    /// when it isn't running that's Radio Off.
    private func readPlaying() {
        // A tune still on its way to Music is newer than anything Music can
        // report yet.
        guard tunesInFlight == 0 else { return }
        guard MusicBridge.isRunning else {
            tunedID = nil
            return
        }
        playingRead = Task { [weak self] in
            let id: String?
            do {
                id = try await MusicBridge.playingPlaylistID()
            } catch {
                log.error("Couldn't read what Music is playing: \(String(describing: error), privacy: .public)")
                return
            }
            guard let self, !Task.isCancelled, id != tunedID else { return }
            tunedID = id
            let name = id.flatMap { id in availableStations().first { $0.id == id }?.name } ?? id ?? "nothing"
            log.notice("Music is playing \(name, privacy: .public)")
            if isOpen, !picked { highlighted = tunedSlot }
        }
    }

    private func tapNext() {
        stations = Array(availableStations().prefix(Self.maxStations))
        Task { [weak self] in
            // The tap is relative to what's playing, which this press asked for.
            await self?.playingRead?.value
            guard let self else { return }
            guard let next = WheelGeometry.nextStation(after: tunedSlot, count: slotCount) else {
                log.notice("Tapped ⌥Q with no stations to skip to")
                return
            }
            tune(next, because: "tapped")
        }
    }

    private func tune(_ slot: Int, because reason: String) {
        dwellTimer?.cancel()
        let id = slot == 0 ? nil : stations[slot - 1].id
        guard id != tunedID else { return }
        playingRead?.cancel()
        tunedID = id
        log.notice("Tuned to \(self.stationName(slot), privacy: .public), \(reason, privacy: .public)")
        tunesInFlight += 1
        Task { [weak self] in
            await self?.playOnAir(id)
            self?.tunesInFlight -= 1
        }
    }

    /// Plays the station's on-air track from partway in, or pauses for Radio
    /// Off. Music launches for a station, but not to pause.
    private func playOnAir(_ id: String?) async {
        do {
            guard let id else {
                if MusicBridge.isRunning { try await MusicBridge.pause() }
                return
            }
            if !MusicBridge.isRunning { try await MusicBridge.launch() }
            let durations = try await MusicBridge.trackDurations(playlistID: id)
            // Superseded by a later tune while the durations were on their way.
            guard tunedID == id else { return }
            guard let onAir = Broadcast.onAir(durations: durations, at: .now) else {
                log.notice("Playlist \(id, privacy: .public) has no tracks to play")
                return
            }
            let reported = try await MusicBridge.play(playlistID: id, track: onAir.index + 1, from: onAir.position)
            log.notice("""
                Playing track \(onAir.index + 1) of \(durations.count) in playlist \(id, privacy: .public) \
                from \(Int(onAir.position)) s of \(Int(durations[onAir.index])) s; Music says \(Int(reported)) s
                """)
        } catch {
            log.error("Couldn't tune Music: \(String(describing: error), privacy: .public)")
        }
    }

    private func stationName(_ slot: Int) -> String {
        slot == 0 ? "Radio Off" : "slot \(slot), \(stations[slot - 1].name)"
    }

    // MARK: Setup

    private func makePanel() -> OverlayPanel {
        let panel = OverlayPanel(content: RadioWheelView(model: self))
        panel.onMouseMove = { [weak self] dx, dy in self?.moveMouse(dx: dx, dy: dy) }
        panel.onScroll = { [weak self] delta, time in self?.scroll(by: delta, at: time) }
        return panel
    }

    /// Captures the screen the wheel opened on, which logs how long it took.
    /// If that's much longer than the filter's 150 ms fade-in, the backdrop
    /// needs a stream that keeps running instead of a capture on open.
    private func timeCapture(of displayID: CGDirectDisplayID) {
        guard ScreenCapture.isAllowed else { return }
        Task {
            do {
                _ = try await ScreenCapture.capture(displayID: displayID)
            } catch {
                log.error("Capture on open failed: \(String(describing: error), privacy: .public)")
            }
        }
    }
}
