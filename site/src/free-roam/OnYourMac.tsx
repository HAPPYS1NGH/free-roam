import { useEffect, useRef, useState } from "react"
import { track } from "./analytics"
import { Keycap } from "./keys"
import { DownloadButton } from "./Shared"

// Phones and tablets can't hold ⌥Q, so they see the Mac app on film: the wheel
// over an editor, a browser, a design tool and a video (the "anywhere" Short
// from free-roam-video, re-encoded at 720p without sound). The section is
// hidden where there's a mouse, and the clip loads only once it scrolls into view.
export function OnYourMac() {
  const video = useRef<HTMLVideoElement>(null)
  // Reduced motion gets the poster and the player's own controls instead of autoplay.
  const [manual, setManual] = useState(false)
  // Set after mount, and only for touch, so desktops never download the poster.
  const [poster, setPoster] = useState<string>()

  useEffect(() => {
    const element = video.current
    if (!element || !matchMedia("(hover: none)").matches) return
    setPoster("/free-roam/demo/anywhere.jpg")
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setManual(true)
      return
    }
    let played = false
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return element.pause()
      element.play().then(() => {
        if (played) return
        played = true
        track("mac_demo_played")
      }, (error: Error) => console.warn("The Mac demo didn't autoplay:", error))
    }, { threshold: 0.4 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <section className="p-section p-mac" aria-labelledby="mac-title">
    <div className="p-section-head">
      <p className="p-eyebrow">On your Mac</p>
      <h2 id="mac-title">Hold <Keycap>⌥</Keycap><Keycap>Q</Keycap> in any app.</h2>
      <p>Your editor, your browser, a video. The wheel opens over whatever you’re doing, you flick to a station, and you never leave your work.</p>
    </div>
    <video ref={video} className="p-mac-video" src="/free-roam/demo/anywhere.mp4" poster={poster}
      width={720} height={1280} muted loop playsInline preload="none" controls={manual}
      aria-label="Free Roam on a Mac: holding ⌥Q opens the radio wheel over a code editor, a browser, a design tool and a video" />
    <DownloadButton />
  </section>
}
