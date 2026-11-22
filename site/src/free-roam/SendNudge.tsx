import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { DownloadLink } from "./DownloadLink"
import { Keycap } from "./keys"
import { useRadio } from "./RadioProvider"

// After a touch visitor tunes in, a small bar offers to send the page to their
// Mac, the moment they're most interested. It waits until the hero is mostly
// scrolled away so it never covers the caption's sound toggle, hides while
// the wheel is open, and stays closed once dismissed. Hidden where there's a mouse.
export function SendNudge() {
  const { retunes, wheel } = useRadio()
  const reduced = useReducedMotion()
  const [heroInView, setHeroInView] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const hero = document.querySelector(".ta-hero")
    if (!hero) return
    const observer = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting), { threshold: 0.5 })
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  const shown = retunes > 0 && !dismissed && !heroInView && !wheel.open
  const offset = reduced ? 0 : 16
  return <AnimatePresence>
    {shown && <motion.aside key="nudge" className="p-nudge" aria-labelledby="nudge-title"
      initial={{ opacity: 0, y: offset }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } }}
      exit={{ opacity: 0, y: offset, transition: { duration: 0.18, ease: "easeOut" } }}>
      <p id="nudge-title">On a Mac, it’s <Keycap size="sm">⌥</Keycap><Keycap size="sm">Q</Keycap> in any app.</p>
      <DownloadLink className="p-button p-button-sm" elsewhere="Send to your Mac">Download</DownloadLink>
      <button className="p-nudge-close" aria-label="Dismiss" onClick={() => setDismissed(true)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
    </motion.aside>}
  </AnimatePresence>
}
