# Static

Hold ⌥Q and a radio wheel pops up over whatever you're doing. Flick the mouse toward a station, let go, and Apple Music switches playlist with a burst of radio static.

It's a macOS menu bar app inspired by the radio and weapon wheels in open-world driving games. Work in progress.

## Status

- [x] Browser prototype of the radio wheel (`prototype/`)
- [ ] Mac app: radio wheel
- [ ] Weapon wheel (after v1)
- [ ] v1.0 release

The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Try the prototype

The browser prototype is where the look, sound and timing get decided before the Swift app is written.

```sh
cd prototype
npm install
npm run library   # optional: use your own playlists and album art (macOS asks once to allow Music access)
npm run wallpaper # optional: show the wheel over your own desktop picture
npm run dev
```

Open the URL it prints. Hold <kbd>Q</kbd>, move the mouse or scroll to pick a station, and let go. A quick tap of <kbd>Q</kbd> skips to the next station. The panel on the right tunes every size, colour and timing, and exports them as `tokens.json`.

`npm run library` writes to `prototype/public/library/`, which is gitignored, so your library stays on your Mac. `npm run wallpaper` copies your desktop picture to `prototype/public/wallpaper/`, also gitignored. If macOS won't let it ask System Events, pass the picture's path: `npm run wallpaper -- /path/to/picture.jpg`.

The Legibility panel at the top is for keeping the idle discs visible over a busy wallpaper: a backdrop blur, the idle discs' opacity, presets for both, and a 12, 24 or 25 station ring. Its Layout switch tries two ways to keep a crowded ring clear of the caption, and Station Size sets the caption's top line. The hint in the bottom left shows the current values, and Copy values copies them.

To try other sounds, put WAVs named like the ones in `prototype/public/sounds/` into `prototype/public/sounds/local/`, which is also gitignored. The panel's Sound Pack switch flips between them and the built-in ones, and any sound missing from the local folder falls back to the built-in one.

## Free Roam landing-page exploration

With the prototype dev server running, open `/free-roam/` to compare three directions for the proposed Free Roam name:

- **After Hours:** a coastal night drive with an interactive radio wheel.
- **FM / 98.6:** an orange radio poster around the original wheel.
- **Passenger Seat:** a printed travel-journal layout with a wheel demo.

Use the bottom picker or keys **1–3** to switch. Arrow keys also cycle directions. The URL saves the direction as `?v=1`, `?v=2`, or `?v=3`. Hold **Q**, point, and release to tune the wheel, or click a station. Sound is off initially; enabling it plays tuning effects only. The page does not control Music or stream songs.

The exploration lives in `prototype/src/free-roam/`, with its own HTML entry. `npm run build` builds both it and the existing wheel prototype. All three pages now reuse the original `RadioWheel` renderer and the bundled wheel settings. The local preview loads your exported library when available; those files stay gitignored. The Mac app is still named Static. No direction has been selected for production.

A draft Free Roam logo with a transparent background is at `prototype/public/free-roam/logo-concept.png`. It is shown in the page header; it has not replaced the native app icon.

Design references and verification notes are in [docs/free-roam-design.md](docs/free-roam-design.md).

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
