#!/usr/bin/env node
// tools/lerp-genre.js — INVENT a genre by lerping two existing anchors.
//
// "simple lerps": genre C = interpolate(A, B, t). Numeric ranges/scalars are
// linearly blended; categorical lists (progressions, kits, patterns, sampler
// pools, drum models) are UNIONed (deduped, capped); strings pick the nearer
// parent. The result fills the hollow space BETWEEN two genres on the map. The
// derived theory/rhythm/pipes are re-attached by the kernel at splice time, so
// we emit only the CORE spec fields (the same set genre-tool.js create wants).
//
//   node tools/lerp-genre.js <A> <B> <newname> "<label>" "<info>" [t=0.5]
//     -> writes genre-specs/<newname>.json  (then: genre-tool.js create it)
"use strict";
const fs = require("fs");
const path = require("path");
const K = require(path.join(__dirname, "..", "engine", "genre-kernel.js"));

const SPEC_FIELDS = ["bpm", "swing", "humanize", "chordEvery", "progressions", "kits",
  "fills", "form", "stab", "bass", "lead", "pads", "drums", "fx", "found", "rubato", "hits"];

const isNum = (v) => typeof v === "number";
const isRange = (v) => Array.isArray(v) && v.length === 2 && v.every(isNum);
const isStrArr = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");

function roundLike(n, a, b) {
  // integer iff both source endpoints are integers (bpm, cutoff, voices, periodBars…)
  if (Number.isInteger(a) && Number.isInteger(b)) return Math.round(n);
  return +n.toFixed(4);
}
const lerpN = (a, b, t) => roundLike(a + (b - a) * t, a, b);

function uniqCap(arr, cap = 4) {
  const out = []; for (const x of arr) if (!out.some((y) => JSON.stringify(y) === JSON.stringify(x))) out.push(x);
  return out.slice(0, cap);
}

function lerpVal(va, vb, t, key) {
  if (va === undefined) return vb;
  if (vb === undefined) return va;
  if (isRange(va) && isRange(vb)) return [lerpN(va[0], vb[0], t), lerpN(va[1], vb[1], t)];
  if (isNum(va) && isNum(vb)) return lerpN(va, vb, t);
  if (isStrArr(va) && isStrArr(vb)) return uniqCap(t < 0.5 ? va.concat(vb) : vb.concat(va), key === "samplerPool" ? 3 : 4);
  if (Array.isArray(va) && Array.isArray(vb)) return uniqCap(va.concat(vb), 4);
  if (typeof va === "string" && typeof vb === "string") return t < 0.5 ? va : vb;
  if (va && vb && typeof va === "object" && typeof vb === "object") {
    const out = {}; const keys = new Set([...Object.keys(va), ...Object.keys(vb)]);
    for (const k of keys) out[k] = lerpVal(va[k], vb[k], t, k);
    return out;
  }
  return t < 0.5 ? va : vb;
}

function main() {
  const [A, B, name, label, info, tArg] = process.argv.slice(2);
  if (!A || !B || !name) { console.error('usage: lerp-genre.js <A> <B> <newname> "<label>" "<info>" [t]'); process.exit(1); }
  const ga = K.GENRES[A], gb = K.GENRES[B];
  if (!ga) { console.error("no genre: " + A); process.exit(1); }
  if (!gb) { console.error("no genre: " + B); process.exit(1); }
  const t = tArg ? parseFloat(tArg) : 0.5;
  const anchor = {};
  for (const f of SPEC_FIELDS) {
    const v = lerpVal(ga[f], gb[f], t, f);
    if (v !== undefined) anchor[f] = v;
  }
  // 'found'/'hits' carry sample/pool source refs; a pool valid in one parent can
  // be unregistered by the tool's stricter validator (hand-written genres skip
  // it). Keep the blended vol/cutoff FEEL but pin sources to the known-safe set.
  if (anchor.found) { anchor.found = Object.assign({}, anchor.found, { role: "bed", sources: ["iriomote", "tokyo_station"] }); }
  if (anchor.hits) { anchor.hits = { sources: ["sp_herenow"], pattern: "sparse", prob: Math.min(0.12, (anchor.hits.prob || 0.03)) }; }
  // clips: prefer A's (a real GENRE_CLIPS set), fall back to B's
  const clips = (K.GENRE_CLIPS && (K.GENRE_CLIPS[A] || K.GENRE_CLIPS[B])) || [];
  const spec = {
    name, label: label || name,
    info: info || `invented genre — a lerp (t=${t}) between ${A} and ${B}`,
    clips: clips.slice(0, 5),
    anchor,
    verify: { seeds: 6, widen: 0.12, features: { acoustic: 3, bpm: 2, drumDensity: 3, wash: 2, motion: 2, seventh: 2, rubato: 1, humanize: 1 } },
  };
  const out = path.join(__dirname, "..", "genre-specs", name + ".json");
  fs.writeFileSync(out, JSON.stringify(spec, null, 2) + "\n");
  console.log(`wrote ${out}  (lerp ${A}<->${B} @ t=${t})`);
}
main();
