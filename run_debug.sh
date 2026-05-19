#!/bin/bash
# Local dev runner: detect this machine's LAN IP, start the local NestJS
# server + Postgres, and `flutter run` the app pointed at that IP so a
# real device on the same Wi-Fi can reach it.
#
# Release builds are unaffected — they keep the production API base URL
# (see ApiConstants.baseUrl default).
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_PORT=3000

# --- 1. Detect LAN IP (macOS: en0 Wi-Fi, fallback en1) ---
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "✗ Could not detect LAN IP (en0/en1). Connect to Wi-Fi and retry."
  exit 1
fi
API_BASE_URL="http://${IP}:${SERVER_PORT}"
echo "▶ LAN IP: $IP"
echo "▶ API base: $API_BASE_URL"

# --- 2. Ensure local Postgres (docker) is up ---
# docker-compose maps the DB to 127.0.0.1:55436 → host port for a
# locally-run (non-docker) server.
if ! docker ps --format '{{.Names}}' | grep -q '^lingo-db$'; then
  echo "▶ Starting lingo-db (Postgres)…"
  (cd "$ROOT/docker" && docker compose up -d lingo-db)
fi

# --- 3. Start the NestJS server locally ---
# Override DB host/port for the host-run server (docker maps 5432→55436).
echo "▶ Starting server (npm run start:dev)…"
(
  cd "$ROOT/server"
  DB_HOST=localhost DB_PORT=55436 NODE_ENV=development \
    npm run start:dev
) &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "▶ Stopping server (pid $SERVER_PID)…"
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- 4. Wait for the server to answer ---
echo "▶ Waiting for server on :$SERVER_PORT …"
for i in $(seq 1 40); do
  if curl -sf "http://localhost:${SERVER_PORT}/api/sentences/today" -o /dev/null \
     || curl -s "http://localhost:${SERVER_PORT}" -o /dev/null; then
    echo "✓ Server is up"
    break
  fi
  sleep 1
done

# --- 5. flutter run against the local server ---
cd "$ROOT/app"
flutter run --dart-define=API_BASE_URL="$API_BASE_URL" "$@"
