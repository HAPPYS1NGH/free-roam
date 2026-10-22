#if DEBUG
import Foundation

/// Prints what macOS currently lets Static do, without prompting, and quits:
///
///     open -n -W --stdout "$TMPDIR/probe.txt" dist/Static.app --args --probe
///     cat "$TMPDIR/probe.txt"
///
/// Launch it with `open`. Run straight from a terminal, macOS checks the
/// terminal's permissions instead of Static's.
enum PermissionProbe {
    static func printAndExit() -> Never {
        print("music: \(MusicBridge.permission().label)")
        print("screen recording: \(ScreenCapture.isAllowed ? "allowed" : "not allowed")")
        exit(0)
    }
}
#endif
