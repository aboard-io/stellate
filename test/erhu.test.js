#!/usr/bin/env node
/* test/erhu.test.js — THE ERHU, MEASURED (2026-08-30, the registry lane).
 *
 * nukernel/genres.js refuses `guoyue` for exactly one reason and names its own
 * price: "EMPTY until the registry holds an erhu, a dizi, a pipa or a sheng".
 * The registry could not get one by sampling — all eleven soundfonts in this
 * tree are GM bank 0, 128 presets, no Chinese instrument in any of them — so
 * engine/faust/dsp/erhu.dsp models one. This file is the measurement that says
 * whether it is an instrument or a costume, and every number comes out of the
 * REAL dist/erhu-module.wasm, the same artifact the page would load.
 *
 *   E1  THE MEMBRANE RATIOS ARE COMPUTED, NOT CHOSEN. The six mode ratios in
 *       the dsp are recomputed here from the zeros of the Bessel functions
 *       J0..J3 (Newton on a series evaluation, no table) and must match the
 *       file to 1e-5. A body somebody tuned by ear could be tuned into a
 *       violin's; this one cannot be moved without failing here.
 *   E2  IT PLAYS THE NOTE IT IS ASKED FOR. Rendered across the erhu's OWN
 *       range — D4 to A7, the ZIM's "from D4 up to A7" — the strongest
 *       partial's frequency is within a few cents of the written pitch. This
 *       is the check that caught gtr_amp: a waveguide whose loop delay is
 *       wrong plays a different note than the one on the page.
 *   E3  IT IS BOWED, NOT PLUCKED. A bow puts energy in continuously, so the
 *       second half of a held note is as loud as the first. Measured as the
 *       ratio of late RMS to early RMS: a plucked string is far below 1, this
 *       must not be.
 *   E4  THE BODY IS A FIXED MEMBRANE. (a) the loudest partial of a D4 and of
 *       a D5 is the SAME frequency — a body stays put when the note moves,
 *       where a tone control follows it — and both land inside the skin's own
 *       band. (b) retuning `skin` moves that partial and does NOT move the
 *       string's pitch, which is what makes it the membrane and not a filter
 *       somebody liked.
 *       (THE FIRST VERSION OF THIS CHECK MEASURED THE WRONG THING and is
 *       recorded here rather than quietly replaced: it looked for a PEAK at a
 *       non-harmonic membrane frequency and found none — correctly, because a
 *       bowed string drives its body only at its own harmonics, so a body
 *       resonance is a bump in the ENVELOPE and never a partial of its own.)
 *   E5  IT IS NOT A VIOLIN PATCH, and the comparison is against the real
 *       thing: pm.violinModel (Faust physmodels.lib), compiled here at the
 *       same pitch through the same renderer. The two spectra must differ in
 *       the ways the physics says they should — a different spectral centroid
 *       and a different harmonic-energy profile — and the erhu must carry
 *       membrane-band energy the violin does not.
 *   E6  VELOCITY IS PHYSICAL. `force` is bow pressure, so raising it must move
 *       the TIMBRE (the spectral centroid), not just the level. A model whose
 *       velocity is a fader is the thing MODEL_DYN exists to avoid.
 *   E7  THE SLIDE IS THE STRING. With `glide` set, a pitch change arrives
 *       through the intervening frequencies (hua yin) instead of jumping —
 *       measured by AUTOCORRELATION, not by a spectral peak, because this
 *       instrument's body is the loudest thing in its own spectrum (E4/E5) and
 *       the tallest bin is the skin rather than the note.
 *   E8  THE MODEL BECOMES A UNIT A CHAIR CAN REACH: state-engine builds an
 *       `erhu` unit with the ZIM's compass and the slide door, every param it
 *       writes is one the compiled module actually has, and a nukernel chair
 *       seated on `erhu` routes `synth:erhu` rather than `unrouted`. A dsp
 *       nobody can play is this box's own characteristic bug.
 *
 * RUN:  node test/erhu.test.js
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

/* ---------- Bessel zeros, computed ---------------------------------------
   J_m(x) by its own power series (converges fine for x < 12), the zeros by
   bisection on a fine scan. No table, no remembered constants. */
function besselJ(m, x) {
  let term = Math.pow(x / 2, m);
  for (let i = 1; i <= m; i++) term /= i;          // 1/m!
  let sum = term;
  for (let k = 1; k < 200; k++) {
    term *= -(x * x / 4) / (k * (k + m));
    sum += term;
    if (Math.abs(term) < 1e-20) break;
  }
  return sum;
}
function besselZeros(m, n) {
  const out = [];
  let px = 1e-9, prev = besselJ(m, px);
  for (let x = 0.005; x < 25 && out.length < n; x += 0.0005) {
    const v = besselJ(m, x);
    if (prev !== 0 && (v < 0) !== (prev < 0)) {
      let a = px, b = x;
      for (let i = 0; i < 200; i++) {
        const mid = (a + b) / 2;
        if ((besselJ(m, mid) < 0) !== (besselJ(m, a) < 0)) b = mid; else a = mid;
      }
      out.push((a + b) / 2);
    }
    prev = v; px = x;
  }
  return out;
}

/* ---------- spectrum ------------------------------------------------------ */
function dft(sig, from, len, sr, fLo, fHi, step) {
  const bins = [];
  for (let f = fLo; f <= fHi; f += step) {
    let re = 0, im = 0;
    for (let i = 0; i < len; i++) {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / len);   // hann
      const a = 2 * Math.PI * f * i / sr;
      re += sig[from + i] * w * Math.cos(a); im -= sig[from + i] * w * Math.sin(a);
    }
    bins.push({ f, mag: Math.sqrt(re * re + im * im) / len });
  }
  return bins;
}
const peakOf = (bins) => bins.reduce((a, b) => (b.mag > a.mag ? b : a), bins[0]);
const magAt = (sig, from, len, f) => dft(sig, from, len, SR, f, f, 1)[0].mag;
const rms = (a, from, to) => { let s = 0, n = 0;
  for (let i = from | 0; i < Math.min(to | 0, a.length); i++) { s += a[i] * a[i]; n++; }
  return n ? Math.sqrt(s / n) : 0; };
const cents = (f, ref) => 1200 * Math.log2(f / ref);

(async () => {
console.log("test/erhu.test.js — a bowed string on a membrane\n");

/* ---- E1 the ratios are computed ----------------------------------------- */
ok("E1 the six body ratios in erhu.dsp ARE j(m,n)/j(0,1) for a circular membrane", () => {
  const j0 = besselZeros(0, 2), j1 = besselZeros(1, 2), j2 = besselZeros(2, 1), j3 = besselZeros(3, 1);
  const base = j0[0];
  const want = [j0[0], j1[0], j2[0], j0[1], j3[0], j1[1]].map((z) => z / base);
  const src = fs.readFileSync(R("engine/faust/dsp/erhu.dsp"), "utf8");
  const m = src.match(/m1 = ([\d.]+); m2 = ([\d.]+); m3 = ([\d.]+);\s*\n\s*m4 = ([\d.]+); m5 = ([\d.]+); m6 = ([\d.]+);/);
  assert.ok(m, "the dsp's m1..m6 line is not where this gate reads it");
  const have = m.slice(1, 7).map(Number);
  for (let i = 0; i < 6; i++)
    assert.ok(Math.abs(have[i] - want[i]) < 1e-5,
      "mode " + (i + 1) + ": file " + have[i] + ", Bessel says " + want[i].toFixed(6));
  console.log("       computed: " + want.map((x) => x.toFixed(6)).join(" "));
});

/* ---- the real wasm ------------------------------------------------------- */
const { FaustMonoDspGenerator } = await import(
  path.join(FAUST, "node_modules/@grame/faustwasm/dist/esm/index.js"));
async function factoryOf(name) {
  const code = fs.readFileSync(path.join(FAUST, "dist", name + "-module.wasm"));
  return { cfactory: 0, code: new Uint8Array(code),
    module: await WebAssembly.compile(code),
    json: fs.readFileSync(path.join(FAUST, "dist", name + "-meta.json"), "utf8"), poly: false };
}
const gen = new FaustMonoDspGenerator();
// render `secs` of a module, optionally moving params partway through
async function render(name, params, secs, mid) {
  const f = await factoryOf(name);
  const proc = await gen.createOfflineProcessor(SR, BS, f);
  for (const [k, v] of Object.entries(params)) proc.setParamValue("/" + name + "/" + k, v);
  const T = Math.floor(SR * secs), out = new Float32Array(T);
  const midAt = mid ? Math.floor(SR * mid.at) : -1;
  let done = false;
  for (let s = 0; s < T; s += BS) {
    if (!done && midAt >= 0 && s >= midAt) {
      for (const [k, v] of Object.entries(mid.set)) proc.setParamValue("/" + name + "/" + k, v);
      done = true;
    }
    const len = Math.min(BS, T - s);
    const o = proc.render([], len);
    out.set(o[0].subarray(0, len), s);
  }
  return out;
}

/* ---- everything this file measures, rendered ONCE ------------------------ */
// the held notes, three seconds each, at the module's own defaults
const NOTE_HZ = [293.6648, 440.0, 587.33, 880.0, 1760.0, 3520.0];
const SIGS = {};
for (const hz of NOTE_HZ) SIGS[hz] = await render("erhu", { freq: hz, gate: 1, glide: 0 }, 3);
// two bow pressures on the same note (E6)
// the two ends of the bow-pressure slider ITSELF (0.35..1) — asking for a
// value outside it measures the clamp, not the bow.
const SOFT = await render("erhu", { freq: 440, gate: 1, glide: 0, force: 0.36 }, 2.5);
const HARD = await render("erhu", { freq: 440, gate: 1, glide: 0, force: 1.00 }, 2.5);
// two skins, one string (E4b)
const SKINS = { 800: await render("erhu", { freq: 293.6648, gate: 1, glide: 0, skin: 800 }, 2.5),
                1800: await render("erhu", { freq: 293.6648, gate: 1, glide: 0, skin: 1800 }, 2.5) };
// a hua yin: D5 held, then asked for A5 with a 0.35 s slide (E7)
const GLIDE = await render("erhu", { freq: 293.6648, gate: 1, glide: 0.35 }, 2.5,
                           { at: 1.0, set: { freq: 587.33 } });

/* ---- the reference violin: pm.violinModel, compiled HERE ----------------
   Not a violin sample and not our own strings.dsp — the physmodels.lib model
   the Faust standard library ships, so E5 compares this file against the
   nearest thing to it that already exists rather than against a straw man. */
const VIOLIN = await (async () => {
  const { instantiateFaustModuleFromFile, LibFaust, FaustCompiler } = await import(
    path.join(FAUST, "node_modules/@grame/faustwasm/dist/esm/index.js"));
  const mod = await instantiateFaustModuleFromFile(
    path.join(FAUST, "node_modules/@grame/faustwasm/libfaust-wasm/libfaust-wasm.js"));
  const compiler = new FaustCompiler(new LibFaust(mod));
  // pm.f2l turns a frequency into the string length the model wants, so the
  // violin is asked for the SAME A4 the erhu was.
  const src = 'declare name "violin_ref"; import("stdfaust.lib");\n' +
    'gate = button("gate");\n' +
    'process = pm.violinModel(pm.f2l(440.0), 0.4, 0.16*en.asr(0.02,1,0.1,gate), 0.13)*0.5;\n';
  const g2 = new FaustMonoDspGenerator();
  const dsp = await g2.compile(compiler, "violin_ref", src, "-ftz 2");
  const f = { cfactory: 0, code: dsp.factory.code, module: await WebAssembly.compile(dsp.factory.code),
              json: dsp.factory.json, poly: false };
  const proc = await g2.createOfflineProcessor(SR, BS, f);
  proc.setParamValue("/violin_ref/gate", 1);
  const T = SR * 3, out = new Float32Array(T);
  for (let s = 0; s < T; s += BS) {
    const len = Math.min(BS, T - s);
    out.set(proc.render([], len)[0].subarray(0, len), s);
  }
  return out;
})();
console.log("       rendered: 6 held notes, 2 bow pressures, 1 slide, 1 reference violin\n");

/* ---- E2 it plays the note it is asked for ------------------------------- */
const NOTES = [{ hz: 293.6648, name: "D4 (the inside open string)" },
               { hz: 440.0, name: "A4 (the outside open string)" },
               { hz: 587.33, name: "D5" },
               { hz: 880.0, name: "A5" },
               { hz: 1760.0, name: "A6" },
               { hz: 3520.0, name: "A7 (the ZIM's ceiling)" }];
ok("E2 in tune across its OWN range, D4 to A7", () => {
  const say = [];
  for (const n of NOTES) {
    const sig = SIGS[n.hz];
    const win = 16384, from = SR * 1.2 | 0;
    const b = dft(sig, from, win, SR, n.hz * 0.94, n.hz * 1.06, n.hz * 0.0006);
    const p = peakOf(b);
    const c = cents(p.f, n.hz);
    say.push(n.name + " " + (c >= 0 ? "+" : "") + c.toFixed(1) + "¢");
    assert.ok(Math.abs(c) < 12, n.name + " is " + c.toFixed(1) + " cents off (" + p.f.toFixed(2) + " Hz)");
  }
  console.log("       " + say.join(", "));
});

/* ---- E3 it is bowed --------------------------------------------------- */
ok("E3 it SUSTAINS: a bow puts energy in, it does not decay like a pluck", () => {
  const say = [];
  for (const n of NOTES.slice(0, 4)) {
    const sig = SIGS[n.hz];
    const early = rms(sig, SR * 0.5, SR * 1.0), late = rms(sig, SR * 2.0, SR * 2.5);
    const ratio = late / (early || 1e-12);
    say.push(n.name.split(" ")[0] + " " + ratio.toFixed(3));
    assert.ok(ratio > 0.55, n.name + " decayed to " + ratio.toFixed(3) + " of itself in 1.5 s — that is a pluck");
  }
  console.log("       late/early RMS: " + say.join(", "));
});

/* ---- E4 the body is a fixed membrane ----------------------------------- */
// REWRITTEN 2026-08-30 after the first version of this check measured the
// wrong thing. It looked for a PEAK at a non-harmonic membrane frequency, and
// found none — correctly: a bowed string drives the body at ITS OWN harmonics,
// so a body resonance shows up as a bump in the spectral ENVELOPE, not as a
// partial of its own. What separates a body from a tone control is that it
// STAYS PUT when the note moves, and that is what is measured here.
const envPeak = (sig, f0) => {
  // the loudest HARMONIC, in Hz — the spectral envelope sampled where the
  // string actually puts energy
  let best = f0, bestM = -1;
  for (let k = 1; k * f0 < 7000; k++) {
    const m = magAt(sig, SR * 1.2 | 0, 16384, k * f0);
    if (m > bestM) { bestM = m; best = k * f0; }
  }
  return best;
};
ok("E4a the body STAYS PUT when the note moves — it is a resonator, not a tone control", () => {
  const lo = envPeak(SIGS[293.6648], 293.6648), hi = envPeak(SIGS[587.33], 587.33);
  console.log("       loudest partial: D4 -> " + lo.toFixed(0) + " Hz, D5 -> " + hi.toFixed(0) +
              " Hz (the note doubled; the peak moved ×" + (hi / lo).toFixed(2) + ")");
  assert.ok(Math.abs(Math.log2(hi / lo)) < 0.6,
    "the loudest partial moved with the note (×" + (hi / lo).toFixed(2) +
    ") — that is a filter following the pitch, not a body");
  for (const [nm, f] of [["D4", lo], ["D5", hi]])
    assert.ok(f > 1180 * 0.85 && f < 1180 * 3.2,
      nm + "'s loudest partial (" + f.toFixed(0) + " Hz) is outside the membrane's own band");
});
ok("E4b …and it IS the membrane: moving `skin` moves it, and moves nothing else", () => {
  const at = (skin) => envPeak(SKINS[skin], 293.6648);
  const a = at(800), b = at(1800);
  console.log("       skin 800 Hz -> loudest partial " + a.toFixed(0) +
              " Hz;  skin 1800 Hz -> " + b.toFixed(0) + " Hz");
  assert.ok(b > a * 1.4, "the skin moved 2.25× and the body did not follow (" +
    a.toFixed(0) + " -> " + b.toFixed(0) + " Hz)");
  // and the NOTE did not move with it
  for (const sk of [800, 1800]) {
    const pk = peakOf(dft(SKINS[sk], SR * 1.2 | 0, 16384, SR, 276, 312, 0.2));
    assert.ok(Math.abs(cents(pk.f, 293.6648)) < 12,
      "retuning the skin retuned the string (" + pk.f.toFixed(2) + " Hz at skin " + sk + ")");
  }
});

/* ---- E6 velocity is physical ------------------------------------------- */
ok("E6 `force` is bow pressure, not a fader: it moves the TIMBRE", () => {
  const centroid = (sig) => {
    const b = dft(sig, SR * 1.2 | 0, 8192, SR, 150, 6000, 25);
    let num = 0, den = 0;
    for (const x of b) { num += x.f * x.mag; den += x.mag; }
    return num / (den || 1e-12);
  };
  const cSoft = centroid(SOFT), cHard = centroid(HARD);
  const lSoft = rms(SOFT, SR, SR * 2), lHard = rms(HARD, SR, SR * 2);
  const dTimbre = cHard / cSoft, dLevel = lHard / (lSoft || 1e-12);
  console.log("       centroid " + cSoft.toFixed(0) + " Hz -> " + cHard.toFixed(0) +
              " Hz (×" + dTimbre.toFixed(2) + "), level ×" + dLevel.toFixed(2));
  assert.ok(Math.abs(Math.log2(dTimbre)) > 0.12,
    "bow force moved the centroid by only ×" + dTimbre.toFixed(3) + " — velocity is a fader");
});

/* ---- E7 the slide is the string ---------------------------------------- */
ok("E7 hua yin: a pitch change ARRIVES through the notes between", () => {
  // AUTOCORRELATION, not a spectral peak: this instrument's BODY is the
  // loudest thing in its own spectrum (that is the finding of E4/E5), so
  // "the tallest bin" is the membrane, not the note. A period estimate
  // reads the string.
  const pitchAt = (sig, tSec) => {
    const win = 4096, from = Math.floor(SR * tSec);
    let best = 0, bestR = -2;
    for (let lag = Math.floor(SR / 900); lag <= Math.floor(SR / 200); lag++) {
      let num = 0, a = 0, b = 0;
      for (let i = 0; i < win; i++) {
        const x = sig[from + i], y = sig[from + i + lag];
        num += x * y; a += x * x; b += y * y;
      }
      const r = num / (Math.sqrt(a * b) || 1e-15);
      if (r > bestR) { bestR = r; best = lag; }
    }
    return SR / best;
  };
  const before = pitchAt(GLIDE, 0.8), during = pitchAt(GLIDE, 1.06), after = pitchAt(GLIDE, 2.0);
  console.log("       " + before.toFixed(1) + " Hz -> (mid-slide " + during.toFixed(1) +
              " Hz) -> " + after.toFixed(1) + " Hz");
  assert.ok(after > before * 1.15, "the slide never arrived (" + before.toFixed(1) + " -> " + after.toFixed(1) + ")");
  assert.ok(during > before * 1.01 && during < after * 0.99,
    "mid-slide the pitch is not BETWEEN the two notes (" + during.toFixed(1) + " Hz) — that is a jump, not a hua yin");
});

/* ---- E5 not a violin patch --------------------------------------------- */
ok("E5 measured against pm.violinModel at the same pitch, it is a different instrument", () => {
  const band = (sig, lo, hi) => {
    const b = dft(sig, SR * 1.2 | 0, 8192, SR, lo, hi, 25);
    let s = 0; for (const x of b) s += x.mag * x.mag; return Math.sqrt(s);
  };
  const centroid = (sig) => {
    const b = dft(sig, SR * 1.2 | 0, 8192, SR, 150, 6000, 25);
    let num = 0, den = 0;
    for (const x of b) { num += x.f * x.mag; den += x.mag; }
    return num / (den || 1e-12);
  };
  const cE = centroid(SIGS[440]), cV = centroid(VIOLIN);
  // the membrane band (skin*1.5..2.2) against everything below it: the erhu's
  // signature is that its BODY is loud, and it sits up there.
  const memE = band(SIGS[440], 1700, 2700) / (band(SIGS[440], 300, 1200) || 1e-12);
  const memV = band(VIOLIN, 1700, 2700) / (band(VIOLIN, 300, 1200) || 1e-12);
  console.log("       centroid   erhu " + cE.toFixed(0) + " Hz   violin " + cV.toFixed(0) + " Hz");
  console.log("       membrane-band / low-band   erhu " + memE.toFixed(3) +
              "   violin " + memV.toFixed(3));
  assert.ok(Math.abs(Math.log2(cE / cV)) > 0.25,
    "the two centroids are within a third of an octave (" + cE.toFixed(0) + " vs " + cV.toFixed(0) + ") — this is a violin patch");
  assert.ok(memE > memV * 1.5,
    "the erhu does not carry more membrane-band energy than the violin (" +
    memE.toFixed(3) + " vs " + memV.toFixed(3) + ")");
});

/* ---- the nukernel bridge, for E8b ---------------------------------------- */
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
window.__REGISTRY = require(R("engine/registry-data.js"));
const TE = await import(R("nukernel/audio/to-engine.js"));

/* ---- E8 the unit exists, and a chair can reach it ------------------------
   The measurements above are of a wasm file. This one is of the ENGINE: the
   model has to become a UNIT the scheduler can seat, or it is a dsp nobody can
   play — which is this box's own characteristic bug ("declared but never
   arriving"). Both halves are checked from the outside, through the same two
   doors the page uses. */
{
  const SE = require(R("engine/faust/voices/state-engine.js"));
  ok("E8a state-engine builds an erhu UNIT with the instrument's own compass", () => {
    const u = SE.pitchedUnit("melody", { model: "erhu" }, { bpm: 100, seed: 1 });
    assert.ok(u, "pitchedUnit returned nothing for model erhu");
    assert.strictEqual(u.module, "erhu", "module is " + u.module);
    // the ZIM's range, not the model's: D4 (its own inside open string) to A7
    assert.ok(Math.abs(u.freqMin - 293.66) < 0.1, "freqMin " + u.freqMin);
    assert.strictEqual(u.freqMax, 3520, "freqMax " + u.freqMax);
    // hua yin: the chair slides, and on the parent's own slide door
    assert.strictEqual(u.slideParam, "glide", "slideParam " + u.slideParam);
    assert.ok(u.slideSec > 0, "slideSec " + u.slideSec);
    // velocity is a bow arm, not a fader
    assert.deepStrictEqual(u.dyn, SE.MODEL_DYN.erhu, "dyn is not the erhu row");
    // and every param the unit writes is one the MODULE actually has
    const meta = JSON.parse(fs.readFileSync(R("engine/faust/dist/erhu-meta.json"), "utf8"));
    const have = new Set();
    (function walk(items) { for (const it of items || [])
      it.items ? walk(it.items) : have.add(it.label); })(meta.ui);
    const orphan = Object.keys(u.params).filter((k) => !have.has(k));
    assert.strictEqual(orphan.length, 0,
      "the unit writes params the dsp does not have: " + orphan.join(", ") +
      " (the module has " + [...have].sort().join(" ") + ")");
    for (const k of Object.keys(SE.MODEL_DYN.erhu))
      assert.ok(have.has(k), "MODEL_DYN.erhu moves `" + k + "`, which the dsp does not expose");
    console.log("       unit: module " + u.module + ", " + u.freqMin.toFixed(0) + "-" +
      u.freqMax + " Hz, slide " + u.slideSec + "s, params " +
      Object.keys(u.params).sort().join(" "));
  });
  ok("E8b a nukernel chair seated on `erhu` routes to it, and is not unrouted", () => {
    const un = [];
    const r = TE.recipeFor("line", { instr: null, synth: { dsp: "erhu" } }, {}, un);
    assert.strictEqual(r.source, "synth:erhu", "routed " + r.source +
      (un.length ? " (" + un[0].why + ")" : ""));
    assert.strictEqual(un.length, 0, "unrouted: " + JSON.stringify(un));
    assert.strictEqual(r.m.model, "erhu", "the recipe's model is " + r.m.model);
    assert.strictEqual(TE.pageTrim("erhu"), 1.78, "no page trim for erhu");
    console.log("       recipe: " + r.source + " -> model " + r.m.model +
      ", page trim " + TE.pageTrim("erhu"));
  });
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
})();
