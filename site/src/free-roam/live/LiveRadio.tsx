import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { onAir, useNow } from "../../broadcast"
import type { Slot, Track } from "../../stations"
import { loadYouTubeApi, type YouTubePlayer } from "./youtube-api"
import embeddable from "./videos.json"

// The stations, audible: once a visitor tunes in (lets go of ⌥Q, taps ⌥Q, or
// picks a station), the station on air plays through a YouTube player nobody
// sees, mid-song, from the same broadcast clock as the rest of the page. Like
// the Mac app with Music, there is no player to look at, only the radio.
//
// Only songs proto/hero/youtube/embed-check.mjs proved playable in the embed have a video. When
// the clock lands on a song without one (or one that errors), the next song
// with a video fills in from its start, then the station rejoins the clock.
// The caption names whatever you're actually hearing.

export type LiveTrack = Track & { videoId: string; ytDuration: number }
// What's playing, the wall-clock second its position 0 fell on, and whether
// YouTube is playing an ad in front of it instead.
export type Hearing = { track: LiveTrack; startedAt: number; ad: boolean }
export type LiveAudio =
  | { kind: "idle" } // not tuned in yet, or Radio Off
  | { kind: "connecting" }
  | { kind: "hearing"; hearing: Hearing }
  | { kind: "silent" } // the station has no song YouTube will play
  | { kind: "blocked" } // the browser held the sound back; the next click or key starts it
  | { kind: "failed" }

const videosByStation = embeddable as Record<string, ({ videoId: string; ytDuration: number } | null)[]>

// The station's playlist with each song's video, or null where there's none.
function lineup(stationId: string, tracks: Track[], blocked: ReadonlySet<string>): (LiveTrack | null)[] {
  const videos = videosByStation[stationId] ?? []
  return tracks.map((track, index) => {
    const video = videos[index]
    return video && !blocked.has(video.videoId) ? { ...track, ...video } : null
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

// Pressing on these starts loading YouTube; letting go on them tunes in.
const PRIME_TARGETS = ".p-dial-row, .wheel-layer, .ta-try"
const TUNE_TARGETS = ".p-dial-row, .wheel-layer-face button, .wheel-pick"
const PLAYING = 1
const BUFFERING = 3
// Off the clock by more than this and the player seeks back to it, at most
// once per SEEK_GAP_MS so a slow connection doesn't seek on every tick. Seeks
// aim a little ahead, since the player rebuffers before it moves again.
const DRIFT_S = 1
const SEEK_LEAD_S = 0.5
const SEEK_GAP_MS = 4000
// "Playing" this long without the song's time moving: something else (an ad)
// has the player.
const STALL_MS = 2500
const BLOCKED_AFTER_MS = 3500

const isAltQ = (event: KeyboardEvent) => event.code === "KeyQ" && event.altKey && !event.metaKey && !event.ctrlKey
const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
const closest = (target: EventTarget | null, selector: string) => target instanceof Element && !!target.closest(selector)

type Loaded = { stationId: string; track: LiveTrack; override: boolean; startedAt: number }

type Props = {
  // The station on air, or undefined for Radio Off.
  playing: Extract<Slot, { kind: "playlist" }> | undefined
  // The page's sound toggle mutes the music along with the wheel's sounds.
  muted: boolean
  onChange: (audio: LiveAudio) => void
}

export function LiveRadio({ playing, muted, onChange }: Props) {
  const now = useNow()
  const mount = useRef<HTMLDivElement>(null)
  const player = useRef<YouTubePlayer | null>(null)
  const priming = useRef(false)
  const loaded = useRef<Loaded | null>(null)
  // The song last used to fill a gap, so a long gap doesn't replay it.
  const lastFill = useRef<string | null>(null)
  const lastSeek = useRef(0)
  const progress = useRef({ time: -1, since: 0 })
  const blockedTimer = useRef(0)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [tunedIn, setTunedIn] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)
  const [ad, setAd] = useState(false)
  // Songs that errored at runtime this visit; skipped from then on.
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(() => new Set())
  const [hearing, setHearing] = useState<Loaded | null>(null)

  const songs = playing ? lineup(playing.id, playing.playlist.tracks, blocked) : []
  const hasVideos = songs.some(Boolean)
  // Player events and window listeners are bound once, so they read the latest render through this.
  const latest = useRef({ playing, blocked, needsGesture, muted })
  latest.current = { playing, blocked, needsGesture, muted }

  const prime = () => {
    if (priming.current) return
    priming.current = true
    setFailed(false)
    loadYouTubeApi().then(YT => {
      if (!mount.current) return
      // YouTube swaps this element for its iframe, so React never owns it.
      const host = document.createElement("div")
      mount.current.append(host)
      const created: YouTubePlayer = new YT.Player(host, {
        width: 200,
        height: 200,
        host: "https://www.youtube-nocookie.com",
        playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, origin: location.origin },
        events: {
          onReady: () => {
            const iframe = created.getIframe()
            iframe.tabIndex = -1
            iframe.setAttribute("aria-hidden", "true")
            iframe.title = "Radio audio"
            created.setVolume(100)
            if (latest.current.muted) created.mute()
            player.current = created
            setReady(true)
          },
          onStateChange: ({ data }) => {
            if (data === PLAYING) setNeedsGesture(false)
            if (data === PLAYING) keepOnClock(created)
            // A skipped-to song finished: hand back to the clock on the next tick.
            if (data === YT.PlayerState.ENDED && loaded.current?.override) loaded.current = null
          },
          onError: ({ data }) => {
            console.warn(`YouTube couldn't play ${loaded.current?.track.videoId} (error ${data}); skipping`)
            skipRef.current()
          },
        },
      })
    }, error => {
      console.warn(error)
      priming.current = false
      setFailed(true)
    })
  }

  // Tuning in, priming and unblocking all ride on real input, so the browser
  // counts the first play as the visitor's own (keyup and click are user
  // activation; the API starts loading on the keydown or press before them).
  useEffect(() => {
    let altQHeld = false
    const resume = () => {
      if (!latest.current.needsGesture) return
      player.current?.playVideo()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextField(event.target)) return
      if (isAltQ(event)) { altQHeld = true; prime() }
      resume()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "KeyQ" || !altQHeld) return
      altQHeld = false
      setTunedIn(true)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (closest(event.target, PRIME_TARGETS)) prime()
      resume()
    }
    const onClick = (event: MouseEvent) => {
      if (!closest(event.target, TUNE_TARGETS)) return
      prime()
      setTunedIn(true)
    }
    const onBlur = () => { altQHeld = false }
    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("keyup", onKeyUp, true)
    window.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("click", onClick, true)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("keyup", onKeyUp, true)
      window.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("click", onClick, true)
      window.removeEventListener("blur", onBlur)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    window.clearTimeout(blockedTimer.current)
    player.current?.destroy()
    player.current = null
  }, [])

  const load = (stationId: string, track: LiveTrack, position: number, override: boolean) => {
    const yt = player.current
    if (!yt) return
    const next = { stationId, track, override, startedAt: Date.now() / 1000 - position }
    yt.loadVideoById({ videoId: track.videoId, startSeconds: position })
    loaded.current = next
    lastSeek.current = 0
    progress.current = { time: -1, since: performance.now() }
    setAd(false)
    setHearing(next)
    // Safari (and Chrome without prior interaction) can hold unmuted sound
    // back. Nothing pops up: the caption asks for a click and the next click
    // or key starts it.
    window.clearTimeout(blockedTimer.current)
    blockedTimer.current = window.setTimeout(() => {
      const state = player.current?.getPlayerState()
      if (loaded.current === next && state !== PLAYING && state !== BUFFERING) setNeedsGesture(true)
    }, BLOCKED_AFTER_MS)
  }

  const stop = (how: "pause" | "stop") => {
    const yt = player.current
    if (!yt || !loaded.current) return
    if (how === "pause") yt.pauseVideo()
    else yt.stopVideo()
    loaded.current = null
    window.clearTimeout(blockedTimer.current)
    setNeedsGesture(false)
    setAd(false)
    setHearing(null)
  }

  // The embed API can't say "this is an ad", so it's inferred: the player is
  // on a different video, reports a duration that isn't the song's, or says
  // it's playing while the song's time stands still. Once the song itself
  // moves again, it's put back on the clock.
  const keepOnClock = (yt: YouTubePlayer) => {
    const current = loaded.current
    if (!current || yt.getPlayerState() !== PLAYING) return
    const time = yt.getCurrentTime()
    const at = performance.now()
    if (Math.abs(time - progress.current.time) > 0.05) progress.current = { time, since: at }
    const onVideo = yt.getVideoData?.()?.video_id
    const duration = yt.getDuration()
    const isAd = (!!onVideo && onVideo !== current.track.videoId)
      || (duration > 0 && Math.abs(duration - current.track.ytDuration) > 5)
      || at - progress.current.since > STALL_MS
    setAd(isAd)
    if (isAd) return
    const want = Date.now() / 1000 - current.startedAt
    if (Math.abs(time - want) > DRIFT_S && at - lastSeek.current > SEEK_GAP_MS) {
      lastSeek.current = at
      yt.seekTo(want + SEEK_LEAD_S, true)
    }
  }

  // A song that won't play is skipped for the rest of the visit: the next one
  // with a video plays from the top, then the station rejoins its clock.
  const skip = () => {
    const failing = loaded.current
    const station = latest.current.playing
    if (!failing || !station || failing.stationId !== station.id) return
    const at = lineup(station.id, station.playlist.tracks, new Set()).findIndex(song => song?.videoId === failing.track.videoId)
    const nextBlocked = new Set(latest.current.blocked).add(failing.track.videoId)
    setBlocked(nextBlocked)
    const next = nextAfter(lineup(station.id, station.playlist.tracks, nextBlocked), at)
    if (next) load(station.id, next, 0, true)
    else stop("stop")
  }
  const skipRef = useRef(skip)
  skipRef.current = skip

  // Follow the clock: once a second, make sure the player has the song that's
  // on air, and that it's where the clock says.
  useEffect(() => {
    const yt = player.current
    if (!ready || !yt || !tunedIn) return
    if (!playing) { stop("pause"); return }
    if (!hasVideos) { stop("stop"); return }
    const current = loaded.current
    if (current?.override && current.stationId === playing.id) { keepOnClock(yt); return }
    const live = onAir(playing.playlist.tracks, now)
    if (!live) return
    const song = songs[live.index]
    if (song) {
      if (current && current.stationId === playing.id && current.track.videoId === song.videoId) { keepOnClock(yt); return }
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
  }, [ready, tunedIn, playing?.id, blocked, now]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return
    if (muted) player.current?.mute()
    else player.current?.unMute()
  }, [ready, muted])

  const state: LiveAudio = !tunedIn || !playing ? { kind: "idle" }
    : failed ? { kind: "failed" }
    : !hasVideos ? { kind: "silent" }
    : !ready || !hearing ? { kind: "connecting" }
    : needsGesture ? { kind: "blocked" }
    : { kind: "hearing", hearing: { track: hearing.track, startedAt: hearing.startedAt, ad } }
  const key = JSON.stringify(state)
  useEffect(() => onChange(state), [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // The portal needs document.body, which the prerender doesn't have.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  // Rendered and on screen, so browsers keep it playing, but fully transparent,
  // click-through and out of the accessibility tree.
  return createPortal(<div ref={mount} aria-hidden="true" data-radio-player={hearing?.track.videoId ?? ""}
    style={{ position: "fixed", left: 0, bottom: 0, width: 200, height: 200, opacity: 0, pointerEvents: "none", zIndex: -1, overflow: "hidden" }} />,
  document.body)
}
