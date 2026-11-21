#!/bin/bash
# Builds dist/Free Roam.app from the Swift package and signs it.
#
#   scripts/bundle.sh          build dist/Free Roam.app
#   scripts/bundle.sh --run    build, quit the running copy and open the new one
#   scripts/bundle.sh --release  universal release build, signed with Developer
#                                ID and the hardened runtime (scripts/release.sh
#                                notarizes it and makes the DMG)
#
# BUILD_NUMBER overrides CFBundleVersion, which defaults to the commit count.
set -euo pipefail

cd "$(dirname "$0")/.."

APP="$PWD/dist/Free Roam.app"
BUILD_NUMBER="${BUILD_NUMBER:-$(git rev-list --count HEAD)}"
SIGN_IDENTITY="Free Roam Development"
MODE="${1:-}"

if [[ "$MODE" == "--release" ]]; then
  BUILD_FLAGS=(-c release --arch arm64 --arch x86_64)
else
  BUILD_FLAGS=()
fi
swift build ${BUILD_FLAGS[@]+"${BUILD_FLAGS[@]}"} --product FreeRoam
BIN_DIR="$(swift build ${BUILD_FLAGS[@]+"${BUILD_FLAGS[@]}"} --show-bin-path)"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/FreeRoam" "$APP/Contents/MacOS/FreeRoam"
cp Sources/FreeRoam/Info.plist "$APP/Contents/Info.plist"

# Resources go in Contents/Resources and are read through Bundle.main. SwiftPM
# resource bundles expect to sit next to Contents, where codesign rejects them.
cp site/tokens.json "$APP/Contents/Resources/tokens.json"
# The wheel's sounds, the same files the website publishes.
cp assets/sounds/{open,close,hover,retune}.wav "$APP/Contents/Resources/"
# The caption font and its licence (SIL OFL), which has to travel with it.
cp Sources/FreeRoam/Resources/SofiaSansExtraCondensed-SemiBold.ttf Sources/FreeRoam/Resources/OFL.txt "$APP/Contents/Resources/"
# The app icon, menu bar glyph and welcome window badge, from
# scripts/make-brand-assets.sh.
cp Sources/FreeRoam/Resources/AppIcon.icns Sources/FreeRoam/Resources/MenuBarIconTemplate.png \
  Sources/FreeRoam/Resources/MenuBarIconTemplate@2x.png Sources/FreeRoam/Resources/FreeRoamBadge.png \
  "$APP/Contents/Resources/"
plutil -replace CFBundleVersion -string "$BUILD_NUMBER" "$APP/Contents/Info.plist"

if [[ "$MODE" == "--release" ]]; then
  # Matched by team, so a renewed certificate still works. The SHA-1 avoids
  # ambiguity if the keychain ever holds two with the same name.
  RELEASE_IDENTITY="$(security find-identity -v -p codesigning \
    | awk '/"Developer ID Application: .*\(R5NM7593WP\)"/ { print $2; exit }')"
  if [[ -z "$RELEASE_IDENTITY" ]]; then
    echo "error: no Developer ID Application certificate for team R5NM7593WP in the keychain" >&2
    exit 1
  fi
  codesign --force --options runtime --timestamp \
    --entitlements scripts/FreeRoam.entitlements --sign "$RELEASE_IDENTITY" "$APP"
  echo "Built $APP (release, build $BUILD_NUMBER, $(lipo -archs "$APP/Contents/MacOS/FreeRoam"))"
  exit 0
fi

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

if [[ "$MODE" == "--run" ]]; then
  # Matching the full path leaves any other process called FreeRoam alone.
  pkill -f "$APP/Contents/MacOS/FreeRoam" || true
  while pgrep -f "$APP/Contents/MacOS/FreeRoam" >/dev/null; do sleep 0.1; done
  open "$APP"
fi
