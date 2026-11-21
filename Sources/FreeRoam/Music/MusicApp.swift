import Foundation

/// The app Free Roam plays stations in. You pick one in Settings, and the
/// wheel, Settings and the volume dip all talk to that one. Each app keeps
/// its own stations.
enum MusicApp: String, CaseIterable, Codable, Sendable {
    case music
    case spotify

    private static let defaultsKey = "musicApp"

    /// Music until you pick Spotify, so an existing setup carries on as it was.
    static var current: MusicApp {
        get { UserDefaults.standard.string(forKey: defaultsKey).flatMap(MusicApp.init) ?? .music }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: defaultsKey) }
    }

    /// The bridge to the current app.
    static var bridge: any MusicAppBridge.Type { current.bridge }

    var bridge: any MusicAppBridge.Type {
        switch self {
        case .music: MusicBridge.self
        case .spotify: SpotifyBridge.self
        }
    }

    var name: String {
        switch self {
        case .music: "Music"
        case .spotify: "Spotify"
        }
    }
}

/// What the wheel, Settings and the volume dip need from a music app. Each
/// app's bridge runs its scripts one at a time and throws `MusicBridgeError`.
protocol MusicAppBridge {
    static var bundleID: String { get }
    static var isRunning: Bool { get }
    /// True when the playlists and their tracks are ones Free Roam saved
    /// itself, so they can be read while the app is closed, and an empty
    /// list really means there are none.
    static var listsSavedPlaylists: Bool { get }

    /// Never prompts. The app has to be running for macOS to answer.
    static func permission() -> MusicPermission
    /// Opens the app hidden and waits until it answers scripts.
    static func launch() async throws

    /// The playlists Settings lists, in order.
    static func playlists() async throws -> [Playlist]
    /// Each track's length in seconds, in playlist order.
    static func trackDurations(playlistID: String) async throws -> [TimeInterval]
    static func tracks(playlistID: String) async throws -> [Track]
    /// How many tracks a playlist has, and the albums of the first ones, to
    /// pick its covers.
    static func trackCountAndAlbums(playlistID: String) async throws -> (trackCount: Int, albums: [String])
    /// The cover of track `track` (1-based) as image data, or nil without one.
    static func artwork(playlistID: String, track: Int) async throws -> Data?

    /// Plays track `number` (1-based) of a playlist and returns the track's
    /// ID once the app is playing it, or nil when it didn't get there.
    static func play(playlistID: String, track number: Int) async throws -> String?
    /// The fallback when `play(playlistID:track:)` fails: the playlist on
    /// shuffle. Returns whether shuffle or repeat changed, and the 1-based
    /// track it started on, or 0 when the app can't say.
    static func play(playlistID: String) async throws -> (orderChanged: Bool, track: Int)
    /// Sent again a moment after `play(playlistID:track:)`, so the station
    /// carries on from the track on air the way its clock expects.
    static func keepOnClock() async throws
    /// Shuffle and repeat on again, for the fallback.
    static func keepOnAir() async throws
    /// Moves the current track to `position` seconds and returns where the
    /// app says it is afterwards, or nil while it can't move yet.
    static func seek(to position: TimeInterval) async throws -> TimeInterval?
    /// Plays on if paused or stopped, and returns the state it was in, or nil
    /// when it was playing.
    static func resume() async throws -> String?
    static func pause() async throws
    /// The playlist the app is playing from, or nil when paused or stopped.
    static func nowPlaying() async throws -> NowPlaying?

    /// The app's own volume, 0–100.
    static func volume() async throws -> Int
    static func setVolume(_ volume: Int) async throws
    /// Blocks until the app has the new volume, for quitting.
    static func setVolumeNow(_ volume: Int, after delay: Duration) throws
}

extension MusicAppBridge {
    /// Whether playlists and tracks can be read now, without launching the app.
    static var canReadPlaylists: Bool { listsSavedPlaylists || isRunning }
}

extension MusicBridge: MusicAppBridge {
    static let listsSavedPlaylists = false

    /// With Music, a station plays one track at a time and `OnAirRelay` plays
    /// the next, so repeat stays off.
    static func keepOnClock() async throws {
        try await keepSingleTrack()
    }
}
