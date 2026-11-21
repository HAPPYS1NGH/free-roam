import Foundation
import Testing
@testable import FreeRoam

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
        stations.moveStation(playlist(4).id, to: 0)
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
        stations.moveStation(playlist(3).id, to: 0)

        let renamed = Playlist(id: playlist(1).id, name: "Renamed")
        stations.update(library: [renamed, playlist(2)])
        #expect(stations.onWheel == [renamed, playlist(2)])
        #expect(StationList(defaults: defaults).onWheel == [renamed, playlist(2)])
    }

    @Test func aPlaylistMissingFromAListKeepsItsPlaceAndWhetherItsOn() {
        let stations = StationList(defaults: defaults)
        stations.update(library: library(4))
        stations.setOn(false, id: playlist(2).id)
        stations.moveStation(playlist(4).id, to: 0)

        // A short list, as while iCloud Music Library syncs.
        stations.update(library: [playlist(1), playlist(3)])
        #expect(stations.onWheel == [playlist(1), playlist(3)])
        #expect(stations.entries.map(\.id) == [playlist(1).id, playlist(3).id])
        stations.moveStation(playlist(3).id, to: 0)

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
        stations.moveStation(playlist(1).id, to: 1)
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

        stations.moveStation(second.id, to: 0)
        stations.setOn(false, id: first.id)
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

/// Music and Spotify each keep their own stations.
@MainActor
struct StationListPerAppTests {
    private let defaults: UserDefaults

    init() throws {
        let suite = "StationListPerAppTests.\(UUID().uuidString)"
        defaults = try #require(UserDefaults(suiteName: suite))
        defaults.removePersistentDomain(forName: suite)
    }

    private func playlist(_ id: String) -> Playlist {
        Playlist(id: id, name: "Playlist \(id)")
    }

    @Test func musicKeepsItsOriginalKeysAndSpotifyHasItsOwn() {
        #expect(StationList.defaultsKey(for: .music) == "stations")
        #expect(StationList.libraryKey(for: .music) == "library")
        #expect(StationList.defaultsKey(for: .spotify) == "spotify.stations")
        #expect(StationList.libraryKey(for: .spotify) == "spotify.library")
    }

    @Test func eachAppSavesToItsOwnKeys() {
        let music = StationList(defaults: defaults, app: .music)
        music.update(library: [playlist("A")])
        music.setOn(false, id: "A")
        #expect(defaults.data(forKey: "stations") != nil)
        #expect(defaults.data(forKey: "library") != nil)
        #expect(defaults.data(forKey: "spotify.stations") == nil)
        #expect(defaults.data(forKey: "spotify.library") == nil)

        let spotify = StationList(defaults: defaults, app: .spotify)
        spotify.update(library: [playlist("B")])
        #expect(defaults.data(forKey: "spotify.library") != nil)
        // Spotify's list didn't touch Music's.
        #expect(StationList(defaults: defaults, app: .music).onWheel.isEmpty)
        #expect(StationList(defaults: defaults, app: .spotify).onWheel == [playlist("B")])
    }

    @Test func switchingSwapsInTheOtherAppsStations() {
        let stations = StationList(defaults: defaults, app: .music)
        stations.update(library: [playlist("A"), playlist("C")])
        stations.setOn(false, id: "C")

        var wheels: [[Playlist]] = []
        stations.onChange = { wheels.append($0) }
        stations.switchApp(to: .spotify)
        #expect(stations.app == .spotify)
        #expect(stations.library == nil)
        #expect(stations.choice == nil)
        #expect(stations.onWheel.isEmpty)
        #expect(wheels.last == [])

        stations.update(library: [playlist("B")])
        stations.switchApp(to: .music)
        #expect(stations.library == nil)
        // Music's saved choice is back before its playlists have loaded.
        #expect(stations.onWheel == [playlist("A")])
        #expect(wheels.last == [playlist("A")])
    }

    @Test func switchingToTheSameAppChangesNothing() {
        let stations = StationList(defaults: defaults, app: .music)
        stations.update(library: [playlist("A")])
        stations.switchApp(to: .music)
        #expect(stations.library == [playlist("A")])
    }
}
