import SwiftUI

/// The screen behind the wheel, ported from `.wheel-backdrop` in
/// `site/src/styles.css`: the filtered still, a faint blue wash and a
/// vignette, fading as one layer like CSS opacity. Without Screen Recording
/// permission there's no still, and the wash and vignette show on their own.
struct BackdropView: View {
    let model: RadioWheelModel

    private static let wash = Color(red: 70 / 255, green: 120 / 255, blue: 210 / 255).opacity(0.07)

    var body: some View {
        ZStack {
            if let still = model.still {
                Image(decorative: still, scale: 1)
                    .resizable()
            }
            Self.wash
            Vignette(strength: model.style.behaviour.vignette)
        }
        .compositingGroup()
        .opacity(model.backdropShown ? 1 : 0)
        .ignoresSafeArea()
    }
}

/// `radial-gradient(ellipse farthest-corner, …)` centred on the screen: clear
/// for the first 46% of the way to the corners, then darkening to 70%
/// `rgb(4 8 18)` in them, all scaled by `strength`.
struct Vignette: View {
    /// Where each stop sits on the way from the centre to the corners, and
    /// its opacity at full strength. CSS's `transparent` is the same colour
    /// at no opacity, because CSS blends gradient stops premultiplied.
    private static let stops: [(location: Double, opacity: Double)] = [
        (0.46, 0), (0.6, 0.12), (0.74, 0.29), (0.88, 0.54), (1, 0.7),
    ]
    /// EllipticalGradient stretches a circle to the view's shape and measures
    /// radii as fractions of its size, so 0.5 reaches the middle of each edge.
    /// CSS's farthest-corner ellipse has the same shape, grown until it
    /// passes through the corners, √2 times further out.
    private static let cornerRadiusFraction = 2.0.squareRoot() / 2

    private static let color = Color(red: 4 / 255, green: 8 / 255, blue: 18 / 255)

    let strength: Double

    var body: some View {
        EllipticalGradient(
            stops: Self.stops.map { Gradient.Stop(color: Self.color.opacity($0.opacity * strength), location: $0.location) },
            startRadiusFraction: 0,
            endRadiusFraction: Self.cornerRadiusFraction
        )
    }
}
