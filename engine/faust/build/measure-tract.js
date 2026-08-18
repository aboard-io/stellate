#!/usr/bin/env node
// measure-tract.js — IS THE TUBE A TUBE?
//
// measure-instrument.js beside this one asks whether a synthesis model behaves
// like an INSTRUMENT: pitch, body, ring, dynamics, timbre. A vocal tract fails
// differently. It can pass every one of those questions — steady pitch, plenty
// of body, loudness monotone in effort — while being a resonant filter bank
// wearing a mouth's name, and the difference only shows up in the two places a
// filter bank cannot follow: WHERE the formants sit for a given articulation,
// and WHICH WAY they move when the articulation changes. So this measures the
// physics rather than the musicality, and it does it symbolically, offline, in
// node, on the same faustwasm processor the press uses. No browser, no ears.
//
// Eight questions. The first two are the whole argument for building a
// waveguide instead of reusing dsp/voice_tract.lib's five bandpasses:
//
//   VOWELS   the five cardinal vowels must put F1 and F2 in their published
//            regions (Peterson & Barney 1952, male means). A tube of the right
//            length with a constriction in the right place does this by
//            physics; a filter bank does it by being told the answer.
//   LOCUS    /b/ /d/ /g/ differ ONLY in where the closure is. Out of the
//            release, F2 must move in the direction the place of closure
//            dictates — up out of a labial closure into /a/, down out of an
//            alveolar one. That transition is a consequence of a tube changing
//            shape and there is no way to ask a bandpass for it.
//   NOSE     /m/ is a closed mouth and an open nose. With the velum shut the
//            same closure must go quiet; with it open the murmur must come out.
//   FRICTION noise injected AT the constriction must sit where the constriction
//            is: a front constriction has a short front cavity and a high
//            spectrum, a back one a low. Noise at the glottis cannot do this.
//   PITCH    the glottis must sound at the frequency it was asked for.
//   SAFETY   no NaN, no runaway, bounded output at every parameter extreme —
//            a scattering ladder with a 1/(A1+A2) in every junction is exactly
//            the kind of thing that divides by zero at a closure.
//   SEED     the babble driver must render the same twice and differently on a
//            different seed, because everything in this tree is a seeded render.
//   BABBLE   and the envelope must be SYLLABIC at the rate it was asked for,
//            which is the difference between an instrument that says something
//            and one that holds a vowel while its parameters wobble.
//
// Usage:
//   node measure-tract.js                 dsp/tract_voice.dsp, all seven
//   node measure-tract.js --dist          the committed dist/ module instead
//   node measure-tract.js --only vowels,locus
"use strict";
const fs = require("fs");
const path = require("path");

const SR = 44100, BS = 64;
const FW = path.join(__dirname, "..", "node_modules/@grame/faustwasm");
const DIST = path.join(__dirname, "..", "dist");
const DSP = path.join(__dirname, "..", "dsp", "tract_voice.dsp");

const argv = process.argv.slice(2);
const has = (f) => argv.includes("--" + f);
const val = (f, d) => { const i = argv.indexOf("--" + f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

// ---- analysis ---------------------------------------------------------------
// FORMANTS BY LPC, not by picking FFT peaks. A voiced tract's spectrum is a
// comb of harmonics under a formant envelope, so the loudest bin near F1 is
// whichever harmonic happens to land there — the same accident the sibling
// tool's octave guard exists for. LPC fits the ENVELOPE and ignores the comb.
// The signal is decimated to 11.025 kHz first so that an order-14 fit spends
// all seven of its pole pairs below 5.5 kHz, where the formants are; at 44.1
// kHz the same order has to cover 22 kHz and resolves nothing.
const DEC = 4, FS = SR / DEC;

function decimate(x, a, b) {
  const h = [1, 3, 6, 7, 6, 3, 1], hs = 27;
  const n = Math.max(0, Math.floor((b - a) / DEC)), y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0; const c = a + i * DEC;
    for (let j = 0; j < 7; j++) { const q = c + j - 3; s += h[j] * (q >= 0 && q < x.length ? x[q] : 0); }
    y[i] = s / hs;
  }
  return y;
}

/**
 * ADAPTIVE PRE-EMPHASIS. LPC fits an all-pole envelope to whatever tilt it is
 * handed, so a rising or falling excitation drags the poles with it: measured on
 * this instrument, a whispered /a/ read F1 848 with a white source and F1 552
 * with a dark one, against a true 730. Textbook analysis removes a FIXED
 * 6 dB/oct because a voiced glottal source is -12 and radiation is +6; this
 * instrument's source tilt changes with `breath` and `push`, so the coefficient
 * is measured from the signal's own first lag instead. y[n] = x[n] - a x[n-1]
 * with a = r[1]/r[0] whitens the first-order tilt exactly, and leaves the
 * formants — which are second order and up — where they were.
 */
function preEmph(y) {
  let r0 = 0, r1 = 0;
  for (let i = 0; i < y.length; i++) r0 += y[i] * y[i];
  for (let i = 1; i < y.length; i++) r1 += y[i] * y[i - 1];
  const a = r0 > 0 ? Math.max(-0.99, Math.min(0.99, r1 / r0)) : 0;
  const z = new Float64Array(y.length);
  for (let i = 1; i < y.length; i++) z[i] = y[i] - a * y[i - 1];
  return z;
}

function lpc(y0, order) {
  const y = preEmph(y0);
  const n = y.length;
  if (n < order * 3) return null;
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = y[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)));
  const r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) { let s = 0; for (let i = 0; i + k < n; i++) s += w[i] * w[i + k]; r[k] = s; }
  if (!(r[0] > 0)) return null;
  r[0] *= 1.0001;                       // ridge: keeps Levinson off a singular matrix
  const a = new Float64Array(order + 1); a[0] = 1; let e = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i]; for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / e, prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k; e *= (1 - k * k);
    if (!(e > 0)) return null;
  }
  return a;
}

/** every maximum of the LPC envelope as [Hz, height], lowest first. */
function envPeaks(x, a0, b0, order = 14) {
  const a = lpc(decimate(x, a0, b0), order);
  if (!a) return [];
  const M = 2048, env = new Float64Array(M), out = [];
  for (let m = 0; m < M; m++) {
    const w = Math.PI * m / M; let re = 0, im = 0;
    for (let k = 0; k < a.length; k++) { re += a[k] * Math.cos(-w * k); im += a[k] * Math.sin(-w * k); }
    env[m] = 1 / Math.hypot(re, im);
  }
  for (let m = 1; m < M - 1; m++) if (env[m] > env[m - 1] && env[m] > env[m + 1]) {
    const d = env[m - 1] - 2 * env[m] + env[m + 1];
    const off = d !== 0 ? 0.5 * (env[m - 1] - env[m + 1]) / d : 0;
    out.push([(m + off) * (FS / 2) / M, env[m]]);
  }
  return out.filter((p) => p[0] > 170 && p[0] < 5000);
}

/**
 * FORMANTS FROM THE POLE ROOTS, not from the bumps in the envelope. Two
 * formants 260 Hz apart with 70 Hz bandwidths do not make two bumps, they make
 * one wide one — and picking maxima then reports the second formant as whatever
 * is above the pair. Measured: /o/, whose F1 and F2 sit at 575 and 834, read as
 * "575 and 2445" off the envelope, i.e. F2 missing and F3 promoted. The roots
 * of the LPC polynomial are still two distinct poles whether or not their peaks
 * merge, so they are what gets read. Durand-Kerner, because a degree-14 monic
 * with well-separated roots needs nothing cleverer.
 */
function polyRoots(c) {
  const n = c.length - 1;
  const zr = new Float64Array(n), zi = new Float64Array(n);
  for (let i = 0; i < n; i++) {                       // spiral start: no two roots coincide
    const ang = 2 * Math.PI * i / n + 0.4, r = 0.4 + 0.6 * i / n;
    zr[i] = r * Math.cos(ang); zi[i] = r * Math.sin(ang);
  }
  for (let it = 0; it < 600; it++) {
    let worst = 0;
    for (let i = 0; i < n; i++) {
      let pr = 1, pi = 0;
      for (let k = 1; k <= n; k++) {
        const nr = pr * zr[i] - pi * zi[i] + c[k], ni = pr * zi[i] + pi * zr[i];
        pr = nr; pi = ni;
      }
      let dr = 1, di = 0;
      for (let j = 0; j < n; j++) if (j !== i) {
        const ar = zr[i] - zr[j], ai = zi[i] - zi[j];
        const nr = dr * ar - di * ai, ni = dr * ai + di * ar;
        dr = nr; di = ni;
      }
      const den = dr * dr + di * di;
      if (den < 1e-30) continue;
      const qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
      zr[i] -= qr; zi[i] -= qi;
      worst = Math.max(worst, Math.hypot(qr, qi));
    }
    if (worst < 1e-13) break;
  }
  return { zr, zi };
}

/**
 * FOUR FRAMES AND A MEDIAN. A single Levinson fit on a single window is not
 * always a good fit: on /u/, whose F1 and F2 are 330 and 885 with a 1.3 kHz gap
 * above them, the 200 ms and 250 ms windows dropped both low poles and reported
 * 863/2142, while 100, 140 and 340 ms windows on the SAME render all read
 * 393/886. Nothing about the signal changed, so the reading was the analyser's
 * and not the instrument's. Four overlapping frames and a per-index median
 * throws the bad fit away, which is what every formant tracker does and what
 * this one should have done from the start.
 */
function formantsRobust(x, a, b, order = 14) {
  const W = Math.floor(SR * 0.12), hop = Math.max(1, Math.floor((b - a - W) / 3));
  const frames = [];
  for (let i = 0; i < 4; i++) {
    const fm = formants(x, a + i * hop, a + i * hop + W, order);
    if (fm.length >= 2) frames.push(fm);
  }
  if (!frames.length) return [];
  const wide = Math.max(...frames.map((f) => f.length)), out = [];
  for (let k = 0; k < wide; k++) {
    const vs = frames.map((f) => f[k]).filter(Number.isFinite).sort((p, q) => p - q);
    if (vs.length * 2 >= frames.length) out.push(vs[Math.floor(vs.length / 2)]);
  }
  return out;
}

/** formants in Hz, lowest first: resonant pole pairs inside the band. */
function formants(x, a0, b0, order = 14) {
  const a = lpc(decimate(x, a0, b0), order);
  if (!a) return [];
  const { zr, zi } = polyRoots(Array.from(a));
  const out = [];
  for (let i = 0; i < zr.length; i++) {
    if (zi[i] <= 0) continue;                          // one of each conjugate pair
    const mag = Math.hypot(zr[i], zi[i]);
    if (!(mag > 0.02) || mag >= 1.2) continue;
    const f = Math.atan2(zi[i], zr[i]) * FS / (2 * Math.PI);
    const bw = -Math.log(Math.min(0.9999, mag)) * FS / Math.PI;
    // a formant is a RESONANCE: a pole so damped it is 700 Hz wide is the
    // spectral tilt the fit could not whiten, not a cavity. This model's formant
    // bandwidths are set by two filters in the loop and measure about 70 Hz, so
    // 400 is loose by a factor of five and still drops the pole the fit likes to
    // park in /i/'s 2 kHz gap between F1 and F2.
    if (f > 170 && f < 5000 && bw < 400) out.push(f);
  }
  return out.sort((p, q) => p - q);
}

/** where the LOUDEST resonance sits — for a fricative, the front cavity. */
function loudestPeak(x, a0, b0, lo, order = 14) {
  const ps = envPeaks(x, a0, b0, order).filter((p) => p[0] >= lo);
  return ps.length ? ps.reduce((m, p) => (p[1] > m[1] ? p : m))[0] : NaN;
}

const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
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

/** spectral centroid in Hz over one hann frame. */
function centroid(x, off, N) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (off + i < x.length ? x[off + i] : 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); num += (k * SR / N) * m; den += m; }
  return den > 0 ? num / den : 0;
}

/** f0 by autocorrelation — the period is what all the partials share. */
function f0(x, off, N, lo, hi) {
  const seg = new Float64Array(N); let mean = 0;
  for (let i = 0; i < N; i++) { seg[i] = off + i < x.length ? x[off + i] : 0; mean += seg[i]; }
  mean /= N; for (let i = 0; i < N; i++) seg[i] -= mean;
  const minLag = Math.max(2, Math.floor(SR / hi)), maxLag = Math.min(N - 2, Math.ceil(SR / lo));
  let r0 = 0; for (let i = 0; i < N; i++) r0 += seg[i] * seg[i];
  if (!(r0 > 0)) return 0;
  const nrmAt = (lag) => {
    let s = 0, e = 0;
    for (let i = 0; i + lag < N; i++) { s += seg[i] * seg[i + lag]; e += seg[i + lag] * seg[i + lag]; }
    return e > 0 ? s / Math.sqrt(r0 * e) : 0;
  };
  let best = -1, bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) { const v = nrmAt(lag); if (v > best) { best = v; bestLag = lag; } }
  if (bestLag < 2 || best < 0.15) return 0;
  for (const div of [3, 2]) {                       // octave guard, same as the sibling tool
    const lag = Math.round(bestLag / div);
    if (lag >= minLag && nrmAt(lag) >= best * 0.9) { bestLag = lag; break; }
  }
  const at = (lag) => { let s = 0; for (let i = 0; i + lag < N; i++) s += seg[i] * seg[i + lag]; return s; };
  const ym1 = at(bestLag - 1), y0 = at(bestLag), yp1 = at(bestLag + 1);
  const d = ym1 - 2 * y0 + yp1;
  return SR / (d !== 0 ? bestLag + 0.5 * (ym1 - yp1) / d : bestLag);
}

// ---- faust plumbing ---------------------------------------------------------
let _gen = null, _compiler = null;
async function generator() {
  if (!_gen) { const { FaustMonoDspGenerator } = await import(path.join(FW, "dist/esm/index.js")); _gen = new FaustMonoDspGenerator(); }
  return _gen;
}
async function compiler() {
  if (!_compiler) {
    const { instantiateFaustModuleFromFile, LibFaust, FaustCompiler } = await import(path.join(FW, "dist/esm/index.js"));
    _compiler = new FaustCompiler(new LibFaust(await instantiateFaustModuleFromFile(path.join(FW, "libfaust-wasm/libfaust-wasm.js"))));
    const libDir = path.join(__dirname, "..", "dsp");
    for (const f of fs.readdirSync(libDir).filter((x) => x.endsWith(".lib")).sort())
      _compiler.fs().writeFile(f, fs.readFileSync(path.join(libDir, f), "utf8"));
  }
  return _compiler;
}
async function factoryFor(useDist) {
  if (useDist) {
    const code = fs.readFileSync(path.join(DIST, "tract_voice-module.wasm"));
    return { code: new Uint8Array(code), module: await WebAssembly.compile(code),
             json: fs.readFileSync(path.join(DIST, "tract_voice-meta.json"), "utf8"), poly: false, cfactory: 0 };
  }
  const d = await (await generator()).compile(await compiler(), "tract_voice", fs.readFileSync(DSP, "utf8"), "-ftz 2");
  if (!d || !d.factory) throw new Error("compile produced no factory");
  return d.factory;
}
function addressBook(json) {
  const meta = JSON.parse(json), book = {};
  (function walk(items) { for (const it of items || []) it.items ? walk(it.items) : (book[it.label.trim().split(/\s/)[0]] = it.address); })(meta.ui);
  return book;
}

/**
 * Render `secs` seconds. `plan(t, set)` runs once per 64-sample block, which is
 * 1.45 ms — finer than any articulation this instrument can make, so a ramped
 * gesture measures as a gesture and not as a staircase.
 */
async function play(factory, book, base, secs, plan) {
  const proc = await (await generator()).createOfflineProcessor(SR, BS, factory);
  const set = (k, v) => { if (book[k] != null) proc.setParamValue(book[k], v); };
  for (const [k, v] of Object.entries(base || {})) set(k, v);
  const total = Math.floor(SR * secs), out = new Float32Array(total);
  for (let s = 0; s < total; s += BS) {
    if (plan) plan(s / SR, set);
    const len = Math.min(BS, total - s);
    out.set((proc.render([], len))[0].subarray(0, len), s);
  }
  return out;
}

// ---- the articulations under test -------------------------------------------
// The five vowel articulations are the ones dsp/tract.lib ships in its table;
// they are named here only so the report can print what it asked for.
const VOWELS = [
  { name: "i", idx: 0, F: [270, 2290] },
  { name: "e", idx: 1, F: [530, 1840] },
  { name: "a", idx: 2, F: [730, 1090] },
  { name: "o", idx: 3, F: [570,  840] },
  { name: "u", idx: 4, F: [300,  870] },
];
/**
 * THE VOWEL TARGETS ARE READ OUT OF THE LIBRARY, never copied beside it. The
 * table is fitted (see --fit), so a copy here would be a second source of truth
 * that goes stale the first time it is refitted — and the locus test would then
 * be ramping toward a vowel the instrument no longer has.
 */
function vowelTable() {
  const src = fs.readFileSync(path.join(__dirname, "..", "dsp", "tract.lib"), "utf8");
  const row = (k) => {
    const m = src.match(new RegExp(`ktVow${k}\\(v\\)[^(]*\\(\\(([^)]*)\\)\\)`));
    if (!m) throw new Error(`tract.lib has no ktVow${k} table`);
    return m[1].split(",").map(Number);
  };
  const tp = row("Tp"), td = row("Td"), tl = row("Tl"), lp = row("Lp");
  return VOWELS.map((v, i) => ({ tongue: tp[i], tongueD: td[i], tongueL: tl[i], lips: lp[i] }));
}
// a closure, as tract.lib's own consonant table spells it: a labial shuts the
// LIPS and leaves the tongue in the vowel; the other two shut the tongue
// against the ridge or the velum and leave the lips alone.
const shutFor = (c, V) => ({
  b: { ...V, lips: 0.00 },
  d: { ...V, tongue: 0.80, tongueD: 0.0, tongueL: 0.10 },
  g: { ...V, tongue: 0.55, tongueD: 0.0, tongueL: 0.13 },
}[c]);

const VOICE = { gate: 1, artic: 0, babble: 0, freq: 120, push: 0.5, open: 0.62,
                breath: 0, voiced: 1, vibrato: 0, attack: 0.005, release: 0.05,
                level: 1, gain: 1, cutoff: 16000 };

// ---- the seven questions ----------------------------------------------------
const results = [];
const say = (ok, line) => { results.push(ok); console.log(`   ${ok ? "ok  " : "FAIL"} ${line}`); };
const n0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : "--");

async function qVowels(f, bk) {
  console.log("\n== VOWELS  F1/F2 against Peterson & Barney male means");
  for (const v of VOWELS) {
    // WHISPERED on purpose: breath=1 replaces the glottal pulse with aspiration,
    // which is flat enough that the LPC fit sees the tract and not the comb.
    const x = await play(f, bk, { ...VOICE, breath: 1, vowel: v.idx }, 0.75);
    const fm = formantsRobust(x, Math.floor(SR * 0.25), x.length);
    const [F1, F2] = fm;
    const e1 = Math.abs(F1 / v.F[0] - 1), e2 = Math.abs(F2 / v.F[1] - 1);
    say(e1 <= 0.25 && e2 <= 0.20,
      `/${v.name}/  F1 ${n0(F1)} (want ${v.F[0]}, ${(e1 * 100).toFixed(1)}%)   ` +
      `F2 ${n0(F2)} (want ${v.F[1]}, ${(e2 * 100).toFixed(1)}%)   [${fm.slice(0, 4).map(n0).join(" ")}]`);
  }
}

/** F2 track over the 90 ms after a closure release into /a/. */
async function locusTrack(f, bk, shut, V) {
  const T0 = 0.22, T1 = 0.28;                        // release, and the end of the ramp
  const x = await play(f, bk, { ...VOICE, artic: 1, freq: 110, ...shut }, 0.55, (t, set) => {
    const m = Math.max(0, Math.min(1, (t - T0) / (T1 - T0)));
    for (const k of ["tongue", "tongueD", "tongueL", "lips"]) set(k, shut[k] * (1 - m) + V[k] * m);
  });
  // ONSET IS NOT THE FIRST FRAME. A window that starts 6 ms after release still
  // straddles the closure and the burst, and reads whatever the sealed cavity
  // was doing: measured, /da/ came back 1828, then 4156, then 999 on consecutive
  // frames. Phonetics measures the onset at the first few glottal pulses after
  // the release, so the track starts at +12 ms on a 20 ms window and the onset
  // is the frame at +24 ms.
  const track = [];
  for (let t = T0 + 0.012; t <= T0 + 0.11; t += 0.006) {
    const a = Math.floor(SR * t), fm = formants(x, a, a + Math.floor(SR * 0.020), 12);
    if (fm.length >= 2) track.push([t - T0, fm[1]]);
  }
  return track;
}

async function qLocus(f, bk) {
  const T = vowelTable();
  const A = T[2], I = T[0];
  console.log("\n== LOCUS   F2 out of a closure, tracked every 6 ms across the release");
  const seen = {};
  const run = async (label, c, V) => {
    const tr = await locusTrack(f, bk, shutFor(c, V), V);
    if (tr.length < 4) { say(false, `${label}  no formant track`); return null; }
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (const [t, F] of tr) { sx += t; sy += F; sxy += t * F; sxx += t * t; }
    const nn = tr.length;
    // MEDIAN OF THE FIRST THREE FRAMES. Even at +12 ms one frame in three comes
    // back wrong — /da/ read 1826, 2704, then 4165 on consecutive hops — because
    // a 20 ms window that early still has the burst in it. Three frames and a
    // median is the smallest thing that stops a single bad fit from becoming the
    // number the verdict is written on.
    const head = tr.slice(0, 3).map((p) => p[1]).sort((p, q) => p - q);
    const row = { onset: head[Math.floor(head.length / 2)], end: tr[tr.length - 1][1],
                  slope: (nn * sxy - sx * sy) / (nn * sxx - sx * sx) / 100 };
    console.log(`        ${label}  F2 ${n0(row.onset)} -> ${n0(row.end)} Hz, ` +
      `slope ${row.slope >= 0 ? "+" : ""}${row.slope.toFixed(0)} Hz/10ms   ` +
      `[${tr.filter((_, i) => i % 3 === 0).map((p) => n0(p[1])).join(" ")}]`);
    return row;
  };
  seen.ba = await run("/ba/", "b", A);
  seen.da = await run("/da/", "d", A);
  seen.ga = await run("/ga/", "g", A);
  seen.gi = await run("/gi/", "g", I);
  if (seen.ba && seen.da) {
    say(seen.ba.slope > 0, `/ba/ F2 RISES out of the labial closure (${seen.ba.slope.toFixed(0)} Hz/10ms)`);
    say(seen.da.slope < 0, `/da/ F2 FALLS out of the alveolar closure (${seen.da.slope.toFixed(0)} Hz/10ms)`);
    say(seen.da.onset > seen.ba.onset + 200,
      `the alveolar locus sits ${n0(seen.da.onset - seen.ba.onset)} Hz above the labial one`);
  }
  // THE VELAR PINCH. A velar closure has no single locus: it is high before a
  // front vowel and low before a back one, because what is in front of the
  // closure is the vowel's own mouth. That is a geometric fact about a tube and
  // the sharpest thing in this whole file that a formant bank cannot imitate.
  if (seen.ga && seen.gi) say(seen.gi.onset > seen.ga.onset + 400,
    `the velar pinch: /gi/ leaves at ${n0(seen.gi.onset)} Hz, /ga/ at ${n0(seen.ga.onset)}`);
}

async function qNose(f, bk) {
  console.log("\n== NOSE    a closed mouth, with the velum open and shut");
  const closed = { ...VOICE, artic: 1, freq: 110, ...shutFor("b", vowelTable()[2]) };
  const open = await play(f, bk, { ...closed, velum: 1 }, 0.5);
  const shut = await play(f, bk, { ...closed, velum: 0 }, 0.5);
  const a = Math.floor(SR * 0.25), b = Math.floor(SR * 0.45);
  const ro = rms(open, a, b), rs = rms(shut, a, b);
  const dB = 20 * Math.log10(ro / Math.max(1e-12, rs));
  const fm = formantsRobust(open, a, b, 12);
  say(dB >= 20, `/m/ with the velum open is ${dB.toFixed(1)} dB above the same closure with it shut`);
  // THE MURMUR RUNS HIGH and the model says why. The nasal path here is the
  // 9.1 cm of pharynx up to the velum plus a 12.7 cm uniform nose: a quarter
  // wave at 21.8 cm is 401 Hz, and that is what comes out. A real murmur sits
  // at 250-300 because the nasal cavity is not a uniform tube — the sinuses
  // hang off it as side branches and load it down. Modelling those is a second
  // waveguide per sinus, which is not worth it to move one formant, so the
  // check holds the model to its own arithmetic rather than to a person's.
  say(fm.length > 0 && fm[0] < 520, `nasal murmur formant at ${n0(fm[0])} Hz (the tube's own quarter wave is 401)`);
}

async function qFriction(f, bk) {
  console.log("\n== FRICTION  noise injected at the constriction, front vs back");
  const base = { ...VOICE, artic: 1, voiced: 0, fric: 1, tongueD: 0.06, tongueL: 0.09, lips: 1 };
  const rows = [];
  for (const [name, place] of [["front /s/", 0.88], ["mid /\u0283/", 0.74], ["back /x/", 0.55]]) {
    // the noise goes just downstream of the constriction, which is where the
    // jet actually breaks up, and is what gives the front cavity something to
    // resonate on.
    const x = await play(f, bk, { ...base, tongue: place, fricX: Math.min(0.99, place + 0.07) }, 0.5);
    const a = Math.floor(SR * 0.25);
    const c = centroid(x, a, 8192);
    // the FRONT CAVITY quarter-wave, which is the physics being tested: at
    // 17.5 cm and 350 m/s a constriction at 0.88 leaves 2.1 cm in front of it
    // and should peak near 4.2 kHz; at 0.55 it leaves 7.9 cm and 1.1 kHz.
    const want = 350 / (4 * 0.1746 * (1 - place));
    const pk = loudestPeak(x, a, a + Math.floor(SR * 0.2), 900, 12);
    rows.push([name, place, c, pk]);
    console.log(`        ${name.padEnd(9)} constriction at ${place.toFixed(2)}  peak ${n0(pk)} Hz ` +
      `(front cavity says ${n0(want)})  centroid ${n0(c)} Hz`);
  }
  say(rows[0][3] > rows[1][3] && rows[1][3] > rows[2][3],
    "the resonance walks DOWN as the constriction walks back — the front cavity is real");
  say(rows[0][2] > rows[2][2], `and the centroid follows it: ${n0(rows[0][2])} Hz front, ${n0(rows[2][2])} Hz back`);
}

async function qPitch(f, bk) {
  console.log("\n== PITCH   the glottis against the note it was asked for");
  let worst = 0;
  for (const midi of [36, 43, 50, 57, 64]) {
    const want = 440 * Math.pow(2, (midi - 69) / 12);
    const x = await play(f, bk, { ...VOICE, freq: want, vowel: 2, breath: 0 }, 0.6);
    const heard = f0(x, Math.floor(SR * 0.30), 8192, want * 0.4, want * 2.6);
    const cents = heard > 0 ? 1200 * Math.log2(heard / want) : NaN;
    worst = Math.max(worst, Math.abs(cents) || 999);
    console.log(`        midi ${String(midi).padStart(3)}  want ${want.toFixed(1)} Hz  heard ${n0(heard)}  ${cents >= 0 ? "+" : ""}${cents.toFixed(1)} cents`);
  }
  say(worst < 25, `worst pitch error ${worst.toFixed(1)} cents`);
}

async function qSafety(f, bk) {
  console.log("\n== SAFETY  every parameter at both stops");
  const knobs = {
    tongue: [0, 1], tongueD: [0, 1], tongueL: [0.05, 0.5], lips: [0, 1], velum: [0, 1],
    fric: [0, 1], push: [0, 1], open: [0.15, 0.95], breath: [0, 1], voiced: [0, 1],
    babble: [0, 1], rate: [0.5, 12], freq: [40, 900], vowel: [0, 4], seed: [0, 4096],
  };
  let worstPeak = 0, bad = [];
  for (const [k, [lo, hi]] of Object.entries(knobs)) for (const v of [lo, hi]) {
    const x = await play(f, bk, { ...VOICE, artic: 1, tongue: 0.5, tongueD: 0.02, lips: 0.2,
                                  fric: 1, babble: 1, [k]: v }, 0.7);
    let pk = 0, nan = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (!Number.isFinite(x[i])) nan++; else if (a > pk) pk = a; }
    if (nan || pk > 4 || !(pk > 0)) bad.push(`${k}=${v} peak ${pk.toFixed(2)} nan ${nan}`);
    worstPeak = Math.max(worstPeak, pk);
  }
  // and the one combination that is a genuine 0/0 if the areas are not floored:
  const shut = await play(f, bk, { ...VOICE, artic: 1, tongue: 0.5, tongueD: 0, tongueL: 0.5, lips: 0, velum: 0 }, 0.7);
  let nan2 = 0, pk2 = 0;
  for (let i = 0; i < shut.length; i++) { if (!Number.isFinite(shut[i])) nan2++; else pk2 = Math.max(pk2, Math.abs(shut[i])); }
  say(bad.length === 0, `${Object.keys(knobs).length * 2} extremes, worst peak ${worstPeak.toFixed(2)}` + (bad.length ? `: ${bad.join("; ")}` : ""));
  say(nan2 === 0 && pk2 < 4, `a fully sealed tract stays finite (peak ${pk2.toFixed(3)}, ${nan2} NaN)`);
}

async function qSeed(f, bk) {
  console.log("\n== SEED    the babble must render the same twice");
  const one = { ...VOICE, babble: 1, rate: 4, seed: 7, freq: 115 };
  const a = await play(f, bk, one, 1.5);
  const b = await play(f, bk, one, 1.5);
  const c = await play(f, bk, { ...one, seed: 8 }, 1.5);
  let same = 0, diff = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) same++; if (a[i] !== c[i]) diff++; }
  say(same === 0, `seed 7 twice: ${same} samples differ out of ${a.length}`);
  say(diff > a.length * 0.2, `seed 8 differs on ${(100 * diff / a.length).toFixed(0)}% of samples`);
  const r = rms(a, 0, a.length);
  say(r > 0.01, `babble at seed 7 is audible: rms ${r.toFixed(4)}, peak ${Math.max(...Array.from(a, Math.abs)).toFixed(3)}`);
}

/**
 * --fit: RE-MEASURE THE VOWEL TABLE. tract.lib's five vowel articulations are
 * not asserted, they are FOUND: a search over tongue position, constriction
 * area, constriction length and lip aperture for the articulation whose F1/F2
 * land nearest the published means — run through the shipping instrument, with
 * the same LPC the checks above use, so the table can never drift away from
 * what the tube actually does. The search is boxed by PHONETICS, not left free:
 * an unconstrained fit finds /a/ with a mid tongue and rounded lips, which is
 * acoustically right and articulatorily nonsense, and a nonsense articulation
 * has no locus and cannot make a consonant. Print, eyeball, paste.
 */
const BOX = {
  i: { tp: [0.55, 0.82], lp: [0.55, 1.00] },
  e: { tp: [0.45, 0.75], lp: [0.50, 1.00] },
  a: { tp: [0.12, 0.40], lp: [0.50, 1.00] },
  o: { tp: [0.20, 0.50], lp: [0.15, 0.55] },
  u: { tp: [0.42, 0.72], lp: [0.10, 0.45] },
};

async function fit(factory, bk) {
  const proc = await (await generator()).createOfflineProcessor(SR, BS, factory);
  const set = (k, v) => { if (bk[k] != null) proc.setParamValue(bk[k], v); };
  for (const [k, v] of Object.entries({ ...VOICE, artic: 1, breath: 1 })) set(k, v);
  // TWO ANALYSERS ON PURPOSE. The coarse sweep is thousands of points, so it
  // gets one short window and one LPC fit; the refinement is a handful, so it
  // gets the same four-frame median the checks use. Fitting the whole search
  // with the cheap reading and then SHIPPING it is how /u/ came to sit 34% off
  // F1 while its own fit report said 11%: the table was fitted to a measurement
  // nothing downstream would ever repeat.
  const buf = new Float32Array(Math.floor(SR * 0.24));
  const long = new Float32Array(Math.floor(SR * 0.75));
  const fill = (b, tp, td, tl, lp) => {
    set("tongue", tp); set("tongueD", td); set("tongueL", tl); set("lips", lp);
    for (let s = 0; s < b.length; s += BS) {
      const len = Math.min(BS, b.length - s);
      b.set((proc.render([], len))[0].subarray(0, len), s);
    }
  };
  const trial = (tp, td, tl, lp) => { fill(buf, tp, td, tl, lp); return formants(buf, Math.floor(SR * 0.10), buf.length); };
  const trialSlow = (tp, td, tl, lp) => { fill(long, tp, td, tl, lp); return formantsRobust(long, Math.floor(SR * 0.25), long.length); };
  const lin = (a, b, n) => Array.from({ length: n }, (_, k) => a + (b - a) * k / (n - 1));
  const out = {};
  for (const v of VOWELS) {
    const box = BOX[v.name];
    let best = { err: Infinity };
    const sweep = (tps, tds, tls, lps) => {
      for (const tp of tps) for (const td of tds) for (const tl of tls) for (const lp of lps) {
        const fm = trial(tp, td, tl, lp);
        if (fm.length < 2) continue;
        const err = Math.abs(Math.log(fm[0] / v.F[0])) + Math.abs(Math.log(fm[1] / v.F[1]));
        if (err < best.err) best = { err, tp, td, tl, lp, fm };
      }
    };
    // A VOWEL CONSTRICTION HAS A FLOOR. Left free, the search drove /a/ to a
    // pharyngeal constriction of 2% area — acoustically a bullseye, 729/1081
    // against 730/1090, and 14 dB quieter than /i/ because the glottis was
    // speaking through a pinhole. A vowel's narrowest point is about a fifth of
    // the tract's mean area, never a fiftieth, so the floor is 0.06.
    sweep(lin(box.tp[0], box.tp[1], 7),
          [0.060, 0.080, 0.105, 0.135, 0.175, 0.23, 0.30, 0.40, 0.52],
          [0.09, 0.14, 0.20, 0.27, 0.35],
          lin(box.lp[0], box.lp[1], 6));
    const near = (c, d, lo, hi) => lin(Math.max(lo, c - d), Math.min(hi, c + d), 5);
    sweep(near(best.tp, 0.05, box.tp[0], box.tp[1]),
          near(best.td, best.td * 0.35 + 0.005, 0.06, 0.6),
          near(best.tl, 0.05, 0.06, 0.42),
          near(best.lp, 0.09, box.lp[0], box.lp[1]));
    // and now the same reading the checks take, over a small box around it
    let fine = { err: Infinity };
    for (const tp of near(best.tp, 0.04, box.tp[0], box.tp[1]))
      for (const td of near(best.td, best.td * 0.3 + 0.004, 0.06, 0.6))
        for (const tl of near(best.tl, 0.045, 0.06, 0.42))
          for (const lp of near(best.lp, 0.07, box.lp[0], box.lp[1])) {
            const fm = trialSlow(tp, td, tl, lp);
            if (fm.length < 2) continue;
            const err = Math.abs(Math.log(fm[0] / v.F[0])) + Math.abs(Math.log(fm[1] / v.F[1]));
            if (err < fine.err) fine = { err, tp, td, tl, lp, fm };
          }
    best = fine.err < Infinity ? fine : best;
    out[v.name] = best;
    console.log(`   /${v.name}/  tongue ${best.tp.toFixed(3)}  dia ${best.td.toFixed(3)}  ` +
      `len ${best.tl.toFixed(3)}  lips ${best.lp.toFixed(3)}   ` +
      `F1 ${n0(best.fm[0])}/${v.F[0]}  F2 ${n0(best.fm[1])}/${v.F[1]}`);
  }
  const row = (k, f) => `ktVow${k}(v) = v : ba.listInterp((${VOWELS.map((v) => f(out[v.name]).toFixed(3)).join(", ")}));`;
  console.log("\n   paste into dsp/tract.lib:\n");
  console.log("   " + row("Tp", (b) => b.tp));
  console.log("   " + row("Td", (b) => b.td));
  console.log("   " + row("Tl", (b) => b.tl));
  console.log("   " + row("Lp", (b) => b.lp));
}

async function qBabble(f, bk) {
  // DOES IT MAKE SYLLABLES? Everything above says the tube is a tube; this says
  // the driver is doing the thing the tube was built for. A held tone has a flat
  // envelope. A mouth opening and closing at `rate` puts a periodic dip in it,
  // once per syllable, and the autocorrelation of the loudness envelope finds
  // that period without knowing what was said.
  console.log("\n== BABBLE  is the envelope syllabic, at the rate it was asked for?");
  const seen = [];
  for (const rate of [2.5, 4, 7]) {
    // 11 s, because the envelope frame count below has to fit inside the render:
    // 2048 frames at 220 samples is 10.2 s, and a frame that runs off the end
    // reads undefined, which turns the whole spectrum into NaN and reports
    // "0.00 Hz" for every rate — a measurement failing silently as a verdict.
    const x = await play(f, bk, { ...VOICE, babble: 1, rate, seed: 11, freq: 118 }, 11.0);
    // COUNT THE ONSETS. Two other statistics were tried on this envelope and
    // both are wrong for a driver that draws a different consonant and vowel
    // every syllable: autocorrelation looks for consecutive syllables that
    // RESEMBLE each other and there are none, and the modulation spectrum of a
    // random sequence has no line in it at all — it peaked at half the asked
    // rate, which is just where a random walk's energy sits. What every syllable
    // does have, whatever it is, is a beginning: the mouth is more closed for
    // the consonant than for the vowel, so the loudness jumps. So count the
    // jumps. A rise of 8 dB inside 40 ms, with a 60 ms refractory so one onset
    // is not counted twice, over ten seconds.
    // THE ENVELOPE HAS TO BE SLOWER THAN THE GLOTTIS. At 118 Hz the period is
    // 8.5 ms, so a 5 ms RMS frame swings 8 dB from one frame to the next purely
    // on where the glottal pulse landed, and the detector counted every one of
    // those: 58 onsets in ten seconds when 25 were asked for. 10 ms frames
    // smoothed across three of them is 30 ms, three and a half glottal periods,
    // and reads the mouth instead of the folds.
    const EW = Math.floor(SR / 100), n = Math.floor(x.length / EW) - 1;
    const raw = new Float64Array(n), env = new Float64Array(n);
    for (let i = 0; i < n; i++) raw[i] = rms(x, i * EW, (i + 1) * EW);
    for (let i = 0; i < n; i++) {
      let acc = 0, cnt = 0;
      for (let j = -1; j <= 1; j++) if (i + j >= 0 && i + j < n) { acc += raw[i + j]; cnt++; }
      env[i] = 20 * Math.log10(acc / cnt + 1e-9);
    }
    const back = 4, refr = 10;                         // 40 ms and 100 ms at 100 Hz
    let onsets = 0, since = 1e9;
    for (let i = back; i < n; i++) {
      since++;
      if (env[i] - env[i - back] >= 8 && since > refr) { onsets++; since = 0; }
    }
    const heard = onsets / (n / 100);
    seen.push([rate, heard]);
    // NOT EVERY SYLLABLE ANNOUNCES ITSELF, and the fraction is a fact about the
    // consonant inventory rather than about the driver. Three of the eight are
    // full stops and jump loudly out of silence; /m/ and /n/ keep radiating
    // through the nose all the way through the closure, /s/ and /f/ are noise
    // that is often LOUDER than the vowel after it, and /l/ barely dips. So the
    // count should land somewhere between half the asked rate and all of it,
    // and it should rise every time the rate does — which is the claim: the
    // mouth is opening and closing on the clock it was handed.
    say(heard >= rate * 0.5 && heard <= rate * 1.05,
      `asked ${rate} syllables/s, the loudness envelope begins ${heard.toFixed(2)} times a second ` +
      `(${(100 * heard / rate).toFixed(0)}% of the syllables, ${onsets} onsets)`);
  }
  say(seen.every((r, i) => i === 0 || r[1] > seen[i - 1][1]),
    `and the count rises with the rate: ${seen.map((r) => r[1].toFixed(2)).join(" -> ")}`);
}

async function main() {
  const t0 = Date.now();
  const factory = await factoryFor(has("dist"));
  const bk = addressBook(factory.json);
  console.log(`tract_voice  (${has("dist") ? "dist/" : "dsp/tract_voice.dsp"})  compiled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`params: ${Object.keys(bk).join(" ")}`);
  if (has("fit")) { console.log("\n== FIT     searching for the five vowel articulations"); await fit(factory, bk); return; }
  const only = val("only", "").split(",").filter(Boolean);
  const all = { vowels: qVowels, locus: qLocus, nose: qNose, friction: qFriction,
                pitch: qPitch, safety: qSafety, seed: qSeed, babble: qBabble };
  for (const [name, fn] of Object.entries(all)) if (!only.length || only.includes(name)) await fn(factory, bk);
  const bad = results.filter((r) => !r).length;
  console.log(`\n${bad ? "FAIL" : "PASS"}  ${results.length - bad}/${results.length} checks, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (bad) process.exit(1);
}

if (require.main === module) main().catch((e) => { console.error(e.stack || e.message || e); process.exit(1); });
module.exports = { formants, envPeaks, loudestPeak, centroid, f0, factoryFor, addressBook, play, SR, BS };
