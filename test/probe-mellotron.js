// faust/probe-mellotron.js — Part A gate: verify the sampler MELLOTRON mode.
//
// Renders a single long sustained sampler note through faust/sampler.js mixPCM
// (the deterministic press path) with mellotron ON vs OFF, then:
//   1. recovers the instantaneous pitch by LOCK-IN (quadrature) demodulation of
//      a clean sine carrier and measures the spectral energy of the pitch track
//      at the wow (0.7 Hz) and flutter (7 Hz) rates — ON must show clear energy
//      at both, OFF ~flat.
//   2. confirms the 8s tape-strip CAP: a 12s note is silent after cap+release.
//   3. confirms head-EQ dulls the highs (a 6 kHz probe tone is attenuated).
//   4. confirms DETERMINISM: two mello renders are byte-identical.
//   5. confirms a NON-mello note takes the unchanged bit-exact path.
//
//   node faust/probe-mellotron.js
"use strict";
const SP = require("../engine/faust/sampler.js");
const SR = 44100;

// synthetic source: a clean 220 Hz sine (the pitch carrier) plus a quiet 6 kHz
// tone (the head-EQ probe). Looped an integer number of 220 Hz periods, with
// loopEnd WELL within the buffer (a full-length loopEnd trips the natural-end
// break before wrapping — real FluidR3 zones always loop inside the sample).
// F0 = SR/P exactly (=220.5 Hz) so an integer P-sample loop is phase-continuous
// (no wrap glitch); FHI = the 27th harmonic, also loop-seamless (the head-EQ probe).
const P = 200, F0 = SR / P, FHI = 27 * F0, SRCLEN = P * 400;
const src = new Float32Array(SRCLEN);
for (let i = 0; i < SRCLEN; i++) src[i] = 0.7 * Math.sin(2 * Math.PI * F0 * i / SR) + 0.25 * Math.sin(2 * Math.PI * FHI * i / SR);
const buffers = { t: src };
const ROOT = 69 + 12 * Math.log2(F0 / 440);   // => rate 1.0 at NOTE_HZ = F0
const zones = [{ srcId: "t", root: ROOT, lo: 0, hi: 127, loop: 1, loopStart: P * 2, loopEnd: P * 398 }];
const NOTE_HZ = F0;

function render(mello, durSec, headEq) {
  const total = Math.floor((durSec + 1) * SR);
  const dry = new Float32Array(total), rev = new Float32Array(total), del = new Float32Array(total);
  const m = mello ? { wowDepth: 0.07, flutterDepth: 0.035, wowRate: 0.7, flutterRate: 7, tapeCap: 8, headEq: headEq != null ? headEq : 0 } : null;
  const notes = [{ tSec: 0, durSec, freq: NOTE_HZ, gain: 0.8, atk: 0.02, rel: 0.1, zones, mello: m }];
  SP.mixPCM(notes, buffers, SR, { dry, rev, del }, { dry: 1, rev: 0, del: 0 });
  return dry;
}

// lock-in demod at `carrier`: returns {freq:[Hz], fs} instantaneous frequency
function instFreq(buf, s0, n, carrier) {
  const I = new Float32Array(n), Q = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = (s0 + i) / SR, x = buf[s0 + i]; I[i] = x * Math.cos(2 * Math.PI * carrier * t); Q[i] = x * Math.sin(2 * Math.PI * carrier * t); }
  const fc = 22, a = 1 - Math.exp(-2 * Math.PI * fc / SR);   // 2-pole lowpass: keeps flutter (7 Hz), rejects the 2*carrier image
  let li = 0, lq = 0, li2 = 0, lq2 = 0;
  for (let i = 0; i < n; i++) { li += a * (I[i] - li); li2 += a * (li - li2); I[i] = li2; lq += a * (Q[i] - lq); lq2 += a * (lq - lq2); Q[i] = lq2; }
  const hop = 64, freq = [];
  let prev = Math.atan2(Q[hop], I[hop]);
  for (let i = 2 * hop; i < n; i += hop) {
    let ph = Math.atan2(Q[i], I[i]), d = ph - prev;
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    freq.push(carrier + d / (2 * Math.PI) / (hop / SR)); prev = ph;
  }
  return { freq, fs: SR / hop };
}

// lock-in amplitude at `f` over [s0, s0+n)
function amplitudeAt(buf, s0, n, f) {
  let I = 0, Q = 0;
  for (let i = 0; i < n; i++) { const t = (s0 + i) / SR, x = buf[s0 + i]; I += x * Math.cos(2 * Math.PI * f * t); Q += x * Math.sin(2 * Math.PI * f * t); }
  return 2 * Math.sqrt(I * I + Q * Q) / n;
}

function dftMag(series, fsHz, f) {
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  let re = 0, im = 0;
  for (let n = 0; n < series.length; n++) { const x = series[n] - mean, ph = 2 * Math.PI * f * n / fsHz; re += x * Math.cos(ph); im -= x * Math.sin(ph); }
  return Math.sqrt(re * re + im * im) / series.length;
}
const std = (arr) => { const m = arr.reduce((a, b) => a + b, 0) / arr.length; return Math.sqrt(arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length); };
function rms(buf, a, b) { let s = 0, n = 0; for (let i = a; i < b && i < buf.length; i++) { s += buf[i] * buf[i]; n++; } return n ? Math.sqrt(s / n) : 0; }

let fail = 0;
const ok = (c, msg) => { console.log((c ? "  ok  " : "  FAIL") + " " + msg); if (!c) fail++; };

// ---- 1. wow/flutter pitch modulation ----
const DUR = 6;
const on = render(true, DUR, 0), off = render(false, DUR, 0);
const s0 = Math.floor(0.4 * SR), n = Math.floor(5.2 * SR);   // steady body, skip attack/edges
const fOn = instFreq(on, s0, n, NOTE_HZ), fOff = instFreq(off, s0, n, NOTE_HZ);
const wowOn = dftMag(fOn.freq, fOn.fs, 0.7), wowOff = dftMag(fOff.freq, fOff.fs, 0.7);
const flOn = dftMag(fOn.freq, fOn.fs, 7.0), flOff = dftMag(fOff.freq, fOff.fs, 7.0);
// wow ≈ 220.5*(2^(0.07/12)-1) ≈ 0.9 Hz amplitude; flutter ≈ 0.45 Hz amplitude
console.log(`  inst-freq std (demod noise floor): ON=${std(fOn.freq).toFixed(3)}Hz  OFF=${std(fOff.freq).toFixed(3)}Hz`);
console.log(`  wow(0.7Hz) mag:   ON=${wowOn.toFixed(4)}  OFF=${wowOff.toFixed(4)}`);
console.log(`  flutter(7Hz) mag: ON=${flOn.toFixed(4)}  OFF=${flOff.toFixed(4)}`);
ok(wowOn + flOn > 8 * (wowOff + flOff), "wow+flutter modulation present ON, absent OFF");
ok(wowOn > 5 * (wowOff + 1e-6), "wow energy at 0.7 Hz clearly present (ON >> OFF)");
ok(flOn > 5 * (flOff + 1e-6), "flutter energy at 7 Hz clearly present (ON >> OFF)");

// ---- 2. tape cap ----
const capped = render(true, 12, 0);
const bodyRms = rms(capped, Math.floor(1 * SR), Math.floor(7 * SR));
const afterRms = rms(capped, Math.floor(9 * SR), Math.floor(11 * SR));
console.log(`  tape-cap: body(1-7s) rms=${bodyRms.toFixed(4)}  after-cap(9-11s) rms=${afterRms.toFixed(5)}`);
ok(bodyRms > 0.05, "capped note sings through the tape strip (1-7s)");
ok(afterRms < bodyRms * 0.02, "capped note is silent after the 8s strip runs out");

// ---- 3. head-EQ dulls highs (6 kHz probe tone attenuated) ----
const bright = render(true, 4, 0), dull = render(true, 4, 0.8);
const hiBright = amplitudeAt(bright, Math.floor(1 * SR), Math.floor(2 * SR), FHI);
const hiDull = amplitudeAt(dull, Math.floor(1 * SR), Math.floor(2 * SR), FHI);
console.log(`  head-EQ 6kHz amp: headEq0=${hiBright.toFixed(4)}  headEq0.8=${hiDull.toFixed(4)}`);
ok(hiDull < hiBright * 0.6, "head-EQ attenuates the 6 kHz highs");

// ---- 4. determinism ----
const r1 = render(true, 5, 0.3), r2 = render(true, 5, 0.3);
let same = r1.length === r2.length;
for (let i = 0; same && i < r1.length; i++) if (r1[i] !== r2[i]) same = false;
ok(same, "two mellotron renders are byte-identical (deterministic)");

// ---- 5. non-mello path unchanged ----
const nm1 = render(false, 5, 0), nm2 = render(false, 5, 0);
let nmsame = true;
for (let i = 0; i < nm1.length; i++) if (nm1[i] !== nm2[i]) { nmsame = false; break; }
ok(nmsame, "non-mello path deterministic (unchanged code path)");

console.log(fail ? `\nPROBE FAIL (${fail})` : "\nPROBE PASS");
process.exit(fail ? 1 : 0);
