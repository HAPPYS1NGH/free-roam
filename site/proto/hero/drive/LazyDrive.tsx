import { lazy, Suspense, useEffect, useState } from "react"
import { useFx } from "../radio"

// three.js and the scene load as a separate chunk, so visitors who never get
// the live drive never download it.
const CoastDrive = lazy(() => import("../../../src/free-roam/drive/CoastDrive").then(module => ({ default: module.CoastDrive })))

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
export function LazyDrive({ className = "", label }: { className?: string; label: string }) {
  const fx = useFx()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!canDrive()) return
    const start = () => setReady(true)
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 1500 })
      return () => cancelIdleCallback(id)
    }
    const id = globalThis.setTimeout(start, 600)
    return () => globalThis.clearTimeout(id)
  }, [])
  if (!ready) return null
  const now = new Date()
  return <div className={`lazy-drive ${className}`}>
    <Suspense fallback={null}>
      <CoastDrive label={label} paint="Champagne" cycleSeconds={40} lockHour={null} speed={fx.speed} still={false}
        startHour={now.getHours() + now.getMinutes() / 60} onHour={() => {}} fallback={null} />
    </Suspense>
  </div>
}
