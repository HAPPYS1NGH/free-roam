import { useEffect, useRef, useState } from "react"
import { track } from "./analytics"

// The Mac app on film: the wheel over an editor, a browser, a design tool and
// a video (the "anywhere" film from free-roam-video, re-encoded without sound).
// Phones get the portrait cut, desktops the landscape one.
export const portraitDemo = { src: "/free-roam/demo/anywhere.mp4", poster: "/free-roam/demo/anywhere.jpg", width: 720, height: 1280 }
export const landscapeDemo = { src: "/free-roam/demo/anywhere-wide.mp4", poster: "/free-roam/demo/anywhere-wide.jpg", width: 1600, height: 900 }

type Clip = typeof portraitDemo

// Each placement is shown by CSS for one kind of device, so `media` must match
// that CSS: the clip and its poster load only where it's shown, and play only
// while it's in view.
export function MacDemoVideo({ clip, media, placement, className }: { clip: Clip; media: string; placement: string; className: string }) {
  const video = useRef<HTMLVideoElement>(null)
  // Reduced motion gets the poster and the player's own controls instead of autoplay.
  const [manual, setManual] = useState(false)
  const [poster, setPoster] = useState<string>()

  useEffect(() => {
    const element = video.current
    if (!element || !matchMedia(media).matches) return
    setPoster(clip.poster)
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
        track("mac_demo_played", { placement })
      }, (error: Error) => console.warn("The Mac demo didn't autoplay:", error))
    }, { threshold: 0.4 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [clip.poster, media, placement])

  return <video ref={video} className={className} src={clip.src} poster={poster}
    width={clip.width} height={clip.height} muted loop playsInline preload="none" controls={manual}
    aria-label="Free Roam on a Mac: holding ⌥Q opens the radio wheel over a code editor, a browser, a design tool and a video" />
}
