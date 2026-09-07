// nukernel/src/ui/index.ts — THE ENTRY, AND THE WHOLE PUBLIC SURFACE.
//
// `node tools/ui/build.js` bundles this file (and everything it imports, Lit
// included) into the committed `nukernel/ui/ui.js`. It is the FIFTH build
// entry — src/copy, src/lozenge, src/menus, src/table, src/envelope were the
// four — and it is discovered the way all of them are, by this directory
// having an `index.ts`, so nothing in tools/ui/build.js had to change.
//
// WHO LOADS IT, TODAY: `nukernel/design.html` and nothing else.
// docs/DESIGN-SYSTEM.md §5 puts the PORT — every call site in the app moving
// onto these elements — at step 4, and this is step 1 and step 3. So the
// elements exist, are registered, are drawn in every state on the gallery and
// are gated there; `nukernel/index.html` does not load this file and does not
// change. A round that shipped the elements AND rewired the app would be two
// rounds in one diff, and the second of them is the one that can break a page
// a person is using.
//
// IT REGISTERS ITSELF, which is what a custom element is for: importing this
// module is the whole of "the elements exist". `customElements.define` is
// guarded because a page that loads the bundle twice (a gate driving the same
// document twice, a hot reload) must not throw on the second one.

import { NuButton, NuIconButton } from "./buttons.js";
import { NuLamp, NuLegend, NuValue } from "./readouts.js";
import { NuRail, NuSpinner } from "./pick.js";
import { NuTable, NuColhead, NuRowhead, NuCell } from "./cells.js";
import { NuPlate, NuMenuRow } from "./panels.js";
import { NuIndex, NuGlobe } from "./atlas.js";
import { SPEC, ALL_STATES, PSEUDO_STATES, attrsOf } from "./api.js";
import { gallery, ratio, TEXT_FLOOR, EDGE_FLOOR } from "./gallery.js";

export { NuButton, NuIconButton, NuLamp, NuLegend, NuValue, NuRail, NuSpinner };
export { NuTable, NuColhead, NuRowhead, NuCell };
export { NuPlate, NuMenuRow, NuIndex, NuGlobe };
export { SPEC, ALL_STATES, PSEUDO_STATES, attrsOf };
export { gallery, ratio, TEXT_FLOOR, EDGE_FLOOR };
export type { ElSpec, ElState, AttrSpec, DemoKid } from "./api.js";

/** THE TAG TABLE. One row per element, and it is checked against `SPEC` on
 *  load — a tag defined here and not declared there is a component outside the
 *  system, and a tag declared there and not defined here is a gallery entry
 *  that draws nothing. Both throw, in the browser, at boot. */
const TAGS: Array<[string, CustomElementConstructor]> = [
  ["nu-button", NuButton],
  ["nu-icon-button", NuIconButton],
  ["nu-lamp", NuLamp],
  ["nu-legend", NuLegend],
  ["nu-value", NuValue],
  ["nu-rail", NuRail],
  ["nu-spinner", NuSpinner],
  ["nu-table", NuTable],
  ["nu-colhead", NuColhead],
  ["nu-rowhead", NuRowhead],
  ["nu-cell", NuCell],
  ["nu-plate", NuPlate],
  ["nu-menu-row", NuMenuRow],
  ["nu-index", NuIndex],
  ["nu-globe", NuGlobe],
];

export function define(): void {
  const declared = SPEC.map((s) => s.tag).sort().join(",");
  const defined = TAGS.map((r) => r[0]).sort().join(",");
  if (declared !== defined)
    throw new Error("ui: the spec and the tag table disagree — " +
                    declared + " vs " + defined);
  for (const [tag, ctor] of TAGS)
    if (!customElements.get(tag)) customElements.define(tag, ctor);
}

define();

/* ---- AND IT PUBLISHES ITSELF, WHICH IS ui/copy.js's OWN ARRANGEMENT ----
   `nukernel/design.html` is a plain document with one inline module, and
   `test/design-system.js` drives the rendered page. Both want the SPEC — the
   page to draw it, the gate to walk it — and neither is a bundle, so the
   surface is published on `globalThis` exactly as `NuLozenge` and `COPY` are.
   One artifact, one copy of the definitions, three readers. */
(globalThis as unknown as { NuUI: unknown }).NuUI = {
  SPEC, ALL_STATES, PSEUDO_STATES, attrsOf,
  gallery, ratio, TEXT_FLOOR, EDGE_FLOOR, define,
};
