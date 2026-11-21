// Deterministic noise so both copies of the looping world line up exactly.

export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(x: number, y: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)

// Value noise in [-1, 1]. With a period, the x lattice wraps every `period`
// cells, which is what makes the road loop seamless.
export function noise2(x: number, y: number, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const u = fade(x - xi), v = fade(y - yi)
  const wrap = (i: number) => (period ? ((i % period) + period) % period : i)
  const a = hash(wrap(xi), yi), b = hash(wrap(xi + 1), yi)
  const c = hash(wrap(xi), yi + 1), d = hash(wrap(xi + 1), yi + 1)
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1
}

export function fbm(x: number, y: number, octaves: number, period = 0) {
  let sum = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, y * f + i * 17.3, period ? period * f : 0)
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return sum / norm
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
