#!/usr/bin/env bash
# NOTE FOR DEPLOYMENT:
# This entrypoint currently runs the backend with `npm run dev` (ts-node), which is
# convenient for local docker development but not ideal for production containers.
# For deployment images, build the server at Docker build time and run compiled
# output (or `npm run start`) for faster startup, smaller images, and non-dev behavior.
# Keep `npm run dev` in development-only flows such as docker-compose.dev.yml.
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
