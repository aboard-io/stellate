#!/usr/bin/env node
// melody-weave.test.js — gates for the mined melody ORGAN (tools/mine-weave.js
// → the MINED_WEAVE block + walk in csd-engine melodyEvents).
//   node test/melody-weave.test.js
//
// Gates, in order:
//   1  spliced + stochastic   all four families present; start/slot-rows/
//                             ioiStart/ioi-rows each sum to ~1; legato in (0,1]
//   2  registered             the weave pattern names are engine vocabulary
//   3  organs emit            every family renders melody notes on a muted
//                             hand state, at a sane density (0.5..4 /beat)
//   4  chord-safe             every weave pitch is one of the chord's lead
//                             tones (± octave) — the ladder contract
//   5  determinism            same state builds twice byte-identically
//   6  density order          folkweave is sparser than classicalweave (the
//                             corpus order: folk narrow/plain vs dense piano)
"use strict";
const E = require("../engine/csd-engine.js");
const fs = require("fs");

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};
const FAMS = ["folkweave", "jazzweave", "guitarweave", "classicalweave"];

// ---- 1: spliced + stochastic ----
(() => {
  const src = fs.readFileSync(require.resolve("../engine/csd-engine.js"), "utf8");
  const m = src.match(/const MINED_WEAVE=(\{.*?\});/s);
  if (!m) { gate("MINED_WEAVE spliced + stochastic", false, "no block"); return; }
  const W = JSON.parse(m[1]);
  let ok = true, why = "";
  for (const f of FAMS) {
    const t = W[f];
    if (!t) { ok = false; why = f + " missing"; break; }
    const sums = [t.start, ...t.slot, t.ioiStart, ...t.ioi].map(r => r.reduce((a, b) => a + b, 0));
    if (sums.some(s => Math.abs(s - 1) > 0.02)) { ok = false; why = f + " row sum off"; }
    if (!(t.legato > 0 && t.legato <= 1)) { ok = false; why = f + " legato " + t.legato; }
  }
  gate("MINED_WEAVE spliced + stochastic", ok, why);
})();

// ---- 2: registered ----
gate("weave patterns registered", FAMS.every(f => E.MELODY_PATTERNS.includes(f)));

function melState(pattern, seed) {
  const s = E.defaultState();
  s.seed = seed; s.foundSources = []; s.swing = 0; s.humanize = 0;
  s.transforms = { pool: ["rest"], rate: 0 };
  s.sections = [{ id: "m1", name: "verse", cycles: 2, pads: false, bass: "off", drums: "off", melody: pattern, found: { sourceId: null, role: "bed" }, fill: "off" }];
  return s;
}

// ---- 3+4+5: emit, chord-safe, deterministic ----
(() => {
  let ok = true, safe = true, det = true, why = "", dens = {};
  for (const f of FAMS) {
    const st = melState(f, 5);
    const ev = E.buildEvents(st);
    const mel = ev.pitched.filter(x => x.voice === "melody");
    const d = mel.length / Math.max(1, ev.totalBeats);
    dens[f] = d;
    if (!(d >= 0.5 && d <= 4)) { ok = false; why = `${f} density ${d.toFixed(2)}`; }
    // chord-safety: every LANDING pc must be a lead-tone pc of its chord bar
    // (v2 passing tones are off-ladder BY DESIGN — flagged pass:1, exempt,
    // and capped below half the line)
    const prg = E.getProgression(st.progression), cb = st.chordEvery || 8;
    for (const e of mel) {
      if (e.pass) continue;
      const ci = Math.floor((e.beat % (prg.chords.length * cb)) / cb);
      const leadPcs = new Set(prg.chords[ci].lead.map(p => E.pchToMidi(p) % 12));
      if (!leadPcs.has(E.pchToMidi(e.pch) % 12)) { safe = false; why = why || `${f} off-ladder pc at beat ${e.beat}`; break; }
    }
    const passShare = mel.filter(e => e.pass).length / Math.max(1, mel.length);
    if (passShare > 0.5) { safe = false; why = why || `${f} passing-tone share ${passShare.toFixed(2)} > .5`; }
    if (JSON.stringify(E.buildEvents(st)) !== JSON.stringify(ev)) det = false;
  }
  gate("organs emit at sane density", ok, why);
  gate("chord-safe: every pitch on the ladder", safe, why);
  gate("determinism", det);
  // ---- 6: density order ----
  gate("density order: folk sparser than classical", dens.folkweave < dens.classicalweave,
    `folk ${dens.folkweave.toFixed(2)} classical ${dens.classicalweave.toFixed(2)}`);
})();

// ---- 7: v2 step motion (the passing-tone connectors move rendered stepFrac
// toward the corpus ~.4-.5; v1's ladder-only walk sat at ~.07). Floors are
// below measured with margin; guitar/classical plateau lower because their
// corpus steps live inside fast runs no subdivision can host (the v3 note).
(() => {
  const floors = { folkweave: 0.3, jazzweave: 0.28, guitarweave: 0.18, classicalweave: 0.18 };
  let ok = true, why = "";
  for (const f of FAMS) {
    let step = 0, ivN = 0;
    for (const seed of [1, 3, 5, 8]) {
      const mel = E.buildEvents(melState(f, seed)).pitched.filter(x => x.voice === "melody").sort((a, b) => a.beat - b.beat);
      for (let i = 0; i + 1 < mel.length; i++) { const a = Math.abs(E.pchToMidi(mel[i + 1].pch) - E.pchToMidi(mel[i].pch)); if (a >= 1 && a <= 2) step++; ivN++; }
    }
    const sf = step / Math.max(1, ivN);
    if (sf < floors[f]) { ok = false; why = `${f} stepFrac ${sf.toFixed(3)} < ${floors[f]}`; }
  }
  gate("v2 connectors: rendered step motion above floors", ok, why);
})();

process.exit(fails ? 1 : 0);
