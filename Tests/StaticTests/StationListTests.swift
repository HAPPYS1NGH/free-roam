import Foundation
import Testing
@testable import Static

@MainActor
struct StationListTests {
    /// A throwaway defaults domain per test, so nothing touches the app's own.
    private let defaults: UserDefaults

    init() throws {
        let suite = "StationListTests.\(UUID().uuidString)"
        defaults = try #require(UserDefaults(suiteName: suite))
        defaults.removePersistentDomain(forName: suite)
    }

    private func playlist(_ number: Int) -> Playlist {
        Playlist(id: String(format: "%016lX", number), name: "Playlist \(number)")
    }

    private func library(_ count: Int) -> [Playlist] {
        (1...count).map(playlist)
    }

    @Test func followsLibraryOrderUntilYouChooseAndCapsTheWheel() {
        let stations = StationList(defaults: defaults)
        #expect(stations.onWheel.isEmpty)
        #expect(stations.entries.isEmpty)

        stations.update(library: library(30))
        #expect(stations.onWheel == library(25))
        #expect(stations.entries.count == 30)
        #expect(stations.choice == nil)

        // With nothing chosen, a new playlist takes its place in the library.
        stations.update(library: [playlist(99)] + library(3))
        #expect(stations.onWheel == [playlist(99)] + library(3))
    }

    @Test func savesYourChoiceAndShowsItBeforeMusicHasLoaded() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(4))
        stations.setOn(false, id: playlist(2).id)
        stations.move(fromOffsets: [3], toOffset: 0)
        #expect(stations.onWheel == [playlist(4), playlist(1), playlist(3)])

        let relaunched = StationList(defaults: defaults)
        #expect(relaunched.library == nil)
        #expect(relaunched.onWheel == [playlist(4), playlist(1), playlist(3)])
    }

    @Test func followsTheLastLibraryBeforeMusicHasLoaded() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(3))
        // As while Music's library loads after it launches.
        stations.update(library: [])
        #expect(stations.onWheel == library(3))

        let relaunched = StationList(defaults: defaults)
        #expect(relaunched.library == nil)
        #expect(relaunched.onWheel == library(3))
        #expect(relaunched.entries.isEmpty)
    }

    @Test func dropsDeletedPlaylistsAndPicksUpRenames() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(3))
        stations.move(fromOffsets: [2], toOffset: 0)

        let renamed = Playlist(id: playlist(1).id, name: "Renamed")
        stations.update(library: [renamed, playlist(2)])
        #expect(stations.onWheel == [renamed, playlist(2)])
        #expect(StationList(defaults: defaults).onWheel == [renamed, playlist(2)])
    }

    @Test func aPlaylistMissingFromAListKeepsItsPlaceAndWhetherItsOn() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(4))
        stations.setOn(false, id: playlist(2).id)
        stations.move(fromOffsets: [3], toOffset: 0)

        // A short list, as while iCloud Music Library syncs.
        stations.update(library: [playlist(1), playlist(3)])
        #expect(stations.onWheel == [playlist(1), playlist(3)])
        #expect(stations.entries.map(\.id) == [playlist(1).id, playlist(3).id])
        stations.move(fromOffsets: [1], toOffset: 0)

        stations.update(library: library(4))
        #expect(stations.onWheel == [playlist(4), playlist(3), playlist(1)])
        #expect(stations.entries.map(\.id) == [4, 3, 2, 1].map { playlist($0).id })
        #expect(stations.entries[2].isOn == false)
    }

    @Test func anEmptyListChangesNothing() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(3))
        stations.setOn(false, id: playlist(1).id)

        stations.update(library: [])
        #expect(stations.onWheel == [playlist(2), playlist(3)])
        #expect(StationList(defaults: defaults).onWheel == [playlist(2), playlist(3)])
    }

    @Test func newPlaylistsJoinTheEndButOnesYouSwitchedOffStayOff() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(3))
        stations.setOn(false, id: playlist(1).id)

        stations.update(library: [playlist(9)] + library(3))
        #expect(stations.onWheel == [playlist(2), playlist(3), playlist(9)])
        #expect(stations.entries.map(\.id) == [1, 2, 3, 9].map { playlist($0).id })
    }

    @Test func aNewPlaylistStaysOffWhenTheWheelIsFull() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(26))
        stations.move(fromOffsets: [0], toOffset: 2)
        #expect(stations.onWheel.count == 25)

        stations.update(library: library(27))
        #expect(stations.onWheel.count == 25)
        #expect(stations.entries.last == StationList.Entry(id: playlist(27).id, name: "Playlist 27", isOn: false))
        // Off once, so it doesn't join when a station leaves.
        stations.update(library: Array(library(27).dropFirst()))
        #expect(!stations.onWheel.contains(playlist(27)))
    }

    @Test func keepsTheWheelAtTwentyFiveStations() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(26))
        stations.setOn(true, id: playlist(26).id)
        #expect(stations.onWheel.count == 25)
        #expect(stations.choice == nil)

        stations.setOn(false, id: playlist(1).id)
        stations.setOn(true, id: playlist(26).id)
        #expect(stations.onWheel == Array(library(26).dropFirst()))
    }

    @Test func keepsPlaylistsWithTheSameNameApart() {
        let first = Playlist(id: playlist(1).id, name: "Mix")
        let second = Playlist(id: playlist(2).id, name: "Mix")
        let stations = StationList(defaults: defaults)
        stations.update(library: [first, second])
        #expect(stations.onWheel == [first, second])

        stations.setOn(false, id: first.id)
        stations.move(fromOffsets: [1], toOffset: 0)
        #expect(stations.onWheel == [second])
        #expect(stations.entries.map(\.id) == [second.id, first.id])

        // Only the one Music no longer lists drops off.
        stations.update(library: [first])
        #expect(stations.onWheel.isEmpty)
        #expect(stations.entries.map(\.id) == [first.id])
        stations.update(library: [first, second])
        #expect(stations.onWheel == [second])
    }

    @Test func followsLibraryOrderWhenTheSavedChoiceIsUnreadable() {
        defaults.set(Data("not json".utf8), forKey: "stations")
        let stations = StationList(defaults: defaults)
        stations.update(library: library(2))
        #expect(stations.onWheel == library(2))
    }
}
