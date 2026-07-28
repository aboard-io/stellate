#!/usr/bin/env node
// ci-standin-media.js — synthesize stand-in media so the gates run in a clean
// clone with ZERO fetched audio (CI, or any contributor checkout).
//
//   node tools/build/ci-standin-media.js          # writes only what's missing
//   node tools/build/ci-standin-media.js --list   # print the enumerated paths, write nothing
//
// The one rule: source is committed, audio is derived and gitignored. That
// means a fresh clone has recipes but no media — and test/gates/engine.test.js
// hard-exits if any state foundSource path is missing on disk. This script
// fills every such path with 1 second of quiet, deterministic PCM16 noise
// (44.1k mono, ~86KB each; 1023 paths / ~86MB / ~4s total on a clean clone):
// enough to satisfy the existence check, the ffmpeg
// decode, and the non-silence RMS gates. The SIGNAL in a CI press comes from
// the committed Faust wasm voices (engine/faust/dist/); the found/sampler
// layers just decode noise. CI proves pipeline structure, not sonic content —
// local ./verify.sh over real fetched media stays the pre-ship gate
// (machines verify structure, human ears verify taste).
//
// Enumeration is registry-driven so new genres/samples/samplers in a PR are
// covered automatically:
//   - every GenreKernel SOURCES id        -> found/<id>.mp3
//   - every GenreKernel SAMPLES entry     -> found/samples/<file>
//   - every GenreKernel SAMPLERS zone     -> found/samples/instruments/<dir>/<file>
//   - foundSources of E.defaultState() and K.track(<every genre>, seeds 1..3)
//     (catches drum-kit / perc-bank paths, which aren't exported directly)
//   - found/tokyo_station.64.mp3 + found/tw_vocal.mp3 (engine.test remaps/strips)
//
// NEVER overwrites: any path that already exists on disk (real fetched media,
// or a previous stand-in) is skipped, so running this on a dev machine with a
// populated found/ tree is a no-op.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const E = require(path.join(ROOT, "engine", "csd-engine.js"));
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));

const LIST_ONLY = process.argv.includes("--list");

// ---- enumerate every media path the gates could ask for (repo-relative) ----
const paths = new Set();
const addState = (st) => {
  for (const s of st.foundSources || []) {
    if (s.synthText) continue;   // SPEECH organ source: no file path to stand in —
                                 // press synthesizes it from the committed vendor/ wasm
    paths.add(s.samplePath || "found/" + s.id + ".mp3");
  }
};

for (const id of Object.keys(K.SOURCES)) paths.add("found/" + id + ".64.mp3");   // beds carry the bitrate in the name (immutable-by-name)
for (const s of Object.values(K.SAMPLES)) paths.add("found/samples/" + s.file);
for (const S of Object.values(K.SAMPLERS))
  for (const z of S.zones) paths.add("found/samples/instruments/" + S.dir + "/" + z.file);

addState(E.defaultState());
for (const g of Object.keys(K.GENRES))
  for (const seed of [1, 2, 3]) addState(K.track(g, { seed }));

paths.add("found/tokyo_station.64.mp3");   // engine.test maps the default song's bed here
paths.add("found/tw_vocal.mp3");        // stripped by engine.test, used by full presses

// ---- deterministic quiet noise, 1s PCM16 mono 44.1k (~86KB per file) ----
// NOTE: .mp3-named stand-ins deliberately carry these WAV bytes — ffmpeg (and
// decodeAudioData) sniff content, not extension, so CI decode still works.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function standinWav(seed) {
  const sr = 44100, n = sr, amp = 0.25;   // 1s, peak -12dBFS — loud enough that even the
                                          // quietest voice-led press clears the rms>0.01 gate
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);  buf.writeUInt16LE(1, 22);       // PCM, mono
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);  // rate, byterate
  buf.writeUInt16LE(2, 32);  buf.writeUInt16LE(16, 34);      // block, bits
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  const rng = mulberry32(seed >>> 0);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.round((rng() * 2 - 1) * amp * 32767), 44 + i * 2);
  return buf;
}

// ---- write only what's missing; never clobber real media ----
const sorted = [...paths].sort();
if (LIST_ONLY) { sorted.forEach((p) => console.log(p)); process.exit(0); }

let written = 0, skipped = 0, bytes = 0, seed = 0x5EED;
for (const rel of sorted) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) { skipped++; continue; }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const wav = standinWav(seed++);
  fs.writeFileSync(abs, wav);
  written++; bytes += wav.length;
}
console.log(
  `ci-standin-media: ${sorted.length} paths — wrote ${written} stand-ins ` +
  `(${(bytes / 1048576).toFixed(1)}MB), kept ${skipped} existing file(s)`
);
