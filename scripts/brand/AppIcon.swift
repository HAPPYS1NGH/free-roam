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
    /// 16 and 32 px, with the ring redrawn so it survives; see `Badge.drawSmall`.
    static func small(_ badge: Badge, size: Int) -> CGImage {
        let layout = size <= 16
            ? Badge.SmallLayout(disc: 6, ringOuter: 5.5, ringInner: 4.5, lettering: 4.2, notch: 0)
            : Badge.SmallLayout(disc: 12, ringOuter: 11, ringInner: 9, lettering: 8.5, notch: 1)
        let large = render(1024, 1024) { context in
            drawPlate(context, scale: 1)
            badge.drawSmall(in: context, center: CGPoint(x: plateRect.midX, y: plateRect.midY), layout: layout, scale: 1024 / CGFloat(size))
        }
        return resized(large, to: size)
    }

    /// iOS's home screen icon for the website: the plate full bleed, since
    /// iOS rounds the corners itself and turns transparency black.
    static func touchIcon(_ badge: Badge, size: Int) -> CGImage {
        let full = render(1024, 1024) { context in
            let top = rgb(plateTop), bottom = rgb(plateBottom)
            let gradient = CGGradient(colorsSpace: sRGB, colors: [top, bottom] as CFArray, locations: [0, 1])!
            context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 1024), end: .zero, options: [])
            badge.draw(in: context, center: CGPoint(x: 512, y: 512), diameter: 1024 * 0.78)
        }
        return resized(full, to: size)
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
