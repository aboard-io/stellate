// prove-matrix.test.js — gates for the OFFLINE MATRIX PROVER (engine/prove-matrix.js).
//   NODE_PATH=... node test/gates/prove-matrix.test.js
//
// Four gates:
//   1 DIFFERENTIAL — the matrix hull must agree with the hand-rolled
//     invariants.js prover on every shared dim (no WIDER: two independent
//     implementations arriving at the same bounds is the whole point; TIGHTER
//     is allowed only on dims where the hand prover folds in engine defaults
//     the specs never declare — currently exactly fx.jux).
//   2 WITNESS — seeded Monte-Carlo blends through the REAL K.mix land in-hull.
//   3 DETERMINISM — two full runs are byte-equal (no Math.random anywhere).
//   4 SENSITIVITY — the prover CAN catch a lie: a doctored state outside the
//     hull must be flagged, and a legit state must not be. A prover that can't
//     fail proves nothing.
"use strict";
const PM = require("../../engine/prove-matrix.js");
const K = require("../../engine/genre-kernel.js");
const { execFileSync } = require("child_process");
const path = require("path");

let fails = 0;
function gate(name, fn) {
  try { fn(); console.log("PASS  " + name); }
  catch (e) { fails++; console.log("FAIL  " + name + " — " + e.message); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

gate("differential: matrix hull agrees with invariants.js prove (no WIDER; TIGHTER only on default-folded dims)", () => {
  const out = execFileSync(process.execPath, [path.join(__dirname, "..", "..", "engine", "invariants.js"), "prove", "--json"], { maxBuffer: 64 * 1024 * 1024 });
  const invRows = JSON.parse(String(out)).proof.rows;
  const dv = PM.diff(invRows);
  const wider = dv.filter((r) => r.verdict === "WIDER");
  assert(wider.length === 0, "WIDER dims (one prover is wrong): " + wider.map((r) => r.dim).join(","));
  const tighter = dv.filter((r) => r.verdict === "TIGHTER").map((r) => r.dim);
  const allowed = new Set(["fx.jux"]);   // absent-anchor default 0 lives in the hand prover's hull, not the declarers'
  const unexpected = tighter.filter((d) => !allowed.has(d));
  assert(unexpected.length === 0, "unexpected TIGHTER dims (a default the table should document): " + unexpected.join(","));
  const equal = dv.filter((r) => r.verdict === "EQUAL").length;
  assert(equal >= 35, "only " + equal + " EQUAL dims — the differential lost coverage");
  console.log("      " + equal + " EQUAL, " + tighter.length + " TIGHTER (allowed), 0 WIDER over " + dv.length + " dims");
});

gate("witness: 300 seeded convex blends through K.mix, zero hull violations", () => {
  const W = PM.witness(300);
  assert(W.violations.length === 0, W.violations.length + " violations, first: " + JSON.stringify(W.violations[0]));
});

gate("determinism: two full runs byte-equal", () => {
  const a = JSON.stringify({ h: PM.hull(), w: PM.witness(60) });
  const b = JSON.stringify({ h: PM.hull(), w: PM.witness(60) });
  assert(a === b, "matrix prover output is not deterministic");
});

gate("sensitivity: a doctored out-of-hull state IS flagged; a legit state is NOT", () => {
  const legit = K.mix([{ g: "techno", w: 1 }], { seed: 5 });
  assert(PM.checkState(legit).length === 0, "legit techno state false-flagged: " + JSON.stringify(PM.checkState(legit)[0]));
  const lie = JSON.parse(JSON.stringify(legit));
  lie.reverb = 1.7;                        // hull [0.11, 1]
  lie.instruments.drums.kick = 5;          // hull [0.3, 1.8]
  const bad = PM.checkState(lie);
  const dims = bad.map((b) => b.dim);
  assert(dims.includes("fx.reverb") && dims.includes("drums.kick"),
    "doctored state not fully flagged (got: " + dims.join(",") + ") — the prover cannot catch a lie");
});

console.log(fails ? "\n" + fails + " FAILING" : "\nall green");
process.exit(fails ? 1 : 0);
