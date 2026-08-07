#!/usr/bin/env node
// kit-machine.test.js — state.kits, the /daw KIT MACHINE's engine surface.
//
// The kits became DATA so that authoring one would not mean writing code. This
// gate holds that promise from the engine side, and — the part that actually
// matters for the rack — proves that the two dials the panel exposes (per-op
// probability `p`/`grid.sp`, and the cycle period alt/cyc/last) move the DRUMS
// and nothing else.
//
//   1 absent is IDENTICAL   no state.kits => the stock KITS table, byte-for-byte
//   2 a user kit PLAYS      an override is consulted before the stock table
//   3 shadowing is SAFE     overriding under a stock name changes only that kit
//   4 THE DIAL IS SAFE      turning a lane's probability changes the drums and
//                           leaves bass + melody byte-identical (voiceStreams) —
//                           this is the whole reason the sliders can be exposed
//   5 p:1 is ABSENCE        "always" must not spend a draw deciding it
//
// Run: node test/unit/kit-machine.test.js
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
const GENRES = ["techno", "jungle", "citypop", "heavymetal"];
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.error("  FAIL: " + m); } };

const st = (g, seed, patch) => Object.assign(deep(K.track(g, { seed }).state || K.track(g, { seed })), patch || {});
const drumsOf = (s) => J(E.buildEvents(s).drums);
const voiceOf = (s, v) => J(E.buildEvents(s).pitched.filter((e) => e.voice === v));
// the kit this song's form actually plays (the panel edits only these)
const firstKit = (s) => { for (const sec of s.sections || []) if (sec.drums && sec.drums !== "off") return sec.drums; return null; };

// ---- 1 absent is identical ----------------------------------------------
for (const g of GENRES) for (const seed of [1, 7]) {
  const a = st(g, seed), b = st(g, seed, { kits: undefined }), c = st(g, seed, { kits: {} });
  ok(J(E.buildEvents(a)) === J(E.buildEvents(b)), `${g}/${seed}: kits:undefined must be byte-identical to absent`);
  ok(J(E.buildEvents(a)) === J(E.buildEvents(c)), `${g}/${seed}: kits:{} must be byte-identical to absent`);
}
console.log(`1 absent identical — ${GENRES.length * 2} states`);

// ---- 2 + 3 a user kit plays, and shadows only itself ----------------------
{
  const s0 = st("techno", 1);
  const name = firstKit(s0);
  ok(!!name && !!E.KITS[name], "the engine exposes KITS and the form names one");
  // a deliberately spare kit: four kicks, nothing else
  const mine = { ops: [{ d: "kick", hits: [[0, .6], [2, .6], [4, .6], [6, .6]] }], turn: false };
  const s1 = st("techno", 1, { kits: { [name]: mine } });
  ok(drumsOf(s0) !== drumsOf(s1), "a user kit under a stock name must change the drums");
  const d1 = E.buildEvents(s1).drums;
  ok(d1.length > 0, "the user kit actually emits events");
  ok(d1.every((e) => ["kick", "snare", "hat", "tom", "crash", "ride", "clap", "rim", "perc"].indexOf(e.drum) >= 0),
     "user-kit events carry real drum lanes");
  // Shadowing one name must not disturb a song that plays a DIFFERENT kit. The
  // control has to be a kit THIS FORM NEVER PLAYS — a form can name several kits
  // across its sections, so "any kit but the first" is not good enough (it picked
  // `kick`, which techno's opener does play, and the assertion failed correctly).
  const played = new Set((s0.sections || []).map((sec) => sec.drums).filter(Boolean));
  const other = Object.keys(E.KITS).find((k) => k !== "off" && !played.has(k));
  const sOther = st("techno", 1, { kits: { [other]: mine } });
  ok(drumsOf(s0) === drumsOf(sOther), `overriding an UNPLAYED kit (${other}) must change nothing`);
  console.log(`2-3 user kit plays + shadows only itself — override on "${name}", control on "${other}"`);
}

// ---- 4 THE DIAL IS SAFE (the rack law, on the real editing surface) -------
// Take the kit the form plays, halve one lane's probability, and demand the
// drums move while bass + melody do not. Without voiceStreams this is exactly the
// coupling that made a rack impossible; with it, the slider is safe to expose.
{
  let moved = 0, leaked = 0, cases = 0, coupledWithout = 0;
  for (const g of GENRES) for (const seed of [1, 7]) {
    const base = st(g, seed, { voiceStreams: true });
    const name = firstKit(base);
    if (!name || !E.KITS[name]) continue;
    const kit = deep(E.KITS[name]);
    const idx = kit.ops.findIndex((o) => !o.ride);
    if (idx < 0) continue;
    cases++;
    if (kit.ops[idx].grid) kit.ops[idx].grid.sp = 0.5; else kit.ops[idx].p = 0.5;
    const edited = st(g, seed, { voiceStreams: true, kits: { [name]: kit } });

    if (drumsOf(base) !== drumsOf(edited)) moved++;
    for (const v of ["bass", "melody"])
      if (voiceOf(base, v) !== voiceOf(edited, v)) { leaked++; console.error(`  FAIL: ${g}/${seed}: a drum probability edit moved ${v}`); }

    // control: the same edit WITHOUT the rack law should disturb a pitched voice
    const b2 = st(g, seed), e2 = st(g, seed, { kits: { [name]: kit } });
    if (["bass", "melody"].some((v) => voiceOf(b2, v) !== voiceOf(e2, v))) coupledWithout++;
  }
  ok(cases > 0, "no editable kit op found in any test genre — the dial has nothing to turn");
  ok(moved === cases, `a probability edit must change the drums every time (${moved}/${cases})`);
  ok(leaked === 0, "a drum probability edit leaked into a pitched voice under voiceStreams");
  ok(coupledWithout > 0, "control: the same edit never disturbed a pitched voice WITHOUT voiceStreams — the test proves nothing");
  checks += 0;
  console.log(`4 the dial is safe — ${cases} kits, drums moved ${moved}, pitched leaks ${leaked}, ` +
              `${coupledWithout} coupled without the rack law`);
}

// ---- 5 p:1 is absence, not a draw ----------------------------------------
// An op carrying p:1 would spend an rng draw deciding something never in doubt,
// and draw counts are the currency the rack law spends. The panel stores
// "always" as ABSENCE; this proves the engine agrees the two differ.
{
  const s0 = st("techno", 1, { voiceStreams: true });
  const name = firstKit(s0);
  const kit = deep(E.KITS[name]);
  const idx = kit.ops.findIndex((o) => !o.ride && !o.grid && o.p == null);
  if (idx >= 0) {
    const withP1 = deep(kit); withP1.ops[idx].p = 1;
    const a = st("techno", 1, { voiceStreams: true, kits: { [name]: kit } });
    const b = st("techno", 1, { voiceStreams: true, kits: { [name]: withP1 } });
    ok(drumsOf(a) !== drumsOf(b), "p:1 must NOT be byte-identical to absent p (it spends a draw) — " +
       "so the panel is right to store 'always' as absence");
    console.log("5 p:1 spends a draw — panel stores 'always' as absence");
  } else console.log("5 p:1 — skipped (no bare hit op in this kit)");
}

if (fails) { console.error(`\nKIT-MACHINE: FAIL — ${fails}/${checks} checks`); process.exit(1); }
console.log(`\nKIT-MACHINE: PASS — ${checks} checks; state.kits is ordinary vocabulary and the dials are lane-safe`);
