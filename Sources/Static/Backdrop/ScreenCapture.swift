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

    /// Adds Static to the Screen Recording list in System Settings. macOS
    /// shows its own prompt only the first time. Static only asks from the
    /// menu, never at launch, because the backdrop works without it.
    static func requestAccess() {
        let allowed = CGRequestScreenCaptureAccess()
        log.notice("Asked for Screen Recording: \(allowed ? "allowed" : "not allowed yet")")
    }

    /// Captures a display at full pixel resolution, in the display's colour
    /// space, and logs how long listing the screen's content and taking the
    /// image each took. `excludedWindow` is left out, such as the wheel's
    /// panel while it's still fading out.
    static func capture(displayID: CGDirectDisplayID, excluding excludedWindow: CGWindowID? = nil) async throws -> CGImage {
        let clock = ContinuousClock()
        let started = clock.now
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let listed = clock.now
        guard let display = content.displays.first(where: { $0.displayID == displayID }) else {
            throw ScreenCaptureError.noDisplay
        }

        let excluded = content.windows.filter { $0.windowID == excludedWindow }
        let filter = SCContentFilter(display: display, excludingWindows: excluded)
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
        return image
    }

    private static func milliseconds(_ duration: Duration) -> Int {
        Int((duration / .milliseconds(1)).rounded())
    }
}
