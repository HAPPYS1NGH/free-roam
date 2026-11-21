// The prototype's hookup for the landing page's hidden YouTube player, which
// lives in src/free-roam/live/.
import { LiveRadio as Player, type LiveAudio } from "../../../src/free-roam/live/LiveRadio"
import { useRadio } from "../radio"

export type { LiveAudio }

export function LiveRadio({ onChange }: { onChange: (audio: LiveAudio) => void }) {
  const { playing, audio } = useRadio()
  return <Player playing={playing} muted={!audio.enabled} onChange={onChange} />
}
