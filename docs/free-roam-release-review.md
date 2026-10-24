# Free Roam release review

**Not yet for public launch.** The local web build is verified. A production origin is still needed for canonical and absolute share-image URLs; a signed Free Roam app download is not available. The page offers source-build instructions instead.

Scope: the After Hours website and browser demo. Native Music playback, signing, notarization, installation, and renaming Static are outside this change.

## A. Accessibility

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | Wheel opened without moving focus into its controls | Selected station receives focus; arrows move it; closing restores the opener | Keyboard users can select and leave the wheel | Fixed in `prototype/src/free-roam/WheelFace.tsx:44` and `FullDemo.tsx:36` |

## B. Performance

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | Landing-page body required client JavaScript | Product copy and links are prerendered into HTML | The page is readable before hydration and by crawlers | Fixed in `prototype/scripts/prerender.mjs:1` |

## C. Mobile

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | Narrow headers, headline, and actions wrapped awkwardly | Badge-only header and wrapping action row below 360px | Keeps actions readable at 320px | Fixed in `prototype/src/free-roam/styles.css` |

D. Forms: not applicable. No signup, checkout, or input forms.

## E. Stability and states

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | Delayed selections and preview timers could outlive the controller | Timers cancel on teardown; the latest selection replaces an older pending one | Rapid changes settle on the latest station | Fixed in `prototype/src/useWheel.ts` |
| Should fix | Optional sound loading had no visible failure path | Loading and error states; silent use remains available | Audio failure cannot block the wheel | Fixed in `prototype/src/free-roam/FullDemo.tsx:61` |

## F. Motion

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | Reduced motion disabled all CSS transitions | Wheel uses opacity without scale; button color feedback remains | Preserves feedback without movement | Fixed in `prototype/src/free-roam/WheelFace.tsx:60` |

G. Theming: one intentional dark theme. Checked visually on desktop and mobile widths.

## H. Content and leftovers

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Blocker | Landing demo loaded a personal Music export; Vite copied the full public directory | Public-catalog stations and an explicit asset allowlist | Public output cannot inherit personal library, artwork, wallpaper, or local audio exports | Fixed in `prototype/src/free-roam/catalog.json:1`, `prototype/scripts/public-assets.mjs:4` |
| Blocker | Production included DialKit, a design picker, and a track panel | Public entry points contain the website and clean demo; studio is local only | Visitors see product controls only | Fixed in `prototype/src/main.tsx:1` and `prototype/src/free-roam/main.tsx:1` |

## I. Marketing

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | Exploration metadata and placeholder favicon | Product description, generated badge, and share-image metadata | Shared pages identify Free Roam | Fixed in `prototype/free-roam/index.html:7` |
| Should fix | No production origin | Canonical and absolute social URLs still need the chosen host | Do not invent a launch domain | Open deployment configuration |

## Needs a device

- On a physical phone, check station taps and bottom controls around the safe area.
- With VoiceOver, verify station announcements and focus return.
- Test the installed Mac app's actual Music switching and Radio Off before distributing a native release. This pass exercised the browser behavior only.
- Once deployed, check social link previews and the full CTA path in a private browser window.

## Needs a human

- Choose the production host so canonical and share-image URLs can use its origin.
- Review the final public copy and badge at app-icon sizes. The logo is a transparent raster asset, not a vector master.
- Supply or prepare the signed native release before changing Build for Mac to Download.

## Verification

- `npm --prefix prototype test`: passed, 5 privacy, catalog, audio parity, and first-gesture tests.
- `npm --prefix prototype run build`: passed TypeScript, Vite, prerendering, and release-content checks.
- Release check output: `Release check passed: 32 files, no private exports or studio controls.`
- Production browser checks: station click, keyboard arrows and Enter, tap Q, hold/release Q, Escape, focus return, Radio Off, resuming from Off, and sound enabled on first interaction, mute, and retry controls.
- Responsive checks: desktop, 390px and 320px widths. No horizontal overflow in the landing page.
- No lint or formatter command is configured. No native source was changed, so native tests were not rerun.

## Product sound and catalog follow-up

The public demo now includes the four owner-approved playlists God's Favorite, gym, PLow, and Morning Playlist, plus six public-catalog selections. Pop Rotation, Dancefloor, Golden Hour, and Throwbacks were replaced. The approved snapshots include track metadata and album artwork without Music persistent IDs or the rest of the library. Public-catalog albums retain their Apple Music links; personal selections do not show an unrelated album link.

The four WAV files in `prototype/public/sounds/static/` match the installed Static build 96 byte for byte. `prototype/scripts/product-reference.json` pins their SHA-256 hashes and the bundled wheel settings. Changing the public sound pack or settings breaks the parity tests until deliberately reconciled with the product. The web retains the existing hover filter and overlapping-retune fade, which correspond to the native `WheelSounds` implementation.

The first gesture unlocks browser audio; it no longer requires enabling sound separately. The cold-load regression test verifies that a queued opening sound survives asynchronous decoding and plays at the configured gain. Native speaker output and browser speaker output were not captured for an acoustic comparison; the verified parity is files, settings, and playback code.
