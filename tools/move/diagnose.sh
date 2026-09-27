#!/bin/bash
# tools/move/diagnose.sh — pull what a Move can tell you into tools/move/diag/:
# its log, Settings.json, the Set list with indexes, the Track Presets, the last Set
# the tool made, and a Set Move wrote itself to compare against.
set -uo pipefail
cd "$(dirname "$0")"
HOST="${MOVE_HOST:-ableton@move.local}"
mkdir -p diag
ssh "$HOST" 'touch /data/UserData/schwung/debug_log_on'
ssh "$HOST" 'tail -n 400 /data/UserData/schwung/debug.log' > diag/debug.log 2>&1
ssh "$HOST" 'cat /data/UserData/settings/Settings.json; echo; cat /data/UserData/schwung/active_set.txt' > diag/settings.txt 2>&1
ssh "$HOST" 'for d in /data/UserData/UserLibrary/Sets/*/; do printf "%s\t%s\t" "$(getfattr -n user.song-index --only-values "$d" 2>/dev/null)" "$(basename "$d")"; ls "$d"; done' > diag/sets.tsv 2>&1
ssh "$HOST" 'find "/data/CoreLibrary/Track Presets" -name "*.json"' > diag/presets.txt 2>&1
ssh "$HOST" 'ls -la /data/UserData/schwung/modules/tools/stellate/ /data/UserData/schwung/modules/tools/stellate/last 2>&1; cat /data/UserData/schwung/modules/tools/stellate/last.json 2>/dev/null' > diag/module.txt 2>&1
# the last Set Stellate made, and the Set you're in (a Move-written reference)
scp -q -r "$HOST:/data/UserData/schwung/modules/tools/stellate/last" diag/last 2>/dev/null
IFS=$'\n' read -r -d '' UUID NAME < <(ssh "$HOST" 'cat /data/UserData/schwung/active_set.txt'; printf '\0')
mkdir -p diag/base && scp -q "$HOST:/data/UserData/UserLibrary/Sets/$UUID/${NAME// /\\ }/Song.abl" diag/base/Song.abl 2>/dev/null \
  || ssh "$HOST" "cat \"/data/UserData/UserLibrary/Sets/$UUID/$NAME/Song.abl\"" > diag/base/Song.abl
# the core-library presets (for the ladder's L3-L5)
ssh "$HOST" 'cd /data/CoreLibrary && tar czf - "Track Presets"' | tar -C diag -xzf - 2>/dev/null
ssh "$HOST" 'cat /etc/os-release 2>/dev/null; ls /opt/move 2>/dev/null | head; strings /opt/move/Move 2>/dev/null | grep -m3 -E "^[0-9]+\.[0-9]+\.[0-9]+"' > diag/device.txt 2>&1
echo "diag/:"; ls -la diag
