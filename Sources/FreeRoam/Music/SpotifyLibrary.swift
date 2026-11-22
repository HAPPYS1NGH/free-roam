import Foundation
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

/// A song as Spotify's command-line tool listed it.
struct SpotifyTrack: Codable, Hashable, Sendable {
    /// `spotify:track:<22 base62>`.
    let uri: String
    let title: String
    let artist: String
    let album: String
    /// Seconds.
    let duration: TimeInterval
    let artworkURL: URL?
}

/// A playlist in your Spotify library, with its songs once they've been read.
struct SpotifyPlaylist: Codable, Hashable, Identifiable, Sendable {
    /// The 22-character base62 ID from the playlist's URI.
    let id: String
    var name: String
    /// Nil until the songs have been read.
    var tracks: [SpotifyTrack]?
    var readAt: Date?
}

/// Your Spotify playlists and their songs, read with Spotify's command-line
/// tool and saved, so the wheel has a station's songs as soon as it's tuned,
/// and Free Roam still has them if a Spotify update takes the tool away.
@MainActor
final class SpotifyLibrary {
    static let shared = SpotifyLibrary()

    /// Songs read longer ago than this are read again after the tune that
    /// used them, so an edit in Spotify reaches the station by its next tune.
    static let freshFor: TimeInterval = 5 * 60

    private(set) var playlists: [SpotifyPlaylist] = []
    /// One read per playlist at a time.
    private var reads: [String: Task<(name: String, tracks: [SpotifyTrack]), any Error>] = [:]
    private let fileURL: URL

    /// Kept in a file, not UserDefaults: a few hundred songs with their
    /// covers' links come to tens of kilobytes a playlist.
    init(fileURL: URL = SpotifyLibrary.defaultFileURL) {
        self.fileURL = fileURL
        playlists = Self.load(from: fileURL)
    }

    /// Lists your playlists with the tool, keeping the songs already read.
    /// Without the tool, the playlists last listed, if there are any.
    func listPlaylists() async throws -> [Playlist] {
        let listed: [SpotifyCLI.ListedPlaylist]
        do {
            listed = try await SpotifyCLI.playlists()
        } catch SpotifyCLI.Failure.missing where !playlists.isEmpty {
            log.notice("Spotify has no command-line tool, so the stations are the playlists last listed")
            return playlists.map { Playlist(id: $0.id, name: $0.name) }
        }
        playlists = Self.merging(listed, into: playlists)
        save()
        return listed.map { Playlist(id: $0.id, name: $0.name) }
    }

    /// The playlist's songs: the ones saved, or read now when there are none.
    func tracks(of id: String) async throws -> [SpotifyTrack] {
        guard let saved = playlists.first(where: { $0.id == id }), let tracks = saved.tracks else {
            return try await read(id)
        }
        if let readAt = saved.readAt, Date().timeIntervalSince(readAt) > Self.freshFor, SpotifyCLI.executable != nil {
            Task { [weak self] in
                do {
                    _ = try await self?.read(id)
                } catch {
                    log.error("Couldn't read the songs of \(id, privacy: .public) again: \(String(describing: error), privacy: .public)")
                }
            }
        }
        return tracks
    }

    /// The playlists already listed, kept in the new order, with their songs.
    nonisolated static func merging(_ listed: [SpotifyCLI.ListedPlaylist], into saved: [SpotifyPlaylist]) -> [SpotifyPlaylist] {
        let byID = Dictionary(saved.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return listed.map { playlist in
            var merged = byID[playlist.id] ?? SpotifyPlaylist(id: playlist.id, name: playlist.name)
            merged.name = playlist.name
            return merged
        }
    }

    private func read(_ id: String) async throws -> [SpotifyTrack] {
        if let reading = reads[id] { return try await reading.value.tracks }
        // Songs in several playlists, or read before, aren't looked up again.
        let known = playlists.flatMap { $0.tracks ?? [] }.reduce(into: [String: SpotifyCLI.Details]()) { known, track in
            known[track.uri] = SpotifyCLI.Details(duration: track.duration, artworkURL: track.artworkURL)
        }
        let reading = Task { try await SpotifyCLI.playlist(id: id, known: known) }
        reads[id] = reading
        defer { reads[id] = nil }
        let (name, tracks) = try await reading.value
        if let index = playlists.firstIndex(where: { $0.id == id }) {
            playlists[index].tracks = tracks
            playlists[index].readAt = .now
        } else {
            playlists.append(SpotifyPlaylist(id: id, name: name, tracks: tracks, readAt: .now))
        }
        save()
        log.notice("Read \(tracks.count) songs of Spotify playlist \(id, privacy: .public)")
        return tracks
    }

    // MARK: - Saving

    private static var defaultFileURL: URL {
        URL.applicationSupportDirectory
            .appending(path: "Free Roam", directoryHint: .isDirectory)
            .appending(path: "spotify-playlists.json")
    }

    private func save() {
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(playlists).write(to: fileURL, options: .atomic)
        } catch {
            log.error("Couldn't save the Spotify playlists: \(String(describing: error), privacy: .public)")
        }
    }

    private static func load(from fileURL: URL) -> [SpotifyPlaylist] {
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        do {
            return try JSONDecoder().decode([SpotifyPlaylist].self, from: data)
        } catch {
            // Saved by an earlier build that added playlists by link.
            log.notice("Starting the Spotify playlists afresh: \(String(describing: error), privacy: .public)")
            return []
        }
    }
}
