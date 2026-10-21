# Decisions

## 2026-10-22: The radio wheel copies GTA V's

Decided from the prototype in `prototype/`.

- v1 is the radio wheel only. The weapon wheel moves to Later: mapping playlists onto weapon slots needs setup from the user, and it works better as a second launch post.
- Layout, states and behaviour follow GTA V's PC radio wheel, with numbers measured from 1920×1080 in-game captures (%H = percent of screen height):
  - a ring of round station logos with Radio Off at the bottom, stations running clockwise from it
  - logos sit 9.15%H apart, so the ring grows with the station count: radius = N × 9.15%H / 2π, kept between 22%H and 30.5%H. Logos are 8.3%H at that spacing and keep the same logo-to-gap ratio when the ring stretches or fills up, to a maximum of 10%H. The 22%H floor is ours: GTA has 18 or more stations, and with 13 the ring was too small to hold the caption
  - the wheel sits 4.3%H above screen centre
  - unselected logos are greyscale ghosts at 30% opacity with nothing behind them, so the screen shows through. GTA's measure 35% for black parts and 25% for white. The selected one is opaque, 3% larger, on black, with a 0.55%H ring in `#65B4D4` and a 1.5px dark edge. Presets: `#ABEDAB`, `#FFA357`, `#2D6EB9`
  - deliberate difference: GTA's logos stay white when selected; ours turn full colour so you can recognise the album art (`selectedInColour` turns it off)
  - three lines of white text (station, ARTIST, title) outlined in black, 2.6%H Avenir Next Condensed Demi Bold, lines 3.4%H apart, the first 5%H above the ring's centre
  - backdrop, fitted from frames before and after the wheel opens: no blur. Saturation 0.45, brightness 1.04, a 7% wash of `rgb(70 120 210)`, and a vignette that follows the screen's shape: clear for the first 46% of the way to the corners, then darkening to 70% `rgb(4 8 18)` in them. Desaturating other apps on macOS needs a screen capture and Screen Recording permission. Without it the Mac app gets the vignette and tint only, which are plain overlays
- Station logos are a 2×2 mosaic of album covers from the playlist's first four distinct albums. Music's scripting interface returns no playlist artwork (every playlist reports 0), but track artwork comes back as 600–1200px JPEGs.
- Motion, timed frame by frame from a GTA capture: opacity only. The wheel appears and disappears in 40ms (within one frame in GTA) and the highlight jumps instantly. The screen filter eases in over 150ms and out over 450ms with `cubic-bezier(0.4, 0, 0.6, 1)`, so colour drains back in after the wheel has gone. It opens dozens of times a day from the keyboard, so anything on the wheel itself reads as lag.
- Input: holding Q for 150ms opens the wheel; a quicker tap skips to the next station (skipping Radio Off), as in GTA. The pick comes from mouse movement since opening (a clamped virtual cursor with a 1.5%H dead zone), not the cursor's position. Scrolling moves one station per 30px with no rate limit, so a trackpad flick sweeps the ring at up to ~30 stations a second, as in GTA. The first scroll event of a gesture steps at once, so one mouse-wheel notch moves one station. The wheel opens with the playing station selected.
- Live tuning: like GTA, the station changes while you hover once the pick rests for 1 second. Releasing Q tunes immediately.
- Broadcast clock: every playlist behaves as if it has looped since 2026-01-01 UTC. Tuning in plays the track that is "on air" and sets Music's `player position` partway into it, and the centre text can show what's on before you tune in.
- Sounds are synthesised in `prototype/scripts/make-sounds.mjs`. No GTA audio, logos, station names or fonts are used anywhere.
- Sounds are soft and dark because they play dozens of times a day. They're built from filtered noise and low sines, sit mostly below 2 kHz, have no tones above 1.5 kHz and no distortion. Levels are baked into the files: hover under open and close, both under retune. Retune is a short, muffled car-radio "kssh" that fades out any retune still playing. The hover tick skips repeats under 35ms apart and gets quieter during a fast sweep, so a sweep purrs instead of buzzing.

Rejected:

- **Arcade** (wedge ring with generated badges), **Tuner** (analogue dial with a sprung needle), **Halo** (glass with floating covers). All three were "inspired by" GTA. The goal is the GTA wheel itself.
- Generated typographic station logos: the user preferred their real Apple Music art.
- Scroll-to-skip-track inside the wheel: GTA uses scroll to move between stations.
- Spring animations on open and highlight: they add motion to something triggered too often to animate.
- A fixed ring size (first rebuild: 38%H radius, 11.5%H logos): GTA sizes the ring from the station count, and the fixed size looked sparse with 13 slots.
- A 300ms live-tune delay: GTA waits about a second, and the shorter delay retuned while you were still aiming.
- A blurred, darkened backdrop (2.5%H blur, brightness 0.85): GTA's screen stays sharp, and the blur made the screen look muddy.
- Greyscale idle logos on a black disc: they read as solid grey blobs, while GTA's are see-through.
- Scrolling limited to one station per 70ms: it felt sluggish next to GTA's sweep.
- The first synthesised sounds: bright, distorted retune static with tuning whistles gliding up to 5 kHz, peaking near 0 dBFS, and a clicky hover tick with a 3 kHz overtone and random pitch. At 30 ticks a second it buzzed, and both were tiring to hear.
