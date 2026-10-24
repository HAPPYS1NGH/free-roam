# Static

Hold ⌥Q and a radio wheel pops up over whatever you're doing. Flick the mouse toward a station, let go, and Apple Music switches playlist with a burst of radio static.

It's a macOS menu bar app inspired by the radio and weapon wheels in open-world driving games. Work in progress.

## Status

- [x] Browser prototype of the radio wheel (`prototype/`)
- [ ] Mac app: radio wheel
- [ ] Weapon wheel (after v1)
- [ ] v1.0 release

The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Try Free Roam

The website uses the After Hours design. The full-screen demo shares the original wheel renderer, saved tokens, and interaction controller.

```sh
cd prototype
npm install
npm run dev
```

Open `/free-roam/` for the website or `/` for the full-screen demo. Hold **Q**, move or scroll, then release to choose a station. Tap **Q** to skip. You can also click Choose a station, use the arrow keys and Enter, or tap a station. Radio Off clears the selection. Escape closes the wheel.

The public demo uses curated popular songs and album covers from Apple's public catalog. It does not stream songs or load your personal Music export. Open, close, hover, and retune effects are copied from Static build 96 and are enabled on the first interaction. The sound control mutes them. Personal wallpapers and unapproved local sound files remain excluded.

```sh
npm test       # privacy, catalog, sound parity, and first-gesture audio tests
npm run build # typecheck, production build, prerender, and release-content check
```

Only files listed in `prototype/scripts/public-assets.mjs` enter the generated `.site-public/` directory and production build. Deploy `prototype/dist/`, never `prototype/public/`. The build checks that private exports and studio controls are absent.

## Local design studio

The old tuning controls are retained for local development and excluded from the production entry points.

```sh
cd prototype
npm run library   # optional: exports your Music playlists and art
npm run wallpaper # optional: copies your desktop picture
npm run studio    # opens /studio.html with DialKit
```

This explicit studio mode serves the original `public/` directory, including any personal exports. Keep it local and never publish that directory. Exported libraries, wallpapers, and `public/sounds/local/` remain gitignored. The studio can export settings to `tokens.json` for the native renderer.

The circular Free Roam badge is `prototype/public/free-roam/app-icon.png`, a transparent PNG with no FM suffix. It is used in the website header and favicon. The native app is still named Static, and its icon has not been replaced. Logo prompts are saved in `output/branding/free-roam/`.

Design decisions and verification are in [docs/free-roam-design.md](docs/free-roam-design.md).

## Build the Mac app

The Mac app is a work in progress. Hold ⌥Q in any app for the radio wheel, with your playlists' album art, over a desaturated and vignetted screen. Flick or scroll to a station and let go, and Music tunes in mid-song. Tuning turns Music's shuffle off and repeat on, so each station plays in order and loops, and leaves them that way. A quick tap skips to the next station. Settings… in the menu bar menu picks which playlists are on the wheel and in what order. You need Xcode 16 or later.

```sh
scripts/make-signing-cert.sh   # once per Mac
scripts/bundle.sh --run        # builds dist/Static.app and opens it
swift test
```

If `prototype/public/sounds/local/` has sounds in it, `bundle.sh` uses them instead of the synthesised ones with the same name, as the prototype's Local pack does. That's only for builds on your own Mac.

macOS asks once to let Static control Music. Screen Recording, which desaturating the screen needs, is optional: Static asks for it only when you choose Allow Screen Recording… in the menu, and without it the wheel gets the vignette and tint only. The certificate keeps the app's identity the same from build to build, so your answers stick. Without it, `bundle.sh` signs ad hoc and macOS forgets the Screen Recording permission after every build.

## Requirements

- macOS 14 or later
- The Music app. An Apple Music subscription is optional, since your local library works too.

## License

MIT
