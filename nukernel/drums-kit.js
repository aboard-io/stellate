// nukernel/drums/kit.js — THE KIT, as a model. Pure: no DOM, no audio, no
// state. A drum machine you talk to, and every word it knows is a function
// from a kit to a kit — which is what makes the whole vocabulary provable in
// node before a single sound is made.
//
// WHAT THIS LEARNED FROM THE COUCH (ui/rubin-lang.js) AND THEN DROPPED:
// there are no VERBS here. On the couch a sentence was verb + thing + how,
// which is right when the subject could be anything on the record; a machine
// that only plays drums already knows the subject, so an instruction is ONE
// WORD-PHRASE and one tap. "breakbeat". "hats". "fourth measure fill." The
// exactness law survives: a word is offered only when it would change the
// kit, so nothing tappable is decorative.
//
// The model is the kernel's own drum vocabulary and nothing else:
//   lanes   k kick · s snare · h hat · o open hat · c clap · p perc · t tom
//   bars    four, each with its own kit (kernel.js `kits` is read per bar,
//           which is how a fill lands on the fourth measure and nowhere else)
//   feel    humanize (a hand), swing, and a per-lane velocity contour
(function (root, factory) {
  const api = factory(typeof require !== "undefined" ? require("./chair.js") : root.NuChair);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuDrums = api;
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";
  // THE TOMS ARE THREE DRUMS. The kernel has had `t`/`m`/`l` — high, mid and
  // floor, routed to tomHi/tom/tomLo at 132/105/88 Hz — since the tom lanes
  // were split; this file only ever wrote `t`, so a tom was a texture and
  // never a MELODY. Three of our forty-four grooves used a tom at all. That
  // is the single biggest thing missing from a drummer whose signature is
  // the toms answering the voice (Katché on "In Your Eyes"), so they are
  // lanes here now, with their own words.
  const LANES = ["k", "s", "h", "o", "c", "p", "t", "m", "l"];
  const BARS = 4, N = 16;
  // the bar's vectors and its count are the chair's (chair.js) — the same
  // sixteen places every musician in this box builds from
  const { z, on, every } = C;
  /* ---------- AND THE BAR THAT DOES NOT COUNT IN FOUR ---------------------
     A drummer is the one chair where meter is not a re-seating job. A waltz
     is not four-on-the-floor with the fourth beat cut off — it is a
     different groove, with its own name, and truncating `on(0,4,8,12)` would
     make "in three" a lie that plays a 4/4 bar short. So the grooves come in
     THREE TABLES (below) and everything else in this file — the hands, the
     backbeat, the fills, the answer bar — is written as a SHAPE over the
     bar's own pulse rather than as sixteen indices.
     `lit` is how that stays honest both ways: under 4/4 it returns the
     literal that was always written, byte for byte, and only a declared
     meter ever runs the general form. */
  const { metOf, barOf, regrid } = C;
  const stepsOf = (m) => metOf(m).steps;
  const bar = (m) => barOf(metOf(m));
  const lit = (m, v, fn) => (metOf(m).steps === 16 ? v : fn(bar(m)));
  const uniq = (...vs) => { const set = new Set(); for (const v of vs) for (const i of v) set.add(i);
    return [...set].sort((a, b) => a - b); };
  const ixOf = (v) => v.reduce((a, x, i) => (x ? (a.push(i), a) : a), []);
  const clone = (kit) => Object.fromEntries(Object.entries(kit).map(([l, v]) => [l, v.slice()]));
  const empty = (m) => { const n = m ? stepsOf(m) : N;
    return Object.fromEntries(LANES.map(l => [l, new Array(n).fill(0)])); };
  const has = (kit, l) => (kit[l] || []).some(Boolean);
  const hits = (kit) => LANES.reduce((a, l) => a + (kit[l] || []).filter(Boolean).length, 0);
  // the sidecars are not lanes: "!s" is a hand on the snare, not a drum
  const laneKeys = (kit) => Object.keys(kit).filter(k => LANES.includes(k));

  // a MODEL is the kit, the four bars' worth of variation, and the feel
  const blank = () => ({ on: false, kit: empty(), fills: {}, drumkit: "acoustic",
                         humanize: 0, swing: null, vel: {}, bpm: 92,
                         touch: null, hand: null, answers: {}, fam: null, job: null });


  /* ---------- THE GROOVES: real bars, written out ------------------------
     A vocabulary of styles, AUTHORED HERE. Paul pointed at
     github.com/stephenhandley/DrumMachinePatterns, which is a transcription
     of René-Pierre Bardet's "260 Drum Machine Patterns" (Hal Leonard) and
     carries no licence — so nothing is copied from it: this project's own
     provenance rule (SOURCES.md) is exactly about not doing that. What a
     style NAME describes is a convention, and these bars are written from
     the convention: a bossa is a bossa because of where the kick and the rim
     fall, not because someone's transcription says so. Every one of them is
     held by the gate to be sixteen steps of real kernel lanes, non-empty,
     and distinct from every other. */
  const GROOVES = {
    four:      { k: on(0, 4, 8, 12), h: every(2), o: on(2, 6, 10, 14) },
    breakbeat: { k: on(0, 10), s: on(4, 12), h: every(2, 0), p: on(7, 14) },
    boombap:   { k: on(0, 3, 8, 11), s: on(4, 12), h: every(2) },
    amen:      { k: on(0, 10, 11), s: on(4, 7, 12, 14), h: every(2) },
    halftime:  { k: on(0, 6), s: on(8), h: every(2) },
    doubletime:{ k: on(0, 4, 8, 12), s: on(2, 6, 10, 14), h: every(1) },
    motorik:   { k: on(0, 8), s: on(4, 12), h: every(1) },
    tresillo:  { k: on(0, 3, 6, 11), s: on(4, 12), h: every(4) },
    disco:     { k: on(0, 4, 8, 12), o: on(2, 6, 10, 14), c: on(4, 12) },
    blast:     { k: every(2), s: every(2, 1), h: every(1) },
    sparse:    { k: on(0, 8), s: on(4, 12) },

    /* ROCK AND POP */
    rock:      { k: on(0, 8), s: on(4, 12), h: every(2) },
    rockdrive: { k: on(0, 6, 8, 14), s: on(4, 12), h: every(2) },
    punkbeat:  { k: every(2), s: on(4, 12), h: every(2) },
    stomp:     { k: on(0, 4, 8, 12), c: on(4, 12), t: on(6, 14) },
    surf:      { k: on(0, 6, 8), s: on(4, 12), h: every(1) },
    shufflerock:{ k: on(0, 6, 8, 14), s: on(4, 12), h: on(0, 3, 4, 7, 8, 11, 12, 15) },
    motownbeat:{ k: on(0, 8), s: on(4, 12), h: every(2), c: on(4, 12), p: every(2, 1) },
    train:     { k: on(0, 8), s: on(2, 4, 6, 10, 12, 14), h: every(2) },
    marchbeat: { k: on(0, 4, 8, 12), s: on(2, 3, 6, 7, 10, 11, 14, 15) },

    /* LATIN AND CARIBBEAN */
    bossa:     { k: on(0, 3, 8, 11), s: on(0, 6, 10), h: every(2) },
    samba:     { k: on(0, 3, 6, 8, 11, 14), s: on(2, 6, 10, 14), h: every(1) },
    rumba:     { k: on(0, 3, 6, 10, 12), s: on(4, 12), p: every(2) },
    chacha:    { k: on(0, 4, 8, 12), s: on(6, 14), c: on(4, 12), h: every(2) },
    mambo:     { k: on(0, 6, 8, 14), p: on(0, 2, 4, 6, 8, 10, 12, 14), s: on(4, 12) },
    songo:     { k: on(0, 6, 10), s: on(4, 12), t: on(2, 14), h: every(2) },
    onedrop:   { k: on(8), s: on(8), h: every(2) },
    steppers:  { k: on(0, 4, 8, 12), s: on(8), h: every(2) },
    rockers:   { k: on(0, 8), s: on(4, 12), h: on(2, 6, 10, 14) },

    /* FUNK AND SOUL */
    funk:      { k: on(0, 3, 10), s: on(4, 12), h: every(1) },
    neworleans:{ k: on(0, 3, 6, 8, 14), s: on(4, 12), t: on(10) },
    linear:    { k: on(0, 6), s: on(4, 12), h: on(2, 8, 10, 14) },
    purdie:    { k: on(0, 6, 10), s: on(4, 12), h: every(2), p: on(2, 14) },

    /* JAZZ */
    jazzride:  { p: on(0, 4, 6, 8, 12, 14), k: on(0, 8), s: on(6, 14) },
    bebop:     { p: on(0, 4, 6, 8, 12, 14), s: on(2, 10), k: on(0) },
    brushes:   { p: every(2), s: on(4, 12), k: on(0, 8) },

    /* THE OLD WORLD (2026-08-21) — what a drummer can honestly do on a
       record cut before the drum kit existed. `tacet` is SILENCE AS A
       GROOVE, and it is first-class on purpose: the pre-1900 records
       (chant, organum, a nocturne, a parlor song) have no kit, and the
       drummer's honest answer must be sayable at the same question every
       other answer is — the drumless law is that a chant must not inherit a
       kick by default, and a default is a groove word. It is the ONE entry
       the sixteen-real-steps gate (test/unit/drums-kit.test.js d3) exempts
       by name: its bar is empty because silence IS its bar. The other two
       are real bars: the pipe-and-tabor dance drum (the estampie's own dum,
       dum-dum) and the processional tread (the big drum carried, the low
       answer behind it). */
    tacet:     {},
    tabor:     { k: on(0, 6, 8), p: on(4, 12) },
    procession:{ k: on(0, 8), l: on(4, 12) },

    /* THE FLOOR */
    house:     { k: on(0, 4, 8, 12), o: on(2, 6, 10, 14), c: on(4, 12), h: every(2, 1) },
    techno:    { k: on(0, 4, 8, 12), h: every(1), o: on(2, 6, 10, 14) },
    garage:    { k: on(0, 10), s: on(4, 12), h: on(2, 3, 6, 10, 11, 14) },
    twostep:   { k: on(0, 10), s: on(4, 12), h: every(2, 1) },
    jungle:    { k: on(0, 10, 11), s: on(4, 12), h: every(2), p: on(7, 15) },
    dubstep:   { k: on(0), s: on(8), h: on(2, 6, 10, 14) },
    trapbeat:  { k: on(0, 6, 10), s: on(8), h: on(0, 2, 4, 6, 8, 9, 10, 12, 14, 15) },
    gabber:    { k: every(2), c: on(4, 12) },
  };

  /* ---------- THE GROOVES THAT DO NOT COUNT IN FOUR ----------------------
     Twelve steps, and the two ways to hear them. IN THREE the felt beat is
     the quarter (steps 0, 4, 8) — boom chick chick, and everything a waltz,
     a minuet, a mazurka or a jazz waltz is made of. IN SIX-EIGHT the felt
     beat is the DOTTED quarter (steps 0 and 6) and the count is six eighths
     — the lilt, the siciliana, the 6/8 march.

     These are AUTHORED, not derived. The parent ships the same three bars as
     csound-era kits (engine/csd-engine.js `waltz`, `waltzswing`, `sixeight`,
     and the `siciliana` bass cell) and they are transcribed onto this grid
     here: the parent's waltz is kick on the boom, snare on both chicks, hats
     on the eighth grid; its sixeight is kick on the two dotted-quarter
     pulses with the hat running the eighths, which is `lilt` below — the
     entry NAMED sixeight is that bar read as rock, with the extra kick on
     the third eighth (a groove has to differ from its neighbour or it is
     not a second answer). Everything else in these two
     tables is written from the convention the same way the forty-four above
     are, and `tacet` is in both because silence is a groove in any meter. */
  const on12 = (...ix) => { const v = new Array(12).fill(0); for (const i of ix) v[i] = 1; return v; };
  const ev12 = (n, from) => { const v = new Array(12).fill(0);
    for (let i = from || 0; i < 12; i += n) v[i] = 1; return v; };
  const GROOVES3 = {
    waltz:      { k: on12(0), s: on12(4, 8), h: ev12(2) },
    jazzwaltz:  { p: on12(0, 4, 6, 8, 11), s: on12(4), k: on12(0) },
    viennese:   { k: on12(0), s: on12(3, 8), h: on12(0, 4, 8) },
    mazurka:    { k: on12(0, 4), s: on12(4, 8), h: ev12(4) },
    boomchick:  { k: on12(0), c: on12(4, 8), h: ev12(4) },
    waltzrock:  { k: on12(0, 6), s: on12(4, 8), h: ev12(2) },
    minuet:     { p: on12(0, 4, 8), k: on12(0) },
    ledger:     { k: on12(0), l: on12(4, 8), h: on12(0, 4, 8) },
    tacet:      {},
  };
  const GROOVES6 = {
    lilt:       { k: on12(0, 6), s: on12(6), h: ev12(2) },
    sixeight:   { k: on12(0, 3, 6), s: on12(6), h: ev12(2) },
    siciliana:  { k: on12(0, 6), p: on12(0, 3, 4, 6, 9, 10) },
    sixmarch:   { k: on12(0, 6), s: on12(0, 2, 4, 6, 8, 10) },
    slowsix:    { k: on12(0), s: on12(6), h: on12(0, 3, 6, 9) },
    gospelsix:  { k: on12(0, 6), c: on12(6), h: ev12(2) },
    tarantella: { k: on12(0, 6), p: ev12(2), s: on12(4, 10) },
    tacet:      {},
  };
  const GROOVEWORD3 = {
    waltz: ["a waltz"], jazzwaltz: ["a jazz waltz"], viennese: ["a viennese lift"],
    mazurka: ["a mazurka"], boomchick: ["boom chick chick"],
    waltzrock: ["a rock waltz"], minuet: ["a minuet tap"],
    ledger: ["a slow three"], tacet: ["nobody on the kit"],
  };
  const GROOVEFAM3 = {
    waltz: "the ballroom", viennese: "the ballroom", boomchick: "the ballroom",
    mazurka: "the ballroom", minuet: "the ballroom",
    jazzwaltz: "jazz", waltzrock: "rock",
    // ...and the two that are not a dance: a slow three with the big drum on
    // the chicks is a tread, not a ballroom (it is what a hymn tune and a
    // funeral march have on the kit, which is nearly nothing), and silence
    // is a groove in any meter. THE OTHER TABLES' OLD WORLD HAS TWO ANSWERS
    // TOO — the tabor and the processional in four, the tarantella and the
    // siciliana in six — and a family with one answer is not a family, it is
    // a decision (the drummer would be handed "nobody on the kit" and asked
    // nothing).
    ledger: "the old world", tacet: "the old world",
  };
  const GROOVEWORD6 = {
    lilt: ["a lilt"], sixeight: ["a six-eight groove"], siciliana: ["a siciliana"],
    sixmarch: ["a march in six"], slowsix: ["a slow six"],
    gospelsix: ["a gospel six"], tarantella: ["a tarantella"],
    tacet: ["nobody on the kit"],
  };
  const GROOVEFAM6 = {
    lilt: "the lilt", slowsix: "the lilt", gospelsix: "the lilt",
    sixeight: "rock", tarantella: "the old world", siciliana: "the old world",
    sixmarch: "the old world", tacet: "the old world",
  };
  // WHICH TABLE THIS DRUMMER IS PLAYING OUT OF — one lookup, three answers
  const setFor = (met) => {
    const m2 = met || {};
    if (m2.steps === 12 && m2.pulse === 6)
      return { G: GROOVES6, W: GROOVEWORD6, F: GROOVEFAM6, first: "lilt" };
    if (m2.steps === 12) return { G: GROOVES3, W: GROOVEWORD3, F: GROOVEFAM3, first: "waltz" };
    return { G: GROOVES, W: GROOVEWORD, F: GROOVEFAM, first: "four" };
  };
  const setOf = (m) => setFor(metOf(m));

  // word, and which family it belongs to (the tray groups by family, because
  // forty grooves in one row is a list, not a vocabulary)
  const GROOVEWORD = {
    four: ["four on the floor"], breakbeat: ["breakbeat"], boombap: ["boom bap"],
    amen: ["amen break"], halftime: ["half time"], doubletime: ["double time"],
    motorik: ["motorik"], tresillo: ["tresillo"], disco: ["disco"],
    blast: ["blast beat"], sparse: ["bare bones"],
    rock: ["straight rock"], rockdrive: ["driving rock"], punkbeat: ["punk"],
    stomp: ["stomp"], surf: ["surf"], shufflerock: ["shuffle"],
    motownbeat: ["motown"], train: ["train beat"], marchbeat: ["march"],
    bossa: ["bossa nova"], samba: ["samba"], rumba: ["rumba"], chacha: ["cha cha"],
    mambo: ["mambo"], songo: ["songo"], onedrop: ["one drop"],
    steppers: ["steppers"], rockers: ["rockers"],
    funk: ["funk"], neworleans: ["new orleans"], linear: ["linear funk"],
    purdie: ["half-time shuffle"],
    jazzride: ["jazz ride"], bebop: ["bebop"], brushes: ["brush swing"],
    house: ["house"], techno: ["techno"], garage: ["uk garage"],
    twostep: ["two step"], jungle: ["jungle"], dubstep: ["dubstep"],
    trapbeat: ["trap"], gabber: ["gabber"],
    tacet: ["nobody on the kit"], tabor: ["the tabor"],
    procession: ["a processional"],
  };
  const GROOVEFAM = {
    four: "the floor", disco: "the floor", house: "the floor", techno: "the floor",
    garage: "the floor", twostep: "the floor", gabber: "the floor",
    breakbeat: "breaks", amen: "breaks", jungle: "breaks", dubstep: "breaks",
    trapbeat: "breaks", boombap: "breaks", blast: "breaks",
    rock: "rock", rockdrive: "rock", punkbeat: "rock", stomp: "rock", surf: "rock",
    shufflerock: "rock", motorik: "rock", train: "rock", marchbeat: "rock",
    halftime: "rock", doubletime: "rock", sparse: "rock",
    bossa: "latin", samba: "latin", rumba: "latin", chacha: "latin", mambo: "latin",
    songo: "latin", tresillo: "latin", onedrop: "latin", steppers: "latin",
    rockers: "latin",
    funk: "funk", neworleans: "funk", linear: "funk", purdie: "funk",
    motownbeat: "funk",
    jazzride: "jazz", bebop: "jazz", brushes: "jazz",
    tacet: "the old world", tabor: "the old world", procession: "the old world",
  };

  /* ---------- the lanes, as things you ask for ---------- */
  // `give`/`more` are the sixteen-place literals; `g3`/`m3` are the same
  // idea said as a SHAPE, and only a declared meter ever reads them.
  const LANEWORD = {
    hats:     { word: "hats", lane: "h", give: every(2), more: every(1),
                g3: (b) => b.every(2), m3: (b) => b.every(1) },
    openhats: { word: "open hats", lane: "o", give: on(2, 6, 10, 14), more: on(2, 4, 6, 10, 12, 14),
                g3: (b) => b.ands(), m3: (b) => b.on(...uniq(ixOf(b.ands()), ixOf(b.back()))) },
    claps:    { word: "claps", lane: "c", give: on(4, 12), more: on(4, 7, 12, 15),
                g3: (b) => b.back(),
                m3: (b) => b.on(...uniq(ixOf(b.back()), ixOf(b.back()).map((i) => i + b.pulse - 1))) },
    perc:     { word: "percussion", lane: "p", give: on(2, 7, 10, 14), more: every(2, 1),
                g3: (b) => b.on(...uniq(ixOf(b.ands()), [Math.min(b.n - 1, b.pulse + 3)])),
                m3: (b) => b.every(2, 1) },
    toms:     { word: "toms", lane: "t", give: on(6, 14), more: on(2, 6, 10, 14),
                g3: (b) => b.on(...ixOf(b.back()).map((i) => i + Math.floor(b.pulse / 2))),
                m3: (b) => b.ands() },
    midtom:   { word: "mid tom", lane: "m", give: on(10), more: on(6, 10, 14),
                g3: (b) => b.on(b.n - b.pulse - Math.floor(b.pulse / 2)),
                m3: (b) => b.on(...ixOf(b.ands()).filter((i) => i >= Math.floor(b.pulse / 2))) },
    floortom: { word: "floor tom", lane: "l", give: on(12), more: on(8, 12, 14),
                g3: (b) => b.beat(b.beats - 1),
                m3: (b) => b.on(...uniq(ixOf(b.beat(Math.max(0, b.beats - 2), b.beats - 1)), [b.n - 2])) },
    kick:     { word: "kick", lane: "k", give: on(0, 8), more: on(0, 3, 8, 11),
                g3: (b) => b.beat(0, Math.floor(b.beats / 2)),
                m3: (b) => { const ix = ixOf(b.beat(0, Math.floor(b.beats / 2)));
                             return b.on(...uniq(ix, ix.map((i) => i + b.pulse - 1))); } },
    snare:    { word: "snare", lane: "s", give: on(4, 12), more: on(4, 7, 12, 14),
                g3: (b) => b.back(),
                m3: (b) => { const ix = ixOf(b.back());
                             return b.on(...uniq(ix, ix.map((i) => i + b.pulse - 1))); } },
  };
  const laneVec = (m, L, which) =>
    lit(m, which === "more" ? L.more : L.give, which === "more" ? L.m3 : L.g3);
  const DROPWORD = { k: "no kick", s: "no snare", h: "no hats", o: "no open hats",
                     c: "no claps", p: "no percussion", t: "no toms",
                     m: "no mid tom", l: "no floor tom" };

  /* ---------- HOW A DRUMMER SAYS IT --------------------------------------
     Nobody at a kit thinks "kick on step ten". They think about where the
     BACKBEAT is, what the HANDS are keeping, whether the ghosts are in, and
     which limb has the ostinato — so those are words here too, and they act
     on whichever lanes they are about. Ghost notes are real: the kernel
     reads a step's LEVEL as its velocity (cell > 1), so a ghost is a 2 and
     an accent is a 9, and they arrive quieter and louder in the render
     rather than as a note somebody drew smaller. */
  const lvl = (v, ix, n) => { const out = v.slice(); for (const i of ix) out[i] = n; return out; };
  const HANDS = {
    quarters: every(4), eighths: every(2), sixteenths: every(1),
    shuffled: on(0, 3, 4, 7, 8, 11, 12, 15), offbeats: on(2, 6, 10, 14),
  };
  // ...and the same four hands in a bar that counts differently: quarters
  // become the bar's own beats, the shuffle is the swung pair inside each
  // one, offbeats are the ands of the pulse. `lit` holds 4/4 to the literals.
  const hand = (m, k) => lit(m, HANDS[k], (b) => {
    if (k === "quarters") return b.beats0();
    if (k === "eighths") return b.every(2);
    if (k === "sixteenths") return b.every(1);
    if (k === "offbeats") return b.ands();
    // shuffled: the long-short pair inside each beat — in six-eight the
    // eighths already ARE the shuffle, so that is what it plays
    if (b.pulse >= 6) return b.every(2);
    const v = b.z();
    for (let i = 0; i < b.n; i += b.pulse) { v[i] = 1; if (i + b.pulse - 1 < b.n) v[i + b.pulse - 1] = 1; }
    return v;
  });
  // THE SIDECARS — the kernel's own per-step hands, and the reason a lot of
  // this vocabulary can be honest rather than decorative. Beside a lane it
  // reads "!k" (grace notes: 1 flam, 2 drag, 3 ruff), "~k" (nudge, in ninths
  // of a step — ahead of the beat or behind it) and "?k" (chance, in ninths).
  // A drummer's push, lay-back, flam and "sometimes" are all right there.
  const side = (kit, mark, lane, vec) => { const k = clone(kit); k[mark + lane] = vec; return k; };
  const onHits = (kit, lane, n) => (kit[lane] || z()).map(v => (v ? n : 0));
  // the places a drummer's words are ABOUT, in this bar: the ands, the
  // downbeats, the backbeat, the last beat. Four in 4/4 is the literal.
  const ANDS = (m) => lit(m, [2, 6, 10, 14], (b) => ixOf(b.ands()));
  const DOWNS = (m) => lit(m, [0, 4, 8, 12], (b) => ixOf(b.beats0()));
  const LASTB = (m) => (metOf(m).steps - metOf(m).pulse);
  const DRUMMER = {
    "hands in quarters":   (m) => ({ ...m, kit: { ...clone(m.kit), h: hand(m, "quarters").slice() } }),
    "hands in eighths":    (m) => ({ ...m, kit: { ...clone(m.kit), h: hand(m, "eighths").slice() } }),
    "hands in sixteenths": (m) => ({ ...m, kit: { ...clone(m.kit), h: hand(m, "sixteenths").slice() } }),
    "hands shuffled":      (m) => ({ ...m, kit: { ...clone(m.kit), h: hand(m, "shuffled").slice() } }),
    "backbeat on two and four": (m) => ({ ...m, kit: { ...clone(m.kit),
      s: lit(m, on(4, 12), (b) => b.back()) } }),
    "backbeat on three":   (m) => ({ ...m, kit: { ...clone(m.kit),
      s: lit(m, on(8), (b) => b.beat(b.beats - 1)) } }),
    "ghost notes":         (m) => { const kit = clone(m.kit);
      kit.s = lvl(kit.s, ANDS(m).filter(i => !kit.s[i]), 2); return { ...m, kit }; },
    "accent the downbeats": (m) => { const kit = clone(m.kit);
      for (const l of LANES) if (has(kit, l))
        kit[l] = lvl(kit[l], DOWNS(m).filter(i => kit[l][i]), 9);
      return { ...m, kit }; },
    "ride it, not the hats": (m) => { const kit = clone(m.kit);
      kit.p = has(m.kit, "h") ? kit.h.slice() : hand(m, "quarters").slice();
      kit.h = z(); return { ...m, kit }; },
    // ...and if there is nothing on the ride either, "back to the hats"
    // means PLAY SOME: moving an empty ride onto an empty hat lane said the
    // word and made no sound, which is the one thing no word here may do.
    "back to the hats":    (m) => { const kit = clone(m.kit);
      kit.h = has(m.kit, "p") ? kit.p.slice() : hand(m, "eighths").slice();
      kit.p = z(); return { ...m, kit }; },
    "nothing on the one":  (m) => { const kit = clone(m.kit);
      kit.k = kit.k.slice(); kit.k[0] = 0; return { ...m, kit }; },
    "kick on the one only": (m) => ({ ...m, kit: { ...clone(m.kit),
      k: lit(m, on(0), (b) => b.on(0)) } }),
    "kick on the ands":    (m) => ({ ...m, kit: { ...clone(m.kit),
      k: lit(m, on(2, 6, 10, 14), (b) => b.ands()) } }),
    "double the kick":     (m) => { const k = clone(m.kit); const out = k.k.slice();
      const n = stepsOf(m), gap = metOf(m).pulse - 1;
      k.k.forEach((v, i) => { if (v && i + gap < n && !out[i + gap]) out[i + gap] = 1; });
      k.k = out; return { ...m, kit: k }; },
    "snare on every beat": (m) => ({ ...m, kit: { ...clone(m.kit),
      s: lit(m, every(4), (b) => b.beats0()) } }),
    "toms, not the snare": (m) => { const k = clone(m.kit);
      k.t = k.s.slice(); k.s = z(); return { ...m, kit: k }; },
    "floor tom on the ands": (m) => ({ ...m, kit: { ...clone(m.kit),
      l: lit(m, on(2, 6, 10, 14), (b) => b.ands()) } }),
    // A TOM MELODY: high, mid, floor across the second half of the bar, the
    // backbeat stepping out of its way. This is a PHRASE, not a fill — it is
    // the groove itself, which is what the toms are for.
    // the melody lives in the back half of the bar, the backbeat steps out
    "a tom melody":        (m) => { const k = clone(m.kit); const n = stepsOf(m);
      const h2 = Math.round(n / 2), lb = LASTB(m);
      k.t = lit(m, on(8), (b) => b.on(h2));
      k.m = lit(m, on(11), (b) => b.on(Math.min(n - 1, h2 + 3)));
      k.l = lit(m, on(14), (b) => b.on(n - 2));
      k.s = k.s.map((v, i) => (i >= h2 && i !== lb ? 0 : v));
      return { ...m, kit: k }; },
    "walk the toms down":  (m) => { const k = clone(m.kit);
      k.t = lit(m, on(0, 4), (b) => (b.beats >= 4 ? b.beat(0, 1) : b.beat(0)));
      k.m = lit(m, on(8), (b) => (b.beats >= 3 ? b.beat(b.beats - 2) : b.z()));
      k.l = lit(m, on(12), (b) => b.beat(b.beats - 1));
      return { ...m, kit: k }; },
    // PLAY THE SONG. Half of every hit in our forty-four grooves is a hi-hat.
    // A drummer serving a song pulls the hand back to quarters, drops the
    // decoration and leaves the kick and the backbeat holding the record up.
    // `vel.all` is a NUMBER here (VELROW: 6 + n*2) and writing the word
    // "soft" into it is the same NaN the swing once was — one notch down is
    // -1, and the gate that caught this is the reason it says so.
    "play the song":       (m) => { const k = clone(m.kit);
      const zz = new Array(stepsOf(m)).fill(0);
      k.h = hand(m, "quarters").slice(); k.o = zz.slice(); k.p = zz.slice(); k.c = zz.slice();
      return { ...m, kit: k, vel: { ...(m.vel || {}), all: -1 } }; },
    // the "and" of the last beat, whichever beat that is
    "open the hat on four": (m) => { const k = clone(m.kit);
      const at2 = Math.min(stepsOf(m) - 1, LASTB(m) + Math.floor(metOf(m).pulse / 2));
      k.o = k.o.slice(); k.o[at2] = 1; if (k.h) { k.h = k.h.slice(); k.h[at2] = 0; }
      return { ...m, kit: k }; },
    /* the sidecars — a hand, not a hit */
    "flam the backbeat":   (m) => ({ ...m, kit: side(m.kit, "!", "s", onHits(m.kit, "s", 1)) }),
    "drag the backbeat":   (m) => ({ ...m, kit: side(m.kit, "!", "s", onHits(m.kit, "s", 2)) }),
    "flam the kick":       (m) => ({ ...m, kit: side(m.kit, "!", "k", onHits(m.kit, "k", 1)) }),
    "play it straight again": (m) => { const k = clone(m.kit);
      for (const key of Object.keys(k)) if (/^[!~?]/.test(key)) delete k[key];
      return { ...m, kit: k }; },
    "push the hats":       (m) => ({ ...m, kit: side(m.kit, "~", "h", onHits(m.kit, "h", -1)) }),
    "lay the snare back":  (m) => ({ ...m, kit: side(m.kit, "~", "s", onHits(m.kit, "s", 1)) }),
    "push the kick":       (m) => ({ ...m, kit: side(m.kit, "~", "k", onHits(m.kit, "k", -1)) }),
    "let the hats breathe": (m) => ({ ...m, kit: side(m.kit, "?", "h", onHits(m.kit, "h", 7)) }),
    "the perc, in and out": (m) => ({ ...m, kit: side(m.kit, "?", "p", onHits(m.kit, "p", 5)) }),
    "crescendo the bar":   (m) => { const k = clone(m.kit);
      const last = stepsOf(m) - 1;
      for (const l of ["s", "h"]) if (has(k, l))
        k[l] = k[l].map((v, i) => (v ? Math.max(2, Math.min(9, 3 + Math.round(i * 6 / last))) : 0));
      return { ...m, kit: k }; },
    "accent the ands":     (m) => { const k = clone(m.kit); const ax = ANDS(m);
      for (const l of LANES) if (has(k, l))
        k[l] = k[l].map((v, i) => (v && ax.includes(i) ? 9 : v));
      return { ...m, kit: k }; },
  };

  /* ---------- the fill: one bar that is not the others ---------- */
  // toms in eighths across the back half, the snare on the one, the second
  // beat, its and, and the last three sixteenths — the shape, so a
  // twelve-step bar gets a real fill instead of a truncated one. In 4/4 the
  // numbers are the ones that were written.
  const FILLBAR = (kit, met) => {
    const b = barOf(met), n = b.n, p = b.pulse, four = n === 16;
    const f = clone(kit);
    f.t = four ? on(8, 10, 12, 14)
      : b.on(...Array.from({ length: Math.floor(n / 4) }, (_, k) => Math.round(n / 2) + 2 * k));
    f.s = four ? on(0, 4, 6, 13, 15) : b.on(0, p, p + 2, n - 3, n - 1);
    f.c = four ? z() : b.z();
    return f;
  };
  const FILLWORD = { 2: "second measure fill", 3: "third measure fill", 4: "fourth measure fill" };

  // EVERY NAME HERE IS A KIT THE ENGINE HAS (fields.js DRUMKITS + the four
  // machines to-engine.js knows). "linn drum" was in this list and was not
  // one of them: it routed nowhere, silently, and the page's own gate caught
  // it as a word that changed the machine and not the sound.
  const MACHINES = { tr808: "808", tr909: "909", tr606: "606", cr78: "cr-78",
                     acoustic: "acoustic kit", room: "room kit", power: "big kit",
                     brush: "brushes", jazz: "jazz kit", electronic: "electronic kit" };
  // ...and which half of the room each one is, for the interview's row
  // labels (ui/band.js ROWORDER draws them in this order). A machine and a
  // kit are not two brightnesses of one thing: one is four synthesised
  // voices, the other is six recordings of somebody hitting something.
  const MACHINEROW = { tr808: "drum machines:", tr909: "drum machines:",
                       tr606: "drum machines:", cr78: "drum machines:",
                       acoustic: "kits:", room: "kits:", power: "kits:",
                       brush: "kits:", jazz: "kits:", electronic: "kits:" };

  /* ---------- THE VOCABULARY: word-phrase -> what it does to the kit ------
     Each entry answers two questions and nothing else: is it worth offering
     right now (`when`), and what does it make (`apply`). */
  // `is` — is this already the case? The tray LIGHTS those rather than
  // hiding them ("when I tap something light it up, don't make it
  // disappear"), so the vocabulary doubles as the readout: what the machine
  // is doing is which words are lit. The registrar is the chair's.
  /* WHICH HEADING EACH TRAY SUBJECT LIVES UNDER. The subject is declared
     here, so its heading is declared here too — the page has no table of its
     own any more, it reads this one. The groove families are named by their
     family ("grooves · funk"), so they answer by prefix. */
  const HEADS = (g) => (g === "the machine" ? "the record's kit"
    : g.startsWith("grooves \u00b7 ") ? "the record's kit"
    : g === "the kit" || g === "take away" || g === "at the kit" || g === "the bar"
      ? "at the kit"
    : g === "the fills" ? "the fills"
    : g === "the feel" ? "the feel"
    : g === "the tempo" ? "the time-keeping" : null);
  const { V, add } = C.vocab(HEADS);

  // the kit this drummer starts on is the first groove of the table they are
  // playing out of: four on the floor in four, a waltz in three, a lilt in six
  const startKit = (m) => { const S = setOf(m); return { ...empty(m), ...S.G[S.first] }; };
  add("start", "start", ["add drums"], m => !m.on,
      m => ({ ...m, on: true, kit: startKit(m) }),
      (m) => "a " + (setOf(m).W[setOf(m).first] || ["four on the floor"])[0]
             .replace(/^a /, "") + ", and the machine is on");

  // A GROOVE BELONGS TO A METER. All three tables are registered here (a
  // vocabulary is a table and a table must not change shape per model), and
  // a groove whose meter is not the one being counted is simply never
  // offered — `gKit` comes back null and every guard reads false.
  const gKit = (m, g) => { const S = setOf(m); return S.G[g] ? { ...empty(m), ...S.G[g] } : null; };
  /* ---------- ONE STRINGIFY PER KIT ---------------------------------------
     Every guard in this file asks the same question — "would saying this
     leave the kit where it is?" — and every one of them answered it by
     building the kit the word would make and stringifying BOTH sides, on
     every draw, for every word. A drummer has 44 grooves and 30-odd words,
     the tray draws all of them, and the pruner upstairs draws the tray once
     per option: measured, the two lines below and their twins at the
     drummer's words were 1.8 s of self time in a single dice run.

     A drum model is immutable — every word in this box returns a new one,
     which is what the memos in chair.js and band-kit already rely on — so
     the string a kit makes is a fact about that kit and can be remembered
     against the kit itself. The kit a WORD would make is the same kind of
     fact, remembered against the model it would be said to. */
  const KITSTR = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  const kitStr = (kit) => {
    if (!KITSTR || !kit || typeof kit !== "object") return JSON.stringify(kit);
    let s = KITSTR.get(kit);
    if (s === undefined) KITSTR.set(kit, s = JSON.stringify(kit));
    return s;
  };
  const WORDKIT = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  const afterStr = (m, word, fn) => {
    if (!WORDKIT) return JSON.stringify(fn(m).kit);
    let per = WORDKIT.get(m);
    if (!per) WORDKIT.set(m, per = new Map());
    let s = per.get(word);
    if (s === undefined) per.set(word, s = JSON.stringify(fn(m).kit));
    return s;
  };
  const gSame = (m, g) => { const k = gKit(m, g);
    return !!k && kitStr(k) === kitStr(m.kit); };
  const ALLW = { ...GROOVEWORD3, ...GROOVEWORD6, ...GROOVEWORD };
  const ALLF = { ...GROOVEFAM3, ...GROOVEFAM6, ...GROOVEFAM };
  for (const g of [...Object.keys(GROOVEWORD),
                   ...Object.keys(GROOVEWORD3).filter((k) => !GROOVEWORD[k]),
                   ...Object.keys(GROOVEWORD6).filter((k) => !GROOVEWORD[k] && !GROOVEWORD3[k])])
    add("groove:" + g, "grooves · " + (ALLF[g] || "other"), ALLW[g],
        m => m.on && !!gKit(m, g) && !gSame(m, g),
        // a groove from another meter's table cannot be played here, and a
        // word that cannot apply changes nothing — never writes an empty kit
        m => { const k = gKit(m, g); return k ? { ...m, kit: k, fills: {} } : m; },
        () => "the kit plays a " + ALLW[g][0].replace(/^an? /, ""),
        m => gSame(m, g));

  for (const [id, L] of Object.entries(LANEWORD))
    add("lane:" + id, "the kit", [L.word],
        m => m.on && JSON.stringify(m.kit[L.lane]) !== JSON.stringify(laneVec(m, L, "more")),
        m => { const kit = clone(m.kit);
               kit[L.lane] = laneVec(m, L, has(kit, L.lane) ? "more" : "give").slice();
               return { ...m, kit }; },
        m => (has(m.kit, L.lane) ? "more " : "") + L.word,
        m => has(m.kit, L.lane));

  for (const [lane, word] of Object.entries(DROPWORD))
    add("drop:" + lane, "take away", [word],
        m => m.on && has(m.kit, lane),
        m => { const kit = clone(m.kit); kit[lane] = new Array(stepsOf(m)).fill(0); return { ...m, kit }; },
        () => word, m => !has(m.kit, lane));

  for (const [bar, word] of Object.entries(FILLWORD))
    // a fill TOGGLES: saying it again takes it out, the same law the bar's
    // own steps follow
    add("fill:" + bar, "the fills", [word], m => m.on,
        m => { const fills = { ...m.fills };
               if (fills[bar]) delete fills[bar]; else fills[bar] = true;
               return { ...m, fills }; },
        m => (m.fills[bar] ? "no fill in the " : "a fill in the ") +
             (bar === "2" ? "second" : bar === "3" ? "third" : "fourth") + " measure",
        m => !!m.fills[bar]);
  add("nofills", "the fills", ["no fills"], m => Object.keys(m.fills).length > 0,
      m => ({ ...m, fills: {} }), () => "the fills come out");

  // THE SENTENCE. Not a kit word — it is a fact about the FORM of the
  // groove, two bars where the second answers the first — so it toggles on
  // the model rather than editing the bar you can see.
  add("answer", "at the kit", ["answer yourself"], m => m.on,
      m => ({ ...m, answer: !m.answer }),
      m => (m.answer ? "back to one bar, round and round" : "two bars: the groove, then its answer"),
      m => !!m.answer);
  V.answer.row = "calls:";

  // WHICH ROW OF THE KIT a word is about — the page draws the pile as one
  // labeled row per drum (never "accent" five times in a flat list), and the
  // row label carries the subject so the words can stay verbatim.
  const DRUMROW = {
    "kick on the one only": "the kick:", "kick on the ands": "the kick:",
    "double the kick": "the kick:", "flam the kick": "the kick:",
    "push the kick": "the kick:",
    "snare on every beat": "the snare:", "lay the snare back": "the snare:",
    "drag the backbeat": "the snare:", "flam the backbeat": "the snare:",
    "ghost notes": "the snare:", "backbeat on two and four": "the snare:",
    "backbeat on three": "the snare:",
    "hands in quarters": "the hats:", "hands in eighths": "the hats:",
    "hands in sixteenths": "the hats:", "hands shuffled": "the hats:",
    "push the hats": "the hats:", "let the hats breathe": "the hats:",
    "open the hat on four": "the hats:", "ride it, not the hats": "the hats:",
    "back to the hats": "the hats:",
    "toms, not the snare": "the toms:", "floor tom on the ands": "the toms:",
    "a tom melody": "the toms:", "walk the toms down": "the toms:",
    "accent the downbeats": "the accents:", "accent the ands": "the accents:",
    "nothing on the one": "the one:",
    "play the song": "calls:", "play it straight again": "calls:",
    "the perc, in and out": "calls:", "crescendo the bar": "calls:",
  };
  // A TRAY WORD THAT IS AN INTERVIEW ANSWER SETS THE INTERVIEW FACT. Saying
  // "backbeat on three" at the kit IS answering "where is the backbeat?" —
  // recording it keeps the sheet honest and the question off the floor,
  // instead of the same fact wearing two costumes.
  const SETS = { "backbeat on two and four": ["backbeat", "two and four"],
                 "backbeat on three": ["backbeat", "three"],
                 "ride it, not the hats": ["time", "the ride"],
                 "back to the hats": ["time", "the hats"] };
  for (const [word, fn] of Object.entries(DRUMMER)) {
    const apply = SETS[word]
      ? (m) => { const out = fn(m); const [id, w] = SETS[word];
                 return { ...out, answers: { ...(out.answers || m.answers || {}), [id]: w } }; }
      : fn;
    add("drum:" + word, "at the kit", [word],
        m => m.on && afterStr(m, word, fn) !== kitStr(m.kit),
        apply, () => word,
        m => m.on && afterStr(m, word, fn) === kitStr(m.kit));
    if (DRUMROW[word]) V["drum:" + word].row = DRUMROW[word];
  }

  for (const [k, word] of Object.entries(MACHINES))
    add("kit:" + k, "the machine", [word], m => m.on && m.drumkit !== k,
        m => ({ ...m, drumkit: k }), () => "it is " + word + " now",
        m => m.drumkit === k);

  add("looser", "the feel", ["looser"], m => m.on && m.humanize < 0.06,
      m => ({ ...m, humanize: +(m.humanize + 0.03).toFixed(2) }),
      () => "a hand on it — the hits stop landing exactly");
  add("tighter", "the feel", ["tighter"], m => m.on && m.humanize > 0,
      m => ({ ...m, humanize: +(m.humanize - 0.03).toFixed(2) }),
      () => "back toward the grid");
  add("swing", "the feel", ["swing it"], m => m.on && m.swing !== "swing",
      m => ({ ...m, swing: "swing" }), () => "it swings", m => m.swing === "swing");
  add("shuffle", "the feel", ["shuffle it"], m => m.on && m.swing !== "shuffle",
      m => ({ ...m, swing: "shuffle" }), () => "a shuffle", m => m.swing === "shuffle");
  add("straight", "the feel", ["straighten it"], m => m.on && m.swing != null,
      m => ({ ...m, swing: null }), () => "straight again");
  add("harder", "the feel", ["harder"], m => m.on && (m.vel.all || 0) < 2,
      m => ({ ...m, vel: { ...m.vel, all: (m.vel.all || 0) + 1 } }), () => "hit harder");
  add("softer", "the feel", ["softer"], m => m.on && (m.vel.all || 0) > -2,
      m => ({ ...m, vel: { ...m.vel, all: (m.vel.all || 0) - 1 } }), () => "played back");

  add("faster", "the tempo", ["faster"], m => m.on && m.bpm < 180,
      m => ({ ...m, bpm: m.bpm + 8 }), m => (m.bpm + 8) + " bpm");
  add("slower", "the tempo", ["slower"], m => m.on && m.bpm > 60,
      m => ({ ...m, bpm: m.bpm - 8 }), m => (m.bpm - 8) + " bpm");

  /* ---------- PROGRAMMING THE PATTERN, IN WORDS -------------------------
     "I want to program the drum pattern with language only." A step is not a
     cell in a grid here, it is a place in the bar the way a drummer counts
     one — a bar is ONE e AND a, TWO e AND a — so every sixteenth has a name
     and saying the name puts a hit there or takes it away. The lane is
     PINNED (tap "hats" and you are talking about hats), which is what keeps
     one tap per decision: the machine already knows the subject. */
  const stepWord = C.stepWord;
  const stepId = (lane, i) => "step:" + lane + ":" + i;
  // the bar's places, in the meter being counted: twelve of them in a waltz,
  // and each one named the way that bar counts ("on the a of three")
  function stepsFor(lane, met) {
    const m2 = met || C.MET4, n = m2.steps, b = barOf(m2), four = n === 16;
    const out = [];
    for (let i = 0; i < n; i++) out.push({
      id: stepId(lane, i), group: "the bar", head: HEADS("the bar"),
      lane, step: i, words: [stepWord(i, m2)],
      when: (m) => m.on,
      apply: (m) => { const kit = clone(m.kit);
        kit[lane] = (kit[lane] || new Array(n).fill(0)).slice();
        kit[lane][i] = kit[lane][i] ? 0 : 1;
        return { ...m, kit }; },
      says: (m) => (m.kit[lane] && m.kit[lane][i] ? "no " : "") +
        LANEOF(lane) + " " + stepWord(i, m2),
    });
    // the shapes a drummer asks for by name rather than by counting
    const SHAPE = four ? {
      "on every beat": every(4), "on the ands": on(2, 6, 10, 14),
      "on every eighth": every(2), "on every sixteenth": every(1),
      "on two and four": on(4, 12), "on one and three": on(0, 8),
      "nowhere": z(),
    } : {
      "on every beat": b.beats0(), "on the ands": b.ands(),
      "on every eighth": b.every(2), "on every sixteenth": b.every(1),
      "on the backbeat": b.back(), "on the first and the middle":
        b.beat(0, Math.floor(b.beats / 2)),
      "nowhere": b.z(),
    };
    for (const [w, v] of Object.entries(SHAPE)) out.push({
      id: "shape:" + lane + ":" + w, group: "the bar", head: HEADS("the bar"),
      lane, words: [w],
      when: (m) => m.on && JSON.stringify(m.kit[lane]) !== JSON.stringify(v),
      apply: (m) => { const kit = clone(m.kit); kit[lane] = v.slice(); return { ...m, kit }; },
      says: () => LANEOF(lane) + " " + w,
    });
    return out;
  }
  const LANENAME = { k: "kick", s: "snare", h: "hats", o: "open hats",
                     c: "claps", p: "percussion", t: "toms" };
  const LANEOF = (l) => LANENAME[l] || l;

  /* ---------- WHAT A DRUMMER DECIDES, IN THE ORDER THEY DECIDE IT --------
     "More of a drummer decision-making simulator than a drum machine."
     Sitting down at a kit, nobody thinks about steps: they want to know how
     fast, whether it swings, what kind of record this is, what their JOB in
     it is, what they are keeping time on, where the backbeat sits, how hard
     and how loose to play it, and where the fills go. That is nine
     questions, they have an order, and answering them yields a part — which
     is what this table is. Everything else in this file is what you say
     AFTER you have sat down.

     Each option is an ordinary kit->kit function, so the decisions are not a
     second engine: they are the same vocabulary, asked in a drummer's
     order. */
  const bpmSet = (n) => (m) => ({ ...m, bpm: n });
  const kitSet = (fn) => (m) => fn(m);
  const DECISIONS = [
    { id: "tempo", head: "the time-keeping", ask: "how fast is it?", opts: [
      { w: "slow, 72", is: (m) => m.bpm === 72, apply: bpmSet(72) },
      { w: "medium, 96", is: (m) => m.bpm === 96, apply: bpmSet(96) },
      { w: "up, 120", is: (m) => m.bpm === 120, apply: bpmSet(120) },
      { w: "fast, 144", is: (m) => m.bpm === 144, apply: bpmSet(144) } ] },
    { id: "feel", head: "the feel", ask: "straight or swung?", opts: [
      { w: "straight", is: (m) => !m.swing, apply: (m) => ({ ...m, swing: null }) },
      { w: "swung", is: (m) => m.swing === "swing", apply: (m) => ({ ...m, swing: "swing" }) },
      { w: "shuffled", is: (m) => m.swing === "shuffle", apply: (m) => ({ ...m, swing: "shuffle" }) },
      { w: "half-time feel",
        is: (m) => JSON.stringify(m.kit.s) ===
          JSON.stringify(lit(m, on(8), (b) => b.beat(b.beats - 1))),
        apply: kitSet(DRUMMER["backbeat on three"]) } ] },
    // a new family means the groove under it must be chosen again — the
    // dependency is DECLARED here and the chair's walker honours it
    // ..."the old world" joined 2026-08-21: the pre-1900 records' family,
    // where the honest grooves are the tabor, the processional tread and
    // silence itself; and a bar that counts in three or in six has families
    // of its own (the ballroom, the lilt), so the row reads the METER'S
    // table rather than a list written for 4/4
    { id: "record", head: "the record's kit", ask: "what kind of record is this?", invalidates: ["groove"],
      opts: (m) => famOpts(m).map((f) => ({
        w: f, is: (mm) => mm.fam === f, apply: (mm) => ({ ...mm, fam: f }) })) },
    // the second question about the record: which groove, out of the family
    // just chosen — the options are a FUNCTION of the model, and the row is
    // only asked once there is a family (the chair reads both declarations)
    { id: "groove", head: "the record's kit", ask: "which one?", when: (m) => !!m.fam,
      opts: (m) => grooveOpts(m) },
    // ...AND WHAT YOU ARE PLAYING IT ON (2026-08-23, "give me all choices for
    // keys and all instruments and kits"). Ten kits — six recordings on disk
    // and the four machines to-engine.js MACHINE_KIT knows — and until this
    // row existed NOT ONE of them was reachable from the interview: `kit:`
    // was a tray word, so a drummer who never typed at the tray played the
    // acoustic kit on every record in the box, house and techno included.
    // The row is the MACHINES table itself, which is the same list the tray
    // says and the same list the browser gate holds against fields.js
    // DRUMKITS — one vocabulary, asked two ways.
    //
    // It sits AFTER the groove because that is the order a drummer decides
    // in (what kind of record, which beat, then which kit it is played on),
    // and because the record's own kit is the head of the list (band-kit
    // `narrow`/openRack) — so answering it is confirming, not choosing.
    { id: "kit", head: "the record's kit", ask: "what are you playing it on?", opts:
      Object.entries(MACHINES).map(([k, w]) => ({
        w, row: MACHINEROW[k],
        is: (m) => m.drumkit === k, apply: (m) => ({ ...m, drumkit: k }) })) },
    { id: "job", head: "the job", ask: "what is your job in it?", opts: [
      { w: "hold it down", is: (m) => m.job === "hold",
        apply: (m) => ({ ...m, job: "hold", kit: DRUMMER["hands in eighths"](m).kit }) },
      { w: "drive it", is: (m) => m.job === "drive",
        apply: (m) => ({ ...m, job: "drive", kit: DRUMMER["hands in sixteenths"](m).kit }) },
      { w: "stay out of the way", is: (m) => m.job === "out",
        apply: (m) => { const zz = new Array(stepsOf(m)).fill(0);
          return { ...m, job: "out", kit: { ...clone(m.kit),
            h: hand(m, "quarters").slice(), o: zz.slice(), p: zz.slice() } }; } },
      { w: "on the front of it", is: (m) => m.job === "push",
        apply: (m) => ({ ...m, job: "push",
          kit: DRUMMER["accent the downbeats"](DRUMMER["ghost notes"](m)).kit }) } ] },
    { id: "time", head: "the time-keeping", ask: "what are you keeping time on?", opts: [
      { w: "the hats", is: (m) => has(m.kit, "h") && !has(m.kit, "p"),
        apply: kitSet(DRUMMER["back to the hats"]) },
      { w: "the ride", is: (m) => has(m.kit, "p") && !has(m.kit, "h"),
        apply: kitSet(DRUMMER["ride it, not the hats"]) },
      { w: "nothing — just kick and snare", is: (m) => !has(m.kit, "h") && !has(m.kit, "p"),
        apply: (m) => { const zz = new Array(stepsOf(m)).fill(0);
          return { ...m, kit: { ...clone(m.kit), h: zz.slice(), p: zz.slice() } }; } } ] },
    { id: "backbeat", head: "the time-keeping", ask: "where is the backbeat?", opts: [
      { w: "two and four",
        is: (m) => JSON.stringify(m.kit.s) === JSON.stringify(lit(m, on(4, 12), (b) => b.back())),
        apply: kitSet(DRUMMER["backbeat on two and four"]) },
      { w: "three",
        is: (m) => JSON.stringify(m.kit.s) ===
          JSON.stringify(lit(m, on(8), (b) => b.beat(b.beats - 1))),
        apply: kitSet(DRUMMER["backbeat on three"]) },
      { w: "nowhere — no backbeat", is: (m) => !has(m.kit, "s"),
        apply: (m) => ({ ...m, kit: { ...clone(m.kit), s: new Array(stepsOf(m)).fill(0) } }) } ] },
    { id: "loud", head: "the feel", ask: "how hard are you hitting?", opts: [
      { w: "light", is: (m) => (m.vel.all || 0) < 0, apply: (m) => ({ ...m, vel: { all: -1 } }) },
      { w: "normal", is: (m) => !(m.vel.all || 0), apply: (m) => ({ ...m, vel: {} }) },
      { w: "hard", is: (m) => (m.vel.all || 0) > 0, apply: (m) => ({ ...m, vel: { all: 1 } }) } ] },
    // ONE QUESTION FOR THE WHOLE HAND. touch (askable) and hand (played/
    // programmed) used to be their own knob questions beside this one — four
    // asks orbiting one fact. Each answer writes humanize + touch + hand
    // together, because the axes were never independent: a machine is never
    // loose, and a loose hand is never a machine. (askable.js lists touch
    // and hand under WRITTEN now, and the coverage gate reads that table.)
    { id: "loose", head: "the feel", ask: "how tight to the grid?", opts: [
      { w: "a machine", is: (m) => !m.humanize && m.hand === "exact",
        apply: (m) => ({ ...m, humanize: 0, touch: 0, hand: "exact" }) },
      { w: "on the grid", is: (m) => !m.humanize && m.hand !== "exact",
        apply: (m) => ({ ...m, humanize: 0, touch: 0, hand: null }) },
      { w: "a human hand", is: (m) => m.humanize === 0.03,
        apply: (m) => ({ ...m, humanize: 0.03, touch: 0.35, hand: null }) },
      { w: "loose", is: (m) => m.humanize >= 0.06,
        apply: (m) => ({ ...m, humanize: 0.06, touch: 0.75, hand: null }) } ] },
    { id: "fills", head: "the fills", ask: "where do the fills go?", opts: [
      { w: "end of every four", is: (m) => !!m.fills[4] && !m.fills[2],
        apply: (m) => ({ ...m, fills: { 4: true } }) },
      { w: "halfway too", is: (m) => !!m.fills[2] && !!m.fills[4],
        apply: (m) => ({ ...m, fills: { 2: true, 4: true } }) },
      { w: "no fills", is: (m) => !Object.keys(m.fills).length,
        apply: (m) => ({ ...m, fills: {} }) } ] },
  ];
  // the same grooves, asked the way a drummer would ask
  // ...tacet is UNIVERSAL (2026-08-21, the chamber ballad): any drummer can
  // sit out, whatever the family — "nobody on the kit" is not an old-world
  // groove, it is the absence of one, and every record honestly has it
  const grooveOpts = (m) => { const S = setOf(m);
    return Object.keys(S.G)
      .filter((g) => (S.F[g] || "other") === m.fam || g === "tacet")
      .map((g) => ({ w: (S.W[g] || [g])[0],
        is: (mm) => JSON.stringify({ ...empty(mm), ...setOf(mm).G[g] }) === JSON.stringify(mm.kit),
        apply: (mm) => ({ ...mm, kit: { ...empty(mm), ...setOf(mm).G[g] }, fills: mm.fills }) })); };
  // ...and the families of THIS meter's table, in the order they are written
  const famOpts = (m) => { const S = setOf(m), seen = [];
    for (const g of Object.keys(S.G)) { const f = S.F[g] || "other";
      if (f !== "the old world" && !seen.includes(f)) seen.push(f); }
    seen.push("the old world");
    return seen; };
  // A DECISION IS RECORDED, NOT INFERRED. Reading the answers back off the
  // kit looked clever and behaved badly: choosing a job changed the hats, so
  // the question about which groove re-opened itself. What a drummer decided
  // is a fact about the drummer — it stays decided until they change it, and
  // the sheet shows it whatever the kit has been edited into since. That law
  // lives in the chair's walker now; `live` makes answering go through the
  // rendered list, so an unasked question (no family yet) cannot be answered
  // and a groove answer must exist in the family just chosen.
  const { decisions, nextAsk, answer } = C.interview(DECISIONS, { live: true });

  /* ---------- what can be said right now — the exactness law ---------- */
  // with a lane PINNED the bar itself is the vocabulary; without one, the
  // machine's own words
  // THE CATALOG: every word, whether it is already true, and whether saying
  // it would do anything. The tray draws all of it; `offered` stays for the
  // gate and for anything that wants only the live half.
  const catalog = (m, lane) => {
    const list = lane ? stepsFor(lane, metOf(m)) : Object.values(V);
    return list.map(i => {
      let active = false, changes = false;
      try { active = !!(i.is ? i.is(m) : false); } catch (e) {}
      try { changes = !!i.when(m); } catch (e) {}
      if (i.step != null) active = !!(m.kit[i.lane] && m.kit[i.lane][i.step]);
      return { ...i, active, changes };
    });
  };
  const offered = (m, lane) => lane
    ? stepsFor(lane, metOf(m)).filter(i => { try { return !!i.when(m); } catch (e) { return false; } })
    : Object.values(V).filter(i => { try { return !!i.when(m); } catch (e) { return false; } });
  const findInstr = (id, lane, met) => V[id] ||
    (lane ? stepsFor(lane, met).find(i => i.id === id) : null) ||
    (/^(step|shape):([ksho cpt]):/.test(id) ? stepsFor(id.split(":")[1], met).find(i => i.id === id) : null);
  const say = (m, id) => { const i = findInstr(id, id.split(":")[1], metOf(m));
    return (i && i.when(m)) ? i.apply(m) : m; };
  const says = (m, id) => { const i = findInstr(id, id.split(":")[1], metOf(m));
    if (!i) return "";
    return typeof i.says === "function" ? i.says(m) : i.says; };

  /* ---------- the model as a GENRE the engine already knows how to play --- */
  const VELROW = (n, steps) => new Array(steps || N).fill(Math.max(2, Math.min(9, 6 + n * 2)));
  // THE ANSWER BAR — the second half of a two-bar sentence. A groove that
  // repeats a bar identically is a LOOP; a drummer plays a sentence, and the
  // second bar answers the first. The answer is small on purpose: the kick
  // steps onto the and of three, and the last beat is a tom instead of the
  // backbeat. That is the difference between a machine and a player, and it
  // is what a fill is made of before it is a fill.
  const ANSWERBAR = (kit, met) => {
    const b = barOf(met), lb = b.n - b.pulse;      // the LAST beat of the bar
    const k = clone(kit);
    if (k.k) { k.k = k.k.slice(); k.k[Math.max(0, lb - 2)] = 1; }
    if (k.s) { k.s = k.s.slice(); k.s[lb] = 0; }
    const zz = () => b.z();
    k.t = (k.t || zz()).slice(); k.m = (k.m || zz()).slice(); k.l = (k.l || zz()).slice();
    k.m[lb] = 1; k.l[Math.min(b.n - 1, lb + 2)] = 1;
    return k;
  };

  function toGenre(m) {
    const bars = [], met = metOf(m);
    // a SENTENCE is two bars: the groove, then its answer
    for (let b = 1; b <= BARS; b++) {
      const base = (m.answer && b % 2 === 0) ? ANSWERBAR(m.kit, met) : m.kit;
      bars.push(m.fills[b] ? FILLBAR(base, met) : base);
    }
    const g = {
      label: "Drums", family: "club", rate: 1, bars: BARS, voices: 1,
      entry: () => 0, reg: () => 0, realize: () => "line", harmony: "modal",
      instr: "yamaha_grand_piano", nobass: true, drumkit: m.drumkit,
      kit: m.kit, kits: bars, humanize: m.humanize || 0,
      // the bar this kit was written for — absent when it is the sixteen
      // steps every kit has always been
      ...(met.steps !== 16 ? { meter: { steps: met.steps, pulse: met.pulse } } : {}),
      tone: { wave: "sine", cut: 1200, q: 1, atk: 0.01, rel: 0.2, gain: 0.001, verb: 0.1 },
      words: [], word: () => [],
    };
    // (NO g.swing HERE. The kernel's swing is a NUMBER — swing(g,i) =
    // (i%2) * (g.swing||0) — and handing it the WORD "swing" made every
    // event time NaN and stopped the engine dead: "when I click swing audio
    // stops". The swing is a SONG fact anyway, and ui/derive.js maps the
    // word to its number (SWINGS) on the way in; the page sets it there.)
    if (m.vel.all) g.kitVel = Object.fromEntries(LANES.map(l => [l, VELROW(m.vel.all, met.steps)]));
    // the rest of the one humanization answer: touch (how human the hand is)
    // and hand ("exact" = programmed) ride the same genre the kit does —
    // absent answers write nothing, so an old model is byte-identical
    if (m.touch != null) g.touch = m.touch;
    if (m.hand) g.hand = m.hand;
    return g;
  }

  return { LANES, BARS, N, ANSWERBAR, blank, V, offered, catalog, say, says, toGenre, stepWord,
           GROOVEWORD, GROOVEFAM, laneKeys, DECISIONS, decisions, nextAsk, answer,
           stepsFor, LANENAME, LANEOF, GROOVES, LANEWORD, FILLWORD, MACHINES, MACHINEROW,
           GROOVES3, GROOVES6, GROOVEWORD3, GROOVEWORD6, GROOVEFAM3, GROOVEFAM6,
           setFor, setOf, famOpts, FILLBAR,
           hits, has, clone, empty };
});
