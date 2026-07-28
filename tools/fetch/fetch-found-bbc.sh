#!/usr/bin/env bash
# Fetch + prepare the BBC Sound Effects layer (sound-effects.bbcrewind.co.uk).
# 36 ambience beds + 4 chime one-shots, curated across the SOURCE_POOLS
# classes (city/road/industry/voices/nature/water/room/weather/smalltown/chime).
#
# LICENSE: everything here is BBC archive material under the RemArc licence —
# personal, educational or research use, NON-COMMERCIAL, no redistribution.
# Tier 2 in SOURCES.md: the audio is fetched to gitignored found/, is never
# committed, never packaged, never mirrored; this script IS the committed
# deliverable, and everyone who runs it downloads from the BBC directly.
# Full ledger: SOURCES.md "BBC Sound Effects".
#
#   tools/fetch/fetch-found-bbc.sh
#
# Sequential on purpose, with a courtesy pause between downloads — we are a
# guest on the BBC's media CDN. Requires: curl, ffmpeg. Idempotent: existing
# non-empty outputs are skipped, so it resumes cleanly.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p found found/samples/bbc
MEDIA="https://sound-effects-media.bbcrewind.co.uk/mp3"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT

getbbc() { # bbcId | trim-start(s) | trim-len(s) | localId  ->  found/<localId>.mp3 (bed)
  local out="found/$4.mp3"
  [ -s "$out" ] && return 0
  echo "→ bbc bed $4 ($1)"
  curl -sL --retry 3 --max-time 300 -o "$TMP" "$MEDIA/$1.mp3"
  ffmpeg -y -loglevel error -ss "$2" -t "$3" -i "$TMP" \
    -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "loudnorm=I=-18:TP=-1.5" "$out"
  sleep 2   # courtesy gap — go slowly
}
getbbchit() { # bbcId | trim-start(s) | trim-len(s) | name  ->  found/samples/bbc/<name>.wav (one-shot)
  local out="found/samples/bbc/$4.wav"
  [ -s "$out" ] && return 0
  echo "→ bbc hit $4 ($1)"
  curl -sL --retry 3 --max-time 300 -o "$TMP" "$MEDIA/$1.mp3"
  ffmpeg -y -loglevel error -ss "$2" -t "$3" -i "$TMP" \
    -ac 1 -ar 44100 \
    -af "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1" "$out"
  sleep 2
}

# --- beds: found/<id>.mp3 (SOURCES + SOURCE_POOLS in engine/genre-kernel.js) ---
getbbc 07028153 8 38 bbc_petticoat_market_76   # city: London street market, 1976 — costermonger hubbub
getbbc 07062096 5 36 bbc_arcade_85             # city: amusement arcade, 1985 — game bleeps + fruit machines over crowd wash
getbbc 07052062 6 36 bbc_istanbul_bazaar       # city: Istanbul covered bazaar — vaulted acoustic, crockery, murmur
getbbc 07035165 10 38 bbc_termini_platform     # city: Rome Termini platform — cavernous station hall
getbbc 07014026 10 40 bbc_m1_drone             # road: M1 motorway hum, mid-distant — the archetypal road wash
getbbc 07041063 5 40 bbc_italian_steam         # road: Italian steam train interior — clickety-clack tempo grid
getbbc 07032017 25 40 bbc_blackpool_tram       # road: Blackpool tram interior — motor-whine glissandi (trim skips the stop)
getbbc 07018079 5 40 bbc_container_engineroom  # road: container-ship engine room — marine-diesel drone, no speech
getbbc 07070124 5 38 bbc_hand_loom             # industry: hand loom — shuttle-and-treadle rhythm machine
getbbc 07042022 5 38 bbc_water_mill            # industry: water mill interior — wood creak + gear rumble + drive water
getbbc 07027028 4 36 bbc_centurion_press       # industry: Centurion two-revolution press — a mechanical drum loop
getbbc 07072106 40 40 bbc_beam_engine          # industry: Victorian beam engine, constant run (trim skips start-up; faint voices)
getbbc 07003059 10 38 bbc_concert_hall_murmur  # voices: audience murmur, BBC Concert Hall
getbbc 07060109 20 38 bbc_playground_1971      # voices: Birmingham school playground, 1971
getbbc 07048068 15 38 bbc_shoshu_chant         # voices: Nichiren Shoshu evening chant + beads (window ends before the 2'09" pause)
getbbc 07049099 20 38 bbc_versailles_market    # voices: Versailles Sunday market, vendor calls
getbbc 07059128 5 35 bbc_nz_cicada_shimmer     # nature: massed NZ cicadas — broadband shimmer, birdless
getbbc NHU05035028 10 40 bbc_kakamega_night    # nature: Kakamega Forest night — crickets + bat pings (NHU, 1990)
getbbc NHU05075034 5 40 bbc_ranomafana_frognight # nature: Ranomafana night — frogs/insects/river (NHU, 1988)
getbbc NHU05075028 5 40 bbc_berenty_treegroan  # nature: wind in groaning tamarinds, Berenty (NHU)
getbbc 07068032 5 40 bbc_underwater_river      # water: underwater river — submerged roil
getbbc 07034013 8 40 bbc_anchor_locker         # water: seawash from a ferry's anchor chain locker — steel-hull resonance
getbbc 07012119 10 40 bbc_loch_lapping         # water: lapping, Loch Broom shore
getbbc 07012120 10 40 bbc_skye_stream          # water: mountain stream over rocks, Isle of Skye
getbbc 07070160 3 35 bbc_clock_room            # room: a room full of ticking clocks — phasing escapements
getbbc 07070147 5 40 bbc_grandfather_1680      # room: grandfather clock, 1680 — dry wooden tick
getbbc 07027236 5 40 bbc_fridge_hum            # room: domestic refrigerator hum — pure compressor steady-state
getbbc 07060091 8 40 bbc_brewery_boiler        # room: boiler room, Courage Brewery
getbbc 07047154 5 38 bbc_wire_song             # weather: gusty wind through wires — aeolian drone
getbbc 07044115 10 40 bbc_hail_umbrella        # weather: hail on an umbrella — granular percussion skin
getbbc 07054120 8 40 bbc_blizzard_shutters     # weather: blizzard from indoors, banging shutters
getbbc 07043384 6 38 bbc_yacht_cabin_gale      # weather: gale + rain heard from a yacht cabin
getbbc 07040004 8 40 bbc_kilndown_peal         # smalltown: village peal of six, Kilndown, Kent (1966)
getbbc 07019105 5 40 bbc_forge_shoeing         # smalltown: blacksmith shoeing a horse — anvil ring, no speech
getbbc 07050159 5 40 bbc_cart_ride             # smalltown: horse and wooden cart, recorded on the cart
getbbc 07063076 3 40 bbc_perigord_square       # smalltown: small village square, Périgord

# --- one-shots: found/samples/bbc/<name>.wav (SAMPLES kind:"hit", chime pool) ---
getbbchit 07042284 0 10 lutine_bell            # the actual Lutine bell, Lloyd's of London
getbbchit 07014106 0 4.5 electro_gong          # BBC-created electronic gong (Radiophonic-adjacent)
getbbchit 07032001 0 6.1 tram_bell             # Blackpool tram stop-bell, single clang
getbbchit 07042240 0 6.7 dingdong_door         # electric doorbell, the suburban two-note ding-dong

echo "Done. BBC layer ready: 36 beds in found/bbc_*.mp3, 4 hits in found/samples/bbc/."
echo "Hear one:  node tools/kernel-cli.js track ambient --seed 7 --render"
