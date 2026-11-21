import { CanvasTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace, type Texture } from "three"
import { noise2, rng } from "./noise"

function canvas(w: number, h: number) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return [c, c.getContext("2d")!] as const
}

function finish<T extends Texture>(t: T, srgb: boolean, repeat = true) {
  if (srgb) t.colorSpace = SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 16
  t.needsUpdate = true
  return t
}

// One 20 m tile of two-lane highway, 12.4 m wide. Across = x, along = y.
export const ROAD_TILE = 20
export function asphalt() {
  const W = 512, H = 1024
  const pxU = W / 12.4
  const [c, g] = canvas(W, H)
  const [rc, rg] = canvas(W, H)
  const rand = rng(7)
  const x = (u: number) => W / 2 + u * pxU

  // Base: aggregate grain, built per pixel so it tiles along y.
  const img = g.createImageData(W, H)
  const rough = rg.createImageData(W, H)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = (j * W + i) * 4
    const grain = rand() * 0.5 + 0.5 * rand()
    const patch = noise2(i / 70, j / 70, H / 70) * 0.5 + noise2(i / 18, j / 18, Math.round(H / 18)) * 0.25
    const u = (i - W / 2) / pxU
    // Tyres polish two bands per lane: darker and glossier.
    const lane = Math.abs(u) > 0.3 && Math.abs(u) < 3.9 ? Math.abs(u) - 1.95 : 9
    const track = Math.exp(-((Math.abs(lane) - 0.8) ** 2) / 0.09)
    let v = 50 + grain * 24 + patch * 10 - track * 7
    if (rand() > 0.985) v += 40 * rand()
    img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v * 1.04; img.data[k + 3] = 255
    const r = 235 - track * 28 - grain * 25 + patch * 14
    rough.data[k] = rough.data[k + 1] = rough.data[k + 2] = r; rough.data[k + 3] = 255
  }
  g.putImageData(img, 0, 0)
  rg.putImageData(rough, 0, 0)

  // Paint, worn by breaking each line into short alpha-jittered strokes.
  const paint = (u: number, width: number, colour: string, dash?: [number, number]) => {
    for (let j = 0; j < H; j += 3) {
      if (dash && (j / H * ROAD_TILE) % (dash[0] + dash[1]) > dash[0]) continue
      const wear = 0.72 + 0.28 * noise2(u * 5, j / 40, H / 40) * 0.5 + rand() * 0.12
      g.globalAlpha = Math.min(1, wear)
      g.fillStyle = colour
      g.fillRect(x(u) - width * pxU / 2, j, width * pxU, 3)
      rg.globalAlpha = 1
      rg.fillStyle = "#8a8a8a"
      rg.fillRect(x(u) - width * pxU / 2, j, width * pxU, 3)
    }
    g.globalAlpha = 1
  }
  paint(-0.17, 0.11, "#d9a634")
  paint(0.17, 0.11, "#d9a634")
  paint(-3.95, 0.15, "#e8e6df")
  paint(3.95, 0.15, "#e8e6df")

  // A few tar-sealed cracks.
  g.strokeStyle = "rgba(10,10,12,0.55)"
  g.lineWidth = 1.4
  for (let n = 0; n < 7; n++) {
    let px = rand() * W, py = rand() * H
    g.beginPath(); g.moveTo(px, py)
    for (let k = 0; k < 9; k++) { px += (rand() - 0.5) * 30; py += rand() * 26; g.lineTo(px, py) }
    g.stroke()
  }
  return { map: finish(new CanvasTexture(c), true), roughness: finish(new CanvasTexture(rc), false) }
}

// A Washingtonia frond: rachis up the middle, drooping leaflets either side.
export function frond() {
  const W = 256, H = 1024
  const [c, g] = canvas(W, H)
  const rand = rng(11)
  g.lineCap = "round"
  for (let j = 40; j < H - 10; j += 7) {
    const t = j / H
    const len = W * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.7 * (0.85 + rand() * 0.25)
    for (const side of [-1, 1]) {
      const shade = 70 + rand() * 60
      g.strokeStyle = `rgb(${shade * 0.55 | 0},${shade | 0},${shade * 0.38 | 0})`
      g.lineWidth = 3 + rand() * 2.5
      g.beginPath()
      g.moveTo(W / 2, j)
      g.quadraticCurveTo(W / 2 + side * len * 0.5, j - 10, W / 2 + side * len, j + 30 + rand() * 30)
      g.stroke()
    }
  }
  g.strokeStyle = "rgb(92,96,52)"
  g.lineWidth = 7
  g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke()
  const t = finish(new CanvasTexture(c), true, false)
  return t
}

export function bark() {
  const W = 64, H = 256
  const [c, g] = canvas(W, H)
  const rand = rng(5)
  g.fillStyle = "#6b6052"
  g.fillRect(0, 0, W, H)
  for (let j = 0; j < H; j += 6 + rand() * 4) {
    g.fillStyle = `rgba(${30 + rand() * 30},${26 + rand() * 20},${20},${0.5 + rand() * 0.4})`
    g.fillRect(0, j, W, 2 + rand() * 2)
  }
  for (let n = 0; n < 400; n++) {
    g.fillStyle = `rgba(${150 + rand() * 60},${140 + rand() * 50},${120 + rand() * 40},0.18)`
    g.fillRect(rand() * W, rand() * H, 2, 1)
  }
  return finish(new CanvasTexture(c), true)
}

export function glow(stretch = 1) {
  const S = 128
  const [c, g] = canvas(S, S)
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grad.addColorStop(0, "rgba(255,255,255,1)")
  grad.addColorStop(0.25, "rgba(255,255,255,0.45)")
  grad.addColorStop(0.6, "rgba(255,255,255,0.1)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.setTransform(1, 0, 0, stretch, 0, S / 2 * (1 - stretch))
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  const t = new CanvasTexture(c)
  t.minFilter = LinearMipmapLinearFilter
  t.magFilter = LinearFilter
  return finish(t, false, false)
}

// Soft rounded-rectangle shadow for under the car.
export function contactShadow() {
  const W = 128, H = 256
  const [c, g] = canvas(W, H)
  g.filter = "blur(14px)"
  g.fillStyle = "#000"
  g.beginPath()
  g.roundRect(28, 30, W - 56, H - 60, 30)
  g.fill()
  return finish(new CanvasTexture(c), false, false)
}

// Tileable ocean normals from integer-frequency waves plus periodic noise.
export function waterNormals() {
  const S = 256
  const h = new Float32Array(S * S)
  const rand = rng(3)
  const waves = Array.from({ length: 24 }, () => ({
    fx: Math.round((rand() - 0.5) * 14), fy: Math.round((rand() - 0.5) * 14), p: rand() * 6.283, a: 0.4 + rand(),
  })).filter(w => w.fx || w.fy)
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let v = 0
    for (const w of waves) v += w.a / Math.hypot(w.fx, w.fy) * Math.sin(((i * w.fx + j * w.fy) / S) * 6.283 + w.p)
    v += noise2(i / 8, j / 8, S / 8) * 0.25 + noise2(i / 4, j / 4, S / 4) * 0.1
    h[j * S + i] = v
  }
  const data = new Uint8Array(S * S * 4)
  const at = (i: number, j: number) => h[((j + S) % S) * S + ((i + S) % S)]
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * 2.2, dy = (at(i, j + 1) - at(i, j - 1)) * 2.2
    const l = Math.hypot(dx, dy, 1)
    const k = (j * S + i) * 4
    data[k] = (-dx / l * 0.5 + 0.5) * 255
    data[k + 1] = (-dy / l * 0.5 + 0.5) * 255
    data[k + 2] = (1 / l * 0.5 + 0.5) * 255
    data[k + 3] = 255
  }
  const t = new DataTexture(data, S, S, RGBAFormat)
  t.generateMipmaps = true
  t.minFilter = LinearMipmapLinearFilter
  t.magFilter = LinearFilter
  return finish(t, false)
}

// Grey ground detail: soil speckle and dry grass streaks, mean around 0.8.
export function groundDetail() {
  const S = 256
  const [c, g] = canvas(S, S)
  const img = g.createImageData(S, S)
  const rand = rng(21)
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = (j * S + i) * 4
    const v = 0.8 + noise2(i / 32, j / 32, S / 32) * 0.1 + noise2(i / 6, j / 6, S / 6) * 0.07 + (rand() - 0.5) * 0.12
    img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.max(0, Math.min(255, v * 255))
    img.data[k + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return finish(new CanvasTexture(c), false)
}
