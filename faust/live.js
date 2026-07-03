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
    let curBarSec = 2;   // seconds per 4-beat bar; injectChord updates from bpm
    const POOL_SIZE = { pad: 4, bass: 2, melody: 3, solo: 2 };
    async function ensurePool(key, u) {
      let pool = pools.get(key);
      if (pool && pool.module === u.module) { await ensureInserts(key, pool, u); retune(pool, u); return pool; }
      if (pool) retirePool(pool);
      const n = u.drum || u.hold ? (u.pool > 1 ? 2 : 1) : (POOL_SIZE[u.role] || u.pool || 2);
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
        nodes.push({ node, out, dk, gains: { dry, rev, del, pp }, ppLast: 0, busyUntil: 0, tailUntil: 0 });
      }
      pool = { module: u.module, spec: u, nodes, paramSig: "" };
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
          setTimeout(() => { try { old.tail.disconnect(); for (const b of old.built) b.node.disconnect(); } catch (e) {} }, 400);
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
          if (initial) p.value = vv; else p.setTargetAtTime(vv, t, 0.02);
        }
        if (b.eff.barSec) {   // tempo-synced sweep: engine owns barSec (bpm glides too)
          const p = P(b.node, "barSec");
          if (p) { const vv = Math.min(p.maxValue, Math.max(p.minValue, curBarSec));
            if (initial) p.value = vv; else p.setTargetAtTime(vv, t, 0.05); }
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
      if (pool.ins) setTimeout(() => { try {
        pool.ins.pre.disconnect(); pool.ins.post.disconnect();
        if (pool.ins.chain) { pool.ins.chain.tail.disconnect(); for (const b of pool.ins.chain.built) b.node.disconnect(); }
        for (const g of Object.values(pool.ins.gains)) g.disconnect();
      } catch (e) {} }, 1500);
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
      curBarSec = 4 * spb;   // insert filtersweep LFOs sync to this (bpm glides too)
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
      for (const key of usedKeys) {
        const u = units[key]; if (!u) continue;
        if (u.sampler) await ensureSamplerBufs(u, one);   // native path: buffers, not pools
        else await ensurePool(key, u);
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
      const beatAbs = (b) => serial * 8 + (b - lo);   // musical beat since start
      for (const e of m.events) {
        const uSpec = units[e.unit];
        if (uSpec && uSpec.sampler) {   // SAMPLER note: native buffer playback
          const player = samplerOf(e.unit);
          const midi = SP ? SP.midiOfFreq(e.sets.freq) : 0;
          const z = SP ? SP.zoneFor(uSpec.sampler.zones, midi) : null;
          const buf = z && samplerBufs[z.srcId];
          if (player && buf) {
            const zsr = uSpec.sampler.sr || 44100;
            player.note(buf, at(e.beat), { rate: SP.rateFor(z, midi), durSec: e.durB * spb,
              gain: (uSpec.lvl || 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
              atk: uSpec.sampler.atk, rel: uSpec.sampler.rel,
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
        layers.get(LAYER_OF_UNIT(e.unit)).lastBar = serial;
        schedLog(e.drum ? "drum:" + e.unit : e.unit, beatAbs(e.beat), tOn);
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
            fade: f.fade, sqRate: f.sqRate, sqDepth: f.sqDepth });
          layers.get(lane).lastBar = serial;
          schedLog("found:chop", beatAbs(f.beat), at(f.beat));
        } else if (ci === 0) {
          foundBeds.bed(buf, at(lo), { durSec: f.durB * spb, amp: f.amp, pitch: f.pitch,
            stretch: f.stretch, cutoff: f.cutoff });
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
        // never let a browser/OS suspension stick while we're supposed to play
        if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
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
    status(ctx.state === "running" ? "live (faust) — drag the space" : "live (tap again if silent)");
    tick();
    // prewarm the insert-module processor registrations while load is light:
    // a mid-run insert TYPE swap otherwise pays the audio-thread addModule/
    // wasm setup right then (measured: a ~0.95 load blip 2s after the swap).
    // The prewarmed nodes are never connected — zero render cost — and are
    // dropped immediately; later mkNodes of the same module just instantiate.
    setTimeout(() => { if (!abort)
      for (const m of ["insert_distort", "insert_phaser", "insert_chorus", "insert_filtersweep"])
        mkNode(m, "prewarm:" + m).catch(() => {});
    }, 1500);

    const rmsBuf = new Float32Array(analyser.fftSize);
    const handle = {
      ctx, analyser, errors,
      _sched: schedEvents, _bars: schedBars,   // probe/debug (drift gate)
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
