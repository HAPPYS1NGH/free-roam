import SwiftUI
import UniformTypeIdentifiers

extension UTType {
    /// A disc dragged along the strip. Declared in Info.plist and only
    /// offered to Free Roam itself, so text or files dragged in from other
    /// apps can't land on the strip, and a disc can't land anywhere else.
    static let freeRoamStation = UTType(exportedAs: "com.happys1ngh.freeroam.station")
}

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
    let cancelLogo: (String) -> Void

    /// Close to a station's size on the wheel, so the strip reads as the wheel.
    nonisolated static let discSize = 44.0
    /// The disc and its place below it. Every disc is the same size, so the
    /// strip can tell which one the pointer is over from where it is.
    nonisolated static let itemHeight = discSize + 18
    /// The wheel's accent ring, which marks the disc under the pointer or
    /// with keyboard focus, as it marks the wheel's selected station.
    nonisolated static let ringWidth = 2.5
    /// Room for the ring and its 1.5 pt dark edge, which draw outside the
    /// disc's frame, so a disc doesn't push its neighbours when it gets one.
    nonisolated static let spacing = 10.0
    nonisolated static let rowSpacing = 6.0
    nonisolated static let padding = 10.0

    /// The station the latest drag from this strip carries.
    @State private var dragging: String?
    /// A drag is over the strip. Dropping, or leaving the strip, which is
    /// also what happens when Escape cancels a drag over it, ends it.
    @State private var isDropTargeted = false
    @State private var hovered: String?
    @State private var rowWidth = 0.0
    @FocusState private var focused: String?

    var body: some View {
        Group {
            if stations.isEmpty {
                Text("Nothing on the wheel yet. Click a playlist below to add it.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: Self.itemHeight)
            } else {
                FlowLayout(spacing: Self.spacing, rowSpacing: Self.rowSpacing) {
                    ForEach(Array(stations.enumerated()), id: \.element.id) { index, station in
                        disc(station, at: index)
                    }
                }
                .onGeometryChange(for: Double.self) { $0.size.width } action: { rowWidth = $0 }
            }
        }
        .padding(Self.padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
        // One drop target for the whole strip, gaps and padding included, so
        // every drop on it ends the drag.
        .onDrop(of: [.freeRoamStation], delegate: StripDrop(
            dragging: $dragging,
            isTargeted: $isDropTargeted,
            stationIndex: { point in
                FlowLayout.index(
                    at: CGPoint(x: point.x - Self.padding, y: point.y - Self.padding),
                    count: stations.count,
                    itemSize: CGSize(width: Self.discSize, height: Self.itemHeight),
                    width: rowWidth,
                    spacing: Self.spacing,
                    rowSpacing: Self.rowSpacing
                )
            },
            move: move
        ))
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
                opacity: isDropTargeted && dragging == station.id ? 0.35 : 1
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
        .frame(width: Self.discSize, height: Self.itemHeight, alignment: .top)
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
        .onDeleteCommand { removeKeepingFocus(station, at: index) }
        .onDrag {
            dragging = station.id
            let id = station.id
            let provider = NSItemProvider()
            provider.registerDataRepresentation(forTypeIdentifier: UTType.freeRoamStation.identifier, visibility: .ownProcess) { load in
                load(Data(id.utf8), nil)
                return nil
            }
            return provider
        }
        .help(station.name)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(PlaylistTile.accessibilityLabel(name: station.name, slot: index + 1))
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Takes it off the wheel")
        .accessibilityAction { remove(station.id) }
        .accessibilityAction(named: "Move Earlier") { move(station.id, index - 1) }
        .accessibilityAction(named: "Move Later") { move(station.id, index + 1) }
        .onAppear { requestLogo(station.id) }
        .onDisappear { cancelLogo(station.id) }
    }

    /// Focus moves to the next disc, or the one before when it was the last,
    /// so Delete can be pressed again.
    private func removeKeepingFocus(_ station: Playlist, at index: Int) {
        let next = stations.indices.contains(index + 1) ? stations[index + 1] : index > 0 ? stations[index - 1] : nil
        remove(station.id)
        focused = next?.id
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

/// Moves the dragged station to the place under the pointer as soon as the
/// pointer gets there, so the strip shows the new order before the drop.
/// Each move is saved, so the order shown is the order kept, wherever the
/// drag ends.
private struct StripDrop: DropDelegate {
    @Binding var dragging: String?
    @Binding var isTargeted: Bool
    let stationIndex: (CGPoint) -> Int?
    let move: (String, Int) -> Void

    func validateDrop(info: DropInfo) -> Bool {
        dragging != nil && info.hasItemsConforming(to: [.freeRoamStation])
    }

    func dropEntered(info: DropInfo) {
        isTargeted = true
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        if let dragging, let index = stationIndex(info.location) { move(dragging, index) }
        return DropProposal(operation: .move)
    }

    /// Leaving keeps the station, so a drag that comes back carries on. Only
    /// drags from this strip carry the type, and each one sets it afresh.
    func dropExited(info: DropInfo) {
        isTargeted = false
    }

    func performDrop(info: DropInfo) -> Bool {
        dragging = nil
        isTargeted = false
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

    /// Which of `count` views of one size is at `point`, laid out as `rows`
    /// lays them out. A point in a gap or past the end of a row picks the
    /// nearest view in that row, and one below the rows picks from the last.
    nonisolated static func index(
        at point: CGPoint, count: Int, itemSize: CGSize, width: CGFloat, spacing: CGFloat, rowSpacing: CGFloat
    ) -> Int? {
        guard count > 0 else { return nil }
        let perRow = max(1, Int((width + spacing) / (itemSize.width + spacing)))
        let rowCount = (count + perRow - 1) / perRow
        let row = min(max(Int((point.y / (itemSize.height + rowSpacing)).rounded(.down)), 0), rowCount - 1)
        let column = min(max(Int(((point.x + spacing / 2) / (itemSize.width + spacing)).rounded(.down)), 0), perRow - 1)
        return min(row * perRow + column, count - 1)
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
