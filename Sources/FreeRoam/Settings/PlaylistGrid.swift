import SwiftUI

/// Every playlist that matches the search, in library order, as a grid of
/// covers. Clicking a tile puts it on the end of the wheel or takes it off.
/// Tiles ask for their logo as they come on screen and drop the request as
/// they leave, so only the covers you can see are read.
struct PlaylistGrid: View {
    let playlists: [Playlist]
    /// Each station's 1-based place on the wheel.
    let slots: [String: Int]
    let logos: [String: CGImage]
    let songCounts: [String: Int]
    let isFull: Bool
    let ringColor: Color
    let toggle: (Playlist) -> Void
    let requestLogo: (String) -> Void
    let cancelLogo: (String) -> Void

    var body: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 96, maximum: 140), spacing: 16, alignment: .top)],
                alignment: .leading,
                spacing: 18
            ) {
                ForEach(playlists) { playlist in
                    let slot = slots[playlist.id]
                    PlaylistTile(
                        playlist: playlist,
                        logo: logos[playlist.id],
                        songCount: songCounts[playlist.id],
                        slot: slot,
                        ringColor: ringColor,
                        toggle: { toggle(playlist) }
                    )
                    .disabled(isFull && slot == nil)
                    .onAppear { requestLogo(playlist.id) }
                    .onDisappear { cancelLogo(playlist.id) }
                }
            }
            .padding(.horizontal, StationPicker.margin)
            .padding(.top, 2)
            .padding(.bottom, 20)
        }
    }
}

/// A playlist's cover, name and song count. A station gets the wheel's
/// accent ring and a badge with a check and its place.
struct PlaylistTile: View {
    let playlist: Playlist
    let logo: CGImage?
    /// Unknown until the playlist's tracks have been read.
    let songCount: Int?
    /// 1-based place on the wheel, nil when it's off.
    let slot: Int?
    let ringColor: Color
    let toggle: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    /// What VoiceOver reads for a tile or a disc, such as "Gym, on the
    /// wheel, slot 3".
    nonisolated static func accessibilityLabel(name: String, slot: Int?) -> String {
        guard let slot else { return "\(name), off the wheel" }
        return "\(name), on the wheel, slot \(slot)"
    }

    nonisolated static func songCountText(_ count: Int) -> String {
        switch count {
        case 0: "No songs"
        case 1: "1 song"
        default: "\(count.formatted()) songs"
        }
    }

    var body: some View {
        Button(action: toggle) {
            VStack(alignment: .leading, spacing: 8) {
                cover
                VStack(alignment: .leading, spacing: 1) {
                    Text(playlist.name)
                        .fontWeight(.medium)
                        .lineLimit(1)
                    // A space until the count is known, so the rows stay level.
                    Text(songCount.map(Self.songCountText) ?? " ")
                        .font(.callout)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
            .contentShape(Rectangle())
            // Greyed out while the wheel is full.
            .saturation(isEnabled ? 1 : 0)
            .opacity(isEnabled ? 1 : 0.45)
        }
        .buttonStyle(PressableStyle())
        .help(isEnabled ? (slot == nil ? "Add to the end of the wheel" : "Take off the wheel") : "The wheel holds 25 stations")
        .accessibilityLabel(Self.accessibilityLabel(name: playlist.name, slot: slot))
        .accessibilityValue(songCount.map(Self.songCountText) ?? "")
        .accessibilityHint(slot == nil ? "Adds it to the end of the wheel" : "Takes it off the wheel")
    }

    private var cover: some View {
        let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)
        return Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay { art }
            .clipShape(shape)
            .overlay {
                if slot == nil {
                    shape.strokeBorder(.primary.opacity(0.08), lineWidth: 1)
                } else {
                    shape.strokeBorder(ringColor, lineWidth: 3)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if let slot {
                    SlotBadge(slot: slot, color: ringColor)
                        .padding(6)
                }
            }
    }

    /// The wheel's logo, or the playlist's initials on a plain tile while
    /// the covers load, or when it has none.
    @ViewBuilder private var art: some View {
        if let logo {
            Image(decorative: logo, scale: 1)
                .resizable()
                .interpolation(.high)
        } else {
            Rectangle()
                .fill(.quaternary)
                .overlay {
                    Text(RadioWheelView.initials(of: playlist.name))
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.secondary)
                }
        }
    }
}

/// ✓ and the station's place, in the wheel's accent colour.
private struct SlotBadge: View {
    let slot: Int
    let color: Color

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "checkmark")
                .font(.system(size: 9, weight: .heavy))
            Text("\(slot)")
                .font(.callout.weight(.semibold))
                .monospacedDigit()
        }
        // Dark on the light accent reads better than white.
        .foregroundStyle(.black)
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(color, in: Capsule())
    }
}

/// Shrinks a little while pressed, so a click feels taken.
private struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
