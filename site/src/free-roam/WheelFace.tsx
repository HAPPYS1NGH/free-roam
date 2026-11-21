import { useEffect, useRef, useState, type PointerEventHandler } from "react"
import { useReducedMotion } from "motion/react"
import tokens from "../../tokens.json"
import { polar, slotAngle } from "../geometry"
import { RadioWheel, radioWheelControls, ringGeometry, type RadioWheelLook } from "../RadioWheel"
import { useScreenHeight } from "../useViewport"
import { demoSlots } from "./demo-stations"
import "./radio-demo.css"

const look: RadioWheelLook = {
  ...tokens.sizes, ...tokens.colors, ...tokens.flags,
  selectedInColour: radioWheelControls.selectedInColour,
  open: radioWheelControls.open, close: radioWheelControls.close,
  filterIn: radioWheelControls.filterIn, filterOut: radioWheelControls.filterOut,
  copyTokens: radioWheelControls.copyTokens, downloadTokens: radioWheelControls.downloadTokens,
}

type Props = {
  highlighted: number
  autoFocus?: boolean
  onChoose: (index: number) => void
  onPointerMove?: PointerEventHandler<HTMLDivElement>
}

export function WheelFace({ highlighted, onChoose, onPointerMove, autoFocus = false }: Props) {
  const [width, setWidth] = useState(450)
  const stage = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const unit = useScreenHeight() / 100
  const { radius, icon, selectedIcon } = ringGeometry(look, demoSlots.length, unit)
  const ringWidth = Math.round(look.ringWidth * unit)
  const size = 2 * Math.ceil(radius + selectedIcon / 2 + ringWidth + 2)
  const scale = width / size

  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const focusSelected = () => stage.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true })

  useEffect(() => {
    if (autoFocus) focusSelected()
  }, [autoFocus])

  useEffect(() => {
    if (stage.current?.contains(document.activeElement)) focusSelected()
  }, [highlighted])

  // Drawn at the app's size, and only shrunk when the window is too small.
  return <div className="production-wheel-stage" ref={stage} onPointerMove={onPointerMove} style={{ width: `min(${size}px, 100%)` }}>
    <div className="production-wheel-render" style={{ width: size, height: size, transform: `scale(${scale})` }}>
      {/* The native renderer raises the whole wheel relative to its screen. */}
      <div style={{ position: "absolute", top: Math.round(look.raise * unit) }}>
        <RadioWheel slots={demoSlots} highlighted={highlighted} look={reduced ? { ...look, openScale: 1 } : look}
          idleOpacity={tokens.sizes.idleOpacity} stationSize={tokens.sizes.stationSize} layout="Today" unit={unit}
          openTransition={{ duration: tokens.animations.open.duration }}
          closeTransition={{ duration: tokens.animations.close.duration }} />
      </div>
      {demoSlots.map((slot, index) => {
        const position = polar(size / 2, size / 2, radius, slotAngle(index, demoSlots.length))
        const diameter = Math.max(icon + 2 * ringWidth, 44 / scale)
        return <button className="production-station-target" key={slot.id}
          aria-label={slot.kind === "off" ? "Radio off" : `Tune to ${slot.playlist.name}`}
          aria-pressed={highlighted === index}
          style={{ left: position.x, top: position.y, width: diameter, height: diameter }}
          onClick={() => onChoose(index)} />
      })}
    </div>
  </div>
}
