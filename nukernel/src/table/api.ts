// nukernel/src/table/api.ts — THE SEAM, TYPED, AND THAT IS TYPESCRIPT'S FIRST JOB.
//
// ui/eight.js builds `tableAPI()` and hands it over: a list of DOORS, never
// data. Nothing here invents a door — this file is the SHAPE of the one that
// already exists, written down so the compiler can hold it. The migration
// memory names the reason: "TypeScript's first job is the vocabulary and tier
// tables" (the seconds-vs-ms glide bug, the delay index read as a count).
//
// Every member below is a function ui/eight.js (or document.js, or produce.js)
// already had. TABLE.md 5: "Every op is one document write through the existing
// doors and lands at the next bar while playing. No op adds a second write
// path."

/* ---- what a vocabulary offers ---------------------------------------- */

/** One word a control can say. `off` is REFUSED (the record makes it
 *  unreachable); `quiet` is INERT (it would sound the same here). Both carry a
 *  `why`; conflating them greys the inert words, which wordgrid.js shipped for
 *  an hour and test/sheets.js caught. */
export interface Choice {
  v: string | number | null;
  w?: string | null;
  off?: boolean;
  why?: string | null;
  quiet?: boolean;
  /** a motif's picture (ui/preview.js) and its provenance (TABLE.md 3). */
  pv?: Node | null;
  prov?: string | null;
}

/** A field of a vector — one line of the formula bar. The four kinds are
 *  wordgrid.js's own four, kept name for name because the gates read them. */
export interface StripField {
  kind?: "strip";
  key: string;
  label: string;
  word: string | null;
  value: string;
  derived: boolean;
  sub?: string | null;
  why?: string | null;
  options?: Choice[];
  set?: (v: string) => void;
  clear?: (() => void) | null;
  groups?: { word: string; vals: string[] }[];
  /** a caller-built control — the typed combo, for the five MENUS keys. */
  node?: HTMLElement | null;
}
export interface SayField {
  kind: "say";
  label: string;
  word: string | null;
  why?: string | null;
  sub?: string | null;
}
export interface OpsField { kind: "ops"; label?: string; ops: Op[] }
export interface NodeField { kind: "node"; label?: string; node: HTMLElement | null }
export type Field = StripField | SayField | OpsField | NodeField;

export interface Op {
  k: string;
  word: string;
  aria?: string;
  /** a refused op: greyed, aria-disabled, data-why, the reason on its name. */
  why?: string | null;
  act?: () => void;
}

/* ---- the record, as much of it as the table reads --------------------- */

export interface Section { id: string; role: string; bars: number;
                           nudge?: number; auto?: unknown[]; [k: string]: unknown }
export interface Voice { name: string; kind: "line" | "bass" | "drums" | string;
                         instrument?: unknown;
                         cast?: Record<string, unknown>;
                         material?: unknown;
                         development?: Record<string, unknown>;
                         cells?: Record<string, Record<string, unknown>>;
                         [k: string]: unknown }
export interface Doc { form: { sections: Section[] }; voices: Voice[];
                       [k: string]: unknown }

/** avail.js's own record for one question, as `shSpec` returns it. */
export interface Spec {
  key: string; label: string;
  value: unknown;
  why?: string | null;
  options?: { value: unknown; label: string; disabled?: boolean;
              why?: string | null; quiet?: boolean }[];
  set: (v: unknown) => void;
}
/** ...translated by ui/eight.js `wCell` into what a control needs. */
export interface WCell {
  key: string; value: unknown; label: string; derived: boolean;
  say?: string; why?: string | null;
  options: Choice[];
  set: (v: unknown) => void;
}

export interface LaneSpec { key: string; label: string;
                            table: Record<string, unknown>;
                            labels: Record<string, string>;
                            neutral?: string; none?: string }
export interface MasterRow { key: string; label: string;
                             table: Record<string, unknown>;
                             labels: Record<string, string> }
export interface PerfRow { key: string; short: string; label: string }

/* ---- the doors ------------------------------------------------------- */

export interface TableAPI {
  doc(): Doc;
  facing(): "sections" | "voices";
  setFacing(f: "sections" | "voices"): void;

  sh(key: string, scope: Record<string, unknown>, label: string | null): Spec | null;
  hasSheet(key: string, scope: Record<string, unknown>): boolean;
  wcell(sp: Spec): WCell;
  combo(sp: Spec): HTMLElement;

  voiceStrip(name: string): HTMLElement;
  voiceKnobs(name: string): { label: string; node: HTMLElement } | null;
  hasCrate(name: string): boolean;
  voiceCrate(name: string): HTMLElement;
  throat(vi: number): { word: string; own: string; words: string[] } | null;

  devSheetFor(kind: string): string;
  secName(i: number): string;
  roleWord(r: string): string;
  playsWhat(v: Voice): string;
  vpaintOf(vi: number): number | string | null;
  editSec(): number;
  playFrom(i: number): void;
  bassReads(): { lead: string; cell: string | null } | null;
  hasKind(k: string): boolean;
  lampFor(name: string): HTMLElement;
  previewOf(name: string): Node | null;
  provWord(name: string): string | null;

  cellWord(i: number, vi: number): string;
  written(i: number, vi: number): boolean;
  cellOf(i: number, vi: number, f: string): unknown;
  resolve(i: number, vi: number, f: string): unknown;
  rowOf?(i: number, f: string): unknown;
  castOf(vi: number, f: string): unknown;
  putCell(i: number, vi: number, f: string, val: unknown): void;
  putRow(i: number, f: string, val: unknown): void;
  putCast(vi: number, f: string, val: unknown): void;

  addSection(at: number): void;
  moveSection(i: number, d: number): void;
  dupSection(id: string): void;
  dropSection(id: string): void;
  repeatSection(id: string, n: number): void;
  dealRow(i: number): void;
  dealCol(vi: number): void;
  addVoice(kind: string): void;
  dropVoice(name: string): void;
  moveVoice(vi: number, d: number): void;
  soloVoice(name: string): void;
  clearCell(i: number, vi: number): void;
  copyCell(i: number, vi: number, way: "row" | "col"): void;
  /** PASTE IS FILL WITH ONE TARGET (2026-09-05). ui/eight.js `copyCellTo` is
   *  `copyCell`'s own body with the destination handed in: the same three maps,
   *  the same `normalize(); changed()`, so it is the same one write. */
  copyCellTo(i: number, vi: number, i2: number, vi2: number): void;
  makeQualities(name: string): { v: string; w: string; why?: string | null }[];
  makeXY(name: string, q: string): void;
  fillFromGenre(): void;
  reseed(): void;
  showBoard(name?: string): void;

  CELLAUTO?: LaneSpec[];
  CELLVEC?: LaneSpec[];
  MASTERROWS: MasterRow[];
  PERFROWS: PerfRow[];
  masterOf(k: string): string | null;
  setMaster(k: string, v: string | null): void;
  perfOf(k: string): unknown;
  putPerf(k: string, v: unknown): void;

  /* ---- THE TWO DOORS THE SONIC SPREADSHEET ADDED (2026-09-05) ---------
     TABLE.md 9a: *"UNDO / REDO at the document level, Cmd/Ctrl-Z, for every op
     — mandatory: spreadsheet users expect it and the page has only the
     producer's undo."* Neither is a new WRITE path: `snapshot` is a read and
     `evolve` is `CTX.evolve`, the door the seed strip and the atlas have used
     to hand the page a whole new document since the composer round — it
     normalises, recompiles and lands at the next bar exactly like every other
     op. The stack itself is in src/table/undo.ts and holds documents, not
     inverses, because an inverse per op is a second implementation of every
     op and this table has fourteen of them. */
  snapshot(): Doc;
  evolve(next: Doc): void;

  /* ---- THE SPECIAL ROWS' OWN DOORS (2026-09-06, TABLE.md 10b) ---------
     10a: *"Special rows are rows of the same sheet: TIME, RULES, PRODUCE are
     record-level and MERGED across the columns, expandable, chips inside."*
     A special row's SHEET is built out of the same four field kinds every
     other sheet on this surface is built out of, and the four below are the
     `node` kind — a caller's own widget, seated and never re-drawn, exactly as
     the voice's channel strip and the samples crate already are. They are the
     Time PANE's own builders with the pane taken off them: `#pan-tempo` is
     deleted and `timeAxis`/`alphaAxis` with it, so each of these is now the
     ONE place its widget is built, and every write is the write it always
     made (`DOC.time.bpm` + `changed()`, `NuAvail.SHEETS[...].set`,
     `setRubato`). */
  /** A MENU IN A SPECIAL ROW IS NOT A MENU IN A CELL. `combo()` above is
   *  `menuEl`, which is `compact: true` — *"the bare widget in a cell, a slot
   *  row or a bus plate"* — and `pick.ts` answers `tight` with a picker at
   *  every length, because a chip strip cannot live in a 63px bar column.
   *  A special row is the opposite case: it is a full-width line with a printed
   *  question over it, which is exactly where `pick.ts` says chips belong, and
   *  it is the widget `#pan-tempo` drew. So this door builds the SAME control
   *  through `selectField` (one owner, one look, one throw) and lifts the
   *  focusable element — the one carrying `data-sel`, whichever of the three
   *  widgets was picked — out of its wrapper, the way ui/rules.js has lifted
   *  one into a sentence since 2026-09-02. */
  menuWide(sp: Spec): HTMLElement;
  /** A HAND THAT OPENS A RECORD-LEVEL ROW IS NO LONGER STANDING IN A PLAYER.
   *  `tablePanel` re-lands the page's open voice or section by CLICKING its
   *  head after every rebuild, which is what makes a column sheet survive a
   *  write — and it would close a special row under the thumb on the first
   *  recompile. Measured, T10e/T10f/T10j: TIME shut itself the moment a meter
   *  word, a tempo mark or a rule wrote anything, but only after some earlier
   *  gesture had left a voice open. So opening TIME or RULES lets the landing
   *  go, which is the true state of things. */
  leaveLanding(): void;
  bpmNode(): HTMLElement;
  tempoNode(): HTMLElement;
  keyNode(): HTMLElement;
  changesNode(): HTMLElement;
  boardNode(): HTMLElement;
  /** the caption under the mode, on the three rows whose octave is not twelve
   *  equal semitones — null on the other nine (ui/eight.js `tuningSay`). */
  tuningSay(): string | null;
  rubatoOn(): boolean;
  setRubato(on: boolean): void;
  diatonicOn(): boolean;
  setDiatonic(on: boolean): void;

  /** the RULES row: ui/rules.js's whole sheet, built into a box of its own,
   *  through the same `apply()` -> `ctx.evolve` door it has used since
   *  2026-09-03. `rulesFace` is the collapsed line — how many sentences this
   *  hand has written and which one moved last. */
  rulesNode(): HTMLElement;
  rulesFace(): string;
}
