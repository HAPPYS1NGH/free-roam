import type { SpringConfig, TransitionConfig } from "dialkit"
import type { Transition } from "motion/react"

// Every spring is stored as mass/stiffness/damping because SwiftUI's
// .interpolatingSpring(mass:stiffness:damping:) runs the same physics, so the
// numbers port without conversion.
export function toPhysics(spring: SpringConfig) {
  if (spring.stiffness !== undefined) {
    return { mass: spring.mass ?? 1, stiffness: spring.stiffness, damping: spring.damping ?? 10 }
  }
  // Same conversion Motion applies to visualDuration/bounce springs.
  const root = (2 * Math.PI) / ((spring.visualDuration ?? 0.3) * 1.2)
  const stiffness = root * root
  const dampingRatio = Math.min(1, Math.max(0.05, 1 - (spring.bounce ?? 0)))
  return { mass: 1, stiffness, damping: 2 * dampingRatio * Math.sqrt(stiffness) }
}

// Slowing a spring down by `speed` keeps its shape when stiffness scales by
// speed² and damping by speed.
export function transitionFor(config: TransitionConfig, speed: number, reduced: boolean): Transition {
  if (reduced) return { duration: 0 }
  if (config.type === "easing") return { duration: config.duration / speed, ease: config.ease }
  const { mass, stiffness, damping } = toPhysics(config)
  return { type: "spring", mass, stiffness: stiffness * speed * speed, damping: damping * speed }
}
