#!/usr/bin/env bash
# fetch-hits-expansion.sh — THE REPERTOIRE PROGRAM's hits + breaks wave
# (docs/history/NEXT.md 5f). The census proved the one-shot vocabulary is
# four samples deep (vox_a in 55 genres, tw_ding in 32, four amens carrying 79
# break slots); this recipe fetches the EXPANSION that fills the SOURCE_POOLS
# classes (vocal_stab / chime / horn_stab / rave_stab / perc_hit + the
# bpm-banded break pools) from VERIFIED-license sources only:
#
#   1. drumloops113 (archive.org) — CC BY 2.5, author-made ("13 drum loops I
#      made by recording and choping live drumming...", uploader = author) —
#      12 live/machine funk breaks, 82-140 bpm (bpm measured once with
#      tools/classify-sample-cd.py and pinned here, the amen-filename law).
#   2. VCSL (github.com/sgossner/VCSL) — CC0-1.0 (verified via the GitHub
#      license API + LICENSE in repo) — chimes (tubular bells / hand chime /
#      glockenspiel) and orchestral percussion one-shots (timpani, gong,
#      anvil, woodblock, slapstick, agogo, cowbell).
#   3. George Blood 78rpm digitizations (archive.org) — recordings PUBLISHED
#      BEFORE 1923, US public domain by age (Music Modernization Act; each
#      item's `date` metadata verified pre-1923): military-band brass tuttis
#      as horn stabs, Caruso's Tosca climax + a 1920 laughing record as vocal
#      stabs. Cut at the LOUDEST 2.5-3s window (deterministic numpy scan).
#   4. Apollo11Audio (archive.org) — NASA radio traffic, public domain —
#      three more capcom one-liners for the vocal_stab pool (fixed offsets,
#      the fetch-found-samples.sh apollo() precedent).
#   5. SYNTHESIZED rave stabs — license-free ffmpeg aevalsrc (the tw_ding /
#      timer_ding / gavel precedent): two hoovers + two chord stabs.
#
# Audio lands gitignored under found/samples/; THIS recipe + the SAMPLES
# registry entries + the SOURCES.md ledger rows are the committed deliverable.
# Idempotent: every output is skipped if it already exists.
# Requires: curl, ffmpeg, ffprobe, python3 (numpy).
set -euo pipefail
cd "$(dirname "$0")/.."

IA="https://archive.org/download"
VCSL="https://raw.githubusercontent.com/sgossner/VCSL/master"
mkdir -p found/samples/breaks found/samples/hits found/samples/vox found/samples/78s

# urlencode helper (spaces etc. in VCSL paths / 78 filenames)
enc(){ python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"; }

# ---------- 1. drumloops113 — CC BY 2.5 live funk/machine breaks ----------
# bpm measured once with tools/classify-sample-cd.py (onset autocorrelation)
# and pinned here; track 005 (ambiguous class/bpm) is deliberately skipped.
# 013 is a 32s jam at 120 — we keep the first 4 bars (8s).
dl113(){ # srcname | bpm | outname | [trim-secs]
  local out="found/samples/breaks/$3"
  [ -s "$out" ] && return 0
  echo "→ break $3 (${2}bpm, drumloops113)"
  curl -sL --max-time 120 -o /tmp/dl113.wav "$IA/drumloops113/$1"
  local trim=(); [ -n "${4:-}" ] && trim=(-t "$4")
  ffmpeg -y -loglevel error "${trim[@]}" -i /tmp/dl113.wav -ac 1 -ar 44100 \
    -af "loudnorm=I=-16:TP=-1" "$out"
}
dl113 001.wav  99 dl_99_01.wav
dl113 002.wav 126 dl_126_02.wav
dl113 003.wav  99 dl_99_03.wav
dl113 004.wav 101 dl_101_04.wav
dl113 006.wav 140 dl_140_06.wav
dl113 007.wav 140 dl_140_07.wav
dl113 008.wav  89 dl_89_08.wav
dl113 009.wav  89 dl_89_09.wav
dl113 010.wav  82 dl_82_10.wav
dl113 011.wav 133 dl_133_11.wav
dl113 012.wav  89 dl_89_12.wav
dl113 013.wav 120 dl_120_13.wav 8

# ---------- 2. VCSL (CC0) — chimes + orchestral percussion one-shots ----------
vcsl(){ # repo-path | outname | max-secs (fade the long ringers down)
  local out="found/samples/hits/$2"
  [ -s "$out" ] && return 0
  echo "→ hit $2 (VCSL)"
  curl -sL --max-time 180 -o /tmp/vcsl.wav "$VCSL/$(enc "$1")"
  local d="$3"
  ffmpeg -y -loglevel error -t "$d" -i /tmp/vcsl.wav -ac 1 -ar 44100 \
    -af "afade=t=out:st=$(python3 -c "print(max(0.1,$d-0.6))"):d=0.6,loudnorm=I=-16:TP=-1" "$out"
}
# chime class
vcsl "Idiophones/Struck Idiophones/Tubular Bells 1/chimes_C4_ff_rr2.wav" chime_tub_hi.wav 6
vcsl "Idiophones/Struck Idiophones/Tubular Bells 1/chimes_E3_ff_rr2.wav" chime_tub_lo.wav 6
vcsl "Idiophones/Struck Idiophones/Hand Chimes/sus_A4_r01_main.wav"      chime_hand.wav   5
vcsl "Idiophones/Struck Idiophones/Glockenspiel/glock_loud_C6_01.wav"    chime_glock.wav  4
# perc_hit class
vcsl "Membranophones/Struck Membranophones/Timpani 1/Hit/Timpani1_Hit_v3_rr3_Sum.wav" perc_timpani.wav 4
vcsl "Idiophones/Struck Idiophones/Gong 1/gong_f.wav"                    perc_gong.wav    6
vcsl "Idiophones/Struck Idiophones/Anvil/Anvil_Hit1_v1_rr1_Mid.wav"      perc_anvil.wav   3
vcsl "Idiophones/Struck Idiophones/Woodblock/wood_click_ff.wav"          perc_wood.wav    2
vcsl "Idiophones/Struck Idiophones/Slapstick/slapstick_rr1.wav"          perc_slap.wav    2
vcsl "Idiophones/Struck Idiophones/Agogo Bells/Agogo_High_v1_rr1_Mid.wav" perc_agogo.wav  2
vcsl "Idiophones/Struck Idiophones/Cowbells/Cowbell1_Hit_v2_rr1_Mid.wav" perc_cowbell.wav 2

# ---------- 3. pre-1923 78s (PD by age) — horn + vocal stabs ----------
# Cut at the LOUDEST window: decode to mono f32, numpy-scan RMS over a sliding
# window, cut there. Deterministic given the source file (no taste, no rng).
loudcut(){ # item | filename | window-secs | outpath | band ("music"|"voice")
  local out="$4"
  [ -s "$out" ] && return 0
  echo "→ 78rpm $(basename "$out") (loudest ${3}s window, $1)"
  curl -sL --max-time 240 -o /tmp/seventy8.mp3 "$IA/$1/$(enc "$2")"
  local ss
  ss=$(python3 - "$3" <<'PYEOF'
import subprocess, sys, numpy as np
win = float(sys.argv[1]); sr = 8000
raw = subprocess.run(["ffmpeg","-v","error","-i","/tmp/seventy8.mp3","-ac","1","-ar",str(sr),
  "-f","f32le","-"], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
if len(x) < sr*win: print(0.0); sys.exit()
# skip the first/last 5s (needle drop / runout groove)
guard = 5*sr
e = np.convolve(x[guard:len(x)-guard]**2, np.ones(int(sr*win))/int(sr*win), mode="valid")
print(round((guard + int(np.argmax(e)))/sr, 2))
PYEOF
)
  local af="highpass=f=180,lowpass=f=6500,loudnorm=I=-16:TP=-1"
  [ "$5" = "voice" ] && af="highpass=f=250,lowpass=f=5000,loudnorm=I=-15:TP=-1"
  ffmpeg -y -loglevel error -ss "$ss" -t "$3" -i /tmp/seventy8.mp3 -ac 1 -ar 44100 \
    -af "$af,afade=t=out:st=$(python3 -c "print($3-0.35)"):d=0.35" "$out"
}
# horn_stab: military-band tuttis (National Emblem 1922, Liberty Loan/Sousa 1918)
loudcut 78_national-emblem_manhattan-military-band-e-e-bagley_gbia0426619a \
  "NATIONAL EMBLEM - MANHATTAN MILITARY BAND.mp3" 3.0 found/samples/78s/horns_ne_78.wav music
loudcut 78_liberty-loan-march_paramount-military-band-sousa_gbia0440191a \
  "Liberty Loan March - Paramount Military Band.mp3" 3.0 found/samples/78s/horns_ll_78.wav music
# vocal_stab: Caruso's Tosca climax (1909) + a 1920 laughing record
loudcut 78_tosca---e-lucevan-le-stelle-the-stars-were-shining_enrico-caruso-puccini-victor-o_gbia0012566a \
  "Tosca - E lucevan le stelle (The Stars Wer - Enrico Caruso.mp3" 2.8 found/samples/78s/caruso_78.wav voice
loudcut 78_some-laughs_gbia0395185a \
  "Some Laughs.mp3" 2.5 found/samples/78s/laughs_78.wav voice

# ---------- 4. Apollo 11 (NASA, PD) — three more capcom one-liners ----------
apollo(){ # tape | start | dur | name
  local out="found/samples/vox/$4.wav"
  [ -s "$out" ] && return 0
  echo "→ vox $4"
  curl -sL --max-time 180 -o /tmp/apollo.mp3 "$IA/Apollo11Audio/$1"
  ffmpeg -y -loglevel error -ss "$2" -t "$3" -i /tmp/apollo.mp3 -ac 1 -ar 44100 \
    -af "highpass=f=250,lowpass=f=3400,loudnorm=I=-15:TP=-1" "$out"
}
apollo 11-03302.mp3 30 3.0 apollo_d
apollo 11-03306.mp3 50 2.6 apollo_e
apollo 11-03308.mp3 45 3.0 apollo_f

# ---------- 5. synthesized rave stabs (license-free, the tw_ding precedent) ----------
# hoover: detuned saw stack with a fast downward pitch envelope; stabs: chord
# one-shots (organ-ish square stack / saw chord). saw(f,t) = 2*mod(t*f,1)-1.
stab(){ # name | aevalsrc-expr | dur
  local out="found/samples/hits/$1.wav"
  [ -s "$out" ] && return 0
  echo "→ hit $1 (synthesized)"
  ffmpeg -y -loglevel error -f lavfi -i "aevalsrc='$2':d=$3:s=44100" -ac 1 -ar 44100 \
    -af "lowpass=f=7000,loudnorm=I=-15:TP=-1.5" "$out"
}
# hoover_a: A2 cluster, pitch falls in ~120ms (the classic mentasm drop-in)
stab hoover_a "exp(-t*2.2)*(1/5)*( (2*mod(t*110*(1+0.6*exp(-t*9))*0.993,1)-1) + (2*mod(t*110*(1+0.6*exp(-t*9)),1)-1) + (2*mod(t*110*(1+0.6*exp(-t*9))*1.007,1)-1) + 0.7*(2*mod(t*220*(1+0.6*exp(-t*9))*1.004,1)-1) + 0.7*(2*mod(t*220*(1+0.6*exp(-t*9))*0.996,1)-1) )" 1.4
# hoover_b: E3, faster + brighter
stab hoover_b "exp(-t*3.0)*(1/5)*( (2*mod(t*165*(1+0.5*exp(-t*12))*0.992,1)-1) + (2*mod(t*165*(1+0.5*exp(-t*12)),1)-1) + (2*mod(t*165*(1+0.5*exp(-t*12))*1.008,1)-1) + 0.7*(2*mod(t*330*(1+0.5*exp(-t*12))*1.005,1)-1) + 0.7*(2*mod(t*330*(1+0.5*exp(-t*12))*0.995,1)-1) )" 1.1
# stab_organ: M1-ish minor organ chord (A3+C4+E4, square-ish), fast decay
stab stab_organ "exp(-t*6)*(1/3)*( (2*gt(sin(2*PI*220*t),0)-1)*0.8 + (2*gt(sin(2*PI*261.63*t),0)-1)*0.7 + (2*gt(sin(2*PI*329.63*t),0)-1)*0.7 + 0.3*sin(2*PI*440*t) )" 0.9
# stab_saw: sus4 saw chord (A2+D3+E3), the piano-house/hard-trance stab shape
stab stab_saw "exp(-t*4.5)*(1/3)*( (2*mod(t*110,1)-1) + (2*mod(t*146.83,1)-1) + (2*mod(t*164.81,1)-1) + 0.5*(2*mod(t*220*1.003,1)-1) )" 1.0

echo "Done. New hits + breaks in found/samples/ (gitignored)."
echo "Registry: engine/genre-kernel.js SAMPLES ('repertoire wave 3' block);"
echo "pools: SOURCE_POOLS vocal_stab/chime/horn_stab/rave_stab/perc_hit + break bands."
