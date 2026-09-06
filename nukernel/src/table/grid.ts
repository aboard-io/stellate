// nukernel/src/table/grid.ts — THE SONIC SPREADSHEET.
//
// Paul, 2026-09-05, on the v270 table: *"Move all the nav into the table, I
// should be able to add players without using the nav and sections too. I click
// band and all further operations are buttons around the table. Cells and
// dropdowns have lots of padding … Clicking '1 head' results in an enormous
// blank space … spread things out to 100% of the screen width and make the
// buttons a tiny bit bigger than the words themselves."* Then: *"I want the
// table to just re-use spreadsheet dynamics since users know them. Think of
// song composition as 'sonic spreadsheet'."*
//
// This is TABLE.md 9a. Sections run DOWN, players run ACROSS, and the thing a
// hand does to it is what a hand does to a spreadsheet: SELECT a cell, see its
// address, edit it in the bar, arrow around, extend a range, copy, paste, fill
// right, fill down, insert and delete rows and columns from the header, and
// take any of it back with Ctrl-Z.
//
// ===== WHAT IT REPLACED, AND WHAT DID NOT MOVE =========================
// It replaces `ui/table.js`'s pane — the wordgrid accordion — and NOT one
// address. Every `data-k` the gates read is minted in src/table/model.ts off a
// key the document or avail.js already owns (`tcell|<voice>|<section>`,
// `trow|<id>`, `tcol|<name>`, `material.cell|…`, `tcellvec|<key>|<vi>|<si>`,
// `trow-dup|…`, `tcol-add|line`, `tcorner`, `tfoot|perf`…), the open sheet is
// still a `<tr class="nu-wopen">` under the row it belongs to, and the classes
// nu.css and test/table.browser.js read are the same ones. T4-T8 are read
// against the rendered page and stayed green through the swap; that is the
// whole argument for a strangler and it is why the grid went first.
//
// ===== WHY THE SHEET IS STILL AN INSERTED ROW ==========================
// 9a says "the FORMULA BAR above the grid". A spreadsheet's formula bar holds
// ONE value; a cell here is a vector of up to eighteen fields, and two standing
// laws of this page decide where that many words may go — MENUS NEVER SCROLL
// INSIDE THEMSELVES, and CELL MENUS INSERT BELOW THE ROW (never a popup over
// the column you are editing). So the bar is drawn in two parts that are one
// control: its HEAD is `.nu-formula` above the pane (the ADDRESS of the
// selection, undo/redo, copy/paste, and the two axis offers), and its BODY is
// the vector, in the accordion, under the row the cell is in. No field is drawn
// twice. On a phone the head is sticky to the BOTTOM of the pane, which is
// 9a's "the formula bar is the bottom sheet" in this page's own language.
//
// ===== NO CLOCK, NO SECOND STATE =======================================
// The component installs no rAF and subscribes to nothing: `paint()` is a
// method the host calls with what the position feed said, exactly as
// ui/wordgrid.js did. The four things it remembers across a rebuild — the
// selection, the open door, the open field and the column widths — are
// module-level for the reason `tableFacing` is: ui/eight.js throws this whole
// panel away and rebuilds it on every write, so state owned by the component
// would be erased by the first op it recorded.

import { html, render, nothing } from "lit/html.js";
import type { TemplateResult } from "lit/html.js";
import { classMap } from "lit/directives/class-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import type { TableAPI, Field, Op, Mark } from "./api.js";
import { rowSheet, colSheet, cellSheet, perfSheet,
         perfCells, tableOps, nextPlayerOffer, sectionOffer,
         rowOps, colOps, cellOps } from "./model.js";
import { sheetBody, onRedraw } from "./sheet.js";
import { SPECIALS, PRODUCE, RECORD, mixSheet, masterFace,
         masterMixSheet } from "./special.js";
import { undoStack } from "./undo.js";
import type { DocUndo } from "./undo.js";
import { t, tn } from "../copy/global.js";

/* ---- the four facts that survive a rebuild --------------------------- */

/** THE SELECTION, IN THE RECORD'S OWN TERMS AND NOT IN THE VIEW'S. A section
 *  id and a voice name, never a row and a column number: the transpose swaps
 *  the axes and a numeric selection would then point at a different cell for
 *  no reason a hand can see. */
type Sel = { sec: string; voice: string } | null;
let SEL: Sel = null;
/** the other end of a range (9a: "Shift+arrows and drag select a range"). */
let ANCHOR: Sel = null;
/** which door is open — one at a time, in the whole grid. */
let OPEN: string | null = null;
/** which field inside the open sheet has its strip out. */
let OPENFIELD: string | null = null;
/* THE ARMED MOTIF (2026-09-08, §10b step 4). §10a: *"tapping a motif points the
   SELECTED cell at it"* — and a hand that has not selected one yet is not
   wrong, it is early. So a name tapped with no selection ARMS, the next cell
   tapped is pointed at it, and the arming is cleared by the write. It lives
   beside `SEL` and outlives a rebuild for `SEL`'s own reason: the write that
   would clear it is the write it is waiting for. */
let ARM: string | null = null;
/** a column's width in px where a hand has dragged one (9a: resizable). */
const WIDTH = new Map<string, number>();
/** the clipboard, and it is a VECTOR: what a cell has written, nothing more. */
let CLIP: { sec: string; voice: string } | null = null;
/** the ONE resize observer and the CURRENT grid's `stick` — see `armResize`. */
let RO: ResizeObserver | null = null;
/** the ONE tap-outside closer — see `armOutside`. */
let OUT: ((e: Event) => void) | null = null;
let STICK: (() => void) | null = null;
/* ---- IS THE GRID SHOWING? (2026-09-05, TABLE.md §13f, Paul: *"Sections
   should collapse when I touch it."*) The SECTIONS label is a disclosure now:
   folded, the column heads, every section row, the `+` row and the mix row are
   `hidden`, and what is left above the master is the label's own line with its
   count still on it.

   IT IS A PAGE PREFERENCE AND NOT A DOCUMENT FACT, which is `rubato`'s own
   distinction (`ui/state.js setRubato`): no `op()`, so no undo entry; no
   `changed()`, so no recompile; nothing in the share link. It is stored beside
   `nu.band.session` — the Band panel's other preference — and read once, at
   module evaluation, because a page that folded the grid to reach PRODUCE
   should find it folded on the next load. Every touch of `localStorage` is
   guarded: a private window throws on the ACCESSOR, not only on the call. */
/* ---- IS THE RECORD PANEL SHOWING? (2026-09-06, TABLE.md §14) ---------
   The seven record-scope surfaces are one line at rest and their own rows
   when it is open, which makes this a DISCLOSURE and not a sheet: `OPEN` is
   still the one open door in the whole grid, and this says whether the seven
   heads that can BE that door are on the glass.

   IT IS NOT PERSISTED, AND THAT IS THE DIFFERENCE BETWEEN IT AND `GRIDOPEN`.
   Folding the grid is a standing preference about a page — a hand that folded
   it to reach PRODUCE wants it folded next time. Opening the record is a
   drill-down: you came for the tempo, you set it, and the sheet's resting
   state is one line. So it starts closed on every load and survives only the
   rebuilds its own writes cause, which is `OPEN`'s own law.

   AND IT IS FORCED OPEN BY ITS CONTENTS. A scope's head keeps its `data-k`
   in the DOM while the panel is shut (the row is `hidden`, which is the
   attribute the platform means by "not here"), so a page door that presses
   one of them by name — `ui/eight.js`'s `__eightRow`, `__eightMix` — lands on
   the same button a thumb would and the panel opens under it rather than the
   press falling on the floor. */
let RECOPEN = false;

const GRIDSTORE = "nu.band.grid.v1";
let GRIDOPEN = ((): boolean => {
  try { return localStorage.getItem(GRIDSTORE) !== "0"; } catch (e) { return true; }
})();
const saveGridOpen = (): void => {
  try { localStorage.setItem(GRIDSTORE, GRIDOPEN ? "1" : "0"); } catch (e) { /* private mode */ }
};

/* ---- what a cell is, in the two directions the table can face -------- */
interface Shape {
  across: boolean;
  secs: { id: string; i: number }[];
  voices: { name: string; vi: number }[];
  /** the selection as indices into the record, or null. */
  at(): { i: number; vi: number } | null;
}

function shapeOf(A: TableAPI): Shape {
  const doc = A.doc();
  const secs = (doc.form && doc.form.sections || []).map((s, i) => ({ id: s.id, i }));
  const voices = (doc.voices || []).map((v, vi) => ({ name: v.name, vi }));
  return {
    across: A.facing() === "voices",
    secs, voices,
    at() {
      if (!SEL) return null;
      const s = secs.find((x) => x.id === SEL!.sec);
      const v = voices.find((x) => x.name === SEL!.voice);
      return (s && v) ? { i: s.i, vi: v.vi } : null;
    },
  };
}

/* ===================================================================== */

export interface Grid {
  table: HTMLTableElement;
  pane: HTMLElement;
  rowHeads: Map<string, { th: HTMLElement; btn: HTMLElement; live: HTMLElement | null }>;
  colHeads: Map<string, { th: HTMLElement; btn: HTMLElement }>;
  paint(nowRowId: string | null, soundingColIds?: string[]): void;
  close(): void;
  openCorner(fields?: Field[], btn?: HTMLElement | null): void;
  /** open a door and never close it — an arrival's own gesture, which a
   *  toggle is not. See `land` below for the measurement. */
  land(key: string): void;
  /* ---- THE MOTIFS ROW'S TWO DOORS BACK OUT (2026-09-08, §10b step 4) ---
     The bank is drawn by `ui/eight.js` (it holds the previews, the provenance
     and the editors), and the SELECTION is the grid's — so the one thing the
     bank cannot answer for itself is "which cell am I pointing". These two are
     that answer, and they are doors in the same direction `openCorner` already
     is: the page asking the component to do the thing a thumb would do. */
  /** point the selected cell at this motif, or ARM the next cell tap.
   *  Returns true when a cell was written, false when the bank armed. */
  pointMotif(name: string): boolean;
  /** which motif the bank is armed with, so the button can wear it. */
  armedMotif(): string | null;
}

/** WHICH OPEN DOORS SURVIVE A REBUILD, and the test is the same sentence for
 *  both of them: a door whose OWN CONTROLS RECOMPILE would shut under the thumb
 *  that was using it. `sp|` is RULES, TIME and CHORDS (a rule, a tempo, a
 *  meter word, a chord degree — §13f gave the changes their own row and every
 *  one of its controls recompiles the way TIME's always did);
 *  `mix|` is the mix row (a fader, a send, an insert — every one of them a
 *  `ctx.changed()`). None of the three reasons a column sheet must close is
 *  true of either — `tablePanel` lands an arrival by clicking a COLUMN or a ROW
 *  head, the transpose is reached through the corner, and no gate opens one by
 *  toggling. The open BODY is rebuilt like any other; only WHICH door is open
 *  is kept. §10b step 4 and step 5 added the third and fourth members without
 *  adding a prefix: MOTIFS is `sp|motifs` (a transform, a note, a rename — all
 *  of them a `push(); draw()`) and PRODUCE is `sp|produce` (every note the
 *  producer takes is an `evolve`). The paragraph that stood here said the
 *  produce prefix was "not written until it exists", which is the
 *  declared-and-never-arriving shape this repo has a memory note about; it
 *  exists. */
/* ...AND SINCE 2026-09-05 THAT IS EVERY DOOR BUT THE CORNER. Paul, on the
   shipped table: *"Don't dismiss things when I tap them to change values;
   dismiss them when I tap outside of them."* Every write on this page ends in
   `changed()` -> `push(); draw()`, which throws this panel away and builds it
   again — so a cell sheet that did not survive a rebuild SHUT UNDER THE THUMB
   THAT WAS USING IT, once per chip. A row of chips could be tapped exactly
   once. That is the complaint, in the mechanism.

   THE CORNER IS THE ONE EXCEPTION AND IT IS A MEASUREMENT, NOT A TASTE (§9d):
   the transpose is reached by OPENING THE CORNER, `tablePanel` lands an
   arrival by CLICKING the head it wants open, and every door is a TOGGLE — so
   a corner that stayed open across a rebuild would be CLOSED by the tap meant
   to restore it, and fifteen of T4/T6/T8's checks went red at once, all of
   them downstream of that one un-restored transpose. The corner is the only
   door on this surface whose own act rebuilds the whole table underneath it,
   which is why it is the only one that must forget.

   WHAT CLOSES A SHEET, THEN, and all three are in `armOutside` and `onKey`:
   a tap OUTSIDE it, Escape, or its own head pressed again. */
const STICKY = (k: string | null): boolean => !!k && k !== "corner";
/** ...AND `SPECIAL` IS WHAT `STICKY` USED TO MEAN — a MERGED ROW (TIME, RULES,
 *  CHORDS, MOTIFS, PRODUCE, the mix row's board). Two of `STICKY`'s three callers were
 *  never asking about survival at all: one lets the page's landing go when a
 *  merged row opens, and one hands the keyboard to a merged row's chips
 *  instead of to the spreadsheet. Both still mean a merged row and neither
 *  means "any open door", which is what `STICKY` means since the tap-outside
 *  ruling. Splitting them is the whole of that change's blast radius. */
const SPECIAL = (k: string | null): boolean => !!k &&
  (k.indexOf("sp|") === 0 || k.indexOf("mix|") === 0 ||
   k.indexOf("foot|") === 0);

/** ...AND `RECORD_KEY` IS THE SEVEN THAT ARE THE RECORD'S (2026-09-06, §14).
 *  `SPECIAL` means "a merged row"; the mix row's per-voice seats are merged
 *  rows and are the PLAYER's, so they are not this. What this decides is two
 *  things and both are about the panel: which open door forces it open, and
 *  which open door a fold of the grid must leave alone. */
const RECORD_KEYS = ["sp|rules", "sp|time", "sp|chords", "sp|motifs",
                     "mix|master", "sp|produce", "foot|perf"];
const RECORD_KEY = (k: string | null): boolean =>
  !!k && RECORD_KEYS.indexOf(k) >= 0;

/* (`ADDHEAD` AND `ADDFOOT` STOOD HERE — the ADD sheet's two open keys, for
   one afternoon. 2026-09-05, TABLE.md §13e, Paul: *"Don't pop up an interface
   when I add a section or a voice. Just add it."* A `+` writes now, so there
   is no sheet to open and no key to open it with; `plusBtn` fires the op
   itself, through the same `op()` wrapper every other control uses.) */

/* THE MARKS REACH THIS BUNDLE THROUGH `globalThis`, which is `sheet.ts`'s own
   arrangement said again: `src/table` is its own build entry and an import of
   ui/glyph.js here would compile a thousand lines of marks into ui/table.js. */
interface ActDoor { GLYPH?: { act?: Record<string, { g: string; w: string;
                                                     s?: string }> } }
const actMark = (k: string): { g: string; w: string; s?: string } | null => {
  const d = (globalThis as unknown as { NuGlyph?: ActDoor }).NuGlyph;
  return (d && d.GLYPH && d.GLYPH.act && d.GLYPH.act[k]) || null;
};

export function bandTable(host: HTMLElement, A: TableAPI): Grid {
  const U = undoStack(A);
  /* ---- A REBUILD CLOSES THE SHEET; THE SELECTION SURVIVES IT ----------
     ui/eight.js throws this panel away and calls `bandTable` again on every
     write (`changed()` -> `draw()`), and the accordion has ALWAYS come back
     closed — the component owned it, so a rebuild erased it. Three things on
     this page are built on that: `tablePanel` LANDS the arrival by clicking the
     head it wants open (so anything already open would be a second sheet), the
     gate's every door is a TOGGLE (a tap that found a sheet already open would
     close the one it meant to open), and the transpose is reached by opening
     the corner — which, if the corner had stayed open across the turn, the
     restoring tap would have closed instead of turning back. Measured: keeping
     `OPEN` across a rebuild put fifteen of T4/T6/T8's checks red at once, all
     of them downstream of one un-restored transpose.
     THE SELECTION IS THE OTHER WAY ROUND, and that is 9a's own ask: a
     spreadsheet does not forget which cell you are on because you typed in it.
     `SEL` and the clipboard and the column widths survive; the open BODY does
     not, and the head above the pane goes on naming the cell. */
  /* ...EXCEPT A SPECIAL ROW'S, WHICH SURVIVES ONE (2026-09-06, §10b). Not one
     of the three reasons above is true of TIME or RULES: they are not landed
     on by `tablePanel` (which clicks a COLUMN or a ROW head), they are not
     reached through the corner, and no gate opens one by toggling. What IS
     true of them is the other way round: every control inside them recompiles
     — the tempo slider, a meter word, a rule — and `changed()` throws this
     panel away and builds it again, so a row that closed on a rebuild would
     shut under the thumb that was using it. The open BODY is rebuilt like any
     other; only which row is open is kept. */
  if (!STICKY(OPEN)) { OPEN = null; OPENFIELD = null; }
  /* ...AND THE PANEL IS OPEN IF ONE OF ITS SEVEN IS (2026-09-06, §14). The
     seven heads stand in the DOM whether the panel is shown or not, so a
     press that arrives by name rather than by thumb — `__eightRow("time")`,
     `__eightMix("master")`, a `land()` off a share link — opens the door and
     the panel with it. One statement, at the top of the draw, so there is no
     state in which a sheet is open inside a panel that is not. */
  if (RECORD_KEY(OPEN)) RECOPEN = true;
  /* THE SELECTION IS PRUNED AGAINST THE RECORD ON EVERY DRAW. A delete, a
     deal-again or a whole new document can take the selected cell away, and a
     selection pointing at a section that is gone is a formula bar showing a
     cell nobody can see. */
  const sh0 = shapeOf(A);
  if (SEL && !sh0.at()) { SEL = null; ANCHOR = null; OPEN = null; OPENFIELD = null; }
  if (CLIP) { const s = sh0.secs.find((x) => x.id === CLIP!.sec);
              const v = sh0.voices.find((x) => x.name === CLIP!.voice);
              if (!s || !v) CLIP = null; }

  /* ONE SHEET BUILD PER OPEN, NOT ONE PER DRAW. A sheet's rows carry the
     caller's OWN WIDGETS — ui/selects.js's combo, ui/engineer.js's channel
     strip, VOICE.md's knob table, the samples crate — and each of those
     registers itself on the page when it is built. An internal redraw (a group
     button, a strip opening, an arrow key) would build a second one:
     test/selects.js's own guard said so within the minute, twice — "duplicate
     select key cast.part|vocal — two controls would share one data-k". The
     fields are built when the door opens and reused until it closes, which is
     what the accordion always did. */
  let SHEETKEY: string | null = null;
  let SHEETFIELDS: Field[] | null = null;
  const sheetFor = (key: string, build: () => Field[]): Field[] => {
    if (SHEETKEY !== key || !SHEETFIELDS) { SHEETKEY = key; SHEETFIELDS = build(); }
    return SHEETFIELDS;
  };

  /* ...AND THE SPECIAL ROWS' OWN, THE SAME WAY (2026-09-08). Only MOTIFS asks
     for one, and it is cached for the reason every lamp on this surface is:
     lit re-renders the row on every draw, and a lamp rebuilt under the clock
     would drop the write that had just landed in it. */
  const SPLAMPS = new Map<string, HTMLElement | null>();
  const spLamp = (sp: { id: string; lamp?: (A: TableAPI) => HTMLElement | null }):
      HTMLElement | typeof nothing => {
    if (!sp.lamp) return nothing;
    if (!SPLAMPS.has(sp.id)) SPLAMPS.set(sp.id, sp.lamp(A));
    return SPLAMPS.get(sp.id) || nothing;
  };

  const LAMPS = new Map<string, HTMLElement>();
  const lamp = (name: string): HTMLElement => {
    let n = LAMPS.get(name);
    if (!n) { n = A.lampFor(name); LAMPS.set(name, n); }
    return n;
  };
  /* ...AND THE MIX ROW'S OWN, IN ITS OWN MAP. Same builder, same join, a
     different node: one element cannot stand in the head and in the footer at
     once, and sharing the head's would move it into the footer on the first
     draw. */
  const MIXLAMPS = new Map<string, HTMLElement>();
  const mixLamp = (name: string): HTMLElement => {
    let n = MIXLAMPS.get(name);
    if (!n) { n = A.lampFor(name); MIXLAMPS.set(name, n); }
    return n;
  };

  const draw = () => { render(view(), host); stick(); };
  /* ...AND `stick()` RUNS AGAIN WHEN THE PANE CHANGES WIDTH, which a redraw
     does not cover: a rotation or a resized window moves `--panew` and every
     frozen offset, and nothing on this page redraws for either. ONE observer,
     at module scope, always pointed at the CURRENT pane — a per-instance
     observer would leak one per write, because ui/eight.js throws this panel
     away and builds it again on every op. It is layout and not a clock: it
     fires when the box changes and never on a beat. */
  const armResize = (paneEl2: HTMLElement | null) => {
    STICK = stick;
    if (!paneEl2 || typeof ResizeObserver === "undefined") return;
    if (!RO) RO = new ResizeObserver(() => { if (STICK) STICK(); });
    RO.disconnect();
    RO.observe(paneEl2);
  };

  /* THE WHOLE HEAD FREEZES, AND IT IS A STACK NOW (2026-09-06, §10a: the
     special rows are *"above the column headers, frozen with them"*). nu.css
     pins every `thead th` at `inset-block-start: 0`, which is exactly right
     for a head of one row and exactly wrong for a head of three: TIME, RULES
     and the column heads would all pin at the same line and paint over each
     other. The offsets are MEASURED rather than declared because the rows'
     heights are the face's own — a genre with a long name makes a taller
     RULES line at 320 — and a hard-coded pair of pixel values would be a rule
     that reads right and moves nothing, which this table has already shipped
     twice (§9d). One walk of `thead`, after every render. */
  function stick(): void {
    const t = host.querySelector("table.nu-sheetgrid");
    if (!t) return;
    /* ...AND A MERGED ROW IS THE PANE'S WIDTH, NOT THE TABLE'S. A `<th>` that
       spans nine players is nine players wide, and at 390 that is 857px of row
       with the face's last word off the right of the screen — measured, first
       drawing. The cell is frozen at the pane's left edge (`thead th:first-
       child`), so the honest width for the LINE inside it is the width of what
       a hand can see: `--panew`, written here because only the DOM knows it,
       and the face ellipsises against it instead of running off. */
    const pane2 = host.querySelector(".nu-pane") as HTMLElement | null;
    if (pane2) (t as HTMLElement).style.setProperty(
      "--panew", (pane2.clientWidth - 6) + "px");
    /* THE STACK STARTS AT 0 AND THE CHROME IS NOT IN IT, and that is a
       measurement (2026-09-09). The obvious reading of the new top strip is
       that a head pinned at 0 pins under the ≡, so the stack should start at
       the strip's height — built, driven, and wrong: `.nu-pane` is
       `overflow-x: auto`, which computes `overflow-y` to `auto` as well, so
       the pane IS the scrollport these heads stick inside and the offset is
       measured from the PANE'S top edge, not the viewport's. Starting at 55.19
       pushed every head 55px DOWN its own pane and left a white band above
       TIME at 320 and 390. The strip is reserved by `body`'s
       `padding-block-start: var(--top-h)` instead, which is where a fixed
       plate's room has always been paid on this page. */
    /* ...AND THE OFFSET IS THE ROW'S OWN PLACE, NOT A SUM OF HEIGHTS
       (2026-09-05, the vertical-scrollport round). This read `y += tr.height`,
       which is every row's height and NONE of the space between them:
       `.nu-trims` is `border-collapse: separate; border-spacing: 3px`, so a
       four-row head carries 3px above the first row and 3px between each pair
       that no `getBoundingClientRect().height` reports. It cost nothing while
       the pane had no vertical scroll to give; the moment it did, MEASURED at
       390 on Kingston 1969: the head rows stand at 4 · 53 · 102 · 167.1 in
       their own table and the sum said 0 · 46 · 92 · 154.1, so every head
       SNAPPED 13px up the first time a thumb scrolled down — a freeze that
       moves, which is the failure §9d has caught twice by declaring instead of
       measuring.

       SO IT MEASURES, AND IT MEASURES WITH THE PINS RELEASED. A stuck row
       reports the pin, not its place, so reading the rows while they are held
       would feed this loop its own last answer. The inline offsets come off
       first, one layout is forced, each row's top is taken against the TABLE's
       (the pane's scroll origin, which the base below adds back for the case
       where the table is not the first thing in the pane), and the offsets go
       on again — all inside one frame, so nothing paints in between. */
    /* A HIDDEN ROW IS AN ABSENT ROW (2026-09-05, §13f). The SECTIONS
       disclosure folds the column heads away with the body they head, and a
       walk that still counted them would spend the pane's ONE pin on a row
       that is not on the glass — measured as `insetBlockStart: 0` written to a
       `display: none` `<tr>`, which is a pin that holds nothing and, worse, a
       pin that is not the heads. So the offsets are CLEARED on every row (a
       row that is folded must not keep the offset it had when it was shown)
       and everything below reads only the rows a hand can see. */
    const all = Array.from(t.querySelectorAll<HTMLElement>("thead > tr"));
    for (const tr of all)
      for (const c of Array.from(tr.children) as HTMLElement[])
        c.style.insetBlockStart = "";
    const rows = all.filter((tr) => tr.getClientRects().length > 0);
    const tRect = (t as HTMLElement).getBoundingClientRect();
    const base = pane2
      ? tRect.top - pane2.getBoundingClientRect().top + pane2.scrollTop : 0;
    const tops = rows.map((tr) =>
      base + (tr.getBoundingClientRect().top - tRect.top));
    /* ...AND THE STACK ENDS WHERE AN OPEN SPECIAL ROW'S SHEET BEGINS
       (2026-09-05, Paul: *"when I click time and rules they show up under
       phrases"*). The sheet is a row of the head now, under the row that
       opened it, so the rows AFTER it stand a whole editor further down the
       scroll content — and an offset written from there is not a pin but a
       shove: these numbers are distances from the top of the pane's CONTENT
       used as distances from the top of what a hand can SEE, which is only
       the same thing while the head is at the content's top. Pinning RULES at
       the 3,000px its own sheet-pushed line reports would drive it to the
       bottom of the table on the first scroll. So the pins stop at the open
       sheet: the tapped row and the rows above it stay frozen (which is how
       you close the row you are inside), the sheet and the rows below it ride
       the scroll, and every one of them keeps `position: sticky` with an
       `auto` offset — a declaration with nothing to hold, which is what a row
       under an open editor honestly is. */
    /* ---- ONE PIN AT A TIME (2026-09-05, §13a.1) -----------------------
       Paul, with the Silence record on his iPhone: *"things don't scroll out
       of the way for me to focus it's all jammed up."* MEASURED on v287 at
       390 x 844: FOUR bands pinned inside the pane at rest — TIME at 3, RULES
       at 51, PHRASES at 99 and the column heads at 163.1 — so the grid began
       163px down a 611px pane and the three rows a hand was not using held
       the top of the screen for ever.

       THE LAW IS ONE BAND: *"the grid's column heads while a section row is
       under them and no sheet is open, OR the owner row of the open sheet.
       Never both."* Which one is a reading of the DOM and nothing else:

         · a CELL sheet is open (`tbody tr.nu-cellopen`) — NOTHING in the head
           pins. The sheet's own first line is in flow at its top, so a pinned
           head would be a second band over a surface that already carries its
           own header;
         · a HEAD sheet is open (`thead tr.nu-spopen`) — its OWNER, the row
           directly above it, pins at the pane's top edge as that sheet's
           header, and every other row is released. It pins at ZERO and not at
           its measured place, because a sheet's header is at the top of the
           sheet by definition and the rows above it have scrolled away;
         · otherwise — the LAST row of the head (the column heads) pins at 0
           and the special rows do not pin at all. They are one line each and
           they scroll out of the way, which is the whole of the complaint.

       AND NOTHING IN `<tfoot>` EVER. This walk has only ever read `thead > tr`
       and it says so here rather than in a comment three files away: a master
       strip belongs at the bottom of a desk, not pinned over it. */
    const spOpen = rows.findIndex((r) => r.classList.contains("nu-spopen"));
    const cellOpen = !!t.querySelector("tbody > tr.nu-cellopen");
    const owner = spOpen > 0 ? spOpen - 1 : -1;
    const last = rows.length - 1;
    /* ...AND THE LAST VISIBLE ROW IS ONLY A PIN WHEN IT IS THE COLUMN HEADS
       (§13f). With the grid folded the last row left standing is the SECTIONS
       label, which §13e made the one `<thead>` row that never pins; folding
       must not promote it. So the fallback is spelled as what it has always
       MEANT — the heads — rather than as "whatever is last". */
    const lastRow = last >= 0 ? rows[last]! : null;
    const heads = !!lastRow && !lastRow.dataset.special &&
      !lastRow.classList.contains("nu-gridlabel") &&
      !lastRow.classList.contains("nu-spopen");
    const pinned = cellOpen ? -1 : (owner >= 0 ? owner : (heads ? last : -1));
    /* ...AND EVERY ROW IS WRITTEN, INCLUDING THE FOLDED ONES (2026-09-05,
       §13f). `nu.css` pins every `thead th` at `inset-block-start: 0` and this
       walk's job is to say which row keeps it — so a row left with NO inline
       value keeps the stylesheet's 0 and reports itself pinned to anything
       reading `getComputedStyle`. MEASURED the hour the fold landed: the
       hidden column-head row came back `position: sticky, inset-block-start:
       0px` with zero client rects — a pin on a row that is not on the glass,
       which is the one-pin law broken by an omission. So the loop walks ALL
       the head's rows and the visible ones only decide WHICH index wins. */
    const pinRow = pinned >= 0 ? rows[pinned]! : null;
    for (const tr of all)
      for (const c of Array.from(tr.children) as HTMLElement[])
        c.style.insetBlockStart = tr === pinRow ? "0px" : "auto";
    void tops;

    /* ---- A CELL SAYS A WORD AT EVERY WIDTH (2026-09-06, §14 item 2) ---
       WHAT STOOD HERE was §13a.7's rule — *"a cell is its glyph first, its
       word where there is room"*, with the room measured as a 9ch probe in
       the HEAD's type against the width a player column came out. Its own
       paragraph recorded the loss and left it: *"a cell at 390 is a glyph and
       not a word, on a record with seven players."*

       THE WALKTHROUGH MEASURED WHAT THAT COST. On the Coach House record (ten
       players, fourteen sections) at 390: all 140 cells drew one identical
       dot and all ten column heads a bare glyph, while the SAME TABLE at 1280
       printed every motif name and every instrument. *"A spreadsheet where
       every cell says 'inherited' is a spreadsheet with no data in it."*

       AND THE ARITHMETIC SAYS WHY NO ARRANGEMENT OF LINES FIXES IT. At 390 the
       pane is 364.4px; the frozen section column, the `+` and the ten gaps
       take 163 of it, so ten players share 217px — 21.7px each, three
       characters of the cell's own 11.52px mono. A word does not fit across a
       phone ten times, on one line or on two.

       SO THE COLUMN IS SIZED TO A WORD AND THE PANE SCROLLS, which is the
       gesture every spreadsheet on a phone already has: the section column is
       frozen at the left edge and a swipe brings the next players under it.
       Two numbers are MEASURED here because only the DOM knows them, and both
       are read in the CELL's own type rather than the head's:
         `--wordw`  the floor a column is given — 9ch and the cell's own side
                    padding — which `nu.css` takes as `--cellmin`. It is
                    written BEFORE the width is read back, so the class below
                    is decided on the layout this measurement causes and not
                    on the one before it.
         `is-stack` whether the glyph and the word still fit on one line. Where
                    they do not the face stacks — the mark over the word — which
                    buys the word the whole column for no extra height (the row
                    is `--tap` either way, measured 44px in both states).
       THE HEAD'S OWN CHAIN IS UNCHANGED and is what keeps `has-words` honest:
       a name that does not fit falls back to its first word, a first word that
       does not fit to the glyph, and the instrument line is dropped rather
       than cut. The gate `has-words` now answers is the CELL's — can a word be
       printed at all — because that is the claim §14 makes. */
    const cell0 = t.querySelector<HTMLElement>(
      "tbody > tr[data-row] > td > .nu-cellword, tfoot td.nu-mixcell > .nu-cellword");
    if (cell0) {
      const cs = getComputedStyle(cell0);
      const pad = (parseFloat(cs.paddingInlineStart) || 0) +
                  (parseFloat(cs.paddingInlineEnd) || 0);
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;inline-size:9ch";
      cell0.appendChild(probe);
      const nine = probe.getBoundingClientRect().width;
      probe.remove();
      const ic = cell0.querySelector<HTMLElement>(".nu-ic");
      const g = cell0.querySelector<HTMLElement>(".nu-g");
      const gw = g ? g.getBoundingClientRect().width : 0;
      const gap = ic ? (parseFloat(getComputedStyle(ic).columnGap) || 0) : 0;
      (t as HTMLElement).style.setProperty("--wordw",
        Math.ceil(nine + pad) + "px");
      /* READ BACK AFTER THE WRITE. `--cellmin` is this number, so the width a
         column comes out is a consequence of the line above; reading it first
         would decide the stack on the layout the floor has just replaced. */
      const colw = cell0.getBoundingClientRect().width;
      (t as HTMLElement).classList.toggle("is-stack",
        colw < nine + gw + gap + pad - 0.5);
      (t as HTMLElement).classList.toggle("has-words", colw >= nine + pad - 0.5);
    }
    const th0 = t.querySelector<HTMLElement>("thead th.nu-colhead");
    if (th0) {
      const over = (e: HTMLElement | null): boolean =>
        !!e && e.scrollWidth > e.clientWidth + 1;
      for (const b of Array.from(
             t.querySelectorAll<HTMLElement>("thead th.nu-colhead .nu-colbtn"))) {
        b.classList.remove("is-first", "is-glyphonly", "is-noinstr");
        const n = b.querySelector<HTMLElement>(".nu-colname");
        if (over(n)) b.classList.add("is-first");
        if (over(n)) b.classList.add("is-glyphonly");
        /* ...AND THE SECOND LINE IS A WORD TOO. `.nu-colinstr` says WHAT this
           player is playing and it has no first-word fallback to take — a
           column head that reads "acoustic ba…" is cut mid-word exactly as a
           name would be (measured on the Silence record at 390 with a band
           built into it: "acoustic bass", 58px of the 88 it wanted). It is
           dropped rather than clipped; the accessible name and the title carry
           it, which is the icon round's own law about a mark that stands
           alone. */
        if (!b.classList.contains("is-glyphonly") &&
            over(b.querySelector<HTMLElement>(".nu-colinstr")))
          b.classList.add("is-noinstr");
      }
    }
  }
  onRedraw(draw);

  /* EVERY OP GOES THROUGH THE STACK, WHICH IS WHAT "for every op" MEANS.
     `run` snapshots, performs, and drops the snapshot if nothing moved. The op
     itself is unchanged — one document write through the door it always had —
     and the recompile is still `changed()`'s. */
  const op = (name: string, fn: () => void) => U.run(name, fn);
  /** ...and an op wrapped for a button: it also puts the selection where the
   *  op happened, which is what a spreadsheet does and what makes Ctrl-Z land
   *  somewhere a hand can see. */
  const wrap = (name: string, fn: () => void) => () => op(name, fn);

  /* ---- THE WRAP HOLDS ONE THING NOW, AND THAT IS §13a.6 ---------------
     (2026-09-05, TABLE.md §13. Paul, with the Silence record on his iPhone:
     *"Please look at this mess and I can't really get to anything — things
     don't scroll out of the way for me to focus it's all jammed up."*)

     WHAT STOOD HERE WAS THE FORMULA BAR AND THE ARITHMETIC THAT PAID FOR IT.
     `.nu-formula` was a sticky strip inside `.nu-sheetwrap` — the address of
     the selection, undo, redo, copy, paste and the selected cell's first
     group — and at ≤480px it took `order: 2` and rode the foot of the pane as
     "the bottom sheet". MEASURED at 390 x 844 on Kingston 1969, v287: 105.8px
     of the 716.8px wrap, standing at rest, on a record whose grid had 611.
     §13a.6 deletes it: its HEAD is the first line of the open CELL sheet
     (`cellHead` below — undo and redo therefore live where the change was
     made), and its READOUT was the sheet's own body all along, which is what
     `firstGroup` was a second drawing of. The `undoStack` and every write door
     are untouched: this moves a header, not a path.
     SO THE WRAP HOLDS THE PANE AND NOTHING ELSE, and the flex column stays
     rather than collapsing into the pane: `min-block-size: 0` on the child is
     what turns the wrap's height cap into a scroller (§11c), and a wrap with
     one child is still the box that owns the cap. */
  const view = (): TemplateResult => {
    const S = shapeOf(A);
    return html`<div class="nu-sheetwrap">${pane(S)}</div>`;
  };

  /* ---- THE CELL SHEET'S FIRST LINE (§13a.6) ---------------------------
     DESIGN.md §2 component 5 used to name a bar above the grid; it names this
     line now. The ADDRESS of the selection, then undo · redo · copy · paste,
     drawn ONCE, at the top of the sheet the selection opened — so the four
     verbs stand where the change was made and none of them is on the screen
     when there is no cell to spend them on. Every string, every `data-k` and
     every act is the one `formulaHead` carried; nothing here is new but the
     place. */
  const cellHead = (S: Shape): TemplateResult => {
    const at = S.at();
    const doc = A.doc();
    const addr = at
      ? t("bar.address", { section: A.secName(at.i),
                           player: doc.voices[at.vi]?.name || "" })
      : t("bar.noCell");
    const rangeN = rangeCells(S).length;
    /* THE ADDRESS AND THE RANGE ARE ONE PRINTED STRING, not an address with a
       count bolted on: a count picks a KEY (`bar.addrRange.one/.other`) and
       the whole line comes out of the catalogue in one piece. */
    const shown = rangeN > 1 ? tn("bar.addrRange", rangeN, { addr }) : addr;
    return html`<div class="nu-cellhead" role="group"
        aria-label=${t("bar.selection")}>
      <span class="nu-fadr" data-k="taddr" aria-live="polite">${shown}</span>
      <div class="nu-fops">
        ${barBtn("tundo", t("bar.undo"), U.undoWord, U.canUndo,
                 t("bar.undo.none"), () => { U.undo(); })}
        ${barBtn("tredo", t("bar.redo"), U.redoWord, U.canRedo,
                 t("bar.redo.none"), () => { U.redo(); })}
        ${barBtn("tcopy", t("bar.copy"), t("act.copy"), !!at,
                 t("bar.noSel"),
                 () => { if (!SEL) return; CLIP = { ...SEL }; draw(); })}
        ${barBtn("tpaste", t("bar.paste"), t("act.paste"), !!at && !!CLIP,
                 !at ? t("bar.noSel") : t("bar.paste.none"),
                 () => pasteHere(S))}
      </div>
    </div>`;
  };

  /** ONE BUTTON OF THE BAR, AND A GREY ONE CARRIES ITS REASON. The
   *  refused-control law (§4, "no silent grey") is not only about the engine:
   *  test/text-diet.test.js T3 reads EVERY disabled control on the page and
   *  demands a non-empty reason, and it named all four of these the hour they
   *  landed — "naked: tundo, tredo, tcopy, tpaste". An undo button that is grey
   *  because there is nothing to undo should say so. */
  const barBtn = (k: string, word: string, aria: string, on: boolean,
                  why: string, act: () => void): TemplateResult =>
    html`<button type="button" class="nu-opbtn" data-k=${k}
      ?disabled=${!on}
      aria-disabled=${ifDefined(on ? undefined : "true")}
      data-why=${ifDefined(on ? undefined : why)}
      title=${ifDefined(on ? undefined : why)}
      aria-label=${on ? aria : t("sheet.refused", { name: aria, why })}
      @click=${() => { if (!on) return; act(); }}>${word}</button>`;

  /* ---- THE PANE AND THE TABLE ---------------------------------------- */
  const pane = (S: Shape): TemplateResult => {
    const rows = S.across ? S.voices.map((v) => v.name) : S.secs.map((s) => s.id);
    const cols = S.across ? S.secs.map((s) => s.id) : S.voices.map((v) => v.name);
    return html`<div class="nu-pane" data-pane="table" tabindex="0"
        @keydown=${(e: KeyboardEvent) => onKey(e, S)}>
      <table class="nu-wordgrid nu-trims nu-sheetgrid"
        style=${styleMap({ "--cols": String(cols.length + 1) })}>
        <colgroup>
          <col />
          ${cols.map((c) => html`<col style=${styleMap(
            WIDTH.has(c) ? { inlineSize: WIDTH.get(c) + "px" } : {})} />`)}
          <col class="nu-addcol" />
        </colgroup>
        ${thead(S, cols)}
        ${tbody(S, rows, cols)}
        ${S.across ? nothing : tfoot(S, cols)}
      </table>
    </div>`;
  };

  const nCols = (S: Shape) =>
    (S.across ? S.secs.length : S.voices.length) + 2;   // head column + adder

  /* ---- THE HEADER ROW ------------------------------------------------ */
  /* ---- THE SPECIAL ROWS (§10a) ---------------------------------------
     A ROW OF THE SAME SHEET, MERGED ACROSS THE COLUMNS. One `<th>` spanning
     every column, because the record has no voices — the tempo is not the
     bass's tempo — and a `<th scope=row>` rather than a `<td>` because what it
     names is the whole line, which is what a row header is.
     ITS FACE IS ITS OWN CONTROL. The word and the line of values are one
     button, full width, so at 320 the whole row is the target: `ttime` /
     `trules`, `aria-expanded`, Enter and Escape from the pane's own keyboard,
     and the sheet DIRECTLY UNDER IT.

     AND "DIRECTLY UNDER IT" IS THE WHOLE OF THIS BLOCK (Paul, on v284:
     *"When I click time and rules they show up under phrases"*). The sheet
     used to be an ORPHAN — drawn at the top of the `<tbody>`, which is where a
     column head's sheet lands because a column has no row of its own — and a
     special row DOES have a row of its own, three rows up: tapping TIME opened
     an editor under TIME, RULES and PHRASES and the column heads, four rows
     away from the word that opened it. DESIGN.md §2.3 says a special row's
     *"expanded = its sheet"* and §2.4 says a sheet is *"in flow (never a
     modal)"*, so the sheet is this row's own next line and nothing else may
     stand between them; §2.3's other clause — a row *"pins under the rows
     ABOVE it"* — then says which rows keep their pins while it is open: the
     ones above the tapped row do, and the ones below it are rows the editor
     has pushed down, exactly as a section's sheet pushes the grid down. So the
     open sheet is a `<tr class="nu-wopen nu-spopen">` of the `<thead>`,
     immediately after its own row, and `stick()` releases the pins below it. */
  /* ---- THE RECORD IS ONE ROW (2026-09-06, TABLE.md §14) --------------
     THE REDESIGN'S FIRST SENTENCE (docs/REDESIGN-SCOPE.md, off the Coach
     House walkthrough): *"The page is sorted by age, not by scope."* Seven
     surfaces on this sheet say something about the whole RECORD — RULES,
     TIME, CHORDS and MOTIFS above the grid, MASTER, PRODUCE and PERFORMANCE
     below it — and walking the page they made the scope change nine times,
     with `Master` and `Time` eight screens apart and the same kind of thing.

     THEY ARE ONE LINE NOW, AND NOT ONE SHEET. The seven keep their own
     heads, their own `data-k`, their own open keys and their own sheets,
     drawn by the same four builders they always were (`SPECIALS`, `PRODUCE`,
     `masterMixSheet`, `perfCells`/`perfSheet`); what changed is where they
     STAND — behind one disclosure at the top, in the order the record is
     made in. Not one sheet was rebuilt and not one address moved, which is
     what makes `test/table-inventory.json` a re-filing rather than a rewrite.

     AND THEIR ROWS ARE ALWAYS IN THE DOM, `hidden` WHEN THE PANEL IS SHUT.
     `hidden` is what the platform already means by "not here" — off the
     glass and out of the accessibility tree — and it leaves the seven
     addresses where the page's own doors expect them: `__eightRow("time")`
     presses `ttime` by name, and `toggle` opens the panel under it (see
     `RECOPEN` above). A row that was not rendered at all would have made
     those doors a second implementation of the accordion. */
  interface Scope {
    /** the `data-k` on the head — unchanged, all seven. */
    k: string;
    /** the `OPEN` key — unchanged, all seven. */
    key: string;
    /** the `data-special`, and the tail of the row's id. */
    id: string;
    /** the class the row wore in the footer, kept so a walk that knows the
     *  master by name still finds it (it is no longer a `.nu-footrow`). */
    cls: string;
    word: string;
    aria: string;
    face(): string;
    sheet(): Field[];
    lamp(): HTMLElement | typeof nothing;
  }
  const NOLAMP = (): typeof nothing => nothing;

  /* THE SEVEN, IN THE ORDER THE RECORD IS MADE IN: the four that were the
     head's, then the three that were the foot's. `SPECIALS` is still the one
     place the first four's order is stated (§13f); the last three are
     appended here because that is where they were appended to the page. */
  const scopes = (): Scope[] => {
    const out: Scope[] = SPECIALS.map((sp) => ({
      k: sp.k, key: "sp|" + sp.id, id: sp.id, cls: "",
      word: sp.word, aria: sp.aria,
      face: () => { try { return sp.face(A); } catch (e) { return ""; } },
      sheet: () => wrapOps(sp.sheet(A)),
      lamp: () => spLamp(sp),
    }));
    /* THE MASTER, WHOSE HEAD WAS THE MIX ROW'S CORNER. Its address is `tmix`
       and its key is `mix|master` wherever the button stands (§10a's own
       sentence: "an address does not move when a row does"), so
       `openMixRow("master")` still presses it by name. What stays in the
       `<tfoot>` is the ALIGNED strip row — a fader is the player's. */
    out.push({ k: "tmix", key: "mix|master", id: "master", cls: "nu-masterrow",
      word: t("special.master.word"),
      aria: t("special.master.aria", { face: masterFace(A) }),
      face: () => masterFace(A),
      sheet: () => wrapOps(masterMixSheet(A)), lamp: NOLAMP });
    out.push({ k: PRODUCE.k, key: "sp|" + PRODUCE.id, id: PRODUCE.id,
      cls: "nu-prodrow", word: PRODUCE.word, aria: PRODUCE.aria,
      face: () => { try { return PRODUCE.face(A); } catch (e) { return ""; } },
      sheet: () => wrapOps(PRODUCE.sheet(A)), lamp: NOLAMP });
    /* PERFORMANCE, WHOSE FACE IS ITS OWN THREE WORDS and whose sheet is
       `perfCells` then `perfSheet` — the pair §13a.2 made one sheet, moved
       here whole rather than rebuilt. */
    out.push({ k: "tfoot|perf", key: "foot|perf", id: "perf",
      cls: "nu-perfrow", word: t("special.perf.word"),
      aria: t("axis.performance"),
      face: () => perfCells(A)
        .map((c) => (c as { word?: string | null }).word)
        .filter((w) => w != null && w !== "").join(" \u00b7 "),
      sheet: () => wrapOps([...perfCells(A), ...perfSheet(A)]), lamp: NOLAMP });
    return out;
  };

  /** THE ONE LINE, AND ITS FACE IS THE TIME ROW'S. Asked what a glance needs
   *  off a record, the walkthrough answered tempo · meter · key; `timeFace`
   *  has printed exactly that sentence since §10b, off the sheets that own
   *  the three words. `RECORD.face` IS `timeFace` — one owner, two callers —
   *  so a re-worded meter re-words this line by existing.
   *  IT WEARS `.nu-labelbtn` AND NOT `.nu-sphead`, which is the SECTIONS
   *  disclosure's own argument one row down: it is a button the width of a
   *  special row's line, so it takes that box, and it is NOT a sheet's head,
   *  so it must not answer `[aria-expanded="true"].nu-sphead` — the selector
   *  three gates and this page's own "shut whatever is open" gesture use. */
  const recordRow = (S: Shape, list: Scope[]): TemplateResult => {
    let face = "";
    try { face = RECORD.face(A); } catch (e) { face = ""; }
    return html`<tr class="nu-sprow nu-recrow" data-special="record">
      <th class="nu-spheadcell" scope="row" colspan=${nCols(S)}>
        <div class="nu-spline">
        <button type="button" class="nu-labelbtn" data-k=${RECORD.k}
          aria-expanded=${String(RECOPEN)}
          aria-controls=${list.map((x) => "nu-scope-" + x.id).join(" ")}
          aria-label=${RECOPEN ? t("special.record.collapse.aria")
                               : t("special.record.expand.aria")}
          @click=${openRecord}
          ><b class="nu-spword">${RECORD.word}</b
          ><span class="nu-spface">${face}</span></button>
        </div>
      </th>
    </tr>`;
  };

  /* THE PANEL ITSELF: the seven as sections, one open at a time. "One at a
     time" costs nothing to enforce — `OPEN` is the grid's one open door and
     always was, so a second scope opening closes the first by the same
     `toggle` a cell uses. */
  const scopeRows = (S: Shape, list: Scope[]): TemplateResult[] => {
    const out: TemplateResult[] = [];
    for (const sc of list) {
      const open = OPEN === sc.key;
      out.push(html`<tr id=${"nu-scope-" + sc.id}
          class=${"nu-sprow nu-scoperow" + (sc.cls ? " " + sc.cls : "")}
          data-special=${sc.id} ?hidden=${!RECOPEN}>
        <th class="nu-spheadcell" scope="row" colspan=${nCols(S)}>
          <div class="nu-spline">
          <button type="button" class="nu-sphead" data-k=${sc.k}
            aria-expanded=${String(open)}
            aria-label=${sc.aria}
            @click=${() => toggle(sc.key)}
            @contextmenu=${(e: Event) => { e.preventDefault(); toggle(sc.key, true); }}
            ><b class="nu-spword">${sc.word}</b
            ><span class="nu-spface">${sc.face()}</span></button>${sc.lamp()
          }${spClose(sc.key, open, sc.word)}
          </div>
        </th>
      </tr>`);
      if (open && RECOPEN)
        out.push(openRow(S, sheetFor(sc.key, sc.sheet), sc.word, "nu-spopen"));
    }
    return out;
  };

  /* THE DISCLOSURE ITSELF, AND IT IS NOT AN OP (the SECTIONS fold's own
     argument): no `op()`, so the undo stack does not grow; no `changed()`, so
     nothing recompiles; the document is neither read nor written. Closing it
     closes the scope standing inside it first, through the same `toggle` the
     × and a tap outside use — a sheet cannot stay open inside a panel that is
     about to be hidden. */
  function openRecord(): void {
    if (RECOPEN && RECORD_KEY(OPEN)) toggle(OPEN!);
    RECOPEN = !RECOPEN;
    draw();
  }

  /* ---- THE GRID'S OWN HEADER (2026-09-05, §13e) -----------------------
     Paul: *"Give the main composer interface its own header call it
     Sections."* TIME, RULES and MOTIFS each name what their line is about;
     the grid under them — the thing the whole page is for — named nothing,
     and a reader arriving at the column heads had to infer that the rows
     below were the song's sections.
     IT WEARS THE SPECIAL ROW'S OWN FURNITURE (`.nu-spline`, `.nu-spword`,
     `.nu-spface`) because it IS that line — the word left, the count right,
     `--tap` tall, a hairline under — and it is the ONE `<thead>` row that does
     not pin: `stick()` pins the LAST head row (the column heads) and this
     stands directly above them, in the flow, scrolling away with the special
     rows.
     ITS COUNT IS THE RECORD'S, NOT THE VIEW'S. Sections and bars are document
     facts, so the line reads the same when §5's transpose turns the grid and
     the sections are running across it.

     ...AND IT IS A DISCLOSURE SINCE 2026-09-05 (§13f). Paul: *"Sections should
     collapse when I touch it."* It said here, from 2026-09-05 to 2026-09-05,
     that it was *"a LABEL and not a row with a sheet — no button, no
     `aria-expanded`, no `data-k`: there is nothing to open, so there is
     nothing to tap"*. There is something to do: FOLD. So the line is a button
     the width of the row, `aria-expanded` says which way it stands and
     `aria-controls` names the body it folds — and what it opens is not a
     sheet, which is why the accordion (`OPEN`) does not know about it and one
     sheet at a time is untouched. The COUNT stays on the right in both states:
     folded, it is the only thing the grid says, which is the whole reason a
     hand folds it. */
  const gridLabel = (S: Shape): TemplateResult => {
    const secs = A.doc().form.sections;
    const bars = secs.reduce((n, x) => n + (x.bars || 0), 0);
    return html`<tr class="nu-gridlabel">
      <th class="nu-spheadcell nu-labelcell" scope="colgroup"
          colspan=${nCols(S)}>
        <div class="nu-spline">
        <button type="button" class="nu-labelbtn" data-k="tsections"
          aria-expanded=${String(GRIDOPEN)} aria-controls="nu-gridbody"
          aria-label=${GRIDOPEN ? t("grid.sections.collapse.aria")
                                : t("grid.sections.expand.aria")}
          @click=${foldGrid}
          ><b class="nu-spword">${t("grid.sections.word")}</b
          ><span class="nu-spface">${tn("grid.sections.count", secs.length,
            { bars: tn("count.bar", bars) })}</span></button>
        </div>
      </th>
    </tr>`;
  };

  /* THE FOLD ITSELF, AND IT IS NOT AN OP (§13f). No `op()` wrapper, so the
     undo stack does not grow; no `changed()`, so nothing recompiles; the
     document is not read and not written. What it DOES do first is close the
     grid's own open sheet — a cell's, a section's, a column's, the corner's —
     through `toggle`, the same door the × and a tap outside use, because a
     sheet that lives in the `<tbody>` cannot stay open inside a body that is
     about to be hidden. A SPECIAL ROW'S sheet is not touched: it stands above
     the grid, it is not folded away, and §13f's own line says the four rows
     over the label are untouched. */
  function foldGrid(): void {
    /* ...AND WHAT IT LEAVES ALONE IS THE RECORD'S SEVEN AND NOT "ANY MERGED
       ROW" (2026-09-06, §14). It read `!SPECIAL(OPEN)`, which was the same
       set while every merged row stood above the grid; the MIX row's own
       per-voice seats are merged rows too, they stand in the `<tfoot>` and
       they are hidden by this fold, so a seat sheet left open by it was a
       sheet with no strip over it. The seven the panel holds are the ones
       that must survive, and they are named. */
    if (GRIDOPEN && OPEN && !RECORD_KEY(OPEN)) toggle(OPEN);
    GRIDOPEN = !GRIDOPEN;
    saveGridOpen();
    draw();
  }

  /* ---- THE HEAD ROW, AND ITS LAST CELL IS ONE `+` (§13a.5, §13e) ------
     Paul, on the Silence record at 390: *"three adders (`+ line · + bass · +
     drums`) took more width than the three players they were offering to
     join."* MEASURED on v287 at 390 and at 320: the adder column is 224px of
     a 364.4px pane (`--addw: 22ch`), the head cell 57.3px tall, and the three
     offers stand there whether or not a hand is adding anything.
     SO THE ADDERS ARE ONE CELL. The head row ends in ONE `+` cell, `--tap`
     wide, and the grid ends in ONE `+` row. For one afternoon they opened an
     ADD sheet; §13e deletes it — *"Don't pop up an interface when I add a
     section or a voice. Just add it."* — so each `+` IS its own offer and a
     tap on it writes. The three column widths the adders took stay with the
     players. */
  /* ...AND THE COLUMN HEADS FOLD WITH THE BODY THEY HEAD (§13f). `hidden` and
     not a class: it is the attribute the platform already means by "not here",
     it takes the row out of the accessibility tree as well as off the glass,
     and `stick()` reads the same absence a hand does (a hidden row reports no
     client rects, so it cannot be the pane's one pin). */
  const thead = (S: Shape, cols: string[]): TemplateResult => {
    const list = scopes();
    return html`<thead>
    ${recordRow(S, list)}
    ${scopeRows(S, list)}
    ${gridLabel(S)}
    <tr ?hidden=${!GRIDOPEN}>
      <th class="nu-cornerh">${cornerBtn(S)}</th>
      ${repeat(cols, (c) => c, (c) => S.across ? secHead(S, c) : voiceHead(S, c))}
      <th class="nu-plushead" scope="col">${plusBtn(S, "head")}</th>
    </tr>
  </thead>`;
  };

  /** THE HEAD'S WORD, TWICE: the whole name and its first word. Which of the
   *  two is drawn — or neither — is `stick()`'s measurement (§13a.7), because
   *  a head must never be cut in the middle of a word and only the rendered
   *  box knows whether it was. Both spans hold the SAME name; nothing here is
   *  a second spelling of it. */
  /* ---- THE × IS THE OPEN ROW'S OWN (§13a.3) ---------------------------
   *  *"Tap a row and it pins as the HEADER of its own sheet … the header
   *  carries the × at its right end."* It is drawn only while the row is open,
   *  it is a SIBLING of the head button (the head is a toggle and a button
   *  inside a button is not a control), and it closes through the same
   *  `toggle` a second tap on the header does — one door, two targets, which
   *  is DESIGN.md §3's *"never under a finger that is changing a value"* given
   *  something to aim at. */
  const spClose = (openKey: string, open: boolean, name: string):
      TemplateResult | typeof nothing => {
    if (!open) return nothing;
    const mk = actMark("close");
    return html`<button type="button" class="nu-spclose"
      data-k=${"tclose|" + openKey}
      aria-label=${t("act.closeTab.aria", { name })}
      @click=${() => toggle(openKey)}
      ><span class="nu-g" aria-hidden="true">${mk ? mk.g : "\u00d7"}</span
      ><span class="nu-vh">${mk ? mk.w : t("act.close")}</span></button>`;
  };

  const headWord = (name: string): TemplateResult => {
    const first = String(name).split(/\s+/)[0] || String(name);
    return html`<b class="nu-colname"
      ><span class="nu-cnfull">${name}</span
      ><span class="nu-cnfirst">${first}</span></b>`;
  };

  const cornerBtn = (S: Shape) => html`<button type="button"
    class="nu-rowjump nu-corner" data-k="tcorner"
    aria-expanded=${String(OPEN === "corner")}
    aria-label=${t("head.corner.aria")}
    @click=${() => toggle("corner")}
    @contextmenu=${(e: Event) => { e.preventDefault(); toggle("corner", true); }}
    >${S.across ? t("noun.player") : t("noun.section")}</button>`;

  /** A PLAYER'S HEAD. The lamp is a SIBLING of the button inside the `<th>` and
   *  never a child of it: `[data-live]` is a surface the clock may write, and a
   *  control inside one is the shape test/motif-frozen A1 forbids (T8e counts
   *  it through `closest("th")`). */
  const voiceHead = (S: Shape, name: string): TemplateResult => {
    const v = A.doc().voices.find((x) => x.name === name)!;
    const vi = A.doc().voices.indexOf(v);
    const sub = A.playsWhat(v) || "";
    const cm = A.colMark(vi);
    return html`<th class="nu-colhead" data-vi=${String(A.vpaintOf(vi) ?? "")}
        scope="col">
      <button type="button" class="nu-colbtn nu-vpaint" data-k=${"tcol|" + name}
        aria-expanded=${String(OPEN === "col|" + name)}
        aria-label=${t("head.player.aria",
                       { name, instrument: sub || t("head.player.none") })}
        title=${sub ? t("head.player.aria", { name, instrument: sub })
                    : t("head.name", { name })}
        data-say=${ifDefined(cm && cm.s ? cm.s : undefined)}
        @click=${() => toggle("col|" + name)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("col|" + name, true); }}
        >${cm ? html`<span class="nu-g" aria-hidden="true">${cm.g}</span>` : nothing
        }${headWord(name)}${
        cm ? html`<span class="nu-vh">${cm.w}</span>` : nothing}${
        sub ? html`<span class="nu-colinstr">${sub}</span>` : nothing}</button>
      ${lamp(name)}
      ${grip(name, "tcol|" + name, name)}
    </th>`;
  };

  const secHead = (S: Shape, sid: string): TemplateResult => {
    const i = A.doc().form.sections.findIndex((s) => s.id === sid);
    const s = A.doc().form.sections[i]!;
    const sm = A.rowMark(i);
    return html`<th class="nu-colhead" scope="col">
      <button type="button" class="nu-colbtn" data-k=${"tcol|" + sid}
        aria-expanded=${String(OPEN === "row|" + sid)}
        aria-label=${tn("head.section", s.bars, { name: A.secName(i) })}
        @click=${() => toggle("row|" + sid)}
        data-say=${ifDefined(sm && sm.s ? sm.s : undefined)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("row|" + sid, true); }}
        >${sm ? html`<span class="nu-g" aria-hidden="true">${sm.g}</span>` : nothing
        }${headWord(A.secWord(i))
        }<span class="nu-colinstr">${tn("count.bar", s.bars)}</span>${
        sm ? html`<span class="nu-vh">${sm.w}</span>` : nothing}</button>
      ${grip(sid, "tcol|" + sid, A.secName(i))}
    </th>`;
  };

  /** THE RESIZE HANDLE, AND IT IS A BUTTON BECAUSE A DRAG-ONLY CONTROL IS A
   *  REFUSED ONE (6 ¶A). It drags with a pointer and it steps with the arrow
   *  keys, and it is the header's full height so it clears the 44px floor the
   *  shell gate measures on every visible button in this pane. */
  /* `colId` IS THE `<col>`'s KEY AND `addr` IS THE HANDLE'S ADDRESS, and they
     are two arguments because they were one and the column did not move: the
     grip wrote `WIDTH["tcol|stab"]` and the `<colgroup>` read `WIDTH["stab"]`.
     T9r caught it — a control that writes and does not arrive, which is this
     repo's characteristic bug, in the wave whose own gate was written to find
     it. The `<col>` is keyed by the column's identity; the button keeps the
     `tgrip|<address>` a hand and the inventory reach it by. */
  const grip = (colId: string, addr: string, name: string) => html`<button type="button"
    class="nu-colgrip" data-k=${"tgrip|" + addr}
    aria-label=${t("head.grip.aria", { name })}
    @keydown=${(e: KeyboardEvent) => {
      const d = e.key === "ArrowRight" ? 12 : e.key === "ArrowLeft" ? -12 : 0;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      const th = (e.target as HTMLElement).closest("th") as HTMLElement | null;
      const now = WIDTH.get(colId) ?? (th ? th.getBoundingClientRect().width : 96);
      WIDTH.set(colId, Math.max(56, now + d)); draw(); }}
    @pointerdown=${(e: PointerEvent) => {
      const th = (e.target as HTMLElement).closest("th") as HTMLElement | null;
      if (!th) return;
      e.preventDefault(); e.stopPropagation();
      const x0 = e.clientX, w0 = WIDTH.get(colId) ?? th.getBoundingClientRect().width;
      const move = (m: PointerEvent) =>
        { WIDTH.set(colId, Math.max(56, w0 + (m.clientX - x0))); draw(); };
      const up = () => { window.removeEventListener("pointermove", move);
                         window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up); }}></button>`;

  /* ---- THE `+` ADDS. IT DOES NOT ASK (2026-09-05, §13e) ---------------
     Paul, on the ADD sheet that shipped this morning: *"Don't pop up an
     interface when I add a section or a voice. Just add it."*

     TWO BUTTONS, TWO OPS, NO SHEET. The head's `+` and the foot's `+` are the
     two edges a spreadsheet has always put "one more" at, and each now writes
     the record on the tap: the `+` at the end of the ROW axis adds a section
     (`sectionOffer`, one offer, nothing to choose), the `+` at the end of the
     COLUMN axis hires the one player the band has not got (`nextPlayerOffer`,
     build-the-band's own order — drums, then bass, then a line). §5's
     transpose swaps which edge is which, and the two offers swap with it,
     because the axis is what the `+` is at the end of.

     ITS `data-k` IS THE OFFER'S OWN, and that is the address law (line 833's
     `<field>|<value>`) rather than a convenience: `tcol-add|drums` and
     `trow-add` are the addresses build-the-band minted and eleven gates and
     the T7 inventory drive, so the control a hand taps and the op it runs are
     spelled the same. The other two player kinds are one tap away in any
     column head's own sheet (`colOps`), and reachable from the `+` itself the
     moment the one it offers exists — a second tap offers the next.

     AND ITS ACCESSIBLE NAME SAYS WHICH ONE, because a `+` that writes without
     asking has to say what it is about to write before a thumb commits: the
     offer's own `aria` (`Add drums`, `Add bass`, `Add line`, `Add section at
     the end`), never a generic "add". The mark stays `GLYPH.act.add` — one
     picture for "one more" at either edge — and the `.nu-vh` word beside it is
     the offer's. */
  const plusOffer = (S: Shape, where: "head" | "foot"): Op =>
    (where === "head") === S.across
      ? sectionOffer(A)[0]! : nextPlayerOffer(A);

  const plusBtn = (S: Shape, where: "head" | "foot"): TemplateResult => {
    const o = plusOffer(S, where);
    const mk = actMark("add");
    return html`<button type="button" class="nu-plusbtn"
      data-k=${o.k}
      aria-label=${o.aria || o.word}
      data-say=${ifDefined(o.aria || undefined)}
      @click=${() => { if (o.act) op(o.word, o.act); }}
      ><span class="nu-g" aria-hidden="true">${mk ? mk.g : "+"}</span
      ><span class="nu-vh">${o.word}</span></button>`;
  };


  /* ---- THE BODY ------------------------------------------------------ */
  const tbody = (S: Shape, rows: string[], cols: string[]): TemplateResult =>
    html`<tbody id="nu-gridbody" ?hidden=${!GRIDOPEN}>
      ${orphanSheet(S)}
      ${repeat(rows, (r) => r, (r) => bodyRow(S, r, cols))}
      <tr class="nu-addrow">
        <th class="nu-plusrowh" scope="row">${plusBtn(S, "foot")}</th>
        <td colspan=${nCols(S) - 1}></td>
      </tr>
    </tbody>`;

  /** A SHEET WITH NO ROW OF ITS OWN LANDS AT THE TOP OF THE BODY, which is
   *  where ui/wordgrid.js has always put a column head's: a column has no row,
   *  and neither has the corner. Which of the two head kinds is the orphan
   *  depends on which way the table faces — §5's transpose swaps them — so it
   *  is asked rather than named, and the corner is an orphan either way. */
  const orphanSheet = (S: Shape): TemplateResult | typeof nothing => {
    if (!OPEN) return nothing;
    if (OPEN === "corner")
      return openRow(S, sheetFor("corner", () => [{ kind: "ops",
        label: t("head.song"),
        ops: tableOps(A, S.across).map((x) => x.act
          ? { ...x, act: () => op(x.word, x.act!) } : x) }]), t("head.song"));
    /* A SPECIAL ROW'S SHEET IS NOT AN ORPHAN, and that is the v285 repair:
       it HAS a row of its own, in the `<thead>`, and `specialRows` draws the
       sheet as that row's own next line. It stood here until Paul read the
       result out loud — *"when I click time and rules they show up under
       phrases"* — which is what an orphan sheet says when its row is three
       rows above the body. */
    if (OPEN.indexOf("col|") === 0 && !S.across)
      return openRow(S, sheetFor(OPEN, () => colSheetOf(OPEN!.slice(4))), OPEN.slice(4));
    if (OPEN.indexOf("row|") === 0 && S.across)
      return openRow(S, sheetFor(OPEN, () => rowSheetOf(OPEN!.slice(4))), OPEN.slice(4));
    return nothing;
  };

  const bodyRow = (S: Shape, rid: string, cols: string[]): TemplateResult => {
    const head = S.across ? voiceRowHead(rid) : secRowHead(rid);
    const at = S.at();
    const here = !S.across && at != null &&
      A.doc().form.sections[at.i]?.id === rid;
    const openKey = S.across ? "col|" + rid : "row|" + rid;
    return html`<tr data-row=${rid}
        class=${classMap({ "nu-here": !!here })}>
      ${head}
      ${repeat(cols, (c) => c, (c) => bodyCell(S, rid, c))}
      <td class="nu-addcell"></td>
    </tr>
    ${OPEN === openKey ? openRow(S, sheetFor(openKey,
        () => S.across ? colSheetOf(rid) : rowSheetOf(rid)), rid) : nothing}
    ${cols.map((c) => {
      const key = S.across ? "cell|" + c + "|" + rid : "cell|" + rid + "|" + c;
      return OPEN === key
        ? openRow(S, sheetFor(key, () => cellSheetOf(S, rid, c)),
                  t("cell.sheet.name",
                    { name: S.across ? rid : c,
                      section: S.across ? c : rid }),
                  "nu-cellopen", cellHead(S))
        : nothing; })}`;
  };

  /* ---- A HEAD IS A FACE TOO, AND THREE OF THEM LOST THEIR WORD ---------
     The glyph round (2026-09-05) gave every head a MARK. `face()` below emits
     all four parts of one — the picture, the number, the visible word and the
     `.nu-vh` word — but these three heads draw their marks BY HAND (they carry
     a `data-live` count, a `<b class="nu-colname">` and a `<small>` that
     `face()` has no shape for), and the hand-written version emitted three of
     the four. The picture went in and the hidden word did not.

     MEASURED, and it is the whole of two standing reds: test/shell.js A6h and
     test/text-diet.test.js T2 both sweep `button .nu-g` and demand an
     `aria-label` AND a `.nu-vh` on the button that holds it, and both named
     `trow|s0` — the section row head — at every width, four and six times
     over. `voiceColHead` above passes because it emits its `.nu-vh`; `secHead`,
     `secRowHead` and `voiceRowHead` did not.

     THE WORD IS THE MARK'S OWN (`mark.w`, ui/glyph.js's catalogue), never a
     second spelling typed here — the same rule `face()` follows. It lands
     inside a `<th>` that is `position: sticky`, which is a containing block,
     so the absolutely-positioned hidden word cannot escape its own head and
     take the page sideways (nu.css `.nu-ic`, and the measurement there). */
  /* ...AND THE SECTION ROW HEAD HAS NO MARK ON IT (2026-09-05, §13f). Paul:
     *"You don't need to put the little grid icon to the left of each section
     number."* It drew `A.rowMark(i)` — the ▦ every section wears — in front of
     the number, on every row of the grid, which is the one place a mark says
     nothing a reader did not already know: the rows of this table ARE the
     sections, the SECTIONS label one line above says so, and thirteen copies
     of one picture down the left edge is a column of noise in the narrowest
     column on the page. The number, the name and the bar count stay, and so
     does the accessible name (`12 chorus, 8 bars`), which never came off the
     mark. The MARK ITSELF is not deleted: `A.rowMark` still draws the section
     in the cell sheet's own header and in the provenance words, which is where
     one ▦ stands for one thing. `.nu-vh` and `data-say` go with the picture
     they belonged to — a hidden word for an absent icon is a word about
     nothing, and the two gates that sweep `button .nu-g` for a name and a
     `.nu-vh` (test/shell.js A6h, test/text-diet.test.js T2) ask about buttons
     that HAVE a mark. */
  /* ...AND THE PLATE SAYS WHAT THE SECTION CALLS ITSELF (2026-09-06, wave C
     item 8: *"A section has a name"*). It read `A.roleWord(s.role)` — which is
     a string, and a string cannot know whether the section it came out of has
     a name — so a hand that typed `pre-chorus` into the section's own sheet
     saw it in the accessible name, in the score and in the Live set, and not
     on the row it had just named. `A.secWord(i)` is the same fact asked of the
     INDEX and it answers the type's word where nothing is written, so an
     unnamed record draws byte for byte what it drew before. The two sites are
     this one and `secHead` (the same plate when the table is turned). */
  const secRowHead = (sid: string) => {
    const i = A.doc().form.sections.findIndex((s) => s.id === sid);
    const s = A.doc().form.sections[i]!;
    return html`<th class="nu-srowh" scope="row">
      <button type="button" class="nu-rowjump" data-k=${"trow|" + sid}
        aria-expanded=${String(OPEN === "row|" + sid)}
        aria-label=${tn("head.section", s.bars, { name: A.secName(i) })}
        @click=${() => toggle("row|" + sid)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("row|" + sid, true); }}
        ><span data-live="count"><span>${i + 1}</span></span
        ><span class="nu-srowname"> ${A.secWord(i)}</span></button>
      <small> ${tn("count.bar", s.bars)}</small>
    </th>`;
  };

  const voiceRowHead = (name: string) => {
    const doc = A.doc();
    const v = doc.voices.find((x) => x.name === name)!;
    const vm = A.colMark(doc.voices.indexOf(v));
    return html`<th class="nu-srowh" scope="row">
      <button type="button" class="nu-rowjump" data-k=${"trow|" + name}
        aria-expanded=${String(OPEN === "col|" + name)}
        aria-label=${t("head.name", { name })}
        @click=${() => toggle("col|" + name)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("col|" + name, true); }}
        data-say=${ifDefined(vm && vm.s ? vm.s : undefined)}
        ><span class="nu-g" aria-hidden="true">${vm ? vm.g : ""}</span
        ><span class="nu-srowname">${name}</span>${
        vm ? html`<span class="nu-vh">${vm.w}</span>` : nothing}</button>
      <small> ${A.playsWhat(v) || ""}</small>
    </th>`;
  };

  /* ---- A FACE: A MARK, A NUMBER, AND THE WORD ------------------------
     Paul, 2026-09-05: *"When you redesign use more icons. Ideally the table
     is a large set of icons."*

     THREE PARTS, WHICH ARE ui/glyph.js's OWN THREE and are written here by
     hand only because this table is drawn by lit and `paintIcon` builds DOM:
       `.nu-g`   the glyph, `aria-hidden` — it is a picture, and a screen
                 reader that read "black star" would be reading the ink
       `.nu-n`   a number, where the value IS one (a bar count) — Paul's own
                 sentence from the icon round: *"Voice 2 for example could be
                 more symbol plus the number 2"*
       `.nu-vh`  the WORD, visually hidden and in the accessible name. This is
                 the a11y law of the 2026-08-28 icon round, stated in
                 ui/glyph.js's header: *"with the stylesheet off this page
                 still reads as the same document it always did, and a screen
                 reader hears 'Where', never 'circled plus'."*
     ...and `data-say` on the BUTTON, so the one explainer this page has —
     long-press for a thumb, hover for a mouse — speaks the mark's clause.

     THE WORD IS VISIBLE WHERE THERE IS NO HONEST MARK, which is the ruling's
     own boundary: a motif is CALLED `counter` and no picture says that, so the
     mark beside it says where the motif came from and the name is printed. */
  const face = (mark: Mark | null, word: string | null,
                num?: string | number | null): TemplateResult =>
    html`<span class="nu-ic"
      >${mark ? html`<span class="nu-g" aria-hidden="true">${mark.g}</span>` : nothing
      }${num != null && num !== "" ? html`<span class="nu-n">${num}</span>` : nothing
      }${word != null && word !== "" ? html`<span class="nu-w">${word}</span>` : nothing
      }${mark ? html`<span class="nu-vh">${mark.w}</span>` : nothing}</span>`;

  /** ONE CELL, AND AT REST IT IS A CELL AND NOT A BOX (TABLE.md 11, RULED
   *  2026-09-05). Paul: *"less boxes inside the cells and more of the cells
   *  just being cells"*. What it prints without being opened is what this voice
   *  PLAYS here, as PLAIN TEXT: no plate, no rule, no radius — the border that
   *  used to be "the box" is gone and the typography carries what it carried.
   *  BOLD is written (`--fw-label`), quiet is inherited (2's "the table draws
   *  only deviations", which is what makes eighty cells readable), the ring is
   *  the selection and dashed is still a refusal.
   *
   *  AND ONE TAP OPENS WHAT YOU TAPPED (2026-09-06, TABLE.md §14, item 3).
   *  THIS COMMENT SAID, from 2026-09-05: *"the first tap opens nothing but the
   *  ring. A spreadsheet's first tap SELECTS; the second one edits … tap once
   *  to stand on it (the formula bar names it), tap the SAME cell again to
   *  edit."* That decision was made for a page that HAD a formula bar: the
   *  first tap paid for itself by filling a readout above the grid, and the
   *  second one opened the vector. §13a.6 deleted the formula bar and moved
   *  its head INTO the cell sheet, so from that day the first tap bought
   *  nothing but an outline — and the Coach House walkthrough measured what
   *  that cost on a phone: *"A cell needs two taps to open, a section row one,
   *  a column header two — and the first tap on a cell does nothing but draw a
   *  ring … I lost ~20 taps to this in the first ten minutes."* Measured on
   *  v290 at 390 and 320, both records: a CELL took 2 taps to open and a row
   *  head, a column head and a special row took 1. Three targets, two tap
   *  counts, and nothing on the glass saying which.
   *  SO THE GRAMMAR IS ONE SENTENCE: a tap opens what you tapped, at its own
   *  scope. The SELECTION follows the opening rather than preceding it —
   *  `toggle` writes `SEL` from the key, so the ring lands on the cell whose
   *  sheet is now under it. Nothing is lost from the two-tap law: a range is
   *  still SHIFT-tap (which selects and opens nothing), the keyboard still
   *  moves the ring with the arrows and opens with Enter, and copy/paste are
   *  where §13a.6 put them, on the open sheet's own op row — so the gesture
   *  that reaches them is the tap that opens it. */
  const bodyCell = (S: Shape, rid: string, cid: string): TemplateResult => {
    const sid = S.across ? cid : rid;
    const name = S.across ? rid : cid;
    const doc = A.doc();
    const i = doc.form.sections.findIndex((s) => s.id === sid);
    const vi = doc.voices.findIndex((v) => v.name === name);
    if (i < 0 || vi < 0) return html`<td><span>—</span></td>`;
    const key = "tcell|" + name + "|" + sid;
    const openKey = "cell|" + sid + "|" + name;
    const word = A.cellWord(i, vi);
    const mark = A.cellMark(i, vi);
    const hand = A.written(i, vi);
    const sel = !!SEL && SEL.sec === sid && SEL.voice === name;
    const inRange = rangeHas(S, sid, name);
    return html`<td class=${classMap({ "is-inrange": inRange })}>
      <button type="button"
        class=${classMap({ "nu-wcell": true, "nu-cellword": true,
                           "is-derived": !hand, "is-sel": sel })}
        data-k=${key}
        aria-expanded=${String(OPEN === openKey)}
        aria-selected=${String(sel)}
        aria-label=${mark
          ? t("cell.aria.mark", { name, section: A.secName(i),
                                  value: word, mark: mark.w })
          : t("cell.aria", { name, section: A.secName(i), value: word })}
        data-say=${ifDefined(mark && mark.s ? mark.s : undefined)}
        @click=${(e: MouseEvent) => {
          if (e.shiftKey && SEL) { ANCHOR = { sec: sid, voice: name }; draw(); return; }
          /* AN ARMED BANK SPENDS ITSELF ON THE NEXT CELL (§10b step 4). The
             tap still SELECTS — a spreadsheet's tap always does — and the
             motif lands on the cell it selected, which is what a hand that
             tapped a name and then a cell asked for in that order. */
          if (ARM) { const m = ARM; ARM = null;
                     SEL = { sec: sid, voice: name }; ANCHOR = null;
                     A.pointCell(i, vi, m); return; }
          ANCHOR = null;
          /* ONE TAP OPENS THE CELL (§14). `toggle` sets `SEL` off the key on
             its way in, so the ring and the sheet arrive together; a second
             tap on the same cell closes it, which is what every other head on
             this surface already does. */
          toggle(openKey); }}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle(openKey, true); }}
        >${face(mark, word === "\u2014" ? null : word)}</button>
    </td>`;
  };

  /* ---- THE FOOTER: THE RECORD (1 RECORD) ------------------------------ */
  /* ---- THE FOOTER: THE MIX ROW, ITS MASTER, THEN PERFORMANCE ---------
     THE `master` FOOT ROW IS THE MIX ROW'S MASTER SINCE 2026-09-07 (§10b step
     3). It read `footRow(S, "master", "tfoot|master", …, masterCells(A))` —
     the seven master words as CELLS of a merged row, each writing through
     `A.setMaster` — and both the row and those seven cells are deleted, not
     moved: ui/engineer.js's main plate draws `master|<key>` for every one of
     them through the same `NuDeskDoc.writeMaster`, so the footer's copy was
     the SECOND control for one fact and the round that put the board in the
     master's own sheet is the round that had to pick one. What is left is the
     READ — `masterFace` says what the record is standing on — and the board,
     which is what the row opens. `masterCells` and `masterSheet` went with the
     row; `model.ts` carries the tombstone. */
  /* ---- THE FOOTER HOLDS THE MIX AND NOTHING ELSE (2026-09-06, §14) ---
     It held four rows: the mix strip, the master, PRODUCE and PERFORMANCE.
     Three of those are the RECORD's and they are one line at the top now —
     §14, off the walkthrough's *"`Master` and `Time` are eight screens apart
     and are the same kind of thing"*. What is left is the one row that is
     ALIGNED: a FADER is the bass's fader, so the strips stand under the
     players' own heads and stay exactly where they were.
     (`produceRow` and `perfRow` STOOD BELOW. Both are entries of `scopes()`
     now, drawn by `scopeRows` from the same `PRODUCE.face`/`PRODUCE.sheet`
     and the same `perfCells`/`perfSheet` — moved, not rebuilt.) */
  const tfoot = (S: Shape, cols: string[]): TemplateResult => html`<tfoot>
    ${mixRow(S, cols)}
  </tfoot>`;

  /* ---- THE MIX ROW (§10a: "MIX is ALIGNED") --------------------------
     One cell per voice column, each carrying that seat's own level word and
     its own lamp, and a MASTER row directly under them. It is the `<tfoot>`'s
     first pair of rows and it exists only in the sections-down facing, because
     a row aligned to the voice COLUMNS has nothing to align to when the
     transpose puts sections there (`pane()` draws no footer at all across, and
     has not since wave 2b).

     THE MASTER IS A MERGED ROW UNDER IT, AND THAT IS TWO MEASUREMENTS AND
     NOT A PREFERENCE. §10a drew it inside the mix row — `│ MIX │ strip │
     strip │ strip │ master │` — and it was built that way twice before it was
     drawn on a phone:
       IN THE ROW HEAD it is unreadable. The head column of this table is
       NARROW by construction: MEASURED at all three widths, the `<th>` is 36px
       at 320 and 390 and 45px at 1280, the button inside it 26 and 35, and the
       face `soft · worn · room · warm · open` rendered at SEVENTEEN PIXELS. No
       stylesheet widens that column without narrowing the players.
       IN THE ADDER COLUMN it is off the screen. Measured: the button is 547px
       wide and reads perfectly — at an x that is seven player columns to the
       right of a 255px pane. The mix row's cells are inside the pane's own
       horizontal scroll, which is exactly right for a fact that belongs to a
       COLUMN and exactly wrong for one that belongs to the record.
     AND A RECORD-LEVEL FACT IN THIS TABLE IS A MERGED ROW — §10a's own first
     sentence, the shape TIME and RULES already have. So the master is one
     `<th colspan>` under the strips, its line pinned to the pane's left edge
     by `.nu-sphead`'s `--panew` like every other merged row's, reading whole at
     320. The address did not move: `tmix` is on the master's button wherever
     the button stands, and `openMixRow("master")` presses it by that name. */
  const mixRow = (S: Shape, cols: string[]): TemplateResult => {
    /* THE MIX ROW FOLDS WITH THE GRID (2026-09-05, §13f), and since 2026-09-06
       (§14) it is the whole of the `<tfoot>`. It is the one row down here that
       is ALIGNED — a cell per COLUMN, standing under that player's own head —
       so a mix strip with no column head over it is a row of unlabelled
       faders, which is why it folds with the heads. The MASTER, PRODUCE and
       PERFORMANCE rows that stood under it are merged facts about the RECORD
       and are the record row's own sections now: they are not "what a hand
       folds the grid to reach" any more, because they are one tap from the
       top of the page whether the grid is folded or not. */
    return html`<tr class="nu-footrow nu-mixrow" data-row="mix"
        ?hidden=${!GRIDOPEN}>
      <th class="nu-srowh" scope="row"><span class="nu-srowname">${
        t("special.mix.word")}</span></th>
      ${repeat(cols, (c) => c, (c) => mixCell(c))}
      <td class="nu-addcell"></td>
    </tr>
    ${cols.map((c) => OPEN === "mix|" + c
      ? openRow(S, sheetFor(OPEN!, () => wrapOps(mixSheet(A, c))), c)
      : nothing)}`;
  };

  /** ONE SEAT, COLLAPSED. The word is the strip's own reading of the fader and
   *  the lamp is the column head's own lamp built a second time — `lampFor`
   *  registers each node it makes with the page's paint list, so two lamps for
   *  one player are two nodes lit by one join and never one node moved between
   *  two cells (a DOM node has one parent, and a shared one would vanish from
   *  the head the moment the footer drew). It is the SIBLING of the button and
   *  never its child: `[data-live]` is a surface the clock writes, and a
   *  control inside one is the shape test/motif-frozen A1 forbids. */
  const mixCell = (name: string): TemplateResult => {
    const openKey = "mix|" + name;
    const word = A.mixWord(name);
    const mk = A.mixMark(name);
    return html`<td class="nu-mixcell">
      <button type="button"
        class=${classMap({ "nu-wcell": true, "nu-cellword": true,
                           "is-derived": !A.mixWritten(name) })}
        data-k=${"tmix|" + name}
        aria-expanded=${String(OPEN === openKey)}
        aria-label=${mk
          ? t("mix.cell.aria.mark", { name, value: word, mark: mk.w })
          : t("mix.cell.aria", { name, value: word })}
        data-say=${ifDefined(mk && mk.s ? mk.s : undefined)}
        @click=${() => toggle(openKey)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle(openKey, true); }}
        >${face(mk, word === "\u2014" ? null : word)}</button>
      ${mixLamp(name)}
    </td>`;
  };

  /* (`footRow` AND `footCell` STOOD HERE, to 2026-09-05. `footRow` drew a row
     head beside a spanning cell of wrapping word plates (`.nu-footcells` /
     `.nu-footcell`) and `footCell` drew one of those plates; PERFORM was their
     last caller and it is a merged one-line row now (§13a.2, `perfRow` above).
     What went with them: the three-line strip at the foot of every record, and
     `footCell`'s own click, which set `OPENFIELD` to an address the sheet it
     opened did not contain.) */

  /* ---- THE OPEN ROW, WHICH IS THE FORMULA BAR'S BODY ------------------ */
  const openRow = (S: Shape, fields: Field[], name: string,
                   cls?: string, head?: TemplateResult): TemplateResult =>
    html`<tr class=${cls ? "nu-wopen " + cls : "nu-wopen"}
      ><td colspan=${nCols(S)}>${head ?? nothing}${
      sheetBody(fields, name, OPENFIELD,
                (k) => { OPENFIELD = k; draw(); },
                () => { /* the write ends in changed() -> draw(); nothing here */ })
    }</td></tr>`;

  /* ---- the three sheets, each with its ops on its first line ---------- */
  const rowSheetOf = (sid: string): Field[] => {
    const i = A.doc().form.sections.findIndex((s) => s.id === sid);
    return i < 0 ? [] : wrapOps(rowSheet(A, i));
  };
  const colSheetOf = (name: string): Field[] => {
    const vi = A.doc().voices.findIndex((v) => v.name === name);
    return vi < 0 ? [] : wrapOps(colSheet(A, vi));
  };
  const cellSheetOf = (S: Shape, rid: string, cid: string): Field[] => {
    const sid = S.across ? cid : rid, name = S.across ? rid : cid;
    const i = A.doc().form.sections.findIndex((s) => s.id === sid);
    const vi = A.doc().voices.findIndex((v) => v.name === name);
    if (i < 0 || vi < 0) return [];
    const f = wrapOps(cellSheet(A, i, vi));
    /* ...AND THE TWO SPREADSHEET VERBS THAT HAVE NO OTHER HOME (9a: "Copy /
       paste move a cell's vector"). They are appended to the cell's own op bar
       rather than given a bar of their own, because they are the same kind of
       thing the three beside them are: one gesture on this cell. */
    const ops = f.find((x) => (x as { kind?: string }).kind === "ops") as
      { kind: "ops"; ops: Op[] } | undefined;
    if (ops) ops.ops.push(
      { k: "tcell-copy|" + A.doc().voices[vi]!.name + "|" + sid,
        word: t("bar.copy"), aria: t("act.copy"),
        act: () => { CLIP = { sec: sid, voice: A.doc().voices[vi]!.name }; draw(); } },
      { k: "tcell-paste|" + A.doc().voices[vi]!.name + "|" + sid,
        word: t("bar.paste"), aria: t("act.paste"),
        why: CLIP ? null : t("bar.paste.none"),
        act: () => pasteInto(i, vi) });
    return f;
  };

  /** EVERY OP BUTTON IN A SHEET GOES THROUGH THE UNDO STACK. The op itself is
   *  untouched — model.ts hands over the door it always had — and this is the
   *  one place the snapshot is taken, so "every op is undoable" is a property
   *  of the wrapper and not of fourteen call sites. */
  function wrapOps(fields: Field[]): Field[] {
    for (const f of fields) {
      if ((f as { kind?: string }).kind !== "ops") continue;
      const o = f as { kind: "ops"; ops: Op[] };
      o.ops = o.ops.map((x) => x.act
        ? { ...x, act: () => op(x.word, x.act!) } : x);
    }
    /* ...AND SO DOES EVERY FIELD WRITE AND EVERY CLEAR-BACK, which is what
       makes Ctrl-Z take back a chip and not only a structural op. */
    for (const f of fields) {
      const s = f as { set?: (v: string) => void; clear?: (() => void) | null;
                       label?: string };
      if (s.set) { const set = s.set;
        s.set = (v) => op(s.label || t("op.change"), () => set(v)); }
      if (s.clear) { const cl = s.clear;
        s.clear = () => op(t("op.clearing", { name: s.label || "" }), cl); }
    }
    return fields;
  }

  /* ---- selection, ranges, fills and the keyboard ---------------------- */

  /** SELECT, AND ONLY SELECT (§11's first law). A tap on a cell that is not
   *  already the selection puts the ring on it, points the formula bar's head
   *  at it, and SHUTS whatever editor was open on the cell you just left — the
   *  spreadsheet gesture exactly. Nothing is written and no vocabulary is
   *  drawn: the cost of looking at a cell is now one ring. */
  function select(sid: string, name: string): void {
    SEL = { sec: sid, voice: name };
    ANCHOR = null;
    if (OPEN && OPEN.indexOf("cell|") === 0) {
      OPEN = null; SHEETKEY = null; SHEETFIELDS = null;
    }
    OPENFIELD = null;
    draw();
    const b = host.querySelector('[data-k="tcell|' + name + "|" + sid + '"]');
    if (b instanceof HTMLElement) b.focus({ preventScroll: true });
  }

  /** EDIT THE SELECTED CELL — the second tap, Enter, F2 and any printable key
   *  all arrive here. The control pops up IN the cell's own row: `sheet.ts
   *  pickerFor` is still the one owner of WHICH widget a vocabulary gets
   *  (chips ≤ 8, the native picker on a coarse pointer, the typed combo on a
   *  fine one), and the accordion under the row is where it is drawn, which is
   *  this page's standing law about menus (they insert below and never scroll
   *  inside themselves). §11a's typed editor is a LATER round; this one only
   *  changes WHAT the first tap opens. */
  function editSel(): void {
    if (!SEL) return;
    OPEN = "cell|" + SEL.sec + "|" + SEL.voice;
    OPENFIELD = null; SHEETKEY = null; SHEETFIELDS = null;
    draw();
    const first = host.querySelector(".nu-vsheet .nu-wcell");
    if (first instanceof HTMLElement) first.focus({ preventScroll: true });
  }

  /** ESCAPE RESTORES: the editor closes, nothing is written, and the ring —
   *  and the focus — go back to the cell you were standing on. */
  function closeEdit(): void {
    OPEN = null; OPENFIELD = null; SHEETKEY = null; SHEETFIELDS = null;
    draw();
    if (!SEL) return;
    const b = host.querySelector('[data-k="tcell|' + SEL.voice + "|" + SEL.sec + '"]');
    if (b instanceof HTMLElement) b.focus({ preventScroll: true });
  }

  function toggle(key: string, keepOpen = false): void {
    /* PRESSING A RECORD SCOPE OPENS THE PANEL IT IS IN (2026-09-06, §14), and
       this line is HERE and not only at the top of `bandTable` because of what
       `draw()` is: an internal re-render that does NOT re-run this component's
       constructor. MEASURED the hour the panel landed, by
       `test/rules-view.browser.js`: `__eightRow("rules")` pressed `trules` by
       name, `toggle` set `OPEN` to `sp|rules`, the head came back
       `aria-expanded="true"` — and `RECOPEN` was still false, so the row was
       `hidden` and its sheet was never drawn. A state that says it is open and
       does not arrive is this repo's characteristic bug; the two owners of
       "is the panel showing" are now the same statement, said in the one
       place every open goes through.
       IT DOES NOT CLOSE ON THE WAY OUT: shutting TIME is not a claim about
       leaving the record — the panel closes by its own head. */
    if (RECORD_KEY(key)) RECOPEN = true;
    /* OPENING A SPECIAL ROW LETS THE PAGE'S LANDING GO — see `leaveLanding`
       in api.ts for the measurement. Only on the way OPEN: shutting TIME is
       not a claim about where you are standing. */
    if (SPECIAL(key) && (OPEN !== key || keepOpen)) {
      try { A.leaveLanding(); } catch (e) { /* an older host */ }
    }
    if (key.indexOf("cell|") === 0) {
      const p = key.split("|");
      SEL = { sec: p[1]!, voice: p[2]! };
    }
    OPEN = (OPEN === key && !keepOpen) ? null : key;
    OPENFIELD = null;
    if (SHEETKEY !== OPEN) { SHEETKEY = null; SHEETFIELDS = null; }
    draw();
  }

  /** THE RANGE, AND IT IS ALWAYS A RECTANGLE — the shape a fill can honestly
   *  be applied to, and the only one a spreadsheet has ever offered. */
  function rangeCells(S: Shape): { sid: string; name: string }[] {
    const at = S.at();
    if (!at || !SEL) return [];
    if (!ANCHOR) return [{ sid: SEL.sec, name: SEL.voice }];
    const si = S.secs.findIndex((x) => x.id === SEL!.sec);
    const ai = S.secs.findIndex((x) => x.id === ANCHOR!.sec);
    const sv = S.voices.findIndex((x) => x.name === SEL!.voice);
    const av = S.voices.findIndex((x) => x.name === ANCHOR!.voice);
    if (si < 0 || ai < 0 || sv < 0 || av < 0) return [{ sid: SEL.sec, name: SEL.voice }];
    const out: { sid: string; name: string }[] = [];
    for (let a = Math.min(si, ai); a <= Math.max(si, ai); a++)
      for (let b = Math.min(sv, av); b <= Math.max(sv, av); b++)
        out.push({ sid: S.secs[a]!.id, name: S.voices[b]!.name });
    return out;
  }
  function rangeHas(S: Shape, sid: string, name: string): boolean {
    if (!ANCHOR) return false;
    return rangeCells(S).some((c) => c.sid === sid && c.name === name);
  }

  /** PASTE IS ONE DOCUMENT WRITE PER TARGET CELL AND NOT ONE PER FIELD.
   *  `A.copyCellTo` is ui/eight.js's own `copyCell` with a named destination —
   *  the same three maps, the same `normalize(); changed()` — so a paste lands
   *  at the next bar exactly like the fill it is a special case of. */
  function pasteInto(i: number, vi: number): void {
    if (!CLIP) return;
    const doc = A.doc();
    const fi = doc.form.sections.findIndex((s) => s.id === CLIP!.sec);
    const fv = doc.voices.findIndex((v) => v.name === CLIP!.voice);
    if (fi < 0 || fv < 0) return;
    op(t("bar.paste"), () => A.copyCellTo(fi, fv, i, vi));
  }
  function pasteHere(S: Shape): void {
    const at = S.at();
    if (at) pasteInto(at.i, at.vi);
  }

  function moveSel(S: Shape, dr: number, dc: number, extend: boolean): void {
    const at = S.at();
    if (!at) {
      const s0 = S.secs[0], v0 = S.voices[0];
      if (s0 && v0) SEL = { sec: s0.id, voice: v0.name };
      ANCHOR = null; draw(); return;
    }
    /* DOWN IS DOWN WHICHEVER WAY THE TABLE FACES. The transpose swaps the axes,
       so an arrow means "the next row on the screen" and the record's two
       indices are worked out from that — a hand should not have to remember
       which way round the table is to press Down. */
    const rowsAre = S.across ? S.voices.length : S.secs.length;
    const colsAre = S.across ? S.secs.length : S.voices.length;
    let r = S.across ? S.voices.findIndex((x) => x.name === SEL!.voice)
                     : S.secs.findIndex((x) => x.id === SEL!.sec);
    let c = S.across ? S.secs.findIndex((x) => x.id === SEL!.sec)
                     : S.voices.findIndex((x) => x.name === SEL!.voice);
    r = Math.max(0, Math.min(rowsAre - 1, r + dr));
    c = Math.max(0, Math.min(colsAre - 1, c + dc));
    const next: Sel = S.across
      ? { sec: S.secs[c]!.id, voice: S.voices[r]!.name }
      : { sec: S.secs[r]!.id, voice: S.voices[c]!.name };
    if (extend) { if (!ANCHOR) ANCHOR = { ...SEL! }; }
    else ANCHOR = null;
    SEL = next;
    /* AN ARROW AND A TAB COMMIT AND MOVE (§11). The bar's HEAD follows the
       selection — that is what a formula bar is — but the EDITOR does not:
       moving off a cell closes the control that was open on it, exactly as
       leaving a cell in a spreadsheet ends the edit. (It used to re-point the
       open sheet at the new cell, which meant an eighteen-field accordion
       unfolding under every arrow press; §11's first law is that looking at a
       cell costs a ring and nothing else.) */
    if (OPEN && OPEN.indexOf("cell|") === 0) {
      OPEN = null; SHEETKEY = null; SHEETFIELDS = null;
    }
    OPENFIELD = null;
    draw();
    const b = host.querySelector('[data-k="tcell|' + SEL.voice + "|" + SEL.sec + '"]');
    if (b instanceof HTMLElement) b.focus({ preventScroll: false });
  }

  function fill(S: Shape, way: "row" | "col"): void {
    const at = S.at();
    if (!at) return;
    op(way === "row" ? t("op.fillRow") : t("op.fillCol"),
       () => A.copyCell(at.i, at.vi, way));
  }

  /* ---- THE KEYBOARD, AND IT IS A SPREADSHEET'S -----------------------
     Paul: *"I want the table to just re-use spreadsheet dynamics since users
     know them."* Arrows and Tab move; Shift extends; Enter and F2 edit in
     place; Escape cancels; Delete clears back to inherit; Ctrl/Cmd-C and -V
     move a vector; Ctrl/Cmd-D fills down and Ctrl/Cmd-R fills right (both are
     the browser's own shortcuts and both are prevented, which is what every
     web spreadsheet does with them); Ctrl/Cmd-Z and Shift-Z are the document
     stack. Nothing here is the only way to reach anything: every one of them
     is a button in the sheet or on the bar, which is 6's law. */
  function onKey(e: KeyboardEvent, S: Shape): void {
    const meta = e.ctrlKey || e.metaKey;
    const tg = e.target as HTMLElement | null;
    const tag = tg?.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    /* A SPECIAL ROW'S SHEET IS NOT A CELL, SO THE SPREADSHEET'S KEYBOARD LETS
       IT ALONE (§10b: *"Tab moves through its chips"*). Inside the grid, Tab
       moves the SELECTION — that is what a spreadsheet's Tab does — and inside
       a merged row full of chips it is what a hand expects Tab to do least.
       Escape is the exception, because it is how the row closes, and it is
       handled by the switch below either way. */
    const inSpecial = !!tg && (!!tg.closest(".nu-sprow") ||
      !!tg.closest(".nu-mixrow") || !!tg.closest(".nu-masterrow") ||
      !!tg.closest(".nu-prodrow") ||
      (SPECIAL(OPEN) && !!tg.closest(".nu-wopen")));
    if (inSpecial && e.key !== "Escape") return;
    if (meta && (e.key === "z" || e.key === "Z")) {
      e.preventDefault(); if (e.shiftKey) U.redo(); else U.undo(); return; }
    if (meta && (e.key === "y" || e.key === "Y")) { e.preventDefault(); U.redo(); return; }
    if (meta && (e.key === "c" || e.key === "C")) {
      if (!SEL) return; e.preventDefault(); CLIP = { ...SEL }; draw(); return; }
    if (meta && (e.key === "v" || e.key === "V")) {
      e.preventDefault(); pasteHere(S); return; }
    if (meta && (e.key === "d" || e.key === "D")) {
      e.preventDefault(); fill(S, "col"); return; }
    if (meta && (e.key === "r" || e.key === "R")) {
      e.preventDefault(); fill(S, "row"); return; }
    if (meta) return;
    switch (e.key) {
      case "ArrowUp":    e.preventDefault(); moveSel(S, -1, 0, e.shiftKey); return;
      case "ArrowDown":  e.preventDefault(); moveSel(S, 1, 0, e.shiftKey); return;
      case "ArrowLeft":  e.preventDefault(); moveSel(S, 0, -1, e.shiftKey); return;
      case "ArrowRight": e.preventDefault(); moveSel(S, 0, 1, e.shiftKey); return;
      case "Tab":
        if (!SEL) return;
        e.preventDefault(); moveSel(S, 0, e.shiftKey ? -1 : 1, false); return;
      /* ENTER AND F2 EDIT; ENTER AGAIN COMMITS AND STAYS. Every write on this
         page lands the moment a chip is tapped — there is no pending buffer to
         commit — so "commit and stay" is: the editor shuts, the ring does not
         move, and the focus goes back to the cell. */
      case "Enter": case "F2": {
        if (!SEL) return;
        e.preventDefault();
        if (OPEN === "cell|" + SEL.sec + "|" + SEL.voice) { closeEdit(); return; }
        editSel();
        return; }
      case "Escape":
        if (OPENFIELD) { OPENFIELD = null; draw(); e.stopPropagation(); return; }
        /* ESCAPE RESTORES — the editor closes and the selection survives it. */
        if (OPEN && OPEN.indexOf("cell|") === 0) {
          closeEdit(); e.stopPropagation(); return; }
        if (OPEN) { OPEN = null; SHEETKEY = null; SHEETFIELDS = null;
                    draw(); e.stopPropagation(); return; }
        if (ANCHOR) { ANCHOR = null; draw(); e.stopPropagation(); return; }
        return;
      case "Delete": case "Backspace": {
        const at = S.at();
        if (!at) return;
        e.preventDefault();
        /* DELETE IS CLEAR-TO-INHERIT, WHICH IS 2's OWN SENTENCE — "deleting a
           written value returns the cell to what it inherits" — and over a
           range it is that op once per cell inside one snapshot, so Ctrl-Z
           takes the whole rectangle back. */
        const cells = rangeCells(S);
        op(cells.length > 1 ? tn("op.clearCells", cells.length)
                            : t("op.clearingCell"),
           () => { for (const c of cells) {
             const i = A.doc().form.sections.findIndex((s) => s.id === c.sid);
             const vi = A.doc().voices.findIndex((v) => v.name === c.name);
             if (i >= 0 && vi >= 0) A.clearCell(i, vi); } });
        return; }
      /* A PRINTABLE KEY EDITS, which is the gesture every spreadsheet user
         already has in their hands: you do not reach for a menu, you start
         typing. What it opens today is the cell's own control (§11a's typed
         editor, where the letters would go on to FILTER the vocabulary, is a
         later round and this is the door it will be built behind). */
      default:
        if (!SEL) return;
        if (e.altKey || e.key.length !== 1) return;
        if (OPEN === "cell|" + SEL.sec + "|" + SEL.voice) return;
        e.preventDefault(); editSel(); return;
    }
  }

  /* ---- A TAP OUTSIDE CLOSES IT, AND ONLY A TAP OUTSIDE -----------------
     Paul, 2026-09-05: *"Don't dismiss things when I tap them to change values;
     dismiss them when I tap outside of them."* The first half is `STICKY`
     above (a sheet now survives the rebuild its own write causes); this is the
     second, and it is deliberately NARROW.

     WHAT COUNTS AS OUTSIDE: a press that lands on nothing you could press.
     Not another BUTTON, not a menu, not an input — because every control in
     this table already decides for itself what happens to the open sheet (a
     cell tap selects, which closes; a head tap toggles; a chip writes and
     stays), and a document-level closer racing them would shut the sheet on
     the way DOWN and reopen it on the way UP, which is a flicker and a lost
     tap. So this fires on the page's own chrome and background only, which is
     exactly the gesture the sentence describes.

     ONE LISTENER FOR THE LIFE OF THE PAGE. `bandTable` runs again on every
     write; the old handler is removed before the new one is added, so the
     count is one whatever the panel does (`OUT` is module-level for `RO`'s own
     reason). */
  function armOutside(): void {
    if (OUT) document.removeEventListener("pointerdown", OUT, true);
    OUT = (e: Event) => {
      if (!OPEN) return;
      const t = e.target as HTMLElement | null;
      if (!t || !t.closest) return;
      if (t.closest(".nu-wopen")) return;              // inside the sheet
      if (t.closest("button, a, input, select, textarea, [role=slider], label"))
        return;                                        // a control decides for itself
      if (!host.isConnected) return;
      OPEN = null; OPENFIELD = null; SHEETKEY = null; SHEETFIELDS = null;
      draw();
    };
    document.addEventListener("pointerdown", OUT, true);
  }

  /* ---- draw, then hand the host what it has always been handed -------- */
  draw();

  const table = host.querySelector("table.nu-wordgrid") as HTMLTableElement;
  const paneEl = host.querySelector(".nu-pane") as HTMLElement;
  const rowHeads = new Map<string, { th: HTMLElement; btn: HTMLElement;
                                     live: HTMLElement | null }>();
  const colHeads = new Map<string, { th: HTMLElement; btn: HTMLElement }>();
  const reindex = () => {
    rowHeads.clear(); colHeads.clear();
    for (const th of Array.from(table.querySelectorAll("tbody th.nu-srowh"))) {
      const tr = th.closest("tr") as HTMLElement | null;
      const btn = th.querySelector("button") as HTMLElement | null;
      if (!tr || !btn) continue;
      const id = tr.dataset.row || "";
      const across = A.facing() === "voices";
      rowHeads.set(across ? id : id,
        { th: th as HTMLElement, btn,
          live: th.querySelector('[data-live="count"]') as HTMLElement | null });
    }
    for (const th of Array.from(table.querySelectorAll("thead th.nu-colhead"))) {
      const btn = th.querySelector("button") as HTMLElement | null;
      if (!btn) continue;
      colHeads.set((btn as HTMLElement).dataset.k || "",
                   { th: th as HTMLElement, btn });
    }
  };
  reindex();
  armResize(paneEl);
  armOutside();

  /* WHO IS SOUNDING, DRIVEN BY THE CALLER FROM ITS EXISTING "pos" PATH. This
     component installs no clock and subscribes to nothing — "a view never
     installs its own rAF/clock; it reads the position feed". */
  let litRow: string | null = null, litCols = "";
  const paint = (nowRowId: string | null, soundingColIds?: string[]) => {
    if (nowRowId !== litRow) {
      litRow = nowRowId;
      for (const tr of Array.from(table.querySelectorAll("tbody tr[data-row]")))
        tr.classList.toggle("now", (tr as HTMLElement).dataset.row === nowRowId);
    }
    const want = new Set(soundingColIds || []);
    const sig = [...want].sort().join(",");
    if (sig === litCols) return;
    litCols = sig;
    for (const [id, h] of colHeads) h.th.classList.toggle("is-sounding", want.has(id));
  };

  return {
    table, pane: paneEl, rowHeads, colHeads, paint,
    close: () => { OPEN = null; OPENFIELD = null;
                   SHEETKEY = null; SHEETFIELDS = null; draw(); },
    openCorner: () => { toggle("corner"); },
    /* A LANDING ONLY LANDS (2026-09-05). `tablePanel` ends every rebuild by
       opening the head an arrival asked for — the gutter's, the atlas's, a
       link's — and it did it by CLICKING, which is a TOGGLE. That was safe
       while a rebuild closed everything; the moment a sheet survives its own
       write (Paul: *"Don't dismiss things when I tap them to change values"*)
       the landing click began CLOSING the sheet it was meant to land on, once
       per write, and `toggle` clears the open field on its way past — measured
       as "the sheet is open and its strip of words is not". This is the same
       door with the other half of `toggle`'s own signature: `keepOpen`, which
       opens and never closes. §9d says the same sentence about the corner,
       which is the one door that must still forget. */
    land: (key: string) => { toggle(key, true); },
    /* THE WRITE IS `A.pointCell`, WHICH IS avail.js's OWN `material.cell`
       SHEET — not `putCell`. That sheet is the one owner of which cells a
       voice of this kind may read (a drum cell is lanes, a line cell is
       degrees: document.js:230), of the absent detent, and of the write; the
       cell sheet's `motifs` row asks the same question through the same door,
       so the bank and the sheet can never point a cell two different ways. */
    pointMotif: (name: string): boolean => {
      const doc = A.doc();
      if (SEL) {
        const i = doc.form.sections.findIndex((x) => x.id === SEL!.sec);
        const vi = doc.voices.findIndex((x) => x.name === SEL!.voice);
        if (i >= 0 && vi >= 0) { ARM = null; A.pointCell(i, vi, name); return true; }
      }
      ARM = name;
      return false;
    },
    armedMotif: () => ARM,
  };
}

export { rowOps, colOps, cellOps, tableOps };
