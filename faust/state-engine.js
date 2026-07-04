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
    const L = m.level != null ? m.level : 0.6;
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
        wowDepth: clamp(m.wowDepth != null ? m.wowDepth : 0.07, 0, 0.5),        // semitones (slow undulation)
        flutterDepth: clamp(m.flutterDepth != null ? m.flutterDepth : 0.035, 0, 0.5),  // semitones (fast micro-variation)
        wowRate: clamp(m.wowRate != null ? m.wowRate : 0.7, 0.1, 3),
        flutterRate: clamp(m.flutterRate != null ? m.flutterRate : 7, 3, 12),
        tapeCap: m.tapeCap === false ? 0 : clamp(m.tapeCap === true || m.tapeCap == null ? 8 : m.tapeCap, 0, 8),
        headEq: clamp(m.headEq != null ? m.headEq : 0.3, 0, 1),
      } : null;
      return { ...base, gmul: base.gmul * (role === "bass" ? 0.5 : 1), module: null, sampler: {
          id: sp.id || "?", sr: sp.sr || 44100,
          zones: Array.isArray(sp.zones) ? sp.zones : [],
          atk: clamp(m.attack != null ? m.attack : (role === "bass" ? 0.006 : 0.012), 0.003, 5),
          rel: clamp(m.release != null ? m.release : (role === "bass" ? 0.07 : 0.09), 0.02, 6),
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
      const relD = clamp(m.release != null ? m.release : (isBassRole ? 0.12 : 0.25), 0.01, 3);
      return { ...base, module: "modeld", mono: true, legatoSec: 0.03,
        pool: 1,   // MONO: one voice instance, ever (press honors it; live's generic pool doesn't yet — see VOICES.md)
        tail: Math.max(base.tail, relD + 0.4),
        freqMax: isBassRole ? 2000 : 4000,
        params: { ...base.params,
          cutoff: clamp(c, 60, 12000), res,
          envAmount: clamp(m.envAmount != null ? m.envAmount : (isBassRole ? 1.5 : 1.2), 0, 5),
          envDecay: clamp(m.envDecay != null ? m.envDecay : (isBassRole ? 0.14 : 0.2), 0.01, 2),
          glide: clamp(m.glide || 0, 0, 500),
          drive: clamp(m.drive || 0.25, 0, 1),
          oscMix: clamp(m.oscMix != null ? m.oscMix : 0.5, 0, 1),
          drift: clamp(m.drift != null ? m.drift : 6, 0, 25),
          attack: clamp(m.attack != null ? m.attack : 0.004, 0.001, 2),
          sustain: clamp(m.sustain != null ? m.sustain : (isBassRole ? 0.8 : 0.9), 0, 1),
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
        cutoff: clamp(c, 60, 6000), resonance: clamp(m.res != null ? m.res : 0.7, 0, 1),
        envmod: clamp(m.envmod != null ? m.envmod : 0.55, 0, 1),
        decay: clamp(m.decay != null ? m.decay : 0.4, 0.03, 2.5),
        waveform: clamp(m.waveform != null ? m.waveform : (m.wave === "square" ? 1 : m.wave === "pulse" ? 0.7 : 0), 0, 1) } });

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
          envAmount: clamp(m.envAmount != null ? m.envAmount : (isPad ? 1.4 : 1.0), -4, 6),
          keytrack: clamp(m.keytrack != null ? m.keytrack : 0.3, 0, 1),
          lfoToFilter: clamp(m.lfoToFilter != null ? m.lfoToFilter : 0, 0, 3),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.02), 0.001, 5),
          decay: clamp(m.decay != null ? m.decay : (isPad ? 1.2 : 0.6), 0.005, 5),
          sustain: clamp(m.sustain != null ? m.sustain : (isPad ? 0.7 : 0.4), 0, 1),
          release: clamp(m.release != null ? m.release : (isPad ? 1.5 : 0.4), 0.005, 6),
          chorus: clamp(m.chorus != null ? m.chorus : (isPad ? 1.4 : 1.0), 0, 2),
          spread: clamp(m.chorusSpread != null ? m.chorusSpread : 0.9, 0, 1),
          sawLevel: clamp(m.sawLevel != null ? m.sawLevel : 0.6, 0, 1),
          pulseLevel: clamp(m.pulseLevel != null ? m.pulseLevel : 0.5, 0, 1),
          subLevel: clamp(m.subLevel != null ? m.subLevel : 0.3, 0, 1),
          noiseLevel: clamp(m.noiseLevel != null ? m.noiseLevel : 0, 0, 1),
          pwmBase: clamp(m.pwmBase != null ? m.pwmBase : 0.5, 0.05, 0.5),
          pwmLfo: clamp(m.pwmLfo != null ? m.pwmLfo : 0.15, 0, 0.45) } };
      // hammond — B-3 tonewheel organ + Leslie, STEREO. The nine drawbars are
      // THE morph dims; leslie 0 chorale..1 tremolo (rotor inertia in the module).
      case "hammond": return { ...base, module: "hammond", stereo: true, pool: 4, freqMax: 4000,
        params: { ...base.params,
          bar16: clamp(m.bar16 != null ? m.bar16 : 8, 0, 8), bar513: clamp(m.bar513 != null ? m.bar513 : 3, 0, 8),
          bar8: clamp(m.bar8 != null ? m.bar8 : 8, 0, 8), bar4: clamp(m.bar4 != null ? m.bar4 : 6, 0, 8),
          bar223: clamp(m.bar223 != null ? m.bar223 : 0, 0, 8), bar2: clamp(m.bar2 != null ? m.bar2 : 0, 0, 8),
          bar135: clamp(m.bar135 != null ? m.bar135 : 0, 0, 8), bar113: clamp(m.bar113 != null ? m.bar113 : 0, 0, 8),
          bar1: clamp(m.bar1 != null ? m.bar1 : 0, 0, 8),
          leslie: clamp(m.leslie != null ? m.leslie : 0.85, 0, 1),
          perc: clamp(m.perc != null ? m.perc : 0.5, 0, 1),
          percHarm: clamp(m.percHarm != null ? m.percHarm : 0, 0, 1),
          percDecay: clamp(m.percDecay != null ? m.percDecay : 0.35, 0.05, 2),
          click: clamp(m.click != null ? m.click : 0.25, 0, 1),
          leak: clamp(m.leak != null ? m.leak : 0.35, 0, 1),
          drive: clamp(m.drive != null ? m.drive : 0.15, 0, 1),
          attack: clamp(m.attack != null ? m.attack : (isPad ? 0.02 : 0.006), 0.001, 0.5),
          release: clamp(m.release != null ? m.release : 0.02, 0.005, 1) } };
      // vp330 — Roland VP-330 ghost-choir, STEREO. vowel + ensemble morph; a dark
      // instrument (cutoff mapped straight; it self-limits).
      case "vp330":   return { ...base, module: "vp330", stereo: true, pool: 4, freqMax: 4000,
        params: { ...base.params, cutoff: clamp(c, 300, 12000),
          vowel: clamp(m.vowel != null ? m.vowel : 0.3, 0, 1),
          breath: clamp(m.breath != null ? m.breath : 0.15, 0, 1),
          ensemble: clamp(m.ensemble != null ? m.ensemble : 0.6, 0, 1),
          detune: clamp(m.vpDetune != null ? m.vpDetune : 0.4, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.08), 0.005, 3),
          sustain: clamp(m.sustain != null ? m.sustain : 0.9, 0, 1),
          release: clamp(m.release != null ? m.release : 0.6, 0.02, 5) } };
      // solina — ARP/Eminent String Ensemble, MONO out. ensemble is the identity
      // dim; NO res param; cutoff->tone (<=12000). Ensemble chorus is built in —
      // NEVER stack an insert_chorus, so inserts are dropped for this voice.
      case "solina":  return { ...base, module: "solina", pool: isPad ? 6 : 4, inserts: [],
        params: { ...base.params, tone: clamp(Math.min(12000, c), 300, 12000),
          octave: clamp(m.octave != null ? m.octave : 0.55, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.012), 0.002, 1.5),
          release: clamp(m.release != null ? m.release : 0.22, 0.02, 3),
          chorusRate: clamp(m.chorusRate != null ? m.chorusRate : 0.62, 0.05, 4),
          chorusDepth: clamp(m.chorusDepth != null ? m.chorusDepth : 0.9, 0, 1),
          ensemble: clamp(m.ensemble != null ? m.ensemble : 0.85, 0, 1) } };
      // synclead — hard-sync tearing lead, MONO-LEGATO (modeld's contract; melody/
      // solo only, never a pad). syncRatio + env-driven syncSweep are the signature
      // dims; filter env in OCTAVES like modeld. syncDetune = the 2nd pair, CENTS.
      case "synclead": return { ...base, module: "synclead", mono: true, legatoSec: 0.03, pool: 1,
        tail: Math.max(base.tail, (m.release != null ? m.release : 0.2) + 0.4), freqMax: 4000,
        params: { ...base.params, cutoff: clamp(c, 60, 16000), res,
          syncRatio: clamp(m.syncRatio != null ? m.syncRatio : 1.5, 1, 4),
          syncSweep: clamp(m.syncSweep != null ? m.syncSweep : 1.5, 0, 4),
          syncDecay: clamp(m.syncDecay != null ? m.syncDecay : 0.18, 0.01, 1.5),
          detune: clamp(m.syncDetune != null ? m.syncDetune : 8, 0, 40),
          envAmount: clamp(m.envAmount != null ? m.envAmount : 1.8, 0, 5),
          envDecay: clamp(m.envDecay != null ? m.envDecay : 0.16, 0.01, 2),
          glide: clamp(m.glide || 0, 0, 500),
          drive: clamp(m.drive != null ? m.drive : 0.3, 0, 1),
          attack: clamp(m.attack != null ? m.attack : 0.004, 0.001, 2),
          sustain: clamp(m.sustain != null ? m.sustain : 0.85, 0, 1),
          release: clamp(m.release != null ? m.release : 0.2, 0.01, 3) } };
      // casiocz — Casio CZ phase-distortion keys/lead, MONO out, per-note gate
      // (NOT legato). wave = the CZ index family morph; dcw* = the DCW contour
      // (identity). czWave/czDetune are dedicated keys (recipe `wave` is a string).
      case "casiocz": return { ...base, module: "casiocz", pool: 4,
        params: { ...base.params, cutoff: clamp(c, 200, 16000),
          wave: clamp(m.czWave != null ? m.czWave : 0.5, 0, 1),
          index: clamp(m.index != null ? m.index : 0.25, 0, 1),
          dcwAmount: clamp(m.dcwAmount != null ? m.dcwAmount : 0.6, 0, 1),
          dcwAttack: clamp(m.dcwAttack != null ? m.dcwAttack : 0.005, 0.001, 2),
          dcwDecay: clamp(m.dcwDecay != null ? m.dcwDecay : 0.35, 0.005, 3),
          dcwSustain: clamp(m.dcwSustain != null ? m.dcwSustain : 0.35, 0, 1),
          detune: clamp(m.czDetune != null ? m.czDetune : 4, 0, 40),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.005), 0.001, 3),
          decay: clamp(m.decay != null ? m.decay : 0.12, 0.005, 3),
          sustain: clamp(m.sustain != null ? m.sustain : 0.85, 0, 1),
          release: clamp(m.release != null ? m.release : 0.3, 0.005, 4) } };
      // oberheim — Prophet-5/SEM poly pad, MONO out. Hand-rolled TPT SVF;
      // filterMode 0 LP .5 BP 1 HP; poly-mod (pmFM/pmFilt/osc2lfo) 0 = clean pad.
      case "oberheim": return { ...base, module: "oberheim", pool: 4,
        params: { ...base.params, cutoff: clamp(c, 40, 16000), res: clamp(m.res != null ? m.res : 0.15, 0, 1),
          filterMode: clamp(m.filterMode != null ? m.filterMode : 0, 0, 1),
          envAmount: clamp(m.envAmount != null ? m.envAmount : 1.3, 0, 5),
          envAttack: clamp(m.envAttack != null ? m.envAttack : 0.9, 0.001, 5),
          envDecay: clamp(m.envDecay != null ? m.envDecay : 1.4, 0.01, 5),
          envSustain: clamp(m.envSustain != null ? m.envSustain : 0.75, 0, 1),
          detune: clamp(m.obDetune != null ? m.obDetune : 9, 0, 50),
          osc2tune: clamp(m.osc2tune != null ? m.osc2tune : 0, -36, 24),
          osc2lfo: clamp(m.osc2lfo != null ? m.osc2lfo : 0, 0, 1),
          lfoRate: clamp(m.lfoRate != null ? m.lfoRate : 4, 0.02, 14),
          pmFM: clamp(m.pmFM != null ? m.pmFM : 0, 0, 1),
          pmFilt: clamp(m.pmFilt != null ? m.pmFilt : 0, 0, 1),
          drive: clamp(m.drive != null ? m.drive : 0.12, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.8), 0.002, 5),
          sustain: clamp(m.sustain != null ? m.sustain : 0.8, 0, 1),
          release: clamp(m.release != null ? m.release : 2.4, 0.01, 6) } };
      // ppg — PPG-Wave wavetable-scan poly pad+lead, MONO out. scan is the star
      // dim (a genre-space "wavetable spectral position"); scanEnv is SIGNED.
      case "ppg":     return { ...base, module: "ppg", pool: isPad ? 4 : 3,
        params: { ...base.params, cutoff: clamp(c, 60, 16000), res,
          scan: clamp(m.scan != null ? m.scan : 0.35, 0, 1),
          scanEnv: clamp(m.scanEnv != null ? m.scanEnv : 0.3, -1, 1),
          scanLfo: clamp(m.scanLfo != null ? m.scanLfo : 0, 0, 0.5),
          scanRate: clamp(m.scanRate != null ? m.scanRate : 0.3, 0.01, 12),
          envAmount: clamp(m.envAmount != null ? m.envAmount : 0.5, 0, 4),
          drive: clamp(m.drive != null ? m.drive : 0.12, 0, 1),
          sub: clamp(m.sub != null ? m.sub : 0.15, 0, 1),
          attack: clamp(isPad ? atk : (m.attack != null ? m.attack : 0.01), 0.001, 2),
          sustain: clamp(m.sustain != null ? m.sustain : 0.85, 0, 1),
          release: clamp(m.release != null ? m.release : 0.4, 0.01, 3) } };
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
    units.stab = { module: "stab", pool: 2, dry: 1, rev: 0.35, del: 0.3, lvl: 1, drum: true, params: { level: 1 }, tail: 0.6, freqMax: 2000 };
    units.sfx = { module: "sfx", pool: 2, dry: 1, rev: 0.3, del: 0, lvl: 1, hold: true, params: { level: 1 }, tail: 1.2 };
    return units;
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

  return { WAVES, clamp, cpspch, mergedInstruments, insertChain, pitchedUnit, voiceUnits, fxParams, reverbColor, REVERB_COLORS, autoTune, masterMb, mapEvents, buildSchedule };
});
