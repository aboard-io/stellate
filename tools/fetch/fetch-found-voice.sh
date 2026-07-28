#!/usr/bin/env bash
# Fetch + prepare the found-VOICE layer from the Internet Archive.
# Talking, poetry, old radio, numbers stations, time ladies — voices with
# presence, meant to be looped/chopped/pitched under music at 2am.
# The audio is NOT committed (external, PD/CC — see SOURCES.md "Voice / radio /
# poetry"). This script IS committed: it's the recipe that makes it recoverable.
#
#   ./fetch-found-voice.sh
#
# Downloads each source (curl, resumable), trims the best <=90s window, and
# converts to mono 44.1k MP3 (found/vx_<id>.mp3, libmp3lame V2) so the engine can load it as a
# granular/sample source, plus a small .ogg preview for auditioning.
# Idempotent: skips any vx_<id> whose .mp3 already exists.
# Requires: curl, ffmpeg.
#
# LICENSES vary per entry (comments below; details in SOURCES.md):
#   PD        = public domain, chop freely
#   BY-NC-ND  = Creative Commons NoDerivatives — fine to audition locally, but a
#               released remix needs a human judgment call. Flagged per entry.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p found

# id|direct url|trim-start(s)|trim-len(s)
sources=(
  # ---- Naropa Poetics Audio Archive (all CC BY-NC-ND 1.0 — ND: flag for release) ----
  # William S. Burroughs reading — the driest, most hypnotic voice in America
  "burroughs|https://archive.org/download/naropa_william_s_burroughs3/naropa_william_s_burroughs3_64kb.mp3|900|90"
  # Allen Ginsberg & Anne Waldman reading, April 1977
  "ginsberg|https://archive.org/download/Allen_Ginsberg_and_Anne_Waldman_reading_April_1977_77C002/Allen_Ginsberg_and_Anne_Waldman_reading_April_1977_77C002_64kb.mp3|300|90"
  # Anne Waldman reading, August 1978 — incantatory performance voice
  "waldman|https://archive.org/download/Anne_Waldman_reading_1978_August_1978_78P110/Anne_Waldman_reading_1978_August_1978_78P110_64kb.mp3|600|90"
  # ---- The Conet Project, ird059 (Irdial-Discs "Free Music Philosophy": free to
  #      copy/distribute; no CC license on the item — flag for release) ----
  # The Lincolnshire Poacher (MI6 numbers station): jaunty interval tune + numbers
  "conet_poacher|https://archive.org/download/ird059/tcp_d1_06_the_lincolnshire_poacher_mi5_irdial.mp3|60|90"
  # The Swedish Rhapsody: music-box melody + a voice reading digits — pure haunt
  "conet_swedish|https://archive.org/download/ird059/tcp_d1_01_the_swedish_rhapsody_irdial.mp3|0|90"
  # ---- LibriVox (public domain) ----
  # Blake, Songs of Experience (incl. The Tyger)
  "blake|https://archive.org/download/songsofinnocenceandexperience_2001_librivox/songsofinnocenceandexperience_02_blake_64kb.mp3|30|90"
  # Dickinson, "Because I could not stop for Death" — complete poem, 60s
  "dickinson|https://archive.org/download/dickinson_poems_bm_librivox/06-because_i_could_not_stop_dickinson_64kb.mp3|8|62"
  # Whitman, Song of Myself part 1 ("I celebrate myself...")
  "whitman|https://archive.org/download/leaves_of_grass_librivox/leaves_03.1_whitman_64kb.mp3|65|90"
  # ---- Old-time radio (OTRR-certified PD shows; collection tagged CC BY-NC-ND — flag) ----
  # X Minus One, "The Cave of Night" (1956) — countdown intro, space-age announcer
  "xminusone|https://archive.org/download/OTRR_X_Minus_One_Singles/XMinusOne56-02-01036TheCaveOfNight.ogg|0|90"
  # Suspense, "The Hitch-Hiker" w/ Orson Welles (1942) — the opening sting + intro
  "suspense|https://archive.org/download/OTRR_Suspense_Singles_By_Year_1942/Suspense%20420902%20011%20The%20Hitch-Hiker%20%28128-44%29%2028018%2029m32s.mp3|0|90"
  # ---- Broadcast history (public domain) ----
  # FDR fireside chat, Dec 9 1941, after the declaration of war (PD mark)
  "fdr|https://archive.org/download/FDRFiresideChatWarOnJapan/President%20Franklin%20D%20Roosevelt%2527s%20Fireside%20Chat%20Following%20the%20Declaration%20of%20War%20on%20Japan%2C%2012-09-1941.mp3|30|90"
  # CBS complete broadcast day, D-Day, June 6 1944, part 1 — first bulletins (PD)
  "dday|https://archive.org/download/Complete_Broadcast_Day_D-Day/Complete_Broadcast_Day_440606_Part_001.mp3|0|90"
  # ---- Time, space, telephone ----
  # NIST WWVH shortwave time station, 1980s: "At the tone..." (CC BY-NC 3.0)
  "wwvh|https://archive.org/download/sraa-7ov2e9got5ntfl3y4r9mnblppuzdkm/RadioStationWwvh-StationIdBroadcastSample1980s2359UtcfullLength.mp3|0|90"
  # Apollo 11 mission audio highlights — capcom/crew loop (NASA voice traffic, PD;
  # item itself carries no license statement)
  "apollo|https://archive.org/download/apollo11_highlights/apollo11_filtered.ogg|300|90"
  # "At The Tone" 01 — telephone time-of-day & weather ladies (Audichron et al.);
  # compilation license not stated — flag for release
  "timelady|https://archive.org/download/AtTheTone01/At%20The%20Tone%2001.ogg|60|90"
  # ---- chinawave anchors (Chinese socialist 1950s-60s) ----
  # The East Is Red, massed chorus + orchestra (China Record Corp, 1967) — CC0
  "cn_east|https://archive.org/download/sailing-the-seas-depends-on-the-helmsman-english/The%20East%20is%20Red.mp3|0|90"
  # March of the People's Liberation Army, band (LP rip; no license stated — flag)
  "cn_march|https://archive.org/download/Music_of_the_Chinese_Revolution/March.of.the.Peoples.Liberation.Army.mp3|0|75"
  # "The North Wind Blows" from The White-Haired Girl opera, China Opera and Dance
  # Drama Theatre (1950s recording; no license stated — flag)
  "cn_opera|https://archive.org/download/lp_arias-from-the-opera-the-white-haired-g_china-opera-and-dance-drama-theatre/disc1/01.02.%20The%20North%20Wind%20Blows.mp3|0|90"
  # Radio Peking shortwave, 1963 — period propaganda broadcast (SRAA, CC BY-NC 3.0)
  "cn_speech|https://archive.org/download/sraa-radio-peking-1963/Radio%20Peking%20%281963%29.mp3|0|90"
  # ---- sovietwave anchors ----
  # Polyushko-Polye, Alexandrov Red Army Ensemble 78rpm (pre-1946 Soviet recording,
  # PD-old; George Blood 78 rip, item carries no license statement)
  "sv_choir|https://archive.org/download/78_polushko-polie-my-own-my-beloved-field_a-v-alexandrov-peoples-artist-of-the-u_gbia0060054b/Polushk%20-%20A.%20V.%20Alexandrov%20People%27s%20Artist%20of%20the%20U.S.S.R..mp3|5|85"
  # March of the Tanks, chorus & orch. GABT USSR, 1941 78rpm (pre-1946, PD-old)
  "sv_march|https://archive.org/download/78_march-of-the-tanks_chorus-and-orch-gabt-ussr-elen-senkewich-v-timofeiev-m-bl_gbia0033872b/March%20of%20the%20Tanks%20-%20Chorus%20and%20orch.%20Gabt%20U.S.S.R.%20Elen%20Senkewich.mp3|5|85"
  # Lenin, speeches recorded to gramophone 1919-1921 (PD-old)
  "sv_speech|https://archive.org/download/leninspeeches1919-1921/sideA.mp3|10|80"
  # Radio Moscow English service, Soyuz 26 launch, Dec 10 1977 (SRAA, CC BY-NC 3.0)
  "sv_radio|https://archive.org/download/sraa-radio-moscow-salyut-6-space-station-coverage-december-10-1977/1977-12-10%20Saturday%20-%20Soyuz%2026%20Launch%20%281%29.mp3|0|90"
)

for src in "${sources[@]}"; do
  IFS='|' read -r id url ss dur <<< "$src"
  mp3="found/vx_${id}.mp3"
  if [ -s "$mp3" ]; then
    echo "✓ ${mp3} already prepared, skipping"
    continue
  fi
  raw="found/.vx_${id}.src"
  echo "→ vx_${id}: ${url}"
  curl -sL -C - --retry 3 --max-time 600 -o "$raw" "$url"
  ffmpeg -y -loglevel error -ss "$ss" -t "$dur" -i "$raw" \
         -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 "$mp3"
  ffmpeg -y -loglevel error -i "$mp3" -c:a libvorbis -q:a 3 "found/vx_${id}.ogg"
  rm -f "$raw"
  echo "  prepared ${mp3} (${dur}s mono 44.1k, from ${ss}s) + vx_${id}.ogg preview"
done

echo "Done. Voice layer in found/vx_*.mp3 — see SOURCES.md for credits/licenses."
