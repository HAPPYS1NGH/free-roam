import Testing
@testable import FreeRoam

struct HoverTickerTests {
    @Test func firstTickIsFullAndBright() {
        var ticker = HoverTicker()
        let tick = ticker.tick(at: 10, duration: 0.034)
        #expect(tick == .init(gain: 1, cutoff: HoverTicker.brightHz, duration: 0.034))
    }

    @Test func ticksFromOneEventPlayOnce() {
        var ticker = HoverTicker()
        _ = ticker.tick(at: 10, duration: 0.034)
        let tick = ticker.tick(at: 10.005, duration: 0.034)
        #expect(tick == nil)
    }

    @Test func aFastSweepGetsQuieterDarkerAndShorter() throws {
        var ticker = HoverTicker()
        var tick: HoverTicker.Tick?
        // 30 stations a second.
        for step in 0..<30 { tick = ticker.tick(at: 10 + Double(step) / 30, duration: 0.034) }
        let last = try #require(tick)
        #expect(last.gain < 0.6)
        #expect(last.cutoff < HoverTicker.brightHz / 3)
        #expect(abs(last.duration - 0.8 / 30) < 0.0001)
    }

    @Test func aRestBringsTheFullTickBack() throws {
        var ticker = HoverTicker()
        for step in 0..<30 { _ = ticker.tick(at: 10 + Double(step) / 30, duration: 0.034) }
        let tick = ticker.tick(at: 20, duration: 0.034)
        let rested = try #require(tick)
        #expect(abs(rested.gain - 1) < 0.0001)
        #expect(rested.duration == 0.034)
    }
}

struct VoiceMixerTests {
    private func render(_ voice: inout VoiceMixer.Voice, frames: Int) -> [Float] {
        var output = [Float](repeating: 0, count: frames)
        output.withUnsafeMutableBufferPointer { voice.add(into: $0.baseAddress!, count: frames) }
        return output
    }

    @Test func fadesOutOverItsLastFrames() {
        var voice = VoiceMixer.Voice(samples: [Float](repeating: 1, count: 6), gain: 0.5, fadeFrames: 4)
        let output = render(&voice, frames: 8)
        #expect(output == [0.5, 0.5, 0.5, 0.375, 0.25, 0.125, 0, 0])
        #expect(voice.isFinished)
    }

    @Test func fadingOutEndsItEarly() {
        var voice = VoiceMixer.Voice(samples: [Float](repeating: 1, count: 100), gain: 1, isRetune: true)
        _ = render(&voice, frames: 10)
        voice.fadeOut(over: 4)
        let output = render(&voice, frames: 6)
        #expect(output == [1, 0.75, 0.5, 0.25, 0, 0])
        #expect(voice.isFinished)
    }
}

struct LowPassTests {
    @Test func passesASteadyLevel() throws {
        let output = lowPass(ArraySlice(repeating: 1, count: 2000), cutoff: 1000, sampleRate: 44_100)
        #expect(abs(try #require(output.last) - 1) < 0.001)
    }

    @Test func cutsHighFrequencies() {
        let input = ArraySlice((0..<2000).map { $0.isMultiple(of: 2) ? Float(1) : -1 })
        let output = lowPass(input, cutoff: 1000, sampleRate: 44_100)
        #expect(output.suffix(100).allSatisfy { abs($0) < 0.01 })
    }
}
