// nukernel/src/copy/board.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// the mix board — ui/engineer.js: the strips, the sends, the master, the meters
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// WHAT THE FUNCTIONAL TEXT PASS DID HERE (2026-09-05). The board printed the
// three things DESIGN.md §4 forbids most plainly: a source path in the UI
// ("the fixed wires — docs/BOARD-ROUTING.md"), a measurement with a function
// name in it ("measured: the engine's master RMS (audio/live.js rmsNow)") and
// a twenty-one-variant sentence assembled from six fragments in a caller
// ("derived: the section's own fwd + lift deals this voice +1.0 dB and a tone
// move — tap to set a word over it"). The first two are gone from the page and
// live in code comments; the third is TWO keys with a {value} placeholder, and
// the tap-to instruction came off because DESIGN.md §3 already says a tap edits
// and delete returns to default.
//
// A dB VALUE ARRIVES FORMATTED, never spelled: the caller passes
// `fmt(db, "dB")`, so "+1 dB" and "−1.5 dB" are made in one place.

import type { Table } from "./api.js";

export const BOARD: Table = {
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
  "board.count.fx.other": "{n} fx",
};
