#!/usr/bin/env bash
# verify.sh — one-shot verification orchestrator. Runs every gate suite
# CONCURRENTLY and streams a compact PASS/FAIL row as each one lands:
#
#   matrix      node engine/genre-verifier.js matrix       (symbolic confusion matrix)
#   validate    node engine/validate-genres.js --quick     (kernel differentiation gates)
#   engine      node test/engine.test.js --quick           (real faust renders, 8s)
#   prove       node engine/invariants.js prove            (interval proofs + property sweeps)
#   social      node test/social-meta.test.js              (OG/JSON-LD/icons/oembed contract)
#   matproof    node test/prove-matrix.test.js             (offline matrix prover, cross-checked)
#   poscover    node test/pos-coverage.js                  (every genre has a star-map POS)
#   coordscover node test/coords-coverage.js               (every genre has a 3D coord + cluster)
#   seamwalk    node test/live-walk-parity.test.js         (chord-bar seam fires exactly once)
#   bootsmoke   node test/boot-smoke.js                    (script load order + window globals)
#   doccounts   node test/doc-counts.test.js                (docs state the real anchor count)
#
# The rows are not a fixed list — adding a `run` line below is all it takes; the
# wait loop counts jobs rather than a hardcoded tally.
#
#   ./verify.sh          the fast loop gate (quick validate + 8s presses)
#   ./verify.sh --full   pre-ship: 5-seed validate + full-length 24s presses
#   ./verify.sh --no-cache | --serial   passed through to the node tools
#
# Exits nonzero if ANY suite fails; a failing suite's output tail is printed
# under its row. matrix + validate replay from scratch/.verify-cache/ when the
# capability files are unchanged (see verify-lib.js), so a warm quick loop is
# dominated by the real renders. (The cache lives under engine/scratch/, not the
# root scratch/ — verify-lib.js roots it at its own dirname.)
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

PIDS=()
echo "verify ($MODE) — running all suites concurrently"
run "matrix  " node engine/genre-verifier.js matrix ${PASS_ARGS[@]+"${PASS_ARGS[@]}"} &
PIDS+=($!)
run "validate" node engine/validate-genres.js ${VAL_ARGS[@]+"${VAL_ARGS[@]}"} ${PASS_ARGS[@]+"${PASS_ARGS[@]}"} &
PIDS+=($!)
run "engine  " node test/engine.test.js ${ENG_ARGS[@]+"${ENG_ARGS[@]}"} &
PIDS+=($!)
run "prove   " node engine/invariants.js prove &
PIDS+=($!)
# social: the OG/JSON-LD/icons/oembed contract (pure node, ~10ms)
run "social  " node test/social-meta.test.js &
PIDS+=($!)
# matproof: the OFFLINE MATRIX PROVER (engine/prove-matrix.js) — the anchor
# catalog as LO/HI vectors, the blend hull as a reduction, DIFFERENTIALLY
# cross-checked against `prove` (two independent implementations must agree)
# plus a seeded Monte-Carlo witness through the real K.mix.
run "matproof" node test/prove-matrix.test.js &
PIDS+=($!)
# poscover: the STAR-MAP POS COMPLETENESS gate (test/pos-coverage.js) — every
# runtime genre (GenreKernel.GENRES) MUST have an app/world.js POS entry, else
# app boot drops into computeGenreLayout's relaxation and crashes the renderer
# (a missing entry is a blank-app outage). Plain node, no browser — CI-safe.
run "poscover" node test/pos-coverage.js &
PIDS+=($!)
# coordscover: the STAR-CRUISE COORD/CLUSTER COMPLETENESS gate
# (test/coords-coverage.js) — every runtime genre (GenreKernel.GENRES) MUST have
# a planet in app/starcruise/genre-coords.js GENRE_COORDS AND a star in
# genre-clusters.js CLUSTER_OF, else the 3D flight mode can't see that genre (the
# same class as the folk POS outage). Plain node, no browser — CI-safe.
run "coordscover" node test/coords-coverage.js &
PIDS+=($!)
# seamwalk: THE SEAM GATE (test/live-walk-parity.test.js) — replays the real
# faust/live.js makeWalk in node and asserts every event on a chord-bar boundary
# fires EXACTLY ONCE across the join. This closes the hole every other gate
# leaves open: they all test inside a unit, never across one. Plain node, no
# browser, ~2s — CI-safe.
run "seamwalk" node test/live-walk-parity.test.js &
PIDS+=($!)
# bootsmoke: THE LOAD-ORDER GATE (test/boot-smoke.js) — parses index.html, replays
# its classic <script> block in a vm sandbox, and fails if a script goes missing,
# moves, loads out of order, or stops publishing its window global. It is the gate
# that makes moving engine files survivable; it lived only in `npm run test:pure`,
# which CI never calls, so the reorg it protects was running unprotected. Plain
# node, no browser, ~1s — CI-safe.
run "bootsmoke" node test/boot-smoke.js &
PIDS+=($!)
# doccounts: the docs must not lie about the size of the space. The anchor count
# has been wrong in the docs three times over and drifts silently because nothing
# reads it — CONTRIBUTING once said 274 and 249 twenty-eight lines apart, and the
# PR template asked contributors to confirm a matrix size that had not existed in
# months. Reads the real count from the kernel; lines that date themselves are
# exempt. Plain node, no browser, ~1s — CI-safe.
run "doccounts" node test/doc-counts.test.js &
PIDS+=($!)

FAILED=0
declare -A DONE
# One iteration per LAUNCHED job, recorded as we launch. Do NOT count with
# `jobs -rp`: that lists only jobs still RUNNING, so any suite that finishes
# before the count is taken goes unrecorded, the loop exits early, and the EXIT
# trap wipes $TMP under the suites still writing — which surfaces as a random
# green gate reported FAIL. (Hardcoding a tally has the same failure mode, and
# adding a gate must not require editing a number.) Every `run ... &` above is
# followed by PIDS+=($!).
for _ in "${PIDS[@]}"; do
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
