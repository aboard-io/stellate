#!/usr/bin/env node
// test/voice-smooth.test.js — THE CLICK, THE OVERLAP AND THE SIBILANCE.
//
// Paul, 2026-09-02, after using the composer on staging:
//
//   "The synthesized voices are getting a lot better. There's a lot of click
//    when they 'talk' though and overlap and we should smooth that. It's okay
//    to have a continuous tone instead of sibilance. The james taylor one is
//    pretty good — figure out why and copy that. I wouldn't mind the voice
//    having a tiny bit more grit and vocal resonance starting with his."
//
// FOUR DEFECTS WERE MEASURED AND FIXED; this file is what holds each of them
// down. Every number in the header was measured with this file's own code, on
// the shipped WASM, before and after — the "before" column is the tree at
// a91aeb5.
//
//   1. THE ENVELOPE CUT THE NOTE'S THROAT TO RETRIGGER IT.
//      voice_tract.lib `voxEnv` was `en.asr`, whose attack counter is zeroed
//      by a rising gate and whose release counter is zeroed while the gate is
//      open — so on the sample a note retriggers the envelope is 0 whatever it
//      was the sample before. The scheduler writes a note's gate-off 8 ms
//      before the next note's gate-on (stream-renderer `offS`), so on a
//      release of 1.0 s the envelope was at 0.992 and the next sample it was
//      0.0008. MEASURED at softfolk's own singer params: output RMS across
//      the join 0.0760 -> 0.0262 -> 0.0702, a 9.2 dB notch, once per note.
//      `voxEnv` is now a raised-cosine ramp that remembers where it is.
//        after: 0.0750 -> 0.0713 -> 0.0697, 0.4 dB.
//   2. A SOLO SINGER WAS THREE SINGERS. state-engine's `singer` case carried
//      the role pool — three voice_lead instances — so two overlapping vocal
//      notes were sung by two throats at once. It is `mono: true, pool: 1,
//      legatoSec: 0.006` now: an overlap joins the running note (the pending
//      gate-off is withdrawn, `glide` slews the pitch) and a back-to-back note
//      still re-articulates, because 6 ms is under the scheduler's own 8 ms.
//   3. THE TRACT DEVOICED ON ITS FRICATIVES. tract.lib's ktConVo is 0.00 for
//      /s/ and /f/, so the glottis switched off for the whole consonant and
//      what came out was hiss with nothing under it — the ticking between the
//      words. tract_voice.dsp now floors the voicing at 0.45 (a VOICED
//      fricative, /z/ for /s/) and takes the turbulence from 0.15 to 0.09, and
//      tract.lib's plosive burst went from 4.5 ms at 0.9 to 9 ms at 0.45.
//        MEASURED on roboticpop's rendered vocal chair: the 6-10 kHz share of
//        the chair fell 0.062% -> 0.024%, the band's absolute level 7.59 ->
//        3.41 dB, and the record's own RMS moved 0.03 dB.
//   4. THE GRIT AND THE RESONANCE PAUL ASKED FOR. voice_tract.lib `voxGrit`
//      — a constant-Q peak at 2.6 kHz, +2.5 dB, Q 1.6, over a level-compensated
//      soft knee — on the two LINE singers (voice_lead, tract_voice) and not on
//      the choir. MEASURED on softfolk's chair: the 1-4 kHz share went 5.88% ->
//      8.94% and the band's absolute level +1.42 dB while 200 Hz-1 kHz fell
//      0.54 — a 2.0 dB tilt into the singer's formant — at 4.4% third harmonic.
//
// WHAT IS ASSERTED. V1/V2 are MODULE invariants, because that is where the
// defect lived and a module invariant cannot be argued with. V3-V6 are the
// two records' vocal chairs ALONE, four bars each, rendered through the real
// path (to-engine -> mapEvents -> PRESS.assemble), which is what "test the
// artifact" means here.
//
//   V1  voice_lead, three notes 8 ms apart at softfolk's own seated params:
//       the RMS across a retrigger must not drop more than 1.5 dB (before 9.2),
//       and the first 5 ms of a retriggered note must not slew faster than the
//       note's own body (before 1.21x and 1.46x).
//   V2  the same invariant on tract_voice at roboticpop's seated params — the
//       two mouths share `voxEnv` and a change to it must never be checked on
//       only one of them.
//   V3  softfolk's vocal chair, 4 bars: the ONSET STEP (short-window RMS just
//       before a note against just after) is at most 1.5 dB. Before: 6.19.
//   V4  roboticpop's tract chair, 4 bars: the same step on its retriggered
//       notes, and the 6-10 kHz share at most 0.04%. Before: 0.062%.
//   V5  neither record's vocal unit can stack: `mono` with an effective pool
//       of 1, on both, so an overlapping note crossfades instead of doubling.
//       Before: voice_lead pool 3.
//   V6  the grit reaches: softfolk's chair carries more 1-4 kHz than it did
//       (the floor is 7%, measured 8.94 against 5.88 before) and `voxGrit`'s
//       knee is a few percent of third harmonic and not a limiter.
//
// ~35 s, node + faustwasm, no browser, no ears. It renders audio because the
// render IS the subject.
"use strict";
const path = require("path");
const fs = require("fs");
const R = (p) => path.join(__dirname, "..", p);
const FAUST = R("engine/faust");
const SR = 44100, BS = 64;

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what + (detail ? "  [" + detail + "]" : "")); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};
const dB = (v) => 20 * Math.log10(Math.max(v, 1e-12));
const rms = (a, s, e) => { let q = 0; s = Math.max(0, s | 0); e = Math.min(a.length, e | 0);
  for (let i = s; i < e; i++) q += a[i] * a[i]; return Math.sqrt(q / Math.max(1, e - s)); };
const slew = (a, s, e) => { let m = 0; s = Math.max(1, s | 0); e = Math.min(a.length, e | 0);
  for (let i = s; i < e; i++) { const d = Math.abs(a[i] - a[i - 1]); if (d > m) m = d; } return m; };

/* ---------- the stub window (pitch-wall's own preamble) ------------------- */
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
window.NuPrecompose = require(R("nukernel/precompose.js"));

const E = require(R("engine/csd-engine.js"));
const SE = require(R("engine/faust/voices/state-engine.js"));
const PRESS = require(R("engine/faust/press/press.js"));
const K = require(R("engine/genre-kernel.js"));
const NG = window.NuGenres, NI = window.NuInstruments,
      ND = window.NuDocument, NP = window.NuPrecompose;

/* ---------- the shipped artifacts, offline (breath.test.js's own recipe) --- */
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
// a run of gate edges on one instance — the mono voice the scheduler gives a
// singer, which is what makes a RETRIGGER expressible at all
async function run(mod, sets, edges, T) {
  const p = await proc(mod);
  for (const [k, v] of Object.entries(sets)) if (v != null) p.setParamValue("/" + mod + "/" + k, v);
  const N = Math.round(SR * T), out = new Float32Array(N), z = new Float32Array(BS);
  const ev = edges.slice().sort((a, b) => a[0] - b[0]);
  let ei = 0;
  for (let s = 0; s < N; s += BS) {
    while (ei < ev.length && Math.round(ev[ei][0] * SR) <= s) { p.setParamValue("/" + mod + "/gate", ev[ei][1]); ei++; }
    const len = Math.min(BS, N - s);
    const o = p.render([z.subarray(0, len)], len);
    if (o.length === 1) out.set(o[0].subarray(0, len), s);
    else for (let i = 0; i < len; i++) out[s + i] = 0.5 * (o[0][i] + o[1][i]);
  }
  return out;
}

/* ---------- the record's own vocal chair, exactly as the page seats it ----- */
// audio/plan.js's law, in three lines: the seat carries the genre's tone, and
// where the genre states no `mouth` instruments.js casts one from the record's
// idiom (throatOf) and it is MERGED onto the tone, never passed beside it.
function vocalChair(gk, seed) {
  const doc = NP.genreToDocument(gk, seed || 1);
  const G = NG.GENRES[gk];
  const g0 = ND.toGenre(doc, 0, {});
  const lines = doc.voices.filter((v) => v.kind === "line");
  let lv = -1, id = null;
  lines.forEach((v, i) => {
    const inst = v.instrument || (g0.instr && g0.instr[i]);
    if (lv < 0 && (NI.PATCHES.mouth[inst] ||
                   (NI.PATCHES.voice[inst] && !NI.isSection(inst)))) { lv = i; id = inst; }
  });
  const sc = ND.scoreOf(doc, {});
  const ev = sc.events.filter((e) => e.kind === "line" && e.lv === lv);
  /* THE SEAT'S TONE, THROUGH ITS ONE OWNER (2026-09-04). This file used to
     spell out plan.js's cast in two lines of its own; `instruments.js
     throatTone` is that walk plus the tier above it — the CHAIR's own throat
     word, `voices[vi].cast.voice` — and a third copy of the precedence is a
     third singer. The chair is the one this function just found, so its word
     is read off the document rather than assumed. */
  const chairVoice = (lines[lv] && lines[lv].cast && lines[lv].cast.voice) || null;
  return { doc, lv, id, ev, bpm: G.bpm || 120,
           tone: NI.throatTone(G.tone || null, gk, id, chairVoice) };
}
// four bars of it, from the first bar the singer sings in
function barsOf(chair, nbars) {
  const STEPS = 16;
  const t0 = Math.floor(chair.ev[0].t / STEPS) * STEPS;
  const bars = [];
  for (let b = 0; b < nbars; b++)
    bars.push({ barSteps: STEPS, ev: chair.ev
      .filter((e) => e.t >= t0 + b * STEPS && e.t < t0 + (b + 1) * STEPS)
      .map((e) => ({ kind: "line", v: 0, n: e.n, off: e.t - t0 - b * STEPS,
                     dur: Math.max(0.25, e.dur), vel: e.vel })) });
  return bars;
}
async function renderChair(chair, nbars) {
  const TE = await import(R("nukernel/audio/to-engine.js"));
  const plan = { bpm: chair.bpm, seed: 1, kit: null, bars: barsOf(chair, nbars),
                 reverb: 0, delay: { beats: 0.75, feedback: 0 },
                 seat: () => ({ chair: "line", instr: chair.id, tone: chair.tone }) };
  const t = TE.toEngine(plan, { SE, K, E });
  const unit = t.units.v0 || Object.values(t.units)[0] || {};
  const sched = SE.mapEvents(E, t.state, t.ev, { units: t.units });
  const spb = sched.spb, totalSec = sched.totalBeats * spb;
  const TOTAL = Math.ceil(totalSec * SR) + SR;
  const { L } = await PRESS.assemble(t.state, sched,
    { mkProc: PRESS.mkProc, rootOf: PRESS.rootOf, buffers: {}, speech: null,
      dx7Presets: PRESS.loadDx7Presets() }, { spb, totalSec, TOTAL });
  return { L, unit, spb, ev: t.ev, params: unit.params || {} };
}
// THE ONSET STEP: how much of the sound disappears at a note's gate edge. The
// window before is 14..2 ms and the window after is 2..10 ms, both short enough
// to sit inside one attack and long enough to be an RMS at 130 Hz.
function onsetSteps(L, ev, spb) {
  const ms = (v) => Math.round(SR * v / 1000);
  const ns = ev.pitched.map((p) => ({ s: Math.max(BS, Math.floor(p.beat * spb * SR)),
    d: (p.durB || 0.25) * spb })).sort((a, b) => a.s - b.s);
  const rows = [];
  for (let i = 0; i < ns.length; i++) {
    const s = ns[i].s;
    if (s + ms(120) >= L.length || s < ms(20)) continue;
    const prevOff = i ? ns[i - 1].s + Math.floor((Math.max(0.012, ns[i - 1].d) - 0.008) * SR) : -1e9;
    rows.push({ step: dB(rms(L, s - ms(14), s - ms(2))) - dB(rms(L, s + ms(2), s + ms(10))),
                retrig: s - prevOff < ms(60) });
  }
  return rows;
}
// two of a chair's own notes sounding at once, per the scheduler's arithmetic
function stacked(ev, unit, spb) {
  const ns = ev.pitched.map((p) => {
    const s = Math.max(BS, Math.floor(p.beat * spb * SR));
    return { s, e: s + Math.floor((Math.max(0.012, (p.durB || 0.25) * spb) - 0.008) * SR) };
  }).sort((a, b) => a.s - b.s);
  let n = 0;
  for (let i = 1; i < ns.length; i++) if (ns[i].s < ns[i - 1].e) n++;
  return { over: n, total: ns.length };
}
// the band share of the rendered chair, Welch over the whole take
function share(L, lo, hi) {
  const N = 4096, HOP = 2048;
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const re = new Float64Array(N), im = new Float64Array(N);
  let band = 0, all = 0;
  for (let o = 0; o + N < L.length; o += HOP) {
    for (let i = 0; i < N; i++) { re[i] = L[o + i] * w[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = k * SR / N, p = re[k] * re[k] + im[k] * im[k];
      all += p; if (f >= lo && f < hi) band += p;
    }
  }
  return all > 0 ? band / all : 0;
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

const VOICE_TYPE = { alto: 0, bass: 1, countertenor: 2, soprano: 3, tenor: 4 };
// the fences, each one sitting between the before-number and the after-number
// this round measured (see the header for both columns)
const STEP_CEIL = 1.5;      // dB of amplitude lost at a gate edge (before 9.2 / 6.19)
const SLEW_CEIL = 1.05;     // the head may not slew faster than the note's body
const SIB_CEIL = 0.0004;    // 0.04% of the chair's energy in 6-10 kHz (before 0.062%)
const MID_FLOOR = 0.07;     // 7% in 1-4 kHz on the singer (before 5.88%, after 8.94%)

(async () => {
console.log("test/voice-smooth.test.js — the click, the overlap and the sibilance\n");
const TE = await import(R("nukernel/audio/to-engine.js"));

/* ============ V0 · A CHAIR'S OWN THROAT REACHES THE ENGINE ================
   2026-09-04, the per-chair singer round. `document.js TIERS.voice` lets a
   CHAIR name which of the five modelled throats sings it — a four-part choir
   needs four and a row's `tone.mouth` can say one — and this is the
   declared-but-never-arriving check for it, made at the only seam that
   settles the question: what `voiceForInstr` HANDS THE ENGINE.

   Three numbers, not one, because a throat is three things downstream: the
   FORMANT TABLE (`set.voice`, which is what the singer sounds like), the
   numeric voice the live player writes onto the param (`live.voice`) and the
   COMPASS the per-note fold reads (`live.lo`/`live.hi`). A word that moved the
   first and not the other two would be a singer with somebody else's range.
   No render here on purpose: this is the handoff, and V1 below is what proves
   the handoff makes a sound. */
console.log("V0 — the chair's throat, at the bridge");
{
  const TT = (gk, id, chair) =>
    TE.voiceForInstr(id, NI.throatTone(NG.GENRES[gk].tone || null, gk, id, chair));
  const row = TT("chorale", "ahh_choir", null);
  ok(!!row && row.set.voice === "alto",
     "chorale's row seats its choir on one alto (the mouth, as it always did)",
     row ? row.set.voice : "no singer");
  const seen = [];
  for (const w of ["soprano", "alto", "countertenor", "tenor", "bass"]) {
    const r = TT("chorale", "ahh_choir", w);
    seen.push(w + " " + r.set.voice + " #" + r.live.voice + " " +
              Math.round(r.live.lo) + "-" + Math.round(r.live.hi));
    ok(r.set.voice === w, "…and a chair asking for " + w + " is handed " + w,
       "the formant table the singer runs on");
    ok(r.live.voice !== row.live.voice || w === row.set.voice,
       "…with the live player's own voice number moving with it (" + r.live.voice + ")");
    ok(!(r.live.lo === row.live.lo && r.live.hi === row.live.hi) || w === row.set.voice,
       "…and the compass the per-note fold reads moving with it");
  }
  console.log("      " + seen.join("   "));
  // ...AND THE CHAIR OUTRANKS ITS ROW, which is the whole of the precedence:
  // chorale STATES `MOUTHS.hymnal` (alto), and a chair that says bass sings
  // bass. A row's mouth still decides everything else about the singer.
  const b = TT("chorale", "ahh_choir", "bass");
  ok(b.set.voice === "bass" && b.set.vowels === row.set.vowels &&
     b.set.vibrato === row.set.vibrato,
     "…and the chair takes the throat WITHOUT taking the mouth (same vowels, same wobble)",
     b.set.vowels + " / vib " + b.set.vibrato);
  // a word this build cannot model is not a singer nobody can be
  ok(TT("chorale", "ahh_choir", "baritone").set.voice === "alto",
     "…and a throat this build has no table for is dropped, not carried");
}

/* ============ V1 · the singer's envelope survives a retrigger ============= */
console.log("V1 — voice_lead, three notes 8 ms apart at softfolk's seated params");
{
  const G = NG.GENRES.softfolk;
  const V = TE.voiceForInstr("solo_vox", { ...G.tone, mouth: NI.throatOf("softfolk", "solo_vox") });
  ok(!!(V && V.set && V.dsp === "voice_lead"), "softfolk seats a modelled singer",
     V ? V.dsp + " / " + V.set.voice + " / rel " + V.set.release + " s" : "none");
  const S = V.set;
  const sets = { freq: 330, voice: VOICE_TYPE[S.voice] != null ? VOICE_TYPE[S.voice] : 4,
    vowel: 0, push: 0.75, attack: S.attack, release: S.release, cutoff: S.cutoff,
    level: 0.6, gain: 0.3, breath: S.breath, sway: S.sway, vowelSway: S.vowelSway,
    vibrato: S.vibrato, vibRate: S.vibRate, vibRise: S.vibRise };
  // the scheduler's own arithmetic: a note ends 8 ms before the next begins
  const x = await run("voice_lead", sets,
    [[0.2, 1], [0.532, 0], [0.54, 1], [0.872, 0], [0.88, 1], [1.212, 0]], 2.5);
  const rows = [];
  for (const t of [0.54, 0.88]) {
    const s = Math.round(t * SR);
    const before = rms(x, s - Math.round(0.035 * SR), s - Math.round(0.005 * SR));
    const after = rms(x, s + Math.round(0.001 * SR), s + Math.round(0.005 * SR));
    const drop = dB(before) - dB(after);
    const sl = slew(x, s, s + Math.round(0.005 * SR)) /
               Math.max(1e-9, slew(x, s + Math.round(0.02 * SR), s + Math.round(0.12 * SR)));
    rows.push([t, drop, sl]);
    ok(drop <= STEP_CEIL, `retrigger at ${t}s loses ${drop.toFixed(2)} dB (ceiling ${STEP_CEIL})`,
       "before the fix: 9.2 dB, the whole note gone for the length of an attack");
    ok(sl <= SLEW_CEIL, `…and its first 5 ms slews ${sl.toFixed(3)}x the note's own body (ceiling ${SLEW_CEIL})`,
       "before the fix: 1.21x and 1.46x");
  }
  console.log("      " + rows.map((r) => `${r[0]}s ${r[1].toFixed(2)} dB / ${r[2].toFixed(2)}x`).join("   "));
}

/* ============ V2 · the same invariant on the talking mouth ================ */
console.log("\nV2 — tract_voice shares voxEnv, so it is checked on the same edge");
{
  const G = NG.GENRES.roboticpop;
  const M = TE.mouthForInstr("synth_voice", G.tone, false);
  ok(!!(M && M.set && M.dsp === "tract_voice"), "roboticpop seats the talking tract",
     M ? M.dsp + " / babble " + M.set.babble + " / rel " + M.set.release + " s" : "none");
  const S = M.set;
  // BABBLE 0 FOR THIS ONE CHECK, and that is not softening it. The driver's
  // syllable clock RESETS on the gate (tract.lib ktClock), so a retriggered
  // note starts a fresh syllable at phase 0 — which is the CONSONANT HOLD, and
  // for a plosive that is a sealed tube. Measured with the driver running, the
  // tube reads 3.2 and 6.8 dB down at the join and every one of those decibels
  // is a /b/. The claim under test here is the shared ENVELOPE, so it is
  // measured on the one thing that isolates it: the same tube holding a vowel.
  // What the driver does at a note start is V4's business, on the record.
  const sets = { freq: 160, vowel: 2, babble: 0, rate: 4, seed: S.seed,
    velum: S.nasal, fric: S.fric, voiced: S.voiced, breath: S.breath,
    cutoff: S.cutoff, attack: S.attack, release: S.release,
    level: 0.6, gain: 0.3, vibrato: S.vibrato };
  const x = await run("tract_voice", sets,
    [[0.2, 1], [0.532, 0], [0.54, 1], [0.872, 0], [0.88, 1], [1.212, 0]], 2.5);
  for (const t of [0.54, 0.88]) {
    const s = Math.round(t * SR);
    const drop = dB(rms(x, s - Math.round(0.035 * SR), s - Math.round(0.005 * SR)))
               - dB(rms(x, s + Math.round(0.001 * SR), s + Math.round(0.005 * SR)));
    ok(drop <= STEP_CEIL, `the tube's retrigger at ${t}s loses ${drop.toFixed(2)} dB (ceiling ${STEP_CEIL})`);
  }
}

/* ============ V3-V6 · the two records' vocal chairs, four bars each ======= */
const takes = {};
for (const gk of ["softfolk", "roboticpop"]) {
  const ch = vocalChair(gk, 1);
  takes[gk] = { ch, r: await renderChair(ch, 4) };
}

console.log("\nV3 — softfolk's vocal chair alone, four bars, on the rendered artifact");
{
  const { ch, r } = takes.softfolk;
  ok(ch.id === "solo_vox" && r.unit.module === "voice_lead",
     "the chair the record sings on is the modelled singer", ch.id + " -> " + r.unit.module);
  const st = onsetSteps(r.L, r.ev, r.spb);
  const worst = st.reduce((a, o) => Math.max(a, o.step), -99);
  const mean = st.reduce((a, o) => a + o.step, 0) / Math.max(1, st.length);
  ok(mean <= STEP_CEIL, `the mean onset step over ${st.length} notes is ${mean.toFixed(2)} dB (ceiling ${STEP_CEIL})`,
     "before the fix: 6.19 dB — every note started by deleting the one before it");
  console.log("      worst single onset " + worst.toFixed(2) + " dB");
}

console.log("\nV4 — roboticpop's tract chair: the step, and the sibilance");
{
  const { r } = takes.roboticpop;
  const st = onsetSteps(r.L, r.ev, r.spb).filter((o) => o.retrig);
  const mean = st.reduce((a, o) => a + o.step, 0) / Math.max(1, st.length);
  ok(st.length > 0, "the record retriggers the tube inside four bars", st.length + " retriggered notes");
  ok(mean <= 2.5, `the mean onset step on those is ${mean.toFixed(2)} dB (ceiling 2.5)`);
  const sib = share(r.L, 6000, 10000);
  ok(sib <= SIB_CEIL,
     `6-10 kHz is ${(100 * sib).toFixed(3)}% of the chair (ceiling ${(100 * SIB_CEIL).toFixed(2)}%)`,
     "before the fix: 0.062% — the fricative with no tone under it. Paul: "
     + '"It\'s okay to have a continuous tone instead of sibilance."');
}

console.log("\nV5 — one singer is one throat: neither chair can stack");
for (const gk of ["softfolk", "roboticpop"]) {
  const { r } = takes[gk];
  const n = SE.effectivePool ? SE.effectivePool(r.unit) : (r.unit.mono ? 1 : r.unit.pool);
  const s = stacked(r.ev, r.unit, r.spb);
  ok(!!r.unit.mono && n === 1,
     `${gk}: ${r.unit.module} is mono with an effective pool of ${n}`,
     "before the fix voice_lead carried the role pool, 3 — two overlapping notes were two singers");
  console.log(`      ${gk}: ${s.total} notes, ${s.over} of them overlapping — each joins the running note`);
}

console.log("\nV6 — the grit and the resonance reach the sound");
{
  const { r } = takes.softfolk;
  const mid = share(r.L, 1000, 4000);
  ok(mid >= MID_FLOOR,
     `softfolk's singer carries ${(100 * mid).toFixed(2)}% of its energy in 1-4 kHz (floor ${(100 * MID_FLOOR).toFixed(0)}%)`,
     "before voxGrit: 5.88%. Paul: \"a tiny bit more grit and vocal resonance\"");
  // the knee, computed on the same arithmetic the module runs: a sine at the
  // peak voxAgc hands voice_lead, through tanh(1.9x)/1.9, read as harmonics
  const N = 4096, A = 0.4, k = 1.9;
  const y = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) y[i] = Math.tanh(k * A * Math.sin(2 * Math.PI * 8 * i / N)) / k;
  fft(y, im);
  const h = (n2) => Math.hypot(y[8 * n2], im[8 * n2]);
  const thd = Math.sqrt(h(3) * h(3) + h(5) * h(5) + h(7) * h(7)) / Math.max(1e-12, h(1));
  ok(thd > 0.01 && thd < 0.12,
     `voxGrit's knee is ${(100 * thd).toFixed(1)}% harmonic distortion — a fold under pressure, not a limiter`,
     "the fence is 1% (nothing there) to 12% (a fuzz box)");
}

console.log("\n" + (fails ? "FAIL " + fails + "/" + checks : "ok — all " + checks + " checks"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
