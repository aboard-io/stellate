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

echo "== media manifest (local) =="
# .json excluded: manifests/catalogs are MUTABLE by design (nginx serves them
# no-cache — HOSTING.md §5 "manifests map names, never immutable"); the
# invariant guards only the immutable-cached media bytes.
# tw_vocal.mp3 excluded too: sing.py RE-SINGS it on every offline render
# (per-render lyrics/key under a fixed name) — mutable by nature, served
# no-cache by the same nginx exception as the manifests.
# engine/faust/dist/ left OUT of the manifest (2026-07-10): compiled wasm is
# CODE — it changes under the same name whenever a .dsp recompiles (the
# synthesis-depth program proved it). It deploys like JS: no-cache, not
# immutable. Only found/ media is versioned-by-name.
# found/midi/ excluded (2026-07-16): the MIDI trove must never deploy
# (SOURCES.md "never redistributed") — it lives on the external drive now;
# this exclusion is the belt in case a fetch ever lands there again.
find found -type f ! -name '*.ogg' ! -name '*.json' ! -name 'tw_vocal.mp3' ! -path 'found/video/lib/*' ! -path 'found/midi/*' \
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
  --exclude 'found/video/lib/' \
  --exclude 'models/' \
  --exclude 'scratch/' \
  --exclude '.venv-verify/' \
  --exclude 'verifier-catalog/' \
  --include 'engine/faust/node_modules/@grame/' \
  --include 'engine/faust/node_modules/@grame/faustwasm/***' \
  --exclude 'engine/faust/node_modules/*' \
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
echo "deployed."
