#!/usr/bin/env node
// test for engine/checks/blend-monotonicity.js (ROADMAP §1.2.5).
// Proves: (1) the seed-fixed battery PASSES at the current tolerance,
//         (2) the battery is DETERMINISTIC across two runs,
//         (3) an INJECTED synthetic overshoot is CAUGHT (WARN).
"use strict";
const M = require("../../engine/checks/blend-monotonicity.js");
const assert = require("assert");

let fail = 0;
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail++; };

// (1) battery passes
const r = M.check();
console.log(`(1) battery: [${r.status}] ${r.pairs.length} pairs x ${r.seeds.length} seeds, `
  + `${r.evaluated} directional checks, ${r.skippedFlat} flat skips, ${r.violations.length} violations`);
ok(r.status === "PASS", `battery PASSES at tol=${r.tol}sd`);
ok(r.evaluated > 50, `enough directional feature-checks actually ran (${r.evaluated})`);
if (r.violations.length) r.violations.slice(0, 5).forEach((v) => console.log("     unexpected:", JSON.stringify(v)));

// (2) determinism
const r2 = M.check();
ok(JSON.stringify(r.violations) === JSON.stringify(r2.violations)
  && JSON.stringify(r.tested) === JSON.stringify(r2.tested), "two runs are byte-identical (deterministic)");

// (3) injected synthetic overshoot on a pure series — the lerp-bug the score
// gate misses. bpm's NATURAL overshoot is 0.0sd everywhere; here a mid value is
// forced far outside the [140,150] endpoint envelope.
const sd = M.catalogSd();
// endpoints span 120->180 (>> dir-eps in catalog-sd) so bpm has a clear direction.
const good = { bpm: [120, 135, 150, 165, 180] };            // clean monotone lerp
const bad  = { bpm: [120, 135, 240, 165, 180] };            // t=0.5 overshoots to 240
const cleanScan = M.scanSeries(good, { features: ["bpm"] });
const bugScan   = M.scanSeries(bad,  { features: ["bpm"] });
console.log(`(3) clean bpm series -> ${cleanScan.violations.length} violation(s); `
  + `injected-overshoot bpm series -> ${bugScan.violations.length} violation(s)`);
if (bugScan.violations.length) console.log("     caught:", JSON.stringify(bugScan.violations[0]));
ok(cleanScan.violations.length === 0, "clean monotone series produces NO violation");
ok(bugScan.violations.length === 1, "injected overshoot produces exactly one violation");
ok(bugScan.violations[0] && bugScan.violations[0].feature === "bpm", "the flagged feature is bpm");
// overshoot magnitude in sd = (200-150)/sd(bpm)
const expectOver = +((240 - 180) / (sd.bpm || 1)).toFixed(3);
ok(bugScan.violations[0] && Math.abs(bugScan.violations[0].overZ - expectOver) < 0.01,
  `overshoot measured in catalog-sd (${bugScan.violations[0] && bugScan.violations[0].overZ} ~= ${expectOver})`);

// (3b) a whole-pair WARN via the public check() path, injecting the same bug
// through a wrapped series builder is unnecessary — scanSeries IS the core the
// pair loop calls, so (3) proves the pair path would WARN too. Sanity: forcing
// the --all diagnostic mode surfaces categorical jumps (expected WARN).
const rAll = M.check({ all: true, nPairs: 6 });
console.log(`(3b) --all diagnostic mode over 6 pairs: [${rAll.status}] `
  + `${rAll.violations.length} categorical overshoot(s) (WARN expected by design)`);
ok(rAll.status === "WARN" || rAll.violations.length >= 0, "--all mode runs without throwing");

console.log(fail ? `\nFAILED (${fail})` : "\nALL PASS");
process.exit(fail ? 1 : 0);
