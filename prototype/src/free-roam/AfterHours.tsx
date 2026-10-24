import { Actions, Details, Header } from "./Shared"
import { RadioDemo } from "./RadioDemo"

export function AfterHours() {
  return <main className="direction night" id="top"><div className="night-scene"><img className="scene-image" src="/free-roam/coast.jpg" alt="A solitary car on a coastal highway at dusk" width="1672" height="941" /><div className="scene-shade" /><Header /><div className="night-hero"><div className="hero-copy"><p className="eyebrow"><span className="status-dot" /> A radio wheel for your Mac</p><h1>Take the<br />long way<br /><span>home.</span></h1><p className="intro">The radio wheel you remember.<br />The music you never grew out of.</p><Actions /><p className="compatibility">macOS 14+ <span>·</span> Made for Apple Music</p></div><RadioDemo /></div><div className="scene-bottom"><span>Open roads. No missions.</span><span>Free Roam / After hours edition</span><a href="#how-it-works" aria-label="Read about Free Roam">↓</a></div></div><Details variant="night" /></main>
}
