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
    var dontShowAgain: Bool {
        get { defaults.bool(forKey: Self.dontShowAgainKey) }
        set { defaults.set(newValue, forKey: Self.dontShowAgainKey) }
    }

    @ObservationIgnored private var musicPermission = MusicPermission.notAsked
    @ObservationIgnored private let stations: StationList
    @ObservationIgnored private let defaults = UserDefaults.standard

    /// Set by Don't Show This Again.
    nonisolated static let dontShowAgainKey = "welcomeDontShowAgain"
    /// Whether Music last said Free Roam may control it.
    nonisolated static let musicAllowedKey = "musicControlAllowed"

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
        switch permission {
        case .allowed: true
        case .denied, .notAsked: false
        case .musicNotRunning, .unknown: lastAnswer
        }
    }

    var shouldShow: Bool {
        Self.shouldShow(dontShowAgain: dontShowAgain, musicAllowed: musicAllowed, screenRecordingAllowed: screenRecordingAllowed)
    }

    /// Checks both permissions again without prompting, as when you come
    /// back from System Settings.
    func refresh() {
        update(music: MusicBridge.permission())
        let screen = ScreenCapture.isAllowed
        if screen != screenRecordingAllowed {
            screenRecordingAllowed = screen
            log.notice("Screen Recording is \(screen ? "allowed" : "not allowed", privacy: .public)")
        }
    }

    /// Opens Music hidden if it's closed, as Settings does, because macOS
    /// only asks about a running app, then shows macOS's prompt. Once you've
    /// said no, only System Settings can change it.
    func allowMusic() {
        guard musicPermission != .denied else {
            PrivacyPane.automation.open()
            return
        }
        guard !isAskingForMusic else { return }
        isAskingForMusic = true
        Task {
            defer { isAskingForMusic = false }
            if !MusicBridge.isRunning {
                do {
                    try await MusicBridge.launch()
                } catch {
                    // Launching ends with a script, which can bring up the prompt
                    // and time out or fail while it's up, so the request below
                    // still gets the answer.
                    log.error("Launching Music to ask for permission ended with: \(String(describing: error), privacy: .public)")
                }
            }
            update(music: await MusicBridge.requestPermission())
            // The wheel can now list the playlists, which it couldn't at launch
            // with Music closed.
            if musicAllowed { stations.reload() }
        }
    }

    func allowScreenRecording() {
        ScreenCapture.requestAccess()
        PrivacyPane.screenRecording.open()
    }

    private func update(music permission: MusicPermission) {
        musicPermission = permission
        let allowed = Self.isMusicAllowed(permission, lastAnswer: defaults.bool(forKey: Self.musicAllowedKey))
        defaults.set(allowed, forKey: Self.musicAllowedKey)
        guard allowed != musicAllowed else { return }
        musicAllowed = allowed
        log.notice("Control Music is \(allowed ? "allowed" : "not allowed", privacy: .public) (\(permission.label, privacy: .public))")
    }
}
