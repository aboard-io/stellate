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
         perfCells, tableOps, playerOffers, sectionOffer,
         rowOps, colOps, cellOps } from "./model.js";
import { sheetBody, onRedraw } from "./sheet.js";
import { SPECIALS, PRODUCE, mixSheet, masterFace,
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
 *  that was using it. `sp|` is TIME and RULES (a tempo, a meter word, a rule);
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
 *  MOTIFS, PRODUCE, the mix row's board). Two of `STICKY`'s three callers were
 *  never asking about survival at all: one lets the page's landing go when a
 *  merged row opens, and one hands the keyboard to a merged row's chips
 *  instead of to the spreadsheet. Both still mean a merged row and neither
 *  means "any open door", which is what `STICKY` means since the tap-outside
 *  ruling. Splitting them is the whole of that change's blast radius. */
const SPECIAL = (k: string | null): boolean => !!k &&
  (k.indexOf("sp|") === 0 || k.indexOf("mix|") === 0);

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
    const rows = Array.from(t.querySelectorAll<HTMLElement>("thead > tr"));
    const cells = rows.map((tr) => Array.from(tr.children) as HTMLElement[]);
    for (const cs of cells) for (const c of cs) c.style.insetBlockStart = "";
    const tRect = (t as HTMLElement).getBoundingClientRect();
    const base = pane2
      ? tRect.top - pane2.getBoundingClientRect().top + pane2.scrollTop : 0;
    const tops = rows.map((tr) =>
      base + (tr.getBoundingClientRect().top - tRect.top));
    rows.forEach((_tr, i) => {
      for (const c of cells[i]!) c.style.insetBlockStart = tops[i]! + "px";
    });
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

  /* THE WRAPPER IS WHAT LETS THE BAR GO TO THE BOTTOM ON A PHONE. §9a: "the
     formula bar is the bottom sheet". A sticky box only sticks inside a flow it
     is a child of, and `order` only reorders a flex child — so the bar and the
     pane are the two children of one column flex, and at ≤480px the bar takes
     `order: 2` and `inset-block-end: 0` and rides the foot of the screen while
     the grid scrolls behind it. Above that it is `order: 0` at the top, which
     is where a formula bar has always been. Measured on the rendered page
     before this wrapper: `order` on a child of a non-flex host did nothing at
     all and the bar stayed at the top at 320 — a rule that reads right and
     moves nothing, drawn by the wave whose own gate is supposed to catch it. */
  const view = (): TemplateResult => {
    const S = shapeOf(A);
    return html`<div class="nu-sheetwrap">${formulaHead(S)}${pane(S)}</div>`;
  };

  /* ---- THE FORMULA BAR'S HEAD ---------------------------------------- */
  const formulaHead = (S: Shape): TemplateResult => {
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
    return html`<div class="nu-formula" role="group"
        aria-label=${t("bar.selection")}>
      <span class="nu-fadr" data-k="taddr" aria-live="polite">${shown}</span>
      ${firstGroup(S)}
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

  /* ---- THE BAR MIRRORS THE SELECTED CELL'S FIRST GROUP ---------------
     DESIGN.md §2 component 5: *"Formula bar — address · the selected cell's
     vector as chips/values · undo · redo · copy · paste"*, and §11c gives the
     word "vector" a shape at last: a cell's vector is FOUR GROUPS now (Phrase
     · Variation · Dynamics · Placement) and the first of them is what a
     spreadsheet's bar holds — what this cell PLAYS. Eighteen fields on one
     line would be the wall the groups were invented to break.

     IT IS A READOUT AND NOT A SECOND CONTROL, and that is the one-owner law
     rather than an economy: every one of these fields already has exactly one
     control, in the sheet under the cell, at the address T7 walks. A tappable
     copy up here would be two controls on one address — the shape
     test/selects.js's own guard fails a page for, and the shape §11b deleted
     four knob rows to avoid. So the bar SAYS and the sheet WRITES.
     A cell whose sheet has no groups (a bass, whose phrase is told rather than
     asked) prints nothing here rather than an empty strip. */
  const firstGroup = (S: Shape): TemplateResult | typeof nothing => {
    const at = S.at();
    if (!at) return nothing;
    let fields: Field[] = [];
    try { fields = cellSheet(A, at.i, at.vi); } catch (e) { return nothing; }
    const groupOf = (f: Field): string | null =>
      (f as { group?: string | null }).group || null;
    const first = fields.find((f) => !!groupOf(f));
    const head = first ? groupOf(first) : null;
    if (!head) return nothing;
    const mine = fields.filter((f) => groupOf(f) === head &&
      (f as { kind?: string }).kind !== "ops" &&
      (f as { kind?: string }).kind !== "node");
    if (!mine.length) return nothing;
    return html`<div class="nu-fvec" data-k="tvec" role="group"
        aria-label=${t("group." + head)}>
      <b class="nu-fvechead">${t("group." + head)}</b>
      ${mine.map((f) => {
        const w = (f as { word?: string | null }).word;
        const word = w == null || w === "" ? "\u2014" : String(w);
        const derived = !!(f as { derived?: boolean }).derived;
        return html`<span class=${classMap({ "nu-fvecpair": true,
                                             "is-derived": derived })}
          aria-label=${t("sheet.field", { name: (f as { label: string }).label,
                                          value: word })}
          ><small>${(f as { label: string }).label}</small
          ><b>${word}</b></span>`; })}
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
     and the sheet under it at the top of the body. */
  const specialRows = (S: Shape): TemplateResult[] => SPECIALS.map((sp) => {
    const openKey = "sp|" + sp.id;
    const open = OPEN === openKey;
    let face = "";
    try { face = sp.face(A); } catch (e) { face = ""; }
    return html`<tr class="nu-sprow" data-special=${sp.id}>
      <th class="nu-spheadcell" scope="row" colspan=${nCols(S)}>
        <button type="button" class="nu-sphead" data-k=${sp.k}
          aria-expanded=${String(open)}
          aria-label=${sp.aria}
          @click=${() => toggle(openKey)}
          @contextmenu=${(e: Event) => { e.preventDefault(); toggle(openKey, true); }}
          ><b class="nu-spword">${sp.word}</b
          ><span class="nu-spface">${face}</span></button>${spLamp(sp)}
      </th>
    </tr>`;
  });

  const thead = (S: Shape, cols: string[]): TemplateResult => html`<thead>
    ${specialRows(S)}
    <tr>
      <th class="nu-cornerh">${cornerBtn(S)}</th>
      ${repeat(cols, (c) => c, (c) => S.across ? secHead(S, c) : voiceHead(S, c))}
      <th class="nu-addhead" scope="col">
        <div class="nu-addbar">${(S.across ? sectionOffer(A) : playerOffers(A))
          .map((o) => addBtn(o))}</div>
      </th>
    </tr>
  </thead>`;

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
        }<b class="nu-colname">${name}</b>${
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
        }<b class="nu-colname">${A.roleWord(s.role)}</b
        ><span class="nu-colinstr">${tn("count.bar", s.bars)}</span>${
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

  const addBtn = (o: Op) => html`<button type="button" class="nu-addbtn"
    data-k=${o.k} ?disabled=${!!o.why}
    aria-disabled=${ifDefined(o.why ? "true" : undefined)}
    data-why=${ifDefined(o.why || undefined)}
    title=${ifDefined(o.why || undefined)}
    aria-label=${o.why ? t("sheet.refused",
                           { name: o.aria || o.word, why: o.why })
                       : (o.aria || o.word)}
    @click=${() => { if (o.why || !o.act) return; op(o.word, o.act); }}
    >${o.word}</button>`;

  /* ---- THE BODY ------------------------------------------------------ */
  const tbody = (S: Shape, rows: string[], cols: string[]): TemplateResult =>
    html`<tbody>
      ${orphanSheet(S)}
      ${repeat(rows, (r) => r, (r) => bodyRow(S, r, cols))}
      <tr class="nu-addrow">
        <th class="nu-addhead" scope="row">
          <div class="nu-addbar">${(S.across ? playerOffers(A) : sectionOffer(A))
            .map((o) => addBtn(o))}</div>
        </th>
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
    /* A SPECIAL ROW'S SHEET IS AN ORPHAN TOO, and for the same reason the
       column head's is: its row is in the `<thead>`, which freezes, and a
       frozen sheet is a sheet that covers the grid it is editing. */
    for (const sp of SPECIALS)
      if (OPEN === "sp|" + sp.id)
        return openRow(S, sheetFor(OPEN, () => wrapOps(sp.sheet(A))), sp.word);
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
                      section: S.across ? c : rid }))
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
  const secRowHead = (sid: string) => {
    const i = A.doc().form.sections.findIndex((s) => s.id === sid);
    const s = A.doc().form.sections[i]!;
    const rm = A.rowMark(i);
    return html`<th class="nu-srowh" scope="row">
      <button type="button" class="nu-rowjump" data-k=${"trow|" + sid}
        aria-expanded=${String(OPEN === "row|" + sid)}
        aria-label=${tn("head.section", s.bars, { name: A.secName(i) })}
        @click=${() => toggle("row|" + sid)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("row|" + sid, true); }}
        data-say=${ifDefined(rm && rm.s ? rm.s : undefined)}
        ><span class="nu-g" aria-hidden="true">${rm ? rm.g : ""}</span
        ><span data-live="count"><span>${i + 1}</span></span
        ><span class="nu-srowname"> ${A.roleWord(s.role)}</span>${
        rm ? html`<span class="nu-vh">${rm.w}</span>` : nothing}</button>
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
   *  AND THE FIRST TAP OPENS NOTHING BUT THE RING. A spreadsheet's first tap
   *  SELECTS; the second one edits. Before this round one tap did both — it
   *  selected the cell AND unfolded the whole eighteen-field accordion under
   *  the row, measured at 15 sheet rows for a hand that only wanted to see
   *  where it was standing. Now: tap once to stand on it (the formula bar
   *  names it), tap the SAME cell again — or press Enter, F2, or any printable
   *  key — to edit. `is-sel` is the state the second tap reads, so the two taps
   *  are the same button and neither is a mode. */
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
          /* FIRST TAP SELECTS ONLY; THE SECOND EDITS (§11). */
          if (!sel) { select(sid, name); return; }
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
  const tfoot = (S: Shape, cols: string[]): TemplateResult => html`<tfoot>
    ${mixRow(S, cols)}
    ${produceRow(S)}
    ${footRow(S, "perf", "tfoot|perf", t("special.perf.word"),
              t("axis.performance"),
              perfCells(A), () => perfSheet(A))}
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
    const master = "mix|master";
    const face = masterFace(A);
    return html`<tr class="nu-footrow nu-mixrow" data-row="mix">
      <th class="nu-srowh" scope="row"><span class="nu-srowname">${
        t("special.mix.word")}</span></th>
      ${repeat(cols, (c) => c, (c) => mixCell(c))}
      <td class="nu-addcell"></td>
    </tr>
    <tr class="nu-footrow nu-masterrow" data-row="master">
      <th class="nu-spheadcell" scope="row" colspan=${nCols(S)}>
        <button type="button" class="nu-sphead" data-k="tmix"
          aria-expanded=${String(OPEN === master)}
          aria-label=${t("special.master.aria", { face })}
          @click=${() => toggle(master)}
          @contextmenu=${(e: Event) => { e.preventDefault(); toggle(master, true); }}
          ><b class="nu-spword">${t("special.master.word")}</b
          ><span class="nu-spface">${face}</span></button>
      </th>
    </tr>
    ${OPEN === master
      ? openRow(S, sheetFor(master, () => wrapOps(masterMixSheet(A))),
                t("special.master.word"))
      : nothing}
    ${cols.map((c) => OPEN === "mix|" + c
      ? openRow(S, sheetFor(OPEN!, () => wrapOps(mixSheet(A, c))), c)
      : nothing)}`;
  };

  /* ---- THE PRODUCE ROW (§10b step 5) ---------------------------------
     §10a: *"│ MIX │ strip │ strip │ master │ / │ PRODUCE │ the producer's
     deals and notes │ (merged, expandable)"*. It is the same merged row the
     master is, one line under it, wearing the same `.nu-sphead` so its face
     ellipsises against the pane's own left-pinned width and reads whole at
     320. It is drawn HERE and not in `SPECIALS` because `SPECIALS` is the
     HEAD's list: a row above the column heads is a row above the music, and
     the producer speaks about a record that has already been dealt. */
  const produceRow = (S: Shape): TemplateResult => {
    const openKey = "sp|" + PRODUCE.id;
    let face = "";
    try { face = PRODUCE.face(A); } catch (e) { face = ""; }
    return html`<tr class="nu-footrow nu-prodrow" data-row="produce">
      <th class="nu-spheadcell" scope="row" colspan=${nCols(S)}>
        <button type="button" class="nu-sphead" data-k=${PRODUCE.k}
          aria-expanded=${String(OPEN === openKey)}
          aria-label=${PRODUCE.aria}
          @click=${() => toggle(openKey)}
          @contextmenu=${(e: Event) => { e.preventDefault(); toggle(openKey, true); }}
          ><b class="nu-spword">${PRODUCE.word}</b
          ><span class="nu-spface">${face}</span></button>
      </th>
    </tr>
    ${OPEN === openKey
      ? openRow(S, sheetFor(openKey, () => wrapOps(PRODUCE.sheet(A))), PRODUCE.word)
      : nothing}`;
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

  const footRow = (S: Shape, id: string, k: string, word: string, aria: string,
                   cells: Field[], sheet: () => Field[]): TemplateResult => {
    const openKey = "foot|" + id;
    return html`<tr class="nu-footrow" data-row=${id}>
      <th class="nu-srowh" scope="row">
        <button type="button" class="nu-rowjump" data-k=${k}
          aria-expanded=${String(OPEN === openKey)} aria-label=${aria}
          @click=${() => toggle(openKey)}
          ><span class="nu-srowname">${word}</span></button>
      </th>
      <td colspan=${nCols(S) - 1}>
        <div class="nu-footcells">${cells.map((c) => html`<div
          class="nu-footcell">${footCell(c)}</div>`)}</div>
      </td>
    </tr>
    ${OPEN === openKey ? openRow(S, sheetFor(openKey, sheet), openKey) : nothing}`;
  };

  /** A FOOTER CELL IS THE SAME RECORD A BODY CELL IS — the same plain word, the
   *  same dim-is-derived reading (§11: no plate, at rest) — but it asks a
   *  question of the RECORD, and the
   *  record has no voices, so it is not one of the columns overhead. It opens
   *  its strip in the row's own sheet rather than a second accordion. */
  const footCell = (c: Field): TemplateResult => {
    const f = c as { key?: string; label?: string; word?: string | null;
                     derived?: boolean };
    if (!f.key) return html`<span class="nu-sgsay">${f.word ?? "—"}</span>`;
    return html`<button type="button"
      class=${classMap({ "nu-wcell": true, "nu-cellword": true,
                         "is-derived": !!f.derived })}
      data-k=${f.key}
      aria-label=${t("sheet.field", { name: f.label || f.key,
                                      value: f.word ?? "—" })}
      @click=${() => { /* (`String(f.key).indexOf("tmaster|") === 0 ? "foot|
           master" : …` STOOD HERE. The footer had two rows of cells and this
           told them apart; it has one, because the master's seven cells are
           the MIX row's corner sheet since 2026-09-07.) */
        const row = "foot|perf";
        if (SHEETKEY !== row) { SHEETKEY = null; SHEETFIELDS = null; }
        OPEN = row; OPENFIELD = f.key!; draw(); }}
      >${f.label ?? f.word ?? "—"}</button>`;
  };

  /* ---- THE OPEN ROW, WHICH IS THE FORMULA BAR'S BODY ------------------ */
  const openRow = (S: Shape, fields: Field[], name: string): TemplateResult =>
    html`<tr class="nu-wopen"><td colspan=${nCols(S)}>${
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
