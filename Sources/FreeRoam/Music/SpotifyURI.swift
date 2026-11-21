import Foundation

/// Spotify IDs and URIs are checked before they go into a script, so a link
/// or a saved track can't inject AppleScript, the way `MusicBridge` checks
/// persistent IDs.
enum SpotifyURI {
    /// Playlist, track and album IDs are 22 base62 characters.
    static func isBaseID(_ id: String) -> Bool {
        id.wholeMatch(of: /[0-9A-Za-z]{22}/) != nil
    }

    static func playlist(_ id: String) -> String {
        "spotify:playlist:\(id)"
    }

    /// A track Free Roam can play from a playlist: a Spotify track, or a
    /// local file, whose URI is `spotify:local:artist:album:title:seconds`
    /// with each part percent-encoded.
    static func isPlayableTrack(_ uri: String) -> Bool {
        if let id = uri.wholeMatch(of: /spotify:track:([0-9A-Za-z]{22})/)?.1 {
            return isBaseID(String(id))
        }
        return uri.wholeMatch(of: /spotify:local:[A-Za-z0-9%+_.~-]*:[A-Za-z0-9%+_.~-]*:[A-Za-z0-9%+_.~-]*:[0-9]*/) != nil
    }

    /// What Spotify plays between tracks on a free account.
    static func isAd(_ uri: String) -> Bool {
        uri.hasPrefix("spotify:ad:")
    }

    /// Track covers come from Spotify's image host and nowhere else.
    static func isTrustedArtwork(_ url: URL) -> Bool {
        url.scheme == "https" && url.host() == "i.scdn.co"
    }

    /// The playlist ID in an `open.spotify.com/playlist/…` link, with or
    /// without a scheme or an `intl-xx` language part, or in a
    /// `spotify:playlist:…` URI. Nil for anything else.
    static func playlistID(fromLink link: String) -> String? {
        let text = link.trimmingCharacters(in: .whitespacesAndNewlines)
        if let id = text.wholeMatch(of: /spotify:playlist:([0-9A-Za-z]{22})/)?.1 {
            return String(id)
        }
        let withScheme = text.contains("://") ? text : "https://\(text)"
        guard let components = URLComponents(string: withScheme),
              components.scheme == "https" || components.scheme == "http",
              components.host == "open.spotify.com"
        else { return nil }
        var parts = components.path.split(separator: "/").map(String.init)
        if parts.first?.wholeMatch(of: /intl-[A-Za-z]{2,3}(-[A-Za-z]+)?/) != nil { parts.removeFirst() }
        guard parts.count == 2, parts[0] == "playlist", isBaseID(parts[1]) else { return nil }
        return parts[1]
    }
}
