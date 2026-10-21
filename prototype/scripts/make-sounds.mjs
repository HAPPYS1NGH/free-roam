// Synthesises the two UI sounds shared by the prototype and the Mac app.
// Everything is generated here from seeded noise, so no game audio is copied.
// Run with `npm run sounds`; output lands in public/sounds/.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SAMPLE_RATE = 44100
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds")

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function onePoleCoefficient(cutoffHz) {
  return 1 - Math.exp((-2 * Math.PI * cutoffHz) / SAMPLE_RATE)
}

function normalise(samples, peak) {
  const max = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0)
  return samples.map((s) => (s / max) * peak)
}

function encodeWav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  buffer.write("WAVE", 8)
  buffer.write("fmt ", 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write("data", 36)
  buffer.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((s, i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2))
  return buffer
}

// Band-limited noise with a fast flutter and random crackle pops, shaped like
// a tuner sweeping between stations.
function makeStatic() {
  const random = seededRandom(2026)
  const length = Math.round(SAMPLE_RATE * 0.42)
  const lowCut = onePoleCoefficient(320)
  const highCut = onePoleCoefficient(3800)
  let low = 0
  let high = 0
  let crackle = 0
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const noise = random() * 2 - 1
    high += highCut * (noise - high)
    low += lowCut * (high - low)
    const band = high - low

    if (random() < 0.0009) crackle = (random() < 0.5 ? -1 : 1) * (0.6 + random() * 0.4)
    crackle *= 0.93

    const flutter = 1 + 0.35 * Math.sin(2 * Math.PI * 13 * t + random() * 0.4)
    const attack = Math.min(1, t / 0.008)
    const decay = t < 0.22 ? 1 : Math.exp(-(t - 0.22) / 0.06)
    samples.push((band * 2.2 * flutter + crackle * 0.5) * attack * decay)
  }
  return normalise(samples, 0.8)
}

// A short, dry click for moving between slots.
function makeTick() {
  const random = seededRandom(7)
  const length = Math.round(SAMPLE_RATE * 0.03)
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const tone = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t / 0.004)
    const burst = t < 0.002 ? (random() * 2 - 1) * 0.5 : 0
    samples.push(tone + burst)
  }
  return normalise(samples, 0.6)
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, "static.wav"), encodeWav(makeStatic()))
writeFileSync(join(outDir, "tick.wav"), encodeWav(makeTick()))
console.log(`Wrote static.wav and tick.wav to ${outDir}`)
