#!/usr/bin/env bash
# Fetch + prepare the found-sound layer from the Internet Archive (radio aporee).
# The audio is NOT committed (it's external, CC-licensed — see SOURCES.md).
# This script IS committed: it's the recipe that makes the found sound recoverable.
#
#   ./fetch-found-sound.sh
#
# Downloads each aporee field recording, trims a usable window, and converts to
# mono 44.1k WAV so royal-road.csd can load it as a granular source table.
# Requires: curl, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p found

# id|archive.org item|file|trim-start(s)|trim-len(s)|local name
recordings=(
  "tokyo_station|aporee_20938_24294|nov19tokyostation1934.ogg|18|40|tokyo_station"
  # night highway, Yunlin County TW (CC BY-NC-ND) — the synthwave/Kavinsky bed
  "highway_night|aporee_44512_50607|soundmap201905198.mp3|10|40|highway_night"
  # More recordings used historically (uncomment to layer them in the .csd):
  # "tsukiji|aporee_35166_40406|<file>.ogg|0|40|tsukiji"
  # "asakusa|aporee_21091_24510|<file>.ogg|0|40|asakusa"
)

for rec in "${recordings[@]}"; do
  IFS='|' read -r _id item file ss dur name <<< "$rec"
  url="https://archive.org/download/${item}/${file}"
  echo "→ ${name}: ${url}"
  curl -sL --max-time 120 -o "found/${name}.ogg" "$url"
  ffmpeg -y -loglevel error -ss "$ss" -t "$dur" -i "found/${name}.ogg" \
         -ac 1 -ar 44100 "found/${name}.wav"
  echo "  prepared found/${name}.wav (${dur}s mono 44.1k)"
done

echo "Done. Now: ./render.sh"
