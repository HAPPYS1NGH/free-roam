import type { DialConfig, ResolvedValues } from "dialkit"
import { motion } from "motion/react"
import { useRef, type CSSProperties } from "react"
import { polar, slotAngle } from "../geometry"
import { describe, frequencyFor, type Station } from "../stations"
import { exitTransition, transitionFor } from "../timing"
import { useFit } from "../useFit"
import { focusIndex, type WheelProps } from "./types"
import "./tuner.css"

// Direction: analogue radio dial. A sprung needle swings to the station.
export const tunerControls = {
  open: { type: "spring", mass: 1, stiffness: 600, damping: 40 },
  needle: { type: "spring", mass: 1, stiffness: 260, damping: 17 },
  outerRadius: [220, 160, 320, 1],
  innerRadius: [92, 60, 140, 1],
  faceOpacity: [0.9, 0.3, 1, 0.01],
  needleColor: "#FF6A3D",
  copyTokens: { type: "action", label: "Copy tokens" },
  downloadTokens: { type: "action", label: "Download tokens.json" },
} satisfies DialConfig

type Values = ResolvedValues<typeof tunerControls>

const TICK_COUNT = 96
// Labels sit outside the rim so the needle can sweep the whole face.
const LABEL_OFFSET = 34

function labelFor(station: Station) {
  if (station.kind === "off") return { frequency: "OFF", name: "Radio off" }
  if (station.kind === "empty") return { frequency: "– – –", name: "Empty" }
  return { frequency: frequencyFor(station.name), name: station.name }
}

export function Tuner({ values, stations, highlighted, playingId, trackIndex, speed, reduced }: WheelProps<Values>) {
  const { outerRadius, innerRadius } = values
  const size = (outerRadius + LABEL_OFFSET + 34) * 2
  const centre = size / 2
  const fit = useFit(size)
  const index = focusIndex(stations, highlighted, playingId)
  const focus = describe(stations[index], playingId, trackIndex)
  const ticksPerSlot = TICK_COUNT / stations.length

  // Turn the shortest way round instead of unwinding past 0°.
  const needleAngle = useRef((index / stations.length) * 360)
  const target = (index / stations.length) * 360
  const delta = ((((target - needleAngle.current) % 360) + 540) % 360) - 180
  needleAngle.current += delta

  return (
    <div style={{ scale: fit }}>
      <motion.div
        className="tuner"
        style={{ width: size, height: size, "--needle": values.needleColor } as CSSProperties}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1, transition: transitionFor(values.open, speed, reduced) }}
        exit={{ opacity: 0, scale: 0.97, transition: exitTransition(speed, reduced) }}
      >
        <svg width={size} height={size} aria-hidden="true">
          <defs>
            <radialGradient id="tuner-face" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#25221f" />
              <stop offset="100%" stopColor="#0c0b0a" />
            </radialGradient>
          </defs>
          <circle cx={centre} cy={centre} r={outerRadius} fill="url(#tuner-face)" fillOpacity={values.faceOpacity} />
          <circle className="tuner-rim" cx={centre} cy={centre} r={outerRadius - 0.5} />
          {Array.from({ length: TICK_COUNT }, (_, k) => {
            const angle = (k / TICK_COUNT) * Math.PI * 2
            const major = k % ticksPerSlot === 0
            const from = polar(centre, centre, outerRadius - 6, angle)
            const to = polar(centre, centre, outerRadius - (major ? 22 : 13), angle)
            return (
              <line
                key={k}
                className={major ? "tuner-tick tuner-tick-major" : "tuner-tick"}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
              />
            )
          })}
        </svg>
        {stations.map((station, i) => {
          const position = polar(centre, centre, outerRadius + LABEL_OFFSET, slotAngle(i, stations.length))
          const label = labelFor(station)
          return (
            <div
              key={station.id}
              className="tuner-label"
              aria-hidden="true"
              data-highlighted={i === highlighted || undefined}
              style={{ left: position.x, top: position.y }}
            >
              <span className="tuner-label-freq" data-on-air={station.id === playingId || undefined}>
                {label.frequency}
              </span>
              <span className="tuner-label-name">{label.name}</span>
            </div>
          )
        })}
        <motion.div
          className="tuner-arm"
          style={{ left: centre, top: centre }}
          initial={false}
          animate={{ rotate: needleAngle.current }}
          transition={transitionFor(values.needle, speed, reduced)}
        >
          <span className="tuner-needle" style={{ top: -(outerRadius - 10), height: outerRadius - innerRadius - 16 }} />
        </motion.div>
        <div
          className="tuner-readout"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ width: (innerRadius - 8) * 2, height: (innerRadius - 8) * 2 }}
        >
          <span className="tuner-readout-freq">
            {focus.frequency ?? "– – –"}
            <small>FM</small>
          </span>
          <span className="tuner-readout-title">{focus.title}</span>
          <span className="tuner-readout-subtitle">{focus.onAir ? `On air · ${focus.subtitle}` : focus.subtitle}</span>
        </div>
      </motion.div>
    </div>
  )
}
