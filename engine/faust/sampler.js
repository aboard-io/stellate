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
  // chorus/phaser -> (leslie/delay/flanger voice-FX) -> trim. The `strip` spec is
  // built in state-engine (STRIP_PROFILES + per-song voiceFxStage, keyed by role)
  // and rides on u.sampler.strip. leslie = mono rotary AM+doppler; delay = a
  // beat-synced feedback tape echo; flanger = swept short-delay comb — all with
  // LFOs on GLOBAL song time (deterministic, segment-parity byte-equal per note).
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
    // eq2 — a SECOND peaking band (the classic-metal mid-scoop + presence bite
    // needs two: cut ~600 Hz, lift ~3.2 kHz). Absent => byte-identical.
    if (strip.eq2) S.eq2 = rbjCoefs("peak", strip.eq2.f, sr, strip.eq2.q || 1, strip.eq2.gain || 0);
    // saturation: tanh drive. satDrive is the HARDNESS multiplier (default 3 =
    // the original gentle strip; aggressive genres push it to ~8-12 for real
    // fuzz). tanh REDUCES peaks, so heavy drive doubles as clip insurance.
    if (strip.sat) { S.satG = 1 + (strip.satDrive != null ? strip.satDrive : 3) * strip.sat; S.satMix = clampS(strip.satMix != null ? strip.satMix : 0.4, 0, 1); }
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
    // LESLIE (rotary AM + doppler) — the native twin of insert_leslie for sampled
    // voices (organ/keys leads especially). speed 0..1 sets the two rotor rates;
    // an 800 Hz one-pole crossover feeds a doppler-modulated horn delay + AM. The
    // rotor LFOs ride GLOBAL song time (deterministic, like chorus/phaser).
    if (strip.leslie) {
      const l = strip.leslie, sp = clampS(l.speed != null ? l.speed : 0.6, 0, 1);
      const n = Math.ceil(sr * 0.004) + 4;
      S.les = { hRate: 0.80 + sp * (6.70 - 0.80), dRate: 0.66 + sp * (5.50 - 0.66),
        depth: clampS(l.depth != null ? l.depth : 0.7, 0, 1), mix: clampS(l.mix != null ? l.mix : 0.4, 0, 1),
        lp: 0, lpA: 1 - Math.exp(-2 * Math.PI * 800 / sr), buf: new Float32Array(n), n, w: 0,
        base: sr * 0.0018, swing: sr * 0.0012 };
    }
    // per-voice tape DELAY (feedback echo, tone LP in the loop) — the strip twin of
    // insert_delay. timeSec is beat-synced by the caller (state-engine). Buffer
    // sized to the delay time so a long note's echoes stay per-note + deterministic.
    if (strip.delay) {
      const d = strip.delay, ds = Math.max(1, Math.floor((d.timeSec || 0.3) * sr));
      S.dly = { buf: new Float32Array(ds + 2), n: ds + 2, ds,
        fb: clampS(d.feedback != null ? d.feedback : 0.3, 0, 0.9), mix: clampS(d.mix != null ? d.mix : 0.25, 0, 1),
        w: 0, lp: 0, lpA: 1 - Math.exp(-2 * Math.PI * (d.tone || 3000) / sr) };
    }
    // FLANGER (short swept delay + signed feedback) — strip twin of insert_flanger.
    if (strip.flanger) {
      const f = strip.flanger, n = Math.ceil(sr * 0.008) + 4;
      S.fla = { buf: new Float32Array(n), n, w: 0, rate: f.rate || 0.3,
        depth: clampS(f.depth != null ? f.depth : 0.7, 0, 1), fb: clampS(f.feedback != null ? f.feedback : 0.4, -0.95, 0.95),
        mix: clampS(f.mix != null ? f.mix : 0.3, 0, 1), base: sr * 0.0006, swing: sr * 0.005 };
    }
    S.trim = strip.trim != null ? strip.trim : 1;
    return S;
  }

  // process one sample through the per-note strip. `t` = GLOBAL song seconds.
  function stripStep(S, x, t) {
    if (S.hp) x = biq(S.hp, x);
    if (S.lp) x = biq(S.lp, x);
    if (S.eq) x = biq(S.eq, x);
    if (S.eq2) x = biq(S.eq2, x);
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
    if (S.les) {
      const L = S.les, hs = Math.sin(2 * Math.PI * L.hRate * t), ds = Math.sin(2 * Math.PI * L.dRate * t);
      L.lp += L.lpA * (x - L.lp); const low = L.lp, high = x - low;
      L.buf[L.w] = high;
      let d = L.base + L.swing * L.depth * hs; if (d < 0) d = 0; else if (d > L.n - 2) d = L.n - 2;
      let rp = L.w - d; while (rp < 0) rp += L.n;
      const i0 = rp | 0, fr = rp - i0, i1 = (i0 + 1) % L.n;
      const hd = L.buf[i0] + fr * (L.buf[i1] - L.buf[i0]);
      L.w = (L.w + 1) % L.n;
      const wet = (hd * (1 + L.depth * 0.5 * hs) + low * (1 + L.depth * 0.28 * ds)) * 0.9;
      x = (1 - L.mix) * x + L.mix * wet;
    }
    if (S.dly) {
      const D = S.dly; let rp = D.w - D.ds; if (rp < 0) rp += D.n;
      let echo = D.buf[rp];
      D.lp += D.lpA * (echo - D.lp); echo = D.lp;   // tone lowpass in the loop
      D.buf[D.w] = x + D.fb * echo; D.w = (D.w + 1) % D.n;
      x = (1 - D.mix) * x + D.mix * echo;
    }
    if (S.fla) {
      const F = S.fla, lfo = 0.5 - 0.5 * Math.cos(2 * Math.PI * F.rate * t);
      let d = F.base + F.swing * F.depth * lfo; if (d < 1) d = 1; else if (d > F.n - 2) d = F.n - 2;
      let rp = F.w - d; while (rp < 0) rp += F.n;
      const i0 = rp | 0, fr = rp - i0, i1 = (i0 + 1) % F.n;
      const del = F.buf[i0] + fr * (F.buf[i1] - F.buf[i0]);
      F.buf[F.w] = x + F.fb * del; F.w = (F.w + 1) % F.n;
      x = (1 - F.mix) * x + F.mix * del;
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
  // INSTRUMENT-REGISTER LAW backstop (2026-07 audio-quality pass): a zone is
  // never rate-stretched more than +16 st above its root, whatever the caller
  // asks. The mapping layer (state-engine mapEvents) already octave-folds
  // pitched sampler notes into the instrument's honest window (top root +6 st /
  // bottom root -12 st) and sampled-drum tom repitch tops out at ~+11 st, so no
  // engine path reaches this cap — it exists for direct/uncareful callers so a
  // sample can never play at chipmunk rate. Down-stretch is uncapped here
  // (slow playback aliases nothing; the mapping floor handles taste).
  const MAX_STRETCH_UP_ST = 16;
  const rateFor = (z, midi) => Math.pow(2, (Math.min(midi, z.root + MAX_STRETCH_UP_ST) - z.root) / 12);

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
    if (strip.eq2) { const f = ctx.createBiquadFilter(); f.type = "peaking"; f.frequency.value = strip.eq2.f; f.Q.value = strip.eq2.q || 1; f.gain.value = strip.eq2.gain || 0; chain(f); }
    if (strip.sat) { const ws = ctx.createWaveShaper(); ws.curve = satCurve(1 + (strip.satDrive != null ? strip.satDrive : 3) * strip.sat, strip.satMix != null ? strip.satMix : 0.4); ws.oversample = "2x"; chain(ws); }
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
    // LESLIE — perceptual twin: a modulated doppler delay + amplitude tremolo at
    // the horn rotor rate (approximate; live strips are not byte-parallel).
    if (strip.leslie) {
      const l = strip.leslie, sp = clampS(l.speed != null ? l.speed : 0.6, 0, 1), hRate = 0.80 + sp * (6.70 - 0.80), dep = l.depth != null ? l.depth : 0.7;
      parallel({ mix: clampS(l.mix != null ? l.mix : 0.4, 0, 1) * 0.9, wet: (sum, mix) => {
        const dl = ctx.createDelay(0.02); dl.delayTime.value = 0.0018;
        const lfo = ctx.createOscillator(); lfo.frequency.value = hRate;
        const dg = ctx.createGain(); dg.gain.value = 0.0012 * dep; lfo.connect(dg); dg.connect(dl.delayTime);
        const am = ctx.createGain(); am.gain.value = 1;
        const ag = ctx.createGain(); ag.gain.value = 0.5 * dep; lfo.connect(ag); ag.connect(am.gain);
        lfo.start(when); lfo.stop(when + dur + 0.1); oscs.push(lfo);
        const wg = ctx.createGain(); wg.gain.value = mix;
        node.connect(dl); dl.connect(am); am.connect(wg); wg.connect(sum); nodes.push(dl, dg, am, ag, wg);
      } });
    }
    // per-voice tape DELAY — feedback echo with a tone lowpass in the loop.
    if (strip.delay) {
      const d = strip.delay;
      parallel({ mix: clampS(d.mix != null ? d.mix : 0.25, 0, 1), wet: (sum, mix) => {
        const dl = ctx.createDelay(2.0); dl.delayTime.value = Math.min(1.9, d.timeSec || 0.3);
        const fb = ctx.createGain(); fb.gain.value = clampS(d.feedback != null ? d.feedback : 0.3, 0, 0.9);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = d.tone || 3000;
        node.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
        const wg = ctx.createGain(); wg.gain.value = mix; lp.connect(wg); wg.connect(sum); nodes.push(dl, fb, lp, wg);
      } });
    }
    // FLANGER — short swept delay + feedback.
    if (strip.flanger) {
      const f = strip.flanger;
      parallel({ mix: clampS(f.mix != null ? f.mix : 0.3, 0, 1), wet: (sum, mix) => {
        const dl = ctx.createDelay(0.02); dl.delayTime.value = 0.0006;
        const lfo = ctx.createOscillator(); lfo.frequency.value = f.rate || 0.3;
        const lg = ctx.createGain(); lg.gain.value = 0.005 * (f.depth != null ? f.depth : 0.7); lfo.connect(lg); lg.connect(dl.delayTime);
        lfo.start(when); lfo.stop(when + dur + 0.1); oscs.push(lfo);
        const fb = ctx.createGain(); fb.gain.value = clampS(f.feedback != null ? f.feedback : 0.4, -0.95, 0.95);
        node.connect(dl); dl.connect(fb); fb.connect(dl);
        const wg = ctx.createGain(); wg.gain.value = mix; dl.connect(wg); wg.connect(sum); nodes.push(dl, lg, fb, wg);
      } });
    }
    if (strip.trim != null && strip.trim !== 1) { const t = ctx.createGain(); t.gain.value = strip.trim; chain(t); }
    return { input, output: node, oscs, nodes };
  }

  // ---- live PER-UNIT insert chain (INSERTS-ON-SAMPLED-VOICES) --------------
  // Web Audio twins of the declared Faust insert chain for a sampled unit on
  // the ring-path live graph — one LONG-LIVED chain per unit (per-VOICE, like
  // synth units carry inserts), shared by all its notes: note envelopes/strips
  // feed `input`, the unit-level dry/rev/del sends tap `output` (live.js wires
  // them — the render-core insert law, sends POST-chain). Same contract as
  // buildStripNodes: a perceptual twin, NOT byte-parallel — press/stream/wavOut
  // run the real dist/ modules; this keeps the live ring path in character.
  // `inserts` is the NORMALIZED chain off the unit (state-engine insertChain:
  // {type, params} with clamps applied); `barSec` = 4*spb for the tempo-synced
  // types. Oscillators start immediately and run for the chain's life — caller
  // stops them at teardown (returned in `oscs`). Types with no honest native
  // twin (granular) pass DRY and are reported in `skipped` (they still sound
  // on press + the wavOut/mobile lane, where the real module renders).
  function buildInsertNodes(ctx, inserts, barSec) {
    const oscs = [], nodes = [], stages = [], skipped = [];
    const input = ctx.createGain(); nodes.push(input);
    let node = input;
    const chain = (n) => { node.connect(n); node = n; nodes.push(n); };
    const lfo = (hz) => { const o = ctx.createOscillator(); o.frequency.value = hz; o.start(); oscs.push(o); return o; };
    const parallel = (mix, wet) => {   // dry/wet split -> sum; node advances to the sum
      const sum = ctx.createGain();
      const dry = ctx.createGain(); dry.gain.value = 1 - mix; node.connect(dry); dry.connect(sum); nodes.push(dry, sum);
      wet(sum, mix); node = sum;
    };
    for (const eff of (inserts || [])) {
      const p = eff.params || {};
      switch (eff.type) {
        case "chorus": {
          parallel(clampS(p.mix != null ? p.mix : 0.5, 0, 1), (sum, mix) => {
            const dl = ctx.createDelay(0.06); dl.delayTime.value = 0.012;
            const lg = ctx.createGain(); lg.gain.value = 0.005 * (p.depth != null ? p.depth : 0.5);
            lfo(p.rate || 0.8).connect(lg); lg.connect(dl.delayTime);
            const wg = ctx.createGain(); wg.gain.value = mix;
            node.connect(dl); dl.connect(wg); wg.connect(sum); nodes.push(dl, lg, wg);
          }); stages.push("chorus"); break;
        }
        case "phaser": {
          parallel(clampS(p.mix != null ? p.mix : 0.7, 0, 1), (sum, mix) => {
            const dep = p.depth != null ? p.depth : 0.7, center = 700;
            const lg = ctx.createGain(); lg.gain.value = 600 * dep;
            lfo(p.rate || 0.5).connect(lg);
            let apn = node;
            for (let k = 0; k < 4; k++) { const ap = ctx.createBiquadFilter(); ap.type = "allpass"; ap.frequency.value = center; ap.Q.value = 0.7; lg.connect(ap.frequency); apn.connect(ap); apn = ap; nodes.push(ap); }
            nodes.push(lg);
            const wg = ctx.createGain(); wg.gain.value = mix; apn.connect(wg); wg.connect(sum); nodes.push(wg);
          }); stages.push("phaser"); break;
        }
        case "leslie": {
          const sp = clampS(p.speed != null ? p.speed : 0.5, 0, 1), hRate = 0.80 + sp * (6.70 - 0.80), dep = p.depth != null ? p.depth : 0.8;
          parallel(clampS(p.mix != null ? p.mix : 0.6, 0, 1) * 0.9, (sum, mix) => {
            const dl = ctx.createDelay(0.02); dl.delayTime.value = 0.0018;
            const o = lfo(hRate);
            const dg = ctx.createGain(); dg.gain.value = 0.0012 * dep; o.connect(dg); dg.connect(dl.delayTime);
            const am = ctx.createGain(); am.gain.value = 1;
            const ag = ctx.createGain(); ag.gain.value = 0.5 * dep; o.connect(ag); ag.connect(am.gain);
            const wg = ctx.createGain(); wg.gain.value = mix;
            node.connect(dl); dl.connect(am); am.connect(wg); wg.connect(sum); nodes.push(dl, dg, am, ag, wg);
          }); stages.push("leslie"); break;
        }
        case "flanger": {
          parallel(clampS(p.mix != null ? p.mix : 0.6, 0, 1), (sum, mix) => {
            const dl = ctx.createDelay(0.02); dl.delayTime.value = 0.0006;
            const lg = ctx.createGain(); lg.gain.value = 0.005 * (p.depth != null ? p.depth : 0.8);
            lfo(p.rate || 0.4).connect(lg); lg.connect(dl.delayTime);
            const fb = ctx.createGain(); fb.gain.value = clampS(p.feedback != null ? p.feedback : 0.5, -0.95, 0.95);
            node.connect(dl); dl.connect(fb); fb.connect(dl);
            const wg = ctx.createGain(); wg.gain.value = mix; dl.connect(wg); wg.connect(sum); nodes.push(dl, lg, fb, wg);
          }); stages.push("flanger"); break;
        }
        case "delay": {
          const timeSec = Math.min(1.9, (p.timeBars != null ? p.timeBars : 0.1875) * (barSec || 2));
          parallel(clampS(p.mix != null ? p.mix : 0.35, 0, 1), (sum, mix) => {
            const dl = ctx.createDelay(2.0); dl.delayTime.value = timeSec;
            const fb = ctx.createGain(); fb.gain.value = clampS(p.feedback != null ? p.feedback : 0.35, 0, 0.9);
            const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = p.tone || 3000;
            node.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
            const wg = ctx.createGain(); wg.gain.value = mix; lp.connect(wg); wg.connect(sum); nodes.push(dl, fb, lp, wg);
          }); stages.push("delay"); break;
        }
        case "ringmod": {
          parallel(clampS(p.mix != null ? p.mix : 0.4, 0, 1), (sum, mix) => {
            const rm = ctx.createGain(); rm.gain.value = 0;   // out = x * sin(2πft)
            lfo(p.freq || 220).connect(rm.gain);
            const wg = ctx.createGain(); wg.gain.value = mix;
            node.connect(rm); rm.connect(wg); wg.connect(sum); nodes.push(rm, wg);
          }); stages.push("ringmod"); break;
        }
        case "tremolo": {
          parallel(clampS(p.mix != null ? p.mix : 0.8, 0, 1), (sum, mix) => {
            const dep = clampS(p.depth != null ? p.depth : 0.7, 0, 1);
            const am = ctx.createGain(); am.gain.value = 1 - 0.5 * dep;
            const ag = ctx.createGain(); ag.gain.value = 0.5 * dep;
            lfo(p.rate || 5).connect(ag); ag.connect(am.gain);
            const wg = ctx.createGain(); wg.gain.value = mix;
            node.connect(am); am.connect(wg); wg.connect(sum); nodes.push(am, ag, wg);
          }); stages.push("tremolo"); break;
        }
        case "filtersweep": {
          // full-signal swept resonant lowpass (serial — the Faust module has no
          // mix param). LFO period = rateBars * barSec; linear lo..hi Hz sweep.
          const loHz = p.lo || 500, hiHz = Math.max(p.hi || 4000, loHz * 1.05);
          const f = ctx.createBiquadFilter(); f.type = "lowpass";
          f.frequency.value = (loHz + hiHz) / 2; f.Q.value = 0.707 + (p.res || 0) * 6;
          const lg = ctx.createGain(); lg.gain.value = (hiHz - loHz) / 2;
          lfo(1 / Math.max(0.05, (p.rateBars != null ? p.rateBars : 4) * (barSec || 2))).connect(lg);
          lg.connect(f.frequency); nodes.push(lg);
          chain(f); stages.push("filtersweep"); break;
        }
        case "wah": {
          // native envelope follower: |x| (waveshaper) -> 25 Hz lowpass ->
          // scaled into a resonant bandpass's frequency. Approximate (linear-Hz
          // sweep vs the module's exponential octaves) but genuinely dynamic.
          parallel(clampS(p.mix != null ? p.mix : 0.85, 0, 1), (sum, mix) => {
            const base = p.base || 320, range = p.range != null ? p.range : 2.2, sens = p.sens != null ? p.sens : 0.6;
            const bp = ctx.createBiquadFilter(); bp.type = "bandpass";
            bp.frequency.value = base; bp.Q.value = clampS(p.q || 4, 0.5, 12);
            const N = 1024, curve = new Float32Array(N);
            for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = Math.abs(x); }
            const rect = ctx.createWaveShaper(); rect.curve = curve;
            const env = ctx.createBiquadFilter(); env.type = "lowpass"; env.frequency.value = 25; env.Q.value = 0.5;
            const scale = ctx.createGain(); scale.gain.value = sens * base * (Math.pow(2, range) - 1) * 6;
            node.connect(rect); rect.connect(env); env.connect(scale); scale.connect(bp.frequency);
            const wg = ctx.createGain(); wg.gain.value = mix;
            node.connect(bp); bp.connect(wg); wg.connect(sum); nodes.push(bp, rect, env, scale, wg);
          }); stages.push("wah"); break;
        }
        default: skipped.push(eff.type);   // granular &c: dry on the ring path (real module on press/wavOut)
      }
    }
    return { input, output: node, oscs, nodes, stages, skipped };
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

  return { midiOfFreq, zoneFor, rateFor, mixPCM, decodeUrlRaw, SamplerLive, buildInsertNodes, GAIN,
    __test: { makeStrip, stripStep, rbjCoefs } };   // faust/strip-fuzz-test.js hooks
});
