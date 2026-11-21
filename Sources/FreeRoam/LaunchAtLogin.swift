import OSLog
import ServiceManagement

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "login")

/// Whether macOS opens Free Roam when you log in. It's off until you turn
/// it on, in the menu or the welcome window, and System Settings → General
/// → Login Items can change it too, so it's always read fresh.
enum LaunchAtLogin {
    static var isEnabled: Bool { SMAppService.mainApp.status == .enabled }

    /// Returns whether it's on afterwards, which stays as it was on failure.
    @discardableResult
    static func set(_ enabled: Bool) -> Bool {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            log.notice("Launch at Login is \(enabled ? "on" : "off", privacy: .public)")
        } catch {
            log.error("Couldn't turn Launch at Login \(enabled ? "on" : "off", privacy: .public): \(String(describing: error), privacy: .public)")
        }
        return isEnabled
    }
}
