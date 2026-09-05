// nukernel/src/copy/rules.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// the rules sheet — rules.js, ui/rules.js: what the genre sets and why a row
// does not move.
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// WHY THERE ARE NO MEASUREMENTS HERE. Thirteen of these sentences used to name
// `precompose.js`, `song.js:484`, `cellBarsOf`, `capOf`, `cast.reg` or `IDIOM`
// and end "nothing moves — this is what the record is called". A reader is
// owed the plain fact ("Set by the genre."); a maintainer is owed the reason,
// and the reason is now a CODE COMMENT beside the rule it belongs to.
//
// AND WHY A ROW READS "Tempo [76] BPM". `ui/rules.js` draws a rule as one
// sentence with the control standing in it, so `rules.js say()` hands back a
// NAME, the widget, and a UNIT. Those three pieces are three keys — a name, a
// value and a unit are three different things in every language — rather than
// the prose sentence ("the tempo is 76 beats a minute") the panel used to
// assemble.

import type { Table } from "./api.js";

export const RULES: Table = {
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
  "rule.square": "Lands square",
};
