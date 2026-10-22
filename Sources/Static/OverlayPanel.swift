import AppKit
import SwiftUI

/// A see-through panel over the whole screen with the mouse, on every Space
/// and over full-screen apps. It never activates Static or takes the keyboard,
/// so the app you were in stays frontmost. It covers the screen and takes
/// mouse events itself, so scrolling and clicks don't reach the app underneath.
///
/// While it's shown, mouse movement and scrolling become wheel input. Mouse
/// moves go to the active app wherever the pointer is, so they're read from
/// copies of the events sent to other apps, or from Static's own events when
/// Static is the active app. Scrolls go to the panel under the pointer.
final class OverlayPanel: NSPanel {
    /// Points moved, with y growing downwards.
    var onMouseMove: (_ dx: Double, _ dy: Double) -> Void = { _, _ in }
    /// Points scrolled, positive for clockwise, and the event's time in seconds.
    var onScroll: (_ delta: Double, _ time: TimeInterval) -> Void = { _, _ in }

    /// Mouse wheels that scroll by lines move this many points per line, as in browsers.
    private static let lineHeight = 16.0

    private var monitors: [Any] = []

    init(content: some View) {
        super.init(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
        level = .statusBar
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        animationBehavior = .none
        // Set explicitly, so the clear parts of the panel take mouse events too
        // instead of passing them to the windows underneath.
        ignoresMouseEvents = false

        let hosting = NSHostingView(rootView: content)
        hosting.sizingOptions = []
        contentView = hosting
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    func show(on screen: NSScreen) {
        setFrame(screen.frame, display: false)
        orderFrontRegardless()
        startMonitoring()
    }

    func hide() {
        stopMonitoring()
        orderOut(nil)
    }

    private func startMonitoring() {
        let types: NSEvent.EventTypeMask = [.mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged, .scrollWheel]
        // Events sent to Static. Returning nil keeps them from going any further.
        if let monitor = NSEvent.addLocalMonitorForEvents(matching: types, handler: { [weak self] event in
            MainActor.assumeIsolated { self?.received(event, toOtherApp: false) }
            return nil
        }) {
            monitors.append(monitor)
        }
        // Copies of events sent to other apps, which still get them.
        if let monitor = NSEvent.addGlobalMonitorForEvents(matching: types, handler: { [weak self] event in
            MainActor.assumeIsolated { self?.received(event, toOtherApp: true) }
        }) {
            monitors.append(monitor)
        }
    }

    private func received(_ event: NSEvent, toOtherApp: Bool) {
        if event.type == .scrollWheel {
            if !toOtherApp { scroll(event) }
            return
        }
        // Every move reaches the active app, and the panel gets some of them
        // again, so only the active app's copy counts.
        if toOtherApp != NSApp.isActive { onMouseMove(event.deltaX, event.deltaY) }
    }

    private func stopMonitoring() {
        monitors.forEach(NSEvent.removeMonitor)
        monitors.removeAll()
    }

    private func scroll(_ event: NSEvent) {
        let unit = event.hasPreciseScrollingDeltas ? 1 : Self.lineHeight
        // Negated to match browser wheel deltas, which the prototype was tuned
        // with: scrolling down the page is positive. Trackpads scroll on both
        // axes, so follow whichever one the swipe favours.
        let dx = -event.scrollingDeltaX
        let dy = -event.scrollingDeltaY
        onScroll((abs(dy) >= abs(dx) ? dy : dx) * unit, event.timestamp)
    }
}

extension NSScreen {
    static var withMouse: NSScreen? {
        let mouse = NSEvent.mouseLocation
        return screens.first { NSMouseInRect(mouse, $0.frame, false) } ?? main
    }

    var displayID: CGDirectDisplayID? {
        deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID
    }
}
