#!/usr/bin/env node
/* test/loop-words.test.js — THE SAMPLING ROUND'S SEAM, MEASURED END TO END.
 *
 * (Paul, 2026-08-30: "Okay time to bring over sampling from the old version…
 * and I would like you to add loop points and make them editable.")
 *
 * THE PINNED CONTRACT between the two lanes (fields.js VOX `looping`'s own
 * header; audio/to-engine.js samplerVox; state-engine samplerUnit): three
 * per-unit params — `loopa` (loop start, 0..1 fraction of the zone), `loopb`
 * (loop end, 0..1), `loopon` (0 = zone default, 1 = force loop, 2 = force
 * one-shot) — riding the SAME channel the vox knobs ride: voice.sound on the
 * document, the chairs seam's `vox`, samplerVox at the seat. This gate holds
 * the SYSTEM half of that contract against the engine's own dispatch, because
 * the box's characteristic bug is a control that is declared, costed and
 * reaches no sound (memory: "measure, never trust a slider").
 *
 *   W1  the page's predicate and the engine's routing cannot disagree:
 *       over EVERY fields.js INSTRCHOICES id, instruments.js sampledId(id)
 *       === (recipeFor's source starts "sampler:"). This is what makes the
 *       loop strip honest — it is drawn on exactly the chairs whose unit the
 *       sampler plays.
 *   W2  the words ride the whole channel: a voice.sound of
 *       {loopin, loopout, looping} crosses document.js's chairs seam as
 *       `vox` byte-for-byte, and recipeFor turns it into m.loopa/.loopb/
 *       .loopon with the pinned values — numbers pass through, the word
 *       "loop" is 1, "once" is 2, out-of-range numbers clamp to [0,1].
 *   W3  absent is today: no anchor emits a loop key of its own (all 320 x
 *       seeds 1..3), samplerVox of an empty/absent vox is null, and a seat
 *       that says nothing produces a recipe with no loop keys. (The whole-
 *       catalogue byte-identity of documents against the pre-round tree was
 *       measured 2026-08-30 — 960 docs, only the four wired anchors differ:
 *       vaporwave, dnb, hardcorerave, footwork.)
 *   W4  the avail sheets store what the engine can read: `sound.loopin`
 *       set("0.375") stores the NUMBER 0.375 (samplerVox drops strings),
 *       set("") deletes the key, an emptied sound deletes itself, and
 *       `sound.looping` stores the fields.js word.
 *   W5  the crate is not theatre: every id fields.js's sampling-crate list
 *       offers resolves `sampler:<id>` — none is a patch, none unrouted —
 *       and orchestra_hit's zones are unlooped (a stab) while atmosphere's
 *       and sea_shore's loop (beds), read off the same samplerLib the
 *       engine plays.
 *
 * RUN:  node test/loop-words.test.js
 */
"use strict";
const path = require("path");
const assert = require("assert");
const R = (p) => path.join(__dirname, "..", p);

/* the stub window — tape-reach.test.js's own harness */
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", body: { append() {} },
  createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
window.NuKernel = require(R("nukernel/kernel.js"));
window.NuGenres = require(R("nukernel/genres.js"));
window.NuFields = require(R("nukernel/fields.js"));
window.NuSong = require(R("nukernel/song.js"));
window.NuInstruments = require(R("nukernel/instruments.js"));
window.NuSongs = require(R("nukernel/songs.js"));
window.NuDocument = require(R("nukernel/document.js"));
window.__REGISTRY = require(R("engine/registry-data.js"));
const K = require(R("engine/genre-kernel.js"));
const NF = window.NuFields, NI = window.NuInstruments;
const NA = require(R("nukernel/avail.js"));
const NP = require(R("nukernel/precompose.js"));
const ND = window.NuDocument;
const { TERMS } = window.NuSongs;

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };
const clone = (o) => JSON.parse(JSON.stringify(o));

(async () => {
const TE = await import(R("nukernel/audio/to-engine.js"));
const lib = TE.samplerLibFor(K, 1).samplerLib || {};
console.log("test/loop-words.test.js — the loop reaches the unit\n");

/* ---- W1 the predicate is the routing ------------------------------------ */
ok("W1 sampledId agrees with recipeFor over every INSTRCHOICES id", () => {
  const bad = [];
  for (const id of Object.keys(NF.INSTRCHOICES)) {
    const u = [];
    const r = TE.recipeFor("line", { instr: id }, lib, u);
    const engineSampled = typeof r.source === "string" && r.source.indexOf("sampler:") === 0;
    if (NI.sampledId(id) !== engineSampled)
      bad.push(id + " sampledId:" + NI.sampledId(id) + " engine:" + r.source);
  }
  assert.strictEqual(bad.length, 0, bad.length + " ids disagree:\n       " + bad.join("\n       "));
});

/* ---- W2 the words ride the whole channel --------------------------------- */
ok("W2 voice.sound loop words cross the chairs seam and land as loopa/loopb/loopon", () => {
  // the seam: a document voice carrying the words
  const d = ND.normalize(clone(TERMS));
  const v = d.voices.find((x) => x.kind === "line");
  v.instrument = "atmosphere";           // a crate bed — sampler-routed (W1)
  v.sound = { loopin: 0.25, loopout: 0.875, looping: "loop" };
  const g = ND.toGenre(d, 0, []);
  const chair = g.chairs[d.voices.filter((x) => x.kind === "line").indexOf(v)];
  assert.deepStrictEqual(chair.vox, { loopin: 0.25, loopout: 0.875, looping: "loop" },
    "the chairs seam rewrote the sound object: " + JSON.stringify(chair.vox));
  // the seat: recipeFor applies samplerVox onto the recipe
  const r = TE.recipeFor("line", { instr: "atmosphere", vox: chair.vox }, lib, []);
  assert.strictEqual(r.m.loopa, 0.25, "loopa " + r.m.loopa);
  assert.strictEqual(r.m.loopb, 0.875, "loopb " + r.m.loopb);
  assert.strictEqual(r.m.loopon, 1, "loopon " + r.m.loopon);
  // the word table's other value, and the clamps
  const w = TE.samplerVox({ loopin: 1.7, loopout: -3, looping: "once" });
  assert.strictEqual(w.loopa, 1, "loopa clamps high");
  assert.strictEqual(w.loopb, 0, "loopb clamps low");
  assert.strictEqual(w.loopon, 2, "once is 2");
  // a word samplerVox has no table row for writes nothing
  const j = TE.samplerVox({ looping: "sideways" });
  assert.ok(!j || j.loopon == null, "an unknown word wrote loopon " + JSON.stringify(j));
});

/* ---- W3 absent is today --------------------------------------------------- */
ok("W3 no anchor emits a loop key; an empty vox is null; a bare seat has no loop", () => {
  for (const gk of NP.anchors())
    for (const seed of [1, 2, 3]) {
      const doc = NP.genreToDocument(gk, seed);
      for (const v of doc.voices || [])
        if (v.sound) for (const k of ["loopin", "loopout", "looping"])
          assert.ok(!(k in v.sound), gk + "/" + seed + " " + v.name + " emits " + k);
    }
  assert.strictEqual(TE.samplerVox(null), null);
  assert.strictEqual(TE.samplerVox({}), null);
  const r = TE.recipeFor("line", { instr: "atmosphere" }, lib, []);
  for (const k of ["loopa", "loopb", "loopon"])
    assert.ok(!(k in r.m), "a seat that said nothing carries " + k + "=" + r.m[k]);
});

/* ---- W4 the sheets store numbers, not strings ----------------------------- */
ok("W4 sound.loopin/.loopout store numbers, empty deletes, looping stores the word", () => {
  const d = ND.normalize(clone(TERMS));
  const v = d.voices.find((x) => x.kind === "line");
  const S = { voice: v.name };
  NA.SHEETS["sound.loopin"].set(d, S, "0.375");
  assert.strictEqual(v.sound.loopin, 0.375, "stored " + JSON.stringify(v.sound.loopin));
  assert.strictEqual(typeof v.sound.loopin, "number", "a string would be dropped by samplerVox");
  assert.strictEqual(NA.SHEETS["sound.loopin"].get(d, S), "0.375");
  NA.SHEETS["sound.loopout"].set(d, S, "2");         // clamps into the zone
  assert.strictEqual(v.sound.loopout, 1);
  NA.SHEETS["sound.looping"].set(d, S, "once");
  assert.strictEqual(v.sound.looping, "once");
  assert.ok(NF.VOX.looping.t[v.sound.looping] === 2, "the word maps to the pinned value");
  // zero is a value, not an absence (it forces the loop to the zone's start)
  NA.SHEETS["sound.loopin"].set(d, S, "0");
  assert.strictEqual(v.sound.loopin, 0);
  // and "" is the absence
  NA.SHEETS["sound.loopin"].set(d, S, "");
  assert.ok(!("loopin" in v.sound), "empty did not delete");
  NA.SHEETS["sound.loopout"].set(d, S, "");
  NA.SHEETS["sound.looping"].set(d, S, "");
  assert.ok(!v.sound, "an emptied sound object must delete itself");
});

/* ---- W5 the crate is real ------------------------------------------------- */
ok("W5 every crate id routes sampler:<id>; the stab is unlooped, the beds loop", () => {
  const CRATE = ["orchestra_hit", "atmosphere", "soundtrack", "ice_rain", "crystal",
                 "fantasia", "star_theme", "brightness", "goblin", "sea_shore"];
  for (const id of CRATE) {
    assert.ok(NF.INSTRCHOICES[id], id + " is not offered");
    const u = [];
    const r = TE.recipeFor("line", { instr: id }, lib, u);
    assert.strictEqual(r.source, "sampler:" + id,
      id + " routes " + r.source + (u.length ? " (" + u[0].why + ")" : ""));
    assert.ok(NI.RANGES[id], id + " has no compass row");
  }
  const looped = (id) => (lib[id].zones || []).some((z) => z.loop);
  assert.ok(!looped("orchestra_hit"), "the stab's zones loop — it is not a hit");
  assert.ok(looped("atmosphere") && looped("sea_shore"), "the beds' zones do not loop");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
})();
