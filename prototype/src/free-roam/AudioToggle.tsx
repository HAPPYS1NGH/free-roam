import type { useProductAudio } from "./useProductAudio"

export function AudioToggle({ audio }: { audio: ReturnType<typeof useProductAudio> }) {
  return <div className="audio-control">
    <button className="sound-toggle" aria-pressed={audio.enabled && !audio.error} disabled={audio.loading} onClick={audio.toggle}>
      {audio.loading ? "Loading sounds…" : audio.error ? "Retry sound effects" : audio.enabled ? "Sound effects on" : "Sound effects off"}
    </button>
    {audio.error && <p role="alert">Sound effects couldn't load. Tap retry to try again.</p>}
  </div>
}
