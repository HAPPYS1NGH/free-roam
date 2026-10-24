import { useCallback, useEffect, useRef, useState } from "react"
import { slotForVector } from "../geometry"
import { demoSlots } from "./demo-stations"
import { WheelFace } from "./WheelFace"

export function RadioDemo() {
  const [selected, setSelected] = useState(1)
  const [preview, setPreview] = useState(1)
  const [holding, setHolding] = useState(false)
  const selection = useRef(1)
  const held = useRef(false)
  const section = useRef<HTMLElement>(null)

  const tune = useCallback((index: number) => {
    setSelected(index)
    setPreview(index)
    selection.current = index
  }, [])

  useEffect(() => {
    const cancel = () => { held.current = false; setHolding(false) }
    const down = (event: KeyboardEvent) => {
      if (event.key === "Escape") { cancel(); return }
      if (event.code !== "KeyQ" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return
      event.preventDefault()
      held.current = true
      setHolding(true)
      section.current?.scrollIntoView({ block: "nearest" })
    }
    const up = (event: KeyboardEvent) => {
      if (event.code !== "KeyQ" || !held.current) return
      cancel()
      tune(selection.current)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", cancel)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", cancel)
    }
  }, [tune])

  return <section ref={section} className="radio-demo" id="radio-demo" aria-label="Interactive radio preview"
    onKeyDown={event => {
      if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) return
      event.preventDefault()
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1
      const next = ((holding ? preview : selected) + direction + demoSlots.length) % demoSlots.length
      if (holding) { selection.current = next; setPreview(next) } else tune(next)
    }}>
    <div className="demo-topline"><span className="eyebrow">Your music. Your stations.</span><a className="text-action" href="/">Open demo ↗</a></div>
    <WheelFace highlighted={holding ? preview : selected} onChoose={tune} onPointerMove={event => {
      if (!held.current) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - bounds.left - bounds.width / 2
      const y = event.clientY - bounds.top - bounds.height / 2
      if (Math.hypot(x, y) < bounds.width * 0.17) return
      selection.current = slotForVector(x, y, demoSlots.length)
      setPreview(selection.current)
    }} />
    <p className="demo-instruction">Pick a mood. Or choose <button className="inline-off" onClick={() => tune(0)}>Radio Off</button> for a little quiet.</p>
    <p className="demo-disclaimer">Illustrative stations · silent preview</p>
  </section>
}
