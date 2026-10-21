export const RETUNE_TAKES = ["retune", "retune-b", "retune-c"] as const

export type SoundName = "open" | "close" | "hover" | (typeof RETUNE_TAKES)[number]

const SOUND_NAMES: SoundName[] = ["open", "close", "hover", ...RETUNE_TAKES]

const buffers = new Map<SoundName, AudioBuffer>()
let context: AudioContext | null = null
let preloading: Promise<void> | null = null

async function load(decoder: BaseAudioContext, name: SoundName) {
  const response = await fetch(`/sounds/${name}.wav`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  buffers.set(name, await decoder.decodeAudioData(await response.arrayBuffer()))
}

// Decodes with an offline context, which browsers allow before any user
// gesture, so the very first open already has its sound ready.
export function preloadSounds() {
  if (preloading) return preloading
  const decoder = new OfflineAudioContext(1, 1, 44100)
  preloading = Promise.allSettled(SOUND_NAMES.map((name) => load(decoder, name))).then((results) => {
    results.forEach((result, i) => {
      if (result.status === "rejected") console.warn(`Sound "${SOUND_NAMES[i]}" unavailable (run npm run sounds):`, result.reason)
    })
  })
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

export function playSound(name: SoundName, volume: number) {
  const buffer = buffers.get(name)
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
