// Synthesises every sound shared by the prototype and the Mac app.
//
// All audio is generated here from seeded noise, oscillators and filters.
// No game audio (or any recorded audio) is used, sampled or copied, so the
// project owns every file. Output is deterministic: same code, same bytes.
//
//   retune.wav    Radio static when tuning to a new station (main take, ~450 ms):
//                 bright FM-dial hiss, one tuning whistle pass, light crackle.
//   retune-b.wav  Alternative take: drier and shorter (~320 ms), a tight squelch.
//   retune-c.wav  Alternative take: warm, crunchy AM-style (~560 ms) with a wider
//                 dial sweep, two whistle passes and a ghost station underneath.
//   open.wav      Soft rising whoosh when the wheel appears (~140 ms).
//   close.wav     Softer falling whoosh when the wheel disappears (~105 ms).
//   hover.wav     Tiny dry tick when the highlight moves between stations (~26 ms).
//
// Run with `npm run sounds`; output lands in public/sounds/ as 16-bit mono
// 44.1 kHz WAV, DC-blocked, faded at both ends and peak-normalised.
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

// RBJ cookbook biquad. Coefficients are recomputed per sample so cutoff and
// centre frequencies can sweep smoothly. Bandpass has 0 dB gain at the centre.
function createFilter(type) {
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  return (x, freq, q) => {
    const w = (2 * Math.PI * Math.min(freq, SAMPLE_RATE * 0.45)) / SAMPLE_RATE
    const cos = Math.cos(w)
    const alpha = Math.sin(w) / (2 * q)
    let b0 = alpha
    let b1 = 0
    let b2 = -alpha
    if (type === "lowpass") {
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = b0
    } else if (type === "highpass") {
      b0 = (1 + cos) / 2
      b1 = -(1 + cos)
      b2 = b0
    }
    const y = (b0 * x + b1 * x1 + b2 * x2 + 2 * cos * y1 - (1 - alpha) * y2) / (1 + alpha)
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    return y
  }
}

// Smoothly interpolated random values in [-1, 1] that change `rateHz` times a
// second. Used for flutter, fading and anything that should drift organically.
function createWander(random, rateHz) {
  let from = random() * 2 - 1
  let to = random() * 2 - 1
  let phase = 0
  return () => {
    phase += rateHz / SAMPLE_RATE
    if (phase >= 1) {
      phase -= 1
      from = to
      to = random() * 2 - 1
    }
    return from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * phase))
  }
}

function raisedCosine(progress) {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, progress)))
}

function normalise(samples, peak) {
  const max = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0)
  return samples.map((s) => (s / max) * peak)
}

// Fade both ends to exactly zero (no clicks when the app starts or cuts a
// sound), remove DC, then normalise to the target peak. Sounds this short are
// over before a DC-blocking filter settles, so the mean is subtracted as a
// Hann-shaped bump instead: the mean becomes zero and the ends stay at zero.
function finish(samples, { peakDb, fadeInMs, fadeOutMs }) {
  const out = [...samples]
  const fadeIn = Math.max(2, Math.round((fadeInMs / 1000) * SAMPLE_RATE))
  const fadeOut = Math.max(2, Math.round((fadeOutMs / 1000) * SAMPLE_RATE))
  for (let i = 0; i < fadeIn; i++) out[i] *= raisedCosine(i / fadeIn)
  for (let i = 0; i < fadeOut; i++) out[out.length - 1 - i] *= raisedCosine(i / fadeOut)

  const hann = out.map((_, i) => Math.sin((Math.PI * i) / (out.length - 1)) ** 2)
  const offset = out.reduce((sum, s) => sum + s, 0) / hann.reduce((sum, w) => sum + w, 0)
  return normalise(
    out.map((s, i) => s - offset * hann[i]),
    10 ** (peakDb / 20),
  )
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

// The three retune takes share one signal chain and differ only in these
// settings, so they stay comparable by ear. Times are seconds, filters Hz.
//   band       highpass and lowpass edges of the hiss
//   closeTo    output lowpass target in the tail, so the static darkens as it
//              ducks, like a receiver's squelch closing on the new station
//   sweep      resonant band gliding across the noise like a moving dial
//   whistles   heterodyne passes: the beat note between dial and a carrier
//              glides down to a low growl and back up (analogue tuning whistle)
//   ghost      a buzzy voice-like fragment of a station the dial passes
//   crush      sample-and-hold plus bit reduction for AM-style grit
const RETUNE_TAKES = {
  retune: {
    seed: 2026,
    duration: 0.45,
    band: [350, 6500],
    closeTo: 1800,
    sweep: { from: 4200, to: 1400, q: 1.3, mix: 1.6 },
    whistles: [{ centre: 0.16, slope: 22000, width: 0.08, level: 0.32 }],
    flutter: [{ rate: 22, depth: 0.3 }],
    crackle: { rate: 30, level: 0.55 },
    pop: 0.9,
    duckAt: 0.25,
    drive: 1.5,
    peakDb: -1.5,
  },
  "retune-b": {
    seed: 77,
    duration: 0.32,
    band: [600, 7500],
    closeTo: 3000,
    sweep: { from: 6000, to: 2600, q: 1.1, mix: 0.6 },
    whistles: [{ centre: 0.045, slope: 60000, width: 0.025, level: 0.2 }],
    flutter: [{ rate: 30, depth: 0.22 }],
    crackle: { rate: 12, level: 0.35 },
    pop: 1.2,
    duckAt: 0.15,
    drive: 1.6,
    peakDb: -1,
  },
  "retune-c": {
    seed: 1983,
    duration: 0.56,
    band: [220, 3200],
    closeTo: 1100,
    sweep: { from: 2600, to: 650, q: 2.2, mix: 1.4 },
    whistles: [
      { centre: 0.12, slope: 14000, width: 0.07, level: 0.34 },
      { centre: 0.36, slope: 16000, width: 0.06, level: 0.26 },
    ],
    ghost: { centre: 0.25, width: 0.08, level: 1.6 },
    flutter: [
      { rate: 14, depth: 0.35 },
      { rate: 4, depth: 0.3 },
    ],
    crackle: { rate: 70, level: 0.8 },
    pop: 0.7,
    duckAt: 0.36,
    drive: 2.6,
    crush: { hold: 3, bits: 7 },
    peakDb: -2,
  },
}

function makeRetune(take) {
  const random = seededRandom(take.seed)
  const length = Math.round(SAMPLE_RATE * take.duration)
  const tailTau = (take.duration - take.duckAt) / 4
  const highpass = createFilter("highpass")
  const lowpass = createFilter("lowpass")
  // Two output lowpasses (24 dB/oct) keep drive, crush, pops and crackle
  // inside the radio band instead of fizzing up to 20 kHz.
  const outputLowpass = [createFilter("lowpass"), createFilter("lowpass")]
  const dial = createFilter("bandpass")
  const formant = createFilter("bandpass")
  const flutters = take.flutter.map(({ rate, depth }) => ({ wander: createWander(random, rate), depth }))
  const whistlePhases = take.whistles.map(() => 0)
  const ghostPitch = createWander(random, 7)
  const ghostFormant = createWander(random, 9)
  const syllable = createWander(random, 11)
  const crushLevels = take.crush ? 2 ** (take.crush.bits - 1) : 0
  let ghostPhase = 0
  let crackle = 0
  let crackleDecay = 0
  let held = 0
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const noise = random() * 2 - 1
    const bright = highpass(noise, take.band[0], 0.707)
    const hiss = lowpass(bright, take.band[1], 0.707)

    const dialHz = take.sweep.from * (take.sweep.to / take.sweep.from) ** (t / take.duration)
    const swept = dial(noise, dialHz, take.sweep.q) * take.sweep.mix * 2

    let flutter = 1
    for (const { wander, depth } of flutters) flutter *= 1 + depth * wander()

    let whistle = 0
    take.whistles.forEach(({ centre, slope, width, level }, w) => {
      const beatHz = Math.min(5000, 180 + slope * Math.abs(t - centre))
      whistlePhases[w] += (2 * Math.PI * beatHz) / SAMPLE_RATE
      whistle += Math.sin(whistlePhases[w]) * level * Math.exp(-(((t - centre) / width) ** 2))
    })

    // Crackle: short noise bursts, denser at the start of the retune.
    const crackleChance = (take.crackle.rate * (1.5 - t / take.duration)) / SAMPLE_RATE
    if (random() < crackleChance) {
      crackle = take.crackle.level * (0.5 + random() * 0.5)
      crackleDecay = Math.exp(-1 / (SAMPLE_RATE * (0.0004 + random() * 0.0015)))
    }
    crackle *= crackleDecay
    const crackleOut = crackle * (random() * 2 - 1)

    let ghost = 0
    if (take.ghost) {
      ghostPhase = (ghostPhase + (140 + 35 * ghostPitch()) / SAMPLE_RATE) % 1
      let buzz = 0
      for (let k = 1; k <= 18; k++) buzz += Math.sin(2 * Math.PI * k * ghostPhase) / k
      const window = Math.exp(-(((t - take.ghost.centre) / take.ghost.width) ** 2))
      const voiced = Math.max(0, syllable()) ** 2
      ghost = formant(buzz, 950 + 450 * ghostFormant(), 5) * voiced * window * take.ghost.level
    }

    const pop = bright * take.pop * Math.exp(-t / 0.006)
    let mix = (hiss * 1.6 + swept) * flutter + whistle + crackleOut + ghost + pop
    mix = Math.tanh(mix * take.drive) / Math.tanh(take.drive)

    if (take.crush) {
      if (i % take.crush.hold === 0) held = Math.round(mix * crushLevels) / crushLevels
      mix = held
    }

    const tail = t < take.duckAt ? 1 : Math.exp(-(t - take.duckAt) / 0.05)
    const outputHz = take.closeTo + (take.band[1] * 1.25 - take.closeTo) * tail
    for (const filter of outputLowpass) mix = filter(mix, outputHz, 0.707)

    const attack = raisedCosine(t / 0.003)
    const duck = t < take.duckAt ? 1 : Math.exp(-(t - take.duckAt) / tailTau)
    samples.push(mix * attack * duck)
  }
  return finish(samples, { peakDb: take.peakDb, fadeInMs: 0.5, fadeOutMs: 20 })
}

// Upward band-passed air with a small low thump and tick, as the wheel fans out.
function makeOpen() {
  const random = seededRandom(31)
  const length = Math.round(SAMPLE_RATE * 0.14)
  const air = createFilter("bandpass")
  let thumpPhase = 0
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const centre = 450 * (2800 / 450) ** Math.min(1, t / 0.09)
    const swell = raisedCosine(t / 0.03) * (t < 0.03 ? 1 : Math.exp(-(t - 0.03) / 0.03))
    const whoosh = air(random() * 2 - 1, centre, 1.6) * 2.5 * swell
    thumpPhase += (2 * Math.PI * (70 + 80 * Math.exp(-t / 0.04))) / SAMPLE_RATE
    const thump = Math.sin(thumpPhase) * raisedCosine(t / 0.003) * Math.exp(-t / 0.02) * 0.5
    const tick = Math.sin(2 * Math.PI * 1600 * t) * Math.exp(-t / 0.002) * 0.25
    samples.push(whoosh + thump + tick)
  }
  return finish(samples, { peakDb: -8, fadeInMs: 0.5, fadeOutMs: 10 })
}

// The open whoosh in reverse direction: faster, darker and quieter.
function makeClose() {
  const random = seededRandom(32)
  const length = Math.round(SAMPLE_RATE * 0.105)
  const air = createFilter("bandpass")
  let thumpPhase = 0
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const centre = 2400 * (380 / 2400) ** Math.min(1, t / 0.07)
    const swell = raisedCosine(t / 0.012) * (t < 0.012 ? 1 : Math.exp(-(t - 0.012) / 0.022))
    const whoosh = air(random() * 2 - 1, centre, 1.6) * 2.5 * swell
    thumpPhase += (2 * Math.PI * (60 + 50 * Math.exp(-t / 0.03))) / SAMPLE_RATE
    const thump = Math.sin(thumpPhase) * raisedCosine(t / 0.003) * Math.exp(-t / 0.015) * 0.3
    samples.push(whoosh + thump)
  }
  return finish(samples, { peakDb: -11, fadeInMs: 0.5, fadeOutMs: 10 })
}

// A soft, short tap: a slightly falling mid note, a faint overtone and a
// sub-millisecond transient. Low pitch and fast decay keep rapid repeats calm.
function makeHover() {
  const random = seededRandom(7)
  const length = Math.round(SAMPLE_RATE * 0.026)
  const click = createFilter("bandpass")
  let phase = 0
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    phase += (2 * Math.PI * (1250 + 250 * Math.exp(-t / 0.004))) / SAMPLE_RATE
    const body = Math.sin(phase) * Math.exp(-t / 0.0035)
    const overtone = Math.sin(2 * Math.PI * 2950 * t) * Math.exp(-t / 0.0015) * 0.35
    const transient = click(random() * 2 - 1, 3800, 0.9) * raisedCosine(t / 0.0004) * Math.exp(-t / 0.0006) * 1.8
    samples.push(body + overtone + transient)
  }
  return finish(samples, { peakDb: -10, fadeInMs: 0.3, fadeOutMs: 4 })
}

const sounds = {
  open: encodeWav(makeOpen()),
  close: encodeWav(makeClose()),
  hover: encodeWav(makeHover()),
}
for (const [name, take] of Object.entries(RETUNE_TAKES)) sounds[name] = encodeWav(makeRetune(take))

mkdirSync(outDir, { recursive: true })
for (const [name, wav] of Object.entries(sounds)) writeFileSync(join(outDir, `${name}.wav`), wav)
console.log(`Wrote ${Object.keys(sounds).map((name) => `${name}.wav`).join(", ")} to ${outDir}`)
