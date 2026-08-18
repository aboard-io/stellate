#!/usr/bin/env bash
# Serve this folder so the browser pages work (fetch + AudioWorklet need http,
# not file://). Sends COOP/COEP headers so the page is CROSS-ORIGIN ISOLATED —
# that unlocks SharedArrayBuffer, which lets the Faust engine render in a worker
# thread into a ring buffer instead of inside the audio callback (glitch armor).
# Production needs the same two headers in nginx (see CLAUDE.md Deployment).
#
#   ./serve.sh            -> http://localhost:8777
#   ./serve.sh 9000       -> choose a port
#
# Then open:  http://localhost:8777/  (lands on the daw; screensaver.html is the star map)
set -euo pipefail
cd "$(dirname "$0")"
port="${1:-8777}"
echo "Serving $(pwd) (cross-origin isolated)"
echo "  daw:         http://localhost:${port}/  (nukernel/kernel-daw.html)"
echo "  screensaver: http://localhost:${port}/screensaver.html"
exec python3 - "$port" <<'PY'
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        # require-corp (not credentialless): Safari isolates reliably under require-corp
        # so the ring-engine's SharedArrayBuffer works. Safe because the only cross-origin
        # subresources are esm.sh preact/htm (CORS, ACAO:*) and Google Fonts (sends CORP),
        # and all found audio/video is now local (same-origin). See engine/faust/live/live.js.
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

ThreadingHTTPServer(("", int(sys.argv[1])), H).serve_forever()
PY
