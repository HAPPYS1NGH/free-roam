import { DialRoot, useDialKit, useDialKitController, type TransitionConfig } from "dialkit"
import "dialkit/styles.css"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Desktop } from "./Desktop"
import { isLegibilityPreset, LEGIBILITY_PRESETS, legibilityControls, legibilityReadout } from "./legibility"
import { loadLibrary, type Library } from "./library"
import { RadioWheel, radioWheelControls, type RingLayout } from "./RadioWheel"
import closeSound from "../../assets/sounds/close.wav?url"
import hoverSound from "../../assets/sounds/hover.wav?url"
import openSound from "../../assets/sounds/open.wav?url"
import retuneSound from "../../assets/sounds/retune.wav?url"
import { preloadSounds, SILENT_DB } from "./sound"
import { crowdedPlaylists, slotsFor } from "./stations"
import { transitionFor } from "./timing"
import { buildTokens, downloadJson } from "./tokens"
import { useViewport } from "./useViewport"
import { useWheel } from "./useWheel"
import { loadWallpaper } from "./wallpaper"

const SPEEDS: Record<string, number> = { "1x": 1, "0.5x": 0.5, "0.25x": 0.25 }
const NOTICE_MS = 1600

export function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [wallpaper, setWallpaper] = useState<string | null>(null)
  useEffect(() => {
    preloadSounds({ open: openSound, close: closeSound, hover: hoverSound, retune: retuneSound }).catch(error => console.warn("Sounds unavailable:", error))
    Promise.all([loadLibrary(), loadWallpaper()]).then(([library, wallpaper]) => {
      setWallpaper(wallpaper)
      setLibrary(library)
    })
  }, [])

  if (!library) return <Desktop playlist={null} volume={1} wheelOpen={false} wallpaper={null} />
  return <Studio library={library} wallpaper={wallpaper} />
}

type StudioProps = { library: Library; wallpaper: string | null }

function Studio({ library, wallpaper }: StudioProps) {
  const reduced = useReducedMotion() ?? false
  const [notice, setNotice] = useState<string | null>(null)
  const actions = useRef<(action: string) => void>(() => {})
  const onAction = (action: string) => actions.current(action)

  // Registered first so it sits at the top of the panel.
  const legibility = useDialKitController("Legibility", legibilityControls, {
    id: "legibility-v1",
    persist: true,
    onAction,
  })
  const tuning = legibility.values
  const stationCount = Number(tuning.stations)
  const slots = useMemo(
    () => slotsFor(crowdedPlaylists(library.playlists, stationCount)),
    [library, stationCount],
  )

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
      backdropSaturation: [0.45, 0, 1, 0.05],
      backdropBrightness: [1.04, 0.4, 1.2, 0.01],
      vignette: [1, 0, 1.5, 0.05],
      duckVolume: [0.4, 0, 1, 0.05],
      retuneVolumeDb: [-4.5, SILENT_DB, 0, 0.5],
      uiVolumeDb: [-2, SILENT_DB, 0, 0.5],
      hoverVolumeDb: [-2, SILENT_DB, 0, 0.5],
    },
    { id: "harness-v5", persist: true, onAction },
  )
  const look = useDialKit("Radio wheel", radioWheelControls, { id: "radio-wheel-v5", persist: true, onAction })
  const shownWallpaper = tuning.wallpaper === "Yours" ? wallpaper : null
  const readout = legibilityReadout({
    backdropBlur: tuning.backdropBlur,
    idleOpacity: tuning.idleOpacity,
    stations: tuning.stations,
    wallpaper: shownWallpaper ? "your wallpaper" : "stand-in wallpaper",
    layout: tuning.layout,
    stationSize: tuning.stationSize,
    captionSize: look.captionSize,
  })
  // The dead zone is %H like the rest of the HUD.
  const unit = useViewport().height / 100

  const wheel = useWheel({
    slots,
    ignoreSelector: ".dialkit-root",
    deadzone: harness.deadzone * unit,
    pickRadius: harness.pickRadius,
    scrollStep: harness.scrollStep,
    dwellMs: harness.dwellMs,
    holdDelayMs: harness.holdDelayMs,
    keepOpen: harness.keepOpen,
    sounds: {
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

  const copy = (text: string, done: string) =>
    navigator.clipboard.writeText(text).then(
      () => showNotice(done),
      (error: Error) => showNotice(`Copy failed: ${error.message}`),
    )

  actions.current = (action) => {
    if (action === "replayOpen") return wheel.peek()
    if (isLegibilityPreset(action)) return legibility.setValues(LEGIBILITY_PRESETS[action])
    if (action === "copyValues") return void copy(readout, "Values copied")
    const sizes = { ...look, idleOpacity: tuning.idleOpacity, stationSize: tuning.stationSize }
    const tokens = buildTokens("Radio wheel", sizes, {
      holdDelayMs: harness.holdDelayMs,
      deadzone: harness.deadzone,
      pickRadius: harness.pickRadius,
      scrollStep: harness.scrollStep,
      dwellMs: harness.dwellMs,
      backdropBlurPx: tuning.backdropBlur,
      backdropSaturation: harness.backdropSaturation,
      backdropBrightness: harness.backdropBrightness,
      vignette: harness.vignette,
      duckVolume: harness.duckVolume,
      retuneVolumeDb: harness.retuneVolumeDb,
      uiVolumeDb: harness.uiVolumeDb,
      hoverVolumeDb: harness.hoverVolumeDb,
    })
    if (action === "downloadTokens") {
      downloadJson("tokens.json", tokens)
      showNotice("Downloaded tokens.json")
      return
    }
    copy(JSON.stringify(tokens, null, 2), "Tokens copied")
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
        wallpaper={shownWallpaper}
      />
      <AnimatePresence>
        {wheel.open && (
          <motion.div
            key="backdrop"
            className="wheel-backdrop"
            data-keep-open={harness.keepOpen || undefined}
            style={
              {
                "--blur": `${tuning.backdropBlur}px`,
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
              idleOpacity={tuning.idleOpacity}
              stationSize={tuning.stationSize}
              layout={tuning.layout as RingLayout}
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
        wallpaper={wallpaper !== null}
        readout={readout}
      />
      <DialRoot position="top-right" theme="dark" />
    </>
  )
}

type HintProps = {
  keepOpen: boolean
  notice: string | null
  library: Library
  wallpaper: boolean
  readout: string
}

function Hint({ keepOpen, notice, library, wallpaper, readout }: HintProps) {
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
        {wallpaper ? "" : " · Run npm run wallpaper to use your desktop picture"}
      </span>
      <span className="hint-readout">{readout}</span>
    </div>
  )
}
