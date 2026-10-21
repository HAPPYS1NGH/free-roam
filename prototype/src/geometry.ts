// Angles are in radians, 0 at the top, increasing clockwise. Slot 0 is Radio
// Off at the bottom of the ring, as in GTA V, and stations run clockwise from
// it. This file ports to WheelGeometry.swift line for line.

const TURN = Math.PI * 2
const RING_START = Math.PI

export function slotAngle(index: number, count: number) {
  return RING_START + (index / count) * TURN
}

export function slotForVector(x: number, y: number, count: number) {
  const angle = Math.atan2(x, -y)
  const fromStart = (((angle - RING_START) % TURN) + TURN) % TURN
  return Math.round(fromStart / (TURN / count)) % count
}

export function polar(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) }
}
