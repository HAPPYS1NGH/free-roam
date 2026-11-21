import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from "three"

// The day: sun path, phase names, and the art-directed keyframes that the
// physical sky can't supply (fog, ambient, exposure, when the lamps come on).

export type Phase = "dawn" | "day" | "dusk" | "night"
export function phaseOf(hour: number): Phase {
  if (hour >= 4.8 && hour < 7.8) return "dawn"
  if (hour >= 7.8 && hour < 17.2) return "day"
  if (hour >= 17.2 && hour < 19.9) return "dusk"
  return "night"
}
export const PHASE_HOUR: Record<Phase, number> = { dawn: 6.35, day: 11, dusk: 18.5, night: 22.5 }

const DEG = Math.PI / 180
// Sunrise at 6:18, sunset at 18:36, 62° at noon.
const SUNRISE = 6.3, DAYLIGHT = 12.3, SUN_PEAK = 62
export const SOLAR_NOON = SUNRISE + DAYLIGHT / 2
// Sun rises behind-right of the car and sets ahead-left, over the sea.
// Azimuth is measured from forward (-z) towards the right (+x). `turn`
// (radians) swings it off the arc while someone holds the sun.
export function sunDirection(hour: number, out = new Vector3(), turn = 0) {
  const phi = ((hour - SUNRISE) / DAYLIGHT) * Math.PI
  const az = (146 - 179 * (phi / Math.PI)) * DEG + turn
  const el = SUN_PEAK * Math.sin(phi) * DEG
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
}
// The inverse: the hour the sun stands at `el` degrees, before or after noon.
// Past the peak it clamps to noon.
export function sunHour(el: number, afternoon: boolean) {
  const phi = Math.asin(Math.max(-1, Math.min(1, el / SUN_PEAK)))
  return (SUNRISE + (DAYLIGHT * (afternoon ? Math.PI - phi : phi)) / Math.PI + 24) % 24
}
// The moon hangs low over the water ahead so it lays a path on the sea, 4° to
// 11.5° up. `lift` (degrees) and `turn` (radians of azimuth) move it off that
// path when someone drags it.
export const MOON_TOP = 40
export const moonElevation = (hour: number) => 4 + 7.5 * Math.sin(Math.min(1, Math.max(0, ((hour - 19 + 24) % 24) / 10)) * Math.PI)
export function moonDirection(hour: number, out = new Vector3(), lift = 0, turn = 0) {
  const p = (((hour - 19 + 24) % 24) / 10)
  const az = (-34 + 30 * p) * DEG + turn
  const el = Math.min(MOON_TOP, moonElevation(hour) + lift) * DEG
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el))
}

// Linger on the golden hours, hurry through midday and the dead of night.
const weight = (h: number) => {
  const bump = (c: number, w: number) => Math.exp(-(((((h - c + 36) % 24) - 12) / w) ** 2))
  return 1 + 2.4 * bump(6.3, 1.2) + 2.8 * bump(18.6, 1.3) - 0.4 * bump(0, 3.5) - 0.45 * bump(12, 3)
}
const TOTAL = (() => { let t = 0; for (let h = 0; h < 24; h += 0.01) t += weight(h) * 0.01; return t })()
// Hours advanced per second for a full day in `cycleSeconds`.
export const hourRate = (hour: number, cycleSeconds: number) => TOTAL / (cycleSeconds * weight(hour))

type Key = {
  h: number; fog: string; sky: string; ground: string; hemi: number; sun: string; sunI: number; moonI: number
  exposure: number; lamps: number; stars: number; water: string; turbidity: number; rayleigh: number; bloom: number; fogD: number
}
const KEYS: Key[] = [
  { h: 0, fog: "#0a1120", sky: "#22314f", ground: "#06070a", hemi: 0.5, sun: "#ff8040", sunI: 0, moonI: 0.5, exposure: 1.05, lamps: 1, stars: 1, water: "#01040a", turbidity: 2, rayleigh: 1, bloom: 0.9, fogD: 1.4},
  { h: 4.6, fog: "#141c33", sky: "#2c3b66", ground: "#07080c", hemi: 0.55, sun: "#ff8040", sunI: 0, moonI: 0.35, exposure: 1.0, lamps: 1, stars: 0.8, water: "#020610", turbidity: 2, rayleigh: 1.2, bloom: 0.9, fogD: 1.5},
  { h: 5.5, fog: "#3d4064", sky: "#5a6292", ground: "#0e0d12", hemi: 0.6, sun: "#ff8a5a", sunI: 0, moonI: 0.1, exposure: 0.9, lamps: 1, stars: 0.25, water: "#060c1a", turbidity: 3, rayleigh: 2.2, bloom: 0.8, fogD: 1.8},
  { h: 6.4, fog: "#a2808a", sky: "#8d93c4", ground: "#2a2224", hemi: 0.7, sun: "#ff9e6c", sunI: 1.1, moonI: 0, exposure: 0.62, lamps: 0.55, stars: 0, water: "#0d1626", turbidity: 4, rayleigh: 2.6, bloom: 0.65, fogD: 1.6},
  { h: 7.5, fog: "#c4b4a4", sky: "#9fb2d8", ground: "#5a4a36", hemi: 0.75, sun: "#ffcc98", sunI: 2.3, moonI: 0, exposure: 0.6, lamps: 0, stars: 0, water: "#123447", turbidity: 3.5, rayleigh: 1.8, bloom: 0.25, fogD: 1.3},
  { h: 9.5, fog: "#aec4dc", sky: "#a2c0e6", ground: "#6e5c40", hemi: 0.75, sun: "#fff0da", sunI: 2.8, moonI: 0, exposure: 0.6, lamps: 0, stars: 0, water: "#0a4670", turbidity: 2.0, rayleigh: 1.2, bloom: 0.15, fogD: 1.1 },
  { h: 13, fog: "#a8c3df", sky: "#a6c4ea", ground: "#74613f", hemi: 0.65, sun: "#fff6e8", sunI: 2.9, moonI: 0, exposure: 0.58, lamps: 0, stars: 0, water: "#0a4a78", turbidity: 1.8, rayleigh: 1.1, bloom: 0.12, fogD: 1.1 },
  { h: 16.2, fog: "#c5c4ba", sky: "#a9bcd8", ground: "#76603e", hemi: 0.7, sun: "#ffe0b0", sunI: 2.7, moonI: 0, exposure: 0.58, lamps: 0, stars: 0, water: "#114664", turbidity: 2.4, rayleigh: 1.4, bloom: 0.18, fogD: 1.3 },
  { h: 17.8, fog: "#dcab7a", sky: "#b4a8b8", ground: "#6a4a2c", hemi: 0.65, sun: "#ffb466", sunI: 2.5, moonI: 0, exposure: 0.42, lamps: 0, stars: 0, water: "#1e2a33", turbidity: 3.6, rayleigh: 2.4, bloom: 0.3, fogD: 1.3},
  { h: 18.5, fog: "#d27a48", sky: "#9a7a98", ground: "#4a2c1c", hemi: 0.6, sun: "#ff8a3c", sunI: 1.5, moonI: 0, exposure: 0.5, lamps: 0.3, stars: 0, water: "#1c1a22", turbidity: 4.2, rayleigh: 3, bloom: 0.4, fogD: 1.5},
  { h: 19.05, fog: "#7c4c56", sky: "#5e5480", ground: "#1e1418", hemi: 0.55, sun: "#ff6a3a", sunI: 0.25, moonI: 0, exposure: 0.8, lamps: 1, stars: 0.05, water: "#100e18", turbidity: 5, rayleigh: 3, bloom: 0.85, fogD: 1.6},
  { h: 19.75, fog: "#2c2c48", sky: "#3c4270", ground: "#0c0b10", hemi: 0.55, sun: "#ff6a3a", sunI: 0, moonI: 0.2, exposure: 0.95, lamps: 1, stars: 0.4, water: "#050712", turbidity: 3, rayleigh: 2, bloom: 0.9, fogD: 1.6},
  { h: 20.9, fog: "#0e1626", sky: "#24335a", ground: "#06070a", hemi: 0.5, sun: "#ff6a3a", sunI: 0, moonI: 0.45, exposure: 1.05, lamps: 1, stars: 1, water: "#01040a", turbidity: 2, rayleigh: 1, bloom: 0.9, fogD: 1.4},
  { h: 24, fog: "#0a1120", sky: "#22314f", ground: "#06070a", hemi: 0.5, sun: "#ff8040", sunI: 0, moonI: 0.5, exposure: 1.05, lamps: 1, stars: 1, water: "#01040a", turbidity: 2, rayleigh: 1, bloom: 0.9, fogD: 1.4},
]
const parsed = KEYS.map(k => ({ ...k, fogC: new Color(k.fog), skyC: new Color(k.sky), groundC: new Color(k.ground), sunC: new Color(k.sun), waterC: new Color(k.water) }))

export type Light = {
  fog: Color; sky: Color; ground: Color; sun: Color; water: Color
  hemi: number; sunI: number; moonI: number; exposure: number; lamps: number; stars: number; turbidity: number; rayleigh: number; bloom: number; fogD: number
}
export function lightAt(hour: number, out: Light) {
  const h = ((hour % 24) + 24) % 24
  let i = 1
  while (parsed[i].h < h) i++
  const a = parsed[i - 1], b = parsed[i]
  const t = (h - a.h) / (b.h - a.h)
  const mix = (x: number, y: number) => x + (y - x) * t
  out.fog.copy(a.fogC).lerp(b.fogC, t)
  out.sky.copy(a.skyC).lerp(b.skyC, t)
  out.ground.copy(a.groundC).lerp(b.groundC, t)
  out.sun.copy(a.sunC).lerp(b.sunC, t)
  out.water.copy(a.waterC).lerp(b.waterC, t)
  out.hemi = mix(a.hemi, b.hemi); out.sunI = mix(a.sunI, b.sunI); out.moonI = mix(a.moonI, b.moonI)
  out.exposure = mix(a.exposure, b.exposure); out.lamps = mix(a.lamps, b.lamps); out.stars = mix(a.stars, b.stars)
  out.turbidity = mix(a.turbidity, b.turbidity); out.rayleigh = mix(a.rayleigh, b.rayleigh); out.bloom = mix(a.bloom, b.bloom)
  out.fogD = mix(a.fogD, b.fogD)
  return out
}
export const newLight = (): Light => ({
  fog: new Color(), sky: new Color(), ground: new Color(), sun: new Color(), water: new Color(),
  hemi: 0, sunI: 0, moonI: 0, exposure: 1, lamps: 0, stars: 0, turbidity: 2, rayleigh: 1, bloom: 0.5, fogD: 2,
})

// Night sky under the additive daylight sky: gradient, city glow, stars, moon.
export function nightDome() {
  const material = new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false,
    uniforms: {
      uNight: { value: 1 }, uStars: { value: 1 }, uTime: { value: 0 },
      uZenith: { value: new Color("#050a18") }, uHorizon: { value: new Color("#1a2340") },
      uGlow: { value: new Color("#ff9a5a") }, uGlowDir: { value: new Vector3(0.45, 0, -0.9).normalize() },
      uMoonDir: { value: new Vector3(0, 0.2, -1).normalize() }, uMoon: { value: 1 },
      uSunDir: { value: new Vector3(0, -0.1, -1).normalize() }, uTwilight: { value: 0 }, uTwiColor: { value: new Color("#ff7a3a") },
      // Hover affordance for dragging the sun or moon (sky-drag.ts).
      uGrab: { value: 0 }, uGrabMoon: { value: 0 }, uGrabDir: { value: new Vector3(0, 0.1, -1).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uNight, uStars, uTime, uMoon, uGrab, uGrabMoon;
      uniform vec3 uZenith, uHorizon, uGlow, uGlowDir, uMoonDir, uSunDir, uTwiColor, uGrabDir;
      uniform float uTwilight;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(clamp(h / 0.32, 0.0, 1.0), 0.65)) * uNight;
        vec3 flat_ = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
        col += uGlow * pow(max(dot(flat_, uGlowDir), 0.0), 4.0) * exp(-h * 18.0) * 0.06 * uNight;
        // Afterglow: the sky still lit on the side the sun went down.
        vec3 sunFlat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-5);
        float toward = max(dot(flat_, sunFlat), 0.0);
        float band = exp(-h * mix(9.0, 4.0, toward));
        col += uTwiColor * uTwilight * band * (0.12 + 0.88 * pow(toward, 3.0));
        col += uTwiColor * uTwilight * 0.25 * exp(-h * 2.5) * vec3(0.5, 0.45, 0.8);
        vec3 p = d * 380.0;
        vec3 cell = floor(p);
        float r = hash(cell);
        if (r > 0.982) {
          vec3 c = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 5.1)) - 0.5) * 0.5;
          float star = smoothstep(0.45, 0.0, length(p - c)) * pow((r - 0.982) / 0.018, 1.3);
          float twinkle = 0.75 + 0.25 * sin(uTime * (2.0 + r * 9.0) + r * 80.0);
          col += vec3(0.9, 0.95, 1.0) * star * twinkle * uStars * smoothstep(0.0, 0.08, d.y) * 1.6;
        }
        float md = dot(d, uMoonDir);
        // 1 - cos grows with the square of the angle, so this scales the disc.
        float ms = 1.0 + 0.14 * uGrab * uGrabMoon;
        float disc = smoothstep(1.0 - 0.00012 * ms * ms, 1.0 - 0.00007 * ms * ms, md);
        col += vec3(1.0, 0.96, 0.88) * disc * 2.4 * uMoon;
        col += vec3(0.55, 0.65, 0.85) * (pow(max(md, 0.0), 900.0) * 0.5 + pow(max(md, 0.0), 40.0) * 0.03) * uMoon;
        // A soft halo and a faint ring a little wider than the disc.
        float ga = sqrt(2.0 * max(1.0 - dot(d, uGrabDir), 0.0));
        vec3 gc = mix(vec3(1.0, 0.78, 0.55), vec3(0.75, 0.84, 1.0), uGrabMoon);
        // Daylight is added on top of this, so the sun's halo needs more to show.
        float gk = uGrab * (1.0 + 3.0 * (1.0 - uGrabMoon) * (1.0 - uNight));
        col += gc * gk * (exp(-ga * 70.0) * 0.22 + (1.0 - smoothstep(0.0, 0.003, abs(ga - 0.034))) * 0.16);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  const mesh = new Mesh(new SphereGeometry(1, 48, 24), material)
  mesh.renderOrder = -2
  mesh.frustumCulled = false
  return mesh
}
