import { Actions, Details, Header } from "./Shared"
import { RadioDemo } from "./RadioDemo"

export function AfterHours() {
  return <main className="direction night" id="top">
    <div className="night-scene">
      <img className="scene-image" src="/free-roam/coast.jpg" alt="A solitary car on a coastal highway at dusk" width="1672" height="941" fetchPriority="high" />
      <div className="scene-shade" />
      <Header />
      <div className="night-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> A radio for your favorite music</p>
          <h1>Take the<br />long way<br /><span>home.</span></h1>
          <p className="intro">Switch the mood. Find a little quiet.<br />Your playlists, one shortcut away.</p>
          <Actions />
          <p className="compatibility">macOS 14+ <span>·</span> Works with the Music app</p>
        </div>
        <RadioDemo />
      </div>
      <div className="scene-bottom"><span>Nothing to search. Just tune in.</span><span>Made for the way you listen.</span><a href="#how-it-works" aria-label="Read about Free Roam">↓</a></div>
    </div>
    <Details />
  </main>
}
