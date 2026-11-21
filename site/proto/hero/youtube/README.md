# Listen live (YouTube) on 3 A.M. Drive

An opt-in way to hear the stations on the landing page. Press **Listen live** in the hero caption. The station on air then plays through YouTube's embed player, mid-song, from the same broadcast clock as the wheel and the dial. Nothing is requested from YouTube until that click.

Try it: in `site/`, run `npx vite --port 5180` and open <http://localhost:5180/proto/hero/?v=5>. Use `localhost`, not `127.0.0.1` (see below).

## Embed check

`embed-check.mjs` searches YouTube for every catalog track (yt-dlp, no API key) and keeps official uploads only: the artist's own or "- Topic" channel, a VEVO channel, or a known label. It skips edits, covers, slowed/reverb, remakes and live cuts. Then it loads each candidate in the real IFrame player and counts it only if the video actually plays. oEmbed answering 200 is not proof.

Checked 2026-11-21. "Found" means an official upload was found. "Embeddable" means it played in the embed on a page at a public https origin. "On 127.0.0.1" means it also played on a page served from an IP address.

| Station | Tracks | Found | Embeddable | On 127.0.0.1 |
| --- | ---: | ---: | ---: | ---: |
| God's Favorite | 12 | 12 | 12 | 0 |
| High | 1 | 1 | 1 | 1 |
| Vibe | 66 | 58 | 58 | 20 |
| Culture Truth | 2 | 2 | 2 | 0 |
| Serbian | 1 | 1 | 1 | 0 |
| Right Eyebrow | 5 | 5 | 5 | 1 |
| Night Drive | 1 | 1 | 1 | 0 |
| Indie Radio | 1 | 1 | 1 | 0 |
| Rap Rotation | 1 | 1 | 1 | 0 |
| Punjabi Hits | 1 | 1 | 1 | 1 |
| After Dark | 1 | 0 | 0 | 0 |
| Road Trip | 1 | 1 | 1 | 0 |
| Slow Burn | 1 | 1 | 1 | 0 |
| **Total** | **94** | **85** | **85** | **23** |

Every official upload the search found plays embedded. The 9 misses are search misses, not refusals: Do Vaari Jatt (Jordan Sandhu), Insane (AP Dhillon), Majha Block (Prem Dhillon), Jatti (Raaj Sohal), Daru Pee Ke (Kaka Bhainiwala), East Side Flow (Sidhu Moose Wala), Jawani (Arjan Dhillon), Shinin' (Tegi Pannu) and Midnight City (M83). Four videos run long against the Apple Music duration (Dealer +71 s, Big Things +46 s, Paper Before Money +21 s, The Last Ride +13 s). Those are music-video cuts, so playback lands a little off the song's real position.

The embedding page's address changes the result. Label-restricted uploads (Jordan Sandhu, Shubh, Navaan Sandhu, Sidhu Moose Wala, The Weeknd, Coldplay, Arctic Monkeys, Tame Impala and others) return error 150 when the embedding page is on an IP address (`127.0.0.1`, `[::1]`), but play on `localhost` and on a real domain. A test from `127.0.0.1` makes most of the catalog look blocked. The check therefore serves its probe page as `https://embed-check.example.org`, through Playwright request interception, so nothing is hosted there. It still runs every chosen video from `127.0.0.1` for the last column. Before shipping, re-run the check with `ORIGIN` set to the production domain.

Files:

- `embed-check.mjs`: the check. Writes `embed-check.json` (per track: videoId, embeddable, error code, YouTube duration, every candidate tried) and `stations.json` (what the prototype reads).
- `probe.html`: the page the check loads in the player.
- `search-cache.json` (git-ignored): search results. YouTube search varies between runs, so results accumulate. Delete the file to start over.

Re-run from `site/`:

```sh
YTDLP=/path/to/yt-dlp PLAYWRIGHT=/path/to/playwright/index.mjs node proto/hero/youtube/embed-check.mjs
```

## How Listen live behaves

- Before the click: no script, iframe, image or cookie from YouTube. The API (`www.youtube.com/iframe_api`, about 1.2 MB with the player) loads on the click. The player uses `youtube-nocookie.com`.
- The card sits at the top of the hero's copy column, in the layout flow, so it never covers the headline or the car and never gets covered. It's 480×270 on desktop. On phones it narrows with the screen, but the player never drops below 200 px tall. Labels sit in strips above and below the video, never on it, and YouTube's own controls and branding are left alone.
- The ⌥Q wheel: its overlay (and the full-screen pick layer under it) covers the whole viewport, so no corner is clear of it. While the wheel is open, the card pauses the video and then hides in place. When the wheel closes, the card shows again and rejoins the broadcast at the clock's current second, the way a radio you stepped away from kept playing. This was chosen over stacking the player above the overlay: on most screens the wheel is big enough to collide with any corner, and hiding avoids both overlay and hidden playback.
- The clock: the station plays the song `onAir()` says is on, at its position. Load time is corrected once playback starts, with one seek to wherever the clock has got to. If the song on air has no video, the next song with one fills in from the top and the station then rejoins the clock. A song that errors at runtime is skipped the same way for the rest of the visit.
- Retuning from the wheel or the station list switches video at the new station's clock position. Radio Off pauses. A station with no videos (After Dark) says "No live audio for this station" and offers one that has them.
- Safari can refuse to start sound outside the click. If the video hasn't started 4 s after loading, the card says "Press play on the video to start."
- Close (×, or "Stop listening" in the caption) destroys the player.

## Verify

With the dev server running on localhost:

```sh
PLAYWRIGHT=/path/to/playwright/index.mjs node proto/hero/youtube/verify-live.mjs http://localhost:5180 [screenshot.png]
```

It checks for zero YouTube requests before the click, then playback at the clock's second (within 2 s), switching stations, the station with no videos, the wheel hiding a paused player, Radio Off, skipping on a forced error, close, and page errors. It launches Chromium with the GPU. Without it, the WebGL drive scene renders in software and starves the video, which then drifts behind the clock.
