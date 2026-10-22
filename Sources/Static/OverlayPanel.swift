import AppKit
import OSLog
import SwiftUI

private let log = Logger(subsystem: "com.happys1ngh.static", category: "overlay")

/// A see-through panel over the whole screen with the mouse, on every Space
/// and over full-screen apps. It never activates Static or takes the keyboard,
/// so the app you were in stays frontmost. While it's shown, it turns mouse
/// movement and scrolling into wheel input. It covers the screen and takes
/// mouse events itself, so scrolling and clicks don't reach the app underneath.
final class OverlayPanel: NSPanel {
    /// Points moved, with y growing downwards.
    var onMouseMove: (_ dx: Double, _ dy: Double) -> Void = { _, _ in }
    /// Points scrolled, positive for clockwise, and the event's time in seconds.
    var onScroll: (_ delta: Double, _ time: TimeInterval) -> Void = { _, _ in }

    /// Mouse wheels that scroll by lines move this many points per line, as in browsers.
    private static let lineHeight = 16.0

    private var monitors: [Any] = []
    private var counts = InputCounts()

    /// How many events arrived by each route while the panel was shown. A
    /// non-activating panel belongs to an app in the background, so this checks
    /// which routes deliver without the Accessibility permission.
    private struct InputCounts {
        var ownMoves = 0
        var otherAppMoves = 0
        var scrolls = 0
    }

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
        acceptsMouseMovedEvents = true
        // Set explicitly, so the clear parts of the panel take mouse events too
        // instead of passing them to the windows underneath.
        ignoresMouseEvents = false

        let hosting = NSHostingView(rootView: content)
        hosting.sizingOptions = []
        hosting.autoresizingMask = [.width, .height]
        let container = NSView()
        container.addSubview(hosting)
        // Asks for mouse moves while another app is active.
        container.addTrackingArea(NSTrackingArea(
            rect: .zero, options: [.mouseMoved, .activeAlways, .inVisibleRect], owner: container
        ))
        contentView = container
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    func show(on screen: NSScreen) {
        setFrame(screen.frame, display: false)
        contentView?.subviews.first?.frame = contentView?.bounds ?? .zero
        orderFrontRegardless()
        counts = InputCounts()
        startMonitoring()
    }

    func hide() {
        stopMonitoring()
        orderOut(nil)
        log.notice("""
            Input while shown: \(self.counts.ownMoves) mouse moves to Static, \
            \(self.counts.otherAppMoves) to other apps, \(self.counts.scrolls) scroll events
            """)
    }

    private func startMonitoring() {
        let types: NSEvent.EventTypeMask = [.mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged, .scrollWheel]
        // Events sent to Static's own windows, this panel included. Returning
        // nil keeps them from going any further.
        if let monitor = NSEvent.addLocalMonitorForEvents(matching: types, handler: { [weak self] event in
            MainActor.assumeIsolated { self?.handle(event, toOtherApp: false) }
            return nil
        }) {
            monitors.append(monitor)
        }
        // Events sent to other apps. These are copies; the app still gets them.
        if let monitor = NSEvent.addGlobalMonitorForEvents(matching: types, handler: { [weak self] event in
            MainActor.assumeIsolated { self?.handle(event, toOtherApp: true) }
        }) {
            monitors.append(monitor)
        }
    }

    private func stopMonitoring() {
        monitors.forEach(NSEvent.removeMonitor)
        monitors.removeAll()
    }

    private func handle(_ event: NSEvent, toOtherApp: Bool) {
        guard event.type == .scrollWheel else {
            if toOtherApp { counts.otherAppMoves += 1 } else { counts.ownMoves += 1 }
            onMouseMove(event.deltaX, event.deltaY)
            return
        }
        counts.scrolls += 1
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
