#!/usr/bin/env bash
# tools/genre/render-diff.sh — one-command byte-diff of symbolic renders.
#
# THE REASSURING TOOL. The engine's core promise is that renders are
# BYTE-IDENTICAL: the same state (or genre+seed) must produce the same symbolic
# events regardless of code refactors. This turns that scary invariant into a
# green check. It renders engine/csd-engine.js buildEvents on your WORKING TREE
# and on a git ref (default HEAD), then reports BYTE-EQUAL or shows the drift.
#
# It NEVER touches your working tree: the "other" side is a detached git
# worktree checked out in a temp dir and removed on exit. No stash, no reset,
# no data loss.
#
# Usage:
#   tools/genre/render-diff.sh <genre> [seed]           # e.g. vaporwave 1
#   tools/genre/render-diff.sh --state <state.json>     # render a saved state
#   tools/genre/render-diff.sh <genre> [seed] --ref <gitref>   # compare vs a ref
#
# Options:
#   --ref <gitref>   the "other" version to compare against (default: HEAD)
#   --state <file>   render this state JSON instead of a genre+seed
#   --seed <n>       seed for the genre path (or pass positionally)
#   --keep           keep the two rendered JSONs (prints their paths)
#   --simulate-drift DEMO: perturb the ref side so outputs differ, to show the
#                    drift path end-to-end (proves the red path works)
#   -h | --help      this help
#
# Exit: 0 = BYTE-EQUAL, 1 = DRIFT, 2 = usage/setup error.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HARNESS="$SCRIPT_DIR/render-diff-harness.js"

REF="HEAD"
STATE=""
GENRE=""
SEED=""
KEEP=0
SIM_DRIFT=0

die() { echo "render-diff: $*" >&2; exit 2; }

# --- parse args (positional genre + seed, plus flags) ---
POS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    --state) STATE="${2:-}"; shift 2 ;;
    --seed) SEED="${2:-}"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    --simulate-drift) SIM_DRIFT=1; shift ;;
    --) shift ;;
    -*) die "unknown option: $1" ;;
    *) POS+=("$1"); shift ;;
  esac
done

if [ -z "$STATE" ]; then
  GENRE="${POS[0]:-}"
  [ -z "$GENRE" ] && die "need a <genre> (and optional seed) or --state <file>. See --help."
  [ -z "$SEED" ] && SEED="${POS[1]:-1}"
else
  [ -f "$STATE" ] || die "state file not found: $STATE"
  # absolutize so it resolves from inside the worktree too
  STATE="$(cd "$(dirname "$STATE")" && pwd)/$(basename "$STATE")"
fi

command -v node >/dev/null 2>&1 || die "node not found on PATH"
[ -f "$HARNESS" ] || die "missing harness: $HARNESS"
git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1 || die "not a git repo: $REPO_ROOT"
REF_SHA="$(git -C "$REPO_ROOT" rev-parse --short "$REF" 2>/dev/null)" || die "bad git ref: $REF"

# --- temp work area (auto-cleaned; worktree removed even on error) ---
TMP="$(mktemp -d "${TMPDIR:-/tmp}/render-diff.XXXXXX")"
WT="$TMP/wt-$REF_SHA"
cleanup() {
  if [ -d "$WT" ]; then
    git -C "$REPO_ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true
  fi
  git -C "$REPO_ROOT" worktree prune >/dev/null 2>&1 || true
  if [ "$KEEP" -eq 1 ]; then
    :
  else
    rm -rf "$TMP" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# common harness args
HARGS=()
if [ -n "$STATE" ]; then HARGS+=(--state "$STATE"); LABEL="state $(basename "$STATE")";
else HARGS+=(--genre "$GENRE" --seed "$SEED"); LABEL="$GENRE (seed $SEED)"; fi

OUT_WORK="$TMP/work.json"
OUT_REF="$TMP/ref.json"

echo "render-diff: $LABEL" >&2
echo "  working tree : $REPO_ROOT" >&2
echo "  compared ref : $REF ($REF_SHA)" >&2

# --- render on the WORKING TREE ---
node "$HARNESS" --root "$REPO_ROOT" "${HARGS[@]}" > "$OUT_WORK" \
  || die "working-tree render failed (see stderr above)"

# --- render on the REF via an isolated detached worktree ---
git -C "$REPO_ROOT" worktree add --detach "$WT" "$REF_SHA" >/dev/null 2>&1 \
  || die "could not create worktree at $REF_SHA"

REFARGS=("${HARGS[@]}")
[ "$SIM_DRIFT" -eq 1 ] && REFARGS+=(--drift)
node "$HARNESS" --root "$WT" "${REFARGS[@]}" > "$OUT_REF" \
  || die "ref render failed (see stderr above)"

# --- compare bytes ---
WBYTES=$(wc -c < "$OUT_WORK" | tr -d ' ')
RBYTES=$(wc -c < "$OUT_REF" | tr -d ' ')

if cmp -s "$OUT_WORK" "$OUT_REF"; then
  echo "BYTE-EQUAL  ✓  ($WBYTES bytes, identical on both sides)"
  [ "$KEEP" -eq 1 ] && echo "  kept: $OUT_WORK  $OUT_REF" >&2
  exit 0
else
  echo "DRIFT  ✗  working=$WBYTES bytes  ref=$RBYTES bytes" >&2
  echo "----- first differing lines (working <  |  ref >) -----" >&2
  # unified diff, capped so a big divergence doesn't flood the terminal
  diff -u "$OUT_REF" "$OUT_WORK" 2>/dev/null | sed -n '1,60p' >&2 || true
  echo "-------------------------------------------------------" >&2
  if [ "$KEEP" -eq 1 ]; then
    echo "  full renders kept:" >&2
    echo "    working: $OUT_WORK" >&2
    echo "    ref    : $OUT_REF" >&2
  else
    echo "  (re-run with --keep to save both full renders for inspection)" >&2
  fi
  exit 1
fi
