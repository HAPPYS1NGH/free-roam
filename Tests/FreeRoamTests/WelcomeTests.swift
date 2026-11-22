import AppKit
import SwiftUI
import Testing
@testable import FreeRoam

struct WelcomeTests {
    @Test(arguments: [false, true])
    func neverShowsOnceYouSaidNotTo(pickedAppAllowed: Bool) {
        #expect(!WelcomeModel.shouldShow(dontShowAgain: true, pickedAppAllowed: pickedAppAllowed))
    }

    /// Screen Recording is optional, so it no longer brings the window back.
    @Test func hidesOnceThePickedAppIsAllowed() {
        #expect(!WelcomeModel.shouldShow(dontShowAgain: false, pickedAppAllowed: true))
    }

    /// Including after closing it with the close button, which saves nothing.
    @Test func showsUntilThePickedAppIsAllowed() {
        #expect(WelcomeModel.shouldShow(dontShowAgain: false, pickedAppAllowed: false))
    }

    @Test func theAppsAnswerWinsWhileItsRunning() {
        for lastAnswer in [false, true] {
            #expect(WelcomeModel.status(.allowed, lastAnswer: lastAnswer, isInstalled: true) == .allowed)
            #expect(WelcomeModel.status(.denied, lastAnswer: lastAnswer, isInstalled: true) == .denied)
            #expect(WelcomeModel.status(.notAsked, lastAnswer: lastAnswer, isInstalled: true) == .notAsked)
        }
    }

    /// Otherwise the window would come back at every launch with the app closed.
    @Test func theLastAnswerStandsWhileTheAppIsClosed() {
        #expect(WelcomeModel.status(.musicNotRunning, lastAnswer: true, isInstalled: true) == .allowed)
        #expect(WelcomeModel.status(.musicNotRunning, lastAnswer: false, isInstalled: true) == .notAsked)
        #expect(WelcomeModel.status(.unknown(-1), lastAnswer: true, isInstalled: true) == .allowed)
    }

    /// There's nothing to ask, whatever was answered before it went.
    @Test func anAppThatIsntInstalledSaysSo() {
        for permission in [MusicPermission.allowed, .denied, .notAsked, .musicNotRunning] {
            #expect(WelcomeModel.status(permission, lastAnswer: true, isInstalled: false) == .notInstalled)
        }
    }
}

@MainActor
struct WelcomeRenderTests {
    private static let resources = URL(filePath: #filePath)
        .deletingLastPathComponent()
        .appending(path: "../../Sources/FreeRoam/Resources")

    /// Every state the window can be in. The badge and previews come from
    /// the source tree, since tests have no app bundle.
    private static func states() throws -> [(name: String, content: WelcomeContent)] {
        let badge = try #require(NSImage(contentsOf: resources.appending(path: "FreeRoamBadge.png")))
        let previews = try (
            before: #require(NSImage(contentsOf: resources.appending(path: "WelcomeBefore.jpg"))),
            after: #require(NSImage(contentsOf: resources.appending(path: "WelcomeAfter.jpg")))
        )
        func content(
            _ picked: MusicApp, music: AppControlStatus, spotify: AppControlStatus, backdropOn: Bool = false, launchesAtLogin: Bool = false
        ) -> WelcomeContent {
            WelcomeContent(
                badge: badge, previews: previews, picked: picked, statuses: [.music: music, .spotify: spotify],
                backdropOn: backdropOn, launchesAtLogin: launchesAtLogin
            )
        }
        return [
            ("neither", content(.music, music: .notAsked, spotify: .notAsked)),
            ("asking-music", content(.music, music: .asking, spotify: .notAsked)),
            ("only-music", content(.music, music: .allowed, spotify: .notAsked)),
            ("only-spotify", content(.spotify, music: .notAsked, spotify: .allowed)),
            ("both", content(.spotify, music: .allowed, spotify: .allowed, backdropOn: true, launchesAtLogin: true)),
            ("spotify-not-installed", content(.music, music: .notAsked, spotify: .notInstalled)),
            ("denied", content(.spotify, music: .allowed, spotify: .denied)),
            ("backdrop-on", content(.music, music: .allowed, spotify: .notAsked, backdropOn: true)),
            // As `swift run` draws it, without the bundle's images.
            ("no-bundle", WelcomeContent(badge: nil, previews: nil, picked: .music, statuses: [:], backdropOn: false)),
        ]
    }

    /// The window can't be resized, so the content keeps one size whatever
    /// is allowed, and fits a small laptop screen. Leaving out the bundle's
    /// images (as `swift run` does) keeps the same size too.
    @Test func keepsOneSizeInEveryState() throws {
        let sizes = try Self.states().map { state in
            let renderer = ImageRenderer(content: state.content)
            renderer.scale = 1
            let image = try #require(renderer.cgImage)
            return [image.width, image.height]
        }
        #expect(sizes.allSatisfy { $0 == sizes[0] }, "\(sizes)")
        #expect(Double(sizes[0][0]) == WelcomeContent.width)
        #expect(sizes[0][1] < 700)
    }

    /// The window opens at its content's smallest size. A resizable image
    /// can shrink to nothing, which hid both previews in the real window
    /// while renders at the ideal size still showed them.
    @Test func smallestSizeKeepsThePreviews() throws {
        let previews = try (
            before: #require(NSImage(contentsOf: Self.resources.appending(path: "WelcomeBefore.jpg"))),
            after: #require(NSImage(contentsOf: Self.resources.appending(path: "WelcomeAfter.jpg")))
        )
        let content = WelcomeContent(previews: previews, picked: .music, statuses: [.music: .allowed], backdropOn: false)
        let host = NSHostingController(rootView: content)
        let smallest = host.sizeThatFits(in: CGSize(width: WelcomeContent.width, height: 1))
        #expect(abs(smallest.height - host.view.fittingSize.height) < 2, "\(smallest) vs \(host.view.fittingSize)")
    }

    /// Writes each state as a PNG to the folder in `WELCOME_RENDERS`, to look
    /// over a change. Skipped otherwise. Drawn by AppKit, which unlike
    /// `ImageRenderer` draws the buttons and checkbox.
    @Test(.enabled(if: ProcessInfo.processInfo.environment["WELCOME_RENDERS"] != nil))
    func writeRenders() throws {
        let folder = URL(filePath: try #require(ProcessInfo.processInfo.environment["WELCOME_RENDERS"]))
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        for state in try Self.states() {
            for appearance in [NSAppearance.Name.aqua, .darkAqua] {
                let view = NSHostingView(rootView: state.content.background(Color(nsColor: .windowBackgroundColor)))
                view.appearance = NSAppearance(named: appearance)
                view.frame.size = view.fittingSize
                let window = NSWindow(contentRect: view.frame, styleMask: [.borderless], backing: .buffered, defer: false)
                window.appearance = view.appearance
                window.contentView = view
                view.layoutSubtreeIfNeeded()
                let rep = try #require(view.bitmapImageRepForCachingDisplay(in: view.bounds))
                view.cacheDisplay(in: view.bounds, to: rep)
                let png = try #require(rep.representation(using: .png, properties: [:]))
                let suffix = appearance == .darkAqua ? "-dark" : ""
                try png.write(to: folder.appending(path: "\(state.name)\(suffix).png"))
            }
        }
    }
}

@MainActor
struct WelcomeWindowTests {
    private final class CloseCounter: NSObject, NSWindowDelegate {
        var closes = 0
        func windowWillClose(_ notification: Notification) { closes += 1 }
    }

    /// The window is never put on screen.
    @Test func escapeClosesItLikeTheCloseButton() throws {
        let window = EscapeClosingWindow(
            contentViewController: NSHostingController(rootView: WelcomeContent(picked: .music, statuses: [:], backdropOn: false))
        )
        window.styleMask = [.titled, .closable]
        window.isReleasedWhenClosed = false
        let counter = CloseCounter()
        window.delegate = counter
        func keyDown(_ characters: String, keyCode: UInt16) throws -> NSEvent {
            try #require(NSEvent.keyEvent(
                with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: window.windowNumber,
                context: nil, characters: characters, charactersIgnoringModifiers: characters, isARepeat: false, keyCode: keyCode
            ))
        }

        window.sendEvent(try keyDown("a", keyCode: 0))
        #expect(counter.closes == 0)
        window.sendEvent(try keyDown("\u{1b}", keyCode: 53))
        #expect(counter.closes == 1)
    }
}

struct MusicPermissionMemoryTests {
    /// A throwaway defaults domain, so nothing touches the app's own.
    private let defaults: UserDefaults

    init() throws {
        let suite = "MusicPermissionMemoryTests.\(UUID().uuidString)"
        defaults = try #require(UserDefaults(suiteName: suite))
        defaults.removePersistentDomain(forName: suite)
    }

    @Test func keepsEachAnswerMusicGives() {
        #expect(!MusicPermissionMemory.lastAnswer(in: defaults))
        MusicPermissionMemory.record(.allowed, in: defaults)
        #expect(MusicPermissionMemory.lastAnswer(in: defaults))
        MusicPermissionMemory.record(.denied, in: defaults)
        #expect(!MusicPermissionMemory.lastAnswer(in: defaults))
        // A script that ran says yes, and one Music refused says no.
        MusicPermissionMemory.record(allowed: true, in: defaults)
        #expect(MusicPermissionMemory.lastAnswer(in: defaults))
        MusicPermissionMemory.record(.notAsked, in: defaults)
        #expect(!MusicPermissionMemory.lastAnswer(in: defaults))
    }

    @Test func ignoresChecksThatCouldntReachMusic() {
        MusicPermissionMemory.record(.allowed, in: defaults)
        MusicPermissionMemory.record(.musicNotRunning, in: defaults)
        MusicPermissionMemory.record(.unknown(-1), in: defaults)
        #expect(MusicPermissionMemory.lastAnswer(in: defaults))
    }
}
