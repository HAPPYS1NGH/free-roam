import type { DialConfig, ResolvedValues } from "dialkit"
import { motion, type Transition } from "motion/react"
import type { CSSProperties } from "react"
import { onAir, useNow } from "./broadcast"
import { polar, slotAngle } from "./geometry"
import { RadioOffIcon } from "./icons"
import { hueFor, initialsFor, type Slot } from "./stations"
import { useViewport } from "./useViewport"
import "./radio-wheel.css"

// Accent colours measured from GTA V's HUD palette. The defaults below come
// from in-game captures; sizes are percentages of screen height (%H), the way
// GTA scales its HUD.
export const RING_COLOURS: Record<string, string> = {
  Blue: "#65B4D4",
  Green: "#ABEDAB",
  Orange: "#FFA357",
  Navy: "#2D6EB9",
}

// The wheel opens dozens of times a day from the keyboard, so it only fades:
// no scale, no stagger, and the highlight moves instantly.
export const radioWheelControls = {
  open: { type: "easing", duration: 0.08, ease: [0.23, 1, 0.32, 1] },
  close: { type: "easing", duration: 0.07, ease: [0.4, 0, 1, 1] },
  iconSize: [8.3, 5, 14, 0.1],
  iconPitch: [9.15, 6, 16, 0.05],
  maxRadius: [30.5, 18, 45, 0.5],
  raise: [4.3, 0, 10, 0.1],
  ringPreset: { type: "select", options: [...Object.keys(RING_COLOURS), "Custom"], default: "Blue" },
  ringColor: "#65B4D4",
  ringWidth: [0.55, 0.2, 1.5, 0.05],
  selectedScale: [1.03, 1, 1.2, 0.01],
  idleOpacity: [0.35, 0.1, 1, 0.01],
  selectedInColour: true,
  captionSize: [2.6, 1.5, 4, 0.05],
  captionPitch: [3.4, 2, 5, 0.05],
  captionRaise: [5, 0, 10, 0.1],
  copyTokens: { type: "action", label: "Copy tokens" },
  downloadTokens: { type: "action", label: "Download tokens.json" },
} satisfies DialConfig

export type RadioWheelLook = ResolvedValues<typeof radioWheelControls>

// GTA spaces logos a fixed distance apart, so the ring grows with the station
// count until it hits a maximum, and logos shrink only once it's full.
export function ringGeometry(look: RadioWheelLook, count: number, unit: number) {
  const radius = Math.min((count * look.iconPitch) / (2 * Math.PI), look.maxRadius) * unit
  const icon = Math.min(look.iconSize * unit, (0.95 * 2 * Math.PI * radius) / count)
  return { radius, icon }
}

type Props = {
  slots: Slot[]
  highlighted: number
  look: RadioWheelLook
  openTransition: Transition
  closeTransition: Transition
}

function StationArt({ slot }: { slot: Slot }) {
  if (slot.kind === "off") {
    return (
      <span className="station-art station-off">
        <RadioOffIcon />
      </span>
    )
  }
  const { covers, name } = slot.playlist
  if (covers.length >= 4) {
    return (
      <span className="station-art station-mosaic">
        {covers.slice(0, 4).map((src) => (
          <img key={src} src={src} alt="" draggable={false} />
        ))}
      </span>
    )
  }
  if (covers.length > 0) {
    return (
      <span className="station-art">
        <img src={covers[0]} alt="" draggable={false} />
      </span>
    )
  }
  return (
    <span className="station-art station-fallback" style={{ "--hue": hueFor(name) } as CSSProperties}>
      {initialsFor(name)}
    </span>
  )
}

function captionFor(slot: Slot, now: number) {
  if (slot.kind === "off") return { station: "Radio Off", artist: "", title: "" }
  const live = onAir(slot.playlist.tracks, now)
  return { station: slot.playlist.name, artist: live?.track.artist ?? "", title: live?.track.title ?? "No songs" }
}

export function RadioWheel({ slots, highlighted, look, openTransition, closeTransition }: Props) {
  const { height } = useViewport()
  const now = useNow()
  const unit = height / 100
  const { radius, icon } = ringGeometry(look, slots.length, unit)
  const ringWidth = look.ringWidth * unit
  const size = (radius + (icon * look.selectedScale) / 2 + ringWidth + 2) * 2
  const centre = size / 2
  const pitch = look.captionPitch * unit
  const caption = captionFor(slots[highlighted], now)
  const ring = RING_COLOURS[look.ringPreset] ?? look.ringColor

  return (
    <motion.div
      className="radio-wheel"
      data-colour={look.selectedInColour || undefined}
      style={
        {
          width: size,
          height: size,
          translate: `0 ${-look.raise * unit}px`,
          "--ring": ring,
          "--ring-width": `${ringWidth}px`,
          "--idle-opacity": look.idleOpacity,
          "--selected-scale": look.selectedScale,
          "--caption-size": `${Math.max(13, look.captionSize * unit)}px`,
          "--caption-pitch": `${pitch}px`,
        } as CSSProperties
      }
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: openTransition }}
      exit={{ opacity: 0, transition: closeTransition }}
    >
      {slots.map((slot, i) => {
        const position = polar(centre, centre, radius, slotAngle(i, slots.length))
        return (
          <div
            key={slot.id}
            className="station"
            aria-hidden="true"
            data-selected={i === highlighted || undefined}
            style={{ left: position.x, top: position.y, width: icon, height: icon }}
          >
            <StationArt slot={slot} />
          </div>
        )
      })}
      {/* The first line sits above the ring's centre and the rest hang below it,
          as in GTA, so a one-line caption ("Radio Off") stays in the same place. */}
      <div
        className="wheel-caption"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ top: centre - look.captionRaise * unit - pitch / 2, maxWidth: radius * 2 }}
      >
        <span>{caption.station}</span>
        {caption.artist && <span className="caption-artist">{caption.artist}</span>}
        {caption.title && <span>{caption.title}</span>}
      </div>
    </motion.div>
  )
}
