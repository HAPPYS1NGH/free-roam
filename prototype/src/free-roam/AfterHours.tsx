import { useEffect, useRef } from "react"
import tokens from "../../tokens.json"
import { useWheel } from "../useWheel"
import { useViewport } from "../useViewport"
import { AudioToggle } from "./AudioToggle"
import { Details, Header } from "./Shared"
import { Stations } from "./Stations"
import { WheelOverlay } from "./WheelOverlay"
import { catalogSources, demoSlots } from "./demo-stations"
import { sourceUrl } from "./content"
import { useProductAudio } from "./useProductAudio"

export function AfterHours() {
  const audio = useProductAudio()
  const opener = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const wheel = useWheel({
    slots: demoSlots,
    deadzone: tokens.behaviour.deadzone * useViewport().height / 100,
    pickRadius: tokens.behaviour.pickRadius,
    scrollStep: tokens.behaviour.scrollStep,
    dwellMs: tokens.behaviour.dwellMs,
    holdDelayMs: tokens.behaviour.holdDelayMs,
    keepOpen: false,
    sounds: audio.sounds,
  })
  const playing = demoSlots.find(slot => slot.id === wheel.playingId)
  const source = catalogSources.find(album => album.id === wheel.playingId)

  useEffect(() => {
    if (wasOpen.current && !wheel.open && document.activeElement === document.body) opener.current?.focus({ preventScroll: true })
    wasOpen.current = wheel.open
  }, [wheel.open])

  return <main className="direction night" id="top">
    <div className="night-scene">
      <img className="scene-image" src="/free-roam/coast.jpg" alt="A solitary car on a coastal highway at dusk" width="1672" height="941" fetchPriority="high" />
      <div className="scene-shade" />
      <Header />
      <div className="night-hero">
        <h1>Take the<br />long way<br /><span>home.</span></h1>
        <p className="intro">Your Music playlists as radio stations. Hold <kbd>⌥</kbd><kbd>Q</kbd> anywhere on your Mac, flick to one, let go.</p>
        <div className="hero-try">
          <button ref={opener} className="primary-action" onClick={wheel.show} aria-expanded={wheel.open}>Try the wheel</button>
          <p>or hold <kbd>Q</kbd> on this page</p>
        </div>
        <a className="text-action" href={`${sourceUrl}#build-the-mac-app`} target="_blank" rel="noreferrer">Build it for your Mac <span aria-hidden="true">↗</span></a>
      </div>
      <div className="now-playing">
        <p role="status">{playing?.kind === "playlist" ? <>On air <strong>{playing.playlist.name}</strong></> : "Radio off"}</p>
        <div className="now-playing-controls">
          <button className="inline-off" onClick={() => wheel.choose(0)} disabled={wheel.playingId === null}>Radio Off</button>
          <AudioToggle audio={audio} />
          {source && <a className="album-source" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.album} on Apple Music ↗</a>}
        </div>
      </div>
    </div>
    <Stations playingId={wheel.playingId} onChoose={wheel.choose} />
    <Details />
    <WheelOverlay open={wheel.open} highlighted={wheel.highlighted} onChoose={wheel.choose} onClose={wheel.hide} />
  </main>
}
