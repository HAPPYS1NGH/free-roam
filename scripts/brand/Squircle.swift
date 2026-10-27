import CoreGraphics

/// A rounded rectangle with continuous corners, the curve Apple's icon shape
/// and UIKit use, rather than CGPath's circular corners. The constants are
/// the widely used fit to Apple's curve: each corner starts 1.528665 × radius
/// from the vertex.
func squircle(_ rect: CGRect, radius r: CGFloat) -> CGPath {
    let path = CGMutablePath()
    let (minX, minY, maxX, maxY) = (rect.minX, rect.minY, rect.maxX, rect.maxY)
    // One corner, as offsets from its vertex along and across the edges.
    let curve: [(CGFloat, CGFloat)] = [
        (1.528665, 0), (1.088493, 0), (0.868407, 0), (0.631494, 0.074911),
        (0.372824, 0.169059), (0.169059, 0.372824), (0.074911, 0.631494),
        (0, 0.868407), (0, 1.088493), (0, 1.528665),
    ]
    // Each corner: its vertex, which way the edges run from it, and whether the
    // path arrives along a horizontal edge. Offsets in `curve` are (along the
    // edge the path arrives on, along the edge it leaves on).
    let corners: [(CGPoint, CGFloat, CGFloat, Bool)] = [
        (CGPoint(x: maxX, y: maxY), -1, -1, true),
        (CGPoint(x: maxX, y: minY), -1, 1, false),
        (CGPoint(x: minX, y: minY), 1, 1, true),
        (CGPoint(x: minX, y: maxY), 1, -1, false),
    ]
    for (index, (vertex, dx, dy, alongX)) in corners.enumerated() {
        func point(_ offset: (CGFloat, CGFloat)) -> CGPoint {
            let (x, y) = alongX ? offset : (offset.1, offset.0)
            return CGPoint(x: vertex.x + dx * x * r, y: vertex.y + dy * y * r)
        }
        if index == 0 { path.move(to: point(curve[0])) } else { path.addLine(to: point(curve[0])) }
        for i in stride(from: 1, to: curve.count, by: 3) {
            path.addCurve(to: point(curve[i + 2]), control1: point(curve[i]), control2: point(curve[i + 1]))
        }
    }
    path.closeSubpath()
    return path
}
