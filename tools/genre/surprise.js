#!/usr/bin/env node
// surprise.js — maximally-distinct / "surprise-me" blend finder (ROADMAP §1.3.3).
//
// A new OBJECTIVE layered over the same forward-only blend material the rest of
// the creative-search tools use. Where target-blend.js MINIMISES distance to a
// requested profile, this MAXIMISES novelty: it returns a playable weight vector
// whose rendered features sit as FAR as possible from every anchor centroid —
// the emptiest reachable corner of the catalog's own hull — SUBJECT TO a
// musicality floor (Mus.audit / auditAll) so the surprise is still a piece of
// music, not noise.
//
// Two strategies, per the roadmap:
//   * "pair"  (default) — pick the parent PAIR (over the most-isolated anchors,
//     at a fixed weight ladder) whose blend has the greatest min-centroid
//     novelty AND still clears the musicality floor. This is the roadmap's
//     "parent pair with max centroid distance whose blend passes the audit",
//     generalised to maximise the ACHIEVED novelty of the render (which is the
//     real objective) rather than the parents' declared separation.
//   * "climb" — start from the winning pair and coordinate-ASCEND: fold in a
//     third isolated anchor at a fixed small-weight ladder, keeping any step
//     that raises novelty and still clears the floor. Fixed candidate order,
//     fixed step ladder, no rng.
//
// HONESTY LAW (ROADMAP §1, NEAREST-REACHABLE): blends are forward-only picks
// over existing material, so "maximally distinct" means "the most distinct point
// we could REACH", never "the most distinct point that could exist". The tool
// reports the achieved novelty against a BAR — the novelty of the loneliest
// single anchor render — and a RESIDUAL. exceedsBar:true means the blend sits
// further from the whole anchor cloud than any single anchor does; exceedsBar
// :false honestly says the musicality floor kept us inside the anchor cloud.
//
// ROBUSTNESS: a few verifier features can blow up on a pathological blend (e.g.
// a near-empty snare lane sends snareBalance to a huge ratio). That is metric
// noise, not novelty, so (a) candidates whose worst per-dimension z-deviation
// exceeds DEGEN are rejected as degenerate renders, and (b) the novelty metric
// itself z-CLAMPS each coordinate to +/-ZCAP before measuring distance. Both
// operate on top of genre-geometry's shared z-space (G.vecOf / G.centroids) —
// the z-scoring itself is imported, never re-derived (per the geometry law).
//
// OFFLINE + READ-ONLY + DETERMINISTIC: only reads K.GENRES via K.mix / K.track,
// V.features, G.*, and Mus.audit. Never mutates GENRES; never runs in a real
// render. No Date.now()/Math.random() anywhere — same seed + args => identical
// result. The seed threads into K.mix / K.track only.
//
// API:  const { surprise } = require('./tools/genre/surprise.js');
//       surprise({ seed:1, pool:26, mode:'pair', floor:0.90 })
//
// CLI:  node tools/genre/surprise.js [--seed N] [--pool M] [--mode pair|climb]
//                              [--floor F] [--strict] [--json]

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const K = isNode ? require("../../engine/genre-kernel.js") : root.GenreKernel;
  const V = isNode ? require("../../engine/genre-verifier.js") : root.GenreVerifier;
  const G = isNode ? require("../../engine/genre-geometry.js") : root.GenreGeometry;
  const Mus = isNode ? require("../../engine/musicality.js") : root.Musicality;

  // ---- tunables (all fixed => deterministic) ------------------------------
  const ZCAP = 4;      // per-dimension z clamp for the novelty metric
  const DEGEN = 12;    // reject a render whose worst |z| exceeds this (broken feature)
  const T_LADDER = [0.5, 0.4, 0.6, 0.3, 0.7]; // parent weight ratios to try
  const CLIMB_ADD = [0.30, 0.20, 0.12]; // third-anchor weights to try in climb
  const DEFAULT_POOL = 26;   // # of most-isolated anchors to draw parents from
  const DEFAULT_FLOOR = 0.90; // musicality floor: Mus.audit overall >= this
  const EPS = 1e-9;

  // ---- shared z-space (imported, not re-derived) --------------------------
  function clampVec(v) {
    const o = new Array(v.length);
    for (let i = 0; i < v.length; i++) o[i] = v[i] > ZCAP ? ZCAP : v[i] < -ZCAP ? -ZCAP : v[i];
    return o;
  }
  function euclid(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
    return Math.sqrt(s);
  }
  // memoised clamped centroids + the isolation ranking; per-process, read-only.
  let _geo = null;
  function geo() {
    if (_geo) return _geo;
    const cent = G.centroids();
    const genres = Object.keys(cent);
    const centC = {};
    for (const g of genres) centC[g] = clampVec(cent[g]);
    // isolation of each anchor = distance to its NEAREST OTHER clamped centroid.
    const isolation = genres.map((g) => {
      let m = Infinity;
      for (const h of genres) { if (h === g) continue; const d = euclid(centC[g], centC[h]); if (d < m) m = d; }
      return { g, iso: m };
    }).sort((a, b) => b.iso - a.iso || a.g.localeCompare(b.g));
    _geo = { cent, centC, genres, isolation };
    return _geo;
  }

  // raw z-vector of a rendered state (shared space), plus its worst |z|.
  function rawVec(state) { return G.vecOf(V.features(state)); }
  function worstZ(v) { let m = 0; for (const x of v) { const a = Math.abs(x); if (a > m) m = a; } return m; }
  // novelty of a raw z-vector = min clamped-distance to every anchor centroid.
  function noveltyOf(v) {
    const { centC } = geo();
    const c = clampVec(v);
    let m = Infinity, ng = null;
    for (const g in centC) { const d = euclid(c, centC[g]); if (d < m) { m = d; ng = g; } }
    return { novelty: m, nearest: ng };
  }

  // BAR: the max, over every anchor's own render at THIS seed, of its
  // min-centroid novelty. A blend that beats the bar sits further from the
  // whole anchor cloud than any single anchor render does. Computed at the
  // request seed for a like-for-like comparison; memoised per seed.
  const _barCache = {};
  function barFor(seed) {
    if (_barCache[seed] != null) return _barCache[seed];
    const { genres } = geo();
    let bar = 0, bg = null;
    for (const g of genres) {
      const { novelty } = noveltyOf(rawVec(K.track(g, { seed })));
      if (novelty > bar) { bar = novelty; bg = g; }
    }
    _barCache[seed] = { bar, genre: bg };
    return _barCache[seed];
  }

  // ---- musicality floor ---------------------------------------------------
  // Default floor = Mus.audit(state).overall >= floor (the auditAll scalar).
  // --strict additionally requires verdict !== "FAIL" (no hard bloom / promise
  // failure). Returns the audit so callers can report the tradeoff.
  function clears(state, floor, strict) {
    const au = Mus.audit(state);
    const ok = au.overall >= floor - EPS && (!strict || au.verdict !== "FAIL");
    return { ok, au };
  }

  // ---- weight helpers -----------------------------------------------------
  function renorm(w) {
    let s = 0; for (const g in w) { if (w[g] < 0) w[g] = 0; s += w[g]; }
    if (s <= 0) return null;
    for (const g in w) w[g] /= s;
    return w;
  }
  function toArray(w) {
    return Object.keys(w).filter((g) => w[g] > EPS).map((g) => ({ g, w: w[g] }))
      .sort((a, b) => b.w - a.w || a.g.localeCompare(b.g));
  }
  function render(w, seed) { return K.mix(toArray(w), { seed }); }

  // evaluate a weight object: render, degeneracy-guard, novelty. Cheap (no
  // audit). Returns null when the render is degenerate.
  function evalNovelty(w, seed) {
    const state = render(w, seed);
    const v = rawVec(state);
    if (worstZ(v) > DEGEN) return null;
    const { novelty, nearest } = noveltyOf(v);
    return { state, novelty, nearest, worstZ: worstZ(v) };
  }

  // ---- strategy: pair -----------------------------------------------------
  // Rank all (isolated-pool) pairs x t-ladder by ACHIEVED novelty (cheap),
  // then audit downward until one clears the floor => the max-novelty passing
  // blend. Deterministic: fixed pool order, fixed t ladder, stable sort.
  function pairSearch(seed, pool, floor, strict) {
    const { isolation } = geo();
    const parents = isolation.slice(0, pool).map((x) => x.g);
    const cands = [];
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        for (const t of T_LADDER) {
          const w = { [parents[i]]: t, [parents[j]]: 1 - t };
          const e = evalNovelty(w, seed);
          if (!e) continue;
          cands.push({ w, a: parents[i], b: parents[j], t, novelty: e.novelty, nearest: e.nearest });
        }
      }
    }
    // stable order: novelty desc, then lexical for ties => deterministic.
    cands.sort((x, y) => y.novelty - x.novelty ||
      (x.a + x.b).localeCompare(y.a + y.b) || x.t - y.t);
    let bestPass = null, considered = 0;
    for (const c of cands) {
      considered++;
      const { ok, au } = clears(render(c.w, seed), floor, strict);
      if (ok) { bestPass = Object.assign({}, c, { audit: au }); break; }
    }
    return { bestPass, cands, considered };
  }

  // ---- strategy: climb ----------------------------------------------------
  // From the winning pair, fold in a third isolated anchor at a fixed weight
  // ladder; keep any step that raises novelty and still clears the floor.
  // One deterministic sweep over the pool (no rng, no revisit).
  function climb(base, seed, pool, floor, strict) {
    const { isolation } = geo();
    const parents = isolation.slice(0, pool).map((x) => x.g);
    let curW = base.w, curNov = base.novelty, curAudit = base.audit, curNear = base.nearest;
    let improved = 0;
    for (const g of parents) {
      if (curW[g]) continue; // already a parent
      let stepped = false;
      for (const add of CLIMB_ADD) {
        const w = renorm(Object.assign({}, curW, { [g]: (curW[g] || 0) + add * (1 - 0) }));
        if (!w) continue;
        const e = evalNovelty(w, seed);
        if (!e || e.novelty <= curNov + EPS) continue;
        const { ok, au } = clears(e.state, floor, strict);
        if (!ok) continue;
        curW = w; curNov = e.novelty; curAudit = au; curNear = e.nearest; stepped = true;
        break; // take the largest improving weight for this anchor, move on
      }
      if (stepped) improved++;
    }
    return { w: curW, novelty: curNov, audit: curAudit, nearest: curNear, improved };
  }

  // ---- public entry -------------------------------------------------------
  function surprise(opts) {
    opts = opts || {};
    const seed = opts.seed != null ? opts.seed : 1;
    const pool = opts.pool != null ? opts.pool : DEFAULT_POOL;
    const floor = opts.floor != null ? opts.floor : DEFAULT_FLOOR;
    const strict = !!opts.strict;
    const mode = opts.mode || "pair";

    const { bar, genre: barGenre } = barFor(seed);
    const { bestPass, considered } = pairSearch(seed, pool, floor, strict);
    if (!bestPass) {
      return {
        ok: false, seed, mode, floor, strict, bar, barGenre, considered,
        reason: "no candidate in the isolated pool cleared the musicality floor; " +
          "raise --pool, lower --floor, or drop --strict.",
      };
    }
    let result = {
      w: bestPass.w, novelty: bestPass.novelty, nearest: bestPass.nearest,
      audit: bestPass.audit, parents: [bestPass.a, bestPass.b], t: bestPass.t,
    };
    if (mode === "climb") {
      const c = climb({ w: bestPass.w, novelty: bestPass.novelty, audit: bestPass.audit, nearest: bestPass.nearest }, seed, pool, floor, strict);
      result = { w: c.w, novelty: c.novelty, nearest: c.nearest, audit: c.audit,
        parents: [bestPass.a, bestPass.b], t: bestPass.t, climbed: c.improved };
    }
    const residual = bar - result.novelty; // <0 means we cleared the bar
    return {
      ok: true, seed, mode, floor, strict, considered,
      weights: toArray(result.w),
      novelty: result.novelty,
      nearestAnchor: result.nearest,
      bar, barGenre,
      exceedsBar: result.novelty > bar,
      residual, // bar - novelty; negative = beat the bar by |residual|
      musicality: { overall: result.audit.overall, verdict: result.audit.verdict },
      seededFrom: result.parents,
      climbed: result.climbed,
    };
  }

  const api = { surprise, _geo: geo, _bar: barFor, _novelty: noveltyOf, _rawVec: rawVec };
  if (isNode) module.exports = api; else root.Surprise = api;

  // ---- CLI ----------------------------------------------------------------
  if (isNode && require.main === module) {
    const argv = process.argv.slice(2);
    const opt = { seed: 1, pool: DEFAULT_POOL, floor: DEFAULT_FLOOR, mode: "pair", strict: false, json: false };
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--seed") opt.seed = parseInt(argv[++i], 10);
      else if (a === "--pool") opt.pool = parseInt(argv[++i], 10);
      else if (a === "--floor") opt.floor = parseFloat(argv[++i]);
      else if (a === "--mode") opt.mode = argv[++i];
      else if (a === "--strict") opt.strict = true;
      else if (a === "--json") opt.json = true;
      else if (a === "-h" || a === "--help") {
        console.log("usage: surprise.js [--seed N] [--pool M] [--mode pair|climb] [--floor F] [--strict] [--json]");
        process.exit(0);
      }
    }
    const r = surprise(opt);
    if (opt.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); }
    if (!r.ok) { console.log("SURPRISE FAILED:", r.reason); console.log("bar", r.bar.toFixed(3), "(" + r.barGenre + ") seed", r.seed); process.exit(1); }
    console.log("surprise-me blend  (seed " + r.seed + ", mode " + r.mode + ", floor " + r.floor + (r.strict ? ", strict" : "") + ")");
    console.log("  weights:      " + r.weights.map((x) => x.g + " " + x.w.toFixed(3)).join(" + "));
    console.log("  novelty:      " + r.novelty.toFixed(3) + "  (min clamped z-distance to any anchor centroid)");
    console.log("  nearest:      " + r.nearestAnchor);
    console.log("  bar:          " + r.bar.toFixed(3) + "  (loneliest single anchor render: " + r.barGenre + ")");
    console.log("  exceeds bar:  " + r.exceedsBar + "   residual " + r.residual.toFixed(3) + (r.exceedsBar ? " (beat the whole anchor cloud)" : " (still inside the cloud)"));
    console.log("  musicality:   overall " + r.musicality.overall.toFixed(3) + "  verdict " + r.musicality.verdict);
    console.log("  seeded from:  " + r.seededFrom.join(" x ") + (r.mode === "climb" ? "  (+" + (r.climbed || 0) + " climb steps)" : ""));
    process.exit(0);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
