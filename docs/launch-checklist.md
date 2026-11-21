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
- [ ] Record the launch video in Screen Studio with the app's sounds on, and use the poster frame as its cover.

## Still blocking a public release

- [ ] Apple Developer Program membership, for Developer ID signing and notarization. Until then the app is unsigned and everyone has to click Open Anyway.
- [ ] `scripts/bundle.sh --release` doesn't exist yet. It needs a universal build and a DMG, with the sounds from `assets/sounds/`.
- [ ] Deploy the website to freeroam.happys1ngh.com, as below.
- [ ] The demo GIF and the launch recording.
- [ ] A GitHub release with the DMG and its checksum.
- [ ] A Homebrew cask, which waits for signing.

Not blocking: at 16 and 32 pt on non-Retina screens, macOS 26 and later draw a grey frame round any app icon that ships only as an .icns. Fixing that takes an Icon Composer icon compiled with Xcode's `actool`.

## Deploy the website

The site is the static build of `prototype/`. `prototype/vercel.json` sets clean URLs, a year's immutable caching for the hashed `/assets/` files and the fonts, a day for sounds and images, revalidation for HTML, and security headers. A missing path gets `404.html` with a real 404. Vercel takes the Node version, 24.x, from `engines` in `prototype/package.json`.

To check the build first: `cd prototype && SITE_URL=https://freeroam.happys1ngh.com npm run build:release`. It should end with "Release check passed".

### Vercel

1. On vercel.com, choose Add New → Project and import `HAPPYS1NGH/free-roam`.
2. Set Root Directory to `prototype` and Framework Preset to Vite.
3. Under Build and Output Settings, set Build Command to `npm run build:release` and Output Directory to `dist`. Leave Install Command as it is.
4. Under Environment Variables, add `SITE_URL` with the value `https://freeroam.happys1ngh.com`, for every environment. The release build fails without it.
5. Choose Deploy. Open the `.vercel.app` address it gives you, and check the wheel opens and makes its sounds.
6. Go to the project's Settings → Domains and add `freeroam.happys1ngh.com`. Vercel shows a CNAME target for it. Copy that exact value.

### Namecheap

These steps assume happys1ngh.com uses Namecheap BasicDNS. If its nameservers point somewhere else, add the record there instead.

1. Go to Domain List, then choose Manage next to happys1ngh.com, then open the Advanced DNS tab.
2. Under Host Records, delete any record whose host is `freeroam`: an A, AAAA, CNAME or URL Redirect record. Leave the other hosts alone.
3. Choose Add New Record → CNAME Record. Set Host to `freeroam`, set Value to the target Vercel showed, and leave TTL on Automatic. Save it with the tick.
4. Back in Vercel's Domains page, wait for the domain to show Valid Configuration. Vercel then issues the HTTPS certificate on its own.

### After it's live

- [ ] `https://freeroam.happys1ngh.com/` loads, and the wheel opens with sound.
- [ ] `curl -sI https://freeroam.happys1ngh.com/nowhere` answers `404`, and the browser shows the Wrong Turn page.
- [ ] `curl -sI https://freeroam.happys1ngh.com/` shows `x-frame-options: DENY`, `x-content-type-options: nosniff` and `cache-control: public, max-age=0, must-revalidate`.
- [ ] The page source has `<link rel="canonical" href="https://freeroam.happys1ngh.com/">`, and `/robots.txt` and `/sitemap.xml` name the same address.
- [ ] Share the address somewhere that shows a link preview, to check the social card.

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
