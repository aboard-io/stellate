#!/usr/bin/env node
// faust/probe-fenv.js — SYNTHESIS-DEPTH Part B gate: the unified FILTER
// ENVELOPE surface.
//
//   Part A (insert_fenv mechanism, offline processor): the note-triggered
//     squelch for SAMPLED voices — mix 0 bit-exact bypass; positive `amount`
//     opens the ladder on each onset and closes through the tail (within-note
//     centroid trajectory falls); negative `amount` reverses it (the duck);
//     deterministic, no NaN.
//   Part B (synth-model fenv* DSP params): explicit fenvAmount 0 renders
//     BYTE-IDENTICAL to never touching the params (the absent-law at the DSP
//     surface; old-wasm vs new-wasm parity was proven at build time —
//     scratchpad fenv-parity harness, all 18 modules); fenvAmount 2 shows the
//     within-note spectral zap on a SUSTAINED note (gate-triggered AD contour,
//     not an amplitude follower).
//   Part C (state-engine mapping + integration): recipe fenvAmount maps onto
//     each model's native spelling (bass_saw fenvAmount / modeld envAmount);
//     absent keys set NOTHING; a real press with instruments.bass.fenvAmount
//     differs from the same state without it, and a SAMPLED bass with a
//     declared fenv insert differs from the stripped press.
//
//   node test/probe-fenv.js
"use strict";
const fs = require("fs");
const path = require("path");
const K = require(path.join(__dirname, "..", "engine", "genre-kernel.js"));
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
function run(proc, input, sets) {
  // sets: [[sampleIndex, address, value], ...] applied in order
  const out = new Float32Array(input.length);
  let ci = 0;
  const changes = (sets || []).slice().sort((a, b) => a[0] - b[0]);
  for (let s = 0; s < input.length; s += BS) {
    while (ci < changes.length && changes[ci][0] < s + BS) { proc.setParamValue(changes[ci][1], changes[ci][2]); ci++; }
    const len = Math.min(BS, input.length - s);
    out.set(proc.render([input.subarray(s, s + len)], len)[0].subarray(0, len), s);
  }
  return out;
}
// brightness proxy: RMS(first difference)/RMS — a frequency-weighted energy
// ratio, far more stable on decaying program than a small-window DFT centroid
// (whose leakage jitters hundreds of Hz between adjacent windows).
function bright(x, a, n) {
  let sd = 0, s = 0;
  for (let i = a + 1; i < a + n; i++) { const d = x[i] - x[i - 1]; sd += d * d; s += x[i] * x[i]; }
  return s > 0 ? Math.sqrt(sd / s) : 0;
}
const eqBytes = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const finite = (x) => x.every(Number.isFinite);
const silent = (x) => { let s = 0; for (const v of x) s += v * v; return Math.sqrt(s / x.length) < 1e-6; };

(async () => {
  console.log("Part A — insert_fenv mechanism (the sampled-voice squelch):");
  // slow-decay saw plucks (110 Hz, tau 250 ms, every 600 ms) — strong tails
  const DUR = Math.floor(SR * 2.0), inp = new Float32Array(DUR);
  for (let p = 0; p * 0.6 * SR < DUR; p++) {
    const t0 = Math.floor(p * 0.6 * SR);
    for (let i = 0; i < Math.floor(0.55 * SR) && t0 + i < DUR; i++) {
      const t = i / SR;
      inp[t0 + i] += (2 * ((110 * t) % 1) - 1) * 0.5 * Math.exp(-t / 0.25);
    }
  }
  const R = "/insert_fenv/";
  const F = async (params) => {
    const p = await mkProc("insert_fenv");
    for (const [k, v] of Object.entries(params)) p.setParamValue(R + k, v);
    return run(p, inp);
  };
  const byp = await F({ mix: 0, amount: 3 });
  ok(eqBytes(byp, inp), "mix 0 is a bit-exact bypass (insert-chain law)");

  const pos = await F({ amount: 2.5, base: 400, res: 0.6, sens: 0.8, decay: 0.18 });
  const neg = await F({ amount: -2.5, base: 2400, res: 0.6, sens: 0.8, decay: 0.18 });
  const N = 4096;
  // within-pluck trajectory, brightness normalized by the DRY stem at the same
  // offsets (removes the pluck's own spectral decay): pluck 2 spans 0.60-1.15 s;
  // onset window at 0.62 s (follower open), tail at 1.00 s (follower closed —
  // the 0.18 s decay is long gone 0.4 s in, signal down to ~0.1)
  const on2 = Math.floor(0.62 * SR), tail2 = Math.floor(1.00 * SR);
  const rPosOn = bright(pos, on2, N) / bright(inp, on2, N), rPosTail = bright(pos, tail2, N) / bright(inp, tail2, N);
  const rNegOn = bright(neg, on2, N) / bright(inp, on2, N), rNegTail = bright(neg, tail2, N) / bright(inp, tail2, N);
  console.log(`  amount +2.5: brightness vs dry, onset ${rPosOn.toFixed(2)} -> tail ${rPosTail.toFixed(2)}`);
  console.log(`  amount -2.5: brightness vs dry, onset ${rNegOn.toFixed(2)} -> tail ${rNegTail.toFixed(2)}`);
  ok(rPosOn > rPosTail * 1.15, "positive amount: filter opens at the onset, closes through the tail (squelch)");
  ok(rNegOn < rNegTail * 0.9, "negative amount: the reverse squelch (ducks on the hit, blooms in the tail)");
  ok(finite(pos) && finite(neg) && !silent(pos) && !silent(neg), "wet renders non-silent, no NaN");
  const pos2 = await F({ amount: 2.5, base: 400, res: 0.6, sens: 0.8, decay: 0.18 });
  ok(eqBytes(pos, pos2), "two renders are byte-identical (deterministic)");

  console.log("\nPart B — synth-model fenv* (DSP surface, gate-triggered):");
  // SUSTAINED note: gate held 0.15..1.5 s — a follower can't squelch a steady
  // note, the gate-triggered AD contour can. bass_saw + supersaw sampled.
  for (const [mod, base] of [["bass_saw", { cutoff: 900, res: 0.3 }], ["supersaw", { cutoff: 1200, res: 0.2, voices: 2, wave: 1 }]]) {
    const RM = `/${mod}/`;
    const L = Math.floor(SR * 2.0), silence = new Float32Array(0);
    const render = async (extra) => {
      const p = await mkProc(mod);
      for (const [k, v] of Object.entries({ freq: 110, ...base, ...extra })) p.setParamValue(RM + k, v);
      const out = new Float32Array(L);
      const onAt = Math.floor(0.15 * SR), offAt = Math.floor(1.5 * SR);
      for (let s = 0; s < L; s += BS) {
        if (s <= onAt && onAt < s + BS) p.setParamValue(RM + "gate", 1);
        if (s <= offAt && offAt < s + BS) p.setParamValue(RM + "gate", 0);
        out.set(p.render([], BS)[0].subarray(0, Math.min(BS, L - s)), s);
      }
      return out;
    };
    const absent = await render({});
    const zero = await render({ fenvAmount: 0 });
    ok(eqBytes(absent, zero), `${mod}: explicit fenvAmount 0 == untouched (absent-law at the DSP surface)`);
    const active = await render({ fenvAmount: 2, fenvDecay: 0.15 });
    ok(!eqBytes(absent, active) && finite(active) && !silent(active), `${mod}: fenvAmount 2 audibly active, finite, non-silent`);
    // within-note spectral zap, measured as brightness RELATIVE TO THE ABSENT
    // render at the same offsets (cancels the amp envelope's own transient):
    // onset window 10 ms after gate-on, sustain window 0.65 s in (the 0.15 s
    // fenvDecay long settled — the renders converge to RATIO EXACTLY 1 there,
    // the same-samples proof that the envelope returns to the recipe cutoff)
    const onW = Math.floor(0.16 * SR), susW = Math.floor(0.8 * SR);
    const rOn = bright(active, onW, N) / bright(absent, onW, N);
    const rSus = bright(active, susW, N) / bright(absent, susW, N);
    console.log(`  ${mod}: brightness vs absent, onset x${rOn.toFixed(2)} -> sustain x${rSus.toFixed(3)}`);
    ok(rOn > 1.2, `${mod}: within-note spectral zap (onset >= 1.2x brighter than the fenv-less render)`);
    ok(Math.abs(rSus - 1) < 0.02, `${mod}: settles back to the recipe cutoff (sustain ratio ~ 1)`);
  }

  console.log("\nPart C — state-engine mapping + press integration:");
  const u1 = SE.pitchedUnit("bass", { model: "saw", cutoff: 700, res: 0.2, fenvAmount: 2.2, fenvDecay: 0.12, inserts: [] }, { seed: 1 });
  ok(u1.params.fenvAmount === 2.2 && u1.params.fenvDecay === 0.12, "recipe fenvAmount/fenvDecay map onto bass_saw's fenv* params");
  const u2 = SE.pitchedUnit("melody", { model: "modeld", cutoff: 1200, fenvAmount: 3, fenvDecay: 0.3, inserts: [] }, { seed: 1 });
  ok(u2.params.envAmount === 3 && u2.params.envDecay === 0.3, "…and onto modeld's NATIVE envAmount/envDecay spelling");
  const u3 = SE.pitchedUnit("bass", { model: "saw", cutoff: 700, res: 0.2, inserts: [] }, { seed: 1 });
  ok(!("fenvAmount" in u3.params) && !("fenvAttack" in u3.params) && !("fenvDecay" in u3.params),
    "absent recipe keys set NOTHING (unit params byte-identical to the pre-fenv engine)");
  const u4 = SE.pitchedUnit("pad", { model: "saw", cutoff: 2000, res: 0.85, fenvAmount: 4, inserts: [] }, { seed: 1 });
  ok(u4.params.fenvAmount < 4, `SHRIEK GUARD fences a +4 oct env on a res-0.85 pad (capped to ${u4.params.fenvAmount.toFixed(2)} oct)`);

  // real presses: synth bass with fenvAmount, and a SAMPLED bass with the fenv insert
  const { execFileSync } = require("child_process");
  const os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fenv-"));
  const press = (i, o) => execFileSync(process.execPath, [path.join(__dirname, "..", "engine", "faust", "press.js"), i, o, "--dur", "45"], { stdio: "pipe" }).toString();
  // (1) synth path: force a saw bass carrying fenvAmount
  let stS = null;
  try { stS = K.track("techno", { seed: 4, synth: true }); } catch (e) {}
  if (!stS) try { stS = K.track("techno", { seed: 4, sampledOnly: false }); } catch (e) {}
  ok(!!stS, "a synth-path techno state is available");
  if (stS) {
    stS.instruments.bass = { ...stS.instruments.bass, model: "saw", fenvAmount: 2.5, fenvDecay: 0.12 };
    const a = path.join(tmp, "sOn.json"), b = path.join(tmp, "sOff.json");
    fs.writeFileSync(a, JSON.stringify(stS));
    const off = JSON.parse(JSON.stringify(stS));
    delete off.instruments.bass.fenvAmount; delete off.instruments.bass.fenvDecay;
    fs.writeFileSync(b, JSON.stringify(off));
    press(a, path.join(tmp, "sOn.wav")); press(b, path.join(tmp, "sOff.wav"));
    const A = fs.readFileSync(path.join(tmp, "sOn.wav")), B = fs.readFileSync(path.join(tmp, "sOff.wav"));
    ok(!A.equals(B), "synth press with bass fenvAmount differs from the same state without it");
  }
  // (2) sampled path: a declared fenv insert on a sampled bass
  let stN = null;
  try { stN = K.track("citypop", { seed: 2 }); } catch (e) {}
  ok(!!stN && !!(stN.instruments.bass.sampler || stN.sampledOnly), "a sampled-bass citypop state is available");
  if (stN) {
    stN.instruments.bass.inserts = [{ type: "fenv", amount: 2.5, res: 0.6, decay: 0.16 }];
    const a = path.join(tmp, "nOn.json"), b = path.join(tmp, "nOff.json");
    fs.writeFileSync(a, JSON.stringify(stN));
    const off = JSON.parse(JSON.stringify(stN));
    off.instruments.bass.inserts = [];
    fs.writeFileSync(b, JSON.stringify(off));
    const logOn = press(a, path.join(tmp, "nOn.wav")); press(b, path.join(tmp, "nOff.wav"));
    ok(/\[inserts: [^\]]*fenv/.test(logOn), "press applied the fenv chain on the sampled bass (log tag)");
    const A = fs.readFileSync(path.join(tmp, "nOn.wav")), B = fs.readFileSync(path.join(tmp, "nOff.wav"));
    ok(!A.equals(B), "sampled-bass press with the fenv insert differs from the stripped press");
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fail ? `\nPROBE FAIL (${fail})` : "\nPROBE PASS");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
