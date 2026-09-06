// nukernel/src/table/special.ts — THE SPECIAL ROWS: RULES, TIME, CHORDS,
// MOTIFS, MIX and PRODUCE.
//
// Paul, 2026-09-05, looking at the nav beside the v271 grid: *"we could
// integrate rules into a special row, time + key into a special row, then do
// the same with motifs, have the current table, and then do the same with the
// mix and produce — then have a hamburger menu for score, video, screensaver,
// and have genre, dice, playstop along the bottom — a real mobile app now with
// everything in the table and the nav space reclaimed."*
//
// TABLE.md §10a says what one IS, and every clause of it is load-bearing:
// *"Special rows are rows of the same sheet … record-level and MERGED across
// the columns, expandable, chips inside."*
//
//   A ROW OF THE SAME SHEET.   It is a `<tr>` of the one table, not a strip
//                              above it. `grid.ts thead` draws it; it freezes
//                              with the column heads; the address law and the
//                              accordion are the grid's own.
//   MERGED.                    One `<th colspan>` across every column, because
//                              a record has no voices: the tempo is not the
//                              bass's tempo.
//                              ...EXCEPT MIX, WHICH IS ALIGNED (§10a, and it
//                              is the only exception): a FADER is the bass's
//                              fader, so the mix row has a cell per column
//                              standing under that player's own head. Its
//                              MASTER is merged again, one row below, because
//                              a master is a fact about the record — see
//                              `masterFace` for the two measurements that put
//                              it there rather than in a corner.
//   EXPANDABLE.                Its sheet is `sheetBody` — the same four field
//                              kinds, the same `.nu-vsheet`, the same
//                              chip strip, the same refusal spelling — opened
//                              at the top of the body, which is where a head
//                              with no row of its own has always opened one.
//   CHIPS INSIDE.              `time.meter` and its five siblings come through
//                              the caller's own menu widget at the caller's
//                              own `data-sel` (see `seated` below); everything
//                              this file states itself is a chip strip.
//
// ===== WHAT A SPECIAL ROW IS NOT ======================================
// It is not a second writer of anything. Every field below either asks
// `avail.js` through `A.sh()` — the one owner of the vocabulary and of the
// write — or seats a widget the host built through a door, and the host's
// builder is the pane's own, with the pane taken off it. `#pan-tempo`,
// `#rulesdeck`, `#deck`, `#pan-motif`, `#produce`, the five tabs, the four
// tray branches, `timeAxis`/`alphaAxis`, `mixTrayItems`, `materialAxis`,
// `drawMaterial`, `motifTrayItems` and `motifOpsTrayItems` are DELETED, so
// nothing on this page draws these controls twice. The strip's SECOND home
// went in the same edit as the third pane: `model.ts colSheet` no longer draws
// `voiceStrip`.

import type { TableAPI, Field, StripField, Choice } from "./api.js";
import { shField } from "./model.js";
import { t, fmt } from "../copy/global.js";

/* WHICH VOCABULARIES KEEP THE CALLER'S OWN MENU WIDGET IN A SPECIAL ROW, and
   the list is not this file's opinion either: it is `test/selects.js MENUS`,
   which is the one owner of the controls Paul named on 2026-08-24 (*"We can
   return some things to select menus: meter / reading speed / swing / key … /
   mode"*) and which asserts, on the rendered page, that each of them is drawn
   by `src/menus/` at its own `data-sel`. A special row that re-drew them as
   the grid's own chips would move six addresses and put six gates red for a
   widget the menu module already picks correctly — `pick.ts` answers CHIPS for
   a vocabulary of eight words wherever it is asked, so what is seated here IS
   the chip strip Paul is holding. Seating rather than re-drawing is the same
   move `sound.instrument` and the four other MENUS keys already make in a
   column sheet (`model.ts COMBOKEYS`). */
const SEATED = new Set(["time.meter", "time.swing", "time.groove",
                        "alphabet.mode", "alphabet.scale", "alphabet.harmony"]);

/** a field off an avail.js sheet with the caller's own widget seated in it. */
function seated(A: TableAPI, key: string, label: string | null): Field {
  const f = shField(A, key, {}, label);
  const s = f as StripField;
  if (!s.key || s.node || !SEATED.has(key)) return f;
  const sp = A.sh(key, {}, null);
  return sp ? { ...s, node: A.menuWide(sp) } : f;
}

/** a two-word fact said the way this surface says one (`colSheet`'s "drummer
 *  — playing / sitting out"): a chip strip of exactly two words, never a tick.
 *  The address is the one the Time pane's own checkbox carried. */
function flagField(key: string, label: string, on: boolean,
                   offWord: string, onWord: string,
                   set: (on: boolean) => void, sub?: string): StripField {
  return { key, label, word: on ? onWord : offWord, value: on ? "1" : "",
           derived: false, sub: sub || null,
           options: [{ v: "", w: offWord } as Choice,
                     { v: "1", w: onWord } as Choice],
           set: (v: string) => set(!!v) };
}

/* ===================================================================== */
/* ---- THE TIME ROW ---------------------------------------------------- */

/** the collapsed face: *"the record's bpm · meter · key on one line"*. Every
 *  word is asked of the sheet that owns it rather than spelled here — the
 *  meter's word is `time.meter`'s own label, the key's is the circle's spec —
 *  so a re-worded vocabulary re-words the face by existing. */
export function timeFace(A: TableAPI): string {
  const doc = A.doc() as { time?: { bpm?: number } };
  const w = (key: string): string => {
    const sp = A.sh(key, {}, null);
    if (!sp) return "";
    const c = A.wcell(sp);
    return c.label == null ? "" : String(c.label);
  };
  /* A TEMPO IS A NUMBER AND ITS UNIT (`79 BPM`), not the prose "79 a minute":
     one formatter, `fmt`, so every quantity on the page rounds and spaces the
     same way and a translator moves the separator once. */
  const bpm = doc.time && doc.time.bpm != null
    ? fmt(doc.time.bpm, "BPM") : "—";
  const key = [w("alphabet.key"), w("alphabet.mode")].filter(Boolean).join(" ");
  return [bpm, w("time.meter"), key]
    .filter(Boolean).join(" · ");
}

/** the expanded face: EVERY control `#pan-tempo` offered, in `#pan-tempo`'s own
 *  reading order — how fast it counts, then what it counts in. The inventory
 *  that proves the count is `test/table-inventory.json` (home `time-row`). */
export function timeSheet(A: TableAPI): Field[] {
  /* ---- THREE GROUPS, IN THE COMPOSER'S ORDER (2026-09-05, TABLE.md §13f)
     DESIGN.md §5 opens with this row: *"Time (tempo · meter · key)"*, and
     that is now the whole of it. It was TEMPO · METER · KEY · CHORDS until
     Paul's *"Add chords below time and move chord stuff into it"*: the
     changes, the harmony cycle and the melody flag are `chordsSheet`'s, one
     row down, and this sheet keeps the ALPHABET — how fast it counts, what it
     counts in, and which notes it counts with. */
  const f: Field[] = [];
  const G = (g: string, x: Field): Field => { x.group = g; return x; };
  const TEMPO = "tempo", METER = "meter", KEY = "key";
  /* THE TEMPO, BIG, AT THE TOP, and then the nine marks that move it. Both are
     the pane's own widgets: the `<output class="nu-bpmbig">` with the slider
     under it (`data-k="bpm"`, `BPM_LO..BPM_HI`), and the one row that carries
     the tap and the eight operations (`data-k="tempo-…"`, nine of them, which
     is the literal test/knobs.js gate 8 counts). */
  f.push(G(TEMPO, { kind: "node", label: t("field.tempo"), node: A.bpmNode() }));
  f.push(G(TEMPO, { kind: "node", label: t("time.byHand"), node: A.tempoNode() }));
  /* THE METER, TWICE OVER, AND THAT IS ONE COMPONENT AND NOT TWO (2026-09-05,
     the any-meter round). Paul: *"I should be able to set any tempo at all
     like 21/17 you should let me choose anything."* The CHIPS are the seven
     signatures a hand reaches for without counting — `time.meter`'s own
     vocabulary, seated through the caller's menu at the address it has always
     had — and the two NUMBERS under them are how to say the eighth. Both
     write `doc.time.meter` through `K.meterWordOf`, which spells 3-over-4 as
     the WORD every save already carries, so a chip and a slider can never
     leave one meter with two names. Reading order is the composer's
     (DESIGN.md 5): the common answer first, the general one under it. */
  /* THE LABEL IS SAID HERE AND NOT ASKED OF THE SHEET, and only until
     `avail.js` keys these six the way it has keyed `ROWFACTS`: their sheet
     labels are still bare literals there, and a word the catalogue does not
     hold is a word no second language can reach. When they are keyed, these
     overrides become `null` — one owner — the way the row sheet's eleven
     already have. */
  f.push(G(METER, seated(A, "time.meter", t("noun.meter"))));
  f.push(G(METER, { kind: "node", label: t("time.signature"), node: A.meterNode() }));
  f.push(G(METER, seated(A, "time.swing", t("field.swing"))));
  f.push(G(METER, seated(A, "time.groove", t("field.groove"))));
  /* RUBATO IS A DEVICE SETTING AND SAYS SO BY BEING STICKY: `setRubato` writes
     the preference, no document changes, and a share link carries nothing.
     That is why it is a word about YOUR box rather than a rule about the
     record — the record always breathes; this is whether your box plays it
     that way. */
  f.push(G(METER, flagField("rubato", t("time.rubato"), A.rubatoOn(),
    t("time.rubato.off"), t("time.rubato.on"),
    (on) => A.setRubato(on),
    t("time.rubato.sub"))));
  /* THE KEY IS THE CIRCLE OF FIFTHS (Paul, 2026-08-24: *"Maybe put the circle
     of fifths back in there for key selection, it was nice."*) — the one
     control on this page that is a menu's spec drawn as a picture, because it
     is the only drawing that shows which keys are next door to the one you are
     in. ui/selects.js `keyCircle` is its owner and did not move. */
  f.push(G(KEY, { kind: "node", label: t("field.key"), node: A.keyNode() }));
  const mode = seated(A, "alphabet.mode", t("field.mode")) as StripField;
  const cap = A.tuningSay();
  if (cap && mode.key) mode.sub = cap;
  f.push(G(KEY, mode));
  f.push(G(KEY, seated(A, "alphabet.scale", t("field.scale"))));
  /* AND THE POINTER STANDS LAST, which is 2026-08-29's measurement and not a
     habit: reading order is working order, a hand opening TIME came for the
     tempo, and a cross-reference is back matter. It stood under the CHORDS
     group until 2026-09-05 with its own comment saying it did not belong to
     the chords; the chords have left, so it stands under the last group there
     IS rather than in a fourth group of one — which is the same refusal that
     put it here in the first place. */
  f.push(G(KEY, { kind: "node", label: t("time.gain"), node: A.boardNode() }));
  return f;
}

/* ===================================================================== */
/* ---- THE CHORDS ROW (2026-09-05, TABLE.md §13f) ---------------------- */
//
// Paul: *"Add chords below time and move chord stuff into it."* It is the
// third merged row of the head, under TIME, and everything in it MOVED —
// there is no second changes grid, no second harmony menu and no second
// melody flag on this page. What did NOT move is the alphabet: key, mode and
// scale are what the record counts WITH and stay in TIME; the changes are
// what it DOES over them.

/** the collapsed face: *"the chain the record plays"*, in the shortest honest
 *  form the box already has. `ui/eight.js chordsFace` is its owner for the
 *  reason `rulesFace` and `motifsFace` have one — the numerals are
 *  `chordSymbol`'s, the same spelling the changes grid prints in its own bar
 *  rows, and a face that spelled a chord a second way would be a second
 *  owner of figured bass. A record whose chords are all DEALT still says the
 *  chain that plays; nothing here ever answers "default". */
export function chordsFace(A: TableAPI): string {
  return A.chordsFace();
}

/** the expanded face: the changes first, because that is what a hand opening
 *  CHORDS came for, then what the harmony DOES with them (DESIGN.md §5). */
export function chordsSheet(A: TableAPI): Field[] {
  const f: Field[] = [];
  const G = (g: string, x: Field): Field => { x.group = g; return x; };
  const CHORDS = "chords", HARMONY = "harmony";
  /* THE CHANGES, WHOLE. `chordGrid` is a table of its own — a degree slider, a
     quality menu and an inversion slider per bar, `+ bar` and `− bar` — and it
     registers the playhead's own `chordCell` for the bar that is sounding. It
     comes across as one node for exactly the reason the voice's channel strip
     does: it is not a vector and has no cell.
     `alphabet.quality` RIDES WITH IT and is not a field of this sheet: it is a
     per-BAR menu inside that grid (`sel|alphabet.quality|bar<n>`), so it moved
     the moment the grid did, at the address it has always had. */
  f.push(G(CHORDS, { kind: "node", label: t("chords.changes"),
                     node: A.changesNode() }));
  /* AND WHAT THE HARMONY DOES WITH THEM. `alphabet.harmony` is the word that
     decides whether the kernel READS the chart at all (`chordsOf` takes
     `g.prog` only under `cycle`), which is a fact about the changes and not
     about the alphabet — it stood in the KEY group beside the mode until
     §13f. The melody flag is its neighbour for the same reason: "follows the
     chords" is a sentence about the chords. */
  f.push(G(HARMONY, seated(A, "alphabet.harmony", t("chords.harmony"))));
  f.push(G(HARMONY, flagField("diatonic", t("field.melody"), !!A.diatonicOn(),
    t("chords.melody.chords"), t("chords.melody.key"),
    (on) => A.setDiatonic(on))));
  return f;
}

/* ===================================================================== */
/* ---- THE RULES ROW --------------------------------------------------- */

/** the collapsed face: *"the count of rules written and the last change"*.
 *  A record composed straight off its anchor has written none, and says so —
 *  the sentences are still all there behind the row, which is what the second
 *  clause is for. */
export function rulesFace(A: TableAPI): string {
  return A.rulesFace();
}

/** the expanded face: `ui/rules.js`'s whole sheet, seated. It is ONE node and
 *  not a list of fields, and that is a decision with a measurement under it:
 *  the panel's rows are already this week's two-line row — *"the sentence with
 *  its value, the control under it"* (Paul, 2026-09-03: *"Arrange things so
 *  the slider and function descriptions are on a line with the slider after
 *  that line, not bunched together"*) — drawn by `sentenceInto`, and the
 *  sentence is `nukernel/rules.js`'s `parts`, which no other renderer on this
 *  page can build. Re-typing nine hundred lines of it into `Field[]` would be
 *  a second owner of thirty-eight sentences to gain a shape it already has.
 *  What is DELETED is the PANE — the tab, the tray branch, `#pan-rules`, the
 *  mount and its stop handle — and `ui/rules.js` is the RULES ROW's sheet
 *  builder now, called through `A.rulesNode()`, writing through the same
 *  `apply()` -> `ctx.evolve` door it has used since 2026-09-03. */
export function rulesSheet(A: TableAPI): Field[] {
  return [{ kind: "node", node: A.rulesNode() }];
}


/* ===================================================================== */
/* ---- THE MOTIFS ROW (§10b step 4) ------------------------------------ */
//
// §10a: *"MOTIFS is the bank across the top with previews and provenance, and
// tapping a motif points the SELECTED cell at it (the formula bar's own
// write)."* It is MERGED, like TIME and RULES, because a motif belongs to the
// RECORD and not to a player — the bank is what `DOC.material.cells` is, one
// map for the whole band, and the fact that six chairs may read one hook is
// the reason the fork buttons exist.

/** the collapsed face: how big the bank is, and which motif you are standing
 *  in. Both read off `ui/eight.js`, which owns the bank and the page state
 *  that says which one is open — a face is not a second opinion. */
export function motifsFace(A: TableAPI): string {
  return A.motifsFace();
}

/** THE BANK, OR THE ONE MOTIF OPENED FROM IT — one node, and the argument is
 *  `rulesSheet`'s word for word. The bank's row is a picture (ui/preview.js), a
 *  NAME that points the selected cell, the provenance word (§3: own / guest /
 *  hand), the chairs that read it, and an `open`; the opened motif is
 *  `motifs()` — the rename field, the clear, the play, the written staff, the
 *  bench, `+`/`−` measure, the read-by strip, the forks and the fourteen
 *  transforms. Every one of those is a widget ui/eight.js already builds, and
 *  three of them register themselves in playhead registries (`hookCells`,
 *  `stepCell`, `written`) that only that file owns. A `Field[]` of them would
 *  be a second owner of the motif editor. */
export function motifsSheet(A: TableAPI): Field[] {
  return [{ kind: "node", node: A.motifsNode() }];
}

/* ===================================================================== */
/* ---- THE PRODUCE ROW (§10b step 5) ----------------------------------- */
//
// §10a draws it *"merged, expandable"* UNDER the mix — `│ PRODUCE │ the
// producer's deals and notes │` — and under is where it belongs rather than
// over the grid: the producer speaks ABOUT a record that has already been
// dealt, and its notes are applied after the deal (`ui/produce.js state()`:
// the base, then the stack). So it is the `<tfoot>`'s last merged row, drawn
// by `grid.ts` beside the master's, and it is not in `SPECIALS` — that list is
// the HEAD's, and a row in the head is a row above the music.

/** the collapsed face: the producer's last sentence, and how many stand. */
export function produceFace(A: TableAPI): string {
  return A.produceFace();
}

/** `ui/produce.js mount`, seated. One node for the third time and the same
 *  reason: the deal tree, the adjective sheet with every withheld word greyed
 *  and its own reason printed, the stack of up to ten notes with their
 *  percentages and their more / less / take-it-off, and the producer's own
 *  undo. None of it is a vector; none of it has a cell. */
export function produceSheet(A: TableAPI): Field[] {
  return [{ kind: "node", node: A.produceNode() }];
}

/* ---- what the grid needs to know about them, in one table ------------- */

export interface SpecialRow {
  /** the half of the `data-k` after `t`: `ttime`, `trules`. */
  k: string;
  /** the `OPEN` key, and the `data-special` a gate and the keyboard read. */
  id: string;
  word: string;
  aria: string;
  face(A: TableAPI): string;
  sheet(A: TableAPI): Field[];
  /** a `[data-live]` SIBLING of the head's button, or nothing. Only MOTIFS has
   *  one: which motif is SOUNDING is a fact the clock knows and the face
   *  cannot, and a lamp inside the button would put a control in a live
   *  surface (test/motif-frozen A1). `grid.ts` caches the node, because lit
   *  re-renders the row on every draw and a new element each time would drop
   *  the clock's own writes on the floor. */
  lamp?(A: TableAPI): HTMLElement | null;
}

/* THE WORD AND THE SENTENCE ARE GETTERS, and that is the one-catalogue law
   said in the shape of this table rather than in a comment: a string read at
   MODULE EVALUATION would be read once, at import, and a page that changed
   its language would keep the words it booted with. `word` and `aria` are
   looked up the moment `grid.ts` draws the row. */
/* THE ORDER IS RULES · TIME · CHORDS · MOTIFS (2026-09-05, §13f), and both
   moves are Paul's own line. *"Put rules above time"*: the rules are what the
   record IS before a hand touches a number, so the genre's sentences stand
   over the tempo they set rather than under it. *"Add chords below time and
   move chord stuff into it"*: the changes are their own subject and they read
   after the meter and the key they are counted in. DESIGN.md §5 carries the
   same order. NOTHING READS THIS LIST BY INDEX — `grid.ts specialRows` walks
   it, `stick()` finds the open row by class and the column heads by being
   last — so this array is the one place the order is stated. */
export const SPECIALS: SpecialRow[] = [
  { k: "trules", id: "rules",
    get word() { return t("special.rules.word"); },
    get aria() { return t("special.rules.aria"); },
    face: rulesFace, sheet: rulesSheet },
  { k: "ttime", id: "time",
    get word() { return t("special.time.word"); },
    get aria() { return t("special.time.aria"); },
    face: timeFace, sheet: timeSheet },
  /* AND IT HAS NO `lamp`, WHICH IS A REFUSAL WITH A MEASUREMENT UNDER IT
     (§13f). The sounding chord is only a fact about the chart on a record
     whose `alphabet.harmony` is `cycle`: `kernel.js chordsOf` throws `g.prog`
     away otherwise and asks `harm()` per bar, so a lamp reading the chart
     would light a numeral the box is not playing on every modal and emergent
     record. And the registry that DOES know — `chordCell` / `chordRow` /
     `chordLabel` — is filled by `chordGrid` while the grid is DRAWN, which is
     exactly when the row is open and the lamp is not wanted. Lighting it
     honestly means a second reader of the kernel's harmony inside the clock
     loop; MOTIFS' lamp costs one already-registered node. */
  { k: "tchords", id: "chords",
    get word() { return t("special.chords.word"); },
    get aria() { return t("special.chords.aria"); },
    face: chordsFace, sheet: chordsSheet },
  { k: "tmotifs", id: "motifs",
    get word() { return t("special.phrases.word"); },
    get aria() { return t("special.phrases.aria"); },
    face: motifsFace, sheet: motifsSheet,
    lamp: (A) => A.motifLamp() },
];

/* ===================================================================== */
/* ---- THE RECORD ROW (2026-09-06, TABLE.md §14) ----------------------- */
//
// THE REDESIGN'S FIRST SENTENCE: *"The page is sorted by age, not by scope."*
// A song here has four scopes — record, section, player, cell — and the
// RECORD talked at both ends of the page: RULES, TIME, CHORDS and MOTIFS
// above the grid, MASTER, PRODUCE and PERFORMANCE below it, with the grid
// (the only surface that shows the whole song) getting what was left. Walking
// the sheet, the scope changed nine times.
//
// So the seven are ONE LINE at the top — `THE RECORD` — and a tap on it
// discloses them as its sections. Nothing about any of the seven moved: each
// keeps its own `data-k`, its own open key, its own face and its own sheet,
// and `grid.ts` draws them from `SPECIALS`, `PRODUCE`, `masterMixSheet` and
// `perfCells`/`perfSheet` exactly as it drew them before.

/** THE COLLAPSED FACE IS `timeFace`, AND IT IS NOT RE-DERIVED HERE. Asked
 *  what a glance needs off a record, the walkthrough answered tempo, meter and
 *  key — which is the sentence the TIME row has printed since §10b, off the
 *  sheets that own those three words. A second reader of the same three facts
 *  is what this file's own header forbids, so the record's face IS the time
 *  row's face, one function, two callers. */
export const RECORD: { k: string; id: string; word: string;
                       face(A: TableAPI): string } = {
  k: "trecord", id: "record",
  get word() { return t("special.record.word"); },
  face: timeFace,
};

/** THE FOOTER'S OWN MERGED ROW, WHICH IS NOT IN `SPECIALS` and says so here
 *  rather than in a comment three files away: `SPECIALS` is the HEAD's list
 *  and `grid.ts thead` draws every member of it above the column heads.
 *  PRODUCE is drawn under the master by `grid.ts mixRow`'s neighbour, with the
 *  same `sp|` open key — so it is STICKY for the same reason the other four
 *  are (every control in it recompiles) and the keyboard lets it alone. */
export const PRODUCE: SpecialRow =
  { k: "tproduce", id: "produce",
    get word() { return t("special.produce.word"); },
    get aria() { return t("special.produce.aria"); },
    face: produceFace, sheet: produceSheet };

/* ===================================================================== */
/* ---- THE MIX ROW (§10b step 3) --------------------------------------- */
//
// THE ONE SPECIAL ROW THAT IS NOT MERGED, and §10a says why in one word:
// *"MIX is ALIGNED — one channel strip per voice column and the master in the
// corner."* A tempo is not the bass's tempo, so TIME is one cell across every
// column; a FADER is the bass's fader, and a fader that did not stand under
// the bass's own column would be the one control on this surface that had to
// be read with a finger tracing back to a name. So the mix row is a row of the
// `<tfoot>` with a cell per column, each cell carrying that seat's own level
// word and its own lamp, and the CORNER — the row head, which is where a
// spreadsheet's footer keeps the total — is the master.
//
// IT REPLACES THE `master` FOOTER ROW RATHER THAN STANDING BESIDE IT. The
// seven master words were `tfoot|master`'s cells since wave 2b; they are this
// row's corner sheet now, at the same `tmaster|<key>` addresses (an address
// does not move when a row does), because two rows offering the master's drive
// would be the "exactly ONE control page-wide" law broken by the round that
// wrote it. `performance` is untouched and is still the footer's second row.

/** the collapsed word in one voice's cell: what that seat is doing on the
 *  desk, asked of `ui/engineer.js`'s own reading of the fader (`faderDb` and
 *  `fmtDb`, the two the strip itself prints), never re-derived here. */
export function mixFace(A: TableAPI, name: string): string {
  return A.mixWord(name);
}

/** ONE VOICE'S SEAT, WHOLE. `voiceStrip` is `ui/engineer.js voiceMix` in a box
 *  — the fader, the meter well, the pan detents, the four sends, the EQ and
 *  the three insert slots (`slotEl` / `voiceSlotOwner`) — seated through a node
 *  door exactly as `timeSheet` seats the changes grid, because a channel strip
 *  is not a vector and has no cell. It is the SAME function the board drew
 *  before the voices came off it on 2026-08-28, so this is not a second
 *  drawing of a strip: it is the only one — the COLUMN sheet's `seat` row is
 *  deleted in the same edit and its pointer sends a hand here.
 *  NO LABEL ON THE FIELD, because the strip draws its own heading (`mix`) and
 *  a `seat` line over it was two headings for one box — the prose
 *  test/text-diet.test.js takes off. */
export function mixSheet(A: TableAPI, name: string): Field[] {
  return [{ kind: "node", node: A.voiceStrip(name) }];
}

/** the corner's collapsed face: which of the master's seven words this record
 *  has written, or the sentence that says it has written none. The words are
 *  `A.MASTERROWS`' own labels, so a renamed row renames the face by existing. */
export function masterFace(A: TableAPI): string {
  const said: string[] = [];
  for (const m of A.MASTERROWS) {
    const cur = A.masterOf(m.key);
    if (cur != null && cur !== "") said.push(m.labels[cur] || String(cur));
  }
  return said.length ? said.join(" \u00b7 ") : t("value.default");
}

/** THE CORNER'S SHEET IS THE BOARD, AND THE MASTER'S SEVEN WORDS ARE IN IT.
 *  `boardRack` is `ui/engineer.js mount` — the rack, its five plates and the
 *  row that switches them — seated through a node door: genre fx with the
 *  genre bus's three insert slots, the delay bus, the reverb bus, MAIN (which
 *  is where the master's `drive · glue · tape · space · width · tilt ·
 *  ceiling` are drawn, beside the record gain, the listening level, the
 *  surface noise and the one-touch bypass that reads all seven back), and the
 *  section-automation grid.
 *  IT DOES NOT ALSO DRAW `masterCells`, and that is a deletion with a
 *  measurement under it: `tmaster|<key>` in the table's old footer and
 *  `master|<key>` on the main plate wrote the same seven values through the
 *  same `NuDeskDoc.writeMaster`, so putting both in one sheet would have been
 *  the "exactly ONE control page-wide" law broken by the round that wrote it.
 *  The Mix PANE is deleted; this is where `#boardpanel` is built now, which is
 *  why every one of nukernel/desk-gate.js's `#boardpanel #rack .nu-plate`
 *  queries reads the markup it always did. */
export function masterMixSheet(A: TableAPI): Field[] {
  return [{ kind: "node", label: t("master.buses"), node: A.boardRack() }];
}
