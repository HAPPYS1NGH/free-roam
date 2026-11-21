import SwiftUI

/// The welcome window's content, following the model.
struct WelcomeView: View {
    let model: WelcomeModel
    let dontShowAgain: () -> Void
    let close: () -> Void

    var body: some View {
        WelcomeContent(
            musicAllowed: model.musicAllowed,
            screenRecordingAllowed: model.screenRecordingAllowed,
            isAskingForMusic: model.isAskingForMusic,
            allowMusic: model.allowMusic,
            allowScreenRecording: model.allowScreenRecording,
            launchesAtLogin: model.launchesAtLogin,
            setLaunchesAtLogin: model.setLaunchesAtLogin,
            dontShowAgain: dontShowAgain,
            close: close
        )
    }
}

/// The welcome window drawn from plain values, so a test can render each state.
struct WelcomeContent: View {
    nonisolated static let width = 480.0
    /// From Contents/Resources, which scripts/bundle.sh copies in. Without
    /// the bundle, as in `swift run`, the badge's space stays empty, so the
    /// window keeps its size.
    static let bundledBadge = NSImage(named: "FreeRoamBadge")
    /// The wheel over the same screen without and with Screen Recording,
    /// rendered by `scripts/make-welcome-previews.sh`.
    static let bundledPreviews = NSImage(named: "WelcomeBefore").flatMap { before in
        NSImage(named: "WelcomeAfter").map { (before: before, after: $0) }
    }

    var badge = WelcomeContent.bundledBadge
    var previews = WelcomeContent.bundledPreviews
    let musicAllowed: Bool
    let screenRecordingAllowed: Bool
    var isAskingForMusic = false
    var allowMusic: () -> Void = {}
    var allowScreenRecording: () -> Void = {}
    var launchesAtLogin = false
    var setLaunchesAtLogin: (Bool) -> Void = { _ in }
    var dontShowAgain: () -> Void = {}
    var close: () -> Void = {}

    var body: some View {
        // 16 rather than 20 keeps the window under 700 pt with the previews.
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Group {
                    if let badge {
                        Image(nsImage: badge).resizable().interpolation(.high)
                    } else {
                        Color.clear
                    }
                }
                .frame(width: 56, height: 56)
                .padding(.bottom, 8)
                .accessibilityHidden(true)
                Text("Welcome to Free Roam")
                    .font(.title2.weight(.semibold))
                Text("Hold ⌥Q anywhere to open the radio wheel. Move the mouse towards a station and let go to tune in.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: 0) {
                PermissionRow(
                    symbol: "music.note",
                    name: "Control Music",
                    details: ["Free Roam plays your playlists in the Music app and turns Music down while the wheel is open."],
                    isAllowed: musicAllowed,
                    isAsking: isAskingForMusic,
                    allow: allowMusic
                )
                Divider().padding(.leading, 52)
                PermissionRow(
                    symbol: "display",
                    name: "Screen Recording",
                    isOptional: true,
                    details: [
                        "Fades the screen behind the wheel so your stations stand out.",
                        // Captures happen as ⌥Q goes down, and once per display at
                        // launch or when it's connected to warm up. All stay in memory.
                        """
                        macOS will say Free Roam can record your screen. It only takes a still as you hold ⌥Q, \
                        and never saves or sends it.
                        """,
                    ],
                    preview: AnyView(ScreenRecordingPreview(previews: previews)),
                    isAllowed: screenRecordingAllowed,
                    allow: allowScreenRecording
                )
            }
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 8) {
                // Off until you tick it: a login item needs your say-so.
                Toggle("Open Free Roam when you log in", isOn: Binding(
                    get: { launchesAtLogin },
                    set: { setLaunchesAtLogin($0) }
                ))
                .toggleStyle(.checkbox)
                Text("You can change these later in System Settings or the Free Roam menu.")
                    .foregroundStyle(.secondary)
            }

            HStack {
                Button("Don't Show This Again", action: dontShowAgain)
                Spacer()
                Button("Close", action: close)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(24)
        .frame(width: Self.width)
    }
}

/// One permission: what it's for, whether it's allowed, and a button to allow it.
private struct PermissionRow: View {
    let symbol: String
    let name: String
    var isOptional = false
    let details: [String]
    /// Between the first line of details and the rest.
    var preview: AnyView?
    let isAllowed: Bool
    var isAsking = false
    let allow: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(.secondary)
                .frame(width: 28, height: Self.titleHeight)
            VStack(alignment: .leading, spacing: 6) {
                // The status shares the title's line, so the text below keeps
                // its width, and the window its size, whatever the state.
                HStack(spacing: 10) {
                    Text(isOptional ? "\(name) (optional)" : name).font(.headline)
                    Spacer(minLength: 0)
                    if isAllowed {
                        Label("Allowed", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    } else {
                        Text("Not yet").foregroundStyle(.secondary)
                        Button("Allow…", action: allow)
                            .disabled(isAsking)
                            // Both rows' buttons read "Allow…".
                            .accessibilityLabel("Allow \(name)")
                    }
                }
                .frame(height: Self.titleHeight)
                ForEach(details, id: \.self) { detail in
                    if detail == details.dropFirst().first, let preview { preview }
                    Text(detail)
                        .font(detail == details.first ? .body : .callout)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(12)
    }

    /// Tall enough for the Allow button.
    private nonisolated static let titleHeight = 24.0
}

/// The wheel over the same screen without and with Screen Recording. Without
/// the bundle, as in `swift run`, the frames stay empty, so the window keeps
/// its size.
private struct ScreenRecordingPreview: View {
    let previews: (before: NSImage, after: NSImage)?

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
