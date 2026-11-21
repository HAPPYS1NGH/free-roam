import CoreGraphics
import Foundation
import ImageIO
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "stations")

/// Each station's tracks, for the caption's on-air line, and its logo: a 2×2
/// mosaic of covers from the playlist's first four albums. Music's scripting
/// interface reports no playlist artwork, so the covers come from tracks.
/// Settings asks for the logos of playlists that aren't on the wheel too.
///
/// Everything loads in the background and the wheel draws whatever has
/// arrived, so opening it never waits for Music. Scripts run one at a time,
/// so each of a tune's scripts can wait for one of the loader's, and a tune
/// that steps through its playlist runs several.
///
/// Settings' logos must never hold up a tune, and they share that queue. Each
/// costs one light read of the track count and the first 100 tracks'
/// albums, 16–39 ms on a 16-playlist library, then up to four 30–50 ms
/// cover reads. Reading every track instead took seconds for a smart
/// playlist of thousands. They come after any station waiting to load, one
/// script at a time, and each script waits while the wheel is in use: held,
/// open, a tap or tune on its way, or just after. A script already running
/// when ⌥Q goes down still finishes first, so the press's read of what Music
/// is playing, and a tap's tune after it, can wait for that one script: up
/// to about 50 ms.
/// Settings only asks for the playlists on screen, and drops a request when
/// it scrolls away or the window closes, so a closed window reads nothing.
///
/// Each logo is 400 KB decoded, so Settings keeps at most
/// `settingsLogoLimit` of the playlists that aren't stations, dropping the
/// longest unseen first, and lets go of them all when it closes.
@MainActor @Observable
final class StationDetails {
    nonisolated static let coversPerLogo = 4
    /// Logos are at most 10.5%H across, about 150 pt on a 5K display, so this
    /// stays sharp at 2× on every screen.
    nonisolated static let logoPixels = 320
    /// About 19 MB of logos for playlists that aren't stations, plus any on
    /// screen beyond that.
    nonisolated static let settingsLogoLimit = 48

    private(set) var tracks: [String: [Track]] = [:]
    /// Missing for a playlist with no artwork, or whose covers are still loading.
    private(set) var logos: [String: CGImage] = [:]
    /// How many tracks each playlist had when its tracks were last read, for
    /// Settings. Unknown until then.
    private(set) var songCounts: [String: Int] = [:]
    /// Whether the wheel is held, open or tuning, set by the wheel.
    @ObservationIgnored var isWheelInUse: () -> Bool = { false }

    @ObservationIgnored private var queued: [String] = []
    /// Playlists on screen in Settings that still need a logo, oldest first.
    @ObservationIgnored private var requested: [String] = []
    /// How many tiles and discs on screen show each playlist, so a cover in
    /// view is never dropped, and a request stays while one of them is left.
    @ObservationIgnored private var shown: [String: Int] = [:]
    /// Playlists read for Settings that aren't stations, with or without a
    /// logo, the longest unseen first.
    @ObservationIgnored private var settingsLogos: [String] = []
    @ObservationIgnored private var loading: Task<Void, Never>?

    /// Loads stations that haven't loaded yet. Nothing loads while Music
    /// isn't running. A station that failed, or had no tracks, is tried again
    /// on the next call.
    func load(_ playlists: [Playlist]) {
        enqueue(playlists.map(\.id).filter { tracks[$0] == nil })
    }

    /// Loads a station again when Music has a different number of tracks in
    /// it from the ones loaded, because the playlist was edited. Until then
    /// the caption and logo stay as they were.
    func reloadIfChanged(_ id: String, trackCount: Int) {
        guard let loaded = tracks[id], loaded.count != trackCount else { return }
        enqueue([id])
    }

    /// A Settings tile or disc came on screen: loads the playlist's logo and
    /// song count, unless they're loaded.
    func requestLogo(_ id: String) {
        shown[id, default: 0] += 1
        if let index = settingsLogos.firstIndex(of: id) {
            settingsLogos.append(settingsLogos.remove(at: index))
        }
        guard needsLogo(id), !requested.contains(id) else { return }
        requested.append(id)
        startLoading()
    }

    /// The tile or disc went off screen, so its logo can wait until it's back.
    func cancelLogo(_ id: String) {
        guard let count = shown[id] else { return }
        if count > 1 {
            shown[id] = count - 1
            return
        }
        shown[id] = nil
        requested.removeAll { $0 == id }
    }

    /// Settings closed: no more reads for it, and the logos of playlists that
    /// aren't stations go, so they don't sit in memory until it opens again.
    func settingsClosed() {
        requested.removeAll()
        shown.removeAll()
        for id in settingsLogos { logos[id] = nil }
        settingsLogos.removeAll()
    }

    /// Neither a station's logo nor one read for Settings has loaded. A
    /// station whose tracks have loaded gets its logo from the station loader.
    private func needsLogo(_ id: String) -> Bool {
        logos[id] == nil && tracks[id] == nil && !settingsLogos.contains(id)
    }

    private func enqueue(_ ids: [String]) {
        queued.append(contentsOf: ids.filter { !queued.contains($0) })
        startLoading()
    }

    private func startLoading() {
        guard loading == nil, !queued.isEmpty || !requested.isEmpty, MusicApp.bridge.isRunning else { return }
        loading = Task {
            await loadQueued()
            loading = nil
        }
    }

    /// Stations first, then the logos Settings asked for.
    private func loadQueued() async {
        while MusicApp.bridge.isRunning, !Task.isCancelled {
            if !queued.isEmpty {
                await loadStations()
            } else if let id = requested.first {
                if needsLogo(id) {
                    await loadRequestedLogo(id)
                } else {
                    requested.removeFirst()
                }
            } else {
                return
            }
        }
    }

    /// Tracks for every station first, because they're quick and the caption
    /// needs them, then the covers.
    private func loadStations() async {
        let clock = ContinuousClock()
        while !queued.isEmpty {
            let started = clock.now
            let batch = queued
            for id in batch {
                guard MusicApp.bridge.isRunning else { break }
                do {
                    let stationTracks = try await MusicApp.bridge.tracks(playlistID: id)
                    // An empty playlist isn't kept, so it's read again on the
                    // next open in case it has tracks by then.
                    tracks[id] = stationTracks.isEmpty ? nil : stationTracks
                    songCounts[id] = stationTracks.count
                    if stationTracks.isEmpty { logos[id] = nil }
                } catch {
                    log.error("Couldn't read the tracks of \(id, privacy: .public): \(String(describing: error), privacy: .public)")
                }
            }
            let tracksLoaded = clock.now
            var covers = 0
            for id in batch {
                guard MusicApp.bridge.isRunning, let stationTracks = tracks[id] else { continue }
                let data = await coverData(id, tracks: Self.coverTracks(stationTracks))
                covers += data.count
                logos[id] = await Self.logo(from: data)
                // A station's logo stays, whatever Settings does.
                settingsLogos.removeAll { $0 == id }
            }
            queued.removeFirst(batch.count)
            log.notice("""
                Loaded \(batch.count) stations: tracks in \(Self.milliseconds(tracksLoaded - started)) ms, \
                \(covers) covers in \(Self.milliseconds(clock.now - tracksLoaded)) ms
                """)
        }
    }

    /// Stops when the tile scrolls away, a station needs loading or Music
    /// quits, and the playlist starts again from its count next time.
    private func loadRequestedLogo(_ id: String) async {
        guard await mayRead(for: id) else { return }
        let summary: (trackCount: Int, albums: [String])
        do {
            summary = try await MusicApp.bridge.trackCountAndAlbums(playlistID: id)
        } catch {
            log.error("Couldn't read the albums of \(id, privacy: .public) for Settings: \(String(describing: error), privacy: .public)")
            // Tried again when its tile next comes on screen.
            requested.removeAll { $0 == id }
            return
        }
        var covers: [Data] = []
        for track in Self.coverTracks(albums: summary.albums) {
            guard await mayRead(for: id) else { return }
            covers += await coverData(id, tracks: [track])
        }
        logos[id] = await Self.logo(from: covers)
        songCounts[id] = summary.trackCount
        requested.removeAll { $0 == id }
        settingsLogos.removeAll { $0 == id }
        settingsLogos.append(id)
        let dropped = Self.logosToDrop(settingsLogos, onScreen: Set(shown.keys), limit: Self.settingsLogoLimit)
        for old in dropped { logos[old] = nil }
        settingsLogos.removeAll { dropped.contains($0) }
    }

    /// The longest unseen logos beyond the limit, never one on screen.
    /// `order` runs from the longest unseen to the latest.
    nonisolated static func logosToDrop(_ order: [String], onScreen: Set<String>, limit: Int) -> Set<String> {
        let excess = order.count - limit
        guard excess > 0 else { return [] }
        return Set(order.filter { !onScreen.contains($0) }.prefix(excess))
    }

    /// Waits while the wheel is in use, polling because the wheel's scripts
    /// come and go within a second. False once the request is gone, a station
    /// is waiting, which goes first, Music has quit, or the task is cancelled.
    private func mayRead(for id: String) async -> Bool {
        while isWheelInUse(), queued.isEmpty, requested.contains(id) {
            do {
                try await Task.sleep(for: .milliseconds(250))
            } catch {
                return false
            }
        }
        return queued.isEmpty && requested.contains(id) && MusicApp.bridge.isRunning
    }

    /// The covers of the given 1-based tracks that have one.
    private func coverData(_ id: String, tracks picks: [Int]) async -> [Data] {
        var covers: [Data] = []
        for track in picks {
            do {
                if let data = try await MusicApp.bridge.artwork(playlistID: id, track: track) { covers.append(data) }
            } catch {
                log.error("Couldn't read the artwork of track \(track) in \(id, privacy: .public): \(String(describing: error), privacy: .public)")
            }
        }
        return covers
    }

    /// The 1-based numbers of the first track from each of the first four
    /// distinct albums, like the mosaic Music draws for a playlist without
    /// its own artwork.
    nonisolated static func coverTracks(_ tracks: [Track]) -> [Int] {
        coverTracks(albums: tracks.map(\.album))
    }

    /// The same, from each track's album, in playlist order.
    nonisolated static func coverTracks(albums: [String]) -> [Int] {
        var seen: Set<String> = []
        var picks: [Int] = []
        for (index, album) in albums.enumerated() where picks.count < coversPerLogo {
            if seen.insert(album).inserted { picks.append(index + 1) }
        }
        return picks
    }

    /// Four covers make a 2×2 mosaic, and fewer show the first one alone.
    /// Nil when none of them decode.
    @concurrent nonisolated static func logo(from covers: [Data]) async -> CGImage? {
        let mosaic = covers.count >= coversPerLogo
        let tilePixels = mosaic ? logoPixels / 2 : logoPixels
        let images = covers.prefix(mosaic ? coversPerLogo : 1).compactMap { thumbnail($0, pixels: tilePixels) }
        guard !images.isEmpty, let context = CGContext(
            data: nil, width: logoPixels, height: logoPixels, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        context.interpolationQuality = .high
        // Tiles go left to right, top to bottom. CoreGraphics' y grows upwards.
        for (index, image) in images.enumerated() {
            let column = index % 2
            let row = images.count == 1 ? 0 : 1 - index / 2
            fill(context, CGRect(x: column * tilePixels, y: row * tilePixels, width: tilePixels, height: tilePixels), with: image)
        }
        return context.makeImage()
    }

    /// Decodes at the size it's drawn, so a 1200 px JPEG never sits in memory.
    nonisolated private static func thumbnail(_ data: Data, pixels: Int) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: pixels,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }

    /// Scales the image to cover the rect and crops what overflows, like CSS `object-fit: cover`.
    nonisolated private static func fill(_ context: CGContext, _ rect: CGRect, with image: CGImage) {
        let scale = max(rect.width / CGFloat(image.width), rect.height / CGFloat(image.height))
        let size = CGSize(width: CGFloat(image.width) * scale, height: CGFloat(image.height) * scale)
        context.saveGState()
        context.clip(to: rect)
        context.draw(image, in: CGRect(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2, width: size.width, height: size.height))
        context.restoreGState()
    }

    private static func milliseconds(_ duration: Duration) -> Int {
        Int((duration / .milliseconds(1)).rounded())
    }
}
