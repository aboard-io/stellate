#!/usr/bin/env node
// target-blend.js — nearest-reachable blend solver (ROADMAP §1.3.1, the keystone).
//
// Given a desired verifier SCORE profile (e.g. {jungle:0.8, gospel:0.2}) OR a
// desired raw 23-feature target, hill-climb the weight simplex to minimise the
// distance between what a blend actually renders and the request. Returns the
// best reachable WEIGHTS + the achieved scores/features + the RESIDUAL.
//
// HONESTY LAW (ROADMAP §1 design principles): blends are forward-only picks over
// the catalog's own material, so a far-off target is generally UNREACHABLE. This
// tool never claims to hit the request — it returns the nearest reachable point
// and the residual distance that remains. A large residual means "needs new
// vocabulary", not "solver failed".
//
// OFFLINE + READ-ONLY: only reads K.GENRES via K.mix and scores via V.analyze /
// V.features, and reads the shared z-space via genre-geometry (G). It never
// mutates GENRES and must never run during a real render. Deterministic per
// seed: the mix seed is fixed and the coordinate-descent schedule (candidate
// order + fixed step ladder, no rng) is fixed, so same request+seed => identical
// weights.
//
// API:  const { solve } = require('./tools/target-blend.js');
//       solve({ scores:{jungle:0.8, gospel:0.2} }, { seed:1 })
//       solve({ features:{ bpm:140, sub:0.9, wash:0.1 } }, { seed:1 })
//
// CLI:  node tools/target-blend.js scores jungle=0.8,gospel=0.2 [--seed N] [--k 8]
//       node tools/target-blend.js features bpm=140,sub=0.9 [--seed N]
//       node tools/target-blend.js anchor jungle [--seed N]   (round-trip self-test)

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const K = isNode ? require("../engine/genre-kernel.js") : root.GenreKernel;
  const V = isNode ? require("../engine/genre-verifier.js") : root.GenreVerifier;
  const G = isNode ? require("../engine/genre-geometry.js") : root.GenreGeometry;

  // fixed coordinate-descent step ladder — a projected simplex descent: perturb
  // one weight by ±step, clamp to >=0, renormalise to sum 1, keep only strict
  // improvements. No rng anywhere => deterministic.
  const STEPS = [0.5, 0.25, 0.125, 0.0625, 0.03125];
  const EPS = 1e-9;

  // ---- weight helpers -----------------------------------------------------
  function renorm(w) {
    let s = 0;
    for (const g in w) { if (w[g] < 0) w[g] = 0; s += w[g]; }
    if (s <= 0) return null;
    for (const g in w) w[g] /= s;
    return w;
  }
  function clone(w) { const o = {}; for (const g in w) o[g] = w[g]; return o; }
  function toArray(w) {
    return Object.keys(w)
      .filter((g) => w[g] > EPS)
      .map((g) => ({ g, w: w[g] }))
      .sort((a, b) => b.w - a.w);
  }
  // stable key for memoisation (rounded so numerically-equal trials collapse).
  function keyOf(w) {
    return Object.keys(w).sort()
      .map((g) => g + ":" + w[g].toFixed(6))
      .filter((s) => !s.endsWith(":0.000000"))
      .join("|");
  }

  // ---- objective ----------------------------------------------------------
  // Build an evaluator: renders the blend once, returns { obj, analyze }.
  function makeEval(mode, target, seed, cache) {
    return function (w) {
      const arr = toArray(w);
      if (!arr.length) return { obj: Infinity, analyze: null };
      const ck = keyOf(w);
      if (cache.has(ck)) return cache.get(ck);
      const state = K.mix(arr, { seed });
      let res;
      if (mode === "scores") {
        const a = V.analyze(state);
        let s = 0, n = 0;
        for (const g in target) {
          const got = (a.scores[g] || 0) / 100; // scores are 0..100
          s += (got - target[g]) ** 2; n++;
        }
        res = { obj: Math.sqrt(s / n), analyze: a };
      } else {
        const f = V.features(state);
        const zs = G.zstats();
        let s = 0;
        for (const feat in target) {
          const st = zs[feat];
          if (!st) continue; // unknown feature name — ignore
          const zGot = (f[feat] - st.mean) / st.sd;
          const zWant = (target[feat] - st.mean) / st.sd;
          s += (zGot - zWant) ** 2;
        }
        res = { obj: Math.sqrt(s), analyze: V.analyze(state), features: f };
      }
      cache.set(ck, res);
      return res;
    };
  }

  // ---- candidate simplex support ------------------------------------------
  // Which genres the blend is allowed to draw from. Always includes any genre
  // named in a score request; seeded from the nearest centroid (via G) and
  // padded with that seed's z-space neighbours for blending material.
  function buildCandidates(mode, target, k) {
    const set = [];
    const push = (g) => { if (K.GENRES[g] && set.indexOf(g) < 0) set.push(g); };

    let seed;
    if (mode === "scores") {
      // named genres first, ordered by requested weight (descending)
      const named = Object.keys(target).sort((a, b) => target[b] - target[a]);
      named.forEach(push);
      seed = named[0];
    } else {
      // nearest centroid to the (z-scored, partial) feature target
      const cents = G.centroids();
      const zs = G.zstats();
      const dimOrder = Object.keys(zs);
      let best = null, bd = Infinity;
      for (const g in cents) {
        let s = 0, dims = 0;
        for (const feat in target) {
          const idx = dimOrder.indexOf(feat);
          if (idx < 0) continue;
          const zWant = (target[feat] - zs[feat].mean) / zs[feat].sd;
          s += (cents[g][idx] - zWant) ** 2; dims++;
        }
        if (dims && s < bd) { bd = s; best = g; }
      }
      seed = best;
      push(seed);
    }
    // pad with z-nearest neighbours of the seed for hybrid material
    if (seed) for (const n of G.nearest(seed, k)) push(n.genre);
    return { candidates: set, seed };
  }

  // ---- the solver ---------------------------------------------------------
  function solve(request, opts) {
    opts = opts || {};
    const seed = opts.seed == null ? 1 : opts.seed;
    const k = opts.k == null ? 8 : opts.k;
    const maxPasses = opts.maxPasses == null ? 6 : opts.maxPasses;

    // normalise the request into {mode, target}
    let mode, target;
    if (request.features) {
      mode = "features"; target = Object.assign({}, request.features);
    } else {
      mode = "scores";
      const raw = request.scores || request;
      target = {};
      // accept 0..1 or 0..100 — if anything is >1.5 assume a 0..100 profile
      const big = Object.values(raw).some((v) => v > 1.5);
      for (const g in raw) target[g] = big ? raw[g] / 100 : raw[g];
    }

    const { candidates, seed: seedGenre } = buildCandidates(mode, target, k);
    if (!candidates.length) throw new Error("no valid candidate genres for request");

    const cache = new Map();
    const evalFn = makeEval(mode, target, seed, cache);

    // initial weights: scores -> proportional to requested targets on the named
    // genres; features -> all weight on the nearest centroid.
    let w = {};
    for (const g of candidates) w[g] = 0;
    if (mode === "scores") {
      for (const g in target) if (candidates.indexOf(g) >= 0) w[g] = Math.max(target[g], EPS);
    }
    if (!renorm(w)) { w = {}; for (const g of candidates) w[g] = 0; w[seedGenre] = 1; }

    let bestObj = evalFn(w).obj;
    const trace = [bestObj];

    // projected coordinate descent over the fixed step ladder.
    for (const step of STEPS) {
      for (let pass = 0; pass < maxPasses; pass++) {
        let improved = false;
        for (const g of candidates) {
          for (const dir of [1, -1]) {
            const trial = clone(w);
            trial[g] = (trial[g] || 0) + dir * step;
            if (!renorm(trial)) continue;
            const o = evalFn(trial).obj;
            if (o < bestObj - EPS) {
              w = trial; bestObj = o; improved = true; trace.push(o);
            }
          }
        }
        if (!improved) break;
      }
    }

    const finalEval = evalFn(w);
    const a = finalEval.analyze;
    const topScores = a
      ? Object.keys(a.scores).map((g) => [g, a.scores[g]])
          .sort((x, y) => y[1] - x[1]).slice(0, 6)
          .map(([g, s]) => ({ genre: g, score: s }))
      : [];

    const out = {
      mode,
      seed,
      request: target,
      seedGenre,
      candidates,
      weights: toArray(w).map((x) => ({ g: x.g, w: +x.w.toFixed(4) })),
      best: a ? a.best : null,
      topScores,
      residual: +bestObj.toFixed(6),
      initialObjective: +trace[0].toFixed(6),
      iterations: trace.length - 1,
      trace: trace.map((t) => +t.toFixed(6)),
      note: "nearest-reachable point + residual; residual is the un-closed distance to the request, NOT a claim the target was hit",
    };
    if (mode === "features") out.achievedFeatures = finalEval.features;
    return out;
  }

  const api = { solve, buildCandidates, STEPS };
  if (isNode) module.exports = api; else root.TargetBlend = api;

  // ---- CLI ----------------------------------------------------------------
  if (isNode && require.main === module) {
    const argv = process.argv.slice(2);
    const cmd = argv[0];
    const opt = { seed: 1, k: 8 };
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--seed") opt.seed = parseInt(argv[++i], 10);
      else if (argv[i] === "--k") opt.k = parseInt(argv[++i], 10);
    }
    const parsePairs = (s) => {
      const o = {};
      (s || "").split(",").forEach((p) => {
        const [k2, v] = p.split("=");
        if (k2) o[k2.trim()] = parseFloat(v);
      });
      return o;
    };

    let request;
    if (cmd === "scores") request = { scores: parsePairs(argv[1]) };
    else if (cmd === "features") request = { features: parsePairs(argv[1]) };
    else if (cmd === "anchor") {
      // round-trip self-test: request the anchor's own rendered feature vector.
      const g = argv[1];
      if (!K.GENRES[g]) { console.error("unknown anchor: " + g); process.exit(1); }
      request = { features: V.features(K.track(g, { seed: opt.seed })) };
    } else {
      console.log("usage:");
      console.log("  target-blend.js scores jungle=0.8,gospel=0.2 [--seed N] [--k 8]");
      console.log("  target-blend.js features bpm=140,sub=0.9 [--seed N]");
      console.log("  target-blend.js anchor jungle [--seed N]");
      process.exit(0);
    }
    const res = solve(request, opt);
    console.log(JSON.stringify(res, null, 2));
  }
})(typeof window !== "undefined" ? window : globalThis);
