#!/bin/bash
# Serve Solar Clock locally and open it in the default browser.
# Usage: ./run.sh [port]

set -euo pipefail
PORT="${1:-8899}"
DIR="$(cd "$(dirname "$0")" && pwd)"
URL="http://127.0.0.1:${PORT}/"

echo "Solar Clock → ${URL}"
echo "Press Ctrl+C to stop."

( sleep 1; open "$URL" ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR"