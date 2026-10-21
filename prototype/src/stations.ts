export type Track = { title: string; artist: string; duration: number }

export type Playlist = { id: string; name: string; tracks: Track[]; covers: string[] }

export type Slot = { kind: "off"; id: "off" } | { kind: "playlist"; id: string; playlist: Playlist }

// GTA V shows up to 26 slots; past that the logos get too small to read.
export const MAX_STATIONS = 25

export function slotsFor(playlists: Playlist[]): Slot[] {
  return [
    { kind: "off", id: "off" },
    ...playlists.slice(0, MAX_STATIONS).map((playlist): Slot => ({ kind: "playlist", id: playlist.id, playlist })),
  ]
}

// Used when no library has been exported. The names are deliberately awkward:
// one very long, one with an emoji, one tiny.
export const mockPlaylists: Playlist[] = [
  {
    id: "gym",
    name: "Gym Bangers",
    covers: [],
    tracks: [
      { title: "Lose Yourself", artist: "Eminem", duration: 326 },
      { title: "Till I Collapse", artist: "Eminem, Nate Dogg", duration: 297 },
      { title: "Stronger", artist: "Kanye West", duration: 311 },
    ],
  },
  {
    id: "late",
    name: "Late Night Drives Through Empty Cities (2014–2019)",
    covers: [],
    tracks: [
      { title: "Nights", artist: "Frank Ocean", duration: 307 },
      { title: "Midnight City", artist: "M83", duration: 243 },
      { title: "The Less I Know the Better", artist: "Tame Impala", duration: 216 },
    ],
  },
  {
    id: "sunday",
    name: "☕ Sunday Coffee",
    covers: [],
    tracks: [
      { title: "Banana Pancakes", artist: "Jack Johnson", duration: 191 },
      { title: "Put Your Records On", artist: "Corinne Bailey Rae", duration: 215 },
    ],
  },
  {
    id: "hype",
    name: "Hype",
    covers: [],
    tracks: [
      { title: "HUMBLE.", artist: "Kendrick Lamar", duration: 177 },
      { title: "SICKO MODE", artist: "Travis Scott", duration: 312 },
    ],
  },
  {
    id: "focus",
    name: "Focus Flow (No Lyrics)",
    covers: [],
    tracks: [
      { title: "Experience", artist: "Ludovico Einaudi", duration: 315 },
      { title: "Weightless", artist: "Marconi Union", duration: 480 },
    ],
  },
  {
    id: "throwbacks",
    name: "Throwbacks",
    covers: [],
    tracks: [
      { title: "Bohemian Rhapsody - Remastered 2011", artist: "Queen", duration: 355 },
      { title: "Mr. Brightside", artist: "The Killers", duration: 222 },
      { title: "Africa", artist: "TOTO", duration: 295 },
    ],
  },
]

// FNV-1a with a murmur3 finaliser, so the same name always gets the same
// fallback colour and short names don't all land on similar hues.
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

export function hueFor(name: string) {
  return hash(name) % 360
}

// "Gym Bangers" → GB, "☕ Sunday Coffee" → SC, "Hype" → H
export function initialsFor(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
