import { useCallback, useEffect, useRef, useState } from "react"
import { slotAngle, slotForVector } from "./geometry"
import { playSound, unlockAudio } from "./sound"
import type { Station } from "./stations"

type Options = {
  stations: Station[]
  deadzone: number
  keepOpen: boolean
  staticVolume: number
  tickVolume: number
}

// The flick is read from mouse movement since the wheel opened, not from where
// the cursor is. The virtual cursor is clamped so a flick "sticks" until you
// move back toward the centre, the same way a thumbstick wheel behaves.
const CURSOR_LIMIT = 160
// Roughly how long Music.app takes to start a playlist after the command.
const SWITCH_DELAY_MS = 250
const PEEK_MS = 1100

function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
}

function isHarnessChrome(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(".dialkit-root, .proto-picker")
}

export function useWheel(options: Options) {
  const [open, setOpen] = useState(options.keepOpen)
  const [highlighted, setHighlighted] = useState<number | null>(null)
  const [playingId, setPlayingId] = useState<string | null>("gym")
  const [trackIndex, setTrackIndex] = useState(0)

  // Event handlers read these instead of state so they always see the latest
  // values without re-subscribing on every render.
  const settings = useRef(options)
  settings.current = options
  const openRef = useRef(options.keepOpen)
  const highlightRef = useRef<number | null>(null)
  const playingRef = useRef<string | null>("gym")
  const cursor = useRef({ x: 0, y: 0 })

  const highlight = (index: number | null) => {
    if (index === highlightRef.current) return
    highlightRef.current = index
    setHighlighted(index)
    if (index !== null) playSound("tick", settings.current.tickVolume)
  }

  const show = () => {
    if (openRef.current) return
    openRef.current = true
    cursor.current = { x: 0, y: 0 }
    setOpen(true)
  }

  const hide = () => {
    if (settings.current.keepOpen) return
    openRef.current = false
    setOpen(false)
    highlightRef.current = null
    setHighlighted(null)
  }

  const tuneTo = (index: number) => {
    const station = settings.current.stations[index]
    if (!station || station.kind === "empty") return
    const nextId = station.kind === "off" ? null : station.id
    if (nextId === playingRef.current) return
    playSound("static", settings.current.staticVolume)
    playingRef.current = nextId
    window.setTimeout(() => {
      setPlayingId(nextId)
      setTrackIndex(0)
    }, SWITCH_DELAY_MS)
  }

  const commit = () => {
    if (highlightRef.current !== null) tuneTo(highlightRef.current)
    hide()
  }

  const cancel = () => {
    highlight(null)
    hide()
  }

  const step = (direction: 1 | -1) => {
    const { stations } = settings.current
    const playingIndex = stations.findIndex((s) => s.id === playingRef.current)
    const from = highlightRef.current ?? Math.max(0, playingIndex)
    const next = (from + direction + stations.length) % stations.length
    const angle = slotAngle(next, stations.length)
    cursor.current = { x: Math.sin(angle) * CURSOR_LIMIT, y: -Math.cos(angle) * CURSOR_LIMIT }
    highlight(next)
  }

  const skip = (direction: 1 | -1) => {
    if (!playingRef.current) return
    playSound("tick", settings.current.tickVolume)
    setTrackIndex((i) => i + direction)
  }

  useEffect(() => {
    let scrollDistance = 0
    let lastSkip = 0

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextField(e.target)) return
      if (e.code === "KeyQ" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        if (e.repeat) return
        unlockAudio().catch((error) => console.warn("Audio unavailable:", error))
        show()
        return
      }
      if (!openRef.current || settings.current.keepOpen) return
      // While the wheel is held open it owns the keyboard, so the variant
      // picker underneath doesn't react to arrows or number keys.
      e.stopPropagation()
      if (e.key === "Escape") cancel()
      else if (e.key === "ArrowRight") step(1)
      else if (e.key === "ArrowLeft") step(-1)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyQ" && openRef.current) commit()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!openRef.current || isHarnessChrome(e.target)) return
      const c = cursor.current
      c.x += e.movementX
      c.y += e.movementY
      const length = Math.hypot(c.x, c.y)
      if (length > CURSOR_LIMIT) {
        c.x *= CURSOR_LIMIT / length
        c.y *= CURSOR_LIMIT / length
      }
      const { deadzone, stations } = settings.current
      highlight(length < deadzone ? null : slotForVector(c.x, c.y, stations.length))
    }

    const onWheel = (e: WheelEvent) => {
      if (!openRef.current || isHarnessChrome(e.target)) return
      e.preventDefault()
      scrollDistance += e.deltaY
      const now = performance.now()
      if (Math.abs(scrollDistance) < 40 || now - lastSkip < 180) return
      skip(scrollDistance > 0 ? 1 : -1)
      scrollDistance = 0
      lastSkip = now
    }

    // Only "keep open" mode commits on click; normally releasing Q commits.
    const onClick = (e: MouseEvent) => {
      if (settings.current.keepOpen && !isHarnessChrome(e.target)) commit()
    }

    // Switching windows mid-hold means the keyup never arrives.
    const onBlur = () => {
      if (openRef.current && !settings.current.keepOpen) cancel()
    }

    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("click", onClick)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("click", onClick)
      window.removeEventListener("blur", onBlur)
    }
    // Handlers only read refs, so subscribing once is enough.
  }, [])

  useEffect(() => {
    openRef.current = options.keepOpen
    setOpen(options.keepOpen)
    if (!options.keepOpen) {
      highlightRef.current = null
      setHighlighted(null)
    }
  }, [options.keepOpen])

  // Opens the wheel briefly so its entrance can be watched without holding Q.
  // Stable across renders because show/cancel only touch refs and setters.
  const peek = useCallback(() => {
    if (openRef.current) return
    show()
    window.setTimeout(() => {
      if (!settings.current.keepOpen) cancel()
    }, PEEK_MS)
  }, [])

  return { open, highlighted, playingId, trackIndex, peek }
}
