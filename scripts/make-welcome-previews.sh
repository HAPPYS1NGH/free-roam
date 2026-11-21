#!/usr/bin/env bash
# Renders the welcome window's two Screen Recording previews into
# Sources/FreeRoam/Resources, from the app's own wheel and backdrop over the
# website's coast photo and the public demo's covers.
set -euo pipefail
cd "$(dirname "$0")/.."
WELCOME_PREVIEWS=1 swift test --filter WelcomePreviewImages
ls -l Sources/FreeRoam/Resources/WelcomeBefore.jpg Sources/FreeRoam/Resources/WelcomeAfter.jpg
