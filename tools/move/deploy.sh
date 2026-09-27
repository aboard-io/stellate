#!/bin/bash
# tools/move/deploy.sh — install the Schwung tool on a Move over SSH.
# --restart also restarts Move; read the note it prints about why that matters.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
HOST="${MOVE_HOST:-ableton@move.local}"
TAR="$HERE/schwung/dist/stellate-module.tar.gz"
[ -f "$TAR" ] || { echo "no bundle yet — run: node tools/move/schwung/build.js" >&2; exit 1; }
scp -q "$TAR" "$HOST:/tmp/"
# Extract OVER the module instead of deleting it first. The tool's scratch (last/, out/)
# is written by ui.js's shell commands, which run as root, so `rm -rf stellate` fails on
# it as ableton -- and with && that aborted the deploy having already half-deleted the
# module. The tarball overwrites all six files, and the scratch is cleared best-effort.
ssh "$HOST" 'set -e
  cd /data/UserData/schwung/modules/tools
  mkdir -p stellate
  tar xzf /tmp/stellate-module.tar.gz
  rm -rf stellate/out 2>/dev/null || true       # regenerated; root-owned, may refuse
  echo installed'
if [ "${1:-}" = "--restart" ]; then
  ssh "$HOST" 'sh /data/UserData/schwung/restart-move.sh' && echo "restarting Move"
else
  # Schwung re-reads ui.js every time you open a tool, but stellate.mjs is an ES import
  # and stays cached in the running shadow_ui JS context. Opening the tool now would run
  # the new ui.js against the bundle from before this deploy, which is how you get a
  # screen full of "undefined".
  echo
  echo "NOTE: restart Schwung before opening the tool, or it keeps the old stellate.mjs:"
  echo "  scripts/deploy.sh --restart     (restarts Move, Schwung with it)"
fi
