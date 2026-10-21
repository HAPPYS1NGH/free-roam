import { useCallback, useEffect, useRef, useState } from "react"
import { slotAngle, slotForVector } from "./geometry"
import { playSound, unlockAudio, type SoundName } from "./sound"
import type { Slot } from "./stations"

type Options = {
  slots: Slot[]
  deadzone: number
  dwellMs: number
  holdDelayMs: number
  keepOpen: boolean
  sounds: { retuneTake: SoundName; retuneVolume: number; uiVolume: number }
}

// The pick is read from mouse movement since the wheel opened, not from where
// the cursor is. The virtual cursor is clamped, so a flick "sticks" until you
// push in another direction, the same way GTA's wheel behaves.
const CURSOR_LIMIT = 160
// Roughly how long Music.app takes to start a playlist after the command.
const SWITCH_DELAY_MS = 250
// One mouse-wheel notch moves one station, like GTA's scroll-to-retune.
const SCROLL_STEP = 40
const SCROLL_REPEAT_MS = 70
const PEEK_MS = 1200

function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
}

function isHarnessChrome(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(".dialkit-root")
}

export function useWheel(options: Options) {
  const firstStation = options.slots.find((slot) => slot.kind === "playlist")?.id ?? null
  const [open, setOpen] = useState(options.keepOpen)
  const [highlighted, setHighlighted] = useState(0)
  const [playingId, setPlayingId] = useState<string | null>(firstStation)

  // Event handlers read these instead of state so they always see the latest
  // values without re-subscribing on every render.
  const settings = useRef(options)
  settings.current = options
  const openRef = useRef(options.keepOpen)
  const highlightRef = useRef(0)
  const playingRef = useRef<string | null>(firstStation)
  const cursor = useRef({ x: 0, y: 0 })
  const dwellTimer = useRef(0)
  const holdTimer = useRef(0)

  const uiSound = (name: SoundName) => playSound(name, settings.current.sounds.uiVolume)

  const playingIndex = () => {
    const id = playingRef.current ?? "off"
    return Math.max(0, settings.current.slots.findIndex((slot) => slot.id === id))
  }

  const tune = (index: number) => {
    window.clearTimeout(dwellTimer.current)
    const slot = settings.current.slots[index]
    if (!slot) return
    const nextId = slot.kind === "off" ? null : slot.id
    if (nextId === playingRef.current) return
    const { retuneTake, retuneVolume } = settings.current.sounds
    playSound(retuneTake, retuneVolume)
    playingRef.current = nextId
    window.setTimeout(() => setPlayingId(nextId), SWITCH_DELAY_MS)
  }

  // GTA retunes live as you pass over stations. Waiting for the highlight to
  // rest briefly means a sweep across the ring doesn't send Music a play
  // command for every station on the way.
  const highlight = (index: number) => {
    if (index === highlightRef.current) return
    highlightRef.current = index
    setHighlighted(index)
    uiSound("hover")
    window.clearTimeout(dwellTimer.current)
    dwellTimer.current = window.setTimeout(() => tune(index), settings.current.dwellMs)
  }

  const show = () => {
    if (openRef.current) return
    openRef.current = true
    cursor.current = { x: 0, y: 0 }
    // The wheel opens on whatever is playing, like GTA.
    highlightRef.current = playingIndex()
    setHighlighted(highlightRef.current)
    setOpen(true)
    uiSound("open")
  }

  const hide = () => {
    window.clearTimeout(dwellTimer.current)
    if (settings.current.keepOpen) return
    openRef.current = false
    setOpen(false)
    uiSound("close")
  }

  const commit = () => {
    tune(highlightRef.current)
    hide()
  }

  // A quick tap of Q skips to the next station without showing the wheel,
  // like GTA. Radio Off is skipped so tapping never silences the music.
  const tapNext = () => {
    const { slots } = settings.current
    let next = (playingIndex() + 1) % slots.length
    if (slots[next].kind === "off") next = (next + 1) % slots.length
    tune(next)
  }

  const step = (direction: 1 | -1) => {
    const count = settings.current.slots.length
    const next = (highlightRef.current + direction + count) % count
    const angle = slotAngle(next, count)
    cursor.current = { x: Math.sin(angle) * CURSOR_LIMIT, y: -Math.cos(angle) * CURSOR_LIMIT }
    highlight(next)
  }

  useEffect(() => {
    let scrollDistance = 0
    let lastStep = 0

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextField(e.target)) return
      if (e.code === "KeyQ" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        if (e.repeat || openRef.current) return
        unlockAudio()
        // Holding opens the wheel; releasing before the delay counts as a tap.
        holdTimer.current = window.setTimeout(() => {
          holdTimer.current = 0
          show()
        }, settings.current.holdDelayMs)
        return
      }
      if (!openRef.current) return
      if (e.key === "Escape") hide()
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") step(1)
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") step(-1)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "KeyQ") return
      if (holdTimer.current) {
        window.clearTimeout(holdTimer.current)
        holdTimer.current = 0
        tapNext()
      } else if (openRef.current) {
        commit()
      }
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
      // Inside the dead zone the current pick stays, so a jittery hand on
      // release doesn't change station.
      if (length >= settings.current.deadzone) highlight(slotForVector(c.x, c.y, settings.current.slots.length))
    }

    const onWheel = (e: WheelEvent) => {
      if (!openRef.current || isHarnessChrome(e.target)) return
      e.preventDefault()
      scrollDistance += e.deltaY
      const now = performance.now()
      if (Math.abs(scrollDistance) < SCROLL_STEP || now - lastStep < SCROLL_REPEAT_MS) return
      step(scrollDistance > 0 ? 1 : -1)
      scrollDistance = 0
      lastStep = now
    }

    // Only "keep open" mode commits on click; normally releasing Q commits.
    const onClick = (e: MouseEvent) => {
      if (settings.current.keepOpen && !isHarnessChrome(e.target)) tune(highlightRef.current)
    }

    // Switching windows mid-hold means the keyup never arrives.
    const onBlur = () => {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = 0
      if (openRef.current && !settings.current.keepOpen) hide()
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
    if (options.keepOpen) {
      show()
    } else if (openRef.current) {
      openRef.current = false
      setOpen(false)
    }
  }, [options.keepOpen])

  // Opens the wheel briefly so the entrance can be watched without holding Q.
  // Stable across renders because show/hide only touch refs and setters.
  const peek = useCallback(() => {
    if (openRef.current) return
    unlockAudio()
    show()
    window.setTimeout(() => {
      if (!settings.current.keepOpen) hide()
    }, PEEK_MS)
  }, [])

  return { open, highlighted, playingId, peek }
}
