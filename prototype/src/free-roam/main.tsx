import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { AfterHours } from "./AfterHours"
import { Frequency } from "./Frequency"
import { PassengerSeat } from "./PassengerSeat"
import "./styles.css"
import "./picker.css"

const directions = [AfterHours, Frequency, PassengerSeat]
const names = ["After Hours", "FM / 98.6", "Passenger Seat"]

function Exploration() {
  const [current, setCurrent] = useState(() => {
    const requested = Number(new URLSearchParams(location.search).get("v")) - 1
    return Number.isInteger(requested) && requested >= 0 && requested < directions.length ? requested : 0
  })
  const [replay, setReplay] = useState(0)
  const picker = useRef<HTMLElement>(null)
  const highlight = useRef<HTMLSpanElement>(null)
  const Current = directions[current]

  useLayoutEffect(() => {
    const position = () => {
      const active = picker.current?.querySelector<HTMLButtonElement>("[data-active]")
      if (!active || !highlight.current) return
      highlight.current.style.width = `${active.offsetWidth}px`
      highlight.current.style.transform = `translateX(${active.offsetLeft}px)`
    }
    position()
    window.addEventListener("resize", position)
    const frame = requestAnimationFrame(() => picker.current?.setAttribute("data-ready", ""))
    return () => { window.removeEventListener("resize", position); cancelAnimationFrame(frame) }
  }, [current])

  useEffect(() => {
    const url = new URL(location.href)
    url.searchParams.set("v", String(current + 1))
    history.replaceState(null, "", url)
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest("input, textarea, select, [contenteditable='true']") || event.metaKey || event.ctrlKey || event.altKey) return
      const n = Number(event.key)
      if (n >= 1 && n <= directions.length) setCurrent(n - 1)
      else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault()
        setCurrent(value => (value + (event.key === "ArrowRight" ? 1 : directions.length - 1)) % directions.length)
      } else if (event.key.toLowerCase() === "r") setReplay(value => value + 1)
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  }, [current])

  return <><a className="skip-link" href="#radio-demo">Skip to radio preview</a><Current key={`${current}-${replay}`} /><nav className="proto-picker" aria-label="Prototype variants" ref={picker}><span className="proto-picker-highlight" aria-hidden="true" ref={highlight} />{names.map((name, index) => <button key={name} className="proto-picker-item" data-active={current === index ? "" : undefined} aria-current={current === index ? "true" : undefined} onClick={() => { setCurrent(index); window.scrollTo(0, 0) }}>{name}</button>)}</nav></>
}

createRoot(document.getElementById("root")!).render(<StrictMode><Exploration /></StrictMode>)
