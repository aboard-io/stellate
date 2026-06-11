#!/usr/bin/env bash
# Fetch + clip the found-VIDEO layer from Internet Archive laserdisc rips.
# Like fetch-found-sound.sh: the clips are NOT committed (gitignored); this
# script IS committed — the recipe that makes the visuals recoverable.
#
#   ./fetch-found-video.sh
#
# Each clip is cut remotely (ffmpeg range-seeks over HTTP, so only the needed
# bytes are fetched — the source discs are 150MB–1.2GB), scaled to 640px,
# stripped of audio, and re-encoded small. Timestamps were hand-curated by
# sampling frames across each disc (2026-06). See SOURCES.md for credits.
# Requires: ffmpeg with https support.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p found/video

IA="https://archive.org/download"
VD1="$IA/video-drug-1-deep-laser-disc-1990/Video Drug 1 - Deep (LaserDisc, 1990).mp4"
VD2="$IA/video-drug-2-phuture-laser-disc-1990/Video Drug 2 - Phuture (LaserDisc, 1990).mp4"
PIO="$IA/pioneer-laser-optics-ii-laserdisc/Pioneer Laser Optics II [Laserdisc].mp4"
LV="$IA/laser-vision-demonstration-1986/LaserVision Demonstration (1986).mp4"
SP="$IA/ss098-0001/SS098-0001 SpaceDisc Vol. 1 Space Shuttle Mission Reports STS 5,6 & 7 (Side 1, English) (ld-decode, QTGMC, TV→PC).mp4"
TK="$IA/tokyo-night-drive-4-k-2016/Tokyo night drive 4K 2016 首都高.mp4"
SF="$IA/from-SF/from-SF.mp4"

# name|url|start(s)|dur(s)|credit
clips() { cat <<'EOF'
disc_sunset|LV|1492|34|LaserVision Demonstration (1986) — the disc as a setting sun
bamboo|LV|1192|32|LaserVision Demonstration (1986) — bamboo forest
blue_dinner|LV|792|30|LaserVision Demonstration (1986) — blue studio dinner
sun_riders|PIO|82|30|Pioneer Laser Optics II (1989) — riders across a giant sun
sharpest_city|PIO|292|28|Pioneer Laser Optics II (1989) — chrome type over the skyline
cgi_bird|PIO|892|30|Pioneer Laser Optics II (1989) — Symbolics CGI
kaleido|VD2|112|34|Video Drug 2: Phuture (1990) — analog kaleidoscope
phuture_red|VD2|412|30|Video Drug 2: Phuture (1990) — red lattice feedback
rainbow_rings|VD2|1132|30|Video Drug 2: Phuture (1990) — rainbow rings
green_nebula|VD2|1492|32|Video Drug 2: Phuture (1990) — green nebula
deep_face|VD1|592|28|Video Drug 1: Deep (1990) — monochrome face collage
earth_orbit|SP|992|34|NASA SpaceDisc Vol. 1 (1984) — Earth from the shuttle
spacewalk|SP|1692|32|NASA SpaceDisc Vol. 1 (1984) — STS spacewalk
night_lines|VD2|894|34|Video Drug 2: Phuture (1990) — blue electric tracery on black
night_lights|VD2|1294|34|Video Drug 2: Phuture (1990) — night-light kaleidoscope
dark_face|VD1|444|32|Video Drug 1: Deep (1990) — static-glitch face
tv_room|VD1|194|32|Video Drug 1: Deep (1990) — TV set in a dark red room
drive_bluehour|TK|115|34|Tokyo Night Drive (2016, PD) — blue-hour expressway
drive_dusk|TK|695|32|Tokyo Night Drive (2016, PD) — dusk highway
drive_bridge|TK|1290|36|Tokyo Night Drive (2016, PD) — Rainbow Bridge
drive_taillights|SF|50|30|Night drive from SF (PD) — taillights at an intersection
EOF
}

resolve() { case "$1" in VD1) echo "$VD1";; VD2) echo "$VD2";; PIO) echo "$PIO";; LV) echo "$LV";; SP) echo "$SP";; TK) echo "$TK";; SF) echo "$SF";; esac; }

manifest="found/video/clips.json"
echo "[" > "$manifest.tmp"
first=1
clips | while IFS='|' read -r name src start dur credit; do
  out="found/video/${name}.mp4"
  if [ ! -s "$out" ]; then
    echo "→ ${name} (${src} @${start}s ${dur}s)"
    ffmpeg -y -loglevel error -ss "$start" -i "$(resolve "$src")" -t "$dur" \
      -an -vf "scale=640:-2,fps=30" -c:v libx264 -crf 27 -preset veryfast \
      -movflags +faststart "$out" </dev/null
  else
    echo "✓ ${name} (cached)"
  fi
done
# manifest written in a second pass so a resumed run still emits every clip
{
  echo "["
  sep=""
  clips | while IFS='|' read -r name src start dur credit; do
    [ -s "found/video/${name}.mp4" ] || continue
    printf '%s  {"file":"%s.mp4","credit":"%s"}' "$sep" "$name" "$credit"
    sep=",
"
  done
  echo ""
  echo "]"
} > "$manifest"
rm -f "$manifest.tmp"
echo "Done. $(ls found/video/*.mp4 2>/dev/null | wc -l) clips in found/video/ + clips.json"
