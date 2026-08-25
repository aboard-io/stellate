// test/document.test.js — THE EXTRACTION MOVED NOTHING.
//
// PROGRAM.md §5: "`node test/document.test.js` — the extraction moved nothing:
// `toGenre(TERMS,i)` deep-equals `test/fixtures/terms-genre.json` at every
// section index." That fixture was captured off the PRE-MOVE `ui/eight.js`
// source text before a line of `nukernel/document.js` was written — see
// `test/fixtures/terms-genre.freeze.js`, which is both the derivation and the
// single owner of the portrait shape both sides use.
//
// WHY A PORTRAIT AND NOT THE OBJECT. A genre carries four functions and a
// monotonic `__v`, neither of which survives JSON. `portrait()` calls the
// functions for every declared voice and freezes the ANSWERS — and for `word`,
// whose answer is itself a list of kernel operators, it freezes what those
// operators DO to one fixed reference phrase. A count would have passed while
// the operators changed underneath it. `__v` is excluded from the portrait and
// asserted on its own terms below.
//
// Pure node: no DOM, no window, no audio. The one `await import` is
// `audio/to-engine.js`, for `SYNTH_NAMES()` — the only table that knows which
// instrument names are modelled Faust voices, which `document.js` cannot
// require (it is an ES module and document.js must stay node-requirable), so
// the caller passes the fleet. The chant's cantor is a `tract_voice`, so this
// is not decoration: get the fleet wrong and its chair says `instr` instead of
// `synth` and the fixture catches it.
"use strict";
const path = require("path");
const assert = require("assert");
const R = path.resolve(__dirname, "..");
const K  = require(R + "/nukernel/kernel.js");
const NG = require(R + "/nukernel/genres.js");
const Songs = require(R + "/nukernel/songs.js");
const Doc = require(R + "/nukernel/document.js");
const { portrait } = require("./fixtures/terms-genre.freeze.js");
const FIX = require("./fixtures/terms-genre.json");

const J = (x) => JSON.parse(JSON.stringify(x));
let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };

(async () => {
  const { SYNTH_NAMES } = await import(R + "/nukernel/audio/to-engine.js");
  const FLEET = SYNTH_NAMES();
  const TERMS = J(Songs.TERMS);            // the page works on a deep copy too
  const { GENRES } = NG;
  const NS = TERMS.form.sections.length;

  console.log("test/document.test.js — the extraction moved nothing");

  /* G1 — toGenre, section by section, against the frozen pre-move capture. */
  for (let i = 0; i < NS; i++) ok("G1 toGenre(TERMS," + i + ") == frozen genreFor(" + i + ")",
    () => assert.deepStrictEqual(
      J(portrait(Doc.toGenre(TERMS, i, GENRES, FLEET), K)), J(FIX.sections[i])));

  ok("G1b the fixture actually covers all five sections",
    () => assert.strictEqual(FIX.sections.length, NS));

  /* G2 — `__v`. Excluded from the portrait because it is a counter; asserted
     here for the property the page depends on (ui/derive.js reads it to know a
     genre row was rewritten), which is that it strictly increases. */
  ok("G2 __v is a strictly increasing integer", () => {
    const a = Doc.toGenre(TERMS, 0, GENRES, FLEET).__v;
    const b = Doc.toGenre(TERMS, 0, GENRES, FLEET).__v;
    assert.ok(Number.isInteger(a) && Number.isInteger(b), "not integers");
    assert.ok(b > a, b + " !> " + a);
  });

  /* G3 — toPhrase, every cell in the record. */
  for (const n of Object.keys(TERMS.material.cells))
    ok("G3 toPhrase(TERMS," + n + ") == frozen phrase(" + n + ")",
      () => assert.deepStrictEqual(J(Doc.toPhrase(TERMS, n)), J(FIX.phrases[n])));

  ok("G3b an unknown cell name falls back to the first, as the page's did",
    () => assert.deepStrictEqual(J(Doc.toPhrase(TERMS, "nosuchcell")),
                                 J(FIX.phrases[Object.keys(TERMS.material.cells)[0]])));

  /* G4 — materialAt. ABSENT IS TODAY: a string is returned untouched, which is
     why wiring it into push() left the shipped chant byte-identical. */
  ok("G4 materialAt: a string voice is the string", () => {
    for (const v of TERMS.voices)
      assert.strictEqual(Doc.materialAt(v, "c3"), v.material);
  });
  ok("G4b materialAt: the map form picks by section, then the default", () => {
    const v = { material: { c1: "psalm", "": "bed" } };
    assert.strictEqual(Doc.materialAt(v, "c1"), "psalm");
    assert.strictEqual(Doc.materialAt(v, "c4"), "bed");
    assert.strictEqual(Doc.materialAt({ material: { c1: "psalm" } }, "c4"), undefined);
  });

  /* G5 — barsOf. The chant's cells are sixteen steps in four, so one bar. */
  ok("G5 barsOf(TERMS) === 1", () => assert.strictEqual(Doc.barsOf(TERMS), 1));
  ok("G5b a 32-step cell in four is two bars", () => {
    const d = J(TERMS);
    d.material.cells.psalm.deg = new Array(32).fill(0);
    assert.strictEqual(Doc.barsOf(d), 2);
  });
  ok("G5c the meter is read, not assumed", () => {
    const d = J(TERMS); d.time.meter = "three";      // fields.js METERS key
    assert.ok(K.METERS.three, "METERS.three must exist for this assertion");
    assert.strictEqual(Doc.barsOf(d),
      Math.max(1, Math.round(16 / K.METERS.three.steps)));
  });

  /* G6 — boxesOf, against the same pre-move arithmetic, re-derived here rather
     than frozen: it is five lines and every field is a document field. */
  ok("G6 boxesOf(TERMS) is one box per section, in order", () => {
    const bx = Doc.boxesOf(TERMS, "lab.eight.");
    assert.strictEqual(bx.length, NS);
    bx.forEach((b, i) => {
      const s = TERMS.form.sections[i];
      assert.strictEqual(b.len, s.bars);
      assert.strictEqual(b.role, s.role);
      assert.strictEqual(b.cue, s.role);
      assert.deepStrictEqual(b.stack, [{ g: "lab.eight." + i, slots: [0 * NS + i, 1 * NS + i] }]);
      assert.strictEqual(b.bassop, null);      // the chant has no bass voice
      assert.strictEqual(b.kit, null);         // …and no drummer
    });
  });

  /* G7 — normalize. ABSENT IS TODAY twice over: on the shipped record it is a
     no-op, and it still fills, prunes and repairs the way the page's did. */
  ok("G7 normalize(TERMS) is a no-op on the shipped record", () => {
    const before = JSON.stringify(TERMS);
    Doc.normalize(TERMS);
    assert.strictEqual(JSON.stringify(TERMS), before);
  });
  ok("G7b normalize fills a missing word, prunes a dead id, repairs a lost cell", () => {
    const d = J(TERMS);
    delete d.voices[0].development.c3;
    d.voices[0].development.gone = "backwards";
    d.voices[1].material = "vanished";
    Doc.normalize(d);
    assert.strictEqual(d.voices[0].development.c3, "as written");
    assert.ok(!("gone" in d.voices[0].development));
    assert.strictEqual(d.voices[1].material, Object.keys(d.material.cells)[0]);
  });

  /* G8 — scoreOf. Nothing froze this (nothing computed it before), so it is
     asserted for the properties that make it a score: every section sounds,
     the events are in time order, and the record is as long as the form says. */
  ok("G8 scoreOf(TERMS) plays every section, in order, for the full form", () => {
    const S = Doc.scoreOf(TERMS, GENRES, FLEET);
    const bars = TERMS.form.sections.reduce((a, s) => a + s.bars, 0);
    assert.strictEqual(S.bars, bars, "bars");
    assert.ok(S.events.length > 0, "no events at all");
    for (let i = 1; i < S.events.length; i++)
      assert.ok(S.events[i].t >= S.events[i - 1].t, "events out of time order at " + i);
    for (let i = 0; i < NS; i++) {
      const sounding = S.events.filter((e) => e.sec === i && e.n != null && e.vel > 0);
      assert.ok(sounding.length > 0, "section " + i + " is silent");
    }
    // the chant is two line voices and no rhythm section
    assert.deepStrictEqual([...new Set(S.events.map((e) => e.kind))].sort(), ["line"]);
    assert.deepStrictEqual([...new Set(S.events.map((e) => e.lv))].sort(), [0, 1]);
  });
  ok("G8b scoreOf is deterministic", () => assert.deepStrictEqual(
    J(Doc.scoreOf(TERMS, GENRES, FLEET).events),
    J(Doc.scoreOf(TERMS, GENRES, FLEET).events)));

  /* G9 — the fleet seam, stated as a test because it is the one thing this
     move could not carry: a caller that does not pass the Faust fleet gets the
     sampled spelling of the chair, and that is a real difference. */
  ok("G9 the fleet decides the chair: tract_voice is a synth chair with it, an instr chair without", () => {
    const withF = Doc.toGenre(TERMS, 0, GENRES, FLEET).chairs[0];
    const without = Doc.toGenre(TERMS, 0, GENRES).chairs[0];
    assert.ok(withF.synth && withF.synth.dsp === "tract_voice", "no synth chair with the fleet");
    assert.deepStrictEqual(without, { instr: "tract_voice" });
  });

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
