#!/usr/bin/env node
// test/genre-math-run.js — proofs for tools/genre-math.js
//   1. IDENTITY: "A - x + x" ~= A  (A scores highest, small residual)
//   2. OUT-OF-HULL: a genre pushed far along an axis reports a LARGE residual
//   3. DETERMINISM: same expr + seed => byte-identical output
const M = require("../tools/genre-math.js");
const assert = require("assert");

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

// 1. identity: jazz - swing + swing  ~= jazz
const idA = M.evaluate("jazz - swing + swing", { seed: 1 });
const idTop = idA.topScores[0].genre;
console.log("\n[1] identity 'jazz - swing + swing'");
console.log("    top:", idA.topScores.slice(0, 3).map((s) => s.genre + "=" + s.score.toFixed(1)).join(" "));
console.log("    residual:", idA.residual, "reachable:", idA.reachable, "topWeight:", JSON.stringify(idA.weights[0]));
ok(idTop === "jazz", "identity scores jazz highest (got " + idTop + ")");
ok(idA.residual <= M.HULL_TOL, "identity residual is small/reachable (" + idA.residual + " <= " + M.HULL_TOL + ")");

// identity must equal the bare-genre request "jazz" exactly (x and -x cancel).
const bare = M.evaluate("jazz", { seed: 1 });
ok(JSON.stringify(idA.weights) === JSON.stringify(bare.weights),
   "'jazz - swing + swing' == 'jazz' (axis terms cancel exactly)");

// 2. out-of-hull: shove jazz 30 sd's up the sub axis — unreachable material.
const oob = M.evaluate("jazz + sub*30", { seed: 1 });
console.log("\n[2] out-of-hull 'jazz + sub*30'");
console.log("    residual:", oob.residual, "reachable:", oob.reachable, "label:", oob.label);
ok(oob.residual > M.HULL_TOL, "out-of-hull residual is LARGE (" + oob.residual + " > " + M.HULL_TOL + ")");
ok(oob.reachable === false, "out-of-hull flagged not-reachable");
ok(oob.residual > idA.residual * 3, "out-of-hull residual >> identity residual");

// 3. determinism
const d1 = M.evaluate("house*0.7 + techno*0.3 - wash", { seed: 2 });
const d2 = M.evaluate("house*0.7 + techno*0.3 - wash", { seed: 2 });
ok(JSON.stringify(d1) === JSON.stringify(d2), "deterministic per seed (byte-identical output)");
console.log("\n[3] determinism 'house*0.7 + techno*0.3 - wash' seed2 -> top:",
  d1.topScores.slice(0, 3).map((s) => s.genre + "=" + s.score.toFixed(1)).join(" "), "residual:", d1.residual);

// weights honesty: all >=0 and sum to ~1
const wsum = d1.weights.reduce((a, x) => a + x.w, 0);
ok(d1.weights.every((x) => x.w >= 0), "all weights >= 0 (no negatives)");
ok(Math.abs(wsum - 1) < 0.01, "weights sum to ~1 (" + wsum.toFixed(4) + ")");

console.log("\n" + (fails ? fails + " FAILURES" : "ALL PASS"));
process.exit(fails ? 1 : 0);
