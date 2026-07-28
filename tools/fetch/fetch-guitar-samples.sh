#!/usr/bin/env bash
# Fetch + extract the INSTRUMENT-LIBRARY UPGRADE, wave 1: real
# crunch for the guitars, real breath for the tenor sax, a living-room upright
# for the intimate-piano genres, and palm-mute power-chord one-shots. Samples
# are NOT committed (gitignored); this recipe IS. Licenses verified at source —
# see SOURCES.md ("Sampled instruments", "Power-chord one-shots").
#
#   tools/fetch/fetch-guitar-samples.sh
#
# Sources (each archive ships its own license text):
#   FreePats FSBS Electric Guitar (CC0 1.0)  -> crunch_guitar (dist #2, re-amped)
#                                            -> di_guitar     (direct/DI, raw pickup
#                                               signal meant for the engine's staged
#                                               insert_higain amp; ~-27dB RMS raw BY
#                                               DESIGN — only claim it behind higain)
#   FreePats Tenor Saxophone      (CC0 1.0)  -> tenor_sax_fp (RENAMED dir — deploy immutability law; the id tenor_sax points here) (8 zones, ALL
#                                               with infinite sustain loops; VCSL
#                                               samples re-edited by roberto@zenvoid.org)
#   FreePats Upright Piano KW     (CC0 1.0)  -> upright_piano (Kawai upright in a
#                                               living room; bass-note loops)
#   Ax_Grinder power chords    (CC BY 3.0)   -> found/samples/hits/pc_*.wav
#                                               (freesound pack 14939, HQ previews are
#                                               keylessly fetchable; ATTRIBUTION REQUIRED
#                                               in any distributed render — SOURCES.md)
#
# Idempotent: archives are cached in $GUITAR_CACHE (sha256-checked), each output
# dir is guarded on a file unique to the NEW extraction. The 10-33s FSBS guitar
# zones are trimmed to 8s + 0.5s fade (precache weight; a solo note never needs
# 33s) and zones.json lens are rewritten to match.
# Requires: curl, ffmpeg, node (engine/faust deps), python3, and `7z` OR the
# python3 py7zr module for the FreePats .7z archives.
set -euo pipefail
cd "$(dirname "$0")/../.."
CACHE="${GUITAR_CACHE:-/tmp/stellate-instrument-upgrade}"
mkdir -p "$CACHE" found/samples/instruments found/samples/hits

FP="https://freepats.zenvoid.org"

sha_ok() { echo "$2  $1" | sha256sum --check --quiet - 2>/dev/null; }
fetch() { # file | sha256 | url
  local out="$CACHE/$1"
  if [ -s "$out" ] && sha_ok "$out" "$2"; then return 0; fi
  echo "→ fetch $1"
  curl -sL --max-time 1800 -o "$out" "$3"
  sha_ok "$out" "$2" || { echo "FAIL: checksum mismatch on $1" >&2; exit 1; }
}
un7z() { # archive | destdir
  rm -rf "$2" && mkdir -p "$2"
  if command -v 7z >/dev/null 2>&1; then 7z x -y -o"$2" "$1" >/dev/null
  elif python3 -c "import py7zr" 2>/dev/null; then
    python3 -c "import py7zr,sys; py7zr.SevenZipFile(sys.argv[1]).extractall(sys.argv[2])" "$1" "$2"
  else
    echo "FAIL: need '7z' or python3 py7zr to extract $1 (apt install p7zip-full, or pip install py7zr in a venv)" >&2
    exit 1
  fi
}
extract_sf2() { # sf2-path | extract-gm slug | target instrument id | max-zones
  local tmp="$CACHE/extract_$3"
  rm -rf "$tmp" && mkdir -p "$tmp"
  node engine/faust/build/extract-gm.js "$1" "$tmp" --max-zones "$4"
  rm -rf "found/samples/instruments/$3"
  mv "$tmp/$2" "found/samples/instruments/$3"
  rm -rf "$tmp"
}
# trim unlooped zones to 8s + 0.5s fade-out and rewrite zones.json len fields
# (the FSBS guitars decay naturally for 10-33s; the tail past ~8s is precache
# weight no scheduled note reaches). Looped zones are never touched.
trim_zones() { # instrument id | max seconds before the fade
  python3 - "found/samples/instruments/$1" "$2" <<'PYEOF'
import json, os, subprocess, sys
d, cap = sys.argv[1], float(sys.argv[2])
meta = json.load(open(os.path.join(d, "zones.json")))
sr = meta["sr"]; cut = int((cap + 0.5) * sr)
for z in meta["zones"]:
    if z.get("loop") or z["len"] <= cut: continue
    p = os.path.join(d, z["file"])
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",p,"-t",str(cap+0.5),
        "-af",f"afade=t=out:st={cap}:d=0.5","-c:a","pcm_s16le","-ar",str(sr),"-ac","1",p+".tmp.wav"],check=True)
    os.replace(p+".tmp.wav", p)
    z["len"] = cut
    z["loopEnd"] = min(z["loopEnd"], cut)
json.dump(meta, open(os.path.join(d, "zones.json"), "w"), indent=1)
print(f"  trimmed {d} to <= {cap}s+fade")
PYEOF
}

# --- tenor_sax REPLACEMENT: FreePats Tenor Saxophone (CC0, looped) -----------
# Replaces the 6-zone FluidR3 GM extract IN PLACE (same id — every anchor that
# names tenor_sax picks it up). Guard: z07_r88.wav exists only in the FreePats set.
if [ ! -s found/samples/instruments/tenor_sax_fp/z07_r88.wav ]; then
  echo "→ FreePats Tenor Saxophone -> tenor_sax_fp (renamed dir; id tenor_sax)"
  fetch TenorSaxophone-SF2-20200717.tar.bz2 \
    f7640cf2039662b15b4521bb5615e1ddc426731559b4c31079cb5e9f50e16fa0 \
    "$FP/Reed/TenorSaxophone/TenorSaxophone-SF2-20200717.tar.bz2"
  rm -rf "$CACHE/tenorsax" && mkdir -p "$CACHE/tenorsax"
  tar xjf "$CACHE/TenorSaxophone-SF2-20200717.tar.bz2" -C "$CACHE/tenorsax"
  extract_sf2 "$CACHE"/tenorsax/*/TenorSaxophone-20200717.sf2 tenor_saxophone tenor_sax_fp 8
fi

# --- crunch_guitar: FSBS Distorted #2 (CC0, re-amped Fender, 10-33s sustains) -
if [ ! -s found/samples/instruments/crunch_guitar/zones.json ]; then
  echo "→ FreePats FSBS Distorted #2 -> crunch_guitar"
  fetch EGuitarFSBS-bridge-dist2-SF2-20220911.7z \
    bbde6f1df30f33bede2017d8bff7b1650e583143b8aca620cce2273d3e602d32 \
    "$FP/ElectricGuitar/FSBS-EGuitar/EGuitarFSBS-bridge-dist2-SF2-20220911.7z"
  un7z "$CACHE/EGuitarFSBS-bridge-dist2-SF2-20220911.7z" "$CACHE/dist2"
  extract_sf2 "$CACHE"/dist2/*/EGuitarFSBS-bridge-dist2-20220911.sf2 eguitar_bridge_dist crunch_guitar 8
  trim_zones crunch_guitar 8
fi

# --- di_guitar: FSBS Direct/DI (CC0, raw pickup -> the engine's higain amp) ---
if [ ! -s found/samples/instruments/di_guitar/zones.json ]; then
  echo "→ FreePats FSBS Direct (DI) -> di_guitar"
  fetch EGuitarFSBS-bridge-direct-SF2-20220911.7z \
    69020e105bf72be95a6e1b81ff4553727fb12bc8f03f0ec3cb17d4cbeaed0961 \
    "$FP/ElectricGuitar/FSBS-EGuitar/EGuitarFSBS-bridge-direct-SF2-20220911.7z"
  un7z "$CACHE/EGuitarFSBS-bridge-direct-SF2-20220911.7z" "$CACHE/direct"
  extract_sf2 "$CACHE"/direct/*/EGuitarFSBS-bridge-direct-20220911.sf2 eguitar_bridge_dir di_guitar 8
  trim_zones di_guitar 8
fi

# --- upright_piano: FreePats Upright Piano KW (CC0, Kawai upright, bass loops) -
# A NEW id (the GM grand stays; this is the intimate/domestic piano voice).
if [ ! -s found/samples/instruments/upright_piano/zones.json ]; then
  echo "→ FreePats Upright Piano KW -> upright_piano"
  fetch UprightPianoKW-SF2-20220221.7z \
    17c084c6e4205233dc49b34e4bc44a9b2d7c7a2c02b04729ecda77079b07c826 \
    "$FP/Piano/UprightPianoKW/UprightPianoKW-SF2-20220221.7z"
  un7z "$CACHE/UprightPianoKW-SF2-20220221.7z" "$CACHE/upkw"
  extract_sf2 "$CACHE"/upkw/*/UprightPianoKW-20220221.sf2 upright_piano_kw upright_piano 10
fi

# --- power-chord one-shots: Ax_Grinder pack 14939 (CC BY 3.0 — ATTRIBUTION) ---
# Drop-D power chords (Jackson Warrior -> Line6 POD XT), open ~10s + palm-muted
# chunks. The HQ preview MP3s are publicly fetchable at stable URLs (originals
# need a freesound login); 128kbps is fine for one-shot chugs under a mix.
# Registered in genre-kernel SAMPLES as pc_* (kind:"hit", note = measured root).
FS="https://cdn.freesound.org/previews/242"
pchord() { # freesound id | sha256 | out name
  local out="found/samples/hits/pc_$3.wav"
  [ -s "$out" ] && return 0
  echo "→ power chord pc_$3 (freesound $1)"
  fetch "axgrinder_$1.mp3" "$2" "$FS/${1}_4419064-hq.mp3"
  ffmpeg -y -loglevel error -i "$CACHE/axgrinder_$1.mp3" -ac 1 -ar 44100 \
    -af "loudnorm=I=-16:TP=-1" "$out"
}
#      freesound-id  sha256                                                            name (measured: D#2/A#2 roots)
pchord 242799 86c76cb0707dce3a1e09f7e10ff111fad46dc89455b58c4a060cf69d5f798c2a ds2_open
pchord 242800 fe5ace4a7b763f8642b7fef626c4b2016c8bc91e2cd7e095411a2a446f810479 ds2_pm
pchord 242801 dc58a36ae8e24449511e3653ee102d1e9d3379005808ffd9d41f65d4b11267b9 as2_open
pchord 242802 1d1ab79e0bdb7df6f1cdacb70ce993fe88304b01bf3604b84ca9fd2ac4cc6f47 ds2_pm2

echo "Done. NOTE: the zone tables are mirrored statically in genre-kernel.js"
echo "SAMPLERS — if you re-extract with different --max-zones or trim caps,"
echo "regenerate that table (and SAMPLES durSec for the pc_* hits)."
