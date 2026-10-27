#!/bin/bash
# Regenerates the Free Roam brand assets from the badge,
# prototype/public/free-roam/app-icon.png. Needs only the Swift toolchain,
# iconutil and sips, which come with macOS and the Command Line Tools.
#
#   scripts/make-brand-assets.sh
set -euo pipefail

cd "$(dirname "$0")/.."

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

swiftc -O -o "$WORK/brand" scripts/brand/*.swift
"$WORK/brand" "$PWD" "$WORK"
iconutil -c icns "$WORK/AppIcon.iconset" -o Sources/FreeRoam/Resources/AppIcon.icns
echo "Wrote the brand assets. Rebuild the app with scripts/bundle.sh to see the icon."
