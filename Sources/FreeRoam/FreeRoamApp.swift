import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "app")

@main
struct FreeRoamApp: App {
    @NSApplicationDelegateAdaptor private var appDelegate: AppDelegate

    init() {
        #if DEBUG
        if CommandLine.arguments.contains("--probe") { PermissionProbe.printAndExit() }
        #endif
    }

    var body: some Scene {
        MenuBarExtra("Free Roam", systemImage: "radio") {
            StatusMenu(model: appDelegate.menu)
        }
        Settings {
            StationsSettingsView(stations: appDelegate.stations, details: appDelegate.details, style: appDelegate.style)
        }
        .windowResizability(.contentMinSize)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let menu = StatusMenuModel()
    let stations = StationList()
    /// Shared by the wheel and Settings, which show the same logos.
    let details = StationDetails()
    /// Nil when tokens.json is missing, which turns the wheel off.
    let style = AppDelegate.loadStyle()
    private var wheel: RadioWheelModel?
    private lazy var welcome = WelcomeWindow(stations: stations)

    func applicationDidFinishLaunching(_ notification: Notification) {
        CaptionFont.register()
        stations.reload()
        welcome.showIfNeeded()
        guard let style else { return }
        let wheel = RadioWheelModel(style: style, stations: stations, details: details)
        details.isWheelInUse = { [weak wheel] in wheel?.isInUse ?? false }
        stations.onChange = { [weak wheel] in wheel?.loadDetails(for: $0) }
        // Your saved stations, before Music's playlists have loaded.
        wheel.loadDetails(for: stations.onWheel)
        wheel.start()
        self.wheel = wheel
    }

    func applicationWillTerminate(_ notification: Notification) {
        wheel?.restoreVolumeNow()
    }

    nonisolated private static func loadStyle() -> WheelStyle? {
        do {
            let style = try WheelStyle.bundled()
            log.notice("Loaded tokens.json: hold ⌥Q for \(Int(style.behaviour.holdDelayMs)) ms to open the wheel")
            return style
        } catch {
            log.error("Couldn't load tokens.json, so the wheel is off: \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}
