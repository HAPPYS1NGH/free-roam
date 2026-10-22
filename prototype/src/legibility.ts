import type { DialConfig } from "dialkit"

// Over a bright, busy wallpaper the idle discs nearly vanish. This panel tries
// the two fixes side by side: blur the backdrop more, make the idle discs more
// opaque, or both, with the wheel as crowded as it gets on the Mac. Blur is in
// CSS pixels, which are points on the Mac.

type Preset = { backdropBlur: number; idleOpacity: number }

export const LEGIBILITY_PRESETS = {
  today: { backdropBlur: 0, idleOpacity: 0.4 },
  opaque: { backdropBlur: 0, idleOpacity: 0.65 },
  blur: { backdropBlur: 12, idleOpacity: 0.4 },
  both: { backdropBlur: 10, idleOpacity: 0.6 },
} satisfies Record<string, Preset>

export type LegibilityPreset = keyof typeof LEGIBILITY_PRESETS

export function isLegibilityPreset(action: string): action is LegibilityPreset {
  return Object.hasOwn(LEGIBILITY_PRESETS, action)
}

export const STATION_COUNTS = ["12", "24", "25"] as const
export const WALLPAPERS = ["Yours", "Stand-in"] as const

const presetButton = (label: string, { backdropBlur, idleOpacity }: Preset) => ({
  type: "action" as const,
  label: `${label}: ${backdropBlur} px, ${idleOpacity.toFixed(2)}`,
})

export const legibilityControls = {
  today: presetButton("Today", LEGIBILITY_PRESETS.today),
  opaque: presetButton("Opaque", LEGIBILITY_PRESETS.opaque),
  blur: presetButton("Blur", LEGIBILITY_PRESETS.blur),
  both: presetButton("Both", LEGIBILITY_PRESETS.both),
  backdropBlur: [0, 0, 40, 0.5],
  idleOpacity: [0.4, 0.3, 1, 0.01],
  // Stations on the wheel, not counting Radio Off. 24 is the Mac setup the
  // problem showed up on; 25 is the most the wheel takes.
  stations: { type: "select", options: [...STATION_COUNTS], default: "24" },
  wallpaper: { type: "select", options: [...WALLPAPERS], default: "Yours" },
  copyValues: { type: "action", label: "Copy values" },
} satisfies DialConfig

type ReadoutValues = { backdropBlur: number; idleOpacity: number; stations: string; wallpaper: string }

// One line to quote back, e.g. "Blur 12 px · idle discs 0.40 · 24 stations · your wallpaper".
export function legibilityReadout({ backdropBlur, idleOpacity, stations, wallpaper }: ReadoutValues) {
  const blur = Math.round(backdropBlur * 10) / 10
  return `Blur ${blur} px · idle discs ${idleOpacity.toFixed(2)} · ${stations} stations · ${wallpaper}`
}
