// nukernel/ui/table.js — THE BAND TABLE. A song is a table of vectors.
//
// Paul, 2026-09-03: *"a song can be understood as a grid with sections as rows
// and instruments as columns … A good way to 'build' a song is to add and
// remove columns and rows using a table building interface … Each cell can be
// understood as a vector … The producer becomes basically a vector manipulator
// across the table. It's a next generation futuristic gig sheet for robots."*
//
// This is nukernel/TABLE.md wave 2b. It REPLACES the Band pane and the
// Structure pane — both deleted, not hidden (§6 ¶A, "get rid of everything it
// replaces … Don't lose unreplaced options"), with test/table-inventory.json
// as the contract that says where each of their controls went and T7 as the
// gate that reads the rendered page and finds it.
//
// ===== WHAT IT DRAWS ====================================================
//   the HEADER ROW is the voices      — part · instrument; tap for the column
//                                       sheet (§1's VOICE vector)
//   the HEADER COLUMN is the sections — type · bars; tap for the row sheet
//                                       (§1's SECTION vector)
//   a CELL is a section × a voice     — tap for the cell sheet (§1's CELL
//                                       vector), which is the whole point
//   the FOOTER is the RECORD          — the master's seven words, and the
//                                       performance five under them
//   the CORNER is the TABLE           — fill from a genre, re-seed, transpose
//
// ===== WHAT IT IS NOT ===================================================
// It is NOT a second table renderer. ui/wordgrid.js has been the one owner of
// this skin since 2026-09-02 ("institutionalize it") and it grew a SHEET body
// and a FOOTER for this wave rather than being copied: one accordion, one
// refusal spelling, one dim-is-derived reading, one keyboard model. What is
// here is which questions get asked, of whom, and what each answer would do.
//
// It is NOT a second vocabulary either. Every word on every chip comes from
// `NuAvail.SHEETS` through the host's `sh()` (which is ui/eight.js `shSpec`),
// and every write lands through a door that already existed — `putCell` /
// `putRow` in document.js, `addSection` / `dupSection` / `moveSection` /
// `dropSection` / `addVoice` / `dropVoice` in ui/eight.js, and `push()` /
// `commit()` / `CTX.evolve` for the recompile. TABLE.md §5: "Every op is one
// document write through the existing doors and lands at the next bar while
// playing. No op adds a second write path." Nothing in this file writes to a
// document field directly.
//
// ===== THE INHERIT LAW IS DRAWN, NOT RE-IMPLEMENTED =====================
// §2: `cell → column → row → record → the genre's row`, first value wins, and
// the table draws only DEVIATIONS — inherited quiet, written bold, a clear-back
// on every written row. document.js `resolveFrom` is the one owner of that
// order (wave 1) and this file asks it; `derived` on a sheet row is "no hand
// has written at THIS tier", which is the same fact `.is-derived` has meant on
// the trim grid since it was written.
//
// ===== THE PHONE IS THE FIRST LAYOUT, AND WHICH WAY THE TABLE FACES =====
// §6 ¶A: *"mobile editing is truly critical"*, and §5 offers the transpose
// ("voices as rows on a phone") as an op to be picked BY MEASUREMENT.
// MEASURED 2026-09-04 at 320px on the rendered page (T5): sections-down is
// 13ch + n×9ch of table inside a `.nu-pane`, which SCROLLS SIDEWAYS ITSELF and
// leaves `document.documentElement.scrollWidth === clientWidth` — no sideways
// PAGE scroll, which is the shell gate's law and the one that matters. The
// transposed view is the same table with the two lists swapped and is one tap
// away in the corner sheet, because which way you want to read a song depends
// on whether you are arranging (down the sections) or casting (across the
// band). Sections-down is the DEFAULT because a record has more voices than
// most phones have columns and fewer sections than most songs have bars, so
// the scroll it costs is the shorter one.

import { wordGrid } from "./wordgrid.js";
import { preview } from "./preview.js";

const el = (tag, text, cls) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls; return n; };

/* ===== THE DRUMMER'S SIXTY-EIGHT, GROUPED BY WHAT THEY ACT ON ==========
   TABLE.md §6: *"the does-array sheet groups the 68 ops by what they act on —
   kick, snare, hats, toms and fills, dynamics, feel — one group open at a
   time, the active ops pinned at the top."*

   THE GROUPS ARE KITOPS' OWN COMMENT HEADINGS, read off kernel.js and written
   down here rather than derived, because a comment is not data and a regex
   over a comment is worse than a list. kernel.js's headings are THE
   TIMEKEEPING HAND MOVES / CYMBALS / THE SNARE HAND / THE KICK FOOT / TOMS /
   DENSITY, DYNAMICS AND THE HAND / NAMED PATTERNS, plus an unheaded
   subtractive block at the top; Paul's six fold the cymbals in with the toms
   (both are the fill hand) and the named patterns in with feel (a groove's
   name IS a feel). The per-lane generated ops — `k.rot`, `s.thin`, `h.dens`
   and their eighteen siblings, minted by kernel.js as `<lane>.<verb>` — go to
   the lane they name, which is the only grouping they could have.
   ANY OP NOT NAMED HERE FALLS INTO `feel`, so a new KITOP appears on the
   sheet with no edit in this file and T5 counts sixty-eight either way. */
const KITGROUPS = [
  ["kick",  ["nokick", "kickdoubles", "four"]],
  ["snare", ["snareonly", "backbeat", "onthree", "stickside", "claps",
             "ghosts", "flams", "drags", "roll"]],
  ["hats",  ["nohats", "busy", "offbeat", "ride", "pedal", "opens", "shuffle"]],
  ["toms & fills", ["tomtime", "tomfill", "tomrun", "tomroll",
                    "crash", "crashback"]],
  ["dynamics", ["accents", "crescendo", "soft", "loud", "humanize"]],
  ["feel",  []],
];
const LANEOF = { k: "kick", s: "snare", h: "hats" };
function groupOf(op) {
  const dot = String(op).indexOf(".");
  if (dot > 0) { const g = LANEOF[op.slice(0, dot)]; if (g) return g; }
  for (const [name, list] of KITGROUPS) if (list.includes(op)) return name;
  return "feel";
}

/* ===== THE REGISTERS AND THE ENTRIES A HAND SAYS ======================
   A REGISTER IS −4..3 AND THE RANGE IS NOT THIS FILE'S TO CHOOSE.
   document.js `normalize` is the one owner of it ("`reg` … Number.isInteger &&
   >= -4 && <= 3") and precompose §7b says what the units are: `cast.reg` is
   the SOUNDING register, and `toGenre` hands the kernel back the base it
   implies. MEASURED 2026-09-04: the first draft of this table offered
   semitones (−24…24), every chip outside −4..3 was written and then silently
   PRUNED by normalize on the next recompile, and the gate read the cell tier
   back empty — a control that writes and does not arrive, which is this
   repo's characteristic bug drawn by the file that was supposed to be gating
   against it. The list is the whole legal range, which is eight words and
   needs no ceiling argument at all.
   The COLUMN's own value is added even when it is outside, so no cell can be
   shown a value it cannot get back to. */
const REGSTEPS = [-4, -3, -2, -1, 0, 1, 2, 3];
const BARSTEPS = [1, 2, 4, 8, 12, 16, 24, 32];
const REPEATS  = [2, 3, 4];

/**
 * Draw the Band table into `host`.
 *
 * `A` is the host's own seam — ui/eight.js builds it (see `tableAPI`) and it is
 * a list of DOORS, not of data: every one of them is a function that already
 * existed and already had one owner. The table holds no state of its own
 * except which way it faces, which is the host's too (`A.facing()`), because a
 * view that remembered its own orientation across a rebuild would be a second
 * page state beside `openTab`.
 */
export function bandTable(host, A) {
  const doc = A.doc();
  const secs = (doc.form && doc.form.sections) || [];
  const voices = doc.voices || [];
  const across = A.facing() === "voices";     // the transpose (§5)

  /* ---------- THE THINGS A SECTION SAYS (§1 SECTION) ------------------- */
  const secWord = (i) => A.roleWord(secs[i].role);
  const rowSheet = (i) => {
    const s = secs[i], sid = s.id;
    const f = [];
    f.push(shField(A, "form.role", { section: sid }, "type"));
    f.push(numField(A, "bars|" + sid, "bars", s.bars, BARSTEPS,
      (v) => A.putRow(i, "bars", +v), false));
    for (const [key, lab] of [["form.lvl", "level"], ["form.env", "shape"],
                              ["form.intro", "intro"], ["form.outro", "outro"],
                              ["form.mot", "motion"], ["form.pace", "pace"],
                              ["development.period", "period"],
                              ["development.breath", "breath"],
                              ["development.pipe", "pipe"]])
      f.push(shField(A, key, { section: sid }, lab));
    /* THE ROW'S OWN HARMONY AND FEEL (wave 2a's five). They resolve
       row-before-record, so the WORD a row prints when it says nothing is the
       RECORD's word and the row is drawn quiet — which is §2 exactly, and the
       reason the label says "the record's key" rather than "—". */
    for (const [key, lab] of [["form.key", "key"], ["form.mode", "mode"],
                              ["form.prog", "changes"], ["form.swing", "swing"],
                              ["form.groove", "groove"]])
      f.push(shField(A, key, { section: sid }, lab));
    /* ...AND ITS CHAIN AND ITS ROOM (wave 2a's six). */
    for (const [key, lab] of [["form.fx", "chain"], ["form.rev", "reverb"],
                              ["form.echo", "echo"], ["form.dtime", "echo time"],
                              ["form.room", "room"], ["form.pan", "across"]])
      f.push(shField(A, key, { section: sid }, lab));
    f.push(numField(A, "nudge|" + sid, "starts at", s.nudge || 0,
      [0, 1, 2, 3, 4, 6, 8], (v) => A.putRow(i, "nudge", +v), true));
    /* THE COMPILED LANES ARE READ-ONLY ON THE ROW (§1: "written by mot and by
       cells"), and saying so is the refused-control law rather than a silence:
       the motion above IS the writer, and this line is where a reader finds
       that out. */
    f.push({ kind: "say", label: "automation",
      word: (s.auto && s.auto.length ? s.auto.length + " lanes" : "none"),
      why: "compiled from the motion above — wave 3 makes a lane editable" });
    f.push({ kind: "ops", label: "this section", ops: rowOps(A, i, s) });
    return f;
  };

  /* ---------- THE THINGS A VOICE SAYS (§1 VOICE) ----------------------- */
  const colSheet = (vi) => {
    const v = voices[vi];
    const f = [];
    if (v.kind === "line") f.push(shField(A, "cast.part", { voice: v.name }, "plays"));
    const ik = v.kind === "bass" ? "sound.bassinstrument"
             : v.kind === "drums" ? "sound.drumkit" : "sound.instrument";
    f.push(shField(A, ik, { voice: v.name }, v.kind === "drums" ? "machine" : "instrument"));
    /* IS THERE A DRUMMER AT ALL — `cast.on`, and it is the one control of the
       Band pane that the T7 probe's roll-up did not carry into the inventory
       (found by reading test/sheets.js, which drives it: it was a bare
       `<input type=checkbox data-k="drums">` on the drummer's `plays` facet).
       It is not decoration: avail.js `f["voice.on"]` is read off it and greys
       all sixty-eight kit words when it is false, so deleting the pane without
       this line would have left a record with a drummer nobody could sit out
       and a refusal nobody could clear. Said in the table's own two words
       rather than as a tick, which is this surface's law (§6: no control that
       needs a pointer, and chips are decisions). */
    if (v.kind === "drums") {
      const on = A.castOf(vi, "on") !== false;
      f.push({ key: "drums", label: "drummer",
               word: on ? "playing" : "sitting out",
               value: on ? "1" : "",
               derived: false,
               options: [{ v: "1", w: "playing" }, { v: "", w: "sitting out" }],
               set: (x) => A.putCast(vi, "on", !!x) });
    }
    /* ...AND ITS FILES, DIRECTLY UNDER IT (2026-09-04, wave 2c). §6 ¶A's
       "don't lose unreplaced options": the samples crate is not a vector and
       has no cell, so it comes here WHOLE — every recording on this chair with
       its provenance, an audition each, the loop points and the SWAP, which is
       the instrument row said again in the crate's own narrower words (only
       what the sampler can play). It sits under the instrument because that is
       the question it answers, and it is absent on a chair no recording plays
       (`hasCrate`), which is the same law the loop strip is drawn under. */
    if (A.hasCrate(v.name))
      f.push({ kind: "node", label: "its files", node: A.voiceCrate(v.name) });
    if (v.kind === "line") f.push(shField(A, "cast.material", { voice: v.name }, "reads by default"));
    if (v.kind === "bass") f.push(shField(A, "cast.bassStyle", { voice: v.name }, "does by default"));
    /* THE CHAIR'S OWN KNOBS, for the kinds that have them. These are the four
       `sound.*` sheets a member's instrument facet drew; a sheet is where they
       already lived, so they arrive here as themselves. */
    for (const k of ["sound.attack", "sound.release", "sound.double", "sound.looping"])
      if (A.hasSheet(k, { voice: v.name })) f.push(shField(A, k, { voice: v.name }, null));
    /* ...AND THE MODELLED CHAIR'S OWN THROAT (2026-09-04, wave 2c). VOICE.md's
       knob table and its tract pad: the rows the extractor measured off this
       instrument, each printing the value it is overriding, with a clear-back
       where a hand has written. It had exactly one home — the Band pane's
       `inst` facet — and the T7 probe could not see it, because Kingston 1969
       seats no modelled voice. Null on a chair that has nothing to turn (a
       recording has one breath in it); ui/eight.js `voiceKnobs` decides, and
       the row's label is the block's own word for what it is editing. */
    const kn = A.voiceKnobs(v.name);
    if (kn) f.push({ kind: "node", label: kn.label, node: kn.node });
    /* THE COLUMN DEFAULTS A CELL MAY OVERRIDE (§1: "the column DEFAULT; a cell
       may override"). Written here, they move every cell that says nothing. */
    f.push(numField(A, "reg|" + v.name, "register",
      A.castOf(vi, "reg") == null ? "" : A.castOf(vi, "reg"),
      REGSTEPS, (x) => A.putCast(vi, "reg", x === "" ? null : +x), true,
      "the genre's"));
    f.push(numField(A, "entry|" + v.name, "enters at bar",
      A.castOf(vi, "entry") == null ? "" : A.castOf(vi, "entry"),
      [0, 1, 2, 4, 8], (x) => A.putCast(vi, "entry", x === "" ? null : +x), true,
      "bar one"));
    /* WHERE IT SITS IN THE MIX, AND THE STRIP ITSELF. §1 files `seat` on the
       column: the fader, the pan, the three sends and the three insert slots.
       This block said "it is the BOARD's, and this is the door" and that was
       WRONG — MEASURED 2026-09-04, test/sheets.js counted zero insert seats on
       the whole page the moment the Band pane became this table. The board has
       bus strips and the section-automation grid and NO per-voice channel at
       all, because Paul took the voices off it on 2026-08-28 (*"remove the
       voices from the mixing board … add another nav item for the mixing per
       voice"*). So the strip's only home was the Band pane's `mix` facet and
       it comes here WHOLE. `voiceMix` is ui/engineer.js's own widget; this
       seats it, and does not redraw one control of it.
       THE BUSES STAY THE BOARD'S and keep their door beside it: a send goes
       somewhere, and where it goes is not a fact about this player. */
    f.push({ kind: "node", label: "seat", node: A.voiceStrip(v.name) });
    f.push({ kind: "ops", label: "the buses", ops: [
      { k: "tseat|" + v.name, word: "on the board",
        aria: v.name + " — the buses its sends feed, on the board",
        act: () => A.showBoard(v.name) } ] });
    f.push({ kind: "ops", label: "this player", ops: colOps(A, vi, v) });
    return f;
  };

  /* ---------- THE CELL, WHICH IS THE POINT (§1 CELL) ------------------- */
  const cellSheet = (i, vi) => {
    const s = secs[i], v = voices[vi], sid = s.id;
    const f = [];
    /* 1 · THE MOTIFS, WITH THEIR PREVIEWS AND THEIR PROVENANCE (§3). One
       control and not two: the chips ARE the motif list, each wearing its own
       `ui/preview.js` picture and the word that says where it came from — own,
       guest: <genre>, or hand. The address is `material.cell|<voice>|<section>`
       unchanged, which is the address Structure's reads grid used and three
       gates drive. */
    /* ...EXCEPT FOR A BASS, WHICH IS TOLD RATHER THAN ASKED, AND IS TOLD SO
       (restored 2026-09-04, wave 2c). Both compilers hand `K.bass` the FIRST
       LINE's compiled phrase and read its accents off it — `const lead =
       phrases[0]` in document.js `scoreOf` and in ui/derive.js
       `sectionEvents` — and `toGenre` gives the bass a `bassStyle` and no
       material at all. So a bass cell that named a motif would name it into
       nothing: the control would move, the record would not. The Structure
       grid drew that cell REFUSED with this measurement in its `data-why`;
       wave 2b's first draft of this sheet offered it as a live control, which
       is the declared-but-never-arriving bug drawn by the wave that is
       supposed to gate against it, and test/table.browser.js T8f found it the
       hour the grid came out. An honest sentence beats a dead control. */
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
      /* THE PICTURE AND THE PROVENANCE RIDE ON THE MOTIFS ONLY. The first
         option is the ABSENT detent — "—", the column's own answer — and it
         names no motif, so asking the bank where it came from returned "hand"
         and the strip labelled the empty chip as a hand's work. */
      w.options = w.options.map((o) => (o.v === "" || o.v == null ? o : { ...o,
        pv: A.previewOf(String(o.v)), prov: A.provWord(String(o.v)) }));
      /* AN INHERITED MOTIF PRINTS WHAT IT INHERITS, QUIETLY — §2: "an
         inherited value is drawn quiet", not an em dash. avail.js's absent
         detent for this sheet is "—" (right for a `<select>`, which has to
         spell "nothing stored"), and a table whose whole reading is
         quiet-vs-bold has to print the WORD THAT SOUNDS and let the paint say
         where it came from. `cellWord` is the same reader the grid's own cell
         uses, so the sheet and the cell behind it can never disagree. */
      f.push({ key: w.key, label: "motifs",
               word: w.derived ? A.cellWord(i, vi) : w.label, value: w.value,
               derived: w.derived, options: w.options, set: w.set, why: w.why,
               clear: w.derived ? null : () => w.set("") });
    }
    /* 2 · WHAT IT DOES HERE. For a drummer that is an array out of the
       sixty-eight, grouped; for anybody else it is the development word. */
    const devKey = A.devSheetFor(v.kind);
    const dev = A.sh(devKey, { voice: v.name, section: sid },
                     v.name + " does · " + A.secName(i));
    if (dev) {
      const w = A.wcell(dev);
      const fld = { key: w.key, label: "does", word: w.label, value: w.value,
                    derived: w.derived, options: w.options, set: w.set, why: w.why,
                    clear: w.derived ? null : () => w.set("") };
      if (v.kind === "drums") fld.groups = groupsFor(w.options);
      f.push(fld);
    }
    /* 3 · THE TWO COLUMN DEFAULTS A CELL MAY OVERRIDE (wave 1's cell tier). */
    f.push(cellNum(A, i, vi, "entry", "enters at bar", [0, 1, 2, 4, 8]));
    f.push(cellNum(A, i, vi, "reg", "register", REGSTEPS));
    /* 4 · FOCUS — stored, resolved, and reaching nothing, which TABLE.md §1a
       measured and T2e pins. A control that pretended otherwise would be the
       declared-but-never-arriving bug drawn on purpose. */
    f.push({ kind: "say", label: "focus",
      word: A.cellOf(i, vi, "focus") ? "featured" : "no",
      why: "measured 2026-09-04: box.focus indexes a one-entry stack and " +
           "moves no event — the gate names it the day a reader lands" });
    /* 5 · THE CELL'S MIX LANE, RELATIVE TO THE ROW'S (wave 3, 2026-09-04).
       This row was GREYED with its reason until today ("wave 3: a cell lane is
       an OFFSET on the row's, and the desk does not read one yet") and the
       reason has expired: audio/desk.js reads one now, at the same site the
       board's own offset layer lands, and nukernel/export/als.js writes the
       sum per track. One strip per lane kind, each word an OFFSET and never an
       absolute — the absent detent is "rides the section", which is ¶A's own
       sentence for a cell that says nothing. */
    for (const spec of (A.CELLAUTO || [])) f.push(cellLane(A, i, vi, spec));
    /* 6 · THE FIVE THAT WERE PER BOX (wave 4, 2026-09-04). This row was GREYED
       with its reason until today ("these are per box today and moving them to
       the cell needs a song.js VERSION migration") and both halves of that
       sentence have been answered: `document.js TIERS` addresses all five at
       the row AND the cell, `toGenre` is their one owner, and no version moved
       because no shape did — the box already carried a key for each and
       `boxesOf` still writes none of them (writing one would apply the row's
       word twice, once here and once in `ui/derive.js genreOf`).
         FOUR STRIPS AND ONE SENTENCE. `clamp` is drawn as a measurement rather
       than a control, for the reason `focus` is: it is stored, it resolves,
       and on the DOCUMENT path it moves no note, because `document.js
       toPhrase` writes `inc` and `stk` all-zero — a document phrase carries no
       ramp for a limit to limit. It is a live control on the BOX path (the
       tracker's own ramp columns), which is why the field exists at all. An
       honest sentence beats a dead control (T8f's law, wave 2c). */
    /* ...AND THEY ARE THE PITCHED CHAIRS' ALONE, WHICH IS SAID RATHER THAN
       drawn dead. All five are read inside `kernel.js render`, and `render` is
       what a LINE plays: the kit is `K.drums` and the bass is `K.bass`, two
       functions that never see `g.cell` and have their own words for the same
       ideas (KITOPS `halftime`/`doubletime` for a kit's rate, `bassArtic` and
       `bassReg` for the bass's articulation and octave — kernel.js says so at
       both sites). Offering an articulation strip on the drummer would be a
       control that writes to the document and moves no hit. */
    if (v.kind === "line") {
      /* ...AND TWO OF THE FIVE ARE NOT READ FOR A CHAIR THAT VOICES CHORDS.
         MEASURED 2026-09-04 on reggae seed 1: a `stab` with 201 rendered notes
         in a section answers an octave and a rate and does NOT answer an
         articulation or an alphabet — `kernel.js render` sends a `pad` and any
         part with `chordLock` (PARTS.stab) down the chord branch, which voices
         the bar's chord and `continue`s BEFORE the articulation is read and
         takes its pitches from the chord's own tones rather than from the
         subject alphabet. A `lead` on the same record answers both. So those
         two rows are sentences on those two chairs and strips everywhere else;
         the octave and the time stay live for everybody, because both are
         applied to the finished stream. */
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
    f.push({ kind: "ops", label: "this cell", ops: cellOps(A, i, vi) });
    return f;
  };

  /* ---------- WHAT A CELL PRINTS WITHOUT BEING OPENED ------------------ */
  /* THE ONE WORD A PRODUCER SCANS DOWN A COLUMN is what this voice PLAYS here
     — the motif for anybody who reads one, and the development word for the
     two kinds that are told rather than asked (the bass takes the first line's
     phrase; a kit has no motif at all). DIM means nothing has been written in
     this cell OR its column for this section: §2's "the table draws only
     deviations", which is what makes eighty cells readable. */
  const cellRecord = (i, vi) => {
    const s = secs[i], v = voices[vi];
    const hand = A.written(i, vi);
    const word = A.cellWord(i, vi);
    return { key: "tcell|" + v.name + "|" + s.id,
             value: word, label: word, derived: !hand,
             say: v.name + " · " + A.secName(i),
             sheet: () => cellSheet(i, vi) };
  };

  /* ---------- THE FOOTER: THE RECORD (§1 RECORD) ----------------------- */
  const masterCells = () => A.MASTERROWS.map((m) => {
    const cur = A.masterOf(m.key);
    return { key: "tmaster|" + m.key, value: cur == null ? "" : cur,
             label: m.key + " " + (cur == null ? "—" : (m.labels[cur] || cur)),
             derived: cur == null, say: "the master's " + m.label,
             options: [{ v: "", w: "none" },
                       ...Object.keys(m.table).map((k) => ({ v: k, w: m.labels[k] || k }))],
             set: (v) => A.setMaster(m.key, v || null) };
  });
  /* THE PERFORMANCE CELLS KEEP THE SHEET'S OWN ADDRESS, and that is a fix with
     a date on it (2026-09-04, wave 2c). The first draft re-keyed them
     `tperf|<short>` — a table cell wants a unique key and `tperf|` was the
     table's own prefix — and that MOVED THREE ADDRESSES that three gates drive
     by name (test/nudges.js says `performance.phrase` to prove the phrase tent
     reaches the rendered spread; test/selects.js's MENUS names them). An
     address does not move when a row does, which is this page's oldest law,
     and `performance.stress` is already unique. `tfoot|perf` is the DOOR and
     keeps its own key. */
  const perfCells = () => A.PERFROWS.map((p) => {
    const sp = A.sh(p.key, {}, p.label);
    if (!sp) return { text: "—" };
    const w = A.wcell(sp);
    return { ...w, say: p.label, label: p.short + " " + w.label };
  });

  /* ---------- AND THE TWO WAYS ROUND ----------------------------------- */
  const secRows = () => secs.map((s, i) => ({
    id: s.id, k: "trow|" + s.id, num: i + 1,
    word: secWord(i), sub: s.bars + " bars",
    here: i === A.editSec(),
    aria: A.secName(i) + ", " + s.bars + " bars — open this section's vector",
    sheet: () => rowSheet(i) }));
  const voiceCols = () => voices.map((v, vi) => ({
    id: "tcol|" + v.name, word: v.name, sub: A.playsWhat(v) || "",
    vi: A.vpaintOf(vi),
    aria: v.name + " — " + (A.playsWhat(v) || "no instrument") +
          " — open this player's vector",
    title: v.name + (A.playsWhat(v) ? " — " + A.playsWhat(v) : ""),
    extra: A.lampFor(v.name),
    sheet: () => colSheet(vi) }));
  const voiceRows = () => voices.map((v, vi) => ({
    id: "v" + v.name, k: "trow|" + v.name, word: v.name,
    sub: A.playsWhat(v) || "",
    aria: v.name + " — open this player's vector",
    sheet: () => colSheet(vi) }));
  const secCols = () => secs.map((s, i) => ({
    id: "tcol|" + s.id, word: secWord(i), sub: s.bars + " bars",
    aria: A.secName(i) + " — open this section's vector",
    sheet: () => rowSheet(i) }));

  const spec = across
    ? { key: "table", corner: "player", rows: voiceRows(), cols: secCols(),
        cell: (rid, cid) => {
          const vi = voices.findIndex((v) => "v" + v.name === rid);
          const i = secs.findIndex((s) => "tcol|" + s.id === cid);
          return (vi < 0 || i < 0) ? null : cellRecord(i, vi); } }
    : { key: "table", corner: "section", rows: secRows(), cols: voiceCols(),
        cell: (rid, cid) => {
          const i = secs.findIndex((s) => s.id === rid);
          const vi = voices.findIndex((v) => "tcol|" + v.name === cid);
          return (i < 0 || vi < 0) ? null : cellRecord(i, vi); },
        foot: [
          { id: "master", k: "tfoot|master", word: "master",
            aria: "the master chain — the record's own last stage",
            cells: masterCells(),
            sheet: () => [{ kind: "say", label: "the master",
              word: "drive · glue · tape · space · width · tilt · ceiling",
              sub: "the seven words are the cells across this row" }] },
          { id: "perf", k: "tfoot|perf", word: "performance",
            aria: "how the band plays it — the record's own performance",
            cells: perfCells(),
            /* THE THREE PERFORMANCE FACTS THAT ARE NUMBERS. They were three
               range inputs on the Structure pane, which is a pointer-only
               control and therefore a refused one (§6 ¶A). Said as words here,
               where they can be tapped. */
            sheet: () => [
              /* A TAKE IS ONE WHEN NOTHING IS SAID, NOT NOUGHT (fixed
                 2026-09-04). It read `|| 0`, so an untouched record printed
                 "0" and the strip grew a `take|0` chip out of the "add the
                 value we are on" rule — a word a hand could tap that writes a
                 take the record cannot hold: `takeSeed` is
                 `Math.max(1, take|0)`, so nought reads back as one and the
                 control lies about what it did. ui/eight.js `takeSeed` is the
                 one owner of that floor and this is it, said in the offer.
                 Found by test/knobs.js 10b, which taps a take it has not got
                 and reads the document back. */
              numField(A, "take", "take", A.perfOf("take") || 1,
                [1, 2, 3, 4, 5, 6, 8, 12], (v) => A.putPerf("take", +v), false),
              numField(A, "humanize", "humanize",
                A.perfOf("humanize") == null ? "" : A.perfOf("humanize"),
                [0, 0.2, 0.4, 0.6, 0.8, 1], (v) => A.putPerf("humanize", v === "" ? null : +v),
                true, "the genre's"),
              { key: "ontime", label: "on time",
                word: A.perfOf("ontime") ? "dead on the grid" : "as the band plays",
                derived: !A.perfOf("ontime"),
                options: [{ v: "", w: "as the band plays" },
                          { v: "1", w: "dead on the grid" }],
                set: (v) => A.putPerf("ontime", v ? true : null),
                clear: A.perfOf("ontime") ? () => A.putPerf("ontime", null) : null },
            ] },
        ] };

  /* THE CORNER IS THE TABLE ITSELF (§5's fourth list). It is the `<th>` every
     table already has and the only place on the surface that is about the
     WHOLE record rather than a row, a column or a cell. */
  spec.cornerSheet = () => [
    { kind: "ops", label: "this record", ops: tableOps(A, across) },
  ];
  spec.cap = null;

  const g = wordGrid(host, spec);
  /* THE CORNER, WIRED AFTER THE FACT because the component's corner is a plain
     `<th>` word and every other caller wants it to stay one. One button, one
     address, and the same sheet body the three heads open. */
  const cornerTh = g.table.querySelector("thead th:first-child");
  if (cornerTh) {
    cornerTh.textContent = "";
    const cb = el("button", spec.corner, "nu-rowjump nu-corner");
    cb.type = "button";
    cb.dataset.k = "tcorner";
    cb.setAttribute("aria-label", "the whole record — fill it from a genre, " +
      "re-seed it, or turn the table round");
    cb.addEventListener("click", () => g.openCorner(spec.cornerSheet(), cb));
    cornerTh.append(cb);
  }
  return g;
}

/* ===================================================================== */
/* ---- the field builders: one shape, three sources -------------------- */

/* WHICH VOCABULARIES ARE MENUS AND NOT STRIPS OF WORDS, and the list is not
   this file's opinion. test/selects.js's `MENUS` is the one owner of the
   controls Paul named on 2026-09-02 (*"The combo boxes just don't work … I was
   expecting more of onfocus show custom dropdown then filter based on input"*)
   and these three are on it; `sound.bassinstrument` is the bass's spelling of
   one of them. The FOURTH rule is a measurement rather than a name: a strip
   longer than twenty-four words is a page of words, which is what
   `bandBlock`'s own comment said about the instrument list ("a sheet of 108 lit
   words is a page of them"). Everything shorter is chips, because chips are
   decisions and this page has said so since 2026-08-16. */
/* ...AND A FIFTH, 2026-09-04 (wave 2c): `form.role`. It is on test/selects.js's
   MENUS list — Paul named it there as "the band > form" — and the row sheet's
   first draft drew it as a strip of eight chips, which is a defensible reading
   of "chips are decisions" and is not what the one owner of that list says. It
   was a combo in the form table it replaces (`.nu-form td > .nu-sel`, a
   stripped-down `selectField`) and it is a combo here, at the same address a
   thumb and three gates already know. Found by test/selects.js check 1 the
   hour the form table came out, which is exactly the job that list has. */
const COMBOKEYS = new Set(["cast.part", "sound.instrument",
                           "sound.bassinstrument", "sound.drumkit",
                           "form.role"]);
const LONGSTRIP = 24;

/** A field off an avail.js sheet — the ordinary case, and the only one that
 *  needs no vocabulary of its own. `label` null means "the sheet's own". */
function shField(A, key, scope, label) {
  const sp = A.sh(key, scope, null);
  if (!sp) return { kind: "say", label: label || key, word: "—",
                    why: "no vocabulary owner for " + key };
  if (COMBOKEYS.has(key) || (sp.options || []).length > LONGSTRIP) {
    const w2 = A.wcell(sp);
    return { key: w2.key, label: label || sp.label, word: w2.label,
             value: w2.value, derived: w2.derived, why: w2.why,
             node: A.combo(sp),
             clear: w2.derived ? null : () => w2.set("") };
  }
  const w = A.wcell(sp);
  /* `value` IS NOT `word`, AND BOTH HAVE TO TRAVEL. The word is what the row
     PRINTS (avail.js's label for the standing option, or the inherited one);
     the value is what the record STORES, and it is what the strip presses.
     The first draft of this file passed only the word, so every sheet field
     pressed the absent chip and a person tapping the word they were already on
     wrote nothing — the gate read `hook -> hook` and correctly called the
     control silent. */
  return { key: w.key, label: label || sp.label, word: w.label,
           value: w.value, derived: w.derived, options: w.options,
           set: w.set, why: w.why,
           clear: w.derived ? null : () => w.set("") };
}

/** A NUMBER SAID AS WORDS. There is no `<input type=range>` anywhere on this
 *  surface, and that is §6's law rather than a taste: *"A control that only
 *  works with a pointer is a refused control."* A range needs a drag; a strip
 *  of chips needs a tap. */
function numField(A, key, label, cur, steps, set, clearable, noneWord) {
  const has = cur !== "" && cur != null;
  const list = steps.slice();
  if (has && !list.includes(+cur)) list.push(+cur);
  list.sort((a, b) => a - b);
  return { key, label,
    word: has ? String(cur) : (noneWord || "—"),
    value: has ? String(cur) : "",
    derived: !has,
    options: [...(clearable ? [{ v: "", w: noneWord || "none" }] : []),
              ...list.map((n) => ({ v: String(n), w: String(n) }))],
    set,
    clear: (clearable && has) ? () => set("") : null };
}

/** A CELL OVERRIDE OF A COLUMN DEFAULT — §2 drawn as a control. The word it
 *  prints when nothing is written here is what it INHERITS, and it is drawn
 *  quiet; the clear-back appears the moment a hand writes. */
function cellNum(A, i, vi, field, label, steps) {
  const own = A.cellOf(i, vi, field);
  const inh = A.resolve(i, vi, field);
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
              ...list.map((n) => ({ v: String(n), w: String(n) }))],
    set: (v) => A.putCell(i, vi, field, v === "" ? null : +v),
    clear: has ? () => A.putCell(i, vi, field, null) : null };
}

/** ONE LANE OF A CELL'S MIX AUTOMATION, RELATIVE TO THE SECTION'S (TABLE.md
 *  wave 3, ¶A: "we still want per-section mix automation, with per-cell
 *  relative to that").
 *
 *  A CELL LANE HAS NO INHERITED VALUE, and that is the law rather than an
 *  omission: an OFFSET whose absent state was anything but zero would be a
 *  second curve, so the quiet word here is "rides the section" and not a
 *  column's or a row's answer (document.js CELLFIELD.mixauto has four nulls
 *  under it for the same reason).
 *
 *  THE NEUTRAL WORD IS NOT OFFERED. Each lane's table carries one word worth
 *  0 — "as mixed", "as placed", "as sent", "as toned" — and fields.js
 *  `cellAutoClean` drops it, because zero IS absent and a record may have only
 *  one spelling of it. A chip that wrote and then vanished on the next
 *  recompile is exactly the bug §1b records this file shipping once already
 *  (the −24…31 registers), so the chip is not drawn: the clear-back is how
 *  a hand says "as mixed", and it is on every written row.
 *
 *  ONE WRITE, THROUGH THE ONE DOOR. The whole map is read, one key is changed
 *  and `putCell` is handed the result — so a hand that sets a level and then a
 *  pan has one cell with two lanes in it, and §5's "every op is one document
 *  write" holds for the second one as much as the first. */
function cellLane(A, i, vi, spec) {
  const read = () => A.cellOf(i, vi, "mixauto") || {};
  const cur = read()[spec.key] == null ? "" : String(read()[spec.key]);
  const has = cur !== "";
  const put = (w) => {
    const next = { ...read() };
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
              ...words.map((k) => ({ v: k, w: spec.labels[k] || k }))],
    set: (v) => put(v || ""),
    clear: has ? () => put("") : null };
}

/** THE TWO CHAIRS THAT VOICE THE BAR'S CHORD RATHER THAN READING A SUBJECT.
 *  `kernel.js render` takes the chord branch for `part === "pad"` and for any
 *  part whose PARTS row sets `chordLock` — which today is `stab` and nothing
 *  else — and that branch `continue`s before the articulation is read and
 *  builds its pitches out of the chord's own tones. Named here rather than
 *  imported because ui/table.js sits above the kernel and this is the only
 *  question it asks of it; kernel.js PARTS is the owner, and the day a third
 *  part locks to the chord this list is one word longer. */
const CHORDCHAIRS = new Set(["pad", "stab"]);

/** ONE OF THE FIVE §1 MOVED FROM THE BOX TO THE CELL (TABLE.md wave 4:
 *  *"artic / oct / rate / scale / clamp — today per box, applied to every
 *  voice; become per cell with the row as default"*).
 *
 *  THE DEFAULT IS THE ROW'S, NOT THE COLUMN'S, and that is the difference
 *  between this strip and `cellNum` above it. An articulation is not a fact
 *  about a chair for the whole record — a register is — so the quiet word here
 *  is what the SECTION says, and the sub-line says so in the same two words
 *  `cellNum` uses for its own tier.
 *
 *  WHAT IT PRINTS WHEN NOBODY HAS SAID ANYTHING is the row's own answer if
 *  there is one and the genre's word otherwise, which for these five is "as
 *  the genre asks" — the registry's own phrase for a null default (fields.js
 *  FIELDS: *"default what emptyBox()/skeleton() seed (null = 'as the genre
 *  asks')"*). Printing a fabricated value would be worse than printing none:
 *  the kernel's floor for each of the five lives in the kernel, in the
 *  kernel's units, and this sheet is not entitled to restate it.
 *
 *  THE NEUTRAL WORD IS NOT OFFERED, for the third time in this file and the
 *  same reason: `oct` 0 is an octave shift of no octaves, `fields.js
 *  cellVecClean` drops it at the door, and a chip that writes and vanishes on
 *  the next recompile is §1b's register bug shipped twice. The clear-back is
 *  how a hand says "the row's". */
function cellVecField(A, i, vi, spec) {
  const own = A.cellOf(i, vi, spec.key);
  const row = A.rowOf ? A.rowOf(i, spec.key) : null;
  const has = own != null && own !== "";
  const wordOf = (k) => (k == null || k === "" ? null
    : String(spec.labels[String(k)] || k));
  const words = Object.keys(spec.table).filter((k) => k !== spec.neutral);
  return { key: "tcellvec|" + spec.key + "|" + vi + "|" + i,
    label: spec.label,
    word: has ? wordOf(own) : (wordOf(row) || "as the genre asks"),
    value: has ? String(own) : "",
    derived: !has,
    sub: has ? null : (spec.none || "the row's"),
    /* NO `why` ON A LIVE STRIP. ui/wordgrid.js reads `why` as the REFUSAL
       reason — it sets `aria-disabled`, adds `is-refused` and rewrites the
       label — so passing the field's question here would draw four working
       controls as four dead ones. The question lives in the strip's own
       legend, which `chipStrip` takes from the label. */
    options: [{ v: "", w: spec.none || "the row's" },
              ...words.map((k) => ({ v: k, w: String(spec.labels[k] || k) }))],
    set: (v) => A.putCell(i, vi, spec.key, v === "" ? null : v),
    clear: has ? () => A.putCell(i, vi, spec.key, null) : null };
}

/** ...AND THE ONE OF THE FIVE THAT IS TOLD RATHER THAN ASKED, with the
 *  measurement that makes it a sentence (the refused-control law, §4's "no
 *  silent grey", and the shape wave 2c restored for the bass's `reads`).
 *  MEASURED 2026-09-04: `document.js toPhrase` returns `inc: z(n), stk: z(n)`
 *  for every motif in every bank, so `kernel.js rampOf` computes a raw ramp of
 *  zero on the document path and there is nothing for a limit to limit — 0 of
 *  6 phrases on acid seed 1 carry a ramp, and none can, by construction. The
 *  field is stored and resolved all the same (the gate names it the day a
 *  ramp column lands in the hook editor), which is exactly how `focus` is
 *  carried three rows up. */
function cellVecSay(A, i, vi, spec, chordChair) {
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
      : "measured 2026-09-04: a document's motifs carry no ramp " +
        "(document.js toPhrase writes inc and stk all-zero), so a ramp " +
        "limit moves no note here — it is the tracker's control, and this " +
        "cell keeps the address for the day a ramp lands" };
}

/** THE DRUMMER'S GROUPS, built from the options the sheet actually offers so a
 *  refused word keeps its refusal and a group with nothing in it is not drawn.
 *  The order is KITGROUPS', which is the order a drummer's own limbs are in. */
function groupsFor(options) {
  const by = new Map();
  for (const o of options) {
    if (o.v === "" || o.v == null) continue;
    const g = groupOf(o.v);
    if (!by.has(g)) by.set(g, []);
    by.get(g).push(String(o.v));
  }
  const out = [];
  for (const [name] of KITGROUPS) if (by.has(name)) out.push({ word: name, vals: by.get(name) });
  for (const [name, vals] of by) if (!out.find((x) => x.word === name)) out.push({ word: name, vals });
  return out;
}

/* ===================================================================== */
/* ---- the op grammar (§5), every one of them one existing door -------- */

function rowOps(A, i, s) {
  const n = A.doc().form.sections.length;
  return [
    /* PUT THE EAR HERE — Paul, B11: *"I need to be able to jump to a section
       somehow, by clicking on them when in automation."* The five Structure
       grids answered that on their ROW HEADS and the head is a sheet door on
       this table, so the jump is the row's first op rather than a second
       meaning on one press. `CTX.playFrom` is the one play door: cold it
       seeks, playing it QUEUES on the next box line and the gutter's countdown
       says how far. (Added 2026-09-04 with the deletion of the grids: it was
       the one control of theirs the inventory filed on a head that could not
       carry it, which is the loss T7 exists to refuse.) */
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

function colOps(A, vi, v) {
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
    /* "MAKE X Y" IS A COLUMN OP NOW (§5). ui/produce.js owns the verb and its
       qualities (louder · quieter · gone · back · alone); what the table adds
       is the X — the column you opened is the subject, so the sentence is
       already half said when you get there. */
    ...A.makeQualities(v.name).map((q) => ({ k: "tcol-make|" + v.name + "|" + q.v,
      word: q.w, aria: "make " + v.name + " " + q.w,
      act: () => A.makeXY(v.name, q.v) })),
    { k: "tcol-del|" + v.name, word: "remove", aria: "remove " + v.name + " from the band",
      why: n <= 1 ? "a band needs one player" : null,
      act: () => A.dropVoice(v.name) },
  ];
}

function cellOps(A, i, vi) {
  const v = A.doc().voices[vi], s = A.doc().form.sections[i];
  return [
    { k: "tcell-clear|" + v.name + "|" + s.id, word: "clear to inherit",
      aria: "clear everything written in this cell",
      why: A.written(i, vi) ? null : "nothing is written here",
      act: () => A.clearCell(i, vi) },
    { k: "tcell-copyrow|" + v.name + "|" + s.id, word: "copy across the row",
      aria: "give every player in this section what this cell says",
      act: () => A.copyCell(i, vi, "row") },
    { k: "tcell-copycol|" + v.name + "|" + s.id, word: "copy down the column",
      aria: "give this player the same thing in every section",
      act: () => A.copyCell(i, vi, "col") },
  ];
}

function tableOps(A, across) {
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
