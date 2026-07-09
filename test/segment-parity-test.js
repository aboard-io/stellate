#!/usr/bin/env node
// faust/segment-parity-test.js — the Phase 1-2 gate for faust/stream-renderer.js.
//
//   NODE_PATH=faust/node_modules node faust/segment-parity-test.js [--dur N] [--full]
//
// Drives makeStreamEngine over a whole song (or the first --dur seconds) in
// consecutive chord-bar CHUNKS through its persistent, stateful offline procs,
// concatenates the chunks into full stereo L/R, and compares to the PRESS
// REFERENCE — faust/press.js assemble() (the same whole-song full-mix assembly,
// extracted so this test drives the actual gold standard, not a replica). Both
// sides consume the identical SE.buildSchedule events, so the ONLY thing under
// test is whether the WINDOWED, state-carrying render reproduces the whole-song
// render: fx_bus / reverb-color / master_mb continuity across chunk seams, the
// mcut sweep automation, mono-legato voices baked across bars (R1), and the
// found/sampler PCM layer.
//
// GATE (mirrors faust/stem-parity-test.js): per channel, RMS correlation > 0.999
// AND max |sample delta| < 1e-4; float32 byte-equality reported when achieved
// (expected byte-equal for the non-legato states — ingest-all-up-front removes
// stem-worker's one-block anticipation divergence). Exits nonzero on any FAIL.
//
// COVERAGE: the 3 engine.test states (default_song / jungle_s2 / spokenword_s3)
// + acidhouse_s7 (tb303 MONO-LEGATO/acid — R1) + darksynth_s7 (synclead mono) +
// house_s7 (stereo juno60 + reverb_dattorro color + master_mb — the full fx chain).
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const E = require(path.join(ROOT, "engine", "csd-engine.js"));
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));
const SE = require(path.join(__dirname, "..", "engine", "faust", "state-engine.js"));
const RC = require(path.join(__dirname, "..", "engine", "faust", "render-core.js"));
const FP = require(path.join(__dirname, "..", "engine", "faust", "found-player.js"));
const SP = require(path.join(__dirname, "..", "engine", "faust", "sampler.js"));
const PRESS = require(path.join(__dirname, "..", "engine", "faust", "press.js"));
const SR_JS = require(path.join(__dirname, "..", "engine", "faust", "stream-renderer.js"));

const SR = PRESS.SR, BS = PRESS.BS;
const args = process.argv.slice(2);
const durIx = args.indexOf("--dur");
const FULL = args.includes("--full");
const DUR = FULL ? 0 : (durIx >= 0 ? parseFloat(args[durIx + 1]) : 40);   // seconds pressed per state (0 = whole song)

// ---- reuse press.js's node harness verbatim (factory cache, dx7 presets) ----
const mkProc = PRESS.mkProc, rootOf = PRESS.rootOf;
const dx7Presets = PRESS.loadDx7Presets();

// ---- comparison helpers (faust/stem-parity-test.js) ----
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
function corrOf(a, b) {
  let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0; const n = a.length;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; sab += a[i] * b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; }
  const cov = sab - sa * sb / n, va = saa - sa * sa / n, vb = sbb - sb * sb / n;
  if (va <= 0 && vb <= 0) return 1;
  if (va <= 0 || vb <= 0) return 0;
  return cov / Math.sqrt(va * vb);
}
const maxDelta = (a, b) => { let m = 0, at = -1; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > m) { m = d; at = i; } } return { m, at }; };
const bytesEqual = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

// engine.test.js's state prep (strip render-time extras, resolve found paths)
function prep(name, state) {
  state.foundSources = (state.foundSources || []).filter((s) => s.id !== "tw_vocal");
  (state.sections || []).forEach((s) => { if (s.vocal) delete s.vocal; });
  for (const s of state.foundSources) {
    s.fsPath = s.fsPath || (s.samplePath ? path.join(ROOT, s.samplePath) : path.join(ROOT, "found", s.id + ".mp3"));
    if (!fs.existsSync(s.fsPath)) {
      console.error(`missing ${s.fsPath} — run ./fetch-found-sound.sh / ./fetch-found-samples.sh`);
      process.exit(2);
    }
  }
  return state;
}

async function runState(name, state) {
  const sched = SE.buildSchedule(E, state);
  const spb = sched.spb;
  let totalSec = sched.totalBeats * spb;
  if (DUR) totalSec = Math.min(totalSec, DUR);
  const TOTAL = Math.ceil(totalSec * SR);

  // decode the found/sampler/speech PCM once (node ffmpeg), shared by both sides
  const { buffers, speech } = await PRESS.decodeInputs(state, sched, { TOTAL });

  console.log(`\n== ${name}: bpm ${state.bpm}, ${sched.totalBeats} beats, cap ${totalSec.toFixed(1)}s (${TOTAL} samp)` +
    `, ${sched.events.length} ev / ${sched.found.length} found / ${sched.sweeps.length} sweep` +
    (SE.reverbColor(state) ? `, color ${SE.reverbColor(state).module}` : "") +
    (SE.masterMb(state) ? `, master_mb` : ""));

  // ---- REFERENCE: press.js assemble() — the whole-song full-mix gold standard ----
  const t0r = Date.now();
  const ref = await PRESS.assemble(state, sched,
    { mkProc, rootOf, buffers, speech, dx7Presets }, { spb, totalSec, TOTAL });
  const refMs = Date.now() - t0r;

  // ---- STREAM: makeStreamEngine, consecutive chunks, concatenated ----
  const eng = SR_JS.makeStreamEngine({ E, SE, FP, SP, mergeIvals: RC.mergeIvals, mkProc, rootOf, SR, BS, dx7Presets });
  const t0s = Date.now();
  const info = await eng.open(state, { buffers, speech, opts: { dur: DUR || undefined } });
  if (info.TOTAL !== TOTAL) throw new Error(`${name}: stream TOTAL ${info.TOTAL} != ref TOTAL ${TOTAL}`);
  const L = new Float32Array(TOTAL), R = new Float32Array(TOTAL);
  for (let n = 0; n < info.nChunks; n++) {
    const c = eng.renderChunk(n);
    L.set(c.L, c.startSample); R.set(c.R, c.startSample);
  }
  eng.close();
  const streamMs = Date.now() - t0s;

  // ---- compare per channel ----
  let pass = true, anyByteDiff = false;
  for (const [ch, a, b] of [["L", ref.L, L], ["R", ref.Rr, R]]) {
    const ra = rms(a);
    const c = corrOf(a, b), d = maxDelta(a, b), eq = bytesEqual(a, b);
    const ok = c > 0.999 && d.m < 1e-4;
    if (!ok) pass = false;
    if (!eq) anyByteDiff = true;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${ch}  rms ${ra.toFixed(5)}  corr ${c.toFixed(6)}  ` +
      `maxΔ ${d.m.toExponential(2)}${d.at >= 0 ? "@" + d.at : ""}  ${eq ? "BYTE-EQUAL" : "float-diff"}`);
  }
  const audioSec = TOTAL / SR;
  console.log(`  chunks: ${info.nChunks}, CBEATS ${info.CBEATS}` +
    `; throughput stream ${(audioSec / (streamMs / 1000)).toFixed(1)}x rt (${streamMs}ms), press-ref ${(audioSec / (refMs / 1000)).toFixed(1)}x (${refMs}ms)`);
  return { pass, byteEqual: !anyByteDiff };
}

(async () => {
  const cases = [
    ["default_song", (() => { const s = E.defaultState(); s.foundSources.forEach((f) => { f.fsPath = path.join(ROOT, "found", "tokyo_station.wav"); }); return s; })()],
    ["jungle_s2 (sampler trombone)", K.track("jungle", { seed: 2 })],
    ["spokenword_s3 (bed + felt_piano/sax samplers)", K.track("spokenword", { seed: 3 })],
    ["acidhouse_s7 (tb303 MONO-LEGATO/acid — R1)", K.track("acidhouse", { seed: 7 })],
    ["darksynth_s7 (synclead mono)", K.track("darksynth", { seed: 7 })],
    ["house_s7 (stereo juno60 + reverb color + master_mb)", K.track("house", { seed: 7 })],
    ["jazz_s3 (SAMPLED brush drum kit — native one-shots)", K.track("jazz", { seed: 3 })],
  ];
  let all = true; const summary = [];
  for (const [name, stRaw] of cases) {
    const state = prep(name, stRaw);
    let r;
    try { r = await runState(name, state); }
    catch (e) { console.log(`  FAIL  ${name}: ${e && e.message || e}`); r = { pass: false, byteEqual: false }; }
    all = all && r.pass;
    summary.push(`${r.pass ? "PASS" : "FAIL"}  ${name}${r.byteEqual ? " (byte-equal)" : r.pass ? " (near-bit)" : ""}`);
  }
  console.log("\n" + summary.join("\n"));
  console.log(all ? "\nSEGMENT PARITY: ALL PASS" : "\nSEGMENT PARITY: FAILURES");
  process.exit(all ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
