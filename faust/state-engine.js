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

    if (role === "bass") {
      switch (model) {
        case "sub":    return { ...base, module: "bass_sub",   params: { ...base.params, cutoff: clamp(c, 80, 12000) } };
        case "acid":   return { ...base, module: "bass_acid",  params: { ...base.params, cutoff: clamp(c, 80, 12000), res,
          ...(m.release != null ? { release: clamp(m.release, 0.01, 3) } : {}),
          ...(m.fenv != null ? { fenv: clamp(m.fenv, 0, 6) } : {}) } };
        case "reese":  return { ...base, module: "bass_reese", params: { ...base.params, cutoff: clamp(c, 80, 12000) } };
        case "wobble": return { ...base, module: "bass_wobble",params: { ...base.params, cutoff: clamp(c, 80, 12000), res, wobbleHz: clamp(m.wobbleHz || 2.4, 0.1, 12) } };
        case "piano":  return { ...base, module: "piano", decayFromDur: true, params: { ...base.params, cutoff: clamp(Math.min(4000, c * 2.5), 200, 14000) } };
        default:       return { ...base, module: "bass_saw",   params: { ...base.params, cutoff: clamp(c, 80, 12000), res, ...bassArt } };
      }
    }
    const isPad = role === "pad";
    switch (model) {
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
      case "sampler": { // native pitched sample zones (faust/sampler.js) — no Faust module.
        // Contract: m.sampler = {id, sr, zones:[{srcId, root, lo, hi, loop,
        // loopStart, loopEnd}]} (kernel toState; zone wavs ride foundSources
        // at vol 0 so both engines decode them through the existing paths).
        const sp = m.sampler || {};
        return { ...base, module: null, sampler: {
            id: sp.id || "?", sr: sp.sr || 44100,
            zones: Array.isArray(sp.zones) ? sp.zones : [],
            atk: clamp(m.attack != null ? m.attack : 0.012, 0.003, 0.5),
            rel: clamp(m.release != null ? m.release : 0.09, 0.02, 1.5),
          }, freqMax: 4000 };
      }
      case "pluck":   return { ...base, module: "lead_pluck",  params: { ...base.params, cutoff: clamp(c, 200, 14000), res, damp: 2000,
        ...(plucky ? { release: rel, fenv: fev } : {}) } };
      case "kpluck":  return { ...base, module: "lead_kpluck", flangeFromTime: true, params: { ...base.params, cutoff: clamp(c, 200, 14000), drive: clamp(m.drive || 0, 0, 1) } };
      case "fuzz":    return { ...base, module: "lead_fuzz",   params: { ...base.params, cutoff: clamp(c, 200, 14000), res, drive: clamp(m.drive || 0, 0, 1), vibrato: clamp(m.vibrato || 0, 0, 0.03), vibRate: clamp(m.vibRate || 5.2, 0.1, 12),
        ...(plucky ? { attack: clamp(m.attack != null ? m.attack : 0.05, 0.001, 5), sustain: sus, release: rel, fenv: fev } : {}) } };
      case "guitar":  return { ...base, module: "lead_guitar", params: { ...base.params, cutoff: clamp(c || 4500, 200, 14000), pluckPos: 0.75 } };
      case "vocoder": return { ...base, module: "robot_choir", vocoder: true, params: { ...base.params, cutoff: clamp(isPad ? Math.min(9000, c * 2) : c, 200, 14000), res, makeup: 5 } };
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

  // ---- fx_bus params from state (rgain = reverb*3.2 per A/B calibration; the
  // fx_bus rgain slider caps at 2, so reverb > 0.625 saturates the return) ----
  function fxParams(state) {
    const spb = 60 / state.bpm, dl = state.delay || {};
    const pp = state.pingpong || {};
    return {
      rgain: clamp((state.reverb != null ? state.reverb : 0.7) * 3.2, 0, 2), dgain: 1,
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
      out.push({ unit: key, beat: p.beat, durB, sets, amp: p.amp });
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
    for (const f of ev.found) {
      const src = srcOf[f.tableNum]; if (!src) continue;
      if (f.chop) {
        if (!win(f.beat)) continue;
        found.push({ type: "chop", srcId: src.id, beat: f.beat, durB: Math.max(0.02, f.dur), amp: f.amp,
          pitch: f.pitch, offset: f.offset || 0, cutoff: f.cutoff || 3500,
          rsend: f.rsend != null ? f.rsend : 0.3, dsend: f.dsend != null ? f.dsend : 0.2,
          ppsend: f.ppsend || 0, fade: f.fade || 0, sqRate: f.sqRate || 0, sqDepth: f.sqDepth || 0 });
      } else {
        if (!(opts.bedAll || win(f.beat))) continue;
        found.push({ type: "bed", srcId: src.id, beat: f.beat, durB: f.dur, amp: f.amp,
          pitch: f.pitch, stretch: f.stretch != null ? f.stretch : 0.45, cutoff: f.cutoff || 2600 });
      }
    }
    return { events: out, found, sweeps, units, spb, totalBeats: ev.totalBeats };
  }

  // press path: whole song at once
  function buildSchedule(E, state) {
    const ev = E.buildEvents(state);
    return mapEvents(E, state, ev, { bedAll: true });
  }

  return { WAVES, clamp, cpspch, mergedInstruments, insertChain, pitchedUnit, voiceUnits, fxParams, mapEvents, buildSchedule };
});
