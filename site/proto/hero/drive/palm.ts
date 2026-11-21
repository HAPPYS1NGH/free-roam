import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Vector3 } from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import { rng } from "./noise"

// Tall Washingtonia palms, built once per variant and instanced along the hill.

function taperedTube(curve: CatmullRomCurve3, rows: number, sides: number, radius: (t: number) => number, vRepeat: number) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = []
  const frames = curve.computeFrenetFrames(rows, false)
  const p = new Vector3(), n = new Vector3()
  for (let j = 0; j <= rows; j++) {
    const t = j / rows
    curve.getPointAt(t, p)
    const r = radius(t)
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2
      n.copy(frames.normals[j]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[j], Math.sin(a))
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r)
      nor.push(n.x, n.y, n.z)
      uv.push(i / sides, t * vRepeat)
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < sides; i++) {
    const a = j * (sides + 1) + i, b = a + sides + 1
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new BufferGeometry()
  g.setAttribute("position", new Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3))
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// One frond as a folded strip that arcs out and droops under its own weight.
function frondStrip(top: Vector3, azimuth: number, lift: number, length: number, droop: number, tint: Color, rand: () => number) {
  const rows = 9
  const width = 1.7 + rand() * 0.4
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = []
  const out = new Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))
  const side = new Vector3(-out.z, 0, out.x)
  const p = top.clone()
  let angle = lift
  for (let j = 0; j <= rows; j++) {
    const t = j / rows
    if (j > 0) {
      const step = length / rows
      p.addScaledVector(out, Math.cos(angle) * step)
      p.y += Math.sin(angle) * step
      angle -= droop / rows * (0.4 + t * 1.6)
    }
    const up = new Vector3(0, 1, 0).applyAxisAngle(side, 0).addScaledVector(out, -Math.sin(angle) * 0.3).normalize()
    const fold = 0.28 * width * (0.3 + t)
    for (const s of [-1, 0, 1]) {
      const twist = s * width / 2
      pos.push(p.x + side.x * twist, p.y - Math.abs(s) * fold * 0.5, p.z + side.z * twist)
      nor.push(up.x, up.y, up.z)
      uv.push((s + 1) / 2, t)
      col.push(tint.r, tint.g, tint.b)
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < 2; i++) {
    const a = j * 3 + i, b = a + 3
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new BufferGeometry()
  g.setAttribute("position", new Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3))
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2))
  g.setAttribute("color", new Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

export function palmGeometry(height: number, seed: number) {
  const rand = rng(seed)
  const lean = (rand() - 0.5) * height * 0.08
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(lean * 0.2, height * 0.35, lean * 0.1),
    new Vector3(lean * 0.7, height * 0.7, lean * 0.25),
    new Vector3(lean, height, lean * 0.3),
  ])
  const trunk = taperedTube(curve, 14, 8, t => 0.34 - 0.14 * t + 0.12 * Math.max(0, 0.12 - t) * 6, height / 1.6)
  const top = curve.getPointAt(1)

  const green = new Color(1, 1, 1), olive = new Color(0.82, 0.86, 0.62), dead = new Color(0.72, 0.52, 0.3)
  const fronds: BufferGeometry[] = []
  const tiers: [number, number, number, Color][] = [
    [7, 0.95, 1.2, green], [8, 0.35, 1.3, green], [7, -0.15, 1.1, olive], [6, -1.15, 0.25, dead],
  ]
  tiers.forEach(([count, lift, droop, tint], tier) => {
    for (let i = 0; i < count; i++) {
      const az = (i / count) * Math.PI * 2 + tier * 0.7 + rand() * 0.4
      const len = tier === 3 ? 1.9 + rand() * 0.6 : 3.4 + rand() * 1.1
      fronds.push(frondStrip(top.clone().add(new Vector3(0, -tier * 0.18, 0)), az, lift + (rand() - 0.5) * 0.3, len, droop + rand() * 0.3, tint, rand))
    }
  })
  return { trunk, fronds: mergeGeometries(fronds)! }
}
