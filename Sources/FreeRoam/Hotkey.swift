import AppKit
import Carbon.HIToolbox

enum HotkeyError: LocalizedError {
    case carbon(OSStatus)

    var errorDescription: String? {
        switch self {
        case .carbon(OSStatus(eventHotKeyExistsErr)): "Another app already uses this shortcut."
        case .carbon(let status): "Couldn't register the shortcut (\(status))."
        }
    }
}

/// A global shortcut registered with Carbon's `RegisterEventHotKey`. It needs
/// no permission and only matches this exact key and modifiers, so plain keys
/// still reach the frontmost app.
///
/// Every press gets exactly one release. Carbon sends the key-up only when the
/// key itself comes up, which can be well after the modifiers, so while the key
/// is down the modifiers are polled too and letting go of them counts as
/// letting go of the shortcut, as with ⌘Tab. That also means a key-up that
/// never arrives can't keep a press going.
@MainActor
final class Hotkey {
    var onPress: () -> Void = {}
    var onRelease: (_ modifiersFirst: Bool) -> Void = { _ in }
    private(set) var isDown = false

    private let keyCode: Int
    private let modifiers: NSEvent.ModifierFlags
    private let id: UInt32
    private var registration: EventHotKeyRef?
    private var modifierPoll: Task<Void, Never>?

    private static var registered: [UInt32: Hotkey] = [:]
    private static var lastID: UInt32 = 0
    private static var handlerInstalled = false
    /// 'FRRM'
    nonisolated private static let signature: OSType = 0x4652_524D

    init(keyCode: Int, modifiers: NSEvent.ModifierFlags) {
        self.keyCode = keyCode
        self.modifiers = modifiers
        Self.lastID += 1
        id = Self.lastID
    }

    func register() throws(HotkeyError) {
        guard registration == nil else { return }
        try Self.installHandler()
        let hotkeyID = EventHotKeyID(signature: Self.signature, id: id)
        let status = RegisterEventHotKey(
            UInt32(keyCode), carbonModifiers, hotkeyID, GetEventDispatcherTarget(), 0, &registration
        )
        guard status == noErr else { throw .carbon(status) }
        Self.registered[id] = self
    }

    /// A press in progress ends without a release.
    func unregister() {
        guard let registration else { return }
        UnregisterEventHotKey(registration)
        self.registration = nil
        Self.registered[id] = nil
        modifierPoll?.cancel()
        modifierPoll = nil
        isDown = false
    }

    private func pressed() {
        // Ignores key repeat.
        guard !isDown else { return }
        isDown = true
        modifierPoll = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(16))
                guard let self, !Task.isCancelled else { return }
                if !NSEvent.modifierFlags.contains(self.modifiers) { self.released(modifiersFirst: true) }
            }
        }
        onPress()
    }

    private func released(modifiersFirst: Bool) {
        guard isDown else { return }
        isDown = false
        modifierPoll?.cancel()
        modifierPoll = nil
        onRelease(modifiersFirst)
    }

    private var carbonModifiers: UInt32 {
        var flags = 0
        if modifiers.contains(.command) { flags |= cmdKey }
        if modifiers.contains(.option) { flags |= optionKey }
        if modifiers.contains(.control) { flags |= controlKey }
        if modifiers.contains(.shift) { flags |= shiftKey }
        return UInt32(flags)
    }

    private static func installHandler() throws(HotkeyError) {
        guard !handlerInstalled else { return }
        let kinds = [kEventHotKeyPressed, kEventHotKeyReleased].map {
            EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32($0))
        }
        let status = InstallEventHandler(GetEventDispatcherTarget(), { _, event, _ in
            Hotkey.handle(event)
        }, kinds.count, kinds, nil, nil)
        guard status == noErr else { throw .carbon(status) }
        handlerInstalled = true
    }

    /// Carbon delivers hotkey events on the main thread.
    nonisolated private static func handle(_ event: EventRef?) -> OSStatus {
        guard let event else { return OSStatus(eventNotHandledErr) }
        var hotkeyID = EventHotKeyID()
        let status = GetEventParameter(
            event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID),
            nil, MemoryLayout<EventHotKeyID>.size, nil, &hotkeyID
        )
        guard status == noErr, hotkeyID.signature == signature else { return OSStatus(eventNotHandledErr) }
        let isPress = GetEventKind(event) == UInt32(kEventHotKeyPressed)
        MainActor.assumeIsolated {
            guard let hotkey = registered[hotkeyID.id] else { return }
            if isPress { hotkey.pressed() } else { hotkey.released(modifiersFirst: false) }
        }
        return noErr
    }
}
