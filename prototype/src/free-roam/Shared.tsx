import { sourceUrl } from "./content"

export function Brand({ href = "#top" }: { href?: string }) {
  return <a className="brand" href={href} aria-label="Free Roam home">
    <img className="brand-logo" src="/free-roam/badge.png" alt="" width="240" height="240" />
    <span className="brand-wordmark">Free Roam</span>
  </a>
}

export function Header() {
  return <header className="site-header"><Brand /><nav aria-label="Main navigation">
    <a href="#stations">Stations</a>
    <a href="#how-it-works">How it works</a>
    <a href={sourceUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
    <a className="nav-cta" href={`${sourceUrl}#build-the-mac-app`} target="_blank" rel="noreferrer">Build for Mac <span aria-hidden="true">↗</span></a>
  </nav></header>
}

export function Details() {
  return <>
    <section className="how-section" id="how-it-works" aria-labelledby="how-title">
      <h2 id="how-title" className="eyebrow">How it works</h2>
      <ol className="steps">
        <li><h3>Hold <kbd>⌥</kbd><kbd>Q</kbd></h3><p>The wheel opens over whatever you're doing, on the station that's playing.</p></li>
        <li><h3>Flick</h3><p>Move the mouse or scroll toward a station. Rest on one for a second and it tunes in.</p></li>
        <li><h3>Let go</h3><p>The wheel closes and you're back to work. Choose Radio Off when you need quiet.</p></li>
      </ol>
      <p className="steps-aside">Just tap <kbd>⌥</kbd><kbd>Q</kbd> to skip to the next station without opening the wheel.</p>
    </section>
    <section className="questions" aria-labelledby="questions-title"><h2 id="questions-title">A few things to know</h2><div>
      <details><summary>What do I need?<span aria-hidden="true">+</span></summary><p>A Mac running macOS 14 or later and the Music app. Free Roam plays the playlists in your Music app. Songs you own, imported or purchased, play without a subscription; Apple Music songs need one. Building the current app requires Xcode 26 or later.</p></details>
      <details><summary>Can I choose my own stations?<span aria-hidden="true">+</span></summary><p>Yes. Open Settings from the Mac app's menu bar to choose your playlists and put them in order. This page includes God's Favorite, gym, PLow, Morning Playlist, Favourite Songs, and Veere da Vyah, shared by the creator, alongside popular picks. It never accesses a visitor's Music library.</p></details>
      <details><summary>Does this page play music?<span aria-hidden="true">+</span></summary><p>No, only the wheel. It's the Mac app's wheel with the same sound effects from the Mac app, which start on your first interaction and can be muted. It doesn't access your Music library or play songs. The Mac app controls playback in Music.</p></details>
      <details><summary>How do I get the Mac app?<span aria-hidden="true">+</span></summary><p>You can build it from source today. A signed download isn't available yet.</p><a href={`${sourceUrl}#build-the-mac-app`} target="_blank" rel="noreferrer">Build instructions ↗</a></details>
      <details><summary>Is this connected to GTA?<span aria-hidden="true">+</span></summary><p>No. Free Roam is an independent app inspired by switching radio stations in open-world games.</p></details>
    </div></section>
    <section className="closing" aria-labelledby="closing-title">
      <h2 id="closing-title">Put it on your Mac.</h2>
      <p>Free and open source under the MIT license. Build it with Xcode today; a signed download comes later.</p>
      <a className="primary-action" href={`${sourceUrl}#build-the-mac-app`} target="_blank" rel="noreferrer">Build instructions <span aria-hidden="true">↗</span></a>
    </section>
    <footer className="site-footer"><Brand /><span>Your music. A little more freedom.</span><a href={sourceUrl} target="_blank" rel="noreferrer">An independent Mac app ↗</a></footer>
  </>
}
