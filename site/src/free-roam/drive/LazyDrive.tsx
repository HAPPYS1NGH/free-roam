import { lazy, Suspense, useEffect, useState } from "react"

// three.js and the scene load as a separate chunk, so visitors who never get
// the live drive never download it.
const CoastDrive = lazy(() => import("./CoastDrive").then(module => ({ default: module.CoastDrive })))

type Connection = { saveData?: boolean; effectiveType?: string }

// The live drive is for desktops that can afford it. Phones, Data Saver, slow
// connections and reduced motion keep the still photo underneath.
function canDrive() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return false
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false
  const connection = (navigator as Navigator & { connection?: Connection }).connection
  if (connection?.saveData) return false
  if (connection?.effectiveType && /(^|-)(2g|3g)$/.test(connection.effectiveType)) return false
  return true
}

// Starts once the page has painted and the browser is idle, then fades in over
// the photo. The scene itself pauses when the tab is hidden or scrolled away.
// A full day passes every 40 seconds, starting from the visitor's own hour, and
// the sun or moon can be dragged anywhere on the hero to set the time.
export function LazyDrive({ className = "" }: { className?: string }) {
  const [startHour, setStartHour] = useState<number | null>(null)
  useEffect(() => {
    if (!canDrive()) return
    const start = () => {
      const now = new Date()
      setStartHour(now.getHours() + now.getMinutes() / 60)
    }
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 1500 })
      return () => cancelIdleCallback(id)
    }
    const id = globalThis.setTimeout(start, 600)
    return () => globalThis.clearTimeout(id)
  }, [])
  if (startHour === null) return null
  return <div className={className}>
    <Suspense fallback={null}>
      <CoastDrive paint="Champagne" cycleSeconds={40} lockHour={null} speed={1} still={false}
        startHour={startHour} onHour={() => {}} fallback={null} grabArea=".ta-hero" />
    </Suspense>
  </div>
}
