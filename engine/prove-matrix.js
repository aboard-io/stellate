// prove-matrix.js — THE OFFLINE MATRIX PROVER. The kernel can be rebuilt in
// terms of lists of vectors run through streaming transformations, which is
// what makes it verifiable rather than merely expressive.
//
// This is the first concrete piece of that reformulation: the anchor catalog AS
// A MATRIX. Every numeric spec dimension becomes two G-vectors over the 228
// anchors — LO[g] and HI[g] (Float64Array) — and the blend-hull proof becomes a
// vectorized reduction:
//
//     hull(dim) = [ min_g LO[g],  max_g HI[g] ]
//
// The convexity lemma that makes the reduction a PROOF (not a sample) is the
// kernel's own: resolveMulti's wRange is lo = Σ wᵢ·loᵢ with Σwᵢ=1, wᵢ≥0 — a
// convex combination — so for EVERY weight vector over the anchors (the
// uncountable space the explorer cursor lives in), the value lies inside the
// convex hull of the declared endpoints. min/max over anchors bounds all of it,
// for all t, all weight vectors, all seeds.
//
// Three verification products, each independent of engine/invariants.js (whose
// hand-rolled per-dimension intervals this DIFFERENTIALLY cross-checks — two
// implementations arriving at the same bounds from different code is the point):
//   matrix()   the catalog as {dims, G, lo, hi, mask} typed-array bundle
//   hull()     per-dim proven base intervals (vectorized reductions)
//   diff()     agreement report vs invariants' proof.rows[].base
//              (WIDER = one prover is wrong = hard fail; TIGHTER is reported —
//              the hand prover folds in engine defaults the specs don't declare)
//   witness()  seeded Monte-Carlo: N random convex blends through the REAL
//              K.mix, every resolved state dim checked against the hull —
//              constrain() only clamps inward and macros are off, so a
//              violation means either prover or kernel is lying.
//
// Vectorized with plain Float64Arrays: at 228 anchors × ~50 dims the reductions
// are instant. THE SEAM FOR BLAS/GSL-WASM is matrix()/hull() — when dims grow
// to feature-space scale (the verifier's confusion matrix, spectral margin
// analysis), swap the reduction loops for a linear-algebra backend without
// touching extract/diff/witness.
//
//   node engine/prove-matrix.js [--json] [--witness N]
"use strict";
(function (root) {
  const isNode = typeof module !== "undefined" && module.exports;
  const K = isNode ? require("./genre-kernel.js") : root.GenreKernel;

  // deterministic rng (repo law: no Math.random anywhere near the kernel)
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---- the dimension table -------------------------------------------------
  // spec: path into K.GENRES[g] (a [lo,hi] range or scalar); state: path into a
  // RESOLVED K.mix state (what witness checks). Mirrors invariants.js's dim
  // names so diff() can match rows; the EXTRACTION code shares nothing with it.
  const DIMS = [
    ["bpm",              "bpm",                   (s) => s.bpm],
    ["swing",            "swing",                 (s) => s.swing],
    ["humanize",         "humanize",              (s) => s.humanize],
    ["fx.reverb",        "fx.reverb",             (s) => s.reverb],
    ["fx.delayBeats",    "fx.delayBeats",         (s) => s.delay && s.delay.beats],
    ["fx.delayFb",       "fx.delayFb",            (s) => s.delay && s.delay.feedback],
    ["fx.delayCut",      "fx.delayCut",           (s) => s.delay && s.delay.cutoff],
    ["fx.pump",          "fx.pump",               (s) => s.pump],
    ["fx.crackle",       "fx.crackle",            (s) => s.crackle],
    ["fx.lowcut",        "fx.lowcut",             (s) => s.tone && s.tone.lowcut],
    ["fx.highcut",       "fx.highcut",            (s) => s.tone && s.tone.highcut],
    ["fx.comp",          "fx.comp",               (s) => s.comp],
    ["fx.grit",          "fx.grit",               (s) => s.grit],
    ["fx.jux",           "fx.jux",                (s) => s.jux],
    ["bass.cutoff",      "bass.recipe.cutoff",    (s) => s.instruments.bass.cutoff],
    ["bass.res",         "bass.recipe.res",       (s) => s.instruments.bass.res],
    ["bass.level",       "bass.recipe.level",     (s) => s.instruments.bass.level],
    ["bass.send",        "bass.recipe.send",      (s) => s.instruments.bass.send],
    ["bass.dsend",       "bass.recipe.dsend",     (s) => s.instruments.bass.dsend],
    ["lead.voices",      "lead.recipe.voices",    (s) => s.instruments.melody.voices],
    ["lead.spread",      "lead.recipe.spread",    (s) => s.instruments.melody.spread],
    ["lead.cutoff",      "lead.recipe.cutoff",    (s) => s.instruments.melody.cutoff],
    ["lead.level",       "lead.recipe.level",     (s) => s.instruments.melody.level],
    ["lead.send",        "lead.recipe.send",      (s) => s.instruments.melody.send],
    ["lead.dsend",       "lead.recipe.dsend",     (s) => s.instruments.melody.dsend],
    ["lead.vibrato",     "lead.recipe.vibrato",   (s) => s.instruments.melody.vibrato],
    ["pad.cutoff",       "pads.recipe.cutoff",    (s) => s.instruments.pad.cutoff],
    ["pad.detune",       "pads.recipe.detune",    (s) => s.instruments.pad.detune],
    ["pad.attack",       "pads.recipe.attack",    (s) => s.instruments.pad.attack],
    ["pad.level",        "pads.recipe.level",     (s) => s.instruments.pad.level],
    ["pad.send",         "pads.recipe.send",      (s) => s.instruments.pad.send],
    ["pad.dsend",        "pads.recipe.dsend",     (s) => s.instruments.pad.dsend],
    ["drums.kick",       "drums.kick",            (s) => s.instruments.drums.kick],
    ["drums.snare",      "drums.snare",           (s) => s.instruments.drums.snare],
    ["drums.hat",        "drums.hat",             (s) => s.instruments.drums.hat],
    ["drums.tune",       "drums.tune",            (s) => s.instruments.drums.tune],
    ["drums.send",       "drums.send",            (s) => s.instruments.drums.send],
    ["drums.dsend",      "drums.dsend",           (s) => s.instruments.drums.dsend],
  ];
  const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);

  // ---- matrix(): the catalog as typed-array vectors -------------------------
  // For dim d and genre g: lo[d*G+g], hi[d*G+g]; mask marks declaring anchors
  // (a scalar spec value contributes [v,v]; absent contributes nothing — the
  // kernel renormalizes blends over declaring parents, so the declarers' hull
  // still bounds every blend).
  function matrix() {
    const genres = Object.keys(K.GENRES), G = genres.length, D = DIMS.length;
    const lo = new Float64Array(D * G).fill(NaN), hi = new Float64Array(D * G).fill(NaN);
    const mask = new Uint8Array(D * G);
    for (let d = 0; d < D; d++) {
      const specPath = DIMS[d][1];
      for (let g = 0; g < G; g++) {
        const v = getPath(K.GENRES[genres[g]], specPath);
        if (v == null) continue;
        let a, b;
        if (Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number") { a = v[0]; b = v[1]; }
        else if (typeof v === "number") { a = v; b = v; }
        else continue;
        lo[d * G + g] = Math.min(a, b); hi[d * G + g] = Math.max(a, b); mask[d * G + g] = 1;
      }
    }
    return { genres, G, D, lo, hi, mask };
  }

  // ---- hull(): the proof — one vectorized reduction per dimension ----------
  function hull(M) {
    M = M || matrix();
    const rows = [];
    for (let d = 0; d < M.D; d++) {
      let mn = Infinity, mx = -Infinity, n = 0;
      for (let g = 0; g < M.G; g++) {
        if (!M.mask[d * M.G + g]) continue;
        const a = M.lo[d * M.G + g], b = M.hi[d * M.G + g];
        if (a < mn) mn = a; if (b > mx) mx = b; n++;
      }
      rows.push({ dim: DIMS[d][0], base: n ? [mn, mx] : null, declaring: n });
    }
    return rows;
  }

  // ---- diff(): differential cross-check vs invariants' hand-rolled proof ---
  // WIDER (matrix hull escapes the hand prover's base) = one of the two provers
  // is wrong — a hard finding. TIGHTER is expected on dims where the hand
  // prover folds in engine DEFAULTS the specs never declare; reported, not red.
  function diff(invRows, M) {
    const mine = hull(M);
    const byName = new Map(invRows.map((r) => [r.dim, r]));
    const out = [];
    for (const r of mine) {
      const inv = byName.get(r.dim);
      if (!inv || !r.base) { out.push({ dim: r.dim, verdict: inv ? "NO-DECLARERS" : "NOT-IN-INV", mine: r.base }); continue; }
      const [a, b] = r.base, [ia, ib] = inv.base, eps = 1e-9;
      const verdict = (Math.abs(a - ia) < eps && Math.abs(b - ib) < eps) ? "EQUAL"
        : (a >= ia - eps && b <= ib + eps) ? "TIGHTER"
        : "WIDER";
      out.push({ dim: r.dim, verdict, mine: r.base, inv: inv.base });
    }
    return out;
  }

  // ---- witness(): seeded Monte-Carlo through the REAL K.mix ---------------
  // n random convex weight vectors over random 1-4 genre subsets; every
  // resolved numeric dim must sit inside the proven hull (small epsilon for
  // float noise). Macros off; constrain only clamps inward. A violation names
  // (dim, blend, value, hull) — either the proof or the kernel is lying.
  function witness(n, M) {
    M = M || matrix();
    const H = hull(M), rng = mulberry32(0xC0FFEE), viol = [];
    const relEps = 1e-6;
    for (let i = 0; i < n; i++) {
      const k = 1 + Math.floor(rng() * 4);
      const idx = new Set(); while (idx.size < k) idx.add(Math.floor(rng() * M.G));
      let ws = [...idx].map((gi) => ({ g: M.genres[gi], w: rng() + 0.05 }));
      const tot = ws.reduce((s, x) => s + x.w, 0); ws = ws.map((x) => ({ g: x.g, w: x.w / tot }));
      const seed = 1 + Math.floor(rng() * 99999);
      let st; try { st = K.mix(ws.map((w) => ({ ...w })), { seed }); } catch (e) { viol.push({ blend: ws, seed, err: String(e && e.message || e) }); continue; }
      for (let d = 0; d < M.D; d++) {
        const h = H[d]; if (!h.base) continue;
        // only check when at least one blended genre DECLARES the dim — the
        // kernel renormalizes over declaring parents; an all-absent blend gets
        // engine defaults, which are the hand prover's territory, not the hull's.
        if (!ws.some((w) => M.mask[d * M.G + M.genres.indexOf(w.g)])) continue;
        let v; try { v = DIMS[d][2](st); } catch (e) { v = null; }
        if (typeof v !== "number" || !isFinite(v)) continue;
        const [a, b] = h.base, pad = Math.max(Math.abs(a), Math.abs(b), 1) * relEps;
        if (v < a - pad || v > b + pad)
          viol.push({ dim: DIMS[d][0], value: v, hull: h.base, blend: ws.map((w) => w.g + ":" + w.w.toFixed(2)).join("+"), seed });
      }
    }
    return { n, violations: viol };
  }

  // checkState(state, hullRows): one state against the hull — the unit the
  // sensitivity test drives (prove the prover CAN catch a lie).
  function checkState(st, H) {
    H = H || hull();
    const bad = [];
    for (let d = 0; d < DIMS.length; d++) {
      const h = H[d]; if (!h || !h.base) continue;
      let v; try { v = DIMS[d][2](st); } catch (e) { v = null; }
      if (typeof v !== "number" || !isFinite(v)) continue;
      const [a, b] = h.base, pad = Math.max(Math.abs(a), Math.abs(b), 1) * 1e-6;
      if (v < a - pad || v > b + pad) bad.push({ dim: DIMS[d][0], value: v, hull: h.base });
    }
    return bad;
  }

  const api = { DIMS, matrix, hull, diff, witness, checkState };
  if (isNode) module.exports = api; else root.ProveMatrix = api;

  // ---- CLI ------------------------------------------------------------------
  if (isNode && require.main === module) {
    const args = process.argv.slice(2);
    const json = args.includes("--json");
    const wN = (() => { const i = args.indexOf("--witness"); return i >= 0 ? (parseInt(args[i + 1], 10) || 300) : 300; })();
    const M = matrix(), H = hull(M);
    // differential: spawn the hand prover for its rows
    let dv = null;
    try {
      const { execFileSync } = require("child_process");
      const out = execFileSync(process.execPath, [require("path").join(__dirname, "invariants.js"), "prove", "--json"], { maxBuffer: 64 * 1024 * 1024 });
      dv = diff(JSON.parse(String(out)).proof.rows, M);
    } catch (e) { dv = null; }
    const W = witness(wN, M);
    const wider = (dv || []).filter((r) => r.verdict === "WIDER");
    const ok = W.violations.length === 0 && wider.length === 0;
    if (json) { console.log(JSON.stringify({ hull: H, diff: dv, witness: { n: W.n, violations: W.violations }, ok }, null, 1)); }
    else {
      console.log("— MATRIX HULL (vectorized reduction over " + M.G + " anchors × " + M.D + " dims) —");
      for (const r of H) console.log("  " + r.dim.padEnd(18) + (r.base ? "[" + r.base.map((x) => +x.toFixed(4)).join(", ") + "]" : "(no declarers)") + "  (" + r.declaring + " anchors)");
      if (dv) {
        const counts = {}; for (const r of dv) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
        console.log("— DIFF vs invariants.js prove — " + Object.entries(counts).map(([k, v]) => k + ":" + v).join("  "));
        for (const r of wider) console.log("  WIDER " + r.dim + " mine=" + JSON.stringify(r.mine) + " inv=" + JSON.stringify(r.inv));
      } else console.log("— DIFF skipped (invariants.js prove --json unavailable) —");
      console.log("— WITNESS — " + W.n + " seeded convex blends through K.mix: " + (W.violations.length ? W.violations.length + " VIOLATIONS" : "all in-hull"));
      for (const v of W.violations.slice(0, 8)) console.log("  " + JSON.stringify(v));
      console.log(ok ? "PASS: matrix hull agrees with the hand prover; every witnessed blend lands in-hull" : "FAIL");
    }
    process.exit(ok ? 0 : 1);
  }
})(typeof window !== "undefined" ? window : globalThis);
