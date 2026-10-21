import type { DialConfig, ResolvedValues } from "dialkit"
import { motion } from "motion/react"
import type { CSSProperties } from "react"
import { polar, slotAngle } from "../geometry"
import { PlusIcon, PowerIcon } from "../icons"
import { callSignFor, describe, hueFor, type Station } from "../stations"
import { exitTransition, transitionFor } from "../timing"
import { useFit } from "../useFit"
import { focusIndex, type WheelProps } from "./types"
import "./halo.css"

// Direction: Apple-native. Floating covers on glass, the focused one grows.
export const haloControls = {
  open: { type: "spring", mass: 1, stiffness: 520, damping: 34 },
  focus: { type: "spring", mass: 1, stiffness: 520, damping: 26 },
  ringRadius: [188, 130, 300, 1],
  tileSize: [76, 44, 120, 1],
  innerRadius: [86, 56, 140, 1],
  focusScale: [1.16, 1, 1.4, 0.01],
  dimOthers: [0.45, 0.1, 1, 0.05],
  copyTokens: { type: "action", label: "Copy tokens" },
  downloadTokens: { type: "action", label: "Download tokens.json" },
} satisfies DialConfig

type Values = ResolvedValues<typeof haloControls>

function Cover({ station, onAir, size }: { station: Station; onAir: boolean; size: number }) {
  if (station.kind === "off") {
    return (
      <span className="halo-cover halo-cover-off">
        <PowerIcon size={size * 0.32} />
      </span>
    )
  }
  if (station.kind === "empty") {
    return (
      <span className="halo-cover halo-cover-empty">
        <PlusIcon size={size * 0.3} />
      </span>
    )
  }
  return (
    <span className="halo-cover" style={{ "--hue": hueFor(station.name), fontSize: size * 0.2 } as CSSProperties}>
      {callSignFor(station.name)}
      {onAir && (
        <span className="halo-eq">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  )
}

export function Halo({ values, stations, highlighted, playingId, trackIndex, speed, reduced }: WheelProps<Values>) {
  const { ringRadius, tileSize, innerRadius, focusScale, dimOthers } = values
  const size = (ringRadius + tileSize) * 2
  const centre = size / 2
  const fit = useFit(size)
  const index = focusIndex(stations, highlighted, playingId)
  const focus = describe(stations[index], playingId, trackIndex)
  const openTransition = transitionFor(values.open, speed, reduced)
  const focusTransition = transitionFor(values.focus, speed, reduced)

  return (
    <div style={{ scale: fit }}>
      <motion.div
        className="halo"
        style={{ width: size, height: size }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: openTransition }}
        exit={{ opacity: 0, scale: 0.97, transition: exitTransition(speed, reduced) }}
      >
        <svg width={size} height={size} aria-hidden="true">
          <circle className="halo-track" cx={centre} cy={centre} r={ringRadius} />
        </svg>
        {stations.map((station, i) => {
          const angle = slotAngle(i, stations.length)
          const position = polar(centre, centre, ringRadius, angle)
          const isFocused = i === highlighted
          // Tiles drift outward from slightly inside the ring as the wheel opens.
          const inset = ringRadius * 0.14
          return (
            <motion.div
              key={station.id}
              className="halo-tile"
              aria-hidden="true"
              style={{ left: position.x - tileSize / 2, top: position.y - tileSize / 2, width: tileSize, height: tileSize }}
              initial={{ x: -Math.sin(angle) * inset, y: Math.cos(angle) * inset, scale: 0.9 }}
              animate={{
                x: 0,
                y: 0,
                scale: isFocused ? focusScale : 1,
                opacity: highlighted === null || isFocused ? 1 : dimOthers,
              }}
              transition={{ default: openTransition, scale: focusTransition, opacity: focusTransition }}
            >
              <Cover station={station} onAir={station.id === playingId} size={tileSize} />
              <span className="halo-ring" data-visible={isFocused || undefined} />
            </motion.div>
          )
        })}
        <div
          className="halo-centre"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ width: innerRadius * 2, height: innerRadius * 2 }}
        >
          <span className="halo-centre-cover" aria-hidden="true">
            <Cover station={stations[index]} onAir={false} size={44} />
          </span>
          <span className="halo-title">{focus.title}</span>
          <span className="halo-subtitle">{focus.subtitle}</span>
          {focus.frequency && (
            <span className="halo-frequency">
              {focus.onAir ? "Playing · " : ""}
              {focus.frequency} FM
            </span>
          )}
        </div>
      </motion.div>
    </div>
  )
}
