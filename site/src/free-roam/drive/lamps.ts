import { Color, MeshStandardMaterial, ShaderChunk, Vector3, type Object3D, type PointLight, type PointsMaterial, type WebGLProgramParametersWithUniforms } from "three"
import { rng, smoothstep } from "./noise"
import { LOOP, pointAt, roadY, tangent, terrainY } from "./path"

// Streetlights: where they stand, how each one switches on, and the analytic
// light pools they lay on the ground. Real point lights only light the car.

export const LAMP_SPACING = 48
export const LAMP_OFFSET = 10
export const LAMP_U = 7.6
export const LAMP_REACH = 3.1
export const LAMP_HEIGHT = 9.6
export const LAMP_COUNT = LOOP / LAMP_SPACING

// World position of streetlight k's lamp head (k may run past one loop).
export function lampHead(k: number, out = new Vector3()) {
  const s = LAMP_OFFSET + k * LAMP_SPACING
  return pointAt(s, LAMP_U - LAMP_REACH, terrainY(s, LAMP_U) - roadY(s) + LAMP_HEIGHT - 0.1, out)
}

// Pools are drawn for one lamp behind the car and six ahead; the end ones fade
// so the window can slide on by a lamp without anything popping.
const POOLS = 8
const POOL_NEAR = -2 * LAMP_SPACING, POOL_FAR = (POOLS - 2) * LAMP_SPACING
const POOL_CANDELA = 1500
const CAR_CANDELA = 300
// Seconds. Sodium takes a while to come up to colour and drops out quickly.
const WARM_UP = 2.8, COOL_DOWN = 0.8
const TIRED = [13, 37]
const STRIKE = new Color("#ff2a0c"), SODIUM = new Color("#ffa04a")

const lampIndex = (k: number) => ((k % LAMP_COUNT) + LAMP_COUNT) % LAMP_COUNT

// A tired lamp stutters for half a second every few seconds, then holds steady.
function stutter(t: number) {
  const p = t % 5.7
  if (p > 0.5) return 1
  return Math.sin(Math.floor(p * 18) * 12.9898) > 0.1 ? 1 : 0.3
}

const POINT_LOOP = "#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )"
if (!ShaderChunk.lights_fragment_begin.includes(POINT_LOOP)) throw new Error("lamps: three's lights_fragment_begin changed")
// The ground skips the point lights (they are placed for the car) and adds the
// pools instead: inverse square from each lamp head, cut off short of the
// horizon the way a cobra head's reflector does, so dark gaps fall between.
const POOL_LIGHTING = ShaderChunk.lights_fragment_begin.replace(POINT_LOOP, "#if 0") + /* glsl */`
  vec3 lampDown = ( viewMatrix * vec4( 0.0, - 1.0, 0.0, 0.0 ) ).xyz;
  for ( int i = 0; i < ${POOLS}; i ++ ) {
    vec3 toLamp = ( viewMatrix * vec4( uPoolPos[ i ], 1.0 ) ).xyz - geometryPosition;
    float d2 = dot( toLamp, toLamp );
    if ( d2 > 1600.0 ) continue;
    vec3 l = toLamp * inversesqrt( d2 );
    // Little light spills behind the pole, away from the road.
    float behind = dot( - toLamp, ( viewMatrix * vec4( uPoolSide[ i ], 0.0 ) ).xyz );
    float beam = smoothstep( 0.3, 0.66, dot( - l, lampDown ) ) * smoothstep( 1600.0, 900.0, d2 ) * ( 1.0 - 0.7 * smoothstep( 1.0, 7.0, behind ) );
    directLight.direction = l;
    directLight.color = uPoolCol[ i ] * ( beam / max( d2, 1.0 ) );
    RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  }
`
const GLOW_VERTEX = `#include <common>
attribute float aLamp;
uniform vec3 uLampGlow[ ${LAMP_COUNT} ];
varying vec3 vLamp;`

export function createLamps() {
  const rand = rng(19)
  // Each lamp's photocell trips at its own point in the dusk ramp.
  const threshold = Array.from({ length: LAMP_COUNT }, () => 0.08 + rand() * 0.75)
  const warm = new Float32Array(LAMP_COUNT)
  // Per lamp, linear rgb already scaled by brightness: 0 is off, SODIUM is full.
  const glow = Array.from({ length: LAMP_COUNT }, () => new Vector3())
  const uniforms = {
    uLampGlow: { value: glow },
    uPoolPos: { value: Array.from({ length: POOLS }, () => new Vector3()) },
    uPoolCol: { value: Array.from({ length: POOLS }, () => new Vector3()) },
    // Unit vector across the road towards the lamp's pole.
    uPoolSide: { value: Array.from({ length: POOLS }, () => new Vector3()) },
    uWet: { value: 0 },
  }
  const tint = new Color(), dir = { x: 0, z: 0 }
  let primed = false

  const glowing = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uLampGlow = uniforms.uLampGlow
    shader.vertexShader = shader.vertexShader.replace("#include <common>", GLOW_VERTEX)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLamp = uLampGlow[ int( aLamp ) ];")
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vLamp;")
  }

  return {
    // Lens emission follows its own lamp (geometry needs a per-lamp aLamp).
    lens(material: MeshStandardMaterial) {
      material.onBeforeCompile = shader => {
        glowing(shader)
        shader.fragmentShader = shader.fragmentShader.replace("vec3 totalEmissiveRadiance = emissive;", "vec3 totalEmissiveRadiance = emissive * vLamp;")
      }
    },
    halo(material: PointsMaterial) {
      material.onBeforeCompile = shader => {
        glowing(shader)
        // Faded up close, where the sprite would swamp the frame.
        shader.vertexShader = shader.vertexShader.replace("gl_PointSize = size;", "gl_PointSize = size;\nvLamp *= smoothstep( 8.0, 30.0, - mvPosition.z );")
        shader.fragmentShader = shader.fragmentShader.replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vLamp, opacity );")
      }
    },
    // Hooks every standard material under root into the pools. Materials with
    // userData.wet get a gloss at night so the lamps glint on them.
    light(root: Object3D, skip: MeshStandardMaterial) {
      root.traverse(o => {
        const m = (o as Object3D & { material?: unknown }).material
        if (!(m instanceof MeshStandardMaterial) || m === skip) return
        if (m.userData.wet) m.defines = { ...m.defines, LAMP_WET: "" }
        m.onBeforeCompile = shader => {
          shader.uniforms.uPoolPos = uniforms.uPoolPos
          shader.uniforms.uPoolCol = uniforms.uPoolCol
          shader.uniforms.uPoolSide = uniforms.uPoolSide
          shader.uniforms.uWet = uniforms.uWet
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>\nuniform vec3 uPoolPos[ ${POOLS} ];\nuniform vec3 uPoolCol[ ${POOLS} ];\nuniform vec3 uPoolSide[ ${POOLS} ];\nuniform float uWet;`)
            .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n#ifdef LAMP_WET\nroughnessFactor *= 1.0 - 0.3 * uWet;\n#endif")
            .replace("#include <lights_fragment_begin>", () => POOL_LIGHTING)
        }
      })
    },
    // progress is the day's lamp level (0 day, 1 night); dt and time in seconds.
    update(progress: number, dt: number, time: number) {
      for (let i = 0; i < LAMP_COUNT; i++) {
        const on = progress > threshold[i]
        warm[i] = !primed ? +on : on ? Math.min(1, warm[i] + dt / WARM_UP) : Math.max(0, warm[i] - dt / COOL_DOWN)
        const w = warm[i]
        // Strikes as a dim red glow, then climbs to full orange as it warms.
        let b = smoothstep(0, 0.04, w) * (0.06 + 0.94 * smoothstep(0.1, 1, w) ** 1.6)
        if (i === TIRED[0] || i === TIRED[1]) b *= stutter(time + i * 1.9)
        tint.copy(STRIKE).lerp(SODIUM, smoothstep(0.03, 0.7, w))
        glow[i].set(tint.r * b, tint.g * b, tint.b * b)
      }
      primed = true
      uniforms.uWet.value = progress
    },
    // Moves the pools and the car's lights along with the car at s.
    place(s: number, carLights: PointLight[]) {
      const first = Math.floor((s - LAMP_OFFSET) / LAMP_SPACING) - 1
      for (let j = 0; j < POOLS; j++) {
        const k = first + j
        const ds = LAMP_OFFSET + k * LAMP_SPACING - s
        lampHead(k, uniforms.uPoolPos.value[j])
        tangent(LAMP_OFFSET + k * LAMP_SPACING, dir)
        uniforms.uPoolSide.value[j].set(-dir.z, 0, dir.x)
        const fade = smoothstep(POOL_NEAR, POOL_NEAR + 36, ds) * smoothstep(POOL_FAR, POOL_FAR - LAMP_SPACING, ds)
        uniforms.uPoolCol.value[j].copy(glow[lampIndex(k)]).multiplyScalar(POOL_CANDELA * fade)
      }
      // The lamps either side of the nearest one are faded out by the time a
      // light hops from the lamp behind to the one ahead.
      const near = Math.round((s - LAMP_OFFSET) / LAMP_SPACING) - 1
      for (let i = 0; i < carLights.length; i++) {
        const k = near + i, light = carLights[i]
        const g = glow[lampIndex(k)]
        lampHead(k, light.position)
        light.color.setRGB(g.x, g.y, g.z)
        light.intensity = CAR_CANDELA * smoothstep(1.5 * LAMP_SPACING, 0.75 * LAMP_SPACING, Math.abs(LAMP_OFFSET + k * LAMP_SPACING - s))
      }
    },
  }
}
export type Lamps = ReturnType<typeof createLamps>
