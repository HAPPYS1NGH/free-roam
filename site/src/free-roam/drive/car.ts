import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, LatheGeometry, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, SpotLight, TorusGeometry, Vector2, Vector3,
  type Material,
} from "three"
import { contactShadow } from "./textures"
import { smoothstep } from "./noise"

// A late-90s grand-touring coupe, lofted from cross-sections so the panels
// stay smooth. Local +z is forward, y up, wheels on y = 0.

export const PAINTS = {
  Champagne: "#b89a5e",
  Gold: "#c9962e",
  Midnight: "#151a24",
  Pearl: "#d9d6cf",
  Crimson: "#7a1018",
} as const
export type Paint = keyof typeof PAINTS

const WHEEL_R = 0.335
const AXLE_F = 1.33
const AXLE_R = -1.29
const TRACK = 0.79
const ARCH_R = 0.405
const ARCH_Y = 0.335

// Body cross-section parameters along z.
function topLine(z: number) {
  const pts: [number, number][] = [[-2.25, 0.7], [-2.18, 0.79], [-2.0, 0.845], [-1.6, 0.865], [-1.2, 0.88], [0.6, 0.885], [0.85, 0.86],
    [1.4, 0.8], [1.85, 0.72], [2.1, 0.62], [2.25, 0.5]]
  for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) {
    const [z0, y0] = pts[i - 1], [z1, y1] = pts[i]
    const t = (z - z0) / (z1 - z0)
    return y0 + (y1 - y0) * (t * t * (3 - 2 * t) * 0.35 + t * 0.65)
  }
  return pts[pts.length - 1][1]
}
const bottomLine = (z: number) => 0.235 + 0.08 * smoothstep(1.85, 2.25, z) + 0.09 * smoothstep(-1.9, -2.25, z)
const halfWidth = (z: number) => 0.925 * (1 - 0.15 * smoothstep(1.55, 2.25, z) ** 1.4 - 0.07 * smoothstep(-1.75, -2.25, z) ** 1.4)
  * (1 + 0.025 * Math.exp(-(((z - AXLE_R) / 0.55) ** 2)))

function archLift(z: number) {
  for (const zc of [AXLE_F, AXLE_R]) {
    const d = z - zc
    if (Math.abs(d) < ARCH_R) return ARCH_Y + Math.sqrt(ARCH_R * ARCH_R - d * d)
  }
  return -1
}

type SectionFn = (z: number) => { cy: number; hy: number; w: number; topScale: number; inset: number }

// Loft closed superellipse sections along z, closing each end with a fan.
function loft(zs: number[], section: SectionFn, around: number, exponent: number, clip?: (z: number, x: number, y: number, w: number) => number) {
  const pos: number[] = [], idx: number[] = []
  const ring = around
  zs.forEach(z => {
    const { cy, hy, w, topScale, inset } = section(z)
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2
      const c = Math.cos(a), s = Math.sin(a)
      let x = w * Math.sign(c) * Math.abs(c) ** (2 / exponent)
      let y = hy * Math.sign(s) * Math.abs(s) ** (2 / exponent)
      if (y > 0) x *= 1 - (1 - topScale) * (y / hy) ** 1.3
      x *= inset
      y = cy + y * inset
      if (clip) y = clip(z, x, y, w)
      pos.push(x, y, z)
    }
  })
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < ring; i++) {
    const a = j * ring + i, b = j * ring + ((i + 1) % ring), c = a + ring, d = b + ring
    idx.push(a, b, c, b, d, c)
  }
  // End caps
  for (const [j, flip] of [[0, true], [zs.length - 1, false]] as const) {
    const centre = pos.length / 3
    let cx = 0, cyy = 0
    for (let i = 0; i < ring; i++) { cx += pos[(j * ring + i) * 3]; cyy += pos[(j * ring + i) * 3 + 1] }
    pos.push(cx / ring, cyy / ring, zs[j])
    for (let i = 0; i < ring; i++) {
      const a = j * ring + i, b = j * ring + ((i + 1) % ring)
      if (flip) idx.push(centre, b, a)
      else idx.push(centre, a, b)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute("position", new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function endSamples(z0: number, z1: number, n: number) {
  const zs: number[] = []
  const bevel = [0, 0.012, 0.03, 0.055, 0.09]
  bevel.forEach(b => zs.push(z0 + b))
  for (let i = 1; i < n; i++) zs.push(z0 + 0.09 + (z1 - z0 - 0.18) * (i / n))
  bevel.slice().reverse().forEach(b => zs.push(z1 - b))
  return zs
}
const insetAt = (z: number, z0: number, z1: number) => {
  const d = Math.min(z - z0, z1 - z)
  return d >= 0.09 ? 1 : 0.84 + 0.16 * Math.sqrt(1 - (1 - d / 0.09) ** 2)
}

function bodyGeometry() {
  const Z0 = -2.25, Z1 = 2.25
  return loft(endSamples(Z0, Z1, 70), z => {
    const top = topLine(z), bottom = bottomLine(z)
    return { cy: (top + bottom) / 2, hy: (top - bottom) / 2, w: halfWidth(z), topScale: 0.9, inset: insetAt(z, Z0, Z1) }
  }, 56, 5, (z, x, y, w) => {
    // Cut the wheel arches out of the lower flanks.
    const arch = archLift(z)
    if (arch < 0 || Math.abs(x) < w * 0.55) return y
    return Math.max(y, Math.min(arch, 0.62))
  })
}

// Greenhouse: one glass loft, with roof and pillars laid over it as painted
// skins cut from the same sections so their edges stay clean.
const CABIN_Z0 = -1.42, CABIN_Z1 = 0.66
function cabinRoof(z: number) {
  if (z < -0.55) return 0.88 + (1.205 - 0.88) * Math.sin(((z - CABIN_Z0) / (-0.55 - CABIN_Z0)) * Math.PI / 2) ** 1.25
  if (z < 0.08) return 1.205 + 0.025 * Math.sin(((z + 0.55) / 0.63) * Math.PI)
  return 1.205 - (1.205 - 0.88) * ((z - 0.08) / (CABIN_Z1 - 0.08)) ** 1.15
}
const cabinSection: SectionFn = z => {
  const top = Math.max(cabinRoof(z), 0.9), bottom = 0.8
  return { cy: (top + bottom) / 2, hy: (top - bottom) / 2, w: 0.78 - 0.04 * smoothstep(-0.6, -1.4, z), topScale: 0.7, inset: 1 }
}
function sectionPoint(z: number, a: number, grow: number) {
  const { cy, hy, w, topScale } = cabinSection(z)
  const c = Math.cos(a), s = Math.sin(a), e = 6
  let x = w * Math.sign(c) * Math.abs(c) ** (2 / e)
  const y = hy * Math.sign(s) * Math.abs(s) ** (2 / e)
  if (y > 0) x *= 1 - (1 - topScale) * (y / hy) ** 1.3
  return [x * grow, cy + y * grow, z] as const
}
function cabinGeometry() {
  return loft(endSamples(CABIN_Z0, CABIN_Z1, 40), cabinSection, 48, 6)
}
function cabinSkin(z0: number, z1: number, a0: number, a1: number) {
  const pos: number[] = [], idx: number[] = []
  const rows = 24, cols = 16
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const z = z0 + (z1 - z0) * (j / rows), a = (a0 + (a1 - a0) * (i / cols)) * Math.PI / 180
    pos.push(...sectionPoint(z, a, 1.008))
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + cols + 1
    idx.push(a, a + 1, b, a + 1, b + 1, b)
  }
  const g = new BufferGeometry()
  g.setAttribute("position", new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function wheel(rimMat: Material, tyreMat: Material, discMat: Material, side: 1 | -1) {
  const w = new Group()
  const profile = [[0.235, -0.125], [0.3, -0.132], [0.325, -0.118], [WHEEL_R, -0.06], [WHEEL_R, 0.06], [0.325, 0.118], [0.3, 0.132], [0.235, 0.125]]
    .map(([r, y]) => new Vector2(r, y))
  const tyre = new Mesh(new LatheGeometry(profile, 40).rotateZ(Math.PI / 2), tyreMat)
  w.add(tyre)
  const face = side * 0.1
  const lip = new Mesh(new TorusGeometry(0.222, 0.016, 8, 40).rotateY(Math.PI / 2).translate(face, 0, 0), rimMat)
  const barrel = new Mesh(new CylinderGeometry(0.228, 0.228, 0.22, 32, 1, true).rotateZ(Math.PI / 2), rimMat)
  const hub = new Mesh(new CylinderGeometry(0.05, 0.06, 0.06, 16).rotateZ(Math.PI / 2).translate(face, 0, 0), rimMat)
  w.add(lip, barrel, hub)
  for (let k = 0; k < 5; k++) {
    const spoke = new Mesh(new BoxGeometry(0.035, 0.19, 0.05).translate(0, 0.11, 0), rimMat)
    spoke.position.x = face - side * 0.01
    spoke.rotation.x = (k / 5) * Math.PI * 2
    w.add(spoke)
  }
  const disc = new Mesh(new CylinderGeometry(0.17, 0.17, 0.025, 28).rotateZ(Math.PI / 2).translate(-side * 0.03, 0, 0), discMat)
  w.add(disc)
  w.traverse(o => { o.castShadow = true })
  return w
}

export function buildCar(paint: Paint) {
  const root = new Group()
  const body = new Group()
  root.add(body)

  const paintMat = new MeshPhysicalMaterial({ color: PAINTS[paint], metalness: 0.7, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.25 })
  const glassMat = new MeshPhysicalMaterial({ color: "#05070a", metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.8 })
  const trim = new MeshStandardMaterial({ color: "#0b0c0e", roughness: 0.55, metalness: 0.1 })
  const chrome = new MeshStandardMaterial({ color: "#d4d6d8", roughness: 0.18, metalness: 1 })
  const rimMat = new MeshStandardMaterial({ color: "#3c3f44", roughness: 0.32, metalness: 0.9 })
  const tyreMat = new MeshStandardMaterial({ color: "#121213", roughness: 0.88 })
  const discMat = new MeshStandardMaterial({ color: "#58585a", roughness: 0.5, metalness: 0.8 })
  const tailMat = new MeshPhysicalMaterial({ color: "#5a0a0c", emissive: new Color("#ff0804"), emissiveIntensity: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 })
  const smoked = new MeshPhysicalMaterial({ color: "#0d0a0b", roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 })
  const headMat = new MeshStandardMaterial({ color: "#c8ccd0", emissive: new Color("#fff1dc"), emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.4 })
  const plateMat = new MeshStandardMaterial({ color: "#9c9a92", emissive: new Color("#fff4e0"), emissiveIntensity: 0, roughness: 0.7 })

  const shell = new Mesh(bodyGeometry(), paintMat)
  const cabin = new Mesh(cabinGeometry(), glassMat)
  shell.castShadow = cabin.castShadow = true
  shell.receiveShadow = true
  body.add(shell, cabin)
  // Roof, C-pillars sweeping into the tail, slim A-pillars.
  const skins = [cabinSkin(-0.66, 0.16, 28, 152), cabinSkin(-1.36, -0.5, -12, 30), cabinSkin(-1.36, -0.5, 150, 192),
    cabinSkin(0.1, 0.64, 22, 34), cabinSkin(0.1, 0.64, 146, 158)]
  skins.forEach(g => { const m = new Mesh(g, paintMat); m.castShadow = true; body.add(m) })

  const add = (geo: BufferGeometry, mat: Material, x: number, y: number, z: number, parent: Object3D = body) => {
    const m = new Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    parent.add(m)
    return m
  }

  // Rear: full-width light bar with twin clusters, blank plate, diffuser, exhausts, wing.
  const rearZ = -2.252
  const lamp = new CylinderGeometry(0.062, 0.066, 0.03, 28).rotateX(Math.PI / 2)
  const ring = new TorusGeometry(0.068, 0.009, 8, 28)
  for (const s of [-1, 1]) {
    // Smoked housing with twin round lamps.
    add(new BoxGeometry(0.5, 0.17, 0.03), smoked, s * 0.6, 0.7, rearZ + 0.01)
    for (const x of [0.48, 0.7]) {
      add(lamp, tailMat, s * x, 0.7, rearZ - 0.006)
      add(ring, chrome, s * x, 0.7, rearZ - 0.02)
    }
    add(new CylinderGeometry(0.048, 0.048, 0.17, 18).rotateX(Math.PI / 2), chrome, s * 0.42, 0.29, -2.2)
    add(new CylinderGeometry(0.036, 0.036, 0.172, 18).rotateX(Math.PI / 2), trim, s * 0.42, 0.29, -2.2)
    add(new BoxGeometry(0.05, 0.16, 0.08), trim, s * 0.56, 0.93, -1.98)
    add(new BoxGeometry(0.02, 0.12, 0.3), paintMat, s * 0.8, 1.0, -2.0)
    // Mirrors
    add(new BoxGeometry(0.17, 0.095, 0.13), paintMat, s * 0.88, 0.95, 0.42)
    add(new BoxGeometry(0.05, 0.03, 0.06), trim, s * 0.8, 0.92, 0.46)
    // Headlamps
    add(new BoxGeometry(0.38, 0.07, 0.1).rotateX(-0.45), headMat, s * 0.6, 0.53, 2.16)
    // Arch liners keep the wheel wells dark.
    for (const z of [AXLE_F, AXLE_R]) {
      const liner = add(new CylinderGeometry(ARCH_R - 0.01, ARCH_R - 0.01, 0.3, 24, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), trim, s * 0.74, ARCH_Y, z)
      ;(liner.material as MeshStandardMaterial).side = DoubleSide
    }
  }
  add(new BoxGeometry(0.66, 0.05, 0.025), smoked, 0, 0.7, rearZ + 0.004)
  add(new BoxGeometry(0.44, 0.12, 0.012), plateMat, 0, 0.49, rearZ - 0.004)
  add(new BoxGeometry(0.48, 0.15, 0.01), trim, 0, 0.49, rearZ + 0.002)
  add(new BoxGeometry(1.3, 0.07, 0.22), trim, 0, 0.27, -2.06)
  const wing = add(new BoxGeometry(1.62, 0.035, 0.27), paintMat, 0, 1.015, -2.0)
  wing.rotation.x = 0.08
  add(new BoxGeometry(1.7, 0.06, 0.6), trim, 0, 0.265, 2.0)
  // Black rocker strips and window belt trim.
  for (const s of [-1, 1]) {
    add(new BoxGeometry(0.03, 0.09, 1.7), trim, s * 0.93, 0.29, 0.02)
    add(new BoxGeometry(0.02, 0.025, 1.85), trim, s * 0.785, 0.9, -0.38)
  }

  const wheels: Group[] = []
  for (const [x, z] of [[TRACK, AXLE_F], [-TRACK, AXLE_F], [TRACK, AXLE_R], [-TRACK, AXLE_R]]) {
    const w = wheel(rimMat, tyreMat, discMat, x > 0 ? 1 : -1)
    w.position.set(x, WHEEL_R, z)
    root.add(w)
    wheels.push(w)
  }

  const shadow = new Mesh(new PlaneGeometry(2.5, 5.4).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ map: contactShadow(), color: "#000", transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }))
  shadow.position.y = 0.012
  shadow.renderOrder = 2
  root.add(shadow)

  // Low beams: one spot centred between the lamps reads as the pair from behind.
  const beam = new SpotLight("#fff2de", 0, 90, 0.42, 0.55, 1.4)
  beam.position.set(0, 0.62, 2.2)
  beam.target.position.set(0, 0, 26)
  // A spot, not a point light: the ground ignores point lights (they are the
  // streetlights' stand-ins for lighting the car).
  const tailGlow = new SpotLight("#ff2a18", 0, 6, 1.25, 1, 2)
  tailGlow.position.set(0, 0.7, -2.2)
  tailGlow.target.position.set(0, 0, -4.2)
  body.add(beam, beam.target, tailGlow, tailGlow.target)

  return {
    root, body, wheels, wheelRadius: WHEEL_R,
    setPaint(p: Paint) { paintMat.color.set(PAINTS[p]) },
    // 0 = daylight running, 1 = full night.
    setLights(f: number) {
      tailMat.emissiveIntensity = 0.5 + 1.7 * f
      headMat.emissiveIntensity = 0.3 + 6 * f
      plateMat.emissiveIntensity = 0.12 * f
      beam.intensity = 220 * f
      tailGlow.intensity = 1.2 * f
    },
  }
}
export type Car = ReturnType<typeof buildCar>
