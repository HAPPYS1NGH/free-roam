<p align="center">
  <img src="site/public/free-roam/badge.png" width="120" height="120" alt="Free Roam">
</p>

<h1 align="center">Free Roam</h1>

<p align="center">Your Music playlists on a radio wheel. Hold ⌥Q, flick, let go.</p>

<p align="center">
  <a href="https://github.com/HAPPYS1NGH/free-roam/releases/latest">Download for Mac</a> ·
  <a href="https://freeroam.happys1ngh.com">Try it in your browser</a>
</p>

<!-- Demo GIF: save the recording as media/demo.gif, then replace this comment with
<p align="center"><img src="media/demo.gif" width="720" alt="Holding Option-Q opens the radio wheel over the desktop, a flick picks a playlist, and Music switches to it"></p>
-->

Free Roam is the radio wheel from open-world driving games, for your Mac. Hold ⌥Q in any app and your playlists appear on a wheel. Flick toward one and let go, and Music tunes in with a burst of static.

- **Stations act like radio.** Each playlist plays on a loop, on a clock, as if it's been on air all year. You drop in mid-song, and the wheel shows what's playing on every station.
- **Tap ⌥Q** to skip to the next station. Radio Off pauses.
- **Pick your stations** in Settings: drag them into order and click a cover to add or remove a playlist.
- **Lives in the menu bar.** It has no Dock icon. Turn on Launch at Login from the menu.

## Install

1. Download `Free Roam-<version>.dmg` from [Releases](https://github.com/HAPPYS1NGH/free-roam/releases/latest).
2. Open it and drag Free Roam to Applications.
3. Open Free Roam, then hold ⌥Q.

The app is signed and notarized by Apple, so it opens without warnings.

## Permissions

- **Control Music** (required): so Free Roam can play your playlists and turn Music down while the wheel is open. macOS asks the first time.
- **Screen Recording** (optional): fades the colour from the screen behind the wheel. Free Roam only asks if you choose Allow. It never saves or sends what's on your screen.

## Requirements

- macOS 14 or later
- The Music app. Songs you own play without a subscription. Apple Music songs need one.

## Build from source

You need Xcode 26 or later.

```sh
scripts/make-signing-cert.sh   # once per Mac, so permissions survive rebuilds
scripts/bundle.sh --run        # builds dist/Free Roam.app and opens it
swift test
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers the website, the design studio, the brand assets and the release build.

## License

MIT
