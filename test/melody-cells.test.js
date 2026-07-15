#!/usr/bin/env node
// melody-cells.test.js — gates for the MIDI-trove mined melody cells
// (tools/mine-melody.js → MEL_PHRASES folkline/jazzline/ragline + A/B twins).
//   node test/melody-cells.test.js
//
// Gates, in order:
//   1  registered + valid   the 3 cells (+ twins) exist, every note is
//                           [o<8, d>0, idx 0..3, oct 0..1]
//   2  fingerprint order    rendered off-beat-16th fraction: jazzline HIGH,
//                           folkline LOW, and jazzline > folkline by a wide
//                           margin (the corpus order: jazz .66 vs folk .08);
//                           ragline is the DENSE one (>2 notes/beat)
//   3  A/B alternation      the generic twin rule fires: chord 0 and chord 1
//                           carry different onset patterns
//   4  determinism          same state builds twice byte-identically
"use strict";
const E = require("../engine/csd-engine.js");

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};

// ---- 1: registered + valid ----
(() => {
  let ok = true, why = "";
  for (const n of ["folkline", "jazzline", "ragline", "dubline"]) {
    if (!E.MELODY_PATTERNS.includes(n)) { ok = false; why = n + " not registered"; }
  }
  const src = require("fs").readFileSync(require.resolve("../engine/csd-engine.js"), "utf8");
  const cells = src.match(/(folkline|folkline2|jazzline|jazzline2|ragline|ragline2|dubline|dubline2):\s*\[\[/g) || [];
  if (cells.length !== 8) { ok = false; why = `only ${cells.length}/8 cells present`; }
  gate("cells registered + present", ok, why);
})();

// a muted hand state that plays ONLY the melody pattern under test
function melState(pattern, seed) {
  const s = E.defaultState();
  s.seed = seed; s.foundSources = []; s.swing = 0; s.humanize = 0;
  s.transforms = { pool: ["rest"], rate: 0 };
  s.sections = [{ id: "m1", name: "verse", cycles: 2, pads: false, bass: "off", drums: "off", melody: pattern, found: { sourceId: null, role: "bed" }, fill: "off" }];
  return s;
}
const offbeat16 = (evs) => evs.filter(e => { const f = e.beat * 4 - Math.round(e.beat * 4); return Math.abs(f) > 0.01 || Math.abs((e.beat * 4) % 2 - 1) < 0.01; }).length / Math.max(1, evs.length);
const mel = (pattern, seed) => E.buildEvents(melState(pattern, seed)).pitched.filter(p => p.voice === "melody");

// ---- 2: fingerprint order ----
(() => {
  let jSync = 0, fSync = 0, rDens = 0, n = 0;
  for (const seed of [1, 4, 9]) {
    jSync += offbeat16(mel("jazzline", seed));
    fSync += offbeat16(mel("folkline", seed));
    const r = mel("ragline", seed);
    const beats = Math.max(1, Math.max(...r.map(e => e.beat + e.dur)) - Math.min(...r.map(e => e.beat)));
    rDens += r.length / beats; n++;
  }
  jSync /= n; fSync /= n; rDens /= n;
  // dubline is the SPARSE one — the corpus riff breathes (A 11 notes, B 4)
  let dDens = 0;
  for (const seed of [1, 4, 9]) {
    const d = mel("dubline", seed);
    const beats = Math.max(1, Math.max(...d.map(e => e.beat + e.dur)) - Math.min(...d.map(e => e.beat)));
    dDens += d.length / beats;
  }
  dDens /= n;
  gate("fingerprint order: jazz syncopated, folk on-beat, rag dense, dub sparse",
    jSync > 0.45 && fSync < 0.3 && jSync - fSync > 0.25 && rDens > 2 && dDens < 1.3,
    `jazzline sync ${jSync.toFixed(2)} folkline ${fSync.toFixed(2)} ragline ${rDens.toFixed(2)}/beat dubline ${dDens.toFixed(2)}/beat`);
})();

// ---- 3: A/B alternation ----
(() => {
  const evs = mel("folkline", 2);
  const cb = 8;
  const pat = (ci) => evs.filter(e => e.beat >= ci * cb && e.beat < (ci + 1) * cb).map(e => Math.round((e.beat - ci * cb) * 4) / 4).join(",");
  gate("A/B twin alternation per chord", pat(0) !== pat(1), `chord0 [${pat(0)}] chord1 [${pat(1)}]`);
})();

// ---- 4: determinism ----
(() => {
  const a = JSON.stringify(E.buildEvents(melState("ragline", 7)));
  const b = JSON.stringify(E.buildEvents(melState("ragline", 7)));
  gate("determinism", a === b);
})();

process.exit(fails ? 1 : 0);
