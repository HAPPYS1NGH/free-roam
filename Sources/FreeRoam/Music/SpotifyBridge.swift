import AppKit
import OSLog
import os

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

/// Talks to the Spotify desktop app through AppleScript, the way
/// `MusicBridge` talks to Music: every script runs one at a time and is sent
/// to Spotify's process, so it can never start Spotify.
///
/// Spotify's AppleScript can play a track inside a playlist but can't list
/// one, so playlists and their tracks come from `SpotifyLibrary`, which read
/// them once by playing through. A station plays with repeat on, so Spotify
/// itself carries on from track to track in the order the clock expects.
enum SpotifyBridge: MusicAppBridge {
    static let bundleID = "com.spotify.client"
    /// Spotify can't list playlists, so these are the ones you added.
    static let listsSavedPlaylists = true

    // AppleScript isn't thread-safe, and this keeps slow Apple Events off the
    // main thread. `MusicBridge.execute` also holds a lock across both apps.
    private static let queue = DispatchQueue(label: "com.happys1ngh.freeroam.spotify")
    /// The playlist `play(playlistID:track:)` last tuned. A track can be in
    /// several playlists, and this is the one `nowPlaying()` names.
    private static let lastTuned = OSAllocatedUnfairLock<String?>(initialState: nil)

    static var isRunning: Bool {
        !NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).isEmpty
    }

    /// Never prompts. Spotify has to be running for macOS to answer. The
    /// answer goes to Spotify's own memory, not Music's.
    static func permission() -> MusicPermission {
        let permission = MusicBridge.permission(forApp: bundleID, askingIfNeeded: false)
        MusicPermissionMemory.record(permission, for: .spotify)
        return permission
    }

    /// Opens Spotify hidden, so the app you're in stays active and in front,
    /// and waits until it answers scripts. The first script raises macOS's
    /// prompt if Free Roam hasn't been allowed or refused yet.
    static func launch() async throws {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else {
            throw MusicBridgeError.notInstalled
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        configuration.hides = true
        _ = try await NSWorkspace.shared.openApplication(at: url, configuration: configuration)
        // Spotify is listed as running before it takes scripts.
        try await MusicBridge.retryWhileStarting(for: .seconds(20)) {
            try await run("return sound volume") { _ in }
        }
    }

    // MARK: - Library

    static func playlists() async throws -> [Playlist] {
        await savedPlaylists().map { Playlist(id: $0.id, name: $0.name) }
    }

    static func trackDurations(playlistID: String) async throws -> [TimeInterval] {
        try await savedPlaylist(playlistID).tracks.map(\.duration)
    }

    static func tracks(playlistID: String) async throws -> [Track] {
        try await savedPlaylist(playlistID).tracks.map {
            Track(title: $0.title, artist: $0.artist, album: $0.album, duration: $0.duration)
        }
    }

    static func trackCountAndAlbums(playlistID: String) async throws -> (trackCount: Int, albums: [String]) {
        let tracks = try await savedPlaylist(playlistID).tracks
        return (tracks.count, tracks.prefix(MusicBridge.coverAlbumTracks).map(\.album))
    }

    /// The saved cover of a track, downloaded from Spotify's image host, or
    /// nil when it has none or the download fails.
    static func artwork(playlistID: String, track: Int) async throws -> Data? {
        let tracks = try await savedPlaylist(playlistID).tracks
        guard tracks.indices.contains(track - 1), let url = tracks[track - 1].artworkURL else { return nil }
        guard SpotifyURI.isTrustedArtwork(url) else {
            log.error("Not downloading artwork from \(url.host() ?? "?", privacy: .public)")
            return nil
        }
        return try await ArtworkDownload.data(from: url)
    }

    private static func savedPlaylists() async -> [SpotifyPlaylist] {
        await MainActor.run { SpotifyLibrary.shared.playlists }
    }

    private static func savedPlaylist(_ id: String) async throws -> SpotifyPlaylist {
        guard SpotifyURI.isBaseID(id) else { throw MusicBridgeError.invalidPersistentID(id) }
        guard let playlist = await savedPlaylists().first(where: { $0.id == id }) else {
            throw SpotifyLibraryError.playlistNotFound
        }
        return playlist
    }

    // MARK: - Playing

    /// Plays track `number` (1-based) inside its playlist and returns the
    /// track's URI once Spotify says it's playing it, or nil when it didn't
    /// within the wait. With repeat on, Spotify plays on through the
    /// playlist in order by itself, so a station needs no relay.
    static func play(playlistID: String, track number: Int) async throws -> String? {
        let tracks = try await savedPlaylist(playlistID).tracks
        guard tracks.indices.contains(number - 1) else { return nil }
        let uri = tracks[number - 1].uri
        guard SpotifyURI.isPlayableTrack(uri) else { throw MusicBridgeError.invalidPersistentID(uri) }
        lastTuned.withLock { $0 = playlistID }
        try await run("""
            set shuffling to false
            set repeating to true
            play track "\(uri)" in context "\(SpotifyURI.playlist(playlistID))"
            """) { _ in }
        let clock = ContinuousClock()
        let played = clock.now
        let reached = try await waitUntilPlaying { $0 == uri }
        let milliseconds = (clock.now - played) / .milliseconds(1)
        guard reached != nil else {
            log.error("""
                Spotify didn't get to track \(number) of playlist \(playlistID, privacy: .public) \
                within \(milliseconds, format: .fixed(precision: 0)) ms
                """)
            return nil
        }
        log.notice("""
            Spotify was playing track \(number) of playlist \(playlistID, privacy: .public) \
            \(milliseconds, format: .fixed(precision: 0)) ms after it was told to
            """)
        return uri
    }

    /// The fallback for when `play(playlistID:track:)` doesn't reach its
    /// track: the playlist on shuffle and repeat, which Spotify starts on
    /// whichever track it likes. Returns whether either was set otherwise,
    /// and the track (1-based) it started on, or 0 when it isn't one of the
    /// saved tracks.
    static func play(playlistID: String) async throws -> (orderChanged: Bool, track: Int) {
        let tracks = try await savedPlaylist(playlistID).tracks
        lastTuned.withLock { $0 = playlistID }
        let orderChanged = try await run("""
            set alreadyOnAir to shuffling is true and repeating is true
            set shuffling to true
            set repeating to true
            play track "\(SpotifyURI.playlist(playlistID))"
            return not alreadyOnAir
            """) { $0.booleanValue }
        let started = try await waitUntilPlaying { _ in true }
        // Spotify can read shuffle as changed back just after `play`.
        try await keepOnAir()
        guard let started, let index = tracks.firstIndex(where: { $0.uri == started }) else {
            return (orderChanged, 0)
        }
        return (orderChanged, index + 1)
    }

    /// Repeat on and shuffle off: the playlist plays on in its own order,
    /// which is the order of the clock. A set just after `play` can be
    /// undone, so this is sent again once the tune has settled.
    static func keepOnClock() async throws {
        try await run("""
            set shuffling to false
            set repeating to true
            """) { _ in }
    }

    static func keepOnAir() async throws {
        try await run("""
            set shuffling to true
            set repeating to true
            """) { _ in }
    }

    /// Asks which track is playing every `interval` until it's one `accept`
    /// takes, and returns its URI, or nil once `limit` has passed. A track
    /// more than a few seconds in is the one playing before the tune, not a
    /// new `play`. Throws `CancellationError` once cancelled, even after the
    /// last read, so the caller doesn't seek for a pick that's been replaced.
    private static func waitUntilPlaying(
        within limit: Duration = .seconds(3),
        every interval: Duration = .milliseconds(100),
        accept: (String) -> Bool
    ) async throws -> String? {
        let deadline = ContinuousClock.now + limit
        while true {
            try Task.checkCancellation()
            let uri = try await run("""
                if player state is not playing then return ""
                if player position >= 5 then return ""
                return id of current track
                """) { $0.stringValue ?? "" }
            try Task.checkCancellation()
            if !uri.isEmpty, accept(uri) { return uri }
            guard ContinuousClock.now < deadline else { return nil }
            try await Task.sleep(for: interval)
        }
    }

    /// Moves the current track to `position` seconds and returns where
    /// Spotify says it is afterwards. Until a track has loaded, Spotify
    /// refuses the position, which returns nil.
    static func seek(to position: TimeInterval) async throws -> TimeInterval? {
        do {
            // AppleScript reals always use a dot, and "%f" never uses the locale's comma.
            return try await run("""
                set player position to \(String(format: "%.2f", position))
                return player position
                """) { $0.doubleValue }
        } catch MusicBridgeError.script(let code, _) where code == errAEWriteDenied {
            return nil
        }
    }

    /// Plays on if Spotify has paused or stopped, and returns the state it
    /// was in, or nil when it was playing.
    static func resume() async throws -> String? {
        try await run("""
            if player state is playing then return ""
            set previousState to player state as text
            play
            return previousState
            """) { result in
            let state = result.stringValue ?? ""
            return state.isEmpty ? nil : state
        }
    }

    static func pause() async throws {
        try await run("pause") { _ in }
    }

    /// The saved playlist Spotify is playing a track of, or nil when it's
    /// paused or stopped or playing something that isn't saved. Spotify
    /// can't say which playlist it plays from, so the playlist last tuned
    /// wins when the track is in several.
    static func nowPlaying() async throws -> NowPlaying? {
        let uri = try await run("""
            if player state is not playing then return ""
            return id of current track
            """) { $0.stringValue ?? "" }
        guard !uri.isEmpty else { return nil }
        return nowPlaying(trackURI: uri, in: await savedPlaylists(), preferring: lastTuned.withLock { $0 })
    }

    static func nowPlaying(trackURI: String, in playlists: [SpotifyPlaylist], preferring preferredID: String?) -> NowPlaying? {
        let preferred = playlists.filter { $0.id == preferredID }
        for playlist in preferred + playlists {
            guard let index = playlist.tracks.firstIndex(where: { $0.uri == trackURI }) else { continue }
            return NowPlaying(playlistID: playlist.id, trackIndex: index, trackCount: playlist.tracks.count)
        }
        return nil
    }

    // MARK: - Volume

    /// Spotify's own volume, 0–100, which sits under the system volume.
    static func volume() async throws -> Int {
        try await run("return sound volume") { Int($0.int32Value) }
    }

    static func setVolume(_ volume: Int) async throws {
        try await run(volumeScript(volume)) { _ in }
    }

    /// Blocks until Spotify has the new volume, for when Free Roam is about
    /// to quit and can't wait for an answer. It waits `delay` after the
    /// scripts already queued, so a change doesn't come too soon after the
    /// last one.
    static func setVolumeNow(_ volume: Int, after delay: Duration) throws {
        _ = try queue.sync {
            Thread.sleep(forTimeInterval: delay / .seconds(1))
            return try execute(volumeScript(volume))
        }
    }

    private static func volumeScript(_ volume: Int) -> String {
        "set sound volume to \(min(max(volume, 0), 100))"
    }

    // MARK: - Scripts

    static func run<Value: Sendable>(
        _ source: String,
        parse: @escaping @Sendable (NSAppleEventDescriptor) -> Value
    ) async throws -> Value {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                continuation.resume(with: Result { try parse(execute(source)) })
            }
        }
    }

    /// Only ever called on `queue`. Runs `body` in the Spotify that's
    /// running when its turn comes, and throws `notRunning` when none is.
    private static func execute(_ body: String) throws -> NSAppleEventDescriptor {
        let spotify = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first { !$0.isTerminated }
        guard let spotify else { throw MusicBridgeError.notRunning }
        do {
            let result = try MusicBridge.execute(body, terms: bundleID, in: spotify.processIdentifier)
            MusicPermissionMemory.record(allowed: true, for: .spotify)
            return result
        } catch MusicBridgeError.notPermitted {
            MusicPermissionMemory.record(allowed: false, for: .spotify)
            throw MusicBridgeError.notPermitted
        }
    }
}

/// Downloads a cover, and refuses to follow a redirect off Spotify's image host.
private final class ArtworkDownload: NSObject, URLSessionTaskDelegate {
    private static let maxBytes = 5_000_000

    static func data(from url: URL) async throws -> Data? {
        let session = URLSession(configuration: .ephemeral, delegate: ArtworkDownload(), delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        let (data, response) = try await session.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200, data.count <= maxBytes else { return nil }
        return data
    }

    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest
    ) async -> URLRequest? {
        guard let url = request.url, SpotifyURI.isTrustedArtwork(url) else { return nil }
        return request
    }
}
