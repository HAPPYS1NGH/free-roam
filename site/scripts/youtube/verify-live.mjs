// End-to-end check of the audible stations on 3 A.M. Drive, in a real browser.
// Start the dev server first (npm run dev, or npx vite --port 5180), then from site/:
//   PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/youtube/verify-live.mjs http://localhost:5180 [path]
// path defaults to the landing page (/).
// Use localhost, not 127.0.0.1: label videos refuse to embed on an IP address.
// Checks: no YouTube request on load; holding ⌥Q and letting go on a station
// plays its song at the clock's second, with sound; tapping ⌥Q moves to the
// next station's song; the sound toggle mutes it; the player can't be seen,
// clicked or reached; a station with no videos says so; Radio Off pauses; a
// song that errors is skipped to the next; no page errors.
import { readFileSync } from "node:fs"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright")
const [base = "http://localhost:5180", path = "/"] = process.argv.slice(2)
const url = `${base}${path}`
const catalog = JSON.parse(readFileSync(new URL("../../src/free-roam/catalog.json", import.meta.url), "utf8"))
const videos = JSON.parse(readFileSync(new URL("../../src/free-roam/live/videos.json", import.meta.url), "utf8"))
const EPOCH = Date.UTC(2026, 0, 1) / 1000
const TOLERANCE_S = 1.5
// The page's own Google Fonts (fonts.googleapis.com / fonts.gstatic.com) aren't YouTube.
const YOUTUBE_HOST = /(^|\.)(youtube|youtube-nocookie|ytimg|googlevideo|ggpht|doubleclick)\.[a-z.]+$|^(www\.)?google\.com$/
const isYouTube = address => YOUTUBE_HOST.test(new URL(address).hostname)
const stationIdByName = name => catalog.find(station => station.name === name)?.id

// src/broadcast.ts's rule: what's on air on a station at `at`, and its video.
function onAir(stationId, at = Date.now() / 1000) {
  const tracks = catalog.find(station => station.id === stationId).tracks
  const total = tracks.reduce((sum, track) => sum + track.duration, 0)
  let offset = (((at - EPOCH) % total) + total) % total
  for (const [index, track] of tracks.entries()) {
    if (offset < track.duration) return { index, title: track.title, position: offset, videoId: videos[stationId][index]?.videoId ?? null }
    offset -= track.duration
  }
}

const results = []
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`) }

// The drive scene is WebGL; without the GPU, headless Chromium renders it in
// software and starves the video of CPU, so playback drifts off the clock.
const browser = await chromium.launch({ headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] })
const errors = []

async function open() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on("pageerror", error => errors.push(String(error)))
  page.on("console", message => { if (message.type() === "error" && message.location().url.startsWith(base)) errors.push(message.text()) })
  const requests = []
  page.on("request", request => requests.push({ url: request.url(), at: Date.now() }))
  return { page, requests }
}

const playerFrame = page => page.frames().find(frame => /youtube(-nocookie)?\.com\/embed/.test(frame.url()))
async function playback(page) {
  const frame = playerFrame(page)
  if (!frame) return null
  return frame.evaluate(() => {
    const video = document.querySelector("video")
    const player = document.getElementById("movie_player")
    const data = player?.getVideoData?.()
    // Stamped inside the frame: under load a round trip can take seconds.
    return video ? {
      videoId: data?.video_id, time: video.currentTime, paused: video.paused,
      muted: video.muted || player?.isMuted?.() === true || video.volume === 0, at: Date.now() / 1000,
    } : null
  }).catch(() => null)
}
// Waits until `videoId` plays and has settled on the clock, then returns its
// state and where it should be. No target: any position.
async function waitForPlaying(page, videoId, target) {
  let state = null
  for (let i = 0; i < 60; i++) {
    state = await playback(page)
    if (state && state.videoId === videoId && !state.paused && state.time > 0 && (!target || Math.abs(state.time - target(state.at)) < TOLERANCE_S)) break
    await page.waitForTimeout(500)
  }
  return { state, want: state && target ? target(state.at) : null }
}
async function waitFor(page, test) {
  let state = null
  for (let i = 0; i < 20; i++) {
    state = await playback(page)
    if (test(state)) break
    await page.waitForTimeout(250)
  }
  return state
}
const onAirStation = async page => stationIdByName(await page.locator(".p-tally strong").textContent({ timeout: 3000 }).catch(() => null))
async function holdWheel(page) {
  await page.mouse.move(720, 450)
  await page.keyboard.down("Alt")
  await page.keyboard.down("KeyQ")
  await page.locator(".wheel-layer").waitFor({ timeout: 5000 })
}
async function releaseWheel(page) {
  await page.keyboard.up("KeyQ")
  await page.keyboard.up("Alt")
  // The station switches 250 ms after the wheel commits, as in the app.
  await page.waitForTimeout(800)
}
async function tapAltQ(page) {
  await page.keyboard.down("Alt")
  await page.keyboard.press("KeyQ")
  await page.keyboard.up("Alt")
  await page.waitForTimeout(800)
}
async function expectStation(page, label) {
  const id = await onAirStation(page)
  const song = id && onAir(id)
  const { state, want } = song?.videoId ? await waitForPlaying(page, song.videoId, at => onAir(id, at).position) : { state: null, want: null }
  const caption = await page.locator(".ta-caption").innerText()
  check(`${label}: plays the station's clock song`, state?.videoId === song?.videoId && !state?.paused, `${id} "${song?.title}" ${song?.videoId}, got ${state?.videoId} paused=${state?.paused}; caption "${caption.replaceAll("\n", " ")}"`)
  check(`${label}: at the clock's second (±${TOLERANCE_S} s)`, state && Math.abs(state.time - want) < TOLERANCE_S, `want ${want?.toFixed(1)}s, got ${state?.time.toFixed(1)}s`)
  check(`${label}: with sound`, state && !state.muted, `muted=${state?.muted}`)
  return { id, song, state }
}

try {
  const { page, requests } = await open()
  await page.goto(url)
  await page.waitForTimeout(5000)
  const early = requests.filter(request => isYouTube(request.url))
  check("no YouTube request on load", early.length === 0, early.map(request => request.url).slice(0, 3).join(", "))
  check("no player on load", !playerFrame(page))

  // Hold ⌥Q, step one station round the ring, let go there.
  const pressedAt = Date.now()
  const before = await onAirStation(page)
  await holdWheel(page)
  check("YouTube loads only once ⌥Q goes down", requests.some(request => isYouTube(request.url) && request.at >= pressedAt))
  await page.keyboard.press("ArrowRight")
  await page.waitForTimeout(300)
  await releaseWheel(page)
  const picked = await expectStation(page, "hold ⌥Q and let go on a station")
  check("…which is the station it was let go on, not the one before", picked.id && picked.id !== before, `${before} → ${picked.id}`)

  const caption = await page.locator(".ta-caption-track").innerText()
  check("caption names the song playing", picked.song && caption.includes(picked.song.title), caption)

  const hidden = await page.evaluate(() => {
    const iframe = document.querySelector("[data-radio-player] iframe")
    if (!iframe) return { found: false }
    const box = iframe.getBoundingClientRect()
    const wrapper = iframe.closest("[data-radio-player]")
    const style = getComputedStyle(wrapper)
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return {
      found: true, opacity: style.opacity, pointerEvents: style.pointerEvents, ariaHidden: wrapper.getAttribute("aria-hidden"),
      tabIndex: iframe.tabIndex, onTop: top === iframe, size: `${Math.round(box.width)}×${Math.round(box.height)}`,
    }
  })
  check("player isn't visible, clickable or focusable", hidden.found && hidden.opacity === "0" && hidden.pointerEvents === "none" && hidden.ariaHidden === "true" && hidden.tabIndex === -1 && !hidden.onTop,
    JSON.stringify(hidden))
  check("no visible Listen live button or player card", (await page.getByRole("button", { name: /listen live/i }).count()) === 0 && (await page.locator(".ll").count()) === 0)

  // Tapping ⌥Q skips to the next station, without opening the wheel.
  await tapAltQ(page)
  const tapped = await expectStation(page, "tap ⌥Q")
  check("…moved to a different station", tapped.id && tapped.id !== picked.id, `${picked.id} → ${tapped.id}`)

  await page.locator(".ta-caption .p-sound").click()
  const muted = await waitFor(page, state => state?.muted)
  check("sound toggle mutes the music", muted?.muted === true, `muted=${muted?.muted}`)
  await page.locator(".ta-caption .p-sound").click()
  const unmuted = await waitFor(page, state => state && !state.muted)
  check("…and unmutes it", unmuted && !unmuted.muted, `muted=${unmuted?.muted}`)

  // After Dark's one song (Midnight City) has no embeddable video.
  await page.locator(".p-dial-row", { hasText: "After Dark" }).click()
  await page.evaluate(() => scrollTo(0, 0))
  await page.locator(".ta-caption", { hasText: "has no audio here" }).waitFor({ timeout: 5000 }).catch(() => {})
  const silent = await waitFor(page, state => !state || state.paused)
  check("a station with no videos stays silent and says so", (await page.locator(".ta-caption").innerText()).includes("After Dark has no audio here") && (!silent || silent.paused),
    `paused=${silent?.paused}`)

  await page.locator(".p-dial-row", { hasText: "Punjabi Hits" }).click()
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(800)
  await expectStation(page, "pick from the station list")

  await holdWheel(page)
  await page.evaluate(() => document.querySelector('.wheel-layer button[aria-label="Radio off"]').click())
  await releaseWheel(page)
  const off = await waitFor(page, state => state?.paused)
  check("Radio Off pauses", off?.paused === true && /Radio off/.test(await page.locator(".ta-caption").innerText()), `paused=${off?.paused}`)
  await page.close()
} catch (error) {
  check("main run finished", false, error.stack)
}

// Runtime failure: serve the page a dead video ID for the song on air.
try {
  const { page } = await open()
  const live = onAir("gods-favorite", Date.now() / 1000 + 10)
  const nextSong = videos["gods-favorite"][(live.index + 1) % videos["gods-favorite"].length]
  await page.route(/\/src\/free-roam\/live\/videos\.json/, async route => {
    const response = await route.fetch()
    route.fulfill({ response, body: (await response.text()).replaceAll(live.videoId, "deadvideo00") })
  })
  await page.goto(url)
  await page.waitForTimeout(3000)
  // Let go on the station already on air.
  await holdWheel(page)
  await releaseWheel(page)
  const { state } = await waitForPlaying(page, nextSong.videoId)
  check("a song that errors is skipped to the next", state?.videoId === nextSong.videoId && !state.paused && state.time < 15, `want ${nextSong.videoId} from the top, got ${state?.videoId} at ${state?.time.toFixed(1)}s`)
  await page.close()
} catch (error) {
  check("skip run finished", false, error.stack)
}

// The deliberate skip above logs a warning, not an error, so this stays strict.
check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "))
await browser.close()
const failed = results.filter(result => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
