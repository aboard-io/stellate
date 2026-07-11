#!/usr/bin/env node
// coverage.js — feature-space occupancy dashboard (ROADMAP §1.4.5).
//
// Reads the SAME measured point cloud the geometry lib / gate build over (the
// persisted per-(genre,seed) feature cache, via genre-geometry's scoredGenres +
// SEEDS, with the identical V.features(K.track(...)) fallback for any missing
// point) and reports, over RAW feature units:
//
//   (1) per-AXIS occupancy — min / q25 / median / q75 / max + fill for every
//       one of the 23 verifier features (where does the catalog actually sit on
//       each dimension, and how lopsided is it).
//   (2) joint occupancy over key feature PAIRS (bpm x swing, sub x wash,
//       motion x seventh by default) — a deterministic grid marking each joint
//       cell occupied or EMPTY, then listing the EMPTY cells as a creative-gap
//       prompt ("no genre lives at fast+straight", etc). Feeds the empty-region
//       tool and the how.html story.
//
// READ-ONLY + OFFLINE + DETERMINISTIC: never mutates K.GENRES, never runs during
// a render. Binning is data-driven off the cloud's own min/max with a fixed bin
// count, so same cache -> byte-identical report. Population = one point per genre
// = the mean of its seed vectors (the raw-unit analogue of a genre centroid).
//
//   coverage()                     -> { axes, pairs, nGenres }
//   node tools/coverage.js [opts]  -> printed dashboard
//     --bins N            grid resolution per axis (default 6)
//     --pairs a:b,c:d     override the pair list (feature names)
//     --axis <feat>       print only this axis' occupancy (still full pairs)
//     --json              emit the raw coverage() object as JSON

(function () {
  "use strict";
  const G = require("../engine/genre-geometry.js");
  const K = require("../engine/genre-kernel.js");
  const V = require("../engine/genre-verifier.js");
  const L = require("../engine/verify-lib.js");

  const DEFAULT_PAIRS = [["bpm", "swing"], ["sub", "wash"], ["motion", "seventh"]];

  // one raw-feature point per genre = mean over its seed vectors. Same population
  // + same cache-then-fallback path as genre-geometry.loadPoints, kept in raw
  // units (not z-scored) so occupancy reads in real bpm / 0..1 terms.
  function genrePoints() {
    const cache = (L && L.loadFeats) ? L.loadFeats() : {};
    const genres = G.scoredGenres();
    const seeds = G.SEEDS;
    const pts = [];
    for (const g of genres) {
      const vecs = [];
      for (const seed of seeds) {
        const key = g + ":" + seed;
        vecs.push(cache[key] || V.features(K.track(g, { seed })));
      }
      const dims = Object.keys(vecs[0]).filter((k) => typeof vecs[0][k] === "number");
      const mean = {};
      for (const d of dims) mean[d] = vecs.reduce((s, v) => s + v[d], 0) / vecs.length;
      pts.push({ g, f: mean });
    }
    return pts;
  }

  // deterministic quantile: sort ascending, linear-interpolate at rank q*(n-1).
  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    if (sorted.length === 1) return sorted[0];
    const pos = q * (sorted.length - 1);
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // data-driven bin index: [min,max] split into `bins` equal cells; max lands in
  // the last cell; degenerate (max==min) -> cell 0. Deterministic.
  function binIndex(v, min, max, bins) {
    if (max <= min) return 0;
    let i = Math.floor(((v - min) / (max - min)) * bins);
    if (i >= bins) i = bins - 1;
    if (i < 0) i = 0;
    return i;
  }

  function axisStats(pts, dim) {
    const vals = pts.map((p) => p.f[dim]).filter((x) => typeof x === "number");
    const sorted = vals.slice().sort((a, b) => a - b);
    return {
      dim,
      n: sorted.length,
      min: sorted[0],
      q25: quantile(sorted, 0.25),
      median: quantile(sorted, 0.5),
      q75: quantile(sorted, 0.75),
      max: sorted[sorted.length - 1],
    };
  }

  // joint grid for one feature pair. Returns bin edges, an occupancy count
  // matrix [bins x bins], and the list of empty cells (with their raw ranges).
  function pairGrid(pts, fx, fy, bins) {
    const xs = pts.map((p) => p.f[fx]), ys = pts.map((p) => p.f[fy]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const grid = Array.from({ length: bins }, () => new Array(bins).fill(0));
    for (const p of pts) {
      const ix = binIndex(p.f[fx], xmin, xmax, bins);
      const iy = binIndex(p.f[fy], ymin, ymax, bins);
      grid[iy][ix]++;
    }
    const edge = (min, max, i) => min + ((max - min) * i) / bins;
    const empty = [];
    let occupied = 0;
    for (let iy = 0; iy < bins; iy++) {
      for (let ix = 0; ix < bins; ix++) {
        if (grid[iy][ix] > 0) { occupied++; continue; }
        empty.push({
          ix, iy,
          x: [edge(xmin, xmax, ix), edge(xmin, xmax, ix + 1)],
          y: [edge(ymin, ymax, iy), edge(ymin, ymax, iy + 1)],
        });
      }
    }
    return {
      fx, fy, bins, xmin, xmax, ymin, ymax, grid, empty,
      occupied, total: bins * bins,
    };
  }

  function coverage(opts) {
    opts = opts || {};
    const bins = opts.bins || 6;
    const pairs = opts.pairs || DEFAULT_PAIRS;
    const pts = genrePoints();
    const dims = Object.keys(pts[0].f).filter((k) => typeof pts[0].f[k] === "number");
    const axes = dims.map((d) => axisStats(pts, d));
    const pairGrids = pairs.map(([a, b]) => pairGrid(pts, a, b, bins));
    return { nGenres: pts.length, bins, axes, pairs: pairGrids };
  }

  // ---- CLI --------------------------------------------------------------
  function fmt(x) {
    if (typeof x !== "number" || !isFinite(x)) return String(x);
    return Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }
  function bar(frac, w) {
    const n = Math.round(frac * w);
    return "#".repeat(n) + "-".repeat(w - n);
  }

  function printReport(cov, only) {
    console.log(`coverage dashboard  (${cov.nGenres} genres, ${cov.bins}x${cov.bins} grids)`);
    console.log("");
    console.log("per-axis occupancy (raw units):");
    console.log("  " + "axis".padEnd(14) + "min".padStart(9) + "q25".padStart(9) +
      "med".padStart(9) + "q75".padStart(9) + "max".padStart(9) + "  spread");
    for (const a of cov.axes) {
      if (only && a.dim !== only) continue;
      // spread bar: q25..q75 interquartile band placed within [min,max].
      const span = a.max - a.min || 1;
      const w = 20;
      const lo = Math.round(((a.q25 - a.min) / span) * w);
      const hi = Math.round(((a.q75 - a.min) / span) * w);
      let s = "";
      for (let i = 0; i < w; i++) s += (i >= lo && i <= hi) ? "=" : ".";
      console.log("  " + a.dim.padEnd(14) + fmt(a.min).padStart(9) + fmt(a.q25).padStart(9) +
        fmt(a.median).padStart(9) + fmt(a.q75).padStart(9) + fmt(a.max).padStart(9) + "  [" + s + "]");
    }

    console.log("");
    console.log("joint occupancy over key feature pairs:");
    for (const pg of cov.pairs) {
      const fillPct = ((pg.occupied / pg.total) * 100).toFixed(0);
      console.log("");
      console.log(`  ${pg.fx} x ${pg.fy}   ${pg.occupied}/${pg.total} cells filled (${fillPct}%)`);
      console.log(`    x=${pg.fx} ${fmt(pg.xmin)}..${fmt(pg.xmax)}   y=${pg.fy} ${fmt(pg.ymin)}..${fmt(pg.ymax)}`);
      // grid, top row = high y. '#'=occupied, '.'=empty.
      for (let iy = pg.bins - 1; iy >= 0; iy--) {
        let row = "    y" + String(iy) + " ";
        for (let ix = 0; ix < pg.bins; ix++) row += (pg.grid[iy][ix] > 0 ? " #" : " .");
        console.log(row);
      }
      let xr = "        ";
      for (let ix = 0; ix < pg.bins; ix++) xr += ("x" + ix).padStart(2);
      console.log(xr);
      if (pg.empty.length) {
        console.log(`    EMPTY cells (creative gaps) — ${pg.empty.length}:`);
        for (const c of pg.empty) {
          console.log(`      ${pg.fx}[${fmt(c.x[0])}..${fmt(c.x[1])}] x ${pg.fy}[${fmt(c.y[0])}..${fmt(c.y[1])}]`);
        }
      } else {
        console.log("    (no empty cells — this pair is fully covered)");
      }
    }
  }

  function parseArgs(argv) {
    const o = {};
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--bins") o.bins = parseInt(argv[++i], 10);
      else if (a === "--axis") o.axis = argv[++i];
      else if (a === "--json") o.json = true;
      else if (a === "--pairs") {
        o.pairs = argv[++i].split(",").map((p) => p.split(":"));
      }
    }
    return o;
  }

  module.exports = { coverage, genrePoints, axisStats, pairGrid, quantile, binIndex };

  if (require.main === module) {
    const o = parseArgs(process.argv.slice(2));
    const cov = coverage({ bins: o.bins, pairs: o.pairs });
    if (o.json) { console.log(JSON.stringify(cov, null, 2)); return; }
    printReport(cov, o.axis);
  }
})();
