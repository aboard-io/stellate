#!/usr/bin/env bash
# ship.sh — the one deploy command: gates, push, deploy, in that order, so
# "deployed" always implies "committed and green".
#
#   tools/deploy/ship.sh            # clean tree -> gates -> git push -> test.stellate.app
#   tools/deploy/ship.sh --prod     # ...and to stellate.app, the real site
#   tools/deploy/ship.sh --dirty    # skip the clean-tree check (you know why)
#
# STAGING IS THE DEFAULT TARGET (2026-07-29). Deploys land on test.stellate.app —
# same droplet, second vhost, /srv/stellate-test, sharing prod's found/ media —
# so changes can be looked at and listened to before the public site moves.
# stellate.app only ever updates when --prod is passed explicitly. Both paths run
# the same gates first; the difference is which web root the rsync writes.
#
# The clean-tree check exists because deploy-stellate.sh rsyncs the WORKING
# TREE, not a git ref — without it, uncommitted work ships silently and
# stellate.app drifts ahead of main. (aboardresearch.com needs no deploy:
# this tree IS its web root; every save is already live there.)
set -euo pipefail
cd "$(dirname "$0")/../.."

PROD=0
DIRTY=0
for a in "$@"; do
  case "$a" in
    --prod)  PROD=1 ;;
    --dirty) DIRTY=1 ;;
    *) echo "ship: unknown argument '$a' (expected --prod and/or --dirty)" >&2; exit 2 ;;
  esac
done

if [[ $DIRTY -eq 0 ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "ship: working tree is dirty — commit first (or --dirty to override):" >&2
    git status --short >&2
    exit 1
  fi
fi

echo "== gates =="
./verify.sh
node test/gates/theory.test.js >/dev/null && echo "  theory     PASS"
node test/gates/pipes.test.js  >/dev/null && echo "  pipes      PASS"
node test/gates/speech.test.js >/dev/null && echo "  speech     PASS"
# the release feed is GENERATED at deploy time (tools/deploy/deploy-stellate.sh runs
# `gen-feed.js --historic` just before the rsync, writing gitignored artifacts —
# which is why the clean-tree check above is unaffected). --dry proves the
# generator still runs and its four feeds still self-validate BEFORE we push.
node tools/build/gen-feed.js --dry >/dev/null && echo "  feed       PASS"

echo "== push =="
git push

if [[ $PROD -eq 1 ]]; then
  echo "== deploy: PRODUCTION (stellate.app) =="
  tools/deploy/deploy-stellate.sh "${DEPLOY_HOST:-root@stellate.app}"
else
  echo "== deploy: staging (test.stellate.app) =="
  echo "   (pass --prod to also update the public site)"
  tools/deploy/deploy-staging.sh "${DEPLOY_HOST:-root@stellate.app}"
fi
