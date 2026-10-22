import SwiftUI

@MainActor @Observable
final class StatusMenuModel {
    private(set) var musicPermission = MusicBridge.permission()
    private(set) var screenRecordingAllowed = ScreenCapture.isAllowed

    init() {
        // Either permission can change in System Settings while Static runs,
        // so both are checked again whenever the menu opens.
        _ = NotificationCenter.default.addObserver(
            forName: NSMenu.didBeginTrackingNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.checkPermissions() }
        }
    }

    private func checkPermissions() {
        let music = MusicBridge.permission()
        if music != musicPermission { musicPermission = music }
        let screen = ScreenCapture.isAllowed
        if screen != screenRecordingAllowed { screenRecordingAllowed = screen }
    }
}

struct StatusMenu: View {
    let model: StatusMenuModel
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        Button("Settings…") {
            openSettings()
            // Static has no Dock icon and isn't the active app, so the window
            // would otherwise open behind the app you're in.
            NSApp.activate()
        }
        .keyboardShortcut(",")

        if model.musicPermission == .denied || !model.screenRecordingAllowed {
            Divider()
        }
        if model.musicPermission == .denied {
            Button("Allow Static to Control Music…") { openPrivacySettings("Privacy_Automation") }
        }
        if !model.screenRecordingAllowed {
            Button("Allow Screen Recording…") {
                ScreenCapture.requestAccess()
                openPrivacySettings("Privacy_ScreenCapture")
            }
            // macOS keeps showing the switch on for an earlier build it no
            // longer recognises, so a switch that's on can still mean no.
            Text("Already on in System Settings? Switch it off and on again.")
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
