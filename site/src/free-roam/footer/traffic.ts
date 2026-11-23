// Traffic on the coast road: a handful of vehicle shapes in both lanes. Cars
// you send (a link, a click, a retune) wear the station's colour and leave at
// once; passing traffic is muted and comes on its own now and then.

type Px = (x: number, y: number, w?: number, h?: number) => void
type Part = "body" | "glass" | "trim" | "wheel"
type Rect = readonly [dx: number, dy: number, w: number, h: number, part: Part]

// Drawn facing right; row 4 is the wheels, taller vehicles reach above row 0.
// `head` is the headlight row, `tail` the tail-light rows.
type Kind = { length: number; speed: number; rects: Rect[]; head: number; tail: readonly [number, number]; weight: number }

const KINDS: Kind[] = [
  // Saloon
  { length: 15, speed: 165, weight: 4, head: 2, tail: [1, 2], rects: [[0, 1, 15, 3, "body"], [3, -1, 8, 2, "body"], [4, 0, 3, 1, "glass"], [8, 0, 2, 1, "glass"], [2, 4, 2, 1, "wheel"], [11, 4, 2, 1, "wheel"]] },
  // Hatchback
  { length: 12, speed: 150, weight: 3, head: 2, tail: [0, 2], rects: [[0, 1, 12, 3, "body"], [1, -1, 7, 2, "body"], [2, 0, 2, 1, "glass"], [5, 0, 2, 1, "glass"], [2, 4, 2, 1, "wheel"], [8, 4, 2, 1, "wheel"]] },
  // Low coupé with a spoiler
  { length: 14, speed: 200, weight: 2, head: 2, tail: [2, 1], rects: [[0, 2, 14, 2, "body"], [4, 1, 6, 1, "body"], [6, 1, 3, 1, "glass"], [0, 1, 2, 1, "trim"], [2, 4, 2, 1, "wheel"], [10, 4, 2, 1, "wheel"]] },
  // Van
  { length: 18, speed: 130, weight: 2, head: 2, tail: [-1, 3], rects: [[0, -2, 17, 6, "body"], [17, 0, 1, 4, "body"], [13, -1, 3, 2, "glass"], [3, -1, 3, 1, "glass"], [7, -1, 3, 1, "glass"], [0, 1, 17, 1, "trim"], [3, 4, 2, 1, "wheel"], [13, 4, 2, 1, "wheel"]] },
  // Pickup
  { length: 17, speed: 145, weight: 2, head: 2, tail: [1, 2], rects: [[0, 1, 17, 3, "body"], [9, -1, 6, 2, "body"], [10, 0, 4, 1, "glass"], [1, 1, 7, 1, "trim"], [2, 4, 2, 1, "wheel"], [13, 4, 2, 1, "wheel"]] },
  // Night bus, windows lit
  { length: 28, speed: 105, weight: 1, head: 2, tail: [-3, 6], rects: [[0, -4, 28, 8, "body"], [2, -3, 3, 2, "glass"], [6, -3, 3, 2, "glass"], [10, -3, 3, 2, "glass"], [14, -3, 3, 2, "glass"], [18, -3, 3, 2, "glass"], [24, -3, 4, 3, "glass"], [0, 1, 28, 1, "trim"], [4, 4, 2, 1, "wheel"], [21, 4, 3, 1, "wheel"]] },
  // Motorbike and rider
  { length: 7, speed: 215, weight: 2, head: 1, tail: [2, 1], rects: [[1, 2, 5, 2, "body"], [3, -1, 2, 3, "trim"], [4, -2, 1, 1, "trim"], [0, 4, 2, 1, "wheel"], [5, 4, 2, 1, "wheel"]] },
]

// Top row of each lane's cars: the near lane drives right, the far lane left.
const NEAR_LANE = 45
const FAR_LANE = 38
const GAP = 5

const PASSING = ["oklch(0.42 0.02 250)", "oklch(0.36 0.06 25)", "oklch(0.5 0.03 90)", "oklch(0.32 0.04 200)", "oklch(0.55 0.01 250)"]
const GLASS = "oklch(0.3 0.03 250)"
const LIT_GLASS = "oklch(0.78 0.1 85)"
const SILHOUETTE = "oklch(0.075 0.01 255)"
const HEADLAMP = "oklch(0.97 0.05 95)"
const BEAM = "oklch(0.95 0.06 95)"
const TAIL = "oklch(0.6 0.22 28)"

export type Car = { kind: Kind; x: number; direction: 1 | -1; speed: number; colour: string | null }
export type Traffic = { cars: Car[]; nextDirection: 1 | -1; nextPassing: number }

export const createTraffic = (): Traffic => ({ cars: [], nextDirection: 1, nextPassing: 0 })

const pickKind = () => {
  let roll = Math.random() * KINDS.reduce((sum, kind) => sum + kind.weight, 0)
  for (const kind of KINDS) if ((roll -= kind.weight) < 0) return kind
  return KINDS[0]
}

// Leaves now, in alternating lanes. If the lane's entry is taken it starts
// just behind the last car in, so a burst of clicks rolls in as a convoy
// instead of waiting for gaps.
export function sendCar(traffic: Traffic, columns: number, colour: string | null = null, direction = traffic.nextDirection) {
  if (colour === null && traffic.cars.length > 6) return
  traffic.nextDirection = direction === 1 ? -1 : 1
  const kind = pickKind()
  const lane = traffic.cars.filter(car => car.direction === direction)
  let x = direction === 1 ? -kind.length - 2 : columns + 2
  for (const car of lane) {
    if (direction === 1) x = Math.min(x, car.x - kind.length - GAP)
    else x = Math.max(x, car.x + car.kind.length + GAP)
  }
  traffic.cars.push({ kind, x, direction, speed: kind.speed, colour })
}

export function stepTraffic(traffic: Traffic, columns: number, now: number, dt: number) {
  // Passing traffic every few seconds keeps both lanes alive.
  if (now > traffic.nextPassing) {
    if (traffic.nextPassing) sendCar(traffic, columns, PASSING[Math.floor(Math.random() * PASSING.length)], Math.random() < 0.5 ? 1 : -1)
    traffic.nextPassing = now + 4000 + Math.random() * 6000
  }
  // Follow the car ahead: close up, then match its speed instead of driving through it.
  for (const car of traffic.cars) {
    let gap = Infinity
    let ahead: Car | null = null
    for (const other of traffic.cars) {
      if (other === car || other.direction !== car.direction) continue
      const distance = car.direction === 1 ? other.x - (car.x + car.kind.length) : car.x - (other.x + other.kind.length)
      if (distance >= -1 && distance < gap) { gap = distance; ahead = other }
    }
    const target = ahead && gap < GAP + 3 ? Math.min(car.kind.speed, ahead.speed) : car.kind.speed
    car.speed += (target - car.speed) * Math.min(1, dt * 6)
  }
  for (const car of traffic.cars) car.x += car.direction * car.speed * dt
  traffic.cars = traffic.cars.filter(car => (car.direction === 1 ? car.x < columns + 40 : car.x + car.kind.length > -40))
}

// Front of each car in scene pixels, for boards that catch headlights.
export const headlightsOf = (traffic: Traffic) => traffic.cars.map(car => ({
  x: car.direction === 1 ? car.x + car.kind.length : car.x,
  y: car.direction === 1 ? NEAR_LANE : FAR_LANE,
  direction: car.direction,
}))

export function drawTraffic(context: CanvasRenderingContext2D, traffic: Traffic, accent: string, px: Px) {
  // The far lane first, so near cars pass in front of it.
  for (const direction of [-1, 1] as const) {
    for (const car of traffic.cars) if (car.direction === direction) drawCar(context, car, accent, px)
  }
}

function drawCar(context: CanvasRenderingContext2D, car: Car, accent: string, px: Px) {
  const { kind, direction } = car
  const top = direction === 1 ? NEAR_LANE : FAR_LANE
  // Mirror the right-facing drawing for the far lane.
  const at = (dx: number, dy: number, w = 1, h = 1) => px(direction === 1 ? car.x + dx : car.x + kind.length - dx - w, top + dy, w, h)

  // Beam fanning ahead along the road.
  context.fillStyle = BEAM
  for (let i = 0; i < 26; i++) {
    context.globalAlpha = 0.26 * (1 - i / 26)
    const spread = Math.floor(i / 5)
    at(kind.length + i, kind.head - spread, 1, 2 + spread * 2)
  }
  context.globalAlpha = 1

  const body = car.colour ?? accent
  for (const [dx, dy, w, h, part] of kind.rects) {
    context.fillStyle = part === "body" ? body : part === "glass" ? (kind.length > 25 ? LIT_GLASS : GLASS) : SILHOUETTE
    if (part === "trim" && kind.length > 8) context.globalAlpha = 0.35
    at(dx, dy, w, h)
    context.globalAlpha = 1
  }

  const [tailRow, tailHeight] = kind.tail
  context.fillStyle = TAIL
  at(0, tailRow, 1, tailHeight)
  context.globalAlpha = 0.3
  at(-3, tailRow, 3, tailHeight)
  context.globalAlpha = 1
  context.fillStyle = HEADLAMP
  at(kind.length - 1, kind.head)
}
