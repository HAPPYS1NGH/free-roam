import Foundation
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

/// Music can only start a playlist partway through by playing one of its
/// tracks, and then it queues that track alone. So while a station is on,
/// this listens for Music's `com.apple.Music.playerInfo` notification, which
/// Music posts on every change of track or state, and says when the track
/// has ended so the station's next one can play. It sleeps between
/// notifications, about one a song, so it costs nothing in between.
///
/// It only works while Free Roam is running. Without it, Music stops at the
/// end of the track, and the next tune lines the station up with its clock
/// again.
@MainActor
final class OnAirRelay {
    struct Airing: Equatable {
        let playlistID: String
        /// Zero-based index into the playlist's tracks.
        let index: Int
        /// Music's persistent ID of the track, 16 hex digits.
        let trackID: String
    }

    enum Event: Equatable {
        /// Music finished the track, or was stopped.
        case ended
        /// Music is playing a track Free Roam didn't pick, such as one you
        /// chose in Music.
        case otherTrack
        case ignored
    }

    /// The track Free Roam last started for a station. Nil while nothing
    /// should follow it: Radio Off, a tune on its way, a station on the
    /// shuffle fallback, or after you've picked something else in Music.
    var airing: Airing?
    var onTrackEnded: ((Airing) -> Void)?

    init() {
        DistributedNotificationCenter.default().addObserver(
            forName: Notification.Name("com.apple.Music.playerInfo"), object: nil, queue: .main
        ) { [weak self] notification in
            let state = notification.userInfo?["Player State"] as? String
            let persistentID = (notification.userInfo?["PersistentID"] as? NSNumber)?.int64Value
            MainActor.assumeIsolated { self?.receive(state: state, persistentID: persistentID) }
        }
    }

    private func receive(state: String?, persistentID: Int64?) {
        guard let airing else { return }
        switch Self.event(state: state, persistentID: persistentID, airing: airing.trackID) {
        case .ended:
            // Music posts Stopped twice at the end of a track.
            self.airing = nil
            onTrackEnded?(airing)
        case .otherTrack:
            self.airing = nil
            log.notice("Music is playing a track Free Roam didn't pick, so the station stops following its clock")
        case .ignored:
            break
        }
    }

    /// Measured on Music 1.7.2: a track that ends posts Paused and then
    /// Stopped with no track, and a pause in Music posts Paused with the
    /// track. A seek posts Playing with the same track.
    nonisolated static func event(state: String?, persistentID: Int64?, airing trackID: String) -> Event {
        switch state {
        case "Stopped":
            return .ended
        case "Playing":
            guard let persistentID else { return .ignored }
            return hexID(persistentID) == trackID.uppercased() ? .ignored : .otherTrack
        default:
            return .ignored
        }
    }

    /// The notification gives the persistent ID as a signed 64-bit number,
    /// and scripts give it as 16 hex digits.
    nonisolated static func hexID(_ persistentID: Int64) -> String {
        let hex = String(UInt64(bitPattern: persistentID), radix: 16, uppercase: true)
        return String(repeating: "0", count: max(16 - hex.count, 0)) + hex
    }
}
