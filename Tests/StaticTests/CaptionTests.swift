import Foundation
import Testing
@testable import Static

struct CaptionTests {
    private let station = Playlist(id: "B965EB2A37B2731C", name: "Late Night")
    private let tracks = [
        Track(title: "Nights", artist: "Frank Ocean", album: "Blonde", duration: 100),
        Track(title: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", duration: 200),
    ]

    @Test func radioOffIsOneLine() {
        let caption = CaptionLines(station: nil, tracks: nil, at: Broadcast.epoch)
        #expect([caption.station, caption.artist, caption.title] == ["Radio Off", "", ""])
    }

    @Test func showsTheTrackOnAir() {
        let caption = CaptionLines(station: station, tracks: tracks, at: Broadcast.epoch.addingTimeInterval(150))
        #expect([caption.station, caption.artist, caption.title] == ["Late Night", "M83", "Midnight City"])
    }

    @Test func showsTheNameAloneUntilTheTracksLoad() {
        let caption = CaptionLines(station: station, tracks: nil, at: Broadcast.epoch)
        #expect([caption.station, caption.artist, caption.title] == ["Late Night", "", ""])
    }

    @Test func saysWhenThereIsNothingToPlay() {
        let caption = CaptionLines(station: station, tracks: [], at: Broadcast.epoch)
        #expect([caption.station, caption.artist, caption.title] == ["Late Night", "", "No songs"])
    }

    @Test(arguments: [
        ("Gym Bangers", "GB"),
        ("☕ Sunday Coffee", "SC"),
        ("Hype", "H"),
        ("late night drives through cities", "LN"),
        ("2000s", "2"),
        ("☕", ""),
    ])
    func initials(_ name: String, _ expected: String) {
        #expect(RadioWheelView.initials(of: name) == expected)
    }
}
