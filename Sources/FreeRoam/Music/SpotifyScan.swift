import Foundation
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

/// Reads a playlist's tracks by playing through it, because Spotify's
/// AppleScript can't list them. Spotify is muted while it steps from track
/// to track, and what you were playing is put back afterwards.
///
/// Measured on Spotify 1.3.10 with repeat off: `next track` from the last
/// track doesn't wrap and play on. Spotify loads the first track again,
/// paused at 0:00, so the end of a playlist is the player no longer playing.
/// A wrap that kept playing on the first track also counts as the end.
enum SpotifyScan {
    /// A playlist longer than this is read as far as here, which a station
    /// of a day's music never reaches.
    static let trackLimit = 300

    enum PlayerState: Equatable, Sendable {
        case playing, paused, stopped, unknown

        init(_ text: String) {
            self = switch text.lowercased() {
            case "playing": .playing
            case "paused": .paused
            case "stopped": .stopped
            default: .unknown
            }
        }
    }

    /// What Spotify said about the current track at one moment.
    struct Reading: Equatable, Sendable {
        var state: PlayerState
        /// Seconds into the track.
        var position: TimeInterval
        var uri: String
        var title: String
        var artist: String
        var album: String
        /// Spotify's AppleScript reports milliseconds, though its dictionary says seconds.
        var durationMilliseconds: Double
        var artworkURL: String
    }

    enum Step: Equatable {
        case record
        /// An ad, or something that isn't a track, such as a podcast episode.
        case skip
        case end
    }

    enum Advance: Equatable {
        case waiting, moved, ended
    }

    /// What the scan does with a reading of the track it has reached.
    static func step(for reading: Reading, recorded: [SpotifyTrack]) -> Step {
        guard reading.state == .playing else { return .end }
        if SpotifyURI.isAd(reading.uri) { return .skip }
        if recorded.count > 1, reading.uri == recorded[0].uri { return .end }
        return SpotifyURI.isPlayableTrack(reading.uri) ? .record : .skip
    }

    /// How long Spotify has to stay not playing for that to be the end of the
    /// playlist: it reads as paused for a moment while it loads a track.
    static let endConfirmation = Duration.milliseconds(600)

    /// Whether Spotify has moved on from `previous` after `next track`.
    /// `pausedFor` is how long it has been not playing, or nil while it is.
    static func advance(from previous: Reading, to reading: Reading, pausedFor: Duration?) -> Advance {
        guard reading.state == .playing else {
            guard let pausedFor else { return .waiting }
            return pausedFor >= endConfirmation ? .ended : .waiting
        }
        return reading.uri == previous.uri ? .waiting : .moved
    }

    static func seconds(fromMilliseconds milliseconds: Double) -> TimeInterval {
        milliseconds.isFinite && milliseconds > 0 ? milliseconds / 1000 : 0
    }

    static func track(from reading: Reading) -> SpotifyTrack? {
        guard SpotifyURI.isPlayableTrack(reading.uri) else { return nil }
        return SpotifyTrack(
            uri: reading.uri,
            title: reading.title,
            artist: reading.artist,
            album: reading.album,
            duration: seconds(fromMilliseconds: reading.durationMilliseconds),
            artworkURL: URL(string: reading.artworkURL).flatMap { $0.scheme == "https" ? $0 : nil }
        )
    }

    /// Reads the `{state, position, uri, title, artist, album, duration, artwork}` list from `readingScript`.
    static func parseReading(_ result: NSAppleEventDescriptor) -> Reading {
        Reading(
            state: PlayerState(result.atIndex(1)?.stringValue ?? ""),
            position: result.atIndex(2)?.doubleValue ?? 0,
            uri: result.atIndex(3)?.stringValue ?? "",
            title: result.atIndex(4)?.stringValue ?? "",
            artist: result.atIndex(5)?.stringValue ?? "",
            album: result.atIndex(6)?.stringValue ?? "",
            durationMilliseconds: result.atIndex(7)?.doubleValue ?? 0,
            artworkURL: result.atIndex(8)?.stringValue ?? ""
        )
    }

    /// Fields that can't be read, such as the artwork of a local file, stay
    /// empty instead of failing the reading. The variable names avoid
    /// Spotify's own terms.
    static let readingScript = """
        set stateText to player state as text
        set elapsed to 0
        set trackURI to ""
        set trackName to ""
        set trackArtist to ""
        set trackAlbum to ""
        set trackLength to 0
        set coverLink to ""
        try
            set elapsed to player position
            set trackURI to id of current track
            set trackName to name of current track
            set trackArtist to artist of current track
            set trackAlbum to album of current track
            set trackLength to duration of current track
        end try
        try
            set coverLink to artwork url of current track
        end try
        return {stateText, elapsed, trackURI, trackName, trackArtist, trackAlbum, trackLength, coverLink}
        """

    // MARK: - Running

    /// How Spotify was before the scan, to put back afterwards.
    struct Snapshot: Equatable, Sendable {
        var volume: Int
        var shuffling: Bool
        var repeating: Bool
        var wasPlaying: Bool
        var position: TimeInterval
        var uri: String
    }

    private static let pollInterval = Duration.milliseconds(40)
    private static let settleTime = Duration.milliseconds(150)
    private static let trackWait = Duration.seconds(2.5)
    /// A free account's ads run up to about half a minute.
    private static let adWait = Duration.seconds(45)

    /// Reads every track of `playlistID`, calling `progress` with the count so far.
    /// Spotify is muted throughout and put back as it was, even when the
    /// scan fails or is cancelled.
    static func run(playlistID: String, progress: @MainActor @Sendable (Int) -> Void) async throws -> [SpotifyTrack] {
        guard SpotifyURI.isBaseID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        let snapshot = try await SpotifyBridge.run("""
            set savedVolume to sound volume
            set savedShuffling to shuffling
            set savedRepeating to repeating
            set stateText to player state as text
            set savedPosition to 0
            set savedURI to ""
            try
                set savedPosition to player position
                set savedURI to id of current track
            end try
            return {savedVolume, savedShuffling, savedRepeating, stateText, savedPosition, savedURI}
            """, parse: parseSnapshot)
        do {
            let tracks = try await readTracks(playlistID: playlistID, progress: progress)
            await restore(snapshot)
            return tracks
        } catch {
            await restore(snapshot)
            throw error
        }
    }

    static func parseSnapshot(_ result: NSAppleEventDescriptor) -> Snapshot {
        Snapshot(
            volume: Int(result.atIndex(1)?.int32Value ?? 100),
            shuffling: result.atIndex(2)?.booleanValue ?? false,
            repeating: result.atIndex(3)?.booleanValue ?? false,
            wasPlaying: PlayerState(result.atIndex(4)?.stringValue ?? "") == .playing,
            position: result.atIndex(5)?.doubleValue ?? 0,
            uri: result.atIndex(6)?.stringValue ?? ""
        )
    }

    private static func readTracks(playlistID: String, progress: @MainActor @Sendable (Int) -> Void) async throws -> [SpotifyTrack] {
        let clock = ContinuousClock()
        let started = clock.now
        try await SpotifyBridge.run("""
            set sound volume to 0
            set shuffling to false
            set repeating to false
            play track "\(SpotifyURI.playlist(playlistID))"
            """) { _ in }
        var tracks: [SpotifyTrack] = []
        // `play` takes a moment, and the track before it keeps reading as
        // playing until then. A new play starts at 0:00.
        guard var reading = try await poll(for: trackWait * 2, until: { $0.state == .playing && $0.position < 3 }) else {
            return tracks
        }
        while true {
            switch step(for: reading, recorded: tracks) {
            case .end:
                return finished(tracks, since: started, clock: clock)
            case .record:
                if let track = track(from: reading) { tracks.append(track) }
                await progress(tracks.count)
            case .skip:
                break
            }
            if tracks.count >= trackLimit { return finished(tracks, since: started, clock: clock) }
            guard let next = try await advance(from: reading) else {
                return finished(tracks, since: started, clock: clock)
            }
            reading = next
        }
    }

    private static func finished(_ tracks: [SpotifyTrack], since started: ContinuousClock.Instant, clock: ContinuousClock) -> [SpotifyTrack] {
        let elapsed = clock.now - started
        log.notice("""
            Read \(tracks.count) Spotify tracks in \(elapsed / .milliseconds(1), format: .fixed(precision: 0)) ms
            """)
        return tracks
    }

    private static func read() async throws -> Reading {
        try await SpotifyBridge.run(readingScript, parse: parseReading)
    }

    /// Reads until `accept` says yes and returns that reading, or nil after `limit`.
    private static func poll(for limit: Duration, until accept: (Reading) -> Bool) async throws -> Reading? {
        let deadline = ContinuousClock.now + limit
        while true {
            try Task.checkCancellation()
            let reading = try await read()
            if accept(reading) { return reading }
            guard ContinuousClock.now < deadline else { return nil }
            try await Task.sleep(for: pollInterval)
        }
    }

    /// Steps to the next track and returns it, or nil when the playlist has
    /// ended. An ad is left to play out, because skipping it could skip the
    /// track it came before.
    private static func advance(from reading: Reading) async throws -> Reading? {
        let isAd = SpotifyURI.isAd(reading.uri)
        if !isAd {
            try await Task.sleep(for: settleTime)
            try await SpotifyBridge.run("next track") { _ in }
        }
        let deadline = ContinuousClock.now + (isAd ? adWait : trackWait)
        var pausedSince: ContinuousClock.Instant?
        var latest = reading
        while true {
            try Task.checkCancellation()
            latest = try await read()
            if latest.state == .playing {
                pausedSince = nil
            } else if pausedSince == nil {
                pausedSince = .now
            }
            switch advance(from: reading, to: latest, pausedFor: pausedSince.map { ContinuousClock.now - $0 }) {
            case .moved: return latest
            case .ended: return nil
            case .waiting: break
            }
            guard ContinuousClock.now < deadline else { break }
            try await Task.sleep(for: pollInterval)
        }
        // The same track again and just started: a playlist that lists it twice in a row.
        return latest.state == .playing && latest.position < 3 && !isAd ? latest : nil
    }

    // MARK: - Putting back

    /// Runs apart from the scan's task, because a cancelled task would skip
    /// the waits and, worse, the volume.
    private static func restore(_ snapshot: Snapshot) async {
        await Task.detached { await putBack(snapshot) }.value
    }

    private static func putBack(_ snapshot: Snapshot) async {
        do {
            if snapshot.wasPlaying, SpotifyURI.isPlayableTrack(snapshot.uri) {
                try await SpotifyBridge.run("play track \"\(snapshot.uri)\"") { _ in }
                try await seekBack(to: snapshot)
            } else {
                try await SpotifyBridge.run("pause") { _ in }
            }
        } catch {
            log.error("Couldn't put back what Spotify was playing: \(String(describing: error), privacy: .public)")
        }
        do {
            try await SpotifyBridge.run("""
                set shuffling to \(snapshot.shuffling)
                set repeating to \(snapshot.repeating)
                set sound volume to \(min(max(snapshot.volume, 0), 100))
                """) { _ in }
        } catch {
            log.error("Couldn't put back Spotify's volume: \(String(describing: error), privacy: .public)")
        }
    }

    /// Spotify ignores a seek until the track has loaded, so it's tried again.
    private static func seekBack(to snapshot: Snapshot) async throws {
        guard snapshot.position > 1 else { return }
        for _ in 0..<20 {
            try await Task.sleep(for: .milliseconds(150))
            let current = try await SpotifyBridge.run("""
                if player state is not playing then return ""
                return id of current track
                """) { $0.stringValue ?? "" }
            guard current == snapshot.uri else { continue }
            let reached = try await SpotifyBridge.run("""
                set player position to \(String(format: "%.2f", snapshot.position))
                return player position
                """) { $0.doubleValue }
            if abs(reached - snapshot.position) < 3 { return }
        }
    }
}
