import Foundation
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "music")

/// Music only says whether Free Roam may control it while it's running, so
/// its last answer is kept for when it isn't, as for the welcome window at a
/// launch with Music closed. `MusicBridge` records every answer that turns
/// up: each permission check, including the menu's, each script Music ran,
/// and each one it refused.
enum MusicPermissionMemory {
    /// Each app has its own answer. Music's key stays the one it always was.
    private static func key(for app: MusicApp) -> String {
        switch app {
        case .music: "musicControlAllowed"
        case .spotify: "spotifyControlAllowed"
        }
    }

    static func lastAnswer(for app: MusicApp = .music, in defaults: UserDefaults = .standard) -> Bool {
        defaults.bool(forKey: key(for: app))
    }

    /// Ignores a check that couldn't reach Music.
    static func record(_ permission: MusicPermission, for app: MusicApp = .music, in defaults: UserDefaults = .standard) {
        guard let allowed = permission.isAllowed else { return }
        record(allowed: allowed, for: app, in: defaults)
    }

    static func record(allowed: Bool, for app: MusicApp = .music, in defaults: UserDefaults = .standard) {
        let key = key(for: app)
        // Every script lands here, so it only writes a change.
        guard defaults.object(forKey: key) as? Bool != allowed else { return }
        defaults.set(allowed, forKey: key)
        log.notice("\(app.name, privacy: .public) now says Free Roam \(allowed ? "may" : "may not", privacy: .public) control it")
    }
}
