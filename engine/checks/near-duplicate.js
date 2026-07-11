#!/usr/bin/env node
// near-duplicate.js — offline near-duplicate detector (ROADMAP §1.2.2).
//
// Two anchors are "near-duplicate" when they sit so close in the measured
// feature geometry that they are one authoring wobble away from becoming a
// confusion-matrix tie (self-score no longer strictly highest). This check
// surfaces those pairs as WARN findings BEFORE they cost a diagonal, so the
// TARGETS author can add a distinguishing fence proactively.
//
// It is pure, offline and READ-ONLY: it reads the shared feature-space geometry
// (engine/genre-geometry.js — z-scored centroids, factored out of the gate) and,
// when present, the persisted confusion/affinity matrix. It never renders during
// a real render, never mutates K.GENRES, and imports G rather than re-deriving
// z-scoring, so its geometry can never drift from validate-genres.js gateGeometry.
//
// TWO INDEPENDENT SIGNALS (a pair need only trip one to WARN):
//   1. CENTROID DISTANCE  — Euclidean distance between z-scored centroids
//      (G.dist). Smaller = closer. WARN under `distThreshold`.
//   2. MUTUAL AFFINITY    — the confusion matrix is asymmetric; cells[a][b] is
//      how well a's renders score against b's TARGET box. A pair is mutually
//      confusable only if BOTH cross-scores are high, so we take the MIN of the
//      two off-diagonal cells (the conservative, tie-predictive number). WARN
//      at/above `affinityThreshold`. Skipped silently if matrix.json is absent.
//
// This module exports a clean check(); it does NOT edit validate-genres.js — the
// Integrate phase wires check().findings in as WARNs there.
//
//   check(opts) -> { status, scored, thresholds, pairs, findings }
//     opts.topN            (default 20) closest pairs returned in `pairs`
//     opts.distThreshold   (default 2.0) centroid-distance WARN cutoff
//     opts.affinityThreshold (default 95) mutual-min affinity WARN cutoff
//     opts.useMatrix       (default true) fold in the affinity signal if cached
//   findings: [{ level:'WARN', a, b, dist, affinity, reasons:[...], note }]
//
// CLI:  node engine/checks/near-duplicate.js [topN] [--dist=N] [--aff=N] [--no-matrix]

"use strict";

const G = require("../genre-geometry.js");

const DEFAULTS = {
  topN: 20,
  distThreshold: 2.0,     // ~p1 of the pairwise-distance distribution (tuned)
  affinityThreshold: 95,  // off-diagonal this high == one wobble from a tie
  useMatrix: true,
};

// Build the asymmetric-matrix -> symmetric mutual-affinity lookup, or null when
// the confusion matrix hasn't been persisted (genre-verifier.js `matrix`).
function affinityLookup(useMatrix) {
  if (!useMatrix) return null;
  const m = G.matrix();
  if (!m || !m.genres || !m.cells) return null;
  const idx = {};
  m.genres.forEach((g, i) => (idx[g] = i));
  return function (a, b) {
    const ra = m.cells[a], rb = m.cells[b];
    if (!ra || !rb || idx[a] == null || idx[b] == null) return null;
    const ab = ra[idx[b]], ba = rb[idx[a]];
    if (typeof ab !== "number" || typeof ba !== "number") return null;
    // conservative, tie-predictive: a pair is only mutually confusable if BOTH
    // directions score high, so the MIN governs.
    return Math.min(ab, ba);
  };
}

function round(x, n) {
  const p = Math.pow(10, n);
  return Math.round(x * p) / p;
}

// The check. Returns the closest-N pairs plus any pair tripping either signal
// as a WARN finding. Deterministic: same cache + code -> identical output.
function check(opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const cent = G.centroids();
  const genres = Object.keys(cent).sort(); // stable, name-sorted iteration
  const aff = affinityLookup(o.useMatrix);

  const pairs = [];
  for (let i = 0; i < genres.length; i++) {
    for (let j = i + 1; j < genres.length; j++) {
      const a = genres[i], b = genres[j];
      const d = G.dist(a, b);
      const affinity = aff ? aff(a, b) : null;
      pairs.push({ a, b, dist: round(d, 3), affinity });
    }
  }

  // rank by geometric closeness (the primary near-duplicate signal). Ties broken
  // by name for determinism.
  pairs.sort((x, y) =>
    x.dist - y.dist || (x.a + x.b < y.a + y.b ? -1 : 1)
  );

  const findings = [];
  for (const p of pairs) {
    const reasons = [];
    if (p.dist < o.distThreshold)
      reasons.push(`centroid-dist ${p.dist} < ${o.distThreshold}`);
    if (p.affinity != null && p.affinity >= o.affinityThreshold)
      reasons.push(`mutual-affinity ${p.affinity} >= ${o.affinityThreshold}`);
    if (!reasons.length) continue;
    findings.push({
      level: "WARN",
      a: p.a,
      b: p.b,
      dist: p.dist,
      affinity: p.affinity,
      reasons,
      note:
        `near-duplicate: ${p.a} & ${p.b} (` + reasons.join("; ") +
        `) — add a distinguishing fence before it becomes a matrix tie`,
    });
  }
  // most-severe first: closest distance, then highest affinity.
  findings.sort((x, y) =>
    x.dist - y.dist || (y.affinity || 0) - (x.affinity || 0)
  );

  return {
    status: findings.length ? "WARN" : "PASS",
    scored: genres.length,
    thresholds: {
      distThreshold: o.distThreshold,
      affinityThreshold: o.affinityThreshold,
      matrix: !!aff,
    },
    pairs: pairs.slice(0, o.topN),
    findings,
  };
}

module.exports = { check, affinityLookup, DEFAULTS };

// ---- CLI ------------------------------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = {};
  for (const a of argv) {
    if (/^\d+$/.test(a)) opts.topN = parseInt(a, 10);
    else if (a.startsWith("--dist=")) opts.distThreshold = parseFloat(a.slice(7));
    else if (a.startsWith("--aff=")) opts.affinityThreshold = parseFloat(a.slice(6));
    else if (a === "--no-matrix") opts.useMatrix = false;
    else if (a === "-h" || a === "--help") {
      console.log(
        "usage: near-duplicate.js [topN] [--dist=N] [--aff=N] [--no-matrix]"
      );
      process.exit(0);
    }
  }
  const r = check(opts);
  const withAff = r.thresholds.matrix;
  console.log(
    `near-duplicate — ${r.scored} anchors, ` +
      `distThreshold=${r.thresholds.distThreshold} ` +
      `affinityThreshold=${r.thresholds.affinityThreshold} ` +
      `matrix=${withAff ? "loaded" : "absent"}`
  );
  console.log(`\nclosest ${r.pairs.length} pairs (by z-centroid distance):`);
  const affCol = (v) => (v == null ? "  -" : String(v).padStart(3));
  for (const p of r.pairs)
    console.log(
      `  ${p.a.padEnd(16)}${p.b.padEnd(16)} dist=${p.dist
        .toFixed(3)
        .padStart(6)}  aff=${affCol(p.affinity)}`
    );
  console.log(`\n[${r.status}] ${r.findings.length} near-duplicate WARN(s):`);
  for (const f of r.findings)
    console.log(
      `  WARN ${f.a.padEnd(16)}${f.b.padEnd(16)} (${f.reasons.join("; ")})`
    );
  if (!r.findings.length) console.log("  (none under thresholds)");
}
