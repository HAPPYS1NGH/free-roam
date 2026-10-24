import tokens from "../../tokens.json"
import { useWheel } from "../useWheel"
import { useViewport } from "../useViewport"
import { demoSlots } from "./demo-stations"
import { WheelFace } from "./WheelFace"
import { useProductAudio } from "./useProductAudio"
import { AudioToggle } from "./AudioToggle"

export function RadioDemo() {
  const audio = useProductAudio()
  const wheel = useWheel({
    slots: demoSlots,
    deadzone: tokens.behaviour.deadzone * useViewport().height / 100,
    pickRadius: tokens.behaviour.pickRadius,
    scrollStep: tokens.behaviour.scrollStep,
    dwellMs: tokens.behaviour.dwellMs,
    holdDelayMs: tokens.behaviour.holdDelayMs,
    keepOpen: false,
    sounds: audio.sounds,
  })
  const selected = Math.max(0, demoSlots.findIndex(slot => slot.id === (wheel.playingId ?? "off")))

  return <section className="radio-demo" id="radio-demo" aria-label="Interactive radio preview"
    onKeyDown={event => {
      if (wheel.open || !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) return
      event.preventDefault()
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1
      wheel.choose((selected + direction + demoSlots.length) % demoSlots.length)
    }}>
    <div className="demo-topline"><span className="eyebrow">Your music. Your stations.</span><a className="text-action" href="/">Open demo ↗</a></div>
    <WheelFace highlighted={wheel.open ? wheel.highlighted : selected} onChoose={wheel.choose} />
    <p className="demo-instruction">Hold <kbd>Q</kbd> and move or scroll. Let go to choose.</p>
    <div className="demo-options"><button className="inline-off" onClick={() => wheel.choose(0)}>Radio Off</button><AudioToggle audio={audio} /></div>
    <p className="demo-disclaimer">Popular music selections · sound effects from Static</p>
  </section>
}
