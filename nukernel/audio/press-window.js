// audio/press-window.js — THE TAPE IS PRESSED BY THE PARENT'S PRESS.
//
// What used to happen inside a render window was a second synthesiser: an
// OfflineAudioContext, a master chain, a kit desk, a per-note WebAudio strip
// for every note the song plays, and a Faust worklet pool bolted onto it. That
// is the machine the parent already owns and has already made fast — so this
// file does not render anything. It TRANSLATES, DECODES and DRIVES:
//
//   translate  audio/to-engine.js turns a run of nukernel bars into the parent
//              engine's own {pitched,drums,found,sfx} + unit table.
//   decode     the parent's sampler wants PCM per source id; a browser has
//              fetch + decodeAudioData, so that is the whole of the input step.
//   drive      engine/faust/live/stream-renderer.js — the parent's offline
//              render walk, the one the desktop stream and the node press are
//              both gated against — opened over the translated schedule and
//              pumped chunk by chunk into one L/R pair.
//
// Nothing here schedules a note, shapes an envelope or opens an AudioContext
// for anything but decoding a file.
//
// WHY A RUN OF BOXES AND NOT A SONG. The parent's `state` is one band playing
// one arrangement: one kit, one cast, one set of instrument recipes. A nukernel
// song is a row of BOXES, and a box may change the kit, recast every chair and
// swap the bass. So each run of consecutive bars sharing a box is translated on
// its own and the results are MERGED into one schedule — unit keys namespaced
// per run, event beats shifted onto the window's clock. The merge is why
// stream-renderer.open() now takes an optional `io.sched` (an additive parent
// change; absent it, every existing caller is byte-identical).
//
// WHAT THAT BUYS, and it is the reason the windowing scaffolding could go: the
// reverb, the delay and the whole master chain run ONCE over the window, so a
// box change is not a seam at all — the tails cross it because they are the
// same buses. The old walk rebuilt the entire room per section.
//
// THE SUNG LINE IS NOT HERE. nukernel's singer is espeak slices resampled and
// vocoded by audio/sing.js; the parent has no voice for it and to-engine.js
// reports it in `unrouted`. bounce.js keeps it on its own offline pass and mixes
// it in — named, not hidden.

import { GENRES, BASSSYNTH, BASS_INSTR, instrOf } from "../ui/deps.js";
import { SONG, bpm, POOL } from "../ui/state.js";
import { gid, poolInstrOf, kitOf } from "../ui/derive.js";
import { isSynthFont, fontDef } from "./assets.js";
import { toEngine } from "./to-engine.js";

export const SR = 44100;
const BS = 64;
const FAUSTDIR = new URL("../../engine/faust/", import.meta.url).href;
const ROOTDIR = new URL("../../", import.meta.url).href;

/* ---------- the parent, loaded once ---------- */
// The engine ships as CLASSIC scripts that publish onto `window` (CLAUDE.md:
// genre-kernel merges __GENRES/__REGISTRY at load, so order is load-bearing).
// kernel-daw.html already carries three of them; the rest arrive here, by
// dynamic import, in the parent's own order — the same move
// engine/faust/live/stream-worker.js makes inside its Worker. A guard skips
// anything the page already defined so nothing is re-executed under the app's
// feet.
let depsP = null;
async function deps() { return depsP || (depsP = loadDeps()); }
async function loadDeps() {
  const need = async (g, url) => { if (!window[g]) await import(url); return window[g]; };
  await need("__GENRES", ROOTDIR + "engine/genres-data.js");
  await need("__REGISTRY", ROOTDIR + "engine/registry-data.js");
  await need("CsdTheory", ROOTDIR + "engine/theory.js");
  await need("CsdPipes", ROOTDIR + "engine/pipes.js");
  const E = await need("CsdEngine", ROOTDIR + "engine/csd-engine.js");
  const K = await need("GenreKernel", ROOTDIR + "engine/genre-kernel.js");
  const SE = await need("FaustStateEngine", FAUSTDIR + "voices/state-engine.js");
  await need("FaustRenderCore", FAUSTDIR + "press/render-core.js");
  const FP = await need("FoundPlayer", FAUSTDIR + "voices/found-player.js");
  const SP = await need("FaustSampler", FAUSTDIR + "voices/sampler.js");
  const SRnd = await need("FaustStreamRenderer", FAUSTDIR + "live/stream-renderer.js");
  const BE = await need("FaustBrowserEnv", FAUSTDIR + "press/browser-env.js");
  const benv = await BE.makeBrowserEnv({ base: FAUSTDIR });
  return { E, K, SE, FP, SP, SRnd, benv };
}
// Is the parent press available at all? Asked before a render commits to it, so
// a page whose engine/faust/node_modules is missing says so instead of throwing
// per window. The answer is remembered either way.
let readyP = null;
export function pressReady() {
  return readyP || (readyP = deps().then(() => true, (e) => {
    console.warn("[nukernel] the parent press is unavailable:", e && e.message);
    lastError = String((e && e.message) || e).slice(0, 140);
    return false;
  }));
}
let lastError = null;
export const pressError = () => lastError;

/* ---------- decode: file -> mono PCM at 44.1k, keyed by source id ---------- */
// The parent's sampler and found layers both read `buffers[srcId]`. press.js
// fills that with ffmpeg (-ac 1 -ar 44100); a page fills it with fetch +
// decodeAudioData on a 44.1k context, which is the same two facts. Channels are
// AVERAGED rather than channel-0-taken, because that is what ffmpeg's -ac 1
// does and a stereo zone would otherwise lose half its body.
let decCtx = null;
const pcmCache = new Map();          // samplePath -> Float32Array | null
const DEC_PAR = 8;
async function decodeOne(url) {
  if (!decCtx) decCtx = new OfflineAudioContext(1, 1, SR);
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status + " " + url.split("/").pop());
  const buf = await decCtx.decodeAudioData(await r.arrayBuffer());
  const n = buf.length, ch = buf.numberOfChannels;
  const out = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i];
  }
  if (ch > 1) for (let i = 0; i < n; i++) out[i] /= ch;
  return out;
}
async function decodeAll(paths, missing) {
  const todo = [...paths].filter(([, p]) => !pcmCache.has(p));
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= todo.length) return;
      const p = todo[i][1];
      try { pcmCache.set(p, await decodeOne(ROOTDIR + p)); }
      catch (e) { pcmCache.set(p, null); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(DEC_PAR, todo.length) }, worker));
  const buffers = {};
  for (const [id, p] of paths) {
    const pcm = pcmCache.get(p);
    if (pcm && pcm.length) buffers[id] = pcm;
    else missing.push(id);
  }
  return buffers;
}

/* ---------- a box, as a parent plan ---------- */
// WHO PLAYS WHAT, resolved exactly the way audio/transport.js scheduleBar
// resolves it — the pool cast wins over the genre's signature synth, the synth
// FONT wins over both, and `instrOf` names the chair's sampled instrument. A
// second opinion about any of those is a carrier that plays a different band
// from the one on screen.
function seatsFor(sec, bars) {
  const seats = [];                 // index -> { chair, instr, synth, tone }
  const ix = new Map();             // "owner|vi|pad" -> index
  const evOut = [];                 // one rewritten bar list
  const font = isSynthFont() ? fontDef().synth : null;
  for (const bar of bars) {
    const ev = [];
    for (const e of bar.ev) {
      if (e.kind !== "line") { ev.push(e); continue; }
      const owner = e.layer || gid(sec);
      const vi = e.lv == null ? e.v : e.lv;
      const over = poolInstrOf(sec, owner, vi, POOL);
      const G = GENRES[owner] || {};
      const gsyn = font || (over ? null : G.synth);
      // lineOnly: the riding lead swaps to the signature synth, the chord under
      // it stays sampled — transport.js's own predicate, verbatim
      const useSyn = !!(gsyn && !(gsyn.lineOnly && e.pad && !font));
      const chair = e.pad ? "pad" : "line";
      const key = owner + "|" + vi + "|" + (e.pad ? 1 : 0);
      let v = ix.get(key);
      if (v == null) {
        v = seats.length;
        ix.set(key, v);
        seats.push({ chair, instr: over || instrOf(owner, vi), synth: gsyn || null, tone: G.tone || null });
      }
      // the REGISTER HOME is a sampled-instrument fact (transport.js applies it
      // on the sampled branch only): a signature synth plays the written note
      // (guarded: a rest carries n == null, and null + 0 is 0 — a note)
      ev.push({ ...e, v, part: chair,
                n: e.n == null ? null : e.n + (useSyn ? 0 : (e.home || 0)) });
    }
    evOut.push({ ...bar, ev });
  }
  return { seats, bars: evOut };
}

/* ---------- the merge: many boxes, one schedule ---------- */
function runsOf(bars) {
  const runs = [];
  for (const b of bars) {
    const last = runs[runs.length - 1];
    if (last && last.si === b.si) last.bars.push(b);
    else runs.push({ si: b.si, bars: [b] });
  }
  return runs;
}

/**
 * Press a window of nukernel bars through the parent engine.
 *
 *   bars      the bar slice to render, PRE-ROLL INCLUDED (bounce.js's window)
 *   preBars   how many leading bars are pre-roll and are cut off the output
 *   sd        step duration in seconds (transport.stepDur)
 *   tailSec   ring-out rendered past the last bar (the fold takes it home)
 *
 * returns { chs:[L,R], n, unrouted, missing, units, procMs }
 */
export async function pressWindow(bars, opts) {
  const o = opts || {};
  const { E, K, SE, FP, SP, SRnd, benv } = await deps();
  const sd = o.sd || (60 / bpm / 4);
  const spb = sd * 4;                       // the parent counts in beats
  const preBars = o.preBars || 0;
  const tailSec = o.tailSec || 0;

  // ---- 1. translate, box run by box run --------------------------------------
  const events = [], found = [], sweeps = [], units = {};
  const srcPaths = new Map();               // srcId -> samplePath
  const unrouted = [];
  // WHICH DRUM LANES REACHED THE TAPE, kept for the same reason bounce.js has
  // always kept it: "one phrase over and over, no drums" is a report, and a
  // number is what answers it. A lane counts as carried when the run really
  // produced drum events and to-engine did not report the lane unrouted.
  const lanes = new Set();
  let beat0 = 0, first = null;
  const runs = runsOf(bars);
  for (let ri = 0; ri < runs.length; ri++) {
    const run = runs[ri];
    const sec = SONG[run.si];
    const runBeats = run.bars.reduce((n, b) => n + b.barSteps / 4, 0);
    if (!sec) { beat0 += runBeats; continue; }
    const { seats, bars: rb } = seatsFor(sec, run.bars);
    const bs = BASSSYNTH[sec.bassop] || null;
    const t = toEngine({
      bars: rb, bpm, seed: 1, kit: kitOf(sec),
      seat: (v) => seats[v] || null,
      bass: { instr: (POOL && POOL.bass) || BASS_INSTR, synth: bs, tone: null },
    }, { SE, K, E });
    for (const u of t.unrouted) unrouted.push({ ...u, box: run.si });
    // the parent's own mapper: state + events -> unit-addressed schedule
    const sch = SE.mapEvents(E, t.state, t.ev, { units: t.units });
    const pfx = "b" + ri + "/";
    for (const [k, u] of Object.entries(sch.units)) {
      if (k.slice(0, 2) === "__" || !u) continue;
      units[pfx + k] = u;
      if (u.sampler) for (const z of u.sampler.zones) if (z.srcId) srcPaths.set(z.srcId, null);
    }
    // every source id the schedule will ask for, BEFORE the paths are looked up
    // — applySampledOnly rides every zone of every GM instrument onto the state,
    // and only the handful this run really plays is worth a fetch
    for (const f of sch.found) if (!srcPaths.has(f.srcId)) srcPaths.set(f.srcId, null);
    for (const s of t.state.foundSources || [])
      if (srcPaths.has(s.id) && s.samplePath) srcPaths.set(s.id, s.samplePath);
    const dead = new Set(t.unrouted.filter(u => u.what.slice(0, 5) === "lane:")
      .map(u => u.what.slice(5)));
    if (sch.events.some(e => e.drum))
      for (const b of rb) for (const e of b.ev)
        if (e.kind === "hit" && e.d && !dead.has(e.d)) lanes.add(e.d);
    for (const e of sch.events) events.push({ ...e, unit: pfx + e.unit, beat: e.beat + beat0 });
    for (const f of sch.found) found.push({ ...f, beat: f.beat + beat0 });
    for (const s of sch.sweeps) sweeps.push({ ...s, beat: s.beat + beat0 });
    // THE MASTER STAGE IS THE SONG'S, not each box's: fx_bus, the reverb colour
    // and the master compressor run once over the whole window, so they are
    // resolved from the FIRST box's state. A per-box master would be a rebuilt
    // room at every section line, which is the seam this file exists to remove.
    if (!first) first = t.state;
    beat0 += runBeats;
  }
  if (!first) return null;
  first.chordEvery = 8;                     // the renderer's chunk grid, nothing musical

  // ---- 2. decode -------------------------------------------------------------
  const paths = [...srcPaths].filter(([, p]) => p);
  const missing = [];
  const buffers = await decodeAll(paths, missing);
  for (const [id, p] of srcPaths) if (!p) missing.push(id);

  // ---- 3. drive the parent's offline walk ------------------------------------
  const sched = { events, found, sweeps, units, spb,
                  totalBeats: beat0 + tailSec / spb };
  const eng = SRnd.makeStreamEngine({ E, SE, FP, SP,
    mergeIvals: window.FaustRenderCore.mergeIvals,
    mkProc: benv.mkProc, rootOf: benv.rootOf, SR, BS, dx7Presets: benv.dx7Presets });
  const t0 = performance.now();
  const info = await eng.open(first, { buffers, sched });
  const L = new Float32Array(info.TOTAL), R = new Float32Array(info.TOTAL);
  for (let n = 0; n < info.nChunks; n++) {
    const c = eng.renderChunk(n);
    L.set(c.L.subarray(0, c.length), c.startSample);
    R.set(c.R.subarray(0, c.length), c.startSample);
  }
  eng.close();

  // ---- 4. cut the pre-roll off ------------------------------------------------
  // The window replayed the bars before its own so the reverb, the delay and the
  // master compressor arrive at the seam carrying real state; their OUTPUT is
  // not ours. Everything after is exactly one window's worth of tape.
  const preSec = bars.slice(0, preBars).reduce((n, b) => n + b.barSteps * sd, 0);
  const skip = Math.round(preSec * SR);
  const n = Math.max(0, L.length - skip);
  // COPIED, not sliced: bounce.js's window cache holds these for the session, and
  // a subarray would pin the whole pre-roll-and-tail buffer behind every entry.
  const chs = [L.slice(skip, skip + n), R.slice(skip, skip + n)];
  return { chs, n,
           unrouted, missing, lanes: [...lanes], units: Object.keys(units).length,
           procMs: Math.round(performance.now() - t0) };
}
