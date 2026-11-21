// End-to-end check of Listen live on 3 A.M. Drive, in a real browser.
// Start the dev server first (npm run dev, or npx vite --port 5180), then from site/:
//   PLAYWRIGHT=/path/to/playwright/index.mjs node proto/hero/youtube/verify-live.mjs http://localhost:5180 [screenshot.png]
// Use localhost, not 127.0.0.1: label videos refuse to embed on an IP address.
// Checks: no YouTube request before the click; the station plays at the
// clock's second; retuning switches video; a station with no videos says so;
// the wheel never covers the player; Radio Off pauses; a song that errors is
// skipped to the next; close removes the player; no page errors.
import { readFileSync } from "node:fs"

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright")
const [base = "http://localhost:5180", screenshot] = process.argv.slice(2)
const url = `${base}/proto/hero/?v=5`
const catalog = JSON.parse(readFileSync(new URL("../../../src/free-roam/catalog.json", import.meta.url), "utf8"))
const videos = JSON.parse(readFileSync(new URL("stations.json", import.meta.url), "utf8"))
const EPOCH = Date.UTC(2026, 0, 1) / 1000
// The page's own Google Fonts (fonts.googleapis.com / fonts.gstatic.com) aren't YouTube.
const YOUTUBE_HOST = /(^|\.)(youtube|youtube-nocookie|ytimg|googlevideo|ggpht|doubleclick)\.[a-z.]+$|^(www\.)?google\.com$/
const isYouTube = address => YOUTUBE_HOST.test(new URL(address).hostname)

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
    const data = document.getElementById("movie_player")?.getVideoData?.()
    // Stamped inside the frame: under load a round trip can take seconds.
    return video ? { videoId: data?.video_id, time: video.currentTime, paused: video.paused, muted: video.muted, at: Date.now() / 1000 } : null
  }).catch(() => null)
}
// Waits until `videoId` plays and has settled (the player seeks once after it
// starts), then returns its state and where it should be. No target: any position.
async function waitForPlaying(page, videoId, target) {
  let state = null
  for (let i = 0; i < 60; i++) {
    state = await playback(page)
    if (state && state.videoId === videoId && !state.paused && state.time > 0 && (!target || Math.abs(state.time - target(state.at)) < 2)) break
    await page.waitForTimeout(500)
  }
  return { state, want: state && target ? target(state.at) : null }
}
async function tuneFromDial(page, name) {
  await page.locator(".p-dial-row", { hasText: name }).click()
  await page.evaluate(() => scrollTo(0, 0))
}
async function holdWheel(page) {
  await page.mouse.move(720, 450)
  await page.keyboard.down("Alt")
  await page.keyboard.down("KeyQ")
  await page.locator(".wheel-layer").waitFor({ timeout: 5000 })
}
async function releaseWheel(page) {
  await page.keyboard.up("KeyQ")
  await page.keyboard.up("Alt")
  await page.waitForTimeout(1500)
}

try {
  const { page, requests } = await open()
  await page.goto(url)
  await page.waitForTimeout(5000)
  const early = requests.filter(request => isYouTube(request.url))
  check("no YouTube request before Listen live", early.length === 0, early.map(request => request.url).slice(0, 3).join(", "))

  // The page opens on God's Favorite.
  const clickedAt = Date.now()
  await page.getByRole("button", { name: "Listen live" }).click()
  const first = onAir("gods-favorite")
  const { state: firstState, want: firstWant } = await waitForPlaying(page, first.videoId, at => onAir("gods-favorite", at).position)
  check("YouTube loads only after the click", requests.some(request => isYouTube(request.url) && request.at >= clickedAt))
  const box = await page.locator(".ll-screen").boundingBox()
  check("player is 480×270 on desktop", box && Math.round(box.width) === 480 && Math.round(box.height) === 270, box ? `${Math.round(box.width)}×${Math.round(box.height)}` : "no box")
  check("the station on air plays its clock song", firstState?.videoId === first.videoId, `${first.title} ${first.videoId}, got ${firstState?.videoId}`)
  check("…at the clock's second", firstState && Math.abs(firstState.time - firstWant) < 2, `want ${firstWant?.toFixed(1)}s, got ${firstState?.time.toFixed(1)}s`)
  check("…with sound", firstState && !firstState.muted)
  if (screenshot) await page.screenshot({ path: screenshot })

  await tuneFromDial(page, "Punjabi Hits")
  const punjabi = onAir("punjabi")
  const { state: punjabiState, want: punjabiWant } = await waitForPlaying(page, punjabi.videoId, at => onAir("punjabi", at).position)
  check("switching station switches video", punjabiState?.videoId === punjabi.videoId && punjabi.videoId !== first.videoId, `${punjabi.title}, got ${punjabiState?.videoId}`)
  check("…at the new station's second", punjabiState && Math.abs(punjabiState.time - punjabiWant) < 2, `want ${punjabiWant?.toFixed(1)}s, got ${punjabiState?.time.toFixed(1)}s`)
  const caption = await page.locator(".ta-caption-track").innerText()
  check("caption names the song playing", caption.includes(punjabi.title), caption)

  // After Dark's one song (Midnight City) has no embeddable video.
  await tuneFromDial(page, "After Dark")
  await page.locator(".ll-foot", { hasText: "No live audio for this station." }).waitFor({ timeout: 5000 }).catch(() => {})
  const silent = await playback(page)
  check("a station with no videos says so and plays nothing", (await page.locator(".ll-foot").innerText()).includes("No live audio for this station.") && (!silent || silent.paused))
  await page.locator(".ll-tune").click()
  const back = onAir("gods-favorite")
  const { state: backState } = await waitForPlaying(page, back.videoId, at => onAir("gods-favorite", at).position)
  check("…and offers a station that has them", backState?.videoId === back.videoId && !backState.paused)

  await holdWheel(page)
  await page.waitForTimeout(400)
  const whileOpen = await page.evaluate(() => {
    const card = document.querySelector(".ll")
    const screen = card.querySelector(".ll-screen").getBoundingClientRect()
    const visible = getComputedStyle(card).visibility !== "hidden"
    // Anything the wheel paints over the player's area, if the player showed.
    const over = [[0.5, 0.5], [0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]
      .map(([x, y]) => document.elementFromPoint(screen.left + screen.width * x, screen.top + screen.height * y))
      .filter(element => element && !element.closest(".ll-screen")).map(element => element.className)
    return { visible, over }
  })
  const pausedUnderWheel = await playback(page)
  check("wheel open: the player is hidden, so nothing overlays it", !whileOpen.visible || whileOpen.over.length === 0, `visible=${whileOpen.visible} under=${whileOpen.over.join(",")}`)
  check("wheel open: playback paused first (no hidden playback)", pausedUnderWheel?.paused === true, `paused=${pausedUnderWheel?.paused}`)
  await releaseWheel(page)
  const station = await page.locator(".ll-station strong").textContent()
  const afterWheel = await playback(page)
  check("wheel closed: player visible and back on air", (await page.locator(".ll").evaluate(card => getComputedStyle(card).visibility)) === "visible" && afterWheel && !afterWheel.paused, `station=${station} paused=${afterWheel?.paused}`)

  await holdWheel(page)
  await page.evaluate(() => document.querySelector('.wheel-layer button[aria-label="Radio off"]').click())
  await releaseWheel(page)
  const off = await playback(page)
  const offText = await page.locator(".ll-foot").innerText()
  check("Radio Off pauses", off?.paused === true && /Radio off/.test(offText), `paused=${off?.paused} "${offText}"`)

  await page.getByRole("button", { name: "Stop live audio" }).click()
  await page.waitForTimeout(500)
  check("close removes the player", !playerFrame(page) && (await page.locator(".ll").count()) === 0)
  await page.close()
} catch (error) {
  check("main run finished", false, error.stack)
}

// Runtime failure: serve the page a dead video ID for the song on air.
try {
  const { page } = await open()
  const live = onAir("gods-favorite", Date.now() / 1000 + 8)
  const nextSong = videos["gods-favorite"][(live.index + 1) % videos["gods-favorite"].length]
  await page.route(/\/proto\/hero\/youtube\/stations\.json/, async route => {
    const response = await route.fetch()
    route.fulfill({ response, body: (await response.text()).replaceAll(live.videoId, "deadvideo00") })
  })
  await page.goto(url)
  await page.waitForTimeout(3000)
  await page.getByRole("button", { name: "Listen live" }).click()
  const { state } = await waitForPlaying(page, nextSong.videoId)
  check("a song that errors is skipped to the next", state?.videoId === nextSong.videoId && !state.paused && state.time < 15, `want ${nextSong.videoId} from the top, got ${state?.videoId} at ${state?.time.toFixed(1)}s`)
  await page.close()
} catch (error) {
  check("skip run finished", false, error.stack)
}

check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "))
await browser.close()
const failed = results.filter(result => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
