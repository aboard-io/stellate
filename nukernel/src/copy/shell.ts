// nukernel/src/copy/shell.ts — THE WORDS THAT SHIP IN THE HTML.
//
// nukernel/index.html is a plain document loaded before a line of script runs,
// so the strings it carries in its own markup cannot call `t()` where they
// stand: the WHERE panel's heading, the chrome landmark's name, and the log's
// (whose word is `glyph.log`, because the mark and the live region are one
// name and five gates read it). They are STAMPED instead: the element declares `data-copy`,
// `data-copy-aria` or `data-copy-title` with a key, and ui/copy.js fills it on
// load (src/copy/index.ts `stamp`). A translator changes this page; the
// document does not move.
//
// "Where & when" is kept verbatim on purpose — test/atlas.js G7 and
// test/text-diet.test.js T2 read that heading off the rendered page, and this
// round is about WHERE a string lives, not about renaming a panel.

import type { Table } from "./api.js";

// IT ALSO HOLDS THE TWO SMALL SURFACES WITH NO PAGE OF THEIR OWN — the word
// grid's group bar and its clear-backs (ui/wordgrid.js) and the sample crate's
// audition button (ui/samples.js). Six strings between them, three of which
// were assembled from fragments ("clear " + label + " back to what it
// inherits", "hear " + name + " alone, " + why), which is the shape §12b
// exists to refuse.

export const SHELL: Table = {
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
  "grid.corner": "Section",
};
