// The coast road at 3 A.M., drawn one 4px pixel at a time into a low-res
// canvas that CSS upscales with crisp pixels. Grass and palm crowns are
// springs; traffic (traffic.ts) and the streetlights (lamps.ts) step per frame.
import { breakLamp, createLamp, drawLamps, drawPools, lampAt, settleLamps as settle, stepLamps, type Bit } from "./lamps"
import { createTraffic, drawTraffic, headlightsOf, sendCar, stepTraffic } from "./traffic"

// 4px pixels on desktop, 3px on phones so the band stays short.
export const pixelFor = (width: number) => (width < 600 ? 3 : 4)

// The scene stands on GROUND; below it, soil dithers out into the page.
const GROUND = 60
export const ROWS = 72

// Rows of the strip, top to bottom.
const HORIZON = 20
const RAIL = 31
const ROAD_TOP = 35
const ROAD_BOTTOM = 52
const VERGE = 53

export type Palette = { accent: string; sodium: string; ink: string; bg: string }

type Spring = { x: number; offset: number; velocity: number }
type Blade = Spring & { height: number; shade: number }
type Palm = Spring & { height: number; lean: number }
type Firefly = { lamp: number; born: number; life: number; dx: number; dy: number; phase: number }

const SEA = ["oklch(0.2 0.03 250)", "oklch(0.18 0.028 250)", "oklch(0.16 0.024 252)"]
const ASPHALT = "oklch(0.14 0.012 255)"
const RAIL_COLOUR = "oklch(0.42 0.015 250)"
const POST = "oklch(0.3 0.015 250)"
const GRASS = ["oklch(0.2 0.03 160)", "oklch(0.25 0.035 155)", "oklch(0.3 0.04 150)"]
const SILHOUETTE = "oklch(0.075 0.01 255)"
const SOIL = ["oklch(0.15 0.022 150)", "oklch(0.13 0.018 200)", "oklch(0.24 0.02 90)"]
const MOON = "oklch(0.93 0.03 90)"

// A deterministic scatter, so the scene is the same on every visit.
const noise = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

// `anchors`: columns to stand a lamp at (one under each link column).
export function createScene(columns: number, anchors: number[] = []) {
  const blades: Blade[] = []
  for (let x = 0; x < columns; x++) {
    if (noise(x) < 0.18) continue
    blades.push({ x, height: 1 + Math.round(noise(x + 9) * 4), shade: Math.floor(noise(x + 3) * 3), offset: 0, velocity: 0 })
  }
  const palms: Palm[] = []
  const lamps: ReturnType<typeof createLamp>[] = []
  for (let x = 18; x < columns - 8; x += 44 + Math.round(noise(x) * 26)) {
    palms.push({ x, height: 34 + Math.round(noise(x + 1) * 12), lean: noise(x + 2) < 0.5 ? -1 : 1, offset: 0, velocity: 0 })
  }
  const spots = anchors.length ? anchors : Array.from({ length: Math.ceil((columns - 52) / 110) }, (_, i) => 46 + i * 110)
  for (const x of spots) if (x >= 2 && x < columns - 8) lamps.push(createLamp(Math.round(x)))
  // Keep palms off the lamp posts.
  for (const palm of palms) for (const lamp of lamps) if (Math.abs(palm.x - lamp.x) < 12) palm.x = lamp.x + (palm.x < lamp.x ? -14 : 14)
  const stars = Array.from({ length: Math.round(columns / 9) }, (_, i) => ({ x: Math.floor(noise(i + 40) * columns), y: Math.floor(noise(i + 80) * (HORIZON - 3)), phase: noise(i) * 6 }))
  return { columns, blades, palms, lamps, stars, traffic: createTraffic(), lastHoverCar: -Infinity, bits: [] as Bit[], fireflies: [] as Firefly[], nextFirefly: 0, litLamp: null as number | null }
}

export type Scene = ReturnType<typeof createScene>

// The travelling wind: a slow swell rolling left to right with gusts on top.
const wind = (x: number, t: number) => Math.sin(x * 0.045 - t * 1.1) * 0.6 + Math.sin(x * 0.11 - t * 2.3) * 0.25 + 0.35

// Bends away from the pointer: strongest right under it, gone at `radius`.
const push = (x: number, pointer: number | null, radius: number) => {
  if (pointer === null) return 0
  const distance = x - pointer
  if (Math.abs(distance) > radius) return 0
  return Math.sign(distance || 1) * (1 - Math.abs(distance) / radius) * 4
}

// Under-damped, so a gust or the pointer leaving overshoots and settles.
function stepSpring(spring: Spring, target: number, dt: number, stiffness: number, damping: number) {
  const force = (target - spring.offset) * stiffness - spring.velocity * damping
  spring.velocity += force * dt
  spring.offset += spring.velocity * dt
}

// The side a car comes from: the one nearer the column it was asked for
// (in scene pixels), so a click on the left brings it in from the left.
// Without a column (keyboard, a retune) the lanes take turns.
const sideOf = (scene: Scene, column: number | null) => column === null ? undefined : column < scene.columns / 2 ? 1 : -1

// A car in the station's colour, leaving now.
export function queueCar(scene: Scene, column: number | null = null) {
  sendCar(scene.traffic, scene.columns, null, sideOf(scene, column))
}

// Hovering waves one through, but sweeping across links doesn't build a jam.
export function sendCarSoon(scene: Scene, now: number, column: number | null = null) {
  if (now - scene.lastHoverCar < 700) return
  scene.lastHoverCar = now
  sendCar(scene.traffic, scene.columns, null, sideOf(scene, column))
}

// The lamp nearest a column (in scene pixels) brightens; null lets it fade.
export function lightLampNear(scene: Scene, column: number | null) {
  if (column === null || !scene.lamps.length) { scene.litLamp = null; return }
  let best = 0
  scene.lamps.forEach((lamp, i) => { if (Math.abs(lamp.x + 7 - column) < Math.abs(scene.lamps[best].x + 7 - column)) best = i })
  scene.litLamp = best
}

// Breaks the lamp under a scene pixel. Null when the press missed every lamp.
export function hitLamp(scene: Scene, x: number, y: number, now: number) {
  const lamp = lampAt(scene.lamps, x, y)
  if (!lamp) return null
  return breakLamp(lamp, scene.bits, now) ?? "busy"
}

export const headlights = (scene: Scene) => headlightsOf(scene.traffic)

// Reduced motion: lamps jump straight to their state.
export function settleLamps(scene: Scene) {
  settle(scene.lamps, scene.litLamp)
}

export function step(scene: Scene, now: number, dt: number, pointer: number | null) {
  const t = now / 1000
  for (const blade of scene.blades) stepSpring(blade, wind(blade.x, t) * 1.2 + push(blade.x, pointer, 14), dt, 90, 7)
  for (const palm of scene.palms) stepSpring(palm, wind(palm.x, t) * 1.6 + push(palm.x, pointer, 20) * 0.9, dt, 40, 4)

  stepLamps(scene.lamps, scene.litLamp, scene.bits, now, dt)
  stepTraffic(scene.traffic, scene.columns, now, dt)

  if (now > scene.nextFirefly && scene.lamps.length) {
    scene.fireflies.push({ lamp: Math.floor(Math.random() * scene.lamps.length), born: now, life: 2400 + Math.random() * 2000, dx: Math.random() * 16 - 8, dy: Math.random() * 6, phase: Math.random() * 6 })
    scene.nextFirefly = now + 900 + Math.random() * 1800
  }
  scene.fireflies = scene.fireflies.filter(fly => now - fly.born < fly.life)
}

export function draw(context: CanvasRenderingContext2D, scene: Scene, now: number, palette: Palette) {
  const { columns } = scene
  const t = now / 1000
  const px = (x: number, y: number, w = 1, h = 1) => context.fillRect(Math.round(x), Math.round(y), w, h)
  context.clearRect(0, 0, columns, ROWS)

  // Sky: a few stars that breathe.
  context.fillStyle = palette.ink
  for (const star of scene.stars) {
    context.globalAlpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.8 + star.phase))
    px(star.x, star.y)
  }
  context.globalAlpha = 1

  // A faint glow above the horizon, so palms and lamps read as silhouettes.
  context.fillStyle = "oklch(0.3 0.04 250)"
  for (let y = 6; y < HORIZON; y++) {
    context.globalAlpha = ((y - 6) / (HORIZON - 6)) ** 2 * 0.35
    px(0, y, columns, 1)
  }

  // Moon, low over the sea, with a stepped halo.
  const moonX = Math.round(columns * 0.72)
  context.fillStyle = MOON
  context.globalAlpha = 0.06
  px(moonX - 4, 3, 9, 7); px(moonX - 3, 2, 7, 9)
  context.globalAlpha = 0.1
  px(moonX - 3, 4, 7, 5); px(moonX - 2, 3, 5, 7)
  context.globalAlpha = 1
  px(moonX - 1, 4, 3, 1); px(moonX - 2, 5, 5, 3); px(moonX - 1, 8, 3, 1)
  context.fillStyle = "oklch(0.82 0.03 90)"
  px(moonX, 6); px(moonX - 1, 7)

  // Sea, banded darker toward the shore, with glints under the moon.
  for (let y = HORIZON; y < RAIL; y++) {
    context.fillStyle = SEA[Math.min(2, Math.floor((y - HORIZON) / 4))]
    px(0, y, columns, 1)
  }
  context.fillStyle = "oklch(0.3 0.03 250)"
  px(0, HORIZON, columns, 1)
  context.fillStyle = MOON
  for (let y = HORIZON + 1; y < RAIL; y += 2) {
    const spread = 2 + (y - HORIZON) * 0.9
    for (let i = 0; i < 3; i++) {
      const flicker = Math.sin(t * 2.2 + y * 1.7 + i * 2.1)
      if (flicker < 0.1) continue
      context.globalAlpha = 0.35 + flicker * 0.45
      const x = moonX + Math.round(Math.sin(y * 3.1 + i * 5.3 + Math.floor(t * 1.5) * 0.7) * spread)
      px(x, y, 1 + (i % 2), 1)
    }
  }
  context.globalAlpha = 1

  // Guardrail: posts, then the rail across them.
  context.fillStyle = POST
  for (let x = 2; x < columns; x += 6) px(x, RAIL, 1, ROAD_TOP - RAIL)
  context.fillStyle = RAIL_COLOUR
  px(0, RAIL, columns, 1)
  context.fillStyle = POST
  px(0, RAIL + 1, columns, 1)

  // Road, with a dashed centre line.
  context.fillStyle = ASPHALT
  px(0, ROAD_TOP, columns, ROAD_BOTTOM - ROAD_TOP)
  context.fillStyle = "oklch(0.45 0.02 85)"
  for (let x = 0; x < columns; x += 8) px(x, 43, 4, 1)

  // Sodium pools on the asphalt, under each lamp head.
  drawPools(context, scene.lamps, now, palette.sodium, px)

  drawTraffic(context, scene.traffic, palette.accent, px)

  // Verge, then soil that dithers out into the page background.
  context.fillStyle = GRASS[0]
  px(0, VERGE, columns, GROUND - VERGE)
  for (let y = GROUND; y < ROWS; y++) {
    const k = (y - GROUND) / (ROWS - GROUND)
    context.fillStyle = k < 0.35 ? SOIL[0] : SOIL[1]
    for (let x = 0; x < columns; x++) {
      // Ordered dither: fewer pixels survive the deeper you go.
      const threshold = ((x % 4) * 4 + (y % 4) * 2 + ((x + y) % 2) * 5) % 16 / 16
      if (threshold >= 1 - k * 1.05) continue
      px(x, y)
    }
  }
  context.fillStyle = SOIL[2]
  for (let x = 3; x < columns; x += 7) if (noise(x + 17) > 0.6) px(x, GROUND + 1 + Math.floor(noise(x + 5) * 5))

  // Lamp posts, on the near verge, arms reaching over the road.
  drawLamps(context, scene.lamps, scene.bits, now, palette.sodium, GROUND, px)

  for (const fly of scene.fireflies) {
    const age = (now - fly.born) / fly.life
    const lamp = scene.lamps[fly.lamp]
    if (!lamp) continue
    context.fillStyle = "oklch(0.92 0.16 110)"
    context.globalAlpha = Math.sin(age * Math.PI) * (0.6 + 0.4 * Math.sin(now / 160 + fly.phase))
    px(lamp.x + 7 + fly.dx + Math.sin(now / 700 + fly.phase) * 4, 18 + fly.dy + Math.cos(now / 900 + fly.phase) * 3)
  }
  context.globalAlpha = 1

  drawPalms(context, scene, px)

  // Grass blades: the tip bends most, the root not at all.
  for (const blade of scene.blades) {
    context.fillStyle = GRASS[blade.shade]
    for (let h = 0; h < blade.height; h++) {
      const bend = blade.offset * (h / blade.height) ** 2
      px(blade.x + bend, VERGE - 1 - h)
    }
  }
}

function drawPalms(context: CanvasRenderingContext2D, scene: Scene, px: (x: number, y: number, w?: number, h?: number) => void) {
  context.fillStyle = SILHOUETTE
  for (const palm of scene.palms) {
    const base = GROUND - 4
    const top = base - palm.height
    let crownX = palm.x
    for (let y = base; y >= top; y--) {
      const k = (base - y) / palm.height
      crownX = palm.x + palm.lean * k * k * 6 + palm.offset * k * k * 0.8
      px(crownX, y, k < 0.65 ? 2 : 1, 1)
    }
    // Fronds droop out from the crown; their tips swing furthest.
    const fronds = [[-1, 0.1], [-1, 0.45], [-0.8, 0.95], [1, 0.1], [1, 0.45], [0.8, 0.95], [0.4, -0.5], [-0.4, -0.5]] as const
    for (const [dir, droop] of fronds) {
      const length = 11
      for (let i = 1; i <= length; i++) {
        const k = i / length
        const x = crownX + dir * i + palm.offset * k * 1.4
        const y = top - i * 0.5 + k * k * droop * 8
        // Thick near the crown, a single pixel at the tip.
        px(x, y, 1, k < 0.6 ? 2 : 1)
      }
    }
    px(crownX - 1, top, 3, 1)
  }
}
