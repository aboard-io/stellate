// nukernel/src/table/undo.ts — DOCUMENT-LEVEL UNDO, WHICH THE PAGE HAS NEVER HAD.
//
// TABLE.md 9a: *"UNDO / REDO at the document level, Cmd/Ctrl-Z, for every op —
// mandatory: spreadsheet users expect it and the page has only the producer's
// undo."* Paul's own sentence for the whole wave is that the table should
// "re-use spreadsheet dynamics since users know them", and Ctrl-Z is the first
// one anybody reaches for.
//
// ===== WHY SNAPSHOTS AND NOT INVERSES ==================================
// An inverse per op is a second implementation of every op, and this table has
// fourteen of them (add · move · duplicate · delete · xN · deal-again on a row,
// six more on a column, three on a cell, plus every field write). Half of them
// end in `normalize()`, which prunes — so the inverse of "write -9 into a
// register" is not "write nothing", it is "restore whatever normalize left".
// A document is a few tens of kilobytes of JSON and a snapshot is one
// `structuredClone`; the honest cheap thing is to keep the document.
//
// ===== IT ADDS NO WRITE PATH ===========================================
// TABLE.md 5's law — "every op is one document write through the existing
// doors and lands at the next bar while playing" — holds because BOTH ends are
// existing doors. `snapshot()` is a read. Putting one back is `CTX.evolve`,
// which is what the seed strip and the atlas have handed the page a whole new
// document through since the composer round: it normalises, recompiles and
// lands at the next bar exactly like every other op. Undo is not a special
// case of anything; it is one more evolve.
//
// ===== WHAT IT DOES NOT TOUCH ==========================================
// THE PRODUCER'S OWN UNDO STAYS EXACTLY AS IT IS (ui/produce.js
// `undoable`/`undo`, the button on the Produce pane that takes back one
// producer NOTE). The two are different gestures on different scopes and
// folding them would make one of them lie: the producer's takes back a
// SENTENCE from `doc.produce` wherever you are, this one takes back the last
// thing THIS TABLE did. A producer note taken back while the table is open is
// simply the next document the table will snapshot against — the stack does
// not need to know it happened, which is the property that makes a snapshot
// stack safe next to another editor.

import type { Doc, TableAPI } from "./api.js";
import { t } from "../copy/global.js";

/** How deep. Twenty-five documents of a few tens of kilobytes is a megabyte at
 *  the outside, and a producer who wants to walk back further than
 *  twenty-five ops wants the seed, not the stack. */
const DEPTH = 25;

/* THE SNAPSHOT IS THE HOST'S OWN DOOR (ui/eight.js `snapshot`), not a clone
   taken here: the document is ui/eight.js's `DOC` and the one place that knows
   how to hand a copy of it out is ui/eight.js. */

export class DocUndo {
  private A: TableAPI;
  private back: Doc[] = [];
  private fwd: Doc[] = [];
  /** what the last op was called, so the two buttons can say what they undo. */
  private names: string[] = [];
  private fwdNames: string[] = [];
  /** an undo is itself an evolve, and an evolve must not be snapshotted as a
   *  new op — that is how a stack eats its own tail. */
  private inside = false;

  constructor(A: TableAPI) { this.A = A; }

  get canUndo(): boolean { return this.back.length > 0; }
  get canRedo(): boolean { return this.fwd.length > 0; }
  /** the word the button says, so "undo" is never a promise with no object. */
  get undoWord(): string { return this.back.length
    ? t("undo.undoOf", { name: this.names[this.names.length - 1] ||
                               t("undo.lastChange") })
    : t("act.undo"); }
  get redoWord(): string { return this.fwd.length
    ? t("undo.redoOf", { name: this.fwdNames[this.fwdNames.length - 1] ||
                               t("undo.lastChange") })
    : t("act.redo"); }

  /** Run `op` with the document remembered first. EVERY op the grid performs
   *  goes through here, which is what "for every op" in 9a means and what the
   *  gate counts. */
  run(name: string, op: () => void): void {
    if (this.inside) { op(); return; }
    let before: Doc | null = null;
    try { before = this.A.snapshot(); } catch (e) { before = null; }
    op();
    if (!before) return;
    /* NOTHING CHANGED IS NOT AN OP. Tapping the word a cell is already on
       writes the same value back; a stack that recorded it would make Ctrl-Z a
       no-op the first time and confuse the second. Compared on the serialised
       document, which is the same equality `test/table.test.js` T2 uses. */
    let after: string;
    try { after = JSON.stringify(this.A.doc()); } catch (e) { return; }
    if (JSON.stringify(before) === after) return;
    this.back.push(before);
    this.names.push(name);
    if (this.back.length > DEPTH) { this.back.shift(); this.names.shift(); }
    this.fwd.length = 0; this.fwdNames.length = 0;
  }

  undo(): boolean {
    const prev = this.back.pop();
    const name = this.names.pop();
    if (!prev) return false;
    let now: Doc | null = null;
    try { now = this.A.snapshot(); } catch (e) { now = null; }
    if (now) { this.fwd.push(now); this.fwdNames.push(name || t("undo.lastChange")); }
    this.inside = true;
    try { this.A.evolve(prev); } finally { this.inside = false; }
    return true;
  }

  redo(): boolean {
    const next = this.fwd.pop();
    const name = this.fwdNames.pop();
    if (!next) return false;
    let now: Doc | null = null;
    try { now = this.A.snapshot(); } catch (e) { now = null; }
    if (now) { this.back.push(now); this.names.push(name || t("undo.lastChange")); }
    this.inside = true;
    try { this.A.evolve(next); } finally { this.inside = false; }
    return true;
  }
}

/* ONE STACK PER PAGE, NOT ONE PER DRAW. The table is rebuilt from scratch on
   every `changed()` — that is what makes an op land — so a stack owned by the
   component would be thrown away by the first op it recorded. It is held here,
   keyed by nothing, because there is one document. */
let STACK: DocUndo | null = null;
export function undoStack(A: TableAPI): DocUndo {
  if (!STACK) STACK = new DocUndo(A);
  return STACK;
}
