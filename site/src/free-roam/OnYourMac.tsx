import { Keycap } from "./keys"
import { MacDemoVideo } from "./MacDemoVideo"
import { DownloadButton } from "./Shared"

// Phones and tablets can't hold ⌥Q, so they see the Mac app on film. The
// section is hidden where there's a mouse; desktops get the same clip beside
// How it works instead.
export function OnYourMac() {
  return <section className="p-section p-mac" aria-labelledby="mac-title">
    <div className="p-section-head">
      <p className="p-eyebrow">On your Mac</p>
      <h2 id="mac-title">Hold <Keycap>⌥</Keycap><Keycap>Q</Keycap> in any app.</h2>
      <p>Your editor, your browser, a video. The wheel opens over whatever you’re doing, you flick to a station, and you never leave your work. It plays from Spotify or Apple Music.</p>
    </div>
    <MacDemoVideo media="(hover: none)" placement="on-your-mac" className="p-mac-video" />
    <DownloadButton />
  </section>
}
