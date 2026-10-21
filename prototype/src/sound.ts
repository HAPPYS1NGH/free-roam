export const RETUNE_TAKES = ["retune", "retune-b", "retune-c"] as const

export type SoundName = "open" | "close" | "hover" | (typeof RETUNE_TAKES)[number]

const SOUND_NAMES: SoundName[] = ["open", "close", "hover", ...RETUNE_TAKES]

// "Local" plays WAVs from public/sounds/local/, a gitignored folder for
// sounds that can't be committed. Any sound missing there falls back to the
// synthesised one.
export const SOUND_PACKS = ["Local", "Synth"] as const
export type SoundPack = (typeof SOUND_PACKS)[number]

const synthBuffers = new Map<SoundName, AudioBuffer>()
const localBuffers = new Map<SoundName, AudioBuffer>()
let context: AudioContext | null = null
let preloading: Promise<number> | null = null

// Resolves to null when the file doesn't exist; rejects if it can't be decoded.
async function load(decoder: BaseAudioContext, url: string) {
  const response = await fetch(url)
  // Vite answers unknown paths with index.html, so check what came back.
  if (!response.ok || !response.headers.get("content-type")?.includes("audio")) return null
  return decoder.decodeAudioData(await response.arrayBuffer())
}

function loadInto(decoder: BaseAudioContext, buffers: Map<SoundName, AudioBuffer>, folder: string, name: SoundName) {
  const url = `${folder}/${name}.wav`
  return load(decoder, url).then(
    (buffer) => {
      if (buffer) buffers.set(name, buffer)
      // Most setups have no local pack, so only a missing synthesised sound is worth a warning.
      else if (buffers === synthBuffers) console.warn(`Sound "${name}" missing (run npm run sounds)`)
    },
    (error) => console.warn(`Sound ${url} could not be decoded:`, error),
  )
}

// Decodes with an offline context, which browsers allow before any user
// gesture, so the very first open already has its sound ready. Resolves to
// the number of local sounds found.
export function preloadSounds() {
  if (preloading) return preloading
  const decoder = new OfflineAudioContext(1, 1, 44100)
  preloading = Promise.all([
    ...SOUND_NAMES.map((name) => loadInto(decoder, synthBuffers, "/sounds", name)),
    ...SOUND_NAMES.map((name) => loadInto(decoder, localBuffers, "/sounds/local", name)),
  ]).then(() => localBuffers.size)
  return preloading
}

// Browsers only start audio inside a user gesture, so this runs on keydown.
export function unlockAudio() {
  context ??= new AudioContext()
  if (context.state === "suspended") {
    context.resume().catch((error) => console.warn("Audio could not start:", error))
  }
}

// The hover tick fires on every station the highlight passes, up to about 30
// a second in a fast sweep. Ticks closer together than HOVER_MIN_GAP_MS are
// dropped, and each tick that plays is scaled by 1 / busyness, where every
// tick adds 1 to a busyness that decays with HOVER_BUSY_DECAY_MS. A 30/s
// sweep plays about every other tick at around half gain, a soft purr only a
// few dB louder overall than one tick, and after ~400 ms of rest the next tick
// is back to full volume.
const HOVER_MIN_GAP_MS = 35
const HOVER_BUSY_DECAY_MS = 100
let lastHoverAt = -Infinity
let hoverBusyness = 0

function hoverGain(now: number) {
  const elapsed = now - lastHoverAt
  if (elapsed < HOVER_MIN_GAP_MS) return 0
  hoverBusyness = hoverBusyness * Math.exp(-elapsed / HOVER_BUSY_DECAY_MS) + 1
  lastHoverAt = now
  return 1 / hoverBusyness
}

// Only one retune plays at a time: a new one fades out the last over a few
// milliseconds (a ramp, not a cut, so it doesn't click) instead of stacking.
const RETUNE_FADE_S = 0.012
const retuneNames = new Set<SoundName>(RETUNE_TAKES)
let activeRetune: { source: AudioBufferSourceNode; gain: GainNode } | null = null

function fadeOutRetune(audio: AudioContext) {
  if (!activeRetune) return
  const { source, gain } = activeRetune
  const now = audio.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(0, now + RETUNE_FADE_S)
  source.stop(now + RETUNE_FADE_S)
  activeRetune = null
}

export function playSound(name: SoundName, volume: number, pack: SoundPack = "Synth") {
  const buffer = (pack === "Local" ? localBuffers.get(name) : undefined) ?? synthBuffers.get(name)
  if (!context || !buffer || volume <= 0) return
  const level = name === "hover" ? volume * hoverGain(performance.now()) : volume
  if (level <= 0) return
  const isRetune = retuneNames.has(name)
  if (isRetune) fadeOutRetune(context)

  const source = context.createBufferSource()
  const gain = context.createGain()
  gain.gain.value = level
  source.buffer = buffer
  source.connect(gain).connect(context.destination)
  source.start()
  if (!isRetune) return

  const playing = { source, gain }
  activeRetune = playing
  source.onended = () => {
    if (activeRetune === playing) activeRetune = null
  }
}
