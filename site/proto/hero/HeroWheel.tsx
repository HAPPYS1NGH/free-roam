import { useRef, useState, type PointerEvent } from "react"
import { slotForVector } from "../../src/geometry"
import { playSound, unlockAudio } from "../../src/sound"
import { WheelFace } from "../../src/free-roam/WheelFace"
import { SoundToggle, demoSlots, formatClock, frequency, onAir, useNow, useRadio } from "./radio"
import "./HeroWheel.css"

// The wheel as a hero element: point at a station to preview it, click or tap
// to tune in. Same angle rule as the app, with a dead zone in the middle so
// the caption area doesn't flicker.
export function HeroWheel({ className = "" }: { className?: string }) {
  const { wheel, audio, playing, playingIndex } = useRadio()
  const now = useNow()
  const [preview, setPreview] = useState<number | null>(null)
  const stage = useRef<HTMLDivElement>(null)

  const highlighted = preview ?? Math.max(0, playingIndex)
  const live = playing ? onAir(playing.playlist.tracks, now) : null

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return
    const rect = stage.current?.getBoundingClientRect()
    if (!rect) return
    const x = event.clientX - (rect.left + rect.width / 2)
    const y = event.clientY - (rect.top + rect.height / 2)
    if (Math.hypot(x, y) < rect.width * 0.2) return
    const next = slotForVector(x, y, demoSlots.length)
    if (next !== preview) {
      setPreview(next)
      playSound("hover", audio.sounds.hoverVolumeDb)
    }
  }

  const choose = (index: number) => {
    unlockAudio()
    setPreview(null)
    wheel.choose(index)
  }

  return <div className={`hw ${className}`}>
    <div className="hw-wheel" ref={stage} onPointerDown={() => unlockAudio()} onPointerLeave={() => setPreview(null)}
      onClick={event => { if (preview !== null && !(event.target as Element).closest("button")) choose(preview) }}>
      <WheelFace highlighted={highlighted} onChoose={choose} onPointerMove={onPointerMove} />
    </div>
    <div className="hw-now">
      <span className="hw-freq">{playing ? frequency(playingIndex) : "--.-"}</span>
      <div className="hw-now-text" role="status">
        {playing ? <>
          <strong>{playing.playlist.name}</strong>
          <span>{live ? `${live.track.title} · ${live.track.artist}` : ""}</span>
        </> : <><strong>Radio off</strong><span>Point at a station to tune in</span></>}
      </div>
      <span className="hw-time">{live ? `${formatClock(live.position)} / ${formatClock(live.track.duration)}` : ""}</span>
      <SoundToggle />
    </div>
    <p className="hw-touch-hint">Tap a station to tune in.</p>
  </div>
}
