import type { Material } from "three"

// Onshore breeze from the sea (-x) into the hills, with gust fronts that roll
// through the trees along the wind. All motion is in the vertex shader off one
// shared time uniform, so it costs nothing on the CPU.

export type Sway = "trunk" | "frond" | "shrub"

const GLSL = /* glsl */`
  uniform float uTime;
  vec3 windAt(vec3 base) {
    vec2 dir = normalize(vec2(1.0, 0.3));
    float along = dot(base.xz, dir) * 0.045;
    float gust = 0.5 + 0.3 * sin(uTime * 0.9 - along) + 0.2 * sin(uTime * 0.37 - along * 0.6 + base.z * 0.01);
    return vec3(dir.x, gust, dir.y);
  }
  // World offset -> instance-local, exact for rotation * axis-scale matrices.
  vec3 toLocal(vec3 w) {
    mat3 m = mat3(instanceMatrix);
    return (transpose(m) * w) / vec3(dot(m[0], m[0]), dot(m[1], m[1]), dot(m[2], m[2]));
  }`

const BODY: Record<Sway, string> = {
  // Trunks bend like a cantilever; the crown rides the tip of the same curve.
  trunk: /* glsl */`
    vec3 w = windAt(base);
    float bend = pow(max(transformed.y, 0.0) / 17.0, 2.0);
    float sway = 0.22 + 0.5 * w.y + 0.1 * sin(uTime * 1.3 + seed * 6.28);
    transformed += toLocal(vec3(w.x, 0.0, w.z) * sway * bend);`,
  // uv.y runs base to tip along each frond, so tips stream and flutter.
  frond: /* glsl */`
    vec3 w = windAt(base);
    float bend = pow(max(transformed.y, 0.0) / 17.0, 2.0);
    float sway = 0.22 + 0.5 * w.y + 0.1 * sin(uTime * 1.3 + seed * 6.28);
    float tip = uv.y * uv.y;
    float flutter = sin(uTime * (3.2 + seed) + position.x * 1.7 + position.z * 1.3) * (0.15 + 0.35 * w.y);
    vec3 off = vec3(w.x, 0.0, w.z) * (sway * bend + tip * 0.45 * w.y) + vec3(0.0, flutter * tip * 0.5, 0.0);
    transformed += toLocal(off);`,
  shrub: /* glsl */`
    vec3 w = windAt(base);
    float h = max(transformed.y, 0.0);
    float sway = (0.3 + w.y) * (0.6 + 0.4 * sin(uTime * 2.1 + seed * 6.28 + h * 2.0));
    transformed += toLocal(vec3(w.x, 0.0, w.z) * sway * h * h * 0.07);`,
}

// Chains onto any onBeforeCompile already set (the lamp pools hook every
// standard material), so call it after those.
export function sway<M extends Material>(material: M, kind: Sway, time: { value: number }) {
  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer)
    shader.uniforms.uTime = time
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n#ifdef USE_INSTANCING\n${GLSL}\n#endif`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 base = instanceMatrix[3].xyz;
          float seed = fract(sin(dot(base.xz, vec2(12.9898, 78.233))) * 43758.5453);
          ${BODY[kind]}
        #endif`)
  }
  material.customProgramCacheKey = () => `sway-${kind}`
  return material
}
