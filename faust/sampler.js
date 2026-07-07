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
  function mixPCM(notes, buffers, sr, into, sends, win) {
    const winBase = win ? win.base : 0;
    const busLen = win ? win.len : into.dry.length;
    const total = win ? win.total : into.dry.length;
    const dg = sends.dry != null ? sends.dry : 1, rg = sends.rev || 0, lg = sends.del || 0;
    for (const n of notes) {
      const midi = midiOfFreq(n.freq);
      const z = zoneFor(n.zones, midi);
      if (!z) continue;
      const src = buffers[z.srcId];
      if (!src || !src.length) continue;
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
          const j = s0 + i - winBase;
          if (j >= busLen) break;
          if (j >= 0) { into.dry[j] += v * dg; if (rg) into.rev[j] += v * rg; if (lg) into.del[j] += v * lg; }
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
        const j = s0 + i - winBase;
        if (j >= busLen) break;
        if (j >= 0) { into.dry[j] += v * dg; if (rg) into.rev[j] += v * rg; if (lg) into.del[j] += v * lg; }
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
      const dry = ctx.createGain(); dry.gain.value = f.dry != null ? f.dry : 1; env.connect(dry); dry.connect(dests.dry);
      const rev = ctx.createGain(); rev.gain.value = f.rsend || 0; env.connect(rev); rev.connect(dests.rev);
      const del = ctx.createGain(); del.gain.value = f.dsend || 0; env.connect(del); del.connect(dests.del);
      src.start(when);
      src.stop(when + hold + rel + 0.05);
      live.active.add(src);
      src.onended = () => { live.active.delete(src); try { dry.disconnect(); rev.disconnect(); del.disconnect(); if (headBiq) headBiq.disconnect(); } catch (e) {} };
    };
    live.stopAll = function () {
      for (const s of [...live.active]) { try { s.stop(); } catch (e) {} }
      live.active.clear();
    };
    return live;
  }

  return { midiOfFreq, zoneFor, rateFor, mixPCM, decodeUrlRaw, SamplerLive, GAIN };
});
