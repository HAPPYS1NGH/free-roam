import { useState } from "react"
import {
  Brand, DownloadButton, Dial, EXTRA_SCENES, Faq, HowItWorks, Keycap, OnAirTally, SCENES, SceneImage,
  formatClock, onAir, pageAttrs, useAltHeld, useFx, useIntro, useKeyHeld, useNow, usePageStyle, useRadio, useTimeOfDay,
  type TimeOfDay,
} from "../radio"
import { LazyDrive } from "../drive/LazyDrive"
import { LiveRadio, type Hearing } from "../youtube/LiveRadio"
import { downloadUrl, sourceUrl } from "../../../src/free-roam/content"
import "./ThreeAM.css"

const TIMES: TimeOfDay[] = ["dawn", "day", "dusk", "night"]

// 3 A.M. — night-drive solitude. The quietest direction: one line, an empty
// road, and the only motion is what your hands do.
// Scenes: "time" is the coast photo for the visitor's hour; "night" is the first
// take, the empty night road graded darker; "drive" lays the live coast drive
// over the time photo where the visitor's machine can afford it.
export default function ThreeAM({ scene = "time" }: { scene?: "time" | "night" | "drive" }) {
  const night = scene === "night"
  const fx = useFx()
  const intro = useIntro()
  const q = useKeyHeld("q")
  const alt = useAltHeld()
  const time = useTimeOfDay()
  const { retunes } = useRadio()
  // Live audio is opt-in and only on the drive scene; until the visitor asks,
  // nothing is requested from YouTube.
  const [listening, setListening] = useState(false)
  const [hearing, setHearing] = useState<Hearing | null>(null)
  return <main className={night ? "p-page ta ta-night" : "p-page ta"} id="top" {...pageAttrs(fx)} style={usePageStyle()} data-intro={intro ? "" : undefined}>
    <section className="ta-hero" data-lift={q && alt ? "" : undefined} aria-labelledby="ta-title">
      <div className="ta-scene" aria-hidden="true">
        {night ? <SceneImage className="ta-scene-img is-active" src={EXTRA_SCENES.road} alt="" priority /> : TIMES.map(t => <SceneImage key={t} className={t === time ? "ta-scene-img is-active" : "ta-scene-img"} src={SCENES[t]} alt="" priority={t === time} />)}
        {scene === "drive" && <LazyDrive className="ta-drive" label="A coupe drives a coastal highway beside the sea" />}
        <div className="ta-grade" />
        {retunes > 0 && <div key={retunes} className="ta-retune" />}
      </div>
      <header className="p-nav ta-nav">
        <Brand />
        <OnAirTally />
        <a className="p-button p-button-sm ta-nav-cta" href={downloadUrl}>Download for Mac</a>
      </header>
      <div className="ta-copy p-wrap">
        {listening && <LiveRadio onClose={() => setListening(false)} onHearing={setHearing} />}
        <h1 id="ta-title" className="p-display ta-line">
          <span className="ta-hover">Hold <Keycap size="xl" down={alt}>⌥</Keycap><Keycap size="xl" down={q}>Q</Keycap> anywhere.</span>
          <span className="ta-touch">The radio’s on.</span>
        </h1>
        <p className="ta-sub">Your playlists, as <span>radio stations.</span></p>
        <div className="ta-actions">
          <DownloadButton size="md" />
          <TryLink />
        </div>
      </div>
      <Caption live={scene === "drive" ? { listening, hearing, toggle: () => setListening(on => !on) } : undefined} />
    </section>
    <Dial />
    <HowItWorks />
    <Faq listenLive={scene === "drive"} />
    <section className="p-section ta-closing" aria-labelledby="ta-closing-title">
      <h2 id="ta-closing-title" className="p-display">The road’s empty.<br /><span>The radio’s on.</span></h2>
      <p>Free and open source. macOS 14 or later.</p>
      <DownloadButton />
    </section>
    <footer className="ta-footer">
      <div className="ta-lamps" aria-hidden="true" />
      <div className="ta-footer-row p-wrap">
        <Brand />
        <p className="p-footer-line">Hold ⌥Q anywhere.</p>
        <nav aria-label="Footer">
          <a href={downloadUrl}>Download</a>
          <a href={sourceUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href="https://x.com/HAPPYS1NGH" target="_blank" rel="noreferrer">X ↗</a>
        </nav>
      </div>
    </footer>
  </main>
}

// Desktop visitors can hold ⌥Q right here, so the button is for touch only.
function TryLink() {
  const { wheel } = useRadio()
  return <button className="ta-try ta-touch" onClick={wheel.show} aria-expanded={wheel.open}>
    Try the wheel
  </button>
}

// A subtitle-style caption: the visitor's own clock and what's on air. On the
// drive scene it also carries the Listen live switch, and while YouTube is
// playing it names the song you're actually hearing.
type CaptionLive = { listening: boolean; hearing: Hearing | null; toggle: () => void }
function Caption({ live: liveAudio }: { live?: CaptionLive }) {
  const now = useNow()
  const { playing } = useRadio()
  const onAirNow = playing ? onAir(playing.playlist.tracks, now) : null
  const heard = liveAudio?.hearing
  const live = heard ? { track: heard.track, position: Math.min(Math.max(0, now - heard.startedAt), heard.track.duration) } : onAirNow
  const clock = new Date(now * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  return <p className="ta-caption p-wrap">
    <span>{clock}</span>
    <span aria-hidden="true">·</span>
    {/* Before the song, so a long title can't push it out of reach. */}
    {liveAudio && <>
      <button type="button" className="ta-listen" aria-pressed={liveAudio.listening} onClick={liveAudio.toggle}>
        {liveAudio.listening ? "Stop listening" : "Listen live"}
      </button>
      <span aria-hidden="true">·</span>
    </>}
    {live ? <span className="ta-caption-track">{live.track.title} — {live.track.artist} <span className="ta-caption-time">{formatClock(live.position)}</span></span> : <span>Radio off</span>}
  </p>
}
