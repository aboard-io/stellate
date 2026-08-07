#!/usr/bin/env node
// melody-gen.test.js — state.melodyGen, the /daw WANDER MACHINE's engine surface.
//
// The `wander` generator was six literal constants inside one while-loop. Each is
// now a knob whose DEFAULT is that literal, which buys the machine only if two
// things hold, and this gate holds both:
//
//   1 absent is IDENTICAL   no melodyGen => the same numbers in the same draw
//                           order as the literals produced
//   2 defaults are FAITHFUL passing the defaults EXPLICITLY is also identical —
//                           the panel's "revert" target really is the engine's
//   3 every knob BITES      each one changes the melody when turned
//   4 rest costs NOTHING    the one knob that adds a draw draws nothing at 0
//   5 the knobs stay HOME   turning the melody machine leaves bass + drums
//                           byte-identical (voiceStreams)
//
// Run: node test/unit/melody-gen.test.js
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

// the engine's own literals, mirrored by app/daw/machines/melody.js DEFAULTS
const DEFAULTS = { rhythm: [1, 0.5, 0.5, 1, 1, 2], step: 1, leap: 0.18, range: [0, 3], legato: 0.92, rest: 0 };

// A state that actually RUNS wander — the knobs only reach that generator, so a
// genre whose form never calls it would make every assertion below vacuous.
function wanderState(g, seed, gen) {
  const t = K.track(g, { seed });
  const s = deep(t.state || t);
  let any = false;
  for (const sec of s.sections || []) if (sec.melody && sec.melody !== "off") { sec.melody = "wander"; any = true; }
  if (!any) return null;
  s.voiceStreams = true;
  if (gen) s.melodyGen = gen;
  return s;
}
const mel = (s) => J(E.buildEvents(s).pitched.filter((e) => e.voice === "melody"));
const GENRES = ["citypop", "jungle", "techno", "folk", "dub"];
const CASES = [];
for (const g of GENRES) for (const seed of [1, 5, 7]) { const s = wanderState(g, seed); if (s) CASES.push([g, seed]); }
ok(CASES.length > 0, "no test genre runs a melody at all — the gate would be vacuous");

// ---- 1 absent is identical (whole build, not just the melody) -------------
for (const [g, seed] of CASES) {
  const a = wanderState(g, seed), b = wanderState(g, seed, undefined);
  ok(J(E.buildEvents(a)) === J(E.buildEvents(b)), `${g}/${seed}: melodyGen:undefined must be byte-identical to absent`);
}
console.log(`1 absent identical — ${CASES.length} wander states`);

// ---- 2 the defaults ARE the literals -------------------------------------
// The panel offers "revert to stock". If passing the defaults explicitly differed
// from passing nothing, revert would be a lie and every knob would carry a hidden
// offset from the engine's real behaviour.
{
  let bad = 0;
  for (const [g, seed] of CASES) {
    const a = wanderState(g, seed), b = wanderState(g, seed, deep(DEFAULTS));
    if (mel(a) !== mel(b)) { bad++; console.error(`  FAIL: ${g}/${seed}: explicit defaults differ from absent`); }
  }
  ok(bad === 0, "the panel's DEFAULTS must reproduce the engine's literals exactly");
  console.log(`2 defaults faithful — ${CASES.length} states, ${bad} divergent`);
}

// ---- 3 every knob bites --------------------------------------------------
{
  const TURNS = {
    step:   { step: 3 },
    leap:   { leap: 0.9 },
    legato: { legato: 0.35 },
    rest:   { rest: 0.5 },
    rhythm: { rhythm: [0.5] },
    range:  { range: [0, 1] },
  };
  for (const k of Object.keys(TURNS)) {
    let moved = 0;
    for (const [g, seed] of CASES) {
      const a = wanderState(g, seed), b = wanderState(g, seed, Object.assign(deep(DEFAULTS), TURNS[k]));
      if (mel(a) !== mel(b)) moved++;
    }
    ok(moved > 0, `knob "${k}" changed nothing in ${CASES.length} states — it is not wired`);
  }
  console.log(`3 every knob bites — ${Object.keys(TURNS).length} knobs over ${CASES.length} states`);
}

// ---- 4 rest:0 costs no draw ----------------------------------------------
// rest is the only knob that can add an rng draw. At 0 it must draw nothing, or
// every genre in the catalogue shifts the moment the knob exists.
{
  let bad = 0;
  for (const [g, seed] of CASES) {
    const a = wanderState(g, seed);
    const b = wanderState(g, seed, Object.assign(deep(DEFAULTS), { rest: 0 }));
    if (J(E.buildEvents(a)) !== J(E.buildEvents(b))) bad++;
  }
  ok(bad === 0, "rest:0 must draw nothing (byte-identical to absent)");
  console.log(`4 rest:0 draws nothing — ${CASES.length} states`);
}

// ---- 5 the knobs stay home, and WHERE THAT STOPS --------------------------
// Isolation is a property of the GENERATOR layer (docs/DAW.md "Where isolation
// stops"; test/unit/voice-streams.test.js gates the same boundary). The pipes read
// the whole bundle on purpose: `densityArc` is a density ENVELOPE over the
// arrangement, so thinning the melody legitimately re-thins the bass under it.
// So 5A turns the cross-voice layer off and demands exact isolation, and 5B turns
// it back on and demands the coupling RETURNS — measured, techno/7 is one of the
// states where it does.
{
  const GEN_ONLY = { pipes: [], thunk: null };
  let leaked = 0, moved = 0, coupledWithPipes = 0;
  for (const [g, seed] of CASES) {
    const turn = Object.assign(deep(DEFAULTS), { step: 3, leap: 0.8, rest: 0.3 });
    const a = Object.assign(wanderState(g, seed), GEN_ONLY);
    const b = Object.assign(wanderState(g, seed, turn), GEN_ONLY);
    const ea = E.buildEvents(a), eb = E.buildEvents(b);
    if (J(ea.pitched.filter((e) => e.voice === "melody")) !== J(eb.pitched.filter((e) => e.voice === "melody"))) moved++;
    if (J(ea.pitched.filter((e) => e.voice === "bass")) !== J(eb.pitched.filter((e) => e.voice === "bass"))) {
      leaked++; console.error(`  FAIL: ${g}/${seed}: a melody-machine edit moved the bass through the GENERATOR layer`);
    }
    // 5B the boundary: with the pipes restored, coupling is expected
    const fa = E.buildEvents(wanderState(g, seed)), fb = E.buildEvents(wanderState(g, seed, turn));
    if (J(fa.pitched.filter((e) => e.voice === "bass")) !== J(fb.pitched.filter((e) => e.voice === "bass"))) coupledWithPipes++;
  }
  ok(moved === CASES.length, `the melody must move every time (${moved}/${CASES.length})`);
  ok(leaked === 0, "a melody-machine edit leaked into the bass through the generator layer");
  ok(coupledWithPipes > 0,
     "boundary: the note-fx pipes no longer reach across voices — if that is intentional, move this " +
     "assertion; it is load-bearing documentation (densityArc is an arrangement-wide envelope)");
  console.log(`5 knobs stay home — melody moved ${moved}/${CASES.length}, generator-layer leaks ${leaked}, ` +
              `${coupledWithPipes} coupled through the pipes (by design)`);
}

if (fails) { console.error(`\nMELODY-GEN: FAIL — ${fails}/${checks} checks`); process.exit(1); }
console.log(`\nMELODY-GEN: PASS — ${checks} checks; the wander knobs are live, faithful and lane-safe`);
