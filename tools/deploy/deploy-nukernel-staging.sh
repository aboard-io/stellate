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
#   4 · THE WEB ROOT IS A PUBLISHED SURFACE AND THE WORKING TREE IS NOT
#       (2026-09-08, LAUNCH.md D3). Paul: *"Don't publish markdown. Erase and
#       clean all of that up."* The second rsync copies `nukernel/*` to the
#       ROOT, so every design document in that directory — TABLE.md, DESIGN.md,
#       GENRES.md, COMPOSER.md and fourteen more — was being served beside
#       index.html, along with the TypeScript sources the build consumes, the
#       node-only `*-extract.js` scripts, the `ideal/` mockups and package.json.
#       None of it is secret (the repo is public) and none of it is a page. The
#       excludes below are the difference between "the source is the artifact"
#       and "the source IS the site": the source is on GitHub, where it can be
#       read properly, and the site is the instrument.
#
# THE STAGING SERVER IS THE DEFAULT (PLAN.md, memory `staging-server-default`):
# prod only on an explicit "ship to prod", which this script does not do.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST="${DEST:-root@stellate.app:/srv/stellate-test/}"
SW="$REPO/sw.js"

# ---- THE GUARD (2026-09-08, LAUNCH.md §6) ---------------------------------
# Paul: *"Add the guard and make things secure."*
#
# THIS SCRIPT MAY ONLY WRITE TO A STAGING ROOT. `DEST` is an environment
# variable, which is exactly how a deploy meant for test.stellate.app ends up
# pointed at the live site by a hand that was in a hurry — and this tree ships
# a service worker, so a wrong deploy is not a wrong file, it is a wrong file
# CACHED on every visitor's phone until the next version bump reaches them.
# The prod path has its own script with its own confirmation
# (deploy-nukernel-prod.sh); this one refuses anything that is not staging.
case "$DEST" in
  *stellate-test*|*/srv/stellate-nu-preview/*) ;;
  *) echo "refusing: DEST=$DEST is not a staging root." >&2
     echo "  This script writes to test.stellate.app only." >&2
     echo "  For the live site use tools/deploy/deploy-nukernel-prod.sh." >&2
     exit 2 ;;
esac

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

# THE FEEDS AND THE SITEMAP ARE GENERATED ON THE WAY OUT THE DOOR, here as well
# as in the prod script — because a staging site that does not carry them is a
# rehearsal of a different deploy. They are DERIVED (git log + the catalogue),
# gitignored, and idempotent: nothing in the bytes comes from the clock, so a
# rebuild with nothing new leaves the rsync quiet.
echo "== feeds + sitemap =="
node "$REPO/tools/build/gen-feed.js"
node "$REPO/tools/build/gen-sitemap.js"

# THE SOURCE IS A CLEAN WORKTREE OF HEAD. `git worktree add --detach` gives a
# tree with no index, no stash and nothing uncommitted, which is the only tree
# a deploy may be taken from; it is removed on the way out whatever happens.
TMP="$(mktemp -d)"
cleanup() { git -C "$REPO" worktree remove --force "$TMP/tree" >/dev/null 2>&1 || true
            rm -rf "$TMP"; }
trap cleanup EXIT
git -C "$REPO" worktree add --detach "$TMP/tree" HEAD >/dev/null
# …and the five generated files are copied INTO it, because they are gitignored
# and a worktree of HEAD does not contain them.
for f in feed.xml feed.json feed-archive.xml feed-archive.json sitemap.xml; do
  [ -f "$REPO/nukernel/$f" ] && cp "$REPO/nukernel/$f" "$TMP/tree/nukernel/$f"
done

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
  --exclude '*.md' \
  --exclude 'docs/' \
  --exclude 'src/' \
  --exclude 'ideal/' \
  --exclude '*-extract.js' \
  --exclude 'package.json' \
  --exclude 'package-lock.json' \
  --exclude 'tsconfig.json' \
  --exclude 'serve.sh' \
  --exclude 'verify.sh' \
  --exclude 'nukernel/genres/' \
  nukernel engine vendor sw.js "$DEST"

# THE EIGHT PIPELINE FILES, AND ONLY THE EIGHT (2026-09-07, the design-system
# round's MIDI door).
#
# THE BLOCKER, SAID PLAINLY: the rsync above ships `nukernel engine vendor
# sw.js` and `tools/` is not on that list, so `tools/remix.js` and the seven
# modules under it are a 404 on the server. The `.mid` door in the Export view
# loads them by URL, so a door that worked on a laptop would have failed on the
# phone it was built for — the same failure as no door at all.
#
# WHY THE FILES STAY IN `tools/` RATHER THAN MOVING UNDER `nukernel/`, which
# was the other candidate and looked like the tidier one:
#   · `/tools/…` IS ALREADY THE WRITTEN SEAM. `test/remix.browser.js` PIPE
#     loads exactly these eight paths off a server rooted at the repo, and
#     `docs/REMIX.md` records them as the load order. Moving the files would
#     make the browser gate's paths, the CLI's `require`s and the deployed URLs
#     three different answers to one question.
#   · `nukernel/export/package.json` DECLARES `"type": "module"`. The eight are
#     CommonJS/UMD with `require.main === module` CLIs; under that marker node
#     would refuse them, and `node tools/remix.js` and `test/remix.test.js`
#     would both break. The obvious home is the one home they cannot have.
#   · HALF OF `tools/` GENUINELY IS BUILD-TIME. So `tools` as a whole does NOT
#     go on the list above: `-R` (relative) ships these eight paths and nothing
#     else — not `tools/ableton` (752 KB), not `tools/remix-out` (396 KB), not
#     `tools/genre-qa`. 231 KB, named one by one, so a ninth file added to the
#     pipeline has to be added here on purpose rather than arriving as a side
#     effect of living in a directory.
# It is a THIRD rsync rather than more sources on the first, because the first
# one's cwd-relative sources land at `$DEST/<name>` and these have to keep their
# `tools/` prefix — which is what `-R` is for.
rsync -aR --delay-updates \
  tools/theory.js tools/genealogy.js \
  tools/mine/mine-midi.js tools/mine/mine-melody.js tools/mine/mine-groove.js \
  tools/genres/grammar.js tools/genres/emit.js \
  tools/remix.js "$DEST"

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
  --exclude '*.md' \
  --exclude 'docs/' \
  --exclude 'src/' \
  --exclude 'ideal/' \
  --exclude '*-extract.js' \
  --exclude 'package.json' \
  --exclude 'package-lock.json' \
  --exclude 'tsconfig.json' \
  --exclude 'serve.sh' \
  --exclude 'verify.sh' \
  --exclude 'genres/' \
  nukernel/ "$DEST"

echo "done. https://test.stellate.app/nukernel/index.html"
echo "(a deploy lands one reload later: the service worker swaps on the next load.)"
