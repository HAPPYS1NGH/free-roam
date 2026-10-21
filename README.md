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

## Requirements

- macOS 14 or later
- The Music app. An Apple Music subscription is optional, since your local library works too.

## License

MIT
