import AppKit
import CoreServices

struct Playlist: Identifiable, Hashable, Sendable {
    /// Music's persistent ID: 16 hex digits that survive renames and relaunches.
    let id: String
    let name: String
}

enum MusicPermission: Equatable, Sendable {
    case allowed
    case denied
    case notAsked
    case musicNotRunning
    case unknown(OSStatus)

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

enum MusicBridgeError: LocalizedError {
    case notPermitted
    case notInstalled
    case invalidPersistentID(String)
    case script(code: Int, message: String)

    init(errorInfo: NSDictionary) {
        let code = errorInfo[NSAppleScript.errorNumber] as? Int ?? 0
        let message = errorInfo[NSAppleScript.errorMessage] as? String ?? "Unknown AppleScript error"
        self = code == errAEEventNotPermitted ? .notPermitted : .script(code: code, message: message)
    }

    var errorDescription: String? {
        switch self {
        case .notPermitted: "Static isn't allowed to control Music."
        case .notInstalled: "Music isn't installed."
        case .invalidPersistentID(let id): "Not a Music persistent ID: \(id)"
        case .script(let code, let message): "Music error \(code): \(message)"
        }
    }
}

/// Talks to Music.app through AppleScript.
enum MusicBridge {
    static let bundleID = "com.apple.Music"

    // NSAppleScript isn't thread-safe, so scripts run one at a time on this
    // queue, which also keeps slow Apple Events off the main thread.
    private static let queue = DispatchQueue(label: "com.happys1ngh.static.music")

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
        let music = NSAppleEventDescriptor(bundleIdentifier: bundleID)
        let status = AEDeterminePermissionToAutomateTarget(
            music.aeDesc, AEEventClass(typeWildCard), AEEventID(typeWildCard), false
        )
        switch Int(status) {
        case Int(noErr): return .allowed
        case errAEEventNotPermitted: return .denied
        case errAEEventWouldRequireUserConsent: return .notAsked
        case procNotFound: return .musicNotRunning
        default: return .unknown(status)
        }
    }

    /// User playlists in library order, without folders or Music's own lists.
    static func playlists() async throws -> [Playlist] {
        // Variable names have to avoid Music's own terms: `names` is one of
        // its constants, so `set names to …` fails with "Access not allowed".
        try await run("""
            tell application id "com.apple.Music"
                set playlistIDs to persistent ID of every user playlist whose special kind is none
                set playlistNames to name of every user playlist whose special kind is none
                return {playlistIDs, playlistNames}
            end tell
            """, parse: parsePlaylists)
    }

    static func play(playlistID: String) async throws {
        guard isPersistentID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        try await run("""
            tell application id "com.apple.Music"
                play (first user playlist whose persistent ID is "\(playlistID)")
            end tell
            """) { _ in }
    }

    /// Each track's length in seconds, in playlist order. Tracks with no
    /// length, such as missing files, count as 0.
    static func trackDurations(playlistID: String) async throws -> [TimeInterval] {
        guard isPersistentID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        return try await run("""
            tell application id "com.apple.Music"
                return duration of every track of (first user playlist whose persistent ID is "\(playlistID)")
            end tell
            """, parse: parseDurations)
    }

    /// Plays track `track` (1-based) of a playlist from the start.
    static func play(playlistID: String, track: Int) async throws {
        guard isPersistentID(playlistID) else { throw MusicBridgeError.invalidPersistentID(playlistID) }
        try await run("""
            tell application id "com.apple.Music"
                play track \(track) of (first user playlist whose persistent ID is "\(playlistID)")
            end tell
            """) { _ in }
    }

    /// Moves the current track to `position` seconds and returns where Music
    /// says it is afterwards. Until a track has loaded, Music ignores the new
    /// position, or refuses it, which returns nil.
    static func seek(to position: TimeInterval) async throws -> TimeInterval? {
        do {
            // AppleScript reals always use a dot, and "%f" never uses the locale's comma.
            return try await run("""
                tell application id "com.apple.Music"
                    set player position to \(String(format: "%.2f", position))
                    return player position
                end tell
                """) { $0.doubleValue }
        } catch MusicBridgeError.script(let code, _) where code == errAEWriteDenied {
            return nil
        }
    }

    static func pause() async throws {
        try await run(#"tell application id "com.apple.Music" to pause"#) { _ in }
    }

    /// The playlist Music is playing from, or nil when it's paused or stopped.
    /// It can be a playlist that isn't on the wheel, such as the library.
    static func playingPlaylistID() async throws -> String? {
        try await run("""
            tell application id "com.apple.Music"
                if player state is not playing then return ""
                try
                    return persistent ID of current playlist
                on error
                    return ""
                end try
            end tell
            """) { result in
            let id = result.stringValue ?? ""
            return isPersistentID(id) ? id : nil
        }
    }

    /// Music's own volume, 0–100, which sits under the system volume.
    static func volume() async throws -> Int {
        try await run(#"tell application id "com.apple.Music" to return sound volume"#) { Int($0.int32Value) }
    }

    static func setVolume(_ volume: Int) async throws {
        try await run(volumeScript(volume)) { _ in }
    }

    /// Blocks until Music has the new volume, for when Static is about to quit
    /// and can't wait for an answer. It waits `delay` after the scripts already
    /// queued, because Music drops a volume change that comes too soon after
    /// the last one.
    static func setVolumeNow(_ volume: Int, after delay: Duration) throws {
        _ = try queue.sync {
            Thread.sleep(forTimeInterval: delay / .seconds(1))
            return try execute(volumeScript(volume))
        }
    }

    /// Opens Music without bringing it to the front, so the app you're in
    /// stays active, and waits until it answers scripts.
    static func launch() async throws {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else {
            throw MusicBridgeError.notInstalled
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        _ = try await NSWorkspace.shared.openApplication(at: url, configuration: configuration)
        // Music is listed as running before it can take scripts. Until then
        // they fail with "Connection is invalid", which lost the first tune.
        var attempts = 1
        while true {
            do {
                return try await run(#"tell application id "com.apple.Music" to get version"#) { _ in }
            } catch MusicBridgeError.script(let code, _)
                where (code == connectionInvalid || code == procNotFound) && attempts < 50 {
                attempts += 1
                try await Task.sleep(for: .milliseconds(200))
            }
        }
    }

    /// Reads the `{ids, names}` pair returned by `playlists()`.
    static func parsePlaylists(_ result: NSAppleEventDescriptor) -> [Playlist] {
        let ids = strings(in: result.atIndex(1))
        let names = strings(in: result.atIndex(2))
        return zip(ids, names)
            .filter { id, _ in isPersistentID(id) }
            .map { Playlist(id: $0, name: $1) }
    }

    /// Reads the list of reals returned by `trackDurations(playlistID:)`.
    static func parseDurations(_ result: NSAppleEventDescriptor) -> [TimeInterval] {
        (0..<result.numberOfItems).map { index in
            let seconds = result.atIndex(index + 1)?.doubleValue ?? 0
            return seconds.isFinite && seconds > 0 ? seconds : 0
        }
    }

    private static func volumeScript(_ volume: Int) -> String {
        #"tell application id "com.apple.Music" to set sound volume to \#(min(max(volume, 0), 100))"#
    }

    private static func strings(in list: NSAppleEventDescriptor?) -> [String] {
        guard let list else { return [] }
        return (0..<list.numberOfItems).map { list.atIndex($0 + 1)?.stringValue ?? "" }
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

    /// Only ever called on `queue`.
    private static func execute(_ source: String) throws -> NSAppleEventDescriptor {
        var errorInfo: NSDictionary?
        let result = NSAppleScript(source: source)?.executeAndReturnError(&errorInfo)
        guard let result, errorInfo == nil else { throw MusicBridgeError(errorInfo: errorInfo ?? [:]) }
        return result
    }
}
