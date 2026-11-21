import AppKit
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "welcome")

/// What the welcome window shows: whether Free Roam may control Music and
/// record the screen, and the buttons that ask for each.
@MainActor @Observable
final class WelcomeModel {
    private(set) var musicAllowed = false
    private(set) var screenRecordingAllowed = false
    /// Music is launching, or macOS's prompt is up.
    private(set) var isAskingForMusic = false
    private(set) var launchesAtLogin = LaunchAtLogin.isEnabled
    var dontShowAgain: Bool {
        get { defaults.bool(forKey: Self.dontShowAgainKey) }
        set { defaults.set(newValue, forKey: Self.dontShowAgainKey) }
    }

    @ObservationIgnored private var musicPermission = MusicPermission.notAsked
    @ObservationIgnored private var askingForMusic: Task<Void, Never>?
    @ObservationIgnored private let stations: StationList
    @ObservationIgnored private let defaults = UserDefaults.standard

    /// Set by Don't Show This Again.
    nonisolated static let dontShowAgainKey = "welcomeDontShowAgain"

    init(stations: StationList) {
        self.stations = stations
    }

    /// Shown at launch unless you chose Don't Show This Again or both
    /// permissions are allowed. Closing it any other way leaves it to show
    /// at the next launch.
    nonisolated static func shouldShow(dontShowAgain: Bool, musicAllowed: Bool, screenRecordingAllowed: Bool) -> Bool {
        !dontShowAgain && !(musicAllowed && screenRecordingAllowed)
    }

    /// Music only says whether Free Roam may control it while it's running,
    /// so otherwise its last answer stands. Without that, the window would
    /// come back at every launch with Music closed.
    nonisolated static func isMusicAllowed(_ permission: MusicPermission, lastAnswer: Bool) -> Bool {
        permission.isAllowed ?? lastAnswer
    }

    var shouldShow: Bool {
        Self.shouldShow(dontShowAgain: dontShowAgain, musicAllowed: musicAllowed, screenRecordingAllowed: screenRecordingAllowed)
    }

    /// Checks both permissions again without prompting, as when you come
    /// back from System Settings.
    func refresh() {
        update(music: MusicBridge.permission())
        launchesAtLogin = LaunchAtLogin.isEnabled
        let screen = ScreenCapture.isAllowed
        if screen != screenRecordingAllowed {
            screenRecordingAllowed = screen
            log.notice("Screen Recording is \(screen ? "allowed" : "not allowed", privacy: .public)")
        }
    }

    func allowMusic() {
        guard musicPermission != .denied else {
            PrivacyPane.automation.open()
            return
        }
        guard askingForMusic == nil else { return }
        isAskingForMusic = true
        askingForMusic = Task {
            defer {
                isAskingForMusic = false
                askingForMusic = nil
            }
            do {
                try await askForMusic()
            } catch is CancellationError {
                log.notice("Stopped asking about Music: the welcome window closed")
            } catch {
                log.error("Couldn't ask about Music: \(String(describing: error), privacy: .public)")
            }
        }
    }

    /// For when the window closes, so a wait for ⌥ can't open Music later.
    func stopAskingForMusic() {
        askingForMusic?.cancel()
    }

    /// Opens Music hidden if it's closed, as Settings does, because macOS
    /// only answers for a running app. The first check never prompts, so a
    /// no from before can be told apart from one you give in the prompt. Only
    /// System Settings can change an earlier no, so that opens instead.
    private func askForMusic() async throws {
        if !MusicBridge.isRunning { try await MusicBridge.openHidden() }
        update(music: try await MusicBridge.permissionOnceStarted())
        try Task.checkCancellation()
        switch musicPermission {
        case .denied:
            PrivacyPane.automation.open()
            return
        case .notAsked:
            update(music: await MusicBridge.requestPermission())
            try Task.checkCancellation()
        default:
            break
        }
        guard musicPermission == .allowed else { return }
        // The wheel can now list the playlists, which it couldn't at launch
        // with Music closed, once Music takes scripts.
        try await MusicBridge.waitUntilAnswering()
        stations.reload()
    }

    func setLaunchesAtLogin(_ enabled: Bool) {
        launchesAtLogin = LaunchAtLogin.set(enabled)
    }

    func allowScreenRecording() {
        ScreenCapture.requestAccess()
        PrivacyPane.screenRecording.open()
    }

    private func update(music permission: MusicPermission) {
        musicPermission = permission
        // `MusicBridge` has already recorded the answer, if Music gave one.
        let allowed = Self.isMusicAllowed(permission, lastAnswer: MusicPermissionMemory.lastAnswer())
        guard allowed != musicAllowed else { return }
        musicAllowed = allowed
        log.notice("Control Music is \(allowed ? "allowed" : "not allowed", privacy: .public) (\(permission.label, privacy: .public))")
    }
}
