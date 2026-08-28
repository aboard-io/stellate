// _satpress.js — THE MEASUREMENT PRESS. nukernel/export/wav.js, quoted, with
// one difference: it returns the FLOAT PCM instead of 16-bit bytes, so a peak
// over 1.0 can be SEEN rather than clamped away by the encoder. Held constant
// across every commit in the bisect, so the only thing that varies between two
// runs is the code under test.
import { deps, compile, barCount, barPlan, barBeatsAt, parentState,
         warmSources, songDurSec } from "../audio/plan.js";
import { bpm, MASTER, BUSES } from "../ui/state.js";
import { masterState } from "../audio/desk.js";

const SR = 44100;
const SITE = new URL("../../", import.meta.url).href;
const WORKER = new URL("../../engine/faust/live/stream-worker.js", import.meta.url).href;
const LIVE_SECTION = { name: "nukernel", drums: "full", bass: "root", pads: true,
                       melody: "lead", cycles: 1, fill: "off", sweep: "off" };
const PCM = new Map();
async function decodeCrate() {
  const SP = (typeof window !== "undefined" && window.FaustSampler) || null;
  const ctx = new OfflineAudioContext(1, 1, SR);
  const monoOf = (b) => {
    if (!b || !b.length) return null;
    if (b.numberOfChannels <= 1) return Float32Array.from(b.getChannelData(0));
    const n = b.length, a = b.getChannelData(0), c = b.getChannelData(1), o = new Float32Array(n);
    for (let i = 0; i < n; i++) o[i] = (a[i] + c[i]) * 0.5;
    return o;
  };
  const srcs = (warmSources() || {}).samplerSrcs || [];
  for (const s of srcs) {
    if (!s || !s.id || PCM.has(s.id)) continue;
    const url = s.url || (s.samplePath ? new URL(s.samplePath, SITE).href : null);
    if (!url) continue;
    try {
      const buf = SP ? await SP.decodeUrlRaw(ctx, url)
        : await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      const pcm = monoOf(buf); if (pcm) PCM.set(s.id, pcm);
    } catch (e) {}
  }
  return srcs.length;
}
export async function pressFloat(opts) {
  opts = opts || {};
  const D = await deps();
  compile();
  const bars = Math.min(barCount(), opts.maxBars || 1e9);
  if (!bars) throw new Error("nothing to press");
  const base = parentState();
  if (!base) throw new Error("no state");
  const state = { ...base, bpm, sections: [LIVE_SECTION], vapor: 0,
                  ...(masterState(MASTER, BUSES) || {}) };
  await decodeCrate();
  const worker = new Worker(WORKER, { type: "module" });
  const finished = new Promise((resolve, reject) => {
    const segsL = [], segsR = []; let frames = 0;
    worker.onerror = (e) => reject(new Error("press worker: " + ((e && e.message) || e)));
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "ready") {
        const buffers = {}, transfer = [];
        for (const [id, pcm] of PCM) { const c = pcm.slice(); buffers[id] = c; transfer.push(c.buffer); }
        worker.postMessage({ type: "openLivePcm", gen: 1, state, buffers, speech: null,
                             segSec: 8, firstSegSec: 8 }, transfer);
        feed(worker, D, state, bars);
      } else if (m.type === "initfail" || m.type === "openfail") {
        reject(new Error("engine would not open — " + m.error));
      } else if (m.type === "pcmseg") {
        segsL.push(new Float32Array(m.L)); segsR.push(new Float32Array(m.R)); frames += m.n;
      } else if (m.type === "segeos") {
        const L = new Float32Array(frames), R = new Float32Array(frames); let o = 0;
        for (let i = 0; i < segsL.length; i++) { L.set(segsL[i], o); R.set(segsR[i], o); o += segsL[i].length; }
        resolve({ L, R, frames });
      } else if (m.type === "segstopped") { reject(new Error("stopped early")); }
    };
  });
  worker.postMessage({ type: "init" });
  try { return await finished; } finally { worker.terminate(); }
}
function feed(worker, D, state, n) {
  const { E, SE } = D;
  const spb = 60 / Math.max(1, bpm);
  const fxBase = SE.fxParams(state);
  let baseSec = 0;
  for (let i = 0; i < n; i++) {
    const p = barPlan(i), beats = barBeatsAt(i);
    let events = [], sweeps = [], found = [];
    if (p) {
      const m = SE.mapEvents(E, state, p.ev, { lo: 0, hi: beats, units: p.units });
      events = m.events || []; found = m.found || [];
      sweeps = (m.sweeps || []).map((sw) => ({ t0: baseSec + sw.beat * spb,
        t1: baseSec + (sw.beat + sw.durB) * spb, from: sw.from, to: sw.to }));
    }
    worker.postMessage({ type: "feedBar", bar: { units: p ? p.units : {}, events,
      // ...AND THE BAR'S OWN fx OVERRIDES (2026-08-28), merged the same way the
      // live walk merges them (engine/faust/live/live.js, the foreign-composer
      // seam): a delta over the song's fxParams, this bar only. A section's
      // echo time is the one word that uses it today. Absent = the shared
      // object, byte-identical — and the object is only copied when a bar
      // actually says something, so the untouched path allocates nothing.
      fxParams: p && p.fx ? { ...fxBase, ...p.fx } : fxBase,
      spb, lo: 0, hi: beats, barStartSec: baseSec, sweeps, found, foundCi: 0, vapor: 0,
      meta: { serial: i } } });
    baseSec += beats * spb;
  }
  worker.postMessage({ type: "feedEos" });
}
// THE NUMBERS, computed in the page over the float PCM.
export function stats(L, R) {
  const n = L.length;
  let peak = 0, sum = 0, over = 0, over1 = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(L[i]), b = Math.abs(R[i]);
    if (a > peak) peak = a; if (b > peak) peak = b;
    sum += L[i] * L[i] + R[i] * R[i];
    if (a >= 0.99 || b >= 0.99) over++;
    if (a > 1 || b > 1) over1++;
  }
  const rms = Math.sqrt(sum / Math.max(1, 2 * n));
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  // THE BAND MEDIANS: one Goertzel-free route — an FFT over 8192-sample hops on
  // the mono mix, each band's RMS magnitude, median across hops.
  //
  // WHY THREE BANDS AND NOT ONE (2026-08-27). `hf8_16Db` alone answers "is
  // there air", which a shelf moves as readily as a saturator does. What
  // "saturated" SOUNDS like is HARMONICS — a tanh stage folds the energy a
  // record already has in its fundamentals up into the octaves above them — so
  // the number that tracks the complaint is a RATIO: the 2-8 kHz band (where
  // the 2nd/3rd/5th harmonics of everything between 300 Hz and 3 kHz land)
  // against the 300-3000 Hz band that fed them. Turn a drive stage down and
  // that ratio falls even when the level does not move at all, which is
  // exactly the difference between "loud" and "saturated" said in numbers.
  const b = bands(L, R);
  return { peakDb: +db(peak).toFixed(2), rmsDb: +db(rms).toFixed(2),
           crest: +(db(peak) - db(rms)).toFixed(2), over99: over, over1,
           hf8_16Db: b.hf8_16Db, hf4_8Db: b.hf4_8Db,
           hf2_8Db: b.hf2_8Db, mid300_3kDb: b.mid300_3kDb,
           lo60_300Db: b.lo60_300Db,
           harmRatioDb: b.harmRatioDb,
           frames: n, secs: +(n / 44100).toFixed(2) };
}
function bands(L, R) {
  const N = 8192, hop = 8192, n = L.length;
  const re = new Float64Array(N), im = new Float64Array(N);
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const bin = (hz) => Math.max(1, Math.round(hz * N / 44100));
  // hf4_8Db added 2026-08-27 (Paul: "very high tones get shrieky") — the
  // shriek band proper. hf2_8 is too wide to show a shelf at 5 kHz moving,
  // because half of it sits under the corner.
  // lo60_300Db added 2026-08-28 — the round that wired instruments.js STRIPS to
  // the engine moves HIGH-PASS CORNERS (200 Hz for every pitched voice, down to
  // 40 for keys / 80 for strings / 90 for guitar / 110 for a bowed section), and
  // not one of the four bands above looks below 300 Hz. Measuring that round on
  // 300-3k alone reported +0.01 dB on a ragtime whose two pianos had just got
  // their left hands back. This is the band the corner actually moves.
  const SPEC = [["hf8_16Db", 8000, 16000], ["hf4_8Db", 4000, 8000],
                ["hf2_8Db", 2000, 8000], ["mid300_3kDb", 300, 3000],
                ["lo60_300Db", 60, 300]];
  const acc = SPEC.map(() => []);
  for (let o = 0; o + N <= n; o += hop) {
    for (let i = 0; i < N; i++) { re[i] = (L[o + i] + R[o + i]) * 0.5 * win[i]; im[i] = 0; }
    fft(re, im);
    SPEC.forEach(([, f0, f1], j) => {
      const lo = bin(f0), hi = bin(f1);
      let s = 0;
      for (let k = lo; k <= hi; k++) s += re[k] * re[k] + im[k] * im[k];
      acc[j].push(Math.sqrt(s / (hi - lo + 1)) / N);
    });
  }
  const out = {};
  SPEC.forEach(([name], j) => {
    const m = acc[j];
    if (!m.length) { out[name] = null; return; }
    m.sort((a, b) => a - b);
    const v = m[m.length >> 1];
    out[name] = +(v > 0 ? 20 * Math.log10(v) : -999).toFixed(2);
  });
  out.harmRatioDb = (out.hf2_8Db == null || out.mid300_3kDb == null) ? null
    : +(out.hf2_8Db - out.mid300_3kDb).toFixed(2);
  return out;
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
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
