// faust/press/render-core.js — the environment-agnostic per-unit offline render walk.
//
// Extracted from press.js as the ZERO-STATIC Stage 3 prerequisite: the rolling
// 16-bar stem cache will render CACHED units in a module Worker with exactly
// this loop, so the loop must live somewhere both node and a Worker can load
// (same UMD shape as state-engine.js — require() in node, importScripts in a
// classic Worker, `FaustRenderCore` on the global). Hence the hard rule here:
// NO fs, NO ffmpeg, NO AudioContext, NO node-only APIs. Everything
// environment-specific arrives injected through `env`:
//
//   env.mkProc(module) -> Promise of a faustwasm OFFLINE processor — the only
//                         faustwasm surface this file touches is the returned
//                         object's `render(ins, len)` + `setParamValue(path, v)`
//                         (FaustMonoDspGenerator.createOfflineProcessor)
//   env.rootOf(module) -> dsp root name, for "/root/param" addressing
//   env.SR / env.BS    -> sample rate / render block size (44100 / 64)
//   env.TOTAL          -> total samples to render (buses are this long)
//   env.spb            -> seconds per beat (barSec tempo-sync on inserts)
//   env.buses          -> { dry, rev, del, pp, wL, wR } Float32Array
//                         accumulators (wL/wR null when no stereo voice)
//   env.speech         -> Float32Array | null — vocoder audio input, TOTAL long
//   env.dx7Presets     -> preset name -> { params } cartridge bank (or {})
//   env.alloc(n)       -> Float32Array factory (optional; a worker may pool)
//
// PARITY IS THE CONTRACT. This file was carved out under a hard byte-identity
// gate (old press vs render-core press, 3 states, cmp) because the repo's
// determinism promise is byte-level: same state => same bytes (see wav.js on
// why even the int16 quantizer is sacred). Keep the accumulation order, the
// block walk, and every guard exactly as they are — a "harmless" reorder of
// float adds moves rendered bytes and breaks committed-fixture gates.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustRenderCore = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // MASTERING STAGE — constant-power pan gains for a unit carrying `pan`
  // (state-engine applyMasterPan). ×√2 so center matches the old dup level;
  // pan 0 / absent never routes here (the old mono-dry path, byte-identical).
  function panLR(pan) {
    const p = Math.min(1, Math.max(-1, pan));
    const th = (p + 1) * Math.PI / 4;
    return { l: Math.SQRT2 * Math.cos(th), r: Math.SQRT2 * Math.sin(th) };
  }

  // BATCHED RENDER SPAN (ENGINE-AUDIT Tier 4) — faustwasm's offline
  // render() allocates a fresh Float32Array per output PER CALL and then chunks
  // its compute at exactly fBufferSize (= BS) internally, slicing the inputs the
  // same way. So render(ins, k*BS) executes the identical compute sequence as k
  // successive render(ins, BS) calls (start()/stop() only toggle a processing
  // flag — no state reset): batching a run of blocks over which NOTHING changes
  // is byte-identical and pays one allocation instead of k. SPAN_MAX bounds the
  // per-call output allocation (~256 KB/output) so a whole-song pass doesn't
  // trade 600k small allocations for a 35 MB one.
  const SPAN_MAX = 64 * 1024;

  // merge [start,end] intervals (a voice renders only its merged active spans)
  function mergeIvals(ivals) {
    ivals.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const iv of ivals) {
      if (out.length && iv[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], iv[1]);
      else out.push(iv.slice());
    }
    return out;
  }

  // THE PARAM ROOT (the Pure-FM drone). Every host (press.js,
  // stream-worker.js, stem-worker.js) injects a `rootOf(module)` used to address
  // a module's params as "/<root>/<name>". That root was read off the compiled
  // artifact's DECLARED NAME (`declare name "dx7_alg22"` -> meta json .name),
  // which is right only when the dsp has no top-level UI group: Faust names the
  // path root after the GROUP when there is one, and dx7.lib's dx.algorithm()
  // wraps its whole interface in hgroup "DX7". So every dx7_algN module answers
  // to "/DX7/freq" and "/DX7/gate" while the engine was writing "/dx7_algN/freq"
  // — a path faustwasm's fPathTable does not know, so the write went to index
  // `undefined` and was silently dropped. Result: no dx7 voice ever received a
  // pitch or a gate; each proc emitted its instantiation transient and then sat
  // near-silent forever (the "high pitched mono tone that never changes" under
  // sf=dx7, where the font makes EVERY melodic voice an FM voice). The cartridge
  // patches were unaffected — those are written as absolute "/DX7/..." paths.
  //
  // The root therefore comes off the UI TREE, which is the truth. Verified over
  // every module in dist/: the UI root equals the declared name for all of them
  // except dx7_alg1..32, so no non-dx7 render moves a byte.
  function paramRoot(metaJson) {
    let d;
    try { d = typeof metaJson === "string" ? JSON.parse(metaJson) : metaJson; } catch (e) { return null; }
    if (!d) return null;
    const firstAddress = (node) => {
      if (!node) return null;
      if (node.address) return node.address;
      for (const it of (node.items || [])) { const a = firstAddress(it); if (a) return a; }
      return null;
    };
    for (const g of (d.ui || [])) {
      const a = firstAddress(g);
      if (a && a.charAt(0) === "/") { const seg = a.split("/")[1]; if (seg) return seg; }
    }
    return d.name;   // paramless module (or an unexpected shape): the old law
  }

  // Render ONE unit's events through its Faust voice pool into env.buses.
  // `u` is a state-engine unit (module/pool/params/inserts/…), `events` its
  // schedule slice (already filtered to the render window by the caller).
  // Returns { pool, rendered } — pool voices used, samples voiced — for the
  // caller's log line. Sampler units never come here (native PCM path).
  async function renderUnit(u, events, env) {
    const { mkProc, rootOf, SR, BS, TOTAL, spb } = env;
    const { dry, rev, del, pp, wL, wR } = env.buses;
    const alloc = env.alloc || ((n) => new Float32Array(n));
    const speech = env.speech || null;
    const dx7Presets = env.dx7Presets || {};

    events = events.slice().sort((a, b) => a.beat - b.beat);
    const P = Math.min(u.pool || 1, u.poolCap != null ? u.poolCap : Infinity);   // poolCap: CPU-budget shed
    const procs = [];
    for (let i = 0; i < P; i++) {
      const proc = await mkProc(u.module);
      const R = "/" + rootOf(u.module) + "/";
      for (const [k, v] of Object.entries(u.params || {})) proc.setParamValue(R + k, v);
      const dxParams = u.dx7Params || (u.dx7Preset && dx7Presets[u.dx7Preset] && dx7Presets[u.dx7Preset].params);
      if (dxParams)
        for (const [sfx, v] of Object.entries(dxParams)) proc.setParamValue(sfx.startsWith("/DX7") ? sfx : "/DX7" + sfx, v);
      procs.push({ proc, R, changes: [], ivals: [], busyUntil: -1 });
    }
    // MASTERING pan: a mono unit with `pan` writes its DRY send onto the wide
    // stereo buses (wL/wR) with constant-power gains; rev/del/pp stay mono.
    const pg2 = (u.pan && wL && wR && !u.stereo) ? panLR(u.pan) : null;
    // per-voice INSERT chain (state.instruments.<voice>.inserts contract):
    // voices accumulate into a unit-local buffer, the chain processes it
    // whole-song (LFO phase + tails continuous), THEN the layer/fx sends
    // apply — same insert point as live's node->chain->sends. Units without
    // inserts keep the original direct-mix path untouched (bit-identical).
    const hasIns = u.inserts && u.inserts.length;
    const ubuf = hasIns ? alloc(TOTAL) : null;

    // supersaw release tail must survive the gate-off
    let tail = u.tail || 1;
    if (u.module === "supersaw") tail = Math.max(tail, (u.params.release || 0.3) + 0.3);
    const relTail = Math.ceil(tail * SR);

    // allocation: first free voice, else the one free soonest (round-robin-ish).
    // MONO-LEGATO units (u.mono, e.g. modeld): every note goes to voice 0, and
    // legato notes (gap < legatoSec or overlapping the previous note) join the
    // running gate group — the previous gate-off is withdrawn so the gate HOLDS
    // across the group, the freq param slews inside the module (glide) and the
    // envelopes single-trigger, exactly the Model-D contract in VOICES.md.
    const legatoWin = u.mono ? Math.ceil((u.legatoSec != null ? u.legatoSec : 0.03) * SR) : 0;
    for (const e of events) {
      const s = Math.max(BS, Math.floor(e.beat * spb * SR));
      const durS = e.durB * spb;
      const offS = e.hold ? s + Math.floor(durS * SR)
        : e.drum ? s + Math.floor(0.012 * SR)
        : s + Math.floor((Math.max(0.012, durS) - 0.008) * SR);
      let v, legato = false;
      if (u.mono) {
        v = procs[0];
        legato = !!(v.lastOff && s <= v.busyUntil + legatoWin);
      } else {
        v = procs.find(p => p.busyUntil <= s) ||
            procs.reduce((a, b) => (a.busyUntil <= b.busyUntil ? a : b));
      }
      for (const [k, val] of Object.entries(e.sets)) v.changes.push([s - BS, v.R + k, val]);
      // JS-side per-note gains ("@" pseudo-params, applied in the mix loop, not
      // setParamValue): @out = DX7 velocity (GainNode-equivalent, matches live's
      // min(1, extGainPerAmp*amp)); @pp = per-EVENT ping-pong send (snarePP).
      // dx7OutCeil (state-engine DX7_OUT_CEIL) lifts that ceiling for the dx7
      // SYNTH FONT only — absent on every other voice, so `|| 1` is the old law.
      if (u.extGainPerAmp) v.changes.push([s - BS, "@out", Math.min(u.dx7OutCeil || 1, u.extGainPerAmp * (e.amp || 0.1))]);
      v.changes.push([s - BS, "@pp", e.pp || 0]);
      if (legato) {
        // join the group: withdraw the pending gate-off, keep the gate high
        const ix = v.changes.indexOf(v.lastOff);
        if (ix >= 0) v.changes.splice(ix, 1);
      } else {
        v.changes.push([s, v.R + "gate", 1]);
      }
      const off = [offS, v.R + "gate", 0];
      v.changes.push(off);
      if (u.mono) v.lastOff = off;
      v.ivals.push([s - BS, Math.min(TOTAL, off[0] + relTail)]);
      v.busyUntil = Math.max(v.busyUntil, off[0]);
    }

    // render each pool voice over its merged active segments only
    let rendered = 0;
    for (const v of procs) {
      if (!v.changes.length) continue;
      v.changes.sort((a, b) => a[0] - b[0]);
      const segs = mergeIvals(v.ivals);
      let ci = 0, curOut = 1, curPP = 0;
      const applyChange = (c) => {
        if (c[1] === "@out") curOut = c[2];
        else if (c[1] === "@pp") curPP = c[2];
        else v.proc.setParamValue(c[1], c[2]);
      };
      // SEGMENT OVERLAP CLAMP (ENGINE-AUDIT Tier 2): the block walk
      // renders past a segment's `to` up to the next BS boundary (len clamps to
      // TOTAL, not to `to`), while the NEXT segment's start is block-aligned
      // DOWN — so a 1..63-sample gap between two merged intervals landing inside
      // one 64-block made that block render TWICE (doubled output accumulated
      // into the buses AND the voice's DSP state advanced 64 extra samples: a
      // ~1.4 ms doubled-amplitude splice, confirmed on floppycore seed 1).
      // renderedEnd is the first sample this proc has NOT rendered; clamping
      // `from` up to it makes overlap impossible. Byte-identical for every state
      // without an intra-block gap (blocks stay BS-aligned, changes stay in
      // order — a change inside a skipped block was already applied by the
      // previous segment's walk, which is unchanged).
      let renderedEnd = 0;
      for (const [a, b] of segs) {
        const from = Math.max(0, Math.floor(a / BS) * BS, renderedEnd), to = Math.min(TOTAL, b);
        // apply any changes that fell before this segment (kept in order)
        while (ci < v.changes.length && v.changes[ci][0] < from) { applyChange(v.changes[ci]); ci++; }
        let s = from, ns = from;
        while (s < to) {
          const len = Math.min(BS, TOTAL - s);
          while (ci < v.changes.length && v.changes[ci][0] < s + len) { applyChange(v.changes[ci]); ci++; }
          // extend over following blocks that apply no change (see SPAN_MAX)
          let end = s + len;
          ns = s + BS;
          while (ns < to && end - s + BS <= SPAN_MAX) {
            const l2 = Math.min(BS, TOTAL - ns);
            if (ci < v.changes.length && v.changes[ci][0] < ns + l2) break;
            end = ns + l2; ns += BS;
          }
          const span = end - s;
          // faustwasm zero-fills a missing input, so the vocoder-without-speech
          // case needs no zero array of its own (identical compute).
          const ins = u.vocoder && speech ? [speech.subarray(s, s + span)] : [];
          const oo = v.proc.render(ins, span);
          const o = oo[0];
          if (ubuf) {
            // pre-insert: only per-note out gain applies (matches live, where
            // the voice's out GainNode feeds the chain); sends come after.
            // (stereo voices are folded to channel 0 through the mono insert
            // chain — graceful; the wired stereo genres carry no inserts.)
            for (let i = 0; i < span; i++) ubuf[s + i] += o[i] * curOut;
          } else if (u.stereo && wL) {
            // STEREO voice: [0]->L, [1]->R for the dry width; sends use the mono sum
            const o1 = oo[1] || o;
            const dg = (u.dry != null ? u.dry : 1) * curOut, rg = (u.rev || 0) * curOut,
                  lg = (u.del || 0) * curOut, pg = curPP * curOut;
            for (let i = 0; i < span; i++) {
              const l = o[i], r = o1[i], mono = (l + r) * 0.5;
              wL[s + i] += l * dg; wR[s + i] += r * dg;
              rev[s + i] += mono * rg; del[s + i] += mono * lg;
              if (pg) pp[s + i] += mono * pg;
            }
          } else {
            const dg = (u.dry != null ? u.dry : 1) * curOut, rg = (u.rev || 0) * curOut,
                  lg = (u.del || 0) * curOut, pg = curPP * curOut;
            for (let i = 0; i < span; i++) {
              const x = o[i];
              if (pg2) { const xd = x * dg; wL[s + i] += xd * pg2.l; wR[s + i] += xd * pg2.r; }
              else dry[s + i] += x * dg;
              rev[s + i] += x * rg; del[s + i] += x * lg;
              if (pg) pp[s + i] += x * pg;
            }
          }
          rendered += span;
          s = ns;
        }
        renderedEnd = Math.max(renderedEnd, ns);
      }
    }
    if (ubuf) {
      for (const eff of u.inserts) {
        const ip = await mkProc(eff.module);
        const IR = "/" + rootOf(eff.module) + "/";
        for (const [k, pv] of Object.entries(eff.params)) ip.setParamValue(IR + k, pv);
        if (eff.barSec) ip.setParamValue(IR + "barSec", 4 * spb); // tempo-synced LFO
        // fixed params for the whole song => one change-free span (SPAN_MAX
        // blocks at a time). The in-place ubuf read/write stays safe: a span's
        // input slices are all read before any of it is written back, and no
        // block ever reads a range a previous block wrote.
        for (let s = 0; s < TOTAL; s += SPAN_MAX) {
          const span = Math.min(SPAN_MAX, TOTAL - s);
          const o = ip.render([ubuf.subarray(s, s + span)], span)[0];
          for (let i = 0; i < span; i++) ubuf[s + i] = o[i];
        }
      }
      const dg = u.dry != null ? u.dry : 1, rg = u.rev || 0, lg = u.del || 0;
      for (let i = 0; i < TOTAL; i++) {
        const x = ubuf[i];
        if (pg2) { const xd = x * dg; wL[i] += xd * pg2.l; wR[i] += xd * pg2.r; }
        else dry[i] += x * dg;
        rev[i] += x * rg; del[i] += x * lg;
      }
    }
    return { pool: P, rendered };
  }

  return { mergeIvals, renderUnit, panLR, paramRoot, SPAN_MAX };
});
