#!/usr/bin/env node
// faust/probe-lfo-sync.js — SYNTHESIS-DEPTH Part C gate: TEMPO-SYNCED LFOs.
//
// The engine resolves musical divisions to Hz (house unit = BARS, like
// timeBars/rateBars): `rateBars` on the Hz-rate LFO inserts (tremolo/chorus/
// phaser/flanger) and `wobbleBars` on the wobble bass. filtersweep keeps its
// in-module barSec sync (already first-class). This probe proves:
//   - the math: rateBars 0.125 (an 1/8-note) at 140 bpm -> exactly
//     1/(0.125 * 4 * 60/140) = 4.667 Hz, on both the insert and the bass
//   - the sound: a wobble bass declared at 1/8 sync shows CUTOFF MODULATION
//     spectrally at exactly the bpm-derived Hz (brightness-series DFT), and a
//     synced tremolo shows AM at the same Hz (envelope-series DFT)
//   - the absent-law: no rateBars/wobbleBars => the Hz path, byte-identical
//     resolved params
//
//   node test/probe-lfo-sync.js
"use strict";
const fs = require("fs");
const path = require("path");
const SE = require(path.join(__dirname, "..", "engine", "faust", "state-engine.js"));
const SR = 44100, BS = 64;
let fail = 0;
const ok = (c, msg) => { console.log((c ? "  ok  " : "  FAIL") + " " + msg); if (!c) fail++; };

let _gen = null;
async function mkProc(mod) {
  const code = fs.readFileSync(path.join(__dirname, "..", "engine", "faust", "dist", `${mod}-module.wasm`));
  const json = fs.readFileSync(path.join(__dirname, "..", "engine", "faust", "dist", `${mod}-meta.json`), "utf8");
  const f = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code), json, poly: false };
  if (!_gen) {
    const { FaustMonoDspGenerator } = await import(path.join(__dirname, "..", "engine", "faust", "node_modules/@grame/faustwasm/dist/esm/index.js"));
    _gen = new FaustMonoDspGenerator();
  }
  return await _gen.createOfflineProcessor(SR, BS, f);
}
// dominant frequency of a measurement series (mean-removed DFT peak), hop-rate hz
function domFreq(series, hopHz, fLo, fHi) {
  const N = series.length, mean = series.reduce((a, b) => a + b, 0) / N;
  let best = 0, bestF = 0;
  for (let f = fLo; f <= fHi; f += 0.02) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const a = -2 * Math.PI * f * n / hopHz; const v = series[n] - mean; re += v * Math.cos(a); im += v * Math.sin(a); }
    const m = re * re + im * im;
    if (m > best) { best = m; bestF = f; }
  }
  return bestF;
}
function bright(x, a, n) {
  let sd = 0, s = 0;
  for (let i = a + 1; i < a + n; i++) { const d = x[i] - x[i - 1]; sd += d * d; s += x[i] * x[i]; }
  return s > 0 ? Math.sqrt(sd / s) : 0;
}
const rms = (x, a, n) => { let s = 0; for (let i = a; i < a + n; i++) s += x[i] * x[i]; return Math.sqrt(s / n); };

(async () => {
  const BPM = 140, expectHz = 1 / (0.125 * 4 * (60 / BPM));   // 1/8-note LFO at 140 -> 4.667 Hz
  console.log(`Part A — the division math (1/8 note at ${BPM} bpm = ${expectHz.toFixed(3)} Hz):`);
  const ch = SE.insertChain({ inserts: [{ type: "tremolo", rateBars: 0.125 }] }, 800, null, { bpm: BPM });
  ok(Math.abs(ch[0].params.rate - expectHz) < 1e-9, `tremolo rateBars 0.125 resolves to ${ch[0].params.rate.toFixed(3)} Hz`);
  const chHz = SE.insertChain({ inserts: [{ type: "tremolo", rate: 5 }] }, 800, null, { bpm: BPM });
  ok(chHz[0].params.rate === 5, "absent rateBars keeps the free-running Hz path (byte-identical params)");
  const uw = SE.pitchedUnit("bass", { model: "wobble", cutoff: 600, res: 0.3, wobbleBars: 0.125, inserts: [] }, { seed: 1, bpm: BPM });
  ok(Math.abs(uw.params.wobbleHz - expectHz) < 1e-9, `wobble bass wobbleBars 0.125 resolves to ${uw.params.wobbleHz.toFixed(3)} Hz`);
  const uw0 = SE.pitchedUnit("bass", { model: "wobble", cutoff: 600, res: 0.3, inserts: [] }, { seed: 1, bpm: BPM });
  ok(uw0.params.wobbleHz === 2.4, "absent wobbleBars keeps the free-running default (2.4 Hz)");
  // chorus/phaser/flanger ride the same rateOf
  for (const t of ["chorus", "phaser", "flanger"]) {
    const c = SE.insertChain({ inserts: [{ type: t, rateBars: 2 }] }, 800, null, { bpm: BPM });
    const want = 1 / (2 * 4 * (60 / BPM));
    ok(Math.abs(c[0].params.rate - want) < 1e-9, `${t} rateBars 2 (two-bar sweep) resolves to ${c[0].params.rate.toFixed(4)} Hz`);
  }

  console.log("\nPart B — the wobble bass MOVES at the declared division:");
  // bass_wobble at the resolved Hz, gate held 3 s; brightness series (10 ms hop)
  const pw = await mkProc("bass_wobble");
  for (const [k, v] of Object.entries({ freq: 55, cutoff: 600, res: 0.3, wobbleHz: uw.params.wobbleHz })) pw.setParamValue("/bass_wobble/" + k, v);
  pw.setParamValue("/bass_wobble/gate", 1);
  const L = SR * 3, wob = new Float32Array(L);
  for (let s = 0; s < L; s += BS) wob.set(pw.render([], BS)[0].subarray(0, Math.min(BS, L - s)), s);
  const hop = Math.floor(SR * 0.01), hopHz = SR / hop, win = 1024;
  const bseries = [];
  for (let a = SR; a + win < L; a += hop) bseries.push(bright(wob, a, win));   // skip the 1s settle
  const fWob = domFreq(bseries, hopHz, 1, 12);
  console.log(`  brightness-series dominant frequency: ${fWob.toFixed(2)} Hz (declared ${expectHz.toFixed(3)})`);
  ok(Math.abs(fWob - expectHz) < expectHz * 0.05, "spectral modulation at exactly the bpm/8-derived Hz (+/-5%)");

  console.log("\nPart C — a synced tremolo pulses at the division (sampled-lane class):");
  const N2 = SR * 3, saw = new Float32Array(N2);
  for (let i = 0; i < N2; i++) saw[i] = (2 * ((110 * i / SR) % 1) - 1) * 0.3;
  const pt = await mkProc("insert_tremolo");
  for (const [k, v] of Object.entries(ch[0].params)) pt.setParamValue("/insert_tremolo/" + k, v);
  const trem = new Float32Array(N2);
  for (let s = 0; s < N2; s += BS) trem.set(pt.render([saw.subarray(s, s + BS)], BS)[0].subarray(0, Math.min(BS, N2 - s)), s);
  const eseries = [];
  for (let a = SR; a + win < N2; a += hop) eseries.push(rms(trem, a, win));
  const fTrem = domFreq(eseries, hopHz, 1, 12);
  console.log(`  AM-envelope dominant frequency: ${fTrem.toFixed(2)} Hz (declared ${expectHz.toFixed(3)})`);
  ok(Math.abs(fTrem - expectHz) < expectHz * 0.05, "amplitude modulation at exactly the declared division (+/-5%)");

  console.log(fail ? `\nPROBE FAIL (${fail})` : "\nPROBE PASS");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
