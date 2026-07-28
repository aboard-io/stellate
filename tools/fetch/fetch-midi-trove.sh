#!/usr/bin/env bash
# Fetch the labeled genre rips from the MIDIMAN Melody Kit (Internet Archive).
# The MIDI files are NOT committed (external, mixed provenance — see SOURCES.md).
# This script IS committed: it's the recipe that makes the corpus recoverable.
#
#   tools/fetch/fetch-midi-trove.sh
#
# Downloads the genre-labeled site rips used by tools/mine/mine-midi.js (verifier
# calibration + vocabulary mining; the ~1GB unlabeled bulk is deliberately
# skipped). Unzips each into <dest>/<slug>/ (default: the EXTERNAL drive — found/ is
# rsynced to the droplet by ship.sh and the MIDI must NEVER deploy; SOURCES.md).
# Requires: curl, unzip.
set -euo pipefail
cd "$(dirname "$0")/../.."
DEST="${1:-/mnt/sources/relocated/stellate-midi-corpus/rips}"
mkdir -p "$DEST"

ITEM="https://archive.org/download/midiman_melody_kit_1.0_2015-06"

# slug|zip filename (URL-encoded at fetch time)
rips=(
  "ragtime|Ragtime_rtpress.com_MIDIRip.zip"                    # ragtime — NO anchor yet: new-genre candidate
  "jazz|Jazz_www.thejazzpage.de_MIDIRip.zip"                   # jazz anchor calibration
  "dub|Dub_MIDIRip.zip"                                        # dub anchor calibration
  "folk|AMERICANA_FOLK_www.pdmusic.org_MIDIRip.zip"            # folk/country/bluegrass calibration; PD vocabulary source
  "classical_piano|Classical_Piano_piano-midi.de_MIDIRip.zip"  # key-detection ground truth (keys in filenames)
  # classical expansion (corpus-db melody test bed — solo/chamber lines with
  # strong key signatures; ~53MB total):
  "classical_greats|Classical Archives - The Greats (MIDI).zip"
  "classical_guitar|Classical_Guitar_classicalguitarmidi.com_MIDIRip.zip"
  "classical_violin|Classical_Violin_theviolinsite.com_MIDIRip.zip"
  "classical_mfiles|Classical_mfiles.co.uk_MIDIRip.zip"
  "classical_midiworld|Classical_www.midiworld.com_MIDIRip.zip"
)

for spec in "${rips[@]}"; do
  slug="${spec%%|*}"; zipname="${spec#*|}"
  dest="$DEST/$slug"
  if [ -d "$dest" ] && [ -n "$(find "$dest" -iname '*.mid' -print -quit 2>/dev/null)" ]; then
    echo "== $slug: already fetched, skipping"
    continue
  fi
  echo "== $slug: $zipname"
  url="$ITEM/$(printf '%s' "$zipname" | sed 's/ /%20/g')"
  tmp="$DEST/.$slug.zip"
  curl -fL --retry 3 -o "$tmp" "$url"
  mkdir -p "$dest"
  unzip -oqj "$tmp" -d "$dest" -x '*.txt' '*.TXT' '*.html' '*.htm' || true
  rm -f "$tmp"
  echo "   $(find "$dest" -iname '*.mid' | wc -l) .mid files"
done

echo "done: $DEST"
