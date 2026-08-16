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
  // sing.js is DATA for this registry the way genres.js is: the four chips a
  // box may be told to sing are vocabulary, and vocabulary lives here. The
  // dependency is one-way — sing.js imports genres.js and nothing else, so it
  // sits below this file and cannot reach back for a label.
  const NS = (typeof module !== "undefined" && module.exports)
    ? require("./sing.js") : root.NuSing;
  const { reverse, invert, rotate, fill, spread, split, del, drop,
          transpose, complement, crossmap, excerpt, only, KITOPS, LANES } = K;
  const { MODES, MODELABEL, SCALES, SCALELABEL } = NG;
  const { SINGS, SINGLABEL } = NS;

  // ---- limits --------------------------------------------------------------
  // The numeric fences persistence and the grips both enforce. They live here
  // rather than in the UI file because a hand-edited save has to hit the same
  // wall a drag does: a len of 1e9 used to sail through the loader and render
  // a billion bars.
  //
  // NSLOTS is the phrase bank's CEILING, not its size. The bank is variable
  // now — a song carries 1..NSLOTS phrases, a fresh page carries ONE, and the
  // [+] key on the rail grows it — so every consumer of this number is asking
  // "how big may a bank get", never "how big is this one" (that is
  // slots.length, on the song itself).
  const NSLOTS = 16, MAX_LEN = 64, MAX_NUDGE = 31, MAX_FX = 3;

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
  // TWO FAMILIES INSIDE ONE FIELD, and the field is right to hold both: they
  // are the same question ("level over the section") with two kinds of answer.
  // The first four are FADES — they touch zero, they are how a section arrives
  // or leaves. The six after are DYNAMICS — they never touch zero, they say how
  // big this section is against the one before it, and until they existed a
  // composed song was a fade in, eight flat sections and a fade out. `soft` and
  // `big` are constants on purpose: how loud a section is has a flat answer more
  // often than it has a curve, and a constant is a curve. (kernel.js SHAPES
  // carries the numbers and the argument for keeping them in `env` rather than
  // in a second box field.) Appended, never reordered — a saved song names
  // these by key.
  const ENVLABEL = { in: "fade in", out: "fade out", swell: "swell",
                     duck: "duck", drop: "drop", stutter: "stutter",
                     cresc: "crescendo", dim: "diminuendo", arch: "arch",
                     lift: "build", soft: "quieter", big: "bigger" };
  const MOTLABEL = { open: "filter open", close: "filter close",
                     rise: "riser", pump: "pump" };
  // INTRO / OUTRO — the two bars that are not like the others (kernel.js
  // `edges`). These are the ones that actually announce a section, because they
  // are the only transforms allowed to write events that were not there: a drum
  // fill is a different bar, not a louder one.
  // ELEVEN WAYS IN, not five — and only four of them are drum gestures. The
  // 2026-08-14 widening ("everything opens with a drum hit… there are so many
  // different kinds of intros in the world"): cold is the NAMED absence of an
  // intro, fade is the two-bar exception to the one-bar law, and padin/bassin/
  // riser/stabs are the entrances kernel.js intro() renders from the events
  // themselves. compose.js stores whatever this table knows — its introEdge
  // bridge stops renaming the moment a label lands here.
  const INLABEL  = { count: "count-in", hit: "downbeat", solo: "melody alone",
                     kit: "drums alone", swell: "swell in", cold: "cold open",
                     fade: "fade up", padin: "pad first", bassin: "bass first",
                     riser: "riser", stabs: "stabs" };
  // TEN WAYS OUT, and the four new ones exist for the reason the six new ways
  // IN did: every composed song ended with the same accelerating snare into
  // the same cymbal, because the vocabulary had one fill in it at three
  // densities. A tom fill, a hat stutter, a bar of silence with a crash on the
  // last sixteenth and a double-time stop are four different IDEAS about
  // stopping — and compose.js deals them per genre and per seed (OUTRO_LEAN).
  const OUTLABEL = { fill: "drum fill", roll: "snare roll", crash: "crash",
                     break: "drum break", tail: "no drums", cut: "cut short",
                     tomfill: "tom fill", hatrun: "hat stutter",
                     hush: "silence, then crash", doubles: "double-time stop" };

  /* ---------- grid ---------- */
  const RATES = { half: 0.5, dbl: 2 };
  const RATELABEL = { half: "half time", dbl: "double time" };
  // SWING bends the grid — every odd sixteenth arrives late by this fraction of
  // a step. "straight" is an explicit 0: it OVERRIDES a genre's own lean, which
  // null never does (a genre's swing is identity, kernel.js reads g.swing).
  //
  // AND IT IS A SONG FACT NOW, NOT A BOX FIELD (2026-08-16, "nothing in a
  // section tells time" — the groove's move, finished). A record swings or it
  // does not; a swing that changed per section would be the drummer changing
  // hands mid-song. compose.js stamped ONE swing on every box, the same tell
  // the groove gave. So there is no `swing` entry in FIELDS below: the song
  // carries it beside bpm/groove/master/buses (ui/state.js SWING, song.js
  // validates, migrate lifts old per-box saves), and ui/derive.js reads it as
  // an argument. The tables stay HERE because they are vocabulary, and one
  // registry file owns every word.
  const SWINGS = { straight: 0, light: 0.12, swing: 0.22, shuffle: 1 / 3, hard: 0.42 };
  const SWINGLABEL = { straight: "straight", light: "light", swing: "swing",
                       shuffle: "shuffle", hard: "hard shuffle" };
  // GROOVE is the other half, and it is not the same half. Swing moves the odd
  // sixteenths and nothing else; a groove is a sixteen-slot fingerprint of BOTH
  // timing and loudness — which steps lean late, which land hard. `dub` is
  // mined rather than written (engine/pipes.js ACCENT_PROFILES, off the MIDIMAN
  // dub rip).
  //
  // AND IT IS A SONG FACT, NOT A BOX FIELD (2026-08-16, "the groove belongs to
  // the song"). A groove that changed per section would not be a groove, it
  // would be several drummers — compose.js already stamped ONE groove on every
  // box for exactly that reason, which was the tell. So there is no `groove`
  // entry in FIELDS below: the song carries it beside bpm/master/buses
  // (ui/state.js GROOVE, song.js validates, migrate lifts old per-box saves),
  // and ui/derive.js reads it as an argument. The label table stays HERE
  // because it is vocabulary, and one registry file owns every word.
  const GROOVELABEL = { backbeat: "backbeat", push: "pushed", laidback: "laid back",
                        funk: "funk", dub: "dub" };
  // EVERY KIT OPERATOR kernel.js has — which is now sixty-eight rather than
  // thirteen, because the kit grew from six lanes to twelve and a vocabulary
  // that cannot say "ride instead of hats" or "tom fill" is not a vocabulary.
  //
  // THE TABLE IS DERIVED, NOT COPIED. The old literal was a second list of the
  // kernel's own keys, and a second list is a list that goes stale — an
  // operator with no entry here is invisible to the palette and an entry with
  // no operator is a chip that does nothing. So KITLABEL is built from
  // Object.keys(KITOPS): a hand-written phrase for each named idea, and for
  // the generated per-lane family (`h.dbl`, `k.rot`, …) a label composed from
  // the kernel's own LANES name plus the verb. Nothing falls through — the
  // unit gate fails on any operator whose label is still its key.
  const KITNAME = {
    nodrums: "none", nokick: "no kick", nohats: "no hats",
    snareonly: "snare only", shift: "shift", halftime: "half time",
    doubletime: "double time", busy: "busy hats", sparse: "sparse",
    four: "four on the floor", offbeat: "offbeat hats",
    swap: "swap kick/snare", roll: "roll",
    // the hand and the metal
    ride: "ride, not hats", tomtime: "floor tom pulse", pedal: "pedal hat",
    opens: "open on the and", shuffle: "shuffle hats",
    crash: "crash on one", crashback: "crash on the backbeat",
    // the snare hand
    backbeat: "backbeat", onthree: "snare on 3", stickside: "cross-stick",
    claps: "claps with the snare", ghosts: "ghost snares",
    flams: "flams", drags: "drags",
    // the kick foot and the toms
    kickdoubles: "kick doubles", tomfill: "tom fill", tomrun: "tom groove",
    tomroll: "tom roll",
    // density, dynamics, the hand
    linear: "linear (one limb a tick)", accents: "accents", crescendo: "crescendo",
    soft: "soft", loud: "loud", humanize: "humanize", tight: "machine tight",
    maybe: "sometimes", chaos: "dice",
    // the named patterns
    disco: "disco", stomp: "stomp", tresillo: "3-3-2", clave: "clave",
    amen: "amen break", motorik: "motorik", blast: "blast beat",
  };
  const VERBLABEL = { rot: "rotate", thin: "thin", dens: "fill in",
                      half: "half time", dbl: "double time", roll: "roll",
                      disp: "lay back" };
  const KITLABEL = {};
  for (const key of Object.keys(KITOPS)) {
    const [lane, verb] = key.split(".");
    KITLABEL[key] = KITNAME[key]
      || (LANES[lane] && VERBLABEL[verb] ? LANES[lane].name + " " + VERBLABEL[verb] : key);
  }
  // WHICH LANE IS WHICH, for anything that has to name one. The kernel owns
  // the letters; this is the registry's copy of the NAME, so a view never has
  // to reach above this file for a word (the layer law at the top).
  const DRUMLANES = {};
  for (const [d, L] of Object.entries(LANES)) DRUMLANES[d] = L.name;
  // WHICH KIT — the first six are SAMPLED (found/samples/drums/<kit>/, the same
  // extraction the big engine plays); the four after are the CLASSIC MACHINES,
  // synthesized deterministically into the same buffers by audio/machines.js —
  // downstream of loadKit the two kinds are indistinguishable. A genre names
  // one; a box may borrow another, which is the difference between playing a
  // beat and playing it on somebody else's drums. An id added here must have a
  // recipe in audio/machines.js or a directory on disk — the browser gate
  // (nukernel-drums (M)) renders every machine lane and holds the two lists
  // together.
  const DRUMKITS = { acoustic: "acoustic", brush: "brushes", electronic: "electronic",
                     jazz: "jazz", power: "power", room: "room",
                     tr808: "TR-808", tr909: "TR-909", tr606: "TR-606",
                     cr78: "CR-78" };
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
    // EDGE, not a second amp. Every genre that reaches for crunch already
    // plays a PRE-DISTORTED sample (distortion/overdrive guitar) — the fuzz
    // is baked into the recording, and a two-stage high-gain sim on top of it
    // re-fried the fry into mush ("WAYYYY TOO MUCH", the artist, 2026-08-14).
    // One stage, low drive, half mix: grit that thickens what the sample
    // already is instead of replacing it.
    crunch:   { label: "crunch",     type: "higain",
                params: { drive: 0.35, stages: 1, gate: 0.2, low: 0.55, mid: 0.4,
                          high: 0.5, presence: 0.5, level: 0.6, mix: 0.55 } },
  };
  const FXLABEL = {};
  for (const k of Object.keys(FX)) FXLABEL[k] = FX[k].label;
  // the {type, params} list buildInsertNodes wants, from the box's chip keys
  const fxChain = keys => (keys || []).filter(k => FX[k])
    .map(k => ({ type: FX[k].type || k, params: { ...FX[k].params } }));

  /* ---------- A CHIP IS A SEND; A CHAIN IS AN INSERT ---------- */
  // "Maybe we need a few effects buses feeding into one master effects bus
  // instead of everything having its own effects" — the artist, hearing the
  // page glitch, 2026-08-15. He is describing AUX SENDS, which is what the big
  // engine has always had: engine/faust/press/render-core.js renders every unit
  // into FOUR shared buses (`{ dry, rev, del, pp }`, line 19) with a gain
  // apiece, and engine/faust/live/live.js gives the whole found layer ONE
  // submix and one reverb (`foundDests`, line 636) rather than a rack per
  // voice. nukernel had grown the opposite way: an insert chain per box AND per
  // part, each a private copy of the same effect.
  //
  // The refactor is EXACT rather than approximate, and this table is why.
  // Read sampler.js buildInsertNodes: every effect but one is built as
  // `parallel(mix, wet)` — a dry/wet CROSSFADE around a wet function of the
  // same input. So
  //     insert:  (1-m)·x + m·w(x)
  //     send:    (1-m)·x  ->  master        [the dry trim]
  //              m·x      ->  w() at mix 1  ->  master
  // are the same signal, sample for sample, for ANY w. The send just spends one
  // copy of w() for the whole page instead of one per box.
  //
  // TWO THINGS CANNOT BE SAID THAT WAY, and they are the private-insert budget:
  //   `sweep` (filtersweep) has NO mix param — buildInsertNodes chains it
  //     serially, in the signal path, because a swept resonant lowpass is a
  //     REPLACEMENT and not a blend. A parallel copy of it is a different,
  //     nicer, wrong sound.
  //   A CHAIN OF TWO OR MORE CHIPS means ORDERING — chorus on a crunched guitar
  //     is not a clean chorus beside a crunched guitar — and a parallel bank
  //     has no ordering to offer. Measured on the shipped genre table, 12 of
  //     the 14 fx declarations are a single chip; the two that are not
  //     (`["crunch","chorus"]`, `["echo","sweep"]`) keep their rack.
  const FXSEND = {};
  for (const k of Object.keys(FX)) FXSEND[k] = (FX[k].type || k) !== "filtersweep";
  // how much of the chip a send carries — its OWN declared mix, so a chorus is
  // as wet on the bus as it was in the rack. An effect with no mix (only sweep,
  // which is never sendable) reads as fully wet.
  const fxMix = k => (FX[k] && FX[k].params && FX[k].params.mix != null)
    ? FX[k].params.mix : 1;
  // the one predicate the mixer asks: may this whole chain be spent as sends?
  const fxSendable = keys => (keys || []).length === 1 && !!FXSEND[keys[0]];

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

  /* ---------- the composition-depth surface ---------- */
  // The P2b round put progression/period/rest/pipes/parts/key in the ALGEBRA;
  // these tables give them to the FINGERS. Every one follows the house law:
  // default null = "as the genre asks", and a null field must render
  // byte-identically to an absent one (the §33 unit gate holds it).
  //
  // KEY — a semitone shift on the whole box, applied in the kernel AFTER
  // registration so the fold cannot eat it. The set is deliberately small: a
  // minor third down through a major third up covers the truck-driver +2 and
  // the relative-major +3 without offering the tritone nobody wants as a chip.
  const KEYS = { "-3": -3, "-2": -2, "-1": -1, "1": 1, "2": 2, "3": 3, "4": 4 };
  const KEYLABEL = { "-3": "−3", "-2": "−2", "-1": "−1",
                     "1": "+1", "2": "+2", "3": "+3", "4": "+4" };

  // PROG — the named progressions from genres.js, by name, plus "off" (strip
  // the genre's own prog and fall back to the degenerate triads). The names
  // are data the composer already writes; this row is the same vocabulary
  // under a finger.
  const PROGCHOICES = { off: "off" };
  const PROGLABEL = { off: "plain triads", blues12: "blues 12-bar",
                      soul7: "soul 7ths", jack7: "new jack",
                      beatlesV: "beatles verse", beatlesC: "beatles chorus" };
  for (const k of Object.keys(NG.PROGS)) {
    PROGCHOICES[k] = k;
    if (PROGLABEL[k] == null) PROGLABEL[k] = k;
  }

  // PERIOD — sentence presets that map to the kernel's bar schedule
  // (`g.period`, the sixth type). Entries are op-key LISTS in the palette's
  // own alphabet, so a preset is data all the way down. "1bar" is an explicit
  // "every bar the same": it strips a genre's own sentence, which null (the
  // default) deliberately does not.
  const PERIODS = {
    "1bar": [],                                  // flat: every bar restates
    "2bar": [[], ["rot2"]],                      // antecedent/consequent sway
    "4bar": [[], [], ["dens3"], []],             // the lift on bar 3
  };
  const PERIODLABEL = { "1bar": "every bar", "2bar": "two-bar sway",
                        "4bar": "four-bar lift" };

  // BREATH — the kernel's maxHold as words. "none" is an explicit 0 (uncap:
  // even a part policy's own hold comes off), which is different from null.
  const BREATHS = { none: 0, "4": 4, "3": 3, "2": 2 };
  const BREATHLABEL = { none: "unbroken", "4": "long", "3": "breathing",
                        "2": "clipped" };

  // PIPE — one chip arms one pipe set on the rendered stream (the seventh
  // type). Single-choice on purpose: pipes compose, but a chip row that lets
  // you stack all five is a texture, not a decision.
  const PIPESETS = {
    off: [],                                     // strip the genre's own pipes
    "3rds": [{ id: "harmonize", p: 0.6 }],
    "6ths": [{ id: "harmonize", p: 0.6, gap: "sixth" }],
    echo: [{ id: "echoCanon", delay: 3 }],
    strum: [{ id: "strum", spread: 0.06 }],
    breathe: [{ id: "breathe" }],
  };
  const PIPELABEL = { off: "off", "3rds": "thirds", "6ths": "sixths",
                      echo: "echo canon", strum: "strum", breathe: "breathe" };

  // PART — a per-layer role assignment (kernel PARTS). "auto" means the
  // genre's own per-voice scheme; anything else makes every voice of that
  // layer the named part.
  const PARTCHOICES = { auto: "auto", lead: "lead", riff: "riff",
                        counter: "counter", pad: "pad", stab: "stab",
                        drone: "drone" };

  /* ---------- THE STRIP EQ ---------- */
  // "Every strip earns its tone." Three fixed bands on every channel strip —
  // an SSL-style corrective EQ, not a parametric: the FREQUENCIES are the
  // desk's, silkscreened once here, and the knob only turns GAIN. Fixed points
  // chosen around this page's own spectrum: the low shelf under the bass's
  // fundamental register, the bell at the 1 kHz presence band (well clear of
  // the mixer's 450 Hz mud carve), the high shelf below the master's
  // unconditional 16 kHz ceiling so it dims air the ceiling still passes.
  //
  // ONE BAND LIST, three readers: the board draws a knob per entry, song.js
  // validates a save's band keys against it, and audio builds one biquad per
  // entry (graph.js buildEq) — `type`/`freq`/`q` go straight onto the node, so
  // a band added here is a knob, a field and a filter with no second table.
  const EQ_BANDS = [
    { key: "lo",  label: "lo",  type: "lowshelf",  freq: 120 },
    { key: "mid", label: "mid", type: "peaking",   freq: 1000, q: 0.9 },
    { key: "hi",  label: "hi",  type: "highshelf", freq: 7200 },
  ];
  // the RETURNS get the simpler pair: a bus is a treatment already, and what a
  // return needs is "darker / brighter", never a presence bell. Same objects,
  // deliberately — a bus's `lo` is the strip's `lo`, one frequency per word.
  const BUS_EQ_BANDS = [EQ_BANDS[0], EQ_BANDS[2]];
  // the fader's own numeric policy at the EQ's own range: finite clamps to
  // ±12 dB at 0.1 dB (no float noise in a save), garbage resolves to 0 — and
  // 0 is FLAT, which normalizes away, so absent stays the one spelling of it
  const EQ_RANGE = 12;
  const eqDb = v => Number.isFinite(v)
    ? Math.max(-EQ_RANGE, Math.min(EQ_RANGE, Math.round(v * 10) / 10)) : 0;
  // ONE SPEC -> BUILDER VALUES, resolvePartMix's law: null when the strip is
  // FLAT — every band 0, unknown, or absent — which is the builder's
  // instruction to build ZERO BiquadFilter nodes (a song that never touched
  // the EQ produces a byte-identical graph). Non-flat resolves EVERY band of
  // the list (0 for the untouched ones), so the built chain's params are total.
  function resolveEq(e, bands) {
    const B = bands || EQ_BANDS;
    const g = e && typeof e === "object" ? e : {};
    const out = {};
    let any = false;
    for (const b of B) { const v = eqDb(g[b.key]); out[b.key] = v; if (v) any = true; }
    return any ? out : null;
  }
  const eqIsFlat = (e, bands) => resolveEq(e, bands) == null;

  /* ---------- THE PER-PART MIX ---------- */
  // "Not every track should go through the effects." Until now fx/rev/echo/
  // lvl/pan lived on the BOX, so one insert chain treated every voice in the
  // section at once: crunch on a box crunched the pad and the drums with the
  // guitar, and the only way to hear an effect on one thing was to give that
  // thing a box of its own. That is not a mixer, it is a master fader.
  //
  // A PART IS THE ADDRESS. The kernel already assigns every voice a role
  // (kernel.js PARTS — lead/riff/counter/pad/stab/drone, plus `line`, the
  // shim every genre without a `part` scheme gets), and the box already has a
  // bass and a kit. Those nine names ARE the track list: they are what the
  // music is made of, they are stable across a genre change, and they are
  // already the word the palette uses for the part chip. Nothing new had to
  // be invented — the roles were there, they just had nowhere to plug in.
  const PARTNAMES = { line: "line", lead: "lead", riff: "riff",
                      counter: "counter", pad: "pad", stab: "stab",
                      drone: "drone", bass: "bass", drums: "drums" };
  const PARTLABEL = { line: "line", lead: "lead", riff: "riff",
                      counter: "counter", pad: "pad", stab: "stab",
                      drone: "drone", bass: "bass", drums: "drums" };
  // …AND A CHAIR WHEN THERE ARE SEVERAL OF ONE. Post rock is a pad and two
  // clean guitars; rock is two crunch guitars. Both would collapse onto one
  // address if the role were the whole key, so the second voice of a role is
  // `line2`, the third `line3`. The FIRST keeps the bare name, which is what
  // makes the common case (one lead, one pad) read as words rather than as
  // indices — and what makes a one-voice genre's address survive a stack.
  const MAX_CHAIRS = 12;                          // eight-voice pool, four of slack
  // key -> {base, n}, or null when the string is not an address at all
  function readPartKey(k) {
    const m = /^([a-z]+?)(\d+)?$/.exec(String(k == null ? "" : k));
    if (!m || !PARTNAMES[m[1]]) return null;
    if (m[2] == null) return { base: m[1], n: 1 };
    const n = +m[2];
    return n >= 2 && n <= MAX_CHAIRS ? { base: m[1], n } : null;
  }
  const okPartKey = k => readPartKey(k) != null;
  const partChairLabel = k => {
    const p = readPartKey(k);
    return p ? (p.n > 1 ? PARTLABEL[p.base] + " " + p.n : PARTLABEL[p.base]) : String(k);
  };
  // an ORDERED list of role names (one per voice, in voice order across the
  // whole stack) -> the chair key each voice answers to. Beyond MAX_CHAIRS the
  // keys clamp and two voices share an address: twelve chairs is already four
  // more than the synth pool's depth, and a shared bus is a better failure
  // than an unaddressable one.
  function chairKeys(parts) {
    const seen = Object.create(null);
    return (parts || []).map(p => {
      const b = PARTNAMES[p] ? p : "line";
      const n = Math.min(MAX_CHAIRS, seen[b] = (seen[b] || 0) + 1);
      return n > 1 ? b + n : b;
    });
  }
  // WHAT ONE PART MAY BE TOLD, and it is deliberately the box's own vocabulary
  // narrowed rather than a second one: the same FX chips under the same
  // MAX_FX, the same discrete sends, the same four levels and five places.
  // A mixer whose channel strip speaks a different language from the master
  // strip is two things to learn.
  //
  // mute/solo are the two that are NOT enums, because they are not choices
  // between values — they are the desk's own pair, and solo is the one control
  // here that reaches OTHER parts (audio/mixer.js partSpecs: any solo in the
  // box mutes every part that is not soloed).
  const PARTMIX = [
    { key: "fx",   type: "list", table: FX,     labels: FXLABEL,   max: MAX_FX, default: [] },
    { key: "rev",  table: SENDS,  labels: SENDLABEL,  default: null },
    { key: "echo", table: SENDS,  labels: SENDLABEL,  default: null },
    { key: "lvl",  table: LEVELS, labels: LEVELLABEL, default: null },
    { key: "pan",  table: PANS,   labels: PANLABEL,   default: null },
    { key: "mute", type: "flag",  default: false },
    { key: "solo", type: "flag",  default: false },
    // THE FADER OFFSET, in dB, and it is an OFFSET rather than a level: the
    // board's fader rides ON TOP of the automated/derived value (`lvl` above,
    // the composer's arc, a level automation), multiplying it, never replacing
    // it — a user touch must not fight the automation. Numeric because a
    // long-throw fader is not a detented list; clamped ±24/12 and kept at
    // 0.1 dB so the save never carries float noise. Absent = 0 dB = today.
    { key: "fader", type: "num", min: -24, max: 12, default: null },
    // THE STRIP EQ (EQ_BANDS above): a band -> dB map, absolute rather than
    // automated — tone is set and left, so there is no offset dance and no
    // per-frame follower. Flat (every band 0) normalizes to absent, and absent
    // builds zero filter nodes (resolveEq's law).
    { key: "eq", type: "eq", bands: EQ_BANDS, default: null },
  ];
  const PARTMIXBY = {};
  for (const f of PARTMIX) PARTMIXBY[f.key] = f;
  // ONE ENTRY -> ENGINE VALUES, defaults included. It lives here and not in the
  // mixer for the reason the rest of this file exists: the palette that writes
  // an entry and the graph that builds it from must read the same table, or
  // "touch" means 0.12 in one place and 0.15 in the other.
  //
  // NOTE THE ASYMMETRY, on purpose: the SECTION's reverb default is the genre's
  // own tone.verb, because a genre that asks to be wet means it. A PART's
  // default is 0 — the part send is what this chair asks for ON TOP of the
  // section, so absent must mean "adds nothing".
  // a stored dB offset -> the number a builder may trust: finite, clamped to
  // the registry row's own range, 0.1 dB. One function because the loader that
  // accepts a fader and the mixer that applies one must agree on the clamp.
  const faderDb = v => Number.isFinite(v)
    ? Math.max(-24, Math.min(12, Math.round(v * 10) / 10)) : 0;
  function resolvePartMix(e) {
    const g = e && typeof e === "object" ? e : {};
    const pick = (tbl, v, dflt) =>
      (v != null && Object.prototype.hasOwnProperty.call(tbl, String(v))) ? tbl[v] : dflt;
    return {
      fx: (g.fx || []).filter(k => Object.prototype.hasOwnProperty.call(FX, k)).slice(0, MAX_FX),
      rev: pick(SENDS, g.rev, 0),
      del: pick(SENDS, g.echo, 0),      // the field is `echo`, the bus is `del`
      lvl: pick(LEVELS, g.lvl, 1),
      pan: pick(PANS, g.pan, 0),
      mute: !!g.mute,
      solo: !!g.solo,
      fader: faderDb(g.fader),          // dB offset OVER lvl; 0 when unset
      eq: resolveEq(g.eq),              // null = flat = build no filter at all
    };
  }

  /* ---------- THE MASTER BUS: the globals ---------- */
  // The OTHER end of the desk. A box is a channel and `parts` is the desk under
  // it; everything below is the bus all of it lands on — one chain for the whole
  // song, so a global is a SESSION control and lives with the soundfont and the
  // file keys rather than on any box.
  //
  // NOTHING HERE IS INVENTED. Every value is the parent's own master section,
  // engine/faust/dsp/fx_bus.dsp `master()` — "the WHOLE csd-engine.js master
  // section in one stereo module" — read in its own order (transport wobble →
  // grit → comp → makeup → tone tilt → tape saturation → clip), plus the two
  // things live.js adds on top of it (the glue/makeup/brickwall bus and the
  // MASTER TOP ceiling, both already in audio/graph.js buildMasterChain). What
  // this file does is give those numbers NAMES a finger can choose between.
  //
  // ABSENT IS TODAY, the same law `parts` carries: a song with no `master`
  // resolves to exactly the chain graph.js has always built — glue at −22/2.2,
  // makeup ×1.4, the brickwall at −1.5, the 16 kHz ceiling — and builds not one
  // extra node. That is why there is no "off"/"flat"/"normal" entry in any table
  // below: every surface on this machine already has a way to say "back to the
  // default" — a chip toggles off (ui/mixtbl.js), the session bank's pickers
  // carry an empty "—" (ui/chrome.js) — so an explicit off/flat/normal would be
  // a SECOND spelling of absent, and two spellings of a default is exactly what
  // song.js and audio/graph.js both spend a branch normalizing away.

  // DRIVE — fx_bus `grit`: tanh drive with a level compensation and a mix that
  // reaches 1 by grit=0.125, so the low settings are genuinely a hair of it.
  const DRIVES = { hair: 0.12, warm: 0.28, dirt: 0.5, crush: 0.8 };
  const DRIVELABEL = { hair: "a hair", warm: "warm", dirt: "dirt", crush: "crush" };

  // GLUE — the bus compressor that is ALREADY THERE. graph.js has run live.js's
  // glue comp → makeup since the day the sampled voices turned out to play at
  // −22 dBFS; what it never had was a character. `glue` is that chain's own
  // numbers under a name, so choosing it explicitly is a no-op, and the other
  // four walk the same two nodes from a slower, gentler ride to a pumped one.
  // No new node is built for any of them: this is a param write.
  // MAKEUPS RESTAGED 2026-08-16, measured rather than felt. At makeup 2.2 a
  // composed song rendered at −6 to −7 dBFS RMS with its peaks PINNED on the
  // brickwall (beatles peak −1.53 dBFS == the limiter threshold; rock 1.10,
  // OVER full scale through the safety shaper's oversampling overshoot, which
  // the 16-bit encode then hard-clips — the "hot and distorted" report, as
  // numbers). The whole table is scaled by one factor so the characters keep
  // their relative loudness; the default now leaves the limiter with ~0
  // reduction at default settings (beatles peak −3.5 dBFS after), so the
  // brickwall is a net again instead of the sound.
  const GLUES = {
    soft:   { thr: -18, knee: 30, ratio: 1.6, atk: 0.030, rel: 0.35, makeup: 1.2 },
    glue:   { thr: -22, knee: 28, ratio: 2.2, atk: 0.015, rel: 0.25, makeup: 1.4 },
    tight:  { thr: -26, knee: 18, ratio: 3.2, atk: 0.006, rel: 0.18, makeup: 1.7 },
    pump:   { thr: -30, knee: 8,  ratio: 6,   atk: 0.002, rel: 0.09, makeup: 1.9 },
    squash: { thr: -34, knee: 4,  ratio: 12,  atk: 0.001, rel: 0.06, makeup: 2.2 },
  };
  const GLUEDFLT = GLUES.glue;             // == what graph.js builds with no master
  const GLUELABEL = { soft: "soft", glue: "glue", tight: "tight",
                      pump: "pump", squash: "squash" };

  // TAPE — fx_bus's `wob` + `tsat` as ONE machine, because they are one machine:
  // a transport that drifts and a head that saturates. wob is wow (~0.6 Hz) plus
  // flutter (~6 Hz) modulating a 1.6 ms fractional delay per channel, at
  // different rates L and R so the drift decorrelates into width; tsat is the
  // level-preserving soft knee, exactly graph.js satCurve(1 + 1.8·sat, 1).
  //
  // fx_bus DEFAULTS wob TO 0 and says why: it is instantiated fresh at every
  // stream open, so on a travelling path the LFO restarted at phase 0 while the
  // outgoing stream sat elsewhere in its cycle and the master delay time jumped
  // at every crossfade. There is no travelling path here — one chain per context,
  // rebuilt only when a chip moves — so the wobble is offered. (The offline
  // bounce runs its own instance at its own phase; a ±0.1% pitch drift between
  // the carrier and the live graph is inside the perceptual-twin class the
  // bounce already lives in, and the loop fold crosses the LFO the same way it
  // crosses a reverb tail.)
  const TAPES = { warm: { wob: 0,    sat: 0.18 },
                  tape: { wob: 0.35, sat: 0.30 },
                  worn: { wob: 0.7,  sat: 0.45 },
                  wow:  { wob: 1,    sat: 0.60 } };
  const TAPELABEL = { warm: "warm head", tape: "tape", worn: "worn", wow: "wow & flutter" };

  // SPACE — fx_bus `mrev`, "a little of the DRY mix into the reverb so the WHOLE
  // mix shares one room (the per-voice sends are untouched — this is the global
  // bleed)". That is exactly what makes it different from a section's rev chip:
  // a send is a decision about ONE section, this is the room they are all in.
  //
  // The room itself is live.js's vapor wash (pre-delay + three damped combs),
  // NOT a convolver, for graph.js buildRoomBus's stated reason: the audio gate
  // holds the page to two convolution reverbs and they are the most expensive
  // node here. `size` scales the comb times; `mix` is the bleed off the dry sum.
  const SPACES = { touch:  { mix: 0.07, size: 0.55 },
                   room:   { mix: 0.13, size: 0.8 },
                   hall:   { mix: 0.20, size: 1.2 },
                   cavern: { mix: 0.30, size: 1.8 } };
  const SPACELABEL = { touch: "a touch", room: "room", hall: "hall", cavern: "cavern" };

  // WIDTH — the one control here with no parent to borrow from, because the
  // parent gets its width from placement (MASTER_PAN) and from the tape's own
  // decorrelation. A mid/side trim is the master-bus answer to the same
  // question, and it is gains and a splitter: side ×0 is mono, ×2.2 is as wide
  // as a two-voice box can be pushed before the centre hollows out.
  const WIDTHS = { mono: 0, narrow: 0.5, wide: 1.5, huge: 2.2 };
  const WIDTHLABEL = { mono: "mono", narrow: "narrow", wide: "wide", huge: "huge" };

  // TILT — fx_bus's tone stage as one knob. A SHELF PAIR, not a filter pair:
  // the parent's own note on MASTER_AIR_SHELF_DB is that a shelf "dims the air
  // instead of stopping it", and the thing that stops it (the 16 kHz MASTER TOP
  // lowpass) is already unconditional in graph.js. Value is the tilt in dB —
  // the low shelf takes −t and the high shelf +t, so one number rocks the
  // spectrum about its middle.
  const TILTS = { dark: -4, warm: -2, clear: 2, bright: 4 };
  const TILTLABEL = { dark: "dark", warm: "warm", clear: "clear", bright: "bright" };

  // CEILING — how hard the end of the chain works. `open` is graph.js's
  // brickwall exactly as it stands (−1.5 dB, no clip stage). The other three add
  // fx_bus's `clip`: the Bram de Jong soft clip at 0.95 the csound renders
  // ended on, which is a knee rather than a wall — and `push` is a gain INTO the
  // limiter, which is the honest way to say "louder" without pretending the
  // makeup (glue's, above) is doing it.
  const CEILINGS = { open:   { thr: -1.5, push: 1,   clip: 0 },
                     safe:   { thr: -2.5, push: 1,   clip: 0.95 },
                     loud:   { thr: -3,   push: 1.7, clip: 0.95 },
                     louder: { thr: -3,   push: 2.6, clip: 0.95 } };
  const CEILDFLT = CEILINGS.open;          // == what graph.js builds with no master
  const CEILINGLABEL = { open: "open", safe: "safe", loud: "loud", louder: "louder" };

  /* ---------- THE SHARED BUSES: the rack's own knobs ---------- */
  // The three send returns graph.js builds for every song — reverb, echo, drum
  // room — plus the echo's two internal numbers, as detented knobs on the MIX
  // page's effects rack. Same law as MASTER below: ABSENT IS TODAY. A song with
  // no `buses` gets the graph exactly as built — the reverb returns at
  // VERBSPEC's own levels, the room at its 0.9, the echo at fb 0.42 into a
  // 2800 Hz tone — so there is no "normal" entry in any table here; the empty
  // detent is the only spelling of the default, and clearing every knob must
  // restore the shipped graph node for node (the master-bus law, one bus down).
  //
  // `ret` is a MULTIPLIER on the return the graph already builds, not a level
  // of its own: each bus's base return is a tuned number (VERBSPEC per verb,
  // the room's 0.9) and a knob that replaced it would need one table per verb.
  const BUSRETS = { down: 0.5, dim: 0.75, up: 1.3, hot: 1.6 };
  const BUSRETLABEL = { down: "down", dim: "dim", up: "up", hot: "hot" };
  // the echo's feedback (base 0.42) and tone lowpass (base 2800 Hz) —
  // buildEchoBus's own constants, offered a step either side of themselves
  const EFBS = { less: 0.22, more: 0.62 };
  const EFBLABEL = { less: "fewer", more: "more" };
  const ETONES = { dark: 1400, bright: 5600 };
  const ETONELABEL = { dark: "dark", bright: "bright" };
  // one row per shared bus, each row listing its rack knobs — the registry the
  // board and the rack draw from, so no surface carries a hand-written label
  // table (the FIELDS law, extended to the rack)
  // …and each return carries the SIMPLER EQ PAIR (`eq`, BUS_EQ_BANDS above):
  // stored as `buses.<bus>.eq = { lo, hi }` in dB beside the knobs, drawn on
  // the bus STRIP rather than in the rack row, and — the same law as a part's
  // — flat builds not one filter node on the return.
  const BUSES = [
    { bus: "rev",  label: "reverb", feed: "fed by the reverb sends", eq: BUS_EQ_BANDS,
      knobs: [
        { key: "ret",  label: "return", table: BUSRETS, labels: BUSRETLABEL, default: null } ] },
    { bus: "echo", label: "echo",   feed: "ping-pong · fed by the echo sends", eq: BUS_EQ_BANDS,
      knobs: [
        { key: "ret",  label: "return", table: BUSRETS, labels: BUSRETLABEL, default: null },
        { key: "fb",   label: "repeats", table: EFBS,   labels: EFBLABEL,    default: null },
        { key: "tone", label: "tone",   table: ETONES,  labels: ETONELABEL,  default: null } ] },
    { bus: "room", label: "drum room", feed: "fed by the kit's lane sends", eq: BUS_EQ_BANDS,
      knobs: [
        { key: "ret",  label: "return", table: BUSRETS, labels: BUSRETLABEL, default: null } ] },
  ];
  const BUSBY = {};
  for (const b of BUSES) BUSBY[b.bus] = b;
  // ONE SPEC -> ENGINE VALUES, resolveMaster's shape: `ret` resolves to its
  // multiplier (1 when unset — the graph as built), fb/tone to their number or
  // null (null = the builder's own constant, untouched).
  function resolveBuses(v) {
    const g = v && typeof v === "object" ? v : {};
    const pick = (tbl, x) =>
      (x != null && Object.prototype.hasOwnProperty.call(tbl, String(x))) ? tbl[x] : null;
    const out = {};
    for (const b of BUSES) {
      const e = g[b.bus] && typeof g[b.bus] === "object" ? g[b.bus] : {};
      const r = {};
      for (const k of b.knobs) {
        const val = pick(k.table, e[k.key]);
        r[k.key] = k.key === "ret" ? (val == null ? 1 : val) : val;
      }
      r.eq = resolveEq(e.eq, b.eq);      // null = the return as built, no nodes
      out[b.bus] = r;
    }
    return out;
  }
  // is this spec the same as no spec at all? — masterIsDefault's question, for
  // the same normalizer in song.js and ui/state.js setBuses
  const busesIsDefault = v => !v || typeof v !== "object" ||
    BUSES.every(b => {
      const e = v[b.bus];
      return e == null || typeof e !== "object" ||
        (b.knobs.every(k => e[k.key] == null ||
           !Object.prototype.hasOwnProperty.call(k.table, String(e[k.key]))) &&
         eqIsFlat(e.eq, b.eq));
    });

  // THE REGISTRY ROW, same shape as PARTMIX so one surface can draw it: `label`
  // is the silkscreen word over the control, because unlike a mixer column
  // ("rev", "pan") these need a noun rather than an abbreviation.
  const MASTER = [
    { key: "drive",   label: "drive",   table: DRIVES,   labels: DRIVELABEL,   default: null },
    { key: "glue",    label: "glue",    table: GLUES,    labels: GLUELABEL,    default: null },
    { key: "tape",    label: "tape",    table: TAPES,    labels: TAPELABEL,    default: null },
    { key: "space",   label: "space",   table: SPACES,   labels: SPACELABEL,   default: null },
    { key: "width",   label: "width",   table: WIDTHS,   labels: WIDTHLABEL,   default: null },
    { key: "tilt",    label: "tilt",    table: TILTS,    labels: TILTLABEL,    default: null },
    { key: "ceiling", label: "ceiling", table: CEILINGS, labels: CEILINGLABEL, default: null },
  ];
  const MASTERBY = {};
  for (const f of MASTER) MASTERBY[f.key] = f;

  // ONE SPEC -> ENGINE VALUES, here rather than in the graph, for the reason
  // resolvePartMix is here: the surface that writes a chip and the builder that
  // wires a node must read the same table.
  //
  // The two tables with a shipped default (glue, ceiling) resolve to THAT
  // default when absent, so the builder gets one shape either way and never
  // has to know which numbers are "today". The other five resolve to null,
  // which is the builder's instruction to build nothing at all.
  function resolveMaster(m) {
    const g = m && typeof m === "object" ? m : {};
    const pick = (tbl, v) =>
      (v != null && Object.prototype.hasOwnProperty.call(tbl, String(v))) ? tbl[v] : null;
    const t = pick(TAPES, g.tape), s = pick(SPACES, g.space);
    return {
      drive:   pick(DRIVES, g.drive),
      glue:    { ...(pick(GLUES, g.glue) || GLUEDFLT) },
      tape:    t && { ...t },
      space:   s && { ...s },
      width:   pick(WIDTHS, g.width),
      tilt:    pick(TILTS, g.tilt),
      ceiling: { ...(pick(CEILINGS, g.ceiling) || CEILDFLT) },
    };
  }
  // …and the inverse question the loader and the surface both ask: is this spec
  // the same as no spec at all? Absent must have ONE spelling (song.js
  // normalizes an empty map away on the way in), and this is the test for it.
  const masterIsDefault = m => !m || typeof m !== "object" ||
    MASTER.every(f => m[f.key] == null ||
      !Object.prototype.hasOwnProperty.call(f.table, String(m[f.key])));

  /* ---------- automation ---------- */
  // A box's `auto` list is the REAL automation surface: [{param, points:
  // [[beat, value], …], curve}], armed on the section's mixer channel every
  // pass (audio/mixer.js armAutomation) and rendered identically by the
  // bounce. The PALETTE writes it through shape presets — off/open/close/
  // rise/fall/pump — which bake a point list for the section's current length
  // in beats. Hand-drawn breakpoints can land later without the save shape
  // moving, because points are already the stored truth.
  //
  // `hpf` is internal-only (the mot "rise" compile targets it) and is
  // deliberately NOT in this table: the public params are the four+one a
  // finger can reason about.
  const AUTOPARAMS = {
    cutoff:      { lo: 320,   hi: 16000, curve: "exp" },
    level:       { lo: 0.07,  hi: 1,     curve: "exp" },
    pan:         { lo: -0.8,  hi: 0.8,   curve: "lin" },
    "send.rev":  { lo: 0.001, hi: 0.7,   curve: "lin" },
    "send.echo": { lo: 0.001, hi: 0.7,   curve: "lin" },
  };
  const AUTOPARAMLABEL = { cutoff: "filter", level: "level", pan: "place",
                           "send.rev": "reverb", "send.echo": "echo" };
  // shapes in NORMALIZED position/value; pump is per-beat (the sidechain
  // gesture, same 0.32→1 numbers the old mot pump hardcoded)
  const AUTOSHAPES = {
    open:  [[0, 0], [1, 1]],
    close: [[0, 1], [1, 0]],
    rise:  [[0, 0.3], [1, 1]],
    fall:  [[0, 1], [1, 0.3]],
  };
  const AUTOSHAPELABEL = { off: "off", open: "open", close: "close",
                           rise: "rise", fall: "fall", pump: "pump" };
  // shape -> a concrete {param, shape, curve, points} for a section `beats`
  // long. Returns null for "off" (the caller removes the entry instead).
  function autoShape(param, shape, beats) {
    const R = AUTOPARAMS[param];
    if (!R || shape === "off") return null;
    const B = Math.max(1, Math.round(beats));
    const map = x => R.curve === "exp" && R.lo > 0
      ? +(R.lo * Math.pow(R.hi / R.lo, x)).toFixed(4)
      : +(R.lo + x * (R.hi - R.lo)).toFixed(4);
    let points;
    if (shape === "pump") {
      points = [];
      for (let b = 0; b < B; b++) points.push([b, map(0.32)], [b + 0.85, map(1)]);
    } else {
      const S = AUTOSHAPES[shape];
      if (!S) return null;
      points = S.map(([x, v]) => [x * B, map(v)]);
    }
    return { param, shape, curve: R.curve, points };
  }

  // SECTION ROLES. A role is a NAME, not a transform: setting a box to
  // "chorus" does not reach in and change the drums. What the role does is
  // tell the composer what to BUILD, and tell you what you are looking at
  // afterwards. (Lived in compose.js; moved here because it is vocabulary, and
  // compose re-exports it so its own API did not move.)
  const ROLES = { drums: "drums", bass: "bass", groove: "groove",
                  intro: "intro", verse: "verse", chorus: "chorus",
                  bridge: "bridge", breakdown: "breakdown", drop: "drop",
                  solo: "solo", outro: "outro" };

  // THE INSTRUMENT CHOICES (2026-08-16, "the section speaks up"): the union of
  // every sampled instrument the genre table itself plays — 48 ids, every one
  // a SAMPLERS id the coverage gate already proves real, so a chip here can
  // never name a sound the page cannot fetch. Per LAYER, like `oct` and
  // `scale`: set, it replaces what that layer's voices play (and mutes a
  // signature synth — you asked for a rhodes, not a 303 wearing one); unset,
  // the genre's own `instr` answers, which is why the default is null like
  // every other enum. The label is the id said as words — the same honest
  // naming the mix desk's second line uses.
  const INSTRCHOICES = {};
  {
    const ids = new Set();
    for (const g of Object.values(NG.GENRES)) {
      const e = g && g.instr;
      if (e) for (const id of (Array.isArray(e) ? e : [e])) ids.add(id);
    }
    for (const id of [...ids].sort()) INSTRCHOICES[id] = id.replace(/_/g, " ");
  }

  /* ---------- THE REGISTRY ---------- */
  // One entry per control. Shape:
  //   key     the field name on the box (and, for scope "layer", on a stack
  //           entry — a layer field left unset INHERITS the box's)
  //   scope   "box" | "layer". The split is the rule stacking was built on: the
  //           authority owns everything that must be shared for the box to be
  //           one piece of music — the grid, the key centre, the section
  //           envelope — and everything else is per layer. (The groove sits a
  //           level higher still: it is the SONG's, and not in this registry.)
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
    // (no `swing` and no `groove` entry: BOTH are the SONG's, like the tempo
    // — see the SWINGS and GROOVELABEL notes above)
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
    // ---- the composition-depth surface (P4) — appended, never reordered ----
    { key: "key",     scope: "box",   table: KEYS,        labels: KEYLABEL,
      tab: "sound",  group: "key",                     default: null },
    { key: "prog",    scope: "box",   table: PROGCHOICES, labels: PROGLABEL,
      tab: "sound",  group: "progression",             default: null },
    { key: "period",  scope: "box",   table: PERIODS,     labels: PERIODLABEL,
      tab: "sound",  group: "sentence",                default: null },
    { key: "breath",  scope: "box",   table: BREATHS,     labels: BREATHLABEL,
      tab: "line",   group: "breath",                  default: null },
    { key: "pipe",    scope: "box",   table: PIPESETS,    labels: PIPELABEL,
      tab: "line",   group: "pipe",                    default: null },
    { key: "part",    scope: "layer", table: PARTCHOICES, labels: PARTCHOICES,
      tab: "voice",  group: "part",                    default: null },
    // `parts` is the PER-PART MIX: a map of chair key -> {fx, rev, echo, lvl,
    // pan, mute, solo}, each sub-field drawn from PARTMIX above. Type "parts"
    // because it is neither an enum nor a flat list — song.js validates the
    // map shape, exactly as it does the `vox` object and the `auto` entries.
    // Absent (the default) is the whole of today: audio/mixer.js builds no
    // sub-bus at all and every voice lands on the section input as before.
    { key: "parts",   scope: "box",   type: "parts", table: PARTNAMES,
      labels: PARTLABEL, tab: "fx", group: "per part", default: null },
    // `auto` is a LIST whose real entries are {param, points, curve} objects;
    // a bare param string is legal (and inert) so the registry's exhaustive
    // toggle can exercise the table like any other list field. song.js owns
    // the object-shape validation.
    { key: "auto",    scope: "box",   type: "list", table: AUTOPARAMS,
      labels: AUTOPARAMLABEL, tab: "fx", group: "automation", default: [] },
    // ---- the singer (sing.js + audio/sing.js) — appended, never reordered --
    // BOX scope, on the `voice` page: a box has one lyric and one singer, the
    // way it has one groove and one key. Absent is the whole of the day before
    // it existed — singPlan returns [] and no wasm is ever fetched.
    { key: "sing",    scope: "box",   table: SINGS,       labels: SINGLABEL,
      tab: "voice",  group: "sing",                      default: null },
    // ---- the board (2026-08-16) — appended, never reordered ----------------
    // the SECTION strip's fader offset, the same dB-over-the-automated-value
    // law as PARTMIX `fader` (see the note there): it multiplies the channel's
    // resolved `lvl` in audio/mixer.js chanSpec, so the enum level, the
    // composer's arc and a level automation all keep meaning what they meant.
    { key: "fader",   scope: "box",   type: "num", min: -24, max: 12,
      tab: "fx",     group: "fader",                     default: null },
    // the SECTION strip's EQ (EQ_BANDS): the same three knobs the part strips
    // carry, on the box's own field — the PARTMIX `eq` note has the law
    { key: "eq",      scope: "box",   type: "eq", bands: EQ_BANDS,
      tab: "fx",     group: "strip eq",                  default: null },
    // ---- the layer's own instrument (2026-08-16, "the section speaks up") --
    // See INSTRCHOICES above: per layer, null = the genre's own `instr`.
    { key: "instr",   scope: "layer", table: INSTRCHOICES, labels: INSTRCHOICES,
      tab: "voice",  group: "instrument",                default: null },
  ];
  const FIELD = {};
  for (const f of FIELDS) FIELD[f.key] = f;

  const api = { NSLOTS, MAX_LEN, MAX_NUDGE, MAX_FX,
                OPS, OPLABEL, ENVLABEL, MOTLABEL, INLABEL, OUTLABEL,
                RATES, RATELABEL, SWINGS, SWINGLABEL, GROOVELABEL,
                KITLABEL, KITNAME, VERBLABEL, DRUMKITS, DRUMLANES, BASSOPS,
                FX, FXLABEL, fxChain, FXSEND, fxMix, fxSendable,
                SENDS, SENDLABEL, VERBS,
                DTIMES, DTLABEL, LEVELS, LEVELLABEL, PANS, PANLABEL,
                VOX, VOXPARAM, OCTAVES, ARTICS, CMODES, CLAMPS, CLAMPLABEL,
                KEYS, KEYLABEL, PROGCHOICES, PROGLABEL, PERIODS, PERIODLABEL,
                BREATHS, BREATHLABEL, PIPESETS, PIPELABEL, PARTCHOICES,
                PARTNAMES, PARTLABEL, PARTMIX, PARTMIXBY, MAX_CHAIRS,
                readPartKey, okPartKey, partChairLabel, chairKeys, resolvePartMix,
                faderDb,
                EQ_BANDS, BUS_EQ_BANDS, EQ_RANGE, eqDb, resolveEq, eqIsFlat,
                DRIVES, DRIVELABEL, GLUES, GLUELABEL, TAPES, TAPELABEL,
                SPACES, SPACELABEL, WIDTHS, WIDTHLABEL, TILTS, TILTLABEL,
                CEILINGS, CEILINGLABEL, MASTER, MASTERBY,
                resolveMaster, masterIsDefault,
                BUSES, BUSBY, resolveBuses, busesIsDefault,
                AUTOPARAMS, AUTOPARAMLABEL, AUTOSHAPES, AUTOSHAPELABEL, autoShape,
                SINGS, SINGLABEL, INSTRCHOICES,
                ROLES, FIELDS, FIELD };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuFields = api;
})(typeof window !== "undefined" ? window : globalThis);
