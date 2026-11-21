import type { ReactNode } from "react"
import { downloadUrl } from "./content"
import { useRadio } from "./RadioProvider"

export function Brand() {
  return <a className="p-brand" href="#top" aria-label="Free Roam home">
    <img src="/free-roam/badge.png" alt="" width="240" height="240" />
    <span>Free Roam</span>
  </a>
}

export function OnAirTally() {
  const { playing } = useRadio()
  return <p className="p-tally" role="status" data-live={playing ? "" : undefined}>
    <span className="p-tally-light" aria-hidden="true" />
    {playing ? <><span className="p-tally-label">On air</span> <strong>{playing.playlist.name}</strong></> : <span className="p-tally-label">Radio off</span>}
  </p>
}

export function DownloadButton({ size = "lg", children = "Download for Mac" }: { size?: "sm" | "md" | "lg"; children?: ReactNode }) {
  return <a className={`p-button p-button-${size}`} href={downloadUrl}>
    <svg className="p-apple" viewBox="0 0 814 1000" aria-hidden="true"><path fill="currentColor" d="M788 341c-6 4-108 62-108 190 0 149 130 201 134 203-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-164-40c-77 0-104 41-167 41s-106-57-156-127C44 791 0 671 0 557c0-184 119-281 237-281 62 0 114 41 153 41 37 0 95-43 166-43 27 0 124 2 188 94zM554 158c29-35 50-83 50-131 0-7-1-13-2-19-47 2-103 32-137 71-27 30-52 78-52 127 0 7 1 15 2 17 3 1 8 1 13 1 42 0 95-28 126-66z" /></svg>
    {children}
  </a>
}

export function SoundToggle() {
  const { audio } = useRadio()
  return <button className="p-sound" aria-pressed={audio.enabled && !audio.error} disabled={audio.loading} onClick={audio.toggle}>
    {audio.loading ? "Loading sounds…" : audio.error ? "Retry sound" : audio.enabled ? "Sound on" : "Sound off"}
  </button>
}
