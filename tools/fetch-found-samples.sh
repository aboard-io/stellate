#!/usr/bin/env bash
# Fetch + prepare the SAMPLE layer from the Internet Archive: drum breaks,
# rave one-shots (stabs/shouts/fx), and public-domain vocal radio chatter.
# Samples are NOT committed (gitignored); this recipe IS. See SOURCES.md.
#
#   ./fetch-found-samples.sh
#
# Output:
#   found/samples/breaks/amenNN_BPM.wav   - classic breaks, source bpm in name
#   found/samples/hits/dccTT_NN.wav       - silence-split rave one-shots
#   found/samples/vox/apollo_NN.wav       - PD Apollo 11 radio one-liners
#   found/samples/manifest.json           - every sample + duration + class
# Requires: curl, ffmpeg, python3.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p found/samples/breaks found/samples/hits found/samples/vox

IA="https://archive.org/download"

# canawave: the loon call as a one-shot hit (USFWS, public domain)
echo "→ hit loon"
ffmpeg -y -loglevel error -i "$IA/CommonLoon/loons.mp3" -ac 1 -ar 44100 found/samples/hits/loon.wav

# --- drum breaks: Amen Break Pack (source bpm encoded in filename) ---
breaks=( cw_amen01_175 cw_amen02_165 cw_amen04_170 cw_amen07_172 )
for b in "${breaks[@]}"; do
  bpm="${b##*_}"
  out="found/samples/breaks/amen_${bpm}_${b:7:2}.wav"
  if [ ! -s "$out" ]; then
    echo "→ break $b"
    curl -sL --max-time 120 -o /tmp/break.wav "$IA/amen-breaks/${b}.wav"
    ffmpeg -y -loglevel error -i /tmp/break.wav -ac 1 -ar 44100 \
      -af "loudnorm=I=-16:TP=-1" "$out"
  fi
done

# --- rave one-shots: Dangerous CD Company sample CD, silence-split ---
# Mid-CD tracks are banks of stabs/shouts/fx; split on silence, keep 0.2-2.5s.
dcc_tracks=( 30 48 66 )
for t in "${dcc_tracks[@]}"; do
  marker="found/samples/hits/.dcc${t}.done"
  if [ ! -f "$marker" ]; then
    echo "→ dcc track $t (silence-split)"
    curl -sL --max-time 300 -o /tmp/dcc.flac \
      "$IA/dangerous-cd-company-danger-1-sample-cd/Dangerous%20CD%20Company/${t}%20Track%20${t}.flac"
    python3 - "$t" <<'PYEOF'
import subprocess, sys, re, os
t = sys.argv[1]
det = subprocess.run(["ffmpeg","-i","/tmp/dcc.flac","-af",
  "silencedetect=noise=-35dB:d=0.25","-f","null","-"],
  capture_output=True, text=True).stderr
ends   = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", det)]
starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", det)]
segs, n = [], 0
for e in ends:
    nxt = min([s for s in starts if s > e], default=None)
    if nxt and 0.2 <= nxt - e <= 2.5: segs.append((e, nxt - e))
for i,(off,dur) in enumerate(segs[:24]):
    out = f"found/samples/hits/dcc{t}_{i:02d}.wav"
    subprocess.run(["ffmpeg","-y","-loglevel","error","-ss",str(max(0,off-0.02)),
      "-t",str(dur+0.06),"-i","/tmp/dcc.flac","-ac","1","-ar","44100",
      "-af","loudnorm=I=-16:TP=-1", out], check=True)
    n += 1
print(f"  kept {n} one-shots from track {t}")
PYEOF
    touch "$marker"
  fi
done

# --- PD vocal chatter: Apollo 11 onboard/air-ground one-liners ---
# (public domain NASA audio; iconic in techno/jungle since the early 90s)
apollo() { # url | start | dur | name
  local url="$1" ss="$2" d="$3" name="$4" out="found/samples/vox/${4}.wav"
  [ -s "$out" ] && return 0
  echo "→ vox $name"
  curl -sL --max-time 180 -o /tmp/apollo.mp3 "$url"
  ffmpeg -y -loglevel error -ss "$ss" -t "$d" -i /tmp/apollo.mp3 -ac 1 -ar 44100 \
    -af "highpass=f=250,lowpass=f=3400,loudnorm=I=-15:TP=-1" "$out"
}
apollo "$IA/Apollo11Audio/11-03301.mp3" 25  3.2 apollo_a
apollo "$IA/Apollo11Audio/11-03305.mp3" 40  2.8 apollo_b
apollo "$IA/Apollo11Audio/11-03310.mp3" 60  3.0 apollo_c

# --- 78rpm shellac (George Blood digitization, public-domain audio) ---
# crusty acoustic-era beds + one-shot horn/string phrases for triphop/jazz/vapor
sev8(){ # item | file | start | dur | name
  local out="found/samples/78s/${5}.wav"
  [ -s "$out" ] && return 0
  echo "→ 78rpm $5"
  local enc; enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$2")
  curl -sL --max-time 240 -o /tmp/78.mp3 "$IA/$1/$enc"
  ffmpeg -y -loglevel error -ss "$3" -t "$4" -i /tmp/78.mp3 -ac 1 -ar 44100     -af "highpass=f=180,lowpass=f=6500,loudnorm=I=-16:TP=-1" "$out"
}
mkdir -p found/samples/78s
# (was St. Louis Blues / gbia0001837b — that item went access-restricted; Europe's Society Orchestra brass band, PD 1914, is the replacement)
sev8 Europes_Society_Orch-Castle_Rag "Europes_Society_Orch-Castle_House_Rag-Victor-35372.mp3" 20 12 horns_78
sev8 78_after-youve-gone_pee-wee-hunt-and-his-orchestra-crammer-layton_gbia0262239b "AFTER YOU'VE GONE - PEE WEE HUNT and his Orchestra.mp3" 8 10 blues_vox_78

# more rave one-shots from deeper in the Dangerous CD
for t in 12 20; do
  marker="found/samples/hits/.dcc${t}.done"
  if [ ! -f "$marker" ]; then
    echo "→ dcc track $t (silence-split)"
    { curl -sL --max-time 300 -o /tmp/dcc.flac       "$IA/dangerous-cd-company-danger-1-sample-cd/Dangerous%20CD%20Company/${t}%20Track%20${t}.flac" &&     python3 - "$t" <<'PYEOF2'
import subprocess, sys, re
t = sys.argv[1]
det = subprocess.run(["ffmpeg","-i","/tmp/dcc.flac","-af","silencedetect=noise=-35dB:d=0.25","-f","null","-"],capture_output=True,text=True).stderr
ends=[float(m) for m in re.findall(r"silence_end: ([\d.]+)",det)]
starts=[float(m) for m in re.findall(r"silence_start: ([\d.]+)",det)]
n=0
for e in ends:
    nxt=min([s for s in starts if s>e],default=None)
    if nxt and 0.2<=nxt-e<=2.5 and n<16:
        subprocess.run(["ffmpeg","-y","-loglevel","error","-ss",str(max(0,e-0.02)),"-t",str(nxt-e+0.06),
          "-i","/tmp/dcc.flac","-ac","1","-ar","44100","-af","loudnorm=I=-16:TP=-1",
          f"found/samples/hits/dcc{t}_{n:02d}.wav"],check=True); n+=1
print(f"  kept {n} from track {t}")
PYEOF2
    } || echo "  skip track $t"
    touch "$marker"
  fi
done

# --- speech synthesis as an instrument (espeak-ng, generated locally) ---
# robotic spoken phrases, pitched/paced per vibe; the kernel schedules them
# as one-shot hits like any other vocal sample
mkdir -p found/samples/speech
say() { # name | text | pitch | speed | extra-af
  local out="found/samples/speech/${1}.mp3"
  [ -s "$out" ] && return 0
  echo "→ speech $1"
  espeak-ng -v en-us -p "$3" -s "$4" -w /tmp/say.wav "$2"
  ffmpeg -y -loglevel error -i /tmp/say.wav -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "${5:-anull},loudnorm=I=-15:TP=-1" "$out"
}
say plaza      "welcome to the digital plaza"        28 118 "asetrate=44100*0.92,aresample=44100"
say shopping   "thank you for shopping with us"      30 112 "asetrate=44100*0.9,aresample=44100"
say system     "system online"                       18 105 "anull"
say energy     "energy levels rising"                22 120 "anull"
say rewind     "rewind. selecta"                     14  95 "asetrate=44100*0.85,aresample=44100"
say pressure   "maximum pressure"                    16 100 "anull"
say rhythm     "feel the rhythm inside"              35 125 "anull"
say nightdrive "night drive engaged"                 20 100 "asetrate=44100*0.95,aresample=44100"
say herenow    "you are here now"                    25  85 "anull"
say slowdown   "slow down. breathe"                  24  90 "anull"

# --- paleontologist narration (dino-synth / planetarium voiceover; glitched at render) ---
say paleo_welcome "welcome, to the age of the dinosaurs"                     30 88  "asetrate=44100*0.94,aresample=44100"
say paleo_mesozoic "the mesozoic era began, two hundred fifty million years ago" 24 92 "anull"
say paleo_sauropod "behold the sauropod. the largest creature ever to walk the earth" 20 90 "asetrate=44100*0.92,aresample=44100"
say paleo_rex      "in the late cretaceous, the tyrannosaurus ruled"          16 86  "anull"
say paleo_bones    "these bones tell a story, sixty six million years old"    26 90  "anull"
say paleo_skies    "look up. once, these skies belonged to the pterosaurs"    34 92  "asetrate=44100*0.95,aresample=44100"

# --- the national news (canawave voiceover; espeak en-ca if available, else en) ---
sayca() { local out="found/samples/speech/${1}.mp3"; echo "→ news $1"; espeak-ng -v en-ca -p "$3" -s "$4" -w /tmp/say.wav "$2" 2>/dev/null || espeak-ng -v en-us -p "$3" -s "$4" -w /tmp/say.wav "$2"; ffmpeg -y -loglevel error -i /tmp/say.wav -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 -af "$5" "$out"; }
sayca ca_news    "good evening. coast to coast to coast, this is the national." 40 98  "anull"
sayca ca_maple   "the maple harvest is the largest on record."                 42 100 "anull"
sayca ca_gold    "and Canada takes the gold, in overtime!"                      46 104 "anull"
sayca ca_lights  "the northern lights lit up the territory skies tonight."     38 98  "asetrate=44100*0.98,aresample=44100"
sayca ca_rockies "from the rockies to the atlantic, a beautiful day, eh."      44 100 "anull"
sayca ca_sorry   "and that's the news. thank you. and sorry."                  40 96  "anull"
sayca ca_justwatchme "well. just watch me."                                    36 92  "anull"
sayca ca_hockey  "he shoots, he scores!"                                       50 118 "anull"
sayca ca_cities  "Saskatoon beneath the moon. Medicine Hat, the sky falls flat. Moose Jaw, Red Deer, Thunder Bay. Gander, oh Gander, we wander away. Halifax to Kelowna, this land, we proudly own her." 40 165 "anull"
# hockey, hockey lore, hockey stuff
sayca ca_he_shoots "he shoots... he scores!"                                    48 112 "anull"
sayca ca_hnic      "hockey night in canada!"                                    44 110 "anull"
sayca ca_cup       "and lord stanley's cup, comes home to canada!"              40 104 "anull"
sayca ca_topshelf  "top shelf, where mama hides the cookies!"                   48 116 "anull"
sayca ca_fivehole  "five hole! oh, what a beauty!"                              46 116 "anull"
sayca ca_gretzky   "gretzky, behind the net, he scores!"                        42 112 "anull"
sayca ca_save      "glove save! and a beauty!"                                  50 118 "anull"
sayca ca_overtime  "overtime. sudden death. the nation holds its breath."       36 100 "anull"

# --- transitwave: station-PA train-schedule announcements (espeak; telephone band + slight slowdown = PA timbre) ---
saytransit() { # name | text | pitch | speed | extra-af
  local out="found/samples/speech/${1}.mp3"
  [ -s "$out" ] && return 0
  echo "→ transit $1"
  espeak-ng -v en-us -p "$3" -s "$4" -w /tmp/say.wav "$2"
  # harmonize the PA voice: root + a fifth above + an octave below, mixed together.
  # rubberband pitch-shifts WITHOUT changing duration, so the three voices stay
  # time-aligned = a station-announcement robot choir (telephone-band, slightly glitched
  # later by the engine).
  ffmpeg -y -loglevel error -i /tmp/say.wav -filter_complex \
    "[0:a]highpass=f=280,lowpass=f=3600,${5:-anull}[b];[b]asplit=3[r][f][o];\
[f]rubberband=pitch=1.4983,volume=0.5[fifth];[o]rubberband=pitch=0.5,volume=0.55[oct];\
[r][fifth][oct]amix=inputs=3:normalize=0,loudnorm=I=-15:TP=-1[out]" \
    -map "[out]" -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 "$out"
}
saytransit tw_next      "the next regional train, to poughkeepsie, departs from track nine, at nine fourteen"        30 148 "asetrate=44100*0.97,aresample=44100"
saytransit tw_arriving  "now arriving on track two, the seven forty five express, to new haven"                      28 150 "anull"
saytransit tw_standclear "stand clear of the closing doors, please"                                                 22 138 "anull"
saytransit tw_express   "this is a manhattan bound express train. the next stop is, fourteenth street, union square" 26 150 "anull"
saytransit tw_delay     "the northbound train to croton harmon, is delayed, approximately ten minutes"              30 150 "asetrate=44100*0.97,aresample=44100"
saytransit tw_gap       "please mind the gap, between the train, and the platform"                                   26 142 "anull"
saytransit tw_aboard    "all aboard. the empire service to albany, now boarding"                                    22 134 "anull"
saytransit tw_local     "this is a brooklyn bound local train. transfer is available, for the A, C, and E trains"    28 150 "anull"
saytransit tw_terminus  "this train terminates here. last stop, grand central terminal. please take your belongings" 24 140 "anull"
saytransit tw_tickets   "tickets, please. have your tickets ready, for inspection"                                  30 146 "anull"
# the departures litany — the schedule itself, read out (chopped texture, Reich-style)
saytransit tw_schedule  "departures. eight oh two, hudson line, local. eight fifteen, harlem line, express. eight twenty nine, new haven. eight forty one, port jervis. eight fifty three, montauk. nine oh seven, ronkonkoma. nine nineteen, babylon. now boarding, all stations." 32 165 "anull"

# --- station names from major metros worldwide (buried, triggered every measure; the engine
#     glitches them downward + gates the amplitude with a square LFO) ---
saystation() { # name | text
  local out="found/samples/speech/${1}.mp3"
  [ -s "$out" ] && return 0
  echo "→ station $1"
  espeak-ng -v en-us+f3 -p 38 -s 148 -w /tmp/say.wav "$2"   # +f3 = a feminine voice
  ffmpeg -y -loglevel error -i /tmp/say.wav -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 -af "highpass=f=300,lowpass=f=6500,loudnorm=I=-15:TP=-1.5" "$out"
}
saystation st_oxford   "Oxford Circus"          # London
saystation st_baker    "Baker Street"           # London
saystation st_kings    "King's Cross"           # London
saystation st_chatelet "Chatelet"               # Paris
saystation st_bastille "Bastille"               # Paris
saystation st_montpar  "Montparnasse"           # Paris
saystation st_shinjuku "Shinjuku"               # Tokyo
saystation st_shibuya  "Shibuya"                # Tokyo
saystation st_ginza    "Ginza"                  # Tokyo
saystation st_alex     "Alexanderplatz"         # Berlin
saystation st_zoo      "Zoo Station"            # Berlin
saystation st_komso    "Komsomolskaya"          # Moscow
saystation st_times    "Times Square"           # New York
saystation st_grand    "Grand Central"          # New York
saystation st_gangnam  "Gangnam"                # Seoul
saystation st_sol      "Puerta del Sol"         # Madrid
saystation st_marien   "Marienplatz"            # Munich
saystation st_central  "Central"                # Hong Kong
saystation st_circular "Circular Quay"          # Sydney
saystation st_dam      "Dam Square"             # Amsterdam
# many more global stops so they don't repeat within a track
saystation st_victoria "Victoria"               # London
saystation st_waterloo "Waterloo"               # London
saystation st_bank     "Bank"                   # London
saystation st_liverpool "Liverpool Street"      # London
saystation st_paddington "Paddington"           # London
saystation st_camden   "Camden Town"            # London
saystation st_brixton  "Brixton"                # London
saystation st_lazare   "Saint Lazare"           # Paris
saystation st_nord     "Gare du Nord"           # Paris
saystation st_nation   "Nation"                 # Paris
saystation st_opera    "Opera"                  # Paris
saystation st_pigalle  "Pigalle"                # Paris
saystation st_belleville "Belleville"           # Paris
saystation st_ueno     "Ueno"                   # Tokyo
saystation st_akiba    "Akihabara"              # Tokyo
saystation st_shinagawa "Shinagawa"             # Tokyo
saystation st_roppongi "Roppongi"               # Tokyo
saystation st_ikebukuro "Ikebukuro"             # Tokyo
saystation st_nakano   "Nakano"                 # Tokyo
saystation st_union    "Union Square"           # New York
saystation st_penn     "Penn Station"           # New York
saystation st_fulton   "Fulton Street"          # New York
saystation st_atlantic "Atlantic Avenue"        # New York
saystation st_coney    "Coney Island"           # New York
saystation st_astoria  "Astoria"                # New York
saystation st_bedford  "Bedford Avenue"         # New York
saystation st_potsdamer "Potsdamer Platz"       # Berlin
saystation st_kotti    "Kottbusser Tor"         # Berlin
saystation st_hbf      "Hauptbahnhof"           # Berlin
saystation st_warschauer "Warschauer Strasse"   # Berlin
saystation st_arbat    "Arbatskaya"             # Moscow
saystation st_kiev     "Kievskaya"              # Moscow
saystation st_atocha   "Atocha"                 # Madrid
saystation st_granvia  "Gran Via"               # Madrid
saystation st_hongdae  "Hongdae"                # Seoul
saystation st_itaewon  "Itaewon"                # Seoul
saystation st_jamsil   "Jamsil"                 # Seoul
saystation st_mongkok  "Mong Kok"               # Hong Kong
saystation st_causeway "Causeway Bay"           # Hong Kong
saystation st_admiralty "Admiralty"             # Hong Kong
saystation st_orchard  "Orchard"                # Singapore
saystation st_raffles  "Raffles Place"          # Singapore
saystation st_bugis    "Bugis"                  # Singapore
saystation st_townhall "Town Hall"              # Sydney
saystation st_wynyard  "Wynyard"                # Sydney
saystation st_bloor    "Bloor Yonge"            # Toronto
saystation st_spadina  "Spadina"                # Toronto
saystation st_zocalo   "Zocalo"                 # Mexico City
saystation st_pino     "Pino Suarez"            # Mexico City
saystation st_rajiv    "Rajiv Chowk"            # Delhi
saystation st_chandni  "Chandni Chowk"          # Delhi
saystation st_taksim   "Taksim"                 # Istanbul
saystation st_kadikoy  "Kadikoy"                # Istanbul
saystation st_tcentralen "T Centralen"          # Stockholm
saystation st_slussen  "Slussen"                # Stockholm
saystation st_stephans "Stephansplatz"          # Vienna
saystation st_rossio   "Rossio"                 # Lisbon
saystation st_mustek   "Mustek"                 # Prague
saystation st_catalunya "Catalunya"             # Barcelona
saystation st_sagrada  "Sagrada Familia"        # Barcelona
saystation st_termini  "Termini"                # Rome
saystation st_colosseo "Colosseo"               # Rome
saystation st_belmont  "Belmont"                # Chicago
saystation st_parkst   "Park Street"            # Boston
saystation st_harvard  "Harvard"                # Boston
saystation st_embarcadero "Embarcadero"         # San Francisco
saystation st_powell   "Powell Street"          # San Francisco
saystation st_metrocenter "Metro Center"        # Washington
saystation st_dupont   "Dupont Circle"          # Washington
saystation st_centraal "Centraal"               # Amsterdam
saystation st_se       "Se"                     # Sao Paulo
saystation st_paulista "Paulista"               # Sao Paulo
saystation st_retiro   "Retiro"                 # Buenos Aires
saystation st_sadat    "Sadat"                  # Cairo

# --- transitwave: real train one-shots (radio aporee — a train pass at Muggenhof, Nuremberg, CC) ---
echo "→ hit train_arrival / train_pass"
TW_TRAIN="$IA/aporee_9730_11655/CuteffectMuggenhof.mp3"
[ -s found/samples/hits/train_arrival.wav ] || ffmpeg -y -loglevel error -ss 40 -t 8 -i "$TW_TRAIN" -ac 1 -ar 44100 -af "highpass=f=55,loudnorm=I=-15:TP=-1" found/samples/hits/train_arrival.wav
[ -s found/samples/hits/train_pass.wav ]    || ffmpeg -y -loglevel error -ss 46 -t 4 -i "$TW_TRAIN" -ac 1 -ar 44100 -af "highpass=f=55,loudnorm=I=-15:TP=-1" found/samples/hits/train_pass.wav

# the transit door "ding ding" chime — two-tone bell (F6 then C6), synthesized
echo "→ hit door_ding"
[ -s found/samples/hits/door_ding.wav ] || ffmpeg -y -loglevel error -f lavfi -i "aevalsrc='(exp(-t*7)*(0.6*sin(2*PI*1397*t)+0.25*sin(2*PI*2794*t)+0.1*sin(2*PI*3850*t)))*lt(t\,0.62) + (exp(-(t-0.72)*6)*(0.6*sin(2*PI*1047*(t-0.72))+0.25*sin(2*PI*2094*(t-0.72))+0.1*sin(2*PI*2890*(t-0.72))))*gte(t\,0.72)':d=1.6:s=44100" -ac 1 -ar 44100 -af "loudnorm=I=-16:TP=-1.5" found/samples/hits/door_ding.wav

# the NHL goal horn (real; archive.org, academic use)
echo "→ hit goal_horn"
ffmpeg -y -loglevel error -i "$IA/washingtoncapitalsgoalhorn/Washington Capitals Goal Horn.mp3" -ac 1 -ar 44100 found/samples/hits/goal_horn.wav

# --- SAMPLED INSTRUMENTS: FluidR3_GM SoundFont -> zone wavs (the sax ask) ---
# FluidR3 GM/GS by Frank Wen, MIT license (see SOURCES.md). Faust cannot read
# SF2 (no preset/zone/loop model in `soundfile`), so engine/faust/sf2.js extracts the
# presets the kernel uses into found/samples/instruments/<slug>/ as mono wav
# zones + zones.json (root key incl. fine-tune, key ranges, loop points); the
# native sampler (faust/sampler.js) plays them. The 151MB font is fetched to
# /tmp and deleted — only the ~6MB of extracted zones stay.
if [ ! -s found/samples/instruments/alto_sax/zones.json ]; then
  echo "→ FluidR3_GM_GS.sf2 (151MB, one-time)"
  curl -sL --max-time 900 -o /tmp/FluidR3_GM_GS.sf2 \
    "$IA/fluidr3-gm-gs/FluidR3_GM_GS.sf2"
  mkdir -p found/samples/instruments
  for p in "Alto Sax" "Tenor Sax" "Nylon String Guitar" "Steel String Guitar" \
           "Trumpet" "Flute" "Vibraphone" "Clarinet" "Strings" "Bandoneon"; do
    node engine/faust/sf2.js extract /tmp/FluidR3_GM_GS.sf2 "/$p/" found/samples/instruments --max-zones 6
  done
  rm -f /tmp/FluidR3_GM_GS.sf2
fi
# --- FluidR3 blues batch (2026-07 acoustic pass): upright bass + real organs ---
# Separate guard so trees that fetched the first batch pick these up. GM 32
# "Acoustic Bass" = the upright (blues/jazz/bossa/exotica/spokenword BASS
# voice); GM 17/18 = the comping organs. GM 16 is "DrawbarOrgan" (one space-
# less name in FluidR3) and extracts as a SINGLE zone rooted at C7 — useless
# for chords (3-4 octaves of down-pitch), so Percussive Organ stands in.
if [ ! -s found/samples/instruments/acoustic_bass/zones.json ]; then
  echo "→ FluidR3_GM_GS.sf2 (blues batch: upright bass + organs)"
  [ -s /tmp/FluidR3_GM_GS.sf2 ] || curl -sL --max-time 900 -o /tmp/FluidR3_GM_GS.sf2 \
    "$IA/fluidr3-gm-gs/FluidR3_GM_GS.sf2"
  for p in "Acoustic Bass" "Percussive Organ" "Rock Organ"; do
    node engine/faust/sf2.js extract /tmp/FluidR3_GM_GS.sf2 "/$p/" found/samples/instruments --max-zones 6
  done
  rm -f /tmp/FluidR3_GM_GS.sf2
fi
# --- FluidR3 FULL GM batch (2026-07 "all of GM please"): all 128 bank-0 melodic ---
# presets in ONE parse (faust/extract-gm.js), so the sampled-default palette draws
# from the whole General MIDI set, not a hand-picked 40. Guarded on a GM-only slug
# (rhodes_ep) absent from the older piecemeal batches below. ~87MB of zone wavs. The
# 24 single-zone presets (SFX, one-note synth pads, DrawbarOrgan) still write but are
# logged THIN — one-shot color only; the role mapping (faust/state-engine.js) draws
# only from the multi-zone pitched instruments.
if [ ! -s found/samples/instruments/rhodes_ep/zones.json ]; then
  echo "→ FluidR3_GM_GS.sf2 (FULL GM: all 128 bank-0 presets)"
  [ -s /tmp/FluidR3_GM_GS.sf2 ] || curl -sL --max-time 900 -o /tmp/FluidR3_GM_GS.sf2 \
    "$IA/fluidr3-gm-gs/FluidR3_GM_GS.sf2"
  node engine/faust/extract-gm.js /tmp/FluidR3_GM_GS.sf2 found/samples/instruments --max-zones 6
  rm -f /tmp/FluidR3_GM_GS.sf2
fi
# --- FluidR3 liberalization batch (2026-07 "use the soundfont liberally"): ---
# 15 more GM presets — the orchestral shelf (trombone/muted trumpet/oboe/cello/
# harp/celesta/french horns), keys (honky-tonk, bright grand, church organ,
# marimba), voices (ahh choir, harmonica, fretless bass, jazz guitar). These
# widen samplerPools across the anchors AND supply the transition micro-lick
# instruments (sovietwave trombone, jazz sax+piano, bossa flute, …).
if [ ! -s found/samples/instruments/trombone/zones.json ]; then
  echo "→ FluidR3_GM_GS.sf2 (liberalization batch: orchestral shelf + keys + voices)"
  [ -s /tmp/FluidR3_GM_GS.sf2 ] || curl -sL --max-time 900 -o /tmp/FluidR3_GM_GS.sf2 \
    "$IA/fluidr3-gm-gs/FluidR3_GM_GS.sf2"
  for p in "Trombone" "Muted Trumpet" "Oboe" "Cello" "Harp" "Celesta" "Ahh Choir" \
           "Fretless Bass" "Harmonica" "Church Organ" "Honky Tonk" "French Horns" \
           "Jazz Guitar" "Bright Yamaha Grand" "Marimba"; do
    node engine/faust/sf2.js extract /tmp/FluidR3_GM_GS.sf2 "/$p/" found/samples/instruments --max-zones 6
  done
  rm -f /tmp/FluidR3_GM_GS.sf2
fi
# --- FluidR3 neoclassical batch (2026-07 deep pass): the FELT PIANO ---
# GM 0 "Yamaha Grand Piano", 10 zones (denser than the usual 6: the lead sits
# EXPOSED, so the midrange keymap keeps repitching under ~6 semitones), then
# made FELT by baking a gentle 3kHz lowpass into the zone wavs (ffmpeg IIR —
# sample counts unchanged, so the SF2 loop points stay valid; verified equal
# duration_ts at extraction). Soft velocity, slow attack and dryness live in
# the neoclassical recipe (genre-kernel.js), not in the samples.
if [ ! -s found/samples/instruments/felt_piano/zones.json ]; then
  echo "→ FluidR3_GM_GS.sf2 (neoclassical batch: felt piano)"
  [ -s /tmp/FluidR3_GM_GS.sf2 ] || curl -sL --max-time 900 -o /tmp/FluidR3_GM_GS.sf2 \
    "$IA/fluidr3-gm-gs/FluidR3_GM_GS.sf2"
  node engine/faust/sf2.js extract /tmp/FluidR3_GM_GS.sf2 "/Yamaha Grand Piano/" found/samples/instruments --max-zones 10
  mkdir -p found/samples/instruments/felt_piano
  for w in found/samples/instruments/yamaha_grand_piano/z*.wav; do
    ffmpeg -y -loglevel error -i "$w" -af "lowpass=f=3000" -c:a pcm_s16le \
      "found/samples/instruments/felt_piano/$(basename "$w")"
  done
  cp found/samples/instruments/yamaha_grand_piano/zones.json found/samples/instruments/felt_piano/zones.json
  rm -rf found/samples/instruments/yamaha_grand_piano   # only the felt variant is consumed
  rm -f /tmp/FluidR3_GM_GS.sf2
fi
# --- FluidR3 30-genre-commission batch (2026-07): draft blockers + history homes ---
# The five DRAFT-BLOCKERS the 30-genre commission needs (lunapolka/holdmusic/
# pigeonstep/crickettempo/chickadeecore run on placeholders today): Accordion
# (GM 21 — spelled "Accordian" in FluidR3), Tuba (58), Pan Flute (75), Kalimba
# (108), Glockenspiel (9). Plus history homes: Harpsichord (6 → prelude Bach
# figuration / neoclassical), Clavinet (7 → newjack/afrobeat/disco funk clav),
# Pizzicato Section (45 → tango marcato / exotica / idm pluck-perc), Fingered
# Bass (33 → citypop/afrobeat/disco fingered ELECTRIC walk), Sitar (104 →
# psytrance/exotica drone), Steel Drums (114 → exotica/tropical tiki).
# GM 14 "Tubular Bells" was REJECTED — same failure as GM 16 DrawbarOrgan:
# FluidR3 ships it as ONE sample rooted at C6 (84.18) split across 5 keyranges
# with NO per-zone root override (all five zone wavs are byte-identical), so a
# chord pitches the single bell 3-4 octaves into mud. Glockenspiel is the
# bright-bell stand-in; the mall/dungeon drafts keep their DX7 "TUB BELLS".
if [ ! -s found/samples/instruments/accordian/zones.json ]; then
  echo "→ FluidR3_GM_GS.sf2 (commission batch: draft blockers + history homes)"
  [ -s /tmp/FluidR3_GM_GS.sf2 ] || curl -sL --max-time 900 -o /tmp/FluidR3_GM_GS.sf2 \
    "$IA/fluidr3-gm-gs/FluidR3_GM_GS.sf2"
  for p in "Accordian" "Tuba" "Pan Flute" "Kalimba" "Glockenspiel" "Harpsichord" \
           "Pizzicato Section" "Clavinet" "Fingered Bass" "Sitar" "Steel Drums"; do
    node engine/faust/sf2.js extract /tmp/FluidR3_GM_GS.sf2 "/$p/" found/samples/instruments --max-zones 6
  done
  rm -f /tmp/FluidR3_GM_GS.sf2
fi
# NOTE: the zone tables are mirrored statically in genre-kernel.js SAMPLERS —
# if you re-extract with different --max-zones, regenerate that table.

# --- SAMPLED DRUM KITS (2026-07 "our drum kits are super basic"): FluidR3 bank
# 128 GM percussion -> per-hit one-shots. ADDITIVE to the Faust synth kicks
# (boom/808/909 …): engine/faust/sf2.js `drumkit` pulls the notes the engine plays
# (kick 36 / snare 38 / hats 42+46 / toms 41,47,50 + rim/clap/crash/ride) at
# natural pitch into found/samples/drums/<slug>/ as mono wavs + kit.json. The
# native sampler (faust/sampler.js) plays each hit; genres opt in via
# drums.kit:"acoustic"|"room"|"power"|"electronic"|"jazz"|"brush" (genre-kernel
# DRUMKITS, which mirrors the `len` values — the committed source, like SAMPLERS;
# the wavs are gitignored/derived). Same MIT FluidR3 font as the instruments.
if [ ! -s found/samples/drums/acoustic/kit.json ]; then
  echo "→ FluidR3_GM_GS.sf2 (drum kits: GM bank-128 percussion)"
  [ -s /tmp/FluidR3_GM_GS.sf2 ] || curl -sL --max-time 900 -o /tmp/FluidR3_GM_GS.sf2 \
    "$IA/fluidr3-gm-gs/FluidR3_GM_GS.sf2"
  mkdir -p found/samples/drums
  node engine/faust/sf2.js drumkit /tmp/FluidR3_GM_GS.sf2 "/Standard/"   found/samples/drums --slug acoustic
  node engine/faust/sf2.js drumkit /tmp/FluidR3_GM_GS.sf2 "/Room/"       found/samples/drums --slug room
  node engine/faust/sf2.js drumkit /tmp/FluidR3_GM_GS.sf2 "/Power/"      found/samples/drums --slug power
  node engine/faust/sf2.js drumkit /tmp/FluidR3_GM_GS.sf2 "/Electronic/" found/samples/drums --slug electronic
  node engine/faust/sf2.js drumkit /tmp/FluidR3_GM_GS.sf2 "/Jazz/"       found/samples/drums --slug jazz
  node engine/faust/sf2.js drumkit /tmp/FluidR3_GM_GS.sf2 "/Brush/"      found/samples/drums --slug brush
  rm -f /tmp/FluidR3_GM_GS.sf2
fi
# NOTE: the per-hit `len` values are mirrored statically in genre-kernel.js
# DRUMKITS — if you re-extract different kits/notes, regenerate that table.

# --- WIDE GM PERCUSSION BANK (2026-07 "a million percussion elements"): the
# rest of FluidR3 bank-128 beyond the kit backbone — hand percussion (congas/
# bongos), latin (timbale/agogo/cowbell/claves/guiro), shakers (shaker/cabasa/
# maracas) and sparkle (tambourine/triangle/woodblock). ONE shared bank of
# natural-pitch one-shots (faust/sf2.js `percbank`) into found/samples/perc/
# standard/<name>.wav + perc.json. Feeds the per-genre PERC LANE (genre-kernel
# PERC_STYLES -> instruments.drums.percSampler). Same MIT FluidR3 font; `len`
# values mirrored in genre-kernel.js PERCBANK (committed source; wavs gitignored).
if [ ! -s found/samples/perc/standard/perc.json ]; then
  echo "→ FluidR3_GM_GS.sf2 (wide GM percussion bank)"
  [ -s /tmp/FluidR3_GM_GS.sf2 ] || curl -sL --max-time 900 -o /tmp/FluidR3_GM_GS.sf2 \
    "$IA/fluidr3-gm-gs/FluidR3_GM_GS.sf2"
  mkdir -p found/samples/perc
  node engine/faust/sf2.js percbank /tmp/FluidR3_GM_GS.sf2 "/Standard/" found/samples/perc --slug standard
  rm -f /tmp/FluidR3_GM_GS.sf2
fi

# --- DX7 factory ROM banks -> faust/dx7-presets.json (provenance recipe) ---
# The decoded presets ARE committed (faust/dx7-presets.json — source, not
# audio), so this block only documents/regenerates. Yamaha ROM1A-4B factory
# cartridges (1983), PD-adjacent and mirrored widely; fetched from
# yamahablackboxes.com (see SOURCES.md). Decode: faust/sysex2params.js.
# Regenerate example:
#   for r in rom1a rom1b rom2a rom2b rom3a rom3b rom4a rom4b; do
#     curl -sL -o /tmp/$r.syx "https://yamahablackboxes.com/patches/dx7/factory/$r.syx"
#   done
#   node engine/faust/sysex2params.js /tmp/rom1a.syx "/E.PIANO 1/" "/BRASS   1/" ...
#   node engine/faust/build.js dx7_algN   # per algorithm the kept patches need

# ===== BEGIN hogcore speech (genre-tool round, 2026-07) ======================
# The hogcore roster: ~24 Harry Potter characters, each read by espeak-ng as
# the FULL PHRASE "<Name> is trans" — THE VOICE (and the phrase) IS THE GENRE.
# Every character name is followed by "is trans": that declaration under every
# bar is the hook. Voices/pitches/speeds vary per character across espeak
# variants (f1-f5, m1-m7, croak, whisper) so the roster sounds like a cast, not
# one robot. Kept bright/full-band (hyperpop, not station PA). Scheduled by the
# kernel as vox lines + a stations-style phrase under the bars.
sayhp() { # name | text | voice | pitch | speed | extra-af
  local out="found/samples/speech/hp_${1}.mp3"
  [ -s "$out" ] && return 0
  echo "→ hogcore $1"
  espeak-ng -v "$3" -p "$4" -s "$5" -w /tmp/sayhp.wav "$2"
  ffmpeg -y -loglevel error -i /tmp/sayhp.wav -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "${6:-anull},loudnorm=I=-14:TP=-1" "$out"
}
#     id          phrase ("<Name> is trans")           voice        pit spd  polish
sayhp harry       "Harry Potter is trans"              en+m3         48 150  "anull"
sayhp hermione    "Hermione Granger is trans"          en+f4         55 170  "anull"
sayhp ron         "Ron Weasley is trans"               en+m2         42 145  "anull"
sayhp dumbledore  "Albus Dumbledore is trans"          en+m7         30 118  "asetrate=44100*0.96,aresample=44100"
sayhp snape       "Severus Snape is trans"             en+m1         18 104  "asetrate=44100*0.93,aresample=44100"
sayhp draco       "Draco Malfoy is trans"              en+m4         58 148  "anull"
sayhp luna        "Luna Lovegood is trans"             en+f2         62 112  "asetrate=44100*1.03,aresample=44100"
sayhp neville     "Neville Longbottom is trans"        en+m6         50 160  "anull"
sayhp mcgonagall  "Minerva McGonagall is trans"        en+f5         46 138  "anull"
sayhp hagrid      "Rubeus Hagrid is trans"             en+croak      22 112  "asetrate=44100*0.92,aresample=44100"
sayhp sirius      "Sirius Black is trans"              en+m5         36 132  "anull"
sayhp bellatrix   "Bellatrix Lestrange is trans"       en+f1         70 178  "anull"
sayhp voldemort   "Voldemort is trans"                 en+whisper    12  92  "asetrate=44100*0.9,aresample=44100"
sayhp ginny       "Ginny Weasley is trans"             en+f3         52 152  "anull"
sayhp cho         "Cho Chang is trans"                 en+f4         60 144  "anull"
sayhp cedric      "Cedric Diggory is trans"            en+m4         44 142  "anull"
sayhp dobby       "Dobby is trans"                     en+m6         78 168  "asetrate=44100*1.12,aresample=44100"
sayhp hedwig      "Hedwig is trans"                    en+f5         74 130  "asetrate=44100*1.08,aresample=44100"
sayhp buckbeak    "Buckbeak is trans"                  en+croak      34 120  "anull"
sayhp peeves      "Peeves is trans"                    en+m3         82 176  "asetrate=44100*1.06,aresample=44100"
sayhp nick        "Nearly Headless Nick is trans"      en+m7         40 126  "anull"
sayhp myrtle      "Moaning Myrtle is trans"            en+f1         66 108  "asetrate=44100*1.02,aresample=44100"
sayhp filch       "Argus Filch is trans"               en+croak      26 118  "anull"
sayhp crookshanks "Crookshanks is trans"               en+f2         56 140  "anull"
# ===== END hogcore speech ====================================================

# ===== BEGIN budstep speech (genre-expansion round, 2026-07) =================
# Budstep's hook: a deadpan synth voice reciting cannabis strain names over the
# amen + SLEEP-guitar wall (mirror of the hogcore block). ONE flat robotic
# narrator (en+m3, low + slow) for all lines so it reads as a single stoned
# announcer, not a cast. Scheduled by the kernel as buried sampleEvents + hits.
saybud() { # id | text | pitch | speed | extra-af
  local out="found/samples/speech/wd_${1}.mp3"
  [ -s "$out" ] && return 0
  echo "→ budstep $1"
  espeak-ng -v en+m3 -p "${3:-28}" -s "${4:-118}" -w /tmp/saybud.wav "$2"
  ffmpeg -y -loglevel error -i /tmp/saybud.wav -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "${5:-asetrate=44100*0.94,aresample=44100},loudnorm=I=-14:TP=-1" "$out"
}
#       id            phrase                        pit spd
saybud bluedream      "Blue Dream"                   28 116
saybud northernlights "Northern Lights"              26 112
saybud purplehaze     "Purple Haze"                  30 114
saybud sourdiesel     "Sour Diesel"                  24 110
saybud whitewidow     "White Widow"                  28 118
saybud granddaddy     "Granddaddy Purple"            22 108
saybud jackherer      "Jack Herer"                   30 116
saybud pineapple      "Pineapple Express"            26 118
saybud mauiwowie      "Maui Wowie"                   32 120
saybud acapulco       "Acapulco Gold"                24 112
saybud durban         "Durban Poison"                28 114
saybud weddingcake    "Wedding Cake"                 30 116
saybud zkittlez       "Zkittlez"                     26 118
saybud indica         "indica"                       20 104
saybud sativa         "sativa"                        34 122
saybud hybrid         "hybrid"                        28 112
# ===== END budstep speech ====================================================

# ===== BEGIN 30-genre commission speech (materials round, 2026-07) ============
# The signature "voice" of ~20 of the 30 new fictional genres is SYNTHESIZED
# speech (espeak-ng, generated locally, GPLv3 output = no license encumbrance —
# same path as the hogcore hp_* cast). Every genre's lines are an original /
# parodic writing (no copyrighted lyrics, no trademarks-as-lyrics); casts vary
# voice/pitch/speed per line so each reads as a cast, not one robot. Institutional
# PA voices ride a telephone-band filter (highpass 300 / lowpass ~3400) exactly
# like the transitwave station PA. Texts live in genre-specs/MATERIALS.md.
sayg() { # id | text | voice | pitch | speed | extra-af | espeak-extra
  local out="found/samples/speech/${1}.mp3"
  [ -s "$out" ] && return 0
  echo "→ commission-speech $1"
  espeak-ng -v "$3" -p "$4" -s "$5" ${7:-} -w /tmp/sayg.wav "$2"
  ffmpeg -y -loglevel error -i /tmp/sayg.wav -codec:a libmp3lame -q:a 2 -ac 1 -ar 44100 \
    -af "${6:-anull},loudnorm=I=-15:TP=-1" "$out"
}
TELB="highpass=f=300,lowpass=f=3400"          # telephone band (institutional PA)
RADB="highpass=f=350,lowpass=f=3000"          # tighter comms/radio band (ATC)

# --- holdmusic: the call that never connects (one soothing corporate contralto, tel band) ---
sayg sp_hold_1 "Your call is important to us. Please continue to hold."                      en-us+f3 60 150 "$TELB"
sayg sp_hold_2 "Thank you for your patience. A representative will be with you shortly."     en-us+f3 58 148 "$TELB"
sayg sp_hold_3 "Did you know you can find answers to most questions on our website?"         en-us+f3 62 152 "$TELB"
sayg sp_hold_4 "You are now caller number twelve in the queue."                             en-us+f3 56 146 "$TELB"

# --- termswave: the drone of consent (flat monotone legalese, -a120 to flatten dynamics) ---
sayg sp_eula_1 "By pressing play you agree to be bound by these terms, which may be updated at any time without notice." en+m2 35 170 "anull" "-a120"
sayg sp_eula_2 "You waive the right to a jury trial and agree to binding arbitration in a venue of our choosing."        en+m2 35 172 "anull" "-a120"
sayg sp_eula_3 "We may collect, retain, and share your listening data with our partners, and their partners."           en+m2 34 168 "anull" "-a120"

# --- dmvstep: now serving B-47 (dead PA baritone, tel band; last two are bare numbers) ---
sayg sp_dmv_1 "Now serving number B forty seven, at window four."          en+m4 40 150 "$TELB"
sayg sp_dmv_2 "Ticket A twelve, please proceed to counter two."            en+m4 42 148 "$TELB"
sayg sp_dmv_3 "Now serving. C ninety."                                     en+m4 38 146 "$TELB"
sayg sp_dmv_4 "Please have your paperwork ready."                          en+m4 40 150 "$TELB"
sayg sp_dmv_5 "forty seven"                                                en+m4 41 150 "$TELB"
sayg sp_dmv_6 "ninety"                                                     en+m4 39 150 "$TELB"

# --- elevatorcore: going up (bright department-store hostess, full band) ---
sayg sp_floor_1 "Going up. Third floor: ladies' outerwear."                en-us+f2 65 160 "anull"
sayg sp_floor_2 "Second floor: housewares and gifts."                      en-us+f2 66 158 "anull"
sayg sp_floor_3 "Doors closing."                                           en-us+f2 64 162 "anull"
sayg sp_floor_4 "Fifth floor: fine china, and the observation deck."       en-us+f2 67 160 "anull"
sayg sp_floor_5 "Going down. Lobby level, and the parking garage."         en-us+f2 63 158 "anull"
sayg sp_floor_6 "Please watch your step."                                  en-us+f2 66 164 "anull"

# --- surveywave: on a scale of one to ten (peppy IVR) ---
sayg sp_survey_1 "On a scale of one to ten, how likely are you to recommend us?" en-us+f4 70 175 "anull"
sayg sp_survey_2 "Press one to continue in English."                            en-us+f4 72 178 "anull"
sayg sp_survey_3 "Your feedback helps us serve you better."                     en-us+f4 71 174 "anull"
sayg sp_survey_4 "Please stay on the line, for a brief survey."                 en-us+f4 69 176 "anull"

# --- dishwasherwave: cycle complete ---
sayg sp_dw_done "Cycle complete."                                          en+f1 40 140 "anull"

# --- thermostatwave: who touched the thermostat (clipped, passive-aggressive) ---
sayg sp_therm_1 "It's fine. I'm fine."                                     en+m1 42 150 "anull"
sayg sp_therm_2 "I set it to sixty eight, for a reason."                   en+m1 40 148 "anull"
sayg sp_therm_3 "Someone has been touching the thermostat."               en+m1 38 146 "anull"

# --- microwave: grace before microwave (reverent, slow) ---
sayg sp_grace_1 "For this reheated bounty, and the leftovers of Tuesday, we give humble thanks." en+m3 45 120 "asetrate=44100*0.97,aresample=44100"
sayg sp_grace_2 "Ninety seconds, on high. Amen."                          en+m3 44 118 "asetrate=44100*0.97,aresample=44100"

# --- ikeacore: some parts left over (mock-Nordic; product names in the Swedish voice) ---
sayg sp_flatpack_1 "Björkenhölm."                                         sv       50 140 "anull"
sayg sp_flatpack_2 "Insert cam lock D, into panel A."                     en+m5 50 150 "anull"
sayg sp_flatpack_3 "Step six, of six."                                    en+m5 52 148 "anull"
sayg sp_flatpack_4 "You will need a person you trust."                    en+m5 48 146 "anull"
sayg sp_flatpack_5 "Smörgabylla. Some parts may be left over."            sv       50 138 "anull"

# --- laundrycore: do not overload ---
sayg sp_laundry_1 "Tumble dry low."                                       en+f3 46 150 "anull"
sayg sp_laundry_2 "Do not overload the drum."                             en+f3 44 148 "anull"

# --- cerealwave: part of a complete breakfast (hyper cartoon mascot; original, no real slogans) ---
sayg sp_cereal_1 "They're great, and legally distinct!"                   en-us+f5 80 185 "anull"
sayg sp_cereal_2 "Part of this complete breakfast."                       en-us+f5 82 188 "anull"
sayg sp_cereal_3 "Now, with more crunch!"                                 en-us+f5 84 190 "anull"

# --- hotsaucecore: the Scoville escalation ---
sayg sp_scoville_1 "Jalapeño. Eight thousand Scoville."                   en+m4 45 160 "anull"
sayg sp_scoville_2 "Habanero. Two hundred thousand."                      en+m4 44 162 "anull"
sayg sp_scoville_3 "Ghost pepper. One million."                           en+m4 42 158 "anull"
sayg sp_scoville_4 "Are you sure?"                                        en+m4 40 150 "anull"
sayg sp_scoville_5 "Carolina Reaper. Two point two million."             en+m4 38 156 "anull"

# --- airtrafficdrone: cleared to land (unflappable controller cadence, radio band) ---
sayg sp_atc_1 "Speedbird two seven heavy, cleared to land runway two seven left, wind two four zero at eight." en+m2 40 160 "$RADB"
sayg sp_atc_2 "Contact ground, point niner."                             en+m2 41 158 "$RADB"
sayg sp_atc_3 "Hold at the outer marker."                               en+m2 39 156 "$RADB"
sayg sp_atc_4 "Squawk seven thousand."                                  en+m2 42 160 "$RADB"
sayg sp_atc_5 "Report established on the localizer."                    en+m2 40 158 "$RADB"

# --- auctioncore: the espeak-can-auctioneer joke (max speed forces the chant) ---
sayg sp_auction_1 "do I hear thirty, thirty, thirty five, now forty, forty, who'll give me forty" en+m6 55 280 "anull"
sayg sp_auction_2 "SOLD, to the raver in the back."                      en+m6 55 200 "anull"
sayg sp_auction_3 "twenty two and a half, do I hear twenty five, twenty five, now thirty"          en+m6 55 280 "anull"

# --- umpirehouse: STEE-RIKE THREE (gruff bark) ---
sayg sp_ump_1 "STEE RIKE THREE, you're OUT!"                             en+m7 35 150 "anull"
sayg sp_ump_2 "SAFE!"                                                    en+m7 34 148 "anull"
sayg sp_ump_3 "Ball four, take your base."                              en+m7 36 152 "anull"
sayg sp_ump_4 "Play ball!"                                              en+m7 33 150 "anull"

# --- towncrier: OYEZ, then the drop (booming proclamation, -a180) ---
sayg sp_crier_1 "OYEZ, OYEZ! Hear ye, hear ye!"                          en-gb-x-rp+m3 30 130 "anull" "-a180"
sayg sp_crier_2 "Be it known throughout the realm."                     en-gb-x-rp+m3 30 128 "anull" "-a180"
sayg sp_crier_3 "God save the bass!"                                    en-gb-x-rp+m3 30 126 "anull" "-a180"

# --- zubrovia: the anthem of a nation that isn't (INVENTED pseudo-Slavic syllables,
#     three voices at slow speed = a massed choir feel; original — no real language) ---
sayg sp_zubrovia_1 "Zubróvya, Zubróvya, ho zna vímu tra la!"             en+m1 34 112 "anull"
sayg sp_zubrovia_2 "Zubróvya, Zubróvya, ho zna vímu tra la!"             en+m5 40 110 "anull"
sayg sp_zubrovia_3 "Volo dobra, tra la, Zubróvya svo boda!"             en+f2 52 108 "anull"

# --- lunapolka: oom-pah at one-sixth gravity (a toast, floated) ---
sayg sp_luna_1 "To the colony! To the dome!"                            en+m4 46 140 "aecho=0.8:0.5:60:0.35"
sayg sp_luna_2 "To not going outside, without a suit!"                  en+m4 44 138 "aecho=0.8:0.5:60:0.35"

# --- floppycore: do not remove the disk (retro machine voice) ---
sayg sp_floppy_save "Saving document. Do not remove the disk."          en+m3 38 140 "asetrate=44100*0.94,aresample=44100"

# --- faxbossa: no carrier ---
sayg sp_fax_nocarrier "No carrier."                                     en+m2 40 150 "anull"
# ===== END 30-genre commission speech ========================================

# ===== BEGIN 30-genre commission tones (materials round, 2026-07) =============
# Deterministic, license-free one-shots synthesized with ffmpeg lavfi — no
# recording, no attribution needed. DTMF touch-tones, the microwave beep, the
# kitchen-timer / gavel / handbell dings. Same technique as the transit door_ding
# above. Into found/samples/hits/ (kind:"hit"). Frequencies are the real specs
# (DTMF dyads; bell partials) so they read authentic while being pure synthesis.
tone() { # id | aevalsrc-expr | dur
  local out="found/samples/hits/${1}.wav"
  [ -s "$out" ] && return 0
  echo "→ tone $1"
  ffmpeg -y -loglevel error -f lavfi -i "aevalsrc='${2}':d=${3}:s=44100" \
    -ac 1 -ar 44100 -af "loudnorm=I=-16:TP=-1.5" "$out"
}
# DTMF touch-tones: the standard low+high dyads, ~130ms with a short fade so they
# don't click. rows 697/770/852 Hz × cols 1209/1336/1477 Hz = keys 1-9.
dtmf() { # id | low | high
  tone "$1" "(0.5*sin(2*PI*${2}*t)+0.5*sin(2*PI*${3}*t))*min(1\,min(t*60\,(0.13-t)*60))*gt(0.13-t\,0)" 0.14
}
dtmf dtmf_1 697 1209
dtmf dtmf_2 697 1336
dtmf dtmf_3 697 1477
dtmf dtmf_4 770 1209
dtmf dtmf_5 770 1336
dtmf dtmf_6 770 1477
dtmf dtmf_7 852 1209
dtmf dtmf_8 852 1336
dtmf dtmf_9 852 1477
# microwave "beep beep beep": three 2.05kHz square blips (0.12s on / 0.10s off)
tone mw_beep "(2*gt(sin(2*PI*2050*t)\,0)-1)*0.5*lt(mod(t\,0.22)\,0.12)" 0.66
# kitchen-timer ding: a single ~2.6kHz bell with a slow exp decay
tone timer_ding "exp(-t*4.5)*(0.6*sin(2*PI*2637*t)+0.25*sin(2*PI*5274*t)+0.1*sin(2*PI*7911*t))" 1.1
# gavel: a hard wood-block "tock" — two fast-decaying partials
tone gavel "exp(-t*42)*(0.7*sin(2*PI*900*t)+0.3*sin(2*PI*2400*t))" 0.2
# handbell: an inharmonic metal bell, ~1.5s ring (fundamental ~1.2kHz + partials)
tone handbell "exp(-t*3.0)*(0.5*sin(2*PI*1200*t)+0.3*sin(2*PI*3000*t)+0.15*sin(2*PI*4700*t)+0.1*sin(2*PI*5400*t))" 1.6
# degauss: the CRT "boinnng" — a resonant thump sweeping down ~130→45 Hz with a wobble
tone degauss "exp(-t*3.5)*sin(2*PI*(45+85*exp(-t*6))*t)*(1+0.3*sin(2*PI*7*t))*0.9" 1.3
# ikeacore foley (SYNTHESIZED APPROXIMATIONS — flagged: no honest PD archive.org
# cam-lock/allen-key recording found, so these are filtered transients, not foley):
# cam_click: a hard cam-lock "tick" (two fast-decaying partials)
tone cam_click "exp(-t*80)*(0.7*sin(2*PI*2200*t)+0.3*sin(2*PI*5200*t))" 0.09
# allen_key: an allen-key ratchet — four quick clicks over ~0.24s
tone allen_key "exp(-mod(t\,0.06)*95)*(0.6*sin(2*PI*1500*mod(t\,0.06))+0.25*sin(2*PI*3300*mod(t\,0.06)))*lt(t\,0.24)" 0.26
# ===== END 30-genre commission tones =========================================

# --- manifest: duration + crude class for every sample ---
python3 - <<'PYEOF'
import json, os, subprocess
root = "found/samples"
out = []
for sub, cls in (("breaks","break"),("hits","hit"),("vox","vox"),("speech","speech"),("78s","seventy8")):
    d = os.path.join(root, sub)
    for f in sorted(os.listdir(d)):
        # speech ships as MP3 (HOSTING.md §3: no slice-timed metadata, safe to
        # compress); breaks/hits/vox/78s stay WAV (slice/sample alignment)
        if not f.endswith((".wav", ".mp3")): continue
        p = os.path.join(d, f)
        dur = float(subprocess.run(["ffprobe","-v","error","-show_entries",
            "format=duration","-of","csv=p=0",p],capture_output=True,text=True).stdout or 0)
        e = {"file": sub+"/"+f, "class": cls, "dur": round(dur,3)}
        if cls=="break" and "_" in f:                       # amen_175_01.wav
            try: e["bpm"] = int(f.split("_")[1])
            except ValueError: pass
        out.append(e)
json.dump(out, open(os.path.join(root,"manifest.json"),"w"), indent=1)
print(f"manifest: {len(out)} samples")
PYEOF
echo "Done."
