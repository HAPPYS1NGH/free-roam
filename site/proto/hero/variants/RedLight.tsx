import type { CSSProperties } from "react"
import { HeroWheel } from "../HeroWheel"
import {
  BelowFold, DownloadButton, EXTRA_SCENES, Keycap, Nav, SceneImage, StaticBurst,
  pageAttrs, useAltHeld, useFx, useIntro, useKeyHeld, usePageStyle,
} from "../radio"
import "./RedLight.css"

// Red Light: the wheel is the hero. Point at a station to preview it, click or
// tap to tune in, exactly like flicking through stations at a light.
export default function RedLight() {
  const fx = useFx()
  const intro = useIntro()
  const alt = useAltHeld()
  const q = useKeyHeld("q")
  return <main className="p-page rl" id="top" data-intro={intro ? "" : undefined} {...pageAttrs(fx)} style={usePageStyle()}>
    <div className="rl-scene">
      <SceneImage className="rl-scene-image" src={EXTRA_SCENES.dash} alt="" priority />
      <div className="rl-scene-shade" />
      <StaticBurst />
    </div>
    <Nav />
    <section className="rl-hero" aria-labelledby="rl-title">
      <div className="rl-copy">
        <p className="p-eyebrow rl-step" style={{ "--i": 0 } as CSSProperties}>Your playlists, on a radio wheel</p>
        <h1 id="rl-title" className="p-display rl-title">
          <span className="rl-step" style={{ "--i": 1 } as CSSProperties}>Hold.</span>
          <span className="rl-step" style={{ "--i": 2 } as CSSProperties}>Flick.</span>
          <span className="rl-step rl-accent" style={{ "--i": 3 } as CSSProperties}>Let go.</span>
        </h1>
        <p className="rl-intro rl-step" style={{ "--i": 4 } as CSSProperties}>
          Hold <Keycap down={alt}>⌥</Keycap><Keycap down={q}>Q</Keycap> anywhere on your Mac and your playlists come up on a wheel. Flick toward one, let go, and it's on air.
        </p>
        <div className="rl-actions rl-step" style={{ "--i": 5 } as CSSProperties}>
          <DownloadButton />
          <p className="rl-hint">or hold <Keycap size="sm" down={alt}>⌥</Keycap><Keycap size="sm" down={q}>Q</Keycap> on this page</p>
        </div>
        <p className="rl-meta rl-step" style={{ "--i": 6 } as CSSProperties}>Free · macOS 14+ · Open source</p>
      </div>

      <HeroWheel className="rl-wheel-col" />
    </section>
    <BelowFold />
  </main>
}
