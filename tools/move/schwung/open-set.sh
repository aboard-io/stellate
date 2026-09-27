#!/bin/sh
# open-set.sh <index> — point Move at a Set so it opens after the restart
# (the same one-field edit Schwung's Set Pages makes). Prints ok/err.
IDX="$1"
F="${STELLATE_SETTINGS:-/data/UserData/settings/Settings.json}"
case "$IDX" in ''|*[!0-9]*) echo err; exit 1 ;; esac
[ -f "$F" ] || { echo err; exit 1; }
grep -q '"currentSongIndex":' "$F" || { echo err; exit 1; }
sed -i "s/\"currentSongIndex\": *-\{0,1\}[0-9]*/\"currentSongIndex\": $IDX/" "$F" && echo ok
