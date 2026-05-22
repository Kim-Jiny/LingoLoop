#!/bin/bash
# Prep iOS for an App Store Archive.
#
# Run this BEFORE Xcode > Product > Archive whenever you've previously
# used `./run_app.sh` (or any other `flutter run --dart-define=...`)
# command. Without it, `ios/Flutter/Generated.xcconfig` holds the LAN
# IP from your last dev run, Xcode Archive picks it up via
# DART_DEFINES, and TestFlight users end up pointed at your laptop's
# server instead of https://lingo.jiny.shop.
#
# What this does:
#   1. flutter clean → drop stale build artefacts.
#   2. flutter pub get → restore Pods/Generated state from the
#      current pubspec.
#   3. flutter build ios --release --no-codesign → re-writes
#      Generated.xcconfig with NO dart-defines, so DART_DEFINES holds
#      only Flutter metadata and the prod baseUrl default kicks in.
#   4. Sanity check: greps the generated DART_DEFINES for any
#      API_BASE_URL leak. If found, errors out so you don't archive a
#      broken build.
#
# After this finishes successfully:
#   Xcode > Product > Archive (or `flutter build ipa --release`)

set -e
cd "$(dirname "$0")"

echo "▶ Cleaning…"
flutter clean

echo "▶ pub get…"
flutter pub get

echo "▶ Building iOS release (no codesign, just to refresh xcconfig)…"
flutter build ios --release --no-codesign

# Decode each base64-encoded entry in DART_DEFINES and search for a
# stale API_BASE_URL. The line itself is base64-encoded, comma-
# separated; Generated.xcconfig's `// do not edit` warning at the top
# is what makes us not just sed-strip it.
xc="ios/Flutter/Generated.xcconfig"
line=$(grep '^DART_DEFINES=' "$xc" | head -1 | sed 's/^DART_DEFINES=//')
leaked=0
IFS=',' read -ra tokens <<< "$line"
for t in "${tokens[@]}"; do
  decoded=$(echo "$t" | base64 -d 2>/dev/null || true)
  case "$decoded" in
    API_BASE_URL=*)
      echo "✘ $decoded"
      leaked=1
      ;;
  esac
done

if [ $leaked -ne 0 ]; then
  echo ""
  echo "✘ Generated.xcconfig still contains an API_BASE_URL override."
  echo "  This shouldn't happen after a clean rebuild — bail out."
  exit 1
fi

echo ""
echo "✓ Ready. Open Xcode and run Product > Archive."
echo "  (Or build the IPA from CLI: flutter build ipa --release)"
