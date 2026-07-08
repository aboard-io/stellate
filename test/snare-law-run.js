#!/usr/bin/env node
// snare-law-run.js — the SNARE-LAW regression gate. Renders every genre × seeds
// through buildEvents and asserts the kernel law holds: NO snare bar (and no hat
// bar) repeats its perceived pattern more than twice in a row. "Perceived
// pattern" = the SAME signature the law itself uses — each onset quantized to
// the 1/16 grid + a 3-level accent bucket (+ open flag for hats) — so micro amp/
// timing jitter is transparent and only a real ghost/drop/accent/displacement
// counts as a change. A gap bar (no hits on that lane) resets the run.
//
//   node snare-law-run.js            all 63 genres × seeds 1..5  (the gate)
//   node snare-law-run.js --quick    a 6-genre spread × seeds 1..3
//   node snare-law-run.js --stats    also print per-genre fire-rate estimates
//
// Exits nonzero on any three-in-a-row (the law's own violation) — wire it in
// beside fixtures.js as the law's standing regression check.
"use strict";
const E = require("../engine/csd-engine.js");
const K = require("../engine/genre-kernel.js");

const args = process.argv.slice(2);
const QUICK = args.includes("--quick");
const STATS = args.includes("--stats");
const SEEDS = QUICK ? [1, 2, 3] : [1, 2, 3, 4, 5];
const GENRES = QUICK
  ? ["techno", "blues", "jungle", "house", "vaporwave", "gabber"]
  : Object.keys(K.GENRES);
const CHORD_BEATS = 8; // the kit-cell measure — the period the law enforces at

const q = (o) => Math.round(o * 2) / 2;
const bk = (a) => (a < 0.14 ? 0 : a < 0.34 ? 1 : 2);
const snSig = (l) => l.map((d) => q(d.beat - l.b0) + ":" + bk(d.amp)).sort().join("|");
const haSig = (l) => l.map((d) => q(d.beat - l.b0) + ":" + bk(d.amp) + (d.open ? "o" : "")).sort().join("|");

// group a lane's events into consecutive CB-beat bars keyed by bar index; a bar
// with no events on the lane is a gap (undefined) that resets the run. CB is the
// kit-cell measure the law uses: min(chordEvery, 8).
function barSigs(drums, drum, sig, totalBeats, CB) {
  const nb = Math.ceil(totalBeats / CB);
  const out = [];
  for (let bi = 0; bi < nb; bi++) {
    const b0 = bi * CB;
    const hits = drums.filter((d) => d.drum === drum && d.beat >= b0 - 1e-6 && d.beat < b0 + CB - 1e-6);
    if (!hits.length) { out.push(null); continue; }
    hits.b0 = b0;
    out.push(sig(hits));
  }
  return out;
}

// longest run of an identical non-null signature, and where.
function worstRun(sigs) {
  let run = 1, worst = 1, at = -1, cur = null;
  for (let i = 0; i < sigs.length; i++) {
    const s = sigs[i];
    if (s == null) { run = 1; cur = null; continue; }
    if (s === cur) { run++; if (run > worst) { worst = run; at = i - run + 1; } }
    else { cur = s; run = 1; }
  }
  return { worst, at };
}

let fails = 0, checked = 0;
const fireStat = {};
for (const g of GENRES) {
  let gWorstS = 1, gWorstH = 1, bars = 0, variedBars = 0;
  for (const seed of SEEDS) {
    const st = K.track(g, { seed });
    const CB = Math.min(Math.max(2, Math.round(st.chordEvery || CHORD_BEATS)), CHORD_BEATS);
    const ev = E.buildEvents(st);
    const sSigs = barSigs(ev.drums, "snare", snSig, ev.totalBeats, CB);
    const hSigs = barSigs(ev.drums, "hat", haSig, ev.totalBeats, CB);
    const ws = worstRun(sSigs), wh = worstRun(hSigs);
    checked++;
    if (ws.worst > 2) { fails++; console.error(`  FAIL ${g}/s${seed}: snare bar repeats ${ws.worst}× at bar ${ws.at}`); }
    if (wh.worst > 2) { fails++; console.error(`  FAIL ${g}/s${seed}: hat   bar repeats ${wh.worst}× at bar ${wh.at}`); }
    gWorstS = Math.max(gWorstS, ws.worst); gWorstH = Math.max(gWorstH, wh.worst);
    if (STATS) {
      // fire estimate: bars whose snare sig differs from a pure kit re-render
      const nonEmpty = sSigs.filter((s) => s != null).length;
      let repeats = 0; for (let i = 2; i < sSigs.length; i++) if (sSigs[i] != null && sSigs[i] === sSigs[i - 1] && sSigs[i - 1] === sSigs[i - 2]) repeats++;
      bars += nonEmpty; variedBars += repeats;
    }
  }
  if (STATS) fireStat[g] = { worstS: gWorstS, worstH: gWorstH, bars, residual: variedBars };
}

if (STATS) {
  console.log("\ngenre           worstSnare worstHat  bars  residual3+");
  for (const g of Object.keys(fireStat)) {
    const s = fireStat[g];
    console.log(`  ${g.padEnd(14)} ${String(s.worstS).padStart(6)} ${String(s.worstH).padStart(8)} ${String(s.bars).padStart(6)} ${String(s.residual).padStart(8)}`);
  }
}

console.log(`\nsnare-law: ${checked - fails}/${checked} states clean (no snare/hat bar repeated >2×)`);
if (fails) { console.error(`snare-law: ${fails} VIOLATION(S)`); process.exit(1); }
process.exit(0);
