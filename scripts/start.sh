#!/usr/bin/env bash
set -euo pipefail

# Cloud Run injects PORT (typically 8080). Fallback keeps local runs predictable.
export PORT="${PORT:-8080}"

cd /app/server
exec npm run start
