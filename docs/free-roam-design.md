# Free Roam

After Hours is the selected website direction. Keep the coastal car photograph and the native wheel's layout, cyan selection ring, and condensed captions. The product is a radio for your favorite music: change the mood or choose quiet without leaving your work.

The brand badge follows the supplied circular reference, with only FREE ROAM in stacked ivory lettering inside a cyan ring. It has no FM suffix, road illustration, or italic racing lettering. The transparent PNG is used on the website; native app packaging remains a separate release task.

## Public experience

- `/free-roam/`: After Hours with a small interactive station preview.
- `/`: clean full-screen interaction demo using the existing `useWheel` controller and `RadioWheel` renderer.
- `/studio.html`: local design studio only; excluded from the production build.

The demo preserves tap-to-skip, hold-to-open, relative mouse selection, scroll selection, dwell tuning, and release-to-choose. Visible buttons, arrow navigation, Enter, and Escape cover keyboard and touch use. Closing the full-screen wheel returns focus to its opener. No music list or persistent track player is shown.

Public stations use a curated set of popular songs and real album artwork. Catalog metadata, artwork source URLs, and Apple Music links are recorded in `prototype/src/free-roam/catalog.json`. The build copies only explicitly approved assets and checks the final output for private files and studio code. Personal Music exports remain on disk for local studio use; the public experience never requests them. The web uses the same four WAV files as Static build 96, with matching volume, hover filtering, and retune fades. Effects start on the first user interaction and can be muted. The public demo does not stream songs. Both web views now share the original interaction controller.

## References

- [Spotify on Mobbin](https://mobbin.com/screens/efef0633-0ba7-47c1-bdfe-f2f9e5359982): immersive artwork with quiet controls.
- [untitled on Mobbin](https://mobbin.com/screens/a58d7560-8cad-490f-a3ec-acd736c41735): sparse music presentation and restrained playback controls.
- [Desktop.fm on recent.design](https://recent.design/i/j7gwiq7-desktop-fm): a music object as the main attraction.
- [Nothing to Watch on recent.design](https://recent.design/i/6wmr7uw-nothing-to-watch): immersive browsing against a dark background.
- [Friends of the New on recent.design](https://recent.design/i/a7rn7fa-friends-of-the-new): warm paper and editorial typography.

## Verification scope

The original browser prototype and its interaction controller were inspected directly, alongside the Swift model's tap, hold, dwell, and Radio Off paths. The installed native overlay was not visually reverified in this pass. No native playback or installed-app behavior was changed.

The website and full-screen demo were checked against the production build. Five tests pass: private-asset exclusion, source audio checksums, product-token parity, catalog assets, and cold-cache first-gesture audio with mute. TypeScript, Vite, prerendering, and generated-output checks pass. See [the release review](free-roam-release-review.md) for the remaining launch checks.
