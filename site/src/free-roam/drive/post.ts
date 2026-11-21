import { HalfFloatType, ShaderMaterial, Vector2, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from "three"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js"

// Film finish after tone mapping: gentle lens fringing, vignette, grain.
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new Vector2(1, 1) }, uGrain: { value: 0.05 }, uVignette: { value: 0.32 },
    uCar: { value: new Vector2(0.75, 0.3) }, uBlur: { value: 1 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVignette, uBlur; uniform vec2 uRes, uCar; varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 c = vUv - 0.5;
      vec2 shift = c * dot(c, c) * 0.006;
      vec3 col = vec3(texture2D(tDiffuse, vUv + shift).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - shift).b);
      // Speed: the near road and verges streak away from the vanishing point,
      // the car (moving with the camera) stays sharp.
      vec2 vp = vec2(uCar.x - 0.12, uCar.y + 0.22);
      vec2 away = vUv - vp;
      vec2 carD = (vUv - uCar) * vec2(uRes.x / uRes.y, 1.0);
      float mask = smoothstep(0.13, 0.24, length(carD * vec2(0.62, 1.0) + vec2(0.0, 0.035)));
      float amount = uBlur * mask * smoothstep(0.12, 0.6, length(away * vec2(1.0, 1.6))) * smoothstep(vp.y, vp.y - 0.25, vUv.y + 0.1);
      if (amount > 0.002) {
        vec3 acc = col;
        for (int i = 1; i <= 6; i++) acc += texture2D(tDiffuse, vUv - away * float(i) * 0.006 * amount).rgb;
        col = acc / 7.0;
      }
      float v = smoothstep(0.9, 0.2, length(c * vec2(1.0, 0.8)));
      col *= mix(1.0 - uVignette, 1.0, v);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      float n = hash(vUv * uRes + fract(uTime * 7.13) * 431.0) - 0.5;
      col += n * uGrain * (1.0 - lum * 0.6);
      gl_FragColor = vec4(col, 1.0);
    }`,
}

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.6, 0.55, 0.92)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const film = new ShaderPass(new ShaderMaterial(FilmShader))
  composer.addPass(film)
  return {
    composer, bloom,
    setSize(w: number, h: number, dpr: number) {
      composer.setPixelRatio(dpr)
      composer.setSize(w, h)
      bloom.resolution.set(w * dpr / 2, h * dpr / 2)
      film.uniforms.uRes.value.set(w * dpr, h * dpr)
    },
    render(time: number, carX: number, carY: number, blur: number) {
      film.uniforms.uTime.value = time
      film.uniforms.uCar.value.set(carX, carY)
      film.uniforms.uBlur.value = blur
      composer.render()
    },
    dispose() { composer.dispose(); target.dispose() },
  }
}
