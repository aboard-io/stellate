#!/usr/bin/env node
// fixtures.js — KERNEL-V4 Phase-0 fixture harness (byte-stability gate for the
// strangler migration; see KERNEL-V4.md §3.7). Captures, for a pinned set of
// genres × seeds:
//   state    sha256 of JSON.stringify(track state)        (kernel rng law)
//   events   sha256 of JSON.stringify(buildEvents(state)) (engine event fabric)
//   features sha256 of JSON.stringify(verifier features)  (symbolic identity)
// plus per-KIT drum-stream hashes (every drum pattern × seeds, with and
// without a euclid overlay) — the Phase "kits become data" gate: streams must
// stay IDENTICAL (event order included: downstream humanity passes consume
// rng per event, so order drift is behavior drift, not cosmetics).
//
//   node fixtures.js capture   -> writes scratch/fixtures.json (gitignored: derived)
//   node fixtures.js check     -> recomputes and diffs; nonzero exit on any drift
//   node fixtures.js perf      -> buildEvents timing over the pinned set
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const E = require("./csd-engine.js");
const K = require("./genre-kernel.js");
const V = require("./genre-verifier.js");

const OUT = path.join(__dirname, "scratch", "fixtures.json");
const SEEDS = [1, 2, 3, 4, 5];
const KIT_SEEDS = [1, 2, 3];
const sha = (o) => crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex").slice(0, 16);

function kitState(kind, seed, euclid) {
  const s = E.defaultState();
  s.seed = seed;
  s.foundSources = [];
  if (euclid) s.euclid = euclid;
  s.sections = [{ id: "k", name: "kit", cycles: 2, pads: false, bass: "off", drums: kind,
    melody: "off", found: { sourceId: null, role: "bed" }, fill: "off" }];
  return s;
}

function capture() {
  const fx = { genres: {}, kits: {} };
  for (const g of Object.keys(K.GENRES)) {
    for (const seed of SEEDS) {
      const st = K.track(g, { seed });
      const ev = E.buildEvents(st);
      fx.genres[`${g}/s${seed}`] = { state: sha(st), events: sha(ev), features: sha(V.features(st)) };
    }
  }
  for (const kind of E.DRUM_PATTERNS) {
    if (kind === "off") continue;
    for (const seed of KIT_SEEDS) {
      fx.kits[`${kind}/s${seed}`] = sha(E.buildEvents(kitState(kind, seed)).drums);
      fx.kits[`${kind}/s${seed}/eu`] = sha(E.buildEvents(kitState(kind, seed,
        { kick: [3, 8], hat: [7, 16], snare: [3, 16] })).drums);
    }
  }
  return fx;
}

const mode = process.argv[2] || "check";
if (mode === "capture") {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(capture(), null, 1));
  const fx = JSON.parse(fs.readFileSync(OUT, "utf8"));
  console.log(`captured ${Object.keys(fx.genres).length} genre×seed + ${Object.keys(fx.kits).length} kit fixtures -> ${OUT}`);
} else if (mode === "check") {
  if (!fs.existsSync(OUT)) { console.error(`no ${OUT} — run: node fixtures.js capture`); process.exit(2); }
  const want = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const got = capture();
  let bad = 0;
  for (const [k, v] of Object.entries(want.genres)) {
    const g = got.genres[k];
    for (const f of ["state", "events", "features"])
      if (!g || g[f] !== v[f]) { bad++; console.log(`DRIFT ${k} ${f}: ${v[f]} -> ${g ? g[f] : "?"}`); }
  }
  for (const [k, v] of Object.entries(want.kits))
    if (got.kits[k] !== v) { bad++; console.log(`DRIFT kit ${k}: ${v} -> ${got.kits[k]}`); }
  const n = Object.keys(want.genres).length * 3 + Object.keys(want.kits).length;
  console.log(bad ? `FAIL: ${bad}/${n} fixture hashes drifted` : `PASS: ${n} fixture hashes byte-stable`);
  process.exit(bad ? 1 : 0);
} else if (mode === "perf") {
  // buildEvents timing over the pinned genre×seed set (states prebuilt so the
  // measurement isolates the engine, not the kernel)
  const states = [];
  for (const g of Object.keys(K.GENRES)) for (const seed of SEEDS) states.push(K.track(g, { seed }));
  for (const st of states) E.buildEvents(st);   // warm
  const runs = [];
  for (let r = 0; r < 5; r++) {
    const t0 = process.hrtime.bigint();
    for (const st of states) E.buildEvents(st);
    runs.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  runs.sort((a, b) => a - b);
  console.log(`buildEvents x ${states.length} states: best ${runs[0].toFixed(1)}ms, median ${runs[2].toFixed(1)}ms ` +
    `(${(runs[2] / states.length).toFixed(3)}ms/state)`);
} else {
  console.error("usage: node fixtures.js capture|check|perf"); process.exit(2);
}
