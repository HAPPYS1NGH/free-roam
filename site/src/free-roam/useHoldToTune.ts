import { useEffect, useRef, type RefObject } from "react"
import type { TrackedWheel } from "./useRadioTracking"

// How long a still finger rests before the wheel opens: past a tap and the
// start of a scroll, but well before iOS's own long press (about 500 ms).
const HOLD_MS = 280
// Moving further than this before the wheel opens means the visitor is scrolling.
const SLOP_PX = 10

// Touch's ⌥Q: press and hold anywhere in `area`, slide toward a station, let go
// to tune in. Finger movement drives the wheel exactly like mouse movement
// does in the app, and resting on a station tunes it live.
export function useHoldToTune(area: RefObject<HTMLElement | null>, wheel: TrackedWheel) {
  const latest = useRef(wheel)
  latest.current = wheel

  useEffect(() => {
    const element = area.current
    if (!element) return
    let timer = 0
    // Where the finger went down, then (once holding) where it last was.
    let origin: { x: number; y: number } | null = null
    let holding = false

    const reset = () => {
      window.clearTimeout(timer)
      origin = null
      holding = false
    }

    const start = (event: TouchEvent) => {
      reset()
      if (event.touches.length !== 1) return
      // Links keep their own long press (preview, share) and the sound toggle stays a toggle.
      if (event.target instanceof Element && event.target.closest("a, .p-sound")) return
      const touch = event.touches[0]
      origin = { x: touch.clientX, y: touch.clientY }
      timer = window.setTimeout(() => {
        holding = true
        latest.current.show("hold")
        navigator.vibrate?.(10)
      }, HOLD_MS)
    }

    const move = (event: TouchEvent) => {
      if (!origin) return
      const touch = event.touches[0]
      const dx = touch.clientX - origin.x
      const dy = touch.clientY - origin.y
      if (!holding) {
        if (Math.hypot(dx, dy) > SLOP_PX) reset()
        return
      }
      // The page stays put while the wheel is held.
      event.preventDefault()
      origin = { x: touch.clientX, y: touch.clientY }
      latest.current.move(dx, dy)
    }

    const end = (event: TouchEvent) => {
      if (holding) {
        // Stops the click that would follow, so a hold that started on
        // "Try the wheel" doesn't open the wheel again.
        event.preventDefault()
        latest.current.commit()
      }
      reset()
    }

    const cancel = () => {
      if (holding) latest.current.hide()
      reset()
    }

    // Android opens a context menu on a long press, and iOS starts selecting
    // text if the finger rests long enough, even with user-select off.
    const block = (event: Event) => {
      if (origin) event.preventDefault()
    }

    element.addEventListener("touchstart", start, { passive: true })
    element.addEventListener("touchmove", move, { passive: false })
    element.addEventListener("touchend", end, { passive: false })
    element.addEventListener("touchcancel", cancel)
    element.addEventListener("contextmenu", block)
    document.addEventListener("selectstart", block)
    return () => {
      window.clearTimeout(timer)
      element.removeEventListener("touchstart", start)
      element.removeEventListener("touchmove", move)
      element.removeEventListener("touchend", end)
      element.removeEventListener("touchcancel", cancel)
      element.removeEventListener("contextmenu", block)
      document.removeEventListener("selectstart", block)
    }
  }, [area])
}
