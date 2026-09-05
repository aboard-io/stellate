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
          transpose, complement, crossmap, excerpt, only, slide, KITOPS, LANES, MODE } = K;
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

  /* ---------- THE TEMPO FENCE (2026-09-02) ------------------------------
     ONE OWNER FOR "WHAT IS A TEMPO". It was the literal pair `70` and `160`
     in four places — compose.js's throw, compose.js's post-jitter clamp,
     song.js's save door and rules.js's slider — plus a SLIDER and a TAP
     TEMPO on the page that had allowed 40..220 the whole time. Four literals
     is how two of them come to disagree, and they already did: a hand could
     tap 175, watch the readout take it, and then reopen the share link at
     the fence.

     THE NUMBERS MOVED, AND THAT IS A DATED REVERSAL of compose.js's own
     sentence ("the dial bottoms at 70 and tops at 160"), written in place
     beside it. `poppunk`'s row measured the cost: "the GREEN DAY subset
     alone (42 files) medians at 167 … the fastest music in the catalogue
     (punk, hardcore, thrash, nwobhm) is all piled at 160 and this row joins
     them seven beats short of what the corpus says." 40 is a funeral march
     and 220 is a gabber kick; outside that a tempo stops being a tempo.

     IT LIVES HERE because fields.js is the registry BOTH sides can see:
     compose.js requires this file, and song.js sits below compose in the
     layer graph and may not require it (the header's own ordering, "kernel
     -> genres -> fields -> song -> instruments -> compose").

     2026-09-05 — WIDER AGAIN, AND FOR A DIFFERENT REASON. Paul: *"The number
     of tempos is very low and quite confusing. I should be able to set any
     tempo at all … you should let me choose anything."* The complaint is not
     about the fence, it is about the LADDER — nine marks that stepped a
     Maelzel scale were the only way to move the tempo, and a hand that wants
     143.5 could not say it. So the number is typed or slid to a tenth
     (ui/eight.js `bpmNode`) and the fence is the honest outside of what a
     tempo is: 20 is slower than a heartbeat and 400 is faster than anything
     with a downbeat. The 40..220 pair was the MUSIC's range, and it survives
     as the detent ladder the eight nudge marks still walk. NOTHING WRITTEN
     BEFORE MOVES: every shipped bpm is inside 40..220, which is inside this.
     A CATALOGUE ANCHOR IS STILL AN INTEGER (compose.js says so and throws by
     name); the tenth is the HAND's, on the record it is holding. */
  const BPM_LO = 20, BPM_HI = 400;
  // ...and the number of decimal places a tempo is said to. One place: 143.5
  // is a tempo a hand means and 143.47 is a number it did not choose.
  const BPM_STEP = 0.1;
  /* ...AND THE RANGE A CATALOGUE ROW MAY DECLARE, which is NOT the same fence
     and did not move: 40 is a funeral march and 220 is a gabber kick, and
     that is the argument above, unchanged. What widened is what a HAND may
     set on the record in front of it; what an ANCHOR may be dealt, and what
     the tempo jitter may clamp to, is still the music's own range. Two
     fences, two owners, and every catalogue row is inside both. */
  const BPM_ROW_LO = 40, BPM_ROW_HI = 220;
  const bpmSay = (b) => (Math.round(b * 10) % 10 === 0
    ? String(Math.round(b)) : (Math.round(b * 10) / 10).toFixed(1));

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
  // …AND THE TWO THAT SAY A SLIDE OUTRIGHT (2026-09-03, the portamento round).
  // `slides` above can only mark a slide where an accent already is; these two
  // are the chip a hand turns to make a line portamento at all. What they cost
  // a chair is a `tone.glide`/`tone.slide` on the row — the mark is the WHICH
  // and the row is the HOW LONG.
  OPS.sldall   = slide();                 OPLABEL.sldall   = "slide every note";
  OPS.sldbeat  = slide(0, 4, 8, 12);      OPLABEL.sldbeat  = "slide into the beats";

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
                         // the cut deletes min(span/8, bar); on one bar that IS the section
                         get why() { return T("refuse.oneBarSection"); } } },
      stutter: { rule: { rule: "when", not: "section.oneBar",
                         // the repeat window would be the whole of a one-bar section
                         get why() { return T("refuse.oneBarSection"); } } },
    },
    period: {
      // a bar schedule over one bar is `word` (kernel.js:1202 periodOps reads
      // `at(g.period, s)` with s the bar index), so nothing moves — a remark,
      // not a refusal
      "2bar": { inert: { rule: "when", is: "section.oneBar",
                         get why() { return T("refuse.oneBarPeriod"); } } },
      "4bar": { inert: { rule: "when", is: "section.oneBar",
                         get why() { return T("refuse.oneBarPeriod"); } } },
    },
    pipe: {
      // kernel.js:577 `if (e.part !== (o.part || "pad")) return;` — strum
      // groups the notes of a voiced CHORD and spreads them; a record of pure
      // lines has no group to spread and the stream comes back `ev` untouched
      strum: { inert: { rule: "when", not: "cast.hasPad",
                        get why() { return T("refuse.noChordToStrum"); } } },
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
  /* ...AND THE PACE, WHICH IS THE FOURTH OF THIS FAMILY AND THE ONLY ONE THAT
     IS A BOX FIELD (2026-09-02, the composer round). Paul, B7: *"Tap tempo,
     the tempo editor appears, same for key. The tempo editor does not reflect
     the richness of our tempo options."*

     WHY IT SITS BESIDE THREE TABLES THAT ARE EXPLICITLY NOT BOX FIELDS, and
     what makes it different from them. Swing, groove and meter are the SONG's
     — "a swing that changed per section would be the drummer changing hands
     mid-song" — and that argument was made in full above, twice, and it still
     stands for all three. The pace is not the same kind of fact: it is the
     mensural sign, a section-sized STEP the ear is meant to hear AS a step
     (audio/plan.js: "banshi is a ladder, not a lean"), and the 2026-08-30
     five-walls round already landed it per box — `paces: {role: word}` on the
     anchor, dealt by compose.js dealPaces, carried to the box by document.js
     and multiplied into bar seconds by audio/plan.js PACE_RATE. The record has
     been playing these words for two days with no control anywhere: it was
     display-only text in the engineer's trim grid, which is the
     "declared but never arriving" bug read from the other end.

     THE WORDS MOVE DOWN HERE RATHER THAN BEING COPIED. compose.js declared
     them inside `dealPaces`'s closure; the UI may not read a musical table
     from above this file (the layer graph at the top of this file), so a
     tempo editor that offered them would have had to retype the five words —
     a second list, which is the thing this file exists to abolish. compose.js
     now reads `NF.PACES` and still exports `PACES` under its own name, so
     nukernel/rules.js and every other reader is untouched.

     THE NUMBERS ARE STILL NOT HERE. audio/plan.js PACE_RATE is what each word
     is WORTH — the words/numbers split this repo made twice (lvl/LEVELS,
     PACES/PACE_RATE) — and putting a multiplier beside a word here would be
     the third copy of a fact that already has one owner. */
  const PACES = ["half", "slow", "steady", "push", "double"];
  const PACELABEL = { half: "half", slow: "slow", steady: "steady",
                      push: "push", double: "double" };
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

  /* ---------- A BUS'S THREE SLOTS -> ITS CHAIN (2026-09-03) ---------- */
  // Paul: *"The 'genre bus' doesn't really make a lot of sense. I was expecting
  // it to just be three effects I could set normally. It has this concept of
  // chips. We don't need all that, just a set of chained effects that can be
  // fed."*
  //
  // WHAT WAS WRONG WAS NOT THE CHAIN, IT WAS THE SEAT. The genre bus already
  // ran a real series chain over a real accumulator; what it offered a hand was
  // three bare menus of effect NAMES and nothing else — while the same eleven
  // modules on a voice strip have arrived with their own wet and their own two
  // face knobs since 2026-08-27 (FXWETS/FXFACE above, `fxChainFor`). One
  // vocabulary, two grades of control, and the poorer one was on the bus. So
  // the bus takes the slot dialect the strips already speak, and the word
  // "chip" leaves the surface: a slot is an EFFECT, set normally.
  //
  // THE DIFFERENCE FROM `fxChainFor` IS THE ADDRESS AND ONLY THE ADDRESS. A
  // part carries a LIST (`fx: [...]`) and numbers its knobs by list position; a
  // bus row is a flat map of knob words, so its slots are numbered by SLOT
  // (`fx1` + `fxw1`/`fxa1`/`fxb1`). Same three knobs per seat, same units, same
  // absent-is-today law, and the same `{type, module, params}` recipe out —
  // which then rides through state-engine insertChain at the caller
  // (audio/desk.js insertsFor) exactly as the part's chain does.
  //
  // IT TAKES RESOLVED VALUES, NOT WORDS. `resolveBuses` has run every bus knob
  // through its own table before masterState sees it, so `fxw1` arrives as the
  // NUMBER 0.5 rather than as "half" — one resolver for the whole rack, and no
  // second table walk here. Null is untouched: the module's declared default.
  //
  // ORDER IS SLOT ORDER, and a hole does not reorder what is left: slot 1 empty
  // with slot 2 seated is a one-effect chain, not a chain that starts at 2.
  const busFxChain = (r) => {
    const g = r && typeof r === "object" ? r : {};
    const out = [];
    for (let i = 1; i <= MAX_FX; i++) {
      const k = g["fx" + i];
      if (!k || !Object.prototype.hasOwnProperty.call(FX, k)) continue;
      const type = FX[k].type || k;
      const params = { ...FX[k].params };
      const w = g["fxw" + i];
      if (w != null && params.mix != null) params.mix = w;
      const face = FXFACE[k] || [];
      for (const [gk, spec] of [["fxa" + i, face[0]], ["fxb" + i, face[1]]]) {
        const v = g[gk];
        if (spec && v != null)
          params[spec.key] = +(spec.min + v * (spec.max - spec.min)).toFixed(4);
      }
      out.push({ type, module: "insert_" + type, params });
    }
    return out;
  };

  // SENDS ARE DISCRETE, like everything else here. A chip is a decision; a
  // slider is a fiddle, and the whole surface is chips on purpose.
  /* ---------- THE CATALOGUE, READ AT PRINT TIME AND NEVER AT LOAD --------
     `src/copy/index.ts`: index.html loads this classic <script> before any
     module, so `COPY` is not there yet at factory time. Every printed word in
     this registry is a KEY, and the rows that hand one out do it through a
     GETTER — `ask`, `none` and `label` are read when a sheet is DRAWN, which
     is always after ui/copy.js has run. In node the key itself comes back,
     which is the same loud answer `t()` gives a key nobody wrote. */
  const T = (key, p) => { const C = typeof globalThis !== "undefined" && globalThis.COPY;
    return C ? C.t(key, p) : key; };

  const SENDS = { none: 0, touch: 0.12, some: 0.3, wet: 0.55, drown: 0.9 };
  const SENDLABEL = { none: "dry", touch: "touch", some: "some", wet: "wet", drown: "drown" };
  // `VERBS` STOOD HERE — { room, hall, plate } — AND IS RETIRED, 2026-08-28.
  // The box row it fed is tombstoned below; the whole argument is there. What
  // matters here is that the WORDS were wrong as well as the wire: the engine's
  // reverb vocabulary is REVERBS below (plate/hall/chamber/spring/shimmer ->
  // dattorro/fdn/greyhole/…), and `room` — the first of these three — names no
  // module the build ships. A table that cannot spell its own destination is
  // not a knob missing a wire; it is a different vocabulary.
  // echo time as a fraction of a bar — the subdivisions worth having.
  // READ BY TWO ROWS, and that is deliberate: the RACK's `buses.echo.time`
  // (BUSROWS below -> masterState -> state.delay.beats) is the song's echo, and
  // the BOX's `dtime` overrides it for that section's bars (audio/desk.js
  // barEchoSec -> plan.js barPlan `fx` -> the parent's per-bar fx_bus glide).
  // One table, so a box and the rack cannot mean different lengths by "d8".
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

  /* ---------- THE CELL'S OWN LANE, RELATIVE TO THE ROW'S (TABLE.md wave 3) ---
     ¶A (Paul, 2026-09-03): *"we still want per-section mix automation, with
     per-cell relative to that."* So the SECTION keeps its lanes (`mot` ->
     `auto[]`, audio/desk.js compileAuto) and a CELL says an OFFSET on top of
     them: a cell that says nothing rides the section's curve exactly, a cell
     that says +3 dB rides it 3 dB up. Resolution, once and in one place —
     cell offset + row lane + the seat's static level, and no curve applied
     twice (§4's P3 double-count law).

     A VOCABULARY, NOT A CURVE. Four lane kinds, a handful of words each: the
     chips-not-sliders law the rest of this registry is built on, for the extra
     reason §6 gives — a cell is a 44px tap target on a phone and a freehand
     curve is not drawable there. The numbers are the tables above's own rungs,
     deliberately, so a cell and the strip beside it cannot mean different
     things by "a bit louder":
       · level   the desk's own dB steps, at TRIMS' resolution
       · pan     PANS' half positions, as an OFFSET on the seat the record placed
       · send    half a step of SENDS (touch 0.12 -> some 0.30), on bus 1
       · cutoff  the board's HIGH SHELF, which is what "darker" already means on
                 this machine (band-kit.js mixOf: `darker` IS `eq: { hi: -3 }`)

     WHY A SHELF AND NOT A FILTER FREQUENCY, said out loud rather than implied.
     The ROW's `cutoff` lane is a MASTER sweep — audio/desk.js deskSweeps writes
     one fx_bus `mcut` for the whole box, and its own comment explains why a
     global parameter has to be answered by every box — so there is no per-voice
     cutoff at that stage for a cell to offset. The board's hi shelf IS per
     voice, it is measured to reach a modelled chair as well as a sampled one
     (engine sampler.js BOARD_EQ, 7200 Hz, +/-12 dB, desk-gate G8), and BOTH its
     directions move, which a lowpass ceiling laid on a unit that has none does
     not. "Brighter" that brightens nothing would be this repo's own
     characteristic bug drawn on purpose (memory: declared-but-never-arriving).

     THE SHAPE THE DESK IS HANDED IS THE MIX-OFFSET LAYER'S, verbatim
     (ui/state.js MIXER: `{fader, pan, rev, del, eq}`) — because that layer is
     already applied per unit per channel, OVER the composed section values, on
     the exact wire three rounds of measurement proved reaches a modelled voice
     as well as a sampled one (audio/desk.js, the o.fader / o.pan / o.rev / o.eq
     blocks and the tape-reach gate behind them). A second spelling of "this
     channel, that much louder" is what fields.js:651 records the cost of. */
  const CELLAUTO = [
    { key: "level",  label: "level", short: "lvl",
      table:  { "-6": -6, "-3": -3, "0": 0, "+3": 3, "+6": 6 },
      labels: { "-6": "−6 dB", "-3": "−3 dB", "0": "as mixed",
                "+3": "+3 dB", "+6": "+6 dB" } },
    { key: "pan",    label: "place", short: "pan",
      table:  { l: -0.35, c: 0, r: 0.35 },
      labels: { l: "left", c: "as placed", r: "right" } },
    { key: "send",   label: "send",  short: "send",
      table:  { less: -0.18, same: 0, more: 0.18 },
      labels: { less: "less", same: "as sent", more: "more" } },
    { key: "cutoff", label: "tone",  short: "tone",
      table:  { darker: -3, same: 0, brighter: 3 },
      labels: { darker: "darker", same: "as toned", brighter: "brighter" } },
  ];
  const CELLAUTOBY = {};
  for (const f of CELLAUTO) CELLAUTOBY[f.key] = f;
  /* A CELL'S WORDS -> ONE MIXER-DIALECT OFFSET, or null when it says nothing.
     Null is the whole of absent-is-today: audio/desk.js appends nothing to its
     offset list for that channel, the unit table is byte-identical, and "rides
     the row exactly" keeps exactly one spelling in the record. The NEUTRAL word
     of each lane resolves to 0 and is dropped for the same reason `trimApply`'s
     table has no zero rung and `cleanEntry` drops a 0 dB fader. */
  function cellAutoOffset(m) {
    if (!m || typeof m !== "object" || Array.isArray(m)) return null;
    const out = {};
    for (const f of CELLAUTO) {
      const w = m[f.key];
      if (w == null ||
          !Object.prototype.hasOwnProperty.call(f.table, String(w))) continue;
      const n = f.table[String(w)];
      if (!n) continue;
      if (f.key === "level") out.fader = faderDb(n);
      else if (f.key === "pan") out.pan = n;
      else if (f.key === "send") out.rev = n;
      else out.eq = { hi: eqDb(n) };
    }
    return Object.keys(out).length ? out : null;
  }
  /* ...AND THE SAME QUESTION ASKED OF THE STORED WORDS, for the two doors that
     have to refuse one: document.js `putCell` (a hand) and `normalize` (a file
     from another build). ONE reader, so the resolver and the doors cannot
     disagree about what a legal cell lane is — the drift `chairsOf`/`voiceRoster`
     already pays a gate to prevent. Returns the words kept, or null. */
  const cellAutoClean = (m) => {
    if (!m || typeof m !== "object" || Array.isArray(m)) return null;
    const out = {};
    for (const f of CELLAUTO) {
      const w = m[f.key];
      if (w == null ||
          !Object.prototype.hasOwnProperty.call(f.table, String(w))) continue;
      if (!f.table[String(w)]) continue;            // the neutral word IS absent
      out[f.key] = String(w);
    }
    return Object.keys(out).length ? out : null;
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
  /* THE FIVE SYNTH KNOBS. WIRED 2026-08-28, PER LAYER, AS THE PATCH.

     WHAT THIS COMMENT USED TO SAY, kept because the reversal is the point:
     "THE FIVE SYNTH KNOBS, AND THEY REACH NO SOUND — MEASURED 2026-08-28.
     Nineteen words across cut/res/emod/dec/wave, written onto every layer of a
     house record one at a time: ONE engine handoff, bit-identical every time…
     audio/to-engine.js:1377 does `if (e.vox) notes.push("vox")` and drops the
     note on the floor… NOT WIRED IN THIS ROUND ON PURPOSE. Wiring it means
     deciding what a per-NOTE param write means to a parent that resolves a unit
     ONCE per song — per note, per bar, or per layer as a unit default — and
     each answer sounds different. That is Paul's call, not a guess.
     compose.js:1304 already writes `b.vox = {cut:"bright", res:"hot",
     emod:"mid", dec:"short"}` for the acid box, so the record the box writes
     for its most filter-shaped genre is asking for this out loud and being
     refused in silence."

     PAUL MADE THE CALL, 2026-08-28: "Yes do that and wire all the other stuff
     too." The rate is PER LAYER, and the argument he approved is that these
     nineteen words describe a SETTING, not a gesture. dark / warm / open /
     bright / screaming is where the filter SITS; the box already owns where it
     GOES — the section's mot open/close/rise and any hand-drawn `cutoff` lane,
     which audio/desk.js compiles into the parent's master sweep. Per layer, the
     knobs set the patch and the automation performs it, which is how a 303
     record is actually made. Per note would put a param write on every event
     and fight that automation for the same filter.

     WHERE IT LANDS: audio/plan.js castOf puts the layer's `vox` on the SEAT and
     into the seat's identity (two layers that differ only in their filter are
     two units), and audio/to-engine.js `voxSet` resolves the words into that
     unit's own `set` block once, at the one seam where a chair's params are
     already decided. Absent stays absent: a record that writes no vox renders
     byte-identically — held on ten anchors (house techno rock jazz detroitsoul hymn
     dub vaporwave acid jazzrock, identical engine handoff before and after).

     MEASURED, NOT CLAIMED (rendered PCM, acid and ebm, 8 bars, seed 1 — the
     numbers are in the round's report): `cut` moves the record's 2–8 kHz band
     across its five words, `res` and `emod` and `dec` each move it too, and
     `wave` moves it on any layer whose voice is not already sitting on the word
     it names. */
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
    /* ---------- AND THE THREE A RECORDING CAN ANSWER (2026-08-28) ---------
       "I expect SOME control of the native sampled voices, envelopes, perhaps
       voice doubling, normal sampler options. Right now they are monolithic."
       (Paul.)

       HE IS RIGHT AND THE FILE ALREADY SAID SO. The paragraph fifty lines up
       ends "…and none on any sampled voice, which has no filter to set", and
       that is true of all five words above — they ride a synth's cutoff, its
       resonance, its envelope amount, its decay and its oscillator, and a
       recording has none of those. So on the ~600 sampled chairs in the
       catalogue every chip on the voice tab was inert, and the only thing that
       could shape a sampled voice was the genre's own `tone` block.

       WHAT THE SAMPLER ACTUALLY HONOURS was read off
       engine/faust/voices/sampler.js and state-engine.js `samplerUnit`, not
       guessed, and the list is short: `atk` (the gain envelope's linear
       declick ramp, sampler.js:687 `n.atk`, range 0.003–5 s), `rel` (the
       release ramp, `n.rel`, 0.02–6 s), `swell` (the x²-shaped crescendo
       attack the sampled string pads use, `n.swell`), and the INSERT CHAIN,
       which state-engine honours on the native PCM lane
       (INSERTS-ON-SAMPLED-VOICES). Everything else a sampler normally offers —
       loop points, zone crossfade, filter cutoff, key tracking — has no port
       on this engine, so it is NOT DRAWN. A word that cannot reach the sound
       is the bug this round exists to fix, not a feature to add more of.

         atk   how it comes in. Four words, and the last of them is the
               sampler's own `swell`: a x² crescendo rather than a linear
               ramp, which is a different SHAPE and not a longer one.
         rel   how it lets go — the tail after the note.
         dbl   DOUBLING, the one "normal sampler option" this engine can pay
               for. A sampler unison would mean a second zone read at a second
               rate, which sampler.js has no lane for; a slow, shallow chorus
               insert IS a second detuned pass of the same take summed with
               the first, which is what double-tracking is, and it costs one
               insert on a chain the parent already runs for sampled voices.
               `single` is the dry word and writes nothing.

       ALL THREE REACH A SYNTH TOO, and that is why they are here beside the
       other five rather than in a sampled-only table: `attack` and `release`
       are recipe keys every pitched unit reads (state-engine:1234/1240) and an
       insert chain runs on every voice in the fleet. So no layer draws a chip
       that does nothing — which is the law, stated once, in both directions.
       (`swell` alone is inert off the sampled lane; the word still moves that
       layer's attack to 1.2 s, so it is a slow swell either way.) */
    atk:  { labels: { snap: "straight in", soft: "soft", slow: "slow", swell: "swelling" },
            t: { snap: 0.004, soft: 0.05, slow: 0.35, swell: 1.2 } },
    rel:  { labels: { tight: "cut off", nat: "natural", ring: "ringing", long: "long tail" },
            t: { tight: 0.03, nat: 0.12, ring: 0.8, long: 2.4 } },
    dbl:  { labels: { single: "one take", double: "double-tracked", wide: "wide" },
            t: { single: 0, double: 0.5, wide: 0.8 } },
    /* THE LOOP WORDS (2026-08-30, the sampling round — Paul: "bring over
       sampling from the old version … add loop points and make them
       editable"). THE PARAGRAPH ABOVE THIS TABLE IS AMENDED, dated in place:
       it says "loop points … have no port on this engine, so it is NOT
       DRAWN", and that stopped being true today. The engine grew three
       per-unit params — the PINNED CONTRACT between the two lanes, spelled
       once here and once at the engine's own dispatch (audio/to-engine.js
       samplerVox), neither side renaming it:

         loopa   loop start, 0..1 fraction of the zone
         loopb   loop end,   0..1 fraction of the zone
         loopon  0 = the zone's own default · 1 = force loop · 2 = one-shot

       They ride the SAME channel atk/rel/dbl ride — voice.sound on the
       document, the chairs seam's `vox`, samplerVox at the seat — so the
       desk, the page and the press reach them through one owner. The words:

         looping   the one WORDED control — "loops" forces a sustained loop
                   under the gate (a bed, a texture), "one-shot" forces the
                   zone to play through and stop (a stab, an SFX hit), absent
                   is the zone's OWN flag (an SF2 pad loops, a hit does not),
                   which is byte-identical to every record written before
                   this row existed.
         loopin / loopout   NOT here, ON PURPOSE: they are the two loop
                   POINTS, 0..1 fractions, and a point is edited, not worded
                   — the page's loop strip (ui/eight.js) writes the NUMBER
                   onto voice.sound.loopin/.loopout and samplerVox passes a
                   number through unmapped. A word table for a continuous
                   fraction would be a lie about what the control is. The
                   avail.js sheets (`sound.loopin` / `sound.loopout`) quantize
                   for the sheet surface only; the strip is the editor.

       UNLIKE atk/rel, these reach ONLY a sampled voice — a synth has no zone
       to loop — so no FIELDS layer row is added below (a loop chip on a
       synth layer would be the dead knob this file legislates against) and
       the page draws the strip only on chairs whose id `sampledId` claims
       (instruments.js, measured against recipeFor's own routing). */
    looping: { labels: { loop: "loops", once: "one-shot" },
               t: { loop: 1, once: 2 } },
  };
  // THE THREE SAMPLER WORDS, AS THE RECIPE KEYS THEY WRITE. Kept beside the
  // table above rather than inside audio/to-engine.js because it is the same
  // kind of fact VOXPARAM below is — which param a word rides — and this file
  // is where nukernel says what a control IS. audio/to-engine.js `samplerVox`
  // is the one reader.
  //   `atk`/`rel` write the recipe's own `attack`/`release` seconds directly
  // (they are seconds in the table, not normalized positions, because both
  // ends of the range are the ENGINE'S clamp and there is nothing to normalize
  // against); `swell` additionally raises the sampler's x² flag.
  //   `dbl` is a chorus CHIP and its params are FX.chorus's own, scaled: one
  // owner for what a chorus is, exactly as BOARDS in instruments.js takes its
  // chains from `fxChain` rather than restating them.
  const VOXDOUBLE = { double: { rate: 0.28, depth: 0.35, mix: 0.5 },
                      wide:   { rate: 0.45, depth: 0.7,  mix: 0.75 } };

  /* ---------- HOW THE VOCAL CHAIRS ARE REALISED (2026-08-28) -------------
     Paul: *"I want to be able to choose whether to use synthesized voices or
     instrumentation to replace voices. Put this as a multi-state toggle right
     next to the main volume slider: Vox (default), Instruments, All analog,
     All FM."*

     IT IS A VIEW AND NOT AN AXIS, and this table is the vocabulary only —
     four words and what each one means. The VALUE lives in audio/plan.js as
     module state (`voicing()` / `setVoicing()`), which is where the CAST is
     resolved and the only place that reads it; no document carries it, no save
     carries it, a share link does not, and `vox` — the default — recompiles
     byte-identically to a build without this table. That is the whole argument
     for keeping it out of the eight axes: it is a way of LISTENING to a record,
     like the room slider beside it, not a fact the record states about itself.
     (The cost of that choice, said out loud: reload and you are back on `vox`.
     If Paul wants it to stick it becomes one line in ui/state.js's view store,
     beside VOLSTORE, and still not an axis.)

     WHICH CHAIRS IT TOUCHES: every chair whose instrument names a PERSON —
     instruments.js PATCH_VOICE (solo vox, the aah choir, the ooh voices) and
     PATCH_MOUTH (the talking tract). Nothing else on the record moves.
     instruments.js `voicedAs` is the one owner of what each word swaps to,
     because "which instrument plays this" is an instruments.js fact.

     THE MARK is here beside the word rather than in ui/glyph.js because the
     five states are a VOCABULARY — a menu of what the control may be — and
     this file is where nukernel says what a control is. glyph.js's `act` rows
     are single gestures (play, stop, rewrite, take); this is one control with
     five positions, and its marks belong with its words.

     A FIFTH POSITION, 2026-08-30. Paul: *"Add another option to the
     instrumentation switcher in opts — this would be just the classic sampled
     oohs and ahs replacing the tract voices"* · *"Chorus basically."*

     THE WORD IS PAUL'S AND THE COLLISION IS NAMED RATHER THAN RENAMED
     AROUND: `dbl` a few lines up is "a chorus CHIP" and means FX.chorus, the
     modulated delay. This `chorus` is the ENSEMBLE — people, on tape. They
     share four rows of this file and nothing else: the chip is a word a
     recording hears (VOXDOUBLE), this is a position of the cast switch, and
     no reader of either can be handed the other.

     AND IT IS THE ARGUMENT THAT WAS OVERRULED, ASKED FOR AS A CHOICE. The
     paragraph instruments.js withdrew on 2026-08-28 — "A LEAD IS SYNTHESISED;
     A CHORUS IS RECORDED — WITHDRAWN, 2026-08-28, AND IT NEVER REACHED THE
     SOUND IN THE FIRST PLACE" — was withdrawn as a silent DEFAULT that the
     tape did not agree with, and its musical claim was kept on the record
     ("a recorded ensemble brings two things four detuned formant voices
     cannot synthesise — a room, and forty people not agreeing"). A default
     nobody chose and a POSITION somebody turns to are not the same object:
     the first is a lie about what the box does, the second is the box
     offering the thing and saying which it is. `vox` is still the default and
     still renders byte-identically. */
  const VOICINGS = {
    vox:    { w: "sung", g: "◉",
              get says() { return T("voicing.sung"); } },
    instr:  { w: "instruments", g: "♪",
              get says() { return T("voicing.instruments"); } },
    analog: { w: "all analog", g: "∿",
              get says() { return T("voicing.analog"); } },
    fm:     { w: "all FM", g: "⋔",
              get says() { return T("voicing.fm"); } },
    // THE MARK IS ◎ AND IT IS ◉ WITH THE VOICE TAKEN OUT OF IT. Beside the
    // singer's filled throat this is the same circle as a GROOVE — a record,
    // a take that already happened — which is exactly the difference the
    // position names: nobody is singing, the singing is on tape. Distinct at
    // a glance from ♪ ∿ ⋔ (a note, a wave, two operators), and the two
    // circles are never on the page together — the strip shows the position
    // you are ON, one mark and its word (ui/eight.js paintVoicing).
    chorus: { w: "chorus", g: "◎",
              get says() { return T("voicing.chorus"); } } };
  const VOICING_KEYS = Object.keys(VOICINGS);

  /* ===== WHAT HAPPENS WHEN THE RECORD ENDS (2026-08-30) ==================
     Paul: *"There are three play modes possible—loop, once, and album which
     keeps making new songs. Let me set that with a three state icon in opt."*

     IT IS A VOCABULARY AND IT IS HERE FOR VOICINGS' REASON, WORD FOR WORD:
     "the marks are here beside the words rather than in ui/glyph.js because
     the states are a VOCABULARY — a menu of what the control may be — and
     this file is where nukernel says what a control is. glyph.js's `act` rows
     are single gestures (play, stop, rewrite, take); this is one control with
     three positions, and its marks belong with its words."

     THE THREE MARKS ARE ONE FAMILY, BY THE TABLE'S OWN CONCATENATION IDIOM
     ("the SUBJECT first, then what is being done to it", ui/glyph.js `sec`).
     Every one of them leads with ▶ — this is the transport, in all three
     positions — and the second mark is the whole of the difference:
       ▶|  to the end, and stop at the bar line. `|` is ASCII; nothing else
           in this box's marks is a bare vertical rule.
       ▶∞  round and round. U+221E, in every face that can draw this page,
           and the only ∞ in the box.
       ▶⚄  round again on a NEW THROW. ⚄ is `rewrite`'s own die (glyph.js
           `act.rewrite`) and it is deliberately the same picture: album IS
           the rewrite gesture, taken by the clock at the end of the record
           instead of by a thumb. The same fact wears the same mark.
     Distinct at a glance, and only one of them is ever drawn — the strip
     shows the position you are ON, one mark and its word (ui/eight.js
     `paintPlayMode`, the `paintVoicing` shape exactly).

     `loop` IS THE DEFAULT BECAUSE IT IS WHAT THE BOX ALREADY DID, and that is
     a MEASUREMENT, not a memory: audio/live.js `barOfSerial` is
     `((barBase + serial) % barCount() + n) % n`, so the walk has wrapped for
     ever since there was a walk. Absent-is-today: a record opened by somebody
     who never touches this control plays exactly as it played yesterday.

     THE VALUE IS NOT HERE AND DOES NOT PERSIST. It lives in ui/eight.js as
     module state beside `deckView` — the file that holds the transport's
     buttons and hears the end of the record — and a reload puts you back on
     `loop`, which is VOICINGS' own trade said again: "a setting that survives
     a reload is a setting somebody has to be able to see they made", and this
     one can write you a different record while you are not looking. */
  const PLAYMODES = {
    loop:  { w: "loop", g: "▶∞",
             get says() { return T("play.loop"); } },
    once:  { w: "once", g: "▶|",
             get says() { return T("play.once"); } },
    album: { w: "album", g: "▶⚄",
             get says() { return T("play.album"); } } };
  const PLAYMODE_KEYS = Object.keys(PLAYMODES);
  // The param a knob rides, per DSP naming. First name that EXISTS on the node
  // wins, so one chip covers tb303 / modeld / bass_reese / bass_wobble without
  // a per-synth table — and a DSP that has none of them (the DX7) is simply not
  // touched rather than being fed a param it does not own.
  //
  // IT HAS A READER NOW: audio/to-engine.js `voxSet` (2026-08-28). "Exists on
  // the node" is asked of nukernel/knobs.js — the GENERATED census that probed
  // this parent at both ends of every candidate key and kept the ones that
  // MOVED a param — so the question is answered by measurement and the range
  // each word is placed in is the measured travel, dead ends trimmed. Measured
  // reach across the 27 seatable voices: all five knobs land on tb303 and
  // modeld; four on bass_wobble and juno60 and lead_fuzz; three on bass_reese,
  // organ and choir; one (cut) on the fourteen that only own a filter; and
  // NONE on dx7_alg5 (its knob is the cartridge) or hammond (drawbars), which
  // are left alone, and none on any sampled voice, which has no filter to set.
  //
  // `tone` JOINED THE `cut` LIST, and it is the parent's own answer and not a
  // widening: state-engine's NOTE_PARAMS whitelist has always carried
  // `solina: { cut: ["tone", 300, 12000] }` — "solina's brightness param is
  // `tone` (no res, no cutoff)". It is the only voice in the fleet with a param
  // by that name, so the one word costs nothing and buys the string machine the
  // brightness knob every other voice already had.
  const VOXPARAM = { cut: ["cutoff", "tone"], res: ["resonance", "res"],
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

  /* ---------- THE FIVE THE CELL TOOK FROM THE BOX (TABLE.md wave 4) --------
     §1 CELL: *"artic / oct / rate / scale / clamp — today per box, applied to
     every voice; become per cell with the row as default."* The vocabularies
     are NOT retyped here — each row points at the table `FIELDS` already
     declares for the box chip of the same name, so the strip a cell draws and
     the strip the palette draws offer the same words by construction, and a
     word added to `ARTICS` reaches both by existing. This list is the ORDER
     and the LABELS, which is all the cell sheet needs on top.

     `neutral` IS THE ONE FIELD-BY-FIELD JUDGEMENT, and it is the CELLAUTO law
     applied a second time: a word worth nothing must have exactly one
     spelling in the record, and that spelling is ABSENT. `oct: "0"` is that
     word — an octave shift of no octaves is what a cell that says nothing
     already does — so it is dropped at the door and never drawn as a chip
     (§1b's register bug, which wrote and was silently pruned, written down in
     advance rather than shipped twice). `clamp: "0"` is NOT neutral and is
     offered: the kernel's own floor is SEVEN (kernel.js render, `g.incClamp ==
     null ? 7`), so "off" is a real statement that the ramp may run, and a cell
     that says nothing means seven. */
  const CELLVEC = [
    /* A QUESTION IS NOT A LABEL, AND "DEFAULT" IS ONE WORD (2026-09-05, the
       functional text pass). These five wore an interview question as their
       control name ("how are the notes played?") and spelled the empty detent
       "the row's"; the label is the NOUN and the empty detent is the one word
       `core.ts value.default` holds for every tier on the page. `label`,
       `ask` and `none` are GETTERS so the catalogue is read when the strip is
       drawn rather than when this table is built. */
    { key: "artic",
      get label() { return T("field.articulation"); },
      get ask()   { return T("field.articulation"); },
      table: ARTICS,  labels: ARTICS,
      get none()  { return T("value.default"); } },
    { key: "oct",
      get label() { return T("field.octave"); },
      get ask()   { return T("field.octave"); },
      table: OCTAVES, labels: OCTAVES, neutral: "0",
      get none()  { return T("value.default"); } },
    { key: "rate",
      get label() { return T("field.timeShift"); },
      get ask()   { return T("field.timeShift"); },
      table: RATES,   labels: RATELABEL,
      get none()  { return T("value.default"); } },
    { key: "scale",
      get label() { return T("field.scale"); },
      get ask()   { return T("field.scale"); },
      table: SCALES,  labels: SCALELABEL,
      get none()  { return T("value.default"); } },
    { key: "clamp",
      get label() { return T("field.rampLimit"); },
      get ask()   { return T("field.rampLimit"); },
      table: CLAMPS,  labels: CLAMPLABEL,
      get none()  { return T("value.default"); } },
  ];
  const CELLVECBY = {};
  for (const f of CELLVEC) CELLVECBY[f.key] = f;
  /* ONE WORD OF ONE OF THE FIVE, KEPT OR REFUSED — the shared reader for the
     three doors that have to ask (document.js `putCell` when a hand writes,
     `normalize` when a file arrives from another build, and the resolver's own
     row reader). Values are stored as the TABLE'S OWN KEY, a string, so a
     document has one spelling of `oct: -1` and not two; the kernel is handed
     the number by `document.js toGenre`, which is the one place the word
     becomes a value. Returns the key kept, or null. */
  const cellVecClean = (key, w) => {
    const f = CELLVECBY[key];
    if (!f || w == null || w === "") return null;
    const k = String(w);
    if (!Object.prototype.hasOwnProperty.call(f.table, k)) return null;
    return k === f.neutral ? null : k;         // the neutral word IS absent
  };


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
                      beatgroupV: "beatgroup verse", beatgroupC: "beatgroup chorus" };
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
  /* ---------- AND WHOSE THROAT A CHAIR IS (2026-09-04, the per-chair round)
     A CHAIR MAY NAME ITS OWN SINGER. Until this round the throat was a fact
     about the ROW — `genres.js MOUTHS` carries a `voice` word and every sung
     chair on the record read the same one — and a four-part choir is the case
     that breaks it: `chorale` spreads four voices over three octaves and all
     four of them resolved to one alto, so the box was writing an SATB texture
     for a single throat. SATB needs four throats and a row can say ONE, which
     is why the answer is a COLUMN field (`document.js TIERS.voice`, stored at
     `voices[vi].cast.voice`) with the row's mouth as its default.

     THE WORDS ARE NOT TYPED HERE. `engine/faust/voices/state-engine.js
     VOICE_TYPE` is the one owner of what a throat can reach and
     `nukernel/knobs.js` is its EXTRACTION — knobs-extract.js probes the
     parent's own `pitchedUnit` and writes the five words and their Hz
     compasses beside them — so this reads that table and never restates it
     (the attribute-grammar law: the conversion is done by extraction, never by
     hand). Read LAZILY because index.html loads knobs.js at :518, after this
     file at :486; nothing here asks before the page is up.

     LOUDLY, OR NOT AT ALL. An empty table would mean this file silently
     stopped knowing what a throat is — `normalize` would then drop every
     `cast.voice` in the record at the door and every choir would go back to
     one throat with nothing said, which is the failure mode band-kit.js:1313's
     law exists for. So it throws by name instead. */
  let THROATWORDS = null;
  function THROATS() {
    if (!THROATWORDS) {
      const NK = (typeof module !== "undefined" && module.exports)
        ? require("./knobs.js") : root.NuKnobs;
      const rows = (((NK && NK.voices && NK.voices.voice_lead) || {}).rows) || [];
      const row = rows.find((r) => r && r.key === "voice" && Array.isArray(r.values));
      THROATWORDS = row ? row.values.filter((w) => typeof w === "string") : [];
      if (!THROATWORDS.length)
        throw new Error("fields.js: knobs.js publishes no voice types — load it " +
                        "before this table is asked (index.html) or rebuild it");
    }
    return THROATWORDS;
  }
  const isThroat = (w) => typeof w === "string" && THROATS().includes(w);

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
  // reaches 1 by grit=0.125.
  //
  // THE WHOLE LADDER CAME DOWN ~40% ON 2026-08-27. Paul, listening: *"voices
  // seem to be mixed really hot and saturated"*, and then, when asked to let it
  // be measured first: *"Just turn down saturation my ears aren't wrong."*
  //
  //   word     was    now    tanh drive (1 + grit*2.6)    wet mix (min 1, grit*8)
  //   hair     0.12   0.06   1.312x -> 1.156x             0.96 -> 0.48
  //   warm     0.28   0.16   1.728x -> 1.416x             1.00 -> 1.00
  //   dirt     0.50   0.32   2.300x -> 1.832x             1.00 -> 1.00
  //   crush    0.80   0.62   3.080x -> 2.612x             1.00 -> 1.00
  //
  // THE SENTENCE ABOVE USED TO END "so the low settings are genuinely a hair of
  // it" AND IT WAS NOT TRUE, which is why `hair` moves proportionally furthest.
  // The mix reaching 1 by grit=0.125 does not make the low settings gentle — it
  // makes them FULLY WET: at 0.12 the record was 96% a tanh at 1.31x, i.e. the
  // whole signal through the shaper, with only the drive amount left to say
  // "a hair" with. At 0.06 the blend is 48% and the drive 1.16x, so the word
  // and the sound agree for the first time.
  //
  // THE LADDER STAYS MUSICALLY ORDERED AND crush STILL CRUSHES: 2.61x into a
  // tanh at full wet is a squared-off wave, 8.34 dB of added drive against the
  // old 9.77 — a step down, not a retirement, and still 2.3x the drive `hair`
  // asks for. Nothing else needed re-measuring: audio/desk.js DRIVE_LU is keyed
  // on the grit VALUE and interpolated, so the stage's own level compensation
  // follows these numbers down without a second fit.

  /* ================== THE MASTER HAS AN OFF, 2026-08-28 =====================
     Paul, listening to the Iranian pop record: *"Iranian pop is symptomatic of
     the problem in the mix. The vocals should be native. Everything is hot and
     needs more filtering. Everything sounds like it was recorded on very hot
     mic or amp. Turning that stuff down doesn't do enough in the final mix.
     There doesn't seem to be a way to even turn the final mix off — the
     minimum amount of things is soft, not none."*

     THE LAST SENTENCE IS THE BUG AND EVERY TABLE BELOW WAS GUILTY OF IT. The
     quietest word in each vocabulary was a SMALL NUMBER, never zero: DRIVES
     began at `hair` 0.06, TAPES' gentlest head still saturated at sat 0.18,
     SPACES' smallest room still bled 0.07 of the dry into the reverb, and
     CEILINGS' `open` — the word whose own comment promised "no clip stage" —
     could not remove a clipper that engine/faust/dsp/fx_bus.dsp applied
     UNCONDITIONALLY. A hand turning those down was walking a ladder whose
     bottom rung was still a rung, which is exactly why "turning that stuff
     down doesn't do enough": the stages never left.

     SO EVERY MASTER VOCABULARY NOW OPENS WITH `none`, and `none` is a genuine
     bypass rather than a small number — grit 0, comp 0, sat 0, mix 0, side x1,
     tilt 0 dB, clip off. Each one is arithmetically exact at the DSP (fx_bus
     select2s the stage OUT rather than scaling it to nothing; see that file's
     bypass block), so choosing it removes the stage from the signal instead of
     turning it down.

     ABSENT IS STILL TODAY, and that is a decision rather than an oversight.
     139 saved records spell "I said nothing about mastering" by having no
     `sound.master` key at all, and ABSENT-IS-TODAY is the law that lets them
     re-render as themselves; if absent silently became `none` every one of
     them would change on load. `none` is a word you CHOOSE. The two are
     different facts and they keep different spellings: absent = the engine's
     own fxParams defaults, `none` = nothing at all. ==================== */
  // `none` FIRST, and it is grit 0 — fx_bus gritmix is `x + (gritfx(x)-x)*
  // min(1, grit*8)`, so at 0 the shaper's whole contribution is multiplied away
  // and the sample that comes out is the sample that went in, bit for bit.
  const DRIVES = { none: 0, hair: 0.06, warm: 0.16, dirt: 0.32, crush: 0.62 };
  const DRIVELABEL = { none: "none", hair: "a hair", warm: "warm", dirt: "dirt", crush: "crush" };

  // GLUE — the bus compressor that is ALREADY THERE. graph.js has run live.js's
  // glue comp → makeup since the day the sampled voices turned out to play at
  // −22 dBFS; what it never had was a character. `glue` is that chain's own
  // numbers under a name, so choosing it explicitly is a no-op, and the other
  // four walk the same two nodes from a slower, gentler ride to a pumped one.
  // No new node is built for any of them: this is a param write.
 // MAKEUPS RESTAGED 2026-08-16, measured rather than felt. At makeup 2.2 a
  // composed song rendered at −6 to −7 dBFS RMS with its peaks PINNED on the
  // brickwall (beatgroup peak −1.53 dBFS == the limiter threshold; rock 1.10,
  // OVER full scale through the safety shaper's oversampling overshoot, which
  // the 16-bit encode then hard-clips — the "hot and distorted" report, as
  // numbers). The whole table is scaled by one factor so the characters keep
  // their relative loudness; the default now leaves the limiter with ~0
  // reduction at default settings (beatgroup peak −3.5 dBFS after), so the
  // brickwall is a net again instead of the sound.
  // `none` FIRST (2026-08-28): the compressor OUT, not a gentle one. It resolves
  // to audio/desk.js GLUE_COMP 0, which is fx_bus `comp` 0 — cratio
  // 1/max(0.45, 1-0) = 1, makeup 1, cpar 0 — and a compression_gain_mono at
  // ratio 1 returns exactly 1, so `glue(x,y)` reduces to `(x*1)*1`. Exact.
  // The numbers here are the identity spelling of the same thing for
  // resolveMaster's shape-preserving readers.
  const GLUES = {
    none:   { thr: 0,   knee: 0,  ratio: 1,   atk: 0.030, rel: 0.25, makeup: 1 },
    soft:   { thr: -18, knee: 30, ratio: 1.6, atk: 0.030, rel: 0.35, makeup: 1.2 },
    glue:   { thr: -22, knee: 28, ratio: 2.2, atk: 0.015, rel: 0.25, makeup: 1.4 },
    tight:  { thr: -26, knee: 18, ratio: 3.2, atk: 0.006, rel: 0.18, makeup: 1.7 },
    pump:   { thr: -30, knee: 8,  ratio: 6,   atk: 0.002, rel: 0.09, makeup: 1.9 },
    squash: { thr: -34, knee: 4,  ratio: 12,  atk: 0.001, rel: 0.06, makeup: 2.2 },
  };
  const GLUEDFLT = GLUES.glue;             // == what graph.js builds with no master
  const GLUELABEL = { none: "none", soft: "soft", glue: "glue", tight: "tight",
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
  // `none` FIRST, AND IT IS THE ROUND'S SECOND BUG (2026-08-28). fx_bus's
  // tapesat carried the comment "exact bypass at tsat=0 (the (…-x)*tsat term
  // dies)" over an expression with NO such term: `x + (tanh(x*k)/k - x)` at
  // tsat=0 is k=1, i.e. plain `tanh(x)` — a full-strength soft clip on every
  // record ever rendered, un-turn-off-able, sitting one stage above the other
  // one. THAT is "everything sounds like it was recorded on very hot mic or
  // amp", and it is why the shipped `warm` head at sat 0.18 was never the
  // gentlest thing available: 0 was gentler and 0 did not work. fx_bus now
  // select2s the stage out at tsat=0, so this word is silence-of-the-stage.
  const TAPES = { none: { wob: 0,    sat: 0    },
                  warm: { wob: 0,    sat: 0.18 },
                  tape: { wob: 0.35, sat: 0.30 },
                  worn: { wob: 0.7,  sat: 0.45 },
                  wow:  { wob: 1,    sat: 0.60 } };
  const TAPELABEL = { none: "none", warm: "warm head", tape: "tape", worn: "worn", wow: "wow & flutter" };

  // SPACE — fx_bus `mrev`, "a little of the DRY mix into the reverb so the WHOLE
  // mix shares one room (the per-voice sends are untouched — this is the global
  // bleed)". That is exactly what makes it different from a section's rev chip:
  // a send is a decision about ONE section, this is the room they are all in.
  //
  // The room itself is live.js's vapor wash (pre-delay + three damped combs),
  // NOT a convolver, for graph.js buildRoomBus's stated reason: the audio gate
  // holds the page to two convolution reverbs and they are the most expensive
  // node here. `size` scales the comb times; `mix` is the bleed off the dry sum.
  // `none` FIRST (2026-08-28): mix 0. fx_bus's reverb input is
  // `(rev + d*bleed + (ppl+ppr)*0.12 + (dl+dr)*0.5*mrev) * rgain`, so mrev 0
  // removes the dry mix's term from the sum exactly — the per-voice sends are
  // untouched, which is the whole point of the word. audio/desk.js honest()
  // no longer derives a return level or a dry trim from a zero bleed.
  const SPACES = { none:   { mix: 0,    size: 0    },
                   touch:  { mix: 0.07, size: 0.55 },
                   room:   { mix: 0.13, size: 0.8 },
                   hall:   { mix: 0.20, size: 1.2 },
                   cavern: { mix: 0.30, size: 1.8 } };
  const SPACELABEL = { none: "none", touch: "a touch", room: "room", hall: "hall", cavern: "cavern" };

  // WIDTH — the one control here with no parent to borrow from, because the
  // parent gets its width from placement (MASTER_PAN) and from the tape's own
  // decorrelation. A mid/side trim is the master-bus answer to the same
  // question, and it is gains and a splitter: side ×0 is mono, ×2.2 is as wide
  // as a two-voice box can be pushed before the centre hollows out.
  // …AND IT REACHES THE SOUND NOW, 2026-08-28. This table drew on the board and
  // round-tripped through a save and stopped there — audio/desk.js listed it
  // under "what has no home". It has one: fx_bus gained a mid/side trim
  // (`mswidth`), which is four multiplies, and `none` = side x1 = the record's
  // own image, select2'd past so the identity is exact rather than
  // arithmetically-nearly.
  const WIDTHS = { none: 1, mono: 0, narrow: 0.5, wide: 1.5, huge: 2.2 };
  const WIDTHLABEL = { none: "none", mono: "mono", narrow: "narrow", wide: "wide", huge: "huge" };

  // TILT — fx_bus's tone stage as one knob. A SHELF PAIR, not a filter pair:
  // the parent's own note on MASTER_AIR_SHELF_DB is that a shelf "dims the air
  // instead of stopping it", and the thing that stops it (the 16 kHz MASTER TOP
  // lowpass) is already unconditional in graph.js. Value is the tilt in dB —
  // the low shelf takes −t and the high shelf +t, so one number rocks the
  // spectrum about its middle.
  // …AND IT REACHES THE SOUND NOW, 2026-08-28, because Paul asked for the thing
  // it does: *"Everything is hot and needs more filtering."* A tone control
  // that draws and does nothing is the box's characteristic bug, and this was
  // the one word on the board that answers his sentence directly. fx_bus gained
  // `mtilt`: ONE first-order split about 1 kHz — the low half x10^(-t/20), the
  // high half x10^(+t/20) — rather than the shelf PAIR described below, because
  // one filter per channel is a quarter of the cost and rocks the same
  // spectrum about the same middle. `none` = 0 dB = the stage select2'd out.
  const TILTS = { none: 0, dark: -4, warm: -2, clear: 2, bright: 4 };
  const TILTLABEL = { none: "none", dark: "dark", warm: "warm", clear: "clear", bright: "bright" };

  // CEILING — how hard the end of the chain works. `open` is graph.js's
  // brickwall exactly as it stands (−1.5 dB, no clip stage). The other three add
  // fx_bus's `clip`: the Bram de Jong soft clip at 0.95 the csound renders
  // ended on, which is a knee rather than a wall — and `push` is a gain INTO the
  // limiter, which is the honest way to say "louder" without pretending the
  // makeup (glue's, above) is doing it.
  //
  // THE CLIP COLUMN WAS A LIE AND IT IS THE HEADLINE OF 2026-08-28. Every value
  // in it — including `open`'s 0, which the paragraph above reads out loud as
  // "no clip stage" — was read by NOBODY. audio/desk.js masterState never
  // looked at `ceiling` at all, and fx_bus applied the Bram de Jong soft clip
  // at 0.95 unconditionally in master(). So the box shipped a word that said
  // "off" over a stage that could not be switched off, on every record in the
  // catalogue, which is precisely Paul's *"there doesn't seem to be a way to
  // even turn the final mix off"*. Measured the same day: all four probe
  // records peaked between -3.3 and -4.0 dBFS, i.e. above the clipper's knee
  // at 0.475 (-6.5 dB) and pressed against its hard cap at 0.7125 (-2.93 dB).
  // Every one of them was inside the clipper. That is the "very hot mic".
  //
  // THE `clip` COLUMN REACHES NOW: it is fx_bus's `clipl`, the soft clip's
  // limit, and 0 means the stage is not built.
  //
  // `push` DOES NOT, AND THAT IS A MEASUREMENT AND NOT AN OVERSIGHT. It WAS
  // wired to a new fx_bus gain in front of the clip in this same round — the
  // obvious home for it — and rendered on the two families that draw the
  // words (8 bars, seed 1):
  //     house  (loud,   push 1.7)   RMS -11.71 -> -8.14   crest 8.72 -> 5.20
  //     techno (louder, push 2.6)   RMS -27.31 -> -19.15  crest 21.02 -> 16.21
  // +3.6 and +8.2 dB of level, every dB of it bought with crest, peak pinned
  // on the clipper throughout. That is the honest-master deception of
  // 2026-08-21 word for word, arriving through a new door in the round whose
  // brief was that everything is too hot. So the gain was deleted again and
  // `push` stays an unreached column beside `thr`: it belongs in front of
  // dsp/master_limit.dsp's fixed threshold, which the offline chain does not
  // instantiate. Consequence, stated rather than left to be discovered:
  // `safe`, `loud` and `louder` all resolve to clip 0.95 and sound the same.
  // They sounded the same before this round as well — no ceiling value reached
  // anything — so nothing regressed; breaking the tie is the limiter's job.
  //
  // AND `open` IS REWRITTEN RATHER THAN HONOURED, which is the one place this
  // round declines to take a table at its word. Reading `open`'s 0 as "off"
  // would have silently changed every record the composer ever dealt it — the
  // MASTER_LEAN ballots in compose.js hand `open` to kernel / vox / groove /
  // drift / roots / parts — into a sound none of them was auditioned in. What
  // `open` has ACTUALLY rendered for its whole life is the clipper, so `open`
  // now SAYS the clipper, at 1.0 instead of 0.95: the gentlest setting the
  // stage has, a knee starting at 0.5 and a cap at 0.75 rather than 0.7125,
  // which is the direction Paul asked for without moving a record into a stage
  // it never had. `thr` stays in the table and stays unreachable: the live
  // brickwall is dsp/master_limit.dsp and its threshold is fixed in the DSP.
  // `none` is the word for off, and `none` is new.
  const CEILINGS = { none:   { thr: 0,    push: 1,   clip: 0 },
                     open:   { thr: -1.5, push: 1,   clip: 1.0 },
                     safe:   { thr: -2.5, push: 1,   clip: 0.95 },
                     loud:   { thr: -3,   push: 1.7, clip: 0.95 },
                     louder: { thr: -3,   push: 2.6, clip: 0.95 } };
  const CEILDFLT = CEILINGS.safe;          // == the clipper as fx_bus has always applied it
  const CEILINGLABEL = { none: "none", open: "open", safe: "safe", loud: "loud", louder: "louder" };

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
  // null = 1). The SLOTS name the box's own FX vocabulary, one effect per
  // slot, so the chain a genre deals at compose time and the chain a hand edits
  // here are the same eleven modules — no second effects vocabulary. (This
  // paragraph said "chips" until 2026-09-03; the word is gone from the surface
  // and from here. A slot is an effect, with its own knobs — see busFxChain.)
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
    // its chain (three slots, the box's own FX vocabulary — set by a hand on
    // the rack; precompose deals no genre-bus row, so absent is the shipped
    // state of every catalogue record) runs over
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
      // THE THREE SLOTS, SET NORMALLY (2026-09-03). They were three bare
      // `fx1..3` menus and nothing else — the "chips" Paul asked to be rid of.
      // The KEYS DO NOT MOVE, which is the whole migration: `fx1`/`fx2`/`fx3`
      // are what every saved session and every share link already writes, and a
      // save that names only them resolves to the module's own declared
      // defaults — the same three effects, the same sound, byte for byte. What
      // is ADDED is the rest of each seat: its wet (the module's own `mix`
      // param, FXWETS) and its one or two face knobs (FXFACE, in the module's
      // own units as a fraction of its declared span). Same three knobs a voice
      // strip's insert slot has carried since 2026-08-27, same tables, so
      // song.js's registry walk validates them with no edit at all.
      knobs: [
        { key: "level", label: "level", table: GLEVELS, labels: GLEVELLABEL, default: null },
        { key: "fx1", label: "effect 1", table: GXCHIPS, labels: FXLABEL, default: null },
        { key: "fxw1", label: "wet 1", table: FXWETS, labels: FXWETLABEL, default: null },
        { key: "fxa1", label: "set 1a", table: FXPOTS, labels: FXPOTLABEL, default: null },
        { key: "fxb1", label: "set 1b", table: FXPOTS, labels: FXPOTLABEL, default: null },
        { key: "fx2", label: "effect 2", table: GXCHIPS, labels: FXLABEL, default: null },
        { key: "fxw2", label: "wet 2", table: FXWETS, labels: FXWETLABEL, default: null },
        { key: "fxa2", label: "set 2a", table: FXPOTS, labels: FXPOTLABEL, default: null },
        { key: "fxb2", label: "set 2b", table: FXPOTS, labels: FXPOTLABEL, default: null },
        { key: "fx3", label: "effect 3", table: GXCHIPS, labels: FXLABEL, default: null },
        { key: "fxw3", label: "wet 3", table: FXWETS, labels: FXWETLABEL, default: null },
        { key: "fxa3", label: "set 3a", table: FXPOTS, labels: FXPOTLABEL, default: null },
        { key: "fxb3", label: "set 3b", table: FXPOTS, labels: FXPOTLABEL, default: null } ] },
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
    // "out", 2026-08-27 (FUTURE.md §5: "routing as a glyph, deletes the
    // narration" — a surface drawing this row prints the value as an arrow,
    // `→ main`). No surface draws it today — the groups left the board with
    // the 2026-08-27 series — but the label table is the one owner of the
    // word, so it is renamed where it lives.
    ...(r.engine ? [] : [{ key: "to", label: "out", table: BUSTO,
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

  /* ---------- THE ONE-TOUCH BYPASS, AS A VIEW (2026-08-28) ----------------
     Paul: *"There doesn't seem to be a way to even turn the final mix off."*
     There is one control for that on the board's main strip, and it is NOT an
     eighth stored fact — a `sound.master.bypass` boolean would be a second
     owner of seven values that already own themselves, and the first hand to
     touch `drive` afterwards would leave the record saying two things at once.
     It is a VIEW: pressing it writes `none` into all seven words, and the
     board redraws showing seven `none`s, because that IS what happened. The
     inverse question ("is the master off right now?") is asked of the same
     seven values rather than of a flag.

     Derived rather than typed, so a table that grows an off-word cannot drift
     from the button: each field contributes its own bypass spelling, which is
     `none` where a table has one and the table's first key otherwise. */
  const MASTER_NONE = Object.freeze(Object.fromEntries(MASTER.map((f) =>
    [f.key, Object.prototype.hasOwnProperty.call(f.table, "none")
              ? "none" : Object.keys(f.table)[0]])));
  const masterIsNone = (m) => !!m && typeof m === "object" &&
    MASTER.every((f) => m[f.key] === MASTER_NONE[f.key]);

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
    // ...and THE SAMPLING CRATE (2026-08-30 — Paul: "bring over sampling from
    // the old version. We use it for texture and we use it as way of doing
    // vocal stabs and SFX"). Ten recordings the parent's sampler library has
    // carried all along with no word to reach them — MEASURED 2026-08-30
    // through audio/to-engine.js recipeFor itself: every id below comes back
    // `sampler:<id>` (never a patch, never unrouted), which is what makes the
    // loop strip honest on the chair that seats one. Three uses, Paul's own
    // words, and the ids that answer each:
    //   STABS    orchestra_hit — THE rave stab (Essex 1991 plays it now); its
    //            two zones are the only UNLOOPED ones in this crate, a hit by
    //            construction. (The VOCAL stab is `space_voice`, already
    //            offered eight lines up — the one voice-family recording the
    //            patch tables leave to the sampler; instruments.js
    //            SAMPLED_VOICES is where it is declared a voice for the
    //            instrumental-record door.)
    //   TEXTURE  atmosphere, soundtrack, ice_rain, crystal, fantasia,
    //            star_theme, brightness, goblin — the GM FX shelf: looped
    //            zones that sustain under the gate, which is what a bed IS.
    //   SFX      sea_shore (GM 122) and, SINCE 2026-08-30, the eight this
    //            block used to name as a MEASURED GAP. It read: "gun_shot,
    //            helicopter, applause, telephone, bird_tweet, reverse_cymbal,
    //            breath_noise and fret_noise have zones ON DISK and NO row in
    //            the parent's SAMPLERS registry — recipeFor returns
    //            `unrouted` for all eight — so offering them here would be a
    //            word that cannot reach the sound. They join this list the
    //            day the engine lane registers them." That day is today:
    //            engine/registry-data.js carries all eight, each row
    //            EXTRACTED from its own zones.json by build/samplers-row.js
    //            (whose proof is that it re-derives the committed sea_shore
    //            line byte-identically), and test/sfx-shelf.test.js renders
    //            every one through the shipped mixPCM — helicopter and
    //            applause sustain as beds, the other six are one-shots.
    for (const id of ["orchestra_hit", "atmosphere", "soundtrack", "ice_rain",
                      "crystal", "fantasia", "star_theme", "brightness",
                      "goblin", "sea_shore",
                      "gun_shot", "helicopter", "applause", "telephone",
                      "bird_tweet", "reverse_cymbal", "breath_noise",
                      "fret_noise"]) ids.add(id);
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

  // ...AND THE BASS CHAIR'S OWN VOCABULARY, which is NOT the other seven's
  // (2026-08-28, "I've lost all ability to select or customize the bass").
  //
  // WHY THIS LIST EXISTS AT ALL. The bass is the only POOLCHAIR the box has
  // no other way to cast: every pitched chair carries its instrument on the
  // document now (`voices[].instrument`, avail.js `sound.instrument`, through
  // document.js's `chairs` seam), and the bass voice carries a STYLE and a
  // development word and no instrument at all — so `POOL.bass` is the one
  // wire that reaches audio/plan.js's bass seat. Measured 2026-08-28 on
  // Kingston 1969 through audio/plan.js `seats()`: with no pool the bass seat
  // is `acoustic_bass`; with `POOL.bass = fretless_bass` it is
  // `fretless_bass`. The wire works; nothing could reach it.
  //
  // AND A WORD THAT CASTS A GLOCKENSPIEL INTO THE BASS CHAIR IS A WORD THAT
  // LIES. INSTRCHOICES is 90 ids wide because it is the union of what every
  // chair may hold; handed to the bass it offers `music_box` and `celesta`,
  // and `setPoolChair("bass", "glockenspiel")` was accepted. The eleven below
  // are the bass rack's own instruments (bass-kit.js INSTRUMENTS, whose gate
  // already holds each word to a real recording with a RANGES compass), in
  // the rack's own order, so the two lists cannot drift.
  const BASSCHOICES = {};
  for (const id of ["finger_bass", "picked_bass", "bass_lead", "acoustic_bass",
                    "cello", "fretless_bass", "slap_bass", "pop_bass",
                    "synth_bass_1", "synth_bass_2", "contrabass"])
    if (INSTRCHOICES[id]) BASSCHOICES[id] = INSTRCHOICES[id];

  // WHAT A CHAIR MAY BE HANDED, as one predicate with one owner. ui/state.js
  // `setPoolChair` (the live edit) and song.js `validateSong` (the saved
  // document) both asked this question and asked it differently — the live
  // one against INSTRCHOICES, the saved one against INSTRCHOICES — which is
  // the same answer twice until the bass gets a narrower list, and then it is
  // two laws. It is one call now, so a pool a hand can write and a pool a file
  // can carry are the same pool.
  const poolTakes = (chair, id) =>
    POOLCHAIRS.indexOf(chair) >= 0 && id != null &&
    Object.prototype.hasOwnProperty.call(
      chair === "bass" ? BASSCHOICES : INSTRCHOICES, String(id));

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
    // THE THREE A RECORDING CAN ANSWER (2026-08-28) — see the VOX table's own
    // note. They are on the same tab as the five synth knobs because they are
    // the same kind of decision (what this voice sounds like, per layer), and
    // they are the FIRST controls on this page that a sampled chair can hear.
    { key: "atk",     scope: "layer", type: "vox", table: VOX.atk.t,  labels: VOX.atk.labels,
      tab: "voice",  group: "attack",                  default: null },
    { key: "rel",     scope: "layer", type: "vox", table: VOX.rel.t,  labels: VOX.rel.labels,
      tab: "voice",  group: "release",                 default: null },
    { key: "dbl",     scope: "layer", type: "vox", table: VOX.dbl.t,  labels: VOX.dbl.labels,
      tab: "voice",  group: "doubling",                default: null },
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
    // ---- RETIRED: `verb`, the box's reverb ROOM (2026-08-28) --------------
    // A three-word row — room / hall / plate — measured dead on 2026-08-28 by
    // walking all three onto every box of a house record with `rev: drown`
    // under them: plan.js parentState, desk.js masterState and every barPlan
    // came back bit-identical. Nothing in nukernel/audio/ ever read it; every
    // `verb` in that directory is `tone.verb`, the genre's 0..1 wetness, which
    // is a different fact wearing the same word.
    //
    // AND IT IS RETIRED RATHER THAN WIRED, which is the half that took the
    // argument. Its live spelling is `buses.rev.color` (REVERBS above), and
    // that resolves to `state.reverbColor` -> an EXTERNAL WASM MODULE
    // (engine/faust/voices/state-engine.js REVERB_COLORS -> dist/reverb_*),
    // INSTANTIATED ONCE when the stream opens (press.js:405, stream-renderer
    // openLive's `revColor`). There is no per-bar port for it and there cannot
    // be a cheap one: a per-section room means loading five reverbs and
    // crossfading their tails, which is an engine stage this build does not
    // have. Its sibling `dtime` below WAS wired in this same round precisely
    // because the delay's time IS a live fx_bus slider with a per-bar glide —
    // so the two rows were not one decision, and the difference is the port.
    //
    // THE SAVED KEY IS MIGRATED, NOT FOLDED. song.js migrate() deletes `verb`
    // off every box of every older save (the GROOVE LIFT's own pattern, keyed
    // on the field's presence), so a shipped record neither throws nor keeps a
    // key no validator checks. It is NOT folded onto `buses.rev.color` the way
    // document.js normalize() folds `sound.fx` onto the chairs, and the
    // difference is the law: a fold is legal when the retired key has a live
    // home MEANING THE SAME THING (a character chip is a character chip), and
    // `verb`'s three rooms are not the module list — `room` names no module at
    // all. Folding "hall" onto reverbColor would switch the three presets that
    // carry one onto reverb_fdn, an external reverb they were never mixed
    // against. A saved record must not silently change; deleting a key that
    // reached nothing changes nothing, and that is the whole test.
    // `echo` was persisted as `del` through v:1 — a name shared with both the
    // kernel's delete operator and the delay send it fed, which is exactly the
    // kind of pun that survives until a grep goes wrong. song.js migrates.
    { key: "echo",    scope: "box",   table: SENDS,    labels: SENDLABEL,
      tab: "fx",     group: "echo",                    default: null },
    // MEASURED DEAD 2026-08-28 on the same walk as `verb` above — all six
    // subdivisions onto every box, `echo: drown` under them, one bit-identical
    // engine handoff — AND WIRED THE SAME DAY, which is the difference between
    // the two rows. `dtime` is not a word the engine cannot say: it is fx_bus's
    // own `dtime` slider (engine/faust/dsp/fx_bus.dsp:18, read by state-engine
    // fxParams as `clamp(delay.beats * spb, 0.02, 1.9)`), and the parent has a
    // PER-BAR port onto it — stream-renderer feedBar glides every changed
    // `bar.fxParams` key onto the persistent proc from that bar's first block,
    // which is the same wire the rack's own knob already rides once a bar.
    //
    // THE WIRE, end to end: audio/desk.js `barEchoSec` turns this word into the
    // parent's own seconds (the SAME arithmetic masterState uses for
    // `buses.echo.time`, off the SAME DTIMES table, so a box and the rack
    // cannot mean different lengths by "d8"); audio/plan.js barPlan carries it
    // as the bar's `fx`; audio/live.js hands it over on the foreign-composer
    // seam and the two export presses merge it into their own per-bar fxParams.
    //
    // THE SONG STILL OWNS THE DELAY, and the box only borrows it. There is ONE
    // delay machine on the master bus, fed by every strip's send, so a per-box
    // time is a borrowed knob and not a second one: `buses.echo.time` is the
    // record's echo, this row overrides it for that section's bars, and a bar
    // whose box says nothing is handed the SONG's value back EXPLICITLY rather
    // than left on the last box's (a glide only writes changed keys, so a
    // silent fallback would make the delay sticky — the same bar would sound
    // different depending on what played before it, which is not determinism).
    //
    // ABSENT IS TODAY, EXACTLY: plan.js emits no `fx` at all unless some box in
    // the song names a `dtime`, so every record that has never used the word
    // renders the byte-identical handoff it always did.
    { key: "dtime",   scope: "box",   table: DTIMES,   labels: DTLABEL,
      tab: "fx",     group: "echo time",               default: null },
    // the box's THIRD send, so the section strip speaks the same three-bus
    // sentence its own tracks do (PARTMIX `room` above has the law)
    { key: "room",    scope: "box",   table: SENDS,    labels: SENDLABEL,
      tab: "fx",     group: "room",                    default: null },
    { key: "lvl",     scope: "box",   table: LEVELS,   labels: LEVELLABEL,
      tab: "fx",     group: "level",                   default: null,
      axis: "form", get ask() { return T("field.level"); },
      get none() { return T("value.default"); } },
    { key: "pan",     scope: "box",   table: PANS,     labels: PANLABEL,
      tab: "fx",     group: "place",                   default: null },
    { key: "intro",   scope: "box",   table: INLABEL,  labels: INLABEL,
      tab: "move",   group: "intro",                   default: null,
      axis: "form", get ask() { return T("field.intro"); },
      get none() { return T("value.default"); } },
    { key: "outro",   scope: "box",   table: OUTLABEL, labels: OUTLABEL,
      tab: "move",   group: "outro",                   default: null,
      axis: "form", get ask() { return T("field.outro"); },
      get none() { return T("value.default"); } },
    { key: "env",     scope: "box",   table: ENVLABEL, labels: ENVLABEL,
      tab: "move",   group: "level over the section",  default: null,
      axis: "form", get ask() { return T("field.dynamics"); },
      get none() { return T("value.default"); } },
    { key: "mot",     scope: "box",   table: MOTLABEL, labels: MOTLABEL,
      tab: "move",   group: "filter over the section", default: null,
      axis: "form", get ask() { return T("field.filter"); },
      get none() { return T("value.default"); } },
    // the window onto the genre's form — numeric, clamped rather than rejected
    { key: "len",     scope: "box",   type: "int", min: 1, max: MAX_LEN,
      tab: "song",   group: "length",                  default: 4 },
    // THE ONE FORM NUDGE THAT IS A NUMBER ON A LINE, not a word from a list:
    // ui/derive.js:396 reads it as "start this section n bars into the phrase",
    // which is how a chorus comes in on the second half of the tune. It carries
    // `axis` like its neighbours and no `none`, because a slider's absence is 0.
    { key: "nudge",   scope: "box",   type: "int", min: 0, max: MAX_NUDGE,
      tab: "song",   group: "nudge",                   default: 0,
      axis: "form", get ask() { return T("field.start"); } },
    // ---- the composition-depth surface (P4) — appended, never reordered ----
    { key: "key",     scope: "box",   table: KEYS,        labels: KEYLABEL,
      tab: "sound",  group: "key",                     default: null },
    { key: "prog",    scope: "box",   table: PROGCHOICES, labels: PROGLABEL,
      tab: "sound",  group: "progression",             default: null },
    { key: "period",  scope: "box",   table: PERIODS,     labels: PERIODLABEL,
      tab: "sound",  group: "sentence",                default: null,
      axis: "development", get ask() { return T("field.phraseStructure"); },
      get none() { return T("value.default"); } },
    { key: "breath",  scope: "box",   table: BREATHS,     labels: BREATHLABEL,
      tab: "line",   group: "breath",                  default: null,
      axis: "development", get ask() { return T("field.noteLength"); },
      get none() { return T("value.default"); } },
    { key: "pipe",    scope: "box",   table: PIPESETS,    labels: PIPELABEL,
      tab: "line",   group: "pipe",                    default: null,
      axis: "development", get ask() { return T("field.afterNote"); },
      get none() { return T("value.default"); } },
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
    /* ---- the pace — appended, never reordered (2026-09-02) --------------
       THE ONE DEALT WORD WITH NO CONTROL, and the whole of the fix. compose.js
       dealPaces has written `b.pace` since 2026-08-30, document.js:456 carries
       it from the section to the box, audio/plan.js paceTL multiplies it into
       bar seconds, and ui/engineer.js printed it as TEXT in a row header with a
       note saying a control "would need the deal to read a hand back, and that
       is not asked". It is asked now (Paul, B7), and the deal does not have to
       read anything back: this is the same absent-is-today enum every other
       box word is, and `dealPaces` only ever writes onto a box the arrangement
       just built.
       `axis: "form"` is what makes it ARRIVE: avail.js's generated sheets loop
       mints `form.pace` from this row, `nudgesFor("form")` puts it in the
       nudge census, and ui/eight.js's pace strip draws it. One row here, no
       edit in avail.js, none in the view — interview.js's law, one layer down.
       `tab: "song"` beside `len` and `nudge`, because in the daw's palette the
       pace is a fact about the section's shape and not about its sound. */
    /* AND THE EMPTY DETENT SAYS THE DERIVED WORD (2026-09-02, the fix round).
       It said "—" for one day, on the section-scope idiom ("this section says
       nothing and the standing answer stands", avail.js material.cell), and
       the probe measured what that reads like: *"The pace strip never says
       what the pace is: all nine sel|form.pace|sN read "" and display "—",
       while Structure/Mix row heads print the dealt word … meter seats its
       derived word ("four") for the same "" value."* The dash was wrong here
       because pace has no standing answer to inherit: `audio/plan.js paceTL`
       skips a bar whose section says no word AND a bar that says `steady`
       ("no word, or the word for 1" — PACE_RATE.steady is 1), so absent and
       `steady` are the same sound to the byte. Saying so is `time.swing`'s
       own shape one row up in avail.js, where the empty detent is labelled
       `straight` and `straight` is also a rung of SWINGLABEL — the word for
       saying nothing is the thing that then happens. */
    { key: "pace",    scope: "box",   table: PACELABEL, labels: PACELABEL,
      tab: "song",   group: "pace",                      default: null,
      axis: "form", get ask() { return T("field.tempo"); },
      get none() { return T("value.default"); } },
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
    { value: "", label: f.none == null ? T("value.default") : f.none },
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
             // THE LABEL IS THE NOUN AND THE QUESTION STAYS A QUESTION.
             // `askable.js` writes both: `label` is what a control is called,
             // `ask` is what the interview asks. This surface is a control.
             get ask() { return T(r.label); }, group: r.head,
             get none() { return T("value.default"); },
             get options() { return [{ value: "", label: T("value.default") },
                       ...r.opts.map(([w]) => ({ value: w, label: w }))]; } };
  };
  /** Every axis control for one axis, in REGISTRY order.
   *  -> [{ key, axis, scope, ask, group, none, options? , type?, min?, max? }] */
  function nudgesFor(axis) {
    if (axis === "performance") return PERFROWS.map(perfRow).filter(Boolean);
    return FIELDS.filter((f) => f.axis === axis).map((f) => {
      const row = { key: f.key, axis: f.axis, scope: "section",
        get ask() { return f.ask; }, group: f.group,
        get none() { return f.none; } };
      /* THE OPTION LIST IS BUILT WHEN THE SHEET IS DRAWN, not when this list
         is minted: `avail.js` mints its SHEETS at load, and a label resolved
         there would be resolved before ui/copy.js has set the catalogue.
         AND IT IS `defineProperty` AND NOT A SPREAD, which is where the first
         version of this got it wrong and printed `value.default` — the key
         itself — on nine section rows. AN OBJECT SPREAD COPIES A GETTER'S
         VALUE, NOT THE GETTER: `{...{ get options() {…} }}` calls it once, at
         spread time, which here is `avail.js`'s load — before ui/copy.js has
         run. Measured on the rendered page: `SHEETS["form.lvl"].values()[0]`
         read `value.default` while a fresh `nudgesFor("form")` read
         `default`. */
      if (f.type === "int") { row.type = "int"; row.min = f.min; row.max = f.max; }
      else Object.defineProperty(row, "options",
        { get: () => nudgeOpts(f), enumerable: true, configurable: true });
      return row;
    });
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

  const api = { NSLOTS, MAX_LEN, MAX_NUDGE, MAX_FX, BPM_LO, BPM_HI,
                BPM_STEP, bpmSay, BPM_ROW_LO, BPM_ROW_HI,
                OPS, OPLABEL, ENVLABEL, MOTLABEL, INLABEL, OUTLABEL,
                RATES, RATELABEL, SWINGS, SWINGLABEL, GROOVELABEL, METERLABEL,
                // the pace ladder, moved down from compose.js's closure so the UI
                // may read it (2026-09-02) — compose.js re-exports it unchanged
                PACES, PACELABEL,
                KITLABEL, KITNAME, VERBLABEL, DRUMKITS, DRUMLANES, BASSOPS,
                FX, FXLABEL, fxChain, FXSEND, fxMix, fxSendable,
                FXWETS, FXWETLABEL, FXPOTS, FXPOTLABEL, FXFACE,
                fxHasMix, fxChainFor, busFxChain,
                TRIMS, TRIMLABEL, trimApply,
                CELLAUTO, CELLAUTOBY, cellAutoOffset, cellAutoClean,
                CELLVEC, CELLVECBY, cellVecClean,
                SENDS, SENDLABEL,
                DTIMES, DTLABEL, LEVELS, LEVELLABEL, PANS, PANLABEL,
                RETURNS, RETURNLABEL, ERETURNS, REVERBS, REVERBLABEL,
                EBLEEDS, EBLEEDLABEL, GLEVELS, GLEVELLABEL, GXCHIPS,
                VOX, VOXPARAM, VOXDOUBLE, VOICINGS, VOICING_KEYS,
                PLAYMODES, PLAYMODE_KEYS, OCTAVES, ARTICS, CMODES, CLAMPS, CLAMPLABEL,
                KEYS, KEYLABEL, KEYNAMES, wrapKey, KEYMODES, KEYMODELABEL,
                FIFTHS, relMinorOf, RELMINNAME, minorish,
                PROGCHOICES, PROGLABEL, PERIODS, PERIODLABEL,
                BREATHS, BREATHLABEL, PIPESETS, PIPELABEL, PARTCHOICES,
                PARTNAMES, PARTLABEL, PARTMIX, PARTMIXBY, MAX_CHAIRS,
                THROATS, isThroat,
                readPartKey, okPartKey, partChairLabel, chairKeys, resolvePartMix,
                faderDb,
                EQ_BANDS, BUS_EQ_BANDS, EQ_RANGE, eqDb, resolveEq, eqIsFlat,
                DRIVES, DRIVELABEL, GLUES, GLUELABEL, TAPES, TAPELABEL,
                SPACES, SPACELABEL, WIDTHS, WIDTHLABEL, TILTS, TILTLABEL,
                CEILINGS, CEILINGLABEL, MASTER, MASTERBY,
                resolveMaster, masterIsDefault, MASTER_NONE, masterIsNone,
                BUSES, BUSBY, resolveBuses, busesIsDefault,
                BUSNAMES, busNameOf, BUSTO, BUSDEFAULT, busRoute, busToOk,
                AUTOPARAMS, AUTOPARAMLABEL, AUTOSHAPES, AUTOSHAPELABEL, autoShape,
                INSTRCHOICES, POOLCHAIRS, BASSCHOICES, poolTakes,
                NUDGEGATE, nudgesFor, nudgeGate, nudgeValue, nudgeWord,
                ROLES, FIELDS, FIELD };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuFields = api;
})(typeof window !== "undefined" ? window : globalThis);
