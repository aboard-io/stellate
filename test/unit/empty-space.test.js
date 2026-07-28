#!/usr/bin/env node
// test/unit/empty-space.test.js — fast unit test for tools/genre/empty-space.js.
// Narrow (small cloud), deterministic. Not the full matrix.
"use strict";
const assert = require("assert");
const ES = require("../../tools/genre/empty-space.js");

const OPT = { seed: 7, n: 40, maxParents: 3 };
let pass = 0;
function ok(name, cond) { assert.ok(cond, "FAIL: " + name); console.log("  ok  " + name); pass++; }

// 1. determinism: same {seed,n,maxParents} => byte-identical JSON on all 3 verbs.
const e1 = JSON.stringify(ES.envelope(OPT));
const e2 = JSON.stringify(ES.envelope(OPT));
ok("envelope deterministic", e1 === e2);
const r1 = JSON.stringify(ES.regions(OPT));
const r2 = JSON.stringify(ES.regions(OPT));
ok("regions deterministic", r1 === r2);
const t = { bpm: 130, wash: 0.2 };
const c1 = JSON.stringify(ES.classify(t, OPT));
const c2 = JSON.stringify(ES.classify(t, OPT));
ok("classify deterministic", c1 === c2);

// 2. a different seed gives a different cloud (the PRNG actually varies).
ok("seed changes cloud", JSON.stringify(ES.envelope({ ...OPT, seed: 8 })) !== e1);

// 3. envelope sanity: min<=median<=max per feature, bpm plausibly bounded.
const env = ES.envelope(OPT).envelope;
let mono = true;
for (const d in env) if (!(env[d].min <= env[d].median && env[d].median <= env[d].max)) mono = false;
ok("envelope min<=median<=max", mono);
ok("bpm envelope within sane music range", env.bpm.min >= 20 && env.bpm.max <= 400);

// 4. HONESTY: a target far above the envelope max => needs-new-vocabulary.
const hi = ES.classify({ bpm: env.bpm.max + 500 }, OPT);
ok("out-of-envelope => needs-new-vocabulary", hi.verdict === "needs-new-vocabulary");
ok("  and flags the offending dim", hi.perFeature.bpm.label === "above-envelope" && hi.perFeature.bpm.residual > 0);

// 5. a target at the envelope median of two axes must be inside (reachable).
const inside = ES.classify({ bpm: env.bpm.median, wash: env.wash.median }, OPT);
ok("median target inside envelope", inside.perFeature.bpm.label !== "above-envelope" && inside.perFeature.bpm.label !== "below-envelope");
ok("reachable verdict returns starter weights", inside.nearestBlend && Array.isArray(inside.nearestBlend.weights) && inside.nearestBlend.weights.length >= 1);

// 6. regions: emptiest cells are ranked deepest-void-first and each names neighbours.
const reg = ES.regions({ ...OPT, bins: 6, top: 5 });
let ranked = true, hasNbrs = true;
for (const pg of reg.pairs) {
  for (let i = 1; i < pg.empties.length; i++)
    if (pg.empties[i - 1].voidDepth < pg.empties[i].voidDepth) ranked = false;
  for (const c of pg.empties) if (!c.neighbors || !c.neighbors.length) hasNbrs = false;
}
ok("empty cells ranked deepest-void-first", ranked);
ok("every empty cell names neighbour anchors", hasNbrs);

// 7. unknown feature name is reported, not silently dropped.
const unk = ES.classify({ notAFeature: 1 }, OPT);
ok("unknown feature => unknown-features verdict", unk.verdict === "unknown-features" && unk.unknownFeatures.indexOf("notAFeature") >= 0);

// 8. READ-ONLY law: GENRES key set + order unchanged after all the sampling.
const K = require("../../engine/genre-kernel.js");
const before = Object.keys(K.GENRES);
ES.regions(OPT); ES.classify(t, OPT);
const after = Object.keys(K.GENRES);
ok("GENRES untouched (key order preserved)", before.length === after.length && before.every((k, i) => k === after[i]));

console.log(`\nempty-space: ${pass} checks passed`);
