#!/bin/bash
# Builds the public release: a universal, Developer ID signed and notarized
# Free Roam.app in a stapled DMG, with its SHA-256 checksum.
#
#   scripts/release.sh
#
# Writes dist/Free Roam-<version>.dmg and dist/Free Roam-<version>.dmg.sha256,
# with the version from Sources/FreeRoam/Info.plist.
#
# Notarization uses the notarytool keychain profile "freeroam-notary". Create
# it once with `xcrun notarytool store-credentials freeroam-notary`; the
# credentials stay in the keychain and this script never sees them.
#
# ALLOW_DIRTY=1 builds even with uncommitted changes to the app's files.
set -euo pipefail

cd "$(dirname "$0")/.."

NOTARY_PROFILE="freeroam-notary"
VERSION="$(plutil -extract CFBundleShortVersionString raw Sources/FreeRoam/Info.plist)"
APP="$PWD/dist/Free Roam.app"
DMG="$PWD/dist/Free Roam-$VERSION.dmg"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Everything that ends up in the app. A release is built from what's committed.
APP_SOURCES=(Package.swift Sources assets prototype/tokens.json scripts/bundle.sh scripts/FreeRoam.entitlements)
if [[ -n "$(git status --porcelain -- "${APP_SOURCES[@]}")" && "${ALLOW_DIRTY:-}" != 1 ]]; then
  echo "error: uncommitted changes to the app's files. Commit them, or set ALLOW_DIRTY=1:" >&2
  git status --short -- "${APP_SOURCES[@]}" >&2
  exit 1
fi

scripts/bundle.sh --release

# --- Nothing personal ships ---------------------------------------------------
# The bundle must hold exactly these files. bundle.sh copies each one by name,
# so anything else means a copy step picked up something it shouldn't have.
EXPECTED="$WORK/expected.txt"
ACTUAL="$WORK/actual.txt"
sort > "$EXPECTED" <<'EOF'
Contents/Info.plist
Contents/MacOS/FreeRoam
Contents/Resources/AppIcon.icns
Contents/Resources/FreeRoamBadge.png
Contents/Resources/MenuBarIconTemplate.png
Contents/Resources/MenuBarIconTemplate@2x.png
Contents/Resources/OFL.txt
Contents/Resources/SofiaSansExtraCondensed-SemiBold.ttf
Contents/Resources/close.wav
Contents/Resources/hover.wav
Contents/Resources/open.wav
Contents/Resources/retune.wav
Contents/Resources/tokens.json
Contents/_CodeSignature/CodeResources
EOF
(cd "$APP" && find . -type f | sed 's|^\./||' | sort) > "$ACTUAL"
if ! diff -u "$EXPECTED" "$ACTUAL" >&2; then
  echo "error: the app bundle's files don't match the release allowlist above" >&2
  exit 1
fi

# Your exported Music library, desktop picture and local sound pack stay on
# your Mac. No bundled file may be a copy of one, whatever it's called.
PERSONAL_DIRS=(prototype/public/library prototype/public/wallpaper prototype/public/sounds/local)
PERSONAL_HASHES="$WORK/personal.txt"
: > "$PERSONAL_HASHES"
for dir in "${PERSONAL_DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  find "$dir" -type f -exec shasum -a 256 {} + | awk '{ print $1 }' >> "$PERSONAL_HASHES"
done
while IFS= read -r file; do
  hash="$(shasum -a 256 "$APP/$file" | awk '{ print $1 }')"
  if grep -qx "$hash" "$PERSONAL_HASHES"; then
    echo "error: $file is a copy of a personal file from ${PERSONAL_DIRS[*]}" >&2
    exit 1
  fi
done < "$ACTUAL"

# Source paths would put this Mac's user name in the binary.
if strings "$APP/Contents/MacOS/FreeRoam" | grep -q "/Users/"; then
  echo "error: the binary contains a /Users/ path" >&2
  exit 1
fi
echo "Privacy check passed: only allowlisted files, none copied from ${PERSONAL_DIRS[*]}"

# --- Notarize ----------------------------------------------------------------
# Submits a file and waits. notarytool exits 0 even when Apple rejects it, so
# the status is checked, and on failure Apple's log says why.
notarize() {
  local file="$1" result status id
  echo "Notarizing $(basename "$file")…"
  result="$(xcrun notarytool submit "$file" --keychain-profile "$NOTARY_PROFILE" --wait --output-format json)"
  status="$(plutil -extract status raw - <<< "$result")"
  id="$(plutil -extract id raw - <<< "$result")"
  echo "Notarization $id: $status"
  if [[ "$status" != "Accepted" ]]; then
    xcrun notarytool log "$id" --keychain-profile "$NOTARY_PROFILE" >&2
    exit 1
  fi
}

# The app is notarized and stapled first, so a copy dragged out of the DMG
# still opens without a network check.
ditto -c -k --keepParent "$APP" "$WORK/Free Roam.zip"
notarize "$WORK/Free Roam.zip"
xcrun stapler staple "$APP"

# --- DMG ---------------------------------------------------------------------
STAGING="$WORK/dmg"
mkdir "$STAGING"
ditto "$APP" "$STAGING/Free Roam.app"
ln -s /Applications "$STAGING/Applications"
rm -f "$DMG" "$DMG.sha256"
hdiutil create -quiet -volname "Free Roam" -srcfolder "$STAGING" -format UDZO -ov "$DMG"

# Signed by whoever signed the app.
IDENTITY="$(codesign -dvv "$APP" 2>&1 | sed -n 's/^Authority=\(Developer ID Application: .*\)$/\1/p')"
codesign --force --timestamp --sign "$IDENTITY" "$DMG"
notarize "$DMG"
xcrun stapler staple "$DMG"

(cd dist && shasum -a 256 "$(basename "$DMG")" > "$(basename "$DMG").sha256")
echo "Released $DMG"
cat "$DMG.sha256"
