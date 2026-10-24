import { slotsFor, type Playlist } from "../stations"

// Fictional station art and track metadata, never an exported Music library.
export const demoPlaylists: Playlist[] = [
  { id: "night", name: "After Hours", covers: ["/free-roam/stations/night.svg"], tracks: [{ title: "The long way home", artist: "Night radio", duration: 240 }] },
  { id: "focus", name: "Deep Focus", covers: ["/free-roam/stations/focus.svg"], tracks: [{ title: "Room to think", artist: "Instrumentals", duration: 300 }] },
  { id: "morning", name: "Slow Mornings", covers: ["/free-roam/stations/morning.svg"], tracks: [{ title: "Let the light in", artist: "Easy listening", duration: 220 }] },
  { id: "energy", name: "Second Wind", covers: ["/free-roam/stations/energy.svg"], tracks: [{ title: "A little more energy", artist: "Upbeat selections", duration: 200 }] },
  { id: "slow", name: "Low Tide", covers: ["/free-roam/stations/slow.svg"], tracks: [{ title: "Nothing in a hurry", artist: "Downbeat radio", duration: 260 }] },
  { id: "rewind", name: "Rewind", covers: ["/free-roam/stations/rewind.svg"], tracks: [{ title: "Feels like yesterday", artist: "Old favorites", duration: 230 }] },
]

export const demoSlots = slotsFor(demoPlaylists)
