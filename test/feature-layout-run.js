#!/usr/bin/env node
// test/feature-layout-run.js — proves tools/feature-layout.js is (1) byte-
// identical across runs and (2) that its 2D neighbourhood rank-correlates with
// the 23-D centroid neighbourhood for a spread of spot genres.
"use strict";
const path = require("path");
const FL = require(path.join(__dirname, "..", "tools", "feature-layout.js"));

const a = FL.serialize(FL.buildLayout());
const b = FL.serialize(FL.buildLayout());
const identical = a === b;
console.log("byte-identical across two builds:", identical);
if (!identical) { console.error("FAIL: layout not deterministic"); process.exit(1); }

const layout = FL.buildLayout();
const spots = ["vaporwave", "jazz", "ambient", "dancepop", "blues"].filter((g) => layout.POS[g]);
let sum = 0;
for (const g of spots) {
  const rc = FL.rankCorr(layout, g, 10);
  console.log(`${g.padEnd(11)} spearman=${rc.spearman.toFixed(4)}  overlap@10=${rc.overlapAtK}/10`);
  sum += rc.spearman;
}
const mean = sum / spots.length;
console.log("mean spearman:", mean.toFixed(4));

const ok = identical && mean > 0.6;      // strong global rank agreement
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
