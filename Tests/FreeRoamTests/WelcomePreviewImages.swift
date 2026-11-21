import AppKit
import CoreText
import SwiftUI
import Testing
@testable import FreeRoam

/// Renders the welcome window's two Screen Recording previews from the app's
/// own wheel and backdrop, over the website's coast photo and the public
/// demo's covers. Run by `scripts/make-welcome-previews.sh`, which sets
/// `WELCOME_PREVIEWS`, and skipped otherwise.
@MainActor
struct WelcomePreviewImages {
    private static let root = URL(filePath: #filePath).deletingLastPathComponent().appending(path: "../..").standardizedFileURL
    private static let albums = root.appending(path: "prototype/public/free-roam/albums")
    /// A MacBook screen, so the wheel sits as it does on one.
    private static let screen = CGSize(width: 1512, height: 982)
    /// The middle of the screen, where the wheel is, at the window's aspect.
    private static let crop = CGRect(x: 256, y: 120, width: 1000, height: 640)
    /// Pixels wide: the preview's width in the window at 2×.
    private static let outputWidth = 400.0

    @Test(.enabled(if: ProcessInfo.processInfo.environment["WELCOME_PREVIEWS"] != nil))
    func render() async throws {
        let fontURL = Self.root.appending(path: "Sources/FreeRoam/Resources/\(CaptionFont.name).ttf")
        CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
        let style = try TokensFixture.style()
        let coastData = try Data(contentsOf: Self.root.appending(path: "prototype/public/free-roam/coast.jpg"))
        let coast = try #require(NSImage(data: coastData)?.cgImage(forProposedRect: nil, context: nil, hints: nil))
        let faded = try #require(BackdropStill.filter(
            coast, saturation: style.behaviour.backdropSaturation, brightness: style.behaviour.backdropBrightness
        ))

        let stations: [(name: String, covers: [String])] = [
            ("God's Favorite", ["gods-favorite-0"]),
            ("gym", ["gym-0", "gym-1", "gym-2", "gym-3"]),
            ("PLow", ["plow-0", "plow-1", "plow-2", "plow-3"]),
            ("Morning Playlist", ["morning-0"]),
            ("Night", ["night"]),
            ("Road", ["road"]),
            ("Punjabi", ["punjabi"]),
            ("Rap", ["rap"]),
            ("Indie", ["indie"]),
            ("Electronic", ["electronic"]),
        ]
        let playlists = stations.enumerated().map { Playlist(id: String(format: "%016X", $0.offset + 1), name: $0.element.name) }
        var logos: [String: CGImage] = [:]
        for (playlist, station) in zip(playlists, stations) {
            let covers = try station.covers.map { try Data(contentsOf: Self.albums.appending(path: "\($0).jpg")) }
            logos[playlist.id] = await StationDetails.logo(from: covers)
        }
        let gym = playlists[1]
        let tracks = [gym.id: [Track(title: "Schedule", artist: "Tegi Pannu & Manni Sandhu", album: "", duration: 200)]]

        for (name, still) in [("WelcomeBefore", nil), ("WelcomeAfter", faded)] as [(String, CGImage?)] {
            let frame = ZStack {
                Image(decorative: still ?? coast, scale: 1).resizable().aspectRatio(contentMode: .fill)
                // Without the permission there's no still, only the wash and vignette over the live screen.
                Color(red: 70 / 255, green: 120 / 255, blue: 210 / 255).opacity(0.07)
                Vignette(strength: style.behaviour.vignette)
                RadioWheelContent(
                    style: style, stations: playlists, highlighted: 2, presence: .shown, logos: logos, tracks: tracks
                )
            }
            .frame(width: Self.screen.width, height: Self.screen.height)
            .clipped()
            let renderer = ImageRenderer(content: frame)
            renderer.scale = 1
            let full = try #require(renderer.cgImage)
            let cropped = try #require(full.cropping(to: Self.crop))
            let size = NSSize(width: Self.outputWidth, height: Self.outputWidth * Self.crop.height / Self.crop.width)
            let rep = try #require(NSBitmapImageRep(
                bitmapDataPlanes: nil, pixelsWide: Int(size.width), pixelsHigh: Int(size.height), bitsPerSample: 8,
                samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
            ))
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
            NSGraphicsContext.current?.imageInterpolation = .high
            NSImage(cgImage: cropped, size: size).draw(in: NSRect(origin: .zero, size: size))
            NSGraphicsContext.restoreGraphicsState()
            let jpeg = try #require(rep.representation(using: .jpeg, properties: [.compressionFactor: 0.8]))
            try jpeg.write(to: Self.root.appending(path: "Sources/FreeRoam/Resources/\(name).jpg"))
        }
    }
}
