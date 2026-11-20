import Foundation
import Testing
@testable import FreeRoam

struct RingColorTests {
    private func defaults() throws -> UserDefaults {
        let name = "RingColorTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: name))
        defaults.removePersistentDomain(forName: name)
        return defaults
    }

    /// Multicolor removes the key, and apps get system blue rather than a colour you chose.
    @Test func multicolorKeepsFreeRoamsBlue() throws {
        #expect(!RingColor.followsSystemAccent(try defaults()))
    }

    @Test(arguments: [-1, 0, 4, 6])
    func anAccentYouChoseIsFollowed(_ accent: Int) throws {
        let defaults = try defaults()
        defaults.set(accent, forKey: "AppleAccentColor")
        #expect(RingColor.followsSystemAccent(defaults))
    }
}
