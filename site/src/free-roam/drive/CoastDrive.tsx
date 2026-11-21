import { useEffect, useRef, useState, type ReactNode } from "react"
import { createDrive, type Drive, type DriveOptions } from "./scene"

// Live WebGL coast drive. Renders `fallback` if WebGL can't start.
// `grabArea` selects the ancestor whose pointers can drag the sun and moon.
export function CoastDrive({ startHour, onHour, fallback, label, grabArea, ...options }: DriveOptions & {
  startHour: number
  onHour: (hour: number) => void
  fallback: ReactNode
  label: string
  grabArea?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const drive = useRef<Drive | null>(null)
  const [failed, setFailed] = useState(false)
  const latest = useRef({ options, onHour, startHour, grabArea })
  latest.current = { options, onHour, startHour, grabArea }

  // The canvas is created inside the effect so StrictMode's remount gets a
  // fresh WebGL context instead of a disposed one.
  useEffect(() => {
    try {
      const { options, startHour, grabArea } = latest.current
      const stage = grabArea ? host.current!.closest<HTMLElement>(grabArea) ?? undefined : undefined
      drive.current = createDrive(host.current!, options, startHour, hour => latest.current.onHour(hour), stage)
    } catch (error) {
      console.error("Coast drive could not start WebGL", error)
      setFailed(true)
    }
    return () => { drive.current?.dispose(); drive.current = null }
  }, [])

  const { paint, cycleSeconds, lockHour, speed, still } = options
  useEffect(() => { drive.current?.setOptions({ paint, cycleSeconds, lockHour, speed, still }) }, [paint, cycleSeconds, lockHour, speed, still])

  if (failed) return <>{fallback}</>
  return <div ref={host} className="drive-host" role="img" aria-label={label} />
}
