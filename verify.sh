#!/usr/bin/env bash
# verify.sh — one-shot verification orchestrator. Runs the three gate suites
# CONCURRENTLY and streams a compact PASS/FAIL row as each one lands:
#
#   matrix     node engine/genre-verifier.js matrix        (symbolic confusion matrix)
#   validate   node engine/validate-genres.js --quick      (kernel differentiation gates)
#   engine     node test/engine.test.js --quick          (real faust renders, 8s)
#   prove      node engine/invariants.js prove             (interval proofs + property sweeps)
#
#   ./verify.sh          the fast loop gate (quick validate + 8s presses)
#   ./verify.sh --full   pre-ship: 5-seed validate + full-length 24s presses
#   ./verify.sh --no-cache | --serial   passed through to the node tools
#
# Exits nonzero if ANY suite fails; a failing suite's output tail is printed
# under its row. matrix + validate replay from scratch/.verify-cache/ when the
# capability files are unchanged (see verify-lib.js), so a warm quick loop is
# dominated by the real renders.
set -u
cd "$(dirname "$0")"

FULL=0
PASS_ARGS=()
for a in "$@"; do
  case "$a" in
    --full) FULL=1 ;;
    --no-cache|--serial) PASS_ARGS+=("$a") ;;
    *) echo "verify.sh: unknown flag $a (known: --full --no-cache --serial)" >&2; exit 2 ;;
  esac
done

VAL_ARGS=(--quick); ENG_ARGS=(--quick); MODE=quick
if [ "$FULL" = 1 ]; then VAL_ARGS=(); ENG_ARGS=(); MODE=full; fi

# media guard (the one rule: source committed, audio derived) — no audio/video/
# SoundFont/model binary may ever be tracked. engine/faust/dist/*.wasm is the
# one blessed binary class (compiled from committed dsp/ sources) and is not in
# this list; found/ catalogs and manifests are JSON and unaffected.
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  TRACKED_MEDIA=$(git ls-files | grep -iE '\.(wav|mp3|mp4|ogg|oga|flac|m4a|aac|aif|aiff|webm|mov|avi|mkv|sf2|sf3|pb|syx|onnx|tflite)$' || true)
  if [ -n "$TRACKED_MEDIA" ]; then
    echo "verify: FAIL — media files are tracked in git (recipes, not media — see SOURCES.md):" >&2
    printf '%s\n' "$TRACKED_MEDIA" | sed 's/^/    /' >&2
    exit 1
  fi
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
T0=$(date +%s.%N)

run() {   # run <name> <cmd...>: capture output, write "<rc> <secs>" when done
  local name=$1; shift
  local s=$(date +%s.%N) rc
  "$@" >"$TMP/$name.out" 2>&1; rc=$?
  awk -v r="$rc" -v a="$s" -v b="$(date +%s.%N)" 'BEGIN{printf "%d %.1f\n", r, b-a}' >"$TMP/$name.res"
}

echo "verify ($MODE) — matrix + validate + engine.test + prove + matproof, concurrent"
run "matrix  " node engine/genre-verifier.js matrix ${PASS_ARGS[@]+"${PASS_ARGS[@]}"} &
run "validate" node engine/validate-genres.js ${VAL_ARGS[@]+"${VAL_ARGS[@]}"} ${PASS_ARGS[@]+"${PASS_ARGS[@]}"} &
run "engine  " node test/engine.test.js ${ENG_ARGS[@]+"${ENG_ARGS[@]}"} &
run "prove   " node engine/invariants.js prove &
# matproof: the OFFLINE MATRIX PROVER (engine/prove-matrix.js) — the anchor
# catalog as LO/HI vectors, the blend hull as a reduction, DIFFERENTIALLY
# cross-checked against `prove` (two independent implementations must agree)
# plus a seeded Monte-Carlo witness through the real K.mix.
run "matproof" node test/prove-matrix.test.js &
# poscover: the STAR-MAP POS COMPLETENESS gate (test/pos-coverage.js) — every
# runtime genre (GenreKernel.GENRES) MUST have an app/world.js POS entry, else
# app boot drops into computeGenreLayout's relaxation and crashes the renderer
# (the 2026-07-11 blank-app outage). Plain node, no browser — CI-safe.
run "poscover" node test/pos-coverage.js &
# coordscover: the STAR-CRUISE COORD/CLUSTER COMPLETENESS gate
# (test/coords-coverage.js) — every runtime genre (GenreKernel.GENRES) MUST have
# a planet in app/starcruise/genre-coords.js GENRE_COORDS AND a star in
# genre-clusters.js CLUSTER_OF, else the 3D flight mode can't see that genre (the
# same class as the folk POS outage). Plain node, no browser — CI-safe.
run "coordscover" node test/coords-coverage.js &

FAILED=0
declare -A DONE
for _ in 1 2 3 4 5 6 7; do
  wait -n
  for f in "$TMP"/*.res; do
    [ -e "$f" ] || continue
    name=$(basename "$f" .res)
    [ -n "${DONE[$name]:-}" ] && continue
    DONE[$name]=1
    read -r rc secs <"$f"
    if [ "$rc" = 0 ]; then st=PASS; else st=FAIL; FAILED=1; fi
    cached=""
    grep -q '^(cached)$' "$TMP/$name.out" && cached=" (cached)"
    printf '  %-10s %-4s %6ss%s\n' "$name" "$st" "$secs" "$cached"
    if [ "$rc" != 0 ]; then tail -12 "$TMP/$name.out" | sed 's/^/      | /'; fi
  done
done

awk -v a="$T0" -v b="$(date +%s.%N)" -v f="$FAILED" \
  'BEGIN{printf "  %-10s %-4s %6.1fs\n", "total", (f ? "FAIL" : "PASS"), b-a}'
exit "$FAILED"
