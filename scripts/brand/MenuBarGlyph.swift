import CoreGraphics

/// The status item's template image: the badge's ring, with its four gaps,
/// around the badge's own lettering, in black on transparent so macOS tints
/// it for light and dark menu bars. 18 pt square, at @1x and @2x.
enum MenuBarGlyph {
    static let points: CGFloat = 18
    /// In points. The ring is a point wide so the lettering inside it can be
    /// as large as possible: at @2x it still reads FREE ROAM.
    private static let ringOuter: CGFloat = 9, ringWidth: CGFloat = 1, notch: CGFloat = 1.5, lettering: CGFloat = 7.4

    static func image(_ badge: Badge, scale: Int) -> CGImage {
        // Drawn at 1024 and scaled down, so the lettering keeps its shape.
        let k = 1024 / points
        let centre = CGPoint(x: 512, y: 512)
        func circle(_ radius: CGFloat) -> CGRect {
            CGRect(x: centre.x - radius * k, y: centre.y - radius * k, width: 2 * radius * k, height: 2 * radius * k)
        }
        let large = render(1024, 1024) { context in
            context.saveGState()
            let gaps = CGMutablePath()
            gaps.addRect(CGRect(x: 0, y: 0, width: 1024, height: 1024))
            gaps.addRect(CGRect(x: centre.x - notch * k / 2, y: 0, width: notch * k, height: 1024))
            gaps.addRect(CGRect(x: 0, y: centre.y - notch * k / 2, width: 1024, height: notch * k))
            context.addPath(gaps)
            context.clip(using: .evenOdd)
            context.addEllipse(in: circle(ringOuter))
            context.addEllipse(in: circle(ringOuter - ringWidth))
            context.setFillColor(rgb(0x000000))
            context.fillPath(using: .evenOdd)
            context.restoreGState()

            // The badge's inner ring edge lands on `lettering`.
            let mask = badge.letteringMask()
            let scale = lettering * k / Badge.ringInnerRadius
            context.draw(mask, in: CGRect(
                x: centre.x - badge.disc.midX * scale,
                y: centre.y - (CGFloat(mask.height) - badge.disc.midY) * scale,
                width: CGFloat(mask.width) * scale, height: CGFloat(mask.height) * scale
            ))
        }
        let image = resized(large, to: Int(points) * scale)
        // At @1x the lettering's strokes are about a pixel wide, so most of it
        // comes out grey, and a grey template reads as a dimmed menu item.
        // Steepening its alpha keeps the texture at full strength.
        return scale == 1 ? contrasted(image, gain: 1.5, pivot: 0.45) : image
    }
}

/// Steepens alpha around `pivot` by `gain`.
private func contrasted(_ image: CGImage, gain: CGFloat, pivot: CGFloat) -> CGImage {
    let context = canvas(image.width, image.height)
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    let rowBytes = context.bytesPerRow
    let pixels = context.data!.bindMemory(to: UInt8.self, capacity: rowBytes * image.height)
    for y in 0..<image.height {
        for x in 0..<image.width {
            let i = y * rowBytes + x * 4
            let alpha = CGFloat(pixels[i + 3]) / 255
            pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0
            pixels[i + 3] = UInt8(255 * min(1, max(0, pivot + (alpha - pivot) * gain)))
        }
    }
    return context.makeImage()!
}

extension Badge {
    /// The lettering alone as black on transparent, the same size as the
    /// badge PNG. Ivory is the only colour with a high red channel: the
    /// cyan's is under 80 and the black's 0.
    func letteringMask() -> CGImage {
        let width = image.width, height = image.height
        let context = canvas(width, height)
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        let rowBytes = context.bytesPerRow
        let pixels = context.data!.bindMemory(to: UInt8.self, capacity: rowBytes * height)
        for y in 0..<height {
            for x in 0..<width {
                let i = y * rowBytes + x * 4
                let alpha = UInt8(255 * min(1, max(0, (CGFloat(pixels[i]) - 110) / 120)))
                // Premultiplied black.
                pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0; pixels[i + 3] = alpha
            }
        }
        return context.makeImage()!
    }
}
