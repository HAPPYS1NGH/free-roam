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
            dontShowAgain: dontShowAgain,
            close: close
        )
    }
}

/// The welcome window drawn from plain values, so a test can render each state.
struct WelcomeContent: View {
    nonisolated static let width = 480.0

    let musicAllowed: Bool
    let screenRecordingAllowed: Bool
    var isAskingForMusic = false
    var allowMusic: () -> Void = {}
    var allowScreenRecording: () -> Void = {}
    var dontShowAgain: () -> Void = {}
    var close: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Welcome to Free Roam")
                    .font(.title2.weight(.semibold))
                Text("Hold ⌥Q anywhere to open the radio wheel. Move the mouse towards a station and let go to tune in.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            VStack(spacing: 0) {
                PermissionRow(
                    symbol: "music.note",
                    title: "Control Music",
                    details: ["Free Roam plays your playlists in the Music app and turns Music down while the wheel is open."],
                    isAllowed: musicAllowed,
                    isAsking: isAskingForMusic,
                    allow: allowMusic
                )
                Divider().padding(.leading, 52)
                PermissionRow(
                    symbol: "display",
                    title: "Screen Recording (optional)",
                    details: [
                        """
                        Fades the colour from the screen behind the wheel so your stations stand out. \
                        Without it, the wheel still works with a light tint.
                        """,
                        // Captures happen as ⌥Q goes down, and once per display at
                        // launch or when it's connected to warm up. All stay in memory.
                        "Free Roam only uses the screen to draw the wheel's background. It never saves or sends what it sees.",
                        "macOS may ask you to reopen Free Roam after you allow it.",
                    ],
                    isAllowed: screenRecordingAllowed,
                    allow: allowScreenRecording
                )
            }
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))

            Text("You can change these later in System Settings.")
                .foregroundStyle(.secondary)

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
    let title: String
    let details: [String]
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
                    Text(title).font(.headline)
                    Spacer(minLength: 0)
                    if isAllowed {
                        Label("Allowed", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    } else {
                        Text("Not yet").foregroundStyle(.secondary)
                        Button("Allow…", action: allow)
                            .disabled(isAsking)
                    }
                }
                .frame(height: Self.titleHeight)
                ForEach(details, id: \.self) { detail in
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
