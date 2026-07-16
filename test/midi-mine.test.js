#!/usr/bin/env node
// midi-mine.test.js — gates for tools/mine-midi.js (the trove miner) and the
// midi-export fixes it forced.
//   node test/midi-mine.test.js
//
// Gates, in order:
//   1  round-trip        buildMidi(state) parsed back: the multiset of
//                        (channel, pitch, on-tick, velocity) note-ons matches
//                        buildEvents exactly, across a genre spread × seeds;
//                        tempo meta matches bpm; PPQ 480
//   2  GM lane coverage  every exported drum note is a real GM percussion
//                        pitch (the old exporter wrote note 0 for toms/crash)
//   3  meter meta        a 3/4 hand state exports nn=3 dd=4 (was hardcoded 4/4)
//   4  determinism       parse twice -> byte-identical JSON
//   5  keycheck          detector vs embedded key signatures on the classical
//                        piano rip: exact-or-relative >= 70% (SKIPs when
//                        found/midi/classical_piano is absent — CI has no media)
"use strict";
const fs = require("fs");
const path = require("path");
const E = require("../engine/csd-engine.js");
const K = require("../engine/genre-kernel.js");
const M = require("../engine/midi-export.js");
const Mine = require("../tools/mine-midi.js");

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};

const GM_MAP = { kick: 36, snare: 38, hat: 42, tom: 45, crash: 49, ride: 51, clap: 39, rim: 37, perc: 63 };
const GM_SET = new Set([...Object.values(GM_MAP), 46]);
const clampVel = (v) => Math.max(1, Math.min(127, Math.round(v)));

function expectedOns(ev) {
  const exp = [];
  for (const p of ev.pitched) {
    const ch = p.voice === "pad" ? 0 : p.voice === "bass" ? 1 : p.voice === "melody" ? 2 : -1;
    if (ch < 0) continue;
    const m = E.pchToMidi(p.pch);
    if (m < 0 || m > 127) continue;
    exp.push(`${ch}:${m}:${Math.round(p.beat * 480)}:${clampVel(40 + p.amp * 280)}`);
  }
  for (const d of ev.drums) {
    const note = d.drum === "hat" ? (d.open ? 46 : 42) : GM_MAP[d.drum];
    if (note == null) continue;
    exp.push(`9:${note}:${Math.round(d.beat * 480)}:${clampVel(40 + d.amp * 220)}`);
  }
  return exp.sort();
}

// ---- 1+2: round-trip + GM lane coverage over a genre spread ----
const GENRES = ["jazz", "jungle", "techno", "dub", "folk", "tango", "bigband", "klezmer"];
let rtOk = true, rtDetail = "", laneOk = true, sawDecorative = 0;
for (const g of GENRES) {
  for (const seed of [1, 5]) {
    const state = K.track(g, { seed });
    const ev = E.buildEvents(state);
    const parsed = Mine.parseSmf(M.buildMidi(state));
    const got = parsed.notes.map(n => `${n.ch}:${n.pitch}:${n.tick}:${n.vel}`).sort();
    const exp = expectedOns(ev);
    if (JSON.stringify(got) !== JSON.stringify(exp)) {
      rtOk = false;
      if (!rtDetail) {
        const gs = new Set(got), es = new Set(exp);
        const miss = exp.filter(x => !gs.has(x)).slice(0, 3), extra = got.filter(x => !es.has(x)).slice(0, 3);
        rtDetail = `${g}#${seed}: ${exp.length} expected vs ${got.length} parsed; missing ${miss.join(" ")} extra ${extra.join(" ")}`;
      }
    }
    const us = Math.round(60000000 / (ev.bpm || 88));
    if (!parsed.tempoMap.length || parsed.tempoMap[0].us !== us) { rtOk = false; rtDetail = rtDetail || `${g}#${seed}: tempo meta ${parsed.tempoMap[0] && parsed.tempoMap[0].us} != ${us}`; }
    if (parsed.ppq !== 480) { rtOk = false; rtDetail = rtDetail || `${g}#${seed}: ppq ${parsed.ppq}`; }
    for (const n of parsed.notes.filter(n => n.ch === 9)) {
      if (!GM_SET.has(n.pitch)) { laneOk = false; rtDetail = rtDetail || `${g}#${seed}: non-GM drum note ${n.pitch}`; }
    }
    sawDecorative += ev.drums.filter(d => !{ kick: 1, snare: 1, hat: 1 }[d.drum]).length;
  }
}
gate("round-trip: note-ons/tempo/ppq exact", rtOk, rtDetail);
gate("GM lane coverage (no note-0 drums)", laneOk, `decorative-lane events exercised: ${sawDecorative}`);

// ---- 3: meter meta ----
(() => {
  const s = E.defaultState();
  s.seed = 3; s.foundSources = []; s.meter = { beats: 3, unit: 4 };
  s.transforms = { pool: ["rest"], rate: 0 };
  s.sections = [{ id: "m1", name: "verse", cycles: 1, pads: true, bass: "waltzroot", drums: "waltz", melody: "waltz", found: { sourceId: null, role: "bed" }, fill: "off" }];
  const parsed = Mine.parseSmf(M.buildMidi(s));
  const ts = parsed.timeSigs[0];
  gate("meter meta: 3/4 state exports 3/4", !!ts && ts.nn === 3 && ts.den === 4, ts ? `${ts.nn}/${ts.den}` : "no timesig meta");
})();

// ---- 4: parser determinism ----
(() => {
  const state = K.track("jazz", { seed: 2 });
  const bytes = M.buildMidi(state);
  const a = JSON.stringify(Mine.parseSmf(bytes)), b = JSON.stringify(Mine.parseSmf(bytes));
  gate("parser determinism", a === b);
})();

// ---- 5: keycheck vs embedded key signatures (needs the fetched corpus) ----
(() => {
  const dir = "/mnt/sources/relocated/stellate-midi-corpus/rips/classical_piano";
  if (!fs.existsSync(dir)) { console.log("SKIP  keycheck: classical_piano rip not fetched (tools/fetch-midi-trove.sh — external drive; the MIDI never lives under found/, it would deploy)"); return; }
  const { rows } = Mine.scanDir(dir, {});
  const withSig = rows.filter(r => r._keySig);
  if (withSig.length < 10) { console.log(`SKIP  keycheck: only ${withSig.length} files carry key signatures`); return; }
  let hit = 0;
  for (const r of withSig) {
    const expT = Mine.keySigTonic(r._keySig.sf, r._keySig.mi), expM = r._keySig.mi ? "minor" : "major";
    const rel = expM === "major" ? (expT + 9) % 12 : (expT + 3) % 12;
    if ((r._key.tonic === expT && r._key.mode === expM) || (r._key.mode !== expM && r._key.tonic === rel)) hit++;
  }
  gate("keycheck: exact-or-relative >= 70%", hit / withSig.length >= 0.7, `${hit}/${withSig.length} (${Math.round(100 * hit / withSig.length)}%)`);
})();

process.exit(fails ? 1 : 0);
