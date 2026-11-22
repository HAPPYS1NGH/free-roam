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
        MenuBarExtra {
            StatusMenu(model: appDelegate.menu, stations: appDelegate.stations, updater: appDelegate.updater, selectApp: appDelegate.selectApp)
        } label: {
            MenuBarIcon()
                .modifier(SettingsOpenerCapture { appDelegate.openSettings = $0 })
        }
        Settings {
            StationsSettingsView(stations: appDelegate.stations, details: appDelegate.details, style: appDelegate.style, selectApp: appDelegate.selectApp)
        }
        .windowResizability(.contentMinSize)
    }
}

/// Hands the Settings scene's opener to the app delegate, which has no
/// SwiftUI environment of its own. The menu bar label is on screen from
/// launch, so it's there before anyone reopens the app.
private struct SettingsOpenerCapture: ViewModifier {
    @Environment(\.openSettings) private var openSettings
    let store: (OpenSettingsAction) -> Void

    func body(content: Content) -> some View {
        content.onAppear { store(openSettings) }
    }
}

/// The badge's ring and lettering from Contents/Resources, which
/// scripts/bundle.sh copies in. A build run without the bundle, such as
/// `swift run`, has no resources, so it falls back to the radio symbol.
struct MenuBarIcon: View {
    /// NSImage(named:) loads the @1x and @2x files as one image, and the
    /// Template suffix makes it a template that macOS tints for the menu bar.
    private static let glyph = NSImage(named: "MenuBarIconTemplate")

    var body: some View {
        Group {
            if let glyph = Self.glyph {
                Image(nsImage: glyph)
            } else {
                Image(systemName: "radio")
            }
        }
        .accessibilityLabel("Free Roam")
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let menu = StatusMenuModel()
    let stations = StationList()
    /// Shared by the wheel and Settings, which show the same logos.
    let details = StationDetails()
    let updater = Updater()
    /// Nil when tokens.json is missing, which turns the wheel off.
    let style = AppDelegate.loadStyle()
    var openSettings: OpenSettingsAction?
    private var wheel: RadioWheelModel?
    private lazy var welcome = WelcomeWindow(stations: stations, selectApp: selectApp)

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

    /// Switches between Music and Spotify, from Settings or the menu. The app
    /// you leave is paused, so two never play at once, and the wheel opens on
    /// Radio Off until it reads the new one.
    func selectApp(_ app: MusicApp) {
        let previous = MusicApp.current
        guard app != previous else { return }
        MusicApp.current = app
        log.notice("Switched from \(previous.name, privacy: .public) to \(app.name, privacy: .public)")
        stations.switchApp(to: app)
        wheel?.appChanged()
        menu.refreshPermissions()
        guard previous.bridge.isRunning else { return }
        Task {
            do {
                try await previous.bridge.pause()
            } catch MusicBridgeError.notRunning {
                // It quit while the pause waited its turn.
            } catch {
                log.error("Couldn't pause \(previous.name, privacy: .public): \(String(describing: error), privacy: .public)")
            }
        }
    }

    /// Opening Free Roam again from Finder, Spotlight or Raycast while it's
    /// running would otherwise do nothing visible, as it has no Dock icon.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        log.notice("Opened again while running, so showing Settings")
        openSettings?()
        NSApp.activate()
        return false
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
