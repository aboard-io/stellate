// nukernel/src/copy/glyph.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// the marks and their explainers — ui/glyph.js: every glyph's word and its data-say, on every surface
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// THE HIGHEST-LEVERAGE PAGE IN THE CATALOGUE. `ui/glyph.js` is the one table
// of marks, and each row's WORD is the button's `aria-label` and its `.nu-vh`
// span while its CLAUSE is the `data-say` the hold/hover explainer speaks —
// so one key here changes the transport, the menu, the buses, the part words
// and the level words at once.
//
// THE WORDS ARE ADDRESSES AS WELL AS COPY, and that is why several of them are
// lower case and stay exactly as they were. `test/gutter.js`, `test/bench.test.js`,
// `test/motif-frozen.js`, `test/silence.js` and `test/shell.js` read the
// transport's accessible name back off the rendered page and compare it to
// "play" / "stop"; `test/shell.js` A6d/A6g split the log's name on " — " and
// require the head to be "log"; the tab words are `ui/eight.js` TABS' own keys.
// Only the CLAUSES were rewritten in the functional text pass.

import type { Table } from "./api.js";

export const GLYPHS: Table = {
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
  /* `Band` -> `Session`, 2026-09-06 (docs/NAV.md). Paul: *"You may need to
     put 'session' at the top as a nav item and that's the new name for the
     default view."* THE ADDRESS DID NOT MOVE — `ui/eight.js` TABS is keyed
     `Band`, the host is `#pan-band`, `toptab-Band` is the address and eleven
     gates drive `__eightTab("Band")` — and this is the printed word, which is
     the only thing a hand reads. */
  "glyph.tab.band": "Session",
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
  /* (`glyph.act.opts` AND ITS SENTENCE STOOD HERE, and both are deleted with
     the gear on 2026-09-07 — TABLE.md §20, Paul: *"Bottom bar: get rid of gear
     and move those functions into the menu."* The two controls behind it, the
     play mode and the take, are rows of the plate now and say their own words.
     A key with no printer is a string the text gate counts and nobody
     reads.) */
  "glyph.act.menu": "menu",
  "glyph.act.menu.say": "The record, the views and the log",
  /* ...AND WHAT IT SAYS WHILE THE PLATE IS OPEN (2026-09-07, §20). Paul: *"the
     menu icon should be a dismiss button"*. The WORD is `glyph.act.close`
     below — one word, one owner, the same "close" every × on this page wears —
     and only the SENTENCE is its own, because the ≡ closes the plate it opened
     and not the song. */
  "glyph.act.menu.close.say": "Close this menu",
  /* ===== THE EDIT MARKS (2026-09-08, TABLE.md §24) ======================
     Paul: *"We can move undo, redo to the bottom nav and make them global. Use
     icons for copy paste."* and, of the cell card, *"the basic operations
     should be icons."*
     EVERY ONE IS MEASURED AGAINST THIS PAGE'S OWN FONT AND NOT ASSUMED. The
     test is the one a mark has to pass here: render U+FFFF — which no font
     has — take its width as THIS font's tofu, and refuse any candidate that
     comes back the same width. All seven differ from a 60px tofu at 100px
     type, so all seven have real outlines. (`⧉` 71.4 · `⎘` 80 · `⌫` 141.4 ·
     `↶`/`↷`/`→`/`↓` 83.8.)
     AND EVERY ONE STILL CARRIES ITS WORD. `paintIcon` puts the word in a
     `.nu-vh` beside the mark, so a font that fails on somebody's phone leaves
     a readable control rather than a blank square — which is the belt the ×
     did not have until this morning (`el("span", "✕")` and an empty span).
     A mark is never the only thing that says what a button does. */
  "glyph.act.undo": "undo",
  "glyph.act.undo.say": "Take back the last change",
  "glyph.act.redo": "redo",
  "glyph.act.redo.say": "Put the last change back",
  "glyph.act.copy": "copy",
  "glyph.act.copy.say": "Copy this cell",
  "glyph.act.paste": "paste",
  "glyph.act.paste.say": "Paste into this cell",
  "glyph.act.clear": "clear",
  "glyph.act.clear.say": "Back to what the genre plays",
  "glyph.act.fillrow": "fill row",
  "glyph.act.fillrow.say": "Put this across the row",
  "glyph.act.fillcol": "fill column",
  "glyph.act.fillcol.say": "Put this down the column",
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
  "glyph.icon.refused": "{word}, {why}",
};
