import Foundation

// Writes every Free Roam brand asset from the badge. scripts/make-brand-assets.sh
// compiles this folder and runs it: brand <repository> <work folder>.
let arguments = CommandLine.arguments
guard arguments.count == 3 else { fatalError("usage: brand <repository> <work folder>") }
let repository = URL(fileURLWithPath: arguments[1])
let work = URL(fileURLWithPath: arguments[2])
func path(_ relative: String) -> URL { repository.appendingPathComponent(relative) }

let badge = Badge(image: loadImage(path("prototype/public/free-roam/app-icon.png")))

// The app icon. The shell script packs the iconset with iconutil.
let iconset = AppIcon.iconset(badge)
for (name, image) in iconset { write(image, to: work.appendingPathComponent("AppIcon.iconset/\(name).png")) }
write(iconset.last!.1, to: path("output/branding/free-roam/macos-app-icon-1024.png"))

// The menu bar glyph. NSImage(named:) loads both files as one template image.
write(MenuBarGlyph.image(badge, scale: 1), to: path("Sources/FreeRoam/Resources/MenuBarIconTemplate.png"))
write(MenuBarGlyph.image(badge, scale: 2), to: path("Sources/FreeRoam/Resources/MenuBarIconTemplate@2x.png"))

// The welcome window's badge, shown at 56 pt: 2x pixels.
write(badge.trimmed(size: 112), to: path("Sources/FreeRoam/Resources/FreeRoamBadge.png"))

// The website's badge and icons, under prototype/public/. The build only
// publishes files listed in prototype/scripts/public-assets.mjs.
write(WebAssets.pageBadge(badge), to: path("prototype/public/free-roam/badge.png"))
write(WebAssets.ico([WebAssets.favicon(badge, size: 16), WebAssets.favicon(badge, size: 32)]), to: path("prototype/public/favicon.ico"))
write(AppIcon.touchIcon(badge, size: 180), to: path("prototype/public/apple-touch-icon.png"))

// The social card and launch images.
registerFont(path("Sources/FreeRoam/Resources/SofiaSansExtraCondensed-SemiBold.ttf"))
let launch = LaunchImages(badge: badge, coast: loadImage(path("prototype/public/free-roam/coast.jpg")))
write(launch.socialCard(), to: path("prototype/public/free-roam/og-image.jpg"), jpegQuality: 0.82)
write(launch.githubPreview(), to: path("output/launch/github-social-preview.jpg"), jpegQuality: 0.88)
write(launch.announcement(), to: path("output/launch/x-announcement-1600x900.jpg"), jpegQuality: 0.9)
write(launch.portrait(), to: path("output/launch/x-portrait-1080x1350.jpg"), jpegQuality: 0.9)
write(launch.videoPoster(), to: path("output/launch/video-poster-1920x1080.jpg"), jpegQuality: 0.9)
