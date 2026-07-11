// dead-axis.js — flag near-zero-variance ("dead") symbolic features.
//
// A dead axis is a verifier feature that barely moves across the whole
// per-(genre,seed) cloud: it is either wasted discriminative capacity or a
// silently-broken feature that always returns the same number. Either way the
// gate is spending a dimension for nothing, so this check surfaces it as a WARN
// for wiring into validate-genres.js.
//
// READ-ONLY + OFFLINE + DETERMINISTIC. The point cloud is pulled from the same
// persisted feats cache the geometry lib uses (via verify-lib.loadFeats); any
// missing (genre,seed) is filled by the verifier's own V.features path — the
// identical path that seeded the cache — so cached and fresh points agree. The
// population (scoredGenres × SEEDS) and the feature order come from
// genre-geometry.js so this can never drift from the gate. Nothing is mutated.
//
// IMPORTANT: variance here is the TRUE population variance, computed directly —
// NOT genre-geometry.zstats().sd, whose ||1 zero-guard would MASK a dead axis by
// reporting sd=1 for a constant feature.
//
//   loadPoints()            -> [{g, seed, f}]  (memoised real cloud)
//   variances([points])     -> { feature: variance }   (raw, no zero-guard)
//   check({threshold,points}) -> { status:'PASS'|'WARN', threshold, dims,
//                                  variances, dead:[{feature,variance}] }
//   node dead-axis.js [threshold]

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const G = isNode ? require("../genre-geometry.js") : root.GenreGeometry;
  const K = isNode ? require("../genre-kernel.js") : root.GenreKernel;
  const V = isNode ? require("../genre-verifier.js") : root.GenreVerifier;
  const L = isNode ? require("../verify-lib.js") : null;

  // Default: a feature whose population variance is below this is "dead".
  // Constant / silently-broken features sit at ~0; every live feature in the
  // real cloud is orders of magnitude above it (see test).
  const DEFAULT_THRESHOLD = 1e-6;

  let _pts = null;

  // The (genre,seed) feature point cloud, over the SAME population + feature
  // order genre-geometry.js uses. Cache hits come from verify-lib.loadFeats;
  // misses fall back to the verifier's own feature path.
  function loadPoints() {
    if (_pts) return _pts;
    const cache = (L && L.loadFeats) ? L.loadFeats() : {};
    const pts = [];
    for (const g of G.scoredGenres()) for (const seed of G.SEEDS) {
      const key = g + ":" + seed;
      let f = cache[key];
      if (!f) f = V.features(K.track(g, { seed }));
      pts.push({ g, seed, f });
    }
    _pts = pts;
    return pts;
  }

  // ordered numeric feature names (feature-object insertion order, same as G).
  function dimsOf(points) {
    if (!points.length) return [];
    return Object.keys(points[0].f).filter((k) => typeof points[0].f[k] === "number");
  }

  // true population variance per feature — no zero-guard, so dead axes read ~0.
  function variances(points) {
    points = points || loadPoints();
    const dims = dimsOf(points);
    const out = {};
    for (const d of dims) {
      const vs = points.map((p) => p.f[d]);
      const m = vs.reduce((a, b) => a + b, 0) / vs.length;
      out[d] = vs.reduce((a, v) => a + (v - m) * (v - m), 0) / vs.length;
    }
    return out;
  }

  function check(opts) {
    opts = opts || {};
    const threshold = opts.threshold == null ? DEFAULT_THRESHOLD : opts.threshold;
    const points = opts.points || loadPoints();
    const vars = variances(points);
    const dims = Object.keys(vars);
    const dead = dims
      .filter((d) => vars[d] < threshold)
      .map((d) => ({ feature: d, variance: vars[d] }))
      .sort((a, b) => a.variance - b.variance);
    return {
      status: dead.length ? "WARN" : "PASS",
      threshold,
      dims,
      variances: vars,
      dead,
    };
  }

  function _reset() { _pts = null; }

  const api = { loadPoints, variances, check, DEFAULT_THRESHOLD, _reset };
  if (isNode) module.exports = api; else root.DeadAxisCheck = api;

  if (isNode && require.main === module) {
    const threshold = parseFloat(process.argv[2]) || DEFAULT_THRESHOLD;
    const r = check({ threshold });
    console.log(`dead-axis check  (threshold ${r.threshold})  ->  ${r.status}`);
    const sorted = r.dims.slice().sort((a, b) => r.variances[a] - r.variances[b]);
    console.log("lowest-variance features:");
    for (const d of sorted.slice(0, 6))
      console.log(`  ${d.padEnd(16)} ${r.variances[d].toExponential(3)}`);
    if (r.dead.length) {
      console.log("DEAD (near-zero variance):");
      for (const d of r.dead) console.log(`  ${d.feature.padEnd(16)} ${d.variance.toExponential(3)}`);
    } else {
      console.log("no dead axes.");
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
