import AppKit
import Carbon.OpenScripting
import Testing
@testable import Static

struct MusicBridgeTests {
    @Test func acceptsPersistentIDs() {
        #expect(MusicBridge.isPersistentID("B965EB2A37B2731C"))
    }

    @Test(arguments: [
        "",
        "b965eb2a37b2731c",
        "B965EB2A37B2731",
        "B965EB2A37B2731C0",
        "B965EB2A37B2731\"",
        "\" & (do shell script \"say hi\") & \"",
    ])
    func rejectsAnythingElse(_ id: String) {
        #expect(!MusicBridge.isPersistentID(id))
    }

    @Test func refusesToScriptAnInvalidID() async {
        await #expect(throws: MusicBridgeError.self) {
            _ = try await MusicBridge.play(playlistID: "\"; beep", track: 1)
        }
        await #expect(throws: MusicBridgeError.self) {
            try await MusicBridge.trackDurations(playlistID: "\"; beep")
        }
        await #expect(throws: MusicBridgeError.self) {
            try await MusicBridge.tracks(playlistID: "\"; beep")
        }
        await #expect(throws: MusicBridgeError.self) {
            try await MusicBridge.artwork(playlistID: "\"; beep", track: 1)
        }
    }

    @Test func parsesPlaylistsAndDropsUnexpectedIDs() {
        let result = NSAppleEventDescriptor.list()
        result.insert(list(["B965EB2A37B2731C", "not an id", "E5B25C359F6E2F36"]), at: 1)
        result.insert(list(["Drive", "Broken", "\"; quoted & odd"]), at: 2)

        #expect(MusicBridge.parsePlaylists(result) == [
            Playlist(id: "B965EB2A37B2731C", name: "Drive"),
            Playlist(id: "E5B25C359F6E2F36", name: "\"; quoted & odd"),
        ])
    }

    @Test func parsesAnEmptyLibrary() {
        let result = NSAppleEventDescriptor.list()
        result.insert(list([]), at: 1)
        result.insert(list([]), at: 2)

        #expect(MusicBridge.parsePlaylists(result).isEmpty)
    }

    @Test func parsesDurationsAndZeroesMissingOnes() {
        let result = NSAppleEventDescriptor.list()
        result.insert(NSAppleEventDescriptor(double: 241.5), at: 1)
        result.insert(NSAppleEventDescriptor(typeCode: OSType(cMissingValue)), at: 2)
        result.insert(NSAppleEventDescriptor(double: -1), at: 3)
        result.insert(NSAppleEventDescriptor(int32: 180), at: 4)

        #expect(MusicBridge.parseDurations(result) == [241.5, 0, 0, 180])
    }

    @Test func parsesAnEmptyPlaylist() {
        #expect(MusicBridge.parseDurations(.list()).isEmpty)
    }

    @Test func parsesTheTracksOfAnEmptyPlaylist() {
        let result = NSAppleEventDescriptor.list()
        for index in 1...4 { result.insert(.list(), at: index) }

        #expect(MusicBridge.parseTracks(result).isEmpty)
    }

    @Test func parsesTracksAndBlanksMissingValues() {
        let missing = NSAppleEventDescriptor(typeCode: OSType(cMissingValue))
        let durations = NSAppleEventDescriptor.list()
        durations.insert(NSAppleEventDescriptor(double: 241.5), at: 1)
        durations.insert(missing, at: 2)
        let result = NSAppleEventDescriptor.list()
        result.insert(list(["Nights", "Untitled"]), at: 1)
        let artists = list(["Frank Ocean"])
        artists.insert(missing, at: 2)
        result.insert(artists, at: 2)
        result.insert(list(["Blonde", ""]), at: 3)
        result.insert(durations, at: 4)

        #expect(MusicBridge.parseTracks(result) == [
            Track(title: "Nights", artist: "Frank Ocean", album: "Blonde", duration: 241.5),
            Track(title: "Untitled", artist: "", album: "", duration: 0),
        ])
    }

    @Test func parsesTracksOnlyAsFarAsEveryListGoes() {
        let durations = NSAppleEventDescriptor.list()
        durations.insert(NSAppleEventDescriptor(double: 200), at: 1)
        let result = NSAppleEventDescriptor.list()
        result.insert(list(["One", "Two"]), at: 1)
        result.insert(list(["A", "B"]), at: 2)
        result.insert(list(["X", "Y"]), at: 3)
        result.insert(durations, at: 4)

        #expect(MusicBridge.parseTracks(result) == [Track(title: "One", artist: "A", album: "X", duration: 200)])
    }

    private func list(_ strings: [String]) -> NSAppleEventDescriptor {
        let list = NSAppleEventDescriptor.list()
        for (index, string) in strings.enumerated() {
            list.insert(NSAppleEventDescriptor(string: string), at: index + 1)
        }
        return list
    }
}
