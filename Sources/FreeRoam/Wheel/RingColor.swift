import AppKit
import SwiftUI

/// The selected station's ring, and Settings' highlights, follow the accent
/// colour chosen in System Settings → Appearance. Multicolor, macOS's
/// default, has no colour of its own (apps get system blue), so it keeps
/// Free Roam's blue from `tokens.json`.
enum RingColor {
    static func resolve(brand hex: String?, defaults: UserDefaults = .standard) -> Color {
        let accent = Color(nsColor: .controlAccentColor)
        guard !followsSystemAccent(defaults) else { return accent }
        return hex.flatMap(Color.init(hex:)) ?? accent
    }

    /// macOS writes `AppleAccentColor` to the global domain for every accent
    /// but Multicolor, which removes it.
    static func followsSystemAccent(_ defaults: UserDefaults) -> Bool {
        defaults.object(forKey: "AppleAccentColor") != nil
    }
}
