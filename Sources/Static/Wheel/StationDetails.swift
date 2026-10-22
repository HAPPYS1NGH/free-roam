import CoreGraphics
import Foundation
import ImageIO
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.static", category: "stations")

/// Each station's tracks, for the caption's on-air line, and its logo: a 2×2
/// mosaic of covers from the playlist's first four albums. Music's scripting
/// interface reports no playlist artwork, so the covers come from tracks.
///
/// Everything loads in the background and the wheel draws whatever has
/// arrived, so opening it never waits for Music. Scripts run one at a time,
/// so a tune queued behind the loader waits for one script at most.
@MainActor @Observable
final class StationDetails {
    nonisolated static let coversPerLogo = 4
    /// Logos are at most 10.5%H across, about 150 pt on a 5K display, so this
    /// stays sharp at 2× on every screen.
    nonisolated static let logoPixels = 320

    private(set) var tracks: [String: [Track]] = [:]
    /// Missing for a station with no artwork, or whose covers are still loading.
    private(set) var logos: [String: CGImage] = [:]

    @ObservationIgnored private var queued: [String] = []
    @ObservationIgnored private var loading: Task<Void, Never>?

    /// Loads stations that haven't loaded yet. Asking Music would launch it,
    /// so nothing loads while it isn't running. A station that failed is
    /// tried again on the next call.
    func load(_ playlists: [Playlist]) {
        let missing = playlists.map(\.id).filter { tracks[$0] == nil && !queued.contains($0) }
        queued.append(contentsOf: missing)
        guard loading == nil, !queued.isEmpty, MusicBridge.isRunning else { return }
        loading = Task {
            await loadQueued()
            loading = nil
        }
    }

    /// Tracks for every station first, because they're quick and the caption
    /// needs them, then the covers.
    private func loadQueued() async {
        let clock = ContinuousClock()
        while !queued.isEmpty {
            let started = clock.now
            let batch = queued
            for id in batch {
                guard MusicBridge.isRunning else { break }
                do {
                    tracks[id] = try await MusicBridge.tracks(playlistID: id)
                } catch {
                    log.error("Couldn't read the tracks of \(id, privacy: .public): \(String(describing: error), privacy: .public)")
                }
            }
            let tracksLoaded = clock.now
            var covers = 0
            for id in batch {
                guard MusicBridge.isRunning, let stationTracks = tracks[id] else { continue }
                let data = await coverData(id, stationTracks)
                covers += data.count
                if let logo = await Self.logo(from: data) { logos[id] = logo }
            }
            queued.removeFirst(batch.count)
            log.notice("""
                Loaded \(batch.count) stations: tracks in \(Self.milliseconds(tracksLoaded - started)) ms, \
                \(covers) covers in \(Self.milliseconds(clock.now - tracksLoaded)) ms
                """)
        }
    }

    private func coverData(_ id: String, _ stationTracks: [Track]) async -> [Data] {
        var covers: [Data] = []
        for track in Self.coverTracks(stationTracks) {
            do {
                if let data = try await MusicBridge.artwork(playlistID: id, track: track) { covers.append(data) }
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
        var albums: Set<String> = []
        var picks: [Int] = []
        for (index, track) in tracks.enumerated() where picks.count < coversPerLogo {
            if albums.insert(track.album).inserted { picks.append(index + 1) }
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
