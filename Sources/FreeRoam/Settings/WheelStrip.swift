import SwiftUI

/// The stations on the wheel, in order, as the discs the wheel draws, with
/// each one's place. Drag a disc to move it, or focus it and use ← and →.
/// Its × or the Delete key takes it off. The discs wrap onto a second row,
/// so all 25 stay in view while you drag.
struct WheelStrip: View {
    let stations: [Playlist]
    let logos: [String: CGImage]
    let ringColor: Color
    /// The black rim round the art, as a fraction of the disc.
    let rim: Double
    let remove: (String) -> Void
    let move: (String, Int) -> Void
    let requestLogo: (String) -> Void

    nonisolated static let discSize = 36.0
    /// The wheel's accent ring, which marks the disc under the pointer or
    /// with keyboard focus, as it marks the wheel's selected station.
    nonisolated static let ringWidth = 2.5
    /// Room for the ring and its 1.5 pt dark edge, which draw outside the
    /// disc's frame, so a disc doesn't push its neighbours when it gets one.
    nonisolated static let spacing = 10.0
    nonisolated static let padding = 10.0

    @State private var dragging: String?
    @State private var hovered: String?
    @FocusState private var focused: String?

    var body: some View {
        Group {
            if stations.isEmpty {
                Text("Nothing on the wheel yet. Click a playlist below to add it.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: Self.discSize + 17)
            } else {
                FlowLayout(spacing: Self.spacing, rowSpacing: 6) {
                    ForEach(Array(stations.enumerated()), id: \.element.id) { index, station in
                        disc(station, at: index)
                    }
                }
            }
        }
        .padding(Self.padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
    }

    private func disc(_ station: Playlist, at index: Int) -> some View {
        let isMarked = hovered == station.id || focused == station.id
        return VStack(spacing: 2) {
            StationDisc(
                art: .station(station, logos: logos),
                size: Self.discSize,
                rim: (Self.discSize * rim).rounded(),
                ringWidth: isMarked ? Self.ringWidth : 0,
                ringColor: ringColor,
                inColour: true,
                opacity: dragging == station.id ? 0.35 : 1
            )
            .frame(width: Self.discSize, height: Self.discSize)
            .overlay(alignment: .topTrailing) {
                // Mostly inside the disc, so the pointer stays over it on the way.
                if isMarked { removeButton(station).offset(x: 4, y: -4) }
            }
            Text("\(index + 1)")
                .font(.caption.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
        .onHover { isHovered in
            if isHovered {
                hovered = station.id
            } else if hovered == station.id {
                hovered = nil
            }
        }
        .focusable()
        .focused($focused, equals: station.id)
        .focusEffectDisabled()
        .onMoveCommand { direction in
            switch direction {
            case .left: move(station.id, index - 1)
            case .right: move(station.id, index + 1)
            default: break
            }
        }
        .onDeleteCommand { remove(station.id) }
        .onDrag {
            dragging = station.id
            // The name, so a disc dropped on a text field types something useful.
            return NSItemProvider(object: station.name as NSString)
        }
        .onDrop(of: [.text], delegate: StationDrop(index: index, dragging: $dragging, move: move))
        .help(station.name)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(PlaylistTile.accessibilityLabel(name: station.name, slot: index + 1))
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Takes it off the wheel")
        .accessibilityAction { remove(station.id) }
        .accessibilityAction(named: "Move Earlier") { move(station.id, index - 1) }
        .accessibilityAction(named: "Move Later") { move(station.id, index + 1) }
        .onAppear { requestLogo(station.id) }
    }

    private func removeButton(_ station: Playlist) -> some View {
        Button {
            remove(station.id)
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 18, height: 18)
                .background(Circle().fill(Color(white: 0.32)))
                .overlay(Circle().strokeBorder(.white.opacity(0.85), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .help("Take \(station.name) off the wheel")
        // The disc itself is the accessible control.
        .accessibilityHidden(true)
    }
}

/// Moves the dragged station into the place of the one under the pointer as
/// soon as the pointer gets there, so the strip shows the new order before
/// the drop. Each move is saved, so a drop anywhere keeps the order shown.
private struct StationDrop: DropDelegate {
    let index: Int
    @Binding var dragging: String?
    let move: (String, Int) -> Void

    /// Only discs from this strip, not text dragged in from another app.
    func validateDrop(info: DropInfo) -> Bool {
        dragging != nil
    }

    func dropEntered(info: DropInfo) {
        guard let dragging else { return }
        move(dragging, index)
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }

    func performDrop(info: DropInfo) -> Bool {
        dragging = nil
        return true
    }
}

/// Lays views out left to right, starting a new row when one is full.
struct FlowLayout: Layout {
    var spacing: CGFloat
    var rowSpacing: CGFloat

    /// Which views go on each row, given their widths.
    nonisolated static func rows(widths: [CGFloat], in width: CGFloat, spacing: CGFloat) -> [Range<Int>] {
        var rows: [Range<Int>] = []
        var start = 0
        var x: CGFloat = 0
        for (index, viewWidth) in widths.enumerated() {
            if index > start, x + spacing + viewWidth > width {
                rows.append(start..<index)
                start = index
                x = viewWidth
            } else {
                x += (index > start ? spacing : 0) + viewWidth
            }
        }
        if start < widths.count { rows.append(start..<widths.count) }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let rows = Self.rows(widths: sizes.map(\.width), in: proposal.width ?? .infinity, spacing: spacing)
        var height: CGFloat = 0
        var widest: CGFloat = 0
        for row in rows {
            let rowSizes = sizes[row]
            height += rowSizes.map(\.height).max() ?? 0
            let rowWidth: CGFloat = rowSizes.map(\.width).reduce(0, +) + spacing * CGFloat(row.count - 1)
            widest = max(widest, rowWidth)
        }
        height += rowSpacing * CGFloat(max(rows.count - 1, 0))
        return CGSize(width: proposal.width ?? widest, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var y = bounds.minY
        for row in Self.rows(widths: sizes.map(\.width), in: bounds.width, spacing: spacing) {
            var x = bounds.minX
            for index in row {
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sizes[index]))
                x += sizes[index].width + spacing
            }
            y += (sizes[row].map(\.height).max() ?? 0) + rowSpacing
        }
    }
}
