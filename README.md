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
npm run dev
```

Open the URL it prints. Hold <kbd>Q</kbd>, move the mouse or scroll to pick a station, and let go. A quick tap of <kbd>Q</kbd> skips to the next station. The panel on the right tunes every size, colour and timing, and exports them as `tokens.json`.

`npm run library` writes to `prototype/public/library/`, which is gitignored, so your library stays on your Mac.

To try other sounds, put WAVs named like the ones in `prototype/public/sounds/` into `prototype/public/sounds/local/`, which is also gitignored. The panel's Sound Pack switch flips between them and the built-in ones, and any sound missing from the local folder falls back to the built-in one.

## Build the Mac app

The Mac app is a work in progress. Hold ⌥Q in any app for the radio wheel, with your playlists' album art, over a desaturated and vignetted screen. Flick or scroll to a station and let go, and Music tunes in mid-song. A quick tap skips to the next station. Settings isn't done yet. You need Xcode 16 or later.

```sh
scripts/make-signing-cert.sh   # once per Mac
scripts/bundle.sh --run        # builds dist/Static.app and opens it
swift test
```

If `prototype/public/sounds/local/` has sounds in it, `bundle.sh` uses them instead of the synthesised ones with the same name, as the prototype's Local pack does. That's only for builds on your own Mac.

macOS asks once to let Static control Music and once for Screen Recording, which desaturating the screen needs. Without Screen Recording the wheel gets the vignette and tint only. The certificate keeps the app's identity the same from build to build, so your answers stick. Without it, `bundle.sh` signs ad hoc and macOS forgets the Screen Recording permission after every build.

## Requirements

- macOS 14 or later
- The Music app. An Apple Music subscription is optional, since your local library works too.

## License

MIT
