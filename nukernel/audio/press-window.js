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
// AND THE DRIVING HAPPENS ON ANOTHER THREAD. It used to happen on this one, and
// that is what Paul was hearing on 2026-08-17: renderChunk is a synchronous WASM
// call, a window is several of them in a row, and the ear's thread was gone for
// up to eleven seconds at a time while transport.js's 0.15 s lookahead ran dry
// and the fill bar froze in the same task. audio/press-worker.js is the same
// walk in a module Worker; everything above this line still runs here, because
// translating a nukernel bar reads GENRES, POOL and SONG and a second opinion
// about those would be a different band. Only the samples and the schedule
// cross, and the tape they make is the tape it was.
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
// (a paragraph here said why the sung line was NOT in this window: espeak
// slices the parent has no voice for, kept on bounce.js's own offline pass.
// The singer came out on 2026-08-17 — kernel-daw.html has the tombstone — and
// this walk is now the whole record.)

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
//
// THE TRANSLATE HALF ONLY: the score algebra the page itself needs to turn bars
// into a parent schedule. The render half (found-player, sampler,
// stream-renderer, the faustwasm env) does NOT arrive here any more — it lives
// in the worker, and a page that never falls back never pays for it twice.
const need = async (g, url) => { if (!window[g]) await import(url); return window[g]; };
let depsP = null;
async function deps() { return depsP || (depsP = loadDeps()); }
async function loadDeps() {
  await need("__GENRES", ROOTDIR + "engine/genres-data.js");
  await need("__REGISTRY", ROOTDIR + "engine/registry-data.js");
  await need("CsdTheory", ROOTDIR + "engine/theory.js");
  await need("CsdPipes", ROOTDIR + "engine/pipes.js");
  const E = await need("CsdEngine", ROOTDIR + "engine/csd-engine.js");
  const K = await need("GenreKernel", ROOTDIR + "engine/genre-kernel.js");
  const SE = await need("FaustStateEngine", FAUSTDIR + "voices/state-engine.js");
  return { E, K, SE };
}
// ...and the render half, ON THIS THREAD, which is the FALLBACK and nothing
// else. A module Worker is not a thing every browser in the world has (and a
// page opened off a file:// URL has none at all), and a tape made in a blocking
// window is still better than no tape — so the old path stays walkable, and
// `pressPath()` says out loud which one is in use.
let mainP = null;
async function mainDeps() { return mainP || (mainP = loadMainDeps()); }
async function loadMainDeps() {
  const { E, K, SE } = await deps();
  await need("FaustRenderCore", FAUSTDIR + "press/render-core.js");
  const FP = await need("FoundPlayer", FAUSTDIR + "voices/found-player.js");
  const SP = await need("FaustSampler", FAUSTDIR + "voices/sampler.js");
  const SRnd = await need("FaustStreamRenderer", FAUSTDIR + "live/stream-renderer.js");
  const BE = await need("FaustBrowserEnv", FAUSTDIR + "press/browser-env.js");
  const benv = await BE.makeBrowserEnv({ base: FAUSTDIR });
  return { E, K, SE, FP, SP, SRnd, benv };
}

/* ---------- the worker: where the walk actually runs ---------- */
// One worker for the life of the page. It accumulates the decoded sample layer,
// so every window after the first ships only the files that window is the first
// to ask for.
let wk = null, wkSeq = 0;
const wkPend = new Map();                 // press id -> {res, rej}
const wkSent = new Set();                 // samplePath -> already in the worker
function startWorker() {
  return new Promise((res, rej) => {
    const w = new Worker(new URL("./press-worker.js", import.meta.url), { type: "module" });
    const bad = (e) => { try { w.terminate(); } catch (x) {} rej(new Error(e)); };
    w.onerror = (e) => bad((e && e.message) || "worker error");
    w.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.t === "ready") { wk = w; res(w); return; }
      if (m.t === "initfail") { bad(m.error); return; }
      const p = wkPend.get(m.id);
      if (!p) return;
      wkPend.delete(m.id);
      if (m.t === "pressed") p.res(m);
      else p.rej(new Error(m.error || "press failed"));
    };
    w.postMessage({ t: "init" });
  });
}
function wkPress(msg, transfer) {
  return new Promise((res, rej) => {
    wkPend.set(msg.id, { res, rej });
    wk.postMessage(msg, transfer);
  });
}

// Is the parent press available at all, and where does it run? Asked before a
// render commits to it, so a page whose engine/faust/node_modules is missing
// says so once instead of throwing per window — and so the DECODE below knows
// whether it may give its samples away (the worker path transfers them) or must
// keep them (the fallback renders here). The answer is remembered either way,
// which is what makes that one-time choice safe.
let readyP = null, path = null;
export function pressReady() {
  return readyP || (readyP = start().then(() => true, (e) => {
    console.warn("[nukernel] the parent press is unavailable:", e && e.message);
    lastError = String((e && e.message) || e).slice(0, 140);
    return false;
  }));
}
async function start() {
  await deps();                            // the translate half, either way
  try { await startWorker(); path = "worker"; }
  catch (e) {
    console.warn("[nukernel] the press worker would not start — the tape will "
      + "be made on this thread and you may hear it:", (e && e.message) || e);
    await mainDeps();
    path = "main";
  }
}
export const pressPath = () => path;
let lastError = null;
export const pressError = () => lastError;

/* ---------- decode: file -> mono PCM at 44.1k, keyed by source id ---------- */
// The parent's sampler and found layers both read `buffers[srcId]`. press.js
// fills that with ffmpeg (-ac 1 -ar 44100); a page fills it with fetch +
// decodeAudioData on a 44.1k context, which is the same two facts. Channels are
// AVERAGED rather than channel-0-taken, because that is what ffmpeg's -ac 1
// does and a stereo zone would otherwise lose half its body.
//
// TWO MAPS, because on the worker path the page does not keep the samples at
// all: `pcmLen` is what it remembers (how many frames the file decoded to, 0 for
// one that would not decode, which is the whole of what `missing` needs), and
// `pcmData` holds the Float32Arrays only until they are transferred away. On the
// fallback path nothing is transferred and pcmData IS the cache. Either way a
// file is fetched and decoded exactly once per page.
let decCtx = null;
const pcmLen = new Map();            // samplePath -> frames, 0 = would not decode
const pcmData = new Map();           // samplePath -> Float32Array (until given away)
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
  const todo = [...paths].filter(([, p]) => !pcmLen.has(p));
  let next = 0;
  const dec = async () => {
    for (;;) {
      const i = next++;
      if (i >= todo.length) return;
      const p = todo[i][1];
      try { const pcm = await decodeOne(ROOTDIR + p); pcmData.set(p, pcm); pcmLen.set(p, pcm.length); }
      catch (e) { pcmLen.set(p, 0); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(DEC_PAR, todo.length) }, dec));
  // WHICH FILE EACH SOURCE ID WANTS — the map the worker resolves its own buffer
  // table from, and the reason its cache is keyed on the path: a schedule
  // addresses zones by id, and two ids may well name the same wav.
  const idPath = {};
  for (const [id, p] of paths) {
    if (pcmLen.get(p)) idPath[id] = p;
    else missing.push(id);
  }
  return idPath;
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
  // the thread is chosen ONCE per page (pressReady), and every window after
  // asks the same question and gets the same answer
  if (!path) await pressReady();
  const { E, K, SE } = await deps();
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
      // THE ROOM IS THE DESK'S, NOT THE PARENT'S. toEngine defaults the master
      // fx scalars to 0.4/0.2 — a reverb and a delay the LIVE graph does not
      // have, because live the engine's voices play into nukernel's own channel
      // strips and their sends. Leaving them on put a second room on the tape
      // and nowhere else: measured 2026-08-17, that was +3 dB of wet the ear had
      // not been listening to. The band comes back dry and audio/bounce.js's
      // desk pass sends it to the halls the box actually asked for.
      reverb: 0, delay: 0,
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
  const idPath = await decodeAll(paths, missing);
  for (const [id, p] of srcPaths) if (!p) missing.push(id);

  // ---- 3. the pre-roll's length, which the walk needs before it walks ---------
  // The window replayed the bars before its own so the reverb, the delay and the
  // master compressor arrive at the seam carrying real state; their OUTPUT is
  // not ours. Everything after is exactly one window's worth of tape.
  const preSec = bars.slice(0, preBars).reduce((n, b) => n + b.barSteps * sd, 0);
  // …UNLESS THE CALLER STILL HAS A DESK TO RUN. The window's output is not the
  // tape: audio/bounce.js puts it through the box's own strip and the song's
  // master, and those carry state — a compressor, a room, a tape wobble — that
  // has to be warm by the time the kept bars arrive, for exactly the reason the
  // pre-roll is rendered in the first place. So `keepPre` hands the pre-roll
  // back with the rest and `pre` says how many frames to drop once the desk has
  // heard them. Absent, every existing caller gets the same bytes as before.
  const skip = o.keepPre ? 0 : Math.round(preSec * SR);

  // ---- 4. drive the parent's offline walk ------------------------------------
  const sched = { events, found, sweeps, units, spb,
                  totalBeats: beat0 + tailSec / spb };
  const t0 = performance.now();
  const chs = path === "worker"
    ? await pressOnWorker(first, sched, idPath, skip)
    : await pressOnThisThread(first, sched, idPath, skip);
  return { chs, n: chs[0].length, pre: Math.round(preSec * SR),
           unrouted, missing, lanes: [...lanes], units: Object.keys(units).length,
           procMs: Math.round(performance.now() - t0) };
}

// THE WORKER PATH — the ordinary one. Every sample file the worker has not seen
// goes with this message and is TRANSFERRED, so the page hands over the buffer
// rather than copying it; after the first window that list is nearly always
// empty and the message is a schedule and nothing else.
async function pressOnWorker(state, sched, idPath, skip) {
  const addPaths = {}, give = [];
  for (const id in idPath) {
    const p = idPath[id];
    if (wkSent.has(p)) continue;
    wkSent.add(p);
    const pcm = pcmData.get(p);
    if (!pcm) continue;
    pcmData.delete(p);
    addPaths[p] = pcm; give.push(pcm.buffer);
  }
  const r = await wkPress({ t: "press", id: ++wkSeq, state, sched, idPath, addPaths, skip }, give);
  return [r.L, r.R];
}

// THE FALLBACK — the same walk, here, blocking. Kept honest rather than kept
// quiet: this is the arrangement that made the mix go bare, and the only reason
// to run it is that the alternative on this page is no tape at all.
async function pressOnThisThread(state, sched, idPath, skip) {
  const { E, SE, FP, SP, SRnd, benv } = await mainDeps();
  const buffers = {};
  for (const id in idPath) buffers[id] = pcmData.get(idPath[id]);
  const eng = SRnd.makeStreamEngine({ E, SE, FP, SP,
    mergeIvals: window.FaustRenderCore.mergeIvals,
    mkProc: benv.mkProc, rootOf: benv.rootOf, SR, BS, dx7Presets: benv.dx7Presets });
  const info = await eng.open(state, { buffers, sched });
  const L = new Float32Array(info.TOTAL), R = new Float32Array(info.TOTAL);
  for (let n = 0; n < info.nChunks; n++) {
    const c = eng.renderChunk(n);
    L.set(c.L.subarray(0, c.length), c.startSample);
    R.set(c.R.subarray(0, c.length), c.startSample);
  }
  eng.close();
  const cut = Math.min(skip, L.length);
  // COPIED, not sliced: bounce.js's window cache holds these for the session, and
  // a subarray would pin the whole pre-roll-and-tail buffer behind every entry.
  return [L.slice(cut), R.slice(cut)];
}
