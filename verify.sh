#!/usr/bin/env bash
# verify.sh — one-shot verification orchestrator. Runs the three gate suites
# CONCURRENTLY and streams a compact PASS/FAIL row as each one lands:
#
#   matrix     node genre-verifier.js matrix        (symbolic confusion matrix)
#   validate   node validate-genres.js --quick      (kernel differentiation gates)
#   engine     node engine.test.js --quick          (real faust renders, 8s)
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

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
T0=$(date +%s.%N)

run() {   # run <name> <cmd...>: capture output, write "<rc> <secs>" when done
  local name=$1; shift
  local s=$(date +%s.%N) rc
  "$@" >"$TMP/$name.out" 2>&1; rc=$?
  awk -v r="$rc" -v a="$s" -v b="$(date +%s.%N)" 'BEGIN{printf "%d %.1f\n", r, b-a}' >"$TMP/$name.res"
}

echo "verify ($MODE) — matrix + validate + engine.test, concurrent"
run "matrix  " node genre-verifier.js matrix ${PASS_ARGS[@]+"${PASS_ARGS[@]}"} &
run "validate" node validate-genres.js ${VAL_ARGS[@]+"${VAL_ARGS[@]}"} ${PASS_ARGS[@]+"${PASS_ARGS[@]}"} &
run "engine  " node engine.test.js ${ENG_ARGS[@]+"${ENG_ARGS[@]}"} &

FAILED=0
declare -A DONE
for _ in 1 2 3; do
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
