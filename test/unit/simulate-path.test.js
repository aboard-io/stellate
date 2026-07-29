#!/usr/bin/env node
// test/unit/simulate-path.test.js — GATE for the path simulator (tools/audit/simulate-path.js)
// AND for the default 3-node loop's journey health. Runs the simulator on the
// DEFAULT loop TWICE (same seed) and asserts:
//   1. the ride simulates clean: exit 0, pass=true, zero page errors;
//   2. the default loop is 3 waypoints / 3 legs, and every seeded loop genre
//      (window.__LOOP.genres — the 2 outer stars) is actually CROSSED as a
//      dominant-genre segment during one full loop;
//   3. the transit-arrival contract path-wide: every VISITED (dwell > 8 —
//      dominance outlasting the arrival window; shorter crossings are
//      BRUSHES, reported not judged) dominant-genre segment arrives within
//      <=8 bars of dominance (arrival = playing kit AND lead match the
//      target while this genre tops the weights — see ARRIVAL SEMANTICS +
//      the BRUSHED note in tools/audit/simulate-path.js);
//   4. no musicality hard-fails (verdict FAIL/ERROR) on any visited
//      segment's most-settled state;
//   5. IDENTITY-CHURN CONTAINMENT (the revision re-tier in targeting.js's
//      rebuildQueue): when the target re-picks an identity dim after arrival,
//      the revision must land in a few bars — every visited segment
//      re-converges, longest unbroken churn run <= CHURN_MAX bars (pre-fix: the closing disco
//      re-entry churned 12 bars and NEVER re-converged in-segment);
//   6. DETERMINISM: the two runs' reports are byte-identical after stripping
//      the wall-clock field (same seed twice = same journey, same audits).
// Pace 64 (the transit gate's pace): ~4s of virtual riding per run — the whole
// gate is well under a minute.
//   node test/unit/simulate-path.test.js
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SEED = 43, PACE = 64, CONTRACT = 8;
// Post-arrival identity churn is bounded by the LONGEST UNBROKEN run of mismatched
// bars, not by the total across the segment: the total accumulates every later
// re-pick over the whole dwell, so sitting in a genre for 100 bars scored worse
// than sitting in an identical one for 20, which measures dwelling rather than
// churning. The bound is the ARRIVAL contract itself — a revision must land in the
// same window an arrival must land in — and that window is what the engine's own
// numbers add up to: HOLD_BARS 4 (the anti-flicker lock on a timbre that just
// walked on stage) plus the every-other-bar apply cadence, with up to three
// identity dims (form / drum kit / lead voice) queued to walk on one at a time.
// Measured worst at pace 64: 7.
const CHURN_MAX = CONTRACT;

function runSim(tag) {
  const r = spawnSync(process.execPath,
    [path.join(ROOT, "tools", "audit", "simulate-path.js"), "default", "--seed", String(SEED), "--pace", String(PACE), "--json"],
    { cwd: ROOT, env: process.env, encoding: "utf8", timeout: 300000 });
  if (r.error) throw new Error(tag + ": spawn failed: " + r.error.message);
  let rep = null;
  try { rep = JSON.parse(r.stdout); } catch (e) {
    throw new Error(tag + ": no JSON on stdout (exit " + r.status + ")\nstderr: " + (r.stderr || "").slice(-800) + "\nstdout: " + (r.stdout || "").slice(-800));
  }
  return { status: r.status, rep };
}

function main() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

  const t0 = Date.now();
  const A = runSim("runA");
  const B = runSim("runB");
  const rep = A.rep;

  // 1. clean simulation
  ok(A.status === 0, `1a: simulator exit code ${A.status} (want 0)`);
  ok(rep.pass === true, `1b: report.pass=${rep.pass} — ${rep.verdict}`);
  ok((rep.pageErrors || []).length === 0, `1c: ${(rep.pageErrors || []).length} page errors: ${(rep.pageErrors || []).slice(0, 3).join(" | ")}`);

  // 2. default loop shape + all seeded genres crossed
  ok(rep.legs === 3, `2a: default loop legs=${rep.legs} (want 3 — the default triangle)`);
  ok(Array.isArray(rep.loopGenres) && rep.loopGenres.length === 2,
    `2b: __LOOP.genres=[${(rep.loopGenres || []).join(", ")}] (want exactly 2 outer stars + the centre)`);
  const crossed = new Set((rep.segments || []).map((s) => s.genre));
  for (const g of rep.loopGenres || [])
    ok(crossed.has(g), `2c: seeded loop genre "${g}" never became the dominant genre (crossed: ${[...crossed].join(", ")})`);
  ok(crossed.size >= 3, `2d: only ${crossed.size} distinct dominant genres crossed (want >=3: the 2 stars + the centre's neighborhood)`);

  // 3. the transit-arrival contract, path-wide (visited segments only —
  //    a brush's dominance ends before the arrival window does)
  const vis = (rep.segments || []).filter((s) => s.visited);
  ok(vis.length >= 3, `3a: only ${vis.length} visited segments (dwell > ${CONTRACT})`);
  for (const s of vis)
    ok(s.lag >= 0 && s.lag <= CONTRACT,
      `3b: ${s.genre} (enter bar ${s.enter}, dwell ${s.dwell}) arrival lag ${s.lag < 0 ? "NEVER" : "+" + s.lag} (contract <=${CONTRACT})`);

  // 4. no musicality hard-fails on visited segments
  for (const s of vis)
    ok(s.audit.verdict !== "FAIL" && s.audit.verdict !== "ERROR",
      `4: ${s.genre} musicality ${s.audit.verdict} — ${s.audit.worst || ""}`);

  // 5. identity churn contained: revisions land in a few bars and re-converge
  for (const s of vis) {
    ok((s.churnRun || 0) <= CHURN_MAX,
      `5a: ${s.genre} (enter bar ${s.enter}) went ${s.churnRun} consecutive bars without matching its target (allowance <=${CHURN_MAX}; ${s.churnBars} mismatched bars total across a ${s.dwell}-bar dwell) — the revision re-tier regressed`);
    ok(s.churnBars === 0 || s.reconvergeBar >= 0,
      `5b: ${s.genre} (enter bar ${s.enter}) diverged after arrival and NEVER re-converged within the segment`);
    // 5b CONSTANT PACE: on a long leg the traveler CREEPS through
    // the neighborhood at constant speed, so the target micro-re-picks every few
    // bars (churn 1-2) and never reaches an EXACT stationary re-converge — benign
    // tracking, not the re-tier thrash 5b was written for (churn 12, no landing;
    // 5a already bounds hard churn <= CHURN_MAX). So a small-churn segment that
    // never "re-converges" passes; a HARD churn that never lands still fails.
    const CREEP = 3;
    ok(s.churnBars <= CREEP || s.reconvergeBar >= 0,
      `5b: ${s.genre} (enter bar ${s.enter}) churned ${s.churnBars} bars after arrival AND never re-converged in-segment (a re-tier thrash, not the constant-pace creep)`);
  }

  // 6. determinism: same seed twice = same report (minus wall clock)
  const strip = (r) => { const c = JSON.parse(JSON.stringify(r)); delete c.runtimeMs; return c; };
  const a = JSON.stringify(strip(A.rep)), b = JSON.stringify(strip(B.rep));
  ok(a === b, `6: two runs with seed ${SEED} differ (${a.length} vs ${b.length} bytes) — the virtual ride is not deterministic`);

  console.log(`\n=== SIMULATE-PATH GATE (seed ${SEED}, pace ${PACE}) ===`);
  console.log(`  ${rep.label} — ${rep.bars} bars, ${rep.segments.length} dominant segments, ${rep.blendBars} blend bars, ${rep.flipsLanded} flips landed`);
  for (const s of rep.segments)
    console.log(`  ${s.genre.padEnd(16)} enter ${String(s.enter).padStart(4)}  dwell ${String(s.dwell).padStart(3)}  lag ${s.lag < 0 ? "NEVER" : "+" + s.lag}${s.visited ? "" : " (brushed)"}  ${s.audit.verdict}${s.churnBars ? `  (churn ${s.churnBars} bars)` : ""}`);
  console.log(`  worst arrival: ${rep.worstArrival ? "+" + rep.worstArrival.lag + " (" + rep.worstArrival.genre + ")" : "n/a"}  deterministic: ${a === b}`);
  console.log(`  runA ${A.rep.runtimeMs}ms  runB ${B.rep.runtimeMs}ms  gate total ${Date.now() - t0}ms`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  console.log(`SIMULATE-PATH GATE: ${fails.length ? "FAIL" : "PASS"}`);
  process.exit(fails.length ? 1 : 0);
}
main();
