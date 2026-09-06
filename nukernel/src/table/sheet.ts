// nukernel/src/table/sheet.ts — THE FORMULA BAR, WHICH IS A VECTOR MADE OF CHIPS.
//
// TABLE.md 9a: *"Tap a cell -> it is SELECTED (one selection, its address
// shown), and its vector appears in the FORMULA BAR above the grid as editable
// chips. Double-tap or Enter edits in place; Escape cancels; Delete clears back
// to inherit."*
//
// ===== WHERE THE FORMULA BAR IS, AND WHY IT IS NOT FLOATING ============
// A spreadsheet's formula bar is a strip above the grid because a spreadsheet's
// cell is one value. A cell here is a VECTOR of up to eighteen fields, and this
// page has two standing laws about where that many words may go:
//   · MENUS NEVER SCROLL INSIDE THEMSELVES (nukernel design language,
//     2026-08-16: "Don't make me scroll INSIDE a popup, vertical space is cheap
//     and abundant") — so the bar opens to its full height and pushes the page
//     down;
//   · CELL MENUS INSERT BELOW THE ROW (accordion, one open), never a floating
//     popup that covers the column you are editing.
// So the bar's BODY is a `<tr class="nu-wopen">` under the selected row, which
// is where every sheet on this surface has opened since wave 2b and what
// test/table.browser.js `sheetRows()` reads. What is ABOVE the grid is the
// bar's HEAD (grid.ts `.nu-formula`): the ADDRESS of the selection, undo/redo,
// and the two axis offers. Head and body are one control — the head names the
// cell, the body is its vector — and no field is drawn twice.
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

export type Picker = "combo" | "chips" | "native" | "slider" | "lozenge";

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
  if (!f.groups || !f.groups.length)
    return html`<div class="nu-wchips" role="group"
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
    <div class="nu-wchips" role="group" aria-label=${f.label}>${
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
export function sheetBody(fields: Field[], name: string,
                          openField: string | null,
                          setOpenField: (k: string | null) => void,
                          after: () => void): TemplateResult {
  const chunks = groupChunks(fields);
  return html`<div class="nu-vsheet" role="group" aria-label=${name}>${
    chunks.map((c) => c.head == null
      ? c.fields.map((f) => fieldRow(f, openField, setOpenField, after))
      : groupSection(c, openField, setOpenField, after))}</div>`;
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
  return html`<section class="nu-sheetgroup" data-group=${key}
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
    return html`<div class="nu-sheetrow nu-sheetops">
      ${o.label ? html`<b class="nu-sheetlab">${o.label}</b>` : nothing}
      <div class="nu-opbar">${o.ops.map((op) => html`<button type="button"
        class="nu-opbtn" data-k=${op.k}
        aria-disabled=${ifDefined(op.why ? "true" : undefined)}
        data-why=${ifDefined(op.why || undefined)}
        aria-label=${op.why ? t("sheet.refused",
                                { name: op.aria || op.word, why: op.why })
                            : (op.aria || op.word)}
        @click=${() => { if (op.why) { say(bark, op.why); return; }
          if (!op.act) return; unsay(bark);
          try { op.act(); } catch (e) {} }}>${op.word}</button>`)}</div>
      ${sayLine(bark)}
    </div>`;
  }
  if ((f as { kind?: string }).kind === "node") {
    /* A CALLER'S OWN WIDGET GETS THE WHOLE ROW, label above rather than beside:
       the voice's channel strip is 207px of inserts, sends, EQ, pan and a
       fader, and beside an 11ch label at 390 it overflowed (desk-gate G13). */
    const n = f as Extract<Field, { kind: "node" }>;
    return html`<div class="nu-sheetrow nu-noderow">
      ${n.label ? html`<b class="nu-sheetlab">${n.label}</b>` : nothing}
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
  return html`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${sf.label}</b>
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

function textRow(tf: TextField, after: () => void): TemplateResult {
  const cur = tf.value || "";
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
      ?disabled=${!tf.set}
      aria-disabled=${ifDefined(tf.set ? undefined : "true")}
      data-why=${ifDefined(tf.why || undefined)}
      title=${ifDefined(tf.why || undefined)}
      autocomplete="off" autocorrect="off" spellcheck="false"
      enterkeyhint="done"
      aria-label=${tf.why ? t("sheet.field.refused",
                              { name: tf.label, why: tf.why })
                          : tf.label}
      @focus=${(e: Event) => { armText();
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
