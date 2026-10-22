import ScreenCaptureKit

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
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let mainDisplay = content.displays.first { $0.displayID == CGMainDisplayID() }
        guard let display = mainDisplay ?? content.displays.first else { throw ScreenCaptureError.noDisplay }

        let configuration = SCStreamConfiguration()
        configuration.width = display.width
        configuration.height = display.height
        let image = try await SCScreenshotManager.captureImage(
            contentFilter: SCContentFilter(display: display, excludingWindows: []),
            configuration: configuration
        )
        return CGSize(width: image.width, height: image.height)
    }
}
