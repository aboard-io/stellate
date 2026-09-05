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
  /* THE REVIEW'S GLOSSARY (TABLE.md §12a): motif -> phrase. The tab's
     ADDRESS is still `Motifs` in ui/eight.js and in eleven gates; the printed
     word is the composer's. */
  "glyph.tab.motifs": "Phrases",
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
  "glyph.facet.plays.say": "Part, register, entry and default phrase",
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
  "glyph.cell.prov.own.say": "Phrase from this song's genre.",
  "glyph.cell.prov.guest": "From a guest",
  "glyph.cell.prov.guest.say": "Phrase from a guest genre.",
  "glyph.cell.prov.hand": "Edited",
  "glyph.cell.prov.hand.say": "Phrase edited by hand.",

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
