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
    // THE ROW IS NOT A STROPHE (2026-08-29, the handoff the classical round
    // could not make itself — precompose.js was outside its fence, so it put
    // `serial` in `roots` as the least-wrong family and wrote the values it
    // wanted into its report). `roots` deals `aabb`, and a four-bar strophe
    // that says its first phrase twice is the one shape a twelve-tone row
    // forbids: the whole method is that no pitch returns until the other
    // eleven have been. So `vary` — never the same sentence twice — and
    // `zig`, because Schoenberg op. 25's row turns back on itself rather than
    // rising or falling. `even` states it as an unaccented series of equals,
    // which is what a row is before a rhythm is imposed on it.
    // WHAT THIS STILL CANNOT SAY, and the row's own `cannot` says it too: the
    // aggregate rule. The box plays P/I/R/RI but nothing counts which pitches
    // have been used, so a "row" here is a shape, not an accounting.
    serial:    { cell: "even",   contour: "zig",    sent: "vary",  len: "two" },
    // THE 2026-08-29 GENEALOGY ROUND'S HANDOFF, WRITTEN BY THE PARENT — the
    // catalogue lane added 32 anchors with this file outside its fence and
    // reported, for each row whose family idiom would lie about it, the row it
    // wanted. Same law as every entry above: the family is the default, an
    // anchor is named here only when the family's own cell/contour/sentence is
    // actively WRONG for the music the row argues from.
    // — the strophes and the blues line —
    ballad:    { cell: "three",  contour: "arch",   sent: "aabb",  len: "four" },
    spirituals:{ contour: "arch", land: "third",    sent: "aabb" },
    deltablues:{ cell: "hang",   contour: "fall",   land: "lead" },
    boogiewoogie:{ cell: "riff", contour: "zig",    land: "root",  len: "two" },
    neworleans:{ cell: "gallop", contour: "arch",   land: "third", sent: "vary" },
    // — the long lines —
    cemilbey:  { cell: "long",   contour: "rise",   sent: "vary",  len: "four" },
    gagaku:    { cell: "long",   contour: "hold",   sent: "long",  len: "four" },
    gothicrock:{ cell: "long",   contour: "hover",  sent: "long",  len: "four" },
    dubstep:   { cell: "long",   contour: "hover",  reg: "low", sent: "long", len: "four" },
    // — the motorik and sequencer rows —
    krautrock: { cell: "even",   contour: "hover",  sent: "plain" },
    berlinschool:{ cell: "even", contour: "zig",    sent: "plain", len: "two" },
    moroder:   { cell: "even",   contour: "zig",    sent: "plain", len: "two" },
    hardcorerave:{ cell: "even", contour: "zig",    sent: "plain", len: "two" },
    // — the riff-and-808 rows —
    miamibass: { cell: "riff",   contour: "insist", reg: "low",    len: "two" },
    grime:     { cell: "riff",   contour: "zig",    reg: "low",    len: "two" },
    gfunk:     { cell: "riff",   contour: "zig",    land: "seventh", len: "two" },
    crunk:     { cell: "even",   contour: "insist", land: "root",  len: "two" },
    // THE DEBTS ROUND'S HANDOFF (2026-08-29, second shift, 245 -> 282), written
    // by the parent as before. Twenty-six rows where the family idiom
    // measurably lies about the music the row argues from; the other eleven of
    // the round's thirty-seven take their family rows deliberately.
    // — early polyphony and the concerted line —
    josquin:   { cell: "walkup", contour: "rise",   sent: "vary" },
    monteverdi:{ cell: "pickup", contour: "arch",   land: "third", sent: "vary" },
    schutz:    { cell: "three",  contour: "arch",   sent: "vary",  len: "four" },
    mawsili:   { cell: "three",  contour: "fall",   sent: "vary",  len: "four" },
    // — the long unaccompanied line and its refusals —
    holler:    { cell: "hang",   contour: "fall",   land: "lead", sent: "long", len: "four" },
    satie:     { cell: "long",   contour: "hover",  sent: "plain", len: "four" },
    march:     { cell: "even",   contour: "rise",   land: "root",  len: "two" },
    modaljazz: { cell: "long",   contour: "hover",  land: "seventh", sent: "long", len: "four" },
    // — the band rooms —
    garagerock:{ cell: "riff",   contour: "insist", land: "root" },
    beachboys: { contour: "arch", land: "third",    sent: "vary" },
    psychrock: { cell: "long",   contour: "zig",    sent: "vary",  len: "four" },
    velvets:   { cell: "even",   contour: "hover",  sent: "plain" },
    stockhausen:{ cell: "three", contour: "zig",    sent: "vary",  len: "two" },
    winstons:  { cell: "riff",   contour: "insist", land: "root" },
    progrock:  { cell: "walkup", contour: "rise",   sent: "vary",  len: "four" },
    sabbath:   { cell: "riff",   contour: "hold",   land: "root", reg: "low", len: "two" },
    blockparty:{ cell: "riff",   contour: "insist", land: "root",  len: "two" },
    pfunk:     { cell: "riff",   contour: "zig",    land: "root",  reg: "low" },
    ymo:       { cell: "even",   contour: "zig",    sent: "plain" },
    nwobhm:    { cell: "riff",   contour: "rise",   land: "root",  len: "two" },
    thrash:    { cell: "even",   contour: "insist", reg: "low",    len: "two" },
    // — the slow floors —
    triphop:   { cell: "long",   contour: "fall",   sent: "long",  len: "four" },
    chopped:   { cell: "long",   contour: "hover",  reg: "low", sent: "long", len: "four" },
    synthwave: { cell: "riff",   contour: "hover",  reg: "low",    len: "two" },
    footwork:  { cell: "even",   contour: "insist", reg: "low",    len: "two" },
    gqom:      { cell: "long",   contour: "hover",  reg: "low",    sent: "long" },
    // THE DEEP-TIME HANDOFF (2026-08-30, 282 -> 297): eight rows before the
    // year one and seven forward debts, written by the parent as before.
    // Antiquity first — the arguments are the artifacts':
    hohlefels: { cell: "long",   contour: "hover",  sent: "long",  len: "four" },
    jiahu:     { cell: "three",  contour: "arch",   sent: "vary",  len: "four" },
    urlyre:    { cell: "three",  contour: "fall",   land: "root",  sent: "vary" },
    hurrian:   { cell: "long",   contour: "fall",   land: "root", sent: "vary", len: "four" },
    delphic:   { cell: "three",  contour: "arch",   sent: "vary",  len: "four" },
    carmen:    { cell: "three",  contour: "fall",   sent: "vary",  len: "four" },
    seikilos:  { cell: "pickup", contour: "arch",   land: "third", sent: "hold", len: "two" },
    oxyrhynchus:{ cell: "three", contour: "fall",   sent: "plain", len: "four" },
    // — and the forward seven —
    hardcore:  { cell: "even",   contour: "insist", land: "root",  len: "two" },
    honkytonk: { cell: "pickup", contour: "fall",   land: "third", sent: "vary" },
    westernswing:{ cell: "gallop", contour: "arch", land: "fifth", sent: "vary" },
    dreampop:  { cell: "long",   contour: "hover",  sent: "long",  len: "four" },
    doom:      { cell: "long",   contour: "hold",   reg: "low",    len: "four" },
    jpop:      { cell: "pickup", contour: "arch",   land: "third", sent: "vary", len: "four" },
    dunstaple: { cell: "three",  contour: "rise",   land: "third", sent: "vary" },
    // THE GOTH-AND-GLOBE HANDOFF (2026-08-30, 297 -> 313), parent-written.
    // Four rows where the family lies; the other twelve take their families.
    gypsyjazz: { cell: "gallop", contour: "zig",    land: "third", len: "two" },
    nordicjazz:{ cell: "long",   contour: "hover",  sent: "long",  len: "four" },
    witchhouse:{ cell: "long",   contour: "hover",  reg: "low" },
    japanjazz: { cell: "hang",   contour: "fall",   land: "lead" },
    // THE DOWNTEMPO HANDOFF (2026-08-30, 313 -> 325), parent-written. Nine
    // overrides; air, royksopp and thieverycorporation take their family
    // rows honestly. Portishead's pickup-into-torch-song is NOT triphop's
    // drift, and massiveattack's two-note grudge is not either — the two
    // Bristol rows differ from the genre row the way the records do.
    portishead:{ cell: "pickup", contour: "fall",   land: "third", sent: "hold", len: "four" },
    massiveattack:{ cell: "riff", contour: "insist", reg: "low",   len: "two" },
    tricky:    { cell: "long",   contour: "hover",  sent: "vary",  len: "four" },
    morcheeba: { cell: "pickup", contour: "arch",   land: "third", len: "four" },
    lamb:      { cell: "long",   contour: "arch",   sent: "vary",  len: "four" },
    djshadow:  { cell: "even",   contour: "hover",  reg: "low", sent: "plain", len: "four" },
    kruderdorfmeister:{ cell: "long", contour: "hover", sent: "long", len: "four" },
    stgermain: { cell: "gallop", contour: "fall",   land: "seventh", sent: "vary" },
    acidjazz:  { cell: "riff",   contour: "zig",    land: "root",  len: "two" },
    // THE DARK-ROOMS HANDOFF (2026-08-30): trap had NO row and fell to club's
    // {push, vary, hover, fifth} — the "sounds melodic" wander Paul heard; it
    // takes miamibass/dancehall's own shape. And a guaguanco is an ostinato,
    // not roots' aabb strophe.
    trap:      { cell: "riff",   contour: "insist", reg: "low", land: "root", len: "two" },
    rumba:     { cell: "riff",   contour: "zig",    sent: "plain", len: "two" },
    // THE HEARTH-AND-SCREEN HANDOFF (2026-08-30, 325 -> 350), parent-written.
    // Fourteen overrides; the other eleven of the round's twenty-five take
    // their family rows honestly (measured: none froze at the family idiom).
    mbuti:     { cell: "even",   contour: "zig",    sent: "plain", len: "two" },
    shanty:    { cell: "three",  contour: "arch",   sent: "aabb",  len: "two" },
    seannos:   { cell: "long",   contour: "arch",   sent: "vary",  len: "four" },
    miamivice: { cell: "long",   contour: "arch",   sent: "hold",  len: "four" },
    carpenter: { cell: "even",   contour: "insist", reg: "low",    len: "two" },
    herrmann:  { cell: "even",   contour: "insist", land: "root",  len: "two" },
    korngold:  { cell: "walkup", contour: "rise",   sent: "vary",  len: "four" },
    morricone: { cell: "hang",   contour: "arch",   land: "fifth" },
    barry:     { cell: "riff",   contour: "zig",    reg: "low",    len: "two" },
    flamenco:  { cell: "hang",   contour: "fall",   sent: "vary" },
    klezmer:   { cell: "gallop", contour: "zig",    len: "two" },
    taraf:     { cell: "gallop", contour: "zig",    len: "two" },
    georgian:  { cell: "three",  contour: "arch",   sent: "aabb" },
    nursery:   { cell: "three",  contour: "arch",   sent: "vary" },
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
    /* 9, machines only — SIXTEENTHS and a BROKEN CHORD since 2026-08-31, and
       both halves were needed. The cell was `even` (eighths), which made every
       sequencer in the catalogue play at half the speed a sequencer plays; and
       the contour was `zig`, which walks by steps. Fixing only the first got a
       bar of sixteen notes that read `GAGB AcBG AGBA cBGG` — Paul: "There are
       eighth-note runs with Young Galaxy but no 16th note arps." A run at any
       speed is still a run. `arp` climbs the chord (see ideas-kit CONTOURS),
       and I was wrong to keep `zig` "because a 303 turns back on itself": it
       does, but it turns back through the CHORD, which is what makes it an
       arpeggio and not a scale. */
    seq:       { cell: "sixteenths", contour: "arp", reg: "low", sent: "plain" },
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
      ["ECHONAME",   () => ECHONAME,   () => NF.BUSNAMES],
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
  // `rd` (2026-08-27) is THIS READING's words for this kind — §6b's draw, or
  // null on reading 1, which is the day before it existed. It lands LAST so a
  // reading may only move an axis §6b already decided it may move: the anchor's
  // own row and the kind's are merged in ahead of it and §6b never puts one of
  // theirs in the map.
  // `dv` (2026-08-28) is THIS RECORD'S DEVELOPMENT for this cell — §6c's deal,
  // or null, which is every reading before it existed. Two fields, and they act
  // at two different moments: `dev` names a DEVICE applied to the rendered
  // phrase (so the figure that gets measured out into `play` is already the
  // developed one), and `rel` names the RELEASE, which is length arithmetic and
  // therefore belongs at the bottom of this function beside the cap.
  function cellOf(row, kind, cb, G, steps, rd, dv) {
    /* A ROW MAY NAME ITS OWN ARPEGGIO (2026-08-31). `seqArp` on the anchor
       overrides the sequencer part's contour and nothing else — the part still
       owns its cell, its register and its sentence, because those are what
       make it a sequencer rather than a tune. This is the narrowest possible
       seam for Paul's "different arp things": one word, on the anchor, saying
       which way ITS machine runs. Absent, every record takes the updown `arp`
       it had before this line, byte for byte. `rd` still wins, because a
       reading is more specific than an anchor. */
    /* `seqReg` WAS TRIED HERE AND DELETED THE SAME HOUR (2026-08-31), and the
       note is kept so nobody adds it again. Paul: "The mix is muddy", and
       KINDS.seq says `reg: "low"` — right for a 303, wrong for the figure his
       New Summer tab shows at the ninth and twelfth frets. So I let the row
       state the arpeggio's register here, measured the staff, and the notes had
       not moved one step: `GBdg dBGB` before and after. test/hook.test.js says
       why in its own words — "a stated `len`, `sent` or `reg` cannot reach a
       one-bar cell" — and CELL_BAR_CEILING is 1. It was a knob that could not
       reach the sound, which is the one thing this repo will not ship. The
       register lives on the CHAIR, so the row moves it there instead. */
    const arpOf = (kind === "seq" && G && G.seqArp) ? { contour: G.seqArp } : null;
    const m = { ...Id.blank(), ...row, ...KINDS[kind], ...(arpOf || {}), ...(rd || {}),
                len: cb === 4 ? "four" : cb === 2 ? "two" : "one", answer: true };
    let ph = Id.toPhrase(m, null);                // ideas-kit.js:425, pure, cached
    // THE DEVICE LANDS ON THE PHRASE, NOT ON THE THEME. `Id.develop` is pure
    // and returns the phrase object itself for `same`, so a cell nobody
    // developed takes no branch and comes out byte-identical.
    if (dv && dv.dev) ph = Id.develop(ph, dv.dev);
    const n = cb * steps, cap = capOf(G);
    const deg = ph.deg.slice(0, n), vel = ph.vel.slice(0, n);
    const play = new Array(n).fill("r"), acc = new Array(n).fill(0);
    const on = [];
    for (let i = 0; i < n; i++) if (ph.gate[i]) on.push(i);
    // A WRITTEN LENGTH BEATS NOTHING HERE. ideas-kit's own `hold` is the
    // sentence's tie across a barline; the gap to the next onset is the
    // default; and the anchor's articulation caps both, which is the only
    // way a `legato` chant and a `staccato` punk hook come out of the same
    // contour as two different rows of "play".
    const L = on.map((i, j) => {
      const next = j + 1 < on.length ? on[j + 1] : n;
      return Math.max(1, Math.min(ph.hold && ph.hold[i] ? ph.hold[i] : next - i,
                                  cap, next - i));
    });
    // THE RELEASE (§6c). The last onset's `next` is the END OF THE CELL, so
    // until today the last note of every figure ran to the bar line and 84.7%
    // of the catalogue's 4,915 cells ended on their longest note. `ring` is
    // that law, unchanged and still the commonest draw — a hymn lands long.
    // `clip` and `lean` are the two ways a figure ends SHORT, measured against
    // the figure's own notes rather than against a constant: `clip` is no
    // longer than the shortest note before it (the bar ends in silence),
    // `lean` is one step and gone (it leans into what comes next).
    // A figure of one note has no "notes before it" and keeps its ring.
    if (dv && dv.rel && dv.rel !== "ring" && on.length > 1) {
      const pulse = Math.max(1, Math.min(...L.slice(0, -1)));
      const want = RELEASE[dv.rel].last(pulse);
      L[L.length - 1] = Math.max(1, Math.min(L[L.length - 1], want));
    }
    on.forEach((i, j) => {
      play[i] = "n";
      for (let k = 1; k < L[j]; k++) play[i + k] = "h";
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
     6b · A READING VARIES THE TUNE — the stream above, spent (2026-08-27)
     ======================================================================
     Paul, listening on staging: *"No matter how many times I hit REWRITE the
     hook is the same on Iranian pop."*

     HE IS RIGHT, AND IT IS NOT AN IRANIAN POP BUG. Measured before a line of
     this was written, over all 199 anchors x 8 seeds — 1,910 cell instances:
     NOT ONE CELL EVER CHANGED CONTENT WITH THE SEED. `cellOf(row, kind, cb, G,
     steps)` never took one: `row` is `idiomOf(gk)`, which reads the anchor and
     nothing else; `cb` is pinned to 1 by CELL_BAR_CEILING; `steps` is 16 on
     every anchor in the catalog; and `Id.toPhrase(m, null)` is pure and
     memoised. What LOOKED like variation — `riff` moving on 118 anchors,
     `climb` on 59 — was a cell being PRESENT at one seed and ABSENT at
     another, because compose() deals different slots; `pad`, `topline` and
     `beat` never moved at all, and the HOOK was byte-identical across five
     seeds on 193 of the 199. The rewrite button could not change a tune on any
     genre in the box. Iranian pop is only where it was noticed.

     THE COMMENT DIRECTLY ABOVE THIS ONE IS THE TOMBSTONE, and it is rewritten
     rather than deleted because it named its own end condition: "Its OWN
     stream is declared here and — in today's design — UNCONSUMED, because
     every field above is a table lookup and there is no genuine choice left to
     make. Declaring it now means the first idiom variation somebody adds later
     does not shift a bar line." This is that variation, arriving at that door.
     The stream is spent HERE and nowhere else, so nothing compose() draws
     moves, and a reading changes the tune without shifting a bar line.

     WHAT A READING MAY MOVE, AND WHAT IT MAY NOT. A second reading of a genre
     must still be that genre, so the axes divide by WHO STATED THEM:

       · an axis stated by `KINDS[kind]` is the PART's job — a pad holds, a
         riff zigs, a climb walks up to the fifth — PINNED, always, or the
         slots stop being different parts.
       · an axis stated by `IDIOM_ANCHOR[gk]` is that anchor saying what ITS
         music is ("a drone is a drone", "punk's hook is three notes and a
         shout"). 54 of the 199 anchors carry such a row, and what that row
         binds differs by axis — the table below is where that is decided and
         argued, per word, because the three words are not the same size of
         claim.
       · everything else came from the FAMILY row, which is a default and not
         a claim, and a reading may draw it again from the whole table.

     THE FIRST CUT OF THIS BLOCK MOVED CONTOUR AND LANDING ONLY, and it was
     measured insufficient before it was ever pressed: over 191 anchors x 8
     seeds, 0 of 191 changed the hook's RHYTHM, because the play row is a
     function of the CELL and the articulation cap and of nothing else. Paul's
     Iranian pop hook landed three notes at steps 7, 8 and 12 in all ten
     readings, starting on the tonic in nine of them, in one key. An ear calls
     that the same hook, and it is right. So `cell` opens too — inside a band,
     which is the paragraph below — and the KEY opens, which is the paragraph
     after that.

     READING 1 IS TODAY, BYTE FOR BYTE. The atlas opens every anchor at seed 1
     (ui/atlas.js `let seed = 1`), so the record a hand lands on is the record
     it has always been; only pressing REWRITE moves. Measured after: seed 1
     over all 199 anchors is byte-identical to seed 1 before this block
     existed, document by serialized document. */
  /* ---------- what a reading may say, per axis --------------------------- */
  // AND ONLY THE THREE AXES THAT REACH THE CELL. Measured, not chosen: at
  // CELL_BAR_CEILING = 1 a cell is ONE BAR, and of the idiom's six words only
  // three can move a note of it.
  //   · `len` — cellOf OVERWRITES it (`len: cb === 4 ? "four" : …`), so a
  //     reading that drew it would be drawing into a value that is thrown
  //     away one line later.
  //   · `sent` — ideas-kit SENTENCES carry rows for 2, 4 and 8 bars and none
  //     for 1 (:173), so at one bar every sentence plan is `plain` and the
  //     word says nothing.
  //   · `reg` — phraseNow answers it in `ph.oct`, and cellOf reads `ph.deg`,
  //     `ph.vel`, `ph.gate` and `ph.hold` and NOT `ph.oct`: the octave does
  //     not cross into the document cell at all.
  // A reading that moved those three would print three different words on a
  // record that sounded identical, which is the lie this file exists to not
  // tell. They open the day a cell is longer than a bar, and the ceiling is
  // the one constant that says so.
  //
  // WHO PINS WHAT, per axis — and the anchor and the KIND are not the same
  // size of claim:
  //   · a KIND'S word pins EVERY axis, always, or the slots stop being
  //     different parts.
  //   · "pin" — the anchor's word is the whole claim and a reading keeps it.
  //     THE GESTURE (`contour`) is what a row means when it says "a drone is
  //     a drone" or "punk's hook is three notes and a shout".
  //   · "open" — the anchor's word is a preference, not a claim. THE LANDING
  //     is the note the line comes to rest on, and a bop head that resolves
  //     to the root instead of leaning on the seventh is still a bop head.
  //   · "band" — the anchor's word claims something BROADER than itself and
  //     a reading may say anything inside that claim. THE FIGURE (`cell`) is
  //     the one axis where this is true, and the argument is the 51 anchor
  //     rows themselves: read back one at a time they claim a DENSITY, never
  //     a serial number — "the 303 is a sixteenth-note machine", "dub is one
  //     long idea with holes in it", "a punk hook is three notes and a
  //     shout", "a mambo is a short figure said again, hard", "a choro is a
  //     composed tune that runs". `even`, `riff` and `gallop` all satisfy the
  //     machine; `three` and `call` all satisfy the shout. What no reading of
  //     acid may do is go quiet, and that is exactly what the band forbids.
  //     A BAND OF ONE IS A PIN, and `long` is alone in its band on purpose:
  //     drone, ambient, dub, arabesk and enka say the same thing about
  //     themselves — one long note with holes in it — and there is no second
  //     way to say it. Those five keep one hook rhythm at every reading and
  //     move on contour, landing and key; the other 194 move the figure too.
  const VARIES = { cell: "band", contour: "pin", land: "open" };

  // THE BAND IS DERIVED FROM THE CELL'S OWN GRID, never typed here: how many
  // notes the figure puts in a bar. A retuned CELLS row reclassifies itself
  // and a renamed one still dies in assertTables() above.
  //   held    long                    (2 onsets — space)
  //   short   three · pickup · call   (3 — a short figure)
  //   moving  push · walkup · hang    (4-5 — a figure that goes)
  //   running gallop · riff · even    (6+ — a machine)
  const onsetsOf = (name) => Id.CELLS[name].g.filter((v) => v === 1).length;
  const bandOf = (name) => { const n = onsetsOf(name);
    return n <= 2 ? "held" : n <= 3 ? "short" : n <= 5 ? "moving" : "running"; };
  const CELLBAND = {};
  for (const name of Object.keys(Id.CELLS))
    (CELLBAND[bandOf(name)] = CELLBAND[bandOf(name)] || []).push(name);

  // ...AND THE SAME LOAD-TIME LAW THE TABLES ABOVE KEEP. A VARIES key that
  // names no idiom field, or a law word with a typo in it, must die HERE and
  // BY NAME: `pin` misspelled falls through to the pin branch, which is the
  // silent-default failure this file's whole assertTables() exists to make
  // impossible — a reading that had quietly stopped moving an axis would look
  // exactly like the bug it was written to fix.
  const LAWS = { pin: 1, open: 1, band: 1 };
  for (const [f, law] of Object.entries(VARIES)) {
    if (!FIELDTABLE[f]) throw new Error(`precompose: VARIES names no such field "${f}"`);
    if (!LAWS[law]) throw new Error(`precompose: VARIES.${f} = "${law}" is not pin|open|band`);
    if (law === "band" && f !== "cell")
      throw new Error(`precompose: VARIES.${f} asks for a band and only \`cell\` has one`);
  }

  // THE READING'S KEY (2026-08-27). The second frozen axis, and the argument
  // for moving it is compose.js:1988's own: "genres.js declares no tonic —
  // every anchor is written in scale DEGREES, so there is nothing to read off
  // it — and until now that meant every composed record landed on the same
  // unlabelled pitch class." The key is DERIVED, `ihash(gk + "/key") % 12 - 6`,
  // which makes it a fact about the genre's NAME and nothing else. A pitch
  // class is not a genre fact — no anchor in the catalog states one — so
  // there is no claim here for a reading to break, and same key + same rhythm
  // + same contour is most of why "the same" was the honest word for iranpop.
  //
  // SMALL, THOUGH, AND THAT PART IS A REAL FACT. A genre's tessitura is where
  // its music sits and singers have ranges: a reading may take it up or down
  // a step or two, the way a band does when the singer asks, and may not move
  // it to the other side of the octave — at ±6 the box would be transposing
  // for the sake of sounding different, which nobody in the room asked for.
  // Zero stays in the hat: a second reading is allowed to come back in the
  // same key, and it does about one time in five.
  //
  // It is spent on the SAME stream, LAST, after every cell draw — so adding
  // or retiring it cannot renumber a single cell's draw, which is the whole
  // reason the draws above run over KIND_OF and not over the record's slots.
  const KEYSHIFT = [-2, -1, 0, 1, 2];

  /* ---------- A KIND'S FIGURE IS A DENSITY TOO (2026-08-27) --------------
     Paul, on staging, one day after the block above shipped: *"I clicked
     rewrite multiple times and never saw a different seed, and the 'topline'
     is the same as always for tehran 1974."* He is right, and the sentence
     above — "a KIND'S word pins EVERY axis, always" — is the reason. Measured,
     iranpop over eight readings, DISTINCT RHYTHMS per slot:

       hook 7   answer 6   verseline 4   |   riff 1  counter 1  pad 1
                                             topline 1  sparse 1  climb 1

     The three that move are exactly the three kinds that state no `cell`
     (KINDS.hook = {}, and answer and verseline state only a gesture and a
     landing). The other six state one, `cell` is the only axis that reaches
     the play row, so their rhythm was decided once in KINDS and no reading
     could touch it. A topline that changes one degree in four presses is what
     an ear calls the same topline, and it is the same complaint hook.test.js
     was written for, one slot to the left.

     SO A KIND'S `cell` IS BANDED, THE WAY AN ANCHOR'S IS — AND WIDER. The
     argument for banding an anchor's word is that the row claims a DENSITY and
     not a serial number, and a kind's word makes the smaller claim of the two:
     `topline: "pickup"` is not "a topline is a pickup figure", it is a DEFAULT
     for a part whose identity is stated on the axis beside it. WHAT MAKES A
     PART A PART HERE IS ITS CONTOUR — a pad HOLDS, a counter DROPS, an answer
     RISES, a topline ARCHES — and every one of those stays pinned, so the
     slots stay different parts under every reading. The figure underneath the
     gesture may move to a NEIGHBOURING density: a pad that puts three long
     notes in the bar instead of two is still a pad; one running eighths is
     not, and the neighbourhood is exactly what forbids it.

     AN ANCHOR THAT STATES A CELL KEEPS ITS PIN. Where the anchor speaks too,
     the neighbourhood is NARROWED to the anchor's own band — drone's pad comes
     back `long` at every reading, because "a drone is a drone" is a claim
     about this music and the kind's word is a default. Where the two do not
     overlap at all (a `counter`'s running figure inside drone's held band) the
     anchor is not talking about this slot: widening a counter to a drone's
     density would delete the part, so the kind's neighbourhood stands and the
     anchor's claim reaches the slots it can actually speak for.

     THE DRAWS DO NOT MOVE. Same stream, same one draw per (kind, axis), same
     order: a wider pool changes WHICH word a draw names, never how many draws
     a reading spends, so reading 1 is still byte-identical and every seed is
     still a pure function of (gk, seed).

     MEASURED AFTER, the same eight readings of iranpop, distinct rhythms:

       hook 7   answer 6   riff 4   counter 6   pad 3
       topline 5   sparse 4   climb 5   verseline 4

     and over the whole catalog, 1610 (anchor, slot) pairs dealt in at least
     six of the eight readings: 97.5% show three rhythms or more, 22 are
     pinned by an anchor row and say so. test/hook.test.js §6 is that table,
     asserted — the floor for iranpop, the fraction for the catalog. */
  const BANDS = ["held", "short", "moving", "running"];
  const NEARBAND = {};
  BANDS.forEach((b, i) => {
    NEARBAND[b] = BANDS.slice(Math.max(0, i - 1), i + 2)
      .reduce((a, x) => a.concat(CELLBAND[x] || []), []);
  });

  // WHAT THIS KIND, IN THIS GENRE, MAY SAY ON THIS AXIS — the three cases in
  // one place, so they are read side by side instead of inferred from a chain.
  // A POOL OF ONE IS A PIN and the caller needs no other test for one.
  function poolFor(f, law, kind, own) {
    if (kind[f] != null)                            // the PART stated it
      return f === "cell" ? nearPool(kind[f], own[f]) : [kind[f]];
    if (own[f] == null || law === "open") return Object.keys(FIELDTABLE[f]);
    return law === "band" ? CELLBAND[bandOf(own[f])] : [own[f]];   // "pin"
  }
  // the kind's own band and the bands either side of it, narrowed to the
  // anchor's band where the anchor states one and the two overlap.
  // THE WORD AS WRITTEN IS ALWAYS IN THE HAT, first: reading 1 plays the
  // kind's own figure (punk's climb walks up, whatever punk says about its own
  // density), and a pool that could not draw that word again would be a box
  // that can never come back to the record it opened on — the same argument
  // KEYSHIFT makes when it keeps zero.
  function nearPool(kindCell, ownCell) {
    const near = NEARBAND[bandOf(kindCell)];
    if (ownCell == null) return near;
    const inside = near.filter((c) => bandOf(c) === bandOf(ownCell));
    return inside.length ? [kindCell].concat(inside.filter((c) => c !== kindCell)) : near;
  }

  function reading(gk, seed, kinds) {
    // reading 1 = the idiom as written: no draw, no shift, byte-identical
    if (seed <= 1) return null;
    const r = idiomStream(gk, seed);
    const own = IDIOM_ANCHOR[gk] || {};
    const cells = {};
    // ONE DRAW PER (KIND, AXIS), IN KIND_OF ORDER, whether or not the axis is
    // pinned and whether or not the record deals that slot — so a record that
    // gains a slot at a later seed does not renumber the draws of the slots
    // beside it, and a pinned axis costs the same draw an open one does. A
    // spent-and-discarded draw is the discipline compose.js keeps for its own
    // per-voice streams.
    for (const k of KIND_OF) {
      const kind = KINDS[k] || {};
      const per = {};
      for (const [f, law] of Object.entries(VARIES)) {
        const u = r();                              // ALWAYS, pinned or not
        const pool = poolFor(f, law, kind, own);    // what it may say here
        const pick = pool[Math.floor(u * pool.length) % pool.length];
        // a pool of one is a pin: writing it back would be the same value
        // with a draw's name on it
        if (pool.length > 1) per[f] = pick;
      }
      if (Object.keys(per).length && kinds.has(k)) cells[k] = per;
    }
    const key = KEYSHIFT[Math.floor(r() * KEYSHIFT.length) % KEYSHIFT.length];
    return { cells: Object.keys(cells).length ? cells : null, key };
  }

  /* ======================================================================
     6c · THE DEVELOPMENT DEAL — what happens to a figure over a record
     ======================================================================
     Paul, 2026-08-28, listening across the catalogue: *"So many songs have a
     do-do-doooo motif across genres, it shows up everywhere."*

     MEASURED FIRST, 201 anchors x seeds 1..3 = 603 records, 4,915 line cells,
     read off the RENDERED `play` rows and not off the declared words:

       notes per phrase   3:33.9%  4:18.0%  6:16.1%  2:16.0%  8:10.5%  5:5.5%
       ends on its longest note (ties included)                        84.7%
       three notes whose last is the longest                           33.9%
       DISTINCT RHYTHMS THE HOOK TAKES ACROSS ONE RECORD          1.00, 588/588

     The last line is the real one, and the first two are its symptoms. TWO
     defects, one deal, because they are two halves of the same missing axis:

     (A) THE MECHANICAL ENDING. `cellOf`'s last onset has no next onset, so its
         length is the whole rest of the bar, capped by the anchor's
         articulation and by nothing else. 84.7% is therefore not a style, it
         is the arithmetic: every figure in the box ends by ringing out. A real
         tune also stops short, on a rest, or leans into the next phrase. The
         fix is a RELEASE word at the one place a note gets its length — and
         NOT a ban on long endings, because a hymn should still land long,
         which is why the coin is weighted by the anchor's own `artic`:
         a legato anchor rings about two times in three, a normal one under a
         half. `ring` is today's law, unchanged, and still the single
         commonest draw in the catalogue.

     (B) THE HOOK NEVER DEVELOPS. `material.cells` is keyed by PART and
         `form.sections[]` names no cell, so the hook had ONE figure for the
         whole record — every verse, every chorus, eleven sections, the same
         bar. This deals a DEVICE (ideas-kit `DEVELOP`, seven rhythm-only
         devices) for each RETURN of each part, renders it as its own cell, and
         points that section's material at it. The mechanism underneath was
         already built and unused: `voice.material` has been a
         `{ "<secId>": "<cell>" }` map since document.js:78, and precompose has
         been writing that map for the KIND rotation all along — this writes
         the same map with the same part's own developed figure in it.

     THE STATEMENT IS NEVER DEVELOPED. The FIRST section a part sounds in is
     the part as written: you cannot develop what has not been said yet, and a
     record whose hook is varied before it is stated has no hook.

     ONE STREAM, ITS OWN, GENRE-SALTED — `rng(ihash(gk + "/develop/" + seed))`,
     the idiom compose.js `formOf` uses and this file's §6b uses, so a retuned
     development cannot move a bar line, a guest, a key or a drum. Coins are
     drawn in a FIXED ORDER and drawn UNCONDITIONALLY — every kind's release,
     then every (kind, section) pair whether or not that kind sounds there — so
     adding a device later renumbers nothing, and a record that gains a section
     at a later seed does not renumber the sections beside it. That is §6b's
     spent-and-discarded discipline, verbatim.

     READING 1 IS TODAY, BYTE FOR BYTE. `developOf` returns before it draws
     anything at seed <= 1, exactly as `reading` and `formOf` do; measured
     after, all 201 anchors at seed 1 serialize identically to the day before
     this block existed.

     A GENRE KEEPS ITS IDENTITY, and it is checked rather than asserted. Three
     fences, all of them read off tables this file already keeps:
       · the DECLARED cell is untouched — dub still reads `long`, punk `even`,
         techno `even`. A device varies a figure; it never swaps it.
       · every device is RHYTHM-ONLY (ideas-kit DEVELOP's own fence), so the
         contour and the landing that make a part a part survive it.
       · the developed figure must land within ONE BAND of the statement's
         density (`bandOf`, §6b's own table) and must still be a figure at all
         — two onsets or more, and actually different from the statement.
         Anything else falls back to the statement, which is always playable.
         This is `nearPool`'s law applied to the same figure over time instead
         of across readings: a pad that puts three notes in the bar instead of
         two is still a pad; one running eighths is not.

     ...AND A DRONE DOES NOT DEVELOP A MOTIF. `STEADY` is compose.js's own
     opt-out, honoured the way `formOf` honours it: a steady anchor draws every
     coin below — the stream-position law, so retuning a pop record's
     development cannot move a drone's — and KEEPS NOTHING. `formOf`'s arc plan
     keeps a count of statements because how many times a held thing comes
     round is a real decision; there is no equivalent here, because "the same
     held note, again" is the entire claim drone and ambient make about
     themselves. Their releases stay `ring` and their returns stay the
     statement, and that is a decision, not an untested branch.

     THREE OR FOUR RHYTHMS, NOT ELEVEN. `DEVCAP` is the number of DISTINCT
     devices one part may take in one record. A hook that is different every
     time it comes round is not a hook either — it is a development section —
     so a part states its figure and takes at most three shapes besides, and a
     return past the cap comes back as the variation the record has already
     established. Measured after, the hook takes a mean of 2.6 rhythms per
     record against 1.00 before. */
  // THE RELEASE, in the figure's own units. `last(pulse)` is how long the last
  // note may be, where `pulse` is the shortest note before it — so the same
  // word means a longer note in a slow figure than in a fast one, which is
  // what "short" means to an ear.
  const RELEASE = {
    ring: { w: "rings out",  last: () => Infinity },   // today, and a hymn
    clip: { w: "ends short", last: (p) => p },         // the bar ends in silence
    lean: { w: "leans on",   last: () => 1 },          // one step, into the next
  };
  // ...AND THE ANCHOR'S ARTICULATION WEIGHTS IT, because the release of a
  // phrase's last note IS articulation and the catalog already writes that
  // word down (85 of 201 anchors; `capOf` above reads the same field for the
  // same reason). A legato anchor — chant, ballad, drone, 84 of them — rings
  // two times in three; a normal one lands long a little under half the time;
  // a staccato one is capped at one step per note anyway (HOLDCAP), so its
  // weights are a formality and are written as an even hand rather than as a
  // claim about music that cannot hear the difference.
  // WEIGHTS, NOT A BAN: every anchor can still draw `ring`, and does.
  const RELDEAL = {
    legato:   [["ring", 0.66], ["clip", 0.22], ["lean", 0.12]],
    tie:      [["ring", 0.72], ["clip", 0.18], ["lean", 0.10]],
    normal:   [["ring", 0.42], ["clip", 0.30], ["lean", 0.28]],
    staccato: [["ring", 0.34], ["clip", 0.33], ["lean", 0.33]],
  };
  // THE LADDER — what a return may be. `same` is the biggest single entry on
  // purpose: a figure that never comes back unchanged is not a figure anybody
  // remembers, and the ask is that a hook CAN develop, not that it must.
  // The order of the rows is the order of the coin and nothing else; adding a
  // row at the END renumbers no draw already made.
  const DEVDEAL = [
    ["same",   0.34],   // it comes back as it was — still the commonest thing
    ["trunc",  0.13],   // it stops early: the second-pass move a singer makes
    ["later",  0.12],   // it enters a pulse late
    ["ext",    0.11],   // the landing said once more on the way out
    ["dim",    0.09],   // twice as fast, and twice over
    ["aug",    0.08],   // half speed — the big return
    ["pick",   0.07],   // an anacrusis in front of it
    ["nopick", 0.06],   // ...or the one it had taken away
  ];
  const DEVCAP = 3;     // distinct devices one part may take in one record
  // one coin, one word — a cumulative walk, so the weights read as the
  // percentages they are and the last row catches any rounding
  const pickBy = (u, rows) => {
    let acc = 0;
    for (const [w, p] of rows) { acc += p; if (u < acc) return w; }
    return rows[rows.length - 1][0];
  };
  // THE TABLES ANSWER FOR THEMSELVES, at load, the same law §1's assertTables
  // keeps: a device this file names and ideas-kit does not have would compose
  // an undeveloped record in silence, which is exactly the failure this file
  // legislates against. And the weights must be weights.
  for (const [w] of DEVDEAL)
    if (!Id.DEVELOP[w]) throw new Error(`precompose: no such development device "${w}"`);
  for (const [k, rows] of Object.entries(RELDEAL)) {
    for (const [w] of rows)
      if (!RELEASE[w]) throw new Error(`precompose: RELDEAL.${k} names no release "${w}"`);
    const s = rows.reduce((a, r) => a + r[1], 0);
    if (Math.abs(s - 1) > 1e-9) throw new Error(`precompose: RELDEAL.${k} sums to ${s}`);
  }
  {
    const s = DEVDEAL.reduce((a, r) => a + r[1], 0);
    if (Math.abs(s - 1) > 1e-9) throw new Error(`precompose: DEVDEAL sums to ${s}`);
  }
  // ...AND THE PLAIN DEAL REPRODUCES TODAY, checked and not asserted by
  // comment — `formOf`'s own load-time law ("the plan as written is inside the
  // space the deal can say"). The plain deal is `ring` everywhere and `same`
  // everywhere, and the claim is that both are no-ops: `RELEASE.ring` caps the
  // last note at nothing, and `Id.develop(ph, "same")` hands back the phrase
  // object itself. A device word that stopped being a no-op at rest would
  // otherwise surface as 201 anchors quietly changing at seed 1.
  {
    const probe = Id.toPhrase({ ...Id.blank(), cell: "three", len: "one" }, null);
    if (Id.develop(probe, "same") !== probe)
      throw new Error("precompose: the plain development deal does not reproduce today");
    if (RELEASE.ring.last(1) !== Infinity)
      throw new Error("precompose: the plain release deal does not reproduce today");
  }

  /* WHAT THE DEAL HANDS BACK, and it is deliberately two flat maps rather than
     a structure: `rel[kind]` — one release per part, for the whole record,
     because a part's way of letting go of a note is a fact about the part —
     and `dev[kind + "@" + sectionIndex]` — the device this part's figure takes
     at this return. Absent from `dev` means "the statement", which is most of
     the record and writes nothing.

     `at` is where each kind SOUNDS, a Set of section indices per kind, built
     by the caller off the same slot walk that builds `usedKinds`. The deal
     needs it for one reason only: the first index is the statement. */
  // ...AND ONE LONG NOTE WITH HOLES IN IT HAS NO RELEASE TO DEAL. §6b's own
  // sentence, applied: "A BAND OF ONE IS A PIN, and `long` is alone in its band
  // on purpose — drone, ambient, dub, arabesk and enka say the same thing about
  // themselves — one long note with holes in it — and there is no second way to
  // say it." A release word is a claim about how a note STOPS, and "it does not
  // stop, it decays" is precisely what those five anchors have already said, so
  // the deal has nothing to say to them and says nothing. Read off the table
  // rather than listed: a sixth anchor that pins itself to a band of one is
  // covered the day it lands, and a retuned CELLS row reclassifies itself.
  const heldPin = (gk) => {
    const own = IDIOM_ANCHOR[gk];
    return !!(own && own.cell && (CELLBAND[bandOf(own.cell)] || []).length <= 1);
  };
  function developOf(gk, G, seed, at, nsec, steady) {
    if (seed == null || seed <= 1) return null;    // reading 1 = the day before
    const r = rng(ihash(gk + "/develop/" + seed));
    const rel = {}, dev = {};
    const rows = RELDEAL[G.artic] || RELDEAL.normal;
    const noRel = steady || heldPin(gk);
    for (const k of KIND_OF) {                     // ALWAYS, kept or not
      const w = pickBy(r(), rows);
      if (!noRel && w !== "ring") rel[k] = w;
    }
    for (const k of KIND_OF) {
      const secs = at[k];
      const first = secs && secs.size ? Math.min(...secs) : -1;
      const took = [];                             // the distinct devices so far
      let lastDev = null;
      for (let i = 0; i < nsec; i++) {
        const u = r();                             // ALWAYS, sounding or not
        if (steady || !secs || !secs.has(i) || i <= first) continue;
        let d = pickBy(u, DEVDEAL);
        if (d === "same") continue;
        if (!took.includes(d)) {
          // past the cap the return comes back as the variation this record
          // has already established, rather than as a ninth new shape
          if (took.length >= DEVCAP) { d = lastDev; if (!d) continue; }
          else took.push(d);
        }
        lastDev = d;
        dev[k + "@" + i] = d;
      }
    }
    return { rel, dev };
  }
  /* IS THE DEVELOPED FIGURE STILL THIS FIGURE? The third fence, and the one
     that is measured rather than declared. Read off the rendered `play` rows,
     because that is what an ear gets: the same number of onsets a phrase
     compiles to, put through §6b's own density bands. */
  const onsetsIn = (cell) => cell.play.filter((x) => x === "n").length;
  function keepsIts(made, stated) {
    const a = onsetsIn(made), b = onsetsIn(stated);
    if (a < 2) return false;                                   // not a figure
    if (made.play.join("") === stated.play.join("")) return false;  // did nothing
    // A FIGURE THAT SOUNDS ON EVERY STEP IS NOT A FIGURE. ideas-kit's own
    // opening law — "the RESTS are the content; a tune that plays on every
    // sixteenth is a scale" — and it is the one thing a diminution of running
    // eighths would otherwise produce.
    if (a >= made.play.length) return false;
    // THE DENSITY MAY DOUBLE OR HALVE AND NO MORE. A device may say the figure
    // twice (diminution) or say half of it (truncation, augmentation losing
    // its tail), because those ARE the devices; anything past that is not this
    // figure any more, it is another one. Written as the ratio rather than as
    // §6b's four bands because the bands are cut for choosing BETWEEN cells and
    // a diminution crosses two of them by definition.
    return a <= 2 * b && a >= Math.ceil(b / 2);
  }
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
  // the nameplate follows the return, so the board's bus 1 is CALLED what the
  // return is FOR. It used to be called what the return IS — `plate` under a
  // plate, `hall` under a hall, `air` under a shimmer — and that was the
  // confusion Paul named on 2026-08-26 (*"'name' is a very confusing row
  // because the 'name' seems to be reverb types"*): the nameplate repeated the
  // `reverb type` knob's own word back at it, one cell away, so bus 1 read
  // "plate" twice and neither reading told you which one you were turning.
  // fields.js BUSNAMES is a JOB vocabulary now, so this table maps each of the
  // five REVERBS colours to what that colour is being USED for — a plate for
  // sheen on a voice, a hall for depth, a chamber for the room itself, the dub
  // tank for a long wash, the shimmer for a bloom of octaves above the note.
  // assertDeskTables above pins every value here to a BUSNAMES key, so this
  // table and that one cannot drift apart without the boot throwing.
  const RETNAME = { plate: "sheen", hall: "depth", chamber: "ambience",
                    spring: "wash", shimmer: "bloom" };

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
  // BUS 2'S NAMEPLATE, AND IT IS A TABLE NOW rather than a ternary with two
  // string literals in it. The literals were `echo` and `slap` and both were
  // words fields.js BUSNAMES held until 2026-08-26 — they were the DELAY's own
  // words, repeated back at the delay, which is the same confusion Paul named
  // one bus up (*"'name' is a very confusing row because the 'name' seems to be
  // reverb types."*). BUSNAMES is a JOB vocabulary now, so the two names say
  // what the delay is FOR: long repeats are a `throw` (the engineer's own word
  // for sending a word out into the delay), short ones are a `double` — which
  // is what a slapback does to a voice and always has been.
  //
  // IT IS A TABLE SO assertDeskTables CAN SEE IT. The ternary was invisible to
  // that check — the rename went green here and failed 30 records deep in
  // precompose.test.js G8c ("echo.name = \"echo\" is not one of its words"),
  // which is exactly the drift the assert exists to catch at boot instead.
  const ECHONAME = { more: "throw", less: "double" };
  function echoBus(G) {
    const T = G.tone || {};
    const fb = (T.verb || 0) >= BIGROOM ? "more" : "less";
    return { name: ECHONAME[fb],
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
  /* ...AND THE SECOND CHAIR OF THE SAME ROLE IS NOT A SECOND SUBJECT
     (2026-08-30). Paul, having fixed one record by hand: *"Air (as a band) is
     good but the main vocals are 2x too loud and the other vocal line should
     be about 20% quieter"* — and then, generalising it himself: *"Same all
     over. Voices just too loud everywhere. Portishead good example."* He had
     said it before, of iranpop: *"Everything is hot."*

     MEASURED ON THE DOCUMENTS THIS FILE WRITES, all 374 anchors at seed 1,
     before anything was changed: 305 records seat a vocal chair, 653 vocal
     chairs in all — 377 carry `fwd`, 263 carry nothing, and the only 13 that
     are pulled BACK are pads. Every one of the 377 is a `lead`, because the
     row above is keyed by part ALONE: `lead` meant `fwd` however many leads a
     record had. And records have several — 169 of the 374 seat two lead
     chairs, 38 seat three, one seats four, so 248 chairs were dealt the front
     of a record that has one front. THE DEFAULT POSTURE OF A SINGER IN THIS
     BOX WAS FORWARD, and nothing in the catalogue said otherwise.

     air is the record he fixed and it is that shape exactly: a `synth_voice`
     lead and a `solo_vox` lead, both `fwd`, with an `ahh_choir` beside them —
     three vocal things, two of them boosted. Measured at the ring on the
     rendered artifact (test/_voxtap.cjs, mute-complement, 8 bars, seed 1),
     air's three vocal chairs sit +13.4, +10.6 and +8.7 dB above the whole
     instrumental band, and muting them drops the record 12.84 dB: 83% of the
     spectrum's energy in 300 Hz-3 kHz with them, 21% without.

     A RECORD HAS ONE VOICE OUT FRONT. That is the whole law here, and it is
     the one thing a part-keyed table could not say. The FIRST chair of a role
     keeps the seat the role means; the second and third are the same role
     played AGAIN, and a second lead is a harmony, a double or an answering
     line — Paul's "the other vocal line" — not a second subject. So the later
     ones fall back to `norm`, which is ABSENT (the row above's own law), and
     the record's board stays free of decisions nobody made.

     WHAT IT IS WORTH, in the ladder's own units: fields.js LEVELS is
     { hush: 0.4, back: 0.7, norm: 1, fwd: 1.35 }, so `fwd` -> `norm` is
     -2.61 dB and `fwd` -> `back` would be -5.71. Paul asked for -20% on air's
     second vocal line, which is -1.94 dB: `norm` is the rung his number is
     nearest, `back` is more than twice his ask, and this is why the ladder
     does NOT gain a rung for it. (The desk adds -1 dB more of its own on the
     ordinal — audio/desk.js derivedPartTone subtracts min(2, ord-1) — so the
     second lead lands 3.6 dB under the first, which is the CONTRAST the
     complaint is really about: everything was forward and nothing was back.)

     IT IS ROLE-SHAPED AND DELIBERATELY NOT VOICE-SHAPED. `deskFor` is handed
     the whole voice and could ask whether this chair sings, but "a record has
     one subject" is true of the two trumpets on a swing side as much as of two
     singers, and the INSTRUMENT half of the same complaint has its own owner
     with its own measurement: audio/to-engine.js PAGE_TRIM, the per-module
     page make-up, where the singer's own +18.3 dB was cut this same day. Two
     facts, two tables, neither said twice. */
  const CHAIRLVL2 = { lead: "norm" };
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
  // COUNTED ON THE CAST, AND SO IS THE ADDRESS NOW (2026-08-28). This said the
  // two were different on purpose: "this walk groups by `cast.part`, while
  // desk-doc.js chairsOf re-derives the role by CYCLING the anchor's `part`
  // scheme (`g.part[v % g.part.length]`) and can therefore call the second
  // `lead` of this record `stab2` … it does not matter and must not be
  // 'fixed'". It was right that the entry lives ON THE VOICE and reaches its
  // channel whatever the channel is called, and right that this row decides a
  // musical fact rather than a routing one. It was wrong about the cycling,
  // which was the wrap bug — measured in the browser on Kingston, the vocal
  // was the second lead here and the board's second stab there, and the board
  // was naming a role nobody played. chairsOf now reads `cast.part` too, so
  // the two walks group by the same fact and Kingston's board says `lead2`.
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
       `fx` on a chair   — REVERSED 2026-08-27, BY PAUL, IN TWO SENTENCES.
                           This read: "a chip on a TRACK is Paul's open
                           question 3 (STATE.md: 'This reverses your
                           2026-08-17 directive… Do you accept the
                           reversal?'). It is undecided, and a precomposer
                           that put one on 122 records would have answered it
                           for him. The genre-wide chip goes on the BOX
                           instead (`sound.fx`)". He answered it: *"I think we
                           need to do what everyone else does with effects.
                           Add per voice effects, up to three. Each has a wet
                           dry mix and its own settings."* (fields.js FXWETS
                           is that sentence's other half), and then, of the
                           record-wide control the chip used to live on:
                           *"We can get rid of Character right? We don't
                           really use it any more do we?"* So the chip is
                           written on the CHAIR now — `deskThe` below — and
                           `sound.fx` is not written at all.
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
  /* A ROW MAY NAME ITS OWN CHAIR'S SENDS (2026-08-31). Paul, on portishead:
     "when the guitar starts to riff send it through lots of delay and
     reverb". The tables above are ROLE-keyed and catalogue-wide — CHAIRREV
     puts `touch` on every pad in 374 records — so moving one of them to
     answer one record would have re-mixed the whole table, and the row's
     own `fx` list is the wrong door too: it seeds an INSERT on every seated
     voice, which is exactly the mechanism that buried the industrial rows
     under one shared filter sweep. A send is neither: it is one chair's
     proportion into a bus the record already has.
     So `G.mix` is a part-keyed override — `mix: { riff: { rev: "wet",
     echo: "wet" } }` — read here, AFTER the dealt words and over them, in
     the same SENDS vocabulary the desk already speaks (fields.js: none 0,
     touch .12, some .3, wet .55, drown .9). Absent is today: no `mix` key,
     no lookup, byte-identical. It cannot invent a bus (a word the enum does
     not hold is dropped by the desk exactly as it always was) and it cannot
     reach a chair that is not seated. */
  function deskFor(voice, nth, echo, fx, G) {
    const part = (voice.cast && voice.cast.part) || "line";
    const e = {};
    // the second chair of a role takes CHAIRLVL2's word if it has one, and
    // `norm` is absent — see the block above.
    const lvl = (nth > 0 && CHAIRLVL2[part]) ? CHAIRLVL2[part] : CHAIRLVL[part];
    if (lvl && lvl !== "norm") e.lvl = lvl;
    if (CHAIRREV[part]) e.rev = CHAIRREV[part];
    if (nth > 0) e.pan = CHAIRPAN[(nth - 1) % CHAIRPAN.length];
    if (voice.kind === "drums" &&
        MACHINEKIT.indexOf(voice.instrument) < 0) e.room = "touch";
    if (echo) e.echo = ECHOSEND;
    // THE CHARACTER CHIPS, ON THE STRIP (2026-08-27) — see deskThe below.
    if (fx && fx.length) e.fx = fx.slice();
    // ...and the row's own word for this part, last, so a named record wins
    // over the role's default without either table learning about the other.
    const said = G && G.mix && G.mix[part];
    if (said) for (const k of ["rev", "echo", "room", "aux", "genre", "lvl", "pan"])
      if (said[k] != null) e[k] = said[k];
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
    /* THE CHARACTER CHIP, DEALT (2026-08-27). Paul: *"We can get rid of
       Character right? We don't really use it any more do we?"* — and
       FUTURE.md §5 had already ruled the same way, in the same words the
       engineer used: "dealt, not embedded".

       WHAT "WE DON'T REALLY USE IT" MEASURED TO. The HAND does not: it is the
       one `<select multiple>` on the page and nothing else on the board is
       one. THE COMPILER DOES — 27 of the 199 anchors write a `sound.fx`
       (chorus x27, sweep x24, crunch x15, tremolo x6, crunch+sweep x6,
       crunch+chorus x3 over 597 records), and audio/desk.js folded it into the
       insert chain of EVERY seated voice. So it was never unused, it was
       invisible: measured on the rendered artifact at 8 bars, neoclassical's
       chorus cost the record 2.23 dB of RMS, ambient's sweep 1.96 dB of PEAK
       and 0.74 dB of crest, techno's 0.26 dB — a stage a hand could not see
       per voice and could not turn down per voice.

       DEALING IT IS AUDIO-IDENTICAL AND NOT A REBALANCE, which is the whole
       reason it can be done in one round. desk.js built the chain as
       `[...p.fxc, ...fxChain([...S.fx, ...o.fx])]` — the part's own slots
       FIRST, the record's chip after — and no anchor in the catalog wrote a
       `desk.fx`, so `p.fxc` was empty on every record that had a chip. Moving
       the same keys, in the same order, into the slots that come first
       produces the same list through the same insertsFor door. And the set of
       voices is the same set: `seated` is `!!addr[key] || isDrum`, and
       audio/plan.js castOf only writes `addr` from the box's own roster, so a
       seated voice always resolves to a part — which is why the chip may be
       carried by the chair instead of by the box without losing a voice.

       ON EVERY CHAIR, INCLUDING THE BASS AND THE DRUMS, because that is
       exactly who `S.fx` reached. A record-wide chip is a record-wide chip;
       what changes is that a hand can now see it on nine strips and pull it
       off one of them. */
    const fx = soundFxOf(G);
    const seen = {};
    voices.forEach((v, i) => {
      const part = (v.cast && v.cast.part) || v.kind;
      const nth = (seen[part] = (seen[part] || 0) + 1) - 1;
      const e = deskFor(v, nth, i === lead, fx, G);
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
     7b · THE REGISTER FLOOR — nothing but the bass lives down there
     ======================================================================
     PAUL, 2026-08-28: "Lots of registers are -3 and -2 for things like house
     and acid house what gives … They're unbearable is it endemic". It was:
     measured over 199 anchors x seed 1, 62 non-bass chairs on 52 of the 175
     anchors that HAVE a bass were centred at or below the bass's own centre,
     and 12 of them were centred an octave UNDER it.

     WHY IT HAPPENS, and it is three things stacking rather than one:
       (a) THE RAMP IS WRITTEN LOW. 75 of 199 anchors declare a `reg` whose
           value at voice 0 is negative — `v => v - 1` is the single commonest
           line in genres.js — so the FIRST chair, the one the record is named
           after, is the deepest one. Nothing is wrong with a ramp; the bug is
           that a ramp has no bottom.
       (b) A SECOND NEGATIVE LANDS ON TOP OF IT. The register word added below
           (KINDS.riff / KINDS.seq say "low", and three IDIOM_ANCHOR rows —
           acid, techno, dancehall — say it again) is another -12, and on 27
           chairs it fell on a ramp that was already under zero. On a `riff`
           part that is a THIRD -12, because kernel.js PARTS.riff carries its
           own ctr: -12, and cumbia / dancehall / ragtime / shaabi / soukous
           each ended with a riff centred at MIDI 24.
       (c) NOTHING CAUGHT IT. The clamp below floors at -4, which is MIDI 12 —
           four octaves under middle C, below the kernel's own bass floor of
           24, below the bottom of a piano. A clamp that only bites two
           octaves under the bass is not a clamp.

     THE RULE, and it is read off the note data rather than off taste. The
     bass centres at 36 (kernel.js:2531 `+ 36`, moved only by `bassReg`, which
     0 of 199 anchors set) and its notes are floored at MIDI 24. keys-kit.js
     already names the consequence — "a keys part that fights the bass for the
     bottom is the commonest mix problem there is" — so:

         A CHAIR THAT IS NOT THE BASS CENTRES AT LEAST AN OCTAVE ABOVE THE
         BASS'S OWN CENTRE.

     Two exceptions, both stated as data:
       · NO BASS, NO FLOOR. On the 24 anchors that declare `nobass` the lowest
         chair IS the bass — hymn's fourth voice is the church organ holding
         the bass line and its own comment measures it at MIDI 7-38 on purpose.
       · SUBTERRANEAN ANCHORS may share the bass's octave but still not go
         under it. The list is below and every entry quotes the anchor's own
         comment saying the low voice is a bass.

     AND IT IS A LIFT, NOT A CLAMP. Clamping per voice would flatten the
     anchor's SPREAD — deathmetal's -3/-2 pair would land on one register and
     stop being an octave doubling. So the deficit is measured once over the
     whole cast and the same number is added to every chair: the record moves
     up, the shape it was written with survives. */

  // The anchors whose own text says the low voice is the bass. A record here
  // may sit IN the bass's octave; it may still not sit under it.
  const SUBTERRANEAN = {
    // "the 303 line is simultaneously melody, bass and the entire harmony"
    acid: 1,
    // "the bleep line up high, the sub bass an octave-and-a-half under it,
    //  the SAME machine at two registers"
    bleeptechno: 1,
    // "over a tied reese-register line and a pedal sub that refuses to move"
    dnb: 1,
    // "tuned into the floor (reg -3 and -2)" — the number IS the genre
    sludge: 1,
    // "a pedal bass that never leaves the tonic" under held tones, rate 0.25
    drone: 1,
  };

  // THE LEAN IS THE CHAIR'S, NOT THE INDEX'S (2026-08-28; this took `(G, v)`
  // and re-derived the part from the anchor's array, wrapping "exactly as
  // partOf does"). Both halves of that were wrong. The wrap dealt a borrowed
  // role past the end of a short sheet — a LAYER, seated after the whole base
  // cast, was measured against whatever name the host's array wrapped onto,
  // which is not the part the guest brings and not the part the kernel plays.
  // And the wrap itself is gone from kernel.js partOf. So this takes the PART
  // the chair is actually cast in — the same `cast.part` the document writes
  // and toGenre now hands the kernel — and asks kernel.js for its lean, which
  // makes this file's centre arithmetic a reading of the kernel's rather than
  // a copy of it.
  const partCtrOf = (part) => 12 * K.partLean(part);
  const centreOf = (part, reg) => 60 + 12 * reg + partCtrOf(part);

  /** A CHAIR IS NOT TOLD TWICE TO GET DOWN. `KINDS.riff` and `KINDS.seq` say
   *  "low" (-1 octave) and kernel.js PARTS.riff / PARTS.drone say `ctr: -12`
   *  — the same sentence about the same chair, written in two files, and on a
   *  ramp already under zero it made a third. Measured: the five riffs that
   *  ended at MIDI 24 (cumbia, dancehall, ragtime, shaabi, soukous) are all
   *  this. Where the KERNEL is going to drop the chair, the word does not say
   *  it again; on the 104 anchors that declare no `part` scheme the word is
   *  the only statement there is and it stands untouched. */
  const sayOnce = (part, w) => (w < 0 && partCtrOf(part) < 0 ? 0 : w);

  // AND THERE IS A LID ON IT. Lifting a cast that is already four octaves
  // wide would put a sung `lead` (PARTS.lead is another +12) at MIDI 96 — a
  // piccolo, and above the top of every throat vocal-kit names. C6 is the top
  // of a soprano's compass and the top of what anything in this catalog plays
  // as a melody, so the record comes up only as far as its highest chair can
  // go; whatever floor is still unmet after that is taken from the low chair
  // alone, which is a collapse of ONE voice rather than of the whole record.
  const CEILING = 84;

  const floorCtrOf = (G, gk) =>
    36 + 12 * (+G.bassReg || 0) + (SUBTERRANEAN[gk] ? 0 : 12);
  /** The lowest register this chair may be written at, in the kernel's units. */
  const floorRegOf = (G, gk, part) => (G.nobass ? -4
    : Math.ceil((floorCtrOf(G, gk) - 60 - partCtrOf(part)) / 12));

  /** How far the whole cast comes up so that no chair sits under the bass —
   *  one number for the record, capped by the headroom over its top chair.
   *  0 for the 24 `nobass` anchors, where the low chair IS the bass. */
  function regLift(G, gk, raw, parts) {
    if (G.nobass) return 0;
    const floor = floorCtrOf(G, gk);
    let need = 0, head = Infinity;
    for (let v = 0; v < raw.length; v++) {
      const c = centreOf(parts[v], raw[v]);
      need = Math.max(need, Math.ceil((floor - c) / 12));
      head = Math.min(head, Math.floor((CEILING - c) / 12));
    }
    return Math.max(0, Math.min(need, head));
  }
  /** The register one chair is written at: the record's lift, then the floor,
   *  then the clamp this file has always ended on. */
  const regAt = (G, gk, part, raw, lift) =>
    Math.max(-4, Math.min(3, Math.max(raw + lift, floorRegOf(G, gk, part))));
  /** WHAT THE CHAIR SHOWS IS WHAT THE CHAIR PLAYS. `regAt` answers the BASE
   *  register the arithmetic above reasons in; the sounding centre is that
   *  plus the part's lean (`centreOf`), and until today the document wrote
   *  down the base and the box played the centre — merengue's lead read -2 on
   *  the chair and sang at MIDI 48, which is -1. 319 of 1081 seated chairs
   *  disagreed with themselves that way. `cast.reg` is now the SOUNDING
   *  register, one number, and document.js toGenre hands the kernel back the
   *  base it implies (K.partLean, the same table this reads). The sound does
   *  not move: base + lean is what the centre always was. */
  const seatRegAt = (G, gk, part, raw, lift) =>
    regAt(G, gk, part, raw, lift) + K.partLean(part);

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
    const { row: row0 } = idiomOf(gk);
    const scale = scaleName(gk, G);                // throws by name if unnameable

    // THE ANCHOR'S OWN COUNT (2026-08-30, the triple-meter round). This line
    // read `stepsIn({ meter: null })` with the comment "0 of 122 anchors
    // declare a meter" — which was the wall, not a fact of nature: kernel.js
    // METERS, chair.js regrid and ideas-kit CELLS3/CELLS6 all existed, and
    // this file was the one door that would not read the word. An anchor row
    // says `meter: "three" | "six"` (the same word song.js:846 stores — only
    // the word is ever written down, so a saved row and the live table cannot
    // drift), it is validated BY NAME here, and the whole extraction below —
    // the theme (ideas-kit metOf reads m.met and regrids its cells), the cell
    // slices (`cb * steps`), the accents (`i % steps`) and the document's own
    // Time axis — counts in it. An anchor that says nothing takes steps = 16
    // and is byte-identical, which the determinism sweep holds.
    const met = (() => {
      if (G.meter == null) return null;
      const m = K.METERS[G.meter];
      if (!m) throw new Error(`precompose: anchor "${gk}" declares a meter ` +
        `no METERS key names (meter: "three"|"six" on its GENRES row)`);
      return m;
    })();
    const row = met ? { ...row0, met } : row0;     // the theme counts with the record
    const steps = stepsIn({ meter: met });
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
      // ...AND THE RECORD'S DYNAMICS, WHICH WERE BEING THROWN AWAY HERE
      // (2026-08-28). Paul: "Shouldn't automation already have values preset
      // per generated song." Measured over all 199 anchors and 2,075 sections:
      // `lvl` and `env` were set on ZERO of them, so every precomposed record
      // was dynamically flat — and the composer was not silent. compose.js
      // deals `env` on nearly every section (its arc, dynOf/spreadDynamics)
      // and `lvl` from THE LEVEL DEAL (compose.js:212, this round), and this
      // map dropped both on the floor. Everything downstream was already
      // waiting: PROGRAM.md §2.1 lists both on `form.sections[]`,
      // document.js `boxesOf` copies both onto the box, audio/desk.js
      // `sectionOf` multiplies the section by `LEVELS[lvl]` and `shade`
      // redistributes it across the voices by seat. The projection is an
      // EXTRACTION, like every other line of this file: no word is invented
      // here, and a genre that deals nothing (drone, ambient — depth 0) still
      // writes nothing.
      ...(b.lvl ? { lvl: b.lvl } : {}),
      ...(b.env ? { env: b.env } : {}),
      // ...AND ITS PACE (2026-08-30): the section's own tempo word, dealt by
      // compose (dealPaces — an anchor row's `paces:` map, verbatim at seed 1)
      // and carried the way lvl/env are: an EXTRACTION, present-only, so a
      // record whose composer dealt nothing writes nothing.
      ...(b.pace ? { pace: b.pace } : {}),
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
    //
    /* ---- TWO DOORS ON THE GUEST LIST (2026-08-30, the instrumentation
       round; Paul: "make sure that voices are there, not misplaced, and
       appropriate to region and era, and that vocals aren't there when
       they're supposed to be instrumentals").

       DOOR 1 — AN INSTRUMENTAL RECORD STAYS INSTRUMENTAL. Measured over 308
       anchors x seeds 1..3: `hohlefels` — voices:1, "one flute, alone, in a
       stone room" — composed to a flute PLUS a forward lead singer, because
       compose.js books the `vocal` layer off the family lean (SINGS.roots)
       and never asks whether the HOST can have one; its own INSTRUMENTAL
       table already knows the question (singerOf, and guestCast's "an
       instrumental record books no singing guests") but stops at the
       FUNCTION parts — `gregorian`, a real genre whose whole instrument is
       a choir, walked onto fugue and counterpoint through the same lean.
       So the door is held HERE, where the chair is seated, over the same
       owners: a record that neither sings with its own instr nor states a
       tone.mouth, and that is declared instrumental (compose's table, or
       the row's own `instrumental: true` — genres.js, this round), seats
       no chair whose instrument resolves to a PATCHES.voice/.mouth id.
       compose.js should read the declared field at its own doors too —
       reported, out of this round's fence.

       DOOR 2 — A GUEST RESPECTS THE HOST'S LINEAGE. The era half already
       exists (compose.js eraOK — measured CLEAN over the same walk: no
       dated guest postdates its host). The genealogy half did not, and the
       hole it left is exactly the one the vox GUEST_LEAN's own comment
       apologises for ("every name below is European… it is the era door
       that decides") — the era door checks TIME and not KINSHIP, so a
       Latin plainchant choir walked onto a Varanasi dhrupad, a Beijing
       guqin, an Istanbul taksim and Nara gagaku, all of them post-1725
       records with no path to Rome in the parents graph. The law: a DATED
       real-genre guest on a DATED host must reach a shared ancestor within
       6 generations of both (undirected through `parents`; `wants` are
       prose, not keys). SIX IS MEASURED, not chosen: the farthest good
       pairing shipped today is dub <- drone at 6, and every deliberate
       cross survives — beatles <- counterpoint at 1, vaporwave <-
       gregorian at 3 (the drift lean's own taste). Undated guests (the
       FUNCTION parts, `simple`) carry no claim and pass, exactly as
       eraOK's own null branch reads. */
    const MOUTHY = (id) => !!(NI.PATCHES.mouth[id] || NI.PATCHES.voice[id]);
    /* ...AND THE SAMPLED VOICES ARE VOICES AT THIS DOOR (2026-08-30, the
       sampling round). `space_voice` is a RECORDING of people singing that
       routes to the sampler rather than to a modelled throat, so it is in
       none of the patch tables and walked straight past door 1 — a vocal
       stab on a record whose own row says nobody sings. instruments.js
       SAMPLED_VOICES is the one owner of "this id is people"; the widening
       is door-1-only ON PURPOSE: `ownVoice` below keeps reading MOUTHY,
       because a sampled aah seated as texture does not make the record a
       vocal record (L3's claim, "a vocal-identity host seats a singer",
       must not be conjured by a pad), it only makes it refusable where
       singers are refused. test/instrumentation.test.js L6 holds this. */
    const VOCAL = (id) => MOUTHY(id) ||
      !!(NI.SAMPLED_VOICES && NI.SAMPLED_VOICES[id]);
    const ownVoice = !!(G.tone && G.tone.mouth) ||
      Array.from({ length: G.voices || 1 }, (_, v) => instrOf(gk, v)).some(MOUTHY);
    const voiceBarred = !ownVoice && !!(NC.INSTRUMENTAL[gk] || G.instrumental);
    const hostYear = NC.genreYear(gk);
    const ancestry = (k, N) => { const seen = new Map([[k, 0]]); let front = [k];
      for (let d = 1; d <= N; d++) { const next = [];
        for (const f of front) for (const p of Object.keys((GENRES[f] || {}).parents || {}))
          if (!seen.has(p)) { seen.set(p, d); next.push(p); }
        front = next; }
      return seen; };
    const GENERATIONS = 6;
    const kin = (lk) => { const A = ancestry(gk, GENERATIONS), B = ancestry(lk, GENERATIONS);
      for (const k of A.keys()) if (B.has(k)) return true; return false; };
    const seated = (lk) => { const L = GENRES[lk]; if (!L) return false;
      if (voiceBarred && VOCAL(instrOf(lk, 0))) return false;                // door 1 (VOCAL: sampled voices too, 2026-08-30)
      if (hostYear != null && NC.genreYear(lk) != null && !kin(lk)) return false; // door 2
      return true; };
    const layerKeys = [];
    for (const b of R.song)
      for (const e of b.stack.slice(1))
        if (seated(e.g) && !layerKeys.includes(e.g)) layerKeys.push(e.g);

    /* ---- MATERIAL. One cell per kind the record actually uses. ---------- */
    // ...AND WHERE EACH KIND SOUNDS, which the same walk already knew and threw
    // away. §6c needs it for one thing: the FIRST section a part sounds in is
    // the statement, and a statement is never developed.
    const usedKinds = new Set();
    const kindAt = {};
    const sounds = (k, i) => { if (!k) return; usedKinds.add(k);
      (kindAt[k] = kindAt[k] || new Set()).add(i); };
    for (let i = 0; i < NSEC; i++) {
      for (let v = 0; v < nBase; v++) sounds(baseKind[i](v), i);
      // ...asked through `seated` (2026-08-30) so a guest the doors above
      // refused registers no kind: a cell nobody plays is a falsehood in
      // the document, and the reading draw (§6b) reads `usedKinds`.
      for (const e of R.song[i].stack.slice(1))
        if (seated(e.g) && (e.slots || []).length) sounds(KIND_OF[e.slots[0]], i);
    }
    if (!usedKinds.size) { usedKinds.add("hook"); kindAt.hook = new Set([0]); }
    const cells = {};
    const phraseOf = {};
    // THIS READING'S OWN WORDS (§6b). Drawn once, here, from the stream §6
    // reserved — after `usedKinds` because a draw belongs to a slot the record
    // actually deals, and before the loop because the loop must ask and not
    // decide. `null` on reading 1: the loop then calls cellOf exactly as it did.
    const rd = reading(gk, s, usedKinds);
    // ...AND THIS RECORD'S OWN DEVELOPMENT (§6c), on its own stream, after the
    // reading and before the cells: the reading says what the figure IS and the
    // deal says what happens to it. `null` on reading 1, and then every call
    // below passes `undefined` as its seventh argument, which is the day before
    // this existed.
    const dv = developOf(gk, G, s, kindAt, NSEC, !!NC.STEADY[gk]);
    const readOf = (k) => rd && rd.cells && rd.cells[k];
    for (const k of KIND_OF) if (usedKinds.has(k)) {
      const rel = dv && dv.rel[k];
      const made = cellOf(row, k, cb, G, steps, readOf(k), rel ? { rel } : null);
      cells[k] = made.cell; phraseOf[k] = made.ph;
    }
    /* ---- ...AND THE FIGURE AS IT COMES BACK (§6c) ------------------------
       One cell per (part, device) the record actually reaches, named for what
       it is — "hook stretched out", "riff cut short" — because a document says
       what it plays and a cell called `hook2` says nothing. The name is the
       part's plus ideas-kit's own word for the device, so the two tables cannot
       drift apart and the band page's motif list reads as English.
       THE THIRD FENCE IS APPLIED HERE, on the rendered cell: a device whose
       result is not still this figure (`keepsIts`) is dropped and that return
       comes back as the statement, which is always playable. */
    const devName = {};
    if (dv) for (const key of Object.keys(dv.dev)) {
      const k = key.slice(0, key.indexOf("@")), d = dv.dev[key];
      const name = k + " " + Id.DEVELOP[d].w;
      if (!(name in cells)) {
        const made = cellOf(row, k, cb, G, steps, readOf(k),
                            { rel: dv.rel[k], dev: d });
        if (keepsIts(made.cell, cells[k])) {
          cells[name] = made.cell; phraseOf[name] = made.ph;
        } else cells[name] = null;                 // remembered as refused
      }
      if (cells[name]) devName[key] = name;
    }
    for (const n of Object.keys(cells)) if (!cells[n]) delete cells[n];
    // what this part plays in this section: its development if the deal
    // reached one, and the statement otherwise
    const cellAt = (k, i) => devName[k + "@" + i] || k;
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
    /* THE CAPTION TELLS THE TRUTH (2026-08-30). The line below used to read
       `nameFor(part === "line" ? "voice" : part)` — every single-line chair
       was captioned "voice", so hohlefels' shakuhachi printed as "voice" in
       the document and everywhere the page repeats it (measured: 582 chairs
       across the catalogue wore the word while holding a guitar, an organ, a
       piano). A chair is named by what it IS: the part where the part is a
       word ("lead", "counter", "pad"…), and for the unmarked "line" part the
       instrument's own head noun — "voice" only when the id resolves to one
       (the same two tables the doors above read), "synth" when the record's
       signature covers it, and otherwise the last word of the id with
       trailing digits dropped (compose.js kindOf's own derivation, said
       again here rather than imported for the layer-graph reason its SUNG
       regex gives; the instrumentation gate holds the two in step). */
    const capWord = (id) => { const t = String(id).split("_").filter((x) => !/^\d+$/.test(x));
      return t[t.length - 1] || String(id); };
    const captionOf = (part, id) => part !== "line" ? part
      : MOUTHY(id) ? "voice" : capWord(id);

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
    // MOUTHY moved up beside the guest doors (2026-08-30) — one spelling of
    // the same two tables; this clause reads it from there.
    const sigSynth = G.synth && G.synth.dsp ? G.synth : null;
    const signed = (part, id) => !!sigSynth && !MOUTHY(id) &&
      !(sigSynth.lineOnly && PAD_PART[part]);

    /* ---- 7b · WHERE THE CAST SITS, decided once for the whole record ----
       The raw register of every LINE chair in seating order — the base cast
       first, then the layers, which is the order they are pushed below and
       therefore the index kernel.js reads them at. `regLift` turns that list
       into one number; § 7b has the rule and the reason. */
    // WHAT EACH CHAIR IS CAST AS, decided ONCE, before anything measures where
    // it sits (2026-08-28). The two loops below each used to re-derive this at
    // the point of writing `cast.part` while the register arithmetic derived
    // its own from the anchor's array with a wrap — two answers to one
    // question, and where they differed the number written on the chair was
    // measured against a role the chair was not in. This list is the answer;
    // everything after it reads from here, and `cast.part` is written from it.
    const basePart = [];
    for (let v = 0; v < nBase; v++) basePart.push((G.part && G.part[v]) || G.realize(v));
    const layerPart = layerKeys.map((lk) => {
      const L = GENRES[lk];
      return (L.part && L.part[0]) || L.realize(0);
    });
    const baseKinds = [];
    for (let v = 0; v < nBase; v++) baseKinds.push(R.song.map((b, i) => baseKind[i](v)));
    const rawReg = baseKinds.map((kinds, v) => G.reg(v) +
      sayOnce(basePart[v], (REG[(KINDS[dflt(kinds)] || {}).reg || row.reg] || REG.mid).v));
    // THE LIFT IS THE BAND'S, NOT THE GUEST'S. It is measured over and applied
    // to the BASE cast only: a layer's register is its own anchor's fact (the
    // +1 is derive.js:466's `reg: v => L.reg(v) + 1`), and dragging a guest up
    // an octave because the host band was written low moves music nobody wrote
    // low. A layer still answers to the floor, one chair at a time, below.
    const lift = regLift(G, gk, rawReg, basePart);
    for (const lk of layerKeys) rawReg.push((GENRES[lk].reg(0) | 0) + 1);

    for (let v = 0; v < nBase; v++) {
      /* AN ARPEGGIO IS NOT SUNG (2026-08-31). Paul, on the round that gave the
         machine wing its sequencer back: "Arps should never be vocal! It makes
         no sense. You did that with Meat Beat. Synths can do that. Not people."

         He is right and the mechanism is plain: a section puts slot 9 in its
         stack and the voices read slots BY INDEX, so the sequencer lands on
         whichever chair the arithmetic reaches — and on industrialbreaks that
         chair was a singer. Sixteen notes a bar of broken chord is a thing a
         machine does; a person breathes. The refusal belongs HERE, at the one
         place that knows both the kind and the instrument, rather than in the
         dealer, which knows the slot and not who will play it.

         WHAT THE VOICE GETS INSTEAD is `topline` — the sung eight. Not
         silence: taking the part away would leave a hole in the arrangement
         where a voice was cast, and the point is that the singer should be
         singing, not that the singer should be absent.

         THE TEST IS `VOCAL`, not MOUTHY — the same door the instrumentation
         law uses, so a SAMPLED choir counts as people too. One owner for
         "this id is a person". */
      const kinds = VOCAL(instrOf(gk, v))
        ? baseKinds[v].map((k) => (k === "seq" ? "topline" : k))
        : baseKinds[v];
      const home = dflt(kinds);
      const material = { "": home };
      const development = {};
      kinds.forEach((k, i) => {
        // THE CELL THIS SECTION READS is the part's DEVELOPED figure where
        // §6c dealt one and the part's own figure otherwise — the same map,
        // the same law, one more thing written into it. `cellAt` returns the
        // kind itself on reading 1, so this line is byte-identical there.
        const nm = k && cellAt(k, i);
        if (nm && nm !== home) material[sid(i)] = nm;
        // ...and the section's WORD is tested against the figure the section
        // actually plays: a word that speaks over the statement can still miss
        // a truncated return, and a word that leaves no onset mutes the voice
        // (the measured failure this `speaks` check exists for).
        development[sid(i)] = nm ? sayOps(R.song[i].ops, nm) : "out";
      });
      const part = basePart[v];
      const instrument = signed(part, instrOf(gk, v)) ? "synth" : instrOf(gk, v);
      voices.push({
        name: nameFor(captionOf(part, instrument)),   // the honest word — see captionOf
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
                // ...AND IT IS FLOORED SO IT DOES NOT LAND UNDER THE BASS
                // (§ 7b). The lift is the record's, not this chair's, so the
                // spread the anchor wrote survives being moved.
                reg: seatRegAt(G, gk, part, rawReg[v], lift),
                // ENTRY IS BARS INTO EVERY SECTION HERE, not into the record
                // (ui/derive.js renders each box independently), so an
                // unclamped entry of 3 SILENCES a voice in a two-bar intro.
                entry: Math.max(0, Math.min(G.entry(v) | 0, minBars - 1)) },
        material, development,
        instrument,             // computed once above, so the caption and the
      });                       // seat can never disagree about what is held
    }

    layerKeys.forEach((lk, li) => {
      const L = GENRES[lk];
      const kinds = R.song.map((b) => {
        const e = b.stack.slice(1).find((x) => x.g === lk);
        return e && (e.slots || []).length ? KIND_OF[e.slots[0]] : null;
      });
      const home = dflt(kinds);
      const material = { "": home };
      const development = {};
      kinds.forEach((k, i) => {
        const nm = k && cellAt(k, i);          // §6c, as above
        if (nm && nm !== home) material[sid(i)] = nm;
        // A LAYER IS SILENT WHERE IT DOES NOT APPEAR, and `out` is the word
        // songs.js documents for exactly that ("a voice can be silent for a
        // section without leaving the record") — which is what makes a guest
        // a guest rather than a second band member.
        development[sid(i)] = nm ? sayOps(R.song[i].ops, nm) : "out";
      });
      const part = layerPart[li];
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
                reg: seatRegAt(G, gk, part, rawReg[nBase + li], 0),
                entry: 0 },
        material, development,
        instrument,
      });
    });

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

    /* ---- the record ----------------------------------------------------- */
    return {
      basis: gk,
      time: {
        bpm: R.bpm, rate: G.rate == null ? 1 : G.rate,
        // the WORD, never the numbers (song.js:846's own law) — and only when
        // the anchor row says one; absent stays the null it always was
        meter: G.meter || null,
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
        // compose.js:1849 S.tonic, MOVED BY THE READING (§6b). The document
        // carries ONE key — precompose drops compose()'s per-section
        // modulations, which is why this is the single place a reading's
        // transposition has to land, and why it lands here rather than inside
        // compose(): the shift is a fact about this READING of the record and
        // compose() is where facts about the GENRE live. wrapKey is fields.js's
        // own fold back onto the -6..5 table, so ±2 off any tonic is still a
        // key the document can name.
        key: NF.wrapKey(R.song[0].key + (rd ? rd.key : 0)),
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
        // NO `fx` HERE ANY MORE (2026-08-27). This line read
        // `...(fx.length ? { fx } : {})` under the comment "the record-wide
        // character chip: the anchor's own `fx`, minus the echo, which is a
        // BUS on this desk and not an insert". The chip is the same chip and
        // the echo is still a bus; what moved is WHO CARRIES IT — `deskThe`
        // above writes it on every chair's own strip, where it can be seen and
        // turned down one voice at a time. Paul, 2026-08-27: "We can get rid
        // of Character right?"
      },
      performance: { take: 0, humanize: G.humanize || 0, ontime: true },
    };
  }

  assertDeskTables();          // after § 7's rows exist, for the reason above

  return { genreToDocument, anchors, idiomOf, cellBarsOf, cellOf, CELL_BAR_CEILING,
           IDIOM, IDIOM_ANCHOR, KINDS, KIND_OF, SAY, HOLDCAP, capOf, progOf,
           // §6c THE DEVELOPMENT DEAL and its three tables, exported on the law
           // compose.js exports `DEALS`/`formOf` under: "a policy the suite
           // cannot read is a policy the suite can only measure indirectly."
           // `RELEASE` in particular is a new AXIS of a composed cell — a gate
           // that enumerates what a reading may compose has to enumerate it
           // too, or it is testing yesterday's space.
           RELEASE, RELDEAL, DEVDEAL, DEVCAP, developOf, keepsIts,
           // § 7, exported so the gate measures THE CHOOSER rather than a
           // second copy of it — the same law `idiomOf` is exported under
           grooveOf, busesOf, soundFxOf, kitFacts, retOf, ROOM, ECHOSEND };
});
