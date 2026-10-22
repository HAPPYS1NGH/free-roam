# Static: plan

Hold a key, a wheel like GTA's radio wheel appears, flick the mouse, and Apple Music switches playlist with a burst of radio static. Static is a native macOS menu bar app and it's open source.

## Decisions

| Topic | Decision |
|---|---|
| Name | Static (`HAPPYS1NGH/static`, bundle ID `com.happys1ngh.static`) |
| UI | Native SwiftUI wheel; AppKit for the overlay window and hotkeys |
| Music | Apple Music only, controlled through AppleScript |
| Radio wheel | A faithful copy of GTA V's: one station per playlist (up to 25) plus Radio Off. Hold ⌥Q to open, tap for the next station. Numbers in [DECISIONS.md](DECISIONS.md) |
| Weapon wheel | Later, after v1 |
| Wheel position | Centred, 4.3% of screen height above the middle as in GTA. The direction you move the mouse picks the station |
| Backdrop | Desaturated through a screen capture, which needs Screen Recording permission. Without it, vignette and tint only |
| Distribution | Open source, unsigned, DMG on GitHub Releases |
| Repo | Public from day one |
| Target | macOS 14+, Apple Silicon and Intel |
| Prototype | Vite + React + TypeScript + Motion, npm |
| Licence | MIT |

## Constraints

Checked on this Mac or known limits of macOS:

- `swift build` works with the Command Line Tools. Tests and universal (Intel + Apple Silicon) builds need full Xcode, so install it before Phase 2.
- Static can't desaturate other apps' windows without Screen Recording permission. The vignette and cool tint are plain overlays and need no permission; only the desaturation needs a screen capture.
- Apple Music doesn't expose energy or tempo, so weapon stats come from your library: plays, length, track count and last played.
- The app is unsigned, so each user clicks "Open Anyway" once in System Settings and approves "Static wants to control Music" once.
- Ad-hoc signed builds lose Screen Recording permission on every rebuild, though Music permission survives. Development builds are signed with a self-signed certificate so both stick; see [DECISIONS.md](DECISIONS.md).

## How it works

```text
⌥Q pressed (works in any app)
  Hotkey.onKeyDown
    MusicBridge.setVolume(40%)           Apple Event → Music.app
    OverlayPanel.show()                  transparent window over the screen
      RadioWheelView appears, screen filter fades in
  every frame while held
    mouse movement since open → angle → highlighted slot
⌥Q released
  Hotkey.onKeyUp
    OverlayPanel.hide()
    if a slot is highlighted
      play static.wav
      MusicBridge.play(playlistID)       Apple Event → Music.app
    MusicBridge.restoreVolume()
Music.app changes track
  com.apple.Music.playerInfo → NowPlaying updates the centre label
```

## Phase 0: Setup

- [x] Project folder, git, `.gitignore`, plan
- [x] MIT `LICENSE`, README stub
- [x] Create public repo `HAPPYS1NGH/static` and push
- [x] You: install Xcode from the App Store (needed before Phase 2)

## Phase 1: HTML prototype (`prototype/`)

The goal is to settle how the wheel looks and moves, down to the exact numbers, before writing any Swift.

- [x] Radio wheel copied from GTA V: ring layout, see-through idle logos, accent ring, outlined caption, desaturated and vignetted backdrop
- [x] Station logos: a 2×2 mosaic of each playlist's album covers (`npm run library` exports yours into a gitignored folder)
- [x] Live tuning after a 1 second rest, a quick tap of Q for the next station, scrolling to step, and a broadcast clock so stations start mid-song
- [x] Synthesised sounds: open, close, hover tick and three retune takes (`npm run sounds`)
- [x] Tuning panel with an export to `tokens.json`
- [x] Pick a retune take (`retune`) and export `prototype/tokens.json` from the tuned defaults

**Done when:** you like the feel, `tokens.json` is committed and there's a screen recording for X post #1.

## Phase 2: Mac app with the radio wheel (MVP)

```text
static/
├── Package.swift
├── Sources/Static/
│   ├── StaticApp.swift          # entry point, menu bar icon
│   ├── StatusMenu.swift         # the menu bar menu
│   ├── PermissionProbe.swift    # debug builds: `--probe` prints what macOS allows
│   ├── Info.plist               # copied into Static.app by scripts/bundle.sh
│   ├── Hotkey.swift             # global press and release (Carbon, no permission)
│   ├── OverlayPanel.swift       # borderless panel, all Spaces, over full-screen apps
│   ├── Wheel/
│   │   ├── WheelStyle.swift     # numbers from prototype/tokens.json
│   │   ├── WheelGeometry.swift  # ring layout, flick angle → slot
│   │   ├── Broadcast.swift      # which track is "on air", and how far in
│   │   └── RadioWheelView.swift
│   ├── Backdrop/
│   │   └── ScreenCapture.swift  # Screen Recording permission and capture
│   ├── Music/
│   │   ├── MusicBridge.swift    # AppleScript commands, off the main thread
│   │   └── NowPlaying.swift     # track-change notifications
│   ├── Settings/
│   │   └── StationsSettingsView.swift
│   └── Resources/           # the .wav files from prototype/public/sounds
├── Tests/StaticTests/
└── scripts/
    ├── bundle.sh                # builds and signs Static.app
    └── make-signing-cert.sh     # self-signed certificate for development, once per Mac
```

- [x] First build: a menu bar app that lists your playlists, plays one and captures the screen, built and signed by `scripts/bundle.sh`

- `Info.plist`: no Dock icon (`LSUIElement`), plus the text for the Music permission prompt (`NSAppleEventsUsageDescription`). Without that text, macOS silently blocks the commands.
- Menu bar menu: Settings… and Quit, plus "Allow Static to control Music" if permission was denied. That item opens System Settings → Automation.
- MusicBridge commands:
  - list playlists (name and persistent ID)
  - play track N of a playlist (by persistent ID) and set `player position`, for mid-song tune-in
  - pause and next track
  - album artwork of a playlist's first four distinct albums (playlists themselves expose none)
  - get and set the volume
  - check whether Music is running
- Playlists are always addressed by persistent ID and names are escaped, so a playlist called `"; do shell script …` can't inject AppleScript.
- Volume dip: ramp to 40% when the wheel opens. Restore it when the wheel closes and when the app quits.
- Settings: choose which playlists appear and in what order, saved in `UserDefaults` by persistent ID. The first run uses your playlists in library order.
- Backdrop: desaturate other apps through a screen capture, as decided in [DECISIONS.md](DECISIONS.md). That needs Screen Recording permission. If it's denied, show the vignette and tint only, which need none.
- Edge cases:
  - Music isn't running: don't launch it just to show the wheel; launch it when a station is picked.
  - A playlist was deleted: it drops off the ring.
  - Two playlists share a name.
  - Several displays: show the wheel on the screen with the mouse.
  - Full-screen apps.
  - No Apple Music subscription: the local library still works.
- Tests:
  - angle → slot, including the dead zone and wrapping past 360°
  - broadcast clock: the right track and position, including wrap-around and empty playlists
  - loading the slot config when a playlist is missing
  - AppleScript string escaping

**Done when:** in any app, hold ⌥Q, flick, release, and Music tunes in mid-song with the static burst. X post #2.

## Phase 3: Weapon wheel (moved to Later)

v1 ships the radio wheel only; see [DECISIONS.md](DECISIONS.md). The earlier design (8 mood slots, cycling playlists within each, stats from your library) is the starting point when it comes back.

## Phase 4: Release v1.0

- `scripts/bundle.sh --release`: universal build, ad-hoc signed, packed into a DMG with `hdiutil`.
- GitHub Release with the DMG and a checksum.
- README with:
  - a GIF of it working
  - install steps, including "Open Anyway"
  - why the app asks to control Music
  - build-from-source steps
- Launch video recorded in Screen Studio, plus a thread written with the `banger-tweets` skill.
- Homebrew waits until the app is signed. Homebrew is phasing out casks that fail macOS's Gatekeeper check, which an unsigned app does.

## Later

- Weapon wheel (⌥Tab)
- Controller support (GameController framework): D-pad left for radio, L1 for weapons, right stick picks
- Spotify (also scriptable with AppleScript)
- Custom hotkeys (`KeyboardShortcuts` package)
- AI station names and taglines, and an AI DJ between songs (Claude API, using the user's own key)
- Apple Music catalog radio stations (MusicKit, needs a paid developer account)
- Signing and notarization, Homebrew, Sparkle auto-updates
- Launch at login
- Easter eggs, e.g. "MISSION PASSED · RESPECT +" when you favourite a song

## X plan

| Post | When | Content |
|---|---|---|
| 1 | End of Phase 1 | Prototype clip: "making Apple Music feel like GTA" |
| 2 | End of Phase 2 | First real switch on the Mac, with sound |
| 3 | After v1 | Weapon wheel: "you asked for it" |
| 4 | v1.0 | Launch video, repo link, download |

## Rules

- No GTA, Rockstar or Take-Two names, logos, fonts, station names or sounds anywhere. Static is "inspired by".
- Plain Q and Tab are never captured globally; only ⌥Q and ⌥Tab are.
