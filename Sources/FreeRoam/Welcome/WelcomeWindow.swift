import AppKit
import Carbon.HIToolbox
import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "welcome")

/// Explains Free Roam's two permissions at launch, until you choose Don't
/// Show This Again or both are allowed. Closing it any other way is fine:
/// nothing nags, and it shows again at the next launch, since people often
/// open an app, close it straight away and come back later.
@MainActor
final class WelcomeWindow: NSObject, NSWindowDelegate {
    private let model: WelcomeModel
    private var window: NSWindow?
    private var activationObserver: (any NSObjectProtocol)?

    init(stations: StationList) {
        model = WelcomeModel(stations: stations)
    }

    func showIfNeeded() {
        model.refresh()
        guard model.shouldShow else {
            let reason = model.dontShowAgain ? "you chose Don't Show This Again" : "both permissions are allowed"
            log.notice("Didn't show the welcome window: \(reason, privacy: .public)")
            return
        }
        show()
    }

    private func show() {
        let content = WelcomeView(
            model: model,
            dontShowAgain: { [weak self] in self?.dismissForGood() },
            // Exactly what the close button does.
            close: { [weak self] in self?.window?.performClose(nil) }
        )
        let window = EscapeClosingWindow(contentViewController: NSHostingController(rootView: content))
        window.styleMask = [.titled, .closable]
        window.title = "Welcome to Free Roam"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.center()
        // Free Roam has no Dock icon and isn't the active app, so the window
        // would otherwise open behind the app you're in. macOS can turn the
        // activation down, so the window comes forward regardless.
        NSApp.activate()
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        self.window = window

        // Coming back from System Settings makes Free Roam active again.
        activationObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.model.refresh() }
        }
        log.notice("""
            Showed the welcome window: Control Music \(self.model.musicAllowed ? "allowed" : "not allowed", privacy: .public), \
            Screen Recording \(self.model.screenRecordingAllowed ? "allowed" : "not allowed", privacy: .public)
            """)
    }

    private func dismissForGood() {
        model.dontShowAgain = true
        log.notice("The welcome window won't show again: you chose Don't Show This Again")
        window?.close()
    }

    func windowWillClose(_ notification: Notification) {
        model.stopAskingForMusic()
        if !model.dontShowAgain {
            log.notice("Closed the welcome window, so it shows again at the next launch")
        }
        if let activationObserver { NotificationCenter.default.removeObserver(activationObserver) }
        activationObserver = nil
        window = nil
    }
}

/// Escape closes it, as Close and the close button do. Neither the window
/// nor the SwiftUI content turns Escape into `cancelOperation`, so it's
/// caught as it arrives.
final class EscapeClosingWindow: NSWindow {
    override func sendEvent(_ event: NSEvent) {
        guard event.type == .keyDown, event.keyCode == UInt16(kVK_Escape) else {
            super.sendEvent(event)
            return
        }
        performClose(nil)
    }
}
