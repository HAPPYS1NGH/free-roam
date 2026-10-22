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

// GTA's wheel pops in and out within a frame. Ours opens from 96% scale with
// ease-out-quint, which is 80% of the way there in about 40ms, so it never
// trails the key. It closes 30% faster, opacity only, because letting go
// commits the pick. The highlight still jumps, as in GTA: it can sweep 30
// stations a second. The screen filter eases in over 150ms and lets go over
// 450ms after the wheel has gone.
export const radioWheelControls = {
  open: { type: "easing", duration: 0.14, ease: [0.23, 1, 0.32, 1] },
  close: { type: "easing", duration: 0.1, ease: [0.23, 1, 0.32, 1] },
  openScale: [0.96, 0.8, 1, 0.01],
  filterIn: { type: "easing", duration: 0.15, ease: [0.4, 0, 0.6, 1] },
  filterOut: { type: "easing", duration: 0.45, ease: [0.4, 0, 0.6, 1] },
  iconSize: [8.8, 5, 14, 0.1],
  maxIconSize: [10.5, 5, 16, 0.1],
  iconPitch: [9.15, 6, 16, 0.05],
  minRadius: [22, 12, 30, 0.5],
  maxRadius: [30.5, 18, 45, 0.5],
  raise: [4.3, 0, 10, 0.1],
  // Black rim round the art on each side, as a fraction of the disc. At 5%
  // the art circle is 90% of the disc, where GTA's Radio Off ring sits.
  rim: [0.05, 0, 0.2, 0.005],
  // The selected disc's rim, thinner so the art runs almost up to the ring.
  selectedRim: [0.01, 0, 0.2, 0.005],
  ringPreset: { type: "select", options: [...Object.keys(RING_COLOURS), "Custom"], default: "Blue" },
  ringColor: "#65B4D4",
  ringWidth: [0.55, 0.2, 1.5, 0.05],
  selectedScale: [1, 1, 1.2, 0.01],
  idleOpacity: [0.4, 0.05, 1, 0.01],
  selectedInColour: true,
  captionSize: [2.6, 1.5, 4, 0.05],
  captionPitch: [3.4, 2, 5, 0.05],
  captionRaise: [5, 0, 10, 0.1],
  copyTokens: { type: "action", label: "Copy tokens" },
  downloadTokens: { type: "action", label: "Download tokens.json" },
} satisfies DialConfig

export type RadioWheelLook = ResolvedValues<typeof radioWheelControls>

// GTA spaces logos a fixed distance apart, so the ring grows with the station
// count between minRadius and maxRadius. GTA has 18+ stations; with fewer the
// ring got too small to hold the caption, hence the minimum. Logos always keep
// GTA's logo-to-gap proportion (discs about 3% of a logo apart, nearly
// touching), so they grow (up to maxIconSize) when a short list is spread
// round the minimum ring and shrink once the ring is full.
//
// Disc diameters are whole, even pixels: every disc comes out identical,
// translate: -50% lands on the pixel grid, and a 2×2 mosaic splits into
// whole-pixel tiles with no seams between them.
const evenPixels = (n: number) => Math.round(n / 2) * 2

export function ringGeometry(look: RadioWheelLook, count: number, unit: number) {
  const natural = (count * look.iconPitch) / (2 * Math.PI)
  const radius = Math.min(Math.max(natural, look.minRadius), look.maxRadius) * unit
  const pitch = (2 * Math.PI * radius) / count
  const icon = evenPixels(Math.min((pitch * look.iconSize) / look.iconPitch, look.maxIconSize * unit))
  const selectedIcon = evenPixels(icon * look.selectedScale)
  return { radius, icon, selectedIcon }
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
  const { radius, icon, selectedIcon } = ringGeometry(look, slots.length, unit)
  const ringWidth = Math.round(look.ringWidth * unit)
  // Room for the selected ring and its dark edge. Even, so the centre the
  // stations and the open scale use is a whole pixel.
  const size = 2 * Math.ceil(radius + selectedIcon / 2 + ringWidth + 2)
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
          translate: `0 ${-Math.round(look.raise * unit)}px`,
          "--ring": ring,
          "--ring-width": `${ringWidth}px`,
          "--disc": `${icon}px`,
          "--rim": `${Math.round(icon * look.rim)}px`,
          "--selected-disc": `${selectedIcon}px`,
          "--selected-rim": `${Math.round(selectedIcon * look.selectedRim)}px`,
          "--idle-opacity": look.idleOpacity,
          "--caption-size": `${Math.max(13, look.captionSize * unit)}px`,
          "--caption-pitch": `${pitch}px`,
        } as CSSProperties
      }
      // Animated as one `transform` string because Motion hands that, unlike
      // `scale`, to the compositor, so the enter stays smooth while React
      // mounts the stations. The box is centred on the ring, so the default
      // origin scales the wheel about the ring's centre.
      initial={{ opacity: 0, transform: `scale(${look.openScale})` }}
      animate={{ opacity: 1, transform: "scale(1)", transition: openTransition }}
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
            style={{ left: Math.round(position.x), top: Math.round(position.y) }}
          >
            <StationArt slot={slot} />
          </div>
        )
      })}
      {/* The first line sits above the ring's centre and the rest hang below it,
          as in GTA, so a one-line caption ("Radio Off") stays in the same place.
          Long lines truncate short of the logos instead of running under them. */}
      <div
        className="wheel-caption"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ top: centre - look.captionRaise * unit - pitch / 2, maxWidth: (radius - icon / 2) * 1.8 }}
      >
        <span>{caption.station}</span>
        {caption.artist && <span className="caption-artist">{caption.artist}</span>}
        {caption.title && <span>{caption.title}</span>}
      </div>
    </motion.div>
  )
}
