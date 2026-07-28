// faust/voices/found-player.js — found sound goes NATIVE (per FAUST-PORT.md charter).
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
//     Since ZERO-STATIC Stage 2.4 the live bed plays a pre-rendered loop-clean
//     grain-cloud buffer (one looping source) instead of per-grain node churn;
//     the old scheduler survives as the first-play head start and the
//     FP._legacyBed A/B path.
//
// The decode helper is the familiar fetch -> decodeAudioData -> mono trim, but
// it keeps an AudioBuffer (we feed buffer sources, not tables) and skips the
// IndexedDB layer. It fetches
// SAME-ORIGIN ONLY: every found source resolves to a file under found/.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FoundPlayer = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const GRAIN_HZ = 28, GRAIN_SEC = 0.12;

  // debug/probe counters (headless verification reads these). `grains` counts
  // only scheduler-minted grain nodes — with the Stage-2.4 bed loop it should
  // stay near-flat once loops are cached; bedLoopRenders/bedLoopHits track the
  // loop cache itself.
  const _stats = { decodeOk: 0, decodeFail: 0, beds: 0, chops: 0, grains: 0,
    bedLoopRenders: 0, bedLoopHits: 0,
    // ENGINE-AUDIT Tier 2/3: decode-cache evictions + idle F0 pre-warms
    bufEvicted: 0, f0Warm: 0 };

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

  // ---------------------------------------------------------------- AUTO-TUNE
  // (fx wings stage 2) Snap a found VOICE clip toward the song's scale. UNIFIED
  // + deterministic across both engines exactly like the Mellotron mode: the
  // clip's MEDIAN pitch is detected OFFLINE by autocorrelation (a pure function
  // of the decoded buffer, cached per buffer), and the found event's playbackRate
  // is bent so the heard median lands on the nearest scale tone, scaled by
  // state.autoTune (0..1). At strength 0 the ratio is 2^0 = 1 exactly, so the
  // rate is bit-identical to the original — genres that never carry `autoTune`
  // (SE.autoTune returns null, no `f.autoTune` field) render byte-for-byte as
  // before. press (mixPCM) reads f.autoTune directly; live (FoundLive) receives
  // it in the chop/bed spec. Same algorithm both sides, no wall clock.
  const _pitchCache = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();
  // the "nothing detected" profile — hz 0 (no tune), jitter 1 (no evidence of
  // stability: silence/noise must never read as a whistle OR as speech).
  const _NO_F0 = { hz: 0, voiced: 0, jitter: 1, rHalf: 0, n: 0 };
  function f0Profile(data, sr) {
    if (!data || !data.length) return _NO_F0;
    if (_pitchCache.has(data)) return _pitchCache.get(data);
    const p = _computeF0Profile(data, sr);
    _pitchCache.set(data, p);
    return p;
  }
  function detectMedianHz(data, sr) { return f0Profile(data, sr).hz; }
  // autocorrelation F0 PROFILE over the voiced frames of a mono buffer. Decimates
  // to ~11 kHz first (voice F0 << Nyquist) to bound the O(frames·lags·frame) cost.
  // Returns {hz, voiced, jitter, n}:
  //   hz     — median F0 of the voiced frames (the original detectMedianHz value)
  //   voiced — fraction of energy-eligible frames that yielded a confident F0
  //            (eligible = loud enough to analyze; silence between loon calls
  //            doesn't dilute the loon)
  //   jitter — median SHORT-TIME relative F0 deviation |Δf|/f, each voiced
  //            frame re-estimated a fixed ~46 ms later. (NOT frame-to-frame
  //            across the scan — on a long file the scan hop stretches to
  //            seconds, and seconds apart even a loon is on a different call.
  //            46 ms is intra-syllable / intra-wail: speech moves there, a
  //            whistle doesn't.)
  //   rHalf  — median r(T/2): the normalized autocorrelation at HALF the
  //            detected period. |rHalf| near 1 means ONE partial — a whistle —
  //            in either octave register (see the classifier notes below);
  //            a harmonic stack (any voice) washes toward 0. The strongest
  //            whistle/voice separator here, and nearly free: one extra
  //            O(frame) product per voiced frame over data the scan holds.
  //   n      — voiced-frame count (classifiers refuse to judge tiny samples)
  // All thresholds inside are RELATIVE to the buffer's own RMS, so the profile
  // is scale-invariant: computing it before or after a gain multiply gives the
  // same answer (decodeUrlToBuffer leans on this to pre-seed the cache).
  function _computeF0Profile(x, sr) {
    const FMIN = 65, FMAX = 520;
    const decim = Math.max(1, Math.floor(sr / 11025)), dsr = sr / decim;
    const M = Math.floor(x.length / decim);
    if (M < 128) return _NO_F0;
    const y = new Float32Array(M);
    for (let i = 0; i < M; i++) { let s = 0; const b = i * decim; for (let k = 0; k < decim; k++) s += x[b + k]; y[i] = s / decim; }
    const lagMin = Math.max(2, Math.floor(dsr / FMAX)), lagMax = Math.min(M - 2, Math.ceil(dsr / FMIN));
    if (lagMax <= lagMin) return _NO_F0;
    const frame = Math.min(M - lagMax - 1, 1024);
    if (frame < 64) return _NO_F0;
    let g = 0; for (let i = 0; i < M; i++) g += y[i] * y[i];
    const grms = Math.sqrt(g / M);
    if (grms < 1e-5) return _NO_F0;
    const thr = grms * 0.6, span = M - frame - lagMax, maxFrames = 80;
    const step = Math.max(frame >> 1, Math.floor(span / maxFrames) || 1);
    const jHop = frame >> 1;   // the fixed ~46 ms jitter-probe offset (at ~11 kHz)
    const ests = [], devs = [], purs = [];
    let eligible = 0;
    const corr = new Float32Array(lagMax + 1);
    // local re-estimate of F0 at frame position s, searching only lags
    // [lag0-2, lag0+2] — O(5·frame), the cheap second look the jitter needs.
    // Returns 0 when the neighborhood doesn't correlate (unvoiced 46 ms later).
    const localF0 = (s, lag0) => {
      let e = 0; for (let i = 0; i < frame; i++) { const v = y[s + i]; e += v * v; }
      if (Math.sqrt(e / frame) < thr) return 0;
      const a = Math.max(lagMin, lag0 - 2), b = Math.min(lagMax, lag0 + 2);
      let bl = 0, br = -1; const lc = {};
      for (let lag = a; lag <= b; lag++) {
        let c = 0, el = 0; for (let i = 0; i < frame; i++) { const p = y[s + i], q = y[s + i + lag]; c += p * q; el += q * q; }
        const r = c / (Math.sqrt(e * el) + 1e-12);
        lc[lag] = r; if (r > br) { br = r; bl = lag; }
      }
      if (br < 0.3) return 0;
      let delta = 0;   // parabolic interp when both neighbors are in the window
      if (lc[bl - 1] !== undefined && lc[bl + 1] !== undefined) {
        const denom = lc[bl - 1] - 2 * lc[bl] + lc[bl + 1];
        if (denom < 0) delta = Math.max(-1, Math.min(1, 0.5 * (lc[bl - 1] - lc[bl + 1]) / denom));
      }
      return dsr / (bl + delta);
    };
    for (let s = 0; s + frame + lagMax < M; s += step) {
      let e = 0; for (let i = 0; i < frame; i++) { const v = y[s + i]; e += v * v; }
      if (Math.sqrt(e / frame) < thr) continue;
      eligible++;
      // normalized autocorrelation over the lag range, then pick the FIRST strong
      // peak (shortest period) rather than the global max — a pure/steady tone
      // correlates equally at every multiple of its period, so a global-max search
      // locks onto SUBHARMONICS (the octave-down error). First-peak = fundamental.
      let gmax = 0;
      for (let lag = lagMin; lag <= lagMax; lag++) {
        let c = 0, el = 0; for (let i = 0; i < frame; i++) { const a = y[s + i], b = y[s + i + lag]; c += a * b; el += b * b; }
        const r = c / (Math.sqrt(e * el) + 1e-12);
        corr[lag] = r; if (r > gmax) gmax = r;
      }
      if (gmax < 0.3) continue;
      const pk = gmax * 0.85;
      let bestLag = 0;
      for (let lag = lagMin + 1; lag < lagMax; lag++) {
        if (corr[lag] >= pk && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) { bestLag = lag; break; }
      }
      if (!bestLag) { // no local peak cleared the bar — fall back to the argmax
        let m = 0; for (let lag = lagMin; lag <= lagMax; lag++) if (corr[lag] > m) { m = corr[lag]; bestLag = lag; }
      }
      if (bestLag > 0) {
        // parabolic interpolation around the peak for sub-lag precision
        const lm = corr[bestLag - 1] || 0, l0 = corr[bestLag], lp = corr[bestLag + 1] || 0;
        const denom = (lm - 2 * l0 + lp);
        const delta = denom < 0 ? 0.5 * (lm - lp) / denom : 0;
        const f1 = dsr / (bestLag + Math.max(-1, Math.min(1, delta)));
        ests.push(f1);
        // purity probe: r at half the period (see profile doc above)
        const hl = Math.round(bestLag / 2);
        if (hl >= 2) {
          let c = 0, el = 0;
          for (let i = 0; i < frame; i++) { const a = y[s + i], b = y[s + i + hl]; c += a * b; el += b * b; }
          purs.push(c / (Math.sqrt(e * el) + 1e-12));
        }
        // jitter probe: where is this pitch 46 ms from now? If the local search
        // walks off its ±2-lag window the deviation saturates at ~2/lag — which
        // is exactly the right verdict: it MOVED.
        if (s + jHop + frame + lagMax < M) {
          const f2 = localF0(s + jHop, bestLag);
          if (f2 > 0) devs.push(Math.abs(f2 - f1) / f1);
        }
      }
    }
    if (!ests.length) return _NO_F0;
    // jitter: MEDIAN of the short-time deviations, so a loon whose wail glides
    // at the onset still reads by its held tone. Fewer than 3 probes is not
    // enough evidence of stability — report jitter 1 (jittery/unknown) so
    // nothing whistle-gates off a couple of lucky frames.
    let jitter = 1;
    if (devs.length >= 3) {
      devs.sort((a, b) => a - b);
      jitter = devs[devs.length >> 1];
    }
    let rHalf = 0;   // no purity evidence => 0 (reads as harmonic-rich, never whistles)
    if (purs.length) {
      purs.sort((a, b) => a - b);
      rHalf = purs[purs.length >> 1];
    }
    const n = ests.length, voiced = eligible ? n / eligible : 0;
    ests.sort((a, b) => a - b);
    return { hz: ests[n >> 1], voiced, jitter, rHalf, n };
  }
  // ------------------------------------------------- whistle / speech gates
  // (the loon fix) Two classifiers over the same F0 profile:
  //
  // WHISTLE — a nearly pure tone. The load-bearing signal is HARMONICITY, read
  // as |rHalf|, the autocorrelation at half the detected period:
  //   * one partial AT the detected F0 -> r(T/2) = cos(π) = −1 (anti-phase);
  //   * one partial at 2x the detected F0 -> r(T/2) = +1 — the octave fold:
  //     birds whistle ABOVE the FMAX=520 search band, so first-peak picking
  //     lands on the 2:1 subharmonic and the HALF-period lag is the true one;
  //   * a voice — glottal pulses carry the whole harmonic stack — sums
  //     Σ aₖ²·cos(πk) across its partials and washes toward 0.
  //   Measured on found/: loon |rHalf| 0.85, chickadee 0.80, iriomote 0.85,
  //   pigeon 0.96 — vs every human clip ≤ 0.48 (archive.org poets 0.02-0.13,
  //   espeak vox ≤ 0.02, opera 0.01, sung tw_vocal 0.46, announcement beds
  //   ≤ 0.09). WHISTLE_RHALF = 0.65 splits the 0.48 / 0.80 gap; a borderline
  //   miss just means "leave that clip's pitch alone", the safe failure.
  // jitter < 0.03 and voiced >= 0.6 guard the purity read: mostly-voiced
  // material whose F0 holds still over 46 ms (whistles measure 0.010-0.022;
  // anything sliding around fast enough to fake a clean r(T/2) is excluded),
  // and WHISTLE_MIN_N refuses a verdict from a couple of lucky frames.
  //
  // SPEECH — median F0 inside the speech band 70-350 Hz, a real share of voiced
  // frames, and NOT a whistle. Used only to gate the decode boost (below); the
  // deliberately loose SPEECH_VOICED = 0.2 floor is fine there because the cost
  // of a false positive is just a louder field recording that also happens to
  // hum in the speech band — while a false NEGATIVE would silence a poet.
  // (Measured: every vx_/espeak/announcement clip clears it with voiced >= 0.62
  // and hz 82-263; the loon's 443 Hz median sits above the band anyway.)
  const WHISTLE_RHALF = 0.65, WHISTLE_JITTER = 0.03, WHISTLE_VOICED = 0.6, WHISTLE_MIN_N = 6;
  const SPEECH_F0_LO = 70, SPEECH_F0_HI = 350, SPEECH_VOICED = 0.2, SPEECH_MIN_N = 4;
  function isWhistle(p) {
    return p.hz > 0 && p.n >= WHISTLE_MIN_N && p.voiced >= WHISTLE_VOICED &&
           Math.abs(p.rHalf) >= WHISTLE_RHALF && p.jitter < WHISTLE_JITTER;
  }
  function isSpeechLike(p) {
    return p.hz >= SPEECH_F0_LO && p.hz <= SPEECH_F0_HI && p.n >= SPEECH_MIN_N &&
           p.voiced >= SPEECH_VOICED && !isWhistle(p);
  }
  // corrected playbackRate: bend the heard median (detectedHz·pitch) toward the
  // nearest scale pitch-class (in any octave), interpolated in the log/cents
  // domain by `strength` (0 => unchanged, 1 => full snap). pcs = pitch classes 0-11.
  function autoTuneRate(pitch, detectedHz, pcs, strength) {
    if (!(strength > 0) || !detectedHz || !isFinite(detectedHz) || detectedHz <= 0 ||
        !pcs || !pcs.length || !isFinite(pitch) || pitch <= 0) return pitch;
    const heard = detectedHz * pitch;
    if (!(heard > 0)) return pitch;
    const midi = 69 + 12 * Math.log2(heard / 440);
    const pc = ((midi % 12) + 12) % 12;
    let bestD = 12;
    for (const t of pcs) {
      let d = (((t - pc) % 12) + 12) % 12; if (d > 6) d -= 12;   // nearest wrapped, −6..+6 semitones
      if (Math.abs(d) < Math.abs(bestD)) bestD = d;
    }
    return pitch * Math.pow(2, (bestD * strength) / 12);
  }
  // resolve an event's playback pitch: apply the auto-tune bend when the event
  // carries {autoTune:{pcs,strength}} (attached by state-engine.mapEvents when a
  // genre declares state.autoTune); otherwise the original rate, untouched.
  // PURITY CEILING (the loon fix): auto-tune was built for vocal-ish material and
  // gated on "has stable F0" — but a loon call is a nearly pure whistle with
  // rock-stable F0, so it sailed through and became a tuned lead instrument. A
  // clip whose profile reads as WHISTLE gets no bend (rate = f.pitch exactly):
  // if it's already that pure, snapping it to the scale is what turns a bird
  // into a synthesizer. Tempo-synced sources (src.bpm) never reach here at all —
  // state-engine withholds the autoTune field from them, unchanged.
  function tunedPitch(f, data, sr) {
    if (!f.autoTune) return f.pitch;
    const p = f0Profile(data, sr);
    if (isWhistle(p)) return f.pitch;
    return autoTuneRate(f.pitch, p.hz, f.autoTune.pcs, f.autoTune.strength);
  }

  // ---------------------------------------------------------------- grains
  // The ONE grain-cloud renderer, shared by mixPCM (press) and the live bed's
  // loop pre-render (ZERO-STATIC 2.4): hann-windowed grains every 1/GRAIN_HZ s,
  // read pointer advancing `advance` SAMPLES per grain, source reads wrapping
  // (csound tablei wrap=1). Renders grains [gFrom, gTo) so callers can slice.
  // wrap=false truncates the final grain at dst's end — byte-identical to the
  // loop this was extracted from (press parity). wrap=true writes modulo
  // dst.length so the tail grains overlap the head: the loop-clean cloud.
  function mixGrains(dst, src, atPitch, advance, sr, gFrom, gTo, wrap) {
    const n = dst.length, gLen = Math.floor(GRAIN_SEC * sr), hop = sr / GRAIN_HZ;
    // ENGINE-AUDIT Tier 3 (~3x, bit-identical — verified sample-for-
    // sample): (a) the hann window is identical for every grain of a call, so
    // compute it ONCE into a Float64Array (Float64 keeps the exact doubles the
    // inline expression produced; Float32 would not); (b) the read pointer is
    // in-range almost always, so skip readLerp's two modulos when
    // 0 <= idx < N-1 (there idx % N === idx and (i0+1) % N === i0+1 — the
    // same loads, same arithmetic, same doubles), falling back to the
    // wrapping readLerp at the edges.
    const hann = new Float64Array(gLen);
    for (let i = 0; i < gLen; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / gLen);
    const N = src.length, NF = N - 1;
    let pointer = gFrom * advance;
    for (let g = gFrom; g < gTo; g++) {
      const gs = Math.floor(g * hop);
      if (gs >= n && !wrap) break;
      const gn = wrap ? gLen : Math.min(gLen, n - gs);
      for (let i = 0; i < gn; i++) {
        const idx = pointer + i * atPitch;
        let v;
        if (idx >= 0 && idx < NF) {
          const i0 = idx | 0, fr = idx - i0;
          v = (src[i0] + fr * (src[i0 + 1] - src[i0])) * hann[i];
        } else v = readLerp(src, idx) * hann[i];
        if (wrap) dst[(gs + i) % n] += v; else dst[gs + i] += v;
      }
      pointer += advance;
    }
  }

  // ---------------------------------------------------------------- (a) PCM
  // events: state-engine `found` list with times converted to SECONDS:
  //   {type, tSec, durSec, amp, srcId, pitch, stretch|offset, cutoff, ...}
  // buffers: {srcId: Float32Array mono at sr}
  // into: {dry, rev, del, pp} Float32Arrays (accumulated in place)
  // WINDOWED WRITE (optional `win`, mirrors sampler.js mixPCM): the live/wavOut
  // stream renderer bakes found ONTO a running one-bar window bus so it sums onto
  // the same base press uses. `win = {base, len, total}`: `into` spans absolute
  // [base, base+len); each event's full segment is still built (so its filter +
  // envelope are correct), but only the slice landing in [0,len) is written; `total`
  // is the FULL stream length for the natural play-length clamp. win omitted =>
  // whole-song write, byte-identical to before (base 0, len=total=bus length).
  function mixPCM(events, buffers, sr, into, win) {
    const winBase = win ? win.base : 0;
    const busLen = win ? win.len : into.dry.length;
    const total = win ? win.total : into.dry.length;
    for (const f of events) {
      const src = buffers[f.srcId];
      if (!src || !src.length) continue;
      const s0 = Math.max(0, Math.floor(f.tSec * sr));
      const n = Math.min(total - s0, Math.max(1, Math.floor(f.durSec * sr)));
      if (n <= 0) continue;
      // WINDOW TRUNCATION (ENGINE-AUDIT Tier 4): under a `win` the event's
      // FULL segment used to be built — for a bed that is grains + lp24 over the
      // whole multi-bar drone (a chordEvery-32 bed is ~77 s ≈ 0.9 s of work) — and
      // then all but the one-bar slice was thrown away. Everything here is CAUSAL
      // (grain overlap-add writes forward, lp24 is an IIR run forward, the envelope
      // is per-sample and still keyed on the FULL n), so building only up to the
      // window's end computes the written samples with the identical arithmetic:
      // byte-identical output, ~nch× less work for a bed that starts in this bar.
      // (A window that starts LATER than the event still builds from the segment
      // start — the filter state demands it — but stops at the window end.)
      const nEff = win ? Math.max(0, Math.min(n, winBase + busLen - s0)) : n;
      if (nEff <= 0) continue;
      const seg = new Float32Array(nEff);
      const atPitch = tunedPitch(f, src, sr);   // AUTO-TUNE bend (== f.pitch when no autoTune)

      if (f.type === "bed") {
        // syncgrain: grains every 1/28s, hann window, pointer += stretch*0.12/grain
        mixGrains(seg, src, atPitch, f.stretch * GRAIN_SEC * sr, sr, 0, Infinity, false);
        lp24(seg, f.cutoff, sr);
        // env: linsegr 0,1.5,amp, p3-3, amp, 1.5, 0
        const aN = Math.min(Math.floor(1.5 * sr), n >> 1);
        for (let i = 0; i < nEff; i++) {
          let e = f.amp;
          if (i < aN) e *= i / aN;
          else if (i > n - aN) e *= (n - i) / aN;
          seg[i] *= e;
        }
        for (let i = 0; i < nEff; i++) {
          const j = s0 + i - winBase;
          if (j < 0) continue; if (j >= busLen) break;
          const v = seg[i];
          into.dry[j] += v * 0.55;
          into.rev[j] += v * 0.6;
        }
      } else {
        // chopper: full-buffer phasor at rate pitch from fractional offset, wraps
        const start = f.offset * src.length;
        if (f.scratch) {
          // SCRATCH — scratching on samples from time to time:
          // the read position oscillates forward↔reverse like a hand on vinyl — a
          // TRIANGLE wave (constant rate each direction) over `cyc` passes across a
          // small `span` of the buffer, so the chop plays fwd/back/fwd = a scratch.
          // Opt-in via f.scratch => byte-identical when absent (the else path below).
          const span = (f.scratchSpan || 0.05) * src.length, cyc = Math.max(1, f.scratchCycles || 4);
          for (let i = 0; i < nEff; i++) { const x = cyc * i / n, t = x - (x | 0), tri = t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
            seg[i] = readLerp(src, start + span * tri); }
        } else {
          for (let i = 0; i < nEff; i++) seg[i] = readLerp(src, start + i * atPitch);
        }
        lp24(seg, f.cutoff, sr);
        const fadeN = f.fade > 0 ? Math.min(Math.floor(f.fade * sr), n >> 1) : 0;
        const aN = fadeN || Math.min(Math.floor(0.006 * sr), n >> 1);
        const rN = fadeN || Math.min(Math.floor(0.03 * sr), n >> 1);
        for (let i = 0; i < nEff; i++) {
          let e = f.amp;
          if (!fadeN && i > aN) e *= 0.85 + 0.15 * (1 - (i - aN) / Math.max(1, n - aN)); // sag to 0.85 like linsegr
          if (i < aN) e *= i / Math.max(1, aN);
          if (i > n - rN) e *= (n - i) / Math.max(1, rN);
          seg[i] *= e;
        }
        if (f.sqDepth > 0) { // square-LFO amplitude gate (station-name texture)
          const per = sr / Math.max(0.1, f.sqRate);
          for (let i = 0; i < nEff; i++) {
            const hi = (i % per) < per / 2;
            seg[i] *= hi ? 1 : (1 - f.sqDepth);
          }
        }
        for (let i = 0; i < nEff; i++) {
          const j = s0 + i - winBase;
          if (j < 0) continue; if (j >= busLen) break;
          const v = seg[i];
          into.dry[j] += v;
          into.rev[j] += v * f.rsend;
          into.del[j] += v * f.dsend;
          if (f.ppsend) into.pp[j] += v * f.ppsend;
        }
      }
    }
    return into;
  }

  // ---------------------------------------------------------------- decode
  // browser-only. Same-origin fetch + decodeAudioData, returning a mono
  // AudioBuffer (trimmed to maxSeconds).
  //
  // LEAD-IN SKIP + SPEECH BOOST (the spokenword fix): archive.org readings
  // open with 1.5-3.5 MINUTES of tape hiss before the poet speaks, and even
  // the speech sits at -28..-38 dBFS. Naively keeping "the first 90 s of the
  // file" therefore granulated pure hiss — the beds fired, the grains fired,
  // and nothing audible came out. So: analyze 0.5 s RMS windows and start the
  // kept region at the first SUSTAINED active audio. (The files we serve are
  // the already-trimmed, loudnorm'ed local transfers, so there is no ranged
  // "reach deeper into the file" ladder any more — see localUrlFor.) Quiet
  // sources get a boost-only normalization toward -20 dBFS active RMS (never
  // attenuates, never clips).
  //
  // ...but ONLY when the material actually reads as SPEECH (the loon fix).
  // The boost was built so faint poets read clearly; applied blind, it hauled
  // distant nature recordings — a loon across a lake — up to foreground, where
  // auto-tune then made them lead instruments. Non-speech quiet material keeps
  // its recorded distance: the gain is capped at NONSPEECH_GAIN_CAP (+6 dB)
  // rather than zeroed, because a mild cap still rescues near-digital-silence
  // transfers (the beds granulate SOMETHING) while +6 dB cannot move a lake
  // bird into the lead-vocal seat the way the old +24 dB ceiling could.
  const FOUND_MAX_SECONDS = 90;
  const ACTIVE_FLOOR_DB = -45,   // a chunk whose loudest window is below this is lead-in
        ACTIVE_REL_DB = 14,      // active = within this of the chunk's peak window
        TARGET_RMS = 0.15,       // boost-only normalization target (~-16.5 dBFS)
        NONSPEECH_GAIN_CAP = 2;  // non-speech keeps its distance: at most +6 dB

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

  // ---- LOCAL-ONLY resolver (the browser NEVER fetches found sound off-origin) --
  // Every archive-backed foundSource carries the archive.org URL it was fetched
  // from, but the very same audio is already on disk as found/<id>.mp3 (the
  // processed, trimmed mono 44.1k file the offline press.js loads). Two ways to
  // get from the one to the other:
  //   1. found-manifest.json byUrl — the explicit map;
  //   2. CONVENTION — SOURCES url -> id -> found/<id>.mp3, read off the kernel
  //      registry itself.
  // (2) is what makes the whole class of bug impossible: a new SOURCES row is
  // local by construction, with no manifest edit to forget. That matters because
  // sw.js can't cache a cross-origin response, so a source that missed the map
  // used to re-stream megabytes from archive.org for every listener, every
  // session. There is no remote path left — an unresolvable url fails loudly.
  let _manifestPromise = null;
  // site root derived from THIS script's URL (found-player.js lives in faust/voices/):
  // a document-relative fetch only works when the page sits at the site root
  // (explorer.html does; faust/live-test.html does NOT — its 404 tripped the
  // headless gate's zero-error assertion). Captured at load; falls back to
  // document-relative outside a browser document (node press never fetches).
  const SITE_ROOT = (() => {
    try {
      if (typeof document !== "undefined" && document.currentScript && document.currentScript.src)
        return new URL("../../..", document.currentScript.src).href;   // up THREE from engine/faust/voices/ to site root
    } catch (e) {}
    return "";
  })();
  function loadFoundManifest() {
    if (_manifestPromise) return _manifestPromise;
    _manifestPromise = (async () => {
      try {
        if (typeof fetch !== "function") return {};
        const r = await fetch(SITE_ROOT + "found/found-manifest.json", { cache: "no-cache" });
        if (!r.ok) return {};
        const j = await r.json();
        return (j && j.byUrl) ? j.byUrl : {};
      } catch (e) { return {}; }
    })();
    return _manifestPromise;
  }
  const ABS_URL = /^[a-z][a-z0-9+.-]*:/i;
  const ORIGIN = (typeof location !== "undefined" && location && location.origin) || "";
  // url -> site-relative local path, or null when nothing on disk can serve it.
  // PURE (map in, string out) so the node gate can assert the whole SOURCES
  // table resolves locally without a browser — test/unit/no-remote-sources.test.js.
  function localPathFor(url, map, sources) {
    if (!url) return null;
    if (!ABS_URL.test(url)) return url.replace(/^\.?\//, "");   // already site-relative (found/<id>.mp3)
    if (map && map[url]) return map[url];                       // explicit manifest row
    const idOf = sourceIndex(sources);                          // convention: SOURCES id -> found/<id>.mp3
    const id = idOf && idOf.get(url);
    // Beds live at found/<id>.64.mp3 — the bitrate rides in the NAME because
    // found/ is immutable-by-name (nginx one-year immutable, the SW media cache
    // never revalidates, the deploy aborts on a changed hash under an unchanged
    // name). Re-encode the beds and you mint new names; old ones simply go.
    return id ? "found/" + id + ".64.mp3" : null;
  }
  // url -> source id, memoized on the SOURCES object identity (the kernel script
  // may not have run yet when found-player loads, so never cache an empty index).
  let _srcIdx = null, _srcIdxOf = null;
  function sourceIndex(sources) {
    const K = (typeof globalThis !== "undefined" && globalThis.GenreKernel) || null;
    const S = sources || (K && K.SOURCES) || null;
    if (!S) return null;
    if (_srcIdxOf !== S) {
      _srcIdx = new Map(); _srcIdxOf = S;
      for (const id of Object.keys(S)) if (S[id] && S[id].url) _srcIdx.set(S[id].url, id);
    }
    return _srcIdx;
  }
  // Resolve to a FETCHABLE same-origin url, or null. No existence PROBE here — a
  // HEAD/Range probe races the flood of decodes at ride start and flakily aborts;
  // the decoder simply TRIES the file and fails loudly if it isn't there.
  async function localUrlFor(url) {
    if (ORIGIN && url.slice(0, ORIGIN.length + 1) === ORIGIN + "/") return url;   // samplePath, already site-resolved
    const p = localPathFor(url, await loadFoundManifest());
    return p ? SITE_ROOT + p : null;
  }

  // ---- decoded-buffer cache: LRU with a SAMPLE budget -------------------
  // ENGINE-AUDIT Tier 2: this map used to grow for the life of the page
  // (deletes only on decode FAILURE), so every found bed/break/chop/narration
  // and every synthesized utterance a ride touched stayed pinned — up to
  // FOUND_MAX_SECONDS (90 s) of mono float32 ≈ 15.9 MB each, hundreds of MB
  // across a multi-hour journey, on exactly the mobile lane iOS jetsams.
  // Now bounded like its neighbour _bedLoopCache (BED_CACHE_MAX):
  //   * insertion order IS the LRU order — every get() re-inserts (below), so
  //     the CURRENT genre's working set is refreshed every bar it fires and can
  //     never be the eviction candidate while it is playing (a journey crossing
  //     genres evicts the genre it LEFT, not the one it is in);
  //   * eviction is by total decoded SAMPLES (the honest memory measure), with
  //     a floor of BUF_CACHE_MIN entries so a single 90 s bed can never push a
  //     whole genre's set out;
  //   * only SETTLED entries are evicted (an in-flight decode stays), and an
  //     evicted url simply re-decodes from the local cache file next use —
  //     deterministically identical PCM (analyzeActive/speech-gate are pure).
  // Byte-transparent: node/press never calls decodeUrlToBuffer, and playing
  // AudioBufferSourceNodes hold their own reference to an evicted buffer.
  const BUF_CACHE_MAX_SAMPLES = 48e6;   // ~192 MB of float32 PCM
  const BUF_CACHE_MIN = 8;              // never evict below this many entries
  const _bufCache = new Map(); // url -> Promise<AudioBuffer>, in LRU order
  const _bufSize = new Map();  // url -> decoded sample count (settled entries only)
  let _bufSamples = 0;
  function bufCacheGet(key) {
    if (!_bufCache.has(key)) return null;
    const job = _bufCache.get(key);                 // LRU refresh: move to the tail
    _bufCache.delete(key); _bufCache.set(key, job);
    return job;
  }
  function bufCacheDrop(key) {
    if (!_bufCache.has(key)) return;
    _bufCache.delete(key);
    const n = _bufSize.get(key);
    if (n) { _bufSamples -= n; _bufSize.delete(key); }
  }
  function bufCacheEvict() {
    if (_bufSamples <= BUF_CACHE_MAX_SAMPLES) return;
    for (const key of [..._bufCache.keys()]) {      // oldest first
      if (_bufSamples <= BUF_CACHE_MAX_SAMPLES || _bufCache.size <= BUF_CACHE_MIN) break;
      if (!_bufSize.has(key)) continue;             // in flight — never evict a pending decode
      _stats.bufEvicted++;
      bufCacheDrop(key);
    }
  }
  // register a settled entry's size and run the budget sweep.
  function bufCacheSettled(key, buf) {
    if (!_bufCache.has(key)) return;                // already dropped/superseded
    const n = (buf && buf.length) || 0;
    _bufSize.set(key, n); _bufSamples += n;
    bufCacheEvict();
  }
  // ---- F0 PRE-WARM (ENGINE-AUDIT Tier 3) -------------------------
  // tunedPitch's f0Profile is a 67-204 ms synchronous scan. Cold, it used to run
  // inside fireBar/scheduleNative — on the main thread at the bar's playback
  // instant — for every autoTune'd source's first bed/chop. decodeUrlToBuffer's
  // pre-seed was defeated by an && (it only ran when gain > NONSPEECH_GAIN_CAP,
  // never true for the loudnorm'ed local cache files). Warm it for EVERY decoded
  // buffer instead, on idle time so the scan never lands mid-bar. The profile is
  // a pure, scale-invariant function of (data, sr) — warming changes zero
  // rendered bytes, only WHEN the identical computation happens.
  const _chan0 = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();
  // stable channel-0 view: the _pitchCache WeakMap is keyed on the Float32Array
  // identity, and a browser returning a fresh array from getChannelData(0) would
  // miss it on EVERY fire (turning the one-time stall into a per-bar one). Pin
  // the array we profiled against the AudioBuffer.
  function chan0(buffer) {
    if (!buffer) return null;
    let d = _chan0.get(buffer);
    if (!d) { d = buffer.getChannelData(0); _chan0.set(buffer, d); }
    return d;
  }
  const _idle = (fn) => (typeof requestIdleCallback === "function")
    ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 0);
  function warmF0(buffer, sr) {
    if (!buffer) return;
    const d = chan0(buffer);
    if (!d || !d.length || _pitchCache.has(d)) return;
    _idle(() => { try { if (!_pitchCache.has(d)) { f0Profile(d, sr || buffer.sampleRate); _stats.f0Warm++; } } catch (e) {} });
  }

  // ---- SPEECH organ decode (engine/speech.js) ----
  // A foundSource may carry `synthText` {text, voice, variant, pitch, speed}
  // instead of a samplePath/url. Synthesize through CsdSpeech (fresh instance
  // per utterance — the artifact's determinism law lives in the organ) and
  // cache the AudioBuffer promise in the SAME url-keyed cache the file decodes
  // use, keyed by CsdSpeech.key(), so repeats are free and both live paths
  // (ring + wavOut) share ONE render per utterance. Lazy by construction: the
  // wasm loads only when a synthText source actually arms (first call here).
  function speechOrgan() {
    if (typeof globalThis !== "undefined" && globalThis.CsdSpeech) return globalThis.CsdSpeech;
    try { if (typeof require === "function") return require("../../speech.js"); } catch (e) {}
    return null;
  }
  function synthToBuffer(ctx, spec) {
    const CS = speechOrgan();
    if (!CS || !spec || !spec.text) return Promise.reject(new Error("CsdSpeech organ unavailable"));
    const k = CS.key(spec.text, spec);
    const hit = bufCacheGet(k);
    if (hit) return hit;
    const job = CS.synth(spec.text, spec).then(({ pcm, sr }) => {
      const out = ctx.createBuffer(1, Math.max(1, pcm.length), sr);
      out.getChannelData(0).set(pcm);
      return out;
    });
    _bufCache.set(k, job);
    job.then((buf) => { _stats.decodeOk++; bufCacheSettled(k, buf); warmF0(buf); },
      () => { _stats.decodeFail++; bufCacheDrop(k); });
    return job;
  }

  function decodeUrlToBuffer(ctx, url, maxSeconds) {
    const hit = bufCacheGet(url);
    if (hit) return hit;
    const job = (async () => {
      const maxSec = maxSeconds || FOUND_MAX_SECONDS;
      const local = await localUrlFor(url);
      // LOCAL ONLY: a source that resolves to no file under found/ is a registry
      // bug, not a reason to reach the public internet. Fail loudly and let the
      // scheduling sites do what they already do with an undecodable source —
      // skip it silently — rather than re-streaming megabytes cross-origin,
      // uncacheable by sw.js, for every listener on every session.
      if (!local) {
        console.error("[found] no local file for", url, "— register found/<id>.mp3 or a found-manifest byUrl row");
        throw new Error("no local found file for " + url);
      }
      // the cache file is already trimmed + normalized and small (mono 44.1k):
      // fetch it WHOLE.
      const r = await fetch(local, { cache: "force-cache" });
      if (!r.ok) throw new Error("[found] " + local + " -> HTTP " + r.status);
      const audio = await ctx.decodeAudioData(await r.arrayBuffer());
      const mono = new Float32Array(audio.length);
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const s = audio.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += s[i] / audio.numberOfChannels;
      }
      const pick = analyzeActive(mono, audio.sampleRate);
      const s0 = pick.found ? pick.startSample : 0;
      const n = Math.max(1, Math.min(mono.length - s0, Math.floor(audio.sampleRate * maxSec)));
      const out = ctx.createBuffer(1, n, audio.sampleRate);
      const d = out.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = mono[s0 + i];
      // speech gate on the boost (the loon fix): profile the kept region ONCE —
      // f0Profile is scale-invariant and keyed on this very channel array, so
      // this call also pre-seeds the cache that tunedPitch reads later, and the
      // gain multiply below doesn't invalidate it. Speech-like material gets
      // the full spokenword boost, everything else keeps its distance (+6 dB cap).
      // (The && short-circuits for every loudnorm'ed local file, which is why
      // warmF0 below now does the pre-seed unconditionally, on idle time.)
      _chan0.set(out, d);   // pin the profiled array as this buffer's channel 0
      let gain = pick.gain || 1;
      if (gain > NONSPEECH_GAIN_CAP && !isSpeechLike(f0Profile(d, audio.sampleRate)))
        gain = NONSPEECH_GAIN_CAP;
      if (gain !== 1) for (let i = 0; i < n; i++) d[i] *= gain;
      return out;
    })();
    _bufCache.set(url, job);
    job.then((buf) => { _stats.decodeOk++; bufCacheSettled(url, buf); warmF0(buf); },
      () => { _stats.decodeFail++; bufCacheDrop(url); });
    return job;
  }

  // ---------------------------------------------------------------- bed loop
  // ZERO-STATIC Stage 2.4 (R6): the live granular bed used to mint ~28
  // src+gain node pairs per second per bed from a main-thread timer — the
  // app's single largest node-churn source. Instead we synthesize the grain
  // cloud ONCE, as pure PCM through the very same mixGrains math the press
  // path uses, into a loop-clean cycle that then plays as ONE looping
  // AudioBufferSourceNode. Loop-clean by construction: exactly G grain hops
  // of buffer, with the tail grains wrapped onto the head, so the seam lands
  // mid-cloud under overlapping hann windows — there is no "edge" to hear.
  const BED_LOOP_MAX_SEC = 24;   // loop = min(durSec, this): long enough not to read as a cycle
  const BED_SLICE_GRAINS = 42;   // ~1.5 s of PCM per idle-time render slice (no main-thread jank)
  const BED_CACHE_MAX = 6;       // LRU bound on cached loops
  const BED_XFADE_SEC = 1.5;     // scheduler -> buffer crossfade when a render lands mid-bed

  let _bedIdSeq = 0;
  const _bedIds = typeof WeakMap !== "undefined" ? new WeakMap() : new Map(); // buffer identity -> id
  const _bedLoopCache = new Map(); // key -> {promise, pcm, sr, buf, bufCtx} in LRU order

  // render one loop cycle of the bed's grain cloud: G grains at GRAIN_HZ into
  // a buffer of exactly G hops. Sliced onto requestIdleCallback (setTimeout(0)
  // where rIC doesn't exist — node, Safari) so a 24 s render never fights the
  // audio thread for the main thread. lp24 is baked in with PRIMED state — the
  // tail is prepended as warmup and dropped — so the loop seam sees the same
  // filter history as the middle of the buffer, not a cold-start transient.
  function renderBedLoopPCM(src, sr, atPitch, stretch, cutoff, G) {
    const idle = (fn) => (typeof requestIdleCallback === "function")
      ? requestIdleCallback(fn, { timeout: 250 }) : setTimeout(fn, 0);
    return new Promise((resolve) => {
      const n = Math.max(1, Math.round(G * sr / GRAIN_HZ));
      const dst = new Float32Array(n);
      const advance = stretch * GRAIN_SEC * sr;
      let g = 0;
      const step = () => {
        const gEnd = Math.min(G, g + BED_SLICE_GRAINS);
        mixGrains(dst, src, atPitch, advance, sr, g, gEnd, true);
        g = gEnd;
        if (g < G) { idle(step); return; }
        const warmN = Math.min(n, Math.floor(sr * 0.5));
        const ext = new Float32Array(warmN + n);
        ext.set(dst.subarray(n - warmN), 0); ext.set(dst, warmN);
        lp24(ext, cutoff, sr);
        dst.set(ext.subarray(warmN));
        resolve(dst);
      };
      idle(step);
    });
  }

  // cache entry for (buffer identity, pitch, stretch, cutoff bucket, loop
  // length). Repeat beds of the same texture — every bar of a genre that keeps
  // re-firing the same bed — reuse the render and start with NO scheduler at
  // all. Cutoff is bucketed to 1/4 octave; the render itself uses the first
  // caller's exact cutoff (state cutoffs are far coarser than the bucket).
  function bedLoopEntry(buffer, f, atPitch) {
    const sr = buffer.sampleRate, src = chan0(buffer);
    const G = Math.max(1, Math.round(Math.min(f.durSec, BED_LOOP_MAX_SEC) * GRAIN_HZ));
    let id = _bedIds.get(buffer);
    if (id === undefined) { id = ++_bedIdSeq; _bedIds.set(buffer, id); }
    const key = id + "|" + sr + "|" + atPitch.toFixed(3) + "|" + (+f.stretch).toFixed(3) + "|" +
                Math.round(Math.log2(Math.min(Math.max(f.cutoff, 40), 18000)) * 4) + "|" + G;
    let ent = _bedLoopCache.get(key);
    if (ent) { // LRU refresh
      _stats.bedLoopHits++;
      _bedLoopCache.delete(key); _bedLoopCache.set(key, ent);
      return ent;
    }
    _stats.bedLoopRenders++;
    ent = { sr, pcm: null, buf: null, bufCtx: null };
    ent.promise = renderBedLoopPCM(src, sr, atPitch, f.stretch, f.cutoff, G)
      .then((pcm) => { ent.pcm = pcm; return pcm; });
    _bedLoopCache.set(key, ent);
    while (_bedLoopCache.size > BED_CACHE_MAX) _bedLoopCache.delete(_bedLoopCache.keys().next().value);
    return ent;
  }

  // the AudioBuffer view of a rendered loop, built lazily per context (the
  // PCM is what's cached; contexts come and go across suspend/resume).
  function bedBufFor(ctx, ent) {
    if (!ent.buf || ent.bufCtx !== ctx) {
      ent.buf = ctx.createBuffer(1, ent.pcm.length, ent.sr);
      ent.buf.getChannelData(0).set(ent.pcm);
      ent.bufCtx = ctx;
    }
    return ent.buf;
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
      if (f.scratch) {
        // SCRATCH live twin: a WebAudio BufferSource has no scrub primitive, so
        // pre-render the fwd↔back triangle read (SAME math as mixPCM's scratch
        // branch) into a one-shot buffer, played at rate 1 through the same lp+env
        // as a normal chop. Opt-in via f.scratch => normal loop read otherwise.
        const src = chan0(buffer), sr = buffer.sampleRate;
        const n = Math.max(1, Math.floor(durSec * sr)), start = (f.offset || 0) * src.length;
        const span = (f.scratchSpan || 0.05) * src.length, cyc = Math.max(1, f.scratchCycles || 4);
        const seg = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = cyc * i / n, t = x - (x | 0), tri = t < 0.5 ? 4 * t - 1 : 3 - 4 * t; seg[i] = readLerp(src, start + span * tri); }
        const sb = ctx.createBuffer(1, n, sr); sb.getChannelData(0).set(seg);
        srcN.buffer = sb; srcN.loop = false; srcN.playbackRate.value = 1;
      } else {
        const atPitch = tunedPitch(f, chan0(buffer), buffer.sampleRate);   // AUTO-TUNE bend
        srcN.buffer = buffer; srcN.loop = true; srcN.playbackRate.value = atPitch;
      }
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
      // ENGINE-AUDIT Tier 1: keep the pp send in scope so onended can
      // disconnect it like its dry/rev/del siblings — every ppsend chop used to
      // leave a GainNode attached to dests.pp until GC (vocal-lane node leak).
      let pp = null;
      if (f.ppsend && dests.pp) { pp = ctx.createGain(); pp.gain.value = f.ppsend; tail.connect(pp); pp.connect(dests.pp); }
      srcN.start(when, f.scratch ? 0 : (f.offset % 1) * buffer.duration);   // scratch seg is pre-rendered from offset => start at 0
      srcN.stop(when + durSec + 0.05);
      srcN._ampParam = g;   // the amplitude envelope — live.fadeAll ramps it down when the mix leaves this genre
      live.active.add(srcN);
      srcN.onended = () => { live.active.delete(srcN); try { dry.disconnect(); rev.disconnect(); del.disconnect(); if (pp) pp.disconnect(); } catch (e) {} };
    };

    // instr 3 — the granular bed, ZERO-STATIC Stage 2.4 (R6). The bed's grain
    // cloud is pre-rendered ONCE into a loop-clean AudioBuffer (bedLoopEntry
    // above — same mixGrains math as press, sliced onto idle time) and played
    // as ONE looping AudioBufferSourceNode: hundreds of per-grain src+gain
    // pairs per minute collapse to a single node. Until that render lands the
    // OLD grain scheduler runs unchanged — first-play latency is identical —
    // then we crossfade scheduler -> buffer over ~1.5 s at a grain boundary
    // and the scheduler stops minting. Cached loops (repeat beds of the same
    // source+params) skip the scheduler entirely. Envelope ramps, dry/rev
    // sends, the stop() contract and live.beds bookkeeping are unchanged.
    // FP._legacyBed = true forces the old scheduler-only path (A/B).
    live.bed = function (buffer, when, f) {
      _stats.beds++;
      const durSec = f.durSec;
      const atPitch = tunedPitch(f, chan0(buffer), buffer.sampleRate);   // AUTO-TUNE bend
      const out = ctx.createGain(); out.gain.value = 0;
      const dry = ctx.createGain(); dry.gain.value = 0.55; out.connect(dry); dry.connect(dests.dry);
      const rev = ctx.createGain(); rev.gain.value = 0.6; out.connect(rev); rev.connect(dests.rev);
      const g = out.gain, aT = Math.min(1.5, durSec / 2);
      g.setValueAtTime(0, when);
      g.linearRampToValueAtTime(f.amp, when + aT);
      g.setValueAtTime(f.amp, when + durSec - aT);
      g.linearRampToValueAtTime(0, when + durSec);
      const state = { g: 0, pointer: 0, timer: 0, stopped: false, loopSrc: null, cutoverT: 0 };
      const hop = 1 / GRAIN_HZ, advance = f.stretch * GRAIN_SEC;

      // legacy leg: the grain scheduler — ~2s of grains ahead on a timer (28
      // grains/s upfront for a 20s bed would be hundreds of nodes at once).
      // Grains feed schedBus so the cutover can fade this whole leg out.
      let schedBus = null;
      const startScheduler = () => {
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
        lp.frequency.value = Math.min(Math.max(f.cutoff, 40), 18000);
        schedBus = ctx.createGain(); schedBus.gain.value = 1;
        lp.connect(schedBus); schedBus.connect(out);
        const tick = () => {
          if (state.stopped) return;
          const horizon = ctx.currentTime + 2;
          while (true) {
            const t = when + state.g * hop;
            if (t >= when + durSec || (state.cutoverT && t >= state.cutoverT)) { state.stopped = true; break; }
            if (t > horizon) break;
            if (t >= ctx.currentTime + 0.002) {   // value curves can't start in the past
              const s = ctx.createBufferSource(); s.buffer = buffer;
              s.loop = true;   // wrap like csound tablei(wrap=1): grains that read
              s.playbackRate.value = atPitch;   // past the buffer end must not truncate mid-hann (click)
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
      };

      // buffer leg: the single looping source. Started at a grain boundary
      // (g0 hops after `when`) with the loop offset phase-matched to the
      // grain index, so during a crossfade both legs play ~the same cloud.
      // xf > 0 fades this leg in against schedBus; xf = 0 means no scheduler
      // ever ran (cache hit) and the out.gain envelope alone shapes the bed.
      const startLoop = (loopBuf, t0, xf) => {
        const s = ctx.createBufferSource(); s.buffer = loopBuf; s.loop = true;
        const leg = ctx.createGain();
        s.connect(leg); leg.connect(out);
        const g0 = Math.max(0, Math.round((t0 - when) / hop));
        const off = ((g0 * hop) % loopBuf.duration + loopBuf.duration) % loopBuf.duration;
        if (xf > 0) {
          leg.gain.value = 0;
          leg.gain.setValueAtTime(0, t0);
          leg.gain.linearRampToValueAtTime(1, t0 + xf);
          schedBus.gain.setValueAtTime(1, t0);
          schedBus.gain.linearRampToValueAtTime(0, t0 + xf);
          state.cutoverT = t0 + xf;   // scheduler mints no grain past the fade
        } else leg.gain.value = 1;
        s.start(t0, off);
        s.stop(when + durSec + 0.1);
        s.onended = () => { try { leg.disconnect(); } catch (e) {} };
        state.loopSrc = s;
      };

      const handle = { stop() {
        state.stopped = true; clearTimeout(state.timer);
        if (state.loopSrc) { try { state.loopSrc.stop(); } catch (e) {} }
        try { out.disconnect(); } catch (e) {} live.beds.delete(handle);
      }, fade(sec) {   // ramp this bed out over `sec` then stop — the graceful sibling of stop()
        const t = ctx.currentTime, s = Math.max(0.05, sec || 1.5);
        try { if (out.gain.cancelAndHoldAtTime) out.gain.cancelAndHoldAtTime(t); else out.gain.cancelScheduledValues(t);
          out.gain.linearRampToValueAtTime(0, t + s); } catch (e) {}
        if (state.loopSrc) { try { state.loopSrc.stop(t + s + 0.05); } catch (e) {} }
        state.stopped = true; clearTimeout(state.timer);
        setTimeout(() => { try { out.disconnect(); } catch (e) {} live.beds.delete(handle); }, (s + 0.15) * 1000);
      } };
      live.beds.add(handle);
      // ENGINE-AUDIT Tier 1: a bed that plays to natural completion
      // used to only delete its handle here — out/dry/rev stayed attached to
      // the dests until GC. Run the same graph teardown stop() does (minus the
      // source stop; the envelope has already closed by now).
      setTimeout(() => { try { out.disconnect(); } catch (e) {} live.beds.delete(handle); },
        (when - ctx.currentTime + durSec + 1) * 1000);

      if (FP._legacyBed) { startScheduler(); return handle; }

      const ent = bedLoopEntry(buffer, f, atPitch);
      if (ent.pcm) {   // cache hit: the loop exists NOW — no scheduler at all
        startLoop(bedBufFor(ctx, ent), Math.max(when, ctx.currentTime + 0.005), 0);
      } else {         // first hearing: scheduler starts NOW, render lands when it lands
        startScheduler();
        ent.promise.then(() => {
          if (state.stopped) return;   // bed over or stopped — the render stays cached for next time
          const now = ctx.currentTime, durEnd = when + durSec;
          if (now >= durEnd - BED_XFADE_SEC - 0.5) return;   // too close to the end to bother
          const g0 = Math.max(0, Math.ceil((now + 0.06 - when) / hop));
          const t0 = when + g0 * hop;
          startLoop(bedBufFor(ctx, ent), t0, Math.min(BED_XFADE_SEC, Math.max(0.05, durEnd - t0 - 0.1)));
        }).catch(() => {});            // render failed: the scheduler simply plays the bed out
      }
      return handle;
    };

    live.stopAll = function () {
      for (const b of [...live.beds]) b.stop();
      for (const s of [...live.active]) { try { s.stop(); } catch (e) {} }
      live.active.clear();
    };
    // fade every active voice out over `sec` and let it stop — the graceful
    // transition used when the live mix moves to a new genre (a hard stopAll is
    // for ■). Chops ramp their amp envelope; beds use handle.fade.
    live.fadeAll = function (sec) {
      const t = ctx.currentTime, s = Math.max(0.05, sec || 1.5);
      for (const src of [...live.active]) {
        const p = src._ampParam;
        if (p) { try { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else p.cancelScheduledValues(t);
          p.linearRampToValueAtTime(0, t + s); } catch (e) {} }
        try { src.stop(t + s + 0.06); } catch (e) {}
      }
      for (const b of [...live.beds]) { try { (b.fade ? b.fade(s) : b.stop()); } catch (e) {} }
    };
    return live;
  }

  const FP = { mixPCM, lp24, decodeUrlToBuffer, synthToBuffer, FoundLive, GRAIN_HZ, GRAIN_SEC, FOUND_MAX_SECONDS, _stats,
    detectMedianHz, autoTuneRate, tunedPitch,
    // loon fix: the F0 profile + classifiers behind the boost gate and the
    // auto-tune purity ceiling, exposed for direct tests (the _mixGrains pattern).
    f0Profile, _isWhistle: isWhistle, _isSpeechLike: isSpeechLike, _analyzeActive: analyzeActive,
    // the local-only resolver, exposed so test/unit/no-remote-sources.test.js can
    // prove in pure node that no SOURCES row can resolve off-origin.
    _localPathFor: localPathFor,
    // ZERO-STATIC 2.4: A/B flag (true = grain scheduler only, no loop render)
    // + the loop machinery exposed for direct tests.
    _legacyBed: false,
    _mixGrains: mixGrains, _renderBedLoopPCM: renderBedLoopPCM,
    _bedLoopEntry: bedLoopEntry, _bedLoopCache,
    // ENGINE-AUDIT Tier 2/3: the bounded decode cache + F0 pre-warm,
    // exposed for the browser gates (?wavDebug) and direct tests.
    _bufCache, _bufCacheInfo: () => ({ entries: _bufCache.size, samples: _bufSamples,
      mb: +(_bufSamples * 4 / 1048576).toFixed(1), evicted: _stats.bufEvicted, max: BUF_CACHE_MAX_SAMPLES }),
    _warmF0: warmF0, _chan0: chan0 };
  return FP;
});
