import { useEffect, useRef, useState } from "react"
import type { Track } from "../../../src/stations"
import { demoSlots, frequency, onAir, useNow, useRadio } from "../radio"
import { loadYouTubeApi, type YouTubePlayer } from "./api"
import embeddable from "./stations.json"
import "./LiveRadio.css"

// Opt-in live audio for the hero: the station on air plays through YouTube's
// embed player, mid-song, from the same broadcast clock as the rest of the page.
//
// Only songs embed-check.mjs proved playable in the embed have a video. When
// the clock lands on a song without one (or one that errors), the next song
// with a video fills in from its start, then the station rejoins the clock.
// The caption names whatever you're actually hearing.

export type LiveTrack = Track & { videoId: string }
// What's playing and the wall-clock second its position 0 fell on.
export type Hearing = { track: LiveTrack; startedAt: number }

const videosByStation = embeddable as Record<string, ({ videoId: string } | null)[]>

// The station's playlist with each song's video, or null where there's none.
export function lineup(stationId: string, tracks: Track[], blocked: ReadonlySet<string> = new Set()): (LiveTrack | null)[] {
  const videos = videosByStation[stationId] ?? []
  return tracks.map((track, index) => {
    const video = videos[index]
    return video && !blocked.has(video.videoId) ? { ...track, videoId: video.videoId } : null
  })
}

// The first song with a video after `index`, wrapping round the playlist.
function nextAfter(songs: (LiveTrack | null)[], index: number) {
  for (let step = 1; step <= songs.length; step++) {
    const song = songs[(index + step) % songs.length]
    if (song) return song
  }
  return null
}

// Offered when the station on air has nothing YouTube will play.
const firstLiveStation = demoSlots.flatMap((slot, index) =>
  slot.kind === "playlist" && lineup(slot.id, slot.playlist.tracks).some(Boolean) ? [{ index, name: slot.playlist.name }] : [])[0]

// startedAt: the wall-clock second this song's position 0 fell on, so the
// player can be put back on the clock once it actually starts.
type Loaded = { stationId: string; videoId: string; override: boolean; startedAt: number; synced: boolean }

export function LiveRadio({ onClose, onHearing }: { onClose: () => void; onHearing: (hearing: Hearing | null) => void }) {
  const { wheel, playing, playingIndex } = useRadio()
  const now = useNow()
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YouTubePlayer | null>(null)
  const loaded = useRef<Loaded | null>(null)
  const tapTimer = useRef(0)
  // The song last used to fill a gap, so a long gap doesn't replay it.
  const lastFill = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  // Songs that errored at runtime this visit; skipped from then on.
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(() => new Set())
  const [hearing, setHearing] = useState<Hearing | null>(null)

  const songs = playing ? lineup(playing.id, playing.playlist.tracks, blocked) : []
  const hasVideos = songs.some(Boolean)
  // Player events are bound once, so they read the latest render through this.
  const latest = useRef({ playing, blocked })
  latest.current = { playing, blocked }

  const hear = (next: Hearing | null) => { setHearing(next); onHearing(next) }

  const load = (stationId: string, track: LiveTrack, position: number, override: boolean) => {
    const yt = player.current
    if (!yt) return
    const startedAt = Date.now() / 1000 - position
    yt.loadVideoById({ videoId: track.videoId, startSeconds: position })
    loaded.current = { stationId, videoId: track.videoId, override, startedAt, synced: false }
    hear({ track, startedAt })
    // Safari can refuse to start sound outside the original click; YouTube's
    // own play button always works, so point at it.
    window.clearTimeout(tapTimer.current)
    setNeedsTap(false)
    tapTimer.current = window.setTimeout(() => {
      const state = player.current?.getPlayerState()
      if (loaded.current?.videoId === track.videoId && state !== 1 && state !== 3) setNeedsTap(true)
    }, 4000)
  }

  // A song that won't play is skipped for the rest of the visit: the next one
  // with a video plays from the top, then the station rejoins its clock.
  const skip = () => {
    const failing = loaded.current
    const station = latest.current.playing
    if (!failing || !station || failing.stationId !== station.id) return
    const at = lineup(station.id, station.playlist.tracks).findIndex(song => song?.videoId === failing.videoId)
    const nextBlocked = new Set(latest.current.blocked).add(failing.videoId)
    setBlocked(nextBlocked)
    const next = nextAfter(lineup(station.id, station.playlist.tracks, nextBlocked), at)
    if (next) load(station.id, next, 0, true)
    else { loaded.current = null; hear(null) }
  }
  const skipRef = useRef(skip)
  skipRef.current = skip

  useEffect(() => {
    let live = true
    let created: YouTubePlayer | null = null
    loadYouTubeApi().then(YT => {
      if (!live || !host.current) return
      created = new YT.Player(host.current, {
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: { playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => { if (live) { player.current = created; setReady(true) } },
          onStateChange: ({ data }) => {
            if (data === YT.PlayerState.PLAYING) {
              setNeedsTap(false)
              // Loading takes a moment and the broadcast doesn't wait: the first
              // time a song starts, jump to where the clock has got to.
              const current = loaded.current
              if (current && !current.synced && created) {
                current.synced = true
                const clock = Date.now() / 1000 - current.startedAt
                if (Math.abs(created.getCurrentTime() - clock) > 1.5) created.seekTo(clock, true)
              }
            }
            // A skipped-to song finished: hand back to the clock on the next tick.
            if (data === YT.PlayerState.ENDED && loaded.current?.override) loaded.current = null
          },
          onError: ({ data }) => {
            console.warn(`YouTube couldn't play ${loaded.current?.videoId} (error ${data}); skipping`)
            skipRef.current()
          },
        },
      })
    }, error => {
      console.warn(error)
      if (live) setFailed(true)
    })
    return () => {
      live = false
      window.clearTimeout(tapTimer.current)
      created?.destroy()
      player.current = null
      onHearing(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the clock: once a second, make sure the player has the song that's
  // on air. The wheel overlay would cover the player, so it pauses and hides
  // while the wheel is open and rejoins the broadcast when it closes.
  useEffect(() => {
    const yt = player.current
    if (!ready || !yt) return
    if (wheel.open || !playing || !hasVideos) {
      if (loaded.current) {
        if (playing && !hasVideos) yt.stopVideo()
        else yt.pauseVideo()
        loaded.current = null
        window.clearTimeout(tapTimer.current)
        setNeedsTap(false)
      }
      if (!wheel.open && hearing) hear(null)
      return
    }
    const current = loaded.current
    if (current?.override && current.stationId === playing.id) return
    const live = onAir(playing.playlist.tracks, now)
    if (!live) return
    const song = songs[live.index]
    if (song) {
      if (current && current.stationId === playing.id && current.videoId === song.videoId) return
      lastFill.current = null
      load(playing.id, song, live.position, false)
    } else {
      // No video for the song on air: fill with the next one, from the top.
      let next = nextAfter(songs, live.index)
      if (next && next.videoId === lastFill.current) next = nextAfter(songs, songs.indexOf(next))
      if (!next) return
      lastFill.current = next.videoId
      load(playing.id, next, 0, true)
    }
  }, [ready, wheel.open, playing?.id, blocked, now]) // eslint-disable-line react-hooks/exhaustive-deps

  const status = failed ? "Couldn’t reach YouTube."
    : !ready ? "Connecting to YouTube…"
    : !playing ? "Radio off. Pick a station to listen."
    : !hasVideos ? null
    : needsTap ? "Press play on the video to start."
    : hearing ? `${hearing.track.title} — ${hearing.track.artist}`
    : "Tuning…"

  return <aside className="ll" data-hidden={wheel.open ? "" : undefined} aria-label="Live radio, played by YouTube"
    data-video-id={hearing?.track.videoId}>
    <header className="ll-head">
      <span className="ll-live" data-on={hearing && !wheel.open ? "" : undefined}>Live</span>
      <span className="ll-station">{playing ? <>{frequency(playingIndex)} <strong>{playing.playlist.name}</strong></> : "Radio off"}</span>
      <button type="button" className="ll-close" onClick={onClose} aria-label="Stop live audio">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" /></svg>
      </button>
    </header>
    <div className="ll-screen"><div ref={host} /></div>
    <p className="ll-foot" role="status">
      {status ? <span className="ll-text">{status}</span> : <><span className="ll-text">No live audio for this station.</span>{firstLiveStation && <button type="button" className="ll-tune" onClick={() => wheel.choose(firstLiveStation.index)}>
        Tune to {firstLiveStation.name}
      </button>}</>}
    </p>
  </aside>
}
