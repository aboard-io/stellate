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
export type { Grid } from "./grid.js";
export type { TableAPI, Field, Op } from "./api.js";
