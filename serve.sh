#!/usr/bin/env bash
# Serve this folder so the browser pages work (fetch + AudioWorklet need http,
# not file://). The ffmpeg.wasm single-thread core needs no special headers,
# so a plain static server is enough.
#
#   ./serve.sh            -> http://localhost:8777
#   ./serve.sh 9000       -> choose a port
#
# Then open:  http://localhost:8777/play.html   (player)
#             http://localhost:8777/builder.html (full song builder)
set -euo pipefail
cd "$(dirname "$0")"
port="${1:-8777}"
echo "Serving $(pwd)"
echo "  player:  http://localhost:${port}/play.html"
echo "  builder: http://localhost:${port}/builder.html"
exec python3 -m http.server "$port"
