#!/usr/bin/env node
// melody-weave-daw.test.js — state.melodyWeave, the /daw WEAVE MACHINE's engine
// surface, plus a node-side run of the browser fitter's own arithmetic.
//
// A weave is not a phrase, it is the DISTRIBUTION a phrase is drawn from: a Markov
// chain over the voicing ladder and another over quantized IOIs. So the assertions
// here are distributional, not note-for-note:
//
//   1 absent is IDENTICAL   no melodyWeave => the mined MINED_WEAVE table
//   2 an override PLAYS     a song's own organ shadows the mined one by name
//   3 the TABLE STEERS      a diagonal-heavy table produces measurably more
//                           stepwise motion than a corner-heavy one — the thing
//                           the matrix editor claims to do
//   4 STILL A GENERATOR     the same table under different seeds gives different
//                           tunes (it is a distribution, not a recording)
//   5 the FITTER round-trips a phrase fitted into a weave reproduces that phrase's
//                           own transitions as the strongest ones
//
// Run: node test/unit/melody-weave-daw.test.js
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
global.window = global;
require(path.join(ROOT, "engine/genres-data.js"));
require(path.join(ROOT, "engine/registry-data.js"));
require(path.join(ROOT, "engine/theory.js"));
require(path.join(ROOT, "engine/pipes.js"));
const E = require(path.join(ROOT, "engine/csd-engine.js"));
const K = require(path.join(ROOT, "engine/genre-kernel.js"));

const deep = (o) => JSON.parse(JSON.stringify(o));
const J = (o) => JSON.stringify(o);
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.error("  FAIL: " + m); } };

const WEAVE = "folkweave";
const norm = (r) => { const t = r.reduce((a, b) => a + b, 0) || 1; return r.map((v) => +(v / t).toFixed(4)); };
function table(kind) {                      // kind: "diag" (stepwise) | "corner" (leapy)
  const slot = Array.from({ length: 8 }, (_, r) => norm(Array.from({ length: 8 }, (_, c) => {
    const d = Math.abs(r - c);
    return kind === "diag" ? (d <= 1 ? 10 : 0.01) : (d >= 5 ? 10 : 0.01);
  })));
  return { start: norm(new Array(8).fill(1)), slot,
           ioiStart: norm(new Array(8).fill(1)), ioi: Array.from({ length: 8 }, () => norm(new Array(8).fill(1))),
           legato: 0.9, step: 0.4 };
}
function weaveState(seed, patch) {
  const t = K.track("folk", { seed });
  const s = deep(t.state || t);
  let any = false;
  for (const sec of s.sections || []) if (sec.melody && sec.melody !== "off") { sec.melody = WEAVE; any = true; }
  if (!any) return null;
  s.voiceStreams = true;
  return Object.assign(s, patch || {});
}
const melOf = (s) => E.buildEvents(s).pitched.filter((e) => e.voice === "melody" && !e.pass);

ok(!!(E.MINED_WEAVE && E.MINED_WEAVE[WEAVE]), "the engine exposes MINED_WEAVE and the test organ exists");
const SEEDS = [1, 3, 5, 7];
ok(!!weaveState(1), "the test genre plays a melody");

// ---- 1 absent identical ---------------------------------------------------
for (const seed of SEEDS) {
  const a = weaveState(seed), b = weaveState(seed, { melodyWeave: undefined }), c = weaveState(seed, { melodyWeave: {} });
  ok(J(E.buildEvents(a)) === J(E.buildEvents(b)), `seed ${seed}: melodyWeave:undefined must be byte-identical to absent`);
  ok(J(E.buildEvents(a)) === J(E.buildEvents(c)), `seed ${seed}: melodyWeave:{} must be byte-identical to absent`);
}
console.log(`1 absent identical — ${SEEDS.length} seeds`);

// ---- 2 an override plays --------------------------------------------------
{
  let moved = 0;
  for (const seed of SEEDS) {
    const a = weaveState(seed), b = weaveState(seed, { melodyWeave: { [WEAVE]: table("diag") } });
    if (J(melOf(a)) !== J(melOf(b))) moved++;
  }
  ok(moved === SEEDS.length, `a weave override must change the melody every time (${moved}/${SEEDS.length})`);
  const unused = Object.keys(E.MINED_WEAVE).find((n) => n !== WEAVE);
  ok(J(melOf(weaveState(1))) === J(melOf(weaveState(1, { melodyWeave: { [unused]: table("diag") } }))),
     `overriding an UNPLAYED weave (${unused}) must change nothing`);
  console.log(`2 override plays — ${moved}/${SEEDS.length}, control on "${unused}"`);
}

// ---- 3 THE TABLE STEERS (what the matrix editor claims) -------------------
// Brush toward the diagonal and the line should move in smaller intervals than
// brushing toward the corners. Measured as the mean absolute semitone interval.
{
  const meanIv = (evs) => {
    const ms = evs.slice().sort((a, b) => a.beat - b.beat).map((e) => E.pchToMidi(e.pch));
    let s = 0, n = 0;
    for (let i = 0; i + 1 < ms.length; i++) { s += Math.abs(ms[i + 1] - ms[i]); n++; }
    return n ? s / n : 0;
  };
  let stepwiseSmaller = 0;
  for (const seed of SEEDS) {
    const d = meanIv(melOf(weaveState(seed, { melodyWeave: { [WEAVE]: table("diag") } })));
    const c = meanIv(melOf(weaveState(seed, { melodyWeave: { [WEAVE]: table("corner") } })));
    if (d < c) stepwiseSmaller++;
  }
  ok(stepwiseSmaller === SEEDS.length,
     `a diagonal-heavy table must produce smaller intervals than a corner-heavy one (${stepwiseSmaller}/${SEEDS.length}) — ` +
     "if this fails, the matrix editor is decorative");
  console.log(`3 the table steers — diagonal beat corners on ${stepwiseSmaller}/${SEEDS.length} seeds`);
}

// ---- 4 still a generator --------------------------------------------------
{
  const t = table("diag");
  const tunes = new Set(SEEDS.map((seed) => J(melOf(weaveState(seed, { melodyWeave: { [WEAVE]: t } })).map((e) => e.pch))));
  ok(tunes.size > 1, "the same table gave the same tune under every seed — it is behaving like a recording");
  console.log(`4 still a generator — ${tunes.size} distinct tunes from one table over ${SEEDS.length} seeds`);
}

// ---- 5 the FITTER round-trips ---------------------------------------------
// Mirrors app/daw/machines/weave.js fit() exactly (the browser module is ESM and
// reads window.CsdEngine, so its arithmetic is re-stated here rather than
// imported). A phrase fitted into a weave must make that phrase's OWN transitions
// the strongest in their rows — otherwise "fit from my phrases" is a lie.
{
  const PRIOR = 0.5, WIOI = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  const qIoi = (v) => { let b = 0, bd = Infinity; WIOI.forEach((w, i) => { const d = Math.abs(w - v); if (d < bd) { bd = d; b = i; } }); return b; };
  function fit(cells) {
    const start = new Array(8).fill(PRIOR), slot = Array.from({ length: 8 }, () => new Array(8).fill(PRIOR));
    const ioiStart = new Array(8).fill(PRIOR), ioi = Array.from({ length: 8 }, () => new Array(8).fill(PRIOR));
    let n = 0;
    for (const cell of cells) {
      if (!cell || cell.length < 2) continue;
      const ns = cell.slice().sort((a, b) => a[0] - b[0]);
      const sl = ns.map(([, , idx, oct]) => Math.max(0, Math.min(7, (idx | 0) + (oct ? 4 : 0))));
      start[sl[0]]++; n++;
      for (let i = 0; i + 1 < sl.length; i++) slot[sl[i]][sl[i + 1]]++;
      const gaps = []; for (let i = 0; i + 1 < ns.length; i++) gaps.push(qIoi(ns[i + 1][0] - ns[i][0]));
      if (gaps.length) ioiStart[gaps[0]]++;
      for (let i = 0; i + 1 < gaps.length; i++) ioi[gaps[i]][gaps[i + 1]]++;
    }
    return n ? { start: norm(start), slot: slot.map(norm), ioiStart: norm(ioiStart), ioi: ioi.map(norm), legato: 0.9, step: 0.4 } : null;
  }
  // a deliberate shape: a rising run, so slot i -> i+1 must dominate every row
  const rising = [[0, .5, 0, 0], [.5, .5, 1, 0], [1, .5, 2, 0], [1.5, .5, 3, 0],
                  [2, .5, 0, 1], [2.5, .5, 1, 1], [3, .5, 2, 1], [3.5, .5, 3, 1]];
  const w = fit([rising]);
  ok(!!w, "the fitter returned a table");
  let dominant = 0, rows = 0;
  for (let r = 0; r < 7; r++) {
    const row = w.slot[r], best = row.indexOf(Math.max.apply(null, row));
    rows++; if (best === r + 1) dominant++;
  }
  ok(dominant === rows, `a rising phrase must make i->i+1 the strongest move in every row (${dominant}/${rows})`);
  // and the fitted table must actually drive the engine
  const a = melOf(weaveState(1));
  const b = melOf(weaveState(1, { melodyWeave: { [WEAVE]: w } }));
  ok(J(a) !== J(b), "the fitted table changed nothing when played");
  console.log(`5 the fitter round-trips — ${dominant}/${rows} rows dominated by the drawn move`);
}

if (fails) { console.error(`\nMELODY-WEAVE-DAW: FAIL — ${fails}/${checks} checks`); process.exit(1); }
console.log(`\nMELODY-WEAVE-DAW: PASS — ${checks} checks; the weave table steers the line and the fitter is honest`);
