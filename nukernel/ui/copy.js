// nukernel/ui/copy.js — GENERATED. DO NOT EDIT.
//
// Built from nukernel/src/copy/ by `node tools/ui/build.js`.
// An edit made here is an edit the next build throws away, and
// `node tools/ui/build.js --check` (test/all.js gate `ui-build`) fails
// until it is gone. Edit the TypeScript source and rebuild.
//
// Lit is BUNDLED IN on purpose (TABLE.md 9b): the served tree stays plain
// files, nothing is vendored and nothing is fetched, and the page plays
// with the wire cut. Minify is OFF so this stays a reviewable diff.

// nukernel/src/copy/api.ts
var MISSING = /* @__PURE__ */ new Set();
var PRODUCED = /* @__PURE__ */ new Set();
function fill(s, p) {
  if (!p) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => Object.prototype.hasOwnProperty.call(p, k) ? String(p[k]) : m);
}
function make(table) {
  const t2 = (key, p) => {
    const raw = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : void 0;
    if (raw === void 0) {
      MISSING.add(key);
      return key;
    }
    const out = fill(raw, p);
    if (PRODUCED.size < 2e4) PRODUCED.add(out);
    return out;
  };
  const tn2 = (key, n, p) => t2(key + (n === 1 ? ".one" : ".other"), { n, ...p || {} });
  const has2 = (key) => Object.prototype.hasOwnProperty.call(table, key);
  return { t: t2, tn: tn2, has: has2 };
}
var DECIMALS = {
  ms: 0,
  BPM: 1,
  dB: 1,
  s: 3,
  "%": 0,
  "×": 2,
  st: 0,
  bars: 0,
  beats: 2,
  steps: 0,
  Hz: 0,
  kHz: 1,
  bit: 0,
  kbps: 0
};
var TIGHT = /* @__PURE__ */ new Set(["%", "×", "°"]);
var SIGNED = /* @__PURE__ */ new Set(["dB", "st", "¢"]);
function fmt(n, unit) {
  if (!isFinite(n)) return "—";
  const u = unit || "";
  const d = Object.prototype.hasOwnProperty.call(DECIMALS, u) ? DECIMALS[u] : 2;
  let s = n.toFixed(d);
  if (s.indexOf(".") >= 0) s = s.replace(/\.?0+$/, "");
  if (s === "-0") s = "0";
  if (SIGNED.has(u) && n > 0) s = "+" + s;
  s = s.replace(/^-/, "−");
  return u ? TIGHT.has(u) ? s + u : s + " " + u : s;
}
var missing = () => [...MISSING].sort();
var produced = () => [...PRODUCED];

// nukernel/src/copy/core.ts
var CORE = {
  /* ===== THE ONE WORD FOR AN INHERITED OR DEALT VALUE ==================== */
  "value.default": "default",
  /* the same word where a sentence needs it capitalised (a sheet head, the
     start of an explainer). Two keys, one meaning, because a translator's
     capitalisation is not ours to compute. */
  "value.defaultCap": "Default",
  /* what a screen reader hears after a value nobody wrote. DESIGN.md §3 says
     blank = default and bold = written, which a screen reader cannot see. */
  "value.defaultAria": "{value}, default",
  "value.writtenAria": "{value}, written",
  "value.none": "none",
  "value.off": "off",
  "value.on": "on",
  "value.empty": "empty",
  "value.unavailable": "not available",
  /* ===== ACTIONS ======================================================== */
  "act.add": "Add",
  "act.delete": "Delete",
  "act.clear": "Clear",
  "act.reset": "Reset",
  "act.undo": "Undo",
  "act.redo": "Redo",
  "act.copy": "Copy",
  "act.paste": "Paste",
  "act.close": "Close",
  "act.open": "Open",
  "act.cancel": "Cancel",
  "act.done": "Done",
  "act.more": "More",
  "act.less": "Less",
  "act.rename": "Rename",
  "act.save": "Save",
  "act.play": "Play",
  "act.stop": "Stop",
  "act.clearBack": "Back to default",
  /* ===== THE THINGS ===================================================== */
  "noun.meter": "meter",
  "noun.feel": "feel",
  "noun.section": "section",
  "noun.player": "player",
  "noun.part": "part",
  "noun.phrase": "motif",
  "noun.chord": "chord",
  "noun.take": "take",
  "noun.seed": "seed",
  "noun.tone": "tone",
  "noun.automation": "automation",
  "noun.variation": "variation",
  "noun.transformation": "transformation",
  "noun.instrument": "instrument",
  "noun.genre": "genre",
  "noun.song": "song",
  /* ===== COUNTED NOUNS — a plural is a key, never an `if` in a caller ==== */
  /* THE UNIT WORDS, WHICH ARE NOT COUNTS. A count carries its number
     ("3 beats"); a unit stands after a number a control already prints, so
     it has no placeholder and it is one key however many surfaces use it —
     C4's law ("one meaning, one key"). `rule.unitBeats` was the first of
     these and it was on the rules page; it is here now because a second
     surface (the table's entry slider) asks the same question. */
  "unit.beats": "beats",
  "count.bar.one": "{n} bar",
  "count.bar.other": "{n} bars",
  "count.beat.one": "{n} beat",
  "count.beat.other": "{n} beats",
  "count.step.one": "{n} step",
  "count.step.other": "{n} steps",
  "count.note.one": "{n} note",
  "count.note.other": "{n} notes",
  "count.section.one": "{n} section",
  "count.section.other": "{n} sections",
  "count.player.one": "{n} player",
  "count.player.other": "{n} players",
  "count.phrase.one": "{n} motif",
  "count.phrase.other": "{n} motifs",
  "count.take.one": "{n} take",
  "count.take.other": "{n} takes",
  "count.change.one": "{n} change",
  "count.change.other": "{n} changes",
  "count.more.one": "{n} more",
  "count.more.other": "{n} more",
  /* ===== STATES A CONTROL WEARS ========================================= */
  "state.playing": "playing",
  "state.selected": "selected",
  "state.editing": "editing",
  "state.muted": "muted",
  "state.solo": "solo",
  "state.measured": "measured",
  "state.scheduled": "scheduled"
};

// nukernel/src/copy/table.ts
var TABLE = {
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
  /* ===== THE GRID'S OWN HEADER (2026-09-05, TABLE.md §13e) ==============
     Paul: *"Give the main composer interface its own header call it
     Sections."* It is a LABEL and not a control — no sheet, no tap, no pin —
     so it has a word and a count and nothing else. The count is one `tn()`
     key with its own plural, and `{bars}` is `count.bar`'s own plural handed
     in as data: two counts in one line, each declined by the catalogue that
     owns it. */
  "grid.sections.word": "sections",
  "grid.sections.count.one": "{n} section · {bars}",
  "grid.sections.count.other": "{n} sections · {bars}",
  /* ===== THE TIME SHEET (special.ts timeSheet) ========================== */
  "time.byHand": "tap tempo",
  "time.signature": "signature",
  "time.harmony": "harmony",
  "time.rubato": "rubato",
  "time.rubato.off": "on the grid",
  "time.rubato.on": "breathing",
  "time.rubato.sub": "Saved in this browser only",
  "time.melody.chords": "follows the chords",
  "time.melody.key": "stays in the key",
  "time.changes": "changes",
  "time.gain": "record gain",
  "master.buses": "buses",
  /* ===== THE SECTION SHEET (model.ts rowSheet) ========================== */
  "row.ops": "this section",
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
  "sheet.noOwner.why": "Not available here"
};

// nukernel/src/copy/sheets.ts
var SHEETS = {
  /* ===== THE GROUP HEADINGS (2026-09-05, TABLE.md §11c) ==================
     Paul: *"just nicely structure each expanded interface as proper software
     that's easy to scan and nicely grouped."* Thirteen words, one per heading,
     in the three sets §11c names — a chair (Instrument · Envelope · Tone ·
     Mix), a section (Form · Time · Key · Feel · Chain), a cell (Motif ·
     Variation · Dynamics · Placement) — plus the three the TIME row uses.
     They are NOUNS, they are what a composer calls the thing (DESIGN.md §4),
     and none of them is a question. `src/table/model.ts G` is their one
     reader; nothing on the page spells one of these words a second time. */
  "group.instrument": "Instrument",
  "group.envelope": "Envelope",
  "group.tone": "Tone",
  "group.mix": "Mix",
  "group.form": "Form",
  "group.time": "Time",
  "group.key": "Key",
  "group.feel": "Feel",
  "group.chain": "Chain",
  "group.phrase": "Motif",
  "group.variation": "Variation",
  "group.dynamics": "Dynamics",
  "group.placement": "Placement",
  "group.tempo": "Tempo",
  "group.meter": "Meter",
  "group.chords": "Chords",
  /* (`group.band`, `add.players` AND `add.sections` STOOD HERE — the ADD
     sheet's three headings, for one afternoon. TABLE.md §13e, Paul: *"Don't
     pop up an interface when I add a section or a voice. Just add it."* The
     sheet is deleted with them: a `+` that adds asks no question, so there is
     no answer to put a heading over.) */
  /* ===== THE FOLLOW-UP SWEEP (2026-09-05) ================================
     What the copy BROWSER gate found still assembled in ui/eight.js after the
     surface pass: the time row's two sliders and its readout, the chord
     chart's cells and its two buttons, the Band panel's heading, and the
     close button that had the panel's name pasted onto a verb. Each is one
     whole key with placeholders now. */
  "time.tempoTyped.aria": "Tempo — {min} to {max} BPM",
  "time.beatsPerBar": "beats a bar",
  "time.beatNote": "beat note",
  "time.meterSay": "{meter} · {n} steps a bar",
  /* a number pair's typed box: the field's own name and its two ends. */
  "range.typed.aria": "{name} — {min} to {max}",
  "chart.head.bar": "bar",
  "chart.head.quality": "quality",
  "chart.head.bass": "bass",
  "chart.head.for": "for",
  "chart.degree.aria": "Chord {n} degree",
  "chart.quality.aria": "Chord {n} quality",
  "chart.bass.aria": "Chord {n} bass",
  "chart.length.aria": "Chord {n} length in beats",
  "chart.split": "split",
  "chart.join": "join",
  "chart.split.say": "Split this chord in two",
  "chart.join.say": "Take in the chord after this one",
  "chart.join.none": "Nothing after the last chord",
  "panel.band": "The band",
  "panel.score": "The score",
  /* what the log calls a change it has no better word for. */
  "log.record": "record",
  "deck.engraving": "Engraving the score…",
  "deck.sounding": "sounding",
  /* THE EXPORT CARDS — the format on the left, what it holds on the right,
     and the verb on the button. A file extension is an ADDRESS and stays. */
  "exportTab.url.name": "URL",
  "exportTab.url.what": "the link",
  "exportTab.url.copy": "Copy link",
  "exportTab.json.name": "JSON",
  "exportTab.json.what": "the record",
  "exportTab.wav.name": "WAV",
  "exportTab.wav.what": "the render",
  "exportTab.wav.save": "Download .wav",
  "exportTab.mid.name": "MID",
  "exportTab.mid.what": "the notes",
  "exportTab.mid.save": "Download .mid",
  "exportTab.mp3.name": "MP3",
  "exportTab.mp3.what": "the listening copy",
  "exportTab.mp3.sub": "192 kbps CBR · 44.1 kHz · stereo",
  "exportTab.mp3.save": "Download .mp3",
  "exportTab.als.name": "ALS",
  "exportTab.als.what": "the Live set",
  "exportTab.als.save": "Download .als",
  "act.closeTab.aria": "Close {name}",
  "grid.sectionRow.say": "A section: its bars and what each player plays",
  /* ===== THE MOTIF BANK (the MOTIFS row's sheet) ========================
     `motif` is an ADDRESS in this page (`data-k="motifpoint|…"`, `motifTab`)
     and the address does not move; since 2026-09-05 the WORD a musician reads
     is the same one (TABLE.md §13e, Paul: *"Call phrases motifs"*), so these
     keys keep their `bank.*` names and say `motif`. */
  "bank.empty": "No motifs yet",
  "bank.face.one": "{n} motif · {names}",
  "bank.face.other": "{n} motifs · {names}",
  "bank.faceIn.one": "In {name} · {n} motif",
  "bank.faceIn.other": "In {name} · {n} motifs",
  "bank.listEmpty": "No motifs yet — add one",
  /* a name and the row's own readout (its length, and who plays it) */
  "bank.item.aria": "{name} — {value}",
  "bank.item.edit": "Edit {name}",
  "bank.playedBy": "played by {names}",
  "bank.nobody": "Nobody plays this yet",
  "bank.pointed": "Pointed at {name}",
  "bank.pointedWhy": "The next cell you tap",
  "bank.addPhrase": "+ motif",
  "bank.addPhrase.aria": "Add motif",
  /* ---- THE BENCH'S TWO NEW MARKS (2026-09-05, the review's items 6+7) ----
     An accent, an articulation and an accidental, one word each, said once.
     The accent and the mark are separate controls because they are separate
     facts: an accented staccato is a real thing to write. Each state carries
     its own key rather than a built sentence, so a second language declines
     them (the i18n law, TABLE.md 12b). */
  "bench.acc": "Accent",
  "bench.acc.aria": "{name} step {n} accent",
  "bench.acc.on": "accented",
  "bench.acc.off": "no accent",
  "bench.mark": "Mark",
  "bench.mark.aria": "{name} step {n} mark",
  "bench.mark.none": "no mark",
  "bench.mark.stacc": "staccato",
  "bench.mark.ten": "tenuto",
  "bench.mark.slur": "slur",
  "bench.mark.slide": "slide",
  "bench.alt": "Accidental",
  "bench.alt.aria": "{name} step {n} accidental",
  "bench.alt.nat": "natural",
  "bench.alt.sharp": "sharp",
  "bench.alt.flat": "flat",
  /* a mark on a step that does not sound has nothing to be a mark ON — the
     same refusal the pitch bar and the weight bar already carry */
  "bench.mark.why": "Say note on this step to mark it",
  "bank.addDrums": "+ drum pattern",
  "bank.addDrums.aria": "Add drum pattern",
  /* the chips under a motif: who plays it, on what, and where */
  "bank.chip.aria": "{name} on {instrument}",
  "bank.chip.ariaWhere": "{name} on {instrument} — {value}",
  "bank.chip.ariaFollows": "{name} on {instrument}, follows the lead",
  "bank.chip.ariaFollowsWhere": "{name} on {instrument}, follows the lead — {value}",
  /* ===== THE SAMPLE CRATE'S LOOP STRIP ==================================
     Absent is default here: with no handle dragged the points are the zone's,
     and the word for that is `default` and nothing else. */
  "loop.label": "loop",
  "loop.in.aria": "{name} loop in",
  "loop.out.aria": "{name} loop out",
  "loop.reset": "↺ default",
  "loop.reset.aria": "{name} — reset loop to default",
  "loop.inAt": "Loop in at {value}",
  "loop.outAt": "Loop out at {value}",
  "loop.inDefault": "Loop start, default",
  "loop.outDefault": "Loop end, default",
  "loop.mode.aria": "{name} looping: {value}",
  /* ===== THE TEMPO MARKS (the time tray) ================================
     `data-k` is still "tempo-" + the table's own word, so these are the
     PRINTED faces only and no address moves. */
  "tempoOp.slower": "Slower",
  "tempoOp.faster": "Faster",
  "tempoOp.half": "Half tempo",
  "tempoOp.double": "Double tempo",
  "tempoOp.halfTime": "Half time",
  "tempoOp.doubleTime": "Double time",
  "tempoOp.normal": "Normal speed",
  "tempoOp.defaultSpeed": "Default speed",
  "tempoOp.say": "{word} — {value}",
  "tempoOp.sayRate": "{word} — {value} at {rate}",
  "tempoOp.sayDefaultRate": "{word} — {value} at default speed",
  "tempoOp.sayWhy": "{word} — {why}",
  "tempoOp.why.min": "{value} is the minimum",
  "tempoOp.why.max": "{value} is the maximum",
  "tempoOp.why.alreadyHalf": "Already at half speed",
  "tempoOp.why.alreadyDouble": "Already at double speed",
  "tempoOp.why.alreadyNormal": "Already at normal speed",
  "tempoOp.why.alreadyDefault": "Already at default speed",
  /* ===== THE CHORD CHART'S TWO MARKS ==================================== */
  "chart.addBar": "add a bar",
  "chart.addBar.say": "Add a bar, repeating the last chord",
  "chart.addBar.why": "{value} is the longest chart",
  "chart.cutBar": "take a bar off",
  "chart.cutBar.say": "Remove the last bar",
  "chart.cutBar.why": "A chart is at least one bar",
  /* ===== THE SCORE AND THE ROLL ========================================= */
  "deck.bars": "{name} · bars {from}–{to} of {total}",
  "deck.playing": "{value} · playing",
  "deck.playingElsewhere": "{value} · playing · editing {name}",
  "deck.roll.aria": "Piano roll — pitch across, time down",
  /* THE WORDS BESIDE A METRONOME MARK. A score abbreviates — DESIGN.md's own
     `cresc.` law — so these are the two or three words a player reads over a
     bar and never a sentence about them. The MARK itself (♩ = 76) is a glyph
     and a number and is built by `ui/abc.js metMark`; only the rules in force
     are words, and only these are printed, because these are the only tempo
     rules the Time row deals. `swing` is `field.swing`: the Time row's own
     field name is the word a chart prints, and one meaning gets one key. */
  "mark.halfTime": "half time",
  "mark.doubleTime": "double time",
  /* two rules in force at one mark. A readout, not a sentence — the `·` join
     ui/video.js's caption already uses — so a translator orders the pair. */
  "mark.pair": "{a} · {b}",
  /* ===== THE EXPORT TAB ================================================= */
  "exportTab.link.sub": "Place, year, seed and current view",
  "exportTab.link.aria": "Link to this record",
  "exportTab.record.sub": "The whole song file",
  "exportTab.record.save": "Save the record",
  "exportTab.record.open": "Open a saved record",
  "exportTab.wav.sub": "WAV · 44.1 kHz · 16-bit",
  "exportTab.mid.sub": "MIDI type 1 · one track per player",
  "exportTab.als.sub": "One track per player · sections as scenes",
  /* ===== A VOICE'S OWN CONTROLS =========================================
     (the envelope row's name is `env.plate`, misc.ts — one word, one key.) */
  "knobs.sampled": "Sampled instrument — use the strip below",
  /* ===== THE TWO SPECIAL ROWS THIS FILE DRAWS THE FACE OF ================ */
  "rulesRow.none": "Default rules",
  "rulesRow.face.one": "{n} rule written · last {name}",
  "rulesRow.face.other": "{n} rules written · last {name}",
  "produceRow.none": "No notes yet",
  "produceRow.face": "{n} of {max} · {value}",
  "produceRow.faceCount": "{n} of {max}",
  /* ===== THE POINTER TO THE BOARD ======================================= */
  "boardLink.gain": "Record gain — main strip",
  /* ===== THE SEED ======================================================= */
  "seedRow.type.aria": "Seed — type {min}–{max}, then Enter",
  "seedRow.value.aria": "Seed {n}",
  /* THE FACT LIVES ON THE ARTIFACT. `precompose.js`'s two seed-gated blocks
     return null at seed ≤ 1, so 0 and 1 write the same song — and this page's
     law is that such a fact is said ON the control rather than in a comment.
     `test/seed.js` S4 reads it back off this explainer. */
  "seedRow.value.say": "Seed — the song's number; 0 and 1 write the same song",
  /* ===== THE HAMBURGER AND ITS LOG ====================================== */
  /* LOWER CASE, AND IT IS NOT A STYLE CHOICE. `test/gutter.js` T10 requires
     every mark's accessible name to BEGIN WITH ITS OWN `.nu-vh` word, and
     those two words — `menu` and `log` — are addresses five gates read back
     off the page (glyph.ts's header says which). A capital here reads as a
     second owner of the same name. */
  "burger.menuLog.one": "menu — {n} log line",
  "burger.menuLog.other": "menu — {n} log lines",
  "burger.log.one": "log ({n})",
  "burger.log.other": "log ({n})"
};

// nukernel/src/copy/produce.ts
var PRODUCE = {
  /* ===== WHY A WORD IS WITHHELD ==========================================
     Read by ui/produce.js (`subjects`, `targets`, the ceiling hint) and by
     producer.js (`speak`'s honest failures). Budget: 12 words. */
  "refuse.noDrums": "There are no drums on this record",
  "refuse.notPlaying": "Not playing on this record",
  "refuse.notHere": "Not on this record",
  "refuse.spent": "Already at the limit",
  "refuse.noMove": "Nothing here would change {name}",
  "refuse.noWords": "No words available for {name}",
  "refuse.notAWord": "Not available for {name}",
  "refuse.genreSilent": "{genre} does not change {name}",
  "refuse.ceiling": "That is {n} notes — take one off first",
  /* ===== THE CAST — the seventeen subjects a sentence can be about =======
     producer.js's SUBJ table holds these KEYS and reads them through a getter
     at print time (a classic script may not ask the catalogue at load). The
     chip's face and the sentence's object are the same string, so the row of
     chips and "make the drums harder" cannot spell one player two ways. */
  "produce.subj.record": "the sound",
  "produce.subj.drums": "the drums",
  "produce.subj.kick": "the kick",
  "produce.subj.snare": "the snare",
  "produce.subj.hats": "the hats",
  "produce.subj.toms": "the toms",
  "produce.subj.cymbals": "the cymbals",
  "produce.subj.perc": "the percussion",
  "produce.subj.bass": "the bass",
  "produce.subj.line": "the bass line",
  "produce.subj.bamp": "the bass sound",
  "produce.subj.keys": "the keys",
  "produce.subj.guitar": "the guitar",
  "produce.subj.amp": "the amp",
  "produce.subj.voice": "the voice",
  "produce.subj.tune": "the tune",
  "produce.subj.mix": "the mix",
  /* ===== THE SURFACE ===================================================== */
  "produce.name": "Producer",
  "produce.count": "{n} of {max} notes",
  /* THE SENTENCE THE TAPS BUILD, and producer.js `sentence` is its one
     assembler. Two keys rather than a ternary on the descriptor: a language
     that puts the quality first is a table edit here and nothing else. */
  "produce.sentence": "make {name} {quality}",
  "produce.sentenceBare": "make {name}",
  "produce.saying": "make {name} …",
  "produce.subject": "the {name}",
  "produce.thisNote": "this note",
  /* ===== THE NOTE STACK ================================================== */
  "produce.caption": "Applied in order",
  "produce.colNote": "Note",
  "produce.colAmount": "Amount",
  "produce.colResult": "Result",
  "produce.colChange": "Change",
  "produce.pushAgain": "Push this note further",
  "produce.onNote": "on {note}",
  "produce.takeOff": "Take off",
  "produce.clearAll": "Clear all notes",
  "produce.clearAll.title": "Remove every note from the record",
  "produce.orphan": "{name} is gone; its note too",
  /* WHAT ONE PRESS OF UNDO PUTS BACK — a whole sentence per move, because
     "Undo " + a fragment is the same bug the refusals had. */
  "produce.undo.note": "Undo — {note}",
  "produce.undo.more": "Undo more on {note}",
  "produce.undo.less": "Undo less on {note}",
  "produce.undo.off": "Undo removing {note}",
  "produce.undo.clear.one": "Undo clearing {n} note",
  "produce.undo.clear.other": "Undo clearing {n} notes",
  /* ===== THE TARGET SHEETS =============================================== */
  "produce.qualities": "Qualities",
  "produce.records": "Records",
  "produce.bareAdd.title": "Add {name} in this genre's style",
  "produce.hidden.one": "{n} more record this cannot change",
  "produce.hidden.other": "{n} more records this cannot change",
  /* HELD AS DATA BY producer.js's own verb row and printed by whoever draws
     it — the classic-script law: a table may carry a KEY, never a sentence. */
  "produce.makeSay": "Change the sound"
};

// nukernel/src/copy/board.ts
var BOARD = {
  /* ===== THE BOARD ITSELF =============================================== */
  "board.title": "The board",
  "board.legend": "Dim = default · bright = set",
  "board.legend.measured": "Dim = default · bright = set · green = measured",
  "board.tabs.aria": "Board stages",
  "board.tab.bus.title": "Board stage",
  "board.tab.auto.title": "Automation — fader trims per section",
  "board.rack.aria": "{name} plate",
  "board.routing": "Fixed routing",
  /* ===== ONE VOICE'S CHANNEL STRIP ====================================== */
  "board.strip.aria": "{name} strip",
  "board.strip.noChannel.why": "{name} has no channel on this song",
  "board.link.buses": "Buses on the board",
  "board.row.inserts": "Inserts · up to three, in order",
  "board.row.sends": "Sends · post-insert",
  "board.row.eq": "eq",
  "board.row.fader": "fader",
  /* THE PLAIN NOUNS ARE CORE'S — `noun.genre`, `noun.level`, `noun.meter`,
     `noun.tone`, `noun.automation`, `noun.instrument`, `state.solo` — and the
     main column takes the main plate's own name. One meaning, one key. */
  "board.col.listening": "listening",
  /* the label is the Time sheet's own word — `time.gain`. */
  "board.col.surface": "surface",
  "board.col.levelDelay": "level → delay",
  "board.col.returnMain": "return → main",
  "board.col.bleedReverb": "bleed → reverb",
  "board.col.wet": "wet",
  /* an insert slot: the seat, its wet knob, and the module's own two faces */
  "board.slot.insert.aria": "{name} insert {n}",
  "board.slot.insert.knob.aria": "{name} insert {n} {word}",
  "board.slot.effect.aria": "{name} effect {n}",
  "board.slot.effect.knob.aria": "{name} effect {n} {word}",
  "board.slot.face.aria": "{name} {fx} {label}",
  "board.send.aria.genre": "{name} send to the genre bus",
  "board.send.aria.bus": "{name} send to {bus}",
  "board.send.aria.main": "{name} send to the main",
  "board.send.rev.title": "The genre sends {value}; a part send adds to it",
  "board.bus.shut": "{name} (shut)",
  "board.eq.aria": "{name} {band}",
  "board.pan.aria": "{name} pan",
  "board.pan.btn.aria": "{name} pan {word}",
  "board.fader.aria": "{name} fader",
  "board.tgl.mute": "mute",
  "board.tgl.aria": "{name} {word}",
  /* ===== WHAT A CONTROL SAYS WHEN IT REFUSES ============================
     A refusal keeps its sentence on the control (DESIGN.md §2, component 14);
     what it stops doing is naming the module that measured it. */
  "board.mainSend.why": "The fader below is the dry path to the main",
  "board.mainSend.short": "on the fader",
  "board.stereo.why": "This player is stereo; an insert chain would fold it to mono",
  "board.sweepWet.why": "A filter sweep replaces the signal; there is no wet to move",
  "board.seatTaken.why": "Already in another slot",
  "board.sweepWet.short": "serial",
  "board.currentAnyway.why": "{why} · set on this song",
  "board.aria.refused": "{name} (refused)",
  "board.group.words": "as you say",
  /* ===== THE FOUR BUS PLATES ============================================ */
  /* EVERY PLATE HEADER STILL OPENS `in ← `. It is the board's own flow mark,
     not narrative, and nukernel/desk-gate.js asserts the prefix on all four. */
  "board.bus.genre.name": "genre fx bus",
  "board.bus.genre.in": "in ← genre sends · 3 effects",
  "board.bus.genre.chain": "Fed by the genre sends",
  "board.bus.genre.slots": "genre bus",
  "board.bus.echo.name": "delay bus",
  "board.bus.echo.in": "in ← {name} sends",
  "board.bus.rev.name": "reverb bus",
  "board.bus.rev.in": "in ← {name} sends + bleed",
  "board.bus.rev.shut.why": "The reverb return is closed; open it here",
  "board.bus.main.name": "main",
  "board.bus.main.plate": "main · the song",
  "board.bus.main.in": "in ← dry + reverb · out → the speakers",
  "board.bus.sel.called": "called",
  "board.bus.sel.time": "delay time",
  "board.bus.sel.repeats": "repeats",
  "board.bus.sel.reverbType": "reverb type",
  /* THE THREE CONNECTORS KEEP THEIR WORDS. They are the signal flow drawn
     in words — plain, inside budget, and nukernel/desk-gate.js reads all
     three back off the rendered plate to prove the series is on the page. */
  "board.flow.delay": "into the delay bus",
  "board.flow.reverb": "into the reverb bus",
  "board.flow.main": "into main — the record",
  "board.aria.genreLevel": "Genre → delay send",
  "board.aria.echoRet": "delay bus return",
  "board.aria.echoBleed": "Delay bleed into the reverb",
  "board.aria.revRet": "reverb bus return",
  /* ===== THE MASTER ===================================================== */
  "board.master.off": "Master off — every stage bypassed",
  "board.master.on": "Turn the master off",
  "board.master.off.title": "Every master effect is off; the air shelf and band limits stay",
  "board.master.on.title": "Reset all master effects",
  "board.aria.surface": "surface noise",
  "board.surface.clean": "clean",
  "board.aria.listening": "listening level",
  "board.listening.why": "Room only — not saved",
  /* ===== THE SECTION-AUTOMATION GRID ==================================== */
  "board.auto.label": "section automation",
  "board.auto.rowlab": "Automation — fader trim per section",
  "board.col.aria.on": "{name} on {inst}",
  "board.col.title": "Open {name}'s instrument",
  "board.row.aria": "Play from {name}",
  "board.row.title": "Preview from here — jumps at the next bar",
  "board.row.sub": "{bars} · {dealt}",
  "board.cell.say": "{name} in {section}",
  /* THE TWENTY-ONE VARIANTS, AS TWO SENTENCES. `{value}` arrives as
     `fmt(db, "dB")` — the sign and the decimal are the formatter's. */
  "board.cell.default.title": "Default level — the fader stands",
  "board.cell.derived.title": "Default {value} from the section",
  "board.cell.derivedTone.title": "Default {value} and a tone move from the section",
  "board.cell.setSilent.title": "{word} — silent in this section",
  "board.cell.setDb.title": "{word} — {value} on this fader for this section",
  /* ===== WHAT THE ENGINE SAYS, AND HOW LOUD IT IS ======================= */
  "board.model.level": "model {value} dB",
  "board.model.bus": "model · in {in} · out {out}",
  "board.model.bus.ret": "model · in {in} · return {ret} · out {out}",
  "board.drive.title": "Modelled channel level",
  "board.meter.title": "Master level",
  "board.meter.frame": "measured rms — per frame",
  "board.meter.bar": "measured rms — per bar",
  "board.meter.none": "not yet measured — plays first",
  "board.meter.live": "live",
  "board.meter.wait": "…",
  "board.meter.stopped": "stopped",
  /* ===== A SEAT'S FACE IN THE BAND TABLE ================================ */
  "board.seat.noChannel": "no channel",
  "board.count.fx.one": "{n} fx",
  "board.count.fx.other": "{n} fx"
};

// nukernel/src/copy/glyph.ts
var GLYPHS = {
  /* ===== THE TWO SONG-LEVEL TABS ======================================== */
  "glyph.song.form": "form",
  "glyph.song.form.say": "Sections and their settings",
  /* the word is the PERFORMANCE row's own — `special.perf.word`. */
  "glyph.song.performance.say": "Take, humanize and timing",
  /* ===== THE TABS — the word is ui/eight.js TABS' own key =============== */
  "glyph.tab.rules": "Rules",
  "glyph.tab.rules.say": "The rules this song was written from",
  "glyph.tab.where": "Where",
  "glyph.tab.where.say": "Place and year",
  "glyph.tab.time": "Time",
  "glyph.tab.time.say": "Tempo, meter and key",
  /* THE GLOSSARY WENT BACK (2026-09-05, TABLE.md §13e, Paul: *"Call phrases
     motifs"*). The tab's ADDRESS was always `Motifs` — in ui/eight.js and in
     eleven gates — and the printed word is that word again. */
  "glyph.tab.motifs": "Motifs",
  "glyph.tab.motifs.say": "The song's tunes and beats",
  "glyph.tab.band": "Band",
  "glyph.tab.band.say": "Sections down, players across",
  "glyph.tab.mix": "Mix",
  "glyph.tab.mix.say": "Buses: genre effects, delay, reverb, main",
  "glyph.tab.produce": "Produce",
  "glyph.tab.produce.say": "Producer — one step through genre space",
  "glyph.tab.score": "Score",
  "glyph.tab.score.say": "Notation and piano roll",
  "glyph.tab.video": "Video",
  "glyph.tab.video.say": "Video, cut to the song's sections",
  "glyph.tab.screensaver": "Screensaver",
  "glyph.tab.screensaver.say": "Animated players",
  "glyph.tab.export": "Export",
  "glyph.tab.export.say": "Export: link, WAV or MIDI",
  /* ===== THE TRANSPORT — "play" and "stop" are read by five gates ======= */
  "glyph.act.play": "play",
  "glyph.act.play.say": "Play from the top",
  "glyph.act.stop": "stop",
  /* the explainer is core's `act.stop` — one word, one key. */
  "glyph.act.rewrite": "rewrite",
  "glyph.act.rewrite.say": "New seed, same place",
  /* the WORD is core's `noun.take`. */
  "glyph.act.take.say": "New take",
  "glyph.act.opts": "opts",
  "glyph.act.opts.say": "Playback options",
  "glyph.act.menu": "menu",
  "glyph.act.menu.say": "Score, video, screensaver, export and log",
  "glyph.act.close": "close",
  "glyph.act.close.say": "Back to the song",
  /* ...AND ONE MORE, 2026-09-05 (TABLE.md §13a.5): the `+` at each edge of the
     grid. The three adder buttons in the head row and the one under the last
     section are one mark now, and the mark opens the ADD sheet. */
  "glyph.act.add": "add",
  "glyph.act.add.say": "Add a player or a section",
  /* the WORD is core's `noun.seed`, and the die's two names share one
     explainer — `glyph.act.rewrite.say` — because they are one button. */
  "glyph.act.tap": "tap",
  "glyph.act.tap.say": "Tap tempo",
  /* ===== THE BUS SERIES — the words come off fields.js `busLabel` ======= */
  "glyph.bus.genre.say": "Genre effects — the first bus",
  "glyph.bus.echo.say": "Delay bus",
  "glyph.bus.rev.say": "Reverb bus",
  "glyph.bus.main.say": "Main bus — the output",
  /* ===== THE ONE MOVE THAT IS NOT A SIBLING (nothing draws it today) ==== */
  "glyph.nav.up": "up",
  "glyph.nav.up.say": "Up, out of {parent}",
  "glyph.nav.up.sayBack": "Up, out of {parent}, back to {back}",
  /* ===== THE LOG — the head of the name is read by test/shell.js A6d ==== */
  "glyph.log": "log",
  "glyph.log.say": "Every change you made, newest first",
  "glyph.log.count.one": "log — {n} line",
  "glyph.log.count.other": "log — {n} lines",
  "glyph.log.empty": "log — nothing yet",
  /* ===== THE SECTIONS =================================================== */
  "glyph.sec.list": "sections",
  "glyph.sec.list.say": "Every section, by name",
  /* the singular is core's `noun.section`. */
  /* the verb is the table's own — `op.addSection`. */
  "glyph.sec.add.say": "Add a section below",
  "glyph.sec.up": "move up",
  "glyph.sec.up.say": "Move section up",
  "glyph.sec.down": "move down",
  "glyph.sec.down.say": "Move section down",
  /* the verb is the table's own — `op.remove`. */
  "glyph.sec.drop.say": "Delete this section",
  /* ===== WHAT A PLAYER IS, IN FIVE FACETS =============================== */
  /* the word is core's `noun.instrument`. */
  "glyph.facet.inst.say": "Instrument and voice",
  /* the word is the MIX row's own — `special.mix.word`. */
  "glyph.facet.mix.say": "Channel strip — inserts, sends, tone and level",
  "glyph.facet.plays": "what it plays",
  "glyph.facet.plays.say": "Part, register, entry and default motif",
  "glyph.facet.sec": "per-section",
  "glyph.facet.sec.say": "What this player does, section by section",
  "glyph.facet.samples": "samples",
  "glyph.facet.samples.say": "Recordings, loop points and replacements",
  /* ===== THE TABLE'S OWN MARKS — a cell's word and its explainer ======== */
  "glyph.cell.part.line": "Line",
  "glyph.cell.part.line.say": "A melodic part.",
  "glyph.cell.part.lead": "Lead",
  "glyph.cell.part.lead.say": "The tune, out in front.",
  "glyph.cell.part.riff": "Riff",
  "glyph.cell.part.riff.say": "A repeating figure under the tune.",
  "glyph.cell.part.counter": "Counter",
  "glyph.cell.part.counter.say": "A countermelody against the tune.",
  "glyph.cell.part.pad": "Pad",
  "glyph.cell.part.pad.say": "Held chords underneath.",
  "glyph.cell.part.stab": "Stab",
  "glyph.cell.part.stab.say": "Short chord hits on the changes.",
  "glyph.cell.part.drone": "Drone",
  "glyph.cell.part.drone.say": "One note held through the section.",
  "glyph.cell.part.bass": "Bass",
  "glyph.cell.part.bass.say": "The bass part.",
  "glyph.cell.part.drums": "Drums",
  "glyph.cell.part.drums.say": "The kit.",
  "glyph.cell.prov.own": "From this genre",
  "glyph.cell.prov.own.say": "Motif from this song's genre.",
  "glyph.cell.prov.guest": "From a guest",
  "glyph.cell.prov.guest.say": "Motif from a guest genre.",
  "glyph.cell.prov.hand": "Edited",
  "glyph.cell.prov.hand.say": "Motif edited by hand.",
  "glyph.cell.level.out": "Out",
  "glyph.cell.level.out.say": "Out of the mix.",
  "glyph.cell.level.hush": "Hushed",
  "glyph.cell.level.hush.say": "6 dB down.",
  "glyph.cell.level.back": "Back",
  "glyph.cell.level.back.say": "2.5 dB down.",
  "glyph.cell.level.norm.say": "Default level.",
  "glyph.cell.level.fwd": "Forward",
  "glyph.cell.level.fwd.say": "2.5 dB up.",
  "glyph.cell.level.lift": "Lifted",
  "glyph.cell.level.lift.say": "5 dB up.",
  "glyph.cell.state.none.say": "Nothing set here; plays the default.",
  /* ===== THE DECK'S TWO VIEWS =========================================== */
  "glyph.view.not": "notation",
  "glyph.view.not.say": "Engraved notation, as printed",
  "glyph.view.roll": "piano roll",
  "glyph.view.roll.say": "Blocks — pitch up, time across",
  /* ===== WHAT A PLAYER'S TAB SAYS WHEN YOU HOLD IT ====================== */
  "glyph.voice.plain.say": "{name} — player {n} of {of}",
  "glyph.voice.line.say": "{name} — player {n} of {of}, a line",
  "glyph.voice.bass.say": "{name} — player {n} of {of}, the bass",
  "glyph.voice.drums.say": "{name} — player {n} of {of}, the kit",
  /* ===== A MARK THAT CANNOT BE PRESSED SAYS WHY, IN ITS OWN NAME ======== */
  "glyph.icon.refused": "{word}, {why}"
};

// nukernel/src/copy/knobs.ts
var KNOBS = {
  /* ===== THE FILTER ===================================================== */
  "knobs.cutoff": "Filter cutoff",
  "knobs.resonance": "Resonance",
  "knobs.filterMode": "Filter mode",
  "knobs.filterEnvAmount": "Filter envelope amount",
  "knobs.filterEnvAttack": "Filter envelope attack",
  "knobs.filterEnvDecay": "Filter envelope decay",
  "knobs.filterEnvSustain": "Filter envelope sustain",
  "knobs.keyTracking": "Filter key tracking",
  "knobs.lfoToFilter": "LFO to filter",
  /* ===== THE OSCILLATORS ================================================ */
  "knobs.oscMix": "Oscillator mix",
  "knobs.waveform": "Waveform",
  "knobs.voiceCount": "Voices",
  "knobs.subLevel": "Sub level",
  "knobs.subOctave": "Sub-octave",
  /* the Solina's 8'/4' body, which is a FOOTING mix and not a sub. */
  "knobs.octaveMix": "Octave mix",
  "knobs.sawLevel": "Saw level",
  "knobs.pulseLevel": "Pulse level",
  "knobs.noiseLevel": "Noise level",
  "knobs.pulseWidth": "Pulse width",
  "knobs.pulseWidthDepth": "Pulse width depth",
  "knobs.detune": "Detune",
  /* a choir's `spread` is how far the throats are out of tune with each
     other; a Juno's is antiphase in the stereo field. One word, two facts —
     the extractor scopes them by module, exactly as it scopes a unit. */
  "knobs.detuneSpread": "Detune spread",
  "knobs.stereoWidth": "Stereo width",
  "knobs.drift": "Oscillator drift",
  "knobs.osc2Tune": "Oscillator 2 tune",
  "knobs.osc2Lfo": "Oscillator 2 LFO",
  "knobs.lfoRate": "LFO rate",
  /* the row is a TIME (ms on the fleet, seconds on a waveguide), so the noun
     says so — and `rule.headGlide` is the rules deck's own heading. */
  "knobs.glide": "Glide time",
  /* ===== FM, SYNC AND PHASE ============================================= */
  "knobs.fmRatio": "Operator ratio",
  "knobs.fmIndexStart": "Attack index",
  "knobs.fmIndexEnd": "Settled index",
  "knobs.fmIndexTime": "Index time",
  "knobs.phaseMod": "Phase modulation",
  "knobs.phaseModFilter": "Phase modulation to filter",
  "knobs.syncRatio": "Sync ratio",
  "knobs.syncSweep": "Sync sweep",
  "knobs.syncDecay": "Sync decay",
  /* ===== THE WAVETABLE AND THE PHASE-DISTORTION WAVE ==================== */
  "knobs.scanPosition": "Wavetable position",
  "knobs.scanEnv": "Scan envelope amount",
  "knobs.scanLfo": "Scan LFO amount",
  "knobs.scanRate": "Scan rate",
  "knobs.waveDistortion": "Wave distortion",
  "knobs.distortionEnvAmount": "Distortion envelope amount",
  "knobs.distortionAttack": "Distortion attack",
  "knobs.distortionDecay": "Distortion decay",
  "knobs.distortionSustain": "Distortion sustain",
  /* ===== TONE, DRIVE AND THE BUILT-IN EFFECTS ========================== */
  "knobs.tone": "Tone",
  "knobs.brightness": "Brightness",
  "knobs.drive": "Drive",
  "knobs.chorus": "Chorus",
  "knobs.chorusRate": "Chorus rate",
  "knobs.chorusDepth": "Chorus depth",
  "knobs.ensemble": "Ensemble",
  "knobs.leslie": "Leslie",
  "knobs.vibrato": "Vibrato",
  "knobs.vibratoRate": "Vibrato rate",
  "knobs.vibratoDelay": "Vibrato delay",
  "knobs.wobbleRate": "Wobble rate",
  /* ===== THE HAMMOND, IN ITS OWN VOCABULARY =============================
     Nine harmonics named by ORGAN PIPE LENGTH, which is the only naming under
     which "888000000" means anything, and the only one an organist uses. */
  "knobs.bar16": "16' sub-octave",
  "knobs.bar513": "5 1/3' fifth",
  "knobs.bar8": "8' fundamental",
  "knobs.bar4": "4' octave",
  "knobs.bar223": "2 2/3' twelfth",
  "knobs.bar2": "2' fifteenth",
  "knobs.bar135": "1 3/5' seventeenth",
  "knobs.bar113": "1 1/3' nineteenth",
  "knobs.bar1": "1' twenty-second",
  "knobs.percussion": "Percussion",
  "knobs.percussionHarmonic": "Percussion harmonic",
  "knobs.percussionDecay": "Percussion decay",
  "knobs.keyClick": "Key click",
  "knobs.leakage": "Drawbar leakage",
  /* ===== THE PHYSICAL MODELS: a string, a bar, a bow ==================== */
  "knobs.stiffness": "String stiffness",
  "knobs.ringTime": "Ring time",
  "knobs.pluckPosition": "Pluck position",
  "knobs.pickupPosition": "Pickup position",
  "knobs.strikePosition": "Strike position",
  "knobs.partialTilt": "Partial tilt",
  "knobs.bowPressure": "Bow pressure",
  "knobs.bowSpeed": "Bow speed",
  "knobs.bowPosition": "Bow position",
  /* the erhu's python skin is the radiator and the qin dian damps it. */
  "knobs.skin": "Skin resonance",
  "knobs.bridgePad": "Bridge pad",
  /* ===== THE THROAT AND THE TUBE ========================================
     A singer and a vocal tract, named for the organ rather than for the
     gesture: the control is a place or an amount, and "how far the mouth
     moves" was a caption. */
  "knobs.voiceType": "Voice type",
  "knobs.breath": "Breath",
  "knobs.glottis": "Glottis opening",
  "knobs.voicing": "Voicing",
  "knobs.nasality": "Nasality",
  "knobs.hiss": "Hiss",
  "knobs.hissPosition": "Hiss position",
  "knobs.articulation": "Articulation",
  "knobs.tonguePosition": "Tongue position",
  "knobs.tongueReach": "Tongue reach",
  "knobs.tongueLength": "Tongue length",
  "knobs.lips": "Lips",
  "knobs.vowel": "Vowel",
  "knobs.vowels": "Vowels",
  "knobs.syllableLength": "Syllable length",
  "knobs.vowelDrift": "Vowel drift",
  "knobs.foldDrift": "Fold drift",
  "knobs.foldDriftRate": "Fold drift rate",
  "knobs.babble": "Babble",
  "knobs.babbleRate": "Babble rate",
  "knobs.babbleSeed": "Babble seed",
  /* ===== A VOICE WHOSE ONE CONTROL IS A PATCH =========================== */
  "knobs.cartridge": "Cartridge"
};

// nukernel/src/copy/atlas.ts
var ATLAS = {
  /* ===== THE GLOBE ====================================================== */
  "atlas.globe.aria": "Globe of records — drag to turn, plus and minus to zoom",
  "atlas.mark.aria": "{place} {year}, {name}",
  /* a place inside a larger one: "Greenwich Village, in New York 1964, folkduo" */
  "atlas.markWithin.aria": "{place}, in {region} {year}, {name}",
  /* ===== THE GENRE INDEX ================================================ */
  "atlas.index.aria": "All {n} genres, oldest first",
  "atlas.row.aria": "Play {name} — {place}, {year}",
  /* the seven rows that are not places: a part, and the empty record */
  "atlas.rowRole.aria": "Play {name}",
  "atlas.place.any": "any place",
  "atlas.place.none": "no place",
  /* ===== THE ARTICLE MARK (the ↗ in the fourth column) ================== */
  "atlas.wiki.title": "Open {name} on Wikipedia",
  "atlas.wiki.aria": "{name} on Wikipedia",
  /* an article that is not the genre itself — the broader subject, the work,
     the artist. The word rides beside the name in its own quiet span. */
  "atlas.wiki.kind": "· the {kind}",
  "atlas.wiki.kindAria": "{name} · the {kind} on Wikipedia",
  /* ===== A ROW WITH NO ARTICLE ==========================================
     Three reasons, three sentences, and none of them is the research note.
     Each is also the row's `data-why`, which two gates read back off the
     rendered page to prove that a row with no link still says why. */
  "atlas.noArticle": "No Wikipedia article",
  "atlas.noArticle.aria": "{name}, no Wikipedia article",
  "atlas.role.say": "A part, not a genre — plays anywhere",
  "atlas.role.aria": "{name} — a part, not a genre",
  "atlas.silence.say": "Empty — nothing chosen yet",
  "atlas.silence.aria": "{name} — nothing chosen yet",
  /* ===== THE YEAR, IN WORDS ============================================= */
  "atlas.yearSay": "{year} · {records} within ten years · {places}",
  "atlas.record.one": "{n} record",
  "atlas.record.other": "{n} records",
  "atlas.places.more": "{places}, +{n} more",
  /* ===== WRITING A RECORD =============================================== */
  "atlas.writing": "Writing {where}…",
  "atlas.wrote": "{where} · {name} — {sections}, {voices}, take {take}",
  "atlas.wroteSeed": "{where} · {name} — {sections}, {voices}, take {take} · seed {seed}",
  "atlas.cannotWrite": "Cannot write {name} yet",
  "atlas.pickPlace": "Pick a place first",
  "atlas.noRecordAt": "{place} — no record at {year}",
  "atlas.noPlace.say": "{name} has no place on the map",
  /* ===== A SHARE LINK THAT DOES NOT RESOLVE ============================= */
  "atlas.linkNoPlace.say": "{place} is not a place on this globe",
  "atlas.linkBlank.say": "That link names no place on this globe",
  "atlas.linkYear.say": "{year} is not a year",
  "atlas.linkRecord.say": "{place} has no record on this globe"
};

// nukernel/src/copy/rules.ts
var RULES = {
  /* ===== THE LINEAGE BLOCK (ui/xtab.js, drawn inside the Rules deck) ===== */
  "kin.heading": "Lineage",
  "kin.parents": "parents",
  "kin.noParents": "none — this genre is a root",
  "kin.thisRecord": "{name} — this song",
  "kin.aRole": "{weight} — a part, not a genre",
  "kin.owed": "not in the catalogue yet: {list}",
  "kin.col.fact": "fact",
  /* ===== THE EIGHT AXES, AS HEADINGS ====================================
     `rules.js AXES` holds the eight words AXES.md names, and they are
     ADDRESSES: `r.axis`, `section[data-axis]`, and the guard that refuses a
     ninth. What a reader SEES is this table, so the review's glossary reaches
     the deck without moving an address — "Alphabet" is the axis, `Scale` is
     the heading (TABLE.md §12a: alphabet → scale). */
  "axis.time": "Time",
  "axis.alphabet": "Scale",
  "axis.material": "Material",
  "axis.form": "Form",
  "axis.development": "Development",
  "axis.cast": "Cast",
  "axis.sound": "Sound",
  "axis.performance": "Performance",
  /* ===== THE PANEL ====================================================== */
  "rule.deckName": "The rules",
  "rule.addRule": "+ add a rule",
  "rule.addRuleTo": "Add a rule to {name}",
  "rule.allRulesOn": "All rules are already on.",
  "rule.reset": "Reset {name}",
  "rule.noAnchor": "No genre named {name}",
  "rule.nothingToAnswer": "Nothing to answer for",
  "rule.kinFrom": "From {value}",
  "rule.kinTo": "To {value}",
  /* ===== THE TIER — what an edit to this row costs (rules.js TIERS) ===== */
  "rule.tierRow": "Changes nothing that plays.",
  "rule.tierRender": "Takes effect at the next bar.",
  "rule.tierCompose": "Song written again at this seed.",
  /* ===== WHY A ROW DOES NOT MOVE ======================================== */
  "rule.setByGenre": "Set by the genre.",
  "rule.setOnPlayerRow": "Set on each player's row.",
  "rule.setWhenInvented": "Set where a genre is invented.",
  "rule.chordsWritten": "The chords are written out.",
  "rule.noChordCycle": "A {value} song has no chords.",
  "rule.noCycleToBorrow": "No chords here to borrow.",
  "rule.noPlayers": "No player is seated.",
  "rule.noBass": "This song has no bass.",
  "rule.noDrums": "This song has no drum grid.",
  "rule.holdCapped": "The longest note wins at {n}.",
  /* THE EDITOR IS THE MOTIF BANK'S (2026-09-05, TABLE.md §13e: *"Call
     phrases motifs"*). `rule.headPhraseLength` below is NOT renamed with
     them: a phrase length and a phrase structure are the form's own terms in
     the Development axis, not the bank's thing. */
  "rule.phraseEditor": "Edited in the motif editor.",
  "rule.phrasesEdited": "Edit motifs in the motif editor.",
  "rule.chordsFromKey": "Chords come from the Key panel.",
  /* ===== THE NAME ON A RULE ROW ========================================= */
  "rule.headTempoGive": "Tempo give",
  "rule.headMeter": "Meter",
  "rule.headSectionSpeed": "Section speed",
  "rule.headHarmony": "Harmony",
  "rule.headRoots": "Roots",
  "rule.headBorrowed": "Borrowed chords",
  "rule.headArrangement": "Arrangement",
  "rule.headLoop": "Loop",
  "rule.headPlayers": "Players",
  "rule.headParts": "Parts",
  "rule.headInstruments": "Instruments",
  "rule.headSinging": "Singing",
  "rule.headModelled": "Modelled or recorded",
  "rule.headBass": "Bass part",
  "rule.headBassFigure": "Bass figure",
  "rule.headBassInstrument": "Bass instrument",
  "rule.headEntry": "Entry",
  "rule.headParents": "Comes from",
  "rule.headContour": "Contour",
  "rule.headPhraseLength": "Phrase length",
  "rule.headLanding": "Landing",
  "rule.headKit": "Kit",
  "rule.headGlide": "Glide",
  "rule.headSlide": "Slide",
  "rule.headTouch": "Touch",
  "rule.headWobble": "Wobble",
  "rule.headDrumGrid": "Drum grid",
  "rule.headSectionGrids": "Section grids",
  "rule.headVelocities": "Velocities",
  "rule.headChances": "Chances",
  "rule.headBassGrid": "Bass grid",
  "rule.headGhost": "Ghost notes",
  /* ===== THE UNIT AFTER THE CONTROL ===================================== */
  "rule.unitBPM": "BPM",
  "rule.unitSteps": "steps",
  "rule.unitTimes": "times",
  /* ===== THE ANSWER, WHERE THE ANSWER IS A WORD AND NOT A NUMBER ======== */
  "rule.planDance": "Dance record",
  "rule.planArc": "Single arc",
  "rule.planSong": "Song",
  "rule.formFalls": "However the form falls",
  "rule.oneChord": "One chord, and it stays",
  "rule.tonic": "On the tonic",
  "rule.modesOwnNotes": "The mode's own notes",
  "rule.staysInKey": "Stays in the key",
  "rule.followsChords": "Follows the chords",
  "rule.sung": "May be sung",
  "rule.notSung": "Nobody sings",
  "rule.recorded": "Recorded, not modelled",
  "rule.modelled": "Modelled by the engine",
  "rule.noBassPlays": "No bass",
  "rule.bassPlays": "A bass plays under it",
  "rule.nobodySeated": "Nobody is seated",
  "rule.atTheTop": "At the top",
  "rule.barsList": "Bars {value}",
  "rule.fromNothing": "Nothing in the catalogue",
  "rule.holdsAsArticulated": "As long as the articulation allows",
  "rule.figureUnwritten": "Not written down",
  "rule.lands": "Lands where it lands",
  "rule.ghostUnwritten": "Not written",
  "rule.machineHand": "A machine",
  "rule.square": "Lands square"
};

// nukernel/src/copy/fields.ts
var FIELDS = {
  /* ===== THE FIVE A CELL AND ITS ROW BOTH ANSWER (fields.js CELLVEC) ==== */
  "field.articulation": "articulation",
  "field.octave": "octave",
  "field.timeShift": "time shift",
  "field.speed": "speed",
  "field.scale": "scale",
  "field.rampLimit": "ramp limit",
  /* ===== THE SECTION'S OWN CONTROLS (fields.js FIELDS, the axis rows) === */
  "field.level": "level",
  "field.intro": "intro",
  "field.outro": "outro",
  "field.dynamics": "dynamics",
  "field.filter": "filter",
  "field.start": "start",
  "field.phraseStructure": "phrase structure",
  "field.noteLength": "note length",
  "field.afterNote": "after the note",
  "field.tempo": "tempo",
  /* ===== THE SECTION'S HARMONY, FEEL AND CHAIN (avail.js ROWFACTS) ====== */
  "field.key": "key",
  "field.mode": "mode",
  "field.chords": "chords",
  "field.swing": "swing",
  "field.groove": "groove",
  "field.effects": "effects",
  "field.reverb": "reverb",
  "field.echo": "echo",
  "field.echoTime": "echo time",
  "field.room": "room",
  "field.pan": "pan",
  /* ===== THE PERFORMANCE ROWS (askable.js `label`, drawn by avail.js) === */
  "field.push": "push",
  "field.phrasing": "phrasing",
  "field.longestNote": "longest note",
  "field.ornament": "ornament",
  "field.melody": "melody",
  "field.hats": "hats",
  "field.fill": "fill",
  /* ===== THE VALUES THAT ARE NOT DEFAULT ===============================
     `as written` is a REAL answer on `time.rate` (a reading speed of exactly
     1) and sits one row under the empty detent, which says `default`. It is
     the one word this pass kept out of the consolidation, for that reason. */
  "value.asWritten": "as written",
  "value.straight": "straight",
  "value.commonTime": "4/4",
  /* ===== THE HARMONY WORDS (avail.js's fallback for genres.js) ==========
     genres.js HARMONYLABEL is the LIVE owner of these three and carries the
     same three sentences in its own prose; this is what avail.js falls back
     to on a tree where that row has not landed. */
  /* the empty detent on the groove menu: no groove written is the grid
     itself, which is `ui/state.js`'s own word for null and not a new one. */
  "value.onTheGrid": "the grid",
  "value.harmonyModal": "Modal — one mode, no chords",
  "value.harmonyCycle": "Cycle — repeating chords",
  "value.harmonyEmergent": "Emergent — chords from the parts",
  /* …and what it is worth when no part voices a chord (2026-09-05, measured:
     11 of the 13 rows that declare it render exactly as Modal, because every
     chair on them plays a line). */
  "harmony.emergent.why": "No part voices chords, so this sounds like Modal. Add a pad.",
  /* ===== HOW THE RECORD IS PLAYED, AND WHO SINGS (fields.js) ============ */
  "play.loop": "Repeats at the end",
  "play.once": "Plays to the end and stops",
  "play.album": "Writes another song and plays it",
  "voicing.sung": "The singers sing it",
  "voicing.instruments": "An instrument takes the vocal line",
  "voicing.analog": "The vocal parts on analogue synthesis",
  "voicing.fm": "The vocal parts on two-operator FM",
  "voicing.chorus": "Sampled voices from tape",
  /* ===== WHY A WORD IS NOT ON OFFER ===================================== */
  "refuse.oneBarSection": "Not available in a one-bar section",
  "refuse.oneBarPeriod": "Only one bar here for it to run over",
  "refuse.noChordToStrum": "Nobody is voicing a chord to strum"
};

// nukernel/src/copy/misc.ts
var MISC = {
  /* ===== THE ENVELOPE EDITOR (src/envelope) ============================
     The plate is one control with four to six handles, and a handle is a
     `role="slider"` — so its accessible name is the STAGE and the VALUE, and
     nothing else. "drag, or the arrow keys; press and hold to clear" used to
     ride every one of them; the role and the value already say what a slider
     is, the gesture law is DESIGN.md §3, and a screen reader is not read an
     instruction manual once per handle. */
  "env.plate": "Envelope",
  /* THE STAGES, NAMED HERE AND NOT BY THE CALLER. knobs.js calls sustain
     "where it rests" on one instrument and "sustain" on the next; a handle
     that changes its word with the instrument under it is six controls. */
  "env.seg.delay": "Delay",
  "env.seg.attack": "Attack",
  "env.seg.hold": "Hold",
  "env.seg.decay": "Decay",
  "env.seg.sustain": "Sustain",
  "env.seg.release": "Release",
  /* what a handle is called: the stage, then the value in its own unit. */
  "env.handle": "{name} {value}",
  /* ...and when the engine has no port for it, the reason instead. */
  "env.handleWhy": "{name} {value} — {why}",
  "env.clearBack": "Reset {name} to default",
  /* the breakpoint lane, the same plate with anonymous points. */
  "env.point": "Point {n}",
  "env.pointAt": "{value} at {at}",
  "env.lane.one": "{name} — {n} point over {span}",
  "env.lane.other": "{name} — {n} points over {span}",
  "env.points.one": "{n} point over {span}",
  "env.points.other": "{n} points over {span}",
  /* ===== MENUS (src/menus) ============================================= */
  /* the record is standing on nothing yet. */
  "menu.choose": "Choose one",
  /* ...or on a word no table has, which is a fault in the record and says so
     rather than being quietly rewritten. */
  "menu.unknown": "{name} — not in this table",
  /* a filter that matched nothing. */
  "menu.noMatch": "No match",
  /* a control with an empty vocabulary: never blank, always a reason. */
  "menu.empty": "Nothing to choose here",
  /* THE ONE PLACE A REASON IS JOINED TO A NAME — a refused word in a list, or
     a whole control that is unavailable. One shape, so the three widgets
     cannot drift apart and a gate can look for exactly this. */
  "menu.withWhy": "{name}, {why}",
  /* ===== THE FILM DECK (ui/video.js) =================================== */
  "video.title": "The film",
  "video.noSections": "This record has no sections yet.",
  "video.noClips": "No clips available.",
  "video.noVideo": "Video is unavailable here.",
  "video.pause": "Pause",
  "video.cut": "Cut",
  "video.fullScreen": "Full screen",
  "video.paused": "Paused",
  "video.stopped": "Stopped",
  /* the readout under the picture: where the record is, and what is on screen.
     A `·`-joined value string, measured segment by segment. */
  "video.bar": "bar {n}/{of}",
  "video.cap": "{bar} · {role} · {mode} · {clip}",
  "video.capBehind": "{bar} · {role} · {mode} · {clip} ← {pct} {behind}",
  /* ===== THE FLOOR (ui/screensaver.js) ================================= */
  "saver.title": "The floor",
  /* the deck cannot draw here — no WebGL, or the rig would not load. The
     exception itself goes to the console; a user is told what is true. */
  "saver.noFloor": "The floor is unavailable here."
};

// nukernel/src/copy/shell.ts
var SHELL = {
  "shell.where": "Where & when",
  /* the <nav> landmark. It said "the box" — the app naming itself, which is
     the audit's own banned family. A landmark is named for what it holds. */
  "shell.chrome": "Controls",
  /* ===== HOLDING THE RECORD FOR OFFLINE PLAY (nukernel/audio/offline.js) ==
     THE WORDS ARE UNCHANGED ON PURPOSE. `test/hold.test.js` H1 and
     `test/commute.test.js` read "held — plays offline" off the rendered page
     in eleven places, and it is the one sentence on this surface a person acts
     on before a tunnel. This round moves WHERE it lives — one catalogue, so a
     second language reaches it — and not what it says. */
  "hold.held": "held — plays offline",
  "hold.holding": "holding the record",
  "hold.notSettled": "not held — the record would not settle",
  "hold.progress": "holding {n} of {total}",
  "hold.allBut.one": "held all but {n} — {name} would not come",
  "hold.allBut.other": "held all but {n} — {name} and {rest} more would not come",
  /* the word grid (ui/wordgrid.js) */
  "grid.cell.ariaDefault": ", default",
  "grid.cell.ariaWhy": "{name}: {value}, {why}",
  "grid.actsOn": "What it acts on",
  "grid.clearBack.aria": "Set {name} back to default",
  /* the sample crate (ui/samples.js). The button's word is core's `act.play`
     — one meaning, one key. */
  "crate.hear.aria": "Play {name} on its own",
  "crate.hearBusy.aria": "Play {name} on its own — stop playback first",
  "crate.busy.why": "Stop playback to hear one file on its own",
  /* a row the page cannot fetch: it is listed because the genre dealt it, and
     it says why it cannot be heard. (The engine drops a remote row out of a
     collage before it builds a zone — a file without CORP cannot be fetched on
     a cross-origin-isolated page at all.) */
  "crate.noFile.why": "This file cannot be loaded here",
  "crate.noFile.aria": "{name} — this file cannot be loaded here",
  /* the word grid's corner and its empty cell */
  "grid.corner": "Section"
};

// nukernel/src/copy/strings.ts
function merge(pages) {
  const out = {};
  const from = {};
  for (const [page, table] of pages)
    for (const k of Object.keys(table)) {
      if (Object.prototype.hasOwnProperty.call(out, k))
        throw new Error('copy: the key "' + k + '" is written twice — ' + from[k] + " and " + page);
      out[k] = table[k];
      from[k] = page;
    }
  return out;
}
var STRINGS = merge([
  ["core", CORE],
  ["table", TABLE],
  ["sheets", SHEETS],
  ["produce", PRODUCE],
  ["board", BOARD],
  ["glyph", GLYPHS],
  ["knobs", KNOBS],
  ["atlas", ATLAS],
  ["rules", RULES],
  ["fields", FIELDS],
  ["misc", MISC],
  ["shell", SHELL]
]);

// nukernel/src/copy/index.ts
var { t, tn, has } = make(STRINGS);
function stamp() {
  const d = globalThis.document;
  if (!d) return;
  const go = () => {
    for (const el of Array.from(d.querySelectorAll("[data-copy]")))
      el.textContent = t(el.getAttribute("data-copy") || "");
    for (const el of Array.from(d.querySelectorAll("[data-copy-aria]")))
      el.setAttribute("aria-label", t(el.getAttribute("data-copy-aria") || ""));
    for (const el of Array.from(d.querySelectorAll("[data-copy-title]")))
      el.setAttribute("title", t(el.getAttribute("data-copy-title") || ""));
  };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}
Object.freeze(STRINGS);
globalThis.COPY = { t, tn, has, fmt, missing, produced, STRINGS };
stamp();
export {
  STRINGS,
  fmt,
  has,
  missing,
  produced,
  t,
  tn
};
