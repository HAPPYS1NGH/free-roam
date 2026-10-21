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

export function PowerIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M12 3v8" />
      <path d="M6.3 6.8a8 8 0 1 0 11.4 0" />
    </svg>
  )
}

export function PlusIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M12 5v14M5 12h14" />
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
