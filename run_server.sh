#!/bin/bash
# Start the local server only (Postgres + NestJS in watch mode).
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

if ! docker ps --format '{{.Names}}' | grep -q '^lingo-db$'; then
  echo "▶ Starting lingo-db (Postgres)…"
  (cd "$ROOT/docker" && docker compose up -d lingo-db)
fi

cd "$ROOT/server"
exec npm run dev
