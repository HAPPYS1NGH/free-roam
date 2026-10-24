# Free Roam exploration

The brief is the memory of playing music while driving around GTA. The page evokes the listening ritual through a radio wheel, optional tuning static, empty coastal roads, and copy about staying in the car to finish a song.

Three directions are available at `/free-roam/`. None is the production choice yet.

| Direction | Composition | Nostalgia cue |
| --- | --- | --- |
| After Hours | Full-image hero, condensed headline, floating wheel | Driving without a mission at dusk |
| FM / 98.6 | Orange poster around the original wheel | Radio-station print graphics |
| Passenger Seat | Cream paper, serif headline, printed photograph | Keeping a photo from a memorable drive |

## References

- [Spotify on Mobbin](https://mobbin.com/screens/efef0633-0ba7-47c1-bdfe-f2f9e5359982): immersive artwork with quiet controls.
- [untitled on Mobbin](https://mobbin.com/screens/a58d7560-8cad-490f-a3ec-acd736c41735): sparse music presentation and restrained playback controls.
- [Desktop.fm on recent.design](https://recent.design/i/j7gwiq7-desktop-fm): a music object as the main attraction.
- [Nothing to Watch on recent.design](https://recent.design/i/6wmr7uw-nothing-to-watch): immersive browsing against a dark background.
- [Friends of the New on recent.design](https://recent.design/i/a7rn7fa-friends-of-the-new): warm paper and editorial typography.

The coastal photograph and transparent logo concept were generated for this exploration. The wheel reuses `RadioWheel.tsx`, its stylesheet, geometry helpers, and the settings in `tokens.json`. This replaces the rejected fictional station badges and receiver. The local preview uses the existing library loader; exported library content stays ignored. No additional dependencies were added.

The logo draft combines a road inside a radio dial with a stacked Free Roam wordmark. It is a transparent PNG, not a vector master or a replacement native app icon.

The native app bundle and Swift renderer were inspected, but the native overlay timed out in the UI inspection tool. Visual verification was performed against the original browser renderer, not a running native overlay.

## Verification

- TypeScript and both Vite production entries build successfully.
- Inspected all three directions at desktop and 390px viewport widths.
- Checked station selection, keyboard station selection, variant shortcuts, sound controls, and FAQ disclosure in the browser.
- The page uses local demo state. Native Music control, app installation, and playback are outside this exploration.

Choose a direction before integrating the landing page or renaming the Mac app.
