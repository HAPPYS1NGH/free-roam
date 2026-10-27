# Launch checklist

Everything here comes from the badge, `prototype/public/free-roam/app-icon.png`, and the coast photo. `scripts/make-brand-assets.sh` regenerates all of it. Decisions are in [DECISIONS.md](DECISIONS.md), under 2026-10-27.

## Assets

| Asset | File | Size |
| --- | --- | --- |
| macOS app icon, 1024 px master | `output/branding/free-roam/macos-app-icon-1024.png` | 1024 × 1024 |
| macOS app icon, every size | `Sources/FreeRoam/Resources/AppIcon.icns` | 16 to 1024 px |
| Menu bar glyph | `Sources/FreeRoam/Resources/MenuBarIconTemplate.png`, `MenuBarIconTemplate@2x.png` | 18 pt |
| Welcome window badge | `Sources/FreeRoam/Resources/FreeRoamBadge.png` | 56 pt |
| Website header badge | `prototype/public/free-roam/badge.png` | 240 px, 48 KB |
| Favicon | `prototype/public/favicon.ico` | 16 and 32 px |
| Home screen icon | `prototype/public/apple-touch-icon.png` | 180 px |
| Open Graph and X card | `prototype/public/free-roam/og-image.jpg` | 1200 × 630 |
| GitHub social preview | `output/launch/github-social-preview.jpg` | 1280 × 640 |
| X announcement card | `output/launch/x-announcement-1600x900.jpg` | 1600 × 900 |
| X portrait card | `output/launch/x-portrait-1080x1350.jpg` | 1080 × 1350 |
| Launch video poster frame | `output/launch/video-poster-1920x1080.jpg` | 1920 × 1080 |

`bundle.sh` copies the app's four files into `Contents/Resources`, and the website build publishes its four.

## Do by hand

- [ ] Rebuild with `scripts/bundle.sh --run`. Check the icon in Finder and Spotlight (Free Roam has no Dock icon while it runs), the menu bar glyph in light and dark mode, and the badge in the welcome window. If Finder still shows a blank icon, run `touch "dist/Free Roam.app"`.
- [ ] Upload the GitHub social preview: the repository's Settings > General > Social preview > Edit > Upload an image, then choose `github-social-preview.jpg`.
- [ ] Attach the X images to the posts, as in the thread below.
- [ ] Record the demo GIF, save it as `docs/media/demo.gif`, and swap it in for the comment at the top of the README.
- [ ] Record the launch video in Screen Studio with the local sound pack, and use the poster frame as its cover.

## Still blocking a public release

- [ ] Apple Developer Program membership, for Developer ID signing and notarization. Until then the app is unsigned and everyone has to click Open Anyway.
- [ ] `scripts/bundle.sh --release` doesn't exist yet. It needs a universal build, a DMG, and only the synthesised sounds, never `prototype/public/sounds/local/`.
- [ ] The website's domain and host. Then run `SITE_URL=https://… npm run build:release` in `prototype/` and deploy `prototype/dist/`.
- [ ] The demo GIF and the launch recording.
- [ ] A GitHub release with the DMG and its checksum.
- [ ] A Homebrew cask, which waits for signing.

Not blocking: at 16 and 32 pt on non-Retina screens, macOS 26 and later draw a grey frame round any app icon that ships only as an .icns. Fixing that takes an Icon Composer icon compiled with Xcode's `actool`.

## Draft X thread

Post 1 carries the screen recording, with the poster frame as its cover. Post 5 carries the announcement card.

> **1/** I put the radio wheel from open-world games on my Mac.
>
> Hold ⌥Q, flick toward a playlist, let go. Music tunes in mid-song with a burst of static.
>
> Free and open source.

> **2/** Every station is one of your Music playlists, shown as its album art. Up to 25 fit on the wheel.
>
> Tap ⌥Q to skip to the next one. Rest on a station for a second and it tunes in. Radio Off pauses.

> **3/** My favourite part: the stations act like radio.
>
> Each one plays its playlist on a loop, as if it's been on air all year. You drop in mid-song, not back at track one. Come back an hour later and it's moved on.

> **4/** While the wheel is open, Music drops to 40% volume and, if you let it use Screen Recording, the screen behind fades to grey. Let go and both come back.
>
> It's a native menu bar app. No account, and nothing leaves your Mac.

> **5/** macOS 14 or later. You can build it from source today; a signed download comes later.
>
> github.com/HAPPYS1NGH/free-roam
>
> What would your first station be?

Other openers to try for post 1:

- "My Mac has a radio wheel now. ⌥Q, flick, static, new playlist."
- "Changing the mood on a Mac means opening Music and scrolling. In a game it's one flick. So I built the flick."
