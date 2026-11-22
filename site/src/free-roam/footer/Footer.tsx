import { useEffect, useRef } from "react"
import { useRadio } from "../RadioProvider"
import { Billboard } from "./Billboard"
import { FooterBase, type LinkSignal } from "./links"
import { createScene, draw, headlights, hitLamp, lightLampNear, pixelFor, queueCar, ROWS, sendCarSoon, settleLamps, step, type Palette, type Scene } from "./road"
import { playGlassBreak } from "./glass"
import "./footer.css"

// The coast road at night under the footer links. Grass and palms sway and
// lean away from the pointer. Hovering or focusing a link strikes up the lamp
// nearest it and sends a car in the station's colour down the road; pressing
// a link, clicking the road or retuning sends one too, right away. Hitting a
// lamp's head breaks it.
export function Footer() {
  const { retunes, stationRgb, audio } = useRadio()
  const stripRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const paletteRef = useRef<Palette | null>(null)
  const pointerRef = useRef<number | null>(null)
  const redrawRef = useRef<() => void>(() => {})
  const pixelRef = useRef(4)

  // The station colour changes the car, so resolve the page tokens again.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    paletteRef.current = resolvePalette(canvas)
    redrawRef.current()
  }, [stationRgb])

  // A car per retune from here on, not for the retunes before the footer mounted.
  const seenRetunes = useRef(retunes)
  useEffect(() => {
    if (retunes === seenRetunes.current) return
    seenRetunes.current = retunes
    if (sceneRef.current) queueCar(sceneRef.current)
  }, [retunes])

  useEffect(() => {
    // The canvas is made here, not rendered, so the prerendered page stays
    // canvas-free like the hero's scene; the strip reserves its height.
    const strip = stripRef.current
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!strip || !context) return
    canvas.setAttribute("aria-hidden", "true")
    strip.appendChild(canvas)
    canvasRef.current = canvas
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    paletteRef.current ??= resolvePalette(canvas)

    const resize = () => {
      // Whole pixels only: the canvas overhangs the strip by under one.
      const width = canvas.parentElement?.clientWidth ?? 0
      const pixel = pixelFor(width)
      const columns = Math.ceil(width / pixel)
      if (sceneRef.current?.columns === columns && pixelRef.current === pixel) return
      pixelRef.current = pixel
      canvas.style.width = `${columns * pixel}px`
      canvas.style.height = `${ROWS * pixel}px`
      canvas.width = columns
      canvas.height = ROWS
      const previous = sceneRef.current
      sceneRef.current = createScene(columns, lampAnchors(canvas, pixel))
      if (previous) sceneRef.current.traffic = previous.traffic
      render(performance.now())
    }
    const render = (now: number) => {
      const scene = sceneRef.current
      if (!scene || !paletteRef.current) return
      if (reduced.matches) settleLamps(scene)
      draw(context, scene, now, paletteRef.current)
    }
    redrawRef.current = () => { if (!frame) render(performance.now()) }

    let frame = 0
    let last = 0
    let visible = false
    const tick = (now: number) => {
      const scene = sceneRef.current
      // Clamp dt so a stalled tab doesn't fling every spring.
      const dt = Math.min(0.05, (now - (last || now)) / 1000)
      last = now
      if (scene) step(scene, now, dt, pointerRef.current)
      render(now)
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      const run = visible && !reduced.matches && !document.hidden
      if (run && !frame) { last = 0; frame = requestAnimationFrame(tick) }
      if (!run && frame) { cancelAnimationFrame(frame); frame = 0 }
      if (!run) render(performance.now())
    }

    resize()
    const resizer = new ResizeObserver(resize)
    if (canvas.parentElement) resizer.observe(canvas.parentElement)
    const watcher = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    watcher.observe(canvas)
    reduced.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    return () => {
      cancelAnimationFrame(frame)
      resizer.disconnect()
      watcher.disconnect()
      reduced.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
      canvas.remove()
      canvasRef.current = null
      sceneRef.current = null
    }
  }, [])

  const trackPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    pointerRef.current = (event.clientX - box.left) / pixelRef.current
  }
  // A press on a lamp head breaks it instead of sending a car.
  const hitLampRef = useRef(false)
  const pressRoad = (event: React.PointerEvent<HTMLDivElement>) => {
    trackPointer(event)
    const scene = sceneRef.current
    const canvas = canvasRef.current
    if (!scene || !canvas) return
    const box = canvas.getBoundingClientRect()
    const pixel = pixelRef.current
    const hit = hitLamp(scene, (event.clientX - box.left) / pixel, (event.clientY - box.top) / pixel, performance.now())
    hitLampRef.current = hit !== null
    if (hit === "break" || hit === "fizz") playGlassBreak(hit, audio.sounds.uiVolumeDb)
    // Reduced motion: no pop or stutter, the lamp is simply out, then back.
    if (hitLampRef.current && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      scene.bits.length = 0
      window.setTimeout(() => redrawRef.current(), 1000)
      window.setTimeout(() => redrawRef.current(), 6500)
    }
  }
  // From the side that was clicked: the pointer on the road, the link's
  // centre for a link, alternating lanes from the keyboard.
  const sendCar = (element?: HTMLElement | null) => {
    if (hitLampRef.current) { hitLampRef.current = false; return }
    const scene = sceneRef.current
    if (!scene) return
    queueCar(scene, element ? columnOf(element) : pointerRef.current)
  }
  const columnOf = (element: HTMLElement) => {
    const box = element.getBoundingClientRect()
    const strip = canvasRef.current?.getBoundingClientRect()
    return strip ? (box.left + box.width / 2 - strip.left) / pixelRef.current : null
  }
  // Car fronts in CSS px from the footer's corner, for boards that catch them.
  const carLights = () => {
    const scene = sceneRef.current
    const canvas = canvasRef.current
    const footer = canvas?.closest("footer")
    if (!scene || !canvas || !footer) return []
    const pixel = pixelRef.current
    const top = canvas.getBoundingClientRect().top - footer.getBoundingClientRect().top
    return headlights(scene).map(light => ({ ...light, x: light.x * pixel, y: top + light.y * pixel }))
  }

  // A link lights the lamp under it (by its centre) and waves a car through.
  const onLink: LinkSignal = element => {
    const scene = sceneRef.current
    const canvas = canvasRef.current
    if (!scene || !canvas) return
    if (!element) { lightLampNear(scene, null); redrawRef.current(); return }
    const link = (element.querySelector(".fx-link-label") ?? element).getBoundingClientRect()
    const box = canvas.getBoundingClientRect()
    const column = (link.left + link.width / 2 - box.left) / pixelRef.current
    lightLampNear(scene, column)
    sendCarSoon(scene, performance.now(), column)
    redrawRef.current()
  }

  return <footer className="fx-footer">
    <Billboard onLink={onLink} onPress={sendCar} headlights={carLights} />
    {/* A pointer toy, not a control: kept out of the tab order and the accessibility tree. */}
    <div
      ref={stripRef}
      className="fx-road"
      aria-hidden="true"
      onPointerMove={trackPointer}
      onPointerDown={pressRoad}
      onPointerLeave={() => { pointerRef.current = null }}
      onPointerCancel={() => { pointerRef.current = null }}
      onClick={() => sendCar()}
    />
    <FooterBase />
  </footer>
}

// One lamp per billboard group, its post just inside the group's left edge so
// the arm reaches out over the labels. Columns stacked on phones share a lamp.
function lampAnchors(canvas: HTMLCanvasElement, pixel: number) {
  const footer = canvas.closest("footer")
  if (!footer) return []
  const left = canvas.getBoundingClientRect().left
  const spots = [...footer.querySelectorAll("[data-lamp]")].map(group => Math.round((group.getBoundingClientRect().left - left + 24) / pixel))
  return [...new Set(spots)]
}

// Canvas can't read CSS variables, and relative oklch() isn't safe to hand it,
// so each token is resolved through a probe and read back as sRGB.
function resolvePalette(host: HTMLElement): Palette {
  const probe = document.createElement("span")
  host.parentElement?.appendChild(probe)
  const scratch = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  const read = (token: string, fallback: string) => {
    probe.style.color = `var(${token}, ${fallback})`
    const css = getComputedStyle(probe).color
    if (!scratch) return css
    scratch.clearRect(0, 0, 1, 1)
    scratch.fillStyle = fallback
    scratch.fillStyle = css
    scratch.fillRect(0, 0, 1, 1)
    const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data
    return `rgb(${r} ${g} ${b})`
  }
  const palette = { accent: read("--accent", "#f2b450"), sodium: read("--sodium", "#f0a848"), ink: read("--ink", "#f4f0e8"), bg: read("--bg", "#16191f") }
  probe.remove()
  return palette
}
