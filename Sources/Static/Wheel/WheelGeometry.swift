import Foundation

/// Ported from `prototype/src/geometry.ts` and `ringGeometry` in
/// `RadioWheel.tsx`. Angles are in radians, 0 at the top, increasing
/// clockwise, and y grows downwards as on screen. Slot 0 is Radio Off at the
/// bottom of the ring, as in GTA V, and stations run clockwise from it.
enum WheelGeometry {
    private static let turn = 2 * Double.pi
    private static let ringStart = Double.pi

    struct Ring: Equatable {
        let radius: Double
        let icon: Double
        let selectedIcon: Double
    }

    static func slotAngle(_ index: Int, count: Int) -> Double {
        ringStart + Double(index) / Double(count) * turn
    }

    /// The slot a direction points at. Slots own the arc centred on them, so
    /// both sides of the bottom pick Radio Off.
    static func slot(forX x: Double, y: Double, count: Int) -> Int {
        guard count > 0 else { return 0 }
        let angle = atan2(x, -y)
        let fromStart = (angle - ringStart).truncatingRemainder(dividingBy: turn)
        let wrapped = fromStart < 0 ? fromStart + turn : fromStart
        return Int((wrapped / (turn / Double(count))).rounded()) % count
    }

    /// GTA spaces logos a fixed distance apart, so the ring grows with the
    /// station count between `minRadius` and `maxRadius`. Logos keep GTA's
    /// logo-to-gap ratio, so they grow (up to `maxIconSize`) when a short list
    /// is spread round the smallest ring and shrink once the ring is full.
    /// Disc diameters are whole, even points, so every disc comes out
    /// identical and centred on the pixel grid.
    static func ring(_ sizes: WheelStyle.Sizes, count: Int, screenHeight: Double) -> Ring {
        let unit = screenHeight / 100
        let natural = Double(count) * sizes.iconPitch / turn
        let radius = min(max(natural, sizes.minRadius), sizes.maxRadius) * unit
        let pitch = turn * radius / Double(count)
        let icon = evenPoints(min(pitch * sizes.iconSize / sizes.iconPitch, sizes.maxIconSize * unit))
        return Ring(radius: radius, icon: icon, selectedIcon: evenPoints(icon * sizes.selectedScale))
    }

    private static func evenPoints(_ value: Double) -> Double {
        (value / 2).rounded() * 2
    }
}

/// The pick comes from mouse movement since the wheel opened, not from where
/// the pointer is. That virtual cursor is clamped to `pickRadius`, so a flick
/// sticks until you push another way, as in GTA. Circling the whole ring takes
/// about 2π × `pickRadius` of mouse travel.
struct PickCursor {
    let pickRadius: Double
    let deadZone: Double
    private(set) var x = 0.0
    private(set) var y = 0.0

    init(pickRadius: Double, deadZone: Double) {
        self.pickRadius = pickRadius
        self.deadZone = deadZone
    }

    /// Adds mouse movement and returns the slot the cursor points at. Inside
    /// the dead zone it returns nil and the current pick stays, so a jittery
    /// hand on release doesn't change station.
    mutating func move(dx: Double, dy: Double, count: Int) -> Int? {
        x += dx
        y += dy
        let length = hypot(x, y)
        if length > pickRadius {
            x *= pickRadius / length
            y *= pickRadius / length
        }
        guard length >= deadZone else { return nil }
        return WheelGeometry.slot(forX: x, y: y, count: count)
    }

    /// Points the cursor at a slot, so mouse movement after scrolling carries
    /// on from the station scrolling picked.
    mutating func point(at slot: Int, count: Int) {
        let angle = WheelGeometry.slotAngle(slot, count: count)
        x = sin(angle) * pickRadius
        y = -cos(angle) * pickRadius
    }
}
