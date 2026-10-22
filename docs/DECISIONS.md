# Decisions

## 2026-10-22: The radio wheel copies GTA V's

Decided from the prototype in `prototype/`.

- v1 is the radio wheel only. The weapon wheel moves to Later: mapping playlists onto weapon slots needs setup from the user, and it works better as a second launch post.
- Layout, states and behaviour follow GTA V's PC radio wheel, with numbers measured from 1920×1080 in-game captures (%H = percent of screen height):
  - a ring of round station logos with Radio Off at the bottom, stations running clockwise from it
  - logos sit 9.15%H apart, so the ring grows with the station count: radius = N × 9.15%H / 2π, kept between 22%H and 30.5%H. Logos are 8.8%H at that spacing, so neighbours almost touch, and keep the same logo-to-gap ratio when the ring stretches or fills up, to a maximum of 10.5%H. The 22%H floor is ours: GTA has 18 or more stations, and with 13 the ring was too small to hold the caption
  - the wheel sits 4.3%H above screen centre
  - every logo sits in a solid black disc, with the art inset to leave a black rim of 5% of the disc on each side. Unselected logos are ghosts: disc and art together at 30% opacity, art in greyscale, so the black reads as a dark see-through circle. GTA's measure 34% for black parts and 30% for white. The selected one is opaque and the same size (GTA's selected disc measures 76px, as does the idle one), with a 0.55%H ring in `#65B4D4` outside the disc and a 1.5px dark edge. Presets: `#ABEDAB`, `#FFA357`, `#2D6EB9`. Disc sizes are rounded to even pixels so every disc is identical and sits on the pixel grid
  - Radio Off gets the same disc, and its glyph fills the art circle, as GTA's fills about 0.89 of the disc
  - deliberate difference: GTA's logos stay white when selected; ours turn full colour so you can recognise the album art (`selectedInColour` turns it off)
  - three lines of white text (station, ARTIST, title), 2.6%H Sofia Sans Extra Condensed SemiBold, lines 3.4%H apart, the first 5%H above the ring's centre. Of the open-licence condensed faces we compared, it's the closest to GTA's in width and cap height. The edge is three stacked 1.5px black blurs plus a 4px halo at 45%, which stays readable on white windows. Sofia Sans is SIL OFL: the prototype self-hosts woff2 subsets and the Mac app bundles the upstream TTF. The prototype registers the font with the `FontFace` API at start-up, because Chrome resets CSS `@font-face` faces whenever a stylesheet adds font rules, which left the caption blank for a frame on the first open
  - backdrop, fitted from frames before and after the wheel opens: no blur. Saturation 0.45, brightness 1.04, a 7% wash of `rgb(70 120 210)`, and a vignette that follows the screen's shape: clear for the first 46% of the way to the corners, then darkening to 70% `rgb(4 8 18)` in them. Desaturating other apps on macOS needs a screen capture and Screen Recording permission. Without it the Mac app gets the vignette and tint only, which are plain overlays
- Station logos are a 2×2 mosaic of album covers from the playlist's first four distinct albums. Music's scripting interface returns no playlist artwork (every playlist reports 0), but track artwork comes back as 600–1200px JPEGs.
- Motion: the wheel opens in 140ms, fading in from 96% scale with ease-out-quint `cubic-bezier(0.23, 1, 0.32, 1)`, so it's 80% there after about 40ms. It closes in 100ms, opacity only, because letting go commits the pick. GTA pops in and out within a frame; the short scale is ours. The highlight still jumps instantly, because a scroll sweeps up to 30 stations a second. The screen filter eases in over 150ms and out over 450ms with `cubic-bezier(0.4, 0, 0.6, 1)`, so colour drains back in after the wheel has gone. It opens dozens of times a day from the keyboard, so anything on the wheel itself reads as lag.
- Input: holding Q for 150ms opens the wheel; a quicker tap skips to the next station (skipping Radio Off), as in GTA. The pick comes from mouse movement since opening (a virtual cursor clamped to 60px with a 1.5%H dead zone), not the cursor's position, so circling the whole ring takes about 380px of mouse travel. Scrolling moves one station per 12px but never more than one per wheel event. A trackpad flick still sweeps the ring at GTA's ~30 stations a second or faster, and a mouse-wheel notch is always one station, however much macOS accelerates it. The first scroll event of a gesture steps at once. The wheel opens with the playing station selected.
- Live tuning: like GTA, the station changes while you hover once the pick rests for 1 second. Releasing Q tunes immediately.
- Broadcast clock: every playlist behaves as if it has looped since 2026-01-01 UTC. Tuning in plays the track that is "on air" and sets Music's `player position` partway into it, and the centre text can show what's on before you tune in.
- Sounds are synthesised in `prototype/scripts/make-sounds.mjs`. No GTA audio, logos, station names or fonts are committed or shipped.
- The prototype can also play a local sound pack from `prototype/public/sounds/local/`, which is gitignored, and the panel's Sound Pack switch flips between the two. It's for trying sounds we can't redistribute, such as the game's own, side by side with ours. The Mac app ships only synthesised sounds.
- Sounds are soft and dark because they play dozens of times a day. They're built from filtered noise and low sines, sit mostly below 2 kHz, have no tones above 1.5 kHz and no distortion. Levels are baked into the files: hover under open and close, both under retune. Retune is a short, muffled car-radio "kssh" that fades out any retune still playing. The hover tick plays for every station passed, like the iPod click wheel. The faster the sweep, the quieter, darker and shorter each tick gets, and each one stops before the next starts, so a sweep purrs instead of buzzing and no station goes silent. The local pack follows the same order: its hover hiss sits under the open/close click. Volume dials are in dB.

Rejected:

- **Arcade** (wedge ring with generated badges), **Tuner** (analogue dial with a sprung needle), **Halo** (glass with floating covers). All three were "inspired by" GTA. The goal is the GTA wheel itself.
- Generated typographic station logos: the user preferred their real Apple Music art.
- Scroll-to-skip-track inside the wheel: GTA uses scroll to move between stations.
- Spring animations on open and highlight: they add motion to something triggered too often to animate.
- A fixed ring size (first rebuild: 38%H radius, 11.5%H logos): GTA sizes the ring from the station count, and the fixed size looked sparse with 13 slots.
- A 300ms live-tune delay: GTA waits about a second, and the shorter delay retuned while you were still aiming.
- A blurred, darkened backdrop (2.5%H blur, brightness 0.85): GTA's screen stays sharp, and the blur made the screen look muddy.
- Greyscale idle logos on an opaque black disc: they read as solid grey blobs. Ghosting the disc along with the art fixed that.
- Avenir Next Condensed with an 8-direction outline: about a third wider than GTA's face, and the outline looked blobby.
- A selected logo 3% larger than the rest: GTA keeps the disc the same size and adds the ring outside it.
- Scrolling limited to one station per 70ms: it felt sluggish next to GTA's sweep.
- 30px of scrolling per station and a 160px pick radius: still too slow. Circling the ring took about 1,000px of mouse travel.
- The first synthesised sounds: bright, distorted retune static with tuning whistles gliding up to 5 kHz, peaking near 0 dBFS, and a clicky hover tick with a 3 kHz overtone and random pitch. At 30 ticks a second it buzzed, and both were tiring to hear.
- Several stations per scroll event: one accelerated mouse-wheel notch could jump half the ring in a single frame, with one tick for all of it.
- Dropping hover ticks under 35ms apart: a sweep's rhythm stuttered, and the stations those ticks belonged to went silent.
- The local hover at retune's level: a bright 53ms hiss, 10 dB louder than the open/close click, on every station passed.
- Linear 0–1 volume sliders: the usable quiet range was a sliver at the bottom of the slider.

## 2026-10-22: The Mac app desaturates the screen

Decided by comparing three backdrops under the open wheel in the prototype, over the dark desktop and over a light window full of album art.

- The Mac app keeps the prototype's backdrop: saturation 0.45, brightness 1.04, the 7% blue wash and the vignette. Only a live screen capture can desaturate other apps' windows, so Static asks for Screen Recording permission.
- If permission is denied, the wheel still opens with the vignette and wash only. Both are plain overlays and need no permission.

Rejected:

- **Tint only**: the vignette and wash without desaturation. It needs no permission, but colourful windows keep their full colour and compete with the wheel.
- **Grey veil**: a flat cool grey at 30% opacity between the wash and the vignette, to fake desaturation without permission. A grey overlay mutes colour but also flattens contrast, so the screen looked foggy rather than drained.

## 2026-10-22: Tokens and retune take

- `prototype/tokens.json` is exported from the prototype's defaults, which hold every number above. Phase 2's `WheelStyle.swift` reads it. Re-export it from the Radio wheel panel after changing any slider.
- The retune sound is `retune`, the muffled car-radio "kssh". `retune-b` and `retune-c` stay in the prototype for comparison.

## 2026-10-22: Development builds are signed with a self-signed certificate

Measured on macOS 27.0.1 with the first Phase 2 build, a menu bar app that plays a playlist and captures the screen. Every result comes from the `--probe` flag; the Music results and the certificate builds were also confirmed by playing a playlist and capturing the screen.

- An ad-hoc signature identifies one exact binary: its designated requirement is `cdhash H"…"`. Any change to the code or `Info.plist` makes a new app as far as macOS is concerned.
- Screen Recording doesn't survive that. Granted to one ad-hoc build, it was gone in the next. System Settings still shows Static switched on, so you have to switch it off and on again, and that's confusing.
- Music permission did survive. A rebuilt ad-hoc build, and later the switch to the certificate, both played playlists without a prompt.
- `scripts/make-signing-cert.sh` creates a self-signed "Static Development" certificate in the login keychain, and `scripts/bundle.sh` signs with it when it's there. The designated requirement becomes `identifier "com.happys1ngh.static" and certificate leaf = H"…"`, which stays the same from build to build. Both permissions survived a rebuild with code changes.
- The certificate doesn't have to be trusted in Keychain Access, so setting it up needs no admin password. codesign does need the keychain, so `bundle.sh` fails with `errSecInternalComponent` in an SSH session or a sandboxed agent shell.
- Without the certificate, `bundle.sh` signs ad hoc and prints a warning.
- Open for Phase 4: release builds are ad-hoc too, so after every update users would have to grant Screen Recording again and run into the same stale switch. Signing releases with a certificate we keep would avoid that.

Rejected:

- Ad-hoc signing during development: Screen Recording had to be granted again after every build.
- Trusting the certificate for code signing: codesign works with an untrusted certificate, and macOS only compares its hash.
