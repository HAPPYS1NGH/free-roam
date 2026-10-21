import type { SVGProps } from "react"

type IconProps = { size?: number }

function iconProps(size: number): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  }
}

// The "no entry" mark GTA uses for its Radio Off slot. It fills its box, and
// its stroke is about 5% of its width, as measured from GTA. The slash ends
// square on the ring's centre line, so its corners hide inside the ring.
export function RadioOffIcon({ size = 24 }: IconProps) {
  return (
    <svg {...iconProps(size)} strokeWidth={1.25}>
      <circle cx="12" cy="12" r="11.25" />
      <path d="M4.05 4.05 19.95 19.95" strokeLinecap="butt" />
    </svg>
  )
}

export function RadioIcon({ size = 16 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </svg>
  )
}

export function SpeakerIcon({ size = 14 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  )
}
