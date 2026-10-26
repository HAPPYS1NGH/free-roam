import CoreGraphics

/// Hands each press's still to the open it was captured for. A capture that
/// lands before its open waits here instead of going straight on screen,
/// where the last close may still be fading out: that fade clears what's
/// shown when it ends, and its panel may be on another display.
struct StillHandoff {
    /// What the backdrop shows.
    private(set) var shown: CGImage?
    private var waiting: CGImage?

    /// Nil when the capture failed. While the wheel is open, the capture
    /// is this open's and goes straight on.
    mutating func land(_ image: CGImage?, whileOpen: Bool) {
        if whileOpen {
            shown = image
        } else {
            waiting = image
        }
    }

    /// Shows the latest press's capture, or nothing until it lands.
    mutating func open() {
        shown = waiting
        waiting = nil
    }

    /// For a tap, which never opens, or a capture of another display.
    mutating func discardWaiting() {
        waiting = nil
    }

    mutating func fadedOut() {
        shown = nil
    }
}
