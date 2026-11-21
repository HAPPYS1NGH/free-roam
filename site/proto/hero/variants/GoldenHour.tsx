import { useEffect, useState } from "react"
import {
  BelowFold, DownloadButton, Keycap, Nav, SCENES, SceneImage, SoundToggle, StaticBurst, TryWheelButton,
  formatClock, onAir, pageAttrs, useAltHeld, useFx, useIntro, useKeyHeld, useNow, usePageStyle, useRadio, useTimeOfDay,
  type TimeOfDay,
} from "../radio"
import "./GoldenHour.css"

const TIMES: TimeOfDay[] = ["dawn", "day", "dusk", "night"]
const ALT: Record<TimeOfDay, string> = {
  dawn: "A lone coupe on a coastal highway before sunrise, streetlights still on",
  day: "A lone coupe on a sunlit coastal highway beside the sea",
  dusk: "A lone coupe on a coastal highway at sunset",
  night: "A lone coupe on a coastal highway at night under orange streetlights",
}

// Beat: golden hour. The page is lit for the visitor's local time, and the
// scene is the hero. Motion: one tune-in intro, static on retune.
export default function GoldenHour() {
  const fx = useFx()
  const time = useTimeOfDay()
  const intro = useIntro()
  const q = useKeyHeld("q")
  const alt = useAltHeld()

  return <main className="p-page gh" id="top" {...pageAttrs(fx)} style={usePageStyle()} data-intro={intro ? "" : undefined} data-time={time}>
    <div className="gh-scene">
      <div className="gh-images">
        {TIMES.map(t => <div key={t} className="gh-image" data-active={t === time ? "" : undefined} aria-hidden={t !== time}>
          <SceneImage src={SCENES[t]} alt={ALT[t]} priority={t === time} />
        </div>)}
      </div>
      <div className="gh-shade" aria-hidden="true" />
      <StaticBurst />
      <div className="gh-intro-grain" aria-hidden="true" />
      <Nav />
      <div className="gh-hero p-wrap">
        <LocalClock time={time} />
        <h1 className="p-display gh-title">
          <span className="gh-line" style={{ "--i": 0 } as React.CSSProperties}>Take the</span>
          <span className="gh-line" style={{ "--i": 1 } as React.CSSProperties}>long way</span>
          <span className="gh-line gh-accent" style={{ "--i": 2 } as React.CSSProperties}>home.</span>
        </h1>
        <p className="gh-intro gh-rise" style={{ "--i": 3 } as React.CSSProperties}>
          Your playlists, as radio stations. Hold <Keycap down={alt}>⌥</Keycap><Keycap down={q}>Q</Keycap> anywhere on your Mac, flick to one, let go.
        </p>
        <div className="gh-actions gh-rise" style={{ "--i": 4 } as React.CSSProperties}>
          <DownloadButton />
          <TryWheelButton />
        </div>
        <p className="gh-meta gh-rise" style={{ "--i": 5 } as React.CSSProperties}>Free · macOS 14 or later · Open source <span className="gh-hold">· or hold <Keycap size="sm" down={alt}>⌥</Keycap><Keycap size="sm" down={q}>Q</Keycap> on this page</span></p>
      </div>
      <NowPlaying />
    </div>
    <BelowFold closingTitle={<>Take the<br />long way.</>} />
  </main>
}

function LocalClock({ time }: { time: TimeOfDay }) {
  const [label, setLabel] = useState("")
  useEffect(() => {
    const tick = () => setLabel(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
    tick()
    const id = window.setInterval(tick, 10_000)
    return () => window.clearInterval(id)
  }, [])
  return <p className="gh-clock gh-rise" style={{ "--i": 0 } as React.CSSProperties}>
    <span>{label || " "}</span><span aria-hidden="true">·</span><span>{time} where you are</span>
  </p>
}

function NowPlaying() {
  const { playing, wheel } = useRadio()
  const now = useNow()
  const live = playing ? onAir(playing.playlist.tracks, now) : null
  return <section className="gh-now p-wrap" aria-label="Now playing">
    <div className="gh-now-card">
      {playing
        ? <img src={playing.playlist.covers[0]} alt="" width="56" height="56" />
        : <span className="gh-now-off" aria-hidden="true" />}
      <div className="gh-now-text">
        <p className="gh-now-label"><span className="gh-now-dot" data-live={playing ? "" : undefined} aria-hidden="true" />{playing ? "On air" : "Radio off"}</p>
        <p className="gh-now-station" role="status">{playing?.playlist.name ?? "Quiet"}</p>
        <p className="gh-now-track">{live ? `${live.track.title} · ${live.track.artist}` : "Pick a station to tune back in."}</p>
      </div>
      {live && <div className="gh-now-time" aria-hidden="true">
        <span>{formatClock(live.position)}</span>
        <span className="gh-now-bar"><span style={{ transform: `scaleX(${live.position / live.track.duration})` }} /></span>
        <span>{formatClock(live.track.duration)}</span>
      </div>}
    </div>
    <div className="gh-now-controls">
      <button className="p-sound" onClick={() => wheel.choose(0)} disabled={!playing}>Radio Off</button>
      <SoundToggle />
    </div>
  </section>
}
