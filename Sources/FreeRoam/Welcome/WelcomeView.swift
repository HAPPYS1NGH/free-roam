import SwiftUI

/// The welcome window's content, following the model.
struct WelcomeView: View {
    let model: WelcomeModel
    let dontShowAgain: () -> Void
    let close: () -> Void

    var body: some View {
        WelcomeContent(
            picked: model.picked,
            statuses: model.statuses,
            backdropOn: model.backdropOn,
            pick: model.pick,
            allow: model.allow,
            turnOnBackdrop: model.turnOnBackdrop,
            launchesAtLogin: model.launchesAtLogin,
            setLaunchesAtLogin: model.setLaunchesAtLogin,
            dontShowAgain: dontShowAgain,
            close: close
        )
        // Also when Settings or the menu picks the app.
        .onChange(of: model.picked) { model.refresh() }
    }
}

/// The welcome window drawn from plain values, so a test can render each state.
struct WelcomeContent: View {
    nonisolated static let width = 520.0
    /// From Contents/Resources, which scripts/bundle.sh copies in. Without
    /// the bundle, as in `swift run`, the badge's space stays empty, so the
    /// window keeps its size.
    static let bundledBadge = NSImage(named: "FreeRoamBadge")

    var badge = WelcomeContent.bundledBadge
    var previews = BackdropPreview.bundled
    var icons = PlayFromSection.installedIcons
    let picked: MusicApp
    let statuses: [MusicApp: AppControlStatus]
    let backdropOn: Bool
    var pick: (MusicApp) -> Void = { _ in }
    var allow: (MusicApp) -> Void = { _ in }
    var turnOnBackdrop: () -> Void = {}
    var launchesAtLogin = false
    var setLaunchesAtLogin: (Bool) -> Void = { _ in }
    var dontShowAgain: () -> Void = {}
    var close: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 14) {
                Group {
                    if let badge {
                        Image(nsImage: badge).resizable().interpolation(.high)
                    } else {
                        Color.clear
                    }
                }
                .frame(width: 48, height: 48)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Welcome to Free Roam")
                        .font(.title2.weight(.semibold))
                    Text("Your Music or Spotify playlists on a radio wheel.")
                        .foregroundStyle(.secondary)
                }
            }

            WelcomeSection(number: 1, title: "Play from") {
                PlayFromSection(icons: icons, picked: picked, statuses: statuses, pick: pick, allow: allow)
            }

            WelcomeSection(number: 2, title: "Cinematic backdrop (optional)") {
                if backdropOn {
                    Label("On", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Button("Turn On…", action: turnOnBackdrop)
                        .accessibilityLabel("Turn on the cinematic backdrop")
                }
            } content: {
                Text("Fades the screen behind the wheel so your stations stand out.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                // The previews' own width at 2×, so they're never scaled up.
                BackdropPreview(previews: previews)
                    .frame(maxWidth: 408)
                // Captures happen as ⌥Q goes down, and once per display at
                // launch or when it's connected to warm up. All stay in memory.
                Text("""
                    It needs Screen Recording, so macOS will say Free Roam can record your screen. \
                    It only takes a still as you hold ⌥Q, and never saves or sends it.
                    """)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            WelcomeSection(number: 3, title: "Try it") {
                // Off until you tick it: a login item needs your say-so.
                Toggle("Open Free Roam when you log in", isOn: Binding(
                    get: { launchesAtLogin },
                    set: { setLaunchesAtLogin($0) }
                ))
                .toggleStyle(.checkbox)
            } content: {
                Text("Hold ⌥Q anywhere to open the radio wheel. Move the mouse towards a station and let go to tune in.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
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

/// A numbered part of the window, with an optional control on the title's line.
private struct WelcomeSection<Accessory: View, Content: View>: View {
    let number: Int
    let title: String
    let accessory: Accessory
    let content: Content

    init(number: Int, title: String, @ViewBuilder accessory: () -> Accessory, @ViewBuilder content: () -> Content) {
        self.number = number
        self.title = title
        self.accessory = accessory()
        self.content = content()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(number)")
                .font(.callout.weight(.semibold).monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 20, height: 20)
                .background(.quaternary, in: Circle())
                .frame(height: Self.titleHeight)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 8) {
                // The control shares the title's line, so the text below keeps
                // its width, and the window its size, whatever the state.
                HStack(spacing: 10) {
                    Text(title).font(.headline)
                    Spacer(minLength: 0)
                    accessory
                }
                .frame(height: Self.titleHeight)
                content
            }
        }
    }

    /// Tall enough for a button.
    private nonisolated static var titleHeight: Double { 24 }
}

extension WelcomeSection where Accessory == EmptyView {
    init(number: Int, title: String, @ViewBuilder content: () -> Content) {
        self.init(number: number, title: title, accessory: { EmptyView() }, content: content)
    }
}
