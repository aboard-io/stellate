// faust/stem-worker.js — ZERO-STATIC Stage 3: the rolling stem pre-render.
//
// A module Worker (live.js: `new Worker(BASE+"stem-worker.js",{type:"module"})`)
// that renders each bar's CACHED units (SE.stemClass — the heavy synthesis:
// dx7 family, supersaw leads, the heavy-fleet pads, + their insert chains)
// OFFLINE, off the audio thread, as per-LAYER x per-BUS stems. live.js
// schedules the returned buffers as AudioBufferSourceNodes into the existing
// layer collector gains; bass/drums/stabs/sfx/found/vocoder/sampler stay live.
//
// THE PARITY CONTRACT: the walk here mirrors render-core.js renderUnit
// EXACTLY (event->sample math, change ordering, merged-interval block walk,
// global BS grid, @out/@pp pseudo-params, whole-chain insert processing) —
// but PERSISTENT and WINDOWED: one long-lived offline processor pool per unit
// key, strictly sequential bars, so voice tails / LFO phase / filter state /
// chain ring carry across bar boundaries exactly as press's whole-song render
// carries them. faust/stem-parity-test.js gates this against render-core
// (near-bit: RMS correlation > 0.999, max |delta| < 1e-4; byte-equality
// reported when achieved). The ONE knowing divergence: a bar-initial event's
// 1-block pre-roll (s-BS) can fall before the bar boundary — the proc still
// COMPUTES that block (state parity) but its output lands in an
// already-shipped bar and is discarded; the voice is pre-gate there, so the
// dropped samples are ~0 (see PREROLL below).
//
// Statefulness is legal because faustwasm's FaustOfflineProcessor.render()
// wraps each call in fDSPCode.start()/stop() and those ONLY flip fProcessing
// (node_modules/@grame/faustwasm/dist/esm/index.js:3159-3163 —
// `start(){this.fProcessing=true}` / `stop(){this.fProcessing=false}`);
// no state is reset between render() calls, so a processor renders a
// continuous timeline across as many calls as we like.
//
// UMD + dynamic-import guards (render-core's pattern): require()-able in node
// for the CI parity test (everything env-injected — NO fs/ffmpeg/AudioContext
// here), and self-booting when loaded as a Worker entry (the glue at the
// bottom dynamic-imports csd-engine/state-engine/render-core/faustwasm and
// pumps messages strictly sequentially).
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustStemWorker = factory();
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const SPARSE_FLOOR = 1e-4;   // -80 dBFS RMS: channels quieter than this are omitted

  // makeStemRenderer(env) -> { renderBar(msg), reset() }
  //
  //   env.E / env.SE      — csd-engine / state-engine (buildEvents + mapEvents
  //                         run HERE, off-thread: the message carries the same
  //                         one-bar state snapshot injectChord built, and both
  //                         are deterministic, so worker events == live events)
  //   env.mergeIvals      — render-core's interval merge (shared verbatim)
  //   env.mkProc(module)  — Promise of a faustwasm OFFLINE processor; the only
  //                         surface used is render(ins,len) + setParamValue
  //   env.rootOf(module)  — dsp root name for "/root/param" addressing
  //   env.SR / env.BS     — 44100 / 64 (BS is the GLOBAL block grid — bar
  //                         boundaries are BS multiples so block walks align
  //                         with press across bar seams)
  //   env.dx7Presets      — preset name -> {params} (cartridge bank)
  //
  // renderBar msg: { serial, oneState, unitKeys, layerOf, lo, hi, spb,
  //                  startSample, lenSamples, barStartSec }
  //   startSample/lenSamples: BS-aligned absolute sample window (live.js
  //   mirrors the same accumulation, so scheduling tiles the sample grid
  //   exactly — zero gap/overlap between consecutive bars).
  //   barStartSec: the FLOAT musical time of msg.lo (event placement uses
  //   floor((barStartSec + (beat-lo)*spb)*SR) — press's floor(beat*spb*SR)
  //   to within float accumulation).
  // -> { stems: [{layer, bus, channels: [Float32Array,...]}], failedModules }
  // THE INGEST/RENDER PIPELINE (why ingest and renderWindow are separate):
  // press pre-sets an event's params one block EARLY (changes at s-BS, the
  // declick-safe lead-in) — so a note landing just after a bar boundary
  // reaches back into the PREVIOUS bar's final block. A strict
  // bar-at-a-time walk can't know that yet; applying the freq step one
  // block late leaves a permanent oscillator-phase offset in any ringing
  // voice (measured: pad correlation 0.94 vs press). So the renderer
  // INGESTS bar N+1's events into the persistent proc queues BEFORE
  // rendering window N — the change/interval sets at render time are then
  // exactly press's global walk restricted to the window. live.js holds a
  // one-bar pipeline (ship N on ingest of N+1) and sends a "flush" for
  // long bars whose next injection would arrive after the deadline (that
  // flush renders without the anticipations — the divergence returns for
  // that boundary only, one param-set one block late, and only on bars too
  // long for the pipeline).
  function makeStemRenderer(env) {
    const { E, SE, mergeIvals, mkProc, rootOf, SR, BS } = env;
    const dx7Presets = env.dx7Presets || {};
    const units = new Map();   // unitKey -> persistent US (procs + chain + carried state)

    async function ensureUnit(key, u, layer, bornAt) {
      let us = units.get(key);
      if (us && us.module !== u.module) { units.delete(key); us = null; }   // module swap: cold rebuild (live retires the pool the same way)
      if (!us) {
        // press pool math (render-core): P = min(u.pool||1, poolCap)
        const P = Math.min(u.pool || 1, u.poolCap != null ? u.poolCap : Infinity);
        const procs = [];
        for (let i = 0; i < P; i++) {
          const proc = await mkProc(u.module);
          const R = "/" + rootOf(u.module) + "/";
          procs.push({ proc, R, pending: [], ivals: [], busyUntil: -1, lastOff: null, curOut: 1, curPP: 0 });
        }
        us = { module: u.module, layer, u, procs, paramSig: null, dx7Sig: null,
               chain: null, chainSig: null, chainBarSec: null, staleBars: 0 };
        units.set(key, us);
      }
      us.layer = layer; us.u = u; us.staleBars = 0;
      // (re)apply static params — at creation, then only when they move (a
      // journey glide); re-setting identical values would be a no-op but the
      // sig guard keeps the offline timeline byte-identical to press's
      // set-once for static states.
      const psig = JSON.stringify(u.params || {});
      if (us.paramSig !== psig) {
        us.paramSig = psig;
        for (const v of us.procs)
          for (const [k, val] of Object.entries(u.params || {})) v.proc.setParamValue(v.R + k, val);
      }
      const dxParams = u.dx7Params || (u.dx7Preset && dx7Presets[u.dx7Preset] && dx7Presets[u.dx7Preset].params);
      const dsig = dxParams ? JSON.stringify(dxParams) : null;
      if (dxParams && us.dx7Sig !== dsig) {
        us.dx7Sig = dsig;
        for (const v of us.procs)
          for (const [sfx, val] of Object.entries(dxParams))
            v.proc.setParamValue(sfx.slice(0, 4) === "/DX7" ? sfx : "/DX7" + sfx, val);
      }
      // insert chain: persistent procs; type change rebuilds cold, param
      // change re-sets (press analog: one chain per whole-song render)
      const list = u.inserts || [];
      const sig = list.map((i) => i.type).join(">");
      if (sig !== us.chainSig) {
        us.chain = [];
        for (const eff of list) {
          const proc = await mkProc(eff.module);
          us.chain.push({ proc, R: "/" + rootOf(eff.module) + "/", eff });
        }
        us.chainSig = sig; us.chainParamSig = null;
      }
      const cpsig = JSON.stringify(list);
      if (us.chain && us.chainParamSig !== cpsig) {
        us.chainParamSig = cpsig;
        for (let i = 0; i < list.length; i++) {
          const b = us.chain[i]; if (!b) continue;
          b.eff = list[i];
          for (const [k, pv] of Object.entries(b.eff.params || {})) b.proc.setParamValue(b.R + k, pv);
        }
      }
      return us;
    }

    // render ONE unit's slice of the bar into its layer's buses — the
    // render-core renderUnit walk, windowed to [barBase, barEnd) with carried
    // per-voice pending changes + active intervals.
    function renderUnitBar(us, events, buses, W) {
      const { barBase, barEnd, lo, spb } = W;
      const u = us.u;
      events = events.slice().sort((a, b) => a.beat - b.beat);
      // supersaw release tail must survive the gate-off (render-core verbatim)
      let tail = u.tail || 1;
      if (u.module === "supersaw") tail = Math.max(tail, ((u.params || {}).release || 0.3) + 0.3);
      const relTail = Math.ceil(tail * SR);
      for (const e of events) {
        // event -> ABSOLUTE sample, press's floor(beat*spb*SR) via the bar's
        // float musical time (max(BS,·) guards the s-BS pre-roll at t=0)
        const s = Math.max(BS, Math.floor((W.barStartSec + (e.beat - lo) * spb) * SR));
        const durS = e.durB * spb;
        const offS = e.hold ? s + Math.floor(durS * SR)
          : e.drum ? s + Math.floor(0.012 * SR)
          : s + Math.floor((Math.max(0.012, durS) - 0.008) * SR);
        // allocation: first free voice, else the one free soonest — busyUntil
        // persists across bars, so allocation matches press's whole-song walk.
        // (mono-legato units are classed LIVE — a cross-bar legato join can't
        // withdraw an already-rendered gate-off; stemClass guarantees it.)
        const v = us.procs.find((p) => p.busyUntil <= s) ||
                  us.procs.reduce((a, b) => (a.busyUntil <= b.busyUntil ? a : b));
        for (const [k, val] of Object.entries(e.sets)) v.pending.push([s - BS, v.R + k, val]);
        if (u.extGainPerAmp) v.pending.push([s - BS, "@out", Math.min(1, u.extGainPerAmp * (e.amp || 0.1))]);
        v.pending.push([s - BS, "@pp", e.pp || 0]);
        v.pending.push([s, v.R + "gate", 1]);
        v.pending.push([offS, v.R + "gate", 0]);
        v.ivals.push([s - BS, offS + relTail]);
        v.busyUntil = Math.max(v.busyUntil, offS);
      }
      const LEN = barEnd - barBase;
      const hasIns = us.chain && us.chain.length;
      const ubuf = hasIns ? new Float32Array(LEN) : null;
      let rendered = 0;
      for (const v of us.procs) {
        if (!v.pending.length && !v.ivals.length) continue;
        v.pending.sort((a, b) => a[0] - b[0]);   // stable (ES2019): equal-position order == press's push order
        const segs = mergeIvals(v.ivals);
        const renderSegs = [], carry = [];
        for (const [a, b] of segs) {
          if (a >= barEnd) { carry.push([a, b]); continue; }
          renderSegs.push([a, Math.min(b, barEnd)]);
          if (b > barEnd) carry.push([barEnd, b]);
        }
        v.ivals = carry;
        const ch = v.pending;
        let ci = 0;
        const applyChange = (c) => {
          if (c[1] === "@out") v.curOut = c[2];
          else if (c[1] === "@pp") v.curPP = c[2];
          else v.proc.setParamValue(c[1], c[2]);
        };
        for (const [a, b] of renderSegs) {
          const from = Math.max(0, Math.floor(a / BS) * BS), to = Math.min(barEnd, b);
          while (ci < ch.length && ch[ci][0] < from) { applyChange(ch[ci]); ci++; }
          for (let s2 = from; s2 < to; s2 += BS) {
            const len = Math.min(BS, barEnd - s2);
            while (ci < ch.length && ch[ci][0] < s2 + len) { applyChange(ch[ci]); ci++; }
            const oo = v.proc.render([], len);
            const o = oo[0];
            // PREROLL: idx0 < 0 happens only for a bar-initial event's s-BS
            // pre-roll block reaching into the ALREADY-SHIPPED previous bar —
            // the proc computes it (state parity with press) but those first
            // -idx0 samples have nowhere to go. The voice is pre-gate there
            // (a ringing tail would have carried the interval into the
            // previous bar's render instead), so what is dropped is ~0.
            const idx0 = s2 - barBase;
            if (ubuf) {
              for (let i = Math.max(0, -idx0); i < len; i++) ubuf[idx0 + i] += o[i] * v.curOut;
            } else if (u.stereo && buses.wL) {
              const o1 = oo[1] || o;
              const dg = (u.dry != null ? u.dry : 1) * v.curOut, rg = (u.rev || 0) * v.curOut,
                    lg = (u.del || 0) * v.curOut, pg = v.curPP * v.curOut;
              for (let i = Math.max(0, -idx0); i < len; i++) {
                const l = o[i], r = o1[i], mono = (l + r) * 0.5, j = idx0 + i;
                buses.wL[j] += l * dg; buses.wR[j] += r * dg;
                buses.rev[j] += mono * rg; buses.del[j] += mono * lg;
                if (pg) buses.pp[j] += mono * pg;
              }
            } else {
              const dg = (u.dry != null ? u.dry : 1) * v.curOut, rg = (u.rev || 0) * v.curOut,
                    lg = (u.del || 0) * v.curOut, pg = v.curPP * v.curOut;
              for (let i = Math.max(0, -idx0); i < len; i++) {
                const x = o[i], j = idx0 + i;
                buses.dry[j] += x * dg; buses.rev[j] += x * rg; buses.del[j] += x * lg;
                if (pg) buses.pp[j] += x * pg;
              }
            }
            rendered += len;
          }
        }
        v.pending = ch.slice(ci);   // changes beyond this bar's rendered blocks carry over
      }
      if (ubuf) {
        // whole-bar chain processing — press renders the chain over EVERY
        // block of the song (LFO phase + tails continuous); persistent chain
        // procs + full-bar walks reproduce that exactly.
        for (const b of us.chain) {
          if (b.eff.barSec && us.chainBarSec !== 4 * spb) b.proc.setParamValue(b.R + "barSec", 4 * spb);
          for (let s2 = 0; s2 < LEN; s2 += BS) {
            const len = Math.min(BS, LEN - s2);
            const o = b.proc.render([ubuf.subarray(s2, s2 + len)], len)[0];
            for (let i = 0; i < len; i++) ubuf[s2 + i] = o[i];
          }
        }
        us.chainBarSec = 4 * spb;
        const dg = u.dry != null ? u.dry : 1, rg = u.rev || 0, lg = u.del || 0;
        for (let i = 0; i < LEN; i++) {
          const x = ubuf[i];
          buses.dry[i] += x * dg; buses.rev[i] += x * rg; buses.del[i] += x * lg;
        }
      }
      return rendered;
    }

    async function renderBar(msg) {
      const one = msg.oneState;
      const ev = E.buildEvents(one);
      const uTable = SE.voiceUnits(E, one);
      const m = SE.mapEvents(E, one, ev, { lo: msg.lo, hi: msg.hi, units: uTable });
      const barBase = msg.startSample, LEN = msg.lenSamples, barEnd = barBase + LEN;
      const W = { barBase, barEnd, lo: msg.lo, spb: msg.spb, barStartSec: msg.barStartSec };
      const wantKeys = msg.unitKeys || [];
      const byUnit = {};
      for (const e of m.events) if (wantKeys.indexOf(e.unit) >= 0) (byUnit[e.unit] = byUnit[e.unit] || []).push(e);
      // per-layer bar buses (lazily; wL/wR only when a stereo unit lands there)
      const layerBuses = new Map();
      const busFor = (layer, stereo) => {
        let b = layerBuses.get(layer);
        if (!b) { b = { dry: new Float32Array(LEN), rev: new Float32Array(LEN), del: new Float32Array(LEN), pp: new Float32Array(LEN), wL: null, wR: null }; layerBuses.set(layer, b); }
        if (stereo && !b.wL) { b.wL = new Float32Array(LEN); b.wR = new Float32Array(LEN); }
        return b;
      };
      const failedModules = [];
      for (const key of wantKeys) {
        const u = uTable[key];
        if (!u || u.sampler) continue;
        const layer = (msg.layerOf && msg.layerOf[key]) || "fx";
        let us;
        try { us = await ensureUnit(key, u, layer); }
        catch (err) {   // e.g. a dist/ wasm this deployment lacks: report, class LIVE upstream
          failedModules.push({ key, module: u.module, error: String(err && err.message || err) });
          continue;
        }
        renderUnitBar(us, byUnit[key] || [], busFor(layer, !!u.stereo), W);
      }
      // STALE units (keys the current state no longer caches): flush their
      // carried tails + let insert chains ring out for 2 bars, then drop —
      // a genre change must not cut a reverb-bound release mid-ring.
      for (const [key, us] of units) {
        if (wantKeys.indexOf(key) >= 0) continue;
        const hasTail = us.procs.some((v) => v.ivals.length || v.pending.length);
        us.staleBars = (us.staleBars || 0) + 1;
        if (hasTail || (us.chain && us.chain.length && us.staleBars <= 2)) {
          renderUnitBar(us, [], busFor(us.layer, !!(us.u && us.u.stereo)), W);
        } else if (us.staleBars > 2) units.delete(key);
      }
      // package: per layer x per bus, SPARSE — sub-noise-floor channels omitted
      const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
      const stems = [];
      for (const [layer, b] of layerBuses) {
        if (b.wL) {   // stereo dry: L = dry+wL, R = dry+wR (press's fx_bus input math)
          const L = b.wL, R2 = b.wR;
          for (let i = 0; i < LEN; i++) { L[i] += b.dry[i]; R2[i] += b.dry[i]; }
          if (rms(L) >= SPARSE_FLOOR || rms(R2) >= SPARSE_FLOOR) stems.push({ layer, bus: "dry", channels: [L, R2] });
        } else if (rms(b.dry) >= SPARSE_FLOOR) stems.push({ layer, bus: "dry", channels: [b.dry] });
        for (const bus of ["rev", "del", "pp"])
          if (rms(b[bus]) >= SPARSE_FLOOR) stems.push({ layer, bus, channels: [b[bus]] });
      }
      return { stems, failedModules };
    }

    return { renderBar, reset: () => units.clear(), unitCount: () => units.size };
  }

  return { makeStemRenderer, SPARSE_FLOOR };
});

// ---------------------------------------------------------------- worker glue
// Runs ONLY as a Worker entry (module Worker from live.js). Loads the score
// brain + state engine + render-core (each a UMD side-effect on globalThis)
// and faustwasm's ESM dist, then pumps messages STRICTLY SEQUENTIALLY — bar
// N+1 never starts before bar N finishes, which is what lets processor state
// carry voice tails/LFO phase across bar boundaries.
if (typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope) {
  (function () {
    "use strict";
    const BASE = new URL(".", self.location.href).href;
    const SR = 44100, BS = 64;
    let R = null, minSerial = -1, ready = false;
    const q = [];
    let pumping = false;

    async function initDeps() {
      await import(BASE + "../csd-engine.js");     // -> globalThis.CsdEngine
      await import(BASE + "state-engine.js");      // -> globalThis.FaustStateEngine
      await import(BASE + "render-core.js");       // -> globalThis.FaustRenderCore (mergeIvals)
      const fw = await import(BASE + "node_modules/@grame/faustwasm/dist/esm/index.js");
      const { FaustWasmInstantiator, FaustMonoDspGenerator } = fw;
      const gen = new FaustMonoDspGenerator();
      const factories = {};   // module -> Promise<factory> (fetch+compile once)
      const resolved = {};    // module -> factory (for rootOf)
      const factory = (mod) => factories[mod] || (factories[mod] =
        FaustWasmInstantiator.loadDSPFactory(BASE + `dist/${mod}-module.wasm`, BASE + `dist/${mod}-meta.json`)
          .then((f) => { if (!f) throw new Error("no factory for " + mod); resolved[mod] = f; return f; }));
      const mkProc = async (mod) => gen.createOfflineProcessor(SR, BS, await factory(mod));
      const rootOf = (mod) => JSON.parse(resolved[mod].json).name;
      let dx7Presets = {};
      try { dx7Presets = await (await fetch(BASE + "dx7-presets.json")).json(); } catch (e) {}
      R = self.FaustStemWorker.makeStemRenderer({
        E: self.CsdEngine, SE: self.FaustStateEngine,
        mergeIvals: self.FaustRenderCore.mergeIvals,
        mkProc, rootOf, SR, BS, dx7Presets,
      });
    }

    async function handleMsg(msg) {
      if (!msg || !msg.type) return;
      if (msg.type === "init") {
        try { await initDeps(); ready = true; self.postMessage({ type: "ready" }); }
        catch (err) { self.postMessage({ type: "initfail", error: String(err && err.message || err) }); }
        return;
      }
      if (msg.type === "ping") { self.postMessage({ type: "pong", t: msg.t }); return; }
      if (msg.type === "reset") {
        // skip-and-reset: drop all processor state COLD (main sends this at a
        // section boundary) and refuse any still-queued stale bars.
        if (R) R.reset();
        if (msg.fromSerial != null) minSerial = msg.fromSerial;
        self.postMessage({ type: "resetdone", fromSerial: minSerial });
        return;
      }
      if (msg.type === "bar") {
        if (!ready || !R) { self.postMessage({ type: "barfail", serial: msg.serial, error: "not ready" }); return; }
        if (msg.serial < minSerial) { self.postMessage({ type: "skipped", serial: msg.serial }); return; }
        const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        try {
          const out = await R.renderBar(msg);
          const renderMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
          const transfer = [];
          for (const st of out.stems) for (const c of st.channels) transfer.push(c.buffer);
          self.postMessage({ type: "bar", serial: msg.serial, startSample: msg.startSample,
            lenSamples: msg.lenSamples, stems: out.stems, failedModules: out.failedModules,
            renderMs: Math.round(renderMs * 10) / 10, queued: q.length }, transfer);
        } catch (err) {
          self.postMessage({ type: "barfail", serial: msg.serial, error: String(err && err.message || err) });
        }
      }
    }

    async function pump() {
      if (pumping) return;
      pumping = true;
      try { while (q.length) await handleMsg(q.shift()); }
      finally { pumping = false; }
    }
    self.onmessage = (e) => { q.push(e.data); pump(); };
  })();
}
