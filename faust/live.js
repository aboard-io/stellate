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

  const LOOKAHEAD = 4;      // seconds of scheduled audio kept ahead
  const TICK_MS = 160;

  async function exploreLive(getState, onStatus, opts) {
    opts = opts || {};
    const E = root.CsdEngine, SE = root.FaustStateEngine, FP = root.FoundPlayer;
    if (!E || !SE || !FP) throw new Error("FaustLive needs csd-engine.js, faust/state-engine.js, faust/found-player.js loaded first");
    const status = (m) => { if (onStatus) try { onStatus(m); } catch (e) {} };

    const AC = root.AudioContext || root.webkitAudioContext;
    let ctx;
    try { ctx = new AC({ sampleRate: 44100, latencyHint: "playback" }); } catch (e) { ctx = new AC(); }
    try { ctx.resume(); } catch (e) {}

    status("loading Faust modules…");
    const fw = await import(BASE + "node_modules/@grame/faustwasm/dist/esm/index.js");
    const { FaustWasmInstantiator, FaustMonoDspGenerator } = fw;
    const factories = {};
    const factory = (mod) => factories[mod] || (factories[mod] =
      FaustWasmInstantiator.loadDSPFactory(BASE + `dist/${mod}-module.wasm`, BASE + `dist/${mod}-meta.json`));
    const errors = [];
    async function mkNode(mod, tag) {
      const gen = new FaustMonoDspGenerator();
      const node = await gen.createNode(ctx, mod, await factory(mod));
      node.onprocessorerror = (e) => errors.push(tag + ": " + (e && e.message || "processorerror"));
      return node;
    }
    const P = (node, name) => {
      for (const k of node.parameters.keys()) if (k.endsWith("/" + name)) return node.parameters.get(k);
      return null;
    };

    // ---- master graph: merger(6ch) -> fx_bus -> master mute -> analyser -> out
    // (master sits BEFORE the analyser so handle.rms() reflects the stop mute)
    const fx = await mkNode("fx_bus", "fx");
    const merger = ctx.createChannelMerger(6);
    merger.connect(fx);
    const master = ctx.createGain(); master.gain.value = 1;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    fx.connect(master); master.connect(analyser); analyser.connect(ctx.destination);
    const dryBus = ctx.createGain(), revBus = ctx.createGain(), delBus = ctx.createGain(), ppBus = ctx.createGain();
    dryBus.connect(merger, 0, 0); dryBus.connect(merger, 0, 1);
    revBus.connect(merger, 0, 2); delBus.connect(merger, 0, 3); ppBus.connect(merger, 0, 4);
    const found = FP.FoundLive(ctx, { dry: dryBus, rev: revBus, del: delBus, pp: ppBus });

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
        const clamped = Math.min(p.maxValue, Math.max(p.minValue, vv));
        // journeys glide these every bar — a setValueAtTime STEP on a live
        // reverb/delay/tone param is an audible periodic click. Smooth over
        // ~20ms instead (delay-time jumps especially).
        p.setTargetAtTime(clamped, t, 0.02);
      }
    }

    // ---- voice pools: unitKey -> {module, spec, nodes:[...], paramSig} ----
    const pools = new Map();
    let dx7Presets = null;
    const POOL_SIZE = { pad: 4, bass: 2, melody: 3, solo: 2 };
    async function ensurePool(key, u) {
      let pool = pools.get(key);
      if (pool && pool.module === u.module) { retune(pool, u); return pool; }
      if (pool) retirePool(pool);
      const n = u.drum || u.hold ? (u.pool > 1 ? 2 : 1) : (POOL_SIZE[u.role] || u.pool || 2);
      const nodes = [];
      for (let i = 0; i < n; i++) {
        const node = await mkNode(u.module, key + i);
        const out = ctx.createGain(); out.gain.value = 1; node.connect(out);
        const dry = ctx.createGain(); dry.gain.value = u.dry != null ? u.dry : 1; out.connect(dry); dry.connect(dryBus);
        const rev = ctx.createGain(); rev.gain.value = u.rev || 0; out.connect(rev); rev.connect(revBus);
        const del = ctx.createGain(); del.gain.value = u.del || 0; out.connect(del); del.connect(delBus);
        const pp = ctx.createGain(); pp.gain.value = 0; out.connect(pp); pp.connect(ppBus); // per-EVENT ping-pong send (snarePP)
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
        nodes.push({ node, out, dk, gains: { dry, rev, del, pp }, ppLast: 0, busyUntil: 0, tailUntil: 0 });
      }
      pool = { module: u.module, spec: u, nodes, paramSig: "" };
      pools.set(key, pool);
      retune(pool, u);
      return pool;
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
          // params (cutoff/level/…) or they zipper-click
          if (DISCRETE[k]) p.setValueAtTime(clamped, t);
          else p.setTargetAtTime(clamped, t, 0.01);
        }
        v.gains.dry.gain.setTargetAtTime(u.dry != null ? u.dry : 1, t, 0.01);
        v.gains.rev.gain.setTargetAtTime(u.rev || 0, t, 0.01);
        v.gains.del.gain.setTargetAtTime(u.del || 0, t, 0.01);
      }
    }
    function retirePool(pool) {
      for (const v of pool.nodes) {
        const g = P(v.node, "gate"); if (g) { g.cancelScheduledValues(0); g.value = 0; }
        setTimeout(() => { try { v.node.disconnect(); v.out.disconnect(); } catch (e) {} }, 1500);
      }
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
    const sessionT0 = ctx.currentTime;
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
      const lo = ci * 8, hi = lo + 8;
      const t0 = nextTime;

      const ev = E.buildEvents(one);
      const units = SE.voiceUnits(E, one);
      const m = SE.mapEvents(E, one, ev, { lo, hi, units });
      applyFx(one, t0);

      if (opts.onBar) try { opts.onBar({ serial, ci, nch, when: t0, spb,
        chord: (prg.chords[ci] || {}).name || "", section: sec.name }); } catch (e) {}

      // ---- ONE musical clock per bar ----
      // Every await (pool creation, found-buffer decode) happens BEFORE any
      // event time is computed; then `now` is sampled ONCE and every layer —
      // Faust gates, param sets, found chops/beds, sweeps — derives its time
      // from the same t0 via the same at(). If injection is running late the
      // WHOLE bar shifts by one uniform `late` offset instead of each event
      // clamping against a different re-sampled ctx.currentTime (that per-
      // event clamp across decode awaits was the instrument-drift bug).
      const usedKeys = new Set(m.events.map(e => e.unit));
      for (const key of usedKeys) if (units[key]) await ensurePool(key, units[key]);
      const bufs = {};   // srcId -> AudioBuffer, prefetched
      for (const f of m.found) {
        if (bufs[f.srcId] !== undefined) continue;
        const src = (one.foundSources || []).find(s => s.id === f.srcId);
        bufs[f.srcId] = src ? await ensureBuffer(src) : null;
      }

      const nowT = ctx.currentTime;
      const late = Math.max(0, nowT + 0.03 - t0);
      const at = (b) => t0 + late + (b - lo) * spb;
      const beatAbs = (b) => serial * 8 + (b - lo);   // musical beat since start
      for (const e of m.events) {
        const pool = pools.get(e.unit); if (!pool) continue;
        const tOn = at(e.beat);
        const durSec = e.durB * spb;
        const tOff = e.hold ? tOn + durSec
          : e.drum ? tOn + 0.012
          : tOn + Math.max(0.012, durSec) - 0.008;
        let v = pool.nodes.find(x => x.busyUntil <= tOn) ||
                pool.nodes.reduce((a, b) => (a.busyUntil <= b.busyUntil ? a : b));
        // stealing a voice whose release tail still rings: dip its declick
        // gain across the param/gate jumps (~12ms) so the retrigger is clean
        if (v.tailUntil > tOn && v.dk) {
          const d = v.dk.gain, tA = Math.max(nowT, tOn - 0.009);
          d.cancelScheduledValues(tA);
          d.setValueAtTime(1, tA);
          d.linearRampToValueAtTime(0, Math.max(tA + 0.001, tOn - 0.003));
          d.linearRampToValueAtTime(1, tOn + 0.005);
        }
        for (const [k, val] of Object.entries(e.sets)) {
          // kpluck's song-length flanger evolution: bar-local beats would pin
          // it at ~0 — use absolute session time like csound's `times`
          const vv = k === "flangePos" ? Math.min(1, (tOn - sessionT0) / 164) : val;
          const p = P(v.node, k);
          if (p) p.setValueAtTime(Math.min(p.maxValue, Math.max(p.minValue, vv)), Math.max(nowT, tOn - 0.006));
        }
        if (pool.spec.extGainPerAmp) // DX7 per-note velocity via the external GainNode
          v.out.gain.setValueAtTime(Math.min(1, pool.spec.extGainPerAmp * (e.amp || 0.1)), Math.max(nowT, tOn - 0.006));
        const ppv = e.pp || 0;   // per-event ping-pong send (snarePP snare hits)
        if (v.gains.pp && ppv !== v.ppLast) {
          v.gains.pp.gain.setValueAtTime(ppv, Math.max(nowT, tOn - 0.006));
          v.ppLast = ppv;
        }
        const g = P(v.node, "gate");
        if (g) { g.setValueAtTime(1, tOn); g.setValueAtTime(0, tOff); }
        v.busyUntil = tOff;
        v.tailUntil = tOff + (pool.spec.tail != null ? pool.spec.tail : 1);
        schedLog(e.drum ? "drum:" + e.unit : e.unit, beatAbs(e.beat), tOn);
      }
      // found: chop events in-window; bed re-anchored at bar start of chord 0
      // (buffers prefetched above — scheduling here is synchronous, same clock)
      for (const f of m.found) {
        const buf = bufs[f.srcId];
        if (!buf) continue;
        if (f.type === "chop") {
          found.chop(buf, at(f.beat), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch,
            offset: f.offset, cutoff: f.cutoff, rsend: f.rsend, dsend: f.dsend, ppsend: f.ppsend,
            fade: f.fade, sqRate: f.sqRate, sqDepth: f.sqDepth });
          schedLog("found:chop", beatAbs(f.beat), at(f.beat));
        } else if (ci === 0) {
          found.bed(buf, at(lo), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch,
            stretch: f.stretch, cutoff: f.cutoff });
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

      if (schedBars.length < 2000) schedBars.push({ serial, t0: t0 + late, spb, late: Math.round(late * 1e5) / 1e5 });
      nextTime += 8 * spb;
      ci++; serial++;
      if (ci >= nch) { ci = 0; cycIdx++;
        if (cycIdx >= (secs[secIdx].cycles || 1)) { cycIdx = 0; secIdx = (secIdx + 1) % secs.length; } }
    }

    // ---- load meter + eco (audio clock vs wall clock, EMA like wasm-audio) ----
    const eco = { level: opts.ecoStart != null ? opts.ecoStart : 0, bad: 0, good: 0 };
    let lastWall = 0, lastAudio = 0, loadRatio = 1;
    const meter = setInterval(() => {
      const w = performance.now(), a = ctx.currentTime;
      if (lastWall && ctx.state === "running") {
        const r = (a - lastAudio) / ((w - lastWall) / 1000);
        if (r > 0 && r < 3) loadRatio = loadRatio * 0.7 + r * 0.3;
        if (loadRatio < 0.95) { eco.bad++; eco.good = 0; } else if (loadRatio > 0.995) { eco.good++; eco.bad = 0; }
        if (eco.bad > 8 && eco.level < 3) { eco.level++; eco.bad = 0;
          for (const [k, p] of pools) p.paramSig = ""; // force retune with eco caps
          for (const k of Object.keys(fxCache)) delete fxCache[k]; // re-apply FX with eco thinning
          status("eco mode " + eco.level + " — shedding load"); }
        if (eco.good > 240 && eco.level > 0 && (opts.ecoStart == null || eco.level > opts.ecoStart)) { eco.level--; eco.good = 0;
          for (const [k, p] of pools) p.paramSig = "";
          for (const k of Object.keys(fxCache)) delete fxCache[k];
          status(eco.level ? "eco mode " + eco.level : "full quality restored"); }
        if (opts.onLoad) try { opts.onLoad(loadRatio, eco.level); } catch (e) {}
      }
      lastWall = w; lastAudio = a;
    }, 250);

    let injecting = false;
    const tick = async () => {
      if (abort) return;
      try {
        if (!injecting) {
          injecting = true;
          const now = ctx.currentTime;
          if (nextTime < now) nextTime = now + 0.1; // fell behind (tab sleep) — resync
          while (nextTime < ctx.currentTime + LOOKAHEAD && !abort) await injectChord(getState());
          injecting = false;
        }
      } catch (e) { injecting = false; errors.push(String(e && e.message || e)); console.error("FaustLive tick", e); }
      timer = setTimeout(tick, TICK_MS);
    };
    status(ctx.state === "running" ? "live (faust) — drag the space" : "live (tap again if silent)");
    tick();

    const rmsBuf = new Float32Array(analyser.fftSize);
    const handle = {
      ctx, analyser, errors,
      _sched: schedEvents, _bars: schedBars,   // probe/debug (drift gate)
      loadRatio: () => loadRatio,
      ecoLevel: () => eco.level,
      rms() {
        analyser.getFloatTimeDomainData(rmsBuf);
        let s = 0; for (let i = 0; i < rmsBuf.length; i++) s += rmsBuf[i] * rmsBuf[i];
        return Math.sqrt(s / rmsBuf.length);
      },
      stop() {
        // order matters: kill the scheduler, then hard-mute the MASTER (this
        // silences reverb/delay tails and anything already scheduled ahead —
        // buffer sources included — within ~60ms), then tear down and close.
        abort = true; clearTimeout(timer); clearInterval(meter);
        const tNow = ctx.currentTime;
        try {
          master.gain.cancelScheduledValues(tNow);
          master.gain.setValueAtTime(master.gain.value, tNow);
          master.gain.linearRampToValueAtTime(0, tNow + 0.06);
        } catch (e) {}
        found.stopAll();
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
