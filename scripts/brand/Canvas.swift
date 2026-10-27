import AppKit
import CoreGraphics
import CoreText
import UniformTypeIdentifiers

/// Drawing helpers shared by every generator. Contexts are sRGB with y up.
let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!

func rgb(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(
        srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255, alpha: alpha
    )
}

func canvas(_ width: Int, _ height: Int) -> CGContext {
    let context = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: sRGB,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.interpolationQuality = .high
    context.setShouldAntialias(true)
    return context
}

func render(_ width: Int, _ height: Int, _ draw: (CGContext) -> Void) -> CGImage {
    let context = canvas(width, height)
    draw(context)
    return context.makeImage()!
}

func loadImage(_ url: URL) -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fatalError("Couldn't read \(url.path)")
    }
    return image
}

/// Downscales in steps of at most half, which keeps thin strokes from
/// aliasing the way a single large reduction does.
func resized(_ image: CGImage, width: Int, height: Int) -> CGImage {
    var current = image
    while current.width / 2 > width && current.height / 2 > height {
        let half = current
        current = render(half.width / 2, half.height / 2) { $0.draw(half, in: CGRect(x: 0, y: 0, width: half.width / 2, height: half.height / 2)) }
    }
    let last = current
    return render(width, height) { $0.draw(last, in: CGRect(x: 0, y: 0, width: width, height: height)) }
}

func resized(_ image: CGImage, to size: Int) -> CGImage { resized(image, width: size, height: size) }

/// Draws `image` to cover `rect`, cropped around `focus` (0...1 in the image, y down).
func drawCover(_ context: CGContext, _ image: CGImage, in rect: CGRect, focus: CGPoint = CGPoint(x: 0.5, y: 0.5), zoom: CGFloat = 1) {
    let scale = max(rect.width / CGFloat(image.width), rect.height / CGFloat(image.height)) * zoom
    let size = CGSize(width: CGFloat(image.width) * scale, height: CGFloat(image.height) * scale)
    var x = rect.midX - focus.x * size.width
    var y = rect.midY - (1 - focus.y) * size.height
    x = min(rect.minX, max(rect.maxX - size.width, x))
    y = min(rect.minY, max(rect.maxY - size.height, y))
    context.saveGState()
    context.clip(to: rect)
    context.draw(image, in: CGRect(origin: CGPoint(x: x, y: y), size: size))
    context.restoreGState()
}

func write(_ image: CGImage, to url: URL, jpegQuality: CGFloat? = nil) {
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let type = jpegQuality == nil ? UTType.png : UTType.jpeg
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil) else {
        fatalError("Couldn't write \(url.path)")
    }
    var options: [CFString: Any] = [:]
    if let jpegQuality { options[kCGImageDestinationLossyCompressionQuality] = jpegQuality }
    CGImageDestinationAddImage(destination, image, options as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { fatalError("Couldn't write \(url.path)") }
}

// MARK: - Text

func registerFont(_ url: URL) {
    var error: Unmanaged<CFError>?
    if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
        // Registering twice in one process is harmless; anything else isn't.
        let code = (error?.takeRetainedValue()).map(CFErrorGetCode) ?? 0
        guard code == CTFontManagerError.alreadyRegistered.rawValue else { fatalError("Couldn't register \(url.path)") }
    }
}

func font(_ name: String, _ size: CGFloat) -> CTFont {
    let font = CTFontCreateWithName(name as CFString, size, nil)
    guard (CTFontCopyPostScriptName(font) as String) == name else { fatalError("Missing font \(name)") }
    return font
}

func line(_ text: String, font: CTFont, color: CGColor, tracking: CGFloat = 0) -> CTLine {
    let attributes: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
        NSAttributedString.Key(kCTKernAttributeName as String): tracking,
    ]
    return CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
}

func width(of line: CTLine) -> CGFloat { CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil)) }

enum TextAlign { case left, center, right }

/// Draws one line with its baseline at `y`.
@discardableResult
func drawLine(_ context: CGContext, _ text: String, font: CTFont, color: CGColor, x: CGFloat, y: CGFloat,
              align: TextAlign = .left, tracking: CGFloat = 0) -> CGFloat {
    let ctLine = line(text, font: font, color: color, tracking: tracking)
    // Trailing tracking would push centred text left.
    let lineWidth = width(of: ctLine) - tracking
    let originX = switch align {
    case .left: x
    case .center: x - lineWidth / 2
    case .right: x - lineWidth
    }
    context.textPosition = CGPoint(x: originX, y: y)
    CTLineDraw(ctLine, context)
    return lineWidth
}
