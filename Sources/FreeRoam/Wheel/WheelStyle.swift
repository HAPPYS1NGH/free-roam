import Foundation

/// The wheel's numbers, exported from the website's tuning panel as
/// `site/tokens.json`. Sizes are percentages of screen height (%H), the
/// way GTA scales its HUD. Field names match the JSON.
struct WheelStyle: Decodable, Sendable {
    struct Easing: Decodable, Sendable {
        /// Seconds.
        let duration: Double
        /// Cubic Bézier control points x1, y1, x2, y2.
        let bezier: [Double]
    }

    struct Animations: Decodable, Sendable {
        let open: Easing
        let close: Easing
        let filterIn: Easing
        let filterOut: Easing
    }

    struct Sizes: Decodable, Sendable {
        let openScale: Double
        let iconSize: Double
        let maxIconSize: Double
        let iconPitch: Double
        let minRadius: Double
        let maxRadius: Double
        let raise: Double
        /// Black rim round the art on each side, as a fraction of the disc.
        let rim: Double
        /// The same for the selected disc.
        let selectedRim: Double
        let ringWidth: Double
        let selectedScale: Double
        let idleOpacity: Double
        /// The artist and title lines.
        let captionSize: Double
        /// The station line, the caption's largest.
        let stationSize: Double
        let captionPitch: Double
        let captionRaise: Double
    }

    struct Colors: Decodable, Sendable {
        /// `#RRGGBB`.
        let ringColor: String
    }

    struct Flags: Decodable, Sendable {
        let selectedInColour: Bool
    }

    struct Behaviour: Decodable, Sendable {
        let holdDelayMs: Double
        /// %H.
        let deadzone: Double
        /// Points of mouse travel.
        let pickRadius: Double
        /// Points of scrolling per station.
        let scrollStep: Double
        let dwellMs: Double
        let backdropSaturation: Double
        let backdropBrightness: Double
        let vignette: Double
        /// Music's volume while the wheel is open, as a fraction of the volume before.
        let duckVolume: Double
        let retuneVolumeDb: Double
        let uiVolumeDb: Double
        let hoverVolumeDb: Double
    }

    let animations: Animations
    let sizes: Sizes
    let colors: Colors
    let flags: Flags
    let behaviour: Behaviour

    static func load(from url: URL) throws -> WheelStyle {
        try JSONDecoder().decode(WheelStyle.self, from: Data(contentsOf: url))
    }

    /// The copy of `tokens.json` that scripts/bundle.sh puts in Free Roam.app.
    static func bundled() throws -> WheelStyle {
        guard let url = Bundle.main.url(forResource: "tokens", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile, userInfo: [NSFilePathErrorKey: "Contents/Resources/tokens.json"])
        }
        return try load(from: url)
    }
}
