import type { DialConfig } from "dialkit"
import type { ComponentType } from "react"
import { Arcade, arcadeControls } from "./Arcade"
import { Halo, haloControls } from "./Halo"
import { Tuner, tunerControls } from "./Tuner"
import type { WheelProps } from "./types"

export type Variant = {
  name: string
  controls: DialConfig
  // Each variant reads its own tuned values; the host only passes them through.
  Component: ComponentType<WheelProps<any>>
}

export const variants: Variant[] = [
  { name: "Arcade", controls: arcadeControls, Component: Arcade },
  { name: "Tuner", controls: tunerControls, Component: Tuner },
  { name: "Halo", controls: haloControls, Component: Halo },
]
