#!/usr/bin/env node
// test for engine/checks/near-duplicate.js — narrow + fast (no full matrix run).
"use strict";
const assert = require("assert");
const ND = require("../../engine/checks/near-duplicate.js");

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, "FAIL: " + name);
  console.log("  ok - " + name);
  pass++;
}

// 1. shape + determinism
const r1 = ND.check();
const r2 = ND.check();
ok("returns pairs + findings arrays", Array.isArray(r1.pairs) && Array.isArray(r1.findings));
ok("deterministic across calls (byte-identical JSON)",
   JSON.stringify(r1) === JSON.stringify(r2));
ok("scored == 249 anchors", r1.scored === 249);

// 2. pairs are sorted ascending by distance
let sorted = true;
for (let i = 1; i < r1.pairs.length; i++)
  if (r1.pairs[i].dist < r1.pairs[i - 1].dist) sorted = false;
ok("closest pairs sorted ascending by centroid distance", sorted);

// 3. historically-confusable pairs surface (unordered pair membership)
const pk = (p) => [p.a, p.b].sort().join("|");
const top = new Set(r1.pairs.map(pk));
for (const [a, b] of [["deephouse", "amapiano"], ["techno", "ikeacore"], ["ska", "surfrock"]])
  ok(`confusable pair surfaces in closest list: ${a}/${b}`,
     top.has([a, b].sort().join("|")));

// 4. threshold logic: every finding trips at least one signal; status reflects count
ok("every finding carries >=1 reason", r1.findings.every((f) => f.reasons.length >= 1));
ok("status WARN when findings exist", r1.status === (r1.findings.length ? "WARN" : "PASS"));

// 5. tightening distThreshold cannot ADD distance-only findings (monotone)
const tight = ND.check({ distThreshold: 1.5, affinityThreshold: 200 });
const loose = ND.check({ distThreshold: 2.0, affinityThreshold: 200 });
ok("tighter dist threshold -> fewer/equal dist-only findings",
   tight.findings.length <= loose.findings.length);
ok("affinityThreshold=200 (unreachable) yields dist-only reasons",
   loose.findings.every((f) => f.reasons.every((s) => s.startsWith("centroid-dist"))));

// 6. matrix-off path still runs and produces null affinities
const noMat = ND.check({ useMatrix: false });
ok("--no-matrix: thresholds.matrix === false", noMat.thresholds.matrix === false);
ok("--no-matrix: all pair affinities null", noMat.pairs.every((p) => p.affinity === null));

// 7. clean PASS when both signals are made unreachable
const clean = ND.check({ distThreshold: 0, affinityThreshold: 999 });
ok("unreachable thresholds -> PASS, zero findings",
   clean.status === "PASS" && clean.findings.length === 0);

console.log(`\n${pass} assertions passed`);
console.log("\nclosest 6 (proof):");
for (const p of r1.pairs.slice(0, 6))
  console.log(`  ${p.a.padEnd(16)}${p.b.padEnd(16)} dist=${p.dist.toFixed(3)} aff=${p.affinity}`);
