// Prototype harness: /proto/hero/ in `npm run dev`. Throwaway, imported by nothing.
import { StrictMode, Suspense, lazy, useLayoutEffect, useRef, useState, useEffect, type ComponentType } from "react"
import { createRoot } from "react-dom/client"
import { DialRoot, useDialKit } from "dialkit"
import "dialkit/styles.css"
import "./base.css"
import { FxContext, RadioProvider, type Fx } from "./radio"
import GoldenHour from "./variants/GoldenHour"
import RedLight from "./variants/RedLight"
import ThreeAM from "./variants/ThreeAM"

// Loaded on demand so three.js stays out of the main bundle, as on the real page.
const CoastDrive = lazy(() => import("./variants/CoastDrive"))

const ALL_VARIANTS: { name: string; Component: ComponentType }[] = [
  { name: "3 A.M. Night", Component: () => <ThreeAM scene="night" /> },
  { name: "3 A.M.", Component: ThreeAM },
  { name: "Red Light", Component: RedLight },
  { name: "Coast Drive", Component: CoastDrive },
  { name: "3 A.M. Drive", Component: () => <ThreeAM scene="drive" /> },
  { name: "Golden Hour", Component: GoldenHour },
]
// The build shared for feedback shows only the shortlisted directions.
const VARIANTS = import.meta.env.VITE_SHARE ? ALL_VARIANTS.filter(v => v.name !== "Golden Hour") : ALL_VARIANTS

function Picker({ current, onSelect, onReplay }: { current: number; onSelect: (i: number) => void; onReplay: () => void }) {
  const nav = useRef<HTMLElement>(null)
  const highlight = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const move = () => {
      const el = items.current[current]
      if (!el || !highlight.current) return
      highlight.current.style.width = `${el.offsetWidth}px`
      highlight.current.style.transform = `translateX(${el.offsetLeft}px)`
    }
    move()
    window.addEventListener("resize", move)
    return () => window.removeEventListener("resize", move)
  }, [current])
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setReady(true))) }, [])

  return <nav ref={nav} className="proto-picker" aria-label="Prototype variants" data-ready={ready ? "" : undefined}>
    <span ref={highlight} className="proto-picker-highlight" aria-hidden="true" />
    {VARIANTS.map((variant, i) => <button key={variant.name} ref={el => { items.current[i] = el }} type="button" className="proto-picker-item"
      data-active={i === current ? "" : undefined} aria-current={i === current ? "true" : undefined} onClick={() => onSelect(i)}>{variant.name}</button>)}
    <span className="proto-picker-divider" aria-hidden="true" />
    <button type="button" className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" onClick={onReplay}>↻</button>
  </nav>
}

function Harness() {
  const initial = Math.min(VARIANTS.length, Math.max(1, parseInt(new URLSearchParams(location.search).get("v") ?? "1", 10) || 1)) - 1
  const [current, setCurrent] = useState(initial)
  const [mountKey, setMountKey] = useState(0)

  const dials = useDialKit("Page", {
    palette: { type: "select", options: ["Sodium", "Lime"], default: "Sodium" },
    stationColour: true,
    time: { type: "select", options: ["Auto", "Dawn", "Day", "Dusk", "Night"], default: "Auto" },
    intro: true,
    staticOn: true,
    staticMs: [260, 60, 900, 10],
    staticAmount: [0.55, 0.1, 1, 0.05],
    speed: { type: "select", options: ["1x", "0.5x", "0.25x"], default: "1x" },
  }, { id: "proto-hero-v1", persist: true })

  const fx: Fx = {
    palette: dials.palette as Fx["palette"],
    stationColour: dials.stationColour,
    time: dials.time as Fx["time"],
    intro: dials.intro,
    staticOn: dials.staticOn,
    staticMs: dials.staticMs,
    staticAmount: dials.staticAmount,
    speed: parseFloat(dials.speed),
  }

  const select = (i: number) => {
    if (i < 0 || i >= VARIANTS.length) return
    setCurrent(i)
    setMountKey(k => k + 1)
    const url = new URL(location.href)
    url.searchParams.set("v", String(i + 1))
    history.replaceState(null, "", url)
  }
  const selectRef = useRef(select)
  selectRef.current = select
  const currentRef = useRef(current)
  currentRef.current = current

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (target.closest(".wheel-layer")) return
      const num = parseInt(e.key, 10)
      const n = VARIANTS.length
      if (num >= 1 && num <= n) selectRef.current(num - 1)
      else if (e.key === "ArrowRight") selectRef.current((currentRef.current + 1) % n)
      else if (e.key === "ArrowLeft") selectRef.current((currentRef.current - 1 + n) % n)
      else if (e.key === "r" || e.key === "R") setMountKey(k => k + 1)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const { Component } = VARIANTS[current]
  return <FxContext.Provider value={fx}>
    <RadioProvider>
      <div style={{ "--speed": fx.speed } as React.CSSProperties}>
        <Suspense fallback={null}><Component key={`${current}-${mountKey}`} /></Suspense>
      </div>
    </RadioProvider>
    <Picker current={current} onSelect={select} onReplay={() => setMountKey(k => k + 1)} />
    {!import.meta.env.VITE_SHARE && <DialRoot position="top-right" theme="dark" />}
  </FxContext.Provider>
}

createRoot(document.getElementById("root")!).render(<StrictMode><Harness /></StrictMode>)
