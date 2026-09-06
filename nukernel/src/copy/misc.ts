// nukernel/src/copy/misc.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// the tail — src/envelope, src/menus, ui/video.js, ui/screensaver.js
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// WHAT IS *NOT* HERE, AND ON PURPOSE. `ideas-kit.js`, `vocal-kit.js`,
// `keys-kit.js` and `drums-kit.js` hold their op words as DATA beside the
// vectors they name — 258 of 261 are a musician's own words, the tables are
// read by node scripts as well as by the page, and a genre name, a note name
// and a chord name are data for the same reason. They stay literals in their
// tables; only their LENGTH was fixed.

import type { Table } from "./api.js";

export const MISC: Table = {
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
  /* ===== WHAT A RECORDING CANNOT BE TOLD (2026-09-06) ==================
     Paul: *"Samples should have full Adsr why don't they"* — and they do now,
     except for the one stage a recording can genuinely refuse. A sustain is
     the level a note RESTS at while it is held, and a sample with no loop zone
     does not rest: it stops when the recording runs out. MEASURED, on a 0.35 s
     one-shot with the note held 2 s — the sound ends at 0.350 s whatever the
     four handles say, and a 1.5 s release tail is never heard at all. So the
     handle is refused rather than drawn live over a level nothing holds, and
     the sentence NAMES THE DOOR: `looping` is a word on the same sheet, three
     rows down, and setting it to "loop" gives the recording a zone to sit in.
     THE KEYS END IN `.why` because that is what test/copy.test.js `budgetOf`
     reads a sentence-length budget off — a refusal is a sentence beside a
     control, and this catalogue holds it to twelve words like every other one.
     (The rest of the plate stays live: the attack, the fall and the tail all
     shape what IS there — the same probe measured the fall reaching its level
     at 0.510 s on a longer one-shot.) */
  "env.noLoop.why": "this recording has no loop zone — looping it gives somewhere to rest",
  "env.playOnce.why": "set to play once — the note stops when the sample ends",
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
  "saver.noFloor": "The floor is unavailable here.",
};
