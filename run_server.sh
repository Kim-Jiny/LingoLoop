#!/bin/bash
# Start the local server only (uses the Homebrew Postgres on :5432).
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Make sure the local Postgres is running (Homebrew service).
if ! brew services list 2>/dev/null | grep -qE '^postgresql@16\s+started'; then
  echo "▶ Starting postgresql@16…"
  brew services start postgresql@16
  sleep 2
fi

cd "$ROOT/server"
exec npm run dev
