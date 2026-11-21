import Foundation
import Testing
@testable import FreeRoam

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

    @Test func aTapMovesToTheNextStation() {
        #expect(WheelGeometry.nextStation(after: 0, count: 5) == 1)
        #expect(WheelGeometry.nextStation(after: 2, count: 5) == 3)
    }

    @Test func aTapWrapsPastRadioOff() {
        #expect(WheelGeometry.nextStation(after: 4, count: 5) == 1)
        #expect(WheelGeometry.nextStation(after: 1, count: 2) == 1)
    }

    @Test func aTapWithNoStationsGoesNowhere() {
        #expect(WheelGeometry.nextStation(after: 0, count: 1) == nil)
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

    /// Station, artist and title at the token sizes, from the top.
    private func captionHeights(_ sizes: WheelStyle.Sizes, unit: Double) -> [Double] {
        let pitch = sizes.captionPitch * unit
        return [sizes.stationSize / sizes.captionSize * pitch, pitch, pitch]
    }

    /// Line centres, %H from the ring's centre, measured from the website's
    /// caption spans in Chrome: station, artist just above the centre, title.
    @Test func captionLinesSitWhereThePrototypePutsThem() throws {
        let sizes = try TokensFixture.style().sizes
        let ring = WheelGeometry.ring(sizes, count: 25, screenHeight: 1000)
        let lines = WheelGeometry.captionLines(
            heights: captionHeights(sizes, unit: 10), ring: ring, sizes: sizes, screenHeight: 1000
        )
        let centres = lines.map { $0.y / 10 }
        for (centre, measured) in zip(centres, [-5.0, -1.078, 2.322]) {
            #expect(abs(centre - measured) < 0.01)
        }
    }

    /// Each line at its widest keeps the margin from every disc, wherever the
    /// selected one is, and uses the room up to it. 12 stations sit on the
    /// smallest ring, 16 on a grown one, and 24 and 25 on the largest, where
    /// the discs shrink instead.
    @Test(arguments: [12, 16, 24, 25])
    func captionLinesStayClearOfTheDiscs(stations: Int) throws {
        let sizes = try TokensFixture.style().sizes
        let screenHeight = 1000.0
        let unit = screenHeight / 100
        let count = stations + 1
        let ring = WheelGeometry.ring(sizes, count: count, screenHeight: screenHeight)
        let heights = captionHeights(sizes, unit: unit)
        let lines = WheelGeometry.captionLines(heights: heights, ring: ring, sizes: sizes, screenHeight: screenHeight)
        // The website's margin: one caption line inside the selected disc's ring.
        let reach = ring.selectedIcon / 2 + (sizes.ringWidth * unit).rounded() + sizes.captionPitch * unit
        for (line, height) in zip(lines, heights) {
            let gaps = (0..<count).map { slot in
                let angle = WheelGeometry.slotAngle(slot, count: count)
                let dx = max(abs(ring.radius * sin(angle)) - line.maxWidth / 2, 0)
                let dy = max(abs(-ring.radius * cos(angle) - line.y) - height / 2, 0)
                return hypot(dx, dy) - reach
            }
            let nearest = try #require(gaps.min())
            #expect(nearest >= -1e-9)
            #expect(nearest < unit)
        }
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
