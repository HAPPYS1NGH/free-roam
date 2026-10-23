import Foundation

/// Every station behaves as if it has played its playlist on a loop since
/// 2026-01-01 UTC. Tuning in plays the track that's on air and sets Music's
/// `player position` partway into it, so it lands mid-song like real radio,
/// and the wheel can show what's on before you tune in. Ported from
/// `prototype/src/broadcast.ts`.
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
        onAir(durations: durations, elapsed: date.timeIntervalSince(epoch))
    }

    /// What's on at `date` for a player that was at `start` at `then` and
    /// played on in order, looping, as Music does once a skip or a pause in
    /// Music has moved it off the clock. Nil when `start` isn't in the
    /// playlist or the playlist has no playable length.
    static func onAir(durations: [TimeInterval], at date: Date, from start: OnAir, at then: Date) -> OnAir? {
        guard durations.indices.contains(start.index) else { return nil }
        let startOffset = durations[..<start.index].reduce(0, +) + start.position
        return onAir(durations: durations, elapsed: startOffset + date.timeIntervalSince(then))
    }

    /// `elapsed` seconds into the playlist, looping.
    private static func onAir(durations: [TimeInterval], elapsed: TimeInterval) -> OnAir? {
        let total = durations.reduce(0, +)
        guard total > 0 else { return nil }
        var offset = elapsed - (elapsed / total).rounded(.down) * total
        for (index, duration) in durations.enumerated() {
            if offset < duration { return OnAir(index: index, position: offset) }
            offset -= duration
        }
        // Rounding can leave the offset a hair past the last track.
        return OnAir(index: 0, position: 0)
    }
}
