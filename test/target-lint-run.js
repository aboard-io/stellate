#!/usr/bin/env node
// test for tools/target-lint.js — narrow, fast, deterministic (no full matrix).
"use strict";
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const TL = require(path.join(ROOT, "tools", "target-lint.js"));

function assert(c, m) { if (!c) { console.error("FAIL: " + m); process.exit(1); } console.log("ok - " + m); }

// 1. a genre whose renders sit inside its box yields NO (a)-flag.
const techno = TL.lintGenre("techno");
assert(techno.flagsA === 0, "techno (in-box) has zero exclude-flags");
assert(TL.lintGenre("ambient").flagsA === 0, "ambient (in-box) has zero exclude-flags");

// 2. a genre whose renders leak past its box DOES get an (a)-flag.
const jungle = TL.lintGenre("jungle");
assert(jungle.flagsA > 0, "jungle (leaky) has >=1 exclude-flag");

// 3. every (a)-flagged fence actually has own outside the box.
for (const fe of jungle.fences) {
  if (!fe.flagA) continue;
  const [lo, hi] = fe.box, [omn, omx] = fe.own;
  assert(omn < lo - 1e-9 || omx > hi + 1e-9, `jungle.${fe.feature} own truly outside box`);
}

// 4. suggested box always contains the genre's own [min,max] (never re-excludes).
for (const g of ["techno", "vaporwave", "jungle", "surfrock"]) {
  for (const fe of TL.lintGenre(g).fences) {
    const [smn, smx] = fe.suggest, [omn, omx] = fe.own;
    assert(smn <= omn + 1e-9 && smx >= omx - 1e-9, `${g}.${fe.feature} suggestion contains own spread`);
  }
}

// 5. determinism: two lints of the same genre are byte-identical.
assert(JSON.stringify(TL.lintGenre("vaporwave")) === JSON.stringify(TL.lintGenre("vaporwave")),
  "lintGenre is deterministic");

console.log("\nALL PASS (" + TL.scoredGenres().length + " scored genres, seeds " + TL.SEEDS.join(",") + ")");
