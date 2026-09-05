// nukernel/src/copy/core.ts — THE WORDS EVERY SURFACE USES.
//
// The shared page of the catalogue: the one word for a value nobody wrote
// ("default"), the actions, the counted nouns, and the states a control wears.
// A surface page (table.ts, sheets.ts, …) reuses these keys rather than
// spelling the same word again — the audit found "default" said ELEVEN ways
// (`the record's own`, `the genre's own`, `the row's`, `the zone's own`, `as
// the genre asks`, `rides the section`, `as long as they like`, `leave it
// alone`, `the record's key/mode/swing`) and one word is the whole fix.

import type { Table } from "./api.js";

export const CORE: Table = {
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
  "noun.phrase": "phrase",
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
  "count.phrase.one": "{n} phrase",
  "count.phrase.other": "{n} phrases",
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
  "state.scheduled": "scheduled",
};
