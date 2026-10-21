export type Track = { title: string; artist: string }

export type Station =
  | { kind: "playlist"; id: string; name: string; songCount: number; hours: number; tracks: Track[] }
  | { kind: "empty"; id: string }
  | { kind: "off"; id: string }

// Slot 0 is the top of the wheel, then clockwise. The names are deliberately
// awkward: one very long, one with an emoji, one tiny, one huge library.
export const stations: Station[] = [
  {
    kind: "playlist",
    id: "gym",
    name: "Gym Bangers",
    songCount: 64,
    hours: 4,
    tracks: [
      { title: "Lose Yourself", artist: "Eminem" },
      { title: "Till I Collapse", artist: "Eminem, Nate Dogg" },
      { title: "Stronger", artist: "Kanye West" },
    ],
  },
  {
    kind: "playlist",
    id: "late",
    name: "Late Night Drives Through Empty Cities (2014–2019)",
    songCount: 212,
    hours: 13,
    tracks: [
      { title: "Nights", artist: "Frank Ocean" },
      { title: "Midnight City", artist: "M83" },
      { title: "The Less I Know the Better", artist: "Tame Impala" },
    ],
  },
  {
    kind: "playlist",
    id: "sunday",
    name: "☕ Sunday Coffee",
    songCount: 38,
    hours: 2,
    tracks: [
      { title: "Banana Pancakes", artist: "Jack Johnson" },
      { title: "Put Your Records On", artist: "Corinne Bailey Rae" },
      { title: "Sunday Morning", artist: "Maroon 5" },
    ],
  },
  {
    kind: "playlist",
    id: "hype",
    name: "Hype",
    songCount: 25,
    hours: 1,
    tracks: [
      { title: "HUMBLE.", artist: "Kendrick Lamar" },
      { title: "SICKO MODE", artist: "Travis Scott" },
      { title: "POWER", artist: "Kanye West" },
    ],
  },
  { kind: "off", id: "off" },
  {
    kind: "playlist",
    id: "focus",
    name: "Focus Flow (No Lyrics)",
    songCount: 140,
    hours: 9,
    tracks: [
      { title: "Experience", artist: "Ludovico Einaudi" },
      { title: "Intro", artist: "The xx" },
      { title: "Weightless", artist: "Marconi Union" },
    ],
  },
  { kind: "empty", id: "empty" },
  {
    kind: "playlist",
    id: "throwbacks",
    name: "Throwbacks",
    songCount: 1204,
    hours: 81,
    tracks: [
      { title: "Bohemian Rhapsody - Remastered 2011", artist: "Queen" },
      { title: "Mr. Brightside", artist: "The Killers" },
      { title: "Africa", artist: "TOTO" },
    ],
  },
]

// FNV-1a, so the same playlist name always gets the same frequency and colour.
// The murmur3 finaliser at the end mixes the low bits; without it short names
// all land on similar hues.
function hash(text: string) {
  let h = 0x811c9dc5
  for (const char of text) {
    h ^= char.codePointAt(0)!
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

// US FM stations sit on odd tenths between 88.1 and 107.9.
export function frequencyFor(name: string) {
  return (88.1 + (hash(name) % 100) * 0.2).toFixed(1)
}

export function hueFor(name: string) {
  return hash(name) % 360
}

// "Gym Bangers" → GYM, "☕ Sunday Coffee" → SC, "Throwbacks" → THROW
export function callSignFor(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean)
  if (words.length === 0) return "FM"
  if (words[0].length <= 5) return words[0].toUpperCase()
  if (words.length === 1) return words[0].slice(0, 5).toUpperCase()
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase()
}

export function trackAt(tracks: Track[], index: number) {
  return tracks[((index % tracks.length) + tracks.length) % tracks.length]
}

export type SlotDescription = { title: string; subtitle: string; frequency: string | null; onAir: boolean }

// What the centre of the wheel says for a slot. A playlist that isn't playing
// only shows its size: the real Music app has no "now playing" for it.
export function describe(station: Station | undefined, playingId: string | null, trackIndex: number): SlotDescription {
  if (!station || station.kind === "off") {
    return { title: "Radio off", subtitle: playingId ? "Stop playback" : "Nothing playing", frequency: null, onAir: false }
  }
  if (station.kind === "empty") {
    return { title: "Empty slot", subtitle: "Pick a playlist in Settings", frequency: null, onAir: false }
  }
  const onAir = station.id === playingId
  const track = trackAt(station.tracks, trackIndex)
  return {
    title: station.name,
    subtitle: onAir ? `${track.title} · ${track.artist}` : `${station.songCount.toLocaleString()} songs · ${station.hours} hr`,
    frequency: frequencyFor(station.name),
    onAir,
  }
}
