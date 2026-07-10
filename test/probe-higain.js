#!/usr/bin/env node
// faust/probe-higain.js — SYNTHESIS-DEPTH Part A gate: the STAGED heavy amp
// insert (insert_higain: tightness gate -> 3 cascaded waveshaper stages ->
// 3-band tone stack -> 4x12 cab sim -> level comp + DC block).
//
//   Part A (mechanism, offline processor):
//     - mix 0 is a BIT-EXACT bypass (the insert-chain law)
//     - the GATE actually gates: a -55 dB inter-chug hiss floor drops >=15 dB
//       further at gate 0.6 vs gate 0, while note bodies stay untouched
//     - level compensation: out RMS within a +/-6 dB window of dry across the
//       drive x stages grid; no clipping (peak < 1)
//     - harmonic content vs insert_distort on a 110 Hz sine: hotter odd
//       series (H3), darker top (the cab kills fizz — HF fraction below
//       distort's), and near-zero even harmonics (symmetric transfers)
//     - no NaN, no DC (mean ~ 0 — the fi.dcblocker law), deterministic
//   Part B (integration): a heavymetal state with higain declared on melody +
//     bass presses non-silent, logs the chain on the SAMPLED lane, and
//     differs from the same state with the insert stripped.
//
//   node test/probe-higain.js
"use strict";
const fs = require("fs");
const path = require("path");
const K = require(path.join(__dirname, "..", "engine", "genre-kernel.js"));
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
function run(proc, input) {
  const out = new Float32Array(input.length);
  for (let s = 0; s < input.length; s += BS) {
    const len = Math.min(BS, input.length - s);
    out.set(proc.render([input.subarray(s, s + len)], len)[0].subarray(0, len), s);
  }
  return out;
}
const rms = (x, a, b) => { let s = 0; a = a || 0; b = b || x.length; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
const db = (v) => 20 * Math.log10(Math.max(v, 1e-12));
const peak = (x) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p; };
const mean = (x) => { let s = 0; for (const v of x) s += v; return s / x.length; };

// deterministic palm-mute chug stem: drop-D saw bursts (73.4 Hz + octave),
// decay tau 35 ms, every 250 ms, over a ~-55 dB seeded hiss floor
function chug(dur) {
  const N = Math.floor(SR * dur), x = new Float32Array(N);
  let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0, seed / 4294967296 - 0.5);
  for (let i = 0; i < N; i++) x[i] = rnd() * 0.006;
  for (let p = 0; p * 0.25 * SR < N; p++) {
    const t0 = Math.floor(p * 0.25 * SR);
    for (let i = 0; i < Math.floor(0.1 * SR) && t0 + i < N; i++) {
      const t = i / SR, e = Math.exp(-t / 0.035);
      x[t0 + i] += ((2 * ((73.42 * t) % 1) - 1) * 0.8 + (2 * ((146.83 * t) % 1) - 1) * 0.3) * 0.22 * e;
    }
  }
  return x;
}
// harmonic magnitudes at f0*h over [a,b)
function harm(x, f0, nH, a, b) {
  const out = [];
  for (let h = 1; h <= nH; h++) {
    let re = 0, im = 0;
    for (let i = a; i < b; i++) { const ph = 2 * Math.PI * f0 * h * i / SR; re += x[i] * Math.cos(ph); im += x[i] * Math.sin(ph); }
    out.push(Math.sqrt(re * re + im * im) / (b - a));
  }
  return out;
}
// fraction of spectral energy above `hz` (rectangular DFT over 4096)
function hfFrac(x, off, hz) {
  const N = 4096; let hi = 0, tot = 0;
  for (let k = 1; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const a = -2 * Math.PI * k * n / N; const v = x[off + n] || 0; re += v * Math.cos(a); im += v * Math.sin(a); }
    const e = re * re + im * im; tot += e; if (k * SR / N > hz) hi += e;
  }
  return tot > 0 ? hi / tot : 0;
}

(async () => {
  console.log("Part A — staged-amp mechanism:");
  const stem = chug(2.0);
  const R = "/insert_higain/";
  const P = async (params, input) => {
    const p = await mkProc("insert_higain");
    for (const [k, v] of Object.entries(params)) p.setParamValue(R + k, v);
    return run(p, input || stem);
  };

  // mix 0 bit-exact bypass
  const b0 = await P({ mix: 0, drive: 0.9, gate: 0.8 });
  let bit = true; for (let i = 0; i < stem.length; i++) if (b0[i] !== stem[i]) { bit = false; break; }
  ok(bit, "mix 0 is a bit-exact bypass (insert-chain law)");

  // level comp + no clip across the grid
  const dryDb = db(rms(stem));
  let compOk = true, clipOk = true, nanOk = true, dcOk = true;
  for (const drive of [0.3, 0.65, 0.9]) for (const stages of [1, 2, 3]) {
    const o = await P({ drive, stages, gate: 0.35 });
    const d = db(rms(o)) - dryDb;
    if (Math.abs(d) > 6) { compOk = false; console.log(`    (comp miss: drive ${drive} stages ${stages} -> ${d.toFixed(1)} dB)`); }
    if (peak(o) >= 1) clipOk = false;
    if (!o.every(Number.isFinite)) nanOk = false;
    if (Math.abs(mean(o)) > 1e-3) dcOk = false;
  }
  ok(compOk, "level compensation: out RMS within +/-6 dB of dry across drive x stages");
  ok(clipOk, "no clipping at declared levels (peak < 1 across the grid)");
  ok(nanOk, "no NaN anywhere on the grid");
  ok(dcOk, "no DC offset (|mean| < 1e-3 — the dcblocker law)");

  // the gate gates: inter-note floor (0.40-0.48 s window) vs note body
  const g0 = await P({ drive: 0.65, stages: 2, gate: 0 });
  const g6 = await P({ drive: 0.65, stages: 2, gate: 0.6 });
  const fa = Math.floor(0.40 * SR), fb = Math.floor(0.48 * SR);
  const na = Math.floor(0.253 * SR), nb = Math.floor(0.30 * SR);
  const floor0 = db(rms(g0, fa, fb)), floor6 = db(rms(g6, fa, fb));
  console.log(`  inter-note floor: gate 0 = ${floor0.toFixed(1)} dB, gate 0.6 = ${floor6.toFixed(1)} dB; body ${db(rms(g0, na, nb)).toFixed(1)} / ${db(rms(g6, na, nb)).toFixed(1)} dB`);
  ok(floor6 < floor0 - 15, "tightness gate drops the inter-note floor >= 15 dB at gate 0.6");
  ok(Math.abs(db(rms(g6, na, nb)) - db(rms(g0, na, nb))) < 1, "note bodies pass the gate untouched (< 1 dB)");

  // harmonic A/B vs insert_distort on a -14 dB 110 Hz sine
  const N2 = Math.floor(SR * 1.5), sine = new Float32Array(N2);
  for (let i = 0; i < N2; i++) sine[i] = 0.2 * Math.sin(2 * Math.PI * 110 * i / SR);
  const hg = await P({ drive: 0.65, gate: 0.35 }, sine);
  const pd = await mkProc("insert_distort"); pd.setParamValue("/insert_distort/drive", 0.65);
  const dt = run(pd, sine);
  const a = Math.floor(0.5 * SR), b = Math.floor(1.4 * SR);
  const H = harm(hg, 110, 7, a, b), D = harm(dt, 110, 7, a, b);
  const relDb = (h, i) => db(h[i] / h[0]);
  console.log(`  H3 rel f0: higain ${relDb(H, 2).toFixed(1)} dB vs distort ${relDb(D, 2).toFixed(1)} dB; H2: ${relDb(H, 1).toFixed(0)} / ${relDb(D, 1).toFixed(0)} dB`);
  ok(H[2] / H[0] > D[2] / D[0], "hotter odd series than insert_distort (H3 above distort's)");
  ok(relDb(H, 1) < -60 && relDb(H, 3) < -60, "near-zero even harmonics (symmetric transfers, no DC-building bias)");
  const hfH = hfFrac(hg, a, 6000), hfD = hfFrac(dt, a, 6000);
  console.log(`  HF(>6k) energy fraction: higain ${hfH.toExponential(2)} vs distort ${hfD.toExponential(2)}`);
  ok(hfH < hfD, "cab sim tames the top: less >6 kHz energy than insert_distort (no fizz)");

  // determinism
  const r1 = await P({ drive: 0.65, gate: 0.6 }), r2 = await P({ drive: 0.65, gate: 0.6 });
  let det = true; for (let i = 0; i < stem.length; i++) if (r1[i] !== r2[i]) { det = false; break; }
  ok(det, "two renders are byte-identical (deterministic)");

  console.log("\nPart B — heavymetal integration (declared higain, real press):");
  let st = null;
  for (const g of ["heavymetal", "sludgemetal", "industrialmetal"]) {
    try { st = K.track(g, { seed: 3 }); if (st) { console.log(`  genre: ${g}`); break; } } catch (e) {}
  }
  ok(!!st, "a heavy genre state is available from the kernel");
  if (st) {
    const chain = [{ type: "higain", drive: 0.7, gate: 0.5, stages: 2, presence: 0.6 }];
    st.instruments.melody.inserts = chain;
    st.instruments.bass.inserts = chain;
    const { execFileSync } = require("child_process");
    const os = require("os");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "higain-"));
    const sOn = path.join(tmp, "on.json"), sOff = path.join(tmp, "off.json");
    fs.writeFileSync(sOn, JSON.stringify(st));
    const stripped = JSON.parse(JSON.stringify(st));
    stripped.instruments.melody.inserts = [];
    stripped.instruments.bass.inserts = [];
    fs.writeFileSync(sOff, JSON.stringify(stripped));
    const press = (i, o) => execFileSync(process.execPath, [path.join(__dirname, "..", "engine", "faust", "press.js"), i, o, "--dur", "40"], { stdio: "pipe" }).toString();
    const logOn = press(sOn, path.join(tmp, "on.wav"));
    press(sOff, path.join(tmp, "off.wav"));
    const rmsM = /L-RMS (-?[\d.]+) dB/.exec(logOn);
    ok(/\[inserts: [^\]]*higain/.test(logOn), "press applied the higain chain (log tag)");
    ok(rmsM && parseFloat(rmsM[1]) > -50, `higain press is non-silent (L-RMS ${rmsM ? rmsM[1] : "?"} dB)`);
    const A = fs.readFileSync(path.join(tmp, "on.wav")), B = fs.readFileSync(path.join(tmp, "off.wav"));
    ok(!A.equals(B), "press with higain differs from the stripped press (audibly present)");
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(fail ? `\nPROBE FAIL (${fail})` : "\nPROBE PASS");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
