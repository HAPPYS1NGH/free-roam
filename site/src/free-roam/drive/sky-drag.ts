import { Vector3, type PerspectiveCamera, type ShaderMaterial } from "three"
import { MOON_TOP, SOLAR_NOON, moonElevation, sunHour } from "./daylight"

// Pick up the sun or the moon and move it up and down the sky. Holding it
// scrubs the clock: the sun follows its own arc (down past the horizon is dusk,
// then night), the moon climbs off its low path or sinks towards dawn. The
// canvas sits under the page copy, so pointers are read on the whole stage.

type Body = "sun" | "moon"
type Scrub = { hour: number; lift: number }

const RADIUS = 48 // px, generous next to a disc about 20 px across
const IGNORE = "a, button, input, select, textarea, label, summary, [role=button], [contenteditable]"
const DEG = Math.PI / 180
// Dragging the moon down sweeps the night to first light at the horizon, then
// on to a risen sun 8° below it.
const FIRST_LIGHT = 5.6, MORNING = 7, MORNING_DEPTH = 8
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
// Hours forward from `from` to `to`, or 0 if `to` has already passed tonight.
const ahead = (from: number, to: number) => { const h = (to - from + 24) % 24; return h > 12 ? 0 : h }

export function skyDrag(stage: HTMLElement, canvas: HTMLCanvasElement, camera: PerspectiveCamera, dome: ShaderMaterial, enabled: () => boolean) {
  const screen = { sun: { x: 0, y: 0, on: false }, moon: { x: 0, y: 0, on: false } }
  const v = new Vector3()
  let pointer: { x: number; y: number } | null = null // NDC
  let pointerOver = false, size = { w: 1, h: 1 }
  let hover: Body | null = null, held: Body | null = null, shown: Body = "moon", glow = 0
  // Fixed when a drag starts: where the clock and the body were, and how far
  // the pointer sat from the disc's centre, so the body doesn't snap to it.
  let start: { hour: number; el: number; offset: number; afternoon: boolean } | null = null
  let eased = 0
  const bodyEl = { sun: 0, moon: 0 }

  const pointerElevation = () => {
    v.set(pointer!.x, pointer!.y, 0.5).unproject(camera).sub(camera.position).normalize()
    return Math.asin(v.y) / DEG
  }
  const nearest = () => {
    if (!pointer || !pointerOver) return null
    let best: Body | null = null, bestD = RADIUS
    for (const body of ["sun", "moon"] as const) {
      const s = screen[body]
      if (!s.on) continue
      const d = Math.hypot((s.x - pointer.x) * size.w / 2, (s.y - pointer.y) * size.h / 2)
      if (d < bestD) { best = body; bestD = d }
    }
    return best
  }
  const setCursor = () => {
    const next = held ? "grabbing" : hover ? "grab" : ""
    if (next) stage.dataset.sky = next
    else delete stage.dataset.sky
  }
  const read = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    size = { w: rect.width, h: rect.height }
    pointer = { x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: 1 - ((e.clientY - rect.top) / rect.height) * 2 }
    const target = e.target as Element
    pointerOver = stage.contains(target) && !target.closest(IGNORE)
  }

  const onDown = (e: PointerEvent) => {
    if (held || e.button !== 0 || !enabled()) return
    read(e)
    const body = nearest()
    if (!body) return
    e.preventDefault()
    try { stage.setPointerCapture(e.pointerId) } catch { /* the pointer already left */ }
    held = shown = body
    start = null
    document.documentElement.dataset.skyDrag = ""
    setCursor()
  }
  const onMove = (e: PointerEvent) => { read(e) }
  const onUp = () => {
    if (!held) return
    held = null
    delete document.documentElement.dataset.skyDrag
    setCursor()
  }
  const onOut = (e: PointerEvent) => { if (!e.relatedTarget && !held) { pointer = null; hover = null; setCursor() } }
  const onSelect = (e: Event) => { if (held) e.preventDefault() }
  stage.addEventListener("pointerdown", onDown)
  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)
  window.addEventListener("blur", onUp)
  document.addEventListener("pointerout", onOut)
  document.addEventListener("selectstart", onSelect)

  return {
    // While a body is held: the hour and moon lift that put it under the pointer.
    scrub(real: number, hour: number, lift: number): Scrub | null {
      if (held && !enabled()) onUp()
      if (!held || !pointer) return null
      if (!start) {
        start = { hour, el: bodyEl[held], offset: bodyEl[held] - pointerElevation(), afternoon: hour >= SOLAR_NOON }
        eased = start.el
      }
      eased += (pointerElevation() + start.offset - eased) * (1 - Math.exp(-real * 30))
      if (held === "sun") return { hour: sunHour(clamp(eased, -40, 62), start.afternoon), lift }
      const el = clamp(eased, -MORNING_DEPTH - 4, MOON_TOP)
      let h = start.hour
      if (el < start.el) {
        const toFirst = ahead(h, FIRST_LIGHT)
        h += toFirst * clamp((start.el - el) / Math.max(0.5, start.el), 0, 1)
        if (el < 0) h += ahead(h, MORNING) * clamp(-el / MORNING_DEPTH, 0, 1)
      }
      h %= 24
      return { hour: h, lift: el - moonElevation(h) }
    },
    // Each frame after the camera moves: where the bodies are on screen,
    // whether the pointer is over one, and the halo that says it can be held.
    track(real: number, sunDir: Vector3, moonDir: Vector3, sunShows: boolean, moonShows: boolean) {
      bodyEl.sun = Math.asin(sunDir.y) / DEG
      bodyEl.moon = Math.asin(moonDir.y) / DEG
      for (const [body, dir, shows] of [["sun", sunDir, sunShows], ["moon", moonDir, moonShows]] as const) {
        const s = screen[body]
        v.copy(dir).multiplyScalar(1000).add(camera.position).project(camera)
        s.on = shows && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
        s.x = v.x
        s.y = v.y
      }
      const next = enabled() ? nearest() : null
      if (next !== hover) { hover = next; setCursor() }
      if (hover && !held) shown = hover
      const want = held || hover ? 1 : 0
      glow = Math.abs(want - glow) < 0.002 ? want : glow + (want - glow) * Math.min(1, real * 8)
      const u = dome.uniforms
      u.uGrab.value = glow
      u.uGrabMoon.value = shown === "moon" ? 1 : 0
      u.uGrabDir.value.copy(shown === "moon" ? moonDir : sunDir)
    },
    dispose() {
      stage.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      window.removeEventListener("blur", onUp)
      document.removeEventListener("pointerout", onOut)
      document.removeEventListener("selectstart", onSelect)
      delete stage.dataset.sky
      delete document.documentElement.dataset.skyDrag
    },
  }
}
