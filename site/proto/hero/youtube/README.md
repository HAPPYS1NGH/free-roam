# Audible stations (YouTube) on 3 A.M. Drive

On the 3 A.M. Drive hero the stations make sound, the way the Mac app does with Apple Music. Hold **⌥Q** and let go on a station, tap **⌥Q**, or pick one from the station list, and that station's song plays mid-song from the same broadcast clock as the wheel and the dial. There's no button and no video to look at: a YouTube player nobody sees does the playing. Nothing is requested from YouTube before the first ⌥Q press or the first press on a station.

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

## How it behaves

- On load: no script, iframe, image or cookie from YouTube. The API (`www.youtube.com/iframe_api`, about 1.2 MB with the player) starts loading on the ⌥Q keydown, or on a press on the station list or the wheel. The player uses `youtube-nocookie.com`.
- Tuning in happens on the release: letting go of Q, or the click on a station. Both count as user activation, so Chrome lets the unmuted song start. If the browser holds the sound back anyway (Safari can), the caption says "Click for sound" and the next click or key press starts it.
- The player is a 200×200 iframe fixed to the corner at opacity 0, click-through, `aria-hidden` and `tabindex="-1"`. It stays rendered, not `display: none`, so the player runs as it would on screen.
- The clock: the station plays the song `onAir()` says is on, at its position. Once a second the player is checked against the clock, and if it's more than 1 s off it seeks back (aiming 0.5 s ahead to cover the rebuffer, at most once every 4 s). If the song on air has no video, the next song with one fills in from the top and the station then rejoins the clock. A song that errors at runtime is skipped the same way for the rest of the visit.
- Tapping ⌥Q moves to the next station's song. The wheel can stay open while music plays, and dwelling on a station retunes, as in the app. Radio Off pauses. After Dark has no video, so it stays silent and the caption says "After Dark has no audio here".
- The sound toggle in the caption mutes the music along with the wheel's sounds.
- Ads: YouTube can play a pre-roll, and it plays invisibly like the song. The embed API has no ad event, so an ad is inferred when the player reports a different video ID, a duration more than 5 s off the song's, or "playing" while the song's time hasn't moved for 2.5 s. During an ad the caption reads "YouTube ad, then <song>" and nothing seeks. When the song's time moves again, the clock check seeks it to the right second. None of the test runs got an ad, so this path hasn't been seen working.

## Verify

With the dev server running on localhost:

```sh
PLAYWRIGHT=/path/to/playwright/index.mjs node proto/hero/youtube/verify-live.mjs http://localhost:5180
```

It checks for zero YouTube requests on load, then: holding ⌥Q and letting go on a station plays that station's song at the clock's second (within 1.5 s) with sound; tapping ⌥Q moves to the next station's song; the sound toggle mutes and unmutes; the player can't be seen, clicked or focused; After Dark stays silent; the station list tunes in; Radio Off pauses; a forced error skips to the next song; no page errors. It launches Chromium with the GPU. Without it, the WebGL drive scene renders in software and starves the video, which then drifts behind the clock.
