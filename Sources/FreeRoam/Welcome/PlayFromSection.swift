import AppKit
import SwiftUI

/// Music and Spotify side by side: the one you play from is picked, and each
/// shows whether Free Roam may control it, whichever is picked.
struct PlayFromSection: View {
    /// Each installed app's own icon, looked up once.
    static let installedIcons: [MusicApp: NSImage] = Dictionary(uniqueKeysWithValues: MusicApp.allCases.compactMap { app in
        NSWorkspace.shared.urlForApplication(withBundleIdentifier: app.bridge.bundleID).map {
            (app, NSWorkspace.shared.icon(forFile: $0.path(percentEncoded: false)))
        }
    })

    let icons: [MusicApp: NSImage]
    let picked: MusicApp
    let statuses: [MusicApp: AppControlStatus]
    let pick: (MusicApp) -> Void
    let allow: (MusicApp) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ForEach(MusicApp.allCases, id: \.self) { app in
                AppCard(
                    app: app,
                    icon: icons[app],
                    status: statuses[app] ?? .notAsked,
                    isPicked: app == picked,
                    // One app is asked at a time.
                    isAskingAnother: statuses.contains { $0.key != app && $0.value == .asking },
                    pick: { pick(app) },
                    allow: { allow(app) }
                )
            }
        }
    }
}

/// One app: click it to play from it. The status line has the button that asks.
private struct AppCard: View {
    let app: MusicApp
    let icon: NSImage?
    let status: AppControlStatus
    let isPicked: Bool
    let isAskingAnother: Bool
    let pick: () -> Void
    let allow: () -> Void

    /// A station can't play in an app that isn't there.
    private var canPick: Bool { status != .notInstalled }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(action: pick) {
                HStack(spacing: 8) {
                    Group {
                        if let icon {
                            Image(nsImage: icon).resizable().interpolation(.high)
                        } else {
                            Image(systemName: "music.note").font(.title2).foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: 28, height: 28)
                    .accessibilityHidden(true)
                    Text(app.name).font(.headline)
                    Spacer(minLength: 0)
                    Image(systemName: isPicked ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(isPicked ? AnyShapeStyle(.tint) : AnyShapeStyle(.tertiary))
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!canPick)
            .accessibilityLabel("Play from \(app.name)")
            .accessibilityAddTraits(isPicked ? .isSelected : [])

            // Three lines for every state, so the cards and the window keep
            // their size.
            Text(note)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(3, reservesSpace: true)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                statusLine
            }
            .frame(height: 24)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            isPicked ? AnyShapeStyle(.tint.opacity(0.08)) : AnyShapeStyle(.quaternary.opacity(0.5)),
            in: RoundedRectangle(cornerRadius: 10)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(isPicked ? AnyShapeStyle(.tint) : AnyShapeStyle(.separator), lineWidth: isPicked ? 2 : 1)
        )
        // Anywhere on the card picks it, as well as its title.
        .contentShape(RoundedRectangle(cornerRadius: 10))
        .onTapGesture { if canPick { pick() } }
    }

    private var note: String {
        switch status {
        case .denied:
            return "macOS remembers a no, so only System Settings can let Free Roam control \(app.name) now."
        case .notInstalled:
            return "Install the \(app == .spotify ? "Spotify desktop app" : "Music app") to play your stations in it."
        case .allowed, .notAsked, .asking:
            return "Plays your playlists in \(app.name) and turns it down while the wheel is open."
        }
    }

    @ViewBuilder private var statusLine: some View {
        switch status {
        case .allowed:
            Label("Allowed", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .notAsked, .asking:
            if status == .asking {
                ProgressView().controlSize(.small)
                Text("Asking…").foregroundStyle(.secondary)
            } else {
                Text("Not yet").foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Button("Allow…", action: allow)
                .disabled(status == .asking || isAskingAnother)
                // Both cards' buttons read "Allow…".
                .accessibilityLabel("Allow Free Roam to control \(app.name)")
        case .denied:
            Text("Turned off").foregroundStyle(.secondary)
            Spacer(minLength: 0)
            Button("Open Settings…", action: allow)
                .accessibilityLabel("Open System Settings to let Free Roam control \(app.name)")
        case .notInstalled:
            Text("Not installed").foregroundStyle(.secondary)
        }
    }
}
