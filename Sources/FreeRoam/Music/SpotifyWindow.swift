import AppKit
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

/// Keeps Spotify out of sight while Free Roam plays it. Measured on Spotify
/// 1.3.10: `play track` activates Spotify and shows its window, even when
/// it was hidden first, and a launch with `hides` shows it too. `play`,
/// `pause` and `next track` leave it where it is. Hiding it straight after
/// put the app you were in back in front within about 100 ms.
@MainActor
enum SpotifyWindow {
    /// How long after `play track` Spotify can still come forward.
    static let playWatch = Duration.milliseconds(1500)
    /// Spotify draws its window a few seconds into a launch.
    static let launchWatch = Duration.seconds(8)

    /// Whether you can see Spotify now: it's in front or has a window on
    /// screen. Free Roam leaves a Spotify you have open alone.
    static var isShown: Bool {
        guard let spotify = running else { return false }
        return spotify.isActive || hasWindowOnScreen(spotify.processIdentifier)
    }

    /// Hides Spotify whenever it comes forward during `duration`, unless you
    /// already had it open. Call it just before the command that brings
    /// Spotify forward. It returns at once and watches in the background.
    static func keepHidden(for duration: Duration) {
        guard !isShown else { return }
        // Hiding Spotify hands focus to whichever app macOS picks, which
        // wasn't always the one you were in, so that one is asked back.
        let inFront = NSWorkspace.shared.frontmostApplication
        Task { @MainActor in
            let deadline = ContinuousClock.now + duration
            var hides = 0
            while ContinuousClock.now < deadline {
                if let spotify = running, spotify.isActive || hasWindowOnScreen(spotify.processIdentifier) {
                    spotify.hide()
                    if let inFront, inFront.bundleIdentifier != SpotifyBridge.bundleID, !inFront.isTerminated {
                        inFront.activate()
                    }
                    hides += 1
                }
                // Polling lets the main run loop update the app's state.
                try? await Task.sleep(for: .milliseconds(25))
            }
            if hides > 0 { log.notice("Sent Spotify back behind the app you're in") }
        }
    }

    private static var running: NSRunningApplication? {
        NSRunningApplication.runningApplications(withBundleIdentifier: SpotifyBridge.bundleID).first { !$0.isTerminated }
    }

    /// A normal window of the process on screen. Menus and the status item
    /// sit on other layers.
    private static func hasWindowOnScreen(_ processID: pid_t) -> Bool {
        let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
        return windows.contains { window in
            window[kCGWindowOwnerPID as String] as? pid_t == processID && window[kCGWindowLayer as String] as? Int == 0
        }
    }
}
