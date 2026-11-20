import Foundation
import Testing
@testable import FreeRoam

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

    @Test func theNextTrackFollowsInPlaylistOrderAndGoesRound() {
        #expect(Broadcast.next(after: 0, durations: durations) == 1)
        #expect(Broadcast.next(after: 1, durations: durations) == 0)
        #expect(Broadcast.next(after: 0, durations: [100]) == 0)
    }

    @Test func theNextTrackSkipsTracksWithNoLength() {
        #expect(Broadcast.next(after: 0, durations: [100, 0, 0, 50]) == 3)
        #expect(Broadcast.next(after: 3, durations: [0, 100, 0, 50]) == 1)
    }

    @Test func aPlaylistWithNothingToPlayHasNoNextTrack() {
        #expect(Broadcast.next(after: 0, durations: []) == nil)
        #expect(Broadcast.next(after: 0, durations: [0, 0]) == nil)
    }
}
