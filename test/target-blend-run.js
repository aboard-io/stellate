#!/usr/bin/env node
// test/target-blend-run.js — proves tools/target-blend.js:
//   (1) round-trip: request an anchor's own feature vector -> pure-anchor weights;
//   (2) determinism: same request+seed twice -> byte-identical weights;
//   (3) descent: on a genuine blend target the objective decreases monotonically;
//   (4) read-only: K.GENRES keys+order are unchanged after solving.
"use strict";
const K = require("../engine/genre-kernel.js");
const V = require("../engine/genre-verifier.js");
const { solve } = require("../tools/target-blend.js");

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

const genresBefore = Object.keys(K.GENRES).join(",");

// (1) round-trip: recover pure-anchor weights + tiny residual.
for (const g of ["jungle", "techno", "breakcore", "ambient"]) {
  const r = solve({ features: V.features(K.track(g, { seed: 1 })) }, { seed: 1 });
  const pure = r.weights.length === 1 && r.weights[0].g === g && r.weights[0].w === 1;
  ok(pure && r.residual < 1e-6 && r.best === g,
     `round-trip ${g}: w=${JSON.stringify(r.weights)} best=${r.best} resid=${r.residual}`);
}

// (2) determinism.
const req = { scores: { jungle: 0.8, gospel: 0.2 } };
const w1 = JSON.stringify(solve(req, { seed: 7 }).weights);
const w2 = JSON.stringify(solve(req, { seed: 7 }).weights);
ok(w1 === w2, `determinism scores: ${w1}`);

const tgt = { features: V.features(K.mix([{ g: "techno", w: 0.5 }, { g: "gospel", w: 0.5 }], { seed: 3 })) };
const f1 = JSON.stringify(solve(tgt, { seed: 3, k: 10 }).weights);
const f2 = JSON.stringify(solve(tgt, { seed: 3, k: 10 }).weights);
ok(f1 === f2, "determinism features");

// (3) descent monotonic + strictly improves on a real blend target.
const rd = solve(tgt, { seed: 3, k: 10 });
const mono = rd.trace.every((v, i) => i === 0 || v <= rd.trace[i - 1] + 1e-12);
ok(mono && rd.iterations > 0 && rd.residual < rd.initialObjective,
   `descent: ${rd.initialObjective} -> ${rd.residual} in ${rd.iterations} iters`);

// (4) read-only.
ok(Object.keys(K.GENRES).join(",") === genresBefore, "K.GENRES unmutated");

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL PASS");
process.exit(fails ? 1 : 0);
