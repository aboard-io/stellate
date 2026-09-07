// nukernel/src/ui/pick.ts — <nu-rail> and <nu-spinner>.
//
// THE TWO CONTROLS v302 SHIPPED, GIVEN A SURFACE (TABLE.md §19, DESIGN.md §2
// components 23 and 24). They are not inventions of this round: the rail is
// `.nu-wchips.is-exclusive` and the spinner is `.nu-spin`, both drawn today by
// `src/table/sheet.ts` inside a sheet row, and what this file adds is a TAG
// with a documented attribute surface, a keyboard, and states a gate can read
// — so the same widget can stand outside a sheet without a second copy of it
// being written at the new call site.
//
// THEY ARE ONE FILE BECAUSE THEY ARE ONE QUESTION ASKED TWICE. Both hold one
// value out of a short vocabulary. The rail SHOWS the vocabulary, because a
// hand comparing three words wants all three; the spinner HIDES it behind a
// step, because a row that is a STATE is not a list you shop in
// (`src/menus/pick.ts SPINMAX`: five, and five is where a person stops knowing
// where they are without counting). The rule for which one a vocabulary gets
// stays in `src/menus/pick.ts` and is not restated here — this file draws
// them; it does not choose.

import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { NuEl, nameOf } from "./base.js";
import { t } from "../copy/global.js";

export interface Opt { v: string; w: string; off: boolean }

/** `value:word|value:word` — and a word with no colon is its own value, which
 *  is the common case and saves every caller writing `swung:swung`.
 *  A LEADING `!` REFUSES A WORD (`!hard:hard swing`): a refused option is
 *  drawn and stepped OVER, never deleted, because DESIGN.md component 14 is
 *  about controls that are DRAWN refused rather than missing. */
export function parseOptions(s: string | null): Opt[] {
  if (!s) return [];
  return s.split("|").map((raw) => {
    const off = raw.startsWith("!");
    const body = off ? raw.slice(1) : raw;
    const i = body.indexOf(":");
    const v = i < 0 ? body : body.slice(0, i);
    const w = i < 0 ? body : body.slice(i + 1);
    return { v: v.trim(), w: w.trim(), off };
  }).filter((o) => o.v !== "");
}

class NuPick extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String },
    options: { type: String }, value: { type: String, reflect: true },
    refused: { type: Boolean, reflect: true },
    busy: { type: Boolean, reflect: true },
    why: { type: String },
  };
  declare key: string | null;
  declare label: string | null;
  declare options: string | null;
  declare value: string | null;
  declare refused: boolean;
  declare busy: boolean;
  declare why: string | null;
  constructor() {
    super();
    this.key = null; this.label = null; this.options = null;
    this.value = null; this.why = null;
    this.refused = false; this.busy = false;
  }
  protected opts(): Opt[] { return parseOptions(this.options); }
  protected at(): number {
    const o = this.opts();
    const i = o.findIndex((x) => x.v === this.value);
    return i < 0 ? 0 : i;
  }
  /** THE ONE WRITE. Nothing in this file mutates the record: it sets its own
   *  `value` and says so, and the host decides what that means. */
  protected pick(v: string): void {
    if (v === this.value) return;
    this.value = v;
    this.dispatchEvent(new CustomEvent("nu-pick",
      { bubbles: true, composed: true, detail: { value: v } }));
  }
}

/* ---- <nu-rail> — ONE OF A SET LOOKS LIKE ONE OF A SET -----------------
   Paul, 2026-09-07: *"Each exclusive of each other."* A single-select strip is
   JOINED — no gap, one hairline between segments, rounded at the two ends
   only, the standing word filled — and a chain is separate pills. The fact is
   drawn as `data-exclusive` so a GATE reads what a HAND sees.

   THE KEYBOARD IS A RADIO GROUP'S, which is what an exclusive strip is:
   arrows MOVE AND PICK (rather than move-then-press), because a radio group
   that needs a second key to commit is a radio group people leave half-set.
   `roving tabindex`: one stop for the whole rail, so Tab crosses a strip of
   six words in one press. */
export class NuRail extends NuPick {
  static override properties = {
    ...NuPick.properties,
    exclusive: { type: Boolean, reflect: true },
  };
  declare exclusive: boolean;
  constructor() { super(); this.exclusive = true; }

  private step(d: number): void {
    if (this.refuse()) return;
    const o = this.opts();
    if (!o.length) return;
    const n = o.length;
    for (let i = 1; i <= n; i++) {
      const c = o[(this.at() + d * i + n * n) % n]!;
      if (c.off) continue;      /* stepped OVER, never into */
      this.pick(c.v);
      const el = this.querySelector<HTMLElement>(
        '.nu-elseg[data-v="' + CSS.escape(c.v) + '"]');
      if (el) el.focus();
      return;
    }
    this.say(this.why || t("ui.refused.allRefused"));
  }
  private end(last: boolean): void {
    if (this.refuse()) return;
    const o = this.opts().filter((x) => !x.off);
    const c = last ? o[o.length - 1] : o[0];
    if (c) this.pick(c.v);
  }
  private keys(e: KeyboardEvent): void {
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); this.step(1); }
    else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); this.step(-1); }
    else if (k === "Home") { e.preventDefault(); this.end(false); }
    else if (k === "End") { e.preventDefault(); this.end(true); }
  }
  override render(): TemplateResult {
    const name = nameOf(this, "");
    const o = this.opts();
    const cur = this.value;
    const hard = this.refused || this.busy;
    return html`<div class="nu-elrail" role="group" aria-label=${name || nothing}
      data-exclusive=${String(!!this.exclusive)}
      @keydown=${(e: KeyboardEvent) => this.keys(e)}
      >${o.map((c) => html`<button type="button" class="nu-elseg"
        data-v=${c.v}
        aria-pressed=${String(c.v === cur)}
        aria-disabled=${hard || c.off ? "true" : nothing}
        tabindex=${c.v === cur || (!cur && c === o[0]) ? "0" : "-1"}
        @click=${() => {
          if (this.refuse()) return;
          if (c.off) { this.say(this.why || t("ui.refused.noReason")); return; }
          this.say(null); this.pick(c.v);
        }}>${c.w}</button>`)}</div>
      <span class="nu-elsay" role="status"></span>`;
  }
}

/* ---- <nu-spinner> — A STATE, NOT A SHOPPING LIST ----------------------
   Paul, 2026-09-07: *"turn them into spinners for the status changes"*.
   Paul, 2026-09-07, second pass: *"The spinner can just be a single button
   without arrows left and right. Click to rotate it."*

   SO IT IS ONE BUTTON. It was three — `‹ word 2/4 ›` — and the two arrows
   were 44px of tap floor each, spent on a direction, next to a control whose
   whole vocabulary is at most five words. A rotate is the gesture a hardware
   spinner actually has (a DATA wheel turns one way and comes back round), and
   the width the arrows cost is width a phone does not have: MEASURED on the
   gallery before and after, the resting control went from 155.5px to 68.0px
   at 320 and at 390 alike — 87.5px, 56% of it, given back to the row. (The
   refused example stays 232.9px at both widths, because what is wide there is
   the SENTENCE and not the control, which is component 14 working.)

   THE KEYBOARD KEEPS THE WAY BACK, and that is not a compromise but the point
   of the arrow keys: a pointer wraps forward, and Left/Down step back,
   Home/End take the ends. A hand that has overshot on a keyboard can reverse;
   a thumb goes round. The POSITION goes on being printed — `2/4` — because a
   control showing one of four has to say there are four, and it is now the
   only thing on the glass that says a set exists at all.

   THE ADDRESS DOES NOT MOVE WHEN THE WIDGET DOES: the value lives on the
   host, exactly as `src/table/sheet.ts` keeps `data-k` on the word. */
export class NuSpinner extends NuPick {
  static override properties = {
    ...NuPick.properties,
    position: { type: Boolean },
  };
  declare position: boolean;
  constructor() { super(); this.position = true; }

  private step(d: number): void {
    if (this.refuse()) return;
    const o = this.opts();
    if (!o.length) return;
    const n = o.length;
    for (let i = 1; i <= n; i++) {
      const c = o[(this.at() + d * i + n * n) % n]!;
      if (c.off) continue;
      this.say(null); this.pick(c.v);
      return;
    }
    this.say(this.why || t("ui.refused.allRefused"));
  }
  private keys(e: KeyboardEvent): void {
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowUp") { e.preventDefault(); this.step(1); }
    else if (k === "ArrowLeft" || k === "ArrowDown") { e.preventDefault(); this.step(-1); }
    else if (k === "Home") { e.preventDefault(); this.step(-this.at()); }
    else if (k === "End") { e.preventDefault(); this.step(this.opts().length - 1 - this.at()); }
  }
  override render(): TemplateResult {
    const name = nameOf(this, "");
    const o = this.opts();
    const i = this.at();
    const now = o[i];
    const hard = this.refused || this.busy;
    /* ONE BUTTON, AND THE NAME CARRIES WHAT THE ARROWS USED TO. `ui.spin.now`
       says the spinner's name, the word it is standing on, and where that is
       in the set — so a screen reader gets the whole state from the one
       control, which is what it used to get from three. */
    return html`<button type="button" class="nu-elspin"
      aria-disabled=${hard ? "true" : nothing}
      aria-busy=${this.busy ? "true" : nothing}
      aria-label=${t("ui.spin.now",
        { name, value: now ? now.w : "", n: i + 1, of: o.length })}
      @keydown=${(e: KeyboardEvent) => this.keys(e)}
      @click=${() => this.step(1)}
      ><span class="nu-elspinword">${now ? now.w : ""}</span>${this.position
        ? html`<small class="nu-elpos" aria-hidden="true"
            >${i + 1}/${o.length}</small>` : nothing}</button>
      <span class="nu-elsay" role="status"></span>`;
  }
}
