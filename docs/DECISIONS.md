# Decisions

## 2026-10-22: The radio wheel copies GTA V's

Decided from the prototype in `prototype/`.

- v1 is the radio wheel only. The weapon wheel moves to Later: mapping playlists onto weapon slots needs setup from the user, and it works better as a second launch post.
- Layout, states and behaviour follow GTA V's PC radio wheel, with numbers measured from 1920×1080 in-game captures (%H = percent of screen height):
  - a ring of round station logos with Radio Off at the bottom, stations running clockwise from it
  - logos sit 9.15%H apart, so the ring grows with the station count: radius = N × 9.15%H / 2π, capped at 30.5%H. Logos are 8.3%H and shrink only once the ring is full
  - the wheel sits 4.3%H above screen centre
  - unselected logos are greyscale at 35% opacity. The selected one is opaque, 3% larger, with a 0.55%H ring in `#65B4D4` and a 1.5px dark edge. Presets: `#ABEDAB`, `#FFA357`, `#2D6EB9`
  - deliberate difference: GTA's logos stay white when selected; ours turn full colour so you can recognise the album art (`selectedInColour` turns it off)
  - three lines of white text (station, ARTIST, title) outlined in black, 2.6%H Avenir Next Condensed Demi Bold, lines 3.4%H apart, the first 5%H above the ring's centre
  - backdrop: blur 2.5%H, saturation 0.3, brightness 0.85. Desaturating other apps on macOS needs a screen capture and Screen Recording permission, so the Mac app has to choose between that and blur only
- Station logos are a 2×2 mosaic of album covers from the playlist's first four distinct albums. Music's scripting interface returns no playlist artwork (every playlist reports 0), but track artwork comes back as 600–1200px JPEGs.
- Motion: opacity only. The wheel fades in over 80ms with `cubic-bezier(0.23, 1, 0.32, 1)` and out over 70ms with `cubic-bezier(0.4, 0, 1, 1)`; the backdrop shares that timing. The highlight jumps instantly. It opens dozens of times a day from the keyboard, so anything more reads as lag.
- Input: holding Q for 150ms opens the wheel; a quicker tap skips to the next station (skipping Radio Off), as in GTA. The pick comes from mouse movement since opening (a clamped virtual cursor with a 1.5%H dead zone), not the cursor's position. One scroll notch moves one station. The wheel opens with the playing station selected.
- Live tuning: like GTA, the station changes while you hover once the pick rests for 1 second. Releasing Q tunes immediately.
- Broadcast clock: every playlist behaves as if it has looped since 2026-01-01 UTC. Tuning in plays the track that is "on air" and sets Music's `player position` partway into it, and the centre text can show what's on before you tune in.
- Sounds are synthesised in `prototype/scripts/make-sounds.mjs`. No GTA audio, logos, station names or fonts are used anywhere.

Rejected:

- **Arcade** (wedge ring with generated badges), **Tuner** (analogue dial with a sprung needle), **Halo** (glass with floating covers). All three were "inspired by" GTA. The goal is the GTA wheel itself.
- Generated typographic station logos: the user preferred their real Apple Music art.
- Scroll-to-skip-track inside the wheel: GTA uses scroll to move between stations.
- Spring animations on open and highlight: they add motion to something triggered too often to animate.
- A fixed ring size (first rebuild: 38%H radius, 11.5%H logos): GTA sizes the ring from the station count, and the fixed size looked sparse with 13 slots.
- A 300ms live-tune delay: GTA waits about a second, and the shorter delay retuned while you were still aiming.
