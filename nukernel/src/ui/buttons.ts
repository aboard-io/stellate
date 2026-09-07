// nukernel/src/ui/buttons.ts — <nu-button> and <nu-icon-button>.
//
// DESIGN.md §2's first two entries, and the two everything else is built from.
// They are ONE file because they are one control with two readings of the same
// question — is the word on the glass, or is it only said? — and splitting
// them was how the page ended up with `mkBtn`, `icon()`, `.nu-trimbtn` and a
// Lit `html\`<button>\`` all meaning "a button".
//
// WHAT THEY REFUSE TO DO, and it is worth naming because the old ones did it:
//   · they never carry a colour (nu.css does);
//   · they never go `disabled` (DESIGN.md component 14: a `disabled` button
//     takes no click, so its reason reaches nobody with a thumb);
//   · they never invent a name (it comes from the catalogue, or from the
//     record, and a mark is not a name).

import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { NuEl, nameOf } from "./base.js";

class NuButtonBase extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String }, mark: { type: String },
    tone: { type: String }, size: { type: String },
    selected: { type: Boolean, reflect: true },
    open: { type: Boolean, reflect: true },
    refused: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    why: { type: String },
  };
  declare key: string | null;
  declare label: string | null;
  declare mark: string | null;
  declare tone: string | null;
  declare size: string | null;
  declare selected: boolean;
  declare open: boolean;
  declare refused: boolean;
  declare busy: boolean;
  declare why: string | null;

  constructor() {
    super();
    this.key = null; this.label = null; this.mark = null;
    this.tone = null; this.size = null; this.why = null;
    this.selected = false; this.open = false;
    this.refused = false; this.busy = false;
  }

  /** THE WORD, drawn or only said. */
  protected word(): string { return nameOf(this, ""); }

  /** THE ONE HANDLER. A refusal is answered here and nowhere else, so no
   *  caller can forget to answer one; a press that survives it becomes a
   *  `nu-press` event the host listens for. */
  protected press(e: Event): void {
    if (this.refuse()) { e.preventDefault(); e.stopPropagation(); return; }
    this.dispatchEvent(new CustomEvent("nu-press",
      { bubbles: true, composed: true, detail: { value: this.word() } }));
  }

  /** THE INNER BUTTON. `aria-disabled` and never `disabled`; `tabindex` stays
   *  reachable when refused, because a reason a keyboard cannot get to is the
   *  same silent grey a thumb cannot get to. */
  protected shell(inside: TemplateResult | typeof nothing,
                  cls: string): TemplateResult {
    const name = this.word();
    return html`<button type="button" class=${cls}
      aria-pressed=${this.selected ? "true" : nothing}
      aria-expanded=${this.open ? "true" : nothing}
      aria-disabled=${this.refused || this.busy ? "true" : nothing}
      aria-busy=${this.busy ? "true" : nothing}
      aria-label=${name || nothing}
      @click=${(e: Event) => this.press(e)}>${inside}</button>
      <span class="nu-elsay" role="status"></span>`;
  }
}

/* ---- <nu-button> — A WORD YOU PRESS ----------------------------------- */
export class NuButton extends NuButtonBase {
  override render(): TemplateResult {
    const w = this.word();
    return this.shell(html`${this.mark
        ? html`<span class="nu-elmark" aria-hidden="true">${this.mark}</span>`
        : nothing}<span class="nu-elword">${w}</span>`, "nu-elbtn");
  }
}

/* ---- <nu-icon-button> — A MARK YOU PRESS, WITH ITS WORD SAID -----------
   DESIGN.md component 15: *"every icon from ui/glyph.js, each with its .nu-vh
   word"*. The word is in the DOM and visually hidden rather than only in an
   `aria-label`, so it is READ with the stylesheet off — which is the check
   Paul actually runs on this page. */
export class NuIconButton extends NuButtonBase {
  override render(): TemplateResult {
    const w = this.word();
    return this.shell(html`<span class="nu-elmark" aria-hidden="true"
      >${this.mark || "▫"}</span><span class="nu-vh">${w}</span>`,
      "nu-elbtn nu-elicon");
  }
}
