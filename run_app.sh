#!/bin/bash
# Run ONLY the Flutter app, pointed at the local server (run the server
# separately with ./run_server.sh). Plain `flutter run` (no script) keeps
# the production API.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)"
API_BASE_URL="http://${IP}:3000"
echo "▶ App → $API_BASE_URL  (server must be running: ./run_server.sh)"

cd "$ROOT/app"
exec flutter run --dart-define=API_BASE_URL="$API_BASE_URL" "$@"
