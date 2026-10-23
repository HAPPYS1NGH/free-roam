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

    @Test func retriesWhileMusicIsStarting() async throws {
        var tries = 0
        try await MusicBridge.retryWhileStarting(for: .seconds(5), every: .milliseconds(1)) {
            tries += 1
            if tries < 3 { throw MusicBridgeError.script(code: connectionInvalid, message: "Connection is invalid.") }
        }
        #expect(tries == 3)
    }

    @Test func stopsRetryingAfterTheLimit() async {
        let clock = ContinuousClock()
        let started = clock.now
        await #expect(throws: MusicBridgeError.self) {
            try await MusicBridge.retryWhileStarting(for: .milliseconds(100), every: .milliseconds(10)) {
                throw MusicBridgeError.script(code: errAETimeout, message: "AppleEvent timed out.")
            }
        }
        #expect(clock.now - started < .seconds(1))
    }

    @Test func doesNotRetryOtherErrors() async {
        var tries = 0
        await #expect(throws: MusicBridgeError.self) {
            try await MusicBridge.retryWhileStarting(for: .seconds(5), every: .milliseconds(1)) {
                tries += 1
                throw MusicBridgeError.notPermitted
            }
        }
        #expect(tries == 1)
    }

    @Test func launchesAtOnceWhenOptionIsUp() async throws {
        var checks = 0
        _ = try await MusicBridge.waitForOptionUp(every: .milliseconds(1)) {
            checks += 1
            return false
        }
        #expect(checks == 1)
    }

    @Test func waitsForOptionToComeUpBeforeLaunching() async throws {
        var checks = 0
        _ = try await MusicBridge.waitForOptionUp(every: .milliseconds(1)) {
            checks += 1
            return checks < 4
        }
        #expect(checks == 4)
    }

    @Test func givesUpRatherThanLaunchWithOptionHeld() async {
        let clock = ContinuousClock()
        let started = clock.now
        await #expect(throws: MusicBridgeError.optionHeld) {
            try await MusicBridge.waitForOptionUp(for: .milliseconds(50), every: .milliseconds(5)) { true }
        }
        #expect(clock.now - started < .seconds(1))
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

    @Test func parsesWhatMusicIsPlaying() {
        let result = NSAppleEventDescriptor.list()
        result.insert(NSAppleEventDescriptor(string: "B965EB2A37B2731C"), at: 1)
        result.insert(NSAppleEventDescriptor(int32: 3), at: 2)
        result.insert(NSAppleEventDescriptor(double: 121.5), at: 3)
        result.insert(NSAppleEventDescriptor(int32: 12), at: 4)

        #expect(MusicBridge.parseNowPlaying(result, at: Broadcast.epoch) == NowPlaying(
            playlistID: "B965EB2A37B2731C", onAir: .init(index: 2, position: 121.5), date: Broadcast.epoch, trackCount: 12
        ))
    }

    @Test func parsesNothingPlaying() {
        #expect(MusicBridge.parseNowPlaying(.list(), at: Broadcast.epoch) == nil)

        let notAnID = NSAppleEventDescriptor.list()
        notAnID.insert(NSAppleEventDescriptor(string: "library"), at: 1)
        notAnID.insert(NSAppleEventDescriptor(int32: 1), at: 2)
        notAnID.insert(NSAppleEventDescriptor(double: 0), at: 3)
        notAnID.insert(NSAppleEventDescriptor(int32: 1), at: 4)
        #expect(MusicBridge.parseNowPlaying(notAnID, at: Broadcast.epoch) == nil)
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

/// Every script checks inside itself that its app is running. Chess stands
/// in for Music, which tests mustn't script, and every Mac has it. These run
/// one at a time because NSAppleScript isn't thread-safe.
@Suite(.serialized) struct GuardedScriptTests {
    static let standIn = "com.apple.Chess"

    static var standInIsRunning: Bool {
        !NSRunningApplication.runningApplications(withBundleIdentifier: standIn).isEmpty
    }

    @Test(.enabled(if: !standInIsRunning)) func aScriptForAClosedAppDoesNotLaunchIt() {
        #expect(throws: MusicBridgeError.notRunning) {
            try MusicBridge.execute(#"tell application id "com.apple.Chess" to get version"#, ifRunning: Self.standIn)
        }
        #expect(!Self.standInIsRunning)
    }

    /// Sends no Apple Event, so it needs no permission.
    @Test func aScriptForARunningAppRuns() throws {
        let result = try MusicBridge.execute(#"return "ran""#, ifRunning: "com.apple.finder")
        #expect(result.stringValue == "ran")
    }
}
