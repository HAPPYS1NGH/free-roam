import { Vector3 } from "three"
import { fbm, smoothstep } from "./noise"

// The coast road is a closed loop in x/y that keeps heading -z, so the world
// is built once for LOOP metres and drawn twice end to end.
export const LOOP = 2400
export const SEA = -13
const K = (Math.PI * 2) / LOOP

export function roadX(s: number) {
  return 34 * Math.sin(K * s * 2) + 7 * Math.sin(K * s * 5 + 1.3) + 1.5 * Math.sin(K * s * 9 + 0.4)
}
function roadXd(s: number) {
  return 68 * K * Math.cos(K * s * 2) + 35 * K * Math.cos(K * s * 5 + 1.3) + 13.5 * K * Math.cos(K * s * 9 + 0.4)
}
export function roadY(s: number) {
  return 2.2 * Math.sin(K * s * 3 + 0.7) + 0.9 * Math.sin(K * s * 7 + 2.1)
}

export type Dir = { x: number; z: number }
// Unit heading in xz. The right-hand side of the road is (-z, x).
export function tangent(s: number, out: Dir = { x: 0, z: 0 }) {
  const dx = roadXd(s)
  const l = Math.hypot(dx, 1)
  out.x = dx / l
  out.z = -1 / l
  return out
}

const t0: Dir = { x: 0, z: 0 }
// u is metres to the right of the centre line, h metres above the road.
export function pointAt(s: number, u: number, h: number, out = new Vector3()) {
  tangent(s, t0)
  return out.set(roadX(s) - t0.z * u, roadY(s) + h, -s + t0.x * u)
}

// Signed curvature (1/m), positive when the road bends right.
export function curvature(s: number) {
  const a = tangent(s - 1, { x: 0, z: 0 }), b = tangent(s + 1, { x: 0, z: 0 })
  return (a.x * b.z - a.z * b.x) / 2
}

export const ROAD_HALF = 6.2
export const LANE_U = 1.9

// Ground height beside the road: a bluff falling to the sea on the left,
// hills with a cut bank on the right.
export function terrainY(s: number, u: number) {
  const base = roadY(s)
  const n = fbm(s / 60, u / 60, 4, LOOP / 60)
  if (u < -6.6) {
    const t = -u - 6.6
    const reach = 24 + 10 * fbm(s / 200, 3.1, 2, LOOP / 200)
    const drop = smoothstep(1.5, reach, t)
    const rock = 0.5 + 3.4 * drop * (1 - drop) * 4 + 1.5 * smoothstep(reach, reach + 30, t)
    return base - 0.25 - (base - SEA + 5) * drop + n * rock * smoothstep(0, 3, t)
  }
  if (u > 6.6) {
    const t = u - 6.6
    const ridge = 44 + 24 * fbm(s / 300, 7.7, 3, LOOP / 300)
    const bank = 4.5 + 2.5 * fbm(s / 90, 1.7, 2, LOOP / 90)
    return base - 0.45 * smoothstep(0, 1.4, t) + bank * smoothstep(2, 9, t) + ridge * smoothstep(8, 110, t)
      + n * (0.4 + 5 * smoothstep(4, 60, t)) * smoothstep(0, 3, t)
  }
  return base - 0.3
}
