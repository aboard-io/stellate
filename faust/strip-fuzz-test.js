#!/usr/bin/env node
// faust/strip-fuzz-test.js — the STRIP NaN/MUTE fuzz gate (Paul: "tracks are muted /
// it's random when a track plays"). A NaN or Infinity produced anywhere in the per-note
// channel strip (faust/sampler.js makeStrip/stripStep) poisons into.dry for every
// downstream sample of the whole bar → a silent-or-garbled voice, indistinguishable
// from "the track didn't play". This gate drives the strip DIRECTLY over:
//   (A) all four shipped STRIP_PROFILES (bass/pad/lead/drum) under adversarial INPUT
//       (silence, full-scale square/impulse trains, DC, denormal dust, long runs), and
//   (B) SYNTHETIC extreme-but-reachable strip specs (cutoff→0/Nyquist, Q→1e-6/1e6,
//       huge saturation, huge comp ratio, and — the real landmine — chorus base/depth
//       delays that exceed the delay-line, the negative-index → undefined → NaN bug).
// ASSERT: every output sample is FINITE, and a non-zero input never collapses a
// non-trivial strip to permanent silence.
//
//   node faust/strip-fuzz-test.js
"use strict";
const path = require("path");
const SP = require(path.join(__dirname, "sampler.js"));
const SE = require(path.join(__dirname, "state-engine.js"));

const SR = 44100;
const PROFILES = SE.STRIP_PROFILES;

// input signal generators (per-sample), all bounded except where we deliberately probe.
const SIGNALS = {
  silence: () => 0,
  dc: () => 1,
  fullSquare: (i) => (Math.floor(i / 32) % 2 ? 1 : -1),
  impulseTrain: (i) => (i % 128 === 0 ? 1 : 0),
  sine: (i) => Math.sin(2 * Math.PI * 220 * i / SR),
  loudSine: (i) => 4 * Math.sin(2 * Math.PI * 220 * i / SR),   // over-unity (pre-limiter voice)
  denormalDust: (i) => (i % 2 ? 1e-30 : -1e-30),
  ramp: (i) => ((i % 8192) / 8192) * 2 - 1,
};

// extreme-but-reachable synthetic strips — hardening the biquad/comp/chorus math.
function synthStrips() {
  return {
    "cutoff~0":      { hpf: 1, lpf: 2, eq: { f: 1, gain: 24, q: 0.0001 }, sat: 0.5, satMix: 1,
                       comp: { thresh: 0.0001, ratio: 100, atk: 0.00001, rel: 0.00001, makeup: 8 }, trim: 2 },
    "cutoffNyq":     { hpf: SR * 0.6, lpf: SR * 0.6, eq: { f: SR, gain: -24, q: 1e6 }, sat: 1, satMix: 1,
                       comp: { thresh: 2, ratio: 1e6, atk: 10, rel: 10, makeup: 0 } },
    "chorusOverflow":{ hpf: 30, chorus: { rate: 0.4, baseMs: 80, depthMs: 80, mix: 0.5, two: true } },
    "phaserWide":    { phase: { rate: 5, lo: 1, hi: SR * 0.6, stages: 12, fb: 0.9, mix: 1 } },
    "everythingMax": { hpf: 8000, lpf: 40, eq: { f: 12000, gain: 24, q: 1e-6 }, sat: 4, satMix: 1,
                       comp: { thresh: 1e-6, ratio: 1e9, atk: 1e-6, rel: 1e-6, makeup: 32 },
                       chorus: { rate: 8, baseMs: 200, depthMs: 200, mix: 1, two: true },
                       phase: { rate: 9, lo: 1, hi: SR, stages: 8, fb: 0.99, mix: 1 }, trim: 8 },
  };
}

// run N samples of `sig` through a fresh strip; report finiteness + energy.
function runStrip(strip, sig, N, t0) {
  const S = SP.__test ? SP.__test.makeStrip(strip, SR) : makeViaMix(strip);
  let bad = -1, energy = 0, maxAbs = 0, out0 = null;
  const step = SP.__test.stripStep;
  for (let i = 0; i < N; i++) {
    const x = sig(i);
    const y = step(S, x, t0 + i / SR);
    if (!isFinite(y)) { bad = i; break; }
    energy += y * y; const a = Math.abs(y); if (a > maxAbs) maxAbs = a;
    if (i === N - 1) out0 = y;
  }
  return { bad, rms: Math.sqrt(energy / N), maxAbs, out0 };
}
function makeViaMix() { throw new Error("SP.__test not exported"); }

function main() {
  if (!SP.__test || !SP.__test.makeStrip || !SP.__test.stripStep) {
    console.log("FAIL: sampler.js does not export __test.{makeStrip,stripStep} (needed for the fuzz)");
    process.exit(1);
  }
  const fails = [];
  const N = 20000;          // ~0.45s per run — long enough for filter/comp/chorus state to settle
  const tOffsets = [0, 123.456, 999999.5];   // global-song-time phases for the LFOs

  const cases = [];
  for (const [pn, strip] of Object.entries(PROFILES)) cases.push(["profile:" + pn, strip]);
  for (const [sn, strip] of Object.entries(synthStrips())) cases.push(["synth:" + sn, strip]);

  let runs = 0;
  for (const [label, strip] of cases) {
    for (const [signame, sig] of Object.entries(SIGNALS)) {
      for (const t0 of tOffsets) {
        runs++;
        const r = runStrip(strip, sig, N, t0);
        if (r.bad >= 0) {
          fails.push(`${label} × ${signame} @t${t0}: NON-FINITE at sample ${r.bad}`);
          continue;
        }
        if (!isFinite(r.rms) || !isFinite(r.maxAbs)) {
          fails.push(`${label} × ${signame} @t${t0}: non-finite RMS/peak (${r.rms}/${r.maxAbs})`);
          continue;
        }
        // a non-silent input through a SHIPPED profile must not collapse to permanent
        // digital silence (the "muted track" symptom). The synthetic extremes may
        // legitimately silence (makeup:0, hpf 8k over lpf 40, etc.) — they exist only to
        // stress the math for NON-FINITE output, checked above. Skip near-zero probes.
        if (label.indexOf("profile:") === 0 && signame !== "silence" && signame !== "denormalDust" && r.rms < 1e-9) {
          fails.push(`${label} × ${signame} @t${t0}: shipped profile collapsed a non-zero input to silence (rms ${r.rms})`);
        }
      }
    }
  }

  console.log(`strip fuzz: ${runs} runs over ${cases.length} strips × ${Object.keys(SIGNALS).length} signals × ${tOffsets.length} time-phases (N=${N})`);
  if (fails.length) {
    console.log("FAILURES:\n  - " + fails.slice(0, 40).join("\n  - "));
    console.log(`\nSTRIP-FUZZ GATE: FAIL (${fails.length})`);
    process.exit(1);
  }
  console.log("all outputs finite; no non-zero input collapsed to silence");
  console.log("STRIP-FUZZ GATE: PASS");
}
main();
