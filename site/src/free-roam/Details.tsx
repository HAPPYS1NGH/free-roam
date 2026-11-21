import { downloadUrl, sourceUrl } from "./content"
import { Keycap, useAltHeld, useKeyHeld } from "./keys"
import { Brand, DownloadButton } from "./Shared"

// Everything below the station list: how it works, questions, the closing
// pitch and the footer.
export function Details() {
  return <>
    <HowItWorks />
    <Faq />
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
      <details><summary>Do I need Apple Music?<span aria-hidden="true">+</span></summary><p>No. Free Roam plays the playlists in the Music app that's already on your Mac, including songs you've imported yourself. You only need a subscription for songs that come from Apple Music. Any Mac on macOS 14 or later works.</p></details>
      <details><summary>Why use it instead of the Music app?<span aria-hidden="true">+</span></summary><p>Because changing the music shouldn't pull you out of what you're doing. Want to watch a YouTube video? Hold ⌥Q, flick to Radio Off, and it's quiet. When you're done, flick back and the station is still on air. No switching apps, no hunting for the pause button.</p></details>
      <details><summary>Can I choose my own stations?<span aria-hidden="true">+</span></summary><p>Yes. Open Settings from the menu bar, drag your playlists into order and click a cover to add or remove one. This page shows the creator's stations; it never touches your library.</p></details>
      <details><summary>Does this page play music?<span aria-hidden="true">+</span></summary><p>Yes. Pick a station and it plays real songs through YouTube, mid-song, wherever its clock has got to. The Mac app plays your own library in Apple Music instead.</p></details>
      <details><summary>What can it see on my Mac?<span aria-hidden="true">+</span></summary><p>Only what it needs to play music. It asks to control the Music app. Screen Recording is optional: it lets the wheel fade the colour of whatever's behind it, and nothing is saved or sent. There's no account and no tracking, and the code is on GitHub for anyone to read. This page loads nothing from YouTube until you tune in. Then the music comes from YouTube, under YouTube's own privacy policy.</p></details>
    </div>
  </section>
}
