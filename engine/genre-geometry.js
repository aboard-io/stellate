// genre-geometry.js — the shared feature-space geometry library.
//
// Exposes the two coordinate systems the verifier already computes but throws
// away after each run: (1) the z-scored symbolic-feature centroid per genre
// (the space validate-genres.js gateGeometry judges separation in), and (2) the
// persisted anchor confusion/affinity matrix. Everything downstream (empty-
// region diagnostics, blend targeting, nearest-neighbour tooling) imports THIS
// so the z-scoring + centroid math lives in exactly one place and can never
// drift from the gate.
//
// READ-ONLY + OFFLINE: reads the persisted per-(genre,seed) feature cache in
// scratch/.verify-cache/ (via verify-lib, so it always tracks the current code
// hash). Any missing (genre,seed) point is filled by calling the verifier's own
// V.features(K.track(...)) path — the SAME path that seeded the cache — so the
// numbers are identical whether cached or freshly computed. Never mutates
// K.GENRES, never runs during a render.
//
// The z-score + centroid + Euclidean-dist math is a byte-for-byte factoring of
// engine/validate-genres.js gateGeometry (lines ~195-238): population sd with a
// ||1 zero-guard, mean over ALL points, centroid = mean of z-scored vectors,
// dims in feature-object insertion order. Feed the same point set and the
// centroids are identical (proven in test/unit/genre-geometry.test.js).
//
//   centroids()        -> { genre: [23 z-scored means] }
//   zstats()           -> { feature: {mean, sd} }
//   dist(a, b)         -> Euclidean over z-scored centroids (a,b = genre name or vector)
//   nearest(genre, k)  -> [{genre, dist}] k closest centroids
//   matrix()           -> persisted { genres, cells:{genre:[...]}, diagonalDominant }
//   node genre-geometry.js <genre> [k]   print z-nearest anchors

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const K = isNode ? require("./genre-kernel.js") : root.GenreKernel;
  const V = isNode ? require("./genre-verifier.js") : root.GenreVerifier;
  const L = isNode ? require("./verify-lib.js") : null;
  const fs = isNode ? require("fs") : null;
  const path = isNode ? require("path") : null;

  // seed set matches the matrix command in genre-verifier.js so the geometry
  // is built over the same population the matrix + cache are built over.
  const SEEDS = [1, 2, 3];

  // genres scored by the gate: those carrying a verifier target AND a kernel
  // anchor. Same predicate as validate-genres.js scoredGenres.
  function scoredGenres() {
    return Object.keys(V.TARGETS).filter((g) => K.GENRES[g]);
  }

  let _pts = null, _z = null, _cent = null;

  // the (genre,seed) symbolic-feature point cloud. Pulled from the persisted
  // feats cache; anything missing is computed via the verifier's own feature
  // path (identical to how the cache was seeded) — NOT persisted here.
  function loadPoints() {
    if (_pts) return _pts;
    const cache = (L && L.loadFeats) ? L.loadFeats() : {};
    const pts = [];
    for (const g of scoredGenres()) for (const seed of SEEDS) {
      const key = g + ":" + seed;
      let f = cache[key];
      if (!f) f = V.features(K.track(g, { seed }));
      pts.push({ g, seed, f });
    }
    _pts = pts; return pts;
  }

  // per-dimension mean + population sd over the WHOLE cloud (gateGeometry math).
  function computeZ() {
    if (_z) return _z;
    const pts = loadPoints();
    if (!pts.length) { _z = { dims: [], mean: {}, sd: {} }; return _z; }
    const dims = Object.keys(pts[0].f).filter((k) => typeof pts[0].f[k] === "number");
    const mean = {}, sd = {};
    for (const d of dims) {
      const vs = pts.map((p) => p.f[d]);
      mean[d] = vs.reduce((a, b) => a + b, 0) / vs.length;
      sd[d] = Math.sqrt(vs.reduce((a, v) => a + (v - mean[d]) ** 2, 0) / vs.length) || 1;
    }
    _z = { dims, mean, sd }; return _z;
  }

  function zstats() {
    const { dims, mean, sd } = computeZ();
    const out = {};
    for (const d of dims) out[d] = { mean: mean[d], sd: sd[d] };
    return out;
  }

  // z-score one raw feature vector into the shared space (dims order preserved).
  function vecOf(f) {
    const { dims, mean, sd } = computeZ();
    return dims.map((d) => (f[d] - mean[d]) / sd[d]);
  }

  // centroid = mean of a genre's z-scored point vectors.
  function centroids() {
    if (_cent) return _cent;
    const { dims } = computeZ();
    const byG = {};
    for (const p of loadPoints()) (byG[p.g] = byG[p.g] || []).push(vecOf(p.f));
    const cent = {};
    for (const [g, vs] of Object.entries(byG))
      cent[g] = dims.map((_, i) => vs.reduce((s, v) => s + v[i], 0) / vs.length);
    _cent = cent; return cent;
  }

  // Euclidean distance in the z-scored space. Args are genre names OR raw
  // 23-vectors (already z-scored); mix freely.
  function dist(a, b) {
    const c = centroids();
    const va = Array.isArray(a) ? a : c[a];
    const vb = Array.isArray(b) ? b : c[b];
    if (!va) throw new Error("unknown genre: " + a);
    if (!vb) throw new Error("unknown genre: " + b);
    let s = 0; for (let i = 0; i < va.length; i++) s += (va[i] - vb[i]) ** 2;
    return Math.sqrt(s);
  }

  function nearest(genre, k) {
    const c = centroids();
    if (!c[genre]) throw new Error("unknown genre: " + genre);
    const out = [];
    for (const g of Object.keys(c)) {
      if (g === genre) continue;
      out.push({ genre: g, dist: dist(genre, g) });
    }
    out.sort((x, y) => x.dist - y.dist);
    return k ? out.slice(0, k) : out;
  }

  // the persisted anchor confusion/affinity matrix (written by
  // genre-verifier.js `matrix`). Returns null if it hasn't been built yet.
  function matrix() {
    if (!L || !fs || !path) return null;
    try { return JSON.parse(fs.readFileSync(path.join(L.CACHE_DIR, "matrix.json"), "utf8")); }
    catch (e) { return null; }
  }

  // test-affordance: reset memoised state (e.g. after warming the cache mid-run)
  function _reset() { _pts = _z = _cent = null; }

  const api = { centroids, zstats, dist, nearest, matrix, vecOf, SEEDS, scoredGenres, _reset };
  if (isNode) module.exports = api; else root.GenreGeometry = api;

  if (isNode && require.main === module) {
    const g = process.argv[2], k = parseInt(process.argv[3], 10) || 8;
    if (!g) { console.log("usage: genre-geometry.js <genre> [k]"); process.exit(0); }
    console.log(`z-space nearest ${k} to ${g}:`);
    for (const r of nearest(g, k)) console.log(`  ${r.genre.padEnd(16)} ${r.dist.toFixed(3)}`);
  }
})(typeof window !== "undefined" ? window : globalThis);
