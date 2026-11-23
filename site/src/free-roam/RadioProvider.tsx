import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import tokens from "../../tokens.json"
import type { Slot } from "../stations"
import { useScreenHeight } from "../useViewport"
import { useWheel } from "../useWheel"
import { WheelOverlay } from "./WheelOverlay"
import { demoSlots } from "./demo-stations"
import { useProductAudio } from "./useProductAudio"
import { useRadioTracking, type TrackedWheel } from "./useRadioTracking"

type Radio = {
  wheel: TrackedWheel
  audio: ReturnType<typeof useProductAudio>
  playing: Extract<Slot, { kind: "playlist" }> | undefined
  // Bumps on every retune, so the hero can key its one-shot wash off it.
  retunes: number
  // The playing station's cover colour as rgb(), or null for Radio Off.
  stationRgb: string | null
}

const RadioContext = createContext<Radio | null>(null)

export function useRadio() {
  const radio = useContext(RadioContext)
  if (!radio) throw new Error("useRadio outside RadioProvider")
  return radio
}

// One wheel for the whole page: ⌥Q, the station list, the touch button and a
// touch hold all tune it, and the overlay renders once, above everything.
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
    sounds: audio.sounds,
  })
  const trackedWheel = useRadioTracking(wheel, audio)
  const slot = demoSlots.find(candidate => candidate.id === wheel.playingId)
  const playing = slot?.kind === "playlist" ? slot : undefined
  const stationRgb = useCoverColour(playing?.playlist.covers[0])

  const [retunes, setRetunes] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setRetunes(count => count + 1)
  }, [wheel.playingId])

  // While the wheel is open nothing on the page can be selected, so a resting
  // finger on touch never starts an iOS text selection (see page.css).
  useEffect(() => {
    document.documentElement.toggleAttribute("data-wheel-open", wheel.open)
  }, [wheel.open])

  // Focus goes back to whatever opened the wheel: it's either still inside the
  // fading wheel or on the body after a click on the pick layer. The opener is
  // the last focus outside the wheel, tracked as focus moves, because the
  // wheel takes focus (in its own effect) before this component's effects run.
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const inWheel = (target: EventTarget | null) => target instanceof Element && !!target.closest(".wheel-layer")
    const remember = (event: FocusEvent) => {
      if (!inWheel(event.target) && event.target instanceof HTMLElement) opener.current = event.target
    }
    // Focus dropped to the body (a click on nothing): there's no opener to return to.
    const forget = (event: FocusEvent) => {
      if (!event.relatedTarget && !inWheel(event.target)) opener.current = null
    }
    document.addEventListener("focusin", remember)
    document.addEventListener("focusout", forget)
    return () => {
      document.removeEventListener("focusin", remember)
      document.removeEventListener("focusout", forget)
    }
  }, [])
  useEffect(() => {
    if (wheel.open) return
    const lost = document.activeElement === document.body || document.querySelector(".wheel-layer")?.contains(document.activeElement)
    if (lost) opener.current?.focus({ preventScroll: true })
  }, [wheel.open])

  return <RadioContext.Provider value={{ wheel: trackedWheel, audio, playing, retunes, stationRgb }}>
    {children}
    <WheelOverlay open={wheel.open} highlighted={wheel.highlighted} onChoose={wheel.choose} onClose={wheel.hide}
      onMove={wheel.move} onCommit={wheel.commit} />
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
