import Foundation
import Observation
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

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

    /// Stepping through a playlist uses Spotify's one player, so one at a time.
    @ObservationIgnored private var isTuning = false
    @ObservationIgnored private let fileURL: URL

    /// The playlists are kept in a file, not UserDefaults: 300 tracks with
    /// their covers' links come to tens of kilobytes each.
    init(fileURL: URL = SpotifyLibrary.defaultFileURL) {
        self.fileURL = fileURL
        playlists = Self.load(from: fileURL)
    }

    /// Reads the playlist's name and cover, steps through its tracks with
    /// Spotify muted, then puts back what you were playing, and saves it.
    func add(link: String) async throws -> SpotifyPlaylist {
        guard let id = Self.playlistID(fromLink: link) else { throw SpotifyLibraryError.notAPlaylistLink }
        guard !playlists.contains(where: { $0.id == id }) else { throw SpotifyLibraryError.alreadyAdded }
        guard !isTuning else { throw SpotifyLibraryError.busy }
        isTuning = true
        defer { isTuning = false; tuning = nil }
        let details = try await SpotifyOEmbed.details(playlistID: id)
        tuning = Tuning(name: details.title, tracksFound: 0)
        let tracks = try await scan(playlistID: id, name: details.title)
        let playlist = SpotifyPlaylist(
            id: id, name: details.title, coverURL: details.coverURL, tracks: tracks, tunedAt: .now
        )
        playlists.append(playlist)
        try save()
        return playlist
    }

    /// Reads the tracks again, for a playlist edited in Spotify.
    func retune(id: String) async throws {
        guard let existing = playlists.first(where: { $0.id == id }) else { throw SpotifyLibraryError.playlistNotFound }
        guard !isTuning else { throw SpotifyLibraryError.busy }
        isTuning = true
        defer { isTuning = false; tuning = nil }
        tuning = Tuning(name: existing.name, tracksFound: 0)
        let tracks = try await scan(playlistID: id, name: existing.name)
        // The playlist may have been removed while it was read.
        guard let index = playlists.firstIndex(where: { $0.id == id }) else { return }
        playlists[index].tracks = tracks
        playlists[index].tunedAt = .now
        try save()
    }

    func remove(id: String) {
        playlists.removeAll { $0.id == id }
        do {
            try save()
        } catch {
            log.error("Couldn't save the Spotify playlists: \(String(describing: error), privacy: .public)")
        }
    }

    /// The playlist ID in an `open.spotify.com/playlist/…` link or a
    /// `spotify:playlist:…` URI, or nil.
    nonisolated static func playlistID(fromLink link: String) -> String? {
        SpotifyURI.playlistID(fromLink: link)
    }

    private func scan(playlistID: String, name: String) async throws -> [SpotifyTrack] {
        // A scan on a Spotify that's closed starts it hidden.
        if !SpotifyBridge.isRunning { try await SpotifyBridge.launch() }
        let tracks = try await SpotifyScan.run(playlistID: playlistID) { [weak self] found in
            self?.tuning = Tuning(name: name, tracksFound: found)
        }
        guard !tracks.isEmpty else { throw SpotifyLibraryError.empty }
        return tracks
    }

    // MARK: - Saving

    private static var defaultFileURL: URL {
        URL.applicationSupportDirectory
            .appending(path: "Free Roam", directoryHint: .isDirectory)
            .appending(path: "spotify-playlists.json")
    }

    private func save() throws {
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(playlists).write(to: fileURL, options: .atomic)
    }

    private static func load(from fileURL: URL) -> [SpotifyPlaylist] {
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        do {
            return try JSONDecoder().decode([SpotifyPlaylist].self, from: data)
        } catch {
            log.error("Couldn't read the saved Spotify playlists: \(String(describing: error), privacy: .public)")
            return []
        }
    }
}

/// A playlist's name and cover from Spotify's public oEmbed, which needs no sign-in.
enum SpotifyOEmbed {
    struct Details: Equatable {
        let title: String
        let coverURL: URL?
    }

    private struct Response: Decodable {
        let title: String
        let thumbnail_url: String?
    }

    static func details(playlistID: String, session: URLSession = .shared) async throws -> Details {
        guard SpotifyURI.isBaseID(playlistID) else { throw SpotifyLibraryError.notAPlaylistLink }
        var components = URLComponents(string: "https://open.spotify.com/oembed")!
        components.queryItems = [URLQueryItem(name: "url", value: "https://open.spotify.com/playlist/\(playlistID)")]
        var request = URLRequest(url: components.url!)
        request.timeoutInterval = 10
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 404 { throw SpotifyLibraryError.playlistNotFound }
        guard status == 200 else { throw URLError(.badServerResponse) }
        return try details(from: data)
    }

    static func details(from data: Data) throws -> Details {
        let response = try JSONDecoder().decode(Response.self, from: data)
        let cover = response.thumbnail_url.flatMap(URL.init(string:)).flatMap { $0.scheme == "https" ? $0 : nil }
        return Details(title: response.title, coverURL: cover)
    }
}
