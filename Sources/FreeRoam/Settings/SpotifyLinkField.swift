import SwiftUI

/// Where a Spotify playlist is added: paste its link and press Return, or
/// drop it here. While Free Roam tunes it, the field says so, because
/// Spotify is muted and can't be used until it's done.
struct SpotifyLinkField: View {
    @Binding var link: String
    let tuning: SpotifyLibrary.Tuning?
    let isAdding: Bool
    let errorMessage: String?
    let add: () -> Void

    /// "Tuning Today's Top Hits · 34 songs. Spotify is muted until it's
    /// done." The count joins in once the first songs are found.
    nonisolated static func tuningText(_ tuning: SpotifyLibrary.Tuning?) -> String {
        let muted = "Spotify is muted until it's done."
        guard let tuning else { return "Reading the playlist. \(muted)" }
        guard tuning.tracksFound > 0 else { return "Tuning \(tuning.name). \(muted)" }
        return "Tuning \(tuning.name) · \(PlaylistTile.songCountText(tuning.tracksFound)). \(muted)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                TextField("Paste a Spotify playlist link", text: $link)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 360)
                    .disabled(isAdding)
                    .onSubmit(add)
                if isAdding {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            if isAdding {
                Text(Self.tuningText(tuning))
                    .font(.callout)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            } else if let errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
