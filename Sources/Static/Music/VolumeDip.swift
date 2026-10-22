import OSLog

private let log = Logger(subsystem: "com.happys1ngh.static", category: "music")

/// Lowers Music's volume while the wheel is open, as GTA quietens the radio,
/// and brings it back afterwards. It ramps rather than jumps, over the same
/// times as the screen filter fades. Setting the volume would launch Music, so
/// nothing happens while it isn't running.
@MainActor
final class VolumeDip {
    /// The lowered volume as a fraction of the volume before.
    private let fraction: Double
    private let lowerSeconds: Double
    private let restoreSeconds: Double
    /// Music's volume before the dip, while it's lowered or on its way back.
    private var before: Int?
    /// The volume Static last set.
    private var level = 0
    private var ramp: Task<Void, Never>?

    init(fraction: Double, lowerSeconds: Double, restoreSeconds: Double) {
        self.fraction = fraction
        self.lowerSeconds = lowerSeconds
        self.restoreSeconds = restoreSeconds
    }

    func lower() {
        ramp?.cancel()
        // Opened again while the volume was still coming back up.
        if let before {
            ramp = Task { await rampVolume(to: lowered(before), over: lowerSeconds) }
            return
        }
        guard MusicBridge.isRunning else { return }
        ramp = Task {
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
        ramp?.cancel()
        guard let before else { return }
        ramp = Task {
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
            try MusicBridge.setVolumeNow(before)
            self.before = nil
            log.notice("Restored Music's volume to \(before) on quit")
        } catch {
            log.error("Couldn't restore Music's volume on quit: \(String(describing: error), privacy: .public)")
        }
    }

    private func lowered(_ volume: Int) -> Int {
        Int((Double(volume) * fraction).rounded())
    }

    /// Steps by time rather than by count, so slow Apple Events shorten the
    /// steps instead of stretching the ramp.
    private func rampVolume(to target: Int, over seconds: Double) async {
        let start = level
        let clock = ContinuousClock()
        let started = clock.now
        while !Task.isCancelled, MusicBridge.isRunning {
            let progress = seconds > 0 ? min((clock.now - started) / .seconds(seconds), 1) : 1
            let next = start + Int((Double(target - start) * progress).rounded())
            if next != level {
                do {
                    try await MusicBridge.setVolume(next)
                } catch {
                    log.error("Couldn't set Music's volume: \(String(describing: error), privacy: .public)")
                    return
                }
                level = next
            }
            if progress >= 1 {
                await hold(target)
                return
            }
            try? await Task.sleep(for: .milliseconds(16))
        }
    }

    /// Music sometimes ends a ramp at one of the steps before the last, so a
    /// restore to 97 read back as 81, and the next dip took 81 as the volume
    /// before. Checking soon after the ramp and again a second later, when a
    /// track tuned during the ramp has started, sets it again if it slipped.
    private func hold(_ target: Int) async {
        for delay in [250, 1000] {
            try? await Task.sleep(for: .milliseconds(delay))
            guard !Task.isCancelled, MusicBridge.isRunning else { return }
            do {
                let volume = try await MusicBridge.volume()
                guard volume != target else { continue }
                log.notice("Music's volume slipped to \(volume), so setting \(target) again")
                try await MusicBridge.setVolume(target)
                level = target
            } catch {
                log.error("Couldn't check Music's volume: \(String(describing: error), privacy: .public)")
                return
            }
        }
        log.notice("Music's volume is \(target)")
    }
}
