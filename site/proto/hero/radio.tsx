// Shared materials for every hero variant. Throwaway: nothing in src/ imports this.
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import tokens from "../../tokens.json"
import { onAir, useNow } from "../../src/broadcast"
import { useWheel } from "../../src/useWheel"
import { useScreenHeight } from "../../src/useViewport"
import type { Slot } from "../../src/stations"
import { WheelOverlay } from "../../src/free-roam/WheelOverlay"
import { demoSlots, catalogSources } from "../../src/free-roam/demo-stations"
import { useProductAudio } from "../../src/free-roam/useProductAudio"
import { downloadUrl, sourceUrl } from "../../src/free-roam/content"

export { demoSlots, onAir, useNow }
export type { Slot }

// ---------------------------------------------------------------- harness fx

export type TimeOfDay = "dawn" | "day" | "dusk" | "night"
export type Fx = {
  palette: "Sodium" | "Lime"
  stationColour: boolean
  staticOn: boolean
  staticMs: number
  staticAmount: number
  intro: boolean
  time: "Auto" | "Dawn" | "Day" | "Dusk" | "Night"
  speed: number
}
export const FxContext = createContext<Fx>({
  palette: "Sodium", stationColour: true, staticOn: true, staticMs: 260, staticAmount: 0.55, intro: true, time: "Auto", speed: 1,
})
export const useFx = () => useContext(FxContext)

// ---------------------------------------------------------------- radio state

type RadioState = {
  wheel: ReturnType<typeof useWheel>
  audio: ReturnType<typeof useProductAudio>
  playing: Extract<Slot, { kind: "playlist" }> | undefined
  playingIndex: number
  source: (typeof catalogSources)[number] | undefined
  // Bumps on every retune, so variants can key one-shot effects off it.
  retunes: number
  // Average colour of the playing station's cover, as rgb(), or null for Radio Off.
  stationRgb: string | null
}
const RadioContext = createContext<RadioState | null>(null)
export const useRadio = () => {
  const radio = useContext(RadioContext)
  if (!radio) throw new Error("useRadio outside RadioProvider")
  return radio
}

export function RadioProvider({ children }: { children: ReactNode }) {
  const audio = useProductAudio()
  const wheel = useWheel({
    slots: demoSlots,
    deadzone: tokens.behaviour.deadzone * useScreenHeight() / 100,
    pickRadius: tokens.behaviour.pickRadius,
    scrollStep: tokens.behaviour.scrollStep,
    dwellMs: tokens.behaviour.dwellMs,
    holdDelayMs: tokens.behaviour.holdDelayMs,
    keepOpen: false,
    withOption: true,
    ignoreSelector: ".dialkit-root, .proto-picker",
    sounds: audio.sounds,
  })
  const playingIndex = demoSlots.findIndex(slot => slot.id === (wheel.playingId ?? "off"))
  const slot = demoSlots[playingIndex]
  const playing = slot?.kind === "playlist" ? slot : undefined
  const source = catalogSources.find(album => album.id === wheel.playingId)
  const stationRgb = useCoverColour(playing?.playlist.covers[0])

  const [retunes, setRetunes] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setRetunes(n => n + 1)
  }, [wheel.playingId])

  // Focus goes back to whatever opened the wheel.
  const opener = useRef<Element | null>(null)
  useEffect(() => {
    if (wheel.open) { opener.current = document.activeElement; return }
    const lost = document.activeElement === document.body || document.querySelector(".wheel-layer")?.contains(document.activeElement)
    if (lost && opener.current instanceof HTMLElement) opener.current.focus({ preventScroll: true })
  }, [wheel.open])

  return <RadioContext.Provider value={{ wheel, audio, playing, playingIndex, source, retunes, stationRgb }}>
    {children}
    <WheelOverlay open={wheel.open} highlighted={wheel.highlighted} onChoose={wheel.choose} onClose={wheel.hide} />
  </RadioContext.Provider>
}

// The cover's average colour, weighted toward saturated pixels so a mostly
// black cover with an orange sun reads as orange. Cached per URL.
const colourCache = new Map<string, string>()
function useCoverColour(url: string | undefined) {
  const [rgb, setRgb] = useState<string | null>(url ? colourCache.get(url) ?? null : null)
  useEffect(() => {
    if (!url) { setRgb(null); return }
    const cached = colourCache.get(url)
    if (cached) { setRgb(cached); return }
    let live = true
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 24
      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (!context) return
      context.drawImage(image, 0, 0, 24, 24)
      const pixels = context.getImageData(0, 0, 24, 24).data
      let r = 0, g = 0, b = 0, total = 0
      for (let i = 0; i < pixels.length; i += 4) {
        const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2])
        const min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2])
        const weight = 0.05 + (max - min) / 255
        r += pixels[i] * weight; g += pixels[i + 1] * weight; b += pixels[i + 2] * weight; total += weight
      }
      const value = `rgb(${Math.round(r / total)} ${Math.round(g / total)} ${Math.round(b / total)})`
      colourCache.set(url, value)
      if (live) setRgb(value)
    }
    image.onerror = () => console.warn("Cover colour unavailable:", url)
    image.src = url
    return () => { live = false }
  }, [url])
  return rgb
}

// CSS vars every variant root should spread: the palette plus the station accent.
// --accent is the station colour pushed to a readable lightness on dark
// (relative colour syntax keeps its hue), or the palette accent for Radio Off.
export function usePageStyle(): CSSProperties {
  const fx = useFx()
  const { stationRgb } = useRadio()
  return {
    ...(fx.stationColour && stationRgb ? { "--station": stationRgb } : {}),
  } as CSSProperties
}
export function pageAttrs(fx: Fx) {
  return { "data-palette": fx.palette.toLowerCase(), "data-station-colour": fx.stationColour ? "" : undefined }
}

// ---------------------------------------------------------------- time of day

export function useTimeOfDay(): TimeOfDay {
  const { time } = useFx()
  const [hour, setHour] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setHour(new Date().getHours())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])
  if (time !== "Auto") return time.toLowerCase() as TimeOfDay
  if (hour === null) return "dusk"
  if (hour >= 5 && hour < 8) return "dawn"
  if (hour >= 8 && hour < 17) return "day"
  if (hour >= 17 && hour < 20) return "dusk"
  return "night"
}

// Codex-generated scenes; the current coast photo stands in until they land.
export const SCENES: Record<TimeOfDay, string> = {
  dawn: "/proto/hero/assets/coast-dawn.jpg",
  day: "/proto/hero/assets/coast-day.jpg",
  dusk: "/proto/hero/assets/coast-dusk.jpg",
  night: "/proto/hero/assets/coast-night.jpg",
}
export const EXTRA_SCENES = {
  road: "/proto/hero/assets/night-road.jpg",
  dash: "/proto/hero/assets/dash-night.jpg",
}
export const FALLBACK_SCENE = "/free-roam/coast.jpg"

export function SceneImage({ src, alt, className, priority }: { src: string; alt: string; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return <img className={className} src={failed ? FALLBACK_SCENE : src} alt={alt} width="1672" height="941"
    fetchPriority={priority ? "high" : undefined} onError={() => setFailed(true)} />
}

// ---------------------------------------------------------------- static burst

// A short burst of real noise when the station changes, like a tuner crossing
// dead air. Drawn at low resolution and scaled up, so it's cheap. Fires only on
// retune (user input), never on load.
export function StaticBurst({ className = "" }: { className?: string }) {
  const { retunes } = useRadio()
  const fx = useFx()
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (retunes === 0 || !fx.staticOn) return
    const element = canvas.current
    const context = element?.getContext("2d")
    if (!element || !context) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const duration = fx.staticMs / fx.speed
    const image = context.createImageData(element.width, element.height)
    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const t = (now - start) / duration
      if (t >= 1) { element.style.opacity = "0"; return }
      // Reduced motion: one still frame of grain that fades, no flicker.
      if (!reduced || frame === 0) {
        const data = image.data
        for (let i = 0; i < data.length; i += 4) {
          const v = Math.random() * 255
          data[i] = data[i + 1] = data[i + 2] = v
          data[i + 3] = 255
        }
        context.putImageData(image, 0, 0)
      }
      // Fast attack, eased tail.
      const envelope = t < 0.12 ? t / 0.12 : Math.pow(1 - (t - 0.12) / 0.88, 1.6)
      element.style.opacity = String(envelope * fx.staticAmount)
      frame++
      raf = requestAnimationFrame(draw)
    }
    let raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); element.style.opacity = "0" }
  }, [retunes]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvas} className={`static-burst ${className}`} width={240} height={135} aria-hidden="true" />
}

// ---------------------------------------------------------------- keys

// True while `key` is physically held (no Cmd/Ctrl), for keycaps that press down.
export function useKeyHeld(key: string) {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === `Key${key.toUpperCase()}` && !event.metaKey && !event.ctrlKey) setHeld(true) }
    const up = (event: KeyboardEvent) => { if (event.code === `Key${key.toUpperCase()}`) setHeld(false) }
    const blur = () => setHeld(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur) }
  }, [key])
  return held
}
export function useAltHeld() {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const sync = (event: KeyboardEvent) => setHeld(event.altKey)
    const blur = () => setHeld(false)
    window.addEventListener("keydown", sync)
    window.addEventListener("keyup", sync)
    window.addEventListener("blur", blur)
    return () => { window.removeEventListener("keydown", sync); window.removeEventListener("keyup", sync); window.removeEventListener("blur", blur) }
  }, [])
  return held
}

export function Keycap({ children, down, size = "md" }: { children: ReactNode; down?: boolean; size?: "sm" | "md" | "lg" | "xl" }) {
  return <kbd className={`keycap keycap-${size}`} data-down={down ? "" : undefined}>{children}</kbd>
}

// ---------------------------------------------------------------- dial data

export const frequency = (index: number) => (88.1 + (index - 1) * 1.6).toFixed(1)
export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
// How long a station has "been on air": since its broadcast epoch, for the copy.
export function onAirFor(nowSeconds: number) {
  const hours = Math.floor((nowSeconds - Date.UTC(2026, 0, 1) / 1000) / 3600)
  return `${hours.toLocaleString("en-US")} hours`
}

// ---------------------------------------------------------------- chrome

export function Brand() {
  return <a className="p-brand" href="#top" aria-label="Free Roam home">
    <img src="/free-roam/badge.png" alt="" width="240" height="240" />
    <span>Free Roam</span>
  </a>
}

export function OnAirTally() {
  const { playing } = useRadio()
  return <p className="p-tally" role="status" data-live={playing ? "" : undefined}>
    <span className="p-tally-light" aria-hidden="true" />
    {playing ? <><span className="p-tally-label">On air</span> <strong>{playing.playlist.name}</strong></> : <span className="p-tally-label">Radio off</span>}
  </p>
}

export function Nav({ tally = true }: { tally?: boolean }) {
  return <header className="p-nav">
    <Brand />
    {tally && <OnAirTally />}
    <nav aria-label="Main navigation">
      <a className="p-nav-link" href="#stations">Stations</a>
      <a className="p-nav-link" href="#how-it-works">How it works</a>
      <a className="p-nav-link" href={sourceUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
      <a className="p-button p-button-sm" href={downloadUrl}>Download for Mac</a>
    </nav>
  </header>
}

export function DownloadButton({ size = "lg", children = "Download for Mac" }: { size?: "md" | "lg"; children?: ReactNode }) {
  return <a className={`p-button p-button-${size}`} href={downloadUrl}>
    <AppleGlyph />{children}
  </a>
}
export function AppleGlyph() {
  return <svg className="p-apple" viewBox="0 0 814 1000" aria-hidden="true"><path fill="currentColor" d="M788 341c-6 4-108 62-108 190 0 149 130 201 134 203-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-164-40c-77 0-104 41-167 41s-106-57-156-127C44 791 0 671 0 557c0-184 119-281 237-281 62 0 114 41 153 41 37 0 95-43 166-43 27 0 124 2 188 94zM554 158c29-35 50-83 50-131 0-7-1-13-2-19-47 2-103 32-137 71-27 30-52 78-52 127 0 7 1 15 2 17 3 1 8 1 13 1 42 0 95-28 126-66z" /></svg>
}

export function TryWheelButton({ children = "Try the wheel" }: { children?: ReactNode }) {
  const { wheel } = useRadio()
  return <button className="p-button p-button-ghost p-button-lg" onClick={wheel.show} aria-expanded={wheel.open}>{children}</button>
}

export function SoundToggle() {
  const { audio } = useRadio()
  return <button className="p-sound" aria-pressed={audio.enabled && !audio.error} disabled={audio.loading} onClick={audio.toggle}>
    {audio.loading ? "Loading sounds…" : audio.error ? "Retry sound" : audio.enabled ? "Sound on" : "Sound off"}
  </button>
}

// ---------------------------------------------------------------- below the fold

export function Dial() {
  const now = useNow()
  const { wheel } = useRadio()
  return <section className="p-section p-dial" id="stations" aria-labelledby="dial-title">
    <div className="p-section-head">
      <p className="p-eyebrow">On the dial</p>
      <h2 id="dial-title">Every station is already playing.</h2>
      <p>Each playlist runs on its own clock. Tune in and you land mid-song, right where it would be if it had been on all along. Leave, come back, it kept going.</p>
    </div>
    <ul className="p-dial-list">
      {demoSlots.map((slot, index) => {
        if (slot.kind !== "playlist") return null
        const live = onAir(slot.playlist.tracks, now)
        const progress = live ? live.position / live.track.duration : 0
        return <li key={slot.id}>
          <button className="p-dial-row" aria-pressed={wheel.playingId === slot.id} onClick={() => wheel.choose(index)}>
            <span className="p-freq">{frequency(index)}</span>
            <img src={slot.playlist.covers[0]} alt="" width="44" height="44" loading="lazy" />
            <span className="p-dial-name">{slot.playlist.name}</span>
            <span className="p-dial-track">{live ? `${live.track.title} · ${live.track.artist}` : ""}</span>
            <span className="p-dial-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></span>
          </button>
        </li>
      })}
    </ul>
  </section>
}

export function HowItWorks() {
  const q = useKeyHeld("q")
  const alt = useAltHeld()
  return <section className="p-section p-how" id="how-it-works" aria-labelledby="how-title">
    <p className="p-eyebrow" id="how-title">How it works</p>
    <ol className="p-steps">
      <li><h3>Hold <Keycap down={alt}>⌥</Keycap><Keycap down={q}>Q</Keycap></h3><p>The wheel opens over whatever you're doing, on the station that's playing.</p></li>
      <li><h3>Flick</h3><p>Move the mouse or scroll toward a station. Rest on one for a second and it tunes in.</p></li>
      <li><h3>Let go</h3><p>The wheel closes and you're back to it. Pick Radio Off when you need quiet.</p></li>
    </ol>
    <p className="p-aside">Tap <Keycap size="sm">⌥</Keycap><Keycap size="sm">Q</Keycap> to skip to the next station without opening the wheel.</p>
  </section>
}

export function Faq() {
  return <section className="p-section p-faq" aria-labelledby="faq-title">
    <h2 id="faq-title">A few things to know</h2>
    <div>
      <details><summary>Do I need Apple Music?<span aria-hidden="true">+</span></summary><p>No. Free Roam plays the playlists in the Music app that's already on your Mac, including songs you've imported yourself. You only need a subscription for songs that come from Apple Music. Any Mac on macOS 14 or later works.</p></details>
      <details><summary>Why use it instead of the Music app?<span aria-hidden="true">+</span></summary><p>Because changing the music shouldn't pull you out of what you're doing. Want to watch a YouTube video? Hold ⌥Q, flick to Radio Off, and it's quiet. When you're done, flick back and the station is still on air. No switching apps, no hunting for the pause button.</p></details>
      <details><summary>Can I choose my own stations?<span aria-hidden="true">+</span></summary><p>Yes. Open Settings from the menu bar, drag your playlists into order and click a cover to add or remove one. This page shows the creator's stations; it never touches your library.</p></details>
      <details><summary>Does this page play music?<span aria-hidden="true">+</span></summary><p>No, only the wheel and its sound effects. The Mac app controls playback in Music.</p></details>
      <details><summary>What can it see on my Mac?<span aria-hidden="true">+</span></summary><p>Only what it needs to play music. It asks to control the Music app. Screen Recording is optional: it lets the wheel fade the colour of whatever's behind it, and nothing is saved or sent. There's no account and no tracking, and the code is on GitHub for anyone to read.</p></details>
    </div>
  </section>
}

export function Closing({ title = "Get in.", children }: { title?: ReactNode; children?: ReactNode }) {
  return <section className="p-section p-closing" aria-labelledby="closing-title">
    <h2 id="closing-title">{title}</h2>
    <p>{children ?? "Free and open source. macOS 14 or later."}</p>
    <DownloadButton />
  </section>
}

export function Footer({ line = "Hold ⌥Q anywhere." }: { line?: ReactNode }) {
  return <footer className="p-footer">
    <Brand />
    <p className="p-footer-line">{line}</p>
    <nav aria-label="Footer">
      <a href={downloadUrl}>Download</a>
      <a href={sourceUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
      <a href="https://x.com/HAPPYS1NGH" target="_blank" rel="noreferrer">X ↗</a>
    </nav>
  </footer>
}

export function BelowFold({ closingTitle, footerLine }: { closingTitle?: ReactNode; footerLine?: ReactNode }) {
  return <>
    <Dial />
    <HowItWorks />
    <Faq />
    <Closing title={closingTitle} />
    <Footer line={footerLine} />
  </>
}

// In the prototype the intro plays on every mount (R replays it) when the
// harness toggle is on. Shipped, it's gated once per session in sessionStorage.
export function useIntro() {
  return useFx().intro
}
