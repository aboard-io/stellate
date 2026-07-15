#!/usr/bin/env bash
# Fetch the MIDIMAN unlabeled BULK (36 alphabetical zips, ~1GB, ~120k files)
# to the EXTERNAL drive — deliberately NOT under found/ (ship.sh rsyncs the
# working tree to the droplet; big corpus artifacts must never ride along).
# Companion to tools/fetch-midi-trove.sh (the labeled rips). See SOURCES.md.
#
#   tools/fetch-midi-bulk.sh [dest]     # default /mnt/sources/relocated/stellate-midi-corpus/bulk
#
# Feeds tools/corpus-db.js build + tools/mine-theory.js (harmony transition
# tables). Requires: curl, unzip.
set -euo pipefail

ITEM="https://archive.org/download/midiman_melody_kit_1.0_2015-06"
DEST="${1:-/mnt/sources/relocated/stellate-midi-corpus/bulk}"
mkdir -p "$DEST"

for c in 0 1 2 3 4 5 6 7 8 9 A B C D E F G H I J K L M N O P Q R S T U V W X Y Z; do
  dir="$DEST/$c"
  if [ -d "$dir" ] && [ -n "$(find "$dir" -iname '*.mid' -print -quit 2>/dev/null)" ]; then
    echo "== $c: already fetched, skipping"
    continue
  fi
  echo "== MIDIMAN_$c.zip"
  tmp="$DEST/.MIDIMAN_$c.zip"
  curl -fL --retry 3 -sS -o "$tmp" "$ITEM/MIDIMAN_$c.zip"
  mkdir -p "$dir"
  unzip -oqj "$tmp" -d "$dir" -x '*.txt' '*.TXT' '*.html' '*.htm' '*.pdf' 2>/dev/null || true
  rm -f "$tmp"
  echo "   $(find "$dir" -iname '*.mid' | wc -l) .mid files"
done

echo "done: $DEST ($(find "$DEST" -iname '*.mid' | wc -l) files total)"
