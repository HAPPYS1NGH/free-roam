import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshDepthMaterial, MeshStandardMaterial,
  Object3D, Points, PointsMaterial, Quaternion, ShaderMaterial, TubeGeometry, UniformsLib, UniformsUtils, Vector3,
} from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import { fbm, noise2, rng, smoothstep } from "./noise"
import { LOOP, ROAD_HALF, SEA, pointAt, roadY, tangent, terrainY } from "./path"
import { palmGeometry } from "./palm"
import { asphalt, bark, frond, glow, groundDetail, ROAD_TILE } from "./textures"
import { gulls } from "./gulls"
import { sway, type Sway } from "./wind"
import { LAMP_COUNT, LAMP_HEIGHT, LAMP_OFFSET, LAMP_REACH, LAMP_SPACING, LAMP_U, createLamps, lampHead } from "./lamps"

// Surface normal from finite differences, so both loop copies share edges.
function groundNormal(s: number, u: number, out: Vector3) {
  const e = 0.5
  const dhdu = (terrainY(s, u + e) - terrainY(s, u - e)) / (2 * e)
  const dhds = (terrainY(s + e, u) - terrainY(s - e, u)) / (2 * e)
  const t = tangent(s)
  // right = (-t.z, 0, t.x), forward = (t.x, 0, t.z)
  return out.set(t.z * dhdu - t.x * dhds, 1, -t.x * dhdu - t.z * dhds).normalize()
}

function grid(rows: number, cols: number, vertex: (j: number, i: number, p: number[], n: number[], uv: number[], c: number[]) => void) {
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], col: number[] = [], idx: number[] = []
  for (let j = 0; j <= rows; j++) for (let i = 0; i < cols; i++) vertex(j, i, pos, nor, uvs, col)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i, b = a + cols
    idx.push(a, a + 1, b, b, a + 1, b + 1)
  }
  const g = new BufferGeometry()
  g.setAttribute("position", new Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3))
  if (uvs.length) g.setAttribute("uv", new Float32BufferAttribute(uvs, 2))
  if (col.length) g.setAttribute("color", new Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

const C = (hex: string) => new Color(hex)
const PAL = {
  gravel: C("#6f675c"), grass: C("#a08a58"), dryGrass: C("#a88d58"), scrub: C("#4c5530"), chaparral: C("#2e3820"),
  rock: C("#7b6f62"), darkRock: C("#4a4038"), sand: C("#cdb894"), wetSand: C("#6e6250"),
}

function terrain() {
  const U = [-130, -105, -86, -72, -60, -50, -42, -35, -29, -24, -20, -16.5, -13.5, -11.2, -9.5, -8.3, -7.4, -6.8, -6.3, -3, 0, 3,
    6.3, 6.8, 7.4, 8.2, 9.2, 10.5, 12, 14, 16.5, 19.5, 23, 27, 32, 38, 45, 53, 62, 72, 84, 98, 115, 135, 160]
  const step = 3
  const p = new Vector3(), n = new Vector3(), col = new Color()
  return grid(LOOP / step, U.length, (j, i, pos, nor, uv, c) => {
    const s = j * step, u = U[i]
    const y = terrainY(s, u)
    pointAt(s, u, 0, p)
    p.y = y
    groundNormal(s, u, n)
    pos.push(p.x, p.y, p.z)
    nor.push(n.x, n.y, n.z)
    uv.push(s / 7, u / 7)
    const steep = 1 - n.y
    const patch = fbm(s / 40, u / 25, 3, LOOP / 40)
    if (Math.abs(u) < 6.9) col.copy(PAL.gravel)
    else {
      col.copy(PAL.dryGrass).lerp(PAL.grass, smoothstep(-0.4, 0.2, patch))
      col.lerp(PAL.scrub, smoothstep(-0.1, 0.3, patch + noise2(s / 9, u / 9, LOOP / 9) * 0.25))
      col.lerp(PAL.chaparral, smoothstep(0.15, 0.5, patch))
      col.lerp(PAL.rock, smoothstep(0.32, 0.55, steep))
      col.lerp(PAL.darkRock, smoothstep(0.6, 0.85, steep) * 0.8)
      if (u < 0) {
        col.lerp(PAL.sand, smoothstep(SEA + 2.5, SEA + 0.6, y) * (1 - smoothstep(0.4, 0.7, steep)))
        col.lerp(PAL.wetSand, smoothstep(SEA + 0.4, SEA - 0.6, y))
      }
    }
    // The detail map averages 0.8, so lift the base to compensate.
    c.push(col.r * 1.1, col.g * 1.1, col.b * 1.1)
  })
}

function road() {
  const step = 2
  const p = new Vector3()
  const geo = grid(LOOP / step, 3, (j, i, pos, nor, uv) => {
    const s = j * step, u = (i - 1) * ROAD_HALF
    pointAt(s, u, 0, p)
    // A slight crown sheds water to the edges.
    pos.push(p.x, p.y + (i === 1 ? 0.06 : 0), p.z)
    const dy = (roadY(s + 0.5) - roadY(s - 0.5))
    const t = tangent(s)
    const n = new Vector3(-t.x * dy, 1, -t.z * dy).normalize()
    nor.push(n.x, n.y, n.z)
    uv.push(i / 2, s / ROAD_TILE)
  })
  const tex = asphalt()
  const mat = new MeshStandardMaterial({ map: tex.map, roughnessMap: tex.roughness, roughness: 1, metalness: 0, envMapIntensity: 0.7 })
  mat.userData.wet = true
  const mesh = new Mesh(geo, mat)
  mesh.receiveShadow = true
  return mesh
}

function sweep(profile: [number, number][], step: number) {
  const p = new Vector3()
  return grid(LOOP / step, profile.length, (j, i, pos, nor) => {
    const s = j * step
    const [u, h] = profile[i]
    pointAt(s, u, h, p)
    pos.push(p.x, p.y, p.z)
    const t = tangent(s)
    nor.push(-t.z, 0.15, t.x)
  })
}

function guardrail(group: Group) {
  const steel = new MeshStandardMaterial({ color: "#a3a7aa", metalness: 0.85, roughness: 0.42, side: DoubleSide })
  const rail = new Mesh(sweep([[-6.78, 0.46], [-6.7, 0.53], [-6.78, 0.61], [-6.7, 0.69], [-6.78, 0.77]], 2), steel)
  rail.geometry.computeVertexNormals()
  rail.castShadow = true
  group.add(rail)

  const spacing = 3.81
  const count = Math.floor(LOOP / spacing)
  const posts = new InstancedMesh(new BoxGeometry(0.12, 0.95, 0.16), new MeshStandardMaterial({ color: "#7d7f80", metalness: 0.6, roughness: 0.6 }), count)
  const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), one = new Vector3(1, 1, 1)
  for (let k = 0; k < count; k++) {
    const s = k * spacing
    const t = tangent(s)
    q.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(t.x, t.z))
    pointAt(s, -6.88, 0.2, p)
    posts.setMatrixAt(k, m.compose(p, q, one))
  }
  posts.castShadow = true
  group.add(posts)
}

function streetlights(group: Group) {
  const curve = new CatmullRomCurve3([
    new Vector3(0, LAMP_HEIGHT - 0.5, 0), new Vector3(-0.6, LAMP_HEIGHT + 0.05, 0),
    new Vector3(-1.8, LAMP_HEIGHT + 0.2, 0), new Vector3(-LAMP_REACH + 0.3, LAMP_HEIGHT + 0.08, 0),
  ])
  const pole = new CylinderGeometry(0.085, 0.15, LAMP_HEIGHT, 10).translate(0, LAMP_HEIGHT / 2, 0)
  const arm = new TubeGeometry(curve, 16, 0.055, 6)
  const head = new BoxGeometry(0.78, 0.16, 0.34).translate(-LAMP_REACH, LAMP_HEIGHT + 0.02, 0)
  const base = new CylinderGeometry(0.24, 0.28, 0.5, 10).translate(0, 0.25, 0)
  const body = mergeGeometries([pole, arm, head, base])!
  const lensGeo = new BoxGeometry(0.6, 0.03, 0.24).translate(-LAMP_REACH, LAMP_HEIGHT - 0.07, 0)
  const index = Float32Array.from({ length: LAMP_COUNT }, (_, k) => k)
  lensGeo.setAttribute("aLamp", new InstancedBufferAttribute(index, 1))

  const lamps = createLamps()
  const metal = new MeshStandardMaterial({ color: "#5d6266", metalness: 0.7, roughness: 0.5 })
  const lens = new MeshStandardMaterial({ color: "#3a3630", emissive: new Color("#ffffff"), emissiveIntensity: 14, roughness: 0.3 })
  lamps.lens(lens)
  const poles = new InstancedMesh(body, metal, LAMP_COUNT)
  const lenses = new InstancedMesh(lensGeo, lens, LAMP_COUNT)
  poles.castShadow = true
  const haloPos: number[] = []

  const m = new Matrix4(), xa = new Vector3(), ya = new Vector3(0, 1, 0), za = new Vector3(), p = new Vector3()
  for (let k = 0; k < LAMP_COUNT; k++) {
    const s = LAMP_OFFSET + k * LAMP_SPACING
    const t = tangent(s)
    xa.set(-t.z, 0, t.x)
    za.crossVectors(xa, ya)
    pointAt(s, LAMP_U, terrainY(s, LAMP_U) - roadY(s), p)
    m.makeBasis(xa, ya, za).setPosition(p)
    poles.setMatrixAt(k, m)
    lenses.setMatrixAt(k, m)
    lampHead(k, p)
    haloPos.push(p.x, p.y - 0.15, p.z)
  }
  const haloGeo = new BufferGeometry()
  haloGeo.setAttribute("position", new Float32BufferAttribute(haloPos, 3))
  haloGeo.setAttribute("aLamp", new Float32BufferAttribute(index, 1))
  const halo = new PointsMaterial({ map: glow(1), size: 7, transparent: true, opacity: 0.32, blending: AdditiveBlending, depthWrite: false })
  lamps.halo(halo)
  group.add(poles, lenses, new Points(haloGeo, halo))
  return { lamps, lens }
}

function palms(group: Group, rand: () => number, time: { value: number }) {
  const trunkMat = new MeshStandardMaterial({ map: bark(), roughness: 0.95, userData: { sway: "trunk" } })
  const frondMat = new MeshStandardMaterial({ map: frond(), vertexColors: true, alphaTest: 0.45, side: DoubleSide, roughness: 0.95, envMapIntensity: 0.35, color: "#d8d6a0", userData: { sway: "frond" } })
  // Shadows sway with the trees; the shadow pass copies map and alphaTest over.
  const trunkDepth = sway(new MeshDepthMaterial(), "trunk", time), frondDepth = sway(new MeshDepthMaterial(), "frond", time)
  const variants = [palmGeometry(13, 1), palmGeometry(17, 2), palmGeometry(21, 3)]
  const spots: { s: number; u: number; v: number; scale: number; rot: number }[] = []
  // A broken row along the right verge, then scattered palms up the hill.
  for (let s = 6; s < LOOP - 6; s += 9 + rand() * 30) {
    if (fbm(s / 160, 0.5, 2, LOOP / 160) < -0.25) continue
    spots.push({ s, u: 9.4 + rand() * 3.5, v: Math.floor(rand() * 3), scale: 0.85 + rand() * 0.35, rot: rand() * 6.28 })
  }
  for (let n = 0; n < 160; n++) spots.push({ s: rand() * LOOP, u: 16 + rand() ** 1.6 * 110, v: Math.floor(rand() * 3), scale: 0.8 + rand() * 0.5, rot: rand() * 6.28 })
  for (let n = 0; n < 10; n++) spots.push({ s: rand() * LOOP, u: -8.5 - rand() * 4, v: 0, scale: 0.8 + rand() * 0.2, rot: rand() * 6.28 })

  const o = new Object3D(), p = new Vector3()
  variants.forEach((geo, v) => {
    const mine = spots.filter(spot => spot.v === v)
    const trunks = new InstancedMesh(geo.trunk, trunkMat, mine.length)
    const crowns = new InstancedMesh(geo.fronds, frondMat, mine.length)
    mine.forEach((spot, k) => {
      pointAt(spot.s, spot.u, 0, p)
      o.position.set(p.x, terrainY(spot.s, spot.u) - 0.3, p.z)
      o.rotation.set(0, spot.rot, 0)
      o.scale.setScalar(spot.scale)
      o.updateMatrix()
      trunks.setMatrixAt(k, o.matrix)
      crowns.setMatrixAt(k, o.matrix)
    })
    trunks.castShadow = crowns.castShadow = true
    trunks.customDepthMaterial = trunkDepth
    crowns.customDepthMaterial = frondDepth
    group.add(trunks, crowns)
  })
}

// A shrub is a few lumpy blobs merged, with normals pointing out from the
// cluster centre so it shades like foliage instead of like rock.
function shrubGeometry(rand: () => number) {
  const parts: BufferGeometry[] = []
  for (let k = 0; k < 4; k++) {
    const g = new IcosahedronGeometry(0.55 + rand() * 0.35, 1)
    const pos = g.attributes.position
    const ox = (rand() - 0.5) * 0.9, oz = (rand() - 0.5) * 0.9, oy = 0.35 + rand() * 0.3
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const j = 1 + noise2(x * 4 + k * 3, z * 4 + y * 3) * 0.22
      pos.setXYZ(i, x * j + ox, Math.max(y * j, -0.15) + oy, z * j + oz)
    }
    parts.push(g.deleteAttribute("uv"))
  }
  const geo = mergeGeometries(parts)!
  const pos = geo.attributes.position, nor = geo.attributes.normal
  const n = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i), pos.getY(i) - 0.2, pos.getZ(i)).normalize()
    nor.setXYZ(i, n.x, n.y, n.z)
  }
  return geo
}

function shrubs(group: Group, rand: () => number) {
  const geo = shrubGeometry(rand)
  const spots: [number, number][] = []
  for (let n = 0; n < 1600; n++) spots.push([rand() * LOOP, -7.6 - rand() ** 1.4 * 9])
  // Chaparral grows in clumps: keep only spots inside the dense patches.
  for (let n = 0; n < 9000; n++) {
    const s = rand() * LOOP, u = 8.2 + rand() ** 1.5 * 100
    if (fbm(s / 40, u / 25, 3, LOOP / 40) < 0.12) continue
    spots.push([s, u])
  }
  const mesh = new InstancedMesh(geo, new MeshStandardMaterial({ roughness: 0.95, color: "#ffffff", userData: { sway: "shrub" } }), spots.length)
  const o = new Object3D(), p = new Vector3(), col = new Color()
  spots.forEach(([s, u], k) => {
    const size = (0.3 + rand() ** 2 * 0.9) * (Math.abs(u) > 25 ? 1.8 : 1)
    pointAt(s, u, 0, p)
    o.position.set(p.x, terrainY(s, u) - 0.15 * size, p.z)
    o.rotation.set(0, rand() * 6.28, 0)
    o.scale.set(size * (1 + rand() * 0.4), size * (0.7 + rand() * 0.4), size)
    o.updateMatrix()
    mesh.setMatrixAt(k, o.matrix)
    mesh.setColorAt(k, col.copy(PAL.chaparral).lerp(PAL.scrub, rand() * 0.7).lerp(PAL.dryGrass, rand() * 0.25).multiplyScalar(0.75))
  })
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

// Surf: a foam ribbon along the waterline with swells rolling in to shore.
function surf(group: Group, time: { value: number }) {
  const step = 3
  const p = new Vector3()
  const shore: number[] = []
  for (let s = 0; s <= LOOP; s += step) {
    let u = -7
    while (u > -140 && terrainY(s, u) > SEA + 0.15) u -= 0.5
    shore.push(u)
  }
  const across = [1.5, 0, -2, -5, -9, -14]
  const geo = grid(LOOP / step, across.length, (j, i, pos, nor, uv) => {
    const s = j * step
    pointAt(s, shore[j] + across[i], 0, p)
    pos.push(p.x, SEA + 0.06, p.z)
    nor.push(0, 1, 0)
    uv.push(s, Math.max(0, -across[i]) / 14)
  })
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uLight: { value: new Color(1, 1, 1) } }]),
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uLight;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
      }
      void main() {
        float a = vUv.y;
        float n = noise(vec2(vUv.x * 0.08, a * 3.0)) * 0.6 + noise(vec2(vUv.x * 0.5, a * 12.0 - uTime * 0.3)) * 0.4;
        float swell = sin(a * 14.0 - uTime * 1.1 + noise(vec2(vUv.x * 0.03, 1.0)) * 9.0);
        float bands = smoothstep(0.55, 0.95, swell + n * 0.5 - 0.15) * pow(1.0 - a, 1.4);
        float edge = smoothstep(0.14, 0.0, a) * (0.55 + 0.45 * n);
        float foam = clamp(max(bands * 0.8, edge) * smoothstep(0.25, 0.6, n + 0.2), 0.0, 1.0);
        gl_FragColor = vec4(uLight * (0.85 + 0.15 * n), foam * 0.85);
        #include <fog_fragment>
      }`,
  })
  material.uniforms.uTime = time
  group.add(new Mesh(geo, material))
  return material
}

// Lit windows scattered up the hillside, shown after dark.
function hillLights(group: Group, rand: () => number) {
  const pos: number[] = [], col: number[] = []
  const p = new Vector3(), warm = C("#ffb070"), cool = C("#cfe0ff")
  for (let n = 0; n < 420; n++) {
    const s = rand() * LOOP, u = 26 + rand() * 130
    if (fbm(s / 120, u / 120, 2, LOOP / 120) < 0.05) continue
    pointAt(s, u, 0, p)
    pos.push(p.x, terrainY(s, u) + 1.5, p.z)
    const c = rand() > 0.85 ? cool : warm
    const b = 0.6 + rand() * 0.8
    col.push(c.r * b, c.g * b, c.b * b)
  }
  const geo = new BufferGeometry()
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3))
  geo.setAttribute("color", new Float32BufferAttribute(col, 3))
  const mat = new PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })
  group.add(new Points(geo, mat))
  return mat
}

export function buildWorld() {
  const rand = rng(42)
  const group = new Group()
  const detail = groundDetail()
  const ground = new Mesh(terrain(), new MeshStandardMaterial({ vertexColors: true, map: detail, bumpMap: detail, bumpScale: 0.35, roughness: 0.97, metalness: 0 }))
  ground.receiveShadow = true
  group.add(ground, road())
  guardrail(group)
  const { lamps, lens } = streetlights(group)
  // One clock for the surf, wind and gulls; scene.ts drives it via foam.uniforms.uTime.
  const time = { value: 0 }
  palms(group, rand, time)
  shrubs(group, rand)
  const windows = hillLights(group, rand)
  const foam = surf(group, time)
  lamps.light(group, lens)
  // After the lamp hook, which replaces onBeforeCompile; sway chains onto it.
  const swaying = new Set<MeshStandardMaterial>()
  group.traverse(o => { const m = (o as Mesh).material; if (m instanceof MeshStandardMaterial && m.userData.sway) swaying.add(m) })
  swaying.forEach(m => sway(m, m.userData.sway as Sway, time))
  // Out over the water, beyond the lamp pools.
  group.add(gulls(time))
  group.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix() })
  return { group, lamps, windows, foam }
}
