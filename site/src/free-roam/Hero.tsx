import { useEffect, useRef, useState } from "react"
import { onAir, useNow } from "../broadcast"
import { useMounted } from "../useMounted"
import { LazyDrive } from "./drive/LazyDrive"
import { Keycap, useAltHeld, useKeyHeld } from "./keys"
import { LiveRadio, type LiveAudio } from "./live/LiveRadio"
import { track } from "./analytics"
import { useRadio } from "./RadioProvider"
import { Brand, DownloadButton, OnAirTally, SoundToggle } from "./Shared"
import { useHoldToTune } from "./useHoldToTune"

// The hero: one line, a coast road at the visitor's hour, and the live drive
// over it where the machine can afford it. Tuning in plays the station through
// a hidden YouTube player. On touch, holding anywhere in the hero opens the wheel.
export function Hero() {
  const q = useKeyHeld("q")
  const alt = useAltHeld()
  const { retunes, playing, audio, wheel } = useRadio()
  const hero = useRef<HTMLElement>(null)
  useHoldToTune(hero, wheel)
  // Nothing is requested from YouTube until the visitor starts choosing a station.
  const [liveAudio, setLiveAudio] = useState<LiveAudio>({ kind: "idle" })
  // Analytics: whether the YouTube music actually plays, gets held back by the browser, or fails.
  useEffect(() => {
    if (liveAudio.kind === "idle" || liveAudio.kind === "connecting") return
    track("youtube_audio", { state: liveAudio.kind, station: playing?.playlist.name ?? "Radio Off" })
  }, [liveAudio.kind])
  useTimeOfDay()
  return <section ref={hero} className="ta-hero" data-lift={q && alt ? "" : undefined} aria-labelledby="ta-title">
    <div className="ta-scene" aria-hidden="true">
      <div className="ta-scene-img" />
      <LazyDrive className="ta-drive" />
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
        <span className="ta-touch">Radio for your Mac.</span>
      </h1>
      <p className="ta-sub">Flick to a playlist and it plays, <span>without switching apps.</span></p>
      <div className="ta-actions">
        <DownloadButton size="md" />
        <TryButton />
        <span className="ta-hint ta-hover">or hold <Keycap size="sm" down={alt}>⌥</Keycap><Keycap size="sm" down={q}>Q</Keycap> to try it here</span>
      </div>
      <WorksWith />
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

// Which apps it plays from, as a quick scan under the button. Spotify's mark
// is its icon unchanged, in one colour; Apple's Music icon isn't for other
// apps' marketing, so Apple Music is the plain name.
function WorksWith() {
  return <p className="ta-works">
    <span className="ta-works-label">Works with</span>
    <span className="ta-works-app">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>
      Spotify
    </span>
    <span className="ta-works-app">Apple Music</span>
  </p>
}

// Desktop visitors can hold ⌥Q right here, so the button is for touch only,
// where it's the first thing to press (see .ta-actions in hero.css).
function TryButton() {
  const { wheel } = useRadio()
  return <button className="ta-try ta-touch" onClick={() => wheel.show()} aria-expanded={wheel.open}>Try the radio</button>
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
      : <span>Radio off<span className="ta-hover"> · hold ⌥Q to tune in</span><span className="ta-touch"> · touch and hold to tune in</span></span>}
    <span aria-hidden="true">·</span>
    <SoundToggle />
  </p>
}
