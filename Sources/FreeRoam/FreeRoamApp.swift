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
            StationsSettingsView(stations: appDelegate.stations)
        }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let menu = StatusMenuModel()
    let stations = StationList()
    private var wheel: RadioWheelModel?
    private lazy var welcome = WelcomeWindow(stations: stations)

    func applicationDidFinishLaunching(_ notification: Notification) {
        CaptionFont.register()
        stations.reload()
        welcome.showIfNeeded()
        let style: WheelStyle
        do {
            style = try WheelStyle.bundled()
        } catch {
            log.error("Couldn't load tokens.json, so the wheel is off: \(String(describing: error), privacy: .public)")
            return
        }
        log.notice("Loaded tokens.json: hold ⌥Q for \(Int(style.behaviour.holdDelayMs)) ms to open the wheel")
        let wheel = RadioWheelModel(style: style, stations: stations)
        stations.onChange = { [weak wheel] in wheel?.loadDetails(for: $0) }
        // Your saved stations, before Music's playlists have loaded.
        wheel.loadDetails(for: stations.onWheel)
        wheel.start()
        self.wheel = wheel
    }

    func applicationWillTerminate(_ notification: Notification) {
        wheel?.restoreVolumeNow()
    }
}
