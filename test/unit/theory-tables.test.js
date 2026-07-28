#!/usr/bin/env node
// theory-tables.test.js — gates for the corpus-mined FUNC_NEXT/POOL tables
// (tools/mine/mine-theory.js --splice → the MINED block in engine/theory.js).
//   node test/unit/theory-tables.test.js
//
// Gates, in order:
//   1  spliced + stochastic   MINED exists for major+minor; every FUNC_NEXT row
//                             and POOL pool sums to ~1
//   2  hand path untouched    progress() WITHOUT tables is byte-identical to
//                             progress({tables:"hand-ish garbage"}) — the flag
//                             only ever switches to corpus, nothing else moves
//                             (theory.test.js pins the hand behavior itself)
//   3  corpus path is real    tables:"corpus" changes the walk for some seed
//                             (else the splice is dead code)
//   4  determinism            corpus path builds twice byte-identically
//   5  handrails hold         under corpus tables: bar 0 root = tonic, last bar
//                             tonic-functional, penultimate bar dominant
//   6  adventure monotone     chromatic-alteration count non-decreasing in
//                             adventure for fixed seed (the standing theory law,
//                             re-checked under corpus tables)
"use strict";
const T = require("../../engine/theory.js");

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};
const J = JSON.stringify;
const mod12 = (x) => ((x % 12) + 12) % 12;

// reach the MINED block through a corpus-tables call; its effect is observable
// only via progress(), so gate 1 reads the source (the block is data, and the
// tool refuses to splice tables that lost the held-out comparison)
const fs = require("fs");
const src = fs.readFileSync(require.resolve("../../engine/theory.js"), "utf8");
(() => {
  const m = src.match(/const MINED=(\{.*?\});/s);
  if (!m) { gate("MINED block spliced", false, "no MINED const in theory.js"); return; }
  const MINED = JSON.parse(m[1]);
  let ok = true, why = "";
  for (const mode of ["major", "minor"]) {
    const t = MINED[mode];
    if (!t || !t.FUNC_NEXT || !t.POOL) { ok = false; why = mode + " missing"; break; }
    for (const f of ["T", "S", "D"]) {
      const rs = Object.values(t.FUNC_NEXT[f]).reduce((a, b) => a + b, 0);
      const ps = t.POOL[f].reduce((a, [, w]) => a + w, 0);
      if (Math.abs(rs - 1) > 0.02 || Math.abs(ps - 1) > 0.02) { ok = false; why = `${mode}.${f} sums ${rs.toFixed(3)}/${ps.toFixed(3)}`; }
    }
  }
  gate("MINED block spliced + stochastic", ok, why);
})();

const BASE = { mode: "ionian", root: 0, bars: 8, adventure: 0.3, color: 0.4, seed: 11 };
(() => {
  const a = J(T.progress({ ...BASE }));
  const b = J(T.progress({ ...BASE, tables: "anything-not-corpus" }));
  gate("hand path untouched by the flag", a === b);
})();
(() => {
  let differs = false;
  for (let seed = 1; seed <= 12 && !differs; seed++) {
    const h = J(T.progress({ ...BASE, seed }).map(c => c.rootPc));
    const c = J(T.progress({ ...BASE, seed, tables: "corpus" }).map(c => c.rootPc));
    if (h !== c) differs = true;
  }
  gate("corpus tables change the walk", differs);
})();
(() => {
  const a = J(T.progress({ ...BASE, tables: "corpus" }));
  const b = J(T.progress({ ...BASE, tables: "corpus" }));
  gate("corpus path determinism", a === b);
})();
(() => {
  let ok = true, why = "";
  for (const mode of ["ionian", "aeolian"]) for (let seed = 1; seed <= 8; seed++) {
    const ch = T.progress({ mode, root: 2, bars: 8, adventure: 0, color: 0.3, seed, tables: "corpus" });
    if (mod12(ch[0].rootPc) !== 2) { ok = false; why = `${mode}#${seed} bar0 root ${ch[0].rootPc}`; }
    if (ch[ch.length - 1].func !== "T") { ok = false; why = `${mode}#${seed} last func ${ch[ch.length - 1].func}`; }
    if (ch[ch.length - 2].func !== "D") { ok = false; why = `${mode}#${seed} penult func ${ch[ch.length - 2].func}`; }
  }
  gate("handrails hold under corpus tables", ok, why);
})();
(() => {
  // THE house law, verbatim from theory.test.js gate 4 but under corpus
  // tables: non-diatonic pad pitch classes, averaged over 12 seeds, must be
  // non-decreasing across the adventure gate levels (per-seed strictness is
  // NOT the contract — tier capture can hand a bar a chord that equals its
  // baseline by name, e.g. V7-of-tonic at a cadence that already carries V7)
  const dia = new Set([0, 2, 3, 5, 7, 8, 10]);   // aeolian, like the house gate
  const chroma = (ch) => ch.reduce((c, x) => c + x.pads.filter(p => !dia.has(T.parsePch(p) % 12)).length, 0);
  const levels = [0.1, 0.4, 0.65, 0.9], avg = [];
  for (const adv of levels) {
    let sum = 0;
    for (let seed = 1; seed <= 12; seed++) sum += chroma(T.progress({ mode: "aeolian", root: 0, adventure: adv, color: 0.5, bars: 8, seed, tables: "corpus" }));
    avg.push(sum / 12);
  }
  let ok = avg[3] > avg[0], why = ok ? "" : `0.9 (${avg[3].toFixed(2)}) not above 0.1 (${avg[0].toFixed(2)})`;
  for (let k = 1; k < avg.length; k++) if (avg[k] < avg[k - 1] - 1e-9) { ok = false; why = `avg fell ${avg[k - 1].toFixed(2)} -> ${avg[k].toFixed(2)} at ${levels[k]}`; }
  gate("adventure monotone under corpus tables (seed-averaged)", ok, why);
})();

process.exit(fails ? 1 : 0);
