import { onAir, useNow } from "../broadcast"
import { demoSlots } from "./demo-stations"
import { useRadio } from "./RadioProvider"

const frequency = (index: number) => (88.1 + (index - 1) * 1.6).toFixed(1)

// The same stations as the wheel, as a list anyone can tap or tab through.
// Each one is on its broadcast clock, so what's playing changes as you watch.
export function Stations() {
  const now = useNow()
  const { wheel } = useRadio()
  return <section className="p-section p-dial" id="stations" aria-labelledby="dial-title">
    <div className="p-section-head">
      <p className="p-eyebrow">On the dial</p>
      <h2 id="dial-title">Every station is already playing.</h2>
      <p>Each playlist runs on its own clock. Tune in and you land mid-song, right where it would be if it had been on all along. Leave, come back, it kept going. These are my playlists. In the app, the stations are your own playlists.</p>
    </div>
    <ul className="p-dial-list">
      {demoSlots.map((slot, index) => {
        if (slot.kind !== "playlist") return null
        const live = onAir(slot.playlist.tracks, now)
        const progress = live ? live.position / live.track.duration : 0
        return <li key={slot.id}>
          <button className="p-dial-row" aria-pressed={wheel.playingId === slot.id} onClick={() => wheel.choose(index)}>
            <span className="p-freq">{frequency(index)}</span>
            <img src={slot.playlist.covers[0]} alt="" width="44" height="44" loading="lazy" />
            <span className="p-dial-name">{slot.playlist.name}</span>
            <span className="p-dial-track">{live ? `${live.track.title} · ${live.track.artist}` : ""}</span>
            <span className="p-dial-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></span>
          </button>
        </li>
      })}
    </ul>
  </section>
}
