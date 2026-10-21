import { memo, type CSSProperties } from "react"
import { RadioIcon, SpeakerIcon } from "./icons"
import { callSignFor, frequencyFor, hueFor, stations, trackAt } from "./stations"

// A stand-in macOS desktop so the wheel is judged over real-looking clutter.

type Props = { playingId: string | null; trackIndex: number; volume: number; wheelOpen: boolean }

export function Desktop({ playingId, trackIndex, volume, wheelOpen }: Props) {
  return (
    <div className="desktop" aria-hidden="true">
      <MenuBar wheelOpen={wheelOpen} />
      <Editor />
      <MiniPlayer playingId={playingId} trackIndex={trackIndex} volume={volume} />
    </div>
  )
}

function MenuBar({ wheelOpen }: { wheelOpen: boolean }) {
  return (
    <div className="menubar">
      <div className="menubar-group">
        <strong>Code</strong>
        <span>File</span>
        <span>Edit</span>
        <span>Selection</span>
        <span>View</span>
        <span>Window</span>
        <span>Help</span>
      </div>
      <div className="menubar-group">
        <span className="menubar-static" data-active={wheelOpen || undefined}>
          <RadioIcon />
        </span>
        <span>100%</span>
        <span>Wed 22 Oct 9:41</span>
      </div>
    </div>
  )
}

const code: [string, string][][] = [
  [["k", "import"], ["", " Foundation"]],
  [],
  [["k", "struct"], ["t", " MusicBridge"], ["", " {"]],
  [["", "  "], ["k", "func"], ["f", " play"], ["", "(playlistID: "], ["t", "String"], ["", ") "], ["k", "async throws"], ["", " {"]],
  [["", "    "], ["k", "let"], ["", " script = "], ["s", '"""']],
  [["s", '    tell application "Music"']],
  [["s", '      play (first playlist whose persistent ID is "\\(playlistID)")']],
  [["s", "    end tell"]],
  [["s", '    """']],
  [["", "    "], ["k", "try await"], ["f", " run"], ["", "(script)"]],
  [["", "  }"]],
  [["", "}"]],
]

const Editor = memo(function Editor() {
  return (
    <div className="editor">
      <div className="window-titlebar">
        <span className="traffic">
          <span />
          <span />
          <span />
        </span>
        MusicBridge.swift — static
      </div>
      <pre>
        {code.map((tokens, line) => (
          <div className="code-line" key={line}>
            <span className="code-line-number">{line + 1}</span>
            <span>
              {tokens.map(([kind, text], i) => (
                <span key={i} className={kind ? `tok-${kind}` : undefined}>
                  {text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </pre>
    </div>
  )
})

function MiniPlayer({ playingId, trackIndex, volume }: Omit<Props, "wheelOpen">) {
  const station = stations.find((s) => s.id === playingId)
  const playlist = station?.kind === "playlist" ? station : null
  const track = playlist ? trackAt(playlist.tracks, trackIndex) : null

  return (
    <div className="mini-player">
      <div className="mini-art" style={{ "--hue": playlist ? hueFor(playlist.name) : 0 } as CSSProperties}>
        {playlist ? callSignFor(playlist.name) : "—"}
      </div>
      <div className="mini-meta">
        <span className="mini-title">{track?.title ?? "Not playing"}</span>
        <span className="mini-artist">{track?.artist ?? "Hold Q to pick a station"}</span>
        <span className="mini-source">{playlist ? `${playlist.name} · ${frequencyFor(playlist.name)} FM` : "Music"}</span>
      </div>
      <div className="mini-volume" style={{ "--volume": volume } as CSSProperties}>
        <SpeakerIcon />
        <span className="mini-volume-track">
          <span className="mini-volume-fill" />
        </span>
      </div>
    </div>
  )
}
