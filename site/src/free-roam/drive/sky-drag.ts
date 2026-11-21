import { Vector3, type PerspectiveCamera, type ShaderMaterial } from "three"
import { MOON_TOP, SOLAR_NOON, moonDirection, moonElevation, sunDirection, sunHour } from "./daylight"

// Pick up the sun or the moon and move it around the sky. Press on the disc to
// take it, or anywhere on the open sky to call the one that's out (the sun by
// day, the moon by night) to the pointer. Height scrubs the clock: the sun
// follows its own arc (down past the horizon is dusk, then night), the moon
// climbs off its low path or sinks towards dawn. Sideways it follows the
// pointer, then drifts back to its arc after letting go. The canvas sits under
// the page copy, so pointers are read on the whole stage.

type Body = "sun" | "moon"
type Scrub = { hour: number; lift: number }

const RADIUS = 48 // px, generous next to a disc about 20 px across
const IGNORE = "a, button, input, select, textarea, label, summary, [role=button], [contenteditable], h1, h2, h3, p, kbd, header > *"
const DEG = Math.PI / 180
const SKY_MIN = 0.5 // degrees above the horizon that count as open sky
// Dragging the moon down sweeps the night to first light at the horizon, then
// on to a risen sun 8° below it.
const FIRST_LIGHT = 5.6, MORNING = 7, MORNING_DEPTH = 8
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
// Hours forward from `from` to `to`, or 0 if `to` has already passed tonight.
const ahead = (from: number, to: number) => { const h = (to - from + 24) % 24; return h > 12 ? 0 : h }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const azimuthOf = (dir: Vector3) => Math.atan2(dir.x, -dir.z)

export function skyDrag(stage: HTMLElement, canvas: HTMLCanvasElement, camera: PerspectiveCamera, dome: ShaderMaterial, enabled: () => boolean) {
  const screen = { sun: { x: 0, y: 0, on: false }, moon: { x: 0, y: 0, on: false } }
  const v = new Vector3(), natural = new Vector3()
  // Where each body is (degrees up, radians round), and the one that's out.
  const body = { sun: { el: 0, az: 0 }, moon: { el: 0, az: 0 } }
  let out: Body = "sun"
  // Radians each body is swung off its arc; eases back to 0 after a drag.
  const turn = { sun: 0, moon: 0 }
  let pointer: { x: number; y: number } | null = null // NDC
  let pointerOver = false, size = { w: 1, h: 1 }
  let hover: Body | "sky" | null = null, held: Body | null = null, shown: Body = "moon", glow = 0
  // Fixed when a drag starts: the clock, the height the moon's path is measured
  // from, and how far the pointer sat from the disc so it doesn't snap to it.
  let start: { hour: number; el: number; offEl: number; offAz: number; afternoon: boolean } | null = null
  let summoned = false, heldFor = 0, easedEl = 0, easedAz = 0

  const pointerRay = () => v.set(pointer!.x, pointer!.y, 0.5).unproject(camera).sub(camera.position).normalize()
  const nearest = () => {
    if (!pointer || !pointerOver) return null
    let best: Body | null = null, bestD = RADIUS
    for (const b of ["sun", "moon"] as const) {
      const s = screen[b]
      if (!s.on) continue
      const d = Math.hypot((s.x - pointer.x) * size.w / 2, (s.y - pointer.y) * size.h / 2)
      if (d < bestD) { best = b; bestD = d }
    }
    return best
  }
  // A disc under the pointer, else open sky to call the body that's out.
  const target = (): Body | "sky" | null => {
    if (!enabled()) return null
    const hit = nearest()
    if (hit) return hit
    return pointer && pointerOver && Math.asin(pointerRay().y) / DEG > SKY_MIN ? "sky" : null
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
    const t = e.target as Element
    pointerOver = stage.contains(t) && !t.closest(IGNORE)
  }

  const onDown = (e: PointerEvent) => {
    if (held || e.button !== 0) return
    read(e)
    const hit = target()
    if (!hit) return
    e.preventDefault()
    try { stage.setPointerCapture(e.pointerId) } catch { /* the pointer already left */ }
    held = shown = hit === "sky" ? out : hit
    summoned = hit === "sky"
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
    turn,
    // While a body is held: the hour and moon lift that put it under the
    // pointer, else null. Also swings `turn` to the pointer, or back to 0.
    scrub(real: number, hour: number, lift: number): Scrub | null {
      if (held && !enabled()) onUp()
      if (!held || !pointer) {
        const k = Math.exp(-real / 0.8)
        turn.sun = Math.abs(turn.sun) < 1e-4 ? 0 : turn.sun * k
        turn.moon = Math.abs(turn.moon) < 1e-4 ? 0 : turn.moon * k
        return null
      }
      const b = body[held]
      const ray = pointerRay()
      const rayEl = Math.asin(ray.y) / DEG, rayAz = azimuthOf(ray)
      if (!start) {
        // A called body flies to the pointer; a taken one keeps its grip offset.
        const offEl = summoned ? 0 : b.el - rayEl, offAz = summoned ? 0 : wrap(b.az - rayAz)
        start = { hour, el: Math.min(b.el, rayEl + offEl), offEl, offAz, afternoon: hour >= SOLAR_NOON }
        easedEl = b.el
        easedAz = b.az
        heldFor = 0
      }
      heldFor += real
      // About 250 ms to arrive when called, then close behind the pointer.
      const k = 1 - Math.exp(-real * (summoned && heldFor < 0.35 ? 12 : 30))
      easedEl += (rayEl + start.offEl - easedEl) * k
      easedAz += wrap(rayAz + start.offAz - easedAz) * k

      let h: number, l = lift
      if (held === "sun") {
        h = sunHour(clamp(easedEl, -40, 62), start.afternoon)
        sunDirection(h, natural)
      } else {
        const el = clamp(easedEl, -MORNING_DEPTH - 4, MOON_TOP)
        h = start.hour
        if (el < start.el) {
          // At least 3° of travel, so a moon called low doesn't skip hours as the camera bobs.
          h += ahead(h, FIRST_LIGHT) * clamp((start.el - el) / Math.max(3, start.el), 0, 1)
          if (el < 0) h += ahead(h, MORNING) * clamp(-el / MORNING_DEPTH, 0, 1)
        }
        h %= 24
        l = el - moonElevation(h)
        moonDirection(h, natural)
      }
      turn[held] = wrap(easedAz - azimuthOf(natural))
      return { hour: h, lift: l }
    },
    // Each frame after the camera moves, with the directions as drawn: where
    // the bodies are on screen, what the pointer is over, and the halo.
    track(real: number, sunDir: Vector3, moonDir: Vector3, sunShows: boolean, moonShows: boolean) {
      body.sun.el = Math.asin(sunDir.y) / DEG
      body.sun.az = azimuthOf(sunDir)
      body.moon.el = Math.asin(moonDir.y) / DEG
      body.moon.az = azimuthOf(moonDir)
      // Through civil twilight the sun can still be called back up.
      if (!held) out = body.sun.el > -6 ? "sun" : "moon"
      for (const [b, dir, shows] of [["sun", sunDir, sunShows], ["moon", moonDir, moonShows]] as const) {
        const s = screen[b]
        v.copy(dir).multiplyScalar(1000).add(camera.position).project(camera)
        s.on = shows && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
        s.x = v.x
        s.y = v.y
      }
      const next = target()
      if (next !== hover) { hover = next; setCursor() }
      if (hover && hover !== "sky" && !held) shown = hover
      const want = held || (hover && hover !== "sky") ? 1 : 0
      glow = Math.abs(want - glow) < 0.002 ? want : glow + (want - glow) * Math.min(1, real * 8)
      const u = dome.uniforms
      u.uGrab.value = glow
      u.uGrabMoon.value = shown === "moon" ? 1 : 0
      u.uGrabDir.value.copy(shown === "moon" ? moonDir : sunDir)
      // A moon called up in the dusk or dawn, before it's out, still shows.
      if (shown === "moon") u.uMoon.value = Math.max(u.uMoon.value, glow * 0.7)
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
