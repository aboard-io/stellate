#!/usr/bin/env node
// tools/genre/cross-metric-audit.js — CROSS-METRIC RECONCILIATION AUDIT (ROADMAP §1.4.6).
//
// The catalog has three independent notions of "how close are two genres?" and
// they do NOT have to agree. This tool correlates all three over every genre
// pair and reports the biggest DISAGREEMENTS — the places where the map lies
// about how genres actually sound.
//
//   (1) CONFUSION / AFFINITY  — engine/genre-geometry.js matrix(): how much
//       genre A's rendered output scores against genre B's target box (and vice
//       versa). High = the verifier confuses them. Symmetrised per pair.
//   (2) ANCHOR-JACCARD        — engine/genre-sim.js genreSim(a,b): weighted
//       Jaccard over the DECLARED material (progressions + synth/sampler pools +
//       drum kits + form + bpm) — the same _genreSim that lays out the star map.
//   (3) FEATURE-LAYOUT 2D     — tools/genre/feature-layout.js buildLayout(): the PCA
//       projection of the measured 23-D centroids to (x,y). 2D euclidean
//       distance = on-screen adjacency of the honest sound-space map.
//
// METHOD: each metric is turned into a per-pair CLOSENESS rank in [0,1]
// (1 = the closest pair in the catalog, 0 = the farthest) via average-tie
// ranking, so the three unit-incompatible scales become directly comparable.
// Disagreement is then just the difference of closeness ranks. We also print
// the Spearman rho between each metric pair (Pearson on the same ranks) as a
// one-number "how much do these two agree at all" summary.
//
// OFFLINE + READ-ONLY + DETERMINISTIC: reads K.GENRES via genre-sim, the
// persisted confusion matrix, and the deterministic PCA layout. No Date.now,
// no Math.random, no mutation of GENRES, never runs during a render. Same
// catalog + same cache -> byte-identical report.
//
// CLI:
//   node tools/genre/cross-metric-audit.js [--top N] [--focus <genre>] [--json]
//     --top N     rows per disagreement table (default 12)
//     --focus g   only pairs touching genre g (ranks still global)
//     --json      emit the full machine-readable report instead of the text one

"use strict";
const path = require("path");
const G = require(path.join(__dirname, "..", "..", "engine", "genre-geometry.js"));
const S = require(path.join(__dirname, "..", "..", "engine", "genre-sim.js"));
const K = require(path.join(__dirname, "..", "..", "engine", "genre-kernel.js"));
const FL = require(path.join(__dirname, "feature-layout.js"));

// ---- average-tie ranks (1..N); ties share the mean of their rank span ----
function avgRanks(vals) {
  const n = vals.length;
  const order = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => vals[a] - vals[b] || a - b); // stable tiebreak by index
  const rank = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && vals[order[j + 1]] === vals[order[i]]) j++;
    const r = (i + j) / 2 + 1; // mean of ranks [i+1 .. j+1]
    for (let k = i; k <= j; k++) rank[order[k]] = r;
    i = j + 1;
  }
  return rank;
}

// Pearson correlation (fed ranks -> Spearman rho).
function pearson(x, y) {
  const n = x.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy) || 1;
  return sxy / d;
}

// Build the aligned per-pair table for all three metrics.
function buildPairs() {
  const layout = FL.buildLayout();     // { POS:{g:[x,y]}, genres, meta }
  const POS = layout.POS;
  const M = G.matrix();                // { genres, cells:{g:[...]}, ... }
  if (!M) throw new Error("no confusion matrix at scratch/.verify-cache/matrix.json — build it first (genre-verifier matrix)");
  const idx = {}; M.genres.forEach((g, i) => (idx[g] = i));

  // common set: sorted for determinism; present in layout + matrix + kernel.
  const genres = Object.keys(POS)
    .filter((g) => M.cells[g] && K.GENRES[g])
    .sort();

  const d2 = (a, b) => Math.hypot(POS[a][0] - POS[b][0], POS[a][1] - POS[b][1]);
  const conf = (a, b) => (M.cells[a][idx[b]] + M.cells[b][idx[a]]) / 2; // symmetrise

  const pairs = [];
  for (let i = 0; i < genres.length; i++)
    for (let j = i + 1; j < genres.length; j++) {
      const a = genres[i], b = genres[j];
      pairs.push({
        a, b,
        confAff: conf(a, b),   // higher = more confusable  (closer)
        jac: S.genreSim(a, b), // higher = more alike        (closer)
        lay2d: d2(a, b),       // lower  = adjacent on map   (closer)
      });
    }
  return { pairs, genres, layoutMeta: layout.meta };
}

// Attach closeness ranks in [0,1] (1 = closest pair) for each metric.
function withCloseness(pairs) {
  const N = pairs.length;
  const rConf = avgRanks(pairs.map((p) => p.confAff)); // higher val -> higher rank -> closer
  const rJac = avgRanks(pairs.map((p) => p.jac));
  const rLay = avgRanks(pairs.map((p) => p.lay2d));    // higher val -> farther -> invert
  const to01 = (r) => (r - 1) / (N - 1 || 1);
  pairs.forEach((p, i) => {
    p.cConf = to01(rConf[i]);
    p.cJac = to01(rJac[i]);
    p.cLay = 1 - to01(rLay[i]); // invert distance -> closeness
    p.spread = Math.max(p.cConf, p.cJac, p.cLay) - Math.min(p.cConf, p.cJac, p.cLay);
  });
  return { rConf, rJac, rLay };
}

function analyze() {
  const { pairs, genres, layoutMeta } = buildPairs();
  const { rConf, rJac, rLay } = withCloseness(pairs);
  // Spearman = Pearson on ranks. For layout (distance) flip so all three mean
  // "closeness rank" and positive rho = agreement.
  const N = pairs.length;
  const rLayClose = rLay.map((r) => N + 1 - r);
  const spearman = {
    conf_jac: pearson(rConf, rJac),
    conf_layout: pearson(rConf, rLayClose),
    jac_layout: pearson(rJac, rLayClose),
  };
  return { pairs, genres, layoutMeta, spearman, nPairs: N };
}

// ---- disagreement selectors (each returns the pairs sorted worst-first) ----
function topBy(pairs, keyFn, top, focus) {
  let ps = pairs;
  if (focus) ps = ps.filter((p) => p.a === focus || p.b === focus);
  return ps
    .map((p) => ({ p, d: keyFn(p) }))
    .sort((x, y) => y.d - x.d || cmpPair(x.p, y.p))
    .slice(0, top)
    .map((r) => r.p);
}
function cmpPair(x, y) { return (x.a + x.b < y.a + y.b) ? -1 : 1; } // deterministic tiebreak

function fmtPair(p) {
  return `${(p.a + " + " + p.b).padEnd(30)}` +
    ` conf=${p.cConf.toFixed(2)} jac=${p.cJac.toFixed(2)} map=${p.cLay.toFixed(2)}` +
    `  (aff=${p.confAff.toFixed(0)} sim=${p.jac.toFixed(2)} d2=${p.lay2d.toFixed(0)})`;
}

function report(top, focus) {
  const A = analyze();
  const L = [];
  L.push(`CROSS-METRIC RECONCILIATION AUDIT  —  ${A.genres.length} genres, ${A.nPairs} pairs`);
  if (focus) L.push(`focus: ${focus}  (closeness ranks are still global)`);
  L.push(`layout variance explained: pc1+pc2 = ${(A.layoutMeta.varExplained.sum * 100).toFixed(1)}%`);
  L.push("");
  L.push("Spearman rho between the three closeness rankings (1 = perfect agreement):");
  L.push(`  confusion  vs jaccard : ${A.spearman.conf_jac.toFixed(4)}`);
  L.push(`  confusion  vs layout  : ${A.spearman.conf_layout.toFixed(4)}`);
  L.push(`  jaccard    vs layout  : ${A.spearman.jac_layout.toFixed(4)}`);
  L.push("");
  L.push("closeness columns: conf=verifier-confusion  jac=declared-material  map=2D-layout   (1=closest pair, 0=farthest)");
  L.push("raw columns:       aff=symmetrised affinity 0-100   sim=weighted-jaccard   d2=2D map distance");
  L.push("");

  const sections = [
    ["[A] BIGGEST 3-WAY DISAGREEMENT  (max spread across all three metrics)",
      (p) => p.spread],
    ["[B] ADJACENT ON THE MAP, DISTANT IN SOUND-MATERIAL  (map says close, jaccard says far)",
      (p) => p.cLay - p.cJac],
    ["[C] CONFUSION-RIVALS THE MAP SPLITS APART  (verifier confuses them, layout puts them far)",
      (p) => p.cConf - p.cLay],
    ["[D] SOUND-ALIKE MATERIAL THE VERIFIER CALLS DISTINCT  (jaccard says close, confusion says far)",
      (p) => p.cJac - p.cConf],
  ];
  for (const [title, key] of sections) {
    L.push(title);
    for (const p of topBy(A.pairs, key, top, focus)) L.push("  " + fmtPair(p));
    L.push("");
  }
  return L.join("\n");
}

function jsonReport(top, focus) {
  const A = analyze();
  const pick = (key) => topBy(A.pairs, key, top, focus).map((p) => ({
    a: p.a, b: p.b, confAff: p.confAff, jac: p.jac, lay2d: p.lay2d,
    cConf: p.cConf, cJac: p.cJac, cLay: p.cLay, spread: p.spread,
  }));
  return JSON.stringify({
    genres: A.genres.length, pairs: A.nPairs, focus: focus || null,
    varExplained: A.layoutMeta.varExplained.sum,
    spearman: A.spearman,
    disagreements: {
      threeWay: pick((p) => p.spread),
      mapCloseSoundFar: pick((p) => p.cLay - p.cJac),
      confusionRivalsMapSplits: pick((p) => p.cConf - p.cLay),
      soundAlikeVerifierSplits: pick((p) => p.cJac - p.cConf),
    },
  }, null, 2);
}

function argOf(flag, dflt) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : dflt; }

if (require.main === module) {
  const top = parseInt(argOf("--top", "12"), 10) || 12;
  const focus = argOf("--focus", null);
  const asJson = process.argv.includes("--json");
  console.log(asJson ? jsonReport(top, focus) : report(top, focus));
}

module.exports = { buildPairs, withCloseness, analyze, report, jsonReport, avgRanks, pearson };
