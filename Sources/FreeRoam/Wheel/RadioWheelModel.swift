import AppKit
import Carbon.HIToolbox
import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "wheel")

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
    /// How long after `play track` Music can still turn repeat back on.
    private static let repeatSettle = Duration.milliseconds(1500)
    /// How long after a tune that launched Music it's checked for playing.
    private static let launchSettle = Duration.seconds(2)
    /// How long the wheel counts as in use after it closes, ⌥Q comes up or a
    /// tune ends: long enough for the 450 ms volume restore.
    private static let quietAfterUse = Duration.seconds(1)

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
    let details: StationDetails
    var slotCount: Int { stations.count + 1 }

    /// ⌥Q is down, the wheel is open, a tap is waiting to tune, a tune hasn't
    /// reached Music, or one of those ended within the last second. Settings'
    /// cover reads wait meanwhile, so they never hold up the wheel's scripts.
    var isInUse: Bool {
        isOpen || holdTimer != nil || tapsWaiting > 0 || tunesInFlight > 0
            || ContinuousClock.now - lastUsed < Self.quietAfterUse
    }

    @ObservationIgnored private let stationList: StationList
    @ObservationIgnored private let hotkey = Hotkey(keyCode: kVK_ANSI_Q, modifiers: .option)
    // The wheel is only open while ⌥ is held, so Escape arrives as ⌥Esc. It's
    // registered only while the wheel is open.
    @ObservationIgnored private let escape = Hotkey(keyCode: kVK_Escape, modifiers: .option)
    @ObservationIgnored private lazy var panel = makePanel()
    @ObservationIgnored private let volumeDip: VolumeDip
    @ObservationIgnored private let relay = OnAirRelay()
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
    /// Where Music was at the last press, so the caption names the track
    /// Music is playing. Nil after a tune, until the next press asks again.
    private(set) var nowPlaying: NowPlaying?
    @ObservationIgnored private var playingRead: Task<Void, Never>?
    /// Tunes whose commands haven't reached Music yet, or that launched Music
    /// and haven't checked it's still playing.
    @ObservationIgnored private var tunesInFlight = 0
    /// The latest tune. The next pick cancels it, so a tune still waiting for
    /// ⌥ to come up never launches Music for a station you've left.
    @ObservationIgnored private var tuning: Task<Void, Never>?
    @ObservationIgnored private var lastUsed = ContinuousClock.now - quietAfterUse
    /// Taps whose tune waits for Music to say what it's playing, which can
    /// take longer than the quiet second when Music is slow.
    @ObservationIgnored private var tapsWaiting = 0

    init(style: WheelStyle, stations: StationList, details: StationDetails) {
        self.style = style
        stationList = stations
        self.details = details
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
        relay.onTrackEnded = { [weak self] airing in self?.playNext(after: airing) }
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
        // A display connected while Free Roam runs gets its own warm-up.
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
        lastUsed = .now
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
        lastUsed = .now
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
        lastUsed = .now
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

    /// Music can change station without Free Roam, so each press asks what's
    /// playing before the wheel opens on it. When Music isn't running that's
    /// Radio Off, and Music isn't asked.
    private func readPlaying() {
        // Until Music answers, the caption names no track, so a read that
        // fails leaves no stale track behind.
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
            } catch MusicBridgeError.notRunning {
                // Music quit while the read waited its turn.
                playing = nil
            } catch {
                log.error("Couldn't read what Music is playing: \(String(describing: error), privacy: .public)")
                return
            }
            guard let self, !Task.isCancelled else { return }
            nowPlaying = playing
            if let playing {
                details.reloadIfChanged(playing.playlistID, trackCount: playing.trackCount)
            }
            let id = playing?.playlistID
            guard id != tunedID else { return }
            tunedID = id
            let name = id.flatMap { id in stationList.onWheel.first { $0.id == id }?.name } ?? id ?? "nothing"
            log.notice("Music is playing \(name, privacy: .public)")
            if isOpen, !picked { highlighted = tunedSlot }
        }
    }

    private func tapNext() {
        stations = Array(stationList.onWheel.prefix(Self.maxStations))
        tapsWaiting += 1
        Task { [weak self] in
            // The tap is relative to what's playing, which this press asked for.
            await self?.playingRead?.value
            guard let self else { return }
            // `tune` counts the tune in flight before anything can wait.
            tapsWaiting -= 1
            lastUsed = .now
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
        // The old station's track stopping as the new one starts isn't an end.
        relay.airing = nil
        nowPlaying = nil
        sounds.play(.retune)
        log.notice("Tuned to \(self.stationName(slot), privacy: .public), \(reason, privacy: .public)")
        tunesInFlight += 1
        tuning?.cancel()
        tuning = Task { [weak self] in
            await self?.playOnAir(id)
            self?.tunesInFlight -= 1
            self?.lastUsed = .now
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

    /// Plays the track on the station's clock from where the clock is in it,
    /// or pauses for Radio Off and for a station with nothing to play. If
    /// Music doesn't reach that track, the station shuffles its playlist
    /// instead. Music launches for a station, but not for Radio Off, and not
    /// once a newer pick cancels the tune.
    private func playOnAir(_ id: String?) async {
        do {
            guard let id else {
                guard MusicBridge.isRunning else { return }
                try await MusicBridge.pause()
                // Music takes a `play` a few hundred milliseconds after it's
                // sent, so a replaced tune's `play` can land after this pause.
                try await Task.sleep(for: .milliseconds(700))
                if tunedID == nil { try await MusicBridge.pause() }
                return
            }
            let launching = !MusicBridge.isRunning
            if launching { try await MusicBridge.launch() }
            let durations = try await MusicBridge.trackDurations(playlistID: id)
            // Superseded by a later tune while the durations were on their way.
            guard tunedID == id else { return }
            // A station with nothing to play is dead air, like Radio Off.
            guard durations.contains(where: { $0 > 0 }) else {
                try await MusicBridge.pause()
                details.reloadIfChanged(id, trackCount: durations.count)
                log.notice("Playlist \(id, privacy: .public) has no tracks to play, so Music is paused")
                return
            }
            if try await !playOnClock(id, durations: durations) {
                try await shuffle(id, durations: durations)
            }
            // Only now, because an edited playlist's track and cover reads
            // would take turns with the wait for Music and the seek.
            details.reloadIfChanged(id, trackCount: durations.count)
            if launching { try await keepPlayingAfterLaunch(id) }
        } catch is CancellationError {
            log.notice("A newer pick replaced the tune to \(id ?? "Radio Off", privacy: .public)")
        } catch {
            log.error("Couldn't tune Music: \(String(describing: error), privacy: .public)")
        }
    }

    /// Plays the track that's on air and seeks to where the clock is in it,
    /// counting the time Music took. Returns false when Music didn't reach
    /// the track.
    private func playOnClock(_ id: String, durations: [TimeInterval]) async throws -> Bool {
        let tuned = Date()
        guard let onAir = Broadcast.onAir(durations: durations, at: tuned),
              let trackID = try await MusicBridge.play(playlistID: id, track: onAir.index + 1)
        else { return false }
        let played = ContinuousClock.now
        relay.airing = OnAirRelay.Airing(playlistID: id, index: onAir.index, trackID: trackID)
        let target = onAir.position + Date().timeIntervalSince(tuned)
        try await seek(id, track: onAir.index + 1, of: durations, to: target)
        try await keepSingleTrack(trackID, after: played)
        return true
    }

    /// Repeat can read as all again for a second after `play track`, which
    /// would loop the track without a word to the relay, so it's set off once
    /// more after that.
    private func keepSingleTrack(_ trackID: String, after played: ContinuousClock.Instant) async throws {
        try await Task.sleep(until: played + Self.repeatSettle, clock: .continuous)
        guard relay.airing?.trackID == trackID else { return }
        try await MusicBridge.keepSingleTrack()
    }

    /// The fallback: the playlist on shuffle, from partway into whichever
    /// track Music starts on. The relay doesn't follow it, because Music
    /// queues the whole playlist.
    private func shuffle(_ id: String, durations: [TimeInterval]) async throws {
        let played = try await MusicBridge.play(playlistID: id)
        log.notice("Shuffling playlist \(id, privacy: .public), because Music didn't reach the track on air")
        if played.orderChanged {
            log.notice("Turned Music's shuffle and repeat on, so the station shuffles its own playlist and loops")
        }
        guard durations.indices.contains(played.track - 1) else {
            let reached = played.track > 0 ? "track \(played.track)" : "a track it can't name"
            log.error("""
                Music got to \(reached, privacy: .public) of \(durations.count) in playlist \(id, privacy: .public), \
                so the station plays on from there without a seek
                """)
            return
        }
        let target = Self.landing(in: durations[played.track - 1], at: .random(in: 0.15...0.65))
        try await seek(id, track: played.track, of: durations, to: target)
        if tunedID == id { try await MusicBridge.keepOnAir() }
    }

    /// The station's track ended, so its next one plays from the top, in
    /// playlist order. After a pause in Music the station runs behind its
    /// clock from here on, until it's tuned again. Never launches Music.
    private func playNext(after airing: OnAirRelay.Airing) {
        guard tunedID == airing.playlistID, MusicBridge.isRunning else { return }
        tunesInFlight += 1
        tuning?.cancel()
        tuning = Task { [weak self] in
            await self?.playTrack(after: airing)
            self?.tunesInFlight -= 1
            self?.refreshStations()
        }
    }

    private func playTrack(after airing: OnAirRelay.Airing) async {
        let id = airing.playlistID
        do {
            // Read again, in case the playlist was edited while it played.
            let durations = try await MusicBridge.trackDurations(playlistID: id)
            guard tunedID == id else { return }
            guard let next = Broadcast.next(after: airing.index, durations: durations) else {
                log.notice("Playlist \(id, privacy: .public) has no tracks left to play")
                return
            }
            guard let trackID = try await MusicBridge.play(playlistID: id, track: next + 1) else {
                try await shuffle(id, durations: durations)
                return
            }
            let played = ContinuousClock.now
            relay.airing = OnAirRelay.Airing(playlistID: id, index: next, trackID: trackID)
            log.notice("Track \(airing.index + 1) ended, so playing track \(next + 1) of \(durations.count) in playlist \(id, privacy: .public)")
            try await keepSingleTrack(trackID, after: played)
        } catch is CancellationError {
            log.notice("A newer pick replaced the next track of \(id, privacy: .public)")
        } catch {
            log.error("Couldn't play the next track of \(id, privacy: .public): \(String(describing: error), privacy: .public)")
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

    /// Where a tune lands in a track `duration` seconds long: `fraction` of
    /// the way in, so it drops in mid-song like radio, and short of the end,
    /// or Music would move on to the next track.
    nonisolated static func landing(in duration: TimeInterval, at fraction: Double) -> TimeInterval {
        max(min(duration * fraction, duration - 1), 0)
    }

    /// Music ignores or refuses a new position until a streamed track has
    /// loaded, so keep setting it until Music reports it. Most tracks took a
    /// few tries. Stays a second short of the end, or Music would move on.
    private func seek(_ id: String, track: Int, of durations: [TimeInterval], to position: TimeInterval) async throws {
        let duration = durations[track - 1]
        let target = max(min(position, duration - 1), 0)
        var reported: TimeInterval?
        for attempt in 1...Self.seekAttempts {
            // Another tune has the player now, so this position isn't for its track.
            guard tunedID == id else { return }
            reported = try await MusicBridge.seek(to: target)
            if let reported, abs(reported - target) < 2 {
                log.notice("""
                    Playing track \(track) of \(durations.count) in playlist \(id, privacy: .public) \
                    from \(Int(target)) s of \(Int(duration)) s, after \(attempt) tries
                    """)
                return
            }
            try await Task.sleep(for: .milliseconds(100))
        }
        log.error("""
            Music didn't move to \(Int(target)) s of track \(track) in playlist \(id, privacy: .public) \
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
