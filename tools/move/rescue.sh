#!/bin/bash
# rescue.sh — stop a Move boot loop caused by a Stellate-made Set.
# Moves every Stellate Set (name ends " #<seed>") out of Move's Set list into
# /data/UserData/stellate-quarantine (nothing is deleted), points Move at the
# first remaining Set, and disables Stellate's auto-open. Then power-cycle Move.
set -uo pipefail
HOST="${MOVE_HOST:-ableton@move.local}"
ssh "$HOST" sh -s <<'REMOTE'
SETS=/data/UserData/UserLibrary/Sets
Q=/data/UserData/stellate-quarantine
F=/data/UserData/settings/Settings.json
mkdir -p "$Q"
for d in "$SETS"/*/; do
  for s in "$d"*/; do
    n=$(basename "$s")
    case "$n" in *" #"[0-9]*) u=$(basename "$d"); echo "quarantine: $n ($u)"; mv "$d" "$Q/$u"; break ;; esac
  done
done
low=""
for d in "$SETS"/*/; do
  i=$(getfattr -n user.song-index --only-values "$d" 2>/dev/null)
  case "$i" in ''|*[!0-9]*) ;; *) if [ -z "$low" ] || [ "$i" -lt "$low" ]; then low=$i; fi ;; esac
done
[ -n "$low" ] || low=0
sed -i "s/\"currentSongIndex\": *-\{0,1\}[0-9]*/\"currentSongIndex\": $low/" "$F" && echo "currentSongIndex -> $low"
rm -f /data/UserData/schwung/modules/tools/stellate/auto_open
echo "done. Now power-cycle Move (hold the power button, then turn it on)."
REMOTE
