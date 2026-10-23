import AppKit
import Carbon.HIToolbox
import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.static", category: "wheel")

/// Holding ⌥Q opens the wheel, mouse movement and scrolling pick a station,
/// and letting go tunes in. Resting on a station tunes in while the wheel is
/// still open, and a quicker tap skips to the next station without showing
/// the wheel. Ported from `prototype/src/useWheel.ts`.
@MainActor @Observable
final class RadioWheelModel {
    /// Opening fades in from a slightly smaller wheel and closing only fades
    /// out, because letting go commits the pick.
    enum Presence {
        case hidden, shown, closing
    }

    /// Stations on the ring, not counting Radio Off.
    nonisolated static let maxStations = 25
    /// About 4 s of retries while a track loads.
    private static let seekAttempts = 30
    /// How long after a tune that launched Music it's checked for playing.
    private static let launchSettle = Duration.seconds(2)

    let style: WheelStyle
    /// Slot 0 is Radio Off, so station `i` is in slot `i + 1`.
    private(set) var stations: [Playlist] = []
    private(set) var highlighted = 0
    private(set) var presence = Presence.hidden
    /// The backdrop fades on its own, slower timing, so colour drains back
    /// into the screen after the wheel has gone.
    private(set) var backdropShown = false
    /// The filtered screen under the wheel. Nil without Screen Recording
    /// permission, and until the capture lands or if it failed.
    var still: CGImage? { stills.shown }
    private var stills = StillHandoff()
    let details = StationDetails()
    var slotCount: Int { stations.count + 1 }

    @ObservationIgnored private let stationList: StationList
    @ObservationIgnored private let hotkey = Hotkey(keyCode: kVK_ANSI_Q, modifiers: .option)
    // The wheel is only open while ⌥ is held, so Escape arrives as ⌥Esc. It's
    // registered only while the wheel is open.
    @ObservationIgnored private let escape = Hotkey(keyCode: kVK_Escape, modifiers: .option)
    @ObservationIgnored private lazy var panel = makePanel()
    @ObservationIgnored private let volumeDip: VolumeDip
    @ObservationIgnored private let sounds: WheelSounds
    @ObservationIgnored private var holdTimer: Task<Void, Never>?
    @ObservationIgnored private var dwellTimer: Task<Void, Never>?
    @ObservationIgnored private var isOpen = false
    /// Counts opens, so a fade-out that ends after the wheel opened again
    /// leaves the panel up.
    @ObservationIgnored private var opens = 0
    @ObservationIgnored private var capture: Task<Void, Never>?
    /// The display the latest press captured.
    @ObservationIgnored private var captureDisplay: CGDirectDisplayID?
    /// Displays whose slow first capture has already run.
    @ObservationIgnored private var warmedUp: Set<CGDirectDisplayID> = []
    /// Whether the highlight has moved since the wheel opened. Letting go
    /// without picking leaves Music alone, even when what it's playing isn't
    /// on the ring and the wheel opened on Radio Off.
    @ObservationIgnored private var picked = false
    @ObservationIgnored private var cursor: PickCursor
    @ObservationIgnored private var scroller: ScrollStepper
    /// The playlist Music is playing from, which may not be on the ring. Nil
    /// is Radio Off: paused, stopped or not running.
    @ObservationIgnored private var tunedID: String?
    /// Where Music was at the last press, so the caption follows the track
    /// Music is playing after a skip or a pause in Music moved it off the
    /// broadcast clock. Nil after a tune, which puts Music back on the clock.
    private(set) var nowPlaying: NowPlaying?
    @ObservationIgnored private var playingRead: Task<Void, Never>?
    /// Tunes whose commands haven't reached Music yet, or that launched Music
    /// and haven't checked it's still playing.
    @ObservationIgnored private var tunesInFlight = 0

    init(style: WheelStyle, stations: StationList) {
        self.style = style
        stationList = stations
        volumeDip = VolumeDip(
            fraction: style.behaviour.duckVolume,
            lowerSeconds: style.animations.filterIn.duration,
            restoreSeconds: style.animations.filterOut.duration
        )
        sounds = WheelSounds(behaviour: style.behaviour)
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
        warmUpCapture()
        // A display connected while Static runs gets its own warm-up.
        _ = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.warmUpCapture() }
        }
    }

    /// Loads the tracks and logos of stations that haven't loaded yet, in the
    /// background, so they're ready by the time the wheel opens.
    func loadDetails(for playlists: [Playlist]) {
        details.load(Array(playlists.prefix(Self.maxStations)))
    }

    /// For quitting, which can happen while the volume is still dipped.
    func restoreVolumeNow() {
        volumeDip.restoreNow()
    }

    // MARK: Hotkey

    private func press() {
        guard !isOpen, holdTimer == nil else { return }
        readPlaying()
        // Both a hold and a tap end in a sound.
        sounds.prepare()
        captureStill()
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
            discardStill()
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
        stations = Array(stationList.onWheel.prefix(Self.maxStations))
        highlighted = tunedSlot
        picked = false
        let unit = screen.frame.height / 100
        cursor = PickCursor(pickRadius: style.behaviour.pickRadius, deadZone: style.behaviour.deadzone * unit)
        scroller = ScrollStepper(step: style.behaviour.scrollStep)
        isOpen = true
        opens += 1
        // Anything that failed to load or is new since gets another go.
        details.load(stations)
        // The mouse crossed to another display since the press.
        if screen.displayID != captureDisplay {
            capture?.cancel()
            capture = nil
            stills.discardWaiting()
        }
        stills.open()
        panel.show(on: screen)
        withAnimation(animation(style.animations.open)) { presence = .shown }
        withAnimation(animation(style.animations.filterIn)) { backdropShown = true }
        sounds.play(.open)
        volumeDip.lower()
        do {
            try escape.register()
        } catch {
            log.error("Couldn't register ⌥Esc: \(error.localizedDescription, privacy: .public)")
        }
        log.notice("""
            Opened on a \(Int(screen.frame.width))×\(Int(screen.frame.height)) screen \
            with \(self.stations.count) stations, on \(self.stationName(self.highlighted), privacy: .public)
            """)
    }

    private func close() {
        dwellTimer?.cancel()
        // Too late to show, if it hasn't landed yet.
        capture?.cancel()
        capture = nil
        isOpen = false
        escape.unregister()
        panel.stopInput()
        sounds.play(.close)
        volumeDip.restore()
        refreshStations()
        // Each completion does nothing if the wheel opened again meanwhile.
        let closingOpen = opens
        withAnimation(animation(style.animations.close)) {
            presence = .closing
        } completion: { [weak self] in
            // Ready to grow in again, even while the backdrop is still fading.
            guard let self, opens == closingOpen else { return }
            presence = .hidden
        }
        // The panel leaves once the backdrop, which fades out slower than the
        // wheel, has gone too.
        withAnimation(animation(style.animations.filterOut)) {
            backdropShown = false
        } completion: { [weak self] in
            guard let self, opens == closingOpen else { return }
            stills.fadedOut()
            panel.orderOut(nil)
        }
    }

    /// Nil with Reduce Motion on, which opens and closes the wheel at once.
    private func animation(_ easing: WheelStyle.Easing) -> Animation? {
        let curve = easing.bezier
        guard !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion, curve.count == 4 else { return nil }
        return .timingCurve(curve[0], curve[1], curve[2], curve[3], duration: easing.duration)
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
        sounds.play(.hover)
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
        // Until Music answers, the caption follows the clock, so a read that
        // fails leaves no stale position behind.
        nowPlaying = nil
        // A tune still on its way to Music is newer than anything Music can
        // report yet.
        guard tunesInFlight == 0 else { return }
        guard MusicBridge.isRunning else {
            tunedID = nil
            return
        }
        playingRead = Task { [weak self] in
            let playing: NowPlaying?
            do {
                playing = try await MusicBridge.nowPlaying()
            } catch {
                log.error("Couldn't read what Music is playing: \(String(describing: error), privacy: .public)")
                return
            }
            guard let self, !Task.isCancelled else { return }
            nowPlaying = playing
            if let playing {
                details.reloadIfChanged(playing.playlistID, trackCount: playing.trackCount)
                logIfOffTheClock(playing)
            }
            let id = playing?.playlistID
            guard id != tunedID else { return }
            tunedID = id
            let name = id.flatMap { id in stationList.onWheel.first { $0.id == id }?.name } ?? id ?? "nothing"
            log.notice("Music is playing \(name, privacy: .public)")
            if isOpen, !picked { highlighted = tunedSlot }
        }
    }

    private func logIfOffTheClock(_ playing: NowPlaying) {
        guard let durations = details.tracks[playing.playlistID]?.map(\.duration),
              let clock = Broadcast.onAir(durations: durations, at: playing.date),
              clock.index != playing.onAir.index
        else { return }
        log.notice("""
            Music is on track \(playing.onAir.index + 1) of playlist \(playing.playlistID, privacy: .public) \
            and the clock on track \(clock.index + 1), so the caption follows Music
            """)
    }

    private func tapNext() {
        stations = Array(stationList.onWheel.prefix(Self.maxStations))
        Task { [weak self] in
            // The tap is relative to what's playing, which this press asked for.
            await self?.playingRead?.value
            guard let self else { return }
            guard let next = WheelGeometry.nextStation(after: tunedSlot, count: slotCount) else {
                log.notice("Tapped ⌥Q with no stations to skip to")
                refreshStations()
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
        nowPlaying = nil
        sounds.play(.retune)
        log.notice("Tuned to \(self.stationName(slot), privacy: .public), \(reason, privacy: .public)")
        tunesInFlight += 1
        Task { [weak self] in
            await self?.playOnAir(id)
            self?.tunesInFlight -= 1
            self?.refreshStations()
        }
    }

    /// Picks up playlists added or deleted in Music for the next open. Scripts
    /// run one at a time, so this waits until the wheel has closed and every
    /// tune has reached Music, and the read never holds up a tune or an open.
    private func refreshStations() {
        guard !isOpen, holdTimer == nil, tunesInFlight == 0 else { return }
        stationList.reload()
    }

    /// Plays the station's on-air track from partway in, or pauses for Radio
    /// Off and for a station with nothing to play. Music launches for a
    /// station, but not for Radio Off.
    private func playOnAir(_ id: String?) async {
        do {
            guard let id else {
                if MusicBridge.isRunning { try await MusicBridge.pause() }
                return
            }
            let launching = !MusicBridge.isRunning
            if launching { try await MusicBridge.launch() }
            let durations = try await MusicBridge.trackDurations(playlistID: id)
            details.reloadIfChanged(id, trackCount: durations.count)
            // Superseded by a later tune while the durations were on their way.
            guard tunedID == id else { return }
            // A station with nothing to play is dead air, like Radio Off.
            guard let onAir = Broadcast.onAir(durations: durations, at: .now) else {
                try await MusicBridge.pause()
                log.notice("Playlist \(id, privacy: .public) has no tracks to play, so Music is paused")
                return
            }
            if try await MusicBridge.play(playlistID: id, track: onAir.index + 1) {
                log.notice("Turned Music's shuffle off and repeat on, so stations play in order and loop")
            }
            try await seek(id, to: onAir, of: durations)
            if launching { try await keepPlayingAfterLaunch(id) }
        } catch {
            log.error("Couldn't tune Music: \(String(describing: error), privacy: .public)")
        }
    }

    /// A press a second after a tune had launched Music once found it playing
    /// nothing, and the wheel opened on Radio Off. A tune that launches Music
    /// stays in flight a little longer, so a press meanwhile trusts it, and
    /// then Music plays on if it has stopped. That log didn't say whether
    /// Music was paused or stopped, so both play on, and the log now says.
    /// Radio Off or another station meanwhile still wins.
    private func keepPlayingAfterLaunch(_ id: String) async throws {
        try await Task.sleep(for: Self.launchSettle)
        guard tunedID == id else { return }
        if let state = try await MusicBridge.resume() {
            log.notice("Music was \(state, privacy: .public) after it launched, so it plays on")
        }
    }

    /// Music ignores or refuses a new position until a streamed track has
    /// loaded, so keep setting it, with the target moving on with the clock,
    /// until Music reports it. Most tracks took a few tries.
    private func seek(_ id: String, to onAir: Broadcast.OnAir, of durations: [TimeInterval]) async throws {
        let duration = durations[onAir.index]
        let clock = ContinuousClock()
        let started = clock.now
        var reported: TimeInterval?
        for attempt in 1...Self.seekAttempts {
            // Another tune has the player now, so this position isn't for its track.
            guard tunedID == id else { return }
            let elapsed = (clock.now - started) / .seconds(1)
            // Short of the end, or Music would move on to the next track.
            let target = max(min(onAir.position + elapsed, duration - 1), 0)
            reported = try await MusicBridge.seek(to: target)
            if let reported, abs(reported - target) < 2 {
                log.notice("""
                    Playing track \(onAir.index + 1) of \(durations.count) in playlist \(id, privacy: .public) \
                    from \(Int(target)) s of \(Int(duration)) s, after \(attempt) tries
                    """)
                return
            }
            try await Task.sleep(for: .milliseconds(100))
        }
        log.error("""
            Music didn't move to \(Int(onAir.position)) s of track \(onAir.index + 1) in playlist \(id, privacy: .public) \
            and says \(reported.map { "\(Int($0)) s" } ?? "it can't", privacy: .public)
            """)
    }

    private func stationName(_ slot: Int) -> String {
        slot == 0 ? "Radio Off" : "slot \(slot), \(stations[slot - 1].name)"
    }

    // MARK: Backdrop

    /// Captures the screen with the mouse as ⌥Q goes down. It takes about
    /// 50 ms, so the still is ready before the wheel opens 150 ms later.
    /// Without Screen Recording permission the backdrop is the wash and
    /// vignette alone, which need none.
    private func captureStill() {
        capture?.cancel()
        capture = nil
        captureDisplay = nil
        guard ScreenCapture.isAllowed, let displayID = NSScreen.withMouse?.displayID else { return }
        captureDisplay = displayID
        // The panel is still on the screen while the last close fades out.
        let panelWindow = panel.windowNumber > 0 ? CGWindowID(panel.windowNumber) : nil
        let behaviour = style.behaviour
        let clock = ContinuousClock()
        let pressed = clock.now
        capture = Task { [weak self] in
            let image = await BackdropStill.make(
                displayID: displayID,
                excluding: panelWindow,
                saturation: behaviour.backdropSaturation,
                brightness: behaviour.backdropBrightness
            )
            guard let self, !Task.isCancelled else { return }
            capture = nil
            if image != nil {
                log.notice("The backdrop's still was ready \((clock.now - pressed) / .milliseconds(1), format: .fixed(precision: 0)) ms after ⌥Q went down")
            }
            // Late for the wheel, so it fades in like the rest of the backdrop.
            withAnimation(isOpen ? animation(style.animations.filterIn) : nil) {
                stills.land(image, whileOpen: isOpen)
            }
        }
    }

    /// A tap never opens the wheel, so its still goes unused.
    private func discardStill() {
        capture?.cancel()
        capture = nil
        stills.discardWaiting()
    }

    /// The first capture after launch took 145 ms, and the first filter
    /// sets up Core Image, so both run once for each display, at launch or
    /// when it's connected, instead of on its first press.
    private func warmUpCapture() {
        guard ScreenCapture.isAllowed else { return }
        let behaviour = style.behaviour
        for screen in NSScreen.screens {
            guard let displayID = screen.displayID, warmedUp.insert(displayID).inserted else { continue }
            let size = "\(Int(screen.frame.width))×\(Int(screen.frame.height))"
            Task {
                let clock = ContinuousClock()
                let started = clock.now
                let still = await BackdropStill.make(
                    displayID: displayID,
                    excluding: nil,
                    saturation: behaviour.backdropSaturation,
                    brightness: behaviour.backdropBrightness
                )
                guard still != nil else { return }
                log.notice("Warmed up the backdrop on a \(size, privacy: .public) screen in \((clock.now - started) / .milliseconds(1), format: .fixed(precision: 0)) ms")
            }
        }
    }

    // MARK: Setup

    private func makePanel() -> OverlayPanel {
        let panel = OverlayPanel(content: ZStack {
            BackdropView(model: self)
            RadioWheelView(model: self)
        })
        panel.onMouseMove = { [weak self] dx, dy in self?.moveMouse(dx: dx, dy: dy) }
        panel.onScroll = { [weak self] delta, time in self?.scroll(by: delta, at: time) }
        return panel
    }
}
