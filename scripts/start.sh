#!/usr/bin/env bash
set -euo pipefail

CLIENT_PORT="${CLIENT_PORT:-5173}"

cleanup() {
  jobs -p | xargs -r kill >/dev/null 2>&1 || true
}

trap cleanup SIGINT SIGTERM EXIT

cd /app/server
npm run dev &
SERVER_PID=$!

cd /app
npm run preview -- --host 0.0.0.0 --port "${CLIENT_PORT}" --strictPort &
CLIENT_PID=$!

wait -n "${SERVER_PID}" "${CLIENT_PID}"
