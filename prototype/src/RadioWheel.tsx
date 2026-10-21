import type { DialConfig, ResolvedValues } from "dialkit"
import { motion, type Transition } from "motion/react"
import type { CSSProperties } from "react"
import { onAir, useNow } from "./broadcast"
import { polar, slotAngle } from "./geometry"
import { RadioOffIcon } from "./icons"
import { hueFor, initialsFor, type Slot } from "./stations"
import { useViewport } from "./useViewport"
import "./radio-wheel.css"

// Sizes are percentages of screen height, the way GTA scales its HUD.
// The wheel opens dozens of times a day from the keyboard, so it only fades:
// no scale, no stagger, and the highlight moves instantly.
export const radioWheelControls = {
  open: { type: "easing", duration: 0.09, ease: [0.23, 1, 0.32, 1] },
  close: { type: "easing", duration: 0.07, ease: [0.4, 0, 1, 1] },
  ringRadius: [38, 25, 48, 0.5],
  iconSize: [11.5, 6, 16, 0.25],
  ringColor: "#62C3EE",
  ringWidth: [3, 1, 6, 0.5],
  idleOpacity: [0.55, 0.15, 1, 0.01],
  idleGreyscale: true,
  captionSize: [2.3, 1.5, 3.5, 0.05],
  copyTokens: { type: "action", label: "Copy tokens" },
  downloadTokens: { type: "action", label: "Download tokens.json" },
} satisfies DialConfig

export type RadioWheelLook = ResolvedValues<typeof radioWheelControls>

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
  const radius = look.ringRadius * unit
  const icon = look.iconSize * unit
  const size = (radius + icon / 2 + look.ringWidth) * 2
  const centre = size / 2
  const caption = captionFor(slots[highlighted], now)

  return (
    <motion.div
      className="radio-wheel"
      data-greyscale={look.idleGreyscale || undefined}
      style={
        {
          width: size,
          height: size,
          "--ring": look.ringColor,
          "--ring-width": `${look.ringWidth}px`,
          "--idle-opacity": look.idleOpacity,
          "--caption-size": `${Math.max(13, look.captionSize * unit)}px`,
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
      <div
        className="wheel-caption"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ maxWidth: radius * 2 - icon * 1.4 }}
      >
        <span className="caption-station">{caption.station}</span>
        {caption.artist && <span className="caption-artist">{caption.artist}</span>}
        {caption.title && <span className="caption-title">{caption.title}</span>}
      </div>
    </motion.div>
  )
}
