// faust/live.js — LIVE facade for the Faust engine: exploreLive-compatible API.
//
//   <script src="csd-engine.js"></script>
//   <script src="faust/state-engine.js"></script>
//   <script src="faust/found-player.js"></script>
//   <script src="faust/live.js"></script>
//   const handle = await FaustLive.exploreLive(getState, onStatus,
//                    { onBar, onLoad, ecoStart });   // same shape as
//   handle.stop();                                   // WasmAudio.exploreLive
//
// Same chord-bar JIT injection semantics as the legacy csound exploreLive
// (wasm-audio.js on branch legacy-csound):
// section walking (grooveSec fallback, cycles, fills only on the last cycle,
// sweeps open/close on first/last cycle), per-bar seed evolution
// (seed + serial*7919), 8-beat chord bars, deep lookahead. The difference:
// there is NO recompile concept — timbre/param changes are AudioParam
// setValueAtTime on precompiled per-voice worklets, so glides are free.
//
// Found sound is native: AudioBufferSourceNode grain/slice scheduling
// (found-player.js), fed from decoded buffers (see found-player.js
// decodeUrlToBuffer — Range-limited fetch + lead-in skip + speech boost).
(function (root) {
  "use strict";

  const scriptSrc = (typeof document !== "undefined" && document.currentScript && document.currentScript.src)
    || (typeof location !== "undefined" ? location.origin + "/faust/live.js" : "faust/live.js");
  const BASE = new URL(".", scriptSrc).href;   // .../faust/
  const SITE = new URL("..", BASE).href;       // site root (found/, found/samples/)

  // Background survival: hidden tabs clamp timers to >=1s (audible tabs are
  // exempt from Chrome's *intensive* 1/min throttling, but not the 1s clamp).
  // 6s of scheduled audio keeps >=4-5s of margin between 1s background ticks.
  const LOOKAHEAD = 6;      // seconds of scheduled audio kept ahead
  const TICK_MS = 160;

  async function exploreLive(getState, onStatus, opts) {
    opts = opts || {};
    const E = root.CsdEngine, SE = root.FaustStateEngine, FP = root.FoundPlayer, SP = root.FaustSampler;
    if (!E || !SE || !FP) throw new Error("FaustLive needs csd-engine.js, faust/state-engine.js, faust/found-player.js loaded first");
    const status = (m) => { if (onStatus) try { onStatus(m); } catch (e) {} };

    // ---- ZERO-STATIC Stage 3: LOOKAHEAD widening (opts.stems only) ----
    // The stem worker needs a deep runway: a bar is posted at injection time
    // and its render must land by t0-1s, so injection must run ~stemLookahead
    // ahead of the playhead (~10s — Paul approved the uniform input->audible
    // latency compromise, ZERO-STATIC §Stage 3). stems off => the classic 6s,
    // byte-identical behavior.
    const LOOKA = opts.stems ? Math.max(LOOKAHEAD, opts.stemLookahead || 10) : LOOKAHEAD;
    let stem = null;   // the stem-cache module handle (initStems below; null = path dormant)

    const AC = root.AudioContext || root.webkitAudioContext;
    let ctx;
    try { ctx = new AC({ sampleRate: 44100, latencyHint: "playback" }); } catch (e) { ctx = new AC(); }
    try { ctx.resume(); } catch (e) {}

    // ---- OUTPUT-TRUTH INSTRUMENTS, part 1: zombie registry + event journal
    // (Stage 0.B/0.C — ALWAYS ON; near-zero cost: one counter bump per node
    // lifecycle, one ring write per structural event). countWorklets() below
    // can only count nodes it KNOWS about (pools + infra it tracks); the
    // registry counts every node mkNode ever built minus every node actually
    // destroy()ed, so a persistent `alive > counted` is the direct zombie
    // detector — a leaked faustwasm worklet renders every block forever and
    // is otherwise invisible (the retirePool physics, :~636). NOTE the
    // comparison is only exact BETWEEN churn: every teardown here defers its
    // destroy() by 400-2100ms (tails must ring out), and prewarm nodes live
    // ~2s outside any pool, so `alive` legitimately lags `counted` by a few
    // seconds around a swap. The gate is a SUSTAINED mismatch, not a blip.
    let _created = 0, _destroyed = 0;
    const destroyNode = (node) => {
      if (node && node.destroy) { try { node.destroy(); } catch (e) {} _destroyed++; }
    };
    // The JOURNAL: a 2048-entry ring of {t: ctx.currentTime, ev, detail} —
    // every structural event that could plausibly cause a transient glitch
    // (mkNode, pool retire/reap/harvest, insert rebuild, reverb-color swap,
    // master_mb toggle, eco shift, state arrival, bar injection). The soak's
    // sentinel attributes each click/gap to the nearest journal event: "it
    // glitched" becomes "it glitched 80ms after a dinosynth mkNode". Entries
    // are stamped at CALL time (when the main thread does the work), which is
    // when the audio thread would feel it.
    const JLEN = 2048, J = new Array(JLEN);
    let jHead = 0, jCount = 0, _lastStateObj = null;
    const jlog = (ev, detail) => {
      J[jHead] = { t: Math.round(ctx.currentTime * 1e3) / 1e3, ev, detail };
      jHead = (jHead + 1) % JLEN; if (jCount < JLEN) jCount++;
    };

    // ---- MEDIA-ELEMENT OUTPUT ROUTE (mobile background survival) — MOBILE ONLY ----
    // iOS/Android silence a bare WebAudio graph the moment the screen locks or
    // the tab backgrounds, but they keep a *playing* <audio> element alive — the
    // OS classifies it as media playback (the lock-screen surface). So we route
    // the master through a MediaStreamAudioDestinationNode and play its stream
    // from a real element, created + started INSIDE the play gesture (ctx.resume
    // above is the sibling gesture-locked step). The element becomes THE output:
    // ctx.destination is left UNCONNECTED (wiring both = double audio). The
    // AudioContext still runs — msDest pulls the graph continuously, so the
    // analyser + balance() taps (both fed from `master`, upstream) update exactly
    // as before and rms()/the boot bar keep working.
    //
    // LONG-SESSION STATIC FIX (2026-07-06, SOAK crew): this route makes the
    // <audio> element the SOLE output, and its playback clock DRIFTS from the
    // AudioContext sample clock — a drift that ACCELERATES over a session (soak
    // evidence: acidhouse ~-2.5s and citypop tens of seconds by ~10 min, both
    // genre-independent and near-zero for the first ~5 min). The MediaStream sink
    // continuously resamples/rebuffers to reconcile that growing drift, and the
    // reconciliation is audible as bass static that "builds over time, like a
    // buffering/memory issue" (Paul, on desktop). The static is INVISIBLE to the
    // in-graph analyser (it happens at the element sink, downstream) — the soak
    // caught it by tapping the element's real output via captureStream + tracking
    // mediaEl.currentTime vs ctx.currentTime. Desktop gets ZERO benefit from the
    // route (audible desktop tabs aren't throttled and don't screen-lock), so it
    // is now gated to MOBILE: desktop reverts to the classic analyser ->
    // ctx.destination path (drift-free, the pre-media-route behavior, which is
    // exactly where Paul heard the regression). Where MediaStreamDestination is
    // absent (older desktop, node) the same fallback applies.
    // opts.directOut forces the classic path; opts.forceMediaEl forces the route
    // (both for the soak A/B / mobile-branch verification). opts.forceClassicOut
    // is the USER-facing escape hatch (?forceClassicOut=1 in explorer.html):
    // classic ctx.destination even on a mobile UA — same effect as directOut,
    // named for the querystring flag it rides in on.
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || "")); // iPadOS masquerades as Mac
    let msDest = null, mediaEl = null;
    const canMediaEl = !opts.directOut && !opts.forceClassicOut && (opts.forceMediaEl || isMobile) &&
      typeof document !== "undefined" &&
      typeof ctx.createMediaStreamDestination === "function" && typeof root.Audio !== "undefined";
    if (canMediaEl) {
      try {
        msDest = ctx.createMediaStreamDestination();
        mediaEl = new root.Audio();
        mediaEl.autoplay = true;
        mediaEl.setAttribute("playsinline", "");   // iOS: stay inline, don't fullscreen
        mediaEl.playsInline = true;
        mediaEl.srcObject = msDest.stream;          // carries silence until master connects below
        if (typeof document.body !== "undefined" && document.body) {
          mediaEl.style.display = "none"; document.body.appendChild(mediaEl);
        }
        const pr = mediaEl.play(); if (pr && pr.catch) pr.catch(() => {});   // start it in the gesture
      } catch (e) { msDest = null; mediaEl = null; }
    }
    // ---- 1.7 MOBILE MEDIA RECYCLE (opt-in: opts.elRecycleSec > 0, default OFF).
    // R8: the media element's playback clock drifts from the AudioContext
    // sample clock over a long session and the MediaStream sink's reconciliation
    // is audible. A PERIODIC element swap resets that drift to zero: every
    // elRecycleSec seconds a fresh MUTED <audio> is attached to the SAME
    // MediaStream and play()ed; only once its "playing" event fires (it is
    // actually rendering) does audibility swap — unmute new, mute + detach +
    // remove old — so the handoff is gapless (both elements pull the same
    // stream for the overlap). The swap updates the outer mediaEl binding and
    // handle.mediaEl so stop() and the soak's element tap always see the
    // CURRENT element.
    let elRecycleTimer = 0;
    if (mediaEl && opts.elRecycleSec > 0) {
      elRecycleTimer = setInterval(() => {
        try {
          const fresh = new root.Audio();
          fresh.autoplay = true; fresh.muted = true;
          fresh.setAttribute("playsinline", ""); fresh.playsInline = true;
          fresh.srcObject = msDest.stream;
          fresh.style.display = "none";
          if (document.body) document.body.appendChild(fresh);
          const old = mediaEl;
          fresh.addEventListener("playing", () => {
            fresh.muted = false;
            try { old.muted = true; old.pause(); old.srcObject = null; old.remove(); } catch (e) {}
            mediaEl = fresh;
            try { handle.mediaEl = fresh; } catch (e) {}   // handle exists long before the first swap
            jlog("elRecycle", "swap");
          }, { once: true });
          const pr = fresh.play();
          if (pr && pr.catch) pr.catch(() => { try { fresh.remove(); } catch (e) {} });   // play refused: keep the old element
        } catch (e) {}
      }, opts.elRecycleSec * 1000);
    }

    status("loading Faust modules…");
    const fw = await import(BASE + "node_modules/@grame/faustwasm/dist/esm/index.js");
    const { FaustWasmInstantiator, FaustMonoDspGenerator } = fw;
    const factories = {};
    const factory = (mod) => factories[mod] || (factories[mod] =
      FaustWasmInstantiator.loadDSPFactory(BASE + `dist/${mod}-module.wasm`, BASE + `dist/${mod}-meta.json`));
    const errors = [];
    // ---- 1.5 INSTANTIATION AIRLOCK ----
    // Worklet creation inside the render window is a confirmed glitch source
    // (R2: genre entry bursts 3-6 mkNodes and the load meter blips). Every
    // POST-BOOT creation now files through a promise queue: ONE creation in
    // flight, >=150ms between creations (250ms when the load EMA reads worse
    // than 0.95 — in this repo loadRatio 1.0 = healthy, LOWER = starved), so
    // the audio thread absorbs registrations one at a time instead of as a
    // burst. BOOT IS EXEMPT: everything up to and including the FIRST
    // injectChord (fx_bus, the opening genre's pools) runs raw — boot is
    // already deliberately staggered and the 6s LOOKAHEAD hasn't been earned
    // yet, so queue-spacing it would only delay first audio. The 1.4 spike
    // guard parks the queue via airlockPausedUntil (a raw sub-0.85 load
    // sample pauses creations ~2s — the one thing we can shed instantly).
    let bootDone = false;          // flips in the first injectChord's finally
    let airlockPausedUntil = 0;    // performance.now() horizon set by 1.4
    let _mkChain = Promise.resolve(), _mkLast = 0;
    const _regMods = new Set();    // modules whose PROCESSOR is already registered
    async function mkNodeRaw(mod, tag) {
      const gen = new FaustMonoDspGenerator();
      const node = await gen.createNode(ctx, mod, await factory(mod));
      node.onprocessorerror = (e) => errors.push(tag + ": " + (e && e.message || "processorerror"));
      _created++; _regMods.add(mod); jlog("mkNode", mod + ":" + tag);   // zombie registry: every worklet birth
      return node;
    }
    function mkNodeFresh(mod, tag) {
      if (!bootDone) return mkNodeRaw(mod, tag);   // boot exemption (see above)
      const run = _mkChain.then(async () => {
        for (;;) {
          const now = performance.now();
          const spacing = loadRatio < 0.95 ? 250 : 150;
          const wait = Math.max(_mkLast + spacing - now, airlockPausedUntil - now);
          if (wait <= 0) break;
          await new Promise((r) => setTimeout(r, Math.min(wait, 400)));
        }
        _mkLast = performance.now();
        return mkNodeRaw(mod, tag);
      });
      _mkChain = run.catch(() => {});   // one failed creation must not wedge the queue
      return run;
    }
    // ---- 1.6 PREPARED-NODE STASH ----
    // handle.prepare(targetState) pre-instantiates the TARGET genre's worklets
    // while the glide is still in flight, so arrival costs ZERO instantiation
    // inside the render window. The stash is keyed by MODULE, not pool key:
    // ensurePool for a key the current genre is still playing must NOT be run
    // early (it retires the sounding pool and the next bar rebuilds the old
    // module — audible cut + double churn), so prepare parks finished nodes
    // here and mkNode ADOPTS them at the real bar arrival. Stashed nodes are
    // STOPPED (fProcessing off — compute() returns immediately, the sleep/wake
    // physics) so waiting costs ~nothing; adoption start()s them. They are
    // real live worklets, so workletTruth counts them (counted + preparedCount)
    // — but the render BUDGET (countWorklets/harvest) does not: a stopped node
    // consumes no render time and must never evict playing music. Unadopted
    // nodes expire after PREPARED_TTL (a retarget away from the prepared
    // genre) — destroyed, never leaked.
    const prepared = new Map();   // module -> [{node, born}]
    let preparedCount = 0;
    const MAX_PREPARED = 10, PREPARED_TTL = 45;   // nodes / seconds
    function stashPrepared(mod, node) {
      try { if (node.stop) node.stop(); } catch (e) {}
      if (!prepared.has(mod)) prepared.set(mod, []);
      prepared.get(mod).push({ node, born: ctx.currentTime });
      preparedCount++;
    }
    function popPrepared(mod) {
      const list = prepared.get(mod);
      if (!list || !list.length) return null;
      const { node } = list.shift(); preparedCount--;
      if (!list.length) prepared.delete(mod);
      try { if (node.start) node.start(); } catch (e) {}
      return node;
    }
    function expirePrepared() {
      const now = ctx.currentTime;
      for (const [mod, list] of prepared) {
        while (list.length && now - list[0].born > PREPARED_TTL) {
          const { node } = list.shift(); preparedCount--;
          jlog("prepExpire", mod);
          destroyNode(node);
        }
        if (!list.length) prepared.delete(mod);
      }
    }
    async function mkNode(mod, tag) {
      const pre = popPrepared(mod);
      if (pre) {
        pre.onprocessorerror = (e) => errors.push(tag + ": " + (e && e.message || "processorerror"));
        jlog("adopt", mod + ":" + tag);   // prepared node adopted: zero-cost arrival
        return pre;
      }
      return mkNodeFresh(mod, tag);
    }
    const P = (node, name) => {
      for (const k of node.parameters.keys()) if (k.endsWith("/" + name)) return node.parameters.get(k);
      return null;
    };
    // ---- 1.2 THE glide() TERMINATOR ----
    // Faust worklet params are A-RATE, and a setTargetAtTime curve NEVER
    // formally ends — accumulated never-ending curves measurably HALVED the
    // audio thread once (the applyDx7 dx7-morph incident, :~830). glide() is
    // the drop-in replacement for every setTargetAtTime aimed at a Faust
    // param: same exponential ease, but a setValueAtTime chaser at t+10τ
    // (-99.995% of the way there — audibly identical) formally TERMINATES the
    // automation, returning the param timeline to the no-automation fast
    // path. Contract: call cadence per param must exceed 10τ (all sites here
    // are per-bar, bars >= ~1.7s, worst τ 0.05 → chaser at 0.5s — clear).
    // Native AudioParams (GainNode/DelayNode/BiquadFilter) are cheap and NOT
    // the hazard: they keep raw setTargetAtTime everywhere.
    const glide = (p, v, t, tau) => {
      if (!p) return;
      const vv = Math.min(p.maxValue, Math.max(p.minValue, v));
      p.setTargetAtTime(vv, t, tau);
      p.setValueAtTime(vv, t + 10 * tau);
    };

    // ---- master graph: merger(6ch) -> fx_bus -> [fxDirect | master_mb] ->
    // master mute -> analyser -> out (master sits BEFORE the analyser so
    // handle.rms() reflects the stop mute). fxDirect is the unity path; the
    // OPT-IN multiband glue (fx wings stage 4, state.masterComp — disco) is a
    // parallel branch crossfaded in by ensureMasterMb below. It is NOT baked
    // into fx_bus: the always-on mband branch cost every genre ~0.01 live load
    // ratio even at drive 0 (both Faust select paths compute).
    const fx = await mkNode("fx_bus", "fx");
    const merger = ctx.createChannelMerger(6);
    merger.connect(fx);
    const master = ctx.createGain(); master.gain.value = 1;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    const fxDirect = ctx.createGain(); fxDirect.gain.value = 1;
    fx.connect(fxDirect); fxDirect.connect(master);
    // master sits BEFORE the analyser (so rms() reflects the stop mute), and the
    // analyser's terminal is the ONE audible output: the media-element stream
    // when available (survives screen lock), else ctx.destination (classic).
    master.connect(analyser);
    if (msDest) analyser.connect(msDest); else analyser.connect(ctx.destination);

    // ---- OUTPUT-TRUTH INSTRUMENTS, part 2: click sentinel + render capacity
    // (Stage 0.B — OPT-IN via opts.debugSentinel, default OFF; when off, NONE
    // of these nodes/listeners exist and the audio path is byte-identical).
    // The sentinel is a hand-written non-Faust AudioWorkletProcessor SINK
    // tapped off `master` (post-mute, pre-terminal): per 1s window it counts
    // sample discontinuities (clicks), >=128-sample exact-zero runs inside
    // loud program (dropout gaps), and running peak — ON the audio thread,
    // where the render actually happens. renderCapacity is Chrome's own
    // audio-thread load/underrun meter: the in-graph analyser is BLIND to
    // underruns (a starved callback never reaches it), this isn't. Together
    // with the always-on journal they let the soak ATTRIBUTE every transient
    // glitch to its mechanism instead of guessing from symptoms.
    let sentinelState = null, capState = null;
    if (opts.debugSentinel) {
      try {
        await ctx.audioWorklet.addModule(BASE + "sentinel-processor.js");
        const sn = new AudioWorkletNode(ctx, "glitch-sentinel", { numberOfInputs: 1, numberOfOutputs: 0 });
        master.connect(sn);   // pure sink: connects to nothing downstream
        sentinelState = { latest: null, total: { clicks: 0, gaps: 0, peak: 0, windows: 0 } };
        sn.port.onmessage = (e) => {
          const d = e.data; d.ctxTime = ctx.currentTime;   // window END on the shared clock (journal correlation)
          sentinelState.latest = d;
          const T = sentinelState.total;
          T.clicks += d.clicks; T.gaps += d.gaps; T.windows++;
          if (d.peak > T.peak) T.peak = d.peak;
          // per-window stream for harnesses (lossless — polling at 1s races the 1s reports)
          if (opts.onSentinel) try { opts.onSentinel(d, capState && capState.latest); } catch (err) {}
        };
      } catch (e) { errors.push("sentinel: " + (e && e.message || e)); }
      if (ctx.renderCapacity && typeof ctx.renderCapacity.addEventListener === "function") {
        capState = { api: "renderCapacity", latest: null, total: { underrunSum: 0, underrunEvents: 0, peakLoad: 0, avgLoad: 0, events: 0 } };
        try {
          ctx.renderCapacity.addEventListener("update", (e) => {
            const d = { timestamp: e.timestamp, averageLoad: e.averageLoad, peakLoad: e.peakLoad, underrunRatio: e.underrunRatio };
            capState.latest = d;
            const T = capState.total;
            T.underrunSum += d.underrunRatio;             // ANY underrun ever => sum > 0 (the gate)
            if (d.underrunRatio > 0) T.underrunEvents++;
            if (d.peakLoad > T.peakLoad) T.peakLoad = d.peakLoad;
            T.avgLoad = T.events ? T.avgLoad * 0.9 + d.averageLoad * 0.1 : d.averageLoad;   // EMA
            T.events++;
          });
          ctx.renderCapacity.start({ updateInterval: 1 });
        } catch (e) { errors.push("renderCapacity: " + (e && e.message || e)); }
      } else if (ctx.playbackStats) {
        // AudioRenderCapacity never shipped in current Chrome (147 has no
        // ctx.renderCapacity, flag or not) — its successor is the Playout
        // Stats API: ctx.playbackStats.{underrunDuration,underrunEvents,
        // totalDuration} as monotonic counters. Sample them at 1s and diff
        // into the SAME shape renderCapacity would have fed (underrunRatio =
        // underrun seconds / rendered seconds per window), so callers and the
        // soak gate are API-agnostic. No load numbers here — averageLoad/
        // peakLoad stay null and readers must treat them as absent.
        capState = { api: "playbackStats", latest: null, total: { underrunSum: 0, underrunEvents: 0, peakLoad: 0, avgLoad: 0, events: 0 } };
        let lastUD = ctx.playbackStats.underrunDuration, lastUE = ctx.playbackStats.underrunEvents, lastTD = ctx.playbackStats.totalDuration;
        capState.timer = setInterval(() => {
          try {
            const ps = ctx.playbackStats; if (!ps) return;
            const dUD = ps.underrunDuration - lastUD, dUE = ps.underrunEvents - lastUE, dTD = ps.totalDuration - lastTD;
            lastUD = ps.underrunDuration; lastUE = ps.underrunEvents; lastTD = ps.totalDuration;
            const d = { timestamp: ctx.currentTime, averageLoad: null, peakLoad: null,
              underrunRatio: dTD > 0 ? dUD / dTD : 0, underrunEvents: dUE };
            capState.latest = d;
            const T = capState.total;
            T.underrunSum += d.underrunRatio;
            T.underrunEvents += dUE;
            T.events++;
          } catch (e) {}
        }, 1000);
      }
    }
    let mbNode = null, mbGain = null;
    // shared crossfade teardown: after the fade-out completes, detach a
    // retired node from its upstream `src` (the source differs per caller — fx
    // for the master glue, revMerge for the reverb color) and disconnect it +
    // its gain — AND destroy() it. A bare disconnect leaves the faustwasm
    // worklet computing every block forever (the retirePool physics below,
    // :624-629) — every reverb-color swap during travel was leaking one of the
    // most expensive nodes in the fleet, invisible to countWorklets(). 700ms =
    // 14τ of the 0.05 crossfade (−120dB), so the destroy is inaudible.
    // try/catch: a node may already be gone on rapid re-swaps. destroyNode
    // sits OUTSIDE that try so a disconnect throw can never skip the destroy —
    // the zombie registry must witness every death.
    const retire = (src, node, gain) =>
      setTimeout(() => { try { src.disconnect(node); node.disconnect(); gain.disconnect(); } catch (e) {} destroyNode(node); }, 700);
    async function ensureMasterMb(state) {
      const mb = SE.masterMb(state);
      if (mb && !mbNode) {
        jlog("mbToggle", "on:" + mb.module);
        const node = await mkNode(mb.module, "mastermb");
        const g = ctx.createGain(); g.gain.value = 0;
        fx.connect(node); node.connect(g); g.connect(master);
        const p = P(node, "mbdrive"); if (p) p.value = mb.mbdrive;
        const t = ctx.currentTime;   // equal-sum crossfade: both paths carry the same program
        g.gain.setTargetAtTime(1, t, 0.05);
        fxDirect.gain.setTargetAtTime(0, t, 0.05);
        mbNode = node; mbGain = g;
      } else if (mb && mbNode) {
        glide(P(mbNode, "mbdrive"), mb.mbdrive, ctx.currentTime, 0.05);   // Faust param: terminated glide (1.2)
      } else if (!mb && mbNode) {
        jlog("mbToggle", "off");
        const old = mbNode, oldGain = mbGain;
        mbNode = null; mbGain = null;
        const t = ctx.currentTime;
        fxDirect.gain.setTargetAtTime(1, t, 0.05);
        oldGain.gain.setTargetAtTime(0, t, 0.05);
        retire(fx, old, oldGain);
      }
    }
    const dryBus = ctx.createGain(), revBus = ctx.createGain(), delBus = ctx.createGain(), ppBus = ctx.createGain();
    // dry path is STEREO-capable: a splitter feeds dryBus channel 0 -> merger L
    // and channel 1 -> merger R. Mono voices up-mix to L=R (centered, unchanged);
    // STEREO voices (juno60/hammond/vp330, 2-channel nodes) keep their width all
    // the way to the fx_bus L/R inputs. rev/del/pp sends stay mono.
    // CRITICAL: dryBus must be pinned to 2 channels. With the default "max"
    // mode, a genre with only mono voices computes a 1-channel dryBus, and a
    // ChannelSplitter upmixes DISCRETELY — channel 1 is padded with silence,
    // hard-panning the entire dry mix (bass included) LEFT. Explicit 2ch makes
    // the GainNode upmix mono inputs speakers-style (L=R) before the split.
    dryBus.channelCount = 2; dryBus.channelCountMode = "explicit";
    const drySplit = ctx.createChannelSplitter(2);
    dryBus.connect(drySplit);
    drySplit.connect(merger, 0, 0); drySplit.connect(merger, 1, 1);
    revBus.connect(merger, 0, 2); delBus.connect(merger, 0, 3); ppBus.connect(merger, 0, 4);

    // ---- reverb COLOR (fx wings round): an EXTERNAL reverb node replaces the
    // fx_bus internal zita for genres that select one (state.reverbColor). At
    // most ONE extra reverb node is instantiated at a time (per the load
    // budget) — a section/genre change crossfades to the new color. The node is
    // fed the (mono) reverb-send bus via a 2-ch merger and its stereo wet folds
    // back into dryBus so it rides the master chain (fxParams mutes the internal
    // rgain to 0 whenever a color is active). Genres with no reverbColor never
    // build a node — the internal zita path is untouched (byte-identical).
    const revMerge = ctx.createChannelMerger(2);
    revBus.connect(revMerge, 0, 0); revBus.connect(revMerge, 0, 1);
    let revColorNode = null, revColorGain = null, revColorName = null;
    async function ensureReverbColor(state) {
      const rc = SE.reverbColor(state);
      const want = rc ? rc.module : null;
      if (want === revColorName) {   // same color: glide params only (Faust params: terminated glides, 1.2)
        if (revColorNode && rc) {
          const t = ctx.currentTime;
          glide(P(revColorNode, "rgain"), rc.rgain, t, 0.05);
          glide(P(revColorNode, "rtone"), rc.rtone, t, 0.05);
        }
        return;
      }
      const old = revColorNode, oldGain = revColorGain;
      jlog("colorSwap", (revColorName || "zita") + ">" + (want || "zita"));
      revColorName = want;
      if (!want) { revColorNode = null; revColorGain = null; }
      else {
        const node = await mkNode(want, "revcolor");
        const g = ctx.createGain(); g.gain.value = 0;
        revMerge.connect(node); node.connect(g); g.connect(dryBus);
        const rg = P(node, "rgain"), rt = P(node, "rtone");
        if (rg) rg.value = Math.min(rg.maxValue, rc.rgain);
        if (rt) rt.value = rc.rtone;
        g.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
        revColorNode = node; revColorGain = g;
      }
      if (old) {   // crossfade the previous color out, then retire it
        oldGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        retire(revMerge, old, oldGain);
      }
    }

    // ---- DELAY/PP BLEED tap-out (reverb-color round) ----
    // fx_bus feeds its INTERNAL zita `rin = rev + d*0.2 + (ppl+ppr)*0.12`, but
    // that zita is muted (rgain->0) for genres that select a reverbColor — so
    // without this, colored genres lose the echo-tail-into-reverb glue uncolored
    // genres keep. We recompute that bleed and fold it into the COLOR node's
    // input (revMerge), symmetric with press (dsp/rev_bleed.dsp is the offline
    // twin). Built with NATIVE nodes only — the one-extra-node worklet budget is
    // the reverb-color node itself; a native feedback delay + cross-fed pingpong
    // add no worklet. Built lazily the first time a color is active; its wet is
    // muted to 0 whenever no color is active (so a session that never touches a
    // colored genre never builds it, and toggling back to zita silences it).
    // (1-pole fi.lowpass in fx_bus vs a 2-pole biquad here is a minor bleed-tone
    // divergence — live is never bit-identical to press; the glue is the point.)
    let bleed = null;
    function ensureBleedGraph() {
      if (bleed) return bleed;
      // feedback delay (fx_bus fbdel): y = lowpass(delay(delBus + dfb*y)); d = y*dgain
      const dSum = ctx.createGain(), dDelay = ctx.createDelay(3.0),
            dLp = ctx.createBiquadFilter(), dFb = ctx.createGain(), dWet = ctx.createGain();
      dLp.type = "lowpass"; dFb.gain.value = 0; dWet.gain.value = 0;
      delBus.connect(dSum); dSum.connect(dDelay); dDelay.connect(dLp);
      dLp.connect(dFb); dFb.connect(dSum);                       // ~ *(dfb)
      dLp.connect(dWet); dWet.connect(revMerge, 0, 0); dWet.connect(revMerge, 0, 1); // d*0.2*dgain
      // cross-fed pingpong (fx_bus instr 95): pl=lp(delay(pp + ppfb*pr)), pr=lp(delay(ppfb*pl))
      const pSumL = ctx.createGain(), pDelL = ctx.createDelay(3.0), pLpL = ctx.createBiquadFilter(),
            pSumR = ctx.createGain(), pDelR = ctx.createDelay(3.0), pLpR = ctx.createBiquadFilter(),
            pFbL = ctx.createGain(), pFbR = ctx.createGain(), pWet = ctx.createGain();
      pLpL.type = pLpR.type = "lowpass"; pFbL.gain.value = pFbR.gain.value = 0; pWet.gain.value = 0;
      ppBus.connect(pSumL); pSumL.connect(pDelL); pDelL.connect(pLpL);   // pl
      pLpR.connect(pFbL); pFbL.connect(pSumL);                            // + pr*ppfb -> pl
      pLpL.connect(pFbR); pFbR.connect(pSumR); pSumR.connect(pDelR); pDelR.connect(pLpR); // pr = delay(pl*ppfb)
      pLpL.connect(pWet); pLpR.connect(pWet); pWet.connect(revMerge, 0, 0); pWet.connect(revMerge, 0, 1); // (ppl+ppr)*0.12
      bleed = { dDelay, dLp, dFb, dWet, pDelL, pLpL, pDelR, pLpR, pFbL, pFbR, pWet };
      return bleed;
    }
    function applyBleedParams(fxp, active, when) {
      if (!bleed && !active) return;   // never built + no color => nothing to do (uncolored untouched)
      ensureBleedGraph();
      const t = Math.max(when || 0, ctx.currentTime), set = (p, v) => p.setTargetAtTime(Math.max(0, v), t, 0.02);
      set(bleed.dDelay.delayTime, fxp.dtime); set(bleed.dLp.frequency, fxp.dcut);
      set(bleed.dFb.gain, active ? fxp.dfb : 0); set(bleed.dWet.gain, active ? fxp.dgain * 0.2 : 0);
      set(bleed.pDelL.delayTime, fxp.pptime); set(bleed.pDelR.delayTime, fxp.pptime);
      set(bleed.pLpL.frequency, fxp.pptone); set(bleed.pLpR.frequency, fxp.pptone);
      set(bleed.pFbL.gain, active ? fxp.ppfb : 0); set(bleed.pFbR.gain, active ? fxp.ppfb : 0);
      set(bleed.pWet.gain, active ? 0.12 : 0);
    }

    // ---- MIXER LAYER TAPS ----
    // Every logical layer owns four collector gains (dry/rev/del/pp) sitting
    // between the per-unit send gains and the master buses, plus a small
    // analyser fed by dry+rev for a ~10Hz meter. Layer gain/mute/solo scale
    // these collectors — a monitoring/override bus that never touches kernel
    // state. lastBar tracks scheduling for the "not playing vs quiet" answer.
    const LAYER_DEFS = [
      ["pad", "pads"], ["bass", "bass"], ["lead", "lead"],
      ["kick", "kick"], ["snare", "snare"], ["hats", "hats/toms"],
      ["fx", "stabs/sfx"], ["beds", "found bed"], ["chops", "found chops"], ["vox", "hits/vox"],
    ];
    const layers = new Map();
    for (const [id, label] of LAYER_DEFS) {
      const mk = (bus) => { const g = ctx.createGain(); g.connect(bus); return g; };
      const L = { id, label, gainVal: 1, muted: false, solo: false, lastBar: -99,
        dry: mk(dryBus), rev: mk(revBus), del: mk(delBus), pp: mk(ppBus),
        an: ctx.createAnalyser() };
      L.an.fftSize = 512; L.buf = new Float32Array(512);
      L.dry.connect(L.an); L.rev.connect(L.an);   // meter = dry+rev presence
      layers.set(id, L);
    }
    const LAYER_OF_UNIT = (key) =>
      key === "pad" ? "pad" : key === "bass" ? "bass"
      : key === "melody" || key.slice(0, 5) === "solo:" ? "lead"
      : key === "kick" ? "kick" : key === "snare" ? "snare"
      : key === "hat" || key === "tom" ? "hats"
      : key === "stab" || key === "sfx" ? "fx" : "fx";
    function applyLayerGains() {
      const anySolo = [...layers.values()].some((l) => l.solo);
      const t = ctx.currentTime;
      for (const L of layers.values()) {
        const eff = (L.muted || (anySolo && !L.solo)) ? 0 : L.gainVal;
        for (const g of [L.dry, L.rev, L.del, L.pp]) g.gain.setTargetAtTime(eff, t, 0.01);
      }
    }
    const layerDests = (id) => { const L = layers.get(id); return { dry: L.dry, rev: L.rev, del: L.del, pp: L.pp }; };
    const foundBeds = FP.FoundLive(ctx, layerDests("beds"));
    const foundChops = FP.FoundLive(ctx, layerDests("chops"));
    const foundVox = FP.FoundLive(ctx, layerDests("vox"));
    const VOXISH = /^(sp_|vx_|vox_|tw_)/;
    // SAMPLER voice model (faust/sampler.js): per-unit players into the
    // unit's mixer layer; zone buffers decode RAW (no lead-in trim/boost)
    const samplerPlayers = new Map();
    const samplerOf = (key) => {
      if (!SP) return null;
      if (!samplerPlayers.has(key)) samplerPlayers.set(key, SP.SamplerLive(ctx, layerDests(LAYER_OF_UNIT(key))));
      return samplerPlayers.get(key);
    };
    const samplerBufs = {};   // srcId -> AudioBuffer | null (decoded once)
    async function ensureSamplerBufs(u, st) {
      for (const z of (u.sampler.zones || [])) {
        if (samplerBufs[z.srcId] !== undefined) continue;
        const src = (st.foundSources || []).find(s => s.id === z.srcId);
        const url = src && (src.url || (src.samplePath ? new URL(src.samplePath, SITE).href : null));
        try { samplerBufs[z.srcId] = url && SP ? await SP.decodeUrlRaw(ctx, url) : null; }
        catch (e) { samplerBufs[z.srcId] = null; console.warn("sampler decode failed:", url, e); }
      }
    }

    const fxCache = {};
    function applyFx(state, when) {
      const fxp = SE.fxParams(state);
      if (eco.level) { fxp.crackle = 0; }
      if (eco.level >= 3) {  // eco 3: thin the FX themselves (feedback tails are the load)
        fxp.dfb = Math.min(fxp.dfb, 0.25);
        fxp.ppfb = Math.min(fxp.ppfb, 0.25);
        fxp.rtone = 900;     // duller reverb return
      }
      for (const [k, v] of Object.entries(fxp)) {
        const vv = Math.round(v * 1e4) / 1e4;
        if (fxCache[k] === vv) continue;
        fxCache[k] = vv;
        const p = P(fx, k);
        if (!p) continue;
        const t = Math.max(when, ctx.currentTime);
        // journeys glide these every bar — a setValueAtTime STEP on a live
        // reverb/delay/tone param is an audible periodic click. Smooth over
        // ~20ms instead (delay-time jumps especially) — via glide(), so the
        // curve formally ENDS (fx_bus params are Faust a-rate, 1.2).
        glide(p, vv, t, 0.02);
      }
      // BLEED into the color node's input (eco-adjusted fxp shared, so eco-3's
      // thinner feedback tails carry through). Active only when a color is set.
      applyBleedParams(fxp, !!SE.reverbColor(state), when);
    }

    // ---- voice pools: unitKey -> {module, spec, nodes:[...], paramSig} ----
    const pools = new Map();
    let dx7Presets = null;
    let curBarSec = 2;   // seconds per 4-beat bar; injectChord updates from bpm
    const POOL_SIZE = { pad: 4, bass: 2, melody: 3, solo: 2 };
    // ---- POOL REAPER (2026-07-06, TRAVEL-SOAK crew) — the desktop-static-2 fix.
    // ensurePool never tore anything down for a key that stops recurring: a pool
    // is keyed by unit key, and the dynamic `solo:<recipe>` keys are UNIQUE per
    // genre. TRAVEL across N genres therefore leaves every visited genre's solo
    // voices connected FOREVER — and a Faust worklet renders every block even
    // when gated silent (the master_mb finding), so the audio thread's per-block
    // cost climbs monotonically with genres-visited. Past ~a dozen hops the
    // render budget runs out mid-block: constant-tempo clicks / underruns (NOT
    // the accelerating media-element drift of static #1, which was mobile-gated
    // in 7b6010f). The reaper tears down pools whose key the CURRENT genre no
    // longer wants once they've been idle REAP_BARS bars — gate off, then
    // disconnect + node.destroy() (the faustwasm worklet stops rendering, unlike
    // a bare disconnect). Current-genre keys are ALWAYS protected (passed in as
    // wantKeys), and ensurePool rebuilds a reaped voice byte-identically on
    // return. Bounded to REAP_MAX_PER_BAR teardowns per bar so a fresh-genre
    // arrival never tears many worklets down inside one render block (its own
    // click source); the gate-off is instant, the disconnect/destroy defers.
    const REAP_BARS = 16;         // idle bars before an off-genre pool is reaped
    const REAP_MAX_PER_BAR = 3;   // spread teardown across bars, never a mid-bar burst
    let reapCount = 0;            // stat surfaced on the handle (soak + CPU meter)
    // ---- HARD WORKLET CEILING + LRU HARVEST (Paul, watching the meter live:
    // "most music is playing with 2 or 3 worklets… set a max worklet count and
    // stick to it and harvest"; 2026-07-06: "A cap of 8 worklets makes sense").
    // The BUDGET counts the SAME population the meter shows — pool voices +
    // insert chains + fx/master/color infra — so Paul's ⬡ number and the
    // ceiling agree. Harvest order: (1) off-genre leftovers, LRU, not ringing;
    // (2) the current genre's own IDLE pools — unserved >= IDLE_EVICT_BARS
    // bars, every voice silent past its tail (covers mono mid-group + release
    // tails) — so the count returns to <=8 as the music thins, while drums /
    // pads that fire every bar are never touched (no rebuild thrash; an
    // evicted pool rebuilds byte-identically on its unit's next event, wasm
    // factory already cached). Infra is counted but never harvestable. If
    // everything left is protected, the PLAYING MUSIC WINS: the cap takes the
    // minimum necessary overage rather than silencing a groove — a full
    // genre's protected set (pad pool 4 + melody 3 + drums + fx_bus) runs
    // 12-17, dinosynth-class up to ~22 (the CPU-budget round's outliers).
    // Bounded teardowns per pass + stagger: never a burst in one render block.
    const MAX_WORKLETS = Math.max(4, opts.maxWorklets || 8);
    const IDLE_EVICT_BARS = 4;    // in-genre pools unserved this long are budget-evictable
    const HARVEST_MAX_PER_PASS = 3;
    let harvestCount = 0;         // stat: pools torn down by the budget (vs idle reaps)
    let curUnitKeys = new Set();  // the CURRENT bar's unit table keys (protected set)
    // ---- 2.3 COST-WEIGHTED AWAKE CEILING (Stage 2, ZERO-STATIC) ----
    // Node COUNT is the wrong unit of harm: a dx7_alg* voice costs ~6.4x a
    // pad_saw and ~16x an organ per rendered block (state-engine's MEASURED
    // per-module COST table, normalized pad_saw = 1.0 — the 2026-07-04
    // CPU-BUDGET round's offline-render timing probe). The cap-8 node budget
    // treats them as equals, which is exactly how Paul's miamibass repro got
    // to "9 awake / 15 resident / cap 8 / clicking": every one of miamibass's
    // ~10 unit keys is in curUnitKeys (protected — playing music wins, see the
    // ceiling comment above), so the CAP legitimately can't harvest anything,
    // and 9 simultaneously-COMPUTING voices (lead_pluck x5 at 1.3, sfx risers
    // at 2.43 each, fx_bus 2.32...) sank the audio thread anyway. What must be
    // bounded is the COST of what's awake, not the count of what's resident.
    // modCost reads SE.COST directly (one table, two engines — press's
    // trimToBudget and this ceiling must never disagree about what "heavy"
    // means); dx7_algN modules aren't in the table by name — state-engine
    // prices ANY dx7 unit at DX7_COST = 6.4 (not exported; measured 6.2-6.7),
    // mirrored here by prefix. Unknown modules take SE's own 0.6 fallback.
    const MOD_COST = (SE && SE.COST) || {};
    const modCost = (mod) => /^dx7_alg/.test(mod || "") ? 6.4
      : (MOD_COST[mod] != null ? MOD_COST[mod] : 0.6);
    // The ceiling: ~28 cost units awake at once (opts.costCeiling to tune).
    // Calibration: the heaviest normal genre's FULL always-on fleet priced out
    // ~38 in the pre-sleep world (state-engine BUDGET 40); with sleep/wake the
    // AWAKE set is the real cost and 28 leaves ~25% headroom under that old
    // worst case on the same machine. Enforcement is a PREFERENCE, never a
    // mute: when waking one more voice would cross the ceiling, the scheduler
    // STEALS an already-awake voice of the same pool (the declicked steal path
    // — the dip-and-retrigger that already covers dx7 note overlaps) instead
    // of waking another. Every note still plays; the polyphony of the heaviest
    // pools thins first, which is also the least audible place to thin.
    const COST_CEILING = Math.max(8, opts.costCeiling || 28);
    let costStealCount = 0;       // stat: notes redirected to an awake voice by the ceiling
    // what actually computes right now, in cost units: awake pool voices +
    // AWAKE insert chains (2.2: chains sleep with their pools) + the infra
    // that never sleeps (fx_bus always; reverb color + master_mb while built —
    // continuous audio flows through them). The 2.3 ceiling and the ⬡ meter
    // both read this.
    function awakeCost() {
      let c = modCost("fx_bus");
      if (mbNode) c += modCost("master_mb");
      if (revColorNode) c += modCost(revColorName);
      for (const [, p] of pools) {
        const mc = modCost(p.module);
        for (const v of p.nodes) if (!v.asleep) c += mc;
        const ch = p.ins && p.ins.chain;
        if (ch && !ch.asleep) for (const b of ch.built) c += modCost(b.eff && b.eff.module);
      }
      return c;
    }
    // the cost wake(pool, v) is about to ADD: the voice's module if asleep,
    // plus its whole insert chain if that's asleep too (a chain wakes with the
    // first voice of its pool — 2.2). The ceiling check charges both.
    function wakeCostOf(pool, v) {
      let c = v.asleep ? modCost(pool.module) : 0;
      const ch = pool.ins && pool.ins.chain;
      if (ch && ch.asleep) for (const b of ch.built) c += modCost(b.eff && b.eff.module);
      return c;
    }
    const countWorklets = () => {
      let n = 1;                                   // fx_bus (always on)
      if (mbNode) n++;                             // opt-in multiband master glue
      if (revColorNode) n++;                       // external reverb color
      for (const [, p] of pools) {
        n += p.nodes.length;
        if (p.ins && p.ins.chain) n += p.ins.chain.built.length;
      }
      return n;
    };
    function harvestForBudget(need) {
      if (opts.noReap) return;   // soak BEFORE leg: pre-fix behavior (no budget either)
      let over = countWorklets() + need - MAX_WORKLETS;
      if (over <= 0) return;
      const now = ctx.currentTime;
      const silent = (p) => !p.nodes.some(v => v.busyUntil >= now || v.tailUntil + 0.3 > now);
      const lruOf = (list) => list.sort((a, b) => (a[1].lastServed || 0) - (b[1].lastServed || 0));
      // tier 1: off-genre leftovers; tier 2: current genre's own idle pools
      const offGenre = lruOf([...pools.entries()].filter(([k, p]) => !curUnitKeys.has(k) && silent(p)));
      const inGenreIdle = lruOf([...pools.entries()].filter(([k, p]) =>
        curUnitKeys.has(k) && !p.stemmed && serial - (p.lastServed == null ? serial : p.lastServed) >= IDLE_EVICT_BARS && silent(p)));
      let i = 0;
      for (const [k, p] of [...offGenre, ...inGenreIdle]) {
        if (over <= 0 || i >= HARVEST_MAX_PER_PASS) break;
        pools.delete(k);
        jlog("harvest", k);
        retirePool(p, 1500 + i * 200);   // stagger: never a teardown burst in one block
        harvestCount++; i++;
        over -= p.nodes.length + (p.ins && p.ins.chain ? p.ins.chain.built.length : 0);
      }
    }
    // pool sizing, shared by ensurePool and prepare() (1.6 must stash exactly
    // the node count the arrival will ask for):
    function poolSizeFor(u) {
      let n = u.drum || u.hold ? (u.pool > 1 ? 2 : 1) : (POOL_SIZE[u.role] || u.pool || 2);
      // dx7.lib voices cost ~3-7x every other module (measured x3.5 realtime
      // offline vs x11-28 for supersaw/pad_saw/fm2op): cap dx7 pools at 2 —
      // three+ six-op FM nodes sink the audio thread, and the declick steal
      // path covers note overlaps.
      if (u.dx7) n = Math.min(n, 2);
      // heavy synth-fleet voices cost more per node than pad_saw/organ (juno60 +
      // vp330 = BBD chorus delay lines + moog filter; hammond = 9 tonewheels +
      // a 4-delay Leslie; solina/ppg = triple-tap ensemble / 12-frame table).
      // Cap their pad pools at 3 so a section swap doesn't instantiate 4 heavy
      // worklets at once (the instantiation spike dipped the load meter); the
      // declick voice-steal covers the rare 4th-note overlap, same as dx7.
      if (["juno60", "hammond", "vp330", "solina", "ppg"].includes(u.module)) n = Math.min(n, 3);
      // MONO-LEGATO voices (modeld/tb303/synclead: u.mono, pool:1): ONE instance,
      // ever — the pool:1 hint wins over the POOL_SIZE role table so all notes
      // route to that one voice and glide/legato work (see the mono pass below).
      if (u.mono) n = 1;
      // CPU-BUDGET shed (state-engine trimToBudget): a poolCap set on the unit is a
      // hard ceiling the deterministic guard chose (press honors it via u.pool math;
      // live caps here so both engines instantiate the same voice count).
      if (u.poolCap != null) n = Math.min(n, u.poolCap);
      return n;
    }
    async function ensurePool(key, u, wantN) {
      let pool = pools.get(key);
      // wantN overrides the role/dx7/mono pool table — used by ensureSkeletonPool
      // (Stage 3) to build a ONE-node fallback pool for a CACHED unit. The reuse
      // gate now also requires the resident pool to be at LEAST as big as asked:
      // a 1-node skeleton must REBUILD to full poly the instant a stems-unhealthy
      // bar reclassifies its unit LIVE (a woken-thin pad would otherwise persist).
      // wantN undefined => n === poolSizeFor(u) and a normally-built pool already
      // has exactly that many nodes, so the >= gate is a no-op: stems-off behavior
      // is byte-identical.
      const n = wantN != null ? wantN : poolSizeFor(u);
      if (pool && pool.module === u.module && pool.nodes.length >= n) { pool.lastServed = serial; await ensureInserts(key, pool, u); retune(pool, u); applyDx7(pool, u); return pool; }
      if (pool) { pools.delete(key); retirePool(pool); }
      // HARD CEILING: make room BEFORE instantiating (LRU harvest, see above).
      harvestForBudget(n);
      const nodes = [];
      for (let i = 0; i < n; i++) {
        const node = await mkNode(u.module, key + i);
        const out = ctx.createGain(); out.gain.value = 1; node.connect(out);
        const LY = layers.get(LAYER_OF_UNIT(key));   // this unit's mixer layer
        const dry = ctx.createGain(); dry.gain.value = u.dry != null ? u.dry : 1; out.connect(dry); dry.connect(LY.dry);
        const rev = ctx.createGain(); rev.gain.value = u.rev || 0; out.connect(rev); rev.connect(LY.rev);
        const del = ctx.createGain(); del.gain.value = u.del || 0; out.connect(del); del.connect(LY.del);
        const pp = ctx.createGain(); pp.gain.value = 0; out.connect(pp); pp.connect(LY.pp); // per-EVENT ping-pong send (snarePP)
        if (u.dx7 || u.dx7Preset || u.dx7Params) {
          let pre = null;
          if (u.dx7Params) pre = { params: u.dx7Params };   // state.dx7 contract: inline params
          else if (u.dx7Preset) {
            dx7Presets = dx7Presets || await (await fetch(BASE + "dx7-presets.json")).json();
            pre = dx7Presets[u.dx7Preset];
          }
          if (pre) for (const [sfx, v] of Object.entries(pre.params)) {
            const p = node.parameters.get(sfx.slice(0, 4) === "/DX7" ? sfx : "/DX7" + sfx); if (p) p.value = v;
          }
          // dx7.lib has no output gain — external GainNode holds it ~-15dB down
          out.gain.value = 0.18;
        }
        if (u.vocoder) await feedSpeech(node);
        // declick gain between voice and out: dipped for ~12ms when a note
        // STEALS a node whose previous release tail is still sounding (param
        // jumps on a ringing voice were an audible periodic click)
        const dk = ctx.createGain(); dk.gain.value = 1;
        node.disconnect(out); node.connect(dk); dk.connect(out);
        nodes.push({ node, out, dk, gains: { dry, rev, del, pp }, ppLast: 0, velLast: null, busyUntil: 0, tailUntil: 0 });
      }
      pool = { module: u.module, spec: u, nodes, paramSig: "", lastServed: serial,
        dx7Sig: u.dx7Params ? JSON.stringify(u.dx7Params) : "" };
      pools.set(key, pool);
      await ensureInserts(key, pool, u);
      retune(pool, u);
      return pool;
    }

    // ---- per-voice INSERT chains (state.instruments.<voice>.inserts) ----
    // Chain sits between the pool's voices and its layer tap / fx sends:
    //   voice out -> pre -> [insert nodes] -> tail -> post -> {dry,rev,del,pp}
    // Insert nodes exist ONLY when the state requests them (a pool with no
    // inserts keeps its original per-node send routing, zero extra nodes).
    // Type changes rebuild the chain under a ~20ms equal-power-ish crossfade
    // (old tail -> 0, new tail -> 1); param changes glide via setTargetAtTime;
    // bypass inside a module is mix 0, never a disconnect.
    async function ensureInserts(key, pool, u) {
      const list = u.inserts || [];
      const sig = list.map((i) => i.type).join(">");
      if (!pool.ins) {
        if (!sig) return;   // plain pool: path untouched (regression-identical)
        // convert routing once: abandon the per-node send gains, sum into pre
        const LY = layers.get(LAYER_OF_UNIT(key));
        const pre = ctx.createGain(), post = ctx.createGain();
        const gains = { dry: ctx.createGain(), rev: ctx.createGain(), del: ctx.createGain(), pp: ctx.createGain() };
        gains.dry.gain.value = u.dry != null ? u.dry : 1; gains.rev.gain.value = u.rev || 0;
        gains.del.gain.value = u.del || 0; gains.pp.gain.value = 0;
        post.connect(gains.dry); gains.dry.connect(LY.dry);
        post.connect(gains.rev); gains.rev.connect(LY.rev);
        post.connect(gains.del); gains.del.connect(LY.del);
        post.connect(gains.pp); gains.pp.connect(LY.pp);
        for (const v of pool.nodes) {
          try { v.out.disconnect(); } catch (e) {}
          v.out.connect(pre);
          v.gains = gains;   // retune + per-event pp now address the pool sends
        }
        pool.ins = { pre, post, gains, sig: null, paramSig: "", chain: null };
      }
      if (pool.ins.sig !== sig) {
        // (re)build chain — new path fades in while the old fades out
        jlog("insertRebuild", key + ":" + (sig || "none"));
        const built = [];
        for (const eff of list) built.push({ node: await mkNode(eff.module, key + ":" + eff.type), eff });
        const tail = ctx.createGain(); tail.gain.value = 0;
        let src = pool.ins.pre;
        for (const b of built) { src.connect(b.node); src = b.node; }
        src.connect(tail); tail.connect(pool.ins.post);
        setInsertParams(built, true);
        const t = ctx.currentTime, old = pool.ins.chain;
        tail.gain.setTargetAtTime(1, t, 0.02);
        if (old) {
          old.tail.gain.setTargetAtTime(0, t, 0.02);
          // destroy, not just disconnect — a bare disconnect leaves each old
          // chain worklet computing forever (retirePool physics, :624-629);
          // every insert type-change was leaking the whole outgoing chain.
          // Per-node try/catch: one bad disconnect must not skip the rest of
          // the chain's destroys (the registry would drift).
          setTimeout(() => { try { old.tail.disconnect(); } catch (e) {} for (const b of old.built) { try { b.node.disconnect(); } catch (e) {} destroyNode(b.node); } }, 400);
        }
        pool.ins.chain = { built, tail };
        pool.ins.sig = sig;
        pool.ins.paramSig = JSON.stringify(list) + "|" + curBarSec;
        return;
      }
      const psig = JSON.stringify(list) + "|" + curBarSec;
      if (pool.ins.paramSig !== psig) {
        pool.ins.paramSig = psig;
        // params changed under the same types: glide them (declicked)
        if (pool.ins.chain) {
          for (let i = 0; i < list.length; i++) {
            const b = pool.ins.chain.built[i];
            if (b) b.eff = list[i];
          }
          setInsertParams(pool.ins.chain.built, false);
        }
      }
    }
    function setInsertParams(built, initial) {
      const t = ctx.currentTime;
      for (const b of built) {
        for (const [k, v] of Object.entries(b.eff.params || {})) {
          const p = P(b.node, k); if (!p) continue;
          const vv = Math.min(p.maxValue, Math.max(p.minValue, v));
          if (initial) p.value = vv; else glide(p, vv, t, 0.02);   // Faust param: terminated glide (1.2)
        }
        if (b.eff.barSec) {   // tempo-synced sweep: engine owns barSec (bpm glides too)
          const p = P(b.node, "barSec");
          if (p) { const vv = Math.min(p.maxValue, Math.max(p.minValue, curBarSec));
            if (initial) p.value = vv; else glide(p, vv, t, 0.05); }   // Faust param: terminated glide (1.2)
        }
      }
    }
    function retune(pool, u, when) {
      const sig = JSON.stringify([u.params, u.dry, u.rev, u.del]);
      if (pool.paramSig === sig) return;
      pool.paramSig = sig; pool.spec = u;
      const t = Math.max(when || 0, ctx.currentTime);
      const DISCRETE = { voices: 1, wave: 1, type: 1 };   // step these; smooth the rest
      for (const v of pool.nodes) {
        for (const [k, val] of Object.entries(u.params || {})) {
          let vv = val;
          if (eco.level >= 1 && k === "voices") vv = Math.min(vv, eco.level >= 2 ? 2 : 3);
          const p = P(v.node, k);
          if (!p) continue;
          const clamped = Math.min(p.maxValue, Math.max(p.minValue, vv));
          // glide retunes hit SOUNDING voices every bar — smooth continuous
          // params (cutoff/level/…) or they zipper-click. Faust params, so
          // the smooth path is glide() — the curve must formally end (1.2).
          // KNOWN MINOR CLICK SOURCE (evaluated, deferred): stepping an ENUM param
          // (wave/type/voices) on a SOUNDING voice is a waveform discontinuity when a
          // glide crossing moves the value mid-ring. It can't be micro-ramped — these
          // are a-rate Faust selectors, not continuous levels. Deferring the step to
          // the voice's next gate-off (when it's silent) is NOT clean: mono-legato
          // voices hold the gate HIGH across bars (:1396), so there is no reliable
          // gate-off to hook — a genre morph over a held drone would strand the retune
          // and break the "the pool now sounds like genre X" contract. It fires rarely
          // (only when the value actually changes, sig-gated at :911), so the step
          // stays; the contract wins over the occasional tick.
          if (DISCRETE[k]) p.setValueAtTime(clamped, t);
          else glide(p, clamped, t, 0.01);
        }
        v.gains.dry.gain.setTargetAtTime(u.dry != null ? u.dry : 1, t, 0.01);
        v.gains.rev.gain.setTargetAtTime(u.rev || 0, t, 0.01);
        v.gains.del.gain.setTargetAtTime(u.del || 0, t, 0.01);
      }
    }
    // journeys morph state.dx7 params continuously (explorer glideStep lerps
    // the vector when both ends share an algorithm) — the pool is module-
    // stable across a same-algorithm morph, so retune's u.params sig ({} for
    // dx7 units) never fires. Re-apply the dx7 vector here, per BAR and only
    // when it actually moved. STEP-set (setValueAtTime), never setTargetAtTime:
    // Faust worklet params are a-rate, and a setTargetAtTime curve never ends —
    // ~432 forever-active exponential automations measurably HALVED the audio
    // thread (load 0.5). Steps are k-rate cheap (~144 sets ≈ 0.4ms) and the
    // glide upstream already eases per bar, so the steps are small.
    function applyDx7(pool, u, when) {
      if (!u.dx7Params) return;
      const sig = JSON.stringify(u.dx7Params);
      if (pool.dx7Sig === sig) return;
      pool.dx7Sig = sig;
      const t = Math.max(when || 0, ctx.currentTime);
      for (const v of pool.nodes)
        for (const [sfx, val] of Object.entries(u.dx7Params)) {
          const p = v.node.parameters.get(sfx.slice(0, 4) === "/DX7" ? sfx : "/DX7" + sfx);
          if (p) p.setValueAtTime(Math.min(p.maxValue, Math.max(p.minValue, val)), t);
        }
    }
    // 1.1 DECLICK RETIRE: a module-change retire used to cut a RINGING pool by
    // zeroing its Faust gates instantly — an amplitude discontinuity, i.e. the
    // R5 transition click. Now each voice's NATIVE out gain rides a 64-point
    // raised-cosine fade to zero over 30ms FIRST (native curve: cheap, formally
    // ends, not the a-rate hazard), and the gate cut lands at t+35ms, after
    // the fade has already silenced the voice. The unit curve is precomputed;
    // per voice it's scaled by the gain's CURRENT value (dx7 velocity lives on
    // v.out.gain — a fixed 1→0 curve would JUMP a 0.18 gain up first).
    const FADE_N = 64, FADE_COS = new Float32Array(FADE_N);
    for (let i = 0; i < FADE_N; i++) FADE_COS[i] = 0.5 * (1 + Math.cos(Math.PI * i / (FADE_N - 1)));
    function retirePool(pool, delayMs) {
      const d = delayMs || 1500;   // harvest staggers this so bursts never share a block
      jlog("retirePool", pool.module + "x" + pool.nodes.length + ":declick");
      const t = ctx.currentTime;
      for (const v of pool.nodes) {
        const g0 = v.out.gain.value;
        try {
          const curve = new Float32Array(FADE_N);
          for (let i = 0; i < FADE_N; i++) curve[i] = FADE_COS[i] * g0;
          v.out.gain.setValueCurveAtTime(curve, t, 0.03);
        } catch (e) {
          // a pending curve overlaps (rapid double-retire, or a velocity
          // setValueCurve still in flight): setValueCurveAtTime throws rather
          // than splice — fall back to a plain 30ms linear ramp.
          try {
            v.out.gain.cancelScheduledValues(t);
            v.out.gain.setValueAtTime(g0, t);
            v.out.gain.linearRampToValueAtTime(0, t + 0.03);
          } catch (e2) {}
        }
        const g = P(v.node, "gate");
        if (g) { g.cancelScheduledValues(0); g.setValueAtTime(0, t + 0.035); }   // AFTER the fade, not instantly
        // disconnect AND destroy after the tail: a bare disconnect leaves the
        // faustwasm worklet processing every block until GC (never, while the
        // pool object is referenced from a stale Map slot) — destroy() posts to
        // the processor so it returns false and truly stops rendering. This is
        // what makes the reaper actually reclaim audio-thread budget.
        // destroyNode outside the disconnect try/catch: a throw must never
        // skip the destroy (registry truth) — and destroyNode guards itself.
        setTimeout(() => { try { v.node.disconnect(); v.out.disconnect(); } catch (e) {} destroyNode(v.node); }, d);
      }
      if (pool.ins) setTimeout(() => {
        try { pool.ins.pre.disconnect(); pool.ins.post.disconnect(); } catch (e) {}
        if (pool.ins.chain) {
          try { pool.ins.chain.tail.disconnect(); } catch (e) {}
          for (const b of pool.ins.chain.built) { try { b.node.disconnect(); } catch (e) {} destroyNode(b.node); }
        }
        try { for (const g of Object.values(pool.ins.gains)) g.disconnect(); } catch (e) {}
      }, d);
    }
    // ---- VOICE SLEEP/WAKE (Paul: "most music is playing with 2 or 3 worklets").
    // A gated-silent Faust worklet still runs its full wasm compute every block
    // (the master_mb finding) — a heavy genre's 20+ pooled voices cost 20+
    // computes while only 2-3 are sounding. faustwasm's stop() flips fProcessing
    // and compute() returns immediately: the processor stays registered and
    // connected, and the worklet's param-apply loop still runs (retunes / dx7
    // morphs land while asleep); start() resumes via a port message (~1ms).
    // sleepIdleVoices runs at the same bar boundary as the reaper: any voice
    // whose tail has expired with nothing scheduled ahead (busyUntil past) goes
    // to sleep; wake(pool, v) fires at schedule time for every voice that
    // receives an event this bar — the earliest gate-on is >=30ms after
    // scheduling, orders of magnitude beyond the port latency. Vocoder pools
    // never sleep (their looped speech feed hums continuously); infra (fx_bus
    // / master_mb / reverb color) is never slept — continuous audio flows
    // through it. Insert chains USED to be classed as infra too; since 2.2
    // they sleep with their pool (see below) — no audio flows through a chain
    // whose whole pool is silent. AWAKE count = what actually computes; the
    // meter shows it.
    // wake takes the POOL as well as the voice since Stage 2.2: an insert
    // chain that slept with its pool must come back with the FIRST voice that
    // wakes — a woken voice singing into a stopped chain is silence (the chain
    // sits between the voice and its layer tap). Same timing guarantee as the
    // voice itself: wake() runs at SCHEDULE time and the earliest gate-on is
    // >=30ms out, orders of magnitude beyond faustwasm's start() port latency.
    // The chain check is independent of v.asleep — by the sleep invariant
    // (chains only sleep when EVERY voice is asleep) a sleeping chain implies
    // a sleeping voice, but the belt-and-braces read costs nothing.
    const wake = (pool, v) => {
      if (v.asleep) { try { if (v.node.start) v.node.start(); } catch (e) {} v.asleep = false; }
      const ch = pool && pool.ins && pool.ins.chain;
      if (ch && ch.asleep) {
        for (const b of ch.built) { try { if (b.node.start) b.node.start(); } catch (e) {} }
        ch.asleep = false;
        jlog("chainWake", pool.module + ":" + (pool.ins.sig || "?"));
      }
    };
    function sleepIdleVoices() {
      const now = ctx.currentTime;
      for (const [, p] of pools) {
        if (p.spec && p.spec.vocoder) continue;
        for (const v of p.nodes)
          if (!v.asleep && v.busyUntil < now && v.tailUntil + 0.3 < now) {
            try { if (v.node.stop) { v.node.stop(); v.asleep = true; } } catch (e) {}
          }
        // ---- 2.2 INSERT CHAINS SLEEP WITH THEIR POOLS ----
        // Chains were classed as never-sleeping infra, but unlike fx_bus no
        // audio flows through a chain whose ENTIRE pool is asleep — it was
        // pure zombie compute with a legitimate registration (a filtersweep
        // chain is 1.47 cost units doing nothing between solo phrases). Sleep
        // it once every voice is asleep AND every tail has been silent a full
        // second beyond the voice-sleep threshold (+1s vs +0.3s: the chain's
        // own delay/feedback trails — a phaser or sweep ringing out the tail
        // it was fed — must drain before compute stops, or the wake would
        // resume mid-ring). Params still land while stopped (the sleep/wake
        // physics: the param-apply loop runs, compute doesn't), so retunes /
        // insert param glides during the nap are not lost. wake() above
        // restarts the chain with the first waking voice; awakeCount()/
        // awakeCost() count only awake chains, so the ⬡ meter tells the truth.
        const ch = p.ins && p.ins.chain;
        if (ch && !ch.asleep && p.nodes.every(v => v.asleep && v.tailUntil + 1 < now)) {
          for (const b of ch.built) { try { if (b.node.stop) b.node.stop(); } catch (e) {} }
          ch.asleep = true;
          jlog("chainSleep", p.module + ":" + (p.ins.sig || "?"));
        }
      }
    }
    // ---- ZERO-STATIC Stage 3: SKELETON POOLS (the deadline ladder's rung 2) ----
    // When the stem worker is healthy a CACHED unit's audio comes from the worker
    // (scheduled as AudioBufferSourceNodes into its layer taps), so the live path
    // does NOT stand up its full voice pool. But we keep a ONE-node pool per
    // cached unit, built through the intact ensurePool path (routing / dx7 /
    // insert chain all wired) and immediately STOPPED — zero compute, invisible to
    // awakeCost/awakeCount, but real, counted worklets (workletTruth sees them).
    // If a bar's stems miss their deadline TWICE (or the worker dies), the ladder
    // wakes these skeletons and schedules that bar's cached events onto them: a
    // thinner (pool-of-1) but click-free rendering, with no instantiation spike
    // because the node already exists asleep. `pool.stemmed` marks it so the
    // idle-harvest never reclaims it out from under the fallback (it is "served"
    // every bar anyway, but the flag is belt-and-braces) and so injectChord knows
    // its events are the worker's to render.
    async function ensureSkeletonPool(key, u) {
      const pool = await ensurePool(key, u, 1);   // 1-node pool, full routing, through the airlock
      pool.stemmed = true;
      for (const v of pool.nodes)
        if (!v.asleep) { try { if (v.node.stop) { v.node.stop(); v.asleep = true; } } catch (e) {} }
      const ch = pool.ins && pool.ins.chain;   // 2.2 physics: the chain sleeps with its (only) voice
      if (ch && !ch.asleep) { for (const b of ch.built) { try { if (b.node.stop) b.node.stop(); } catch (e) {} } ch.asleep = true; }
      return pool;
    }
    // reap off-genre pools idle > REAP_BARS (curUnitKeys = the CURRENT state's
    // unit keys, protected wholesale — even a solo silent between sections).
    // Bounded per call; the rest are caught on subsequent bars (sawtooth).
    function reapStalePools() {
      let reaped = 0;
      for (const [key, pool] of pools) {
        if (curUnitKeys.has(key)) continue;                               // current genre: never reap
        if (serial - (pool.lastServed == null ? serial : pool.lastServed) <= REAP_BARS) continue;
        pools.delete(key);
        jlog("reap", key);
        retirePool(pool);
        reapCount++;
        if (++reaped >= REAP_MAX_PER_BAR) break;
      }
      return reaped;
    }
    // ---- 1.6 handle.prepare(state): pre-voice a TARGET genre ----
    // Given the state the glide is HEADING FOR (not the one playing), build
    // every worklet its arrival will need — through the airlock, one at a
    // time — WITHOUT scheduling events, retuning playing pools, or swapping
    // live infra. DELIBERATE DEVIATION from "just run ensurePool early":
    // ensurePool under a key the current genre still plays would retire the
    // SOUNDING pool bars before arrival (audible cut) and the very next bar
    // would rebuild the old module (double churn); ensureReverbColor/
    // ensureMasterMb with the target would likewise be swapped straight back
    // by the next bar's injectChord (which re-ensures with the CURRENT state
    // every bar). So prepare instantiates into the PREPARED STASH (module-
    // keyed, stopped, TTL'd — see above) and the real arrival's mkNode calls
    // ADOPT instead of instantiating: zero creations in the render window,
    // zero disturbance to what's playing. Keys with no conflicting pool get
    // stash nodes too (adoption wires them identically). Re-entrancy
    // coalesces: a second prepare while one is in flight replaces the pending
    // target and the in-flight loop picks up the latest.
    let _prepTarget = null, _prepBusy = false;
    async function prepare(target) {
      if (!target) return;
      _prepTarget = target;
      if (_prepBusy) return;
      _prepBusy = true;
      try {
        while (_prepTarget && !abort) {
          const st = _prepTarget; _prepTarget = null;
          let units;
          try { units = SE.voiceUnits(E, st); } catch (e) { continue; }
          jlog("prepare", st.genre || st.name || st.progression || "?");
          // per-module deficit: what the arrival will mkNode that no existing
          // pool already covers (a same-module pool under the same key is
          // reused by ensurePool — nothing to build for it).
          const need = new Map();
          const want = (mod, n) => need.set(mod, (need.get(mod) || 0) + n);
          for (const [key, u] of Object.entries(units)) {
            if (u.sampler) continue;   // native path: buffers, not worklets (prefetched below)
            const pool = pools.get(key);
            if (pool && pool.module === u.module) continue;
            want(u.module, poolSizeFor(u));
            for (const eff of (u.inserts || [])) want(eff.module, 1);   // the chain rebuilds too
          }
          try { const rc = SE.reverbColor(st); if (rc && rc.module !== revColorName) want(rc.module, 1); } catch (e) {}
          try { const mb = SE.masterMb(st); if (mb && !mbNode) want(mb.module, 1); } catch (e) {}
          for (const [mod, n] of need) {
            const have = (prepared.get(mod) || []).length;
            for (let i = have; i < n; i++) {
              if (abort || _prepTarget || preparedCount >= MAX_PREPARED) break;
              try { stashPrepared(mod, await mkNodeFresh(mod, "prep:" + mod)); } catch (e) {}
            }
            if (abort || _prepTarget) break;
          }
          // sampler zone buffers decode off the arrival path too (main-thread
          // decode, but it used to sit inside the bar's await chain)
          for (const [, u] of Object.entries(units)) {
            if (abort || _prepTarget) break;
            if (u.sampler) { try { await ensureSamplerBufs(u, st); } catch (e) {} }
          }
        }
      } finally { _prepBusy = false; }
    }

    // ================= ZERO-STATIC Stage 3: THE ROLLING STEM CACHE ==============
    // The final integration. A module Worker (faust/stem-worker.js) renders each
    // bar's CACHED units (SE.stemClass — the heavy synthesis: dx7 family,
    // supersaw/heavy-fleet pads + their insert chains) OFFLINE, off the audio
    // thread, byte-for-byte as press would (stem-parity-test gates it). Here we
    //   (1) drive the worker's ONE-BAR-LATENCY pipeline — post bar N, it ships the
    //       window it held from N-1 (the first post ships nothing);
    //   (2) schedule the returned per-LAYER x per-BUS stems as AudioBufferSource
    //       nodes into the EXISTING layer collector gains, so mixer faders / M-S /
    //       RMS / applyFx / sidechain / reverb-color all stay live and truthful;
    //   (3) run the deadline-miss ladder (ZERO-STATIC §4, in order): VAMP the
    //       previous bar (repetition, never noise) -> asleep skeleton-pool
    //       fallback -> worker skip-and-reset at a section boundary.
    // EVERYTHING here is opt-in (opts.stems) and can NEVER break playback: any
    // failure sets stem=null / marks the worker dead and injectChord reverts to
    // the pure-live path (cached units get full pools again).
    const STEM_SR = 44100, STEM_BS = 64;
    async function initStems(opts) {
      let worker = null, ready = false, dead = false, resolveReady = null;
      const pending = new Map();       // serial -> bar record (t0 / window / cached events / status)
      let lastGood = null;             // { stems:[{layer,bus,channels}], sources:[{src,gain}] } — for VAMP reuse
      let repeatFlag = null;           // set by a VAMP; onBar drains it via takeRepeatFlag (video/UI hold)
      let consecutiveMisses = 0, resyncArmed = false;
      const failedMods = new Set();    // modules the worker can't load (missing dist wasm) -> class LIVE
      // stats surfaced on the handle (⬡ tooltip + soak): throughput headroom in
      // x-realtime, worker queue depth, and the ladder-rung counters.
      let headroomEMA = 0, lastRenderMs = 0, lastQueued = 0;
      let missCount = 0, vampCount = 0, fallbackCount = 0, resetCount = 0;

      // ---- schedule one bar's stems (or a vamp's reused buffers) into the layer
      // taps at absolute audio time `when`. Each source rides a unity GainNode so a
      // VAMP can equal-power-seam it against the outgoing bar. seam>0 fades the new
      // sources IN over `seam` seconds (the vamp side of the crossfade).
      function scheduleStems(rec, stems, when, seam) {
        const t = Math.max(ctx.currentTime + 0.02, when);
        const srcs = [];
        for (const st of stems) {
          const L = layers.get(st.layer); if (!L) continue;
          const dest = st.bus === "dry" ? L.dry : st.bus === "rev" ? L.rev : st.bus === "del" ? L.del : st.bus === "pp" ? L.pp : null;
          if (!dest) continue;
          const ch = st.channels; if (!ch || !ch.length || !ch[0] || !ch[0].length) continue;
          let buf;
          try {
            buf = ctx.createBuffer(ch.length, ch[0].length, STEM_SR);
            for (let c = 0; c < ch.length; c++) buf.copyToChannel(ch[c], c);
          } catch (e) { continue; }
          const src = ctx.createBufferSource(); src.buffer = buf;
          const g = ctx.createGain();
          src.connect(g); g.connect(dest);
          if (seam > 0) { const s0 = Math.max(ctx.currentTime, t - seam * 0.5);
            g.gain.setValueAtTime(0, s0); g.gain.linearRampToValueAtTime(1, s0 + seam); }
          try { src.start(t); src.stop(t + buf.length / STEM_SR + (seam || 0)); } catch (e) { continue; }
          src.onended = () => { try { g.disconnect(); } catch (e) {} };   // release the per-bar gain once its bar has played (no pending-node pileup)
          srcs.push({ src, gain: g });
          L.lastBar = serial;   // mixer "active" indicator stays truthful for cached layers
        }
        return srcs;
      }

      // ---- RUNG 1 VAMP: re-play the previous bar's stems at the missed bar's t0
      // with a 50ms equal-power seam (fade the outgoing sources down, the vamp up).
      // The content is a repeat of already-heard audio, so it can only ever sound
      // like a held bar — never static. Zero noise by construction.
      function vampInto(rec) {
        if (!lastGood) return false;
        const when = Math.max(ctx.currentTime + 0.02, rec.t0), seam = 0.05;
        const tf = Math.max(ctx.currentTime, when - seam * 0.5);
        for (const s of lastGood.sources) {
          try { s.gain.gain.setValueAtTime(s.gain.gain.value, tf); s.gain.gain.linearRampToValueAtTime(0, tf + seam); } catch (e) {}
        }
        const srcs = scheduleStems(rec, lastGood.stems, when, seam);
        lastGood = { stems: lastGood.stems, sources: srcs };   // chain further vamps off this repeat
        return true;
      }

      // ---- RUNG 2 FALLBACK: schedule the missed bar's CACHED events onto the
      // pre-warmed asleep SKELETON pools (thinner poly, click-free — no
      // instantiation spike, the nodes already exist stopped). This mirrors the
      // injectChord note path in miniature: wake, set params ~6ms early, gate
      // on/off. Cached units are never mono/sampler/dx7-velocity-critical in a way
      // the skeleton can't voice (stemClass keeps mono LIVE), so voice 0 suffices.
      function schedCachedOnSkeletons(rec) {
        const now = ctx.currentTime;
        const at = (b) => Math.max(now + 0.03, rec.t0 + (b - rec.lo) * rec.spb);
        for (const e of rec.cachedEvents) {
          const pool = pools.get(e.unit); if (!pool || !pool.nodes.length) continue;
          const tOn = at(e.beat);
          let v = pool.nodes.find(x => x.busyUntil <= tOn) || pool.nodes[0];
          wake(pool, v);
          const tset = Math.max(now, tOn - 0.006);
          for (const [k, val] of Object.entries(e.sets)) {
            const p = P(v.node, k);
            if (p) p.setValueAtTime(Math.min(p.maxValue, Math.max(p.minValue, val)), tset);
          }
          if (pool.spec.extGainPerAmp) {   // dx7 external-gain velocity (see injectChord applyNoteParams)
            const target = Math.min(1, pool.spec.extGainPerAmp * (e.amp || 0.1)), og = v.out.gain;
            try { og.setValueAtTime(v.velLast != null ? v.velLast : og.value, tset); og.linearRampToValueAtTime(target, tset + 0.005); } catch (er) {}
            v.velLast = target;
          }
          const durSec = e.durB * rec.spb;
          const tOff = e.hold ? tOn + durSec : e.drum ? tOn + 0.012 : tOn + Math.max(0.012, durSec) - 0.008;
          const g = P(v.node, "gate");
          if (g) { g.setValueAtTime(1, tOn); g.setValueAtTime(0, tOff); }
          v.busyUntil = tOff;
          v.tailUntil = tOff + (pool.spec.tail != null ? pool.spec.tail : 1);
          layers.get(LAYER_OF_UNIT(e.unit)).lastBar = serial;
        }
      }

      // ---- receive a shipped window and place it (or record a worker failure) ----
      function handleWorkerMsg(e) {
        const d = e.data; if (!d || !d.type) return;
        if (d.type === "ready") { ready = true; if (resolveReady) resolveReady(true); return; }
        if (d.type === "initfail") { dead = true; jlog("stemInitFail", d.error); if (resolveReady) resolveReady(false); return; }
        if (d.type === "pong") return;
        if (d.type === "resetdone") { resetCount++; jlog("stemResetDone", "from" + d.fromSerial); return; }
        if (d.type === "pending") return;   // the first bar of the pipeline: nothing held yet
        if (d.type === "skipped") { const r = pending.get(d.serial); if (r) r.resolved = true; return; }
        if (d.type === "barfail") { jlog("stemBarfail", d.serial + ":" + d.error); const r = pending.get(d.serial); if (r) r.resolved = true; return; }
        if (d.type === "bar") {
          lastRenderMs = d.renderMs; lastQueued = d.queued || 0;
          if (d.failedModules && d.failedModules.length)
            for (const fm of d.failedModules) { failedMods.add(fm.module); jlog("stemFailMod", fm.key + ":" + fm.module); }
          const r = pending.get(d.serial);
          if (!r || r.resolved || r.missed) return;   // gc'd, or already vamped/fallen-back for this serial
          r.arrived = true; r.resolved = true;
          const srcs = scheduleStems(r, d.stems, r.t0, 0);
          lastGood = { stems: d.stems, sources: srcs };
          consecutiveMisses = 0;
          // throughput headroom in x-realtime (bar audio seconds / render seconds)
          const barSec = r.lenSamples / STEM_SR, rt = d.renderMs > 0 ? barSec / (d.renderMs / 1000) : 0;
          headroomEMA = headroomEMA ? headroomEMA * 0.8 + rt * 0.2 : rt;
        }
      }

      // ---- the deadline watchdog (ZERO-STATIC §4): a bar's stems must land by
      // t0 - 1.0s. Runs at 100ms — far finer than the 1s margin. Anything past
      // deadline unresolved rides the ladder; resolved records are GC'd once their
      // audio is safely in the past.
      const dlTimer = setInterval(() => {
        if (abort) return;
        const now = ctx.currentTime;
        let behind = 0;
        for (const [s, r] of pending) {
          if (r.resolved) { if (now > r.t0 + 2) pending.delete(s); continue; }
          if (!r.arrived && !r.missed && now < r.t0 - 1.0) behind++;   // still in flight, deadline not yet reached
          if (now >= r.t0 - 1.0) {
            r.missed = true; r.resolved = true; missCount++; consecutiveMisses++;
            if (!dead && consecutiveMisses < 2 && lastGood) {
              vampInto(r); repeatFlag = "vamp"; vampCount++;
              jlog("stemVamp", s + "@miss" + consecutiveMisses);
            } else {
              schedCachedOnSkeletons(r); fallbackCount++;
              jlog("stemFallback", s + (dead ? ":dead" : ":miss" + consecutiveMisses));
            }
          }
        }
        // RE-SYNC: worker alive but >1 bar behind -> arm a cold skip-and-reset for
        // the next section boundary (fresh attacks mask it; onSection fires it).
        if (!dead && behind > 1) resyncArmed = true;
      }, 100);

      // ---- build + init the worker; on ANY failure, stems stay OFF (stem=null) ----
      try {
        worker = new Worker(BASE + "stem-worker.js", { type: "module" });
        worker.onmessage = handleWorkerMsg;
        worker.onerror = (ev) => { dead = true; jlog("stemWorkerError", (ev && ev.message) || "error"); if (resolveReady) resolveReady(false); };
        const readyP = new Promise((res) => { resolveReady = res; });
        worker.postMessage({ type: "init" });
        const ok = await Promise.race([readyP, new Promise((r) => setTimeout(() => r(false), 12000))]);
        if (!ok || dead) throw new Error("stem worker init failed/timeout");
        jlog("stemInit", "ready");
        status("stems armed (worker ready)");
      } catch (err) {
        clearInterval(dlTimer);
        try { if (worker) worker.terminate(); } catch (e) {}
        stem = null;
        jlog("stemInitFail", String(err && err.message || err));
        status("stems off — worker unavailable (pure live)");
        return;
      }

      // the handle injectChord + the meter + the soak talk to. `healthy()` gates
      // the whole cached/live split: false => injectChord plays everything live.
      stem = {
        healthy: () => ready && !dead,
        isModuleFailed: (mod) => failedMods.has(mod),
        takeRepeatFlag: () => { const f = repeatFlag; repeatFlag = null; return f; },
        // post THIS bar's cached slice; records the local bits (t0 / window /
        // fallback events) the worker never sees. rec.oneState/unitKeys/etc. go to
        // the worker; t0/cachedEvents stay here for the deadline ladder.
        postBar: (rec) => {
          if (!ready || dead) return;
          pending.set(rec.serial, { serial: rec.serial, t0: rec.t0, lo: rec.lo, spb: rec.spb,
            lenSamples: rec.lenSamples, cachedEvents: rec.cachedEvents,
            arrived: false, resolved: false, missed: false });
          try {
            worker.postMessage({ type: "bar", serial: rec.serial, oneState: rec.oneState,
              unitKeys: rec.unitKeys, layerOf: rec.layerOf, lo: rec.lo, hi: rec.hi, spb: rec.spb,
              startSample: rec.startSample, lenSamples: rec.lenSamples, barStartSec: rec.barStartSec });
          } catch (e) { pending.delete(rec.serial); }
        },
        // a section just started: if the queue fell >1 bar behind, drop the
        // worker's processor state COLD and refuse the backlog (fresh attacks at
        // the section edge hide the discontinuity). One miss never cascades.
        onSection: (fromSerial) => {
          if (resyncArmed && ready && !dead) {
            resyncArmed = false;
            try { worker.postMessage({ type: "reset", fromSerial }); jlog("stemReset", fromSerial); } catch (e) {}
            for (const [s, r] of pending) if (s < fromSerial && !r.resolved) r.resolved = true;
          }
        },
        stats: () => ({ active: true, ready, dead, headroom: Math.round(headroomEMA * 100) / 100,
          queued: lastQueued, renderMs: lastRenderMs, misses: missCount, vamps: vampCount,
          fallbacks: fallbackCount, resets: resetCount, failed: [...failedMods] }),
        // debug hook (forced-fallback seam test): terminate the worker mid-run and
        // assert the ladder engages with no click. Marks dead -> injectChord
        // reverts new bars to full live, in-flight bars ride the ladder.
        kill: () => { dead = true; jlog("stemKill", "debug"); try { worker.terminate(); } catch (e) {} },
        _cleanup: () => { clearInterval(dlTimer); try { worker.postMessage({ type: "flush" }); } catch (e) {} try { worker.terminate(); } catch (e) {} },
      };
    }
    async function feedSpeech(node) { // vocoder modulator: looped speech buffer -> audio input
      try {
        const st = getState();
        const vs = (st.foundSources || []).find(s => s.id === st.vocoderSourceId)
          || (st.foundSources || []).find(s => /^(sp_|vx_|vox_)/.test(s.id || ""));
        if (!vs) return;
        const buf = await ensureBuffer(vs);
        if (!buf) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        src.connect(node); src.start();
        speechSrcs.push(src);
      } catch (e) { /* vocoder hums without speech */ }
    }
    const speechSrcs = [];

    // ---- found buffers (decode once, tolerate failures) ----
    const bufFail = new Set();
    async function ensureBuffer(s) {
      const url = s.url || (s.samplePath ? new URL(s.samplePath, SITE).href : null);
      if (!url || bufFail.has(url)) return null;
      try { return await FP.decodeUrlToBuffer(ctx, url); }
      catch (e) { bufFail.add(url); console.warn("found decode failed:", url, e); return null; }
    }

    // ---- section walking state (mirrors wasm-audio exploreLive) ----
    let ci = 0, serial = 0, secIdx = 0, cycIdx = 0, nextTime = ctx.currentTime + 0.35;
    let absBeat = 0;   // absolute musical beats since start (+= CBEATS per bar — chordEvery-aware)
    const sessionT0 = ctx.currentTime;
    // Stage 3 stem cursor: a BS-aligned absolute SAMPLE grid + its FLOAT musical
    // time, advanced only on posted bars. barStartSec/startSample keep the worker's
    // event-placement math (floor(barStartSec+·)) aligned to its window boundary,
    // exactly as faust/stem-parity-test.js's S[]=round(n·CBEATS·spb·SR/BS)·BS grid.
    let stemMusicalSec = 0, stemSampleBase = 0, _lastSecName = null;
    let abort = false, timer = 0;
    // scheduling log (probe/debug): every scheduled event's unit, absolute
    // musical beat, and computed time — the drift gate asserts that events
    // sharing a beat share a time, across every layer
    const schedEvents = [], schedBars = [];
    const schedLog = (u, b, t) => { if (schedEvents.length < 12000) schedEvents.push({ u, b: Math.round(b * 1000) / 1000, t: Math.round(t * 1e5) / 1e5 }); };
    function grooveSec(st) {
      const score = (s) => (s.pads ? 1 : 0) + (s.bass && s.bass !== "off" ? 1 : 0) +
        (s.drums && s.drums !== "off" ? 2 : 0) + (s.melody && s.melody !== "off" ? 1 : 0);
      let best = st.sections[0];
      for (const s of st.sections)
        if (score(s) > score(best) || (/peak|chorus|drop|lift|swell/.test(s.name) && score(s) >= score(best))) best = s;
      return best;
    }

    async function injectChord(st) {
      // journal: state ARRIVAL by object identity (travel/journey hand a new
      // state object per station / glide step) + one cheap entry per bar —
      // the attribution baseline ("no structural event near this click" needs
      // the bars to be on the record too).
      if (st !== _lastStateObj) { _lastStateObj = st; jlog("state", st.genre || st.name || st.progression || "?"); }
      jlog("bar", serial);
      const prg = (E.PROGRESSIONS[st.progression] || E.PROGRESSIONS.royal_road);
      const nch = prg.chords.length;
      ci = ci % nch;
      const secs = st.sections && st.sections.length ? st.sections : [grooveSec(st)];
      secIdx = secIdx % secs.length;
      const cur = secs[secIdx], lastCyc = cycIdx >= (cur.cycles || 1) - 1;
      const sec = Object.assign({}, cur, { cycles: 1,
        fill: lastCyc ? (cur.fill || "off") : "off",
        sweep: (cycIdx === 0 && cur.sweep === "open") || (lastCyc && cur.sweep === "close") ? cur.sweep : "off" });
      const one = Object.assign({}, st, { sections: [sec], seed: ((st.seed || 1) + serial * 7919) >>> 0 });
      const spb = 60 / st.bpm;
      curBarSec = 4 * spb;   // insert filtersweep LFOs sync to this (bpm glides too)
      // CBEATS — beats per CHORD BAR, mirroring csd-engine buildEvents exactly
      // (KERNEL-V4 Phase 1: `Math.max(2,Math.round(state.chordEvery||8))`).
      // This used to be a hardcoded 8 at three sites (the window below, beatAbs,
      // and the nextTime advance in finally) — so a chordEvery:16/32 genre
      // (mallsoft/drone/prelude) had its chord bars sampled in 8-beat half/
      // quarter windows and the ci walk never reached the back of the
      // progression. States without chordEvery get CBEATS=8: byte-identical.
      const CBEATS = Math.max(2, Math.round(st.chordEvery || 8));
      const lo = ci * CBEATS, hi = lo + CBEATS;
      const t0 = nextTime;

      // EVERY bar's work runs inside try/finally so ONE bad bar can never wedge
      // the scheduler: the finally ALWAYS advances nextTime/serial/section, so a
      // throw drops just this bar and the next one plays (see the catch below).
      try {
      const ev = E.buildEvents(one);
      const units = SE.voiceUnits(E, one);
      const m = SE.mapEvents(E, one, ev, { lo, hi, units });
      applyFx(one, t0);
      await ensureReverbColor(one);   // build/swap the external reverb color node
      await ensureMasterMb(one);      // build/retire the opt-in multiband master glue

      if (opts.onBar) try { opts.onBar({ serial, ci, nch, when: t0, spb, cbeats: CBEATS,
        chord: (prg.chords[ci] || {}).name || "", section: sec.name,
        // Stage 3: a stem VAMP repeated a bar's cached layers (rung 1 of the
        // deadline ladder); the flag rides the NEXT injected bar's payload
        // (the vamped bar's own onBar fired ~LOOKAHEAD earlier — see stem
        // module). null when stems are off or nothing was vamped.
        stemRepeat: stem ? stem.takeRepeatFlag() : null }); } catch (e) {}

      // ---- ONE musical clock per bar ----
      // Every await (pool creation, found-buffer decode) happens BEFORE any
      // event time is computed; then `now` is sampled ONCE and every layer —
      // Faust gates, param sets, found chops/beds, sweeps — derives its time
      // from the same t0 via the same at(). If injection is running late the
      // WHOLE bar shifts by one uniform `late` offset instead of each event
      // clamping against a different re-sampled ctx.currentTime (that per-
      // event clamp across decode awaits was the instrument-drift bug).
      const usedKeys = new Set(m.events.map(e => e.unit));
      // publish this bar's PROTECTED set before any ensurePool: the budget
      // harvest + idle reaper must both see the current genre's full unit
      // table (not just the units with events this bar) as untouchable.
      curUnitKeys = new Set(Object.keys(units));
      // ---- Stage 3 STEM CLASSING ----
      // When the worker is healthy, SE.stemClass splits the units: CACHED (heavy
      // synthesis + inserts) render in the worker; the live path stands up only a
      // 1-node ASLEEP skeleton per cached unit (the fallback rung) and skips their
      // events entirely (the worker's AudioBufferSources carry that audio). A
      // module the worker can't load (missing dist wasm) is bumped back to LIVE so
      // it never goes silent. stem null / unhealthy => cachedSet null => every unit
      // plays live exactly as before (?stems=0 is byte-identical: nothing below runs).
      const stemsOn = !!(stem && stem.healthy());
      let cached = null, cachedSet = null;
      if (stemsOn) {
        const cls = SE.stemClass(units);
        cached = cls.cached.filter(k => units[k] && !stem.isModuleFailed(units[k].module));
        cachedSet = new Set(cached);
        for (const key of cached) {
          const u = units[key]; if (!u) continue;
          try { await ensureSkeletonPool(key, u); }
          catch (e) { errors.push("skeleton " + key + "@" + serial + ": " + (e && e.message || e)); }
        }
      }
      for (const key of usedKeys) {
        if (cachedSet && cachedSet.has(key)) continue;   // cached: worker-rendered, skeleton kept asleep
        const u = units[key]; if (!u) continue;
        // per-unit isolation: a voice whose module fails to instantiate (a bad
        // wasm fetch, a processor-registration failure under load) must not take
        // the whole bar down with it — log it and skip; its events then find no
        // pool and are silently dropped, the rest of the bar plays normally.
        try {
          if (u.sampler) await ensureSamplerBufs(u, one);   // native path: buffers, not pools
          else await ensurePool(key, u);
        } catch (e) { errors.push("voice " + key + "@" + serial + ": " + (e && e.message || e)); }
      }
      const bufs = {};   // srcId -> AudioBuffer, prefetched
      for (const f of m.found) {
        if (bufs[f.srcId] !== undefined) continue;
        const src = (one.foundSources || []).find(s => s.id === f.srcId);
        bufs[f.srcId] = src ? await ensureBuffer(src) : null;
      }

      const nowT = ctx.currentTime;
      const late = Math.max(0, nowT + 0.03 - t0);
      const at = (b) => t0 + late + (b - lo) * spb;
      const beatAbs = (b) => absBeat + (b - lo);   // musical beat since start (absBeat += CBEATS per bar; == serial*8 pre-chordEvery)
      // ---- 2.3 bar-boundary cost ledger ----
      // One awakeCost() snapshot per bar, then incremented locally as this
      // bar's scheduling wakes voices/chains — so the ceiling check below is
      // O(1) per event, not a pools walk per note. The snapshot is taken
      // AFTER ensurePool/ensureReverbColor/ensureMasterMb (everything that
      // changes what exists) and BEFORE any wake (everything that changes
      // what computes). Drift across the bar is impossible: sleeps only
      // happen in sleepIdleVoices (end of this same function), wakes only
      // here. costStolen coalesces the journal to one entry per unit per bar
      // (a ceiling-pinned bar can steal every melody note — the attribution
      // pass needs the event, not 12 copies of it).
      let costNow = awakeCost();
      const costStolen = new Set();
      const monoBuckets = {};   // mono-legato units: scheduled in a dedicated pass below
      // per-note param sets (declick-safe, ~6ms early) + optional DX7 external-gain
      // velocity — the block shared by the normal and mono-legato passes below.
      // opts.flangePos: map kpluck's song-length flanger to ABSOLUTE session time
      // (bar-local beats would pin it ~0) — normal pass only; the mono pass sets
      // plain vals. (The ping-pong `pp` send is normal-pass-only, kept inline there.)
      const applyNoteParams = (pool, v, e, tOn, opts) => {
        const tset = Math.max(nowT, tOn - 0.006);
        for (const [k, val] of Object.entries(e.sets)) {
          const vv = (opts && opts.flangePos && k === "flangePos") ? Math.min(1, (tOn - sessionT0) / 164) : val;
          const p = P(v.node, k);
          if (p) p.setValueAtTime(Math.min(p.maxValue, Math.max(p.minValue, vv)), tset);
        }
        if (pool.spec.extGainPerAmp) {   // DX7 per-note velocity via the external GainNode
          // A STEP here jumps the amplitude of any prior note's release tail still
          // ringing through v.out.gain at the retrigger — a per-note click,
          // independent of CPU load (fires with zero underrun). Micro-ramp from the
          // previous velocity target to the new one across ~5ms so the velocity
          // change GLIDES across the retrigger instead of stepping. Overlap-safe like
          // retirePool (:964): v.out.gain is ALSO driven by retirePool's raised-cosine
          // declick curve, and a pending setValueCurveAtTime makes setValueAtTime throw
          // rather than splice — cancel + retry (a retiring voice takes no new notes,
          // so this is a belt-and-suspenders race guard). Anchor at velLast, the value
          // the param HOLDS at tset (the prior note's ramp ended well before tset), NOT
          // og.value read at now — two notes on one voice per bar would otherwise jump.
          const target = Math.min(1, pool.spec.extGainPerAmp * (e.amp || 0.1));
          const og = v.out.gain, tr = tset + 0.005;
          const anchor = v.velLast != null ? v.velLast : og.value;
          try {
            og.setValueAtTime(anchor, tset);
            og.linearRampToValueAtTime(target, tr);
          } catch (err) {
            try { og.cancelScheduledValues(tset); og.setValueAtTime(anchor, tset); og.linearRampToValueAtTime(target, tr); } catch (e2) {}
          }
          v.velLast = target;
        }
      };
      for (const e of m.events) {
        if (cachedSet && cachedSet.has(e.unit)) continue;   // Stage 3: cached unit — rendered in the stem worker
        const uSpec = units[e.unit];
        if (uSpec && uSpec.mono && !uSpec.sampler && !uSpec.drum) {   // MONO-LEGATO: batched, scheduled after
          (monoBuckets[e.unit] = monoBuckets[e.unit] || []).push(e); continue; }
        if (uSpec && uSpec.sampler) {   // SAMPLER note: native buffer playback
          const player = samplerOf(e.unit);
          const midi = SP ? SP.midiOfFreq(e.sets.freq) : 0;
          const z = SP ? SP.zoneFor(uSpec.sampler.zones, midi) : null;
          const buf = z && samplerBufs[z.srcId];
          if (player && buf) {
            const zsr = uSpec.sampler.sr || 44100;
            player.note(buf, at(e.beat), { rate: SP.rateFor(z, midi), durSec: e.durB * spb,
              gain: (uSpec.lvl || 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
              atk: uSpec.sampler.atk, rel: uSpec.sampler.rel, swell: !!uSpec.sampler.swell,
              mello: uSpec.sampler.mello || null, songT: beatAbs(e.beat) * spb,   // MELLOTRON: LFO phase off musical beat time (no wall clock)
              dry: uSpec.dry != null ? uSpec.dry : 1, rsend: uSpec.rev || 0, dsend: uSpec.del || 0,
              bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0,
              loop: !!z.loop, loopStartSec: (z.loopStart || 0) / zsr, loopEndSec: (z.loopEnd || 0) / zsr });
            layers.get(LAYER_OF_UNIT(e.unit)).lastBar = serial;
            schedLog("sampler:" + e.unit, beatAbs(e.beat), at(e.beat));
          }
          continue;
        }
        const pool = pools.get(e.unit); if (!pool) continue;
        const tOn = at(e.beat);
        const durSec = e.durB * spb;
        const tOff = e.hold ? tOn + durSec
          : e.drum ? tOn + 0.012
          : tOn + Math.max(0.012, durSec) - 0.008;
        let v = pool.nodes.find(x => x.busyUntil <= tOn) ||
                pool.nodes.reduce((a, b) => (a.busyUntil <= b.busyUntil ? a : b));
        // ---- 2.3 COST CEILING at the moment of choice ----
        // If the free voice we picked is ASLEEP and waking it (plus its
        // sleeping chain) would push the awake cost past the ceiling, prefer
        // an already-awake voice of the SAME pool: the tail-dip declick below
        // already makes that steal clean (it's the same path dx7 overlaps
        // ride every day). The note always plays — on heavy genres pinned at
        // the ceiling, pool polyphony thins instead of the audio thread
        // sinking (miamibass's "9 awake, clicking" repro). Pools of 1 (drums,
        // mono) have no awake alternative and wake regardless: the ceiling is
        // a preference, never a gate on the music.
        if (v.asleep && costNow + wakeCostOf(pool, v) > COST_CEILING) {
          let alt = null;
          for (const x of pool.nodes) if (!x.asleep && (!alt || x.busyUntil < alt.busyUntil)) alt = x;
          if (alt) {
            v = alt; costStealCount++;
            if (!costStolen.has(e.unit)) { costStolen.add(e.unit); jlog("costSteal", e.unit + "@" + costNow.toFixed(1)); }
          }
        }
        costNow += wakeCostOf(pool, v);   // 0 if v (and its chain) are already awake
        wake(pool, v);   // sleeping voice/chain: resume compute now (>=30ms before its gate-on)
        // stealing a voice whose release tail still rings: dip its declick
        // gain across the param/gate jumps (~12ms) so the retrigger is clean
        if (v.tailUntil > tOn && v.dk) {
          const d = v.dk.gain, tA = Math.max(nowT, tOn - 0.009);
          d.cancelScheduledValues(tA);
          d.setValueAtTime(1, tA);
          d.linearRampToValueAtTime(0, Math.max(tA + 0.001, tOn - 0.003));
          d.linearRampToValueAtTime(1, tOn + 0.005);
        }
        applyNoteParams(pool, v, e, tOn, { flangePos: true });   // flangePos -> absolute session time (kpluck)
        const ppv = e.pp || 0;   // per-event ping-pong send (snarePP snare hits)
        if (v.gains.pp && ppv !== v.ppLast) {
          // A STEP on the pp send ~6ms before gate-on clicks straight into the delay
          // bus, which then REPEATS the click on every tap. Micro-ramp ~5ms from the
          // held value (ppLast) to the new send instead. Native GainNode — cheap, and
          // NOT the a-rate glide() hazard, so a plain linearRamp is correct here.
          const pg = v.gains.pp.gain, tp = Math.max(nowT, tOn - 0.006);
          pg.setValueAtTime(v.ppLast, tp);
          pg.linearRampToValueAtTime(ppv, tp + 0.005);
          v.ppLast = ppv;
        }
        const g = P(v.node, "gate");
        if (g) { g.setValueAtTime(1, tOn); g.setValueAtTime(0, tOff); }
        v.busyUntil = tOff;
        v.tailUntil = tOff + (pool.spec.tail != null ? pool.spec.tail : 1);
        layers.get(LAYER_OF_UNIT(e.unit)).lastBar = serial;
        schedLog(e.drum ? "drum:" + e.unit : e.unit, beatAbs(e.beat), tOn);
      }
      // ---- MONO-LEGATO pass (modeld/tb303/synclead: u.mono, pool 1) ----
      // Port of press.js's mono grouping into the live pool. Every note of the
      // unit routes to node 0; per-note freq/params are set BEFORE gate-on so
      // the module slews (glide); when the next note starts within legatoSec of
      // the previous note's gate-off, the gate is HELD across the group (the
      // pending gate-off is cancelled and NO new gate-on is issued) so the
      // envelopes single-trigger and the pitch slides — exactly the press
      // contract. pool._monoOff carries the pending gate-off time ACROSS bars.
      for (const key of Object.keys(monoBuckets)) {
        const pool = pools.get(key); if (!pool || !pool.nodes.length) continue;
        const evs = monoBuckets[key].sort((a, b) => a.beat - b.beat);
        const v = pool.nodes[0], g = P(v.node, "gate");
        costNow += wakeCostOf(pool, v);   // 2.3 ledger: mono has no alternative, but the cost is real
        wake(pool, v);   // mono voice may have slept between phrases (chain wakes with it, 2.2)
        const legatoSec = pool.spec.legatoSec != null ? pool.spec.legatoSec : 0.03;
        for (const e of evs) {
          const tOn = at(e.beat), durSec = e.durB * spb;
          const tOff = tOn + Math.max(0.012, durSec) - 0.008;
          applyNoteParams(pool, v, e, tOn);   // mono pass: plain vals (no flangePos)
          const legato = pool._monoOff != null && tOn <= pool._monoOff + legatoSec;   // gap < legatoSec or overlapping (press parity)
          if (g) {
            if (legato) g.cancelScheduledValues(Math.max(nowT, pool._monoOff - 1e-4)); // withdraw pending gate-off; gate stays high
            else g.setValueAtTime(1, tOn);
            g.setValueAtTime(0, tOff);
          }
          pool._monoOff = tOff;
          v.busyUntil = tOff;
          v.tailUntil = tOff + (pool.spec.tail != null ? pool.spec.tail : 1);
          layers.get(LAYER_OF_UNIT(key)).lastBar = serial;
          schedLog(key, beatAbs(e.beat), tOn);
        }
      }
      // found: chop events in-window; bed re-anchored at bar start of chord 0
      // (buffers prefetched above — scheduling here is synchronous, same clock)
      for (const f of m.found) {
        const buf = bufs[f.srcId];
        if (!buf) continue;
        if (f.type === "chop") {
          const lane = VOXISH.test(f.srcId) ? "vox" : "chops";
          (lane === "vox" ? foundVox : foundChops).chop(buf, at(f.beat), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch,
            offset: f.offset, cutoff: f.cutoff, rsend: f.rsend, dsend: f.dsend, ppsend: f.ppsend,
            fade: f.fade, sqRate: f.sqRate, sqDepth: f.sqDepth, autoTune: f.autoTune });
          layers.get(lane).lastBar = serial;
          schedLog("found:chop", beatAbs(f.beat), at(f.beat));
        } else if (ci === 0) {
          foundBeds.bed(buf, at(lo), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch,
            stretch: f.stretch, cutoff: f.cutoff, autoTune: f.autoTune });
          layers.get("beds").lastBar = serial;
          schedLog("found:bed", beatAbs(lo), at(lo));
        }
      }
      // master sweep -> fx mcut exponential ride
      for (const sw of m.sweeps) {
        const p = P(fx, "mcut");
        if (!p) continue;
        const a = Math.max(180, Math.min(21000, sw.from)), b = Math.max(180, Math.min(21000, sw.to));
        const t = at(sw.beat);
        p.setValueAtTime(a, t);
        p.exponentialRampToValueAtTime(b, t + sw.durB * spb);
        fxCache.mcut = null;
      }

      // ---- Stage 3: POST this bar's cached slice to the stem worker ----
      // The worker recomputes events itself from oneState (deterministic — its
      // events == ours), so it needs only the window descriptor; cachedEvents +
      // t0 stay here for the deadline ladder's fallback. The BS-aligned sample
      // cursor advances per posted bar so the worker's per-bar windows tile with
      // zero gap/overlap (parity-test grid). onSection first: a section start is
      // where a queued-behind worker is skip-and-reset (fresh attacks mask it).
      if (stemsOn && cached) {
        if (sec.name !== _lastSecName) { _lastSecName = sec.name; stem.onSection(serial); }
        const barStartSec = stemMusicalSec;
        const nextSec = stemMusicalSec + CBEATS * spb;
        const nextBase = Math.round(nextSec * 44100 / 64) * 64;
        const startSample = stemSampleBase, lenSamples = nextBase - stemSampleBase;
        stemMusicalSec = nextSec; stemSampleBase = nextBase;
        const layerOf = {}; for (const k of cached) layerOf[k] = LAYER_OF_UNIT(k);
        const cachedEvents = cachedSet ? m.events.filter(e => cachedSet.has(e.unit)) : [];
        stem.postBar({ serial, oneState: one, unitKeys: cached, layerOf,
          lo, hi, spb, startSample, lenSamples, barStartSec, t0, cachedEvents });
      }

      // TRAVEL leak fix: tear down pools left behind by genres we've moved on
      // from (their unique solo: keys). curUnitKeys (set above) is the full unit
      // table this bar — exactly what the current genre wants, protected.
      // harvestForBudget(0) is the bar-boundary BUDGET pass: with the cap at 8,
      // any pools that have gone idle (solo between sections, sfx between hits)
      // are evicted here so the meter's count returns to <=8 as the music
      // thins — not only when a new pool is being created.
      // opts.noReap disables all of it (the soak's BEFORE/AFTER A/B leg).
      if (!opts.noReap) { reapStalePools(); sleepIdleVoices(); harvestForBudget(0); }

      // 1.3 eco drain: retune at most 2 dirty pools this bar (Map order +
      // one-shot flags = round-robin across bars — every dirty pool retunes
      // exactly once, never the whole fleet in one render window).
      let ecoDrained = 0;
      for (const [k, p] of pools) {
        if (ecoDrained >= 2) break;
        if (!p.ecoDirty) continue;
        p.ecoDirty = false; p.paramSig = "";   // clear the sig so retune actually re-applies eco caps
        if (p.spec) retune(p, p.spec, t0);
        jlog("ecoDrain", k);
        ecoDrained++;
      }
      expirePrepared();   // 1.6: prepared-but-never-adopted stash nodes must not outlive their TTL

      if (schedBars.length < 2000) schedBars.push({ serial, t0: t0 + late, spb, late: Math.round(late * 1e5) / 1e5 });
      } catch (e) {
        // ONE bad bar must never wedge the scheduler. Before this, a throw here
        // (a voice module that fails to instantiate, a non-finite AudioParam
        // time, a decode edge) propagated to tick(), which caught it but left
        // nextTime UN-advanced — so the very next tick re-ran this SAME failing
        // bar forever: the ~6s of already-scheduled audio drained, the song went
        // silent, and the console filled with the repeating error (Paul's "plays
        // half a measure, then the whole song stops and things crash out"). Log
        // it to handle.errors, drop this bar's remaining work, and let finally
        // advance the clock so the NEXT bar plays.
        errors.push("injectChord@" + serial + ": " + (e && e.message || e));
        console.error("FaustLive injectChord (bar " + serial + " skipped)", e);
      } finally {
        bootDone = true;   // 1.5: boot is over — every later mkNode rides the airlock queue
        nextTime += CBEATS * spb;
        absBeat += CBEATS;
        ci++; serial++;
        if (ci >= nch) { ci = 0; cycIdx++;
          if (cycIdx >= (secs[secIdx].cycles || 1)) { cycIdx = 0; secIdx = (secIdx + 1) % secs.length; } }
      }
    }

    // ---- load meter + eco (audio clock vs wall clock, EMA like wasm-audio) ----
    const eco = { level: opts.ecoStart != null ? opts.ecoStart : 0, bad: 0, good: 0 };
    let lastWall = 0, lastAudio = 0, loadRatio = 1;
    const meter = setInterval(() => {
      const w = performance.now(), a = ctx.currentTime;
      if (lastWall && ctx.state === "running") {
        const r = (a - lastAudio) / ((w - lastWall) / 1000);
        // ---- 1.4 SUB-2s SPIKE GUARD: eco's ~2s hysteresis leaves a single
        // bad 250ms sample unanswered — exactly the window a creation burst
        // or heavy bar lands in. On any ONE raw sample under 0.85 (BEFORE the
        // EMA smooths it away; lower = more starved here), shed the two
        // things that are instant and fully reversible: park the 1.5 airlock
        // (no new worklets for ~2s) and zero the fx crackle bed (the next
        // applyFx pass restores it via the cache). No retunes, no pool moves.
        if (r > 0 && r < 0.85) {
          const already = airlockPausedUntil > w;
          airlockPausedUntil = w + 2000;
          const cp = P(fx, "crackle");
          if (cp) { try { cp.setValueAtTime(0, ctx.currentTime); } catch (e) {} fxCache.crackle = 0; }
          if (!already) jlog("spikeGuard", "r=" + r.toFixed(2));   // journal once per episode, not per 250ms
        }
        if (r > 0 && r < 3) loadRatio = loadRatio * 0.7 + r * 0.3;
        if (loadRatio < 0.95) { eco.bad++; eco.good = 0; } else if (loadRatio > 0.995) { eco.good++; eco.bad = 0; }
        // ---- 1.3 DE-STORMED ECO: a level change used to blank every pool's
        // paramSig at once — the whole fleet retuned in the next bar, right
        // when the thread was already underwater (R4). Now pools are only
        // MARKED dirty; injectChord drains <=2 per bar (round-robin by flag —
        // each dirty pool retunes exactly once, spread across bars). The
        // fxCache flush stays immediate: fx_bus is ~19 params, cheap.
        if (eco.bad > 8 && eco.level < 3) { eco.level++; eco.bad = 0;
          jlog("eco", "up:" + eco.level);
          for (const [, p] of pools) p.ecoDirty = true;   // drained <=2/bar in injectChord
          for (const k of Object.keys(fxCache)) delete fxCache[k]; // re-apply FX with eco thinning
          status("eco mode " + eco.level + " — shedding load"); }
        if (eco.good > 240 && eco.level > 0 && (opts.ecoStart == null || eco.level > opts.ecoStart)) { eco.level--; eco.good = 0;
          jlog("eco", "down:" + eco.level);
          for (const [, p] of pools) p.ecoDirty = true;
          for (const k of Object.keys(fxCache)) delete fxCache[k];
          status(eco.level ? "eco mode " + eco.level : "full quality restored"); }
        // third arg (2.3): the cost picture, so meters can show WHAT the load
        // is made of without extra handle polling. Existing (r, e) callers
        // (explorer/soak) simply ignore it — additive, compat-safe.
        if (opts.onLoad) try { opts.onLoad(loadRatio, eco.level,
          { awakeCost: Math.round(awakeCost() * 10) / 10, ceiling: COST_CEILING, costSteals: costStealCount }); } catch (e) {}
      }
      lastWall = w; lastAudio = a;
    }, 250);

    let injecting = false;
    const tick = async () => {
      if (abort) return;
      try {
        // never let a browser/OS suspension stick while we're supposed to play
        if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
        if (!injecting) {
          injecting = true;
          const now = ctx.currentTime;
          if (nextTime < now) nextTime = now + 0.1; // fell behind (tab sleep) — resync
          while (nextTime < ctx.currentTime + LOOKA && !abort) await injectChord(getState());
          injecting = false;
        }
      } catch (e) { injecting = false; errors.push(String(e && e.message || e)); console.error("FaustLive tick", e); }
      timer = setTimeout(tick, TICK_MS);
    };
    // audio must SURVIVE focus loss: nothing here suspends the ctx on blur,
    // and if the browser did (mobile interruption), resume the moment we're
    // back. The scheduler is plain setTimeout — no rAF anywhere in the audio
    // path — so it keeps running (1s-clamped) while hidden.
    const onVisible = () => { if (!abort && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} } };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
      root.addEventListener("focus", onVisible);
      root.addEventListener("pageshow", onVisible);
    }
    // Stage 3: arm the stem worker BEFORE the first bar, so the cached/live split
    // is stable from bar 0 (no full-pool-then-skeleton churn on entry). Awaited so
    // stem.healthy() is true when injectChord first runs; on any failure initStems
    // leaves stem=null and every unit plays live. Guarded by opts.stems — the flag
    // is default-OFF, so the everyday path never constructs a worker.
    if (opts.stems) { try { await initStems(opts); } catch (e) { stem = null; errors.push("stems: " + (e && e.message || e)); } }
    status(ctx.state === "running" ? "live (faust) — drag the space" : "live (tap again if silent)");
    tick();
    // prewarm module processor registrations while load is light: a mid-run
    // module swap otherwise pays the audio-thread addModule/wasm setup right
    // then (measured: a ~0.95 load blip 2s after an insert swap; the 2026-07-04
    // regression hunt traced Paul's "crackle + scheduler slightly off" report
    // to exactly this one-time hitch when travel enters a genre whose HEAVY
    // fleet voices / reverb color / master_mb aren't built yet). Prewarmed
    // nodes are never connected — zero render cost — and dropped immediately;
    // later mkNodes of the same module just instantiate. Staggered in small
    // batches so the prewarm itself never spikes the audio thread.
    // Two-tier prewarm (2026-07-04 regression hunt: the one-time hitch when
    // travel enters a genre with unbuilt HEAVY modules read as "crackle +
    // scheduler off"). Tier 1: factory() prefetch — the MAIN-thread wasm
    // compile, the expensive part, zero audio-thread cost — for the whole
    // fleet + reverb colors + master_mb. Fires once at 1.5s, unchanged.
    setTimeout(() => { if (!abort) {
      for (const m of ["juno60", "tb303", "solina", "hammond", "modeld",
                       "synclead", "casiocz", "oberheim", "ppg", "vp330",
                       "reverb_dattorro", "reverb_greyhole", "reverb_fdn", "reverb_spring", "master_mb"])
        Promise.resolve(factory(m)).catch(() => {});
    } }, 1500);
    // ---- 2.1 SLOW TIER-2 PREWARM (Stage 2, ZERO-STATIC) ----
    // Tier 2 is the audio-thread half: instantiate one node so the PROCESSOR
    // registration (addModule + wasm setup on the render thread) happens
    // before travel needs it, then destroy the instance — the registration
    // survives it. The old shape burst all six insert modules at t=1.5s with
    // a 2s overlap window each: from a COLD START on a heavy genre that burst
    // landed exactly on top of the opening bars' full-fleet wake (the
    // miamibass repro's "soon started clicking" — boot builds the pools raw,
    // then the prewarm piles up to ~4.5 cost units of unconnected-but-
    // computing worklets on the same starving thread; an unconnected Faust
    // worklet renders every block until destroyed, the actively-processing-
    // source physics below). And it only ever covered the inserts — the heavy
    // fleet's registration still hit at need time, which is what the 2026-07-04
    // hunt traced "crackle + scheduler off" to in the first place (full-node-
    // prewarming them as a batch had dipped the load gate 0.987 -> 0.82-0.87,
    // so they were left out).
    // The rework fixes both with PACING instead of exclusion: ONE module per
    // 2s tick, and a tick only spends its slot when the load EMA is healthy
    // (loadRatio > 0.97 — in this repo 1.0 = keeping up, lower = starved), so
    // registration cost lands only in windows with headroom and never
    // overlaps itself (each instance dies 500ms after birth, a quarter of a
    // tick). That makes the heavy fleet + reverb colors + master_mb safe to
    // include: 21 modules x 2s ≈ the first ~40s of a session when everything
    // is healthy, later when it isn't — cold-start-on-a-heavy-genre simply
    // defers until the boot storm passes. Modules some pool/prepare already
    // instantiated are skipped via _regMods (their registration exists — a
    // prewarm node would be pure waste). Inserts lead the list: they're the
    // cheapest registrations and the most likely mid-dwell surprise (an
    // insert swap inside a genre); the fleet follows for travel.
    // mkNodeFresh, NOT mkNode: prewarm must never ADOPT a prepared stash
    // node (1.6) — it would destroy what prepare() just built. destroyNode
    // always: an undestroyed prewarm instance is an "actively processing"
    // source per spec and renders every block forever (the same never-torn-
    // down physics as the pool leak, just flat).
    const PREWARM_MODS = [
      "insert_distort", "insert_phaser", "insert_chorus", "insert_filtersweep", "insert_wah", "insert_tremolo",
      "juno60", "tb303", "solina", "hammond", "modeld",
      "synclead", "casiocz", "oberheim", "ppg", "vp330",
      "reverb_dattorro", "reverb_greyhole", "reverb_fdn", "reverb_spring", "master_mb",
    ];
    let prewarmIdx = 0;
    const prewarmTimer = setInterval(() => {
      if (abort || prewarmIdx >= PREWARM_MODS.length) { clearInterval(prewarmTimer); return; }
      if (!(loadRatio > 0.97)) return;             // starved: skip this slot, keep the place in line
      const m = PREWARM_MODS[prewarmIdx++];
      if (_regMods.has(m)) return;                 // already registered by a real pool / prepare()
      jlog("prewarm", m);
      mkNodeFresh(m, "prewarm:" + m).then((n) => setTimeout(() => destroyNode(n), 500)).catch(() => {});
    }, 2000);

    const rmsBuf = new Float32Array(analyser.fftSize);
    const handle = {
      ctx, analyser, errors, mediaEl,   // mediaEl exposed for headless verification (readyState/currentTime)
      _sched: schedEvents, _bars: schedBars, _pools: pools,   // probe/debug (drift + dx7-morph gates)
      layers() {   // mixer view: monitoring/override bus over the layer taps
        return LAYER_DEFS.map(([id]) => {
          const L = layers.get(id);
          return {
            id, label: L.label,
            gain: L.gainVal, muted: L.muted, solo: L.solo,
            active: serial - L.lastBar <= 2,
            rms() {
              try { L.an.getFloatTimeDomainData(L.buf); } catch (e) { return 0; }
              let s = 0; for (let i = 0; i < L.buf.length; i++) s += L.buf[i] * L.buf[i];
              return Math.sqrt(s / L.buf.length);
            },
            setGain(v) { L.gainVal = Math.max(0, Math.min(2, +v || 0)); applyLayerGains(); },
            setMute(b) { L.muted = !!b; applyLayerGains(); },
            setSolo(b) { L.solo = !!b; applyLayerGains(); },
          };
        });
      },
      loadRatio: () => loadRatio,
      ecoLevel: () => eco.level,
      // live Faust WORKLET-node count (the thing that renders every block): the
      // always-on fx_bus + opt-in master glue + reverb color + every pool voice
      // and its insert chain. The CPU meter + travel soak read this to see pool
      // accumulation vs the reaper's sawtooth and the budget's plateau. Native
      // nodes (bleed delays, sends, found/sampler buffers) aren't worklets.
      nodeCount: countWorklets,
      // worklets actually COMPUTING right now: awake pool voices + infra +
      // AWAKE insert chains (2.2: chains sleep with their pools now, so a
      // sleeping chain no longer inflates the count — the ⬡ meter's first
      // number is the true compute population, Paul's "most music is playing
      // with 2 or 3 worklets" made measurable).
      awakeCount() {
        let n = 1;
        if (mbNode) n++;
        if (revColorNode) n++;
        for (const [, p] of pools) {
          n += p.nodes.filter(v => !v.asleep).length;
          if (p.ins && p.ins.chain && !p.ins.chain.asleep) n += p.ins.chain.built.length;
        }
        return n;
      },
      // 2.3: the same population priced in COST units (SE.COST, pad_saw = 1)
      // — the number the ceiling actually enforces. 9 awake organs and 9
      // awake dx7s read identically on awakeCount and differ ~16x here.
      awakeCost: () => Math.round(awakeCost() * 10) / 10,
      costCeiling: () => COST_CEILING,
      costStealCount: () => costStealCount,
      poolCount: () => pools.size,
      reapCount: () => reapCount,
      harvestCount: () => harvestCount,
      maxWorklets: () => MAX_WORKLETS,
      // ---- 1.6: pre-voice a target state (see prepare above). Fire-and-forget
      // from the UI (explorer retarget / soak station pre-boundary): by the
      // time the glide delivers the state, its worklets already exist and the
      // arrival's mkNodes ADOPT instead of instantiating.
      prepare,
      preparedCount: () => preparedCount,
      // ---- output-truth instruments (Stage 0.B/0.C) ----
      // which terminal actually feeds the speakers — "mediaEl" (the mobile
      // screen-lock route, with its known sink-drift physics) or "direct"
      // (classic ctx.destination). First question when a glitch is reported.
      outputRoute: msDest ? "mediaEl" : "direct",
      // zombie registry readout: created/destroyed are ground truth from
      // mkNode/destroyNode; counted is what countWorklets can SEE. alive ===
      // counted between churn; a SUSTAINED alive > counted = leaked worklets
      // rendering forever (blips of a few seconds around swaps are the
      // deferred teardowns + prewarm, not zombies).
      // (+ preparedCount: stash nodes are alive-but-stopped worklets — the
      // registry must see them or every prepare would read as a zombie. They
      // are deliberately NOT in nodeCount/the render budget: stopped nodes
      // consume no render time and must never evict playing music.)
      workletTruth: () => ({ created: _created, destroyed: _destroyed, alive: _created - _destroyed, counted: countWorklets() + preparedCount }),
      // Stage 3 stem cache: worker throughput headroom (x-realtime), queue depth,
      // and the deadline-ladder counters (misses / vamps / skeleton fallbacks /
      // resets). null when stems are off — the ⬡ tag + soak feature-detect on it.
      stemStats: () => stem && stem.stats ? stem.stats() : null,
      // forced-fallback seam test hook: kill the worker mid-run; asserts the
      // ladder engages (VAMP then skeleton recovery) with no sentinel click.
      __killStemWorker: () => { if (stem && stem.kill) stem.kill(); },
      // chronological copy of the event journal ring (oldest first)
      journal: () => { const out = []; for (let i = 0; i < jCount; i++) out.push(J[(jHead - jCount + i + JLEN) % JLEN]); return out; },
      // opt-in sentinel/renderCapacity readouts — null when debugSentinel is
      // off or the API is unsupported (so callers can feature-detect cheaply)
      sentinel: () => sentinelState ? { latest: sentinelState.latest, total: Object.assign({}, sentinelState.total) } : null,
      renderCapacity: () => capState ? { api: capState.api, latest: capState.latest, total: Object.assign({}, capState.total) } : null,
      rms() {
        analyser.getFloatTimeDomainData(rmsBuf);
        let s = 0; for (let i = 0; i < rmsBuf.length; i++) s += rmsBuf[i] * rmsBuf[i];
        return Math.sqrt(s / rmsBuf.length);
      },
      balance() {
        // per-channel L/R RMS off the master. The main analyser DOWNMIXES to
        // mono, so it is blind to panning bugs (the 2026-07-04 hard-left dry
        // bus shipped through it) — this tap is the gate that sees them.
        if (!this._balTap) {
          const sp = ctx.createChannelSplitter(2);
          const mk = () => { const a = ctx.createAnalyser(); a.fftSize = 2048; return a; };
          const aL = mk(), aR = mk();
          sp.connect(aL, 0); sp.connect(aR, 1);
          master.connect(sp);
          this._balTap = { aL, aR, buf: new Float32Array(2048) };
        }
        const t = this._balTap, r = (a) => {
          a.getFloatTimeDomainData(t.buf);
          let s = 0; for (let i = 0; i < t.buf.length; i++) s += t.buf[i] * t.buf[i];
          return Math.sqrt(s / t.buf.length);
        };
        return { l: r(t.aL), r: r(t.aR) };
      },
      stop() {
        // order matters: kill the scheduler, then hard-mute the MASTER (this
        // silences reverb/delay tails and anything already scheduled ahead —
        // buffer sources included — within ~60ms), then tear down and close.
        abort = true; clearTimeout(timer); clearInterval(meter);
        if (elRecycleTimer) clearInterval(elRecycleTimer);   // 1.7
        clearInterval(prewarmTimer);   // 2.1: no prewarm slots after stop (abort also guards)
        if (stem && stem._cleanup) { try { stem._cleanup(); } catch (e) {} }   // Stage 3: stop the deadline watchdog + terminate the worker
        // 1.6: the prepared stash holds live (stopped) worklets — destroy them
        // or the registry counts them as leaked after close.
        for (const [, list] of prepared) for (const { node } of list) destroyNode(node);
        prepared.clear(); preparedCount = 0;
        if (capState) { try { if (capState.timer) clearInterval(capState.timer); else ctx.renderCapacity.stop(); } catch (e) {} }
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisible);
          root.removeEventListener("focus", onVisible);
          root.removeEventListener("pageshow", onVisible);
        }
        const tNow = ctx.currentTime;
        try {
          master.gain.cancelScheduledValues(tNow);
          master.gain.setValueAtTime(master.gain.value, tNow);
          master.gain.linearRampToValueAtTime(0, tNow + 0.06);
        } catch (e) {}
        // silence + release the media element too (the master mute already
        // starves its stream; pausing + dropping srcObject makes it truly stop
        // and clears the OS "now playing" surface). Left detached in the DOM —
        // harmless, and a subsequent goLive() builds a fresh element.
        if (mediaEl) { try { mediaEl.pause(); mediaEl.srcObject = null; mediaEl.remove(); } catch (e) {} }
        foundBeds.stopAll(); foundChops.stopAll(); foundVox.stopAll();
        for (const [, p] of samplerPlayers) p.stopAll();
        for (const s of speechSrcs) { try { s.stop(); } catch (e) {} }
        for (const [, p] of pools) retirePool(p);
        setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1200);
        status("stopped");
      },
    };
    root.FaustLive.lastHandle = handle;   // debug/probe access (rms, errors)
    return handle;
  }

  root.FaustLive = { exploreLive, BASE, SITE };
})(typeof window !== "undefined" ? window : globalThis);
