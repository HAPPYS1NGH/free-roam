import Foundation
import Testing
@testable import FreeRoam

struct SpotifyURITests {
    @Test func acceptsSpotifyTracks() {
        #expect(SpotifyURI.isTrack("spotify:track:4HCOHRCSQelz2GPX8iTamO"))
    }

    @Test(arguments: [
        "",
        "spotify:ad:abcdef",
        "spotify:episode:4HCOHRCSQelz2GPX8iTamO",
        "spotify:track:4HCOHRCSQelz2GPX8iTamO0",
        "spotify:track:4HCOHRCSQelz2GPX8iTam",
        "spotify:track:4HCOHRCSQelz2GPX8iTam!",
        "spotify:track:4HCOHRCSQelz2GPX8iTamO\" & (do shell script \"say hi\") & \"",
        "spotify:local:Justice::Flower%20In%20A%20Hurricane:224",
        "spotify:playlist:4HCOHRCSQelz2GPX8iTamO",
        "spotify:track:4HCOHRCSQelz2GPX8iTamO\n",
    ])
    func rejectsAnythingElseAsATrack(_ uri: String) {
        #expect(!SpotifyURI.isTrack(uri))
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
    }
}
