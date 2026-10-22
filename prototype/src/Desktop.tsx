import { memo, type CSSProperties } from "react"
import { onAir, useNow } from "./broadcast"
import { RadioIcon, SpeakerIcon } from "./icons"
import { hueFor, initialsFor, type Playlist } from "./stations"

// A stand-in macOS desktop so the wheel is judged over real-looking clutter.

type Props = { playlist: Playlist | null; volume: number; wheelOpen: boolean; wallpaper: string | null }

export function Desktop({ playlist, volume, wheelOpen, wallpaper }: Props) {
  return (
    <div
      className="desktop"
      aria-hidden="true"
      data-wallpaper={wallpaper ? true : undefined}
      style={wallpaper ? ({ "--wallpaper": `url("${wallpaper}")` } as CSSProperties) : undefined}
    >
      <MenuBar wheelOpen={wheelOpen} />
      <Editor />
      <MiniPlayer playlist={playlist} volume={volume} />
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
  [["", "  "], ["k", "func"], ["f", " tuneIn"], ["", "(playlistID: "], ["t", "String"], ["", ", track: "], ["t", "Int"], ["", ", at: "], ["t", "Double"], ["", ") "], ["k", "async throws"], ["", " {"]],
  [["", "    "], ["k", "let"], ["", " script = "], ["s", '"""']],
  [["s", '    tell application "Music"']],
  [["s", '      play track \\(track) of (first playlist whose persistent ID is "\\(playlistID)")']],
  [["s", "      set player position to \\(at)"]],
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

function MiniPlayer({ playlist, volume }: Pick<Props, "playlist" | "volume">) {
  const now = useNow()
  const live = playlist ? onAir(playlist.tracks, now) : null
  const progress = live ? live.position / live.track.duration : 0

  return (
    <div className="mini-player">
      <div className="mini-art" style={{ "--hue": playlist ? hueFor(playlist.name) : 0 } as CSSProperties}>
        {playlist?.covers[0] ? <img src={playlist.covers[0]} alt="" /> : playlist ? initialsFor(playlist.name) : "—"}
      </div>
      <div className="mini-meta">
        <span className="mini-title">{live?.track.title ?? "Not playing"}</span>
        <span className="mini-artist">{live?.track.artist ?? "Hold Q to pick a station"}</span>
        <span className="mini-source">{playlist?.name ?? "Radio off"}</span>
      </div>
      <span className="mini-bar mini-progress" style={{ "--fill": progress } as CSSProperties}>
        <span />
      </span>
      <div className="mini-volume">
        <SpeakerIcon />
        <span className="mini-bar mini-volume-bar" style={{ "--fill": volume } as CSSProperties}>
          <span />
        </span>
      </div>
    </div>
  )
}
