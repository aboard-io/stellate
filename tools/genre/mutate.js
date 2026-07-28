#!/usr/bin/env node
// tools/genre/mutate.js — ROADMAP §1.3.5 — the mutation / breeder.
//
// Clone an anchor, perturb ONE declared dimension, render it through the REAL
// kernel + engine, then answer two questions:
//   1. does the mutant still read as MUSIC?  (V.analyze + musicality audit)
//   2. does its IDENTITY flip?               (does it still score best as itself,
//                                             and is its self-minus-rival margin
//                                             still positive?)
//
// OFFLINE & READ-ONLY over the deterministic pipeline. It NEVER runs during a
// real render. Its one dangerous move is injecting a temp anchor, so it obeys
// the splice/restore cleanup contract (guardrail §7):
//
//   * The mutant is spliced IN PLACE — it OVERWRITES GENRES[g] for the duration
//     of the render, then the exact original object reference is restored.
//     Overwrite-in-place (not a new key) is deliberate: the genre-name string
//     feeds the kernel rng, so a same-spec clone under a NEW name does NOT render
//     byte-identically (verified). Only overwriting the SAME name makes the
//     zero-perturbation determinism guard hold.
//   * After restore we PROVE: Object.keys(GENRES) is unchanged (length + order),
//     GENRES[g] is the identical original object, and re-rendering the base is
//     byte-equal to the pre-splice baseline (the render path is fully back).
//
// A zero perturbation (delta 0) MUST yield a byte-identical track — that is the
// determinism guard the whole contract rests on.
//
// CLI:
//   node tools/genre/mutate.js <genre> <dim> <delta> [opts]
//   node tools/genre/mutate.js techno bpm +10
//   node tools/genre/mutate.js vaporwave swing +0.2 --seed 7
//   node tools/genre/mutate.js techno bpm 0            # determinism guard (no-op)
//   node tools/genre/mutate.js jungle fx.delayFb +0.3 --mode add --json
// opts:
//   --seed N          render seed for the byte/identity comparison (default 1)
//   --seeds a,b,c     audit seeds for the musicality pass (default: the render seed)
//   --mode add|scale|set   how <delta> is applied (default add)
//   --audit-all       also run the FULL Mus.auditAll() while spliced (slow; checks
//                     the mutant didn't knock the rest of the catalog off its laws)
//   --json            emit the raw report object
//
// <dim> is a dotted path into the anchor (e.g. bpm, swing, fx.delayFb, pads.prob).
// The resolved value must be a number (perturbed directly) or a 2-number range
// [lo,hi] (the whole range is shifted/scaled, preserving intent). Any other kind
// of dimension is not perturbable by this tool.

const K = require('../../engine/genre-kernel.js');
const E = require('../../engine/csd-engine.js');
const V = require('../../engine/genre-verifier.js');
const Mus = require('../../engine/musicality.js');

const clone = (o) => JSON.parse(JSON.stringify(o));
const r3 = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x);

// ---- dotted-path get/set over an anchor -----------------------------------
function getPath(obj, path) {
  let cur = obj;
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return { ok: false };
    if (!(key in cur)) return { ok: false };
    cur = cur[key];
  }
  return { ok: true, value: cur };
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
}
const isRange = (v) =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';

// ---- perturb one dimension of a CLONED anchor -----------------------------
// Returns { before, after } or throws with an honest reason.
function perturb(anchor, path, delta, mode) {
  const got = getPath(anchor, path);
  if (!got.ok) throw new Error(`dimension "${path}" is not declared on this anchor`);
  const v = got.value;
  const apply = (n) => {
    if (mode === 'set') return delta;
    if (mode === 'scale') return n * delta;
    return n + delta; // add
  };
  let after;
  if (typeof v === 'number') {
    after = apply(v);
  } else if (isRange(v)) {
    // shift/scale/replace the whole range — perturb the dimension, keep it a range
    after = mode === 'set' ? [delta, delta] : [apply(v[0]), apply(v[1])];
  } else {
    throw new Error(
      `dimension "${path}" resolves to ${Array.isArray(v) ? 'a non-numeric array' : typeof v} — ` +
        `this tool only perturbs a scalar number or a 2-number [lo,hi] range`
    );
  }
  const before = clone(v);
  setPath(anchor, path, after);
  return { before, after: clone(after) };
}

// ---- rival scan: best score against any OTHER genre's target box ----------
function bestRival(features, selfGenre) {
  let bg = '-';
  let bs = -Infinity;
  for (const g of Object.keys(V.TARGETS)) {
    if (g === selfGenre) continue;
    if (!K.GENRES[g]) continue;
    const s = V.scoreAgainst(features, g).score;
    if (s > bs) {
      bs = s;
      bg = g;
    }
  }
  return { genre: bg, score: bs };
}

// ---- the breeder -----------------------------------------------------------
function mutate(genre, opts = {}) {
  if (!K.GENRES[genre]) throw new Error(`unknown genre: ${genre}`);
  const dim = opts.dim;
  if (!dim) throw new Error('a dimension (dotted path) is required');
  const delta = opts.delta == null ? 0 : Number(opts.delta);
  const mode = opts.mode || 'add';
  const seed = opts.seed == null ? 1 : Number(opts.seed);
  const auditSeeds = opts.seeds && opts.seeds.length ? opts.seeds : [seed];

  // ---- baseline (BEFORE any splice) ----------------------------------------
  const keysBefore = Object.keys(K.GENRES); // snapshot for the restore proof
  const baseState = K.track(genre, { seed });
  const baseEv = JSON.stringify(E.buildEvents(baseState));
  const baseAnalyze = V.analyze(baseState);
  const baseFeat = baseAnalyze.features;
  const baseSelf = V.scoreAgainst(baseFeat, genre).score;
  const baseRival = bestRival(baseFeat, genre);
  const baseMargin = r3(baseSelf - baseRival.score);

  // ---- build the mutant from a CLONE, perturb ONE dim ----------------------
  const orig = K.GENRES[genre]; // keep the exact reference to restore
  const mutant = clone(orig);
  const change = perturb(mutant, dim, delta, mode);

  // ---- SPLICE in place, run the kernel's deriveMind path, render -----------
  let mutState, mutEv, mutAnalyze, auditRows, auditAllSummary = null;
  try {
    K.GENRES[genre] = mutant;
    // Re-run the mind derivation on the mutant. deriveMind fills theory/pipes/
    // rhythm only where absent; a scalar/range perturbation does not feed the
    // mind inference, so this is a faithful no-op there — but we run the path as
    // the contract requires (and it re-asserts overrides).
    K.deriveMind(genre, mutant);

    mutState = K.track(genre, { seed });
    mutEv = JSON.stringify(E.buildEvents(mutState));
    mutAnalyze = V.analyze(mutState);

    // does it still read as MUSIC? — the musicality laws, on the mutant anchor.
    // Mus.auditAll() maps audit() over EVERY genre; for a single mutant the only
    // meaningful row is this one, so by default we run exactly that row (fast).
    auditRows = auditSeeds.map((s) => Mus.audit(genre, { seeds: [s] }));
    if (opts.auditAll) {
      const all = Mus.auditAll({ rank: true });
      auditAllSummary = {
        genres: all.length,
        fails: all.filter((r) => r.verdict === 'FAIL').map((r) => r.genre),
        warns: all.filter((r) => r.verdict === 'WARN').length,
      };
    }
  } finally {
    // ---- RESTORE GENRES EXACTLY (guardrail §7) ------------------------------
    K.GENRES[genre] = orig;
  }

  // ---- prove the restoration ----------------------------------------------
  const keysAfter = Object.keys(K.GENRES);
  const restore = {
    lengthBefore: keysBefore.length,
    lengthAfter: keysAfter.length,
    lengthOk: keysBefore.length === keysAfter.length,
    orderOk: keysBefore.length === keysAfter.length && keysBefore.every((k, i) => k === keysAfter[i]),
    referenceOk: K.GENRES[genre] === orig,
  };
  // the render path is fully back: re-render the base, compare to the baseline
  const roundTripEv = JSON.stringify(E.buildEvents(K.track(genre, { seed })));
  restore.roundTripByteEqual = roundTripEv === baseEv;
  restore.ok =
    restore.lengthOk && restore.orderOk && restore.referenceOk && restore.roundTripByteEqual;

  // ---- verdicts ------------------------------------------------------------
  const byteIdentical = mutEv === baseEv;
  const mutFeat = mutAnalyze.features;
  const mutSelf = V.scoreAgainst(mutFeat, genre).score;
  const mutRival = bestRival(mutFeat, genre);
  const mutMargin = r3(mutSelf - mutRival.score);

  const worstVerdict = auditRows
    .map((r) => r.verdict)
    .reduce((a, b) => (b === 'FAIL' ? 'FAIL' : a === 'FAIL' ? 'FAIL' : b === 'WARN' ? 'WARN' : a), 'OK');

  return {
    genre,
    dim,
    delta,
    mode,
    seed,
    auditSeeds,
    change: { before: change.before, after: change.after },
    byteIdentical,
    // "does it still read as music?"
    music: {
      verdict: worstVerdict, // OK / WARN / FAIL across audit seeds
      overall: r3(auditRows.reduce((s, r) => s + r.overall, 0) / auditRows.length),
      worst: auditRows.map((r) => r.worst).filter(Boolean)[0] || null,
      perSeed: auditRows.map((r, i) => ({ seed: auditSeeds[i], verdict: r.verdict, overall: r.overall })),
    },
    // "does its identity flip?"
    identity: {
      baseBest: baseAnalyze.best,
      mutantBest: mutAnalyze.best,
      flipped: mutAnalyze.best !== genre,
      baseSelfScore: baseSelf,
      mutantSelfScore: mutSelf,
      baseMargin,
      mutantMargin: mutMargin,
      marginDelta: r3(mutMargin - baseMargin),
      baseRival,
      mutantRival: mutRival,
    },
    auditAll: auditAllSummary,
    restore,
  };
}

// ---- pretty report ---------------------------------------------------------
function pretty(rep) {
  const L = [];
  const chg = Array.isArray(rep.change.before)
    ? `[${rep.change.before}] -> [${rep.change.after}]`
    : `${rep.change.before} -> ${rep.change.after}`;
  L.push(`═══ mutate ${rep.genre}  ·  ${rep.dim} ${rep.mode} ${rep.delta}  (seed ${rep.seed}) ═══`);
  L.push(`  perturbation : ${chg}`);
  L.push(`  byte-identical track : ${rep.byteIdentical}${rep.delta === 0 && rep.mode === 'add' ? '   (zero-perturbation determinism guard)' : ''}`);
  L.push(`  reads as music : ${rep.music.verdict}  (overall ${rep.music.overall}${rep.music.worst ? `, worst: ${rep.music.worst}` : ''})`);
  L.push(
    `  identity : best ${rep.identity.baseBest} -> ${rep.identity.mutantBest}` +
      `  ${rep.identity.flipped ? '*** FLIPPED ***' : '(holds)'}`
  );
  L.push(
    `  margin (self - top rival) : ${rep.identity.baseMargin} -> ${rep.identity.mutantMargin}` +
      `  (Δ ${rep.identity.marginDelta >= 0 ? '+' : ''}${rep.identity.marginDelta})`
  );
  L.push(
    `             base rival ${rep.identity.baseRival.genre} ${rep.identity.baseRival.score}` +
      `  ·  mutant rival ${rep.identity.mutantRival.genre} ${rep.identity.mutantRival.score}`
  );
  if (rep.auditAll)
    L.push(`  auditAll while spliced : ${rep.auditAll.genres} genres, ${rep.auditAll.fails.length} FAIL, ${rep.auditAll.warns} WARN`);
  L.push(
    `  RESTORE : keys ${rep.restore.lengthAfter} (len ${rep.restore.lengthOk ? 'ok' : 'BAD'},` +
      ` order ${rep.restore.orderOk ? 'ok' : 'BAD'}, ref ${rep.restore.referenceOk ? 'ok' : 'BAD'},` +
      ` round-trip byte-equal ${rep.restore.roundTripByteEqual ? 'ok' : 'BAD'})  ->  ${rep.restore.ok ? 'CLEAN' : 'DIRTY!'}`
  );
  return L.join('\n');
}

// ---- CLI -------------------------------------------------------------------
function main(argv) {
  const args = argv.slice(2);
  const pos = [];
  const opt = { mode: 'add' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') opt.json = true;
    else if (a === '--audit-all') opt.auditAll = true;
    else if (a === '--seed') opt.seed = args[++i];
    else if (a === '--mode') opt.mode = args[++i];
    else if (a === '--seeds') opt.seeds = args[++i].split(',').map(Number);
    else pos.push(a);
  }
  if (pos.length < 2) {
    console.error('usage: node tools/genre/mutate.js <genre> <dim> [delta] [--seed N] [--seeds a,b,c] [--mode add|scale|set] [--audit-all] [--json]');
    process.exit(2);
  }
  opt.dim = pos[1];
  opt.delta = pos[2] == null ? 0 : pos[2];
  const rep = mutate(pos[0], opt);
  console.log(opt.json ? JSON.stringify(rep, null, 2) : pretty(rep));
  // a dirty restore is a hard failure — this tool must never leak state
  if (!rep.restore.ok) process.exit(1);
}

if (require.main === module) main(process.argv);
module.exports = { mutate, perturb, getPath, setPath };
