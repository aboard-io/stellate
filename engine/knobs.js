// knobs.js — THE GENRE AS A BUNDLE OF CONTINUOUS VALUES.
//
// A song is `D · S · (N ∘ τ)`: your material N, drawn; the orchestration D, the
// instrument choice S and the time feel τ, which together ARE the genre. This
// file is D, S and τ made turnable.
//
// THE SPLIT THIS RESTS ON. The project's standing no-slider law is right and it
// is a law about N — a probability pad beats a range input, and editing notes
// with sliders is what /daw rejected. It is NOT a law about the genre operator,
// which genuinely is a bundle of continuous numbers: measured across all 274
// anchors, every field here interpolates smoothly. What does not interpolate is
// S, and that is handled below rather than pretended away.
//
// TWELVE OF THEM DO THE WORK. Measured by spread across the catalogue, the
// discriminating fields are tempo, grit, jux, snarePP, humanize and the submerge
// cluster; the other ~28 are trim (per-voice sends, drum tune, individual
// levels). `HEADLINE` is the twelve; `TRIM` is the rest, behind a disclosure.

(function (root) {
  "use strict";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  // read/write a dotted path, creating objects on the way down
  const get = (o, p, d) => { let c = o; for (const k of p.split(".")) { if (c == null) return d; c = c[k]; } return num(c, d); };
  const set = (o, p, v) => { const ks = p.split("."); let c = o; for (let i = 0; i < ks.length - 1; i++) c = (c[ks[i]] = c[ks[i]] || {}); c[ks[ks.length - 1]] = v; };

  const K = (id, label, path, min, max, def, unit, group) =>
    ({ id, label, path, min, max, def, unit: unit || "", group: group || "trim",
      read: (st) => clamp(get(st, path, def), min, max),
      write: (st, v) => set(st, path, clamp(+v, min, max)) });

  // ------------------------------------------------------------- the twelve
  const HEADLINE = [
    K("bpm", "tempo", "bpm", 40, 200, 110, " bpm", "clock"),
    K("swing", "swing", "swing", 0, 0.4, 0, "", "clock"),
    K("humanize", "rubato", "humanize", 0, 0.6, 0, "", "clock"),
    K("reverb", "reverb", "reverb", 0, 1, 0.4, "", "space"),
    // ZERO MEANS OPEN, NOT ZERO. The engine spells "no top cut" as
    // `tone.highcut: 0`, so a knob that reads the raw number showed 800 Hz — the
    // darkest possible setting — for every genre with an open top, and the
    // submerge sweep looked like it went UP. Off reads as the maximum, and
    // writing the maximum writes 0 back, keeping the engine's own idiom.
    Object.assign(K("highcut", "top cut", "tone.highcut", 800, 20000, 20000, " Hz", "space"), {
      read: (st) => { const v = get(st, "tone.highcut", 0); return !v ? 20000 : clamp(v, 800, 20000); },
      write: (st, v) => { v = clamp(+v, 800, 20000); set(st, "tone.highcut", v >= 19999 ? 0 : v); },
    }),
    K("delay", "delay back", "delay.feedback", 0, 0.9, 0, "", "space"),
    K("crackle", "crackle", "crackle", 0, 0.6, 0, "", "texture"),
    K("grit", "saturation", "grit", 0, 1, 0, "", "texture"),
    K("pump", "pump", "pump", 0, 0.8, 0, "", "texture"),
    K("comp", "compression", "comp", 0, 1, 0, "", "texture"),
    K("jux", "stereo flip", "jux", 0, 1, 0, "", "edit"),
    K("snarePP", "snare push", "snarePP", 0, 1, 0, "", "edit"),
  ];
  // ------------------------------------------------------------------ trim
  const TRIM = [
    K("keyOffset", "key", "keyOffset", -6, 6, 0, " st", "clock"),
    K("autoTune", "pitch correction", "autoTune", 0, 1, 0, "", "texture"),
    K("lowcut", "bottom cut", "tone.lowcut", 0, 800, 0, " Hz", "space"),
    K("delayBeats", "delay time", "delay.beats", 0.125, 2, 0.75, " beats", "space"),
    K("bassLvl", "bass level", "instruments.bass.level", 0, 2, 1, "", "mix"),
    K("melLvl", "melody level", "instruments.melody.level", 0, 2, 1, "", "mix"),
    K("padLvl", "pad level", "instruments.pad.level", 0, 2, 1, "", "mix"),
    K("bassSend", "bass reverb", "instruments.bass.send", 0, 1, 0, "", "mix"),
    K("melSend", "melody reverb", "instruments.melody.send", 0, 1, 0, "", "mix"),
    K("padSend", "pad reverb", "instruments.pad.send", 0, 1, 0, "", "mix"),
    K("kick", "kick", "instruments.drums.kick", 0, 2, 1, "", "mix"),
    K("snare", "snare", "instruments.drums.snare", 0, 2, 1, "", "mix"),
    K("hat", "hat", "instruments.drums.hat", 0, 2, 1, "", "mix"),
    K("drumSend", "drum reverb", "instruments.drums.send", 0, 1, 0, "", "mix"),
    K("drumTune", "drum tune", "instruments.drums.tune", 0.5, 2, 1, "×", "mix"),
  ];
  const ALL = HEADLINE.concat(TRIM);
  const byId = {}; for (const k of ALL) byId[k.id] = k;

  // ------------------------------------------------------------- SUBMERGE
  // ONE KNOB, NOT FOUR. Measured across the vapor family at seed 7:
  //
  //   citypop    99 bpm   reverb .36   highcut 20k(off)   crackle .07
  //   vaporwave  76 bpm   reverb .88   highcut 11.6k      crackle .19
  //   mallsoft   50 bpm   reverb .90   highcut  6.4k      crackle .23
  //
  // Those four move together, monotonically, and the ordering is the genre's
  // whole history — vaporwave is city pop slowed and submerged. So they are one
  // dimension with four projections, and a panel that offers four sliders is
  // offering three ways to make the fourth one wrong.
  //
  // RELATIVE, NOT ABSOLUTE. It is defined as a MOVE from wherever the state is,
  // not a curve through those three points, so it works on any anchor: 0 changes
  // nothing, +1 is the mallsoft end, −1 dries it out. The constants are read off
  // the measurements above (bpm ×0.5 at full, highcut ×0.32, reverb toward .92,
  // crackle +.17) rather than chosen.
  const SUBMERGE = {
    id: "submerge", label: "submerge", min: -1, max: 1, def: 0,
    apply(st, s) {
      s = clamp(+s || 0, -1, 1);
      if (!s) return st;
      st.bpm = clamp(num(st.bpm, 110) * (1 - 0.5 * s), 30, 220);
      const hc = num(get(st, "tone.highcut", 20000), 20000) || 20000;
      set(st, "tone.highcut", clamp(hc * Math.pow(0.32, s), 600, 20000));
      const rv = num(st.reverb, 0.4);
      st.reverb = clamp(s > 0 ? rv + s * (0.92 - rv) : rv * (1 + s), 0, 1);
      st.crackle = clamp(num(st.crackle, 0) + s * 0.17, 0, 0.6);
      return st;
    },
  };

  // ---------------------------------------------------------- THE INSTRUMENT
  // S is one-hot out of ~140 and it is the only part of the genre that does not
  // interpolate — measured, a 25/75 acidhouse/tango blend gives tb303 while 50/50
  // gives bandoneon, because averaging in a discrete coordinate is a coin flip.
  //
  // The fix is to give the set an ORDER, and the catalogue has already voted: the
  // mean `cutoff` the 274 anchors assign when they use an instrument is a
  // brightness reading, and sorting each family by it produces
  //
  //   lead    sub · reese · tb303 · acid · atmosphere · modeld
  //   string  cello · slow_strings · strings · fiddle · violin · viola
  //   brass   tuba · french_horns · brass_section · … · muted_trumpet
  //
  // dark to bright, low to high, in every family. So a voice becomes TWO dials —
  // family, then position — and a blend slides instead of flipping. No new
  // measurement: this is derived from the anchors that already ship.
  function instrumentAxis(K_) {
    K_ = K_ || root.GenreKernel;
    const names = Object.keys(K_.GENRES), use = {};
    for (const g of names) {
      const t = K_.track(g, { seed: 7 }), s = t.state || t, I = s.instruments || {};
      for (const slot of ["bass", "melody", "pad"]) {
        const r = I[slot]; if (!r) continue;
        const id = (r.sampler && r.sampler.id) || r.model; if (!id) continue;
        (use[id] = use[id] || []).push(num(r.cutoff, 0));
      }
    }
    const fam = {};
    for (const id of Object.keys(use)) {
      const f = (K_.instrFamily && K_.instrFamily(id)) || "synth";
      const c = use[id].reduce((a, b) => a + b, 0) / use[id].length;
      (fam[f] = fam[f] || []).push({ id, bright: c, seen: use[id].length });
    }
    for (const f of Object.keys(fam)) fam[f].sort((a, b) => a.bright - b.bright || (a.id < b.id ? -1 : 1));
    return fam;
  }
  // where an instrument sits on its own family's dial, 0..1
  function positionOf(axis, id) {
    for (const f of Object.keys(axis)) {
      const i = axis[f].findIndex((x) => x.id === id);
      if (i >= 0) return { family: f, index: i, of: axis[f].length, t: axis[f].length < 2 ? 0 : i / (axis[f].length - 1) };
    }
    return null;
  }

  // SWAP A VOICE'S INSTRUMENT. The same rewrite /daw's `sound` patch performs
  // (app/daw/song.js applySound): the sampler spec is MERGED over the existing
  // recipe so level and sends survive, and every zone is pushed into
  // `foundSources` at vol 0, which is how the kernel's own pitched-to-sampler
  // path feeds the decoder. Doing anything else here would either lose the mix
  // or leave the zones undecodable — and an id that is not a key of the
  // committed registry is refused, so a dial can only ever reach audio the
  // project already ships.
  function setInstrument(st, slot, id, K_) {
    K_ = K_ || root.GenreKernel;
    // THE AXIS HOLDS BOTH KINDS. Its members are whatever the anchors assign —
    // sampler ids (`bandoneon`) and synth model ids (`tb303`, `pluck`, `reese`)
    // side by side, because a family is a timbre neighbourhood and both live in
    // it. Handling only samplers meant dialling onto a synth returned false and
    // did NOTHING, silently: the dial moved, the label changed, the sound did
    // not. A synth is the simpler case — name the model and drop the sampler.
    const S = K_ && K_.SAMPLERS && K_.SAMPLERS[id];
    if (!S || !S.zones) {
      // AND IT IS VALIDATED. The synth branch used to accept any string, so
      // `setInstrument(st, "melody", "../etc/passwd")` happily wrote it into the
      // recipe — the same class of hole `PATCH_KEYS` exists to close on the DAW.
      // A model is only real if one of the 274 anchors actually uses it, which
      // means a dial can never reach audio the project does not ship.
      if (!id || !knownModels(K_).has(id)) return false;
      const I0 = st.instruments || (st.instruments = {});
      if (!I0[slot]) return false;
      I0[slot] = Object.assign({}, I0[slot], { model: id, sampler: null, dx7: null });
      return true;
    }
    const zones = S.zones.map((z, i) => ({ srcId: "ins_" + id + "_" + i, root: z.root, lo: z.lo, hi: z.hi,
      vlo: z.vlo, vhi: z.vhi, loop: !!z.loop, loopStart: z.ls, loopEnd: z.le, len: z.len, sr: S.sr }));
    const I = st.instruments || (st.instruments = {});
    I[slot] = Object.assign({}, I[slot] || {}, { model: "sampler", sampler: { id, sr: S.sr, zones }, dx7: null });
    st.foundSources = st.foundSources || [];
    const have = new Set(st.foundSources.map((x) => x.id));
    S.zones.forEach((z, i) => {
      const sid = "ins_" + id + "_" + i;
      if (have.has(sid)) return;
      have.add(sid);
      st.foundSources.push({ id: sid, label: S.label || id, url: "",
        samplePath: "found/samples/instruments/" + S.dir + "/" + z.file,
        vol: 0, pitch: 1, stretch: 0.5, cutoff: 18000 });
    });
    return true;
  }
  // every synth model the catalogue actually uses, computed once
  let _models = null;
  function knownModels(K_) {
    if (_models) return _models;
    _models = new Set();
    K_ = K_ || root.GenreKernel;
    if (!K_ || !K_.GENRES) return _models;
    for (const g of Object.keys(K_.GENRES)) {
      const t = K_.track(g, { seed: 7 }), s = t.state || t, I = s.instruments || {};
      for (const slot of ["bass", "melody", "pad"]) {
        const r = I[slot];
        if (r && r.model && !(r.sampler && r.sampler.id)) _models.add(r.model);
      }
    }
    return _models;
  }

  // what a slot is playing right now, as an id
  const instrumentOf = (st, slot) => {
    const r = (st.instruments || {})[slot];
    return r ? (r.sampler && r.sampler.id) || r.model : null;
  };

  const api = { HEADLINE, TRIM, ALL, byId, SUBMERGE, instrumentAxis, positionOf,
    setInstrument, instrumentOf, knownModels, get, set, clamp };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CsdKnobs = api;
})(typeof window !== "undefined" ? window : globalThis);
