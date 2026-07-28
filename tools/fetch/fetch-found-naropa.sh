#!/usr/bin/env bash
# Fetch + prepare the NAROPA POETICS AUDIO ARCHIVE voice shelf (25 readings) —
# the Beat / New American Poetry circle recorded at the Jack Kerouac School of
# Disembodied Poetics (Naropa University, Boulder) and digitized on archive.org
# (collection:naropa). Joins the vx_* found-voice shelf in genre-kernel.js.
#
# LICENSE (READ THIS): every Naropa item is Creative Commons
# ATTRIBUTION-NONCOMMERCIAL-NODERIVATIVES — the archaic "by-nd-nc/1.0" slug
# (http://creativecommons.org/licenses/by-nd-nc/1.0/), functionally BY-NC-ND.
# ND = No Derivatives: folding a trimmed reading into generative music is a
# derivative/remix use, so this shelf is TIER 2 in SOURCES.md — fetch-only,
# NON-COMMERCIAL, private found-voice texture. The audio lands in gitignored
# found/, is NEVER committed, NEVER redistributed, NEVER packaged; this script
# IS the committed deliverable, and everyone who runs it downloads from the
# Internet Archive directly. Credit "Naropa Poetics Audio Archive" in any
# non-commercial use. Full ledger + per-item links: SOURCES.md "Naropa
# expansion". NOTE: vx_waldman_crack (item ID "ND012") is UNDATED.
#
#   tools/fetch/fetch-found-naropa.sh
#
# Sequential with a courtesy pause — we are a guest on the archive.org CDN.
# Requires: curl, ffmpeg. Idempotent: existing non-empty outputs are skipped,
# so it resumes cleanly. Trim windows (-ss/-t) sit well past room settling /
# housekeeping and land on the intended poet's voice (voice-identity picks
# favour solo or first-named readers). Output: mono 44.1k mp3 with the
# spokenword boost-normalize (loudnorm I=-16:TP=-1.5), exactly the vx_* path.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p found
IA="https://archive.org/download"
TMP="$(mktemp --suffix=.mp3)"; trap 'rm -f "$TMP"' EXIT

get() { # item | file | trim-start(s) | trim-len(s) | localId  ->  found/<localId>.mp3
  local item="$1" file="$2" ss="$3" d="$4" id="$5"
  local out="found/$id.mp3"
  [ -s "$out" ] && { echo "· skip $id (exists)"; return 0; }
  echo "→ naropa $id ($item)"
  # url-encode the filename (spaces, quotes) for the CDN path
  local enc; enc=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$file")
  curl -sL --retry 3 --max-time 600 -o "$TMP" "$IA/$item/$enc"
  ffmpeg -y -loglevel error -ss "$ss" -t "$d" -i "$TMP" \
    -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "loudnorm=I=-16:TP=-1.5" "$out"
  sleep 2   # courtesy gap — go slowly
}

# --- the circle (25 readings; poet + session in the trailing comment) ---
get "Gregory_Corso_The_history_of_poetry_June_1975_75P002" "Gregory_Corso_The_history_of_poetry_June_1975_75P002_64kb.mp3" 240 85 vx_corso_history75   # Gregory Corso — 'History of Poetry', 1975
get "Gregory_Corso_class_1_July_1977_77P091" "Gregory_Corso_class_1_July_1977_77P091_64kb.mp3" 180 80 vx_corso_class77   # Gregory Corso — class 1, 1977
get "Gregory_Corso_workshop_1_July_1981_81P081" "Gregory_Corso_workshop_1_July_1981_81P081_64kb.mp3" 210 85 vx_corso_workshop81   # Gregory Corso — workshop 1, 1981
get "Gregory_Corso_class_1_July_1981_81P083" "Gregory_Corso_class_1_July_1981_81P083_64kb.mp3" 200 75 vx_corso_class81   # Gregory Corso — class 1, 1981
get "Peter_Orlovsky_Poetry_for_Dumb_Students_June_1981_81P138" "Peter_Orlovsky_Poetry_for_Dumb_Students_June_1981_81P138_64kb.mp3" 180 85 vx_orlovsky_dumb81   # Peter Orlovsky — 'Poetry for Dumb Students', 1981
get "Diane_di_Prima_reading_July_1987_87P064" "Diane_di_Prima_reading_July_1987_87P064_64kb.mp3" 45 85 vx_diprima_1987   # Diane di Prima — solo reading, 1987
get "diPrima_Ginsberg_Waldman_reading_July_1994_94P041A" "diPrima_Ginsberg_Waldman_reading_July_1994_94P041A_64kb.mp3" 80 85 vx_diprima_1994   # Diane di Prima — reading (di Prima opens), 1994
get "Joanne_Kyger_Lorenzo_Thomas_reading_July_1989_89P165" "Joanne_Kyger_Lorenzo_Thomas_reading_July_1989_89P165_64kb.mp3" 55 85 vx_kyger_1989   # Joanne Kyger — reading (Kyger first), 1989
get "Kyger_Mackey_Corbett_Hollo_reading_July_1993_93P053" "Kyger_Mackey_Corbett_Hollo_reading_July_1993_93P053_64kb.mp3" 70 85 vx_kyger_1993   # Joanne Kyger — American mythology, 1993
get "Waldman_reading_Crack_in_the_world_ND012" "Waldman_reading_Crack_in_the_world_ND012_64kb.mp3" 15 75 vx_waldman_crack   # Anne Waldman — 'Crack in the World', UNDATED (ND012)
get "Gary_Snyder_reading_August_1983_83P099" "Gary_Snyder_reading_August_1983_83P099_64kb.mp3" 150 85 vx_snyder_reading83   # Gary Snyder — reading, 1983
get "Reading_with_Whalen_Clausen_Hollow_part_1_July_1980_80p181" "Reading_with_Whalen_Clausen_Hollow_part_1_July_1980_80p181_64kb.mp3" 120 80 vx_whalen_reading80   # Philip Whalen — reading (Whalen opens), 1980
get "Whalen_lecture_part_3_June_1987_87P047" "Whalen_lecture_part_3_June_1987_87P047_64kb.mp3" 240 85 vx_whalen_lecture87   # Philip Whalen — lecture part 3, 1987
get "Michael_McClure_and_Steven_Taylor_perfor_99P035" "99P035_64kb.mp3" 150 85 vx_mcclure_perf99   # Michael McClure — & Steven Taylor performance, 1999
get "Gary_Snyder_Book_of_Songs_class_part_1_1983_83p067" "Gary_Snyder_Book_of_Songs_class_part_1_1983_83p067_64kb.mp3" 300 80 vx_snyder_songs83   # Gary Snyder — Book of Songs (Shijing) class, 1983
get "John_Cage_studio_performance_January_1979_79P127" "John_Cage_studio_performance_January_1979_79P127_64kb.mp3" 60 80 vx_cage_studio79   # John Cage — studio performance (chance phonemes), 1979
get "Simon_Ortiz_Amiri_Baraka_reading_July_1984_84P060" "Simon_Ortiz_Amiri_Baraka_reading_July_1984_84P060_64kb.mp3" 100 75 vx_baraka_ortiz84   # Simon Ortiz / Amiri Baraka — reading, 1984
get "Steven_Taylor_performs_class_on_performa_87P051" "87P051_64kb.mp3" 180 75 vx_kupferberg_fugs87   # Tuli Kupferberg (Fugs) / Steven Taylor — performance class, 1987
get "naropa_amiri_baraka_lecture_on" "naropa_amiri_baraka_lecture_on_64kb.mp3" 120 85 vx_baraka_revpoetry94   # Amiri Baraka — lecture on revolutionary poetry, 1994
get "Sanders_Blaser_Sikelianos_Durand_Warshall_Waldman_panel_Alternative_communities_and_writing_June_2003_03P004" "Sanders_Blaser_Sikelianos_Durand_Warshall_Waldman_panel_Alternative_communities_and_writing_June_2003_03P004.mp3" 150 80 vx_sanders_panel03   # Ed Sanders — panel (Sanders first-billed), 2003; NO 64kb derivative, full mp3
get "Ginsber_Mexico_City_Blues_July_1988_88P044" "Ginsber_Mexico_City_Blues_July_1988_88P044_64kb.mp3" 210 85 vx_ginsberg_mexcityblues   # Allen Ginsberg — reads Kerouac's Mexico City Blues, 1988
get "Ginsberg_reading_Sincerity_rap_July_1985_85P017" "Ginsberg_reading_Sincerity_rap_July_1985_85P017_64kb.mp3" 40 75 vx_ginsberg_sincerity   # Allen Ginsberg — 'Sincerity rap', 1985
get "naropa_allen_ginsberg_workshop_jack2" "naropa_allen_ginsberg_workshop_jack2_64kb.mp3" 160 75 vx_ginsberg_kerouacconf   # Allen Ginsberg — Kerouac Conference workshop, 1982
get "naropa_william_s_burroughs2" "naropa_william_s_burroughs2_64kb.mp3" 100 75 vx_burroughs_lecture76   # William S. Burroughs — lecture (Part 1), 1976
get "William_S_Burroughs_Sr_and_John_Giorno_reading_August_1979_79P104" "William_S_Burroughs_Sr_and_John_Giorno_reading_August_1979_79P104_64kb.mp3" 90 85 vx_burroughs_giorno79   # William S. Burroughs — & Giorno reading (Burroughs opens), 1979

echo "Done. Naropa voice shelf ready: 25 readings in found/vx_*.mp3 (gitignored)."
echo "Hear one:  node tools/kernel-cli.js track spokenword --seed 7 --render"
