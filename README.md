<p align="center">
  <img src="prototype/public/free-roam/badge.png" width="120" height="120" alt="Free Roam">
</p>

<h1 align="center">Free Roam</h1>

<p align="center">Your Music playlists on a radio wheel. Hold ⌥Q, flick, let go.</p>

<!-- Demo GIF: save the recording as docs/media/demo.gif, then replace this comment with
<p align="center"><img src="docs/media/demo.gif" width="720" alt="Holding Option-Q opens the radio wheel over the desktop, a flick picks a playlist, and Music switches to it"></p>
-->

Hold ⌥Q and a radio wheel pops up over whatever you're doing. Flick the mouse toward a station, let go, and Apple Music switches playlist with a burst of radio static.

It's a macOS menu bar app inspired by the radio and weapon wheels in open-world driving games. Work in progress.

## Status

- [x] Browser prototype of the radio wheel (`prototype/`)
- [ ] Mac app: radio wheel
- [ ] Weapon wheel (after v1)
- [ ] v1.0 release

The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Try the web demo

The website uses the After Hours design. The full-screen demo shares the original wheel renderer, saved tokens, and interaction controller.

```sh
cd prototype
npm install
npm run dev
```

Open `/free-roam/` for the website or `/` for the full-screen demo. Hold **Q**, move or scroll, then release to choose a station. Tap **Q** to skip. You can also click Choose a station, use the arrow keys and Enter, or tap a station. Radio Off clears the selection. Escape closes the wheel.

The public demo includes four explicitly approved playlists: God's Favorite, gym, PLow, and Morning Playlist, alongside six public-catalog selections. Only their approved track metadata and artwork are copied into the demo; it never loads the full Music export or streams songs. The open, close, hover and retune sounds are the synthesised ones a release of the app ships. They start on your first interaction, and the sound control mutes them. The build copies only the files on an allowlist, so your wallpaper and the local sound pack stay out. When `public/sounds/local/` or `public/wallpaper/` exists on the Mac doing the build, the release check also fails on any built file that's a byte-identical copy of a file in it. It prints which folders it checked and which it skipped. A host has neither folder, so it only skips there.

```sh
npm test      # playlist, audio, prerender, privacy, and metadata tests
npm run build # typecheck, production build, prerender, and release-content check
```

Only files listed in `prototype/scripts/public-assets.mjs` enter the generated `.site-public/` directory and production build. Deploy `prototype/dist/`, never `prototype/public/`. The build checks that private exports and studio controls are absent.

## Prepare the website for launch

Set `SITE_URL` to the chosen HTTPS origin, without a path, then run `npm run build:release` from `prototype/`. This runs tests and the production build, writes canonical and absolute social-image URLs for both pages, and generates `robots.txt` and `sitemap.xml`. It fails if the origin is missing or invalid. `npm run build` remains available for local previews without a domain.

Publish only `prototype/dist/` to a static host that serves directory `index.html` files. The landing page is `/free-roam/`; the full-screen demo is `/`. Keep missing assets and `/studio.html` as 404s instead of rewriting every URL to the demo. A host's build command is `npm run build:release` with root directory `prototype` and output directory `dist`. Use the committed npm lockfile with `npm ci` for reproducible installation.

The website links to source-build instructions. A downloadable, signed native app is a separate release. See [the launch review](docs/free-roam-release-review.md) for the final device and deployed checks.

## Local design studio

The old tuning controls are retained for local development and excluded from the production entry points.

```sh
cd prototype
npm run library   # optional: exports your Music playlists and art
npm run wallpaper # optional: copies your desktop picture
npm run studio    # opens /studio.html with DialKit
```

This explicit studio mode serves the original `public/` directory, including any personal exports. Keep it local and never publish that directory. Exported libraries, wallpapers, and `public/sounds/local/` remain gitignored. The studio can export settings to `tokens.json` for the native renderer.

The circular Free Roam badge is `prototype/public/free-roam/app-icon.png`, a transparent PNG with no FM suffix. It's the source for everything else: the website's 48 KB header copy, favicon, home screen icon and social card, the Mac app's icon on a navy plate, its menu bar item, and the launch images. `scripts/make-brand-assets.sh` regenerates them all from the badge and the coast photo. Logo prompts are saved in `output/branding/free-roam/`.

Design decisions and verification are in [docs/free-roam-design.md](docs/free-roam-design.md).

## Build the Mac app

The Mac app is a work in progress. Hold ⌥Q in any app for the radio wheel, with your playlists' album art, over a desaturated and vignetted screen. Flick or scroll to a station and let go, and Music tunes in mid-song. Each station acts like radio: it plays its playlist in order on a loop, on a clock, as if it's been on air all year, so you drop in on whatever's on and the wheel shows what's playing on every station. Music only queues the track a station starts on, so Free Roam plays the next one when it ends, which works while Free Roam is running. Tuning turns Music's repeat off. The selected station's ring takes the accent colour from System Settings → Appearance, or Free Roam's blue with Multicolor. A quick tap skips to the next station. Settings… in the menu bar menu shows your stations as discs you drag into order, above a grid of every playlist's cover. Click a cover to put it on the wheel or take it off. You need Xcode 26 or later, because the app uses Swift 6.2.

```sh
scripts/make-signing-cert.sh   # once per Mac
scripts/bundle.sh --run        # builds "dist/Free Roam.app" and opens it
swift test
```

The app was called Static until 2026-10-26. If you built it then, clean up once before the first Free Roam build. A running Static still registers ⌥Q, so both apps would answer the hotkey. Quit Static from its menu bar menu, then remove the old build:

```sh
rm -rf dist/Static.app
# Optional: forget Static's permissions and saved stations
tccutil reset All com.happys1ngh.static
defaults delete com.happys1ngh.static
```

If `prototype/public/sounds/local/` has sounds in it, `bundle.sh` uses them instead of the synthesised ones with the same name, as the prototype's Local pack does. That's only for builds on your own Mac.

When Free Roam starts, a window explains its two permissions, with an Allow button for each. It shows at every launch until you choose Don't Show This Again or both are allowed. macOS asks once to let Free Roam control Music. Screen Recording, which desaturating the screen needs, is optional: Free Roam asks for it only when you choose Allow, in that window or the menu, and without it the wheel gets the vignette and tint only. The certificate keeps the app's identity the same from build to build, so your answers stick. Without it, `bundle.sh` signs ad hoc and macOS forgets the Screen Recording permission after every build.

## Requirements

- macOS 14 or later
- The Music app. Free Roam plays the playlists in it. Songs you own, imported or purchased, play without a subscription; Apple Music songs need one.

## License

MIT
