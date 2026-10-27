import AppKit
import Testing

struct MenuBarIconTests {
    /// The glyph's files, copied into a throwaway bundle, load the way the
    /// app's `NSImage(named:)` loads them from Contents/Resources: as one
    /// 18 pt template with a 1x and a 2x representation.
    @Test func loadsAsOneTemplateAtBothScales() throws {
        let resources = URL(filePath: #filePath)
            .deletingLastPathComponent()
            .appending(path: "../../Sources/FreeRoam/Resources")
        let bundleURL = FileManager.default.temporaryDirectory.appending(path: "MenuBarIconTests-\(UUID().uuidString).bundle")
        try FileManager.default.createDirectory(at: bundleURL, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: bundleURL) }
        for name in ["MenuBarIconTemplate.png", "MenuBarIconTemplate@2x.png"] {
            try FileManager.default.copyItem(at: resources.appending(path: name), to: bundleURL.appending(path: name))
        }

        let image = try #require(Bundle(url: bundleURL)?.image(forResource: "MenuBarIconTemplate"))
        #expect(image.isTemplate)
        #expect(image.size == NSSize(width: 18, height: 18))
        #expect(Set(image.representations.map(\.pixelsWide)) == [18, 36])
    }
}
