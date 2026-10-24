import { useEffect, useRef, useState } from "react"
import tokens from "../../tokens.json"
import { preloadSynthSounds, SILENT_DB, unlockAudio, type SoundName } from "../sound"
import { useWheel } from "../useWheel"
import { useViewport } from "../useViewport"
import { Brand } from "./Shared"
import { WheelFace } from "./WheelFace"
import { demoSlots } from "./demo-stations"
import "./full-demo.css"

export function FullDemo() {
  const [sound, setSound] = useState(false)
  const [soundError, setSoundError] = useState(false)
  const [loadingSound, setLoadingSound] = useState(false)
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
    sounds: {
      pack: "Synth", retuneTake: tokens.behaviour.retuneTake as SoundName,
      retuneVolumeDb: sound ? tokens.behaviour.retuneVolumeDb : SILENT_DB,
      uiVolumeDb: sound ? tokens.behaviour.uiVolumeDb : SILENT_DB,
      hoverVolumeDb: sound ? tokens.behaviour.hoverVolumeDb : SILENT_DB,
    },
  })
  const playing = demoSlots.find(slot => slot.id === wheel.playingId)
  const station = playing?.kind === "playlist" ? playing.playlist.name : "Radio Off"

  useEffect(() => {
    if (wasOpen.current && !wheel.open) opener.current?.focus({ preventScroll: true })
    wasOpen.current = wheel.open
  }, [wheel.open])

  return <main className="full-demo direction night" data-open={wheel.open || undefined}>
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
      <p>Browser demo · fictional stations · no music playback<br />In the Mac app, use <kbd>⌥</kbd> + <kbd>Q</kbd> with your own playlists.</p>
      <div><button className="sound-toggle" aria-pressed={sound} disabled={loadingSound} onClick={async () => {
        if (sound) { setSound(false); return }
        setLoadingSound(true)
        try {
          unlockAudio()
          await preloadSynthSounds()
          setSound(true)
          setSoundError(false)
        } catch {
          setSoundError(true)
        } finally {
          setLoadingSound(false)
        }
      }}>{loadingSound ? "Loading sounds…" : sound ? "Tuning sounds on" : "Tuning sounds off"}</button>
      {soundError && <p role="alert">Audio is unavailable. The demo still works silently.</p>}</div>
    </footer>
  </main>
}
