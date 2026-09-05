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
import { t, tn } from "../copy/global.js";

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
  /* NO SHEET OWNS THIS KEY. The control is drawn refused with a plain
     sentence rather than a silence (DESIGN.md §2.14); which key it was is a
     fact for a developer's console, not for a person reading a row. */
  if (!sp) return { kind: "say", label: label || key, word: "—",
                    why: t("sheet.noOwner.why") };
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
    options: [...(clearable ? [{ v: "", w: noneWord || t("value.none") } as Choice] : []),
              ...list.map((n) => ({ v: String(n), w: String(n) } as Choice))],
    /* ...AND IT IS A SLIDER (2026-09-05). Paul: *"When you redesign think
       sliders and other UI for data entry."* Every caller of this function
       hands it a QUANTITY on a run — a register from −4 to 3, a bar to come in
       at, a bar count — and the strip drew each one as a row of chips, which is
       a ruler cut into buttons. `options` stays, because the address and the
       vocabulary are what the inventory and T7 read; `num` is what
       `sheet.ts pickerFor` now answers "slider" to. The RANGE is the whole run
       and not just the offered steps, so the thumb can reach a number the
       chips never offered — which is what a slider is FOR. */
    num: { min: list.length ? list[0]! : 0,
           max: list.length ? list[list.length - 1]! : 1,
           step: 1, unit: "",
           derivedNum: has ? +cur : null },
    set,
    clear: (clearable && has) ? () => set("") : null };
}

/* ---- WHERE A PLAYER COMES IN, IN BEATS (2026-09-05, the review's item 4) --
   *"`enters at bar` is validated `Number.isInteger` … a pickup, a stretto, an
   answer on beat 3 cannot exist."* `entry` is stored in BARS with a beat
   fraction — one fact, one address, document.js's own validator — and the
   HAND counts in beats, so this is the one place the two units meet: the
   slider's min, max, step and printed number are beats, and `set` divides by
   the bar's beat count on the way to the document.

   THE STEP IS THE BAR'S OWN GRID, never a fixed quarter: `A.barBeats()` reads
   `steps / pulse` and `1 / pulse` off the record's meter, so in four-four the
   thumb lands every sixteenth (0.25 beats) and in 21/17 every notated beat.
   A hand can still type a number between two steps — document.js snaps it.

   EIGHT BARS' WORTH OF RUN, which is exactly the top the chips offered
   (`[0, 1, 2, 4, 8]` bars) said in the new unit; a value already written
   past it widens the range rather than being clipped, the same law
   `numField` keeps. */
const ENTRYBARS = 8;
function entryNum(A: TableAPI, cur: number | null, ghost: number | null) {
  const B = A.barBeats();
  const bpb = B.beats > 0 ? B.beats : 4;
  const toBeats = (bars: number) => Math.round((bars * bpb) / B.step) * B.step;
  const top = Math.max(ENTRYBARS * bpb,
    ...[cur, ghost].filter((x): x is number => x != null).map(toBeats));
  return { bpb, B, top, toBeats };
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
    sub: has ? null : t("value.defaultCap"),
    options: [{ v: "", w: t("value.default") },
              ...list.map((n) => ({ v: String(n), w: String(n) } as Choice))],
    /* THE CELL'S OVERRIDE IS A QUANTITY TOO, and the slider's ghost value is
       what the column deals — so pushing the thumb off the inherited number is
       visibly a departure from it. */
    num: { min: list.length ? list[0]! : 0,
           max: list.length ? list[list.length - 1]! : 1,
           step: 1, unit: "", derivedNum: inh == null ? null : +inh },
    set: (v: string) => A.putCell(i, vi, field, v === "" ? null : +v),
    clear: has ? () => A.putCell(i, vi, field, null) : null };
}

/** THE CELL'S OWN ENTRY, IN BEATS — the column default said again at the
 *  crossing (2 drawn as a control). The GHOST is what the column deals, so
 *  pushing the thumb off it is visibly a departure; the word it prints while
 *  nothing is written here is the inherited number, quiet. */
function cellEntry(A: TableAPI, i: number, vi: number): StripField {
  const own = A.cellOf(i, vi, "entry") as number | null;
  const inh = A.resolve(i, vi, "entry") as number | null;
  const E = entryNum(A, own, inh);
  const mine = own == null ? null : E.toBeats(own);
  const ghost = inh == null ? 0 : E.toBeats(inh);
  return { key: "tcellnum|entry|" + vi + "|" + i, label: t("col.entry"),
    word: String(mine == null ? ghost : mine),
    value: mine == null ? "" : String(mine),
    derived: mine == null,
    sub: mine == null ? t("value.defaultCap") : null,
    options: [{ v: "", w: t("value.default") } as Choice,
              ...[0, 1, 2, 4, 8].map((n) => ({ v: String(n * E.bpb),
                                               w: String(n * E.bpb) } as Choice))],
    num: { min: 0, max: E.top, step: E.B.step, unit: t("unit.beats"),
           derivedNum: ghost },
    set: (x: string) => A.putCell(i, vi, "entry", x === "" ? null : (+x) / E.bpb),
    clear: mine == null ? null : () => A.putCell(i, vi, "entry", null) };
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
  const read = () => (A.cellOf(i, vi, "mixauto") as Record<string, unknown>) || {};
  const now = read()[spec.key];
  /* ...OR A CURVE (2026-09-05, the review's item 10). A lane holds a WORD (one
     offset for the whole section) or a DRAWN line (`{points}`), and the strip
     is where a hand says which: the words, then `draw`. Choosing `draw` seeds
     the lane at the two ends of its own range — a real ramp, audible at once,
     rather than a flat line that would be a chip with extra syntax — and the
     plate for it is the field directly under this one (`cellSheet`). */
  const drawn = !!(now && typeof now === "object" &&
                   Array.isArray((now as { points?: unknown }).points));
  const cur = drawn ? DRAWWORD : (now == null ? "" : String(now));
  const has = cur !== "";
  const put = (w: string) => {
    const next: Record<string, unknown> = { ...read() };
    if (w === "") delete next[spec.key];
    else if (w === DRAWWORD) {
      const ns = Object.values(spec.table).map(Number).filter((n) => isFinite(n));
      const bars = Math.max(1, Number(A.doc().form.sections[i]!.bars) || 1);
      next[spec.key] = { points: [[0, Math.min(...ns)], [bars, Math.max(...ns)]] };
    } else next[spec.key] = w;
    A.putCell(i, vi, "mixauto", Object.keys(next).length ? next : null);
  };
  const words = Object.keys(spec.table).filter((k) => spec.table[k]);
  return { key: "tcellauto|" + spec.key + "|" + vi + "|" + i,
    label: t("cell.lane.label", { name: spec.label }),
    word: drawn ? t("lane.drawn") : has ? (spec.labels[cur] || cur) : t("value.default"),
    value: cur,
    derived: !has,
    /* NO CAPTION UNDER IT. The word IS "default" now, and a second line
       saying the same thing is the prose test/text-diet.test.js takes off. */
    sub: null,
    options: [{ v: "", w: t("value.default") },
              ...words.map((k) => ({ v: k, w: spec.labels[k] || k } as Choice)),
              { v: DRAWWORD, w: t("lane.draw") } as Choice],
    set: (v: string) => put(v || ""),
    clear: has ? () => put("") : null };
}
/** THE WORD THAT MEANS "NOT A WORD" — the strip's own name for the drawn
 *  state, kept out of the lane vocabularies so it can never collide with one
 *  (`fields.js CELLAUTO` owns those and none of them is a verb). */
const DRAWWORD = "draw";
function isDrawn(v: unknown): boolean {
  return !!(v && typeof v === "object" && !Array.isArray(v) &&
            Array.isArray((v as { points?: unknown }).points));
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
    word: has ? wordOf(own) : (wordOf(row) || t("value.default")),
    value: has ? String(own) : "",
    derived: !has,
    sub: has ? null : (spec.none || t("value.defaultCap")),
    options: [{ v: "", w: spec.none || t("value.default") },
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
/* THE MEASUREMENT LIVES HERE, IN THE CODE, AND NOT ON THE SCREEN:
   `document.js toPhrase` returns `inc: z(n), stk: z(n)` unconditionally
   (document.js:581), so `kernel.js rampOf`'s raw ramp is `(0 + 0) * loop` —
   0 of 18,793 motif phrases across 479 anchors at three readings carries a
   ramp column (measured 2026-09-05), and `nukernel/gates.json`'s census says
   the same from the other end (`form.clamp`, 165 rows, 0 alive). What a
   PERSON reads is one plain sentence. test/table.test.js T4m fails the day a
   ramp column lands. */
const rampWhy = () => t("cell.ramp.why");

/** ...AND THE ONE OF THE FIVE THAT IS TOLD RATHER THAN ASKED, with the
 *  measurement that makes it a sentence. */
function cellVecSay(A: TableAPI, i: number, vi: number, spec: LaneSpec,
                    chordChair: boolean): Field {
  const own = A.cellOf(i, vi, spec.key);
  const row = A.rowOf ? A.rowOf(i, spec.key) : null;
  const said = own != null ? own : row;
  /* WHY A CHORD PART REFUSES THESE: `kernel.js render` sends a pad and any
     `chordLock` part down the chord branch, which `continue`s before the
     articulation and the scale are read (measured 2026-09-04). The octave and
     the time still answer. The sentence a person reads says the useful half. */
  return { kind: "say", label: spec.label,
    word: said == null ? t("value.default")
                       : String(spec.labels[String(said)] || said),
    why: chordChair ? t("cell.chordPart.why") : rampWhy() };
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
    word: said == null ? t("value.default")
                       : String(spec.labels[String(said)] || said),
    why: rampWhy() };
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
  f.push({ kind: "ops", label: t("row.ops"), ops: rowOps(A, i, s) });
  f.push(shField(A, "form.role", { section: sid }, t("row.type")));
  f.push(numField(A, "bars|" + sid, t("row.bars"), s.bars, BARSTEPS,
    (v) => A.putRow(i, "bars", +v), false));
  /* ---- THE FORM (2026-09-05, the review's item 9) ----------------------
     *"Fifteen section roles and no way to say 'play it twice with a different
     last bar'."* Four controls, in the order a composer says them: how many
     TIMES, whether this section is the second ENDING of the one above, whether
     it is the CODA, and where the form leaves for it. DESIGN.md §11c puts them
     first in the row's Form group, above the section's own length words.

     EACH ONE THAT CANNOT BE SAID HERE IS DRAWN REFUSED WITH ITS SENTENCE
     (DESIGN.md §2.14, and the review's own "protect the refusals"): a second
     ending with no repeat above it, a coda that is not the last section, a
     jump with no coda to jump to. The document refuses the same three at the
     door (`document.js normalize`), so the control and the model agree. */
  f.push(numField(A, "repeat|" + sid, t("row.repeat"),
    (s.repeat as number) || "", [2, 3, 4, 5, 6, 7, 8],
    (v) => A.putRow(i, "repeat", v === "" ? null : +v), true, t("row.repeat.once")));
  const flag = (key: string, on: boolean, label: string, why: string | null) => {
    const fld: Field = { key: key + "|" + sid, label,
      word: on ? t("row.ending.on") : t("row.ending.off"),
      value: on ? "1" : "", derived: !on, why,
      options: [{ v: "", w: t("row.ending.off") },
                { v: "1", w: t("row.ending.on") }],
      ...(why ? {} : { set: (v: string) => A.putRow(i, key, v ? true : null),
                       clear: on ? () => A.putRow(i, key, null) : null }) };
    f.push(fld);
  };
  const prev = secs[i - 1];
  flag("ending", s.ending === true, t("row.ending"),
       (i > 0 && ((prev && (prev.repeat as number)) || 0) >= 2) ? null : t("row.ending.why"));
  flag("coda", s.coda === true, t("row.coda"),
       i === secs.length - 1 ? null : t("row.coda.why"));
  const codaIx = secs.findIndex((x) => x && x.coda);
  flag("tocoda", s.tocoda === true, t("row.tocoda"),
       codaIx > i ? null : t("row.tocoda.why"));
  /* THE LABELS ARE THE COMPOSER'S WORDS (TABLE.md §12a, the musicologist's
     review): dynamics not shape, automation not motion, feel not pace,
     phrase structure not period, note-length limit not breath. The ADDRESSES
     on the left of each pair are untouched. */
  for (const [key, lab] of [["form.lvl", t("field.level")],
                            ["form.env", t("field.dynamics")],
                            ["form.intro", t("field.intro")],
                            ["form.outro", t("field.outro")],
                            ["form.mot", t("noun.automation")],
                            ["form.pace", t("noun.feel")],
                            ["development.period", t("field.phraseStructure")],
                            ["development.breath", t("row.noteLimit")],
                            ["development.pipe", t("row.pipe")]] as [string, string][])
    f.push(shField(A, key, { section: sid }, lab));
  /* THE ROW'S OWN HARMONY AND FEEL (wave 2a's five). They resolve
     row-before-record, so the WORD a row prints when it says nothing is the
     RECORD's word and the row is drawn quiet — which is 2 exactly. */
  /* THE LABEL IS NOT OVERRIDDEN HERE ANY MORE (2026-09-05). `avail.js
     ROWFACTS` names these eleven sheets out of the catalogue itself
     (`field.key`, `field.chords`, `field.effects`, `field.pan`…), so a word
     spelled again here would be a SECOND owner of one label — the exact shape
     the one-owner law refuses, and the way two surfaces drift apart in a
     second language. `null` asks the sheet what it is called. */
  for (const key of ["form.key", "form.mode", "form.prog", "form.swing",
                     "form.groove"]) {
    f.push(shField(A, key, { section: sid }, null));
    /* ...AND THE CHANGES OPEN THE CHART ITSELF, right under the menu that
       names one (2026-09-05). The row's `changes` offered eleven named genre
       charts and nothing a hand could write — *"the bridge cannot have its
       own changes"* — while the resolver has taken a row-level `prog` since
       wave 2a. This is `timeSheet`'s own changes grid, scoped to this
       section: it draws the record's chart until the first write, and that
       write forks it onto the row. One editor, two scopes, no second
       drawing of a chord chart anywhere on the page. */
    if (key === "form.prog")
      f.push({ kind: "node", label: t("row.chart"),
               node: A.changesNode(sid) });
  }
  /* ...AND ITS CHAIN AND ITS ROOM (wave 2a's six). */
  for (const key of ["form.fx", "form.rev", "form.echo", "form.dtime",
                     "form.room", "form.pan"])
    f.push(shField(A, key, { section: sid }, null));
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
  f.push(numField(A, "nudge|" + sid, t("row.startsAt"), (s.nudge as number) || 0,
    [0, 1, 2, 3, 4, 6, 8], (v) => A.putRow(i, "nudge", +v), true));
  /* THE COMPILED LANES ARE READ-ONLY ON THE ROW (1: "written by mot and by
     cells"), and saying so is the refused-control law rather than a silence. */
  /* ---- THE SECTION'S OWN LANES, AND ONE A HAND MAY DRAW (2026-09-05, the
     review's item 10). The count stays a `say` — those are COMPILED, from the
     automation word above and from the cells, and a number you cannot move is
     a reading and not a control. What is new is the line under it: a lane a
     hand draws, on the same plate the cell's lanes use, over this section's
     own bars. `audio/desk.js compileAuto` has appended `sec.auto` since it was
     written; until today nothing wrote one. */
  const auto = (s.auto as { param?: string }[]) || [];
  f.push({ kind: "say", label: t("row.lanes"),
    word: (auto.length ? tn("row.lanes", auto.length) : t("value.none")),
    why: t("row.lanes.why") });
  {
    const params = Object.keys(A.AUTOPARAMS || {});
    const mine = auto.find((a) => a && a.param && params.includes(a.param));
    const cur = mine && mine.param ? mine.param : "";
    f.push({ key: "trowauto|" + sid, label: t("row.draw"),
      word: cur ? ((A.AUTOPARAMLABEL || {})[cur] || cur) : t("value.none"),
      value: cur, derived: !cur,
      options: [{ v: "", w: t("value.none") },
                ...params.map((p) => ({ v: p,
                  w: (A.AUTOPARAMLABEL || {})[p] || p } as Choice))],
      set: (v: string) => {
        const rest = auto.filter((a) => !a || a.param !== cur);
        if (!v) { A.putRow(i, "auto", rest.length ? rest : null); return; }
        const R = (A.AUTOPARAMS || {})[v];
        const bars = Math.max(1, Number(s.bars) || 1);
        A.putRow(i, "auto", [...rest, { param: v, in: "bars",
          curve: R && R.curve === "exp" ? "exp" : "lin",
          points: [[0, R ? R.lo : 0], [bars, R ? R.hi : 1]] }]);
      },
      clear: cur ? () => A.putRow(i, "auto",
        auto.filter((a) => !a || a.param !== cur)) : null });
    if (cur) {
      const node = A.rowLaneNode ? A.rowLaneNode(i, cur) : null;
      if (node) f.push({ kind: "node", label: t("row.draw"), node });
    }
  }
  return f;
}

export function colSheet(A: TableAPI, vi: number): Field[] {
  const v = A.doc().voices[vi]!;
  const f: Field[] = [];
  f.push({ kind: "ops", label: t("col.ops"), ops: colOps(A, vi, v) });
  if (v.kind === "line") f.push(shField(A, "cast.part", { voice: v.name }, t("col.plays")));
  const ik = v.kind === "bass" ? "sound.bassinstrument"
           : v.kind === "drums" ? "sound.drumkit" : "sound.instrument";
  f.push(shField(A, ik, { voice: v.name },
                 v.kind === "drums" ? t("col.machine") : t("noun.instrument")));
  /* IS THERE A DRUMMER AT ALL — `cast.on`. avail.js `f["voice.on"]` is read off
     it and greys all sixty-eight kit words when it is false, so deleting this
     would leave a record with a drummer nobody could sit out. Said in two words
     rather than as a tick, which is this surface's law. */
  if (v.kind === "drums") {
    const on = A.castOf(vi, "on") !== false;
    f.push({ key: "drums", label: t("col.drummer"),
             word: on ? t("state.playing") : t("col.drummer.off"),
             value: on ? "1" : "",
             derived: false,
             options: [{ v: "1", w: t("state.playing") },
                       { v: "", w: t("col.drummer.off") }],
             set: (x: string) => A.putCast(vi, "on", !!x) });
  }
  /* ...AND ITS FILES, DIRECTLY UNDER IT. The samples crate is not a vector and
     has no cell, so it comes here WHOLE, under the instrument it swaps, and is
     absent on a chair no recording plays. */
  if (A.hasCrate(v.name))
    f.push({ kind: "node", label: t("col.files"), node: A.voiceCrate(v.name) });
  if (v.kind === "line")
    f.push(shField(A, "cast.material", { voice: v.name }, t("col.material")));
  if (v.kind === "bass")
    f.push(shField(A, "cast.bassStyle", { voice: v.name }, t("col.bassStyle")));
  /* ---- THE ENVELOPE, DRAWN (2026-09-05, TABLE.md §11) ------------------
     Paul, after the AUX spike: *"Make an Adsr and envelope editor though and
     use that for samples etc."* The plate goes ABOVE the two words that are
     left, because it is the thing this part of the sheet is about.

     AND `sound.attack` AND `sound.release` GO WITH IT. Those two rows were
     four words each (fields.js VOX.atk / VOX.rel — "straight in · soft · slow
     · swelling", "cut off · natural · ringing · long tail") writing the same
     `voice.sound.atk` / `.rel` the editor's handles write, in seconds, from
     the same clamps. Keeping both would be two controls on one address, which
     is the shape test/selects.js's own guard fails a page for. §11 said which
     one goes: *"The knob rows it replaces are removed from the knob table for
     those params (T7: nothing lost — the numbers print beside the handles)"* —
     and they do, in the field's own units, under the curve. `swelling` is the
     one thing a word said that a number cannot, and it is not lost either: it
     is a 1.2 s attack, and audio/to-engine.js `samplerVox` still reads the
     word wherever a saved record carries one.
     `sound.double` and `sound.looping` are NOT envelope facts and stay. */
  const env = A.voiceEnv(v.name);
  if (env) f.push({ kind: "node", label: env.label, node: env.node });
  for (const k of env ? ["sound.double", "sound.looping"]
                      : ["sound.attack", "sound.release", "sound.double", "sound.looping"])
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
  if (th) f.push({ key: "throat|" + v.name, label: t("col.throat"),
    word: th.word, value: th.own, derived: !th.own,
    options: [{ v: "", w: t("value.default") },
              ...th.words.map((w) => ({ v: w, w } as Choice))],
    set: (x: string) => A.putCast(vi, "voice", x || null),
    clear: th.own ? () => A.putCast(vi, "voice", null) : null });
  /* THE COLUMN DEFAULTS A CELL MAY OVERRIDE (1: "the column DEFAULT; a cell
     may override"). Written here, they move every cell that says nothing. */
  const reg = A.castOf(vi, "reg");
  f.push(numField(A, "reg|" + v.name, t("col.register"),
    reg == null ? "" : (reg as number),
    REGSTEPS, (x) => A.putCast(vi, "reg", x === "" ? null : +x), true,
    t("value.default")));
  /* THE COLUMN'S ENTRY, IN BEATS. Not `numField`, because that builds a
     slider whose value IS the stored number and this one's unit differs from
     its address's: the strip reads beats and the document keeps bars. */
  const en = A.castOf(vi, "entry") as number | null;
  {
    const E = entryNum(A, en, null);
    const beats = en == null ? null : E.toBeats(en);
    f.push({ key: "entry|" + v.name, label: t("col.entry"),
      word: beats == null ? t("col.entry.none") : String(beats),
      value: beats == null ? "" : String(beats),
      derived: beats == null,
      options: [{ v: "", w: t("col.entry.none") } as Choice,
                ...[0, 1, 2, 4, 8].map((n) => ({ v: String(n * E.bpb),
                                                 w: String(n * E.bpb) } as Choice))],
      num: { min: 0, max: E.top, step: E.B.step, unit: t("unit.beats"),
             derivedNum: 0 },
      set: (x: string) => A.putCast(vi, "entry",
        x === "" ? null : (+x) / E.bpb),
      clear: beats == null ? null : () => A.putCast(vi, "entry", null) });
  }
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
  f.push({ kind: "ops", label: t("col.desk"), ops: [
    { k: "tseat|" + v.name, word: t("col.seat.word"),
      aria: t("col.seat.aria", { name: v.name }),
      act: () => A.showSeat(v.name) },
    { k: "tbuses|" + v.name, word: t("master.buses"),
      aria: t("col.buses.aria", { name: v.name }),
      act: () => A.showBoard() } ] });
  return f;
}

export function cellSheet(A: TableAPI, i: number, vi: number): Field[] {
  const doc = A.doc();
  const s = doc.form.sections[i]!, v = doc.voices[vi]!;
  const sid = s.id;
  const f: Field[] = [];
  f.push({ kind: "ops", label: t("cell.ops"), ops: cellOps(A, i, vi) });
  /* 1 · THE MOTIFS, WITH THEIR PREVIEWS AND THEIR PROVENANCE (3). One control
     and not two: the chips ARE the motif list, each wearing its own preview and
     the word that says where it came from.
     ...EXCEPT FOR A BASS, WHICH IS TOLD RATHER THAN ASKED, AND IS TOLD SO. Both
     compilers hand `K.bass` the FIRST LINE's compiled phrase, so a bass cell
     that named a motif would name it into nothing. An honest sentence beats a
     dead control. */
  if (v.kind === "bass") {
    const b = A.bassReads();
    /* WHY: both compilers hand `K.bass` the first line's compiled phrase
       (document.js scoreOf, ui/derive.js sectionEvents), so a motif named on
       a bass cell would be named into nothing. The person reads the useful
       half — where it comes from, and which cell to change. */
    f.push({ kind: "say", label: t("special.phrases.word"),
      word: b && b.cell ? t("cell.bass.reads", { value: b.cell, lead: b.lead })
                        : t("cell.bass.readsNone"),
      why: t("cell.bass.why") });
  }
  const reads = v.kind === "bass" ? null
    : A.sh("material.cell", { voice: v.name, section: sid },
           t("cell.sheet.plays", { name: v.name, section: A.secName(i) }));
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
    f.push({ key: w.key, label: t("special.phrases.word"),
             word: w.derived ? A.cellWord(i, vi) : w.label,
             value: w.value == null ? "" : String(w.value),
             derived: w.derived, options, set: (x: string) => w.set(x),
             why: w.why || null,
             clear: w.derived ? null : () => w.set("") });
  }
  /* 2 · WHAT IT DOES HERE. For a drummer that is an array out of the
     sixty-eight, grouped; for anybody else it is the development word. */
  const dev = A.sh(A.devSheetFor(v.kind), { voice: v.name, section: sid },
                   t("cell.sheet.variation", { name: v.name,
                                               section: A.secName(i) }));
  if (dev) {
    const w = A.wcell(dev);
    const fld: StripField = { key: w.key, label: t("noun.variation"), word: w.label,
                  value: w.value == null ? "" : String(w.value),
                  derived: w.derived, options: w.options,
                  set: (x: string) => w.set(x), why: w.why || null,
                  clear: w.derived ? null : () => w.set("") };
    if (v.kind === "drums") fld.groups = groupsFor(w.options);
    f.push(fld);
  }
  /* 3 · THE TWO COLUMN DEFAULTS A CELL MAY OVERRIDE (wave 1's cell tier). */
  f.push(cellEntry(A, i, vi));
  f.push(cellNum(A, i, vi, "reg", t("col.register"), REGSTEPS));
  /* 4 · FOCUS — stored, resolved, and reaching nothing, which 1a measured and
     T2e pins. A control that pretended otherwise would be the
     declared-but-never-arriving bug drawn on purpose. */
  /* MEASURED 2026-09-04, IN THE CODE AND NOT ON THE SCREEN: `box.focus`
     indexes a one-entry stack and moves no event, so the control is drawn
     refused with a plain sentence. T2e pins it; the gate names it the day a
     reader lands. */
  f.push({ kind: "say", label: t("cell.focus"),
    word: A.cellOf(i, vi, "focus") ? t("cell.focus.on") : t("cell.focus.off"),
    why: t("cell.focus.why") });
  /* 5 · THE CELL'S MIX LANE, RELATIVE TO THE ROW'S (wave 3) — a word, or a
     LINE YOU DRAG (2026-09-05, the review's item 10). The plate follows its
     own strip and is drawn only where the lane is drawn, so a lane that says a
     word is one control and a lane that says a curve is a control and its
     picture, which is what the mode precedent on this page already looks
     like. */
  for (const spec of (A.CELLAUTO || [])) {
    f.push(cellLane(A, i, vi, spec));
    const now = ((A.cellOf(i, vi, "mixauto") as Record<string, unknown>) || {})[spec.key];
    if (!isDrawn(now)) continue;
    const node = A.cellLaneNode ? A.cellLaneNode(i, vi, spec.key) : null;
    if (node) f.push({ kind: "node",
      label: t("cell.lane.label", { name: spec.label }), node });
  }
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
  /* MEASURED 2026-09-04: all five are read inside `kernel.js render`, which
     is what a LINE plays; the kit is `K.drums` and the bass is `K.bass`, and
     each has its own words for the same ideas (the kit's halftime/doubletime,
     the bass's own artic and register). The person reads the plain half. */
  else f.push({ kind: "say", label: t("cell.pitchedOnly.label"),
    word: t("cell.pitchedOnly.word"),
    why: t("cell.pitchedOnly.why") });
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
    return { key: w.key, label: p.label,
             word: t("perf.cell", { short: p.short, value: w.label }),
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
    numField(A, "take", t("noun.take"), (A.perfOf("take") as number) || 1,
      [1, 2, 3, 4, 5, 6, 8, 12], (v) => A.putPerf("take", +v), false),
    numField(A, "humanize", t("perf.humanize"),
      A.perfOf("humanize") == null ? "" : (A.perfOf("humanize") as number),
      [0, 0.2, 0.4, 0.6, 0.8, 1],
      (v) => A.putPerf("humanize", v === "" ? null : +v), true,
      t("value.default")),
    { key: "ontime", label: t("perf.ontime"),
      word: A.perfOf("ontime") ? t("perf.ontime.on") : t("perf.ontime.off"),
      value: A.perfOf("ontime") ? "1" : "",
      derived: !A.perfOf("ontime"),
      options: [{ v: "", w: t("perf.ontime.off") },
                { v: "1", w: t("perf.ontime.on") }],
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
    { k: "trow-here|" + s.id, word: t("op.playFrom"),
      aria: t("op.playFrom.aria"), act: () => A.playFrom(i) },
    { k: "trow-add", word: t("op.addSection"), aria: t("op.addSection.after"),
      act: () => A.addSection(i + 1) },
    { k: "trow-up|" + s.id, word: t("op.up"), aria: t("op.up.aria"),
      why: i === 0 ? t("refuse.alreadyFirst") : null,
      act: () => A.moveSection(i, -1) },
    { k: "trow-down|" + s.id, word: t("op.down"), aria: t("op.down.aria"),
      why: i === n - 1 ? t("refuse.alreadyLast") : null,
      act: () => A.moveSection(i, 1) },
    { k: "trow-dup|" + s.id, word: t("op.duplicate"),
      aria: t("op.duplicate.aria"), act: () => A.dupSection(s.id) },
    ...REPEATS.map((r) => ({ k: "trow-rep|" + s.id + "|" + r,
      word: t("op.repeat", { n: r }),
      aria: t("op.repeat.aria", { n: r }),
      act: () => A.repeatSection(s.id, r) })),
    { k: "trow-deal|" + s.id, word: t("op.reset"),
      aria: t("op.resetRow.aria"),
      act: () => A.dealRow(i) },
    { k: "trow-del|" + s.id, word: t("op.deleteSection"),
      aria: t("op.deleteSection.aria"),
      why: n <= 1 ? t("refuse.lastSection") : null,
      act: () => A.dropSection(s.id) },
  ];
}

export function colOps(A: TableAPI, vi: number, v: Voice): Op[] {
  const n = A.doc().voices.length;
  return [
    { k: "tcol-solo|" + v.name, word: t("op.solo"),
      aria: t("op.solo.aria", { name: v.name }),
      act: () => A.soloVoice(v.name) },
    { k: "tcol-add|line", word: t("op.addLine"), aria: t("op.addLine.aria"),
      act: () => A.addVoice("line") },
    { k: "tcol-add|bass", word: t("op.addBass"), aria: t("op.addBass.aria"),
      why: A.hasKind("bass") ? t("refuse.haveBass") : null,
      act: () => A.addVoice("bass") },
    { k: "tcol-add|drums", word: t("op.addDrums"), aria: t("op.addDrums.aria"),
      why: A.hasKind("drums") ? t("refuse.haveDrums") : null,
      act: () => A.addVoice("drums") },
    { k: "tcol-left|" + v.name, word: t("op.left"), aria: t("op.left.aria"),
      why: vi === 0 ? t("refuse.alreadyFirst") : null,
      act: () => A.moveVoice(vi, -1) },
    { k: "tcol-right|" + v.name, word: t("op.right"), aria: t("op.right.aria"),
      why: vi === n - 1 ? t("refuse.alreadyLast") : null,
      act: () => A.moveVoice(vi, 1) },
    { k: "tcol-deal|" + v.name, word: t("op.reset"),
      aria: t("op.resetCol.aria"),
      act: () => A.dealCol(vi) },
    /* "MAKE X Y" IS A COLUMN OP NOW (5). ui/produce.js owns the verb and its
       qualities; what the table adds is the X — the column you opened is the
       subject, so the sentence is already half said when you get there. */
    ...A.makeQualities(v.name).map((q) => ({ k: "tcol-make|" + v.name + "|" + q.v,
      word: q.w, aria: t("op.make.aria", { name: v.name, quality: q.w }),
      why: q.why || null,
      act: () => A.makeXY(v.name, q.v) })),
    { k: "tcol-del|" + v.name, word: t("op.remove"),
      aria: t("op.remove.aria", { name: v.name }),
      why: n <= 1 ? t("refuse.lastPlayer") : null,
      act: () => A.dropVoice(v.name) },
  ];
}

export function cellOps(A: TableAPI, i: number, vi: number): Op[] {
  const doc = A.doc();
  const v = doc.voices[vi]!, s = doc.form.sections[i]!;
  return [
    { k: "tcell-clear|" + v.name + "|" + s.id, word: t("op.clearCell"),
      aria: t("op.clearCell.aria"),
      why: A.written(i, vi) ? null : t("refuse.nothingToClear"),
      act: () => A.clearCell(i, vi) },
    /* FILL RIGHT AND FILL DOWN ARE 5's COPY-TO-ROW AND COPY-TO-COLUMN, said in
       a spreadsheet's own words (9a). One door each, unchanged. */
    { k: "tcell-copyrow|" + v.name + "|" + s.id, word: t("op.fillRow"),
      aria: t("op.fillRow.aria"),
      act: () => A.copyCell(i, vi, "row") },
    { k: "tcell-copycol|" + v.name + "|" + s.id, word: t("op.fillCol"),
      aria: t("op.fillCol.aria"),
      act: () => A.copyCell(i, vi, "col") },
  ];
}

export function tableOps(A: TableAPI, across: boolean): Op[] {
  return [
    { k: "ttab-fill", word: t("op.fillGenre"),
      aria: t("op.fillGenre.aria"), act: () => A.fillFromGenre() },
    { k: "ttab-seed", word: t("op.reseed"),
      aria: t("op.reseed.aria"), act: () => A.reseed() },
    { k: "ttab-transpose",
      word: across ? t("op.transposeSections") : t("op.transposePlayers"),
      aria: across ? t("op.transposeSections.aria")
                   : t("op.transposePlayers.aria"),
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
    { k: "tcol-add|line", word: t("op.addLine"), aria: t("op.addLine.aria"),
      act: () => A.addVoice("line") },
    { k: "tcol-add|bass", word: t("op.addBass"), aria: t("op.addBass.aria"),
      why: A.hasKind("bass") ? t("refuse.haveBass") : null,
      act: () => A.addVoice("bass") },
    { k: "tcol-add|drums", word: t("op.addDrums"), aria: t("op.addDrums.aria"),
      why: A.hasKind("drums") ? t("refuse.haveDrums") : null,
      act: () => A.addVoice("drums") },
  ];
}
export function sectionOffer(A: TableAPI): Op[] {
  const n = A.doc().form.sections.length;
  return [{ k: "trow-add", word: t("op.addSection"),
            aria: t("op.addSection.end"),
            act: () => A.addSection(n) }];
}

export { groupsFor, cellNum, cellLane, cellVecField, CHORDCHAIRS };
