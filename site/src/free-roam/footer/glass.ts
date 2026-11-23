import { liveAudio, SILENT_DB } from "../../sound"

// The breaking lamp, synthesised so the page ships no extra file: a pop as
// the tube goes, a hiss of glass, an electrical zap, then shards tinkling on
// the road for about half a second. "fizz" is the short crackle of a lamp
// that's already dead. Plays at the page's UI volume, so the sound toggle
// silences it.
export function playGlassBreak(kind: "break" | "fizz", volumeDb: number) {
  if (volumeDb <= SILENT_DB) return
  const audio = liveAudio()
  if (!audio) return
  const level = 10 ** ((volumeDb - 6) / 20)
  const start = audio.currentTime + 0.005
  const out = audio.createGain()
  out.gain.value = level
  out.connect(audio.destination)

  if (kind === "fizz") {
    crackle(audio, out, start, 0.12, 0.35)
    return
  }
  noiseBurst(audio, out, start, { duration: 0.03, peak: 0.9, filter: "bandpass", hz: 2400, q: 0.8 })
  noiseBurst(audio, out, start + 0.004, { duration: 0.32, peak: 0.5, filter: "highpass", hz: 3200, q: 0.7 })
  zap(audio, out, start, 0.09)
  crackle(audio, out, start + 0.06, 0.5, 0.18)
  // Shards landing: a scatter of short bright pings, thinning and quieter.
  for (let i = 0; i < 9; i++) {
    const at = start + 0.05 + i * 0.045 + Math.random() * 0.04
    ping(audio, out, at, 3200 + Math.random() * 4200, 0.22 * (1 - i / 11))
  }
  window.setTimeout(() => out.disconnect(), 1500)
}

let noise: AudioBuffer | null = null
const noiseBuffer = (audio: AudioContext) => {
  if (noise && noise.sampleRate === audio.sampleRate) return noise
  noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

function noiseBurst(audio: AudioContext, out: AudioNode, at: number, { duration, peak, filter, hz, q }: { duration: number; peak: number; filter: BiquadFilterType; hz: number; q: number }) {
  const source = audio.createBufferSource()
  source.buffer = noiseBuffer(audio)
  const shape = audio.createBiquadFilter()
  shape.type = filter
  shape.frequency.value = hz
  shape.Q.value = q
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
  source.connect(shape).connect(gain).connect(out)
  source.start(at, Math.random() * 0.5)
  source.stop(at + duration + 0.02)
}

function ping(audio: AudioContext, out: AudioNode, at: number, hz: number, peak: number) {
  const tone = audio.createOscillator()
  tone.type = "sine"
  tone.frequency.setValueAtTime(hz, at)
  tone.frequency.exponentialRampToValueAtTime(hz * 0.97, at + 0.08)
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.06 + Math.random() * 0.06)
  tone.connect(gain).connect(out)
  tone.start(at)
  tone.stop(at + 0.14)
}

// The tube shorting: a buzzy low tone that drops away.
function zap(audio: AudioContext, out: AudioNode, at: number, duration: number) {
  const tone = audio.createOscillator()
  tone.type = "sawtooth"
  tone.frequency.setValueAtTime(220, at)
  tone.frequency.exponentialRampToValueAtTime(70, at + duration)
  const shape = audio.createBiquadFilter()
  shape.type = "lowpass"
  shape.frequency.value = 1800
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.25, at)
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
  tone.connect(shape).connect(gain).connect(out)
  tone.start(at)
  tone.stop(at + duration + 0.02)
}

// Sparks: tiny clicks at random moments.
function crackle(audio: AudioContext, out: AudioNode, at: number, span: number, peak: number) {
  const clicks = Math.round(span * 40)
  for (let i = 0; i < clicks; i++) {
    noiseBurst(audio, out, at + Math.random() * span, { duration: 0.008, peak: peak * (0.4 + Math.random() * 0.6), filter: "bandpass", hz: 5000, q: 1.2 })
  }
}
