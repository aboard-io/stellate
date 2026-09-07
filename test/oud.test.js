#!/usr/bin/env node
/* test/oud.test.js — THE OUD, MEASURED (2026-09-07, the oud round).
 *
 * scratch/genre-qa/AUDIT-2026-09.md finding 14 counted eleven catalogue rows —
 * 705 to 1819 — whose own description names an oud, a lute, a vihuela or a
 * pipa and whose chair plays a `nylon_string_guitar`, because the library has
 * none of them and cannot get one by sampling: every soundfont in this tree is
 * GM bank 0, and its nearest plucked lutes are the sitar (104), the shamisen
 * (106) and the koto (107). The audit's decision was to NAME the gap rather
 * than approximate it. Paul, shown the count: "Do the Faust oud it's just a
 * little code." engine/faust/dsp/oud.dsp is that code and this file is the
 * measurement that says whether it is an instrument or a costume. Every number
 * comes out of the REAL dist/oud-module.wasm, the artifact the page loads.
 *
 *   O1  IT PLAYS THE NOTE IT IS ASKED FOR. Rendered across the instrument's
 *       own compass and past it — MIDI 36 (C2, the lowest course of the ZIM's
 *       "C2 F2 A2 D3 G3 C4") to 84 — the heard fundamental is within a few
 *       cents of the written pitch, by AUTOCORRELATION rather than by the
 *       loudest bin, because the loudest partial of a near-bridge pluck is
 *       often the third. This is the check that caught gtr_amp at +37 cents,
 *       and it is the check that caught THIS file's first draft: the course
 *       was written as 0 and +8 cents rather than ±4, so the whole instrument
 *       measured 2.1 cents sharp.
 *   O2  IT IS DARKER IN THE BODY AND BRIGHTER IN THE ATTACK than the chair it
 *       replaces, and both halves are measured against the real thing — the
 *       shipped `nylon_string_guitar` recipe on stk_guitar, compiled here, at
 *       the same pitch and the same velocity.
 *       (a) DARKER: the body-window spectral centroid, and the share of the
 *           note's energy under 400 Hz, across the oud's own six courses.
 *       (b) BRIGHTER IN THE ATTACK: the risha, isolated — the same module at
 *           `risha` 0 (a fingertip) and 0.8 (a filed quill), which is the only
 *           honest way to measure a plectrum, because the guitar chair's
 *           brightness is a magnetic pickup with a +4 dB peak at 3 kHz and a
 *           speaker cabinet, and an oud has neither.
 *   O3  IT IS A COURSE, NOT A CHORUS. Two strings 8 cents apart beat at a
 *       frequency arithmetic can predict; a chorus does not. The measured beat
 *       rate must match f0*(2^(c/2400) - 2^(-c/2400)) at three pitches and two
 *       detunings, the modulation must be DEEP (a real null, not a wobble),
 *       and at `course` 0 there must be no beating at all.
 *   O4  THE SLIDE IS A HAND (rewritten 2026-09-07, the laser-beam round —
 *       Paul: *"a very 'laser beam' sound when it bends tones … maybe it's
 *       taking the note bends too slow? Or it's missing the scratch sound of a
 *       proper player."*). The old O4 held one gate open, moved `freq` a
 *       fourth underneath it and asserted the pitch was between the two and
 *       rising. It passed while he was hearing this, because it never asked
 *       whether the bend ARRIVES, never tested an interval wider than the one
 *       a hand can reach, and tested a LEGATO bend, which this engine cannot
 *       produce for a pooled module. Four claims replace it, and every one of
 *       them is rendered through `twoNote` — a second PLUCK on the same pool
 *       voice, written the way press/render-core.js writes it:
 *       (a) `glide` IS THE TIME THE NOTE ARRIVES, in tune, to inside the
 *           6-cent JND, at three intervals and two times, monotone, with no
 *           overshoot three times later. It used to be a `tau2pole` TIME
 *           CONSTANT: 45 ms on the slider was a ~200 ms droop.
 *       (b) A LEAP IS RE-PLUCKED, NOT SWEPT. The census over the nine rows
 *           that seat the instrument (12% of moves wider than a fourth, the
 *           widest fourteen semitones, and ZERO notes marked `sld`), and the
 *           `glide` the bridge actually writes per note, read off mapEvents.
 *       (c) THE BEND SCRATCHES, and a note that has arrived does not: the
 *           travel's energy above 2 kHz, its RMS, the settled note 300 ms
 *           later, and the `lute` bit-identical with the feature at 0 and 1.
 *       (d) EVERY INTERVAL THE CATALOGUE PLAYS IS IN TUNE 90 ms after the
 *           strike, at the glide the engine itself wrote for it.
 *   O5  IT IS AN INSTRUMENT, NOT A FADER. Loudness is monotone in the
 *       plectrum's force and the force moves the SPECTRUM. A narrower swing
 *       than the guitar's is expected and argued (a fingertip changes shape
 *       with force; a piece of filed plastic does not), so the floor is that
 *       it moves at all and the ceiling is the guitar's.
 *   O6  THE MODEL BECOMES A UNIT A CHAIR CAN REACH, and it arrives DRY: the
 *       parent builds an `oud` unit with the instrument's compass and the
 *       slide door, every param it writes is one the compiled module actually
 *       has, and a nukernel chair seated on `oud` routes `patch:oud>oud`
 *       rather than `unrouted`. A dsp nobody can play is this box's own
 *       characteristic bug.
 *   O7  IT IS SEATED WHERE IT IS DECLARED. The eight rows the audit named that
 *       this round re-seated actually cast it, the three it refused actually
 *       do not, and every seat resolves to the model rather than to a sampler.
 *
 * RUN:  node test/oud.test.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const R = (p) => path.join(__dirname, "..", p);
const FAUST = R("engine/faust");
const SR = 44100, BS = 128;

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };

/* ---------- spectrum ------------------------------------------------------ */
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
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
function spec(x, off, N) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const s = off + i < x.length ? x[off + i] : 0;
    re[i] = s * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  }
  fft(re, im);
  const m = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) m[k] = Math.hypot(re[k], im[k]);
  return m;
}
function centroid(x, off, N) {
  const m = spec(x, off, N); let a = 0, b = 0;
  for (let k = 1; k < m.length; k++) { const f = k * SR / N; if (f > 12000) break; a += f * m[k]; b += m[k]; }
  return b ? a / b : 0;
}
/** share of the frame's energy above `hz`, in percent. */
function above(x, off, N, hz) {
  const m = spec(x, off, N); let a = 0, b = 0;
  for (let k = 1; k < m.length; k++) { const e = m[k] * m[k]; b += e; if (k * SR / N >= hz) a += e; }
  return b ? 100 * a / b : 0;
}
/** magnitude at one frequency (goertzel-ish single-bin DFT), hann-windowed. */
function magAt(x, off, N, f) {
  let re = 0, im = 0;
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const a = 2 * Math.PI * f * i / SR;
    const s = (off + i < x.length ? x[off + i] : 0) * w;
    re += s * Math.cos(a); im -= s * Math.sin(a);
  }
  return Math.hypot(re, im) / N;
}
const rms = (x, a, b) => { let s = 0; const B = Math.min(b | 0, x.length);
  for (let i = a | 0; i < B; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, B - (a | 0))); };

/* f0 by AUTOCORRELATION, not by the loudest bin — the loudest partial of a
   near-bridge pluck is very often the third, and a "pitch" measurement that
   reported the third partial would call a tuning error a pass. Lifted in
   behaviour from engine/faust/build/measure-instrument.js, octave guard and
   parabolic refinement included. */
function f0Of(x, off, N, lo, hi) {
  const seg = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) { seg[i] = off + i < x.length ? x[off + i] : 0; mean += seg[i]; }
  mean /= N;
  for (let i = 0; i < N; i++) seg[i] -= mean;
  const minLag = Math.max(2, Math.floor(SR / hi)), maxLag = Math.min(N - 2, Math.ceil(SR / lo));
  let r0 = 0; for (let i = 0; i < N; i++) r0 += seg[i] * seg[i];
  if (r0 <= 0) return 0;
  let best = -1, bl = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0, e = 0;
    for (let i = 0; i + lag < N; i++) { s += seg[i] * seg[i + lag]; e += seg[i + lag] * seg[i + lag]; }
    const nrm = e > 0 ? s / Math.sqrt(r0 * e) : 0;
    if (nrm > best) { best = nrm; bl = lag; }
  }
  if (bl < 2 || best < 0.15) return 0;
  for (const d of [3, 2]) {
    const lag = Math.round(bl / d); if (lag < minLag) continue;
    let s = 0, e = 0;
    for (let i = 0; i + lag < N; i++) { s += seg[i] * seg[i + lag]; e += seg[i + lag] * seg[i + lag]; }
    const nrm = e > 0 ? s / Math.sqrt(r0 * e) : 0;
    if (nrm >= best * 0.9) { bl = lag; break; }
  }
  const at = (lag) => { let s = 0; for (let i = 0; i + lag < N; i++) s += seg[i] * seg[i + lag]; return s; };
  const a = at(bl - 1), b = at(bl), c = at(bl + 1), d2 = a - 2 * b + c;
  return SR / (d2 !== 0 ? bl + 0.5 * (a - c) / d2 : bl);
}
const cents = (f, ref) => 1200 * Math.log2(f / ref);
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

(async () => {
console.log("test/oud.test.js — a fretless course on a deep wooden box\n");

const { FaustMonoDspGenerator, instantiateFaustModuleFromFile, LibFaust, FaustCompiler } =
  await import(path.join(FAUST, "node_modules/@grame/faustwasm/dist/esm/index.js"));
const gen = new FaustMonoDspGenerator();

/* THE SHIPPED ARTIFACT, not a fresh compile: what the page loads is what is
   measured, which is the whole reason erhu.test.js reads dist/ too. */
async function factoryOf(name) {
  const code = fs.readFileSync(path.join(FAUST, "dist", name + "-module.wasm"));
  return { cfactory: 0, code: new Uint8Array(code),
    module: await WebAssembly.compile(code),
    json: fs.readFileSync(path.join(FAUST, "dist", name + "-meta.json"), "utf8"), poly: false };
}
async function render(name, params, secs, hold, mid) {
  const f = await factoryOf(name);
  const proc = await gen.createOfflineProcessor(SR, BS, f);
  const set = (k, v) => proc.setParamValue("/" + name + "/" + k, v);
  for (const [k, v] of Object.entries(params)) set(k, v);
  const T = Math.floor(SR * secs), out = new Float32Array(T), holdN = Math.floor(SR * hold);
  /* ONE BLOCK OF SILENCE FIRST, AND IT IS NOT A DETAIL. Every param above is
     written before a sample is rendered, but `sfreq` is a SIGNAL that starts
     at zero and slews to the slider, so a gate in the very first block strikes
     a string whose length is still arriving. Both the excitation burst's
     duration and the pluck comb's delay are `SR/sfreq` read AT THE STRIKE, so
     that made O2 and O5 partly measurements of the pitch smoother's settling
     rather than of the instrument, and the smoother is exactly what the slide
     round changed. The renderer does not do this — press/render-core.js writes
     every param one block BEFORE the gate (`[s - BS, ...]`) — so priming here
     is what makes this bench the engine's case. The discarded block is not in
     `out`, so every offset below still counts from the strike. */
  proc.render([], BS);
  let gated = false, did = false;
  for (let s = 0; s < T; s += BS) {
    if (!gated) { set("gate", 1); gated = true; }
    if (gated && s >= holdN && s - BS < holdN) set("gate", 0);
    if (mid && !did && s >= Math.floor(SR * mid.at)) {
      for (const [k, v] of Object.entries(mid.set)) set(k, v);
      did = true;
    }
    const len = Math.min(BS, T - s);
    out.set(proc.render([], len)[0].subarray(0, len), s);
  }
  return out;
}

/* TWO NOTES ON ONE POOL VOICE, WRITTEN THE WAY THE RENDERER WRITES THEM, and
   this is the bench the old O4 did not have. press/render-core.js puts every
   param change at `s - BS` and the gate at `s`, and it takes the gate DOWN
   8 ms before the next note ("s + (dur - 0.008)"), so a second note on the
   same voice is a fresh PLUCK whose pitch is already travelling when the quill
   lands. The old gate held one gate open and moved `freq` underneath it — a
   legato bend, which this engine cannot produce for this module (press groups
   legato only for `mono` units and the oud is pooled at 3), so it measured the
   one case that never happens. */
async function twoNote(name, params, m1, m2, t1, t2, glide2) {
  const f = await factoryOf(name);
  const proc = await gen.createOfflineProcessor(SR, BS, f);
  const set = (k, v) => proc.setParamValue("/" + name + "/" + k, v);
  for (const [k, v] of Object.entries(params)) set(k, v);
  set("freq", midiHz(m1));
  const T = Math.floor(SR * (t1 + t2)), out = new Float32Array(T);
  const g2 = Math.floor(SR * t1), off1 = g2 - Math.floor(SR * 0.008);
  let stage = 0;
  proc.render([], BS);                       // prime: see `render` above
  for (let s = 0; s < T; s += BS) {
    if (stage === 0) { set("gate", 1); stage = 1; }
    else if (stage === 1 && s >= off1) { set("gate", 0); stage = 2; }
    else if (stage === 2 && s >= g2 - BS) {
      set("freq", midiHz(m2));
      if (glide2 != null) set("glide", glide2);
      stage = 3;
    } else if (stage === 3 && s >= g2) { set("gate", 1); stage = 4; }
    const len = Math.min(BS, T - s);
    out.set(proc.render([], len)[0].subarray(0, len), s);
  }
  return { x: out, g2 };
}
/** the pitch `ms` after the second note's strike, in cents from its target. */
const bendAt = (x, g2, ms, m1, m2) => {
  const lo = Math.min(midiHz(m1), midiHz(m2)) * 0.85, hi = Math.max(midiHz(m1), midiHz(m2)) * 1.2;
  const f = f0Of(x, g2 + Math.floor(SR * ms / 1000), 2048, lo, hi);
  return f ? cents(f, midiHz(m2)) : NaN;
};

/* THE REFERENCE IS THE CHAIR THESE ROWS WERE ACTUALLY PLAYING — stk_guitar
   driven by instruments.js' own `nylon_string_guitar` recipe, read out of that
   file rather than retyped, so the comparison cannot go stale the day somebody
   re-voices the nylon top. */
const NYLON = (() => {
  const NI = require(R("nukernel/instruments.js"));
  const P = NI.PATCHES ? NI.PATCHES.model.nylon_string_guitar : null;
  const M = { cab: 6760, mcut: 7800, rel: 0.3 };   // the recipe's own M, mid tone
  const set = P ? P.set(M) : { drive: 0, pluckPos: 0.36, pickup: 0.44, bright: 0.24,
                               ring: 3.2, cutoff: 5200, release: 0.3 };
  return { ...set, glide: 0, gain: 0.3, level: 0.5 };
})();

const OUDNOTES = [36, 48, 60, 72, 84];
const SIG = {}, NYL = {};
for (const m of OUDNOTES) {
  SIG[m] = await render("oud", { freq: midiHz(m), glide: 0, pick: 0.5 }, 2.5, 1.0);
  NYL[m] = await render("stk_guitar", { ...NYLON, freq: midiHz(m), pick: 0.5 }, 2.5, 1.0);
}
console.log("       rendered: 5 oud notes, 5 nylon-guitar notes at the same pitch and pick\n");

/* ---- O1 it plays the note it is asked for ------------------------------- */
ok("O1 intonation: within 2 cents from MIDI 36 to 84, with no fitted correction", () => {
  const rows = [];
  for (const m of OUDNOTES) {
    const want = midiHz(m);
    const heard = f0Of(SIG[m], Math.floor(SR * 0.15), 8192, want * 0.45, want * 2.2);
    assert.ok(heard > 0, "MIDI " + m + ": no pitch found at all");
    const c = cents(heard, want);
    assert.ok(Math.abs(c) < 2.0,
      "MIDI " + m + " (" + want.toFixed(1) + " Hz): heard " + heard.toFixed(1) +
      " Hz, " + c.toFixed(2) + " cents off");
    rows.push("MIDI " + m + " " + c.toFixed(2) + "c");
  }
  console.log("       " + rows.join("  ·  "));
});

/* ---- O2 darker in the body, brighter in the attack ---------------------- */
const BOFF = Math.floor(SR * 0.35), BW = 8192, AW = 1024;
ok("O2a darker than the nylon chair across the oud's own six courses (C2..C4)", () => {
  const rows = [];
  for (const m of [36, 48, 60]) {
    const co = centroid(SIG[m], BOFF, BW), cn = centroid(NYL[m], BOFF, BW);
    assert.ok(co < cn, "MIDI " + m + ": oud centroid " + co.toFixed(0) +
      " Hz is NOT under the nylon chair's " + cn.toFixed(0));
    rows.push("MIDI " + m + " " + co.toFixed(0) + " vs " + cn.toFixed(0) + " Hz");
  }
  // …and the DEEP BOX, where the difference is largest: energy under 400 Hz
  const lo = 100 - above(SIG[36], BOFF, BW, 400), ln = 100 - above(NYL[36], BOFF, BW, 400);
  assert.ok(lo > ln * 1.5, "at MIDI 36 the oud puts " + lo.toFixed(1) +
    "% of the note under 400 Hz against the nylon chair's " + ln.toFixed(1) + "%");
  console.log("       centroid " + rows.join(" · ") +
    "   ·   <400 Hz at MIDI 36: oud " + lo.toFixed(1) + "% / nylon " + ln.toFixed(1) + "%");
  /* WHAT IS NOT ASSERTED, AND WHY. At MIDI 72 the oud measures BRIGHTER than
     the nylon chair (about 800 Hz against 650). That is the near-bridge risha:
     the feedforward comb one pluck-position down the string peaks at the third
     partial where the guitar recipe's 0.36 peaks at the first, so up at the
     top of a fretless neck the oud is the more nasal of the two — which is
     what a plectrum played up there actually sounds like. MIDI 72 is above
     every open course the instrument has (the top is C4 = 60), so it is not
     part of this claim, and it is written down rather than quietly excluded. */
});
/* O2b needs its own renders (the same note at two plectrums), so the work
   happens here and the assertion is made on the numbers it produces. */
{
  const rows = [];
  let worst = Infinity, worstHF = Infinity;
  for (const m of [48, 60, 72]) {
    const f = midiHz(m);
    const quill = await render("oud", { freq: f, glide: 0, pick: 0.5, risha: 0.8 }, 1.5, 1.0);
    const finger = await render("oud", { freq: f, glide: 0, pick: 0.5, risha: 0.0 }, 1.5, 1.0);
    const cq = centroid(quill, 0, AW), cf = centroid(finger, 0, AW);
    const hq = above(quill, 0, AW, 3000), hf = above(finger, 0, AW, 3000);
    worst = Math.min(worst, cq / cf);
    worstHF = Math.min(worstHF, hq / Math.max(hf, 1e-9));
    rows.push("MIDI " + m + " centroid x" + (cq / cf).toFixed(2) +
      ", >3 kHz x" + (hq / Math.max(hf, 1e-9)).toFixed(1));
  }
  ok("O2b the risha is a quill, not a finger — the same module, the plectrum moved", () => {
    assert.ok(worst > 1.05, "the quill's attack centroid is only x" + worst.toFixed(2) +
      " the fingertip's — the plectrum is not reaching the sound");
    /* x2.5 AND NOT x3.0, AND THE NUMBER MOVED FOR A GOOD REASON (2026-09-07).
       The old floor was fitted against a bench that struck the string in the
       very first block, before `sfreq` had slewed to the slider — so the
       excitation burst was several times too long and the pluck comb was in
       the wrong place, for BOTH plectrums, and the ratio it produced (x4.1 to
       x8) was partly the pitch smoother's settling. `render` now primes one
       block, which is what press/render-core.js does, and the same claim
       measures x2.7 to x5.4. The claim is unchanged and it is still large:
       a filed quill puts nearly three times the fingertip's energy over
       3 kHz into the first 23 ms. */
    assert.ok(worstHF > 2.5, "the quill puts only x" + worstHF.toFixed(1) +
      " the fingertip's energy above 3 kHz");
    console.log("       " + rows.join("  ·  "));
  });
}

/* ---- O3 a course, not a chorus ------------------------------------------ */
{
  const out = [];
  let bad = null, silent = null;
  const envOf = (x, f0, from, to) => {
    const e = [];
    for (let s = from; s + 4096 < to; s += 512) e.push({ t: s / SR, m: magAt(x, s, 4096, f0) });
    return e;
  };
  const minima = (e) => {
    const t = [];
    for (let i = 2; i < e.length - 2; i++)
      if (e[i].m < e[i - 1].m && e[i].m < e[i + 1].m && e[i].m < e[i - 2].m && e[i].m < e[i + 2].m) t.push(e[i].t);
    return t;
  };
  for (const m of [48, 55, 60]) {
    const f0 = midiHz(m);
    for (const c of [0, 8, 20]) {
      const x = await render("oud", { freq: f0, glide: 0, pick: 0.5, course: c, ring: 12 }, 6.0, 5.5);
      const e = envOf(x, f0, Math.floor(SR * 0.2), Math.floor(SR * 5.0));
      const mn = minima(e);
      const want = f0 * (Math.pow(2, c / 2400) - Math.pow(2, -c / 2400));
      if (c === 0) { if (mn.length > 0) silent = "MIDI " + m + ": a SINGLE string beats " + mn.length + " times"; continue; }
      if (mn.length < 2) { bad = "MIDI " + m + " course " + c + "c: no beating at all"; continue; }
      const per = (mn[mn.length - 1] - mn[0]) / (mn.length - 1);
      const got = 1 / per;
      const depth = 20 * Math.log10(Math.max(...e.map((p) => p.m)) / Math.max(1e-12, Math.min(...e.map((p) => p.m))));
      if (Math.abs(got - want) > 0.03 * want)
        bad = "MIDI " + m + " course " + c + "c: beats at " + got.toFixed(3) +
              " Hz, arithmetic says " + want.toFixed(3);
      if (depth < 20) bad = "MIDI " + m + " course " + c + "c: only " + depth.toFixed(1) +
              " dB of modulation — that is chorus mush, not two strings";
      out.push("MIDI " + m + "/" + c + "c " + got.toFixed(3) + "≈" + want.toFixed(3) + " Hz " + depth.toFixed(0) + "dB");
    }
  }
  ok("O3 the course BEATS, at the rate arithmetic predicts, and a single string does not", () => {
    assert.strictEqual(bad, null, String(bad));
    assert.strictEqual(silent, null, String(silent));
    console.log("       " + out.join("  ·  "));
  });
}

/* ---- O4 the slide is a HAND (2026-09-07, the laser-beam round) ----------
   Paul: *"The oud has a very 'laser beam' sound when it bends tones and I
   think maybe it's taking the note bends too slow? Or it's missing the scratch
   sound of a proper player."*

   WHAT THE OLD O4 MISSED, since it passed 9/9 the whole time he was hearing
   this. It rendered ONE note, held the gate open, moved `freq` a fourth
   underneath it and asserted the pitch was between the two and rising. Three
   things it never asked, and each of them is one of the four findings:
     · WHETHER THE BEND ARRIVES. There was no upper bound on the travel in it,
       so a bend still 100 cents flat at 120 ms passed. `glide` was a
       `tau2pole` TIME CONSTANT — 63% of the way after the number on the
       slider — so the shipped 45 ms was a ~200 ms droop. O4a fences it.
     · WHAT HAPPENS AT THE INTERVALS THE CATALOGUE PLAYS. It tested five
       semitones. The nine rows that seat this instrument play FOURTEEN, and
       12.7% of their moves are wider than a fourth. O4b measures the census
       and the fence that answers it.
     · WHETHER THE NOTE IS RE-PLUCKED. It tested a legato bend and this engine
       never writes one, so it measured the only case that does not occur.
       Everything below uses `twoNote`, which is the renderer's own writing.
   And a fourth thing it could not have missed because it did not exist: there
   was no noise in the bend at all (O4c). */
{
  /* O4a — `glide` IS THE TIME THE NOTE ARRIVES. Three intervals, the widest
     of them the hand's whole reach, each re-plucked. The floor is 6 cents,
     which is the pitch JND: past `glide` the note is IN TUNE and not merely
     nearer. BEFORE this round, on the same bench, an octave read -530 c at
     5 ms, -111 c at 70, -59 c at 100 and did not come inside 20 cents until
     150 ms — a fifth DOWN took 200 — which is the sound Paul named. */
  const rows = [], bad = [];
  for (const [m1, m2, lbl] of [[60, 62, "whole tone"], [60, 65, "a fourth"], [67, 60, "down a fourth"]]) {
    for (const g of [0.09, 0.036]) {
      const { x, g2 } = await twoNote("oud", { pick: 0.5, ring: 2.8, glide: g }, m1, m2, 1.2, 1.2);
      const q = (ms) => bendAt(x, g2, ms, m1, m2);
      const early = q(g * 250), mid = q(g * 500), land = q(g * 1000), after = q(g * 3000);
      if (!(Math.abs(land) < 6))
        bad.push(lbl + " at glide " + g + ": " + land.toFixed(0) + " cents off at t=glide");
      if (!(Math.abs(after) < 6))
        bad.push(lbl + " at glide " + g + ": " + after.toFixed(0) + " cents off at 3x glide (overshoot)");
      // …and it is genuinely TRAVELLING, not a jump with a smoothed edge
      if (!(Math.abs(early) > Math.abs(mid) && Math.abs(mid) > Math.abs(land) + 1))
        bad.push(lbl + " at glide " + g + ": not monotone (" +
          [early, mid, land].map((v) => v.toFixed(0)).join(" ") + ")");
      if (!(Math.abs(early) > 12))
        bad.push(lbl + " at glide " + g + ": only " + early.toFixed(0) +
          " cents off a quarter of the way in — that is a jump, not a bend");
      rows.push(lbl + "/" + g + "s " + [early, mid, land].map((v) => v.toFixed(0) + "c").join(" "));
    }
  }
  // the `lute`: gut frets, glide 0, there inside 5 ms
  const { x: lu, g2: lg } = await twoNote("oud", { pick: 0.5, ring: 2.8, glide: 0 }, 60, 65, 1.2, 1.2);
  const snap = bendAt(lu, lg, 5, 60, 65);
  ok("O4a `glide` is the time the note ARRIVES — in tune, to inside the 6-cent JND", () => {
    assert.strictEqual(bad.length, 0, bad.join("\n       "));
    assert.ok(Math.abs(snap) < 15, "at glide 0 the note has not arrived after 5 ms: " +
      snap.toFixed(0) + " cents off");
    console.log("       t/4 · t/2 · t: " + rows.join("  ·  ") + "   ·   glide 0 at 5 ms " +
      snap.toFixed(0) + "c");
  });
}
{
  /* O4c — THE SCRATCH, AND THAT IT IS ONLY THERE WHILE THE HAND IS MOVING.
     Three numbers, all of them on the travel of a fourth at the derived 90 ms:
     the share of the note's energy above 2 kHz through the travel, the RMS
     through the same window, and the SETTLED note 300 ms later — which must
     not move at all, because a finger that has stopped makes no noise. The
     fourth is the `lute`: at glide 0 the whole feature must be arithmetically
     absent, not merely quiet. */
  const P = { pick: 0.5, ring: 2.8 };
  const dry = await twoNote("oud", { ...P, glide: 0.09, scratch: 0 }, 60, 65, 1.2, 1.2);
  const wet = await twoNote("oud", { ...P, glide: 0.09, scratch: 0.45 }, 60, 65, 1.2, 1.2);
  const hot = await twoNote("oud", { ...P, glide: 0.09, scratch: 1 }, 60, 65, 1.2, 1.2);
  const g2 = dry.g2;
  const TR = g2 + Math.floor(SR * 0.015), TRE = g2 + Math.floor(SR * 0.090);
  const ST = g2 + Math.floor(SR * 0.30), STE = g2 + Math.floor(SR * 0.60);
  const hf = (r) => above(r.x, TR, 4096, 2000);
  const dTravel = 20 * Math.log10(rms(wet.x, TR, TRE) / rms(dry.x, TR, TRE));
  const dSettle = 20 * Math.log10(rms(wet.x, ST, STE) / rms(dry.x, ST, STE));
  // the LUTE, bit for bit
  const l0 = await twoNote("oud", { ...P, glide: 0, scratch: 0 }, 60, 65, 0.6, 0.6);
  const l1 = await twoNote("oud", { ...P, glide: 0, scratch: 1 }, 60, 65, 0.6, 0.6);
  let differ = 0;
  for (let i = 0; i < l0.x.length; i++) if (l0.x[i] !== l1.x[i]) differ++;
  ok("O4c the bend SCRATCHES, and a note that has arrived does not", () => {
    assert.ok(hf(wet) > hf(dry) * 2.0, "the travel's share above 2 kHz is " +
      hf(wet).toFixed(1) + "% against " + hf(dry).toFixed(1) + "% dry — the scratch is declared and not arriving");
    assert.ok(dTravel > 0.7 && dTravel < 3.0, "the travel is " + dTravel.toFixed(2) +
      " dB over the dry one — a finger is texture, not a noise gate");
    assert.ok(Math.abs(dSettle) < 0.15, "the SETTLED note moved " + dSettle.toFixed(2) +
      " dB — the scratch is ringing on in the string after the hand stopped");
    assert.ok(hf(hot) > hf(wet), "the slider does not move the sound");
    assert.strictEqual(differ, 0, "at glide 0 (the `lute`) scratch 0 and scratch 1 differ in " +
      differ + " samples — a fretted note has no travelling finger");
    console.log("       travel >2 kHz " + hf(dry).toFixed(1) + "% -> " + hf(wet).toFixed(1) +
      "% (at scratch 1, " + hf(hot).toFixed(1) + "%)   ·   travel +" + dTravel.toFixed(2) +
      " dB, settled " + dSettle.toFixed(2) + " dB   ·   lute: " + differ + " samples differ");
  });
}

/* ---- O5 an instrument, not a fader -------------------------------------- */
{
  const rows = [];
  let dip = 0, move = Infinity;
  for (const m of [36, 48, 60, 72]) {
    const f = midiHz(m), lv = [];
    for (const p of [0.12, 0.5, 1.0]) {
      // BOTH halves of velocity, the way state-engine writes it: the note's
      // amp on `gain` AND the plectrum's force on `pick` (MODEL_DYN.oud).
      const x = await render("oud", { freq: f, glide: 0, pick: p, gain: 0.3 * (0.3 + p) }, 2.0, 1.0);
      lv.push({ p, r: rms(x, Math.floor(SR * 0.08), Math.floor(SR * 0.5)), c: centroid(x, Math.floor(SR * 0.08), 8192) });
    }
    for (let i = 1; i < lv.length; i++)
      if (lv[i].r < lv[i - 1].r) dip = Math.max(dip, 20 * Math.log10(lv[i - 1].r / lv[i].r));
    move = Math.min(move, lv[2].c / lv[0].c);
    rows.push("MIDI " + m + " centroid x" + (lv[2].c / lv[0].c).toFixed(2));
  }
  ok("O5 loudness monotone in the plectrum, and the plectrum moves the SPECTRUM", () => {
    assert.ok(dip <= 0.5, "loudness inverts by " + dip.toFixed(2) + " dB");
    assert.ok(move > 1.10, "the hardest stroke's centroid is only x" + move.toFixed(2) +
      " the softest's — velocity is a fader on this model");
    assert.ok(move < 2.7, "the swing is x" + move.toFixed(2) +
      ", wider than the guitar's plectrum — a risha's timbral range is NARROWER, " +
      "because a fingertip changes shape with force and filed plastic does not");
    console.log("       " + rows.join("  ·  "));
  });
}

/* ---- the nukernel bridge, for O6b and O7 -------------------------------- */
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
const TE = await import(R("nukernel/audio/to-engine.js"));
const SE = require(R("engine/faust/voices/state-engine.js"));

/* ---- O4b/O4d the hand's reach, through the whole bridge ----------------- */
{
  /* O4b — A LEAP IS RE-PLUCKED, NOT SWEPT, and the census that says the fence
     is load-bearing rather than decorative. Two measurements:
       (i) THE CATALOGUE. Over the nine rows that seat this instrument, at two
           seeds, on the notes AS `registerFold` delivers them: how many of the
           line's consecutive moves are wider than a hand's reach, and how many
           notes are marked `sld`. Both numbers are the finding. If the wide
           moves went away, this fence would be dead code and should be said
           so; if a `sld` ever appears, the gesture path wakes up and the 0.16 s
           number starts mattering.
      (ii) THE BRIDGE. One written line through `toEngine` -> `mapEvents`,
           reading the `glide` actually written on each note: a whole tone, a
           fourth (the reach), a fourth down, a repeated note, an octave up and
           an octave down. */
  const KG = require(R("engine/genre-kernel.js"));
  const NP = require(R("nukernel/precompose.js"));
  const G = window.NuGenres.GENRES, ND = window.NuDocument;
  const ROWS = ["qiyan", "abbasid", "andalusi", "zajal", "muwashshah", "nuba",
                "troubadour", "pavane", "taqsim"];
  const fold = (m) => { let x = m; while (x > 79.01) x -= 12; while (x < 35.99) x += 12; return x; };
  let moves = 0, wide = 0, widest = 0, slid = 0;
  for (const gk of ROWS) for (const seed of [1, 2]) {
    const doc = NP.genreToDocument(gk, seed);
    const seats = (doc.voices || []).map((v, i) => ({ v, i }))
      .filter((x) => x.v.kind === "line" && (x.v.instrument === "oud" || x.v.instrument === "lute"));
    if (!seats.length) continue;
    const sc = ND.scoreOf(doc, G, []);
    for (const { i } of seats) {
      const ev = sc.events.filter((e) => e.kind === "line" && e.v === i && e.n != null)
        .sort((a, b) => a.t - b.t);
      for (let k = 1; k < ev.length; k++) {
        const iv = Math.abs(fold(ev[k].n) - fold(ev[k - 1].n));
        moves++; if (iv > 5) wide++; widest = Math.max(widest, iv);
        if (ev[k].sld) slid++;
      }
    }
  }
  const t = TE.toEngine({
    bpm: 60, seed: 3, kit: "tr909",
    bars: [{ barSteps: 16, ev: [60, 62, 67, 62].map((n, i) => ({ kind: "line", v: 0, n, off: i * 4, dur: 4, vel: 6 })) },
           { barSteps: 16, ev: [62, 74, 62].map((n, i) => ({ kind: "line", v: 0, n, off: i * 4, dur: 4, vel: 6 })) }],
    reverb: 0, delay: 0, seat: () => ({ chair: "line", instr: "oud" }), bass: null,
  }, { SE, K: KG, E: require(R("engine/csd-engine.js")) });
  const wrote = SE.mapEvents(require(R("engine/csd-engine.js")), t.state, t.ev, { units: t.units })
    .events.filter((e) => e.unit === "v0").map((e) => +e.sets.glide.toFixed(4));
  ok("O4b a hand's reach is a fourth: past it the note is re-plucked in tune", () => {
    assert.ok(wide / moves > 0.05, "only " + (100 * wide / moves).toFixed(1) +
      "% of the oud's moves are wider than a fourth — the fence has nothing to do, say so");
    assert.ok(widest > 8, "the widest move measured is " + widest + " semitones");
    assert.strictEqual(slid, 0, slid + " notes are marked `sld` — the GESTURE path is live now " +
      "and `slideSec` (0.16 s) stops being a number nothing reaches; re-argue it");
    // no previous note · +2 · +5 · -5 · repeat · +12 · -12
    assert.deepStrictEqual(wrote, [0, 0.036, 0.09, 0.09, 0, 0, 0],
      "the glide written per note is " + JSON.stringify(wrote));
    console.log("       census: " + moves + " moves on " + ROWS.length + " rows x2 seeds, " +
      wide + " (" + (100 * wide / moves).toFixed(1) + "%) wider than a fourth, widest " + widest +
      " st, `sld` marks " + slid + "   ·   written: " + JSON.stringify(wrote));
  });
  /* O4d — AND THE END OF IT, IN THE AIR. Every interval above, rendered at the
     glide the ENGINE just wrote for it, must be in tune 90 ms after the strike
     — which is the whole complaint answered as one number. BEFORE the round,
     on the same bench and the same intervals: a whole tone read -24 c at 70 ms
     and -8 c at 100; a fourth was still travelling at 150; an octave read
     -59 c at 100 ms and -530 c at 5. */
  const IV = [[60, 62, 0.036], [60, 65, 0.09], [67, 60, 0.09], [60, 72, 0], [72, 60, 0]];
  const late = [], rows2 = [];
  for (const [m1, m2, g] of IV) {
    const { x, g2 } = await twoNote("oud", { pick: 0.5, ring: 2.8, glide: g }, m1, m2, 1.2, 1.2);
    const c90 = bendAt(x, g2, 90, m1, m2), c20 = bendAt(x, g2, 20, m1, m2);
    if (!(Math.abs(c90) < 8)) late.push((m2 - m1) + " st at glide " + g + ": " + c90.toFixed(0) + "c at 90 ms");
    rows2.push((m2 - m1 > 0 ? "+" : "") + (m2 - m1) + "st/" + g + "s " + c20.toFixed(0) + "c@20 " + c90.toFixed(0) + "c@90");
  }
  ok("O4d every interval the catalogue plays is IN TUNE 90 ms after the strike", () => {
    assert.strictEqual(late.length, 0, late.join("; "));
    console.log("       " + rows2.join("  ·  "));
  });
}

/* ---- O6 the unit exists, a chair can reach it, and it arrives dry ------- */
ok("O6a state-engine builds an oud UNIT with the instrument's compass and no amp", () => {
  const u = SE.pitchedUnit("melody", { model: "oud" }, { bpm: 100, seed: 1 });
  assert.ok(u, "pitchedUnit returned nothing for model oud");
  assert.strictEqual(u.module, "oud", "module is " + u.module);
  // the union compass: the oud's own C2 floor, the lute's G5 ceiling
  assert.ok(Math.abs(u.freqMin - 65.41) < 0.05, "freqMin " + u.freqMin);
  assert.ok(Math.abs(u.freqMax - 783.99) < 0.05, "freqMax " + u.freqMax);
  // FRETLESS: the base glide is not 0, which is true of nothing else here
  assert.strictEqual(u.slideParam, "glide", "slideParam " + u.slideParam);
  assert.ok(u.params.glide > 0, "the oud's base glide is " + u.params.glide +
    " — a fretless instrument that arrives instantly is a fretted one");
  assert.ok(u.slideSec > u.params.glide, "slideSec " + u.slideSec + " is not longer than the base");
  // NO AMP: an empty insert chain where every other model takes the house pair
  assert.deepStrictEqual(u.inserts, [], "the oud arrived with inserts: " + JSON.stringify(u.inserts));
  // velocity is a plectrum, not a fader
  assert.deepStrictEqual(u.dyn, SE.MODEL_DYN.oud, "dyn is not the oud row");
  assert.ok(!("drive" in SE.MODEL_DYN.oud), "MODEL_DYN.oud moves `drive`, and there is no amp to drive");
  // every param the unit writes is one the MODULE actually has
  const meta = JSON.parse(fs.readFileSync(R("engine/faust/dist/oud-meta.json"), "utf8"));
  const have = new Set();
  (function walk(items) { for (const it of items || []) it.items ? walk(it.items) : have.add(it.label); })(meta.ui);
  const orphan = Object.keys(u.params).filter((k) => !have.has(k));
  assert.strictEqual(orphan.length, 0,
    "the unit writes params the dsp does not have: " + orphan.join(", ") +
    " (the module has " + [...have].sort().join(" ") + ")");
  for (const k of Object.keys(SE.MODEL_DYN.oud))
    assert.ok(have.has(k), "MODEL_DYN.oud moves `" + k + "`, which the dsp does not expose");
  console.log("       unit: " + u.module + ", " + u.freqMin.toFixed(0) + "-" + u.freqMax.toFixed(0) +
    " Hz, glide " + u.params.glide + "s base / " + u.slideSec + "s slid, dry, params " +
    Object.keys(u.params).sort().join(" "));
});
ok("O6b a nukernel chair seated on `oud` (and on `lute`) routes to the model", () => {
  for (const id of ["oud", "lute"]) {
    const un = [];
    const r = TE.recipeFor("line", { instr: id }, {}, un);
    assert.strictEqual(r.source, "patch:" + id + ">oud",
      id + " routed " + r.source + (un.length ? " (" + un[0].why + ")" : ""));
    assert.strictEqual(un.length, 0, id + " unrouted: " + JSON.stringify(un));
    assert.strictEqual(window.NuInstruments.sampledId(id), false, id + " reads as a sampled id");
  }
  // the LUTE is the same model with the frets on
  const lu = SE.pitchedUnit("melody", TE.recipeFor("line", { instr: "lute" }, {}, []).m,
                            { bpm: 100, seed: 1 });
  assert.strictEqual(lu.module, "oud", "the lute is not the oud model");
  assert.strictEqual(lu.params.glide, 0, "the lute's glide is " + lu.params.glide +
    " — gut frets tied round the neck are, in this model, glide 0");
  assert.ok(lu.slideSec < 0.1, "a fretted slide of " + lu.slideSec + "s is a fretless one");
  assert.strictEqual(TE.pageTrim("oud"), 1.424, "no page trim for oud");
  console.log("       oud -> patch:oud>oud · lute -> patch:lute>oud (glide 0, slide " +
    lu.slideSec + "s) · page trim " + TE.pageTrim("oud"));
});

/* ---- O7 seated where it is declared ------------------------------------- */
ok("O7 the eight rows the round re-seated cast it; the three it refused do not", () => {
  const G = window.NuGenres.GENRES;
  const OUD = ["qiyan", "abbasid", "andalusi", "zajal", "muwashshah", "nuba"];
  const LUTE = ["troubadour", "pavane"];
  const KEPT = ["modinha", "lundu", "pipaqu"];
  const instrOf = (k) => {
    const e = G[k] && G[k].instr;
    return e ? (Array.isArray(e) ? e : [e]) : [];
  };
  for (const k of OUD) {
    assert.ok(G[k], "no row " + k);
    assert.ok(instrOf(k).includes("oud"), k + " does not cast the oud: " + instrOf(k).join(" "));
    assert.ok(!instrOf(k).includes("nylon_string_guitar"), k + " still casts the nylon guitar");
  }
  for (const k of LUTE) {
    assert.ok(instrOf(k).includes("lute"), k + " does not cast the lute: " + instrOf(k).join(" "));
    assert.ok(!instrOf(k).includes("nylon_string_guitar"), k + " still casts the nylon guitar");
  }
  /* THE THREE REFUSALS ARE PINNED, not merely un-asserted. A pipa is fretted
     and struck with the fingernails; a Portuguese viola de arame is a
     WIRE-strung five-course folk guitar. Neither is an oud, and a later round
     that seats one there has to come through this line. */
  for (const k of KEPT)
    assert.ok(instrOf(k).includes("nylon_string_guitar") && !instrOf(k).includes("oud"),
      k + " was seated on the oud, and its own note says why it must not be");
  // and every seat resolves to the model rather than to a recording
  for (const k of [...OUD, ...LUTE]) {
    const id = instrOf(k).find((x) => x === "oud" || x === "lute");
    const un = [];
    const r = TE.recipeFor("line", { instr: id }, {}, un);
    assert.strictEqual(r.source, "patch:" + id + ">oud", k + "'s seat routed " + r.source);
  }
  // ...and each carries its own RANGE row, which the register law needs
  const RG = window.NuInstruments.RANGES || {};
  for (const id of ["oud", "lute"])
    assert.ok(Array.isArray(RG[id]) && RG[id].length === 2, id + " has no RANGES row");
  console.log("       oud: " + OUD.join(" ") + "   ·   lute: " + LUTE.join(" ") +
    "   ·   kept on the nylon top: " + KEPT.join(" ") +
    "   ·   ranges oud " + JSON.stringify(RG.oud) + " lute " + JSON.stringify(RG.lute));
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
})();
