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

    /// Reads the `{ids, names}` pair returned by `playlists()`.
    static func parsePlaylists(_ result: NSAppleEventDescriptor) -> [Playlist] {
        let ids = strings(in: result.atIndex(1))
        let names = strings(in: result.atIndex(2))
        return zip(ids, names)
            .filter { id, _ in isPersistentID(id) }
            .map { Playlist(id: $0, name: $1) }
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
                var errorInfo: NSDictionary?
                let result = NSAppleScript(source: source)?.executeAndReturnError(&errorInfo)
                if let result, errorInfo == nil {
                    continuation.resume(returning: parse(result))
                } else {
                    continuation.resume(throwing: MusicBridgeError(errorInfo: errorInfo ?? [:]))
                }
            }
        }
    }
}
