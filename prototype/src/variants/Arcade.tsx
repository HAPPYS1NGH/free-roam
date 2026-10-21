import type { DialConfig, ResolvedValues } from "dialkit"
import { motion } from "motion/react"
import type { CSSProperties } from "react"
import { polar, slotAngle, wedgePath } from "../geometry"
import { PlusIcon, PowerIcon } from "../icons"
import { callSignFor, describe, frequencyFor, hueFor, type Station } from "../stations"
import { exitTransition, transitionFor } from "../timing"
import { useFit } from "../useFit"
import { focusIndex, type WheelProps } from "./types"
import "./arcade.css"

// Direction: game HUD. Solid wedges, station badges, instant highlight.
export const arcadeControls = {
  open: { type: "spring", mass: 1, stiffness: 700, damping: 42 },
  outerRadius: [250, 180, 340, 1],
  innerRadius: [104, 60, 170, 1],
  gap: [6, 0, 20, 0.5],
  wedgeOpacity: [0.62, 0.2, 0.95, 0.01],
  highlight: "#F2EFE6",
  onAir: "#5BE38A",
  copyTokens: { type: "action", label: "Copy tokens" },
  downloadTokens: { type: "action", label: "Download tokens.json" },
} satisfies DialConfig

type Values = ResolvedValues<typeof arcadeControls>

function Badge({ station, onAir }: { station: Station; onAir: boolean }) {
  if (station.kind === "off") {
    return (
      <>
        <span className="arcade-badge arcade-badge-off">
          <PowerIcon size={22} />
        </span>
        <span className="arcade-freq">OFF</span>
      </>
    )
  }
  if (station.kind === "empty") {
    return (
      <>
        <span className="arcade-badge arcade-badge-empty">
          <PlusIcon size={20} />
        </span>
        <span className="arcade-freq">EMPTY</span>
      </>
    )
  }
  const callSign = callSignFor(station.name)
  return (
    <>
      <span
        className="arcade-badge"
        data-long={callSign.length > 4 || undefined}
        style={{ "--hue": hueFor(station.name) } as CSSProperties}
      >
        {callSign}
      </span>
      <span className="arcade-freq" data-on-air={onAir || undefined}>
        {frequencyFor(station.name)}
      </span>
    </>
  )
}

export function Arcade({ values, stations, highlighted, playingId, trackIndex, speed, reduced }: WheelProps<Values>) {
  const { outerRadius, innerRadius, gap } = values
  const size = outerRadius * 2 + 8
  const centre = size / 2
  const slice = (Math.PI * 2) / stations.length
  const fit = useFit(size)
  const focus = describe(stations[focusIndex(stations, highlighted, playingId)], playingId, trackIndex)
  const badgeSize = Math.min(60, (outerRadius - innerRadius) * 0.42)
  const centreSize = (innerRadius - 10) * 2

  return (
    <div style={{ scale: fit }}>
      <motion.div
        className="arcade"
        style={
          {
            width: size,
            height: size,
            "--highlight": values.highlight,
            "--on-air": values.onAir,
            "--wedge-alpha": values.wedgeOpacity,
            "--badge": `${badgeSize}px`,
          } as CSSProperties
        }
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1, transition: transitionFor(values.open, speed, reduced) }}
        exit={{ opacity: 0, scale: 0.97, transition: exitTransition(speed, reduced) }}
      >
        <svg width={size} height={size} aria-hidden="true">
          {stations.map((station, i) => {
            const angle = slotAngle(i, stations.length)
            return (
              <path
                key={station.id}
                className="arcade-wedge"
                data-highlighted={i === highlighted || undefined}
                d={wedgePath(centre, centre, outerRadius, innerRadius, angle - slice / 2, angle + slice / 2, gap)}
              />
            )
          })}
        </svg>
        {stations.map((station, i) => {
          const position = polar(centre, centre, (outerRadius + innerRadius) / 2, slotAngle(i, stations.length))
          return (
            <div
              key={station.id}
              className="arcade-slot"
              aria-hidden="true"
              data-highlighted={i === highlighted || undefined}
              style={{ left: position.x, top: position.y }}
            >
              <Badge station={station} onAir={station.id === playingId} />
            </div>
          )
        })}
        <div
          className="arcade-centre"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ width: centreSize, height: centreSize }}
        >
          {focus.frequency && (
            <span className="arcade-frequency" data-on-air={focus.onAir || undefined}>
              {focus.onAir ? "On air · " : ""}
              {focus.frequency} FM
            </span>
          )}
          <span className="arcade-title">{focus.title}</span>
          <span className="arcade-subtitle">{focus.subtitle}</span>
        </div>
      </motion.div>
    </div>
  )
}
