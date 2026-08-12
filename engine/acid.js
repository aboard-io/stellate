// acid.js — SIXTEEN STEPS AND A FILTER. The smallest thing that makes acid house.
//
// This is deliberately NOT the fugue kernel pointed at a different genre, and
// the measurement is why. Across all 274 anchors, acid house's most extreme
// number is 1.7σ — statistically unremarkable — while `tb303` appears in TWO
// anchors out of 274. Its identity is not a treatment and not a transform: it is
// a NOUN and a PATTERN. So there is no group of restatements here, because the
// genre does not restate. There is a sequencer and a knob you move while it runs.
//
//     steps   16 × { on, semi, slide, accent }
//     filter  cutoff · resonance · envmod · decay
//     sweep   the filter moving across bars — the performance
//
// THE THREE PER-STEP FLAGS ARE THE INSTRUMENT. A 303 without accent and slide is
// a sixteenth-note bass line, which is not the same thing:
//
//   ACCENT  boosts the VCA *and* sharpens the filter envelope — on the real
//           machine it is one circuit doing both, which is why an accented step
//           sounds brighter and not merely louder (dsp/tb303.dsp).
//   SLIDE   holds the gate across to the next step so the pitch glides with NO
//           envelope retrigger. Expressed as DURATION: a sliding step lasts to
//           the next one, and the engine's mono-legato voice does the rest.
//   REST    a step that is simply absent, which is what gives a 303 line its
//           lurch — the gaps are as composed as the notes.
//
// Output is `state.bassCells` in the shipped format plus the tb303 recipe's own
// params. No new interpreter.

(function (root) {
  "use strict";
  const N = 16;                       // one bar of sixteenths
  const STEP = 0.5;                   // engine beats per step (16 over an 8-beat cell)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // A step: {on, semi, slide, accent}. `semi` is semitones from the chord root,
  // which is what lets a 303 line be chromatic while still following the harmony
  // — the same reason the melody ladder is degrees and not pitches.
  const step = (on, semi, slide, accent) => ({ on: !!on, semi: semi | 0, slide: !!slide, accent: !!accent });
  const EMPTY = () => Array.from({ length: N }, () => step(0, 0, 0, 0));

  // The default is the shape everyone plays first: root, octave, and a couple of
  // slides. It is a starting point, not a preset library.
  function DEFAULT() {
    const s = EMPTY();
    const on = [[0, 0, 0, 1], [2, 0, 0, 0], [3, 12, 1, 0], [4, 0, 0, 0], [6, 3, 0, 1],
      [7, 0, 0, 0], [8, 0, 0, 0], [10, 12, 1, 0], [11, 10, 0, 0], [12, 0, 0, 1],
      [14, 7, 0, 0], [15, 3, 0, 0]];
    for (const [i, semi, sl, ac] of on) s[i] = step(1, semi, sl, ac);
    return s;
  }

  // ------------------------------------------------------------------- the cell
  // A step's DURATION is what carries slide: a sliding step reaches the next live
  // step, so the two overlap and the mono-legato voice glides between them. A
  // non-sliding step is short and re-triggers the envelope. That is the whole
  // mechanism, and it is why slide is not a separate field on the event.
  function cell(steps) {
    const out = [];
    for (let i = 0; i < N; i++) {
      const s = steps[i];
      if (!s || !s.on) continue;
      let j = i + 1;
      while (j < N && !(steps[j] && steps[j].on)) j++;
      const gap = (j - i) * STEP;
      const dur = s.slide ? gap : Math.min(gap * 0.55, STEP * 0.9);
      out.push([+(i * STEP).toFixed(4), +dur.toFixed(4), "r5", s.semi, s.accent ? 1.6 : 1]);
    }
    return out;
  }

  // ------------------------------------------------------------------ the knob
  // THE FILTER IS THE PERFORMANCE. Everything above is the pattern, and a 303
  // pattern on its own is inert — the genre is what you do to the cutoff while it
  // repeats. `sweep` is that movement, expressed the way the engine already
  // expresses it: a `filtersweep` insert on the bass recipe, which acid house's
  // own anchor already carries (rateBars 1.312, lo −0.682, hi 1.006).
  const FILTER = {
    cutoff: { min: 60, max: 6000, def: 500, log: true, label: "cut off" },
    res: { min: 0, max: 0.95, def: 0.65, label: "resonance" },
    envmod: { min: 0, max: 1, def: 0.69, label: "env mod" },
    decay: { min: 0.05, max: 1.2, def: 0.4, label: "decay" },
    sweepRate: { min: 0.25, max: 8, def: 1.3, label: "sweep bars" },
    sweepDepth: { min: 0, max: 1, def: 0.7, label: "sweep depth" },
  };
  const FILTER_IDS = Object.keys(FILTER);
  const defaultFilter = () => { const f = {}; for (const k of FILTER_IDS) f[k] = FILTER[k].def; return f; };

  // --------------------------------------------------------------------- build
  function build(base, opts) {
    opts = opts || {};
    const steps = opts.steps || DEFAULT();
    const f = Object.assign(defaultFilter(), opts.filter || {});
    const s = base;
    const c = cell(steps);

    s.bassCells = Object.assign({}, s.bassCells, { acid_303: c });
    // every section that plays bass plays THIS line — acid house is one pattern
    // over a whole track, and the arrangement is the filter, not the notes
    for (const sec of s.sections || []) if (sec.bass && sec.bass !== "off") sec.bass = "acid_303";

    const I = s.instruments || (s.instruments = {});
    // the 303 is a SYNTH, never a sample: `sampledOnly` would otherwise rewrite
    // the bass to a GM patch and the genre would evaporate
    I.bass = Object.assign({}, I.bass, {
      model: "tb303", sampler: null, dx7: null, wave: "saw",
      cutoff: clamp(f.cutoff, 60, 6000), res: clamp(f.res, 0, 0.95),
      envmod: clamp(f.envmod, 0, 1), decay: clamp(f.decay, 0.05, 1.2),
      inserts: f.sweepDepth > 0.01
        ? [{ type: "filtersweep", rateBars: clamp(f.sweepRate, 0.25, 8),
            lo: -clamp(f.sweepDepth, 0, 1), hi: clamp(f.sweepDepth, 0, 1) * 1.4, res: clamp(f.res, 0, 0.95) }]
        : [],
    });
    s.voiceStreams = true;
    return { state: s, cell: c, steps, filter: f,
      live: steps.filter((x) => x.on).length,
      accents: steps.filter((x) => x.on && x.accent).length,
      slides: steps.filter((x) => x.on && x.slide).length };
  }

  // --------------------------------------------------------------------- codec
  // Sixteen steps as sixteen characters, so a pattern rides a URL: `.` is a rest,
  // otherwise a base-36 digit for the semitone (0-35) with case and punctuation
  // carrying the flags. Short enough to read, and every field is a small integer
  // or a fixed symbol — nothing a stranger's link can name that the engine does
  // not already understand.
  // FLAGS ARE THEIR OWN CHARACTERS, not letter case. Case looked tidier and was
  // broken at the first thing anyone would try: `"0".toUpperCase()` is `"0"`, so
  // semitones 0-9 could not carry an accent — and an accented ROOT is the single
  // most common event in a 303 line. Only 10-35 worked, silently.
  //   .      a rest
  //   <b36>  the semitone, 0-35
  //   !      accent on the step just written
  //   ~      slide on the step just written
  const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
  function encode(steps) {
    return steps.map((s) => s.on
      ? B36[clamp(s.semi, 0, 35)] + (s.accent ? "!" : "") + (s.slide ? "~" : "")
      : ".").join("");
  }
  function decode(str) {
    const out = EMPTY();
    let i = 0;                                   // the next step to fill
    for (let k = 0; k < String(str).length && i <= N; k++) {
      const ch = String(str)[k];
      if (ch === "!") { if (i > 0) out[i - 1].accent = true; continue; }
      if (ch === "~") { if (i > 0) out[i - 1].slide = true; continue; }
      if (i >= N) continue;
      if (ch === ".") { i++; continue; }
      const v = B36.indexOf(ch.toLowerCase());
      if (v < 0) continue;                        // anything else is ignored, never fatal
      out[i] = step(1, v, 0, 0);
      i++;
    }
    return out;
  }

  const api = { N, STEP, step, EMPTY, DEFAULT, cell, build, FILTER, FILTER_IDS, defaultFilter, encode, decode };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CsdAcid = api;
})(typeof window !== "undefined" ? window : globalThis);
