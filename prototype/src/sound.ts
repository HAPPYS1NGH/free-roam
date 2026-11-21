export type SoundName = "open" | "close" | "hover" | "retune"

const SOUND_NAMES: SoundName[] = ["open", "close", "hover", "retune"]

const buffers = new Map<SoundName, AudioBuffer>()
let context: AudioContext | null = null
let preloading: Promise<void> | null = null

export type SoundUrls = Record<SoundName, string>

// The site publishes assets/sounds/, the files the Mac app bundles, here.
const PUBLISHED: SoundUrls = { open: "/sounds/open.wav", close: "/sounds/close.wav", hover: "/sounds/hover.wav", retune: "/sounds/retune.wav" }

// Decodes with an offline context, which browsers allow before any user
// gesture, so the very first open already has its sound. Rejects if one can't
// load, and a later call tries again.
export function preloadSounds(urls: SoundUrls = PUBLISHED): Promise<void> {
  if (preloading) return preloading
  const decoder = new OfflineAudioContext(1, 1, 44100)
  preloading = Promise.all(SOUND_NAMES.map(async name => {
    const response = await fetch(urls[name])
    // Vite answers unknown paths with index.html, so check what came back.
    if (!response.ok || !response.headers.get("content-type")?.includes("audio")) throw new Error(`Sound unavailable: ${name}`)
    buffers.set(name, await decoder.decodeAudioData(await response.arrayBuffer()))
  })).then(() => undefined).catch(error => {
    preloading = null
    throw error
  })
  return preloading
}

// Browsers only start audio inside a user gesture, so this runs on keydown.
export function unlockAudio() {
  context ??= new AudioContext({ sampleRate: 44100 })
  if (context.state === "suspended") {
    context.resume().catch((error) => console.warn("Audio could not start:", error))
  }
}

// Volumes are in dB so the quiet end, where these sounds live, gets most of
// the slider. At SILENT_DB a sound is off.
export const SILENT_DB = -60

// The hover tick works like the iPod click wheel or the Digital Crown: every
// station the highlight passes gets its own tick, on the same event that
// moves the highlight, so sound and picture never drift apart. Speed changes
// the tick instead of skipping it. Each tick adds 1 to a busyness that decays
// with HOVER_BUSY_DECAY_MS, so it's 1 after a rest, ~1.6 at 10 stations a
// second and ~3.5 at 30. A tick's gain falls with its square root, which
// keeps a sweep about as loud as a single tick, and its low-pass cutoff falls
// with it. It's also cut off just before the next tick is due, so ticks
// never overlap and comb into a buzz. One step sounds full and bright, and a
// fast sweep becomes a soft, dark purr.
const HOVER_BUSY_DECAY_MS = 100
// Ticks this close together come from one input event; one is enough.
const HOVER_MIN_GAP_MS = 8
const HOVER_BRIGHT_HZ = 9000
const HOVER_FADE_S = 0.006
let lastHoverAt = -Infinity
let hoverBusyness = 0

function playHover(audio: AudioContext, buffer: AudioBuffer, level: number) {
  const now = performance.now()
  const elapsed = now - lastHoverAt
  if (elapsed < HOVER_MIN_GAP_MS) return
  lastHoverAt = now
  hoverBusyness = hoverBusyness * Math.exp(-elapsed / HOVER_BUSY_DECAY_MS) + 1

  const source = audio.createBufferSource()
  const filter = audio.createBiquadFilter()
  const gain = audio.createGain()
  source.buffer = buffer
  filter.frequency.value = HOVER_BRIGHT_HZ / hoverBusyness
  const tickGain = level / Math.sqrt(hoverBusyness)
  source.connect(filter).connect(gain).connect(audio.destination)

  // Expect the next tick as soon after this one as this one came after the last.
  const start = audio.currentTime
  const end = start + Math.min(buffer.duration, (elapsed / 1000) * 0.8)
  gain.gain.setValueAtTime(tickGain, start)
  gain.gain.setValueAtTime(tickGain, Math.max(start, end - HOVER_FADE_S))
  gain.gain.linearRampToValueAtTime(0, end)
  source.start(start)
  source.stop(end)
}

// Only one retune plays at a time: a new one fades out the last over a few
// milliseconds (a ramp, not a cut, so it doesn't click) instead of stacking.
const RETUNE_FADE_S = 0.012
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

export function playSound(name: SoundName, volumeDb: number) {
  if (!context || volumeDb <= SILENT_DB) return
  const buffer = buffers.get(name)
  if (!buffer) {
    // Keep the first gesture audible even on a cold cache or slow connection.
    if (preloading) {
      void preloading.then(() => {
        if (buffers.has(name)) playSound(name, volumeDb)
      }).catch(error => console.warn("Sounds unavailable:", error))
    }
    return
  }
  const level = 10 ** (volumeDb / 20)
  if (name === "hover") {
    playHover(context, buffer, level)
    return
  }
  const isRetune = name === "retune"
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
