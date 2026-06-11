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
sev8 78_st-louis-blues_louis-armstrong-and-his-orchestra-w-c-handy_gbia0001837b "78_st-louis-blues_louis-armstrong-and-his-orchestra-w-c-handy_gbia0001837b_01_2.3_CT_EQ.mp3" 12 12 horns_78
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
  local out="found/samples/speech/${1}.wav"
  [ -s "$out" ] && return 0
  echo "→ speech $1"
  espeak-ng -v en-us -p "$3" -s "$4" -w /tmp/say.wav "$2"
  ffmpeg -y -loglevel error -i /tmp/say.wav -ac 1 -ar 44100 \
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

# --- manifest: duration + crude class for every sample ---
python3 - <<'PYEOF'
import json, os, subprocess
root = "found/samples"
out = []
for sub, cls in (("breaks","break"),("hits","hit"),("vox","vox"),("speech","speech"),("78s","seventy8")):
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
