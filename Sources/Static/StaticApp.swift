import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.static", category: "app")

@main
struct StaticApp: App {
    @NSApplicationDelegateAdaptor private var appDelegate: AppDelegate

    init() {
        #if DEBUG
        if CommandLine.arguments.contains("--probe") { PermissionProbe.printAndExit() }
        #endif
    }

    var body: some Scene {
        MenuBarExtra("Static", systemImage: "radio") {
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

    func applicationDidFinishLaunching(_ notification: Notification) {
        CaptionFont.register()
        stations.reload()
        let style: WheelStyle
        do {
            style = try WheelStyle.bundled()
        } catch {
            log.error("Couldn't load tokens.json, so the wheel is off: \(String(describing: error), privacy: .public)")
            return
        }
        log.notice("Loaded tokens.json: hold ⌥Q for \(Int(style.behaviour.holdDelayMs)) ms to open the wheel")
        let wheel = RadioWheelModel(style: style, stations: stations)
        stations.onLoaded = { [weak wheel] in wheel?.loadDetails(for: $0) }
        // Your saved stations, before Music's playlists have loaded.
        wheel.loadDetails(for: stations.onWheel)
        wheel.start()
        self.wheel = wheel
    }

    func applicationWillTerminate(_ notification: Notification) {
        wheel?.restoreVolumeNow()
    }
}
