#!/bin/sh
# make-set.sh <stage dir> — run on Move by Stellate's UI (host_system_cmd, as ableton).
# The stage dir holds Song.abl, song_mode.json, name and uuid, written by ui.js.
# Adds the Set to the end of Move's Set list exactly as Move lays one out:
#   Sets/<uuid>/<name>/Song.abl, plus the folder attributes Move reads.
# Writes "ok <index>" or "err <reason>" to <stage>/result.
STAGE="$1"
SETS="${STELLATE_SETS:-/data/UserData/UserLibrary/Sets}"
STATE="${STELLATE_STATE:-/data/UserData/schwung/set_state}"
RES="$STAGE/result"
fail() { echo "err $*" > "$RES"; exit 1; }

[ -f "$STAGE/Song.abl" ] || fail "no Song.abl"
[ -d "$SETS" ] || fail "no Sets folder"
UUID="$(cat "$STAGE/uuid")"
NAME="$(cat "$STAGE/name")"
case "$UUID" in ''|*/*|*..*) fail "bad uuid" ;; esac
case "$NAME" in ''|*/*) fail "bad name" ;; esac
[ -e "$SETS/$UUID" ] && fail "uuid exists"

# The LOWEST FREE slot, not one past the highest. Move's song-index is a bounded pool
# ("No free song index available" is its own error), it hands out slots to Sets you make
# yourself, and deleting a Set frees one. Counting up from the highest walked off the end
# of the list after a few make-and-delete rounds and the Set stopped appearing.
SLOT_MAX="${STELLATE_SLOT_MAX:-31}"
used=" "
if command -v getfattr >/dev/null 2>&1; then
  for d in "$SETS"/*/; do
    [ -d "$d" ] || continue
    i=$(getfattr -n user.song-index --only-values "$d" 2>/dev/null)
    case "$i" in ''|*[!0-9]*) ;; *) used="$used$i " ;; esac
  done
else                                               # no getfattr: assume slots 0..n-1 taken
  n=$(ls -d "$SETS"/*/ 2>/dev/null | wc -l)
  i=0
  while [ "$i" -lt "$n" ]; do used="$used$i "; i=$((i + 1)); done
fi
idx=0
while [ "$idx" -le "$SLOT_MAX" ]; do
  case "$used" in *" $idx "*) idx=$((idx + 1)) ;; *) break ;; esac
done
[ "$idx" -le "$SLOT_MAX" ] || fail "no free Set slot (Move holds $((SLOT_MAX + 1)))"

mkdir -p "$SETS/$UUID/$NAME" || fail "mkdir"
cp "$STAGE/Song.abl" "$SETS/$UUID/$NAME/Song.abl.tmp" || fail "copy"
mv "$SETS/$UUID/$NAME/Song.abl.tmp" "$SETS/$UUID/$NAME/Song.abl" || fail "rename"
setfattr -n user.song-index -v "$idx" "$SETS/$UUID" || fail "xattr"
setfattr -n user.last-modified-time -v "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SETS/$UUID"
setfattr -n user.local-cloud-state -v notSynced "$SETS/$UUID"
setfattr -n user.song-color -v 3 "$SETS/$UUID"
setfattr -n user.was-externally-modified -v false "$SETS/$UUID"

if [ -f "$STAGE/song_mode.json" ]; then
  mkdir -p "$STATE/$UUID" && cp "$STAGE/song_mode.json" "$STATE/$UUID/song_mode.json"
fi

# Whether ui.js's shell runs as ableton or as root varies across restarts (Move itself is
# root, so it does not care). Anything a root run leaves behind is unwritable by a later
# ableton run, which is how the tool locked itself out: root-owned out/ meant ui.js could
# not create its stage directory and every make failed at "could not write files". So a
# root run hands everything back to ableton -- the Set, its Song Mode state, and the
# module's own scratch.
if [ "$(id -u)" = "0" ]; then
  chown -R ableton:users "$SETS/$UUID" 2>/dev/null || true
  [ -d "$STATE/$UUID" ] && chown -R ableton:users "$STATE/$UUID" 2>/dev/null || true
  MOD="$(dirname "$(dirname "$STAGE")")"          # .../stellate/out/<uuid> -> .../stellate
  if [ -f "$MOD/module.json" ]; then               # only if that really is the module dir
    chown -R ableton:users "$MOD/out" "$MOD/last" 2>/dev/null || true
  fi
fi
# Move reads its Set list when it starts, so a Set written now is invisible until
# then. Browser.refreshCache() makes it re-read straight away, which is what puts
# the Set in the list without a restart. Harmless if Move isn't up.
dbus-send --system --dest=com.ableton.move --type=method_call \
  /com/ableton/move/browser com.ableton.move.Browser.refreshCache >/dev/null 2>&1 || true

echo "ok $idx" > "$RES"
