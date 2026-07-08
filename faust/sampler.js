// faust/sampler.js — the SAMPLER voice model: pitched playback of real
// instrument samples (multi-zone keymaps + SF2 loop points) through the
// native buffer path, exactly like found-sound (FAUST-PORT.md: "found sound
// goes native"). This is how the engine "plays SoundFonts": faust/sf2.js
// extracts a preset's zones to wav + zones.json at fetch time; the state
// carries instruments.<voice>.sampler = { id, sr, zones:[{srcId, root, lo,
// hi, loop, loopStart, loopEnd}] }; the engines schedule notes here.
//
//   playbackRate = 2^((targetMidi - zoneRoot)/12)   (root may be fractional —
//   SF2 coarse/fine tune folded in by the extractor)
//   looped zones sustain under the gate (AudioBufferSourceNode loopStart/End
//   live; wrapped linear-interp read in mixPCM); unlooped zones one-shot.
//   gain envelope: linear attack + release declick ramps (recipe attack/
//   release honored via the unit spec).
//   SWELL (per note, optional): {swell:true} — x²-shaped crescendo attack
//   instead of the linear declick ramp (sampled-strings pads; attack may run
//   seconds past the loop start — looped zones sustain under it). Both paths
//   render the same shape (curve buffer live / per-sample x² in mixPCM).
//   MELLOTRON (per note, optional): {mello:{wowDepth,flutterDepth,wowRate,
//   flutterRate,tapeCap,headEq}} — a tape-machine character mode for the
//   sampler voice. wow = slow (~0.7Hz) pitch undulation, flutter = fast
//   (~7Hz) micro-variation, both in SEMITONES on the playbackRate; the LFO
//   phase is derived from MUSICAL time (press: note tSec; live: the note's
//   song-beat time f.songT) so it is deterministic — same seed → same bytes,
//   NO wall clock. tapeCap (seconds, 0 = off) caps a held note at the length
//   of the real machine's tape strip with a "tape-runs-out" release (a quick
//   fall with a downward pitch sag). headEq (0..1) is a gentle one-pole
//   lowpass = the dulled highs of the playback head. Notes WITHOUT `mello`
//   keep the exact original code path (bit-identical regression path).
//   BLUE-NOTE BEND (per note, optional): {bendFrom: -semitones, bendMs} —
//   the note STARTS bendFrom semitones off target and glides into pitch over
//   bendMs (linear in playbackRate: live = linearRampToValueAtTime on
//   src.playbackRate; press = the same linear rate ramp accumulated sample-
//   wise). Notes without bendFrom keep the exact original fixed-rate path.
//
// (a) mixPCM(notes, buffers, sr, into): pure-JS render for press.js (node).
// (b) SamplerLive(ctx, dests): AudioBufferSourceNode scheduling for live.js.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustSampler = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const midiOfFreq = (f) => 69 + 12 * Math.log2(Math.max(1, f) / 440);
  // calibration: FluidR3-class zones peak near full scale; faust voices sit at
  // level*gain. x1.35 lands the sampler lead at supersaw-comparable RMS.
  const GAIN = 1.35;
  const clampS = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // ======================= PER-VOICE CHANNEL STRIP =========================
  // A band-appropriate channel strip for the NATIVE sampled voices (the sampled
  // instruments are the default sound since 2026-07, and dry multisamples need a
  // channel to breathe). Chain, applied POST-envelope so sends carry the finished
  // voice: HPF -> (LPF) -> peaking EQ -> soft saturation -> gentle compressor ->
  // chorus/phaser (air) -> trim. The `strip` spec is built in state-engine
  // (STRIP_PROFILES, keyed by role) and rides on u.sampler.strip.
  //
  // CRITICAL — window parity: the strip runs PER NOTE with state initialized at
  // the note's i=0, and the chorus/phaser LFOs ride GLOBAL song time
  // ((s0+i)/sr), never a per-call clock. press renders each note whole-song;
  // the stream renderer RE-renders the same note from i=0 in every window it
  // touches (writing only its slice) — so both compute byte-identical samples at
  // any output position. That is what keeps faust/segment-parity-test.js
  // byte-equal for sampled genres (it was byte-equal before; per-note state keeps
  // it so). NEVER hoist strip state to per-call/per-window scope. No rng, no wall
  // clock — determinism gates depend on it.
  function rbjCoefs(type, f, sr, Q, gainDb) {
    const w0 = 2 * Math.PI * clampS(f, 20, sr * 0.45) / sr;
    const cw = Math.cos(w0), sw = Math.sin(w0), alpha = sw / (2 * Math.max(1e-4, Q));
    const A = gainDb ? Math.pow(10, gainDb / 40) : 1;
    let b0, b1, b2, a0, a1, a2;
    if (type === "hp") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
    else if (type === "lp") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
    else { b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; } // peak
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
  }
  const biq = (o, x) => { const y = o.b0 * x + o.b1 * o.x1 + o.b2 * o.x2 - o.a1 * o.y1 - o.a2 * o.y2; o.x2 = o.x1; o.x1 = x; o.y2 = o.y1; o.y1 = y; return y; };

  // fresh per-note strip state from a strip spec (see STRIP_PROFILES in state-engine).
  function makeStrip(strip, sr) {
    const S = { sr };
    if (strip.hpf) S.hp = rbjCoefs("hp", strip.hpf, sr, 0.707, 0);
    if (strip.lpf) S.lp = rbjCoefs("lp", strip.lpf, sr, 0.707, 0);
    if (strip.eq) S.eq = rbjCoefs("peak", strip.eq.f, sr, strip.eq.q || 1, strip.eq.gain || 0);
    if (strip.sat) { S.satG = 1 + 3 * strip.sat; S.satMix = clampS(strip.satMix != null ? strip.satMix : 0.4, 0, 1); }
    if (strip.comp) {
      S.cThresh = strip.comp.thresh != null ? strip.comp.thresh : 0.25;
      S.cSlope = 1 - 1 / Math.max(1, strip.comp.ratio || 3);
      S.cAtk = Math.exp(-1 / (sr * Math.max(1e-4, strip.comp.atk || 0.01)));
      S.cRel = Math.exp(-1 / (sr * Math.max(1e-4, strip.comp.rel || 0.15)));
      S.cMakeup = strip.comp.makeup != null ? strip.comp.makeup : 1;
      S.cEnv = 0;
    }
    if (strip.chorus) {
      const c = strip.chorus, n = Math.ceil(sr * 0.035) + 4;
      S.ch = { buf: new Float32Array(n), n, w: 0, rate: c.rate || 0.6,
        base: sr * (c.baseMs || 12) / 1000, depth: sr * (c.depthMs || 5) / 1000,
        mix: clampS(c.mix != null ? c.mix : 0.3, 0, 1), two: !!c.two };
    }
    if (strip.phase) {
      const p = strip.phase, ns = p.stages || 4;
      S.ph = { rate: p.rate || 0.3, lo: p.lo || 300, hi: p.hi || 1500, ns,
        fb: clampS(p.fb != null ? p.fb : 0.3, 0, 0.9), mix: clampS(p.mix != null ? p.mix : 0.2, 0, 1),
        xp: new Float32Array(ns), yp: new Float32Array(ns), last: 0 };
    }
    S.trim = strip.trim != null ? strip.trim : 1;
    return S;
  }

  // process one sample through the per-note strip. `t` = GLOBAL song seconds.
  function stripStep(S, x, t) {
    if (S.hp) x = biq(S.hp, x);
    if (S.lp) x = biq(S.lp, x);
    if (S.eq) x = biq(S.eq, x);
    if (S.satG) { const s = Math.tanh(x * S.satG) / S.satG; x += S.satMix * (s - x); }
    if (S.cEnv !== undefined) {
      const ax = x < 0 ? -x : x;
      S.cEnv = ax > S.cEnv ? S.cAtk * S.cEnv + (1 - S.cAtk) * ax : S.cRel * S.cEnv + (1 - S.cRel) * ax;
      if (S.cEnv > S.cThresh) x *= Math.pow(S.cThresh / S.cEnv, S.cSlope);
      x *= S.cMakeup;
    }
    if (S.ch) {
      const ch = S.ch, lfo = Math.sin(2 * Math.PI * ch.rate * t);
      // clamp the read delay to the delay-line span and wrap the read pointer
      // robustly. A `d` larger than ch.n (only reachable with pathological chorus
      // base/depthMs, never the shipped STRIP_PROFILES) left rp NEGATIVE after a
      // single `+= ch.n`, indexing ch.buf out of bounds -> `undefined` -> NaN, which
      // then poisons ch.buf and every downstream sample of the whole bar (a
      // permanently-muted / garbled voice — Paul's "random muting"). For shipped
      // profiles d < ch.n-2 so this is byte-identical (clamp + while both no-op).
      const dmax = ch.n - 2;
      let d = ch.base + ch.depth * (0.5 + 0.5 * lfo); if (d > dmax) d = dmax; else if (d < 0) d = 0;
      let rp = ch.w - d; while (rp < 0) rp += ch.n;
      const i0 = rp | 0, fr = rp - i0, i1 = (i0 + 1) % ch.n;
      let wet = ch.buf[i0] + fr * (ch.buf[i1] - ch.buf[i0]);
      if (ch.two) {
        const lfo2 = Math.sin(2 * Math.PI * ch.rate * 0.8 * t + 2.1);
        let d2 = ch.base + ch.depth * (0.5 + 0.5 * lfo2); if (d2 > dmax) d2 = dmax; else if (d2 < 0) d2 = 0;
        let rp2 = ch.w - d2; while (rp2 < 0) rp2 += ch.n;
        const j0 = rp2 | 0, f2 = rp2 - j0, j1 = (j0 + 1) % ch.n;
        wet = 0.5 * (wet + ch.buf[j0] + f2 * (ch.buf[j1] - ch.buf[j0]));
      }
      ch.buf[ch.w] = x; ch.w = (ch.w + 1) % ch.n;
      x = (1 - ch.mix) * x + ch.mix * wet;
    }
    if (S.ph) {
      const ph = S.ph, l = 0.5 + 0.5 * Math.sin(2 * Math.PI * ph.rate * t);
      const fc = ph.lo * Math.pow(ph.hi / ph.lo, l), tn = Math.tan(Math.PI * clampS(fc, 20, S.sr * 0.45) / S.sr);
      const a = (1 - tn) / (1 + tn);
      let s = x + ph.fb * ph.last;
      for (let k = 0; k < ph.ns; k++) { const xin = s, y = -a * xin + ph.xp[k] + a * ph.yp[k]; ph.xp[k] = xin; ph.yp[k] = y; s = y; }
      ph.last = s;
      x = (1 - ph.mix) * x + ph.mix * s;
    }
    return x * S.trim;
  }

  function zoneFor(zones, midi) {
    if (!zones || !zones.length) return null;
    let z = zones.find((x) => midi >= x.lo && midi <= x.hi);
    if (!z) { // nearest root wins outside the mapped range
      z = zones[0];
      for (const x of zones) if (Math.abs(midi - x.root) < Math.abs(midi - z.root)) z = x;
    }
    return z;
  }
  const rateFor = (z, midi) => Math.pow(2, (midi - z.root) / 12);

  // ---- (a) press path: notes -> Float32Array buses -----------------------
  // notes: [{tSec, durSec, freq, amp, atk, rel, zones, sr(zoneFileRate)}]
  // buffers: {srcId: Float32Array mono at engine sr}
  // into: {dry, rev, del} with per-unit sends {dry, rev, del} in spec
  // WINDOWED WRITE (optional `win`): the offline stream renderer bakes a sampler
  // ONTO a running one-bar window bus at its byUnit position, so its notes sum
  // onto the same base press does (found + earlier voices) — a lump added to that
  // base would be a 1-ulp reorder the fx comp/pump amplifies past parity. `win =
  // {base, len, total}`: `into` spans absolute [base, base+len); writes land at
  // s0+i-base clipped to [0,len); `total` is the FULL song length for the note's
  // natural play-length clamp (so a note keeps its full envelope, only its window
  // slice is written; the next window re-bakes its own slice). win omitted =>
  // whole-song write, byte-identical to before (base 0, len=total=bus length).
  // `meter` (optional, AUDIT-TRUTH): a per-unit accumulator the stream renderer passes
  // to measure this voice's ACTUAL rendered contribution WITHOUT changing the output
  // bytes. `meter.e` sums the squared dry-send sample this unit wrote (energy → RMS);
  // `meter.missing` collects srcIds skipped because their buffer was absent/empty at
  // bake time (the decode-race silence). Purely additive reads — never gates output.
  function mixPCM(notes, buffers, sr, into, sends, win, meter) {
    const winBase = win ? win.base : 0;
    const busLen = win ? win.len : into.dry.length;
    const total = win ? win.total : into.dry.length;
    const dg = sends.dry != null ? sends.dry : 1, rg = sends.rev || 0, lg = sends.del || 0;
    const strip = sends.strip || null;   // per-voice channel strip (see makeStrip)
    for (const n of notes) {
      const midi = midiOfFreq(n.freq);
      const z = zoneFor(n.zones, midi);
      if (!z) continue;
      const src = buffers[z.srcId];
      if (!src || !src.length) {
        if (meter) { if (!meter.missing) meter.missing = []; if (meter.missing.indexOf(z.srcId) < 0) meter.missing.push(z.srcId); }
        continue;
      }
      const rate = rateFor(z, midi);
      const s0 = Math.max(0, Math.floor(n.tSec * sr));
      const atkN = Math.max(8, Math.floor((n.atk || 0.01) * sr));
      const relN = Math.max(32, Math.floor((n.rel || 0.09) * sr));
      const holdN = Math.max(atkN, Math.floor(n.durSec * sr));
      const outN = Math.min(total - s0, holdN + relN);
      if (outN <= 0) continue;
      const loop = z.loop && z.loopEnd > z.loopStart + 8;
      const loopLen = loop ? z.loopEnd - z.loopStart : 0;
      const g = (n.gain != null ? n.gain : 0.5) * GAIN;
      // per-note channel strip (fresh state each note -> window-independent).
      const S = strip ? makeStrip(strip, sr) : null;
      // blue-note bend: start bendFrom semitones off target, linear-in-rate
      // glide over bendMs (matches live's linearRampToValueAtTime), then the
      // fixed target rate. pos accumulates ONLY on the bend path so unbent
      // notes keep the original bit-exact i*rate read.
      const bendN = n.bendFrom ? Math.max(1, Math.floor(((n.bendMs || 90) / 1000) * sr)) : 0;
      const r0 = bendN ? rate * Math.pow(2, n.bendFrom / 12) : rate;
      // MELLOTRON mode (n.mello): wow/flutter pitch modulation + tape-strip cap
      // + head-EQ. A dedicated variable-rate accumulation loop (rate changes
      // per sample, like the bend path). Fully deterministic: the LFO time is
      // the GLOBAL song second (s0+i)/sr, so the wow is one coherent capstan
      // undulation across the whole render (and identical every render). Notes
      // without n.mello never enter here — the original loop below is untouched.
      if (n.mello) {
        const M = n.mello;
        const wowD = M.wowDepth || 0, flD = M.flutterDepth || 0;
        const wowR = M.wowRate || 0.7, flR = M.flutterRate || 7;
        const capN = M.tapeCap > 0 ? Math.floor(M.tapeCap * sr) : Infinity;
        const effHold = Math.min(holdN, capN);       // tape strip runs out at the cap
        const outNm = Math.min(total - s0, effHold + relN);
        // head-EQ: gentle one-pole lowpass (dulled highs of the playback head)
        const fc = 9000 - (M.headEq || 0) * 6500, aLp = (M.headEq || 0) > 0 ? 1 - Math.exp(-2 * Math.PI * fc / sr) : 0;
        let lp = 0, posAccM = 0;
        for (let i = 0; i < outNm; i++) {
          const t = (s0 + i) / sr;
          let pm = Math.pow(2, (wowD * Math.sin(2 * Math.PI * wowR * t) + flD * Math.sin(2 * Math.PI * flR * t)) / 12);
          if (i > effHold) pm *= 1 - 0.03 * ((i - effHold) / relN);   // tape-runout pitch sag (~½ semitone)
          const baseR = bendN ? (i < bendN ? r0 + (rate - r0) * (i / bendN) : rate) : rate;
          let pos = posAccM; posAccM += baseR * pm;
          if (loop && pos >= z.loopEnd) pos = z.loopStart + ((pos - z.loopStart) % loopLen);
          if (pos >= src.length - 1) break;
          const i0 = pos | 0, fr = pos - i0;
          let v = (src[i0] + fr * (src[i0 + 1] - src[i0])) * g;
          if (aLp) { lp += aLp * (v - lp); v = lp; }
          if (i < atkN) { const a = i / atkN; v *= n.swell ? a * a : a; }
          if (i > effHold) v *= Math.max(0, 1 - (i - effHold) / relN);   // tape-runout release
          if (S) v = stripStep(S, v, (s0 + i) / sr);
          const j = s0 + i - winBase;
          if (j >= busLen) break;
          if (j >= 0) { const vd = v * dg; into.dry[j] += vd; if (rg) into.rev[j] += v * rg; if (lg) into.del[j] += v * lg; if (meter) meter.e += vd * vd; }
        }
        continue;
      }
      let posAcc = 0;
      for (let i = 0; i < outN; i++) {
        let pos;
        if (bendN) { pos = posAcc; posAcc += i < bendN ? r0 + (rate - r0) * (i / bendN) : rate; }
        else pos = i * rate;
        if (loop && pos >= z.loopEnd) pos = z.loopStart + ((pos - z.loopStart) % loopLen);
        if (pos >= src.length - 1) break;                    // unlooped: natural end
        const i0 = pos | 0, fr = pos - i0;
        let v = (src[i0] + fr * (src[i0 + 1] - src[i0])) * g;
        // attack: linear declick ramp; SWELL mode (n.swell — strings pads)
        // shapes it x² for a real crescendo. Non-swell notes keep the exact
        // original ramp (bit-identical regression path).
        if (i < atkN) { const a = i / atkN; v *= n.swell ? a * a : a; }
        if (i > holdN) v *= Math.max(0, 1 - (i - holdN) / relN); // release ramp
        if (S) v = stripStep(S, v, (s0 + i) / sr);
        const j = s0 + i - winBase;
        if (j >= busLen) break;
        if (j >= 0) { const vd = v * dg; into.dry[j] += vd; if (rg) into.rev[j] += v * rg; if (lg) into.del[j] += v * lg; if (meter) meter.e += vd * vd; }
      }
    }
    return into;
  }

  // ---- raw decode (browser): NO lead-in trim / normalization -------------
  // found-player's decodeUrlToBuffer skips "lead-in" and boosts quiet audio —
  // both would break instrument zones (soft attacks cut, loop offsets shifted,
  // level calibration destroyed). Zones decode verbatim.
  const _cache = new Map();
  function decodeUrlRaw(ctx, url) {
    if (_cache.has(url)) return _cache.get(url);
    const job = (async () => {
      const r = await fetch(url, { mode: "cors" });
      if (!r.ok) throw new Error("fetch " + r.status + " for " + url);
      return await ctx.decodeAudioData(await r.arrayBuffer());
    })();
    _cache.set(url, job);
    job.catch(() => _cache.delete(url));
    return job;
  }

  // ---- live channel strip (Web Audio) — the perceptual twin of makeStrip/
  // stripStep, built from the SAME `strip` spec (u.sampler.strip). Not byte-
  // parallel with the JS strip (native path — approximate parity is the contract)
  // but the same band moves: HPF/LPF/EQ biquads -> saturation waveshaper ->
  // DynamicsCompressor -> chorus (modulated delay) -> phaser (allpass cascade).
  // Inserted per note between env and the dry/rev/del sends. Returns
  // {input, output, oscs, nodes} for teardown. Only builds when f.strip is passed;
  // the direct-graph live path (live.js) must forward `strip: u.sampler.strip` in
  // the note spec for this to engage — press + the wavOut stream get it via mixPCM.
  function satCurve(G, mix) {
    const N = 1024, c = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1, s = Math.tanh(x * G) / G; c[i] = x + mix * (s - x); }
    return c;
  }
  function buildStripNodes(ctx, strip, when, dur) {
    const oscs = [], nodes = [];
    const input = ctx.createGain(); nodes.push(input);
    let node = input;
    const chain = (n) => { node.connect(n); node = n; nodes.push(n); };
    if (strip.hpf) { const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = strip.hpf; f.Q.value = 0.707; chain(f); }
    if (strip.lpf) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = strip.lpf; f.Q.value = 0.707; chain(f); }
    if (strip.eq) { const f = ctx.createBiquadFilter(); f.type = "peaking"; f.frequency.value = strip.eq.f; f.Q.value = strip.eq.q || 1; f.gain.value = strip.eq.gain || 0; chain(f); }
    if (strip.sat) { const ws = ctx.createWaveShaper(); ws.curve = satCurve(1 + 3 * strip.sat, strip.satMix != null ? strip.satMix : 0.4); ws.oversample = "2x"; chain(ws); }
    if (strip.comp) {
      const c = ctx.createDynamicsCompressor();
      c.threshold.value = 20 * Math.log10(Math.max(1e-3, strip.comp.thresh || 0.25));
      c.ratio.value = strip.comp.ratio || 3; c.attack.value = strip.comp.atk || 0.01;
      c.release.value = strip.comp.rel || 0.15; c.knee.value = 6; chain(c);
      if (strip.comp.makeup && strip.comp.makeup !== 1) { const mk = ctx.createGain(); mk.gain.value = strip.comp.makeup; chain(mk); }
    }
    const parallel = (build) => {   // dry/wet split -> sum, node advances to the sum
      const mix = build.mix, sum = ctx.createGain();
      const dry = ctx.createGain(); dry.gain.value = 1 - mix; node.connect(dry); dry.connect(sum); nodes.push(dry, sum);
      build.wet(sum, mix); node = sum;
    };
    if (strip.chorus) {
      const c = strip.chorus;
      parallel({ mix: clampS(c.mix != null ? c.mix : 0.3, 0, 1), wet: (sum, mix) => {
        const dl = ctx.createDelay(0.06); dl.delayTime.value = (c.baseMs || 12) / 1000;
        const lfo = ctx.createOscillator(); lfo.frequency.value = c.rate || 0.6;
        const lg = ctx.createGain(); lg.gain.value = (c.depthMs || 5) / 1000;
        lfo.connect(lg); lg.connect(dl.delayTime); lfo.start(when); lfo.stop(when + dur + 0.1); oscs.push(lfo);
        const wg = ctx.createGain(); wg.gain.value = mix;
        node.connect(dl); dl.connect(wg); wg.connect(sum); nodes.push(dl, lg, wg);
      } });
    }
    if (strip.phase) {
      const p = strip.phase, ns = p.stages || 4, center = Math.sqrt((p.lo || 300) * (p.hi || 1500));
      parallel({ mix: clampS(p.mix != null ? p.mix : 0.2, 0, 1), wet: (sum, mix) => {
        let apn = node; const lfo = ctx.createOscillator(); lfo.frequency.value = p.rate || 0.3;
        const lg = ctx.createGain(); lg.gain.value = ((p.hi || 1500) - (p.lo || 300)) / 2;
        lfo.start(when); lfo.stop(when + dur + 0.1); oscs.push(lfo);
        for (let k = 0; k < ns; k++) { const ap = ctx.createBiquadFilter(); ap.type = "allpass"; ap.frequency.value = center; ap.Q.value = 0.7; lg.connect(ap.frequency); apn.connect(ap); apn = ap; nodes.push(ap); }
        lfo.connect(lg); nodes.push(lg);
        const wg = ctx.createGain(); wg.gain.value = mix; apn.connect(wg); wg.connect(sum); nodes.push(wg);
      } });
    }
    if (strip.trim != null && strip.trim !== 1) { const t = ctx.createGain(); t.gain.value = strip.trim; chain(t); }
    return { input, output: node, oscs, nodes };
  }

  // ---- (b) live path ------------------------------------------------------
  // dests: {dry, rev, del} nodes (a mixer layer's taps, like FoundLive).
  function SamplerLive(ctx, dests) {
    const live = { active: new Set() };
    // buffer: AudioBuffer (raw-decoded); f: {rate, when, durSec, amp(gain),
    // atk, rel, rsend, dsend, loop, loopStartSec, loopEndSec,
    // bendFrom (semitones, negative = start under pitch), bendMs}
    live.note = function (buffer, when, f) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const atk = Math.max(0.003, f.atk || 0.01), rel = Math.max(0.02, f.rel || 0.09);
      let hold = Math.max(atk, f.durSec);
      if (f.mello && f.mello.tapeCap > 0) hold = Math.min(hold, Math.max(atk, f.mello.tapeCap));   // tape strip cap
      if (f.mello) {   // MELLOTRON: wow/flutter as a playbackRate curve over musical time
        const M = f.mello, wowD = M.wowDepth || 0, flD = M.flutterDepth || 0;
        const wowR = M.wowRate || 0.7, flR = M.flutterRate || 7, total = hold + rel;
        const N = Math.max(8, Math.min(1024, Math.ceil(total * 100)));   // ~100 pts/sec
        const curve = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const lt = (i / (N - 1)) * total, t = (f.songT || 0) + lt;
          let pm = Math.pow(2, (wowD * Math.sin(2 * Math.PI * wowR * t) + flD * Math.sin(2 * Math.PI * flR * t)) / 12);
          if (lt > hold && rel > 0) pm *= 1 - 0.03 * Math.min(1, (lt - hold) / rel);   // tape-runout sag
          curve[i] = f.rate * pm;
        }
        try { src.playbackRate.setValueCurveAtTime(curve, when, total); }
        catch (e) { src.playbackRate.value = f.rate; }
      } else if (f.bendFrom) {   // blue-note bend: glide into the target pitch
        const r0 = f.rate * Math.pow(2, f.bendFrom / 12);
        src.playbackRate.setValueAtTime(r0, when);
        src.playbackRate.linearRampToValueAtTime(f.rate, when + Math.max(0.01, (f.bendMs || 90) / 1000));
      } else src.playbackRate.value = f.rate;
      if (f.loop && f.loopEndSec > f.loopStartSec) {
        src.loop = true; src.loopStart = f.loopStartSec; src.loopEnd = f.loopEndSec;
      }
      // head-EQ: gentle lowpass = the dulled highs of the tape head
      let srcOut = src, headBiq = null;
      if (f.mello && f.mello.headEq > 0) {
        headBiq = ctx.createBiquadFilter(); headBiq.type = "lowpass";
        headBiq.frequency.value = 9000 - f.mello.headEq * 6500; headBiq.Q.value = 0.3;
        src.connect(headBiq); srcOut = headBiq;
      }
      const env = ctx.createGain();
      const g = env.gain, gain = (f.gain != null ? f.gain : 0.5) * GAIN;
      g.setValueAtTime(0, when);
      if (f.swell) {   // x² crescendo attack (matches mixPCM's swell shape)
        const N = 17, curve = new Float32Array(N);
        for (let i = 0; i < N; i++) { const x = i / (N - 1); curve[i] = gain * x * x; }
        try { g.setValueCurveAtTime(curve, when, atk); }
        catch (e) { g.linearRampToValueAtTime(gain, when + atk); }
      } else g.linearRampToValueAtTime(gain, when + atk);
      g.setValueAtTime(gain, when + hold);
      g.linearRampToValueAtTime(0, when + hold + rel);
      srcOut.connect(env);
      // per-note channel strip (band-appropriate filter/EQ/comp + saturation +
      // chorus/phaser air). Sends tap POST-strip, like the JS path.
      let post = env, striph = null;
      if (f.strip) { striph = buildStripNodes(ctx, f.strip, when, hold + rel); env.connect(striph.input); post = striph.output; for (const o of striph.oscs) live.active.add(o); }
      const dry = ctx.createGain(); dry.gain.value = f.dry != null ? f.dry : 1; post.connect(dry); dry.connect(dests.dry);
      const rev = ctx.createGain(); rev.gain.value = f.rsend || 0; post.connect(rev); rev.connect(dests.rev);
      const del = ctx.createGain(); del.gain.value = f.dsend || 0; post.connect(del); del.connect(dests.del);
      src.start(when);
      src.stop(when + hold + rel + 0.05);
      live.active.add(src);
      src.onended = () => { live.active.delete(src); try { dry.disconnect(); rev.disconnect(); del.disconnect(); if (headBiq) headBiq.disconnect(); if (striph) { for (const o of striph.oscs) { try { o.stop(); } catch (e) {} live.active.delete(o); } for (const nd of striph.nodes) try { nd.disconnect(); } catch (e) {} } } catch (e) {} };
    };
    live.stopAll = function () {
      for (const s of [...live.active]) { try { s.stop(); } catch (e) {} }
      live.active.clear();
    };
    return live;
  }

  return { midiOfFreq, zoneFor, rateFor, mixPCM, decodeUrlRaw, SamplerLive, GAIN,
    __test: { makeStrip, stripStep, rbjCoefs } };   // faust/strip-fuzz-test.js hooks
});
