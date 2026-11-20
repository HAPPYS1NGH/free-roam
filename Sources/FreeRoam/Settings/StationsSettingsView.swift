import AppKit
import SwiftUI

/// Settings' only pane: the stations on the wheel, in order, above every
/// playlist in Music as a grid of covers. Every change is saved at once, as
/// in System Settings.
struct StationsSettingsView: View {
    let stations: StationList
    let details: StationDetails
    let style: WheelStyle?
    @State private var search = ""

    var body: some View {
        StationPicker(
            phase: phase,
            library: stations.library ?? [],
            stations: stations.library == nil ? [] : stations.onWheel,
            missingStationCount: stations.missingStationCount,
            logos: details.logos,
            songCounts: details.songCounts,
            search: $search,
            ringColor: RingColor.resolve(brand: style?.colors.ringColor),
            rim: style?.sizes.rim ?? StationPicker.defaultRim,
            setOn: stations.setOn,
            move: stations.moveStation,
            removeMissing: stations.removeMissingStations,
            requestLogo: details.requestLogo,
            cancelLogo: details.cancelLogo,
            retry: stations.loadLaunchingMusic
        )
        // Listing every playlist needs Music, so it opens in the background.
        .onAppear { stations.loadLaunchingMusic() }
        // A closed window reads no more covers and lets go of the ones that
        // aren't stations. The window closing is the sure sign, and leaving
        // the window covers anything else that takes the pane away.
        .onDisappear { details.settingsClosed() }
        .background(WindowCloseObserver { details.settingsClosed() })
    }

    private var phase: StationPicker.Phase {
        if stations.library != nil { return .ready }
        guard let error = stations.loadError else { return .loading }
        if case MusicBridgeError.notPermitted = error { return .denied }
        return .failed(error.localizedDescription)
    }
}

/// The stations pane drawn from plain values, so a test can render each state.
struct StationPicker: View {
    enum Phase: Equatable {
        case loading
        /// Free Roam isn't allowed to control Music.
        case denied
        case failed(String)
        case ready
    }

    /// The black rim round a disc's art, as a fraction of the disc, for when
    /// tokens.json didn't load.
    nonisolated static let defaultRim = 0.05
    /// Narrow enough for a small laptop, wide enough for all 25 discs to fit
    /// in two rows, and for six covers a row in the grid.
    nonisolated static let minWidth = 760.0
    nonisolated static let margin = 20.0

    let phase: Phase
    /// Music's playlists in library order.
    let library: [Playlist]
    /// The stations on the wheel, in order.
    let stations: [Playlist]
    /// Stations Music didn't list, which still hold their places.
    var missingStationCount = 0
    let logos: [String: CGImage]
    let songCounts: [String: Int]
    @Binding var search: String
    var ringColor = Color.accentColor
    var rim = defaultRim
    var setOn: (Bool, String) -> Void = { _, _ in }
    var move: (String, Int) -> Void = { _, _ in }
    var removeMissing: () -> Void = {}
    var requestLogo: (String) -> Void = { _ in }
    var cancelLogo: (String) -> Void = { _ in }
    var retry: () -> Void = {}

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, Self.margin)
                .padding(.top, Self.margin)
                .padding(.bottom, 12)
            // Each state fills the rest of the window. Left to its own size, a
            // ContentUnavailableView sat in the top left corner.
            switch phase {
            case .loading:
                ProgressView("Loading your playlists from Music…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .denied:
                denied
            case .failed(let message):
                ContentUnavailableView {
                    Label("Couldn't Load Your Playlists", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try Again", action: retry)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .ready where library.isEmpty:
                ContentUnavailableView {
                    Label("No Playlists in Music", systemImage: "music.note.list")
                } description: {
                    Text("Your stations are Music playlists. Make one in Music, then check again.")
                } actions: {
                    Button("Check Again", action: retry)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .ready:
                picker
            }
        }
        .frame(minWidth: Self.minWidth, idealWidth: Self.minWidth, maxWidth: .infinity, minHeight: 480, idealHeight: 600, maxHeight: .infinity, alignment: .top)
    }

    private var isFull: Bool {
        stations.count + missingStationCount >= RadioWheelModel.maxStations
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Stations")
                .font(.title2.weight(.semibold))
            Spacer()
            if phase == .ready, !library.isEmpty {
                Text(Self.countText(stations: stations.count, missing: missingStationCount))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                if missingStationCount > 0 {
                    Button("Remove", action: { animated(removeMissing) })
                        .buttonStyle(.link)
                        .help("Music didn't list these playlists. If you deleted them, remove them to free their places.")
                        .accessibilityLabel("Remove the stations not found in Music")
                }
            }
        }
    }

    /// "23 of 25 on the wheel · 2 not found in Music". Missing stations
    /// count toward the 25, because they come back in their places.
    nonisolated static func countText(stations: Int, missing: Int) -> String {
        let onWheel = "\(stations) of \(RadioWheelModel.maxStations) on the wheel"
        return missing > 0 ? "\(onWheel) · \(missing) not found in Music" : onWheel
    }

    private var denied: some View {
        ContentUnavailableView {
            Label("Free Roam Can't Control Music", systemImage: "music.note")
        } description: {
            Text("Free Roam needs to control Music to list your playlists. Switch it on in Privacy & Security under Automation, then try again.")
        } actions: {
            Button("Open Privacy & Security…") { PrivacyPane.automation.open() }
                .keyboardShortcut(.defaultAction)
            Button("Try Again", action: retry)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var picker: some View {
        let matches = StationList.matching(search, in: library)
        let slots = Dictionary(stations.enumerated().map { ($1.id, $0 + 1) }, uniquingKeysWith: { first, _ in first })
        return VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text("On the wheel · drag to reorder")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                WheelStrip(
                    stations: stations,
                    logos: logos,
                    ringColor: ringColor,
                    rim: rim,
                    remove: { id in animated { setOn(false, id) } },
                    move: { id, index in animated { move(id, index) } },
                    requestLogo: requestLogo,
                    cancelLogo: cancelLogo
                )
            }
            .padding(.horizontal, Self.margin)
            .padding(.bottom, 16)

            Divider()

            HStack(spacing: 12) {
                SearchField(text: $search, prompt: "Search playlists")
                    .frame(maxWidth: 260)
                Spacer(minLength: 0)
                if isFull {
                    Text("The wheel holds 25. Remove a station to add another.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.trailing)
                }
            }
            .padding(.horizontal, Self.margin)
            .padding(.vertical, 12)

            if matches.isEmpty {
                ContentUnavailableView.search(text: search)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                PlaylistGrid(
                    playlists: matches,
                    slots: slots,
                    logos: logos,
                    songCounts: songCounts,
                    isFull: isFull,
                    ringColor: ringColor,
                    toggle: { playlist in animated { setOn(slots[playlist.id] == nil, playlist.id) } },
                    requestLogo: requestLogo,
                    cancelLogo: cancelLogo
                )
            }
        }
    }

    private func animated(_ change: () -> Void) {
        withAnimation(reduceMotion ? nil : .snappy(duration: 0.25), change)
    }
}

/// Calls `onClose` when the window holding it closes.
private struct WindowCloseObserver: NSViewRepresentable {
    let onClose: () -> Void

    func makeNSView(context: Context) -> ObservingView {
        ObservingView()
    }

    func updateNSView(_ view: ObservingView, context: Context) {
        view.onClose = onClose
    }

    final class ObservingView: NSView {
        var onClose: () -> Void = {}
        private var observer: (any NSObjectProtocol)?

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            if let observer { NotificationCenter.default.removeObserver(observer) }
            observer = nil
            guard let window else { return }
            observer = NotificationCenter.default.addObserver(
                forName: NSWindow.willCloseNotification, object: window, queue: .main
            ) { [weak self] _ in
                MainActor.assumeIsolated { self?.onClose() }
            }
        }
    }
}
