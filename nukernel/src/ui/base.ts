// nukernel/src/ui/base.ts — THE ONE DECISION EVERY ELEMENT IN THIS DIRECTORY
// IS UNDER: they render into the LIGHT DOM, and nu.css is in charge.
//
// docs/DESIGN-SYSTEM.md §2: *"STYLES STAY IN CSS. No css`` blocks inside
// components carrying the palette; components carry structure, the stylesheet
// carries the look. Elements render into the light DOM or use ::part,
// whichever keeps nu.css in charge — decide once, write down which and why."*
//
// ===== THE DECISION: LIGHT DOM. `createRenderRoot()` returns `this`. ======
//
// FOUR REASONS, AND THE FIRST IS THE ONE THAT DECIDED IT.
//
//   1 · nu.css IS IN CHARGE, LITERALLY. A shadow root is a wall the page's own
//       stylesheet cannot reach through; keeping nu.css in charge across it
//       would mean a `::part` for every element a rule wants to touch, and a
//       `::part` list IS a second surface to keep in step — the thing this
//       whole program exists to delete. In the light DOM a rule that already
//       says `.nu-wchip` goes on saying it, and the port (step 4) becomes a
//       change of TAG rather than a rewrite of the stylesheet.
//   2 · THE PAGE MEASURES ITSELF. `ui/glyph.js place()` measures the gutter,
//       the lozenge field packs and re-measures a frame after mount, the table
//       reads `--wordw` off a rendered cell, and eleven gates walk the DOM with
//       `querySelectorAll`. Every one of those walks stops at a shadow
//       boundary. A component that a gate cannot see is a component nothing
//       can prove, and this repo's standing law is to test the ARTIFACT.
//   3 · ONE COPY OF THE TOKENS. Custom properties inherit through a shadow
//       root, so tokens.css would still reach — but nothing else would, and
//       the elements would end up carrying `css``` blocks with the look in
//       them, which §2 forbids in the same paragraph.
//   4 · IT IS WHAT THE TREE ALREADY DOES. `src/table`, `src/menus`,
//       `src/lozenge` and `src/envelope` all render Lit templates into hosts
//       the page owns, styled by nu.css. These elements are the same
//       arrangement with a tag name on the front.
//
// WHAT IT COSTS, SAID RATHER THAN HIDDEN: no style encapsulation, so a class
// name inside an element can collide with one outside it. The answer is the
// answer nu.css has used for nine thousand lines — every class is prefixed
// `nu-` — plus one rule of this directory's own: an element's inner parts are
// prefixed `nu-el` (`.nu-elword`, `.nu-elmark`, `.nu-elsay`), so a selector can
// always say whether it is inside a component or beside one.

import { LitElement } from "lit";
import type { PropertyValues } from "lit";
import { t } from "../copy/global.js";

/* THE ELEMENT'S NAME, FROM THE CATALOGUE. DESIGN.md §2: *"an accessible name
   that comes from the copy catalogue"*. `key` is the door; `label` is the
   escape hatch for a word that is the RECORD's own (a genre, a section's
   name, a player's) and therefore in no catalogue at all. A control with
   neither is a control with no name and says so, loudly, rather than shipping
   an unnamed button. */
export function nameOf(el: { key?: string | null; label?: string | null },
                       fallback?: string): string {
  if (el.key) { try { return t(el.key); } catch (e) { return el.key; } }
  if (el.label) return el.label;
  return fallback || "";
}

export class NuEl extends LitElement {
  /* THE LIGHT DOM, AND THE WHOLE OF THE DECISION ABOVE IN ONE LINE. */
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  /* A HOST THAT SAYS WHAT IT IS. Every element in this directory carries
     `data-nu` with its own tag, so a gate, a stylesheet and a person reading
     the inspector can all ask the same question — "is this one of ours?" —
     without a class list to keep in step. */
  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("data-nu"))
      this.setAttribute("data-nu", this.tagName.toLowerCase());
  }

  /* THE STATE A GATE READS. The seven states of DESIGN.md §2 are ATTRIBUTES on
     the host, not classes on a child, so `[selected]`, `[open]`, `[refused]`
     and `[busy]` are one selector each in nu.css and one query each in the
     gate. `hover` and `focus` are the browser's, and `data-demo` is the
     gallery's forced spelling of them — nu.css draws the two in the same rule
     (see THE ELEMENTS at the foot of that file), so the gallery cannot show a
     hover the live page does not have. */
  protected bool(name: string): boolean { return this.hasAttribute(name); }

  /* WHY A CONTROL WILL NOT MOVE, SAID WHERE A THUMB CAN REACH IT (DESIGN.md
     component 14). ONE say line per widget, its room reserved so a sentence
     arriving under a thumb moves nothing, and `role="status"` so it is heard
     as well as seen. */
  protected sayNode(): HTMLElement | null {
    return this.querySelector<HTMLElement>(":scope > .nu-elsay");
  }
  protected say(text: string | null): void {
    const n = this.sayNode();
    if (n) n.textContent = text || "";
  }

  /* A REFUSED CONTROL TAKES THE PRESS AND ANSWERS IT. Returns true when the
     press was spent on the refusal, so every handler in this directory reads
     `if (this.refuse()) return;` and no element can forget. */
  protected refuse(): boolean {
    if (this.hasAttribute("busy")) return true;
    if (!this.hasAttribute("refused")) { this.say(null); return false; }
    this.say(this.getAttribute("why") || t("ui.refused.noReason"));
    return true;
  }

  protected override updated(ch: PropertyValues): void {
    super.updated(ch);
    if (!this.hasAttribute("refused")) this.say(null);
  }
}
