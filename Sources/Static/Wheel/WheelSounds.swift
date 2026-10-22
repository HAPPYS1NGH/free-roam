import AVFoundation
import OSLog

private let log = Logger(subsystem: "com.happys1ngh.static", category: "sound")

/// The wheel's sounds, from the .wav files scripts/bundle.sh copies out of
/// `prototype/public/sounds`. Ported from `prototype/src/sound.ts`.
@MainActor
final class WheelSounds {
    enum Name: String, CaseIterable {
        case open, close, hover, retune
    }

    /// The prototype's synthesised sounds are all 44.1 kHz mono.
    private static let sampleRate = 44_100.0
    /// Volumes are in dB, and at this level a sound is off.
    private static let silentDb = -60.0
    /// A new retune fades out the last one over this long. A ramp, not a cut,
    /// so it doesn't click.
    private static let retuneFade = 0.012
    /// The retune's static is loud for its first 150 ms and then dies away.
    private static let retuneBody = Duration.milliseconds(150)
    /// A running engine keeps the audio device busy, so it stops this long
    /// after the last sound and starts again on the next press.
    private static let idleTime = Duration.seconds(10)

    private let engine = AVAudioEngine()
    private let mixer = VoiceMixer(sampleRate: sampleRate)
    private let samples: [Name: [Float]]
    private let levels: [Name: Float]
    private var hover = HoverTicker()
    private var lastRetune: ContinuousClock.Instant?
    private var idleStop: Task<Void, Never>?
    private let clock = ContinuousClock()

    init(behaviour: WheelStyle.Behaviour) {
        let files: [Name: String] = [.open: "open", .close: "close", .hover: "hover", .retune: behaviour.retuneTake]
        samples = files.compactMapValues(Self.load)
        let levels: [Name: Double] = [
            .open: behaviour.uiVolumeDb,
            .close: behaviour.uiVolumeDb,
            .hover: behaviour.hoverVolumeDb,
            .retune: behaviour.retuneVolumeDb,
        ]
        self.levels = levels.compactMapValues { $0 > Self.silentDb ? Float(pow(10, $0 / 20)) : nil }

        let node = mixer.makeNode()
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: mixer.format)
    }

    /// Starts the engine ahead of the first sound, so it doesn't land late.
    func prepare() {
        idleStop?.cancel()
        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                log.error("Couldn't start the sound engine: \(String(describing: error), privacy: .public)")
            }
        }
        idleStop = Task { [engine] in
            try? await Task.sleep(for: Self.idleTime)
            guard !Task.isCancelled else { return }
            engine.stop()
        }
    }

    func play(_ name: Name) {
        switch name {
        case .hover: playHover()
        case .retune: playRetune()
        case .open, .close: start(name)
        }
    }

    /// Every station the highlight passes gets its own tick, which gets
    /// quieter, darker and shorter the faster you sweep, so a sweep purrs
    /// instead of buzzing.
    private func playHover() {
        guard let source = samples[.hover], let level = levels[.hover] else { return }
        let duration = Double(source.count) / Self.sampleRate
        guard let tick = hover.tick(at: ProcessInfo.processInfo.systemUptime, duration: duration) else { return }
        let frames = min(Int(tick.duration * Self.sampleRate), source.count)
        let filtered = lowPass(source[..<frames], cutoff: tick.cutoff, sampleRate: Self.sampleRate)
        start(VoiceMixer.Voice(
            samples: filtered,
            gain: level * Float(tick.gain),
            fadeFrames: Int(HoverTicker.fade * Self.sampleRate)
        ))
    }

    /// Keeps the static going until the task is cancelled, by starting the
    /// retune again whenever its loud part ends. Each one fades out the last,
    /// so it sounds like one long burst, and the last one dies away as usual.
    func holdRetune() -> Task<Void, Never> {
        Task {
            while !Task.isCancelled {
                if let lastRetune, clock.now < lastRetune + Self.retuneBody {
                    try? await Task.sleep(until: lastRetune + Self.retuneBody, clock: clock)
                    continue
                }
                playRetune()
            }
        }
    }

    private func playRetune() {
        guard let source = samples[.retune], let level = levels[.retune] else { return }
        mixer.fadeOutRetunes(over: Int(Self.retuneFade * Self.sampleRate))
        start(VoiceMixer.Voice(samples: source, gain: level, isRetune: true))
        lastRetune = clock.now
    }

    private func start(_ name: Name) {
        guard let source = samples[name], let level = levels[name] else { return }
        start(VoiceMixer.Voice(samples: source, gain: level))
    }

    private func start(_ voice: VoiceMixer.Voice) {
        prepare()
        mixer.play(voice)
    }

    private static func load(_ name: String) -> [Float]? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "wav") else {
            log.error("Sound \(name, privacy: .public).wav isn't in the app")
            return nil
        }
        do {
            let file = try AVAudioFile(forReading: url, commonFormat: .pcmFormatFloat32, interleaved: false)
            let format = file.processingFormat
            guard format.sampleRate == sampleRate, format.channelCount == 1 else {
                log.error("Sound \(name, privacy: .public).wav isn't 44.1 kHz mono")
                return nil
            }
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(file.length)) else {
                return nil
            }
            try file.read(into: buffer)
            guard let channel = buffer.floatChannelData?[0] else { return nil }
            return Array(UnsafeBufferPointer(start: channel, count: Int(buffer.frameLength)))
        } catch {
            log.error("Couldn't read \(name, privacy: .public).wav: \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}

/// Like the iPod click wheel, every station passed ticks, on the same event
/// that moves the highlight. Each tick adds 1 to a busyness that decays over
/// `busyDecay`, so it's 1 after a rest, about 1.6 at 10 stations a second
/// and 3.5 at 30. A tick's gain falls with its square root, which keeps a
/// sweep about as loud as one tick, and its low-pass cutoff falls with it.
/// It's also cut short just before the next tick is due, so ticks never
/// overlap and comb into a buzz.
struct HoverTicker {
    struct Tick: Equatable {
        /// A fraction of the hover volume.
        let gain: Double
        /// Hertz.
        let cutoff: Double
        /// Seconds, at most the sound's own length.
        let duration: Double
    }

    static let busyDecay = 0.1
    /// Ticks this close together come from one input event; one is enough.
    static let minGap = 0.008
    static let brightHz = 9000.0
    /// Each tick fades out over its last few milliseconds.
    static let fade = 0.006

    private var last = -Double.infinity
    private var busyness = 0.0

    /// Takes the time in seconds and the hover sound's length, or returns nil
    /// when this tick should be skipped.
    mutating func tick(at time: Double, duration: Double) -> Tick? {
        let elapsed = time - last
        guard elapsed >= Self.minGap else { return nil }
        last = time
        busyness = busyness * exp(-elapsed / Self.busyDecay) + 1
        return Tick(
            gain: 1 / busyness.squareRoot(),
            cutoff: Self.brightHz / busyness,
            // The next tick is expected as soon after this one as this one
            // came after the last.
            duration: min(duration, elapsed * 0.8)
        )
    }
}

/// A two-pole low-pass, as Web Audio's `BiquadFilterNode` computes it with its
/// default Q of 1 dB.
func lowPass(_ input: ArraySlice<Float>, cutoff: Double, sampleRate: Double) -> [Float] {
    let w0 = 2 * Double.pi * min(cutoff, sampleRate / 2) / sampleRate
    let alpha = sin(w0) / (2 * pow(10, 1.0 / 20))
    let a0 = 1 + alpha
    let b0 = Float((1 - cos(w0)) / 2 / a0)
    let b1 = Float((1 - cos(w0)) / a0)
    let a1 = Float(-2 * cos(w0) / a0)
    let a2 = Float((1 - alpha) / a0)
    var x1: Float = 0, x2: Float = 0, y1: Float = 0, y2: Float = 0
    return input.map { x in
        let y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2
        x2 = x1
        x1 = x
        y2 = y1
        y1 = y
        return y
    }
}
