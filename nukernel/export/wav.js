// nukernel/export/wav.js — the record, PRESSED to one .wav, in the page,
// offline. This is not a second renderer: it is the parent's own stream
// machinery pointed at a file. A dedicated engine/faust/live/stream-worker.js
// is spawned (the exact Worker the live ring and the phone's WAV-first route
// run), opened on its PCM-accumulating path (`openLivePcm` →
// runBarAccumPump → pcmSink — clean un-faded bodies, no ring, no <audio>),
// and fed the SAME per-bar plans audio/plan.js hands the live walk — desk
// automation, sends and the master strip included, which is what the live
// path plays and the raw compiled STATE alone does not carry (barPlan is "the
// unit table with the desk on it"; the desk-absent tape was 2026-08-19's bug
// and this file must not resurrect it).
//
// WHAT THIS FILE ADDS is only the conductor's four-line bar bake, quoted from
// engine/faust/live/live.js stepWalk (":343" — the fed-events branch):
// SE.mapEvents over the bar's plan for [0, beats), SE.fxParams over the same
// state the live walk gets, sweeps made stream-absolute against the running
// barStartSec. Byte-determinism is the parent's own claim for this path
// (segment parity against press.js) and test/deck.test.js re-proves it here:
// two presses of the same record are byte-equal.
//
// THE STATE IS COMPOSED THE WAY audio/live.js getState COMPOSES IT (that
// function is module-local there; the three owners of the facts — plan.js,
// desk.js, ui/state.js — are imported directly and the one-line spread is
// quoted with its source): the compiled parent state, the page's bpm, ONE
// inert section, and the desk's master strip over it.
import { deps, compile, barCount, barPlan, barBeatsAt, parentState,
         warmSources, songDurSec } from "../audio/plan.js";
import { bpm, MASTER, BUSES } from "../ui/state.js";
import { masterState } from "../audio/desk.js";

const SR = 44100;
const SITE = new URL("../../", import.meta.url).href;      // the repo root
const WORKER = new URL("../../engine/faust/live/stream-worker.js", import.meta.url).href;

// audio/live.js LIVE_SECTION, verbatim: one flat section keeps the parent's
// own form machinery inert — nukernel's composer has already decided the form.
const LIVE_SECTION = { name: "nukernel", drums: "full", bass: "root", pads: true,
                       melody: "lead", cycles: 1, fill: "off", sweep: "off" };

/* ---------- the sample crate, decoded once per session -------------------- */
// srcId -> Float32Array (mono 44.1k), master copies; every press ships COPIES
// into the worker (a transfer detaches, and the next press needs them again).
// The decode recipe is live.js decSampler's: FaustSampler.decodeUrlRaw + a
// mono mixdown — same PCM the live engine bakes.
const PCM = new Map();
async function decodeCrate(onSay) {
  const SP = (typeof window !== "undefined" && window.FaustSampler) || null;
  const ctx = new OfflineAudioContext(1, 1, SR);
  const monoOf = (b) => {
    if (!b || !b.length) return null;
    if (b.numberOfChannels <= 1) return Float32Array.from(b.getChannelData(0));
    const n = b.length, a = b.getChannelData(0), c = b.getChannelData(1),
          o = new Float32Array(n);
    for (let i = 0; i < n; i++) o[i] = (a[i] + c[i]) * 0.5;
    return o;
  };
  const srcs = (warmSources() || {}).samplerSrcs || [];
  let done = 0;
  for (const s of srcs) {
    if (!s || !s.id || PCM.has(s.id)) { done++; continue; }
    const url = s.url || (s.samplePath ? new URL(s.samplePath, SITE).href : null);
    if (!url) { done++; continue; }
    try {
      const buf = SP ? await SP.decodeUrlRaw(ctx, url)
        : await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      const pcm = monoOf(buf);
      if (pcm) PCM.set(s.id, pcm);
    } catch (e) { /* a zone that will not decode plays as silence, as live */ }
    done++;
    if (onSay) onSay("decoding the crate — " + done + "/" + srcs.length);
  }
  return srcs.length;
}

/* ---------- the canonical 16-bit stereo WAV (stream-worker encodeWavPCM) -- */
function encodeWav(L, R) {
  const n = L.length, dataLen = n * 4;
  const buf = new ArrayBuffer(44 + dataLen), dv = new DataView(buf);
  let o = 0;
  const w = (s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); };
  w("RIFF"); dv.setUint32(o, 36 + dataLen, true); o += 4; w("WAVE");
  w("fmt "); dv.setUint32(o, 16, true); o += 4;
  dv.setUint16(o, 1, true); o += 2; dv.setUint16(o, 2, true); o += 2;
  dv.setUint32(o, SR, true); o += 4; dv.setUint32(o, SR * 4, true); o += 4;
  dv.setUint16(o, 4, true); o += 2; dv.setUint16(o, 16, true); o += 2;
  w("data"); dv.setUint32(o, dataLen, true); o += 4;
  for (let i = 0; i < n; i++) {
    dv.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767 | 0, true); o += 2;
    dv.setInt16(o, Math.max(-1, Math.min(1, R[i])) * 32767 | 0, true); o += 2;
  }
  return buf;
}

/* ---------- the press ----------------------------------------------------- */
/**
 * pressWav(onSay?) -> Promise<{ bytes: ArrayBuffer, frames, durSec, songSec }>
 * Renders the CURRENT record, whole, to canonical 44.1k/16-bit stereo WAV.
 */
export async function pressWav(onSay) {
  const say = (t) => { try { if (onSay) onSay(t); } catch (e) {} };
  const D = await deps();
  compile();
  const bars = barCount();
  if (!bars) throw new Error("nothing to press — the record has no bars");
  const base = parentState();
  if (!base) throw new Error("the record did not compile to a state");
  // audio/live.js getState, quoted: the desk's master strip lands OVER the
  // compiled state, per press, exactly as it lands per stream.
  const state = { ...base, bpm, sections: [LIVE_SECTION], vapor: 0,
                  ...(masterState(MASTER, BUSES) || {}) };

  say("decoding the crate…");
  await decodeCrate(say);

  const worker = new Worker(WORKER, { type: "module" });
  const finished = new Promise((resolve, reject) => {
    const segsL = [], segsR = [];
    let frames = 0;
    worker.onerror = (e) => reject(new Error("press worker: " + ((e && e.message) || e)));
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "ready") {
        // buffers: COPIES of the master PCM, transferred (live.js:2861's slice)
        const buffers = {}, transfer = [];
        for (const [id, pcm] of PCM) { const c = pcm.slice(); buffers[id] = c; transfer.push(c.buffer); }
        worker.postMessage({ type: "openLivePcm", gen: 1, state,
                             buffers, speech: null, segSec: 8, firstSegSec: 8 }, transfer);
        feed(worker, D, state);
      } else if (m.type === "initfail" || m.type === "openfail") {
        reject(new Error("the engine would not open offline — " + m.error));
      } else if (m.type === "pcmseg") {
        segsL.push(new Float32Array(m.L)); segsR.push(new Float32Array(m.R));
        frames += m.n;
        say("pressing — " + (frames / SR).toFixed(0) + "s of " +
            songDurSec().toFixed(0) + "s");
      } else if (m.type === "segeos") {
        const L = new Float32Array(frames), R = new Float32Array(frames);
        let o = 0;
        for (let i = 0; i < segsL.length; i++) { L.set(segsL[i], o); R.set(segsR[i], o); o += segsL[i].length; }
        resolve({ L, R, frames });
      } else if (m.type === "segstopped") {
        reject(new Error("the press was stopped before the last bar"));
      }
    };
  });
  worker.postMessage({ type: "init" });

  try {
    const { L, R, frames } = await finished;
    const bytes = encodeWav(L, R);
    return { bytes, frames, durSec: frames / SR, songSec: songDurSec() };
  } finally { worker.terminate(); }
}

// the conductor's bar bake, per bar 0..n-1, then EOS. Quoted from
// engine/faust/live/live.js stepWalk (fed-events branch) + its wavOut feed
// (":2910": _base accumulates fed musical seconds; sweeps go stream-absolute).
function feed(worker, D, state) {
  const { E, SE } = D;
  const n = barCount();
  const spb = 60 / Math.max(1, bpm);
  const fxParams = SE.fxParams(state);
  let baseSec = 0;
  for (let i = 0; i < n; i++) {
    const p = barPlan(i);
    const beats = barBeatsAt(i);
    let events = [], sweeps = [], found = [];
    if (p) {
      const m = SE.mapEvents(E, state, p.ev, { lo: 0, hi: beats, units: p.units });
      events = m.events || []; found = m.found || [];
      sweeps = (m.sweeps || []).map((sw) => ({ t0: baseSec + sw.beat * spb,
        t1: baseSec + (sw.beat + sw.durB) * spb, from: sw.from, to: sw.to }));
    }
    worker.postMessage({ type: "feedBar", bar: {
      units: p ? p.units : {}, events, fxParams, spb, lo: 0, hi: beats,
      barStartSec: baseSec, sweeps, found, foundCi: 0, vapor: 0,
      meta: { serial: i } } });
    baseSec += beats * spb;
  }
  worker.postMessage({ type: "feedEos" });
}
