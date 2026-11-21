import type { CSSProperties } from "react"
import { AnimatePresence, motion } from "motion/react"
import tokens from "../../tokens.json"
import { WheelFace } from "./WheelFace"

type Props = {
  open: boolean
  highlighted: number
  onChoose: (index: number) => void
  onClose: () => void
}

const filterIn = { duration: tokens.animations.filterIn.duration, ease: tokens.animations.filterIn.bezier as [number, number, number, number] }
const filterOut = { duration: tokens.animations.filterOut.duration, ease: tokens.animations.filterOut.bezier as [number, number, number, number] }

// The Mac app's overlay: the page behind stays sharp but loses colour and gets
// the screen-shaped vignette, with the same values and fades as the app.
export function WheelOverlay({ open, highlighted, onChoose, onClose }: Props) {
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
        <button className="wheel-close" onClick={onClose}>Close</button>
      </section>}
    </AnimatePresence>
  </>
}
