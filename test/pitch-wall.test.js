#!/usr/bin/env node
// test/pitch-wall.test.js — CENTS AND THE NON-2:1 PERIOD, MEASURED ON SAMPLES.
//
// Paul, 2026-08-30: "I think we need to deal with those in the engine and make
// sure we have exemplars of all" — this is the PITCH wall of the five. The
// wall as it stood: every scale row was an integer-semitone array and kernel
// degPitch hardcoded `12 * Math.floor(d / len)` (the gamelan refusal quoted
// that line), so shur's quarter-flat second, slendro's 240-cent step and any
// alphabet that does not repeat at the 2:1 octave were unsayable.
//
// WHAT CHANGED, at one owner each:
//   * kernel degPitch: `(a.period || 12) * Math.floor(d / a.length)` — a row
//     may carry float semitone values and a `period` property (genres.js
//     `tuned(steps, period)`); the register fold and the octave word move by
//     `per` in the same voice loop, so a period scale keeps its pitch classes
//     across registers.
//   * to-engine: pchOf still rounds (pch IS a 12-TET spelling); the remainder
//     rides beside it as integer cents (`centsOf`), written ONLY when nonzero.
//   * state-engine mapEvents: `if (p.cents) noteHz *= 2^(cents/1200)` — on the
//     Hz itself, before the register folds, for every voice class at once.
//   * export/smf keysOf: `m | 0` (a TRUNCATION — 62.6 wrote key 62) became
//     Math.round — the .mid quantizes to the NEAREST chromatic, honestly, and
//     deliberately grows no pitch-bend lane (one wheel per channel cannot say
//     per-note cents on a chord).
//
// WHAT IS ASSERTED (TEST THE ARTIFACT — W2..W4 read rendered samples through
// toEngine → mapEvents → PRESS.assemble, the tape's own path):
//   W1  arithmetic at the owner: integer rows compute the identical bytes the
//       12-formula always computed (a degree sweep, both alphabets); fractional
//       values pass through; slendro's 5×2.4 lands its fifth degree at 12; an
//       11.8-period row lands it at 11.8 and wraps negative degrees against
//       its OWN period.
//   W2  ABSENT-IS-TODAY at the event: an all-integer record's pitched events
//       carry NO cents key — JSON-identical event objects — and centsOf is 0
//       on every integer.
//   W3  the +50-cent degree reaches the AIR: MIDI 69.5 renders its spectral
//       peak at 452.89 Hz within 3 cents (control: 69 renders 440 within 3).
//   W4  the period reaches the air: degrees 0 and 5 of an 11.8-semitone row
//       render an interval of 1180 cents ±3 — the octave lands where the row
//       says, NOT where 12 says (>15c away from 1200) — and slendro's first
//       step renders 240c ±3.
//
// The probe voice is hammond with its insert chain stripped: chorus and
// leslie MODULATE pitch by design (pad_saw is three saws detuned ±10c under a
// tape-wow LFO — measured, it smeared the peak by up to 15c and that smear is
// the instrument's identity, not the path's error). The claim under test is
// the PITCH PATH, so it is measured at a voice whose oscillator holds still.
"use strict";
const path = require("path");
const R = (p) => path.join(__dirname, "..", p);

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what + (detail ? "  [" + detail + "]" : "")); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};

/* ---------- the stub window (series-bus's own preamble) ------------------- */
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", body: { append() {} },
  createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
window.NuKernel = require(R("nukernel/kernel.js"));
window.NuGenres = require(R("nukernel/genres.js"));
window.NuFields = require(R("nukernel/fields.js"));
window.NuSong = require(R("nukernel/song.js"));
window.NuInstruments = require(R("nukernel/instruments.js"));
window.NuCompose = require(R("nukernel/compose.js"));
window.PRESETS = require(R("nukernel/presets.js")).PRESETS;
window.NuDocument = require(R("nukernel/document.js"));
window.NuSongs = require(R("nukernel/songs.js"));
window.__REGISTRY = require(R("engine/registry-data.js"));

const E = require(R("engine/csd-engine.js"));
const SE = require(R("engine/faust/voices/state-engine.js"));
const PRESS = require(R("engine/faust/press/press.js"));
const K = require(R("engine/genre-kernel.js"));
const NK = window.NuKernel, NG = window.NuGenres;
const SR = 44100;

/* ---------- measurement: Goertzel peak sweep (series-bus's meter, finer) --- */
function goertzel(x, s, e, f0) {
  const w = 2 * Math.PI * f0 / SR, c = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = s; i < e; i++) { s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}
function peakHz(x, s, e, lo, hi) {
  let best = lo, bp = -1;
  for (let f = lo; f <= hi; f += 0.1) {
    const p = goertzel(x, s, e, f);
    if (p > bp) { bp = p; best = f; }
  }
  return best;
}
const hzOfMidi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const cents = (a, b) => 1200 * Math.log2(a / b);

/* ---------- one long note per bar, on a pitch-stable voice ---------------- */
function plan(notes) {
  const bars = [];
  for (const n of notes)
    bars.push({ barSteps: 16, ev: [{ kind: "line", v: 0, n, off: 0, dur: 16, vel: 6 }] });
  return { bpm: 120, seed: 3, kit: "tr909", bars,
           reverb: 0, delay: { beats: 0.75, feedback: 0 },
           seat: () => ({ chair: "line", synth: { dsp: "hammond", level: 0.5 } }),
           bass: { synth: { dsp: "bass_sub", level: 0.5 } } };
}

(async () => {
console.log("test/pitch-wall.test.js — cents + non-2:1 periods, on rendered samples\n");
const TE = await import(R("nukernel/audio/to-engine.js"));

/* ================= W1 · arithmetic at the one owner ======================= */
console.log("W1 — degPitch: same bytes for 12-rows, floats and periods pass");
{
  const rows = [NK.PENT, NK.MODE, NG.SCALES.major, NG.SCALES.chromatic, NG.SCALES.blues];
  let same = true;
  for (const a of rows)
    for (let d = -17; d <= 17; d++) {
      const now = NK.pitch(d, a);
      const before = a[((d % a.length) + a.length) % a.length] + 12 * Math.floor(d / a.length);
      if (now !== before) { same = false; break; }
    }
  ok(same, "every period-less row computes the identical value the 12-formula did (d -17..17)");
  const shur = [0, 1.5, 4, 5, 7, 8.5, 10];             // the quarter-flat second, said as a number
  ok(NK.pitch(1, shur) === 1.5 && NK.pitch(8, shur) === 13.5,
     "fractional semitone values pass through and carry their octave", "pitch(1)=1.5, pitch(8)=13.5");
  const slen = NG.tuned([0, 2.4, 4.8, 7.2, 9.6], 12);  // 240c steps, period still the octave
  ok(NK.pitch(5, slen) === 12 && NK.pitch(1, slen) === 2.4,
     "slendro: five 240-cent steps close at 12 exactly");
  const bp = NG.tuned([0, 2.3, 4.6, 7.1, 9.5], 11.8);  // a non-2:1 period
  ok(NK.pitch(5, bp) === 11.8 && Math.abs(NK.pitch(-1, bp) - (9.5 - 11.8)) < 1e-9,
     "an 11.8-semitone period lands degree 5 at 11.8 and wraps negatives against ITS period",
     "pitch(5)=" + NK.pitch(5, bp) + ", pitch(-1)=" + NK.pitch(-1, bp).toFixed(3));
  ok(typeof NG.tuned === "function" && NG.tuned([0], 7).period === 7,
     "genres.tuned rides the period on the row itself");
}

/* ================= W2 · absent-is-today at the event ====================== */
console.log("W2 — an all-integer record writes no cents key anywhere");
{
  const t = TE.toEngine(plan([60, 69, 71]), { SE, K, E });
  const leaked = t.ev.pitched.filter((p) => "cents" in p);
  ok(leaked.length === 0, "no pitched event of an integer record carries `cents`",
     JSON.stringify(t.ev.pitched.map((p) => p.pch)));
  let zero = true;
  for (let m = 0; m <= 127; m++) if (TE.centsOf(m) !== 0) zero = false;
  ok(zero, "centsOf is 0 on every integer MIDI note 0..127");
  // the remainder is measured against pchOf's OWN rounding (both Math.round),
  // so the half-way note spells as the semitone ABOVE minus fifty — 69.5 is
  // 70 − 50c — and pch + cents always name the same pitch.
  ok(TE.centsOf(69.5) === -50 && TE.centsOf(62.4) === 40 && TE.centsOf(61.6) === -40,
     "centsOf carries the remainder against pchOf's rounding (69.5→70−50c, 62.4→+40, 61.6→−40)");
}

/* ================= the render path (toEngine → mapEvents → press) ========= */
async function render(notes) {
  const t = TE.toEngine(plan(notes), { SE, K, E });
  // strip the modulation inserts — the header says why: the claim is the
  // pitch path, measured at a voice that holds still
  for (const u of Object.values(t.units)) if (u.inserts) u.inserts = [];
  const sched = SE.mapEvents(E, t.state, t.ev, { units: t.units });
  const spb = sched.spb, totalSec = sched.totalBeats * spb;
  const TOTAL = Math.ceil(totalSec * SR);
  const { L } = await PRESS.assemble(t.state, sched,
    { mkProc: PRESS.mkProc, rootOf: PRESS.rootOf, buffers: {}, speech: null,
      dx7Presets: PRESS.loadDx7Presets() }, { spb, totalSec, TOTAL });
  return L;
}
const win = (bar) => [Math.round((bar * 2 + 0.4) * SR), Math.round((bar * 2 + 1.8) * SR)];
const TOL = 3;   // cents — measured 0.00 / 0.03 / 0.17 at build time; 3 is the fence

/* ================= W3 · the +50-cent degree reaches the air =============== */
console.log("W3 — MIDI 69.5 renders 452.89 Hz (FFT peak, ±" + TOL + "c)");
{
  const L = await render([69, 69.5]);
  const [a0, a1] = win(0), [b0, b1] = win(1);
  const pA = peakHz(L, a0, a1, 380, 520), pB = peakHz(L, b0, b1, 380, 520);
  const eA = cents(pA, hzOfMidi(69)), eB = cents(pB, hzOfMidi(69.5));
  ok(Math.abs(eA) <= TOL, "control: 69 renders 440 Hz", pA.toFixed(1) + " Hz, " + eA.toFixed(2) + "c");
  ok(Math.abs(eB) <= TOL, "69.5 renders 452.89 Hz — the half-semitone is IN THE AIR",
     pB.toFixed(1) + " Hz, " + eB.toFixed(2) + "c");
  ok(Math.abs(cents(pB, pA) - 50) <= TOL, "the rendered gap between them is 50 cents",
     cents(pB, pA).toFixed(2) + "c");
}

/* ================= W4 · the period reaches the air ======================== */
console.log("W4 — the octave lands where the ROW says, not where 12 says");
{
  const bp = NG.tuned([0, 2.3, 4.6, 7.1, 9.5], 11.8);
  const n0 = 60 + NK.pitch(0, bp), n5 = 60 + NK.pitch(5, bp);   // 60 and 71.8
  const L = await render([n0, n5]);
  const [a0, a1] = win(0), [b0, b1] = win(1);
  const q0 = peakHz(L, a0, a1, 200, 330), q5 = peakHz(L, b0, b1, 400, 660);
  const ival = cents(q5, q0);
  ok(Math.abs(ival - 1180) <= TOL, "degrees 0→5 of the 11.8-row render 1180c apart",
     q0.toFixed(1) + " → " + q5.toFixed(1) + " Hz = " + ival.toFixed(1) + "c");
  ok(Math.abs(ival - 1200) > 15, "…and that is NOT the 12-octave (>15c away from 1200c)",
     (1200 - ival).toFixed(1) + "c short of 1200");
  const slen = NG.tuned([0, 2.4, 4.8, 7.2, 9.6], 12);
  const m0 = 60 + NK.pitch(0, slen), m1 = 60 + NK.pitch(1, slen); // 60 and 62.4
  const L2 = await render([m0, m1]);
  const r0 = peakHz(L2, a0, a1, 200, 330), r1 = peakHz(L2, b0, b1, 240, 380);
  ok(Math.abs(cents(r1, r0) - 240) <= TOL, "slendro's first step renders 240c",
     r0.toFixed(1) + " → " + r1.toFixed(1) + " Hz = " + cents(r1, r0).toFixed(1) + "c");
}

console.log("\n" + (fails ? "FAIL " + fails + "/" + checks : "ok — all " + checks + " checks"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
