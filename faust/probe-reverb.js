#!/usr/bin/env node
// probe-reverb.js — stage-1 gate for the reverb COLOR family. Feeds a short
// burst into each reverb module (+ the fx_bus zita default) and measures decay
// time (RT-ish) and spectral centroid of the tail — they must be measurably
// DIFFERENT reverbs, not one reverb relabeled.
"use strict";
const path = require("path");
const fs = require("fs");
const SR = 44100, BS = 64;

let _gen = null;
async function mkProc(mod) {
  const code = fs.readFileSync(path.join(__dirname, "dist", `${mod}-module.wasm`));
  const json = fs.readFileSync(path.join(__dirname, "dist", `${mod}-meta.json`), "utf8");
  const factory = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code), json, poly: false };
  if (!_gen) {
    const { FaustMonoDspGenerator } = await import(path.join(__dirname, "node_modules/@grame/faustwasm/dist/esm/index.js"));
    _gen = new FaustMonoDspGenerator();
  }
  return { proc: await _gen.createOfflineProcessor(SR, BS, factory), root: JSON.parse(json).name, inputs: JSON.parse(json).inputs };
}

function centroid(x) {
  // crude spectral centroid via zero-crossing-weighted energy proxy: use a
  // simple DFT over a downsampled window.
  const N = 2048; const seg = x.subarray(0, Math.min(N, x.length));
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < seg.length; n++) { const a = -2 * Math.PI * k * n / N; re += seg[n] * Math.cos(a); im += seg[n] * Math.sin(a); }
    const mag = Math.sqrt(re * re + im * im), f = k * SR / N;
    num += f * mag; den += mag;
  }
  return den > 0 ? num / den : 0;
}

async function measure(mod, sendParams) {
  const { proc, root, inputs } = await mkProc(mod);
  const R = "/" + root + "/";
  for (const [k, v] of Object.entries(sendParams || {})) { try { proc.setParamValue(R + k, v); } catch (e) {} }
  const DUR = Math.floor(SR * 3.0);
  const burst = Math.floor(SR * 0.05);
  const out = new Float32Array(DUR);
  for (let s = 0; s < DUR; s += BS) {
    const len = Math.min(BS, DUR - s);
    const ins = [];
    for (let c = 0; c < inputs; c++) {
      const a = new Float32Array(len);
      for (let i = 0; i < len; i++) { const g = s + i; a[i] = g < burst ? (Math.random() * 2 - 1) * 0.5 : 0; }
      ins.push(a);
    }
    const o = proc.render(ins, len);
    out.set(o[0].subarray(0, len), s);
  }
  // RT: time for tail RMS (in 50ms windows, after the burst) to fall 40 dB from peak
  const win = Math.floor(SR * 0.05), nWin = Math.floor(DUR / win);
  const rms = new Float32Array(nWin);
  let peak = 0;
  for (let w = 0; w < nWin; w++) { let s = 0; for (let i = w * win; i < (w + 1) * win; i++) s += out[i] * out[i]; rms[w] = Math.sqrt(s / win); if (w > 1 && rms[w] > peak) peak = rms[w]; }
  const thr = peak * Math.pow(10, -40 / 20);
  let rt = 0;
  for (let w = 2; w < nWin; w++) if (rms[w] <= thr) { rt = w * 0.05; break; }
  if (!rt) rt = DUR / SR;
  // tail centroid: 0.5s window starting 0.3s after burst
  const tailStart = Math.floor(SR * 0.35);
  const cen = centroid(out.subarray(tailStart, tailStart + 2048));
  let energy = 0; for (let i = burst; i < DUR; i++) energy += out[i] * out[i];
  return { mod, rt40: rt, centroid: Math.round(cen), tailEnergy: (energy / DUR).toExponential(2), peak: peak.toExponential(2) };
}

(async () => {
  const mods = [
    ["reverb_dattorro", { rgain: 1, rtone: 5200 }],
    ["reverb_greyhole", { rgain: 1, rtone: 2600 }],
    ["reverb_fdn", { rgain: 1, rtone: 6000 }],
    ["reverb_spring", { rgain: 1, rtone: 3400 }],
  ];
  console.log("reverb COLOR probe — 50ms noise burst, 3s tail:");
  const rows = [];
  for (const [m, p] of mods) rows.push(await measure(m, p));
  for (const r of rows) console.log(`  ${r.mod.padEnd(18)} RT40=${r.rt40.toFixed(2)}s  centroid=${String(r.centroid).padStart(5)}Hz  tailE=${r.tailEnergy}  peak=${r.peak}`);
  // gate: all non-silent, and RT/centroid spread across the family
  const nonsilent = rows.every(r => +r.peak > 1e-5);
  const rts = rows.map(r => r.rt40), cens = rows.map(r => r.centroid);
  const rtSpread = Math.max(...rts) - Math.min(...rts), cenSpread = Math.max(...cens) - Math.min(...cens);
  console.log(`  spread: RT40 ${rtSpread.toFixed(2)}s, centroid ${cenSpread}Hz`);
  const ok = nonsilent && (rtSpread > 0.3 || cenSpread > 500);
  console.log(ok ? "PASS: reverbs non-silent and measurably distinct" : "FAIL");
  process.exit(ok ? 0 : 1);
})();
