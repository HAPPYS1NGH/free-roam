import AppKit
import SwiftUI

/// Settings' only pane: the stations on the wheel, in order, above every
/// playlist in the app as a grid of covers. Every change is saved at once, as
/// in System Settings.
struct StationsSettingsView: View {
    let stations: StationList
    let details: StationDetails
    let style: WheelStyle?
    let selectApp: (MusicApp) -> Void
    @State private var search = ""
    @State private var link = ""
    @State private var isAdding = false
    @State private var addError: String?

    var body: some View {
        StationPicker(
            app: stations.app,
            selectApp: selectApp,
            tuning: SpotifyLibrary.shared.tuning,
            link: $link,
            isAdding: isAdding,
            addError: addError,
            addLink: addLink,
            retune: retune,
            removeFromLibrary: removeFromLibrary,
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
            reload: stations.loadLaunchingMusic
        )
        // Listing every playlist needs Music, so it opens in the background.
        .onAppear { stations.loadLaunchingMusic() }
        .onChange(of: stations.app) { stations.loadLaunchingMusic() }
        // A closed window reads no more covers and lets go of the ones that
        // aren't stations. The window closing is the sure sign, and leaving
        // the window covers anything else that takes the pane away.
        .onDisappear { details.settingsClosed() }
        .background(WindowCloseObserver { details.settingsClosed() })
    }

    /// Reads the pasted or dropped link's playlist, then lists it, so it
    /// joins the wheel like any new playlist.
    private func addLink(_ text: String) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isAdding else { return }
        isAdding = true
        addError = nil
        Task {
            do {
                _ = try await SpotifyLibrary.shared.add(link: text)
                link = ""
                if stations.app == .spotify { stations.reload() }
            } catch {
                addError = error.localizedDescription
            }
            isAdding = false
        }
    }

    private func retune(_ id: String) {
        guard !isAdding else { return }
        addError = nil
        Task {
            do {
                try await SpotifyLibrary.shared.retune(id: id)
                if stations.app == .spotify { stations.reload() }
            } catch {
                addError = error.localizedDescription
            }
        }
    }

    /// Takes it off the wheel first, so it doesn't stay behind as a station
    /// Spotify didn't list.
    private func removeFromLibrary(_ id: String) {
        stations.setOn(false, id: id)
        SpotifyLibrary.shared.remove(id: id)
        stations.reload()
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
        /// Free Roam isn't allowed to control the app.
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

    var app = MusicApp.music
    var selectApp: (MusicApp) -> Void = { _ in }
    /// Spotify only: the playlist being tuned, the link field and what it
    /// says went wrong.
    var tuning: SpotifyLibrary.Tuning?
    @Binding var link: String
    var isAdding = false
    var addError: String?
    var addLink: (String) -> Void = { _ in }
    var retune: (String) -> Void = { _ in }
    var removeFromLibrary: (String) -> Void = { _ in }

    let phase: Phase
    /// The app's playlists in library order.
    let library: [Playlist]
    /// The stations on the wheel, in order.
    let stations: [Playlist]
    /// Stations the app didn't list, which still hold their places.
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
    var reload: () -> Void = {}

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            appSwitch
                .padding(.horizontal, Self.margin)
                .padding(.top, Self.margin)
                .padding(.bottom, 12)
            header
                .padding(.horizontal, Self.margin)
                .padding(.bottom, 12)
            if app == .spotify, phase != .denied {
                SpotifyLinkField(link: $link, tuning: tuning, isAdding: isAdding, errorMessage: addError, add: { addLink(link) })
                    .padding(.horizontal, Self.margin)
                    .padding(.bottom, 12)
            }
            // Each state fills the rest of the window. Left to its own size, a
            // ContentUnavailableView sat in the top left corner.
            switch phase {
            case .loading:
                ProgressView("Loading your playlists from \(app.name)…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .denied:
                denied
            case .failed(let message):
                ContentUnavailableView {
                    Label("Couldn't Load Your Playlists", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try Again", action: reload)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .ready where library.isEmpty && app == .spotify:
                // Spotify can't list its playlists, so there's nothing to check again.
                ContentUnavailableView {
                    Label("No Spotify Playlists Yet", systemImage: "music.note.list")
                } description: {
                    Text("Spotify doesn't let Free Roam list your playlists. Paste a playlist's link above and it becomes a station.")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .ready where library.isEmpty:
                ContentUnavailableView {
                    Label("No Playlists in Music", systemImage: "music.note.list")
                } description: {
                    Text("Your stations are Music playlists. Make one in Music, then check again.")
                } actions: {
                    Button("Check Again", action: reload)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .ready:
                picker
            }
        }
        .frame(minWidth: Self.minWidth, idealWidth: Self.minWidth, maxWidth: .infinity, minHeight: 480, idealHeight: 600, maxHeight: .infinity, alignment: .top)
        // A link dragged from the browser or Spotify arrives as a URL or as text.
        .dropDestination(for: URL.self) { urls, _ in
            guard app == .spotify, let url = urls.first else { return false }
            addLink(url.absoluteString)
            return true
        }
        .dropDestination(for: String.self) { texts, _ in
            guard app == .spotify, let text = texts.first else { return false }
            addLink(text)
            return true
        }
    }

    private var isFull: Bool {
        stations.count + missingStationCount >= RadioWheelModel.maxStations
    }

    private var appSwitch: some View {
        Picker("Play from", selection: Binding(get: { app }, set: { selectApp($0) })) {
            ForEach(MusicApp.allCases, id: \.self) { app in
                Text(app.name).tag(app)
            }
        }
        .pickerStyle(.segmented)
        .fixedSize()
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Stations")
                .font(.title2.weight(.semibold))
            Spacer()
            if phase == .ready, !library.isEmpty {
                Text(Self.countText(stations: stations.count, missing: missingStationCount, app: app))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                if missingStationCount > 0 {
                    Button("Remove", action: { animated(removeMissing) })
                        .buttonStyle(.link)
                        .help("\(app.name) didn't list these playlists. If you deleted them, remove them to free their places.")
                        .accessibilityLabel("Remove the stations not found in \(app.name)")
                }
            }
        }
    }

    /// "23 of 25 on the wheel · 2 not found in Music". Missing stations
    /// count toward the 25, because they come back in their places.
    nonisolated static func countText(stations: Int, missing: Int, app: MusicApp = .music) -> String {
        let onWheel = "\(stations) of \(RadioWheelModel.maxStations) on the wheel"
        return missing > 0 ? "\(onWheel) · \(missing) not found in \(app.name)" : onWheel
    }

    private var denied: some View {
        ContentUnavailableView {
            Label("Free Roam Can't Control \(app.name)", systemImage: "music.note")
        } description: {
            Text("Free Roam needs to control \(app.name) to list your playlists. Switch it on in Privacy & Security under Automation, then try again.")
        } actions: {
            Button("Open Privacy & Security…") { PrivacyPane.automation.open() }
                .keyboardShortcut(.defaultAction)
            Button("Try Again", action: reload)
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
                    retune: app == .spotify ? retune : nil,
                    remove: app == .spotify ? removeFromLibrary : nil,
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
