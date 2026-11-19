#!/usr/bin/env bash
set -euo pipefail

# Cloud Run injects PORT (typically 8080). Fallback keeps local runs predictable.
export PORT="${PORT:-8080}"

cd /app/server
# The Docker image compiles TypeScript during its build. Running npm start here
# would invoke prestart and compile again within Cloud Run's runtime memory limit.
exec node index.js
