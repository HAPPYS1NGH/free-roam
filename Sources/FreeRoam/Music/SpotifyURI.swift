import Foundation

/// Spotify IDs and URIs are checked before they go into a script or a
/// command, so a saved track can't inject AppleScript, the way
/// `MusicBridge` checks persistent IDs.
enum SpotifyURI {
    /// Playlist, track and album IDs are 22 base62 characters.
    static func isBaseID(_ id: String) -> Bool {
        id.wholeMatch(of: /[0-9A-Za-z]{22}/) != nil
    }

    static func playlist(_ id: String) -> String {
        "spotify:playlist:\(id)"
    }

    /// `spotify:track:<22 base62>`, the only kind of song a station plays.
    static func isTrack(_ uri: String) -> Bool {
        uri.wholeMatch(of: /spotify:track:[0-9A-Za-z]{22}/) != nil
    }

    /// Track covers come from Spotify's image host and nowhere else.
    static func isTrustedArtwork(_ url: URL) -> Bool {
        url.scheme == "https" && url.host() == "i.scdn.co"
    }
}
