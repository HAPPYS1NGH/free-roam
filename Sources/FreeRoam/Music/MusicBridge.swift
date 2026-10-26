import AppKit
import Carbon.OpenScripting
import CoreServices
import OSAKit
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

struct Playlist: Codable, Identifiable, Hashable, Sendable {
    /// Music's persistent ID: 16 hex digits that survive renames and relaunches.
    let id: String
    let name: String
}

struct Track: Hashable, Sendable {
    let title: String
    let artist: String
    let album: String
    /// Seconds. Tracks with no length, such as missing files, count as 0.
    let duration: TimeInterval
}

/// Where Music was in the playlist it's playing when it was asked.
struct NowPlaying: Equatable, Sendable {
    /// The playlist Music is playing from, which may not be on the wheel.
    let playlistID: String
    let onAir: Broadcast.OnAir
    let date: Date
    /// How many tracks the playlist has now, which tells an edited playlist
    /// from the tracks loaded for it.
    let trackCount: Int
}

enum MusicPermission: Equatable, Sendable {
    case allowed
    case denied
    case notAsked
    case musicNotRunning
    case unknown(OSStatus)

    /// Nil when Music couldn't say, because it isn't running.
    var isAllowed: Bool? {
        switch self {
        case .allowed: true
        case .denied, .notAsked: false
        case .musicNotRunning, .unknown: nil
        }
    }

    var label: String {
        switch self {
        case .allowed: "allowed"
        case .denied: "denied"
        case .notAsked: "not asked yet"
        case .musicNotRunning: "unknown until Music is running"
        case .unknown(let status): "unknown (\(status))"
        }
    }
}

enum MusicBridgeError: LocalizedError, Equatable {
    case notPermitted
    case notInstalled
    case notRunning
    case optionHeld
    case invalidPersistentID(String)
    case script(code: Int, message: String)

    init(errorInfo: NSDictionary) {
        let code = errorInfo[OSAScriptErrorNumberKey] as? Int ?? 0
        let message = errorInfo[OSAScriptErrorMessageKey] as? String ?? "Unknown AppleScript error"
        switch code {
        case errAEEventNotPermitted: self = .notPermitted
        case MusicBridge.notRunningError: self = .notRunning
        default: self = .script(code: code, message: message)
        }
    }

    var errorDescription: String? {
        switch self {
        case .notPermitted: "Free Roam isn't allowed to control Music."
        case .notInstalled: "Music isn't installed."
        case .notRunning: "Music isn't running."
        case .optionHeld: "⌥ stayed down, and Music asks for a library when it starts with ⌥ held."
        case .invalidPersistentID(let id): "Not a Music persistent ID: \(id)"
        case .script(let code, let message): "Music error \(code): \(message)"
        }
    }
}

/// Talks to Music.app through AppleScript. Each script is the body of a
/// `tell` to Music, and `execute(_:terms:in:)` sends it to Music's process.
enum MusicBridge {
    static let bundleID = "com.apple.Music"

    // AppleScript isn't thread-safe, so scripts run one at a time on this
    // queue, which also keeps slow Apple Events off the main thread.
    private static let queue = DispatchQueue(label: "com.happys1ngh.freeroam.music")
    /// One AppleScript instance for every script, so Music's terms load once:
    /// a new instance for each script added about 17 ms. Only used while
    /// holding `appleScriptLock`.
    nonisolated(unsafe) private static let appleScript = OSALanguage(forName: "AppleScript")
        .map { OSALanguageInstance(language: $0) }
    /// Tests run scripts off `queue`, and the instance isn't thread-safe.
    private static let appleScriptLock = NSLock()
    /// How long a script waits for Music before it fails with -1712.
    private static let timeoutSeconds = 10
    /// The error a script raises when Music's process has gone. A number of
    /// Free Roam's own, so it can't be mistaken for one of Music's.
    fileprivate static let notRunningError = 1000

    static var isRunning: Bool {
        !NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).isEmpty
    }

    /// Playlists are only ever addressed by persistent ID, never by name, and
    /// the ID is checked before it goes into a script, so a playlist called
    /// `"; do shell script …` can't inject AppleScript.
    static func isPersistentID(_ id: String) -> Bool {
        id.wholeMatch(of: /[0-9A-F]{16}/) != nil
    }

    /// Never prompts. Music has to be running for macOS to answer.
    static func permission() -> MusicPermission {
        permission(askingIfNeeded: false)
    }

    /// Shows macOS's prompt to let Free Roam control Music if you haven't
    /// answered it yet, and waits for your answer. Music has to be running.
    static func requestPermission() async -> MusicPermission {
        // The check blocks its thread for as long as the prompt is up, so it
        // runs on a dispatch thread rather than one of Swift's few
        // concurrency threads or the main thread.
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                continuation.resume(returning: permission(askingIfNeeded: true))
            }
        }
    }

    private static func permission(askingIfNeeded: Bool) -> MusicPermission {
        let music = NSAppleEventDescriptor(bundleIdentifier: bundleID)
        let status = AEDeterminePermissionToAutomateTarget(
            music.aeDesc, AEEventClass(typeWildCard), AEEventID(typeWildCard), askingIfNeeded
        )
        let permission: MusicPermission = switch Int(status) {
        case Int(noErr): .allowed
        case errAEEventNotPermitted: .denied
        case errAEEventWouldRequireUserConsent: .notAsked
        case procNotFound: .musicNotRunning
        default: .unknown(status)
        }
        MusicPermissionMemory.record(permission)
        return permission
    }

    /// Never prompts. A Music that has only just started may not be ready to
    /// be asked, so this waits for it as scripts do. Throws `notRunning` if
    /// Music quits meanwhile.
    static func permissionOnceStarted() async throws -> MusicPermission {
        var answer = MusicPermission.musicNotRunning
        try await retryWhileStarting(for: .seconds(15)) {
            guard isRunning else { throw MusicBridgeError.notRunning }
            answer = permission()
            if answer == .musicNotRunning {
                throw MusicBridgeError.script(code: Int(procNotFound), message: "Music can't be asked yet")
            }
        }
        return answer
    }

    /// User playlists in library order, without folders or Music's own lists.
    static func playlists() async throws -> [Playlist] {
        // Variable names have to avoid Music's own terms: `names` is one of
        // its constants, so `set names to …` fails with "Access not allowed".
        try await run("""
            set playlistIDs to persistent ID of every user playlist whose special kind is none
            set playlistNames to name of every user playlist whose special kind is none
            return {playlistIDs, playlistNames}
            """, parse: parsePlaylists)
    }

    /// Each track's length in seconds, in playlist order. Tracks with no
    /// length, such as missing files, count as 0.
    static func trackDurations(playlistID: String) async throws -> [TimeInterval] {
        guard isPersistentID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        // Music can't get `every track` of an empty playlist (-1728), so it's
        // counted first.
        return try await run("""
            set thePlaylist to first user playlist whose persistent ID is "\(playlistID)"
            if (count of tracks of thePlaylist) is 0 then return {}
            return duration of every track of thePlaylist
            """, parse: parseDurations)
    }

    /// Every track of a playlist, in playlist order, for the caption and the
    /// albums its logo comes from.
    static func tracks(playlistID: String) async throws -> [Track] {
        guard isPersistentID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        return try await run("""
            set thePlaylist to first user playlist whose persistent ID is "\(playlistID)"
            if (count of tracks of thePlaylist) is 0 then return {{}, {}, {}, {}}
            set trackTitles to name of every track of thePlaylist
            set trackArtists to artist of every track of thePlaylist
            set trackAlbums to album of every track of thePlaylist
            set trackDurations to duration of every track of thePlaylist
            return {trackTitles, trackArtists, trackAlbums, trackDurations}
            """, parse: parseTracks)
    }

    /// How many tracks Settings reads the albums of, to pick a playlist's
    /// covers. Four albums almost always turn up well within it.
    static let coverAlbumTracks = 100

    /// For Settings: how many tracks a playlist has, and the albums of its
    /// first `coverAlbumTracks`, enough to pick its covers. Unlike
    /// `tracks(playlistID:)`, which reads every track and took seconds for a
    /// smart playlist of thousands, it costs about the same for any size.
    static func trackCountAndAlbums(playlistID: String) async throws -> (trackCount: Int, albums: [String]) {
        guard isPersistentID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        // Music can't get tracks of an empty playlist (-1728), so it's counted first.
        return try await run("""
            set thePlaylist to first user playlist whose persistent ID is "\(playlistID)"
            set songTotal to count of tracks of thePlaylist
            if songTotal is 0 then return {0, {}}
            set lastIndex to songTotal
            if lastIndex > \(coverAlbumTracks) then set lastIndex to \(coverAlbumTracks)
            return {songTotal, album of tracks 1 thru lastIndex of thePlaylist}
            """, parse: parseTrackCountAndAlbums)
    }

    /// The image data of a track's first artwork, usually a 600–1200 px JPEG,
    /// or nil when it has none. Playlists themselves report no artwork.
    static func artwork(playlistID: String, track: Int) async throws -> Data? {
        guard isPersistentID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        return try await run("""
            set theTrack to track \(track) of (first user playlist whose persistent ID is "\(playlistID)")
            if (count of artworks of theTrack) is 0 then return missing value
            return raw data of artwork 1 of theTrack
            """) { isMissingValue($0) ? nil : $0.data }
    }

    /// Plays track `track` (1-based) of a playlist from the start. Shuffle
    /// goes off and repeat covers the whole playlist, so the station plays in
    /// the broadcast clock's order and loops as the clock does, and both stay
    /// that way. Returns whether either was set otherwise.
    static func play(playlistID: String, track: Int) async throws -> Bool {
        guard isPersistentID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        return try await run("""
            set alreadyInOrder to shuffle enabled is false and song repeat is all
            set shuffle enabled to false
            set song repeat to all
            play track \(track) of (first user playlist whose persistent ID is "\(playlistID)")
            return not alreadyInOrder
            """) { $0.booleanValue }
    }

    /// Moves the current track to `position` seconds and returns where Music
    /// says it is afterwards. Until a track has loaded, Music ignores the new
    /// position, or refuses it, which returns nil.
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

    /// Plays on if Music has paused or stopped, and returns the state it was
    /// in, or nil when it was playing.
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

    /// The playlist Music is playing from, with the track, how far in and how
    /// many tracks the playlist has, or nil when it's paused or stopped. The playlist can be one that isn't on
    /// the wheel, such as the library.
    static func nowPlaying() async throws -> NowPlaying? {
        // A timeout throws, because Music not answering isn't Music playing nothing.
        try await run("""
            if player state is not playing then return {}
            try
                return {persistent ID of current playlist, index of current track, player position, count of tracks of current playlist}
            on error errText number errNumber
                if errNumber is \(errAETimeout) then error errText number errNumber
                return {}
            end try
            """) { parseNowPlaying($0, at: .now) }
    }

    /// Music's own volume, 0–100, which sits under the system volume.
    static func volume() async throws -> Int {
        try await run("return sound volume") { Int($0.int32Value) }
    }

    static func setVolume(_ volume: Int) async throws {
        try await run(volumeScript(volume)) { _ in }
    }

    /// Blocks until Music has the new volume, for when Free Roam is about to quit
    /// and can't wait for an answer. It waits `delay` after the scripts already
    /// queued, because Music drops a volume change that comes too soon after
    /// the last one.
    static func setVolumeNow(_ volume: Int, after delay: Duration) throws {
        _ = try queue.sync {
            Thread.sleep(forTimeInterval: delay / .seconds(1))
            return try execute(volumeScript(volume))
        }
    }

    /// Opens Music hidden, so the app you're in stays active and in front,
    /// and waits until it answers scripts. With `openHidden()`, this is the
    /// only way Free Roam starts Music: every script throws `notRunning`
    /// instead. Cancelling the task while it waits for ⌥ leaves Music closed.
    static func launch() async throws {
        try await openHidden()
        try await waitUntilAnswering()
    }

    /// Opens Music hidden without waiting for it to answer scripts.
    /// Cancelling the task while it waits for ⌥ leaves Music closed.
    static func openHidden() async throws {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else {
            throw MusicBridgeError.notInstalled
        }
        let waited: Duration
        do {
            waited = try await waitForOptionUp()
            // A wait that ends at once never sleeps, so it can't see a cancel.
            try Task.checkCancellation()
        } catch is CancellationError {
            log.notice("Didn't launch Music: cancelled while waiting for ⌥ to come up")
            throw CancellationError()
        }
        log.notice("Launching Music hidden, after waiting \(waited / .milliseconds(1), format: .fixed(precision: 0)) ms for ⌥ to come up")
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        configuration.hides = true
        _ = try await NSWorkspace.shared.openApplication(at: url, configuration: configuration)
    }

    /// Music is listed as running before it takes scripts, so this waits
    /// until it answers one. The script raises macOS's prompt if Free Roam
    /// hasn't been allowed or refused yet.
    static func waitUntilAnswering() async throws {
        try await retryWhileStarting(for: .seconds(15)) {
            try await run("get version") { _ in }
        }
    }

    /// Music is listed as running before it can take scripts. Until then they
    /// fail with "Connection is invalid", which lost the first tune, or time
    /// out. A Music that never answers, such as one stuck behind a dialog,
    /// would hold every script queued behind it, so this stops trying once
    /// `limit` has passed, though the last try can run on to its own timeout.
    /// A Music that quits meanwhile, as from its library dialog, throws
    /// `notRunning`, which isn't retried.
    static func retryWhileStarting(
        for limit: Duration, every interval: Duration = .milliseconds(200), _ script: () async throws -> Void
    ) async throws {
        let deadline = ContinuousClock.now + limit
        while true {
            do {
                return try await script()
            } catch MusicBridgeError.script(let code, _)
                where [connectionInvalid, procNotFound, errAETimeout].contains(code) && ContinuousClock.now < deadline {
                try await Task.sleep(for: interval)
            }
        }
    }

    /// Music asks you to choose or create a library when it starts with ⌥
    /// held, and ⌥ is half of Free Roam's hotkey: tunes picked while ⌥Q was
    /// down opened that dialog, as did a release where Q came up before ⌥.
    /// So a launch waits for ⌥ to come up. You can rest on a station and
    /// keep holding, so the wait is long, and it gives up after `limit`
    /// rather than open the dialog. Returns how long it waited.
    static func waitForOptionUp(
        for limit: Duration = .seconds(30),
        every interval: Duration = .milliseconds(20),
        isOptionDown: () -> Bool = { CGEventSource.flagsState(.combinedSessionState).contains(.maskAlternate) }
    ) async throws -> Duration {
        let clock = ContinuousClock()
        let started = clock.now
        while isOptionDown() {
            guard clock.now - started < limit else { throw MusicBridgeError.optionHeld }
            try await Task.sleep(for: interval)
        }
        return clock.now - started
    }

    /// Reads the `{track count, albums}` pair returned by `trackCountAndAlbums(playlistID:)`.
    static func parseTrackCountAndAlbums(_ result: NSAppleEventDescriptor) -> (trackCount: Int, albums: [String]) {
        let trackCount = Int(result.atIndex(1)?.int32Value ?? 0)
        return (max(trackCount, 0), strings(in: result.atIndex(2)))
    }

    /// Reads the `{ids, names}` pair returned by `playlists()`.
    static func parsePlaylists(_ result: NSAppleEventDescriptor) -> [Playlist] {
        let ids = strings(in: result.atIndex(1))
        let names = strings(in: result.atIndex(2))
        return zip(ids, names)
            .filter { id, _ in isPersistentID(id) }
            .map { Playlist(id: $0, name: $1) }
    }

    /// Reads the `{id, track number, position, track count}` returned by `nowPlaying()`.
    static func parseNowPlaying(_ result: NSAppleEventDescriptor, at date: Date) -> NowPlaying? {
        guard result.numberOfItems == 4,
              let id = result.atIndex(1)?.stringValue, isPersistentID(id),
              let track = result.atIndex(2)?.int32Value, track > 0,
              let position = result.atIndex(3)?.doubleValue, position.isFinite, position >= 0,
              let trackCount = result.atIndex(4)?.int32Value
        else { return nil }
        return NowPlaying(
            playlistID: id,
            onAir: Broadcast.OnAir(index: Int(track) - 1, position: position),
            date: date,
            trackCount: Int(trackCount)
        )
    }

    /// Reads the list of reals returned by `trackDurations(playlistID:)`.
    static func parseDurations(_ result: NSAppleEventDescriptor) -> [TimeInterval] {
        (0..<result.numberOfItems).map { index in
            let seconds = result.atIndex(index + 1)?.doubleValue ?? 0
            return seconds.isFinite && seconds > 0 ? seconds : 0
        }
    }

    /// Reads the `{titles, artists, albums, durations}` lists returned by `tracks(playlistID:)`.
    static func parseTracks(_ result: NSAppleEventDescriptor) -> [Track] {
        let titles = strings(in: result.atIndex(1))
        let artists = strings(in: result.atIndex(2))
        let albums = strings(in: result.atIndex(3))
        let durations = result.atIndex(4).map(parseDurations) ?? []
        let count = min(titles.count, artists.count, albums.count, durations.count)
        return (0..<count).map { index in
            Track(title: titles[index], artist: artists[index], album: albums[index], duration: durations[index])
        }
    }

    private static func isMissingValue(_ descriptor: NSAppleEventDescriptor) -> Bool {
        descriptor.descriptorType == typeType && descriptor.typeCodeValue == OSType(cMissingValue)
    }

    private static func volumeScript(_ volume: Int) -> String {
        "set sound volume to \(min(max(volume, 0), 100))"
    }

    private static func strings(in list: NSAppleEventDescriptor?) -> [String] {
        guard let list else { return [] }
        return (0..<list.numberOfItems).map { index in
            guard let item = list.atIndex(index + 1), !isMissingValue(item) else { return "" }
            return item.stringValue ?? ""
        }
    }

    private static func run<Value: Sendable>(
        _ source: String,
        parse: @escaping @Sendable (NSAppleEventDescriptor) -> Value
    ) async throws -> Value {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                continuation.resume(with: Result { try parse(execute(source)) })
            }
        }
    }

    /// Only ever called on `queue`. Runs `body` in the Music that's running
    /// when its turn comes, and throws `notRunning` when none is.
    private static func execute(_ body: String) throws -> NSAppleEventDescriptor {
        let music = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).first { !$0.isTerminated }
        guard let music else { throw MusicBridgeError.notRunning }
        do {
            let result = try execute(body, terms: bundleID, in: music.processIdentifier)
            MusicPermissionMemory.record(allowed: true)
            return result
        } catch MusicBridgeError.notPermitted {
            MusicPermissionMemory.record(allowed: false)
            throw MusicBridgeError.notPermitted
        }
    }

    /// Runs `body` with the terms of `appID`, sending every Apple Event it
    /// makes to `processID`, and throws `notRunning` once that process has
    /// gone.
    ///
    /// `tell application id` starts an app that isn't running before it sends
    /// the first event, even right after `is running` said it was: Music quit
    /// and 81 ms later a queued read started it again. So the body tells the
    /// current application, which is always running, and `sendToProcess`
    /// readdresses each event to the process. A process can't be started.
    ///
    /// Music answers in well under a second, but a Music that stops answering
    /// held each script for AppleScript's default 2 minutes, and every script
    /// queued behind it waited too.
    static func execute(_ body: String, terms appID: String, in processID: pid_t) throws -> NSAppleEventDescriptor {
        precondition(!body.contains("application"), "A script that names an application can start it")
        guard let appleScript else { throw MusicBridgeError.script(code: Int(errOSACantOpenComponent), message: "No AppleScript") }
        appleScriptLock.lock()
        defer { appleScriptLock.unlock() }
        let status = OSASetSendProc(appleScript.componentInstance, sendToProcess, UnsafeMutableRawPointer(bitPattern: Int(processID)))
        guard status == noErr else { throw MusicBridgeError.script(code: Int(status), message: "Couldn't address the script") }
        let source = """
            with timeout of \(timeoutSeconds) seconds
            using terms from application id "\(appID)"
            tell current application
            \(body)
            end tell
            end using terms from
            end timeout
            """
        var errorInfo: NSDictionary?
        let result = OSAScript(source: source, from: nil, languageInstance: appleScript, using: [])
            .executeAndReturnError(&errorInfo)
        guard let result, errorInfo == nil else { throw MusicBridgeError(errorInfo: errorInfo ?? [:]) }
        return result
    }

    /// AppleScript's send function, which sends each event to the process
    /// whose ID is in `refCon` instead of the current application.
    private static let sendToProcess: OSASendUPP = { event, reply, sendMode, _, timeoutTicks, _, _, refCon in
        guard let event, let reply else { return OSErr(paramErr) }
        var processID = pid_t(Int(bitPattern: refCon))
        var address = AEAddressDesc()
        var status = AECreateDesc(typeKernelProcessID, &processID, MemoryLayout<pid_t>.size, &address)
        guard status == noErr else { return status }
        defer { AEDisposeDesc(&address) }
        var readdressed = AppleEvent()
        status = AEDuplicateDesc(event, &readdressed)
        guard status == noErr else { return status }
        defer { AEDisposeDesc(&readdressed) }
        status = AEPutAttributeDesc(&readdressed, keyAddressAttr, &address)
        guard status == noErr else { return status }
        let sent = AESendMessage(&readdressed, reply, sendMode, Int(timeoutTicks))
        guard sent == procNotFound || sent == connectionInvalid else { return OSErr(truncatingIfNeeded: sent) }
        // AppleScript answers procNotFound by trying to start its target
        // again, so it never gets one. A starting Music that refuses scripts
        // stays connectionInvalid, which `retryWhileStarting` retries.
        let isAlive = kill(processID, 0) == 0 || errno == EPERM
        return OSErr(isAlive ? connectionInvalid : notRunningError)
    }
}
