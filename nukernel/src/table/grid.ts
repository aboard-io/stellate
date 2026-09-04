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
import type { TableAPI, Field, Op } from "./api.js";
import { rowSheet, colSheet, cellSheet, perfSheet,
         perfCells, tableOps, playerOffers, sectionOffer,
         rowOps, colOps, cellOps } from "./model.js";
import { sheetBody, onRedraw } from "./sheet.js";
import { SPECIALS, PRODUCE, mixSheet, masterFace,
         masterMixSheet } from "./special.js";
import { undoStack } from "./undo.js";
import type { DocUndo } from "./undo.js";

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
const STICKY = (k: string | null): boolean => !!k &&
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
    let y = 0;
    for (const tr of Array.from(t.querySelectorAll<HTMLElement>("thead > tr"))) {
      for (const c of Array.from(tr.children))
        (c as HTMLElement).style.insetBlockStart = y + "px";
      y += tr.getBoundingClientRect().height;
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
      ? A.secName(at.i) + " × " + (doc.voices[at.vi]?.name || "")
      : "no cell selected";
    const rangeN = rangeCells(S).length;
    return html`<div class="nu-formula" role="group" aria-label="the selection">
      <span class="nu-fadr" data-k="taddr"
        aria-live="polite">${addr}${rangeN > 1 ? " · " + rangeN + " cells" : ""}</span>
      <div class="nu-fops">
        ${barBtn("tundo", "↶ undo", U.undoWord, U.canUndo,
                 "nothing has been done here to take back", () => { U.undo(); })}
        ${barBtn("tredo", "↷ redo", U.redoWord, U.canRedo,
                 "nothing has been taken back to put forward", () => { U.redo(); })}
        ${barBtn("tcopy", "copy", "copy this cell's vector", !!at,
                 "no cell is selected — tap one first",
                 () => { if (!SEL) return; CLIP = { ...SEL }; draw(); })}
        ${barBtn("tpaste", "paste", "paste the copied vector here", !!at && !!CLIP,
                 !at ? "no cell is selected — tap one first"
                     : "nothing has been copied yet",
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
      aria-label=${on ? aria : aria + ", " + why}
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
          aria-label=${sp.word + " — " + sp.aria}
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
    aria-label="the whole record — fill it from a genre, re-seed it, or turn the table round"
    @click=${() => toggle("corner")}
    @contextmenu=${(e: Event) => { e.preventDefault(); toggle("corner", true); }}
    >${S.across ? "player" : "section"}</button>`;

  /** A PLAYER'S HEAD. The lamp is a SIBLING of the button inside the `<th>` and
   *  never a child of it: `[data-live]` is a surface the clock may write, and a
   *  control inside one is the shape test/motif-frozen A1 forbids (T8e counts
   *  it through `closest("th")`). */
  const voiceHead = (S: Shape, name: string): TemplateResult => {
    const v = A.doc().voices.find((x) => x.name === name)!;
    const vi = A.doc().voices.indexOf(v);
    const sub = A.playsWhat(v) || "";
    return html`<th class="nu-colhead" data-vi=${String(A.vpaintOf(vi) ?? "")}
        scope="col">
      <button type="button" class="nu-colbtn nu-vpaint" data-k=${"tcol|" + name}
        aria-expanded=${String(OPEN === "col|" + name)}
        aria-label=${name + " — " + (sub || "no instrument") + " — open this player's vector"}
        title=${name + (sub ? " — " + sub : "")}
        @click=${() => toggle("col|" + name)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("col|" + name, true); }}
        ><b class="nu-colname">${name}</b>${
        sub ? html`<span class="nu-colinstr">${sub}</span>` : nothing}</button>
      ${lamp(name)}
      ${grip(name, "tcol|" + name, name)}
    </th>`;
  };

  const secHead = (S: Shape, sid: string): TemplateResult => {
    const i = A.doc().form.sections.findIndex((s) => s.id === sid);
    const s = A.doc().form.sections[i]!;
    return html`<th class="nu-colhead" scope="col">
      <button type="button" class="nu-colbtn" data-k=${"tcol|" + sid}
        aria-expanded=${String(OPEN === "row|" + sid)}
        aria-label=${A.secName(i) + " — open this section's vector"}
        @click=${() => toggle("row|" + sid)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("row|" + sid, true); }}
        ><b class="nu-colname">${A.roleWord(s.role)}</b
        ><span class="nu-colinstr">${s.bars} bars</span></button>
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
    aria-label=${"resize the " + name + " column — drag, or the arrow keys"}
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
    aria-label=${(o.aria || o.word) + (o.why ? ", " + o.why : "")}
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
        label: "this record",
        ops: tableOps(A, S.across).map((x) => x.act
          ? { ...x, act: () => op(x.word, x.act!) } : x) }]), "the whole record");
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
        ? openRow(S, sheetFor(key, () => cellSheetOf(S, rid, c)), key)
        : nothing; })}`;
  };

  const secRowHead = (sid: string) => {
    const i = A.doc().form.sections.findIndex((s) => s.id === sid);
    const s = A.doc().form.sections[i]!;
    return html`<th class="nu-srowh" scope="row">
      <button type="button" class="nu-rowjump" data-k=${"trow|" + sid}
        aria-expanded=${String(OPEN === "row|" + sid)}
        aria-label=${A.secName(i) + ", " + s.bars + " bars — open this section's vector"}
        @click=${() => toggle("row|" + sid)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("row|" + sid, true); }}
        ><span data-live="count"><span>${i + 1}</span></span
        ><span class="nu-srowname"> ${A.roleWord(s.role)}</span></button>
      <small> ${s.bars} bars</small>
    </th>`;
  };

  const voiceRowHead = (name: string) => {
    const doc = A.doc();
    const v = doc.voices.find((x) => x.name === name)!;
    return html`<th class="nu-srowh" scope="row">
      <button type="button" class="nu-rowjump" data-k=${"trow|" + name}
        aria-expanded=${String(OPEN === "col|" + name)}
        aria-label=${name + " — open this player's vector"}
        @click=${() => toggle("col|" + name)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle("col|" + name, true); }}
        ><span class="nu-srowname">${name}</span></button>
      <small> ${A.playsWhat(v) || ""}</small>
    </th>`;
  };

  /** ONE CELL. What it prints without being opened is what this voice PLAYS
   *  here; DIM means nothing has been written in this cell — 2's "the table
   *  draws only deviations", which is what makes eighty cells readable. */
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
    const hand = A.written(i, vi);
    const sel = !!SEL && SEL.sec === sid && SEL.voice === name;
    const inRange = rangeHas(S, sid, name);
    return html`<td class=${classMap({ "is-inrange": inRange })}>
      <button type="button"
        class=${classMap({ "nu-wcell": true, "nu-trimbtn": true,
                           "is-derived": !hand, "is-sel": sel })}
        data-k=${key}
        aria-expanded=${String(OPEN === openKey)}
        aria-selected=${String(sel)}
        aria-label=${name + " · " + A.secName(i) + ": " + word}
        @click=${(e: MouseEvent) => {
          if (e.shiftKey && SEL) { ANCHOR = { sec: sid, voice: name }; draw(); return; }
          /* AN ARMED BANK SPENDS ITSELF ON THE NEXT CELL (§10b step 4). The
             tap still SELECTS — a spreadsheet's tap always does — and the
             motif lands on the cell it selected, which is what a hand that
             tapped a name and then a cell asked for in that order. */
          if (ARM) { const m = ARM; ARM = null;
                     SEL = { sec: sid, voice: name }; ANCHOR = null;
                     A.pointCell(i, vi, m); return; }
          ANCHOR = null; toggle(openKey); }}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle(openKey, true); }}
        >${word}</button>
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
    ${footRow(S, "perf", "tfoot|perf", "performance",
              "how the band plays it — the record's own performance",
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
      <th class="nu-srowh" scope="row"><span class="nu-srowname">mix</span></th>
      ${repeat(cols, (c) => c, (c) => mixCell(c))}
      <td class="nu-addcell"></td>
    </tr>
    <tr class="nu-footrow nu-masterrow" data-row="master">
      <th class="nu-spheadcell" scope="row" colspan=${nCols(S)}>
        <button type="button" class="nu-sphead" data-k="tmix"
          aria-expanded=${String(OPEN === master)}
          aria-label=${"the master — " + face +
            " — and the buses every strip feeds"}
          @click=${() => toggle(master)}
          @contextmenu=${(e: Event) => { e.preventDefault(); toggle(master, true); }}
          ><b class="nu-spword">master</b
          ><span class="nu-spface">${face}</span></button>
      </th>
    </tr>
    ${OPEN === master
      ? openRow(S, sheetFor(master, () => wrapOps(masterMixSheet(A))), "master")
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
          aria-label=${PRODUCE.word + " — " + PRODUCE.aria}
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
    return html`<td class="nu-mixcell">
      <button type="button"
        class=${classMap({ "nu-wcell": true, "nu-trimbtn": true,
                           "is-derived": !A.mixWritten(name) })}
        data-k=${"tmix|" + name}
        aria-expanded=${String(OPEN === openKey)}
        aria-label=${name + " — its seat on the desk: " + word}
        @click=${() => toggle(openKey)}
        @contextmenu=${(e: Event) => { e.preventDefault(); toggle(openKey, true); }}
        >${word}</button>
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

  /** A FOOTER CELL IS THE SAME RECORD A BODY CELL IS — the same plate, the same
   *  dim-is-derived reading — but it asks a question of the RECORD, and the
   *  record has no voices, so it is not one of the columns overhead. It opens
   *  its strip in the row's own sheet rather than a second accordion. */
  const footCell = (c: Field): TemplateResult => {
    const f = c as { key?: string; label?: string; word?: string | null;
                     derived?: boolean };
    if (!f.key) return html`<span class="nu-sgsay">${f.word ?? "—"}</span>`;
    return html`<button type="button"
      class=${classMap({ "nu-wcell": true, "nu-trimbtn": true,
                         "is-derived": !!f.derived })}
      data-k=${f.key}
      aria-label=${(f.label || f.key) + ": " + (f.word ?? "—")}
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
      { k: "tcell-copy|" + A.doc().voices[vi]!.name + "|" + sid, word: "copy",
        aria: "copy this cell's vector",
        act: () => { CLIP = { sec: sid, voice: A.doc().voices[vi]!.name }; draw(); } },
      { k: "tcell-paste|" + A.doc().voices[vi]!.name + "|" + sid, word: "paste",
        aria: "paste the copied vector here",
        why: CLIP ? null : "nothing has been copied",
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
      if (s.set) { const set = s.set; s.set = (v) => op(s.label || "the change", () => set(v)); }
      if (s.clear) { const cl = s.clear; s.clear = () => op("clearing " + (s.label || ""), cl); }
    }
    return fields;
  }

  /* ---- selection, ranges, fills and the keyboard ---------------------- */

  function toggle(key: string, keepOpen = false): void {
    /* OPENING A SPECIAL ROW LETS THE PAGE'S LANDING GO — see `leaveLanding`
       in api.ts for the measurement. Only on the way OPEN: shutting TIME is
       not a claim about where you are standing. */
    if (STICKY(key) && (OPEN !== key || keepOpen)) {
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
    op("paste", () => A.copyCellTo(fi, fv, i, vi));
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
    /* THE BAR FOLLOWS THE SELECTION. That is what a formula bar is: the sheet
       moves with the cell rather than a hand having to re-open it. */
    if (OPEN && OPEN.indexOf("cell|") === 0) {
      OPEN = "cell|" + SEL.sec + "|" + SEL.voice;
      SHEETKEY = null; SHEETFIELDS = null;
    }
    OPENFIELD = null;
    draw();
    const b = host.querySelector('[data-k="tcell|' + SEL.voice + "|" + SEL.sec + '"]');
    if (b instanceof HTMLElement) b.focus({ preventScroll: false });
  }

  function fill(S: Shape, way: "row" | "col"): void {
    const at = S.at();
    if (!at) return;
    op(way === "row" ? "fill across the row" : "fill down the column",
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
      (STICKY(OPEN) && !!tg.closest(".nu-wopen")));
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
      case "Enter": case "F2": {
        if (!SEL) return;
        e.preventDefault();
        OPEN = "cell|" + SEL.sec + "|" + SEL.voice; OPENFIELD = null;
        SHEETKEY = null; SHEETFIELDS = null; draw();
        const first = host.querySelector(".nu-vsheet .nu-wcell");
        if (first instanceof HTMLElement) first.focus({ preventScroll: true });
        return; }
      case "Escape":
        if (OPENFIELD) { OPENFIELD = null; draw(); e.stopPropagation(); return; }
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
        op(cells.length > 1 ? "clearing " + cells.length + " cells" : "clearing the cell",
           () => { for (const c of cells) {
             const i = A.doc().form.sections.findIndex((s) => s.id === c.sid);
             const vi = A.doc().voices.findIndex((v) => v.name === c.name);
             if (i >= 0 && vi >= 0) A.clearCell(i, vi); } });
        return; }
      default: return;
    }
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
