// musicality.js — proving genres GOOD, not just distinct (docs/MUSICALITY.md).
// The matrix verifies the SCORE; this verifies the PERFORMANCE. v1 is the four
// SYMBOLIC laws — everything here reads buildEvents(state), no audio:
//
//   BLOOM    every declared part arrives within a listener's patience
//            (bounds per FORM); a declared part that NEVER sounds = hard fail.
//   REGISTER sampled voices play inside the sampler's natural window
//            (the mapping layer's fold window: top zone root +6 st, bottom
//            zone root -12 st — mirrors faust/state-engine SAMPLER_*_ST).
//   PROMISES the genre card as a falsifiable contract: machine-checkable
//            claims (kickOn / drumless / skankOffbeat / bassStyle / meter /
//            partPresent). Unknown promise keys WARN, never crash.
//   MOTION   boredom check — >2 consecutive byte-identical sections = WARN.
//
//   audit(genreOrState, {seeds})  -> {genre, seeds, laws:{...}, overall, verdict}
//   auditAll({seeds, rank})       -> rows over every kernel anchor
//   node engine/musicality.js audit <genre|all> [--seeds 1,2,3] [--rank] [--json]
//
// Gate posture: SOFT FIRST (validate-genres gate 8 is WARN-level; a law goes
// hard only when its offender list and the ear agree twice). Deterministic:
// same seed, same scorecard. Scores are [0,1] with NAMED failures — defect
// classes, not preferences (the doc's "what this is not").
//
// PROMISES live in the PROMISES table below (keyed by genre) until the kernel
// anchors grow a `promises:` field — the kernel is another agent's file during
// this phase; state.promises, when it exists, overrides the table.
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const E = isNode ? require("./csd-engine.js") : root.CsdEngine;
  const K = isNode ? require("./genre-kernel.js") : root.GenreKernel;

  const round = (x, p) => +(+x).toFixed(p == null ? 3 : p);
  const CORE = { kick: 1, snare: 1, hat: 1, tom: 1 };   // the rhythm fabric; perc lane is color (genre-verifier's law)

  // ---------------------------------------------------------------- BLOOM
  // First-onset bounds in BEATS per FORM per part — v1.1, recalibrated
  // (balance loop 1). The first numbers were tighter than the FORM
  // GRAPHS' own design: pop's graph places the hook at the chorus (natural
  // beat 96 — the old melody:64 was unsatisfiable by construction), and the
  // duration solver legitimately stretches short forms toward the 180s
  // target. Each bound below = the form's designed worst-case placement
  // (measured over 228 genres x 3 seeds AFTER the solver's energy-aware
  // grow fix) + one chord-bar of margin; anything past it is drag the form
  // never asked for. A part is MEASURED only when the resolved state
  // declares it (some section turns it on) — sections all drums:"off" means
  // the drums part simply isn't declared, so drumless-by-design is exempt
  // by construction, not by exemption list. Two more by-construction
  // exemptions live in bloom() itself: contrast devices (a part declared
  // ONLY in exposed/release nodes — the bridge pad wall, anthem's bridge
  // brass swell — is a designed late arrival, not a core part) and
  // evolution gifts (a part first declared at/after a 3-minute-rule
  // evolution boundary is the re-roll's new voice, not lateness). And the
  // ONE-CYCLE FLOOR: an intro of one full harmonic cycle is never late
  // (blues opens with a full 12-bar piano chorus — idiomatic, not drag),
  // so the effective bound is max(table, cycleBeats).
  const BLOOM_BOUNDS = {
    pop:     { drums: 64,  bass: 64,  melody: 192, pads: 192, found: 96,  counter: 192 },
    anthem:  { drums: 64,  bass: 64,  melody: 96,  pads: 64,  found: 64,  counter: 192 },
    drop:    { drums: 72,  bass: 72,  melody: 128, pads: 256, found: 96,  counter: 192 },
    transit: { drums: 48,  bass: 48,  melody: 80,  pads: 64,  found: 64,  counter: 112 },
    wave:    { drums: 144, bass: 144, melody: 192, pads: 112, found: 112, counter: 176 },
    dj:      { drums: 128, bass: 128, melody: 256, pads: 256, found: 128, counter: 192 },
    ritual:  { drums: 96,  bass: 96,  melody: 192, pads: 128, found: 128, counter: 192 },
  };

  // Mapping-layer window (faust/state-engine.js SAMPLER_STRETCH_ST /
  // SAMPLER_FLOOR_ST): notes outside octave-fold at render. Symbolically a
  // note outside the window means the SCORE asked for a register the
  // instrument doesn't own — the fold saves the ear but bends the contour,
  // so the law names it here where it can be fixed at the anchor.
  const STRETCH_ST = 6, FLOOR_ST = 12;

  // ---------------------------------------------------------------- parts
  // Section spans re-derive buildEvents' beat arithmetic (chordEvery /
  // meter-fitting default / CHORD_BEATS=8) — theory.reharm preserves chord
  // count, so progression length is stable either way.
  function sectionSpans(state) {
    const prg = E.getProgression(state.progression);
    const mtb = state.meter ? (state.meter.beats | 0) : 0;
    const CB = Math.max(2, Math.round(state.chordEvery || ((mtb === 3 || mtb === 6) ? 6 : 8)));
    const cycleBeats = prg.chords.length * CB;
    const spans = []; let cur = 0;
    for (const sec of state.sections || []) {
      const b = (sec.cycles || 1) * cycleBeats;
      spans.push({ sec, start: cur, end: cur + b });
      cur += b;
    }
    spans.CB = CB;               // the chord-bar length rides along (BLOOM's arrival grid)
    spans.cycleBeats = cycleBeats;   // one full harmonic cycle (BLOOM's one-cycle floor)
    return spans;
  }

  // Per-part declaration + first onset + event counts. Counter events carry
  // e.solo === sec.counter.solo (every kernel counter declares a solo voice —
  // measured over the full catalog), so they're identified by solo-tag match
  // inside counter-declared spans; everything else melody-voiced is melody.
  function partsOf(state, ev) {
    const spans = sectionSpans(state);
    const secs = state.sections || [];
    const DECL = {
      drums:   (s) => s.drums && s.drums !== "off",
      bass:    (s) => s.bass && s.bass !== "off",
      melody:  (s) => s.melody && s.melody !== "off",
      pads:    (s) => !!s.pads,
      found:   (s) => s.found && s.found.sourceId,
      counter: (s) => s.counter && s.counter.pattern,
    };
    const declared = {}, declIdx = {};
    for (const p of Object.keys(DECL)) {
      declIdx[p] = secs.map((s, i) => (DECL[p](s) ? i : -1)).filter((i) => i >= 0);
      declared[p] = declIdx[p].length > 0;
    }
    const cSpans = spans.filter((sp) => sp.sec.counter && sp.sec.counter.pattern && sp.sec.counter.solo)
      .map((sp) => ({ start: sp.start, end: sp.end, key: JSON.stringify(sp.sec.counter.solo) }));
    const isCounter = (e) => {
      if (!e.solo) return false;
      const k = JSON.stringify(e.solo);
      return cSpans.some((sp) => k === sp.key && e.beat >= sp.start - 0.5 && e.beat < sp.end + 0.5);
    };
    const fSpans = spans.filter((sp) => sp.sec.found && sp.sec.found.sourceId);
    const inFound = (b) => fSpans.some((sp) => b >= sp.start - 0.5 && b < sp.end + 0.5);
    const first = {}, count = {};
    for (const p of Object.keys(declared)) { first[p] = null; count[p] = 0; }
    const see = (part, beat) => { count[part]++; if (first[part] == null || beat < first[part]) first[part] = beat; };
    for (const d of ev.drums) if (CORE[d.drum]) see("drums", d.beat);
    for (const p of ev.pitched) {
      const part = p.voice === "pad" ? "pads" : p.voice === "bass" ? "bass" : isCounter(p) ? "counter" : "melody";
      see(part, p.beat);
    }
    // found part = the section-declared found layer; hits/vox share the found
    // event stream, so membership is gated to found-declared spans (v1: a
    // hits event inside a found span still counts — accepted coarseness).
    for (const f of ev.found || []) if (inFound(f.beat)) see("found", f.beat);
    return { declared, declIdx, first, count, spans, isCounter };
  }

  // ---------------------------------------------------------------- law: BLOOM
  function bloom(state, ev, form, P) {
    P = P || partsOf(state, ev);
    const bounds = BLOOM_BOUNDS[form] || BLOOM_BOUNDS.pop;
    const secs = state.sections || [];
    const tagOf = (s) => s.tag || E.sectionTag(s.name);
    // 3-minute-rule evolution boundary (genreMeta.evolutions[].at is a final
    // section index): a part whose declaring sections ALL sit at/after the
    // first boundary is the re-roll's NEW voice, not a late core part.
    const evo = state.genreMeta && state.genreMeta.evolutions;
    const evoAt = evo && evo.length ? Math.min.apply(null, evo.map((e) => e.at)) : Infinity;
    const failures = []; let measured = 0, ok = 0, hard = false;
    for (const part of Object.keys(P.declared)) {
      if (!P.declared[part]) continue;
      const di = P.declIdx[part];
      // contrast device: declared ONLY in exposed/release nodes (the bridge
      // pad wall, the anthem bridge brass) — a designed late arrival.
      if (di.every((i) => { const t = tagOf(secs[i]); return t === "exposed" || t === "release"; })) continue;
      // evolution gift: first declared at/after the evolution boundary.
      if (di.every((i) => i >= evoAt)) continue;
      measured++;
      if (!P.count[part]) {
        hard = true;
        failures.push({ part, hard: true, what: part + " is declared in the resolved state but NEVER sounds" });
        continue;
      }
      // ONE-CYCLE FLOOR: an opener of one full harmonic cycle is idiomatic
      // (blues' 12-bar piano chorus), never lateness.
      // ON-DESIGN FLOOR (balance loop 2): the form GRAPH's designed entry
      // fraction for this part (K.FORM_ENTRY, derived from the graphs so it
      // can never drift from them) x the realized track length, plus one
      // cycle of solver-quantization slack. A part arriving there is exactly
      // where the arc PLACED it — the form is the genre's identity; the beat
      // table above stays the cap for drag the form never asked for (dance-
      // pop's loop-1 hook at 54% vs a 37.5% design stays named). This clears
      // the fast/long-cycle geometry outliers that are on design: the beat
      // table punished standbylightdrive's 137bpm wave (swell bass at beat
      // 160 = 38.5% of the arc = 70 SECONDS) and singeli's 214bpm dj lift
      // (beat 288 = 81s) for having many beats, not for dragging.
      const totalBeats = P.spans.length ? P.spans[P.spans.length - 1].end : 0;
      const desFrac = K && K.FORM_ENTRY && K.FORM_ENTRY[form] ? K.FORM_ENTRY[form][part] : null;
      const designBound = desFrac != null ? desFrac * totalBeats + (P.spans.cycleBeats || 0) : -1;
      const bound = Math.max(bounds[part] != null ? bounds[part] : 96, P.spans.cycleBeats || 0, designBound);
      // ARRIVAL is bar-grained: a dub bass whose cell starts at beat 2.5 of
      // its bar arrived AT the bar — floor the first onset to the chord-bar
      // grid before judging patience (in-bar pattern offsets are the groove,
      // not lateness).
      const CB = P.spans.CB || 8;
      const arrival = Math.floor(P.first[part] / CB) * CB;
      if (arrival > bound)
        failures.push({ part, what: `${part} first sounds at beat ${round(P.first[part], 1)} (bound ${bound}, form ${form})` });
      else ok++;
    }
    return { score: measured ? round(ok / measured) : 1, failures, hard };
  }

  // ---------------------------------------------------------------- law: REGISTER
  // Per sampled voice slot (melody/pad/bass): % of its pitched events whose
  // midi sits in the natural window [bottom zone root - 12, top zone root + 6].
  // Synth voices exempt; solo/counter events exempt from the melody slot
  // (they render on their own solo units with their own samplers — v1 scope).
  function register(state, ev, P) {
    const I = state.instruments || {};
    const failures = [], per = [];
    for (const [slot, voice] of [["melody", "melody"], ["pad", "pad"], ["bass", "bass"]]) {
      const m = I[slot];
      if (!m || m.model !== "sampler" || !m.sampler || !Array.isArray(m.sampler.zones) || !m.sampler.zones.length) continue;
      const roots = m.sampler.zones.map((z) => z.root).filter((r) => r != null);
      if (!roots.length) continue;
      const lo = Math.min.apply(null, roots) - FLOOR_ST, hi = Math.max.apply(null, roots) + STRETCH_ST;
      const evs = ev.pitched.filter((p) => slot === "melody" ? (p.voice === "melody" && !p.solo) : p.voice === voice);
      if (!evs.length) continue;
      let inW = 0, worst = null;
      for (const p of evs) {
        const md = E.pchToMidi(p.pch);
        if (md >= lo && md <= hi) inW++;
        else { const off = md > hi ? md - hi : lo - md; if (!worst || off > worst.off) worst = { off, dir: md > hi ? "above" : "below" }; }
      }
      const frac = inW / evs.length;
      per.push(frac);
      if (frac < 0.95) failures.push({ voice: slot, what:
        `${slot} (${m.sampler.id}): ${Math.round((1 - frac) * 100)}% of ${evs.length} notes outside natural range [${lo}..${hi}] midi (worst ${worst.off} st ${worst.dir})` });
    }
    return { score: per.length ? round(per.reduce((a, b) => a + b, 0) / per.length) : 1, failures };
  }

  // ---------------------------------------------------------------- law: PROMISES
  // Seed promises (blessed truth only, each VERIFIED against renders before
  // being written — MUSICALITY.md rollout §6):
  //   reggae      — the skank chops the offbeat eighths (verified: 100% of
  //                 stab-layer onsets on off-eighths, seeds 1-3), and — balance
  //                 loop 1 — kickOn:[3]: the ONE DROP is real.
  //                 The csd-engine `onedrop` kit (kick + cross-stick TOGETHER
  //                 on beat 3 of each measure, beat 1 empty, skank off-eighth
  //                 hats) is reggae's whole kit pool; measured 100% of kitted
  //                 measures on seeds 1-5 (was 2-5% under the old kick/
  //                 halftime pool). The pad voice is downbeat chord sustains,
  //                 so skankOffbeat:"pad" would fail — the skank lives in the
  //                 stab layer.
  //   salondawdle — waltz: meter 3/4 (verified, seeds 1-3).
  //   chalkvespers— drumless by design (verified: zero drum events, seeds 1-3).
  const PROMISES = {
    reggae:       { skankOffbeat: "stab", kickOn: [3] },
    salondawdle:  { meter: "3/4" },
    chalkvespers: { drumless: true },
  };

  const OFFBEAT = (b) => ((Math.round(b * 2) % 2) + 2) % 2 === 1;   // nearest eighth slot is an "&"

  function checkPromises(promises, state, ev, P) {
    P = P || partsOf(state, ev);
    const failures = [], warnings = [];
    let total = 0, kept = 0;
    if (!promises) return { score: 1, failures, warnings, declared: 0 };
    const measureBeats = state.meter && (state.meter.beats | 0) >= 3 ? (state.meter.beats | 0) : 4;
    for (const [key, val] of Object.entries(promises)) {
      switch (key) {
        case "kickOn": {   // kick present on those (1-based) beats in >=60% of kitted measures
          total++;
          const kit = ev.drums.filter((d) => CORE[d.drum]);
          const kicks = ev.drums.filter((d) => d.drum === "kick");
          const kitted = new Set(kit.map((d) => Math.floor(d.beat / measureBeats)));
          const bad = [];
          for (const b of [].concat(val)) {
            const hitM = new Set();
            for (const k of kicks) {
              const m = Math.floor(k.beat / measureBeats), pos = k.beat - m * measureBeats;
              if (Math.abs(pos - (b - 1)) < 0.2) hitM.add(m);
            }
            let hits = 0; for (const m of kitted) if (hitM.has(m)) hits++;
            const frac = kitted.size ? hits / kitted.size : 0;
            if (frac < 0.6) bad.push(`beat ${b} in ${Math.round(frac * 100)}% of ${kitted.size} kitted measures (need 60%)`);
          }
          if (bad.length) failures.push({ promise: "kickOn", what: "kickOn[" + [].concat(val).join(",") + "] broken: " + bad.join("; ") });
          else kept++;
          break;
        }
        case "drumless": {
          total++;
          const n = ev.drums.length;
          if (val ? n === 0 : n > 0) kept++;
          else failures.push({ promise: "drumless", what: val ? `drumless promised but ${n} drum events sound` : "drums promised but none sound" });
          break;
        }
        case "skankOffbeat": {   // that voice's onsets >=70% on the off-eighths
          total++;
          let onsets;
          if (val === "pad") onsets = ev.pitched.filter((p) => p.voice === "pad").map((p) => p.beat);
          else if (val === "lead") onsets = ev.pitched.filter((p) => p.voice === "melody" && !p.solo).map((p) => p.beat);
          else if (val === "stab") onsets = (ev.sfx || []).filter((s) => s.stab).map((s) => s.beat);
          else { total--; warnings.push({ promise: key, what: `unknown skankOffbeat target "${val}" (know pad|lead|stab)` }); break; }
          const off = onsets.filter(OFFBEAT).length;
          const frac = onsets.length ? off / onsets.length : 0;
          if (frac >= 0.7) kept++;
          else failures.push({ promise: "skankOffbeat", what: `skankOffbeat:${val} broken: ${Math.round(frac * 100)}% of ${onsets.length} onsets on offbeats (need 70%)` });
          break;
        }
        case "bassStyle": {   // resolved bass vocabulary (section patterns + bass model) intersects the promised set
          total++;
          const want = [].concat(val);
          const got = new Set((state.sections || []).map((s) => s.bass).filter((b) => b && b !== "off"));
          if (state.instruments && state.instruments.bass && state.instruments.bass.model) got.add(state.instruments.bass.model);
          if (want.some((w) => got.has(w))) kept++;
          else failures.push({ promise: "bassStyle", what: `bassStyle ${JSON.stringify(val)} broken: resolved bass is {${[...got].join(",")}}` });
          break;
        }
        case "meter": {
          total++;
          const m = state.meter, sig = m ? (m.beats | 0) + "/" + ((m.unit | 0) || 4) : "4/4";
          if (sig === val || (val === "4/4" && !m)) kept++;
          else failures.push({ promise: "meter", what: `meter ${val} promised but state resolves ${sig}` });
          break;
        }
        case "partPresent": {   // those parts declared AND sounding
          total++;
          const missing = [].concat(val).filter((p) => !(P.declared[p] && P.count[p] > 0));
          if (!missing.length) kept++;
          else failures.push({ promise: "partPresent", what: `partPresent broken: ${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} not sounding` });
          break;
        }
        default:
          warnings.push({ promise: key, what: `unknown promise key "${key}" — vocabulary grows with the cards (WARN, not a crash)` });
      }
    }
    return { score: total ? round(kept / total) : 1, failures, warnings, declared: total };
  }

  // ------------------------------------------------ card-parse PROMISES (auto)
  // The hand PROMISES table above encodes blessed STRUCTURED claims. This
  // reads the CARD itself as a falsifiable contract, automatically: parse the
  // genre's `info` blurb for concrete instrument/voice NOUNS and check each
  // against what the genre's recipe can realize (capability from the spec pools —
  // the same basis the card-truth sweep used, ported here as the standing guard
  // that wave earned). A noun the card promises but no recipe can produce is
  // STATE-MISSING: a card lie. Reported WARN-level (the graduation rule — the
  // capability KEPT is deliberately generous, audibility is a separate ear-blessed
  // layer), tagged "card:<name>" so the suite surfaces lies without failing the
  // build. Regex must MATCH a claim to check it, so a card that never names an
  // instrument is never penalised.
  const _arr = (a) => Array.isArray(a) ? a : (a == null ? [] : [a]);
  // Capability from the MIXED STATES (not the spec pools): sampled-by-default
  // assigns the actual GM sampler at K.mix time, so the spec's recipe.samplerPool
  // misses reggae's organ / bebop's sax / bluegrass's banjo. Union across the
  // audited seeds so a pooled instrument that only some seeds draw still counts.
  function cardCap(states, G) {
    const cap = { models: new Set(), samplers: new Set(), patches: new Set(),
      refIds: [], speechIds: [], hasSpeech: false, breakRole: false };
    const refs = new Set();
    // SPEC POOLS too (hybrid capability): an instrument the recipe CAN draw but
    // this seed didn't (whalejazz's tenor_sax is in samplerPool but seeds 1,2 drew
    // the muted trumpet) is still a kept promise. State catches sampled-by-default's
    // GM assignment; the pools catch the un-drawn options. Union = the genre's true
    // vocabulary, matching the card-truth sweep's capability basis.
    if (G) {
      for (const part of [G.bass, G.lead, G.pads]) {
        const R = part && part.recipe; if (!R) continue;
        (Array.isArray(R.model) ? R.model : [R.model]).forEach((m) => m && cap.models.add(m));
        _arr(part.samplerPool).concat(_arr(R.samplerPool)).forEach((s) => cap.samplers.add(String(s)));
        _arr(part.patchPool).concat(_arr(R.patchPool)).forEach((p) => cap.patches.add(String(p)));
      }
      const DD = G.drums || {};
      ["kickModel", "snareModel", "hatModel"].forEach((k) => _arr(DD[k]).forEach((m) => cap.models.add("drum:" + m)));
      for (const src of [G.found, G.hits, G.vox]) _arr(src && src.sources).forEach((id) => refs.add(id));
      _arr(G.sampleEvents).forEach((ev) => _arr(ev.pool).forEach((id) => refs.add(id)));
      if (/break|chop/.test((G.found && G.found.role) || "")) cap.breakRole = true;
      if (G.synthText) cap.hasSpeech = true;
    }
    for (const st of states) {
      const I = st.instruments || {};
      for (const vk of ["pad", "bass", "melody"]) {
        const u = I[vk]; if (!u) continue;
        if (u.model) cap.models.add(u.model);
        if (u.sampler && u.sampler.id) cap.samplers.add(String(u.sampler.id));
        if (u.dx7 && u.dx7.name) cap.patches.add(String(u.dx7.name));
      }
      const D = I.drums || {};
      ["kickModel", "snareModel", "hatModel"].forEach((k) => { if (D[k]) cap.models.add("drum:" + D[k]); });
      for (const k of Object.keys(D)) if (/Sampler$/.test(k) && D[k] && D[k].id) cap.samplers.add(String(D[k].id));
      _arr(st.foundSources).forEach((s) => s && s.id && refs.add(s.id));
      _arr(st.sampleEvents).forEach((ev) => _arr(ev.pool).forEach((id) => refs.add(id)));
      _arr(st.sections).forEach((s) => { if (s.found && s.found.sourceId) refs.add(s.found.sourceId);
        if (/break|chop/.test((s.found && s.found.role) || "")) cap.breakRole = true; });
      if (st.synthText) cap.hasSpeech = true;
    }
    cap.refIds = [...refs];
    cap.speechIds = cap.refIds.filter((id) => /^sp_|^vx_|choir|vocal|voice/i.test(id));
    if (cap.speechIds.length) cap.hasSpeech = true;
    return cap;
  }
  const _samp = (cap, ...subs) => [...cap.samplers].some((s) => subs.some((sub) => s.includes(sub)));
  const _model = (cap, ...ms) => ms.some((m) => cap.models.has(m) || cap.models.has("drum:" + m));
  const _patch = (cap, re) => [...cap.patches].some((p) => re.test(p));
  const _ref = (cap, re) => cap.refIds.some((id) => re.test(id));
  // [name, regex to find the noun in the card, predicate the spec can realize it]
  const CARD_CLAIMS = [
    ["piano",         /\b(piano|grand)\b/i,                                (c) => _model(c,"piano") || _samp(c,"piano","grand","honky_tonk") || _patch(c,/PIANO/), /electric[- ]piano|e-?piano|tine/i],   // skip when the card means ELECTRIC piano (own claim below)
    ["electric-piano",/\b(rhodes|e-?piano|electric[- ]piano|tine)\b/i,     (c) => _model(c,"rhodes","fm") || _samp(c,"rhodes","electric_piano","legend_ep") || _patch(c,/E\.?PIANO|CLAV/)],
    ["organ",         /\b(organ|hammond|tonewheel|leslie|harmonium)\b/i,   (c) => _model(c,"organ","hammond") || _samp(c,"organ") || _patch(c,/ORGAN/)],
    ["harpsichord",   /\bharpsichord\b/i,                                  (c) => _model(c,"harpsichord") || _samp(c,"harpsichord") || _patch(c,/HARPSI/)],
    ["clavinet",      /\bclav(inet)?\b/i,                                  (c) => _model(c,"clavinet") || _samp(c,"clavinet") || _patch(c,/CLAV/)],
    ["celesta",       /\b(celesta|celeste)\b/i,                            (c) => _samp(c,"celesta") || _patch(c,/CELEST/)],
    ["vibraphone",    /\b(vibraphone|vibes)\b/i,                           (c) => _samp(c,"vibraphone") || _patch(c,/VIBE/)],
    ["marimba",       /\bmarimba\b/i,                                      (c) => _samp(c,"marimba") || _patch(c,/MARIMBA/)],
    ["glockenspiel",  /\b(glockenspiel|glocken)\b/i,                       (c) => _samp(c,"glock") || _model(c,"bell")],
    ["music-box",     /\bmusic[- ]box\b/i,                                 (c) => _samp(c,"music_box")],
    ["bells/chimes",  /\b(tubular bell|orch.?chime|hand ?bell|carillon)\b/i,(c) => _samp(c,"bell","chime","tubular") || _model(c,"bell") || _patch(c,/BELL|CHIME/)],
    ["strings",       /\b(strings|violin|cello|viola|orchestral)\b/i,      (c) => _model(c,"strings","atmosphere") || _samp(c,"strings","violin","cello","bowed_glass","atmosphere") || _patch(c,/STRING/), /palm[- ]muted|low strings|guitar/i],   // "low strings"/"palm-muted strings" = guitar, not orchestral
    ["harp",          /\bharp\b/i,                                         (c) => _samp(c,"harp") || _patch(c,/HARP/)],
    ["flute",         /\bflute\b/i,                                        (c) => _samp(c,"flute") || _patch(c,/FLUTE/)],
    ["saxophone",     /\b(sax|saxophone)\b/i,                              (c) => _samp(c,"sax") || _patch(c,/SAX/)],
    ["clarinet",      /\bclarinet\b/i,                                     (c) => _samp(c,"clarinet")],
    ["oboe",          /\boboe\b/i,                                         (c) => _samp(c,"oboe")],
    ["trumpet/brass", /\b(trumpet|brass|fanfare)\b/i,                      (c) => _samp(c,"trumpet","brass") || _patch(c,/BRASS|TRUMPET/) || _ref(c,/horn/)],
    ["trombone",      /\btrombone\b/i,                                     (c) => _samp(c,"trombone")],
    ["accordion",     /\b(accordion|accordian|bandoneon)\b/i,              (c) => _samp(c,"accordion","accordian","bandoneon") || _patch(c,/ACCOR/)],
    ["guitar",        /\bguitar\b/i,                                       (c) => _model(c,"pluck","karplus","kpluck") || _samp(c,"guitar") || _patch(c,/GUITAR/)],
    ["banjo",         /\bbanjo\b/i,                                        (c) => _samp(c,"banjo")],
    ["mandolin",      /\bmandolin\b/i,                                     (c) => _samp(c,"mandolin")],
    ["koto",          /\bkoto\b/i,                                         (c) => _samp(c,"koto")],
    ["sitar",         /\bsitar\b/i,                                        (c) => _samp(c,"sitar")],
    ["panpipe",       /\b(panpipe|pan flute|pan pipe)\b/i,                 (c) => _samp(c,"pan_flute","panflute","panpipe","whistle") || _patch(c,/PIPE|WHISTLE/)],
    ["theremin",      /\btheremin\b/i,                                     (c) => _samp(c,"theremin") || _model(c,"stack","modeld","sine")],   // a theremin IS a vibrato sine lead (spacelounge's card: "theremin-vibrato sine")
    ["choir/vocal",   /\b(choir|vocal|chant|anthem|sing|vox|voice)\b/i,    (c) => c.hasSpeech || _samp(c,"choir","ahh","ooh") || _model(c,"vocoder")],
    ["amen/break",    /\b(amen break|breakbeat|chopped[- ]break|break(-| )?chops)\b/i,  (c) => c.breakRole || _ref(c,/amen|break/i)],   // "amen break" the sample, not the amen CADENCE ("resolved on the amen") or lineage ("the amen polished into a groove")
    ["303/acid",      /\b(303|acid line|squelch)\b/i,                      (c) => _model(c,"303","tb303","acid") || _samp(c,"303")],
    ["hoover",        /\bhoover\b/i,                                       (c) => _model(c,"hoover")],
    ["reese",         /\breese\b/i,                                        (c) => _model(c,"reese")],
  ];
  function checkCardClaims(genre, states) {
    const G = K && K.GENRES && K.GENRES[genre];
    const warnings = [];
    if (!G || !G.info) return { warnings };
    if (!states || !states.length) states = [1, 2].map((s) => K.track(genre, { seed: s }));   // standalone call: mix a couple seeds
    const card = String(G.info), cap = cardCap(states, G);
    for (const [name, re, has, skipRe] of CARD_CLAIMS) {
      if (!re.test(card)) continue;
      if (skipRe && skipRe.test(card)) continue;   // the card means a DIFFERENT thing (electric piano, guitar "strings")
      let ok = false; try { ok = !!has(cap); } catch (e) { ok = true; }   // a predicate bug must never fail a genre
      if (!ok) warnings.push({ promise: "card:" + name, what: `card claims "${name}" but no recipe realizes it (STATE-MISSING)` });
    }
    return { warnings };
  }

  // ---------------------------------------------------------------- law: MOTION
  // Boredom check: consecutive sections with the same declaration head AND a
  // byte-identical event signature, in runs longer than 2, are a WARN-level
  // finding. Cheap FNV hash over sorted per-section event strings (relative
  // beats) — the amp/humanity jitters mean only true verbatim loops collide.
  function motion(state, ev, P) {
    P = P || partsOf(state, ev);
    const sigs = P.spans.map((sp) => {
      const s = sp.sec;
      const head = [s.drums || "off", s.bass || "off", s.melody || "off", s.pads ? 1 : 0,
        s.keyShift | 0, s.stab || "", (s.found && s.found.sourceId) || ""].join("|");
      const lines = [];
      for (const d of ev.drums) if (d.beat >= sp.start && d.beat < sp.end)
        lines.push("d" + round(d.beat - sp.start, 2) + ":" + d.drum + ":" + round(d.amp, 2));
      for (const p of ev.pitched) if (p.beat >= sp.start && p.beat < sp.end)
        lines.push("p" + round(p.beat - sp.start, 2) + ":" + p.pch + ":" + round(p.amp, 2) + ":" + p.voice);
      lines.sort();
      let h = 2166136261;
      for (const ln of lines) for (let i = 0; i < ln.length; i++) { h ^= ln.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return head + "#" + (h >>> 0).toString(16);
    });
    const failures = []; let excess = 0;
    let i = 0;
    while (i < sigs.length) {
      let j = i + 1;
      while (j < sigs.length && sigs[j] === sigs[i]) j++;
      const L = j - i;
      if (L > 2) {
        excess += L - 2;
        const s = P.spans[i].sec;
        failures.push({ warn: true, what: `sections ${i + 1}-${j} identical x${L} (kit=${s.drums || "off"} bass=${s.bass || "off"} lead=${s.melody || "off"})` });
      }
      i = j;
    }
    return { score: sigs.length ? round(1 - excess / sigs.length) : 1, failures };
  }

  // ---------------------------------------------------------------- audit
  function promisesFor(state, genre) {
    if (state && state.promises) return state.promises;                          // future kernel field wins
    if (genre && PROMISES[genre]) return PROMISES[genre];
    return null;
  }

  function auditOne(state, genre, form) {
    const ev = E.buildEvents(state);
    const P = partsOf(state, ev);
    return {
      bloom: bloom(state, ev, form, P),
      register: register(state, ev, P),
      promises: checkPromises(promisesFor(state, genre), state, ev, P),
      motion: motion(state, ev, P),
    };
  }

  const LAWS = ["bloom", "register", "promises", "motion"];

  function audit(genreOrState, opts) {
    opts = opts || {};
    const isState = genreOrState && typeof genreOrState === "object";
    const genre = isState
      ? ((genreOrState.genreMeta && genreOrState.genreMeta.genres && genreOrState.genreMeta.genres[0]) || "(state)")
      : String(genreOrState);
    if (!isState && (!K || !K.GENRES[genre])) throw new Error("unknown genre: " + genre);
    const seeds = isState ? [genreOrState.seed != null ? genreOrState.seed : 1]
      : (opts.seeds && opts.seeds.length ? opts.seeds : [1, 2, 3]);
    const states = isState ? [genreOrState] : seeds.map((s) => K.track(genre, { seed: s }));
    const form = (states[0].genreMeta && states[0].genreMeta.form)
      || (K && K.GENRES[genre] && K.GENRES[genre].form) || "pop";
    const laws = {};
    for (const l of LAWS) laws[l] = { score: 0, failures: [], warnings: [] };
    let hard = false;
    states.forEach((st, i) => {
      const r = auditOne(st, genre, form);
      for (const l of LAWS) {
        laws[l].score += r[l].score;
        for (const f of r[l].failures || []) laws[l].failures.push(Object.assign({ seed: seeds[i] }, f));
        for (const w of r[l].warnings || []) laws[l].warnings.push(Object.assign({ seed: seeds[i] }, w));
      }
      laws.promises.declared = Math.max(laws.promises.declared || 0, r.promises.declared || 0);
      if (r.bloom.hard) hard = true;
    });
    // card-parse promises: once per genre (state-independent), WARN-level — the
    // standing card-lie guard. Skipped for a raw state (no genre card to read).
    if (!isState) for (const w of checkCardClaims(genre, states).warnings) laws.promises.warnings.push(w);
    for (const l of LAWS) laws[l].score = round(laws[l].score / states.length);
    const overall = round(LAWS.reduce((s, l) => s + laws[l].score, 0) / LAWS.length);
    const nFail = LAWS.reduce((s, l) => s + laws[l].failures.length, 0);
    const nWarn = LAWS.reduce((s, l) => s + laws[l].warnings.length, 0);
    const verdict = hard || laws.promises.failures.length ? "FAIL" : (nFail || nWarn) ? "WARN" : "OK";
    return { genre, form, seeds, laws, overall, verdict,
      worst: nFail ? [...laws.bloom.failures, ...laws.promises.failures, ...laws.register.failures, ...laws.motion.failures][0].what : null };
  }

  function auditAll(opts) {
    opts = opts || {};
    if (!K) throw new Error("auditAll needs the genre kernel");
    const rows = Object.keys(K.GENRES).map((g) => audit(g, opts));
    if (opts.rank) rows.sort((a, b) => a.overall - b.overall || a.genre.localeCompare(b.genre));
    return rows;
  }

  // ---------------------------------------------------------------- report
  function scorecard(a) {
    const L = [];
    L.push(`${a.genre} (form ${a.form}, seeds [${a.seeds.join(",")}]) — overall ${a.overall.toFixed(2)}  ${a.verdict}`);
    for (const l of LAWS) {
      const r = a.laws[l];
      L.push(`  ${l.padEnd(8)} ${r.score.toFixed(2)}${l === "promises" && !r.declared ? "  (none declared)" : ""}`);
      for (const f of r.failures) L.push(`    x ${f.what}${f.seed != null ? ` [seed ${f.seed}]` : ""}`);
      for (const w of r.warnings) L.push(`    ~ ${w.what}${w.seed != null ? ` [seed ${w.seed}]` : ""}`);
    }
    return L.join("\n");
  }

  function rankTable(rows) {
    const L = [`rank genre               overall bloom  reg   prom  mot   verdict`];
    rows.forEach((r, i) => {
      L.push(`${String(i + 1).padStart(4)} ${r.genre.padEnd(19)} ${r.overall.toFixed(2)}    ${LAWS.map((l) => r.laws[l].score.toFixed(2)).join("  ")}  ${r.verdict}${r.worst ? "  — " + r.worst : ""}`);
    });
    return L.join("\n");
  }

  const api = { audit, auditAll, scorecard, rankTable,
    PROMISES, BLOOM_BOUNDS, checkCardClaims, CARD_CLAIMS,
    laws: { bloom, register, promises: checkPromises, motion },
    partsOf, sectionSpans };
  if (isNode) module.exports = api; else root.Musicality = api;

  // ---------------------------------------------------------------- CLI
  if (isNode && require.main === module) {
    const args = process.argv.slice(2);
    const cmd = args[0];
    const has = (f) => args.includes("--" + f);
    const flagV = (f, d) => { const i = args.indexOf("--" + f); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
    const seeds = String(flagV("seeds", "1,2,3")).split(",").map((s) => parseInt(s, 10)).filter((n) => n > 0);
    if (cmd !== "audit" || !args[1]) {
      console.log("usage: node engine/musicality.js audit <genre|all> [--seeds 1,2,3] [--rank] [--json]");
      process.exit(2);
    }
    const target = args[1];
    if (target === "all") {
      const rows = auditAll({ seeds, rank: has("rank") });
      if (has("json")) console.log(JSON.stringify(rows, null, 2));
      else if (has("rank")) console.log(rankTable(rows));
      else rows.forEach((r) => { console.log(scorecard(r)); console.log(""); });
      const counts = rows.reduce((c, r) => ((c[r.verdict] = (c[r.verdict] || 0) + 1), c), {});
      if (!has("json")) console.log(`\n${rows.length} genres x ${seeds.length} seeds — ${counts.OK || 0} ok, ${counts.WARN || 0} warn, ${counts.FAIL || 0} fail (soft gate: findings, not blocks)`);
    } else {
      const a = audit(target, { seeds });
      console.log(has("json") ? JSON.stringify(a, null, 2) : scorecard(a));
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
