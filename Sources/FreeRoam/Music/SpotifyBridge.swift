import AppKit

/// Talks to the Spotify desktop app through AppleScript. Placeholder until
/// the Spotify bridge lands: every script throws `notRunning`.
enum SpotifyBridge: MusicAppBridge {
    static let bundleID = "com.spotify.client"

    static var isRunning: Bool {
        !NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).isEmpty
    }

    static func permission() -> MusicPermission { .unknown(0) }
    static func launch() async throws { throw MusicBridgeError.notRunning }
    static func playlists() async throws -> [Playlist] { throw MusicBridgeError.notRunning }
    static func trackDurations(playlistID: String) async throws -> [TimeInterval] { throw MusicBridgeError.notRunning }
    static func tracks(playlistID: String) async throws -> [Track] { throw MusicBridgeError.notRunning }
    static func trackCountAndAlbums(playlistID: String) async throws -> (trackCount: Int, albums: [String]) { throw MusicBridgeError.notRunning }
    static func artwork(playlistID: String, track: Int) async throws -> Data? { throw MusicBridgeError.notRunning }
    static func play(playlistID: String, track number: Int) async throws -> String? { throw MusicBridgeError.notRunning }
    static func play(playlistID: String) async throws -> (orderChanged: Bool, track: Int) { throw MusicBridgeError.notRunning }
    static func keepOnClock() async throws { throw MusicBridgeError.notRunning }
    static func keepOnAir() async throws { throw MusicBridgeError.notRunning }
    static func seek(to position: TimeInterval) async throws -> TimeInterval? { throw MusicBridgeError.notRunning }
    static func resume() async throws -> String? { throw MusicBridgeError.notRunning }
    static func pause() async throws { throw MusicBridgeError.notRunning }
    static func nowPlaying() async throws -> NowPlaying? { throw MusicBridgeError.notRunning }
    static func volume() async throws -> Int { throw MusicBridgeError.notRunning }
    static func setVolume(_ volume: Int) async throws { throw MusicBridgeError.notRunning }
    static func setVolumeNow(_ volume: Int, after delay: Duration) throws { throw MusicBridgeError.notRunning }
}
