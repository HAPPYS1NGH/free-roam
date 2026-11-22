import SwiftUI

/// What the menu and Settings' General tab show about permissions and
/// Launch at Login, so the two always agree.
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

    /// For a switch of app, whose permission is the one the menu shows, and
    /// for Settings, which opening the menu doesn't cover.
    func refreshPermissions() {
        checkPermissions()
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
    let stations: StationList
    let updater: Updater
    let settings: SettingsNavigation
    let selectApp: (MusicApp) -> Void
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        Button("Settings…", action: showSettings)
            .keyboardShortcut(",")
        if updater.isAvailable {
            Button(updater.hasUnseenUpdate ? "Update Available…" : "Check for Updates…") {
                updater.checkForUpdates()
            }
            .disabled(!updater.canCheckForUpdates)
        }

        Divider()
        Picker("Play from", selection: Binding(get: { stations.app }, set: { selectApp($0) })) {
            ForEach(MusicApp.allCases, id: \.self) { app in
                Text(app.name).tag(app)
            }
        }
        .pickerStyle(.inline)

        if model.musicPermission == .denied || !model.screenRecordingAllowed {
            Divider()
        }
        if model.musicPermission == .denied {
            Button("Allow Free Roam to Control \(stations.app.name)…") { PrivacyPane.automation.open() }
        }
        if !model.screenRecordingAllowed {
            // Settings explains what macOS's prompt means before it asks.
            Button("Turn On Cinematic Backdrop…") {
                settings.tab = .general
                showSettings()
            }
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

    private func showSettings() {
        openSettings()
        // Free Roam has no Dock icon and isn't the active app, so the window
        // would otherwise open behind the app you're in.
        NSApp.activate()
    }
}
