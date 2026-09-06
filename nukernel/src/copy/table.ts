// nukernel/src/copy/table.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// the sheet itself — src/table/{grid,model,sheet,special,undo}.ts -> ui/table.js: cells, heads, the formula bar, the clear-backs, the special rows
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// WHAT IS NOT HERE, AND WHY. Three kinds of string in `src/table/` are DATA
// and stay literal in the source:
//   · the drummer's group words (`kick`, `snare`, `hats`, `toms & fills`,
//     `dynamics`, `feel`) — they are half of `data-k="<field>|group|<word>"`
//     and of `data-g`, so they are ADDRESSES, and an address never moves;
//   · the em dash a field prints for an absent value — a mark, not a word;
//   · every name that comes off the document or off `avail.js` (a player's
//     name, a section's name, an instrument, a motif, a genre word).
//
// AND `default` IS CORE'S. `value.default` / `value.defaultCap` /
// `value.defaultAria` are `core.ts`'s and are read from there — the eleven
// spellings the audit found (`as the genre asks`, `rides the section`, `the
// column's`, `the genre's`, `the record's`, `the row's`, `leave it alone`)
// are all that one word now.

import type { Table } from "./api.js";

export const TABLE: Table = {
  /* ===== THE FORMULA BAR (grid.ts formulaHead, undo.ts) ================= */
  "bar.selection": "Selection",
  "bar.noCell": "no cell selected",
  "bar.address": "{section} × {player}",
  "bar.addrRange.one": "{addr} · {n} cell",
  "bar.addrRange.other": "{addr} · {n} cells",
  "bar.undo": "↶ undo",
  "bar.redo": "↷ redo",
  "bar.copy": "copy",
  "bar.paste": "paste",
  /* a grey button says why it is grey (DESIGN.md §2.14, "no silent grey"). */
  "bar.undo.none": "Nothing to undo",
  "bar.redo.none": "Nothing to redo",
  "bar.noSel": "Select a cell first",
  "bar.paste.none": "Nothing to paste",

  /* what the two buttons promise to take back or put forward. */
  "undo.undoOf": "Undo {name}",
  "undo.redoOf": "Redo {name}",
  "undo.lastChange": "the last change",

  /* ===== THE NAME AN OP GOES INTO THE STACK UNDER ======================= */
  "op.change": "the change",
  "op.clearing": "clearing {name}",
  "op.clearCells.one": "clearing {n} cell",
  "op.clearCells.other": "clearing {n} cells",
  "op.clearingCell": "clearing the cell",

  /* ===== THE HEADS ====================================================== */
  "head.corner.aria": "Song options",
  "head.song": "this song",
  "head.player.aria": "{name} — {instrument}",
  "head.player.none": "no instrument",
  /* a control whose whole accessible name IS the thing's name: the player
     column head with no instrument, a row head, a slider. One key, because
     one meaning. */
  "head.name": "{name}",
  "head.section.one": "{name}, {n} bar",
  "head.section.other": "{name}, {n} bars",
  "head.grip.aria": "Resize {name} column",

  /* ===== THE SPECIAL ROWS (special.ts SPECIALS, PRODUCE, the mix row) === */
  "special.time.word": "time",
  "special.time.aria": "Time — tempo, meter and key",
  "special.rules.word": "rules",
  "special.rules.aria": "Rules — the genre as editable rules",
  /* THE CHORDS ROW (2026-09-05, TABLE.md §13f, Paul: *"Add chords below time
     and move chord stuff into it"*). Its own word and its own sentence,
     because the changes are their own subject: TIME says how fast and in what
     alphabet, CHORDS says what the harmony DOES over it. */
  "special.chords.word": "chords",
  "special.chords.aria": "Chords — the changes and the harmony",
  /* THE WORD IS `motifs` SINCE 2026-09-05 (TABLE.md §13e, Paul: *"Call
     phrases motifs"*). The KEY does not move — an address does not move when a
     word does — and `motif` was the page's address for this thing all along
     (`motifpoint|…`, `A.motifLamp`), so the row and the bank now read the way
     they are addressed. */
  "special.phrases.word": "motifs",
  "special.phrases.aria": "Motifs — every tune and beat in this song",
  "special.produce.word": "produce",
  "special.produce.aria": "Produce — producer notes",
  "special.mix.word": "mix",
  "special.master.word": "master",
  "special.master.aria": "Master: {face} — and the buses",
  "special.perf.word": "performance",

  /* ===== THE RECORD ROW (2026-09-06, TABLE.md §14, the sorted-by-scope
     round) ===============================================================
     The seven keys above are one scope — RULES, TIME, CHORDS, MOTIFS,
     MASTER, PRODUCE, PERFORMANCE all say something about the whole record —
     and until this round they were seven lines at both ends of the page.
     They are one line now, and this is its word. THE FACE IS `timeFace`'s
     and has no key of its own: tempo, meter and key are already spelled by
     the sheets that own them, and a second spelling here would be a second
     owner of the same three facts.
     TWO ARIA KEYS BECAUSE IT IS A DISCLOSURE, which is `grid.sections`' own
     arrangement one row down: the accessible name says what a tap DOES, and
     a disclosure does two different things depending on which way it stands. */
  "special.record.word": "the record",
  "special.record.collapse.aria": "Hide the record settings",
  "special.record.expand.aria": "Show the record settings",

  /* ===== THE GRID'S OWN HEADER (2026-09-05, TABLE.md §13e) ==============
     Paul: *"Give the main composer interface its own header call it
     Sections."* It is a LABEL and not a control — no sheet, no tap, no pin —
     so it has a word and a count and nothing else. The count is one `tn()`
     key with its own plural, and `{bars}` is `count.bar`'s own plural handed
     in as data: two counts in one line, each declined by the catalogue that
     owns it. */
  /* ...AND ITS TWO NAMES SINCE 2026-09-05 (§13f, Paul: *"Sections should
     collapse when I touch it."*). The line is a disclosure, so its accessible
     name says what a tap DOES and not what the row is — the word and the count
     are already on the glass beside it. Two keys because a disclosure has two
     states and each is a different sentence, which is `time.rubato.off/on`'s
     own arrangement. */
  "grid.sections.collapse.aria": "Hide the sections",
  "grid.sections.expand.aria": "Show the sections",
  "grid.sections.word": "sections",
  "grid.sections.count.one": "{n} section · {bars}",
  "grid.sections.count.other": "{n} sections · {bars}",

  /* ===== THE TIME SHEET (special.ts timeSheet) ========================== */
  "time.byHand": "tap tempo",
  "time.signature": "signature",
  "time.rubato": "rubato",
  "time.rubato.off": "on the grid",
  "time.rubato.on": "breathing",
  "time.rubato.sub": "Saved in this browser only",
  "time.gain": "record gain",
  "master.buses": "buses",

  /* ===== THE CHORDS SHEET (special.ts chordsSheet) ======================
     FOUR KEYS THAT MOVED AND DID NOT CHANGE A WORD (2026-09-05, §13f). They
     read `time.harmony`, `time.melody.chords`, `time.melody.key` and
     `time.changes` while the changes were a group of the TIME sheet; a key is
     an address (C1), the surface is the CHORDS row now, so the address moved
     with the control. Nothing is spelled twice: these are the only four, and
     `time.*` no longer holds them. */
  "chords.harmony": "harmony",
  "chords.melody.chords": "follows the chords",
  "chords.melody.key": "stays in the key",
  "chords.changes": "changes",
  /* the collapsed face when the chain is too long to print: how many bars the
     chart holds and what the harmony DOES with them. A chain of numerals is
     data and needs no key; this is the sentence that stands in for it. */
  "chords.face.long": "{bars} · {harmony}",

  /* ===== THE SECTION SHEET (model.ts rowSheet) ========================== */
  "row.ops": "this section",
  /* THE ONE FIELD ON THIS SURFACE A HAND TYPES INTO (2026-09-06, wave C item 8
     of docs/REDESIGN-SCOPE.md: *"A section has a name. Types only today, so a
     form that plainly has a pre-chorus cannot say so."*). One word, because it
     is a label beside a box and the box's placeholder already says what stands
     when it is empty — the section's TYPE, which is the row below it and does
     not move. */
  "row.name": "name",
  "row.type": "type",
  "row.bars": "bars",
  "row.noteLimit": "note-length limit",
  "row.pipe": "pipe",
  "row.chart": "section chart",
  "row.startsAt": "starts at",
  "row.lanes": "lanes",
  "row.lanes.one": "{n} lane",
  "row.lanes.other": "{n} lanes",
  "row.lanes.why": "Set by the automation above; a cell's lane offsets it",
  /* THE FORM (2026-09-05, the review's item 9). A composer's words: a section
     is played a number of TIMES, a second ENDING replaces the last bars of the
     last one, a CODA ends the piece and a jump leaves for it. */
  "row.repeat": "repeat",
  "row.repeat.once": "once",
  "row.repeat.times.one": "{n} time",
  "row.repeat.times.other": "{n} times",
  "row.ending": "second ending",
  "row.ending.on": "yes",
  "row.ending.off": "no",
  "row.ending.why": "The section above must repeat first",
  "row.coda": "coda",
  "row.coda.why": "A coda is the last section",
  "row.tocoda": "to coda",
  "row.tocoda.why": "Mark a later section as the coda first",
  "row.pickup": "pickup",
  "row.pickup.why": "Set a part to enter before the bar",
  /* A LANE YOU CAN DRAW (2026-09-05, the review's item 10). */
  "row.draw": "draw a lane",
  "lane.draw": "draw",
  "lane.drawn": "drawn",

  /* ===== THE PLAYER SHEET (model.ts colSheet) =========================== */
  "col.ops": "this player",
  "col.plays": "plays",
  "col.machine": "machine",
  "col.drummer": "drummer",
  "col.drummer.off": "sitting out",
  "col.files": "files",
  "col.material": "plays by default",
  "col.bassStyle": "default variation",
  "col.throat": "sings as",
  "col.register": "register",
  /* AN ENTRY IS A BEAT NOW, NOT A BAR (2026-09-05, the review's item 4): a
     pickup, a stretto and an answer on beat three are all fractions of a bar,
     so the control is a slider in BEATS and the label is the noun a musician
     uses for the thing (DESIGN.md 4). The unit is its own key because it
     prints after the number and a second language declines it. */
  "col.entry": "entry",
  "col.entry.none": "the first beat",
  "col.desk": "the desk",
  "col.seat.word": "mix row",
  "col.seat.aria": "{name} — channel strip",
  "col.buses.aria": "{name} — buses",

  /* ===== A CELL, AND THE CELL SHEET (grid.ts bodyCell, model.ts) ======== */
  "cell.aria": "{name} · {section}: {value}",
  "cell.aria.mark": "{name} · {section}: {value} ({mark})",
  "cell.sheet.name": "{name} · {section}",
  "cell.ops": "this cell",
  "cell.sheet.plays": "{name} plays · {section}",
  "cell.sheet.variation": "{name} variation · {section}",
  "cell.bass.reads": "{value} — from {lead}",
  "cell.bass.readsNone": "from the first line",
  "cell.bass.why": "The bass follows the first line's motif. Change that cell.",
  "cell.focus": "focus",
  "cell.focus.on": "featured",
  "cell.focus.off": "not featured",
  "cell.focus.why": "Not available yet",
  "cell.lane.label": "mix · {name}",
  "cell.pitchedOnly.label": "articulation · octave · rate · scale · limit",
  "cell.pitchedOnly.word": "pitched parts only",
  "cell.pitchedOnly.why": "These are for pitched parts; drums and bass have their own words",
  "cell.chordPart.why": "This part plays chords, not a line; give it a line part",
  /* the ramp limit reaches no sound; the measurement that says so is a CODE
     COMMENT in model.ts, and this is what a person reads. */
  "cell.ramp.why": "The motifs carry no ramp for this to limit",

  /* ===== THE MIX ROW'S CELLS (grid.ts mixCell) ========================== */
  "mix.cell.aria": "{name} mix: {value}",
  "mix.cell.aria.mark": "{name} mix: {value} ({mark})",

  /* ===== THE PERFORMANCE ROW (model.ts perfCells / perfSheet) =========== */
  "perf.cell": "{short} {value}",
  "perf.humanize": "humanize",
  "perf.ontime": "on time",
  "perf.ontime.on": "dead on the grid",
  "perf.ontime.off": "as the band plays",

  /* ===== THE OP GRAMMAR (model.ts rowOps / colOps / cellOps / tableOps) = */
  "op.playFrom": "play from here",
  "op.playFrom.aria": "Play from this section",
  "op.addSection": "+ section",
  "op.addSection.after": "Add section after this one",
  "op.addSection.end": "Add section at the end",
  "op.up": "▲ up",
  "op.up.aria": "Move section earlier",
  "op.down": "▼ down",
  "op.down.aria": "Move section later",
  "op.duplicate": "duplicate",
  "op.duplicate.aria": "Duplicate section",
  "op.repeat": "×{n}",
  "op.repeat.aria": "Repeat section {n} times",
  "op.reset": "reset",
  "op.resetRow.aria": "Reset section to default",
  "op.resetCol.aria": "Reset player to default",
  "op.deleteSection": "delete",
  "op.deleteSection.aria": "Delete section",
  "op.solo": "▶ alone",
  "op.solo.aria": "Play {name} alone",
  "op.addLine": "+ line",
  "op.addLine.aria": "Add line",
  "op.addBass": "+ bass",
  "op.addBass.aria": "Add bass",
  "op.addDrums": "+ drums",
  "op.addDrums.aria": "Add drums",
  "op.left": "◀ left",
  "op.left.aria": "Move left",
  "op.right": "right ▶",
  "op.right.aria": "Move right",
  "op.make.aria": "Make {name} {quality}",
  "op.remove": "remove",
  "op.remove.aria": "Delete {name}",
  "op.clearCell": "clear to default",
  "op.clearCell.aria": "Clear everything this cell says",
  "op.fillRow": "fill across the row",
  "op.fillRow.aria": "Give every player here what this cell says",
  "op.fillCol": "fill down the column",
  "op.fillCol.aria": "Give this player the same in every section",
  "op.fillGenre": "fill from a genre",
  "op.fillGenre.aria": "Start this song again from a genre",
  "op.reseed": "re-seed",
  "op.reseed.aria": "Rewrite at a new seed",
  "op.transposeSections": "sections down",
  "op.transposeSections.aria": "Turn the table: sections down the side",
  "op.transposePlayers": "players down",
  "op.transposePlayers.aria": "Turn the table: players down the side",

  /* ===== WHY A CONTROL IS GREY ========================================== */
  "refuse.alreadyFirst": "Already first",
  "refuse.alreadyLast": "Already last",
  "refuse.haveBass": "Bass already added",
  "refuse.haveDrums": "Drums already added",
  "refuse.lastSection": "A song needs one section",
  "refuse.lastPlayer": "A song needs one player",
  "refuse.nothingToClear": "Nothing to clear",

  /* ===== THE SHEET BODY (sheet.ts) ====================================== */
  "sheet.groups.aria": "Groups",
  "sheet.pinned.aria": "Current word",
  "sheet.field": "{name}: {value}",
  "sheet.field.refused": "{name}: {why}",
  "sheet.say.refused": "{name}: {value} — {why}",
  "sheet.refused": "{name} — {why}",
  "sheet.chip.prov": "{name} · {prov}",
  "sheet.chip.whyProv": "{name} — {why} · {prov}",
  "sheet.clearBack.aria": "{name} back to default",
  "sheet.slider.unit.aria": "{name}, in {unit}",
  "sheet.numbox.aria": "{name} — type a number",
  "sheet.noOwner.why": "Not available here",
};
