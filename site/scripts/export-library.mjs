// Exports your Music playlists for the website studio: names, track lists with
// durations (for the broadcast clock) and up to four album covers each.
// Output goes to public/library/, which is gitignored, so your library never
// ends up in the repo. Run with `npm run library`; macOS asks once to allow
// your terminal to control Music.
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "library")
const FIELD = "\u001f"
const RECORD = "\u001e"
const MAX_COVERS = 4
const COVER_SIZE = 256

const prelude = 'set FS to character id 31\nset RS to character id 30\nset out to ""'

function runAppleScript(script) {
  return execFileSync("osascript", ["-e", script], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\n$/, "")
}

function records(text) {
  return text
    .split(RECORD)
    .filter(Boolean)
    .map((record) => record.split(FIELD))
}

// Playlists are only ever addressed by persistent ID, never by name, so a
// playlist called `"; do shell script …` can't inject AppleScript.
function persistentId(id) {
  if (!/^[0-9A-F]{16}$/.test(id)) throw new Error(`Unexpected persistent ID: ${id}`)
  return id
}

function text(value) {
  return value === "missing value" ? "" : value
}

function listPlaylists() {
  const output = runAppleScript(`${prelude}
tell application "Music"
  repeat with p in (every user playlist whose special kind is none)
    set out to out & (persistent ID of p) & FS & (name of p) & RS
  end repeat
end tell
return out`)
  return records(output).map(([id, name]) => ({ id: persistentId(id), name }))
}

function listTracks(id) {
  const output = runAppleScript(`${prelude}
tell application "Music"
  set p to first user playlist whose persistent ID is "${id}"
  set trackTitles to name of every track of p
  set trackArtists to artist of every track of p
  set trackAlbums to album of every track of p
  set trackDurations to duration of every track of p
end tell
repeat with i from 1 to count of trackTitles
  set out to out & (item i of trackTitles) & FS & (item i of trackArtists) & FS & (item i of trackAlbums) & FS & (item i of trackDurations) & RS
end repeat
return out`)
  return records(output).map(([title, artist, album, duration]) => ({
    title: text(title),
    artist: text(artist),
    album: text(album),
    duration: Number(duration.replace(",", ".")) || 0,
  }))
}

// The first track from each of the first four distinct albums, like the
// mosaic Apple Music draws for playlists without custom artwork.
function exportCovers(id, tracks) {
  const picks = []
  const albums = new Set()
  tracks.forEach((track, i) => {
    if (picks.length < MAX_COVERS && !albums.has(track.album)) {
      albums.add(track.album)
      picks.push(i + 1)
    }
  })

  const covers = []
  for (const [k, trackNumber] of picks.entries()) {
    const raw = join(outDir, `${id}-${k}.raw`)
    const file = `${id}-${k}.jpg`
    try {
      const result = runAppleScript(`
tell application "Music"
  set t to track ${trackNumber} of (first user playlist whose persistent ID is "${id}")
  if (count of artworks of t) is 0 then return "none"
  set imageData to raw data of artwork 1 of t
end tell
set f to open for access POSIX file "${raw}" with write permission
set eof of f to 0
write imageData to f
close access f
return "ok"`)
      if (result !== "ok") continue
      execFileSync("sips", ["-s", "format", "jpeg", "-Z", String(COVER_SIZE), raw, "--out", join(outDir, file)], {
        stdio: "ignore",
      })
      covers.push(`/library/${file}`)
    } catch (error) {
      console.warn(`  Skipped a cover for playlist ${id}: ${error.message.split("\n")[0]}`)
    } finally {
      rmSync(raw, { force: true })
    }
  }
  return covers
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const playlists = listPlaylists().map(({ id, name }) => {
  const tracks = listTracks(id)
  const covers = exportCovers(id, tracks)
  console.log(`${name}: ${tracks.length} tracks, ${covers.length} covers`)
  return { id, name, tracks: tracks.map(({ title, artist, duration }) => ({ title, artist, duration })), covers }
})

writeFileSync(join(outDir, "library.json"), JSON.stringify({ exportedAt: new Date().toISOString(), playlists }, null, 2))
console.log(`Exported ${playlists.length} playlists to ${outDir}`)
