import AppKit
import SwiftUI

/// Settings' General tab, following the menu's model and the updater, so
/// both always agree. Screen Recording and Launch at Login can change in
/// System Settings while Free Roam runs, so they're checked again when the
/// tab shows and when you come back to Free Roam.
struct GeneralSettingsView: View {
    let status: StatusMenuModel
    let updater: Updater

    var body: some View {
        GeneralSettingsContent(
            backdropOn: status.screenRecordingAllowed,
            turnOnBackdrop: {
                // macOS's prompt and System Settings open over the app you were
                // in, and this window stays put beside them to explain.
                ScreenCapture.requestAccess()
                PrivacyPane.screenRecording.open()
            },
            // Only System Settings can take a permission back.
            turnOffBackdrop: { PrivacyPane.screenRecording.open() },
            launchesAtLogin: status.launchesAtLogin,
            setLaunchesAtLogin: { status.setLaunchesAtLogin($0) },
            updatesAvailable: updater.isAvailable,
            checksForUpdatesAutomatically: updater.automaticallyChecksForUpdates,
            setChecksForUpdatesAutomatically: { updater.setAutomaticallyChecksForUpdates($0) },
            canCheckForUpdates: updater.canCheckForUpdates,
            checkForUpdates: { updater.checkForUpdates() }
        )
        .onAppear { status.refreshPermissions() }
        // Coming back from System Settings makes Free Roam active again.
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            status.refreshPermissions()
        }
    }
}

/// The General tab drawn from plain values, so a test can render each state.
struct GeneralSettingsContent: View {
    /// Narrower than the Stations tab, as a list of settings reads better
    /// short, and wide enough for the two previews side by side.
    nonisolated static let width = 520.0

    var previews = BackdropPreview.bundled
    let backdropOn: Bool
    var turnOnBackdrop: () -> Void = {}
    var turnOffBackdrop: () -> Void = {}
    var launchesAtLogin = false
    var setLaunchesAtLogin: (Bool) -> Void = { _ in }
    /// False without a feed to check, as in `swift run`.
    var updatesAvailable = true
    var checksForUpdatesAutomatically = false
    var setChecksForUpdatesAutomatically: (Bool) -> Void = { _ in }
    var canCheckForUpdates = true
    var checkForUpdates: () -> Void = {}

    var body: some View {
        Form {
            backdrop
            Section {
                Toggle("Open Free Roam when you log in", isOn: Binding(
                    get: { launchesAtLogin },
                    set: { setLaunchesAtLogin($0) }
                ))
            }
            if updatesAvailable {
                Section {
                    Toggle("Check for updates automatically", isOn: Binding(
                        get: { checksForUpdatesAutomatically },
                        set: { setChecksForUpdatesAutomatically($0) }
                    ))
                    HStack {
                        Spacer()
                        Button("Check Now", action: checkForUpdates)
                            .disabled(!canCheckForUpdates)
                            .accessibilityLabel("Check for updates now")
                    }
                }
            }
        }
        .formStyle(.grouped)
        // The form scrolls, so left to itself it could shrink to nothing.
        // Fixing its height keeps every row on screen in the window.
        .scrollDisabled(true)
        .fixedSize(horizontal: false, vertical: true)
        // The window is shared with the Stations tab and can be resized, so
        // a bigger window widens the rows and leaves any extra height below.
        .frame(minWidth: Self.width, idealWidth: Self.width, maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var backdrop: some View {
        Section {
            LabeledContent {
                if backdropOn {
                    Label("On", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Button("Turn On…", action: turnOnBackdrop)
                        .accessibilityLabel("Turn on cinematic backdrop")
                }
            } label: {
                Text("Cinematic backdrop")
                Text("Fades the screen behind the wheel so your stations stand out.")
            }
            BackdropPreview(previews: previews)
            // Captures happen as ⌥Q goes down, and once per display at launch
            // or when it's connected to warm up. All stay in memory.
            Text("macOS will say Free Roam can record your screen. It only takes a still as you hold ⌥Q, and never saves or sends it.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if backdropOn {
                HStack {
                    Spacer()
                    Button("Turn Off in System Settings…", action: turnOffBackdrop)
                }
            } else {
                // macOS keeps showing the switch on for an earlier build it no
                // longer recognises, so a switch that's on can still mean no.
                Text("Already on in System Settings? Switch it off and on again.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
