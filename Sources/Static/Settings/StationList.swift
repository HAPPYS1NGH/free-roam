import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.static", category: "stations")

/// Which playlists are on the wheel, and in what order. Until you change
/// anything in Settings, the wheel follows Music's library order. From then on
/// your choice is saved by persistent ID, which survives renames, with each
/// name, so the wheel has its stations before Music has started.
@MainActor @Observable
final class StationList {
    /// A playlist as Settings lists it, on the wheel or switched off.
    struct Entry: Codable, Hashable, Identifiable, Sendable {
        /// Music's persistent ID.
        let id: String
        /// The name Music last listed it with.
        var name: String
        var isOn: Bool
    }

    /// Music's playlists in library order. Nil until they've loaded.
    private(set) var library: [Playlist]?
    /// Why the playlists didn't load, for Settings.
    private(set) var loadError: String?
    /// Your choice in wheel order, with the playlists you switched off, so a
    /// new playlist can be told apart from one you don't want. Nil until you
    /// first change something in Settings.
    private(set) var choice: [Entry]?
    /// Called with the wheel's stations whenever Music's playlists load.
    @ObservationIgnored var onLoaded: ([Playlist]) -> Void = { _ in }

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var loading: Task<Void, Never>?

    private static let defaultsKey = "stations"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        choice = Self.savedChoice(in: defaults)
    }

    /// The stations on the wheel, in order.
    var onWheel: [Playlist] {
        let entries = choice ?? library.map(Self.libraryOrder) ?? []
        return entries.filter(\.isOn).map { Playlist(id: $0.id, name: $0.name) }
    }

    /// Every playlist in Music, in the order Settings lists them: the wheel's
    /// order, with the ones that are off where you left them. Empty until
    /// Music's playlists have loaded.
    var entries: [Entry] {
        guard let library else { return [] }
        return choice ?? Self.libraryOrder(library)
    }

    /// Reads Music's playlists again. Asking would launch Music, so this does
    /// nothing while it isn't running.
    func reload() {
        load(launchingMusic: false)
    }

    /// For Settings, which lists every playlist: launches Music without
    /// bringing it to the front if it isn't running.
    func loadLaunchingMusic() {
        load(launchingMusic: true)
    }

    /// Puts a playlist on the wheel or takes it off. The wheel holds 25
    /// stations, so a 26th stays off.
    func setOn(_ isOn: Bool, id: String) {
        var entries = self.entries
        guard let index = entries.firstIndex(where: { $0.id == id }), entries[index].isOn != isOn else { return }
        guard !isOn || entries.count(where: \.isOn) < RadioWheelModel.maxStations else { return }
        entries[index].isOn = isOn
        save(entries)
        log.notice("Switched \(entries[index].name, privacy: .public) \(isOn ? "on" : "off")")
    }

    func move(fromOffsets source: IndexSet, toOffset destination: Int) {
        var entries = self.entries
        entries.move(fromOffsets: source, toOffset: destination)
        guard entries != self.entries else { return }
        save(entries)
        log.notice("The wheel's order is now \(entries.filter(\.isOn).map(\.name).joined(separator: ", "), privacy: .public)")
    }

    /// Takes a fresh list from Music. Once you've made a choice, playlists
    /// that are gone drop out of it, renames are picked up, and new playlists
    /// join the end of the wheel while it has room.
    func update(library playlists: [Playlist]) {
        if library != playlists {
            log.notice("Music has \(playlists.count) playlists")
            library = playlists
        }
        if let choice {
            let merged = Self.merge(choice, with: playlists)
            if merged != choice {
                logChanges(from: choice, to: merged)
                save(merged)
            }
        }
        onLoaded(onWheel)
    }

    /// The first 25 playlists are on, as on the first run.
    nonisolated static func libraryOrder(_ library: [Playlist]) -> [Entry] {
        library.enumerated().map { index, playlist in
            Entry(id: playlist.id, name: playlist.name, isOn: index < RadioWheelModel.maxStations)
        }
    }

    nonisolated static func merge(_ choice: [Entry], with library: [Playlist]) -> [Entry] {
        let names = Dictionary(library.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
        var merged = choice.compactMap { entry -> Entry? in
            guard let name = names[entry.id] else { return nil }
            return Entry(id: entry.id, name: name, isOn: entry.isOn)
        }
        let known = Set(choice.map(\.id))
        var stations = merged.count(where: \.isOn)
        for playlist in library where !known.contains(playlist.id) {
            let isOn = stations < RadioWheelModel.maxStations
            if isOn { stations += 1 }
            merged.append(Entry(id: playlist.id, name: playlist.name, isOn: isOn))
        }
        return merged
    }

    private func load(launchingMusic: Bool) {
        guard loading == nil, launchingMusic || MusicBridge.isRunning else { return }
        loading = Task {
            defer { loading = nil }
            do {
                if !MusicBridge.isRunning {
                    try await MusicBridge.launch()
                    log.notice("Launched Music to list its playlists")
                }
                update(library: try await MusicBridge.playlists())
                loadError = nil
            } catch {
                loadError = error.localizedDescription
                log.error("Couldn't load the playlists: \(String(describing: error), privacy: .public)")
            }
        }
    }

    private func logChanges(from choice: [Entry], to merged: [Entry]) {
        let before = Set(choice.map(\.id))
        let after = Set(merged.map(\.id))
        for entry in choice where !after.contains(entry.id) {
            log.notice("\(entry.name, privacy: .public) is gone from Music, so it's off the wheel")
        }
        for entry in merged where !before.contains(entry.id) {
            log.notice("""
                \(entry.name, privacy: .public) is new, \
                \(entry.isOn ? "so it joins the end of the wheel" : "but the wheel is full, so it's off")
                """)
        }
    }

    private func save(_ entries: [Entry]) {
        choice = entries
        do {
            defaults.set(try JSONEncoder().encode(entries), forKey: Self.defaultsKey)
        } catch {
            log.error("Couldn't save the stations: \(String(describing: error), privacy: .public)")
        }
    }

    private static func savedChoice(in defaults: UserDefaults) -> [Entry]? {
        guard let data = defaults.data(forKey: defaultsKey) else { return nil }
        do {
            return try JSONDecoder().decode([Entry].self, from: data)
        } catch {
            log.error("Couldn't read the saved stations, so the wheel follows library order: \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}
