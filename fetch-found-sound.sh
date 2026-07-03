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
  # genre-kernel beds (see genre-kernel.js GENRES):
  "factory|aporee_63765_73460|ATA025Antofagastasiderurgiausinacamionesencarretera.mp3|20|40|factory"     # CC BY-NC-SA — techno
  "frogs|aporee_61056_70186|soundmap202307117.mp3|10|40|frogs"                                            # CC BY-NC-ND — jungle
  "iriomote|aporee_30783_35405|iriomoteaporee.ogg|30|40|iriomote"                                         # PD — ambient
  "shibuya|aporee_20542_23865|nov820131617shibuya.ogg|25|40|shibuya"                                      # CC BY-SA — house
  "loon|CommonLoon|loons.mp3|0|24|loon"                                                                   # USFWS, public domain — canawave (the loonie's bird)
  # Leacock, "The Dawn of Canadian History" (PD) — four chunks from different chapters (canawave narration)
  "leacock1|aboriginal_canada|aboriginalcanada_01_leacock.mp3|150|90|leacock1"
  "leacock2|aboriginal_canada|aboriginalcanada_02_leacock.mp3|280|90|leacock2"
  "leacock3|aboriginal_canada|aboriginalcanada_03_leacock.mp3|420|90|leacock3"
  "leacock4|aboriginal_canada|aboriginalcanada_05_leacock.mp3|520|90|leacock4"
  # transitwave beds — train interiors + station ambiences (radio aporee, CC) — the clatter
  "tw_intrain|radio_aporee_log_2014_06_02_12_21_50|radio_aporee_log_2014_06_02_12_21_50.mp3|40|40|tw_intrain"   # in a train, Hagen Hbf
  "tw_trains|aporee_51245_58484|RailwayStationDivaaSlovenia.mp3|120|40|tw_trains"                               # passenger & cargo trains, Divača
  "tw_stationhall|aporee_39219_48146|soundmap201812162.mp3|30|40|tw_stationhall"                                # walking into the station, Taoyuan
  "tw_platform|aporee_72529_84687|202605291903.mp3|60|40|tw_platform"                                           # station approach, Hastings
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
