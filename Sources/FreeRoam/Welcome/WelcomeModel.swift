import AppKit
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "welcome")

/// Whether Free Roam may control one music app, as its card in the welcome
/// window shows it.
enum AppControlStatus: Equatable, Sendable {
    case allowed
    /// Or asked and refused while the app was closed, which looks the same
    /// until it runs. Asking then opens System Settings.
    case notAsked
    /// macOS remembers a no, and only System Settings can change it.
    case denied
    case notInstalled
    /// The app is launching, or macOS's prompt is up.
    case asking
}

/// What the welcome window shows: the app you play from, whether Free Roam
/// may control each app and record the screen, and the buttons that ask.
@MainActor @Observable
final class WelcomeModel {
    /// Each app's status as last checked, without asking.
    private(set) var checked: [MusicApp: AppControlStatus] = [:]
    private(set) var asking: MusicApp?
    private(set) var backdropOn = false
    private(set) var launchesAtLogin = LaunchAtLogin.isEnabled
    var dontShowAgain: Bool {
        get { defaults.bool(forKey: Self.dontShowAgainKey) }
        set { defaults.set(newValue, forKey: Self.dontShowAgainKey) }
    }

    @ObservationIgnored private var permissions: [MusicApp: MusicPermission] = [:]
    @ObservationIgnored private var askingTask: Task<Void, Never>?
    @ObservationIgnored private let stations: StationList
    @ObservationIgnored private let selectApp: @MainActor (MusicApp) -> Void
    @ObservationIgnored private let defaults = UserDefaults.standard

    /// Set by Don't Show This Again.
    nonisolated static let dontShowAgainKey = "welcomeDontShowAgain"

    init(stations: StationList, selectApp: @escaping @MainActor (MusicApp) -> Void) {
        self.stations = stations
        self.selectApp = selectApp
    }

    /// The app the wheel plays from. Follows Settings and the menu too.
    var picked: MusicApp { stations.app }

    /// What each app's card shows.
    var statuses: [MusicApp: AppControlStatus] {
        var statuses = checked
        if let asking { statuses[asking] = .asking }
        return statuses
    }

    /// Shown at launch unless you chose Don't Show This Again or Free Roam
    /// may control the app you play from. The cinematic backdrop is optional,
    /// so it doesn't count. Closing the window any other way leaves it to
    /// show at the next launch.
    nonisolated static func shouldShow(dontShowAgain: Bool, pickedAppAllowed: Bool) -> Bool {
        !dontShowAgain && !pickedAppAllowed
    }

    /// An app only says whether Free Roam may control it while it's running,
    /// so otherwise its last answer stands. Without that, the window would
    /// come back at every launch with the app closed. A no from before can't
    /// be told from no answer until the app runs, so both read as not asked.
    nonisolated static func status(_ permission: MusicPermission, lastAnswer: Bool, isInstalled: Bool) -> AppControlStatus {
        guard isInstalled else { return .notInstalled }
        return switch permission {
        case .allowed: .allowed
        case .denied: .denied
        case .notAsked: .notAsked
        case .musicNotRunning, .unknown: lastAnswer ? .allowed : .notAsked
        }
    }

    var shouldShow: Bool {
        Self.shouldShow(dontShowAgain: dontShowAgain, pickedAppAllowed: checked[picked] == .allowed)
    }

    /// Checks every permission again without prompting, as when you come
    /// back from System Settings or pick another app.
    func refresh() {
        for app in MusicApp.allCases { update(app, to: app.bridge.permission()) }
        launchesAtLogin = LaunchAtLogin.isEnabled
        let screen = ScreenCapture.isAllowed
        if screen != backdropOn {
            backdropOn = screen
            log.notice("The cinematic backdrop is \(screen ? "on" : "off", privacy: .public): Screen Recording is \(screen ? "allowed" : "not allowed", privacy: .public)")
        }
    }

    /// Plays from `app` from now on, as Settings and the menu do.
    func pick(_ app: MusicApp) {
        selectApp(app)
    }

    /// Asks macOS to let Free Roam control `app`, or opens System Settings
    /// when it already said no. One app is asked at a time.
    func allow(_ app: MusicApp) {
        guard permissions[app] != .denied else {
            PrivacyPane.automation.open()
            return
        }
        guard askingTask == nil else { return }
        asking = app
        askingTask = Task {
            defer {
                asking = nil
                askingTask = nil
            }
            do {
                try await ask(app)
            } catch is CancellationError {
                log.notice("Stopped asking about \(app.name, privacy: .public): the welcome window closed")
            } catch {
                log.error("Couldn't ask about \(app.name, privacy: .public): \(String(describing: error), privacy: .public)")
            }
        }
    }

    /// For when the window closes, so a wait for ⌥ can't open Music later.
    func stopAsking() {
        askingTask?.cancel()
    }

    /// Opens the app hidden if it's closed, as Settings does, because macOS
    /// only answers for a running app. The first check never prompts, so a
    /// no from before can be told apart from one you give in the prompt. Only
    /// System Settings can change an earlier no, so that opens instead.
    private func ask(_ app: MusicApp) async throws {
        let bridge = app.bridge
        if !bridge.isRunning { try await bridge.openHidden() }
        update(app, to: try await bridge.permissionOnceStarted())
        try Task.checkCancellation()
        switch permissions[app] {
        case .denied:
            PrivacyPane.automation.open()
            return
        case .notAsked:
            update(app, to: await bridge.requestPermission())
            try Task.checkCancellation()
        default:
            break
        }
        guard permissions[app] == .allowed else { return }
        // The wheel can now list the playlists, which it couldn't at launch
        // with the app closed, once the app takes scripts.
        try await bridge.waitUntilAnswering()
        if app == picked { stations.reload() }
    }

    func setLaunchesAtLogin(_ enabled: Bool) {
        launchesAtLogin = LaunchAtLogin.set(enabled)
    }

    func turnOnBackdrop() {
        ScreenCapture.requestAccess()
        PrivacyPane.screenRecording.open()
    }

    private func update(_ app: MusicApp, to permission: MusicPermission) {
        permissions[app] = permission
        // The bridge has already recorded the answer, if the app gave one.
        let isInstalled = NSWorkspace.shared.urlForApplication(withBundleIdentifier: app.bridge.bundleID) != nil
        let status = Self.status(permission, lastAnswer: MusicPermissionMemory.lastAnswer(for: app), isInstalled: isInstalled)
        guard status != checked[app] else { return }
        checked[app] = status
        log.notice("""
            Control \(app.name, privacy: .public) is \(String(describing: status), privacy: .public) \
            (\(permission.label, privacy: .public))
            """)
    }
}
