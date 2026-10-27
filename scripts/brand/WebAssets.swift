import CoreGraphics
import Foundation

/// The website's badge and icons.
enum WebAssets {
    /// The header and footer show the badge at 60 CSS px; 240 px covers 4x.
    static func pageBadge(_ badge: Badge) -> CGImage { badge.trimmed(size: 240) }

    /// The favicon's badge fills its square, so its ring and lettering get
    /// more of a browser tab's few pixels than the app icon's do.
    static func favicon(_ badge: Badge, size: Int) -> CGImage {
        let layout = size <= 16
            ? Badge.SmallLayout(disc: 8, ringOuter: 7.5, ringInner: 6.5, lettering: 6.1, notch: 0)
            : Badge.SmallLayout(disc: 16, ringOuter: 15, ringInner: 13, lettering: 12.3, notch: 1.2)
        let large = render(1024, 1024) { badge.drawSmall(in: $0, center: CGPoint(x: 512, y: 512), layout: layout, scale: 1024 / CGFloat(size)) }
        return resized(large, to: size)
    }

    /// An .ico holding PNGs, which every current browser reads. Browsers
    /// ask for /favicon.ico on their own, so it lives at the site's root.
    static func ico(_ images: [CGImage]) -> Data {
        let pngs = images.map(pngData)
        var data = Data()
        func append16(_ value: Int) { data.append(contentsOf: [UInt8(value & 0xFF), UInt8(value >> 8 & 0xFF)]) }
        func append32(_ value: Int) { append16(value & 0xFFFF); append16(value >> 16) }
        append16(0); append16(1); append16(images.count)
        var offset = 6 + 16 * images.count
        for (image, png) in zip(images, pngs) {
            // A width or height of 0 means 256.
            data.append(contentsOf: [UInt8(image.width % 256), UInt8(image.height % 256), 0, 0])
            append16(1); append16(32); append32(png.count); append32(offset)
            offset += png.count
        }
        for png in pngs { data.append(png) }
        return data
    }
}
