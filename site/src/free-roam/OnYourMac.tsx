import { Keycap } from "./keys"
import { MacDemoVideo, portraitDemo } from "./MacDemoVideo"
import { DownloadButton } from "./Shared"

// Phones and tablets can't hold ⌥Q, so they see the Mac app on film. The
// section is hidden where there's a mouse; desktops get the landscape cut in
// How it works instead.
export function OnYourMac() {
  return <section className="p-section p-mac" aria-labelledby="mac-title">
    <div className="p-section-head">
      <p className="p-eyebrow">On your Mac</p>
      <h2 id="mac-title">Hold <Keycap>⌥</Keycap><Keycap>Q</Keycap> anywhere on your Mac.</h2>
      <p>The wheel opens over whatever’s on screen, you flick to a station, and you’re straight back to what you were doing. It plays from Spotify or Apple Music.</p>
    </div>
    <MacDemoVideo clip={portraitDemo} media="(hover: none)" placement="on-your-mac" className="p-mac-video" />
    <DownloadButton />
  </section>
}
