// nukernel/askable.js — THE GRAPH AS ANNOTATIONS ON THE KERNEL.
//
// The chairs grew the other way round: each kit file knew its own words and
// wrote whatever kernel fields it happened to need, and "how much of the
// kernel can you reach by answering questions" could only be answered by
// walking the whole graph and diffing renders (test/unit/kernel-coverage).
// That works, but it is a measurement of an accident.
//
// This is the inversion: one row per kernel field, saying WHO owns it (which
// musical role is asked), WHAT the question is, and WHICH answers exist —
// or, for a field no question should reach, why not. The chairs become views
// over these rows, the coverage gate reads the table instead of inferring
// it, and a kernel that grows a knob has an obvious place to declare it.
//
// WHAT STAYS IN THE KITS: content. A drum groove, a bass figure, a melodic
// cell and a keys phrase are not knob VALUES, they are music — sixteen-step
// vectors somebody wrote. The annotations cover the kernel's SCALAR and
// ENUM surface, which is exactly the part a question tree can be complete
// over. That split is the honest one, and it is why "complete access via
// Q&A" is true of the fields and not of the value space.
//
// A row's `opts` are distinct BY CONSTRUCTION (distinct values on one
// field), which is also what makes them cheap: the pruner does not need to
// render a section to know two answers differ.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuAskable = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // the kernel's own alphabets, by name (kernel.js PENT / MODE and friends)
  //
  // `mode` was called "every note in the key" — false on a major-key record
  // (measured: it played Ab and Eb against F major, because the value IS the
  // natural minor, kernel.js MODE). Named honestly now, in the house voice
  // band-kit's own question uses ("major or minor?"). SAVED SESSIONS keep
  // both the VALUE and the word (band-kit knobs + knobs.__said), so an old
  // session restores byte-identical: the gig sheet prints the word that was
  // answered, and re-asking lights the same value under its new name —
  // nothing to map, nothing throws.
  const SCALES = {
    pent:  { w: "the pentatonic", v: [0, 3, 5, 7, 10] },
    mode:  { w: "the minor scale", v: [0, 2, 3, 5, 7, 8, 10] },
    blues: { w: "the blues scale", v: [0, 3, 5, 6, 7, 10] },
    major: { w: "a major pentatonic", v: [0, 2, 4, 7, 9] },
    // ...and the major scale itself, which simply was not offered — in a
    // system whose harmony is ionian (genres.js MODES.ionian, the same
    // seven notes)
    ionian: { w: "the major scale", v: [0, 2, 4, 5, 7, 9, 11] },
  };

  // ONE ROW PER FIELD. `role` is the chair that is asked; `ask` is the
  // question; `opts` are [word, value]. Everything here lands on the genre
  // the section hands the kernel.
  //
  // `meter` IS NOT A ROW HERE, AND THAT IS DELIBERATE. The arranger asks
  // "how does it count?" (band-kit ARR) and the answer reaches `g.meter`, so
  // the coverage gate counts it REACHED and it needs no NOT_ASKED row — but
  // it must not become a knob. A knob writes one value onto the genre and
  // nothing else, and a meter is the whole band's: the same answer re-seats
  // every chair's bar (band-kit seatMeter), reopens the drummer's family and
  // moves the count row. A second door onto the same field would put a
  // twelve-step meter on the genre while six chairs still handed the kernel
  // sixteen-step vectors — which is a bug generator, not a question.
  // EVERY ROW SAYS WHICH HEADING IT LIVES UNDER (`head`). The page groups a
  // seat's questions by the head each row declares and by nothing else —
  // there is no table in the view any more — so a knob added here without a
  // head is a question with no home, which test/unit/every-head.test.js
  // fails on rather than letting it slide into a nameless run.
  const ASKABLE = [
    { field: "stress", head: "the feel", role: "drums", ask: "how much does the band lean on the beat?",
      opts: [["dead straight", 0], ["a little", 0.35], ["hard on the one", 0.8]] },
    { field: "phrase", head: "the sound", role: "keys", ask: "does the line breathe?",
      opts: [["flat", 0], ["a little", 0.4], ["it arches", 0.85]] },
    { field: "maxHold", head: "the sound", role: "keys", ask: "how long do the notes hold?",
      opts: [["let them ring", 0], ["a beat", 4], ["half a bar", 8]] },
    { field: "orn", head: "the sound", role: "guitar", ask: "how much decoration?",
      opts: [["none", null], ["a grace here and there", { grace: 0.22 }],
             ["passing notes too", { grace: 0.25, approach: 0.3, pass: 0.3 }],
             ["it never sits still", { grace: 0.4, approach: 0.4, pass: 0.4, roll: 0.2 }]] },
    { field: "scale", head: "the tune", role: "arranger", ask: "what notes is the tune made of?",
      opts: Object.values(SCALES).map((s) => [s.w, s.v]) },
    { field: "diatonic", head: "the tune", role: "arranger", ask: "does the line follow the chords?",
      opts: [["it follows the chords", false], ["it stays in the key", true]] },
    { field: "kitProb", head: "the feel", role: "drums", ask: "does every hat land?",
      opts: [["every one", null],
             ["most of them", { h: [7,7,7,7, 7,7,7,7, 7,7,7,7, 7,7,7,7] }],
             ["about half", { h: [5,5,5,5, 5,5,5,5, 5,5,5,5, 5,5,5,5] }],
             ["now and then", { h: [3,3,3,3, 3,3,3,3, 3,3,3,3, 3,3,3,3] }]] },
    { field: "fill", head: "the fills", role: "drums", ask: "what's the fill made of?",
      opts: [["on the snare", { s: [0,0,0,0, 0,0,0,0, 1,0,1,1, 1,0,1,1] }],
             ["round the toms", { s: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
                                  t: [0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
                                  m: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
                                  l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,1] }]] },
  ];

  // ...and the fields no question reaches, with the reason. A row here is a
  // decision, not an oversight — the coverage gate reads this table, so a
  // field that is neither askable nor listed fails.
  const NOT_ASKED = {
    kitSeed:  "the dice, not a choice: the seed a genre's kit chance draws from",
    anchor:   "an identity field the daw's catalog uses; a session has no anchor",
    swing:    "the SONG's, not the genre's — the word in a numeric field was the " +
              "NaN that stopped the engine dead, so it is routed through setSwing",
    bassGrid: "superseded by `bassFig`, which says where the notes fall AND which " +
              "octave, accent and slide each one takes",
    ghost:    "takes a WORD LIST (an operator phrase), not a value: it is content, " +
              "and content lives in a kit file",
    incMode:  "how the line's `inc` steps are read — an internal of the line " +
              "writer, and nothing in this box writes `inc`",
    incClamp: "the ceiling on those same steps, and unreachable for the same reason",
  };

  // ...and a third kind: fields the chairs WRITE without anybody being asked.
  // Not a gap and not a question — a consequence. (`prog` is the interesting
  // one: the melody layer writes it to pair the changes into a longer
  // phrase, so the FIELD is covered while chord QUALITY, which is what
  // `prog` is for, is still unsayable. The coverage gate holds that
  // separately, at the value level, rather than letting the field count as
  // done.)
  const WRITTEN = {
    touch: "folded into the drummer's own \"how tight to the grid?\" — each of its " +
           "answers writes humanize + touch + hand together, because the axes were " +
           "never independent (a machine is never loose)",
    hand:  "the same fold: \"a machine\" is the programmed hand, every other answer " +
           "is a played one — one question, three fields",
    prog:  "the arranger CALLS it now (what kind of chords? — plain triads / " +
           "sevenths where they belong / on everything / ninths / suspended / sixths), " +
           "and the melody layer pairs the same objects into its longer phrase. " +
           "Not an `askable` row because the question writes chord OBJECTS " +
           "derived from the changes, not one value onto one field",
    label: "the genre's NAME, written by the chairs and never chosen",
  };

  const forRole = (role) => ASKABLE.filter((r) => r.role === role);
  // the value a word names, for one row
  const valueOf = (row, w) => { const o = row.opts.find((x) => x[0] === w); return o ? o[1] : undefined; };
  // every knob a song carries, as the genre fields the kernel reads
  const merge = (genre, knobs) => {
    if (!knobs) return genre;
    const out = { ...genre };
    for (const [f, v] of Object.entries(knobs)) if (v !== undefined && v !== null) out[f] = v;
    return out;
  };

  return { ASKABLE, NOT_ASKED, WRITTEN, SCALES, forRole, valueOf, merge };
});
