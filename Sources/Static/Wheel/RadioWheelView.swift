import SwiftUI

/// The ring of stations, filling the overlay panel. So far each station is a
/// plain disc with a grey circle where the art goes: idle ones are ghosted and
/// the highlighted one gets the coloured ring outside its disc.
struct RadioWheelView: View {
    let model: RadioWheelModel

    var body: some View {
        GeometryReader { proxy in
            let sizes = model.style.sizes
            let unit = proxy.size.height / 100
            let count = model.slotCount
            let ring = WheelGeometry.ring(sizes, count: count, screenHeight: proxy.size.height)
            let centreX = proxy.size.width / 2
            let centreY = proxy.size.height / 2 - (sizes.raise * unit).rounded()
            ForEach(0..<count, id: \.self) { slot in
                let angle = WheelGeometry.slotAngle(slot, count: count)
                let selected = slot == model.highlighted
                Disc(
                    size: selected ? ring.selectedIcon : ring.icon,
                    rim: sizes.rim,
                    ringWidth: selected ? sizes.ringWidth * unit : 0,
                    ringColor: Color(hex: model.style.colors.ringColor) ?? .white
                )
                .opacity(selected ? 1 : sizes.idleOpacity)
                .position(
                    x: (centreX + ring.radius * sin(angle)).rounded(),
                    y: (centreY - ring.radius * cos(angle)).rounded()
                )
            }
        }
        .ignoresSafeArea()
    }
}

private struct Disc: View {
    let size: Double
    /// Black rim round the art on each side, as a fraction of the disc.
    let rim: Double
    let ringWidth: Double
    let ringColor: Color

    var body: some View {
        Circle()
            .fill(.black)
            .overlay { Circle().fill(Color(white: 0.5)).padding(size * rim) }
            .frame(width: size, height: size)
            .padding(ringWidth)
            .overlay {
                if ringWidth > 0 { Circle().strokeBorder(ringColor, lineWidth: ringWidth) }
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
