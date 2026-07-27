#!/usr/bin/env bash
# deploy-stellate.sh — push the working tree to stellate.app (docs/HOSTING.md §5).
# The server is DISPOSABLE (the genesis parable): this script + the repo can
# rebuild it from a clean droplet. The deny-list ships the ~900 MB runtime
# payload and keeps source-only material (bed .ogg originals, video crate
# reels, essentia models) local. --delay-updates stages the whole transfer and
# swaps at the end so a mid-deploy visitor never sees a half-updated tree.
#
#   tools/deploy-stellate.sh [host]     # default root@stellate.app
#
# MEDIA_MANIFEST enforces the immutable-cache invariant (§5): media content
# never changes under an unchanged name — the deploy ABORTS if a hash moved
# while its filename stayed put (bump the id/filename instead; nginx serves
# found/ and engine/faust/dist/ with max-age=31536000, immutable).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${1:-root@stellate.app}"
ROOT=/srv/stellate

# THE RELEASE FEED is generated HERE, on the way out the door (docs/HOSTING.md
# "The open-web layer" §2): git log -> RSS 2.0 + JSON Feed with a playable link
# per entry. It runs before the rsync so the deploy publishes notes that include
# the commit being deployed, and its four outputs are gitignored derived
# artifacts (the one rule) — which is also why regenerating here can never
# dirty the tree or trip ship.sh's clean-tree check.
echo "== release feed =="
node tools/gen-feed.js --historic

echo "== media manifest (local) =="
# .json excluded: manifests/catalogs are MUTABLE by design (nginx serves them
# no-cache — HOSTING.md §5 "manifests map names, never immutable"); the
# invariant guards only the immutable-cached media bytes.
# tw_vocal.mp3 excluded too: sing.py RE-SINGS it on every offline render
# (per-render lyrics/key under a fixed name) — mutable by nature, served
# no-cache by the same nginx exception as the manifests.
# engine/faust/dist/ left OUT of the manifest: compiled wasm is
# CODE — it changes under the same name whenever a .dsp recompiles (the
# synthesis-depth program proved it). It deploys like JS: no-cache, not
# immutable. Only found/ media is versioned-by-name.
# found/midi/ excluded: the MIDI trove must never deploy (SOURCES.md "never
# redistributed") — it lives on the external drive; this exclusion is the belt
# in case a fetch ever lands there again.
# found/video/ excluded: there is no video layer any more, and any locally
# cached clips must not deploy.
# .gitignore excluded: config, not media — it changes under its own name
# legitimately, which would otherwise trip the immutability invariant.
#
# TWO THINGS DELIBERATELY NOT DEPLOYED (the rsync filters below):
#   zones.json / _gm-extract-summary.json — 134 files, 544 KB of EXTRACTOR
#     OUTPUT. Nothing fetches them: the browser reads zone geometry from
#     K.SAMPLERS, and faust/sf2.js says it outright ("no audio path reads
#     zones.json at render time"). They only ever described the wavs beside them.
#   engine/faust/node_modules/@grame — the tree is 28 MB and the web needs
#     exactly ONE file of it, dist/esm/index.js (194 KB), from which live.js /
#     stream-worker.js / stem-worker.js import FaustWasmInstantiator and
#     FaustMonoDspGenerator to instantiate PRECOMPILED factories. The rest is
#     the Faust COMPILER (libfaust-wasm, 5.4 MB), the cjs/bundle builds
#     (16.4 MB), tests, assets and a 466 KB source map — all build-time only.
#     The include list below is anchored per-directory because rsync cannot
#     descend into a directory it has already excluded. The smoke check at the
#     end fetches that one file, so a filter typo fails the deploy loudly
#     instead of silently breaking the engine on first play.
find found -type f ! -name '*.ogg' ! -name '*.json' ! -name '.gitignore' ! -name 'tw_vocal.mp3' ! -path 'found/video/*' ! -path 'found/midi/*' \
  -print0 | sort -z | xargs -0 sha256sum > /tmp/MEDIA_MANIFEST.new

echo "== immutable invariant check against deployed manifest =="
if ssh "$HOST" "test -f $ROOT/MEDIA_MANIFEST" 2>/dev/null; then
  ssh "$HOST" "cat $ROOT/MEDIA_MANIFEST" > /tmp/MEDIA_MANIFEST.deployed
  # a changed hash under an unchanged name is a deploy bug — abort loudly
  if join -j 2 <(sort -k2 /tmp/MEDIA_MANIFEST.deployed) <(sort -k2 /tmp/MEDIA_MANIFEST.new) \
      | awk '$2 != $3 { print "CHANGED-UNDER-SAME-NAME: " $1; bad=1 } END { exit bad }'; then
    echo "   invariant holds"
  else
    echo "!! immutable invariant violated — rename the changed media (new id) and retry" >&2
    exit 1
  fi
else
  echo "   no deployed manifest (first deploy)"
fi

echo "== rsync =="
rsync -a --delete --delay-updates --info=stats1 \
  --exclude '.git' --exclude '.gitmodules' \
  --exclude '/.claude/' \
  --exclude '/.claude*' \
  --exclude '/.venv-sing/' \
  --exclude '/node_modules/' \
  --exclude '/tools/node_modules/' \
  --exclude '/*.mp3' --exclude '/*.wav' --exclude '/*.state.json' \
  --exclude 'found/midi/' \
  --exclude 'found/*.ogg' \
  --exclude 'found/video/' \
  --exclude 'models/' \
  --exclude 'scratch/' \
  --exclude '.venv-verify/' \
  --exclude 'found/samples/**/zones.json' \
  --exclude 'found/samples/**/_gm-extract-summary.json' \
  --include 'engine/faust/node_modules/' \
  --include 'engine/faust/node_modules/@grame/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/dist/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/dist/esm/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/dist/esm/index.js' \
  --exclude 'engine/faust/node_modules/**' \
  ./ "$HOST:$ROOT/"

echo "== push manifest last =="
scp -q /tmp/MEDIA_MANIFEST.new "$HOST:$ROOT/MEDIA_MANIFEST"

echo "== smoke =="
for u in / /engine/faust/stream-worker.js /found/found-manifest.json; do
  printf '%-40s' "$u"
  curl -sI "https://stellate.app$u" | grep -ciE 'cross-origin-(opener|embedder)' \
    | sed 's/^2$/isolation OK/;s/^[01]$/MISSING ISOLATION HEADERS/'
done
curl -s -o /dev/null -w 'how.html %{http_code}\n' https://stellate.app/how.html
# THE ENGINE'S ONE VENDORED MODULE. The rsync ships a single file out of the
# 28 MB @grame tree, so a filter typo would strand the engine with no audio and
# no page error until someone pressed play. Must be 200.
printf '%-34s' "faustwasm dist/esm/index.js"
curl -s -o /dev/null -w '%{http_code}\n' \
  https://stellate.app/engine/faust/node_modules/@grame/faustwasm/dist/esm/index.js
# the open-web layer: every one of these must answer 200 (a 404 on
# .well-known/security.txt usually means a blanket dotfile deny in nginx —
# docs/HOSTING.md "The open-web layer" §3)
for u in /feed.xml /feed.json /feed-archive.xml /manifest.webmanifest /robots.txt \
         /sitemap.xml /colophon.html /404.html /.well-known/security.txt; do
  printf '%-34s' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "https://stellate.app$u"
done
echo "deployed."
