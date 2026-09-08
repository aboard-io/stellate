// nukernel/src/table/sheet.ts — THE FORMULA BAR, WHICH IS A VECTOR MADE OF CHIPS.
//
// TABLE.md 9a: *"Tap a cell -> it is SELECTED (one selection, its address
// shown), and its vector appears in the FORMULA BAR above the grid as editable
// chips. Double-tap or Enter edits in place; Escape cancels; Delete clears back
// to inherit."*
//
// ===== WHERE THE FORMULA BAR IS, AND WHY IT IS A CARD (2026-09-08) =====
// Paul: *"Instead of expanding sections in the editor and inserting them below
// the selected point just make them modals with easy dismissal."* TABLE.md §22.
//
// A spreadsheet's formula bar is a strip above the grid because a spreadsheet's
// cell is one value. A cell here is a VECTOR of up to eighteen fields, and that
// diagnosis has not changed — what changed is the answer.
//
// WHAT THIS FILE SAID UNTIL 2026-09-08, kept because a gate and a stylesheet
// still carry its vocabulary: "this page has two standing laws about where that
// many words may go: · MENUS NEVER SCROLL INSIDE THEMSELVES (nukernel design
// language, 2026-08-16: 'Don't make me scroll INSIDE a popup, vertical space is
// cheap and abundant') — so the bar opens to its full height and pushes the
// page down; · CELL MENUS INSERT BELOW THE ROW (accordion, one open), never a
// floating popup that covers the column you are editing. So the bar's BODY is a
// `<tr class="nu-wopen">` under the selected row."
//
// THE SECOND LAW IS REVERSED AND THE FIRST IS BENT, ON ONE MEASUREMENT: the
// eighteen-field vector opened a row 779.4px tall on an 844px phone. "Pushes
// the page down" meant "puts the record off the screen", and "vertical space is
// cheap and abundant" is a claim about a scrolling DOCUMENT, not about a phone.
// The body is a `.nu-modalcard` now — one card, one open, dismissed by its ×,
// by Escape, by a press on the scrim — and it is the one scroller in the
// arrangement, so the grid behind it holds still instead of being shoved.
// WHAT IS UNCHANGED IS EVERYTHING THIS FILE ACTUALLY BUILDS. `sheetBody` emits
// the same `.nu-vsheet` with the same rows, the same pickers, the same
// `data-k`s and the same one-owner rule about which widget a vocabulary gets;
// grid.ts `openSheet` is the only line that moved. The HEAD is `cellHead` (the
// ADDRESS of the selection, undo/redo, copy/paste) and it is the card's first
// line. Head and body are one control — the head names the cell, the body is
// its vector — and no field is drawn twice.
//
// ===== ONE OWNER FOR WHICH WIDGET A VOCABULARY GETS ====================
// TABLE.md 9b: *"Dropdowns: the native picker on touch, the typed combo on
// desktop with a keyboard, chips for a vocabulary of <= 8 words."* Paul,
// 2026-09-05: *"In general dropdowns barely work."*
//
// THE OWNER IS `src/menus/pick.ts` AND IT IS THE WHOLE PAGE'S, 2026-09-06. It
// was written here first, and the four rules it was written as are that file's
// four rules now, argued there and measured there. `pickerFor` below is what is
// left: the one clause that is about the GRID rather than about a vocabulary —
// a field carrying the CALLER'S own control is SEATED and never re-drawn — plus
// `strip: true`, the named flag that keeps a cell row's 9-to-24-word strip a
// strip on a desktop (test/table.browser.js T9's chip walk drives it).

import { html, nothing } from "lit/html.js";
import type { TemplateResult } from "lit/html.js";
import { classMap } from "lit/directives/class-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import type { Field, StripField, TextField, Choice } from "./api.js";
import { pickerFor as pick } from "../menus/pick.js";
import { t, fmt } from "../copy/global.js";

export type Picker = "combo" | "chips" | "native" | "slider" | "lozenge"
                   | "spinner" | "motifs";

/* THE RULE IS NOT THIS FILE'S ANY MORE, 2026-09-06. It was written here first
   and it was right here first — chips <= 8, the native picker on a coarse
   pointer, TABLE.md 9b — while `ui/selects.js` was answering COMBO to every
   vocabulary at every size on every pointer, which is what Paul was holding
   when he said *"In general dropdowns barely work."* So the rule moved UP to
   `src/menus/pick.ts`, where the page's own menus read it too, and this file
   asks it the same question every other caller does. What stays here is the
   one clause that is about the GRID and not about a vocabulary: a field
   carrying the CALLER'S OWN control is seated, never re-drawn. */
export { coarse } from "../menus/pick.js";

/* THE LOZENGE FIELD IS READ OFF `globalThis` (2026-09-05, DESIGN.md component
   16), for `../copy/global.js`'s own reason: `src/lozenge` is its own build
   entry and importing it here would compile a second copy of the widget into
   ui/table.js. `index.html` loads ui/lozenge.js; this reads the one that
   shipped. */
interface LozDoor {
  lozengeField(spec: {
    key: string; label: string;
    options: { value: string; label: string; why?: string | null;
               disabled?: boolean; quiet?: boolean; cluster?: string | null }[];
    clusters?: { word: string; vals: string[] }[] | null;
    value?: string | null; why?: string | null; k?: string | null;
    /** A CHAIN, IN ORDER (2026-09-06, TABLE.md §15). The component has had
     *  `multi`/`ordered`/`values`/`onToggle` since it was written; this is the
     *  first caller that says them. */
    values?: string[] | null; multi?: boolean; ordered?: boolean;
    onWrite?: ((v: string) => void) | null;
    onToggle?: ((v: string, on: boolean, order: string[]) => void) | null;
  }): HTMLElement;
}
const LOZ = (): LozDoor | null =>
  (globalThis as unknown as { NuLozenge?: LozDoor }).NuLozenge || null;

/* (`offerLozenge` STOOD HERE — the ADD sheet's body as a lozenge field, for
   one afternoon. 2026-09-05, TABLE.md §13e, Paul: *"Don't pop up an interface
   when I add a section or a voice. Just add it."* With the sheet deleted the
   offers have no field to be drawn in: each `+` IS its offer, and `grid.ts
   plusBtn` runs the op on the tap. `LOZ` above stays — `pickerFor` asks it
   for every vocabulary past the chip limit.) */

/** DOES THIS FIELD KNOW WHAT KIND EACH OF ITS WORDS IS? Two ways, and both are
 *  data the caller already had: the drummer's `groups` (model.ts `groupsFor`,
 *  the kernel's own six) or a `g` on the options themselves (avail.js's
 *  `group`, carried through `wCell` since 2026-09-05). Two DIFFERENT kinds are
 *  required — one heading over a whole list is a heading that says nothing. */
function clustersOf(f: StripField): { word: string; vals: string[] }[] | null {
  if (f.groups && f.groups.length > 1) return f.groups;
  const by = new Map<string, string[]>();
  for (const o of f.options || []) {
    const g = o.g && String(o.g).trim();
    if (!g) continue;
    const v = String(o.v == null ? "" : o.v);
    if (!by.has(g)) by.set(g, []);
    by.get(g)!.push(v);
  }
  if (by.size < 2) return null;
  return [...by].map(([word, vals]) => ({ word, vals }));
}

export function pickerFor(f: StripField): Picker {
  /* 0 · A CHAIN CAN ONLY BE SAID BY THE ONE WIDGET THAT DRAWS ONE
   *     (2026-09-06, TABLE.md §15). A `<select>` cannot hold an ordered set,
   *     and a chip strip has no place to print the position, so a `multi`
   *     field is a lozenge field wherever the component is on the page. With
   *     no `NuLozenge` at all it falls through and is drawn single, which is
   *     the shape it had before this round rather than a broken control. */
  /* 0a · A FIELD WHOSE OPTIONS CARRY PICTURES IS A MOTIF FIELD (2026-09-08,
   *      TABLE.md §24). Paul: *"The motif selector should be visual and let me
   *      see motifs and make new motifs and assign multiple motifs and click
   *      to edit motifs."*
   *      IT WAS FALLING THROUGH TO THE NATIVE WHEEL, and every rule below was
   *      right to send it there: a coarse pointer with more than eight words
   *      earns the phone's own picker (rule 2 of src/menus/pick.ts). The thing
   *      none of them could know is that these options are not WORDS. Every
   *      motif option carries `pv` — an inline `<svg>` of the actual phrase,
   *      one bar per step, height by velocity (ui/preview.js) — built so that
   *      *"two motifs in a list are told apart by SHAPE before either name is
   *      read"*. A `<select>` can hold no picture at all, so the one control
   *      the page has for telling motifs apart was drawing them as a list of
   *      names, and the standing answer as `—`.
   *      THE TEST IS THE PICTURE AND NOT THE NAME `motifs`. A field is a motif
   *      field when its options actually carry previews — which is a fact
   *      about the data, true of the cell sheet's `material.cell` row wherever
   *      it is drawn, and false of a row that merely happens to be called
   *      something. */
  if ((f.options || []).some((o) => (o as { pv?: unknown }).pv)) return "motifs";
  if (f.multi && LOZ()) return "lozenge";
  // 1 · A CALLER'S OWN WIDGET WINS. `model.ts` hands the long vocabularies a
  //     built control (`A.combo`, which is `ui/menus.js` `menuEl` — so on a
  //     coarse pointer that control is ALREADY the native picker, and this
  //     branch is "seat it", not "draw a combo").
  if (f.node) return "combo";
  /* 2 · A CONTINUOUS NUMBER IS A SLIDER (2026-09-05). Paul: *"When you
   *     redesign think sliders and other UI for data entry."* Before the field
   *     carries `num` this asked how many WORDS it had, and a register — eight
   *     integers from −4 to 3 — earned eight chips: eight buttons for one
   *     quantity, and the shape of the answer (a line you slide along) thrown
   *     away. Words keep the chips. */
  if (f.num) return "slider";
  /* 2b · A STATE OF A FEW POSITIONS IS A SPINNER (2026-09-07, TABLE.md §19).
   *      `src/menus/pick.ts` owns the rule (at most `SPINMAX` positions) and
   *      `src/table/model.ts` owns the list of rows that ARE states — a row
   *      says `cycle` or it does not, and this asks. It stands above the
   *      lozenge and the chip rules because it is their exception: four words
   *      the row holds one of are one control, not four. */
  if (f.cycle) {
    const p = pick((f.options || []).length, { cycle: true });
    if (p === "spinner") return p;
  }
  /* 3 · A WALL OF WORDS THAT KNOWS ITS OWN KINDS IS A LOZENGE FIELD
   *     (2026-09-05, DESIGN.md component 16 · TABLE.md §11d). Paul: *"tight
   *     lozenges, organized by color and clustered semantically… visibility
   *     into all of the options"*. MEASURED at 390 on the drummer's does-sheet
   *     before this line: ONE of sixty-eight words on the glass, because a
   *     coarse pointer earned the native wheel and a strip of 68 chips was a
   *     wall either way. `pick.ts` owns the sentence; this asks it. */
  if (LOZ() && clustersOf(f)) return "lozenge";
  //     `strip: true` — a cell sheet's row is inside a spreadsheet; see
  //     `PickOpts.strip` for the measurement that keeps it chips to 24.
  return pick((f.options || []).length, { strip: true });
}

/* ===== A REFUSAL IS SAID OUT LOUD (2026-09-06, TABLE.md §15) ============
   THE COMPLAINT, VERBATIM (the Coach House walkthrough, friction 7): *"`filled
   in` on a pad is disabled with the sentence 'a pad voices the chord, it does
   not follow a line' — shown to no one. I tapped it eight times."* And the
   verdict beside it: *"The app has a beautiful explanation and shows it to
   nobody."*

   THE LAW `src/lozenge/field.ts` LAW 6 STATES, NOW FOR EVERY WIDGET ON A
   SHEET. A refused control is `aria-disabled` and NOT `disabled` — a
   `disabled` button takes no click, so its reason is reachable only through a
   screen reader, which is the silent grey wearing an accessible name — and a
   TAP ON IT PRINTS ITS REASON and writes nothing.

   ONE OWNER FOR THE SENTENCE AND ONE PLACE PER WIDGET. The sentence is the
   `why` the field or the option already carries (avail.js / gates.js measured
   it; nothing here derives a second one), and it is printed into the widget's
   own say line — `.nu-wsay` here, `.nu-lzsay` inside a lozenge field, which is
   the same idea in the component that owns it. The memory is keyed by the
   FIELD'S ADDRESS for `GROUPOPEN`'s own reason: every write on this table ends
   in `changed() -> draw()`, so a sentence held in a local would be gone the
   moment it was said.

   THE ONE WIDGET THAT CANNOT TAKE A TAP is the NATIVE `<select>`: the browser
   owns its wheel and a `<option disabled>` is a real refusal it enforces. So
   that widget answers the law the way `src/menus/index.ts` already answers it
   — the reason is APPENDED TO THE OPTION'S OWN WORDS through the same
   `menu.withWhy` key — and the sentence is on the glass in the wheel itself. */
const SAID = new Map<string, string>();
function say(key: string, why: string | null | undefined): void {
  const w = why == null ? "" : String(why).trim();
  if (!w) return;
  if (SAID.get(key) === w) return;
  SAID.set(key, w);
  if (REDRAW) REDRAW();
}
/** ...and a WRITE clears it: the reason a control gave for refusing is about
 *  the answer it refused, and it is stale the moment a different one lands. */
function unsay(key: string): void {
  if (SAID.delete(key) && REDRAW) REDRAW();
}
/** the ONE line, drawn wherever a widget can refuse. It reserves its room
 *  whether or not there is a sentence, for `.nu-lzsay`'s own reason: a
 *  sentence arriving under a thumb must not move the thing the thumb is on. */
function sayLine(key: string): TemplateResult {
  const w = SAID.get(key) || "";
  return html`<p class="nu-wsay" role="status" aria-live="polite"
    data-k=${"say|" + key} ?data-said=${!!w}>${w}</p>`;
}

const wordOf = (f: { word?: string | null }) =>
  (f.word == null || f.word === "" ? "—" : String(f.word));

/* ONE OWNER PER FACT (DESIGN.md §3), AND THE CAPTION WAS SAYING THE VALUE'S
   WORD BACK TO IT. A field with nothing written carries `sub: "Default"` — the
   caption that says WHERE the value came from — and a field with nothing
   written and nothing inherited prints `t("value.default")` as its VALUE, so
   the cell sheet's octave row rendered `OCTAVE  default  default`: a label, a
   value and a readout, three inks for one fact, measured at 390 on Kingston
   1969. The caption is drawn only where it says something the value does not;
   where they agree the quiet weight (`is-derived`) is already the whole
   sentence. Compared case-folded, because `value.defaultCap` is `value.default`
   with a capital. It is done HERE and not at the five field builders because a
   caption is a property of the FIELD and this is the one place it is drawn. */
const subOf = (f: { word?: string | null; sub?: string | null }):
    string | null => {
  const s = f.sub == null ? "" : String(f.sub).trim();
  if (!s) return null;
  return s.toLowerCase() === wordOf(f).trim().toLowerCase() ? null : s;
};

/* WHAT A SCREEN READER HEARS AFTER A VALUE NOBODY WROTE. DESIGN.md §3 says
   blank = default and bold = written, which is exactly the distinction a
   screen reader cannot see — so the WORD is added there and nowhere else,
   and it is core.ts's one word rather than this file's (", inherited" /
   ", written here" stood here, which is the same idea said two more ways). */
const valueAria = (value: string, derived: boolean): string =>
  derived ? t("value.defaultAria", { value }) : value;

/** a chip's accessible name: its word, the reason it is refused if it is, and
 *  where the value came from if the caller said so. One key per whole
 *  sentence, never a name with fragments bolted onto it. */
function chipAria(word: string, why: string | null,
                  prov: string | null): string {
  if (why && prov) return t("sheet.chip.whyProv", { name: word, why, prov });
  if (why) return t("sheet.refused", { name: word, why });
  if (prov) return t("sheet.chip.prov", { name: word, prov });
  return word;
}

/* ---- THE STRIP OF WORDS, WHICH IS THE WHOLE OF THE INSTITUTION --------
   Lifted from ui/wordgrid.js unchanged in every way a gate can see: the same
   `.nu-wchip`, the same `data-k = "<field>|<value>"`, the same `aria-pressed`,
   the same refusal spelling (`off` is REFUSED, `quiet` is INERT — conflating
   them greys the inert words, which that file shipped for an hour), and the
   same close-then-write order. */
export function chipStrip(f: StripField,
                          onWrite: (v: string) => void): TemplateResult {
  const cur = f.value == null ? "" : String(f.value);
  const chip = (o: Choice) => {
    const v = String(o.v == null ? "" : o.v);
    const w = o.w == null ? v : String(o.w);
    const cellWhy = f.why || null;
    const hard = !!cellWhy;
    const off = !hard && !!o.off && v !== cur;
    const why = hard ? cellWhy : (off ? (o.why || "") : (o.why || null));
    /* `aria-disabled` AND NOT `disabled` (2026-09-06, §15): a refused chip has
       to take the tap that asks it why. It is skipped by the keyboard's own
       walk for the same reason a refused lozenge is — a word you may not
       choose is not a stop on the way to one. */
    return html`<button type="button"
      class=${classMap({ "nu-wchip": true, "is-quiet": !!o.quiet })}
      data-k=${f.key + "|" + v}
      data-v=${v}
      aria-pressed=${String(v === cur)}
      tabindex=${hard || off ? "-1" : "0"}
      aria-disabled=${ifDefined(hard || off ? "true" : undefined)}
      data-why=${ifDefined(why == null ? undefined : why)}
      aria-label=${chipAria(w, hard ? cellWhy : (off ? (o.why || null) : null),
                            o.prov || null)}
      @click=${() => { if (hard || off) { say(f.key, why); return; }
                       unsay(f.key); onWrite(v); }}
      >${o.pv ? o.pv : nothing}<span class="nu-chipword">${w}</span
      >${o.prov ? html`<small class="nu-chipprov">${o.prov}</small>` : nothing}</button> `;
  };
  const all = f.options || [];
  /* THE SAY LINE IS INSIDE THE WIDGET, which is `.nu-lzsay` inside
     `.nu-lzfield` said again here: a sentence about a strip belongs to the
     strip, so anything reading "the control the field drew" reads its refusal
     with it. `.nu-wchips` is a wrapping flex row and `.nu-wsay` carries
     `flex: 1 0 100%`, so it is a line of its own under the words. */
  /* ONE OF A SET LOOKS LIKE ONE OF A SET (2026-09-07, TABLE.md §19). Paul:
     *"Each exclusive of each other."* Every strip this surface draws is
     single-select — a chain goes to the lozenge field, which says the same
     fact on its own host — so the flag is `!f.multi` and not a new field, and
     nu.css draws an exclusive strip as one JOINED rail with one segment
     filled rather than as a line of independent buttons. `aria-pressed` and
     every address are untouched: this is a look, said in data so a gate can
     read it. */
  const rail = { "nu-wchips": true, "is-exclusive": !f.multi };
  if (!f.groups || !f.groups.length)
    return html`<div class=${classMap(rail)} role="group"
      data-exclusive=${String(!f.multi)}
      aria-label=${f.label}>${all.map(chip)}${sayLine(f.key)}</div>`;
  /* ---- ONE GROUP OPEN AT A TIME ------------------------------------
     TABLE.md 6, of the drummer's sixty-eight: *"the does-array sheet groups
     the ops by what they act on … one group open at a time, the active ops
     pinned at the top."* Sixty-eight chips in one strip is a wall. The PIN is
     the standing answer, always drawn whichever group is open, because "you
     can always see the word you are on" is this page's oldest rule.
     A PINNED CHIP IS NOT ALSO IN THE STRIP. ui/wordgrid.js MOVED the node; a
     template that drew it twice would put two elements on one `data-k`, and
     `chipsOf` reads every `.nu-wchip` under the pane.
     THE HIDING IS `display`, NOT `[hidden]`. `.nu-wchip` carries
     `display: inline-flex`, which beats the browser's own `[hidden]` — T5f
     reads the RECT and not the attribute, and says so. */
  const want = groupWords(f, cur);
  const isPin = (o: Choice) => { const v = String(o.v == null ? "" : o.v);
    return v === cur || v === ""; };
  return html`<div class="nu-wgroups">
    <div class="nu-groupbar" role="group" aria-label=${t("sheet.groups.aria")}>
      ${f.groups.map((g) => html`<button type="button" class="nu-groupbtn"
        data-g=${g.word} data-k=${f.key + "|group|" + g.word}
        aria-pressed=${String(g.word === want)}
        @click=${() => { GROUPOPEN.set(f.key, g.word === want ? "" : g.word);
          if (REDRAW) REDRAW(); }}>${g.word}</button> `)}
    </div>
    <div class="nu-wchips nu-pinned" role="group"
      aria-label=${t("sheet.pinned.aria")}>${all.filter(isPin).map(chip)}</div>
    <div class=${classMap(rail)} role="group" aria-label=${f.label}
      data-exclusive=${String(!f.multi)}>${
      all.filter((o) => !isPin(o)).map((o) => {
        const v = String(o.v == null ? "" : o.v);
        const g = (f.groups || []).find((gg) => gg.vals.includes(v));
        const inGroup = !!want && !!g && g.word === want;
        return html`<span style=${inGroup ? "" : "display:none"}>${chip(o)}</span>`;
      })}</div>
    ${sayLine(f.key)}
  </div>`;
}

/** which group of a grouped strip is open. Module-level for the same reason the
 *  selection is: the panel is rebuilt from scratch on every write. */
const GROUPOPEN = new Map<string, string>();
function groupWords(f: StripField, cur: string): string {
  const saved = GROUPOPEN.get(f.key);
  if (saved != null) return saved;
  const g = (f.groups || []).find((x) => x.vals.includes(cur));
  return (g || (f.groups || [])[0] || { word: "" }).word;
}
/** the group bar redraws its own strip; the host owns the re-render. */
let REDRAW: (() => void) | null = null;
export function onRedraw(fn: () => void): void { REDRAW = fn; }

/* ---- THE SHEET BODY --------------------------------------------------
   One cell-row per field, in the caller's order, which is 1's order. The WORD
   is a `.nu-wcell` — the same plate the grid's own cells wear, so "inherited
   quiet, written bold" is one rule and not two — and tapping it grows its strip
   UNDER ITS OWN ROW. */
/* ---- THE SHEET'S SIDEWAYS POSITION SURVIVES A WRITE (2026-09-07, §19) --
   Every write on this table ends in `changed() -> draw()`, which throws the
   whole sheet away and builds it again — so a track scrolled sideways springs
   back to 0 on the first tap inside it, and the control under the thumb jumps
   across the screen. MEASURED before this existed (T12n at 390): the mode
   picker's own column stood at x=194 before a tap and x=489 after it, a 295px
   jump with nothing about the record changed. It is the same fact
   `src/lozenge/field.ts SCROLLX` keeps one tier down, and it is kept the same
   way: a memory keyed by the track's own address, read off the live element
   BEFORE the write (a `scroll` event arrives a frame late and would remember
   where the track was before the gesture), restored one frame after the
   rebuild.

   THE READING IS ARMED IN THE CAPTURE PHASE, on `click` as well as
   `pointerdown`, because a `click` dispatched by script — which is how every
   gate on this page presses a button — carries no pointer events at all. */
const TRACKX = new Map<string, number>();
let TRACKARMED = false;
function armTracks(): void {
  if (TRACKARMED || typeof document === "undefined" ||
      typeof document.addEventListener !== "function") return;
  TRACKARMED = true;
  const grab = () => {
    try {
      for (const el of Array.from(
          document.querySelectorAll<HTMLElement>(".nu-sheettrack[data-track]")))
        TRACKX.set(String(el.dataset.track), el.scrollLeft);
    } catch (e) { /* nothing on the page: what is remembered stands */ }
  };
  document.addEventListener("pointerdown", grab, true);
  document.addEventListener("click", grab, true);
}
function restoreTracks(): void {
  if (typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => {
    try {
      for (const el of Array.from(
          document.querySelectorAll<HTMLElement>(".nu-sheettrack[data-track]"))) {
        const was = TRACKX.get(String(el.dataset.track));
        if (was != null && el.scrollLeft !== was) el.scrollLeft = was;
      }
    } catch (e) { /* the sheet is gone: nothing to put back */ }
  });
}

export function sheetBody(fields: Field[], name: string,
                          openField: string | null,
                          setOpenField: (k: string | null) => void,
                          after: () => void): TemplateResult {
  const chunks = groupChunks(fields);
  /* ---- THE SHEET IS A TABLE TOO (2026-09-07, TABLE.md §19) -------------
     Paul, of a chair's playing options: *"When I open an instrument gives me
     all these playing options that I can't differentiate and they are spread
     all over the place. Give them the same treatment as the instrument voice
     selector … we need to make it smaller and it can also go horizontally
     wider than the screen."*

     SO A SHEET OF THREE SUBJECTS OR MORE STANDS THEM SIDE BY SIDE — one
     COLUMN per group, one setting per line inside it, the track scrolling on
     its own inline axis. It is the same shape the instrument picker takes one
     tier down, which is what "the same treatment" means, and it is decided
     from the DATA (how many groups the model declared) rather than from a
     flag a caller passes: the chair's four (instrument · envelope · tone ·
     mix), the section's five, the cell's four. A sheet of one or two subjects
     is not spread over anything and keeps the stack it had.

     THE DOCUMENT ORDER DOES NOT MOVE. A run of grouped chunks is WRAPPED in
     the track where it stands; the ops bar, which carries no group, stays
     ahead of it exactly as it was. `querySelectorAll(".nu-sheetrow")` reads
     the same list in the same order it always did, which is the law §11c's
     own group wrappers were written under. */
  const asTable = chunks.filter((c) => c.head != null).length >= 3;
  armTracks();
  const out: unknown[] = [];
  let runN = 0;
  let run: { head: string | null; fields: Field[] }[] = [];
  const flush = () => {
    if (!run.length) return;
    const r = run; run = [];
    /* THE TRACK'S ADDRESS IS THE SHEET'S NAME AND ITS PLACE IN IT — stable
       across the rebuild every write causes, which is the whole point. */
    const tk = name + "|" + (runN++);
    out.push(html`<div class="nu-sheettrack" data-track=${tk}>${
      r.map((c) => groupSection(c, openField, setOpenField, after))}</div>`);
  };
  for (const c of chunks) {
    if (c.head != null && asTable) { run.push(c); continue; }
    flush();
    out.push(c.head == null
      ? c.fields.map((f) => fieldRow(f, openField, setOpenField, after))
      : groupSection(c, openField, setOpenField, after));
  }
  flush();
  if (asTable) restoreTracks();
  return html`<div class=${classMap({ "nu-vsheet": true, "is-table": asTable })}
    data-table=${String(asTable)}
    role="group" aria-label=${name}>${out}</div>`;
}

/* ---- THE MARKS REACH THIS BUNDLE THROUGH `globalThis` -----------------
   Paul, 2026-09-05: *"use more icons. Ideally the table is a large set of
   icons."* A sheet's group heading is the one place on an expanded interface
   where a mark has something to say — the thirteen headings are the whole of
   what a hand scans for — and `ui/glyph.js` is the one owner of every mark on
   this page. It is not IMPORTED here: this is its own build entry and an
   import would compile a thousand lines of marks into ui/table.js, which is
   the drift `../copy/global.js`'s five lines exist to refuse. Same
   arrangement, same reason. A group this table has no picture for prints its
   word alone (`groupMark` answers null rather than a dot that says nothing). */
interface GlyphDoor { groupMark(key: string): string | null }
const glyphDoor = (): GlyphDoor | null =>
  (globalThis as unknown as { NuGlyph?: GlyphDoor }).NuGlyph || null;

function groupSection(c: { head: string | null; fields: Field[] },
                      openField: string | null,
                      setOpenField: (k: string | null) => void,
                      after: () => void): TemplateResult {
  const key = String(c.head);
  const word = t("group." + key);
  const g = glyphDoor();
  const mark = g ? g.groupMark(key) : null;
  /* THE COLUMN HOLDING THE OPEN CONTROL TAKES THE SHEET'S WIDTH (§19). A
     picker opened inside an 18ch column would be a scrollport inside a
     scrollport, which is the one shape this page has refused twice (§11c,
     §15). One thing is open at a time (§18), so exactly one column is ever
     wide, and it is the one a thumb is working in. */
  const open = c.fields.some((f) => {
    const k = (f as { key?: string }).key;
    return !!k && k === openField; });
  return html`<section class=${classMap({ "nu-sheetgroup": true, "is-open": open })}
      data-group=${key}
      role="group" aria-label=${word}>
      <h4 class="nu-grouphead">${mark
        ? html`<span class="nu-g" aria-hidden="true">${mark}</span>` : nothing
        }<span class="nu-groupword">${word}</span></h4>${
      c.fields.map((f) => fieldRow(f, openField, setOpenField, after))}
    </section>`;
}

/* ---- THE GROUPS (2026-09-05, TABLE.md §11c) ---------------------------
   Paul: *"just nicely structure each expanded interface as proper software
   that's easy to scan and nicely grouped."* A sheet was a flat list of up to
   thirty-six rows in the model's own order; it is a handful of GROUPS now,
   each under a short heading, in the composer's order (DESIGN.md §5).

   THE CHUNKING IS CONSECUTIVE AND NOT A SORT, and that is deliberate: the
   caller (`model.ts`) states the order and this file states nothing about it.
   A sort here would be a second opinion about the composer's order, in the
   file that draws rather than in the file that decides — and a field that
   moved between two groups would move on the screen without moving in the
   model that the gates read.
   FIELDS WITH NO GROUP LEAD, UNGROUPED. That is the ops bar: a toolbar is not
   one of the subjects the headings name, and putting it under one would be a
   heading that lied. */
/** the chunks, by KEY. `head` is the group's key (`"phrase"`), never its
 *  printed word — see `model.ts G`'s own paragraph. */
function groupChunks(fields: Field[]): { head: string | null; fields: Field[] }[] {
  const out: { head: string | null; fields: Field[] }[] = [];
  for (const f of fields) {
    const g = (f as { group?: string | null }).group || null;
    const last = out[out.length - 1];
    if (last && last.head === g) last.fields.push(f);
    else out.push({ head: g, fields: [f] });
  }
  return out;
}

/* ---- WHICH SETTINGS ARE COMPOUND (2026-09-07, TABLE.md §19) -----------
   Paul, of the chair's playing options: *"if things have multiple settings to
   make that really clear and shading or a little bit of a fill behind them."*

   A ROW IS COMPOUND WHEN IT CARRIES MORE THAN ONE VALUE, and there are
   exactly two ways that happens on this surface, both of them already in the
   data:

     · A CHAIN — a `multi` field standing on two words or more (TABLE.md §15).
       The count is the chain's own length.
     · A SEATED WIDGET — a `node` row whose control is itself several
       controls: the envelope's four handles, the throat's knob table, the
       crate's files, the channel strip. The count is MEASURED off the node
       the caller built (`[data-k]`, which is what every control on this page
       wears), because a number declared beside it would be a second owner of
       how many controls a widget has, and it would be wrong the first time
       one of them was added.

   A count of one is not compound: a widget with one address is a control, and
   a badge saying "1" is a number nobody can act on — the same sentence the
   lozenge field's own chain number is written under. */
function manyOf(f: Field): number {
  const k = (f as { kind?: string }).kind;
  if (k === "node") {
    const n = (f as Extract<Field, { kind: "node" }>).node;
    if (!n || typeof n.querySelectorAll !== "function") return 0;
    try { const c = n.querySelectorAll("[data-k]").length; return c > 1 ? c : 0; }
    catch (e) { return 0; }
  }
  const sf = f as StripField;
  if (sf.multi && sf.values && sf.values.length > 1) return sf.values.length;
  return 0;
}

/** THE MARK ITSELF: a count in the row, and `is-compound` on the row for the
 *  fill behind it. The number is DATA and not copy (the lozenge field prints
 *  its chain's positions on the same argument); the sentence a screen reader
 *  hears is one catalogue key. */
function manyMark(n: number): TemplateResult | typeof nothing {
  return n > 1 ? html`<small class="nu-many" aria-label=${t("sheet.many", { n })}
    >${n}</small>` : nothing;
}

/* ---- THE SPINNER (2026-09-07, TABLE.md §19 · DESIGN.md component 23) ---
   Paul: *"turn them into spinners for the status changes"*, and *"we need to
   make it smaller"*.

   ONE CONTROL SAYING THE STATE THE ROW IS IN, and two steps beside it. A tap
   on the word steps FORWARD (the gesture a thumb already makes on a value
   plate), `>` steps forward, `<` steps back — which is Paul's *"holding or a
   second control steps back"* answered with the second control rather than
   with the hold, because a long press on a value already means SAY WHY
   everywhere else on this page (§15 / the lozenge's law 3) and one gesture
   may not mean two things.

   IT STEPS OVER A REFUSAL AND NEVER INTO ONE. A refused word is skipped by
   the step and stays reachable the way every refusal is: the whole row
   refused says its sentence and does not move (§15's law for a slider, said
   again for a control that steps). The POSITION is printed — `2/5` — because
   a control that shows one word of five has to say that there are five.

   THE ADDRESS DOES NOT MOVE WHEN THE WIDGET DOES: the field's own `data-k` is
   on the WORD, which is what T7 and `test/table-inventory.json` read, and the
   two steps take `prev|<key>` and `next|<key>` — the same shape `clear|<key>`
   and `num|<key>` already take. */
/* ===== THE MOTIF FIELD: PICTURES, NOT A DROPDOWN (2026-09-08, §24) ======
   Paul: *"The motif selector should be visual and let me see motifs and make
   new motifs and assign multiple motifs and click to edit motifs."*

   FOUR ASKS, AND THIS DRAWS THREE OF THEM. Assigning SEVERAL motifs to one
   cell is a question about the MODEL — whether a cell plays them in sequence
   across its bars or layered at once — and `material.cell` holds one name, so
   it is not a widget change and is not guessed at here. The three that are
   about the glass are built:

     · SEE THEM. Every motif is a card carrying `ui/preview.js`'s own `<svg>`
       — one bar per step of the actual phrase, height by velocity — with its
       name under it and its provenance (`from this genre`, `yours`) under
       that. That picture already existed and had nowhere to be drawn: the
       native wheel this field fell into can hold no markup, so the page's one
       control for telling motifs apart showed a list of names.
     · MAKE ONE. The last card is the `+`, and it does what the bank's own `+`
       does — `A.newMotif()` is `addCell("line")`, the free-name rule included
       — and then ASSIGNS what it made, because a hand that asked for a new
       motif here asked for it for THIS cell.
     · EDIT ONE. Each card carries a ✎ that opens that motif in the bank's own
       editor (`A.editMotif`, which is `openMotifRow`). It is a separate target
       and not a second meaning for the card, because the card's own meaning is
       ASSIGN — a control where one tap sometimes writes and sometimes
       navigates is the thing this page has spent every round deleting.

   THE ABSENT DETENT KEEPS ITS PLACE. The first option is the column's own
   answer (`—`, no motif of this cell's own) and it is a card like the others
   with no picture, because "inherit" is a real choice and hiding it would make
   clear-back the only way to say it. */
function motifRow(sf: StripField, write: (v: string) => void,
                  clearBack: TemplateResult | typeof nothing): TemplateResult {
  const cur = sf.value == null ? "" : String(sf.value);
  const opts = sf.options || [];
  const api = (sf as { api?: { newMotif?(): string | null;
                               editMotif?(n: string): void } }).api;
  const card = (o: Choice) => {
    const v = String(o.v == null ? "" : o.v);
    const on = v === cur;
    const pv = (o as { pv?: Node }).pv;
    const prov = (o as { prov?: string }).prov;
    const why = (o as { off?: boolean; why?: string }).off
      ? ((o as { why?: string }).why || "") : "";
    return html`<div class=${classMap({ "nu-mocard": true, "is-on": on })}>
      <button type="button" class="nu-mopick" data-k=${sf.key + "|" + v}
        aria-pressed=${String(on)}
        aria-disabled=${ifDefined(why ? "true" : undefined)}
        data-why=${ifDefined(why || undefined)}
        aria-label=${why ? t("sheet.refused", { name: String(o.w ?? v), why })
                         : (prov ? t("sheet.chip.prov",
                                     { name: String(o.w ?? v), prov })
                                 : String(o.w ?? v))}
        @click=${() => { if (why) return; write(v); }}
        ><span class="nu-mopv" aria-hidden="true">${pv ? pv : nothing}</span
        ><span class="nu-moname">${o.w == null ? v : o.w}</span
        >${prov ? html`<small class="nu-moprov">${prov}</small>` : nothing}</button>
      ${v && api && api.editMotif
        ? html`<button type="button" class="nu-moedit" data-k=${"motifedit|" + v}
            aria-label=${t("motif.edit", { name: String(o.w ?? v) })}
            @click=${() => api.editMotif!(v)}
            ><span class="nu-g" aria-hidden="true">\u270e</span
            ><span class="nu-vh">${t("motif.edit.word")}</span></button>`
        : nothing}
    </div>`;
  };
  return html`<div class="nu-sheetrow nu-morow">
    <b class="nu-sheetlab">${sf.label}</b>
    <div class="nu-mogrid">
      ${opts.map(card)}
      ${api && api.newMotif
        ? html`<button type="button" class="nu-mocard nu-monew" data-k="motif-new"
            aria-label=${t("motif.new")}
            @click=${() => { const n = api.newMotif!(); if (n) write(n); }}
            ><span class="nu-g" aria-hidden="true">+</span
            ><span class="nu-moname">${t("motif.new.word")}</span></button>`
        : nothing}
    </div>
    ${clearBack}
    ${subOf(sf) ? html`<small class="nu-sheetsub">${subOf(sf)}</small>` : nothing}
  </div>`;
}

function spinRow(sf: StripField, write: (v: string) => void,
                 clearBack: TemplateResult | typeof nothing): TemplateResult {
  const opts = sf.options || [];
  const cur = sf.value == null ? "" : String(sf.value);
  const at = Math.max(0, opts.findIndex((o) => String(o.v == null ? "" : o.v) === cur));
  const step = (d: number) => {
    if (sf.why) { say(sf.key, sf.why); return; }
    for (let i = 1; i <= opts.length; i++) {
      const o = opts[(at + d * i + opts.length * opts.length) % opts.length]!;
      if (o.off) continue;
      unsay(sf.key);
      write(String(o.v == null ? "" : o.v));
      return;
    }
    /* EVERY OTHER WORD IS REFUSED, which is a real answer and not a dead
       button: the reason is the one the field or its words already carry. */
    say(sf.key, sf.why || (opts[at] && opts[at]!.why) || null);
  };
  const refused = !!sf.why;
  const stepBtn = (d: number, cls: string, aria: string) =>
    html`<button type="button" class=${"nu-spinstep " + cls}
      data-k=${(d < 0 ? "prev|" : "next|") + sf.key}
      aria-disabled=${ifDefined(refused ? "true" : undefined)}
      data-why=${ifDefined(sf.why || undefined)}
      aria-label=${aria}
      @click=${() => step(d)}><span class="nu-vh">${aria}</span></button>`;
  return html`<div class="nu-sheetrow nu-spinrow">
    <b class="nu-sheetlab">${sf.label}</b>
    <div class="nu-spin" role="group" aria-label=${sf.label}>
      ${stepBtn(-1, "is-prev", t("sheet.spin.prev", { name: sf.label }))}
      <button type="button"
        class=${classMap({ "nu-wcell": true, "nu-spinword": true,
                           "is-derived": !!sf.derived, "is-refused": refused })}
        data-k=${sf.key}
        aria-disabled=${ifDefined(refused ? "true" : undefined)}
        data-why=${ifDefined(sf.why || undefined)}
        aria-label=${refused
          ? t("sheet.field.refused", { name: sf.label, why: sf.why || "" })
          : t("sheet.field", { name: sf.label,
                               value: valueAria(wordOf(sf), !!sf.derived) })}
        @click=${() => step(1)}>${wordOf(sf)}</button>
      ${stepBtn(1, "is-next", t("sheet.spin.next", { name: sf.label }))}
      <small class="nu-spinpos" aria-hidden="true"
        >${at + 1}/${opts.length}</small>
    </div>
    ${clearBack}
    ${subOf(sf) ? html`<small class="nu-sheetsub">${subOf(sf)}</small>` : nothing}
    ${sayLine(sf.key)}
  </div>`;
}

function fieldRow(f: Field, openField: string | null,
                  setOpenField: (k: string | null) => void,
                  after: () => void): TemplateResult {
  if ((f as { kind?: string }).kind === "ops") {
    const o = f as Extract<Field, { kind: "ops" }>;
    /* AN OP SAYS WHY IT WILL NOT RUN (2026-09-06, §15). `?disabled` swallowed
       the click, so "Already first" and "A song needs one section" — real
       sentences, written and measured — reached nobody with a thumb. The bar
       has ONE say line, addressed by the bar rather than by an op, because a
       toolbar is one control with several verbs. */
    const bark = "ops|" + (o.label || "") + "|" + (o.ops[0] ? o.ops[0].k : "");
    return html`<div class=${classMap({ "nu-sheetrow": true, "nu-sheetops": true,
                                        "is-verbs": !!o.compact })}>
      ${o.label ? html`<b class="nu-sheetlab">${o.label}</b>` : nothing}
      <div class="nu-opbar">${o.ops.map((op) => html`<button type="button"
        class=${classMap({ "nu-opbtn": true, "is-mark": !!op.mark })}
        data-k=${op.k}
        aria-disabled=${ifDefined(op.why ? "true" : undefined)}
        data-why=${ifDefined(op.why || undefined)}
        aria-label=${op.why ? t("sheet.refused",
                                { name: op.aria || op.word, why: op.why })
                            : (op.aria || op.word)}
        @click=${() => { if (op.why) { say(bark, op.why); return; }
          if (!op.act) return; unsay(bark);
          try { op.act(); } catch (e) {} }}>${
        /* ===== AN OP MAY BE A MARK (2026-09-08, TABLE.md §24) ============
           Paul, of the cell card: *"This cell—the basic operations should be
           icons."* An op that carries a `mark` draws the mark and keeps its
           WORD in a `.nu-vh` beside it — which is `paintIcon`'s own shape,
           said in lit rather than by hand, and is why a font that fails on
           somebody's phone still leaves a readable control. An op with no
           `mark` is unchanged: `fill from the genre`, `deal again` and the
           row and column ops are SENTENCES, and a sentence has no honest
           picture. Only the five that are gestures a spreadsheet already has
           a mark for became marks. */
        op.mark
          ? html`<span class="nu-g" aria-hidden="true">${op.mark}</span
                 ><span class="nu-vh">${op.word}</span>`
          : op.word}</button>`)}</div>
      ${sayLine(bark)}
    </div>`;
  }
  if ((f as { kind?: string }).kind === "node") {
    /* A CALLER'S OWN WIDGET GETS THE WHOLE ROW, label above rather than beside:
       the voice's channel strip is 207px of inserts, sends, EQ, pan and a
       fader, and beside an 11ch label at 390 it overflowed (desk-gate G13). */
    const n = f as Extract<Field, { kind: "node" }>;
    /* A SEATED WIDGET IS USUALLY COMPOUND, and now it says so (§19): the
       envelope is four handles, the knob table is a table, the crate is a
       list of files. The count is measured off the node itself — see
       `manyOf` — and the fill is the row's own. */
    const many = manyOf(f);
    return html`<div class=${classMap({ "nu-sheetrow": true, "nu-noderow": true,
                                        "is-compound": many > 1 })}
      data-many=${ifDefined(many > 1 ? String(many) : undefined)}>
      ${n.label ? html`<b class="nu-sheetlab">${n.label}</b>` : nothing}${manyMark(many)}
      ${n.node ? n.node : nothing}
    </div>`;
  }
  if ((f as { kind?: string }).kind === "text")
    return textRow(f as TextField, after);
  if ((f as { kind?: string }).kind === "say" ||
      !(f as StripField).options || !(f as StripField).options!.length) {
    /* A READOUT, AND A REFUSAL IS A READOUT WITH A REASON ON IT. 4's own law:
       a field the engine cannot yet reach says so, never silently. */
    const s = f as StripField & { why?: string | null; sub?: string | null };
    return html`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${s.label}</b>
      <span class=${classMap({ "nu-sheetsay": true, "is-refused": !!s.why })}
        data-why=${ifDefined(s.why || undefined)}
        title=${ifDefined(s.why || undefined)}
        aria-label=${s.why
          ? t("sheet.say.refused", { name: s.label, value: wordOf(s), why: s.why })
          : t("sheet.field", { name: s.label, value: wordOf(s) })}>${wordOf(s)}</span>
      ${subOf(s) ? html`<small class="nu-sheetsub">${subOf(s)}</small>` : nothing}
    </div>`;
  }
  const sf = f as StripField;
  const pick = pickerFor(sf);
  const open = openField === sf.key;
  /* A VALUE TAP DOES NOT DISMISS THE CONTROL (DESIGN.md component 6, and
     Paul's own sentence: *"Don't dismiss things when I tap them to change
     values; dismiss them when I tap outside of them."*). This read
     `setOpenField(null)` first — the close-then-write order lifted from
     ui/wordgrid.js — so a strip of words could be tapped exactly once and then
     had to be re-opened for the second try. The strip stays out; the tap
     outside, Escape, or the field's own head is what closes it. */
  const write = (v: string) => {
    try { if (sf.set) sf.set(v); } catch (e) {} after(); };
  const clearBack = (sf.clear && !sf.derived)
    ? html`<button type="button" class="nu-clearback" data-k=${"clear|" + sf.key}
        aria-label=${t("sheet.clearBack.aria", { name: sf.label })}
        @click=${() => { try { sf.clear!(); } catch (e) {} after(); }}>${
          t("act.clear")}</button>`
    : nothing;
  /* A STATE THE ROW STEPS THROUGH (2026-09-07, §19) — see `spinRow`. */
  if (pick === "spinner") return spinRow(sf, write, clearBack);
  /* THE MOTIFS, AS PICTURES (2026-09-08, §24) — see `motifRow`. */
  if (pick === "motifs") return motifRow(sf, write, clearBack);
  if (pick === "combo")
    /* THE SUB IS DRAWN HERE TOO, 2026-09-06. It was on the `native` branch and
       on the chips branch and not on this one, so a field whose vocabulary is
       long enough to earn a typed combo lost its caption — measured on the TIME
       row: `alphabet.mode` carries `tuningSay`'s "a quarter-tone step" for
       three of its twelve words, and the line simply was not drawn
       (test/tempo-key.browser.js T5a/T5d read it back empty). A caption is a
       property of the FIELD, not of which widget the vocabulary earned. */
    return html`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${sf.label}</b>${sf.node}${clearBack}
      ${subOf(sf) ? html`<small class="nu-sheetsub">${subOf(sf)}</small>` : nothing}
    </div>`;
  /* ---- A SLIDER, AND A NUMBER YOU CAN TYPE (2026-09-05) ----------------
     Paul: *"When you redesign think sliders and other UI for data entry."*
     Two controls on ONE address and that is deliberate, in the way the loop
     strip already is: the RANGE is the thumb's door and the NUMBER BOX is the
     keyboard's and the exact one's, and both call the same `write`. The
     field's own `data-k` stays on the range — T7 and the inventory read an
     address, and an address does not move when a widget does.

     IT WRITES ON `change`, NOT ON `input`. Every write on this page is a
     document write that normalises, recompiles and lands at the next bar;
     sixty a second under a dragging thumb is not an editor. The number beside
     it follows the thumb live (`input`), so the reading is never behind the
     hand — the same split the envelope editor's handles make.

     ...AND IT DOES NOT CLOSE THE SHEET. `write` here is the plain one: it
     leaves `openField` alone, because Paul's other ruling the same day is
     *"Don't dismiss things when I tap them to change values"* and a slider is
     the control you most obviously use twice. */
  if (pick === "slider") {
    const N = sf.num!;
    const cur = sf.value === "" || sf.value == null ? null : +sf.value;
    const shown = cur != null ? cur
      : (N.derivedNum != null ? N.derivedNum : N.min);
    /* A SLIDER REFUSES TOO, AND IT SAYS SO (2026-09-06, §15). Two ways: the
       whole field may be refused (`why`, and then the control takes the tap
       and answers it rather than moving), or the NUMBER BOX may be handed a
       value outside the range — a `<input type=number>` fires `change` with
       whatever was typed, the model clamps it, and before this line the number
       simply jumped back with no word said. The range is the field's own
       (`num`), so the sentence is arithmetic and not a second opinion. */
    const slide = (v: string) => {
      if (sf.why) { say(sf.key, sf.why); return; }
      const n = +v;
      if (Number.isFinite(n) && (n < N.min || n > N.max)) {
        say(sf.key, t("sheet.slider.range",
                      { min: fmt(N.min, N.unit || undefined),
                        max: fmt(N.max, N.unit || undefined) }));
        return;
      }
      unsay(sf.key);
      try { if (sf.set) sf.set(v); } catch (e) {} after(); };
    return html`<div class="nu-sheetrow nu-numrow">
      <b class="nu-sheetlab">${sf.label}</b>
      <input class="nu-numslide" type="range" data-k=${sf.key}
        aria-disabled=${ifDefined(sf.why ? "true" : undefined)}
        data-why=${ifDefined(sf.why || undefined)}
        min=${String(N.min)} max=${String(N.max)} step=${String(N.step)}
        .value=${String(shown)}
        aria-label=${N.unit ? t("sheet.slider.unit.aria",
                                  { name: sf.label, unit: N.unit })
                            : t("head.name", { name: sf.label })}
        aria-valuetext=${valueAria(fmt(shown, N.unit || undefined), cur == null)}
        @input=${(e: Event) => { const box = (e.target as HTMLElement)
            .parentElement?.querySelector(".nu-numbox") as HTMLInputElement | null;
          if (box) box.value = (e.target as HTMLInputElement).value; }}
        @change=${(e: Event) => slide((e.target as HTMLInputElement).value)} />
      <input class=${classMap({ "nu-numbox": true, "is-derived": cur == null })}
        type="number" data-k=${"num|" + sf.key}
        min=${String(N.min)} max=${String(N.max)} step=${String(N.step)}
        .value=${String(shown)}
        aria-label=${t("sheet.numbox.aria", { name: sf.label })}
        @change=${(e: Event) => slide((e.target as HTMLInputElement).value)} />
      ${N.unit ? html`<small class="nu-numunit">${N.unit}</small>` : nothing}
      ${clearBack}
      ${subOf(sf) ? html`<small class="nu-sheetsub">${subOf(sf)}</small>` : nothing}
      ${sayLine(sf.key)}
    </div>`;
  }
  if (pick === "native")
    /* THE NATIVE PICKER KEEPS THE FIELD'S OWN ADDRESS, because an address does
       not move when a widget does — T7 finds `data-k` on whatever is drawn. */
    return html`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${sf.label}</b>
      <select class="nu-wcell nu-trimbtn nu-nativepick" data-k=${sf.key}
        aria-label=${sf.label}
        .value=${sf.value == null ? "" : String(sf.value)}
        @change=${(e: Event) => write((e.target as HTMLSelectElement).value)}>${
        (sf.options || []).map((o) => {
          /* NO SILENT GREY IN THE WHEEL (2026-09-06, §15). A `<option
             disabled>` is a refusal the BROWSER enforces and cannot take a tap
             of its own, so this widget answers the law the way
             `src/menus/index.ts optionText` does: the reason is appended to
             the option's own words through the same `menu.withWhy` key, and it
             is read in the wheel itself. Before this line the grid's own
             native pickers carried no reason at all — not in the text, not on
             the element — which is the one place on this page the law was
             simply missing. */
          const w2 = o.w == null ? String(o.v) : String(o.w);
          const why2 = o.why ? String(o.why).trim() : "";
          return html`<option
            value=${String(o.v == null ? "" : o.v)}
            data-why=${ifDefined(why2 ? why2 : undefined)}
            ?disabled=${!!o.off}>${why2
              ? t("menu.withWhy", { name: w2, why: why2 }) : w2}</option>`; })}
      </select>${clearBack}
      ${subOf(sf) ? html`<small class="nu-sheetsub">${subOf(sf)}</small>` : nothing}
    </div>`;
  const many = manyOf(f);
  return html`<div class=${classMap({ "nu-sheetrow": true, "is-compound": many > 1 })}
      data-many=${ifDefined(many > 1 ? String(many) : undefined)}>
      <b class="nu-sheetlab">${sf.label}</b>${manyMark(many)}
      <button type="button"
        class=${classMap({ "nu-wcell": true, "nu-trimbtn": true,
                           "is-derived": !!sf.derived, "is-refused": !!sf.why })}
        data-k=${sf.key}
        aria-expanded=${String(open)}
        aria-disabled=${ifDefined(sf.why ? "true" : undefined)}
        data-why=${ifDefined(sf.why || undefined)}
        title=${ifDefined(sf.why || undefined)}
        aria-label=${sf.why
          ? t("sheet.field.refused", { name: sf.label, why: sf.why })
          : t("sheet.field", { name: sf.label,
                               value: valueAria(wordOf(sf), !!sf.derived) })}
        /* A REFUSED FIELD SAYS WHY *AND STILL OPENS* (2026-09-06, §15). It
           said-and-refused-to-open for an afternoon, and test/sheets.js caught
           what that costs: avail.js's founding law is *"hiding destroys the
           shape of the possible"* — a refused control greys its words, it does
           not take them off the screen — and a head that will not open is a
           vocabulary nobody can see. So the tap does both: the reason lands in
           the say line and the field opens with every word refused under it. */
        @click=${() => { if (sf.why) say(sf.key, sf.why);
          setOpenField(open ? null : sf.key); }}>${wordOf(sf)}</button>
      ${clearBack}
      ${subOf(sf) ? html`<small class="nu-sheetsub">${subOf(sf)}</small>` : nothing}
      ${sf.why ? sayLine(sf.key) : nothing}
    </div>${open ? (pick === "lozenge" ? lozengeFor(sf, write, after)
                                       : chipStrip(sf, write)) : nothing}`;
}

/* ---- A NAME A HAND TYPES (2026-09-06, wave C item 8) ------------------
   *"A section has a name. Types only today, so a form that plainly has a
   pre-chorus cannot say so."* Every other row of every sheet on this surface
   offers a VOCABULARY; this one offers the keyboard, and it is drawn as one
   ordinary sheet row — label, control, nothing else — so a section's name
   reads as a field of the section and not as a special case.

   ===== IT WRITES ON COMMIT AND NEVER ON A KEYSTROKE ====================
   Every `set` on this page is a document write that normalises, RECOMPILES and
   lands at the next bar, and `grid.ts wrapOps` puts each one on the undo stack.
   A write per keystroke would therefore be a recompile per keystroke and
   "pre-chorus" would be eleven Ctrl-Zs. So the box holds the letters and the
   document hears one sentence: BLUR or ENTER commits, ESCAPE puts the written
   name back and gives up focus, and a value equal to what is already there is
   not a write at all (the same "nothing changed is not an op" the stack keeps).

   ===== A TAP OUTSIDE IS A COMMIT, AND IT HAS TO BE HEARD FIRST =========
   `grid.ts armOutside` closes an open sheet on a `pointerdown` outside it, in
   the CAPTURE phase on `document` — and closing the sheet removes this input
   from the page. Chromium fires no `blur` for a focused element that is
   removed, so a name typed and then dismissed by tapping the background would
   have been silently dropped: this repo's characteristic bug ("declared but
   never arriving"), on the one control where the loss is a person's own words.
   The commit is therefore armed on `window` — capture on the window runs
   BEFORE capture on the document, so the letters are in the record before the
   sheet that held them goes away. One listener for the page, added the first
   time such a box is focused, reading `document.activeElement` rather than
   holding a reference to anything. */
type Committer = HTMLInputElement & { _nuCommit?: (() => void) | null };
let TEXTARMED = false;
function armText(): void {
  if (TEXTARMED || typeof addEventListener !== "function") return;
  TEXTARMED = true;
  addEventListener("pointerdown", (e: Event) => {
    const el = document.activeElement as Committer | null;
    if (!el || !el.classList || !el.classList.contains("nu-textbox")) return;
    const t2 = e.target as Node | null;
    if (t2 && (el === t2 || el.contains(t2))) return;
    const c = el._nuCommit;
    if (c) { el._nuCommit = null; c(); }
  }, true);
}

/* ===== READONLY, NEVER DISABLED (2026-09-07, the law audit) ============
   THE TWELFTH COPY OF A LAW WRITTEN ELEVEN TIMES ELSEWHERE, and the one place
   in the tree that was still breaking it. This row carried BOTH `?disabled`
   AND `aria-disabled` — and `disabled` is what this file's own header at :158
   forbids by name, for exactly the reason it gives there: a `disabled` input
   takes no tap, no focus and no pointer event, so the `why` beside it reaches
   nobody with a thumb. It was the silent grey wearing the accessible name of
   the law written to abolish it, and `title=` was the whole of its reach — a
   tooltip, on a phone, which is no reach at all.

   `readonly` IS THE RIGHT SPELLING FOR A TEXT BOX, and it is not the trade a
   button makes. A readonly input is focusable, tappable, selectable and
   copyable, and it refuses the one thing it has to refuse: a keystroke
   reaching the record. So the tap lands, the row's own say line prints the
   reason where a thumb already is, and the letters still cannot move. (A
   button has no `readonly`, which is why every OTHER refusal on this sheet is
   `aria-disabled` plus a handler that spends the press.)

   AND THE ROW GETS A SAY LINE, which it did not have. Every other widget on
   this sheet draws `sayLine(key)`; this one printed its reason into a `title`
   and an `aria-label` and nowhere a thumb could see. The line is the same
   line, keyed the same way, with its room reserved whether or not there is a
   sentence — so a reason arriving under a thumb moves nothing. */
function textRow(tf: TextField, after: () => void): TemplateResult {
  const cur = tf.value || "";
  const refused = !tf.set;
  const commit = (el: HTMLInputElement) => {
    const v = el.value;
    /* NOTHING CHANGED IS NOT A WRITE. Trimmed on both sides because
       `fields.js secNameOf` trims at the door, so " verse " and "verse" are
       the same name and only one of them would have made it into the record. */
    if (v.trim() === cur.trim()) { el.value = cur; return; }
    try { if (tf.set) tf.set(v); } catch (e) {}
    after();
  };
  return html`<div class="nu-sheetrow nu-textrow">
    <b class="nu-sheetlab">${tf.label}</b>
    <input class=${classMap({ "nu-textbox": true, "is-derived": !cur })}
      type="text" data-k=${tf.key}
      .value=${cur}
      maxlength=${ifDefined(tf.max ? String(tf.max) : undefined)}
      placeholder=${ifDefined(tf.hint || undefined)}
      ?readonly=${refused}
      aria-disabled=${ifDefined(refused ? "true" : undefined)}
      data-why=${ifDefined(tf.why || undefined)}
      autocomplete="off" autocorrect="off" spellcheck="false"
      enterkeyhint="done"
      aria-label=${tf.why ? t("sheet.field.refused",
                              { name: tf.label, why: tf.why })
                          : tf.label}
      @pointerdown=${() => { if (refused) say(tf.key, tf.why || tf.label); }}
      @focus=${(e: Event) => {
        if (refused) { say(tf.key, tf.why || tf.label); return; }
        armText();
        const el = e.target as Committer;
        el._nuCommit = () => commit(el); }}
      @keydown=${(e: KeyboardEvent) => {
        const el = e.target as HTMLInputElement;
        /* ENTER COMMITS THROUGH THE BLUR, so there is ONE committer and not
           two racing each other on the same keypress. */
        if (e.key === "Enter") { e.preventDefault(); el.blur(); }
        else if (e.key === "Escape") { e.preventDefault(); el.value = cur;
                                       el.blur(); } }}
      @blur=${(e: Event) => { const el = e.target as Committer;
        el._nuCommit = null; commit(el); }} />
    ${sayLine(tf.key)}
  </div>`;
}

/* ---- THE LOZENGE FIELD, UNDER ITS OWN ROW (2026-09-05) ----------------
   It opens exactly where the chip strip opens and closes exactly when the chip
   strip closes, because it IS the chip strip for a vocabulary too long to be
   one: same `data-k` on every option (`<field>|<value>`), same
   `aria-pressed`, same refusal spelling, same close-then-nothing order (a
   value tap does not dismiss — `write` here is the plain one). What it adds is
   that all of it is on the glass, in its own kinds, at once. */
function lozengeFor(f: StripField, onWrite: (v: string) => void,
                   after?: () => void): unknown {
  const door = LOZ();
  if (!door) return chipStrip(f, onWrite);
  const cl = clustersOf(f);
  const cur = f.value == null ? "" : String(f.value);
  const cellWhy = f.why || null;
  /* A CHAIN IS THE FIELD'S OWN STANDING VALUE (2026-09-06, TABLE.md §15).
     `values` is the model's chain in picked order; `off` below is still
     computed against the whole `value` string, which for a chain is what the
     document holds and what avail.js measured its refusals against. */
  const chain = f.multi && f.values ? f.values.map(String) : null;
  const stands = (v: string) => chain ? chain.indexOf(v) >= 0 : v === cur;
  return door.lozengeField({
    key: f.key,
    label: f.label,
    clusters: cl,
    value: cur,
    ...(chain ? { values: chain, multi: true,
                  ordered: !!f.ordered } : {}),
    why: cellWhy,
    options: (f.options || []).map((o) => {
      const v = String(o.v == null ? "" : o.v);
      const off = !!o.off && !stands(v);
      return { value: v, label: o.w == null ? v : String(o.w),
               why: (off || o.quiet) ? (o.why || cellWhy || f.label) : (o.why || null),
               disabled: off, quiet: !!o.quiet,
               cluster: o.g == null ? null : String(o.g) }; }),
    onWrite: (v: string) => { if (cellWhy) return; onWrite(v); },
    ...(chain && f.setChain ? { onToggle: (v: string, on: boolean,
                                           order: string[]) => {
      if (cellWhy) return;
      try { f.setChain!(v, on, order); } catch (e) {}
      if (after) after();
    } } : {}) });
}
