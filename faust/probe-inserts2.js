#!/usr/bin/env node
// faust/probe-inserts2.js — mechanism gate for the 2026-07 expanded per-voice
// effects: the new INSERT modules (leslie/flanger/delay/ringmod/granular) and
// the new reverb COLOR (reverb_shimmer). For every insert:
//   - mix 0 is a BIT-EXACT bypass (the insert-chain law every insert obeys)
//   - at mix>0 the render is NON-SILENT and DIFFERS from the dry input
//   - a signature param actually MOVES the sound (render changes when it changes)
//   - two identical renders are byte-identical (deterministic)
// For reverb_shimmer: 2-in/2-out, non-silent decaying tail, finite, and an
// octave-up shimmer partial appears in the tail (vs a plain octave-free burst).
//
//   node faust/probe-inserts2.js
"use strict";
const fs = require("fs");
const path = require("path");
const SR = 44100, BS = 64;
let fail = 0;
const ok = (c, msg) => { console.log((c ? "  ok  " : "  FAIL") + " " + msg); if (!c) fail++; };

let _gen = null;
async function mkProc(mod) {
  const code = fs.readFileSync(path.join(__dirname, "dist", `${mod}-module.wasm`));
  const json = fs.readFileSync(path.join(__dirname, "dist", `${mod}-meta.json`), "utf8");
  const f = { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code), json, poly: false };
  if (!_gen) {
    const { FaustMonoDspGenerator } = await import(path.join(__dirname, "node_modules/@grame/faustwasm/dist/esm/index.js"));
    _gen = new FaustMonoDspGenerator();
  }
  return { proc: await _gen.createOfflineProcessor(SR, BS, f), root: JSON.parse(json).name, inputs: JSON.parse(json).inputs, outputs: JSON.parse(json).outputs };
}
function run(proc, ins, N) {
  const nout = ins.outputs || 1;
  const outs = Array.from({ length: nout }, () => new Float32Array(N));
  for (let s = 0; s < N; s += BS) {
    const len = Math.min(BS, N - s);
    const chunk = ins.chans.map(c => c.subarray(s, s + len));
    const o = proc.render(chunk, len);
    for (let ch = 0; ch < nout; ch++) outs[ch].set((o[ch] || o[0]).subarray(0, len), s);
  }
  return outs;
}
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
const allFinite = (a) => { for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) return false; return true; };
const bitEqual = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

// a rich, bounded test voice: sawish tone (110 Hz) with an amplitude burst
// envelope so envelope-followers / stutter gates have something to bite.
function testVoice(N) {
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR, ph = (110 * t) % 1;
    const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.5 * t);
    x[i] = (2 * ph - 1) * 0.5 * env;
  }
  return x;
}

// generic insert probe: {module, params, senseParam, senseVal}
async function probeInsert(spec) {
  const N = Math.floor(SR * 1.5), inp = testVoice(N);
  const R = "/" + spec.module + "/";
  console.log(`\n${spec.module}:`);

  // mix 0 bit-exact bypass
  const p0 = await mkProc(spec.module);
  for (const [k, v] of Object.entries({ ...spec.params, mix: 0, barSec: 2 })) { try { p0.proc.setParamValue(R + k, v); } catch (e) {} }
  const bypass = run(p0.proc, { chans: [inp], outputs: 1 }, N)[0];
  ok(bitEqual(bypass, inp), "mix 0 is a bit-exact bypass (insert law)");

  // wet render: non-silent, finite, differs from dry
  const p1 = await mkProc(spec.module);
  for (const [k, v] of Object.entries({ ...spec.params, barSec: 2 })) { try { p1.proc.setParamValue(R + k, v); } catch (e) {} }
  const wet = run(p1.proc, { chans: [inp], outputs: 1 }, N)[0];
  ok(allFinite(wet), "output is finite (no NaN/Inf)");
  ok(rms(wet) > 1e-4, `wet is non-silent (rms ${rms(wet).toExponential(2)})`);
  ok(!bitEqual(wet, inp), "wet differs from the dry input (effect is audible)");

  // determinism
  const p1b = await mkProc(spec.module);
  for (const [k, v] of Object.entries({ ...spec.params, barSec: 2 })) { try { p1b.proc.setParamValue(R + k, v); } catch (e) {} }
  const wet2 = run(p1b.proc, { chans: [inp], outputs: 1 }, N)[0];
  ok(bitEqual(wet, wet2), "two renders are byte-identical (deterministic)");

  // param sensitivity
  const p2 = await mkProc(spec.module);
  for (const [k, v] of Object.entries({ ...spec.params, barSec: 2, [spec.senseParam]: spec.senseVal })) { try { p2.proc.setParamValue(R + k, v); } catch (e) {} }
  const wet3 = run(p2.proc, { chans: [inp], outputs: 1 }, N)[0];
  ok(!bitEqual(wet3, wet), `${spec.senseParam} moves the sound (${spec.params[spec.senseParam]} -> ${spec.senseVal})`);
}

async function probeShimmer() {
  console.log("\nreverb_shimmer (reverb COLOR, 2-in/2-out):");
  const { proc, root, inputs, outputs } = await mkProc("reverb_shimmer");
  ok(inputs === 2 && outputs === 2, `2-in/2-out uniform reverb-color interface (got ${inputs}/${outputs})`);
  const R = "/" + root + "/";
  proc.setParamValue(R + "rgain", 1.5);
  proc.setParamValue(R + "rtone", 6000);
  // a 50 ms tonal burst at 220 Hz into both inputs, then 3 s of tail
  const N = Math.floor(SR * 3.0), burst = Math.floor(SR * 0.05);
  const inb = new Float32Array(N);
  for (let i = 0; i < burst; i++) inb[i] = Math.sin(2 * Math.PI * 220 * i / SR) * 0.5;
  const outs = run(proc, { chans: [inb, inb], outputs: 2 }, N);
  ok(allFinite(outs[0]) && allFinite(outs[1]), "tail is finite (shimmer feedback does not blow up)");
  const win = (a, s, e) => { let x = 0; for (let i = s; i < e; i++) x += a[i] * a[i]; return Math.sqrt(x / (e - s)); };
  const early = win(outs[0], burst, burst + SR * 0.2);
  const late = win(outs[0], Math.floor(SR * 2.0), Math.floor(SR * 2.5));
  ok(early > 1e-4, `reverb tail is non-silent (early rms ${early.toExponential(2)})`);
  ok(late < early, `tail decays over 2 s (early ${early.toExponential(2)} -> late ${late.toExponential(2)})`);
  ok(late > 1e-6, "tail still ringing at 2 s (a long ambient wash, not a slap)");
  // octave-up shimmer: energy at ~440 Hz (octave of the 220 burst) in the tail.
  // Goertzel at 440 and 220 over a 0.5 s window ~1 s in — the octave-up feedback
  // should have grown the 440 partial relative to the raw burst spectrum.
  function goertzel(a, s0, len, f) {
    const w = 2 * Math.PI * f / SR, cw = Math.cos(w), coeff = 2 * cw;
    let s1 = 0, s2 = 0;
    for (let i = 0; i < len; i++) { const s = a[s0 + i] + coeff * s1 - s2; s2 = s1; s1 = s; }
    return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
  }
  const t1 = Math.floor(SR * 1.0), len = Math.floor(SR * 0.5);
  const e220 = goertzel(outs[0], t1, len, 220), e440 = goertzel(outs[0], t1, len, 440);
  console.log(`  tail partials @1s: 220Hz ${e220.toExponential(2)}, 440Hz(octave-up) ${e440.toExponential(2)}`);
  ok(e440 > e220 * 0.15, "an octave-up (440 Hz) shimmer partial is present in the tail");
}

(async () => {
  console.log("expanded per-voice FX — mechanism gate:");
  await probeInsert({ module: "insert_leslie", params: { speed: 0.9, depth: 0.85, mix: 0.7 }, senseParam: "speed", senseVal: 0.1 });
  await probeInsert({ module: "insert_flanger", params: { rate: 0.4, depth: 0.8, feedback: 0.6, mix: 0.6 }, senseParam: "feedback", senseVal: -0.6 });
  await probeInsert({ module: "insert_delay", params: { timeBars: 0.1875, feedback: 0.4, tone: 3000, wow: 0.3, mix: 0.4 }, senseParam: "timeBars", senseVal: 0.375 });
  await probeInsert({ module: "insert_ringmod", params: { freq: 220, mix: 0.5 }, senseParam: "freq", senseVal: 900 });
  await probeInsert({ module: "insert_granular", params: { pitch: 0, density: 0.6, rate: 12, mix: 0.6 }, senseParam: "pitch", senseVal: 7 });
  await probeShimmer();
  console.log(fail ? `\nPROBE FAIL (${fail})` : "\nPROBE PASS");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
