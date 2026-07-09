#!/usr/bin/env bash
# fetch-sample-cd.sh — the REUSABLE "incorporate a sample CD" pipeline.
# Point it at any archive.org sample-CD item (a zip of WAVs) and it will
# download → extract → convert to mono 44.1k → trim silence + loudnorm → DROP
# near-empty results → CLASSIFY each sample (pitch / bpm / loop-vs-hit, via
# tools/classify-sample-cd.py) → rename meaningfully from the detected metadata
# → write found/samples/<prefix>/manifest.json → print a ready-to-paste SAMPLES
# registry snippet for engine/genre-kernel.js.
#
# The audio is NOT committed (gitignored under found/); THIS recipe + the
# registry/genre edits ARE the committed deliverable. See SOURCES.md and the
# "Incorporating a sample CD" section of CLAUDE.md.
#
#   tools/fetch-sample-cd.sh <archive-item> <zip-filename> <prefix> [dest]
#
# e.g. the Fatboy Slim "Skip to My Loops" CD (79 generically-named WAVs):
#   tools/fetch-sample-cd.sh fatboy-slim-skip-to-my-loops \
#     "Fatboy Slim - Skip to my loops.zip" stml
#
#   <archive-item>  archive.org item id (the /details/<id> slug)
#   <zip-filename>  the .zip in that item (raw name; spaces ok, we URL-encode)
#   <prefix>        short tag for the crate (ids/dir/filenames), e.g. stml
#   [dest]          output dir (default found/samples/<prefix>)
#
# Idempotent: skips the whole run if <dest>/manifest.json already exists.
# Requires: curl, unzip, ffmpeg, ffprobe, python3 (numpy+scipy).
set -euo pipefail
cd "$(dirname "$0")/.."

IA="https://archive.org/download"

item="${1:?archive.org item id required}"
zipname="${2:?zip filename required}"
prefix="${3:?prefix required}"
dest="${4:-found/samples/$prefix}"

manifest="$dest/manifest.json"
if [ -s "$manifest" ]; then
  echo "✓ $manifest already exists — sample CD '$prefix' ingested, skipping."
  echo "  (delete $dest to re-ingest.)"
  exit 0
fi

work="$(mktemp -d)"
raw="$work/raw"; trimmed="$work/trimmed"
mkdir -p "$raw" "$trimmed" "$dest"
trap 'rm -rf "$work"' EXIT

# --- 1. download the zip (URL-encode the filename) ---
enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$zipname")
url="$IA/$item/$enc"
echo "→ downloading $url"
curl -sL -C - --retry 3 --max-time 900 -o "$work/cd.zip" "$url"

# --- 2. extract (flatten: sample CDs often nest a folder) ---
echo "→ extracting"
unzip -o -j -q "$work/cd.zip" -d "$raw" '*.wav' '*.WAV' '*.aif' '*.aiff' '*.AIF' '*.AIFF' 2>/dev/null || \
  unzip -o -j -q "$work/cd.zip" -d "$raw"

# --- 3. convert → mono 44.1k, trim leading/trailing silence, loudnorm, drop tiny ---
echo "→ converting + trimming (silenceremove, loudnorm=I=-18:TP=-1)"
i=0; kept=0
shopt -s nullglob nocaseglob
for f in "$raw"/*.wav "$raw"/*.aif "$raw"/*.aiff; do
  [ -e "$f" ] || continue
  out="$trimmed/$(printf 'src_%04d.wav' "$i")"
  ffmpeg -y -loglevel error -i "$f" -ac 1 -ar 44100 \
    -af "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB:detection=peak,areverse,silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB:detection=peak,areverse,loudnorm=I=-18:TP=-1" \
    "$out" 2>/dev/null || { i=$((i+1)); continue; }
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out" 2>/dev/null || echo 0)
  if python3 -c "import sys;sys.exit(0 if float(sys.argv[1] or 0)>=0.12 else 1)" "$dur"; then
    kept=$((kept+1))
  else
    rm -f "$out"   # DROP near-empty trim residue (<0.12s)
  fi
  i=$((i+1))
done
shopt -u nullglob nocaseglob
echo "  kept $kept of $i samples (dropped <0.12s)"

# --- 4. classify each (duration/rms/centroid/YIN-pitch/onset-bpm → loop|tonal|oneshot|chop) ---
echo "→ classifying"
python3 tools/classify-sample-cd.py "$trimmed" --json "$work/classified.json" >/dev/null

# --- 5. rename by detected metadata + manifest + registry snippet ---
python3 - "$prefix" "$dest" "$trimmed" "$work/classified.json" "$item" <<'PYEOF'
import json, os, sys, shutil
prefix, dest, trimmed, cjson, item = sys.argv[1:6]
recs = json.load(open(cjson))
def notetag(n):
    return n.lower().replace('#','s') if n else None
counters = {}
def seq(k):
    counters[k] = counters.get(k, 0) + 1
    return counters[k]
manifest, snippet = [], []
for r in recs:
    cls = r["class"]
    if cls == "drop":
        continue
    src = os.path.join(trimmed, r["file"])
    dur = r["dur"]
    if cls == "loop":
        bpm = r.get("bpm_round") or int(round(r.get("bpm", 0)))
        name = f"loop_{bpm}_{seq('loop'):02d}.wav"
        m = {"file": f"{prefix}/{name}", "class": "break", "dur": dur, "bpm": bpm}
        snippet.append(f'    {prefix}_{name[:-4]}:{{ file:"{prefix}/{name}", kind:"break", bpm:{bpm}, durSec:{dur} }},')
    elif cls == "tonal":
        nt = notetag(r.get("note"))
        name = f"hit_{nt}_{seq('hit'):02d}.wav" if nt else f"hit_{seq('hit'):02d}.wav"
        m = {"file": f"{prefix}/{name}", "class": "hit", "dur": dur}
        note_field = f', note:"{r["note"]}"' if r.get("note") else ""
        if r.get("note"): m["note"] = r["note"]
        snippet.append(f'    {prefix}_{name[:-4]}:{{ file:"{prefix}/{name}", kind:"hit", durSec:{dur}{note_field} }},')
    elif cls == "oneshot":
        name = f"hit_{seq('hit'):02d}.wav"
        m = {"file": f"{prefix}/{name}", "class": "hit", "dur": dur}
        snippet.append(f'    {prefix}_{name[:-4]}:{{ file:"{prefix}/{name}", kind:"hit", durSec:{dur} }},')
    else:  # chop
        nt = notetag(r.get("note"))
        name = f"chop_{nt}_{seq('chop'):02d}.wav" if nt else f"chop_{seq('chop'):02d}.wav"
        m = {"file": f"{prefix}/{name}", "class": "chop", "dur": dur}
        note_field = f', note:"{r["note"]}"' if r.get("note") else ""
        if r.get("note"): m["note"] = r["note"]
        snippet.append(f'    {prefix}_{name[:-4]}:{{ file:"{prefix}/{name}", kind:"chop", durSec:{dur}{note_field} }},')
    shutil.copyfile(src, os.path.join(dest, name))
    manifest.append(m)
json.dump(manifest, open(os.path.join(dest, "manifest.json"), "w"), indent=1)
byclass = {}
for m in manifest: byclass[m["class"]] = byclass.get(m["class"], 0) + 1
print(f"  wrote {dest}/manifest.json: {len(manifest)} samples {byclass}")
print()
print(f"  # --- ready-to-paste SAMPLES snippet ({prefix}, archive.org {item}) ---")
for s in snippet:
    print(s)
PYEOF

echo "Done. Samples in $dest/ (gitignored). Append the snippet above to"
echo "engine/genre-kernel.js SAMPLES, then wire ids into genre found/hits pools"
echo "(matrix-safe: add to EXISTING role pools only — see CLAUDE.md)."
