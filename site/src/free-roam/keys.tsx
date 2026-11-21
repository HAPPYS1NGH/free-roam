import { useEffect, useState, type ReactNode } from "react"

// True while `key` is physically held (without ⌘ or Ctrl), for keycaps that press down.
export function useKeyHeld(key: string) {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const code = `Key${key.toUpperCase()}`
    const down = (event: KeyboardEvent) => { if (event.code === code && !event.metaKey && !event.ctrlKey) setHeld(true) }
    const up = (event: KeyboardEvent) => { if (event.code === code) setHeld(false) }
    const blur = () => setHeld(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur) }
  }, [key])
  return held
}

export function useAltHeld() {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const sync = (event: KeyboardEvent) => setHeld(event.altKey)
    const blur = () => setHeld(false)
    window.addEventListener("keydown", sync)
    window.addEventListener("keyup", sync)
    window.addEventListener("blur", blur)
    return () => { window.removeEventListener("keydown", sync); window.removeEventListener("keyup", sync); window.removeEventListener("blur", blur) }
  }, [])
  return held
}

export function Keycap({ children, down, size = "md" }: { children: ReactNode; down?: boolean; size?: "sm" | "md" | "xl" }) {
  return <kbd className={`keycap keycap-${size}`} data-down={down ? "" : undefined}>{children}</kbd>
}
