import CoreGraphics
import Foundation
import SwiftUI
import Testing
@testable import FreeRoam

struct BackdropStillTests {
    @Test func fullSaturationLeavesColoursAlone() {
        let matrix = BackdropStill.colorMatrix(saturation: 1, brightness: 1)
        #expect(Self.isClose(matrix, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]))
    }

    @Test func noSaturationGivesEveryChannelTheLuminance() {
        let matrix = BackdropStill.colorMatrix(saturation: 0, brightness: 1)
        #expect(Self.isClose(matrix, Array(repeating: [0.213, 0.715, 0.072], count: 3)))
    }

    @Test func brightnessMultipliesEveryWeight() {
        let matrix = BackdropStill.colorMatrix(saturation: 0.45, brightness: 1.04)
        let unbrightened = BackdropStill.colorMatrix(saturation: 0.45, brightness: 1)
        #expect(Self.isClose(matrix, unbrightened.map { $0.map { $0 * 1.04 } }))
        // Greys stay grey, 4% brighter.
        #expect(matrix.allSatisfy { abs($0.reduce(0, +) - 1.04) < 1e-12 })
    }

    /// The CSS spec's results for the tokens' saturate(0.45) brightness(1.04),
    /// worked out on sRGB-encoded values as browsers do. In linear light, red
    /// would come out 202, and a brightness that adds would make grey 138.
    @Test func filtersLikeTheBrowserInSRGB() throws {
        let behaviour = try TokensFixture.style().behaviour
        let image = try #require(Pixels.image([255, 0, 0, 255, 0, 255, 0, 255, 128, 128, 128, 255], width: 3))
        let still = try #require(BackdropStill.filter(
            image, saturation: behaviour.backdropSaturation, brightness: behaviour.backdropBrightness
        ))
        let expected: [UInt8] = [150, 31, 31, 255, 104, 224, 104, 255, 133, 133, 133, 255]
        let filtered = Pixels.rgba(still)
        #expect(zip(filtered, expected).allSatisfy { abs(Int($0) - Int($1)) <= 1 }, "\(filtered)")
    }

    private static func isClose(_ matrix: [[Double]], _ expected: [[Double]]) -> Bool {
        zip(matrix.joined(), expected.joined()).allSatisfy { abs($0 - $1) < 1e-12 }
    }
}

@MainActor
struct VignetteTests {
    /// `radial-gradient(ellipse farthest-corner, …)` from `.wheel-backdrop` in
    /// the prototype's styles.css, as (position, opacity).
    static let cssStops: [(Double, Double)] = [(0.46, 0), (0.6, 0.12), (0.74, 0.29), (0.88, 0.54), (1, 0.7)]

    /// CSS's farthest-corner ellipse keeps the box's proportions and passes
    /// through its corners, so its radii are √2 times half the box.
    static func cssOpacity(x: Double, y: Double, width: Double, height: Double) -> Double {
        let dx = (x - width / 2) / (2.0.squareRoot() * width / 2)
        let dy = (y - height / 2) / (2.0.squareRoot() * height / 2)
        let position = (dx * dx + dy * dy).squareRoot()
        guard let end = cssStops.firstIndex(where: { $0.0 >= position }) else { return cssStops.last!.1 }
        guard end > 0 else { return cssStops[0].1 }
        let (from, to) = (cssStops[end - 1], cssStops[end])
        return from.1 + (to.1 - from.1) * (position - from.0) / (to.0 - from.0)
    }

    @Test func matchesTheCSSGradientOnAWideScreen() throws {
        let (width, height) = (400, 200)
        let renderer = ImageRenderer(content: Vignette(strength: 1).frame(width: Double(width), height: Double(height)))
        renderer.scale = 1
        let pixels = Pixels.rgba(try #require(renderer.cgImage))
        // Corners, the middle of two edges, the centre, halfway to a corner
        // and a point between the stops.
        let points = [(0, 0), (399, 199), (0, 100), (200, 0), (200, 100), (100, 50), (40, 30)]
        for (x, y) in points {
            let opacity = Double(pixels[(y * width + x) * 4 + 3]) / 255
            let expected = Self.cssOpacity(x: Double(x) + 0.5, y: Double(y) + 0.5, width: Double(width), height: Double(height))
            #expect(abs(opacity - expected) < 0.015, "at (\(x), \(y)): \(opacity), CSS \(expected)")
        }
    }

    @Test func strengthScalesTheDarkening() throws {
        let renderer = ImageRenderer(content: Vignette(strength: 0.5).frame(width: 400, height: 200))
        renderer.scale = 1
        let corner = Double(Pixels.rgba(try #require(renderer.cgImage))[3]) / 255
        #expect(abs(corner - 0.35) < 0.015)
    }
}

struct StillHandoffTests {
    static func still() throws -> CGImage {
        try #require(Pixels.image([0, 0, 0, 255], width: 1))
    }

    /// Letting go, then pressing again while the backdrop fades out: the new
    /// capture lands before the fade ends, and the fade's end clears only
    /// what it was showing.
    @Test func aCaptureDuringTheFadeOutWaitsForItsOpen() throws {
        let (first, second) = (try Self.still(), try Self.still())
        var stills = StillHandoff()
        stills.land(first, whileOpen: false)
        stills.open()
        stills.land(second, whileOpen: false)
        #expect(stills.shown === first)
        stills.fadedOut()
        #expect(stills.shown == nil)
        stills.open()
        #expect(stills.shown === second)
    }

    /// A slow capture for another display mustn't show the last screen's
    /// still in the meantime.
    @Test func openingBeforeTheCaptureLandsShowsNothingUntilItDoes() throws {
        let (first, second) = (try Self.still(), try Self.still())
        var stills = StillHandoff()
        stills.land(first, whileOpen: false)
        stills.open()
        stills.open()
        #expect(stills.shown == nil)
        stills.land(second, whileOpen: true)
        #expect(stills.shown === second)
    }

    @Test func aTapLeavesNothingForTheNextOpen() throws {
        var stills = StillHandoff()
        stills.land(try Self.still(), whileOpen: false)
        stills.discardWaiting()
        stills.open()
        #expect(stills.shown == nil)
    }
}

enum Pixels {
    static let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!

    static func image(_ rgba: [UInt8], width: Int) -> CGImage? {
        guard let provider = CGDataProvider(data: Data(rgba) as CFData) else { return nil }
        return CGImage(
            width: width, height: rgba.count / 4 / width, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
            space: sRGB, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent
        )
    }

    /// Every pixel as RGBA bytes in sRGB, top row first.
    static func rgba(_ image: CGImage) -> [UInt8] {
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        bytes.withUnsafeMutableBytes { buffer in
            let context = CGContext(
                data: buffer.baseAddress, width: image.width, height: image.height, bitsPerComponent: 8,
                bytesPerRow: image.width * 4, space: sRGB, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
            context?.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        }
        return bytes
    }
}
