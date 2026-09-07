// nukernel/src/ui/panels.ts — <nu-plate> and <nu-menu-row>.
//
// Paul, 2026-09-07: *"As you find parts that aren't implemented like the
// hamburger and its menu items add them to the design systems."* And, in the
// same breath: *"Icons in hamburger should all have same width not float left
// it looks uneven."*
//
// ===== THE NEW DECISION, ARGUED: A MARK OCCUPIES A FIXED ADVANCE. ========
//
// There is no law in this tree today requiring equal-width marks, and this is
// it. THE FACT THAT FORCES IT, measured in this repo's own stack: `.nu-g` is
// `font-size: 1.2rem; font-family: var(--sym)` with no width, and `--sym` is a
// PROPORTIONAL stack — so `⊙` advances 26.8px, `⌗` advances 18.0px, and the
// tofu box between them is 19.2px. Eighteen rows of a menu, each one a mark
// then a word, and the words start at eighteen different places. Paul read
// that as *"uneven"* before anyone measured it, which is what a ragged left
// edge does: the eye uses the start edge of a list as its ruler, and a ruler
// that moves is noise the reader has to subtract on every row.
//
// The obvious fix — pick marks that happen to be the same width — is not a
// fix, because it is a promise about a font nobody controls, in a stack that
// falls back differently on every platform, for a set of marks that grows. The
// fix is to stop asking the mark how wide it is: give it a COLUMN, centre it
// in that column, and start every word at the column's end. A mark is then a
// mark and not a measurement, and a new row can carry any glyph at all without
// moving the eighteen above it.
//
// THE PRECEDENT IS ALREADY IN THE TREE AND THIS IS ITS SECOND USER. The
// record's name plate in the top strip does exactly this (nu.css ~7443):
// `display: grid; grid-template-columns: 1.4em minmax(0, 1fr)` with the mark
// on `grid-column: 1; justify-self: center`. That rule was written to stop a
// name from being clipped, and the equal advance was a side effect nobody
// wrote down. It is written down now, as a rule of `<nu-menu-row>`, and IT
// HOLDS ANYWHERE A MARK PRECEDES A WORD — a sheet row, a plate row, a list of
// destinations, an index entry with a kind mark. `1.4em` is the number,
// because `em` makes the column scale with the row's own type rather than with
// the page's, which is the same reasoning the spacing ramp is under.
//
// ===== <nu-plate>: WHY IT DECLARES ONE STATE AND NOT TWO ================
//
// A plate that is not open is `display: none` — that is what a plate IS, a
// panel that arrives and leaves — and `ElSpec.states` is the list of states
// the GALLERY DRAWS. A `rest` cell for this element would be an empty box with
// the word "rest" over it, which demonstrates nothing and asserts nothing:
// D2 would pass it only by being loosened, and a gallery that shows a blank
// square is a gallery that has stopped being the fastest gate we have. So the
// plate declares `open`, which is the whole of its visible life, and its
// closed state is one line of CSS with no cell on the page.
//
// ===== AND THE LAW IT CARRIES: NEVER A FULL-WIDTH BAND OF GLASS =========
//
// A tap outside a panel must have somewhere to land, at every width, or the
// only way out of the plate is the plate's own close button — and a panel with
// one door is a panel people get stuck in. So the plate's inline size is
// capped at `100vw` less a TAP plus air: whatever the screen, there is always
// at least a thumb's width of the page beside it. It stops short of the bottom
// band for the same reason and scrolls INSIDE itself when the rows will not
// fit, rather than growing past the glass. The anchor says which edge it hangs
// from — `start` by default, because the hamburger is moving to the LEFT and a
// plate that opens away from its own button reads as a different panel.

import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { NuEl, nameOf } from "./base.js";

/* ---- <nu-plate> — THE PANEL THAT ARRIVES ----------------------------- */
export class NuPlate extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String },
    anchor: { type: String, reflect: true },
    open: { type: Boolean, reflect: true },
  };
  declare key: string | null;
  declare label: string | null;
  declare anchor: string | null;
  declare open: boolean;
  constructor() {
    super();
    this.key = null; this.label = null; this.anchor = "start";
    this.open = false;
  }
  /** A PANEL WITH NO ACCESSIBLE NAME IS NOT A COMPONENT IN THIS SYSTEM. The
   *  role and the name go on the HOST rather than on an inner box, because the
   *  host is the scroll container and the thing a reader lands in; the rows
   *  are the author's own children and stand where they were written. */
  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("role")) this.setAttribute("role", "group");
    const name = nameOf(this, "");
    if (name && !this.hasAttribute("aria-label"))
      this.setAttribute("aria-label", name);
  }
  override render(): TemplateResult | typeof nothing { return nothing; }
}

/* ---- <nu-menu-row> — ONE FORMAT, AND NOTHING ELSE ON THE GLASS -------
   A mark in a fixed advance, then a name, then a count if the row has one.
   That is the whole vocabulary: no sub-line, no second mark, no chevron, no
   badge. A menu is a list of destinations and the reason a list is readable is
   that every line is the same line.

   `current` IS `aria-current="page"` AND NEVER `aria-pressed`. A row naming
   the view you are already in has not been PRESSED; you are standing in it.
   `selected` is the other thing a plate row can be — a switch that is on — and
   the two are separate attributes because they are separate facts, and a
   reader who hears "pressed" for "you are here" has been told something
   untrue. */
export class NuMenuRow extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String }, mark: { type: String },
    count: { type: Number },
    current: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    refused: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    why: { type: String },
  };
  declare key: string | null;
  declare label: string | null;
  declare mark: string | null;
  declare count: number | null;
  declare current: boolean;
  declare selected: boolean;
  declare refused: boolean;
  declare busy: boolean;
  declare why: string | null;
  constructor() {
    super();
    this.key = null; this.label = null; this.mark = null; this.count = null;
    this.why = null;
    this.current = false; this.selected = false;
    this.refused = false; this.busy = false;
  }
  private press(e: Event): void {
    if (this.refuse()) { e.preventDefault(); e.stopPropagation(); return; }
    this.dispatchEvent(new CustomEvent("nu-press",
      { bubbles: true, composed: true, detail: { value: nameOf(this, "") } }));
  }
  override render(): TemplateResult {
    const w = nameOf(this, "");
    /* THE MARK'S BOX IS DRAWN WHETHER OR NOT THERE IS A MARK IN IT, which is
       the fixed advance doing its job: a row with no mark still starts its
       word where every other row starts its word. */
    return html`<button type="button" class="nu-elmenurow"
      aria-current=${this.current ? "page" : nothing}
      aria-pressed=${this.selected ? "true" : nothing}
      aria-disabled=${this.refused || this.busy ? "true" : nothing}
      aria-busy=${this.busy ? "true" : nothing}
      aria-label=${w || nothing}
      @click=${(e: Event) => this.press(e)}
      ><span class="nu-elmark" aria-hidden="true">${this.mark || ""}</span
      ><span class="nu-elword">${w}</span>${this.count != null
        ? html`<small class="nu-elcount" aria-hidden="true">${this.count}</small>`
        : nothing}</button>
      <span class="nu-elsay" role="status"></span>`;
  }
}
