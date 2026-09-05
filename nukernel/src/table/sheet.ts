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
import type { Field, StripField, Choice } from "./api.js";
import { pickerFor as pick } from "../menus/pick.js";
import { t, fmt } from "../copy/global.js";

export type Picker = "combo" | "chips" | "native" | "slider";

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

export function pickerFor(f: StripField): Picker {
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
  //     `strip: true` — a cell sheet's row is inside a spreadsheet; see
  //     `PickOpts.strip` for the measurement that keeps it chips to 24.
  return pick((f.options || []).length, { strip: true });
}

const wordOf = (f: { word?: string | null }) =>
  (f.word == null || f.word === "" ? "—" : String(f.word));

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
    return html`<button type="button"
      class=${classMap({ "nu-wchip": true, "is-quiet": !!o.quiet })}
      data-k=${f.key + "|" + v}
      aria-pressed=${String(v === cur)}
      ?disabled=${hard || off}
      aria-disabled=${ifDefined(hard || off ? "true" : undefined)}
      data-why=${ifDefined(why == null ? undefined : why)}
      title=${ifDefined(why ? why : undefined)}
      aria-label=${chipAria(w, hard ? cellWhy : (off ? (o.why || null) : null),
                            o.prov || null)}
      @click=${() => { if (hard || off) return; onWrite(v); }}
      >${o.pv ? o.pv : nothing}<span class="nu-chipword">${w}</span
      >${o.prov ? html`<small class="nu-chipprov">${o.prov}</small>` : nothing}</button> `;
  };
  const all = f.options || [];
  if (!f.groups || !f.groups.length)
    return html`<div class="nu-wchips" role="group"
      aria-label=${f.label}>${all.map(chip)}</div>`;
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
  return html`<div class="nu-vsheet" role="group" aria-label=${name}>${
    fields.map((f) => fieldRow(f, openField, setOpenField, after))}</div>`;
}

function fieldRow(f: Field, openField: string | null,
                  setOpenField: (k: string | null) => void,
                  after: () => void): TemplateResult {
  if ((f as { kind?: string }).kind === "ops") {
    const o = f as Extract<Field, { kind: "ops" }>;
    return html`<div class="nu-sheetrow nu-sheetops">
      ${o.label ? html`<b class="nu-sheetlab">${o.label}</b>` : nothing}
      <div class="nu-opbar">${o.ops.map((op) => html`<button type="button"
        class="nu-opbtn" data-k=${op.k}
        ?disabled=${!!op.why}
        aria-disabled=${ifDefined(op.why ? "true" : undefined)}
        data-why=${ifDefined(op.why || undefined)}
        title=${ifDefined(op.why || undefined)}
        aria-label=${op.why ? t("sheet.refused",
                                { name: op.aria || op.word, why: op.why })
                            : (op.aria || op.word)}
        @click=${() => { if (op.why || !op.act) return;
          try { op.act(); } catch (e) {} }}>${op.word}</button>`)}</div>
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
      ${s.sub ? html`<small class="nu-sheetsub">${s.sub}</small>` : nothing}
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
      ${sf.sub ? html`<small class="nu-sheetsub">${sf.sub}</small>` : nothing}
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
    const slide = (v: string) => { try { if (sf.set) sf.set(v); } catch (e) {} after(); };
    return html`<div class="nu-sheetrow nu-numrow">
      <b class="nu-sheetlab">${sf.label}</b>
      <input class="nu-numslide" type="range" data-k=${sf.key}
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
      ${sf.sub ? html`<small class="nu-sheetsub">${sf.sub}</small>` : nothing}
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
        (sf.options || []).map((o) => html`<option
          value=${String(o.v == null ? "" : o.v)}
          ?disabled=${!!o.off}>${o.w == null ? String(o.v) : o.w}</option>`)}
      </select>${clearBack}
      ${sf.sub ? html`<small class="nu-sheetsub">${sf.sub}</small>` : nothing}
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
        @click=${() => setOpenField(open ? null : sf.key)}>${wordOf(sf)}</button>
      ${clearBack}
      ${sf.sub ? html`<small class="nu-sheetsub">${sf.sub}</small>` : nothing}
    </div>${open ? chipStrip(sf, write) : nothing}`;
}
