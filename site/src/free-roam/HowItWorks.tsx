import { Keycap, useAltHeld, useKeyHeld } from "./keys"
import { landscapeDemo, MacDemoVideo } from "./MacDemoVideo"

// The landscape film with the three steps as captions under it. Touch sees the
// portrait cut in its own section above (OnYourMac), so the film here is for
// mice only.
export function HowItWorks() {
  const q = useKeyHeld("q")
  const alt = useAltHeld()
  const keys = (size?: "sm") => <><Keycap size={size} down={alt}>⌥</Keycap><Keycap size={size} down={q}>Q</Keycap></>
  return <section className="p-section p-how" id="how-it-works" aria-labelledby="how-title">
    <div className="p-section-head">
      <p className="p-eyebrow">How it works</p>
      <h2 id="how-title">Change or stop the music in a blink.</h2>
    </div>
    <MacDemoVideo clip={landscapeDemo} media="(hover: hover)" placement="how-it-works" className="p-how-video" />
    <ol className="p-steps">
      <li><h3>Hold {keys("sm")}</h3><p>Wherever you are on your Mac, the wheel opens.</p></li>
      <li><h3>Flick</h3><p>Point at a playlist. Rest on it and it tunes in.</p></li>
      <li><h3>Let go</h3><p>You never left what you were doing.</p></li>
    </ol>
    <p className="p-aside">Tap {keys("sm")} to skip to the next station.</p>
  </section>
}

// The everyday use people don't expect: silencing the music without finding it.
export function RadioOff() {
  return <section className="p-section p-radio-off" aria-labelledby="radio-off-title">
    <div className="p-section-head">
      <p className="p-eyebrow">Radio Off</p>
      <h2 id="radio-off-title">Call starting? Silence in a flick.</h2>
    </div>
    <p className="p-radio-off-text">Hold <Keycap size="sm">⌥</Keycap><Keycap size="sm">Q</Keycap>, flick to Radio Off, and the music stops. No hunting for which app is playing or where its pause button is. Flick back after and the station is still on air.</p>
  </section>
}
