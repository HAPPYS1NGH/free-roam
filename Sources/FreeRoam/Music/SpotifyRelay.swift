import Foundation
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

/// Spotify's command-line tool plays a song without bringing Spotify
/// forward, but only on its own, not partway into a playlist. So a station
/// plays its song on air and keeps the next one in Spotify's queue: when a
/// song starts, this hears Spotify's `PlaybackStateChanged` notification and
/// queues the one after it, so the station plays its playlist in order.
///
/// It only works while Free Roam is running. Without it, Spotify stops after
/// the song queued last, and the next tune lines the station up with its
/// clock again.
@MainActor
final class SpotifyRelay {
    struct Airing: Equatable {
        let playlistID: String
        /// Zero-based index into `uris`.
        var index: Int
        /// The station's songs in order, as they were when it was tuned.
        let uris: [String]
        /// New for each tune, so a queued song for a replaced tune is dropped.
        let tune: UUID

        var nextIndex: Int { (index + 1) % uris.count }
    }

    enum Event: Equatable {
        /// The song queued last has started.
        case advanced
        /// Spotify is playing something the station didn't queue, such as
        /// a song you picked in Spotify.
        case otherTrack
        /// The song on air started again, and it's also the next one, as on
        /// a one-song station. That's either its queued copy starting or a
        /// resume after a pause, which only the queue tells apart.
        case sameSongAgain
        case ignored
    }

    static let shared = SpotifyRelay()

    /// The station being relayed, or nil while none is.
    private(set) var airing: Airing?

    private init() {
        DistributedNotificationCenter.default().addObserver(
            forName: Notification.Name("com.spotify.client.PlaybackStateChanged"), object: nil, queue: .main
        ) { [weak self] notification in
            let state = notification.userInfo?["Player State"] as? String
            let trackID = notification.userInfo?["Track ID"] as? String
            MainActor.assumeIsolated { self?.receive(state: state, trackID: trackID) }
        }
    }

    /// Spotify is playing song `index` of the station, so the next one is queued.
    func air(playlistID: String, index: Int, uris: [String]) {
        guard uris.indices.contains(index) else { return }
        let airing = Airing(playlistID: playlistID, index: index, uris: uris, tune: UUID())
        self.airing = airing
        queueNext(after: airing)
    }

    func stop() {
        airing = nil
    }

    private func receive(state: String?, trackID: String?) {
        guard MusicApp.current == .spotify, let airing else { return }
        switch Self.event(state: state, trackID: trackID, airing: airing) {
        case .advanced:
            advance(from: airing)
        case .sameSongAgain:
            advanceIfQueuedCopyStarted(airing)
        case .otherTrack:
            self.airing = nil
            log.notice("Spotify is playing a song Free Roam didn't queue, so the station stops following its clock")
        case .ignored:
            break
        }
    }

    /// Measured on Spotify 1.3.10: each new song posts Playing with its
    /// URI, and a pause posts Paused with the same one. Ads play between
    /// songs on a free account, and the queued song follows them.
    nonisolated static func event(state: String?, trackID: String?, airing: Airing) -> Event {
        guard state == "Playing", let trackID, !trackID.hasPrefix("spotify:ad:") else { return .ignored }
        let next = airing.uris[airing.nextIndex]
        if trackID == airing.uris[airing.index] { return trackID == next ? .sameSongAgain : .ignored }
        return trackID == next ? .advanced : .otherTrack
    }

    private func advance(from airing: Airing) {
        var next = airing
        next.index = airing.nextIndex
        self.airing = next
        log.notice("Spotify moved on to song \(next.index + 1) of \(next.uris.count) in playlist \(next.playlistID, privacy: .public)")
        queueNext(after: next)
    }

    /// The queued copy leaves the queue once it starts, and stays there
    /// through a pause and resume. A station never goes quiet, so a copy
    /// that never made it into the queue counts as started and is queued again.
    private func advanceIfQueuedCopyStarted(_ airing: Airing) {
        let next = airing.uris[airing.nextIndex]
        Task { [weak self] in
            do {
                let queue = try await SpotifyCLI.decode(SpotifyCLI.Queue.self, ["queue", "list"], lane: .player)
                guard let self, self.airing == airing, !SpotifyCLI.isQueued(next, in: queue) else { return }
                self.advance(from: airing)
            } catch {
                log.error("Couldn't read Spotify's queue: \(String(describing: error), privacy: .public)")
            }
        }
    }

    private func queueNext(after airing: Airing) {
        let next = airing.uris[airing.nextIndex]
        Task { [weak self] in
            // A newer tune has cleared the queue for its own songs.
            guard self?.airing?.tune == airing.tune else { return }
            do {
                try await SpotifyCLI.enqueue(next)
            } catch {
                log.error("Couldn't queue the station's next song: \(String(describing: error), privacy: .public)")
            }
        }
    }
}
