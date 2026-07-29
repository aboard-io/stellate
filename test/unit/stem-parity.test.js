#!/usr/bin/env node
// test/unit/stem-parity.test.js — ZERO-STATIC Stage 3 CI parity gate (standalone;
// wired into nothing — engine.test.js's quick loop stays fast).
//
//   node test/unit/stem-parity.test.js
//
// Drives the stem-worker's persistent StemRenderer in node for 4 bars x 2
// states (a dx7-heavy one and a pad-heavy one) and compares the concatenated
// per-layer x per-bus stems against the PRESS PATH (render-core renderUnit —
// exactly what faust/press.js drives, engine.test.js case 0) rendering the
// same 4 bars whole. Bars are constructed the way live.js injectChord
// constructs them (section collapse + per-bar seed evolution + CBEATS
// windows), so this is the real contract: press-walk(4 bars at once) ==
// stem-walk(4 sequential bars through persistent processors).
//
// GATE (near-bit, per ZERO-STATIC §Stage 3): per-layer-bus RMS correlation
// > 0.999 AND max |sample delta| < 1e-4; float32 byte-equality is reported
// when achieved (expected: the only licensed divergence is a bar-initial
// pre-roll block's discarded ~0 samples — see stem-worker.js PREROLL).
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const E = require(path.join(ROOT, "engine", "csd-engine.js"));
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));
const SE = require(path.join(__dirname, "..", "..", "engine", "faust", "voices", "state-engine.js"));
const RC = require(path.join(__dirname, "..", "..", "engine", "faust", "press", "render-core.js"));
const SW = require(path.join(__dirname, "..", "..", "engine", "faust", "live", "stem-worker.js"));

const SR = 44100, BS = 64, BARS = 4;

// press.js's factory/mkProc, verbatim shape (no ensureDx7Module — the modules
// these states demand are committed in dist/; a miss is a test failure).
let _gen = null;
const _factories = {};
async function factory(mod) {
  if (!_factories[mod]) {
    const code = fs.readFileSync(path.join(__dirname, "..", "..", "engine", "faust", "dist", `${mod}-module.wasm`));
    _factories[mod] = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code),
      json: fs.readFileSync(path.join(__dirname, "..", "..", "engine", "faust", "dist", `${mod}-meta.json`), "utf8"), poly: false };
  }
  return _factories[mod];
}
async function mkProc(mod) {
  if (!_gen) {
    const { FaustMonoDspGenerator } = await import(
      path.join(__dirname, "..", "..", "engine", "faust", "node_modules/@grame/faustwasm/dist/esm/index.js"));
    _gen = new FaustMonoDspGenerator();
  }
  return _gen.createOfflineProcessor(SR, BS, await factory(mod));
}
const rootOf = (mod) => RC.paramRoot(_factories[mod].json);   // UI-tree root (render-core.paramRoot), not the declared name
const dx7Presets = fs.existsSync(path.join(__dirname, "..", "..", "engine", "faust", "data", "dx7-presets.json"))
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "engine", "faust", "data", "dx7-presets.json"), "utf8")) : {};

// live.js's LAYER_OF_UNIT (cached classes only reach pad/lead/fx)
const LAYER_OF_UNIT = (key) =>
  key === "pad" ? "pad" : key === "bass" ? "bass"
  : key === "melody" || key.slice(0, 5) === "solo:" ? "lead"
  : key === "kick" ? "kick" : key === "snare" ? "snare"
  : key === "hat" || key === "tom" ? "hats"
  : "fx";

// mirror injectChord's per-bar state construction (section collapse, seed
// evolution, CBEATS window) for BARS bars of a stationary state.
function makeBars(st) {
  const CBEATS = Math.max(2, Math.round(st.chordEvery || 8));
  const spb = 60 / st.bpm;
  const prg = E.PROGRESSIONS[st.progression] || E.PROGRESSIONS.royal_road;
  const nch = prg.chords.length;
  const secs = st.sections && st.sections.length ? st.sections : [st.sections[0]];
  const bars = [];
  let ci = 0, secIdx = 0, cycIdx = 0;
  for (let serial = 0; serial < BARS; serial++) {
    ci = ci % nch; secIdx = secIdx % secs.length;
    const cur = secs[secIdx], lastCyc = cycIdx >= (cur.cycles || 1) - 1;
    const sec = Object.assign({}, cur, { cycles: 1,
      fill: lastCyc ? (cur.fill || "off") : "off",
      sweep: (cycIdx === 0 && cur.sweep === "open") || (lastCyc && cur.sweep === "close") ? cur.sweep : "off" });
    const one = Object.assign({}, st, { sections: [sec], seed: ((st.seed || 1) + serial * 7919) >>> 0 });
    bars.push({ serial, one, lo: ci * CBEATS, hi: ci * CBEATS + CBEATS, spb, cbeats: CBEATS });
    ci++;
    if (ci >= nch) { ci = 0; cycIdx++;
      if (cycIdx >= (secs[secIdx].cycles || 1)) { cycIdx = 0; secIdx = (secIdx + 1) % secs.length; } }
  }
  return { bars, CBEATS, spb };
}

const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
function corrOf(a, b) {
  let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0;
  const n = a.length;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; sab += a[i] * b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; }
  const cov = sab - sa * sb / n, va = saa - sa * sa / n, vb = sbb - sb * sb / n;
  if (va <= 0 && vb <= 0) return 1;   // both silent
  if (va <= 0 || vb <= 0) return 0;
  return cov / Math.sqrt(va * vb);
}
function maxDelta(a, b) { let m = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > m) m = d; } return m; }
function bytesEqual(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

async function runState(name, st) {
  const { bars, CBEATS, spb } = makeBars(st);
  const units0 = SE.voiceUnits(E, bars[0].one);
  const cls = SE.stemClass(units0);
  const cachedKeys = cls.cached;
  if (!cachedKeys.length) throw new Error(name + ": no cached units — pick another state");
  const layerOf = {}; for (const k of cachedKeys) layerOf[k] = LAYER_OF_UNIT(k);
  console.log(`\n== ${name}: bpm ${st.bpm}, CBEATS ${CBEATS}, cached [${cachedKeys.map(k => k.slice(0, 20) + ":" + (units0[k].module || "?")).join(", ")}]`);

  // BS-aligned absolute bar boundaries (live.js stem cursor math, mirrored)
  const S = []; for (let n = 0; n <= BARS; n++) S.push(Math.round(n * CBEATS * spb * SR / BS) * BS);
  const TOTAL = S[BARS];

  // ---- REFERENCE: the press path — render-core renderUnit, whole 4 bars ----
  // per-bar mapEvents (same windows live/worker use), events rebased to the
  // absolute beat line; one renderUnit call per cached unit into its layer's
  // reference buses.
  const perBarM = bars.map((b) => {
    const uT = SE.voiceUnits(E, b.one);
    return { b, uT, m: SE.mapEvents(E, b.one, E.buildEvents(b.one), { lo: b.lo, hi: b.hi, units: uT }) };
  });
  const refBuses = new Map();   // layer -> {dry,rev,del,pp,wL,wR}
  const refBusFor = (layer, stereo) => {
    let x = refBuses.get(layer);
    if (!x) { x = { dry: new Float32Array(TOTAL), rev: new Float32Array(TOTAL), del: new Float32Array(TOTAL), pp: new Float32Array(TOTAL), wL: null, wR: null }; refBuses.set(layer, x); }
    if (stereo && !x.wL) { x.wL = new Float32Array(TOTAL); x.wR = new Float32Array(TOTAL); }
    return x;
  };
  let floorFlips = 0;   // (a+b)*c vs a*c+b*c ulp-edge check (see stem-worker barStartSec)
  const t0ref = Date.now();
  for (const key of cachedKeys) {
    const u = units0[key];
    const evAbs = [];
    for (const { b, m } of perBarM)
      for (const e of m.events) if (e.unit === key) {
        const abs = b.serial * CBEATS + (e.beat - b.lo);
        evAbs.push({ ...e, beat: abs });
        const sRef = Math.floor(abs * spb * SR);
        const sStem = Math.floor(((b.serial * CBEATS) * spb + (e.beat - b.lo) * spb) * SR);
        if (sRef !== sStem) floorFlips++;
      }
    const x = refBusFor(layerOf[key], !!u.stereo);
    await RC.renderUnit(u, evAbs, { mkProc, rootOf, SR, BS, TOTAL, spb,
      buses: { dry: x.dry, rev: x.rev, del: x.del, pp: x.pp, wL: x.wL, wR: x.wR },
      speech: null, dx7Presets });
  }
  const refMs = Date.now() - t0ref;

  // ---- STEM SIDE: persistent renderer, 4 strictly sequential bars ----
  const R = SW.makeStemRenderer({ E, SE, mergeIvals: RC.mergeIvals, mkProc, rootOf, SR, BS, dx7Presets });
  const stemAcc = new Map();   // layer -> {dryL,dryR,rev,del,pp} accumulated full-length
  const accFor = (layer) => {
    let x = stemAcc.get(layer);
    if (!x) { x = { dryL: new Float32Array(TOTAL), dryR: null, rev: new Float32Array(TOTAL), del: new Float32Array(TOTAL), pp: new Float32Array(TOTAL) }; stemAcc.set(layer, x); }
    return x;
  };
  let stemMs = 0;
  // ONE-BAR PIPELINE (matches the worker/live contract): renderBar(msg N)
  // ingests N and ships the window HELD from N-1; the first call ships nothing
  // (rendered:false); flush() drains the final bar. Each shipped window carries
  // its own serial/startSample, so it lands at the right absolute offset.
  const ship = (out) => {
    if (!out || !out.rendered) return;
    if (out.failedModules.length) throw new Error(name + ": worker failed modules " + JSON.stringify(out.failedModules));
    for (const stx of out.stems) {
      const acc = accFor(stx.layer);
      if (stx.bus === "dry") {
        if (stx.channels.length === 2 && !acc.dryR) { acc.dryR = new Float32Array(TOTAL); acc.dryR.set(acc.dryL); }
        acc.dryL.set(stx.channels[0], out.startSample);
        if (acc.dryR) acc.dryR.set(stx.channels[1] || stx.channels[0], out.startSample);
      } else acc[stx.bus].set(stx.channels[0], out.startSample);
    }
  };
  for (const b of bars) {
    const msg = { serial: b.serial, oneState: b.one, unitKeys: cachedKeys, layerOf,
      lo: b.lo, hi: b.hi, spb, startSample: S[b.serial], lenSamples: S[b.serial + 1] - S[b.serial],
      barStartSec: b.serial * CBEATS * spb };
    const t0 = Date.now();
    ship(await R.renderBar(msg));
    stemMs += Date.now() - t0;
  }
  const t0f = Date.now();
  ship(await R.flush());
  stemMs += Date.now() - t0f;

  // ---- compare per layer x per bus ----
  const zero = new Float32Array(TOTAL);
  let pass = true, anyByteDiff = false;
  const rows = [];
  for (const [layer, ref] of refBuses) {
    const acc = stemAcc.get(layer) || { dryL: zero, dryR: null, rev: zero, del: zero, pp: zero };
    const refDryL = ref.wL ? (() => { const o = new Float32Array(TOTAL); for (let i = 0; i < TOTAL; i++) o[i] = ref.dry[i] + ref.wL[i]; return o; })() : ref.dry;
    const refDryR = ref.wR ? (() => { const o = new Float32Array(TOTAL); for (let i = 0; i < TOTAL; i++) o[i] = ref.dry[i] + ref.wR[i]; return o; })() : ref.dry;
    const pairs = [["dryL", refDryL, acc.dryL], ["rev", ref.rev, acc.rev], ["del", ref.del, acc.del], ["pp", ref.pp, acc.pp]];
    if (ref.wL || acc.dryR) pairs.splice(1, 0, ["dryR", refDryR, acc.dryR || acc.dryL]);
    for (const [bus, a, b2] of pairs) {
      const ra = rms(a);
      if (ra < 1e-6 && rms(b2) < 1e-6) continue;   // both silent: skip row
      const c = corrOf(a, b2), d = maxDelta(a, b2), eq = bytesEqual(a, b2);
      const ok = c > 0.999 && d < 1e-4;
      if (!ok) pass = false;
      if (!eq) anyByteDiff = true;
      rows.push(`  ${ok ? "PASS" : "FAIL"}  ${(layer + "/" + bus).padEnd(10)} rms ${ra.toFixed(5)}  corr ${c.toFixed(6)}  maxΔ ${d.toExponential(2)}  ${eq ? "BYTE-EQUAL" : "float-diff"}`);
    }
  }
  rows.forEach((r) => console.log(r));
  const audioSec = TOTAL / SR;
  console.log(`  floor-edge flips: ${floorFlips} (must be 0)`);
  if (floorFlips > 0) pass = false;
  console.log(`  throughput: stem ${(audioSec / (stemMs / 1000)).toFixed(1)}x realtime (${stemMs}ms for ${audioSec.toFixed(1)}s), press-ref ${(audioSec / (refMs / 1000)).toFixed(1)}x (${refMs}ms)`);
  return { pass, byteEqual: !anyByteDiff, stemMs, audioSec };
}

(async () => {
  // THE CASES ARE DISCOVERED, NOT SPELLED. This list used to name four states by
  // hand — citypop_s7 "dx7 pad", vaporwave_s7 "mono pad_saw", mallsoft_s42,
  // newage_s7 — chosen because they had worker-CACHED (non-sampler) units. The
  // sampled-by-default shift then moved those voices onto samplers, so the very
  // first case had no cached unit left and the gate died on `no cached units —
  // pick another state` rather than testing anything. Only 36 of 822 states carry
  // a cached unit at all now, across three (role:module) shapes, so a hand-picked
  // list is guaranteed to rot again.
  //
  // Scan instead, in a fixed order (kernel key order x a fixed seed list = fully
  // deterministic), and keep the FIRST state for each distinct cached
  // role:module — that is the thing under test: one stem per stem-class shape.
  function discoverCases(limit) {
    const seen = new Map();
    for (const g of Object.keys(K.GENRES)) {
      for (const seed of [1, 7, 42]) {
        let st, units, cls;
        try { st = K.track(g, { seed }); units = SE.voiceUnits(E, st); cls = SE.stemClass(units); } catch (e) { continue; }
        if (!cls.cached.length) continue;
        for (const k of cls.cached) {
          const shape = (k.indexOf("solo:") === 0 ? "solo" : k) + ":" + (units[k].module || "?");
          if (seen.has(shape)) continue;
          seen.set(shape, [`${g}_s${seed} (cached ${shape})`, st]);
          if (seen.size >= limit) return [...seen.values()];
        }
      }
    }
    return [...seen.values()];
  }
  const cases = discoverCases(4);
  if (!cases.length) { console.error("STEM PARITY: no state in the catalog has a worker-cached unit — nothing to compare"); process.exit(1); }
  console.log(`discovered ${cases.length} cached stem shape(s): ${cases.map((c) => c[0]).join(", ")}`);
  let all = true;
  const summary = [];
  for (const [name, st] of cases) {
    const r = await runState(name, st);
    all = all && r.pass;
    summary.push(`${name}: ${r.pass ? "PASS" : "FAIL"}${r.byteEqual ? " (byte-equal)" : ""} ${(r.audioSec / (r.stemMs / 1000)).toFixed(1)}x rt`);
  }
  console.log("\n" + summary.join("\n"));
  console.log(all ? "\nSTEM PARITY: ALL PASS" : "\nSTEM PARITY: FAILURES");
  process.exit(all ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
