// nukernel/src/table/special.ts — THE SPECIAL ROWS: TIME, and RULES.
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
// builder is the Time pane's own, with the pane taken off it. `#pan-tempo`,
// `#pan-rules`, the two tabs, the two tray branches and `timeAxis`/`alphaAxis`
// are DELETED, so nothing on this page draws these controls twice.

import type { TableAPI, Field, StripField, Choice } from "./api.js";
import { shField } from "./model.js";

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
  const bpm = doc.time && doc.time.bpm != null ? String(doc.time.bpm) : "—";
  const key = [w("alphabet.key"), w("alphabet.mode")].filter(Boolean).join(" ");
  return [bpm + " a minute", w("time.meter"), key]
    .filter(Boolean).join(" · ");
}

/** the expanded face: EVERY control `#pan-tempo` offered, in `#pan-tempo`'s own
 *  reading order — how fast it counts, then what it counts in. The inventory
 *  that proves the count is `test/table-inventory.json` (home `time-row`). */
export function timeSheet(A: TableAPI): Field[] {
  const f: Field[] = [];
  /* THE TEMPO, BIG, AT THE TOP, and then the nine marks that move it. Both are
     the pane's own widgets: the `<output class="nu-bpmbig">` with the slider
     under it (`data-k="bpm"`, `BPM_LO..BPM_HI`), and the one row that carries
     the tap and the eight operations (`data-k="tempo-…"`, nine of them, which
     is the literal test/knobs.js gate 8 counts). */
  f.push({ kind: "node", label: "tempo", node: A.bpmNode() });
  f.push({ kind: "node", label: "by hand", node: A.tempoNode() });
  f.push(seated(A, "time.meter", "meter"));
  f.push(seated(A, "time.swing", "swing"));
  f.push(seated(A, "time.groove", "groove"));
  /* RUBATO IS A DEVICE SETTING AND SAYS SO BY BEING STICKY: `setRubato` writes
     the preference, no document changes, and a share link carries nothing.
     That is why it is a word about YOUR box rather than a rule about the
     record — the record always breathes; this is whether your box plays it
     that way. */
  f.push(flagField("rubato", "the breathing", A.rubatoOn(),
    "played to the grid", "the record breathes",
    (on) => A.setRubato(on),
    "your box, not the record — a link carries nothing of it"));
  /* THE KEY IS THE CIRCLE OF FIFTHS (Paul, 2026-08-24: *"Maybe put the circle
     of fifths back in there for key selection, it was nice."*) — the one
     control on this page that is a menu's spec drawn as a picture, because it
     is the only drawing that shows which keys are next door to the one you are
     in. ui/selects.js `keyCircle` is its owner and did not move. */
  f.push({ kind: "node", label: "key", node: A.keyNode() });
  const mode = seated(A, "alphabet.mode", "mode") as StripField;
  const cap = A.tuningSay();
  if (cap && mode.key) mode.sub = cap;
  f.push(mode);
  f.push(seated(A, "alphabet.scale", "scale"));
  f.push(seated(A, "alphabet.harmony", "harmony"));
  f.push(flagField("diatonic", "the line", !!A.diatonicOn(),
    "follows the chords", "stays in the key",
    (on) => A.setDiatonic(on)));
  /* THE CHANGES, WHOLE. `chordGrid` is a table of its own — a degree slider, a
     quality menu and an inversion slider per bar, `+ bar` and `− bar` — and it
     registers the playhead's own `chordCell` for the bar that is sounding. It
     comes across as one node for exactly the reason the voice's channel strip
     does: it is not a vector and has no cell. */
  f.push({ kind: "node", label: "the changes", node: A.changesNode() });
  /* AND THE POINTER STANDS LAST, which is 2026-08-29's measurement and not a
     habit: reading order is working order, a hand opening TIME came for the
     tempo, and a cross-reference is back matter. */
  f.push({ kind: "node", label: "record gain", node: A.boardNode() });
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
}

export const SPECIALS: SpecialRow[] = [
  { k: "ttime", id: "time", word: "time",
    aria: "the record's own time — how fast it counts, what it counts in, " +
          "and what it counts in the key of",
    face: timeFace, sheet: timeSheet },
  { k: "trules", id: "rules", word: "rules",
    aria: "the genre, as sentences you can edit",
    face: rulesFace, sheet: rulesSheet },
];
