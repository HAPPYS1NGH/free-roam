# Free Roam: plan

Hold a key, a wheel like GTA's radio wheel appears, flick the mouse, and Apple Music switches playlist with a burst of radio static. Free Roam is a native macOS menu bar app and it's open source.

## Decisions

| Topic | Decision |
|---|---|
| Name | Free Roam (`HAPPYS1NGH/free-roam`, bundle ID `com.happys1ngh.freeroam`) |
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
- Free Roam can't desaturate other apps' windows without Screen Recording permission. The vignette and cool tint are plain overlays and need no permission; only the desaturation needs a screen capture.
- Apple Music doesn't expose energy or tempo, so weapon stats come from your library: plays, length, track count and last played.
- The app is unsigned, so each user clicks "Open Anyway" once in System Settings and approves "Free Roam wants to control Music" once.
- Ad-hoc signed builds lose Screen Recording permission on every rebuild, though Music permission survives. Development builds are signed with a self-signed certificate so both stick; see [DECISIONS.md](DECISIONS.md).

## How it works

```text
⌥Q pressed (works in any app)
  Hotkey.onPress
    MusicBridge.nowPlaying()             the station the wheel opens on, and Music's track for the caption
    BackdropStill.make()                 captures and filters the screen with the mouse
  still held after 150 ms
    OverlayPanel.show()                  transparent window over the screen
      pointer hidden and held still, open sound
      RadioWheelView fades in, BackdropView fades in over 150 ms
    VolumeDip.lower()                    Music to 40% of its volume
  while held
    mouse movement since open → angle → highlighted slot, a hover tick per station
    resting on a station for 1 s tunes in
⌥Q or ⌥ released (a quicker tap tunes the next station and drops the still)
  Hotkey.onRelease
    OverlayPanel.stopInput()             pointer back, wheel fades out, close sound
      BackdropView fades out over 450 ms, then the panel leaves the screen
    if the pick moved
      play retune.wav
      Broadcast.onAir → MusicBridge.play(track N) with shuffle off and repeat on, then seek(to: on-air position)
    VolumeDip.restore()
    StationList.reload()                 once any tune has reached Music, for playlists added or deleted
```

## Phase 0: Setup

- [x] Project folder, git, `.gitignore`, plan
- [x] MIT `LICENSE`, README stub
- [x] Create the public repo and push (now `HAPPYS1NGH/free-roam`)
- [x] You: install Xcode from the App Store (needed before Phase 2)

## Phase 1: HTML prototype (`prototype/`)

The goal is to settle how the wheel looks and moves, down to the exact numbers, before writing any Swift.

- [x] Radio wheel copied from GTA V: ring layout, see-through idle logos, accent ring, outlined caption, desaturated and vignetted backdrop
- [x] Station logos: a 2×2 mosaic of each playlist's album covers (`npm run library` exports yours into a gitignored folder)
- [x] Live tuning after a 1 second rest, a quick tap of Q for the next station, scrolling to step, and a broadcast clock so stations start mid-song
- [x] Synthesised sounds: open, close, hover tick and three retune takes (`npm run sounds`)
- [x] Tuning panel with an export to `tokens.json`
- [x] Pick a retune take (`retune`) and export `prototype/tokens.json` from the tuned defaults

**Done when:** you like the feel and `tokens.json` is committed.

## Phase 2: Mac app with the radio wheel (MVP)

```text
free-roam/
├── Package.swift
├── Sources/FreeRoam/
│   ├── FreeRoamApp.swift        # entry point, menu bar icon, app delegate
│   ├── StatusMenu.swift         # the menu bar menu
│   ├── PermissionProbe.swift    # debug builds: `--probe` prints what macOS allows
│   ├── Info.plist               # copied into Free Roam.app by scripts/bundle.sh
│   ├── Hotkey.swift             # global press and release (Carbon, no permission)
│   ├── OverlayPanel.swift       # borderless panel, all Spaces, over full-screen apps
│   ├── Wheel/
│   │   ├── WheelStyle.swift     # numbers from prototype/tokens.json
│   │   ├── WheelGeometry.swift  # ring layout, flick angle → slot
│   │   ├── ScrollStepper.swift  # scroll distance → one station per event
│   │   ├── Broadcast.swift      # which track is "on air", and how far in
│   │   ├── RadioWheelModel.swift # hold, tap, pick and tune
│   │   ├── RadioWheelView.swift  # discs, logos, caption, open and close
│   │   ├── StationDetails.swift  # each station's tracks and logo, loaded in the background
│   │   ├── WheelSounds.swift     # open, close, hover and retune
│   │   └── VoiceMixer.swift      # mixes the sounds on the audio thread
│   ├── Backdrop/
│   │   ├── ScreenCapture.swift  # Screen Recording permission and capture
│   │   ├── BackdropStill.swift  # the capture on press, desaturated with Core Image
│   │   ├── StillHandoff.swift   # keeps each press's still for its own open
│   │   └── BackdropView.swift   # the still, wash and vignette behind the wheel
│   ├── Music/
│   │   ├── MusicBridge.swift    # AppleScript commands, off the main thread
│   │   └── VolumeDip.swift      # Music quieter while the wheel is open
│   ├── Settings/
│   │   ├── StationList.swift    # the stations on the wheel, saved by persistent ID
│   │   └── StationsSettingsView.swift # tick and drag playlists onto the wheel
│   └── Resources/               # the caption font and its OFL licence
├── Tests/FreeRoamTests/
└── scripts/
    ├── bundle.sh                # builds and signs Free Roam.app
    └── make-signing-cert.sh     # self-signed certificate for development, once per Mac
```

Build order. The riskiest parts come first, and the app works end to end before it looks right:

- [x] First build: a menu bar app that lists your playlists, plays one and captures the screen, built and signed by `scripts/bundle.sh`
- [x] Wheel logic, no UI: `WheelStyle` from `tokens.json`, ring layout, angle → slot and the broadcast clock, with tests. `bundle.sh` copies resources into `Contents/Resources`, because SwiftPM's resource bundles don't fit an app's layout
- [x] Hotkey and overlay: hold ⌥Q to open and tap for the next station, a panel on the screen with the mouse that covers full-screen apps and every Space, and mouse and scroll input while it's held. Plain circles for now. Time a screen capture on open: if it takes much longer than the 150ms filter fade, the backdrop needs a stream that keeps running
- [x] Tuning in, end to end: the on-air track at its position, the volume dip and restore (also on quit), Radio Off pauses, and live tuning after a 1 second rest
- [x] The real wheel: album art mosaics, caption, selected ring, open and close timing, sounds and the bundled font. The pointer hides while the wheel is open
- [x] Backdrop: desaturated capture under the vignette and tint, and the vignette and tint alone without permission. Start the capture when ⌥Q goes down and capture once at launch, so the image is ready when the wheel opens. The menu explains the stale Screen Recording switch
- [x] Settings and the real menu: choose and order stations by persistent ID, drop deleted playlists, Settings…, Quit and "Allow Free Roam to control Music". The test items (Play Playlist, Capture Screen) go. Check the wheel still follows the mouse when Free Roam's Settings window is active
- [x] Edge cases: Music not running or not answering, empty playlists, duplicate names, several displays and no subscription. Shuffle goes off and repeat on, and the caption follows the track Music is actually playing
- [ ] The recording for the first X post, with the local sound pack

- `Info.plist`: no Dock icon (`LSUIElement`), plus the text for the Music permission prompt (`NSAppleEventsUsageDescription`). Without that text, macOS silently blocks the commands.
- Menu bar menu: Settings… and Quit, plus "Allow Free Roam to control Music" if permission was denied, which opens System Settings → Automation, and "Allow Screen Recording…" if that's missing. Free Roam asks for Screen Recording only from that item, never at launch.
- MusicBridge commands:
  - list playlists (name and persistent ID)
  - play track N of a playlist (by persistent ID), with shuffle off and repeat on, and set `player position`, for mid-song tune-in
  - pause, and play on after launching Music
  - the playlist, track number and position Music is playing
  - album artwork of a playlist's first four distinct albums (playlists themselves expose none)
  - get and set the volume
  - check whether Music is running
- Playlists are always addressed by persistent ID and names are escaped, so a playlist called `"; do shell script …` can't inject AppleScript.
- Volume dip: ramp to 40% when the wheel opens. Restore it when the wheel closes and when the app quits.
- Settings: choose which playlists appear and in what order, saved in `UserDefaults` by persistent ID. Until you change anything, the wheel follows library order. After that, new playlists join the end while the wheel has room, and ones you switched off stay off. Opening Settings launches Music hidden if it's closed.
- Backdrop: desaturate other apps through a screen capture, as decided in [DECISIONS.md](DECISIONS.md). That needs Screen Recording permission. If it's denied, show the vignette and tint only, which need none.
- Edge cases:
  - Music isn't running: don't launch it just to show the wheel; launch it when a station is picked.
  - Music stops answering: each script gives up after 10 s.
  - A playlist was deleted: it drops off the ring.
  - A playlist is empty: tuning it pauses Music.
  - Two playlists share a name.
  - Several displays: show the wheel on the screen with the mouse.
  - Full-screen apps.
  - No Apple Music subscription: the local library still works.
- Tests:
  - angle → slot, including the dead zone and wrapping past 360°
  - broadcast clock: the right track and position, including wrap-around and empty playlists
  - loading the slot config when a playlist is missing
  - AppleScript string escaping

**Done when:** in any app, hold ⌥Q, flick, release, and Music tunes in mid-song with the static burst. The first X post.

## Phase 3: Weapon wheel (moved to Later)

v1 ships the radio wheel only; see [DECISIONS.md](DECISIONS.md). The earlier design (8 mood slots, cycling playlists within each, stats from your library) is the starting point when it comes back.

## Phase 4: Release v1.0

- `scripts/bundle.sh --release`: universal build, ad-hoc signed, packed into a DMG with `hdiutil`. It must skip `prototype/public/sounds/local/`, which development builds use when it's there.
- Synthesised sounds that match the local pack, since only synthesised sounds can ship.
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

Nothing has been posted yet. The prototype clip planned for the end of Phase 1 didn't go out, so the first post comes at the end of Phase 2.

| Post | When | Content |
|---|---|---|
| 1 | End of Phase 2 | First real switch on the Mac, with sound |
| 2 | After v1 | Weapon wheel: "you asked for it" |
| 3 | v1.0 | Launch video, repo link, download |

## Rules

- No GTA, Rockstar or Take-Two names, logos, fonts, station names or sounds anywhere, including the app's name and icon. Free Roam is "inspired by".
- Plain Q and Tab are never captured globally; only ⌥Q and ⌥Tab are.
