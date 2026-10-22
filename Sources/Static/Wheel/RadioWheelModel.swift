import AppKit
import Carbon.HIToolbox
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.static", category: "wheel")

/// Holding ⌥Q opens the wheel, mouse movement and scrolling pick a station,
/// and letting go tunes in. A quicker tap skips to the next station without
/// showing the wheel. Ported from `prototype/src/useWheel.ts`.
@MainActor @Observable
final class RadioWheelModel {
    /// Stations on the ring, not counting Radio Off.
    static let maxStations = 25

    let style: WheelStyle
    /// Slot 0 is Radio Off, so station `i` is in slot `i + 1`.
    private(set) var stations: [Playlist] = []
    private(set) var highlighted = 0
    var slotCount: Int { stations.count + 1 }

    @ObservationIgnored private let availableStations: () -> [Playlist]
    @ObservationIgnored private let hotkey = Hotkey(keyCode: kVK_ANSI_Q, modifiers: .option)
    // The wheel is only open while ⌥ is held, so Escape arrives as ⌥Esc. It's
    // registered only while the wheel is open.
    @ObservationIgnored private let escape = Hotkey(keyCode: kVK_Escape, modifiers: .option)
    @ObservationIgnored private lazy var panel = makePanel()
    @ObservationIgnored private var holdTimer: Task<Void, Never>?
    @ObservationIgnored private var isOpen = false
    @ObservationIgnored private var cursor: PickCursor
    @ObservationIgnored private var scroller: ScrollStepper
    /// Nil is Radio Off.
    @ObservationIgnored private var tunedID: String?

    init(style: WheelStyle, stations: @escaping () -> [Playlist]) {
        self.style = style
        availableStations = stations
        cursor = PickCursor(pickRadius: style.behaviour.pickRadius, deadZone: 0)
        scroller = ScrollStepper(step: style.behaviour.scrollStep)
    }

    func start() {
        hotkey.onPress = { [weak self] in self?.press() }
        hotkey.onRelease = { [weak self] optionFirst in self?.release(optionFirst: optionFirst) }
        escape.onPress = { [weak self] in self?.dismiss() }
        do {
            try hotkey.register()
            log.notice("Registered ⌥Q")
        } catch {
            log.error("Couldn't register ⌥Q: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: Hotkey

    private func press() {
        guard !isOpen, holdTimer == nil else { return }
        let delay = style.behaviour.holdDelayMs
        holdTimer = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(delay))
            guard let self, !Task.isCancelled else { return }
            holdTimer = nil
            open()
        }
    }

    private func release(optionFirst: Bool) {
        if optionFirst { log.notice("⌥ came up before Q, which ends the hold") }
        if let holdTimer {
            holdTimer.cancel()
            self.holdTimer = nil
            tapNext()
        } else if isOpen {
            tune(highlighted)
            close()
        }
    }

    private func dismiss() {
        guard isOpen else { return }
        log.notice("Closed with Escape")
        close()
    }

    // MARK: Wheel

    private func open() {
        guard let screen = NSScreen.withMouse else { return }
        stations = Array(availableStations().prefix(Self.maxStations))
        highlighted = tunedSlot
        let unit = screen.frame.height / 100
        cursor = PickCursor(pickRadius: style.behaviour.pickRadius, deadZone: style.behaviour.deadzone * unit)
        scroller = ScrollStepper(step: style.behaviour.scrollStep)
        isOpen = true
        panel.show(on: screen)
        do {
            try escape.register()
        } catch {
            log.error("Couldn't register ⌥Esc: \(error.localizedDescription, privacy: .public)")
        }
        log.notice("""
            Opened on a \(Int(screen.frame.width))×\(Int(screen.frame.height)) screen \
            with \(self.stations.count) stations, on \(self.stationName(self.highlighted), privacy: .public)
            """)
        if let displayID = screen.displayID { timeCapture(of: displayID) }
    }

    private func close() {
        isOpen = false
        escape.unregister()
        panel.hide()
    }

    private func moveMouse(dx: Double, dy: Double) {
        guard isOpen, let slot = cursor.move(dx: dx, dy: dy, count: slotCount) else { return }
        highlighted = slot
    }

    private func scroll(by delta: Double, at time: TimeInterval) {
        guard isOpen, let direction = scroller.scroll(by: delta, at: time) else { return }
        let next = (highlighted + direction + slotCount) % slotCount
        // Mouse movement after scrolling carries on from this station.
        cursor.point(at: next, count: slotCount)
        highlighted = next
    }

    // MARK: Tuning

    private var tunedSlot: Int {
        guard let tunedID, let index = stations.firstIndex(where: { $0.id == tunedID }) else { return 0 }
        return index + 1
    }

    private func tapNext() {
        stations = Array(availableStations().prefix(Self.maxStations))
        guard let next = WheelGeometry.nextStation(after: tunedSlot, count: slotCount) else {
            log.notice("Tapped ⌥Q with no stations to skip to")
            return
        }
        tune(next)
    }

    /// Only remembers the station so far. Playing it in Music comes next.
    private func tune(_ slot: Int) {
        let id = slot == 0 ? nil : stations[slot - 1].id
        guard id != tunedID else { return }
        tunedID = id
        log.notice("Tuned to \(self.stationName(slot), privacy: .public)")
    }

    private func stationName(_ slot: Int) -> String {
        slot == 0 ? "Radio Off" : "slot \(slot), \(stations[slot - 1].name)"
    }

    // MARK: Setup

    private func makePanel() -> OverlayPanel {
        let panel = OverlayPanel(content: RadioWheelView(model: self))
        panel.onMouseMove = { [weak self] dx, dy in self?.moveMouse(dx: dx, dy: dy) }
        panel.onScroll = { [weak self] delta, time in self?.scroll(by: delta, at: time) }
        return panel
    }

    /// Captures the screen the wheel opened on, which logs how long it took.
    /// If that's much longer than the filter's 150 ms fade-in, the backdrop
    /// needs a stream that keeps running instead of a capture on open.
    private func timeCapture(of displayID: CGDirectDisplayID) {
        guard ScreenCapture.isAllowed else { return }
        Task {
            do {
                _ = try await ScreenCapture.capture(displayID: displayID)
            } catch {
                log.error("Capture on open failed: \(String(describing: error), privacy: .public)")
            }
        }
    }
}
