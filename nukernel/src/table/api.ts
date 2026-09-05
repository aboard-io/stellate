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
  /** WHICH KIND OF WORD THIS IS (2026-09-05, DESIGN.md component 16). It is
   *  avail.js's own `group` — the kernel's chord family, `instruments.js
   *  familyOf`, `genres-tables.js SCALEFAMILY` — carried through `wCell` at
   *  last. It was dropped there since the sheets shipped, which is why a
   *  forty-two-word quality picker arrived on this surface as a flat list. */
  g?: string | null;
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
  /** A CONTINUOUS NUMBER, AND IT GETS A SLIDER (2026-09-05). Paul: *"When you
   *  redesign think sliders and other UI for data entry."* A field that
   *  declares this is a NUMBER on a range — a register, a bar count, an entry
   *  bar — and `sheet.ts` draws it as a range slider with the value printed
   *  and TYPEABLE beside it, not as a row of chips. Words keep the chips:
   *  chips are a set of decisions, a slider is a quantity, and a quantity laid
   *  out as fourteen buttons is a ruler somebody has cut up.
   *  `options` STAYS on the field either way, because the address and the
   *  vocabulary are what T7 and the inventory read; the slider is a second
   *  widget on the same seam, not a second field. */
  num?: { min: number; max: number; step: number;
          /** what the number is in — "bars", "octaves", "" */
          unit?: string;
          /** the number that stands when nothing is written. */
          derivedNum?: number | null } | null;
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
/** WHICH GROUP A FIELD STANDS IN (2026-09-05, TABLE.md §11c). Paul: *"just
 *  nicely structure each expanded interface as proper software that's easy to
 *  scan and nicely grouped."* Every field carries the HEADING it stands under
 *  — already translated, because the group words are the composer's own
 *  (`Instrument · Envelope · Tone · Mix` for a chair, `Form · Time · Key ·
 *  Feel · Chain` for a section, `Phrase · Variation · Dynamics · Placement`
 *  for a cell) — and `sheet.ts sheetBody` chunks CONSECUTIVE fields that
 *  share one into a `.nu-sheetgroup` under a `.nu-grouphead`.
 *
 *  IT IS A PROPERTY AND NOT A NEW `kind`, and that is the whole reason the
 *  gates survive this round: a heading drawn as a FIELD would sit in
 *  `.nu-sheetrow`'s own list and every check that reads "the sheet's fields in
 *  order" (T5b, T5c, the inventory walk) would find headings among them. A
 *  wrapper element preserves document order exactly, so `querySelectorAll
 *  (".nu-sheetrow")` reads the same list it always did. */
export type Grouped = { group?: string | null };
export type Field = (StripField | SayField | OpsField | NodeField) & Grouped;

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

/** ONE MARK: the glyph, the word it stands for, and one clause of what it
 *  means. The three columns of ui/glyph.js's own table, unchanged — the word
 *  becomes the cell's hidden `.nu-vh` text and its accessible name, and the
 *  clause becomes `data-say`, which the page's ONE explainer (long-press or
 *  hover) speaks. A mark with no word would be a control with no name. */
export interface Mark { g: string; w: string; s?: string }

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
  /** THE CHAIR'S OWN ENVELOPE (2026-09-05, TABLE.md §11) — ui/eight.js's
   *  `voiceEnv`, which builds the ADSR editor (`nukernel/ui/envelope.js`) for
   *  a sampled chair off `voice.sound` and for a modelled one off the
   *  measured knobs.js rows. NULL where the instrument has no envelope to
   *  draw, so no chair gets a plate it cannot move. */
  voiceEnv(name: string): { label: string; node: HTMLElement } | null;
  /** A LANE A HAND DRAWS (2026-09-05, the review's item 10) — the same curve
   *  editor in its `lane` mode, ruled in the section's own bars, writing the
   *  whole point list through `putCell` / `putRow` on one settled gesture.
   *  NULL where the lane cannot be drawn, so no plate is offered on nothing. */
  cellLaneNode(si: number, vi: number, key: string): HTMLElement | null;
  rowLaneNode(si: number, param: string): HTMLElement | null;
  AUTOPARAMS?: Record<string, { lo: number; hi: number; curve: string }>;
  AUTOPARAMLABEL?: Record<string, string>;
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
  /** THE TABLE'S MARKS (2026-09-05). Paul: *"When you redesign use more icons.
   *  Ideally the table is a large set of icons."* ui/glyph.js is the one table
   *  of marks on this page and ui/eight.js is what knows which question a box
   *  of this table is asking; the component only draws what comes back.
   *  NULL means "no honest glyph for this value" and the cell prints its word,
   *  which is the boundary the ruling itself draws. */
  cellMark(i: number, vi: number): Mark | null;
  colMark(vi: number): Mark | null;
  rowMark(i: number): Mark | null;
  mixMark(name: string): Mark | null;
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
  /** open one player's seat — the MIX row's cell under that column. */
  showSeat(name: string): void;

  CELLAUTO?: LaneSpec[];
  CELLVEC?: LaneSpec[];
  MASTERROWS: MasterRow[];
  PERFROWS: PerfRow[];
  masterOf(k: string): string | null;
  /* (`setMaster(k, v)` STOOD HERE — the `tfoot|master` row's writer. The
     master's seven words are the MIX row's MASTER now and the CONTROL for
     each of them is ui/engineer.js's main plate, which writes through the
     same `NuDeskDoc.writeMaster`; two controls for one fact was what the
     page measured before this round, so the door with no drawing came off
     with the row. `masterOf` above stays: the master row's FACE reads it.) */
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
  /** the signature as two numbers — numerator over denominator, each a slider
   *  with the number typeable beside it (DESIGN.md component 8). The chips
   *  beside it are `time.meter`'s own vocabulary; these are the way to say a
   *  meter no chip names (2026-09-05: "like 21/17"). */
  meterNode(): HTMLElement;
  /** THE BAR, IN BEATS AND IN STEPS — what an ENTRY is measured in
   *  (2026-09-05, the review's item 4). `entry` is stored in BARS with a beat
   *  fraction (document.js's validator, kernel.js `entryBar`/`entryStep`) and
   *  the control that writes it is a slider in BEATS, so exactly one place
   *  needs to know the record's meter and this is the door to it:
   *  `beats` = how many felt beats a bar has (`steps / pulse`), `step` = the
   *  grid's own resolution in beats (`1 / pulse`), which is what the slider
   *  steps by so a hand can only land on a beat the box can count. */
  barBeats(): { beats: number; step: number };
  tempoNode(): HTMLElement;
  keyNode(): HTMLElement;
  /** the chord chart. With no argument it edits the RECORD's changes; with a
   *  section id it edits that ROW's own chart (the wave-2a `prog` override),
   *  drawn from the record's until the first write forks it. */
  changesNode(sid?: string): HTMLElement;
  boardNode(): HTMLElement;
  /** the caption under the mode, on the three rows whose octave is not twelve
   *  equal semitones — null on the other nine (ui/eight.js `tuningSay`). */
  tuningSay(): string | null;
  rubatoOn(): boolean;
  setRubato(on: boolean): void;
  diatonicOn(): boolean;
  setDiatonic(on: boolean): void;

  /* ---- THE MIX ROW'S OWN DOORS (2026-09-07, TABLE.md 10b step 3) ------
     10a: *"MIX is ALIGNED — one channel strip per voice column and the master
     in the corner."* `voiceStrip` above is already the strip and does not
     move; these two are what the ROW needs that a column sheet never did — a
     word for the collapsed cell, and the rack the MASTER opens (which is a
     merged row under the seats and not a corner cell: `src/table/grid.ts
     mixRow` carries the two measurements that put it there). The Mix PANE
     is deleted, so `boardRack()` is the ONE place `ui/engineer.js mount` is
     called and `#boardpanel` is built. */
  /** what this seat is doing on the desk, in the strip's own arithmetic
   *  (`faderDb` then `fmtDb`, plus mute / solo / no-channel). */
  mixWord(name: string): string;
  /** has a hand written anything on this seat? — the dim-is-derived reading
   *  every other cell on this surface makes, asked of the desk. */
  mixWritten(name: string): boolean;
  /** the board: the rack, its five plates and the row that switches them. */
  boardRack(): HTMLElement;

  /** the RULES row: ui/rules.js's whole sheet, built into a box of its own,
   *  through the same `apply()` -> `ctx.evolve` door it has used since
   *  2026-09-03. `rulesFace` is the collapsed line — how many sentences this
   *  hand has written and which one moved last. */
  rulesNode(): HTMLElement;
  rulesFace(): string;

  /* ---- THE MOTIFS ROW'S OWN DOORS (2026-09-08, TABLE.md §10b step 4) --
     §10a: *"MOTIFS is the bank across the top with previews and provenance,
     and tapping a motif points the SELECTED cell at it (the formula bar's own
     write)."* The row is MERGED like TIME and RULES, and its sheet is ONE
     node, for the reason `rulesSheet` is one node: what the sheet holds is
     either the BANK (a row per motif — ui/preview.js's picture, the name, the
     provenance word, who reads it, and an `open`) or, when a motif has been
     opened from it, that motif's own block — the rename field, the written
     staff, the bench, the fourteen transforms — and every one of those is a
     widget `ui/eight.js` already builds, keyed into playhead registries
     (`hookCells`, `stepCell`, `written`) that only that file owns. Re-typing
     any of it into `Field[]` would be a second owner of the motif editor. */
  /** the collapsed face: how many are in the bank and which one is open. */
  motifsFace(): string;
  /** THE BANK, OR THE MOTIF THAT WAS OPENED FROM IT. One node, built fresh on
   *  every open, because building it is what clears and refills the playhead's
   *  own registries. */
  motifsNode(): HTMLElement;
  /** the row's lamp — a `[data-live]` SIBLING of the head's button (never a
   *  child: a control inside a live surface is what test/motif-frozen A1
   *  forbids), carrying the name of the motif that is sounding. */
  motifLamp(): HTMLElement | null;
  /** POINT ONE CELL AT A MOTIF — the write the bank's name button makes, and
   *  it is `avail.js`'s own `material.cell` sheet and NOT `putCell`: that
   *  sheet is the one owner of which cells a voice of this kind may read (a
   *  drum cell is lanes and a line cell is degrees), of the absent detent, and
   *  of the write. The grid says WHICH cell, because the grid owns the
   *  selection; a bank with no cell selected ARMS the next tap instead. */
  pointCell(i: number, vi: number, name: string): void;

  /* ---- THE PRODUCE ROW'S OWN DOORS (2026-09-08, §10b step 5) ----------
     §10a: *"PRODUCE — the producer's deals and notes … MERGED, expandable"*,
     and the layout puts it under MIX in the footer rather than over the grid,
     because what the producer says is said ABOUT a record that is already
     dealt. One node again, and the same reason: `ui/produce.js mount` draws
     the deal tree, the adjective sheet with every withheld word greyed and its
     reason printed, the stack of ten notes with their percentages, and its own
     undo — none of which is a vector and none of which has a cell. */
  /** the collapsed face: the producer's last sentence, and how many stand. */
  produceFace(): string;
  /** `ui/produce.js mount`, seated. The Produce PANE is deleted, so this is
   *  the one place it is called. */
  produceNode(): HTMLElement;
}
