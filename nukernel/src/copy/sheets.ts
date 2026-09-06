// nukernel/src/copy/sheets.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// the cell and player sheets — ui/eight.js, ui/band.js, ui/abc.js: the motif bank, the mix rows, the sample crate, the score line
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// WHAT IS A PLACEHOLDER AND WHAT IS A SENTENCE. `{value}` is always DATA —
// a `·`-joined readout ("verse 4, verse 7", "bars 1–2 of 2", a formatted
// number and its unit) assembled by the caller and never translated. Every
// word around it is here.

import type { Table } from "./api.js";

export const SHEETS: Table = {
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
  /* THE CHORDS ROW'S SECOND GROUP (2026-09-05, TABLE.md §13f): what the
     harmony DOES over the changes — the cycle word and whether the melody
     follows the chords or stays in the key. `ui/glyph.js GLYPH.group` has no
     mark for it, so `groupMark` answers null and the heading prints its word
     alone, which is that table's own rule for a group it has no honest
     picture for. */
  "group.harmony": "Harmony",
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
  "burger.log.other": "log ({n})",
};
