#!/usr/bin/env bash
# deploy-staging.sh — push the working tree to test.stellate.app, the STAGING
# mirror. This is the DEFAULT deploy target; prod goes out only on an explicit
# "ship to prod" (tools/deploy/deploy-stellate.sh).
#
#   tools/deploy/deploy-staging.sh [host]     # default root@stellate.app
#
# It is the same droplet, a second nginx vhost and a second web root:
#
#   prod     stellate.app       -> /srv/stellate
#   staging  test.stellate.app  -> /srv/stellate-test
#
# THREE DIFFERENCES FROM THE PROD DEPLOY, and only three:
#
#   1. MEDIA IS NOT COPIED. found/ is ~900 MB of fetched, immutable-by-name
#      assets, byte-identical on both sites; /srv/stellate-test/found is a SYMLINK
#      to the production tree. So this script excludes found/ entirely — which
#      also means it cannot violate the immutable-media invariant, and skips the
#      manifest dance that enforces it. The `protect` filter below is what keeps
#      --delete-excluded from removing the symlink on every deploy.
#      Consequence worth knowing: a change that needs NEW media has to reach
#      prod's found/ before staging can serve it.
#   2. NO RELEASE FEED. gen-feed.js writes notes announcing a public release;
#      staging is not one. The feed files already in the tree ride along.
#   3. NO CLEAN-TREE REQUIREMENT. The whole point of staging is looking at work
#      in progress, so unlike ship.sh this never refuses a dirty tree.
#
# Everything else — the exclude list, --delete-excluded, --delay-updates, the
# single vendored @grame file, the isolation-header smoke test — is deliberately
# identical to the prod script, because the thing being tested is the deploy too.
set -euo pipefail
cd "$(dirname "$0")/../.."
HOST="${1:-root@stellate.app}"
ROOT=/srv/stellate-test
SITE=https://test.stellate.app

echo "== rsync -> $ROOT (media shared with prod, not copied) =="
# --delete-excluded, NOT bare --delete: excluded means GONE from the droplet,
# not merely unsent (see the prod script for the incident this comes from).
rsync -a --delete --delete-excluded --delay-updates --info=stats1 \
  --exclude '.git' --exclude '.gitmodules' \
  --exclude '/.claude/' \
  --exclude '/.claude*' \
  --exclude '/.venv-sing/' \
  --exclude '/node_modules/' \
  --exclude '/tools/node_modules/' \
  --exclude '/*.mp3' --exclude '/*.wav' --exclude '/*.state.json' \
  --exclude 'test/**/*.wav' --exclude 'test/**/*.mp3' \
  --filter 'protect /found' \
  --exclude '/found/' \
  --exclude 'models/' \
  --exclude 'scratch/' \
  --exclude '.venv-verify/' \
  --include 'engine/faust/node_modules/' \
  --include 'engine/faust/node_modules/@grame/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/dist/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/dist/esm/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/dist/esm/index.js' \
  --exclude 'engine/faust/node_modules/**' \
  ./ "$HOST:$ROOT/"

# SERVICE-WORKER VERSION GUARD. sw.js caches the whole app shell under a versioned
# key, so a deploy that does not bump VERSION reaches nobody who has already visited —
# they keep running the previous build and every change looks like it did not ship.
# This cost an hour today: six staging deploys under an unchanged v54, and the person
# testing was looking at a cached build the whole time. Compare against what is already
# up and say so loudly; a warning, not an abort, because a deploy of docs or media
# legitimately needs no bump.
DEPLOYED_SW=$(curl -s "$SITE/sw.js" | sed -n 's/^const VERSION = "\(.*\)".*/\1/p' | head -1)
LOCAL_SW=$(sed -n 's/^const VERSION = "\(.*\)".*/\1/p' sw.js | head -1)
if [ -n "$DEPLOYED_SW" ] && [ "$DEPLOYED_SW" = "$LOCAL_SW" ]; then
  echo "!! sw.js VERSION is still $LOCAL_SW — returning visitors will keep the CACHED build."
  echo "   bump it in sw.js if this deploy has to reach anyone who has already loaded the page."
else
  echo "== sw $DEPLOYED_SW -> $LOCAL_SW =="
fi

echo "== smoke =="
for u in / /engine/faust/live/stream-worker.js /found/found-manifest.json; do
  printf '%-42s' "$u"
  curl -sI "$SITE$u" | grep -ciE 'cross-origin-(opener|embedder)' \
    | sed 's/^2$/isolation OK/;s/^[01]$/MISSING ISOLATION HEADERS/'
done
printf '%-42s' "how.html"
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/how.html"
# the ONE vendored faustwasm file the engine imports at runtime
printf '%-42s' "@grame/faustwasm dist/esm/index.js"
curl -s -o /dev/null -w '%{http_code}\n' \
  "$SITE/engine/faust/node_modules/@grame/faustwasm/dist/esm/index.js"
# SHARED MEDIA: prove the alias reaches prod's found/ tree, not a 404
printf '%-42s' "shared media (aliased from prod)"
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/found/found-manifest.json"
# STAGING MUST NOT BE INDEXED — the vhost sends X-Robots-Tag and serves its own
# robots.txt. A missing noindex here means staging can outrank the real site.
printf '%-42s' "noindex"
curl -sI "$SITE/" | grep -qi 'x-robots-tag: *noindex' && echo "OK" || echo "MISSING — staging is indexable!"
printf '%-42s' "robots.txt disallows"
curl -s "$SITE/robots.txt" | grep -q 'Disallow: /' && echo "OK" || echo "MISSING"

echo
echo "staged: $SITE"
