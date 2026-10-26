import AppKit

/// The lists in System Settings > Privacy & Security that hold Free Roam's
/// two permissions.
enum PrivacyPane: String {
    case automation = "Privacy_Automation"
    case screenRecording = "Privacy_ScreenCapture"

    @MainActor func open() {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(rawValue)") else { return }
        NSWorkspace.shared.open(url)
    }
}
