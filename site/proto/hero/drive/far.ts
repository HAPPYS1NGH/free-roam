import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Points, PointsMaterial, Vector2 } from "three"
import { fbm, noise2, rng, smoothstep } from "./noise"
import { SEA } from "./path"

// The far coast: a mountain range running out to a headland ahead-left, with
// a strip of town lights along its foot. It travels with the camera, so it
// sits at a fixed bearing like real distant terrain.

const COAST = [[-3000, -5400], [-1500, -4300], [0, -3600], [1300, -3100], [2500, -2400], [3500, -1400], [4000, 0], [4200, 1500]]
  .map(([x, z]) => new Vector2(x, z))

function coastAt(t: number) {
  const f = t * (COAST.length - 1)
  const i = Math.min(COAST.length - 2, Math.floor(f))
  const a = COAST[i], b = COAST[i + 1]
  const p = a.clone().lerp(b, f - i)
  const d = b.clone().sub(a).normalize()
  return { p, n: new Vector2(d.y, -d.x) }
}

export function buildFar() {
  const group = new Group()
  const cols = 480, rows = 28
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const lowC = new Color("#2c3022"), highC = new Color("#4a4438"), c = new Color()
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const t = i / cols, r = j / rows
    const { p, n } = coastAt(t)
    // Broad massif plus ridged peaks, falling to a low headland on the left.
    const mass = (140 + 760 * smoothstep(0.0, 0.32, t)) * (0.7 + 0.45 * fbm(t * 5, 2.3, 3))
    const ridged = (1 - Math.abs(noise2(t * 22, r * 2.5 + 9.1))) ** 2 + 0.5 * (1 - Math.abs(noise2(t * 55, r * 4 + 3.3))) ** 2
    const h = r === 0 ? SEA - 4 : mass * Math.sin(Math.min(1, r * 1.15) * Math.PI / 2) ** 0.9 * (0.7 + 0.4 * fbm(t * 14, r * 3, 4)) + ridged * 230 * r ** 1.4 * smoothstep(0.0, 0.25, t)
    const depth = 250 + r * (3200 + 900 * fbm(t * 3, 5.5, 2))
    pos.push(p.x + n.x * depth, h, p.y + n.y * depth)
    c.copy(lowC).lerp(highC, r)
    col.push(c.r, c.g, c.b)
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const geo = new BufferGeometry()
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3))
  geo.setAttribute("color", new Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const range = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 1, envMapIntensity: 0.5 }))
  range.frustumCulled = false
  group.add(range)

  // Town lights strung along the foot of the range.
  const rand = rng(9)
  const lp: number[] = [], lc: number[] = []
  const warm = new Color("#ffb46e"), white = new Color("#fff2dc"), cool = new Color("#bcd2ff")
  for (let k = 0; k < 2600; k++) {
    const t = 0.06 + rand() * 0.94
    if (fbm(t * 14, 1.7, 2) < -0.15 && rand() > 0.15) continue
    const { p, n } = coastAt(t)
    const inland = 40 + rand() ** 2 * 900
    lp.push(p.x + n.x * inland + (rand() - 0.5) * 80, SEA + 4 + inland * 0.06 * rand(), p.y + n.y * inland)
    const pick = rand()
    c.copy(pick > 0.9 ? cool : pick > 0.55 ? white : warm).multiplyScalar(0.5 + rand())
    lc.push(c.r, c.g, c.b)
  }
  const lights = new BufferGeometry()
  lights.setAttribute("position", new Float32BufferAttribute(lp, 3))
  lights.setAttribute("color", new Float32BufferAttribute(lc, 3))
  const lightMat = new PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0,
    depthWrite: false, blending: AdditiveBlending, fog: false })
  const town = new Points(lights, lightMat)
  town.frustumCulled = false
  group.add(town)
  return { group, lightMat }
}
