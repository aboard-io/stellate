#!/usr/bin/env node
// invent-genres.js — an AUTOMATED genre-invention pipeline. NO LLM in the core
// loop: it EMBEDS every existing genre in the verifier's own scored-feature
// space, FINDS the largest empty regions (farthest-point sampling), INVENTS a
// well-formed genre-kernel anchor at each gap (clone the nearest neighbour, then
// TRANSPLANT the organs of whichever genres best exemplify the gap's most
// divergent coordinates, and set the pure-numeric dims straight from the gap
// centroid), NAMES it algorithmically (a ridiculous-but-legible compound that
// correlates to the vector — a TEXTURE prefix fused to a TEMPO/RHYTHM suffix, via
// namebank.inventGenreName), then GATES it honestly: derive a verifier target row
// (the proven genre-tool machinery), and ACCEPT only if the invention holds its
// own diagonal AND knocks no existing genre off theirs. A gap that cannot be made
// diagonal-distinct is REJECTED — the verifier correctly calling it noise, not a
// genre. Deterministic + seedable; re-run to propose more (the flood).
//
//   node tools/genre/invent-genres.js [--seed N] [--count N] [--accept N] [--seeds N]
//                               [--write] [--specs] [--verbose] [--json]
//
//   (default) dry run: embed -> gaps -> invent -> name -> gate -> REPORT accept/reject
//   --write   splice the accepted anchors into engine/genres-data.js (GENRES)
//             and their target rows into engine/genre-verifier.js
//   --specs   also dump each accepted genre's spec.json under genre-specs/invented/
//
// Reuses (never duplicates) tools/genre/genre-tool.js — the measure -> derive-targets
// (auto-tighten) -> serialize -> splice machinery — and engine/namebank.js — the
// deterministic lexicon namer. Zero deps; reads the live schema, so it always
// tracks the engine.

"use strict";
const fs = require("fs");
const path = require("path");
const K = require("../../engine/genre-kernel.js");
const V = require("../../engine/genre-verifier.js");
const T = require("./genre-tool.js");
const NB = require("../../engine/namebank.js");

const ROOT = path.join(__dirname, "..", "..");

// ---------- CLI ----------
const argv = process.argv.slice(2);
const has = f => argv.includes("--" + f);
const opt = (f, d) => { const i = argv.indexOf("--" + f); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const SEED = parseInt(opt("seed", 7), 10);
const COUNT = parseInt(opt("count", 16), 10);       // candidate gaps to explore
const ACCEPT_MAX = parseInt(opt("accept", 8), 10);  // keep at most this many
const MEASURE_SEEDS = Array.from({ length: parseInt(opt("seeds", 6), 10) }, (_, i) => i + 1);
const EMBED_SEEDS = [1, 2, 3, 4];
const VERBOSE = has("verbose");
const JSON_OUT = has("json");

// ---------- determinism-preserving memo (speed only) ----------
// K.track(g,{seed}) and V.features(state) are deterministic; the pipeline calls
// them thousands of times (deriveTargets re-scores every existing genre per
// candidate). Memoise both — byte-identical results, ~30x fewer buildEvents.
const _trackCache = new Map(), _origTrack = K.track.bind(K);
K.track = function (g, o) {
  o = o || {};
  if (Object.keys(o).every(k => k === "seed")) {
    const key = g + ":" + (o.seed || 0);
    if (_trackCache.has(key)) return _trackCache.get(key);
    const st = _origTrack(g, o); _trackCache.set(key, st); return st;
  }
  return _origTrack(g, o);
};
const _featCache = new WeakMap(), _origFeat = V.features;
V.features = function (st) {
  if (st && typeof st === "object") {
    if (_featCache.has(st)) return _featCache.get(st);
    const f = _origFeat(st); _featCache.set(st, f); return f;
  }
  return _origFeat(st);
};

// ---------- deterministic rng (mulberry32, seeded) ----------
function rng(seed) { let a = seed >>> 0; return function () {
  a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clone = o => JSON.parse(JSON.stringify(o));
const r2 = x => Math.round(x * 100) / 100;
const r3 = x => Math.round(x * 1000) / 1000;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ================================================================= 1. EMBED
// Every genre is the MEAN of its measured feature vectors over EMBED_SEEDS, in
// the verifier's own scored dimensions (NUMERIC_FEATS). Normalise each dim to
// [0,1] over the observed genre spread so Euclidean distance == distinctness.
const DIMS = T.NUMERIC_FEATS;   // bpm, offgrid, ... leadVoices, softTop (22 dims)
const GENRES = Object.keys(V.TARGETS).filter(g => K.GENRES[g]);   // scored + real

function meanVec(g) {
  const acc = {}; DIMS.forEach(d => acc[d] = 0);
  for (const seed of EMBED_SEEDS) { const f = V.features(K.track(g, { seed })); DIMS.forEach(d => acc[d] += f[d] || 0); }
  DIMS.forEach(d => acc[d] /= EMBED_SEEDS.length);
  return acc;
}
const embed = {}; for (const g of GENRES) embed[g] = meanVec(g);
const LO = {}, HI = {};
for (const d of DIMS) {
  const vs = GENRES.map(g => embed[g][d]);
  LO[d] = Math.min(...vs); HI[d] = Math.max(...vs);
  if (HI[d] - LO[d] < 1e-9) HI[d] = LO[d] + 1;
}
const norm = vec => DIMS.map(d => (vec[d] - LO[d]) / (HI[d] - LO[d]));
const denorm = nv => { const o = {}; DIMS.forEach((d, i) => o[d] = LO[d] + nv[i] * (HI[d] - LO[d])); return o; };
const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
const P = {}; for (const g of GENRES) P[g] = norm(embed[g]);
const minDistToGenres = c => Math.min(...GENRES.map(g => dist(c, P[g])));
const nearest = c => { let best = null, bd = Infinity; for (const g of GENRES) { const d = dist(c, P[g]); if (d < bd) { bd = d; best = g; } } return { g: best, d: bd }; };

// ================================================================= 2. FIND GAPS
// Candidates stay on the "music manifold": blends of two genres (midpoint gaps)
// and extrapolations beyond the periphery ("beyond"). Score each by its distance
// to the NEAREST existing genre (the gap radius), then greedily farthest-point
// select so the chosen gaps are far from every genre AND from each other.
function generateGaps() {
  const R = rng(SEED * 1000 + 1);
  const gl = GENRES;
  const centroidAll = DIMS.map((_, i) => gl.reduce((s, g) => s + P[g][i], 0) / gl.length);
  const cands = [];
  const push = v => cands.push(v.map(x => clamp(x, -0.05, 1.05)));
  for (let it = 0; it < 6000; it++) {
    const kind = R();
    if (kind < 0.5) {                                   // midpoint-ish blend of two genres
      const a = P[gl[Math.floor(R() * gl.length)]], b = P[gl[Math.floor(R() * gl.length)]];
      const t = 0.35 + R() * 0.3;
      push(a.map((x, i) => x + t * (b[i] - x)));
    } else if (kind < 0.8) {                            // extrapolate beyond a peripheral genre
      const a = P[gl[Math.floor(R() * gl.length)]];
      const s = 0.15 + R() * 0.5;
      push(a.map((x, i) => x + s * (x - centroidAll[i])));
    } else {                                            // jittered centroid of three genres
      const a = P[gl[Math.floor(R() * gl.length)]], b = P[gl[Math.floor(R() * gl.length)]], c = P[gl[Math.floor(R() * gl.length)]];
      push(a.map((x, i) => (x + b[i] + c[i]) / 3 + (R() - 0.5) * 0.25));
    }
  }
  // greedy farthest-point: maximise min-dist to (genres ∪ already-picked)
  const picked = [];
  let pool = cands.map(v => ({ v, gap: minDistToGenres(v) })).filter(c => c.gap > 0.35);
  pool.sort((a, b) => b.gap - a.gap);
  while (picked.length < COUNT && pool.length) {
    let best = null;
    for (const c of pool) {
      const sepSel = picked.length ? Math.min(...picked.map(p => dist(c.v, p.v))) : Infinity;
      const score = Math.min(c.gap, sepSel);
      if (!best || score > best.score) best = { c, score };
    }
    if (!best || best.score < 0.3) break;
    picked.push({ v: best.c.v, gap: best.c.gap });
    pool = pool.filter(c => dist(c.v, best.c.v) > 0.45);   // thin out near-duplicates
  }
  return picked;
}

// ================================================================= 3. INVENT
// Numeric dims are set straight from the gap centroid; the discrete pools are
// assembled from body parts: clone the nearest neighbour for the skeleton, then
// TRANSPLANT — for each of the most-divergent musical facets — the sub-block of
// the existing genre that best exemplifies the gap's value on that facet.
const GROUPS = [
  { name: "harmony", dims: ["motion", "seventh"], fields: ["progressions", "chordEvery"] },
  { name: "rhythm", dims: ["drumDensity", "hatDensity", "offgrid", "snareBalance", "variation"], fields: ["drums", "kits", "fills"] },
  { name: "timbre", dims: ["acoustic"], fields: ["lead", "pads"] },
  { name: "lowend", dims: ["sub"], fields: ["bass"] },
  { name: "sampletex", dims: ["breakUse", "chopUse", "bedUse"], fields: ["found"] },
];
// donor best matching the gap on a group's dims (normalised L2 over the group)
function donorFor(dims, target, exclude) {
  let best = null, bd = Infinity;
  for (const g of GENRES) {
    if (g === exclude) continue;
    let s = 0; for (const d of dims) s += ((embed[g][d] - target[d]) / (HI[d] - LO[d])) ** 2;
    if (s < bd) { bd = s; best = g; }
  }
  return best;
}
function setBand(o, key, band) { if (o) o[key] = band; }
function invent(nv) {
  const target = denorm(nv);
  const nn = nearest(nv).g;
  const anchor = clone(K.GENRES[nn]);

  // --- transplant the top divergent facets from their exemplar donors ---
  const ranked = GROUPS.map(gr => ({
    gr, delta: gr.dims.reduce((s, d) => s + Math.abs(nv[DIMS.indexOf(d)] - P[nn][DIMS.indexOf(d)]), 0) / gr.dims.length,
  })).sort((a, b) => b.delta - a.delta);
  const transplants = [];
  for (const { gr, delta } of ranked) {
    if (transplants.length >= 3 || delta < 0.14) break;
    const donor = donorFor(gr.dims, target, nn);
    if (!donor || donor === nn) continue;
    let took = false;
    for (const f of gr.fields) if (K.GENRES[donor][f] != null) { anchor[f] = clone(K.GENRES[donor][f]); took = true; }
    if (took) transplants.push({ group: gr.name, donor, delta: r2(delta) });
  }

  // --- set the pure-numeric dims straight from the gap centroid ---
  const bpm = clamp(Math.round(target.bpm), 42, 224);
  anchor.bpm = [Math.max(40, bpm - 4), Math.min(230, bpm + 4)];
  anchor.swing = [Math.max(0, r3(target.swing - 0.02)), r3(target.swing + 0.03)];
  anchor.humanize = [Math.max(0, r3(target.humanize - 0.04)), r3(target.humanize + 0.05)];
  anchor.fx = anchor.fx || {};
  setBand(anchor.fx, "pump", [Math.max(0, r2(target.pump - 0.1)), clamp(r2(target.pump + 0.12), 0, 1)]);
  setBand(anchor.fx, "comp", [Math.max(0, r2(target.comp - 0.1)), clamp(r2(target.comp + 0.12), 0, 1)]);
  setBand(anchor.fx, "crackle", [Math.max(0, r2(target.crackle - 0.06)), clamp(r2(target.crackle + 0.1), 0, 1)]);
  const rv = clamp(target.wash / 0.4, 0.05, 0.95);   // wash ≈ reverb·(avg send)
  setBand(anchor.fx, "reverb", [Math.max(0, r2(rv - 0.08)), clamp(r2(rv + 0.1), 0, 1)]);
  anchor.fx.highcut = target.softTop >= 0.5 ? [2600, 3400] : [0, 0];
  if (anchor.lead && anchor.lead.recipe) {
    const lv = clamp(Math.round(target.leadVoices), 1, 9);
    anchor.lead.recipe.voices = [Math.max(1, lv - 1), Math.min(9, lv + 1)];
  }
  // rubato: only genres that OWN tempo-breathing carry it; borrow/remove to match
  if (target.rubato >= 0.012) {
    const donor = donorFor(["rubato"], target, nn);
    if (donor && K.GENRES[donor].rubato) anchor.rubato = clone(K.GENRES[donor].rubato);
  } else if (anchor.rubato) delete anchor.rubato;

  return { anchor, nn, transplants, target };
}

// ---------- NAME: derive traits from the vector, then the lexicon namer ----------
function traitsOf(target) {
  const b = target.bpm;
  const tempo = b < 70 ? "crawl" : b < 92 ? "slow" : b < 118 ? "mid" : b < 142 ? "drive" : b < 172 ? "fast" : "frantic";
  // texture = the most salient non-tempo trait (deviation toward an extreme)
  // salience = how far a trait leans toward its extreme; scaled so no single
  // dim dominates by default (the `sub` feature floors at ~0.6 for many genres,
  // so only genuinely subby ones — 0.6→1 — register).
  const S = {
    wash: clamp((target.wash - 0.28) / 0.4, 0, 1),
    dust: clamp((target.crackle - 0.12) / 0.45, 0, 1),
    acoustic: target.acoustic > 0.45 ? target.acoustic : 0,
    synth: (target.acoustic < 0.2 && target.sub < 0.6) ? 0.7 : 0,
    sub: clamp((target.sub - 0.62) / 0.38, 0, 1),
    swarm: clamp((target.leadVoices - 3) / 5, 0, 1),
    slam: clamp(target.comp * 0.6 + target.pump * 0.6 - 0.35, 0, 1),
    drone: target.drumDensity < 0.55 ? clamp(1 - target.drumDensity / 1.1, 0, 1) : 0,
    bright: (target.softTop < 0.5 && target.wash < 0.3 && target.seventh > 0.55) ? 0.8 : 0,
  };
  let texture = "synth", bestS = -1;
  for (const [k, v] of Object.entries(S)) if (v > bestS) { bestS = v; texture = k; }
  const rhythm = (target.breakUse + target.chopUse) > 0.3 ? "chop" : target.swing > 0.14 ? "swing" : null;
  return { texture, tempo, rhythm, salience: S };
}

// ================================================================= 4+5. GATE
// Inject candidate, MEASURE it, derive its target row (auto-tightened against
// every existing genre), and decide honestly: does it hold its own diagonal, and
// does it knock nobody off theirs? Accepted genres stay injected so later
// candidates are fenced against them too (sequential).
function derivedRowFor(name, target, nv, nn, vecs, stats) {
  // seed the verifier row with the dims where the gap is FARTHEST from its
  // neighbour (its distinguishing coordinates); deriveTargets auto-adds more.
  const deltas = DIMS.map(d => ({ d, x: Math.abs(nv[DIMS.indexOf(d)] - P[nn][DIMS.indexOf(d)]) }))
    .filter(o => o.d !== "bpm" && stats[o.d]).sort((a, b) => b.x - a.x);
  const feats = { bpm: 3 };
  deltas.slice(0, 4).forEach((o, i) => feats[o.d] = i < 2 ? 3 : 2);
  ["wash", "acoustic", "swing"].forEach(d => { if (stats[d] && !feats[d]) feats[d] = 1; });
  const spec = { name, verify: { features: feats, widen: 0.12 } };
  return T.deriveTargets(name, spec, stats, vecs);
}

function run() {
  const gaps = generateGaps();
  const taken = new Set([...Object.keys(K.GENRES), ...Object.keys(V.TARGETS)]);
  // reserve the naming ROOT of every existing genre so a flood never reuses one
  // (no four vendingmachine* genres — a shared root reads as noise even when the
  // vectors are distinct). Exhausting fresh roots is the honest saturation signal.
  const takenRoots = new Set([...taken].map(g => NB.genreRoot(g)).filter(Boolean));
  const accepted = [], rejected = [];

  for (let gi = 0; gi < gaps.length && accepted.length < ACCEPT_MAX; gi++) {
    const gap = gaps[gi];
    const { anchor, nn, transplants, target } = invent(gap.v);
    const traits = traitsOf(target);
    const mundane = rng(SEED * 7 + gi * 13)() < 0.4;
    const named = NB.inventGenreName({ texture: traits.texture, tempo: traits.tempo, rhythm: traits.rhythm, mundane }, SEED * 100 + gi, taken, takenRoots);
    if (!named) { rejected.push({ name: `(${traits.texture})`, nn, gap: r2(gap.gap), reason: `no root-unique name left in the ${traits.texture} lexicon — that texture's naming roots are spent` }); continue; }
    const { name, label, root } = named;

    // distinguishing dims (largest gap-vs-neighbour deltas), for the report
    const distinguishing = DIMS.map(d => ({ d, delta: r2(Math.abs(gap.v[DIMS.indexOf(d)] - P[nn][DIMS.indexOf(d)])), val: r2(target[d]) }))
      .sort((a, b) => b.delta - a.delta).slice(0, 5);

    anchor.label = label;
    anchor.info = `invented (gap-found): a ${traits.tempo}-tempo, ${traits.texture}-forward genre in the empty region near ${nn}${transplants.length ? " × " + transplants.map(t => t.donor).join("/") : ""} — ${distinguishing.slice(0, 3).map(o => `${o.d}~${o.val}`).join(", ")} [seed ${SEED}]`;

    // inject for measurement + gating
    K.GENRES[name] = anchor;
    let m;
    try { m = T.measure(name, MEASURE_SEEDS); }
    catch (e) { delete K.GENRES[name]; rejected.push({ name, nn, gap: r2(gap.gap), reason: "render failed: " + (e.message || e) }); continue; }

    // non-silent guard: a real kit OR a real melody must fire
    const silent = (m.stats.drumDensity && m.stats.drumDensity.max < 0.05) && (!m.stats.leadVoices || m.stats.leadVoices.max < 1);
    if (silent) { delete K.GENRES[name]; rejected.push({ name, nn, gap: r2(gap.gap), reason: "renders silent" }); continue; }

    const { row, added } = derivedRowFor(name, target, gap.v, nn, m.vecs, m.stats);
    V.TARGETS[name] = row;
    const others = GENRES.concat(accepted.map(a => a.name)).filter(g => g !== name);
    // The honest filter enforced PER-SEED (not mean) so it matches the actual
    // dominance gate — validate --quick fails a genre that loses even one seed.
    // FORWARD: the invention must win its OWN tracks on every check seed.
    // BACKWARD: its column must NOT out-score any existing genre on that genre's
    // own tracks on any seed (else that genre drops off its diagonal). A gap that
    // can't clear BOTH is REJECTED — the verifier calling it noise, not a genre.
    const CHECK_SEEDS = [1, 2, 3, 4, 5];   // covers validate --quick(2), matrix(3), full validate(5)
    let fwdWins = 0, topRival = { g: "-", s: -1 };
    for (let i = 0; i < CHECK_SEEDS.length; i++) {
      const f = m.vecs[i];
      const self = V.scoreAgainst(f, name).score;
      let bs = -1, bg = "-";
      for (const g of others) { const s = V.scoreAgainst(f, g).score; if (s > bs) { bs = s; bg = g; } }
      if (self >= bs) fwdWins++;
      if (bs > topRival.s) topRival = { g: bg, s: bs, self };
    }
    const knocks = [];
    for (const g of others) {
      for (const seed of CHECK_SEEDS) {
        const fg = V.features(K.track(g, { seed }));
        const gSelf = V.scoreAgainst(fg, g).score, ourCol = V.scoreAgainst(fg, name).score;
        if (ourCol > gSelf) { knocks.push(`${g}@s${seed}(${ourCol}>${gSelf})`); break; }
      }
    }
    const selfMean = T.meanScore(m.vecs, row);
    const holds = fwdWins === CHECK_SEEDS.length && selfMean >= 60;
    if (holds && knocks.length === 0) {
      taken.add(name);
      if (root) takenRoots.add(root);
      accepted.push({ name, label, nn, gap: r2(gap.gap), anchor, row, self: selfMean, topRival, margin: selfMean - topRival.s, added, transplants, traits, distinguishing, mundane, target });
    } else {
      delete K.GENRES[name]; delete V.TARGETS[name];
      const reason = knocks.length ? `would knock off ${knocks.slice(0, 3).join(", ")} — its column steals a seed from an existing genre`
        : `can't hold its own diagonal (wins ${fwdWins}/${CHECK_SEEDS.length} seeds, top rival ${topRival.g} ${topRival.s} vs self ${topRival.self}) — the gap was already covered`;
      rejected.push({ name, nn, gap: r2(gap.gap), reason, self: selfMean, rival: topRival, distinguishing });
    }
  }
  return { gaps, accepted, rejected };
}

// ================================================================= WRITE
function writeAccepted(accepted) {
  const kernelFile = path.join(ROOT, "engine", "genres-data.js");   // the anchors live here since Stage E1
  const verifierFile = path.join(ROOT, "engine", "genre-verifier.js");
  for (const a of accepted) {
    T.spliceBlock(kernelFile, T.TERM.genres, T.serializeAnchor(a.name, a.anchor), a.name + ":genres");
    T.spliceBlock(verifierFile, T.TERM.targets, T.serializeTarget(a.name, a.row), a.name + ":targets");
  }
}
function writeSpecs(accepted) {
  const dir = path.join(ROOT, "genre-specs", "invented");
  fs.mkdirSync(dir, { recursive: true });
  // prune stale records: a spec whose genre is no longer committed was a
  // rejected/superseded candidate from an earlier run — keep the dir a faithful
  // mirror of what actually landed in the kernel.
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const n = f.slice(0, -5);
    if (!K.GENRES[n] || !V.TARGETS[n]) fs.unlinkSync(path.join(dir, f));
  }
  for (const a of accepted) {
    const { label, info, ...anchorDims } = a.anchor;
    const spec = { name: a.name, label, info, invented: { seed: SEED, nearest: a.nn, gap: a.gap, transplants: a.transplants, traits: a.traits }, anchor: anchorDims };
    fs.writeFileSync(path.join(dir, a.name + ".json"), JSON.stringify(spec, null, 2));
  }
}

// ================================================================= REPORT
function report({ gaps, accepted, rejected }) {
  if (JSON_OUT) { console.log(JSON.stringify({ seed: SEED, accepted: accepted.map(a => ({ name: a.name, nn: a.nn, gap: a.gap, self: a.self, rival: a.topRival, margin: a.margin, transplants: a.transplants, traits: a.traits, distinguishing: a.distinguishing, row: a.row })), rejected }, null, 2)); return; }
  console.log(`\n═══ invent-genres — seed ${SEED} — ${GENRES.length} genres embedded in ${DIMS.length}-dim verifier space ═══`);
  console.log(`explored ${gaps.length} gaps · ACCEPTED ${accepted.length} · rejected ${rejected.length}\n`);
  for (const a of accepted) {
    console.log(`✓ ${a.name}  (${a.label})   gap-radius ${a.gap}   self ${a.self} vs ${a.topRival.g} ${a.topRival.s} (margin +${a.margin})`);
    console.log(`    between/beyond: nearest ${a.nn}${a.transplants.length ? ", transplants " + a.transplants.map(t => `${t.group}←${t.donor}(Δ${t.delta})`).join(" ") : ""}`);
    console.log(`    name rationale: texture=${a.traits.texture} tempo=${a.traits.tempo}${a.traits.rhythm ? " rhythm=" + a.traits.rhythm : ""}${a.mundane ? " [mundane register]" : ""}`);
    console.log(`    distinguishing dims (gap Δ from ${a.nn}): ${a.distinguishing.map(o => `${o.d}=${o.val}(Δ${o.delta})`).join("  ")}`);
    if (a.added && a.added.length) console.log(`    verifier auto-added discriminators: ${a.added.join(", ")}`);
    console.log(`    target row: ${Object.entries(a.row).map(([k, r]) => `${k}[${r[0]},${r[1]}]·${r[2]}`).join("  ")}`);
    console.log("");
  }
  if (rejected.length) {
    console.log(`── rejected (${rejected.length}) — the honest signal on how much real empty space exists ──`);
    for (const r of rejected) console.log(`✗ ${r.name} (near ${r.nn}, gap ${r.gap}): ${r.reason}`);
    console.log("");
  }
  if (has("write")) console.log(`WROTE ${accepted.length} genres → engine/genres-data.js + engine/genre-verifier.js. Now run: node engine/genre-verifier.js matrix --no-cache`);
  else console.log(`(dry run — re-run with --write to splice the ${accepted.length} accepted genres into the kernel + verifier)`);
}

// ================================================================= main
const out = run();
if (has("write")) writeAccepted(out.accepted);
if (has("specs")) writeSpecs(out.accepted);
report(out);
