import { onAir, useNow } from "../broadcast"
import { demoSlots } from "./demo-stations"

type Props = { playingId: string | null; onChoose: (index: number) => void }

// The same stations as the wheel, as a list anyone can tap or tab through.
// Each one is on its broadcast clock, so what's playing changes as you watch.
export function Stations({ playingId, onChoose }: Props) {
  const now = useNow()
  return <section className="stations" id="stations" aria-labelledby="stations-title">
    <div className="stations-intro">
      <span className="eyebrow">On the dial</span>
      <h2 id="stations-title">Every station is already playing.</h2>
      <p>Each playlist runs on its own clock, like a real station. Tune in and you land mid-song, wherever it would be if it had been on all along.</p>
    </div>
    <ul className="station-list">
      {demoSlots.map((slot, index) => {
        if (slot.kind !== "playlist") return null
        const live = onAir(slot.playlist.tracks, now)
        return <li key={slot.id}>
          <button className="station-row" aria-pressed={playingId === slot.id} onClick={() => onChoose(index)}>
            <img src={slot.playlist.covers[0]} alt="" width="48" height="48" loading="lazy" />
            <span className="station-name">{slot.playlist.name}</span>
            <span className="station-track">{live ? `${live.track.title} · ${live.track.artist}` : ""}</span>
          </button>
        </li>
      })}
    </ul>
  </section>
}
