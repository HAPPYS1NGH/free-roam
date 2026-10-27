import { sourceUrl } from "./content"

export function Brand({ href = "#top" }: { href?: string }) {
  return <a className="brand" href={href} aria-label="Free Roam home">
    <img className="brand-logo" src="/free-roam/badge.png" alt="" width="240" height="240" />
    <span className="brand-wordmark">Free Roam</span>
  </a>
}

export function Header() {
  return <header className="site-header"><Brand /><nav aria-label="Main navigation">
    <a href="#how-it-works">How it works</a>
    <a href={sourceUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
    <a className="nav-cta" href="/">Try the demo <span aria-hidden="true">↗</span></a>
  </nav></header>
}

export function Actions() {
  return <div className="hero-actions">
    <a className="primary-action" href="/">Try the radio <span aria-hidden="true">↗</span></a>
    <a className="text-action" href={`${sourceUrl}#build-the-mac-app`} target="_blank" rel="noreferrer">Build for Mac <span aria-hidden="true">↗</span></a>
  </div>
}

export function Details({ variant: _variant }: { variant?: "night" | "fm" | "paper" }) {
  return <>
    <section className="story-section" id="how-it-works">
      <div><span className="eyebrow">Your favorites, on the dial</span><h2>You know the feeling.<br />You just need the music.</h2></div>
      <div className="story-copy">
        <p>You want a different mood. So you open Music, scroll through playlists, and forget what you were doing.</p>
        <p>Free Roam turns your playlists into radio stations. Hold a shortcut, flick to something familiar, and carry on. Each station keeps its place, so you drop into the music like switching on the radio.</p>
        <p>Need to concentrate? Pick Radio Off from the same wheel. A little quiet, without opening another app.</p>
      </div>
    </section>
    <section className="how-section" aria-labelledby="how-title">
      <div className="section-label"><span className="eyebrow" id="how-title">A shortcut you'll remember</span><span className="eyebrow">⌥ + Q</span></div>
      <div className="steps">
        <article><span className="step-number">01</span><div className="step-visual"><kbd>⌥</kbd><kbd>Q</kbd></div><h3>Hold to tune in.</h3><p>Your stations appear over whatever you're doing. A quick tap skips to the next one.</p></article>
        <article><span className="step-number">02</span><div className="step-visual mini-orbit" aria-hidden="true">↗</div><h3>Follow your mood.</h3><p>Move or scroll to a station. Rest on it to tune in, or release the shortcut to choose.</p></article>
        <article><span className="step-number">03</span><div className="step-visual release-mark" aria-hidden="true">↳</div><h3>Get back to it.</h3><p>The wheel disappears when you let go. Choose Radio Off whenever you need quiet.</p></article>
      </div>
    </section>
    <section className="questions"><h2>A few things to know.</h2><div>
      <details><summary>What do I need?<span aria-hidden="true">+</span></summary><p>A Mac running macOS 14 or later and the Music app. Free Roam plays the playlists in your Music app. Songs you own, imported or purchased, play without a subscription; Apple Music songs need one. Building the current app requires Xcode 26 or later.</p></details>
      <details><summary>Can I choose my own stations?<span aria-hidden="true">+</span></summary><p>Yes. Open Settings from the Mac app's menu bar to choose your playlists and put them in order. This demo includes God's Favorite, gym, PLow, and Morning Playlist, shared by the creator, alongside popular picks. It never accesses a visitor's Music library.</p></details>
      <details><summary>Does the browser demo play music?<span aria-hidden="true">+</span></summary><p>The browser uses the same open, close, selection, and tuning sounds as the Mac app. Sound starts with your first interaction and can be muted. It doesn't access your Music library or play songs. The Mac app controls playback in Music.</p></details>
      <details><summary>How do I get the Mac app?<span aria-hidden="true">+</span></summary><p>You can build it from source today. A signed download isn't available yet.</p><a href={`${sourceUrl}#build-the-mac-app`} target="_blank" rel="noreferrer">Build instructions ↗</a></details>
      <details><summary>Is this connected to GTA?<span aria-hidden="true">+</span></summary><p>No. Free Roam is an independent app inspired by switching radio stations in open-world games.</p></details>
    </div></section>
    <footer className="site-footer"><Brand /><span>Your music. A little more freedom.</span><a href={sourceUrl} target="_blank" rel="noreferrer">An independent Mac app ↗</a></footer>
  </>
}
