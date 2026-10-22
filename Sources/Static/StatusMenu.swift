import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.static", category: "menu")

@MainActor @Observable
final class StatusMenuModel {
    private(set) var musicPermission = MusicBridge.permission()
    private(set) var screenRecordingAllowed = ScreenCapture.isAllowed
    private(set) var message: String?

    func play(_ playlist: Playlist) async {
        do {
            try await MusicBridge.play(playlistID: playlist.id)
            message = "Playing \(playlist.name)"
        } catch {
            show(error, while: "playing a playlist")
        }
        musicPermission = MusicBridge.permission()
    }

    func captureScreen() async {
        do {
            let image = try await ScreenCapture.captureMainDisplay()
            message = "Captured the screen at \(image.width)×\(image.height)"
            log.notice("\(self.message ?? "", privacy: .public)")
        } catch {
            show(error, while: "capturing the screen")
        }
        screenRecordingAllowed = ScreenCapture.isAllowed
    }

    private func show(_ error: Error, while action: String) {
        message = error.localizedDescription
        log.error("Failed \(action, privacy: .public): \(String(describing: error), privacy: .public)")
    }
}

struct StatusMenu: View {
    let model: StatusMenuModel
    let stations: StationList
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        Menu("Play Playlist") {
            ForEach(stations.library ?? []) { playlist in
                Button(playlist.name) { Task { await model.play(playlist) } }
            }
            if stations.library?.isEmpty == false { Divider() }
            Button("Reload Playlists") { stations.reload() }
        }
        Button("Capture Screen") { Task { await model.captureScreen() } }

        Divider()
        Text("Music: \(model.musicPermission.label)")
        if model.musicPermission == .denied {
            Button("Allow Static to Control Music…") { openPrivacySettings("Privacy_Automation") }
        }
        Text("Screen Recording: \(model.screenRecordingAllowed ? "allowed" : "not allowed")")
        if !model.screenRecordingAllowed {
            Button("Allow Screen Recording…") { openPrivacySettings("Privacy_ScreenCapture") }
            // macOS keeps showing the switch on for an earlier build it no
            // longer recognises, so a switch that's on can still mean no.
            Text("Already on in System Settings? Switch it off and on again.")
        }
        if let message = model.message {
            Text(message)
        }

        Divider()
        Button("Settings…") {
            openSettings()
            // Static has no Dock icon and isn't the active app, so the window
            // would otherwise open behind the app you're in.
            NSApp.activate()
        }
        .keyboardShortcut(",")
        Button("Quit Static") { NSApp.terminate(nil) }
            .keyboardShortcut("q")
    }

    private func openPrivacySettings(_ pane: String) {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)") else { return }
        NSWorkspace.shared.open(url)
    }
}
