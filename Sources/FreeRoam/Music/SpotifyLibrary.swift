import Foundation
import Observation

/// A track as Spotify reported it while a playlist was tuned.
struct SpotifyTrack: Codable, Hashable, Sendable {
    /// `spotify:track:<22 base62>`.
    let uri: String
    let title: String
    let artist: String
    let album: String
    /// Seconds. Spotify's AppleScript reports milliseconds.
    let duration: TimeInterval
    let artworkURL: URL?
}

/// A Spotify playlist you added in Settings, with the tracks Free Roam read
/// by stepping through it, because Spotify's AppleScript can't list them.
struct SpotifyPlaylist: Codable, Hashable, Identifiable, Sendable {
    /// The 22-character base62 ID from the playlist's link.
    let id: String
    var name: String
    var coverURL: URL?
    var tracks: [SpotifyTrack]
    var tunedAt: Date
}

enum SpotifyLibraryError: LocalizedError, Equatable {
    case notAPlaylistLink
    case playlistNotFound
    case alreadyAdded
    /// Another playlist is being tuned.
    case busy
    case empty

    var errorDescription: String? {
        switch self {
        case .notAPlaylistLink: "That isn't a Spotify playlist link."
        case .playlistNotFound: "Spotify couldn't find that playlist. Check it's public."
        case .alreadyAdded: "That playlist is already in Free Roam."
        case .busy: "Free Roam is still tuning another playlist."
        case .empty: "That playlist has no songs Free Roam can play."
        }
    }
}

/// The Spotify playlists you added, saved with their tracks.
@MainActor @Observable
final class SpotifyLibrary {
    struct Tuning: Equatable {
        let name: String
        let tracksFound: Int
    }

    static let shared = SpotifyLibrary()

    private(set) var playlists: [SpotifyPlaylist] = []
    /// The playlist being stepped through, while Spotify is muted for it.
    private(set) var tuning: Tuning?

    /// Reads the playlist's name and cover, steps through its tracks with
    /// Spotify muted, then puts back what you were playing, and saves it.
    func add(link: String) async throws -> SpotifyPlaylist {
        throw SpotifyLibraryError.notAPlaylistLink
    }

    /// Reads the tracks again, for a playlist edited in Spotify.
    func retune(id: String) async throws {}

    func remove(id: String) {}

    /// The playlist ID in an `open.spotify.com/playlist/…` link or a
    /// `spotify:playlist:…` URI, or nil.
    nonisolated static func playlistID(fromLink link: String) -> String? { nil }
}
