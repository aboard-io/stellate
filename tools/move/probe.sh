#!/bin/bash
# probe.sh — ask Move whether it will load a Song.abl, and say why not.
#
# Move's SongRenderer loads a Set before it renders any audio, and logs either
#   "Start rendering song ..."          -- the document passed every check
#   "Couldn't render song: <reason>"    -- it didn't
# so this is a full-fidelity load test that needs no UI, no restart, no install
# and cannot disturb the Set list.  render() returns a job id; we abort that id
# as soon as the verdict is in, so we never wait for the audio.
#
# Usage: scripts/probe.sh path/to/Song.abl [label]  ->  "OK <label>" / "FAIL <label> <reason>"
set -uo pipefail
HOST="${MOVE_HOST:-ableton@move.local}"
FILE="$1"; LABEL="${2:-$(basename "$FILE")}"
R=/data/UserData/stellate-probe
DB="dbus-send --system --dest=com.ableton.move --type=method_call --print-reply /com/ableton/move/songrenderer com.ableton.move.SongRenderer"

ssh "$HOST" "mkdir -p $R" >/dev/null 2>&1
scp -q "$FILE" "$HOST:$R/probe.abl" || { printf 'FAIL %-24s scp failed\n' "$LABEL"; exit 1; }

OUT=$(ssh "$HOST" "
  # free the renderer if an earlier probe left a job running (abort takes the job id)
  [ -f $R/lastid ] && $DB.abort int32:\$(cat $R/lastid) >/dev/null 2>&1
  rm -f $R/probe.wav
  START=\$(wc -l < /var/log/messages)
  ID=''
  n=0
  while [ \$n -lt 15 ]; do
    REPLY=\$($DB.render string:$R/probe.abl string:$R/probe.wav 2>&1)
    ID=\$(echo \"\$REPLY\" | sed -n 's/.*int32 \\([0-9]*\\).*/\\1/p')
    [ -n \"\$ID\" ] && break
    case \"\$REPLY\" in *'already in progress'*) sleep 1 ;; *) echo \"__ERR__ \$REPLY\"; exit 0 ;; esac
    n=\$((n+1))
  done
  [ -z \"\$ID\" ] && { echo __BUSY__; exit 0; }
  echo \"\$ID\" > $R/lastid
  n=0
  while [ \$n -lt 30 ]; do
    L=\$(tail -n +\$((START+1)) /var/log/messages | grep -iE \"Couldn.t render song|Start rendering song\" | sed -n 1p)
    if [ -n \"\$L\" ]; then
      $DB.abort int32:\$ID >/dev/null 2>&1
      rm -f $R/probe.wav $R/lastid
      echo \"\$L\"; exit 0
    fi
    n=\$((n+1)); sleep 1
  done
  $DB.abort int32:\$ID >/dev/null 2>&1; rm -f $R/lastid
  echo __TIMEOUT__
" 2>/dev/null)

case "$OUT" in
  *"Start rendering song"*) printf 'OK   %-24s\n' "$LABEL" ;;
  *"Couldn't render song"*) printf 'FAIL %-24s %s\n' "$LABEL" "$(echo "$OUT" | sed 's/.*Couldn.t render song: //')" ;;
  *) printf '???? %-24s %s\n' "$LABEL" "$OUT" ;;
esac
