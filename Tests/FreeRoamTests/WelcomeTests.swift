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
    /// is allowed, and fits a small laptop screen.
    @Test func keepsOneSizeInEveryState() throws {
        let sizes = try [
            WelcomeContent(musicAllowed: false, screenRecordingAllowed: false),
            WelcomeContent(musicAllowed: false, screenRecordingAllowed: false, isAskingForMusic: true),
            WelcomeContent(musicAllowed: true, screenRecordingAllowed: false),
            WelcomeContent(musicAllowed: true, screenRecordingAllowed: true),
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
