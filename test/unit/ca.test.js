// ca.test.js — THE AUTOMATON's gates (engine/ca.js).
//
// The claim under test is "a whole song in 24 bits", and the failure modes are
// specific: a lens that silently emits nothing, an orbit that never closes, a
// role classifier that calls everything a chorus, a progression object the
// engine refuses, and — the one that would sink the project — a change to
// getProgression that is not byte-identical for the 274 shipped anchors.
//
// Pure node, no browser, no media. Run: node test/unit/ca.test.js
"use strict";
const CA = require("../../engine/ca.js");
const E = require("../../engine/csd-engine.js");

let fails = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log("  FAIL " + msg); } }
function head(s) { console.log("\n" + s); }

// ---------------------------------------------------------------- 1. the ring
head("1. the automaton");
{
  // rule 0 kills everything; rule 255 fills everything; rule 204 is identity
  ok(CA.step(0xabcd, 0) === 0, "rule 0 empties the row");
  ok(CA.step(0x0001, 255) === CA.MASK, "rule 255 fills the row");
  ok(CA.step(0xabcd, 204) === 0xabcd, "rule 204 is the identity rule");
  // rule 170 is "become your right neighbour" = a rotation, which proves the
  // neighbourhood indexing AND the wrap in one shot
  ok(CA.step(0xabcd, 170) === CA.rot(0xabcd, -1) || CA.step(0xabcd, 170) === CA.rot(0xabcd, 1),
    "rule 170 shifts the row by one cell (neighbourhood order + wrap)");
  // the wrap is real: a single live cell under rule 170 walks all the way round
  let r = 1; for (let i = 0; i < CA.N; i++) r = CA.step(r, 170);
  ok(r === 1, "a lone cell under rule 170 returns home after N steps — the ring wraps");
  ok(CA.pop(CA.MASK) === 16 && CA.pop(0) === 0 && CA.pop(0b1011) === 3, "popcount");
  ok(CA.ham(0xffff, 0x0000) === 16, "hamming distance");
}

// ------------------------------------------------------------ 2. involutions
head("2. the row involutions (the rhythmic half of the group)");
{
  for (const row of [0x0000, 0xabcd, 0x8001, 0xffff, 0x1234]) {
    ok(CA.ref(CA.ref(row)) === row, "reflect is self-inverse (" + row.toString(16) + ")");
    ok(CA.inv(CA.inv(row)) === row, "complement is self-inverse (" + row.toString(16) + ")");
    ok(CA.rot(CA.rot(row, 5), -5) === row, "rotate composes to identity (" + row.toString(16) + ")");
    ok(CA.fromCells(CA.cells(row)) === row, "cells/fromCells round-trip (" + row.toString(16) + ")");
  }
}

// ----------------------------------------------------------------- 3. orbits
head("3. every orbit closes into a rho");
{
  // max is the whole state space + slack: a rho on a 16-cell ring cannot be
  // longer than 2^16, and four rules genuinely run into the thousands (the
  // printed cycle list below is the honest picture of what the 256 rules do).
  let closed = 0, cycles = {};
  for (let rule = 0; rule < 256; rule++) {
    const orb = CA.orbit(0x1249, rule, 66000);
    if (orb.cycle > 0) closed++;
    cycles[orb.cycle] = (cycles[orb.cycle] || 0) + 1;
    ok(orb.rows[0] === 0x1249, "rule " + rule + " orbit starts at the seed");
    if (orb.cycle > 0) {
      // the defining property: the row after the last one in the rho is the row
      // the cycle started on
      const last = orb.rows[orb.rows.length - 1];
      ok(CA.step(last, rule) === orb.rows[orb.tail], "rule " + rule + " closes onto its cycle start");
      // gen() must follow that cycle past the end of the computed rows
      ok(CA.gen(orb, orb.tail + orb.cycle) === orb.rows[orb.tail], "rule " + rule + " gen() wraps the cycle");
    }
  }
  ok(closed === 256, "all 256 rules close into a rho (got " + closed + ")");
  console.log("  cycle lengths seen: " + Object.keys(cycles).map(Number).sort((a, b) => a - b).join(" "));
}

// ------------------------------------------------------------------ 4. lenses
head("4. the lenses emit engine vocabulary");
{
  // a known row: 1001 0010 0100 1000 — a head, a pair, an isolated cell, a run
  const row = CA.fromCells([1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1]);
  const kit = CA.lensDrums(row);
  const lane = (d) => (kit.ops.find((o) => o.d === d) || { hits: [] }).hits;
  ok(kit.turn === false, "a CA kit suppresses the end-of-cycle turn");
  ok(kit.ops.every((o) => Array.isArray(o.hits) && o.hits.length), "every kit op is a non-empty static hit list");
  ok(kit.ops.every((o) => !("p" in o) && !("pick" in o) && !("grid" in o)),
    "a CA kit spends ZERO rng draws — no p/pick/grid ops");
  // cells 3,4 are a run: 3 is the head (kick), 4 the interior (hat)
  ok(lane("kick").some((h) => h[0] === 1.5), "a run head is a kick");
  // cell 6 stands alone (5 and 7 dead) => snare
  ok(lane("snare").some((h) => h[0] === 3), "an isolated cell is a backbeat snare");
  // cells 9,10,11 are a run => 9 is the head, 10 and 11 are hats, and 10 (both
  // neighbours live) accents while 11 (right neighbour dead) does not
  ok(lane("hat").some((h) => h[0] === 5 && h[1] === 0.16), "a run interior with both neighbours live accents");
  ok(lane("hat").some((h) => h[0] === 5.5 && h[1] === 0.11), "a run's last cell is an unaccented hat");
  // THE LINEAR READ, stated out loud: cell 15 is live and cell 0 is live, but the
  // lens does not wrap them into one run — 15 is isolated (a snare), and a row
  // whose cell 0 is a run head gives a downbeat kick.
  ok(lane("snare").some((h) => h[0] === 7.5), "cell 15 does not wrap onto cell 0 — the lens reads linearly");
  ok(CA.lensDrums(CA.fromCells([1, 1])).ops.find((o) => o.d === "kick").hits[0][0] === 0,
    "a run starting at cell 0 is a downbeat kick");
  ok(kit.ops.every((o) => o.hits.every((h) => h[0] >= 0 && h[0] < CA.CELL_BEATS)),
    "every hit lands inside the 8-beat cell");

  const bass = CA.lensBass(row);
  // the row has five runs — [0] [3,4] [6] [9,10,11] [15] — and therefore five
  // bass notes, not the thirteen a per-cell read would give
  ok(bass.length === 5, "bass onsets are rising edges only (5 runs -> 5 notes, got " + bass.length + ")");
  ok(CA.pop(row) === 8 && bass.length < CA.pop(row), "the bass is sparser than the row is dense");
  ok(bass.every(([b, d, t]) => b >= 0 && b < CA.CELL_BEATS && d > 0 && ["r5", "r6", "f6"].indexOf(t) >= 0),
    "every bass note is [beat, dur, degree] in the engine's degree vocabulary");
  ok(bass.some(([, , t]) => t === "r6"), "a run of 3+ reaches the octave degree");

  const mel = CA.lensMelody(row);
  ok(mel.length === CA.pop(row), "one melody note per live cell");
  ok(mel.every(([b, d, i, o]) => b >= 0 && b < CA.CELL_BEATS && d > 0 && i >= 0 && i <= 3 && (o === 0 || o === 1)),
    "every melody note is [beat, dur, ladderIndex 0..3, octShift 0|1]");
  // the contour claim: a prefix-sum read must CLIMB, not jitter. The first four
  // notes are ladder 0,1,2,3 in order — an arch, which a per-cell pitch read
  // could not give.
  ok(mel.slice(0, 4).map((m) => m[2]).join(",") === "0,1,2,3", "the ladder read is a rising contour");
  // durations run to the next onset, so a drawn line is legato rather than 16ths
  ok(mel[0][1] === (mel[1][0] - mel[0][0]), "a note holds until the next onset");

  // empty row: every lens must degrade to nothing rather than throwing
  ok(CA.lensDrums(0).ops.length === 0 && CA.lensBass(0).length === 0 && CA.lensMelody(0).length === 0,
    "a dead row yields no events from any lens (and does not throw)");
  // full row: the bass must still speak (one wrapped run would have silenced it)
  ok(CA.lensBass(CA.MASK).length === 1, "a full row is ONE held bass note, not silence");
}

// --------------------------------------------------- 5. neo-Riemannian algebra
head("5. PLR is the group it claims to be");
{
  const T = (pc, min) => ({ pc, min: !!min });
  const eq = (a, b) => a.pc === b.pc && a.min === b.min;
  const C = T(0, false);
  ok(eq(CA.plr(C, 1), T(0, true)), "P: C -> Cm");
  ok(eq(CA.plr(C, 2), T(4, true)), "L: C -> Em");
  ok(eq(CA.plr(C, 3), T(9, true)), "R: C -> Am");
  // involutions, on every one of the 24 triads
  for (let pc = 0; pc < 12; pc++) for (const m of [false, true]) {
    const t = T(pc, m);
    for (const op of [1, 2, 3]) ok(eq(CA.plr(CA.plr(t, op), op), t), "op " + CA.LETTER[op] + " is an involution on " + CA.triadName(t));
    ok(eq(CA.plr(t, 0), t), "hold is the identity on " + CA.triadName(t));
  }
  // THE THREE CLOSURES — the reason the form table can promise a return home
  let t = C; for (let i = 0; i < 3; i++) { t = CA.plr(t, 2); t = CA.plr(t, 1); }
  ok(eq(t, C), "(LP)^3 = 1 — the hexatonic cycle comes home in 6");
  t = C; for (let i = 0; i < 4; i++) { t = CA.plr(t, 1); t = CA.plr(t, 3); }
  ok(eq(t, C), "(PR)^4 = 1 — the octatonic cycle comes home in 8");
  t = C; for (let i = 0; i < 12; i++) { t = CA.plr(t, 3); t = CA.plr(t, 2); }
  ok(eq(t, C), "(RL)^12 = 1 — the descending-fifths walk comes home in 24 triads");
  // RL is a descending fifth on major triads, which is the claim that makes the
  // walk recognisable rather than merely closed
  ok(eq(CA.plr(CA.plr(C, 3), 2), T(5, false)), "RL: C -> F (down a fifth)");
  // the word read: a row's four nibbles
  ok(CA.word(0).join("") === "0000", "an empty row is four holds — a pedal");
  ok(CA.word(0x000f).join("") === "0000", "popcount 4 folds to hold (mod 4)");
  ok(CA.word(0x0001).join("") === "1000", "one live cell in the first nibble is a P");
}

// ------------------------------------------------------ 6. the progression rides
head("6. the engine accepts a CA progression");
{
  const prg = CA.progression(0x1249, 0, E);
  ok(prg.chords.length === 4, "four chords");
  ok(prg.chords.every((c) => c.pads.length === 4 && c.lead.length === 4 && c.bass.r5 && c.bass.r6 && c.bass.f6),
    "every chord carries pads/lead/bass in the shape voicing() returns");
  ok(/^CA · /.test(prg.label) && prg.caTriads.length === 4, "the label prints the PLR word");
  // THE ENGINE CHANGE: getProgression must take the object and return it verbatim
  ok(E.getProgression(prg) === prg, "getProgression passes a resolved progression object through");
  // ...and must still refuse junk exactly as before
  let threw = false; try { E.getProgression("nope_not_a_progression"); } catch (e) { threw = true; }
  ok(threw, "getProgression still throws on an unknown NAME (no silent fallback)");
  threw = false; try { E.getProgression({ chords: [] }); } catch (e) { threw = true; }
  ok(threw, "an object with no chords is not a progression");
}

// ---------------------------------------- 7. the change is absent-byte-identical
head("7. the getProgression change moves nothing that shipped");
{
  // The standing law. Every catalogue progression must resolve to the IDENTICAL
  // object it always did, and a spread of real states must build identical
  // events. If this row ever fails, the two-line guard above is not free.
  let same = 0;
  for (const name of Object.keys(E.PROGRESSIONS)) {
    if (E.getProgression(name) === E.PROGRESSIONS[name]) same++;
    else ok(false, "progression " + name + " no longer resolves to its catalogue entry");
  }
  ok(same === Object.keys(E.PROGRESSIONS).length, "all " + same + " catalogue progressions resolve identically");

  const K = require("../../engine/genre-kernel.js");
  const names = Object.keys(K.GENRES);
  const probe = ["acidhouse", "jungle", "vaporwave", "ragtime", "dub"].filter((g) => names.indexOf(g) >= 0);
  for (const g of probe) for (const seed of [1, 7]) {
    const a = JSON.stringify(E.buildEvents((function(t){return t.state||t;})(K.track(g, { seed }))));
    const b = JSON.stringify(E.buildEvents((function(t){return t.state||t;})(K.track(g, { seed }))));
    ok(a === b, g + " seed " + seed + " is deterministic");
    ok(a.length > 500, g + " seed " + seed + " builds real events");
  }
}

// ------------------------------------------------------------------- 8. the form
head("8. the orbit IS the form");
{
  const K = require("../../engine/genre-kernel.js");
  const base = () => JSON.parse(JSON.stringify((function(t){return t.state||t;})(K.track("acidhouse", { seed: 7 }))));

  // determinism: the same 24 bits twice is the same song, byte for byte
  const s1 = CA.apply(base(), { seed: 0x1249, rule: 110, key: 0 });
  const s2 = CA.apply(base(), { seed: 0x1249, rule: 110, key: 0 });
  ok(JSON.stringify(E.buildEvents(s1.state)) === JSON.stringify(E.buildEvents(s2.state)),
    "the same seed+rule renders byte-identical events");

  // the structural claim
  ok(s1.state.sections.length >= 4, "a CA song has at least four sections (got " + s1.state.sections.length + ")");
  ok(s1.plan.length === s1.state.sections.length, "one section per generation");
  ok(s1.roles[0] === "chorus", "generation 0 IS the seed, so it is a chorus by definition");
  ok(new Set(s1.state.sections.map((x) => x.id)).size === s1.state.sections.length, "section ids are unique");
  // every name a section plays must resolve — a section naming a missing kit is
  // the silent-failure mode this whole file exists to prevent
  for (const sec of s1.state.sections) {
    ok(sec.drums === "off" || !!s1.state.kits[sec.drums], sec.name + ": drums name a kit that exists");
    ok(sec.bass === "off" || !!s1.state.bassCells[sec.bass], sec.name + ": bass names a cell that exists");
    ok(sec.melody === "off" || !!s1.state.melodyCells[sec.melody], sec.name + ": melody names a cell that exists");
  }
  // the arrangement grammar is audible, not cosmetic: a chorus must carry the
  // melody a verse does not
  const roleOf = (r) => s1.state.sections.filter((x, i) => s1.roles[i] === r);
  for (const c of roleOf("chorus")) ok(c.melody !== "off" || CA.pop(s1.plan[s1.state.sections.indexOf(c)].row) === 0,
    "a chorus carries the melody");
  for (const v of roleOf("verse")) ok(v.melody === "off", "a verse does not");
  for (const b of roleOf("bridge")) ok(b.drums === "off" && b.bass === "off", "a bridge drops the rhythm section");

  // THE REPRISE RULE — the one opinion the form layer holds. A hook heard once
  // is not a hook, so when the automaton never brings the seed back inside the
  // song, the sequence replays generation 0 as the penultimate section. Rule 110
  // from this seed has a tail of 50, so it never returns on its own.
  {
    const orb = CA.orbit(0x1249, 110);
    ok(orb.tail > 12, "rule 110 / 0x1249 has a tail longer than the song (" + orb.tail + ")");
    const gens = CA.formGens(orb, 12);
    ok(gens.filter((g) => g === 0).length === 2, "the reprise rule replays generation 0");
    ok(gens[gens.length - 2] === 0 && gens[gens.length - 1] !== 0, "the reprise lands before the outro, not on it");
    // it is a SEQUENCE rule, not an edit: every entry names a generation the
    // automaton actually produced
    ok(gens.every((g) => g >= 0 && g < CA.formLength(orb, 12)), "every sequence entry names a real generation");
    // and it must NOT fire when the automaton brings the seed home by itself.
    // Rule 170 rotates the row one cell per generation, so a seed with two live
    // cells 8 apart has period 8 — a pure cycle, no transient.
    const closed = CA.orbit(0x0101, 170);
    ok(closed.tail === 0 && closed.cycle === 8, "rule 170 / 0x0101 is a pure 8-cycle (tail " + closed.tail + ", cycle " + closed.cycle + ")");
    const cg = CA.formGens(closed, 12);
    ok(cg.length === 9, "a pure cycle plays one generation past the close, so it ends where it began");
    ok(CA.gen(closed, cg[cg.length - 1]) === closed.seed, "...and that last row IS the seed");
    ok(cg.filter((g) => g === 0).length === 1,
      "no bolted-on reprise when the automaton already comes home — the rule adds nothing it does not need to");
    // the reprise is two SECTIONS sharing one generation's vocabulary, not two copies
    const r = CA.apply(base(), { seed: 0x1249, rule: 110, key: 0 });
    const hooks = r.plan.filter((p) => p.gen === 0);
    ok(hooks.length === 2, "the song has two hook sections");
    ok(hooks[0].section.id !== hooks[1].section.id, "they are distinct sections");
    ok(hooks[0].section.drums === hooks[1].section.drums, "sharing one kit — vocabulary is named by generation");
    ok(hooks.every((h) => h.role === "chorus"), "both are choruses");
  }

  // AND IT MUST ACTUALLY PLAY. A form that renders no notes would pass every
  // structural check above.
  const ev = E.buildEvents(s1.state);
  ok(ev.pitched.length > 40, "the song has pitched events (" + ev.pitched.length + ")");
  ok(ev.drums.length > 20, "the song has drum events (" + ev.drums.length + ")");
  ok(ev.totalBeats > 100, "the song is longer than a bar (" + ev.totalBeats + " beats)");
  // the CA's own vocabulary is what is sounding, not the anchor's
  ok(ev.pitched.some((e) => e.voice === "melody"), "the melody lens reaches the output");
  ok(ev.pitched.some((e) => e.voice === "bass"), "the bass lens reaches the output");

  // A SWEEP. Most of the 256 rules are dead or trivial on a 16-ring and that is
  // fine — the rule browser shows it rather than hiding it. But NONE of them may
  // throw, and none may produce a state buildEvents rejects.
  //
  // The bar here is DRUMS, deliberately. An earlier version counted
  // drums+pitched > 30 and reported a proud 256/256 — which measured nothing,
  // because pads sound in every role including `rest`, so a song with a dead
  // automaton and no rhythm at all cleared it. The drum lens is the one that
  // goes silent when the row does, so it is the honest thing to count.
  let thrown = 0, silent = 0, thin = 0, full = 0;
  for (let rule = 0; rule < 256; rule++) {
    try {
      const r = CA.apply(base(), { seed: 0x1249, rule, key: 0 });
      const e = E.buildEvents(r.state);
      if (e.pitched.length < 20) ok(false, "rule " + rule + " renders almost no pitched events");
      if (!e.drums.length) silent++; else if (e.drums.length < 40) thin++; else full++;
    } catch (err) { thrown++; console.log("  rule " + rule + " threw: " + err.message); }
  }
  ok(thrown === 0, "no rule throws (" + thrown + " threw)");
  ok(silent === 0, "no rule renders a song with zero drum events (" + silent + " did)");
  ok(full > 170, "most rules give a fully rhythmic song from this seed (" + full + "/256)");
  console.log("  drums from seed 0x1249 — silent " + silent + " · thin " + thin + " · full " + full);

  // seed sweep on one interesting rule
  let ok4 = 0;
  for (let i = 0; i < 64; i++) {
    const sd = (i * 1031) & CA.MASK;
    const r = CA.apply(base(), { seed: sd, rule: 110, key: 0 });
    if (r.state.sections.length >= 4) ok4++;
  }
  ok(ok4 === 64, "every seed under rule 110 yields at least four sections (" + ok4 + "/64)");
}

// ---------------------------------------------------------------------- done
console.log("\n" + (fails ? "FAIL" : "PASS") + " — " + (checks - fails) + "/" + checks + " checks");
process.exit(fails ? 1 : 0);
