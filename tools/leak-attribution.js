#!/usr/bin/env node
'use strict';
// tools/leak-attribution.js  (ROADMAP §1.2.6 — Confusion-leak attribution)
//
// For a confused pair (impostor genre A scoring high against target genre B's
// TARGETS box), explain WHY: rank B's box features by the contribution (w*s
// share) A's rendered features make to the false score, then find the single
// feature whose fence — if B tightened it to exclude A's measured band while
// still admitting B's own measured band — best breaks the tie. Emit that fence.
//
// OFFLINE & READ-ONLY: renders A and B anchors across a fixed seed set, reads
// V.features + V.scoreRow's opt-in per-key contributions. No global-state
// mutation, no render-path edits. Deterministic (fixed seeds; no rng/Date).
//
// CLI:  node tools/leak-attribution.js <A> <B> [--seeds=1,2,3,4,5] [--json] [--top=N]
//   A = impostor genre (its rendered sound leaks into B's box)
//   B = target genre (the box being falsely satisfied)

const path = require('path');
const K = require(path.join(__dirname, '..', 'engine', 'genre-kernel.js'));
const V = require(path.join(__dirname, '..', 'engine', 'genre-verifier.js'));

// ---- measured band: [min,max] per feature over a fixed seed set ----
function band(genre, seeds) {
  const acc = {}; // feature -> {lo,hi,sum,n}
  for (const seed of seeds) {
    const f = V.features(K.track(genre, { seed }));
    for (const k in f) {
      const v = f[k];
      if (v == null || typeof v !== 'number') continue;
      if (!acc[k]) acc[k] = { lo: v, hi: v, sum: 0, n: 0 };
      acc[k].lo = Math.min(acc[k].lo, v);
      acc[k].hi = Math.max(acc[k].hi, v);
      acc[k].sum += v; acc[k].n++;
    }
  }
  const mean = {}, lo = {}, hi = {};
  for (const k in acc) { mean[k] = acc[k].sum / acc[k].n; lo[k] = acc[k].lo; hi[k] = acc[k].hi; }
  return { mean, lo, hi };
}

// score a feature-vector against a (possibly modified) box map
function scoreBox(f, box) {
  return V.scoreRow(f, box, null);
}

function analyzeLeak(A, B, seeds) {
  const T = V.TARGETS[B];
  if (!T) throw new Error(`unknown target genre: ${B} (no TARGETS box)`);
  if (!K.GENRES[A]) throw new Error(`unknown impostor genre: ${A}`);

  const a = band(A, seeds);
  const b = band(B, seeds);

  const baseA = scoreBox(a.mean, T);       // A's false score against B's box
  const baseB = scoreBox(b.mean, T);       // B's honest self-score (sanity ~100)

  // per-key contribution to A's false score (w*s share; sums to baseA)
  const { parts } = V.scoreRow(a.mean, T, null, { contributions: true });

  // rank shared in-range drivers by contribution
  const drivers = Object.keys(parts)
    .map(k => ({ feature: k, contribution: parts[k], weight: T[k][2],
                 box: [T[k][0], T[k][1]], aMean: a.mean[k],
                 aBand: [a.lo[k], a.hi[k]], bBand: [b.lo[k], b.hi[k]] }))
    .sort((x, y) => y.contribution - x.contribution);

  // ---- fence search: which ONE tightened bound best breaks the tie? ----
  // A candidate fence on feature k excludes A's whole measured band while
  // keeping B's whole measured band admissible. Feasible only when the two
  // bands are disjoint; the new bound is the midpoint of the gap (margin to
  // both sides). We rank by the resulting drop in A's score against B, and
  // keep B's self-score intact (by construction B's band stays inside).
  const GAP = 1e-9;
  const candidates = [];
  for (const k of Object.keys(T)) {
    const [lo, hi, w] = T[k];
    const aLo = a.lo[k], aHi = a.hi[k], bLo = b.lo[k], bHi = b.hi[k];
    if (aLo == null || bLo == null) continue;
    let nbox = null, kind = null, bound = null;
    if (aHi < bLo - GAP) {
      // A entirely below B: raise lo to the gap midpoint
      bound = (aHi + bLo) / 2;
      nbox = [Math.max(lo, bound), hi, w]; kind = 'raise-lo';
    } else if (aLo > bHi + GAP) {
      // A entirely above B: lower hi to the gap midpoint
      bound = (bHi + aLo) / 2;
      nbox = [lo, Math.min(hi, bound), w]; kind = 'lower-hi';
    } else {
      continue; // bands overlap on this feature — cannot separate with one fence
    }
    const modT = Object.assign({}, T, { [k]: nbox });
    const newA = scoreBox(a.mean, modT);
    const newB = scoreBox(b.mean, modT);
    candidates.push({
      feature: k, kind, bound,
      oldBox: [lo, hi], newBox: [nbox[0], nbox[1]], weight: w,
      aBand: [aLo, aHi], bBand: [bLo, bHi],
      newAScore: newA, newBScore: newB,
      drop: baseA - newA, bLoss: baseB - newB,
    });
  }
  // best fence = biggest tie-break drop while B stays honest (bLoss ~ 0)
  candidates.sort((x, y) => (y.drop - x.drop) || (x.bLoss - y.bLoss));
  const suggested = candidates.find(c => c.bLoss < 1) || candidates[0] || null;

  return { A, B, seeds, baseA, baseB, drivers, candidates, suggested };
}

function fmt(n, d = 2) { return Number(n).toFixed(d); }

function printReport(r) {
  const L = [];
  L.push(`Leak attribution: "${r.A}" (impostor) vs "${r.B}" (target box)`);
  L.push(`  seeds=[${r.seeds.join(',')}]  A-on-B=${fmt(r.baseA)}  B-self=${fmt(r.baseB)}`);
  L.push('');
  L.push('  Top shared in-range features driving the false score (w*s share of A-on-B):');
  const top = r.drivers.slice(0, r._top || 8);
  for (const d of top) {
    L.push(`    ${d.feature.padEnd(12)} contrib=${fmt(d.contribution).padStart(6)}` +
           `  w=${d.weight}  box=[${fmt(d.box[0], 3)},${fmt(d.box[1], 3)}]` +
           `  A=${fmt(d.aMean, 3)} (band [${fmt(d.aBand[0], 3)},${fmt(d.aBand[1], 3)}])` +
           `  B-band=[${fmt(d.bBand[0], 3)},${fmt(d.bBand[1], 3)}]`);
  }
  L.push('');
  if (r.suggested) {
    const s = r.suggested;
    L.push('  SUGGESTED FENCE (single feature that best breaks the tie):');
    L.push(`    feature   : ${s.feature}`);
    L.push(`    action    : ${s.kind === 'raise-lo' ? 'raise lower bound' : 'lower upper bound'} to ${fmt(s.bound, 4)}`);
    L.push(`    ${r.B}.${s.feature}: [${fmt(s.oldBox[0], 3)},${fmt(s.oldBox[1], 3)}]  ->  [${fmt(s.newBox[0], 3)},${fmt(s.newBox[1], 3)}]  (weight ${s.weight})`);
    L.push(`    effect    : A-on-B ${fmt(r.baseA)} -> ${fmt(s.newAScore)}  (drop ${fmt(s.drop)})   B-self ${fmt(r.baseB)} -> ${fmt(s.newBScore)}  (loss ${fmt(s.bLoss)})`);
    L.push(`    rationale : A's ${s.feature} band [${fmt(s.aBand[0], 3)},${fmt(s.aBand[1], 3)}] is disjoint from B's [${fmt(s.bBand[0], 3)},${fmt(s.bBand[1], 3)}]; the fence excludes A, admits B.`);
  } else {
    L.push('  NO single-feature fence separates the pair: every box feature has A and B');
    L.push('  measured bands that overlap. These genres are materially entangled here;');
    L.push('  a multi-feature constraint (or a new discriminating feature) is required.');
  }
  return L.join('\n');
}

function main(argv) {
  const args = argv.slice(2);
  const pos = args.filter(a => !a.startsWith('--'));
  const flags = Object.fromEntries(args.filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
  if (pos.length < 2) {
    console.error('usage: node tools/leak-attribution.js <A> <B> [--seeds=1,2,3,4,5] [--json] [--top=N]');
    process.exit(2);
  }
  const seeds = flags.seeds ? String(flags.seeds).split(',').map(Number) : [1, 2, 3, 4, 5];
  let r;
  try { r = analyzeLeak(pos[0], pos[1], seeds); }
  catch (e) { console.error('leak-attribution: ' + e.message); process.exit(1); }
  r._top = flags.top ? Number(flags.top) : 8;
  if (flags.json) { console.log(JSON.stringify(r, null, 2)); return; }
  console.log(printReport(r));
}

if (require.main === module) main(process.argv);
module.exports = { analyzeLeak, band };
