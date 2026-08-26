// nukernel/precompose.js — SET A GENRE, GET A WHOLE RECORD.
//
// Paul, 2026-08-24: "we've lost the ability to set a genre and have the entire
// song precomposed entirely." PLAN.md's law is the standard — THE RECORD
// ARRIVES FINISHED — so `genreToDocument(gk, seed)` hands back an eight-axes
// document (PROGRAM.md §2.1) that is playable, idiomatic and, above all,
// EDITABLE: every value it writes is a word the page already offers, so a
// default here is a DECISION and never a wall.
//
// WHAT IS REUSED, AND WHAT HAD TO BE WRITTEN. The standing law is that the
// conversion is done by EXTRACTION, so almost nothing here is new:
//
//   compose.js       the ARRANGER, whole. Form (8..13 sections, irregular
//                    lengths), the per-section development ops, the bass and
//                    kit words (already BASSOPS / KITLABEL keys — the
//                    document's own vocabulary, verbatim), the cast per
//                    section, the guest and the singer, bpm and swing, the
//                    key, the period sentence and the mastering (already a
//                    fields.js MASTER value). Called ONCE per document and
//                    consumed in no order-dependent way, so this file cannot
//                    move a single one of its streams. Its GROOVE is the one
//                    thing here that is NOT taken: see § 7.
//   ideas-kit.js     the MATERIAL engine — CELLS × CONTOURS × LANDINGS ×
//                    SENTENCES × LENGTHS. `toPhrase` is pure and cached.
//   genres.js        the anchor: alphabet, kit, instruments, articulation,
//                    register, entries, parts, drum machine.
//   instruments.js   instrOf(), which already knows that `instr` may be a
//                    string OR an array read per voice with the last entry
//                    covering the rest. Indexing a string would have handed
//                    gregorian's cantor the letter "a".
//   document.js      materialAt / barsOf — the reader this file writes for.
//
// THREE THINGS HAD TO BE WRITTEN. (This said TWO, "and only two", until
// 2026-08-24; the sentence is rewritten rather than deleted because the third
// is a REVERSAL — this file used to say out loud that the Sound axis was
// somebody else's to write, and the measurement says nobody wrote it.)
// (1) IDIOM/KINDS — compose.js's
// own `phrase()` reads only `kind`, so its density and span constants are the
// same for punk and for bossa; it is genre-blind BY CONSTRUCTION and the
// catalog carries no pitched material at all (measured: 0 of 122 anchors).
// A punk hook therefore does not exist yet and has to be WRITTEN, from tables,
// per idiom — the prior art is band-kit.js:1265 THEMES ("THE RECORD ARRIVES
// FINISHED … a punk hook is not a bossa hook and not a chant"), re-keyed from
// its 30-record catalog and 8 families onto these 122 anchors and 10.
// (2) SAY — compose speaks fields.js OPS and a document speaks songs.js WORDS.
// (3) THE ENGINEER'S PASS (§ 7) — the bus block, the return, the record-wide
// chip, the per-voice desk and the groove word. STATE.md item 17 measured the
// hole: "0 of 122 precomposed records carry a `voice.desk`, a `sound.buses` or
// a `sound.fx` … the opened reverb return reaches exactly ONE record". Nothing
// here is taste except one ten-row family table: the return is the anchor's own
// `tone.verb`, the echo's tone is its own `tone.cut`, the send is the chip's own
// declared mix, and the groove word is read off the anchor's own drum grid.
//
// NO LLM, NO RUNTIME GENERATION, ONE STREAM. Every option comes from a table
// below; the only randomness is compose()'s own seeded streams plus one
// declared-and-reserved stream of this file's own (§ SEED DISCIPLINE).
(function (root, factory) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const api = factory(
    isNode ? require("./genres.js")      : root.NuGenres,
    isNode ? require("./compose.js")     : root.NuCompose,
    isNode ? require("./ideas-kit.js")   : root.NuIdeas,
    isNode ? require("./fields.js")      : root.NuFields,
    isNode ? require("./kernel.js")      : root.NuKernel,
    isNode ? require("./instruments.js") : root.NuInstruments,
    isNode ? require("./songs.js")       : root.NuSongs,
    isNode ? require("./song.js")        : root.NuSong);
  if (isNode) module.exports = api;
  else root.NuPrecompose = api;
})(typeof self !== "undefined" ? self : this, function (NG, NC, Id, NF, K, NI, NuSongs, NuSong) {
  "use strict";

  const { GENRES, MODES, SCALES } = NG;
  const { compose, ihash, rng } = NC;
  const { LENGTHS, REG } = Id;
  const { stepsIn } = K;
  const { instrOf, isSection } = NI;

  /* ======================================================================
     1 · IDIOM — the record's own tune, in ideas-kit's six words
     ======================================================================
     Per FAMILY (genres.js:5699 stamps `family` on every anchor), overridden per
     ANCHOR only where the anchor is not its family. Ten family rows plus a
     handful of overrides — not 122 × 9 hand-written themes, which is the table
     that rots. Every value is a key of ideas-kit's CELLS / CONTOURS / LANDINGS
     / SENTENCES / LENGTHS / REG, so a renamed option fails loudly here rather
     than quietly composing a default (band-kit.js:1313's law); `assertTables()`
     below checks all of them at load.

     THIS TABLE IS A TASTE CLAIM AND IT WILL BE WRONG FOR SOME ANCHORS. The
     gate prints which row each of the 122 resolved to, and the review that adds
     rows reads that print-out (PROGRAM.md §5, PAUL'S EARS item 5). */
  const IDIOM = {
    // the zero of the table: a plain, arching, four-square tune
    kernel: { len: "two",  cell: "three",  sent: "plain",  contour: "arch",   land: "root",  reg: "mid" },
    // unaccompanied polyphony: long-breathed, falling, and it VARIES rather
    // than photocopies — a psalm tone does not say the same measure twice
    vox:    { len: "four", cell: "three",  sent: "vary",   contour: "fall",   land: "root",  reg: "mid" },
    // a floor record's line is a figure that hovers and opens on the fifth:
    // it is not going anywhere, that is the point of it
    club:   { len: "two",  cell: "push",   sent: "vary",   contour: "hover",  land: "fifth", reg: "mid" },
    // sung soul: a pickup into the bar, and it warms on the third
    soul:   { len: "four", cell: "pickup", sent: "hold",   contour: "fall",   land: "third", reg: "mid" },
    groove: { len: "four", cell: "push",   sent: "hold",   contour: "fall",   land: "third", reg: "mid" },
    // a band plays a short call and says it again — it does not travel
    band:   { len: "two",  cell: "call",   sent: "vary",   contour: "insist", land: "root",  reg: "mid" },
    studio: { len: "four", cell: "pickup", sent: "vary",   contour: "fall",   land: "root",  reg: "mid" },
    // drift: one long note that moves when it feels like it
    drift:  { len: "four", cell: "long",   sent: "long",   contour: "hover",  land: "root",  reg: "mid" },
    // the pre-rock traditions are STROPHIC — statement, statement, departure,
    // return — which is the one sentence plan that says a measure twice on
    // purpose (ideas-kit SENTENCES `aabb`, and it declares `same` for exactly
    // this reason)
    roots:  { len: "four", cell: "three",  sent: "aabb",   contour: "rise",   land: "root",  reg: "mid" },
    // the FUNCTION genres are parts, not styles: a riff insists
    parts:  { len: "two",  cell: "call",   sent: "vary",   contour: "insist", land: "root",  reg: "mid" },
  };

  // ANCHOR OVERRIDES — a row exists only where the anchor is not its family,
  // and each carries the argument for why THIS music is not what its neighbours
  // are. Merged OVER the family row, so a row states only its difference.
  const IDIOM_ANCHOR = {
    // — the six the design named —
    // short, said twice, and it does not travel: a punk hook is three notes
    // and a shout. `even` rather than `call` because a one-bar `call` has
    // three onsets and `insist` needs four before it moves at all — measured,
    // punk's hook came out a monotone.
    punk:      { cell: "even",   contour: "insist", land: "root",    len: "two" },
    // a sung line that warms on the third, entering before the bar
    bossa:     { cell: "pickup", contour: "fall",   land: "third",   sent: "hold" },
    // a bop head gallops and leans on the seventh
    jazz:      { cell: "gallop", contour: "fall",   land: "seventh", len: "four" },
    // one long note, then a run, hanging under the root — that is the blue note
    blues:     { cell: "hang",   contour: "fall",   land: "lead" },
    // the chant: three notes and a rest, falling, and it varies
    gregorian: { cell: "three",  contour: "fall",   sent: "vary",    len: "four" },
    // a subject WALKS UP to its entry and rises: that is what an answer answers
    fugue:     { cell: "walkup", contour: "rise",   sent: "vary",    len: "two" },
    // — and the ones the family row measurably lies about —
    // the 303 is a sixteenth-note machine, not a band: an insistent figure,
    // low, turning back on itself. Same for the two anchors built on it.
    acid:      { cell: "riff",   contour: "zig",    reg: "low",      len: "two" },
    techno:    { cell: "even",   contour: "hover",  reg: "low" },
    // dub is space: the club row's `push` is right, the length is not — a dub
    // line is one long idea with holes in it
    dub:       { cell: "long",   contour: "hover",  sent: "long",    len: "four" },
    reggae:    { cell: "push",   contour: "hover",  land: "root" },
    // a drone is a drone. `hold` sits on one note, which is the whole claim.
    drone:     { cell: "long",   contour: "hold",   sent: "long",    len: "four" },
    ambient:   { cell: "long",   contour: "hold",   sent: "long",    len: "four" },
    // minimalism is a CELL repeated with one thing moving — `plain` is the
    // photocopy and here the photocopy is the style
    minimalism:{ cell: "even",   contour: "zig",    sent: "plain",   len: "two" },
    // a walking bass tradition: tango and the crooner both arch over a
    // four-bar sentence rather than restating a strophe
    tango:     { cell: "gallop", contour: "arch",   land: "fifth",   sent: "vary" },
    crooner:   { cell: "pickup", contour: "arch",   land: "third",   sent: "vary" },
    // the counterpoint anchors answer the vox row's falling psalm with a
    // rising subject, because a subject that only falls cannot be answered
    counterpoint: { cell: "walkup", contour: "rise", sent: "vary" },
    spem:      { cell: "three",  contour: "arch",   sent: "vary",    len: "four" },
    // rock and roll is a RIFF — chuckberry is the case the `band` row's
    // three-note call gets wrong by a mile
    chuckberry:{ cell: "riff",   contour: "zig",    land: "root" },
    bodiddley: { cell: "riff",   contour: "insist", land: "root" },
    // motorik and kraftwerk are machines wearing a studio badge
    motorik:   { cell: "even",   contour: "hover",  sent: "plain" },
    kraftwerk: { cell: "even",   contour: "zig",    sent: "plain" },
    // a hymn is the strophic case at its purest, and it rises to its cadence
    hymn:      { cell: "three",  contour: "arch",   sent: "aabb",    len: "four" },
    // gospel and doowop are sung ARCHES, not falls: the soul row's fall is
    // right for a groove and wrong for a church
    gospel:    { contour: "arch", land: "fifth" },
    doowop:    { contour: "arch", land: "third" },
    // — AND THE WORLD ROUND'S (2026-08-26) —
    // Sixty anchors landed and twenty-four of them take a row here, which is
    // roughly the proportion the table already ran at (24 of 139). The other
    // thirty-six take their family row on purpose: `roots`' own line —
    // statement, statement, departure, return — is what a mento, a fado, a
    // trot, a kroncong and a luk thung song actually do, and writing a row
    // that repeats the family's values would be the photocopy this table
    // exists to avoid.
    //
    // the OSTINATO anchors: a figure that repeats and does not travel. A son
    // guajeo, a salsa montuno, a sebene guitar, a benga line, an mbaqanga
    // cycle and the Sleng Teng bass are all the same musical object, and the
    // family rows they sit in (`roots`' strophe, `groove`'s fall, `club`'s
    // hover) all describe a line that GOES somewhere.
    son:       { cell: "riff",   contour: "zig",    sent: "plain", len: "two" },
    salsa:     { cell: "riff",   contour: "zig",    sent: "plain", len: "two" },
    soukous:   { cell: "riff",   contour: "zig",    sent: "plain", len: "two" },
    benga:     { cell: "riff",   contour: "zig",    sent: "plain", len: "two" },
    mbaqanga:  { cell: "riff",   contour: "zig",    sent: "plain", len: "two" },
    dancehall: { cell: "riff",   contour: "zig",    reg: "low",    len: "two" },
    // the RIFF-BAND and BLOCK anchors: a mambo, a merengue jaleo, a baião and
    // a Kansas City head are all a short figure said again, hard.
    mambo:     { cell: "even",   contour: "insist", sent: "plain", len: "two" },
    merengue:  { cell: "even",   contour: "insist", sent: "plain", len: "two" },
    forro:     { cell: "even",   contour: "insist", sent: "plain", len: "two" },
    rumbacatalana: { cell: "even", contour: "insist", sent: "plain", len: "two" },
    swing:     { cell: "riff",   contour: "insist", sent: "plain", land: "seventh" },
    // the WRITTEN VIRTUOSO anchors: a choro, a rag, a reel and a kolo are
    // composed tunes that run, and `roots`' four-bar strophe is the one thing
    // they are not
    choro:     { cell: "gallop", contour: "arch",   sent: "vary",  land: "fifth" },
    ragtime:   { cell: "pickup", contour: "arch",   sent: "vary" },
    irishtrad: { cell: "even",   contour: "zig",    sent: "vary" },
    balkanbrass: { cell: "even", contour: "zig",    sent: "vary",  len: "two" },
    bluegrass: { cell: "walkup", contour: "rise",   sent: "vary",  len: "two" },
    huayno:    { cell: "even",   contour: "zig",    sent: "plain", len: "two" },
    // the SUNG BALLADS that arch rather than restate: the crooner's row,
    // applied to the four traditions that learned the same decade of radio
    bolero:    { cell: "pickup", contour: "arch",   land: "third", sent: "vary" },
    shidaiqu:  { cell: "pickup", contour: "arch",   land: "third", sent: "vary" },
    filmi:     { cell: "pickup", contour: "arch",   land: "third", sent: "vary" },
    cantopop:  { contour: "arch", land: "third" },
    // ...and the three that FALL over a long breath instead: an arabesk
    // string unison, an enka line and a rebetiko taximi are all one long idea
    // coming down
    arabesk:   { cell: "long",   contour: "fall",   sent: "vary",  len: "four" },
    enka:      { cell: "long",   contour: "fall",   sent: "vary",  len: "four" },
    rebetiko:  { cell: "hang",   contour: "fall",   sent: "vary" },
    // the CALL-AND-ANSWER anchors: a boli, a qawwali refrain, a kwela
    // pennywhistle phrase and a shaabi line are all a call somebody answers
    bhangra:   { cell: "call",   contour: "insist", sent: "vary",  len: "two" },
    qawwali:   { cell: "call",   contour: "rise",   sent: "vary" },
    kwela:     { cell: "call",   contour: "rise",   sent: "vary",  len: "two" },
    shaabi:    { cell: "call",   contour: "fall",   sent: "vary" },
    // and the two the family row is plainly wrong about: a shape-note tune is
    // a hymn (the same row `hymn` takes), and an anadolu rock record is a
    // TÜRKÜ played on a fuzz guitar — a melody, where `band`'s row is a shout
    sacredharp:{ cell: "three",  contour: "arch",   sent: "aabb",  len: "four" },
    anadolurock: { cell: "three", contour: "fall",  sent: "vary",  len: "four" },
  };

  /* ======================================================================
     2 · KINDS — what makes each of compose()'s nine slots a different PHRASE
     ======================================================================
     "A song whose every part is a transform of one cell is a study"
     (compose.js:401). A delta over the idiom row, so a kind states only what
     makes it that kind and the IDIOM keeps saying what the music is.

     Measured slot usage across 366 records: {0:1073, 1:1044, 2:735, 3:1825,
     4:938, 5:950, 6:809, 7:641, 8:500, 9:75} — every slot is used, so every
     slot gets a cell. */
  const KINDS = {
    hook:      {},                                                    // slot 0 — the idiom itself
    answer:    { contour: "rise",   land: "fifth" },                  // 1
    riff:      { cell: "riff",   contour: "zig",   reg: "low", land: "root" },  // 2
    counter:   { cell: "even",   contour: "drop" },                   // 3
    pad:       { cell: "long",   contour: "hold",  sent: "long" },    // 4
    topline:   { cell: "pickup", contour: "arch" },                   // 5
    sparse:    { cell: "long",   contour: "hover" },                  // 6
    climb:     { cell: "walkup", contour: "rise",  land: "fifth" },   // 7
    verseline: { contour: "arch", land: "lead" },                     // 8 — the tune, developing
    seq:       { cell: "even",   contour: "zig",   reg: "low", sent: "plain" }, // 9, machines only
  };
  // compose.js:1793 deals the slots in this order and nothing else may reorder
  // them: the index IS the identity, because b.stack[].slots holds indices.
  const KIND_OF = ["hook", "answer", "riff", "counter", "pad",
                   "topline", "sparse", "climb", "verseline", "seq"];

  /* ======================================================================
     3 · SAY — the twelve ops, said in the document's own words
     ======================================================================
     compose() emits exactly twelve of the 47 fields.js OPS (measured over 366
     records). Only those need a row; anything else falls through to "as
     written", which is total and therefore cannot be wrong.

     THE DOCUMENT DOES NOT SPEAK OPS. It speaks songs.js WORDS, which is the
     enumerated vocabulary the determinism law rests on (songs.js:9-14) — so
     this is a translation, and where the two vocabularies do not line up
     exactly the row says so rather than inventing a word. */
  const SAY = {
    rev:      "backwards",            // reverse() both sides — exact
    inv:      "inverted",             // invert(4) both sides — exact
    // rotate is rotate; the DISTANCE differs. WORDS offers two rotations —
    // a beat (-4) and half a bar (-8) — so the near word is used and this
    // comment is where that is admitted.
    rot2:     "a beat later",
    rot3:     "a beat later",
    rot4:     "half a bar later",
    wide:     "in wider steps",       // spread(2) both sides — exact
    rep2:     "the head only",        // a split restates the head
    rep3:     "the head only",
    rep4:     "the head only",
    pit4:     "up a degree",          // a pitch-4 sequence, said as the box says it
    gat4:     "thinned",              // a rhythm-4 sequence thins what it does not keep
    gateflip: "recitation",           // the negative: what was silent speaks
  };

  /* ======================================================================
     4 · LENGTH IS ARTICULATION
     ======================================================================
     The document says one of three things per step — "n" a note, "h" held,
     "r" a rest — and the phrase says gate/hold. 85 of 122 anchors declare
     `artic` and 79 declare `maxHold`, and NEITHER has a slot in the eight
     axes, so the compiler SPENDS them here: a note runs to the next onset,
     capped by what this music holds, and the remainder is a rest.

     A chant's notes are long because gregorian is `legato`; a punk hook's are
     short because punk is `staccato`. That is the whole difference between the
     two `play` rows, and it is READ FROM THE ANCHOR rather than chosen. */
  // `staccato: 1` is MEASURED, not chosen. At 2 it never bit: punk's cell puts
  // an onset every two steps, so the gap already WAS two and every note ran
  // full length — the chant's mean sounding note came out 4.0 steps against
  // punk's 2.0, exactly 2×, and "a punk hook is not a chant" was passing on
  // pitch alone. A sixteenth at 160 bpm is 94 ms, which is a downstroke; the
  // point of staccato is that the note is shorter than the gap, and at 2 it
  // could not be.
  const HOLDCAP = { staccato: 1, normal: 4, legato: 8, tie: 12 };
  const capOf = (G) => (G.maxHold != null ? G.maxHold : (HOLDCAP[G.artic] || 4));

  /* ---------- the tables answer for themselves --------------------------- */
  // A renamed ideas-kit option must fail HERE, at load, naming the row and the
  // word — not three layers down inside phraseNow(), which falls back to
  // CELLS.three and CONTOURS.arch and composes a plausible wrong tune in
  // silence. This is band-kit.js:1313's law applied to a re-keyed table.
  const FIELDTABLE = { cell: Id.CELLS, contour: Id.CONTOURS, land: Id.LANDINGS,
                       sent: Id.SENTENCES, len: Id.LENGTHS, reg: Id.REG };
  function assertTables() {
    const check = (where, row) => {
      for (const [f, v] of Object.entries(row)) {
        const t = FIELDTABLE[f];
        if (!t) throw new Error(`precompose: ${where} names no such field "${f}"`);
        if (!t[v]) throw new Error(`precompose: ${where}.${f} = "${v}" is not an ideas-kit key`);
      }
    };
    for (const [k, row] of Object.entries(IDIOM)) check(`IDIOM.${k}`, row);
    for (const [k, row] of Object.entries(IDIOM_ANCHOR)) check(`IDIOM_ANCHOR.${k}`, row);
    for (const [k, row] of Object.entries(KINDS)) check(`KINDS.${k}`, row);
    for (const [op, w] of Object.entries(SAY))
      if (!NuSongs.WORDS[w]) throw new Error(`precompose: SAY.${op} = "${w}" is not a songs.js WORD`);
    for (const k of Object.keys(IDIOM_ANCHOR))
      if (!GENRES[k]) throw new Error(`precompose: IDIOM_ANCHOR names no such anchor "${k}"`);
  }
  assertTables();

  // ...AND THE SAME LAW FOR § 7's SIX ROWS. A desk word that fields.js has
  // renamed must fail HERE, at load, naming the row and the word — not on the
  // way through song.js's loader, which drops an unrecognised value SILENTLY
  // (fields.js:745, the note on the retired `fx` field: "it is simply a key
  // the loader no longer recognizes, and it is dropped on load"). A precomposer
  // whose taste table had quietly stopped reaching the desk would look exactly
  // like a precomposer with no taste, which is the bug this round is fixing.
  // Declared here rather than beside each row so there is one list of what
  // answers to what, and it is checked in one place.
  function assertDeskTables() {
    const rows = [
      ["ROOM",       () => ROOM,       () => NF.REVERBS],
      ["RETNAME",    () => RETNAME,    () => NF.BUSNAMES],
      ["CHAIRLVL",   () => CHAIRLVL,   () => NF.LEVELS],
      ["CHAIRREV",   () => CHAIRREV,   () => NF.SENDS],
    ];
    for (const [name, row, table] of rows)
      for (const [k, v] of Object.entries(row()))
        if (!Object.prototype.hasOwnProperty.call(table(), v))
          throw new Error(`precompose: ${name}.${k} = "${v}" is not a fields.js key`);
    for (const v of CHAIRPAN)
      if (!Object.prototype.hasOwnProperty.call(NF.PANS, v))
        throw new Error(`precompose: CHAIRPAN "${v}" is not a fields.js PANS key`);
    for (const v of MACHINEKIT)
      if (!Object.prototype.hasOwnProperty.call(NF.DRUMKITS, v))
        throw new Error(`precompose: MACHINEKIT "${v}" is not a fields.js DRUMKITS key`);
    // …and the two derived words, which are the ones a retuned registry moves
    // without anybody editing this file
    if (!Object.prototype.hasOwnProperty.call(NF.SENDS, ECHOSEND))
      throw new Error(`precompose: the echo send resolved to "${ECHOSEND}"`);
    for (const w of Object.keys(GROOVELABELCHECK))
      if (!Object.prototype.hasOwnProperty.call(NF.GROOVELABEL, w))
        throw new Error(`precompose: grooveOf can answer "${w}", which is not a GROOVELABEL key`);
  }
  // every word `grooveOf` below can return — listed so the check above is a
  // check and not a restatement of the function
  const GROOVELABELCHECK = { dub: 1, laidback: 1, funk: 1, push: 1, backbeat: 1 };

  /* ---------- WHAT CAN BE PRECOMPOSED, and it is not Object.keys(GENRES) --
     MEASURED IN THE BROWSER, which is the only place it shows: ui/eight.js
     `push()` registers one `lab.eight.N` row per section into the SHARED genre
     table (eight.js:44 and :110), so at runtime the catalog carries the page's
     own scratch genres beside the 122 anchors — and a caller that enumerates
     `Object.keys(GENRES)` asks this file for a record of a SECTION. It throws
     by name, correctly ("declares no bpm"), which is how this was found.
     song.js already owns the predicate — `isSessionKey`, "a key beginning
     lab." — so this is that law applied rather than a second list. */
  const anchors = () => Object.keys(GENRES).filter((k) => !NuSong.isSessionKey(k));

  /* ---------- which row an anchor resolved to (the gate prints this) ------ */
  // Returned as data rather than logged, because "which family row did punk
  // get" is a question the review asks 122 times and a print-out is the
  // answer Paul reads.
  function idiomOf(gk) {
    const G = GENRES[gk];
    if (!G) throw new Error(`precompose: no anchor "${gk}"`);
    const fam = G.family || "kernel";
    const base = IDIOM[fam] || IDIOM.kernel;
    const own = IDIOM_ANCHOR[gk] || null;
    return { family: fam, override: !!own, row: { ...base, ...(own || {}) } };
  }

  /* ======================================================================
     5 · HOW MANY BARS A CELL IS — and the invariant that comes with it
     ======================================================================
     PROGRAM.md §2.1: every LINE cell in one document has the SAME length, a
     whole multiple of stepsIn(meter), and `sections[].bars` counts CELL bars.
     Two lengths would give two voices different bar arithmetic against one
     `total` (ui/derive.js:420) — that is the failure mode, and it is why this
     is a law and not a preference.

     THE CLAMP, in two steps and both of them measured:
       1. the idiom's own `len`, clamped to {1,2,4} — eight-bar themes exist in
          ideas-kit and no section here is written to hold one;
       2. then HALVED until it divides every section's musical bar count,
          because compose() bends lengths on purpose (bendLengths, :1559) and
          the measured set is {2,3,4,5,6,8,10,12,14,16}. A cell that does not
          divide the section is a ragged bar count, and the ragged bar is the
          one the ear hears.

     CONSEQUENCE, STATED BECAUSE IT IS AUDIBLE: per-bar edge and ornament
     passes fire once per CELL bar, so a two-bar cell halves the fill rate.
     That is a genre fact — a bossa does not fill every four bars — which is
     why `len` lives in IDIOM and is not a knob. */
  // THE CEILING IS ONE BAR, AND IT IS A MEASUREMENT, NOT A PREFERENCE.
  // A first cut of this file shipped two- and four-bar cells (238 of 366
  // records) and 23 sections came out WHOLLY SILENT. The cause is that
  // songs.js WORDS is written in ABSOLUTE STEPS of a sixteen-step bar —
  // "the head only" is `excerpt(0, 4)`, "up a degree" is `excerpt(4, 8)`,
  // "a beat later" is `rotate(-4)`. On a 64-step cell `excerpt(4, 8)` keeps
  // steps 4..11 of sixty-four, and a cell whose onsets are elsewhere is
  // gone. That is not a bug in the words and not a bug in the cells; it is
  // that ONE of the two has to move first, and the words are the vocabulary
  // the page OFFERS — a Development menu half of whose entries mute the
  // voice is worse than a one-bar cell.
  //
  // The second reason is arithmetic and it is worth writing down because the
  // next person will hit it: `sections[].bars` counts CELL bars (PROGRAM.md
  // §2.1), but the two things that READ it — ui/derive.js:406 (`len` × the
  // GENRE's bar) and document.js `scoreOf` (`bar += total`) — both measure it
  // in sixteen-step bars. At one bar per cell the two readings are the same
  // number and nothing can disagree. Above one bar they cannot both be right,
  // and the record would play at 1/cb of its composed length.
  //
  // So `len` stays in IDIOM — it is a genre fact and this is where genre facts
  // live — and this function reports what the idiom WANTS while returning what
  // is playable. When the words learn to scale with the bar (or a second word
  // table arrives keyed by cell length), the ceiling is one constant.
  const CELL_BAR_CEILING = 1;
  function cellBarsOf(gk, lens) {
    const want = LENGTHS[idiomOf(gk).row.len].bars;
    let cb = want >= 4 ? 4 : want >= 2 ? 2 : 1;
    const ls = lens && lens.length ? lens : [1];
    while (cb > 1 && ls.some((L) => L % cb)) cb /= 2;
    return Math.min(cb, CELL_BAR_CEILING);
  }

  /* ---------- the phrase becomes a document cell ------------------------- */
  // The one piece of arithmetic this module owns, and it is the inverse of
  // document.js `toPhrase`. `deg` crosses unchanged because it is SIGNED and
  // ALPHABET-FREE (kernel.js:8) — the same cell is legal under every mode and
  // needs no per-genre repitching, which is the property that let one
  // eight-step cell become a whole chant.
  function cellOf(row, kind, cb, G, steps) {
    const m = { ...Id.blank(), ...row, ...KINDS[kind],
                len: cb === 4 ? "four" : cb === 2 ? "two" : "one", answer: true };
    const ph = Id.toPhrase(m, null);              // ideas-kit.js:425, pure, cached
    const n = cb * steps, cap = capOf(G);
    const deg = ph.deg.slice(0, n), vel = ph.vel.slice(0, n);
    const play = new Array(n).fill("r"), acc = new Array(n).fill(0);
    const on = [];
    for (let i = 0; i < n; i++) if (ph.gate[i]) on.push(i);
    on.forEach((i, j) => {
      const next = j + 1 < on.length ? on[j + 1] : n;
      // A WRITTEN LENGTH BEATS NOTHING HERE. ideas-kit's own `hold` is the
      // sentence's tie across a barline; the gap to the next onset is the
      // default; and the anchor's articulation caps both, which is the only
      // way a `legato` chant and a `staccato` punk hook come out of the same
      // contour as two different rows of "play".
      const L = Math.max(1, Math.min(ph.hold && ph.hold[i] ? ph.hold[i] : next - i,
                                     cap, next - i));
      play[i] = "n";
      for (let k = 1; k < L; k++) play[i + k] = "h";
      // AN ACCENT WHERE AN ACCENT MEANS SOMETHING — the top of a bar, which
      // is compose.js:424's own rule and what kernel.bass reads.
      if (i % steps === 0) acc[i] = 1;
    });
    return { cell: { kind: "line", deg, play, vel, acc }, ph };
  }

  /* ---------- reverse-lookups into the alphabet tables -------------------- */
  // THROW BY NAME rather than fall back. An anchor with a literal mode array
  // that no key answers to is a TABLE ERROR — a document says its alphabet by
  // name, so a nameless alphabet cannot be written down — and a runtime
  // fallback would silently compose the record in the wrong mode. (This is why
  // genres.js gained SCALES.blues and SCALES.bluesx this round: five anchors
  // spelled their subject alphabet as a literal with no word for it, and the
  // count is 99 of 99 now.)
  const sameArr = (a, b) => Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((x, i) => x === b[i]);
  const nameIn = (table, v) => Object.keys(table).find((k) => sameArr(table[k], v));
  function modeName(gk, G) {
    if (!G.mode) return "aeolian";                 // genres.js:66 — the table's own default
    const n = nameIn(MODES, G.mode);
    if (!n) throw new Error(`precompose: anchor "${gk}" declares a mode no MODES key names`);
    return n;
  }
  function scaleName(gk, G) {
    if (!G.scale) return null;                     // null = the mode's own alphabet
    const n = nameIn(SCALES, G.scale) || nameIn(MODES, G.scale);
    if (!n) throw new Error(`precompose: anchor "${gk}" declares a scale no SCALES key names`);
    return n;
  }

  /* ---------- the changes ------------------------------------------------- */
  // Three sources, in the order the catalog states them, and the third is
  // BYTE-IDENTICAL to what a prog-less cycle genre already plays: chordsOf
  // synthesizes exactly {q:"triad", inv:0, borrow:0} from harm() (kernel.js:
  // 672-677) and harm returns at(g.roots, bar), so roots.map(d => ({d, q:
  // "triad"})) is the same progression written down.
  //
  // THE ONE LOSS, NAMED: three anchors (bossa, and two neighbours) write a bar
  // as a LIST of chords — a ii-V inside one bar. The document's `prog` is one
  // chord per bar (PROGRAM.md §2.1) and `toGenre` reads `A.prog.map(c => c.d)`
  // for the roots, which an array entry cannot answer. So a listed bar is
  // flattened to its FIRST chord: the bar count and the roots survive, the
  // mid-bar change does not. It is written here rather than dropped silently
  // because the fix is a document shape, not a compiler.
  //
  // AND THE CHORD TRAVELS WITH EVERY FIELD THE KERNEL READS, which it did not
  // until 2026-08-25. This read `{ d: c.d || 0, q: c.q || "triad" }` and threw
  // the rest away, so `marabi`'s `inv: 2` — the anchor's own comment calls it
  // "THE HIGHEST STRUCTURAL VALUE ON THIS PAGE", because I-IV-I6/4-V IS the
  // style — reached no record. Measured: with it carried, 4 of marabi's 32
  // bass notes move (kernel.js:687 `bassPc: pcs[(c.inv||0) % pcs.length]`,
  // "an inversion puts the third under the band"). `mbube` inherits the same
  // field and the same fix.
  //
  // WHICH FIELDS, AND WHY THESE. kernel.js chordsOf (:683-688) reads exactly
  // four things off a chord — `d`, `q`, `inv`, `borrow` — plus `beats`, which
  // only ever divides a bar between the chords of a LIST. So `inv` and
  // `borrow` are carried whenever the anchor states them (0 anchors state a
  // borrow today, and the day one does it arrives rather than vanishing), and
  // `beats` is deliberately NOT carried: the list it divides is flattened to
  // its first chord one line up, and a lone chord's window is `N - cursor` by
  // construction, so a carried `beats` would be a number in the document that
  // reaches nothing — the same lie this fix exists to end. An absent field
  // stays absent: `inv: 0` on every chord in the catalog would be 137 anchors
  // newly claiming a decision nobody made.
  function progOf(G) {
    if (G.prog) return G.prog.map((slot) => {
      const c = Array.isArray(slot) ? slot[0] : slot;
      const out = { d: c.d || 0, q: c.q || "triad" };
      if (c.inv) out.inv = c.inv;
      if (c.borrow) out.borrow = c.borrow;
      return out;
    });
    if (G.roots) return G.roots.map((d) => ({ d, q: "triad" }));
    return [{ d: 0, q: "triad" }];
  }

  /* ---------- the nearest word to a number -------------------------------- */
  // FIVE derivations below ask the same question of five different registry
  // tables — a swing ratio, a reverb send, an echo mix. It was written out
  // inline for `swingOf` first; a second copy is how two of them come to round
  // 0.5 in opposite directions, so there is one. `skip` exists because a table
  // can hold a word that is a REFUSAL rather than a small amount (`off` shuts
  // a bus, `none` is dry) and "nearest" must never land on one by accident.
  function nearestKey(table, n, skip) {
    let best = null, d = Infinity;
    for (const [k, v] of Object.entries(table)) {
      if (skip && skip.indexOf(k) >= 0) continue;
      const dd = Math.abs(v - n);
      if (dd < d) { d = dd; best = k; }
    }
    return best;
  }

  /* ---------- the swing word ---------------------------------------------- */
  // compose() draws a SWINGS key outright for a third of records; the rest fall
  // back to the NEAREST key to whatever number the anchor declares, because the
  // document says swing by name and the anchor says it as a ratio. null means
  // "the anchor's own lean", which is what absence has always meant here.
  function swingOf(R, G) {
    if (R.swing) return R.swing;
    if (G.swing == null) return null;
    // `straight` is 0 and is in the table, so it may be chosen here and then
    // spelt as absence one line down — which is the same thing, and the ONE
    // place `nearestKey` is asked for the refusal on purpose.
    const best = nearestKey(NF.SWINGS, G.swing);
    return best === "straight" ? null : best;
  }

  /* ======================================================================
     6 · SEED DISCIPLINE
     ======================================================================
     The house rule, repeated a dozen times in compose.js: every independent
     policy draws from its own FNV-1a-salted mulberry32 stream, so retuning one
     policy cannot move another.

     compose(gk, seed) owns every stream it already owns; this file must not
     draw from them, must not call compose more than once, and must not consume
     R in any order-dependent way. Its OWN stream is declared here and — in
     today's design — UNCONSUMED, because every field above is a table lookup
     and there is no genuine choice left to make. Declaring it now means the
     first idiom variation somebody adds later does not shift a bar line.

     § 7 BELOW DRAWS NOTHING EITHER, and that is a decision rather than an
     omission: a desk setting that moved with the seed would mean the same
     genre mixed two ways for no reason anybody could hear a reason for. Every
     word it writes is a function of the ANCHOR alone, so seeds 1, 2 and 3 of
     one genre are three arrangements of one record and not three records. */
  const idiomStream = (gk, seed) => rng(ihash(gk + "/idiom/" + seed));

  /* ======================================================================
     7 · THE ENGINEER'S PASS — the Sound axis, and the pocket
     ======================================================================
     STATE.md item 17, 2026-08-24: "The engineer wrote a per-voice desk, a bus
     block and a master into the document shape, and precompose writes NONE of
     them — 0 of 122 precomposed records carry a `voice.desk`, a `sound.buses`
     or a `sound.fx`. So the opened reverb return … reaches exactly ONE record:
     the shipped chant, because songs.js:203 carries `buses.rev.ret: "hall"` by
     hand." That is the gap this section closes, and PLAN.md's standard is the
     one to close it against: THE RECORD ARRIVES FINISHED, the desk already set
     the way that record would be mixed.

     THE COMMENT THAT USED TO STAND WHERE THIS ONE DOES said, of `sound`, that
     "the per-voice board, the sends and the returns are the engineer's slice
     (D3) and this file writes none of them — one owner per fact". It was right
     about ownership and wrong about the world: the engineer owns the WIRE
     (desk-doc.js, fields.js, audio/desk.js) and nobody owned the WRITER, so
     the surface was built and left empty. It is rewritten rather than deleted,
     because the next person to wonder why this file reaches into the Sound
     axis deserves the record of why it did not.

     EVERY WORD BELOW IS A REGISTRY KEY, LOOKED UP RATHER THAN TYPED. `sound.
     buses` is a fields.js BUSES value verbatim, `sound.master` is a MASTER
     value verbatim, a voice's `desk` is a PARTMIX entry verbatim (PROGRAM.md
     §2.1, desk-doc.js:12) — no translation vocabulary, on purpose, because
     fields.js:810 records what a second spelling costs. The knob tables are
     reached through `NF.BUSBY` rather than by name so a retuned registry moves
     this file by existing, and so an added knob is not silently unwritten.

     AND ABSENT IS STILL TODAY. Nothing here changes what a document that says
     nothing does; it changes what precompose SAYS. A record with no `buses`
     still gets `BUSES = null` and the untouched branch (desk-gate G1), and the
     gate proves that before it counts a single derived word. */

  // the registry row for one bus knob — `NF.BUSBY.rev.knobs` is the list
  // song.js validates a save against, so reading the table off it is the same
  // reading twice rather than two lists that agree today
  const knobTable = (bus, key) =>
    (NF.BUSBY[bus].knobs.find((k) => k.key === key) || {}).table;

  /* ---------- WHAT THE ANCHOR'S OWN DRUM GRID SAYS ------------------------
     Counted off `G.kit` rather than declared anywhere: this is the one place
     in the catalog where a genre writes down how it actually FEELS, step by
     step, and until now nothing read it for anything but notes.

     `TIMELANES` is kernel.js:1790's own HATS + CYMBALS and deliberately not
     `c`: a clap is a BACKBEAT lane, it carries the two and the four, and
     counting it as time-keeping would call every clap record a sixteenth-note
     record. A key that is not a single letter is a SIDECAR (~nudge ?chance
     !grace — kernel.js:2303) and is not a lane at all. */
  const TIMELANES = ["h", "o", "f", "r", "x"];
  function kitFacts(G) {
    const kit = G.kit || {};
    const lanes = Object.keys(kit).filter((k) => /^[a-z]$/.test(k));
    const on = (l) => (kit[l] || []).filter(Boolean).length;
    let off = 0;                                  // offbeat sixteenths, time lanes
    for (const l of TIMELANES)
      (kit[l] || []).forEach((v, i) => { if (v && i % 2) off++; });
    return { any: lanes.length > 0, kick: on("k"), off };
  }

  /* ---------- THE GROOVE WORD --------------------------------------------
     STATE.md item 18: `time.groove` "says `funk` on 97 anchors and nothing on
     the other 25 — `backbeat`, `pushed`, `laid back` and `dub` are in the table
     and are never chosen, so a bossa and a boom-bap are handed the same pocket."

     WHY IT SAID ONE WORD. compose.js:1834 draws it — `groove: kit ? pick(r,
     [null,"backbeat","push","laidback","funk","dub"]) : null` — off the SHARED
     record stream, at a fixed position. compose.js:1810's own comment, twenty-four lines
     above it, says exactly what that costs: "the phrase bank consumes the same
     number of draws whatever the genre, so a chooser reading the shared stream
     sits at the same position for every genre and the whole table ends its
     verses the same way at any fixed seed." Measured here: seed 1 gave `funk`
     to all 97, seed 2 gave `dub` to all 97. It was never 97 opinions; it was
     one coin, flipped once.

     SO THE WORD IS DERIVED INSTEAD, AND FROM NOTHING RANDOM. A groove is a
     sixteen-slot fingerprint of timing AND loudness (kernel.js:369), and every
     rung below names the anchor fact that fingerprint answers to. First match
     wins; the order is the order in which one fact overrules another. */
  const SIXTEENTHS = 4;      // offbeat hits on the time lanes before it is a 16th feel
  const HAND       = 0.8;    // touch.v — the velocity spread a ghost note needs
  const REALSWING  = 0.17;   // between SWINGS `light` (0.12) and `swing` (0.22)
  const HARD       = 0.5;    // stress — askable.js: "how much does the band lean"
  const FAST       = 130;    // bpm, above which leaning hard reads as driving
  const POCKET     = 140;    // bpm, above which sixteenths are a drive, not a pocket
  const BIGROOM    = 0.5;    // tone.verb — RETURNS `hall`, where a space record starts
  function grooveOf(G) {
    const f = kitFacts(G), T = G.tone || {}, fx = G.fx || [];
    // NO DRUMMER, NO POCKET. 25 anchors declare no grid at all and a groove is
    // a fact about a kit; `null` here is what `setGroove` has always meant.
    if (!f.any) return null;
    // DUB — the one profile in the table that is MINED rather than written
    // (kernel.js:377, off the MIDIMAN dub rip): a drag with the weight moved
    // off the one. Two anchor facts reach it. The ONE DROP — a kick that fires
    // exactly once in its own bar, which is true of reggae and dub and of
    // nothing else in the catalog — and the SPACE RECORD, an anchor that sends
    // an echo into a room at least as big as a hall. A kit with NO kick at all
    // (skiffle, minimalism) is not a one drop, it is a different band, so the
    // test is `=== 1` and not `<= 1`.
    if (f.kick === 1 || (fx.indexOf("echo") >= 0 && (T.verb || 0) >= BIGROOM))
      return "dub";
    // LAID BACK — the record already drags, and it says so as a ratio. Only a
    // REAL shuffle counts: fields.js SWINGS puts `light` at 0.12 and `swing` at
    // 0.22, and a light lean is the sixteenth-note lilt a funk record has, not
    // a drag. So the line is drawn between those two words and not at zero.
    if (G.swing >= REALSWING) return "laidback";
    // FUNK — "the sixteenths carry it, and the ghosts between them are what you
    // hear" (kernel.js:393). Three facts, all three required: the anchor's own
    // time lanes fire on the offbeat sixteenths; there is a HAND on them
    // (`touch.v`, the velocity spread — a machine at 0.12 has no ghosts to
    // play); and the tempo is a pocket rather than a drive. And no distortion:
    // an anchor that declares `crunch` is a wall of sixteenths, and a ghost
    // note under a wall is not audible, so it is not a groove.
    const sixteenths = f.off >= SIXTEENTHS;
    if (sixteenths && G.touch && G.touch.v >= HAND &&
        G.bpm <= POCKET && fx.indexOf("crunch") < 0) return "funk";
    // PUSHED — the lean forward. Three ways in, and they are one idea: nobody
    // is holding back. A band that leans hard on the beat AT SPEED (`stress`
    // is askable.js:72's own question); a machine record, which declares no
    // `stress` at all because there is no band to ask; or any sixteenth-note
    // time-keeping that did not qualify as funk above — a motorik pulse and a
    // trap hat are both driving, not pocketing.
    if (G.stress == null || (G.stress >= HARD && G.bpm >= FAST) || sixteenths)
      return "push";
    // BACKBEAT — two and four loud, nothing moved. The honest zero of the
    // table for a record whose kit says nothing more particular than that.
    return "backbeat";
  }

  /* ---------- WHICH ROOM THE RECORD IS IN --------------------------------
     One row per genres.js family (:5699 stamps `family` on every anchor) —
     the same shape and the same argument as IDIOM at the top of this file:
     ten rows beat 122 hand-typed ones, and a row that cannot state its reason
     does not belong. Every value is a fields.js REVERBS key, which is the
     parent's own five reverb modules under desk words (fields.js:476).

     THIS IS THE ONE TASTE CLAIM IN THIS SECTION and it is marked as such. The
     gate prints the distribution; everything else here is arithmetic on a
     number the anchor already declared. */
  const ROOM = {
    kernel: "hall",      // the zero: a plain big room, nothing characterful
    vox:    "chamber",   // unaccompanied voices sing in stone, not in a plate
    club:   "plate",     // the studio plate is the dance record's own reverb
    soul:   "plate",     // and it is what a soul vocal has been sung into since 1965
    groove: "spring",    // the dub tank IS the sound — not an effect on it
    band:   "spring",    // the tank lives in the guitar amp; a band record is in the amp
    studio: "plate",     // a made record, made the way records were made
    drift:  "shimmer",   // the one that has no natural room at all, which is the point
    roots:  "chamber",   // a hall recording of people in a hall
    parts:  "hall",      // the FUNCTION genres are parts, and a part takes the zero
  };
  // the nameplate follows the return, so the board's bus 1 is CALLED what it
  // is. `shimmer` is the one REVERBS word BUSNAMES has no entry for — the
  // desk's word for that return is `air`.
  const RETNAME = { plate: "plate", hall: "hall", chamber: "chamber",
                    spring: "spring", shimmer: "air" };

  /* ---------- HOW FAR OPEN THE RETURN IS ---------------------------------
     `tone.verb` is already the number every unit SENDS — audio/desk.js
     sectionOf: "ABSENT MEANS AS THE GENRE ASKS — every genre already declares
     how wet it wants to be (tone.verb), and that number used to be thrown
     away". It was thrown away at the OTHER end: the send arrived at a return
     whose gain was zero (fields.js:468, "78% wet and bone dry, for as long as
     this page has existed"). So the return is the same number, rounded to the
     nearest RETURNS word — a dry record stays dry because its SEND is small,
     and a chant lands in a stone room because gregorian asks for 0.78 of one.

     `off` is skipped and never chosen. It is an explicit zero the master's own
     `space` bleed cannot reopen (desk-gate G5), and an anchor asking for 0.06
     of a room is asking for a LITTLE room, not for the bus to be shut. This is
     the line that answers "0 of 122 carry a sound.buses": all 122 do now, and
     every one of them lands its send somewhere. */
  const retOf = (G) => nearestKey(knobTable("rev", "ret"),
    (G.tone && G.tone.verb != null) ? G.tone.verb : 0.15, ["off"]);

  /* ---------- THE ECHO BUS, WHEN THERE IS AN ECHO -------------------------
     Ten anchors declare `echo` in their `fx`. An insert costs a MULTIPLE and a
     bus costs a CONSTANT — measured, fields.js:737 — and this desk HAS an echo
     bus, so the chip becomes a SEND on the chair carrying the tune (below) and
     the bus is opened here to receive it. The other eleven chips are not buses
     and stay chips (`sound.fx`).

     Every knob is derived from a number the anchor already declared:
       time  a dotted eighth, the oldest delay on a record — EXCEPT on a record
             that swings, where a dotted delay fights the shuffle it is
             printing over, so it goes to the straight eighth the band is on.
       fb    more repeats in a big room, fewer in a small one — the same
             `tone.verb` the return above reads.
       tone  the anchor's OWN filter cutoff (`tone.cut`): a record voiced under
             2 kHz gets a dark echo because a bright one would sit in front of
             the thing it is echoing. ETONES is dark 1400 / bright 5600 and the
             midpoint of the catalog's cutoffs is 2000.
       name  what it is: one repeat is a slap, several are an echo. */
  const DARKCUT = 2000;
  const hasEcho = (G) => (G.fx || []).indexOf("echo") >= 0;
  function echoBus(G) {
    const T = G.tone || {};
    const fb = (T.verb || 0) >= BIGROOM ? "more" : "less";
    return { name: fb === "more" ? "echo" : "slap",
             time: G.swing > 0 ? "8" : "d8",
             fb,
             tone: (T.cut || 0) <= DARKCUT ? "dark" : "bright" };
  }

  /* ---------- THE WHOLE BUS BLOCK ---------------------------------------- */
  function busesOf(G) {
    const color = ROOM[G.family] || ROOM.kernel;
    const out = { rev: { name: RETNAME[color], ret: retOf(G), color } };
    if (hasEcho(G)) out.echo = echoBus(G);
    // bus 3 declares no knob but its name (fields.js BUSROWS: `room` IS the
    // reverb bus, and pretending otherwise is the lie that round stopped
    // telling), so there is nothing here to say about it that bus 1 has not
    // said already.
    return out;
  }

  /* ---------- THE PER-VOICE DESK -----------------------------------------
     A chair's entry is a PARTMIX entry verbatim, and it says only what the
     record's own CAST already implies. kernel.js:1131 PARTS is the role table
     and `cast.part` is its word, so "a lead sings over the band and a pad sits
     under it" is not taste — it is what those two words MEAN, and LEVELS is
     the four places a desk has to say it. Absent is `norm` is today, so the
     three roles that ARE the band (`line`, `riff`, `counter`) get no entry at
     all from this row and a record's board is not covered in decisions nobody
     made. */
  const CHAIRLVL = { lead: "fwd", pad: "back", drone: "back" };
  // ...AND WHO WANTS MORE ROOM THAN THE RECORD DOES. A part's `rev` ADDS to
  // the section's own `tone.verb` (fields.js:814: "the part send is what this
  // chair asks for ON TOP of the section, so absent must mean adds nothing"),
  // so this row can only ever say MORE — and the chair that wants more is the
  // one whose job is to be the space the others play in.
  const CHAIRREV = { pad: "touch", drone: "touch" };
  // TWO CHAIRS OF ONE ROLE MUST NOT SIT ON TOP OF EACH OTHER. Post rock is a
  // pad and two clean guitars (fields.js:691's own example); the first keeps
  // the centre, the second and third are moved off it. The parent already
  // carves stereo per voice and a part pan RIDES on that rather than replacing
  // it (audio/desk.js's "what has no home" note), so these are half-places and
  // not hard ones.
  //
  // COUNTED ON THE CAST, NOT ON THE ADDRESS, and the difference is real: this
  // walk groups by `cast.part`, while desk-doc.js chairsOf re-derives the role
  // by CYCLING the anchor's `part` scheme (`g.part[v % g.part.length]`) and can
  // therefore call the second `lead` of this record `stab2`. Measured in the
  // browser on Kingston: the vocal is the second lead here and the board's
  // second stab there. It does not matter and must not be "fixed" by copying
  // the address in — the entry lives ON THE VOICE, so it reaches that voice's
  // channel whatever the channel is called, and what this row is deciding is
  // a musical fact (two people playing the same role) rather than a routing
  // one. desk-doc's own header says why the address is not `cast.part`.
  const CHAIRPAN = ["hl", "hr"];
  // A DRUM MACHINE HAS NO ROOM. `room` is bus 3 and bus 3 folds into bus 1
  // (audio/desk.js:908), so this is the kit asking for a little more of the
  // same return — written only where the anchor named an ACOUSTIC kit, which
  // is the anchor saying the drums were in a room to begin with. The four
  // machines are the exception and they are listed rather than the other five,
  // because a drumkit added to fields.js DRUMKITS is far more likely to be a
  // kit than a box.
  const MACHINEKIT = ["tr909", "tr808", "cr78", "electronic"];
  // HOW WET THE ECHO SEND IS: not invented, and not a fifth spelling of "some".
  // It is the echo chip's OWN declared mix (fields.js fxMix, FX.echo.params.mix
  // = 0.35) rounded to the nearest SENDS word — "so a chorus is as wet on the
  // bus as it was in the rack", which is fields.js:442's own sentence about
  // exactly this conversion.
  const ECHOSEND = nearestKey(NF.SENDS, NF.fxMix("echo"), ["none"]);

  /* WHAT THIS FILE DELIBERATELY DOES NOT WRITE, and why, so the next reader
     does not take the silence for an oversight:
       `fx` on a chair   — a chip on a TRACK is Paul's open question 3
                           (STATE.md: "This reverses your 2026-08-17
                           directive… Do you accept the reversal?"). It is
                           undecided, and a precomposer that put one on 122
                           records would have answered it for him. The
                           genre-wide chip goes on the BOX instead (`sound.fx`),
                           which is the one PARTMIX's note says was never taken
                           off: "a genre-wide treatment, not a per-track insert,
                           and Paul never asked for it to go".
       `fader`           — an offset in dB is the hand on the board. The
                           composed level is `lvl`; leaving the fader at zero
                           is what makes a user's move visible as a move.
       `eq`              — no anchor fact names a CHAIR's tone. The genre's own
                           voicing is already in `tone`, and audio/desk.js
                           derives a per-part shading from it; a second, guessed
                           EQ curve on top would fight a measured one.
       `mute` / `solo`   — a record that arrives with a voice muted is a record
                           with a bug in it. */

  // one voice's entry, or null when this chair has nothing to say. `nth` is
  // which chair of its own role this is, counted in document order — the same
  // count fields.js chairKeys makes when it addresses them (line, line2, line3).
  // `echo` is true for the one chair the record's echo is spent on.
  function deskFor(voice, nth, echo) {
    const part = (voice.cast && voice.cast.part) || "line";
    const e = {};
    if (CHAIRLVL[part]) e.lvl = CHAIRLVL[part];
    if (CHAIRREV[part]) e.rev = CHAIRREV[part];
    if (nth > 0) e.pan = CHAIRPAN[(nth - 1) % CHAIRPAN.length];
    if (voice.kind === "drums" &&
        MACHINEKIT.indexOf(voice.instrument) < 0) e.room = "touch";
    if (echo) e.echo = ECHOSEND;
    return Object.keys(e).length ? e : null;
  }

  // THE ENGINEER'S WHOLE PASS OVER A FINISHED CAST, in one walk so the chair
  // count and the echo chair cannot be counted twice and disagree. Mutates the
  // voices it is handed, which is what "the record arrives finished" means:
  // there is no second document.
  function deskThe(voices, G) {
    // the echo goes on the chair carrying the tune — the FIRST line voice,
    // which is the one `dflt` gave the record's home cell to. Not the `lead`
    // chair by name: 92 of 122 anchors declare no `part` scheme at all and
    // would then have had nowhere to put it.
    const lead = hasEcho(G) ? voices.findIndex((v) => v.kind === "line") : -1;
    const seen = {};
    voices.forEach((v, i) => {
      const part = (v.cast && v.cast.part) || v.kind;
      const nth = (seen[part] = (seen[part] || 0) + 1) - 1;
      const e = deskFor(v, nth, i === lead);
      if (e) v.desk = e;
    });
    return voices;
  }

  /* ---------- THE RECORD-WIDE CHIP ---------------------------------------
     The anchor's own `fx`, verbatim, minus the one that became a send. Read
     through the registry's own filter (`FX` holds the key, `MAX_FX` caps the
     chain) so a chip renamed in fields.js drops here instead of reaching the
     engine as an insert it cannot build. */
  const soundFxOf = (G) => (G.fx || [])
    .filter((k) => k !== "echo" && Object.prototype.hasOwnProperty.call(NF.FX, k))
    .slice(0, NF.MAX_FX);

  /* ======================================================================
     8 · genreToDocument — the whole record
     ====================================================================== */
  function genreToDocument(gk, seed) {
    // THROW BY NAME. compose.js:1767 silently rewrites an unknown key to
    // "simple", which is exactly the rot this project has legislated against
    // (compose.js:1846's own law, two hundred lines below the fallback): a
    // caller that asks for a genre that is not there gets told which one.
    if (!GENRES[gk]) throw new Error(`precompose: no anchor "${gk}"`);
    const s = seed == null ? 1 : seed;
    const G = GENRES[gk];
    const R = compose(gk, s);                     // ONCE. Everything else reads R.
    idiomStream(gk, s);                            // declared, reserved, unconsumed
    const { row } = idiomOf(gk);
    const scale = scaleName(gk, G);                // throws by name if unnameable

    const steps = stepsIn({ meter: null });        // 0 of 122 anchors declare a meter
    const cb = cellBarsOf(gk, R.song.map((b) => b.len));
    const sid = (i) => "s" + i;
    const NSEC = R.song.length;

    /* ---- FORM. `bars` counts CELL bars, per PROGRAM.md §2.1, and `cb`
       divides every section's musical length by construction (cellBarsOf).
       With the one-bar ceiling in force the two counts are the SAME NUMBER,
       which is the property that lets ui/derive.js:406 and document.js
       `scoreOf` — which both measure this field in sixteen-step bars — agree
       with the spec instead of contradicting it. ------------------------- */
    // THE ALIAS COMES OUT, FOR THE ONE WORD THE TABLE HAS LEARNED.
    // compose.js:53 stores a plan word the loader did not know under "its
    // nearest legal role", keeping the honest name in `cue`, and says in the
    // same breath: "when the registry learns the words (the UX phase), the
    // alias comes out and nothing else moves." fields.js ROLES learned `build`
    // on 2026-08-22 ("the boxes are real") and nobody came back for it.
    // MEASURED on genreToDocument("techno", 2), the strip said
    // `intro | verse | breakdown | drop | breakdown | verse | breakdown | drop
    //  | drop | outro` where compose's dance plan says `build` in the two slots
    // before a drop — the wrong word, and a SILENT MUSICAL LOSS underneath it:
    // ui/derive.js:627 roleOf reads `cue` for exactly these two words,
    // document.js:273 writes `cue: s2.role`, so with the alias in place the
    // build's accelerando (TEMPOROLE 1.006, and PUSH — "an accelerando where a
    // build runs at its drop") never fired on a single precomposed record.
    //
    // PLANCUE, NOT `cue` — compose.js:186's own guard, and it is load-bearing
    // here for the same reason it is there: the head intro's `cue` carries the
    // intro KIND, and two of those kinds ("drums", "solo") ARE role words, so a
    // raw cue read would relabel a bulgarian record's opening bar as a solo
    // section. Only the two words that name a plan role are eligible, and each
    // is taken only if ROLES actually has it — so `prechorus`, which the table
    // still has no word for, stays stored as a verse until it does, and this
    // line starts honouring it the day it lands.
    const PLANCUE = { prechorus: 1, build: 1 };
    const roleName = (b) => (PLANCUE[b.cue] && NF.ROLES[b.cue] ? b.cue : b.role);
    const sections = R.song.map((b, i) => ({
      id: sid(i), role: roleName(b), bars: b.len / cb,
      // the within-section sentence — compose decides it (the sixteen-bar
      // law, :1920) and the kernel reads g.period per bar (kernel.js:1202)
      ...(b.period ? { period: b.period } : {}),
    }));
    const minBars = Math.min(...sections.map((x) => x.bars));

    /* ---- who plays what, per section ----------------------------------- */
    // ui/derive.js:408 is the law: nP = e.slots.length, and phrase index pi
    // covers voices pi, pi+nP, … — so voice v reads slot v % nP. A base entry
    // with NO slots is the band laying out, and the word for that is "out".
    const nBase = G.voices;
    const baseKind = R.song.map((b) => {
      const sl = b.stack[0].slots || [];
      return (v) => (sl.length ? KIND_OF[sl[v % sl.length]] : null);
    });
    // LAYERS become ordinary line voices of this document. That is the whole
    // projection: the eight axes have one cast, and a layer is a chair in it.
    // Its part, register and instrument are read off ITS OWN anchor (and the
    // +1 register is derive.js:466's own `reg: v => L.reg(v) + 1`, so a layer
    // still sits above the band the way it does in a box).
    const layerKeys = [];
    for (const b of R.song)
      for (const e of b.stack.slice(1))
        if (GENRES[e.g] && !layerKeys.includes(e.g)) layerKeys.push(e.g);

    /* ---- MATERIAL. One cell per kind the record actually uses. ---------- */
    const usedKinds = new Set();
    for (let i = 0; i < NSEC; i++) {
      for (let v = 0; v < nBase; v++) { const k = baseKind[i](v); if (k) usedKinds.add(k); }
      for (const e of R.song[i].stack.slice(1))
        if (GENRES[e.g] && (e.slots || []).length) usedKinds.add(KIND_OF[e.slots[0]]);
    }
    if (!usedKinds.size) usedKinds.add("hook");   // a record is never cell-less
    const cells = {};
    const phraseOf = {};
    for (const k of KIND_OF) if (usedKinds.has(k)) {
      const made = cellOf(row, k, cb, G, steps);
      cells[k] = made.cell; phraseOf[k] = made.ph;
    }
    // THE KIT TRAVELS BY VALUE, EVERY KEY. The catalog uses eighteen lane
    // letters and some lanes are VELOCITY-valued (punk's crash lane is
    // [9,…,8], not [1,…,1]) and some are sidecars (~k ?k !p ~r ~s ?s). A
    // compiler that rebuilt the grid from a list of lane names would flatten
    // both. So the anchor's own grid is deep-copied and nothing is filtered.
    const hasKit = Object.keys(G.kit || {}).length > 0;
    if (hasKit) cells.beat = { kind: "drum", lanes: JSON.parse(JSON.stringify(G.kit)) };

    /* ---- the material map and the word map for one line voice ---------- */
    const dflt = (kinds) => {                     // the cell a voice reads by default
      const count = new Map();
      for (const k of kinds) if (k) count.set(k, (count.get(k) || 0) + 1);
      let best = null, n = -1;
      for (const k of KIND_OF) if ((count.get(k) || 0) > n) { n = count.get(k) || 0; best = k; }
      return count.size ? best : Object.keys(cells).find((c) => cells[c].kind === "line");
    };
    // A word per section: the FIRST op with a row wins. `b.ops` is at most two
    // (measured) and the second is compose.js:1962's anti-restatement nudge,
    // which this document expresses as a different CELL rather than a second
    // word — the document says one word per voice per section and that is the
    // vocabulary's own shape, not a limitation to route around.
    // ...AND A WORD THAT MUTES THE VOICE IS NOT A DECISION ANYBODY MADE.
    // songs.js WORDS are written in absolute steps ("the head only" is
    // excerpt(0,4)), so a word and a cell can genuinely miss each other — a
    // `pickup` cell has its first onset at step 7 and its head is four steps
    // of silence. Measured on the first cut, that is how a whole section went
    // quiet. So the word is APPLIED before it is written down, and one that
    // leaves no onset falls through to "as written", which is total and
    // cannot be wrong. Deterministic and table-driven: this is a test, not a
    // dice roll, and the same (cell, word) pair always answers the same way.
    const opsOf = (name) => (NuSongs.WORDS[name] || []).map(([op, ...a]) => K[op](...a));
    const speaks = (word, kind) => {
      const ph = phraseOf[kind];
      if (!ph) return true;
      const p = K.word(ph, opsOf(word));
      return p.gate.some(Boolean);
    };
    const sayOps = (ops, kind) => {
      for (const o of ops || []) if (SAY[o] && speaks(SAY[o], kind)) return SAY[o];
      return "as written";
    };

    const voices = [];
    const used = new Set();
    const nameFor = (base) => { let n = base, i = 1;
      while (used.has(n)) n = base + (++i); used.add(n); return n; };

    /* ---- THE RECORD'S OWN SIGNATURE, WHICH THIS FILE USED TO OVERRULE -----
       Measured 2026-08-26 over 199 anchors x 3 seeds: 3228 line chairs, every
       single one of them handed an `instrument` name, and therefore ZERO chairs
       spelled "the record's own". That is not a shading, it is a seam:

         precompose  instrument: instrOf(gk, v)      <- a GM soundfont id, always
         document.js chairs[v] = { instr: <that> }   (:203-205)
         derive.js   poolInstrOf returns it as `over` (:115-118)
         plan.js     gsyn = font || (over ? null : ...) (:207)

       — so on a precomposed record the fourth line nulls the signature synth of
       every chair, and all fifteen anchors that declare one (`acid`'s 303,
       `industrialrock`'s fuzz at drive 0.85, `vaporwave`'s DX7, kraftwerk's
       Model D) played a sampled photograph of themselves instead. Paul heard it
       as "industrial rock sounds more like fela kuti than nine inch nails".
       THE BOX HAS ALWAYS PLAYED THESE RIGHT — a catalog genre sets no `chairs`,
       so `over` is null there and `G.synth` stands. Precompose was the outlier;
       this line makes a precomposed record sound like its own anchor.

       ABSENT IS THE SPELLING. `document.js` reads `instrument: "synth"` as "name
       nothing, the record's own keeps the part", which is the seam's documented
       empty entry — not a new field and not a new law.

       WHICH CHAIRS. `lineOnly` is the anchor's own answer to exactly this
       question ("the synthesis is the identity of ONE voice, not of the whole
       band" — to-engine.js:1034) and the parent reads it off the chair's ROLE,
       so a lineOnly signature covers the moving chairs and the held ones keep
       the sample the anchor named. Five of the fifteen say it.
       LAYERS ARE NEVER COVERED. A guest brings its line, not its instrument
       (derive.js:123); a vocal layer on an industrial record is a singer, not a
       fuzz box, and the layer loop below still names its own genre's `instr`.
       ...AND NEITHER IS A CHAIR THAT WAS CAST AS A MOUTH. That is not a new
       rule either — it is to-engine.js:1041-1049 verbatim ("a signature synth
       does not displace a chair that was cast as a voice"), which the engine
       enforces by asking `mouthForInstr` BEFORE `wantSynth`. It can only do
       that while the chair still carries the id, so the two tables that name a
       person are read here rather than re-listed: measured, dropping this
       clause took robotic pop's and EBM's talking tract off the record and
       replaced it with a Minimoog doubling the part beside it, which is the
       exact regression that comment was written about. */
    const PAD_PART = { pad: 1, drone: 1, stab: 1 };
    const MOUTHY = (id) => !!(NI.PATCHES.mouth[id] || NI.PATCHES.voice[id]);
    const sigSynth = G.synth && G.synth.dsp ? G.synth : null;
    const signed = (part, id) => !!sigSynth && !MOUTHY(id) &&
      !(sigSynth.lineOnly && PAD_PART[part]);

    for (let v = 0; v < nBase; v++) {
      const kinds = R.song.map((b, i) => baseKind[i](v));
      const home = dflt(kinds);
      const material = { "": home };
      const development = {};
      kinds.forEach((k, i) => {
        if (k && k !== home) material[sid(i)] = k;
        development[sid(i)] = k ? sayOps(R.song[i].ops, k) : "out";
      });
      const part = (G.part && G.part[v]) || G.realize(v);
      voices.push({
        name: nameFor(part === "line" ? "voice" : part),
        kind: "line",
        cast: { part,
                // THE REGISTER IS A GENRE FACT AND A KIND FACT AT ONCE. The
                // anchor says where this music sits; the kind says a riff is
                // under the tune. ideas-kit's own `reg` cannot do it — its
                // phrase writer ignores the field on purpose ("the register is
                // the GENRE's … writing it in both places put every tune an
                // octave higher than it was asked for") — so the octave lands
                // HERE, on the chair, which is the one place the kernel reads
                // it (kernel.js:1387 ctr = 60 + 12 * g.reg(v)).
                reg: Math.max(-4, Math.min(3,
                  G.reg(v) + (REG[(KINDS[home] || {}).reg || row.reg] || REG.mid).v)),
                // ENTRY IS BARS INTO EVERY SECTION HERE, not into the record
                // (ui/derive.js renders each box independently), so an
                // unclamped entry of 3 SILENCES a voice in a two-bar intro.
                entry: Math.max(0, Math.min(G.entry(v) | 0, minBars - 1)) },
        material, development,
        instrument: signed(part, instrOf(gk, v)) ? "synth" : instrOf(gk, v),
      });
    }

    for (const lk of layerKeys) {
      const L = GENRES[lk];
      const kinds = R.song.map((b) => {
        const e = b.stack.slice(1).find((x) => x.g === lk);
        return e && (e.slots || []).length ? KIND_OF[e.slots[0]] : null;
      });
      const home = dflt(kinds);
      const material = { "": home };
      const development = {};
      kinds.forEach((k, i) => {
        if (k && k !== home) material[sid(i)] = k;
        // A LAYER IS SILENT WHERE IT DOES NOT APPEAR, and `out` is the word
        // songs.js documents for exactly that ("a voice can be silent for a
        // section without leaving the record") — which is what makes a guest
        // a guest rather than a second band member.
        development[sid(i)] = k ? sayOps(R.song[i].ops, k) : "out";
      });
      const part = (L.part && L.part[0]) || L.realize(0);
      /* ONE ROOM. `backing` is a guest whose whole instrument is `ahh_choir`,
         and the records it lands on are frequently records that ALREADY have a
         vocal section — merseybeat's "ooh"s, the Beatles' — so the record was
         being given TWO choirs. As a sample that read as a thicker aah; as the
         MODEL it is two independent three-voice sections, 12.2 cost units
         apiece, and it is what took the heaviest records over the parent's
         BUDGET of 40 — measured, doowop 44.40, merseybeat 43.18, beatles
         41.50, all three of them back under it with this rule in place.
         THE RULE IS THE PROJECT'S OWN AND NOT A BUDGET DODGE: "a guest brings
         its line, not its instrument" (ui/derive.js:123), which is measured —
         architecture travels across a genre cross, material does not (instr
         3%). A SECTION is the strongest case of it, because a section is a
         ROOM: two rooms of people singing the same backing part is not a
         bigger choir, it is a phasing artefact with a second reverb on it. So
         a guest cast on a section joins the section the record already has,
         and seats its own only where there is none. */
      let instrument = instrOf(lk, 0);
      if (isSection(instrument)) {
        // WHICH section it joins, where the record has more than one: the one
        // sitting in the same KIND of chair. `plan.js seatFor` keys a seat on
        // the chair as well as the instrument, so a guest that joins the held
        // "ooh"s while singing a counter-line is still a second unit — it is
        // the same people in two rooms again, one line lower down. Doowop
        // seats a section on a stab AND on a riff; the backing guest is a
        // counter-line, so it belongs with the riff, and joining it there is
        // both the musical answer and 12.2 cost units.
        const held = !!PAD_PART[part];
        const rooms = voices.filter((x) => x.kind === "line" && isSection(x.instrument));
        const here = rooms.find((x) => !!PAD_PART[x.cast.part] === held) || rooms[0];
        if (here) instrument = here.instrument;
      }
      voices.push({
        name: nameFor(lk), kind: "line",
        cast: { part,
                reg: Math.max(-4, Math.min(3, (L.reg(0) | 0) + 1)),
                entry: 0 },
        material, development,
        instrument,
      });
    }

    // THE BASS. Present unless the anchor says nobass (18 of 122). Its word
    // per section is compose()'s own `bassop`, which is ALREADY a BASSOPS key
    // — the document's bass vocabulary verbatim, so there is nothing to
    // translate. "" means "the record's own", which is the style below.
    if (!G.nobass) {
      const development = {};
      R.song.forEach((b, i) => { development[sid(i)] = b.bassop || ""; });
      voices.push({ name: nameFor("bass"), kind: "bass",
                    cast: { style: G.bassStyle || "eighths" }, development });
    }
    // THE DRUMMER. Present when the anchor has a grid (97 of 122); its word
    // per section is compose()'s `kit`, already a KITLABEL key.
    if (hasKit) {
      const development = {};
      R.song.forEach((b, i) => { development[sid(i)] = b.kit || ""; });
      voices.push({ name: nameFor("kit"), kind: "drums",
                    cast: { on: true }, material: "beat",
                    instrument: G.drumkit || "acoustic", development });
    }

    /* ---- THE ENGINEER, over the finished cast --------------------------- */
    // Last, and after every chair exists, because a desk is set on a band and
    // not on a plan: `deskThe` counts the second guitar as the second guitar,
    // which it cannot do until the layers and the rhythm section are seated.
    deskThe(voices, G);
    const fx = soundFxOf(G);

    /* ---- the record ----------------------------------------------------- */
    return {
      basis: gk,
      time: {
        bpm: R.bpm, rate: G.rate == null ? 1 : G.rate,
        meter: null,                               // 0 of 122 anchors declare one
        swing: swingOf(R, G),
        // setGroove has existed in ui/state.js:190 since the day it was
        // written and has never once been called; the groove is a SONG fact
        // (AXES.md: "a record swings or it does not").
        //
        // IT IS NOT `R.groove` ANY MORE. compose() draws one off the shared
        // record stream at a fixed position, which handed the same word to all
        // 97 anchors that have a kit — `funk` at seed 1, `dub` at seed 2
        // (measured, STATE.md item 18: "a bossa and a boom-bap are handed the
        // same groove word"). `grooveOf` reads the anchor's own drum grid, its
        // swing ratio, its stress and its touch instead; § 7 has the ladder and
        // the reason for each rung. The old line is rewritten rather than
        // deleted because "compose draws exactly one for the whole record" is
        // still true and was never the bug.
        ...(grooveOf(G) ? { groove: grooveOf(G) } : {}),
      },
      alphabet: {
        key: R.song[0].key,                        // compose.js:1849 S.tonic
        mode: modeName(gk, G),
        // THE SUBJECT'S OWN ALPHABET, at last. ui/eight.js:98 writes
        // `scale: mode` unconditionally, so no document could be pentatonic or
        // blues however loudly its anchor said so — 99 of 122 declare one.
        ...(scale ? { scale } : {}),
        diatonic: !!G.diatonic,                    // absence IS the value (genres.js:5675)
        harmony: G.harmony,
        prog: progOf(G),
      },
      material: { cells },
      form: { sections },
      voices,
      sound: {
        level: 1,
        ...(G.synth ? { synth: G.synth } : {}),
        // THE RECORD IS MASTERED, and by the same compose() call that wrote
        // it: `masterOf` (compose.js:1537) draws the drive/glue/tilt/ceiling
        // on its own genre-salted stream — already a fields.js MASTER value,
        // verbatim, which is why there is nothing to convert here.
        ...(R.master && Object.keys(R.master).length ? { master: R.master } : {}),
        // ...AND IT IS MIXED. The bus block, the returns and the per-voice
        // board are § 7 above; the sentence that used to stand here said this
        // file "writes none of them — one owner per fact", and it was wrong by
        // 122 records (STATE.md item 17). A BUSES value, verbatim.
        buses: busesOf(G),
        // the record-wide character chip: the anchor's own `fx`, minus the
        // echo, which is a BUS on this desk and not an insert
        ...(fx.length ? { fx } : {}),
      },
      performance: { take: 0, humanize: G.humanize || 0, ontime: true },
    };
  }

  assertDeskTables();          // after § 7's rows exist, for the reason above

  return { genreToDocument, anchors, idiomOf, cellBarsOf, cellOf, CELL_BAR_CEILING,
           IDIOM, IDIOM_ANCHOR, KINDS, KIND_OF, SAY, HOLDCAP, capOf, progOf,
           // § 7, exported so the gate measures THE CHOOSER rather than a
           // second copy of it — the same law `idiomOf` is exported under
           grooveOf, busesOf, soundFxOf, kitFacts, retOf, ROOM, ECHOSEND };
});
