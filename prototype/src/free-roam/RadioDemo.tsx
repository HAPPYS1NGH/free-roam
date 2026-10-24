import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { stations } from "./content"

export function RadioDemo({ mode = "wheel" }: { mode?: "wheel" | "tuner" }) {
  const [selected, setSelected] = useState(0)
  const [preview, setPreview] = useState(0)
  const [holding, setHolding] = useState(false)
  const [sound, setSound] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const selection = useRef(0)
  const held = useRef(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const wheel = useRef<HTMLDivElement>(null)

  const tune = useCallback((index: number) => {
    setSelected(index)
    setPreview(index)
    selection.current = index
    if (!sound) return
    audio.current ??= new Audio("/sounds/retune.wav")
    audio.current.volume = 0.2
    audio.current.currentTime = 0
    void audio.current.play().then(() => setAudioError(false)).catch(() => setAudioError(true))
  }, [sound])

  useEffect(() => {
    const ignore = (event: KeyboardEvent) => event.target instanceof HTMLElement &&
      (event.target.closest("input, textarea, select, [contenteditable='true']") || event.metaKey || event.ctrlKey || event.altKey)
    const down = (event: KeyboardEvent) => {
      if (ignore(event) || event.key.toLowerCase() !== "q" || event.repeat) return
      event.preventDefault()
      held.current = true
      setHolding(true)
      wheel.current?.scrollIntoView({ block: "nearest" })
    }
    const up = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "q" || !held.current) return
      held.current = false
      setHolding(false)
      tune(selection.current)
    }
    const cancel = () => { held.current = false; setHolding(false) }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", cancel)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", cancel)
      audio.current?.pause()
    }
  }, [tune])

  const station = stations[holding ? preview : selected]
  return <section className={`radio-demo radio-demo--${mode}`} id="radio-demo" aria-label="Interactive radio preview">
    <div className="demo-topline"><span className="eyebrow">Your music. Your stations.</span><button className="sound-toggle" aria-pressed={sound} onClick={() => { setSound(!sound); audio.current?.pause() }}>{sound ? "Sound on" : "Sound off"} <span aria-hidden="true">{sound ? "◖))" : "◖×"}</span></button></div>
    {mode === "wheel" ? <div className="radio-wheel" ref={wheel} data-holding={holding} onPointerMove={event => {
      if (!held.current) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const dx = event.clientX - bounds.left - bounds.width / 2
      const dy = event.clientY - bounds.top - bounds.height / 2
      if (Math.hypot(dx, dy) < bounds.width * 0.17) return
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360
      const next = Math.round(angle / 60) % stations.length
      selection.current = next
      setPreview(next)
    }}>
      <div className="wheel-orbit" aria-hidden="true" />
      <div className="wheel-spokes" aria-hidden="true" />
      {stations.map((entry, index) => {
        const angle = (index * 60 - 90) * Math.PI / 180
        return <button key={entry.name} className={`station-mark station-mark--${index}`} style={{ "--x": `${50 + Math.cos(angle) * 37}%`, "--y": `${50 + Math.sin(angle) * 37}%` } as CSSProperties} aria-label={`Tune to ${entry.name}`} aria-pressed={(holding ? preview : selected) === index} onClick={() => tune(index)}>{entry.mark}</button>
      })}
      <div className="wheel-center"><span className="eyebrow">{holding ? "Tuning" : "Tuned to"}</span><strong>{station.frequency}<small>FM</small></strong><span>{station.name}</span></div>
    </div> : <div className="tuner" ref={wheel}>
      <div className="tuner-display"><span className="eyebrow">Free Roam stereo receiver</span><strong>{station.frequency}<small>MHz</small></strong><div className="tuner-scale" aria-hidden="true"><span style={{ left: `${(Number(station.frequency) - 88) * 5}%` }} /></div><div className="tuner-labels"><span>88</span><span>93</span><span>98</span><span>103</span><span>108</span></div></div>
      <div className="station-presets" aria-label="Station presets">{stations.map((entry, index) => <button key={entry.name} aria-label={`Tune to ${entry.name}`} aria-pressed={selected === index} onClick={() => tune(index)}><span>0{index + 1}</span>{entry.name}</button>)}</div>
    </div>}
    <div className="station-caption" aria-live="polite"><strong>{station.name}</strong><span>{station.genre}</span></div>
    <p className="demo-instruction">{mode === "wheel" ? <>Hold <kbd>Q</kbd>, point, release. Or tap a station.</> : "Pick a preset. Find your frequency."}</p>
    <p className="demo-disclaimer">{audioError ? "Sound could not play. Try switching sound off and on." : "Interactive preview · tuning effects only"}</p>
  </section>
}
