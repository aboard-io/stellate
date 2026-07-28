#!/usr/bin/env bash
# Fetch + prepare the found-sound layer from the Internet Archive (radio aporee).
# The audio is NOT committed (it's external, CC-licensed — see SOURCES.md).
# This script IS committed: it's the recipe that makes the found sound recoverable.
#
#   ./fetch-found-sound.sh
#
# Downloads each aporee field recording, trims a usable window, and converts to
# mono 44.1k MP3 (libmp3lame V2) so the found-sound layer can load it as a granular source.
# Requires: curl, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
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
  # More recordings used historically (uncomment to layer them into the bed):
  # "tsukiji|aporee_35166_40406|<file>.ogg|0|40|tsukiji"
  # "asakusa|aporee_21091_24510|<file>.ogg|0|40|asakusa"
)

for rec in "${recordings[@]}"; do
  IFS='|' read -r _id item file ss dur name <<< "$rec"
  url="https://archive.org/download/${item}/${file}"
  echo "→ ${name}: ${url}"
  curl -sL --max-time 120 -o "found/${name}.ogg" "$url"
  ffmpeg -y -loglevel error -ss "$ss" -t "$dur" -i "found/${name}.ogg" \
         -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 "found/${name}.mp3"
  echo "  prepared found/${name}.mp3 (${dur}s mono 44.1k)"
done

# ===== BEGIN 30-genre commission beds (materials round) =======================
# New found-sound beds for the 30 fictional genres. Two kinds:
#  (a) archive.org fetches — PD/CC only, credited in SOURCES.md, boost-normalized;
#  (b) SYNTHESIZED tech-elegy drones (crt_whine, fax_tone, modem_handshake,
#      floppy_seek, hvac_hum) — deterministic ffmpeg lavfi, license-free.
#      modem_handshake + floppy_seek are STYLIZED approximations (flagged in
#      SOURCES.md), not transcriptions of the real signals.
IA="https://archive.org/download"
getbed() { # url | ss | dur | name | extra-af(before loudnorm)
  local out="found/$4.mp3"
  [ -s "$out" ] && return 0
  echo "→ bed $4"
  curl -sL --max-time 180 -o /tmp/bed.in "$1"
  ffmpeg -y -loglevel error -ss "$2" -t "$3" -i /tmp/bed.in \
    -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "${5:-anull},loudnorm=I=-18:TP=-1.5" "$out"
}
# whalejazz — humpback whale song, US National Park Service, PUBLIC DOMAIN
getbed "$IA/HumpbackWhalesSongsSoundsVocalizations/Humpback_whale_song_2.mp3" 0 38 whale_song
# atlantidrone — hydrophone in a flooded WWII bunker, Vigsø DK, CC Public Domain Mark
getbed "$IA/20150723134918/bunker_inside_underwater.mp3" 60 40 hydrophone
# crickettempo — night cricket chorus, Saint-Ouen-des-Alleux FR (aporee), CC Public Domain Mark
getbed "$IA/aporee_50831_57991/NuitSODA.mp3" 5 40 crickets
# sourdough — volcanic mud-pot bubbling, Caldara di Manziana IT (aporee), CC PD Mark;
#   VERY quiet source (~-42 dB), boosted hard so the bubbles read (spokenword-fix path)
getbed "$IA/aporee_27893_32148/140810caldera2.mp3" 20 40 ferment_bubble "volume=15dB"

# --- synthesized tech-elegy beds (deterministic ffmpeg lavfi, license-free) ---
synbed() { # name | aevalsrc-expr | dur | extra-af(before loudnorm)
  local out="found/$1.mp3"
  [ -s "$out" ] && return 0
  echo "→ synbed $1"
  ffmpeg -y -loglevel error -f lavfi -i "aevalsrc='$2':d=${3}:s=44100" \
    -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "${4:-anull},loudnorm=I=-18:TP=-1.5" "$out"
}
# crtwave — the 15.734 kHz NTSC flyback whine (real line frequency) + faint mains hum
synbed crt_whine "0.5*sin(2*PI*15734*t)*(1+0.05*sin(2*PI*0.5*t))+0.09*sin(2*PI*60*t)+0.04*sin(2*PI*120*t)" 16
# faxbossa — the fax CNG/CED tones held as a wistful pad: 1100 Hz call + a 2100 Hz answer swell
synbed fax_tone "0.45*sin(2*PI*1100*t)*(1+0.10*sin(2*PI*4*t))+0.22*sin(2*PI*2100*t)*exp(-t*0.6)*lt(t\,3)" 9
# floppycore — 3.5\" drive head-stepper clatter (STYLIZED: gated ~220 Hz buzz bursts)
synbed floppy_seek "(2*gt(sin(2*PI*220*t)\,0)-1)*0.4*lt(mod(t\,0.09)\,0.05)*(0.6+0.4*sin(2*PI*0.7*t))" 4 "highpass=f=120,lowpass=f=3500"

# hvac_hum — thermostatwave: furnace/HVAC room tone (brown noise + 120/60 Hz hum)
if [ ! -s found/hvac_hum.mp3 ]; then
  echo "→ synbed hvac_hum"
  ffmpeg -y -loglevel error \
    -f lavfi -i "anoisesrc=d=16:c=brown:a=0.6:r=44100" \
    -f lavfi -i "aevalsrc='0.15*sin(2*PI*120*t)+0.10*sin(2*PI*60*t)':d=16:s=44100" \
    -filter_complex "[0]lowpass=f=480[b];[b][1]amix=inputs=2:normalize=0,loudnorm=I=-18:TP=-1.5[o]" \
    -map "[o]" -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 found/hvac_hum.mp3
fi
# modem_handshake — dialupgabber: STYLIZED 56k handshake (DTMF dial → 2100 Hz answer →
#   dual carriers → FSK data warble + band-limited scramble noise). Not the real V.90
#   sequence — a recognizable synthesis chopped into the drop.
if [ ! -s found/modem_handshake.mp3 ]; then
  echo "→ synbed modem_handshake"
  ffmpeg -y -loglevel error \
    -f lavfi -i "aevalsrc='0.35*(sin(2*PI*697*t)+sin(2*PI*1336*t))*between(t\,0.10\,0.35)+0.35*(sin(2*PI*770*t)+sin(2*PI*1477*t))*between(t\,0.45\,0.70)+0.40*sin(2*PI*2100*t)*between(t\,1.2\,2.0)+0.28*(sin(2*PI*1080*t)+sin(2*PI*1750*t))*between(t\,2.0\,3.2)+0.30*sin(2*PI*(1700+500*sin(2*PI*11*t))*t)*gt(t\,3.2)':d=6:s=44100" \
    -f lavfi -i "anoisesrc=d=6:c=white:a=0.3:r=44100" \
    -filter_complex "[1]highpass=f=1200,lowpass=f=2600,tremolo=f=9:d=0.9[n];[0][n]amix=inputs=2:weights='1 0.45':normalize=0,loudnorm=I=-18:TP=-1.5[o]" \
    -map "[o]" -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 found/modem_handshake.mp3
fi
# --- second archive.org bed batch: birds + domestic appliances ---
# pigeonstep — domestic/rock pigeon (Columba livia), 5-note coo; Museo de Ciencias
#   de Bahía Blanca "Paseo de Aves" archive (CC BY-SA 4.0). 12.7s clip, taken whole.
getbed "$IA/44PalomaDomsticaMuseoDeCienciasDeBahaBlancaArchivoSonoroPaseoDeAves/44%20-%20Paloma%20dom%C3%A9stica%20-%20Museo%20de%20Ciencias%20de%20Bah%C3%ADa%20Blanca%20-%20Archivo%20sonoro%20-%20Paseo%20de%20Aves.mp3" 0 12 pigeon_coo
# chickadeecore — black-capped chickadee fee-bee whistle; eColore HAMBIO bioacoustic
#   monitoring, Hamilton ON (CC BY 4.0). fee-bee at t≈6s.
getbed "$IA/ecolore-hamont-bioacoustic-observation-537/hamont-bioacoustic-observation-537.mp3" 5.5 8 chickadee
# dishwasherwave — dishwasher mid-cycle rinse-pump hum, Poznań kitchen (radio aporee, CC PD Mark)
getbed "$IA/aporee_14738_46150/szer.mp3" 30 40 dw_cycle
# laundrycore — tumble dryer contact-mic spin drone, Berlin Ohlauer Str. waschsalon (aporee, CC BY-SA 3.0)
getbed "$IA/aporee_8942_14632/berlinOhlauerWaschsalonContact111204c.mp3" 5 35 dryer_spin
# ===== END 30-genre commission beds ==========================================

# --- Allen Ginsberg — "Basic Poetics" class, Naropa 1980 (spoken-word source) ---
# A full poetics LECTURE (not a reading) from the Naropa Poetics Audio Archive
# (CC BY-NC-ND — ND flagged for release, fine for local sketches). Boost-
# normalized like the spokenword voice-fix path, trimmed to a usable 90s window.
# Wired into the spokenword/jazz/termswave/furnacestrut found pools (SOURCES id
# vx_ginsberg_class). Not committed (external CC — see SOURCES.md).
if [ ! -s found/vx_ginsberg_class.mp3 ]; then
  echo "→ vx_ginsberg_class (Ginsberg, Basic Poetics, Naropa 1980)"
  curl -sL -C - --retry 3 --max-time 600 -o /tmp/ginsberg_class.mp3 \
    "$IA/Allen_Ginsberg_Basic_Poetics_class_20_April_1980_80P020/Allen_Ginsberg_Basic_Poetics_class_20_April_1980_80P020_64kb.mp3"
  ffmpeg -y -loglevel error -ss 120 -t 90 -i /tmp/ginsberg_class.mp3 \
    -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "loudnorm=I=-16:TP=-1.5" found/vx_ginsberg_class.mp3
  rm -f /tmp/ginsberg_class.mp3
fi

echo "Done. Found sound ready in found/ — render via engine/faust press, e.g.:"
echo "  node tools/kernel-cli.js track jungle --seed 7 --render"
