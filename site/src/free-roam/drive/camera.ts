import { Vector3, type PerspectiveCamera } from "three"
import { LANE_U, LOOP, curvature, pointAt, type Dir } from "./path"
import { smoothstep } from "./noise"

const DEG = Math.PI / 180
export const MEAN_SPEED = 27 // m/s, about 60 mph

// Speed along the loop, baked once per metre: it builds into the bends (the
// window looks ~55 m ahead), holds through them and eases off on the straights,
// rate-limited like a real car. Scaled so a lap takes as long as a steady 27 m/s,
// which keeps the world's pacing; the result runs roughly 20 to 38 m/s.
const profile = (() => {
  const bend = new Float32Array(LOOP), want = new Float32Array(LOOP), v = new Float32Array(LOOP)
  for (let i = 0; i < LOOP; i++) bend[i] = Math.abs(curvature(i))
  for (let i = 0; i < LOOP; i++) {
    let sum = 0
    for (let j = -15; j <= 55; j++) sum += bend[(i + j + LOOP) % LOOP]
    want[i] = 19 + 19 * smoothstep(0.0005, 0.0019, sum / 71)
  }
  // Stepping per metre, a change of a/c per step is a m/s² at c m/s. Two laps so the seam joins.
  let c = want[0], lap = 0
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < LOOP; i++) {
    c += Math.max(-2.6, Math.min(4, (want[i] - c) * 0.9)) / c
    v[i] = c
  }
  for (let i = 0; i < LOOP; i++) lap += 1 / v[i]
  const scale = (MEAN_SPEED * lap) / LOOP
  for (let i = 0; i < LOOP; i++) v[i] *= scale
  return v
})()

export function speedAt(s: number) {
  const x = ((s % LOOP) + LOOP) % LOOP, i = Math.floor(x), f = x - i
  return profile[i] + (profile[(i + 1) % LOOP] - profile[i]) * f
}

// A framing around the car. az is degrees from dead behind, positive toward the
// sea, so every move swings out over the bluff rather than through the hillside.
// fx and fy place the car across the frame and down the visible hero: right and
// low, clear of the headline copy, and far enough away to stay small.
type Shot = { az: number; dist: number; h: number; fx: number; fy: number; fov: number }
const CHASE: Shot = { az: 10, dist: 13.2, h: 3.5, fx: 0.76, fy: 0.68, fov: 38 }
const SHOTS: Shot[] = [
  { az: 5, dist: 24, h: 8, fx: 0.76, fy: 0.64, fov: 33 }, // high, trailing
  { az: 55, dist: 17, h: 2.6, fx: 0.8, fy: 0.72, fov: 34 }, // rear quarter from out over the bluff
  { az: 135, dist: 22, h: 9, fx: 0.78, fy: 0.68, fov: 30 }, // high front quarter, above the headlight glare
]
// Seconds: hold the chase, ease out to one shot, hold it, ease back.
const HOLD = 16, MOVE = 6, AWAY = 8, CYCLE = HOLD + MOVE + AWAY + MOVE
const SPRING = 4 // rad/s, critically damped
const ease = (t: number) => t * t * t * (t * (6 * t - 15) + 10)

export function createRig(camera: PerspectiveCamera) {
  const off = new Vector3(), vel = new Vector3(), goal = new Vector3(), aim = new Vector3(), foe = new Vector3()
  const vp = { x: 0.64, y: 0.54 }
  let clock = 0, lat = 0, primed = false

  // speed is what the viewer sees (m/s times the playback dial); returns the speed blur.
  const update = (dt: number, s: number, speed: number, accel: number, still: boolean, carPos: Vector3, tan: Dir, width: number, height: number) => {
    // The first frame after a resume can report a slightly negative dt.
    clock = still ? 0 : Math.max(0, clock + dt)
    const t = clock % CYCLE, alt = SHOTS[Math.floor(clock / CYCLE) % SHOTS.length]
    const w = t < HOLD ? 0 : t < HOLD + MOVE ? ease((t - HOLD) / MOVE) : t < CYCLE - MOVE ? 1 : 1 - ease((t - CYCLE + MOVE) / MOVE)
    const mix = (a: number, b: number) => a + (b - a) * w
    const pace = Math.max(-1, Math.min(1, (speed - MEAN_SPEED) / 11))
    lat += ((still ? 0 : speed * speed * curvature(s)) - lat) * Math.min(1, dt * 2)

    // Widen with speed, dollying in to keep the car's size, so the road stretches past it.
    const baseFov = mix(CHASE.fov, alt.fov), fov = still ? baseFov : baseFov + 5 * pace
    const dist = mix(CHASE.dist, alt.dist) * Math.tan((baseFov / 2) * DEG) / Math.tan((fov / 2) * DEG)
    const az = mix(CHASE.az, alt.az) * DEG
    // Falls back when the car punches, closes up as it lifts, and swings wide in bends.
    pointAt(s - Math.cos(az) * dist - accel * 0.45, LANE_U - Math.sin(az) * dist - lat * 0.3, mix(CHASE.h, alt.h), goal).sub(carPos)
    if (still || !primed) { off.copy(goal); vel.set(0, 0, 0); primed = true } else {
      const h = Math.max(0, Math.min(dt, 0.05))
      vel.multiplyScalar(1 - 2 * SPRING * h).addScaledVector(goal.sub(off), SPRING * SPRING * h)
      off.addScaledVector(vel, h)
    }
    const cam = camera.position.copy(carPos).add(off)
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix() }

    // Aim locked on the car: right of frame, about two thirds down the visible hero.
    const rx = carPos.x - cam.x, rz = carPos.z - cam.z, d = Math.hypot(rx, rz), fx = rx / d, fz = rz / d
    const aspect = width / height, tv = Math.tan((fov / 2) * DEG)
    const frameX = aspect >= 1.3 ? mix(CHASE.fx, alt.fx) : 0.6 + 0.16 * smoothstep(0.55, 1.3, aspect)
    const yaw = -Math.atan((2 * frameX - 1) * tv * aspect)
    const visibleH = Math.min(height, window.innerHeight || height)
    const fy = (visibleH * mix(CHASE.fy, alt.fy)) / height
    const pitch = Math.atan2(carPos.y + 0.6 - cam.y, d) - Math.atan((1 - 2 * fy) * tv)
    const dx = fx * Math.cos(yaw) - fz * Math.sin(yaw), dz = fz * Math.cos(yaw) + fx * Math.sin(yaw)
    aim.set(cam.x + dx * Math.cos(pitch), cam.y + Math.sin(pitch), cam.z + dz * Math.cos(pitch))
    camera.lookAt(aim)
    if (!still) {
      // Bank into the bend, a slow handheld drift, and road buzz that grows with speed.
      const buzz = 0.0011 * smoothstep(16, 40, speed)
      camera.rotateZ(-lat * 0.006 + buzz * Math.sin(clock * 37.1))
      camera.rotateX(0.0018 * Math.sin(clock * 0.53 + 1) + buzz * Math.sin(clock * 53.3 + 2))
      camera.rotateY(0.0024 * Math.sin(clock * 0.7))
    }
    camera.updateMatrixWorld()

    // Streaks radiate from where the road is heading, or where it came from when looking back.
    const facing = dx * tan.x + dz * tan.z, dir = facing < 0 ? -5000 : 5000
    foe.set(cam.x + tan.x * dir, cam.y, cam.z + tan.z * dir).project(camera)
    vp.x = Math.max(-0.5, Math.min(1.5, foe.x * 0.5 + 0.5))
    vp.y = Math.max(-0.2, Math.min(1.2, foe.y * 0.5 + 0.5))
    // Side-on, the radial streak has no sensible centre, so it fades out.
    return still ? 0 : 1.4 * smoothstep(10, 38, speed) * smoothstep(0.15, 0.55, Math.abs(facing))
  }
  return { update, vp }
}
