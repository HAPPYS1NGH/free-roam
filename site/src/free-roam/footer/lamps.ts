// The streetlights: each one strikes up for the link above it (a sodium tube
// catching, with moths drawn to it) and breaks when you hit its head: a flash,
// sparks, glass on the road, a dying stutter, dark, then a slow red-to-amber
// warm-up back to normal.

type Px = (x: number, y: number, w?: number, h?: number) => void
type Bit = { x: number; y: number; vx: number; vy: number; born: number; life: number; glass: boolean; rest: boolean; floor: number }

export type Lamp = { x: number; glow: number; struck: number; brokenAt: number | null; moths: number[] }

// Rows: the arm runs along 11, the head hangs at 12–13, the post stands on the verge.
const ARM = 11
const HEAD = 12
const ROAD_TOP = 35
const ROAD_BOTTOM = 52
const VERGE = 53
const BREAK_MS = 5000
const WARM_MS = 1400
const GRAVITY = 180

const SILHOUETTE = "oklch(0.075 0.01 255)"
const DEAD_GLASS = "oklch(0.32 0.012 250)"
const WARM_RED = "oklch(0.55 0.17 30)"
const SPARK = "oklch(0.96 0.12 95)"
const SHARD = "oklch(0.82 0.03 220)"
const MOTH = "oklch(0.85 0.03 90)"

export const createLamp = (x: number): Lamp => ({ x, glow: 0, struck: -Infinity, brokenAt: null, moths: [Math.random() * 6, Math.random() * 6, Math.random() * 6] })

const headOf = (lamp: Lamp) => lamp.x + 6

// Is a scene pixel on a lamp's head (generous, so a fingertip lands)?
export const lampAt = (lamps: Lamp[], x: number, y: number) =>
  lamps.find(lamp => x >= lamp.x - 1 && x <= lamp.x + 11 && y >= ARM - 6 && y <= HEAD + 6) ?? null

// "break" when the glass goes, "fizz" for a dead lamp, null mid-break.
export function breakLamp(lamp: Lamp, bits: Bit[], now: number): "break" | "fizz" | null {
  if (lamp.brokenAt !== null && now - lamp.brokenAt > 900) {
    burst(bits, headOf(lamp), HEAD + 1, now, 4, false)
    return "fizz"
  }
  if (lamp.brokenAt !== null) return null
  lamp.brokenAt = now
  burst(bits, headOf(lamp), HEAD + 1, now, 22, false)
  burst(bits, headOf(lamp), HEAD + 1, now, 7, true)
  return "break"
}

function burst(bits: Bit[], x: number, y: number, now: number, count: number, glass: boolean) {
  for (let i = 0; i < count; i++) {
    bits.push({
      x: x + Math.random() * 3 - 1.5,
      y,
      vx: (Math.random() - 0.5) * (glass ? 34 : 130),
      vy: glass ? Math.random() * 10 : -25 - Math.random() * 60,
      born: now,
      life: glass ? BREAK_MS - 400 : 450 + Math.random() * 650,
      glass,
      rest: false,
      // Glass lands somewhere across the road; sparks die on the verge.
      floor: glass ? ROAD_TOP + 5 + Math.random() * 12 : VERGE,
    })
  }
}

// How much light the lamp gives right now, 0 to 1 (a touch over 1 for the pop's flash).
export function power(lamp: Lamp, now: number) {
  if (lamp.brokenAt === null) return 1
  const t = now - lamp.brokenAt
  if (t < 70) return 2.2
  if (t < 900) {
    // A stutter that gives out: on less often, and dimmer, as it dies.
    const on = noise(Math.floor(t / 40) + lamp.x) > 0.35 + t / 1400
    return on ? 0.9 * (1 - t / 900) : 0
  }
  if (t < BREAK_MS) return 0
  const k = (t - BREAK_MS) / WARM_MS
  if (k < 0.18) return Math.floor(t / 55) % 2 ? 0.25 : 0
  return Math.min(1, k)
}

// While warming up the tube glows red before it settles into amber.
const tint = (lamp: Lamp, now: number, sodium: string) =>
  lamp.brokenAt !== null && now - lamp.brokenAt > BREAK_MS && now - lamp.brokenAt < BREAK_MS + WARM_MS * 0.55 ? WARM_RED : sodium

// The strike when a link lights it: on, off, on, a dip, then steady.
function strike(lamp: Lamp, now: number) {
  const t = now - lamp.struck
  if (t > 260) return 1
  return [1, 0.15, 1, 0.45, 1][Math.floor(t / 52)] ?? 1
}

export function stepLamps(lamps: Lamp[], lit: number | null, bits: Bit[], now: number, dt: number) {
  lamps.forEach((lamp, i) => {
    const target = i === lit && lamp.brokenAt === null ? 1 : 0
    if (target && lamp.glow < 0.05 && now - lamp.struck > 400) lamp.struck = now
    // Up fast (≈120ms), down slower, like a sodium tube cooling.
    lamp.glow += (target - lamp.glow) * (1 - Math.exp(-dt * (target ? 26 : 8)))
    if (lamp.brokenAt !== null && now - lamp.brokenAt > BREAK_MS + WARM_MS) lamp.brokenAt = null
  })
  for (const bit of bits) {
    if (bit.rest) continue
    bit.vy += GRAVITY * dt
    bit.x += bit.vx * dt
    bit.y += bit.vy * dt
    // Glass skitters to a stop on the road; sparks die where they fall.
    if (bit.y >= bit.floor) {
      bit.y = bit.floor
      if (bit.glass && Math.abs(bit.vy) > 18) { bit.vy *= -0.3; bit.vx *= 0.5 } else { bit.rest = true; bit.vx = 0; bit.vy = 0 }
    }
  }
  for (let i = bits.length - 1; i >= 0; i--) if (now - bits[i].born > bits[i].life) bits.splice(i, 1)
}

// Reduced motion: no strike, no stutter, just the end state.
export function settleLamps(lamps: Lamp[], lit: number | null) {
  lamps.forEach((lamp, i) => { lamp.glow = i === lit && lamp.brokenAt === null ? 1 : 0 })
}

// Pools on the asphalt and the cone under a lit head. Drawn before the cars.
export function drawPools(context: CanvasRenderingContext2D, lamps: Lamp[], now: number, sodium: string, px: Px) {
  for (const lamp of lamps) {
    const on = Math.min(1, power(lamp, now))
    const glow = lamp.glow * strike(lamp, now)
    if (on <= 0) continue
    const head = headOf(lamp) + 1
    context.fillStyle = tint(lamp, now, sodium)
    for (let y = ROAD_TOP; y < ROAD_BOTTOM + 3; y++) {
      const spread = (6 + (y - ROAD_TOP) * 0.7) * (1 + glow * 0.45)
      context.globalAlpha = (0.05 + 0.13 * ((y - ROAD_TOP) / (ROAD_BOTTOM - ROAD_TOP))) * (1 + glow * 1.9) * on
      px(head - spread, y, spread * 2, 1)
    }
    // The beam itself, hanging in the air under the head.
    for (let y = HEAD + 2; y < ROAD_TOP; y++) {
      const spread = 1 + (y - HEAD - 2) * 0.34 * (1 + glow * 0.3)
      context.globalAlpha = (0.035 + glow * 0.11 * (1 - (y - HEAD) / (ROAD_TOP - HEAD) * 0.5)) * on
      px(head - spread, y, spread * 2, 1)
    }
  }
  context.globalAlpha = 1
}

// Posts, heads, halos, moths and the bits from a break. Drawn over the road.
export function drawLamps(context: CanvasRenderingContext2D, lamps: Lamp[], bits: Bit[], now: number, sodium: string, ground: number, px: Px) {
  for (const lamp of lamps) {
    const on = power(lamp, now)
    const glow = lamp.glow * strike(lamp, now)
    const head = headOf(lamp)
    context.fillStyle = SILHOUETTE
    px(lamp.x, HEAD, 1, ground - HEAD)
    px(lamp.x, ARM, 7, 1)
    // The housing, then the glass under it: dead grey when the lamp is out.
    context.fillStyle = on > 0 ? tint(lamp, now, sodium) : DEAD_GLASS
    px(lamp.x + 5, HEAD, 3, 1)
    context.globalAlpha = on > 0 ? Math.min(1, (0.35 + glow * 0.55) * on) : 0.6
    px(lamp.x + 4, HEAD + 1, 5, 1)
    context.globalAlpha = 1

    // A stepped halo while it's lit for a link, and a white one for the pop.
    const halo = Math.max(glow * Math.min(1, on), on > 1 ? 1.4 : 0)
    if (halo > 0.02) {
      context.fillStyle = on > 1 ? SPARK : tint(lamp, now, sodium)
      context.globalAlpha = halo * 0.1
      for (const [dy, half] of [[-5, 2], [-4, 4], [-3, 5], [-2, 6], [-1, 7], [0, 7], [1, 7], [2, 6], [3, 5], [4, 4], [5, 2]]) px(head - half, HEAD + dy, half * 2 + 1, 1)
      context.globalAlpha = halo * 0.2
      for (const [dy, half] of [[-2, 1], [-1, 3], [0, 3], [1, 3], [2, 1]]) px(head - half, HEAD + dy, half * 2 + 1, 1)
      context.globalAlpha = 1
    }

    // Moths come to a lit head and wander off when it dims.
    if (glow > 0.15 && on > 0) {
      context.fillStyle = MOTH
      lamp.moths.forEach((phase, i) => {
        const a = now / (240 + i * 70) + phase
        const r = 3 + i * 1.5 + Math.sin(now / 300 + phase) * 1.2
        context.globalAlpha = Math.min(1, (glow - 0.15) * 2) * (0.55 + 0.45 * Math.sin(now / 90 + i))
        px(head + Math.cos(a) * r, HEAD + 1 + Math.sin(a * 1.3) * r * 0.6)
      })
      context.globalAlpha = 1
    }
  }

  for (const bit of bits) {
    const age = (now - bit.born) / bit.life
    context.fillStyle = bit.glass ? SHARD : age < 0.4 ? SPARK : sodium
    context.globalAlpha = bit.glass ? (age > 0.85 ? (1 - age) / 0.15 : 0.8) : 1 - age
    px(bit.x, bit.y)
  }
  context.globalAlpha = 1
}

export type { Bit }

const noise = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
