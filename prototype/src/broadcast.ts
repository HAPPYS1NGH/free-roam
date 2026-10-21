import { useEffect, useState } from "react"
import type { Track } from "./stations"

// Every station behaves as if it has been playing its playlist on a loop since
// this moment. Tuning in lands mid-song like real radio, and the wheel can say
// what's on air before you tune in. Ports to Swift unchanged: the app plays
// track `index` and sets Music's player position to `position`.
const BROADCAST_EPOCH_SECONDS = Date.UTC(2026, 0, 1) / 1000

export type OnAir = { index: number; track: Track; position: number }

export function onAir(tracks: Track[], nowSeconds: number): OnAir | null {
  const total = tracks.reduce((sum, track) => sum + track.duration, 0)
  if (total <= 0) return null
  let offset = (((nowSeconds - BROADCAST_EPOCH_SECONDS) % total) + total) % total
  for (const [index, track] of tracks.entries()) {
    if (offset < track.duration) return { index, track, position: offset }
    offset -= track.duration
  }
  return { index: 0, track: tracks[0], position: 0 }
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() / 1000), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
