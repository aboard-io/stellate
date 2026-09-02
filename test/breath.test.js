#!/usr/bin/env node
// test/breath.test.js — THE BREATH AFTER THE VOWEL, WHICH THERE IS NOT ONE OF.
//
// Paul, 2026-08-27, listening on staging: *"All the songs in Asia and so forth
// have really heavy breathing in 1971. Like Iranian pop. Just two heavy breaths
// dominating every measure."*
//
// He was describing a literal sound and he was counting correctly. Every anchor
// in that block seats `solo_vox` in chair one, they are ballads (`rel` 1.0-1.4
// s) and they are legato (`maxHold` 3-4), so one bar holds one phrase with one
// clean start and one clean end. The start was the h the vocal tract is
// supposed to have. The end was a bug:
//
//   voice_tract.lib  fric = min(1, breath + 0.55*(1 - smooth(gate, 30ms)))
//
// `si.smooth` is a SYMMETRIC one-pole. It rises over 30 ms when the gate opens
// — the documented "breath before the vowel" — and it FALLS over 30 ms when the
// gate shuts, which walks `fric` back up to `breath + 0.55` while `voxEnv` is
// still sounding the note through its release. voxAgc normalizes the tract's
// steady state, so the aspiration that replaced the tone came out at the tone's
// own loudness: a full-level exhale, as long as the genre's `rel`. An h in and
// a half-second sigh out. Two a measure.
//
// THE DIAL WAS MEASURED FIRST AND IS NOT THE CAUSE. `breath` is the genre's own
// `air` (genres.js MOUTHS -> to-engine voiceForInstr). Swept across its whole
// declared range on the rendered iranpop singer, it moved the stem's 8-16 kHz
// MEDIAN from -72.3 dB to -57.2 dB and left the swells exactly where they were
// (2.12/bar at breath 0, 1.87 at 0.144, 1.75 at 0.6). `air` is the floor; the
// gate term was the breathing.
//
// WHAT IS ASSERTED, and the first one is the gate that cannot be argued with:
//
//   B1  THE INVARIANT, on the shipped WASM at the params each genre's chair
//       actually sends (to-engine voiceForInstr): a note's RELEASE TAIL must
//       not be brighter above 4 kHz than the note it is the tail of. The
//       threshold is +2.0 dB. Before the fix all sixteen singers in the block
//       read +4.8 to +11.8 dB; after, -6.6 to +1.3.
//   B2  THE SAME INVARIANT ON THE CHOIR, which imports the same tract. Said as
//       a GUARD and not as a cure: measured at the params qawwali's section
//       sends, voice_choir did NOT fail this before the fix — two staggered
//       throats and a 0.22 default breath kept it inside — so this row is here
//       because the two modules share `voxTract` and a change to it must never
//       be checked on only one of them.
//   B3  THE h IS STILL THERE. The fix must not have deleted the feature the
//       header claims: the first 30 ms of a note after a rest still stands
//       over the note's own steady state above 4 kHz.
//   B4  AT ZERO BREATH IT IS STILL A VOICE. `breath` 0 with the gate open is
//       untouched by this round — the term is multiplied by `gate`, which is
//       1.0 there, and x*1.0 is exact — so a sustained note is tone.
//
// Rendered, deterministic, no ears, no clock, ~6 s. It does NOT render a whole
// record: the record-level before/after is in the round's report, and what
// keeps this from coming back silently is the module invariant, which is where
// the defect lived.
"use strict";
const path = require("path");
const fs = require("fs");
const R = (p) => path.join(__dirname, "..", p);
const FAUST = R("engine/faust");
const SR = 44100, BS = 64;

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};
const dB = (v) => 20 * Math.log10(Math.max(v, 1e-12));
const rms = (a, s, e) => { let q = 0; for (let i = s; i < e; i++) q += a[i] * a[i];
  return Math.sqrt(q / Math.max(1, e - s)); };
// 4 kHz highpass, 4th order — "the air", the same band to-engine.js:560 and
// nukernel/knobs-extract.js:160 already argue the voice's balance in.
function hp4k(a) {
  const one = (x) => {
    const w = Math.tan(Math.PI * 4000 / SR), n = 1 / (1 + Math.SQRT2 * w + w * w);
    const b0 = n, b1 = -2 * n, b2 = n,
          a1 = 2 * (w * w - 1) * n, a2 = (1 - Math.SQRT2 * w + w * w) * n;
    const o = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = y; o[i] = y;
    }
    return o;
  };
  return one(one(a));
}

/* ---------- the shipped artifacts, offline (press's own recipe) ----------- */
let gen = null; const fac = {};
async function proc(mod) {
  if (!gen) {
    const { FaustMonoDspGenerator } = await import(
      path.join(FAUST, "node_modules/@grame/faustwasm/dist/esm/index.js"));
    gen = new FaustMonoDspGenerator();
  }
  if (!fac[mod]) {
    const code = fs.readFileSync(path.join(FAUST, "dist", mod + "-module.wasm"));
    fac[mod] = { cfactory: 0, code: new Uint8Array(code),
      module: await WebAssembly.compile(code),
      json: fs.readFileSync(path.join(FAUST, "dist", mod + "-meta.json"), "utf8"),
      poly: false };
  }
  return gen.createOfflineProcessor(SR, BS, fac[mod]);
}
// one note: gate opens at 0.2 s, holds, shuts, and the tail runs out
async function note(mod, sets, holdSec) {
  const rel = sets.release || 0.3;
  const T = Math.round(SR * (0.2 + holdSec + rel + 0.6));
  const on = Math.round(SR * 0.2), off = on + Math.round(SR * holdSec);
  const p = await proc(mod);
  for (const [k, v] of Object.entries(sets)) p.setParamValue("/" + mod + "/" + k, v);
  const out = new Float32Array(T), z = new Float32Array(BS);
  for (let s = 0; s < T; s += BS) {
    if (s >= on && s - BS < on) p.setParamValue("/" + mod + "/gate", 1);
    if (s >= off && s - BS < off) p.setParamValue("/" + mod + "/gate", 0);
    const len = Math.min(BS, T - s);
    const o = p.render([z.subarray(0, len)], len);
    if (o.length === 1) out.set(o[0].subarray(0, len), s);
    else for (let i = 0; i < len; i++) out[s + i] = 0.5 * (o[0][i] + o[1][i]);
  }
  return { x: out, on, off, T };
}
// the number: how much brighter the tail is than the note, above 4 kHz.
// The note's own steady state is its last 300 ms; the tail is 50..350 ms after
// the gate shuts, which is where an exhale lives and where the release still
// has plenty of level to carry one.
function tailOverSustain(n) {
  const H = hp4k(n.x);
  return dB(rms(H, n.off + Math.round(SR * 0.05), n.off + Math.round(SR * 0.35)))
       - dB(rms(H, n.off - Math.round(SR * 0.3), n.off));
}

const VOICE_TYPE = { alto: 0, bass: 1, countertenor: 2, soprano: 3, tenor: 4 };
// THE THRESHOLD, AND WHERE IT COMES FROM. Measured on the shipped module at
// these same sixteen chairs, before and after the 2026-08-27 fix:
//     before   +4.8 (aljil) .. +11.8 (mandopop),  every one of the sixteen
//     after    -6.6 (aljil) ..  +1.3 (kabulpop, qawwali)
// +2.0 sat above the worst surviving case and 2.8 dB under the mildest
// failure, so it could not be met by a voice that had started exhaling again.
// The two that read +1.3 are the two highest `air` values in the MOUTHS table
// (qawwal 0.36 -> breath 0.216): what is left there is the floor the genre
// asked for, not a gesture at the gate.
//
// ---- +2.0 IS +3.0 SINCE 2026-09-02, AND WHY IT MOVED ----------------------
// The release got a SHAPE. voice_tract.lib `voxEnv` was `en.asr` — a linear
// ramp down — and it is a raised-cosine ramp now, because `en.asr` zeroed
// itself on a rising gate and cut 9.2 dB out of every retriggered note (the
// whole argument, and Paul's sentence, are in test/voice-smooth.test.js).
// A raised cosine is FLAT AT THE TOP, so it holds more level through the
// 50-350 ms window this measurement calls "the tail" than a straight line
// does — about a decibel, on every singer at once and in both bands equally.
// MEASURED over the same sixteen chairs, before and after:
//   before  -6.6 (aljil) .. +1.3 (kabulpop, qawwali)
//   after   -6.2 (aljil) .. +2.3 (kabulpop, qawwali)
// So the whole set moved up 0.4 to 1.0 dB and its ORDER is unchanged, which is
// what says this is the envelope's shape and not a breath coming back: an
// exhale is a fricative and would move the two highest-`air` rows differently
// from the rest. +3.0 sits 0.7 dB over the worst surviving case and 1.8 dB
// under the mildest failure this gate was written to catch, so it still cannot
// be met by a voice that has started exhaling again.
const TAIL_CEILING = 3.0;
// THE BLOCK PAUL WAS LISTENING TO, plus the fast records beside it — the fast
// ones matter because they are where the defect HID (a 0.4 s release buries an
// exhale under the next note), so they are the rows that would go quietly wrong
// again first.
const SINGERS = ["iranpop", "kabulpop", "enka", "nhacvang", "filmi", "arabesk",
                 "cantopop", "mandopop", "dangdut", "qawwali", "trot", "lukthung",
                 "shidaiqu", "khmerrock", "aljil", "shaabi"];

(async () => {
console.log("test/breath.test.js — no breath after the vowel, on rendered audio\n");
const { GENRES } = require(R("nukernel/genres.js"));
const TE = await import(R("nukernel/audio/to-engine.js"));

/* ---- B1 · the release tail is not brighter than the note ---------------- */
console.log("B1 — the release tail, at the params each chair sends");
const rows = [];
for (const gk of SINGERS) {
  const g = GENRES[gk];
  if (!ok(!!g, gk + " is in the catalogue")) continue;
  const V = TE.voiceForInstr("solo_vox", g.tone);
  if (!ok(!!(V && V.set), gk + " seats a modelled singer")) continue;
  const S = V.set;
  const sets = { freq: 330, voice: VOICE_TYPE[S.voice] != null ? VOICE_TYPE[S.voice] : 0,
    vowel: 0, push: 0.75, attack: S.attack, release: S.release, cutoff: S.cutoff,
    level: 0.728, gain: 0.216, breath: S.breath,
    vibrato: S.vibrato != null ? S.vibrato : 0.02, sway: S.sway, vowelSway: S.vowelSway };
  const over = tailOverSustain(await note("voice_lead", sets, 1.0));
  rows.push([gk, S.breath, S.release, over]);
  ok(over <= TAIL_CEILING,
     `${gk}: tail is ${over >= 0 ? "+" : ""}${over.toFixed(1)} dB on the note above 4 kHz (ceiling +${TAIL_CEILING.toFixed(1)})`,
     `breath ${S.breath} · release ${S.release} s · cutoff ${Math.round(S.cutoff)} Hz`);
}
console.log("      " + rows.map(r => `${r[0]} ${r[3] >= 0 ? "+" : ""}${r[3].toFixed(1)}`).join("  "));

/* ---- B2 · the choir shares the throat ----------------------------------- */
console.log("\nB2 — voice_choir imports the same tract (a guard, see the header)");
{
  const V = TE.voiceForInstr("ahh_choir", GENRES.qawwali.tone);
  ok(!!(V && V.set && V.dsp === "voice_choir"), "qawwali's section resolves to voice_choir");
  const S = (V && V.set) || {};
  const sets = { freq: 260, voice: VOICE_TYPE[S.voice] != null ? VOICE_TYPE[S.voice] : 0,
    vowel: 0, push: 0.7, attack: S.attack != null ? S.attack : 0.2,
    release: S.release != null ? S.release : 1.2,
    cutoff: S.cutoff != null ? S.cutoff : 5000, level: 0.6, gain: 0.3,
    breath: S.breath != null ? S.breath : 0.08,
    spread: S.spread != null ? S.spread : 1, drift: S.drift != null ? S.drift : 1,
    width: S.width != null ? S.width : 0.8 };
  const over = tailOverSustain(await note("voice_choir", sets, 1.2));
  ok(over <= TAIL_CEILING,
     `the choir's tail is ${over >= 0 ? "+" : ""}${over.toFixed(1)} dB on the note above 4 kHz (ceiling +${TAIL_CEILING.toFixed(1)})`,
     `breath ${sets.breath} · release ${sets.release} s`);
}

/* ---- B3 · the h before the vowel is still there -------------------------- */
console.log("\nB3 — the h the header claims, still in front of the note");
{
  const sets = { freq: 330, voice: 0, vowel: 0, push: 0.75, attack: 0.03,
    release: 1.1, cutoff: 5060, level: 0.728, gain: 0.216, breath: 0.144,
    vibrato: 0.025, sway: 0.12, vowelSway: 0.6 };
  const n = await note("voice_lead", sets, 1.0);
  const H = hp4k(n.x);
  // AS A TILT, NOT A LEVEL, and that is not a softer claim — it is the only
  // honest one. The amp envelope's own attack (0.03 s here) is ramping through
  // exactly the window the h lives in, so the aspirate is LOUDER IN PROPORTION
  // and quieter in absolute terms. What says "there is an h" is that the first
  // 20 ms is far more air than the note it is in front of.
  const tilt = (s, e) => dB(rms(H, s, e)) - dB(rms(n.x, s, e));
  const head = tilt(n.on, n.on + Math.round(SR * 0.02));
  const body = tilt(n.on + Math.round(SR * 0.4), n.off);
  ok(head - body > 4,
     `the note's first 20 ms is ${(head - body).toFixed(1)} dB more air than its body`,
     "the aspirate at the gate's OPENING is the feature, not the defect");
}

/* ---- B4 · a sustained note is untouched by the round --------------------- */
console.log("\nB4 — the gate-open path is what it was");
{
  // `0.55*gate*(...)` with gate 1 is multiplication by 1.0, which is exact in
  // IEEE-754 — so a voice with NO air of its own is tone while it is sounding
  // and cannot be a whisper, at any release.
  const sets = { freq: 330, voice: 0, vowel: 0, push: 0.75, attack: 0.03,
    release: 1.1, cutoff: 5060, level: 0.728, gain: 0.216, breath: 0,
    vibrato: 0.025, sway: 0.12, vowelSway: 0.6 };
  const n = await note("voice_lead", sets, 1.0);
  const H = hp4k(n.x);
  const air = dB(rms(H, n.on + Math.round(SR * 0.3), n.off));
  const all = dB(rms(n.x, n.on + Math.round(SR * 0.3), n.off));
  ok(air - all < -20,
     `at breath 0 the sustained note is ${(air - all).toFixed(1)} dB of air against its own level`,
     "tone first, air on top");
  const over = tailOverSustain(n);
  ok(over <= TAIL_CEILING,
     `and its tail is ${over >= 0 ? "+" : ""}${over.toFixed(1)} dB on the note`);
}

console.log(`\n${fails ? "FAILED" : "PASSED"} — ${checks - fails}/${checks} checks`);
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
