import type { SpringConfig, TransitionConfig } from "dialkit"
import { toPhysics } from "./timing"

const round = (n: number) => Math.round(n * 1000) / 1000

// Action buttons also resolve to `{ type: "action" }`, so match the type exactly.
function isTransition(value: unknown): value is TransitionConfig {
  if (typeof value !== "object" || value === null || !("type" in value)) return false
  return value.type === "spring" || value.type === "easing"
}

// Splits a variant's tuned values into the groups WheelStyle.swift reads.
export function buildTokens(variant: string, values: Record<string, unknown>, behaviour: Record<string, unknown>) {
  const animations: Record<string, unknown> = {}
  const geometry: Record<string, number> = {}
  const colors: Record<string, string> = {}

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "number") geometry[key] = round(value)
    else if (typeof value === "string") colors[key] = value
    else if (isTransition(value) && value.type === "easing") {
      animations[key] = { duration: value.duration, bezier: value.ease }
    } else if (isTransition(value)) {
      const { mass, stiffness, damping } = toPhysics(value as SpringConfig)
      animations[key] = { mass: round(mass), stiffness: round(stiffness), damping: round(damping) }
    }
  }

  return {
    app: "Static",
    variant,
    exportedAt: new Date().toISOString(),
    animations,
    geometry,
    colors,
    behaviour,
  }
}

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
