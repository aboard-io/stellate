// nukernel/src/menus/pick.ts — WHICH WIDGET A VOCABULARY GETS. ONE OWNER, ONE FILE.
//
// Paul, 2026-09-05: *"In general dropdowns barely work."*
// TABLE.md 9b: *"Dropdowns: the native picker on touch, the typed combo on
// desktop with a keyboard, chips for a vocabulary of <= 8 words."*
//
// THIS FILE IS THE ONE OWNER OF THAT SENTENCE FOR THE WHOLE PAGE. It was
// written twice before — once in `src/table/sheet.ts pickerFor` (the grid, and
// the only place that had it right) and once, implicitly and wrongly, in
// `ui/selects.js`, which answered COMBO to every vocabulary at every size on
// every pointer. `src/table/sheet.ts` imports this now and `ui/menus.js` is
// built on it, so the rule is stated in one place and compiled into two
// bundles — which is what bundling means, and is the same arrangement Lit
// itself is under here.
//
// ===== WHAT THE PHONE MEASURED, 2026-09-06 =============================
// Driven at 390x844 with `(pointer: coarse)` and touch emulation, tapping each
// menu at its own rect on the rendered page (the shipped chant, `#at=Rome&
// y=600&s=1`), against a soft keyboard that eats 320 of the 844:
//
//   · EVERY ONE of the 33 `ui/selects.js` combos came up a FOCUSED, WRITABLE
//     `<input type=text>` — `readOnly` is cleared at the moment the list opens
//     — which is the definition of "raise the keyboard" on a phone. 33 of 33.
//   · WITH THAT KEYBOARD UP, the number of options a thumb could reach without
//     scrolling was ONE, on nine of the thirteen menus driven: swing 1 of 6,
//     mode 1 of 12, harmony 1 of 3, `cast.part` 1 of 7, and `rule.instr.0`
//     1 of 120. The list is in the flow UNDER the field, and the field is at
//     the top of the keyboard.
//   · FOUR of thirteen did not stay open at all: `alphabet.scale`,
//     `alphabet.quality|bar0`, `rule.scale` and `sound.instrument|voice` each
//     opened on `focusin` and were shut again before the finger left the glass
//     (measured: `focusin expanded=true` then `blur expanded=false`, and for
//     two of them the field element itself was REPLACED mid-gesture — the page
//     redrew, and `restoreFocus` handed focus back to a brand-new field that
//     had seen no gesture since it was born and so refused to open).
//
// On a 1280 desktop the same thirteen all opened, filtered, committed and
// closed. The typed combo is a good control with a keyboard and a bad one
// without, which is exactly what 9b said before any of this was drawn.

import type { Picker } from "./api.js";

/** TABLE.md 9a: "a control is a little bigger than its word". Eight words is
 *  what fits one line of chips at 320 without becoming a wall. */
export const CHIPMAX = 8;

/** A strip longer than twenty-four words is a page of words. Only the grid's
 *  cell rows consult this (see `strip` below). */
export const LONGSTRIP = 24;

/** Is there a thumb on this screen? Asked once and cached: a pointer does not
 *  change under a running page, and `matchMedia` in a loop over eighteen
 *  fields is eighteen style resolutions. */
let COARSE: boolean | null = null;
export function coarse(): boolean {
  if (COARSE == null) {
    try { COARSE = !!(typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches); }
    catch (e) { COARSE = false; }
  }
  return COARSE;
}
/** ...and a door for a gate that wants to ask the other pointer's question in
 *  the same page. Nothing on the page calls it. */
export function forgetPointer(): void { COARSE = null; }

export interface PickOpts {
  /** A CONTROL IN A TABLE CELL, where a strip has no room. MEASURED at 390 on
   *  the changes table: `alphabet.quality|bar0` sits in a bar column 63 PIXELS
   *  WIDE, and its eight chips — 22 to 55px each — stacked one per row into a
   *  381px tower inside one cell of a chart that is meant to be read across.
   *  Paul named that exact control as a menu in that exact place (2026-08-24:
   *  *"chord quality can be selects inside the 'the changes' table"*), so a
   *  cell menu gets a picker at every length: the phone's own wheel on a thumb,
   *  the typed combo with a keyboard. `menu()` passes this for its `compact`
   *  form, which IS "the bare widget in a cell, a slot row or a bus plate" —
   *  and the two that are not cells (the insert seat, the bus name) are twelve
   *  and thirteen words, so they were never chips anyway. */
  tight?: boolean;
  /** THE GRID'S CELL ROWS, AND NOTHING ELSE. A cell sheet's row sits inside a
   *  spreadsheet, where a strip of up to twenty-four words is one arrowable
   *  line a hand can read at a glance and where the row above and below are
   *  the context; a PAGE control stands alone under a printed question, where
   *  a hundred and forty-eight words cannot be a strip. Both readings are 9b's
   *  sentence applied where it stands, and the difference is only ever what a
   *  FINE pointer gets above eight words — a thumb gets the native picker
   *  either way, which is the half this round is about.
   *  It is a named parameter and not a second copy of the rule: TABLE.md 9d's
   *  rule 4 ("chips otherwise ... a strip of up to twenty-four words is
   *  arrowable and readable, which a `<select>` is not") is gated by
   *  test/table.browser.js T9's chip walk, which drives `throat|<name>`,
   *  `reg|<name>` and the mix-automation strips as chips. */
  strip?: boolean;
}

export function pickerFor(n: number, opts?: PickOpts): Picker {
  // 0 · A CELL HAS NO ROOM FOR A STRIP — see `tight` above.
  if (opts && opts.tight) return coarse() ? "native" : "combo";
  // 1 · CHIPS ARE DECISIONS, and this page has said so since 2026-08-16.
  if (n <= CHIPMAX) return "chips";
  // 2 · A THUMB GETS THE PHONE'S OWN WHEEL. `(pointer: coarse)` is the only
  //     honest test for one, and the native picker is the single control on a
  //     phone that cannot be scrolled off the screen by the pane under it,
  //     cannot be covered by the keyboard, and needs no keyboard to use.
  if (coarse()) return "native";
  // 3 · a cell in a spreadsheet row — see `strip` above. AT ANY LENGTH, and
  //     that is not a hole: `src/table/model.ts` hands anything over
  //     `LONGSTRIP` a CALLER-BUILT control before this is ever asked, so the
  //     only vocabularies that reach here are the ones a strip can hold. A
  //     `combo` answered to a field with no `node` draws NOTHING — measured the
  //     hour this rule moved: `dev.line|voice|s0` is 26 words, is built without
  //     a node, and vanished off the cell sheet entirely.
  if (opts && opts.strip) return "chips";
  // 4 · A KEYBOARD GETS THE TYPED COMBO. Measured good on a desktop and only
  //     reachable from one.
  return "combo";
}
