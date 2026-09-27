#!/bin/bash
# install-set.sh — copy a generated Set onto Move so it shows up in Move's Set list.
#
#   ./install-set.sh "sets/Chicago 1987 #7" [--restart]
#
# Makes Sets/<new uuid>/<Set name>/Song.abl, stamps the folder attributes Move
# reads to list a Set (the same ones Move writes), and puts the Song Mode
# arrangement where Schwung's Song Mode tool looks for it. Nothing existing is
# touched. --restart restarts Move afterwards so the new Set appears.
#
# MOVE_HOST overrides the SSH target (default ableton@move.local).
set -euo pipefail

DIR="${1:?usage: install-set.sh <set folder> [--restart]}"
RESTART="${2:-}"
HOST="${MOVE_HOST:-ableton@move.local}"
[ -f "$DIR/Song.abl" ] || { echo "no Song.abl in $DIR" >&2; exit 1; }
NAME="$(basename "$DIR")"
UUID="$(uuidgen | tr 'A-Z' 'a-z')"
STAGE="/tmp/stellate-$UUID"

ssh "$HOST" "mkdir -p $STAGE"
scp -q "$DIR/Song.abl" "$HOST:$STAGE/Song.abl"
[ -f "$DIR/song_mode.json" ] && scp -q "$DIR/song_mode.json" "$HOST:$STAGE/song_mode.json"
printf '%s' "$NAME" > "/tmp/stellate-name-$UUID"
scp -q "/tmp/stellate-name-$UUID" "$HOST:$STAGE/name"
rm -f "/tmp/stellate-name-$UUID"

ssh "$HOST" sh -s "$UUID" <<'REMOTE'
set -e
UUID="$1"
STAGE="/tmp/stellate-$UUID"
SETS=/data/UserData/UserLibrary/Sets
NAME="$(cat "$STAGE/name")"
[ -d "$SETS" ] || { echo "no Sets folder on this Move ($SETS)" >&2; exit 1; }

# the LOWEST FREE position in Move's Set list -- song-index is a bounded pool, and
# counting up from the highest walks off the end once Sets have been deleted
SLOT_MAX="${STELLATE_SLOT_MAX:-31}"
used=" "
for d in "$SETS"/*/; do
  [ -d "$d" ] || continue
  i=$(getfattr -n user.song-index --only-values "$d" 2>/dev/null || true)
  case "$i" in ''|*[!0-9]*) ;; *) used="$used$i " ;; esac
done
idx=0
while [ "$idx" -le "$SLOT_MAX" ]; do
  case "$used" in *" $idx "*) idx=$((idx + 1)) ;; *) break ;; esac
done
[ "$idx" -le "$SLOT_MAX" ] && : || { echo "no free Set slot (Move holds $((SLOT_MAX + 1)))" >&2; exit 1; }

mkdir -p "$SETS/$UUID/$NAME"
mv "$STAGE/Song.abl" "$SETS/$UUID/$NAME/Song.abl"
setfattr -n user.song-index -v "$idx" "$SETS/$UUID"
setfattr -n user.last-modified-time -v "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SETS/$UUID"
setfattr -n user.local-cloud-state -v notSynced "$SETS/$UUID"
setfattr -n user.song-color -v 3 "$SETS/$UUID"
setfattr -n user.was-externally-modified -v false "$SETS/$UUID"

if [ -f "$STAGE/song_mode.json" ]; then
  mkdir -p "/data/UserData/schwung/set_state/$UUID"
  mv "$STAGE/song_mode.json" "/data/UserData/schwung/set_state/$UUID/song_mode.json"
fi
rm -rf "$STAGE"
# ask Move to re-read its Set list, so the Set appears without a restart
dbus-send --system --dest=com.ableton.move --type=method_call \
  /com/ableton/move/browser com.ableton.move.Browser.refreshCache >/dev/null 2>&1 || true
echo "installed \"$NAME\" as Set #$idx ($UUID)"
REMOTE

if [ "$RESTART" = "--restart" ]; then
  ssh "$HOST" "sh /data/UserData/schwung/restart-move.sh" && echo "restarting Move..."
else
  echo "Restart Move (or run again with --restart) to see it in the Set list."
fi
