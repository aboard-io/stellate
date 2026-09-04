// nukernel/src/table/model.ts — WHAT EACH VECTOR SAYS, AND WHAT SAYING IT DOES.
//
// This is nukernel/ui/table.js's field half, ported to TypeScript with its
// addresses and its measurements intact. It builds the three VECTORS of
// TABLE.md 1 — the SECTION (a row), the VOICE (a column) and the CELL — as
// lists of fields, and the op grammar of 5 as lists of buttons. It draws
// nothing: grid.ts draws.
//
// THE SPLIT IS THE WHOLE POINT OF THE MIGRATION. Every `data-k` a gate reads
// is minted HERE, off a key the document or avail.js already owns, so the
// renderer underneath could change from an accordion to a spreadsheet without
// one address moving. T4-T8 read addresses; 9a changed the dynamics.
//
// IT IS NOT A SECOND VOCABULARY. Every word comes from `NuAvail.SHEETS`
// through the host's `sh()`, and every write lands through a door that already
// existed (document.js putCell/putRow, eight.js addSection/addVoice/...,
// push()/commit()/CTX.evolve for the recompile).

import type { TableAPI, Field, StripField, Op, Choice, LaneSpec,
               Section, Voice } from "./api.js";

/* ===== THE DRUMMER'S SIXTY-EIGHT, GROUPED BY WHAT THEY ACT ON ==========
   TABLE.md 6: *"the does-array sheet groups the 68 ops by what they act on —
   kick, snare, hats, toms and fills, dynamics, feel — one group open at a
   time, the active ops pinned at the top."*
   THE GROUPS ARE KITOPS' OWN COMMENT HEADINGS, read off kernel.js and written
   down rather than derived, because a comment is not data and a regex over a
   comment is worse than a list. The per-lane generated ops (`k.rot`, `s.thin`,
   `h.dens` and their eighteen siblings) go to the lane they name. ANY OP NOT
   NAMED HERE FALLS INTO `feel`, so a new KITOP appears with no edit here. */
const KITGROUPS: [string, string[]][] = [
  ["kick",  ["nokick", "kickdoubles", "four"]],
  ["snare", ["snareonly", "backbeat", "onthree", "stickside", "claps",
             "ghosts", "flams", "drags", "roll"]],
  ["hats",  ["nohats", "busy", "offbeat", "ride", "pedal", "opens", "shuffle"]],
  ["toms & fills", ["tomtime", "tomfill", "tomrun", "tomroll",
                    "crash", "crashback"]],
  ["dynamics", ["accents", "crescendo", "soft", "loud", "humanize"]],
  ["feel",  []],
];
const LANEOF: Record<string, string> = { k: "kick", s: "snare", h: "hats" };
function groupOf(op: string): string {
  const dot = String(op).indexOf(".");
  if (dot > 0) { const g = LANEOF[op.slice(0, dot)]; if (g) return g; }
  for (const [name, list] of KITGROUPS) if (list.includes(op)) return name;
  return "feel";
}

/* ===== THE REGISTERS AND THE ENTRIES A HAND SAYS ======================
   A REGISTER IS -4..3 AND THE RANGE IS NOT THIS FILE'S TO CHOOSE.
   document.js `normalize` is the one owner of it and precompose 7b says what
   the units are. MEASURED 2026-09-04: the first draft offered semitones
   (-24...24), every chip outside -4..3 was written and then silently PRUNED on
   the next recompile, and the gate read the cell tier back empty — a control
   that writes and does not arrive. The list is the whole legal range. */
export const REGSTEPS = [-4, -3, -2, -1, 0, 1, 2, 3];
export const BARSTEPS = [1, 2, 4, 8, 12, 16, 24, 32];
export const REPEATS  = [2, 3, 4];

/* WHICH VOCABULARIES ARE MENUS AND NOT STRIPS OF WORDS, and the list is not
   this file's opinion: test/selects.js's `MENUS` is the one owner of the
   controls Paul named on 2026-09-02 (*"The combo boxes just don't work"*).
   The FIFTH rule is a measurement rather than a name: a strip longer than
   twenty-four words is a page of words. Everything shorter is chips.
   AND SINCE 2026-09-05 THE CHOICE HAS ONE OWNER AND A THIRD ANSWER — see
   `pickerFor` below: chips <= 8 words, the native picker on a coarse pointer,
   the typed combo on a desktop keyboard (TABLE.md 9b). */
export const COMBOKEYS = new Set(["cast.part", "sound.instrument",
                                  "sound.bassinstrument", "sound.drumkit",
                                  "form.role"]);
/* ...AND THE TWO NUMBERS ARE `src/menus/pick.ts`'s SINCE 2026-09-06. They were
   declared here and read by `sheet.ts`; they are the menu rule's own constants
   and the menu rule has one owner now. Re-exported under their old names so no
   reader of this module loses them. */
import { LONGSTRIP, CHIPMAX } from "../menus/pick.js";
export { LONGSTRIP, CHIPMAX };

/** THE TWO CHAIRS THAT VOICE THE BAR'S CHORD rather than reading a subject.
 *  `kernel.js render` takes the chord branch for `part === "pad"` and for any
 *  part whose PARTS row sets `chordLock` — today `stab` and nothing else — and
 *  that branch `continue`s before the articulation is read. */
const CHORDCHAIRS = new Set(["pad", "stab"]);

/* ===================================================================== */
/* ---- the field builders: one shape, three sources -------------------- */

/** A field off an avail.js sheet — the ordinary case, and the only one that
 *  needs no vocabulary of its own. `label` null means "the sheet's own". */
export function shField(A: TableAPI, key: string,
                        scope: Record<string, unknown>,
                        label: string | null): Field {
  const sp = A.sh(key, scope, null);
  if (!sp) return { kind: "say", label: label || key, word: "—",
                    why: "no vocabulary owner for " + key };
  const w = A.wcell(sp);
  const base: StripField = {
    key: w.key, label: label || sp.label, word: w.label,
    value: w.value == null ? "" : String(w.value),
    derived: w.derived, why: w.why || null,
    options: w.options,
    set: (v: string) => w.set(v),
    clear: w.derived ? null : () => w.set(""),
  };
  /* A MENU IS THE CALLER'S OWN CONTROL. The four MENUS keys and anything over
     twenty-four words keep ui/selects.js's widget at its own `data-sel`
     address, so a menu inside a sheet is the SAME control test/selects.js has
     always driven — the table seats it, it does not re-draw it. */
  if (COMBOKEYS.has(key) || (sp.options || []).length > LONGSTRIP)
    return { ...base, node: A.combo(sp) };
  return base;
}

/** A NUMBER SAID AS WORDS. There is no `<input type=range>` anywhere on this
 *  surface, and that is 6's law rather than a taste: *"A control that only
 *  works with a pointer is a refused control."* */
export function numField(A: TableAPI, key: string, label: string,
                         cur: number | string, steps: number[],
                         set: (v: string) => void,
                         clearable: boolean, noneWord?: string): StripField {
  const has = cur !== "" && cur != null;
  const list = steps.slice();
  if (has && !list.includes(+cur)) list.push(+cur);
  list.sort((a, b) => a - b);
  return { key, label,
    word: has ? String(cur) : (noneWord || "—"),
    value: has ? String(cur) : "",
    derived: !has,
    options: [...(clearable ? [{ v: "", w: noneWord || "none" } as Choice] : []),
              ...list.map((n) => ({ v: String(n), w: String(n) } as Choice))],
    set,
    clear: (clearable && has) ? () => set("") : null };
}

/** A CELL OVERRIDE OF A COLUMN DEFAULT — 2 drawn as a control. The word it
 *  prints when nothing is written here is what it INHERITS, drawn quiet; the
 *  clear-back appears the moment a hand writes. */
function cellNum(A: TableAPI, i: number, vi: number, field: string,
                 label: string, steps: number[]): StripField {
  const own = A.cellOf(i, vi, field) as number | null;
  const inh = A.resolve(i, vi, field) as number | null;
  const has = own != null;
  const list = steps.slice();
  for (const n of [own, inh]) if (n != null && !list.includes(+n)) list.push(+n);
  list.sort((a, b) => a - b);
  return { key: "tcellnum|" + field + "|" + vi + "|" + i, label,
    word: has ? String(own) : (inh == null ? "—" : String(inh)),
    value: has ? String(own) : "",
    derived: !has,
    sub: has ? null : "the column's",
    options: [{ v: "", w: "the column's" },
              ...list.map((n) => ({ v: String(n), w: String(n) } as Choice))],
    set: (v: string) => A.putCell(i, vi, field, v === "" ? null : +v),
    clear: has ? () => A.putCell(i, vi, field, null) : null };
}

/** ONE LANE OF A CELL'S MIX AUTOMATION, RELATIVE TO THE SECTION'S (wave 3).
 *  A CELL LANE HAS NO INHERITED VALUE: an OFFSET whose absent state was
 *  anything but zero would be a second curve, so the quiet word is "rides the
 *  section". THE NEUTRAL WORD IS NOT OFFERED — each lane's table carries one
 *  word worth 0 and `cellAutoClean` drops it, so a chip for it would write and
 *  vanish on the next recompile (1b's register bug, shipped twice). ONE WRITE,
 *  THROUGH THE ONE DOOR: the whole map is read, one key changed, `putCell`
 *  handed the result. */
function cellLane(A: TableAPI, i: number, vi: number, spec: LaneSpec): StripField {
  const read = () => (A.cellOf(i, vi, "mixauto") as Record<string, string>) || {};
  const now = read()[spec.key];
  const cur = now == null ? "" : String(now);
  const has = cur !== "";
  const put = (w: string) => {
    const next: Record<string, string> = { ...read() };
    if (w === "") delete next[spec.key]; else next[spec.key] = w;
    A.putCell(i, vi, "mixauto", Object.keys(next).length ? next : null);
  };
  const words = Object.keys(spec.table).filter((k) => spec.table[k]);
  return { key: "tcellauto|" + spec.key + "|" + vi + "|" + i,
    label: "mix · " + spec.label,
    word: has ? (spec.labels[cur] || cur) : "rides the section",
    value: cur,
    derived: !has,
    sub: has ? null : "the section's own lane, unchanged",
    options: [{ v: "", w: "rides the section" },
              ...words.map((k) => ({ v: k, w: spec.labels[k] || k } as Choice))],
    set: (v: string) => put(v || ""),
    clear: has ? () => put("") : null };
}

/** ONE OF THE FIVE 1 MOVED FROM THE BOX TO THE CELL (wave 4).
 *  THE DEFAULT IS THE ROW'S, NOT THE COLUMN'S — an articulation is not a fact
 *  about a chair for the whole record, a register is. NO `why` ON A LIVE
 *  STRIP: `why` is the REFUSAL reason everywhere on this surface, so passing
 *  the field's question there would draw four working controls as four dead
 *  ones. */
function cellVecField(A: TableAPI, i: number, vi: number, spec: LaneSpec): StripField {
  const own = A.cellOf(i, vi, spec.key) as string | null;
  const row = A.rowOf ? A.rowOf(i, spec.key) as string | null : null;
  const has = own != null && own !== "";
  const wordOf = (k: unknown) => (k == null || k === "" ? null
    : String(spec.labels[String(k)] || k));
  const words = Object.keys(spec.table).filter((k) => k !== spec.neutral);
  return { key: "tcellvec|" + spec.key + "|" + vi + "|" + i,
    label: spec.label,
    word: has ? wordOf(own) : (wordOf(row) || "as the genre asks"),
    value: has ? String(own) : "",
    derived: !has,
    sub: has ? null : (spec.none || "the row's"),
    options: [{ v: "", w: spec.none || "the row's" },
              ...words.map((k) => ({ v: k, w: String(spec.labels[k] || k) } as Choice))],
    set: (v: string) => A.putCell(i, vi, spec.key, v === "" ? null : v),
    clear: has ? () => A.putCell(i, vi, spec.key, null) : null };
}

/** THE RAMP LIMIT'S REFUSAL, IN ONE SPELLING, BECAUSE TWO TIERS PRINT IT.
 *  MEASURED 2026-09-04 and re-measured over the whole catalogue 2026-09-05:
 *  `document.js toPhrase` returns `inc: z(n), stk: z(n)` unconditionally
 *  (document.js:581), so `kernel.js rampOf`'s raw ramp is `(0 + 0) * loop` and
 *  a limit has nothing to limit — 0 of 18,793 motif phrases across 479 anchors
 *  at three readings carries a ramp column, and `nukernel/gates.json`'s own
 *  census says the same from the other end (`form.clamp`, 165 rows, 0 alive).
 *  test/table.test.js T4m fails the day a ramp column lands. */
const RAMPWHY =
  "measured 2026-09-05: a document's motifs carry no ramp — document.js " +
  "toPhrase writes inc and stk all-zero on every phrase, so 0 of 18,793 " +
  "motifs across 479 anchors at three readings has a ramp for a limit to " +
  "limit. It is the tracker's control; the address is kept, and the gate " +
  "lights it the day a ramp column lands";

/** ...AND THE ONE OF THE FIVE THAT IS TOLD RATHER THAN ASKED, with the
 *  measurement that makes it a sentence. */
function cellVecSay(A: TableAPI, i: number, vi: number, spec: LaneSpec,
                    chordChair: boolean): Field {
  const own = A.cellOf(i, vi, spec.key);
  const row = A.rowOf ? A.rowOf(i, spec.key) : null;
  const said = own != null ? own : row;
  return { kind: "say", label: spec.label,
    word: said == null ? "as the genre asks"
                       : String(spec.labels[String(said)] || said),
    why: chordChair
      ? "measured 2026-09-04: this chair voices the bar's CHORD (kernel.js " +
        "render sends a pad and any chordLock part down the chord branch), " +
        "so it never reads an articulation or a subject alphabet — its " +
        "octave and its time still answer. Give it a line part to say this."
      : RAMPWHY };
}

/** THE SAME SENTENCE ON THE ROW (2026-09-05). The row tier of the five landed
 *  as five strips, and four of them reach the sound; the fifth WROTE
 *  `section.clamp`, resolved through `document.js toGenre` onto `incClamp`,
 *  reached `kernel.js rampOf` and moved nothing — a control that writes and
 *  does not arrive, which is the one bug this tree keeps. It is the cell's own
 *  treatment (`cellVecSay`) applied one tier up, and the refused-control law
 *  rather than a silence or a grey: no silent grey, a sentence with the
 *  measurement on it. `avail.js` mints no `form.clamp` sheet at all, so there
 *  is no writable strip anywhere on the page to disagree with this. */
function rowVecSay(A: TableAPI, i: number, spec: LaneSpec): Field {
  const said = A.rowOf ? A.rowOf(i, spec.key) : null;
  return { kind: "say", label: spec.label,
    word: said == null ? "as the genre asks"
                       : String(spec.labels[String(said)] || said),
    why: RAMPWHY };
}

/** THE DRUMMER'S GROUPS, built from the options the sheet actually offers so a
 *  refused word keeps its refusal and an empty group is not drawn. */
function groupsFor(options: Choice[]): { word: string; vals: string[] }[] {
  const by = new Map<string, string[]>();
  for (const o of options) {
    if (o.v === "" || o.v == null) continue;
    const g = groupOf(String(o.v));
    if (!by.has(g)) by.set(g, []);
    by.get(g)!.push(String(o.v));
  }
  const out: { word: string; vals: string[] }[] = [];
  for (const [name] of KITGROUPS) if (by.has(name)) out.push({ word: name, vals: by.get(name)! });
  for (const [name, vals] of by) if (!out.find((x) => x.word === name)) out.push({ word: name, vals });
  return out;
}

/* ===================================================================== */
/* ---- the three vectors ----------------------------------------------- */

export function rowSheet(A: TableAPI, i: number): Field[] {
  const secs = A.doc().form.sections;
  const s = secs[i]!;
  const sid = s.id;
  const f: Field[] = [];
  /* THE ROW'S OWN OPS COME FIRST (2026-09-05). Paul: *"I click band and all
     further operations are buttons around the table."* They are on the header
     menu and on the header buttons too; the formula bar carries them because
     the formula bar is what a phone opens. */
  f.push({ kind: "ops", label: "this section", ops: rowOps(A, i, s) });
  f.push(shField(A, "form.role", { section: sid }, "type"));
  f.push(numField(A, "bars|" + sid, "bars", s.bars, BARSTEPS,
    (v) => A.putRow(i, "bars", +v), false));
  for (const [key, lab] of [["form.lvl", "level"], ["form.env", "shape"],
                            ["form.intro", "intro"], ["form.outro", "outro"],
                            ["form.mot", "motion"], ["form.pace", "pace"],
                            ["development.period", "period"],
                            ["development.breath", "breath"],
                            ["development.pipe", "pipe"]] as [string, string][])
    f.push(shField(A, key, { section: sid }, lab));
  /* THE ROW'S OWN HARMONY AND FEEL (wave 2a's five). They resolve
     row-before-record, so the WORD a row prints when it says nothing is the
     RECORD's word and the row is drawn quiet — which is 2 exactly. */
  for (const [key, lab] of [["form.key", "key"], ["form.mode", "mode"],
                            ["form.prog", "changes"], ["form.swing", "swing"],
                            ["form.groove", "groove"]] as [string, string][])
    f.push(shField(A, key, { section: sid }, lab));
  /* ...AND ITS CHAIN AND ITS ROOM (wave 2a's six). */
  for (const [key, lab] of [["form.fx", "chain"], ["form.rev", "reverb"],
                            ["form.echo", "echo"], ["form.dtime", "echo time"],
                            ["form.room", "room"], ["form.pan", "across"]] as [string, string][])
    f.push(shField(A, key, { section: sid }, lab));
  /* THE FIVE THE ROW HAD AN ADDRESS AND A RESOLVER FOR AND NO CONTROL (wave 4
     named this gap itself: "`avail.js ROWFACTS` does not name them, so the row
     sheet draws no strip … it is five lines there when somebody wants it").
     Somebody wants it: 9a's fill-down writes a column of cells where a row
     word would do, and a spreadsheet whose row header cannot say what the
     cells override is a ladder with a rung missing. They are asked through the
     same `sh()` as everything else, so if avail.js has not minted the sheet
     the row is simply not drawn — no second vocabulary. */
  for (const spec of (A.CELLVEC || [])) {
    /* ...FOUR OF THEM. `clamp` is the ROW's sentence for exactly the reason it
       is the cell's (`rowVecSay` / `RAMPWHY` carry the measurement): the row's
       word writes `section.clamp`, resolves onto the compiled genre's
       `incClamp`, reaches `kernel.js rampOf` — and moves no note, because no
       document phrase has a ramp for it to limit. */
    if (spec.key === "clamp") { f.push(rowVecSay(A, i, spec)); continue; }
    if (A.hasSheet("form." + spec.key, { section: sid }))
      f.push(shField(A, "form." + spec.key, { section: sid }, spec.label));
  }
  f.push(numField(A, "nudge|" + sid, "starts at", (s.nudge as number) || 0,
    [0, 1, 2, 3, 4, 6, 8], (v) => A.putRow(i, "nudge", +v), true));
  /* THE COMPILED LANES ARE READ-ONLY ON THE ROW (1: "written by mot and by
     cells"), and saying so is the refused-control law rather than a silence. */
  const auto = (s.auto as unknown[]) || [];
  f.push({ kind: "say", label: "automation",
    word: (auto.length ? auto.length + " lanes" : "none"),
    why: "compiled from the motion above — a cell's own lane is an offset on it" });
  return f;
}

export function colSheet(A: TableAPI, vi: number): Field[] {
  const v = A.doc().voices[vi]!;
  const f: Field[] = [];
  f.push({ kind: "ops", label: "this player", ops: colOps(A, vi, v) });
  if (v.kind === "line") f.push(shField(A, "cast.part", { voice: v.name }, "plays"));
  const ik = v.kind === "bass" ? "sound.bassinstrument"
           : v.kind === "drums" ? "sound.drumkit" : "sound.instrument";
  f.push(shField(A, ik, { voice: v.name }, v.kind === "drums" ? "machine" : "instrument"));
  /* IS THERE A DRUMMER AT ALL — `cast.on`. avail.js `f["voice.on"]` is read off
     it and greys all sixty-eight kit words when it is false, so deleting this
     would leave a record with a drummer nobody could sit out. Said in two words
     rather than as a tick, which is this surface's law. */
  if (v.kind === "drums") {
    const on = A.castOf(vi, "on") !== false;
    f.push({ key: "drums", label: "drummer",
             word: on ? "playing" : "sitting out",
             value: on ? "1" : "",
             derived: false,
             options: [{ v: "1", w: "playing" }, { v: "", w: "sitting out" }],
             set: (x: string) => A.putCast(vi, "on", !!x) });
  }
  /* ...AND ITS FILES, DIRECTLY UNDER IT. The samples crate is not a vector and
     has no cell, so it comes here WHOLE, under the instrument it swaps, and is
     absent on a chair no recording plays. */
  if (A.hasCrate(v.name))
    f.push({ kind: "node", label: "its files", node: A.voiceCrate(v.name) });
  if (v.kind === "line") f.push(shField(A, "cast.material", { voice: v.name }, "reads by default"));
  if (v.kind === "bass") f.push(shField(A, "cast.bassStyle", { voice: v.name }, "does by default"));
  for (const k of ["sound.attack", "sound.release", "sound.double", "sound.looping"])
    if (A.hasSheet(k, { voice: v.name })) f.push(shField(A, k, { voice: v.name }, null));
  /* THE MODELLED CHAIR'S OWN THROAT — VOICE.md's knob table and its tract pad.
     Null on a chair that has nothing to turn (a recording has one breath). */
  const kn = A.voiceKnobs(v.name);
  if (kn) f.push({ kind: "node", label: kn.label, node: kn.node });
  /* ...AND WHOSE THROAT IT IS. A COLUMN FIELD (document.js TIERS.voice); the
     case that asked for it is a choir. DERIVED WHEN THE CHAIR HAS NOT SPOKEN,
     and the word it prints is then the ROW's — clearing does not silence the
     singer, it hands the question back to the genre. */
  const th = A.throat(vi);
  if (th) f.push({ key: "throat|" + v.name, label: "sings as",
    word: th.word, value: th.own, derived: !th.own,
    options: [{ v: "", w: "the record's" },
              ...th.words.map((w) => ({ v: w, w } as Choice))],
    set: (x: string) => A.putCast(vi, "voice", x || null),
    clear: th.own ? () => A.putCast(vi, "voice", null) : null });
  /* THE COLUMN DEFAULTS A CELL MAY OVERRIDE (1: "the column DEFAULT; a cell
     may override"). Written here, they move every cell that says nothing. */
  const reg = A.castOf(vi, "reg");
  f.push(numField(A, "reg|" + v.name, "register",
    reg == null ? "" : (reg as number),
    REGSTEPS, (x) => A.putCast(vi, "reg", x === "" ? null : +x), true,
    "the genre's"));
  const en = A.castOf(vi, "entry");
  f.push(numField(A, "entry|" + v.name, "enters at bar",
    en == null ? "" : (en as number),
    [0, 1, 2, 4, 8], (x) => A.putCast(vi, "entry", x === "" ? null : +x), true,
    "bar one"));
  /* WHERE IT SITS IN THE MIX IS THE MIX ROW NOW (2026-09-07, §10b step 3).
     `f.push({ kind: "node", label: "seat", node: A.voiceStrip(v.name) })`
     STOOD HERE and was right for one round: the board had bus strips and the
     automation grid and NO per-voice channel (Paul took the voices off it on
     2026-08-28), so the fader, the pan, the sends and the three insert slots
     had exactly one home and the column sheet was it. §10a gives them their
     own: *"MIX is ALIGNED — one channel strip per voice column"*, which is the
     cell directly under this column in the footer. The strip did not move —
     it is `voiceMix` in both cases, one drawing — but it is drawn in ONE place
     now, and this row is the pointer that says where.
     THE POINTER IS THE `tseat|<voice>` OP IT ALWAYS WAS, one word wider: it
     used to open the Mix TAB (which is deleted) and it opens the seat's own
     cell instead. */
  f.push({ kind: "ops", label: "the desk", ops: [
    { k: "tseat|" + v.name, word: "its seat on the mix row",
      aria: v.name + " — its fader, pan, sends, EQ and inserts, in the mix row",
      act: () => A.showSeat(v.name) },
    { k: "tbuses|" + v.name, word: "the buses",
      aria: v.name + " — the buses its sends feed, on the board",
      act: () => A.showBoard() } ] });
  return f;
}

export function cellSheet(A: TableAPI, i: number, vi: number): Field[] {
  const doc = A.doc();
  const s = doc.form.sections[i]!, v = doc.voices[vi]!;
  const sid = s.id;
  const f: Field[] = [];
  f.push({ kind: "ops", label: "this cell", ops: cellOps(A, i, vi) });
  /* 1 · THE MOTIFS, WITH THEIR PREVIEWS AND THEIR PROVENANCE (3). One control
     and not two: the chips ARE the motif list, each wearing its own preview and
     the word that says where it came from.
     ...EXCEPT FOR A BASS, WHICH IS TOLD RATHER THAN ASKED, AND IS TOLD SO. Both
     compilers hand `K.bass` the FIRST LINE's compiled phrase, so a bass cell
     that named a motif would name it into nothing. An honest sentence beats a
     dead control. */
  if (v.kind === "bass") {
    const b = A.bassReads();
    f.push({ kind: "say", label: "motifs",
      word: b && b.cell ? b.cell + " · " + b.lead + "'s" : "the first line's",
      why: "the bass takes its accents from the first line's phrase " +
           "(document.js scoreOf, ui/derive.js sectionEvents), so it reads " +
           "what " + ((b && b.lead) || "that line") + " reads. Give it a " +
           "motif of its own by changing that cell." });
  }
  const reads = v.kind === "bass" ? null
    : A.sh("material.cell", { voice: v.name, section: sid },
           v.name + " reads · " + A.secName(i));
  if (reads) {
    const w = A.wcell(reads);
    /* THE PICTURE AND THE PROVENANCE RIDE ON THE MOTIFS ONLY. The first option
       is the ABSENT detent — "—", the column's own answer — and it names no
       motif, so asking the bank where it came from returned "hand". */
    const options = w.options.map((o) => (o.v === "" || o.v == null ? o : { ...o,
      pv: A.previewOf(String(o.v)), prov: A.provWord(String(o.v)) }));
    /* AN INHERITED MOTIF PRINTS WHAT IT INHERITS, QUIETLY — 2: "an inherited
       value is drawn quiet", not an em dash. `cellWord` is the same reader the
       grid's own cell uses, so the sheet and the cell can never disagree. */
    f.push({ key: w.key, label: "motifs",
             word: w.derived ? A.cellWord(i, vi) : w.label,
             value: w.value == null ? "" : String(w.value),
             derived: w.derived, options, set: (x: string) => w.set(x),
             why: w.why || null,
             clear: w.derived ? null : () => w.set("") });
  }
  /* 2 · WHAT IT DOES HERE. For a drummer that is an array out of the
     sixty-eight, grouped; for anybody else it is the development word. */
  const dev = A.sh(A.devSheetFor(v.kind), { voice: v.name, section: sid },
                   v.name + " does · " + A.secName(i));
  if (dev) {
    const w = A.wcell(dev);
    const fld: StripField = { key: w.key, label: "does", word: w.label,
                  value: w.value == null ? "" : String(w.value),
                  derived: w.derived, options: w.options,
                  set: (x: string) => w.set(x), why: w.why || null,
                  clear: w.derived ? null : () => w.set("") };
    if (v.kind === "drums") fld.groups = groupsFor(w.options);
    f.push(fld);
  }
  /* 3 · THE TWO COLUMN DEFAULTS A CELL MAY OVERRIDE (wave 1's cell tier). */
  f.push(cellNum(A, i, vi, "entry", "enters at bar", [0, 1, 2, 4, 8]));
  f.push(cellNum(A, i, vi, "reg", "register", REGSTEPS));
  /* 4 · FOCUS — stored, resolved, and reaching nothing, which 1a measured and
     T2e pins. A control that pretended otherwise would be the
     declared-but-never-arriving bug drawn on purpose. */
  f.push({ kind: "say", label: "focus",
    word: A.cellOf(i, vi, "focus") ? "featured" : "no",
    why: "measured 2026-09-04: box.focus indexes a one-entry stack and " +
         "moves no event — the gate names it the day a reader lands" });
  /* 5 · THE CELL'S MIX LANE, RELATIVE TO THE ROW'S (wave 3). */
  for (const spec of (A.CELLAUTO || [])) f.push(cellLane(A, i, vi, spec));
  /* 6 · THE FIVE THAT WERE PER BOX (wave 4), FOUR STRIPS AND ONE SENTENCE, AND
     THEY ARE THE PITCHED CHAIRS' ALONE. All five are read inside `kernel.js
     render`, which is what a LINE plays; the kit is `K.drums` and the bass is
     `K.bass`, each with its own words for the same ideas. */
  if (v.kind === "line") {
    const chordChair = CHORDCHAIRS.has(String(A.castOf(vi, "part") || ""));
    for (const spec of (A.CELLVEC || []))
      f.push((spec.key === "clamp" ||
              (chordChair && (spec.key === "artic" || spec.key === "scale")))
        ? cellVecSay(A, i, vi, spec, chordChair && spec.key !== "clamp")
        : cellVecField(A, i, vi, spec));
  }
  else f.push({ kind: "say", label: "artic · oct · rate · scale · clamp",
    word: "the pitched chairs'",
    why: "measured 2026-09-04: all five are read inside kernel.js render, " +
         "which is what a LINE plays — the kit is K.drums and the bass is " +
         "K.bass, and each has its own words for the same ideas (the kit's " +
         "halftime/doubletime, the bass's own artic and register)" });
  return f;
}

/* ---- the record's own footer (1 RECORD) ------------------------------ */

/* (`masterCells(A)` STOOD HERE — seven `tmaster|<key>` strip fields off
   `A.MASTERROWS`, written through `A.setMaster`. They were the `tfoot|master`
   row's cells, and MEASURED on the rendered page they were the SECOND control
   for each of the seven: ui/engineer.js's main plate draws `master|<key>` for
   every one of them and writes through the same `NuDeskDoc.writeMaster`. The
   MIX row's corner opens that plate now (§10b step 3, 2026-09-07), so the fact
   has one control again and the seven strip fields are gone with the row that
   held them. `A.MASTERROWS` and `A.masterOf` survive as the corner's FACE —
   `special.ts masterFace` — because saying what the master is standing on is
   not offering to change it.) */

/** THE PERFORMANCE CELLS KEEP THE SHEET'S OWN ADDRESS, and that is a fix with a
 *  date on it (2026-09-04): re-keying them `tperf|<short>` MOVED THREE
 *  ADDRESSES that three gates drive by name. An address does not move when a
 *  row does. */
export function perfCells(A: TableAPI): Field[] {
  return A.PERFROWS.map((p) => {
    const sp = A.sh(p.key, {}, p.label);
    if (!sp) return { kind: "say", label: p.label, word: "—" } as Field;
    const w = A.wcell(sp);
    return { key: w.key, label: p.label, word: p.short + " " + w.label,
             value: w.value == null ? "" : String(w.value),
             derived: w.derived, options: w.options,
             set: (x: string) => w.set(x), why: w.why || null,
             clear: w.derived ? null : () => w.set("") } as Field;
  });
}

export function perfSheet(A: TableAPI): Field[] {
  return [
    /* A TAKE IS ONE WHEN NOTHING IS SAID, NOT NOUGHT (fixed 2026-09-04). It
       read `|| 0`, so an untouched record printed "0" and the strip grew a
       `take|0` chip — a word a hand could tap that writes a take the record
       cannot hold (`takeSeed` is `Math.max(1, take|0)`). */
    numField(A, "take", "take", (A.perfOf("take") as number) || 1,
      [1, 2, 3, 4, 5, 6, 8, 12], (v) => A.putPerf("take", +v), false),
    numField(A, "humanize", "humanize",
      A.perfOf("humanize") == null ? "" : (A.perfOf("humanize") as number),
      [0, 0.2, 0.4, 0.6, 0.8, 1],
      (v) => A.putPerf("humanize", v === "" ? null : +v), true, "the genre's"),
    { key: "ontime", label: "on time",
      word: A.perfOf("ontime") ? "dead on the grid" : "as the band plays",
      value: A.perfOf("ontime") ? "1" : "",
      derived: !A.perfOf("ontime"),
      options: [{ v: "", w: "as the band plays" },
                { v: "1", w: "dead on the grid" }],
      set: (v: string) => A.putPerf("ontime", v ? true : null),
      clear: A.perfOf("ontime") ? () => A.putPerf("ontime", null) : null },
  ];
}

/* (`masterSheet` STOOD HERE — a `say` line naming the seven words followed by
   `...masterCells(A)` — and it was the `tfoot|master` row's sheet. The MIX row
   is the master's cell now (§10b step 3, 2026-09-07) and `special.ts
   masterMixSheet` is what opens: the same seven `masterCells`, then the board.
   The `say` line came off with the row it captioned — the seven words are no
   longer "the cells across this row", they are the sheet itself, and a caption
   that describes furniture that is gone is the prose test/text-diet.test.js
   takes off.) */

/* ===================================================================== */
/* ---- the op grammar (5), every one of them one existing door --------- */

export function rowOps(A: TableAPI, i: number, s: Section): Op[] {
  const n = A.doc().form.sections.length;
  return [
    /* PUT THE EAR HERE — Paul, B11: *"I need to be able to jump to a section
       somehow."* The five Structure grids answered that on their ROW HEADS and
       the head is a door on this table. `CTX.playFrom` is the one play door:
       cold it seeks, playing it QUEUES on the next box line. */
    { k: "trow-here|" + s.id, word: "put the ear here",
      aria: "play from this section", act: () => A.playFrom(i) },
    { k: "trow-add", word: "+ section", aria: "add a section after this one",
      act: () => A.addSection(i + 1) },
    { k: "trow-up|" + s.id, word: "▲ up", aria: "move this section earlier",
      why: i === 0 ? "it is already first" : null, act: () => A.moveSection(i, -1) },
    { k: "trow-down|" + s.id, word: "▼ down", aria: "move this section later",
      why: i === n - 1 ? "it is already last" : null, act: () => A.moveSection(i, 1) },
    { k: "trow-dup|" + s.id, word: "duplicate", aria: "duplicate this section",
      act: () => A.dupSection(s.id) },
    ...REPEATS.map((r) => ({ k: "trow-rep|" + s.id + "|" + r, word: "×" + r,
      aria: "repeat this section " + r + " times", act: () => A.repeatSection(s.id, r) })),
    { k: "trow-deal|" + s.id, word: "deal again",
      aria: "deal this section's cells again from the genre",
      act: () => A.dealRow(i) },
    { k: "trow-del|" + s.id, word: "delete", aria: "delete this section",
      why: n <= 1 ? "a record needs one section" : null,
      act: () => A.dropSection(s.id) },
  ];
}

export function colOps(A: TableAPI, vi: number, v: Voice): Op[] {
  const n = A.doc().voices.length;
  return [
    { k: "tcol-solo|" + v.name, word: "▶ alone", aria: "play " + v.name + " alone",
      act: () => A.soloVoice(v.name) },
    { k: "tcol-add|line", word: "+ line", aria: "hire another line",
      act: () => A.addVoice("line") },
    { k: "tcol-add|bass", word: "+ bass", aria: "hire a bass",
      why: A.hasKind("bass") ? "the record already has a bass" : null,
      act: () => A.addVoice("bass") },
    { k: "tcol-add|drums", word: "+ drums", aria: "hire a drummer",
      why: A.hasKind("drums") ? "the record already has a drummer" : null,
      act: () => A.addVoice("drums") },
    { k: "tcol-left|" + v.name, word: "◀ left", aria: "move this player left",
      why: vi === 0 ? "it is already first" : null, act: () => A.moveVoice(vi, -1) },
    { k: "tcol-right|" + v.name, word: "right ▶", aria: "move this player right",
      why: vi === n - 1 ? "it is already last" : null, act: () => A.moveVoice(vi, 1) },
    { k: "tcol-deal|" + v.name, word: "deal again",
      aria: "deal this player's cells again from the genre",
      act: () => A.dealCol(vi) },
    /* "MAKE X Y" IS A COLUMN OP NOW (5). ui/produce.js owns the verb and its
       qualities; what the table adds is the X — the column you opened is the
       subject, so the sentence is already half said when you get there. */
    ...A.makeQualities(v.name).map((q) => ({ k: "tcol-make|" + v.name + "|" + q.v,
      word: q.w, aria: "make " + v.name + " " + q.w,
      why: q.why || null,
      act: () => A.makeXY(v.name, q.v) })),
    { k: "tcol-del|" + v.name, word: "remove", aria: "remove " + v.name + " from the band",
      why: n <= 1 ? "a band needs one player" : null,
      act: () => A.dropVoice(v.name) },
  ];
}

export function cellOps(A: TableAPI, i: number, vi: number): Op[] {
  const doc = A.doc();
  const v = doc.voices[vi]!, s = doc.form.sections[i]!;
  return [
    { k: "tcell-clear|" + v.name + "|" + s.id, word: "clear to inherit",
      aria: "clear everything written in this cell",
      why: A.written(i, vi) ? null : "nothing is written here",
      act: () => A.clearCell(i, vi) },
    /* FILL RIGHT AND FILL DOWN ARE 5's COPY-TO-ROW AND COPY-TO-COLUMN, said in
       a spreadsheet's own words (9a). One door each, unchanged. */
    { k: "tcell-copyrow|" + v.name + "|" + s.id, word: "fill across the row",
      aria: "give every player in this section what this cell says",
      act: () => A.copyCell(i, vi, "row") },
    { k: "tcell-copycol|" + v.name + "|" + s.id, word: "fill down the column",
      aria: "give this player the same thing in every section",
      act: () => A.copyCell(i, vi, "col") },
  ];
}

export function tableOps(A: TableAPI, across: boolean): Op[] {
  return [
    { k: "ttab-fill", word: "fill from a genre",
      aria: "start this record again from a genre", act: () => A.fillFromGenre() },
    { k: "ttab-seed", word: "re-seed",
      aria: "deal this record again at a new reading", act: () => A.reseed() },
    { k: "ttab-transpose", word: across ? "sections down" : "players down",
      aria: across ? "turn the table back: sections down the side"
                   : "turn the table round: players down the side",
      act: () => A.setFacing(across ? "sections" : "voices") },
  ];
}

/** THE OFFERS AT THE END OF EACH AXIS (9a: *"a `+` at the end of each axis adds
 *  a player or a section"*, and Paul's *"I should be able to add players
 *  without using the nav and sections too"*). They are build-the-band's own
 *  three offers at build-the-band's own three addresses — `tcol-add|line`,
 *  `tcol-add|bass`, `tcol-add|drums` — because an address does not move when a
 *  control does, and the nav's own `addvoice`/`addbass`/`adddrums` filed to
 *  these three in the T7 inventory the day the ops left the tray. */
export function playerOffers(A: TableAPI): Op[] {
  return [
    { k: "tcol-add|line", word: "+ line", aria: "hire another line",
      act: () => A.addVoice("line") },
    { k: "tcol-add|bass", word: "+ bass", aria: "hire a bass",
      why: A.hasKind("bass") ? "the record already has a bass" : null,
      act: () => A.addVoice("bass") },
    { k: "tcol-add|drums", word: "+ drums", aria: "hire a drummer",
      why: A.hasKind("drums") ? "the record already has a drummer" : null,
      act: () => A.addVoice("drums") },
  ];
}
export function sectionOffer(A: TableAPI): Op[] {
  const n = A.doc().form.sections.length;
  return [{ k: "trow-add", word: "+ section", aria: "add a section at the end",
            act: () => A.addSection(n) }];
}

export { groupsFor, cellNum, cellLane, cellVecField, CHORDCHAIRS };
