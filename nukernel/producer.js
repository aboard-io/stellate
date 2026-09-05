// nukernel/producer.js — THE PRODUCER. You say a sentence; the record moves.
//
// Classic UMD data tier like every other file below the UI: pure, node
// loadable, zero DOM, and it makes no sound. It reads tables that already
// exist (genres.js anchors, kernel.js KITOPS/LANES, fields.js KITLABEL,
// bass-kit's STYLES) and writes into ONE seam — the section genres band-kit's
// toSong already composed — which is why nothing in kernel.js, genres.js or
// any kit file had to change for it to exist.
//
// THE GRAMMAR IS ONE SENTENCE SHAPE, BUILT BY TAPPING:
//
//     make  [SUBJECT]  [DESCRIPTOR]
//
// ONE VERB (2026-09-01 — Paul, COMPOSER.md §1 B12: "The only verb is 'make'
// from now on. Make X Y."), a subject tree that goes all the way down (the
// record, a chair, a chair's own components, the mix), and a descriptor that
// is either one of the catalog's anchors or one of its honest adjectives.
//
// THE PARAGRAPH THAT STOOD HERE UNTIL 2026-09-01, kept because the reason it
// gives is still the reason SUBJ.bare exists: "six verbs, a subject tree that
// goes all the way down (the record, a chair, a chair's own components, the
// mix), and a descriptor that is either one of the catalog's 122 anchors or
// one of its honest adjectives. Two of the six verbs take no descriptor at
// all, so a two-tap sentence has to read as English too — 'less the crash'
// does not, 'less crash' does, and the SUBJECT's word is spelled per verb for
// exactly that reason (SUBJ.bare)." There is no two-tap sentence any more, and
// no printed sentence splices `bare` in: it is a routing token.
//
// THE MECHANISM is a deterministic VECTOR STEP in genre space, scoped to a
// subsystem. No model call, no parser, instant, offline, and the same taps
// always make the same record. What was borrowed from the parent's
// engine/genre-kernel.js, and what was deliberately NOT:
//
//   BORROWED  the scalar lerp (resolveMulti's wRange, :860) — a numeric field
//             moves proportionally toward the target.
//   BORROWED  "a parent missing a key sits out; the weights renormalize over
//             the ones that have it" (:890). A target with no opinion about a
//             field causes NO MOVE, never a move to undefined. 45 of the 122
//             anchors have no `bassStyle`; "make the bass gregorian" must
//             leave the line alone rather than erase it.
//   BORROWED  dimension-GROUP coherence (:913-918): fields that must cohere
//             move together. {drumkit, hand, humanize, touch} is one group —
//             a 909 played by a session drummer with a loose hand is not a
//             thing, it is two half-moves.
//   REJECTED  side() (:857-859), which picks noun fields by WEIGHTED RANDOM
//             DRAW. That is right for a catalog blend and wrong here: it is
//             non-monotone in the weight, so tapping MORE twice could land
//             FURTHER from the target than once, and undo would not be undo.
//             Noun fields switch at a THRESHOLD instead.
//
// THE THRESHOLDS ARE STAGGERED (NOUN_TH below), ordered by the cost of being
// wrong, so the walk has a slope instead of a cliff and each of the first
// four taps changes something different.
//
// DEPTH IS ASYMPTOTIC AND NEVER ARRIVES: w' = 1 - (1-w)(1-ALPHA). The first
// press is 40%, then 64, 78, 87, 92 — recognisable in two or three taps, no
// overshoot BY CONSTRUCTION (a convex combination cannot leave [v0, target]),
// and LESS is the exact algebraic inverse, so one MINUS off the first press
// puts the record back bit for bit. Arriving was rejected on purpose: 100%
// of the way to punk is punk, and a record that can be spent in one word is
// not a record you are producing.
(function (root, factory) {
  const api = factory(
    typeof require !== "undefined" ? require("./kernel.js") : root.NuKernel,
    typeof require !== "undefined" ? require("./genres.js") : root.NuGenres,
    typeof require !== "undefined" ? require("./fields.js") : root.NuFields,
    typeof require !== "undefined" ? require("./bass-kit.js") : root.NuBass,
    typeof require !== "undefined" ? require("./atlas.js") : root.NuAtlas);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuProducer = api;
})(typeof self !== "undefined" ? self : this, function (K, NG, F, B, A) {
  "use strict";

  const GENRES = NG.GENRES;

  /* ===== THE WORDS THIS FILE PRINTS COME FROM THE CATALOGUE ==============
     TABLE.md §12b: every string the page prints lives in one keyed table,
     nukernel/src/copy/ -> the committed nukernel/ui/copy.js, read by
     `t(key, {name, n})`. This is a CLASSIC SCRIPT — it runs before any module
     — so the catalogue is asked for a sentence AT THE MOMENT IT IS PRINTED
     and never at load time; index.html loads ui/copy.js ahead of anything
     that draws, and a node gate that has not stood the module tier up gets
     the KEY back rather than a throw.

     THE REFUSALS ARE SHARED WITH ui/produce.js, BY KEY. The page greys a word
     before it is said and `speak` below refuses it after; the two used to
     stay identical by having the same sentence typed into both files (and
     they drifted — the page's `notplaying` and this file's were two copies of
     the same regex-driven subject-verb agreement). One key, read twice. */
  const TXT = { t: (k, p) => { const C = (typeof globalThis !== "undefined" &&
                                          globalThis.COPY) || null;
                               return C && C.t ? C.t(k, p) : k; } };

  /* THE GENRES ARE OFFERED IN TIME ORDER, NOT IN FILE ORDER (2026-08-31).
     Paul: "in producer mode list the genres in the same chronological order as
     in the 'where/when' list. right now they're just a big messy dropdown."
     They were `Object.keys(GENRES)` — the order rows happen to sit in
     genres.js, which is the order they were WRITTEN in over a dozen rounds and
     means nothing to a reader.

     THE ORDER IS THE ATLAS'S OWN AND IS NOT RE-DERIVED HERE. ui/atlas.js says
     it plainly of the where/when list: the rows are "in `ALL`'s order — which
     is atlas.js's own sort (year ascending, then place, then key) and is
     DERIVED there rather than re-sorted ... sorting it two ways is how a gate
     and a page stop agreeing." So this reads that same array and takes a rank
     off it. Two lists, one sort.

     ANYTHING THE ATLAS DOES NOT PLACE STILL SHIPS, after the dated rows and in
     its own order — a genre with no dot is not a genre with no sound, and
     silently dropping it from the producer would be a refusal nobody asked
     for. */
  const GENRE_KEYS = (() => {
    const keys = Object.keys(GENRES);
    const all = (A && A.ALL) || [];
    if (!all.length) return keys;                    // no atlas: the old order
    const rank = new Map();
    all.forEach((r, i) => rank.set(r.gk, i));
    const dated = keys.filter((k) => rank.has(k)).sort((a, b) => rank.get(a) - rank.get(b));
    return dated.concat(keys.filter((k) => !rank.has(k)));
  })();
  const { KITOPS, LANES } = K;
  const KITLABEL = F.KITLABEL;

  /* ================= THE LADDER ==========================================
     One constant. ALPHA is how far each press closes the remaining gap. */
  const ALPHA = 0.4;
  const START = 0.4;                       // ...and the first press IS one step
  // TEN THINGS. It was six — "I'm allowed to say five or six things" — and
  // Paul asked for ten (2026-08-22). The number is a legibility budget, not a
  // musical law: the stack is a list you read, and a list you cannot hold in
  // your head is a list you stop trusting. Ten still reads, and saying the
  // same thing again is a PUSH rather than an eleventh line, so the ceiling is
  // reached far less often than the count suggests.
  const MAXNOTES = 10;
  const up   = (w) => 1 - (1 - w) * (1 - ALPHA);
  const down = (w) => { const v = 1 - (1 - w) / (1 - ALPHA);
                        return v < 0.005 ? 0 : v; };
  const pct  = (w) => Math.round(w * 100);

  /* ================= THE VERB ============================================
     ONE, and it is `make`. Paul, 2026-09-01 (COMPOSER.md §1 B12): *"The only
     verb is 'make' from now on. Make X Y. The implementation is good but the
     design is confusing and feels unconsidered."*

     THE SIX-VERB TABLE STOOD HERE AND IS RETIRED THE SAME DAY. It read, and
     the `says` lines are kept because four of them are now a quality's job:

       { id: "make",  w: "make",      d: "need",
         says: "change what it IS — toward a record, or toward a word" },
       { id: "more",  w: "more",      d: "no",
         says: "more of it: louder, and more of what it already plays" },
       { id: "less",  w: "less",      d: "no",
         says: "less of it — quieter, thinner, but still there" },
       { id: "add",   w: "add",       d: "may",
         says: "bring in something that is not playing" },
       { id: "away",  w: "take away", d: "no",
         says: "out. All the way out, if you keep pressing" },
       { id: "only",  w: "keep only", d: "no",
         says: "everything else steps back, and you hear what the record is about" },

     NOT ONE OF THE FIVE BEHAVIOURS IS LOST. Each became a QUALITY — a word in
     ADJ with a mechanism hook — and that is the whole gain of the collapse: a
     quality can be pushed, pulled back, greyed with its reason and read in a
     sentence, none of which a verb could do.

       more      -> `louder`   the ±7 dB fader path and dens +1 (the five rows
                    at the foot of ADJ; applyAdj's own hooks are marked :GONE)
       less      -> `quieter`  the same, sign flipped
       take away -> `gone`     silence(), behind the same livesIn guard
       add       -> `back in`  bringIn(), for a player who is OUT ...and the
                    BARE tap (`d === null`, "just add it") for a LANE the
                    record has never had. The verb carried both halves at
                    once; each half has one owner now.
       keep only -> `alone`    the complementary scope (ADJ `scope: "others"`)

     `d` stays on the row and stays "need": every sentence has a descriptor
     slot, and the bare tap is a descriptor that spells itself null. */
  const VERBS = [
    // `says` HOLDS A CATALOGUE KEY, NOT A SENTENCE. A classic script may carry
    // a key as data and must not call `COPY.t` at load time (TABLE.md §12b);
    // whoever draws this row prints `TXT.t(v.says)`.
    { id: "make",  w: "make",      d: "need",
      says: "produce.makeSay" },
  ];
  const VERB = {}; for (const v of VERBS) VERB[v.id] = v;

  /* ================= THE ONE ALIAS DOOR (2026-09-01) =====================
     A saved record from before today carries `{v:"more"|"less"|"add"|"away"|
     "only"}` in `doc.produce`, and every one of them still has a sentence in
     the new grammar. They are FOLDED ON READ, at this one door, and written
     back folded the first time the stack is touched — the genre-only rename's
     own precedent (nukernel/document.js OLDKEYS, nukernel/song.js migrate):
     TWO DOORS AT MOST, never a third copy of the map. This is door one;
     ui/produce.js reads its notes through `Prod.run`/`Prod.notesOf` and so
     needs none of its own.

     `add` keeps its descriptor: "add the crash, punk" becomes "make the drums
     punk" (the anchor is the same anchor), and a bare `add` stays bare. */
  const OLDVERB = { more: "louder", less: "quieter", away: "gone", only: "alone" };
  const foldNote = (n) => {
    if (!n || VERB[n.v]) return n;
    const q = OLDVERB[n.v];
    if (q) return { ...n, v: "make", d: q };
    if (n.v === "add") return { ...n, v: "make" };   // d stays; null is the bare tap
    return n;                                        // a verb from nowhere: left alone
  };
  // ...and the list keeps its IDENTITY when there is nothing to fold, because
  // the offering memoizes on `sig(model, secs)` and `run` returns `secs0` BY
  // REFERENCE when the stack is empty. A fresh array per read is several
  // hundred stack runs per redraw (the STANDING law at :299).
  const foldNotes = (list) =>
    (list.some((n) => n && !VERB[n.v]) ? list.map(foldNote) : list);

  /* ================= THE SUBJECTS ========================================
     THE WHOLE TREE. The record, each chair, each chair's own components, and
     the mix. `w` is the noun the sentence says ("the drums"); `bare` is the
     offering's own routing token. `chan` is the desk address (audio/desk.js
     speaks three kinds: a part chan, a UNIT chan, an instrument chan) and
     `lane` is the kit letter or letters this subject owns.

     `w` IS WRITTEN AS A CATALOGUE KEY AND READ AS A WORD. This table is built
     at LOAD time and a classic script may not call `COPY.t` there (TABLE.md
     §12b), so the key is what the literal holds and the getter installed under
     the table is what asks the catalogue — at the moment the word is printed,
     which is the law. Every existing reader (`S.w`, `SUB[id].w`, `chanWord`,
     ui/produce.js's cast chips) is unchanged and still gets a string. */
  const SUBJ = [
    { id: "record", w: "produce.subj.record",   bare: "of everything", under: null,
      chan: [], master: true, kind: "record" },
    { id: "drums",  w: "produce.subj.drums",   bare: "drums",   under: null, chan: ["drums"],
      lane: ["k","s","h","o","f","c","p","t","m","l","r","x"], kind: "chair" },
    { id: "kick",   w: "produce.subj.kick",    bare: "kick",    under: "drums",
      chan: ["unit:kick"],  lane: ["k"] },
    { id: "snare",  w: "produce.subj.snare",   bare: "snare",   under: "drums",
      chan: ["unit:snare"], lane: ["s"] },
    { id: "hats",   w: "produce.subj.hats",    bare: "hats",    under: "drums",
      chan: ["unit:hat"],   lane: ["h","o","f"] },
    { id: "toms",   w: "produce.subj.toms",    bare: "toms",    under: "drums",
      chan: ["unit:tom"],   lane: ["t","m","l"] },
    { id: "cymbals",w: "produce.subj.cymbals", bare: "cymbals", under: "drums",
      chan: ["unit:crash","unit:ride"], lane: ["x","r"] },
    { id: "perc",   w: "produce.subj.perc", bare: "percussion", under: "drums",
      chan: ["unit:clap","unit:rim"],   lane: ["c","p"] },
    { id: "bass",   w: "produce.subj.bass",    bare: "bass",    under: null,
      chan: ["bass"], kind: "chair" },
    { id: "line",   w: "produce.subj.line", bare: "bass line", under: "bass", chan: [] },
    { id: "bamp",   w: "produce.subj.bamp", bare: "bass sound", under: "bass", chan: [] },
    { id: "keys",   w: "produce.subj.keys",    bare: "keys",    under: null,
      chan: ["inst:keys","inst:pads"], kind: "chair" },
    { id: "guitar", w: "produce.subj.guitar",  bare: "guitar",  under: null,
      chan: ["inst:guitar"], kind: "chair" },
    { id: "amp",    w: "produce.subj.amp",     bare: "amp",     under: "guitar", chan: [] },
    { id: "voice",  w: "produce.subj.voice",   bare: "voice",   under: null,
      chan: ["vocals"], kind: "chair" },
    { id: "tune",   w: "produce.subj.tune",    bare: "tune",    under: null,
      chan: ["lead"], kind: "chair" },
    { id: "mix",    w: "produce.subj.mix",     bare: "mix",     under: null,
      chan: [], master: true, kind: "mix" },
  ];
  /* ...AND HERE IS THE GETTER. One loop, so the seventeen rows above stay a
     table a person can read down, and so nothing asks the catalogue before the
     page has one. `enumerable` keeps a spread of a row spelling the word. */
  for (const r of SUBJ) { const k = r.w;
    Object.defineProperty(r, "w", { enumerable: true, configurable: true,
                                    get: () => TXT.t(k) }); }
  const SUB = {}; for (const s of SUBJ) SUB[s.id] = s;
  /* WHICH VERBS A SUBJECT TAKES — RETIRED 2026-09-01 with the five verbs, and
     the table is kept here because its four reasons are not retired at all.
     It read:

       const VERBSOF = { record: ["make", "more", "less"],
                         mix:    ["make", "more", "less"],
                         bamp:   ["make"], amp: ["make"],
                         line:   ["make", "more", "less"] };

     A verb×subject matrix with one verb says nothing. THE SAME FACTS ARE NOW
     QUALITY×SUBJECT, which is what `ADJ.on` has always been — one table
     instead of two — and they are EXTRACTED into `A_LEVEL` and `A_INOUT`
     beside the adjectives rather than retyped:
       the sound / the mix   are not things you add, remove or keep only —
                             "keep only the sound" is keep only everything
       the bass sound, the amp   have no LEVEL: an amp is a CHARACTER, not an
                             amount, and there is no fader of its own to move
       the bass line         is what the bass plays, not a thing that can be
                             added or taken away — that is `the bass`
     `takes` stays exported (ui/produce.js:571, test/producer-eight.test.js
     :242 both ask it) and now answers the only question left: is this a verb
     this box says, about a subject this record has? */
  const takes = (verb, sid) => !!(VERB[verb] && SUB[sid]);

  /* ================= THE FIELD LAW =======================================
     One row per kernel field the producer may touch, saying HOW it moves.
     Anything not in here is not the producer's business — and four things
     are named as forbidden rather than merely absent, because they are the
     ones somebody would reach for:

       plan / meter / bars / voices / family / label   the record's frame.
           A producer does not re-count the bar.
       roots / prog / key / mode-as-harmony            the ARRANGER's.
           "Make the drums punk" must not rewrite your changes.
       kitProb                                         the drummer already
           has a question for it ("does every hat land?").
       kits (the per-bar SCHEDULE)                     the drummer's own, and
           it is where "one hit every four bars" lives — so the schedule is
           preserved and each bar's GRID is moved inside it, rather than the
           schedule being switched wholesale.

     `kind`: num (lerp) · obj (lerp every numeric key) · noun (switch at
     NOUN_TH) · grid (the ordered hit budget). */
  const NOUN_TH = {
    // cheap to be wrong about — these move on the FIRST press
    artic: 0.35, bassArtic: 0.35, diatonic: 0.35, nobass: 0.35,
    fifths: 0.35, pad: 0.35, comping: 0.35,
    // the casting decisions — the second press
    bassStyle: 0.50, instr: 0.50, bassFig: 0.50, wave: 0.50,
    // whose hands these are — the third
    drumkit: 0.65, hand: 0.65, scale: 0.65, fill: 0.65, part: 0.65,
    // and the one that is nearly a different record — the fourth
    harmony: 0.80, pipes: 0.80,
  };
  const NUM = {
    stress:   { lo: 0, hi: 1 },
    phrase:   { lo: 0, hi: 1 },
    maxHold:  { lo: 0, hi: 16, int: true },
    humanize: { lo: 0, hi: 1 },
    bassNudge:{ lo: -4, hi: 4 },
    bassReg:  { lo: -2, hi: 2, int: true },
    // A TEMPO IS TOO STRONG A LEVER TO HAND A LERP. One press toward punk
    // from 96 bpm is +25.6 — a whole catalog standard deviation, from one
    // word about the drums. So bpm moves at most CAP of itself per press,
    // whatever the press is worth everywhere else.
    bpm:      { lo: 40, hi: 220, int: true, cap: 0.08 },
  };
  const OBJ = { touch: ["t","v"],
                orn: ["grace","approach","pass","roll","flam","drag"],
                kitVel: null, tone: null, bassTone: null };
  // WHAT MUST COHERE. The parent draws one parent per dimension GROUP so a
  // vox recipe and its source pool can never come from different genres;
  // here it is the same idea with a threshold instead of a draw — every
  // field in a group crosses at the group's own threshold, together.
  const GROUPS = [["drumkit","hand","humanize","touch"], ["scale","diatonic"]];
  const groupTh = (f) => { for (const g of GROUPS) if (g.includes(f))
      return Math.max(...g.map((x) => NOUN_TH[x] || 0)) || 0.65; return null; };

  /* ================= WHAT EACH SUBJECT OWNS ==============================
     scope -> the fields it may move, and where each one's target value comes
     from on an anchor. A field whose anchor value is undefined SITS OUT. */
  const FAM = {
    keys:  /rhodes|_ep|electric_piano|clavinet|piano|organ|harpsichord|pad|polysynth|saw_wave|square_lead|strings|celesta|vibra|marimba|music_box|harp|kalimba|dulcimer|bowed_glass|halo|metal_pad|accordion|bandoneon/,
    guitar:/guitar|banjo|charang|sitar|mandolin|dulcimer|harmonics/,
    bass:  /bass|cello/,
    voice: /choir|vox|voices|solo_vox|ahh|ohh/,
    tune:  /./,
  };
  const pickInstr = (A, fam) => {
    const list = Array.isArray(A.instr) ? A.instr : (A.instr ? [A.instr] : []);
    const re = FAM[fam];
    for (const id of list) if (re.test(id) && F.INSTRCHOICES[id]) return id;
    return undefined;
  };
  // the genre fields each scope reads off an anchor. Each entry is
  // [path, kind, from(anchor)] where path is dotted into the SECTION.
  // A FOURTH COLUMN, AND IT IS THE DRUMMER'S NAME ON THE ROW. "kit" says this
  // row is a fact about the kit, and it is what the kitless fence reads: on a
  // record the engine gets no drum event from, every one of them sits out,
  // whichever scope pulled it in. Declared here rather than enumerated at the
  // fence, because enumerating doors is how the last one got left open — the
  // grid was fenced and `g.fill` walked straight through it, which is a whole
  // fill of snare, toms and a crash on the last bar of a chamber record
  // (measured: `make the sound rock` put 11 hits on it with every grid row
  // refused).
  const drumsFields = () => [
    ["g.drumkit", "noun", (A) => A.drumkit,  "kit"],
    ["g.hand",    "noun", (A) => A.hand,     "kit"],
    ["g.humanize","num",  (A) => A.humanize, "kit"],
    ["g.touch",   "obj",  (A) => A.touch,    "kit"],
    ["g.stress",  "num",  (A) => A.stress,   "kit"],
    ["g.kitVel",  "obj",  (A) => A.kitVel,   "kit"],
    ["g.fill",    "noun", (A) => A.fill,     "kit"],
  ];
  const laneFields = (lanes) => lanes.flatMap((d) => [
    ["kit." + d, "grid", (A) => (A.kit || {})[d], "kit"],
    ["kit.?" + d, "grid", (A) => (A.kit || {})["?" + d], "kit"],
    ["kit.~" + d, "grid", (A) => (A.kit || {})["~" + d], "kit"],
    ["kit.!" + d, "grid", (A) => (A.kit || {})["!" + d], "kit"],
  ]);
  const bassLine = () => [
    ["g.bassStyle", "noun", (A) => A.bassStyle],
    ["g.bassFig",   "noun", (A) => (A.fig && B.FIGURES[A.fig]) || undefined],
    ["g.bassArtic", "noun", (A) => A.artic],
    ["g.bassNudge", "num",  (A) => (A.bassNudge != null ? A.bassNudge : undefined)],
  ];
  const bassAmp = () => [["g.bassTone", "obj", (A) => A.tone]];
  const chairFields = (ix, fam) => [
    ["g.chairs." + ix + ".instr", "noun", (A) => pickInstr(A, fam)],
    ["g.chairs." + ix + ".tone",  "obj",  (A) => A.tone],
  ];
  const SCOPEFIELDS = {
    drums:  () => [...drumsFields(), ...laneFields(SUB.drums.lane)],
    kick:   () => laneFields(["k"]),
    snare:  () => laneFields(["s"]),
    hats:   () => laneFields(["h","o","f"]),
    toms:   () => laneFields(["t","m","l"]),
    cymbals:() => laneFields(["x","r"]),
    perc:   () => laneFields(["c","p"]),
    bass:   () => [...bassLine(), ...bassAmp()],
    line:   () => bassLine(),
    bamp:   () => bassAmp(),
    keys:   () => [...chairFields(0, "keys"),
                   ["g.tone",    "obj",  (A) => A.tone],
                   ["g.maxHold", "num",  (A) => A.maxHold],
                   ["g.phrase",  "num",  (A) => A.phrase]],
    guitar: () => [...chairFields(1, "guitar"),
                   ["g.orn",   "obj",  (A) => A.orn],
                   ["g.artic", "noun", (A) => A.artic]],
    amp:    () => [["g.chairs.1.tone", "obj", (A) => A.tone]],
    voice:  () => [["voice.instr", "noun", (A) => pickInstr(A, "voice")],
                   ["voice.tone",  "obj",  (A) => A.tone]],
    tune:   () => [["mel.instr", "noun", (A) => pickInstr(A, "tune")],
                   ["mel.tone",  "obj",  (A) => A.tone],
                   ["g.scale",   "noun", (A) => A.scale],
                   ["g.diatonic","noun", (A) => A.diatonic]],
    mix:    () => [],
    record: () => [...SCOPEFIELDS.drums(), ...SCOPEFIELDS.bass(),
                   ...SCOPEFIELDS.keys(), ...SCOPEFIELDS.guitar(),
                   ...SCOPEFIELDS.tune(), ...SCOPEFIELDS.voice(),
                   ["g.artic", "noun", (A) => A.artic],
                   ["song.bpm","num",  (A) => A.bpm]],
  };

  /* ================= THE GRID, AND THE ONE STRUCTURE THAT INTERPOLATES ====
     Every other structure in the kernel switches: a progression, a bass
     figure, a mode is a thing you are playing or a thing you are not. A
     DRUM GRID is the exception, because a drummer really does open the hats
     a bit — and the honest interpolation is not a per-step lerp (which on a
     0..9 level vector is just a threshold at 50% wearing arithmetic) but an
     ORDERED HIT BUDGET: of the steps where the record and the target
     disagree, w of them move, spent in the order a drummer would hear them.

     Monotone by construction — the set of moved steps at .64 is a SUPERSET
     of the set at .40 — which is exactly what makes a note removable back to
     byte-identical, and what makes every intermediate a real pattern
     anchored on the strong beats rather than a random half of one. */
  const PRIORITY = [0, 4, 12, 8, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15];
  const CREATE_TH = 0.5;                  // a lane the record does not have
  const DELETE_TH = 0.8;                  // ...and one it has. 25 of the 122
                                          // anchors carry an empty kit, so
                                          // "toward gregorian" thins long
                                          // before it deletes.
  const hits = (v) => (v || []).reduce((n, x) => n + (x ? 1 : 0), 0);
  function gridMove(cur, tgt, w) {
    // both absent: nothing to say
    if (!cur && !tgt) return { v: cur, moved: 0 };
    if (!tgt) {                                     // the target has no lane
      if (!cur || w < DELETE_TH) return { v: cur, moved: 0 };
      return { v: null, moved: hits(cur) };         // ...and we are deep enough
    }
    if (!cur) {                                     // the record has no lane
      if (w < CREATE_TH) return { v: cur, moved: 0 };
      cur = new Array(tgt.length).fill(0);
    }
    if (cur.length !== tgt.length) return { v: cur, moved: 0 };
    const diff = PRIORITY.filter((i) => i < cur.length && cur[i] !== tgt[i]);
    const rest = [];
    for (let i = 0; i < cur.length; i++)
      if (!PRIORITY.includes(i) && cur[i] !== tgt[i]) rest.push(i);
    const order = [...diff, ...rest];
    const budget = Math.round(w * order.length);
    if (!budget) return { v: cur, moved: 0 };
    const out = cur.slice();
    for (let n = 0; n < budget; n++) out[order[n]] = tgt[order[n]];
    // LEVELS LERP INSIDE SHARED STEPS: where both play, how hard is a
    // number and numbers lerp.
    for (let i = 0; i < out.length; i++)
      if (cur[i] && tgt[i] && cur[i] !== tgt[i] && out[i] === cur[i])
        out[i] = Math.round(cur[i] + (tgt[i] - cur[i]) * w);
    return { v: out, moved: budget };
  }

  /* ================= THE ADJECTIVES ======================================
     A genre descriptor is a lerp toward an anchor. An ADJECTIVE is a direct
     move on the fields it names — and the minus direction is as rich as the
     plus, on purpose (`dirtier`/`cleaner`, `wetter`/`drier`, `busier`/
     `sparser`), because subtraction is the half of production that has no
     knob on a desk.

     Each row: which scopes it is honest for, and what it does at strength w.
     `mix` entries are desk offsets (they ADD, the way two hands on a board
     would); `g` entries are genre moves. */
  const A_ALL = ["record","drums","kick","snare","hats","toms","cymbals","perc",
                 "bass","line","bamp","keys","guitar","amp","voice","tune","mix"];
  const A_KIT = ["drums","kick","snare","hats","toms","cymbals","perc","record"];
  const A_PITCH = ["bass","line","bamp","keys","guitar","amp","voice","tune","record"];
  /* ...AND THE TWO LISTS THE RETIRED VERBS LEFT BEHIND (2026-09-01), DERIVED
     from A_ALL rather than retyped, each carrying one of VERBSOF's own reasons
     (:157). A_LEVEL is everything with a level to move — the amp and the bass
     sound have none, they are a character. A_INOUT is everything that PLAYS —
     the sound and the mix are treatments, and the bass line is what the bass
     plays rather than a thing you bring in or take out. */
  const A_LEVEL = A_ALL.filter((id) => id !== "bamp" && id !== "amp");
  const A_INOUT = A_ALL.filter((id) =>
    !["record", "mix", "bamp", "amp", "line"].includes(id));
  const ADJ = [
    { id: "brighter", w: "brighter", on: A_ALL, said: "opened the top up",
      mix: (w) => ({ eq: { hi: +6 * w, lo: -1 * w } }),
      tone: (w, t) => ({ cut: (t.cut || 1200) * (1 + 1.2 * w) }) },
    { id: "darker",   w: "darker",   on: A_ALL, said: "took the top off it",
      mix: (w) => ({ eq: { hi: -6 * w, lo: +2 * w } }),
      tone: (w, t) => ({ cut: (t.cut || 1200) * (1 - 0.55 * w) }) },
    { id: "drier",    w: "drier",    on: A_ALL, said: "dried it out",
      mix: (w) => ({ rev: -0.5 * w, del: -0.4 * w }),
      master: (w) => ({ space: -0.4 * w }) },
    { id: "wetter",   w: "wetter",   on: A_ALL, said: "put it in a room",
      mix: (w) => ({ rev: +0.45 * w, del: +0.18 * w }),
      master: (w) => ({ space: +0.35 * w }) },
    { id: "dirtier",  w: "dirtier",  on: A_PITCH.concat(["mix"]), said: "dirtied it up",
      master: (w) => ({ drive: +0.45 * w }),
      tone: (w, t) => ({ q: Math.min(12, (t.q || 2) * (1 + w)) }),
      cast: { guitar: ["overdrive_guitar","distortion_guitar"] } },
    { id: "cleaner",  w: "cleaner",  on: A_PITCH.concat(["mix"]), said: "cleaned it up",
      master: (w) => ({ drive: -0.45 * w }),
      tone: (w, t) => ({ q: Math.max(0.5, (t.q || 2) * (1 - 0.5 * w)) }),
      cast: { guitar: ["clean_guitar","jazz_guitar"] } },
    { id: "busier",   w: "busier",   on: A_KIT.concat(["bass","line"]), said: "filled it in",
      dens: +1 },
    { id: "sparser",  w: "sparser",  on: A_KIT.concat(["bass","line"]), said: "opened it out",
      dens: -1 },
    { id: "harder",   w: "harder",   on: A_KIT.concat(["record","bass"]), said: "hit it harder",
      g: (w) => ({ stress: { to: 0.85, w }, "touch.v": { to: 1.35, w } }),
      mix: (w) => ({ fader: +3 * w }) },
    { id: "softer",   w: "softer",   on: A_KIT.concat(["record","bass"]), said: "eased off it",
      g: (w) => ({ stress: { to: 0.05, w }, "touch.v": { to: 0.7, w } }),
      mix: (w) => ({ fader: -3 * w }) },
    { id: "looser",   w: "looser",   on: A_KIT.concat(["record"]), said: "let the hand breathe",
      g: (w) => ({ humanize: { to: 0.55, w }, "touch.t": { to: 0.06, w } }),
      noun: (w) => (w >= 0.65 ? { hand: "loose" } : null) },
    { id: "tighter",  w: "tighter",  on: A_KIT.concat(["record"]), said: "tightened it up",
      g: (w) => ({ humanize: { to: 0, w }, "touch.t": { to: 0, w } }),
      noun: (w) => (w >= 0.65 ? { hand: "exact" } : null) },
    { id: "longer",   w: "let it ring", on: A_PITCH, said: "let it ring",
      g: (w) => ({ maxHold: { to: 0, w } }),
      noun: (w) => (w >= 0.35 ? { artic: "legato" } : null) },
    { id: "shorter",  w: "shorter",  on: A_PITCH, said: "shortened everything",
      g: (w) => ({ maxHold: { to: 2, w } }),
      noun: (w) => (w >= 0.35 ? { artic: "staccato" } : null) },
    { id: "higher",   w: "higher",   on: ["bass","line","keys","guitar","voice","tune"], said: "took it up an octave",
      reg: +1 },
    { id: "lower",    w: "lower",    on: ["bass","line","keys","guitar","voice","tune"], said: "took it down an octave",
      reg: -1 },
    { id: "bigger",   w: "bigger",   on: ["record","mix","drums","voice"], said: "opened the room up",
      master: (w) => ({ space: +0.4 * w, glue: +0.25 * w }),
      mix: (w) => ({ rev: +0.3 * w }) },
    { id: "smaller",  w: "smaller",  on: ["record","mix","drums","voice"], said: "closed the room down",
      master: (w) => ({ space: -0.4 * w }),
      mix: (w) => ({ rev: -0.35 * w, eq: { lo: -3 * w } }) },
    { id: "fatter",   w: "fatter",   on: A_ALL, said: "put weight under it",
      mix: (w) => ({ eq: { lo: +5 * w, mid: +1 * w }, fader: +1.5 * w }) },
    { id: "thinner",  w: "thinner",  on: A_ALL, said: "thinned it out",
      mix: (w) => ({ eq: { lo: -5 * w }, fader: -1.5 * w }) },
    { id: "faster",   w: "faster",   on: ["record"], said: "picked the tempo up", bpm: +1 },
    { id: "slower",   w: "slower",   on: ["record"], said: "eased the tempo back", bpm: -1 },
    // TAPE, GLUE, and the two words an engineer says about the whole thing
    // WORDS THE RACK CAN REACH. "Make the guitar thrash" is Paul's own
    // example and `thrash` is not an anchor — it is a sound, and this box
    // casts a sound as an INSTRUMENT (guitar-kit: the dirt is the recording,
    // not a knob). So these four are adjectives that cast, and each one also
    // says the two things that make it that sound and not just that patch.
    { id: "thrash",   w: "thrash",   on: ["guitar","amp","record"], said: "downpicked fifths, palm muted",
      cast: { guitar: ["palm_muted_guitar","distortion_guitar"] },
      chair: (w) => (w >= 0.35 ? { fifths: true } : null),
      master: (w) => ({ drive: +0.35 * w }),
      noun: (w) => (w >= 0.35 ? { artic: "staccato" } : null) },
    { id: "fuzzy",    w: "fuzzy",    on: ["guitar","amp","record"], said: "put it through a fuzz",
      cast: { guitar: ["distortion_guitar","overdrive_guitar"] },
      master: (w) => ({ drive: +0.5 * w }) },
    { id: "chugging", w: "chugging", on: ["guitar","amp"], said: "palm-muted eighths, down low",
      cast: { guitar: ["palm_muted_guitar","crunch_guitar"] },
      chair: (w) => (w >= 0.5 ? { fifths: true } : null) },
    { id: "jangly",   w: "jangly",   on: ["guitar","amp"], said: "clean and ringing",
      cast: { guitar: ["clean_guitar","steel_string_guitar"] },
      mix: (w) => ({ eq: { hi: +4 * w } }),
      noun: (w) => (w >= 0.35 ? { artic: "legato" } : null) },
    { id: "warmer",   w: "warmer",   on: ["record","mix"], said: "ran it to tape",
      master: (w) => ({ tape: +0.5 * w }), },
    { id: "pumping",  w: "pumping",  on: ["record","mix"], said: "squeezed it",
      master: (w) => ({ glue: +0.6 * w }) },
    /* ---- THE FIVE QUALITIES THE FIVE RETIRED VERBS BECAME (2026-09-01) ----
       Paul: "The only verb is 'make' from now on. Make X Y." Each row carries
       the verb's mechanism UNCHANGED, behind a hook applyAdj reads (the three
       structural ones are marked :GONE there) — the arithmetic did not move,
       only the word it hangs off. Three of them are structure rather than
       colour, and each keeps the guard its verb carried: you cannot take out,
       or keep only, or bring back, a thing this record does not have. */
    { id: "louder",  w: "louder",  on: A_LEVEL, said: "brought it up",
      mix: (w) => ({ fader: +7 * w }), master: (w) => ({ glue: +0.2 * w }),
      dens: +1 },
    { id: "quieter", w: "quieter", on: A_LEVEL, said: "pulled it down",
      mix: (w) => ({ fader: -7 * w }), master: (w) => ({ glue: -0.2 * w }),
      dens: -1 },
    { id: "gone",    w: "gone",    on: A_INOUT, said: "took it out",
      gone: true },
    // ...and `back in` is an ordinary word in the word sheet, greyed with its
    // reason on a record where nothing is out — which is where it belongs, and
    // not in the bare sheet beside "just add it". A vocabulary you can SEE
    // greyed is a vocabulary you learn (the no-silent-grey law's other half);
    // a word that only appears once the record is in a particular state is one
    // nobody ever finds. It shares `bringIn` with the bare tap the way `gone`
    // and `alone` share `silence()`: one function, two doors.
    { id: "back",    w: "back in", on: A_INOUT, said: "brought it back in",
      bring: true },
    { id: "alone",   w: "alone",   on: A_INOUT, said: "everything else stepped back",
      scope: "others" },
  ];
  const ADJOF = {}; for (const a of ADJ) ADJOF[a.id] = a;
  // WHICH ADJECTIVE FAMILY A SUBJECT INHERITS. Every `on` list above names
  // band-kit's own seven chair ids, so a cast built from a document's voices
  // (ui/produce.js) matched NOTHING and every adjective was silently
  // unavailable on every voice of every eight-axes record. A row may declare
  // `as` — "read my adjectives as the keys'/the guitar's/the voice's" — and a
  // row that does not is read as itself, which is every row in this file.
  const asOf = (sid) => (SUB[sid] && SUB[sid].as) || sid;

  /* the density ladder the bass walks when somebody says "busier" */
  const DENS = ["pedal", "fifths", "octaves", "walk", "eighths", "sixteenths"];
  /* ...and what a lane plays when you ADD one that is not there. These are
     the record's own idiom for that drum, not a genre's — "add a crash" is a
     request, and the only honest answer to it is the crash everybody plays. */
  const ADDPAT = {
    k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    o: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
    f: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    c: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    p: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    t: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
    m: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
    l: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
    r: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    x: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  };

  /* ================= THE CATALOG'S OWN SPREAD ============================
     epsilon is half a catalog standard deviation, per field, measured once
     from the 122 anchors that ship. It is used for exactly two things and
     they are the same question: whether a target is worth OFFERING for this
     record, and whether a note that landed actually moved anything ("it's as
     punk as it's going to get"). One constant, one law. */
  let SD = null;
  function sdOf() {
    if (SD) return SD;
    SD = {};
    for (const f of Object.keys(NUM)) {
      const xs = [];
      for (const A of Object.values(GENRES)) if (typeof A[f] === "number") xs.push(A[f]);
      if (xs.length < 2) { SD[f] = 0.1; continue; }
      const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
      SD[f] = Math.sqrt(xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / xs.length);
    }
    return SD;
  }
  const EPS_STEPS = 8;                     // ...or eight moved sixteenths

  /* ================= READING AND WRITING A SECTION =======================
     The section object toSong hands back, addressed by the dotted paths the
     field table uses. Everything is copy-on-write: the genre carries CLOSURES
     (reg/realize/part read the chairs array) so a copied chairs array needs
     its readers rebound, which `touchChairs` does exactly once per section. */
  const num = (x) => typeof x === "number" && isFinite(x);
  const clone = (sec) => ({ ...sec, __dirty: false });

  function gOf(sec, which) {
    return which === "mel" ? (sec.melody && sec.melody.genre)
         : which === "voice" ? (sec.voice && sec.voice.genre)
         : sec.genre;
  }
  function ownGenre(sec, which) {
    if (which === "mel") {
      if (!sec.melody) return null;
      sec.melody = { ...sec.melody, genre: { ...sec.melody.genre } };
      return sec.melody.genre;
    }
    if (which === "voice") {
      if (!sec.voice) return null;
      sec.voice = { ...sec.voice, genre: { ...sec.voice.genre } };
      return sec.voice.genre;
    }
    if (!sec.__ownG) { sec.genre = { ...sec.genre }; sec.__ownG = true; }
    return sec.genre;
  }
  function touchChairs(sec) {
    const g = ownGenre(sec, "g");
    if (sec.__ownC) return g.chairs;
    const ch = (g.chairs || []).map((c) => ({ ...c, tone: { ...(c.tone || {}) } }));
    g.chairs = ch; sec.__ownC = true;
    // the closures band-kit wrote read the ORIGINAL array — rebind them, or a
    // moved register is a fact nobody hears
    g.reg = (v) => ch[v % ch.length].reg;
    g.realize = (v) => (ch[v % ch.length].pad ? "pad" : "line");
    g.part = (v) => ch[v % ch.length].part;
    g.instr = ch.map((c) => c.instr);
    return ch;
  }
  function touchKit(sec) {
    const g = ownGenre(sec, "g");
    if (sec.__ownK) return;
    const cp = (k) => { const o = {}; for (const [d, v] of Object.entries(k || {}))
      o[d] = Array.isArray(v) ? v.slice() : v; return o; };
    g.kit = cp(g.kit);
    if (Array.isArray(g.kits)) g.kits = g.kits.map(cp);
    sec.__ownK = true;
  }

  /* ================= WHAT IS ACTUALLY ON THIS RECORD =====================
     THE LIVE-CHANNEL LAW — the audibility floor's other half, and the fault
     Paul found on 2026-08-22: "the second producer command didn't do anything
     at all". "Less cymbals" was OFFERED on a record whose kit has no crash
     and no ride, it landed, and the sheet said "pulled the cymbals down",
     because a fader written to `unit:crash` counted as a move. It is not one:
     audio/desk.js resolves an offset against the units the record actually
     builds (it walks the roster and asks MIXER for each unit's own chans), so
     an offset addressed at a unit that does not exist lands on nothing at all.
     `moved(d)` was reading the producer's own bookkeeping rather than the
     record, and because subjectsFor asks `moved(d)` the same question, the
     offering agreed with itself all the way down.

     So the desk only has faders for what is PLAYING — and there are THREE
     ways for a channel to be dead, all of them found by measuring the same
     four records the gate walks:

       A LANE NOBODY HITS.   kit, the per-bar `kits` schedule, the last bar's
           `fill`, plus the `ghost` lane drums() writes itself. THE SCHEDULE
           SHADOWS THE KIT: drums() reads `g.kits ? at(g.kits, b) : g.kit`, so
           on a record that carries a schedule the plain `g.kit` is never
           played and a lane that lives only there is a lane nobody hears.
       A UNIT ITS LANE DOES NOT REACH.  A subject owns lanes AND channels, and
           the two lists are not one list: "the percussion" is the clap AND
           the rim, and a record with a rim and no clap builds `unit:rim`
           only. Asking "is any of my lanes live" and then writing to ALL my
           channels claimed a clap on 21 of 150 rolled records. So the lane
           maps to its own desk address (LANECHAN, which is audio/to-engine's
           LANE table read for its `unit` field) and a channel is live only if
           one of ITS lanes is.
       A CHAIR WITH NOTHING TO PLAY.  This is the one Paul's seven presses
           found. `chairOut` asks whether the chair is switched off — no
           `part`, `nobass`, no voice, no melody — and a keyboard player can
           be perfectly switched ON with an empty phrase in front of them: on
           roll 1 the keys have a seat, an upright piano and a part, and
           K.render of their pattern is zero notes long. A fader on
           `inst:keys` there is the crash all over again. A kit lane can be
           read structurally (a vector of zeros is a drum nobody hits); a
           phrase cannot, because operators are what decide whether it sounds
           — so this one ASKS THE KERNEL, which is allowed because here the
           render IS the subject: the question is literally "does anything
           come out of this chair". It is measured ONCE per compiled record
           and cached on it (soundsOf below), so the offering's several
           hundred probes share one answer.

     The bass is the exception that needs no render: K.bass' own first line is
     `if (g.nobass) return []`, so `chairOut` already answers it exactly.
     A component (the bass line, the amp) is as live as the chair it hangs
     off. */
  // the desk's own address for a lane — audio/to-engine.js LANE, `unit` field,
  // which is the roster key desk.js turns into "unit:<key>". Three hats are
  // one channel and three toms are one channel; the crash and the ride are two.
  const LANECHAN = { k: "unit:kick",  s: "unit:snare", p: "unit:rim",
                     c: "unit:clap",  h: "unit:hat",   o: "unit:hat",
                     f: "unit:hat",   r: "unit:ride",  x: "unit:crash",
                     t: "unit:tom",   m: "unit:tom",   l: "unit:tom" };
  function liveLanes(secs) {
    const on = new Set();
    for (const sec of secs || []) {
      const g = sec && sec.genre; if (!g) continue;
      if (g.ghost) on.add("p");                  // kernel.drums' own ghost lane
      const sched = Array.isArray(g.kits) && g.kits.length ? g.kits : null;
      const bars = Math.max(1, sec.bars | 0);
      for (let b = 0; b < bars; b++) {
        const base = (sched ? K.at(sched, b) : g.kit) || {};
        const bar = (g.fill && b === bars - 1) ? { ...base, ...g.fill } : base;
        for (const [lane, vec] of Object.entries(bar)) {
          if (!LANES[lane]) continue;            // ?chance ~nudge !grace are sidecars
          if (Array.isArray(vec) ? vec.some(Boolean) : vec) on.add(lane);
        }
      }
    }
    return on;
  }
  // WHICH CHAIRS SOUND — asked of the kernel, once per compiled record. The
  // sections are copy-on-write everywhere below, so the array the page hands
  // in is a stable key for the answer and the whole offering pass shares it.
  const SOUNDS = new WeakMap();
  const emits = (f) => { try { const ev = f(); return !!(ev && ev.length); }
                         catch (e) { return true; } };   // a throw is playable()'s
  function soundsOf(secs) {
    if (!Array.isArray(secs)) return new Set(["bass"]);
    let s = SOUNDS.get(secs); if (s) return s;
    s = new Set(["bass"]);                       // K.bass answers from `nobass`
    for (const sec of secs) {
      if (!sec || !sec.genre) continue;
      if (!s.has("keys") && sec.pattern &&
          emits(() => K.render(sec.pattern, sec.genre, sec.bars))) s.add("keys");
      if (!s.has("guitar") && sec.guitar &&
          emits(() => K.render(sec.guitar, sec.genre, sec.bars))) s.add("guitar");
      if (!s.has("voice") && sec.voice &&
          emits(() => K.render(sec.voice.phrase, sec.voice.genre, sec.bars))) s.add("voice");
      if (!s.has("tune") && sec.melody &&
          emits(() => K.render(sec.melody.phrase, sec.melody.genre,
                               sec.melody.genre.bars))) s.add("tune");
    }
    // ...AND A CAST THAT IS NOT BAND-KIT'S ANSWERS FOR ITSELF. The four chairs
    // above are band-kit's own model — `sec.pattern`, `sec.guitar`,
    // `sec.melody`, `sec.voice` — and the eight-axes page has none of them: its
    // record is a list of named voices, and ui/produce.js installs one SUBJ row
    // per voice. Without this line `livesIn` is false for every one of them, so
    // "take away the cantor" answered "the cantor is not playing on this
    // record" WHILE THE RECORD MOVED (measured 2026-08-24, design 04 §7.2). A
    // row that knows whether it sounds says so; a row that does not (every
    // fixed row above) carries no `sounds` and this loop passes it by, which is
    // why the band page is byte-identical.
    for (const S of SUBJ) if (S.sounds && S.sounds(secs)) s.add(S.id);
    SOUNDS.set(secs, s);
    return s;
  }
  // ...and every desk address that resolves to something that plays
  function liveChans(secs, sounds) {
    const lanes = liveLanes(secs);
    const snd = sounds || soundsOf(secs);
    const out = new Set();
    for (const S of SUBJ) {
      if (!S.chan.length) continue;
      if (S.lane) {
        const any = S.lane.some((l) => lanes.has(l));
        for (const c of S.chan) {
          if (c.slice(0, 5) !== "unit:") { if (any) out.add(c); continue; }
          if (S.lane.some((l) => lanes.has(l) && LANECHAN[l] === c)) out.add(c);
        }
      } else {
        const id = S.under || S.id;
        if (!chairOut(secs, id) && snd.has(id)) for (const c of S.chan) out.add(c);
      }
    }
    return out;
  }
  // is there anything for this subject to move on this record at all? Read off
  // the live channels a note is about to be given, so the offering and the
  // mover cannot answer it differently.
  function livesIn(live, secs, S, sounds) {
    if (!S) return false;
    if (S.master) return true;                   // the sound and the mix are always here
    if (S.chan.length) return S.chan.some((c) => live.has(c));
    const id = S.under || S.id;                  // the bass line, the amp
    return !chairOut(secs, id) && sounds.has(id);
  }
  const livesOn = (secs, S) => { const snd = soundsOf(secs);
    return livesIn(liveChans(secs, snd), secs, S, snd); };

  /* ================= A RECORD WITH NO KIT DOES NOT GET ONE ===============
     Paul, 2026-08-23: "sometimes you add drums to the 1800s". It arrived
     through this door too. On a Gregorian chant the producer offered drums /
     kick / snare / hats / toms / percussion under "more of what?" (it dropped
     the guitar correctly), "more drums" reported "opened the kit up (27 steps
     across 9 drums)", and the engine's own bar list went 0 -> 216 drum hits,
     +1.92 dB rms on the live page.

     THE TRAP, and it is why every structural guard missed it: the chant's kit
     is DECLARED — nine lanes, sixteen zeros each — so nothing on the model is
     ever nonzero, and densLane's whole job is to fill the holes in a lane
     that is already there. A guard that reads the kit sees nine lanes and
     agrees the record has drums. So this one reads THE ARTIFACT: the hits
     K.drums actually hands the engine, over the record the page handed in,
     which is the same measurement band-kit's take gate makes (all 30 records
     x takes 2-5, `(h1 === 0) === (h === 0)`) and the same reason it is
     allowed to ask the kernel that soundsOf is — the question is literally
     "does a drum come out of this record". Once per compiled record, cached
     on the array like every other answer here.

     The law is the take's, word for word: a producer may vary WHAT THE RECORD
     ALLOWS and may not hire a player. So it is a RECORD-level fact, never a
     lane-level one — roll 2 is a troubadour song that declares a `k` lane of
     sixteen zeros and plays 122 drum events on its other lanes, and "more
     kick" there filling that lane is the producer working, not the 1800s. */
  const PH0 = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
    vel: new Array(16).fill(6), inc: new Array(16).fill(0),
    stk: new Array(16).fill(0), gate: new Array(16).fill(0),
    acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
  const KITLESS = new WeakMap();
  function kitless(secs) {
    if (!Array.isArray(secs)) return false;
    let v = KITLESS.get(secs); if (v !== undefined) return v;
    v = true;
    for (const sec of secs) {
      if (!sec || !sec.genre) continue;
      let n = 0;
      try { n = K.drums(PH0, sec.genre, Math.max(1, sec.bars | 0)).length; }
      catch (e) { n = 1; }                     // a throw is not a silent kit
      if (n) { v = false; break; }
    }
    KITLESS.set(secs, v);
    return v;
  }
  // ...and which subjects that fact is about. A subject that owns kit lanes
  // IS the drummer, whichever verb is holding it.
  const isDrum = (S) => !!(S && (S.lane || S.id === "drums"));

  /* ================= ONE NOTE, APPLIED ===================================
     `note` is { v: verb, s: subject, d: descriptor|null, w: amount }. What
     comes back is a diff record — WHAT ACTUALLY MOVED — because the sentence
     the producer speaks is computed from the applied delta and never from
     the intent: the hand may have overruled half of it, and the gig sheet
     must say what is true. */
  function applyNote(model, secs, note, held, out, live, sounds, noKit) {
    const S = SUB[note.s]; if (!S) return;
    const w = note.w, verb = note.v;
    const d = { fields: [], lanes: [], mix: {}, master: {}, bpm: 0,
                kitWas: [], kitNow: [], cast: [], silenced: [], brought: [] };
    // THE KITLESS FENCE, said once for every verb. A record the engine gets
    // no drum event from has no drummer to make punk, no kick to open up and
    // no crash to add — so the note is refused whole, `speak` falls through
    // to "there are no drums on this record", and subjectsFor (which asks the
    // mover) withholds the sentence in the first place.
    if (noKit && isDrum(S)) { out.push({ note, d }); return; }
    const A = note.d && GENRES[note.d] ? GENRES[note.d] : null;
    const adj = note.d && ADJOF[note.d] ? ADJOF[note.d] : null;
    // GRIDS ARE REFUSED WHEN THE RECORD IS NOT COUNTING IN SIXTEEN. Every
    // kit lane in the catalog is exactly sixteen long, so a grid move onto a
    // twelve-step waltz writes four steps into a void the kernel silently
    // loses. Numbers and nouns still move: "this one counts in three — I can
    // move the sound but not the pattern."
    const g0 = secs[0] && secs[0].genre;
    const grids = !(g0 && g0.meter && g0.meter.steps !== 16);
    const wantsGrid = !!S.lane || S.id === "record" ||
      (note.d && ADJOF[note.d] && ADJOF[note.d].dens);
    if (!grids && wantsGrid) d.nogrid = true;

    // THE DESK ONLY HAS FADERS FOR WHAT IS PLAYING (the live-channel law
    // above). A fader on a channel this record does not build is not a
    // quieter cymbal, it is a line on the sheet that lied. The set is handed
    // in by run(), which recomputes it whenever a note ahead of this one has
    // moved a lane or taken a chair out or brought one in.
    const addMix = (chans, vals) => {
      for (const c of chans) {
        if (!live.has(c)) continue;
        const m = d.mix[c] || (d.mix[c] = {});
        for (const [k, v] of Object.entries(vals)) {
          if (k === "eq") { const e = m.eq || (m.eq = {});
            for (const [b, x] of Object.entries(v)) e[b] = (e[b] || 0) + x; }
          else if (k === "mute") m.mute = m.mute || v;
          else m[k] = +(((m[k] || 0) + v).toFixed(3));
        }
      }
    };
    const addMaster = (vals) => { for (const [k, v] of Object.entries(vals))
      d.master[k] = +(((d.master[k] || 0) + v).toFixed(3)); };

    /* ---- MAKE: the vector step -------------------------------------- */
    if (verb === "make" && A) {
      const rows = (SCOPEFIELDS[S.id] || SCOPEFIELDS.record)();
      for (const sec of secs) applyRows(model, sec, rows, A, w, held, d, grids, noKit);
    }
    // ...AND `on` IS THE WORD'S OWN DECLARATION OF WHERE IT IS HONEST, read by
    // the MOVER as well as by the offering. It was read only by `targets`
    // (:1593), so the two disagreed on exactly one branch and it was a branch
    // that MOVES: `applyAdj`'s cast fallback casts the guitar for scope
    // `record`, so "make the sound chugging" — a word whose `on` is
    // ["guitar","amp"] — was never offered and put a punk record's guitar on a
    // palm-muted patch anyway (measured 2026-08-24). One table, both readers.
    if (verb === "make" && adj && adj.on.includes(asOf(S.id)))
      applyAdj(model, secs, S, adj, w, held, d, addMix, addMaster, grids, noKit,
               live, sounds);

    /* ---- THE BARE TAP: a lane the record has never had ----------------- */
    // "just add it". This is the half of the retired `add` verb that is about
    // a LANE — the record's own idiom for the drum that is missing (ADDPAT) —
    // and it is the whole of the bare sentence now: the other half (a player
    // who is OUT) is the quality `back in`, so bringIn has one caller and
    // addOrder has one caller instead of one verb having both.
    //
    // THE MECHANISM IS THE VERB'S, MOVED AND NOT REWRITTEN — the lane walk,
    // `bringIn`, the live-channel registration and the +2 dB, in that order,
    // exactly as `add` ran them. `bringIn` is now also the quality `back in`'s
    // mechanism (:GONE), which is the same arrangement `silence()` has had
    // since `take away` and `keep only` both called it: ONE FUNCTION, two
    // doors. What that costs is one redundancy on the offering — a player who
    // is out can be brought back by the word or by the bare tap — and the
    // producer page's own redesign (COMPOSER.md §2.9, wave 2f) is where the
    // two are drawn as one gesture.
    if (verb === "make" && !note.d) {
      if (S.lane && grids && !noKit) {
        for (const sec of secs) {
          touchKit(sec); const g = sec.genre;
          for (const bar of [g.kit, ...(g.kits || [])]) {
            if (!bar) continue;
            for (const lane of S.lane) {
              const plan = addOrder(bar, lane, null);
              if (!plan || !plan.order.length) continue;
              const { pat, cur, order } = plan;
              const budget = Math.max(1, Math.round(w * order.length));
              const v = cur.slice();
              for (let n = 0; n < budget && n < order.length; n++) v[order[n]] = pat[order[n]];
              bar[lane] = v;
              d.lanes.push({ lane, moved: Math.min(budget, order.length), add: true });
            }
          }
        }
      }
      // a chair that is out comes back in — and once it is back, its own
      // channel is live, so the fader that comes with it is a real move
      bringIn(secs, S, w, d);
      if (d.brought.length || d.lanes.some((x) => x.add))
        for (const c of S.chan) live.add(c);
      if (S.chan.length) addMix(S.chan, { fader: +2 * w });
    }

    out.push({ note, d });
  }

  /* ---- the row engine: numbers lerp, nouns switch, grids budget ------- */
  function applyRows(model, sec, rows, A, w, held, d, grids, noKit) {
    for (const [path, kind, from, who] of rows) {
      if (noKit && who === "kit") continue;            // the kitless fence
      const tgt = from(A);
      if (tgt === undefined) continue;                 // no opinion: sit out
      const [box, ...rest] = path.split(".");
      const field = rest[rest.length - 1];
      if (held.has(field)) continue;                   // the hand owns it
      if (kind === "grid") {
        if (!grids || noKit) continue;   // ...and the fence again, per kind
        const lane = rest.join(".").replace(/^kit\./, "");
        touchKit(sec);
        const g = sec.genre;
        const bars = [g.kit, ...(Array.isArray(g.kits) ? g.kits : [])];
        let moved = 0;
        for (const bar of bars) {
          if (!bar) continue;
          const r = gridMove(bar[lane], tgt, w);
          if (r.moved) { if (r.v === null) delete bar[lane]; else bar[lane] = r.v;
                         moved += r.moved; }
        }
        if (moved) d.lanes.push({ lane, moved, toward: true });
        continue;
      }
      if (path === "song.bpm") {
        const cur = model.song.bpm;
        if (!num(tgt) || !num(cur)) continue;
        const want = cur + (tgt - cur) * w;
        const cap = cur * NUM.bpm.cap;                  // the tempo fence
        const got = Math.round(cur + Math.max(-cap, Math.min(cap, want - cur)));
        if (got !== cur) { d.bpm = got - cur; d.fields.push({ f: "bpm", from: cur, to: got }); }
        continue;
      }
      // resolve the container the field lives in
      const cont = containerOf(sec, box, rest.slice(0, -1));
      if (!cont) continue;
      const cur = cont[field];
      if (kind === "num") {
        if (!num(tgt)) continue;
        const spec = NUM[field] || { lo: -1e6, hi: 1e6 };
        const c0 = num(cur) ? cur : (field === "stress" || field === "phrase" ? 0 : tgt);
        let v = c0 + (tgt - c0) * w;
        if (spec.int) v = Math.round(v);
        v = Math.max(spec.lo, Math.min(spec.hi, v));
        if (v !== cur) { cont[field] = v; d.fields.push({ f: field, from: cur, to: v }); }
      } else if (kind === "obj") {
        if (!tgt || typeof tgt !== "object") continue;
        const keys = OBJ[field] || Object.keys(tgt);
        const o = { ...(cur && typeof cur === "object" ? cur : {}) };
        let any = false;
        for (const k of keys) {
          const t = tgt[k];
          if (t === undefined) continue;
          if (typeof t === "string") {                  // `wave` and friends
            if (w >= NOUN_TH.wave && o[k] !== t) { o[k] = t; any = true;
              d.fields.push({ f: field + "." + k, from: cur && cur[k], to: t }); }
            continue;
          }
          if (!num(t)) continue;
          const c0 = num(o[k]) ? o[k] : t;
          const v = +(c0 + (t - c0) * w).toFixed(4);
          if (v !== o[k]) { o[k] = v; any = true;
            d.fields.push({ f: field + "." + k, from: c0, to: v, quiet: true }); }
        }
        if (any) cont[field] = o;
      } else {                                          // noun: switch
        const th = groupTh(field) || NOUN_TH[field] || 0.5;
        if (w < th) continue;
        if (same(cur, tgt)) continue;
        cont[field] = tgt;
        d.fields.push({ f: field, from: cur, to: tgt, noun: true });
        if (field === "instr") d.cast.push(tgt);
      }
    }
  }

  function containerOf(sec, box, mid) {
    if (box === "mel") { const g = ownGenre(sec, "mel"); if (!g) return null;
      if (g.chairs) { g.chairs = g.chairs.map((c) => ({ ...c })); }
      return g; }
    if (box === "voice") { const g = ownGenre(sec, "voice"); if (!g) return null;
      if (g.chairs) { g.chairs = g.chairs.map((c) => ({ ...c })); }
      return g; }
    if (box === "kit") { touchKit(sec); return sec.genre.kit; }
    if (!mid.length) return ownGenre(sec, "g");
    if (mid[0] === "chairs") { const ch = touchChairs(sec); return ch[+mid[1]] || null; }
    return ownGenre(sec, "g");
  }
  const same = (a, b) => (Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((x, i) => x === b[i])
    : (a && typeof a === "object" && b && typeof b === "object"
       ? JSON.stringify(a) === JSON.stringify(b) : a === b));

  /* ---- what `add` would put in --------------------------------------- */
  // ONE function, read by the mover above AND by the offering below, so what
  // is offered cannot drift from what happens. The anchor's own pattern for
  // this lane (or the fallback idiom), minus what is already there, in the
  // PRIORITY order a drummer would fill it.
  function addOrder(bar, lane, A) {
    const pat = (A && (A.kit || {})[lane]) || ADDPAT[lane];
    if (!pat) return null;
    const cur = bar[lane] || new Array(pat.length).fill(0);
    if (cur.length !== pat.length) return null;
    return { pat, cur, order: PRIORITY.filter((i) => pat[i] && !cur[i]) };
  }
  // `strict` is the OFFERING's extra condition, and it is about the WORD
  // rather than the move: "add the crash, punk" has to mean PUNK's crash, so
  // an anchor with nothing in this lane is not offered even though the mover
  // would happily fall back to the generic idiom (which is what the bare
  // "just add it" is for).
  function canAdd(secs, S, A, grids, strict) {
    if (!S.lane || !grids) return false;
    const kit = (A && A.kit) || {};
    for (const sec of secs) {
      const g = sec.genre; if (!g) continue;
      for (const bar of [g.kit, ...(Array.isArray(g.kits) ? g.kits : [])]) {
        if (!bar) continue;
        for (const lane of S.lane) {
          if (strict && !(kit[lane] || []).some(Boolean)) continue;
          const plan = addOrder(bar, lane, A);
          if (plan && plan.order.length) return true;
        }
      }
    }
    return false;
  }

  /* ---- density: more of what it already plays ------------------------ */
  function densLane(secs, S, sign, w, d, noKit) {
    if (noKit) return;                    // the kitless fence
    for (const sec of secs) {
      touchKit(sec); const g = sec.genre;
      for (const bar of [g.kit, ...(g.kits || [])]) {
        if (!bar) continue;
        for (const lane of S.lane) {
          const cur = bar[lane];
          if (!cur || !cur.length) continue;
          if (sign > 0) {
            const holes = PRIORITY.filter((i) => i < cur.length && !cur[i]);
            const n = Math.round(w * holes.length * 0.5);
            if (!n) continue;
            const v = cur.slice();
            const lvl = Math.max(...cur) || 1;
            for (let i = 0; i < n; i++) v[holes[i]] = lvl;
            bar[lane] = v; d.lanes.push({ lane, moved: n, add: true });
          } else {
            const on = PRIORITY.slice().reverse().filter((i) => i < cur.length && cur[i]);
            const n = Math.round(w * on.length * 0.6);
            if (!n) continue;
            const v = cur.slice();
            for (let i = 0; i < n; i++) v[on[i]] = 0;
            bar[lane] = v; d.lanes.push({ lane, moved: n, cut: true });
          }
        }
      }
    }
  }
  function densBass(secs, sign, w, d, held) {
    if (held.has("bassStyle")) return;
    const steps = Math.round(w * 2.5) * sign;
    if (!steps) return;
    for (const sec of secs) {
      const g = ownGenre(sec, "g");
      const at = DENS.indexOf(g.bassStyle);
      if (at < 0) continue;
      const to = DENS[Math.max(0, Math.min(DENS.length - 1, at + steps))];
      if (to === g.bassStyle) continue;
      g.bassStyle = to; d.fields.push({ f: "bassStyle", from: DENS[at], to, noun: true });
    }
  }

  /* ---- silence and resurrection -------------------------------------- */
  // TAKING OUT WHAT IS NOT THERE IS NOT A MOVE. This used to say it had
  // silenced the subject whether or not a single lane, chair or voice went —
  // "took the hats out" on a record whose kit is one kick lane — which is the
  // live-channel law's fault in its other half: the diff record said a thing
  // happened, so the offering (which asks the diff record) went on offering
  // it. `did` is the whole fix: the sentence is read off what went.
  function silence(secs, S, d, grids) {
    let did = false;
    for (const sec of secs) {
      // A ROW MAY OWN ITS OWN SILENCE. The five branches below are band-kit's
      // model — a kit lane, `nobass`, a chair's `part`, `sec.voice`,
      // `sec.melody` — and the eight-axes document has a WORD for this instead
      // (songs.js:63, `"out": [["drop", 1]]`, "a voice can be silent for a
      // section without leaving the record"). A projected row hands that word
      // in; nothing here has to learn what a document is.
      if (S.out) { if (S.out(sec)) did = true; continue; }
      if (S.lane && grids) {
        touchKit(sec); const g = sec.genre;
        for (const bar of [g.kit, ...(g.kits || [])]) { if (!bar) continue;
          // A DECLARED LANE OF SIXTEEN ZEROS IS NOT A DRUM TO REMOVE. Deleting
          // it moved the score and changed no sound, which is the same lie
          // `did` was introduced to stop, one level further down.
          for (const lane of S.lane) { const vec = bar[lane];
            if (!vec || !(Array.isArray(vec) ? vec.some(Boolean) : vec)) continue;
            delete bar[lane]; did = true;
            delete bar["?" + lane]; delete bar["~" + lane]; delete bar["!" + lane]; } }
      }
      if (S.id === "bass" || S.id === "line") {
        const g = ownGenre(sec, "g"); if (!g.nobass) { g.nobass = true; did = true; }
      }
      if (S.id === "keys" || S.id === "guitar") {
        const ch = touchChairs(sec); const ix = S.id === "keys" ? 0 : 1;
        if (ch[ix] && ch[ix].part) { ch[ix].part = null; did = true; }
      }
      if (S.id === "voice" && sec.voice) { sec.voice = null; did = true; }
      if (S.id === "tune" && sec.melody) { sec.melody = null; did = true; }
    }
    if (did) d.silenced.push(S.id);
  }
  function bringIn(secs, S, w, d) {
    let did = false;
    for (const sec of secs) {
      if (S.in) { if (S.in(sec)) did = true; continue; }   // the mirror of S.out
      if (S.id === "bass" || S.id === "line") {
        const g = ownGenre(sec, "g"); if (g.nobass) { g.nobass = false; did = true; }
      }
      if ((S.id === "keys" || S.id === "guitar")) {
        const ch = touchChairs(sec); const ix = S.id === "keys" ? 0 : 1;
        if (ch[ix] && ch[ix].part == null) { ch[ix].part = S.id === "keys" ? "pad" : "stab";
          did = true; }
      }
    }
    if (did) d.brought.push(S.id);
  }

  /* ---- the adjectives, applied --------------------------------------- */
  function applyAdj(model, secs, S, adj, w, held, d, addMix, addMaster, grids, noKit,
                    live, sounds) {
    if (adj.mix && S.chan.length) addMix(S.chan, adj.mix(w));
    if (adj.mix && !S.chan.length && S.master) addMix(["drums","bass"], adj.mix(w));
    if (adj.master && (S.master || S.id === "record")) addMaster(adj.master(w));
    if (adj.bpm) {
      const cur = model.song.bpm;
      const got = Math.round(cur * (1 + adj.bpm * NUM.bpm.cap * w));
      if (got !== cur) { d.bpm = got - cur; d.fields.push({ f: "bpm", from: cur, to: got }); }
    }
    if (adj.dens) {
      if (S.lane && grids) densLane(secs, S, adj.dens, w, d, noKit);
      else if (S.id === "record" && grids) densLane(secs, SUB.drums, adj.dens, w, d, noKit);
      if (S.id === "bass" || S.id === "line" || S.id === "record")
        densBass(secs, adj.dens, w, d, held);
    }
    /* :GONE — THE THREE QUALITIES THAT ARE STRUCTURE AND NOT COLOUR, and each
       one is the retired verb's own body, moved and not rewritten: `take away`
       (:889 as it stood), `add`'s resurrection half (:870), and `keep only`
       (:901), guards included. `livesIn` is why they need `live` and `sounds`:
       you cannot take out — or keep only — a thing that is not there, which is
       Paul's 2026-08-22 fault wearing a different noun. */
    if (adj.gone && livesIn(live, secs, S, sounds)) {
      if (S.chan.length) addMix(S.chan, w >= DELETE_TH
        ? { mute: true, fader: -36 * w } : { fader: -36 * w });
      if (w >= DELETE_TH) silence(secs, S, d, grids);
      else if (S.lane && grids) densLane(secs, S, -1, w, d, noKit);
    }
    if (adj.bring) {
      bringIn(secs, S, w, d);
      if (d.brought.length) {
        for (const c of S.chan) live.add(c);
        if (S.chan.length) addMix(S.chan, { fader: +2 * w });
      }
    }
    // ...THE ONLY CODE PATH IN THIS FILE THAT WRITES TO SUBJECTS OTHER THAN
    // THE NOTE'S. `scope: "others"` is the declaration that lets it: applyAdj
    // is scoped to S and S.chan everywhere else, and a quality that means
    // "alone" has to walk SUBJ the way `keep only` did.
    if (adj.scope === "others" && livesIn(live, secs, S, sounds)) {
      const others = SUBJ.filter((x) => x.kind && x.id !== S.id && x.id !== "record" &&
                                        x.id !== "mix" && x.id !== S.under &&
                                        x.under !== S.id);
      for (const o of others) {
        if (o.chan.length) addMix(o.chan, w >= DELETE_TH
          ? { mute: true, fader: -30 * w } : { fader: -30 * w });
        if (w >= DELETE_TH) silence(secs, o, d, grids);
      }
      if (S.chan.length) addMix(S.chan, { fader: +3 * w });
    }
    for (const sec of secs) {
      if (adj.g) for (const [f, spec] of Object.entries(adj.g(w))) {
        const [head, sub] = f.split(".");
        if (held.has(head)) continue;
        const g = ownGenre(sec, "g");
        if (sub) {
          const o = { ...(g[head] || {}) };
          const c0 = num(o[sub]) ? o[sub] : spec.to;
          const v = +(c0 + (spec.to - c0) * spec.w).toFixed(4);
          if (v !== o[sub]) { o[sub] = v; g[head] = o;
            d.fields.push({ f, from: c0, to: v, quiet: true }); }
        } else {
          const c0 = num(g[head]) ? g[head] : 0;
          let v = c0 + (spec.to - c0) * spec.w;
          if (NUM[head] && NUM[head].int) v = Math.round(v);
          v = +v.toFixed(4);
          if (v !== g[head]) { g[head] = v; d.fields.push({ f, from: c0, to: v }); }
        }
      }
      if (adj.noun) { const n = adj.noun(w);
        if (n) for (const [f, v] of Object.entries(n)) {
          if (held.has(f)) continue;
          const g = ownGenre(sec, "g");
          if (g[f] !== v) { const was = g[f]; g[f] = v;
            d.fields.push({ f, from: was, to: v, noun: true }); }
        } }
      if (adj.tone) {
        // A ROW THAT OWNS A CHAIR SAYS WHICH ONE. `S.ix` is the chair index a
        // projected voice sits in; the shipped rows carry none and keep the
        // keys=0 / guitar=1 map they were written with.
        const as1 = asOf(S.id), ix0 = S.ix;
        const paths = ix0 != null ? ["g.chairs." + ix0 + ".tone"]
          : as1 === "bamp" || as1 === "bass" ? ["g.bassTone"]
          : as1 === "amp" || as1 === "guitar" ? ["g.chairs.1.tone"]
          : as1 === "keys" ? ["g.chairs.0.tone","g.tone"]
          : as1 === "record" ? ["g.bassTone","g.chairs.0.tone","g.chairs.1.tone"] : [];
        for (const p of paths) {
          const rest = p.split(".").slice(1);
          const cont = containerOf(sec, "g", rest.slice(0, -1));
          if (!cont) continue;
          const f = rest[rest.length - 1];
          const t0 = cont[f] && typeof cont[f] === "object" ? cont[f] : {};
          const mv = adj.tone(w, t0);
          const o = { ...t0 };
          let any = false;
          for (const [k, v] of Object.entries(mv))
            if (num(v) && +v.toFixed(3) !== o[k]) { o[k] = +v.toFixed(3); any = true; }
          if (any) { cont[f] = o; d.fields.push({ f: "tone", quiet: true }); }
        }
      }
      const cix = S.ix != null ? S.ix : 1;      // the chair these two write
      if (adj.chair) { const n = adj.chair(w);
        if (n) { const ch = touchChairs(sec);
          for (const [f, v] of Object.entries(n))
            if (ch[cix] && ch[cix][f] !== v) { ch[cix][f] = v;
              d.fields.push({ f, to: v, noun: true, quiet: true }); } } }
      if (adj.cast && w >= NOUN_TH.instr) {
        const fam = adj.cast[asOf(S.id)] || adj.cast[S.under] ||
          (asOf(S.id) === "record" ? adj.cast.guitar : null);
        if (fam) { const ch = touchChairs(sec);
          const pick = fam.find((x) => F.INSTRCHOICES[x]);
          if (pick && ch[cix] && ch[cix].instr !== pick) {
            ch[cix].instr = pick; d.cast.push(pick);
            d.fields.push({ f: "instr", to: pick, noun: true });
            ownGenre(sec, "g").instr = ch.map((c) => c.instr); } }
      }
      if (adj.reg) {
        const as2 = asOf(S.id);
        const ix = S.ix != null ? S.ix
          : as2 === "keys" ? 0 : as2 === "guitar" ? 1 : null;
        const step = w >= 0.5 ? adj.reg : 0;
        if (!step) continue;
        if (ix != null) { const ch = touchChairs(sec);
          // A REGISTER HAS RAILS, AND A CHAIR'S DID NOT. `bassReg` is clamped to
          // NUM.bassReg's +-2 four lines down and the CHAIR's was not, so
          // "lower" on a voice already sitting AT the bottom rail walked it off
          // the piano: measured 2026-08-24 on a punk record whose second guitar
          // is cast at reg -2, one press took it to -3 and the lowest note it
          // played went 29 -> 17. dice.test.js's own predicate calls that
          // unplayable ("21..108 is a piano, end to end"), and PLAYABLE is the
          // one promise a permissive producer has to keep. The step is REFUSED
          // rather than clamped, so a record that already sits outside the rails
          // is never dragged back into them by a note about something else.
          if (ch[ix]) { const nx = (ch[ix].reg || 0) + step;
            if (nx >= NUM.bassReg.lo && nx <= NUM.bassReg.hi) {
              ch[ix].reg = nx;
              d.fields.push({ f: "register", to: ch[ix].reg }); } } }
        else if (as2 === "bass" || as2 === "line") {
          const g = ownGenre(sec, "g");
          g.bassReg = Math.max(-2, Math.min(2, (g.bassReg || 0) + step));
          d.fields.push({ f: "bassReg", to: g.bassReg });
        }
      }
    }
  }

  /* ================= THE WHOLE STACK =====================================
     One pass. Notes compose in the order they were said, each one moving the
     record as it stands under it — which is what a stack of production notes
     IS. `held` is every kernel field the HAND has answered by name
     (band-kit's annotated knobs): the producer never moves one, so on those
     fields it cannot fight you, and on the mix it cannot fight you either
     because offsets ADD. */
  function run(model, secs0) {
    const notes = notesOf(model);
    const held = new Set(Object.keys((model.song && model.song.knobs) || {})
      .filter((k) => k !== "__said"));
    const secs = secs0.map(clone);
    const out = [];
    if (!notes.length) return { secs: secs0, mix: {}, bpm: model.song.bpm, said: [] };
    // WHAT SOUNDS, ASKED ONCE. The chairs are read off the record the page
    // handed in — a stable array, so the answer is cached on it and the
    // offering's several hundred probes share one render pass — and the desk
    // addresses are rebuilt only when a note has actually moved a lane or put
    // a chair in or out, which is the only way the answer can change.
    const sounds = soundsOf(secs0);
    const noKit = kitless(secs0);
    let live = null;
    for (const n of notes) {
      // the kit before and after THIS note, so the sentence can be read off
      // the kernel's own operator table rather than off the intent
      const k0 = secs[0] && secs[0].genre && secs[0].genre.kit;
      const was = k0 ? JSON.parse(JSON.stringify(k0)) : null;
      if (!live) live = liveChans(secs, sounds);
      applyNote(model, secs, n, held, out, live, sounds, noKit);
      const rec = out[out.length - 1];
      // A NOTE'S OWN DESCRIPTION IS ABOUT THE NOTE, and it is written HERE
      // rather than at the end of the pass. `__kitNow` used to be a LIVE
      // REFERENCE to the kit every later note goes on mutating, while `said`
      // is computed after the whole stack has run — so a second sentence
      // rewrote the first one's note retroactively: "less of everything"
      // first reported "thinned the kick (1 step), thinned the hat (2
      // steps)…", and after an unrelated second sentence the same untouched
      // line read "opened the kit up (25 steps across 9 drums)". Inverted
      // meaning, for a sentence the user never touched. A persisted statement
      // describes what IT does; so the kit AFTER this note is snapshotted the
      // same way the kit before it already was.
      const k1 = secs[0] && secs[0].genre && secs[0].genre.kit;
      if (rec) { rec.d.__kitWas = was;
                 rec.d.__kitNow = k1 ? JSON.parse(JSON.stringify(k1)) : null;
                 if (rec.d.lanes.length || rec.d.silenced.length ||
                     rec.d.brought.length) live = null; }
    }
    // the desk offsets and the tempo, summed over the stack
    const mix = {}; let bpm = model.song.bpm;
    for (const { d } of out) {
      for (const [c, vals] of Object.entries(d.mix)) {
        const m = mix[c] || (mix[c] = {});
        for (const [k, v] of Object.entries(vals)) {
          if (k === "eq") { const e = m.eq || (m.eq = {});
            for (const [b, x] of Object.entries(v)) e[b] = (e[b] || 0) + x; }
          else if (k === "mute") m.mute = true;
          else m[k] = +(((m[k] || 0) + v).toFixed(3));
        }
      }
      const ms = mix.master || (mix.master = {});
      for (const [k, v] of Object.entries(d.master)) ms[k] = +(((ms[k] || 0) + v).toFixed(3));
      bpm += d.bpm;
    }
    if (mix.master && !Object.keys(mix.master).length) delete mix.master;
    // clean the bookkeeping flags back off the sections
    for (const s of secs) { delete s.__ownG; delete s.__ownC; delete s.__ownK;
                            delete s.__dirty; }
    return { secs, mix, bpm: Math.max(40, Math.min(220, Math.round(bpm))),
             said: out.map(({ note, d }) => ({ note, sentence: sentence(note),
               said: speak(model, secs0, note, d), moved: moved(d),
               // A NOTE THAT MOVED NOTHING IS REFUSED, IN WORDS. `speak`
               // already returns the reason instead of a boast; this is the
               // flag a gate (and the page, if it wants to grey the line)
               // reads without matching on prose.
               refused: !moved(d) })) };
  }
  const moved = (d) => !!(d.fields.length || d.lanes.length ||
    Object.keys(d.mix).length || Object.keys(d.master).length || d.bpm ||
    d.silenced.length || d.brought.length);

  const produce = (model, secs) => run(model, secs).secs;

  /* ================= WHAT THE PRODUCER SAYS BACK =========================
     In the band's own words, and computed from the applied delta rather than
     from the intent. The best of it is free: after the kit moves, test the
     new kit against all 68 of the kernel's own KITOPS — every one a pure
     kit -> kit function — and if one of them MATCHES, its existing KITLABEL
     is the sentence. That is where "opened the hats" and "backbeat" come
     from without a word of new vocabulary. */
  const kitSame = (a, b) => {
    const ka = Object.keys(a || {}).filter((k) => (a[k] || []).some(Boolean)).sort();
    const kb = Object.keys(b || {}).filter((k) => (b[k] || []).some(Boolean)).sort();
    if (ka.join() !== kb.join()) return false;
    return ka.every((k) => (a[k] || []).length === (b[k] || []).length &&
      (a[k] || []).every((x, i) => !!x === !!b[k][i]));
  };
  function opWord(was, now) {
    if (!was || !now || kitSame(was, now)) return null;
    for (const [key, fn] of Object.entries(KITOPS)) {
      let got; try { got = fn(was); } catch (e) { continue; }
      if (got && kitSame(got, now)) return KITLABEL[key] || key;
    }
    return null;
  }
  const LANEW = (d) => (LANES[d] ? LANES[d].name : d);
  // the three sidecar prefixes, in the kernel's own terms (kernel.js:2304).
  // Three rows, and they exist because a sidecar move was speechless — see the
  // measurement in `speak` below.
  const SIDEWORD = { "?": (w) => "changed how often the " + w + " sounds",
                     "~": (w) => "moved the " + w + " off the grid",
                     "!": (w) => "put a grace note in front of the " + w };
  const DKWORD = { tr909: "a 909", tr808: "an 808", tr606: "a 606", cr78: "a CR-78",
                   power: "a big rock kit", jazz: "a jazz kit", brush: "brushes",
                   room: "a room kit", acoustic: "an acoustic kit",
                   electronic: "electronic drums" };
  function speak(model, base, note, d) {
    const out = [];
    const S = SUB[note.s];
    // the kit, in the kernel's own operator words
    if (d.lanes.length) {
      const w2 = opWord(d.__kitWas, d.__kitNow);
      if (w2) out.push(w2);
      else {
        // COUNTED OFF THE BAR, NOT OFF THE WORK. The move runs over every
        // section and every bar of the schedule; a drummer describing it
        // counts the bar in front of them, so the sentence diffs the one kit
        // that was actually snapshotted.
        const was = d.__kitWas || {}, now = d.__kitNow || {};
        const lanes = new Set([...Object.keys(was), ...Object.keys(now)]
          .filter((k) => LANES[k]));
        const moves = [];
        for (const lane of lanes) {
          const a = was[lane] || [], b = now[lane] || [];
          const N = Math.max(a.length, b.length);
          let put = 0, took = 0;
          for (let i = 0; i < N; i++) { const x = !!a[i], y = !!b[i];
            if (!x && y) put++; else if (x && !y) took++; }
          if (!put && !took) continue;
          const n = put >= took ? put : took;
          moves.push({ lane, n, up: put >= took });
        }
        // A WHOLE KIT IS ONE SENTENCE. "More drums" moves every lane there
        // is, and nine lines of "opened up the rim (3 steps)" is a report,
        // not a producer. Four or more lanes moving the same way is the KIT
        // moving, and that is how a drummer would say it.
        const ups = moves.filter((x) => x.up), downs = moves.filter((x) => !x.up);
        for (const [set, word] of [[ups, "opened the kit up"],
                                   [downs, "thinned the kit out"]]) {
          if (set.length >= 4) {
            const n = set.reduce((a2, x) => a2 + x.n, 0);
            out.push(word + " (" + n + " steps across " + set.length + " drums)");
          } else for (const x of set)
            out.push((x.up ? "opened up the " : "thinned the ") + LANEW(x.lane) +
                     " (" + x.n + " step" + (x.n === 1 ? "" : "s") + ")");
        }
        // ...AND THE SIDECARS, WHICH WERE MOVES NOBODY COULD SAY. `?k` is how
        // often the kick sounds, `~r` how far the ride sits behind the grid,
        // `!p` the grace note before the perc — kernel.js:2304 reads them WITH
        // their lane and never as one of their own, so `LANES[k]` is undefined
        // for all six and the walk above dropped every one of them on the
        // floor. Measured 2026-08-24 on a punk record: "make the snare toto"
        // put two steps into `~s`, `moved(d)` was TRUE, and the sheet said
        // "it's as toto as it's going to get". Same class as H5's tone — a move
        // the producer had made and was reporting as a failure.
        for (const lane of new Set([...Object.keys(was), ...Object.keys(now)])) {
          const side = SIDEWORD[lane[0]]; if (!side) continue;
          const dr = lane.slice(1); if (!LANES[dr]) continue;
          if (same(was[lane], now[lane])) continue;
          out.push(side(LANEW(dr)));
        }
      }
    }
    for (const f of d.fields) {
      if (f.quiet) continue;
      if (f.f === "drumkit") out.push("put them on " + (DKWORD[f.to] || f.to));
      else if (f.f === "hand") out.push(f.to === "exact" ? "took the hand off it — machine tight"
                                                         : "let the hand breathe");
      else if (f.f === "humanize") out.push(f.to < (f.from || 0) ? "took the swing out"
                                                                 : "loosened the grid");
      else if (f.f === "stress") out.push(f.to > (f.from || 0) ? "leaned harder on the one"
                                                               : "took the weight off the beat");
      else if (f.f === "bassStyle") out.push("the bass " +
        (B.STYLEWORD ? (Object.keys(B.STYLES).find((k) => B.STYLES[k] === f.to) &&
          B.STYLEWORD[Object.keys(B.STYLES).find((k) => B.STYLES[k] === f.to)]) || f.to : f.to));
      else if (f.f === "bassFig") out.push("wrote the bass a line of its own");
      else if (f.f === "artic" || f.f === "bassArtic")
        out.push(f.to === "staccato" ? "shortened everything" :
                 f.to === "legato" ? "let it ring" : "changed the touch");
      else if (f.f === "instr") out.push("put it on " +
        (F.INSTRCHOICES[f.to] || String(f.to)));
      else if (f.f === "scale") out.push("changed the notes the tune is made of");
      else if (f.f === "fill") out.push("rewrote the fill");
      else if (f.f === "maxHold") out.push(f.to === 0 ? "let the chords ring"
                                                      : "clipped the chords short");
      else if (f.f === "phrase") out.push(f.to > (f.from || 0) ? "gave the line an arch"
                                                               : "flattened the line out");
      else if (f.f === "bpm") out.push((f.to > f.from ? "took it up to " : "pulled it back to ")
                                       + f.to);
      else if (f.f === "register" || f.f === "bassReg")
        out.push("moved it an octave");
      else if (f.f === "diatonic") out.push(f.to ? "kept it in the key"
                                                 : "let it follow the chords");
      else if (f.f === "nobass") out.push(f.to ? "dropped the bass out" : "brought the bass back");
    }
    // AN ADJECTIVE SAYS ITSELF FIRST. "Thrash" is not the sum of a staccato
    // and a cast — it is a sound with a name, and the producer says the name
    // before the mechanics.
    const adjw = note.d && ADJOF[note.d] && ADJOF[note.d].said;
    if (adjw && moved(d)) out.unshift(adjw);
    for (const id of d.silenced) out.push("took " + SUB[id].w + " out");
    for (const id of d.brought) out.push("brought " + SUB[id].w + " back in");
    // the desk, in an engineer's words
    for (const [c, v] of Object.entries(d.mix)) {
      const w2 = chanWord(c);
      if (v.mute) { out.push("muted " + w2); continue; }
      if (v.fader >= 1.5) out.push("brought " + w2 + " up");
      else if (v.fader <= -1.5) out.push("pulled " + w2 + " down");
      if (v.rev >= 0.08) out.push("put " + w2 + " in a bigger room");
      else if (v.rev <= -0.08) out.push("dried " + w2 + " out");
      if (v.del >= 0.08) out.push("threw an echo off " + w2);
      if (v.eq) { if ((v.eq.hi || 0) >= 2) out.push("opened the top up on " + w2);
                  else if ((v.eq.hi || 0) <= -2) out.push("took the top off " + w2);
                  if ((v.eq.lo || 0) >= 2) out.push("more weight under " + w2);
                  else if ((v.eq.lo || 0) <= -2) out.push("took the bottom out of " + w2); }
    }
    for (const [k, v] of Object.entries(d.master)) {
      if (!v) continue;
      if (k === "drive") out.push(v > 0 ? "drove the whole thing harder" : "cleaned the mix up");
      if (k === "glue") out.push(v > 0 ? "squeezed it" : "let it breathe");
      if (k === "tape") out.push("ran it to tape");
      if (k === "space") out.push(v > 0 ? "opened the room up" : "closed the room down");
    }
    // ...AND THE FOUR HONEST FAILURES, said plainly. A producer who pretends
    // to have moved something is worse than one who says there was nothing
    // there.
    if (!out.length) {
      // A TONE-ONLY MOVE IS REAL, AND IT WAS BEING REPORTED AS A FAILURE.
      // Every tone field is pushed `quiet` (:925, :1140) so the loop above
      // skips it, `out` comes back empty and the four honest failures below
      // claim nothing happened — while the chair's tone IS the target's after
      // the press (measured 2026-08-24: "make the cantor doowop" left the
      // record with doowop's colour and the sheet saying "it's as doowop as
      // it's going to get"). The producer says the one thing that is true.
      if (d.fields.some((f) => f.f === "tone" || /^tone\./.test(f.f)))
        return ["moved the colour of " + S.w];
      if (d.nogrid) return ["this one counts in " + ((base[0].genre.meter || {}).steps === 12
        ? "three" : "something other than four") + " — I can move the sound but not the pattern"];
      if (note.d && GENRES[note.d] && !SCOPEFIELDS[note.s])
        return [TXT.t("refuse.genreSilent",
          { genre: GENRES[note.d].label, name: SUB[note.s].w })];
      // THERE IS NOTHING THERE. The live-channel law's own sentence: a
      // subject this record does not have cannot be made more or less of,
      // and the honest thing is to name it rather than to say the record is
      // already as cymballed as it is going to get. (A chair keeps its own
      // wording — "the voice is not playing" is what an absent PLAYER is.)
      if (!livesOn(base, S))
        /* ...AND NOBODY COMPUTES AGREEMENT ANY MORE. Both halves used to
           conjugate off `/s$/.test(S.bare)` — "the drums ARE not playing" vs
           "the cantor IS not playing" — which is English grammar written in
           JavaScript and unportable by construction. The SUBJECT IS DROPPED
           instead: the sentence stands beside the note whose heading already
           names it, so one string is true of every noun. Same two keys the
           page greys the chip with (ui/produce.js WHY). */
        return [TXT.t(S.kind === "chair" ? "refuse.notPlaying"
                                         : "refuse.notHere")];
      // ...and the one that is not a failure at all: the staggered
      // thresholds mean a first press can be below every noun this target
      // disagrees about. Say so, and say what to do about it. TWO-TAP verbs
      // need this sentence as much as three-tap ones do — "more bass" on a
      // line already at eighths does not reach sixteenths until the second
      // press — so the test is the same one, asked without a descriptor.
      if (note.w < 0.9 &&
          (note.d ? (GENRES[note.d] ? firstStep(model, base, note.s, note.d) > 0
                                    : wouldMove(model, base, note.s, note.d))
                  : wouldVerb(model, base, note.v, note.s)))
        return ["not yet — push it further"];
      // "it's as brighter as it's going to get" — the ungrammatical template
      // the audit found in forty-eight rendered places, and the case TABLE.md
      // §12b names. One key, no adjective spliced into a comparative.
      return [TXT.t("refuse.spent")];
    }
    // ONE MOVE, SAID ONCE. The stack moves every section and every matching
    // channel, and a producer does not say "put them on a big rock kit" five
    // times because the record has five sections.
    return out.filter((x, i) => out.indexOf(x) === i);
  }
  // A PROJECTED ROW KNOWS ITS OWN SILENCE. The five branches below are
  // band-kit's four chairs plus the bass, addressed by name; a cast installed
  // by ui/produce.js is named for the record's own voices and falls off the end
  // of the chain into `false` — "never out" — which made `livesIn` true for a
  // voice the document had said `out` in every section. A row that can answer
  // does; everything else takes the shipped chain, byte for byte.
  const chairOut = (base, id) => (SUB[id] && SUB[id].silent)
    ? SUB[id].silent(base)
    : base.every((s) =>
    id === "voice" ? !s.voice : id === "tune" ? !s.melody
    : id === "bass" || id === "line" ? !!s.genre.nobass
    : id === "keys" ? !(s.genre.chairs && s.genre.chairs[0] && s.genre.chairs[0].part)
    : id === "guitar" ? !(s.genre.chairs && s.genre.chairs[1] && s.genre.chairs[1].part)
    : false);
  const chanWord = (c) => {
    const s = SUBJ.find((x) => x.chan.includes(c));
    // "the mix" IS THE MIX ROW'S OWN WORD — the same key SUBJ.mix reads, not a
    // second spelling of it.
    return s ? s.w : c === "master" ? TXT.t("produce.subj.mix")
                                    : c.replace(/^unit:|^inst:/, "the ");
  };
  /* `wordOf(dsc, sid)` STOOD HERE and is deleted with the sentence that read
     it: `"it's as " + wordOf(...) + " as it's going to get"`. It existed to
     find the ADJECTIVE or the BARE noun to splice into that comparative, and
     the comparative is one catalogue key now (`refuse.spent`), so nothing
     needs the word. `SUBJ.bare` is still the offering's own routing token. */

  /* ================= THE SENTENCE ========================================
     Assembled by the taps, never read from them.

     ONE SHAPE SINCE 2026-09-01: "make <the thing> <the word>". The paragraph
     that stood here said: "Two of the six verbs take no descriptor, and their
     subject is spelled BARE so a two-tap sentence is real English: 'more
     kick', not 'more the kick'." There is no two-tap sentence any more, so
     four of the five branches went with the four verbs, and `bare` is a
     routing token now rather than a word anybody prints.

     THE TRAILING SPACE IS THE BARE TAP'S. A sentence whose descriptor is null
     is "make the drums" — "just add it" is a TAP, not a word, and what it
     means is the lane the record's own idiom puts in.

     An old note is FOLDED before it is spelled, so a saved record's `more
     drums` reads back as "make the drums louder" rather than as nothing. */
  function sentence(n0) {
    const n = foldNote(n0) || {};
    const V = VERB[n.v], S = SUB[n.s];
    if (!V || !S) return "";
    const dsc = n.d ? (GENRES[n.d] ? n.d : (ADJOF[n.d] ? ADJOF[n.d].w : n.d)) : "";
    // TWO KEYS RATHER THAN A TERNARY INSIDE ONE. It read `"make " + S.w +
    // (dsc ? " " + dsc : "")`: a verb, a subject and a quality in the order
    // English takes them, which is not the order every language takes them.
    return dsc ? TXT.t("produce.sentence", { name: S.w, quality: dsc })
               : TXT.t("produce.sentenceBare", { name: S.w });
  }

  /* ================= WHAT MAY BE SAID ====================================
     A TABLE, not a parser guess — and the table is computed against THIS
     RECORD, which is the difference between a menu and an offer. A target is
     offered for a subject only if the FIRST PRESS would move that record's
     projection by at least epsilon: half a catalog standard deviation on a
     number, one noun it disagrees about, or eight moved sixteenths. That
     kills "I tapped it and nothing happened", and it maintains itself as the
     catalog grows. */
  function firstStep(model, secs, sid, gid) {
    const A = GENRES[gid]; if (!A) return 0;
    const rows = (SCOPEFIELDS[sid] || SCOPEFIELDS.record)();
    const sd = sdOf();
    const g = secs[0] && secs[0].genre; if (!g) return 0;
    const grids = !(g.meter && g.meter.steps !== 16);
    const noKit = kitless(secs);
    let score = 0;
    for (const [path, kind, from, who] of rows) {
      if (noKit && who === "kit") continue;            // the kitless fence, scored
      const tgt = from(A);
      if (tgt === undefined) continue;
      const rest = path.split(".").slice(1);
      const field = rest[rest.length - 1];
      if (kind === "grid") {
        if (!grids) continue;
        const lane = rest.join(".").replace(/^kit\./, "");
        const cur = (g.kit || {})[lane];
        if (!cur && !tgt) continue;
        if (!cur || !tgt) { score += EPS_STEPS; continue; }
        if (cur.length !== tgt.length) continue;
        let n = 0; for (let i = 0; i < cur.length; i++) if (cur[i] !== tgt[i]) n++;
        score += Math.round(START * n);
      } else if (kind === "noun") {
        const cont = peek(secs[0], path);
        if (cont === undefined) continue;
        if (!same(cont, tgt)) score += EPS_STEPS;      // one noun it disagrees about
      } else if (kind === "num") {
        const cont = peek(secs[0], path);
        const c0 = num(cont) ? cont : null;
        if (c0 == null || !num(tgt)) continue;
        const s = sd[field] || 0.1;
        if (Math.abs((tgt - c0) * START) >= 0.5 * s) score += EPS_STEPS;
      } else if (kind === "obj") {
        const cont = peek(secs[0], path);
        if (tgt && typeof tgt === "object" && (!cont || !same(cont, tgt))) score += 2;
      }
    }
    return score;
  }
  function peek(sec, path) {
    const parts = path.split(".");
    let o = parts[0] === "mel" ? (sec.melody && sec.melody.genre)
          : parts[0] === "voice" ? (sec.voice && sec.voice.genre)
          : parts[0] === "song" ? null
          : sec.genre;
    for (let i = 1; i < parts.length; i++) { if (o == null) return undefined;
      o = o[parts[i]]; }
    return o;
  }

  // WHICH SUBJECTS A VERB MAY TAKE ON THIS RECORD. The same law as the
  // descriptor offering, one level up: a verb that takes no descriptor is a
  // two-tap sentence, so the record-dependent test has to happen HERE or
  // never. "Less bass line" on a record whose bass already holds one note is
  // as sparse as it is going to get, and offering it would be the lie the
  // epsilon rule exists to prevent.
  // THE RECORD THE OFFERING IS ABOUT IS THE ONE PLAYING, notes and all. The
  // page hands the offering the BASE sections; the stack on top of them is
  // what you are listening to, and a subject the stack has already taken away
  // (or brought in) must be offered accordingly. Probing on top of the stack
  // is exactly what tapping does — addNote appends, run applies in order.
  let STANDK = "", STANDC = null;
  function standing(model, secs) {
    if (!notesOf(model).length) return secs;
    const key = sig(model, secs);
    if (STANDK === key && STANDC) return STANDC;
    let out = secs;
    try { out = run(model, secs).secs; } catch (e) { out = secs; }
    STANDK = key; STANDC = out;
    return out;
  }
  // ONE RECORD'S MENU AT A TIME, whole. It was one entry keyed on the VERB,
  // and the page draws six verbs in a row, so every redraw threw the answer
  // away and re-probed. A Map cleared when the record's signature changes is
  // the same cache with the right key.
  let MENUK = "", MENU = new Map();
  const memo = (key, make) => { const k2 = key.k;
    if (MENUK !== k2) { MENUK = k2; MENU = new Map(); }
    if (MENU.has(key.s)) return MENU.get(key.s);
    const v = make(); MENU.set(key.s, v); return v;
  };
  function subjectsFor(model, secs0, verb) {
    if (!VERB[verb]) return [];
    const secs = standing(model, secs0);
    return memo({ k: sig(model, secs0), s: "s|" + verb }, () => SUBJ.filter((s) => {
      if (!takes(verb, s.id)) return false;
      // THE RECORD WITH NO KIT HAS NO DRUMMER TO TALK TO, whichever verb is
      // asking. Said at the offering as well as at the mover, because a
      // sentence that has to be refused after the fact is a sentence that
      // should not have been on the page (the law, both halves).
      if (isDrum(SUB[s.id]) && kitless(secs)) return false;
      // A SUBJECT IS OFFERED ONLY WHERE IT HAS SOMETHING TO SAY.
      // This used to say `return true` — its descriptors decide — and that
      // is exactly half a rule: the DESCRIPTOR list is computed against the
      // record, so a subject whose list comes back empty was a noun you
      // could press to reach a menu with nothing in it. Measured on a house
      // record: "add" offered `the keys`, and targetsFor answered with zero
      // targets. Withholding a subject whose target list is empty removes
      // exactly zero sayable sentences, by construction.
      //
      // THE TWO-TAP PROBE THAT STOOD BESIDE IT WENT WITH THE FIVE VERBS
      // (2026-09-01). It read: `if (VERB[verb].d !== "no") return targetsFor(
      // ...).length > 0;` and then, for a verb that took no descriptor, ran
      // the whole stack once at 0.95 to ask whether the two-tap sentence moved
      // anything. Every sentence has a descriptor now, so the first half is
      // the whole rule. `wouldVerb` itself STAYS: speak still asks it about a
      // BARE sentence ("not yet — push it further").
      return targetsFor(model, secs0, verb, s.id).length > 0;
    }));
  }

  // one cache per record shape — the offering is walked over 122 anchors and
  // a page redraws on every tap
  function targetsFor(model, secs0, verb, sid) {
    if (!VERB[verb] || !SUB[sid]) return [];
    const secs = standing(model, secs0);
    if (isDrum(SUB[sid]) && kitless(secs)) return [];      // the kitless fence
    const model2 = { song: model.song };          // the stack is IN `secs` now
    return memo({ k: sig(model, secs0), s: verb + "|" + sid }, () => targets(model2, secs, verb, sid));
  }
  function targets(model2, secs, verb, sid) {
    const out = [];
    if (verb !== "make") return out;
    const S = SUB[sid];
    const g0 = secs[0] && secs[0].genre;
    const grids = !(g0 && g0.meter && g0.meter.steps !== 16);
    /* ONE WALK OF THE CATALOG, IN THE ATLAS'S OWN ORDER, AND TWO REASONS TO BE
       ON IT (the second folded in 2026-09-01 from the retired `add` verb):
         · the first press would move this record by at least epsilon, or
         · this record has never had a lane this anchor's kit plays — "add the
           crash, punk" was its own sentence and is "make the drums punk" now,
           the same anchor either way.
       One walk rather than two lists concatenated, because a genre's rank is
       the where/when list's rank (:68) and two sorted lists joined end to end
       is not one sorted list. `canAdd` is asked only where the epsilon test
       already said no, so the cost is unchanged on the anchors that pass. */
    for (const gid of GENRE_KEYS)
      if (firstStep(model2, secs, sid, gid) >= EPS_STEPS ||
          (S && S.lane && canAdd(secs, S, GENRES[gid], grids, true)))
        out.push({ id: gid, w: gid, label: GENRES[gid].label, kind: "genre" });
    // AN ADJECTIVE IS ASKED THE SAME QUESTION, AND ANSWERS IT BY DOING IT.
    // A genre's first step is cheap to predict (firstStep walks its own
    // field rows), an adjective's is not — "sparser" on a record with no
    // hats and "let it ring" on a bass are both perfectly good words and
    // both move nothing HERE. There are two dozen of them, so the honest
    // test is the cheap one: make the move and see. Same epsilon law,
    // same reason.
    for (const a of ADJ)
      if (a.on.includes(asOf(sid)) && wouldMove(model2, secs, sid, a.id))
        out.push({ id: a.id, w: a.w, kind: "adj" });
    // "just add it" is only offered where the record's own idiom has something
    // to put in (ADDPAT, or a chair that is actually out)
    if (wouldAdd(model2, secs, sid)) out.push({ id: null, w: "just add it", kind: "bare" });
    return out;
  }
  // ...pressed to the top of its ladder, because the thresholds are
  // staggered and a first press can honestly be below all of them
  // ...and the BARE sentence is asked the same way: a note with no descriptor
  // at all, pressed to the top of its ladder. It said `v: "add"` until
  // 2026-09-01; the branch it probes is the same branch, under the one verb.
  const wouldAdd = (model, secs, sid) => {
    try { const r = run({ ...model, prod: [{ v: "make", s: sid, w: 0.95 }] }, secs);
          return !!(r.said[0] && r.said[0].moved); } catch (e) { return false; }
  };
  // the same question a two-tap sentence has to ask: does this verb move
  // this subject AT ALL, pressed to the top of its ladder?
  const wouldVerb = (model, secs, verb, sid) => {
    try { const r = run({ ...model, prod: [{ v: verb, s: sid, w: 0.95 }] }, secs);
          return !!(r.said[0] && r.said[0].moved); } catch (e) { return false; }
  };
  const wouldMove = (model, secs, sid, dsc) => {
    try { const r = run({ ...model, prod: [{ v: "make", s: sid, d: dsc, w: 0.95 }] }, secs);
          return !!(r.said[0] && r.said[0].moved); }
    catch (e) { return false; }
  };
  // ...keyed on the stack too, since the offering is computed on top of it,
  // and on the IDENTITY of the sections it was handed: the page recomposes
  // them whenever anything about the record changes (a hand answer, a new
  // section), and a fingerprint of a handful of fields cannot see a move
  // that landed on any of the others.
  let SECN = 0; const SECID = new WeakMap();
  const idOf = (secs) => { let n = SECID.get(secs);
    if (n === undefined) { n = ++SECN; SECID.set(secs, n); } return n; };
  const sig = (model, secs) => JSON.stringify([secs.length, idOf(secs),
    notesOf(model).map((n) => [n.v, n.s, n.d || "", n.w]),
    secs[0] && secs[0].genre && Object.keys(secs[0].genre.kit || {}),
    secs[0] && secs[0].genre && [secs[0].genre.drumkit, secs[0].genre.bassStyle,
      secs[0].genre.artic, (secs[0].genre.meter || {}).steps],
    model.song.bpm]);

  /* ================= THE NOTES ARE THE INTERFACE =========================
     A statement is not fire-and-forget. It is a LINE the record remembers,
     with a plus and a minus and a percentage, and the record IS the base
     plus the visible stack. Undo is removing a line. */
  // ...AND EVERY READER COMES THROUGH HERE, which is what makes the alias
  // door (`foldNote`, under THE VERB above) ONE door: `run`, `sig`, `addNote` and ui/produce.js's own
  // `produced()` all read the stack through this function, so an old note is
  // folded once and written back folded the first time the stack is touched.
  const notesOf = (m) => foldNotes(Array.isArray(m && m.prod) ? m.prod : []);
  const withNotes = (m, list) => ({ ...m, prod: list });
  function addNote(m, verb, sid, dsc) {
    const list = notesOf(m);
    // THE SAME DOOR ON THE WAY IN. A caller saying an old verb (a share link,
    // a console, a gate written before 2026-09-01) lands the note it MEANT,
    // and the dedupe below then compares like with like.
    const n0 = foldNote({ v: verb, s: sid, ...(dsc ? { d: dsc } : {}), w: START });
    // SAYING IT AGAIN IS NOT A SEVENTH NOTE, IT IS A PUSH — checked before
    // the ceiling, because "make the drums punk" said twice must go further
    // even when the stack is full.
    const at = list.findIndex((n) => n.v === n0.v && n.s === n0.s &&
                                     (n.d || null) === (n0.d || null));
    if (at >= 0) return bump(m, at, +1);
    // TEN, and this trailing comment said "five or six things" until
    // 2026-08-26 — the number MAXNOTES was RAISED FROM, left standing beside
    // the constant that had already stopped being it (:73). A stale ceiling in
    // the one line that enforces the ceiling is exactly the sentence somebody
    // reads when they are asking "how many can I say?", and the answer they
    // take away is wrong by four. Paul: "the producer is supposed to be able
    // to say ten things not just one."
    if (list.length >= MAXNOTES) return m;
    return withNotes(m, [...list, n0]);
  }
  function bump(m, i, dir) {
    const list = notesOf(m); const n = list[i]; if (!n) return m;
    const w = dir > 0 ? up(n.w) : down(n.w);
    if (w <= 0) return dropNote(m, i);
    if (w === n.w) return m;
    const out = list.slice(); out[i] = { ...n, w };
    return withNotes(m, out);
  }
  const dropNote = (m, i) => { const list = notesOf(m);
    if (!list[i]) return m;
    const out = list.filter((_, j) => j !== i);
    return out.length ? withNotes(m, out) : (() => { const m2 = { ...m };
      delete m2.prod; return m2; })(); };
  const clearNotes = (m) => { const m2 = { ...m }; delete m2.prod; return m2; };

  // FAM / pickInstr / ownGenre are exported for ONE caller and it is named
  // here: ui/produce.js, which builds a cast out of a document's own voices.
  // It needs FAM to say which adjective family an instrument belongs to
  // (`as`), pickInstr to give a projected chair the same `noun` target the
  // shipped chair rows get, and ownGenre because a row's own `out`/`in` moves
  // the section genre and MUST take the same copy-on-write flag every other
  // writer in this file takes — a second spelling of `sec.__ownG` is how the
  // base record gets edited under the page.
  return { VERBS, VERB, SUBJ, SUB, ADJ, ADJOF, NOUN_TH, NUM, OBJ, GROUPS,
           FAM, pickInstr, ownGenre,
           PRIORITY, CREATE_TH, DELETE_TH, SCOPEFIELDS, DENS, ADDPAT,
           ALPHA, START, MAXNOTES, MAXW: 1, up, down, pct, takes,
           gridMove, sdOf, firstStep, targetsFor, subjectsFor, sentence, opWord,
           liveLanes, livesOn, liveChans,
           run, produce, notesOf, addNote, bump, drop: dropNote, clearNotes };
});
