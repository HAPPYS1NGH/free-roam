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
