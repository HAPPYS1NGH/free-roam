import AppKit
import OSLog
import os
import Security

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

/// Runs `spotify_cli`, the command-line tool inside Spotify's own app (on
/// 1.3.10, for Apple silicon and Intel). Unlike Spotify's AppleScript, it
/// can list your playlists and their songs, and it plays a song without
/// bringing Spotify forward or switching you to its desktop.
///
/// It's undocumented, so Free Roam runs it only when Spotify signed it, and
/// a Spotify without it falls back to AppleScript. It answers only while
/// Spotify is running.
enum SpotifyCLI {
    enum Failure: LocalizedError, Equatable {
        /// This Spotify has no tool, or not one Spotify signed.
        case missing
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .missing: "Free Roam needs a newer Spotify to find your playlists. Update Spotify, then try again."
            case .failed(let message): "Spotify said: \(message)"
            }
        }
    }

    /// Spotify AB's Developer ID team.
    private static let requirement = #"anchor apple generic and certificate leaf[subject.OU] = "2FNC3A47ZF""#
    /// Each signature is checked once per copy of the tool, and again after
    /// Spotify updates it.
    private static let verified = OSAllocatedUnfairLock<[String: Bool]>(initialState: [:])

    /// The tool in the installed Spotify, or nil when it has none or it
    /// isn't signed by Spotify.
    static var executable: URL? {
        guard let app = NSWorkspace.shared.urlForApplication(withBundleIdentifier: SpotifyBridge.bundleID) else { return nil }
        let tool = app.appending(path: "Contents/MacOS/spotify_cli")
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: tool.path),
              let modified = attributes[.modificationDate] as? Date
        else { return nil }
        let key = "\(tool.path)@\(modified.timeIntervalSince1970)"
        if let known = verified.withLock({ $0[key] }) { return known ? tool : nil }
        let signed = isSignedBySpotify(tool)
        verified.withLock { $0[key] = signed }
        if !signed { log.error("Not running Spotify's command-line tool: Spotify didn't sign it") }
        return signed ? tool : nil
    }

    private static func isSignedBySpotify(_ tool: URL) -> Bool {
        var code: SecStaticCode?
        var requirement: SecRequirement?
        guard SecStaticCodeCreateWithPath(tool as CFURL, [], &code) == errSecSuccess, let code,
              SecRequirementCreateWithString(Self.requirement as CFString, [], &requirement) == errSecSuccess
        else { return false }
        return SecStaticCodeCheckValidity(code, [], requirement) == errSecSuccess
    }

    // MARK: - Running

    /// Playing goes one command at a time, so a station's queue is cleared,
    /// played and filled in the order it was asked for. Reading the library
    /// has its own line, so it never holds up a tune.
    enum Lane {
        case player, library

        fileprivate var queue: DispatchQueue {
            switch self {
            case .player: SpotifyCLI.playerQueue
            case .library: SpotifyCLI.libraryQueue
            }
        }
    }

    private static let playerQueue = DispatchQueue(label: "com.happys1ngh.freeroam.spotify-cli.player")
    private static let libraryQueue = DispatchQueue(label: "com.happys1ngh.freeroam.spotify-cli.library")
    /// A command answers in about a quarter of a second.
    private static let timeout: TimeInterval = 15

    /// Runs the tool with `arguments` and returns what it printed.
    @discardableResult
    static func run(_ arguments: [String], lane: Lane) async throws -> Data {
        guard let tool = executable else { throw Failure.missing }
        return try await withCheckedThrowingContinuation { continuation in
            lane.queue.async {
                continuation.resume(with: Result { try runNow(tool, arguments) })
            }
        }
    }

    static func decode<Value: Decodable>(_ type: Value.Type, _ arguments: [String], lane: Lane) async throws -> Value {
        let output = try await run(arguments + ["--format", "json"], lane: lane)
        return try JSONDecoder().decode(type, from: output)
    }

    private static func runNow(_ tool: URL, _ arguments: [String]) throws -> Data {
        let process = Process()
        process.executableURL = tool
        process.arguments = arguments
        let output = Pipe()
        let errors = Pipe()
        process.standardOutput = output
        process.standardError = errors
        process.standardInput = FileHandle.nullDevice
        try process.run()
        let timer = DispatchWorkItem { [process] in
            guard process.isRunning else { return }
            log.error("Spotify's command-line tool took too long, so Free Roam stopped it")
            process.terminate()
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + timeout, execute: timer)
        // Both pipes are read before waiting, so a full pipe can't stall the tool.
        let errorText = OSAllocatedUnfairLock(initialState: Data())
        let readingErrors = DispatchGroup()
        readingErrors.enter()
        DispatchQueue.global().async {
            let data = errors.fileHandleForReading.readDataToEndOfFile()
            errorText.withLock { $0 = data }
            readingErrors.leave()
        }
        let data = output.fileHandleForReading.readDataToEndOfFile()
        readingErrors.wait()
        process.waitUntilExit()
        timer.cancel()
        guard process.terminationStatus == 0 else {
            let message = String(decoding: errorText.withLock { $0 }, as: UTF8.self)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            throw failure(message: message)
        }
        return data
    }

    static func failure(message: String) -> any Error {
        if message.localizedCaseInsensitiveContains("not running") { return MusicBridgeError.notRunning }
        return Failure.failed(message.isEmpty ? "Spotify's command-line tool failed" : message)
    }
}

// MARK: - Library

extension SpotifyCLI {
    struct ListedPlaylist: Equatable, Sendable {
        let id: String
        let name: String
    }

    struct LibraryPage: Decodable {
        struct Item: Decodable {
            let uri: String
            let name: String
            let type: String
        }

        let items: [Item]
        let has_more: Bool?
    }

    struct PlaylistPage: Decodable {
        struct Item: Decodable {
            let type: String
            let uri: String
            let name: String
            let artists: [String]?
            let album: String?
        }

        let name: String
        let track_count: Int
        let tracks: [Item]
    }

    struct Lookup: Decodable {
        struct Entity: Decodable {
            struct Field: Decodable {
                let field: String
                let value: String
            }

            let uri: String
            let image_url: String?
            let metadata: [Field]?
        }

        let entities: [Entity]
    }

    /// A song's length and cover, from `lookup`.
    struct Details: Equatable, Sendable {
        /// Seconds.
        let duration: TimeInterval
        let artworkURL: URL?
    }

    private static let libraryPageSize = 50
    private static let playlistPageSize = 100
    private static let lookupBatch = 50

    /// The playlists in your library, in its order, folders flattened.
    static func playlists() async throws -> [ListedPlaylist] {
        var listed: [ListedPlaylist] = []
        var offset = 0
        while true {
            let page = try await decode(LibraryPage.self, [
                "library", "list", "--type", "playlist",
                "--limit", "\(libraryPageSize)", "--offset", "\(offset)",
            ], lane: .library)
            listed += playlists(in: page)
            offset += page.items.count
            guard page.has_more == true, !page.items.isEmpty else { return listed }
        }
    }

    static func playlists(in page: LibraryPage) -> [ListedPlaylist] {
        page.items.compactMap { item in
            guard item.type == "playlist", let id = item.uri.wholeMatch(of: /spotify:playlist:([0-9A-Za-z]{22})/)?.1 else { return nil }
            return ListedPlaylist(id: String(id), name: item.name)
        }
    }

    /// A playlist's name and its songs in order, with their lengths and
    /// covers. Songs Spotify can't play, such as ones no longer available
    /// in your country, aren't listed, and nor are podcast episodes. Lengths
    /// already in `known` aren't looked up again.
    static func playlist(id: String, known: [String: Details]) async throws -> (name: String, tracks: [SpotifyTrack]) {
        guard SpotifyURI.isBaseID(id) else { throw MusicBridgeError.invalidPersistentID(id) }
        var name = ""
        var items: [PlaylistPage.Item] = []
        var offset = 0
        while true {
            let page = try await decode(PlaylistPage.self, [
                "playlist", "get", SpotifyURI.playlist(id),
                "--limit", "\(playlistPageSize)", "--offset", "\(offset)",
            ], lane: .library)
            name = page.name
            items += page.tracks
            offset += playlistPageSize
            // Unplayable songs leave a page short, so the count says when it's done.
            guard offset < page.track_count, !page.tracks.isEmpty else { break }
        }
        let songs = items.filter { $0.type == "track" && SpotifyURI.isTrack($0.uri) }
        var details = known
        let missing = Array(Set(songs.map(\.uri)).subtracting(known.keys))
        for start in stride(from: 0, to: missing.count, by: lookupBatch) {
            let batch = Array(missing[start..<min(start + lookupBatch, missing.count)])
            let lookup = try await decode(Lookup.self, ["lookup"] + batch + ["--fields", "duration"], lane: .library)
            details.merge(Self.details(in: lookup)) { _, new in new }
        }
        return (name, tracks(songs, details: details))
    }

    static func details(in lookup: Lookup) -> [String: Details] {
        var details: [String: Details] = [:]
        for entity in lookup.entities {
            guard let milliseconds = entity.metadata?.first(where: { $0.field == "duration" }).flatMap({ Double($0.value) }),
                  milliseconds > 0
            else { continue }
            details[entity.uri] = Details(duration: milliseconds / 1000, artworkURL: entity.image_url.flatMap(cover))
        }
        return details
    }

    /// Songs without a length can't be put on a station's clock, so they're left out.
    static func tracks(_ songs: [PlaylistPage.Item], details: [String: Details]) -> [SpotifyTrack] {
        songs.compactMap { song in
            guard let found = details[song.uri] else { return nil }
            return SpotifyTrack(
                uri: song.uri,
                title: song.name,
                artist: (song.artists ?? []).joined(separator: ", "),
                album: song.album ?? "",
                duration: found.duration,
                artworkURL: found.artworkURL
            )
        }
    }

    /// `lookup` gives a 64-pixel cover. Spotify names each size of an album
    /// cover with its own prefix, so this asks for the 300-pixel one.
    static func cover(_ link: String) -> URL? {
        let resized = link.replacingOccurrences(of: "/image/ab67616d00004851", with: "/image/ab67616d00001e02")
        guard let url = URL(string: resized), SpotifyURI.isTrustedArtwork(url) else { return nil }
        return url
    }
}

// MARK: - Playing

extension SpotifyCLI {
    struct Queue: Decodable {
        struct Entry: Decodable {
            let uri: String
            /// "queue" for a song added to the queue, "context" for the
            /// playlist or album playing.
            let provider: String?
        }

        let next_tracks: [Entry]?
    }

    /// How many songs at the front of the queue were added to it, as
    /// opposed to the rest of what's playing.
    static func queuedCount(in queue: Queue) -> Int {
        (queue.next_tracks ?? []).prefix { $0.provider == "queue" }.count
    }

    /// Takes every added song out of the queue. A song queued for the last
    /// station would otherwise play after the next station's song.
    static func clearQueue() async throws {
        let queue = try await decode(Queue.self, ["queue", "list"], lane: .player)
        for _ in 0..<queuedCount(in: queue) {
            try await run(["queue", "remove", "0"], lane: .player)
        }
    }

    static func play(_ uri: String) async throws {
        guard SpotifyURI.isTrack(uri) || uri.wholeMatch(of: /spotify:playlist:[0-9A-Za-z]{22}/) != nil else {
            throw MusicBridgeError.invalidPersistentID(uri)
        }
        try await run(["play", uri], lane: .player)
    }

    static func enqueue(_ uri: String) async throws {
        guard SpotifyURI.isTrack(uri) else { throw MusicBridgeError.invalidPersistentID(uri) }
        try await run(["queue", "add", uri], lane: .player)
    }

    /// Spotify answers scripts a moment before the tool can reach it, so a
    /// launch waits for this too.
    static func isReady() async -> Bool {
        struct Status: Decodable {
            let running: Bool
            let logged_in: Bool
        }
        guard let status = try? await decode(Status.self, ["status"], lane: .library) else { return false }
        return status.running && status.logged_in
    }
}
