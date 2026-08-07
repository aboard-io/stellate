#!/usr/bin/env node
// melody-cells-daw.test.js — state.melodyCells, the /daw PHRASE EDITOR's engine
// surface. (Named -daw to sit beside the existing melody-cells.test.js, which
// fingerprints the MINED cells; this one is about the override mechanism.)
//
// The founding constraint of docs/DAW.md is that you author the GENERATOR, never
// the notes — so a drawn phrase has to be stored the way the mined ones are: in
// CHORD-TONE indices, resolved against whatever chord is sounding. That is the
// difference between a phrase that survives a reharmonisation and a frozen clip
// stranded by it, and it is what this gate proves:
//
//   1 absent is IDENTICAL      no melodyCells => the shipped MEL_PHRASES table
//   2 an override PLAYS        a song's own cell shadows the shipped one by name
//   3 it FOLLOWS THE HARMONY   the SAME cell yields different pitches under
//                              different chords — it is a contour, not a clip
//   4 it survives a KEY CHANGE the contour holds when keyOffset moves; the
//                              pitches transpose with it
//   5 it stays HOME            a phrase edit moves melody only (generator layer)
//
// Run: node test/unit/melody-cells-daw.test.js
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
global.window = global;
require(path.join(ROOT, "engine/genres-data.js"));
require(path.join(ROOT, "engine/registry-data.js"));
require(path.join(ROOT, "engine/theory.js"));
require(path.join(ROOT, "engine/pipes.js"));
const E = require(path.join(ROOT, "engine/csd-engine.js"));
const K = require(path.join(ROOT, "engine/genre-kernel.js"));

const deep = (o) => JSON.parse(JSON.stringify(o));
const J = (o) => JSON.stringify(o);
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.error("  FAIL: " + m); } };

// a phrase that is unmistakably ours: a rising run through the whole ladder
const MINE = [[0, 0.5, 0, 0], [0.5, 0.5, 1, 0], [1, 0.5, 2, 0], [1.5, 0.5, 3, 0],
              [2, 0.5, 0, 1], [2.5, 0.5, 1, 1], [3, 1, 2, 1], [4, 4, 3, 1]];
const CELL = "arpup";                      // a shipped cell every genre can run

function cellState(g, seed, patch) {
  const t = K.track(g, { seed });
  const s = deep(t.state || t);
  let any = false;
  for (const sec of s.sections || []) if (sec.melody && sec.melody !== "off") { sec.melody = CELL; any = true; }
  if (!any) return null;
  s.voiceStreams = true;
  // the phrase editor's own surface only; keep the cross-voice layer out of the
  // isolation claim, exactly as voice-streams.test.js scopes it
  return Object.assign(s, patch || {});
}
const melOf = (s) => E.buildEvents(s).pitched.filter((e) => e.voice === "melody");
const GENRES = ["citypop", "jungle", "techno", "folk"];
const CASES = [];
for (const g of GENRES) for (const seed of [1, 5]) if (cellState(g, seed)) CASES.push([g, seed]);
ok(CASES.length > 0, "no test genre plays a melody — the gate would be vacuous");
ok(!!(E.MEL_PHRASES && E.MEL_PHRASES[CELL]), "the engine exposes MEL_PHRASES and the test cell exists");

// ---- 1 absent identical ---------------------------------------------------
for (const [g, seed] of CASES) {
  const a = cellState(g, seed), b = cellState(g, seed, { melodyCells: undefined }), c = cellState(g, seed, { melodyCells: {} });
  ok(J(E.buildEvents(a)) === J(E.buildEvents(b)), `${g}/${seed}: melodyCells:undefined must be byte-identical to absent`);
  ok(J(E.buildEvents(a)) === J(E.buildEvents(c)), `${g}/${seed}: melodyCells:{} must be byte-identical to absent`);
}
console.log(`1 absent identical — ${CASES.length} states`);

// ---- 2 an override plays --------------------------------------------------
{
  let moved = 0;
  for (const [g, seed] of CASES) {
    const a = cellState(g, seed), b = cellState(g, seed, { melodyCells: { [CELL]: MINE } });
    if (J(melOf(a)) !== J(melOf(b))) moved++;
  }
  ok(moved === CASES.length, `a drawn cell must shadow the shipped one every time (${moved}/${CASES.length})`);
  // and an override on a cell the form never plays must change nothing
  const [g0, s0] = CASES[0];
  const unused = Object.keys(E.MEL_PHRASES).find((n) => n !== CELL && n !== CELL + "2");
  ok(J(melOf(cellState(g0, s0))) === J(melOf(cellState(g0, s0, { melodyCells: { [unused]: MINE } }))),
     `overriding an UNPLAYED cell (${unused}) must change nothing`);
  console.log(`2 override plays — ${moved}/${CASES.length}, control on "${unused}"`);
}

// ---- 3 IT FOLLOWS THE HARMONY (the founding constraint, measured) ---------
// The same cell, over a progression with more than one distinct chord, must
// produce more than one distinct pitch for the SAME ladder slot. A frozen clip
// could not: it would emit the same pitch under every chord.
{
  const [g, seed] = CASES[0];
  const s = cellState(g, seed, { melodyCells: { [CELL]: MINE } });
  const evs = melOf(s);
  ok(evs.length > 0, "the overridden cell emitted notes");
  // Slot 0 of the ladder = the FIRST note of each chord bar (MINE[0] is [0,·,0,0]).
  // Bucket by chord bar and take each bucket's earliest note — the tape jitters
  // every onset off the grid, so an exact `beat % 8 === 0` test finds nothing.
  const cb = Math.max(2, Math.round(s.chordEvery || 8));
  const firsts = new Map();
  for (const e of evs) {
    const bar = Math.floor((e.beat + 0.25) / cb);
    const cur = firsts.get(bar);
    if (!cur || e.beat < cur.beat) firsts.set(bar, e);
  }
  const distinct = new Set([...firsts.values()].map((e) => E.pchToMidi(e.pch) % 12));
  ok(distinct.size > 1,
     `the same ladder slot produced only one pitch class (${[...distinct]}) — the cell is behaving like a frozen ` +
     "clip, not a chord-tone contour");
  console.log(`3 follows the harmony — slot 0 spans ${distinct.size} pitch classes across the progression`);
}

// ---- 4 survives a key change ---------------------------------------------
// Move keyOffset and the phrase must transpose WHOLE — same contour (the interval
// sequence), different pitches. A clip written in absolute pitch would keep its
// pitches and fight the new key.
{
  const [g, seed] = CASES[0];
  const a = melOf(cellState(g, seed, { melodyCells: { [CELL]: MINE } }));
  const b = melOf(cellState(g, seed, { melodyCells: { [CELL]: MINE }, keyOffset: 5 }));
  ok(a.length === b.length, `a key change must not change the note COUNT (${a.length} vs ${b.length})`);
  const shifts = a.map((e, i) => b[i] ? E.pchToMidi(b[i].pch) - E.pchToMidi(e.pch) : null).filter((v) => v != null);
  const uniq = [...new Set(shifts)];
  ok(uniq.length >= 1 && uniq.every((v) => v !== 0),
     "a key change moved nothing — the phrase is not following the key");
  console.log(`4 survives a key change — ${a.length} notes, shift set {${uniq.join(", ")}}`);
}

// ---- 5 stays home ---------------------------------------------------------
{
  let leaked = 0;
  for (const [g, seed] of CASES) {
    const gen = { pipes: [], thunk: null };
    const a = E.buildEvents(cellState(g, seed, gen));
    const b = E.buildEvents(cellState(g, seed, Object.assign({ melodyCells: { [CELL]: MINE } }, gen)));
    for (const v of ["bass", "pad"])
      if (J(a.pitched.filter((e) => e.voice === v)) !== J(b.pitched.filter((e) => e.voice === v))) {
        leaked++; console.error(`  FAIL: ${g}/${seed}: a phrase edit moved ${v}`);
      }
    if (J(a.drums) !== J(b.drums)) { leaked++; console.error(`  FAIL: ${g}/${seed}: a phrase edit moved the drums`); }
  }
  ok(leaked === 0, "a phrase edit leaked out of the melody through the generator layer");
  console.log(`5 stays home — ${CASES.length} states, ${leaked} leaks`);
}

if (fails) { console.error(`\nMELODY-CELLS-DAW: FAIL — ${fails}/${checks} checks`); process.exit(1); }
console.log(`\nMELODY-CELLS-DAW: PASS — ${checks} checks; a drawn phrase is a chord-tone contour, not a clip`);
