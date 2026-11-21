// Finds each catalog track on YouTube and checks whether it plays in the embed
// player. oEmbed and search results can't tell you that: label uploads can
// refuse embedding (player error 150/101), so the only proof is the real
// IFrame player.
//
// Where the embed runs matters. Label-restricted videos refuse a page on an IP
// address (127.0.0.1, ::1) but play on localhost and on a real domain. So the
// verdict that counts comes from a page served as a public https origin (fed
// to the browser by request interception; nothing is hosted there), and each
// chosen video is also tried from http://127.0.0.1 for the record.
//
// Run from site/:
//   YTDLP=/path/to/yt-dlp PLAYWRIGHT=/path/to/playwright/index.mjs node proto/hero/youtube/embed-check.mjs
// YTDLP defaults to `yt-dlp` on PATH, PLAYWRIGHT to the `playwright` package,
// ORIGIN to https://embed-check.example.org.
// Writes proto/hero/youtube/embed-check.json and search-cache.json, and the
// videoId and duration per track that the landing page ships, in
// src/free-roam/live/videos.json.
import { execFile } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { promisify } from "node:util"

const here = new URL(".", import.meta.url)
const catalog = JSON.parse(readFileSync(new URL("../../../src/free-roam/catalog.json", import.meta.url), "utf8"))
const ytdlp = process.env.YTDLP ?? "yt-dlp"
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright")
const run = promisify(execFile)

const SEARCH_RESULTS = 8
const MAX_PROBES = 5
// A YouTube upload within this many seconds of the catalog duration keeps the
// broadcast clock honest; longer music-video cuts drift.
const CLOSE_SECONDS = 12
// Beyond this it's a different cut (extended, live, a medley), not the song.
const MAX_GAP_SECONDS = 120
// "Official" means the upload comes from a credited artist's own or "- Topic"
// channel, a VEVO channel, or one of these labels. Fan re-uploads often
// embed fine, but they're edits, covers or the wrong cut.
const LABELS = /\b(t series|speed records|white hill|times music|brown town|humble music|geet mp3|saga music|jass records|desi melodies|rehaan records|sony music|universal music|warner|vevo|columbia|interscope|republic|domino|parlophone|atlantic|true records|hustle music|numero uno|amar audio|crown records|folk rakaat|ishtar punjabi|croatia records|freq records)\b/
const UNOFFICIAL = /\b(slowed|reverb|lyrics?|lofi|lo fi|8d|cover|covered|remix|refix|sped up|karaoke|instrumental|bass boosted|edit|status|version|live|extended|reaction|shorts?|bhojpuri|mashup|teaser|remake)\b/

const normalize = text => text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim()
const coreTitle = title => normalize(title.replace(/\((feat|with|ft)[^)]*\)/gi, "").replace(/\(live[^)]*\)/gi, ""))
// Romanised Punjabi spellings drift (Sharaab/Sharab), so compare with doubled
// letters collapsed.
const squash = text => text.replace(/(\w)\1+/g, "$1")
// The song title has to lead one of the first two segments of the video title
// ("Artist - Song (Official Video) | …"); later segments list album and credits.
const titleMatches = (videoTitle, title) => videoTitle.split(/[|:(\[\/–—]| - /).slice(0, 2)
  .map(segment => squash(normalize(segment)))
  .some(segment => segment === squash(title) || segment.startsWith(`${squash(title)} `))
const artistsOf = artist => artist.split(/,|&| x |\(feat\.?/i).map(name => normalize(name.replace(/\)/g, ""))).filter(name => name.length > 2)

// Search results vary from run to run, so every query's results are kept in
// search-cache.json and later runs add to them. Delete the file to start over.
const cacheUrl = new URL("search-cache.json", import.meta.url)
const cache = existsSync(cacheUrl) ? JSON.parse(readFileSync(cacheUrl, "utf8")) : {}
async function searchOnce(query) {
  const fresh = await fetchResults(query)
  const known = new Map((cache[query] ?? []).map(video => [video.id, video]))
  for (const video of fresh) known.set(video.id, { id: video.id, title: video.title, channel: video.channel ?? video.uploader ?? null, duration: video.duration ?? null })
  cache[query] = [...known.values()]
  return cache[query]
}
// Under load YouTube sometimes answers a search with nothing, so retry empties.
async function fetchResults(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { stdout } = await run(ytdlp, ["--flat-playlist", "-j", `ytsearch${SEARCH_RESULTS}:${query}`], { maxBuffer: 16 << 20 })
    const results = stdout.trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
    if (results.length) return results
    await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
  }
  console.warn("no search results for", query)
  return []
}
const channelIsArtist = (name, artist) => name === artist || name.replace(/\b(official|music|records|tv)\b/g, "").replace(/\s+/g, " ").trim() === artist || name.replace(/\s/g, "") === `${artist.replace(/\s/g, "")}vevo`

async function search(track) {
  const bare = track.title.replace(/\((feat|ft)[^)]*\)/gi, "").trim()
  const lead = track.artist.split(/,|&/)[0].trim()
  const seen = new Set()
  const results = [...await searchOnce(`${bare} ${lead}`), ...await searchOnce(`${bare} ${lead} official audio`)]
    .filter(video => !seen.has(video.id) && seen.add(video.id))
  const title = coreTitle(track.title)
  const artists = artistsOf(track.artist)
  const allowed = UNOFFICIAL.source.match(/\w+/g).filter(word => normalize(track.title).split(" ").includes(word))
  return results
    .map(video => {
      const channel = video.channel ?? ""
      const name = normalize(channel)
      const videoTitle = normalize(video.title)
      const flagged = (videoTitle.match(new RegExp(UNOFFICIAL, "g")) ?? []).filter(word => !allowed.includes(word))
      return {
        videoId: video.id, title: video.title, channel: channel || null, duration: video.duration ?? null,
        titleMatch: titleMatches(video.title, title),
        official: artists.some(artist => channelIsArtist(name.replace(/ topic$/, ""), artist)) || /vevo$/.test(name) || LABELS.test(name),
        flagged: flagged.length > 0,
        durationGap: video.duration ? Math.abs(video.duration - track.duration) : 999,
      }
    })
    .filter(video => video.titleMatch && video.official && !video.flagged && video.durationGap <= MAX_GAP_SECONDS)
    .sort((a, b) => a.durationGap - b.durationGap)
}

async function pool(items, size, work) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) { const i = next++; out[i] = await work(items[i], i) }
  }))
  return out
}

const tracks = catalog.flatMap(station => station.tracks.map(track => ({ station: station.id, stationName: station.name, ...track })))
const unique = [...new Map(tracks.map(track => [`${track.title}|${track.artist}`, track])).values()]
console.log(`Searching ${unique.length} unique tracks…`)
const candidates = new Map()
// Tracks with no official candidate get searched again; flaky results converge.
for (let round = 0; round < 3; round++) {
  const todo = unique.filter(track => !candidates.get(`${track.title}|${track.artist}`)?.length)
  if (!todo.length) break
  await pool(todo, 3, async track => {
    try { candidates.set(`${track.title}|${track.artist}`, await search(track)) }
    catch (error) { console.warn("search failed", track.title, error.message) }
  })
  writeFileSync(cacheUrl, JSON.stringify(cache, null, 1) + "\n")
}

const probePage = readFileSync(new URL("probe.html", here))
const origin = process.env.ORIGIN ?? "https://embed-check.example.org"
const server = createServer((request, response) => {
  if (request.url !== "/") { response.writeHead(404).end(); return }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(probePage)
})
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
const browser = await chromium.launch({ headless: true })
async function probePageAt(url, intercept) {
  const page = await browser.newPage()
  if (intercept) await page.route(url, route => route.fulfill({ contentType: "text/html; charset=utf-8", body: probePage }))
  await page.goto(url)
  await page.waitForFunction(() => window.__ready, null, { timeout: 30000 })
  await page.click("#start")
  const probes = new Map()
  return async videoId => {
    if (!probes.has(videoId)) probes.set(videoId, await page.evaluate(id => window.probe(id), videoId))
    return probes.get(videoId)
  }
}
const probe = await probePageAt(`${origin}/`, true)
const probeOnIp = await probePageAt(`http://127.0.0.1:${server.address().port}/`, false)

const results = []
for (const track of tracks) {
  const found = candidates.get(`${track.title}|${track.artist}`) ?? []
  const tried = []
  let chosen = null
  for (const candidate of found.slice(0, MAX_PROBES)) {
    const result = await probe(candidate.videoId)
    tried.push({ videoId: candidate.videoId, title: candidate.title, channel: candidate.channel, embeddable: result.embeddable, errorCode: result.errorCode ?? null })
    if (result.embeddable) { chosen = { candidate, result }; break }
  }
  const pick = chosen ?? (found[0] ? { candidate: found[0], result: await probe(found[0].videoId) } : null)
  const onIp = pick ? await probeOnIp(pick.candidate.videoId) : null
  const ytDuration = pick ? pick.result.ytDuration ?? pick.candidate.duration : null
  const entry = {
    station: track.station, title: track.title, artist: track.artist, duration: Math.round(track.duration),
    videoId: pick?.candidate.videoId ?? null,
    // The player's own title when it played; search titles can be stale.
    ytTitle: pick ? pick.result.ytTitle ?? pick.candidate.title : null,
    channel: pick?.candidate.channel ?? null,
    embeddable: Boolean(chosen),
    errorCode: chosen ? null : pick ? pick.result.errorCode ?? null : "not-found",
    embeddableOnIpAddress: onIp ? onIp.embeddable : null,
    ipErrorCode: onIp?.errorCode ?? null,
    ytDuration,
    closeDuration: ytDuration != null && Math.abs(ytDuration - track.duration) <= CLOSE_SECONDS,
    tried,
  }
  results.push(entry)
  console.log(`${entry.embeddable ? "ok " : "NO "} ${entry.embeddableOnIpAddress ? "ip-ok" : "ip-NO"} ${track.station.padEnd(14)} ${track.title} — ${track.artist} ${entry.videoId ?? ""} ${entry.errorCode ?? ""}`)
}
await browser.close()
server.close()

writeFileSync(new URL("embed-check.json", here), JSON.stringify({ checkedAt: new Date().toISOString(), origin, tracks: results }, null, 2) + "\n")
// The prototype's playable subset: station id → catalog track index → video.
const stations = {}
for (const station of catalog) {
  stations[station.id] = results.filter(entry => entry.station === station.id).map(entry => entry.embeddable ? { videoId: entry.videoId, ytDuration: entry.ytDuration } : null)
}
writeFileSync(new URL("../../../src/free-roam/live/videos.json", import.meta.url), JSON.stringify(stations, null, 2) + "\n")
const embeddable = results.filter(entry => entry.embeddable).length
const onIp = results.filter(entry => entry.embeddableOnIpAddress).length
console.log(`\n${embeddable}/${results.length} embeddable from ${origin}; ${onIp} also from 127.0.0.1`)
