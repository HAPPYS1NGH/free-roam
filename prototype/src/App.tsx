import { DialRoot, useDialKit, type TransitionConfig } from "dialkit"
import "dialkit/styles.css"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"
import { Desktop } from "./Desktop"
import { Picker } from "./Picker"
import { stations } from "./stations"
import { exitTransition, transitionFor } from "./timing"
import { buildTokens, downloadJson } from "./tokens"
import { useWheel } from "./useWheel"
import { variants, type Variant } from "./variants"

const SPEEDS: Record<string, number> = { "1x": 1, "0.5x": 0.5, "0.25x": 0.25 }
const TICK_VOLUME = 0.25
const NOTICE_MS = 1600

function initialVariant() {
  const v = Number(new URLSearchParams(location.search).get("v"))
  return v >= 1 && v <= variants.length ? v - 1 : 0
}

export function App() {
  const [variantIndex, setVariantIndex] = useState(initialVariant)
  const [mountKey, setMountKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const reduced = useReducedMotion() ?? false

  const harness = useDialKit(
    "Harness",
    {
      keepOpen: false,
      speed: { type: "select", options: ["1x", "0.5x", "0.25x"], default: "1x" },
      backdropTint: [0.35, 0, 0.8, 0.01],
      deadzone: [24, 4, 80, 1],
      duckVolume: [0.4, 0, 1, 0.05],
      staticVolume: [0.5, 0, 1, 0.05],
    },
    { id: "harness", persist: true },
  )

  const wheel = useWheel({
    stations,
    deadzone: harness.deadzone,
    keepOpen: harness.keepOpen,
    staticVolume: harness.staticVolume,
    tickVolume: TICK_VOLUME,
  })

  const selectVariant = useCallback((index: number) => {
    setVariantIndex(index)
    const url = new URL(location.href)
    url.searchParams.set("v", String(index + 1))
    history.replaceState(null, "", url)
  }, [])

  const { peek } = wheel
  const replay = useCallback(() => {
    setMountKey((key) => key + 1)
    peek()
  }, [peek])

  const noticeTimer = useRef(0)
  const showNotice = useCallback((text: string) => {
    window.clearTimeout(noticeTimer.current)
    setNotice(text)
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const variant = variants[variantIndex]
  const behaviour = {
    backdropTint: harness.backdropTint,
    deadzone: harness.deadzone,
    duckVolume: harness.duckVolume,
    staticVolume: harness.staticVolume,
    tickVolume: TICK_VOLUME,
  }

  return (
    <>
      <Desktop
        playingId={wheel.playingId}
        trackIndex={wheel.trackIndex}
        volume={wheel.open ? harness.duckVolume : 1}
        wheelOpen={wheel.open}
      />
      <VariantHost
        key={`${variant.name}-${mountKey}`}
        variant={variant}
        wheel={wheel}
        speed={SPEEDS[harness.speed] ?? 1}
        reduced={reduced}
        keepOpen={harness.keepOpen}
        behaviour={behaviour}
        onNotice={showNotice}
      />
      <Hint keepOpen={harness.keepOpen} notice={notice} />
      <Picker names={variants.map((v) => v.name)} current={variantIndex} onSelect={selectVariant} onReplay={replay} />
      <DialRoot position="top-right" theme="dark" />
    </>
  )
}

type HostProps = {
  variant: Variant
  wheel: ReturnType<typeof useWheel>
  speed: number
  reduced: boolean
  keepOpen: boolean
  behaviour: { backdropTint: number } & Record<string, number>
  onNotice: (text: string) => void
}

// Keyed by variant, so switching swaps the DialKit panel along with the wheel.
function VariantHost({ variant, wheel, speed, reduced, keepOpen, behaviour, onNotice }: HostProps) {
  const exportTokens = useRef<(action: string) => void>(() => {})
  const values = useDialKit(variant.name, variant.controls, {
    id: variant.name.toLowerCase(),
    persist: true,
    onAction: (action) => exportTokens.current(action),
  })

  exportTokens.current = (action) => {
    const tokens = buildTokens(variant.name, values, behaviour)
    if (action === "downloadTokens") {
      downloadJson("tokens.json", tokens)
      onNotice("Downloaded tokens.json")
      return
    }
    navigator.clipboard.writeText(JSON.stringify(tokens, null, 2)).then(
      () => onNotice("Tokens copied"),
      (error: Error) => onNotice(`Copy failed: ${error.message}`),
    )
  }

  const Wheel = variant.Component
  // The backdrop moves with the wheel, so it shares the wheel's open spring.
  const openTransition = transitionFor(values.open as TransitionConfig, speed, reduced)

  return (
    <AnimatePresence>
      {wheel.open && (
        <motion.div
          key="backdrop"
          className="wheel-backdrop"
          data-keep-open={keepOpen || undefined}
          style={{ "--tint": behaviour.backdropTint } as CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: openTransition }}
          exit={{ opacity: 0, transition: exitTransition(speed, reduced) }}
        />
      )}
      {wheel.open && (
        <div key="wheel" className="wheel-layer">
          <Wheel
            values={values}
            stations={stations}
            highlighted={wheel.highlighted}
            playingId={wheel.playingId}
            trackIndex={wheel.trackIndex}
            speed={speed}
            reduced={reduced}
          />
        </div>
      )}
    </AnimatePresence>
  )
}

function Hint({ keepOpen, notice }: { keepOpen: boolean; notice: string | null }) {
  return (
    <div className="hint" role="status" aria-live="polite">
      {notice ? (
        <strong>{notice}</strong>
      ) : keepOpen ? (
        <>
          <span>
            <strong>Keep open is on.</strong> Flick, then click to tune in.
          </span>
          <span>Scroll skips the track</span>
        </>
      ) : (
        <>
          <span>
            Hold <kbd>Q</kbd>, flick toward a station, let go
          </span>
          <span>
            Scroll skips the track · <kbd>Esc</kbd> cancels
          </span>
        </>
      )}
    </div>
  )
}
