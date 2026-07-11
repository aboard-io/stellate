// genre-sim.js — node-safe port of app/starmap.js:_genreSim (the anchor-material
// similarity used to lay out the star map). Weighted Jaccard over harmonic
// progressions + synth/sampler material (samplerPool + recipe.model per
// lead/bass/pads) + drum kits, plus a form-match term and bpm proximity.
//
// This is a DIAGNOSTIC/read-only twin of starmap's private closure — it reads
// K.GENRES only and never mutates it. The formula is copied byte-for-byte from
// starmap so downstream geometry agrees with the map the user actually sees:
//   sim = 2.2·jac(prog) + 2.0·jac(pool) + 0.8·jac(kits)
//         + 0.6·(form==form) + 0.8·(1 - min(1, |Δbpm|/80))
//
//   genreSim(a, b)        -> number (higher = more alike; a===b is the self-max)
//   nearestSim(genre, k)  -> [{genre, sim}] top-k other genres by similarity
//   node genre-sim.js <genre> [k]      print the k nearest anchors

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const K = isNode ? require("./genre-kernel.js") : root.GenreKernel;

  // weighted Jaccard over two Sets (0 when both empty — matches starmap)
  function jac(a, b) {
    if (!a.size && !b.size) return 0;
    let i = 0; for (const x of a) if (b.has(x)) i++;
    return i / (a.size + b.size - i);
  }

  // the union of synth/sampler MATERIAL a genre draws on: sample-pool ids
  // (prefixed s:) + recipe model names (prefixed m:) across lead/bass/pads.
  function poolsOf(o) {
    const s = new Set();
    for (const part of ["lead", "bass", "pads"]) {
      const p = o[part]; if (!p) continue;
      (p.samplerPool || []).forEach((x) => s.add("s:" + x));
      const rec = p.recipe || {};
      (Array.isArray(rec.model) ? rec.model : [rec.model]).forEach((x) => x && s.add("m:" + x));
    }
    return s;
  }

  let _F = null;   // memoized per-genre feature bundle (built once, read-only)
  function feats() {
    if (_F) return _F;
    const G = K.GENRES, F = {};
    for (const g of Object.keys(G)) {
      const o = G[g];
      F[g] = {
        prog: new Set(o.progressions || []),
        pool: poolsOf(o),
        kits: new Set(o.kits || []),
        form: o.form || "",
        bpm: o.bpm ? (o.bpm[0] + o.bpm[1]) / 2 : 110,
      };
    }
    _F = F; return F;
  }

  function genreSim(a, b) {
    const F = feats(), fa = F[a], fb = F[b];
    if (!fa || !fb) throw new Error("unknown genre: " + (fa ? b : a));
    return 2.2 * jac(fa.prog, fb.prog) + 2.0 * jac(fa.pool, fb.pool)
      + 0.8 * jac(fa.kits, fb.kits) + 0.6 * (fa.form === fb.form ? 1 : 0)
      + 0.8 * (1 - Math.min(1, Math.abs(fa.bpm - fb.bpm) / 80));
  }

  function nearestSim(genre, k) {
    const F = feats();
    if (!F[genre]) throw new Error("unknown genre: " + genre);
    const out = [];
    for (const g of Object.keys(F)) {
      if (g === genre) continue;
      out.push({ genre: g, sim: genreSim(genre, g) });
    }
    out.sort((x, y) => y.sim - x.sim);
    return k ? out.slice(0, k) : out;
  }

  const api = { genreSim, nearestSim };
  if (isNode) module.exports = api; else root.GenreSim = api;

  if (isNode && require.main === module) {
    const g = process.argv[2], k = parseInt(process.argv[3], 10) || 8;
    if (!g) { console.log("usage: genre-sim.js <genre> [k]"); process.exit(0); }
    console.log(`nearest ${k} to ${g} (weighted-Jaccard material similarity):`);
    for (const r of nearestSim(g, k)) console.log(`  ${r.genre.padEnd(16)} ${r.sim.toFixed(3)}`);
  }
})(typeof window !== "undefined" ? window : globalThis);
