import SwiftUI

/// Settings' only pane: which playlists are on the wheel, and in what order.
/// Every change is saved at once, as in System Settings.
struct StationsSettingsView: View {
    let stations: StationList

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Stations run clockwise from Radio Off, in this order. Drag a playlist to move it.")
                .foregroundStyle(.secondary)
            content
        }
        .padding(20)
        .frame(width: 420, height: 520)
        // Listing every playlist needs Music, so it opens in the background.
        .onAppear { stations.loadLaunchingMusic() }
    }

    @ViewBuilder private var content: some View {
        if let library = stations.library {
            if library.isEmpty { placeholder("Music has no playlists yet.") } else { playlists }
        } else if let error = stations.loadError {
            placeholder(error)
        } else {
            placeholder("Loading your playlists from Music…", loading: true)
        }
    }

    private var playlists: some View {
        let entries = stations.entries
        let onWheel = entries.count(where: \.isOn)
        let full = onWheel >= RadioWheelModel.maxStations
        return VStack(alignment: .leading, spacing: 8) {
            List {
                ForEach(entries) { entry in
                    Toggle(entry.name, isOn: Binding(
                        get: { entry.isOn },
                        set: { stations.setOn($0, id: entry.id) }
                    ))
                    .toggleStyle(.checkbox)
                    // The wheel holds 25 stations.
                    .disabled(full && !entry.isOn)
                }
                .onMove { stations.move(fromOffsets: $0, toOffset: $1) }
            }
            Text("\(onWheel) of \(RadioWheelModel.maxStations) stations on the wheel")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
    }

    private func placeholder(_ text: String, loading: Bool = false) -> some View {
        VStack(spacing: 8) {
            if loading { ProgressView().controlSize(.small) }
            Text(text).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
