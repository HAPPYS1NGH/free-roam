#!/bin/bash
# Puts Free Roam back to how it is on a first run, to test the welcome window,
# the permission prompts and Sparkle's update prompt. Your stations stay.
#
#   scripts/reset-first-run.sh          reset, then open dist/Free Roam.app
#   scripts/reset-first-run.sh --no-run reset only
#
# macOS forgets Free Roam's Automation permission for Music and Spotify
# together: it can't reset one without the other.
set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE_ID="com.happys1ngh.freeroam"
APP="$PWD/dist/Free Roam.app"

osascript -e "quit app id \"$BUNDLE_ID\"" 2>/dev/null || true
while pgrep -f "/Contents/MacOS/FreeRoam$" >/dev/null; do sleep 0.1; done

tccutil reset AppleEvents "$BUNDLE_ID"
tccutil reset ScreenCapture "$BUNDLE_ID"

# The welcome window's choice, each app's last permission answer, and
# Sparkle's first-run state. Stations and the chosen app stay.
KEYS=(welcomeDontShowAgain musicControlAllowed spotifyControlAllowed
  SUHasLaunchedBefore SUEnableAutomaticChecks SUAutomaticallyUpdate SUSendProfileInfo SULastCheckTime SUSkippedVersion)
for key in "${KEYS[@]}"; do
  defaults delete "$BUNDLE_ID" "$key" 2>/dev/null || true
done
echo "Reset Free Roam's permissions, welcome window and update prompt"

if [[ "${1:-}" != "--no-run" ]]; then
  [[ -d "$APP" ]] || scripts/bundle.sh
  open "$APP"
fi
