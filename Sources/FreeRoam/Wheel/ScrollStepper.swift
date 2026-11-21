import Foundation

/// Scrolling moves one station per `step` points but never more than one per
/// event, so a mouse-wheel notch is one station however hard macOS
/// accelerates it and a trackpad flick tops out at one per event. The first
/// event of a gesture steps straight away, so a slow notch moves exactly one
/// station. Ported from `onWheel` in `site/src/useWheel.ts`.
struct ScrollStepper {
    /// A pause this long between events starts a new gesture.
    static let gestureGap: TimeInterval = 0.12

    let step: Double
    private var distance = 0.0
    private var lastEvent = -TimeInterval.infinity

    init(step: Double) {
        self.step = step
    }

    /// Takes the distance scrolled in points, positive for clockwise, and the
    /// event's time in seconds. Returns 1 or -1 to move a station that way.
    mutating func scroll(by delta: Double, at time: TimeInterval) -> Int? {
        guard delta != 0 else { return nil }
        let newGesture = time - lastEvent > Self.gestureGap
        lastEvent = time
        if newGesture {
            distance = 0
            return delta > 0 ? 1 : -1
        }
        // Reversing mid-swipe responds at once instead of first unwinding.
        if (delta > 0) != (distance > 0) { distance = 0 }
        distance += delta
        guard abs(distance) >= step else { return nil }
        let direction = distance > 0 ? 1 : -1
        // Drop whole steps beyond the first. Several stations in one event
        // would jump the highlight past them in a single frame.
        distance = distance.truncatingRemainder(dividingBy: step)
        return direction
    }
}
