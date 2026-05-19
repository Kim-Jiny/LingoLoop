#!/bin/bash
# Run ONLY the Flutter app, pointed at the local server.
# Start the server separately:  ../run_server.sh  (or cd ../server && npm run dev)
# Plain `flutter run` (no script) keeps the production API.
set -e
cd "$(dirname "$0")"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)"
API_BASE_URL="http://${IP}:3000"
echo "▶ App → $API_BASE_URL  (local server must be running)"

exec flutter run --dart-define=API_BASE_URL="$API_BASE_URL" "$@"
