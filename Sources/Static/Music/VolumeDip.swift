import OSLog

private let log = Logger(subsystem: "com.happys1ngh.static", category: "music")

/// Lowers Music's volume while the wheel is open, as GTA quietens the radio,
/// and brings it back afterwards, over the same times as the screen filter
/// fades. Nothing happens while Music isn't running.
@MainActor
final class VolumeDip {
    /// Music drops a volume change that comes within about 100 ms of the last
    /// one it took: measured while paused, a change 90 ms later was dropped
    /// and one 100 ms later stuck. A ramp of 16 ms steps kept only its first.
    private static let changeGap = Duration.milliseconds(150)

    /// The lowered volume as a fraction of the volume before.
    private let fraction: Double
    private let lowerSeconds: Double
    private let restoreSeconds: Double
    /// Music's volume before the dip, while it's lowered or on its way back.
    private var before: Int?
    /// The volume Static last set.
    private var level = 0
    private var lastChange: ContinuousClock.Instant?
    /// Each ramp waits for the one it replaces, whose last change may still be
    /// on its way to Music, so the gap between changes holds across ramps too.
    private var ramp: Task<Void, Never>?
    private let clock = ContinuousClock()

    init(fraction: Double, lowerSeconds: Double, restoreSeconds: Double) {
        self.fraction = fraction
        self.lowerSeconds = lowerSeconds
        self.restoreSeconds = restoreSeconds
    }

    func lower() {
        let previous = ramp
        previous?.cancel()
        ramp = Task {
            await previous?.value
            guard !Task.isCancelled else { return }
            // Opened again while the volume was still coming back up.
            if let before {
                await rampVolume(to: lowered(before), over: lowerSeconds)
                return
            }
            guard MusicBridge.isRunning else { return }
            let volume: Int
            do {
                volume = try await MusicBridge.volume()
            } catch {
                log.error("Couldn't read Music's volume: \(String(describing: error), privacy: .public)")
                return
            }
            // Closed before Music answered.
            guard !Task.isCancelled else { return }
            before = volume
            level = volume
            await rampVolume(to: lowered(volume), over: lowerSeconds)
        }
    }

    func restore() {
        let previous = ramp
        previous?.cancel()
        ramp = Task {
            await previous?.value
            guard !Task.isCancelled, let before else { return }
            await rampVolume(to: before, over: restoreSeconds)
            guard !Task.isCancelled else { return }
            self.before = nil
        }
    }

    /// Puts the volume straight back, for when Static is quitting and there's
    /// no time to ramp.
    func restoreNow() {
        ramp?.cancel()
        guard let before, MusicBridge.isRunning else { return }
        do {
            try MusicBridge.setVolumeNow(before, after: Self.changeGap)
            self.before = nil
            log.notice("Restored Music's volume to \(before) on quit")
        } catch {
            log.error("Couldn't restore Music's volume on quit: \(String(describing: error), privacy: .public)")
        }
    }

    private func lowered(_ volume: Int) -> Int {
        Int((Double(volume) * fraction).rounded())
    }

    /// Steps as often as Music takes changes, and each step goes where the
    /// ramp should be by the next one. So the 150 ms dip is a single change and
    /// the 450 ms restore takes three, 150 ms apart.
    private func rampVolume(to target: Int, over seconds: Double) async {
        let start = level
        let started = clock.now
        while !Task.isCancelled, MusicBridge.isRunning {
            if let lastChange {
                do {
                    try await Task.sleep(until: lastChange + Self.changeGap, clock: clock)
                } catch {
                    return
                }
            }
            let progress = seconds > 0 ? min((clock.now - started + Self.changeGap) / .seconds(seconds), 1) : 1
            let next = start + Int((Double(target - start) * progress).rounded())
            if next != level {
                do {
                    try await MusicBridge.setVolume(next)
                } catch {
                    // A change that timed out still reaches Music once it
                    // answers again, so it counts as made and a restore
                    // undoes it, instead of leaving Music quiet.
                    if case MusicBridgeError.script(errAETimeout, _) = error { level = next }
                    log.error("Couldn't set Music's volume: \(String(describing: error), privacy: .public)")
                    return
                }
                // Timed from when Music has answered, not from when the change
                // was sent. Behind a tune's commands, a change reached Music
                // late, and the next one sent 150 ms after it was dropped.
                lastChange = clock.now
                level = next
            }
            if progress >= 1 {
                log.notice("Music's volume is \(target)")
                return
            }
            // Small changes can round to no step at all for a while.
            try? await Task.sleep(for: .milliseconds(16))
        }
    }
}
