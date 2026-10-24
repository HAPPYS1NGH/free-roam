import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import tokens from "../../tokens.json"
import { polar, slotAngle, slotForVector } from "../geometry"
import { loadLibrary } from "../library"
import { RadioWheel, radioWheelControls, ringGeometry, type RadioWheelLook } from "../RadioWheel"
import { mockPlaylists, slotsFor, type Playlist } from "../stations"
import { useViewport } from "../useViewport"
import "./radio-demo.css"

const look: RadioWheelLook = {
  ...tokens.sizes,
  ...tokens.colors,
  ...tokens.flags,
  selectedInColour: radioWheelControls.selectedInColour,
  open: radioWheelControls.open,
  close: radioWheelControls.close,
  filterIn: radioWheelControls.filterIn,
  filterOut: radioWheelControls.filterOut,
  copyTokens: radioWheelControls.copyTokens,
  downloadTokens: radioWheelControls.downloadTokens,
}

export function RadioDemo() {
  const [playlists, setPlaylists] = useState<Playlist[]>(mockPlaylists)
  const [selected, setSelected] = useState(1)
  const [preview, setPreview] = useState(1)
  const [holding, setHolding] = useState(false)
  const [sound, setSound] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const [width, setWidth] = useState(450)
  const selection = useRef(1)
  const held = useRef(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const { height } = useViewport()
  const slots = useMemo(() => slotsFor(playlists), [playlists])
  const unit = height / 100
  const { radius, icon, selectedIcon } = ringGeometry(look, slots.length, unit)
  const ringWidth = Math.round(look.ringWidth * unit)
  const size = 2 * Math.ceil(radius + selectedIcon / 2 + ringWidth + 2)
  const scale = width / size
  const highlighted = Math.min(holding ? preview : selected, slots.length - 1)

  useEffect(() => {
    let active = true
    void loadLibrary().then(library => {
      if (active) setPlaylists(library.playlists)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const tune = useCallback((index: number) => {
    setSelected(index)
    setPreview(index)
    selection.current = index
    if (!sound) return
    audio.current ??= new Audio("/sounds/retune.wav")
    audio.current.volume = 0.2
    audio.current.currentTime = 0
    void audio.current.play().then(() => setAudioError(false)).catch(() => setAudioError(true))
  }, [sound])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "q" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return
      event.preventDefault()
      held.current = true
      setHolding(true)
      stage.current?.scrollIntoView({ block: "nearest" })
    }
    const up = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "q" || !held.current) return
      held.current = false
      setHolding(false)
      tune(Math.min(selection.current, slots.length - 1))
    }
    const cancel = () => { held.current = false; setHolding(false) }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", cancel)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", cancel)
      audio.current?.pause()
    }
  }, [slots.length, tune])

  return (
    <section className="radio-demo" id="radio-demo" aria-label="Interactive radio preview">
      <div className="demo-topline">
        <span className="eyebrow">Your music. Your stations.</span>
        <button className="sound-toggle" aria-pressed={sound} onClick={() => {
          setSound(!sound)
          audio.current?.pause()
        }}>
          {sound ? "Sound on" : "Sound off"}
          <span aria-hidden="true">{sound ? "◖))" : "◖×"}</span>
        </button>
      </div>
      <div
        className="production-wheel-stage"
        ref={stage}
        onPointerMove={event => {
          if (!held.current) return
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - bounds.left - bounds.width / 2
          const y = event.clientY - bounds.top - bounds.height / 2
          if (Math.hypot(x, y) < bounds.width * 0.17) return
          const next = slotForVector(x, y, slots.length)
          selection.current = next
          setPreview(next)
        }}
        onKeyDown={event => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
          event.preventDefault()
          event.stopPropagation()
          const next = (highlighted + (event.key === "ArrowRight" ? 1 : slots.length - 1)) % slots.length
          tune(next)
        }}
      >
        <div className="production-wheel-render" style={{ width: size, height: size, transform: `scale(${scale})` }}>
          {/* Compensate for the native overlay's screen-relative vertical offset. */}
          <div style={{ position: "absolute", top: Math.round(look.raise * unit) }}>
            <RadioWheel
              slots={slots}
              highlighted={highlighted}
              look={look}
              idleOpacity={tokens.sizes.idleOpacity}
              stationSize={tokens.sizes.stationSize}
              layout="Today"
              openTransition={{ duration: reducedMotion ? 0 : tokens.animations.open.duration }}
              closeTransition={{ duration: reducedMotion ? 0 : tokens.animations.close.duration }}
            />
          </div>
          {slots.map((slot, index) => {
            const position = polar(size / 2, size / 2, radius, slotAngle(index, slots.length))
            const diameter = Math.max(icon + 2 * ringWidth, 44 / scale)
            return (
              <button
                className="production-station-target"
                key={slot.id}
                aria-label={slot.kind === "off" ? "Radio off" : `Tune to ${slot.playlist.name}`}
                aria-pressed={highlighted === index}
                style={{ left: position.x, top: position.y, width: diameter, height: diameter }}
                onClick={() => tune(index)}
              />
            )
          })}
        </div>
      </div>
      <p className="demo-instruction">Hold <kbd>Q</kbd>, point, release. Or tap an album.</p>
      <p className="demo-disclaimer">
        {audioError ? "Sound could not play. Try switching sound off and on." : "Browser preview · tuning effects only"}
      </p>
    </section>
  )
}
