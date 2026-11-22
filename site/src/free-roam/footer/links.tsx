import { downloadUrl, sourceUrl } from "../content"
import { Brand } from "../Shared"

export type FooterLink = { label: string; href: string; external: boolean; note?: string }

export type LinkSignal = (element: HTMLAnchorElement | null) => void

// Every link the footer offers, grouped. Each must stay a real <a>.
export const linkGroups: { title: string; links: FooterLink[] }[] = [
  {
    title: "Get it",
    links: [
      { label: "Download for Mac", href: downloadUrl, external: false, note: "macOS 14+" },
      { label: "Release notes", href: `${sourceUrl}/releases`, external: true },
    ],
  },
  {
    title: "Source",
    links: [
      { label: "GitHub", href: sourceUrl, external: true },
      { label: "Report an issue", href: `${sourceUrl}/issues`, external: true },
      { label: "MIT License", href: `${sourceUrl}/blob/main/LICENSE`, external: true },
    ],
  },
  {
    title: "This page",
    links: [
      { label: "Stations", href: "#stations", external: false },
      { label: "How it works", href: "#how-it-works", external: false },
      { label: "Questions", href: "#faq-title", external: false },
    ],
  },
  {
    title: "Follow",
    links: [
      { label: "X", href: "https://x.com/HAPPYS1NGH", external: true, note: "@HAPPYS1NGH" },
    ],
  },
]

// Brand, the reminder and the small print, on the footer's last line.
export function FooterBase() {
  return <div className="fx-base p-wrap">
    <Brand />
    <p className="p-footer-line">Hold ⌥Q anywhere.</p>
    <p className="fx-small">Free and open source · macOS 14 or later</p>
  </div>
}
