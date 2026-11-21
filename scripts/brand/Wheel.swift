import CoreGraphics
import CoreText

/// The radio wheel as the app draws it, with the numbers in site/tokens.json,
/// for the launch images. `unit` is 1% of the screen height it stands for.
/// Station art is cut from the coast photo rather than album covers.
struct WheelPicture {
    static let ring: UInt32 = 0x65B4D4

    let center: CGPoint
    let unit: CGFloat
    /// Slot 0 is Radio Off at the bottom; stations run clockwise from it.
    let art: [CGImage?]
    let selected: Int
    let caption: String

    var count: Int { art.count }
    var radius: CGFloat { min(max(CGFloat(count) * 9.15 / (2 * .pi), 22), 30.5) * unit }
    /// Even pixels, as the app rounds them.
    var disc: CGFloat {
        let pitch = 2 * .pi * radius / CGFloat(count)
        return (min(pitch * 8.8 / 9.15, 10.5 * unit) / 2).rounded() * 2
    }
    var ringWidth: CGFloat { (0.55 * unit).rounded() }

    func position(_ slot: Int) -> CGPoint {
        let angle = CGFloat.pi + CGFloat(slot) / CGFloat(count) * 2 * .pi
        // y runs up here, so the bottom of the ring is below the centre.
        return CGPoint(x: center.x + radius * sin(angle), y: center.y + radius * cos(angle))
    }

    /// `scrim` darkens the picture behind the wheel, as the app's backdrop
    /// does, so the faded discs still read over a bright sky.
    func draw(in context: CGContext, scrim: CGFloat = 0.55) {
        if scrim > 0 {
            let gradient = CGGradient(colorsSpace: sRGB, colors: [rgb(Scene.shade, scrim), rgb(Scene.shade, scrim * 0.8), rgb(Scene.shade, 0)] as CFArray, locations: [0, 0.6, 1])!
            context.drawRadialGradient(gradient, startCenter: center, startRadius: 0, endCenter: center, endRadius: (radius + disc) * 1.35, options: [])
        }
        for slot in 0..<count where slot != selected { drawDisc(context, slot: slot, isSelected: false) }
        drawDisc(context, slot: selected, isSelected: true)
        drawCaption(context)
    }

    private func drawDisc(_ context: CGContext, slot: Int, isSelected: Bool) {
        let centre = position(slot)
        let discRect = CGRect(x: centre.x - disc / 2, y: centre.y - disc / 2, width: disc, height: disc)
        context.saveGState()
        if isSelected {
            // The ring sits outside the disc, with a thin dark edge round it.
            let outer = discRect.insetBy(dx: -ringWidth, dy: -ringWidth)
            context.setFillColor(rgb(0x000000, 0.6))
            context.fillEllipse(in: outer.insetBy(dx: -1.5, dy: -1.5))
            context.setFillColor(rgb(Self.ring))
            context.fillEllipse(in: outer)
        } else {
            // An idle disc fades as one layer, black rim and art together.
            context.setAlpha(0.4)
            context.beginTransparencyLayer(auxiliaryInfo: nil)
        }
        context.setFillColor(rgb(0x000000))
        context.fillEllipse(in: discRect)
        let artRect = discRect.insetBy(dx: disc * (isSelected ? 0.01 : 0.05), dy: disc * (isSelected ? 0.01 : 0.05))
        if let image = art[slot] {
            context.saveGState()
            context.addEllipse(in: artRect)
            context.clip()
            drawCover(context, isSelected ? image : greyscale(image), in: artRect)
            context.restoreGState()
        } else {
            drawRadioOff(context, in: artRect)
        }
        if !isSelected { context.endTransparencyLayer() }
        context.restoreGState()
    }

    /// The no-entry mark: a circle and a slash, strokes 5% of its width.
    private func drawRadioOff(_ context: CGContext, in rect: CGRect) {
        let k = rect.width / 24
        context.saveGState()
        context.setStrokeColor(rgb(0xFFFFFF))
        context.setLineWidth(1.25 * k)
        context.strokeEllipse(in: rect.insetBy(dx: 0.75 * k, dy: 0.75 * k))
        context.setLineCap(.butt)
        context.move(to: CGPoint(x: rect.minX + 4.05 * k, y: rect.maxY - 4.05 * k))
        context.addLine(to: CGPoint(x: rect.minX + 19.95 * k, y: rect.maxY - 19.95 * k))
        context.strokePath()
        context.restoreGState()
    }

    /// The station name, white with a hairline dark edge, centred 5% of the
    /// screen above the ring's centre.
    private func drawCaption(_ context: CGContext) {
        let captionFont = font("SofiaSansExtraCondensed-SemiBold", 3.4 * unit)
        let baseline = center.y + 5 * unit - 3.4 * unit * 0.36
        context.saveGState()
        for blur in [1.5, 1.5, 1.5, 4] as [CGFloat] {
            context.setShadow(offset: .zero, blur: blur * unit / 10.8, color: rgb(0x000000, blur == 4 ? 0.45 : 1))
            drawLine(context, caption, font: captionFont, color: rgb(0xFFFFFF), x: center.x, y: baseline, align: .center)
        }
        context.restoreGState()
    }
}

func greyscale(_ image: CGImage) -> CGImage {
    let context = CGContext(
        data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.genericGrayGamma2_2)!, bitmapInfo: CGImageAlphaInfo.none.rawValue
    )!
    context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    return context.makeImage()!
}
