type SoundName = "static" | "tick"

let context: AudioContext | null = null
const buffers = new Map<SoundName, AudioBuffer>()

async function load(audio: AudioContext, name: SoundName) {
  const response = await fetch(`/sounds/${name}.wav`)
  if (!response.ok) throw new Error(`Missing /sounds/${name}.wav (run npm run sounds)`)
  buffers.set(name, await audio.decodeAudioData(await response.arrayBuffer()))
}

// Browsers only allow audio after a user gesture, so this runs on the first
// keypress rather than on page load.
export async function unlockAudio() {
  if (!context) {
    context = new AudioContext()
    await Promise.all([load(context, "static"), load(context, "tick")])
  }
  if (context.state === "suspended") await context.resume()
}

export function playSound(name: SoundName, volume: number) {
  const buffer = buffers.get(name)
  if (!context || !buffer || volume <= 0) return
  const source = context.createBufferSource()
  const gain = context.createGain()
  gain.gain.value = volume
  source.buffer = buffer
  source.connect(gain).connect(context.destination)
  source.start()
}
