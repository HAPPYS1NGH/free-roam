import { useCallback, useEffect, useRef, useState } from "react"
import { slotAngle, slotForVector } from "./geometry"
import { playSound, unlockAudio, type SoundName } from "./sound"
import type { Slot } from "./stations"

type Options = {
  slots: Slot[]
  deadzone: number
  // The pick is read from mouse movement since the wheel opened, not from
  // where the cursor is. That virtual cursor is clamped to pickRadius pixels,
  // so a flick "sticks" until you push in another direction, the same way
  // GTA's wheel behaves. A smaller radius turns the pick faster: circling the
  // whole ring takes about 2π × pickRadius pixels of mouse travel.
  pickRadius: number
  // Scrolling moves one station per scrollStep pixels, but never more than
  // one per wheel event, so a mouse-wheel notch is one station however hard
  // macOS accelerates it and a trackpad flick tops out at one per frame. The
  // first event of a gesture steps straight away, so a slow notch moves
  // exactly one station.
  scrollStep: number
  dwellMs: number
  holdDelayMs: number
  keepOpen: boolean
  // Require ⌥ with Q, like the app's ⌥Q hotkey. Browsers on macOS don't
  // reserve ⌥Q, so the page can hear it and plain Q stays free for typing.
  withOption?: boolean
  ignoreSelector?: string
  sounds: { retuneVolumeDb: number; uiVolumeDb: number; hoverVolumeDb: number }
}

// Roughly how long Music.app takes to start a playlist after the command.
const SWITCH_DELAY_MS = 250
const SCROLL_GESTURE_GAP_MS = 120
const LINE_HEIGHT = 16
const PEEK_MS = 1200

function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
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
  const switchTimer = useRef(0)
  const peekTimer = useRef(0)
  const pressed = useRef(false)

  const isIgnoredTarget = (target: EventTarget | null) => {
    const selector = settings.current.ignoreSelector
    return !!selector && target instanceof Element && !!target.closest(selector)
  }

  const uiSound = (name: SoundName) => playSound(name, settings.current.sounds.uiVolumeDb)

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
    playSound("retune", settings.current.sounds.retuneVolumeDb)
    playingRef.current = nextId
    window.clearTimeout(switchTimer.current)
    switchTimer.current = window.setTimeout(() => setPlayingId(nextId), SWITCH_DELAY_MS)
  }

  // GTA retunes live as you pass over stations. Waiting for the highlight to
  // rest briefly means a sweep across the ring doesn't send Music a play
  // command for every station on the way.
  const highlight = (index: number) => {
    if (index === highlightRef.current) return
    highlightRef.current = index
    setHighlighted(index)
    playSound("hover", settings.current.sounds.hoverVolumeDb)
    window.clearTimeout(dwellTimer.current)
    dwellTimer.current = window.setTimeout(() => tune(index), settings.current.dwellMs)
  }

  const show = () => {
    if (openRef.current) return
    unlockAudio()
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
    const { pickRadius } = settings.current
    cursor.current = { x: Math.sin(angle) * pickRadius, y: -Math.cos(angle) * pickRadius }
    highlight(next)
  }

  useEffect(() => {
    let scrollDistance = 0
    let lastScroll = 0

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextField(e.target)) return
      if (e.code === "KeyQ" && !e.metaKey && !e.ctrlKey && e.altKey === Boolean(settings.current.withOption)) {
        e.preventDefault()
        if (e.repeat || pressed.current) return
        pressed.current = true
        if (openRef.current) return
        unlockAudio()
        // Holding opens the wheel; releasing before the delay counts as a tap.
        holdTimer.current = window.setTimeout(() => {
          holdTimer.current = 0
          show()
        }, settings.current.holdDelayMs)
        return
      }
      if (e.key === "Escape") {
        window.clearTimeout(holdTimer.current)
        holdTimer.current = 0
        pressed.current = false
        if (openRef.current) hide()
        return
      }
      if (!openRef.current) return
      if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
        e.preventDefault()
        step(e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "KeyQ" || !pressed.current) return
      pressed.current = false
      if (holdTimer.current) {
        window.clearTimeout(holdTimer.current)
        holdTimer.current = 0
        tapNext()
      } else if (openRef.current) {
        commit()
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!openRef.current || isIgnoredTarget(e.target)) return
      const c = cursor.current
      c.x += e.movementX
      c.y += e.movementY
      const length = Math.hypot(c.x, c.y)
      const { pickRadius } = settings.current
      if (length > pickRadius) {
        c.x *= pickRadius / length
        c.y *= pickRadius / length
      }
      // Inside the dead zone the current pick stays, so a jittery hand on
      // release doesn't change station.
      if (length >= settings.current.deadzone) highlight(slotForVector(c.x, c.y, settings.current.slots.length))
    }

    const onWheel = (e: WheelEvent) => {
      if (!openRef.current || isIgnoredTarget(e.target)) return
      e.preventDefault()
      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1
      // Trackpads scroll on both axes; follow whichever one the swipe favours.
      const delta = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit
      if (delta === 0) return
      const now = performance.now()
      const newGesture = now - lastScroll > SCROLL_GESTURE_GAP_MS
      lastScroll = now
      if (newGesture) {
        scrollDistance = 0
        step(delta > 0 ? 1 : -1)
        return
      }
      // Reversing mid-swipe responds at once instead of first unwinding.
      if (Math.sign(delta) !== Math.sign(scrollDistance)) scrollDistance = 0
      scrollDistance += delta
      const { scrollStep } = settings.current
      if (Math.abs(scrollDistance) < scrollStep) return
      step(scrollDistance > 0 ? 1 : -1)
      // Drop whole steps beyond the first. Several stations in one event would
      // jump the highlight past them in a single frame with a single tick.
      scrollDistance %= scrollStep
    }

    // Only "keep open" mode commits on click; normally releasing Q commits.
    const onClick = (e: MouseEvent) => {
      if (settings.current.keepOpen && !isIgnoredTarget(e.target)) tune(highlightRef.current)
    }

    // Switching windows mid-hold means the keyup never arrives.
    const onBlur = () => {
      pressed.current = false
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
      for (const timer of [holdTimer, dwellTimer, switchTimer, peekTimer]) window.clearTimeout(timer.current)
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
    peekTimer.current = window.setTimeout(() => {
      if (!settings.current.keepOpen) hide()
    }, PEEK_MS)
  }, [])

  const choose = (index: number) => {
    if (!settings.current.slots[index]) return
    unlockAudio()
    highlightRef.current = index
    setHighlighted(index)
    tune(index)
    // Choosing from outside the wheel (Radio Off, a station list) has no close sound.
    if (openRef.current) hide()
  }

  return { open, highlighted, playingId, peek, show, hide, choose }
}
