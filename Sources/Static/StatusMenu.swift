import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.static", category: "menu")

@MainActor @Observable
final class StatusMenuModel {
    private(set) var playlists: [Playlist] = []
    private(set) var musicPermission = MusicBridge.permission()
    private(set) var screenRecordingAllowed = ScreenCapture.isAllowed
    private(set) var message: String?
    /// Called with every list that loads.
    @ObservationIgnored var onPlaylistsLoaded: ([Playlist]) -> Void = { _ in }

    init() {
        // Listing playlists would launch Music, so wait until it's open or
        // asked for. The check waits for launch to finish, because the list of
        // running apps can be empty before then.
        Task {
            if MusicBridge.isRunning { await loadPlaylists() }
        }
    }

    func loadPlaylists() async {
        do {
            playlists = try await MusicBridge.playlists()
            message = nil
            log.notice("Loaded \(self.playlists.count) playlists")
            onPlaylistsLoaded(playlists)
        } catch {
            show(error, while: "loading playlists")
        }
        musicPermission = MusicBridge.permission()
    }

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

    var body: some View {
        Menu("Play Playlist") {
            ForEach(model.playlists) { playlist in
                Button(playlist.name) { Task { await model.play(playlist) } }
            }
            if !model.playlists.isEmpty { Divider() }
            Button("Reload Playlists") { Task { await model.loadPlaylists() } }
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
        Button("Quit Static") { NSApp.terminate(nil) }
            .keyboardShortcut("q")
    }

    private func openPrivacySettings(_ pane: String) {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)") else { return }
        NSWorkspace.shared.open(url)
    }
}
