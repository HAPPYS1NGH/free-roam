import Foundation
import Testing
@testable import Static

struct WheelGeometryTests {
    @Test func radioOffIsAtTheBottom() {
        #expect(WheelGeometry.slot(forX: 0, y: 1, count: 13) == 0)
    }

    @Test func stationsRunClockwiseFromTheBottom() {
        // y grows downwards: left, top and right are a quarter turn apart.
        #expect(WheelGeometry.slot(forX: -1, y: 0, count: 4) == 1)
        #expect(WheelGeometry.slot(forX: 0, y: -1, count: 4) == 2)
        #expect(WheelGeometry.slot(forX: 1, y: 0, count: 4) == 3)
    }

    @Test func bothSidesOfTheBottomWrapToRadioOff() {
        #expect(WheelGeometry.slot(forX: -0.01, y: 1, count: 13) == 0)
        #expect(WheelGeometry.slot(forX: 0.01, y: 1, count: 13) == 0)
    }

    @Test(arguments: [1, 2, 5, 13, 26])
    func everySlotAngleMapsBackToItsSlot(count: Int) {
        for index in 0..<count {
            let angle = WheelGeometry.slotAngle(index, count: count)
            #expect(WheelGeometry.slot(forX: sin(angle), y: -cos(angle), count: count) == index)
        }
    }

    @Test func ringAtNaturalSpacingUsesTheTokenSizes() throws {
        // 16 stations at 9.15%H apart need a 23.3%H radius, inside the limits.
        let ring = WheelGeometry.ring(try TokensFixture.style().sizes, count: 16, screenHeight: 1000)
        #expect(abs(ring.radius - 233.0) < 0.1)
        #expect(ring.icon == 88)
        #expect(ring.selectedIcon == 88)
    }

    @Test func shortListsSpreadRoundTheSmallestRing() throws {
        let ring = WheelGeometry.ring(try TokensFixture.style().sizes, count: 13, screenHeight: 1000)
        #expect(ring.radius == 220)
        #expect(ring.icon == 102)
    }

    @Test func longListsShrinkTheLogos() throws {
        let ring = WheelGeometry.ring(try TokensFixture.style().sizes, count: 26, screenHeight: 1000)
        #expect(ring.radius == 305)
        #expect(ring.icon == 70)
    }
}

struct PickCursorTests {
    @Test func insideTheDeadZoneThePickStays() {
        var cursor = PickCursor(pickRadius: 60, deadZone: 15)
        #expect(cursor.move(dx: 10, dy: 0, count: 4) == nil)
        #expect(cursor.move(dx: 10, dy: 0, count: 4) == 3)
    }

    @Test func aFlickSticksUntilYouPushTheOtherWay() {
        var cursor = PickCursor(pickRadius: 60, deadZone: 15)
        #expect(cursor.move(dx: 500, dy: 0, count: 4) == 3)
        #expect(cursor.x == 60)
        // Easing off a little stays on the station the flick reached.
        #expect(cursor.move(dx: -20, dy: 0, count: 4) == 3)
        #expect(cursor.move(dx: -200, dy: 0, count: 4) == 1)
    }

    @Test func pointingAtASlotCarriesOnFromThere() {
        var cursor = PickCursor(pickRadius: 60, deadZone: 15)
        cursor.point(at: 2, count: 4)
        #expect(cursor.move(dx: 0, dy: 0, count: 4) == 2)
        #expect(abs(cursor.y + 60) < 1e-9)
    }
}
