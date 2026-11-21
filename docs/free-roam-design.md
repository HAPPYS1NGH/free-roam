# Free Roam

After Hours is the selected website direction. Keep the coastal car photograph and the native wheel's layout, cyan selection ring, and condensed captions. The product is a radio for your favorite music: change the mood or choose quiet without leaving your work.

The brand badge follows the supplied circular reference, with only FREE ROAM in stacked ivory lettering inside a cyan ring. It has no FM suffix, road illustration, or italic racing lettering. Everything else is made from that PNG by `scripts/make-brand-assets.sh`: the page's 240 px copy, the favicon, the home screen icon, the 1200 × 630 social card, and the Mac app's icon and menu bar glyph.

## Public experience

- `/`: the only public page, After Hours. Holding Q anywhere on it, or clicking Try the wheel, opens the app's overlay over the whole page: the same backdrop, vignette, wheel and fades as the Mac app. A station list below the hero tunes the same wheel.
- `/studio.html`: local design studio only; excluded from the production build.

The demo preserves tap-to-skip, hold-to-open, relative mouse selection, scroll selection, dwell tuning, and release-to-choose. Visible buttons, arrow navigation, Enter, and Escape cover keyboard and touch use. Closing the wheel returns focus to its opener.

Public stations include the four requested playlists, God's Favorite, gym, PLow, and Morning Playlist, plus six popular selections. Their track metadata and artwork are explicitly approved for the demo. Approved playlist snapshots and public-catalog sources are recorded in `prototype/src/free-roam/catalog.json`. The build copies only explicitly approved assets and checks the final output for private files and studio code. The full Music export remains local; the public experience only uses the four approved snapshots. The web plays the four synthesised WAVs that a release of the app ships, with the app's volumes, hover filtering and retune fades. The local sound pack is only for app builds on your own Mac, so the web never plays it. Effects start on the first user interaction and can be muted. The public demo does not stream songs.

## References

- [Spotify on Mobbin](https://mobbin.com/screens/efef0633-0ba7-47c1-bdfe-f2f9e5359982): immersive artwork with quiet controls.
- [untitled on Mobbin](https://mobbin.com/screens/a58d7560-8cad-490f-a3ec-acd736c41735): sparse music presentation and restrained playback controls.
- [Desktop.fm on recent.design](https://recent.design/i/j7gwiq7-desktop-fm): a music object as the main attraction.
- [Nothing to Watch on recent.design](https://recent.design/i/6wmr7uw-nothing-to-watch): immersive browsing against a dark background.
- [Friends of the New on recent.design](https://recent.design/i/a7rn7fa-friends-of-the-new): warm paper and editorial typography.

## Verification scope

The original browser prototype and its interaction controller were inspected directly, alongside the Swift model's tap, hold, dwell, and Radio Off paths. The installed native overlay was not visually reverified in this pass. No native playback or installed-app behavior was changed.

The website was checked against the production build. Nine tests pass: private-asset exclusion, source audio checksums, product-token parity, catalog assets, cold-cache first-gesture audio with mute, deterministic landing-page prerendering, production-origin validation, generated metadata, and the social card's size. TypeScript, Vite, prerendering, and generated-output checks pass. See [the release review](free-roam-release-review.md) for the remaining launch checks.
