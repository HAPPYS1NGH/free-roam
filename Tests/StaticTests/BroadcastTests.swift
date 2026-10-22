import Foundation
import Testing
@testable import Static

struct BroadcastTests {
    private let durations: [TimeInterval] = [100, 200]

    private func seconds(_ offset: TimeInterval) -> Date {
        Broadcast.epoch.addingTimeInterval(offset)
    }

    @Test func epochIsNewYear2026UTC() throws {
        #expect(Broadcast.epoch == (try Date("2026-01-01T00:00:00Z", strategy: .iso8601)))
    }

    @Test func startsAtTheTopOfThePlaylist() {
        #expect(Broadcast.onAir(durations: durations, at: seconds(0)) == .init(index: 0, position: 0))
    }

    @Test func landsPartwayIntoTheTrackOnAir() {
        #expect(Broadcast.onAir(durations: durations, at: seconds(250)) == .init(index: 1, position: 150))
    }

    @Test func loopsBackToTheFirstTrack() {
        #expect(Broadcast.onAir(durations: durations, at: seconds(350)) == .init(index: 0, position: 50))
        #expect(Broadcast.onAir(durations: durations, at: seconds(300 * 1000 + 120)) == .init(index: 1, position: 20))
    }

    @Test func timesBeforeTheEpochWrapAround() {
        #expect(Broadcast.onAir(durations: durations, at: seconds(-50)) == .init(index: 1, position: 150))
    }

    @Test func skipsTracksWithNoLength() {
        #expect(Broadcast.onAir(durations: [0, 100], at: seconds(10)) == .init(index: 1, position: 10))
    }

    @Test func emptyPlaylistsHaveNothingOnAir() {
        #expect(Broadcast.onAir(durations: [], at: seconds(10)) == nil)
        #expect(Broadcast.onAir(durations: [0, 0], at: seconds(10)) == nil)
    }
}
