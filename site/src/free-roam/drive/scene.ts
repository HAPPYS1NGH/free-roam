import {
  ACESFilmicToneMapping, AdditiveBlending, CircleGeometry, Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, MeshBasicMaterial,
  PCFShadowMap, PMREMGenerator, PerspectiveCamera, PointLight, Scene, Vector3, WebGLRenderer, type Material,
  type ShaderMaterial, type WebGLRenderTarget,
} from "three"
import { Sky } from "three/addons/objects/Sky.js"
import { Water } from "three/addons/objects/Water.js"
import { buildCar, type Paint } from "./car"
import { hourRate, lightAt, moonDirection, newLight, nightDome, sunDirection } from "./daylight"
import { buildFar } from "./far"
import { LANE_U, LOOP, SEA, curvature, pointAt, roadY, tangent } from "./path"
import { createRig, speedAt } from "./camera"
import { createPost } from "./post"
import { skyDrag } from "./sky-drag"
import { smoothstep } from "./noise"
import { waterNormals } from "./textures"
import { buildWorld } from "./world"

export type DriveOptions = {
  paint: Paint
  cycleSeconds: number
  // null runs the day/night cycle; a number eases the clock to that hour and holds.
  lockHour: number | null
  // Playback multiplier from the harness speed dial.
  speed: number
  // Reduced motion: the car stays parked and the clock does not run.
  still: boolean
}
export type Drive = { setOptions(next: Partial<DriveOptions>): void; dispose(): void }

// `grabArea` is the element that catches drags on the sun and moon; without it the sky is hands-off.
export function createDrive(container: HTMLElement, initial: DriveOptions, startHour: number, onHour: (hour: number) => void, grabArea?: HTMLElement): Drive {
  const opts = { ...initial }
  const canvas = document.createElement("canvas")
  canvas.className = "drive-canvas"
  container.appendChild(canvas)

  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap

  const scene = new Scene()
  const fog = new FogExp2(0x000000, 0.0002)
  scene.fog = fog
  const camera = new PerspectiveCamera(38, 1, 0.3, 30000)

  // Sky: Preetham daylight added over a hand-built night dome.
  const sky = new Sky()
  sky.scale.setScalar(20000)
  sky.renderOrder = -1
  sky.frustumCulled = false
  const skyMat = sky.material as ShaderMaterial
  skyMat.blending = AdditiveBlending
  const su = skyMat.uniforms
  su.mieCoefficient.value = 0.0022
  su.mieDirectionalG.value = 0.86
  su.cloudCoverage.value = 0.32
  su.cloudDensity.value = 0.3
  su.cloudElevation.value = 0.75
  su.cloudScale.value = 0.00016
  const dome = nightDome()
  dome.scale.setScalar(15000)
  const domeMat = dome.material as ShaderMaterial
  scene.add(dome, sky)

  // Environment for reflections: the same sky over a ground disc.
  const envScene = new Scene()
  const envSky = new Mesh(sky.geometry, skyMat)
  envSky.scale.setScalar(100)
  envSky.renderOrder = -1
  const envDome = new Mesh(dome.geometry, domeMat)
  envDome.scale.setScalar(90)
  envDome.renderOrder = -2
  const envGroundMat = new MeshBasicMaterial({ color: "#222" })
  const envGround = new Mesh(new CircleGeometry(400, 32).rotateX(-Math.PI / 2), envGroundMat)
  envGround.position.y = -4
  envScene.add(envDome, envSky, envGround)
  const pmrem = new PMREMGenerator(renderer)
  let envTarget: WebGLRenderTarget | null = null

  const hemi = new HemisphereLight()
  const sun = new DirectionalLight()
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 700 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.04
  const moon = new DirectionalLight("#9fb6e0")
  scene.add(hemi, sun, sun.target, moon, moon.target)

  const water = new Water(new CircleGeometry(11000, 96), {
    textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: new Vector3(), sunColor: 0xffffff,
    waterColor: 0x0c3d58, distortionScale: 2.4, fog: true,
  })
  water.rotation.x = -Math.PI / 2
  water.position.y = SEA
  water.material.uniforms.size.value = 3
  scene.add(water)

  const world = buildWorld()
  const worldB = world.group.clone()
  worldB.position.z = -LOOP
  worldB.updateMatrix()
  scene.add(world.group, worldB)

  const far = buildFar()
  scene.add(far.group)

  const car = buildCar(opts.paint)
  car.root.rotation.order = "YXZ"
  scene.add(car.root)

  // The three streetlights nearest the car light it as it passes (the ground
  // has its own lamp pools); each fades out before it hops to the next lamp.
  const lampLights = [0, 1, 2].map(() => new PointLight("#ffa04a", 0, 80, 2))
  scene.add(...lampLights)

  const post = createPost(renderer, scene, camera)

  // ------------------------------------------------------------ sizing
  let width = 1, height = 1
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const resize = () => {
    width = Math.max(1, container.clientWidth)
    height = Math.max(1, container.clientHeight)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    post.setSize(width, height, dpr)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const sizeObserver = new ResizeObserver(resize)
  sizeObserver.observe(container)
  resize()

  // ------------------------------------------------------------ frame
  const L = newLight()
  const carScreen = new Vector3()
  const rig = createRig(camera)
  const sunDir = new Vector3(), moonDir = new Vector3(), carPos = new Vector3(), camPos = new Vector3()
  const moonColour = new Color("#8da6d6"), waterSun = new Color(), tint = new Color()
  const tan = { x: 0, z: 0 }
  let s = 160, v = speedAt(s), accel = 0, blur = 0
  let hour = startHour
  // Degrees the moon was dragged off its path; `resume` ramps the clock back up after a drag.
  let moonLift = 0, resume = 1
  const drag = grabArea ? skyDrag(grabArea, canvas, camera, domeMat, () => !opts.still) : null
  let simTime = 0, spin = 0
  let envHour = -99, envAge = 99, hourAge = 99
  let last = performance.now(), frameAvg = 16, frames = 0
  let raf = 0, visible = true, onScreen = true

  const updateLight = (dt: number) => {
    lightAt(hour, L)
    sunDirection(hour, sunDir, drag?.turn.sun)
    moonDirection(hour, moonDir, moonLift, drag?.turn.moon)
    const day = smoothstep(-0.03, 0.05, sunDir.y)

    su.sunPosition.value.copy(sunDir)
    su.turbidity.value = L.turbidity
    su.rayleigh.value = L.rayleigh
    su.time.value = simTime
    domeMat.uniforms.uNight.value = 1 - smoothstep(-0.02, 0.12, sunDir.y)
    domeMat.uniforms.uHorizon.value.copy(L.fog).multiplyScalar(1.6)
    domeMat.uniforms.uZenith.value.copy(L.sky).multiplyScalar(0.45)
    domeMat.uniforms.uSunDir.value.copy(sunDir)
    // Strongest just after the sun drops, gone by full night.
    domeMat.uniforms.uTwilight.value = smoothstep(-0.2, -0.03, sunDir.y) * (1 - smoothstep(0.0, 0.08, sunDir.y)) * 0.55
    domeMat.uniforms.uTwiColor.value.copy(L.sun)
    domeMat.uniforms.uStars.value = L.stars
    domeMat.uniforms.uMoon.value = Math.min(1, L.moonI * 2.5)
    domeMat.uniforms.uMoonDir.value.copy(moonDir)
    domeMat.uniforms.uTime.value = simTime

    fog.color.copy(L.fog)
    fog.density = L.fogD * 1e-4
    hemi.color.copy(L.sky)
    hemi.groundColor.copy(L.ground)
    hemi.intensity = L.hemi
    sun.color.copy(L.sun)
    sun.intensity = L.sunI * day
    moon.intensity = L.moonI
    renderer.toneMappingExposure = L.exposure
    post.bloom.strength = L.bloom
    // Threshold in display terms, so lamps bloom. Once the sun is well up the
    // sky itself runs past that (and the sun's halo far past it), which veiled
    // the whole frame: lift the threshold over the sky and cap the hot spots.
    const sunHigh = smoothstep(0.1, 0.3, sunDir.y)
    post.bloom.threshold = (3.2 + 9.6 * sunHigh) / L.exposure
    post.bloomCap.value = 2 + 400 * (1 - sunHigh)

    const wu = water.material.uniforms
    const sunUp = sunDir.y > -0.02
    wu.sunDirection.value.copy(sunUp ? sunDir : moonDir)
    wu.sunColor.value.copy(sunUp ? waterSun.copy(L.sun).multiplyScalar(0.4 + 0.6 * day) : waterSun.copy(moonColour).multiplyScalar(L.moonI * 1.6))
    wu.waterColor.value.copy(L.water)
    wu.time.value += dt * 0.5

    world.lamps.update(L.lamps, dt, simTime)
    world.windows.opacity = L.lamps
    far.lightMat.opacity = L.lamps
    far.update(simTime, sunDir, sun.color, sun.intensity)
    car.setLights(Math.min(1, L.lamps * 1.15))
    envGroundMat.color.copy(L.ground).multiplyScalar(0.5)
    // Foam is lit like a white diffuse surface: sun plus sky, a touch of moon.
    world.foam.uniforms.uTime.value = simTime
    const foamLight: Color = world.foam.uniforms.uLight.value
    foamLight.copy(L.sun).multiplyScalar(sun.intensity * 0.22 * Math.max(0, sunDir.y))
      .add(tint.copy(L.sky).multiplyScalar(L.hemi * 0.55)).add(tint.copy(moonColour).multiplyScalar(L.moonI * 0.25))
  }

  const updateEnv = () => {
    if (Math.abs(hour - envHour) < 0.1 || envAge < 0.35) return
    envHour = hour
    envAge = 0
    // The sun disc is far too hot for image lighting; the sun light covers it.
    su.showSunDisc.value = 0
    const next = pmrem.fromScene(envScene, 0, 0.1, 1000)
    su.showSunDisc.value = 1
    scene.environment = next.texture
    envTarget?.dispose()
    envTarget = next
  }

  const place = (dt: number) => {
    tangent(s, tan)
    pointAt(s, LANE_U, 0.04, carPos)
    car.root.position.copy(carPos)
    car.root.rotation.y = Math.atan2(tan.x, tan.z)
    car.root.rotation.x = -Math.atan(roadY(s + 1) - roadY(s - 1)) / 2
    const lateral = opts.still ? 0 : v * v * curvature(s)
    car.body.rotation.z += (lateral * 0.011 - car.body.rotation.z) * Math.min(1, dt * 4)
    // Squats under power, dips its nose as it lifts.
    car.body.rotation.x = -accel * 0.004
    car.body.position.y = opts.still ? 0 : 0.005 * Math.sin(simTime * 11) + 0.003 * Math.sin(simTime * 17.3 + 1)
    car.wheels.forEach(w => { w.rotation.x = spin })

    blur = rig.update(dt, s, v * opts.speed, accel, opts.still, carPos, tan, width, height)
    camPos.copy(camera.position)

    far.group.position.set(camPos.x, 0, camPos.z)
    dome.position.copy(camPos)
    sky.position.copy(camPos)
    water.position.x = camPos.x
    water.position.z = camPos.z

    // Sun shadows cover the stretch of road around the car.
    sun.target.position.set(carPos.x + tan.x * 18, carPos.y, carPos.z + tan.z * 18)
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 300)
    moon.target.position.copy(carPos)
    moon.position.copy(carPos).addScaledVector(moonDir, 300)

    world.lamps.place(s, lampLights)
  }

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame)
    const real = Math.min(0.05, (now - last) / 1000)
    last = now
    const dt = real * opts.speed
    simTime += dt
    envAge += real
    hourAge += real

    if (opts.still) { v = 0; accel = 0 } else {
      // Pulls away gently after a reduced-motion pause; otherwise tracks the baked profile.
      const dv = Math.max(-6 * dt, Math.min(5 * dt, speedAt(s) - v))
      v += dv
      if (dt > 0) accel += (dv / dt - accel) * Math.min(1, dt * 3)
      s += v * dt
      spin += (v * dt) / car.wheelRadius
      if (s > LOOP + 200) s -= LOOP
    }
    const held = drag?.scrub(real, hour, moonLift)
    if (held) {
      hour = held.hour
      moonLift = held.lift
      resume = 0
    } else if (opts.lockHour === null) {
      resume = Math.min(1, resume + real / 1.5)
      if (!opts.still) hour = (hour + hourRate(hour, opts.cycleSeconds) * dt * resume) % 24
    } else {
      const d = ((opts.lockHour - hour + 36) % 24) - 12
      hour = (hour + d * Math.min(1, dt * 1.6) + 24) % 24
    }
    updateLight(dt)
    place(dt)
    updateEnv()
    // A dragged moon goes back on its path while it's out of sight.
    if (!held && L.moonI === 0) moonLift = 0
    drag?.track(real, sunDir, moonDir, sunDir.y > -0.015, L.moonI > 0.06 && moonDir.y > 0.005)
    carScreen.copy(carPos).setY(carPos.y + 0.6).project(camera)
    post.render(simTime, carScreen.x * 0.5 + 0.5, carScreen.y * 0.5 + 0.5, rig.vp.x, rig.vp.y, blur)
    if (hourAge > 0.25) { hourAge = 0; onHour(hour) }

    // Drop resolution if the machine can't keep up.
    frameAvg = frameAvg * 0.95 + real * 1000 * 0.05
    if (++frames > 90 && frameAvg > 26 && dpr > 0.75) { dpr -= 0.25; frames = 0; resize() }
  }

  const sync = () => {
    const run = visible && onScreen
    if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame) }
    if (!run && raf) { cancelAnimationFrame(raf); raf = 0 }
  }
  const onVisibility = () => { visible = !document.hidden; sync() }
  document.addEventListener("visibilitychange", onVisibility)
  const viewObserver = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() })
  viewObserver.observe(container)
  sync()

  return {
    setOptions(next) {
      if (next.paint && next.paint !== opts.paint) car.setPaint(next.paint)
      Object.assign(opts, next)
    },
    dispose() {
      cancelAnimationFrame(raf)
      raf = 0
      document.removeEventListener("visibilitychange", onVisibility)
      viewObserver.disconnect()
      sizeObserver.disconnect()
      const materials = new Set<Material>()
      scene.traverse(o => {
        const mesh = o as Mesh
        mesh.geometry?.dispose()
        const m = mesh.material
        if (Array.isArray(m)) m.forEach(x => materials.add(x))
        else if (m) materials.add(m)
      })
      materials.forEach(m => {
        Object.values(m).forEach(v => { if (v && typeof v === "object" && "isTexture" in v) (v as { dispose(): void }).dispose() })
        m.dispose()
      })
      water.material.uniforms.normalSampler.value?.dispose()
      envTarget?.dispose()
      pmrem.dispose()
      post.dispose()
      drag?.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
