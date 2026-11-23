import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Points, PointsMaterial, Vector2, Vector3 } from "three"
import { fbm, noise2, rng, smoothstep } from "./noise"
import { SEA } from "./path"

// The far coast: ranges running out to a headland ahead-left, each further
// one hazier and bluer, with a strip of town lights along the foot. It travels
// with the camera, so it sits at a fixed bearing like real distant terrain.

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

// Front range keeps its old silhouette (the town lights sit on its foot). The
// two behind it are laid out by bearing from the camera so they rise behind
// the low headland, stopping short of where the sun and moon go down.
type Range = { cols: number; rows: number; flip?: boolean; at: (u: number, r: number, out: number[]) => void }
const DEG = Math.PI / 180

// Each back range is one face rising to a jagged crest, so it reads as a
// single tone against the next; detail comes from the shader.
function backRange(from: number, to: number, near: number, deep: number, el: [number, number], seed: number): Range {
  const ridge = (x: number, k: number) => (1 - Math.abs(noise2(x, seed + k))) ** 2
  return {
    cols: 480, rows: 16, flip: true,
    at: (u, r, out) => {
      const a = (from + (to - from) * u) * DEG
      const d = near + r * deep + 600 * fbm(u * 6 + seed, 2.2, 2)
      const jag = 0.5 * ridge(u * 9, 0) + 0.3 * ridge(u * 23, 3) + 0.2 * ridge(u * 57, 7)
      const lift = 0.4 * smoothstep(-0.4, 0.5, fbm(u * 3 + seed, seed, 2)) + 0.6 * jag
      const crest = (near + deep / 2) * Math.tan((el[0] + (el[1] - el[0]) * lift) * DEG)
      const taper = Math.sin(Math.min(1, u / 0.06) * Math.PI / 2)
      const rise = 0.12 + 0.88 * smoothstep(0, 1, r) ** 0.8
      out.push(Math.sin(a) * d, SEA - 20 + taper * crest * (rise + 0.06 * fbm(u * 40 + seed, r * 4, 3)), -Math.cos(a) * d)
    },
  }
}

const ranges: Range[] = [
  {
    cols: 640, rows: 56,
    at: (t, r, out) => {
      const { p, n } = coastAt(t)
      const depth = 250 + r * (3200 + 900 * fbm(t * 3, 5.5, 2))
      const mass = (140 + 760 * smoothstep(0.0, 0.32, t)) * (0.7 + 0.45 * fbm(t * 5, 2.3, 3))
      const ridged = (1 - Math.abs(noise2(t * 22, r * 2.5 + 9.1))) ** 2 + 0.5 * (1 - Math.abs(noise2(t * 55, r * 4 + 3.3))) ** 2
      // Spurs: ridges running down to the sea, stretched across the range.
      const spurs = (1 - Math.abs(noise2(t * 90, r * 1.6 + 4.4))) ** 3
      const h = r === 0 ? SEA - 4 : mass * Math.sin(Math.min(1, r * 1.15) * Math.PI / 2) ** 0.9 * (0.7 + 0.4 * fbm(t * 14, r * 3, 4))
        + (ridged * 230 * r ** 1.4 + spurs * 110 * r ** 0.8) * smoothstep(0.0, 0.25, t)
      out.push(p.x + n.x * depth, h, p.y + n.y * depth)
    },
  },
  backRange(-24, 80, 7000, 2600, [3.2, 6.8], 11),
  backRange(-18, 80, 10500, 2500, [5.5, 9.5], 23),
]

function rangeGeometry() {
  const pos: number[] = [], idx: number[] = []
  for (const g of ranges) {
    const first = pos.length / 3
    for (let j = 0; j <= g.rows; j++) for (let i = 0; i <= g.cols; i++) g.at(i / g.cols, j / g.rows, pos)
    for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
      const a = first + j * (g.cols + 1) + i, b = a + g.cols + 1
      if (g.flip) idx.push(a, a + 1, b, b, a + 1, b + 1)
      else idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// Shared value noise; the hash stays stable at the multi-kilometre coordinates.
const NOISE = /* glsl */`
  float mHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec3 mNoised(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
    float a = mHash(i), b = mHash(i + vec2(1, 0)), c = mHash(i + vec2(0, 1)), d = mHash(i + vec2(1, 1));
    return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y, du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
  }
  float mNoise(vec2 p) { return mNoised(p).x; }`

const FRAG_HEAD = /* glsl */`
  uniform float uTime;
  uniform vec3 uSunDir, uSun;
  varying vec3 vObj, vObjN, vView;
  ${NOISE}
  // Eroded fbm: octaves fade where the slope is already steep, which carves
  // gullies between sharp ridges. Returns height and its gradient.
  vec3 mErode(vec2 p) {
    float v = 0.0, a = 0.5;
    vec2 d = vec2(0.0), g = vec2(0.0);
    mat2 q = mat2(1.0);
    const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      vec3 n = mNoised(p);
      d += n.yz;
      float w = a / (1.0 + dot(d, d));
      v += w * n.x;
      g += w * (transpose(q) * n.yz);
      p = m * p; q = m * q; a *= 0.5;
    }
    return vec3(v, g);
  }`

// Colour, detail normal and cloud shade, worked out once at the top of main().
const SURFACE = /* glsl */`
  float mDist = length(vView);
  vec3 mE = mErode(vObj.xz / 300.0 + 17.0);
  float mAmp = 110.0 * (1.0 - 0.6 * smoothstep(7000.0, 13000.0, mDist));
  vec3 mN = normalize(normalize(vObjN) - vec3(mE.y, 0.0, mE.z) * (mAmp / 300.0));
  float mSlope = 1.0 - mN.y;
  float mH = vObj.y - ${SEA.toFixed(1)};
  float mPatch = mNoise(vObj.xz / 700.0) * 0.6 + mNoise(vObj.xz / 190.0 + 5.0) * 0.4;
  // Coastal California: gold grass on sun-facing ridges, dark chaparral in
  // the gullies and on shaded faces, bare rock on the steeps and the tops.
  float mSunny = dot(mN.xz, normalize(vec2(0.83, -0.55)));
  float mVeg = smoothstep(0.32, 0.62, (0.5 - mE.x) * 1.4 + mPatch * 0.6 - mSunny * 0.8 + 0.2);
  vec3 mAlb = mix(vec3(0.36, 0.27, 0.11), vec3(0.055, 0.068, 0.03), mVeg);
  mAlb = mix(mAlb, vec3(0.2, 0.17, 0.14), smoothstep(0.42, 0.7, mSlope + mPatch * 0.15));
  mAlb = mix(mAlb, vec3(0.26, 0.23, 0.2), smoothstep(900.0, 1700.0, mH + mPatch * 300.0) * 0.7);
  // Cavity darkening: valleys hold shadow even under flat light.
  mAlb *= 0.6 + 0.8 * clamp(mE.x * 1.6, 0.0, 1.0);
  // Cloud shadows drifting across the range on the breeze.
  vec2 mCp = vObj.xz / 1500.0 + uTime * vec2(0.011, 0.005);
  float mCloud = 1.0 - 0.65 * smoothstep(0.52, 0.74, mNoise(mCp) * 0.65 + mNoise(mCp * 2.3 + 9.0) * 0.35);`

const FOG = /* glsl */`
  #ifdef USE_FOG
    // Aerial perspective on its own curve (the scene's exp2 fog would bury the
    // back ranges), bluer with distance, lit up looking towards the sun.
    vec3 mVd = vView / mDist;
    float mAir = 1.0 - exp(-mDist / 15000.0);
    vec3 mHaze = fogColor * mix(vec3(1.08), vec3(0.86, 0.98, 1.24), smoothstep(5000.0, 13000.0, mDist));
    float mMu = max(dot(mVd, uSunDir), 0.0);
    mHaze += uSun * (pow(mMu, 6.0) * 0.035 + pow(mMu, 48.0) * 0.1);
    // Low mist pooling in the gullies, drifting slowly.
    vec2 mMp = vObj.xz / 1100.0 + uTime * vec2(0.008, -0.003);
    float mMist = smoothstep(10.0, 90.0, mH) * exp(-max(mH - 90.0, 0.0) / 320.0) * smoothstep(0.5, 0.15, mE.x)
      * smoothstep(0.3, 0.75, mNoise(mMp) * 0.6 + mNoise(mMp * 2.7 + 3.1) * 0.4) * (1.0 - smoothstep(6500.0, 8500.0, mDist)) * 0.45;
    vec3 mMistC = mHaze * 1.04 + uSun * 0.025;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mHaze, mAir);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, mMistC, mMist * (1.0 - mAir * 0.6));
  #endif`

function rangeMaterial() {
  const uniforms = { uTime: { value: 0 }, uSunDir: { value: new Vector3(0, 1, 0) }, uSun: { value: new Color() } }
  const material = new MeshStandardMaterial({ roughness: 1, envMapIntensity: 0.5 })
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObj, vObjN, vView;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vObj = position; vObjN = normal;
        vView = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;`)
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
      .replace("#include <color_fragment>", `${SURFACE}\ndiffuseColor.rgb = mAlb;`)
      .replace("#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(mN, 0.0)).xyz);")
      // Matte at this range: grazing-angle sky specular turns the flat foot white.
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.directDiffuse *= mCloud;\nreflectedLight.directSpecular *= 0.0;\nreflectedLight.indirectSpecular *= 0.0;")
      .replace("#include <fog_fragment>", FOG)
  }
  material.customProgramCacheKey = () => "far-range"
  return { material, uniforms }
}

export function buildFar() {
  const group = new Group()
  const { material, uniforms } = rangeMaterial()
  const range = new Mesh(rangeGeometry(), material)
  range.frustumCulled = false
  group.add(range)

  // Town lights strung along the foot of the range.
  const rand = rng(9)
  const lp: number[] = [], lc: number[] = []
  const warm = new Color("#ffb46e"), white = new Color("#fff2dc"), cool = new Color("#bcd2ff"), c = new Color()
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

  // Called each frame with the light already set up for the hour.
  const update = (time: number, sunDir: Vector3, sunColour: Color, sunIntensity: number) => {
    uniforms.uTime.value = time
    uniforms.uSunDir.value.copy(sunDir)
    uniforms.uSun.value.copy(sunColour).multiplyScalar(sunIntensity)
  }
  return { group, lightMat, update }
}
