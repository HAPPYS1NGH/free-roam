import Foundation
import Testing
@testable import FreeRoam

@MainActor
struct SpotifyLibraryTests {
    private func playlist(_ id: String, tracks: [String]?) -> SpotifyPlaylist {
        SpotifyPlaylist(
            id: id, name: id,
            tracks: tracks?.map { SpotifyTrack(uri: $0, title: $0, artist: "", album: "", duration: 1, artworkURL: nil) },
            readAt: Date(timeIntervalSince1970: 0)
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
        #expect(SpotifyBridge.nowPlaying(trackURI: t1, in: [playlist(b, tracks: nil)], preferring: b) == nil)
        #expect(SpotifyBridge.nowPlaying(trackURI: t1, in: [], preferring: nil) == nil)
    }

    @Test func aNewListKeepsTheSongsReadAndPicksUpRenamesAndOrder() {
        let saved = [playlist(a, tracks: [t1]), playlist(b, tracks: [t2])]
        let merged = SpotifyLibrary.merging([.init(id: b, name: "Gym"), .init(id: a, name: a)], into: saved)
        #expect(merged.map(\.id) == [b, a])
        #expect(merged[0].name == "Gym")
        #expect(merged[0].tracks == saved[1].tracks)
        #expect(merged[1].tracks == saved[0].tracks)
    }

    @Test func aNewPlaylistHasNoSongsUntilTheyreReadAndAnUnlistedOneGoes() {
        let merged = SpotifyLibrary.merging([.init(id: b, name: "New")], into: [playlist(a, tracks: [t1])])
        #expect(merged == [SpotifyPlaylist(id: b, name: "New")])
    }

    @Test func startsEmptyFromAnUnreadableFile() throws {
        let file = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).json")
        try Data("not json".utf8).write(to: file)
        defer { try? FileManager.default.removeItem(at: file) }
        #expect(SpotifyLibrary(fileURL: file).playlists.isEmpty)
    }

    @Test func readsThePlaylistsSavedLastTime() throws {
        let file = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: file) }
        let saved = [playlist(a, tracks: [t1, t2]), playlist(b, tracks: nil)]
        try JSONEncoder().encode(saved).write(to: file)
        #expect(SpotifyLibrary(fileURL: file).playlists == saved)
    }
}

struct SpotifyCLITests {
    private func decode<Value: Decodable>(_ type: Value.Type, _ json: String) throws -> Value {
        try JSONDecoder().decode(type, from: Data(json.utf8))
    }

    @Test func listsOnlyPlaylists() throws {
        let page = try decode(SpotifyCLI.LibraryPage.self, """
            {"items":[
              {"uri":"spotify:playlist:2PJciHGfJOgxiVQOY9JYJC","name":"GYM","type":"playlist","artists":[]},
              {"uri":"spotify:folder:abc","name":"Folder","type":"folder"},
              {"uri":"spotify:playlist:short","name":"Bad","type":"playlist"},
              {"uri":"spotify:playlist:2PJciHGfJOgxiVQOY9JYJC\\"; beep","name":"Bad","type":"playlist"}
            ],"total":4,"has_more":false}
            """)
        #expect(SpotifyCLI.playlists(in: page) == [.init(id: "2PJciHGfJOgxiVQOY9JYJC", name: "GYM")])
    }

    @Test func readsLengthsInSecondsWithBiggerCovers() throws {
        let lookup = try decode(SpotifyCLI.Lookup.self, """
            {"entities":[
              {"uri":"spotify:track:1jFtGMCWES8Z9UfivWVhuy","type":"Song","name":"ASTARR",
               "image_url":"https://i.scdn.co/image/ab67616d000048514cadfcf434bb64da26040f93",
               "metadata":[{"field":"duration","value":"195000"}]},
              {"uri":"spotify:track:46rkcCiXR478qcWERtneL7","image_url":"https://evil.example/x.jpg",
               "metadata":[{"field":"duration","value":"182000"}]},
              {"uri":"spotify:track:3z9y6N0U84V1tAF0kaFylH","metadata":[]},
              {"uri":"spotify:track:7vUfIIQiH3K3J5tmN46HE5","metadata":[{"field":"duration","value":"0"}]}
            ]}
            """)
        let details = SpotifyCLI.details(in: lookup)
        #expect(details.count == 2)
        #expect(details["spotify:track:1jFtGMCWES8Z9UfivWVhuy"] == .init(
            duration: 195,
            artworkURL: URL(string: "https://i.scdn.co/image/ab67616d00001e024cadfcf434bb64da26040f93")
        ))
        #expect(details["spotify:track:46rkcCiXR478qcWERtneL7"] == .init(duration: 182, artworkURL: nil))
    }

    @Test func leavesOutSongsWithoutALength() throws {
        let page = try decode(SpotifyCLI.PlaylistPage.self, """
            {"uri":"spotify:playlist:61JX6jLHrIaT57YeiJgKlF","name":"Repeat","track_count":2,"tracks":[
              {"type":"track","uri":"spotify:track:46rkcCiXR478qcWERtneL7","name":"Shining Koka",
               "artists":["Dilpreet Dhillon","Mehar Vaani"],"album":"Next Chapter","position":0},
              {"type":"track","uri":"spotify:track:3z9y6N0U84V1tAF0kaFylH","name":"Bullet","artists":[],"position":1}
            ]}
            """)
        let tracks = SpotifyCLI.tracks(page.tracks, details: ["spotify:track:46rkcCiXR478qcWERtneL7": .init(duration: 182, artworkURL: nil)])
        #expect(tracks == [SpotifyTrack(
            uri: "spotify:track:46rkcCiXR478qcWERtneL7", title: "Shining Koka",
            artist: "Dilpreet Dhillon, Mehar Vaani", album: "Next Chapter", duration: 182, artworkURL: nil
        )])
    }

    @Test func countsOnlyTheSongsAddedToTheQueue() throws {
        let queue = try decode(SpotifyCLI.Queue.self, """
            {"currently_playing":{"uri":"spotify:track:46rkcCiXR478qcWERtneL7","provider":"context"},
             "next_tracks":[
               {"uri":"spotify:track:3z9y6N0U84V1tAF0kaFylH","provider":"queue"},
               {"uri":"spotify:track:1jFtGMCWES8Z9UfivWVhuy","provider":"queue"},
               {"uri":"spotify:track:46rkcCiXR478qcWERtneL7","provider":"context"},
               {"uri":"spotify:track:7vUfIIQiH3K3J5tmN46HE5","provider":"queue"}
             ],"revision":"1"}
            """)
        #expect(SpotifyCLI.queuedCount(in: queue) == 2)
        #expect(SpotifyCLI.queuedCount(in: try decode(SpotifyCLI.Queue.self, "{}")) == 0)
    }

    @Test func tellsSpotifyNotRunningFromOtherFailures() {
        #expect(SpotifyCLI.failure(message: "Spotify desktop client is not running") as? MusicBridgeError == .notRunning)
        #expect(SpotifyCLI.failure(message: "playlist get failed: client connection failed") as? SpotifyCLI.Failure
            == .failed("playlist get failed: client connection failed"))
    }
}

struct SpotifyRelayTests {
    private let songs = [
        "spotify:track:46rkcCiXR478qcWERtneL7",
        "spotify:track:3z9y6N0U84V1tAF0kaFylH",
        "spotify:track:1jFtGMCWES8Z9UfivWVhuy",
    ]

    private func airing(at index: Int) -> SpotifyRelay.Airing {
        SpotifyRelay.Airing(playlistID: "61JX6jLHrIaT57YeiJgKlF", index: index, uris: songs, tune: UUID())
    }

    @Test func movesOnWhenTheQueuedSongStarts() {
        #expect(SpotifyRelay.event(state: "Playing", trackID: songs[1], airing: airing(at: 0)) == .advanced)
    }

    @Test func goesRoundToTheTopAfterTheLastSong() {
        #expect(airing(at: 2).nextIndex == 0)
        #expect(SpotifyRelay.event(state: "Playing", trackID: songs[0], airing: airing(at: 2)) == .advanced)
    }

    @Test func ignoresPausesSeeksAndAds() {
        #expect(SpotifyRelay.event(state: "Paused", trackID: songs[1], airing: airing(at: 0)) == .ignored)
        #expect(SpotifyRelay.event(state: "Playing", trackID: songs[0], airing: airing(at: 0)) == .ignored)
        #expect(SpotifyRelay.event(state: "Playing", trackID: "spotify:ad:000000012bd5e4de", airing: airing(at: 0)) == .ignored)
        #expect(SpotifyRelay.event(state: "Playing", trackID: nil, airing: airing(at: 0)) == .ignored)
    }

    @Test func stopsFollowingASongItDidntQueue() {
        #expect(SpotifyRelay.event(state: "Playing", trackID: songs[2], airing: airing(at: 0)) == .otherTrack)
    }
}
