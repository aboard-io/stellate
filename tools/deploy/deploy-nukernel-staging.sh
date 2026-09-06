#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy-nukernel-staging.sh — the nukernel branch onto test.stellate.app
#
# THIS SCRIPT EXISTS SO THE DEPLOY STOPS BEING AN INCANTATION. Until today the
# only record of how to ship this tree was a memory note and a paragraph in
# COMPOSER.md §3; the command has three details that are easy to get wrong and
# one of them is destructive.
#
#   1 · NO `--delete`. THE nukernel TREE IS PRUNED — its root holds only
#       engine/ found/ nukernel/ test/ tools/ vendor/ (plus sw.js and a few
#       files) — while the staging server also serves app/, assets/, daw.html
#       and docs/ from the SAME root. `--delete` (and worse, the
#       `--delete-excluded` that tools/deploy/deploy-staging.sh carries on the
#       other worktree's branch) would wipe every one of them. That script MUST
#       NOT be used from this branch; this one is why it does not have to be.
#   2 · `vendor` IS IN THE LIST. The screensaver's aliens import three.js from
#       /vendor/three at mount time (2026-09-01, "Why not three js? It's fine.
#       Don't reinvent."), so a deploy without it ships a screensaver that
#       cannot start and says nothing about why.
#   3 · THE SOURCE IS A CLEAN WORKTREE OF HEAD, never the working tree. A
#       deploy of uncommitted work is a deploy nobody can reproduce or roll
#       back, and this box's own law is that the parent commits.
#
# `--bump` bumps sw.js VERSION first, in the WORKING TREE, and stops — because
# the bump is a commit somebody has to make and this script does not commit.
# Without it the deploy goes out at whatever VERSION HEAD carries, which is
# right for re-shipping the same version to a fixed server and wrong for
# anything a reader has to reload for.
#
# THE STAGING SERVER IS THE DEFAULT (PLAN.md, memory `staging-server-default`):
# prod only on an explicit "ship to prod", which this script does not do.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST="${DEST:-root@stellate.app:/srv/stellate-test/}"
SW="$REPO/sw.js"

if [ "${1:-}" = "--bump" ]; then
  cur="$(grep -oE 'const VERSION = "v[0-9]+"' "$SW" | grep -oE 'v[0-9]+')"
  next="v$(( ${cur#v} + 1 ))"
  # sw.js:43 is the ONE owner of the cache generation. MEDIA_CACHE is
  # deliberately NOT tied to it (a warmed route is ~100 MB per user), so this
  # only ever moves the APP cache — which is what a deploy has to move.
  sed -i "s/const VERSION = \"$cur\"/const VERSION = \"$next\"/" "$SW"
  echo "sw.js VERSION $cur -> $next (working tree). Commit it, then re-run without --bump."
  exit 0
fi

# THE SOURCE IS A CLEAN WORKTREE OF HEAD. `git worktree add --detach` gives a
# tree with no index, no stash and nothing uncommitted, which is the only tree
# a deploy may be taken from; it is removed on the way out whatever happens.
TMP="$(mktemp -d)"
cleanup() { git -C "$REPO" worktree remove --force "$TMP/tree" >/dev/null 2>&1 || true
            rm -rf "$TMP"; }
trap cleanup EXIT
git -C "$REPO" worktree add --detach "$TMP/tree" HEAD >/dev/null

echo "deploying $(git -C "$REPO" rev-parse --short HEAD) · sw.js $(grep -oE 'v[0-9]+' "$TMP/tree/sw.js" | head -1) -> $DEST"
cd "$TMP/tree"
# A DEPLOY MUST NOT BE VISIBLE HALF-DONE (2026-09-06). Paul, mid-round:
#   "Nothings loading it's just a blank screen" ... then "It's back".
# Both rsyncs write file by file straight into the LIVE web root, and the tree
# is ~7 MB with a 2.5 MB genres.js copied TWICE (once under /nukernel/, once at
# the root). A page loaded inside that window gets a new index.html beside a
# half-written script, or an old ui/table.js beside a new nu.css, and boots to
# nothing. `--delay-updates` is the fix rsync ships for exactly this: every
# updated file lands in a holding directory and they are renamed into place at
# the END of the transfer, so the window is a rename per file rather than a
# multi-second copy. It is not a transaction across the two rsyncs and does not
# claim to be; it removes the half-written FILE, which is what was measured.
rsync -a --delay-updates \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '*.wav' \
  --exclude '*.mp3' \
  --exclude 'nukernel/genres/' \
  nukernel engine vendor sw.js "$DEST"

#   5 · nukernel/genres/ (the 2.5 MB of JSON rows genres.js is built from,
#       2026-09-03) is source, not shipped: the browser loads the generated
#       genres.js. Excluded from both rsyncs.
#   4 · THE ROOT IS THE FRONT DOOR (added 2026-09-02, after the first deploy of
#       the composer round refreshed only /nukernel/ and Paul, opening
#       test.stellate.app/, saw the previous evening's build: "I don't think you
#       ever deployed to test"). Since 2026-08-29 the nukernel page is served at
#       the ROOT of test.stellate.app as a flat copy of nukernel/* (kernel.js,
#       ui/, audio/ beside app/ and docs/), and its `../engine/` references
#       resolve to /engine there. So the tree's CONTENTS go to the root too —
#       the trailing slash is the whole difference — with no --delete, for the
#       same reason as above.
rsync -a --delay-updates \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '*.wav' \
  --exclude '*.mp3' \
  --exclude 'genres/' \
  nukernel/ "$DEST"

echo "done. https://test.stellate.app/nukernel/index.html"
echo "(a deploy lands one reload later: the service worker swaps on the next load.)"
