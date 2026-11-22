import { useEffect, useState, type MouseEvent, type ReactNode } from "react"
import { useMounted } from "../useMounted"
import { sectionName, track } from "./analytics"
import { downloadUrl, releaseUrl } from "./content"

// iPads report a Macintosh user agent, so touch points tell them apart.
const onMacDesktop = () => /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints === 0

type Props = { className?: string; children: ReactNode; elsewhere: ReactNode }

// On a Mac this downloads the DMG. Anywhere else a DMG is a dead end, so it
// hands the page to the share sheet (AirDrop, Messages) or copies the link.
// The prerender is the Mac version; the label switches once the page hydrates.
export function DownloadLink({ className, children, elsewhere }: Props) {
  const mounted = useMounted()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])
  if (!mounted || onMacDesktop()) return <a className={className} href={downloadUrl}>{children}</a>

  const send = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const placement = sectionName(event.currentTarget.closest("header, footer, section, aside"))
    const url = `${location.origin}/`
    if (navigator.share) {
      try {
        await navigator.share({ title: "Free Roam", text: "A radio for your Mac. Download it there.", url })
        track("download_link_sent", { method: "share", placement })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.warn("Sharing failed, copying the link instead.", error)
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      track("download_link_sent", { method: "copy", placement })
    } catch (error) {
      console.warn("Couldn't copy the link, opening the release page.", error)
      location.href = releaseUrl
    }
  }
  return <a className={className} href={releaseUrl} onClick={send}>
    <span className="p-download-label" aria-live="polite">{copied ? "Link copied" : elsewhere}</span>
  </a>
}
