import AppKit
import SwiftUI

/// AppKit's search field, for the native look, its clear button and Escape
/// to clear. It takes the keyboard when it appears, so you can type to
/// search straight away, and focus doesn't land on the first disc instead.
struct SearchField: NSViewRepresentable {
    @Binding var text: String
    let prompt: String

    func makeNSView(context: Context) -> NSSearchField {
        let field = FocusingSearchField()
        field.placeholderString = prompt
        field.sendsSearchStringImmediately = true
        field.target = context.coordinator
        field.action = #selector(Coordinator.searchChanged(_:))
        return field
    }

    func updateNSView(_ field: NSSearchField, context: Context) {
        context.coordinator.text = $text
        if field.stringValue != text { field.stringValue = text }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    final class FocusingSearchField: NSSearchField {
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            // After the window has picked its own first responder.
            Task { @MainActor [weak self] in
                guard let self, let window else { return }
                window.makeFirstResponder(self)
            }
        }
    }

    @MainActor final class Coordinator: NSObject {
        var text: Binding<String>

        init(text: Binding<String>) {
            self.text = text
        }

        /// Every keystroke, and the clear button.
        @objc func searchChanged(_ field: NSSearchField) {
            text.wrappedValue = field.stringValue
        }
    }
}
