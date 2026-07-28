// faust/live/stream-worker.js — the STREAM PRODUCER (Phase 3 of the live-engine rebuild).
//
// A module Worker (new Worker(BASE+"stream-worker.js",{type:"module"})) that wraps
// the Phase-1 env-agnostic core faust/stream-renderer.js (makeStreamEngine) with a
// BROWSER faustwasm backend, then pumps its continuous full-mix stereo stream into
// a SharedArrayBuffer ring — one chord-bar chunk at a time — ahead of the reader's
// cursor. The reader is faust/ring-player.js; the control-block + ring layout is
// documented there (this file is the single WRITER of R_WRITE / R_CLOSED).
//
// The faustwasm setup mirrors faust/stem-worker.js:404-425 EXACTLY (module Worker,
// FaustMonoDspGenerator.createOfflineProcessor(SR,BS,factory) over the dist/*.wasm),
// so the browser `mkProc`/`rootOf` injected into makeStreamEngine produce the same
// offline processors press.js/segment-parity drive in node.
//
// MESSAGES (from the conductor / ring-test.html):
//   {type:"init"}                               → load deps, compile backend, "ready"
//   {type:"open", state, buffers, speech, gen,  → open the stream on ring `ringIndex`,
//                 ctrlSab, ringSab, ringIndex,      prime `primeSec`, then pump chunks
//                 cap, primeSec, runwaySec}         under backpressure to `runwaySec`
//   {type:"stop"}                               → halt the pump (frees the ring)
// POSTS (all echo the open's `gen` so the conductor can ignore superseded opens):
//   {type:"ready"} · {type:"initfail",error} · {type:"opened",info,gen} ·
//   {type:"primed",filled,gen} · {type:"status",...,gen} · {type:"eos",cursor,gen} ·
//   {type:"stopped",cursor,gen} · {type:"openfail",error,gen}
//
// PHASE 4 — TWO PRODUCERS. One worker instance is spawned PER RING (worker0↔ring0,
// worker1↔ring1) so a new state's bridge renders in PARALLEL with continued
// playback of the old ring. A worker owns a SINGLE ring for its whole life, but is
// RE-OPENED for each new state routed to that ring (ping-pong). `ringIndex` selects
// the per-ring control block (base = C_RING0 + ringIndex*RING_STRIDE); the audio
// SAB for that ring arrives as `ringSab` (legacy `ring0Sab` still accepted).
"use strict";

// ── control-block layout (must match faust/ring-player.js) ──
const C_STATE = 0, C_READ = 1 /*unused here*/, C_UNDER_CNT = 6;   // (globals we don't write)
const C_RING0 = 8, RING_STRIDE = 4, R_WRITE = 0, R_READ = 1, R_CLOSED = 2;

const SR = 44100, BS = 64;
const RUNWAY_SEC = 16;     // default seconds buffered ahead of the reader (override per open)
const PRIME_SEC = 12;      // default fill before "primed" (override per open; bridges use ~2.5s)

let ENV = null;            // { mkProc, rootOf, dx7Presets, E, SE, FP, SP, mergeIvals }
let eng = null;            // makeStreamEngine instance (one per worker — re-openable)
// Concurrency: opens are SERIALIZED on `opChain` (only one runPump ever touches the
// shared engine state at a time). Each open captures a token; `activeToken` is the
// latest open, so a superseded pump (rapid repoint) sees token!==activeToken and
// bails promptly WITHOUT starting/continuing. `stopReq` retires the current pump.
let opSeq = 0, activeToken = -1, stopReq = false;
let opChain = Promise.resolve();
// WAV-FIRST v3.1: the buffer table for the CURRENT wavOut open. It is the SAME object
// reference handed to eng.openLive (ST.buffers === liveBuffers), so an addBuffers merge
// lands whether or not the async open has completed yet. `activeGen` guards stale opens.
let liveBuffers = {}, activeGen = -1;
// WAV-FIRST resilience: the vocoder speech CARRIER for the current wavOut open. Set at open
// (may be null — the open no longer blocks on the speech decode) and updated by a late
// setSpeech once the carrier decodes; applied post-open so a carrier that lands during the
// async open is not lost. `eng.setSpeech` rebinds the live vocoder unit's carrier.
let liveSpeech = null;
// LIVE mode (Phase 5a): the caller pushes chord-bar specs into `liveBars`; the live
// pump drains them one at a time into the ring under the SAME backpressure. `liveEos`
// tells the pump the caller is done (drain then close). Reset per openLive.
let liveBars = [], liveEos = false;

// release a retired/finished pump's feed globals. Cleared
// ONLY when this pump is still the latest open (token === activeToken) — a newer
// open has already re-pointed liveBars/liveBuffers/liveSpeech to its own gen's
// data, and clobbering those would break the newer stream. Called on the eos/
// segeos exits too (a wavOut worker retired at gen cutover gets feedEos, never
// 'stop' — the decoded-PCM table would otherwise stay pinned here for the whole
// life of the next gen).
function clearFeedGlobals(token) {
  if (token !== activeToken) return;
  liveBuffers = {}; liveSpeech = null; liveBars = []; activeGen = -1;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── conductor metronome (ring path only) ────────────────────────────────────
// Hidden pages clamp their own setTimeout/setInterval to >=1s (worse under
// pressure), which would starve the conductor's page-side feed pump + bar
// scheduler while a background tab keeps PLAYING the ring. Dedicated-worker
// timers are NOT visibility-throttled, so each live ring open runs this coarse
// ~4Hz tick; live.js onMsg("tick") tops the feed runway and drains due bars.
// Started on openLive, stopped on stop (a retired producer goes quiet).
let tickTimer = 0;
function startTicks() { if (!tickTimer) tickTimer = setInterval(() => { try { self.postMessage({ type: "tick" }); } catch (e) {} }, 250); }
function stopTicks() { if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; } }

// ── browser-safe interleaved-stereo 16-bit WAV encoder (no Node Buffer) ──
// Used by the renderWav path (below) for the conductor's BACKGROUND-WAV producer.
// Truncates toward zero (`*32767|0`) to match wav.js's "trunc" mode + emits the
// identical canonical 44-byte RIFF/WAVE header, so the bytes are the same shape the
// node WAV writers produce — just built with DataView so it runs in a Worker.
function encodeWavPCM(L, R, sr) {
  const n = L.length, ch = 2, dataLen = n * ch * 2;
  const buf = new ArrayBuffer(44 + dataLen), dv = new DataView(buf);
  let o = 0;
  const w = (s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); };
  w("RIFF"); dv.setUint32(o, 36 + dataLen, true); o += 4; w("WAVE");
  w("fmt "); dv.setUint32(o, 16, true); o += 4; dv.setUint16(o, 1, true); o += 2; dv.setUint16(o, ch, true); o += 2;
  dv.setUint32(o, sr, true); o += 4; dv.setUint32(o, sr * ch * 2, true); o += 4; dv.setUint16(o, ch * 2, true); o += 2; dv.setUint16(o, 16, true); o += 2;
  w("data"); dv.setUint32(o, dataLen, true); o += 4;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i])) * 32767 | 0;
    const r = Math.max(-1, Math.min(1, R[i])) * 32767 | 0;
    dv.setInt16(o, l, true); o += 2; dv.setInt16(o, r, true); o += 2;
  }
  return buf;
}

// renderWav: an OFFLINE, dur-capped whole-song render of `state` to a single WAV
// ArrayBuffer — OFF the audio ring path (this worker instance owns no ring; the
// conductor spawns a DEDICATED stream-worker for it). Drives the same makeStreamEngine
// open()+renderChunk() press-parity path as segment-parity, concatenating the chunks,
// then encodes to WAV. Caller: the iOS background-WAV producer (faust/live.js) —
// NO msg.buffers → found is not baked, matching the live faust mix; deterministic +
// loop-tolerant survival loop. (msg.buffers/msg.speech let a caller ship decoded
// found/sampler PCM for a full-mix press.) Progress posts as {wavprog}.
// Supersede-aware (activeToken) so a newer target during a long render bails promptly.
async function renderWav(msg, token) {
  const gen = msg.gen | 0;
  const alive = () => token === activeToken && !stopReq;
  const durSec = msg.durSec > 0 ? msg.durSec : 32;
  const info = await eng.open(msg.state, { buffers: msg.buffers || {}, speech: msg.speech || null, opts: { dur: durSec } });
  if (!alive()) { eng.close(); self.postMessage({ type: "wavcancel", gen }); return; }
  const total = info.TOTAL;
  const L = new Float32Array(total), R = new Float32Array(total);
  for (let n = 0; n < info.nChunks; n++) {
    if (!alive()) { eng.close(); self.postMessage({ type: "wavcancel", gen }); return; }
    const c = eng.renderChunk(n);
    L.set(c.L.subarray(0, c.length), c.startSample);
    R.set(c.R.subarray(0, c.length), c.startSample);
    if ((n & 7) === 0) self.postMessage({ type: "wavprog", gen, chunk: n, nChunks: info.nChunks, totalSec: info.totalSec });
    if ((n & 3) === 0) await sleep(0);   // yield: never hog the worker thread (off the audio path)
  }
  eng.close();
  const wav = encodeWavPCM(L, R, SR);
  self.postMessage({ type: "wav", gen, durSec, frames: total, wav }, [wav]);
}

async function initDeps() {
  const BASE = new URL(".", self.location.href).href;   // .../faust/live/
  const FAUST = new URL("..", BASE).href;               // .../faust/
  await import(FAUST + "../theory.js");             // -> self.CsdTheory  (MUSIC-MIND organ; must precede csd-engine)
  await import(FAUST + "../pipes.js");              // -> self.CsdPipes   (MUSIC-MIND organ; must precede csd-engine)
  await import(FAUST + "../csd-engine.js");         // -> self.CsdEngine
  await import(FAUST + "voices/state-engine.js");   // -> self.FaustStateEngine
  await import(FAUST + "press/render-core.js");     // -> self.FaustRenderCore (mergeIvals)
  await import(FAUST + "voices/found-player.js");   // -> self.FoundPlayer (mixPCM)
  await import(FAUST + "voices/sampler.js");        // -> self.FaustSampler (mixPCM)
  await import(BASE + "stream-renderer.js");        // -> self.FaustStreamRenderer (makeStreamEngine)

  const fw = await import(FAUST + "node_modules/@grame/faustwasm/dist/esm/index.js");
  const { FaustWasmInstantiator, FaustMonoDspGenerator } = fw;
  const gen = new FaustMonoDspGenerator();
  const factories = {};   // module -> Promise<factory> (fetch+compile once)
  const resolved = {};    // module -> factory (for rootOf)
  const factory = (mod) => factories[mod] || (factories[mod] =
    FaustWasmInstantiator.loadDSPFactory(FAUST + `dist/${mod}-module.wasm`, FAUST + `dist/${mod}-meta.json`)
      .then((f) => { if (!f) throw new Error("no factory for " + mod); resolved[mod] = f; return f; }));
  const mkProc = async (mod) => gen.createOfflineProcessor(SR, BS, await factory(mod));
  // PARAM ROOT off the UI tree, not the declared name (render-core.paramRoot):
  // dx7.lib's top-level "DX7" group renames the path root; every other module
  // is unchanged; the wrong root leaves DX7 a pure-FM drone (params never bind).
  const rootOf = (mod) => self.FaustRenderCore.paramRoot(resolved[mod].json);

  let dx7Presets = {};
  try { dx7Presets = await (await fetch(FAUST + "data/dx7-presets.json")).json(); } catch (e) {}

  ENV = { mkProc, rootOf, dx7Presets,
    E: self.CsdEngine, SE: self.FaustStateEngine,
    FP: self.FoundPlayer, SP: self.FaustSampler,
    mergeIvals: self.FaustRenderCore.mergeIvals };
  eng = self.FaustStreamRenderer.makeStreamEngine({
    E: ENV.E, SE: ENV.SE, FP: ENV.FP, SP: ENV.SP, mergeIvals: ENV.mergeIvals,
    mkProc: ENV.mkProc, rootOf: ENV.rootOf, SR, BS, dx7Presets: ENV.dx7Presets });
}

// pump: render chunks 0..nChunks-1 into ring `ringIndex`, respecting backpressure.
// The producer is the SINGLE writer of this ring's R_WRITE / R_CLOSED and — at the
// idle-ring HANDOFF only (this ring is retired/not being read when re-opened) —
// resets R_READ to 0 so the reader consumes the new stream from frame 0.
async function runPump(msg, token) {
  const gen = msg.gen | 0;
  const alive = () => token === activeToken && !stopReq;
  // superseded before we even started (a newer open landed while queued): bail
  // WITHOUT resetting the ring or opening — the newer open owns this ring now.
  // eng.close() drops any ST a previous pump left (opChain serializes pumps, so
  // the newer open's ST cannot exist yet — close is always safe at a pump exit).
  if (!alive()) { eng.close(); self.postMessage({ type: "stopped", cursor: 0, gen }); return; }

  const ringIndex = msg.ringIndex | 0;
  const ctrl = new Int32Array(msg.ctrlSab);
  const ring = new Float32Array(msg.ringSab || msg.ring0Sab);   // interleaved L,R
  const cap = msg.cap | 0;
  const rBase = C_RING0 + ringIndex * RING_STRIDE;
  const r0w = rBase + R_WRITE, r0r = rBase + R_READ, r0c = rBase + R_CLOSED;
  const runwaySec = msg.runwaySec != null ? msg.runwaySec : RUNWAY_SEC;
  const primeSec = msg.primeSec != null ? msg.primeSec : PRIME_SEC;
  const filled = () => Atomics.load(ctrl, r0w) - Atomics.load(ctrl, r0r);

  // idle-ring handoff reset: rewind this ring's cursors before writing from 0.
  Atomics.store(ctrl, r0r, 0);
  Atomics.store(ctrl, r0w, 0);
  Atomics.store(ctrl, r0c, 0);

  const info = await eng.open(msg.state, { buffers: msg.buffers || {}, speech: msg.speech || null,
    opts: msg.durSec ? { dur: msg.durSec } : undefined });
  if (!alive()) { eng.close(); self.postMessage({ type: "stopped", cursor: 0, gen }); return; }   // superseded during ingest
  self.postMessage({ type: "opened", info, gen });

  // largest chunk (chord-bar) — the ring must always have room for one whole chunk
  let maxChunk = BS;
  for (let i = 1; i < info.S.length; i++) maxChunk = Math.max(maxChunk, info.S[i] - info.S[i - 1]);
  const runway = Math.min(cap - maxChunk, runwaySec * SR);
  const primeAt = Math.min(runway, primeSec * SR);
  if (maxChunk > cap) { self.postMessage({ type: "openfail", error: `chunk ${maxChunk} > ring ${cap}`, gen }); return; }

  let cursor = 0, primed = false, lastStatus = 0;
  while (alive() && cursor < info.nChunks) {
    // backpressure: wait while the ring can't hold another chunk OR we're already
    // a full runway ahead. The reader draining below `runway` releases the pump.
    while (alive() && (filled() + maxChunk > cap || filled() >= runway)) await sleep(10);
    if (!alive()) break;

    const c = eng.renderChunk(cursor);           // { L, R, startSample, length }
    let w = Atomics.load(ctrl, r0w);
    for (let i = 0; i < c.length; i++) {
      const b = ((w + i) % cap) * 2;
      ring[b] = c.L[i]; ring[b + 1] = c.R[i];
    }
    Atomics.store(ctrl, r0w, w + c.length);      // publish AFTER the samples are written
    cursor++;

    const fl = filled();
    if (!primed && fl >= primeAt) { primed = true; self.postMessage({ type: "primed", filled: fl, gen }); }
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (now - lastStatus > 500) {
      lastStatus = now;
      self.postMessage({ type: "status", cursor, nChunks: info.nChunks, filledSec: +(fl / SR).toFixed(2),
        underruns: Atomics.load(ctrl, C_UNDER_CNT), primed, gen, ringIndex });
    }
  }
  if (cursor >= info.nChunks) {
    Atomics.store(ctrl, r0c, 1);                  // stream fully written (natural EOS)
    self.postMessage({ type: "eos", cursor, gen });
  } else {
    // stopped early (retired / superseded): abandon the not-yet-written chunks and
    // free the engine's ST (proc fleet + buffer table) — a retired gen's whole
    // decoded-PCM table otherwise stays pinned until the NEXT open on this worker.
    eng.close();
    self.postMessage({ type: "stopped", cursor, gen });
  }
}

// runLivePump: the INCREMENTAL producer. openLive sets up persistent procs from the
// initial state (no whole-song ingest), then we drain the caller-fed `liveBars` queue
// one chord-bar at a time — eng.feedBar (ingest + param glide) then eng.renderChunk —
// writing each window into ring `ringIndex` under the identical backpressure as the
// whole-song pump. The procs are never reset, so params glide across bars. The pump
// waits (doesn't underrun the writer) when the caller hasn't fed the next bar yet.
async function runLivePump(msg, token) {
  const gen = msg.gen | 0;
  const alive = () => token === activeToken && !stopReq;
  if (!alive()) { eng.close(); self.postMessage({ type: "stopped", cursor: 0, gen }); return; }
  // this open's bar queue — a newer open re-points the module global to ITS array,
  // so all reads/releases below go through this capture and can never touch a
  // successor's queue (the alive() checks retire this pump promptly anyway).
  const bars = liveBars;

  const ringIndex = msg.ringIndex | 0;
  const ctrl = new Int32Array(msg.ctrlSab);
  const ring = new Float32Array(msg.ringSab || msg.ring0Sab);   // interleaved L,R
  const cap = msg.cap | 0;
  const rBase = C_RING0 + ringIndex * RING_STRIDE;
  const r0w = rBase + R_WRITE, r0r = rBase + R_READ, r0c = rBase + R_CLOSED;
  const runwaySec = msg.runwaySec != null ? msg.runwaySec : RUNWAY_SEC;
  const primeSec = msg.primeSec != null ? msg.primeSec : PRIME_SEC;
  const filled = () => Atomics.load(ctrl, r0w) - Atomics.load(ctrl, r0r);

  // idle-ring handoff reset: rewind this ring's cursors before writing from 0.
  Atomics.store(ctrl, r0r, 0);
  Atomics.store(ctrl, r0w, 0);
  Atomics.store(ctrl, r0c, 0);

  const info = await eng.openLive(msg.state, { buffers: msg.buffers || {}, speech: msg.speech || null });
  if (!alive()) { eng.close(); self.postMessage({ type: "stopped", cursor: 0, gen }); return; }
  self.postMessage({ type: "openedLive", info, gen });

  const runway = runwaySec * SR;
  const primeAt = Math.min(runway, primeSec * SR);
  let cursor = 0, primed = false, lastStatus = 0, maxChunk = BS;

  while (alive()) {
    // wait for the caller to feed the next bar (never spin the ring dry on the writer)
    while (alive() && cursor >= bars.length && !liveEos) await sleep(4);
    if (!alive()) break;
    if (cursor >= bars.length) break;   // liveEos and drained

    // ingest is cheap (no ring write) — do it, learn the bar length, THEN backpressure
    // (AUDIT-TRUTH: keep only the bar's SERIAL, never the spec itself — a live
    // binding to the spec would pin one bar's units/events past bars[cursor]=null,
    // across the wait for the next bar.)
    const barSerial = bars[cursor] && bars[cursor].serial != null ? bars[cursor].serial : null;
    const fb = await eng.feedBar(bars[cursor]);
    maxChunk = Math.max(maxChunk, fb.length);
    if (maxChunk > cap) { self.postMessage({ type: "openfail", error: `chunk ${maxChunk} > ring ${cap}`, gen }); return; }
    while (alive() && (filled() + fb.length > cap || filled() >= runway)) await sleep(10);
    if (!alive()) break;

    const c = eng.renderChunk(cursor);
    let w = Atomics.load(ctrl, r0w);
    for (let i = 0; i < c.length; i++) { const b = ((w + i) % cap) * 2; ring[b] = c.L[i]; ring[b + 1] = c.R[i]; }
    Atomics.store(ctrl, r0w, w + c.length);   // publish AFTER the samples are written
    bars[cursor] = null;   // release the consumed bar spec (never re-read; NULL, never splice — indexing/.length are load-bearing)
    cursor++;
    // AUDIT-TRUTH (ring route): renderChunk has ALREADY measured every faust voice's
    // actual dry-send energy for this window against the notes fed into it, so the
    // audit costs one small message per chord-bar here — nothing in the reader
    // worklet, nothing in a render callback. The conductor keys it by the bar's
    // serial (postFeed rides it on the bar spec; tail windows carry none, and an
    // oversized bar split into sub-windows posts one table per window for the
    // conductor to merge). The sampler/found layers are NOT in this stream on the
    // ring route — live.js plays them natively and audits them there.
    if (c.audit && barSerial != null)
      self.postMessage({ type: "baraudit", gen, serial: barSerial, voices: c.audit.voices });

    const fl = filled();
    if (!primed && fl >= primeAt) { primed = true; self.postMessage({ type: "primed", filled: fl, gen }); }
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (now - lastStatus > 500) {
      lastStatus = now;
      self.postMessage({ type: "status", cursor, nChunks: bars.length, filledSec: +(fl / SR).toFixed(2),
        underruns: Atomics.load(ctrl, C_UNDER_CNT), primed, gen, ringIndex, live: true });
    }
  }
  if (liveEos && cursor >= bars.length) { Atomics.store(ctrl, r0c, 1); clearFeedGlobals(token); self.postMessage({ type: "eos", cursor, gen }); }
  else {
    // retired (commitFade posts 'stop', never feedEos, so THIS is the ring path's
    // cutover exit): free the engine's ST + this gen's feed globals — otherwise the
    // retired ring's proc fleet stays pinned until the next-next crossfade.
    eng.close(); clearFeedGlobals(token);
    self.postMessage({ type: "stopped", cursor, gen });
  }
}

// runBarAccumPump: the shared skeleton for both WAV-FIRST sinks (see WAV-FIRST.md).
// Same engine open as runLivePump (buffers + speech INCLUDED so bars carry the sampler
// + found layers, baked here since the audible path is a media element, not a live
// graph) and the same caller-fed liveBars/feedBar protocol — but instead of writing a
// SAB ring it ACCUMULATES whole chord-bars into a segment BODY [C_k, C_{k+1}) (bar-
// aligned by construction) and, when the body reaches segSec, hands the clean body to
// the route `sink` to post. segIdx 0 uses firstSegSec (time-to-first-sound); rest segSec.
async function runBarAccumPump(msg, token, segDefault, firstDefault, sink) {
  const gen = msg.gen | 0;
  const alive = () => token === activeToken && !stopReq;
  if (!alive()) { eng.close(); self.postMessage({ type: "segstopped", gen }); return; }
  // this open's bar queue (see runLivePump): reads/releases below can never touch
  // a newer open's re-pointed module global.
  const bars = liveBars;
  const segTarget = (msg.segSec > 0 ? msg.segSec : segDefault) * SR;
  const firstTarget = (msg.firstSegSec > 0 ? msg.firstSegSec : firstDefault) * SR;

  const info = await eng.openLive(msg.state, { buffers: msg.buffers || {}, speech: msg.speech || null, bakeNative: true });
  if (!alive()) { eng.close(); self.postMessage({ type: "segstopped", gen }); return; }
  // apply a carrier that arrived via setSpeech WHILE the async open was in flight (race:
  // openLive awaits mkProc, a late setSpeech can land before ST exists → eng.setSpeech
  // no-ops there; re-apply here now that the stream is open).
  if (liveSpeech && liveSpeech !== msg.speech && eng.setSpeech) { try { eng.setSpeech(liveSpeech); } catch (e) {} }
  self.postMessage({ type: "openedSegs", info, gen });

  let cursor = 0, segIdx = 0;
  let accChunks = [], accFrames = 0, barMap = [];
  const emit = () => {
    if (!accFrames) return;
    const bodyN = accFrames;
    const bodyL = new Float32Array(bodyN), bodyR = new Float32Array(bodyN);
    let o = 0;
    for (const c of accChunks) { bodyL.set(c.L.subarray(0, c.length), o); bodyR.set(c.R.subarray(0, c.length), o); o += c.length; }
    sink({ gen, segIdx, bodyL, bodyR, bodyN, barMap });
    segIdx++;
    accChunks = []; accFrames = 0; barMap = [];
  };

  while (alive()) {
    while (alive() && cursor >= bars.length && !liveEos) await sleep(4);
    if (!alive()) break;
    if (cursor >= bars.length) break;   // liveEos and drained
    const barSpec = bars[cursor];
    await eng.feedBar(barSpec);
    const c = eng.renderChunk(cursor);
    bars[cursor] = null;   // release the consumed bar spec (never re-read; NULL, never splice — indexing/.length are load-bearing)
    // AUDIT-TRUTH: ride the per-bar expected-vs-actual audit through on the bar's meta
    // (opaque to the seg/pcm sinks, mp3-worker and mp3-stream — meta passes verbatim),
    // so the conductor sees it alongside serial/section at onBar time.
    const meta = barSpec.meta ? (c.audit ? Object.assign({}, barSpec.meta, { audit: c.audit }) : barSpec.meta) : (c.audit ? { audit: c.audit } : null);
    barMap.push({ off: accFrames, meta });
    accChunks.push({ L: c.L, R: c.R, length: c.length });
    accFrames += c.length;
    cursor++;
    if (accFrames >= (segIdx === 0 ? firstTarget : segTarget)) emit();
    if ((cursor & 7) === 0) await sleep(0);   // yield: never hog the worker thread
  }
  // segeos is the wavOut gen-cutover exit (the retired worker gets feedEos, never
  // 'stop'), so the feed globals — liveBuffers IS this gen's whole decoded-PCM
  // table (same object as ST.buffers) — must be released here, not just on 'stop'.
  if (liveEos && cursor >= bars.length) { emit(); eng.close(); clearFeedGlobals(token); self.postMessage({ type: "segeos", gen, cursor }); }
  else { eng.close(); clearFeedGlobals(token); self.postMessage({ type: "segstopped", gen, cursor }); }
}

// segsSink (WAV-FIRST v2 A/B-element route): bakes a CROSSFADE OVERLAP so the conductor's
// two <audio> elements overlap-add to unity (constant-gain, correlated content). Each
// segment carries a HEAD (the previous body's clean last OV, faded IN so the seam
// downbeat lands at the fade end so the next kick plays clean at full) and a TAIL (its
// own last OV, faded OUT to end exactly at the next downbeat). Gains g_in[j]=(j+.5)/OV,
// g_out[j]=(OV-.5-j)/OV sum to 1 exactly (gate 1). Seg0 has no head: bridgeIn crossfades
// its first OV against the old gen's tail on the other element; boot uses a ~5ms micro
// fade-in from silence. Playback starts the next element early at durSec-OV (live.js).
function segsSink(msg) {
  const OV = Math.max(1, Math.round((msg.overlapSec > 0 ? msg.overlapSec : 0.120) * SR));
  const ME = Math.max(1, Math.round(0.005 * SR));   // ~5ms micro-edge (boot head insurance)
  const bridgeIn = !!msg.bridgeIn;                  // seg0 crossfades against a prior gen's tail
  const RMS_HOP = Math.floor(SR / 10);              // ~10 Hz envelope for the conductor's rms()
  const fadeIn = (L, R, n) => { for (let i = 0; i < n; i++) { const g = (i + 0.5) / n; L[i] *= g; R[i] *= g; } };
  const fadeOut = (L, R, start, n) => { for (let j = 0; j < n; j++) { const g = (n - 0.5 - j) / n; L[start + j] *= g; R[start + j] *= g; } };
  let prevTailL = null, prevTailR = null;   // clean last-OV of the previous body -> next head
  return ({ gen, segIdx, bodyL, bodyR, bodyN, barMap }) => {
    // capture this body's CLEAN tail (last OV) BEFORE any fade — becomes the next head.
    const tailN = Math.min(OV, bodyN);
    const nextTailL = bodyL.slice(bodyN - tailN), nextTailR = bodyR.slice(bodyN - tailN);
    // assemble [prevTail head?] ++ body
    const headN = prevTailL ? prevTailL.length : 0;
    const segLen = headN + bodyN;
    const L = new Float32Array(segLen), R = new Float32Array(segLen);
    if (headN) { L.set(prevTailL, 0); R.set(prevTailR, 0); }
    L.set(bodyL, headN); R.set(bodyR, headN);
    // head: OV fade over the duplicated head (interior) or the body start (bridge seg0);
    // ~5ms micro from silence for the very first boot segment. tail: OV fade-out to the downbeat.
    fadeIn(L, R, Math.min((headN || bridgeIn) ? OV : ME, segLen));
    fadeOut(L, R, segLen - Math.min(OV, segLen), Math.min(OV, segLen));

    const nEnv = Math.max(1, Math.ceil(segLen / RMS_HOP));
    const rmsEnv = new Float32Array(nEnv);
    for (let k = 0; k < nEnv; k++) {
      const a = k * RMS_HOP, b = Math.min(segLen, a + RMS_HOP);
      let s = 0; for (let i = a; i < b; i++) { const m = (L[i] + R[i]) * 0.5; s += m * m; }
      rmsEnv[k] = Math.sqrt(s / Math.max(1, b - a));
    }
    const outBar = barMap.map((e) => ({ off: e.off + headN, meta: e.meta }));   // shift past the head
    const wav = encodeWavPCM(L, R, SR);
    self.postMessage({ type: "seg", gen, idx: segIdx, wav, durSec: segLen / SR, bodySec: bodyN / SR,
      overlapSec: OV / SR, barMap: outBar, rmsEnv }, [wav, rmsEnv.buffer]);
    prevTailL = nextTailL; prevTailR = nextTailR;
  };
}

// pcmSink (WAV-FIRST v3 MP3-append route): posts CLEAN PCM flushes — no fades, no encode.
// The seam crossfade and the single MP3 encode both happen downstream in the dedicated
// encoder worker (faust/mp3-worker.js). barMap offsets are relative to the flush's first sample.
function pcmSink() {
  return ({ gen, segIdx, bodyL, bodyR, bodyN, barMap }) => {
    self.postMessage({ type: "pcmseg", gen, idx: segIdx, L: bodyL.buffer, R: bodyR.buffer,
      n: bodyN, durSec: bodyN / SR, barMap }, [bodyL.buffer, bodyR.buffer]);
  };
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || !msg.type) return;
  if (msg.type === "init") {
    try { await initDeps(); self.postMessage({ type: "ready" }); }
    catch (err) { self.postMessage({ type: "initfail", error: String(err && err.message || err) }); }
    return;
  }
  if (msg.type === "open") {
    if (!eng) { self.postMessage({ type: "openfail", error: "not ready", gen: msg.gen | 0 }); return; }
    // SERIALIZE opens on opChain (never two runPumps on one engine at once) and
    // supersede via `activeToken` so a queued/running older pump exits promptly.
    stopReq = false;
    const token = ++opSeq;
    activeToken = token;
    opChain = opChain.then(() => runPump(msg, token)
      .catch((err) => self.postMessage({ type: "openfail", error: String(err && err.stack || err), gen: msg.gen | 0 })));
    return;
  }
  // ── LIVE mode (Phase 5a) ──
  if (msg.type === "openLive") {
    if (!eng) { self.postMessage({ type: "openfail", error: "not ready", gen: msg.gen | 0 }); return; }
    startTicks();   // conductor metronome for the ring path (throttle-proof feed clock)
    stopReq = false; liveBars = []; liveEos = false;
    const token = ++opSeq;
    activeToken = token;
    opChain = opChain.then(() => runLivePump(msg, token)
      .catch((err) => self.postMessage({ type: "openfail", error: String(err && err.stack || err), gen: msg.gen | 0 })));
    return;
  }
  // ── WAV-FIRST segment sink (mobile audible path — see WAV-FIRST.md) ──
  if (msg.type === "openLiveSegs") {
    if (!eng) { self.postMessage({ type: "openfail", error: "not ready", gen: msg.gen | 0 }); return; }
    stopReq = false; liveBars = []; liveEos = false;
    msg.buffers = msg.buffers || {}; liveBuffers = msg.buffers; activeGen = msg.gen | 0; liveSpeech = msg.speech || null;
    const token = ++opSeq;
    activeToken = token;
    opChain = opChain.then(() => runBarAccumPump(msg, token, 16, 4, segsSink(msg))
      .catch((err) => self.postMessage({ type: "openfail", error: String(err && err.stack || err), gen: msg.gen | 0 })));
    return;
  }
  // ── WAV-FIRST v3 PCM sink (mobile MP3 append path — clean PCM to the encoder worker) ──
  if (msg.type === "openLivePcm") {
    if (!eng) { self.postMessage({ type: "openfail", error: "not ready", gen: msg.gen | 0 }); return; }
    stopReq = false; liveBars = []; liveEos = false;
    msg.buffers = msg.buffers || {}; liveBuffers = msg.buffers; activeGen = msg.gen | 0; liveSpeech = msg.speech || null;
    const token = ++opSeq;
    activeToken = token;
    opChain = opChain.then(() => runBarAccumPump(msg, token, 2, 2, pcmSink())
      .catch((err) => self.postMessage({ type: "openfail", error: String(err && err.stack || err), gen: msg.gen | 0 })));
    return;
  }
  // ── BACKGROUND-WAV render (iOS background-audio handoff) ──
  if (msg.type === "renderWav") {
    if (!eng) { self.postMessage({ type: "wavfail", error: "not ready", gen: msg.gen | 0 }); return; }
    stopReq = false;
    const token = ++opSeq;
    activeToken = token;
    opChain = opChain.then(() => renderWav(msg, token)
      .catch((err) => self.postMessage({ type: "wavfail", error: String(err && err.stack || err), gen: msg.gen | 0 })));
    return;
  }
  // WAV-FIRST v3.1: merge streamed-in PCM into the current open's live buffer table.
  // Guarded on activeGen so a stray addBuffers for a superseded open is dropped.
  if (msg.type === "addBuffers") {
    if ((msg.gen | 0) !== activeGen) return;
    const bufs = msg.buffers || {};
    Object.assign(liveBuffers, bufs);              // covers the pre-open-complete window (same ref as ST.buffers)
    if (eng && eng.addBuffers) { try { eng.addBuffers(bufs); } catch (e) {} }
    return;
  }
  // WAV-FIRST resilience: fold a late-decoded vocoder carrier into the current open (the open
  // no longer blocks on the speech decode). Guarded on activeGen so a stale carrier is dropped.
  if (msg.type === "setSpeech") {
    if ((msg.gen | 0) !== activeGen) return;
    liveSpeech = msg.speech || null;
    if (eng && eng.setSpeech) { try { eng.setSpeech(liveSpeech); } catch (e) {} }
    return;
  }
  if (msg.type === "feedBar") { liveBars.push(msg.bar); return; }
  if (msg.type === "feedEos") { liveEos = true; return; }
  if (msg.type === "stop") {
    // retire the current pump (+ metronome) and drop this open's feed globals NOW
    // (the retiring pump's exit also clears them — this covers the no-pump case).
    // The pumps only touch their captured `bars` reference, so re-pointing the
    // module globals here is safe mid-pump.
    stopReq = true; stopTicks();
    liveBuffers = {}; liveSpeech = null; liveBars = []; activeGen = -1;
    return;
  }
};
