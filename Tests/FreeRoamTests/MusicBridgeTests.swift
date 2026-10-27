import AppKit
import Carbon.OpenScripting
import Testing
@testable import FreeRoam

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
        await #expect(throws: MusicBridgeError.self) {
            try await MusicBridge.trackCountAndAlbums(playlistID: "\"; beep")
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

    /// A newer pick cancels a tune waiting for ⌥, which leaves Music closed.
    @Test func stopsWaitingForOptionOnceCancelled() async {
        let clock = ContinuousClock()
        let started = clock.now
        let wait = Task {
            try await MusicBridge.waitForOptionUp(every: .milliseconds(5)) { true }
        }
        try? await Task.sleep(for: .milliseconds(20))
        wait.cancel()
        await #expect(throws: CancellationError.self) { try await wait.value }
        #expect(clock.now - started < .seconds(1))
    }

    @Test func givesUpRatherThanLaunchWithOptionHeld() async {
        let clock = ContinuousClock()
        let started = clock.now
        await #expect(throws: MusicBridgeError.optionHeld) {
            try await MusicBridge.waitForOptionUp(for: .milliseconds(50), every: .milliseconds(5)) { true }
        }
        #expect(clock.now - started < .seconds(1))
    }

    /// Only the last script stops at the on-air track, in case Music skips a
    /// track it can't play on the way.
    @Test func stepsToTheTrackAFewTracksPerScript() async throws {
        var track = 1
        var counts: [Int] = []
        var stops: [Int?] = []
        let reached = try await MusicBridge.stepOn(from: 1, to: 47, chunk: 10) { count, stop in
            counts.append(count)
            stops.append(stop)
            track += count
            return track
        } playOn: {
            Issue.record("Music moved on while paused, so it didn't need to play")
        }
        #expect(reached == 47)
        #expect(counts == [10, 10, 10, 10, 6])
        #expect(stops == [nil, nil, nil, nil, 47])
    }

    /// Each script asks for the steps left from where Music says it is.
    @Test func stepsOnFromWhereverMusicGot() async throws {
        var track = 1
        var counts: [Int] = []
        let reached = try await MusicBridge.stepOn(from: 1, to: 25, chunk: 10) { count, _ in
            counts.append(count)
            // Music takes only four of each script's steps.
            track += min(count, 4)
            return track
        } playOn: {}
        #expect(reached == 25)
        #expect(counts == [10, 10, 10, 10, 8, 4])
    }

    /// If a paused Music ignores `next track`, it steps while playing instead.
    @Test func playsOnOnceWhenPausedMusicDoesNotMove() async throws {
        var playing = false
        var track = 1
        var playOns = 0
        let reached = try await MusicBridge.stepOn(from: 1, to: 13) { count, _ in
            if playing { track += count }
            return track
        } playOn: {
            playOns += 1
            playing = true
        }
        #expect(reached == 13)
        #expect(playOns == 1)
    }

    @Test func waitsAndTriesAgainWhileMusicIgnoresAStep() async throws {
        var tries = 0
        var track = 1
        var playOns = 0
        let reached = try await MusicBridge.stepOn(from: 1, to: 5, every: .milliseconds(1)) { count, _ in
            tries += 1
            // Moves on only every third try, as if it were loading a track.
            if tries.isMultiple(of: 3) { track += count }
            return track
        } playOn: {
            playOns += 1
        }
        #expect(reached == 5)
        #expect(playOns == 1)
    }

    @Test func givesUpOnceTheLimitHasPassed() async throws {
        let clock = ContinuousClock()
        let started = clock.now
        let reached = try await MusicBridge.stepOn(from: 1, to: 47, within: .milliseconds(50), every: .milliseconds(5)) { _, _ in
            1
        } playOn: {}
        #expect(reached == 1)
        #expect(clock.now - started < .seconds(1))
    }

    /// A track Music can't play is skipped, which can carry it past the
    /// on-air track. Stepping back could go to and fro around it, so it stops.
    @Test func stopsPastTheTrackRatherThanGoBack() async throws {
        var skips = 0
        let reached = try await MusicBridge.stepOn(from: 45, to: 47) { _, _ in
            skips += 1
            return 48
        } playOn: {}
        #expect(reached == 48)
        #expect(skips == 1)
    }

    /// 0 is Music not saying, and a lower track is Music going back, as when
    /// it loops past the end.
    @Test(arguments: [0, 3]) func stopsWhenMusicGoesBackOrCantSay(_ answer: Int) async throws {
        let reached = try await MusicBridge.stepOn(from: 5, to: 47) { _, _ in answer } playOn: {}
        #expect(reached == answer)
    }

    @Test func doesNotStepWhenMusicCantSayWhereItStarted() async throws {
        let reached = try await MusicBridge.stepOn(from: 0, to: 47) { _, _ in
            Issue.record("Stepped without knowing where Music was")
            return 1
        } playOn: {}
        #expect(reached == 0)
    }

    /// A newer pick cancels the tune, which stops stepping between scripts.
    @Test func stopsSteppingOnceCancelled() async {
        let walk = Task {
            try await MusicBridge.stepOn(from: 1, to: 47, within: .seconds(30), every: .milliseconds(5)) { _, _ in 1 } playOn: {}
        }
        try? await Task.sleep(for: .milliseconds(20))
        walk.cancel()
        await #expect(throws: CancellationError.self) { try await walk.value }
    }

    /// A cancel that lands while Music steps still throws, whether that step
    /// reached the track (5) or didn't move (1), so the tune never plays on
    /// after Radio Off or another station has taken over.
    @Test(arguments: [5, 1]) func aCancelDuringAStepStopsWithoutPlayingOn(_ landsOn: Int) async {
        let walk = Task {
            try await MusicBridge.stepOn(from: 1, to: 5) { _, _ in
                withUnsafeCurrentTask { $0?.cancel() }
                return landsOn
            } playOn: {
                Issue.record("Played on after a cancel")
            }
        }
        await #expect(throws: CancellationError.self) { try await walk.value }
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

    @Test func parsesATrackCountAndAlbums() {
        let missing = NSAppleEventDescriptor(typeCode: OSType(cMissingValue))
        let albums = list(["Blonde", "Blonde"])
        albums.insert(missing, at: 3)
        let result = NSAppleEventDescriptor.list()
        result.insert(NSAppleEventDescriptor(int32: 4312), at: 1)
        result.insert(albums, at: 2)

        let parsed = MusicBridge.parseTrackCountAndAlbums(result)
        #expect(parsed.trackCount == 4312)
        #expect(parsed.albums == ["Blonde", "Blonde", ""])
    }

    @Test func parsesTheCountAndAlbumsOfAnEmptyPlaylist() {
        let result = NSAppleEventDescriptor.list()
        result.insert(NSAppleEventDescriptor(int32: 0), at: 1)
        result.insert(.list(), at: 2)

        let parsed = MusicBridge.parseTrackCountAndAlbums(result)
        #expect(parsed.trackCount == 0)
        #expect(parsed.albums.isEmpty)
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

/// Every script sends its Apple Events to one process, and nowhere else.
/// Chess stands in for Music, which tests mustn't script, and every Mac has
/// it. These run one at a time because AppleScript isn't thread-safe.
@Suite(.serialized) struct ProcessScriptTests {
    static let standIn = "com.apple.Chess"

    static var standInIsRunning: Bool {
        !NSRunningApplication.runningApplications(withBundleIdentifier: standIn).isEmpty
    }

    /// As when Music quits after its turn came: 81 ms after Music quit, a
    /// read that had checked it was running started it again.
    @Test(.enabled(if: !standInIsRunning)) func aScriptForAProcessThatHasGoneStartsNothing() throws {
        let gone = try Self.exitedProcessID()
        #expect(throws: MusicBridgeError.notRunning) {
            try MusicBridge.execute("count windows", terms: Self.standIn, in: gone)
        }
        #expect(!Self.standInIsRunning)
    }

    /// This process has no handler for `count`, so the error shows the event
    /// reached it, and not Chess.
    @Test(.enabled(if: !standInIsRunning)) func aScriptSendsItsEventsToTheProcess() {
        let error = #expect(throws: MusicBridgeError.self) {
            try MusicBridge.execute("count windows", terms: Self.standIn, in: getpid())
        }
        guard case .script(let code, _) = error else {
            Issue.record("Expected an Apple Event error, got \(String(describing: error))")
            return
        }
        #expect(code == errAEEventNotHandled)
        #expect(!Self.standInIsRunning)
    }

    /// Sends no Apple Event, so it needs no permission.
    @Test func aScriptThatSendsNothingRuns() throws {
        let result = try MusicBridge.execute(#"return "ran""#, terms: Self.standIn, in: getpid())
        #expect(result.stringValue == "ran")
    }

    private static func exitedProcessID() throws -> pid_t {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/true")
        try process.run()
        process.waitUntilExit()
        return process.processIdentifier
    }
}
