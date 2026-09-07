// nukernel/src/ui/cells.ts — <nu-table>, <nu-colhead>, <nu-rowhead>, <nu-cell>.
//
// Paul, 2026-09-07: *"Make the table system with lozenges just list the items
// as cells. The lozenges are getting in the way. Add the tables and cells to
// the design system."*
//
// ===== THE SHAPE IS NOT INVENTED HERE. IT IS THE ONE THAT ALREADY SHIPS. ==
//
// `.nu-lztrack` in nu.css (the instrument picker, ~line 8847) is a sideways
// track of `18ch` columns, each column a `nowrap` stack of full-width items,
// one item per line, the TRACK scrolling and the PAGE not. Paul liked it, and
// it is the answer to *"just list the items as cells"* said in CSS a version
// ago. So these four elements are that arrangement given tags, an attribute
// surface, a keyboard and states a gate can read — and NOT a second design.
// `.nu-lz*` is untouched by this file and by its stylesheet block; a separate
// round ports the lozenge field onto these tags, at which point the old rules
// go the way `.nu-elstep` went when its last user left.
//
// ===== WHAT CHANGES, AND IT IS THE WHOLE ASK: A CELL IS NOT A PILL. =======
//
// The lozenge is a NOUN — tokens.css says `--r-pill` is *"a noun, and only a
// noun — the LOZENGE wears it, and nothing else on this page does"*. An
// OPTION IN A LIST is not a noun you carry around; it is a line you read.
// So `<nu-cell>` is square (`--r2` at most, and never `--r-pill`), it fills
// its column, and its word starts at the column's start edge like every other
// line of every other list. What the pill was carrying — selected, refused,
// ordered, quiet, marked — survives ENTIRELY as cell STATES, because those
// were never the pill shape's doing; they were the control's.
//
// ===== THE FOUR, AND WHY EACH IS A TAG =================================
//
//   <nu-table>    the TRACK. It owns the sideways scroll, the accessible name
//                 of the whole set, and the ONE say line every refusal in it
//                 prints into.
//   <nu-colhead>  a COLUMN: its heading, and the cells under it. See the note
//                 on containment below — the heading owns the column because
//                 `open` (folded or not) is a fact about the column and not
//                 about a word at the top of it.
//   <nu-rowhead>  the same group when the groups run down the side and the
//                 cells run across.
//   <nu-cell>     ONE OPTION.
//
// A COLUMN IS ITS HEADING, AND THAT IS A DECISION. The alternative was a
// fifth tag (`<nu-column>`) holding a `<nu-colhead>` and its cells, and it was
// refused for two reasons: `open`, `count`, `current` and `held` are every one
// of them facts about the COLUMN that a bare heading could only mirror, and a
// mirror is the second copy this whole program exists to delete; and a table
// of four tags where one of them exists only to be a box is a system with a
// box in it. So `<nu-colhead label="Strings" count="4" open>` holds its four
// `<nu-cell>`s, and folding is `nu-colhead:not([open]) > nu-cell{ display:
// none }` — one rule, in the stylesheet, where §1a says the look lives.
//
// ===== HOW THESE HOLD LIGHT-DOM CHILDREN WITHOUT FIGHTING LIT ============
//
// `base.ts` renders into the light DOM, and lit-html's `render()` APPENDS its
// part at the end of the container rather than clearing it (lit-html.js:
// `container.insertBefore(createMarker(), endNode)` with `endNode` null).
// So an element here may have BOTH authored children and a rendered template,
// and the rendered half lands last. Two consequences, both handled in CSS and
// in one small helper rather than by cleverness:
//
//   · <nu-colhead>, <nu-rowhead> render their HEAD and let their cells stand
//     where the author put them; the head is put back in front with `order:
//     -1`, which is layout and belongs in the stylesheet.
//   · <nu-table> needs a real second box — the say line may NOT be inside the
//     scroller (nu.css already says why, at `.nu-lzsay`: *"a sentence that
//     scrolled sideways away from the word it is about is a sentence nobody
//     reads"*) — so it builds `.nu-eltrack` by hand and moves its columns into
//     it. That is a STRUCTURAL move, not an appearance one, and `watch()`
//     below keeps it true for a column added later.

import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { NuEl, nameOf } from "./base.js";
import { t } from "../copy/global.js";

/** Re-run `fn` when the element's own child list changes. Guarded by the
 *  observer's own arithmetic and not by a flag: `fn` only ever MOVES a child
 *  out of the host, a removal records a mutation, the second pass finds
 *  nothing left to move, and the loop stops on its own. */
function watch(el: HTMLElement, fn: () => void): MutationObserver {
  const o = new MutationObserver(() => fn());
  o.observe(el, { childList: true });
  return o;
}

/* ---- <nu-table> — THE TRACK ------------------------------------------
   ROLE: `group`, AND IT IS AN ARGUED CHOICE RATHER THAN A DEFAULT.
   `role="table"` promises an accessibility tree of rows and cells, and a
   screen reader given one navigates it with table commands and announces
   "row 3, column 2" for every word in it. This is not that. It is a set of
   NAMED GROUPS of options, whose meaning is entirely "which column is this
   word in" and never "which row"; the columns are different lengths on
   purpose, and a cell has no row-mates. So the honest mapping is a `group` of
   `group`s — the heading names its column, the column names its cells — and
   the name TABLE stays because that is the shape a hand sees and the word the
   app already uses for it. A `grid` would be a third lie: nothing here moves
   focus in two dimensions.

   THE TRACK TAKES A TAB STOP. A scroll container that a pointer can move and
   a keyboard cannot is a region a keyboard cannot read; `tabindex="0"` on the
   scroller is the plain fix, and it gives the element the focus state its row
   in `SPEC` declares. */
export class NuTable extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String },
    flow: { type: String, reflect: true },
    refused: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    why: { type: String },
  };
  declare key: string | null;
  declare label: string | null;
  declare flow: string | null;
  declare refused: boolean;
  declare busy: boolean;
  declare why: string | null;
  private obs: MutationObserver | null = null;

  constructor() {
    super();
    this.key = null; this.label = null; this.flow = "across"; this.why = null;
    this.refused = false; this.busy = false;
  }

  /** THE TRACK, BUILT AND KEPT. Everything that is not the track and not the
   *  say line is a column and belongs inside the track. */
  private hydrate(): void {
    let track = this.querySelector<HTMLElement>(":scope > .nu-eltrack");
    if (!track) {
      track = document.createElement("div");
      track.className = "nu-eltrack";
      track.setAttribute("role", "group");
      track.tabIndex = 0;
      this.insertBefore(track, this.firstChild);
    }
    const name = nameOf(this, "");
    if (name) track.setAttribute("aria-label", name);
    for (const c of Array.from(this.children)) {
      if (c === track) continue;
      if (c.classList.contains("nu-elsay")) continue;
      if (!(c instanceof HTMLElement)) continue;
      track.appendChild(c);
    }
  }

  /** A REFUSED TABLE REFUSES EVERY PRESS IN IT, and answers each one. The
   *  listener is in the CAPTURE phase so the reason is printed BEFORE a cell
   *  or a heading can act on a press the table has already declined — which
   *  is the difference between a refusal and a warning.
   *
   *  AND A BUSY ONE ANSWERS TOO, IN THE RIGHT WORDS. This said
   *  `t("ui.refused.noReason")` for both, so a table that was merely WORKING
   *  told a reader "Not available here." — a sentence about a different state,
   *  which is worse than no sentence because it is wrong rather than missing.
   *  `NuEl.refuse()` is the one owner of which sentence a spent press gets
   *  (DESIGN.md component 14 and 14a), so this asks it rather than choosing
   *  again; the early return above stays, because a table that is neither is
   *  not in the business of swallowing anything. */
  private guard = (e: Event): void => {
    if (!this.refused && !this.busy) return;
    e.preventDefault(); e.stopPropagation();
    this.refuse();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.hydrate();
    this.addEventListener("click", this.guard, true);
    this.obs = watch(this, () => this.hydrate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.guard, true);
    if (this.obs) { this.obs.disconnect(); this.obs = null; }
  }
  /** The say line, and nothing else: the columns are the author's children and
   *  lit-html appends this after them. */
  override render(): TemplateResult {
    return html`<span class="nu-elsay" role="status"></span>`;
  }
  protected override updated(ch: Map<PropertyKey, unknown>): void {
    super.updated(ch);
    this.hydrate();
  }
}

/* ---- THE TWO HEADINGS ------------------------------------------------
   A HEADING IS `aria-current` AND NEVER `aria-pressed`, and that is the same
   decision `<nu-menu-row>` makes for the same reason: a column is not an
   ANSWER, it is where the answer is standing. `aria-pressed` on a heading
   would tell a screen reader the heading itself had been chosen, which is a
   thing a hand never does. `open` is `aria-expanded`, which IS about the
   heading — it is the disclosure, and it is the one press a heading takes. */
class NuHead extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String },
    count: { type: Number }, held: { type: String },
    current: { type: Boolean, reflect: true },
  };
  declare key: string | null;
  declare label: string | null;
  declare count: number | null;
  declare held: string | null;
  declare current: boolean;
  private obs: MutationObserver | null = null;

  constructor() {
    super();
    this.key = null; this.label = null; this.count = null;
    this.held = null; this.current = false;
  }

  /** A CHAIN'S LENGTH IS A FACT ABOUT THE COLUMN, so the column is what
   *  measures it: whenever the membership changes, every cell in it is asked
   *  to draw again, because whether a cell prints its `order` depends on how
   *  many ordered cells stand beside it. Without this the number would be
   *  right on the first paint and stale forever after — the tree's
   *  characteristic bug, declared and never arriving. */
  private refresh(): void {
    for (const c of Array.from(this.querySelectorAll<HTMLElement>(":scope > nu-cell")))
      (c as unknown as { requestUpdate?: () => void }).requestUpdate?.();
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.obs = watch(this, () => this.refresh());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.obs) { this.obs.disconnect(); this.obs = null; }
  }

  /** The accessible name, with the two things a heading may add to it. A count
   *  and a held word are drawn as their own quiet parts and marked
   *  `aria-hidden`, so a reader hears one sentence rather than three
   *  fragments. */
  protected headName(): string {
    const name = nameOf(this, "");
    const n = this.count;
    if (this.held && n != null)
      return t("ui.col.holding", { name, n, value: this.held });
    if (n != null) return t("ui.col.count", { name, n });
    if (this.held) return t("ui.col.held", { name, value: this.held });
    return name;
  }
  protected inside(): TemplateResult {
    return html`<span class="nu-elword">${nameOf(this, "")}</span>${
      this.count != null
        ? html`<small class="nu-elcount" aria-hidden="true">${this.count}</small>`
        : nothing}${this.held
        ? html`<span class="nu-elheld" aria-hidden="true">${this.held}</span>`
        : nothing}`;
  }
}

/* ---- <nu-colhead> — A COLUMN, ACROSS THE TOP -------------------------
   `continued` IS A READOUT AND NOT A CONTROL, and that is `.nu-lzcont`'s own
   law moved into the system: when a long family runs into a second column,
   the second column's heading names the SAME address as the first. Two
   controls on one address is the bug — a hand folds one and the other stays
   open, and now the page disagrees with itself. So a continuation is drawn as
   a plain box, `aria-hidden`, taking no press and carrying no count and no
   fold: the same word, said quieter, so a reader's eye knows where it is and
   a reader's keyboard is not offered a second door to one room. */
export class NuColhead extends NuHead {
  static override properties = {
    ...NuHead.properties,
    open: { type: Boolean, reflect: true },
    continued: { type: Boolean, reflect: true },
  };
  declare open: boolean;
  declare continued: boolean;
  constructor() { super(); this.open = false; this.continued = false; }

  private press(): void {
    this.open = !this.open;
    this.dispatchEvent(new CustomEvent("nu-fold",
      { bubbles: true, composed: true, detail: { open: this.open } }));
  }
  override render(): TemplateResult {
    if (this.continued)
      return html`<span class="nu-elcolhead is-cont" aria-hidden="true"
        >${this.inside()}</span>`;
    return html`<button type="button" class="nu-elcolhead"
      aria-expanded=${String(!!this.open)}
      aria-current=${this.current ? "true" : nothing}
      aria-label=${this.headName()}
      @click=${() => this.press()}>${this.inside()}</button>`;
  }
}

/* ---- <nu-rowhead> — THE SAME GROUP, DOWN THE SIDE --------------------
   One table wants its families across the top (the instrument picker) and
   another wants them down the side (a mixer's channel names, a section's
   lanes). It is the SAME group with the axis turned, so it is the same
   attributes and the same states minus the fold — a row that folded would
   collapse to a line of nothing, which is a disclosure that hides its own
   handle. */
export class NuRowhead extends NuHead {
  override render(): TemplateResult {
    return html`<button type="button" class="nu-elrowhead"
      aria-current=${this.current ? "true" : nothing}
      aria-label=${this.headName()}
      @click=${() => this.dispatchEvent(new CustomEvent("nu-press",
        { bubbles: true, composed: true, detail: { value: nameOf(this, "") } }))}
      >${this.inside()}</button>`;
  }
}

/* ---- <nu-cell> — ONE OPTION, DRAWN AS A LINE -------------------------
   THE FOUR THINGS A CELL CAN BE, AND THEY ARE FOUR AND NOT THREE:
     SELECTED  the standing answer. It is LIT — filled in `--lamp`, its word
               in `--on-fill` — which is the system's one selection treatment
               and not a second idea invented for cells (§1: *"Selected boxes
               are oddly selected"* was four ideas for one state).
     REFUSED   drawn, dashed, quiet, and it SAYS WHY into the TABLE's one say
               line on a press. Never `disabled`: a `disabled` button takes no
               click and its reason reaches nobody.
     QUIET     INERT, WHICH IS NOT REFUSED, and conflating the two is the bug
               this attribute exists to prevent. A refused word is one a hand
               may not have; a quiet word is one no hand was ever offered —
               a heading's own example, a word standing in for a whole family.
               So it is not a button at all, it carries no `aria-disabled`, it
               is not dashed, and it is not greyed the refused grey.
     ORDER     a position in a chain, printed ONLY when there is a chain to be
               positioned in. A `1` beside the single member of a set is a
               number for nothing, so the cell counts its ordered siblings and
               says nothing below two. */
export class NuCell extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String }, mark: { type: String },
    value: { type: String },
    order: { type: Number },
    selected: { type: Boolean, reflect: true },
    refused: { type: Boolean, reflect: true },
    quiet: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    why: { type: String },
  };
  declare key: string | null;
  declare label: string | null;
  declare mark: string | null;
  declare value: string | null;
  declare order: number | null;
  declare selected: boolean;
  declare refused: boolean;
  declare quiet: boolean;
  declare busy: boolean;
  declare why: string | null;

  constructor() {
    super();
    this.key = null; this.label = null; this.mark = null;
    this.value = null; this.order = null; this.why = null;
    this.selected = false; this.refused = false;
    this.quiet = false; this.busy = false;
  }

  /** THE SAY LINE IS THE TABLE'S, WHEN THERE IS A TABLE. One sentence per
   *  track, at the foot of it, where a thumb already is — twelve cells each
   *  with a reserved line under it would push a column off the screen to hold
   *  room for a sentence that is almost never there. Standing alone (the
   *  gallery's own state grid, a cell used outside a table) it falls back to
   *  its own, so a refusal is never silent for want of a parent. */
  protected override sayNode(): HTMLElement | null {
    const tbl = this.closest("nu-table");
    const mine = tbl && tbl.querySelector<HTMLElement>(":scope > .nu-elsay");
    return mine || super.sayNode();
  }

  /** How many cells in this group carry an `order`. Below two, the number is
   *  not printed — see the note above. */
  private chain(): number {
    const p = this.parentElement;
    if (!p) return this.order != null ? 1 : 0;
    return p.querySelectorAll(":scope > nu-cell[order]").length;
  }

  private press(e: Event): void {
    if (this.refuse()) { e.preventDefault(); e.stopPropagation(); return; }
    this.say(null);
    this.dispatchEvent(new CustomEvent("nu-pick", {
      bubbles: true, composed: true,
      detail: { value: this.value != null ? this.value : nameOf(this, "") },
    }));
  }

  override render(): TemplateResult {
    const w = nameOf(this, "");
    const showOrder = this.order != null && this.chain() > 1;
    const body = html`${this.mark
      ? html`<span class="nu-elmark" aria-hidden="true">${this.mark}</span>`
      : nothing}<span class="nu-elword">${w}</span>${showOrder
      ? html`<small class="nu-elorder" aria-hidden="true">${this.order}</small>`
      : nothing}`;
    /* QUIET IS NOT A BUTTON. It takes no press, so it is not drawn as a thing
       that takes one, and it carries no `aria-disabled` — there is nothing
       here that was ever enabled. */
    if (this.quiet)
      return html`<span class="nu-elcell is-quiet">${body}</span>
        <span class="nu-elsay" role="status"></span>`;
    return html`<button type="button" class="nu-elcell"
      aria-pressed=${this.selected ? "true" : nothing}
      aria-disabled=${this.refused || this.busy ? "true" : nothing}
      aria-busy=${this.busy ? "true" : nothing}
      aria-label=${(() => {
        /* ===== THE REASON RIDES IN THE NAME (2026-09-07) ================
           THE HOLE THE LOZENGE PORT LEFT, found and reported by the round that
           made it rather than by a person hitting it: `field.ts` used to join
           the reason into the option's accessible name with `menu.withWhy`,
           and the cell inherited the say line but not the join. A `<nu-cell>`
           host carries `data-why` and prints into the field's say line, so a
           THUMB still gets the reason — but the host has no role, so its own
           `aria-label` is not announced, and a screen reader on a refused cell
           heard the word and nothing else. That is DESIGN.md component 14's
           silent grey in the one medium the component was written to protect.
           So the name is the WORD, plus the reason when there is one, plus the
           chain position when there is one — one key per whole sentence, never
           a name with fragments bolted onto it, which is `sheet.ts chipAria`'s
           own rule said here. `busy` uses the same join, because "why will
           this not move" and "why is this not moving YET" are one question to
           whoever is asking it. */
        const why = (this.refused || this.busy)
          ? (this.why || t("ui.refused.noReason")) : null;
        const named = showOrder
          ? t("ui.cell.order", { name: w, n: this.order != null ? this.order : 0 })
          : w;
        if (why) return t("menu.withWhy", { name: named || "", why });
        return named || nothing;
      })()}
      @click=${(e: Event) => this.press(e)}>${body}</button>
      <span class="nu-elsay" role="status"></span>`;
  }
}
