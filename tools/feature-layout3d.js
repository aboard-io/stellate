#!/usr/bin/env node
// tools/feature-layout3d.js — the 3D STAR-CRUISE coordinate system.
//
// Turns the measured genre feature space into a real 3D coordinate system that
// the star-cruise flight mode flies through: each genre becomes a planet at a
// fixed [x,y,z]; nearby in 3D == similar sounding; the camera derives blend
// weights from its distance to each planet. Emits a browser ES module
// app/starcruise/genre-coords.js:
//
//   export const GENRE_COORDS = { techno:[x,y,z], ... };   // all 249 genres
//   export const COORDS_META  = { method, extent, ... };
//
// METHOD (two candidates, the better-separating one is chosen deterministically):
//
//   (A) "pca-power-iteration-top3" — top-3 PCA by power iteration on the
//       centroid covariance (Cov = M^T M over mean-centred z-scored centroids),
//       exactly the feature-layout.js math extended to a 3rd deflated axis.
//       Classical double-centred MDS on the *Euclidean centroid distance
//       matrix* is mathematically identical to this, so we do not compute it
//       twice; PCA-top3 IS that MDS.
//
//   (B) "mds-confusion-top3" — classical (double-centred) MDS to 3D on the
//       persisted anchor confusion/affinity matrix (genre-geometry.matrix()),
//       an INDEPENDENT similarity source: how often the verifier actually
//       confuses two genres. Affinities (7..100, self=100) are symmetrised and
//       turned into distances d = 100 - affinity; B = -1/2 J D^2 J is
//       eigendecomposed to its top-3 axes by power iteration.
//
// Both are deterministic: sorted genre list, fixed iteration counts, and a
// pinned eigenvector sign convention (largest-|component| forced positive) so
// no axis can reflect between runs. The winner is selected by NEIGHBOR
// FIDELITY to the true 23-D centroid nearest-neighbours (mean Spearman rho +
// overlap@k over a fixed probe set) — the honest "nearby-in-3D is
// similar-sounding" score. Coordinates are uniformly (aspect-preserving)
// scaled+centred into a cube of half-extent EXTENT about the origin, rounded
// to a fixed precision, so the emitted module is BYTE-IDENTICAL across runs.
//
// OFFLINE + READ-ONLY: imports engine/genre-geometry.js for centroids + matrix
// (reusing the shared z-scoring); never mutates K.GENRES, never runs during a
// render, and only ever WRITES app/starcruise/genre-coords.js.
//
// CLI:
//   node tools/feature-layout3d.js [--method pca|mds|auto] [--k <n>]
//                                  [--spot <genre>] [--out <path>]
//     builds the winning embedding, writes the module, and prints the method
//     choice, per-axis variance, example 3D neighborhoods vs the true-feature
//     neighbors, and a determinism hash.

"use strict";
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const G = require(path.join(__dirname, "..", "engine", "genre-geometry.js"));

// ---- fixed, deterministic layout constants ----
const EXTENT = 100;    // half-extent of the target cube (coords in [-100, 100])
const DECIMALS = 3;    // emitted coordinate precision
const PI_ITERS = 500;  // covariance power-iteration steps (PCA)
const MDS_ITERS = 600; // symmetric-eigen power-iteration steps (MDS)
const DEFAULT_OUT = path.join(__dirname, "..", "app", "starcruise", "genre-coords.js");

// probe genres for the fidelity selection + report (only those present are used)
const PROBE = ["techno", "house", "ambient", "gabber", "vaporwave", "bossanova",
  "industrial", "jungle", "bebop", "downtempo", "sovietwave", "dub"];

function round(x) { const p = 10 ** DECIMALS; return Math.round(x * p) / p; }

// --- generic linear-algebra helpers (pure, deterministic) ---
function norm(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); }
function dot(a, b) { let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; return s; }

function meanCenter(rows) {
  const n = rows.length, d = rows[0].length;
  const mean = new Array(d).fill(0);
  for (const r of rows) for (let k = 0; k < d; k++) mean[k] += r[k];
  for (let k = 0; k < d; k++) mean[k] /= n;
  return rows.map((r) => r.map((v, k) => v - mean[k]));
}

// Cov*v = M^T (M v), evaluated implicitly (never build the d×d covariance).
function covMul(C, v) {
  const n = C.length, d = C[0].length;
  const u = new Array(n);
  for (let i = 0; i < n; i++) u[i] = dot(C[i], v);
  const w = new Array(d).fill(0);
  for (let i = 0; i < n; i++) { const r = C[i], ui = u[i]; for (let k = 0; k < d; k++) w[k] += r[k] * ui; }
  return w;
}

// pin sign so the largest-|component| is positive → no reflection between runs.
function pinSign(v) {
  let idx = 0, mx = -1;
  for (let k = 0; k < v.length; k++) { const a = Math.abs(v[k]); if (a > mx) { mx = a; idx = k; } }
  return v[idx] < 0 ? v.map((x) => -x) : v;
}

// power-iteration eigenvector of Cov=M^T M; `deflate` = list of unit vectors to
// project out each step so we converge to the next principal axis.
function powIterCov(C, deflate) {
  const d = C[0].length;
  let v = new Array(d);
  for (let k = 0; k < d; k++) v[k] = Math.cos(k + 1);   // fixed deterministic seed
  v = norm(v);
  for (let it = 0; it < PI_ITERS; it++) {
    let w = covMul(C, v);
    for (const u of deflate) { const p = dot(w, u); for (let k = 0; k < d; k++) w[k] -= p * u[k]; }
    v = norm(w);
  }
  return v;
}

// ---- Method A: top-3 PCA of the z-scored centroids ----
function pca3(rows) {
  const C = meanCenter(rows);
  const pc1 = pinSign(powIterCov(C, []));
  const pc2 = pinSign(powIterCov(C, [pc1]));
  const pc3 = pinSign(powIterCov(C, [pc1, pc2]));
  const mv = (v) => C.reduce((s, r) => s + dot(r, v) ** 2, 0);   // eigenvalue ≈ |M v|^2
  const total = C.reduce((s, r) => s + dot(r, r), 0) || 1;       // trace Cov
  const coords = C.map((r) => [dot(r, pc1), dot(r, pc2), dot(r, pc3)]);
  return {
    coords,
    varExplained: [mv(pc1) / total, mv(pc2) / total, mv(pc3) / total],
    method: "pca-power-iteration-top3",
  };
}

// ---- Method B: classical MDS to 3D on the confusion/affinity matrix ----
// symmetric n×n matrix-vector product.
function symMul(B, v) {
  const n = B.length, w = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { const Bi = B[i]; let s = 0; for (let j = 0; j < n; j++) s += Bi[j] * v[j]; w[i] = s; }
  return w;
}
// top-k eigenpairs of a symmetric matrix via deflated power iteration.
function symEig(B, k) {
  const n = B.length, vecs = [], vals = [];
  for (let e = 0; e < k; e++) {
    let v = new Array(n);
    for (let i = 0; i < n; i++) v[i] = Math.cos(i + 1 + e * 7);  // fixed deterministic seed
    v = norm(v);
    for (let it = 0; it < MDS_ITERS; it++) {
      let w = symMul(B, v);
      for (const u of vecs) { const p = dot(w, u); for (let i = 0; i < n; i++) w[i] -= p * u[i]; }
      v = norm(w);
    }
    const lambda = dot(v, symMul(B, v));
    vecs.push(pinSign(v)); vals.push(lambda);
  }
  return { vecs, vals };
}
function mds3Confusion(genres) {
  const m = G.matrix();
  if (!m) return null;
  const idx = {}; m.genres.forEach((g, i) => { idx[g] = i; });
  const n = genres.length;
  // symmetrised affinity → distance D = 100 - aff; D2 = D^2
  const D2 = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const ai = idx[genres[i]], aj = idx[genres[j]];
    const aff = (m.cells[genres[i]][aj] + m.cells[genres[j]][ai]) / 2;
    const d = 100 - aff; D2[i][j] = d * d;
  }
  // double-centre: B = -1/2 J D2 J, J = I - 11^T/n
  const rowM = D2.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const grand = rowM.reduce((a, b) => a + b, 0) / n;
  const B = Array.from({ length: n }, (_, i) => new Array(n));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    B[i][j] = -0.5 * (D2[i][j] - rowM[i] - rowM[j] + grand);
  const { vecs, vals } = symEig(B, 3);
  const coords = [];
  for (let i = 0; i < n; i++) coords.push(vecs.map((vec, a) => vec[i] * Math.sqrt(Math.max(0, vals[a]))));
  const traceB = (() => { let t = 0; for (let i = 0; i < n; i++) t += B[i][i]; return t; })() || 1;
  return {
    coords,
    varExplained: vals.map((l) => Math.max(0, l) / traceB),
    method: "mds-confusion-top3",
  };
}

// ---- uniform scale+centre into the target cube (distance-honest) ----
function fitCube(coords) {
  const dims = 3, min = new Array(dims).fill(Infinity), max = new Array(dims).fill(-Infinity);
  for (const p of coords) for (let a = 0; a < dims; a++) { if (p[a] < min[a]) min[a] = p[a]; if (p[a] > max[a]) max[a] = p[a]; }
  const center = min.map((mn, a) => (mn + max[a]) / 2);
  const halfRange = Math.max(...min.map((mn, a) => (max[a] - mn) / 2)) || 1;
  const s = EXTENT / halfRange;   // single uniform factor → preserves shape/distances
  return coords.map((p) => p.map((v, a) => round((v - center[a]) * s)));
}

// ---- neighbor-fidelity scoring (the "nearby-in-3D is similar-sounding" proof) ----
function d3(P, a, b) { let s = 0; for (let k = 0; k < 3; k++) s += (P[a][k] - P[b][k]) ** 2; return Math.sqrt(s); }

function nearest3(POS, spot, k) {
  const others = Object.keys(POS).filter((g) => g !== spot);
  others.sort((a, b) => d3(POS, spot, a) - d3(POS, spot, b));
  return k ? others.slice(0, k) : others;
}

// Spearman rho of the 3D nearest-neighbour ranking vs the true 23-D ranking,
// plus overlap@k, for one genre.
function fidelity(POS, spot, k) {
  const rank23 = {}; G.nearest(spot).forEach((r, i) => { rank23[r.genre] = i; });
  const by3d = nearest3(POS, spot);
  const rank3d = {}; by3d.forEach((g, i) => { rank3d[g] = i; });
  const others = by3d, n = others.length;
  let sumd2 = 0; for (const g of others) { const diff = rank3d[g] - rank23[g]; sumd2 += diff * diff; }
  const rho = 1 - (6 * sumd2) / (n * (n * n - 1));
  const top3d = new Set(by3d.slice(0, k));
  const top23 = G.nearest(spot, k).map((r) => r.genre);
  const overlap = top23.filter((g) => top3d.has(g)).length;
  return { spot, n, spearman: rho, overlapAtK: overlap, top23, top3d: by3d.slice(0, k) };
}

// mean fidelity over the probe set (drives the auto method choice).
function meanFidelity(POS, k) {
  const probes = PROBE.filter((g) => POS[g]);
  let rho = 0, ov = 0;
  for (const g of probes) { const f = fidelity(POS, g, k); rho += f.spearman; ov += f.overlapAtK; }
  return { probes: probes.length, meanRho: rho / probes.length, meanOverlap: ov / probes.length };
}

function toPOS(genres, coords) {
  const POS = {}; genres.forEach((g, i) => { POS[g] = coords[i]; }); return POS;
}

// ---- build both embeddings; pick the better-separating (auto) ----
function build(method, k) {
  const cent = G.centroids();
  const genres = Object.keys(cent).sort();
  const rows = genres.map((g) => cent[g]);

  const pca = pca3(rows);
  const pcaPOS = toPOS(genres, fitCube(pca.coords));
  const pcaFid = meanFidelity(pcaPOS, k);

  const mdsRaw = mds3Confusion(genres);
  const mds = mdsRaw && { ...mdsRaw, POS: toPOS(genres, fitCube(mdsRaw.coords)), fid: null };
  if (mds) mds.fid = meanFidelity(mds.POS, k);

  let chosen, reason;
  if (method === "pca") { chosen = "pca"; reason = "forced --method pca"; }
  else if (method === "mds") { chosen = mds ? "mds" : "pca"; reason = mds ? "forced --method mds" : "mds unavailable (no matrix), fell back to pca"; }
  else {
    if (!mds) { chosen = "pca"; reason = "confusion matrix unavailable; only pca computed"; }
    else if (pcaFid.meanRho >= mds.fid.meanRho) { chosen = "pca"; reason = `pca meanRho ${pcaFid.meanRho.toFixed(4)} >= mds meanRho ${mds.fid.meanRho.toFixed(4)}`; }
    else { chosen = "mds"; reason = `mds meanRho ${mds.fid.meanRho.toFixed(4)} > pca meanRho ${pcaFid.meanRho.toFixed(4)}`; }
  }

  const pick = chosen === "mds" ? mds : { ...pca, POS: pcaPOS, fid: pcaFid };
  const perAxisVar = (() => {
    const axv = [0, 0, 0];
    const mean = [0, 0, 0];
    for (const g of genres) for (let a = 0; a < 3; a++) mean[a] += pick.POS[g][a];
    for (let a = 0; a < 3; a++) mean[a] /= genres.length;
    for (const g of genres) for (let a = 0; a < 3; a++) axv[a] += (pick.POS[g][a] - mean[a]) ** 2;
    return axv.map((v) => round(v / genres.length));
  })();

  return {
    genres, POS: pick.POS,
    meta: {
      method: pick.method,
      space: chosen === "mds"
        ? "anchor confusion/affinity matrix (engine/genre-geometry.matrix())"
        : "z-scored symbolic-feature centroids (engine/genre-geometry.js)",
      distanceSource: chosen === "mds" ? "confusion-affinity" : "23-D euclidean centroid",
      dims: rows[0].length, genres: genres.length,
      extent: EXTENT, decimals: DECIMALS,
      iters: chosen === "mds" ? MDS_ITERS : PI_ITERS,
      signConvention: "largest-abs eigenvector component forced positive; axes in eigenvalue order → x,y,z",
      varExplained: pick.varExplained.map((v) => round(v * 1e6) / 1e6),
      perAxisVariance: perAxisVar,
      choice: { chosen, reason },
      fidelity: {
        pca: { meanRho: round(pcaFid.meanRho * 1e6) / 1e6, meanOverlap: round(pcaFid.meanOverlap * 1e3) / 1e3, k },
        mds: mds ? { meanRho: round(mds.fid.meanRho * 1e6) / 1e6, meanOverlap: round(mds.fid.meanOverlap * 1e3) / 1e3, k } : null,
      },
    },
  };
}

// ---- emit the browser ES module (byte-identical across runs) ----
function serialize(built) {
  const { genres, POS, meta } = built;
  const lines = [];
  lines.push("// app/starcruise/genre-coords.js — AUTO-GENERATED by tools/feature-layout3d.js.");
  lines.push("// Do not edit by hand: re-run `node tools/feature-layout3d.js` to regenerate.");
  lines.push("//");
  lines.push("// A deterministic 3D coordinate for every genre, derived from the measured");
  lines.push("// feature space. Nearby in 3D == similar sounding; the star-cruise camera places");
  lines.push("// one planet per genre here and derives blend weights from its distance to each.");
  lines.push("//");
  lines.push(`// method=${meta.method}  extent=+/-${meta.extent}  genres=${meta.genres}`);
  lines.push("");
  lines.push("export const GENRE_COORDS = {");
  for (const g of genres) {
    const p = POS[g];
    lines.push(`  ${/^[A-Za-z_$][\w$]*$/.test(g) ? g : JSON.stringify(g)}: [${p[0]}, ${p[1]}, ${p[2]}],`);
  }
  lines.push("};");
  lines.push("");
  lines.push("export const COORDS_META = " + JSON.stringify(meta, null, 2) + ";");
  lines.push("");
  return lines.join("\n");
}

// ---- CLI ----
function argOf(flag, dflt) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : dflt; }

if (require.main === module) {
  const method = argOf("--method", "auto");
  const k = parseInt(argOf("--k", "8"), 10);
  const outPath = argOf("--out", DEFAULT_OUT);
  const built = build(method, k);
  const text = serialize(built);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text);
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  const m = built.meta;

  console.log(`wrote ${outPath}  (${m.genres} genres, sha256:${hash})`);
  console.log(`method: ${m.method}  [${m.choice.reason}]`);
  console.log(`variance explained: x=${(m.varExplained[0] * 100).toFixed(1)}%  y=${(m.varExplained[1] * 100).toFixed(1)}%  z=${(m.varExplained[2] * 100).toFixed(1)}%  sum=${((m.varExplained[0] + m.varExplained[1] + m.varExplained[2]) * 100).toFixed(1)}%`);
  console.log(`per-axis coord variance: x=${m.perAxisVariance[0]}  y=${m.perAxisVariance[1]}  z=${m.perAxisVariance[2]}`);
  console.log(`fidelity (mean over ${m.fidelity.pca.k} probes): pca rho=${m.fidelity.pca.meanRho}, overlap@k=${m.fidelity.pca.meanOverlap}` +
    (m.fidelity.mds ? `  |  mds rho=${m.fidelity.mds.meanRho}, overlap@k=${m.fidelity.mds.meanOverlap}` : "  |  mds n/a"));
  console.log("");
  const spots = (argOf("--spot", "techno,ambient,gabber,vaporwave").split(","));
  for (const spot of spots) {
    if (!built.POS[spot]) { console.log(`  (${spot}: not scored)`); continue; }
    const f = fidelity(built.POS, spot, k);
    console.log(`neighborhood @ ${spot}: Spearman rho=${f.spearman.toFixed(4)}, overlap@${k}=${f.overlapAtK}/${k}`);
    console.log(`  true 23-D nearest: ${f.top23.join(", ")}`);
    console.log(`  3D   nearest:      ${f.top3d.join(", ")}`);
  }
}

module.exports = { build, serialize, fidelity, meanFidelity, nearest3 };
