import AppKit
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
            try await MusicBridge.play(playlistID: "\"; beep")
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

    private func list(_ strings: [String]) -> NSAppleEventDescriptor {
        let list = NSAppleEventDescriptor.list()
        for (index, string) in strings.enumerated() {
            list.insert(NSAppleEventDescriptor(string: string), at: index + 1)
        }
        return list
    }
}
