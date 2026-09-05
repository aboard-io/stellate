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
//   W5  EVERY WORD IN BOTH ALPHABET TABLES (2026-09-05, the tonalities round,
//       when MODES went 12 -> 42 and SCALES 9 -> 21): each of the 63 keys is
//       spelled independently in the gate and read back through degPitch —
//       degrees, octave closure at the row's own period, negative wrap — plus
//       a label, a family and a place in both of avail.js's pickers, the
//       one-owner-per-set law (equal content = the same array), centsOf on
//       every degree of both tables, and saba's half-flat second measured at
//       150.1 cents in the rendered air.
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

/* ================= W5 · EVERY WORD IN BOTH ALPHABET TABLES ================
   2026-09-05, the tonalities round. Paul: *"Same with scales we have all
   kinds of tonalities in this system aren't we missing a lot."* MODES went
   12 -> 42 and SCALES 9 -> 21, and a table of 63 alphabets that nobody
   measures is 63 chances to mistype a semitone in silence.

   THE EXPECTATION IS TYPED HERE, NOT READ FROM THE TABLE. A gate that reads
   `MODES[k]` and asserts `MODES[k]` proves only that JavaScript works. EXPECT
   below is an independent spelling of every alphabet — degrees in float
   semitones, the same units the table uses — and the assertion runs it
   through the kernel's own `NK.pitch` (degPitch, the one owner every
   rendered note goes through), degree by degree, including the octave
   closure at degree n and the negative wrap at degree -1, which is where a
   `period` row and a 12 row differ.

   Five claims, in one sweep:
     · every key of both tables is spelled here and nothing here is a ghost —
       so a scale added tomorrow FAILS this gate until it is measured;
     · degPitch renders each key's declared pitch classes, and closes at the
       row's own period (slendro's 12.08, everything else's 12);
     · every key carries a LABEL and a FAMILY, and both of avail.js's pickers
       offer it — a word in the table that no menu can say is the declared-
       but-never-arriving bug (nukernel/genres-tables.js FAMILYLABEL);
     · two keys of equal content are the SAME OBJECT, never a lookalike
       literal — the law the alias blocks are written to;
     · the quarter-tones survive the transport (`centsOf`) and the AIR (one
       render): saba's half-flat second is 150 cents, not 100 or 200.
   ======================================================================== */
console.log("W5 — all " + (Object.keys(NG.MODES).length + Object.keys(NG.SCALES).length) +
            " alphabets, spelled independently and read through degPitch");
{
  const EXPECT_MODES = {
    // the seven diatonic rotations
    ionian: "0 2 4 5 7 9 11",   dorian: "0 2 3 5 7 9 10",  phrygian: "0 1 3 5 7 8 10",
    lydian: "0 2 4 6 7 9 11",   mixo:   "0 2 4 5 7 9 10",  aeolian:  "0 2 3 5 7 8 10",
    locrian: "0 1 3 5 6 8 10",
    // melodic minor and its six other rotations
    melodic: "0 2 3 5 7 9 11",  dorianb2: "0 1 3 5 7 9 10", lydianaug: "0 2 4 6 8 9 11",
    lydiandom: "0 2 4 6 7 9 10", mixob6: "0 2 4 5 7 8 10",  locrian2: "0 2 3 5 6 8 10",
    altered: "0 1 3 4 6 8 10",
    // harmonic minor's, and the two double-augmented-second scales
    harmonic: "0 2 3 5 7 8 11", phrygiandom: "0 1 4 5 7 8 10", ukrainian: "0 2 3 6 7 9 10",
    lydian2: "0 3 4 6 7 9 11",  ultraloc: "0 1 3 4 6 8 9",   doubleharm: "0 1 4 5 7 8 11",
    hungarian: "0 2 3 6 7 8 11",
    // maqam and dastgah — the half-flats are the point
    rast: "0 2 3.5 5 7 9 10.5", shur: "0 1.5 3 5 7 8 10",   hijaz: "0 1 4 5 7 8 10",
    bayati: "0 1.5 3 5 7 8 10", saba: "0 1.5 3 4 7 8 10",
    segah: "0 1.5 3.5 5.5 7 8.5 10.5", chahargah: "0 1.5 4 5 7 8.5 11",
    hijazkar: "0 1 4 5 7 8 11", nahawand: "0 2 3 5 7 8 10", kurd: "0 1 3 5 7 8 10",
    // Bhatkhande's ten thaats
    bilawal: "0 2 4 5 7 9 11",  khamaj: "0 2 4 5 7 9 10",   kafi: "0 2 3 5 7 9 10",
    asavari: "0 2 3 5 7 8 10",  bhairav: "0 1 4 5 7 8 11",  bhairavi: "0 1 3 5 7 8 10",
    kalyan: "0 2 4 6 7 9 11",   marva: "0 1 4 6 7 9 11",    purvi: "0 1 4 6 7 8 11",
    todi: "0 1 3 6 7 8 11",
    // the one row with its own octave (Surjodiningrat et al., Yogyakarta 1972)
    slendro: "0 2.31 4.74 7.17 9.55 / 12.08",
  };
  const EXPECT_SCALES = {
    chromatic: "0 1 2 3 4 5 6 7 8 9 10 11", whole: "0 2 4 6 8 10",
    augmented: "0 4 8", quartal: "0 5", major: "0 2 4 5 7 9 11",
    blues: "0 3 5 6 7 10", bluesx: "0 1 3 5 6 8 10",
    // the pentatonic wheel: gong, shang, jue, zhi, yu — and the Japanese five
    majpent: "0 2 4 7 9", gong: "0 2 4 7 9", shang: "0 2 5 7 10",
    jue: "0 3 5 8 10", zhi: "0 2 5 7 9", yo: "0 2 5 7 9", yupent: "0 3 5 7 10",
    in: "0 1 5 7 8", hirajoshi: "0 2 3 7 8", kumoi: "0 2 3 7 9",
    // eight notes each
    dimhw: "0 1 3 4 6 7 9 10", dimwh: "0 2 3 5 6 8 9 11",
    bebopdom: "0 2 4 5 7 9 10 11", bebopmaj: "0 2 4 5 7 8 9 11",
  };

  const both = [["MODES", NG.MODES, EXPECT_MODES, NG.MODELABEL, NG.MODEFAMILY],
                ["SCALES", NG.SCALES, EXPECT_SCALES, NG.SCALELABEL, NG.SCALEFAMILY]];

  /* --- the vocabulary is exactly what is spelled here --------------------- */
  for (const [nm, table, expect] of both) {
    const have = Object.keys(table).sort(), want = Object.keys(expect).sort();
    const untested = have.filter((k) => !(k in expect));
    const ghosts = want.filter((k) => !(k in table));
    ok(!untested.length && !ghosts.length,
       nm + ": every one of the " + have.length + " keys is spelled in this gate",
       untested.length ? "unmeasured: " + untested.join(" ")
         : ghosts.length ? "spelled here and not in the table: " + ghosts.join(" ")
         : have.length + " keys");
  }

  /* --- degPitch renders each spelling, and closes at the row's period ----- */
  for (const [nm, table, expect] of both) {
    const wrong = [];
    for (const k of Object.keys(expect)) {
      const arr = table[k]; if (!arr) continue;
      const parts = expect[k].split("/");
      const want = parts[0].trim().split(/\s+/).map(Number);
      const per = parts[1] ? Number(parts[1]) : 12;
      const got = want.map((_, d) => NK.pitch(d, arr));
      const bad = got.some((v, i) => Math.abs(v - want[i]) > 1e-9) ||
                  got.length !== arr.length ||
                  Math.abs(NK.pitch(want.length, arr) - per) > 1e-9 ||
                  Math.abs(NK.pitch(-1, arr) - (want[want.length - 1] - per)) > 1e-9;
      if (bad) wrong.push(k + " read " + got.join(" ") + " +oct " +
                          NK.pitch(want.length, arr) + ", wanted " + expect[k]);
    }
    ok(!wrong.length, nm + ": degPitch reads every key's declared degrees, its octave " +
       "closure and its negative wrap", wrong.length ? wrong.join("; ")
       : Object.keys(expect).length + " alphabets, degrees -1.." + "n");
  }

  /* --- a label, a family, and a place in BOTH pickers --------------------- */
  {
    const Avail = require(R("nukernel/avail.js"));
    const menu = (key) => Avail.SHEETS[key].values();
    const modeMenu = menu("alphabet.mode"), scaleMenu = menu("alphabet.scale");
    const groupsOf = (m) => new Set(m.map((o) => o.group));
    const missing = [];
    for (const [nm, table, , labels, fam] of both)
      for (const k of Object.keys(table)) {
        if (labels[k] == null) missing.push(nm + "." + k + " has no label");
        if (!NG.FAMILYLABEL[fam[k]]) missing.push(nm + "." + k + " has no family");
        const inScale = scaleMenu.some((o) => o.value === k);
        if (!inScale) missing.push(nm + "." + k + " is in no scale menu");
        if (nm === "MODES" && !modeMenu.some((o) => o.value === k))
          missing.push("MODES." + k + " is in no mode menu");
      }
    ok(!missing.length, "every alphabet carries a label and a family and reaches BOTH pickers",
       missing.length ? missing.join("; ")
         : modeMenu.length + " mode options in " + groupsOf(modeMenu).size + " families · " +
           scaleMenu.length + " scale options in " + (groupsOf(scaleMenu).size - 1) + " families");
    // the sweep-up group is avail.js's safety net for a key with no family;
    // it firing at all means the family map fell behind the table
    const loose = [...modeMenu, ...scaleMenu].filter((o) => o.group === "modes" || o.group === "alphabets");
    ok(!loose.length, "no key fell into avail.js's unfamilied sweep-up group",
       loose.map((o) => o.value).join(" ") || "none");
  }

  /* --- one owner per SET: equal content means the same object ------------- */
  for (const [nm, table] of both) {
    const byVal = new Map(), lookalikes = [];
    for (const k of Object.keys(table)) {
      const sig = table[k].join(",") + "|" + (table[k].period || 12);
      if (!byVal.has(sig)) byVal.set(sig, []);
      byVal.get(sig).push(k);
    }
    let shared = 0;
    for (const ks of byVal.values()) {
      if (ks.length < 2) continue;
      shared++;
      if (!ks.every((k) => table[k] === table[ks[0]])) lookalikes.push(ks.join(" = "));
    }
    ok(!lookalikes.length, nm + ": two keys of equal content are the SAME ARRAY, " +
       "never a lookalike literal (precompose nameIn takes the first match)",
       lookalikes.length ? lookalikes.join("; ") : shared + " shared sets");
  }

  /* --- the quarter-tones survive the transport --------------------------- */
  {
    const bad = [];
    for (const [nm, table] of both)
      for (const k of Object.keys(table))
        for (const d of table[k]) {
          const m = 60 + d, r = Math.round(m);
          if (TE.centsOf(m) !== Math.round((m - r) * 100)) bad.push(nm + "." + k + " @" + d);
        }
    ok(!bad.length, "centsOf carries the exact remainder of every degree in both tables",
       bad.length ? bad.join(" ") : "saba 1.5 -> " + TE.centsOf(61.5) + "c, segah 8.5 -> " +
       TE.centsOf(68.5) + "c, rast 3.5 -> " + TE.centsOf(63.5) + "c");
  }

  /* --- and the air: saba's half-flat second, rendered --------------------- */
  {
    const saba = NG.MODES.saba;
    const L = await render([60 + NK.pitch(0, saba), 60 + NK.pitch(1, saba)]);   // 60, 61.5
    const [a0, a1] = win(0), [b0, b1] = win(1);
    const p0 = peakHz(L, a0, a1, 200, 330), p1 = peakHz(L, b0, b1, 220, 360);
    const iv = cents(p1, p0);
    ok(Math.abs(iv - 150) <= TOL, "saba's half-flat second renders 150 cents above the tonic",
       p0.toFixed(1) + " -> " + p1.toFixed(1) + " Hz = " + iv.toFixed(1) + "c");
    ok(Math.abs(iv - 100) > 15 && Math.abs(iv - 200) > 15,
       "…and it is neither the flat second nor the major second (>15c from both)",
       (iv - 100).toFixed(1) + "c above a semitone, " + (200 - iv).toFixed(1) + "c below a tone");
  }
}

console.log("\n" + (fails ? "FAIL " + fails + "/" + checks : "ok — all " + checks + " checks"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
