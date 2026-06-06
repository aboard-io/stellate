#!/usr/bin/env bash
# Render the Royal Road vaporwave sketch from its committed source.
# The .wav is DERIVED and git-ignored — regenerate it any time from royal-road.csd.
#
#   ./render.sh            -> writes vaporwave.wav next to this script
#   ./render.sh out.wav    -> writes to a chosen path
#
# Requires: csound (tested with 6.18).
set -euo pipefail
cd "$(dirname "$0")"

out="${1:-vaporwave.wav}"
csound royal-road.csd -o "$out"
echo "Rendered: $(pwd)/$out"
