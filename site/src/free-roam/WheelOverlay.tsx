import { useRef, type CSSProperties, type PointerEvent } from "react"
import { AnimatePresence, motion } from "motion/react"
import tokens from "../../tokens.json"
import { WheelFace } from "./WheelFace"

type Props = {
  open: boolean
  highlighted: number
  onChoose: (index: number) => void
  onClose: () => void
  // Touch pad input: finger movement, and lifting the finger.
  onMove: (dx: number, dy: number) => void
  onCommit: () => void
}

const filterIn = { duration: tokens.animations.filterIn.duration, ease: tokens.animations.filterIn.bezier as [number, number, number, number] }
const filterOut = { duration: tokens.animations.filterOut.duration, ease: tokens.animations.filterOut.bezier as [number, number, number, number] }

// The Mac app's overlay: the page behind stays sharp but loses colour and gets
// the screen-shaped vignette, with the same values and fades as the app.
export function WheelOverlay({ open, highlighted, onChoose, onClose, onMove, onCommit }: Props) {
  return <>
    <AnimatePresence>
      {open && <motion.div key="backdrop" className="wheel-backdrop"
        style={{
          "--saturation": tokens.behaviour.backdropSaturation,
          "--brightness": tokens.behaviour.backdropBrightness,
          "--blur": `${tokens.behaviour.backdropBlurPx}px`,
          "--vignette": tokens.behaviour.vignette,
        } as CSSProperties}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: filterIn }}
        exit={{ opacity: 0, pointerEvents: "none", transition: filterOut }} />}
    </AnimatePresence>
    {/* Separate from the backdrop: AnimatePresence holds exiting children until
        the slowest finishes, and the wheel leaves long before the filter. */}
    <AnimatePresence>
      {open && <section key="wheel" className="wheel-layer" role="dialog" aria-modal="true" aria-label="Choose a station">
        <div className="wheel-layer-face">
          <WheelFace autoFocus highlighted={highlighted} onChoose={onChoose} />
        </div>
        {/* The app freezes the pointer and picks from mouse movement alone, so
            with a mouse the cursor hides and a click stands in for letting go
            of ⌥Q. Touch screens skip this layer and tap the stations. */}
        <div className="wheel-pick" aria-hidden="true" onClick={() => onChoose(highlighted)} />
        <p className="wheel-hint">Move or scroll to pick. Let go of <kbd>Q</kbd> or click to tune in. <kbd>Esc</kbd> closes.</p>
        <TouchPad onMove={onMove} onCommit={onCommit} />
        <button className="wheel-close" onClick={onClose}>Close</button>
      </section>}
    </AnimatePresence>
  </>
}

// Touch screens have no mouse to flick, so a trackpad sits under the wheel:
// dragging on it moves the pick exactly as mouse movement does in the app, and
// lifting the finger tunes in, like letting go of ⌥Q. A tap on it tunes in
// the station that's highlighted. Hidden where there's a mouse.
function TouchPad({ onMove, onCommit }: { onMove: Props["onMove"]; onCommit: Props["onCommit"] }) {
  const last = useRef<{ x: number; y: number } | null>(null)
  // A dot follows the thumb, so the pad reads as a trackpad being touched.
  const showThumb = (event: PointerEvent<HTMLDivElement>) => {
    const pad = event.currentTarget
    const box = pad.getBoundingClientRect()
    pad.style.setProperty("--thumb-x", `${event.clientX - box.left}px`)
    pad.style.setProperty("--thumb-y", `${event.clientY - box.top}px`)
  }
  const down = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.touched = ""
    showThumb(event)
    last.current = { x: event.clientX, y: event.clientY }
  }
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (!last.current) return
    showThumb(event)
    onMove(event.clientX - last.current.x, event.clientY - last.current.y)
    last.current = { x: event.clientX, y: event.clientY }
  }
  const release = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    delete event.currentTarget.dataset.touched
    if (!last.current) return
    last.current = null
    if (commit) onCommit()
  }
  return <div className="wheel-pad" aria-hidden="true" onPointerDown={down} onPointerMove={drag}
    onPointerUp={event => release(event, true)} onPointerCancel={event => release(event, false)}>
    <span className="wheel-pad-keys"><kbd>⌥</kbd><kbd>Q</kbd> held</span>
    <strong>Slide your thumb, like a trackpad</strong>
    <span>Let go to tune in</span>
  </div>
}
