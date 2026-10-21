import { useEffect, useState } from "react"

// Scales a wheel of `size` pixels down so it never overflows a small window.
export function useFit(size: number) {
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return Math.min(1, (viewport.height - 140) / size, (viewport.width - 32) / size)
}
