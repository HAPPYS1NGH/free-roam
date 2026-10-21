// Angles are in radians, 0 at the top of the wheel, increasing clockwise.
// This file ports to WheelGeometry.swift line for line.

export function slotAngle(index: number, count: number) {
  return (index / count) * Math.PI * 2
}

export function slotForVector(x: number, y: number, count: number) {
  const angle = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2)
  const slice = (Math.PI * 2) / count
  return Math.floor((angle + slice / 2) / slice) % count
}

export function polar(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) }
}

// A ring segment whose edges stay `gap` pixels apart at every radius, rather
// than a constant angle apart (which pinches toward the centre).
export function wedgePath(cx: number, cy: number, outer: number, inner: number, start: number, end: number, gap: number) {
  const outerInset = Math.asin(Math.min(1, gap / 2 / outer))
  const innerInset = Math.asin(Math.min(1, gap / 2 / inner))
  const p1 = polar(cx, cy, outer, start + outerInset)
  const p2 = polar(cx, cy, outer, end - outerInset)
  const p3 = polar(cx, cy, inner, end - innerInset)
  const p4 = polar(cx, cy, inner, start + innerInset)
  const largeArc = end - start - outerInset * 2 > Math.PI ? 1 : 0
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ")
}
