#!/usr/bin/env node
// test/simulate-path-run.js — GATE for the path simulator (tools/simulate-path.js)
// AND for the default 3-node loop's journey health. Runs the simulator on the
// DEFAULT loop TWICE (same seed) and asserts:
//   1. the ride simulates clean: exit 0, pass=true, zero page errors;
//   2. the default loop is 3 waypoints / 3 legs, and every seeded loop genre
//      (window.__LOOP.genres — the 2 outer stars) is actually CROSSED as a
//      dominant-genre segment during one full loop;
//   3. the transit-arrival contract path-wide: every qualifying (dwell >= 8)
//      dominant-genre segment arrives within <=8 bars of dominance (arrival =
//      playing kit AND lead match the target while this genre tops the
//      weights — see the ARRIVAL SEMANTICS note in tools/simulate-path.js);
//   4. no musicality hard-fails (verdict FAIL/ERROR) on any qualifying
//      segment's most-settled state;
//   5. DETERMINISM: the two runs' reports are byte-identical after stripping
//      the wall-clock field (same seed twice = same journey, same audits).
// Pace 64 (the transit gate's pace): ~4s of virtual riding per run — the whole
// gate is well under a minute.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/simulate-path-run.js
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SEED = 43, PACE = 64, CONTRACT = 8;

function runSim(tag) {
  const r = spawnSync(process.execPath,
    [path.join(ROOT, "tools", "simulate-path.js"), "default", "--seed", String(SEED), "--pace", String(PACE), "--json"],
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

  // 3. the transit-arrival contract, path-wide
  const qual = (rep.segments || []).filter((s) => s.qualifies);
  ok(qual.length >= 3, `3a: only ${qual.length} qualifying segments (dwell >= ${CONTRACT})`);
  for (const s of qual)
    ok(s.lag >= 0 && s.lag <= CONTRACT,
      `3b: ${s.genre} (enter bar ${s.enter}, dwell ${s.dwell}) arrival lag ${s.lag < 0 ? "NEVER" : "+" + s.lag} (contract <=${CONTRACT})`);

  // 4. no musicality hard-fails on qualifying segments
  for (const s of qual)
    ok(s.audit.verdict !== "FAIL" && s.audit.verdict !== "ERROR",
      `4: ${s.genre} musicality ${s.audit.verdict} — ${s.audit.worst || ""}`);

  // 5. determinism: same seed twice = same report (minus wall clock)
  const strip = (r) => { const c = JSON.parse(JSON.stringify(r)); delete c.runtimeMs; return c; };
  const a = JSON.stringify(strip(A.rep)), b = JSON.stringify(strip(B.rep));
  ok(a === b, `5: two runs with seed ${SEED} differ (${a.length} vs ${b.length} bytes) — the virtual ride is not deterministic`);

  console.log(`\n=== SIMULATE-PATH GATE (seed ${SEED}, pace ${PACE}) ===`);
  console.log(`  ${rep.label} — ${rep.bars} bars, ${rep.segments.length} dominant segments, ${rep.blendBars} blend bars, ${rep.flipsLanded} flips landed`);
  for (const s of rep.segments)
    console.log(`  ${s.genre.padEnd(16)} enter ${String(s.enter).padStart(4)}  dwell ${String(s.dwell).padStart(3)}  lag ${s.lag < 0 ? "NEVER" : "+" + s.lag}${s.qualifies ? "" : " (grazed)"}  ${s.audit.verdict}${s.churnBars ? `  (churn ${s.churnBars} bars)` : ""}`);
  console.log(`  worst arrival: ${rep.worstArrival ? "+" + rep.worstArrival.lag + " (" + rep.worstArrival.genre + ")" : "n/a"}  deterministic: ${a === b}`);
  console.log(`  runA ${A.rep.runtimeMs}ms  runB ${B.rep.runtimeMs}ms  gate total ${Date.now() - t0}ms`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  console.log(`SIMULATE-PATH GATE: ${fails.length ? "FAIL" : "PASS"}`);
  process.exit(fails.length ? 1 : 0);
}
main();
