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
// 2026-09-05: *"In general dropdowns barely work."* `pickerFor` below is that
// one owner, and it is asked once per field:
//   1. THE CALLER'S OWN COMBO WINS. The five MENUS keys (ui/selects.js
//      `selectEl` at its own `data-sel` address) are a hundred and eight words
//      and are already the typed combo; the table seats it and does not
//      re-draw it.
//   2. CHIPS UP TO EIGHT WORDS. Chips are decisions and this page has said so
//      since 2026-08-16 — and eight is what fits one line at 320 without
//      becoming a wall.
//   3. THE NATIVE PICKER ON A COARSE POINTER. `(pointer: coarse)` is the only
//      honest test for "a thumb": a phone's own wheel beats any list this page
//      can draw, and it is the one control that cannot be scrolled off the
//      screen by the pane underneath it.
//   4. CHIPS OTHERWISE. On a desktop with a keyboard a strip of up to
//      twenty-four words is arrowable and readable, which a `<select>` is not.

import { html, nothing } from "lit/html.js";
import type { TemplateResult } from "lit/html.js";
import { classMap } from "lit/directives/class-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import type { Field, StripField, Choice } from "./api.js";
import { CHIPMAX } from "./model.js";

export type Picker = "combo" | "chips" | "native";

/** Is there a thumb on this screen? Asked once and cached: a pointer does not
 *  change under a running page, and `matchMedia` in a loop over eighteen
 *  fields is eighteen style resolutions. */
let COARSE: boolean | null = null;
export function coarse(): boolean {
  if (COARSE == null) {
    try { COARSE = !!(window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches); }
    catch (e) { COARSE = false; }
  }
  return COARSE;
}

export function pickerFor(f: StripField): Picker {
  if (f.node) return "combo";
  const n = (f.options || []).length;
  if (n <= CHIPMAX) return "chips";
  return coarse() ? "native" : "chips";
}

const wordOf = (f: { word?: string | null }) =>
  (f.word == null || f.word === "" ? "—" : String(f.word));

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
      aria-label=${(hard || (off && o.why) || o.prov)
        ? w + (hard ? ", " + cellWhy : (off && o.why ? ", " + o.why : "")) +
          (o.prov ? ", " + o.prov : "")
        : w}
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
    <div class="nu-groupbar" role="group" aria-label="what it acts on">
      ${f.groups.map((g) => html`<button type="button" class="nu-groupbtn"
        data-g=${g.word} data-k=${f.key + "|group|" + g.word}
        aria-pressed=${String(g.word === want)}
        @click=${() => { GROUPOPEN.set(f.key, g.word === want ? "" : g.word);
          if (REDRAW) REDRAW(); }}>${g.word}</button> `)}
    </div>
    <div class="nu-wchips nu-pinned" role="group"
      aria-label="the word it is on">${all.filter(isPin).map(chip)}</div>
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
        aria-label=${(op.aria || op.word) + (op.why ? ", " + op.why : "")}
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
        aria-label=${s.why ? s.label + ": " + wordOf(s) + ", " + s.why
                           : s.label + ": " + wordOf(s)}>${wordOf(s)}</span>
      ${s.sub ? html`<small class="nu-sheetsub">${s.sub}</small>` : nothing}
    </div>`;
  }
  const sf = f as StripField;
  const pick = pickerFor(sf);
  const open = openField === sf.key;
  const write = (v: string) => { setOpenField(null);
    try { if (sf.set) sf.set(v); } catch (e) {} after(); };
  const clearBack = (sf.clear && !sf.derived)
    ? html`<button type="button" class="nu-clearback" data-k=${"clear|" + sf.key}
        aria-label=${"clear " + sf.label + " back to what it inherits"}
        @click=${() => { try { sf.clear!(); } catch (e) {} after(); }}>clear</button>`
    : nothing;
  if (pick === "combo")
    return html`<div class="nu-sheetrow">
      <b class="nu-sheetlab">${sf.label}</b>${sf.node}${clearBack}
    </div>`;
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
        aria-label=${sf.why ? sf.label + ": " + sf.why
          : sf.label + ": " + wordOf(sf) + (sf.derived ? ", inherited" : ", written here")}
        @click=${() => setOpenField(open ? null : sf.key)}>${wordOf(sf)}</button>
      ${clearBack}
      ${sf.sub ? html`<small class="nu-sheetsub">${sf.sub}</small>` : nothing}
    </div>${open ? chipStrip(sf, write) : nothing}`;
}
