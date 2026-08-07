#!/usr/bin/env node
// bass-cells.test.js — state.bassCells, the /daw BASS MACHINE's engine surface.
//
//   1 absent is IDENTICAL   no bassCells => the 23 procedural cases, byte for byte
//   2 an override PLAYS     a song's own cell shadows the running pattern by name
//   3 DEGREES, not pitches  the same cell yields different pitches under different
//                           chords — it follows the harmony, like a melody cell
//   4 semis SHIFT           the optional 4th element transposes a degree
//   5 stays HOME            a bass edit moves the bass only (generator layer)
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

const MINE = [[0, 1, "r5"], [1, 0.5, "f6"], [2, 1, "r6"], [3.5, 0.5, "f6"], [4, 2, "r5"], [6, 2, "r6"]];
const PAT = "root";

function bassState(g, seed, patch) {
  const t = K.track(g, { seed });
  const s = deep(t.state || t);
  let any = false;
  for (const sec of s.sections || []) if (sec.bass && sec.bass !== "off") { sec.bass = PAT; any = true; }
  if (!any) return null;
  s.voiceStreams = true;
  return Object.assign(s, patch || {});
}
const bassOf = (s) => E.buildEvents(s).pitched.filter((e) => e.voice === "bass" && !e.ghost && !e.pump);
const GENRES = ["citypop", "jungle", "techno", "dub"];
const CASES = [];
for (const g of GENRES) for (const seed of [1, 5]) if (bassState(g, seed)) CASES.push([g, seed]);
ok(CASES.length > 0, "no test genre plays a bass — the gate would be vacuous");

// ---- 1 absent identical ----
for (const [g, seed] of CASES) {
  const a = bassState(g, seed), b = bassState(g, seed, { bassCells: undefined }), c = bassState(g, seed, { bassCells: {} });
  ok(J(E.buildEvents(a)) === J(E.buildEvents(b)), `${g}/${seed}: bassCells:undefined must be byte-identical to absent`);
  ok(J(E.buildEvents(a)) === J(E.buildEvents(c)), `${g}/${seed}: bassCells:{} must be byte-identical to absent`);
}
console.log(`1 absent identical — ${CASES.length} states`);

// ---- 2 an override plays ----
{
  let moved = 0;
  for (const [g, seed] of CASES) {
    const a = bassState(g, seed), b = bassState(g, seed, { bassCells: { [PAT]: MINE } });
    if (J(bassOf(a)) !== J(bassOf(b))) moved++;
  }
  ok(moved === CASES.length, `an authored cell must shadow the stock case every time (${moved}/${CASES.length})`);
  const [g0, s0] = CASES[0];
  ok(J(bassOf(bassState(g0, s0))) === J(bassOf(bassState(g0, s0, { bassCells: { walking: MINE } }))),
     "overriding an UNPLAYED pattern must change nothing");
  console.log(`2 override plays — ${moved}/${CASES.length}`);
}

// ---- 3 DEGREES, not pitches ----
{
  const [g, seed] = CASES[0];
  const evs = bassOf(bassState(g, seed, { bassCells: { [PAT]: MINE } }));
  const cb = 8;
  const firsts = new Map();
  for (const e of evs) {
    const bar = Math.floor((e.beat + 0.25) / cb);
    const cur = firsts.get(bar);
    if (!cur || e.beat < cur.beat) firsts.set(bar, e);
  }
  const pcs = new Set([...firsts.values()].map((e) => E.pchToMidi(e.pch) % 12));
  ok(pcs.size > 1, `the same degree produced one pitch class (${[...pcs]}) — the cell is not following the chords`);
  console.log(`3 follows the harmony — the root degree spans ${pcs.size} pitch classes`);
}

// ---- 4 semis shift ----
{
  const [g, seed] = CASES[0];
  const flat = bassOf(bassState(g, seed, { bassCells: { [PAT]: [[0, 4, "r5"]] } }));
  const up = bassOf(bassState(g, seed, { bassCells: { [PAT]: [[0, 4, "r5", 3]] } }));
  ok(flat.length === up.length && flat.length > 0, "the semis variant changed the note count");
  const d = flat.length ? E.pchToMidi(up[0].pch) - E.pchToMidi(flat[0].pch) : 0;
  ok(d === 3, `the optional semis element must transpose the degree (got ${d}, want 3)`);
  console.log(`4 semis shift — +3 semitones applied`);
}

// ---- 5 stays home ----
{
  let leaked = 0;
  for (const [g, seed] of CASES) {
    const gen = { pipes: [], thunk: null };
    const a = E.buildEvents(bassState(g, seed, gen));
    const b = E.buildEvents(bassState(g, seed, Object.assign({ bassCells: { [PAT]: MINE } }, gen)));
    for (const v of ["melody", "pad"])
      if (J(a.pitched.filter((e) => e.voice === v)) !== J(b.pitched.filter((e) => e.voice === v))) {
        leaked++; console.error(`  FAIL: ${g}/${seed}: a bass edit moved ${v}`);
      }
    if (J(a.drums) !== J(b.drums)) { leaked++; console.error(`  FAIL: ${g}/${seed}: a bass edit moved the drums`); }
  }
  ok(leaked === 0, "a bass edit leaked out of the bass through the generator layer");
  console.log(`5 stays home — ${CASES.length} states, ${leaked} leaks`);
}

if (fails) { console.error(`\nBASS-CELLS: FAIL — ${fails}/${checks} checks`); process.exit(1); }
console.log(`\nBASS-CELLS: PASS — ${checks} checks; an authored bass cell is a chord-degree line, not a clip`);
