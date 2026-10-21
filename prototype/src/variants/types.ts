import type { Station } from "../stations"

export type WheelProps<Values> = {
  values: Values
  stations: Station[]
  highlighted: number | null
  playingId: string | null
  trackIndex: number
  speed: number
  reduced: boolean
}

// With nothing highlighted, the wheel describes whatever is playing.
export function focusIndex(stations: Station[], highlighted: number | null, playingId: string | null) {
  if (highlighted !== null) return highlighted
  const playing = stations.findIndex((s) => s.id === playingId)
  return playing >= 0 ? playing : stations.findIndex((s) => s.kind === "off")
}
