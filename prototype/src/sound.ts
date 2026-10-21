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

// The hover tick fires on every station you pass, so it gets a slight random
// pitch (±4%) to keep fast sweeps from sounding mechanical.
const PITCH_VARIATION: Partial<Record<SoundName, number>> = { hover: 0.04 }

export function playSound(name: SoundName, volume: number) {
  const buffer = buffers.get(name)
  if (!context || !buffer || volume <= 0) return
  const source = context.createBufferSource()
  const gain = context.createGain()
  gain.gain.value = volume
  source.buffer = buffer
  const variation = PITCH_VARIATION[name] ?? 0
  source.playbackRate.value = 1 + (Math.random() * 2 - 1) * variation
  source.connect(gain).connect(context.destination)
  source.start()
}
