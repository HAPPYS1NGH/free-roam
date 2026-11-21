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

- The Mac app keeps the prototype's backdrop: saturation 0.45, brightness 1.04, the 7% blue wash and the vignette. Only a live screen capture can desaturate other apps' windows, so Free Roam asks for Screen Recording permission.
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

## 2026-10-22: The hotkey and wheel input need no extra permissions

Measured on macOS 27.0.1 with the Phase 2 step 2 build, where holding ⌥Q opens a wheel of plain circles. `--probe` showed Accessibility and Input Monitoring switched off throughout, and the logs counted what each input route delivered.

- ⌥Q is a Carbon hotkey (`RegisterEventHotKey`). It needs no permission and never sees plain Q, and ⌥Q no longer types "œ" in the app you're in. Tapping, holding, ⌥Esc to close, full-screen apps, other Spaces and a second display all worked by hand.
- When ⌥ comes up before Q, Carbon still sends Q's key-up, about 0.4 s later when Q comes up. The wheel doesn't wait for it. While ⌥Q is down the hotkey checks the modifiers every 16 ms, and letting go of ⌥ ends the hold, as with ⌘Tab. That also means a key-up that never arrives can't leave the wheel open.
- The overlay is a borderless, non-activating `NSPanel` at the status bar level that joins every Space and full-screen app. The app you were in stays active while the wheel is open.
- Mouse moves:
  - Moves go to the active app wherever the pointer is, and `NSEvent`'s global monitor gets a copy of each. In all but two holds that route carried more movement than the panel's own, including when the pointer crossed to the second display.
  - Static's panel also receives some of the same moves while Static is in the background: from a quarter to nearly all of the distance, depending on the hold. Adding both routes made the pick up to twice as fast. The wheel now reads only the active app's copy, or Free Roam's own events when Free Roam is the active app. That last case can't happen yet, because Static has no window to activate, so check it once Settings exists.
  - A listen-only `CGEventTap` for mouse events was created without an error but delivered nothing with Input Monitoring off.
- Scrolls go only to the window under the pointer, which is the panel: 130 and 161 events reached Static and none reached other apps. The panel reads them and stops them there, so the app underneath doesn't scroll.
- `tokens.json` loads from `Contents/Resources` through `Bundle.main` in the signed app.
- A screen capture on open, at full pixel resolution and leaving out Static's own windows (`SCShareableContent`, then `SCScreenshotManager`):
  - the first capture after launch took 145 ms
  - after that, 3024×1964 on the built-in display took 41–100 ms, mostly 50–70 ms: 13–33 ms to list the screen's content and 23–87 ms for the image
  - 5120×2880 on the external display took 39 ms
  - no screen-recording indicator appeared in the menu bar
- So the backdrop can capture once per open and doesn't need a stream that keeps running. To have the image before the 150 ms fade starts, the backdrop step can start the capture when ⌥Q goes down, 150 ms before the wheel opens, and capture once at launch so the slow first capture doesn't land on the first open.

Rejected:

- A capture stream that keeps running: one capture takes well under the fade, and a stream would record the screen for as long as Free Roam runs instead of only when the wheel opens.
- Adding the global monitor's moves to the panel's own: the same movement counted twice.
- A listen-only event tap: it gets nothing without Input Monitoring.
- An `NSTrackingArea` with `.activeAlways` on the panel: it only added more duplicate moves.

## 2026-10-22: Tuning in and the volume dip

Measured on macOS 27.0.1 with the Phase 2 step 3 build, from Static's logs over three hand tests and from scripting Music directly while it was paused.

- Tuning plays track N of the station's playlist (`play track N of user playlist …`), then sets `player position` to the on-air position. Music plays on through that playlist afterwards: on every ⌥Q press after a tune, Music's `current playlist` was the station Static had tuned.
- Until a streamed track has loaded, Music ignores a new player position or refuses it with "Can't set player position" (-10006). In the first test, 7 of 9 tunes started within 12 seconds of the top of the song. Free Roam now sets the position every 100 ms, moving the target on with the clock, until Music reports it. Every tune since has landed, most on the second try and the slowest on the seventh, so you can hear the start of the song for a moment before the jump. The retune sound in step 4 should cover it.
- Each ⌥Q press asks Music which playlist is playing, so the wheel opens on that station even after it was changed in Music. When Music plays something that isn't on the ring, the wheel opens on Radio Off, and letting go without moving changes nothing.
- While Music isn't running, Free Roam sends it nothing, because any script would launch it. Picking a station launches it through `NSWorkspace` with `activates = false`. Music is listed as running before it takes scripts: the first script failed after 9 s with "Connection is invalid" (-609), so launching now waits until Music answers. Not checked by hand yet: whether Music's window stays behind the app you're in.
- Music drops a `sound volume` change that comes within about 100 ms of the last change it took. Measured while paused: a second change 90 ms after the first was dropped and one 100 ms after stuck, a dropped change doesn't restart the wait, and ten changes in a row kept only the first. Reading the volume is accurate straight away.
- So Free Roam changes the volume at most every 150 ms, timed from Music's answer to the last change, and a new ramp waits for the one it cancels. Each step goes where the ramp should be by the next one: the 150 ms dip is a single change and the 450 ms restore is three, 150 ms apart. On quit the restore waits 150 ms after any script already queued.

Rejected:

- Setting the position in the same script as `play`: it only stuck when the track had already loaded.
- A volume ramp in 16 ms steps: Music kept only some of them, sometimes not the last, and the next dip saved the wrong volume to come back to. Music's volume crept from 97 to 76.
- Setting the volume again after a ramp whenever it read back wrong: it hid the cause.
- Timing the gap from when a change was sent: behind a tune's commands, a change reached Music late, the next one followed it by less than 100 ms and was dropped, and the volume crept from 75 to 40.

## 2026-10-22: The real wheel

Measured on macOS 27.0.1 with the Phase 2 step 4 build, by hand and from Static's logs.

- Music returns a playlist's titles, artists, albums and lengths in about 40 ms, and one track's artwork in 30–50 ms as `tdta` data, which decodes to a 600 or 1200 px JPEG. Free Roam loads both in the background once the playlists have loaded: 12 stations' tracks took 490 ms and their 42 covers 1.4 s. Scripts still run one at a time, so each of a tune's scripts can wait for one of the loader's. Since a tune steps through its playlist a few tracks per script (2026-10-27), that can add up to several. Opening the wheel also loads any station that failed or is new.
- Each logo is drawn once into a 320 px image: four covers make the 2×2 mosaic, fewer show the first cover alone, and a playlist with no artwork shows its initials in white. Tuning still reads only the durations, about 10 ms, so it plays the playlist as it is now even if the caption's copy is older.
- SwiftUI applies `.opacity` to each layer separately, so the black disc showed through an idle logo's art. `compositingGroup()` fades the disc as one layer, like CSS opacity. SwiftUI's shadow radius is about half a CSS blur, so the caption's 1.5 px and 4 px blurs are radii 0.75 and 2.
- The caption font is the static Sofia Sans Extra Condensed SemiBold TTF from `lettersoup/Sofia-Sans` at commit `9a1f0ba`, registered for the process with Core Text at launch.
- Input stops the moment the wheel closes, so clicks and scrolls reach the app underneath during the 100 ms fade, and the panel leaves the screen after it. Reduce Motion opens and closes the wheel at once, as in the prototype.
- `CGDisplayHideCursor` and `CGAssociateMouseAndMouseCursorPosition(false)` are documented for the frontmost app, but both work for Static in the background. While the wheel is open the pointer is hidden and stays where it was, and mouse moves still arrive with their deltas, so picking works as before. It also stops the pointer from wandering onto another display.
- The prototype's Sound Pack switch defaults to Local, so the wheel was tuned with the sounds in the gitignored `prototype/public/sounds/local/`. The first build played the synthesised ones, and next to the prototype they sounded wrong. `bundle.sh` now copies each local sound over the synthesised one with the same name. That's for builds on your own Mac: a release may only contain synthesised sounds, so v1 needs synthesised takes close to the local pack. Most local sounds are 48 kHz, so sounds are resampled to 44.1 kHz on load.
- The sounds play through a small mixer on the audio thread (an `AVAudioSourceNode`), so a sound can fade out at an exact sample like a Web Audio gain ramp. A new retune fades the last one out over 12 ms, and hover ticks get quieter, darker and shorter the faster you sweep, as in the prototype. The audio engine starts on ⌥Q and stops 10 s after the last sound, so it doesn't hold the audio device.
- Tunes land 175–360 ms after letting go, and once took 1.8 s, straight after Radio Off. With the local retune, the start of the song wasn't noticeable by hand.
- The volume fix from step 3 held: over 7 opens, every dip went to 30, 0.4 × 75, and every restore came back to 75.
- Two deliberate changes from GTA's numbers, after using the wheel on the Mac. The selected disc's black rim is 1% of the disc instead of 5%: on a 982 pt screen the 5% band was 5 pt, as wide as the blue ring, and looked heavy. Idle discs are 40% opaque instead of 30%, which was too faint. `selectedRim` is a new token, and the prototype uses the same values.

Rejected:

- `AVAudioPlayerNode` for the sounds: it can only cut a sound off, and a retune cut partway through clicks.
- Restarting the retune every 150 ms until the seek lands, to cover the start of the song. It suited the synthesised retune, which is loud for its first 150 ms, but the local retune is a 53 ms hit, and restarting it stuttered. The prototype plays it once.

## 2026-10-22: The backdrop

Built in Phase 2 step 5, from `.wheel-backdrop` in `prototype/src/styles.css`. Passed by hand on 2026-10-22, over the dark desktop and over album art, with and without Screen Recording. The timings come from Static's logs over 5 launches and 55 presses.

- The screen with the mouse is captured and filtered when ⌥Q goes down, so the still is ready before the wheel opens 150 ms later. A tap throws it away. One capture and filter at launch keep the slow first capture (145 ms) and Core Image's setup off the first press. A still that lands before its open waits for it rather than going on screen, where the last close may still be fading out on any display, and that fade clears what's shown when it ends. A still that lands after the wheel has opened fades in over 150 ms. If the mouse crossed to another display since the press, the wheel opens with the wash and vignette only.
- The still was ready 41–122 ms after ⌥Q went down, 64 ms at the median, so always before the open. Capturing took 31–92 ms (median 48) and filtering 8–30 ms (median 15). The warm-up at launch took 94–116 ms, and the first press's capture after it 42–55 ms instead of the 145 ms measured in step 2. No capture failed and nothing logged an error. Without Screen Recording, Static makes no capture attempts and logs no errors.
- The capture leaves out only the wheel's panel, which is still on screen while a close fades out. Anything else of Free Roam's on screen, such as the Settings window to come, stays in the still. It also leaves out the pointer (`showsCursor = false`): a pointer that showed in a screen recording of the wheel came from the recorder.
- The filter is one `CIColorMatrix`: the Filter Effects spec's matrix for CSS `saturate()`, times `brightness()`, which multiplies each channel. `CIColorControls` adds its brightness instead. Browsers clamp after each filter, but with a saturation from 0 to 1, the prototype's range, no channel leaves 0–1 before the brightness, so one matrix gives the same result.
- Browsers apply CSS filters to sRGB-encoded values. Core Image works in linear light by default, where the same matrix turned pure red into 202 instead of 150, and green into (171, 241, 171) instead of (104, 224, 104). So the working colour space is extended sRGB, which also keeps a wide-gamut display's colours. The still goes back into the capture's colour space, and ScreenCaptureKit captures in the display's.
- The vignette is an `EllipticalGradient`. SwiftUI measures its radii as fractions of the view's size and stretches the circle to the view's shape, so 0.5 reaches the middle of each edge (checked by rendering one). CSS's farthest-corner ellipse has the same shape and passes through the corners, so CSS's 100% is an end fraction of √2/2, about 0.707, not √2. The stops keep their CSS positions, and a test compares the rendered vignette with the CSS gradient.
- The still, the 7% wash and the vignette fade as one layer, like CSS opacity on `.wheel-backdrop`: in over 150 ms and out over 450 ms with `cubic-bezier(0.4, 0, 0.6, 1)`, apart from the wheel's 140 and 100 ms. Input stops the moment the wheel closes, and the panel leaves the screen once the backdrop has faded out. The wheel goes back to its smaller opening size after its own 100 ms, so opening it again during the backdrop's fade still grows it in.
- When Screen Recording is off, the menu adds that if System Settings already shows Free Roam switched on, it needs switching off and on again. That's the stale switch from the signing entry above.
- Screen Recording stays optional. Tried by hand with and without it, the difference is significant: without it, the wash and vignette sit over the live screen at full colour and look clearly weaker. That's still an acceptable fallback for anyone who'd rather not grant the access.

## 2026-10-23: Settings and the stations on the wheel

Built in Phase 2 step 6. Passed by hand on 2026-10-23: picking stations by mouse and by scroll while the Settings window was active, Settings showing in the backdrop, ticking, unticking and dragging stations, a new playlist joining the end, a deleted one dropping off, Music launching hidden, the stations surviving a relaunch, and the new menu. The numbers come from Static's logs over 10 runs and 166 opens.

- Settings is one list of Music's playlists in the wheel's order. Ticking a playlist puts it on the wheel, dragging moves it, and every change saves at once. Stations run clockwise from Radio Off in list order. The wheel holds 25 stations, so a 26th can't be ticked.
- Until you change anything in Settings, the wheel follows Music's library order and takes the first 25 playlists, as the prototype does. After that, Free Roam saves every playlist's persistent ID and name in `UserDefaults`, with whether it's on. The names let the wheel show its stations before Music has started.
- A playlist made after that joins the end of the wheel if it has fewer than 25 stations, and stays off otherwise. One you switched off stays off, because it's still in the saved list and only IDs Free Roam hasn't seen count as new. A new playlist that found the wheel full stays off when a station leaves later.
- A playlist missing from Music's list drops off the wheel and out of Settings, but stays in the saved list with its place and whether it's on. A list can come back short while iCloud Music Library syncs or another library is open, and those playlists would otherwise return as new: on, at the end. A playlist made again gets a new persistent ID, so a deleted one just stays hidden. An empty list changes nothing.
- Free Roam reads the playlists at launch if Music is running, whenever Settings opens, and after the wheel closes, once every tune has reached Music. Scripts run one at a time, so a read on press would hold up a tap's tune and the open's volume dip. A change in Music reaches the wheel from the open after the next one. The read checks again that Music is running when its turn comes, because `tell application` would launch it.
- Opening Settings while Music is closed launches Music hidden, because only Music can list the playlists. Tuning launches it hidden too, so its window no longer opens. The wheel itself still doesn't launch Music just to open.
- The menu is Settings…, Quit, and an Allow item for each permission Free Roam is missing, checked again whenever the menu opens. Play Playlist and Capture Screen are gone.
- Capture Screen was the only thing that made macOS ask for Screen Recording. Free Roam now asks only from Allow Screen Recording…, never at launch, because the backdrop works without it. The item calls `CGRequestScreenCaptureAccess`, which adds Free Roam to the list in System Settings and shows macOS's prompt the first time, then opens that list.
- Reading the playlists took 10–395 ms, 17 ms at the median, over 165 reads of 12 to 25 playlists. The wheel opened with 8 to 25 stations and was full for 70 of the opens. Thirteen new playlists joined the end, up to five in one read, and deleting 11 in Music hid all 11 in the next read. None came back and none found the wheel full. The backdrop's still was ready 35–146 ms after ⌥Q went down, 68 ms at the median, so always before the open.
- With Music closed, the wheel opened with its saved stations, and picking one launched Music hidden and played 1.6 s after letting go. A press a second later found Music playing nothing, though, so the wheel opened on Radio Off.
- The hand test turned up three problems for step 7, and nothing else logged an error. Music answers an empty playlist's `every track` with error -1728, so tuning one failed and Static tried to load it again on every open, 240 times in all. Twice Music stopped answering scripts, for about 1.5 and 5 minutes, and because scripts run one at a time, every tune, volume dip and read waited behind it until AppleScript's 2-minute timeout. And Music's repeat is off, so a station stops when its playlist ends: 5 of the 15 presses that found Music playing nothing came after the tuned station's last track had finished.

Rejected:

- New playlists staying off until you tick them: none would reach the wheel without a trip to Settings.
- Two lists, one for the wheel and one for the rest: a single list shows the wheel's order and what's off in one place.
- Showing only the saved stations, with an Open Music button, when Settings opens while Music is closed.
- Asking for Screen Recording at launch: it stays optional.
- Dropping playlists missing from a list out of the saved choice: a short list turned them into new playlists when they came back.
- Reading the playlists on every ⌥Q press: the read went ahead of a tap's tune.

## 2026-10-23: The station name is the caption's largest line

- The station line is 3.4%H and the artist and title stay 2.6%H. With all three the same size, the artist's capitals read larger than the station name. The station line keeps the others' leading and stays centred 5%H above the ring's centre, so Radio Off doesn't move, and the artist and title hang below it. It's a new token, `sizes.stationSize`, which the Mac app reads too.

## 2026-10-23: Each caption line fits inside the ring

- Once the ring grows with the station count, the old width cap, 90% of the ring's inner circle, grew with it: from about 30%H to 48%H at 24 stations. Long credits filled the circle and ended 2–3%H (30–33 px) from the discs. None crossed a disc, but the caption looked as if it ran under the ring.
- The Mac app copies the prototype's caption as it renders at `178c843`. Measured from its spans in Chrome, the line centres sit 5%H above the ring's centre for the station, 1.08%H above it for the artist and 2.32%H below it for the title. A test pins those numbers. The prototype's font file has the same vertical metrics as the app's TTF, so the glyphs land in the same place.
- The maths was right, but the app drew the caption wrong from the start (`f60691d`): its lines sat loose in a `TimelineView`, which stacked them like a VStack, each line positioned within its own third of the screen. The station line looked right, the artist landed at the bottom of the ring and the title went off-screen. The lines now share one `ZStack`. `RadioWheelContent` draws the wheel from plain values, so a test renders the whole wheel at 1512 × 982 with 12, 16 and 24 stations and checks each line's ink against the prototype's positions.
- Each line has its own maximum width. Take a circle one caption line (`captionPitch`, 3.4%H) inside the selected disc's ring, as the prototype does. The width is that circle's chord at whichever of the line's top and bottom edges is farther from the centre. A line's corners come nearest the discs, so the whole line stays inside that circle, whichever disc is selected. Long lines still end in an ellipsis on one line. The maths is `captionWidth` from the prototype's Grow ring and Shrink discs layouts, and the Mac app keeps today's ring.
- That leaves the ends of long lines 4.4–5.1%H from the idle discs, against 2–3%H before. At 24 stations lines get 43–45%H. At 12, where the inner circle is smallest, they get 21–25%H, down from 30%H, so long station names cut off sooner.
- The prototype's other token change since the backdrop, `backdropBlur` renamed to `backdropBlurPx` and still 0, doesn't change the app, which has no blur. Idle discs stay at 0.4.

## 2026-10-23: Edge cases

Built in Phase 2 step 7. Passed by hand on 2026-10-24: an empty playlist pausing Music, shuffle and repeat set on tune, Music behind a dialog giving up after about 10 s, Music not running and a press straight after it launches, the wheel and backdrop on the built-in display, and the caption following a skip in Music. No subscription and the warm-up on each display are untested. The numbers come from Static's logs over 4 runs and 74 opens, and Music's starts and exits from the system log.

- An empty playlist: Music answers `every track` of it with -1728, so the scripts count the tracks first and return empty lists. An empty list isn't kept, so the station is read again on the next open in case it has tracks by then, and its caption shows the name alone. Tuning it pauses Music, as Radio Off does, because a station with nothing to play is dead air.
- Shuffle and repeat: the broadcast clock plays each playlist in order and loops it. Every tune turns Music's shuffle off and sets repeat to all, in the same script as `play`, and leaves them that way. They're Music's own settings, so this changes how Music plays outside Free Roam too. The log says when either was different. With repeat off, the step 6 hand test found 5 stations that had stopped at the end of their playlists.
- Music not answering: every script runs inside `with timeout of 10 seconds`. Scripts took 0.4 s at most in the step 6 test. A stuck one now fails with -1712 after 10 s instead of AppleScript's 2 minutes, and the queue moves on. Launching Music retries a script that timed out, as it does one Music refused while starting, but stops once 15 s have passed: counting 50 tries could have held a tune, and every script behind it, for over 8 minutes. A timed-out script still runs in Music once it answers again, so a volume change that timed out counts as made, and the restore undoes it instead of leaving Music at 30. A timeout while asking what's playing fails the read and leaves the station as it was, instead of reading as nothing playing and jumping to Radio Off.
- Music not running: until you change anything in Settings, the wheel follows the last playlist list Music gave, saved in `UserDefaults`, so it isn't empty when Music is closed at launch, or when Music lists no playlists while its library loads after launching. Logos still come from Music, so stations show initials until it runs. A tune that launches Music stays in flight for 2 s after its seek lands. A press meanwhile opens on that station without asking Music, and then, if Music isn't playing, Free Roam tells it to play on and logs whether Music was paused or stopped. The step 6 log didn't say which, so a pause in those 2 s is played over too, unless it was Radio Off or another station. It isn't known yet whether Music really stopped after launching in the step 6 test or only said so.
- Duplicate names: stations are kept, ordered and hidden by persistent ID, so two playlists with the same name are two stations, told apart by their logos. A test pins it down.
- Several displays: the wheel opens on the screen with the mouse, sized to that screen, and the press captures that display. Each display now gets the warm-up capture, at launch or when it's connected, instead of only the main one. That warm-up wasn't hand-tested in step 7, because the external monitor wasn't connected. The wheel worked on that monitor in earlier steps.
- No subscription: nothing changed. Apple Music tracks can't play without one. This library has 159 subscription tracks and 8 uploaded ones, so it needs checking by hand with Show Apple Music Features off. It's untested: the step 7 hand test didn't turn that setting off.
- The caption: each press asks Music for its playlist, track number, position and track count, in the script that already asked for the playlist. For the station Music is playing, the caption plays on from there in order, looping, so it still changes track while the wheel is open. Other stations, one just tuned, and every station when the read fails, follow the clock. The log says when Music and the clock are on different tracks. When the track count Music gives on a press or a tune differs from the tracks loaded, the playlist was edited, so the station loads again.
- From the hand test's logs: tuning the empty playlist paused Music, and the caption followed Music twice when it was on a different track from the clock. The backdrop's still was ready 54–116 ms after ⌥Q went down, 78 ms at the median over 77 presses, so always before the open. All 74 opens were on the built-in display, at 1512 × 982.
- Music behind its dialog: 10 scripts timed out with -1712, in 4 runs of 1 to 3. Timeouts in a row came 10.0–10.6 s apart, so the queue moved on. Each run ended when Music was quit from the dialog, and the next scripts answered within 2 s. All of them came before the fix in the next entry, which stops Static opening that dialog.
- Shuffle and repeat: the log said they were different on 34 of the 42 tunes that played, and on all 11 in the last run, some of them 1–10 s after the tune before had set them. Either something undoes them soon after a tune, or the check that reads them is wrong. Every tune sets them again, so stations still play in order, but the cause isn't known yet.
- Music not running: presses straight after a launch opened on the tuned station, and Static never had to tell Music to play on after launching it, so the stop seen in step 6 didn't come back.

Rejected:

- Putting shuffle and repeat back on Radio Off or on quit: you chose to leave them set.
- `NowPlaying.swift`, listening for Music's `com.apple.Music.playerInfo` notifications: each press already asks Music what it's playing, and two more values in that script cover skips and pauses.
- Telling playlists with the same name apart in Settings.

## 2026-10-23: The first X post uses the local sound pack

- Nothing has been posted to X yet, so the first post is the recording at the end of Phase 2, not a prototype clip.
- The recording uses the sounds Static plays now: the local pack, which `bundle.sh` copies over the synthesised sounds on this Mac. Release builds still ship only synthesised sounds, and `bundle.sh` is unchanged.

## 2026-10-24: Static starts Music only by launching it, and never with ⌥ held

The bug: after you quit Music, ⌥Q sometimes brought up Music's "Music needs a library to continue" dialog, and after you closed it Music crashed. Found from Static's log, Music's launches and exits in the system log, and two crash reports.

- Music shows that dialog when it starts with ⌥ held, and ⌥ is half of the hotkey. Of 5 tunes that launched Music, 3 got the dialog: both tunes from resting on a station, with ⌥ down, and one release where Q came up before ⌥. Music started 21–34 ms after each tune. The other two were a release with ⌥ up first, and one with Q up first where ⌥ followed before Music checked.
- A press with Music closed never launched it, because a press only asks what's playing when Music is running.
- While the dialog was up, every script timed out after 10 s and the queue backed up. Quitting Music from the dialog let the next queued script run, and its `tell application` started Music again 14–36 ms later. Those scripts had been queued while Music was running: a tune's track lengths twice, and a station's tracks once. That's the Music that "starts working".
- Two of those three Musics crashed when quit with ⌘Q, 4.7 s and 6.6 s after starting. Both crashed in `-[NSApplication terminate:]`, in one of Music's will-terminate observers, with EXC_BREAKPOINT and "__CFTypeCollectionRelease() called with NULL; likely a collection has been corrupted". Static had sent Music nothing for 3 s before either crash, so the crash is Music's own bug. Static's part was starting a Music you had just quit. The third relaunched Music quit 20 s after starting without crashing, and so did one that Static launched and you quit 6 s later.
- Every script now checks that Music is running when its turn comes, in Swift and again inside the script (`if application id "com.apple.Music" is running`), and otherwise throws `notRunning`. Before, only the playlist read checked when its turn came, and only in Swift. So `MusicBridge.launch()` is the only way Free Roam starts Music. A press whose read finds Music has quit opens on Radio Off.
- `launch()` first waits for ⌥ to come up, reading `CGEventSource.flagsState` every 20 ms. You can rest on a station and keep holding, so it waits up to 30 s, then gives up rather than open the dialog. The log says how long each launch waited. The 15 s for Music to answer, and the 2 s a launching tune stays in flight, both start once Music is open, as before.
- So with Music closed, resting on a station no longer plays it while the wheel is open. Music starts when you let go.
- Not covered: pressing ⌥ again in the moment Music starts can still bring up the dialog. A tune waiting for ⌥ still launches Music when you let go, even if you picked Radio Off since, so Music sits open, hidden and silent, as it did when tunes launched it at once. The next entry fixes that.
- Tests cover the ⌥ wait, using an injected key state, and a guarded script for Chess, which stands in for Music: it throws `notRunning` and Chess stays closed. Each Music script was compiled with its guard but not run.
- Passed by hand on 2026-10-24, several times over: no library dialog, and Music started once ⌥Q was let go. After this build, Static launched Music 8 times. Tunes on release waited 43 ms for ⌥ to come up, and tunes from resting on a station waited 1.5–9.2 s, until you let go: 2.8 s at the median over all 8. Three of the 8 came from tunes that Radio Off had since replaced, as above, so Music opened hidden and silent. Two of those waited side by side and opened one Music between them. No Music crashed.
- The system log shows 8 Musics starting up to the end of Static's log, and one had no launch line. Music quit 3.5 s after a launch, and 81 ms later the playlist read queued behind the tune started it again: both checks still saw Music as running, so the read's `tell application` launched it. ⌥ was up, so there was no dialog. A script can still start Music in the moment Music quits, until the next entry. That Music listed a second Favourite Songs that couldn't be read (-1728) in place of Vibe, and the next read put Vibe back in its old place.

Rejected:

- Launching anyway after 30 s: that's the dialog.
- Waiting for every modifier: ⌥ is the one that brings up the dialog.

## 2026-10-24: Scripts only reach a running Music, and a newer pick cancels a waiting launch

Two leftovers from step 7's hand test, in the entry above. Not hand-tested yet.

- A script started Music as it quit. Both checks had passed, in Swift and in the script, because Music hadn't finished quitting. `tell application id` looks the app up through LaunchServices before it sends the first event, and starts it if it isn't running.
- Each script is now the body of a `tell current application`, inside `using terms from application id "com.apple.Music"`. Free Roam is always running, so AppleScript never looks Music up, and never starts it. A send function, installed with `OSASetSendProc`, sends each event to Music's process ID instead, looked up when the script's turn comes. An event to a process that has gone fails, and nothing starts a process from its ID. So `launch()` is the only way Free Roam starts Music.
- Tried first, with Chess standing in for Music: sending the events of a `tell application id` script to a process ID. AppleScript started Chess before the send function saw the event. A create function didn't help either, because it gets no target at all. Passing the process ID into the script as a value doesn't work: AppleScript reads it as raw data, not an application.
- An event to a process that has gone fails with procNotFound. AppleScript takes that to mean the app isn't running and tries to start it, so the send function never passes it on. It answers `notRunning` when the process has gone, and connectionInvalid when it's alive but refusing events, as Music does while it starts. `launch()` still retries connectionInvalid.
- Scripts run through OSAKit, because NSAppleScript has no way to set a send function. One AppleScript instance runs every script, behind a lock: a new instance for each script added about 17 ms, against 8 ms for a whole `player state` read. A script whose text says "application" stops Free Roam with a precondition failure, because it could start that application.
- Tests, with Chess closed: a script for a process that has exited throws `notRunning` and Chess stays closed, a script's events reach the process it's given, and a script that sends nothing runs. Music's own scripts ran once from a temporary test: the reads against Music (playlists, durations, tracks, artwork, now playing and volume), and the ones that change Music against an exited process, so they compiled but Music never got them.
- Left: a Music that's quitting but hasn't exited can still answer a script, as before. If Music's process ID went to another app between Music exiting and the event, the event would go to that app, and macOS would ask whether Free Roam may control it. Pressing ⌥ again in the moment Music starts can still bring up the library dialog.
- A tune waiting for ⌥ to come up launched Music after you'd moved on to Radio Off: 3 of the 8 launches in the step 7 hand test. Now the next tune cancels the one before it, Radio Off included. That ends the wait, and `launch()` checks for a cancel once more just before it opens Music, so a replaced tune never opens it. A new station's tune does its own launch, so two tunes no longer wait side by side. The log says "Didn't launch Music: cancelled while waiting for ⌥ to come up", and "A newer pick replaced the tune to …".
- The rest of a replaced tune already stopped once it saw a newer one, and the cancel only stops it sooner. A tune that has already opened Music still leaves it open, hidden and silent, when you pick Radio Off.
- A test cancels a wait while ⌥ is held, and checks that it ends at once with a cancel instead of running on for 30 s.

Rejected:

- Dropping queued scripts when NSWorkspace says Music has terminated: that comes after Music has exited, so a script already running could still start it.
- `SBApplication(processIdentifier:)` from ScriptingBridge, or building each Apple Event by hand: both address a process, but every script would need rewriting.

## 2026-10-26: The app is called Free Roam

- Static is now Free Roam, the name the website already used. The app is `Free Roam.app`, its executable, SwiftPM product and target are `FreeRoam`, and the bundle ID and log subsystem are `com.happys1ngh.freeroam`. The repository becomes `HAPPYS1NGH/free-roam`, and the development certificate "Free Roam Development".
- GTA stays out of the name and the icon. "Free roam" is a general open-world term, not a game's name, and the badge is FREE ROAM lettering inside a ring, with no game imagery. The rules in [PLAN.md](PLAN.md) say so too.
- Nothing carries over from Static. It was never released, so there's no migration, compatibility shim or fallback for the old bundle ID, defaults domain or permissions. The new bundle ID starts with empty `UserDefaults`, so the wheel follows Music's library order until you change something in Settings. macOS asks again to let Free Roam control Music, and Screen Recording has to be granted again. The defaults keys (`stations`, `library`) never named the app, so they stay. The hotkey's Carbon signature changes from `'STAT'` to `'FRRM'`.
- Development builds need the new certificate, so run `scripts/make-signing-cert.sh` once. Until then `bundle.sh` signs ad hoc. The old "Static Development" certificate stays in the login keychain until you delete it.
- A Static built before the rename keeps running. Both apps register ⌥Q with Carbon, which lets a second app take the same hotkey, so both would answer it. `bundle.sh --run` only quits copies inside `Free Roam.app`, so it leaves Static running. Clean up once by hand: quit Static from its menu bar menu, then `rm -rf dist/Static.app`. To clear what macOS and Static kept as well, run `tccutil reset All com.happys1ngh.static` and `defaults delete com.happys1ngh.static`. Both are optional.
- Earlier entries keep the name Static where they record what happened or was measured under it, such as its logs, the hand tests and the signing results. Where they describe how the app still works, they say Free Roam.

Rejected:

- Keeping Static: a quick web search found a radio brand that already uses the name (`output/branding/2026-10-24/prompts.json`).
- Moving Static's saved stations and permissions across: it never shipped, so there's nothing to move.

## 2026-10-26: A welcome window explains the permissions

Built from the user's brief. Not hand-tested yet: the window, the Music prompt and coming back from System Settings all need checking in the bundled app.

- At launch Free Roam shows a small window that explains its two permissions, Control Music and Screen Recording. Each has a status, Allowed or Not yet, and an Allow button. Below them it says "You can change these later in System Settings.", then come Don't Show This Again and Close.
- It stops showing once you choose Don't Show This Again, saved as `welcomeDontShowAgain` in `UserDefaults`, or once both permissions are allowed. `WelcomeModel.shouldShow` is the rule, and tests cover it. Closing the window with its close button or Close saves nothing, so it shows again at the next launch, and nothing else nags. People often open an app, close it straight away and come back later, so closing the window doesn't count as saying no.
- Until now Free Roam asked for Screen Recording only from Allow Screen Recording… in the menu. That was easy to miss, and you had never seen the desaturated backdrop. This replaces "Free Roam now asks only from Allow Screen Recording…" in the Settings entry above. The menu items stay, and Free Roam still never asks for Screen Recording by itself: only an Allow button, in the menu or the window, asks. macOS still asks about Music the first time Free Roam sends it a command, with or without the window.
- macOS only answers for a running Music. So Allow for Control Music opens Music hidden with `MusicBridge.openHidden()`, as Settings does, then checks without prompting, retrying while Music starts as scripts do (`permissionOnceStarted()`). An earlier no opens Privacy & Security > Automation in the same click, as the menu does. Only when Free Roam hasn't been asked yet does it call `AEDeterminePermissionToAutomateTarget` with `askUserIfNeeded`, which blocks until you answer, so it runs on a dispatch thread. Checking first means a no you've just given in the prompt doesn't open System Settings on top of it. Once you've said yes, it waits for Music to take scripts and loads the playlists, so the wheel has stations even if Music was closed at launch. Closing the window cancels the request, so a wait for ⌥ can't open Music later.
- Music's last answer is saved as `musicControlAllowed`, because macOS returns `procNotFound` while Music is closed. Without it, the window would come back at every launch with Music closed. `MusicPermissionMemory` keeps it, and `MusicBridge` records every answer that turns up: each permission check, the menu's included, each script Music ran and each one it refused. At first only the welcome window saved it, so allowing the prompt during a tune never reached it, and every launch with Music closed said Not yet again. The cost: if you switch the permission off in System Settings while Music is closed, the window trusts the old answer until Music runs.
- The Screen Recording text was checked against the code. The first draft said Free Roam only looks at the screen while the wheel is open, and that isn't true. Free Roam captures the screen with the mouse when ⌥Q goes down, 150 ms before the wheel opens, and throws a tap's capture away. It also captures each display once at launch, and again when one is connected, to warm up, and drops that capture straight away. The still on screen goes once the backdrop has faded, 450 ms after the wheel closes. Nothing in the app writes a file or uses the network, and Core Image keeps no intermediates. The window used to say all of that, which was accurate but too long. Now it says Free Roam only uses the screen to draw the wheel's background and never saves or sends what it sees.
- Both statuses are checked again whenever Free Roam becomes active, as when you come back from System Settings. Screen Recording can still read Not yet until Free Roam is reopened, and the window says macOS may ask for that.
- Rendering the view with `ImageRenderer` in each state found two problems. With the status and button in a column of their own, the text wrapped differently when the button changed, so the window would have changed size while asking. The status and button now share the title's line, and a test checks that every state renders at the same size, 480 pt wide. `ImageRenderer` also can't draw a spinner, and the narrower spinner was what had changed the text's width, so Allow is now disabled while Free Roam asks instead.
- The window is an `NSWindow` with an `NSHostingController`, not a SwiftUI `Window` scene, because it opens from the app delegate at launch, where `openWindow` isn't available.
- Free Roam activates first, then brings the window forward with `orderFrontRegardless()`, because macOS 14 and later can turn the activation down and leave the window behind the app you're in. Escape closes it, like Close. Neither `NSWindow` nor the hosting view turns Escape into `cancelOperation`, as a test with an offscreen window showed, so the window catches it in `sendEvent`. VoiceOver reads the two buttons as Allow Control Music and Allow Screen Recording.
- The window's text names no game.

Rejected:

- Showing the window on the first launch only: closing it straight away would lose it for good.
- Counting the close button as Don't Show This Again.
- Keeping the menu items as the only way in: they were easy to miss.
- A spinner in place of Allow while Free Roam asks: the row's text changed width with it.
- Waiting for Music with a `get version` script before asking: the script brings up the prompt itself, so a no given there would look like an earlier one and open System Settings straight after.
- Closing on `cancelOperation`: nothing on this window's path sends it.

## 2026-10-26: Settings picks stations from a grid of covers

Built from the user's brief, to replace the list of checkboxes. Not hand-tested yet. This replaces the single list in the Settings entry of 2026-10-23.

- The pane has the wheel's stations at the top, in wheel order, as the wheel's own discs (`StationDisc` and the same 2×2 mosaic), each with its place. Below them are a search field and a grid of every playlist in Music, in library order. Each tile is a square cover with the name and song count. Clicking a tile puts it on the end of the wheel or takes it off. A station's tile gets the wheel's accent ring and a badge with a check and its place. At 25, the other tiles grey out and a line says the wheel holds 25.
- Drag a disc to move it. It takes each place as the pointer reaches it, and every move is saved, as before. Its × on hover, or Delete once it has focus, takes it off, and Delete passes focus to the next disc. With focus, ← and → move it. The discs wrap into rows, because dragging to a place scrolled out of view needs autoscroll. At 36 pt, all 25 fit in two rows down to the window's 660 pt minimum width, and a test pins that.
- A disc drags as `com.happys1ngh.freeroam.station`, a type declared in Info.plist and offered only to Free Roam, so text from other apps can't land on the strip and a disc can't land anywhere else. One drop target covers the whole strip and works out the place under the pointer from where it is, since every disc is the same size. The first build gave each disc its own target, so a drop in a gap, outside the strip or cancelled with Escape left the dragged disc faded, and the strip then took text dragged in from other apps. Now leaving the strip ends the faded look. The strip still remembers which disc it was, so a drag that leaves and comes back carries on. SwiftUI gives no call when a drag ends elsewhere, and none is needed: only this strip's drags carry the type, and each one sets the disc afresh.
- Turning a playlist on now moves it to the end of the wheel. Before, a ticked playlist went wherever it sat in the list. A move works in wheel order: the station goes before the one in its new place. Playlists that are off or missing keep their places among the saved entries. Saving by persistent ID, hiding missing playlists, and new playlists joining the end while there's room all work as before. The existing tests keep their checks and only call the new move. The rules are pure functions on `StationList`, with tests: turning on and off, the 25 cap, moving and the search.
- A station Music didn't list still counts toward the 25. It didn't at first, so a short read that hid 2 of 25 let you add 2 more, and when they came back the wheel had 27: it opened with the first 25, and Settings said "27 of 25". Merging never leaves more than 25 on now. It turns off the stations past the 25th, so a choice saved with too many comes back to 25. The header says how many stations weren't found, such as "23 of 25 on the wheel · 2 not found in Music", with a Remove button. Otherwise a playlist you'd really deleted would hold its place for good. Removed stations stay off if they come back.
- The search matches every word of it, in any order, ignoring case and accents.
- States: loading while Music opens in the background, no playlists, Music permission denied, any other error, and a search with no results. The denied state opens Privacy & Security > Automation through `PrivacyPane` and has Try Again, because coming back from System Settings doesn't reopen the window.
- Only stations loaded their covers until now. `StationDetails` now reads the covers of other playlists when Settings asks, as their tiles and discs come on screen. Each playlist costs one light read and up to four 30–50 ms cover reads, on the same one-at-a-time queue as tunes. The light read gets the track count and the albums of the first 100 tracks, enough to pick four covers. It took 16–39 ms for each of this library's 16 playlists, the largest with 67 tracks, and 19–27 ms over the whole 168-track library after a 94 ms first run. The first build read every track's title, artist, album and length instead, which takes seconds for a smart playlist of thousands, and a tap would have waited behind it.
- These reads come after any station waiting to load, run one script at a time, and each script waits while the wheel is in use. That covers ⌥Q being down, the wheel being open, a tap waiting for Music to say what it's playing, a tune that hasn't reached Music, and one second after ⌥Q comes up, the wheel closes or a tune ends. That second covers the 450 ms volume restore, after ⌥Esc too. A script already running when ⌥Q goes down still finishes first, so the press's read of what's playing, and a tap's tune after it, can wait for that one script: up to about 50 ms.
- Each logo is 400 KB decoded, so Settings keeps at most 48 for playlists that aren't stations, about 19 MB. It drops the longest unseen first, never one on screen, and lets go of them all when the window closes. Stations keep theirs. A dropped logo reads again when its tile comes back. Requests are counted per tile and disc, so a station shown in both keeps its request until both have gone. The window's close notification ends them, as well as `onDisappear`, which isn't a sure sign for a window closing.
- The song count comes from the light read, so it costs nothing extra. Until a playlist has been read, its tile leaves the count blank.
- The wheel and Settings share one `StationDetails`, which the app delegate owns. tokens.json now loads when the app delegate is made, so Settings can use the ring colour and the disc's rim. Without tokens.json, Settings falls back to the system accent colour.
- VoiceOver reads tiles and discs as buttons, such as "Gym, on the wheel, slot 3", with the song count as a tile's value. A disc's default action takes it off, and it has Move Earlier and Move Later actions. The search field takes focus when the grid appears, so you can type straight away. With Keyboard navigation on in System Settings, Tab reaches every tile and Space clicks it.
- The window opens at about 720×600 and resizes from 660×480. It's SwiftUI, with AppKit's own search field for the native look and Escape to clear, and no new dependencies.
- `ImageRenderer` draws a text field, a scroll view and a spinner as placeholders on macOS, so the picker was checked by snapshotting an `NSHostingView` in an offscreen window instead. That turned up two problems. `ContentUnavailableView` sat in the top left corner until it got a full-size frame. And with 40 pt discs and room kept for the ring, 25 stations took three rows and left the grid less than one row at the minimum height, so the discs shrank and the ring now draws into the gap. The snapshot doesn't draw Core Animation filters, so the greyed-out tiles showed faded but not grey.

Rejected:

- A horizontal strip that scrolls: dragging a station to a place out of view needs autoscroll.
- Clicking a disc to take it off: it's too easy to do when starting a drag.
- Reading song counts with the playlist list: Music has no track count for a playlist, so it would mean a script per playlist on every read, and the list is read after every wheel close.
- A second, lower priority inside `MusicBridge`'s queue: the wheel already knows when it's busy, as the playlist read after a close does.

## 2026-10-27: The app icon

- The icon puts the badge, `prototype/public/free-roam/app-icon.png`, on a navy plate drawn to Apple's macOS grid: an 824 px rounded square with continuous corners in a 1024 px canvas, with the template's soft drop shadow. The plate runs from `#22344A` at the top to `#0E1620`, the dusk sky in the website's coast photo. The badge's disc is 80% of the plate's width.
- Checked on macOS 27.0.1 by asking `NSWorkspace` for the icons of test bundles. An icon on that grid shows at full size, as Apple's do, with no grey plate. A bare circle, like the badge on its own, goes into the grey plate at about 80% size. macOS 14 and 15 show the icon as drawn.
- At 16 pt and 32 pt @1x, macOS 27 puts every app that ships only an .icns in a grey frame. Cursor, Obsidian and Emdash get it too. Only an Icon Composer icon compiled into `Assets.car` avoids it, and that needs Xcode's `actool` in `bundle.sh`. Retina sizes and the Dock are fine.
- Scaled down to 16 and 32 px, the badge turns into a light grey disc: the thin cyan ring blends into the black, and the lettering fills the disc. Those two sizes keep the badge's own lettering, set a little smaller, and redraw the ring a pixel or two wide. At 32 px the ring keeps its four gaps. 64 px and up are the master scaled down.
- The badge PNG's flat areas drift a few levels around each colour, and its opaque pixels have an alpha of 253 or 254. Pixels within 20 levels of black, ivory or cyan now become exactly that colour, which looks the same and compresses far better. The plate's gradient is filled row by row, because `CGGradient` dithers. Together they took the .icns from 1.1 MB to 539 KB.
- `scripts/make-brand-assets.sh` regenerates the icon with the Swift in `scripts/brand/` and `iconutil`. The 1024 px master is `output/branding/free-roam/macos-app-icon-1024.png`.

Rejected:

- The bare badge as the icon: macOS 26 and later shrink it into a grey plate.
- A full-bleed square: macOS 27 masks it to shape, but macOS 14 and 15 would show square corners.
- A plate in the website's `#101514`: the badge's black disc disappeared into it.

## 2026-10-27: The menu bar glyph

- The status item was the SF Symbol `radio`. It's now a template image made from the badge: its ring, with the four gaps, around the badge's own lettering, 18 pt square. The files are `MenuBarIconTemplate.png` and `MenuBarIconTemplate@2x.png` in `Sources/FreeRoam/Resources`, and `bundle.sh` copies them. `NSImage(named:)` loads them as one template image, so macOS tints it for light and dark menu bars. A build without the bundle, like `swift run`, falls back to `radio`.
- The ring is 1 pt wide so the lettering inside it can be as large as possible. At @2x it reads FREE ROAM, at about the weight of the Wi-Fi and battery symbols next to it.
- At @1x the strokes are about a pixel wide and the lettering turns into texture. Its grey pixels made the glyph look like a dimmed item, so the @1x file steepens the alpha to keep it at full strength. There it reads as the badge's shape rather than as words, the one place `radio` was clearer. That only happens on non-Retina screens, so the badge still wins.
- Not yet seen in the real menu bar: that needs a bundle build.

Rejected:

- A ring with nothing or a dot inside: it reads as a crosshair.
- A filled disc with the lettering cut out: much heavier than the symbols around it.
- Thresholding @1x to solid pixels: the ring went jagged and the lettering broke into specks.
- `radio` on @1x screens only: a laptop with a second screen would show two different icons.

## 2026-10-27: The welcome window shows the badge

- The badge sits above the title at 56 pt, from `FreeRoamBadge.png` (112 px) in `Sources/FreeRoam/Resources`, which `bundle.sh` copies. VoiceOver skips it.
- Its space is a fixed 56 pt square whether or not the image loads, so the window keeps one size in every state, 480 by about 550 pt. Without the bundle, as in `swift run`, the square stays empty. The same-size test renders every state with the real badge from the source tree, and once without it.

## 2026-10-27: The website's icons and social card

- The header and footer showed the 1 MB badge PNG at 60 px. They now use `free-roam/badge.png`, 240 px and 48 KB, and the site no longer publishes the source.
- `favicon.ico` at the site's root holds 16 and 32 px badges, drawn like the app icon's small sizes with the ring redrawn, and filling the square. Browsers ask for `/favicon.ico` on their own, and the pages link it too. `apple-touch-icon.png` (180 px) has the icon's plate full bleed, because iOS rounds the corners itself and turns transparency black.
- There's no SVG favicon. The lettering only exists as a raster, so an SVG would either wrap the PNG, which gains nothing, or need the lettering traced into paths, which is redrawing it.
- `free-roam/og-image.jpg` is the social card for both pages, 1200 × 630: the hero's headline on the left and the wheel on the right, over the coast photo. The wheel's station art is cut from the coast photo, because the demo's album covers are approved for the demo only. `site-metadata.mjs` turns its path into an absolute URL for `og:image` and `twitter:image`, and a test checks it's published at 1200 × 630.

## 2026-10-27: Launch images

- `scripts/make-brand-assets.sh` also draws the launch images into `output/launch/`, all in the After Hours look: the coast photo, the dark shade, Sofia Sans Extra Condensed capitals and Courier New eyebrows. They're support images; the launch post itself is a screen recording.
  - `github-social-preview.jpg`, 1280 × 640: the badge and one line, kept inside the middle 640 px square so a square crop or a small unfurl still shows them.
  - `x-announcement-1600x900.jpg` and `x-portrait-1080x1350.jpg`: the headline, the wheel and the repository's address.
  - `video-poster-1920x1080.jpg`: the wheel open over the coast as a desktop picture, faded and vignetted as the app's backdrop is, with ⌥ Q below it.
- The wheel follows `tokens.json`: ten slots, Radio Off at the bottom, idle discs at 40% in grey, the selected one in colour inside the `#65B4D4` ring, and its name above the centre. Its art is cut from the coast photo, not album covers. A soft dark scrim behind it keeps the faded discs readable over the bright sky.
- No image names or shows a game, its stations or its fonts.

## 2026-10-27: A station plays on through its playlist

The bug: a station played the song it tuned to over and over. Found from Free Roam's and Static's logs and Music's scripting dictionary on macOS 27.0.1. Not hand-tested yet.

- `play track N of` a playlist queues that one track and nothing after it. Music still gives the playlist as `current playlist` and the track's place in it, so every press looked right. With repeat off, in step 6, Music stopped after the tuned track: 10 s after track 12 of 13 of PUNJABI ONLY ended it was playing nothing, though track 13 runs about 3 minutes, and Download stopped after track 1 of 4. So the step 6 finding that stations stopped at the end of their playlists was this, and so is the 2026-10-22 note that Music played on through the playlist. Since step 7 set repeat to all, the one track loops: Download was still on track 2 of 4 48 s after it ended, and on 2026-10-27 My Playlist #1 was still on track 47 of 67 9 s after it ended.
- Others have hit the same. Doug Adams found that in iTunes 11, playing one of a playlist's tracks with AppleScript left nothing queued after it, and playing the playlist itself worked ([dougscripts.com](https://dougscripts.com/itunes/2012/11/interesting-play-issue-with-miniplayer/)). His Big Buttons applet (2021) carries on through a playlist from a track by clicking Music's window through Accessibility. On macOS 26.0 even playing a whole playlist from a script played one song, until 26.1 ([Apple Community](https://discussions.apple.com/thread/256158179)), and in Music on macOS 26 a song started with Return plays alone, where a double-click queues the rest ([Apple Community](https://discussions.apple.com/thread/256141208)). Music's dictionary has no way to start a playlist partway in.
- So a tune now plays the playlist itself, with shuffle off so it starts at track 1, pauses, steps on to the on-air track with `next track`, and plays. The seek works as before, with the clock counting from before the steps. Repeat then loops the whole playlist. A station on track 1 needs no steps, so it seeks even if Music can't say which track it's on.
- Each script steps at most 10 tracks and returns the track Music is on, so a newer pick cancels between scripts and the volume dip gets its turns. A cancel that lands during a step stops the tune without playing on, so a replaced station never plays over Radio Off or the next pick. The last script stops once Music is on the on-air track, because Music skips a track it can't play, such as an unchecked one, and the steps would carry it past.
- Whether a paused Music moves on with `next track` isn't known. If it doesn't, Free Roam plays and steps while playing, and logs "Music didn't move on while paused, so it steps while playing". A try that still doesn't move waits 100 ms. Stepping gives up after 2 s, when Music goes back a track, skips past the on-air track or can't say where it is, and when a step fails, which logs "Couldn't step Music to track …". The station then plays on from where Music got to, without a seek, and the log says "Music got to track … instead of track …".
- The cost is silence while Music steps, after the retune sound. How long a step takes isn't measured yet, so the log says "Stepped Music from track 1 to 47 of playlist … in … ms". The on-air track is half a playlist in on average, so a playlist of a few hundred tracks or more, such as a big smart playlist, will often use up the 2 s and start off the clock.
- A tune on release steps while the volume comes back up, and one from resting on a station steps while it's dipped. Music is paused for the steps unless it didn't move on while paused, and then each track it passes plays for a moment. While Music is paused, the tracks it passes shouldn't play, count as skips or show in Music's history, but that's unchecked too.
- A tune checks whether its playlist was edited only once the station plays, after the seek or the log that it fell short. The station loader's track and cover reads take turns with the tune's scripts, and would slow the steps.
- Shuffle and repeat are now also set after `play`, in case a new queue brings its own. On 2026-10-27 they read as changed on a tune 1 s after one that had set them. The log still reads them before each tune, so the next hand test shows whether anything else changes them.

Rejected:

- Playing track N after playing the playlist: in Doug Adams's test, iTunes played that track and then went back to what was queued, and nothing shows what Music queues next until the song ends.
- A temporary playlist that starts at track N: it adds playlists to your library, and `current playlist` would no longer be the station.
- Clicking the track in Music's window: needs Accessibility and Music's window on screen.
- Stepping while playing from the start: every track it passes would start to play.
- Stepping back from track 1 for tracks near the end: it isn't documented whether `previous track` goes round to the last track with repeat on.

## 2026-11-19: A station shuffles its playlist

Measured on Music 1.7.2 and macOS 27.2.1 by scripting Music directly, after Free Roam's logs showed every tune falling short.

- Music now takes `play` of a playlist a few hundred milliseconds after the script that sent it returns. Read straight after `play`, `current playlist` and `index of current track` are missing or still the old ones, and `player state` can say stopped. They were right after 0.25–0.5 s. `next track` sent while paused straight after `play` didn't move Music. So stepping to the on-air track never started: every tune logged "Stepped Music from track 0 to 0" and "Music got to a track it can't name", and played from the top of whatever track Music started on.
- After `play`, shuffle and repeat read as changed back for about a second, such as repeat reading off for 0.75 s, then settle on what was set. That's probably also the 2026-10-23 finding that the log said they were different on 34 of 42 tunes.
- With shuffle on and repeat set to all, `play` of a playlist started on a different random track 5 times out of 5. Over 13 tracks ending on their own in a 10-track smart playlist, and in a 1-track playlist, Music always stayed in the playlist and looped. `index of current track` gave the track's place in the playlist, not in the shuffle. `set player position` works once the track has loaded, as before.
- So a station is now its playlist on shuffle, like radio. A tune turns shuffle on and repeat to all, plays the playlist, and asks Music every 150 ms until it says it's playing that playlist, for up to 3 s. Then it sets shuffle and repeat again, and seeks to somewhere between 15% and 65% of the track Music started on, retrying while the track loads as before. In tests through `osascript`, Music said it was playing the playlist 0.7 s after `play` and took the seek on the second try. A tune never plays a song from outside the station's playlist.
- The broadcast clock is gone from the Mac app. It needed the playlist in order, which needed stepping, and with shuffle on Music's next track can't be predicted. The prototype keeps its own clock in `broadcast.ts`.
- For the station Music is playing, the caption shows the track Music named at the press and doesn't guess past it, because Music picks the next track. Every other station shows its song count, such as "24 songs" or "No songs", worded as in Settings. A playlist edited since its tracks loaded also shows its count, because its track numbers may have moved.
- The log says "Turned Music's shuffle and repeat on" when either was different, and "Music was playing track … ms after it was told to" for how long Music took.
- Pausing straight after `play`, as Radio Off right after a tune does, left Music paused in 2 tries out of 2.
- Review fixes, not hand-tested yet. Because Music takes `play` late, a replaced tune's `play` can still land after Radio Off's pause, so Radio Off pauses again 0.7 s later if nothing has been tuned since. The wait only counts a track under 5 s in, because a new `play` starts from the top and Music can still report the station's old track when it was already on. Shuffle and repeat are set once more after the seek, more than a second after `play`, in case a set inside the flicker was undone.
- Music 1.7.2 crashed twice on 2026-11-19, both times in `MPRemoteCommand` while handling a command. The first was before these tests. The second came after five playlists were played within a few seconds of each other, two of which didn't say they were playing within 3 s. It's not known whether quick tunes from the wheel cause it.

Rejected:

- Keeping the clock with shuffle off: stepping to the on-air track no longer works, and a station of a few hundred tracks would often run out of time even when it did.
- Waiting a fixed time after `play` instead of asking: Music took 0.25–0.7 s, and a fixed wait long enough for the slowest would delay every tune.
- Predicting the next track in the caption: wrong as soon as Music shuffles.

## 2026-11-21: Stations are back on their clock

The user wanted stations to act like radio again: drop in on what's on air, a later song if you come back later, and the wheel showing what's on every station. Measured on Music 1.7.2 by scripting Music directly.

- `play track N of` a playlist starts that track at once, turns shuffle off, and queues nothing after it. With repeat off, Music stops when the track ends. With repeat on all, the track loops without posting anything.
- Repeat set off before `play track` read as all again about a second later in one try out of three, so it's set off once more 1.5 s after the track starts.
- Music posts `com.apple.Music.playerInfo` on every change. A track that ends posts Paused and then Stopped with no track. A pause in Music posts Paused with the track, and a seek posts Playing with the same track. The notification's `PersistentID` is the track's persistent ID as a signed 64-bit number.
- Playing the next track straight from the Stopped notification had it playing 0.35–0.4 s after the last one ended, in 2 tries out of 2.
- So a tune plays the track on the station's clock and seeks to where the clock is in it, counting the time Music took. `OnAirRelay` listens for the notification and, when the station's track ends, plays the next track in playlist order from the top. It costs one notification and one script a song, and nothing in between.
- It only works while Free Roam runs. Without it Music stops after the track, and the next tune lines the station up with its clock again.
- After a pause in Music the station plays on in order behind its clock until it's tuned again, and the caption follows Music for that station. Every other station shows its track on the clock again.
- If you play a track in Music that Free Roam didn't pick, the relay stops following the station.
- If Music doesn't reach the track within 3 s, the station falls back to the 2026-11-19 shuffle.
- Hand-tested through the wheel on 2026-11-21: it played as expected.

Rejected:

- Stepping with `next track` from the top: still ignored straight after `play`, and slow for long playlists.
- Polling Music for the end of the track: the notification says it for free.

## 2026-11-21: The ring follows the Mac's accent colour

The user's brief: match the accent colour in System Settings → Appearance, but keep Free Roam's blue for Multicolor. There's no setting, to keep the app small.

- macOS writes `AppleAccentColor` to the global domain for every accent but Multicolor, and Multicolor gives apps system blue, which is darker than `#65B4D4`. So with the key the selected ring and Settings' highlights use `controlAccentColor`, and without it they use `ringColor` from `tokens.json`.
- The wheel reads it each time it draws, so a change shows on the next open.

## 2026-11-21: One page, with the app's wheel

The user's brief: one site, not `/free-roam/` and `/` side by side, with the app's exact wheel and sounds.

- The landing page moved to `/`, and the full-screen demo and the landing page's always-on wheel preview are gone.
- Holding Q anywhere on the page opens the overlay from the browser prototype that the Mac app was ported from: a fixed backdrop with the app's saturation, brightness and vignette, the wheel above it, and the app's open, close and filter timings. The sounds were already the four WAVs a release ships.
- The station list tunes through the same `useWheel` instance, so touch and keyboard users get the same stations without a second wheel. It also keeps every station name in the prerendered HTML, which the release check needs now that the wheel is only in the DOM while open.
- The unused Passenger Seat and Frequency directions were deleted.

## 2026-11-21: The web wheel behaves like the app's

The user's brief: the page's wheel felt bigger than the app's and didn't sound like it.

- Size: the app measures the wheel in hundredths of the screen's height. The page now does the same with `screen.height`, which is in points on a Mac, and draws it at that size instead of stretching it to fit. It only shrinks when the window is too small.
- Pointer: the app freezes the pointer while the wheel is open and picks from mouse movement alone. On the page the pointer stayed visible, so aiming at a disc moved the pick somewhere else, ticked, and retuned after the 1 s rest. The page now hides the pointer over the open wheel and a click stands in for letting go of ⌥Q. Touch screens skip that layer and tap the discs.
- Choosing from outside the wheel, with Radio Off or the station list, no longer plays the close sound, which the app never does.
- The sound code was already a line-for-line port. Music's volume dip while the wheel is open has nothing to dip on the page, which plays no music.
