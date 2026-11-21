import CoreText
import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "wheel")

/// The ring of stations and the caption, filling the overlay panel. Every
/// station is its logo on a black disc: idle ones are greyscale ghosts, and
/// the highlighted one is opaque and in colour, with the accent ring outside
/// its disc. Only opening and closing animate. The highlight jumps, as in
/// GTA, because a scroll sweeps up to 30 stations a second. Ported from
/// `site/src/RadioWheel.tsx` and `radio-wheel.css`.
struct RadioWheelView: View {
    let model: RadioWheelModel

    var body: some View {
        RadioWheelContent(
            style: model.style,
            stations: model.stations,
            highlighted: model.highlighted,
            presence: model.presence,
            logos: model.details.logos,
            tracks: model.details.tracks,
            nowPlaying: model.nowPlaying
        )
    }

    /// For stations with no artwork: "Gym Bangers" is GB, "☕ Sunday Coffee"
    /// is SC and "Hype" is H.
    nonisolated static func initials(of name: String) -> String {
        let letters = name.split(whereSeparator: \.isWhitespace).compactMap { word in
            word.first { $0.isLetter || $0.isNumber }
        }
        return String(letters.prefix(2)).uppercased()
    }
}

/// What `RadioWheelView` draws, from plain values, so tests can render it.
struct RadioWheelContent: View {
    let style: WheelStyle
    /// Slot 0 is Radio Off, so station `i` is in slot `i + 1`.
    let stations: [Playlist]
    let highlighted: Int
    let presence: RadioWheelModel.Presence
    let logos: [String: CGImage]
    let tracks: [String: [Track]]
    var nowPlaying: NowPlaying?

    var body: some View {
        GeometryReader { proxy in
            let sizes = style.sizes
            let unit = proxy.size.height / 100
            let count = stations.count + 1
            let ring = WheelGeometry.ring(sizes, count: count, screenHeight: proxy.size.height)
            let centre = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2 - (sizes.raise * unit).rounded())
            let ringWidth = (sizes.ringWidth * unit).rounded()
            ZStack {
                ForEach(0..<count, id: \.self) { slot in
                    let angle = WheelGeometry.slotAngle(slot, count: count)
                    let selected = slot == highlighted
                    let size = selected ? ring.selectedIcon : ring.icon
                    StationDisc(
                        art: art(for: slot),
                        size: size,
                        rim: (size * (selected ? sizes.selectedRim : sizes.rim)).rounded(),
                        ringWidth: selected ? ringWidth : 0,
                        ringColor: RingColor.resolve(brand: style.colors.ringColor),
                        inColour: selected && style.flags.selectedInColour,
                        opacity: selected ? 1 : sizes.idleOpacity
                    )
                    .position(
                        x: (centre.x + ring.radius * sin(angle)).rounded(),
                        y: (centre.y - ring.radius * cos(angle)).rounded()
                    )
                    // The ring overlaps the neighbours a little, as in GTA.
                    .zIndex(selected ? 1 : 0)
                }
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    CaptionView(
                        lines: caption(at: context.date),
                        sizes: sizes,
                        ring: ring,
                        centre: centre,
                        screenHeight: proxy.size.height
                    )
                }
            }
            .opacity(presence == .shown ? 1 : 0)
            .scaleEffect(
                presence == .hidden ? sizes.openScale : 1,
                anchor: UnitPoint(x: centre.x / proxy.size.width, y: centre.y / proxy.size.height)
            )
        }
        .ignoresSafeArea()
    }

    private func art(for slot: Int) -> StationDisc.Art {
        slot > 0 ? .station(stations[slot - 1], logos: logos) : .radioOff
    }

    private func caption(at date: Date) -> CaptionLines {
        let station = highlighted == 0 ? nil : stations[highlighted - 1]
        return CaptionLines(station: station, tracks: station.flatMap { tracks[$0.id] }, nowPlaying: nowPlaying, at: date)
    }
}

/// Station, ARTIST, title of the track on air.
struct CaptionLines: Equatable {
    let station: String
    let artist: String
    let title: String

    /// Nil is Radio Off. A station whose tracks haven't loaded yet shows its
    /// name alone. The station Music is playing shows the track Music said
    /// at the press, which a pause or a skip in Music can move off the
    /// clock. Every other station shows the track on its clock.
    init(station: Playlist?, tracks: [Track]?, nowPlaying: NowPlaying? = nil, at date: Date) {
        guard let station else {
            self.station = "Radio Off"
            artist = ""
            title = ""
            return
        }
        self.station = station.name
        guard let tracks else {
            artist = ""
            title = ""
            return
        }
        // A track count that differs from the tracks loaded is an edited
        // playlist, whose track numbers may have moved.
        let musicIndex = nowPlaying.flatMap { playing in
            playing.playlistID == station.id && playing.trackCount == tracks.count
                && tracks.indices.contains(playing.trackIndex) ? playing.trackIndex : nil
        }
        guard let index = musicIndex ?? Broadcast.onAir(durations: tracks.map(\.duration), at: date)?.index else {
            artist = ""
            title = "No songs"
            return
        }
        artist = tracks[index].artist
        title = tracks[index].title
    }
}

enum CaptionFont {
    static let name = "SofiaSansExtraCondensed-SemiBold"

    /// Registers the bundled font for this process. Without it the caption
    /// falls back to the system font.
    static func register() {
        guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
            log.error("\(name, privacy: .public).ttf isn't in the app, so the caption uses the system font")
            return
        }
        var error: Unmanaged<CFError>?
        guard CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) else {
            let reason = error.map { String(describing: $0.takeRetainedValue()) } ?? "unknown error"
            log.error("Couldn't register \(name, privacy: .public): \(reason, privacy: .public)")
            return
        }
    }
}

/// A logo on its black disc, as the wheel and Settings draw it.
struct StationDisc: View {
    enum Art {
        case radioOff
        case logo(CGImage)
        case initials(String)

        /// The station's logo, or its initials until it has one.
        static func station(_ station: Playlist, logos: [String: CGImage]) -> Art {
            logos[station.id].map(Art.logo) ?? .initials(RadioWheelView.initials(of: station.name))
        }
    }

    let art: Art
    let size: Double
    /// Black rim round the art on each side, in points.
    let rim: Double
    let ringWidth: Double
    let ringColor: Color
    let inColour: Bool
    let opacity: Double

    var body: some View {
        let artSize = size - 2 * rim
        artView(artSize)
            .frame(width: artSize, height: artSize)
            .clipShape(Circle())
            .grayscale(inColour ? 0 : 1)
            .frame(width: size, height: size)
            .background(Circle().fill(.black))
            .padding(ringWidth)
            .overlay {
                if ringWidth > 0 { Circle().strokeBorder(ringColor, lineWidth: ringWidth) }
            }
            .background {
                // A 1.5 pt dark edge outside the ring.
                if ringWidth > 0 { Circle().fill(.black.opacity(0.6)).padding(-1.5) }
            }
            // As one layer, so the black disc doesn't show through the art.
            // Idle discs read as dark see-through circles.
            .compositingGroup()
            .opacity(opacity)
    }

    @ViewBuilder
    private func artView(_ artSize: Double) -> some View {
        switch art {
        case .radioOff:
            // GTA's glyph is as big as a logo, so it fills the art circle.
            RadioOffGlyph()
                .stroke(.white, style: StrokeStyle(lineWidth: artSize * RadioOffGlyph.stroke, lineCap: .butt))
        case .logo(let image):
            Image(decorative: image, scale: 1)
                .resizable()
                .interpolation(.high)
        case .initials(let initials):
            Text(initials)
                .font(.system(size: artSize * 0.3, weight: .bold))
                .foregroundStyle(.white)
        }
    }
}

/// The "no entry" mark of GTA's Radio Off slot, from `site/src/icons.tsx`:
/// a ring whose stroke is about 5% of its width and a slash that ends square
/// on the ring's centre line, so its corners hide inside the ring.
private struct RadioOffGlyph: Shape {
    /// Stroke width as a fraction of the glyph.
    static let stroke = 1.25 / 24

    func path(in rect: CGRect) -> Path {
        var path = Path(ellipseIn: CGRect(x: 0.75, y: 0.75, width: 22.5, height: 22.5))
        path.move(to: CGPoint(x: 4.05, y: 4.05))
        path.addLine(to: CGPoint(x: 19.95, y: 19.95))
        return path.applying(CGAffineTransform(scaleX: rect.width / 24, y: rect.height / 24))
    }
}

/// White text with a thin dark edge, like GTA's HUD text: three stacked
/// 1.5 px blurs add up to a crisp hairline, and a soft 4 px halo keeps it
/// readable on white windows. SwiftUI's shadow radius is half a CSS blur.
private struct CaptionView: View {
    let lines: CaptionLines
    let sizes: WheelStyle.Sizes
    let ring: WheelGeometry.Ring
    let centre: CGPoint
    let screenHeight: Double

    var body: some View {
        let unit = screenHeight / 100
        let pitch = sizes.captionPitch * unit
        // The station line is the largest, with the same leading as the others.
        let stationPitch = sizes.stationSize / sizes.captionSize * pitch
        let shown = [
            (text: lines.station, size: sizes.stationSize, height: stationPitch, isArtist: false),
            (text: lines.artist, size: sizes.captionSize, height: pitch, isArtist: true),
            (text: lines.title, size: sizes.captionSize, height: pitch, isArtist: false),
        ].filter { !$0.text.isEmpty }
        let layout = WheelGeometry.captionLines(
            heights: shown.map(\.height), ring: ring, sizes: sizes, screenHeight: screenHeight
        )
        // One ZStack, so every line is positioned in the whole wheel. Left
        // loose in the TimelineView the caption once had, the lines were
        // stacked like a VStack, each in a third of the screen, which put the
        // artist at the bottom of the ring and the title off-screen.
        ZStack {
            ForEach(shown.indices, id: \.self) { index in
                let (text, size, _, isArtist) = shown[index]
                let fontSize = max(13, size * unit)
                // Condensed capitals crowd each other, so the artist gets a
                // little tracking.
                Text(isArtist ? text.uppercased() : text)
                    .font(.custom(CaptionFont.name, fixedSize: fontSize))
                    .tracking(isArtist ? fontSize * 0.02 : 0)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .shadow(color: .black, radius: 0.75)
                    .shadow(color: .black, radius: 0.75)
                    .shadow(color: .black, radius: 0.75)
                    .shadow(color: .black.opacity(0.45), radius: 2)
                    // Long lines stop short of the logos instead of running under them.
                    .padding(.horizontal, 4)
                    .frame(maxWidth: layout[index].maxWidth)
                    .position(x: centre.x, y: centre.y + layout[index].y)
            }
        }
    }
}

extension Color {
    /// `#RRGGBB`, as `tokens.json` stores colours.
    init?(hex: String) {
        guard hex.hasPrefix("#"), hex.count == 7, let rgb = UInt32(hex.dropFirst(), radix: 16) else { return nil }
        self.init(
            red: Double(rgb >> 16 & 0xFF) / 255,
            green: Double(rgb >> 8 & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
