import CoreGraphics

/// The website's social card and the launch images, all in the After Hours
/// look. None of them names or shows anything from a game.
struct LaunchImages {
    let badge: Badge
    let coast: CGImage

    static let repository = "github.com/HAPPYS1NGH/free-roam"
    private static let headline: [(String, accent: Bool)] = [("Take the", false), ("long way", false), ("home.", true)]

    /// Nine stations cut from the coast photo, plus Radio Off in slot 0.
    /// Focus points are fractions of the photo, y down; the selected slot is
    /// the car's tail lights.
    private var stations: [CGImage?] {
        let crops: [(CGFloat, CGFloat, CGFloat)] = [
            (0.77, 0.76, 0.16), (0.93, 0.18, 0.22), (0.74, 0.45, 0.2), (0.25, 0.7, 0.25), (0.68, 0.6, 0.14),
            (0.45, 0.33, 0.26), (0.55, 0.9, 0.2), (0.88, 0.5, 0.18), (0.62, 0.52, 0.12),
        ]
        return [nil] + crops.map { x, y, share in
            let side = CGFloat(coast.height) * share
            let rect = CGRect(x: CGFloat(coast.width) * x - side / 2, y: CGFloat(coast.height) * y - side / 2, width: side, height: side)
            return coast.cropping(to: rect.intersection(CGRect(x: 0, y: 0, width: coast.width, height: coast.height)).integral)
        }
    }

    private func wheel(center: CGPoint, unit: CGFloat) -> WheelPicture {
        WheelPicture(center: center, unit: unit, art: stations, selected: 1, caption: "Night Drive")
    }

    /// The website's Open Graph and X card, 1200 × 630: the hero in small.
    func socialCard() -> CGImage {
        render(1200, 630) { context in
            let scene = Scene(context)
            scene.photo(coast, focus: CGPoint(x: 0.6, y: 0.5))
            scene.shade()
            scene.brand(badge, x: 64, top: 52, size: 60)
            scene.eyebrow("A radio for your favorite music", x: 66, baseline: 170, size: 17, dot: true)
            scene.headline(Self.headline, x: 62, top: 200, size: 128)
            scene.text("Your Music playlists as radio stations on your Mac.", x: 66, baseline: 560, size: 24)
            scene.eyebrow("Hold ⌥Q · macOS 14+", x: 66, baseline: 592, size: 15, color: Scene.muted)
            wheel(center: CGPoint(x: 880, y: scene.y(245)), unit: 7.3).draw(in: context)
        }
    }

    /// The X announcement card, 1600 × 900.
    func announcement() -> CGImage {
        render(1600, 900) { context in
            let scene = Scene(context)
            scene.photo(coast, focus: CGPoint(x: 0.6, y: 0.5))
            scene.shade()
            scene.brand(badge, x: 88, top: 72, size: 84)
            scene.eyebrow("Free and open source, for Mac", x: 92, baseline: 246, size: 22, dot: true)
            scene.headline(Self.headline, x: 86, top: 286, size: 178)
            scene.text("Your Music playlists become radio stations.", x: 92, baseline: 780, size: 32)
            scene.text("Hold ⌥Q, flick to one, let go.", x: 92, baseline: 824, size: 32)
            scene.eyebrow(Self.repository, x: 1512, baseline: 824, size: 20, color: Scene.muted, align: .right)
            wheel(center: CGPoint(x: 1090, y: scene.y(352)), unit: 10.6).draw(in: context)
        }
    }

    /// The X portrait card, 1080 × 1350.
    func portrait() -> CGImage {
        render(1080, 1350) { context in
            let scene = Scene(context)
            scene.photo(coast, focus: CGPoint(x: 0.76, y: 0.55))
            scene.shade(left: 0.7, middle: 0.35, right: 0.3, bottom: 0.22, top: 0.75)
            scene.brand(badge, x: 72, top: 64, size: 76)
            scene.headline(Self.headline, x: 70, top: 214, size: 150)
            scene.eyebrow("Hold ⌥Q · pick a playlist · let go", x: 74, baseline: 618, size: 20, dot: true)
            wheel(center: CGPoint(x: 540, y: scene.y(945)), unit: 10.4).draw(in: context)
            scene.text("Your Music playlists as radio stations on your Mac.", x: 540, baseline: 1272, size: 30, align: .center)
            scene.eyebrow(Self.repository, x: 540, baseline: 1310, size: 18, color: Scene.muted, align: .center)
        }
    }

    /// The launch video's poster frame, 1920 × 1080: the wheel open over the
    /// coast as a desktop picture, faded and darkened at the edges as the app
    /// does behind it, raised 4.3% above the middle as in the app.
    func videoPoster() -> CGImage {
        render(1920, 1080) { context in
            let scene = Scene(context)
            scene.photo(backdrop(coast), focus: CGPoint(x: 0.5, y: 0.5))
            context.setFillColor(rgb(Scene.shade, 0.25))
            context.fill(CGRect(x: 0, y: 0, width: 1920, height: 1080))
            scene.vignette(strength: 0.75)
            wheel(center: CGPoint(x: 960, y: scene.y(540 - 46)), unit: 10.8).draw(in: context, scrim: 0.3)
            scene.brand(badge, x: 64, top: 56, size: 72)
            let keysWidth = 2 * 72 * 1.22 - 72 * 0.22
            scene.keys(["⌥", "Q"], x: 960 - keysWidth / 2, top: 900, size: 72)
            scene.eyebrow("Hold to tune in", x: 960, baseline: 1030, size: 26, align: .center)
        }
    }

    /// The GitHub social preview, 1280 × 640. The badge and line stay inside
    /// the middle 640 px square, so a square crop or a small unfurl keeps them.
    func githubPreview() -> CGImage {
        render(1280, 640) { context in
            let scene = Scene(context)
            scene.photo(coast, focus: CGPoint(x: 0.62, y: 0.5))
            context.setFillColor(rgb(Scene.shade, 0.55))
            context.fill(CGRect(x: 0, y: 0, width: 1280, height: 640))
            scene.vignette(strength: 0.6)
            badge.draw(in: context, center: CGPoint(x: 640, y: scene.y(262)), diameter: 360)
            scene.headline([("A radio for your playlists", false)], x: 640, top: 486, size: 58, align: .center)
            scene.eyebrow("Hold ⌥Q · macOS · open source", x: 640, baseline: 590, size: 19, color: Scene.muted, align: .center)
        }
    }
}
