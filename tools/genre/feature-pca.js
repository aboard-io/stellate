#!/usr/bin/env node
// feature-pca.js — dead-axis / redundancy / PCA report over the cached
// per-(genre,seed) verifier-feature matrix. (ROADMAP §1.2.7)
//
// Three views of how the 23 symbolic features actually spend their capacity:
//   1. per-feature VARIANCE  — dead axes (≈0) are wasted or silently broken.
//   2. CORRELATION matrix    — |corr|≈1 pairs are redundant axes (one fence
//                              could do the work of two).
//   3. top PCA COMPONENTS    — the real dimensionality: how many directions
//                              carry the variance, and which features load them.
//
// READ-ONLY + OFFLINE + DETERMINISTIC. The point cloud comes from
// engine/checks/dead-axis.js (same feats cache + population + feature order as
// genre-geometry.js). Standardisation reuses G.vecOf so the z-scoring math lives
// only in genre-geometry.js and can't drift from the gate. PCA is a fixed-
// iteration power method with a fixed deterministic seed — no RNG, no Date — so
// the same cache yields byte-identical output every run. Nothing is mutated.
//
//   node tools/genre/feature-pca.js [--components K] [--top N] [--dead-threshold X] [--json]
//     --components K   how many principal components to extract (default 4)
//     --top N          features to name per component / correlated pairs (default 5)
//     --dead-threshold variance below which a feature is flagged dead (default 1e-6)
//     --json           emit the full report as JSON instead of the text tables

(function () {
  "use strict";
  const path = require("path");
  const ROOT = path.join(__dirname, "..", "..");
  const G = require(path.join(ROOT, "engine", "genre-geometry.js"));
  const DA = require(path.join(ROOT, "engine", "checks", "dead-axis.js"));

  // --- deterministic linear algebra -------------------------------------------

  // covariance of the standardised (z-scored) cloud. Because G.vecOf gives each
  // live column population-mean 0 / variance 1, this covariance IS the Pearson
  // correlation matrix. Dead features z-score to all-zeros -> their row/col is 0.
  function corrMatrix(zrows, n) {
    const N = zrows.length;
    const C = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const z of zrows)
      for (let i = 0; i < n; i++) {
        const zi = z[i];
        if (zi === 0) continue;
        for (let j = i; j < n; j++) C[i][j] += zi * z[j];
      }
    for (let i = 0; i < n; i++)
      for (let j = i; j < n; j++) { C[i][j] /= N; C[j][i] = C[i][j]; }
    return C;
  }

  // fixed, deterministic non-degenerate start vector (never RNG).
  function seedVec(n) {
    const v = new Array(n);
    for (let i = 0; i < n; i++) v[i] = Math.sin(i + 1); // stable, non-uniform
    return normalize(v);
  }
  function normalize(v) {
    let s = 0; for (const x of v) s += x * x;
    s = Math.sqrt(s) || 1;
    return v.map((x) => x / s);
  }
  function matVec(M, v) {
    const n = M.length, out = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += M[i][j] * v[j]; out[i] = s; }
    return out;
  }

  // dominant eigenpair via power iteration (fixed 300 iters -> deterministic).
  function powerIter(M) {
    let v = seedVec(M.length), lambda = 0;
    for (let it = 0; it < 300; it++) {
      const w = matVec(M, v);
      const nw = Math.sqrt(w.reduce((a, x) => a + x * x, 0)) || 1;
      v = w.map((x) => x / nw);
      // Rayleigh quotient v^T M v
      const mv = matVec(M, v);
      lambda = v.reduce((a, x, i) => a + x * mv[i], 0);
    }
    // sign-canonicalise: largest-magnitude loading is positive (determinism).
    let mi = 0; for (let i = 1; i < v.length; i++) if (Math.abs(v[i]) > Math.abs(v[mi])) mi = i;
    if (v[mi] < 0) v = v.map((x) => -x);
    return { lambda, vec: v };
  }

  // top-K components by deflation (subtract lambda*vv^T after each extraction).
  function pca(C, k) {
    const n = C.length;
    const M = C.map((r) => r.slice());
    const comps = [];
    for (let c = 0; c < k; c++) {
      const { lambda, vec } = powerIter(M);
      comps.push({ lambda, vec });
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) M[i][j] -= lambda * vec[i] * vec[j];
    }
    return comps;
  }

  // --- report -----------------------------------------------------------------

  function build(opts) {
    const points = DA.loadPoints();
    const dims = DA.check({ points }).dims; // feature order
    const n = dims.length;
    const zrows = points.map((p) => G.vecOf(p.f)); // standardised in gate space
    const varReport = DA.variances(points);
    const dead = DA.check({ points, threshold: opts.deadThreshold });

    const C = corrMatrix(zrows, n);
    const comps = pca(C, Math.min(opts.components, n));
    const totalVar = comps.reduce((a, c) => a + Math.max(0, c.lambda), 0);
    // total variance in the correlation matrix == trace == count of live dims.
    const trace = C.reduce((a, r, i) => a + r[i], 0);

    // most-correlated off-diagonal pairs (redundant axes).
    const pairs = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        pairs.push({ a: dims[i], b: dims[j], corr: C[i][j] });
    pairs.sort((x, y) => Math.abs(y.corr) - Math.abs(x.corr));

    return { dims, n, points: points.length, variances: varReport, dead,
             corr: C, components: comps, trace, totalVar, topPairs: pairs, opts };
  }

  function fmt(x, w, d) { return x.toFixed(d).padStart(w); }

  function printText(r) {
    const { dims, opts } = r;
    console.log(`feature-pca  —  ${r.points} points (${G.scoredGenres().length} genres × ${G.SEEDS.length} seeds), ${r.n} features\n`);

    console.log("PER-FEATURE VARIANCE (raw, no zero-guard) — sorted ascending:");
    const byVar = dims.slice().sort((a, b) => r.variances[a] - r.variances[b]);
    for (const d of byVar)
      console.log(`  ${d.padEnd(16)} ${r.variances[d].toExponential(3)}`);
    console.log("");

    console.log(`DEAD AXES (variance < ${r.dead.threshold})  ->  ${r.dead.status}`);
    if (r.dead.dead.length)
      for (const d of r.dead.dead) console.log(`  ${d.feature.padEnd(16)} ${d.variance.toExponential(3)}`);
    else console.log("  (none)");
    console.log("");

    console.log(`TOP CORRELATED PAIRS (redundant axes), |corr| desc, first ${opts.top}:`);
    for (const p of r.topPairs.slice(0, opts.top))
      console.log(`  ${p.a.padEnd(14)} ~ ${p.b.padEnd(14)} ${fmt(p.corr, 7, 3)}`);
    console.log("");

    console.log(`TOP ${r.components.length} PCA COMPONENTS (of correlation matrix; total var = trace = ${r.trace.toFixed(2)}):`);
    r.components.forEach((c, i) => {
      const pct = (100 * c.lambda / r.trace);
      const load = c.vec
        .map((w, j) => ({ f: dims[j], w }))
        .sort((a, b) => Math.abs(b.w) - Math.abs(a.w))
        .slice(0, opts.top)
        .map((L) => `${L.f}${L.w >= 0 ? "+" : "-"}${Math.abs(L.w).toFixed(2)}`)
        .join("  ");
      console.log(`  PC${i + 1}  eig=${c.lambda.toFixed(3)}  ${pct.toFixed(1)}% var  |  ${load}`);
    });
    const cum = r.components.reduce((a, c) => a + Math.max(0, c.lambda), 0);
    console.log(`  cumulative: ${(100 * cum / r.trace).toFixed(1)}% of variance in ${r.components.length} components`);
  }

  // --- cli --------------------------------------------------------------------

  function parseArgs(argv) {
    const o = { components: 4, top: 5, deadThreshold: DA.DEFAULT_THRESHOLD, json: false };
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--components") o.components = parseInt(argv[++i], 10);
      else if (a === "--top") o.top = parseInt(argv[++i], 10);
      else if (a === "--dead-threshold") o.deadThreshold = parseFloat(argv[++i]);
      else if (a === "--json") o.json = true;
    }
    return o;
  }

  const api = { build, pca, corrMatrix, powerIter };
  module.exports = api;

  if (require.main === module) {
    const opts = parseArgs(process.argv.slice(2));
    const r = build(opts);
    if (opts.json) {
      console.log(JSON.stringify({
        dims: r.dims, points: r.points, variances: r.variances,
        dead: r.dead, trace: r.trace, topPairs: r.topPairs.slice(0, opts.top),
        components: r.components.map((c) => ({ lambda: c.lambda, vec: c.vec })),
      }, null, 2));
    } else {
      printText(r);
    }
  }
})();
