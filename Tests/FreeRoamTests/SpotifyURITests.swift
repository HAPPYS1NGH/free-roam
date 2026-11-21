import Foundation
import Testing
@testable import FreeRoam

struct SpotifyURITests {
    private let id = "37i9dQZF1DXcBWIGoYBM5M"

    @Test(arguments: [
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=0123456789abcdef",
        "http://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M/",
        "open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
        "https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x",
        "open.spotify.com/intl-pt-br/playlist/37i9dQZF1DXcBWIGoYBM5M",
        "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
        "  https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M\n",
    ])
    func readsPlaylistIDs(_ link: String) {
        #expect(SpotifyLibrary.playlistID(fromLink: link) == id)
    }

    @Test(arguments: [
        "",
        "hello",
        "https://open.spotify.com/album/37i9dQZF1DXcBWIGoYBM5M",
        "https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M",
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5",
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5MM",
        "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5!",
        "https://open.spotify.com/playlist/",
        "https://open.spotify.com/user/x/playlist/37i9dQZF1DXcBWIGoYBM5M",
        "https://evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M",
        "https://open.spotify.com.evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M",
        "ftp://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
        "spotify:track:37i9dQZF1DXcBWIGoYBM5M",
        "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M\"; beep",
        "spotify:playlist:short",
    ])
    func rejectsAnythingElse(_ link: String) {
        #expect(SpotifyLibrary.playlistID(fromLink: link) == nil)
    }

    @Test(arguments: [
        "spotify:track:4HCOHRCSQelz2GPX8iTamO",
        "spotify:local:Justice::Flower%20In%20A%20Hurricane:224",
        "spotify:local:::Untitled:",
    ])
    func acceptsPlayableTracks(_ uri: String) {
        #expect(SpotifyURI.isPlayableTrack(uri))
    }

    @Test(arguments: [
        "",
        "spotify:ad:abcdef",
        "spotify:episode:4HCOHRCSQelz2GPX8iTamO",
        "spotify:track:4HCOHRCSQelz2GPX8iTamO0",
        "spotify:track:4HCOHRCSQelz2GPX8iTam",
        "spotify:track:4HCOHRCSQelz2GPX8iTam!",
        "spotify:track:4HCOHRCSQelz2GPX8iTamO\" & (do shell script \"say hi\") & \"",
        "spotify:local:a:b:c\"; beep:1",
        "spotify:local:a:b:c",
        "spotify:local:a:b:c:12:13",
        "spotify:local:a b:c:d:1",
        "spotify:local:a:b:c:1\n",
    ])
    func rejectsAnythingElseAsATrack(_ uri: String) {
        #expect(!SpotifyURI.isPlayableTrack(uri))
    }

    @Test func recognisesAds() {
        #expect(SpotifyURI.isAd("spotify:ad:1234"))
        #expect(!SpotifyURI.isAd("spotify:track:4HCOHRCSQelz2GPX8iTamO"))
    }

    @Test func downloadsArtworkOnlyFromSpotifysImageHost() throws {
        #expect(SpotifyURI.isTrustedArtwork(try #require(URL(string: "https://i.scdn.co/image/ab67616d0000b273"))))
        #expect(!SpotifyURI.isTrustedArtwork(try #require(URL(string: "http://i.scdn.co/image/x"))))
        #expect(!SpotifyURI.isTrustedArtwork(try #require(URL(string: "https://i.scdn.co.evil.example/image/x"))))
        #expect(!SpotifyURI.isTrustedArtwork(try #require(URL(string: "https://evil.example/i.scdn.co"))))
    }

    @Test func refusesToScriptAnInvalidID() async {
        await #expect(throws: MusicBridgeError.self) {
            _ = try await SpotifyBridge.play(playlistID: "\"; beep")
        }
        await #expect(throws: MusicBridgeError.self) {
            _ = try await SpotifyBridge.play(playlistID: "\"; beep", track: 1)
        }
        await #expect(throws: MusicBridgeError.self) {
            try await SpotifyBridge.trackDurations(playlistID: "\"; beep")
        }
        await #expect(throws: MusicBridgeError.self) {
            try await SpotifyScan.run(playlistID: "\"; beep") { _ in }
        }
    }
}
