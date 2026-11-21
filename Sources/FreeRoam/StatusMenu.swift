import SwiftUI

@MainActor @Observable
final class StatusMenuModel {
    private(set) var musicPermission = MusicApp.bridge.permission()
    private(set) var screenRecordingAllowed = ScreenCapture.isAllowed
    private(set) var launchesAtLogin = LaunchAtLogin.isEnabled

    init() {
        // Either permission can change in System Settings while Free Roam runs,
        // so both are checked again whenever the menu opens.
        _ = NotificationCenter.default.addObserver(
            forName: NSMenu.didBeginTrackingNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.checkPermissions() }
        }
    }

    private func checkPermissions() {
        let music = MusicApp.bridge.permission()
        if music != musicPermission { musicPermission = music }
        let screen = ScreenCapture.isAllowed
        if screen != screenRecordingAllowed { screenRecordingAllowed = screen }
        let login = LaunchAtLogin.isEnabled
        if login != launchesAtLogin { launchesAtLogin = login }
    }

    func setLaunchesAtLogin(_ enabled: Bool) {
        launchesAtLogin = LaunchAtLogin.set(enabled)
    }
}

struct StatusMenu: View {
    let model: StatusMenuModel
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        Button("Settings…") {
            openSettings()
            // Free Roam has no Dock icon and isn't the active app, so the window
            // would otherwise open behind the app you're in.
            NSApp.activate()
        }
        .keyboardShortcut(",")

        if model.musicPermission == .denied || !model.screenRecordingAllowed {
            Divider()
        }
        if model.musicPermission == .denied {
            Button("Allow Free Roam to Control Music…") { PrivacyPane.automation.open() }
        }
        if !model.screenRecordingAllowed {
            Button("Allow Screen Recording…") {
                ScreenCapture.requestAccess()
                PrivacyPane.screenRecording.open()
            }
            // macOS keeps showing the switch on for an earlier build it no
            // longer recognises, so a switch that's on can still mean no.
            Text("Already on in System Settings? Switch it off and on again.")
        }

        Divider()
        Toggle("Launch at Login", isOn: Binding(
            get: { model.launchesAtLogin },
            set: { model.setLaunchesAtLogin($0) }
        ))

        Divider()
        Button("Quit Free Roam") { NSApp.terminate(nil) }
            .keyboardShortcut("q")
    }
}
