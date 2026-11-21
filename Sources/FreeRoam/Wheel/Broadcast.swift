import Foundation

/// Every station behaves as if it has played its playlist in order, on a
/// loop, since 2026-01-01 UTC. Tuning in plays the track that's on air
/// partway in, so it lands mid-song like real radio, and the wheel can show
/// what's on before you tune in. Ported from `site/src/broadcast.ts`.
enum Broadcast {
    static let epoch = Date(timeIntervalSince1970: 1_767_225_600)

    struct OnAir: Equatable {
        /// Zero-based index into the playlist's tracks.
        let index: Int
        /// Seconds into that track.
        let position: TimeInterval
    }

    /// Nil when the playlist has no playable length.
    static func onAir(durations: [TimeInterval], at date: Date) -> OnAir? {
        let total = durations.reduce(0, +)
        guard total > 0 else { return nil }
        let elapsed = date.timeIntervalSince(epoch)
        var offset = elapsed - (elapsed / total).rounded(.down) * total
        for (index, duration) in durations.enumerated() {
            if offset < duration { return OnAir(index: index, position: offset) }
            offset -= duration
        }
        // Rounding can leave the offset a hair past the last track.
        return firstPlayable(in: durations).map { OnAir(index: $0, position: 0) }
    }

    /// The track after `index` that has a length, going round to the top.
    /// Nil when no track has one.
    static func next(after index: Int, durations: [TimeInterval]) -> Int? {
        guard !durations.isEmpty else { return nil }
        for step in 1...durations.count {
            let candidate = (index + step) % durations.count
            if durations[candidate] > 0 { return candidate }
        }
        return nil
    }

    private static func firstPlayable(in durations: [TimeInterval]) -> Int? {
        durations.firstIndex { $0 > 0 }
    }
}
