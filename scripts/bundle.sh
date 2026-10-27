#!/bin/bash
# Builds dist/Free Roam.app from the Swift package and signs it.
#
#   scripts/bundle.sh          build dist/Free Roam.app
#   scripts/bundle.sh --run    build, quit the running copy and open the new one
#
# BUILD_NUMBER overrides CFBundleVersion, which defaults to the commit count.
set -euo pipefail

cd "$(dirname "$0")/.."

APP="$PWD/dist/Free Roam.app"
BUILD_NUMBER="${BUILD_NUMBER:-$(git rev-list --count HEAD)}"
SIGN_IDENTITY="Free Roam Development"

swift build --product FreeRoam
BIN_DIR="$(swift build --show-bin-path)"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/FreeRoam" "$APP/Contents/MacOS/FreeRoam"
cp Sources/FreeRoam/Info.plist "$APP/Contents/Info.plist"

# Resources go in Contents/Resources and are read through Bundle.main. SwiftPM
# resource bundles expect to sit next to Contents, where codesign rejects them.
cp prototype/tokens.json "$APP/Contents/Resources/tokens.json"
# The sounds the wheel plays. Like the prototype's Local pack, your own WAVs in
# the gitignored prototype/public/sounds/local/ replace the synthesised ones
# they share a name with. They're for builds on your own Mac: a release build
# must only ever contain the synthesised sounds.
RETUNE_TAKE="$(plutil -extract behaviour.retuneTake raw -o - prototype/tokens.json)"
for sound in open close hover "$RETUNE_TAKE"; do
  source="prototype/public/sounds/$sound.wav"
  if [[ -f "prototype/public/sounds/local/$sound.wav" ]]; then
    source="prototype/public/sounds/local/$sound.wav"
    echo "Using your local $sound.wav"
  fi
  cp "$source" "$APP/Contents/Resources/$sound.wav"
done
# The caption font and its licence (SIL OFL), which has to travel with it.
cp Sources/FreeRoam/Resources/SofiaSansExtraCondensed-SemiBold.ttf Sources/FreeRoam/Resources/OFL.txt "$APP/Contents/Resources/"
# The app icon, menu bar glyph and welcome window badge, from
# scripts/make-brand-assets.sh.
cp Sources/FreeRoam/Resources/AppIcon.icns Sources/FreeRoam/Resources/MenuBarIconTemplate.png \
  Sources/FreeRoam/Resources/MenuBarIconTemplate@2x.png Sources/FreeRoam/Resources/FreeRoamBadge.png \
  "$APP/Contents/Resources/"
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
  # Matching the full path leaves any other process called FreeRoam alone.
  pkill -f "$APP/Contents/MacOS/FreeRoam" || true
  while pgrep -f "$APP/Contents/MacOS/FreeRoam" >/dev/null; do sleep 0.1; done
  open "$APP"
fi
