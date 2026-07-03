// faust/found-player.js — found sound goes NATIVE (per FAUST-PORT.md charter).
//
// Two implementations of the two csound found-sound instruments:
//
//   instr 3 (granular bed):  syncgrain 1, 28, pitch, 0.12, stretch, table
//     -> overlapping 0.12s hann-windowed grains at 28 grains/s; the read
//        pointer advances stretch*0.12s per grain; each grain resamples the
//        source at `pitch`; 1.5s fade in/out; lowpassed at `cutoff`;
//        dry*0.55 + reverb*0.6 (hardcoded in instr 3).
//   instr 5 (slice chopper): phasor (sr*pitch)/N -> tablei frac(idx+offset)
//     -> plays the WHOLE buffer from a fractional offset at rate `pitch`,
//        wrapping (loop) — quick 6ms/30ms envelope or long `fade` swells,
//        optional square-LFO amplitude gate, per-event rsend/dsend/ppsend.
//
// (a) mixPCM(): pure-JS Float32Array mixing — used by press.js in node, where
//     there is no OfflineAudioContext; documented approach per Phase-2 brief.
// (b) FoundLive: AudioBufferSourceNode scheduling into dry/rev/del/pp GainNode
//     buses — used by live.js (and usable inside an OfflineAudioContext).
//
// The decode helper reimplements the approach of the legacy engine's
// decodeUrlToWav (wasm-audio.js, branch legacy-csound: Range-limited fetch ->
// decodeAudioData -> mono trim) but keeps an AudioBuffer (we feed buffer
// sources, not csound tables) and skips the IndexedDB layer.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FoundPlayer = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const GRAIN_HZ = 28, GRAIN_SEC = 0.12;

  // debug/probe counters (headless verification reads these)
  const _stats = { decodeOk: 0, decodeFail: 0, beds: 0, chops: 0, grains: 0 };

  // hann grain window for the LIVE grain scheduler (parity with mixPCM's
  // 0.5-0.5cos window; was a triangle ramp) — one shared curve, applied per
  // grain via setValueCurveAtTime on that grain's own GainNode.
  const HANN = (() => {
    const N = 64, w = new Float32Array(N);
    for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    w[N - 1] = 0;
    return w;
  })();

  // ---- 2x cascaded RBJ Butterworth lowpass (~24 dB/oct, stands in for
  // moogladder at the low res instr 3/5 use) ----
  function lp24(x, fc, sr) {
    fc = Math.min(Math.max(fc, 40), sr * 0.45);
    const w = 2 * Math.PI * fc / sr, cosw = Math.cos(w), sinw = Math.sin(w);
    const q = 0.7071, alpha = sinw / (2 * q), a0 = 1 + alpha;
    const b0 = (1 - cosw) / 2 / a0, b1 = (1 - cosw) / a0, b2 = b0;
    const a1 = (-2 * cosw) / a0, a2 = (1 - alpha) / a0;
    for (let pass = 0; pass < 2; pass++) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) {
        const xi = x[i];
        const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y;
      }
    }
    return x;
  }

  const readLerp = (src, idx) => { // wrapping linear-interp read (csound tablei wrap=1)
    const N = src.length;
    idx = idx % N; if (idx < 0) idx += N;
    const i0 = idx | 0, fr = idx - i0, i1 = (i0 + 1) % N;
    return src[i0] + fr * (src[i1] - src[i0]);
  };

  // ---------------------------------------------------------------- (a) PCM
  // events: state-engine `found` list with times converted to SECONDS:
  //   {type, tSec, durSec, amp, srcId, pitch, stretch|offset, cutoff, ...}
  // buffers: {srcId: Float32Array mono at sr}
  // into: {dry, rev, del, pp} Float32Arrays (accumulated in place)
  function mixPCM(events, buffers, sr, into) {
    const total = into.dry.length;
    for (const f of events) {
      const src = buffers[f.srcId];
      if (!src || !src.length) continue;
      const s0 = Math.max(0, Math.floor(f.tSec * sr));
      const n = Math.min(total - s0, Math.max(1, Math.floor(f.durSec * sr)));
      if (n <= 0) continue;
      const seg = new Float32Array(n);

      if (f.type === "bed") {
        // syncgrain: grains every 1/28s, hann window, pointer += stretch*0.12/grain
        const gLen = Math.floor(GRAIN_SEC * sr), hop = sr / GRAIN_HZ;
        const advance = f.stretch * GRAIN_SEC * sr;
        let pointer = 0;
        for (let g = 0; ; g++) {
          const gs = Math.floor(g * hop);
          if (gs >= n) break;
          const gn = Math.min(gLen, n - gs);
          for (let i = 0; i < gn; i++) {
            const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / gLen); // hann
            seg[gs + i] += readLerp(src, pointer + i * f.pitch) * w;
          }
          pointer += advance;
        }
        lp24(seg, f.cutoff, sr);
        // env: linsegr 0,1.5,amp, p3-3, amp, 1.5, 0
        const aN = Math.min(Math.floor(1.5 * sr), n >> 1);
        for (let i = 0; i < n; i++) {
          let e = f.amp;
          if (i < aN) e *= i / aN;
          else if (i > n - aN) e *= (n - i) / aN;
          seg[i] *= e;
        }
        for (let i = 0; i < n; i++) {
          const v = seg[i];
          into.dry[s0 + i] += v * 0.55;
          into.rev[s0 + i] += v * 0.6;
        }
      } else {
        // chopper: full-buffer phasor at rate pitch from fractional offset, wraps
        const start = f.offset * src.length;
        for (let i = 0; i < n; i++) seg[i] = readLerp(src, start + i * f.pitch);
        lp24(seg, f.cutoff, sr);
        const fadeN = f.fade > 0 ? Math.min(Math.floor(f.fade * sr), n >> 1) : 0;
        const aN = fadeN || Math.min(Math.floor(0.006 * sr), n >> 1);
        const rN = fadeN || Math.min(Math.floor(0.03 * sr), n >> 1);
        for (let i = 0; i < n; i++) {
          let e = f.amp;
          if (!fadeN && i > aN) e *= 0.85 + 0.15 * (1 - (i - aN) / Math.max(1, n - aN)); // sag to 0.85 like linsegr
          if (i < aN) e *= i / Math.max(1, aN);
          if (i > n - rN) e *= (n - i) / Math.max(1, rN);
          seg[i] *= e;
        }
        if (f.sqDepth > 0) { // square-LFO amplitude gate (station-name texture)
          const per = sr / Math.max(0.1, f.sqRate);
          for (let i = 0; i < n; i++) {
            const hi = (i % per) < per / 2;
            seg[i] *= hi ? 1 : (1 - f.sqDepth);
          }
        }
        for (let i = 0; i < n; i++) {
          const v = seg[i];
          into.dry[s0 + i] += v;
          into.rev[s0 + i] += v * f.rsend;
          into.del[s0 + i] += v * f.dsend;
          if (f.ppsend) into.pp[s0 + i] += v * f.ppsend;
        }
      }
    }
    return into;
  }

  // ---------------------------------------------------------------- decode
  // browser-only. Range-limited fetch + decodeAudioData, returning a mono
  // AudioBuffer (trimmed to maxSeconds).
  //
  // LEAD-IN SKIP + SPEECH BOOST (the spokenword fix): archive.org readings
  // open with 1.5-3.5 MINUTES of tape hiss before the poet speaks, and even
  // the speech sits at -28..-38 dBFS. Naively keeping "the first 90 s of the
  // file" therefore granulated pure hiss — the beds fired, the grains fired,
  // and nothing audible came out. So: analyze 0.5 s RMS windows, start the
  // kept region at the first SUSTAINED active audio, and if a chunk is all
  // lead-in (< -45 dBFS peak window) progressively fetch a larger prefix of
  // the file before giving up. Quiet sources get a boost-only normalization
  // toward -20 dBFS active RMS (never attenuates, never clips).
  const FOUND_MAX_SECONDS = 90, FOUND_CHUNK_BYTES = 1024 * 1024, FOUND_MAX_BYTES = 8 * 1024 * 1024;
  const ACTIVE_FLOOR_DB = -45,   // a chunk whose loudest window is below this is lead-in
        ACTIVE_REL_DB = 14,      // active = within this of the chunk's peak window
        TARGET_RMS = 0.15;       // boost-only normalization target (~-16.5 dBFS)

  // find where the recording actually starts + how much to boost it.
  // returns {found, startSample, gain}
  function analyzeActive(d, sr) {
    const win = Math.floor(sr * 0.5), n = Math.floor(d.length / win);
    if (n < 2) return { found: true, startSample: 0, gain: 1 };
    const db = new Array(n); let peakDb = -Infinity, peakAbs = 0;
    for (let w = 0; w < n; w++) {
      let s = 0;
      for (let i = w * win, e = i + win; i < e; i++) { const v = d[i]; s += v * v; if (v > peakAbs) peakAbs = v; else if (-v > peakAbs) peakAbs = -v; }
      db[w] = 10 * Math.log10(s / win + 1e-12);
      if (db[w] > peakDb) peakDb = db[w];
    }
    if (peakDb < ACTIVE_FLOOR_DB) return { found: false, startSample: 0, gain: 1 };
    const thr = Math.max(-48, peakDb - ACTIVE_REL_DB);
    let start = 0;
    for (let w = 0; w < n; w++) {
      if (db[w] <= thr) continue;
      let ok = 0;                                   // sustained, not a pop
      for (let k = w; k < Math.min(n, w + 8); k++) if (db[k] > thr) ok++;
      if (ok >= 4) { start = Math.max(0, w - 1); break; }
    }
    let sum = 0, cnt = 0;                           // active-region mean RMS from start
    for (let w = start; w < n; w++) if (db[w] > thr) { sum += Math.pow(10, db[w] / 10); cnt++; }
    const rms = Math.sqrt(cnt ? sum / cnt : 0);
    let gain = rms > 0 ? Math.min(16, Math.max(1, TARGET_RMS / rms)) : 1;
    if (peakAbs * gain > 0.95) gain = Math.max(1, 0.95 / peakAbs);
    return { found: true, startSample: start * win, gain };
  }

  const _bufCache = new Map(); // url -> Promise<AudioBuffer>
  function decodeUrlToBuffer(ctx, url, maxSeconds) {
    if (_bufCache.has(url)) return _bufCache.get(url);
    const job = (async () => {
      const maxSec = maxSeconds || FOUND_MAX_SECONDS;
      let bytes = FOUND_CHUNK_BYTES, audio = null, mono = null, pick = null;
      for (;;) {
        let buf, partial = false;
        try {
          const r = await fetch(url, { mode: "cors", headers: { Range: "bytes=0-" + (bytes - 1) } });
          if (!(r.status === 206 || r.ok)) throw new Error("fetch " + r.status);
          buf = await r.arrayBuffer(); partial = r.status === 206;
        } catch (e) {
          const r2 = await fetch(url, { mode: "cors" });
          if (!r2.ok) throw new Error("fetch " + r2.status + " for " + url);
          buf = await r2.arrayBuffer();
        }
        try { audio = await ctx.decodeAudioData(buf.slice(0)); }
        catch (e) {
          if (!partial) throw e;
          const r = await fetch(url, { mode: "cors" });
          audio = await ctx.decodeAudioData(await r.arrayBuffer());
          partial = false;
        }
        mono = new Float32Array(audio.length);
        for (let c = 0; c < audio.numberOfChannels; c++) {
          const s = audio.getChannelData(c);
          for (let i = 0; i < mono.length; i++) mono[i] += s[i] / audio.numberOfChannels;
        }
        pick = analyzeActive(mono, audio.sampleRate);
        if (pick.found || !partial || bytes >= FOUND_MAX_BYTES) break;
        bytes = Math.min(FOUND_MAX_BYTES, bytes * 4);   // all lead-in — reach deeper into the file
      }
      const s0 = pick.found ? pick.startSample : 0, gain = pick.gain || 1;
      const n = Math.max(1, Math.min(mono.length - s0, Math.floor(audio.sampleRate * maxSec)));
      const out = ctx.createBuffer(1, n, audio.sampleRate);
      const d = out.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = mono[s0 + i] * gain;
      return out;
    })();
    _bufCache.set(url, job);
    job.then(() => _stats.decodeOk++, () => { _stats.decodeFail++; _bufCache.delete(url); });
    return job;
  }

  // ---------------------------------------------------------------- (b) live
  // dests: {dry, rev, del, pp} — GainNodes (or any AudioNodes) to feed.
  function FoundLive(ctx, dests) {
    const live = { ctx, dests, active: new Set(), beds: new Set() };

    // instr 5 — one looping source (loop = csound's frac() wrap) + biquad + env
    live.chop = function (buffer, when, f) {
      _stats.chops++;
      const durSec = f.durSec;
      const srcN = ctx.createBufferSource();
      srcN.buffer = buffer; srcN.loop = true; srcN.playbackRate.value = f.pitch;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.value = Math.min(Math.max(f.cutoff, 40), 18000); lp.Q.value = 0.0001;
      const env = ctx.createGain(); env.gain.value = 0;
      srcN.connect(lp); lp.connect(env);
      const g = env.gain, fade = f.fade > 0 ? Math.min(f.fade, durSec / 2) : 0;
      const aT = fade || Math.min(0.006, durSec / 2), rT = fade || Math.min(0.03, durSec / 2);
      g.setValueAtTime(0, when);
      g.linearRampToValueAtTime(f.amp, when + aT);
      // csound linsegr RAMPS amp -> amp*0.85 across the middle; a
      // setValueAtTime step here was a 15% click on every un-faded chop
      g.linearRampToValueAtTime(fade ? f.amp : f.amp * 0.85, Math.max(when + aT, when + durSec - rT));
      g.linearRampToValueAtTime(0, when + durSec);
      let tail = env;
      if (f.sqDepth > 0) { // square-LFO gate: osc -> depth/2 -> gain.gain (base 1-depth/2)
        const gate = ctx.createGain(); gate.gain.value = 1 - f.sqDepth / 2;
        const osc = ctx.createOscillator(); osc.type = "square"; osc.frequency.value = f.sqRate || 3;
        const oscG = ctx.createGain(); oscG.gain.value = f.sqDepth / 2;
        osc.connect(oscG); oscG.connect(gate.gain);
        env.connect(gate); tail = gate;
        osc.start(when); osc.stop(when + durSec + 0.1);
      }
      const dry = ctx.createGain(); dry.gain.value = 1; tail.connect(dry); dry.connect(dests.dry);
      const rev = ctx.createGain(); rev.gain.value = f.rsend; tail.connect(rev); rev.connect(dests.rev);
      const del = ctx.createGain(); del.gain.value = f.dsend; tail.connect(del); del.connect(dests.del);
      if (f.ppsend && dests.pp) { const pp = ctx.createGain(); pp.gain.value = f.ppsend; tail.connect(pp); pp.connect(dests.pp); }
      srcN.start(when, (f.offset % 1) * buffer.duration);
      srcN.stop(when + durSec + 0.05);
      live.active.add(srcN);
      srcN.onended = () => { live.active.delete(srcN); try { dry.disconnect(); rev.disconnect(); del.disconnect(); } catch (e) {} };
    };

    // instr 3 — a grain scheduler: schedules ~2s of grains ahead on a timer
    // (28 grains/s upfront for a 20s bed would be hundreds of nodes at once).
    live.bed = function (buffer, when, f) {
      _stats.beds++;
      const durSec = f.durSec, srN = buffer.sampleRate;
      const out = ctx.createGain(); out.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.value = Math.min(Math.max(f.cutoff, 40), 18000);
      lp.connect(out);
      const dry = ctx.createGain(); dry.gain.value = 0.55; out.connect(dry); dry.connect(dests.dry);
      const rev = ctx.createGain(); rev.gain.value = 0.6; out.connect(rev); rev.connect(dests.rev);
      const g = out.gain, aT = Math.min(1.5, durSec / 2);
      g.setValueAtTime(0, when);
      g.linearRampToValueAtTime(f.amp, when + aT);
      g.setValueAtTime(f.amp, when + durSec - aT);
      g.linearRampToValueAtTime(0, when + durSec);
      const state = { g: 0, pointer: 0, timer: 0, stopped: false };
      const hop = 1 / GRAIN_HZ, advance = f.stretch * GRAIN_SEC;
      const tick = () => {
        if (state.stopped) return;
        const horizon = ctx.currentTime + 2;
        while (true) {
          const t = when + state.g * hop;
          if (t >= when + durSec) { state.stopped = true; break; }
          if (t > horizon) break;
          if (t >= ctx.currentTime + 0.002) {   // value curves can't start in the past
            const s = ctx.createBufferSource(); s.buffer = buffer;
            s.loop = true;   // wrap like csound tablei(wrap=1): grains that read
            s.playbackRate.value = f.pitch;   // past the buffer end must not truncate mid-hann (click)
            const w = ctx.createGain(); w.gain.value = 0;
            w.gain.setValueCurveAtTime(HANN, t, GRAIN_SEC);   // hann, like mixPCM
            s.connect(w); w.connect(lp);
            const off = (state.pointer % buffer.duration + buffer.duration) % buffer.duration;
            _stats.grains++;
            s.start(t, off);
            s.stop(t + GRAIN_SEC + 0.02);
            s.onended = () => { try { w.disconnect(); } catch (e) {} };
          }
          state.pointer += advance;
          state.g++;
        }
        if (!state.stopped) state.timer = setTimeout(tick, 500);
      };
      tick();
      const handle = { stop() { state.stopped = true; clearTimeout(state.timer); try { out.disconnect(); } catch (e) {} live.beds.delete(handle); } };
      live.beds.add(handle);
      setTimeout(() => live.beds.delete(handle), (when - ctx.currentTime + durSec + 1) * 1000);
      return handle;
    };

    live.stopAll = function () {
      for (const b of [...live.beds]) b.stop();
      for (const s of [...live.active]) { try { s.stop(); } catch (e) {} }
      live.active.clear();
    };
    return live;
  }

  return { mixPCM, lp24, decodeUrlToBuffer, FoundLive, GRAIN_HZ, GRAIN_SEC, FOUND_MAX_SECONDS, _stats };
});
