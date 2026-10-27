import CoreGraphics

/// The macOS app icon: the badge on a dark plate drawn to Apple's icon grid,
/// an 824 px rounded square with continuous corners in a 1024 px canvas.
/// macOS 26 and later recognise that shape and show the icon without the
/// grey plate they put around icons of other shapes; macOS 14 and 15 show
/// it as drawn.
enum AppIcon {
    static let plateRect = CGRect(x: 100, y: 100, width: 824, height: 824)
    static let cornerRadius: CGFloat = 185.4
    /// The dusk sky of the website's coast photo, darkening towards the bottom.
    static let plateTop: UInt32 = 0x22344A
    static let plateBottom: UInt32 = 0x0E1620
    /// The badge's disc as a share of the plate's width.
    static let badgeShare: CGFloat = 0.8

    static func drawPlate(_ context: CGContext, scale k: CGFloat) {
        let plate = squircle(plateRect.applying(CGAffineTransform(scaleX: k, y: k)), radius: cornerRadius * k)
        // The drop shadow Apple's macOS template gives the shape.
        context.saveGState()
        context.setShadow(offset: CGSize(width: 0, height: -10 * k), blur: 20 * k, color: rgb(0x000000, 0.3))
        context.addPath(plate)
        context.setFillColor(rgb(plateBottom))
        context.fillPath()
        context.restoreGState()

        // Row by row rather than with CGGradient, which dithers: the noise
        // tripled the icon's size, and the steps between these dark rows are
        // a level or two of each channel.
        context.saveGState()
        context.addPath(plate)
        context.clip()
        let top = [plateTop >> 16, plateTop >> 8, plateTop].map { CGFloat($0 & 0xFF) / 255 }
        let bottom = [plateBottom >> 16, plateBottom >> 8, plateBottom].map { CGFloat($0 & 0xFF) / 255 }
        let rows = Int((plateRect.height * k).rounded(.up))
        for row in 0..<rows {
            let t = CGFloat(row) / CGFloat(max(1, rows - 1))
            let channels = (0..<3).map { (top[$0] + (bottom[$0] - top[$0]) * t) * 255 }
            context.setFillColor(CGColor(srgbRed: channels[0].rounded() / 255, green: channels[1].rounded() / 255, blue: channels[2].rounded() / 255, alpha: 1))
            context.fill(CGRect(x: plateRect.minX * k, y: plateRect.maxY * k - CGFloat(row + 1), width: plateRect.width * k, height: 1))
        }
        context.restoreGState()
    }

    /// The 1024 px master.
    static func master(_ badge: Badge) -> CGImage {
        render(1024, 1024) { context in
            drawPlate(context, scale: 1)
            context.saveGState()
            context.setShadow(offset: CGSize(width: 0, height: -6), blur: 24, color: rgb(0x000000, 0.45))
            badge.draw(in: context, center: CGPoint(x: plateRect.midX, y: plateRect.midY), diameter: plateRect.width * badgeShare)
            context.restoreGState()
        }
    }
}

extension AppIcon {
    /// Radii in pixels at the final size.
    private struct SmallLayout {
        let disc: CGFloat, ringOuter: CGFloat, ringInner: CGFloat, lettering: CGFloat, notch: CGFloat
    }

    /// 16 and 32 px. Scaled down as it is, the badge's thin cyan ring blends
    /// into the black and the lettering fills the whole disc, so it reads as
    /// a grey blob. These sizes keep the badge's own lettering but redraw its
    /// ring a whole pixel or two wide, and set the lettering a little smaller
    /// inside it so black shows between them. At 32 px the ring keeps the
    /// badge's gaps at 12, 3, 6 and 9 o'clock; at 16 px they'd be noise.
    static func small(_ badge: Badge, size: Int) -> CGImage {
        let layout = size <= 16
            ? SmallLayout(disc: 6, ringOuter: 5.5, ringInner: 4.5, lettering: 4.2, notch: 0)
            : SmallLayout(disc: 12, ringOuter: 11, ringInner: 9, lettering: 8.5, notch: 1)
        // Drawn at 1024 and scaled down; `k` turns final pixels into 1024ths.
        let k = 1024 / CGFloat(size)
        let centre = CGPoint(x: plateRect.midX, y: plateRect.midY)
        func circle(_ radius: CGFloat) -> CGRect {
            CGRect(x: centre.x - radius * k, y: centre.y - radius * k, width: 2 * radius * k, height: 2 * radius * k)
        }
        let large = render(1024, 1024) { context in
            drawPlate(context, scale: 1)
            context.setFillColor(rgb(0x000000))
            context.fillEllipse(in: circle(layout.disc))

            context.saveGState()
            if layout.notch > 0 {
                let gaps = CGMutablePath()
                gaps.addRect(CGRect(x: 0, y: 0, width: 1024, height: 1024))
                gaps.addRect(CGRect(x: centre.x - layout.notch * k / 2, y: 0, width: layout.notch * k, height: 1024))
                gaps.addRect(CGRect(x: 0, y: centre.y - layout.notch * k / 2, width: 1024, height: layout.notch * k))
                context.addPath(gaps)
                context.clip(using: .evenOdd)
            }
            context.addEllipse(in: circle(layout.ringOuter))
            context.addEllipse(in: circle(layout.ringInner))
            context.setFillColor(rgb(Badge.cyan))
            context.fillPath(using: .evenOdd)
            context.restoreGState()

            // The badge's lettering, without its own ring.
            context.addEllipse(in: circle(layout.lettering))
            context.clip()
            badge.draw(in: context, center: centre, diameter: layout.lettering * k * badge.disc.width / Badge.ringInnerRadius)
        }
        return resized(large, to: size)
    }

    /// Every image an .iconset holds, by file name.
    static func iconset(_ badge: Badge) -> [(String, CGImage)] {
        let master = master(badge)
        let small16 = small(badge, size: 16), small32 = small(badge, size: 32)
        return [
            ("icon_16x16", small16), ("icon_16x16@2x", small32),
            ("icon_32x32", small32), ("icon_32x32@2x", resized(master, to: 64)),
            ("icon_128x128", resized(master, to: 128)), ("icon_128x128@2x", resized(master, to: 256)),
            ("icon_256x256", resized(master, to: 256)), ("icon_256x256@2x", resized(master, to: 512)),
            ("icon_512x512", resized(master, to: 512)), ("icon_512x512@2x", master),
        ]
    }
}
