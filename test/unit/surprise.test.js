#!/usr/bin/env node
// test/unit/surprise.test.js — proves tools/genre/surprise.js (ROADMAP §1.3.3):
//   1. the returned blend's min-centroid novelty EXCEEDS the bar (the loneliest
//      single anchor render) — i.e. it is more distinct than any anchor.
//   2. it clears the musicality floor (Mus.audit overall >= floor).
//   3. the weights are PLAYABLE (K.mix renders + E.buildEvents yields events).
//   4. it is DETERMINISTIC per seed (two calls => identical result).
//   5. climb mode never lowers novelty below the pair seed.
const assert = require("assert");
const { surprise } = require("../../tools/genre/surprise.js");
const K = require("../../engine/genre-kernel.js");
const E = require("../../engine/csd-engine.js");

function checkOne(seed) {
  const r = surprise({ seed });
  assert(r.ok, "seed " + seed + ": should find a blend");
  // (1) novelty exceeds the bar
  assert(r.novelty > r.bar, "seed " + seed + ": novelty " + r.novelty + " must exceed bar " + r.bar);
  assert(r.exceedsBar === true, "seed " + seed + ": exceedsBar flag");
  assert(r.residual < 0, "seed " + seed + ": residual must be negative (beat the bar)");
  // (2) musicality floor
  assert(r.musicality.overall >= r.floor - 1e-9, "seed " + seed + ": overall >= floor");
  // (3) playable: render + events
  const state = K.mix(r.weights, { seed });
  const ev = E.buildEvents(state);
  const nEv = (ev.pitched || []).length + (ev.drums || []).length + (ev.found || []).length + (ev.sfx || []).length;
  assert(nEv > 0, "seed " + seed + ": blend must render events");
  // (4) determinism
  const r2 = surprise({ seed });
  assert.deepStrictEqual(r.weights, r2.weights, "seed " + seed + ": weights deterministic");
  assert.strictEqual(r.novelty, r2.novelty, "seed " + seed + ": novelty deterministic");
  console.log("seed " + seed + ": " + r.weights.map((x) => x.g + " " + x.w.toFixed(2)).join("+") +
    "  novelty " + r.novelty.toFixed(3) + " > bar " + r.bar.toFixed(3) +
    "  overall " + r.musicality.overall.toFixed(3) + " (" + r.musicality.verdict + ")" +
    "  events " + nEv + "  OK");
  return r;
}

console.log("== pair mode (default) ==");
const a = checkOne(1);
const b = checkOne(2);
assert(!(a.weights.length === b.weights.length &&
  a.weights.every((w, i) => w.g === b.weights[i].g && w.w === b.weights[i].w)),
  "distinct seeds should be able to pick distinct blends");

console.log("== climb mode ==");
const c = surprise({ seed: 1, mode: "climb" });
assert(c.ok && c.novelty > c.bar, "climb still beats bar");
assert(c.musicality.overall >= c.floor - 1e-9, "climb clears floor");
const seedPair = surprise({ seed: 1, mode: "pair" });
assert(c.novelty >= seedPair.novelty - 1e-9, "climb novelty >= its pair seed");
console.log("climb: " + c.weights.map((x) => x.g + " " + x.w.toFixed(2)).join("+") +
  "  novelty " + c.novelty.toFixed(3) + " (pair seed " + seedPair.novelty.toFixed(3) +
  ", +" + (c.climbed || 0) + " steps)  overall " + c.musicality.overall.toFixed(3) + "  OK");

console.log("\nALL ASSERTIONS PASSED");
