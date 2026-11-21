import { useEffect, useState } from "react"

// GTA sizes its HUD from the screen height, so the wheel does too.
export function useViewport() {
  // Match the prerendered wheel on the first client render, then measure the screen.
  const [viewport, setViewport] = useState({ width: 1024, height: 900 })

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return viewport
}

// The Mac app sizes the wheel from the screen it opens on, not the window.
// On a Mac, screen.height in CSS px is the screen's height in points.
export function useScreenHeight() {
  const [height, setHeight] = useState(900)
  useEffect(() => setHeight(window.screen.height), [])
  return height
}
