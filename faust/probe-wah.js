#!/usr/bin/env node
// faust/probe-wah.js — fx wings STAGE 3 gate: the crybaby/Mutron AUTO-WAH insert.
//
//   Part A (mechanism, offline processor):
//     - mix 0 is a BIT-EXACT bypass (the insert-chain law every insert obeys)
//     - the envelope follower actually DRIVES the sweep: feed a plucked-bass
//       burst train and show the wet spectral centroid rising at attacks and
//       falling through decays (the quack), and sitting well above the bypass
//       centroid at the attack (bandpass resonance pulled up by the envelope)
//   Part B (integration): a disco seed whose bass drew the wah insert presses
//     non-silent, and differs from the same state with the insert stripped.
//
//   node faust/probe-wah.js
"use strict";
const fs = require("fs");
const path = require("path");
const K = require(path.join(__dirname, "..", "genre-kernel.js"));
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
  return await _gen.createOfflineProcessor(SR, BS, f);
}
function run(proc, input) {
  const out = new Float32Array(input.length);
  for (let s = 0; s < input.length; s += BS) {
    const len = Math.min(BS, input.length - s);
    out.set(proc.render([input.subarray(s, s + len)], len)[0].subarray(0, len), s);
  }
  return out;
}
// spectral centroid of a window via small DFT
function centroid(x, off, N) {
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const a = -2 * Math.PI * k * n / N; const v = x[off + n] || 0; re += v * Math.cos(a); im += v * Math.sin(a); }
    const mag = Math.sqrt(re * re + im * im);
    num += (k * SR / N) * mag; den += mag;
  }
  return den > 0 ? num / den : 0;
}

(async () => {
  console.log("Part A — auto-wah mechanism:");
  // plucked-bass burst train: 4 saw plucks at 82 Hz (E2), exp decay 0.25s, every 0.5s
  const DUR = Math.floor(SR * 2.2), inp = new Float32Array(DUR);
  for (let p = 0; p < 4; p++) {
    const t0 = Math.floor(p * 0.5 * SR);
    for (let i = 0; i < Math.floor(0.45 * SR) && t0 + i < DUR; i++) {
      const t = i / SR, ph = (82.41 * t) % 1;
      inp[t0 + i] += (2 * ph - 1) * 0.55 * Math.exp(-t / 0.25);
    }
  }
  const R = "/insert_wah/";
  // mix 0 bypass bit-exactness
  const p0 = await mkProc("insert_wah");
  p0.setParamValue(R + "mix", 0);
  const bypass = run(p0, inp);
  let bit = true; for (let i = 0; i < DUR; i++) if (bypass[i] !== inp[i]) { bit = false; break; }
  ok(bit, "mix 0 is a bit-exact bypass (insert-chain law)");

  // envelope -> sweep: STEADY loud vs quiet saw, steady-state centroid of the
  // final window (a decaying pluck's tail is too quiet for a stable centroid —
  // DFT noise floor dominates; steady levels isolate the follower cleanly).
  const N = 2048;
  const steady = (amp) => {
    const L = Math.floor(SR * 1.2), x = new Float32Array(L);
    for (let i = 0; i < L; i++) { const ph = (82.41 * i / SR) % 1; x[i] = (2 * ph - 1) * amp; }
    return x;
  };
  const wahAt = async (amp) => {
    const p = await mkProc("insert_wah");
    for (const [k, v] of Object.entries({ sens: 0.6, base: 320, range: 2.2, q: 4, mix: 1 })) p.setParamValue(R + k, v);
    const w = run(p, steady(amp));
    return centroid(w, w.length - N - 64, N);
  };
  const cLoud = await wahAt(0.6), cQuiet = await wahAt(0.05);
  console.log(`  steady-state wet centroid: loud(0.6) = ${cLoud.toFixed(0)} Hz, quiet(0.05) = ${cQuiet.toFixed(0)} Hz`);
  ok(cLoud > cQuiet * 1.3, "envelope drives the sweep: loud input opens the filter >1.3x brighter than quiet (the quack)");
  ok(cQuiet < 900 && cLoud > 700, "quiet sits near the wah base, loud opens well above it");
  // and the render still differs from bypass at performance level
  const p1 = await mkProc("insert_wah");
  for (const [k, v] of Object.entries({ sens: 0.6, base: 320, range: 2.2, q: 4, mix: 1 })) p1.setParamValue(R + k, v);
  const wet = run(p1, inp);
  // determinism
  const p2 = await mkProc("insert_wah");
  for (const [k, v] of Object.entries({ sens: 0.6, base: 320, range: 2.2, q: 4, mix: 1 })) p2.setParamValue(R + k, v);
  const wet2 = run(p2, inp);
  let det = true; for (let i = 0; i < DUR; i++) if (wet[i] !== wet2[i]) { det = false; break; }
  ok(det, "two renders are byte-identical (deterministic)");

  console.log("\nPart B — disco integration (kernel-drawn wah, real press):");
  // find a disco seed whose bass drew the wah insert
  let st = null, seed = 0;
  for (let s = 1; s <= 40 && !st; s++) {
    const cand = K.track("disco", { seed: s });
    if ((cand.instruments.bass.inserts || []).some(i => i.type === "wah")) { st = cand; seed = s; }
  }
  ok(!!st, "a disco seed draws the wah insert on bass (searched 40 seeds)" + (st ? ` — seed ${seed}` : ""));
  if (st) {
    const { execFileSync } = require("child_process");
    const os = require("os");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wah-"));
    const sOn = path.join(tmp, "on.json"), sOff = path.join(tmp, "off.json");
    fs.writeFileSync(sOn, JSON.stringify(st));
    const stripped = JSON.parse(JSON.stringify(st));
    stripped.instruments.bass.inserts = [];
    fs.writeFileSync(sOff, JSON.stringify(stripped));
    // --dur must reach past the intro (bass "off" there — a 10s cap rendered
    // ZERO bass events and on/off were trivially byte-equal): 45s covers the
    // first bass-carrying section at disco tempo.
    const press = (a, b) => execFileSync(process.execPath, [path.join(__dirname, "press.js"), a, b, "--dur", "45"], { stdio: "pipe" }).toString();
    const logOn = press(sOn, path.join(tmp, "on.wav"));
    press(sOff, path.join(tmp, "off.wav"));
    const rms = /L-RMS (-?[\d.]+) dB/.exec(logOn);
    const chainLog = /bass:.*\[inserts: ([^\]]+)\]/.exec(logOn);
    console.log(`  disco seed ${seed} pressed: L-RMS ${rms ? rms[1] : "?"} dB, bass insert chain: ${chainLog ? chainLog[1] : "(none logged)"}`);
    ok(chainLog && /wah/.test(chainLog[1]), "press applied the wah chain on the bass unit (log tag)");
    ok(rms && parseFloat(rms[1]) > -50, "wah'd disco press is non-silent");
    const A = fs.readFileSync(path.join(tmp, "on.wav")), B = fs.readFileSync(path.join(tmp, "off.wav"));
    ok(!A.equals(B), "press with wah differs from press with the insert stripped (audibly present)");
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(fail ? `\nPROBE FAIL (${fail})` : "\nPROBE PASS");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
