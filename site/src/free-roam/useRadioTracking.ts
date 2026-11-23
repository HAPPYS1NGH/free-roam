import { useEffect, useRef } from "react"
import type { useWheel } from "../useWheel"
import { track } from "./analytics"
import { demoSlots } from "./demo-stations"
import type { useProductAudio } from "./useProductAudio"

type Wheel = ReturnType<typeof useWheel>
// What opened the wheel: the touch button, a press and hold on touch, or ⌥Q.
type OpenMethod = "button" | "hold" | "keyboard"
export type TrackedWheel = Omit<Wheel, "show"> & { show: (method?: Exclude<OpenMethod, "keyboard">) => void }

// Reports how visitors use the demo radio: what opened the wheel (the touch
// button, a touch hold or ⌥Q), which station they tuned and how they picked it, and the sound
// toggle. Returns the wheel with show and choose wrapped so the page's own
// controls can be told apart from the wheel and the shortcut.
export function useRadioTracking(wheel: Wheel, audio: ReturnType<typeof useProductAudio>): TrackedWheel {
  const openedBy = useRef<OpenMethod>("keyboard")
  const chosenBy = useRef<"list" | null>(null)
  const wasOpen = useRef(wheel.open)
  const last = useRef({ playingId: wheel.playingId, sound: audio.enabled })

  useEffect(() => {
    if (wheel.playingId === last.current.playingId) return
    last.current.playingId = wheel.playingId
    const slot = demoSlots.find(candidate => candidate.id === wheel.playingId)
    track("station_tuned", {
      station: slot?.kind === "playlist" ? slot.playlist.name : "Radio Off",
      // A pick made as the wheel closes lands after open turns false, hence wasOpen.
      picker: chosenBy.current ?? (wheel.open || wasOpen.current ? "wheel" : "tap"),
    })
    chosenBy.current = null
  }, [wheel.playingId])

  // Declared after the station effect so that effect still sees the previous open state.
  useEffect(() => {
    wasOpen.current = wheel.open
    if (!wheel.open) return
    track("wheel_opened", { method: openedBy.current })
    openedBy.current = "keyboard"
  }, [wheel.open])

  useEffect(() => {
    if (audio.enabled === last.current.sound) return
    last.current.sound = audio.enabled
    track("sound_toggled", { enabled: audio.enabled })
  }, [audio.enabled])

  return {
    ...wheel,
    show: (method = "button") => {
      openedBy.current = method
      wheel.show()
    },
    choose: (index: number) => {
      // Only the station list calls this while the wheel is closed. Picking the
      // station that's already on changes nothing, so there's nothing to label.
      if (!wheel.open && demoSlots[index]?.id !== wheel.playingId) chosenBy.current = "list"
      wheel.choose(index)
    },
  }
}
