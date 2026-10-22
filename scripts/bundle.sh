#!/bin/bash
# Builds dist/Static.app from the Swift package and signs it.
#
#   scripts/bundle.sh          build dist/Static.app
#   scripts/bundle.sh --run    build, quit the running copy and open the new one
#
# BUILD_NUMBER overrides CFBundleVersion, which defaults to the commit count.
set -euo pipefail

cd "$(dirname "$0")/.."

APP="$PWD/dist/Static.app"
BUILD_NUMBER="${BUILD_NUMBER:-$(git rev-list --count HEAD)}"
SIGN_IDENTITY="Static Development"

swift build --product Static
BIN_DIR="$(swift build --show-bin-path)"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/Static" "$APP/Contents/MacOS/Static"
cp Sources/Static/Info.plist "$APP/Contents/Info.plist"

# Resources go in Contents/Resources and are read through Bundle.main. SwiftPM
# resource bundles expect to sit next to Contents, where codesign rejects them.
cp prototype/tokens.json "$APP/Contents/Resources/tokens.json"
# The caption font and its licence (SIL OFL), which has to travel with it.
cp Sources/Static/Resources/SofiaSansExtraCondensed-SemiBold.ttf Sources/Static/Resources/OFL.txt "$APP/Contents/Resources/"
plutil -replace CFBundleVersion -string "$BUILD_NUMBER" "$APP/Contents/Info.plist"

# Ad-hoc signatures change with every build, and macOS drops Screen Recording
# permission whenever they do. scripts/make-signing-cert.sh creates a stable
# identity. errSecInternalComponent means codesign couldn't reach the keychain,
# e.g. from an SSH or sandboxed shell.
if security find-identity -p codesigning | grep -q "\"$SIGN_IDENTITY\""; then
  codesign --force --sign "$SIGN_IDENTITY" "$APP"
else
  echo "warning: no \"$SIGN_IDENTITY\" certificate, so signing ad hoc and Screen Recording permission resets on every build. Run scripts/make-signing-cert.sh once to keep it." >&2
  codesign --force --sign - "$APP"
fi
echo "Built $APP (build $BUILD_NUMBER)"

if [[ "${1:-}" == "--run" ]]; then
  # Matching the full path leaves any other process called Static alone.
  pkill -f "$APP/Contents/MacOS/Static" || true
  while pgrep -f "$APP/Contents/MacOS/Static" >/dev/null; do sleep 0.1; done
  open "$APP"
fi
