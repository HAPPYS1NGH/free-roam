import { useEffect, useState } from "react"
import { onAir, useNow } from "../broadcast"
import { useMounted } from "../useMounted"
import { LazyDrive } from "./drive/LazyDrive"
import { Keycap, useAltHeld, useKeyHeld } from "./keys"
import { LiveRadio, type LiveAudio } from "./live/LiveRadio"
import { track } from "./analytics"
import { useRadio } from "./RadioProvider"
import { Brand, DownloadButton, OnAirTally, SoundToggle } from "./Shared"

// The hero: one line, a coast road at the visitor's hour, and the live drive
// over it where the machine can afford it. Tuning in plays the station through
// a hidden YouTube player.
export function Hero() {
  const q = useKeyHeld("q")
  const alt = useAltHeld()
  const { retunes, playing, audio } = useRadio()
  // Nothing is requested from YouTube until the visitor starts choosing a station.
  const [liveAudio, setLiveAudio] = useState<LiveAudio>({ kind: "idle" })
  // Analytics: whether the YouTube music actually plays, gets held back by the browser, or fails.
  useEffect(() => {
    if (liveAudio.kind === "idle" || liveAudio.kind === "connecting") return
    track("youtube_audio", { state: liveAudio.kind, station: playing?.playlist.name ?? "Radio Off" })
  }, [liveAudio.kind])
  useTimeOfDay()
  return <section className="ta-hero" data-lift={q && alt ? "" : undefined} aria-labelledby="ta-title">
    <div className="ta-scene" aria-hidden="true">
      <div className="ta-scene-img" />
      <LazyDrive className="ta-drive" label="A coupe drives a coastal highway beside the sea" />
      <div className="ta-grade" />
      {retunes > 0 && <div key={retunes} className="ta-retune" />}
    </div>
    <header className="p-nav ta-nav">
      <Brand />
      <OnAirTally />
      <DownloadButton size="sm" className="ta-nav-cta" />
    </header>
    <div className="ta-copy p-wrap">
      <h1 id="ta-title" className="p-display ta-line">
        <span className="ta-hover">Hold <Keycap size="xl" down={alt}>⌥</Keycap><Keycap size="xl" down={q}>Q</Keycap> anywhere.</span>
        <span className="ta-touch">The radio’s on.</span>
      </h1>
      <p className="ta-sub">Your playlists, as <span>radio stations.</span></p>
      <div className="ta-actions">
        <DownloadButton size="md" />
        <TryButton />
      </div>
    </div>
    <LiveRadio playing={playing} muted={!audio.enabled} onChange={setLiveAudio} />
    <Caption live={liveAudio} />
  </section>
}

type TimeOfDay = "dawn" | "day" | "dusk" | "night"

// Keep in step with the inline script in index.html, which picks the photo
// before first paint so only that one loads.
function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 8) return "dawn"
  if (hour >= 8 && hour < 17) return "day"
  if (hour >= 17 && hour < 20) return "dusk"
  return "night"
}

// The photo is a CSS background chosen by <html data-time>, so the prerender
// stays the same at every hour. This moves it on if the hour turns while the
// page is open.
function useTimeOfDay() {
  useEffect(() => {
    const tick = () => { document.documentElement.dataset.time = timeOfDay(new Date().getHours()) }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])
}

// Desktop visitors can hold ⌥Q right here, so the button is for touch only.
function TryButton() {
  const { wheel } = useRadio()
  return <button className="ta-try ta-touch" onClick={wheel.show} aria-expanded={wheel.open}>Try the wheel</button>
}

const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

// A subtitle-style caption: the visitor's own clock, the song you're hearing
// and how far into it, and the sound toggle, which mutes the music too.
function Caption({ live: liveAudio }: { live: LiveAudio }) {
  const now = useNow()
  const mounted = useMounted()
  const { playing } = useRadio()
  const onAirNow = playing ? onAir(playing.playlist.tracks, now) : null
  const heard = liveAudio.kind === "hearing" ? liveAudio.hearing : null
  const live = heard ? { track: heard.track, position: Math.min(Math.max(0, now - heard.startedAt), heard.track.duration) } : onAirNow
  // The time zone differs between the prerender and the visitor.
  const clock = mounted ? new Date(now * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--:--"
  const note = liveAudio.kind === "blocked" ? "Click for sound"
    : liveAudio.kind === "failed" ? "Couldn’t reach YouTube"
    : heard?.ad ? "YouTube ad, then" : null
  return <p className="ta-caption p-wrap">
    <span>{clock}</span>
    <span aria-hidden="true">·</span>
    {liveAudio.kind === "silent" && playing ? <span>{playing.playlist.name} has no audio here</span>
      : live ? <span className="ta-caption-track">{note && <span className="ta-caption-note">{note} </span>}{live.track.title} — {live.track.artist} <span className="ta-caption-time">{formatClock(live.position)}</span></span>
      : <span>Radio off</span>}
    <span aria-hidden="true">·</span>
    <SoundToggle />
  </p>
}
