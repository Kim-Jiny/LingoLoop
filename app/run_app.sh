#!/bin/bash
# Run ONLY the Flutter app, pointed at the local server.
# Start the server separately:  ../run_server.sh  (or cd ../server && npm run dev)
# Plain `flutter run` (no script) keeps the production API.
#
# Side note (the reason for the EXIT trap below): `flutter run
# --dart-define=...` writes those defines into
# `ios/Flutter/Generated.xcconfig` so Xcode picks them up. The file
# sticks around after the run ends — meaning a `Xcode > Product >
# Archive` straight after `./run_app.sh` would ship the LAN IP as the
# baseUrl override. Burned by this twice. The trap reruns
# `flutter pub get`, which re-generates Generated.xcconfig with no
# dart-defines, so the next Archive picks up the production URL.
set -e
cd "$(dirname "$0")"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)"
API_BASE_URL="http://${IP}:3000"
echo "▶ App → $API_BASE_URL  (local server must be running)"

cleanup() {
  echo ""
  echo "▶ Resetting ios/Flutter/Generated.xcconfig (removing dev dart-defines)…"
  if flutter pub get > /dev/null 2>&1; then
    echo "✓ Done. Safe to Xcode > Archive now."
  else
    echo "⚠ flutter pub get failed during cleanup."
    echo "  Run ./prepare_release.sh manually before archiving."
  fi
}
trap cleanup EXIT

# Note: `exec` would replace this shell with `flutter run`, which
# disables the EXIT trap. Use a normal foreground invocation so the
# trap fires whether the user Ctrl-Cs, errors out, or hot-restart-
# quits the run.
flutter run --dart-define=API_BASE_URL="$API_BASE_URL" "$@"
