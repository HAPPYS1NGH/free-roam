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

## 2026-10-22: The hotkey and wheel input need no extra permissions

Measured on macOS 27.0.1 with the Phase 2 step 2 build, where holding ⌥Q opens a wheel of plain circles. `--probe` showed Accessibility and Input Monitoring switched off throughout, and the logs counted what each input route delivered.

- ⌥Q is a Carbon hotkey (`RegisterEventHotKey`). It needs no permission and never sees plain Q, and ⌥Q no longer types "œ" in the app you're in. Tapping, holding, ⌥Esc to close, full-screen apps, other Spaces and a second display all worked by hand.
- When ⌥ comes up before Q, Carbon still sends Q's key-up, about 0.4 s later when Q comes up. The wheel doesn't wait for it. While ⌥Q is down the hotkey checks the modifiers every 16 ms, and letting go of ⌥ ends the hold, as with ⌘Tab. That also means a key-up that never arrives can't leave the wheel open.
- The overlay is a borderless, non-activating `NSPanel` at the status bar level that joins every Space and full-screen app. The app you were in stays active while the wheel is open.
- Mouse moves:
  - Moves go to the active app wherever the pointer is, and `NSEvent`'s global monitor gets a copy of each. In all but two holds that route carried more movement than the panel's own, including when the pointer crossed to the second display.
  - Static's panel also receives some of the same moves while Static is in the background: from a quarter to nearly all of the distance, depending on the hold. Adding both routes made the pick up to twice as fast. The wheel now reads only the active app's copy, or Static's own events when Static is the active app. That last case can't happen yet, because Static has no window to activate, so check it once Settings exists.
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

- A capture stream that keeps running: one capture takes well under the fade, and a stream would record the screen for as long as Static runs instead of only when the wheel opens.
- Adding the global monitor's moves to the panel's own: the same movement counted twice.
- A listen-only event tap: it gets nothing without Input Monitoring.
- An `NSTrackingArea` with `.activeAlways` on the panel: it only added more duplicate moves.

## 2026-10-22: Tuning in and the volume dip

Measured on macOS 27.0.1 with the Phase 2 step 3 build, from Static's logs over three hand tests and from scripting Music directly while it was paused.

- Tuning plays track N of the station's playlist (`play track N of user playlist …`), then sets `player position` to the on-air position. Music plays on through that playlist afterwards: on every ⌥Q press after a tune, Music's `current playlist` was the station Static had tuned.
- Until a streamed track has loaded, Music ignores a new player position or refuses it with "Can't set player position" (-10006). In the first test, 7 of 9 tunes started within 12 seconds of the top of the song. Static now sets the position every 100 ms, moving the target on with the clock, until Music reports it. Every tune since has landed, most on the second try and the slowest on the seventh, so you can hear the start of the song for a moment before the jump. The retune sound in step 4 should cover it.
- Each ⌥Q press asks Music which playlist is playing, so the wheel opens on that station even after it was changed in Music. When Music plays something that isn't on the ring, the wheel opens on Radio Off, and letting go without moving changes nothing.
- While Music isn't running, Static sends it nothing, because any script would launch it. Picking a station launches it through `NSWorkspace` with `activates = false`. Music is listed as running before it takes scripts: the first script failed after 9 s with "Connection is invalid" (-609), so launching now waits until Music answers. Not checked by hand yet: whether Music's window stays behind the app you're in.
- Music drops a `sound volume` change that comes within about 100 ms of the last change it took. Measured while paused: a second change 90 ms after the first was dropped and one 100 ms after stuck, a dropped change doesn't restart the wait, and ten changes in a row kept only the first. Reading the volume is accurate straight away.
- So Static changes the volume at most every 150 ms, timed from Music's answer to the last change, and a new ramp waits for the one it cancels. Each step goes where the ramp should be by the next one: the 150 ms dip is a single change and the 450 ms restore is three, 150 ms apart. On quit the restore waits 150 ms after any script already queued.

Rejected:

- Setting the position in the same script as `play`: it only stuck when the track had already loaded.
- A volume ramp in 16 ms steps: Music kept only some of them, sometimes not the last, and the next dip saved the wrong volume to come back to. Music's volume crept from 97 to 76.
- Setting the volume again after a ramp whenever it read back wrong: it hid the cause.
- Timing the gap from when a change was sent: behind a tune's commands, a change reached Music late, the next one followed it by less than 100 ms and was dropped, and the volume crept from 75 to 40.

## 2026-10-22: The real wheel

Measured on macOS 27.0.1 with the Phase 2 step 4 build, by hand and from Static's logs.

- Music returns a playlist's titles, artists, albums and lengths in about 40 ms, and one track's artwork in 30–50 ms as `tdta` data, which decodes to a 600 or 1200 px JPEG. Static loads both in the background once the playlists have loaded: 12 stations' tracks took 490 ms and their 42 covers 1.4 s. Scripts still run one at a time, so a tune queued behind the loader waits for one script at most. Opening the wheel also loads any station that failed or is new.
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
- The capture leaves out only the wheel's panel, which is still on screen while a close fades out. Anything else of Static's on screen, such as the Settings window to come, stays in the still. It also leaves out the pointer (`showsCursor = false`): a pointer that showed in a screen recording of the wheel came from the recorder.
- The filter is one `CIColorMatrix`: the Filter Effects spec's matrix for CSS `saturate()`, times `brightness()`, which multiplies each channel. `CIColorControls` adds its brightness instead. Browsers clamp after each filter, but with a saturation from 0 to 1, the prototype's range, no channel leaves 0–1 before the brightness, so one matrix gives the same result.
- Browsers apply CSS filters to sRGB-encoded values. Core Image works in linear light by default, where the same matrix turned pure red into 202 instead of 150, and green into (171, 241, 171) instead of (104, 224, 104). So the working colour space is extended sRGB, which also keeps a wide-gamut display's colours. The still goes back into the capture's colour space, and ScreenCaptureKit captures in the display's.
- The vignette is an `EllipticalGradient`. SwiftUI measures its radii as fractions of the view's size and stretches the circle to the view's shape, so 0.5 reaches the middle of each edge (checked by rendering one). CSS's farthest-corner ellipse has the same shape and passes through the corners, so CSS's 100% is an end fraction of √2/2, about 0.707, not √2. The stops keep their CSS positions, and a test compares the rendered vignette with the CSS gradient.
- The still, the 7% wash and the vignette fade as one layer, like CSS opacity on `.wheel-backdrop`: in over 150 ms and out over 450 ms with `cubic-bezier(0.4, 0, 0.6, 1)`, apart from the wheel's 140 and 100 ms. Input stops the moment the wheel closes, and the panel leaves the screen once the backdrop has faded out. The wheel goes back to its smaller opening size after its own 100 ms, so opening it again during the backdrop's fade still grows it in.
- When Screen Recording is off, the menu adds that if System Settings already shows Static switched on, it needs switching off and on again. That's the stale switch from the signing entry above.
- Screen Recording stays optional. Tried by hand with and without it, the difference is significant: without it, the wash and vignette sit over the live screen at full colour and look clearly weaker. That's still an acceptable fallback for anyone who'd rather not grant the access.

## 2026-10-23: Settings and the stations on the wheel

Built in Phase 2 step 6. Passed by hand on 2026-10-23: picking stations by mouse and by scroll while the Settings window was active, Settings showing in the backdrop, ticking, unticking and dragging stations, a new playlist joining the end, a deleted one dropping off, Music launching hidden, the stations surviving a relaunch, and the new menu. The numbers come from Static's logs over 10 runs and 166 opens.

- Settings is one list of Music's playlists in the wheel's order. Ticking a playlist puts it on the wheel, dragging moves it, and every change saves at once. Stations run clockwise from Radio Off in list order. The wheel holds 25 stations, so a 26th can't be ticked.
- Until you change anything in Settings, the wheel follows Music's library order and takes the first 25 playlists, as the prototype does. After that, Static saves every playlist's persistent ID and name in `UserDefaults`, with whether it's on. The names let the wheel show its stations before Music has started.
- A playlist made after that joins the end of the wheel if it has fewer than 25 stations, and stays off otherwise. One you switched off stays off, because it's still in the saved list and only IDs Static hasn't seen count as new. A new playlist that found the wheel full stays off when a station leaves later.
- A playlist missing from Music's list drops off the wheel and out of Settings, but stays in the saved list with its place and whether it's on. A list can come back short while iCloud Music Library syncs or another library is open, and those playlists would otherwise return as new: on, at the end. A playlist made again gets a new persistent ID, so a deleted one just stays hidden. An empty list changes nothing.
- Static reads the playlists at launch if Music is running, whenever Settings opens, and after the wheel closes, once every tune has reached Music. Scripts run one at a time, so a read on press would hold up a tap's tune and the open's volume dip. A change in Music reaches the wheel from the open after the next one. The read checks again that Music is running when its turn comes, because `tell application` would launch it.
- Opening Settings while Music is closed launches Music hidden, because only Music can list the playlists. Tuning launches it hidden too, so its window no longer opens. The wheel itself still doesn't launch Music just to open.
- The menu is Settings…, Quit, and an Allow item for each permission Static is missing, checked again whenever the menu opens. Play Playlist and Capture Screen are gone.
- Capture Screen was the only thing that made macOS ask for Screen Recording. Static now asks only from Allow Screen Recording…, never at launch, because the backdrop works without it. The item calls `CGRequestScreenCaptureAccess`, which adds Static to the list in System Settings and shows macOS's prompt the first time, then opens that list.
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
- Shuffle and repeat: the broadcast clock plays each playlist in order and loops it. Every tune turns Music's shuffle off and sets repeat to all, in the same script as `play`, and leaves them that way. They're Music's own settings, so this changes how Music plays outside Static too. The log says when either was different. With repeat off, the step 6 hand test found 5 stations that had stopped at the end of their playlists.
- Music not answering: every script runs inside `with timeout of 10 seconds`. Scripts took 0.4 s at most in the step 6 test. A stuck one now fails with -1712 after 10 s instead of AppleScript's 2 minutes, and the queue moves on. Launching Music retries a script that timed out, as it does one Music refused while starting, but stops once 15 s have passed: counting 50 tries could have held a tune, and every script behind it, for over 8 minutes. A timed-out script still runs in Music once it answers again, so a volume change that timed out counts as made, and the restore undoes it instead of leaving Music at 30. A timeout while asking what's playing fails the read and leaves the station as it was, instead of reading as nothing playing and jumping to Radio Off.
- Music not running: until you change anything in Settings, the wheel follows the last playlist list Music gave, saved in `UserDefaults`, so it isn't empty when Music is closed at launch, or when Music lists no playlists while its library loads after launching. Logos still come from Music, so stations show initials until it runs. A tune that launches Music stays in flight for 2 s after its seek lands. A press meanwhile opens on that station without asking Music, and then, if Music isn't playing, Static tells it to play on and logs whether Music was paused or stopped. The step 6 log didn't say which, so a pause in those 2 s is played over too, unless it was Radio Off or another station. It isn't known yet whether Music really stopped after launching in the step 6 test or only said so.
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
- Every script now checks that Music is running when its turn comes, in Swift and again inside the script (`if application id "com.apple.Music" is running`), and otherwise throws `notRunning`. Before, only the playlist read checked when its turn came, and only in Swift. So `MusicBridge.launch()` is the only way Static starts Music. A press whose read finds Music has quit opens on Radio Off.
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
- Each script is now the body of a `tell current application`, inside `using terms from application id "com.apple.Music"`. Static is always running, so AppleScript never looks Music up, and never starts it. A send function, installed with `OSASetSendProc`, sends each event to Music's process ID instead, looked up when the script's turn comes. An event to a process that has gone fails, and nothing starts a process from its ID. So `launch()` is the only way Static starts Music.
- Tried first, with Chess standing in for Music: sending the events of a `tell application id` script to a process ID. AppleScript started Chess before the send function saw the event. A create function didn't help either, because it gets no target at all. Passing the process ID into the script as a value doesn't work: AppleScript reads it as raw data, not an application.
- An event to a process that has gone fails with procNotFound. AppleScript takes that to mean the app isn't running and tries to start it, so the send function never passes it on. It answers `notRunning` when the process has gone, and connectionInvalid when it's alive but refusing events, as Music does while it starts. `launch()` still retries connectionInvalid.
- Scripts run through OSAKit, because NSAppleScript has no way to set a send function. One AppleScript instance runs every script, behind a lock: a new instance for each script added about 17 ms, against 8 ms for a whole `player state` read. A script whose text says "application" stops Static with a precondition failure, because it could start that application.
- Tests, with Chess closed: a script for a process that has exited throws `notRunning` and Chess stays closed, a script's events reach the process it's given, and a script that sends nothing runs. Music's own scripts ran once from a temporary test: the reads against Music (playlists, durations, tracks, artwork, now playing and volume), and the ones that change Music against an exited process, so they compiled but Music never got them.
- Left: a Music that's quitting but hasn't exited can still answer a script, as before. If Music's process ID went to another app between Music exiting and the event, the event would go to that app, and macOS would ask whether Static may control it. Pressing ⌥ again in the moment Music starts can still bring up the library dialog.
- A tune waiting for ⌥ to come up launched Music after you'd moved on to Radio Off: 3 of the 8 launches in the step 7 hand test. Now the next tune cancels the one before it, Radio Off included. That ends the wait, and `launch()` checks for a cancel once more just before it opens Music, so a replaced tune never opens it. A new station's tune does its own launch, so two tunes no longer wait side by side. The log says "Didn't launch Music: cancelled while waiting for ⌥ to come up", and "A newer pick replaced the tune to …".
- The rest of a replaced tune already stopped once it saw a newer one, and the cancel only stops it sooner. A tune that has already opened Music still leaves it open, hidden and silent, when you pick Radio Off.
- A test cancels a wait while ⌥ is held, and checks that it ends at once with a cancel instead of running on for 30 s.

Rejected:

- Dropping queued scripts when NSWorkspace says Music has terminated: that comes after Music has exited, so a script already running could still start it.
- `SBApplication(processIdentifier:)` from ScriptingBridge, or building each Apple Event by hand: both address a process, but every script would need rewriting.
