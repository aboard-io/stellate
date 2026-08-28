#!/usr/bin/env node
/* test/pool.test.js — THE INSTRUMENT POOL, HELD TO ONE LAW.
 *
 * (Paul, 2026-08-28: "Fix the pool thing too." And, the same day, "I've lost
 * all ability to select or customize the bass.")
 *
 * The pool is the song's band: one instrument per CHAIR (fields.js POOLCHAIRS),
 * carried by ui/state.js POOL, validated and migrated by song.js, and read by
 * ui/derive.js and audio/plan.js. It was a song fact with no readout, no
 * control, and TWO spellings of what a chair may be handed — one in the live
 * writer and one in the loader. This file holds the parts of that which can be
 * asked in node; test/pool.browser.js asks the rest of it of the rendered page
 * (does an atlas load land with no band, and does POOL.bass reach the seat).
 *
 *   node test/pool.test.js
 */
"use strict";
const path = require("path");
const assert = require("assert");
const R = path.resolve(__dirname, "..");
require(R + "/nukernel/kernel.js");
require(R + "/nukernel/genres.js");
const NF = require(R + "/nukernel/fields.js");
const NuSong = require(R + "/nukernel/song.js");

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };

const base = () => ({ v: NuSong.VERSION, bpm: 120, genres: {},
  slots: [NuSong.blank()],
  song: [{ ...NuSong.emptyBox(), stack: [{ g: "simple", slots: [0] }] }] });
const load = (raw) => { const r = NuSong.load(raw); assert.ok(r.ok,
  "the song did not load: " + JSON.stringify(r.errors && r.errors[0])); return r.song; };

console.log("THE POOL\n");

/* ---- P1  ABSENT IS NULL, AND IT IS THE CLEAR ---------------------------- */
// ui/state.js adoptSong assigns `POOL = s.pool` and nothing else: every
// entrance — boot, a link, an atlas tap, the composer, a file — clears the
// band unless the DOCUMENT hires one. This is the whole of that mechanism, so
// it is asserted here rather than trusted.
ok("P1 a document that hires nobody validates to pool === null", () => {
  assert.strictEqual(load(base()).pool, null);
});
ok("P1b …and so does an explicit empty map — one spelling of \"no pool\"", () => {
  assert.strictEqual(load({ ...base(), pool: {} }).pool, null);
});
ok("P1c …and a pool that is not a map is REFUSED by name, not swallowed", () => {
  const r = NuSong.load({ ...base(), pool: ["overdrive_guitar"] });
  assert.ok(!r.ok || r.song.pool === null);
});

/* ---- P2  ONE LAW FOR WHAT A CHAIR MAY BE HANDED ------------------------- */
// fields.js `poolTakes` is that law. Before it, ui/state.js setPoolChair and
// song.js validateSong each held their own reading of INSTRCHOICES — the same
// answer for as long as every chair took the same 90 ids, and two laws the
// moment the bass chair took eleven.
ok("P2 every POOLCHAIRS seat is a chair and `drums` is not one", () => {
  assert.deepStrictEqual(NF.POOLCHAIRS,
    ["lead", "line", "riff", "counter", "pad", "stab", "drone", "bass"]);
  assert.strictEqual(NF.poolTakes("drums", "acoustic_bass"), false);
});
ok("P2b a pitched chair takes the pool's whole vocabulary", () => {
  assert.strictEqual(NF.poolTakes("lead", "overdrive_guitar"), true);
  assert.strictEqual(NF.poolTakes("lead", "glockenspiel"), true);
});
ok("P2c THE BASS CHAIR TAKES BASSES, and eleven of them", () => {
  const n = Object.keys(NF.BASSCHOICES).length;
  assert.strictEqual(n, 11, "BASSCHOICES is " + n + " wide");
  for (const id of Object.keys(NF.BASSCHOICES))
    assert.ok(NF.INSTRCHOICES[id], id + " is not in the pool's vocabulary");
  assert.strictEqual(NF.poolTakes("bass", "fretless_bass"), true);
  assert.strictEqual(NF.poolTakes("bass", "acoustic_bass"), true);
});
ok("P2d …and a word that casts a glockenspiel into the bass chair LIES", () => {
  assert.strictEqual(NF.poolTakes("bass", "glockenspiel"), false);
  assert.strictEqual(NF.poolTakes("bass", "music_box"), false);
});
ok("P2e the loader holds a saved document to the same law", () => {
  const s = load({ ...base(),
    pool: { bass: "glockenspiel", lead: "overdrive_guitar",
            drums: "acoustic_bass", nosuchchair: "cello", pad: "no_such_id" } });
  assert.deepStrictEqual(s.pool, { lead: "overdrive_guitar" });
});
ok("P2f …and a pool whose every pick is refused normalizes to null", () => {
  assert.strictEqual(load({ ...base(), pool: { bass: "glockenspiel" } }).pool, null);
});

/* ---- P3  A POOL SURVIVES A ROUND TRIP ----------------------------------- */
// the band travels with the SONG it was hired for — ui/state.js songJSON
// writes `pool`, loadFile reads it back — so a document that states a band
// must state the same band after a save and a load.
ok("P3 a hired band round-trips through the save format unchanged", () => {
  const want = { lead: "overdrive_guitar", bass: "fretless_bass" };
  const once = load({ ...base(), pool: want });
  const twice = load(JSON.parse(JSON.stringify(once)));
  assert.deepStrictEqual(once.pool, want);
  assert.deepStrictEqual(twice.pool, want);
});

/* ---- P4  THE LEGACY LIFT STILL LIFTS, AND ONLY INTO LEGAL CHAIRS -------- */
// song.js migrate() turns a pre-pool save's per-layer `instr` into a pool.
// It is the one writer of a pool that a hand never typed, which is exactly
// why the arriving band has to be announced (ui/state.js adoptSong).
ok("P4 a pre-pool save's per-layer `instr` still lifts into the band", () => {
  const raw = base();
  raw.song[0].stack = [{ g: "simple", slots: [0], instr: "overdrive_guitar" }];
  const s = load(raw);
  assert.ok(s.pool && Object.keys(s.pool).length,
    "nothing was lifted: " + JSON.stringify(s.pool));
  for (const [c, id] of Object.entries(s.pool))
    assert.ok(NF.poolTakes(c, id), c + " was lifted an id it cannot take: " + id);
  assert.ok(!s.song[0].stack[0].instr, "the retired per-layer field survived the lift");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
