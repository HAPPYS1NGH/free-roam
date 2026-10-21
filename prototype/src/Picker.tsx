import { useEffect, useLayoutEffect, useRef, useState } from "react"
import "./picker.css"

type Props = {
  names: string[]
  current: number
  onSelect: (index: number) => void
  onReplay: () => void
}

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable || !!target.closest(".dialkit-root")
}

export function Picker({ names, current, onSelect, onReplay }: Props) {
  const highlight = useRef<HTMLSpanElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const move = () => {
      const item = items.current[current]
      if (!item || !highlight.current) return
      highlight.current.style.width = `${item.offsetWidth}px`
      highlight.current.style.transform = `translateX(${item.offsetLeft}px)`
    }
    move()
    window.addEventListener("resize", move)
    return () => window.removeEventListener("resize", move)
  }, [current])

  // Enable the slide only after first paint, so load doesn't animate.
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setReady(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const number = parseInt(e.key, 10)
      if (number >= 1 && number <= names.length) onSelect(number - 1)
      else if (e.key === "ArrowRight") onSelect((current + 1) % names.length)
      else if (e.key === "ArrowLeft") onSelect((current - 1 + names.length) % names.length)
      else if (e.key === "r" || e.key === "R") onReplay()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [current, names.length, onSelect, onReplay])

  return (
    <nav className="proto-picker" aria-label="Prototype variants" data-ready={ready ? "" : undefined}>
      <span className="proto-picker-highlight" aria-hidden="true" ref={highlight} />
      {names.map((name, i) => (
        <button
          key={name}
          ref={(el) => {
            items.current[i] = el
          }}
          className="proto-picker-item"
          data-active={i === current ? "" : undefined}
          aria-current={i === current ? "true" : undefined}
          onClick={() => onSelect(i)}
        >
          {name}
        </button>
      ))}
      <span className="proto-picker-divider" aria-hidden="true" />
      <button className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" onClick={onReplay}>
        ↻
      </button>
    </nav>
  )
}
