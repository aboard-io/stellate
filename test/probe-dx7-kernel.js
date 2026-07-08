#!/usr/bin/env node
// faust/probe-dx7-kernel.js — VERIFICATION PROBE (item 2, kernel half).
// The explorer live DX7 morph feeds on S.target = K.mix(weights) each drag
// step, and glideStep lerps S.playing toward it. This probe verifies the
// KERNEL blend that produces S.target: for a genre pair sharing a DX7 algorithm
// on a voice, sample K.mix at t=0..1 and show the 144-dim param vector
// interpolating monotonically (no jumps to endpoints). Pure node, no browser.
"use strict";
const K = require("../engine/genre-kernel.js");

function endpointPatch(genre, voiceKey, seed) {
  const st = K.mix([{ g: genre, w: 1 }], { seed });
  const d = st.instruments && st.instruments[voiceKey] && st.instruments[voiceKey].dx7;
  return d || null;
}

// find a voice + genre pair sharing a dx7 algorithm at a common seed
const VKS = ["melody", "bass", "pad"];
const genres = K.GENRES ? Object.keys(K.GENRES) : [];
let found = null;
for (let seed = 1; seed <= 12 && !found; seed++) {
  for (const vk of VKS) {
    const withDx7 = [];
    for (const g of genres) {
      const d = endpointPatch(g, vk, seed);
      if (d && d.algorithm != null && d.params) withDx7.push({ g, alg: d.algorithm, name: d.name });
    }
    // group by algorithm, pick a pair with same alg but different patch names
    const byAlg = {};
    for (const e of withDx7) (byAlg[e.alg] = byAlg[e.alg] || []).push(e);
    for (const alg of Object.keys(byAlg)) {
      const arr = byAlg[alg];
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++)
        if (arr[i].name !== arr[j].name) { found = { seed, vk, a: arr[i], b: arr[j] }; break; }
      if (found) break;
    }
    if (found) break;
  }
}
if (!found) { console.log("no same-algorithm dx7 genre pair found in seed 1..12"); process.exit(2); }

const { seed, vk, a, b } = found;
console.log(`pair: voice=${vk} seed=${seed} A=${a.g}(${a.name},alg${a.alg}) B=${b.g}(${b.name},alg${b.alg})`);

const pa = endpointPatch(a.g, vk, seed).params;
const pb = endpointPatch(b.g, vk, seed).params;
// pick a handful of params that differ most between endpoints
const keys = Object.keys(pa).filter((k) => typeof pa[k] === "number" && typeof pb[k] === "number");
const moved = keys.map((k) => ({ k, d: Math.abs((pb[k] || 0) - (pa[k] || 0)) })).sort((x, y) => y.d - x.d).slice(0, 6).map((x) => x.k);

console.log("sampling K.mix blend across the drag (wB = weight on B):");
const rows = [];
for (const wB of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1]) {
  const st = K.mix([{ g: a.g, w: 1 - wB }, { g: b.g, w: wB }], { seed });
  const d = st.instruments[vk].dx7;
  rows.push({ wB, name: d ? d.name : "(none)", alg: d ? d.algorithm : null,
    vals: d && d.params ? moved.map((k) => d.params[k]) : moved.map(() => null) });
}
console.log("wB".padEnd(6), "name".padEnd(22), ...moved.map((k) => k.padEnd(9)));
for (const r of rows)
  console.log(String(r.wB).padEnd(6), String(r.name).slice(0, 21).padEnd(22),
    ...r.vals.map((v) => (v == null ? "-" : String(v)).padEnd(9)));

// monotonicity check per param across the interior sweep
let monoOK = 0, monoBad = 0;
for (let ki = 0; ki < moved.length; ki++) {
  const seq = rows.map((r) => r.vals[ki]).filter((v) => v != null);
  if (seq.length < 3) continue;
  const inc = seq.every((v, i) => i === 0 || v >= seq[i - 1] - 1e-6);
  const dec = seq.every((v, i) => i === 0 || v <= seq[i - 1] + 1e-6);
  if (inc || dec) monoOK++; else monoBad++;
}
console.log(`\nmonotone params (of ${moved.length} sampled): ${monoOK} monotone, ${monoBad} non-monotone`);
console.log(`endpoint match: wB=0 name=${rows[0].name} == A(${a.name})? ${rows[0].name === a.name}; wB=1 name=${rows[rows.length-1].name} == B(${b.name})? ${rows[rows.length-1].name === b.name}`);
process.exit(0);
