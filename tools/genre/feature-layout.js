#!/usr/bin/env node
// tools/genre/feature-layout.js — the SOUND-SPACE map layout (ROADMAP §1.4.1).
//
// Projects the measured genre centroids (the 23-D z-scored symbolic-feature
// space that genre-geometry.js exposes) down to 2D so that on-screen distance
// means "how these genres actually SOUND", not an authored guess. Emits a
// POS-shaped table ({ genre: [x, y] }) to scratch/feature-layout.json that
// app/map/starmap.js can later adopt as a toggle layout source beside its own
// computeGenreLayout (this tool does NOT touch starmap.js / world.js — it only
// writes the file).
//
// METHOD: deterministic top-2 PCA by power iteration on the centroid
// covariance (Cov = M^T M over mean-centred centroids). Cov*v is evaluated
// implicitly as M^T (M v) — never materialise the d×d matrix. PC2 is found by
// deflating the PC1 direction out of every iterate. The eigenvector SIGN is
// pinned (largest-|component| forced positive) so the projection can never
// reflect between runs; PC1→x, PC2→y is fixed. Uniform (aspect-preserving)
// scale into a positive POS-like box, rounded to a fixed precision. Every step
// is pure float math over the sorted genre list, so the emitted JSON is
// BYTE-IDENTICAL across runs.
//
// OFFLINE + READ-ONLY: imports engine/genre-geometry.js for centroids (which
// reuse the shared z-scoring — we do NOT re-derive it) and never mutates
// K.GENRES or runs during a render.
//
// CLI:
//   node tools/genre/feature-layout.js [--spot <genre>] [--k <n>] [--out <path>]
//     emits the layout and prints a determinism hash + a 2D-vs-23D
//     nearest-neighbour rank-correlation report for the spot genre.

"use strict";
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const G = require(path.join(__dirname, "..", "..", "engine", "genre-geometry.js"));

// ---- fixed, deterministic layout constants ----
const SPAN = 2000;     // logical extent of the LARGER projected axis
const MARGIN = 90;     // matches app/core/world.js WORLD_MARGIN
const DECIMALS = 2;    // emitted coordinate precision
const PI_ITERS = 400;  // power-iteration steps (fixed → deterministic)
const DEFAULT_OUT = path.join(__dirname, "..", "..", "scratch", "feature-layout.json");

function round(x) { const p = 10 ** DECIMALS; return Math.round(x * p) / p; }

// --- linear-algebra helpers over an n×d row matrix (all pure, deterministic) ---
function meanCenter(rows) {
  const n = rows.length, d = rows[0].length;
  const mean = new Array(d).fill(0);
  for (const r of rows) for (let k = 0; k < d; k++) mean[k] += r[k];
  for (let k = 0; k < d; k++) mean[k] /= n;
  const C = rows.map((r) => r.map((v, k) => v - mean[k]));
  return { C, mean };
}
function norm(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); }
function dot(a, b) { let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; return s; }

// Cov*v = M^T (M v), evaluated implicitly (never build the d×d covariance).
function covMul(C, v) {
  const n = C.length, d = C[0].length;
  const u = new Array(n);
  for (let i = 0; i < n; i++) u[i] = dot(C[i], v);       // M v  (length n)
  const w = new Array(d).fill(0);
  for (let i = 0; i < n; i++) { const r = C[i], ui = u[i]; for (let k = 0; k < d; k++) w[k] += r[k] * ui; }
  return w;                                              // M^T (M v)  (length d)
}

// pin sign so the largest-|component| is positive → no reflection between runs.
function pinSign(v) {
  let idx = 0, mx = -1;
  for (let k = 0; k < v.length; k++) { const a = Math.abs(v[k]); if (a > mx) { mx = a; idx = k; } }
  return v[idx] < 0 ? v.map((x) => -x) : v;
}

// one power-iteration eigenvector; if `deflate` (a unit vector) is given, its
// component is removed each step so we converge to the NEXT principal axis.
function powIter(C, deflate) {
  const d = C[0].length;
  let v = new Array(d);
  for (let k = 0; k < d; k++) v[k] = Math.cos(k + 1);    // fixed deterministic seed
  v = norm(v);
  for (let it = 0; it < PI_ITERS; it++) {
    let w = covMul(C, v);
    if (deflate) { const p = dot(w, deflate); for (let k = 0; k < d; k++) w[k] -= p * deflate[k]; }
    v = norm(w);
  }
  return v;
}

function pca2(C) {
  const pc1 = pinSign(powIter(C, null));
  const pc2 = pinSign(powIter(C, pc1));
  // eigenvalue ≈ v^T Cov v = |M v|^2 ; total variance = Σ|row|^2 (= trace Cov)
  const mv = (v) => C.reduce((s, r) => s + dot(r, v) ** 2, 0);
  const total = C.reduce((s, r) => s + dot(r, r), 0) || 1;
  return { pc1, pc2, ev1: mv(pc1), ev2: mv(pc2), total };
}

// ---- build the layout ----
function buildLayout() {
  const cent = G.centroids();
  const genres = Object.keys(cent).sort();               // sorted → order-stable
  const rows = genres.map((g) => cent[g]);
  const { C } = meanCenter(rows);
  const { pc1, pc2, ev1, ev2, total } = pca2(C);

  // project onto (pc1, pc2)
  const raw = C.map((r) => [dot(r, pc1), dot(r, pc2)]);
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs);
  const miny = Math.min(...ys), maxy = Math.max(...ys);
  const rangeX = maxx - minx || 1, rangeY = maxy - miny || 1;
  const s = SPAN / Math.max(rangeX, rangeY);              // uniform → distance-honest

  const POS = {};
  genres.forEach((g, i) => {
    POS[g] = [round((raw[i][0] - minx) * s + MARGIN), round((raw[i][1] - miny) * s + MARGIN)];
  });

  const meta = {
    method: "pca-power-iteration-top2",
    space: "z-scored symbolic-feature centroids (engine/genre-geometry.js)",
    dims: rows[0].length,
    genres: genres.length,
    iters: PI_ITERS,
    signConvention: "largest-abs eigenvector component forced positive; PC1->x, PC2->y",
    span: SPAN, margin: MARGIN, decimals: DECIMALS,
    varExplained: { pc1: round((ev1 / total) * 1e6) / 1e6, pc2: round((ev2 / total) * 1e6) / 1e6, sum: round(((ev1 + ev2) / total) * 1e6) / 1e6 },
  };
  return { POS, meta, genres };
}

// stable, POS-first serialisation (meta after) so the file is byte-identical.
function serialize(layout) {
  return JSON.stringify({ meta: layout.meta, POS: layout.POS }, null, 2) + "\n";
}

// ---- 2D-vs-23D nearest-neighbour rank correlation (the honesty proof) ----
function rankCorr(layout, spot, k) {
  const { POS } = layout;
  if (!POS[spot]) throw new Error("unknown/unscored genre: " + spot);
  const others = Object.keys(POS).filter((g) => g !== spot);
  // 23-D ranking straight from the shared geometry lib
  const rank23 = {}; G.nearest(spot).forEach((r, i) => { rank23[r.genre] = i; });
  // 2D ranking from the emitted layout
  const d2 = (a, b) => Math.hypot(POS[a][0] - POS[b][0], POS[a][1] - POS[b][1]);
  const by2d = others.slice().sort((a, b) => d2(spot, a) - d2(spot, b));
  const rank2d = {}; by2d.forEach((g, i) => { rank2d[g] = i; });

  // Spearman ρ over ALL other genres
  const n = others.length;
  let sumd2 = 0;
  for (const g of others) { const diff = rank2d[g] - rank23[g]; sumd2 += diff * diff; }
  const rho = 1 - (6 * sumd2) / (n * (n * n - 1));

  // overlap@k of the two nearest sets
  const top2d = new Set(by2d.slice(0, k));
  const top23 = G.nearest(spot, k).map((r) => r.genre);
  const overlap = top23.filter((g) => top2d.has(g)).length;
  return { spot, n, spearman: rho, k, overlapAtK: overlap, top23, top2d: by2d.slice(0, k) };
}

// ---- CLI ----
function argOf(flag, dflt) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : dflt; }

if (require.main === module) {
  const outPath = argOf("--out", DEFAULT_OUT);
  const k = parseInt(argOf("--k", "8"), 10);
  const layout = buildLayout();
  const text = serialize(layout);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text);
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

  const spot = argOf("--spot", layout.POS.vaporwave ? "vaporwave" : layout.genres[0]);
  const rc = rankCorr(layout, spot, k);

  console.log(`wrote ${outPath}  (${layout.genres.length} genres, sha256:${hash})`);
  console.log(`variance explained: pc1=${(layout.meta.varExplained.pc1 * 100).toFixed(1)}%  pc2=${(layout.meta.varExplained.pc2 * 100).toFixed(1)}%  sum=${(layout.meta.varExplained.sum * 100).toFixed(1)}%`);
  console.log(`rank-correlation @ ${rc.spot}: Spearman rho=${rc.spearman.toFixed(4)} over ${rc.n} genres; overlap@${k}=${rc.overlapAtK}/${k}`);
  console.log(`  23-D nearest ${k}: ${rc.top23.join(", ")}`);
  console.log(`  2D  nearest ${k}: ${rc.top2d.join(", ")}`);
}

module.exports = { buildLayout, serialize, rankCorr };
