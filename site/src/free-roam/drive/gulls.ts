import { BufferGeometry, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Vector3 } from "three"
import { LOOP, SEA, pointAt } from "./path"

// A few small flocks of gulls wheeling over the water, flapping in bursts and
// gliding between. The whole flight path lives in the vertex shader.

function gullGeometry() {
  // Half-span 0.65 m: root, elbow (raised), tip (dropped) for the gull's M.
  const half = [[0.06, 0, 0.12], [0.06, 0, -0.14], [0.33, 0.06, 0.02], [0.3, 0.05, -0.12], [0.66, -0.04, -0.2]]
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const light = [0.82, 0.82, 0.8], dark = [0.16, 0.16, 0.17]
  for (const side of [1, -1]) {
    const first = pos.length / 3
    half.forEach(([x, y, z], i) => {
      pos.push(x * side, y, z)
      col.push(...(i === 4 ? dark : light))
    })
    const tris = [[0, 2, 1], [1, 2, 3], [2, 4, 3]]
    tris.forEach(([a, b, c]) => idx.push(first + a, first + (side > 0 ? b : c), first + (side > 0 ? c : b)))
  }
  // Body: a thin spindle from beak to tail.
  const first = pos.length / 3
  pos.push(0, 0.02, 0.32, 0.07, 0, 0, -0.07, 0, 0, 0, 0.01, -0.3)
  col.push(...light, ...light, ...light, ...light)
  idx.push(first, first + 1, first + 2, first + 2, first + 1, first + 3)
  const geo = new BufferGeometry()
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3))
  geo.setAttribute("normal", new Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  geo.setAttribute("color", new Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  return geo
}

const MOTION = /* glsl */`
  float ga = aOrbit.z + uTime * aOrbit.y;
  float gR = aOrbit.x;
  vec3 gC = vec3(cos(ga) * gR, sin(ga * 2.0 + aOrbit.z) * 1.5, sin(ga) * gR * 0.55);
  vec3 gFwd = normalize(vec3(-sin(ga), 0.0, cos(ga) * 0.55) * sign(aOrbit.y));
  vec3 gSide = vec3(-gFwd.z, 0.0, gFwd.x);
  // A few beats, then a long glide.
  float gGate = smoothstep(0.25, 0.75, sin(uTime * 0.45 + aOrbit.w));
  float gBeat = uTime * 7.0 + aOrbit.w * 9.0;
  float gSpan = abs(position.x);
  vec3 gP = position;
  gP.y += (gSpan * 0.7 * sin(gBeat) + max(gSpan - 0.3, 0.0) * 0.8 * sin(gBeat - 0.9)) * gGate;
  // Bank into the turn.
  float gBank = 0.3 * sign(aOrbit.y);
  gP.xy = mat2(cos(gBank), sin(gBank), -sin(gBank), cos(gBank)) * gP.xy;
  // A touch over life size so they read at a few pixels.
  vec3 transformed = aCentre + gC + (gSide * gP.x + vec3(0.0, gP.y, 0.0) + gFwd * gP.z) * 1.3;`

export function gulls(time: { value: number }) {
  const centres: number[] = [], orbits: number[] = []
  const p = new Vector3()
  let seed = 3
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let flock = 0; flock < 8; flock++) {
    const s = (flock + rand() * 0.6) * (LOOP / 8)
    pointAt(s, -45 - rand() * 70, 0, p)
    const size = 2 + Math.floor(rand() * 4)
    for (let k = 0; k < size; k++) {
      centres.push(p.x + (rand() - 0.5) * 30, SEA + 6 + rand() * 14, p.z + (rand() - 0.5) * 30)
      orbits.push(14 + rand() * 22, (rand() > 0.3 ? 1 : -1) * (0.25 + rand() * 0.2), rand() * 6.28, rand() * 6.28)
    }
  }
  const geo = gullGeometry()
  geo.setAttribute("aCentre", new InstancedBufferAttribute(new Float32Array(centres), 3))
  geo.setAttribute("aOrbit", new InstancedBufferAttribute(new Float32Array(orbits), 4))
  const material = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.9 })
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = time
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nattribute vec3 aCentre;\nattribute vec4 aOrbit;")
      .replace("#include <begin_vertex>", MOTION)
  }
  material.customProgramCacheKey = () => "gulls"
  const mesh = new InstancedMesh(geo, material, orbits.length / 4)
  // Instance matrices stay identity; the shader places each bird.
  mesh.frustumCulled = false
  return mesh
}
