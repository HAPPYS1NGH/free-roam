import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "stations")

/// Which playlists are on the wheel, and in what order. Until you change
/// anything in Settings, the wheel follows Music's library order, as last
/// read. From then on your choice is saved by persistent ID, which survives
/// renames, with each name. Either way the wheel has its stations before
/// Music has started.
@MainActor @Observable
final class StationList {
    /// A playlist as Settings lists it, on the wheel or switched off.
    struct Entry: Codable, Hashable, Identifiable, Sendable {
        /// Music's persistent ID.
        let id: String
        /// The name Music last listed it with.
        var name: String
        var isOn: Bool
        /// Not in Music's latest list, so it's off the wheel and out of
        /// Settings. It keeps its place and whether it's on, because a list
        /// can come back short while iCloud Music Library syncs or another
        /// library is open. A playlist made again gets a new ID, so one that
        /// was really deleted just stays hidden.
        var isMissing = false
    }

    /// Music's playlists in library order. Nil until they've loaded.
    private(set) var library: [Playlist]?
    /// The library as Music last listed it, saved for the wheel to follow
    /// until Music's playlists load, while you haven't made a choice.
    @ObservationIgnored private var lastLibrary: [Playlist]?
    /// Why the playlists didn't load, for Settings.
    private(set) var loadError: (any Error)?
    /// Your choice in wheel order, with the playlists you switched off, so a
    /// new playlist can be told apart from one you don't want. Nil until you
    /// first change something in Settings.
    private(set) var choice: [Entry]?
    /// Called with the wheel's stations whenever Music's playlists load or
    /// you change them in Settings, so new stations' tracks and logos load.
    @ObservationIgnored var onChange: ([Playlist]) -> Void = { _ in }

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var loading: Task<Void, Never>?

    private static let defaultsKey = "stations"
    private static let libraryKey = "library"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        choice = Self.saved([Entry].self, forKey: Self.defaultsKey, in: defaults)
        lastLibrary = Self.saved([Playlist].self, forKey: Self.libraryKey, in: defaults)
    }

    /// The stations on the wheel, in order.
    var onWheel: [Playlist] {
        // An empty list is far more likely a library that hasn't loaded yet,
        // as just after Music launches, than every playlist deleted.
        let playlists = library?.isEmpty == false ? library : lastLibrary
        let entries = choice ?? playlists.map(Self.libraryOrder) ?? []
        return entries.filter { $0.isOn && !$0.isMissing }.map { Playlist(id: $0.id, name: $0.name) }
    }

    /// Every playlist in Music: the wheel's order, with the ones that are
    /// off where they were when they went off. Empty until Music's playlists
    /// have loaded.
    var entries: [Entry] {
        allEntries.filter { !$0.isMissing }
    }

    /// The entries with the missing ones.
    private var allEntries: [Entry] {
        guard let library else { return [] }
        return choice ?? Self.libraryOrder(library)
    }

    /// Reads Music's playlists again. Does nothing while Music isn't running.
    func reload() {
        load(launchingMusic: false)
    }

    /// For Settings, which lists every playlist: launches Music without
    /// bringing it to the front if it isn't running.
    func loadLaunchingMusic() {
        load(launchingMusic: true)
    }

    /// The wheel holds 25 stations.
    var isFull: Bool {
        Self.stationCount(allEntries) >= RadioWheelModel.maxStations
    }

    /// Puts a playlist on the end of the wheel, or takes it off. A 26th
    /// station stays off.
    func setOn(_ isOn: Bool, id: String) {
        guard let changed = Self.setting(isOn, id: id, in: allEntries) else { return }
        save(changed)
        onChange(onWheel)
        let name = changed.first { $0.id == id }?.name ?? id
        log.notice("Switched \(name, privacy: .public) \(isOn ? "on" : "off", privacy: .public)")
    }

    /// Moves a station to `index` in the wheel's order.
    func moveStation(_ id: String, to index: Int) {
        guard let moved = Self.moving(id, to: index, in: allEntries) else { return }
        save(moved)
        onChange(onWheel)
        log.notice("The wheel's order is now \(self.onWheel.map(\.name).joined(separator: ", "), privacy: .public)")
    }

    /// Takes a fresh list from Music. Once you've made a choice, playlists
    /// missing from the list are hidden, renames are picked up, and new
    /// playlists join the end of the wheel while it has room.
    func update(library playlists: [Playlist]) {
        if library != playlists { library = playlists }
        if !playlists.isEmpty, playlists != lastLibrary {
            lastLibrary = playlists
            save(playlists, forKey: Self.libraryKey)
        }
        // An empty list is far more likely a library that hasn't loaded than
        // every playlist deleted, and taking it would hide every station.
        if let choice, !playlists.isEmpty {
            let merged = Self.merge(choice, with: playlists)
            if merged != choice {
                logChanges(from: choice, to: merged)
                save(merged)
            }
        }
        onChange(onWheel)
    }

    nonisolated static func stationCount(_ entries: [Entry]) -> Int {
        entries.count { $0.isOn && !$0.isMissing }
    }

    /// A station going off keeps its place among the entries, and one going
    /// on moves to the end, so it joins the end of the wheel. Nil when
    /// nothing changes: the playlist isn't listed, it's already that way, or
    /// the wheel is full.
    nonisolated static func setting(_ isOn: Bool, id: String, in entries: [Entry]) -> [Entry]? {
        guard let index = entries.firstIndex(where: { $0.id == id && !$0.isMissing }), entries[index].isOn != isOn else { return nil }
        var changed = entries
        guard isOn else {
            changed[index].isOn = false
            return changed
        }
        guard stationCount(entries) < RadioWheelModel.maxStations else { return nil }
        var entry = changed.remove(at: index)
        entry.isOn = true
        changed.append(entry)
        return changed
    }

    /// Puts a station at `index` in the wheel's order, before the station
    /// there now, or after the last one. Playlists that are off or missing
    /// keep their places among the entries. Nil when nothing changes.
    nonisolated static func moving(_ id: String, to index: Int, in entries: [Entry]) -> [Entry]? {
        let wheel = entries.filter { $0.isOn && !$0.isMissing }
        guard let current = wheel.firstIndex(where: { $0.id == id }) else { return nil }
        let slot = min(max(index, 0), wheel.count - 1)
        guard slot != current else { return nil }
        var shown = entries.filter { !$0.isMissing }
        guard let from = shown.firstIndex(where: { $0.id == id }) else { return nil }
        let station = shown.remove(at: from)
        let stationIndices = shown.indices.filter { shown[$0].isOn }
        let insertion = slot < stationIndices.count ? stationIndices[slot] : stationIndices.last.map { $0 + 1 } ?? 0
        shown.insert(station, at: insertion)
        var next = shown.makeIterator()
        return entries.map { $0.isMissing ? $0 : next.next() ?? $0 }
    }

    /// The playlists whose names contain every word of the search, ignoring
    /// case and accents, in the order given.
    nonisolated static func matching(_ search: String, in playlists: [Playlist]) -> [Playlist] {
        let words = search.split(whereSeparator: \.isWhitespace).map(String.init)
        guard !words.isEmpty else { return playlists }
        return playlists.filter { playlist in words.allSatisfy { playlist.name.localizedStandardContains($0) } }
    }

    /// The first 25 playlists are on, as on the first run.
    nonisolated static func libraryOrder(_ library: [Playlist]) -> [Entry] {
        library.enumerated().map { index, playlist in
            Entry(id: playlist.id, name: playlist.name, isOn: index < RadioWheelModel.maxStations)
        }
    }

    nonisolated static func merge(_ choice: [Entry], with library: [Playlist]) -> [Entry] {
        let names = Dictionary(library.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
        var merged = choice.map { entry in
            var entry = entry
            entry.isMissing = names[entry.id] == nil
            entry.name = names[entry.id] ?? entry.name
            return entry
        }
        let known = Set(choice.map(\.id))
        var stations = stationCount(merged)
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
                let clock = ContinuousClock()
                let started = clock.now
                let playlists = try await MusicBridge.playlists()
                log.notice("Read \(playlists.count) playlists in \((clock.now - started) / .milliseconds(1), format: .fixed(precision: 0)) ms")
                update(library: playlists)
                loadError = nil
            } catch {
                loadError = error
                log.error("Couldn't load the playlists: \(String(describing: error), privacy: .public)")
            }
        }
    }

    private func logChanges(from choice: [Entry], to merged: [Entry]) {
        let before = Dictionary(choice.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        for entry in merged {
            guard let old = before[entry.id] else {
                log.notice("""
                    \(entry.name, privacy: .public) is new, \
                    \(entry.isOn ? "so it joins the end of the wheel" : "but the wheel is full, so it's off", privacy: .public)
                    """)
                continue
            }
            if entry.isMissing, !old.isMissing {
                log.notice("\(entry.name, privacy: .public) is missing from Music, so it's hidden")
            } else if !entry.isMissing, old.isMissing {
                log.notice("\(entry.name, privacy: .public) is back in Music, in its old place")
            }
        }
    }

    private func save(_ entries: [Entry]) {
        choice = entries
        save(entries, forKey: Self.defaultsKey)
    }

    private func save(_ value: some Encodable, forKey key: String) {
        do {
            defaults.set(try JSONEncoder().encode(value), forKey: key)
        } catch {
            log.error("Couldn't save the \(key, privacy: .public): \(String(describing: error), privacy: .public)")
        }
    }

    /// Nil when nothing is saved or it can't be read. Unreadable stations
    /// leave the wheel following library order.
    private static func saved<Value: Decodable>(_ type: Value.Type, forKey key: String, in defaults: UserDefaults) -> Value? {
        guard let data = defaults.data(forKey: key) else { return nil }
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            log.error("Couldn't read the saved \(key, privacy: .public): \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}
