// nukernel/src/ui/readouts.ts — <nu-lamp>, <nu-legend>, <nu-value>.
//
// THE PANEL/SCREEN SPLIT, MADE OF THREE TAGS (docs/DESIGN-SYSTEM.md §0):
// *"SO THE SYSTEM IS A PANEL AND A SCREEN, AND THEY LOOK DIFFERENT. Legends
// are printed: small caps, dim, fixed, never lit. Values live on the screen:
// phosphor, bright, and the only things that change. A control that is doing
// something has a LAMP."*
//
// They are one file because they are one sentence. A LEGEND names a thing, a
// VALUE says what it currently is, and a LAMP says whether it is doing
// anything — and the three of them side by side are what a channel strip is.
// Nothing in this file takes a press.

import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { NuEl, nameOf } from "./base.js";

/* ---- <nu-lamp> — THE ONE PLACE SATURATED COLOUR IS ALLOWED -------------
   DESIGN.md component 11. Two shapes and four meanings, and *"never both
   meanings in one colour"* — which is why `means` is an enum of the page's own
   four and not a colour attribute.

   IT IS SILENT BY DEFAULT, AND THAT IS AN ACCESSIBILITY DECISION rather than
   an omission. A lamp beside a name is a second reading of a fact the name
   already carries, and a lamp that follows the beat announced for the length
   of a record is the machine talking over the music (DESIGN.md component 21
   and §13f: *"The text in the motifs section is changing rapidly every beat
   it's too much."*). So it is `aria-hidden` unless `says` is set — and when it
   is set, it is the only thing carrying that fact and it gets a real name. */
export class NuLamp extends NuEl {
  static override properties = {
    on: { type: Boolean, reflect: true },
    means: { type: String, reflect: true },
    shape: { type: String, reflect: true },
    says: { type: Boolean },
    key: { type: String }, label: { type: String },
  };
  declare on: boolean;
  declare means: string | null;
  declare shape: string | null;
  declare says: boolean;
  declare key: string | null;
  declare label: string | null;
  constructor() {
    super();
    this.on = false; this.means = "clock"; this.shape = "dot";
    this.says = false; this.key = null; this.label = null;
  }
  override render(): TemplateResult {
    const name = nameOf(this, "");
    return this.says && name
      ? html`<i class="nu-ellamp"></i><span class="nu-vh">${name}</span>`
      : html`<i class="nu-ellamp" aria-hidden="true"></i>`;
  }
  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.says) this.setAttribute("aria-hidden", "true");
  }
}

/* ---- <nu-legend> — PRINTED, AND IT NEVER LIGHTS -----------------------
   The label half of the label/value split the sheets already use. Two
   readings: with `for`, it is a real `<label>` and a click on the word lands
   on the control — which is 44px of extra target for free; without one, it is
   a `<span>`, because a `<label>` that names nothing is a lie a screen reader
   reads out. */
export class NuLegend extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String }, mark: { type: String },
    for: { type: String, attribute: "for" },
  };
  declare key: string | null;
  declare label: string | null;
  declare mark: string | null;
  declare for: string | null;
  constructor() {
    super();
    this.key = null; this.label = null; this.mark = null; this.for = null;
  }
  override render(): TemplateResult {
    const w = nameOf(this, "");
    const inner = html`${this.mark
      ? html`<span class="nu-elmark" aria-hidden="true">${this.mark}</span>`
      : nothing}<span class="nu-elword">${w}</span>`;
    return this.for
      ? html`<label class="nu-ellegend" for=${this.for}>${inner}</label>`
      : html`<span class="nu-ellegend">${inner}</span>`;
  }
}

/* ---- <nu-value> — THE SCREEN -----------------------------------------
   Phosphor, tabular, and the only thing on the panel that changes.

   BLANK IS THE DEFAULT AND DERIVED IS QUIET, which is DESIGN.md §3's oldest
   pair of laws said in one control: *"Blank = default (inherited); bold =
   written; delete = back to default."* A value nobody set prints the
   PLACEHOLDER in the quiet register; a value a hand set prints at full weight.
   The unit rides after the number in the second voice, because a unit is a
   fact about the number and not a second number. */
export class NuValue extends NuEl {
  static override properties = {
    value: { type: String }, unit: { type: String },
    placeholder: { type: String },
    derived: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    means: { type: String, reflect: true },
    key: { type: String }, label: { type: String },
  };
  declare value: string | null;
  declare unit: string | null;
  declare placeholder: string | null;
  declare derived: boolean;
  declare selected: boolean;
  declare means: string | null;
  declare key: string | null;
  declare label: string | null;
  constructor() {
    super();
    this.value = null; this.unit = null; this.placeholder = null;
    this.derived = false; this.selected = false; this.means = "value";
    this.key = null; this.label = null;
  }
  override render(): TemplateResult {
    const blank = this.value == null || this.value === "";
    const said = blank ? (this.placeholder || "") : this.value!;
    const name = nameOf(this, "");
    return html`<output class="nu-elval" aria-label=${name || nothing}
        ?data-blank=${blank}>${said}</output>${this.unit
      ? html`<small class="nu-elunit">${this.unit}</small>` : nothing}`;
  }
}
