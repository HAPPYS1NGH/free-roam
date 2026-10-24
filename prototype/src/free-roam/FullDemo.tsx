import { useEffect, useRef, type CSSProperties } from "react"
import tokens from "../../tokens.json"
import { useProductAudio } from "./useProductAudio"
import { AudioToggle } from "./AudioToggle"
import { useWheel } from "../useWheel"
import { useViewport } from "../useViewport"
import { Brand } from "./Shared"
import { WheelFace } from "./WheelFace"
import { catalogSources, demoSlots } from "./demo-stations"
import "./full-demo.css"

export function FullDemo() {
  const audio = useProductAudio()
  const opener = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const unit = useViewport().height / 100
  const wheel = useWheel({
    slots: demoSlots,
    deadzone: tokens.behaviour.deadzone * unit,
    pickRadius: tokens.behaviour.pickRadius,
    scrollStep: tokens.behaviour.scrollStep,
    dwellMs: tokens.behaviour.dwellMs,
    holdDelayMs: tokens.behaviour.holdDelayMs,
    keepOpen: false,
    sounds: audio.sounds,
  })
  const playing = demoSlots.find(slot => slot.id === wheel.playingId)
  const source = catalogSources.find(album => album.id === wheel.playingId)
  const station = playing?.kind === "playlist" ? playing.playlist.name : "Radio Off"

  useEffect(() => {
    if (wasOpen.current && !wheel.open) opener.current?.focus({ preventScroll: true })
    wasOpen.current = wheel.open
  }, [wheel.open])

  return <main className="full-demo direction night" data-open={wheel.open || undefined} style={{
    "--product-saturation": tokens.behaviour.backdropSaturation,
    "--product-brightness": tokens.behaviour.backdropBrightness,
    "--product-filter-in": `${tokens.animations.filterIn.duration}s`,
    "--product-filter-out": `${tokens.animations.filterOut.duration}s`,
  } as CSSProperties}>
    <img className="full-demo-photo" src="/free-roam/coast.jpg" alt="" width="1672" height="941" />
    <header className="full-demo-header"><Brand href="/free-roam/" /><a className="text-action" href="/free-roam/">← Back to Free Roam</a></header>
    <div className="full-demo-body">
      {wheel.open ? <section className="full-demo-wheel" aria-label="Choose a station">
        <WheelFace autoFocus highlighted={wheel.highlighted} onChoose={wheel.choose} />
        <button className="demo-close text-action" onClick={wheel.hide}>Close wheel <kbd>Esc</kbd></button>
      </section> : <section className="full-demo-rest" aria-labelledby="demo-title">
        <p className="eyebrow">A radio for your favorite music</p>
        <h1 id="demo-title">Change the mood.<br /><span>Keep your flow.</span></h1>
        <p>Hold <kbd>Q</kbd>, move or scroll, then let go.<br />Tap <kbd>Q</kbd> to skip to the next station.</p>
      </section>}
      <div className="demo-toolbar">
        <button ref={opener} className="primary-action" onClick={() => wheel.open ? wheel.hide() : wheel.show()} aria-expanded={wheel.open}>{wheel.open ? "Close stations" : "Choose a station"} <span aria-hidden="true">↗</span></button>
        <button className="quiet-action" onClick={() => wheel.choose(0)} disabled={wheel.playingId === null}>Radio Off</button>
      </div>
      <p className="demo-now" role="status">{wheel.playingId === null ? "A little quiet. Pick a station whenever you're ready." : `Selected: ${station}`}</p>
    </div>
    <footer className="full-demo-footer">
      <p>Popular music selections · sound effects from Static<br />In the Mac app, use <kbd>⌥</kbd> + <kbd>Q</kbd> with your own playlists. Songs aren't streamed in this preview.</p>
      <div className="demo-audio-links"><AudioToggle audio={audio} />{source && <a className="album-source" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.album} on Apple Music ↗</a>}</div>
    </footer>
  </main>
}
