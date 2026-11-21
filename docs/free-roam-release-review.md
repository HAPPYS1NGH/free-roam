# Free Roam release review

**Not yet published.** The web release candidate passes local checks. The production domain and hosting destination are still needed to generate final canonical and social URLs and deploy it. No known blocking web defect remains after this pass.

Scope at the time: the After Hours landing page at `/free-roam/` and full-screen demo at `/`. On 2026-11-21 they were merged into one page at `/`; see the decision log. Both import the same approved playlist catalog, wheel renderer, interaction controller, and sound hook. Native signing, notarization and installation are separate work. The website accurately offers source-build instructions.

## A. Accessibility

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | Arrow navigation left focus on the old station | Inline arrows focus the next target immediately; open-wheel highlight updates move focus in `prototype/src/free-roam/RadioDemo.tsx:32` and `WheelFace.tsx:50` | Enter chooses the station reached with the keyboard | Fixed and browser-checked |

Controls have accessible names, visible focus, and native button/link semantics. The wheel is an inline section, not a modal. Station changes are announced. Keyboard selection and Radio Off were exercised in the production browser preview; VoiceOver remains a device check.

## B. Performance

The landing page is prerendered, font and hero assets are preloaded, and wheel geometry reserves space for artwork. The shared JavaScript chunk is 374.52 kB, 119.72 kB gzip. The header badge was the 1 MB source PNG. It's now a 240 px copy of 48 KB with its generation noise cleaned up, which looks the same at the 60 px it's shown at. The site no longer publishes the source PNG.

## C. Mobile

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | No landing safe-area padding | Uses all four safe-area insets in `prototype/src/free-roam/styles.css:52` | Keeps content away from phone cutouts | Fixed; hardware check remains |
| Should fix | Radio Off target was below 44px | Minimum 44px height in `prototype/src/free-roam/styles.css:157` | Makes the quiet control easier to tap | Fixed |

At 390px and 320px viewport settings, document width equals scroll width. Artwork loads and playlist selection works. This is browser resizing, not physical-phone validation.

## D. Forms

Not applicable. The page has no forms, payments, signup, or account state.

## E. Stability and states

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Blocker | Prerender and browser could choose different current songs | Stable initial clock, then live updates after mounting in `prototype/src/broadcast.ts:23` | Prevents hydration mismatch for multi-track playlists | Fixed and regression-tested |
| Should fix | Sound labels shifted adjacent controls while loading | Minimum control width in `prototype/src/free-roam/styles.css:170` | Keeps Radio Off and the sound control steady | Fixed |

Sound loading, mute, failure, and retry states are retained. Audio errors do not prevent station selection. Landing and full-screen controls share the same four product WAVs and native volume settings.

## F. Motion

No new finding. The approved native timing is preserved. Reduced motion removes wheel scaling and press movement while retaining feedback. Station highlights switch without animated travel.

## G. Theming

One intentional dark theme, matching browser theme metadata. No theme switch or persisted-theme flash. Desktop and narrow layouts were inspected.

## H. Content and leftovers

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | FAQ described only public-catalog songs | Names the four creator-shared playlists in `prototype/src/free-roam/Shared.tsx:45` | Copy matches the visible demo | Fixed |

God's Favorite, gym, PLow, and Morning Playlist use only their approved snapshots and artwork. The rest of the Music export, persistent IDs, wallpaper, local sound overrides, and studio controls remain excluded. Pop Rotation, Dancefloor, Golden Hour, and Throwbacks are absent. No analytics or third-party tracking was added.

## I. Marketing

| Severity | Before | After | Why | Status |
| --- | --- | --- | --- | --- |
| Should fix | No canonical URLs or crawl metadata | Validated `SITE_URL` generates canonicals, absolute social URLs, robots, and sitemap in `prototype/scripts/site-metadata.mjs:4` | Avoids broken or ambiguous launch links | Code fixed; final domain pending |
| Should fix | The social card was the raw coast photo, and the favicon the 1 MB badge | A 1200 × 630 card with the headline and wheel (`prototype/public/free-roam/og-image.jpg`), `favicon.ico` with 16 and 32 px badges, and a 180 px `apple-touch-icon.png` | Link previews say what the app is; tabs show a readable badge | Fixed; check the previews on the deployed domain |

`build:release` requires the chosen HTTPS origin and runs tests before building. Release checks also verify every catalog station appears in prerendered landing markup. GitHub confirmed the repository was public before it was renamed `HAPPYS1NGH/free-roam`. The CTA remains Build for Mac, not an unavailable download.

## Needs a device

- On a physical phone, tap stations and check controls around the notch and home indicator, including landscape.
- With VoiceOver, verify station announcements and keyboard focus.
- On the deployed domain, open both routes in a private window over cellular and check social previews.
- Superseded on 2026-11-21: the site and the Mac app now share one sound set in `assets/sounds/`, and a test compares the site's files byte for byte with the built app's.

## Needs a human

- Supply the production domain and hosting destination. Then build with that `SITE_URL`, deploy `prototype/dist/`, and check the deployed links.
- A signed native download requires a separate app release. The source-build website can launch independently.

## Verification

- `npm --prefix prototype test`: `tests 9`, `pass 9`, `fail 0`.
- `npm --prefix prototype run build`: TypeScript, Vite, prerender, and release check pass. `Release check passed: 35 files, no private exports or studio controls.`
- `SITE_URL=https://release-check.example.test npm --prefix prototype run build:release`: tested with an explicitly non-production fixture origin. `Release check passed: 37 files, no private exports or studio controls.` The final local preview was rebuilt without that fixture origin.
- Production browser: approved playlist labels and covers, PLow and Morning Playlist selection, mute/unmute, keyboard navigation, Radio Off, and landing-to-demo navigation. No console warnings or errors observed.
- At the time, the four built WAV files were the synthesised sounds; since 2026-11-21 they're the files in `assets/sounds/`. When `public/wallpaper/` exists on the building Mac, the release check also fails on any built file that's a byte-identical copy of a file in it, and it prints which folders it checked or skipped.
- No lint or formatter command exists. Native code was untouched; native tests were not rerun.
- The available pnpm runner attempted dependency installation instead of running scripts and failed under network restrictions. Its local changes were restored; verification used the repository's existing npm lockfile and installed dependencies.
