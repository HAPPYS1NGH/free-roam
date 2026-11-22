import AppKit
import SwiftUI
import Testing
@testable import FreeRoam

/// Settings' General tab in each state, drawn from the source tree's preview
/// images, since tests have no app bundle.
@MainActor
struct GeneralSettingsTests {
    private static let resources = URL(filePath: #filePath)
        .deletingLastPathComponent()
        .appending(path: "../../Sources/FreeRoam/Resources")
        .standardizedFileURL

    private static func previews() throws -> BackdropPreview.Previews {
        try (
            before: #require(NSImage(contentsOf: resources.appending(path: "WelcomeBefore.jpg"))),
            after: #require(NSImage(contentsOf: resources.appending(path: "WelcomeAfter.jpg")))
        )
    }

    /// Every state worth seeing, by the name its render is saved under.
    private static func states() throws -> [(String, GeneralSettingsContent)] {
        let previews = try previews()
        return [
            ("backdrop-off", GeneralSettingsContent(previews: previews, backdropOn: false)),
            ("backdrop-on", GeneralSettingsContent(
                previews: previews, backdropOn: true, launchesAtLogin: true, checksForUpdatesAutomatically: true
            )),
            ("checking-for-updates", GeneralSettingsContent(previews: previews, backdropOn: true, canCheckForUpdates: false)),
            ("no-updates", GeneralSettingsContent(previews: previews, backdropOn: false, updatesAvailable: false)),
            ("no-bundle", GeneralSettingsContent(previews: nil, backdropOn: false, updatesAvailable: false)),
        ]
    }

    /// The window takes the tab's smallest size, and a form scrolls, so it
    /// could shrink until the backdrop's rows were cut off. Every state has
    /// to keep the tab's width and all of its rows.
    @Test func smallestSizeShowsEveryRow() throws {
        for (name, content) in try Self.states() {
            let host = NSHostingController(rootView: content)
            let smallest = host.sizeThatFits(in: CGSize(width: 1, height: 1))
            let ideal = host.view.fittingSize
            #expect(abs(smallest.width - GeneralSettingsContent.width) < 1, "\(name): \(smallest)")
            #expect(abs(smallest.height - ideal.height) < 2, "\(name): \(smallest) vs \(ideal)")
            #expect(smallest.height > 300 && smallest.height < 760, "\(name): \(smallest)")
        }
    }

    /// Without a feed, as in `swift run`, the updates section goes rather
    /// than showing switches that do nothing.
    @Test func noFeedLeavesOutTheUpdatesSection() throws {
        let previews = try Self.previews()
        func height(_ content: GeneralSettingsContent) -> CGFloat {
            NSHostingController(rootView: content).view.fittingSize.height
        }
        let withUpdates = height(GeneralSettingsContent(previews: previews, backdropOn: false))
        let without = height(GeneralSettingsContent(previews: previews, backdropOn: false, updatesAvailable: false))
        #expect(without < withUpdates - 40, "\(without) vs \(withUpdates)")
    }

    /// Saves each state as a PNG for review. Set `SETTINGS_RENDERS` to a
    /// folder to run it, as it's skipped otherwise.
    @Test(.enabled(if: ProcessInfo.processInfo.environment["SETTINGS_RENDERS"] != nil))
    func render() throws {
        let folder = URL(filePath: try #require(ProcessInfo.processInfo.environment["SETTINGS_RENDERS"]), directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        for appearance in [NSAppearance.Name.aqua, .darkAqua] {
            for (name, content) in try Self.states() {
                let view = NSHostingView(rootView: content)
                view.setFrameSize(view.fittingSize)
                // Off screen, but in a window, so the form's controls draw.
                let window = NSWindow(contentRect: view.frame, styleMask: [.borderless], backing: .buffered, defer: false)
                window.appearance = NSAppearance(named: appearance)
                window.contentView = view
                view.layoutSubtreeIfNeeded()
                let bitmap = try #require(view.bitmapImageRepForCachingDisplay(in: view.bounds))
                view.cacheDisplay(in: view.bounds, to: bitmap)
                let png = try #require(bitmap.representation(using: .png, properties: [:]))
                let suffix = appearance == .darkAqua ? "-dark" : ""
                try png.write(to: folder.appending(path: "general-\(name)\(suffix).png"))
            }
        }
    }
}
