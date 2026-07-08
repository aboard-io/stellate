// faust/stream-renderer.js — the persistent, stateful, FULL-MIX stream renderer.
//
// Phase 1-2 of the live-engine rebuild (see the plan): one long-lived, stateful
// renderer per active engine `state` that emits a CONTINUOUS stereo PCM stream in
// consecutive chord-bar CHUNKS, carrying ALL DSP state (oscillator phase, filter,
// reverb/delay/comp tails) across chunk boundaries — so the stream has NO internal
// seams. Later (Phase 3) this same core runs in a browser Worker feeding a
// SharedArrayBuffer ring; here it is a clean, environment-agnostic node module,
// gated byte/near-bit against the offline reference faust/press.js by
// faust/segment-parity-test.js.
//
// WHAT IT REPLICATES: the full-mix assembly of press.js assemble()
//   found (FP.mixPCM) + sampler (SP.mixPCM) + every Faust voice unit (incl. the
//   MONO-LEGATO modeld/tb303/synclead, R1) into ONE press-style bus set
//   {dry,rev,del,pp,wL,wR}; optional reverb-color (rev_bleed + reverb_<color>);
//   the fx_bus master over [dryL,dryR,rev,del,pp,0] with the mcut sweep
//   automation; optional master_mb — but done WINDOWED, over persistent offline
//   processors that carry state across chunks.
//
// HOW PARITY IS ACHIEVED (an important divergence from the plan's letter):
// the LIVE per-bar walk (seed+serial*7919, collapsed sections) is a DIFFERENT
// event fabric than press's whole-song buildEvents — empirically 734 vs 717
// events for citypop_s7 — so a renderer driven by that walk can NEVER be
// sample-parity with press. To gate the fx/reverb/master CONTINUITY against the
// press gold standard, this core is driven from press's OWN whole-song schedule
// (SE.buildSchedule): open() ingests EVERY unit event up front at ABSOLUTE sample
// positions (render-core's exact event math, including mono-legato), bakes found/
// sampler into full-length accumulators (byte-exact FP/SP.mixPCM), then renderChunk
// emits consecutive windows through the persistent procs. Because all events are
// ingested before any window renders, a downbeat's one-block (s-BS) param
// anticipation lands in the PREVIOUS window's final block naturally — there is NO
// preroll divergence (unlike stem-worker's per-bar ingest), so non-legato states
// come out BYTE-equal to press. WHO produces the per-chunk events is the caller's
// concern; the live conductor (Phase 5) will feed the per-bar walk instead — the
// windowed-render + persistent-fx machinery proven here is identical either way.
//
// Statefulness is legal because faustwasm's FaustOfflineProcessor.render() only
// flips fProcessing in start()/stop() and never resets state between calls
// (node_modules/@grame/faustwasm/dist/esm/index.js) — a processor renders a
// continuous timeline across as many render() calls as we make.
//
// UMD + env-injection (render-core/stem-worker style): require()-able in node for
// the CI gate (NO fs/ffmpeg/AudioContext here — everything arrives via env), and
// loadable in a Worker later.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustStreamRenderer = factory();
})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : globalThis), function () {
  "use strict";

  // makeStreamEngine(env) -> { open, renderChunk, close }
  //
  //   env.E / env.SE      — csd-engine / state-engine (buildSchedule/fxParams/
  //                         reverbColor/masterMb — the same maps press drives)
  //   env.FP / env.SP     — found-player / sampler (mixPCM — the native PCM layer)
  //   env.mergeIvals      — render-core's interval merge (shared verbatim)
  //   env.mkProc(module)  — Promise of a faustwasm OFFLINE processor (render+setParamValue)
  //   env.rootOf(module)  — dsp root name for "/root/param" addressing
  //   env.SR / env.BS     — 44100 / 64 (BS is the GLOBAL block grid — chunk
  //                         boundaries are BS multiples so block walks align with press)
  //   env.dx7Presets      — preset name -> {params} cartridge bank (or {})
  function makeStreamEngine(env) {
    const { E, SE, FP, SP, mergeIvals, mkProc, rootOf, SR, BS } = env;
    const dx7Presets = env.dx7Presets || {};

    // ============================================================ per-unit fleet
    // ensureUnit — a persistent processor pool + insert chain per unit key, with
    // its static params applied once (lifted from stem-worker.ensureUnit, minus
    // the per-layer/stale bookkeeping: one state, all units live for its lifetime).
    async function ensureUnit(key, u) {
      const P = Math.min(u.pool || 1, u.poolCap != null ? u.poolCap : Infinity);
      const procs = [];
      for (let i = 0; i < P; i++) {
        const proc = await mkProc(u.module);
        const R = "/" + rootOf(u.module) + "/";
        for (const [k, v] of Object.entries(u.params || {})) proc.setParamValue(R + k, v);
        const dxParams = u.dx7Params || (u.dx7Preset && dx7Presets[u.dx7Preset] && dx7Presets[u.dx7Preset].params);
        if (dxParams)
          for (const [sfx, v] of Object.entries(dxParams))
            proc.setParamValue(sfx.slice(0, 4) === "/DX7" ? sfx : "/DX7" + sfx, v);
        procs.push({ proc, R, pending: [], ivals: [], busyUntil: -1, lastOff: null, curOut: 1, curPP: 0 });
      }
      const chain = [];
      for (const eff of (u.inserts || [])) {
        const proc = await mkProc(eff.module);
        const R = "/" + rootOf(eff.module) + "/";
        for (const [k, pv] of Object.entries(eff.params || {})) proc.setParamValue(R + k, pv);
        chain.push({ proc, R, eff });
      }
      return { module: u.module, u, procs, chain, chainBarSet: false };
    }

    // INGEST all of a unit's events into its persistent per-voice change/interval
    // queues at ABSOLUTE sample positions — render-core.renderUnit's event loop
    // VERBATIM (mono-legato lastOff/withdraw included, R1), so the queued state
    // is press's continuous global walk. Called ONCE per unit at open(); the
    // windowed renderer below then consumes the queues chunk by chunk. Because
    // everything is queued before any window renders, a downbeat's s-BS
    // anticipation is already in the previous window's block range — no preroll.
    // `origin` (LIVE mode, Phase 5a): {beatLo, baseSample} maps a bar's window
    // beats onto absolute sample positions `baseSample + (beat-beatLo)*spb*SR`.
    // Default (whole-song open): beatLo=0, baseSample=0 → the ORIGINAL arithmetic
    // `Math.max(BS, floor(e.beat*spb*SR))` exactly, so parity is untouched.
    function ingestUnitEvents(us, events, spb, TOTAL, origin) {
      const u = us.u;
      const beatLo = origin ? origin.beatLo : 0;
      const baseSample = origin ? origin.baseSample : 0;
      events = events.slice().sort((a, b) => a.beat - b.beat);
      let tail = u.tail || 1;
      if (u.module === "supersaw") tail = Math.max(tail, ((u.params || {}).release || 0.3) + 0.3);
      const relTail = Math.ceil(tail * SR);
      const legatoWin = u.mono ? Math.ceil((u.legatoSec != null ? u.legatoSec : 0.03) * SR) : 0;
      for (const e of events) {
        const s = Math.max(BS, baseSample + Math.floor((e.beat - beatLo) * spb * SR));
        const durS = e.durB * spb;
        const offS = e.hold ? s + Math.floor(durS * SR)
          : e.drum ? s + Math.floor(0.012 * SR)
          : s + Math.floor((Math.max(0.012, durS) - 0.008) * SR);
        let v, legato = false;
        if (u.mono) {
          v = us.procs[0];
          legato = !!(v.lastOff && s <= v.busyUntil + legatoWin);
        } else {
          v = us.procs.find((p) => p.busyUntil <= s) ||
              us.procs.reduce((a, b) => (a.busyUntil <= b.busyUntil ? a : b));
        }
        for (const [k, val] of Object.entries(e.sets)) v.pending.push([s - BS, v.R + k, val]);
        if (u.extGainPerAmp) v.pending.push([s - BS, "@out", Math.min(1, u.extGainPerAmp * (e.amp || 0.1))]);
        v.pending.push([s - BS, "@pp", e.pp || 0]);
        if (legato) {
          const ix = v.pending.indexOf(v.lastOff);
          if (ix >= 0) v.pending.splice(ix, 1);
        } else {
          v.pending.push([s, v.R + "gate", 1]);
        }
        const off = [offS, v.R + "gate", 0];
        v.pending.push(off);
        if (u.mono) v.lastOff = off;
        v.ivals.push([s - BS, Math.min(TOTAL, off[0] + relTail)]);
        v.busyUntil = Math.max(v.busyUntil, off[0]);
      }
    }

    // RENDER one unit's queued window [barBase, barEnd) into the combined bus set
    // — stem-worker.renderUnitWindow VERBATIM (proven byte-compatible with
    // render-core for BS-aligned windows by faust/stem-parity-test.js), only with
    // the single combined {dry,rev,del,pp,wL,wR} bus set instead of per-layer stems.
    function renderUnitWindow(us, buses, barBase, barEnd, spb) {
      const u = us.u;
      const LEN = barEnd - barBase;
      const hasIns = us.chain && us.chain.length;
      const ubuf = hasIns ? new Float32Array(LEN) : null;
      for (const v of us.procs) {
        if (!v.pending.length && !v.ivals.length) continue;
        v.pending.sort((a, b) => a[0] - b[0]);   // stable (ES2019): equal-pos order == push order
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
            const oo = v.proc.render(us.vocIns ? [us.vocIns(s2, len)] : [], len);
            const o = oo[0];
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
          }
        }
        v.pending = ch.slice(ci);
      }
      if (ubuf) {
        for (const b of us.chain) {
          if (b.eff.barSec && !us.chainBarSet) b.proc.setParamValue(b.R + "barSec", 4 * spb);
          for (let s2 = 0; s2 < LEN; s2 += BS) {
            const len = Math.min(BS, LEN - s2);
            const o = b.proc.render([ubuf.subarray(s2, s2 + len)], len)[0];
            for (let i = 0; i < len; i++) ubuf[s2 + i] = o[i];
          }
        }
        us.chainBarSet = true;
        const dg = u.dry != null ? u.dry : 1, rg = u.rev || 0, lg = u.del || 0;
        for (let i = 0; i < LEN; i++) {
          const x = ubuf[i];
          buses.dry[i] += x * dg; buses.rev[i] += x * rg; buses.del[i] += x * lg;
        }
      }
    }

    // ============================================================ the stream
    let ST = null;   // the open stream's persistent state (one at a time)
    const LIVE_TOTAL = 0x7fffffff;   // ~13.5h sentinel for live-mode interval clamps

    async function open(state, io) {
      io = io || {};
      const buffers = io.buffers || {};
      const opts = io.opts || {};
      const sched = SE.buildSchedule(E, state);
      const spb = sched.spb;
      let totalSec = sched.totalBeats * spb;
      if (opts.dur) totalSec = Math.min(totalSec, opts.dur);
      const TOTAL = Math.ceil(totalSec * SR);

      // ---- speech input for a vocoder unit (TOTAL-long looped, like press) ----
      const speech = io.speech || null;

      // ---- group events per unit in press's byUnit order ----
      const byUnit = {};
      for (const e of sched.events) {
        if (e.beat * spb >= totalSec) continue;
        (byUnit[e.unit] = byUnit[e.unit] || []).push(e);
      }

      // ---- found layer: bake a full-length accumulator (found is press's FIRST
      // contribution, so summed against 0 — byte-exact FP.mixPCM). ----
      const foundAcc = { dry: new Float32Array(TOTAL), rev: new Float32Array(TOTAL),
                         del: new Float32Array(TOTAL), pp: new Float32Array(TOTAL) };
      const foundSec = sched.found
        .map((f) => ({ ...f, tSec: f.beat * spb, durSec: f.durB * spb }))
        .filter((f) => f.tSec < totalSec && buffers[f.srcId]);
      FP.mixPCM(foundSec, buffers, SR, foundAcc);

      // ---- per unit, in press's byUnit order: sampler -> bake its OWN full-length
      // accumulator (SP.mixPCM against 0, byte-exact for a single unit); faust ->
      // persistent procs + ingest. unitOrder records the EXACT byUnit order so the
      // window accumulates found, then each unit in order (sampler-slice or faust
      // render) — matching press's per-sample float sum (a reorder is a 1-ulp diff
      // the fx comp/pump amplifies past the gate; proven on house/newjack). ----
      const unitOrder = [];
      const samplerUnits = new Map();
      const units = new Map();
      for (const [key, events] of Object.entries(byUnit)) {
        const u = sched.units[key];
        if (!u) continue;
        if (u.sampler) {
          // press sorts each unit's events by beat before building notes
          // (press.js byUnit loop); the sampler's SP.mixPCM accumulation order
          // depends on it, so match it for byte parity.
          events.sort((a, b) => a.beat - b.beat);
          const relN = Math.max(32, Math.floor((u.sampler.rel || 0.09) * SR));
          const notes = events.map((e) => ({
            tSec: e.beat * spb, durSec: e.durB * spb, freq: e.sets.freq,
            gain: (u.lvl || 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
            atk: u.sampler.atk, rel: u.sampler.rel, zones: u.sampler.zones,
            swell: !!u.sampler.swell, mello: u.sampler.mello || null,
            bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0,
          })).filter((n) => n.tSec < totalSec);
          // precompute each note's [s0, end) sample span for per-window filtering
          for (const n of notes) {
            n._s0 = Math.max(0, Math.floor(n.tSec * SR));
            const holdN = Math.max(Math.max(8, Math.floor((n.atk || 0.01) * SR)), Math.floor(n.durSec * SR));
            n._end = n._s0 + holdN + relN;
          }
          samplerUnits.set(key, { notes, sends: { dry: u.dry != null ? u.dry : 1, rev: u.rev || 0, del: u.del || 0, strip: u.sampler.strip } });
          unitOrder.push({ key, kind: "sampler" });
        } else {
          const us = await ensureUnit(key, u);
          if (u.vocoder && speech) us.vocIns = (s, len) => speech.subarray(s, s + len);
          else if (u.vocoder) us.vocIns = (s, len) => new Float32Array(len);
          ingestUnitEvents(us, events, spb, TOTAL);
          units.set(key, us);
          unitOrder.push({ key, kind: "faust" });
        }
      }

      const anyStereo = Object.values(sched.units).some((u) => u && u.stereo);

      // ---- persistent master-stage procs (fx_bus + optional color + master_mb) ----
      const fxp = SE.fxParams(state);
      const fx = await mkProc("fx_bus");
      for (const [k, v] of Object.entries(fxp)) fx.setParamValue("/fx_bus/" + k, v);

      const rc = SE.reverbColor(state);
      let revBleed = null, revColor = null;
      if (rc) {
        revBleed = await mkProc("rev_bleed");
        for (const k of ["dtime", "dfb", "dcut", "dgain", "pptime", "ppfb", "pptone"])
          revBleed.setParamValue("/rev_bleed/" + k, fxp[k]);
        revColor = await mkProc(rc.module);
        const RR = "/" + rootOf(rc.module) + "/";
        revColor.setParamValue(RR + "rgain", rc.rgain);
        revColor.setParamValue(RR + "rtone", rc.rtone);
      }

      const mb = SE.masterMb(state);
      let master = null;
      if (mb) {
        master = await mkProc(mb.module);
        master.setParamValue("/" + rootOf(mb.module) + "/mbdrive", mb.mbdrive);
      }

      // mcut sweep automation (instr 96 expon), press.js:246-273 — piecewise, per
      // BS block over ABSOLUTE sample time, carried across chunk seams.
      const sweeps = sched.sweeps
        .map((sw) => ({ t0: sw.beat * spb, t1: (sw.beat + sw.durB) * spb, from: sw.from, to: sw.to }))
        .sort((a, b) => a.t0 - b.t0);

      // ---- chunk grid: BS-aligned chord-bar boundaries covering [0, TOTAL) ----
      const CBEATS = Math.max(2, Math.round(state.chordEvery || 8));
      const barSamp = CBEATS * spb * SR;
      const S = [0];
      for (let k = 1; S[S.length - 1] < TOTAL; k++) S.push(Math.min(TOTAL, Math.round(k * barSamp / BS) * BS));
      const nChunks = S.length - 1;

      ST = { state, sched, spb, totalSec, TOTAL, buffers, foundAcc, samplerUnits, units, unitOrder,
        anyStereo, fx, revBleed, revColor, rc, master, mb, sweeps, S, nChunks, CBEATS,
        zero: new Float32Array(BS),
        cursor: 0, mcut: 21000, swi: 0, activeSw: [] };
      return { nChunks, TOTAL, SR, spb, CBEATS, S: S.slice(),
        totalSec, foundEvents: foundSec.length, unitKeys: unitOrder.map((x) => x.key) };
    }

    // ==================================================== LIVE / INCREMENTAL feed
    // Phase 5a: the same persistent-proc machinery, but fed ONE chord-bar at a time
    // so a live stream can GLIDE. openLive sets up fx + a lazy per-unit fleet from an
    // INITIAL state (NO whole-song schedule ingest); feedBar ingests one bar's events
    // into the persistent per-voice queues and applies any changed params via
    // setParamValue (a smooth glide — the DSP's own si.smooth ramps it). The procs are
    // NEVER reset between bars, so a note started in bar k sustains across every later
    // bar's render via ingest's carry intervals — no re-attack, no seam click.
    //
    // STABLE TOPOLOGY within one live stream (the conductor handles topology changes
    // via a new ring + crossfade). Found/sampler are NOT baked in live mode (a
    // found-free live stream is the supported case — the clicktest bed); a live
    // journey that needs found would run a per-bar found bake here, a follow-up.
    async function openLive(state, io) {
      io = io || {};
      const spb0 = 60 / state.bpm;

      // persistent master-stage procs from the INITIAL state (mirrors open())
      const fxp = SE.fxParams(state);
      const fx = await mkProc("fx_bus");
      for (const [k, v] of Object.entries(fxp)) fx.setParamValue("/fx_bus/" + k, v);

      const rc = SE.reverbColor(state);
      let revBleed = null, revColor = null;
      if (rc) {
        revBleed = await mkProc("rev_bleed");
        for (const k of ["dtime", "dfb", "dcut", "dgain", "pptime", "ppfb", "pptone"])
          revBleed.setParamValue("/rev_bleed/" + k, fxp[k]);
        revColor = await mkProc(rc.module);
        const RR = "/" + rootOf(rc.module) + "/";
        revColor.setParamValue(RR + "rgain", rc.rgain);
        revColor.setParamValue(RR + "rtone", rc.rtone);
      }
      const mb = SE.masterMb(state);
      let master = null;
      if (mb) { master = await mkProc(mb.module); master.setParamValue("/" + rootOf(mb.module) + "/mbdrive", mb.mbdrive); }

      // the initial unit spec — for lazy ensureUnit + the stereo-bus decision
      const unitsSpec = SE.voiceUnits(E, state);
      const anyStereo = Object.values(unitsSpec).some((u) => u && u.stereo);

      ST = { live: true, state, spb: spb0, TOTAL: LIVE_TOTAL, buffers: io.buffers || {},
        bakeNative: !!io.bakeNative,   // wavOut segs path: bake native found+sampler here (no live graph)
        foundAcc: null, samplerUnits: new Map(), units: new Map(), unitOrder: [],
        unitParams: new Map(), unitsSpec, speech: io.speech || null,
        anyStereo, fx, fxp: { ...fxp }, revBleed, revColor, rc, master, mb,
        sweeps: [], S: null, bars: [], liveWriteEnd: 0,
        zero: new Float32Array(BS), cursor: 0, mcut: 21000, swi: 0, activeSw: [] };
      return { live: true, SR, spb: spb0, anyStereo, unitKeys: Object.keys(unitsSpec) };
    }

    // feedBar(bar) — ingest ONE chord-bar and glide changed params. `bar`:
    //   { events, units?, fxParams?, sweeps?, spb, lo, hi, barStartSec? }
    // events/units/lo/hi are the SE.mapEvents fabric for the window [lo,hi). The bar
    // occupies a CONTIGUOUS BS-aligned sample span [liveWriteEnd, liveWriteEnd+barLen)
    // so consecutive bars tile the stream with no gap/overlap. Returns {index,length}.
    async function feedBar(bar) {
      if (!ST || !ST.live) throw new Error("stream-renderer: feedBar before openLive()");
      const spb = bar.spb != null ? bar.spb : ST.spb;
      const lo = bar.lo != null ? bar.lo : 0;
      const hi = bar.hi != null ? bar.hi : lo;
      const base = ST.liveWriteEnd;
      let barLen = Math.round((hi - lo) * spb * SR / BS) * BS;
      if (barLen < BS) barLen = BS;
      const end = base + barLen;

      // master-stage (fx_bus) param glide — changed keys only, applied to the
      // persistent proc so the change takes effect from this bar's first block.
      if (bar.fxParams) {
        for (const [k, v] of Object.entries(bar.fxParams))
          if (ST.fxp[k] !== v) { ST.fx.setParamValue("/fx_bus/" + k, v); ST.fxp[k] = v; }
      }

      // per-unit: lazily create the persistent proc set on first event, then ingest
      // this bar's events into its persistent queues at absolute sample positions.
      const unitsSpec = bar.units || ST.unitsSpec;
      const byUnit = {};
      for (const e of (bar.events || [])) (byUnit[e.unit] = byUnit[e.unit] || []).push(e);
      for (const key of Object.keys(byUnit)) {
        const u = unitsSpec[key];
        if (!u || u.sampler) continue;   // sampler/found not baked in live mode (see openLive note)
        let us = ST.units.get(key);
        if (!us) {
          us = await ensureUnit(key, u);
          // LIVE path: speech is the RAW decoded carrier (NOT tiled to a TOTAL like
          // the whole-song open() path), so LOOP it — subarray would go silent past
          // the clip length and the vocoder would hum again on a continuous stream.
          if (u.vocoder && ST.speech && ST.speech.length) {
            const sp = ST.speech, L = sp.length;
            us.vocIns = (s, len) => { const o = new Float32Array(len); for (let i = 0; i < len; i++) o[i] = sp[((s + i) % L + L) % L]; return o; };
          } else if (u.vocoder) us.vocIns = (s, len) => new Float32Array(len);
          ST.units.set(key, us);
          ST.unitOrder.push({ key, kind: "faust" });
          ST.unitParams.set(key, { ...(u.params || {}) });
        }
        ingestUnitEvents(us, byUnit[key], spb, ST.TOTAL, { beatLo: lo, baseSample: base });
      }

      // per-unit param GLIDE from the (possibly morphed) unit spec — for EVERY
      // already-created unit, whether or not it had events this bar. si.smooth on the
      // module's params ramps the step, so a per-bar cutoff walk is a smooth sweep.
      if (bar.units) {
        for (const [key, u] of Object.entries(bar.units)) {
          const us = ST.units.get(key);
          if (!us || !u || !u.params) continue;
          const prev = ST.unitParams.get(key) || {};
          for (const [k, v] of Object.entries(u.params))
            if (prev[k] !== v) for (const vc of us.procs) vc.proc.setParamValue(vc.R + k, v);
          ST.unitParams.set(key, { ...prev, ...u.params });
        }
      }

      // ── NATIVE-LAYER BAKE (wavOut segs path only, ST.bakeNative): the live graph
      // is gone, so the sampler + found layers that live.js plays natively must be
      // baked into the stream here. Sampler: build press-style notes at absolute
      // sample positions and register the unit in unitOrder/samplerUnits (the shared
      // renderChunk sampler path then bakes them WINDOWED, exactly like open()). Found:
      // chops at their beat, beds re-anchored at bar start on chord 0 — scheduleNative
      // parity — attached to this bar's record for a windowed FP.mixPCM in renderChunk.
      let barFound = null;
      if (ST.bakeNative) {
        for (const key of Object.keys(byUnit)) {
          const u = unitsSpec[key];
          if (!u || !u.sampler) continue;
          let su = ST.samplerUnits.get(key);
          if (!su) {
            su = { notes: [], sends: { dry: u.dry != null ? u.dry : 1, rev: u.rev || 0, del: u.del || 0, strip: u.sampler.strip } };
            ST.samplerUnits.set(key, su);
            ST.unitOrder.push({ key, kind: "sampler" });
          }
          const relN = Math.max(32, Math.floor((u.sampler.rel || 0.09) * SR));
          for (const e of byUnit[key].slice().sort((a, b) => a.beat - b.beat)) {
            const n = { tSec: base / SR + (e.beat - lo) * spb, durSec: e.durB * spb, freq: e.sets.freq,
              gain: (u.lvl || 0.5) * (e.sets.gain != null ? e.sets.gain : 0.13),
              atk: u.sampler.atk, rel: u.sampler.rel, zones: u.sampler.zones,
              swell: !!u.sampler.swell, mello: u.sampler.mello || null,
              bendFrom: e.bend ? e.bend.from : 0, bendMs: e.bend ? e.bend.ms : 0 };
            n._s0 = Math.max(0, Math.floor(n.tSec * SR));
            const holdN = Math.max(Math.max(8, Math.floor((n.atk || 0.01) * SR)), Math.floor(n.durSec * SR));
            n._end = n._s0 + holdN + relN;
            su.notes.push(n);
          }
        }
        barFound = [];
        for (const f of (bar.found || [])) {
          if (!ST.buffers[f.srcId]) continue;
          if (f.type === "chop") barFound.push({ ...f, tSec: base / SR + (f.beat - lo) * spb, durSec: f.durB * spb });
          else if (bar.foundCi === 0) barFound.push({ ...f, tSec: base / SR, durSec: f.durB * spb });   // bed on downbeat, anchored at bar start
        }
      }

      if (bar.sweeps) for (const sw of bar.sweeps) ST.sweeps.push(sw);
      ST.bars.push({ base, end, spb, found: barFound });
      ST.liveWriteEnd = end;
      return { index: ST.bars.length - 1, base, end, length: barLen };
    }

    // renderChunk(n) -> { L, R, startSample, length } — the stereo master for the
    // n-th chord-bar window, rendered through every persistent proc so its state
    // continues into chunk n+1. Chunks MUST be pulled in order (0,1,2,…). In LIVE
    // mode the window comes from the fed ST.bars[n] (per-bar spb); otherwise from the
    // whole-song grid ST.S — the persistent-proc render path below is identical.
    function renderChunk(n) {
      if (!ST) throw new Error("stream-renderer: renderChunk before open()");
      if (n !== ST.cursor) throw new Error(`stream-renderer: chunk out of order (want ${ST.cursor}, got ${n})`);
      const { TOTAL, foundAcc, samplerUnits, units, unitOrder, anyStereo } = ST;
      let base, end, spb, liveBar = null;
      if (ST.live) {
        liveBar = ST.bars[n];
        if (!liveBar) throw new Error(`stream-renderer: live chunk ${n} not fed`);
        base = liveBar.base; end = liveBar.end; spb = liveBar.spb;
      } else {
        const S = ST.S; base = S[n]; end = Math.min(S[n + 1], TOTAL); spb = ST.spb;
      }
      const LEN = end - base;

      // combined bus set for this window (press's accumulator, one bar wide)
      const dry = new Float32Array(LEN), rev = new Float32Array(LEN),
            del = new Float32Array(LEN), pp = new Float32Array(LEN);
      const wL = anyStereo ? new Float32Array(LEN) : null;
      const wR = anyStereo ? new Float32Array(LEN) : null;
      const buses = { dry, rev, del, pp, wL, wR };

      // accumulate in press's exact order: FOUND first, then units in byUnit order.
      // Samplers bake INCREMENTALLY onto this running window bus at their byUnit
      // position (SP.mixPCM windowed write) so their notes sum onto the same base
      // press uses (found + earlier voices) — matching its per-sample float order.
      if (foundAcc) for (let i = 0; i < LEN; i++) { dry[i] += foundAcc.dry[base + i]; rev[i] += foundAcc.rev[base + i]; del[i] += foundAcc.del[base + i]; pp[i] += foundAcc.pp[base + i]; }
      // LIVE wavOut: windowed found bake for this bar (chops/beds), press order = FIRST.
      else if (liveBar && liveBar.found && liveBar.found.length)
        FP.mixPCM(liveBar.found, ST.buffers, SR, { dry, rev, del, pp }, { base, len: LEN, total: TOTAL });
      for (const { key, kind } of unitOrder) {
        if (kind === "sampler") {
          const su = samplerUnits.get(key);
          if (ST.live) su.notes = su.notes.filter((nt) => nt._end > base);   // prune fully-played notes (unbounded live stream)
          const win = su.notes.filter((nt) => nt._s0 < end && nt._end > base);
          if (win.length) SP.mixPCM(win, ST.buffers, SR, { dry, rev, del }, su.sends, { base, len: LEN, total: TOTAL });
        } else {
          renderUnitWindow(units.get(key), buses, base, end, spb);
        }
      }

      // ---- reverb COLOR: rev_bleed(del,pp) -> bleed; reverb(rev+bleed) -> wet ----
      let wetL = null, wetR = null;
      if (ST.rc) {
        const bleed = new Float32Array(LEN);
        for (let s = 0; s < LEN; s += BS) {
          const len = Math.min(BS, LEN - s);
          const o = ST.revBleed.render([del.subarray(s, s + len), pp.subarray(s, s + len)], len);
          bleed.set(o[0].subarray(0, len), s);
        }
        const revColorIn = new Float32Array(LEN);
        for (let i = 0; i < LEN; i++) revColorIn[i] = rev[i] + bleed[i];
        wetL = new Float32Array(LEN); wetR = new Float32Array(LEN);
        for (let s = 0; s < LEN; s += BS) {
          const len = Math.min(BS, LEN - s);
          const o = ST.revColor.render([revColorIn.subarray(s, s + len), revColorIn.subarray(s, s + len)], len);
          wetL.set(o[0].subarray(0, len), s); wetR.set((o[1] || o[0]).subarray(0, len), s);
        }
      }

      // ---- fx_bus dry L/R inputs: mono dry duplicated + stereo width + reverb wet ----
      const dryL = (wL || wetL) ? (() => { const b = new Float32Array(LEN); for (let i = 0; i < LEN; i++) b[i] = dry[i] + (wL ? wL[i] : 0) + (wetL ? wetL[i] : 0); return b; })() : dry;
      const dryRch = (wR || wetR) ? (() => { const b = new Float32Array(LEN); for (let i = 0; i < LEN; i++) b[i] = dry[i] + (wR ? wR[i] : 0) + (wetR ? wetR[i] : 0); return b; })() : dry;

      // ---- fx_bus master over the window, mcut sweep carried across chunks ----
      const L = new Float32Array(LEN), R = new Float32Array(LEN);
      const { fx, sweeps, zero } = ST;
      for (let s = 0; s < LEN; s += BS) {
        const len = Math.min(BS, LEN - s), t = (base + s) / SR;
        if (sweeps.length) {
          while (ST.swi < sweeps.length && sweeps[ST.swi].t0 <= t) ST.activeSw.push(sweeps[ST.swi++]);
          for (let i = ST.activeSw.length - 1; i >= 0; i--) {
            const sw = ST.activeSw[i];
            if (t >= sw.t1) { ST.mcut = sw.to; ST.activeSw.splice(i, 1); continue; }
            const x = (t - sw.t0) / Math.max(1e-6, sw.t1 - sw.t0);
            ST.mcut = sw.from * Math.pow(sw.to / sw.from, x);
          }
          fx.setParamValue("/fx_bus/mcut", Math.min(21000, Math.max(180, ST.mcut)));
        }
        const o = fx.render([dryL.subarray(s, s + len), dryRch.subarray(s, s + len),
          rev.subarray(s, s + len), del.subarray(s, s + len), pp.subarray(s, s + len), zero.subarray(0, len)], len);
        L.set(o[0], s); R.set(o[1], s);
      }

      // ---- optional multiband master comp over the window ----
      if (ST.master) {
        for (let s = 0; s < LEN; s += BS) {
          const len = Math.min(BS, LEN - s);
          const o = ST.master.render([L.subarray(s, s + len), R.subarray(s, s + len)], len);
          L.set(o[0].subarray(0, len), s); R.set(o[1].subarray(0, len), s);
        }
      }

      ST.cursor = n + 1;
      return { L, R, startSample: base, length: LEN };
    }

    // addBuffers(map) — MERGE decoded PCM into the OPEN stream's live buffer table
    // (WAV-FIRST v3.1). The wavOut producers open with whatever PCM is cached and the
    // conductor streams the rest in as it decodes; bars baked (feedBar) AFTER a buffer
    // lands then include that found/sampler layer (renderChunk reads ST.buffers live),
    // matching the ring path's per-bar pop-in. A no-op if no stream is open.
    function addBuffers(map) {
      if (!ST || !map) return;
      if (!ST.buffers) ST.buffers = {};
      for (const k of Object.keys(map)) if (map[k]) ST.buffers[k] = map[k];
    }

    // setSpeech(sp) — fold a LATE-decoded vocoder carrier into the OPEN live stream (WAV-FIRST
    // resilience). The wavOut conductor no longer blocks the open on the speech decode; it opens
    // with a null carrier (the vocoder unit renders silence, no hum) and ships the carrier here
    // once it decodes. Updates ST.speech (so any vocoder unit created LATER binds it) and REBINDS
    // the carrier of any vocoder unit already created, so the robot starts singing mid-stream.
    function setSpeech(sp) {
      if (!ST) return;
      const s2 = sp && sp.length ? sp : null;
      ST.speech = s2;
      for (const us of ST.units.values()) {
        if (!us || !us.u || !us.u.vocoder) continue;
        if (s2) { const L = s2.length; us.vocIns = (s, len) => { const o = new Float32Array(len); for (let i = 0; i < len; i++) o[i] = s2[((s + i) % L + L) % L]; return o; }; }
        else us.vocIns = (s, len) => new Float32Array(len);
      }
    }

    function close() { ST = null; }

    return { open, openLive, feedBar, renderChunk, addBuffers, setSpeech, close };
  }

  return { makeStreamEngine };
});
