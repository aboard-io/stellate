#!/usr/bin/env node
// test/unit/dice.test.js — A THOUSAND RECORDS FROM A DICE.
//
// The dice is not a special path through the app: it answers the same
// questions a person answers, at random. Which makes it the strongest
// property test this box has — if a random walk of the graph can produce an
// unplayable record, so can somebody tapping.
//
// Seeded, so a failure names the roll that caused it.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; if (fails < 12) console.log("  ✗ " + msg); } };

const Band = require("../../nukernel/band-kit.js");
const K = require("../../nukernel/kernel.js");
const { MODES } = require("../../nukernel/genres.js");
Band.toSong({ ...Band.blank(), on: true }, MODES);
const P = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
  vel: new Array(16).fill(6), inc: new Array(16).fill(0), stk: new Array(16).fill(0),
  gate: new Array(16).fill(0), acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
const seeded = (seed) => { let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };

const ROLLS = 300;
const t0 = Date.now();
const seen = { genres: new Set(), forms: new Set(), lengths: new Set(), takes: new Set() };
let sections = 0, bars = 0, events = 0;

console.log("three hundred rolls, and every one of them plays");
for (let seed = 1; seed <= ROLLS; seed++) {
  const at = "roll " + seed;
  let m;
  try { m = Band.randomSong(seeded(seed)); }
  catch (e) { ok(false, at + " threw: " + e.message); continue; }
  ok(!!m.song.genre, at + ": no record was called");
  seen.genres.add(m.song.genre);
  seen.forms.add(m.song.form || "vamp");
  const song = Band.toSong(m, MODES);
  ok(song.length > 0, at + ": a record with no sections");
  sections += song.length;
  for (const s of song) {
    bars += s.bars;
    seen.lengths.add(s.bars);
    ok(s.bars > 0 && s.bars <= 16, at + "/" + s.role + ": " + s.bars + " bars");
    const d = K.drums(P, s.genre, s.bars), b = K.bass(P, s.genre, s.bars);
    const k = K.render(s.pattern, s.genre, s.bars), g = K.render(s.guitar, s.genre, s.bars);
    const mel = s.melody ? K.render(s.melody.phrase, s.melody.genre, s.melody.genre.bars) : [];
    const vox = s.voice ? K.render(s.voice.phrase, s.voice.genre, s.bars) : [];
    events += d.length + b.length + k.length + g.length + mel.length + vox.length;
    // EVERY EVENT IS PLAYABLE: a number, in time, on the keyboard
    for (const [what, list] of [["drums", d]])
      for (const e of list)
        ok(Number.isFinite(e.t) && Number.isFinite(e.vel) && K.LANES[e.d],
           at + "/" + s.role + ": a " + what + " event " + JSON.stringify(e).slice(0, 60));
    for (const [what, list] of [["bass", b], ["keys", k], ["guitar", g],
                                ["the tune", mel], ["the voice", vox]])
      for (const e of list)
        // 21..108 is a piano, end to end: a note outside it is not a part
        // anybody can play, whatever the engine's register home does later
        ok(Number.isFinite(e.t) && e.t >= 0 && Number.isFinite(e.n) && e.n >= 21 && e.n <= 108,
           at + "/" + s.role + ": " + what + " plays " + JSON.stringify(e).slice(0, 60));
    // ...and NOTHING NUMERIC CARRIES A WORD (the NaN that stopped the engine)
    for (const f of ["swing", "humanize", "bars", "rate", "voices", "key", "bassNudge"])
      ok(s.genre[f] === undefined || s.genre[f] === null || typeof s.genre[f] === "number",
         at + ": genre." + f + " is " + JSON.stringify(s.genre[f]));
  }
  // a record somebody could hear: somebody is playing in every section
  for (const s of song) {
    const n = K.drums(P, s.genre, s.bars).length + K.bass(P, s.genre, s.bars).length +
      K.render(s.pattern, s.genre, s.bars).length + K.render(s.guitar, s.genre, s.bars).length +
      (s.voice ? K.render(s.voice.phrase, s.voice.genre, s.bars).length : 0) +
      (s.melody ? K.render(s.melody.phrase, s.melody.genre, s.melody.genre.bars).length : 0);
    ok(n > 0, at + "/" + s.role + " is silent");
  }
  // ...the whole take, not its outline: two records with the same form and
  // the same kit are not the same record if the parts are different
  seen.takes.add(JSON.stringify(song.map((s) => [s.role, s.bars, s.genre.drumkit,
    s.genre.instr, s.genre.kit, s.pattern.gate, s.guitar.gate,
    s.voice ? s.voice.genre.instr : null, !!s.melody, s.box])));
}
// THE DICE MUST ROLL DIFFERENTLY. A random walk that keeps landing on the
// same record is a graph with one path through it.
ok(seen.genres.size >= 8, "three hundred rolls found " + seen.genres.size + " records");
ok(seen.forms.size >= 5, "...and " + seen.forms.size + " forms");
ok(seen.lengths.size >= 3, "...and " + seen.lengths.size + " section lengths");
ok(seen.takes.size > ROLLS * 0.8, "only " + seen.takes.size + " of " + ROLLS +
   " rolls made a different record");
// ...and the same seed makes the same record, or a failure names nothing
const a = JSON.stringify(Band.randomSong(seeded(99)));
const b = JSON.stringify(Band.randomSong(seeded(99)));
ok(a === b, "the same roll made two different records");

console.log("    " + ROLLS + " rolls · " + seen.genres.size + " records · " +
            seen.forms.size + " forms · " + sections + " sections · " + bars + " bars · " +
            events + " events · " + ((Date.now() - t0) / ROLLS).toFixed(0) + " ms a roll");
console.log(fails ? `\ndice: FAIL — ${fails} of ${pass + fails}`
  : `\ndice: PASS — ${pass} checks (three hundred random records, every one of them playable)`);
process.exit(fails ? 1 : 0);
