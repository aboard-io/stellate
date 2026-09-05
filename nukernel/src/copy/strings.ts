// nukernel/src/copy/strings.ts — THE CATALOGUE. Every string the page prints.
//
// TABLE.md §12b: *"every string the page prints lives in ONE catalogue,
// nukernel/src/copy/strings.ts → the committed nukernel/ui/copy.js, keyed
// (`cell.default`, `op.transposeUp`, `refuse.noArticle`…), read by t(key, {n,
// unit, name})"*.
//
// ONE KEYSPACE, WRITTEN IN TWELVE PAGES. The catalogue is one flat map — one key,
// one meaning, no key twice — and it is WRITTEN as a page per surface, because
// a two-thousand-line object literal is a file nobody can review and a merge
// conflict every round. `merge` below is what makes the split safe: a key that
// appears in two pages throws on load, in the browser and in the gate, naming
// both pages. The runtime catalogue is still one table and a second language
// is still one more directory beside this one.
//
// THE VOICE is DESIGN.md §4 and the review's glossary (TABLE.md §12a): plays
// (not reads), variation (not does), motif (not phrase — Paul reversed that
// one on 2026-09-05, TABLE.md §13e), transformation (not word operator), part
// (not chair), dynamics (not shape), automation (not motion), scale (not
// alphabet), phrase structure (not period), feel (not pace). A chip or a face is ≤ 6 words, a sentence beside a refused control
// ≤ 12; `test/copy.test.js` holds both, and the banned patterns with them.

import type { Table } from "./api.js";
import { CORE } from "./core.js";
import { TABLE } from "./table.js";
import { SHEETS } from "./sheets.js";
import { PRODUCE } from "./produce.js";
import { BOARD } from "./board.js";
import { GLYPHS } from "./glyph.js";
import { KNOBS } from "./knobs.js";
import { ATLAS } from "./atlas.js";
import { RULES } from "./rules.js";
import { FIELDS } from "./fields.js";
import { MISC } from "./misc.js";
import { SHELL } from "./shell.js";

/** Fold the pages into one table, refusing a key that is claimed twice. */
function merge(pages: Array<[string, Table]>): Table {
  const out: Table = {};
  const from: Record<string, string> = {};
  for (const [page, table] of pages)
    for (const k of Object.keys(table)) {
      if (Object.prototype.hasOwnProperty.call(out, k))
        throw new Error("copy: the key \"" + k + "\" is written twice — " +
                        from[k] + " and " + page);
      out[k] = table[k]!;
      from[k] = page;
    }
  return out;
}

export const STRINGS: Table = merge([
  ["core", CORE], ["table", TABLE], ["sheets", SHEETS], ["produce", PRODUCE],
  ["board", BOARD], ["glyph", GLYPHS], ["knobs", KNOBS], ["atlas", ATLAS],
  ["rules", RULES],
  ["fields", FIELDS], ["misc", MISC], ["shell", SHELL],
]);
