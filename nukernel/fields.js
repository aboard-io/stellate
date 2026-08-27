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
  // THE PERFORMANCE WORDS ARE ASKABLE'S, NOT A SECOND COPY OF THEM. askable.js
  // has carried "dead straight / a little / hard on the one" and "flat / a
  // little / it arches" since it was written, with the question above each run
  // (askable.js:72-81); the page had simply never offered them. Retyping three
  // rows here would be the second source of truth this file exists to abolish,
  // so `nudgesFor("performance")` reads THAT table and this one only says which
  // rows are nudges.
  //
  // A PAGE THAT HAS NOT LOADED IT GETS NO PERFORMANCE SHEETS, not a page that
  // fails to boot: nukernel/index.html must carry `<script src="askable.js">`
  // ahead of this file, and until it does the absence is silent everywhere
  // except the one call that needs it. (That is the absent-is-today law read
  // one layer up: a missing table means the feature says nothing.)
  const NA = (typeof module !== "undefined" && module.exports)
    ? require("./askable.js") : root.NuAskable;
  const { reverse, invert, rotate, fill, spread, split, del, drop,
          transpose, complement, crossmap, excerpt, only, KITOPS, LANES, MODE } = K;
  const { MODES, MODELABEL, SCALES, SCALELABEL } = NG;

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

  // ---- WHAT A NUDGE NEEDS BEFORE IT CAN BE SAID (D7) ------------------------
  // (Paul, 2026-08-24: "when an option makes another one unaccessible gray it
  // out.")
  //
  // One row per WORD that is not always sayable, in nukernel/avail.js's own
  // rule language, evaluated against nukernel/avail.js's own docFeatures. It
  // lives HERE rather than in avail.js because the requirement is a fact about
  // the word — `outro: "drum fill"` needs a drummer the way `breath: "clipped"`
  // needs nothing — and this file is where the word is written. One owner for
  // the word and for what it costs.
  //
  // TWO SENSES, and the difference is the whole of the law:
  //   rule    AVAILABLE WHEN. False ⇒ the option is a real `disabled`, because
  //           choosing it would make a WRONG SOUND — drums where there is no
  //           drummer, or a bar of silence.
  //   inert   NOTHING WOULD HAPPEN. True ⇒ the option is `quiet`: still
  //           choosable, greyed by class only, with the reason printed. The
  //           dead-word law (band-kit.js:5024, "a word that changes nothing
  //           about this player composes the identical section") is a remark,
  //           not a refusal.
  // A row with no `why` borrows avail.js WHY's sentence for the feature it
  // names, which is how "no drummer" stays spelled once. A row that names a
  // feature WHY has never heard of carries its own sentence, because an
  // unreadable grey is one report away from being a readable one.
  //
  // WHY EXACTLY SEVEN EDGES GREY WITH NO DRUMMER, and not the eleven that
  // touch a drum. kernel.js:2861 onward writes `D()` snare and cymbal events
  // UNCONDITIONALLY for `fill`, `roll`, `tomfill`, `hatrun` and `doubles`, and
  // those five ARE nothing but drums — a snare fill on a Gregorian chant is
  // the bug this table exists to stop. `break` (:2984) and `intro: kit`
  // (:2846) keep only `kind === "hit"` events, so with no drummer the bar is
  // SILENCE. Those seven are refusals. `crash` and `hush` also write a cymbal,
  // and they stay lit on purpose: `crash` re-fires each lane's own first note
  // as a held chord (:2896, "a real band hits the last chord with the drummer
  // and lets it ring") and `hush` is a diminuendo with a hole in it (:2958) —
  // the gesture survives the drummer's absence and only the cymbal is a lie.
  // `count` and `riser` write drums too and stay lit for the same reason: a
  // count-in is a count-in whoever taps it.
  //
  // AND WHY `bassin`, `padin` AND `solo` ARE NOT HERE, which reverses this
  // slice's own design note (07-nudges.md §4 called `intro: bassin` "a lie, not
  // a crash" and would have greyed it). The kernel already answered: "a
  // bassless stream degrades to its line for the same reason padin does…
  // which is what total means here" (kernel.js:2755-2760). Degrading to
  // "melody alone" is a legitimate way to start a section, not a wrong sound,
  // so it is not a refusal — and greying it would have broken the one
  // measurement PROGRAM.md §5 pins, that exactly seven edges go dark on a
  // record with no drummer.
  //
  // ONE ROW THAT IS NOT HERE AND SHOULD BE, named rather than skipped.
  // kernel.js:1342 says "two notes have no arch to hear, so the tent starts at
  // three", so `phrase` is inert on material with fewer than three onsets in a
  // bar and the sheet ought to say so. It needs a feature avail.js docFeatures
  // does not publish — onsets per bar, over whichever cell each voice reads
  // here — and inventing it in this file would be computing a document fact in
  // the vocabulary registry, which is exactly the layering this file's header
  // forbids. One row in docFeatures, then one row here.
  const NUDGEGATE = {
    intro: {
      kit: { rule: { rule: "when", is: "cast.drumsOn" } },
    },
    outro: {
      fill:    { rule: { rule: "when", is: "cast.drumsOn" } },
      roll:    { rule: { rule: "when", is: "cast.drumsOn" } },
      tomfill: { rule: { rule: "when", is: "cast.drumsOn" } },
      hatrun:  { rule: { rule: "when", is: "cast.drumsOn" } },
      doubles: { rule: { rule: "when", is: "cast.drumsOn" } },
      break:   { rule: { rule: "when", is: "cast.drumsOn" } },
    },
    env: {
      // both are CUTS, not curves (kernel.js:2613), and both measure their
      // window against the section: `drop` deletes min(span/8, bar) and
      // `stutter` repeats the last eighth. On a one-bar section that window IS
      // the section.
      drop:    { rule: { rule: "when", not: "section.oneBar",
                         why: "a one-bar section is all edge — the cut would take the whole of it" } },
      stutter: { rule: { rule: "when", not: "section.oneBar",
                         why: "a one-bar section is all edge — the repeat window would be the whole of it" } },
    },
    period: {
      // a bar schedule over one bar is `word` (kernel.js:1202 periodOps reads
      // `at(g.period, s)` with s the bar index), so nothing moves — a remark,
      // not a refusal
      "2bar": { inert: { rule: "when", is: "section.oneBar",
                         why: "there is only one bar here for the sentence to run over" } },
      "4bar": { inert: { rule: "when", is: "section.oneBar",
                         why: "there is only one bar here for the sentence to run over" } },
    },
    pipe: {
      // kernel.js:577 `if (e.part !== (o.part || "pad")) return;` — strum
      // groups the notes of a voiced CHORD and spreads them; a record of pure
      // lines has no group to spread and the stream comes back `ev` untouched
      strum: { inert: { rule: "when", not: "cast.hasPad",
                        why: "nobody is voicing a chord — a strum has nothing to spread" } },
    },
  };

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
  // ...AND THE METER, the third song fact of this family and the same law
  // exactly: a record counts in three or it does not, and a section that
  // changed meter mid-way would be a different feature. Absent (null) is the
  // four-four every record in this box has counted in since it existed, and
  // there is deliberately no `meter` entry in FIELDS below for the same
  // reason there is no `groove` one. The NUMBERS live in kernel.js METERS —
  // one place, because they are algebra — and this is the vocabulary.
  const METERLABEL = { three: "in three", six: "in six-eight" };
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
  // voiced per hit by the big engine's own drum modules (audio/to-engine.js
  // MACHINE_KIT names the models, and the page and the tape both read that one
  // table). A genre names one; a box may borrow another, which is the
  // difference between playing a beat and playing it on somebody else's drums.
  // An id added here must be a directory on disk or a row in MACHINE_KIT —
  // there is no third kind of kit, and the browser gate (nukernel-drums (M))
  // holds the two lists together.
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
  // ...AND THE MODULE THAT TYPE NAMES, because there are TWO consumers and they
  // key on different things. sampler.js buildInsertNodes(ctx, …) builds WebAudio
  // nodes and reads `type` — that was nukernel's only reader while it had its own
  // graph. Since the one-engine move the chain goes to stream-renderer.js mkChain
  // instead, which is context-free Faust and reads `module`. Nothing translated
  // between the two vocabularies, so EVERY ONE OF THE ELEVEN CHIPS emitted an
  // insert the engine could not build: it interpolated `undefined` into a module
  // URL, 404'd, and the chip did nothing. Paul: "The crunch doesn't seem to be
  // there" — crunch is one of these, and it had no module to be there with.
  //
  // The mapping is a prefix and nothing more: engine/faust/dist ships
  // insert_chorus, insert_phaser, insert_flanger, insert_tremolo, insert_leslie,
  // insert_wah, insert_ringmod, insert_filtersweep, insert_fenv, insert_delay and
  // insert_higain — one per type this table can emit. The PARAMS already match
  // those modules name for name (crunch writes drive/stages/gate/low/mid/high/
  // presence/level/mix and insert_higain declares exactly those), which says this
  // vocabulary was written against them from the start and only the name of the
  // thing to load was ever missing. Both keys ride together so either reader is
  // satisfied and neither has to know about the other.
  const fxChain = keys => (keys || []).filter(k => FX[k])
    .map(k => { const type = FX[k].type || k;
      return { type, module: "insert_" + type, params: { ...FX[k].params } }; });

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

  /* ---------- THE INSERT SLOTS' OWN KNOBS (2026-08-27) ---------- */
  // "I think we need to do what everyone else does with effects. Add per voice
  // effects, up to three. Each has a wet dry mix and its own settings." — Paul,
  // 2026-08-27. The chip came back onto the voice (PARTMIX `fx` below, the
  // reversal is written there); these tables are the "wet dry mix and its own
  // settings" half of the sentence, said as detents because every value on
  // this machine is a word or a detent from this file.
  //
  // THE WET IS THE CHIP'S OWN `mix` PARAM, SURFACED — engine/faust/dist
  // insert_*-meta.json declares `mix` on ten of the eleven modules and
  // state-engine insertChain clamps it 0..1, so a wet word is a value the DSP
  // genuinely reads. The one module with NO mix is insert_filtersweep (a swept
  // resonant lowpass is a REPLACEMENT, not a blend — buildInsertNodes chains
  // it serially and the module declares no such slider), so a wet on `sweep`
  // is REFUSED on the board rather than drawn dead; fxHasMix is that test.
  // ABSENT = the chip's own declared mix (the FX table above), which is what
  // an old save that names only the chip has always sounded like.
  const FXWETS = { dry: 0, low: 0.25, half: 0.5, deep: 0.75, full: 1 };
  const FXWETLABEL = { dry: "dry", low: "a little", half: "half",
                       deep: "mostly", full: "all wet" };
  const fxHasMix = k => !!(FX[k] && FX[k].params && FX[k].params.mix != null);
  // A SLOT'S OWN ONE-OR-TWO SETTINGS: each chip surfaces the face params its
  // module actually declares, in the MODULE'S OWN UNITS, with the range read
  // off engine/faust/dist/insert_<type>-meta.json (checked 2026-08-27 — rate
  // in Hz 0.01..8, wah base in Hz 80..1200, ringmod freq in Hz, timeBars a
  // fraction of a bar, everything else 0..1). The detent table is ONE shared
  // fraction scale (FXPOTS) so song.js's registry walk validates every slot
  // knob against one table; the fraction lands on the param's own span here.
  // ABSENT = the chip's declared default (FX above) — the absent-is-today law.
  const FXPOTS = { least: 0, low: 0.25, mid: 0.5, high: 0.75, most: 1 };
  const FXPOTLABEL = { least: "least", low: "low", mid: "mid",
                       high: "high", most: "most" };
  const FXFACE = {
    chorus:  [{ key: "rate", label: "rate",  min: 0.1,    max: 6 },
              { key: "depth", label: "depth", min: 0,     max: 1 }],
    phaser:  [{ key: "rate", label: "rate",  min: 0.1,    max: 6 },
              { key: "depth", label: "depth", min: 0,     max: 1 }],
    flanger: [{ key: "rate", label: "rate",  min: 0.05,   max: 4 },
              { key: "depth", label: "depth", min: 0,     max: 1 }],
    tremolo: [{ key: "rate", label: "rate",  min: 0.5,    max: 12 },
              { key: "depth", label: "depth", min: 0,     max: 1 }],
    leslie:  [{ key: "speed", label: "speed", min: 0,     max: 1 },
              { key: "depth", label: "depth", min: 0,     max: 1 }],
    wah:     [{ key: "sens", label: "sense", min: 0,      max: 1 },
              { key: "base", label: "base",  min: 80,     max: 1200 }],
    ringmod: [{ key: "freq", label: "freq",  min: 40,     max: 2000 }],
    sweep:   [{ key: "res",  label: "reso",  min: 0,      max: 0.95 },
              { key: "rateBars", label: "bars", min: 1,   max: 16 }],
    fenv:    [{ key: "sens", label: "sense", min: 0,      max: 1 },
              { key: "res",  label: "reso",  min: 0,      max: 0.95 }],
    echo:    [{ key: "timeBars", label: "time", min: 0.0625, max: 0.5 },
              { key: "feedback", label: "feed", min: 0,   max: 0.9 }],
    crunch:  [{ key: "drive", label: "drive", min: 0,     max: 1 },
              { key: "presence", label: "presence", min: 0, max: 1 }],
  };
  // ONE PART ENTRY -> THE FINISHED {type, module, params} CHAIN, slots' wet and
  // face knobs applied. The sibling of `fxChain` above (which serves the
  // SECTION chip and knows no slots) rather than a replacement, because the
  // two callers genuinely carry different facts. The output is the parent's
  // own recipe dialect and still rides through state-engine insertChain
  // (audio/desk.js insertsFor), which clamps every knob to the slider the
  // module declares — so a face value here can never ask the DSP for a number
  // it does not read.
  const fxChainFor = e => {
    const g = e && typeof e === "object" ? e : {};
    const keys = (g.fx || []).filter(k => Object.prototype.hasOwnProperty.call(FX, k))
      .slice(0, MAX_FX);
    return keys.map((k, i) => {
      const type = FX[k].type || k;
      const params = { ...FX[k].params };
      const n = i + 1;
      const w = g["fxw" + n];
      if (w != null && Object.prototype.hasOwnProperty.call(FXWETS, String(w)) &&
          params.mix != null)
        params.mix = FXWETS[w];
      const face = FXFACE[k] || [];
      for (const [sk, spec] of [["fxa" + n, face[0]], ["fxb" + n, face[1]]]) {
        const v = g[sk];
        if (spec && v != null && Object.prototype.hasOwnProperty.call(FXPOTS, String(v)))
          params[spec.key] = +(spec.min + FXPOTS[v] * (spec.max - spec.min)).toFixed(4);
      }
      return { type, module: "insert_" + type, params };
    });
  };

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

  /* ---------- SECTION AUTOMATION: the word grid (2026-08-27) ---------- */
  // ideal/one-board.html §III, binding: "A word is a trim on the strip's fader
  // for that section — deterministic, diffable, thumb-sized." Six words per
  // voice per section — out · hush · back · — (as mixed) · fwd · lift — and
  // the value of a word is a dB TRIM RIDING THE STRIP'S OWN FADER for that
  // section only (`out` is the cut). Stored at `voice.desk.trim[<secId>]`;
  // absent is "as mixed", which is today, byte for byte. The overlay is
  // applied per box at push time (ui/eight.js) through `trimApply` below, so
  // the grid reaches the sound on the exact wire the fader already proved
  // (test/tape-reach.test.js R1: one trim over dry/rev/del together).
  const TRIMS = { out: null, hush: -6, back: -2.5, fwd: 2.5, lift: 5 };
  const TRIMLABEL = { out: "out", hush: "hush", back: "back",
                      fwd: "fwd", lift: "lift" };
  // one entry + one word -> the entry the box actually plays. `out` is a mute
  // (the cut the desk already has); every other word adds its dB to the stored
  // fader through faderDb, the ONE clamp every fader on this machine takes.
  const trimApply = (e, word) => {
    if (!Object.prototype.hasOwnProperty.call(TRIMS, String(word))) return e;
    const base = e && typeof e === "object" ? e : {};
    if (TRIMS[word] == null) return { ...base, mute: true };
    return { ...base,
      fader: faderDb((Number.isFinite(base.fader) ? base.fader : 0) + TRIMS[word]) };
  };

  // THE REVERB RETURN, absolute rather than a multiplier: it IS `state.reverb`,
  // and the parent reads `rgain = clamp(reverb * 3.2, 0, 2) * reverbScale`
  // (engine/faust/voices/state-engine.js fxParams) — so `huge` is the
  // saturation point and there is nothing above it. Absent = 0 = the return
  // this page has been shipping: audio/plan.js hands toEngine `reverb: 0`, so
  // every unit of the chant carried gregorian's `tone.verb` 0.78 into a bus
  // whose gain was zero. 78% wet and bone dry, for as long as this page has
  // existed. THIS TABLE IS THE ONLY THING THAT OPENS IT.
  const RETURNS = { off: 0, dim: 0.18, room: 0.32, hall: 0.5, huge: 0.625 };
  const RETURNLABEL = { off: "shut", dim: "a little", room: "a room",
                        hall: "a hall", huge: "as wet as it goes" };
  // ...AND THE DELAY BUS GETS THE SAME KNOB, 2026-08-27 (FUTURE.md Phase 0).
  // Bus 2's return was the one number on the rack a hand could not reach:
  // fx_bus.dsp declares `dgain` 0..2 and state-engine fxParams emitted it as
  // the LITERAL 1 — live in, fixed out (the audit above says so). These values
  // are in DGAIN'S OWN UNITS, not RETURNS': `rev.ret` is a state.reverb the
  // engine multiplies by 3.2, `echo.ret` lands on dgain verbatim (audio/desk.js
  // masterState -> state.delay.gain -> fxParams). The words are RETURNLABEL's,
  // the numbers are the same rgain-equivalent rungs (0 / .58 / 1 / 1.6 / 2 —
  // rev's table times 3.2 lands on .58/1.02/1.6/2; `room` is pinned at 1.0
  // exactly because 1 IS the literal the bus has always run at). Absent = null
  // = the literal 1, byte-identical: a record that never touched the knob
  // renders the same tape it always did.
  const ERETURNS = { off: 0, dim: 0.58, room: 1, hall: 1.6, huge: 2 };
  // THE DELAY -> REVERB BLEED, 2026-08-27 (the series-bus round). fx_bus ran
  // the delay into the reverb at the LITERAL `d*0.2` since the csound port —
  // the engineer refused the knob for exactly that reason ("the bleed is a
  // constant in the DSP — not wired"). The literal is a slider now
  // (fx_bus.dsp `bleed`, 0..1, default 0.2 — proven byte-identical at the
  // default on two pressed records), reached as state.bleed -> fxParams.
  // `stock` is pinned at 0.2 exactly because 0.2 IS the literal the bus has
  // always run at; absent = null = no state field = the same 0.2. rev_bleed
  // mirrors the slider, so a colored genre's room hears the same knob.
  const EBLEEDS = { off: 0, trace: 0.08, stock: 0.2, heavy: 0.5, soaked: 1 };
  const EBLEEDLABEL = { off: "severed", trace: "a trace", stock: "as shipped",
                        heavy: "heavy", soaked: "soaked" };
  // WHICH ROOM — the parent's own five modules (state-engine REVERB_COLORS,
  // all five shipped in engine/faust/dist), under desk words. nukernel's old
  // `verb` table named three rooms that reached nothing at all.
  const REVERBS = { plate: "dattorro", hall: "fdn", chamber: "greyhole",
                    spring: "spring", shimmer: "shimmer" };
  const REVERBLABEL = { plate: "plate", hall: "hall", chamber: "chamber",
                        spring: "spring", shimmer: "shimmer" };

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
  // KEY — the SONG'S TONIC, a semitone shift on the whole box, applied in the
  // kernel AFTER registration so the fold cannot eat it (already true, and
  // read off the rendered score rather than assumed — see the nukernel gate's
  // "a song knows what key it is in" section): every pitch kernel.js builds
  // adds `key` as its very last step, so a phrase is transposed whole, never
 // broken. Widened from the truck-driver's own small range to
  // the full twelve: "there should be a variety of keys… I should be able to
 // change keys" . Nothing in this engine carries an
  // inherent pitch class — every phrase is scale DEGREES, and a genre's own
  // harmony is written the same relative way — so "0" is a naming convention
  // and not a measurement: call the phrase as written "C", the way any
  // tracker names its open string that, and every other tonic is spoken
  // relative to it. Old saves (which only ever wrote −3..4) still validate
  // and still SOUND exactly as they did — those seven values did not move,
  // only their label did, from a bare number to the note it actually names.
  // SPELLED BOTH WAYS, AND THAT IS A REVERSAL WRITTEN DOWN. This line said
  // "C♯" and nothing else, on the reasoning that a sharp name is a naming
  // convention and "0" is C. Paul, 2026-08-24: "key (although please spell
  // things out like not just A# but A#/Bb)". Two reasons it is right and the
  // sharp-only list was wrong:
  //   1 THE PAGE DISAGREED WITH ITSELF. ui/abc.js picks a key SIGNATURE by the
  //     copyist's convention (SIG_OF_MAJOR: "Db over C#'s seven sharps, F# over
  //     Gb"), so which of the two names the STAFF prints depends on the mode.
  //     Measured through abc.js `keySig` itself: key -2 aeolian engraves a
  //     five-flat signature and spells its tonic "Bb" where this table said
  //     "A♯"; key 1 ionian engraves "Db" where it said "C♯"; key -4 ionian
  //     engraves "Ab" where it said "G♯". One record, two names, and neither
  //     surface was wrong on its own. A menu whose name carries BOTH cannot
  //     disagree with a signature that has to pick one.
  //   2 A composer reads whichever of the two the music in front of them uses.
  //
  // ♯/♭ AND NOT #/b, DECIDED BY LISTENING TO IT. eSpeak NG is NVDA's default
  // synthesiser, so `espeak-ng -x -q` is what a screen-reader user actually
  // hears, and it is not close:
  //     "A♯/B♭"  ->  a# S'A@p slaS b'i: fl'at     "A sharp slash B flat"
  //     "A#/Bb"  ->  a# h'aS slaS b,i:b'i:       "A hash slash B B"
  // ASCII turns the accidental into "hash" and the flat into a repeated letter;
  // the musical codepoints are read as the words they are. (Paul typed the
  // ASCII form, in a terminal, to name the CONVENTION — spell both — and this
  // is that convention in the character the machine can say.) The slash also
  // does the safety work when a reader is set to skip symbols entirely: it
  // still says "A something B", which can never be confused with a bare "A",
  // where a dropped lone ♯ would have made A♯ and A read identically.
  // Naturals take no slash: there is nothing to disambiguate.
  const KEYNAMES = ["C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭",
                    "G", "G♯/A♭", "A", "A♯/B♭", "B"];
  const KEYS = {}, KEYLABEL = {};
  for (let i = -6; i <= 5; i++) {
    KEYS[String(i)] = i;
    KEYLABEL[String(i)] = KEYNAMES[((i % 12) + 12) % 12];
  }
  // a modulation's own arithmetic: any semitone count, folded back onto the
  // twelve keys this table actually offers (−6..5) so a composed "+2" (the
  // truck driver) or a "relative minor, −3" (the bridge) never hands song.js
  // a value its own registry would refuse. compose.js is the only caller.
  const wrapKey = n => (((n + 6) % 12) + 12) % 12 - 6;
  // A KEY THIS WIDE CAN PUSH A FIXED-REGISTER VOICE OFF ITS ANCHOR — the same
  // caveat the narrower range already carried (kernel.js `anchored()` decides
  // a note's register BEFORE `key` is added), now with a half-octave either
  // side rather than a third. Not a new problem and not fixed here: it is the
  // instrument's own ceiling (vaporwave's DX7 comment is the documented case),
  // and the composer never reaches for the extremes of this table on its own.

  // MODE, reread as the other half of "the key" now that the tonic is a real
 // picker: "a major/minor (or modal) toggle" (Paul). The seven-way modal
  // chip already existed below; the one thing it could never say was "minor"
  // itself, because minor is what an UNSET chip already plays (kernel.js:
  // `g.mode || MODE`, and MODE there is natural minor). `minor` joins the
  // table as a real, choosable chip rather than a blank space, and it is safe
  // to add without a matching entry in genres.js: ui/derive.js resolves a
  // box's chip through NuGenres.MODES, which has no "minor" key either, so
  // the lookup returns undefined and the render falls through to
  // `g.mode || MODE` exactly as leaving the chip alone would. The visible
  // difference is real, though — choosing "minor" OVERRIDES a genre's own
  // colour (newwave's mixolydian, say) the way every other explicit chip
  // overrides the genre's own default, which null never does.
  const KEYMODES = { ...MODES, minor: MODE };
  const KEYMODELABEL = { ...MODELABEL, minor: "minor" };

  /* ---- THE CIRCLE OF FIFTHS, AS ARITHMETIC ---------------------------------
     Paul, 2026-08-24: "Maybe put the circle of fifths back in there for key
     selection, it was nice." It was, and it is back — ui/selects.js draws it
     and ui/eight.js arranges it, but neither of them may KNOW what a fifth is:
     which key sits at which hour, and which minor is relative to it, is the
     same kind of fact as KEYS and KEYLABEL themselves, so it lives beside them
     in the one file the UI is allowed to read a musical table from.

     FIFTHS is twelve KEY VALUES (the −6..5 this table actually offers), in
     fifths order, C at the top and sharps clockwise. Read as pitch classes it
     is 0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5 — each hour a perfect fifth above
     the last — folded onto this table's own range, and every one of the twelve
     appears exactly once, which is the property that makes the ring complete.

     ...AND THE SPELLING, WHICH IS THE ONE PLACE THE RING AND THE MENU LOOKED
     LIKE THEY DISAGREED. The old band-kit circle spelled its hours the way
     fifths order wants them — Db, Ab, Eb, Bb, F# — while the key control Paul
     asked for on the same day spells every black note BOTH ways ("A♯/B♭", the
     KEYNAMES comment above, measured against eSpeak NG). There is nothing to
     reconcile, because a value is not a spelling: the ring is a list of key
     VALUES here, and each hour wears whatever KEYLABEL says for it. Check the
     five black hours by eye and the fifths-proper name is inside every one of
     them — hour 6 is "F♯/G♭", hour 7 "C♯/D♭", hour 8 "G♯/A♭", hour 9 "D♯/E♭",
     hour 10 "A♯/B♭". So the circle reads correctly going round (F♯, D♭, A♭,
     E♭, B♭ are all on it) AND agrees, character for character, with the staff
     ui/abc.js engraves, which spells key −2 as B♭ and would otherwise have
     been contradicted by a ring that only said A♯. One table, both readings. */
  const FIFTHS = [0, -5, 2, -3, 4, -1, -6, 1, -4, 3, -2, 5];
  // THE RELATIVE MINOR of the key at each hour: its tonic is nine semitones up
  // (or three down), folded back onto the table by wrapKey — so this is derived
  // rather than a second list that could drift from the first.
  const relMinorOf = (key) => wrapKey(key + 9);
  // ...and what that minor is CALLED on the inner ring, which is the one place
  // the fifths-proper spelling is written out: at F♯'s hour the relative minor
  // is D♯m (six sharps, like its major), not E♭m (six flats, which belongs to
  // G♭). Short on purpose — the inner ring is the tightest twelve positions on
  // the diagram — and the both-ways spelling rides beside it in the widget as
  // KEYLABEL[relMinorOf(k)] + " minor", so nothing is lost to a screen reader.
  const RELMINNAME = ["Am", "Em", "Bm", "F♯m", "C♯m", "G♯m",
                      "D♯m", "B♭m", "Fm", "Cm", "Gm", "Dm"];
  // IS THIS MODE A MINOR? Asked of the interval table itself and never of a
  // list of names: a mode is minor when it has a minor third in it, which is
  // exactly what makes the inner ring stay lit when you push A minor to A
  // dorian with the menu beside the circle (the flow this round settled on,
  // 2026-08-25 — not a sentence of Paul's). The page must not forget where it
  // is standing because you changed its colour.
  const minorish = (mode) => {
    const m = KEYMODES[mode] || MODE;
    return m.indexOf(3) >= 0;
  };

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
  //
  // (a tenth address, `sing`, sat here for one day: the singer's own chair on
 // the desk. It went out with the singer on 2026-08-17 — kernel-daw.html
  // carries the tombstone — so the track list is the nine again.)
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
  // narrowed rather than a second one: the same discrete sends, the same four
  // levels and five places. A mixer whose channel strip speaks a different
  // language from the master strip is two things to learn.
  //
  // A TRACK HAS FOUR SENDS AND NO INSERTS ("get rid of inserts, reverb, and
 // echo — let me send to bus 1, bus 2, and bus 3 instead", Paul, 2026-08-17;
  // and, settling it, "Don't let me add effects to instruments. That's bus and
  // board stuff. But let me have up to four buses and a way to direct them to
  // each other", 2026-08-26). It said THREE until that second sentence.
  // The four sends ARE the four buses — `rev`, `echo`, `room`, `aux` keep their
  // saved names and are what BUS_FIELDS names bus 1 through bus 4 — so a
  // song written before this loads with its reverb and echo intact and simply
  // finds two sends it never used. The reason it is sends and not inserts
  // is measured rather than tidy: the engine's own bus measurement counts a
  // compressor or a convolver as the same arithmetic feeding one voice or
  // twenty, so a treatment costs a CONSTANT on a bus and a MULTIPLE on a
  // strip.
  //
  // `fx` IS OFF THE DESK, PERIOD — SAID TWICE NOW, AND THE SECOND TIME IS THE
  // ONE THAT SETTLES IT. This paragraph is the 2026-08-17 argument, unchanged,
  // because the 2026-08-24 round overturned it and 2026-08-26 put it back and a
  // sentence that has been true, false and true again is worth keeping whole:
  //
  //   "A prior round stopped any surface from WRITING a new one and left the
  //   FIELD in place so an old save's chain would still play — but PARTMIX is
  //   also where the mix table reads its own column list from, so the field
  //   left every track strip still DRAWING an insert bar nobody could clear.
  //   There is no way to keep the declaration and keep the promise, so it is
  //   gone: a saved `parts.<key>.fx` from before this round is not an error, it
  //   is simply a key song.js's loader (which validates a part entry against
  //   this very list) no longer recognizes, and it is dropped on load exactly
  //   the way any other unknown key is — never thrown, never migrated to
  //   something else, because there is nothing left to migrate it TO: no live
  //   song can reach resolvePartMix's `fx` handling below again, since nothing
  //   copies a part entry through this list's `fx` any more (that line stays,
  //   for the offline desk gate that still hands it one on purpose — its own
  //   note says why)."
  //
  // Every word of that is true again as of 2026-08-26 and by the same
  // mechanism. The BOX keeps its own `fx` chain as the
  // group insert (FIELDS below), and the section strip is where it is
  // reached — that one is a genre-wide treatment, not a per-track insert, and
  // Paul never asked for it to go ("That's bus and board stuff" is a statement
  // about where a treatment lives, and a section chip lives on the section).
  //
  // mute/solo are the two that are NOT enums, because they are not choices
  // between values — they are the desk's own pair, and solo is the one control
  // here that reaches OTHER parts (audio/desk.js partsOf: any solo in the
  // box mutes every part that is not soloed).
  const PARTMIX = [
    { key: "rev",  table: SENDS,  labels: SENDLABEL,  default: null },
    { key: "echo", table: SENDS,  labels: SENDLABEL,  default: null },
    { key: "room", table: SENDS,  labels: SENDLABEL,  default: null },
    // BUS 4, AND IT IS A SEND LIKE THE OTHER THREE ("let me have up to four
    // buses and a way to direct them to each other", Paul, 2026-08-26). Named
    // `aux` and not `bus4` for the reason `rev`/`echo`/`room` keep their names:
    // the field is the save's word and a positional name would have to be
    // renamed the day a bus is reordered. Absent = 0 = adds nothing, so every
    // record written before this loads and sounds exactly as it did.
    { key: "aux",  table: SENDS,  labels: SENDLABEL,  default: null },
    // THE GENRE SEND, 2026-08-27 (the series-bus round: "one bus for genre
    // specific effects, into a delay bus, into reverb, into main"). The strip
    // drew this send REFUSED while fx_bus had no genre stage; the stage exists
    // now — a fifth engine accumulator whose return runs the genre-bus chain
    // and SUMS INTO THE DELAY BUS (series, never main) — so the word is live.
    // Same enum family as rev/echo on purpose: a send is a send. Absent = 0 =
    // adds nothing, so every record written before this sounds exactly as it
    // did (the engine skips the whole stage when no send and no chain exist).
    { key: "genre", table: SENDS, labels: SENDLABEL,  default: null },
    { key: "lvl",  table: LEVELS, labels: LEVELLABEL, default: null },
    { key: "pan",  table: PANS,   labels: PANLABEL,   default: null },
    // THE CHIP IS BACK ON THE VOICE, 2026-08-27, BY THE SAME OWNER WHO TOOK IT
    // OFF, and this is the third turn of the same key — the whole history is
    // in the tombstone below, kept because a sentence that has been true,
    // false, true and false again is the record of a real argument. Paul,
    // 2026-08-27: *"I think we need to do what everyone else does with
    // effects. Add per voice effects, up to three. Each has a wet dry mix and
    // its own settings. Have one bus for genre specific effects, into a delay
    // bus, into reverb, into main."* That reverses his 2026-08-26 "Don't let
    // me add effects to instruments" in so many words (FUTURE.md §2 calls it
    // the largest reversal in the file), and the declaration returns in the
    // exact shape it had before — `type: "list"`, the FX table, MAX_FX — so a
    // save from the two days it previously shipped loads with its chain
    // intact, and song.js:604's only array branch validates it unchanged.
    // The desk still drops the whole chain on a STEREO voice (audio/desk.js
    // widthKept — the renderer's insert path is mono), and since this round
    // the BOARD REFUSES the slot there with that sentence instead of letting
    // it strip in silence (FUTURE.md: "that silence becomes a
    // refusal-with-reason on the slot, never a silent strip").
    { key: "fx",   type: "list", table: FX, max: MAX_FX },
    // ...AND EACH SLOT'S WET AND ITS OWN ONE-OR-TWO SETTINGS ("Each has a wet
    // dry mix and its own settings"), keyed BY SLOT NUMBER because the slots
    // are ordered (the chain has an order — chorus on a crunched guitar is not
    // a clean chorus beside one) and a knob belongs to the seat, not to the
    // chip's name. `fxw<n>` is the chip's own `mix` param (FXWETS above);
    // `fxa<n>`/`fxb<n>` are the module's first and second face params as a
    // fraction of their own declared span (FXPOTS/FXFACE above). All nine are
    // plain enum rows, so cleanEntry, writeDesk and song.js's registry walk
    // carry them with no new machinery, and absent is the chip's declared
    // default — the byte-identical old sound.
    { key: "fxw1", table: FXWETS, labels: FXWETLABEL, default: null },
    { key: "fxw2", table: FXWETS, labels: FXWETLABEL, default: null },
    { key: "fxw3", table: FXWETS, labels: FXWETLABEL, default: null },
    { key: "fxa1", table: FXPOTS, labels: FXPOTLABEL, default: null },
    { key: "fxa2", table: FXPOTS, labels: FXPOTLABEL, default: null },
    { key: "fxa3", table: FXPOTS, labels: FXPOTLABEL, default: null },
    { key: "fxb1", table: FXPOTS, labels: FXPOTLABEL, default: null },
    { key: "fxb2", table: FXPOTS, labels: FXPOTLABEL, default: null },
    { key: "fxb3", table: FXPOTS, labels: FXPOTLABEL, default: null },
    // AND IT CAME OFF AGAIN, 2026-08-26, BY THE OWNER OF THE QUESTION. This
    // entry stood here for two days and STATE.md item 6 asked Paul to accept
    // the reversal in so many words. He answered the other way: *"Don't let me
    // add effects to instruments. That's bus and board stuff. But let me have
    // up to four buses and a way to direct them to each other."* So the
    // declaration goes and the argument stays, because the argument was not
    // wrong — it was answering the wrong question.
    //
    // WHAT IT SAID, and the half of it that is still true: "A CHIP IS BACK ON
    // THE TRACK (2026-08-24, Paul: 'we've lost the engineer entirely'). It came
    // off 2026-08-17 because a track had no other way to reach a treatment and
    // an insert costs a MULTIPLE where a bus costs a constant. BOTH HALVES OF
    // THAT CHANGED: the three sends above are wired to the parent's own returns
    // now (audio/desk.js masterState reads buses.rev.ret onto state.reverb), so
    // a SHARED treatment goes to a bus and this is only for what must be IN the
    // path — a crunch on one guitar, or `sweep`, which FXSEND above already
    // says can never be a send. Capped at MAX_FX; the desk drops it on a STEREO
    // voice by law (audio/desk.js widthKept). `type: "list"`, not a new "chips"
    // kind: song.js:601 validates a saved part entry by walking THIS list, and
    // its only array branch is `f.type === "list"` -> filterList(f, v)."
    //
    // The measurement half stands and is now the REASON THE FOURTH BUS EXISTS:
    // an insert costs a multiple and a bus costs a constant, so if a chip may
    // not sit on a track then the answer is not fewer treatments, it is MORE
    // BUSES to hang them on. `aux` below is bus 4 and it is what replaces this
    // line. What is settled and no longer arguable is WHERE a treatment lives:
    // on a bus, never on an instrument.
    //
    // NOTHING TO MIGRATE, MEASURED: zero voices in the shipped catalog carry a
    // `desk.fx` (walked over songs.js, 2026-08-26). A saved one from the two
    // days this shipped is not an error — it is a key song.js's loader (which
    // validates a part entry against this very list) no longer recognises, and
    // it is dropped on load the way any other unknown key is.
    // (the `{ key: "fx", ... }` entry is back ABOVE this tombstone as of
    // 2026-08-27 — the turn is dated and quoted there; this paragraph stays as
    // the record of the 2026-08-26 answer it reversed)
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
      // UNREACHABLE FROM ANY LIVE SONG AGAIN, 2026-08-26, and the line stays
      // for the third time. Its history in one place, because it is the record
      // of an argument that went both ways: it read "UNREACHABLE FROM ANY LIVE
      // SONG, not deleted here… nothing manufactures that input anymore; only a
      // test does" (2026-08-17), then "REACHABLE AGAIN, 2026-08-24 … this
      // branch is the ordinary path once more", and now nothing manufactures
      // the input again — PARTMIX declares no `fx`, so song.js's loader drops a
      // saved one and no surface writes one. The offline desk gate still hands
      // it a chip on purpose, which is why the clamp is kept exact rather than
      // stubbed: unknown keys drop and the list caps at MAX_FX, and
      // audio/desk.js widthKept still refuses the whole chain on a STEREO voice.
      fx: (g.fx || []).filter(k => Object.prototype.hasOwnProperty.call(FX, k)).slice(0, MAX_FX),
      rev: pick(SENDS, g.rev, 0),
      del: pick(SENDS, g.echo, 0),      // the field is `echo`, the bus is `del`
      room: pick(SENDS, g.room, 0),     // bus 3
      aux: pick(SENDS, g.aux, 0),       // bus 4, the one a track never had
      genre: pick(SENDS, g.genre, 0),   // the genre bus (series-bus round) — 0 adds nothing
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
  // MASTER TOP ceiling, both already in the parent's master stage). What
  // this file does is give those numbers NAMES a finger can choose between.
  //
  // ABSENT IS TODAY, the same law `parts` carries: a song with no `master`
  // resolves to exactly the chain graph.js has always built — glue at −22/2.2,
  // makeup ×1.4, the brickwall at −1.5, the 16 kHz ceiling — and builds not one
  // extra node. That is why there is no "off"/"flat"/"normal" entry in any table
  // below: every surface on this machine already has a way to say "back to the
  // default" — a chip toggles off, the session bank's pickers
  // carry an empty "—" (ui/chrome.js) — so an explicit off/flat/normal would be
  // a SECOND spelling of absent, and two spellings of a default is exactly what
  // song.js and audio/desk.js both spend a branch normalizing away.

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
  // `ret` WAS A MULTIPLIER on a return the WebAudio graph built for itself —
  // "each bus's base return is a tuned number (VERBSPEC per verb, the room's
  // 0.9) and a knob that replaced it would need one table per verb". THAT
  // GRAPH IS GONE. The one-engine round deleted audio/mixer.js and with it
  // every node this table multiplied, and what stands in its place is ONE
  // number in the parent's state (`state.reverb`), which nothing on this page
  // could write. So `ret` is now the RETURN ITSELF (RETURNS above), absolute,
  // and the multiplier table is retired: multiplying a return of zero by 1.6
  // is still zero, which is exactly the bug (audio/plan.js:367 `reverb: 0`).
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
  //
 // A BUS HAS A NAME, AND THE NAME IS A KNOB. "name buses" .
  // The name is stored exactly like every other bus value — `buses.<bus>.name`
  // — and it is a WORD FROM A TABLE rather than free text for a structural
  // reason, not a taste one: song.js validates a saved bus by walking this
  // row's `knobs` and refusing any value its table does not hold, so a free
  // string would be dropped on the next save. Picking from a fixed vocabulary
  // keeps the rename inside the one law this file exists to enforce, and a name
  // that survives a save is worth more than a name you can type. Absent = the
  // bus's shipped label.
  //
  // THE VOCABULARY WAS THE DESK'S RETURN NAMES AND IT WAS THE BUG, 2026-08-26.
  // The paragraph here used to end "Picking from the desk's own vocabulary of
  // RETURN NAMES keeps the rename inside the one law this file exists to
  // enforce", and that choice — plate / hall / chamber / spring / room / air /
  // delay / slap / echo / tape / wash / drive — put a COSMETIC word and a REAL
  // one side by side on the same board, spelled identically. Paul, 2026-08-26:
  // *"'name' is a very confusing row because the 'name' seems to be reverb
  // types."* He is describing a genuine collision and not a misreading:
  //   · four words — plate, hall, chamber, spring — were in BOTH this table and
  //     REVERBLABEL, so bus 1 drew two dropdowns four words apart, one of which
  //     picks a wasm module and one of which picks a nameplate;
  //   · `room` meant THREE things on one board — bus 1's `color` knob was
  //     LABELLED "room", this table offered "room" as a name, and bus 3 IS
  //     named room;
  //   · `tape` and `drive` were MASTER labels (MASTER: drive/glue/tape/space/
  //     width/tilt/ceiling), and `delay`/`echo` were bus 2's own label and key.
  // So the vocabulary is replaced with words for a bus's JOB — what you are
  // USING the return for — checked against every label table this file draws on
  // the same board (SENDLABEL, LEVELLABEL, PANLABEL, RETURNLABEL, REVERBLABEL,
  // DTLABEL, EFBLABEL, ETONELABEL, FXLABEL, DRIVE/GLUE/TAPE/SPACE/WIDTH/TILT/
  // CEILINGLABEL) and against the four BUSROWS labels themselves. Not one of the
  // twelve appears in any of them, so no word on this board can mean two things
  // again. `wet` was drafted and dropped: SENDLABEL already spells 0.62 `wet` on
  // the send row directly above.
  //
  // WHAT HAPPENS TO THE 139 SHIPPED RECORDS. All 139 carry `sound.buses`
  // (STATE.md:139) and every one of them names bus 1, because precompose.js
  // RETNAME writes a nameplate to follow the reverb colour. They are PRECOMPOSED
  // AT LOAD, not stored on disk, so RETNAME was rewritten in the same breath as
  // this table (precompose assertDeskTables would throw at boot otherwise) and
  // all 139 come up named out of the new vocabulary — nothing to migrate.
  // A record SAVED by a person before today (localStorage, a share link, an
  // exported .json) may carry `name: "plate"`, and that word is now unknown
  // here. Two readers keep it loading: song.js NOTES a retired bus name instead
  // of refusing the record, and `busNameOf` below already answers `row.label`
  // for a name no table holds. So an old save opens, plays, and shows bus 1 as
  // "reverb" — its shipped label — with the note saying the word was retired.
  const BUSNAMES = { ambience: "ambience", depth: "depth", bloom: "bloom",
                     wash: "wash", sheen: "sheen", throw: "throw",
                     lift: "lift", smash: "smash", parallel: "parallel",
                     double: "double", stack: "stack", blend: "blend" };
  // EVERY KNOB HERE NOW REACHES THE ENGINE, and the ones that could not were
  // taken off rather than left drawing. The test is audio/desk.js masterState:
  // a knob is on this table if and only if it lands in a field the parent's own
  // fxParams/reverbColor resolves.
  //   rev.ret   -> state.reverb      -> rgain = clamp(reverb*3.2, 0, 2)
  //   rev.color -> state.reverbColor -> reverb_<module>.wasm
  //   echo.time -> state.delay.beats (a fraction of a BAR here, beats there)
  //   echo.fb   -> state.delay.feedback
  //   echo.tone -> state.delay.cutoff
  // TWO OF THE FOUR BUSES HAVE AN ENGINE BUS OF THEIR OWN AND TWO DO NOT, and
  // that is the whole shape of this table. `engine` says which — it is the name
  // of the accumulator engine/faust/press/render-core.js:113 destructures and
  // engine/faust/dsp/fx_bus.dsp takes as an input — and a row without one is a
  // GROUP: a place to gather sends whose feed is summed into another bus, with
  // `to` naming which. There is no third answer and no invented one.
  //
  // WHAT THE ENGINE ACTUALLY HAS, read rather than assumed (2026-08-26):
  //   dry -> the main, and every unit's `u.dry` reaches it
  //   rev -> BUS 1. `u.rev` feeds it; `rgain = clamp(state.reverb*3.2, 0, 2)`
  //          returns it, and `buses.rev.ret` is that state field. Live, both ways.
  //   del -> BUS 2. `u.del` feeds it, and its three internal knobs (dtime/dfb/
  //          dcut) are state fields too — and since 2026-08-27 its RETURN is
  //          too: `dgain` was emitted by state-engine.js fxParams as the
  //          literal 1 ("live in, fixed out", as this line used to end), and
  //          now reads `state.delay.gain`, which `buses.echo.ret` (ERETURNS
  //          above) is. Live, both ways, same as bus 1.
  //   pp  -> not a bus this page can have. It is fed by a PER-EVENT `e.pp`
  //          stamped on drum events only (state-engine.js:2808) and NOT on
  //          sampled drums at all ("the sampler mix has no pp bus", same file),
  //          which is nearly every kit here. A fourth ENGINE bus exists and
  //          there is no word on this page that can put a signal in it.
  //
  // SO BUS 3 AND BUS 4 ARE GROUPS, and this paragraph replaces one that was
  // right about the facts and wrong about the conclusion. It read: "BUS 3 IS
  // NOT A THIRD RETURN and the board says so. The renderers carry four buses
  // {dry, rev, del, pp} and `pp` is a real ping-pong with its own time, feedback
  // and tone — but state-engine:2808 stamps `pp` on DRUM events only, so a
  // pitched voice's send is dropped by mapEvents. Wiring it means editing the
  // parent and re-running its parity gates. `room` therefore keeps its name and
  // no knob of its own: it IS the reverb bus (audio/desk.js:590 folds a part's
  // `room` into its `rev`), and pretending otherwise is the lie this round
  // exists to stop telling."
  //
  // Every fact there is still true. What was wrong is "no knob of its own". The
  // FOLD ITSELF IS A KNOB and always was — audio/desk.js chose `rev` in two
  // hard-coded places, and that choice belongs to the desk and not to the
  // engine. Making it a `to` knob is not a new wire; it is the wire that was
  // already there, with a hand on it. A group aimed at bus 2 moves every unit's
  // `del` in `__nuMix()`, which is the proof this round is gated on.
  //
  // AND THAT IS WHAT "direct them to each other" MEANS HERE (Paul, 2026-08-26).
  // A group may aim at bus 1, at bus 2, or at the OTHER GROUP — bus 4 -> bus 3
  // -> bus 2 is a real chain and it is the honest whole of what the desk can
  // route without editing the parent. `busRoute` below walks those edges and
  // REFUSES A CYCLE, which is why `busSendPlan` (deleted 2026-08-24 for having
  // no caller since the WebAudio rack went) comes back under a new name with
  // one: the moment a group can name another group, a cycle is reachable by two
  // clicks and a silent stack overflow is not an answer.
  // THE GENRE BUS'S OWN TWO VOCABULARIES (series-bus round, 2026-08-27).
  // `level` is the rack's "level → delay" slider — the gain on the genre
  // chain's return as it sums into the delay bus. In the RETURN's own linear
  // units (the engine multiplies the summed buffer by it, stream-renderer /
  // press, the same arithmetic both); `even` is pinned at 1.0 exactly because
  // 1 is what the engine applies when the knob was never touched (absent =
  // null = 1). The chips are the box's own FX vocabulary, one word per slot,
  // so the chain a genre deals at compose time and the chain a hand edits
  // here are the same twelve chips — no second effects vocabulary.
  const GLEVELS = { off: 0, low: 0.5, even: 1, hot: 1.5, blown: 2 };
  const GLEVELLABEL = { off: "off", low: "pulled back", even: "as sent",
                        hot: "hot", blown: "blown" };
  const GXCHIPS = {};
  for (const k of Object.keys(FX)) GXCHIPS[k] = k;
  const BUSROWS = [
    { bus: "rev",  label: "reverb", engine: "rev",
      feed: "fed by the reverb sends", eq: BUS_EQ_BANDS,
      knobs: [
        { key: "ret",   label: "return", table: RETURNS, labels: RETURNLABEL, default: null },
        // LABELLED "reverb type" AND NOT "room", 2026-08-26. This knob picks the
        // wasm module the return runs (REVERBS: dattorro / fdn / greyhole /
        // spring / shimmer) and it was labelled `room` since the day it was
        // written, which made `room` mean three different things on one board:
        // this knob, the old BUSNAMES entry, and bus 3, which IS named room.
        // Paul, 2026-08-26: *"'name' is a very confusing row because the 'name'
        // seems to be reverb types."* The name row was half of that; this label
        // was the other half. "reverb type" cannot be misread as a place.
        { key: "color", label: "reverb type", table: REVERBS, labels: REVERBLABEL, default: null } ] },
    { bus: "echo", label: "delay",  engine: "del",
      feed: "fed by the echo sends", eq: BUS_EQ_BANDS,
      knobs: [
        // `ret` REACHES dgain (2026-08-27) — see ERETURNS above. Same shape as
        // rev's row: same words, absolute return, null = as the engine ships.
        { key: "ret",  label: "return",  table: ERETURNS, labels: RETURNLABEL, default: null },
        { key: "time", label: "time",    table: DTIMES,  labels: DTLABEL,     default: null },
        { key: "fb",   label: "repeats", table: EFBS,    labels: EFBLABEL,    default: null },
        { key: "tone", label: "tone",    table: ETONES,  labels: ETONELABEL,  default: null },
        // `bleed` REACHES the DSP (2026-08-27, series-bus round) — see EBLEEDS
        // above: the delay->reverb feed was the literal `d*0.2` and is a
        // slider now. Absent = null = the shipped 0.2, byte-identical.
        { key: "bleed", label: "bleed",  table: EBLEEDS, labels: EBLEEDLABEL, default: null } ] },
    // THE TWO GROUPS. `room` keeps its name and its saved sends — a record
    // written when bus 3 was "the kit's ambience folded into bus 1" loads with
    // its `room` sends intact and finds that the fold now has a knob whose
    // ABSENT VALUE IS THE FOLD IT ALWAYS HAD. That is the absent-is-today law
    // applied to a route rather than to a level, and it is why `to` defaults to
    // null and `busRoute` resolves null to bus 1.
    // BUS 3 KEEPS THE NAME `room` and this is not sentiment. Its SECTION lane
    // still is the kit's ambience — audio/desk.js scopes `sec.room` to the drums
    // and says why — and 139 shipped records read that word on their send rows.
    // What changed is not what bus 3 carries, it is that where it lands stopped
    // being a constant. Bus 4 is new and has no such history, so it is called
    // what it is.
    { bus: "room", label: "room", engine: null,
      feed: "the kit's ambience, and a group — its sends land where it is aimed",
      eq: BUS_EQ_BANDS, knobs: [] },
    { bus: "aux",  label: "group", engine: null,
      feed: "a group — its sends land wherever it is aimed",
      eq: BUS_EQ_BANDS, knobs: [] },
    // THE GENRE BUS, 2026-08-27 (Paul: "one bus for genre specific effects,
    // into a delay bus, into reverb, into main"). A FIFTH engine accumulator —
    // real, not a group: every strip's `genre` send (PARTMIX above) feeds it,
    // its chain (up to three chips, the box's own FX vocabulary — dealt by
    // extraction from the genre's fx at compose time, edited here) runs over
    // the summed feed, and the result times `level` SUMS INTO THE DELAY BUS.
    // Where it goes is the SERIES and not a choice, so it has an `engine` tag
    // (no `to` knob is spliced on) — but it is deliberately NOT in BUSTO
    // below: a group aimed "at the genre bus" would be a route the engine
    // does not have (groups fold to rev/del), and the four buses keep their
    // positional names. APPENDED last for the same reason: "bus 1".."bus 4"
    // are printed on 139 shipped records' boards and must not renumber.
    // Absent everything = the stage never runs = byte-identical.
    { bus: "genre", label: "genre fx", engine: "genre",
      feed: "fed by the strips' genre sends; its return sums into the delay bus",
      eq: BUS_EQ_BANDS,
      knobs: [
        { key: "level", label: "level", table: GLEVELS, labels: GLEVELLABEL, default: null },
        { key: "fx1", label: "chip 1", table: GXCHIPS, labels: FXLABEL, default: null },
        { key: "fx2", label: "chip 2", table: GXCHIPS, labels: FXLABEL, default: null },
        { key: "fx3", label: "chip 3", table: GXCHIPS, labels: FXLABEL, default: null } ] },
  ];
  // WHERE A GROUP MAY BE AIMED — every bus but itself, and the labels are
  // POSITIONAL ("bus 1") because that is what the board's column heads say and
  // a group's destination is read against the board, not against a name a
  // record may have renamed. Derived from BUSROWS so a fifth bus would appear
  // here by existing.
  const BUSTO = {};
  // ...every bus but the GENRE bus (series-bus round): the genre stage's
  // destination is the series (its return sums into the delay bus, in the
  // engine) and it takes no group feed — aiming a group at it would draw a
  // route the renderers do not have. It sits last in BUSROWS, so the four
  // shipped positional names stay "bus 1".."bus 4".
  BUSROWS.forEach((r, i) => { if (r.bus !== "genre") BUSTO[r.bus] = "bus " + (i + 1); });
  // the name knob is spliced onto every row from ONE place, so a fourth bus
  // would inherit it by existing rather than by being remembered — and so
  // song.js/resolveBuses/busesIsDefault pick it up with no edit at all (they
  // all walk `knobs`).
  //
  // THE TWO CROSS-SENDS CAME OFF, 2026-08-24. The paragraph that stood here
  // said they were spliced on "so a fourth bus would inherit them", and it was
  // right about the mechanism and wrong about the world: `x<bus>` was written
  // against a WebAudio bus rack that the one-engine round deleted, so there has
  // been nothing to wire an edge INTO since — and busSendPlan, the cycle
  // refusal that made them safe, has had no caller since the same round
  // (grepped across nukernel/, engine/ and scratch/: zero). A knob that cannot
  // reach the sound is the thing this file exists to prevent, so it is gone
  // rather than drawn. Delay-into-the-plate is the oldest trick on a desk and
  // it comes back the day the parent's own bus graph can take an edge.
  //
  // THE ROW IS CALLED `called`, NOT `name`, 2026-08-26. The key stays `name` —
  // it is what 139 precomposed records and every save on disk already write, and
  // renaming a stored key to fix a printed word is how a record stops loading —
  // but the LABEL the board prints over the row is now `called`. Paul,
  // 2026-08-26: *"'name' is a very confusing row because the 'name' seems to be
  // reverb types."* On bus 1 the row sat directly above a knob labelled `room`
  // whose menu was REVERBLABEL, and this row's own menu shared four words with
  // it (plate/hall/chamber/spring), so "name" read as "which reverb". BUSNAMES
  // above answers the second half by changing the words; this answers the first
  // by changing the question the row asks. "called" can only be read one way:
  // it is what the bus is CALLED, and nothing on a desk is called by an effect.
  const BUSES = BUSROWS.map(r => ({ ...r, knobs: [
    { key: "name", label: "called", table: BUSNAMES, labels: BUSNAMES, default: null },
    // ...AND `to` ON A GROUP AND ONLY ON A GROUP. Bus 1 and bus 2 have an
    // engine bus, so where they go is the ENGINE's answer and not a choice
    // (fx_bus.dsp mixes both into the master and the two cross-sends inside it
    // — `d*0.2`, `(ppl+ppr)*0.12` — are LITERALS in the DSP). Drawing a `to`
    // on them would be the knob-that-lies this file exists to prevent. A group
    // has no engine bus, so `to` is the only thing it is.
    ...(r.engine ? [] : [{ key: "to", label: "goes to", table: BUSTO,
                           labels: BUSTO, default: null }]),
    ...r.knobs,
  ] }));
  // ---- WHERE EVERY BUS'S FEED FINALLY LANDS, cycles refused ---------------
  // ONE RESOLVER, because three readers ask it: audio/desk.js (twice — the
  // composed channel base AND the unit table, and a drift between those two is
  // the board showing one number while the tape carries another),
  // ui/engineer.js (the `goes to` row and the greying of a group's own name in
  // its own menu) and desk-gate. It answers, per bus:
  //   engine  the accumulator its feed reaches — "rev" or "del" — after
  //           following every `to` edge; null only if a cycle ate it
  //   chain   the buses walked to get there, for printing the route
  //   cycle   true if the edges close on themselves
  //
  // A CYCLE IS REFUSED AND NOT BROKEN. bus 3 -> bus 4 -> bus 3 is two clicks
  // away and there is no arithmetic that makes it mean something: the feed
  // would be summed into itself forever. The refusal is to fall back to the
  // bus's SHIPPED destination (bus 1, which is what the fold has always been)
  // and to say so — `cycle` is true, the board greys the option that would
  // close the loop with the reason printed, and no number silently changes.
  // The alternative, letting the option be chosen and clamping the walk, would
  // put a route on the page that the tape does not have.
  // THE FOLD A GROUP HAS ALWAYS HAD, and it is derived as "the first bus that
  // has an engine bus" rather than as BUSROWS[0]. Those are the same row today
  // and the difference is what happens on the day somebody reorders this table:
  // a group falling back to another GROUP is a fallback that can itself loop,
  // and `busRoute` would answer `engine: null` — a route to nowhere, which is
  // the one thing a refusal must never produce.
  const BUSDEFAULT = (BUSROWS.find(r => r.engine) || BUSROWS[0]).bus;
  function busRoute(v) {
    const g = v && typeof v === "object" ? v : {};
    const out = {};
    for (const b of BUSES) {
      if (b.engine) { out[b.bus] = { engine: b.engine, chain: [b.bus], cycle: false }; continue; }
      const chain = [b.bus];
      const seen = new Set([b.bus]);
      let at = b.bus, cycle = false;
      for (;;) {
        const row = BUSBY[at];
        if (row && row.engine) break;
        const e = g[at] && typeof g[at] === "object" ? g[at] : {};
        const nxt = Object.prototype.hasOwnProperty.call(BUSTO, String(e.to)) && e.to !== at
          ? String(e.to) : BUSDEFAULT;
        if (seen.has(nxt)) { cycle = true; break; }
        seen.add(nxt); chain.push(nxt); at = nxt;
      }
      out[b.bus] = cycle
        ? { engine: BUSBY[BUSDEFAULT].engine, chain: [b.bus, BUSDEFAULT], cycle: true }
        : { engine: BUSBY[at].engine, chain, cycle: false };
    }
    return out;
  }
  // may this group be aimed at `dest` without closing a loop? — the ONE
  // predicate the board greys with, asked of the value that would be written
  // rather than of the value that is (fields.js law: a refusal is measured on
  // the move, not guessed from the state).
  function busToOk(v, bus, dest) {
    if (bus === dest) return false;
    // only a bus BUSTO names may be aimed at — the genre bus has an engine
    // tag but is deliberately not a group target (see BUSTO above)
    if (!Object.prototype.hasOwnProperty.call(BUSTO, dest)) return false;
    if (BUSBY[dest] && BUSBY[dest].engine) return true;
    const next = { ...(v || {}) };
    next[bus] = { ...(next[bus] || {}), to: dest };
    return !busRoute(next)[bus].cycle;
  }
  // what a bus is CALLED right now — the set name, else its shipped label.
  // One reader for the board's nameplate and one for the send bars that name
  // their destination, so a renamed bus is renamed everywhere at once.
  // A WORD BUSNAMES NO LONGER HOLDS FALLS BACK TO THE ROW'S LABEL rather than
  // printing blank, and that is load-bearing since 2026-08-26 rather than merely
  // defensive: the vocabulary was replaced whole that day (see BUSNAMES), so a
  // record saved with `name: "plate"` reaches this reader with a word the table
  // has no entry for. `(set && BUSNAMES[set]) || row.label` answers "reverb",
  // which is exactly what the bus is called when nobody has renamed it — the
  // same answer the empty detent gives. Same law as resolvePartMix: "words no
  // table names resolve to the default".
  const busNameOf = (v, bus) => {
    const row = BUSES.find(b => b.bus === bus);
    if (!row) return String(bus);
    const set = v && v[bus] && v[bus].name;
    return (set && BUSNAMES[set]) || row.label;
  };
  const BUSBY = {};
  for (const b of BUSES) BUSBY[b.bus] = b;
  // ONE SPEC -> ENGINE VALUES, resolveMaster's shape: every knob resolves to
  // its number or to null, and null is "the engine's own value, untouched".
  //
  // `ret` NO LONGER DEFAULTS TO 1. The line here read
  // `r[k.key] = k.key === "ret" ? (val == null ? 1 : val) : val`, because `ret`
  // used to be a multiplier on a WebAudio return and 1 was "as built". It is an
  // absolute return now (RETURNS above), so a defaulted 1 would mean "as wet as
  // a bus can go" on every song that never touched the rack. null means the
  // master's `space` bleed, or nothing — which is today.
  function resolveBuses(v) {
    const g = v && typeof v === "object" ? v : {};
    const pick = (tbl, x) =>
      (x != null && Object.prototype.hasOwnProperty.call(tbl, String(x))) ? tbl[x] : null;
    const out = {};
    for (const b of BUSES) {
      const e = g[b.bus] && typeof g[b.bus] === "object" ? g[b.bus] : {};
      const r = {};
      for (const k of b.knobs) {
        r[k.key] = pick(k.table, e[k.key]);
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
  // pass (audio/desk.js deskAmp folds it per note) and rendered identically by the
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
  // ...and the four the BAND PAGE has always said and this table never knew
  // (2026-08-22, "the boxes are real"). `build`, `break`, `head` and `tag`
  // are role words band-kit has used since the dance and jazz forms landed;
  // the page pushed its boxes straight into SONG, so a document carrying
  // one was refused by a loader that never saw it — a seam that only stayed
  // quiet because no hand could build those shapes one box at a time. It
  // can now. (`break` and `breakdown` are the same section under two
  // vocabularies: a twelve-inch says one, the composer says the other, and
  // both are legal names for a box rather than one being renamed.)
  // ...AND THE THREE THE STRIP READ AS VOICES. Paul, 2026-08-24, looking at a
  // precomposed reggae record: "so it's weird it opens with '1 drums' and goes
  // into '2 intro' ... what's the plan?" MEASURED on genreToDocument("reggae",
  // 1), the strip said `bass | groove | intro | verse | …` — the first two
  // words are section names that happen to be spelled like the two voices
  // sitting in the band's tabs, so a numbered list of sections read as a
  // numbered list of players.
  //
  // THE KEY IS RIGHT AND THE WORD WAS WRONG, which is why only the value moves.
  // These three ARE roles to everything that reasons about them: compose.js:36
  // BEDS keys off them ("a bed is a layer, not a section"), ui/derive.js:618
  // TEMPOROLE gives each one the song's own tempo, song.js validates a box's
  // role against these KEYS, and a stored record names them. Renaming the key
  // would invalidate every document on disk to fix a caption. The value in this
  // table is the CAPTION — `labels: ROLES` on the role row below, `opts(keys,
  // ROLES)` in avail.js:490, `ROLES[s2.role]` in ui/eight.js:1769 — so three
  // strings here are the whole fix and every reader gets it at once.
  //
  // WHAT THE WORDS SAY. compose.js:182 describes what it built: "the layered
  // BEDS (drums, then bass, then the tune — an ARRANGEMENT, one section per
  // layer)". `drums` is the opening bars with the drummer alone, `bass` the
  // same with the bass alone, and `groove` is the layer where the OTHER half
  // of the rhythm section joins it (compose.js:609-612 pushes it after either
  // one). Said as what is PLAYING, none of the three can be mistaken for a
  // player, and the strip now opens `bass alone | drums & bass | intro | verse`.
  //
  // AND THEY ARE THIS PAGE'S OWN WORDS ALREADY. INLABEL, ninety lines up, has
  // called a drums-first opening "drums alone" and a bass-first one "bass
  // first" since the intro widening — the same musical event, said on the
  // section's EDGE chip instead of on the section. Two surfaces agreeing is
  // the point of a vocabulary; it is not a collision, because no box ever
  // offers both (a bed carries no intro edge, and the head intro that does is
  // a different box).
  const ROLES = { drums: "drums alone", bass: "bass alone", groove: "drums & bass",
                  intro: "intro", verse: "verse", chorus: "chorus",
                  bridge: "bridge", breakdown: "breakdown", drop: "drop",
                  solo: "solo", outro: "outro",
                  build: "build", break: "break", head: "head", tag: "tag" };

 // THE INSTRUMENT CHOICES : the union of
  // every sampled instrument the genre table itself plays — 48 ids, every one
  // a SAMPLERS id the coverage gate already proves real, so a pick here can
  // never name a sound the page cannot fetch. Since "the band is hired for the
  // record" this is the POOL's vocabulary, not a layer field's: the song
  // carries one instrument per CHAIR (POOLCHAIRS below, ui/state.js POOL) and
  // no section surface offers an instrument at all. Set, a chair's pick
  // replaces what every voice seated in that chair plays, song-wide (and mutes
  // a signature synth — you asked for a rhodes, not a 303 wearing one); unset,
  // the genre's own `instr` answers, which is why absent is null like every
  // other enum. The label is the id said as words — the same honest naming the
  // mix desk's second line uses.
  const INSTRCHOICES = {};
  {
    const ids = new Set();
    for (const g of Object.values(NG.GENRES)) {
      const e = g && g.instr;
      if (e) for (const id of (Array.isArray(e) ? e : [e])) ids.add(id);
    }
    // ...plus the BASS CHAIR'S OWN DEFAULT. No anchor names the upright in
    // its `instr` — it is the instrument every bass line lands on when the
    // pool says nothing (instruments.js BASS_INSTR, audio/plan.js) — and
    // since the bass player can now pick it up BY NAME (bass-kit.js "an
    // upright bass", 2026-08-21) the pool must offer what the word casts.
    // The id is spelled here rather than imported because instruments.js
    // sits a layer ABOVE this file in the graph; the bass-kit gate holds the
    // word to this pool, and the register gate proves the id resolves.
    ids.add("acoustic_bass");
    // ...and the TWO GUITARS THE RACK REACHED PAST THE CATALOG (2026-08-22,
    // "give me lots more guitar options"). Same case as the upright above and
    // for the same reason: a chair can now pick them up BY NAME (guitar-kit.js
    // "harmonics" and "a re-amped DI"), and the pool must offer what a word
    // casts. Both are real SAMPLERS ids with zones on disk — `guitar_harmonics`
    // is a recording of a touched node, which no plectrum model can fake, and
    // `di_guitar` is the FreePats direct pickup, played through the staged amp
    // instruments.js SAMPLED_INSERTS declares for it. No genre in genres.js
    // names either, which is exactly why they were unreachable; the guitar-kit
    // gate holds the chair's words against THIS list rather than against a grep
    // of the catalog, which was only ever a proxy for it.
    ids.add("guitar_harmonics"); ids.add("di_guitar");
    // ...and THE REST OF THE RACKS, on the same law and for the same reason
    // (2026-08-23, "give me all choices for keys and all instruments and
    // kits"). Opening the keys, bass and voice racks let a chair claim
    // twenty-one more ids BY NAME; the pool must offer what a word casts, or
    // the chair's pick has nowhere to land. Every one is a real SAMPLERS id
    // with zones on disk or a patch recipe, every one carries an
    // instruments.js RANGES row, and no catalog genre names any of them —
    // which is exactly why they were unreachable. The three chairs' gates
    // hold their words against THIS list.
    for (const id of ["celesta", "glockenspiel", "vibraphone", "marimba",
                      "xylophone", "tubular_bells", "music_box",
                      "electric_piano", "reed_organ", "accordion",
                      "metal_pad", "synth_strings_2", "pizzicato_strings",
                      "space_voice",
                      "fretless_bass", "slap_bass", "pop_bass", "contrabass",
                      "synth_bass_1", "synth_bass_2"]) ids.add(id);
    for (const id of [...ids].sort()) INSTRCHOICES[id] = id.replace(/_/g, " ");
  }
  // THE POOL CHAIRS — which seats the song's INSTRUMENT POOL may cast. They
  // are the kernel's own role names (PARTS above), because a chair is what the
  // scheduler and the mixer already key on: every pitched voice answers to one
  // of the seven roles (chairKeys' law — an unknown role is `line`), and the
  // bass is the one non-roster part that plays a sampled instrument. `drums`
  // is deliberately absent: the kit is a kit, chosen by the rhythm cell, not
  // an instrument id. Ordered the way a band is introduced.
  const POOLCHAIRS = ["lead", "line", "riff", "counter", "pad", "stab",
                     "drone", "bass"];

  // (there is no `sing` field here any more, and no resolveSing beside the
 // other resolvers: the singer was pulled out whole on 2026-08-17 — see the
  // tombstone in kernel-daw.html. A `sing` left on an older save is not in
  // FIELDS, so song.js's loader never looks at it and nothing reads it: an
  // old song opens as itself, minus a voice.)

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
  //   axis    WHICH OF THE EIGHT this control belongs to (nukernel/AXES.md),
  //           for a page laid out by axis rather than by palette tab:
  //           "form" | "development" | "performance". Absent = not an axis
  //           control, which is most rows — the palette tabs are a different
  //           cut through the same registry and both stay true.
  //   ask     THE QUESTION A WORKING MUSICIAN WOULD SAY OUT LOUD, and the
  //           <legend> of the sheet. `group` above names the heading; this is
  //           the sentence under it. Harvested from band-kit.js sectionAsks
  //           and askable.js, not written fresh (PLAN.md Phase 2: "would
  //           Mancini ask it this way? MacKaye? Glasper?").
  //   none    the word for SAYING NOTHING — the label on the option that
  //           writes null. Absent-is-today has to be a thing you can choose
  //           your way back to, and "straight through" is what band-kit
  //           (:5195) already called it.
  const FIELDS = [
    { key: "ops",     scope: "layer", type: "list", table: OPS, labels: OPLABEL,
      tab: "line",   group: "pattern",                 default: [] },
    { key: "role",    scope: "box",   table: ROLES,    labels: ROLES,
      tab: "sound",  group: "section",                 default: null },
    { key: "mode",    scope: "box",   table: KEYMODES, labels: KEYMODELABEL,
      tab: "sound",  group: "key",                     default: null },
    { key: "rate",    scope: "box",   table: RATES,    labels: RATELABEL,
      tab: "sound",  group: "tempo",                   default: null },
    { key: "artic",   scope: "layer", table: ARTICS,   labels: ARTICS,
      tab: "sound",  group: "articulation",            default: null },
    // THE BASS HAS A REGISTER TOO. The line's `oct` never reached it — the
    // bass renders at its own fixed octave in kernel.js — so "make bass an
    // octave higher" moved every line and left the bass where it was
    // (2026-08-19). Box scope, because the bass is the box's, not a layer's.
    { key: "boct",    scope: "box",   table: OCTAVES,  labels: OCTAVES,
      tab: "voice",   group: "register",                default: null },
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
    // the box's THIRD send, so the section strip speaks the same three-bus
    // sentence its own tracks do (PARTMIX `room` above has the law)
    { key: "room",    scope: "box",   table: SENDS,    labels: SENDLABEL,
      tab: "fx",     group: "room",                    default: null },
    { key: "lvl",     scope: "box",   table: LEVELS,   labels: LEVELLABEL,
      tab: "fx",     group: "level",                   default: null,
      axis: "form", ask: "where does it sit?", none: "leave it alone" },
    { key: "pan",     scope: "box",   table: PANS,     labels: PANLABEL,
      tab: "fx",     group: "place",                   default: null },
    { key: "intro",   scope: "box",   table: INLABEL,  labels: INLABEL,
      tab: "move",   group: "intro",                   default: null,
      axis: "form", ask: "how do we get into it?", none: "straight in" },
    { key: "outro",   scope: "box",   table: OUTLABEL, labels: OUTLABEL,
      tab: "move",   group: "outro",                   default: null,
      axis: "form", ask: "how do we get out of it?", none: "straight through" },
    { key: "env",     scope: "box",   table: ENVLABEL, labels: ENVLABEL,
      tab: "move",   group: "level over the section",  default: null,
      axis: "form", ask: "what does it do over the section?", none: "level" },
    { key: "mot",     scope: "box",   table: MOTLABEL, labels: MOTLABEL,
      tab: "move",   group: "filter over the section", default: null,
      axis: "form", ask: "the filter over it?", none: "no movement" },
    // the window onto the genre's form — numeric, clamped rather than rejected
    { key: "len",     scope: "box",   type: "int", min: 1, max: MAX_LEN,
      tab: "song",   group: "length",                  default: 4 },
    // THE ONE FORM NUDGE THAT IS A NUMBER ON A LINE, not a word from a list:
    // ui/derive.js:396 reads it as "start this section n bars into the phrase",
    // which is how a chorus comes in on the second half of the tune. It carries
    // `axis` like its neighbours and no `none`, because a slider's absence is 0.
    { key: "nudge",   scope: "box",   type: "int", min: 0, max: MAX_NUDGE,
      tab: "song",   group: "nudge",                   default: 0,
      axis: "form", ask: "how far into the tune does it start?" },
    // ---- the composition-depth surface (P4) — appended, never reordered ----
    { key: "key",     scope: "box",   table: KEYS,        labels: KEYLABEL,
      tab: "sound",  group: "key",                     default: null },
    { key: "prog",    scope: "box",   table: PROGCHOICES, labels: PROGLABEL,
      tab: "sound",  group: "progression",             default: null },
    { key: "period",  scope: "box",   table: PERIODS,     labels: PERIODLABEL,
      tab: "sound",  group: "sentence",                default: null,
      axis: "development", ask: "and bar by bar?", none: "the genre's own" },
    { key: "breath",  scope: "box",   table: BREATHS,     labels: BREATHLABEL,
      tab: "line",   group: "breath",                  default: null,
      axis: "development", ask: "how long may the notes be?",
      none: "as long as they like" },
    { key: "pipe",    scope: "box",   table: PIPESETS,    labels: PIPELABEL,
      tab: "line",   group: "pipe",                    default: null,
      axis: "development", ask: "what happens to it after it's played?",
      none: "nothing" },
    { key: "part",    scope: "layer", table: PARTCHOICES, labels: PARTCHOICES,
      tab: "voice",  group: "part",                    default: null },
    // `parts` is the PER-PART MIX: a map of chair key -> {rev, echo, room,
    // lvl, pan, mute, solo, fader, eq}, each sub-field drawn from PARTMIX
    // above — three sends and nothing else, no insert. Type "parts"
    // because it is neither an enum nor a flat list — song.js validates the
    // map shape, exactly as it does the `vox` object and the `auto` entries.
    // Absent (the default) is the whole of today: audio/desk.js writes no
    // sub-bus at all and every voice lands on the section input as before.
    { key: "parts",   scope: "box",   type: "parts", table: PARTNAMES,
      labels: PARTLABEL, tab: "fx", group: "per part", default: null },
    // `auto` is a LIST whose real entries are {param, points, curve} objects;
    // a bare param string is legal (and inert) so the registry's exhaustive
    // toggle can exercise the table like any other list field. song.js owns
    // the object-shape validation.
    { key: "auto",    scope: "box",   type: "list", table: AUTOPARAMS,
      labels: AUTOPARAMLABEL, tab: "fx", group: "automation", default: [] },
    // (the `sing` chip lived here — appended after `auto`, ahead of the board
 // — and came out with the singer on 2026-08-17. Nothing took its slot: the
    // rule is still append, never reorder.)
 // ---- the board — appended, never reordered ----------------
    // the SECTION strip's fader offset, the same dB-over-the-automated-value
    // law as PARTMIX `fader` (see the note there): it multiplies the channel's
    // resolved `lvl` in audio/desk.js sectionOf, so the enum level, the
    // composer's arc and a level automation all keep meaning what they meant.
    { key: "fader",   scope: "box",   type: "num", min: -24, max: 12,
      tab: "fx",     group: "fader",                     default: null },
    // the SECTION strip's EQ (EQ_BANDS): the same three knobs the part strips
    // carry, on the box's own field — the PARTMIX `eq` note has the law
    { key: "eq",      scope: "box",   type: "eq", bands: EQ_BANDS,
      tab: "fx",     group: "strip eq",                  default: null },
    // (no `instr` entry: the instrument is the SONG's — one pool per record,
    // one pick per chair — not a section or layer field. See INSTRCHOICES /
    // POOLCHAIRS above; ui/state.js POOL carries it, song.js validates it and
    // migrate() lifts old per-layer overrides up to it.)
    // ---- the fourth bus — appended, never reordered ---------------------
    // The SECTION strip's bus-4 send, so the box speaks the same four-bus
    // sentence its own tracks do — the law the `room` entry above states, one
    // bus along. It sits at the END of this list and not beside `room` because
    // FIELDS is append-only: song.js and the interview both index it, and
    // moving a row to read better renumbers everything under it.
    { key: "aux",     scope: "box",   table: SENDS,    labels: SENDLABEL,
      tab: "fx",     group: "bus 4",                     default: null },
  ];
  const FIELD = {};
  for (const f of FIELDS) FIELD[f.key] = f;

  /* ---------- THE NUDGES (D7) ----------------------------------------------
     (Paul, 2026-08-24: "we had lots of fun nudges to the music and motifs —
     like arching.")

     Four of these were already implemented end to end and NONE of them was
     reachable: ui/derive.js:526 reads `sec.env`, `sec.intro`, `sec.outro`,
     `sec.period`, `sec.pipe`, `sec.breath` and `sec.nudge` off every box,
     song.js:172 already defaults every one of them to null on emptyBox(), and
     the page had never written into any of them. This is the list of what to
     offer; the pipe was connected the whole time.

     THE REGISTRY IS THE ONLY LIST. A row that grows an `axis` above appears on
     the page with no edit here and none in the view — interview.js's law
     ("every question knows what heading it lives under") one layer down. */
  // one option list, from a row's own label table, with "say nothing" first
  const nudgeOpts = (f) => [
    { value: "", label: f.none == null ? "nothing" : f.none },
    ...Object.keys(f.labels || f.table || {}).map((k) => ({
      value: k, label: (f.labels || {})[k] == null ? k : f.labels[k] })),
  ];
  // THE PERFORMANCE ROWS ARE ASKABLE'S ROWS. Their values are a number (stress,
  // phrase) or a whole policy object (orn — kernel.js:894 ORN), so the OPTION
  // VALUE is the WORD and `nudgeValue` maps it back; a radio's value is a
  // string and `{grace: 0.4, …}` is not one. The word is also what a saved
  // session prints, which is askable.js's own habit (band-kit knobs.__said).
  const PERFROWS = ["stress", "phrase", "orn"];
  const perfRow = (field) => {
    const r = (NA && NA.ASKABLE || []).find((x) => x.field === field);
    if (!r) return null;
    return { key: field, axis: "performance", scope: "song",
             // `default` is the word for "say nothing here" everywhere on this
             // page now — Paul, 2026-08-26: *"'the record's own' -- make that
             // 'default'."* These three (stress / phrase / orn) are the same
             // option as every other absent-is-today menu and were the same
             // phrase; `none` and the `""` label are one string said twice and
             // must not drift apart.
             ask: r.ask, group: r.head, none: "default",
             options: [{ value: "", label: "default" },
                       ...r.opts.map(([w]) => ({ value: w, label: w }))] };
  };
  /** Every axis control for one axis, in REGISTRY order.
   *  -> [{ key, axis, scope, ask, group, none, options? , type?, min?, max? }] */
  function nudgesFor(axis) {
    if (axis === "performance") return PERFROWS.map(perfRow).filter(Boolean);
    return FIELDS.filter((f) => f.axis === axis).map((f) => ({
      key: f.key, axis: f.axis, scope: "section", ask: f.ask,
      group: f.group, none: f.none,
      ...(f.type === "int" ? { type: "int", min: f.min, max: f.max }
                           : { options: nudgeOpts(f) }) }));
  }
  /** The value a performance WORD names — askable.js's own `valueOf`, so the
   *  number that reaches the kernel is the number askable.js wrote down. */
  const nudgeValue = (field, word) => {
    const r = (NA && NA.ASKABLE || []).find((x) => x.field === field);
    return r && word !== "" ? NA.valueOf(r, word) : null;
  };
  /** ...and back: which word a document's value is currently saying. Compared
   *  by JSON because an `orn` policy is an object and two of them are equal
   *  when they say the same thing, not when they are the same object. */
  const nudgeWord = (field, value) => {
    if (value == null) return "";
    const r = (NA && NA.ASKABLE || []).find((x) => x.field === field);
    if (!r) return "";
    const j = JSON.stringify(value);
    const hit = r.opts.find((o) => JSON.stringify(o[1]) === j);
    return hit ? hit[0] : "";
  };

  /** GREY IT, AND SAY WHY. Stamps `disabled`/`quiet`/`why` onto one already-
   *  built option object, from NUDGEGATE above. `A` is nukernel/avail.js —
   *  handed in rather than required, because avail.js requires THIS file and a
   *  cycle is not a dependency, it is a load-order accident waiting to happen.
   *  Mutates and returns `out`, which is what lets the one call site sit inside
   *  avail.js optionsFor's own map and leave the standing-answer rule
   *  underneath it ("you can always see the word you are on") untouched. */
  function nudgeGate(field, value, feats, out, A) {
    const row = (NUDGEGATE[field] || {})[value];
    if (!row || !A) return out;
    // THE ONE FACT avail.js docFeatures DOES NOT PUBLISH, derived here because
    // the rule language reads booleans only: `section.bars` is a number and
    // `{rule:"when", eq:…}` cannot be negated, so "not a one-bar section"
    // could not be written down at all. One line, and `drop` stops being
    // offered where it would delete the whole section.
    const f = { ...feats, "section.oneBar": ((feats || {})["section.bars"] | 0) === 1 };
    if (row.rule && A.evalRule(row.rule, f) === false) {
      out.disabled = true;
      out.why = A.whyOf(row.rule, f) || "the record does not allow it here";
    } else if (row.inert && A.evalRule(row.inert, f) === true) {
      out.quiet = true;
      out.why = row.inert.why || A.whyOf(row.inert, f) || "it would sound the same here";
    }
    return out;
  }

  const api = { NSLOTS, MAX_LEN, MAX_NUDGE, MAX_FX,
                OPS, OPLABEL, ENVLABEL, MOTLABEL, INLABEL, OUTLABEL,
                RATES, RATELABEL, SWINGS, SWINGLABEL, GROOVELABEL, METERLABEL,
                KITLABEL, KITNAME, VERBLABEL, DRUMKITS, DRUMLANES, BASSOPS,
                FX, FXLABEL, fxChain, FXSEND, fxMix, fxSendable,
                FXWETS, FXWETLABEL, FXPOTS, FXPOTLABEL, FXFACE,
                fxHasMix, fxChainFor,
                TRIMS, TRIMLABEL, trimApply,
                SENDS, SENDLABEL, VERBS,
                DTIMES, DTLABEL, LEVELS, LEVELLABEL, PANS, PANLABEL,
                RETURNS, RETURNLABEL, ERETURNS, REVERBS, REVERBLABEL,
                EBLEEDS, EBLEEDLABEL, GLEVELS, GLEVELLABEL, GXCHIPS,
                VOX, VOXPARAM, OCTAVES, ARTICS, CMODES, CLAMPS, CLAMPLABEL,
                KEYS, KEYLABEL, KEYNAMES, wrapKey, KEYMODES, KEYMODELABEL,
                FIFTHS, relMinorOf, RELMINNAME, minorish,
                PROGCHOICES, PROGLABEL, PERIODS, PERIODLABEL,
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
                BUSNAMES, busNameOf, BUSTO, BUSDEFAULT, busRoute, busToOk,
                AUTOPARAMS, AUTOPARAMLABEL, AUTOSHAPES, AUTOSHAPELABEL, autoShape,
                INSTRCHOICES, POOLCHAIRS,
                NUDGEGATE, nudgesFor, nudgeGate, nudgeValue, nudgeWord,
                ROLES, FIELDS, FIELD };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuFields = api;
})(typeof window !== "undefined" ? window : globalThis);
