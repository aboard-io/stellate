#!/usr/bin/env node
// make-fixture.js — bake faust/fixture.json from REAL engine output:
// genre-kernel techno state -> csd-engine buildEvents -> pick the densest
// 8-bar (32-beat) window -> rebase beats, convert csound pch to Hz.
// Read-only use of ../csd-engine.js and ../genre-kernel.js (per prototype rules).
"use strict";
const fs = require("fs");
const path = require("path");
const eng = require("../csd-engine.js");
const gk = require("../genre-kernel.js");

const SEED = 7;
const state = gk.track("techno", { seed: SEED });
const ev = eng.buildEvents(state);
const BARS = 8, BEATS = BARS * 4;

// csound pch -> Hz. 8.00 = middle C = 261.6255653; fraction*100 = semitones.
function pchToHz(pch) {
  const v = typeof pch === "number" ? pch : parseFloat(pch);
  const oct = Math.floor(v);
  const semi = Math.round((v - oct) * 100);
  return 261.6255653 * Math.pow(2, (oct - 8) + semi / 12);
}

// pick the 32-beat window with the most combined activity across all layers
let best = { start: 0, score: -1 };
for (let s = 0; s + BEATS <= ev.totalBeats; s += 4) {
  const inW = (e) => e.beat >= s && e.beat < s + BEATS;
  const p = ev.pitched.filter(inW), d = ev.drums.filter(inW);
  const hasPad = p.some(x => x.voice === "pad"), hasMel = p.some(x => x.voice === "melody"), hasBass = p.some(x => x.voice === "bass");
  const score = (hasPad + hasMel + hasBass) * 1000 + p.length + d.length;
  if (score > best.score) best = { start: s, score };
}
const s0 = best.start;
console.log(`window: beats ${s0}..${s0 + BEATS} of ${ev.totalBeats} (score ${best.score})`);

const events = [];
for (const p of ev.pitched) {
  if (p.beat < s0 || p.beat >= s0 + BEATS) continue;
  events.push({ t: +(p.beat - s0).toFixed(4), dur: +p.dur.toFixed(4), voice: p.voice,
                freq: +pchToHz(p.pch).toFixed(3), amp: +p.amp.toFixed(4) });
}
for (const d of ev.drums) {
  if (d.beat < s0 || d.beat >= s0 + BEATS) continue;
  events.push({ t: +(d.beat - s0).toFixed(4), dur: +d.dur.toFixed(4), voice: d.drum,
                amp: +d.amp.toFixed(4), open: d.open ? 1 : 0 });
}
events.sort((a, b) => a.t - b.t);

const I = state.instruments;
const fixture = {
  meta: { genre: "techno", seed: SEED, window: [s0, s0 + BEATS], generated: "make-fixture.js" },
  bpm: state.bpm, beats: BEATS,
  recipes: {
    melody: { cutoff: I.melody.cutoff, res: I.melody.res, level: I.melody.level, send: I.melody.send, dsend: I.melody.dsend },
    pad:    { cutoff: I.pad.cutoff, attack: I.pad.attack, level: I.pad.level, send: I.pad.send, dsend: I.pad.dsend },
    bass:   { cutoff: I.bass ? I.bass.cutoff : 900, res: I.bass ? I.bass.res : 0.2, level: I.bass ? I.bass.level : 0.45, send: I.bass ? I.bass.send : 0.05, dsend: I.bass ? I.bass.dsend : 0 },
    drums:  { kick: I.drums.kick, snare: I.drums.snare, hat: I.drums.hat, tune: I.drums.tune, send: I.drums.send, dsend: I.drums.dsend || 0 },
    delayBeats: (state.delay && state.delay.time) || 0.75, delayFb: (state.delay && state.delay.fb) || 0.35,
    reverb: state.reverb
  },
  events
};
fs.writeFileSync(path.join(__dirname, "fixture.json"), JSON.stringify(fixture, null, 1));
const by = {}; events.forEach(e => by[e.voice] = (by[e.voice] || 0) + 1);
console.log("events:", events.length, JSON.stringify(by), "bpm", state.bpm);
