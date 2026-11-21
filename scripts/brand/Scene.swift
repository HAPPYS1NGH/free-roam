import CoreGraphics
import CoreImage
import CoreText

/// The After Hours look from the website (site/src/free-roam/styles.css):
/// the coast photo under a dark shade, condensed capitals, monospaced eyebrows.
/// Positions are measured from the top, as on a web page.
struct Scene {
    static let shade: UInt32 = 0x081116
    static let background: UInt32 = 0x101514
    static let ink: UInt32 = 0xEDE9DD
    static let muted: UInt32 = 0xB9BCB4
    static let accent: UInt32 = 0xD5DF99

    let context: CGContext
    let width: CGFloat
    let height: CGFloat

    init(_ context: CGContext) {
        self.context = context
        width = CGFloat(context.width)
        height = CGFloat(context.height)
    }

    /// Flips a distance from the top into the context's y.
    func y(_ fromTop: CGFloat) -> CGFloat { height - fromTop }

    func photo(_ image: CGImage, focus: CGPoint, zoom: CGFloat = 1) {
        drawCover(context, image, in: CGRect(x: 0, y: 0, width: width, height: height), focus: focus, zoom: zoom)
    }

    /// The hero's shade: darkest on the left, where the text sits, and
    /// fading into the page's background at the bottom.
    func shade(left: CGFloat = 0.8, middle: CGFloat = 0.33, right: CGFloat = 0.27, bottom: CGFloat = 0.28, top: CGFloat = 0.4) {
        let across = CGGradient(colorsSpace: sRGB, colors: [rgb(Self.shade, left), rgb(Self.shade, middle), rgb(Self.shade, right)] as CFArray, locations: [0, 0.55, 1])!
        context.drawLinearGradient(across, start: .zero, end: CGPoint(x: width, y: 0), options: [])
        let down = CGGradient(colorsSpace: sRGB, colors: [rgb(Self.background, 1), rgb(Self.background, 0), rgb(Self.shade, 0), rgb(Self.shade, top)] as CFArray, locations: [0, bottom, 0.6, 1])!
        context.drawLinearGradient(down, start: .zero, end: CGPoint(x: 0, y: height), options: [])
    }

    /// Darkens the corners, as the app's backdrop does behind the wheel.
    func vignette(strength: CGFloat) {
        let gradient = CGGradient(colorsSpace: sRGB, colors: [rgb(0x000000, 0), rgb(0x000000, strength)] as CFArray, locations: [0.35, 1])!
        let centre = CGPoint(x: width / 2, y: height / 2)
        context.drawRadialGradient(gradient, startCenter: centre, startRadius: 0, endCenter: centre, endRadius: hypot(width, height) / 2, options: [.drawsAfterEndLocation])
    }

    /// The badge and the wordmark beside it, as in the site's header.
    func brand(_ badge: Badge, x: CGFloat, top: CGFloat, size: CGFloat) {
        badge.draw(in: context, center: CGPoint(x: x + size / 2, y: y(top + size / 2)), diameter: size)
        let wordmark = font("Arial-BoldMT", size * 0.4)
        drawLine(context, "Free Roam", font: wordmark, color: rgb(Self.ink), x: x + size * 1.16, y: y(top + size / 2 + size * 0.14), tracking: -size * 0.015)
    }

    /// Monospaced capitals with the accent dot in front, like the hero's.
    func eyebrow(_ text: String, x: CGFloat, baseline: CGFloat, size: CGFloat, dot: Bool = false, color: UInt32 = Scene.ink, align: TextAlign = .left) {
        var x = x
        if dot {
            let d = size * 0.55
            context.setFillColor(rgb(Self.accent))
            context.fillEllipse(in: CGRect(x: x, y: y(baseline) + size * 0.3 - d / 2, width: d, height: d))
            x += d + size * 0.75
        }
        drawLine(context, text.uppercased(), font: font("CourierNewPSMT", size), color: rgb(color), x: x, y: y(baseline), align: align, tracking: size * 0.13)
    }

    /// The headline's condensed capitals at the site's 0.81 line height.
    /// Returns the last baseline.
    @discardableResult
    func headline(_ lines: [(String, accent: Bool)], x: CGFloat, top: CGFloat, size: CGFloat, align: TextAlign = .left) -> CGFloat {
        let face = font("SofiaSansExtraCondensed-SemiBold", size)
        let capHeight = CTFontGetCapHeight(face)
        var baseline = top + capHeight
        for (index, (text, accent)) in lines.enumerated() {
            if index > 0 { baseline += size * 0.81 }
            drawLine(context, text.uppercased(), font: face, color: rgb(accent ? Self.accent : Self.ink), x: x, y: y(baseline), align: align, tracking: -size * 0.01)
        }
        return baseline
    }

    func text(_ text: String, x: CGFloat, baseline: CGFloat, size: CGFloat, color: UInt32 = 0xE1E0D6, bold: Bool = false, align: TextAlign = .left) {
        drawLine(context, text, font: font(bold ? "Arial-BoldMT" : "ArialMT", size), color: rgb(color), x: x, y: y(baseline), align: align)
    }

    /// Key caps like the site's <kbd>: an outline with a darker lip below.
    /// Returns the width drawn.
    @discardableResult
    func keys(_ labels: [String], x: CGFloat, top: CGFloat, size: CGFloat, color: UInt32 = Scene.ink) -> CGFloat {
        var left = x
        let face = CTFontCreateUIFontForLanguage(.system, size * 0.5, nil)!
        for label in labels {
            let rect = CGRect(x: left, y: y(top + size), width: size, height: size)
            let path = CGPath(roundedRect: rect, cornerWidth: size * 0.12, cornerHeight: size * 0.12, transform: nil)
            context.saveGState()
            context.setStrokeColor(rgb(color, 0.35))
            context.setLineWidth(size * 0.05)
            context.addPath(CGPath(roundedRect: rect.offsetBy(dx: 0, dy: -size * 0.06), cornerWidth: size * 0.12, cornerHeight: size * 0.12, transform: nil))
            context.strokePath()
            context.setFillColor(rgb(Self.shade, 0.55))
            context.addPath(path)
            context.fillPath()
            context.setStrokeColor(rgb(color))
            context.setLineWidth(size * 0.035)
            context.addPath(path)
            context.strokePath()
            context.restoreGState()
            let glyph = line(label, font: face, color: rgb(color))
            var ascent: CGFloat = 0, descent: CGFloat = 0
            let glyphWidth = CGFloat(CTLineGetTypographicBounds(glyph, &ascent, &descent, nil))
            context.textPosition = CGPoint(x: rect.midX - glyphWidth / 2, y: rect.midY - (ascent - descent) / 2)
            CTLineDraw(glyph, context)
            left += size * 1.22
        }
        return left - x - size * 0.22
    }
}

/// The app's backdrop behind the wheel: the screen at 45% saturation.
func backdrop(_ image: CGImage) -> CGImage {
    let filter = CIFilter(name: "CIColorControls")!
    filter.setValue(CIImage(cgImage: image), forKey: kCIInputImageKey)
    filter.setValue(0.45, forKey: kCIInputSaturationKey)
    let output = filter.outputImage!
    return CIContext(options: [.workingColorSpace: sRGB]).createCGImage(output, from: output.extent, format: .RGBA8, colorSpace: sRGB)!
}
