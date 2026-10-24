import { sourceUrl } from "./content"

export function Brand() {
  return <a className="brand" href="#top" aria-label="Free Roam home"><svg width="30" height="24" viewBox="0 0 30 24" fill="none" aria-hidden="true"><path d="M2 19 10 5h7L9 19H2Zm11 0L21 5h7l-8 14h-7Z" fill="currentColor" /></svg><span>free roam</span></a>
}

export function Header() {
  return <header className="site-header"><Brand /><nav aria-label="Main navigation"><a href="#how-it-works">The idea</a><a href={sourceUrl} target="_blank" rel="noreferrer">GitHub ↗</a><a className="nav-cta" href="#radio-demo">Tune in <span aria-hidden="true">↗</span></a></nav></header>
}

export function Actions() {
  return <div className="hero-actions"><a className="primary-action" href="#radio-demo">Try the radio <span aria-hidden="true">↗</span></a><a className="text-action" href={`${sourceUrl}#build-the-mac-app`} target="_blank" rel="noreferrer">Build for Mac <span aria-hidden="true">↗</span></a></div>
}

export function Details({ variant }: { variant: "night" | "fm" | "paper" }) {
  return <>
    <section className="story-section" id="how-it-works">
      <div><span className="eyebrow">A familiar feeling</span><h2>{variant === "paper" ? <>Some songs come<br />with a place.</> : <>You weren't going anywhere.<br />That was the point.</>}</h2></div>
      <div className="story-copy"><p>One more lap around the city. One more song before the next mission. Sometimes the best part of the game was the radio.</p><p>Free Roam brings that little ritual to your Mac. Your Apple Music playlists become stations on a wheel. Hold a shortcut, pick a station, and carry on.</p><a className="text-action" href="/" target="_blank" rel="noreferrer">Open the full wheel prototype ↗</a></div>
    </section>
    <section className="how-section" aria-labelledby="how-title"><div className="section-label"><span className="eyebrow" id="how-title">Muscle memory, included.</span><span className="eyebrow">01 / 02 / 03</span></div><div className="steps">
      <article><span className="step-number">01</span><div className="step-visual"><kbd>⌥</kbd><kbd>Q</kbd></div><h3>Hold to tune in.</h3><p>The wheel appears over whatever you're doing. Your playlists, a flick away.</p></article>
      <article><span className="step-number">02</span><div className="step-visual mini-orbit" aria-hidden="true">↗</div><h3>Find your station.</h3><p>Point or scroll to pick a playlist. A little static between stations, just like you remember.</p></article>
      <article><span className="step-number">03</span><div className="step-visual release-mark" aria-hidden="true">↳</div><h3>Let go. Keep going.</h3><p>The music switches. The wheel disappears. You're right where you left off.</p></article>
    </div></section>
    <section className="questions"><h2>Before you hit the road.</h2><div>
      <details><summary>What do I need?<span aria-hidden="true">+</span></summary><p>A Mac running macOS 14 or later and the Music app. Your local music library works too; an Apple Music subscription is optional. Building the current app requires Xcode 16 or later.</p></details>
      <details><summary>Can I use my own playlists?<span aria-hidden="true">+</span></summary><p>Yes. In the Mac app, open Settings from the menu bar to choose the playlists on your wheel and their order. The stations on this page are examples.</p></details>
      <details><summary>Can I download it yet?<span aria-hidden="true">+</span></summary><p>The app is a work in progress, currently named Static in the repository. Free Roam is the new name being explored here. You can try the browser prototype or build the Mac app from source.</p><a href={`${sourceUrl}#build-the-mac-app`} target="_blank" rel="noreferrer">View build instructions ↗</a></details>
      <details><summary>Is this connected to GTA?<span aria-hidden="true">+</span></summary><p>No. This is an independent app inspired by the feeling of switching radio stations in open-world games.</p></details>
    </div></section>
    <footer className="site-footer"><Brand /><span>For the long way home.</span><a href={sourceUrl} target="_blank" rel="noreferrer">An independent Mac app ↗</a></footer>
  </>
}
