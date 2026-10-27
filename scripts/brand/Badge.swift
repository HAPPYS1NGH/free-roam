import CoreGraphics

/// The brand badge, prototype/public/free-roam/app-icon.png: FREE ROAM in
/// ivory inside a cyan ring on a black disc. Every asset draws this raster.
/// Nothing here redraws the lettering.
struct Badge {
    /// Colours sampled from the badge.
    static let ivory: UInt32 = 0xF8F4E6
    static let cyan: UInt32 = 0x49BDEF
    /// The inside edge of the cyan ring, measured on the badge PNG, where its
    /// disc is 1204 px wide. The lettering sits inside it.
    static let ringInnerRadius: CGFloat = 509

    /// The badge with its generation noise cleaned up, see `init`.
    let image: CGImage
    /// The black disc's bounds in the image, in pixels with y down. The disc
    /// isn't centred in the PNG, and is a little wider than it is tall.
    let disc: CGRect

    /// The PNG's flat areas drift a few levels around each colour, and its
    /// opaque pixels are 253 or 254 rather than 255. That noise costs most of
    /// its megabyte. Pixels within 20 levels of black, ivory or cyan become
    /// exactly that colour, fully opaque; edges keep their blends, so the
    /// result looks the same and compresses to about a quarter.
    init(image source: CGImage) {
        let width = source.width, height = source.height
        let context = canvas(width, height)
        context.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))
        let rowBytes = context.bytesPerRow
        let pixels = context.data!.bindMemory(to: UInt8.self, capacity: rowBytes * height)
        let palette = [0x000000, Badge.ivory, Badge.cyan].map { [Int(($0 >> 16) & 0xFF), Int(($0 >> 8) & 0xFF), Int($0 & 0xFF)] }
        var minX = width, maxX = 0, minY = height, maxY = 0
        for y in 0..<height {
            for x in 0..<width {
                let i = y * rowBytes + x * 4
                if pixels[i + 3] > 128 {
                    minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
                }
                guard pixels[i + 3] >= 250 else { continue }
                for colour in palette where (0..<3).allSatisfy({ abs(Int(pixels[i + $0]) - colour[$0]) <= 20 }) {
                    for channel in 0..<3 { pixels[i + channel] = UInt8(colour[channel]) }
                    pixels[i + 3] = 255
                    break
                }
            }
        }
        image = context.makeImage()!
        disc = CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
    }

    /// Draws the badge with its disc `diameter` wide, centred on `center`.
    func draw(in context: CGContext, center: CGPoint, diameter: CGFloat) {
        let scale = diameter / disc.width
        let origin = CGPoint(
            x: center.x - disc.midX * scale,
            // The image's y runs down, the context's up.
            y: center.y - (CGFloat(image.height) - disc.midY) * scale
        )
        context.draw(image, in: CGRect(x: origin.x, y: origin.y, width: CGFloat(image.width) * scale, height: CGFloat(image.height) * scale))
    }

    /// The badge alone on transparent, its disc as wide as the square image.
    func trimmed(size: Int) -> CGImage {
        resized(render(1024, 1024) { draw(in: $0, center: CGPoint(x: 512, y: 512), diameter: 1024) }, to: size)
    }
}
