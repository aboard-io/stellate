// faust/state-engine.js — Phase 2 core: kernel state -> Faust voice plan + schedule.
//
// Pure mapping, no audio. Consumed by:
//   - faust/press.js   (node offline render via faustwasm offline processors)
//   - faust/live.js    (browser AudioWorklet live engine, exploreLive facade)
//
// The contract: CsdEngine.buildEvents(state) gives {pitched,drums,found,sfx};
// this module maps every event onto a dist/ voice module + param sets, using
// exactly the recipe->param mappings documented in faust/VOICES.md (which were
// A/B-verified against the csound orchestra in ab-report.md).
//
// Times in the returned schedule are in BEATS (callers convert with spb and
// their own clock origin); param VALUES that are durations (decay, idxTime,
// sfx dur) are already in SECONDS because the modules take seconds.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FaustStateEngine = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const WAVES = ["sine", "saw", "square", "pulse"];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
  const cpspch = (p) => { p = parseFloat(p); const o = Math.floor(p), st = Math.round((p - o) * 100); return 261.625565 * Math.pow(2, (o - 8) + st / 12); };

  // ---- SAMPLED DRUM KITS (additive to the Faust synth kits: kick boom/808/909
  //      · snare noise/crack/clap · hat noise/metal). A genre may select a real
  //      recorded kit (genre-kernel DRUMKITS -> instruments.drums.<x>Sampler);
  //      when present, the kick/snare/hat/tom voice UNIT carries a native sampler
  //      (faust/sampler.js) instead of a Faust module, and mapEvents emits each
  //      drum hit as a fixed-pitch (tom: pitched) UNLOOPED one-shot — the same
  //      native PCM path pitched instrument samplers ride, so it bakes in press
  //      (SP.mixPCM) and streams gaplessly (mustLive). A genre WITHOUT a sampled
  //      kit renders exactly as before (no .sampler on the drum unit).
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // fixed keymap the drum sampler zones are cut against (genre-kernel drumKitSpec):
  //   kick/snare  -> one zone root 60, played at midi 60 => rate 1 (natural pitch)
  //   hat         -> closed zone (root 60, keys 0-65) / open zone (root 72, 66-127)
  //   tom         -> one zone rooted at DRUM_TOM_ROOT; the hit's tom pitch (Hz) is
  //                  emitted as freq so the sample repitches (105Hz => rate 1)
  const DRUM_KS_FREQ = midiToFreq(60);      // kick/snare + closed-hat trigger
  const DRUM_HAT_OPEN_FREQ = midiToFreq(72); // open-hat trigger (selects the open zone)
  const DRUM_TOM_ROOT = 69 + 12 * Math.log2(105 / 440);   // ~44.2: tom base = synth tom default 105Hz
  // velocity->sample-gain calibration: press mixes at (u.lvl)*(sets.gain)*sampler
  // GAIN(1.35); real kit samples peak near full scale, so this lands a sampled
  // kick at ~-6dB for a typical kick level(~1.2)×amp(~0.65). Tune here.
  const DRUM_SAMP_GAIN = 0.5;

  // ---- per-voice insert chain (state.instruments.<voice>.inserts contract) ----
  // 0-2 of {type, ...params}; type ∈ distort/phaser/chorus/filtersweep. Applied
  // INSERT-style between the voice and its layer tap / fx sends (per voice —
  // pad/bass/melody and solos, which inherit melody's recipe — never on the
  // shared buses). Normalized here so live/press share clamps + module names.
  // filtersweep is tempo-synced: `barSec: true` tells the engine to set the
  // module's barSec param from state.bpm (4 beats/bar) and re-set it on glides.
  // Per the kernel contract (csd-engine defaultInstruments): rate is Hz,
  // rateBars = sweep period in bars, and filtersweep lo/hi are OCTAVES
  // RELATIVE TO THE VOICE'S CUTOFF — converted to Hz here (cutoffHz arg).
  function insertChain(m, cutoffHz) {
    const out = [];
    for (const it of (Array.isArray(m.inserts) ? m.inserts : [])) {
      if (!it || out.length >= 2) break;
      switch (it.type) {
        case "distort": out.push({ type: "distort", module: "insert_distort", params: {
          drive: clamp(it.drive != null ? it.drive : 0.5, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 1, 0, 1) } }); break;
        case "phaser": out.push({ type: "phaser", module: "insert_phaser", params: {
          rate: clamp(it.rate != null ? it.rate : 0.5, 0.01, 8),
          depth: clamp(it.depth != null ? it.depth : 0.7, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 0.7, 0, 1) } }); break;
        case "chorus": out.push({ type: "chorus", module: "insert_chorus", params: {
          rate: clamp(it.rate != null ? it.rate : 0.8, 0.01, 8),
          depth: clamp(it.depth != null ? it.depth : 0.5, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 0.5, 0, 1) } }); break;
        // wah — crybaby/Mutron AUTO-WAH (envelope-follower bandpass), for funk/
        // disco bass. sens = envelope drive, base = floor Hz, range = octaves of
        // sweep, q = resonance, mix = dry/wet (0 = bit-exact bypass). No clock.
        case "wah": out.push({ type: "wah", module: "insert_wah", params: {
          sens: clamp(it.sens != null ? it.sens : 0.6, 0, 1),
          base: clamp(it.base != null ? it.base : 320, 80, 1200),
          range: clamp(it.range != null ? it.range : 2.2, 0, 4),
          q: clamp(it.q != null ? it.q : 4, 0.5, 12),
          mix: clamp(it.mix != null ? it.mix : 0.85, 0, 1) } }); break;
        // tremolo — amp AM (surf's Fender bias/opto trem) with a shape morph
        // (0 sine -> 1 hard bias) and a wobble param (exotica's vibraphone-fan
        // cents-level pitch flutter). mix 0 = bit-exact bypass (insert law).
        case "tremolo": out.push({ type: "tremolo", module: "insert_tremolo", params: {
          rate: clamp(it.rate != null ? it.rate : 5, 0.5, 12),
          depth: clamp(it.depth != null ? it.depth : 0.7, 0, 1),
          shape: clamp(it.shape != null ? it.shape : 0, 0, 1),
          wobble: clamp(it.wobble != null ? it.wobble : 0, 0, 1),
          mix: clamp(it.mix != null ? it.mix : 0.8, 0, 1) } }); break;
        case "filtersweep": {
          const base = clamp(cutoffHz || 2000, 60, 12000);
          const loHz = clamp(base * Math.pow(2, it.lo != null ? it.lo : -1), 40, 12000);
          const hiHz = clamp(Math.max(base * Math.pow(2, it.hi != null ? it.hi : 1), loHz * 1.05), 60, 16000);
          out.push({ type: "filtersweep", module: "insert_filtersweep", barSec: true, params: {
            rateBars: clamp(it.rateBars != null ? it.rateBars : 4, 0.25, 64),
            lo: loHz, hi: hiHz,
            res: clamp(it.res != null ? it.res : 0.5, 0, 0.95) } }); break;
        }
      }
    }
    return out;
  }

  function mergedInstruments(E, state) {
    const D = E.defaultInstruments(), s = state.instruments || {};
    return { pad: { ...D.pad, ...s.pad }, bass: { ...D.bass, ...s.bass },
             melody: { ...D.melody, ...s.melody }, drums: { ...D.drums, ...s.drums } };
  }

  // ---- pitched voice unit: recipe -> {module, static params, per-note flags} ----
  // rev/del gains divide out `level` because csound sends tap PRE-level
  // (instr 1/2/4: gaMix += asig*level but gaRev += asig*send) while the Faust
  // modules bake level into their output.
  function pitchedUnit(role, m) {
    // param-reader: clamp(m[k]!=null?m[k]:d,lo,hi) — the null-coalescing default
    // idiom. NOT for `m.x||d` sites (0-is-falsy glide/drive/vibrato keep that).
    const mp = (k, d, lo, hi) => clamp(m[k] != null ? m[k] : d, lo, hi);
    // BASS_TRIM — Paul 2026-07-04, global mix decision: "lower the bass 25%
    // everywhere by default." Applied at the SINGLE realization point (the bass
    // level), so it hits all genres identically in both press and live and
    // preserves every anchor's RELATIVE bass level (the per-anchor `level`
    // ranges are untouched — this is a uniform scalar on top).
    const BASS_TRIM = 0.75;
    const L = (m.level != null ? m.level : 0.6) * (role === "bass" ? BASS_TRIM : 1);
    const lvl = clamp(L, 0.001, 1);
    const sends = { rev: clamp((m.send || 0) / lvl, 0, 6), del: clamp((m.dsend || 0) / lvl, 0, 6) };
    const c = m.cutoff || 2000, res = clamp(m.res != null ? m.res : 0.15, 0, 0.95);
    const base = { role, pool: role === "pad" ? 4 : role === "bass" ? 2 : 3,
      dry: 1, ...sends, lvl, gmul: Math.max(1, L), params: { level: lvl },
      freqMax: 4000, tail: role === "pad" ? 3 : 1, inserts: insertChain(m, c) };
    const atk = clamp(Math.max(role === "pad" ? 0.05 : 0.005, m.attack != null ? m.attack : (role === "pad" ? 1.5 : 0.05)), 0.005, 5);
    const model = m.model || (role === "pad" || role === "bass" ? "saw" : "stack");
    // csound instr-4 "plucky" opt-in: setting ANY of attack/release/fenv swaps
    // the legacy sustained env for attack -> 0.06 decay -> sustain -> release
    // plus an optional per-note filter zap (kcf expseg cutoff*(1+fenv) -> cutoff)
    const plucky = m.attack != null || m.release != null || !!m.fenv;
    const rel = clamp(m.release != null ? m.release : 0.3, 0.01, 3);
    const sus = clamp(m.sustain != null ? m.sustain : 0.85, 0, 1);
    const fev = clamp(m.fenv || 0, 0, 3);
    // per-recipe release/fenv on the bass modules (only when the recipe asks)
    const bassArt = {
      ...(m.release != null ? { release: clamp(m.release, 0.01, 3) } : {}),
      ...(m.fenv != null ? { fenv: clamp(m.fenv, 0, 4) } : {}),
    };

    // NEW CONTRACT — recipe carries {dx7:{algorithm:N, params:{...}}}: play the
    // per-algorithm dx7.lib module with those params. dx7.lib has no output
    // gain — the engine scales externally (GainNode live / PCM in press),
    // per NOTE via extGainPerAmp*amp (same calibration as the rhodes preset).
    if (m.dx7 && m.dx7.algorithm != null) {
      const alg = Math.round(clamp(m.dx7.algorithm, 1, 32));
      return { ...base, module: "dx7_alg" + alg, dx7: true, dx7Params: m.dx7.params || {},
        freqMax: 1000, extGainPerAmp: 1.333 * lvl, params: {} };
    }

    // native pitched sample zones (faust/sampler.js) — no Faust module. ALL
    // roles including bass (upright walking lines). Contract: m.sampler =
    // {id, sr, zones:[{srcId, root, lo, hi, loop, loopStart, loopEnd}]}
    // (kernel toState; zone wavs ride foundSources at vol 0 so both engines
    // decode them through the existing paths). Bass default envelope is
    // shorter/percussive so looped zones never smear a walking line.
    const samplerUnit = () => {
      const sp = m.sampler || {};
      // bass calibration: FluidR3 bass zones peak near full scale while bass
      // events run ~1.7x melody amp — an upright at lead calibration lands
      // ~+10dB over the Faust bass modules at equal recipe level. x0.5 keeps
      // the upright audibly forward (~+4.5dB vs the old piano bass) without
      // drowning the mids (A/B-measured against mix/track-0N band balance).
      // SWELL mode (neoclassical strings pads): attack may run seconds-long
      // (past the zone's loop start — looped zones sustain under it) with an
      // x²-shaped crescendo ramp (sampler.js renders it identically live +
      // press). Clamps widened to 5s/6s for it; every pre-existing sampler
      // recipe sits far below the old caps, so their output is bit-identical.
      // MELLOTRON mode (recipe.mellotron truthy): tape-machine character on the
      // native sampler — wow/flutter pitch modulation, an 8s tape-strip cap with
      // a tape-runs-out release, and gentle head-EQ. Params are morphable recipe
      // dims (wowDepth/flutterDepth/tapeCap/headEq + rates); the anchors set only
      // the boolean flag and take these modest defaults (a numeric recipe key
      // would draw rng — the flag alone keeps buildEvents/verifier byte-stable).
      // Absent => no `mello` field => sampler renders the exact pre-mellotron
      // path (regression-gated bit-identity).
      const mello = m.mellotron ? {
        wowDepth: mp("wowDepth", 0.035, 0, 0.5),        // semitones (slow undulation) — HALVED 2026-07-04 (Paul: tape wobble went too far); was 0.07
        flutterDepth: mp("flutterDepth", 0.0175, 0, 0.5),  // semitones (fast micro-variation) — HALVED 2026-07-04; was 0.035
        wowRate: mp("wowRate", 0.7, 0.1, 3),
        flutterRate: mp("flutterRate", 7, 3, 12),
        tapeCap: m.tapeCap === false ? 0 : clamp(m.tapeCap === true || m.tapeCap == null ? 8 : m.tapeCap, 0, 8),
        headEq: mp("headEq", 0.3, 0, 1),
      } : null;
      return { ...base, gmul: base.gmul * (role === "bass" ? 0.5 : 1), module: null, sampler: {
          id: sp.id || "?", sr: sp.sr || 44100,
          zones: Array.isArray(sp.zones) ? sp.zones : [],
          atk: mp("attack", role === "bass" ? 0.006 : 0.012, 0.003, 5),
          rel: mp("release", role === "bass" ? 0.07 : 0.09, 0.02, 6),
          swell: (m.swell || 0) >= 0.5,
          ...(mello ? { mello } : {}),
        }, freqMax: 4000 };
    };

    // modeld — the Minimoog-Model-D-class MONO voice (3 osc + ladder + filter
    // env + glide; dsp/modeld.dsp). `mono:true` is the pool contract: the
    // engine routes ALL of this unit's notes to ONE voice instance and marks
    // legato notes (gap < legatoSec or overlapping) by HOLDING the gate across
    // the group — freq then slews inside the module (glide) and the envelopes
    // single-trigger. press.js implements it; live's generic pool still plays
    // every note (freq slew intact on reused nodes) but retriggers envelopes
    // until it honors mono (documented in VOICES.md).
    const modeldUnit = (isBassRole) => {
      const relD = mp("release", isBassRole ? 0.12 : 0.25, 0.01, 3);
      return { ...base, module: "modeld", mono: true, legatoSec: 0.03,
        pool: 1,   // MONO: one voice instance, ever (press honors it; live's generic pool doesn't yet — see VOICES.md)
        tail: Math.max(base.tail, relD + 0.4),
        freqMax: isBassRole ? 2000 : 4000,
        params: { ...base.params,
          cutoff: clamp(c, 60, 12000), res,
          envAmount: mp("envAmount", isBassRole ? 1.5 : 1.2, 0, 5),
          envDecay: mp("envDecay", isBassRole ? 0.14 : 0.2, 0.01, 2),
          glide: clamp(m.glide || 0, 0, 500),
          drive: clamp(m.drive || 0.25, 0, 1),
          oscMix: mp("oscMix", 0.5, 0, 1),
          drift: mp("drift", 6, 0, 25),
          attack: mp("attack", 0.004, 0.001, 2),
          sustain: mp("sustain", isBassRole ? 0.8 : 0.9, 0, 1),
          release: relD } };
    };

    // tb303 — the TRUE Roland 303 (dsp/tb303.dsp): mono-legato, SUPERSEDES
    // bass_acid (the kernel switches acidhouse/psytrance to it). Works as bass OR
    // as the acid LEAD line. acid:true tags each note with accent/slide from the
    // event (mapEvents), set before its gate-on; slide holds the gate across the
    // legato group (pool 1, legatoSec 0.06). moog_vcf_2bn filter (diodeLadder is
    // the known-broken normalized-freq family — see VOICES.md).
    const tb303Unit = () => ({ ...base, module: "tb303", mono: true, legatoSec: 0.06, pool: 1, acid: true,
      tail: Math.max(base.tail, 0.4), freqMax: 2000,
      params: { ...base.params,
        cutoff: clamp(c, 60, 6000), resonance: mp("res", 0.7, 0, 1),
        envmod: mp("envmod", 0.55, 0, 1),
        decay: mp("decay", 0.4, 0.03, 2.5),
        waveform: mp("waveform", (m.wave === "square" ? 1 : m.wave === "pulse" ? 0.7 : 0), 0, 1) } });

    if (role === "bass") {
      switch (model) {
        case "modeld": return modeldUnit(true);
        case "tb303":  return tb303Unit();
        case "sub":    return { ...base, module: "bass_sub",   params: { ...base.params, cutoff: clamp(c, 80, 12000) } };
        case "acid":   return { ...base, module: "bass_acid",  params: { ...base.params, cutoff: clamp(c, 80, 12000), res,
          ...(m.release != null ? { release: clamp(m.release, 0.01, 3) } : {}),
          ...(m.fenv != null ? { fenv: clamp(m.fenv, 0, 6) } : {}) } };
        case "reese":  return { ...base, module: "bass_reese", params: { ...base.params, cutoff: clamp(c, 80, 12000) } };
        case "wobble": return { ...base, module: "bass_wobble",params: { ...base.params, cutoff: clamp(c, 80, 12000), res, wobbleHz: clamp(m.wobbleHz || 2.4, 0.1, 12) } };
        case "piano":  return { ...base, module: "piano", decayFromDur: true, params: { ...base.params, cutoff: clamp(Math.min(4000, c * 2.5), 200, 14000) } };
        case "sampler": return samplerUnit();   // the upright &co (native path)
        default:       return { ...base, module: "bass_saw",   params: { ...base.params, cutoff: clamp(c, 80, 12000), res, ...bassArt } };
      }
    }
    const isPad = role === "pad";
    switch (model) {
      case "modeld":  return modeldUnit(false);   // lead/solo only — mono voice, never a (chordal) pad; kernel pools respect that
      case "tb303":   return tb303Unit();          // the acid LEAD line (same mono 303; lead/solo only)
      case "organ":   return { ...base, module: "organ",   params: { ...base.params, cutoff: clamp(c, 80, 12000), attack: atk } };
      case "strings": return { ...base, module: "strings", params: { ...base.params, cutoff: clamp(c, 80, 12000), attack: atk } };
      case "choir":   return { ...base, module: "choir",   params: { ...base.params, cutoff: clamp(Math.min(isPad ? 8000 : 9000, c * 2.5), 200, 12000), attack: atk } };
      case "bell":    return { ...base, module: "bell", decayFromDur: true, params: { ...base.params, cutoff: clamp(c, 200, 14000), res: clamp(res, 0, 0.95) } };
      case "piano":   return { ...base, module: "piano", decayFromDur: true, params: { ...base.params, cutoff: clamp(Math.min(isPad ? 8000 : 9000, c * 2), 200, 14000) } };
      case "brass":   return { ...base, module: "brass", biteFromAmp: true, params: { ...base.params, cutoff: clamp(Math.min(12000, c), 500, 12000), attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.08), 0.005, 3) } };
      case "fm":      return isPad
        ? { ...base, module: "fm2op", params: { ...base.params, cutoff: clamp(Math.min(8000, c * 1.7), 200, 14000), ratio: 2.001, idx0: 2.6, idx1: 0.9, idxTime: 1.1, attack: atk, vibrato: 0 } }
        : { ...base, module: "fm2op", fmLead: true, params: { ...base.params, cutoff: clamp(c, 200, 14000), ratio: 1.4, idx0: 3.5, idx1: 1.0, attack: clamp(m.attack != null ? m.attack : 0.05, 0.001, 5), vibrato: clamp(m.vibrato || 0, 0, 0.03), vibRate: clamp(m.vibRate || 5.2, 0.1, 12),
            ...(plucky ? { decay: 0.06, sustain: sus, release: rel, fenv: fev } : {}) } };
      case "rhodes":  return { ...base, module: "dx7_alg5", dx7: true, dx7Preset: "E.PIANO 1", freqMax: 1000,
        // dx7.lib has no output gain; ab-render matched csound at raw*0.28 vs
        // csound amp 0.3 * level 0.7 => external scale = 1.333 * amp * level
        extGainPerAmp: 1.333 * lvl, params: {} };
      case "sampler": return samplerUnit();
      case "pluck":   return { ...base, module: "lead_pluck",  params: { ...base.params, cutoff: clamp(c, 200, 14000), res, damp: 2000,
        ...(plucky ? { release: rel, fenv: fev } : {}) } };
      case "kpluck":  return { ...base, module: "lead_kpluck", flangeFromTime: true, params: { ...base.params, cutoff: clamp(c, 200, 14000), drive: clamp(m.drive || 0, 0, 1) } };
      case "fuzz":    return { ...base, module: "lead_fuzz",   params: { ...base.params, cutoff: clamp(c, 200, 14000), res, drive: clamp(m.drive || 0, 0, 1), vibrato: clamp(m.vibrato || 0, 0, 0.03), vibRate: clamp(m.vibRate || 5.2, 0.1, 12),
        ...(plucky ? { attack: clamp(m.attack != null ? m.attack : 0.05, 0.001, 5), sustain: sus, release: rel, fenv: fev } : {}) } };
      case "guitar":  return { ...base, module: "lead_guitar", params: { ...base.params, cutoff: clamp(c || 4500, 200, 14000), pluckPos: 0.75 } };
      case "vocoder": return { ...base, module: "robot_choir", vocoder: true, params: { ...base.params, cutoff: clamp(isPad ? Math.min(9000, c * 2) : c, 200, 14000), res, makeup: 5 } };
      // ---- synth fleet (2026-07): nine classic-synth voices (dsp/*.dsp) ----
      // juno60 — Roland Juno-60 poly pad/keys, STEREO (BBD chorus is the width).
      // One shared ADSR drives VCF+VCA (authentic); SIGNED envAmount (Juno
      // polarity); chorus 0..2 (off->I->II). chorusSpread is the stereo width
      // (distinct from supersaw's `spread` = detune, so the recipes don't collide).
      case "juno60":  return { ...base, module: "juno60", stereo: true, pool: 4, freqMax: 4000,
        params: { ...base.params, cutoff: clamp(c, 60, 16000), res,
          envAmount: mp("envAmount", isPad ? 1.4 : 1.0, -4, 6),
          keytrack: mp("keytrack", 0.3, 0, 1),
          lfoToFilter: mp("lfoToFilter", 0, 0, 3),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.02), 0.001, 5),
          decay: mp("decay", isPad ? 1.2 : 0.6, 0.005, 5),
          sustain: mp("sustain", isPad ? 0.7 : 0.4, 0, 1),
          release: mp("release", isPad ? 1.5 : 0.4, 0.005, 6),
          chorus: mp("chorus", isPad ? 1.4 : 1.0, 0, 2),
          spread: mp("chorusSpread", 0.9, 0, 1),
          sawLevel: mp("sawLevel", 0.6, 0, 1),
          pulseLevel: mp("pulseLevel", 0.5, 0, 1),
          subLevel: mp("subLevel", 0.3, 0, 1),
          noiseLevel: mp("noiseLevel", 0, 0, 1),
          pwmBase: mp("pwmBase", 0.5, 0.05, 0.5),
          pwmLfo: mp("pwmLfo", 0.15, 0, 0.45) } };
      // hammond — B-3 tonewheel organ + Leslie, STEREO. The nine drawbars are
      // THE morph dims; leslie 0 chorale..1 tremolo (rotor inertia in the module).
      case "hammond": return { ...base, module: "hammond", stereo: true, pool: 4, freqMax: 4000,
        params: { ...base.params,
          bar16: mp("bar16", 8, 0, 8), bar513: mp("bar513", 3, 0, 8),
          bar8: mp("bar8", 8, 0, 8), bar4: mp("bar4", 6, 0, 8),
          bar223: mp("bar223", 0, 0, 8), bar2: mp("bar2", 0, 0, 8),
          bar135: mp("bar135", 0, 0, 8), bar113: mp("bar113", 0, 0, 8),
          bar1: mp("bar1", 0, 0, 8),
          leslie: mp("leslie", 0.85, 0, 1),
          perc: mp("perc", 0.5, 0, 1),
          percHarm: mp("percHarm", 0, 0, 1),
          percDecay: mp("percDecay", 0.35, 0.05, 2),
          click: mp("click", 0.25, 0, 1),
          leak: mp("leak", 0.35, 0, 1),
          drive: mp("drive", 0.15, 0, 1),
          attack: mp("attack", isPad ? 0.02 : 0.006, 0.001, 0.5),
          release: mp("release", 0.02, 0.005, 1) } };
      // vp330 — Roland VP-330 ghost-choir, STEREO. vowel + ensemble morph; a dark
      // instrument (cutoff mapped straight; it self-limits).
      case "vp330":   return { ...base, module: "vp330", stereo: true, pool: 4, freqMax: 4000,
        params: { ...base.params, cutoff: clamp(c, 300, 12000),
          vowel: mp("vowel", 0.3, 0, 1),
          breath: mp("breath", 0.15, 0, 1),
          ensemble: mp("ensemble", 0.6, 0, 1),
          detune: mp("vpDetune", 0.4, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.08), 0.005, 3),
          sustain: mp("sustain", 0.9, 0, 1),
          release: mp("release", 0.6, 0.02, 5) } };
      // solina — ARP/Eminent String Ensemble, MONO out. ensemble is the identity
      // dim; NO res param; cutoff->tone (<=12000). Ensemble chorus is built in —
      // NEVER stack an insert_chorus, so inserts are dropped for this voice.
      case "solina":  return { ...base, module: "solina", pool: isPad ? 6 : 4, inserts: [],
        params: { ...base.params, tone: clamp(Math.min(12000, c), 300, 12000),
          octave: mp("octave", 0.55, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.012), 0.002, 1.5),
          release: mp("release", 0.22, 0.02, 3),
          chorusRate: mp("chorusRate", 0.62, 0.05, 4),
          chorusDepth: mp("chorusDepth", 0.9, 0, 1),
          ensemble: mp("ensemble", 0.85, 0, 1) } };
      // synclead — hard-sync tearing lead, MONO-LEGATO (modeld's contract; melody/
      // solo only, never a pad). syncRatio + env-driven syncSweep are the signature
      // dims; filter env in OCTAVES like modeld. syncDetune = the 2nd pair, CENTS.
      case "synclead": return { ...base, module: "synclead", mono: true, legatoSec: 0.03, pool: 1,
        tail: Math.max(base.tail, (m.release != null ? m.release : 0.2) + 0.4), freqMax: 4000,
        params: { ...base.params, cutoff: clamp(c, 60, 16000), res,
          syncRatio: mp("syncRatio", 1.5, 1, 4),
          syncSweep: mp("syncSweep", 1.5, 0, 4),
          syncDecay: mp("syncDecay", 0.18, 0.01, 1.5),
          detune: mp("syncDetune", 8, 0, 40),
          envAmount: mp("envAmount", 1.8, 0, 5),
          envDecay: mp("envDecay", 0.16, 0.01, 2),
          glide: clamp(m.glide || 0, 0, 500),
          drive: mp("drive", 0.3, 0, 1),
          attack: mp("attack", 0.004, 0.001, 2),
          sustain: mp("sustain", 0.85, 0, 1),
          release: mp("release", 0.2, 0.01, 3) } };
      // casiocz — Casio CZ phase-distortion keys/lead, MONO out, per-note gate
      // (NOT legato). wave = the CZ index family morph; dcw* = the DCW contour
      // (identity). czWave/czDetune are dedicated keys (recipe `wave` is a string).
      case "casiocz": return { ...base, module: "casiocz", pool: 4,
        params: { ...base.params, cutoff: clamp(c, 200, 16000),
          wave: mp("czWave", 0.5, 0, 1),
          index: mp("index", 0.25, 0, 1),
          dcwAmount: mp("dcwAmount", 0.6, 0, 1),
          dcwAttack: mp("dcwAttack", 0.005, 0.001, 2),
          dcwDecay: mp("dcwDecay", 0.35, 0.005, 3),
          dcwSustain: mp("dcwSustain", 0.35, 0, 1),
          detune: mp("czDetune", 4, 0, 40),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.005), 0.001, 3),
          decay: mp("decay", 0.12, 0.005, 3),
          sustain: mp("sustain", 0.85, 0, 1),
          release: mp("release", 0.3, 0.005, 4) } };
      // oberheim — Prophet-5/SEM poly pad, MONO out. Hand-rolled TPT SVF;
      // filterMode 0 LP .5 BP 1 HP; poly-mod (pmFM/pmFilt/osc2lfo) 0 = clean pad.
      case "oberheim": return { ...base, module: "oberheim", pool: 4,
        params: { ...base.params, cutoff: clamp(c, 40, 16000), res: mp("res", 0.15, 0, 1),
          filterMode: mp("filterMode", 0, 0, 1),
          envAmount: mp("envAmount", 1.3, 0, 5),
          envAttack: mp("envAttack", 0.9, 0.001, 5),
          envDecay: mp("envDecay", 1.4, 0.01, 5),
          envSustain: mp("envSustain", 0.75, 0, 1),
          detune: mp("obDetune", 9, 0, 50),
          osc2tune: mp("osc2tune", 0, -36, 24),
          osc2lfo: mp("osc2lfo", 0, 0, 1),
          lfoRate: mp("lfoRate", 4, 0.02, 14),
          pmFM: mp("pmFM", 0, 0, 1),
          pmFilt: mp("pmFilt", 0, 0, 1),
          drive: mp("drive", 0.12, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.8), 0.002, 5),
          sustain: mp("sustain", 0.8, 0, 1),
          release: mp("release", 2.4, 0.01, 6) } };
      // ppg — PPG-Wave wavetable-scan poly pad+lead, MONO out. scan is the star
      // dim (a genre-space "wavetable spectral position"); scanEnv is SIGNED.
      case "ppg":     return { ...base, module: "ppg", pool: isPad ? 4 : 3,
        params: { ...base.params, cutoff: clamp(c, 60, 16000), res,
          scan: mp("scan", 0.35, 0, 1),
          scanEnv: mp("scanEnv", 0.3, -1, 1),
          scanLfo: mp("scanLfo", 0, 0, 0.5),
          scanRate: mp("scanRate", 0.3, 0.01, 12),
          envAmount: mp("envAmount", 0.5, 0, 4),
          drive: mp("drive", 0.12, 0, 1),
          sub: mp("sub", 0.15, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.01), 0.001, 2),
          sustain: mp("sustain", 0.85, 0, 1),
          release: mp("release", 0.4, 0.01, 3) } };
      default: { // "stack"/"saw" -> pad_saw (pads) or supersaw (leads)
        if (isPad) return { ...base, module: "pad_saw", params: { ...base.params, cutoff: clamp(c, 80, 12000), res, detune: clamp(m.detune != null ? m.detune : 0.006, 0, 0.05), attack: atk } };
        const v = clamp(m.voices || 2, 1, 7);
        return { ...base, module: "supersaw", freqMax: 8000, params: { ...base.params,
          wave: Math.max(0, WAVES.indexOf(m.wave || "sine")), voices: v,
          detune: clamp(m.spread != null ? m.spread : 0.004, 0, 0.05),
          octave: clamp(m.octave != null ? m.octave : (v <= 2 ? 0.16 : 0.12), 0, 0.4),
          vibrato: clamp(m.vibrato || 0, 0, 0.03), vibRate: clamp(m.vibRate || 5.2, 0.1, 12),
          cutoff: clamp(c, 80, 18000), res,
          attack: clamp(m.attack != null ? m.attack : 0.05, 0.001, 2),
          release: rel, sustain: sus, fenv: fev } };
      }
    }
  }

  // ---- CPU COST MODEL (2026-07-04, FEEL+CPU-BUDGET round) ----------------------
  // Per-module render cost, MEASURED on this machine via an 8s offline-render
  // timing probe (faust/bench.js is the live cousin; the probe instantiated one
  // OfflineProcessor per module, gated a note / fed noise, timed min-of-3 passes),
  // normalized to pad_saw = 1.0. APPROXIMATIONS — the ORDER matters more than the
  // digits (a faster machine scales them all together). DX7 is the standout: the
  // 6-operator FM voice costs ~6.4x pad_saw, so a genre that stacks a dx7 melody
  // + dx7 solo licks (dinosynth) is by far the heaviest citizen in the space.
  // sfx (the riser/sweep synth) and fx_bus (always-on master) are the other big
  // ones. These doubles double as future-optimization targets (see the burn
  // table in the round's report).
  const COST = {
    // fleet pads
    pad_saw: 1, juno60: 1.76, vp330: 1.96, solina: 1.18, oberheim: 0.72, ppg: 1.32,
    organ: 0.4, strings: 0.64, choir: 0.29,
    // fleet leads
    supersaw: 2.47, fm2op: 0.53, lead_pluck: 1.3, lead_kpluck: 0.56, lead_fuzz: 1.43,
    lead_guitar: 0.55, synclead: 1.68, casiocz: 1.82, bell: 1.24, piano: 0.45,
    brass: 1.16, hammond: 0.89, robot_choir: 2.07,
    // bass
    bass_saw: 0.84, bass_sub: 0.47, bass_acid: 0.94, bass_reese: 0.5, bass_wobble: 1.15,
    // mono synths
    modeld: 1.48, tb303: 1.5,
    // drums / one-shots
    kick_boom: 0.28, kick_808: 0.3, kick909: 0.29, snare_noise: 0.09, snare_crack: 0.09,
    snare_clap: 0.07, hat_noise: 0.18, hat_metal: 0.41, tom: 0.45, stab: 0.15, sfx: 2.43,
    // inserts
    insert_distort: 1.01, insert_phaser: 0.62, insert_chorus: 0.18, insert_wah: 0.69,
    insert_tremolo: 0.51, insert_filtersweep: 1.47,
    // reverb colors + master
    reverb_dattorro: 0.49, reverb_greyhole: 2.37, reverb_fdn: 0.75, reverb_spring: 0.61,
    fx_bus: 2.32, master_mb: 1.55, rev_bleed: 0.18,
  };
  const DX7_COST = 6.4;      // any dx7_algN — the 6-op FM voice (measured 6.2-6.7)
  const SAMPLER_COST = 0.3;  // native PCM zone playback (no worklet) — cheap per voice
  // live's effective pool table (mirrors live.js POOL_SIZE + the heavy/dx7/mono caps):
  // Faust worklets render EVERY block whether or not a note is gated, so the whole
  // pool is always-on cost. cost = effectivePool * moduleCost.
  const POOL_SIZE = { pad: 4, bass: 2, melody: 3, solo: 2 };
  const HEAVY_FLEET = ["juno60", "hammond", "vp330", "solina", "ppg"];
  function effectivePool(u) {
    if (u.drum || u.hold) return (u.pool > 1 ? 2 : 1);
    let n = POOL_SIZE[u.role] || u.pool || 2;
    if (u.dx7) n = Math.min(n, 2);
    if (HEAVY_FLEET.includes(u.module)) n = Math.min(n, 3);
    if (u.mono) n = 1;
    if (u.poolCap != null) n = Math.min(n, u.poolCap);   // trim-to-budget shed
    return n;
  }
  const moduleCost = (u) => u.sampler ? SAMPLER_COST : u.dx7 ? DX7_COST : (COST[u.module] != null ? COST[u.module] : 0.6);
  function unitCost(u) {
    let c = effectivePool(u) * moduleCost(u);
    for (const ins of (u.inserts || [])) c += (COST[ins.module] || 0.5);
    return c;
  }
  // total cost of a resolved state: the always-on fx_bus + every voice unit's
  // (pool x module) + inserts + the opt-in reverb color (one node + its bleed
  // twin) + the opt-in multiband master glue.
  function stateCost(units, state) {
    let total = COST.fx_bus;
    for (const u of Object.values(units)) if (u && !u.__meta) total += unitCost(u);
    const rc = reverbColor(state);
    if (rc) total += (COST[rc.module] || 0.6) + COST.rev_bleed;
    if (masterMb(state)) total += COST.master_mb;
    return total;
  }

  // ---- DETERMINISTIC TRIM-TO-BUDGET (2026-07-04) --------------------------------
  // A zero-rng guard, applied at unit-build time (so press + live shed identically).
  // BUDGET is a mobile-safety ceiling in cost units: the heaviest NORMAL genre
  // (house ~38, then newjack ~37, transitwave ~32 — the historical heaviest) sits
  // JUST under it, so MOST STATES TRIM NOTHING (measured: 0 of 63 genres trim on
  // any seed). It only bites when stacked blends + density/energy macros pile
  // SHEDDABLE extras on top (a dense blend+macros can reach ~41-54). dinosynth
  // (~64-70 when its melody+solos all roll dx7) is the lone genre over budget on
  // its own — but its weight IS its identity (dx7 protected below), so it sheds the
  // safe extras (a pad voice, a non-identity lick) and logs the irreducible rest.
  //
  // Shed order (each step re-checks cost; stops the instant we're under budget):
  //   1. 2nd+ inserts on any voice     (the 1st insert is kept — identity seasoning)
  //   2. pad pool -1, toward a floor of 2
  //   3. extra NON-IDENTITY solo/lick voices (the transition micro-licks & counters
  //      beyond the first) — never a dx7 / tb303 / tremolo-carrying solo
  // NEVER shed: reverbColor, masterComp, dx7 voices, tb303, tremolo inserts, the
  // primary pad/bass/melody voice itself, or any voice's FIRST insert.
  const BUDGET = 40;
  const isIdentitySolo = (u) => u.dx7 || u.module === "tb303" || (u.inserts || []).some((i) => i.type === "tremolo");
  function trimToBudget(units, state) {
    const shed = [];
    let cost = stateCost(units, state);
    const budget = BUDGET;
    const under = () => stateCost(units, state) <= budget;
    if (cost > budget) {
      // 1. drop 2nd+ inserts, in a stable key order, heaviest state first only by
      //    fixed traversal (zero-rng): pad, bass, melody, then solos sorted by key.
      const keysInOrder = ["pad", "bass", "melody", ...Object.keys(units).filter((k) => k.startsWith("solo:")).sort()];
      for (const k of keysInOrder) {
        if (under()) break;
        const u = units[k];
        if (u && Array.isArray(u.inserts) && u.inserts.length > 1) {
          shed.push(k + ":inserts[" + u.inserts.slice(1).map((i) => i.type).join(",") + "]");
          u.inserts = u.inserts.slice(0, 1);
        }
      }
      // 2. pad pool -1 toward floor 2
      while (!under() && units.pad) {
        const cur = effectivePool(units.pad);
        if (cur <= 2) break;
        units.pad.poolCap = cur - 1;
        shed.push("pad:pool" + cur + "->" + (cur - 1));
      }
      // 3. drop extra non-identity solo voices (keep the first; keep any identity solo)
      const solos = Object.keys(units).filter((k) => k.startsWith("solo:")).sort();
      const droppable = solos.filter((k) => !isIdentitySolo(units[k]));
      // keep at least one solo overall — drop from the end of the droppable list
      for (let i = droppable.length - 1; i >= 0 && !under(); i--) {
        if (solos.length - shed.filter((s) => s.startsWith("solo-drop")).length <= 1) break;
        shed.push("solo-drop:" + droppable[i].slice(0, 24));
        delete units[droppable[i]];
      }
    }
    cost = stateCost(units, state);
    // debug field: press.js logs it; live could too. __meta so stateCost skips it.
    units.__budget = { __meta: true, budget, cost: +cost.toFixed(2),
      over: +(cost - budget).toFixed(2) > 0, shed,
      note: (cost > budget && shed.length) ? "over budget after safe sheds (identity floor)"
        : (cost > budget) ? "over budget; all excess is identity (nothing safe to shed)" : "within budget" };
    return units;
  }

  // ---- the full unit table for a state ----
  function voiceUnits(E, state) {
    const I = mergedInstruments(E, state);
    const units = {};
    units.pad = pitchedUnit("pad", I.pad);
    units.bass = pitchedUnit("bass", I.bass);
    units.melody = pitchedUnit("melody", I.melody);
    for (const v of (E.soloVoices ? E.soloVoices(state, I.melody) : []))
      units["solo:" + v.key] = pitchedUnit("solo", v.recipe);
    const D = I.drums;
    // drum sends are POST everything in csound (asig includes amp+kit level)
    units.kick = { module: { boom: "kick_boom", "808": "kick_808", "909": "kick909" }[D.kickModel] || "kick_boom",
      pool: 1, dry: 1, rev: (D.send || 0) * 0.35, del: 0, lvl: D.kick != null ? D.kick : 1, drum: true,
      params: { tune: clamp(D.tune != null ? D.tune : 1, 0.5, 2) }, tail: 0.6 };
    units.snare = { module: { noise: "snare_noise", crack: "snare_crack", clap: "snare_clap" }[D.snareModel] || "snare_noise",
      pool: 1, dry: 1, rev: D.send || 0, del: D.dsend || 0, lvl: D.snare != null ? D.snare : 1, drum: true, params: {}, tail: 0.4 };
    // csound instr 12 mixes hats at *0.7 — folded into level (ab-render did the same)
    units.hat = { module: { noise: "hat_noise", metal: "hat_metal" }[D.hatModel] || "hat_noise",
      pool: 1, dry: 1, rev: (D.send || 0) * 0.3, del: (D.dsend || 0) * 0.5, lvl: (D.hat != null ? D.hat : 1) * 0.7, drum: true, params: {}, tail: 0.4 };
    units.tom = { module: "tom", pool: 1, dry: 1, rev: (D.send || 0) * 1.4, del: D.dsend || 0,
      lvl: D.tom != null ? D.tom : 1, drum: true, params: {}, tail: 0.6 };
    // SAMPLED KIT (additive): when instruments.drums carries per-drum sampler
    // specs (genre-kernel drumKitSpec, from a genre's drums.kit), overlay a
    // native sampler onto the matching voice UNIT. press/stream see u.sampler
    // FIRST (same branch pitched instrument samplers use) and render the
    // one-shots via SP.mixPCM; the Faust `module` stays as the metadata/fallback
    // (unused while .sampler is set). drum:true keeps it mustLive. atk tiny (keep
    // the transient), rel short declick. A kit that omits a drum leaves that
    // voice on its synth module.
    const drumSamp = (unit, spec) => {
      if (!spec || !Array.isArray(spec.zones) || !spec.zones.length) return;
      unit.sampler = { id: spec.id || "drumkit", sr: spec.sr || 44100, zones: spec.zones,
        atk: 0.0006, rel: 0.03, oneShotSec: spec.oneShotSec || 1, swell: false };
    };
    drumSamp(units.kick, D.kickSampler);
    drumSamp(units.snare, D.snareSampler);
    drumSamp(units.hat, D.hatSampler);
    drumSamp(units.tom, D.tomSampler);
    units.stab = { module: "stab", pool: 2, dry: 1, rev: 0.35, del: 0.3, lvl: 1, drum: true, params: { level: 1 }, tail: 0.6, freqMax: 2000 };
    units.sfx = { module: "sfx", pool: 2, dry: 1, rev: 0.3, del: 0, lvl: 1, hold: true, params: { level: 1 }, tail: 1.2 };
    return trimToBudget(units, state);
  }

  // ---- ZERO-STATIC Stage 3: STEM CLASSING — which units the rolling stem
  // pre-render takes off the audio thread. CACHED = the heavy synthesis the
  // live worklets pay for every block (dx7 family ~12.8/unit, supersaw leads
  // ~7.4, juno60/vp330/hammond/solina/ppg/oberheim pads 2.7-5.9, lead_pluck
  // fleets 3.9 — R7's irreducible steady-state cost) PLUS their insert chains
  // (unitCost already includes them; a cached unit's inserts render in the
  // worker, render-core's whole-chain path). LIVE = everything rhythm-critical
  // or engine-native: bass, drums (kick/snare/hat/tom), stab, sfx, vocoder
  // (its looped speech feed is an AudioBufferSourceNode into the worklet —
  // no offline twin), sampler/native PCM, and MONO-LEGATO voices (a legato
  // group crossing a bar boundary can't withdraw an already-rendered gate-off
  // in the worker — modeld/tb303/synclead stay on the live pool where the
  // gate hold works; they all sit under the threshold anyway).
  //
  // STEM_COST_MIN is the tunable knob: a unit is worth shipping to the worker
  // when its LIVE cost (effectivePool x module COST + inserts — unitCost, the
  // same table the 2.3 awake ceiling enforces) is >= this many pad_saw units.
  // 2.0 ~= "anything heavier than a couple of organs"; raise it to cache less,
  // lower it to cache more. Module-level COST >= 2.0 alone would miss the
  // heavy-fleet pads (juno60 is 1.76/node but 3 nodes render every block),
  // which are exactly the R7 residue Stage 3 exists to remove — hence the
  // pool-weighted unit cost.
  const STEM_COST_MIN = 2.0;
  function stemClass(units) {
    const cached = [], live = [];
    for (const [key, u] of Object.entries(units)) {
      if (!u || u.__meta) continue;
      const mustLive = u.sampler || u.drum || u.hold || u.vocoder || u.mono ||
        u.role === "bass" || key === "bass" || key === "stab" || key === "sfx";
      if (!mustLive && unitCost(u) >= STEM_COST_MIN) cached.push(key);
      else live.push(key);
    }
    return { cached, live };
  }

  // ---- reverb COLOR (fx wings round) — a per-genre-selectable reverb node ----
  // state.reverbColor names an EXTERNAL reverb module (dist/reverb_*) that
  // replaces the fx_bus internal zita for that genre. Absent / "zita" / "default"
  // => the internal zita path (byte-identical to pre-wings renders). The color
  // modules share a uniform interface (rgain = reverb*3.2 like the default; a
  // baked TRIM equalizes their tail energy to the zita reference so a genre's
  // `reverb` scalar means the same wetness across colors). The callers (press +
  // live) build ONE external reverb node, feed it the (mono) reverb-send bus,
  // and mix its stereo wet back into the dry path so it flows through the master
  // chain; fxParams sets the internal rgain to 0 whenever a color is active.
  const REVERB_COLORS = { dattorro: "reverb_dattorro", greyhole: "reverb_greyhole",
    fdn: "reverb_fdn", spring: "reverb_spring" };
  const REVERB_TONE = { dattorro: 5200, greyhole: 2600, fdn: 6000, spring: 3400 };
  function reverbColor(state) {
    const module = REVERB_COLORS[state && state.reverbColor];
    if (!module) return null;   // default => fx_bus internal zita
    const rv = state.reverb != null ? state.reverb : 0.7;
    return { name: state.reverbColor, module, rgain: clamp(rv * 3.2, 0, 3.5), rtone: REVERB_TONE[state.reverbColor] };
  }

  // ---- AUTO-TUNE (fx wings stage 2) — snap found VOICE clips to the song scale ----
  // Returns {strength, pcs} or null. `pcs` = the set of scale pitch-classes (0-11)
  // the state actually harmonizes over: the pitch classes of the progression's
  // chord tones, transposed by keyOffset (the effective key). found-player uses it
  // to bend each voice clip's DETECTED median pitch onto the nearest scale tone,
  // scaled by state.autoTune. Absent/0 => null => no bend (byte-identical). Zero
  // rng, purely derived — mirrors reverbColor's "gain a field, change nothing else".
  // LIMITATION: uses the base key; per-section keyShift (the 3-minute rule) is not
  // tracked, so a shifted section snaps to the home scale (a near-enough aesthetic
  // auto-tune, not a transcription).
  function autoTune(E, state) {
    const strength = clamp(state && state.autoTune != null ? state.autoTune : 0, 0, 1);
    if (!(strength > 0)) return null;
    const prg = E && E.PROGRESSIONS && E.PROGRESSIONS[state.progression];
    const k = (state.keyOffset | 0), seen = new Set(), pcs = [];
    if (prg && prg.chords) for (const ch of prg.chords)
      for (const p of (ch.pads || [])) {
        const pc = ((parseInt(String(p).split(".")[1] || "0", 10) + k) % 12 + 12) % 12;
        if (!seen.has(pc)) { seen.add(pc); pcs.push(pc); }
      }
    if (!pcs.length) return null;
    return { strength, pcs };
  }

  // ---- fx_bus params from state (rgain = reverb*3.2 per A/B calibration; the
  // fx_bus rgain slider caps at 2, so reverb > 0.625 saturates the return) ----
  function fxParams(state) {
    const spb = 60 / state.bpm, dl = state.delay || {};
    const pp = state.pingpong || {};
    const colored = !!REVERB_COLORS[state && state.reverbColor];   // internal zita off when a color is active
    return {
      rgain: colored ? 0 : clamp((state.reverb != null ? state.reverb : 0.7) * 3.2, 0, 2), dgain: 1,
      rtone: 2000,   // reverb return tone (legacy fixed 2 kHz; live eco-3 dulls it)
      dtime: clamp((dl.beats || 0.75) * spb, 0.02, 1.9),
      dfb: clamp(dl.feedback != null ? dl.feedback : 0.3, 0, 0.92),
      dcut: clamp(dl.cutoff || 2600, 300, 9000),
      pptime: clamp((pp.beats || 0.75) * spb, 0.05, 2.4),
      ppfb: clamp(pp.feedback || 0.66, 0, 0.85),
      pptone: clamp(pp.cutoff || 3000, 300, 9000),
      pump: clamp(state.pump || 0, 0, 0.9), bps: clamp(state.bpm / 60, 0.2, 8),
      crackle: clamp(state.crackle || 0, 0, 1), grit: clamp(state.grit || 0, 0, 1),
      comp: clamp(state.comp || 0, 0, 1),
      lowcut: clamp((state.tone && state.tone.lowcut) || 10, 10, 400),
      highcut: (state.tone && state.tone.highcut) ? clamp(state.tone.highcut, 1000, 20500) : 20500,
      mcut: 21000, scmix: 0,
    };
  }

  // ---- MULTIBAND MASTER COMP (fx wings stage 4) — an OPT-IN external node ----
  // Returns {module:"master_mb", mbdrive} or null. NOT baked into fx_bus: the
  // mband branch ran even at drive 0 (Faust computes both select paths — three
  // always-on stereo compressors) and cost EVERY genre ~0.01 live load ratio
  // (measured: live gate 0.977/0.973 PASS with committed fx_bus vs 0.969/0.967
  // FAIL with it baked in). As a separate module it exists only when a genre
  // opts in via state.masterComp (disco): press post-passes the fx_bus output
  // through it, live series-inserts it after fx_bus under a crossfade — the
  // reverb-color architecture. Absent/0 => null => committed fx_bus bytes.
  function masterMb(state) {
    const drive = clamp(state && state.masterComp != null ? state.masterComp : 0, 0, 1);
    if (!(drive > 0)) return null;
    return { module: "master_mb", mbdrive: drive };
  }

  // ---- map a buildEvents result into unit events ----
  // opts.lo/hi: beat window (live chord-bar injection); opts.bedAll: include
  // bed events regardless of window (press) — live passes bedWin instead.
  function mapEvents(E, state, ev, opts) {
    opts = opts || {};
    const spb = 60 / state.bpm;
    const lo = opts.lo != null ? opts.lo : -1e9, hi = opts.hi != null ? opts.hi : 1e9;
    const win = (b) => b >= lo && b < hi;
    const units = opts.units || voiceUnits(E, state);
    const out = [], found = [], sweeps = [];
    const solos = E.soloVoices ? E.soloVoices(state, (state.instruments || {}).melody) : [];

    for (const p of ev.pitched) {
      if (!win(p.beat)) continue;
      let key = p.voice;
      if (p.voice === "melody" && p.solo) { const v = solos.find((x) => x.key === JSON.stringify(p.solo)); if (v) key = "solo:" + v.key; }
      const u = units[key]; if (!u) continue;
      const durB = Math.max(0.02, p.dur);
      const sets = { freq: clamp(cpspch(p.pch), 20, u.freqMax || 4000) };
      if (!u.dx7) sets.gain = clamp(p.amp * u.gmul, 0, 2);
      if (u.decayFromDur) sets.decay = clamp(durB * spb, 0.1, u.module === "bell" ? 6 : 8);
      if (u.fmLead) sets.idxTime = clamp(durB * spb / 2, 0.01, 4);
      if (u.biteFromAmp) sets.bite = clamp(p.amp, 0, 1);
      if (u.flangeFromTime) sets.flangePos = clamp(p.beat * spb / 164, 0, 1);
      // tb303 per-note ACCENT/SLIDE (u.acid): buildEvents tags acid bass steps
      // with ev.accent/ev.slide (0..1); set on the voice BEFORE the note's
      // gate-on. slide>0 also asks the mono-legato scheduler to hold the gate
      // across the group (freq slews in the module). Default 0 = clean.
      if (u.acid) { sets.accent = clamp(p.accent || 0, 0, 1); sets.slide = clamp(p.slide || 0, 0, 1); }
      // blue-note bend contract (VOICES.md): only sampler units render it;
      // Faust-module voices carry no matching param and simply ignore it.
      out.push({ unit: key, beat: p.beat, durB, sets, amp: p.amp,
        ...(p.bend ? { bend: p.bend } : {}) });
    }
    for (const d of ev.drums) {
      if (!win(d.beat)) continue;
      const u = units[d.drum]; if (!u) continue;
      // SAMPLED DRUM: the voice unit carries a native sampler (a genre's drums.kit).
      // Emit the hit as a one-shot for the shared sampler path (press/stream read
      // sets.freq/gain exactly like a pitched sampler note): fixed pitch for
      // kick/snare (rate 1), closed/open zone select for hats, real repitch for
      // toms (d.pitch Hz). Hold: kick/snare/tom play their FULL sample (body +
      // natural decay, release-declicked at the end); hats use the notated dur so
      // closed stays tight and open rings only as long as the pattern asks. amp ->
      // sample gain (velocity), calibrated by DRUM_SAMP_GAIN. Ping-pong (d.pp) is
      // not sent on sampled drums (the sampler mix has no pp bus).
      if (u.sampler) {
        let freq, durSec;
        if (d.drum === "tom") { freq = clamp(d.pitch || 105, 40, 400); }
        else if (d.drum === "hat") { freq = d.open ? DRUM_HAT_OPEN_FREQ : DRUM_KS_FREQ; }
        else { freq = DRUM_KS_FREQ; }
        if (d.drum === "hat") durSec = Math.max(0.02, d.dur * spb);
        else durSec = Math.max(0.04, (u.sampler.oneShotSec || 1) - (u.sampler.rel || 0.03));
        out.push({ unit: d.drum, beat: d.beat, durB: durSec / spb, drum: true,
          sets: { freq, gain: clamp(d.amp * DRUM_SAMP_GAIN, 0, 2) } });
        continue;
      }
      const sets = { level: clamp(u.lvl * d.amp, 0, 2), decay: clamp(d.dur * spb, 0.05, 2) };
      if (d.drum === "tom") sets.pitch = clamp(d.pitch || 105, 40, 400);
      // state.snarePP: buildEvents tags sparse snare hits with d.pp — a per-EVENT
      // ping-pong send (csound instr 11 p5 -> gaPPL += asig*ipp)
      out.push({ unit: d.drum, beat: d.beat, durB: d.dur, sets, drum: true, pp: clamp(d.pp || 0, 0, 2) });
    }
    for (const s of ev.sfx) {
      if (s.sweep) { if (win(s.beat)) sweeps.push({ beat: s.beat, durB: s.dur, from: s.from, to: s.to }); continue; }
      if (!win(s.beat)) continue;
      if (s.stab) out.push({ unit: "stab", beat: s.beat, durB: s.dur, drum: true,
        sets: { freq: clamp(cpspch(s.pch), 40, 2000), decay: clamp(s.dur * spb, 0.05, 2), gain: clamp(s.amp, 0, 2) } });
      else out.push({ unit: "sfx", beat: s.beat, durB: s.dur, hold: true,
        sets: { type: s.type, dur: clamp(s.dur * spb, 0.1, 16), amp: clamp(s.amp, 0, 1) } });
    }
    const srcOf = {}; for (const s of Object.values(ev.srcById || {})) srcOf[s.tableNum] = s;
    // AUTO-TUNE spec (fx wings stage 2): attach the same {strength,pcs} to
    // found events so found-player bends each clip's detected median pitch onto
    // the scale. Absent when state has no autoTune => events carry no field =>
    // byte-identical render (untouched genres, spokenword's explicit 0).
    // NEVER on tempo-synced sources (src.bpm set — breaks): their chop `pitch`
    // IS the beat-sync ratio, and a scale bend of up to several semitones would
    // wreck the tempo (a hogcore×jungle blend chops real breaks). Non-vocal
    // field recordings pass through detectMedianHz's voiced-frame gate (no
    // stable F0 -> 0 -> no bend), so no further source filtering is needed.
    const at = autoTune(E, state);
    for (const f of ev.found) {
      const src = srcOf[f.tableNum]; if (!src) continue;
      const tuned = at && !src.bpm ? { autoTune: at } : {};
      if (f.chop) {
        if (!win(f.beat)) continue;
        found.push({ type: "chop", srcId: src.id, beat: f.beat, durB: Math.max(0.02, f.dur), amp: f.amp,
          pitch: f.pitch, offset: f.offset || 0, cutoff: f.cutoff || 3500,
          rsend: f.rsend != null ? f.rsend : 0.3, dsend: f.dsend != null ? f.dsend : 0.2,
          ppsend: f.ppsend || 0, fade: f.fade || 0, sqRate: f.sqRate || 0, sqDepth: f.sqDepth || 0,
          ...tuned });
      } else {
        if (!(opts.bedAll || win(f.beat))) continue;
        found.push({ type: "bed", srcId: src.id, beat: f.beat, durB: f.dur, amp: f.amp,
          pitch: f.pitch, stretch: f.stretch != null ? f.stretch : 0.45, cutoff: f.cutoff || 2600,
          ...tuned });
      }
    }
    return { events: out, found, sweeps, units, spb, totalBeats: ev.totalBeats };
  }

  // press path: whole song at once
  function buildSchedule(E, state) {
    const ev = E.buildEvents(state);
    return mapEvents(E, state, ev, { bedAll: true });
  }

  return { WAVES, clamp, cpspch, mergedInstruments, insertChain, pitchedUnit, voiceUnits, fxParams, reverbColor, REVERB_COLORS, autoTune, masterMb, mapEvents, buildSchedule, COST, unitCost, stateCost, effectivePool, BUDGET, trimToBudget, stemClass, STEM_COST_MIN };
});
