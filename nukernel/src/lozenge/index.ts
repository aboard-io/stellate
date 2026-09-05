// nukernel/src/lozenge/index.ts — THE ENTRY, AND THE WHOLE PUBLIC SURFACE.
//
// `node tools/ui/build.js` bundles this file (and everything it imports, Lit
// included) into the committed `nukernel/ui/lozenge.js`, which a caller
// imports as a plain module:
//
//     import { lozengeField } from "./lozenge.js";
//
// ONE OWNER FOR EVERY WALL OF WORDS ON THIS PAGE (DESIGN.md §2 component 16):
// the drummer's sixty-eight kit ops, the forty-two chord qualities, the
// sixty-three scales and modes, the transformations, the instruments. A second
// lozenge widget anywhere on this page is a bug — and so is a second table of
// cluster words, which is what `./clusters.ts` is about.

export { lozengeField } from "./field.js";
export { clustersFrom, clustersOf, scaleFamilyOf, scaleFamilyWords,
         checkScaleFamilies } from "./clusters.js";
export { HUES, HOLD_MS, SLOP } from "./api.js";
export type { LozSpec, LozOption, LozCluster } from "./api.js";

/* ---- AND IT PUBLISHES ITSELF, WHICH IS `ui/copy.js`'s OWN ARRANGEMENT ----
   `src/menus` and `src/table` are their OWN build entries, so an
   `import { lozengeField } from "../lozenge/index.js"` in either of them would
   bundle a second copy of this component — and a third — into ui/menus.js and
   ui/table.js. Three copies of a widget is three widgets that can drift, which
   is the exact thing `src/copy/global.ts` was written to refuse ("the
   catalogue ships once, in one file, and every surface reads that one").
   So the component ships once, in ui/lozenge.js, `index.html` loads it beside
   ui/copy.js, and the two bundles that need it read it off here. A caller that
   is NOT a bundle — ui/selects.js, ui/eight.js — imports it normally. */
import { lozengeField as _field } from "./field.js";
import { clustersFrom as _from, clustersOf as _of,
         scaleFamilyOf as _fam } from "./clusters.js";
(globalThis as unknown as { NuLozenge: unknown }).NuLozenge = {
  lozengeField: _field, clustersFrom: _from, clustersOf: _of,
  scaleFamilyOf: _fam,
};
