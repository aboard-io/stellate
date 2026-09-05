// nukernel/src/copy/fields.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// the vocabulary — fields.js, avail.js, askable.js: field names, their values,
// their defaults. (compose.js and precompose.js print NOTHING; the audit's
// rows against them are the genre notes in wiki.js/genres.js drawn by
// ui/atlas.js, and the tempo words in ui/eight.js.)
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// TWO LAWS THIS PAGE EXISTS TO KEEP.
//
// 1 · "DEFAULT" IS ONE WORD. The audit found the same idea said eleven ways —
//     `the record's own`, `the record's key/mode/swing/groove/delay`, `the
//     genre's own`, `the row's`, `as the genre asks`, `as long as they like`,
//     `leave it alone`. There is no `field.default` on this page and there
//     must never be one: every empty detent points at `core.ts value.default`,
//     which is the whole fix.
// 2 · A QUESTION IS NOT A LABEL. `fields.js` and `askable.js` wrote their
//     control names as interview questions ("how are the notes played?"), and
//     `avail.js` printed them over a strip of chips. The QUESTION is still the
//     interview's (`askable.js ask`); the LABEL is the noun below.

import type { Table } from "./api.js";

export const FIELDS: Table = {
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
  "refuse.noChordToStrum": "Nobody is voicing a chord to strum",
};
