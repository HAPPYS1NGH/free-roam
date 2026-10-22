import OSLog
import ScreenCaptureKit

private let log = Logger(subsystem: "com.happys1ngh.static", category: "capture")

enum ScreenCaptureError: LocalizedError {
    case noDisplay

    var errorDescription: String? { "No display to capture." }
}

/// Screen Recording access, which the backdrop needs to desaturate other apps' windows.
enum ScreenCapture {
    /// Never prompts.
    static var isAllowed: Bool { CGPreflightScreenCaptureAccess() }

    /// Captures the main display once and returns the image size. The first
    /// call makes macOS ask for Screen Recording permission; until it's
    /// granted, this throws.
    static func captureMainDisplay() async throws -> CGSize {
        try await capture(displayID: CGMainDisplayID())
    }

    /// Captures a display at full pixel resolution, leaving out Static's own
    /// windows, and logs how long listing the screen's content and taking the
    /// image each took. Returns the image size.
    static func capture(displayID: CGDirectDisplayID) async throws -> CGSize {
        let clock = ContinuousClock()
        let started = clock.now
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let listed = clock.now
        guard let display = content.displays.first(where: { $0.displayID == displayID }) else {
            throw ScreenCaptureError.noDisplay
        }

        let ownApp = content.applications.filter { $0.processID == ProcessInfo.processInfo.processIdentifier }
        let filter = SCContentFilter(display: display, excludingApplications: ownApp, exceptingWindows: [])
        let configuration = SCStreamConfiguration()
        configuration.width = Int(Float(display.width) * filter.pointPixelScale)
        configuration.height = Int(Float(display.height) * filter.pointPixelScale)
        configuration.showsCursor = false
        let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
        let finished = clock.now

        log.notice("""
            Captured \(image.width)×\(image.height) in \(milliseconds(finished - started)) ms: \
            listing content \(milliseconds(listed - started)) ms, image \(milliseconds(finished - listed)) ms
            """)
        return CGSize(width: image.width, height: image.height)
    }

    private static func milliseconds(_ duration: Duration) -> Int {
        Int((duration / .milliseconds(1)).rounded())
    }
}
