import { useEffect, useRef, type FocusEvent, type PointerEvent } from "react"
import { DownloadLink } from "../DownloadLink"
import { linkGroups, type LinkSignal } from "./links"
import "./billboard.css"

// One roadside billboard over the coast road at night. Its headline is the
// download; the other links are the small print, lit from a catwalk of
// floodlights along the bottom edge. Hovering a line strikes the floodlight
// under it (the same flicker as the road lamps), swings it up to the line and
// slides a pool of light across the face; pressing surges it. Passing cars
// wash the lower edge with their headlights. Keyboard focus moves the light
// without animating, since keyboard moves shouldn't wait on motion.

const LAMPS = linkGroups.length
const SWEEPS = 3
export type Headlight = {
  // Front of the car in CSS px from the footer's left edge.
  x: number
  // 1 drives left to right (near lane), -1 right to left (far lane).
  direction: 1 | -1
}

type BillboardProps = {
  // Hovered or focused link (null on leave): the road lamp nearest it lights.
  onLink: LinkSignal
  // Pressed link: sends a car.
  onPress: LinkSignal
  // The cars on the road right now; polled while the board is on screen.
  headlights: () => Headlight[]
}

// Beams swing no further than this either side of straight up.
const MAX_SWING = 34
// A cold lamp catches like a sodium tube: on, off, on, a dip, then steady.
const STRIKE = [1, 0.15, 1, 0.45, 1]
const STRIKE_STEP_MS = 52
// Power while a link is held down.
const SURGE = 1.3

type Spring = { value: number; velocity: number; target: number }
const spring = (value: number): Spring => ({ value, velocity: 0, target: value })

// Semi-implicit Euler: stable at 60–120Hz with the dt clamp below, and
// interruptible because a new target just bends the current velocity.
function stepSpring(s: Spring, dt: number, stiffness: number, damping: number) {
  s.velocity += (stiffness * (s.target - s.value) - damping * s.velocity) * dt
  s.value += s.velocity * dt
}
const settled = (s: Spring) => Math.abs(s.target - s.value) < 0.01 && Math.abs(s.velocity) < 0.01
const snap = (s: Spring) => { s.value = s.target; s.velocity = 0 }

export function Billboard({ onLink, onPress, headlights }: BillboardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const poolRef = useRef<HTMLDivElement>(null)
  const beamRefs = useRef<(HTMLDivElement | null)[]>([])
  const lensRefs = useRef<(HTMLSpanElement | null)[]>([])
  const sweepRefs = useRef<(HTMLDivElement | null)[]>([])
  const kickRef = useRef<() => void>(() => {})

  // The light rig: the pool's position and strength, and each lamp's swing and power.
  const rig = useRef({
    poolX: spring(0), poolY: spring(0), poolOn: spring(0),
    angles: Array.from({ length: LAMPS }, () => spring(0)),
    powers: Array.from({ length: LAMPS }, () => spring(0)),
    struck: Array.from({ length: LAMPS }, () => -Infinity),
    active: -1,
    placed: false,
  })
  // Focus right after a pointer press came from the pointer; otherwise the keyboard.
  const pointerAt = useRef(-Infinity)

  // Aim the rig at a link, or let it fall back to rest.
  const aim = (element: HTMLAnchorElement | null, instant = false) => {
    const board = boardRef.current
    const r = rig.current
    if (!board) return
    r.poolOn.target = element ? 1 : 0
    r.powers.forEach(p => { p.target = 0 })
    r.angles.forEach(a => { a.target = 0 })
    if (element) {
      const box = board.getBoundingClientRect()
      const label = (element.querySelector(".bb-label") ?? element).getBoundingClientRect()
      const x = label.left + label.width / 2 - box.left
      const y = label.top + label.height / 2 - box.top
      // The lamps stand at the centre of each quarter of the board's bottom edge.
      const lamp = Math.min(LAMPS - 1, Math.max(0, Math.floor((x / box.width) * LAMPS)))
      const lampX = ((lamp + 0.5) / LAMPS) * box.width
      const swing = (Math.atan2(x - lampX, box.height - y) * 180) / Math.PI
      r.angles[lamp].target = Math.max(-MAX_SWING, Math.min(MAX_SWING, swing))
      if (r.powers[lamp].value < 0.05) r.struck[lamp] = performance.now()
      r.powers[lamp].target = 1
      r.active = lamp
      r.poolX.target = x
      r.poolY.target = y
      // The first time, the pool appears at the line instead of flying in from a corner.
      if (!r.placed || instant) { r.poolX.value = x; r.poolY.value = y; r.placed = true }
      if (instant) { snap(r.angles[lamp]); snap(r.poolX); snap(r.poolY); r.struck[lamp] = -Infinity }
    } else r.active = -1
    kickRef.current()
  }

  // Holding a link down surges its lamp; letting go settles it back.
  const surge = (on: boolean) => {
    const r = rig.current
    if (r.active < 0) return
    r.powers[r.active].target = on ? SURGE : 1
    r.poolOn.target = on ? 1.25 : 1
    kickRef.current()
  }

  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const r = rig.current

    const paint = (now: number) => {
      const pool = poolRef.current
      if (pool) {
        pool.style.transform = `translate(${r.poolX.value}px, ${r.poolY.value}px)`
        pool.style.opacity = String(Math.max(0, r.poolOn.value))
      }
      for (let i = 0; i < LAMPS; i++) {
        const beam = beamRefs.current[i]
        const lens = lensRefs.current[i]
        const flicker = STRIKE[Math.floor((now - r.struck[i]) / STRIKE_STEP_MS)] ?? 1
        const power = Math.max(0, Math.min(SURGE, r.powers[i].value)) * flicker
        if (beam) {
          beam.style.transform = `rotate(${r.angles[i].value}deg)`
          beam.style.setProperty("--bb-power", String(power))
        }
        if (lens) lens.style.opacity = String(0.35 + 0.65 * Math.min(1, power))
        // The pool is the lamp's light, so it flickers with the strike.
        if (i === r.active && pool) pool.style.opacity = String(Math.max(0, r.poolOn.value) * flicker)
      }
    }

    // A car's beam reaches ahead of it along the board's bottom edge.
    const sweep = () => {
      const footer = board.closest("footer")
      const cars = footer && !reduced.matches ? headlights() : []
      const offset = footer ? board.getBoundingClientRect().left - footer.getBoundingClientRect().left : 0
      for (let i = 0; i < SWEEPS; i++) {
        const element = sweepRefs.current[i]
        if (!element) continue
        const car = cars[i]
        if (!car) { element.style.opacity = "0"; continue }
        element.style.opacity = "1"
        element.style.transform = `translateX(${car.x - offset}px) scaleX(${car.direction})`
      }
      return cars.length > 0
    }

    let frame = 0
    let last = 0
    let visible = false
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - (last || now)) / 1000)
      last = now
      stepSpring(r.poolX, dt, 170, 24)
      stepSpring(r.poolY, dt, 170, 24)
      stepSpring(r.poolOn, dt, 260, 32)
      r.angles.forEach(a => stepSpring(a, dt, 150, 17))
      r.powers.forEach(p => stepSpring(p, dt, 260, 30))
      paint(now)
      const busy = sweep() || ![r.poolX, r.poolY, r.poolOn, ...r.angles, ...r.powers].every(settled)
      // Stay up while on screen so passing cars are caught; idle off screen.
      frame = visible && !document.hidden && (busy || !reduced.matches) ? requestAnimationFrame(tick) : 0
    }
    const start = () => {
      if (frame || !visible || document.hidden) return
      last = 0
      frame = requestAnimationFrame(tick)
    }
    kickRef.current = () => {
      if (reduced.matches) {
        [r.poolX, r.poolY, r.poolOn, ...r.angles, ...r.powers].forEach(snap)
        r.struck.fill(-Infinity)
        paint(performance.now())
        return
      }
      start()
    }
    const sync = () => {
      if (visible && !document.hidden && !reduced.matches) start()
      if ((!visible || document.hidden) && frame) { cancelAnimationFrame(frame); frame = 0 }
    }

    paint(performance.now())
    const watcher = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    watcher.observe(board)
    document.addEventListener("visibilitychange", sync)
    reduced.addEventListener("change", sync)
    return () => {
      cancelAnimationFrame(frame)
      watcher.disconnect()
      document.removeEventListener("visibilitychange", sync)
      reduced.removeEventListener("change", sync)
      kickRef.current = () => {}
    }
  }, [headlights])

  const enter = (event: PointerEvent<HTMLAnchorElement>) => {
    aim(event.currentTarget)
    onLink(event.currentTarget)
  }
  const focus = (event: FocusEvent<HTMLAnchorElement>) => {
    aim(event.currentTarget, performance.now() - pointerAt.current > 600)
    onLink(event.currentTarget)
  }
  const leave = () => {
    aim(null)
    onLink(null)
  }

  return <nav className="bb-scene" aria-label="Footer">
    <div ref={boardRef} className="bb-board">
      <div className="bb-light" aria-hidden="true">
        {Array.from({ length: LAMPS }, (_, i) => <div
          key={i}
          ref={el => { beamRefs.current[i] = el }}
          className="bb-beam"
          style={{ left: `${((i + 0.5) / LAMPS) * 100}%` }}
        />)}
        <div ref={poolRef} className="bb-pool" />
        {Array.from({ length: SWEEPS }, (_, i) => <div key={i} ref={el => { sweepRefs.current[i] = el }} className="bb-sweep" />)}
      </div>

      <div className="bb-copy">
        {linkGroups.map((group, g) => <div key={group.title} className="bb-group" data-lamp="">
          <h2 className="bb-title"><span className="bb-title-num">{String(g + 1).padStart(2, "0")}</span>{group.title}</h2>
          <ul className="bb-list">
            {group.links.map((link, l) => {
              const anchor = {
                className: "bb-link",
                "data-hero": g === 0 && l === 0 ? "" : undefined,
                onPointerEnter: enter,
                onPointerLeave: leave,
                onFocus: focus,
                onBlur: leave,
                onPointerDown: (event: PointerEvent<HTMLAnchorElement>) => { pointerAt.current = performance.now(); surge(true); onPress(event.currentTarget) },
                onPointerUp: () => surge(false),
                onPointerCancel: () => surge(false),
              }
              const content = <>
                {label(link.label)}
                {link.external && <span className="bb-arrow" aria-hidden="true">↗</span>}
                {link.note && <span className="bb-note">{link.note}</span>}
              </>
              return <li key={link.label} className="bb-item">
                {link.elsewhere
                  ? <DownloadLink {...anchor} elsewhere={label(link.elsewhere)}>{content}</DownloadLink>
                  : <a {...anchor} href={link.href} {...(link.external && { target: "_blank", rel: "noreferrer" })}>{content}</a>}
              </li>
            })}
          </ul>
        </div>)}
      </div>
    </div>

    {/* The structure: catwalk, floodlight housings and two legs down to the road. */}
    <div className="bb-rig" aria-hidden="true">
      <div className="bb-catwalk">
        {Array.from({ length: LAMPS }, (_, i) => <span key={i} className="bb-lamp" style={{ left: `${((i + 0.5) / LAMPS) * 100}%` }}>
          <span ref={el => { lensRefs.current[i] = el }} className="bb-lens" />
        </span>)}
      </div>
      <span className="bb-leg" data-side="left" />
      <span className="bb-leg" data-side="right" />
    </div>
  </nav>
}

// The lit copy fades in over the resting one: opacity, not colour.
function label(text: string) {
  return <span className="bb-label">
    {text}
    <span className="bb-label-lit" aria-hidden="true">{text}</span>
  </span>
}
