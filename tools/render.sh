#!/usr/bin/env bash
# Render the Royal Road vaporwave sketch from its committed source, then encode
# an MP3. Both outputs are DERIVED and git-ignored — regenerate them any time.
#
#   ./render.sh            -> vaporwave.wav + vaporwave.mp3 next to this script
#   ./render.sh out        -> out.wav + out.mp3
#
# Needs the found-sound layer first:  ./fetch-found-sound.sh
# Requires: csound (tested 6.18), ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."

base="${1:-vaporwave}"
wav="${base}.wav"
mp3="${base}.mp3"

if [ ! -f found/tokyo_station.wav ]; then
  echo "Missing found-sound layer. Run ./fetch-found-sound.sh first." >&2
  exit 1
fi

csound royal-road.csd -o "$wav"
ffmpeg -y -loglevel error -i "$wav" -codec:a libmp3lame -b:a 160k "$mp3"
echo "Rendered: $(pwd)/$wav"
echo "Encoded:  $(pwd)/$mp3"
