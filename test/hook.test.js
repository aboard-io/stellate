// test/hook.test.js — DOES PRESSING REWRITE CHANGE THE TUNE? (2026-08-27)
//
// Paul, on staging: "No matter how many times I hit REWRITE the hook is the
// same on Iranian pop." He was right, and it was never an Iranian pop bug:
// measured over 191 anchors x 8 seeds, NOT ONE anchor's hook changed its
// rhythm and NOT ONE changed its degrees. The seed reached compose(), moved
// the arrangement, and died before the tune — `cellOf` took no seed at all and
// `Id.toPhrase` is pure and memoised on the words it was handed.
//
// This gate is the ear's question asked in numbers, and it asks it of the
// ARTIFACT: it reads the `play` and `deg` rows of the DOCUMENT precompose
// hands back, not the words that made them, because a reading that printed
// three new words and rendered the same sixteen steps would be the same
// complaint with better paperwork.
//
// SIX THINGS, in order:
//   1  ten rewrites of iranpop are ten hooks
//   2  the whole catalog moves, not one genre
//   3  nothing became a coin toss (same seed -> byte-identical record)
//   4  an anchor that states what its music is keeps it at every reading
//   5  a record already written down does not move at all
//   6  EVERY SLOT MOVES, not only the hook (Paul, 2026-08-27: "the 'topline'
//      is the same as always for tehran 1974")
"use strict";
const assert = require("assert");
const path = require("path");
const crypto = require("crypto");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));

const NG = R("genres.js"), K = R("kernel.js"), Id = R("ideas-kit.js");
const Doc = R("document.js"), P = R("precompose.js"), NuSongs = R("songs.js");
const { GENRES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};

const ANCHORS = P.anchors();
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const J = (x) => JSON.stringify(x);
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

/* THE HOOK, off the document. `material.cells.hook` is slot 0 — the idiom
   itself, KINDS.hook = {} — and a record that deals no hook slot falls back to
   its first line cell, because "a record is never cell-less" is precompose's
   own law and this gate must not skip the records it protects. */
function hookOf(doc) {
  const cells = (doc.material && doc.material.cells) || {};
  return cells.hook || Object.values(cells).find((c) => c && c.kind === "line");
}
// the RHYTHM, as the document spells it: n a note, h held, r a rest
/* FOLDED PER BAR since the two-bar release (2026-09-01): a cell is 1 or 2
   bars now, and WHICH of the two an anchor gets can flip seed-to-seed with
   the form's own drawn section lengths. A 32-step cell whose two bars are
   the same figure is the same RHYTHM as its 16-step reading — comparing raw
   strings called that a variation and unfroze three decided rows whose bars
   had not moved. The fold compares the SET of distinct bars, so a genuinely
   varied second bar still counts as variation and a restated one does not. */
const rhythmOf = (c) => {
  const raw = c.play.join("");
  const spb = c.play.length % 16 === 0 ? 16 : c.play.length % 12 === 0 ? 12 : c.play.length;
  const bars = [];
  for (let i = 0; i < raw.length; i += spb) bars.push(raw.slice(i, i + spb));
  return [...new Set(bars)].sort().join("|");
};
// what an ear would call the hook: which steps sound, and on which degree
const hookLine = (c) => {
  const out = [];
  for (let i = 0; i < c.play.length; i++) if (c.play[i] === "n") out.push(i + ":" + c.deg[i]);
  return out.join(" ");
};
const onsetsIn = (c) => c.play.filter((x) => x === "n").length;

/* THE LEGAL FIGURES FOR ONE (ANCHOR, SLOT) — precompose §6b's rule, written
   again here rather than imported, because a gate that asked the code what it
   was allowed to do would agree with any bug the code had. Two sections read
   it: §4 (nothing left its space) and §6 (the space is wide enough to hear).
     · an anchor's stated `cell` is its DENSITY BAND — "the 303 is a
       sixteenth-note machine" is a claim about density, not a serial number
     · a KIND's stated `cell` is its band PLUS THE BANDS EITHER SIDE (2026-08-27
       — a pad that plays three long notes is still a pad), narrowed to the
       anchor's band where the anchor states one and the two overlap
     · a POOL OF ONE IS A PIN, and that is the only exemption any gate here
       grants: it is computed, never a list of names typed out. */
const CELLS = Object.keys(Id.CELLS);
const BANDS = ["held", "short", "moving", "running"];
const onsets = (c) => Id.CELLS[c].g.filter((v) => v === 1).length;
const bandOf = (c) => { const n = onsets(c);
  return n <= 2 ? "held" : n <= 3 ? "short" : n <= 5 ? "moving" : "running"; };
const bandOfCell = (c) => {                             // off the DOCUMENT's own row
  /* PER BAR since the two-bar release (2026-09-01): the density words were
     always claims about a BAR ("two notes a bar" is `long`'s own comment),
     and a two-bar cell of the same figure counts twice the onsets — artrock's
     held line read "short" the day cb reached 2, with not one onset moved.
     cb is read off the cell itself, the same way the precompose mirror reads
     it: its play vector is cb bars of steps. */
  const len = Array.isArray(c.play) ? c.play.length : String(c.play || "").length;
  const spb = len % 16 === 0 ? 16 : len % 12 === 0 ? 12 : len;
  /* ...AND THE BAND IS THE DENSEST BAR'S, not the average: the sentence may
     rest its second bar (nordicscore's riff states a moving figure and its
     `develop` bar breathes — six slots read "short" under an average), and a
     figure does not leave its band by pausing. The claim is about the figure
     AS STATED; the statement is the densest bar. */
  const pv = Array.isArray(c.play) ? c.play : [...String(c.play || "")];
  let best = 0;
  for (let i = 0; i < pv.length; i += spb) {
    let n = 0;
    for (let j = i; j < Math.min(i + spb, pv.length); j++)
      if (pv[j] === "n") n++;               // the file's own onset predicate (onsetsIn)
    best = Math.max(best, n);
  }
  const n = best;
  return n <= 2 ? "held" : n <= 3 ? "short" : n <= 5 ? "moving" : "running"; };
const nearBands = (c) => { const i = BANDS.indexOf(bandOf(c));
  return BANDS.slice(Math.max(0, i - 1), i + 2); };
function cellPool(g, k) {
  const own = P.IDIOM_ANCHOR[g] || {}, kind = P.KINDS[k] || {};
  if (kind.cell != null) {
    const n = CELLS.filter((c) => nearBands(kind.cell).includes(bandOf(c)));
    if (own.cell == null) return n;
    const inside = n.filter((c) => bandOf(c) === bandOf(own.cell));
    // the kind's word as written is always drawable — reading 1 plays it
    return inside.length ? [kind.cell].concat(inside.filter((c) => c !== kind.cell)) : n;
  }
  return own.cell == null ? CELLS : CELLS.filter((c) => bandOf(c) === bandOf(own.cell));
}

console.log("hook — " + ANCHORS.length + " anchors, seeds " + SEEDS.join(",") + "\n");

/* ======================================================================
   1 · TEN REWRITES OF IRANIAN POP ARE TEN HOOKS
   ====================================================================== */
ok("iranpop: 10 rewrites, >= 8 distinct hooks and >= 5 distinct rhythms", () => {
  const lines = [], rhythms = [];
  console.log("\n  the ten readings of iranpop — rhythm, then step:degree\n");
  for (let s = 1; s <= 10; s++) {
    const d = P.genreToDocument("iranpop", s);
    const c = hookOf(d);
    lines.push(hookLine(c)); rhythms.push(rhythmOf(c));
    console.log("    seed " + String(s).padStart(2) + "  key " +
                String(d.alphabet.key).padStart(3) + "  " +
                rhythmOf(c).replace(/r/g, ".") + "   " + hookLine(c));
  }
  console.log("");
  const dh = new Set(lines).size, dr = new Set(rhythms).size;
  console.log("    distinct hooks " + dh + "/10   distinct rhythms " + dr + "/10\n");
  assert(dh >= 8, "only " + dh + " distinct hooks in ten rewrites");
  assert(dr >= 5, "only " + dr + " distinct rhythms in ten rewrites — the ear " +
                  "names the rhythm, and half of ten is the floor");
});

/* ======================================================================
   2 · THE WHOLE CATALOG MOVES
   ======================================================================
   Not iranpop: every anchor in the box, across eight readings. The FRACTION
   is the number, because the bug was universal and a fix that reached one
   family would be the same bug on a shorter list.

   THE FIVE THAT DO NOT MOVE THEIR RHYTHM ARE NAMED, and named here rather
   than counted, because they are a DECISION: drone, dub, ambient, enka and
   arabesk each state `cell: "long"` on their own IDIOM_ANCHOR row, `long` is
   alone in its density band (two onsets in the bar — precompose §6b), and a
   band of one is a pin. A drone is a drone. They move on contour, landing and
   key like everything else. */
/* ...AND THE TWO GENEALOGY ROUNDS OF 2026-08-29 GREW THE BAND. The list below
   was five when the catalogue was 201; the rounds that took it to 282 seated
   ten more rows whose IDIOM_ANCHOR states `cell: "long"` BY ARGUMENT — a
   gagaku is a held court line, furnituremusic's refusal to develop IS the idiom,
   dubstep and gqom are the drone against the broken kick, modaljazz is
   bebop's opposite (space), triphop and chopped are dub's row at other
   tempos, ottoman's taksim rises through a held line, gothicrock and
   psychrock carry the journey-out line. Same pin, same reason: `long` is a
   band of one. They move on contour, landing and key like everything else —
   the degree and key asserts below still hold them to that. The ratio assert
   also changed from a typed 0.95 to the DERIVED complement of this list,
   because a threshold that has to be re-typed every time the catalogue grows
   is a number waiting to be wrong. */
/* ...AND DEEP TIME ADDED FOUR (2026-08-30, measured, not guessed — the round's
   own candidate list named jiahu, skolion and oxyrhynchus, and all three
   VARY: a three-note cell deals like any other however old the tune is. What
   freezes is what always freezes, the long cell: hohlefels (a bone flute's
   held tone in a cave), hurrian (the contested line held long), dreampop and
   doom (the two forward rows that argue for the drone's band). */
/* ...AND THE GOTH-AND-GLOBE ROUND ADDED TWO (2026-08-30) — and for once the
   round PREDICTED its own freezes: its handoff table warned that adopting
   nordicjazz's held ECM line and witchhouse's chopped-an-octave-darker row
   "will likely freeze its hook rhythm", and the measurement agreed exactly:
   those two froze, gypsyjazz and japanjazz (gallop, hang) did not. */
/* ...AND THE DOWNTEMPO ROUND ADDED THREE (2026-08-30): the round predicted
   viennadownbeat ("dub's own row — likely freeze") and it froze; knowlewest
   and torchbreaks joined on the same law — the long cell is the freeze, whatever
   the contour and sentence do around it. bristolsound and instrumentalhiphop, the
   two the prediction watched, did NOT freeze: riff and even deal on. */
/* ...AND THE HEARTH-AND-SCREEN ROUND ADDED TWO (2026-08-30), both predicted
   by the round itself, both long-cell: seannos (Joe Heaney's unmetered line)
   and copshowsynth (the mood synth is long-cell country, as the ask said). */
/* 26 -> 28, 2026-09-01, MEASURED and not guessed: `artrock` and `beiruttarab`
   joined when the ten named acts got idioms of their own. Both take a two-
   onset figure — Radiohead's long falling line and Fairuz's long hovering one
   — and a hook with two onsets has no rhythm left to vary, which is exactly
   the property this list records. Measured the way the gate measures: eight
   seeds each, the document's own `play` string, and only these two changed.
   Nothing fell OUT of the list, which is the other half of the check. */
/* ...AND THE CHORDONOMICON GAPS ADD EXACTLY ONE (2026-09-02): `chamberpop`
   (Boston 1994, Cardinal). Three of that round's four new rows are BANDS and
   none of them is here — folkrock's twelve-string is `even` (continuous
   eighths), countryrock's turnaround is `pickup`, heartlandrock's shout is
   `call` — and the fourth is the one whose whole argument is that it is NOT a
   band: an arranged line, written down, against everything 1994 sounded like.
   Its idiom is `long` (two onsets a bar, this box's sparsest cell) with
   `sent: "hold"`, which is the same pair `artrock`, `nordicscore` and
   `epichybrid` already stand on, and the freeze is what that pair MEANS — the
   rhythm is the arrangement's and the DEGREES still move at every reading,
   which the sweep below confirms (hook degrees vary at every anchor with a
   tune). A chamber-pop line whose rhythm re-rolled per seed would be a band
   improvising, which is the one thing the row exists to refuse. */
const FROZEN_RHYTHM = ["ambient", "arabesk", "artrock", "beiruttarab",
                       "chamberpop",
                       /* ...AND THE WESTERN CLASSICAL ROUND'S FOUR
                          (2026-09-03, Paul: "we should have lots of
                          representative classical genres"). All four state a
                          `long` cell — two onsets a bar, this box's sparsest —
                          and a two-onset bar has one rhythm, so they compose
                          the same figure at every seed and move their DEGREES
                          instead, which is the decision `chamberpop`,
                          `artrock`, `epichybrid` and `nordicscore` are already
                          on this list for. FOR THESE FOUR IT IS NOT A
                          CONCESSION, IT IS THE SUBJECT: a Song Without Words,
                          a symphonic poem's motto, a Wagnerian line and a
                          Debussy phrase are WRITTEN SCORES, and a written
                          score whose rhythm re-rolled every reading would be
                          somebody improvising over it.
                          AND THE FIFTH ROW OF THAT BATCH IS DELIBERATELY NOT
                          HERE: `verismo` was drafted with the same `long` cell,
                          this sweep froze it, and it took `hang` instead —
                          hiphopsoul's ruling one batch earlier, applied to
                          the one row of the five with a person singing on it.
                          (It also settled which field owns the freeze: the
                          CELL, not the sentence. musicdrama was written with
                          `sent: "vary"` on purpose to stay off this list and
                          froze anyway; precompose.js's own comment now says
                          so.) */
                       "characterpiece",
                       // ...and the soundtrack round's two (2026-09-01), each
                       // frozen BY ITS OWN CLAIM: `epichybrid`'s braam is
                       // "one note, most of a bar" (IDIOM_ANCHOR cell `long`
                       // + contour `hold` — the band of one is a pin), and
                       // `nordicscore` is the drone school taking a scoring
                       // job (`long` + sent `long`). A braam that varied its
                       // rhythm per reading would stop being the braam.
                       // (Keys are the 2026-09-01 great-rename spellings;
                       // the LIST IS SORTED because the assertion sorts.)
                       // THE TWO-BAR RELEASE CHANGED NOTHING HERE, and the
                       // proof cost a wrong edit (2026-09-01): raw-string
                       // comparison briefly unfroze artrock/enka/psychrock,
                       // but their only "variation" was cell LENGTH flipping
                       // with the form's own drawn section lengths — folded
                       // per bar (rhythmOf above), all three figures stand
                       // still, `sent: "vary"` on enka/psychrock reaching
                       // degrees and octaves, never the rhythm. The list is
                       // a transcript of decisions and it survived the
                       // ceiling intact.
                       "chopped", "copshowsynth", "doom", "dreampop", "drone",
                       "dub", "dubstep", "enka", "epichybrid",
                       "furnituremusic", "gagaku", "gothicrock", "gqom",
                       "hohlefels", "hurrian",
                       "impressionism",                 // the classical round
                       "knowlewest", "modaljazz",
                       "musicdrama",                    // the classical round
                       "nordicjazz", "nordicscore", "ottoman", "postbritpop",
                       // ...AND THE MOTOWN ROUND'S ONE (2026-09-03, Paul:
                       // "Some things missing include a lot of motown").
                       // `progressivesoul` (Detroit 1971, What's Going On)
                       // is the SAME decision this list already holds for
                       // artrock, nordicscore, epichybrid and chamberpop: a
                       // `long` cell (two onsets a bar, this box's sparsest)
                       // with `sent: "long"` has one rhythm and moves its
                       // DEGREES at every reading, which it does. It is also
                       // the row's whole argument — the only `plan: "arc"`
                       // row in the soul family, an album-length written
                       // statement rather than a three-minute single, and a
                       // line whose rhythm re-rolled per seed would be the
                       // band improvising, which is the thing this record
                       // stopped doing. THE ROUND'S OTHER SIX ARE NOT HERE
                       // and one of them was, briefly: `hiphopsoul` was
                       // drafted with the same `long` cell and this sweep
                       // froze it, which is right for an arrangement and
                       // WRONG FOR A SINGER — Blige phrases the line
                       // differently every take — so its idiom row took the
                       // soul family's own `pickup` instead and it varies
                       // at 8 of 8 readings. The measurement chose, not the
                       // taste.
                       "progressivesoul",
                       "psychrock", "seannos",
                       // ...AND THE BLANK STATE (2026-09-01). Paul: "Add a
                       // 'silence' genre at the top of the genre list. This is
                       // a blank state." Its one cell is sixteen rests, by
                       // declaration (`silent: true`, precompose's third named
                       // exemption), so its rhythm is frozen for the same
                       // reason its degrees are: a blank page that came back
                       // different at every reading would be a blank page with
                       // an opinion. It joins the transcript rather than being
                       // filtered out of the sweep, because the list is a
                       // record of decisions and this is one.
                       "silence", "smoothjazz",
                       "symphonicpoem",                 // the classical round
                       // ...AND THE MIDI-CORPUS ROUND'S TWO (2026-09-02), and
                       // they are both the SAME decision the list already
                       // holds for artrock, nordicscore and epichybrid: a
                       // `long` cell (two onsets a bar, this box's sparsest)
                       // with `sent: "hold"` over an eight-bar phrase has one
                       // rhythm and varies its DEGREES, which both of these
                       // do at every reading. Each was measured into that
                       // shape rather than chosen — postbritpop's corpus
                       // holds notes to a p90 of 15.9 sixteenths and
                       // smoothjazz's to 14.4, the two longest sustains of
                       // the round — so freezing the rhythm is what the
                       // measurement asked for and this is the transcript
                       // saying so. (Both sit in SORT ORDER below, not
                       // here — the assertion is a deepStrictEqual against
                       // the sorted sweep.)
                       "torchbreaks", "triphop", "viennadownbeat",
                       "witchhouse"];
/* THE ONE ROW WHOSE DEGREES ARE FROZEN TOO, and it is the same row: the
   assertion below reads "hook degrees frozen at N anchors" and that is right
   for every record with a tune. Named off the field, not the key. */
const NO_TUNE = ANCHORS.filter((g) => GENRES[g].silent);
ok("catalog: hook rhythm and degrees vary at nearly every anchor", () => {
  let rv = 0, dv = 0, kv = 0; const frozen = [];
  for (const g of ANCHORS) {
    const rs = new Set(), ds = new Set(), ks = new Set();
    for (const s of SEEDS) {
      const d = P.genreToDocument(g, s), c = hookOf(d);
      rs.add(rhythmOf(c)); ds.add(c.deg.join(",")); ks.add(d.alphabet.key);
    }
    if (rs.size > 1) rv++; else frozen.push(g);
    if (ds.size > 1) dv++;
    if (ks.size > 1) kv++;
  }
  const n = ANCHORS.length;
  console.log("\n    " + n + " anchors x " + SEEDS.length + " seeds");
  console.log("      hook RHYTHM varies   " + rv + "/" + n + "  " + (rv / n).toFixed(3));
  console.log("      hook DEGREES vary    " + dv + "/" + n + "  " + (dv / n).toFixed(3));
  console.log("      record KEY varies    " + kv + "/" + n + "  " + (kv / n).toFixed(3));
  console.log("      rhythm-frozen: " + (frozen.join(" ") || "none") + "\n");
  assert(n >= 50, "the sweep must cover at least 50 anchors, covered " + n);
  assert(rv === n - FROZEN_RHYTHM.length, "hook rhythm varies at " + rv +
         " of " + n + " anchors; expected all but the " + FROZEN_RHYTHM.length +
         " decided long-cell rows");
  assert(dv === n - NO_TUNE.length, "hook degrees frozen at " + (n - dv) +
         " anchors, expected only the " + NO_TUNE.length + " with no tune (" +
         NO_TUNE.join(" ") + ")");
  assert(kv === n, "key frozen at " + (n - kv) + " anchors");
  assert.deepStrictEqual(frozen.slice().sort(), FROZEN_RHYTHM,
    "the rhythm-frozen list is a DECISION and it changed: " + frozen.join(" "));
});

/* ======================================================================
   3 · NOTHING BECAME A COIN TOSS
   ======================================================================
   The determinism law, asserted on the SERIALIZED document because that is
   what gets saved, shared and reloaded. Twice through, INTERLEAVED — the
   second pass runs after every other anchor has been composed, so a phrase
   cache keyed on too little (ideas-kit PHCACHE) fails here instead of in a
   browser three weeks from now. */
ok("determinism: same seed, byte-identical document, 20 anchors x 8 seeds", () => {
  const twenty = ANCHORS.filter((_, i) => i % Math.floor(ANCHORS.length / 20) === 0).slice(0, 20);
  const first = new Map();
  for (const g of twenty) for (const s of SEEDS) first.set(g + "/" + s, J(P.genreToDocument(g, s)));
  let n = 0;
  for (const g of twenty) for (const s of SEEDS) {
    const again = J(P.genreToDocument(g, s));
    assert.strictEqual(again, first.get(g + "/" + s), g + " seed " + s + " is not deterministic");
    n++;
  }
  console.log("    " + twenty.length + " anchors, " + n + " documents, all byte-identical on re-composition");
});

/* ======================================================================
   4 · AN ANCHOR KEEPS WHAT IT SAID ABOUT ITSELF
   ======================================================================
   IDIOM_ANCHOR is 54 rows of an anchor stating what ITS music is, and §6b
   binds each word differently: a stated `contour` is PINNED (the gesture),
   a stated `cell` binds its DENSITY BAND (the figure — "the 303 is a
   sixteenth-note machine" is a claim about density, not a serial number),
   a stated `land` is OPEN (a bop head that resolves to the root is still a
   bop head), and a stated `len`, `sent` or `reg` cannot reach a one-bar cell
   at all.

   READ BACK OFF THE ARTIFACT. This does not ask precompose what it drew: it
   builds every cell the anchor is ALLOWED to produce — the legal space —
   and asserts the cell in the document is one of them. A contour that leaked
   past its pin, or a cell that left its band, lands outside that space. The
   space is reported next to the full 10 x 8 x 5 = 400 so it is visible that
   the gate is constraining something. */
ok("idiom respect: every stated axis holds in every slot at every reading", () => {
  /* CEILING 2 SINCE 2026-09-01 (the two-bar release). This line asserted
     CELL_BAR_CEILING === 1 and built the legal space at one bar — correct as
     a transcript of the old decision, wrong the day the decision changed.
     The space below is now built AT EVERY cb THE DOOR MAY CHOOSE (1 and 2 —
     the form's drawn lengths decide per record, so both are reachable), and
     the cell under test must live in the union. Nothing else loosened: the
     contour pin, the density band and the release axis fence exactly as
     they did. */
  assert.strictEqual(P.CELL_BAR_CEILING, 2, "this gate reads up-to-two-bar cells");
  /* ...AND THE BAR IS NOT ALWAYS SIXTEEN STEPS (2026-09-03, the classical
     round). This line read `steps = 16` and built every anchor's legal space
     in a sixteen-step bar, which was true of every IDIOM_ANCHOR row that had
     ever existed — none of them declared a `meter`. `nationalism` (Prague
     1874) is the first that does: its bar is TWELVE steps (kernel METERS.six),
     so its composed cells are 12 or 24 long and could not be in a space built
     at 16 whatever it said about itself. The gate was fencing the wrong bar,
     not catching a wrong cell. `stepsIn` is the kernel's own answer to "how
     long is this genre's bar" and is what precompose composes through, so the
     space is now built at the row's own step count and the fence is the same
     fence for a twelve-step bar as for a sixteen. */
  const CBS = [1, 2];
  const stepsOf = (G) => K.stepsIn(G);
  const CONT = Object.keys(Id.CONTOURS), LAND = Object.keys(Id.LANDINGS);
  const rows = Object.keys(P.IDIOM_ANCHOR).filter((g) => ANCHORS.includes(g));
  // EVERY SLOT, not only the hook: a KIND's own word pins every axis it
  // states, so `riff`, `pad` and `climb` are the tightest cases in the box
  // and skipping them would leave the pin untested where it matters most.
  const spaceCache = new Map();
  const spaceFor = (g, k) => {
    const ck = g + "/" + k;
    if (spaceCache.has(ck)) return spaceCache.get(ck);
    const own = P.IDIOM_ANCHOR[g], G = GENRES[g], row0 = P.idiomOf(g).row;
    /* ...AND THE THEME COUNTS WITH THE RECORD (2026-09-03). precompose's own
       line is `const row = met ? { ...row0, met } : row0` — under a declared
       meter the idiom row carries the meter and ideas-kit's `metOf` regrids
       every cell through it. This gate built its space off the bare row, so
       for a twelve-step anchor it enumerated sixteen-step figures and then
       asserted that a twelve-step one was not among them, which is true and
       is not a finding about the anchor. Same two lines as precompose, on
       purpose: the fence has to count in the bar the record is in. */
    const met = G.meter ? K.METERS[G.meter] : null;
    const row = met ? { ...row0, met } : row0;
    const kind = P.KINDS[k] || {};
    // THE FIGURE is `cellPool` above — a kind's word bands as wide as the
    // bands either side of it since 2026-08-27, an anchor's word as wide as
    // its own. What still PINS a slot is its GESTURE: a `contour` stated by
    // the kind is one value, always, which is what keeps a pad a pad.
    /* ...AND THE SEQUENCER'S GESTURE IS A BAND, NOT A VALUE (2026-08-31).
       Paul: "arps should do different arp things and have little exceptions.
       Not just up and down." So `seq` may draw any of the arpeggio contours
       and an anchor says which with `seqArp` — eurodisco pedals the octave
       because that is I Feel Love, acid leaps because that is a 303,
       berlinschool turns because those cycles are long.

       THIS IS THE SAME SHAPE THE `cell` CASE ABOVE ALREADY HAS, and it is not
       a hole: the pin exists so that "a pad stays a pad", and every member of
       this band climbs a CHORD rather than walking the scale, so a sequencer
       stays a sequencer under all six. What would break the pin is `seq`
       drawing `fall` or `hover`, and this still fails that. The list is
       ideas-kit's own export, not a copy — the fence cannot drift from the
       vocabulary it fences. */
    const pool = (f, all) => f === "cell" ? cellPool(g, k)
      : (k === "seq" && f === "contour") ? Id.ARP_CONTOURS
      /* ...and the SOLO'S GESTURE IS A BAND TOO (2026-09-01, "Art rock has
         the same solo as iranian pop"): climb draws from SOLO_CONTOURS the
         way seq draws from ARP_CONTOURS — every member travels, so a solo
         stays a solo under all five. Its landing was already open here. */
      : (k === "climb" && f === "contour") ? Id.SOLO_CONTOURS
      // ...and its LANDING with it: the maker salts both per anchor (cellOf
      // soloOf), and this gate's own comment has held `land` open all along
      : (k === "climb" && f === "land") ? all
      : kind[f] != null ? [kind[f]]
      : own[f] == null ? all
      : f === "contour" ? [own[f]]
      : all;                                          // `land` is open
    // ...AND THE RELEASE IS AN AXIS OF THE COMPOSED CELL (2026-08-28,
    // precompose §6c). The last onset of a figure has no next onset, so its
    // length was the whole rest of the bar and 84.7% of the catalogue ended on
    // its longest note. `RELEASE` is the word for how that note stops — `ring`
    // is that old law and still the commonest draw, `clip` and `lean` are the
    // two ways a figure ends short — and a record deals it per part on its own
    // stream. It is NOT a claim an IDIOM_ANCHOR row makes about itself (no
    // anchor states one), so it is unconstrained here: every anchor may draw
    // every word, and the space this gate fences has to contain all three or it
    // is fencing the day before the deal landed.
    const legal = new Set();
    const RELS = [null].concat(Object.keys(P.RELEASE).map((w) => ({ rel: w })));
    for (const cb of CBS)
      for (const c of pool("cell", CELLS))
        for (const ct of pool("contour", CONT))
          for (const l of pool("land", LAND))
            for (const rl of RELS)
              legal.add(J(P.cellOf(row, k, cb, G, stepsOf(G),
                                   { cell: c, contour: ct, land: l }, rl).cell));
    spaceCache.set(ck, legal);
    return legal;
  };
  let checked = 0, spaceSum = 0, spaces = 0;
  const bandBust = [];
  for (const g of rows) {
    const own = P.IDIOM_ANCHOR[g];
    for (const s of SEEDS) {
      const cells = P.genreToDocument(g, s).material.cells;
      for (const k of Object.keys(cells)) {
        const c = cells[k];
        if (c.kind !== "line") continue;              // the kit is not a phrase
        // ...AND A DEVELOPED RETURN IS NOT A SLOT (2026-08-28, precompose §6c).
        // A record now carries the part's figure AS STATED under the slot's own
        // name and, beside it, the figure as it comes back — "hook stretched
        // out", "riff cut short" — which is BY CONSTRUCTION outside the space a
        // reading may draw from: development is what happens to a figure after
        // the reading has chosen it, and a return that stayed inside the draw
        // would not be a development. The claim this gate makes is about the
        // SLOT, and the slot is the statement; the developed cells are fenced
        // where they are made (`keepsIts`: two onsets or more, a rest left in
        // the bar, and a density within a doubling of the statement's).
        if (!P.KINDS[k]) continue;
        const legal = spaceFor(g, k);
        assert(legal.has(J(c)), g + " seed " + s + " slot " + k + " composed a cell " +
               "outside what its IDIOM_ANCHOR row allows (" + J(own) + ")");
        // ...and the DENSITY claim, said in the document's own units. It is a
        // SET of bands now and not one word: a kind's figure may sit in the
        // band either side of its own, and the anchor's band is the fence
        // around that when the anchor has one.
        /* ...AND UNDER A DECLARED METER THE BAND IS READ OFF THE COMPOSED CELL,
       NOT OFF THE 16-STEP DEFINITION (2026-09-03, the classical round). The
       four band words are onset counts — two, three, five — written for the
       sixteen-step bar every anchor had until `nationalism` (Prague 1874)
       declared `meter: "six"`. ideas-kit regrids a cell into the twelve-step
       bar and the regrid is not proportional: `even` loses a quarter of its
       onsets and `three` keeps all three, so neither the raw count nor a
       16/12 rescale of it is the same claim. Both were tried and both moved
       rows that had not moved. The honest fence is the one this gate already
       builds: `legal` is every cell the pool composes THROUGH THIS RECORD'S
       OWN GRID, so its bands are the bands the record can reach. Sixteen-step
       records keep the old expression exactly, byte for byte. */
    const want = GENRES[g].meter
      ? new Set([...legal].map((x) => bandOfCell(JSON.parse(x))))
      : new Set(cellPool(g, k).map(bandOf));
        const got = bandOfCell(c);
        if (!want.has(got)) bandBust.push(g + "/" + s + "/" + k + " " + got +
          " not in " + [...want].join("|"));
        checked++;
      }
    }
  }
  for (const v of spaceCache.values()) { spaceSum += v.size; spaces++; }
  assert.deepStrictEqual(bandBust.slice(0, 6), [], "cells left their density band");
  console.log("    " + rows.length + " anchor rows x " + SEEDS.length + " seeds = " +
              checked + " line cells, every one inside its own row's legal space");
  console.log("    mean legal space " + (spaceSum / spaces).toFixed(1) +
              " distinct cells per (anchor, slot), against 400 unconstrained\n");
});

/* ======================================================================
   5 · A RECORD ALREADY WRITTEN DOWN DOES NOT MOVE
   ======================================================================
   Reading variation happens at COMPOSE time. songs.js TERMS is the shipped
   chant — a document somebody wrote down, not a genre somebody composed —
   and no seed exists anywhere on its path. The risk is not that precompose
   edits it; the risk is the SHARED PHRASE CACHE: `Id.toPhrase` is memoised
   across the whole process, so a reading that composed a phrase under a key
   too narrow to tell two readings apart would hand the saved record somebody
   else's tune. So the saved record is rendered BEFORE any composition, then
   again after 199 anchors x 4 readings have gone through the same cache, and
   the two renders must be the same bytes. */
ok("old records: songs.js TERMS renders byte-identical before and after 796 readings", () => {
  const doc = NuSongs.TERMS;
  const render = () => {
    const out = [];
    doc.form.sections.forEach((sec, i) => {
      const g = Doc.toGenre(doc, i, GENRES);
      const lines = doc.voices.filter((v) => v.kind === "line");
      for (const c of lines) {
        const ph = Doc.toPhrase(doc, Doc.materialAt(c, sec.id));
        out.push(sec.id + "/" + c.name + "/" + J(ph));
      }
      out.push(sec.id + "/genre/" + J(g.mode) + "/" + g.bpm);
    });
    return out.join("\n");
  };
  const before = render(), beforeDoc = J(doc);
  let n = 0;
  for (const g of ANCHORS) for (const s of [1, 2, 3, 4]) { P.genreToDocument(g, s); n++; }
  const after = render();
  assert.strictEqual(sha(after), sha(before),
    "the shipped chant rendered differently after " + n + " compositions");
  assert.strictEqual(J(doc), beforeDoc, "composition mutated a saved document");
  console.log("    chant render " + sha(before) + " before, " + sha(after) +
              " after " + n + " compositions; the saved document is unmoved");
  // ...and a precomposed record, SAVED, is the same when it is loaded again:
  // a document is a value, and a reading is not stored inside it anywhere.
  const saved = J(P.genreToDocument("iranpop", 7));
  const reloaded = JSON.parse(saved);
  assert.strictEqual(J(reloaded), saved, "a saved document did not survive a round trip");
});

/* ======================================================================
   6 · EVERY SLOT MOVES, NOT ONLY THE HOOK
   ======================================================================
   Paul, on staging, the day §1 shipped: *"I clicked rewrite multiple times and
   never saw a different seed, and the 'topline' is the same as always for
   tehran 1974."* Measured, and he was right twice: over four presses the
   topline's RHYTHM never moved and exactly one degree changed. §1 asks the
   question of slot 0 only, and the answer for the other eight slots was no —
   six of the nine KINDS state a `cell`, `cell` is the only idiom word that
   reaches the play row at a one-bar cell, and a stated word was a pin.

   THE FLOOR IS THREE DISTINCT RHYTHMS IN EIGHT READINGS, per generated slot,
   and it is a floor and not a count: what an ear is owed is that a second
   press is a second tune, and three different figures in eight presses is the
   smallest number that cannot be one figure with an accident in it.

   UNLESS ITS ANCHOR PINS IT — and a pin here is a POOL OF ONE, computed the
   same way §4 computes the legal space, never a name typed into a list. A
   drone's pad is `long` at every reading because "a drone is a drone", and
   this gate must say that in the same units the code does. */
ok("iranpop: every generated slot shows >= 3 distinct rhythms in 8 readings", () => {
  // the per-slot table, off the ARTIFACT: the document's own `play` rows
  const table = (g) => {
    const seen = new Map(), n = new Map();
    for (const s of SEEDS) {
      const cells = P.genreToDocument(g, s).material.cells;
      for (const k of Object.keys(cells)) {
        const c = cells[k];
        if (c.kind !== "line") continue;
        if (!seen.has(k)) seen.set(k, new Set());
        seen.get(k).add(rhythmOf(c));
        n.set(k, (n.get(k) || 0) + 1);
      }
    }
    return { seen, n };
  };

  const { seen, n } = table("iranpop");
  console.log("\n  iranpop, 8 readings — distinct RHYTHMS per slot\n");
  console.log("    slot        readings  pool  distinct   the rhythms");
  const short = [];
  for (const k of Object.keys(P.KINDS)) {
    if (!seen.has(k)) continue;
    const ps = cellPool("iranpop", k).length, d = seen.get(k).size;
    console.log("    " + k.padEnd(11) + String(n.get(k)).padStart(6) +
                String(ps).padStart(6) + String(d).padStart(8) + "     " +
                [...seen.get(k)].map((r) => r.replace(/r/g, ".")).join("  "));
    if (ps > 1 && d < 3) short.push(k + " " + d);
  }
  console.log("");
  assert.deepStrictEqual(short, [], "slots stuck on one or two rhythms: " + short.join(", "));
  // ...and the slot Paul named, by name, so this cannot pass on the others
  assert(seen.has("topline"), "iranpop stopped dealing a topline — this gate is about that slot");
  assert(seen.get("topline").size >= 3,
    "the topline moved to only " + seen.get("topline").size + " rhythms in eight readings");

  /* AND THE WHOLE CATALOG, as a fraction. A pool of three drawn eight times
     misses one of its three about four times in a hundred, so this is a
     fraction and not a floor — an honest number, measured at 0.975 the day it
     was written (1610 slots over 199 anchors; 22 pinned by an anchor row, 114
     dealt in fewer than six of the eight readings and therefore too thin to
     judge). */
  let pairs = 0, bad = 0, pinned = 0, thin = 0;
  const byKind = new Map();
  for (const g of ANCHORS) {
    const t = table(g);
    for (const k of t.seen.keys()) {
      if (cellPool(g, k).length < 2) { pinned++; continue; }
      if (t.n.get(k) < 6) { thin++; continue; }
      pairs++;
      if (t.seen.get(k).size < 3) { bad++; byKind.set(k, (byKind.get(k) || 0) + 1); }
    }
  }
  const frac = 1 - bad / pairs;
  console.log("    " + ANCHORS.length + " anchors: " + pairs + " judgeable slots, " +
              bad + " under three rhythms — " + frac.toFixed(3));
  console.log("      pinned by an anchor " + pinned + ", dealt too rarely to judge " + thin);
  console.log("      short by kind: " + (JSON.stringify(Object.fromEntries(byKind)) || "{}") + "\n");
  assert(frac >= 0.95, "only " + frac.toFixed(3) + " of slots reach three rhythms in eight readings");
});

console.log("\n" + (fail ? "FAIL " + fail + " / " : "") + pass + " passed");
process.exit(fail ? 1 : 0);
