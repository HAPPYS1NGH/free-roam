# Decisions

## 2026-10-22: The radio wheel copies GTA V's

Decided from the prototype in `prototype/`.

- v1 is the radio wheel only. The weapon wheel moves to Later: mapping playlists onto weapon slots needs setup from the user, and it works better as a second launch post.
- Layout, states and behaviour follow GTA V's PC radio wheel:
  - a ring of round station logos with Radio Off at the bottom, stations running clockwise from it
  - unselected logos greyscale at 55% opacity; the selected logo in full colour with a 3px `#62C3EE` ring
  - three lines of white text in the centre (station, ARTIST, title) with a soft shadow and no panel
  - sizes scale with screen height: ring radius 38%, logo 11.5%, caption 2.3%
- Station logos are a 2×2 mosaic of album covers from the playlist's first four distinct albums. Music's scripting interface returns no playlist artwork (every playlist reports 0), but track artwork comes back as 600–1200px JPEGs.
- Motion: opacity only. The wheel fades in over 90ms with `cubic-bezier(0.23, 1, 0.32, 1)` and out over 70ms with `cubic-bezier(0.4, 0, 1, 1)`; the backdrop blur shares that timing. The highlight jumps instantly. It opens dozens of times a day from the keyboard, so anything more reads as lag.
- Input: the pick comes from mouse movement since opening (a clamped virtual cursor with a 24px dead zone), not the cursor's position. One scroll notch moves one station. The wheel opens with the playing station selected.
- Live tuning: like GTA, the station changes while you hover, after the pick rests for 300ms. Releasing Q tunes immediately.
- Broadcast clock: every playlist behaves as if it has looped since 2026-01-01 UTC. Tuning in plays the track that is "on air" and sets Music's `player position` partway into it, and the centre text can show what's on before you tune in.
- Sounds are synthesised in `prototype/scripts/make-sounds.mjs`. No GTA audio, logos, station names or fonts are used anywhere.

Rejected:

- **Arcade** (wedge ring with generated badges), **Tuner** (analogue dial with a sprung needle), **Halo** (glass with floating covers). All three were "inspired by" GTA. The goal is the GTA wheel itself.
- Generated typographic station logos: the user preferred their real Apple Music art.
- Scroll-to-skip-track inside the wheel: GTA uses scroll to move between stations.
- Spring animations on open and highlight: they add motion to something triggered too often to animate.
