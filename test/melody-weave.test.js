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
    // chord-safety: every melody pc must be a lead-tone pc of its chord bar
    const prg = E.getProgression(st.progression), cb = st.chordEvery || 8;
    for (const e of mel) {
      const ci = Math.floor((e.beat % (prg.chords.length * cb)) / cb);
      const leadPcs = new Set(prg.chords[ci].lead.map(p => E.pchToMidi(p) % 12));
      if (!leadPcs.has(E.pchToMidi(e.pch) % 12)) { safe = false; why = why || `${f} off-ladder pc at beat ${e.beat}`; break; }
    }
    if (JSON.stringify(E.buildEvents(st)) !== JSON.stringify(ev)) det = false;
  }
  gate("organs emit at sane density", ok, why);
  gate("chord-safe: every pitch on the ladder", safe, why);
  gate("determinism", det);
  // ---- 6: density order ----
  gate("density order: folk sparser than classical", dens.folkweave < dens.classicalweave,
    `folk ${dens.folkweave.toFixed(2)} classical ${dens.classicalweave.toFixed(2)}`);
})();

process.exit(fails ? 1 : 0);
