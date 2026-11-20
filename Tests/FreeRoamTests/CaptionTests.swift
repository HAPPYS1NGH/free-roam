import CoreText
import Foundation
import SwiftUI
import Testing
@testable import FreeRoam

struct CaptionTests {
    private let station = Playlist(id: "B965EB2A37B2731C", name: "Late Night")
    private let tracks = [
        Track(title: "Nights", artist: "Frank Ocean", album: "Blonde", duration: 100),
        Track(title: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", duration: 200),
    ]

    @Test func radioOffIsOneLine() {
        let caption = CaptionLines(station: nil, tracks: nil, at: Broadcast.epoch)
        #expect([caption.station, caption.artist, caption.title] == ["Radio Off", "", ""])
    }

    @Test func showsTheTrackOnTheClock() {
        let caption = CaptionLines(station: station, tracks: tracks, at: Broadcast.epoch.addingTimeInterval(150))
        #expect([caption.station, caption.artist, caption.title] == ["Late Night", "M83", "Midnight City"])
    }

    /// A pause or a skip in Music moves the station it's playing off the clock.
    @Test func showsTheTrackMusicIsPlaying() {
        let playing = NowPlaying(playlistID: station.id, trackIndex: 1, trackCount: 2)
        let caption = CaptionLines(station: station, tracks: tracks, nowPlaying: playing, at: Broadcast.epoch)
        #expect([caption.artist, caption.title] == ["M83", "Midnight City"])

        let elsewhere = NowPlaying(playlistID: "E5B25C359F6E2F36", trackIndex: 1, trackCount: 2)
        let other = CaptionLines(station: station, tracks: tracks, nowPlaying: elsewhere, at: Broadcast.epoch)
        #expect([other.artist, other.title] == ["Frank Ocean", "Nights"])
    }

    /// An edited playlist's track numbers may have moved since its tracks loaded.
    @Test(arguments: [(1, 3), (2, 3), (5, 2)])
    func followsTheClockWhenMusicsTrackDoesNotMatch(_ trackIndex: Int, _ trackCount: Int) {
        let playing = NowPlaying(playlistID: station.id, trackIndex: trackIndex, trackCount: trackCount)
        let caption = CaptionLines(station: station, tracks: tracks, nowPlaying: playing, at: Broadcast.epoch)
        #expect([caption.artist, caption.title] == ["Frank Ocean", "Nights"])
    }

    @Test func showsTheNameAloneUntilTheTracksLoad() {
        let caption = CaptionLines(station: station, tracks: nil, at: Broadcast.epoch)
        #expect([caption.station, caption.artist, caption.title] == ["Late Night", "", ""])
    }

    @Test func saysWhenThereIsNothingToPlay() {
        let caption = CaptionLines(station: station, tracks: [], at: Broadcast.epoch)
        #expect([caption.station, caption.artist, caption.title] == ["Late Night", "", "No songs"])
    }

    @Test(arguments: [
        ("Gym Bangers", "GB"),
        ("☕ Sunday Coffee", "SC"),
        ("Hype", "H"),
        ("late night drives through cities", "LN"),
        ("2000s", "2"),
        ("☕", ""),
    ])
    func initials(_ name: String, _ expected: String) {
        #expect(RadioWheelView.initials(of: name) == expected)
    }
}

/// Renders the whole wheel and finds the caption's lines in the pixels.
@MainActor
struct CaptionRenderTests {
    /// The caption's font, from the source tree, since tests have no app bundle.
    private static let font: CTFont? = {
        let url = URL(filePath: #filePath)
            .deletingLastPathComponent()
            .appending(path: "../../Sources/FreeRoam/Resources/\(CaptionFont.name).ttf")
            .standardizedFileURL
        guard CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil) else { return nil }
        return CTFontCreateWithName(CaptionFont.name as CFString, 1, nil)
    }()

    /// Each line's centre, %H from the ring's centre, measured from the
    /// prototype's caption spans in Chrome: station, artist, title.
    private static let prototypeCentres = [-5.0, -1.078, 2.322]

    /// The user's screen, 1512 × 982 pt. Capitals with no descenders, so each
    /// line's ink runs from cap height to baseline.
    @Test(arguments: [12, 16, 24])
    func linesSitWhereThePrototypePutsThem(stations: Int) throws {
        let font = try #require(Self.font)
        let style = try TokensFixture.style()
        let (width, height) = (1512, 982)
        let playlists = (1...stations).map { Playlist(id: String(format: "%016X", $0), name: "LATE NIGHT DRIVES \($0)") }
        let track = Track(title: "BROWN MUNDE LIVE FROM THE DESERT SESSIONS", artist: "AP DHILLON AND SHINDA KAHLON AND GURINDER GILL", album: "", duration: 1_000_000)
        // On the right, where the selected disc comes closest to the caption.
        let highlighted = (stations + 1) * 3 / 4
        let content = RadioWheelContent(
            style: style,
            stations: playlists,
            highlighted: highlighted,
            presence: .shown,
            logos: [:],
            tracks: Dictionary(uniqueKeysWithValues: playlists.map { ($0.id, [track]) }),
            // Playing, so the caption has all three lines.
            nowPlaying: NowPlaying(playlistID: playlists[highlighted - 1].id, trackIndex: 0, trackCount: 1)
        )
        let renderer = ImageRenderer(content: content.frame(width: Double(width), height: Double(height)))
        renderer.scale = 1
        let pixels = Pixels.rgba(try #require(renderer.cgImage))

        let unit = Double(height) / 100
        let centre = (x: Double(width) / 2, y: Double(height) / 2 - (style.sizes.raise * unit).rounded())
        let ring = WheelGeometry.ring(style.sizes, count: stations + 1, screenHeight: Double(height))
        // Inside the selected disc's ring, so only the caption is opaque white:
        // idle discs are see-through.
        let inner = Int(ring.radius - ring.selectedIcon / 2 - (style.sizes.ringWidth * unit).rounded())
        let columns = (Int(centre.x) - inner)..<(Int(centre.x) + inner)
        let inkRows = (0..<height).filter { y in
            columns.contains { x in pixels[(y * width + x) * 4..<(y * width + x) * 4 + 3].allSatisfy { $0 > 240 } }
        }
        var lines: [ClosedRange<Int>] = []
        for row in inkRows {
            if let last = lines.last, row - last.upperBound <= 2 {
                lines[lines.count - 1] = last.lowerBound...row
            } else {
                lines.append(row...row)
            }
        }
        try #require(lines.count == 3, "found \(lines)")

        let sizes = [style.sizes.stationSize, style.sizes.captionSize, style.sizes.captionSize].map { $0 * unit }
        for (index, (ink, size)) in zip(lines, sizes).enumerated() {
            // A line's box is ascent + descent tall and centred on the line.
            let baseline = (CTFontGetAscent(font) - CTFontGetDescent(font)) / 2 * size
            let capTop = baseline - CTFontGetCapHeight(font) * size
            let lineCentre = Double(ink.lowerBound + ink.upperBound + 1) / 2 - (capTop + baseline) / 2
            let measured = (lineCentre - centre.y) / unit
            #expect(abs(measured - Self.prototypeCentres[index]) < 0.2, "line \(index): \(measured)%H")
        }
    }
}
