#!/usr/bin/env node
'use strict';
// lesson.js — ROADMAP §1.4.4  (interpolation-lesson annotator)
//
// Walks the interpolation K.blend(A,B,t) on a fine t-grid and narrates WHICH
// dimension changes at WHICH t: (1) categorical ENUM flips read straight off
// state.genreMeta (form / kit / progression / bass / lead / pad / drums / found
// / stab / hits / lick / rubato / counter / inserts) and (2) the largest per-step
// V.features CROSSINGS (continuous 23-vector: offgrid/sub/swing/acoustic/...),
// each normalized by that feature's own whole-journey range so scales are
// comparable. Emits one ordered, narrated timeline
// ("at t=0.25 the pad turns acoustic; at t=0.90 the top softens").
//
// blend(A,B,t) IS the resolve interpolation path (a 2-endpoint journey leg,
// equivalent to resolveMulti([{A,1-t},{B,t}])) — we reuse it directly and hold
// ONE seed across the whole grid, so a flip means "at this t the seeded choice
// genuinely crossed a threshold", not seed noise.
//
// CLI:  node tools/lesson.js A B [seed]
//
// OFFLINE / READ-ONLY: only reads K.GENRES and calls K.blend / K.track /
//   V.features. Mutates no global state.
// DETERMINISTIC: fixed default seed (1); no Date.now()/Math.random(); same
//   A,B,seed -> byte-identical timeline. Endpoints report zero surprise:
//   blend(A,B,0) genome == track(A), blend(A,B,1) == track(B), and NO event
//   fires at t=0 (the first sample is the baseline). (lesson(A,A) is not
//   strictly empty — t is itself an input to resolve, so it can nudge a seeded
//   pick even when A==B — but its endpoints still equal the anchor and t=0 is
//   quiet.)

const K = require('../engine/genre-kernel.js');
const V = require('../engine/genre-verifier.js');

const DEFAULT_SEED = 1;
const DEFAULT_STEPS = 40; // 41 samples, t = 0, 1/40, ..., 1
const FEAT_THRESH = 0.25; // a step must move a feature >=25% of its own journey range to count as a crossing
const MAX_FEAT_PER_STEP = 3;

// Categorical fields on state.genreMeta that resolve to a DISCRETE choice.
// Deliberately excludes 'mind' (embeds continuous adventure/color floats that
// drift every step — that is not a flip), and the axis/constant fields
// genres/t/seed and the derived 'evolutions' audit trail.
const CATEGORICAL = ['form', 'kit', 'progression', 'bass', 'lead', 'pad',
  'drums', 'found', 'stab', 'hits', 'lick', 'rubato', 'counter'];

// Human phrases for the narration. Missing features fall back to the raw key.
const PHRASE = {
  form: 'the form', kit: 'the drum kit', progression: 'the progression',
  bass: 'the bass voice', lead: 'the lead voice', pad: 'the pad voice',
  drums: 'the drum models', found: 'the found-sample source/role',
  stab: 'the stab', hits: 'the horn/stab hits', lick: 'the lick',
  rubato: 'rubato', counter: 'the counter-melody',
  'inserts.bass': 'the bass insert FX', 'inserts.lead': 'the lead insert FX',
  'inserts.pad': 'the pad insert FX',
};
const FEAT_PHRASE = {
  bpm: 'tempo', offgrid: 'kick timing', snareBalance: 'snare balance',
  hatDensity: 'hat density', drumDensity: 'drum density', variation: 'variation',
  wash: 'reverb wash', sub: 'sub-bass', motion: 'bass/lead motion',
  seventh: 'seventh color', breakUse: 'breakbeat use', chopUse: 'chop use',
  bedUse: 'ambient bed', crackle: 'vinyl crackle', pump: 'sidechain pump',
  comp: 'compression', swing: 'swing', humanize: 'timing humanize',
  acoustic: 'acoustic-ness', rubato: 'rubato', leadVoices: 'lead voice count',
  softTop: 'top softness', interlock: 'rhythmic interlock',
};

function round(x, n) { const p = Math.pow(10, n); return Math.round(x * p) / p; }

// Flatten the whitelisted categorical fields (expanding the inserts object) into
// a flat { field -> string } snapshot for a single t.
function catSnapshot(meta) {
  const s = {};
  for (const f of CATEGORICAL) s[f] = meta[f] === undefined ? '-' : String(meta[f]);
  const ins = meta.inserts || {};
  for (const k of ['bass', 'lead', 'pad']) s['inserts.' + k] = ins[k] === undefined ? '-' : String(ins[k]);
  return s;
}

// ---- narration builders ---------------------------------------------------
function narrateEnum(field, from, to) {
  const what = PHRASE[field] || field;
  if (from === '-' && to !== '-') return what + ' appears (' + to + ')';
  if (to === '-' && from !== '-') return what + ' drops out (was ' + from + ')';
  return what + ' flips  ' + from + ' → ' + to;
}

function narrateFeat(feat, a, b) {
  const what = FEAT_PHRASE[feat] || feat;
  const dir = b > a ? 'rises' : 'falls';
  let line = what + ' ' + dir + '  ' + round(a, 3) + ' → ' + round(b, 3);
  // known threshold-crossing colour
  if (feat === 'offgrid') {
    if (a < 0.5 && b >= 0.5) line += '  (kick moves off-grid)';
    else if (a >= 0.5 && b < 0.5) line += '  (kick locks to the grid)';
  }
  if (feat === 'acoustic') {
    if (a < 0.4 && b >= 0.4) line += '  (turns acoustic)';
    else if (a >= 0.4 && b < 0.4) line += '  (turns electronic)';
  }
  return line;
}

// ---- core -----------------------------------------------------------------
function lesson(a, b, seed = DEFAULT_SEED, opts = {}) {
  if (!K.GENRES[a]) throw new Error('unknown genre: ' + a);
  if (!K.GENRES[b]) throw new Error('unknown genre: ' + b);
  const steps = opts.steps || DEFAULT_STEPS;

  // Sample the interpolation on the grid (one shared seed across all t).
  const ts = [], cats = [], feats = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const st = K.blend(a, b, t, { seed });
    ts.push(round(t, 6));
    cats.push(catSnapshot(st.genreMeta));
    feats.push(V.features(st));
  }

  // Per-feature whole-journey range (for scale-free normalization).
  const fkeys = Object.keys(feats[0]);
  const range = {};
  for (const k of fkeys) {
    let mn = Infinity, mx = -Infinity;
    for (const r of feats) { const v = Number(r[k]) || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
    range[k] = mx - mn;
  }

  const events = [];
  // Enum flips: compare consecutive snapshots (i-1 -> i), attach to t = ts[i].
  // The first sample (t=0) is the baseline and never emits — endpoints are quiet.
  const catFields = Object.keys(cats[0]);
  for (let i = 1; i <= steps; i++) {
    for (const f of catFields) {
      if (cats[i][f] !== cats[i - 1][f]) {
        events.push({ t: ts[i], kind: 'enum', field: f, from: cats[i - 1][f], to: cats[i][f],
          text: narrateEnum(f, cats[i - 1][f], cats[i][f]) });
      }
    }
  }
  // Feature crossings: per step, the features that moved >= FEAT_THRESH of their
  // own range, largest-normalized first, capped at MAX_FEAT_PER_STEP.
  for (let i = 1; i <= steps; i++) {
    const cross = [];
    for (const k of fkeys) {
      const av = Number(feats[i - 1][k]) || 0, bv = Number(feats[i][k]) || 0;
      const d = bv - av;
      const norm = range[k] > 1e-9 ? Math.abs(d) / range[k] : 0;
      if (norm >= FEAT_THRESH) cross.push({ k, av, bv, norm });
    }
    cross.sort((x, y) => y.norm - x.norm || (x.k < y.k ? -1 : 1));
    for (const c of cross.slice(0, MAX_FEAT_PER_STEP)) {
      events.push({ t: ts[i], kind: 'feature', field: c.k, from: round(c.av, 4),
        to: round(c.bv, 4), norm: round(c.norm, 3), text: narrateFeat(c.k, c.av, c.bv) });
    }
  }

  // Order the unified timeline: by t, enum before feature at the same t, then by field.
  const kindRank = { enum: 0, feature: 1 };
  events.sort((x, y) => x.t - y.t || kindRank[x.kind] - kindRank[y.kind] ||
    (x.field < y.field ? -1 : x.field > y.field ? 1 : 0));

  // Endpoint honesty: blend endpoints must equal the pure anchors.
  const trackA = catSnapshot(K.track(a, { seed }).genreMeta);
  const trackB = catSnapshot(K.track(b, { seed }).genreMeta);
  const eq = (x, y) => catFields.every((f) => x[f] === y[f]);
  const endpoints = {
    startMatchesA: eq(cats[0], trackA),
    endMatchesB: eq(cats[steps], trackB),
    startEvents: events.filter((e) => e.t === 0).length,
  };

  return { a, b, seed, steps, events, endpoints };
}

// ---- rendering ------------------------------------------------------------
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

function render(L) {
  const out = [];
  out.push('INTERPOLATION LESSON:  ' + L.a + '  →  ' + L.b +
    '   (seed ' + L.seed + ', ' + (L.steps + 1) + '-point grid)');
  out.push('');
  if (!L.events.length) {
    out.push('  (no flips — the interpolation is featureless / A and B resolve alike)');
  } else {
    let lastT = null;
    for (const e of L.events) {
      const tcol = (e.t !== lastT) ? 't=' + e.t.toFixed(3) : '';
      lastT = e.t;
      const tag = e.kind === 'enum' ? '[enum]   ' : '[feature]';
      out.push('  ' + pad(tcol, 9) + tag + ' ' + e.text);
    }
  }
  out.push('');
  const enumN = L.events.filter((e) => e.kind === 'enum').length;
  const featN = L.events.filter((e) => e.kind === 'feature').length;
  out.push('  Σ  ' + L.events.length + ' events (' + enumN + ' enum flips, ' +
    featN + ' feature crossings)');
  out.push('  endpoints: t=0 == ' + L.a + '? ' + (L.endpoints.startMatchesA ? 'yes' : 'NO') +
    '   t=1 == ' + L.b + '? ' + (L.endpoints.endMatchesB ? 'yes' : 'NO') +
    '   events at t=0: ' + L.endpoints.startEvents + '  (zero surprise)');
  return out.join('\n');
}

// ---- CLI ------------------------------------------------------------------
function main(argv) {
  const [a, b, seedArg] = argv;
  if (!a || !b) {
    console.error('usage: node tools/lesson.js A B [seed]');
    console.error('  A, B: genre anchor names from K.GENRES (249 anchors)');
    process.exit(2);
  }
  const seed = seedArg !== undefined ? Number(seedArg) : DEFAULT_SEED;
  let L;
  try {
    L = lesson(a, b, seed);
  } catch (e) {
    console.error('error: ' + e.message);
    process.exit(1);
  }
  console.log(render(L));
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { lesson, render, catSnapshot, CATEGORICAL };
