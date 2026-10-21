// Synthesises every sound shared by the prototype and the Mac app.
//
// All audio is generated here from seeded noise, oscillators and filters.
// No game audio (or any recorded audio) is used, sampled or copied, so the
// project owns every file. Output is deterministic: same code, same bytes.
//
// The palette is soft and dark on purpose: these play dozens of times a day,
// so the energy stays mostly below the 2-5 kHz band where ears are most
// sensitive, there are no pure tones above 1.5 kHz, and nothing is driven or
// clipped.
//
//   retune.wav    Muffled car-radio "kssh" between FM stations (main take,
//                 ~400 ms): band-limited hiss with a slow resonant dial sweep
//                 and light multipath flutter, darkening as it fades.
//   retune-b.wav  Alternative take: a short, tight squelch tail (~260 ms).
//   retune-c.wav  Alternative take: warm, low-passed AM-style fade (~500 ms)
//                 with a slow, deeper flutter.
//   open.wav      Low rising breath of air with a soft thump (~140 ms).
//   close.wav     The same falling and shorter (~110 ms).
//   hover.wav     Soft wooden "tok" when the highlight moves (~34 ms), low and
//                 rounded so a fast sweep stays calm.
//
// Run with `npm run sounds`; output lands in public/sounds/ as 16-bit mono
// 44.1 kHz WAV, DC-blocked and faded at both ends. Each sound is normalised
// to its own peak level so the mix is baked in: hover sits under open and
// close, which sit under retune.
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
//   band       highpass and lowpass edges of the hiss (gentle 12 dB/oct)
//   highCut    lowpass that tilts the hiss down, like a car radio's high cut
//              on a weak signal; this is what makes it muffled, not shrill
//   closeTo    output lowpass target in the tail, so the static darkens as it
//              fades, like a receiver's squelch closing on the new station
//   sweep      broad resonant band gliding across the hiss like a moving dial;
//              Q stays low so it colours the noise without ever ringing
//   flutter    slow amplitude wobble, the multipath fading of a weak signal
//   sag        how far the body settles after the onset, so the burst reads
//              as a "kssh" rather than a flat wash of noise
//   duckAt     where the body starts decaying into the tail
const RETUNE_TAKES = {
  retune: {
    seed: 2026,
    duration: 0.4,
    attack: 0.008,
    band: [300, 3500],
    highCut: 2700,
    closeTo: 1200,
    sweep: { from: 2200, to: 800, q: 1.2, mix: 0.9 },
    flutter: [
      { rate: 16, depth: 0.16 },
      { rate: 5, depth: 0.1 },
    ],
    sag: 0.25,
    duckAt: 0.13,
    peakDb: -6,
  },
  "retune-b": {
    seed: 77,
    duration: 0.26,
    attack: 0.004,
    band: [450, 3500],
    highCut: 3000,
    closeTo: 1500,
    sweep: { from: 1900, to: 1150, q: 1, mix: 0.7 },
    flutter: [{ rate: 26, depth: 0.12 }],
    sag: 0,
    duckAt: 0.05,
    peakDb: -5.5,
  },
  "retune-c": {
    seed: 1983,
    duration: 0.5,
    attack: 0.014,
    band: [200, 2600],
    highCut: 1400,
    closeTo: 700,
    sweep: { from: 1300, to: 420, q: 1.5, mix: 1.1 },
    flutter: [
      { rate: 8, depth: 0.26 },
      { rate: 2.5, depth: 0.2 },
    ],
    sag: 0.1,
    duckAt: 0.2,
    peakDb: -6,
  },
}

function makeRetune(take) {
  const random = seededRandom(take.seed)
  const length = Math.round(SAMPLE_RATE * take.duration)
  const tailTau = (take.duration - take.duckAt) / 4
  const highpass = createFilter("highpass")
  const lowpass = createFilter("lowpass")
  const highCut = createFilter("lowpass")
  const dial = createFilter("bandpass")
  const outputLowpass = createFilter("lowpass")
  const flutters = take.flutter.map(({ rate, depth }) => ({ wander: createWander(random, rate), depth }))
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const noise = random() * 2 - 1
    const hiss = lowpass(highpass(noise, take.band[0], 0.6), take.band[1], 0.6)

    const dialHz = take.sweep.from * (take.sweep.to / take.sweep.from) ** (t / take.duration)
    const swept = dial(hiss, dialHz, take.sweep.q) * take.sweep.mix

    let flutter = 1
    for (const { wander, depth } of flutters) flutter *= 1 + depth * wander()

    let mix = highCut(hiss + swept, take.highCut, 0.6) * flutter

    const tail = t < take.duckAt ? 1 : Math.exp(-(t - take.duckAt) / 0.06)
    mix = outputLowpass(mix, take.closeTo + (take.band[1] - take.closeTo) * tail, 0.6)

    const attack = raisedCosine(t / take.attack)
    const body = 1 - take.sag * Math.min(1, t / take.duckAt)
    const duck = t < take.duckAt ? body : body * Math.exp(-(t - take.duckAt) / tailTau)
    samples.push(mix * attack * duck)
  }
  return finish(samples, { peakDb: take.peakDb, fadeInMs: 0.5, fadeOutMs: 40 })
}

// A soft breath of low-mid air rising as the wheel fans out, over a gentle
// low thump. Felt more than heard.
function makeOpen() {
  const random = seededRandom(31)
  const length = Math.round(SAMPLE_RATE * 0.14)
  const air = createFilter("bandpass")
  const outputLowpass = [createFilter("lowpass"), createFilter("lowpass")]
  let thumpPhase = 0
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const centre = 260 * (950 / 260) ** Math.min(1, t / 0.1)
    const swell = raisedCosine(t / 0.045) * (t < 0.045 ? 1 : Math.exp(-(t - 0.045) / 0.035))
    const whoosh = air(random() * 2 - 1, centre, 0.9) * swell
    thumpPhase += (2 * Math.PI * (90 + 50 * Math.exp(-t / 0.03))) / SAMPLE_RATE
    const thump = Math.sin(thumpPhase) * raisedCosine(t / 0.006) * Math.exp(-t / 0.03) * 0.12
    let mix = whoosh + thump
    for (const filter of outputLowpass) mix = filter(mix, 1800, 0.707)
    samples.push(mix)
  }
  return finish(samples, { peakDb: -13, fadeInMs: 0.5, fadeOutMs: 25 })
}

// The open breath falling instead of rising: shorter, darker and quieter.
function makeClose() {
  const random = seededRandom(32)
  const length = Math.round(SAMPLE_RATE * 0.11)
  const air = createFilter("bandpass")
  const outputLowpass = [createFilter("lowpass"), createFilter("lowpass")]
  let thumpPhase = 0
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const centre = 850 * (240 / 850) ** Math.min(1, t / 0.075)
    const swell = raisedCosine(t / 0.015) * (t < 0.015 ? 1 : Math.exp(-(t - 0.015) / 0.028))
    const whoosh = air(random() * 2 - 1, centre, 0.9) * swell
    thumpPhase += (2 * Math.PI * (80 + 40 * Math.exp(-t / 0.025))) / SAMPLE_RATE
    const thump = Math.sin(thumpPhase) * raisedCosine(t / 0.005) * Math.exp(-t / 0.022) * 0.1
    let mix = whoosh + thump
    for (const filter of outputLowpass) mix = filter(mix, 1500, 0.707)
    samples.push(mix)
  }
  return finish(samples, { peakDb: -14, fadeInMs: 0.5, fadeOutMs: 20 })
}

// A soft wooden "tok": a low note that drops slightly in pitch, a quieter
// inharmonic second mode for the wood, and a puff of low-passed noise for the
// felt tip. A 1 ms attack and a 2 kHz output lowpass keep it rounded, so
// thirty of these a second blur into a purr instead of a buzz.
function makeHover() {
  const random = seededRandom(7)
  const length = Math.round(SAMPLE_RATE * 0.034)
  const felt = createFilter("lowpass")
  const outputLowpass = [createFilter("lowpass"), createFilter("lowpass")]
  let bodyPhase = 0
  let modePhase = 0
  const samples = []

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE
    const pitchDrop = Math.exp(-t / 0.003)
    bodyPhase += (2 * Math.PI * (560 + 140 * pitchDrop)) / SAMPLE_RATE
    modePhase += (2 * Math.PI * (1080 + 200 * pitchDrop)) / SAMPLE_RATE
    const attack = raisedCosine(t / 0.001)
    const body = Math.sin(bodyPhase) * Math.exp(-t / 0.005)
    const mode = Math.sin(modePhase) * Math.exp(-t / 0.0025) * 0.3
    const tap = felt(random() * 2 - 1, 1400, 0.7) * Math.exp(-t / 0.0012) * 0.5
    let mix = (body + mode + tap) * attack
    for (const filter of outputLowpass) mix = filter(mix, 2000, 0.707)
    samples.push(mix)
  }
  return finish(samples, { peakDb: -17, fadeInMs: 0.3, fadeOutMs: 8 })
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
