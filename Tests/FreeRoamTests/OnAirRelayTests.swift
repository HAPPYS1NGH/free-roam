import Testing
@testable import FreeRoam

struct OnAirRelayTests {
    /// "Panga" in God's Favorite, as Music 1.7.2 gave it to a script and in its notification.
    private let trackID = "74DDB4E3631F1409"
    private let notifiedID: Int64 = 8_421_085_766_966_252_553

    @Test func readsTheNotificationsPersistentIDAsHex() {
        #expect(OnAirRelay.hexID(notifiedID) == trackID)
        #expect(OnAirRelay.hexID(-7_205_876_321_943_474_906) == "9BFF95A9DF292D26")
        #expect(OnAirRelay.hexID(1) == "0000000000000001")
    }

    @Test func aStopIsTheEndOfTheTrack() {
        #expect(OnAirRelay.event(state: "Stopped", persistentID: nil, airing: trackID) == .ended)
    }

    /// A pause in Music, or a seek, leaves the station on its track.
    @Test func aPauseOrTheSameTrackPlayingIsIgnored() {
        #expect(OnAirRelay.event(state: "Paused", persistentID: notifiedID, airing: trackID) == .ignored)
        #expect(OnAirRelay.event(state: "Paused", persistentID: nil, airing: trackID) == .ignored)
        #expect(OnAirRelay.event(state: "Playing", persistentID: notifiedID, airing: trackID) == .ignored)
        #expect(OnAirRelay.event(state: "Playing", persistentID: notifiedID, airing: trackID.lowercased()) == .ignored)
    }

    @Test func anotherTrackPlayingIsOneFreeRoamDidNotPick() {
        #expect(OnAirRelay.event(state: "Playing", persistentID: 1, airing: trackID) == .otherTrack)
    }
}
