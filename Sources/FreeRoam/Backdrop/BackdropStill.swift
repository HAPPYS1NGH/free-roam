import CoreImage
import CoreImage.CIFilterBuiltins
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.freeroam", category: "capture")

/// The screen under the wheel, captured once per press and filtered like the
/// prototype's `backdrop-filter: saturate(…) brightness(…)` in
/// `prototype/src/styles.css`. It's a still, so anything moving underneath
/// freezes while the wheel is open.
enum BackdropStill {
    /// Browsers apply CSS filters to sRGB-encoded values, but Core Image works
    /// in linear light by default, where the same matrix drains colour
    /// differently: pure red comes out 202 instead of 150. Extended, so a
    /// wide-gamut display's colours outside sRGB survive the trip.
    private static let context = CIContext(options: [
        .workingColorSpace: CGColorSpace(name: CGColorSpace.extendedSRGB)!,
        // Every still is filtered once, so there's nothing worth keeping.
        .cacheIntermediates: false,
    ])

    /// Captures and filters a display, leaving out `excludedWindow`. Nil if
    /// either step failed, which is logged.
    @concurrent static func make(
        displayID: CGDirectDisplayID,
        excluding excludedWindow: CGWindowID?,
        saturation: Double,
        brightness: Double
    ) async -> CGImage? {
        let image: CGImage
        do {
            image = try await ScreenCapture.capture(displayID: displayID, excluding: excludedWindow)
        } catch {
            log.error("Couldn't capture the screen for the backdrop: \(String(describing: error), privacy: .public)")
            return nil
        }
        let clock = ContinuousClock()
        let started = clock.now
        guard let still = filter(image, saturation: saturation, brightness: brightness) else {
            log.error("Couldn't filter the backdrop's still")
            return nil
        }
        log.notice("Filtered the still in \((clock.now - started) / .milliseconds(1), format: .fixed(precision: 0)) ms")
        return still
    }

    /// The colour matrix of CSS `saturate(s)` from the Filter Effects spec,
    /// followed by `brightness(b)`, which multiplies each channel by b. Rows
    /// are the output's red, green and blue, as weights of the input's.
    static func colorMatrix(saturation s: Double, brightness b: Double) -> [[Double]] {
        [
            [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
            [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
            [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
        ].map { row in row.map { $0 * b } }
    }

    /// Both filters as one matrix. Browsers clamp after each filter, but with
    /// a saturation from 0 to 1, the prototype's range, no channel leaves 0–1
    /// before the brightness, so only the end needs clamping, which drawing
    /// into 8 bits does. `CIColorControls` would add the brightness instead.
    static func filter(_ image: CGImage, saturation: Double, brightness: Double) -> CGImage? {
        let rows = colorMatrix(saturation: saturation, brightness: brightness).map { CIVector(x: $0[0], y: $0[1], z: $0[2], w: 0) }
        let matrix = CIFilter.colorMatrix()
        matrix.inputImage = CIImage(cgImage: image)
        matrix.rVector = rows[0]
        matrix.gVector = rows[1]
        matrix.bVector = rows[2]
        guard let output = matrix.outputImage else { return nil }
        // Back in the capture's colour space, which is the display's, so the
        // still lines up with the screen it covers.
        let space = image.colorSpace ?? CGColorSpace(name: CGColorSpace.sRGB)!
        return context.createCGImage(
            output, from: CGRect(x: 0, y: 0, width: image.width, height: image.height), format: .RGBA8, colorSpace: space
        )
    }
}
