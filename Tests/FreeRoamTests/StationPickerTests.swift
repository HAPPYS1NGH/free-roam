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

        // A missing station doesn't count, because it's off the wheel.
        let withMissing = (1...24).map { entry($0) } + [entry(25, missing: true), entry(26, on: false)]
        #expect(wheel(StationList.setting(true, id: id(26), in: withMissing)) == Array(1...24) + [26])
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

    @Test func isFullAtTwentyFiveStations() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(26))
        #expect(stations.isFull)
        stations.setOn(false, id: library(26)[3].id)
        #expect(!stations.isFull)
    }
}
