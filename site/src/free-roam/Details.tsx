import { Footer } from "./footer/Footer"
import { Keycap, useAltHeld, useKeyHeld } from "./keys"
import { DownloadButton } from "./Shared"

// Everything below the station list: how it works, questions, the closing
// pitch and the footer.
export function Details() {
  return <>
    <HowItWorks />
    <Faq />
    <section className="p-section ta-closing" aria-labelledby="ta-closing-title">
      <h2 id="ta-closing-title" className="p-display">The road’s empty.<br /><span>The radio’s on.</span></h2>
      <p>Free and open source. For Spotify or Apple Music, on macOS 14 or later.</p>
      <DownloadButton />
    </section>
    <Footer />
  </>
}

function HowItWorks() {
  const q = useKeyHeld("q")
  const alt = useAltHeld()
  return <section className="p-section p-how" id="how-it-works" aria-labelledby="how-title">
    <h2 className="p-eyebrow" id="how-title">How it works</h2>
    <ol className="p-steps">
      <li><h3>Hold <Keycap down={alt}>⌥</Keycap><Keycap down={q}>Q</Keycap></h3><p>The wheel opens over whatever you're doing, on the station that's playing.</p></li>
      <li><h3>Flick</h3><p>Move the mouse or scroll toward a station. Rest on one for a second and it tunes in.</p></li>
      <li><h3>Let go</h3><p>The wheel closes and you're back to it. Pick Radio Off when you need quiet.</p></li>
    </ol>
    <p className="p-aside">Tap <Keycap size="sm">⌥</Keycap><Keycap size="sm">Q</Keycap> to skip to the next station without opening the wheel.</p>
  </section>
}

function Faq() {
  return <section className="p-section p-faq" aria-labelledby="faq-title">
    <h2 id="faq-title">A few things to know</h2>
    <div>
      <details><summary>Which music apps does it work with?<span aria-hidden="true">+</span></summary><p>Spotify or Apple Music, whichever you pick under <strong>Play from</strong> in the menu bar. Spotify needs its desktop app (1.3.10 or later). Free and Premium both work, and there's no sign-in. With Apple Music, it plays the playlists in the Music app on your Mac, including songs you've imported, so you only need a subscription for songs from the Apple Music catalog. The Spotify web player and YouTube Music aren't supported. Any Mac on macOS 14 or later works.</p></details>
      <details><summary>Isn't this just Spotify Radio?<span aria-hidden="true">+</span></summary><p>No. Spotify Radio picks songs for you. Free Roam plays your own playlists, and each one keeps going on its own clock, so you tune in mid-song like a real radio. You switch with a flick, from any app. Want to watch a video? Hold ⌥Q, flick to Radio Off, and it's quiet. Flick back and the station is still on air.</p></details>
      <details><summary>Why would it want Screen Recording?<span aria-hidden="true">+</span></summary><p>It never asks for it by itself, and you don't need it. Without it, the wheel opens over a tinted background and works the same. Turn it on and the wheel fades the screen behind it instead. Nothing is saved or sent. The only permission Free Roam needs is control of Spotify or Music. It has no account and no analytics, and it goes online only for Spotify song covers and, if you allow it, to check GitHub for an update. The code is on GitHub for anyone to read.</p></details>
      <details><summary>Can I choose my own stations?<span aria-hidden="true">+</span></summary><p>Yes. Open Settings from the menu bar, drag your playlists into order, and click a cover to add or remove one.</p></details>
    </div>
  </section>
}
