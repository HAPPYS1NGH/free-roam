import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
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
// Share of the clip that must be on screen for it to play (and start loading).
const VISIBLE_RATIO = 0.4

export function MacDemoVideo({ clip, media, placement, className }: { clip: Clip; media: string; placement: string; className: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const reducedMotion = useReducedMotion() ?? false
  // Reduced motion, or a browser that refuses autoplay, gets the poster and the
  // player's own controls instead.
  const [blocked, setBlocked] = useState(false)
  const [poster, setPoster] = useState<string>()
  const played = useRef(false)
  const manual = reducedMotion || blocked

  useEffect(() => {
    const element = video.current
    if (!element || !matchMedia(media).matches) return
    setPoster(clip.poster)
    if (manual) {
      element.pause()
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < VISIBLE_RATIO) return element.pause()
      element.play().catch((error: Error) => {
        console.warn("The Mac demo didn't autoplay:", error)
        setBlocked(true)
      })
    }, { threshold: [0, VISIBLE_RATIO] })
    observer.observe(element)
    return () => observer.disconnect()
  }, [clip.poster, media, manual])

  // Counted on the first real play, so plays from the controls count too.
  const onPlay = () => {
    if (played.current) return
    played.current = true
    track("mac_demo_played", { placement })
  }

  return <video ref={video} className={className} src={clip.src} poster={poster}
    width={clip.width} height={clip.height} muted loop playsInline preload="none" controls={manual} onPlay={onPlay}
    aria-label="Free Roam on a Mac: holding ⌥Q opens the radio wheel over a code editor, a browser, a design tool and a video" />
}
