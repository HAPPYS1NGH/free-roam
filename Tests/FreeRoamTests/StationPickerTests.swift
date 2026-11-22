import Foundation
import Testing
@testable import FreeRoam

/// The rules behind Settings' cover grid and wheel strip.
struct StationPickerTests {
    private typealias Entry = StationList.Entry

    private func id(_ number: Int) -> String {
        String(format: "%016lX", number)
    }

    private func entry(_ number: Int, on: Bool = true, missing: Bool = false) -> Entry {
        Entry(id: id(number), name: "Playlist \(number)", isOn: on, isMissing: missing)
    }

    /// The stations in wheel order, as numbers.
    private func wheel(_ entries: [Entry]?) -> [Int] {
        (entries ?? []).filter { $0.isOn && !$0.isMissing }.compactMap { Int($0.id, radix: 16) }
    }

    // MARK: Putting a playlist on the wheel and taking it off

    @Test func aPlaylistGoingOnJoinsTheEndOfTheWheel() {
        let entries = [entry(1), entry(2, on: false), entry(3)]
        #expect(wheel(StationList.setting(true, id: id(2), in: entries)) == [1, 3, 2])
    }

    @Test func aStationGoingOffLeavesTheOthersInOrder() {
        let entries = [entry(1), entry(2), entry(3)]
        #expect(wheel(StationList.setting(false, id: id(2), in: entries)) == [1, 3])
    }

    @Test func nothingChangesForAnUnknownMissingOrUnchangedPlaylist() {
        let entries = [entry(1), entry(2, on: false), entry(3, missing: true)]
        #expect(StationList.setting(true, id: id(9), in: entries) == nil)
        #expect(StationList.setting(true, id: id(1), in: entries) == nil)
        #expect(StationList.setting(false, id: id(2), in: entries) == nil)
        #expect(StationList.setting(false, id: id(3), in: entries) == nil)
    }

    @Test func theWheelHoldsTwentyFiveStations() {
        let full = (1...25).map { entry($0) } + [entry(26, on: false)]
        #expect(StationList.stationCount(full) == 25)
        #expect(StationList.setting(true, id: id(26), in: full) == nil)

        // A missing station still counts, because it comes back in its place.
        let withMissing = (1...24).map { entry($0) } + [entry(25, missing: true), entry(26, on: false)]
        #expect(StationList.stationCount(withMissing) == 25)
        #expect(StationList.setting(true, id: id(26), in: withMissing) == nil)
    }

    @Test func mergingNeverLeavesMoreThanTwentyFiveOn() {
        // Saved by an earlier build that let the wheel overfill.
        let overfull = (1...27).map { entry($0) }
        let library = (1...28).map { Playlist(id: id($0), name: "Playlist \($0)") }
        let merged = StationList.merge(overfull, with: library)
        #expect(StationList.stationCount(merged) == 25)
        #expect(wheel(merged) == Array(1...25))
        #expect(merged.last == entry(28, on: false))
    }

    @Test func takesMissingStationsOffTheWheel() throws {
        let entries = [entry(1), entry(2, missing: true), entry(3, on: false, missing: true), entry(4)]
        let removed = try #require(StationList.removingMissingStations(from: entries))
        #expect(removed.map(\.isOn) == [true, false, false, true])
        #expect(removed.map(\.isMissing) == entries.map(\.isMissing))
        #expect(StationList.removingMissingStations(from: [entry(1), entry(2, on: false, missing: true)]) == nil)
    }

    @Test func saysHowManyStationsMusicDidNotList() {
        #expect(StationPicker.countText(stations: 12, missing: 0) == "12 of 25 on the wheel")
        #expect(StationPicker.countText(stations: 23, missing: 2) == "23 of 25 on the wheel · 2 not found in Music")
        #expect(StationPicker.countText(stations: 23, missing: 2, app: .spotify) == "23 of 25 on the wheel · 2 not found in Spotify")
    }

    // MARK: Reordering

    @Test(arguments: [
        (4, 0, [4, 1, 3]),
        (1, 2, [3, 4, 1]),
        (1, 1, [3, 1, 4]),
        (3, 99, [1, 4, 3]),
        (4, -5, [4, 1, 3]),
    ])
    func movesAStationToAPlaceOnTheWheel(station: Int, index: Int, expected: [Int]) {
        let entries = [entry(1), entry(2, on: false), entry(3), entry(4)]
        #expect(wheel(StationList.moving(id(station), to: index, in: entries)) == expected)
    }

    @Test func aMissingStationKeepsItsPlaceWhenOthersMove() throws {
        let entries = [entry(1), entry(2, missing: true), entry(3), entry(4)]
        let moved = try #require(StationList.moving(id(4), to: 0, in: entries))
        #expect(wheel(moved) == [4, 1, 3])
        #expect(moved[1] == entries[1])
    }

    @Test func nothingMovesThatIsOffOrAlreadyThere() {
        let entries = [entry(1), entry(2, on: false), entry(3)]
        #expect(StationList.moving(id(2), to: 0, in: entries) == nil)
        #expect(StationList.moving(id(1), to: 0, in: entries) == nil)
        #expect(StationList.moving(id(9), to: 0, in: entries) == nil)
    }

    // MARK: Search

    private let library = ["Gym Bangers", "Night Drive", "Café Mornings", "☕ Sunday Coffee", "Road Trip"].enumerated().map {
        Playlist(id: String(format: "%016lX", $0.offset), name: $0.element)
    }

    private func search(_ text: String) -> [String] {
        StationList.matching(text, in: library).map(\.name)
    }

    @Test func anEmptySearchShowsEveryPlaylist() {
        #expect(search("") == library.map(\.name))
        #expect(search("   ") == library.map(\.name))
    }

    @Test func searchIgnoresCaseAndAccents() {
        #expect(search("gym") == ["Gym Bangers"])
        #expect(search("CAFE") == ["Café Mornings"])
        #expect(search("coffee") == ["☕ Sunday Coffee"])
    }

    @Test func everyWordMustMatchInAnyOrder() {
        #expect(search("drive night") == ["Night Drive"])
        #expect(search("night gym").isEmpty)
    }

    @Test func aSearchCanMatchNothing() {
        #expect(search("zzz").isEmpty)
    }

    // MARK: VoiceOver and the tiles' text

    @Test func readsEachPlaylistsPlaceOnTheWheel() {
        #expect(PlaylistTile.accessibilityLabel(name: "Gym", slot: 3) == "Gym, on the wheel, slot 3")
        #expect(PlaylistTile.accessibilityLabel(name: "Road", slot: nil) == "Road, off the wheel")
    }

    @Test func countsSongs() {
        #expect(PlaylistTile.songCountText(0) == "No songs")
        #expect(PlaylistTile.songCountText(1) == "1 song")
        #expect(PlaylistTile.songCountText(48) == "48 songs")
    }

    // MARK: The strip's rows

    @Test func wrapsWhenARowIsFull() {
        #expect(FlowLayout.rows(widths: [30, 30, 30], in: 100, spacing: 10) == [0..<2, 2..<3])
        #expect(FlowLayout.rows(widths: [30, 30], in: 70, spacing: 10) == [0..<2])
        #expect(FlowLayout.rows(widths: [], in: 70, spacing: 10).isEmpty)
    }

    @Test func aViewWiderThanTheRowGetsARowOfItsOwn() {
        #expect(FlowLayout.rows(widths: [200, 30], in: 100, spacing: 10) == [0..<1, 1..<2])
    }

    @Test(arguments: [
        (CGPoint(x: 5, y: 5), 0),
        (CGPoint(x: 40, y: 5), 1),
        (CGPoint(x: 33, y: 5), 0),
        (CGPoint(x: 95, y: 70), 5),
        (CGPoint(x: 500, y: 5), 2),
        (CGPoint(x: 5, y: 500), 6),
        (CGPoint(x: 500, y: 500), 6),
        (CGPoint(x: -20, y: -20), 0),
    ])
    func findsTheDiscUnderThePointer(point: CGPoint, expected: Int) {
        // Three 30 × 50 discs to a 110 pt row, 10 apart: 0 1 2 / 3 4 5 / 6.
        let index = FlowLayout.index(
            at: point, count: 7, itemSize: CGSize(width: 30, height: 50), width: 110, spacing: 10, rowSpacing: 10
        )
        #expect(index == expected)
    }

    @Test func findsNoDiscInAnEmptyStrip() {
        #expect(FlowLayout.index(at: .zero, count: 0, itemSize: CGSize(width: 30, height: 50), width: 110, spacing: 10, rowSpacing: 10) == nil)
    }

    /// So the grid keeps its room when the wheel is full.
    @Test func twentyFiveStationsFitInTwoRowsAtTheNarrowestWindow() {
        let width = StationPicker.minWidth - 2 * StationPicker.margin - 2 * WheelStrip.padding
        let widths = Array(repeating: CGFloat(WheelStrip.discSize), count: RadioWheelModel.maxStations)
        #expect(FlowLayout.rows(widths: widths, in: width, spacing: WheelStrip.spacing).count == 2)
    }
}

@MainActor
struct StationListPickerTests {
    private let defaults: UserDefaults

    init() throws {
        let suite = "StationListPickerTests.\(UUID().uuidString)"
        defaults = try #require(UserDefaults(suiteName: suite))
        defaults.removePersistentDomain(forName: suite)
    }

    private func library(_ count: Int) -> [Playlist] {
        (1...count).map { Playlist(id: String(format: "%016lX", $0), name: "Playlist \($0)") }
    }

    @Test func aPlaylistPutBackOnJoinsTheEndAndIsSaved() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(3))
        stations.setOn(false, id: library(3)[0].id)
        stations.setOn(true, id: library(3)[0].id)
        let expected = [library(3)[1], library(3)[2], library(3)[0]]
        #expect(stations.onWheel == expected)
        #expect(StationList(defaults: defaults).onWheel == expected)
    }

    /// A partial read hid 2 of 25, which made room for 2 more, and the wheel
    /// went to 27 when they came back.
    @Test func aShortListDoesNotMakeRoomOnTheWheel() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(27))
        stations.moveStation(library(27)[0].id, to: 1)
        stations.update(library: Array(library(27).dropFirst(2)))
        #expect(stations.onWheel.count == 23)
        #expect(stations.missingStationCount == 2)
        #expect(stations.isFull)

        stations.setOn(true, id: library(27)[25].id)
        #expect(stations.onWheel.count == 23)

        stations.update(library: library(27))
        #expect(stations.onWheel.count == 25)
        #expect(stations.missingStationCount == 0)
    }

    @Test func removingMissingStationsMakesRoom() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(26))
        stations.moveStation(library(26)[0].id, to: 1)
        stations.update(library: Array(library(26).dropFirst()))
        stations.removeMissingStations()
        #expect(stations.missingStationCount == 0)
        #expect(!stations.isFull)

        stations.setOn(true, id: library(26)[25].id)
        #expect(stations.onWheel.count == 25)
        // Back in Music, but taken off, so it stays off.
        stations.update(library: library(26))
        #expect(!stations.onWheel.contains(library(26)[0]))
    }

    @Test func isFullAtTwentyFiveStations() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(26))
        #expect(stations.isFull)
        stations.setOn(false, id: library(26)[3].id)
        #expect(!stations.isFull)
    }
}
