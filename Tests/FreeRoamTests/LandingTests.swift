import Foundation
import Testing
@testable import FreeRoam

struct LandingTests {
    @Test func landsPartwayIntoTheTrack() {
        #expect(RadioWheelModel.landing(in: 200, at: 0.15) == 30)
        #expect(RadioWheelModel.landing(in: 200, at: 0.65) == 130)
    }

    /// Landing on the last second would move Music on to the next track.
    @Test func staysShortOfTheEnd() {
        #expect(RadioWheelModel.landing(in: 2, at: 0.65) == 1)
        #expect(RadioWheelModel.landing(in: 0.5, at: 0.65) == 0)
    }

    @Test func aTrackWithNoLengthPlaysFromTheTop() {
        #expect(RadioWheelModel.landing(in: 0, at: 0.4) == 0)
    }
}
