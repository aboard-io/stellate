// faust/live.js — the LIVE CONDUCTOR (Phase 5b: continuous ring-buffer engine).
//
//   <script src="csd-engine.js"></script>
//   <script src="faust/state-engine.js"></script>
//   <script src="faust/found-player.js"></script>
//   <script src="faust/live.js"></script>
//   const handle = await FaustLive.exploreLive(getState, onStatus, { onBar, onLoad });
//   handle.stop();
//
// This REPLACES the old JIT/pool/eco/stem-cache scheduler outright. The audio is
// now CLICK-FREE BY CONSTRUCTION: a stream renderer (faust/stream-worker.js →
// faust/stream-renderer.js) writes a continuous full-mix stereo PCM stream into a
// SharedArrayBuffer ring; the faust/ring-player.js AudioWorklet reads it one sample
// per output sample. There are no per-bar AudioBufferSourceNode seams to click.
//
// THE MODEL (Paul's): write audio into a buffer, read from it continuously; when the
// TIMBRE/PARAMS change, GLIDE within the one stream (per-bar feedBar into never-reset
// persistent procs — the DSP's own si.smooth ramps every change); when the TOPOLOGY
// changes (genre / model swap / unit add-remove), render the new state into a SECOND
// ring and equal-power CROSSFADE between the two rings (the ring-player mixes both).
//
// The conductor here owns TWO stream-worker producers ping-ponging on ring0/ring1,
// one authoritative per-bar section/ci/serial walk (lifted from the old injectChord),
// a runway-gated feed pump, a read-cursor→ctx-clock onBar scheduler, and NATIVE found
// (+ sampler) playback (found is never baked — it stays gapless BufferSource audio).
//
// Reuses AS-IS: faust/ring-player.js, faust/stream-worker.js, faust/stream-renderer.js,
// found-player.js, sampler.js. The state→events fabric is csd-engine + state-engine,
// the same brain press.js drives, so the live stream matches the press gold standard.
(function (root) {
  "use strict";

  const scriptSrc = (typeof document !== "undefined" && document.currentScript && document.currentScript.src)
    || (typeof location !== "undefined" ? location.origin + "/faust/live.js" : "faust/live.js");
  const BASE = new URL(".", scriptSrc).href;   // .../faust/
  const SITE = new URL("..", BASE).href;       // site root (found/, found/samples/)

  // ── ring control-block layout (must match ring-player.js / stream-worker.js) ──
  const SR = 44100, BS = 64;
  const C_STATE = 0, C_XFADE = 1, C_ACTIVE = 2, C_READ_LO = 3, C_READ_HI = 4,
        C_UNDERRUN = 5, C_UNDER_CNT = 6;
  const C_RING0 = 8, RING_STRIDE = 4, R_WRITE = 0, R_READ = 1;

  const RING_SEC = 30, RING_FRAMES = RING_SEC * SR;    // each ring holds ~30s
  const TARGET_SEC = 3.0, TARGET_FRAMES = TARGET_SEC * SR;  // runway we keep filled ahead (short = responsive steering)
  const XFADE_MS = 400;                                // equal-power state-change crossfade
  const PRIME_SEC = 2.0, BRIDGE_PRIME_SEC = 1.2;       // fill before a stream is "primed"
  const WORKER_RUNWAY = 8;                             // worker self-backpressure ceiling (> TARGET; live.js is the limiter)

  async function exploreLive(getState, onStatus, opts) {
    opts = opts || {};
    const E = root.CsdEngine, SE = root.FaustStateEngine, FP = root.FoundPlayer, SP = root.FaustSampler;
    if (!E || !SE || !FP) throw new Error("FaustLive needs csd-engine.js, faust/state-engine.js, faust/found-player.js loaded first");
    const status = (m) => { if (onStatus) try { onStatus(m); } catch (e) {} };
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const errors = [];

    // ── AudioContext (44100 so the ring reader is 1:1 with the render rate) ──
    const AC = root.AudioContext || root.webkitAudioContext;
    let ctx;
    try { ctx = new AC({ sampleRate: SR, latencyHint: "playback" }); } catch (e) { ctx = new AC(); }
    try { ctx.resume(); } catch (e) {}

    // ── MEDIA-ELEMENT OUTPUT ROUTE (mobile background survival) — MOBILE ONLY ──
    // iOS/Android silence a bare WebAudio graph on screen-lock but keep a *playing*
    // <audio> element alive. Route the master through a MediaStreamAudioDestinationNode
    // and play its stream from a real element (created INSIDE the play gesture). Desktop
    // uses classic ctx.destination (drift-free). Ported from the old engine.
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ""));
    // Safari (desktop incl.) SUSPENDS the AudioContext on tab/window background and
    // will NOT resume it from a non-gesture event (visibilitychange/focus) — so a
    // bare ctx.destination graph freezes the ring-player mid-buffer and CoreAudio
    // repeats that last quantum forever ("tiny chunk loops permanently"). The media-
    // element route (an <audio> playing a MediaStream) is treated as MEDIA PLAYBACK
    // that Safari keeps alive across focus changes, no gesture-resume needed — the
    // old engine used it for exactly this. So route through it on Safari too.
    const isSafari = /^((?!chrome|crios|chromium|android|fxios|edg).)*safari/i.test(ua) &&
      /Apple/.test((typeof navigator !== "undefined" && navigator.vendor) || "");
    let msDest = null, mediaEl = null;
    const canMediaEl = !opts.directOut && !opts.forceClassicOut && (opts.forceMediaEl || isMobile || isSafari) &&
      typeof document !== "undefined" &&
      typeof ctx.createMediaStreamDestination === "function" && typeof root.Audio !== "undefined";
    if (canMediaEl) {
      try {
        msDest = ctx.createMediaStreamDestination();
        mediaEl = new root.Audio();
        mediaEl.autoplay = true;
        mediaEl.setAttribute("playsinline", "");
        mediaEl.playsInline = true;
        mediaEl.srcObject = msDest.stream;
        if (typeof document.body !== "undefined" && document.body) { mediaEl.style.display = "none"; document.body.appendChild(mediaEl); }
        const pr = mediaEl.play(); if (pr && pr.catch) pr.catch(() => {});
      } catch (e) { msDest = null; mediaEl = null; }
    }
    // periodic element recycle (opt-in: opts.elRecycleSec > 0) — resets the media
    // element's playback-clock drift by handing off to a fresh element gaplessly.
    let elRecycleTimer = 0;
    if (mediaEl && opts.elRecycleSec > 0) {
      elRecycleTimer = setInterval(() => {
        try {
          const fresh = new root.Audio();
          fresh.autoplay = true; fresh.muted = true;
          fresh.setAttribute("playsinline", ""); fresh.playsInline = true;
          fresh.srcObject = msDest.stream; fresh.style.display = "none";
          if (document.body) document.body.appendChild(fresh);
          const old = mediaEl;
          fresh.addEventListener("playing", () => {
            fresh.muted = false;
            try { old.muted = true; old.pause(); old.srcObject = null; old.remove(); } catch (e) {}
            mediaEl = fresh; try { handle.mediaEl = fresh; } catch (e) {}
          }, { once: true });
          const pr = fresh.play(); if (pr && pr.catch) pr.catch(() => { try { fresh.remove(); } catch (e) {} });
        } catch (e) {}
      }, opts.elRecycleSec * 1000);
    }

    // ── SharedArrayBuffer rings + control block ──
    if (typeof SharedArrayBuffer === "undefined")
      throw new Error("FaustLive: SharedArrayBuffer unavailable (page must be cross-origin isolated: COOP:same-origin + COEP:require-corp)");
    const ctrlSab = new SharedArrayBuffer(16 * 4);
    const ctrl = new Int32Array(ctrlSab);
    const ringSabs = [new SharedArrayBuffer(RING_FRAMES * 2 * 4), new SharedArrayBuffer(RING_FRAMES * 2 * 4)];
    const read53 = () => (Atomics.load(ctrl, C_READ_HI) * 0x100000000) + (Atomics.load(ctrl, C_READ_LO) >>> 0);
    const ringFilled = (r) => Atomics.load(ctrl, C_RING0 + r * RING_STRIDE + R_WRITE) - Atomics.load(ctrl, C_RING0 + r * RING_STRIDE + R_READ);

    // ── output graph: ring-player → masterGain → analyser → (mediaEl | destination) ──
    status("loading engine…");
    await ctx.audioWorklet.addModule(BASE + "ring-player.js");
    const ringNode = new AudioWorkletNode(ctx, "ring-player",
      { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: { ctrlSab, ring0Sab: ringSabs[0], ring1Sab: ringSabs[1], cap: RING_FRAMES } });
    const masterGain = ctx.createGain(); masterGain.gain.value = 1;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    ringNode.connect(masterGain);
    masterGain.connect(analyser);
    if (msDest) analyser.connect(msDest); else analyser.connect(ctx.destination);

    // ── found routing: a small submix into master. dry → master; rev/del/pp → a
    // light native reverb (short feedback delay + lowpass) → master. Found stays
    // NATIVE (BufferSource, gapless); it is never baked into the worker stream. ──
    const foundDry = ctx.createGain(); foundDry.connect(masterGain);
    const foundRev = ctx.createGain(), foundDel = ctx.createGain(), foundPp = ctx.createGain();
    const fvDelay = ctx.createDelay(0.5); fvDelay.delayTime.value = 0.14;
    const fvFb = ctx.createGain(); fvFb.gain.value = 0.42;
    const fvLp = ctx.createBiquadFilter(); fvLp.type = "lowpass"; fvLp.frequency.value = 3200;
    foundRev.connect(fvDelay); foundDel.connect(fvDelay); foundPp.connect(fvDelay);
    fvDelay.connect(fvLp); fvLp.connect(fvFb); fvFb.connect(fvDelay); fvLp.connect(masterGain);
    const foundDests = { dry: foundDry, rev: foundRev, del: foundDel, pp: foundPp };
    const foundBeds = FP.FoundLive(ctx, foundDests);
    const foundChops = FP.FoundLive(ctx, foundDests);
    const foundVox = FP.FoundLive(ctx, foundDests);
    const VOXISH = /^(sp_|vx_|vox_|tw_)/;

    // ── ALWAYS-ON Faust CLICK MONITOR (Paul's production detector) ──
    // dsp/clickmon.dsp tapped off master (passthrough → hard-muted terminal so the
    // browser keeps scheduling it). Its bargraphs (out-param port messages) carry
    // monotonic click/gap counters. This is the acceptance-gate detector, so it is
    // built on the main thread even though all synthesis is in the worker.
    let clickMonState = null;
    try {
      const fw = await import(BASE + "node_modules/@grame/faustwasm/dist/esm/index.js");
      const { FaustWasmInstantiator, FaustMonoDspGenerator } = fw;
      const gen = new FaustMonoDspGenerator();
      const fac = await FaustWasmInstantiator.loadDSPFactory(BASE + "dist/clickmon-module.wasm", BASE + "dist/clickmon-meta.json");
      const cm = await gen.createNode(ctx, "clickmon", fac);
      masterGain.connect(cm);
      const cmSink = ctx.createGain(); cmSink.gain.value = 0;
      cm.connect(cmSink); cmSink.connect(ctx.destination);
      clickMonState = { node: cm, latest: { clicks: 0, peakjump: 0, rms: 0, gaps: 0 } };
      cm.setOutputParamHandler((path, value) => {
        const L = clickMonState.latest;
        if (path.endsWith("/clicks")) L.clicks = value;
        else if (path.endsWith("/peakjump")) L.peakjump = value;
        else if (path.endsWith("/rms")) L.rms = value;
        else if (path.endsWith("/gaps")) L.gaps = value;
      });
    } catch (e) { errors.push("clickmon: " + (e && e.message || e)); }

    // ── found / sampler decode caches (decode-ahead at feed; tolerate failures) ──
    const bufCache = {};       // srcId -> AudioBuffer | null | undefined
    const bufFail = new Set();
    function kickBuffer(src) {
      if (!src || bufCache[src.id] !== undefined) return;
      const url = src.url || (src.samplePath ? new URL(src.samplePath, SITE).href : null);
      if (!url || bufFail.has(url)) { bufCache[src.id] = null; return; }
      bufCache[src.id] = undefined;
      FP.decodeUrlToBuffer(ctx, url).then((b) => { bufCache[src.id] = b || null; })
        .catch((e) => { bufFail.add(url); bufCache[src.id] = null; });
    }
    const samplerBufs = {};    // srcId -> AudioBuffer | null (RAW, sampler)
    function kickSamplerBuf(srcId, foundSources) {
      if (!SP || samplerBufs[srcId] !== undefined) return;
      const src = (foundSources || []).find((s) => s.id === srcId);
      const url = src && (src.url || (src.samplePath ? new URL(src.samplePath, SITE).href : null));
      if (!url) { samplerBufs[srcId] = null; return; }
      samplerBufs[srcId] = undefined;
      SP.decodeUrlRaw(ctx, url).then((b) => { samplerBufs[srcId] = b || null; }).catch(() => { samplerBufs[srcId] = null; });
    }
    const samplerPlayers = new Map();
    const samplerOf = (key) => { if (!SP) return null; if (!samplerPlayers.has(key)) samplerPlayers.set(key, SP.SamplerLive(ctx, foundDests)); return samplerPlayers.get(key); };

    // ── mixer layers (buried feature: a baked full-mix can't be de-mixed live, so
    // gain/mute/solo are no-ops; rms/active are coarse from the overall meter + the
    // last played bar's unit table). Shape preserved for explorer's mixer panel. ──
    const LAYER_DEFS = [
      ["pad", "pads"], ["bass", "bass"], ["lead", "lead"], ["kick", "kick"], ["snare", "snare"],
      ["hats", "hats/toms"], ["fx", "stabs/sfx"], ["beds", "found bed"], ["chops", "found chops"], ["vox", "hits/vox"],
    ];
    const LAYER_OF_UNIT = (key) =>
      key === "pad" ? "pad" : key === "bass" ? "bass"
      : key === "melody" || key.slice(0, 5) === "solo:" ? "lead"
      : key === "kick" ? "kick" : key === "snare" ? "snare"
      : key === "hat" || key === "tom" ? "hats"
      : key === "stab" || key === "sfx" ? "fx" : "fx";
    let lastPlayedLayers = new Set();

    // ================================================================ CONDUCTOR
    // Two stream-worker producers, one PINNED per ring (worker0↔ring0, worker1↔ring1).
    const workers = [null, null];
    const workerReady = [false, false];
    const workerReadyProm = [null, null];
    const readyResolve = [null, null];
    function ensureWorker(wi) {
      if (workerReadyProm[wi]) return workerReadyProm[wi];
      workerReadyProm[wi] = new Promise((resolve) => {
        readyResolve[wi] = resolve;
        const w = new Worker(BASE + "stream-worker.js", { type: "module" });
        workers[wi] = w;
        w.onmessage = (e) => onMsg(wi, e.data);
        w.onerror = (e) => errors.push("worker" + wi + " error: " + ((e && e.message) || e));
        w.postMessage({ type: "init" });
      });
      return workerReadyProm[wi];
    }

    let genCounter = 0;
    let cur = null, br = null;              // current + bridging stream objects
    let phase = "idle";                    // idle | bridging | fading  (before RUN: idle, cur priming)
    let running = false, abort = false;
    let fadeStartCursor = 0, fadeStartMs = 0, fadeTimer = 0, swapTimer = 0;

    // the onBar playback queue: bars awaiting their read-cursor crossing.
    const playQueue = [];

    function newStream(ring) {
      return { ring, wi: ring, gen: null, sig: null, readyToFeed: false, primed: false,
        fedFrames: 0, fedMusicalSec: 0, startGlobal: null, preFeed: [], pendingBars: [] };
    }
    function postOpenLive(stream, one, primeSec) {
      stream.gen = ++genCounter;
      workers[stream.wi].postMessage({ type: "openLive", gen: stream.gen, ringIndex: stream.ring, state: one,
        buffers: {}, speech: null, ctrlSab, ringSab: ringSabs[stream.ring], cap: RING_FRAMES,
        primeSec: primeSec, runwaySec: WORKER_RUNWAY });
    }
    function postFeed(stream, r) {
      workers[stream.wi].postMessage({ type: "feedBar", bar: {
        units: r.units, events: r.events, fxParams: r.fxParams, spb: r.spb, lo: r.lo, hi: r.hi,
        barStartSec: r._base, sweeps: r._sweeps } });
    }
    function openStream(stream, one, primeSec) {
      const go = () => {
        postOpenLive(stream, one, primeSec);
        stream.readyToFeed = true;
        const pf = stream.preFeed; stream.preFeed = [];
        for (const rr of pf) postFeed(stream, rr);
      };
      if (workerReady[stream.wi]) go(); else ensureWorker(stream.wi).then(go);
    }
    function feed(stream, r) {
      // stream-absolute sweep mapping (sweeps are rare — only section open/close)
      const base = stream.fedMusicalSec;
      r._base = base;
      r._sweeps = (r.sweepsRaw || []).map((sw) => ({ t0: base + (sw.beat - r.lo) * r.spb,
        t1: base + (sw.beat + sw.durB - r.lo) * r.spb, from: sw.from, to: sw.to }));
      const localStart = stream.fedFrames;
      stream.fedFrames += r.barLenFrames;
      stream.fedMusicalSec += r.musicalSec;
      const barRec = { len: r.barLenFrames, meta: r.meta, found: r.found, foundSources: r.foundSources,
        spb: r.spb, lo: r.lo, units: r.units, events: r.events };
      if (stream.startGlobal != null) { barRec.globalStart = stream.startGlobal + localStart; playQueue.push(barRec); }
      else { barRec.localStart = localStart; stream.pendingBars.push(barRec); }
      // decode-ahead any found/sampler sources this bar needs (ready by playback)
      for (const f of (r.found || [])) kickBuffer((r.foundSources || []).find((s) => s.id === f.srcId));
      for (const e of (r.events || [])) { const u = r.units[e.unit]; if (u && u.sampler) for (const z of (u.sampler.zones || [])) kickSamplerBuf(z.srcId, r.foundSources); }
      if (stream.readyToFeed) postFeed(stream, r); else stream.preFeed.push(r);
    }
    function flushPending(stream) {
      for (const pb of stream.pendingBars) { pb.globalStart = stream.startGlobal + pb.localStart; playQueue.push(pb); }
      stream.pendingBars = [];
    }

    function beginBridge(r) {
      phase = "bridging";
      br = newStream(cur.ring ^ 1);
      br.sig = r.sig;
      openStream(br, r.one, BRIDGE_PRIME_SEC);
      feed(br, r);
    }
    function repointBridge(r) {   // coalesce a newer target mid-bridge (supersede via new gen)
      br.sig = r.sig; br.primed = false; br.readyToFeed = false;
      br.fedFrames = 0; br.fedMusicalSec = 0; br.pendingBars = []; br.preFeed = [];
      openStream(br, r.one, BRIDGE_PRIME_SEC);
      feed(br, r);
    }
    function startFade() {
      phase = "fading";
      fadeStartCursor = read53();
      fadeStartMs = now();
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = setInterval(() => {
        const el = now() - fadeStartMs;
        if (el >= XFADE_MS) { Atomics.store(ctrl, C_XFADE, 10000); clearInterval(fadeTimer); fadeTimer = 0; waitSwap(); }
        else Atomics.store(ctrl, C_XFADE, Math.min(9999, Math.floor(10000 * el / XFADE_MS)));
      }, 5);
    }
    function waitSwap() {
      if (swapTimer) clearInterval(swapTimer);
      swapTimer = setInterval(() => {
        if (Atomics.load(ctrl, C_ACTIVE) === br.ring && Atomics.load(ctrl, C_XFADE) === 0) {
          clearInterval(swapTimer); swapTimer = 0; commitFade();
        }
      }, 3);
    }
    function commitFade() {
      // prune old-stream bars that will never play (superseded by the crossfade),
      // then re-base the bridge's fed bars onto the global cursor and adopt it.
      for (let i = playQueue.length - 1; i >= 0; i--) if (playQueue[i].globalStart >= fadeStartCursor) playQueue.splice(i, 1);
      br.startGlobal = fadeStartCursor;
      flushPending(br);
      const old = cur;
      cur = br; br = null; phase = "idle";
      try { workers[old.wi].postMessage({ type: "stop" }); } catch (e) {}   // retire the old producer / free its ring
    }

    function startRun() {
      running = true;
      cur.startGlobal = 0;
      flushPending(cur);
      Atomics.store(ctrl, C_ACTIVE, cur.ring);
      Atomics.store(ctrl, C_XFADE, 0);
      Atomics.store(ctrl, C_STATE, 1);   // RUN
      status(ctx.state === "running" ? "live (faust) — drag the space" : "live (tap again if silent)");
      startBarScheduler();
      startLoadReporter();
      ensureWorker(1);   // pre-init the idle worker so the first crossfade is snappy
    }

    function onMsg(wi, m) {
      if (!m || !m.type) return;
      if (m.type === "ready") { workerReady[wi] = true; if (readyResolve[wi]) readyResolve[wi](); return; }
      if (m.type === "initfail") { errors.push("worker" + wi + " initfail: " + m.error); return; }
      const stream = (cur && cur.gen === m.gen) ? cur : (br && br.gen === m.gen) ? br : null;
      if (!stream) return;   // superseded open — ignore
      if (m.type === "primed") {
        if (stream === cur && !running) startRun();
        else if (stream === br && phase === "bridging" && !br.primed) { br.primed = true; startFade(); }
        return;
      }
      if (m.type === "openfail") { errors.push("openfail gen" + m.gen + ": " + m.error); return; }
      // openedLive / status / eos / stopped: informational
    }

    // ================================================================ THE WALK
    // ONE authoritative section/ci/serial walk (lifted from the old injectChord):
    // seed+serial*7919 per bar, collapsed single-cycle sections, fills only on the
    // last cycle, sweeps only on first/last, chordEvery-aware CBEATS. It polls
    // getState() each bar (retarget/glide = mutating what getState returns).
    let ci = 0, serial = 0, secIdx = 0, cycIdx = 0, absBeat = 0;
    function grooveSec(st) {
      const score = (s) => (s.pads ? 1 : 0) + (s.bass && s.bass !== "off" ? 1 : 0) +
        (s.drums && s.drums !== "off" ? 2 : 0) + (s.melody && s.melody !== "off" ? 1 : 0);
      let best = st.sections[0];
      for (const s of st.sections) if (score(s) > score(best) || (/peak|chorus|drop|lift|swell/.test(s.name) && score(s) >= score(best))) best = s;
      return best;
    }
    // topology signature over the FAUST (worker-rendered) units only — found/sampler
    // are native and don't affect the stream topology. A change here = a crossfade.
    function sigOf(units) {
      const keys = [];
      for (const k of Object.keys(units)) { const u = units[k]; if (u && !u.sampler) keys.push(k + ":" + (u.module || "")); }
      return keys.sort().join("|");
    }
    function stepWalk() {
      const st = getState();
      const prg = (E.PROGRESSIONS[st.progression] || E.PROGRESSIONS.royal_road);
      const nch = prg.chords.length;
      ci = ci % nch;
      const secs = st.sections && st.sections.length ? st.sections : [grooveSec(st)];
      secIdx = secIdx % secs.length;
      const cur0 = secs[secIdx], lastCyc = cycIdx >= (cur0.cycles || 1) - 1;
      const sec = Object.assign({}, cur0, { cycles: 1,
        fill: lastCyc ? (cur0.fill || "off") : "off",
        sweep: (cycIdx === 0 && cur0.sweep === "open") || (lastCyc && cur0.sweep === "close") ? cur0.sweep : "off" });
      const one = Object.assign({}, st, { sections: [sec], seed: ((st.seed || 1) + serial * 7919) >>> 0 });
      const spb = 60 / st.bpm;
      const CBEATS = Math.max(2, Math.round(st.chordEvery || 8));
      const lo = ci * CBEATS, hi = lo + CBEATS;
      const ev = E.buildEvents(one);
      const units = SE.voiceUnits(E, one);
      const m = SE.mapEvents(E, one, ev, { lo, hi, units });
      const fxParams = SE.fxParams(one);
      const meta = { serial, ci, nch, spb, cbeats: CBEATS, chord: (prg.chords[ci] || {}).name || "",
        section: sec.name, absBeatLo: absBeat, lo };
      const barLenFrames = Math.max(BS, Math.round((hi - lo) * spb * SR / BS) * BS);
      const r = { one, units, sig: sigOf(units), spb, lo, hi, events: m.events, fxParams,
        sweepsRaw: m.sweeps, found: m.found, foundSources: one.foundSources || [], meta,
        barLenFrames, musicalSec: (hi - lo) * spb };
      // advance the walk (mirrors the old injectChord finally)
      absBeat += CBEATS; ci++; serial++;
      if (ci >= nch) { ci = 0; cycIdx++; if (cycIdx >= (secs[secIdx].cycles || 1)) { cycIdx = 0; secIdx = (secIdx + 1) % secs.length; } }
      return r;
    }

    // decide glide (feedBar into the one stream) vs crossfade (new stream + ring)
    function produceAndRoute() {
      const r = stepWalk();
      if (!cur) { cur = newStream(0); cur.sig = r.sig; openStream(cur, r.one, PRIME_SEC); feed(cur, r); return; }
      if (phase === "fading") return;   // hold: the fade is ~400ms, bars are seconds — nothing due
      if (phase === "bridging") {
        if (r.sig === br.sig) feed(br, r); else repointBridge(r);
        return;
      }
      // idle
      if (r.sig === cur.sig) feed(cur, r); else beginBridge(r);
    }

    // ── feed pump: keep the feed-target runway filled to TARGET, gated on playback ──
    function feedRunwayFrames() {
      if (phase === "bridging" && br) return br.fedFrames;   // bridge not active yet (played 0)
      if (!cur) return 0;
      const played = cur.startGlobal != null ? Math.max(0, read53() - cur.startGlobal) : 0;
      return cur.fedFrames - played;
    }
    let pumpTimer = 0;
    function pump() {
      if (abort) return;
      try {
        let guard = 0;
        while (!abort && phase !== "fading" && guard < 24 && feedRunwayFrames() < TARGET_FRAMES) { produceAndRoute(); guard++; }
      } catch (e) { errors.push("pump: " + (e && e.message || e)); console.error("FaustLive pump", e); }
      pumpTimer = setTimeout(pump, 25);
    }

    // ── onBar scheduler: fire opts.onBar (+ schedule native found/sampler) at each
    // bar's PLAYBACK instant, derived from the ring-player read cursor → ctx clock. ──
    let barTimer = 0;
    function startBarScheduler() {
      if (barTimer) return;
      barTimer = setInterval(() => {
        if (abort) return;
        const pg = read53();
        while (playQueue.length && playQueue[0].globalStart <= pg) fireBar(playQueue.shift(), pg);
      }, 30);
    }
    function fireBar(b, pg) {
      const when = ctx.currentTime + (b.globalStart - pg) / SR;   // ≈ ctx.currentTime (bar just reached playback)
      lastPlayedLayers = new Set([...Object.keys(b.units)].map(LAYER_OF_UNIT));
      try { scheduleNative(b, when); } catch (e) { errors.push("found@" + b.meta.serial + ": " + (e && e.message || e)); }
      if (opts.onBar) try {
        opts.onBar({ serial: b.meta.serial, ci: b.meta.ci, nch: b.meta.nch, when: when,
          spb: b.meta.spb, cbeats: b.meta.cbeats, chord: b.meta.chord, section: b.meta.section });
      } catch (e) {}
    }
    // native found (bed/chop/vox) + sampler at playback — the same fabric the old
    // injectChord scheduled, on the ctx clock via at(beat).
    function scheduleNative(b, when) {
      const spb = b.spb, lo = b.lo;
      const at = (beat) => when + (beat - lo) * spb;
      const beatAbs = (beat) => b.meta.absBeatLo + (beat - lo);
      // sampler notes (native BufferSource, like found)
      if (SP) for (const e of (b.events || [])) {
        const u = b.units[e.unit]; if (!u || !u.sampler) continue;
        const player = samplerOf(e.unit);
        const midi = SP.midiOfFreq(e.sets.freq);
        const z = SP.zoneFor(u.sampler.zones, midi);
        const buf = z && samplerBufs[z.srcId];
        if (!player || !buf) continue;
        const zsr = u.sampler.sr || 44100;
        player.note(buf, at(e.beat), { rate: SP.rateFor(z, midi), durSec: e.durB * spb,
          gain: (u.lvl || 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
          atk: u.sampler.atk, rel: u.sampler.rel, swell: !!u.sampler.swell, mello: u.sampler.mello || null,
          songT: beatAbs(e.beat) * spb, dry: u.dry != null ? u.dry : 1, rsend: u.rev || 0, dsend: u.del || 0,
          bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0,
          loop: !!z.loop, loopStartSec: (z.loopStart || 0) / zsr, loopEndSec: (z.loopEnd || 0) / zsr });
      }
      // found chops + beds (bed re-anchored at bar start of chord 0)
      for (const f of (b.found || [])) {
        const buf = bufCache[f.srcId];
        if (!buf) continue;
        if (f.type === "chop") {
          const lane = VOXISH.test(f.srcId) ? foundVox : foundChops;
          lane.chop(buf, at(f.beat), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch, offset: f.offset,
            cutoff: f.cutoff, rsend: f.rsend, dsend: f.dsend, ppsend: f.ppsend, fade: f.fade,
            sqRate: f.sqRate, sqDepth: f.sqDepth, autoTune: f.autoTune });
        } else if (b.meta.ci === 0) {
          foundBeds.bed(buf, at(lo), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch,
            stretch: f.stretch, cutoff: f.cutoff, autoTune: f.autoTune });
        }
      }
    }

    // ── onLoad reporter (~250ms): r = runway health, e = 0 (eco deleted) ──
    let loadTimer = 0, loadRatio = 1;
    function startLoadReporter() {
      if (loadTimer) return;
      loadTimer = setInterval(() => {
        if (abort) return;
        const runSec = Math.max(0, feedRunwayFrames()) / SR;
        loadRatio = Math.min(1, runSec / TARGET_SEC);
        if (opts.onLoad) try { opts.onLoad(loadRatio, 0); } catch (e) {}
      }, 250);
    }

    // ── background survival: iOS/Safari SUSPEND the AudioContext when the page is
    // hidden (app-switch / screen-lock / tab-switch), freezing the ring-player mid-
    // buffer so CoreAudio repeats that last real quantum ("a tiny sample repeats
    // infinitely"). We can't reliably keep the ctx alive, so instead we MUTE at the
    // source the instant we go hidden — set the worklet to emit silence (C_STATE=2,
    // which also FREEZES the read cursor so the timeline stays coherent) AND zero the
    // master gain — so whatever iOS freezes-and-repeats is SILENCE, not music. On
    // return we resume the ctx, unmute, and refill. visibilitychange is the right
    // signal: it fires on real backgrounding, NOT on a desktop window-switch (where
    // audio should keep playing). pagehide/pageshow cover the iOS bfcache path. ──
    const goHidden = () => {
      if (abort) return;
      try { Atomics.store(ctrl, C_STATE, 2); } catch (e) {}   // worklet → silence, cursor frozen
      try { masterGain.gain.value = 0; } catch (e) {}          // belt-and-suspenders: silence at the sink
    };
    const goVisible = () => {
      if (abort) return;
      if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
      if (mediaEl) { try { const pr = mediaEl.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {} }
      try { Atomics.store(ctrl, C_STATE, 1); } catch (e) {}    // resume from the frozen cursor
      try { const t = ctx.currentTime; masterGain.gain.cancelScheduledValues(t); masterGain.gain.setValueAtTime(0, t); masterGain.gain.linearRampToValueAtTime(1, t + 0.02); } catch (e) {}   // fade in — no click on return
      try { pump(); } catch (e) {}                              // refill now, don't wait for the throttled timer
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => { (document.visibilityState === "hidden" ? goHidden : goVisible)(); });
      root.addEventListener("pagehide", goHidden);
      root.addEventListener("pageshow", goVisible);
      root.addEventListener("focus", goVisible);
    }

    // ── boot: init worker0, then let the pump fill the runway; RUN on primed ──
    await ensureWorker(0);
    status("priming…");
    pump();

    const rmsBuf = new Float32Array(analyser.fftSize);
    const analyserRms = () => { analyser.getFloatTimeDomainData(rmsBuf); let s = 0; for (let i = 0; i < rmsBuf.length; i++) s += rmsBuf[i] * rmsBuf[i]; return Math.sqrt(s / rmsBuf.length); };

    const handle = {
      ctx, analyser, errors, mediaEl,
      // REAL mixer view — but a baked full-mix can't be de-mixed live: gain/mute/solo
      // are no-ops (buried feature), rms/active are coarse (overall meter + last bar).
      layers() {
        const rms = analyserRms();
        return LAYER_DEFS.map(([id, label]) => {
          const active = lastPlayedLayers.has(id);
          return { id, label, gain: 1, muted: false, solo: false, active,
            rms() { return active ? rms : 0; }, setGain() {}, setMute() {}, setSolo() {} };
        });
      },
      // pre-open the idle worker so a later crossfade is snappy (real speedup proxy)
      prepare(targetState) { try { ensureWorker(cur ? (cur.ring ^ 1) : 1); } catch (e) {} },
      // real proxy: runway health ("am I keeping up"); the rest are stubs (deleted machinery)
      loadRatio: () => loadRatio,
      ecoLevel: () => 0,
      nodeCount: () => (cur && cur.sig ? cur.sig.split("|").filter(Boolean).length : 0),
      awakeCount: () => (cur && cur.sig ? cur.sig.split("|").filter(Boolean).length : 0),
      awakeCost: () => 0, costCeiling: () => 0, costStealCount: () => 0,
      poolCount: () => 0, reapCount: () => 0, harvestCount: () => 0, maxWorklets: () => 0, preparedCount: () => 0,
      outputRoute: msDest ? "mediaEl" : "direct",
      workletTruth: () => ({ created: 0, destroyed: 0, alive: 0, counted: 0 }),
      stemStats: () => null,
      journal: () => [],
      sentinel: () => null,
      renderCapacity: () => null,
      // ALWAYS-ON click monitor readout (the acceptance-gate detector). clicks/gaps
      // are the DSP's monotonic counters; null only if the clickmon node failed.
      clickMon: () => clickMonState ? {
        clicks: clickMonState.latest.clicks, gaps: clickMonState.latest.gaps,
        peakjump: clickMonState.latest.peakjump, rms: clickMonState.latest.rms, logs: 0,
      } : null,
      clickMonThr: (v) => { if (clickMonState) try { clickMonState.node.setParamValue("/clickmon/thr", v); } catch (e) {} },
      // ring / underrun telemetry (real — reads the shared control block)
      underruns: () => Atomics.load(ctrl, C_UNDER_CNT),
      underrunFlag: () => Atomics.load(ctrl, C_UNDERRUN),
      runwaySec: () => Math.max(0, feedRunwayFrames()) / SR,
      readCursor: () => read53(),
      rms() { return analyserRms(); },
      balance() {
        if (!this._balTap) {
          const sp = ctx.createChannelSplitter(2);
          const mk = () => { const a = ctx.createAnalyser(); a.fftSize = 2048; return a; };
          const aL = mk(), aR = mk();
          sp.connect(aL, 0); sp.connect(aR, 1);
          masterGain.connect(sp);
          this._balTap = { aL, aR, buf: new Float32Array(2048) };
        }
        const t = this._balTap, r = (a) => { a.getFloatTimeDomainData(t.buf); let s = 0; for (let i = 0; i < t.buf.length; i++) s += t.buf[i] * t.buf[i]; return Math.sqrt(s / t.buf.length); };
        return { l: r(t.aL), r: r(t.aR) };
      },
      stop() {
        abort = true;
        clearTimeout(pumpTimer); if (barTimer) clearInterval(barTimer); if (loadTimer) clearInterval(loadTimer);
        if (fadeTimer) clearInterval(fadeTimer); if (swapTimer) clearInterval(swapTimer);
        if (elRecycleTimer) clearInterval(elRecycleTimer);
        Atomics.store(ctrl, C_STATE, 2);   // stopped — ring-player emits silence
        for (const w of workers) if (w) { try { w.postMessage({ type: "stop" }); } catch (e) {} }
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisible);
          root.removeEventListener("focus", onVisible); root.removeEventListener("pageshow", onVisible);
        }
        const tNow = ctx.currentTime;
        try { masterGain.gain.cancelScheduledValues(tNow); masterGain.gain.setValueAtTime(masterGain.gain.value, tNow); masterGain.gain.linearRampToValueAtTime(0, tNow + 0.06); } catch (e) {}
        if (mediaEl) { try { mediaEl.pause(); mediaEl.srcObject = null; mediaEl.remove(); } catch (e) {} }
        try { foundBeds.stopAll(); foundChops.stopAll(); foundVox.stopAll(); } catch (e) {}
        for (const [, p] of samplerPlayers) { try { p.stopAll(); } catch (e) {} }
        setTimeout(() => { for (const w of workers) if (w) { try { w.terminate(); } catch (e) {} } try { ctx.close(); } catch (e) {} }, 1200);
        status("stopped");
      },
    };
    root.FaustLive.lastHandle = handle;
    return handle;
  }

  root.FaustLive = { exploreLive, BASE, SITE };
})(typeof window !== "undefined" ? window : globalThis);
