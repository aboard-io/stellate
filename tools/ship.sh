#!/usr/bin/env bash
# ship.sh — the one deploy command: gates, push, deploy, in that order, so
# "deployed" always implies "committed and green".
#
#   tools/ship.sh            # clean tree -> gates -> git push -> stellate.app
#   tools/ship.sh --dirty    # skip the clean-tree check (you know why)
#
# The clean-tree check exists because deploy-stellate.sh rsyncs the WORKING
# TREE, not a git ref — without it, uncommitted work ships silently and
# stellate.app drifts ahead of main. (aboardresearch.com needs no deploy:
# this tree IS its web root; every save is already live there.)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" != "--dirty" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "ship: working tree is dirty — commit first (or --dirty to override):" >&2
    git status --short >&2
    exit 1
  fi
fi

echo "== gates =="
./verify.sh
node test/theory.test.js >/dev/null && echo "  theory     PASS"
node test/pipes.test.js  >/dev/null && echo "  pipes      PASS"
node test/speech.test.js >/dev/null && echo "  speech     PASS"

echo "== push =="
git push

echo "== deploy =="
tools/deploy-stellate.sh "${DEPLOY_HOST:-root@stellate.app}"
