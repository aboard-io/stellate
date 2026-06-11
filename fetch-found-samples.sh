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
cd "$(dirname "$0")"
mkdir -p found/samples/breaks found/samples/hits found/samples/vox

IA="https://archive.org/download"

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

# --- manifest: duration + crude class for every sample ---
python3 - <<'PYEOF'
import json, os, subprocess
root = "found/samples"
out = []
for sub, cls in (("breaks","break"),("hits","hit"),("vox","vox")):
    d = os.path.join(root, sub)
    for f in sorted(os.listdir(d)):
        if not f.endswith(".wav"): continue
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
