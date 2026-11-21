// The YouTube IFrame Player API, loaded only once a visitor starts choosing a
// station: the script sets YouTube cookies the moment it loads, so nothing
// from YouTube may be requested before then. The API itself only exists on
// www.youtube.com (youtube-nocookie.com/iframe_api is a 404); the player it
// builds is pointed at the nocookie host instead.

export type YouTubePlayer = {
  loadVideoById(options: { videoId: string; startSeconds?: number }): void
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getPlayerState(): number
  getDuration(): number
  // Undocumented but long-standing: the video the player is actually on.
  getVideoData?(): { video_id?: string } | undefined
  mute(): void
  unMute(): void
  setVolume(volume: number): void
  getIframe(): HTMLIFrameElement
  destroy(): void
}

type PlayerOptions = {
  width?: number | string
  height?: number | string
  host?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: () => void
    onStateChange?: (event: { data: number }) => void
    onError?: (event: { data: number }) => void
  }
}

export type YouTubeApi = {
  Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer
  PlayerState: { UNSTARTED: -1; ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 }
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let loading: Promise<YouTubeApi> | null = null

export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
      else reject(new Error("YouTube API loaded without YT"))
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error("Couldn't reach YouTube"))
    }
    document.head.append(script)
  })
  return loading
}
