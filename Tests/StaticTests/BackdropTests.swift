import CoreGraphics
import Foundation
import Testing
@testable import Static

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
