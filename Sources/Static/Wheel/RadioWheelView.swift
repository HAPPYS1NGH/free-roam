import CoreText
import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.static", category: "wheel")

/// The ring of stations and the caption, filling the overlay panel. Every
/// station is its logo on a black disc: idle ones are greyscale ghosts, and
/// the highlighted one is opaque and in colour, with the accent ring outside
/// its disc. Only opening and closing animate. The highlight jumps, as in
/// GTA, because a scroll sweeps up to 30 stations a second. Ported from
/// `prototype/src/RadioWheel.tsx` and `radio-wheel.css`.
struct RadioWheelView: View {
    let model: RadioWheelModel

    var body: some View {
        GeometryReader { proxy in
            let style = model.style
            let sizes = style.sizes
            let unit = proxy.size.height / 100
            let count = model.slotCount
            let ring = WheelGeometry.ring(sizes, count: count, screenHeight: proxy.size.height)
            let centre = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2 - (sizes.raise * unit).rounded())
            let ringWidth = (sizes.ringWidth * unit).rounded()
            ZStack {
                ForEach(0..<count, id: \.self) { slot in
                    let angle = WheelGeometry.slotAngle(slot, count: count)
                    let selected = slot == model.highlighted
                    let size = selected ? ring.selectedIcon : ring.icon
                    StationDisc(
                        art: art(for: slot),
                        size: size,
                        rim: (size * sizes.rim).rounded(),
                        ringWidth: selected ? ringWidth : 0,
                        ringColor: Color(hex: style.colors.ringColor) ?? .white,
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
                        fontSize: max(13, sizes.captionSize * unit),
                        pitch: sizes.captionPitch * unit,
                        maxWidth: (ring.radius - ring.icon / 2) * 1.8,
                        // The first line sits above the ring's centre and the
                        // rest hang below it, so "Radio Off" stays in place.
                        firstLine: CGPoint(x: centre.x, y: centre.y - sizes.captionRaise * unit)
                    )
                }
            }
            .opacity(model.presence == .shown ? 1 : 0)
            .scaleEffect(
                model.presence == .hidden ? sizes.openScale : 1,
                anchor: UnitPoint(x: centre.x / proxy.size.width, y: centre.y / proxy.size.height)
            )
        }
        .ignoresSafeArea()
    }

    private func art(for slot: Int) -> StationDisc.Art {
        guard slot > 0 else { return .radioOff }
        let station = model.stations[slot - 1]
        if let logo = model.details.logos[station.id] { return .logo(logo) }
        return .initials(Self.initials(of: station.name))
    }

    private func caption(at date: Date) -> CaptionLines {
        let station = model.highlighted == 0 ? nil : model.stations[model.highlighted - 1]
        return CaptionLines(station: station, tracks: station.flatMap { model.details.tracks[$0.id] }, at: date)
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

/// Station, ARTIST, title of the track on air.
struct CaptionLines: Equatable {
    let station: String
    let artist: String
    let title: String

    /// Nil is Radio Off. A station whose tracks haven't loaded yet shows its
    /// name alone.
    init(station: Playlist?, tracks: [Track]?, at date: Date) {
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
        let onAir = Broadcast.onAir(durations: tracks.map(\.duration), at: date)
        artist = onAir.map { tracks[$0.index].artist } ?? ""
        title = onAir.map { tracks[$0.index].title } ?? "No songs"
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

private struct StationDisc: View {
    enum Art {
        case radioOff
        case logo(CGImage)
        case initials(String)
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

/// The "no entry" mark of GTA's Radio Off slot, from `prototype/src/icons.tsx`:
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
    let fontSize: Double
    let pitch: Double
    let maxWidth: Double
    let firstLine: CGPoint

    var body: some View {
        let shown = [(lines.station, false), (lines.artist, true), (lines.title, false)].filter { !$0.0.isEmpty }
        ForEach(shown.indices, id: \.self) { index in
            let (text, isArtist) = shown[index]
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
                .frame(maxWidth: maxWidth)
                .position(x: firstLine.x, y: firstLine.y + Double(index) * pitch)
        }
    }
}

private extension Color {
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
