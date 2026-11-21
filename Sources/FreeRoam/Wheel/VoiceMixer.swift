import AVFoundation
import os

/// Mixes short sounds sample by sample on the audio thread, so a sound can
/// fade out at an exact point, as Web Audio's gain ramps did in the
/// website. `AVAudioPlayerNode` can only cut a sound off, which clicks.
///
/// Not main-actor isolated: the render block runs on the audio thread, and
/// a closure formed on the main actor would trap there.
final class VoiceMixer: Sendable {
    struct Voice {
        let samples: [Float]
        let gain: Float
        let isRetune: Bool
        private(set) var position = 0
        /// The level falls linearly from `gain` at `fadeStart` to 0 at `end`,
        /// where the voice stops. With no fade, both are the sample count.
        private(set) var fadeStart: Int
        private(set) var end: Int

        init(samples: [Float], gain: Float, isRetune: Bool = false, fadeFrames: Int = 0) {
            self.samples = samples
            self.gain = gain
            self.isRetune = isRetune
            end = samples.count
            fadeStart = max(samples.count - fadeFrames, 0)
        }

        var isFinished: Bool { position >= end }

        mutating func fadeOut(over frames: Int) {
            fadeStart = position
            end = min(end, position + frames)
        }

        mutating func add(into output: UnsafeMutablePointer<Float>, count: Int) {
            let frames = min(count, end - position)
            guard frames > 0 else { return }
            samples.withUnsafeBufferPointer { source in
                for frame in 0..<frames {
                    let index = position + frame
                    var level = gain
                    if index >= fadeStart { level *= Float(end - index) / Float(end - fadeStart) }
                    output[frame] += source[index] * level
                }
            }
            position += frames
        }
    }

    let sampleRate: Double
    private let voices = OSAllocatedUnfairLock(initialState: [Voice]())

    init(sampleRate: Double) {
        self.sampleRate = sampleRate
    }

    /// Mono, which every sound is.
    var format: AVAudioFormat {
        AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
    }

    func play(_ voice: Voice) {
        voices.withLock { $0.append(voice) }
    }

    /// Only one retune plays at a time. A new one fades out the last over a
    /// few milliseconds instead of stacking on it.
    func fadeOutRetunes(over frames: Int) {
        voices.withLock { voices in
            for index in voices.indices where voices[index].isRetune {
                voices[index].fadeOut(over: frames)
            }
        }
    }

    func makeNode() -> AVAudioSourceNode {
        AVAudioSourceNode(format: format) { [voices] _, _, frameCount, bufferList in
            let count = Int(frameCount)
            guard let output = UnsafeMutableAudioBufferListPointer(bufferList).first?.mData?
                .assumingMemoryBound(to: Float.self) else { return noErr }
            output.update(repeating: 0, count: count)
            // Unchecked because the closure holds the output pointer, which
            // never leaves this call.
            voices.withLockUnchecked { voices in
                for index in voices.indices { voices[index].add(into: output, count: count) }
                voices.removeAll(where: \.isFinished)
            }
            return noErr
        }
    }
}
