// fields.js — the FIELD REGISTRY: one definition of every box and layer
// control. Classic UMD like kernel.js, node-loadable, zero DOM.
//
// WHY THIS FILE EXISTS. The knowledge "which field lives where and what may it
// hold" used to be written out five times across the old kernel-daw.js — okBox's
// validation chain, emptyBox's defaults, toggle()'s dispatch, drawPalette's
// isOn(), the tag pile — and read twice more, and the copies had already
// diverged: b.clamp was defaulted and read but never validated, and LAYER_OPTS
// listed two kinds that could never occur. Every copy is now DERIVED from the
// FIELDS table at the bottom of this file; a new control is one entry here
// plus, where the sound needs it, one apply site in the engine.
//
// Place in the layer graph: kernel.js (algebra) -> genres.js (genre data) ->
// THIS FILE (control vocabulary) -> song.js (persistence) -> instruments.js ->
// compose.js (arranger policy) -> presets.js -> the UI. Nothing below the UI
// may reach above this file for a label.
(function (root) {
  "use strict";
  const K = (typeof module !== "undefined" && module.exports)
    ? require("./kernel.js") : root.NuKernel;
  const NG = (typeof module !== "undefined" && module.exports)
    ? require("./genres.js") : root.NuGenres;
  const { reverse, invert, rotate, fill, spread, split, del, drop,
          transpose, complement, crossmap, excerpt, only } = K;
  const { MODES, MODELABEL, SCALES, SCALELABEL } = NG;

  // ---- limits --------------------------------------------------------------
  // The numeric fences persistence and the grips both enforce. They live here
  // rather than in the UI file because a hand-edited save has to hit the same
  // wall a drag does: a len of 1e9 used to sail through the loader and render
  // a billion bars.
  const NSLOTS = 8, MAX_LEN = 64, MAX_NUDGE = 31, MAX_FX = 3;

  /* ---------- pattern operators ---------- */
  // FOUR LIST FAMILIES, 1..4 each. repeat and delete change the SEQUENCE —
  // repeat stretches every element, delete removes every nth and CLOSES the
  // gap, which is the part `drop` never did — and raise/lower move it in scale
  // degrees. Together with the inc/stk ramps this is the arpeggiator:
  // restructure the list, then let it climb.
  const OPS = { rev: reverse(), inv: invert(4), wide: spread(2), tight: spread(0.5) };
  const OPLABEL = { rev: "reverse", inv: "invert",
                    wide: "spread ×2", tight: "spread ÷2" };
  for (let n = 2; n <= 8; n++) { OPS["rep" + n] = split(n); OPLABEL["rep" + n] = "split " + n; }
  for (let n = 2; n <= 8; n++) { OPS["del" + n] = del(n);    OPLABEL["del" + n] = "delete " + n; }
  // delete 1 would remove every element — the annihilator, not a variation.
  //
  // THE REST OF THE ALGEBRA, which the palette had simply never offered — the
  // rotate that walks the sequence past itself, the accent flip, the slide
  // map, the loop-a-fragment. Every one is a call into an operator that
  // already existed and is already gated by test/unit/nukernel.test.js.
  for (let n = 1; n <= 7; n++) { OPS["rot" + n] = rotate(n); OPLABEL["rot" + n] = String(n); }
  // ONE VECTOR AT A TIME — the `only` discipline, which is what keeps a subject
  // recognizable while its rhythm or its pitches move underneath it. Rotating
  // the gate alone re-times the phrase and keeps every note; rotating deg alone
  // keeps the rhythm and re-pitches it.
  for (const n of [2, 4, 8]) {
    OPS["gat" + n] = only("gate", rotate(n)); OPLABEL["gat" + n] = "rhythm " + n;
    OPS["pit" + n] = only("deg", rotate(n));  OPLABEL["pit" + n] = "pitch " + n;
  }
  for (const n of [2, 3, 4]) { OPS["thin" + n] = drop(n); OPLABEL["thin" + n] = String(n); }
  for (const n of [2, 3, 4]) { OPS["dens" + n] = fill(n); OPLABEL["dens" + n] = String(n); }
  for (const n of [-2, -1, 1, 2]) {
    const k = "tr" + (n < 0 ? "m" : "p") + Math.abs(n);
    OPS[k] = transpose(n); OPLABEL[k] = (n > 0 ? "+" : "−") + Math.abs(n);
  }
  for (const n of [4, 8]) { OPS["ex" + n] = excerpt(0, n); OPLABEL["ex" + n] = String(n); }
  OPS.accflip  = complement("acc");       OPLABEL.accflip  = "flip accents";
  OPS.gateflip = complement("gate");      OPLABEL.gateflip = "negative";
  OPS.slides   = crossmap("acc", "sld");  OPLABEL.slides   = "accents slide";
  OPS.stick    = crossmap("gate", "acc"); OPLABEL.stick    = "accent all";

  /* ---------- transitions ---------- */
  // TRANSITIONS, in two families that are genuinely different types. LEVEL runs
  // on the event stream (kernel.js `envelope`); MOTION is automation on the
  // section's mixer channel, because a filter opening is a fact about the SOUND
  // and there is no event to hang it on. Offering both under one heading is the
  // point — from the outside they answer the same question, "how does this
  // section arrive".
  const ENVLABEL = { in: "fade in", out: "fade out", swell: "swell",
                     duck: "duck", drop: "drop", stutter: "stutter" };
  const MOTLABEL = { open: "filter open", close: "filter close",
                     rise: "riser", pump: "pump" };
  // INTRO / OUTRO — the two bars that are not like the others (kernel.js
  // `edges`). These are the ones that actually announce a section, because they
  // are the only transforms allowed to write events that were not there: a drum
  // fill is a different bar, not a louder one.
  const INLABEL  = { count: "count-in", hit: "downbeat", solo: "melody alone",
                     kit: "drums alone", swell: "swell in" };
  const OUTLABEL = { fill: "drum fill", roll: "snare roll", crash: "crash",
                     break: "drum break", tail: "no drums", cut: "cut short" };

  /* ---------- grid ---------- */
  const RATES = { half: 0.5, dbl: 2 };
  const RATELABEL = { half: "half time", dbl: "double time" };
  // SWING bends the grid — every odd sixteenth arrives late by this fraction of
  // a step. As a box control it is the difference between a pattern and a
  // performance, and it belongs to the section rather than to the genre for the
  // same reason tempo does.
  const SWINGS = { straight: 0, light: 0.12, swing: 0.22, shuffle: 1 / 3, hard: 0.42 };
  const SWINGLABEL = { straight: "straight", light: "light", swing: "swing",
                       shuffle: "shuffle", hard: "hard shuffle" };
  // GROOVE is the other half, and it is not the same half. Swing moves the odd
  // sixteenths and nothing else; a groove is a sixteen-slot fingerprint of BOTH
  // timing and loudness — which steps lean late, which land hard. `dub` is
  // mined rather than written (engine/pipes.js ACCENT_PROFILES, off the MIDIMAN
  // dub rip).
  const GROOVELABEL = { backbeat: "backbeat", push: "pushed", laidback: "laid back",
                        funk: "funk", dub: "dub" };
  // EVERY KIT OPERATOR kernel.js has, which is thirteen rather than four.
  const KITLABEL = { nodrums: "none", nokick: "no kick", nohats: "no hats",
                     snareonly: "snare only", shift: "shift", halftime: "half time",
                     doubletime: "double time", busy: "busy hats", sparse: "sparse",
                     four: "four on the floor", offbeat: "offbeat hats",
                     swap: "swap kick/snare", roll: "roll" };
  // WHICH SAMPLED KIT — found/samples/drums/<kit>/, the same extraction the big
  // engine plays. A genre names one; a box may borrow another, which is the
  // difference between playing a beat and playing it on somebody else's drums.
  const DRUMKITS = { acoustic: "acoustic", brush: "brushes", electronic: "electronic",
                     jazz: "jazz", power: "power", room: "room" };
  const BASSOPS = { nobass: "none", walk: "walking", octaves: "octaves",
                    fifths: "fifths", pedal: "pedal", eighths: "eighths",
                    sixteenths: "sixteenths", reese: "reese", wobble: "wobble" };

  /* ---------- the effects a section can carry ---------- */
  // THESE ARE THE BIG ENGINE'S OWN EFFECTS, not lookalikes. Each entry is
  // exactly the {type, params} shape engine/faust/voices/state-engine.js
  // `insertChain` normalizes and engine/faust/voices/sampler.js
  // `buildInsertNodes` builds — the same function the main app's live ring path
  // calls to put a chorus on a pad. The defaults below are the ones the module
  // declares, chosen to be audible on one bar.
  const FX = {
    chorus:   { label: "chorus",     params: { rate: 0.7, depth: 0.6, mix: 0.45 } },
    phaser:   { label: "phaser",     params: { rate: 0.35, depth: 0.8, mix: 0.7 } },
    flanger:  { label: "flanger",    params: { rate: 0.3, depth: 0.9, feedback: 0.6, mix: 0.6 } },
    tremolo:  { label: "tremolo",    params: { rate: 5, depth: 0.8, mix: 0.9 } },
    leslie:   { label: "leslie",     params: { speed: 0.7, depth: 0.85, mix: 0.6 } },
    wah:      { label: "auto-wah",   params: { base: 320, range: 2.2, sens: 0.7, q: 4, mix: 0.9 } },
    ringmod:  { label: "ring mod",   params: { freq: 180, mix: 0.4 } },
    sweep:    { label: "filter sweep", type: "filtersweep",
                params: { lo: 400, hi: 5200, res: 0.35, rateBars: 4 } },
    fenv:     { label: "squelch",    type: "fenv",
                params: { base: 380, amount: 2.4, sens: 0.7, res: 0.6, decay: 0.16, mix: 1 } },
    echo:     { label: "tape echo",  type: "delay",
                params: { timeBars: 0.1875, feedback: 0.4, tone: 2800, mix: 0.35 } },
    crunch:   { label: "crunch",     type: "higain",
                params: { drive: 0.6, stages: 2, gate: 0.2, low: 0.55, mid: 0.35,
                          high: 0.6, presence: 0.5, level: 0.55, mix: 0.9 } },
  };
  const FXLABEL = {};
  for (const k of Object.keys(FX)) FXLABEL[k] = FX[k].label;
  // the {type, params} list buildInsertNodes wants, from the box's chip keys
  const fxChain = keys => (keys || []).filter(k => FX[k])
    .map(k => ({ type: FX[k].type || k, params: { ...FX[k].params } }));

  // SENDS ARE DISCRETE, like everything else here. A chip is a decision; a
  // slider is a fiddle, and the whole surface is chips on purpose.
  const SENDS = { none: 0, touch: 0.12, some: 0.3, wet: 0.55, drown: 0.9 };
  const SENDLABEL = { none: "dry", touch: "touch", some: "some", wet: "wet", drown: "drown" };
  const VERBS = { room: "room", hall: "hall", plate: "plate" };
  // echo time as a fraction of a bar — the subdivisions worth having
  const DTIMES = { "16": 0.0625, "8": 0.125, "d8": 0.1875, "4": 0.25, "d4": 0.375, "2": 0.5 };
  const DTLABEL = { "16": "1/16", "8": "1/8", d8: "dotted", "4": "1/4", d4: "dotted 1/4", "2": "1/2" };
  const LEVELS = { hush: 0.4, back: 0.7, norm: 1, fwd: 1.35 };
  const LEVELLABEL = { hush: "hush", back: "back", norm: "normal", fwd: "forward" };
  const PANS = { l: -0.7, hl: -0.35, c: 0, hr: 0.35, r: 0.7 };
  const PANLABEL = { l: "left", hl: "left-ish", c: "centre", hr: "right-ish", r: "right" };

  /* ---------- what a voice can be told to do ---------- */
  // THE SYNTH KNOBS, as chips. Because the value is a NORMALIZED position
  // rather than a number in Hz, the same chips drive the 303, the Model D and
  // the reese/wobble basses through their own differently-named params.
  const VOX = {
    cut:  { labels: { dark: "dark", warm: "warm", open: "open", bright: "bright", scream: "screaming" },
            t: { dark: 0.06, warm: 0.16, open: 0.34, bright: 0.6, scream: 0.9 }, log: true },
    res:  { labels: { soft: "soft", med: "medium", hot: "hot", edge: "on the edge" },
            t: { soft: 0.2, med: 0.5, hot: 0.75, edge: 0.95 } },
    emod: { labels: { none: "none", low: "low", mid: "mid", max: "max" },
            t: { none: 0.02, low: 0.3, mid: 0.6, max: 0.95 } },
    dec:  { labels: { snap: "snap", short: "short", long: "long", drone: "drone" },
            t: { snap: 0.04, short: 0.16, long: 0.45, drone: 0.9 } },
    wave: { labels: { saw: "saw", square: "square" }, t: { saw: 0, square: 1 } },
  };
  // The param a knob rides, per DSP naming. First name that EXISTS on the node
  // wins, so one chip covers tb303 / modeld / bass_reese / bass_wobble without
  // a per-synth table — and a DSP that has none of them (the DX7) is simply not
  // touched rather than being fed a param it does not own.
  const VOXPARAM = { cut: ["cutoff"], res: ["resonance", "res"],
                     emod: ["envmod", "envAmount", "fenvAmount"],
                     dec: ["decay", "envDecay", "fenvDecay"],
                     wave: ["waveform", "oscMix"] };
  // REGISTER, per layer — the one voice transformation that works on a sampled
  // instrument as well as a synth, because it moves the note and not the timbre.
  const OCTAVES = { "-2": "−2", "-1": "−1", "0": "0", "1": "+1", "2": "+2" };

  // The two per-layer vocabularies that used to exist only as inline literals —
  // written four times (articulation) and three times (ramp mode) across okBox
  // and the palette, which is exactly the drift this file exists to end.
  const ARTICS = { staccato: "staccato", normal: "normal", legato: "legato", tie: "tie" };
  const CMODES = { hold: "hold", loop: "loop", reverse: "reverse" };
  const CLAMPS = { "0": 0, "2": 2, "4": 4, "8": 8 };
  const CLAMPLABEL = { "0": "off", "2": "2", "4": "4", "8": "8" };

  // SECTION ROLES. A role is a NAME, not a transform: setting a box to
  // "chorus" does not reach in and change the drums. What the role does is
  // tell the composer what to BUILD, and tell you what you are looking at
  // afterwards. (Lived in compose.js; moved here because it is vocabulary, and
  // compose re-exports it so its own API did not move.)
  const ROLES = { drums: "drums", bass: "bass", groove: "groove",
                  intro: "intro", verse: "verse", chorus: "chorus",
                  bridge: "bridge", breakdown: "breakdown", drop: "drop",
                  solo: "solo", outro: "outro" };

  /* ---------- THE REGISTRY ---------- */
  // One entry per control. Shape:
  //   key     the field name on the box (and, for scope "layer", on a stack
  //           entry — a layer field left unset INHERITS the box's)
  //   scope   "box" | "layer". The split is the rule stacking was built on: the
  //           authority owns everything that must be shared for the box to be
  //           one piece of music — the grid, the groove, the key centre, the
  //           section envelope — and everything else is per layer.
  //   type    "enum" (default) — one key of `table` or null
  //           "list"           — an ordered array of `table` keys, FILTERED on
  //                              load rather than rejected (see song.js)
  //           "vox"            — one knob of the VOX object, inherits knob-by-knob
  //           "int"            — a number clamped into [min, max]
  //   table   value -> engine value       labels  value -> UI text
  //   tab     which palette page          group   the row title on that page
  //   default what emptyBox()/skeleton() seed (null = "as the genre asks")
  const FIELDS = [
    { key: "ops",     scope: "layer", type: "list", table: OPS, labels: OPLABEL,
      tab: "line",   group: "pattern",                 default: [] },
    { key: "role",    scope: "box",   table: ROLES,    labels: ROLES,
      tab: "sound",  group: "section",                 default: null },
    { key: "mode",    scope: "box",   table: MODES,    labels: MODELABEL,
      tab: "sound",  group: "chord mode",              default: null },
    { key: "rate",    scope: "box",   table: RATES,    labels: RATELABEL,
      tab: "sound",  group: "tempo",                   default: null },
    { key: "artic",   scope: "layer", table: ARTICS,   labels: ARTICS,
      tab: "sound",  group: "articulation",            default: null },
    { key: "oct",     scope: "layer", table: OCTAVES,  labels: OCTAVES,
      tab: "voice",  group: "register",                default: null },
    { key: "scale",   scope: "layer", table: SCALES,   labels: SCALELABEL,
      tab: "voice",  group: "alphabet",                default: null },
    { key: "cut",     scope: "layer", type: "vox", table: VOX.cut.t,  labels: VOX.cut.labels,
      tab: "voice",  group: "filter",                  default: null },
    { key: "res",     scope: "layer", type: "vox", table: VOX.res.t,  labels: VOX.res.labels,
      tab: "voice",  group: "resonance",               default: null },
    { key: "emod",    scope: "layer", type: "vox", table: VOX.emod.t, labels: VOX.emod.labels,
      tab: "voice",  group: "env mod",                 default: null },
    { key: "dec",     scope: "layer", type: "vox", table: VOX.dec.t,  labels: VOX.dec.labels,
      tab: "voice",  group: "decay",                   default: null },
    { key: "wave",    scope: "layer", type: "vox", table: VOX.wave.t, labels: VOX.wave.labels,
      tab: "voice",  group: "waveform",                default: null },
    { key: "clamp",   scope: "layer", table: CLAMPS,   labels: CLAMPLABEL,
      tab: "voice",  group: "ramp limit",              default: null },
    { key: "cmode",   scope: "layer", table: CMODES,   labels: CMODES,
      tab: "voice",  group: "at the limit",            default: null },
    { key: "kit",     scope: "box",   table: KITLABEL, labels: KITLABEL,
      tab: "rhythm", group: "drum pattern",            default: null },
    { key: "drumkit", scope: "box",   table: DRUMKITS, labels: DRUMKITS,
      tab: "rhythm", group: "drum sound",              default: null },
    { key: "bassop",  scope: "box",   table: BASSOPS,  labels: BASSOPS,
      tab: "rhythm", group: "bass",                    default: null },
    { key: "swing",   scope: "box",   table: SWINGS,   labels: SWINGLABEL,
      tab: "rhythm", group: "swing",                   default: null },
    { key: "groove",  scope: "box",   table: GROOVELABEL, labels: GROOVELABEL,
      tab: "rhythm", group: "groove",                  default: null },
    { key: "fx",      scope: "box",   type: "list", table: FX, labels: FXLABEL,
      tab: "fx",     group: "effects", max: MAX_FX,    default: [] },
    { key: "rev",     scope: "box",   table: SENDS,    labels: SENDLABEL,
      tab: "fx",     group: "reverb",                  default: null },
    { key: "verb",    scope: "box",   table: VERBS,    labels: VERBS,
      tab: "fx",     group: "space",                   default: null },
    // `echo` was persisted as `del` through v:1 — a name shared with both the
    // kernel's delete operator and the delay send it fed, which is exactly the
    // kind of pun that survives until a grep goes wrong. song.js migrates.
    { key: "echo",    scope: "box",   table: SENDS,    labels: SENDLABEL,
      tab: "fx",     group: "echo",                    default: null },
    { key: "dtime",   scope: "box",   table: DTIMES,   labels: DTLABEL,
      tab: "fx",     group: "echo time",               default: null },
    { key: "lvl",     scope: "box",   table: LEVELS,   labels: LEVELLABEL,
      tab: "fx",     group: "level",                   default: null },
    { key: "pan",     scope: "box",   table: PANS,     labels: PANLABEL,
      tab: "fx",     group: "place",                   default: null },
    { key: "intro",   scope: "box",   table: INLABEL,  labels: INLABEL,
      tab: "move",   group: "intro",                   default: null },
    { key: "outro",   scope: "box",   table: OUTLABEL, labels: OUTLABEL,
      tab: "move",   group: "outro",                   default: null },
    { key: "env",     scope: "box",   table: ENVLABEL, labels: ENVLABEL,
      tab: "move",   group: "level over the section",  default: null },
    { key: "mot",     scope: "box",   table: MOTLABEL, labels: MOTLABEL,
      tab: "move",   group: "filter over the section", default: null },
    // the window onto the genre's form — numeric, clamped rather than rejected
    { key: "len",     scope: "box",   type: "int", min: 1, max: MAX_LEN,
      tab: "song",   group: "length",                  default: 4 },
    { key: "nudge",   scope: "box",   type: "int", min: 0, max: MAX_NUDGE,
      tab: "song",   group: "nudge",                   default: 0 },
  ];
  const FIELD = {};
  for (const f of FIELDS) FIELD[f.key] = f;

  const api = { NSLOTS, MAX_LEN, MAX_NUDGE, MAX_FX,
                OPS, OPLABEL, ENVLABEL, MOTLABEL, INLABEL, OUTLABEL,
                RATES, RATELABEL, SWINGS, SWINGLABEL, GROOVELABEL,
                KITLABEL, DRUMKITS, BASSOPS,
                FX, FXLABEL, fxChain, SENDS, SENDLABEL, VERBS,
                DTIMES, DTLABEL, LEVELS, LEVELLABEL, PANS, PANLABEL,
                VOX, VOXPARAM, OCTAVES, ARTICS, CMODES, CLAMPS, CLAMPLABEL,
                ROLES, FIELDS, FIELD };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuFields = api;
})(typeof window !== "undefined" ? window : globalThis);
