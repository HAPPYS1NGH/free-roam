import AppKit
import OSLog
import Sparkle

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "updates")

/// Checks for new versions with Sparkle, which reads SUFeedURL and
/// SUPublicEDKey from Info.plist. Sparkle asks on the second launch whether
/// to check on its own, and checks once a day if the person says yes. It
/// calls its delegate on the main thread.
@MainActor @Observable
final class Updater: NSObject, @preconcurrency SPUStandardUserDriverDelegate {
    /// False while Sparkle is already busy with a check or an install.
    private(set) var canCheckForUpdates = false
    /// A background check found a version the person hasn't looked at yet.
    /// Free Roam has no window to show it over, so the menu shows it instead.
    private(set) var hasUnseenUpdate = false

    @ObservationIgnored private var controller: SPUStandardUpdaterController?
    @ObservationIgnored private var canCheckObservation: NSKeyValueObservation?

    override init() {
        super.init()
        // `swift run` has no Info.plist, so there's no feed to check, and
        // Sparkle would show an error at launch.
        guard Bundle.main.object(forInfoDictionaryKey: "SUFeedURL") != nil else {
            log.notice("No SUFeedURL in Info.plist, so updates are off")
            return
        }
        let controller = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: self)
        canCheckObservation = controller.updater.observe(\.canCheckForUpdates, options: [.initial, .new]) { [weak self] updater, _ in
            // Sparkle changes it on the main thread.
            MainActor.assumeIsolated { self?.canCheckForUpdates = updater.canCheckForUpdates }
        }
        self.controller = controller
    }

    var isAvailable: Bool { controller != nil }

    func checkForUpdates() {
        // The update window would otherwise open behind the app you're in.
        NSApp.activate()
        controller?.checkForUpdates(nil)
    }

    // MARK: SPUStandardUserDriverDelegate

    // Sparkle's own window is fine right after launch, when Free Roam was
    // just opened. Later checks happen while you're in another app, so they
    // wait in the menu rather than pop a window over your work.
    var supportsGentleScheduledUpdateReminders: Bool { true }

    func standardUserDriverShouldHandleShowingScheduledUpdate(_ update: SUAppcastItem, andInImmediateFocus immediateFocus: Bool) -> Bool {
        immediateFocus
    }

    func standardUserDriverWillHandleShowingUpdate(_ handleShowingUpdate: Bool, forUpdate update: SUAppcastItem, state: SPUUserUpdateState) {
        log.notice("Found version \(update.displayVersionString, privacy: .public)")
        if handleShowingUpdate {
            NSApp.activate()
        } else if !state.userInitiated {
            hasUnseenUpdate = true
        }
    }

    func standardUserDriverDidReceiveUserAttention(forUpdate update: SUAppcastItem) {
        hasUnseenUpdate = false
    }

    func standardUserDriverWillFinishUpdateSession() {
        hasUnseenUpdate = false
    }
}
