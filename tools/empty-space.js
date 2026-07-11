#!/usr/bin/env node
// empty-space.js — empty-region DIAGNOSIS over the reachable blend cloud
// (ROADMAP §1.3.4). Sample many random N-way blends via K.mix, measure their
// 23-feature vectors, and answer three read-only questions:
//
//   (1) envelope() — the per-feature REACHABLE range. Bounds what any blend of
//       the current catalog can actually achieve on each axis (anchors are the
//       degenerate 1-parent blends, so they're unioned in). This is the hard
//       evidence a requested value is out of reach: a target feature OUTSIDE the
//       envelope proves "needs new vocabulary", it can't be blended into being.
//
//   (2) regions() — the emptiest REACHABLE cells. Over key feature PAIRS, bin the
//       reachable cloud, take the cells INTERIOR to the sampled silhouette (i.e.
//       surrounded by reachable material, not off the edge of what's reachable),
//       and rank the empty interior cells by how deep in the void they sit
//       (distance to the nearest occupied cell). For each, name the nearest anchor
//       genres — the neighbours framing the gap.
//
//   (3) classify(target) — label a requested feature target, per the honesty law,
//       as one of: NEEDS-NEW-VOCABULARY (a dim falls outside the reachable
//       envelope — no blend reaches it), REACHABLE-BUT-UNPOPULATED (every dim is
//       inside the envelope yet the nearest actual blend sample is far — a true
//       gap you could aim a solver at), or REACHABLE-POPULATED (a blend already
//       lands close). It also returns the closest sampled blend's WEIGHTS as a
//       starting recipe. It NEVER synthesises an anchor spec (infeasible — the
//       23-D space is a measured render output with no inverse).
//
// OFFLINE + READ-ONLY + DETERMINISTIC. Never mutates K.GENRES, never runs during
// a render. The random blend cloud is drawn from a fixed-seed mulberry32 PRNG and
// each K.mix call gets a deterministic per-sample seed, so same {seed,n,maxParents}
// => byte-identical cloud => identical envelope/regions/classify output. Z-scoring
// is imported from genre-geometry (G), not re-derived; the anchor point cloud and
// the pair-grid binning are imported from coverage.js so the definitions match the
// coverage dashboard the roadmap pairs this tool with.
//
// API:  const ES = require('./tools/empty-space.js');
//       ES.envelope({ seed:1, n:300 })
//       ES.regions({ seed:1, n:300, bins:6, top:6 })
//       ES.classify({ bpm:200, wash:0.9 }, { seed:1, n:300 })
//
// CLI:  node tools/empty-space.js envelope [--n N] [--seed S] [--json]
//       node tools/empty-space.js regions  [--n N] [--seed S] [--bins B]
//                                           [--pairs a:b,c:d] [--top K] [--json]
//       node tools/empty-space.js classify bpm=200,wash=0.9 [--n N] [--seed S] [--json]

(function () {
  "use strict";
  const K = require("../engine/genre-kernel.js");
  const V = require("../engine/genre-verifier.js");
  const G = require("../engine/genre-geometry.js");
  const Cov = require("./coverage.js"); // genrePoints, pairGrid, quantile, binIndex

  const DEFAULT_PAIRS = [["bpm", "swing"], ["sub", "wash"], ["motion", "seventh"]];
  const DEFAULT_N = 300;
  const DEFAULT_MAXPARENTS = 4;

  // ---- deterministic PRNG (mulberry32) ------------------------------------
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- the reachable cloud -------------------------------------------------
  // N random N-way blends (2..maxParents distinct anchors, random weights) plus
  // every anchor's own measured point (a pure anchor IS a reachable blend). Same
  // {seed,n,maxParents} => identical cloud (fixed PRNG + per-sample mix seed).
  let _cloudMemo = {};
  function buildCloud(opts) {
    opts = opts || {};
    const n = opts.n == null ? DEFAULT_N : opts.n;
    const seed = opts.seed == null ? 1 : opts.seed;
    const maxParents = opts.maxParents == null ? DEFAULT_MAXPARENTS : opts.maxParents;
    const memoKey = seed + ":" + n + ":" + maxParents;
    if (_cloudMemo[memoKey]) return _cloudMemo[memoKey];

    const genres = G.scoredGenres();
    const rnd = mulberry32((seed >>> 0) ^ 0x9e3779b9);
    const blends = [];
    for (let i = 0; i < n; i++) {
      const p = 2 + Math.floor(rnd() * (maxParents - 1)); // 2..maxParents
      const pool = genres.slice();
      const chosen = [];
      for (let j = 0; j < p && pool.length; j++) {
        const idx = Math.floor(rnd() * pool.length);
        chosen.push(pool.splice(idx, 1)[0]);
      }
      // weights floored a touch above 0 so resolveMulti keeps every parent.
      const w = chosen.map((g) => ({ g, w: 0.05 + rnd() }));
      const st = K.mix(w, { seed: (seed * 1000 + i) >>> 0 });
      blends.push({ f: V.features(st), w, kind: "blend" });
    }
    // anchors: one raw point per genre (mean of its seed vectors) via coverage's
    // shared cache-then-fallback path, so the anchor cloud matches the dashboard.
    const anchors = Cov.genrePoints().map((p) => ({ f: p.f, g: p.g, kind: "anchor" }));

    const dims = Object.keys(blends[0] ? blends[0].f : anchors[0].f).filter(
      (k) => typeof (blends[0] || anchors[0]).f[k] === "number"
    );
    const cloud = { blends, anchors, all: blends.concat(anchors), dims, n, seed, maxParents };
    _cloudMemo[memoKey] = cloud;
    return cloud;
  }

  // ---- (1) reachable envelope ---------------------------------------------
  // Per feature: hard [min,max] over the whole reachable cloud + robust
  // [p02,p98] band (ignores lone outliers) + median. min/max are the reachability
  // bound; anything outside them is unreachable by blending.
  function envelope(opts) {
    const cloud = buildCloud(opts);
    const env = {};
    for (const d of cloud.dims) {
      const vals = cloud.all.map((p) => p.f[d]).filter((x) => typeof x === "number");
      const sorted = vals.slice().sort((a, b) => a - b);
      env[d] = {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p02: Cov.quantile(sorted, 0.02),
        p98: Cov.quantile(sorted, 0.98),
        median: Cov.quantile(sorted, 0.5),
      };
    }
    return { envelope: env, dims: cloud.dims, nBlends: cloud.blends.length, nAnchors: cloud.anchors.length, seed: cloud.seed };
  }

  // ---- (2) emptiest reachable cells over feature pairs --------------------
  // Bin the reachable cloud into a bins x bins grid per pair. A cell is INTERIOR
  // (reachable) if it sits within the occupied row-span of its column AND the
  // occupied column-span of its row — i.e. enclosed by reachable material rather
  // than off the silhouette edge. Empty interior cells are the reachable-but-
  // unpopulated gaps; rank them by (grid) distance to the nearest occupied cell.
  function pairEmpty(cloud, fx, fy, bins) {
    const pts = cloud.all;
    const xs = pts.map((p) => p.f[fx]), ys = pts.map((p) => p.f[fy]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const grid = Array.from({ length: bins }, () => new Array(bins).fill(0));
    for (const p of pts) {
      const ix = Cov.binIndex(p.f[fx], xmin, xmax, bins);
      const iy = Cov.binIndex(p.f[fy], ymin, ymax, bins);
      grid[iy][ix]++;
    }
    // occupied silhouette spans
    const colSpan = new Array(bins).fill(null); // per ix: [minIy,maxIy] of occupied
    const rowSpan = new Array(bins).fill(null); // per iy: [minIx,maxIx] of occupied
    const occupiedCells = [];
    for (let iy = 0; iy < bins; iy++)
      for (let ix = 0; ix < bins; ix++)
        if (grid[iy][ix] > 0) {
          occupiedCells.push([ix, iy]);
          const c = colSpan[ix]; colSpan[ix] = c ? [Math.min(c[0], iy), Math.max(c[1], iy)] : [iy, iy];
          const r = rowSpan[iy]; rowSpan[iy] = r ? [Math.min(r[0], ix), Math.max(r[1], ix)] : [ix, ix];
        }
    // A cell is INTERIOR/reachable if it is strictly BRACKETED by occupied cells
    // along at least one axis: reachable material sits on both sides of it (so a
    // blend can interpolate through), as opposed to hanging off the silhouette
    // edge. Catches enclosed voids AND empty middle bands.
    const interior = (ix, iy) =>
      (rowSpan[iy] && ix > rowSpan[iy][0] && ix < rowSpan[iy][1]) ||
      (colSpan[ix] && iy > colSpan[ix][0] && iy < colSpan[ix][1]);
    const nearestOccDist = (ix, iy) => {
      let best = Infinity;
      for (const [ox, oy] of occupiedCells) {
        const dd = Math.hypot(ox - ix, oy - iy);
        if (dd < best) best = dd;
      }
      return best;
    };
    const edge = (min, max, i) => min + ((max - min) * i) / bins;
    const empties = [];
    for (let iy = 0; iy < bins; iy++)
      for (let ix = 0; ix < bins; ix++) {
        if (grid[iy][ix] > 0 || !interior(ix, iy)) continue;
        const cx = edge(xmin, xmax, ix + 0.5), cy = edge(ymin, ymax, iy + 0.5);
        empties.push({
          ix, iy,
          x: [edge(xmin, xmax, ix), edge(xmin, xmax, ix + 1)],
          y: [edge(ymin, ymax, iy), edge(ymin, ymax, iy + 1)],
          center: { [fx]: cx, [fy]: cy },
          voidDepth: nearestOccDist(ix, iy),
          neighbors: nearestAnchors(cloud, fx, fy, cx, cy, xmin, xmax, ymin, ymax, 3),
        });
      }
    // emptiest first: deepest void, then deterministic (ix,iy) tie-break.
    empties.sort((a, b) => b.voidDepth - a.voidDepth || a.ix - b.ix || a.iy - b.iy);
    let occupied = 0, interiorCells = 0;
    for (let iy = 0; iy < bins; iy++)
      for (let ix = 0; ix < bins; ix++) {
        if (grid[iy][ix] > 0) occupied++;
        if (interior(ix, iy)) interiorCells++;
      }
    return { fx, fy, bins, xmin, xmax, ymin, ymax, grid, empties, occupied, interiorCells, total: bins * bins };
  }

  // nearest anchor genres to a point in the (fx,fy) plane. Distance is normalised
  // by each axis' range so bpm's hundreds don't swamp a 0..1 feature.
  function nearestAnchors(cloud, fx, fy, cx, cy, xmin, xmax, ymin, ymax, k) {
    const sx = (xmax - xmin) || 1, sy = (ymax - ymin) || 1;
    const out = [];
    for (const a of cloud.anchors) {
      const dd = Math.hypot((a.f[fx] - cx) / sx, (a.f[fy] - cy) / sy);
      out.push({ genre: a.g, dist: dd, x: a.f[fx], y: a.f[fy] });
    }
    out.sort((p, q) => p.dist - q.dist || (p.genre < q.genre ? -1 : 1));
    return out.slice(0, k);
  }

  function regions(opts) {
    opts = opts || {};
    const bins = opts.bins || 6;
    const pairs = opts.pairs || DEFAULT_PAIRS;
    const top = opts.top == null ? 6 : opts.top;
    const cloud = buildCloud(opts);
    const pairReports = pairs.map(([a, b]) => {
      const pr = pairEmpty(cloud, a, b, bins);
      return { ...pr, empties: pr.empties.slice(0, top) };
    });
    return { nBlends: cloud.blends.length, nAnchors: cloud.anchors.length, bins, seed: cloud.seed, pairs: pairReports };
  }

  // ---- (3) classify a requested feature target ----------------------------
  // For each named dim: below/above/inside the reachable envelope. Then the joint
  // verdict: nearest reachable BLEND sample (z-scored distance over the named dims,
  // so scales are fair), returning that blend's weights as a starting recipe.
  function classify(target, opts) {
    const { envelope: env, dims } = envelope(opts);
    const cloud = buildCloud(opts);
    const zs = G.zstats(); // {feature:{mean,sd}} — shared z-scoring, not re-derived
    const keys = Object.keys(target).filter((d) => dims.indexOf(d) >= 0);
    const unknown = Object.keys(target).filter((d) => dims.indexOf(d) < 0);

    const perFeature = {};
    let anyOutside = false;
    for (const d of keys) {
      const v = target[d], e = env[d];
      let label, residual = 0;
      if (v < e.min) { label = "below-envelope"; residual = e.min - v; anyOutside = true; }
      else if (v > e.max) { label = "above-envelope"; residual = v - e.max; anyOutside = true; }
      else if (v < e.p02 || v > e.p98) label = "inside-edge"; // reachable but only by outliers
      else label = "inside";
      perFeature[d] = { value: v, label, residual, envelope: [e.min, e.max], robust: [e.p02, e.p98] };
    }

    // joint nearest reachable blend over the named dims, in z units.
    let best = { dist: Infinity, weights: null };
    if (keys.length) {
      for (const p of cloud.blends) {
        let s = 0;
        for (const d of keys) {
          const sd = (zs[d] && zs[d].sd) || 1;
          const z = (target[d] - zs[d].mean) / sd;
          const zf = (p.f[d] - zs[d].mean) / sd;
          s += (z - zf) ** 2;
        }
        const dd = Math.sqrt(s);
        if (dd < best.dist) best = { dist: dd, weights: p.w, f: p.f };
      }
    }
    const perDimResidual = keys.length ? best.dist / Math.sqrt(keys.length) : 0;
    // per-dim z-RMS < POP_THRESH => a blend already lands close (populated).
    const POP_THRESH = 0.5;

    let verdict, note;
    if (unknown.length && !keys.length) {
      verdict = "unknown-features";
      note = "no recognised verifier features in the request: " + unknown.join(", ");
    } else if (anyOutside) {
      verdict = "needs-new-vocabulary";
      const off = keys.filter((d) => perFeature[d].label.endsWith("-envelope"));
      note = "outside the reachable envelope on: " + off.join(", ") +
        " — no blend of the current catalog reaches these; filling this needs hand-authored vocabulary (samples/kits/recipes).";
    } else if (perDimResidual > POP_THRESH) {
      verdict = "reachable-but-unpopulated";
      note = "every named dim is inside the reachable envelope, but the nearest actual blend sits " +
        perDimResidual.toFixed(2) + " z-sd/dim away — a genuine gap; aim target-blend.js here.";
    } else {
      verdict = "reachable-populated";
      note = "a blend already lands close (" + perDimResidual.toFixed(2) + " z-sd/dim) — start from the weights below.";
    }

    return {
      verdict, note, perFeature,
      unknownFeatures: unknown,
      nearestBlend: best.weights
        ? { residualZ: best.dist, perDimZ: perDimResidual, weights: best.weights }
        : null,
    };
  }

  // ---- CLI ----------------------------------------------------------------
  function fmt(x) {
    if (typeof x !== "number" || !isFinite(x)) return String(x);
    return Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }
  function parseArgs(argv) {
    const o = {}; const pos = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--n") o.n = parseInt(argv[++i], 10);
      else if (a === "--seed") o.seed = parseInt(argv[++i], 10);
      else if (a === "--bins") o.bins = parseInt(argv[++i], 10);
      else if (a === "--top") o.top = parseInt(argv[++i], 10);
      else if (a === "--maxparents") o.maxParents = parseInt(argv[++i], 10);
      else if (a === "--pairs") o.pairs = argv[++i].split(",").map((p) => p.split(":"));
      else if (a === "--json") o.json = true;
      else pos.push(a);
    }
    return { o, pos };
  }
  function parseTarget(spec) {
    const t = {};
    for (const part of spec.split(",")) {
      const [k, v] = part.split("=");
      if (k && v !== undefined) t[k.trim()] = parseFloat(v);
    }
    return t;
  }

  function printEnvelope(r) {
    console.log(`reachable envelope  (${r.nBlends} blends + ${r.nAnchors} anchors, seed ${r.seed})`);
    console.log("  " + "feature".padEnd(14) + "min".padStart(9) + "p02".padStart(9) +
      "median".padStart(9) + "p98".padStart(9) + "max".padStart(9));
    for (const d of r.dims) {
      const e = r.envelope[d];
      console.log("  " + d.padEnd(14) + fmt(e.min).padStart(9) + fmt(e.p02).padStart(9) +
        fmt(e.median).padStart(9) + fmt(e.p98).padStart(9) + fmt(e.max).padStart(9));
    }
    console.log("\n  min/max = hard reachability bound; a target outside it needs new vocabulary.");
  }

  function printRegions(r) {
    console.log(`emptiest reachable regions  (${r.nBlends} blends + ${r.nAnchors} anchors, ${r.bins}x${r.bins} grids, seed ${r.seed})`);
    for (const pg of r.pairs) {
      console.log("");
      console.log(`  ${pg.fx} x ${pg.fy}   ${pg.occupied}/${pg.total} occupied, ${pg.interiorCells} interior(reachable)`);
      console.log(`    x=${pg.fx} ${fmt(pg.xmin)}..${fmt(pg.xmax)}   y=${pg.fy} ${fmt(pg.ymin)}..${fmt(pg.ymax)}`);
      for (let iy = pg.bins - 1; iy >= 0; iy--) {
        let row = "    y" + iy + " ";
        for (let ix = 0; ix < pg.bins; ix++) row += pg.grid[iy][ix] > 0 ? " #" : " .";
        console.log(row);
      }
      let xr = "        ";
      for (let ix = 0; ix < pg.bins; ix++) xr += ("x" + ix).padStart(2);
      console.log(xr);
      if (!pg.empties.length) { console.log("    (no interior empty cells — reachable region is fully populated)"); continue; }
      console.log(`    emptiest reachable cells (deepest void first):`);
      for (const c of pg.empties) {
        console.log(`      [${pg.fx} ${fmt(c.x[0])}..${fmt(c.x[1])}] x [${pg.fy} ${fmt(c.y[0])}..${fmt(c.y[1])}]  voidDepth ${c.voidDepth.toFixed(2)}`);
        console.log(`        neighbours: ` + c.neighbors.map((nb) => `${nb.genre}(${fmt(nb.x)},${fmt(nb.y)})`).join(", "));
      }
    }
  }

  function printClassify(target, r) {
    console.log("classify request: " + Object.entries(target).map(([k, v]) => `${k}=${fmt(v)}`).join(", "));
    console.log("  VERDICT: " + r.verdict.toUpperCase());
    console.log("  " + r.note);
    console.log("  per-feature:");
    for (const [d, pf] of Object.entries(r.perFeature)) {
      const tail = pf.residual ? `  (residual ${fmt(pf.residual)})` : "";
      console.log(`    ${d.padEnd(12)} ${fmt(pf.value).padStart(8)}  ${pf.label.padEnd(16)} envelope[${fmt(pf.envelope[0])}..${fmt(pf.envelope[1])}]${tail}`);
    }
    if (r.unknownFeatures.length) console.log("  ignored (not verifier features): " + r.unknownFeatures.join(", "));
    if (r.nearestBlend) {
      console.log(`  nearest reachable blend: ${r.nearestBlend.perDimZ.toFixed(2)} z-sd/dim away`);
      console.log("    weights: " + r.nearestBlend.weights.map((x) => `${x.g}:${x.w.toFixed(2)}`).join(", "));
    }
  }

  module.exports = { buildCloud, envelope, regions, classify, pairEmpty, mulberry32 };

  if (require.main === module) {
    const { o, pos } = parseArgs(process.argv.slice(2));
    const cmd = pos[0] || "regions";
    if (cmd === "envelope") {
      const r = envelope(o);
      if (o.json) console.log(JSON.stringify(r, null, 2)); else printEnvelope(r);
    } else if (cmd === "regions") {
      const r = regions(o);
      if (o.json) console.log(JSON.stringify(r, null, 2)); else printRegions(r);
    } else if (cmd === "classify") {
      const target = parseTarget(pos[1] || "");
      const r = classify(target, o);
      if (o.json) console.log(JSON.stringify(r, null, 2)); else printClassify(target, r);
    } else {
      console.log("usage: empty-space.js <envelope|regions|classify> [args]");
      console.log("  envelope [--n N] [--seed S] [--json]");
      console.log("  regions  [--n N] [--seed S] [--bins B] [--pairs a:b,c:d] [--top K] [--json]");
      console.log("  classify feat=val,feat=val [--n N] [--seed S] [--json]");
    }
  }
})();
