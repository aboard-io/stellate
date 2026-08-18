#!/usr/bin/env node
// measure-instrument.js — DOES THIS THING BEHAVE LIKE AN INSTRUMENT?
//
// Paul's standing rule for the whole tree is that the SCORE is what gets
// analysed, not a recording. A synthesis model is the one question a score
// cannot answer: nothing in buildEvents knows whether a waveguide actually
// produces the note it was asked for. So this is the exception, and it is kept
// as small as the exception deserves — no browser, no wav files, no render
// farm. faustwasm's offline processor, one note at a time, in node.
//
// The reason it exists is a scar. Three library models have been adopted here
// on the strength of "it compiles and it makes a noise" and all three were
// broken in ways nobody could hear until a genre was already cast on them:
// pm.elecGuitar dies inside 100 ms, pm.brassModel is silent below 300 Hz,
// pm.violinModel's loudness is not monotone in bow force. Each of those is a
// one-line measurement. So before any model is believed, it answers five
// questions that a real instrument cannot fail:
//
//   PITCH      does the note come out at the frequency it was asked for?
//              (measured as cents, on the autocorrelation lag — an octave
//              error is the classic waveguide failure and cents catch it)
//   BODY       is the fundamental actually THERE? A plucked string with no
//              energy at f0 is the "plinky" sound Paul named on gtr_amp: all
//              midrange, no note. Reported as the share of energy inside
//              [0.7 f0, 1.5 f0].
//   RING       how long does it sound? A string that is gone in 80 ms is not a
//              string; a bar that rings for the whole render is not a bar.
//              T40 from the post-attack peak.
//   DYNAMICS   is loudness MONOTONE in excitation? An instrument whose forte
//              might be its pianissimo is not an instrument.
//   TIMBRE     does the excitation move the spectrum, or only the fader? This
//              is the entire argument for physical models over sampled zones,
//              so a model that fails it has no reason to be adopted.
//
// Usage:
//   node measure-instrument.js <name>            a module in dist/
//   node measure-instrument.js path/to/x.dsp     a candidate, compiled here
//   ... [--notes 40,52,64,76] [--gains 0.15,0.5,1] [--secs 2.5] [--set k=v,k=v]
"use strict";
const fs = require("fs");
const path = require("path");

const SR = 44100, BS = 64;
const FW = path.join(__dirname, "..", "node_modules/@grame/faustwasm");
const DIST = path.join(__dirname, "..", "dist");

// ---- argv ------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const nums = (s) => s.split(",").map(Number);

// ---- a real FFT, because a naive DFT at 8192 points is a minute per note ----
// Iterative radix-2, in place, on split real/imag arrays.
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

/** magnitude spectrum of a hann-windowed frame starting at `off`. */
function spectrum(x, off, N) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const s = off + i < x.length ? x[off + i] : 0;
    re[i] = s * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  }
  fft(re, im);
  const mag = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

/**
 * f0 by AUTOCORRELATION, not by picking the loudest FFT bin. The loudest bin of
 * a struck string is very often the second partial, and a "pitch" measurement
 * that reports the second partial would call an octave error a pass — which is
 * exactly the failure that got pm.violinModel adopted once. Autocorrelation
 * measures the PERIOD, which the partials all share.
 */
function f0(x, off, N, lo, hi) {
  const seg = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) { seg[i] = off + i < x.length ? x[off + i] : 0; mean += seg[i]; }
  mean /= N;
  for (let i = 0; i < N; i++) seg[i] -= mean;
  const minLag = Math.max(2, Math.floor(SR / hi)), maxLag = Math.min(N - 2, Math.ceil(SR / lo));
  let best = -1, bestLag = 0, r0 = 0;
  for (let i = 0; i < N; i++) r0 += seg[i] * seg[i];
  if (r0 <= 0) return 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0, e = 0;
    for (let i = 0; i + lag < N; i++) { s += seg[i] * seg[i + lag]; e += seg[i + lag] * seg[i + lag]; }
    const nrm = e > 0 ? s / Math.sqrt(r0 * e) : 0;
    if (nrm > best) { best = nrm; bestLag = lag; }
  }
  if (bestLag < 2 || best < 0.15) return 0;
  // OCTAVE GUARD. A signal of period P correlates almost exactly as well at 2P,
  // and on a decaying note the longer lag can win by a hair — so a plain
  // argmax reports every dying string an octave low, which is the same false
  // alarm this tool exists to catch in the models. Take instead the SHORTEST
  // lag that comes within 10% of the best: the true period is the first one.
  // Only the SUBMULTIPLES are candidates — halving and thirding the winning
  // lag, not rescanning the whole axis, because a loose rescan finds a
  // near-period a few samples short and reports the drift it invented.
  for (const div of [3, 2]) {
    const lag = Math.round(bestLag / div);
    if (lag < minLag) continue;
    let s = 0, e = 0;
    for (let i = 0; i + lag < N; i++) { s += seg[i] * seg[i + lag]; e += seg[i + lag] * seg[i + lag]; }
    const nrm = e > 0 ? s / Math.sqrt(r0 * e) : 0;
    if (nrm >= best * 0.9) { bestLag = lag; break; }
  }
  // parabolic refinement on the lag axis: a whole-sample lag at 1 kHz is 2.3%,
  // which is 40 cents — coarser than the thing being measured.
  const at = (lag) => { let s = 0; for (let i = 0; i + lag < N; i++) s += seg[i] * seg[i + lag]; return s; };
  const ym1 = at(bestLag - 1), y0 = at(bestLag), yp1 = at(bestLag + 1);
  const d = ym1 - 2 * y0 + yp1;
  const lag = d !== 0 ? bestLag + 0.5 * (ym1 - yp1) / d : bestLag;
  return SR / lag;
}

const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };

/** spectral centroid in Hz over the frame at `off`. */
function centroid(x, off, N) {
  const mag = spectrum(x, off, N);
  let num = 0, den = 0;
  for (let k = 1; k < mag.length; k++) { num += (k * SR / N) * mag[k]; den += mag[k]; }
  return den > 0 ? num / den : 0;
}

/** share of spectral energy inside [lo, hi] Hz — the BODY measurement. */
function bandShare(x, off, N, lo, hi) {
  const mag = spectrum(x, off, N);
  let inb = 0, tot = 0;
  for (let k = 1; k < mag.length; k++) {
    const f = k * SR / N, e = mag[k] * mag[k];
    tot += e; if (f >= lo && f <= hi) inb += e;
  }
  return tot > 0 ? inb / tot : 0;
}

// ---- faust plumbing --------------------------------------------------------
let _gen = null, _compiler = null;

async function generator() {
  if (!_gen) {
    const { FaustMonoDspGenerator } = await import(path.join(FW, "dist/esm/index.js"));
    _gen = new FaustMonoDspGenerator();
  }
  return _gen;
}

async function compiler() {
  if (!_compiler) {
    const { instantiateFaustModuleFromFile, LibFaust, FaustCompiler } =
      await import(path.join(FW, "dist/esm/index.js"));
    const mod = await instantiateFaustModuleFromFile(path.join(FW, "libfaust-wasm/libfaust-wasm.js"));
    _compiler = new FaustCompiler(new LibFaust(mod));
    // local .lib files first, same reason build.js does it: a dsp compiled from
    // a STRING has no directory to resolve its own imports against.
    const libDir = path.join(__dirname, "..", "dsp");
    for (const f of fs.readdirSync(libDir).filter((x) => x.endsWith(".lib")).sort())
      _compiler.fs().writeFile(f, fs.readFileSync(path.join(libDir, f), "utf8"));
  }
  return _compiler;
}

/** a factory, either from the committed dist/ or freshly compiled from source. */
async function factoryFor(target) {
  if (target.endsWith(".dsp")) {
    const name = path.basename(target).replace(/\.dsp$/, "");
    const gen = await generator();
    const d = await gen.compile(await compiler(), name, fs.readFileSync(target, "utf8"), "-ftz 2");
    if (!d || !d.factory) throw new Error("compile produced no factory");
    return d.factory;
  }
  const code = fs.readFileSync(path.join(DIST, `${target}-module.wasm`));
  return { cfactory: 0, code: new Uint8Array(code), module: await WebAssembly.compile(code),
           json: fs.readFileSync(path.join(DIST, `${target}-meta.json`), "utf8"), poly: false };
}

/**
 * Param addresses are not portable and must not be hardcoded. Ours are flat
 * (`/gtr_amp/freq`); faust-stk's are nested inside its GUI groups
 * (`/piano/h:Basic_Parameters/freq`). So every knob is addressed by the LAST
 * path segment, which is the only part either spelling agrees on.
 */
function addressBook(json) {
  const meta = JSON.parse(json), book = {};
  (function walk(items) {
    for (const it of items || []) it.items ? walk(it.items) : (book[it.label.trim().split(/\s/)[0]] = it.address);
  })(meta.ui);
  return { book, outputs: meta.outputs, name: meta.name };
}

/** render one note: gate on at t=0, off at `hold`, tail to `secs`. */
async function pluck(factory, book, freq, gain, opts) {
  const gen = await generator();
  const proc = await gen.createOfflineProcessor(SR, BS, factory);
  const set = (k, v) => { if (book[k] != null) proc.setParamValue(book[k], v); };
  for (const [k, v] of Object.entries(opts.set || {})) set(k, v);
  set("freq", freq);
  set("gain", gain);
  // THE SECOND HALF OF VELOCITY. On these models the note's amp is only one of
  // the two things a hard note does; the other is the excitation itself — the
  // plectrum's hardness, the hammer's, the bow's force, the breath. state-engine
  // moves both, so a measurement that moved only `gain` would report that the
  // instrument's timbre is dead when in fact nothing had asked it to speak.
  for (const d of opts.dyn || []) set(d, gain);
  const total = Math.floor(SR * opts.secs), holdN = Math.floor(SR * opts.hold);
  const out = new Float32Array(total);
  let gated = false;
  for (let s = 0; s < total; s += BS) {
    if (!gated) { set("gate", 1); gated = true; }
    if (gated && s >= holdN && s - BS < holdN) set("gate", 0);
    const len = Math.min(BS, total - s);
    const o = proc.render([], len);
    out.set(o[0].subarray(0, len), s);
  }
  return out;
}

// ---- the five questions ----------------------------------------------------
async function measure(target, opts) {
  const factory = await factoryFor(target);
  const { book, name } = addressBook(factory.json);
  const rows = [];
  for (const midi of opts.notes) {
    const want = 440 * Math.pow(2, (midi - 69) / 12);
    const perGain = [];
    for (const g of opts.gains) {
      const x = await pluck(factory, book, want, g, opts);
      // the attack transient is not the note. Measure a window that starts
      // after it, which is where a string's own pitch and body actually live.
      const N = 8192, off = Math.floor(SR * opts.off);
      let peak = 0; for (let i = 0; i < x.length; i++) { const a = x[i] < 0 ? -x[i] : x[i]; if (a > peak) peak = a; }
      const body = rms(x, off, Math.min(x.length, off + SR * 0.3));
      const heard = f0(x, off, N, Math.max(40, want * 0.4), Math.min(SR / 2.5, want * 2.6));
      const cents = heard > 0 ? 1200 * Math.log2(heard / want) : NaN;
      const inband = bandShare(x, off, N, want * 0.7, want * 1.5);
      const low = bandShare(x, off, N, 0, 400);
      const cen = centroid(x, off, N);
      // T40: 20 ms windows, from the loudest one down 40 dB
      const w = Math.floor(SR * 0.02), nw = Math.floor(x.length / w);
      const env = new Float64Array(nw);
      let pk = 0, pkAt = 0;
      for (let i = 0; i < nw; i++) { env[i] = rms(x, i * w, (i + 1) * w); if (env[i] > pk) { pk = env[i]; pkAt = i; } }
      let t40 = opts.secs;
      for (let i = pkAt; i < nw; i++) if (env[i] < pk * 0.01) { t40 = (i - pkAt) * 0.02; break; }
      perGain.push({ g, peak, body, heard, cents, inband, low, cen, t40 });
    }
    rows.push({ midi, want, perGain });
  }
  return { name, rows, params: Object.keys(book) };
}

function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : "  --"; }

async function main() {
  const target = argv[0];
  if (!target) { console.error("usage: measure-instrument.js <dist-name|path.dsp> [--notes ..] [--gains ..]"); process.exit(2); }
  const setPairs = {};
  for (const kv of (flag("set", "") ? flag("set", "").split(",") : [])) {
    const [k, v] = kv.split("="); setPairs[k] = Number(v);
  }
  const opts = {
    notes: nums(flag("notes", "40,52,64,76")),
    gains: nums(flag("gains", "0.15,0.5,1.0")),
    secs: Number(flag("secs", "2.5")),
    hold: Number(flag("hold", "1.0")),
    dyn: flag("dyn", "") ? flag("dyn", "").split(",") : [],
    // WHERE THE NOTE IS. A plucked string is itself 80 ms in; a wind
    // instrument that late is still an attack transient, and measuring the
    // transient would report a flute's onset chiff as the flute.
    off: Number(flag("off", "0.08")),
    set: setPairs,
  };
  const r = await measure(target, opts);
  console.log(`\n== ${r.name}  (${target})`);
  console.log(`   params: ${r.params.join(" ")}`);
  console.log("   midi  want    gain    peak     rms     f0      cents   body%   <400%  centroid  T40");
  for (const row of r.rows) for (const m of row.perGain)
    console.log(`   ${String(row.midi).padStart(4)}  ${fmt(row.want, 1).padStart(6)}  ${fmt(m.g, 2)}  ` +
      `${m.peak.toExponential(2)}  ${m.body.toExponential(2)}  ${fmt(m.heard, 1).padStart(6)}  ` +
      `${fmt(m.cents, 1).padStart(7)}  ${fmt(m.inband * 100, 1).padStart(5)}  ${fmt(m.low * 100, 1).padStart(5)}  ` +
      `${fmt(m.cen, 0).padStart(7)}  ${fmt(m.t40, 2)}`);
  // the two verdicts a table cannot show at a glance
  for (const row of r.rows) {
    const gs = row.perGain;
    // HOW FAR it inverts, not just whether. "Not monotone" covers both
    // pm.violinModel (a whole dynamic step QUIETER than the one below it — an
    // instrument whose forte might be its pianissimo) and a tenth of a decibel
    // at the bottom of a piano, and calling those the same thing would either
    // ship the first or block the second. So the verdict carries the size.
    let dip = 0;
    for (let i = 1; i < gs.length; i++)
      if (gs[i].body < gs[i - 1].body)
        dip = Math.max(dip, 20 * Math.log10(gs[i - 1].body / Math.max(1e-12, gs[i].body)));
    const moves = gs.length > 1 && gs[gs.length - 1].cen > 0 && gs[0].cen > 0
      ? gs[gs.length - 1].cen / gs[0].cen : 1;
    console.log(`   midi ${row.midi}: loudness monotone in excitation: ` +
      (dip <= 0 ? "yes" : `NO, by ${fmt(dip, 2)} dB`) +
      `   centroid moves x${fmt(moves, 2)}`);
  }
}

if (require.main === module) main().catch((e) => { console.error(e.stack || e.message || e); process.exit(1); });
module.exports = { measure };
