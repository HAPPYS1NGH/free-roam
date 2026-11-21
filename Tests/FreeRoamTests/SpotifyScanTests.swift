import Foundation
import Testing
@testable import FreeRoam

struct SpotifyScanTests {
    private func reading(
        _ state: SpotifyScan.PlayerState = .playing,
        uri: String = "spotify:track:4HCOHRCSQelz2GPX8iTamO",
        position: TimeInterval = 0
    ) -> SpotifyScan.Reading {
        SpotifyScan.Reading(
            state: state, position: position, uri: uri, title: "Title", artist: "Artist", album: "Album",
            durationMilliseconds: 218_384, artworkURL: "https://i.scdn.co/image/ab67616d0000b273"
        )
    }

    private func track(_ uri: String) -> SpotifyTrack {
        SpotifyTrack(uri: uri, title: "", artist: "", album: "", duration: 1, artworkURL: nil)
    }

    private let first = "spotify:track:4HCOHRCSQelz2GPX8iTamO"
    private let second = "spotify:track:2sFepQNyl1WjpROruP8bJ0"

    @Test func convertsMillisecondsToSeconds() {
        #expect(SpotifyScan.seconds(fromMilliseconds: 218_384) == 218.384)
        #expect(SpotifyScan.seconds(fromMilliseconds: 0) == 0)
        #expect(SpotifyScan.seconds(fromMilliseconds: -5) == 0)
        #expect(SpotifyScan.seconds(fromMilliseconds: .nan) == 0)
        #expect(SpotifyScan.seconds(fromMilliseconds: .infinity) == 0)
    }

    @Test func makesATrackFromAReading() throws {
        let track = try #require(SpotifyScan.track(from: reading()))
        #expect(track.uri == first)
        #expect(track.duration == 218.384)
        #expect(track.artworkURL == URL(string: "https://i.scdn.co/image/ab67616d0000b273"))
    }

    @Test func dropsReadingsThatArentPlayableTracks() {
        #expect(SpotifyScan.track(from: reading(uri: "spotify:ad:123")) == nil)
        #expect(SpotifyScan.track(from: reading(uri: "")) == nil)
        #expect(SpotifyScan.track(from: reading(uri: "spotify:track:\"; beep")) == nil)
    }

    @Test func keepsNoArtworkLinkThatIsntHTTPS() {
        var plain = reading()
        plain.artworkURL = "http://i.scdn.co/image/x"
        #expect(SpotifyScan.track(from: plain)?.artworkURL == nil)
        plain.artworkURL = ""
        #expect(SpotifyScan.track(from: plain)?.artworkURL == nil)
    }

    @Test func recordsTracksAndSkipsAds() {
        #expect(SpotifyScan.step(for: reading(), recorded: []) == .record)
        #expect(SpotifyScan.step(for: reading(uri: second), recorded: [track(first)]) == .record)
        #expect(SpotifyScan.step(for: reading(uri: "spotify:ad:123"), recorded: [track(first)]) == .skip)
        #expect(SpotifyScan.step(for: reading(uri: "spotify:episode:4HCOHRCSQelz2GPX8iTamO"), recorded: []) == .skip)
    }

    /// Measured: after the last track with repeat off, Spotify loads the
    /// first track again, paused at 0:00.
    @Test func endsWhenSpotifyStopsOrPausesOnTheFirstTrackAgain() {
        let recorded = [track(first), track(second)]
        #expect(SpotifyScan.step(for: reading(.paused, uri: first), recorded: recorded) == .end)
        #expect(SpotifyScan.step(for: reading(.stopped, uri: ""), recorded: recorded) == .end)
    }

    @Test func endsOnAWrapThatKeepsPlaying() {
        #expect(SpotifyScan.step(for: reading(uri: first), recorded: [track(first), track(second)]) == .end)
    }

    @Test func aRepeatedTrackAfterTheFirstIsNotAWrapWithoutTwoTracksRecorded() {
        #expect(SpotifyScan.step(for: reading(uri: first), recorded: [track(first)]) == .record)
    }

    @Test func advancesOnceTheTrackChanges() {
        let previous = reading(uri: first)
        #expect(SpotifyScan.advance(from: previous, to: reading(uri: first), pausedFor: nil) == .waiting)
        #expect(SpotifyScan.advance(from: previous, to: reading(uri: second), pausedFor: nil) == .moved)
        #expect(SpotifyScan.advance(from: previous, to: reading(uri: "spotify:ad:1"), pausedFor: nil) == .moved)
    }

    @Test func waitsOutAPauseWhileATrackLoads() {
        let previous = reading(uri: first)
        let loading = reading(.paused, uri: second)
        #expect(SpotifyScan.advance(from: previous, to: loading, pausedFor: .zero) == .waiting)
        #expect(SpotifyScan.advance(from: previous, to: loading, pausedFor: .milliseconds(300)) == .waiting)
        #expect(SpotifyScan.advance(from: previous, to: loading, pausedFor: .milliseconds(600)) == .ended)
        #expect(SpotifyScan.advance(from: previous, to: reading(.stopped, uri: ""), pausedFor: .seconds(1)) == .ended)
    }

    @Test func readsStatesCaseInsensitively() {
        #expect(SpotifyScan.PlayerState("playing") == .playing)
        #expect(SpotifyScan.PlayerState("Paused") == .paused)
        #expect(SpotifyScan.PlayerState("stopped") == .stopped)
        #expect(SpotifyScan.PlayerState("") == .unknown)
    }

    @Test func stopsAt300Tracks() {
        #expect(SpotifyScan.trackLimit == 300)
    }
}
