// proto:backdrop — throwaway comparison of the screen filter behind the wheel.
// Delete this folder and the fenced lines in App.tsx once the backdrop is decided.

import { useDialKit } from "dialkit"
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import type { Library } from "../../library"
import { hueFor } from "../../stations"
import "./backdrop.css"
import "./picker.css"

const VARIANTS = [
  {
    id: "desaturated",
    label: "Desaturated",
    note: (
      <>
        <strong>Needs Screen Recording permission.</strong> Captures the screen to drain its colour
      </>
    ),
  },
  {
    id: "tint",
    label: "Tint only",
    note: (
      <>
        <strong>No permission.</strong> Vignette and blue wash over the screen, colours stay
      </>
    ),
  },
  {
    id: "veil",
    label: "Grey veil",
    note: (
      <>
        <strong>No permission.</strong> A grey layer over the screen fakes the colour drain
      </>
    ),
  },
]

function initialVariant() {
  const v = Number.parseInt(new URLSearchParams(location.search).get("v") ?? "", 10)
  return v >= 1 && v <= VARIANTS.length ? v - 1 : 0
}

function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable
}

export function BackdropProto({ library, wheelOpen }: { library: Library; wheelOpen: boolean }) {
  const [current, setCurrent] = useState(initialVariant)
  const [ready, setReady] = useState(false)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const highlight = useRef<HTMLSpanElement>(null)
  const panel = useDialKit(
    "Backdrop prototype",
    {
      scene: { type: "select", options: ["Bright window", "Desktop"], default: "Bright window" },
      veilOpacity: [0.3, 0, 0.6, 0.01],
      veilLightness: [0.6, 0.2, 0.9, 0.01],
    },
    { id: "proto-backdrop", persist: true },
  )

  useEffect(() => {
    const root = document.documentElement
    root.dataset.protoBackdrop = VARIANTS[current].id
    // A cool grey, so it agrees with the blue wash instead of muddying it.
    root.style.setProperty("--proto-veil", `oklch(${panel.veilLightness} 0.012 255 / ${panel.veilOpacity})`)
    const url = new URL(location.href)
    url.searchParams.set("v", String(current + 1))
    history.replaceState(null, "", url)
  }, [current, panel.veilLightness, panel.veilOpacity])

  useEffect(
    () => () => {
      delete document.documentElement.dataset.protoBackdrop
      document.documentElement.style.removeProperty("--proto-veil")
    },
    [],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const num = Number.parseInt(e.key, 10)
      if (num >= 1 && num <= VARIANTS.length) setCurrent(num - 1)
      // While the wheel is open the arrow keys step through stations.
      else if (wheelOpen) return
      else if (e.key === "ArrowRight") setCurrent((i) => (i + 1) % VARIANTS.length)
      else if (e.key === "ArrowLeft") setCurrent((i) => (i - 1 + VARIANTS.length) % VARIANTS.length)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [wheelOpen])

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

  // Enable the highlight's slide only after first paint, so load doesn't animate.
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setReady(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <>
      {panel.scene === "Bright window" && <BrightWindow library={library} />}
      <div className="proto-note" role="status" aria-live="polite">
        {VARIANTS[current].note}
      </div>
      {/* With "keep open" on, a click anywhere tunes in; keep picker clicks to the picker. */}
      <nav
        className="proto-picker"
        aria-label="Prototype variants"
        data-ready={ready || undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <span ref={highlight} className="proto-picker-highlight" aria-hidden="true" />
        {VARIANTS.map((variant, i) => (
          <button
            key={variant.id}
            ref={(el) => {
              items.current[i] = el
            }}
            type="button"
            className="proto-picker-item"
            data-active={i === current || undefined}
            aria-current={i === current || undefined}
            onClick={() => setCurrent(i)}
          >
            {variant.label}
          </button>
        ))}
      </nav>
    </>
  )
}

const BrightWindow = memo(function BrightWindow({ library }: { library: Library }) {
  const covers = library.playlists.flatMap((playlist) => playlist.covers.map((src) => ({ src, name: playlist.name })))
  // Mock playlists have no art; fall back to a coloured tile per playlist.
  const tiles = covers.length > 0 ? covers.slice(0, 24) : library.playlists.map((playlist) => ({ src: null, name: playlist.name }))

  return (
    <div className="proto-bright" aria-hidden="true">
      <div className="window-titlebar">
        <span className="traffic">
          <span />
          <span />
          <span />
        </span>
        Library
      </div>
      <div className="proto-bright-body">
        <h2>Recently added</h2>
        <div className="proto-bright-grid">
          {tiles.map((tile, i) => (
            <figure key={i}>
              {tile.src ? (
                <img className="proto-bright-cover" src={tile.src} alt="" />
              ) : (
                <div className="proto-bright-cover" style={{ "--hue": hueFor(tile.name) } as CSSProperties} />
              )}
              <figcaption>{tile.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  )
})
