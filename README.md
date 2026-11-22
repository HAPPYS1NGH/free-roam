<p align="center">
  <img src="site/public/free-roam/badge.png" width="120" height="120" alt="Free Roam">
</p>

<h1 align="center">Free Roam</h1>

<p align="center">Your Music or Spotify playlists on a radio wheel. Hold ⌥Q, flick, let go.</p>

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

https://github.com/user-attachments/assets/4644947d-9f4c-403b-88ef-29e547737867

Free Roam brings the radio wheel from open-world driving games to your Mac. Hold ⌥Q in any app and your playlists appear on a wheel. Flick toward one, let go, and your music app tunes in with a burst of static.

Stations behave like radio. Each playlist plays on a loop, on a clock, as if it has been on air all year. You drop in mid-song, and the wheel shows what's playing on every station before you pick one.

## How to use it

| Do this | What happens |
|---|---|
| Hold <kbd>⌥</kbd> <kbd>Q</kbd> | The wheel opens over whatever you're doing, and the music turns down |
| Move the mouse or scroll | Picks a station and shows what's on it |
| Let go | Tunes in |
| Tap <kbd>⌥</kbd> <kbd>Q</kbd> | Skips to the next station |
| Pick Radio Off | Pauses the music |
| Press <kbd>Esc</kbd> while holding <kbd>⌥</kbd> | Closes the wheel without changing station |

Choose your stations in **Settings → Stations**, from the menu bar icon. Drag them into order, and click a cover to add or remove a playlist. **Settings → General** has the cinematic backdrop, opening at login and update checks. **Launch at Login** is in the menu too. Free Roam plays from Music or Spotify, never both. Switch with **Play from** in Settings or in the menu. Free Roam has no Dock icon.

## Install

1. [Download FreeRoam.dmg](https://github.com/HAPPYS1NGH/free-roam/releases/latest/download/FreeRoam.dmg).
2. Open it and drag Free Roam to Applications.
3. Open Free Roam, then hold ⌥Q.

The app is signed and notarized by Apple, so it opens without a warning. Older versions and checksums are on [Releases](https://github.com/HAPPYS1NGH/free-roam/releases).

**Requirements:** macOS 14 or later, and the Music app or the Spotify desktop app. In Music, songs you own play without a subscription and Apple Music songs need one. Spotify works with Free and Premium.

**Updating:** The second time you open Free Roam, it asks whether to check for updates on its own. Say yes and it checks once a day. Or choose **Check for Updates…** in the menu bar menu. You can turn the daily check on or off in **Settings → General**. Your stations and permissions carry over.

## Permissions and privacy

Free Roam asks for at most two things:

- **Control Music** or **Control Spotify** (required, for the app you pick). Lets Free Roam switch playlists and turn the volume down while the wheel is open. macOS asks the first time you use each one, or when you choose Allow in the welcome window.
- **Screen Recording** (optional), for the **Cinematic backdrop**, which fades the screen behind the wheel so your stations stand out. Turn it on in the welcome window or in **Settings → General**, where you can see the wheel with and without it. **Turn On Cinematic Backdrop…** in the menu opens the same tab. Free Roam never asks by itself, and without it the wheel works the same over a tinted background. Only System Settings can turn it off again.

The welcome window shows at launch until Free Roam may control the app you play from, or until you choose Don't Show This Again. The backdrop doesn't count.

What it doesn't do:

- It never saves or sends what's on your screen. It uses the capture only to draw the backdrop.
- It has no analytics. Its only network requests download Spotify song covers from Spotify's image server and check GitHub for a new version, if you let it. The update check sends GitHub only Free Roam's version number.
- It doesn't need Accessibility or Input Monitoring. ⌥Q is a standard macOS global shortcut, so other keys never pass through Free Roam.

## FAQ

### Does it work with Spotify?

Yes. Pick Spotify under **Play from** in Settings, and your Spotify playlists show up there like Music's. Free Roam uses the command-line tool that comes inside the Spotify app, so changing station plays in the background without bringing Spotify forward or switching desktops. Use the latest Spotify (1.3.10 or later), on Apple silicon or Intel. On an older Spotify, Free Roam can't find your playlists. It works with Free and Premium.

### Why does a station start in the middle of a song?

That's the radio part. Every station keeps playing on a clock while you're away, so you tune in to wherever it is now, like a real station.

### Can I change the ⌥Q shortcut?

Not yet. If another app already uses ⌥Q, quit that app or turn its shortcut off, then reopen Free Roam.

### Nothing happens when I hold ⌥Q

- Check that Free Roam is running. Its icon should be in the menu bar.
- Open System Settings → Privacy & Security → Automation and make sure Free Roam is allowed to control Music or Spotify, whichever you picked. If it isn't, the menu bar menu shows **Allow Free Roam to Control Music…** (or Spotify).
- Check that no other app uses ⌥Q (see above).

### How do I uninstall it?

Quit Free Roam from the menu bar and move it to the Trash. To also forget its stations, its copy of your Spotify playlists and its permissions:

```sh
defaults delete com.happys1ngh.freeroam
rm -f ~/Library/Application\ Support/Free\ Roam/spotify-playlists.json
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

- Updates come through [Sparkle](https://sparkle-project.org), under the MIT License.
- The wheel's type is [Sofia Sans Extra Condensed](https://github.com/lettersoup/Sofia-Sans), under the SIL Open Font License.
- Inspired by the radio wheels in open-world driving games. Free Roam isn't affiliated with any game or with Apple.

## License

[MIT](LICENSE) © Harpreet Singh
