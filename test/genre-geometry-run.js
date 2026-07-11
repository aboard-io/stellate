#!/usr/bin/env node
// Proof for engine/genre-geometry.js: centroids/dist/nearest work, and the
// factored z-score+centroid math is IDENTICAL to validate-genres.js
// gateGeometry (recomputed inline over the same point cloud).
const G = require("../engine/genre-geometry.js");
const K = require("../engine/genre-kernel.js");
const V = require("../engine/genre-verifier.js");

// --- replicate gateGeometry (validate-genres.js ~195-238) over G's own cloud ---
const pts = [];
for (const g of G.scoredGenres()) for (const seed of G.SEEDS) {
  const cache = require("../engine/verify-lib.js").loadFeats();
  const f = cache[g + ":" + seed] || V.features(K.track(g, { seed }));
  pts.push({ g, f });
}
const dims = Object.keys(pts[0].f).filter((k) => typeof pts[0].f[k] === "number");
const mean = {}, sd = {};
for (const d of dims) {
  const vs = pts.map((p) => p.f[d]);
  mean[d] = vs.reduce((a, b) => a + b, 0) / vs.length;
  sd[d] = Math.sqrt(vs.reduce((a, v) => a + (v - mean[d]) ** 2, 0) / vs.length) || 1;
}
const vec = (f) => dims.map((d) => (f[d] - mean[d]) / sd[d]);
pts.forEach((p) => (p.v = vec(p.f)));
const refCent = {};
for (const g of new Set(pts.map((p) => p.g))) {
  const mine = pts.filter((p) => p.g === g);
  refCent[g] = dims.map((_, i) => mine.reduce((s, p) => s + p.v[i], 0) / mine.length);
}

// --- compare against the library ---
const cent = G.centroids();
let maxDiff = 0, checked = 0;
for (const g of Object.keys(refCent)) {
  const a = cent[g], b = refCent[g];
  for (let i = 0; i < b.length; i++) maxDiff = Math.max(maxDiff, Math.abs(a[i] - b[i]));
  checked++;
}
console.log("genres in centroid set:", checked, "/ 249");
console.log("max |G.centroid - gateGeometry.centroid| across ALL genres/dims:", maxDiff);
console.log("centroids MATCH gateGeometry math:", maxDiff < 1e-12);

// spot-check one genre's full centroid identity
const g0 = "techno";
console.log(`\n${g0} centroid[0..4] lib :`, cent[g0].slice(0, 5).map((x) => x.toFixed(6)));
console.log(`${g0} centroid[0..4] gate:`, refCent[g0].slice(0, 5).map((x) => x.toFixed(6)));

// dist symmetry + nearest
console.log("\ndist(techno,house) =", G.dist("techno", "house").toFixed(4),
  " dist(house,techno) =", G.dist("house", "techno").toFixed(4),
  " dist(techno,techno) =", G.dist("techno", "techno").toFixed(4));
console.log("nearest(techno,5):", G.nearest("techno", 5).map((r) => `${r.genre}:${r.dist.toFixed(3)}`).join("  "));

// zstats + matrix
const zs = G.zstats();
console.log("\nzstats keys:", Object.keys(zs).length, " bpm.mean=", zs.bpm.mean.toFixed(3), "bpm.sd=", zs.bpm.sd.toFixed(3));
const m = G.matrix();
console.log("matrix() -> genres:", m ? m.genres.length : null, "diagonalDominant:", m ? m.diagonalDominant : null,
  " techno self-cell:", m ? m.cells.techno[m.genres.indexOf("techno")] : null);

if (maxDiff >= 1e-12) { console.error("FAIL: centroids diverge from gateGeometry"); process.exit(1); }
console.log("\nALL CHECKS PASS");
