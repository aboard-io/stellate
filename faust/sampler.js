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
  function mixPCM(notes, buffers, sr, into, sends) {
    const total = into.dry.length;
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
      for (let i = 0; i < outN; i++) {
        let pos = i * rate;
        if (loop && pos >= z.loopEnd) pos = z.loopStart + ((pos - z.loopStart) % loopLen);
        if (pos >= src.length - 1) break;                    // unlooped: natural end
        const i0 = pos | 0, fr = pos - i0;
        let v = (src[i0] + fr * (src[i0 + 1] - src[i0])) * g;
        if (i < atkN) v *= i / atkN;                          // attack ramp (declick)
        if (i > holdN) v *= Math.max(0, 1 - (i - holdN) / relN); // release ramp
        into.dry[s0 + i] += v * dg;
        if (rg) into.rev[s0 + i] += v * rg;
        if (lg) into.del[s0 + i] += v * lg;
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
    // atk, rel, rsend, dsend, loop, loopStartSec, loopEndSec}
    live.note = function (buffer, when, f) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = f.rate;
      if (f.loop && f.loopEndSec > f.loopStartSec) {
        src.loop = true; src.loopStart = f.loopStartSec; src.loopEnd = f.loopEndSec;
      }
      const env = ctx.createGain();
      const g = env.gain, gain = (f.gain != null ? f.gain : 0.5) * GAIN;
      const atk = Math.max(0.003, f.atk || 0.01), rel = Math.max(0.02, f.rel || 0.09);
      const hold = Math.max(atk, f.durSec);
      g.setValueAtTime(0, when);
      g.linearRampToValueAtTime(gain, when + atk);
      g.setValueAtTime(gain, when + hold);
      g.linearRampToValueAtTime(0, when + hold + rel);
      src.connect(env);
      const dry = ctx.createGain(); dry.gain.value = f.dry != null ? f.dry : 1; env.connect(dry); dry.connect(dests.dry);
      const rev = ctx.createGain(); rev.gain.value = f.rsend || 0; env.connect(rev); rev.connect(dests.rev);
      const del = ctx.createGain(); del.gain.value = f.dsend || 0; env.connect(del); del.connect(dests.del);
      src.start(when);
      src.stop(when + hold + rel + 0.05);
      live.active.add(src);
      src.onended = () => { live.active.delete(src); try { dry.disconnect(); rev.disconnect(); del.disconnect(); } catch (e) {} };
    };
    live.stopAll = function () {
      for (const s of [...live.active]) { try { s.stop(); } catch (e) {} }
      live.active.clear();
    };
    return live;
  }

  return { midiOfFreq, zoneFor, rateFor, mixPCM, decodeUrlRaw, SamplerLive, GAIN };
});
