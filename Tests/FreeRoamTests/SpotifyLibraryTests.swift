import Foundation
import Testing
@testable import FreeRoam

@MainActor
struct SpotifyLibraryTests {
    private func playlist(_ id: String, tracks: [String]) -> SpotifyPlaylist {
        SpotifyPlaylist(
            id: id, name: id, coverURL: nil,
            tracks: tracks.map { SpotifyTrack(uri: $0, title: $0, artist: "", album: "", duration: 1, artworkURL: nil) },
            tunedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private let a = "37i9dQZF1DXcBWIGoYBM5M"
    private let b = "37i9dQZF1DX0XUsuxWHRQd"
    private let t1 = "spotify:track:4HCOHRCSQelz2GPX8iTamO"
    private let t2 = "spotify:track:2sFepQNyl1WjpROruP8bJ0"
    private let t3 = "spotify:track:3zOYmiNOuyDL0ClxJcEJ0T"

    @Test func mapsTheTrackOnToItsPlaylist() {
        let playlists = [playlist(a, tracks: [t1, t2]), playlist(b, tracks: [t3])]
        let now = SpotifyBridge.nowPlaying(trackURI: t2, in: playlists, preferring: nil)
        #expect(now == NowPlaying(playlistID: a, trackIndex: 1, trackCount: 2))
        #expect(SpotifyBridge.nowPlaying(trackURI: t3, in: playlists, preferring: a)?.playlistID == b)
    }

    @Test func prefersThePlaylistLastTuned() {
        let playlists = [playlist(a, tracks: [t1, t2]), playlist(b, tracks: [t3, t2])]
        #expect(SpotifyBridge.nowPlaying(trackURI: t2, in: playlists, preferring: nil)?.playlistID == a)
        let preferred = SpotifyBridge.nowPlaying(trackURI: t2, in: playlists, preferring: b)
        #expect(preferred == NowPlaying(playlistID: b, trackIndex: 1, trackCount: 2))
    }

    @Test func isNilForATrackNoPlaylistHas() {
        #expect(SpotifyBridge.nowPlaying(trackURI: t3, in: [playlist(a, tracks: [t1])], preferring: a) == nil)
        #expect(SpotifyBridge.nowPlaying(trackURI: t1, in: [], preferring: nil) == nil)
    }

    @Test func keepsPlaylistsBetweenLaunches() throws {
        let file = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString, directoryHint: .isDirectory)
            .appending(path: "spotify-playlists.json")
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }

        let library = SpotifyLibrary(fileURL: file)
        #expect(library.playlists.isEmpty)
        let saved = playlist(a, tracks: [t1, t2])
        try saveForTest(saved, to: file)
        #expect(SpotifyLibrary(fileURL: file).playlists == [saved])

        let reloaded = SpotifyLibrary(fileURL: file)
        reloaded.remove(id: a)
        #expect(reloaded.playlists.isEmpty)
        #expect(SpotifyLibrary(fileURL: file).playlists.isEmpty)
    }

    @Test func startsEmptyFromAnUnreadableFile() throws {
        let file = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).json")
        try Data("not json".utf8).write(to: file)
        defer { try? FileManager.default.removeItem(at: file) }
        #expect(SpotifyLibrary(fileURL: file).playlists.isEmpty)
    }

    @Test func refusesLinksThatArentPlaylists() async {
        let library = SpotifyLibrary(fileURL: FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).json"))
        await #expect(throws: SpotifyLibraryError.notAPlaylistLink) {
            _ = try await library.add(link: "https://open.spotify.com/album/\(a)")
        }
    }

    @Test func readsTheNameAndCoverFromOEmbed() throws {
        let json = Data(#"{"title":"Today’s Top Hits","thumbnail_url":"https://i.scdn.co/image/x","html":"<iframe>"}"#.utf8)
        let details = try SpotifyOEmbed.details(from: json)
        #expect(details == .init(title: "Today’s Top Hits", coverURL: URL(string: "https://i.scdn.co/image/x")))
        let insecure = Data(#"{"title":"T","thumbnail_url":"http://example.com/x.jpg"}"#.utf8)
        #expect(try SpotifyOEmbed.details(from: insecure).coverURL == nil)
    }

    /// A save through `add` needs Spotify, so the file is written the way `add` writes it.
    private func saveForTest(_ playlist: SpotifyPlaylist, to file: URL) throws {
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode([playlist]).write(to: file)
    }
}
