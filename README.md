<p align="center">
  <img src="site/public/free-roam/badge.png" width="120" height="120" alt="Free Roam">
</p>

<h1 align="center">Free Roam</h1>

<p align="center">Your Music playlists on a radio wheel. Hold ⌥Q, flick, let go.</p>

<p align="center">
  <a href="https://github.com/HAPPYS1NGH/free-roam/releases/latest/download/FreeRoam.dmg"><b>Download for Mac</b></a> ·
  <a href="https://freeroam.happys1ngh.com">Try it in your browser</a> ·
  <a href="#permissions-and-privacy">Privacy</a> ·
  <a href="#faq">FAQ</a>
</p>

<p align="center">
  <a href="https://github.com/HAPPYS1NGH/free-roam/releases/latest"><img src="https://img.shields.io/github/v/release/HAPPYS1NGH/free-roam?label=release" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/macOS-14%2B-black" alt="macOS 14 or later">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/HAPPYS1NGH/free-roam" alt="MIT license"></a>
</p>

https://github.com/user-attachments/assets/VIDEO_ID

Free Roam brings the radio wheel from open-world driving games to your Mac. Hold ⌥Q in any app and your playlists appear on a wheel. Flick toward one, let go, and Music tunes in with a burst of static.

Stations behave like radio. Each playlist plays on a loop, on a clock, as if it has been on air all year. You drop in mid-song, and the wheel shows what's playing on every station before you pick one.

## How to use it

| Do this | What happens |
|---|---|
| Hold <kbd>⌥</kbd> <kbd>Q</kbd> | The wheel opens over whatever you're doing, and Music turns down |
| Move the mouse or scroll | Picks a station and shows what's on it |
| Let go | Tunes in |
| Tap <kbd>⌥</kbd> <kbd>Q</kbd> | Skips to the next station |
| Pick Radio Off | Pauses Music |
| Press <kbd>Esc</kbd> while holding <kbd>⌥</kbd> | Closes the wheel without changing station |

Choose your stations in **Settings**, from the menu bar icon. Drag them into order, and click a cover to add or remove a playlist. **Launch at Login** is in the same menu. Free Roam has no Dock icon.

## Install

1. [Download FreeRoam.dmg](https://github.com/HAPPYS1NGH/free-roam/releases/latest/download/FreeRoam.dmg).
2. Open it and drag Free Roam to Applications.
3. Open Free Roam, then hold ⌥Q.

The app is signed and notarized by Apple, so it opens without a warning. Older versions and checksums are on [Releases](https://github.com/HAPPYS1NGH/free-roam/releases).

**Requirements:** macOS 14 or later and the Music app. Songs you own play without a subscription. Apple Music songs need one.

**Updating:** Free Roam doesn't update itself yet. Download the new DMG and replace the app in Applications. Your stations and permissions carry over.

## Permissions and privacy

Free Roam asks for at most two things:

- **Control Music** (required). Lets Free Roam switch playlists and turn Music down while the wheel is open. macOS asks the first time you use it.
- **Screen Recording** (optional). Fades the colour out of the screen behind the wheel. Free Roam only asks if you choose Allow. Without it, the wheel works the same over a tinted background.

What it doesn't do:

- It never saves or sends what's on your screen. It uses the capture only to draw the backdrop.
- It makes no network requests and has no analytics.
- It doesn't need Accessibility or Input Monitoring. ⌥Q is a standard macOS global shortcut, so other keys never pass through Free Roam.

## FAQ

### Does it work with Spotify?

No. Free Roam controls the Music app only.

### Why does a station start in the middle of a song?

That's the radio part. Every station keeps playing on a clock while you're away, so you tune in to wherever it is now, like a real station.

### Can I change the ⌥Q shortcut?

Not yet. If another app already uses ⌥Q, quit that app or turn its shortcut off, then reopen Free Roam.

### Nothing happens when I hold ⌥Q

- Check that Free Roam is running. Its icon should be in the menu bar.
- Open System Settings → Privacy & Security → Automation and make sure Free Roam is allowed to control Music. If it isn't, the menu bar menu shows **Allow Free Roam to Control Music…**.
- Check that no other app uses ⌥Q (see above).

### How do I uninstall it?

Quit Free Roam from the menu bar and move it to the Trash. To also forget its stations and permissions:

```sh
defaults delete com.happys1ngh.freeroam
tccutil reset All com.happys1ngh.freeroam
```

## Build from source

You need Xcode 26 or later.

```sh
scripts/make-signing-cert.sh   # once per Mac, so permissions survive rebuilds
scripts/bundle.sh --run        # builds dist/Free Roam.app and opens it
swift test
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers the website, the design studio, the brand assets and the release build.

## Credits

- The wheel's type is [Sofia Sans Extra Condensed](https://github.com/lettersoup/Sofia-Sans), under the SIL Open Font License.
- Inspired by the radio wheels in open-world driving games. Free Roam isn't affiliated with any game or with Apple.

## License

[MIT](LICENSE) © Harpreet Singh
