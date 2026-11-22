import SwiftUI

/// The wheel over the same screen without and with the cinematic backdrop,
/// which needs Screen Recording. Without the bundle, as in `swift run`, the
/// frames stay empty, so the window keeps its size.
struct BackdropPreview: View {
    typealias Previews = (before: NSImage, after: NSImage)

    /// Rendered by `scripts/make-welcome-previews.sh` and copied into
    /// Contents/Resources by `scripts/bundle.sh`.
    static let bundled: Previews? = NSImage(named: "WelcomeBefore").flatMap { before in
        NSImage(named: "WelcomeAfter").map { (before: before, after: $0) }
    }

    let previews: Previews?

    var body: some View {
        HStack(spacing: 8) {
            frame(previews?.before, label: "Without")
            frame(previews?.after, label: "With")
        }
        .padding(.vertical, 2)
        // The window takes its content's smallest size, and a resizable
        // image's smallest height is zero, so this holds them at full height.
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("The wheel over a light tint without Screen Recording, and over a faded screen with it")
    }

    private func frame(_ image: NSImage?, label: String) -> some View {
        VStack(spacing: 4) {
            Group {
                if let image {
                    Image(nsImage: image).resizable().interpolation(.high)
                } else {
                    Color.clear
                }
            }
            .aspectRatio(1000.0 / 640.0, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(.separator))
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
