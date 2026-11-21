import Foundation
import Testing
@testable import FreeRoam

enum TokensFixture {
    /// The real `site/tokens.json`, so a re-export that breaks the format fails here.
    static let url = URL(filePath: #filePath)
        .deletingLastPathComponent()
        .appending(path: "../../site/tokens.json")
        .standardizedFileURL

    static func style() throws -> WheelStyle {
        try WheelStyle.load(from: url)
    }
}

struct WheelStyleTests {
    @Test func decodesThePrototypeTokens() throws {
        let style = try TokensFixture.style()
        #expect(style.sizes.iconPitch == 9.15)
        #expect(style.sizes.selectedRim == 0.01)
        #expect(style.colors.ringColor == "#65B4D4")
        #expect(style.behaviour.holdDelayMs == 150)
        #expect(style.animations.open.duration == 0.14)
        #expect(style.animations.open.bezier == [0.23, 1, 0.32, 1])
    }
}
