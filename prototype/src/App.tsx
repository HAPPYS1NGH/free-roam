import { DialRoot, useDialKit, type TransitionConfig } from "dialkit"
import "dialkit/styles.css"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Desktop } from "./Desktop"
import { loadLibrary, type Library } from "./library"
import { RadioWheel, radioWheelControls } from "./RadioWheel"
import { preloadSounds, RETUNE_TAKES, SILENT_DB, SOUND_PACKS, type SoundName, type SoundPack } from "./sound"
import { slotsFor } from "./stations"
import { transitionFor } from "./timing"
import { buildTokens, downloadJson } from "./tokens"
import { useViewport } from "./useViewport"
import { useWheel } from "./useWheel"

const SPEEDS: Record<string, number> = { "1x": 1, "0.5x": 0.5, "0.25x": 0.25 }
const NOTICE_MS = 1600

export function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [localSounds, setLocalSounds] = useState(0)

  useEffect(() => {
    preloadSounds().then(setLocalSounds)
    loadLibrary().then(setLibrary)
  }, [])

  if (!library) return <Desktop playlist={null} volume={1} wheelOpen={false} />
  return <Studio library={library} localSounds={localSounds} />
}

function Studio({ library, localSounds }: { library: Library; localSounds: number }) {
  const reduced = useReducedMotion() ?? false
  const slots = useMemo(() => slotsFor(library.playlists), [library])
  const [notice, setNotice] = useState<string | null>(null)
  const actions = useRef<(action: string) => void>(() => {})
  const onAction = (action: string) => actions.current(action)

  const harness = useDialKit(
    "Harness",
    {
      keepOpen: false,
      speed: { type: "select", options: ["1x", "0.5x", "0.25x"], default: "1x" },
      replayOpen: { type: "action", label: "Replay open" },
      holdDelayMs: [150, 0, 400, 10],
      deadzone: [1.5, 0.5, 6, 0.1],
      pickRadius: [60, 20, 200, 5],
      scrollStep: [12, 4, 60, 1],
      dwellMs: [1000, 0, 2000, 50],
      backdropBlur: [0, 0, 5, 0.1],
      backdropSaturation: [0.45, 0, 1, 0.05],
      backdropBrightness: [1.04, 0.4, 1.2, 0.01],
      vignette: [1, 0, 1.5, 0.05],
      duckVolume: [0.4, 0, 1, 0.05],
      soundPack: { type: "select", options: [...SOUND_PACKS], default: "Local" },
      retuneTake: { type: "select", options: [...RETUNE_TAKES], default: "retune" },
      retuneVolumeDb: [-4.5, SILENT_DB, 0, 0.5],
      uiVolumeDb: [-2, SILENT_DB, 0, 0.5],
      hoverVolumeDb: [-2, SILENT_DB, 0, 0.5],
    },
    { id: "harness-v5", persist: true, onAction },
  )
  const look = useDialKit("Radio wheel", radioWheelControls, { id: "radio-wheel-v4", persist: true, onAction })
  // Dead zone and blur are %H like the rest of the HUD.
  const unit = useViewport().height / 100

  const wheel = useWheel({
    slots,
    deadzone: harness.deadzone * unit,
    pickRadius: harness.pickRadius,
    scrollStep: harness.scrollStep,
    dwellMs: harness.dwellMs,
    holdDelayMs: harness.holdDelayMs,
    keepOpen: harness.keepOpen,
    sounds: {
      pack: harness.soundPack as SoundPack,
      retuneTake: harness.retuneTake as SoundName,
      retuneVolumeDb: harness.retuneVolumeDb,
      uiVolumeDb: harness.uiVolumeDb,
      hoverVolumeDb: harness.hoverVolumeDb,
    },
  })

  const noticeTimer = useRef(0)
  const showNotice = useCallback((text: string) => {
    window.clearTimeout(noticeTimer.current)
    setNotice(text)
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  actions.current = (action) => {
    if (action === "replayOpen") return wheel.peek()
    const tokens = buildTokens("Radio wheel", look, {
      holdDelayMs: harness.holdDelayMs,
      deadzone: harness.deadzone,
      pickRadius: harness.pickRadius,
      scrollStep: harness.scrollStep,
      dwellMs: harness.dwellMs,
      backdropBlur: harness.backdropBlur,
      backdropSaturation: harness.backdropSaturation,
      backdropBrightness: harness.backdropBrightness,
      vignette: harness.vignette,
      duckVolume: harness.duckVolume,
      retuneTake: harness.retuneTake,
      retuneVolumeDb: harness.retuneVolumeDb,
      uiVolumeDb: harness.uiVolumeDb,
      hoverVolumeDb: harness.hoverVolumeDb,
    })
    if (action === "downloadTokens") {
      downloadJson("tokens.json", tokens)
      showNotice("Downloaded tokens.json")
      return
    }
    navigator.clipboard.writeText(JSON.stringify(tokens, null, 2)).then(
      () => showNotice("Tokens copied"),
      (error: Error) => showNotice(`Copy failed: ${error.message}`),
    )
  }

  const speed = SPEEDS[harness.speed] ?? 1
  const openTransition = transitionFor(look.open as TransitionConfig, speed, reduced)
  const closeTransition = transitionFor(look.close as TransitionConfig, speed, reduced)
  // The screen filter has its own, slower timing: it keeps fading out after
  // the wheel has already gone, as in GTA.
  const filterIn = transitionFor(look.filterIn as TransitionConfig, speed, reduced)
  const filterOut = transitionFor(look.filterOut as TransitionConfig, speed, reduced)
  const playing = slots.find((slot) => slot.id === wheel.playingId)

  return (
    <>
      <Desktop
        playlist={playing?.kind === "playlist" ? playing.playlist : null}
        volume={wheel.open ? harness.duckVolume : 1}
        wheelOpen={wheel.open}
      />
      <AnimatePresence>
        {wheel.open && (
          <motion.div
            key="backdrop"
            className="wheel-backdrop"
            data-keep-open={harness.keepOpen || undefined}
            style={
              {
                "--blur": `${harness.backdropBlur * unit}px`,
                "--saturation": harness.backdropSaturation,
                "--brightness": harness.backdropBrightness,
                "--vignette": harness.vignette,
              } as CSSProperties
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, pointerEvents: "auto", transition: filterIn }}
            // The cursor comes back as soon as the wheel goes, not after the fade.
            exit={{ opacity: 0, pointerEvents: "none", transition: filterOut }}
          />
        )}
      </AnimatePresence>
      {/* A separate group, because AnimatePresence holds every exiting child
          until the slowest one finishes, and the wheel leaves long before the
          filter does. */}
      <AnimatePresence>
        {wheel.open && (
          <div key="wheel" className="wheel-layer">
            <RadioWheel
              slots={slots}
              highlighted={wheel.highlighted}
              look={look}
              openTransition={openTransition}
              closeTransition={closeTransition}
            />
          </div>
        )}
      </AnimatePresence>
      <Hint
        keepOpen={harness.keepOpen}
        notice={notice}
        library={library}
        sounds={harness.soundPack === "Local" && localSounds > 0 ? `${localSounds} local sounds` : "synthesised sounds"}
      />
      <DialRoot position="top-right" theme="dark" />
    </>
  )
}

type HintProps = { keepOpen: boolean; notice: string | null; library: Library; sounds: string }

function Hint({ keepOpen, notice, library, sounds }: HintProps) {
  if (notice) {
    return (
      <div className="hint" role="status" aria-live="polite">
        <strong>{notice}</strong>
      </div>
    )
  }
  return (
    <div className="hint" role="status" aria-live="polite">
      <span>
        {keepOpen ? (
          <>
            <strong>Keep open is on.</strong> Move the mouse or scroll, click to tune in.
          </>
        ) : (
          <>
            Hold <kbd>Q</kbd>, move the mouse or scroll, let go to keep it. Tap <kbd>Q</kbd> for the next station
          </>
        )}
      </span>
      <span>Rest on a station for a second to tune in live · <kbd>Esc</kbd> closes</span>
      <span>
        {library.source === "library"
          ? `Your library: ${library.playlists.length} playlists`
          : "Mock playlists. Run npm run library to use yours"}
        {` · ${sounds}`}
      </span>
    </div>
  )
}
