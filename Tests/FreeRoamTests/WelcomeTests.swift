import AppKit
import SwiftUI
import Testing
@testable import FreeRoam

struct WelcomeTests {
    @Test(arguments: [(false, false), (true, false), (false, true), (true, true)])
    func neverShowsOnceYouSaidNotTo(musicAllowed: Bool, screenRecordingAllowed: Bool) {
        #expect(!WelcomeModel.shouldShow(dontShowAgain: true, musicAllowed: musicAllowed, screenRecordingAllowed: screenRecordingAllowed))
    }

    @Test func hidesOnceBothPermissionsAreAllowed() {
        #expect(!WelcomeModel.shouldShow(dontShowAgain: false, musicAllowed: true, screenRecordingAllowed: true))
    }

    /// Including after closing it with the close button, which saves nothing.
    @Test(arguments: [(false, false), (true, false), (false, true)])
    func showsWhileAPermissionIsMissing(musicAllowed: Bool, screenRecordingAllowed: Bool) {
        #expect(WelcomeModel.shouldShow(dontShowAgain: false, musicAllowed: musicAllowed, screenRecordingAllowed: screenRecordingAllowed))
    }

    @Test func musicsAnswerWinsWhileItsRunning() {
        for lastAnswer in [false, true] {
            #expect(WelcomeModel.isMusicAllowed(.allowed, lastAnswer: lastAnswer))
            #expect(!WelcomeModel.isMusicAllowed(.denied, lastAnswer: lastAnswer))
            #expect(!WelcomeModel.isMusicAllowed(.notAsked, lastAnswer: lastAnswer))
        }
    }

    /// Otherwise the window would come back at every launch with Music closed.
    @Test func theLastAnswerStandsWhileMusicIsClosed() {
        #expect(WelcomeModel.isMusicAllowed(.musicNotRunning, lastAnswer: true))
        #expect(!WelcomeModel.isMusicAllowed(.musicNotRunning, lastAnswer: false))
        #expect(WelcomeModel.isMusicAllowed(.unknown(-1), lastAnswer: true))
    }
}

@MainActor
struct WelcomeRenderTests {
    /// The window can't be resized, so the content keeps one size whatever
    /// is allowed, and fits a small laptop screen. The badge comes from the
    /// source tree, since tests have no app bundle, and leaving it out
    /// (as `swift run` does) keeps the same size too.
    @Test func keepsOneSizeInEveryState() throws {
        let badgeURL = URL(filePath: #filePath)
            .deletingLastPathComponent()
            .appending(path: "../../Sources/FreeRoam/Resources/FreeRoamBadge.png")
        let badge = try #require(NSImage(contentsOf: badgeURL))
        let sizes = try [
            WelcomeContent(badge: badge, musicAllowed: false, screenRecordingAllowed: false),
            WelcomeContent(badge: badge, musicAllowed: false, screenRecordingAllowed: false, isAskingForMusic: true),
            WelcomeContent(badge: badge, musicAllowed: true, screenRecordingAllowed: false),
            WelcomeContent(badge: badge, musicAllowed: true, screenRecordingAllowed: true),
            WelcomeContent(badge: badge, musicAllowed: true, screenRecordingAllowed: true, launchesAtLogin: true),
            WelcomeContent(badge: nil, musicAllowed: false, screenRecordingAllowed: false),
        ].map { content in
            let renderer = ImageRenderer(content: content)
            renderer.scale = 1
            let image = try #require(renderer.cgImage)
            return [image.width, image.height]
        }
        #expect(sizes.allSatisfy { $0 == sizes[0] }, "\(sizes)")
        #expect(Double(sizes[0][0]) == WelcomeContent.width)
        #expect(sizes[0][1] < 700)
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
            contentViewController: NSHostingController(rootView: WelcomeContent(musicAllowed: false, screenRecordingAllowed: false))
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
