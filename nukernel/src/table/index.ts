// nukernel/src/table/index.ts — THE ENTRY, AND THE WHOLE PUBLIC SURFACE.
//
// `node tools/ui/build.js` bundles this file (and everything it imports, Lit
// included) into the committed `nukernel/ui/table.js`, which ui/eight.js
// imports exactly as it always has:
//
//     import { bandTable } from "./table.js";
//
// ONE EXPORT, AND IT IS THE ONE THE HOST ALREADY CALLED. `bandTable(host, A)`
// takes the same seam (`tableAPI()`, a list of doors) and returns the same
// object (`{ table, pane, rowHeads, colHeads, paint, close, openCorner }`) the
// wordgrid returned, because `tablePanel` reads `rowHeads.get(id).live` to hand
// the playhead its cells and the gutter reads the rest. A migration that moved
// that shape would have been a migration of ui/eight.js as well, and the
// strangler's whole point is that it is not.

export { bandTable } from "./grid.js";
/* ...AND THE UNDO STACK ITSELF (2026-09-05, the chained-motif round). A
   SECOND export, and the first one this surface has grown — the note above
   ("one export, and it is the one the host already called") stands as the
   rule and this is the argued exception. `wrapOps` makes every op the GRID
   performs undoable; a `node` field's own buttons are the host's, and
   ui/eight.js's motif transforms have been outside document undo since the
   stack was written. A chain of transforms that Ctrl-Z could not take back
   would be the one op on this page that is not undoable, which is exactly
   what §9a's "for every op" forbids. `undoStack` is a singleton over the
   TableAPI, so the host reaches the SAME stack the grid uses rather than
   opening a second one. */
export { undoStack } from "./undo.js";
export type { Grid } from "./grid.js";
export type { TableAPI, Field, Op } from "./api.js";
