// audio/press-worker.js — THE TAPE IS PRESSED ON A THREAD NOBODY IS LISTENING TO.
//
// Paul, on staging 2026-08-17: "The green progress bar is jumpy and there's a
// slight jumpiness in the sound that corresponds… and sometimes the mix drops
// out totally, all the reverb and so forth and it's just bare, then it comes
// back a measure later." Both halves are one fact, and the fact is a thread.
//
// audio/press-window.js used to drive the parent's offline walk RIGHT HERE, on
// the main thread — `eng.renderChunk(n)` is a synchronous WASM call, and a
// window is a few of them in a row with no await between. Measured with
// chromium's own longtask observer on the composed beatles song: 23 blocks over
// 500 ms in under two minutes, the worst of them 11.5 s, 47% of wall clock with
// the thread simply gone. On the far side of a block the music is under 30% of
// level, because audio/transport.js schedules 0.15 s ahead and a 5 s block is
// thirty-three lookaheads: the graph plays out what it was already handed and
// then has nothing. The fill bar froze for the same reason, in the same task.
//
// It was not always so, and the regression is measurable: before the tape moved
// onto the parent's press it was an OfflineAudioContext, and chromium runs one
// of those ON ITS OWN THREAD. The press is faster and truer and it is the right
// engine — it just came back to the ear's thread to run.
//
// So it leaves again. This is a module Worker doing exactly what press-window's
// section 3 did, with nothing added and nothing musical changed: the same deps
// in the same order, the same makeStreamEngine per window, the same chunk walk.
// The tape is bit-for-bit the tape it was; only the thread it is made on has
// moved, which is the whole of the fix. bounce.js has always said that "a
// bounce that starves the audible path has made the wrong trade" — a worker is
// how the trade stops being made at all, rather than being made more politely.
//
// WHAT DOES *NOT* COME HERE: the translation. A nukernel bar becomes a parent
// schedule through GENRES, POOL and SONG, which are the app's own live state,
// and shipping those across a boundary would be a second opinion about the band
// on screen. press-window.js keeps that on the main thread — it is arithmetic
// over the score, it costs milliseconds, and it is the half that must agree with
// what the ear is hearing. Only the samples cross.
//
// THE PCM LIVES HERE AND ONLY HERE. Decoding needs an AudioContext, which a
// worker has not got, so press-window fetches and decodes and then TRANSFERS the
// Float32Array — the page keeps a length, this keeps the samples. Keyed on the
// sample PATH rather than the source id, because a schedule addresses zones by
// id and two ids may name one file; the id→path map rides with each press and
// costs nothing. The page therefore never holds a second copy of the sample
// layer, which is the one thing about the old arrangement worth missing.
"use strict";

const HERE = new URL(".", self.location.href).href;          // …/nukernel/audio/
const ROOTDIR = new URL("../../", HERE).href;
const FAUSTDIR = new URL("engine/faust/", ROOTDIR).href;
const SR = 44100, BS = 64;

let ENV = null;                        // the parent's env, built once
const BUF = Object.create(null);       // samplePath -> Float32Array, cumulative

// The parent's own loading order, the one engine/faust/live/stream-worker.js has
// been running in a Worker since the stream landed. Note what is ABSENT:
// genres-data, registry-data and genre-kernel never arrive, because a state that
// has already been resolved does not need the algebra that resolved it — that
// stays on the page with the score.
async function init() {
  await import(ROOTDIR + "engine/theory.js");          // -> self.CsdTheory
  await import(ROOTDIR + "engine/pipes.js");           // -> self.CsdPipes
  await import(ROOTDIR + "engine/csd-engine.js");      // -> self.CsdEngine
  await import(FAUSTDIR + "voices/state-engine.js");   // -> self.FaustStateEngine
  await import(FAUSTDIR + "press/render-core.js");     // -> self.FaustRenderCore
  await import(FAUSTDIR + "voices/found-player.js");   // -> self.FoundPlayer
  await import(FAUSTDIR + "voices/sampler.js");        // -> self.FaustSampler
  await import(FAUSTDIR + "live/stream-renderer.js");  // -> self.FaustStreamRenderer
  await import(FAUSTDIR + "press/browser-env.js");     // -> self.FaustBrowserEnv
  const benv = await self.FaustBrowserEnv.makeBrowserEnv({ base: FAUSTDIR });
  ENV = { E: self.CsdEngine, SE: self.FaustStateEngine,
          FP: self.FoundPlayer, SP: self.FaustSampler,
          mergeIvals: self.FaustRenderCore.mergeIvals,
          mkProc: benv.mkProc, rootOf: benv.rootOf, SR, BS,
          dx7Presets: benv.dx7Presets };
}

// ONE WINDOW. A FRESH stream engine per press, which is not an oversight: it is
// what press-window did on the main thread, so the procs, their state and their
// output are the same ones the tape has always been made of. The faustwasm
// factories are cached inside the env, so "fresh" costs an instantiation and
// never a compile.
async function press(m) {
  for (const p in m.addPaths) BUF[p] = m.addPaths[p];
  const buffers = {};
  for (const id in m.idPath) { const b = BUF[m.idPath[id]]; if (b) buffers[id] = b; }
  const eng = self.FaustStreamRenderer.makeStreamEngine(ENV);
  const t0 = performance.now();
  const info = await eng.open(m.state, { buffers, sched: m.sched });
  const L = new Float32Array(info.TOTAL), R = new Float32Array(info.TOTAL);
  for (let n = 0; n < info.nChunks; n++) {
    const c = eng.renderChunk(n);
    L.set(c.L.subarray(0, c.length), c.startSample);
    R.set(c.R.subarray(0, c.length), c.startSample);
  }
  eng.close();
  // THE PRE-ROLL IS CUT HERE, not on the page. The window replayed the bars
  // before its own so the reverb, the delay and the master compressor arrive at
  // the seam carrying real state; their output is not ours, and there is no
  // reason to hand the page samples it is about to throw away.
  const skip = Math.min(m.skip | 0, L.length);
  return { L: L.slice(skip), R: R.slice(skip), procMs: Math.round(performance.now() - t0) };
}

// ONE AT A TIME, chained: bounce.js renders one window at a time by design, and
// a queue here means a second ask can never find the engine mid-walk.
let chain = Promise.resolve();

self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.t === "init") {
    chain = chain.then(() => init()).then(
      () => self.postMessage({ t: "ready" }),
      (e) => self.postMessage({ t: "initfail", error: String((e && e.message) || e) }));
    return;
  }
  if (m.t === "press") {
    chain = chain.then(() => press(m)).then(
      (r) => self.postMessage({ t: "pressed", id: m.id, L: r.L, R: r.R, procMs: r.procMs },
                              [r.L.buffer, r.R.buffer]),
      (e) => self.postMessage({ t: "pressfail", id: m.id,
                               error: String((e && e.stack) || e).slice(0, 300) }));
  }
};
