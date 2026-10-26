#if DEBUG
import ApplicationServices
import Foundation

/// Prints what macOS currently lets Free Roam do, without prompting, and quits:
///
///     open -n -W --stdout "$TMPDIR/probe.txt" "dist/Free Roam.app" --args --probe
///     cat "$TMPDIR/probe.txt"
///
/// Launch it with `open`. Run straight from a terminal, macOS checks the
/// terminal's permissions instead of Free Roam's.
enum PermissionProbe {
    static func printAndExit() -> Never {
        print("music: \(MusicBridge.permission().label)")
        print("screen recording: \(ScreenCapture.isAllowed ? "allowed" : "not allowed")")
        // Free Roam shouldn't need either: the hotkey and wheel input are meant
        // to work without them.
        print("accessibility: \(AXIsProcessTrusted() ? "allowed" : "not allowed")")
        print("input monitoring: \(CGPreflightListenEventAccess() ? "allowed" : "not allowed")")
        exit(0)
    }
}
#endif
