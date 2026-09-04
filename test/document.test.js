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

  /* G7c-e — THE SECTION GRID'S TRIM MAP (2026-08-27, the one-board round —
     Paul: "some voices raise and some fall"). `voice.desk.trim[<secId>]` is a
     fields.js TRIMS word, and normalize prunes it the paranoid way song.js
     prunes an enum: a dead section id goes (development's own law, keyed by id
     so reordering cannot shift a trim under a voice), an unknown WORD goes
     ("an unknown level means the file is from a build this one cannot
     honestly play"), and the emptied shells delete themselves so absent keeps
     one spelling. G7 above already holds the other half: the shipped record
     carries no desk, and normalize is a byte-identical no-op on it. */
  const NF = require(R + "/nukernel/fields.js");
  ok("G7c normalize keeps a valid trim, prunes a dead id and an unknown word", () => {
    const d = J(TERMS);
    const ids = d.form.sections.map((s) => s.id);
    d.voices[0].desk = { trim: { [ids[1]]: "hush", gone: "lift", [ids[2]]: "shout" } };
    Doc.normalize(d);
    assert.deepStrictEqual(d.voices[0].desk.trim, { [ids[1]]: "hush" });
  });
  ok("G7d an emptied trim deletes itself, an emptied desk deletes itself, and garbage is dropped whole", () => {
    const d = J(TERMS);
    d.voices[0].desk = { trim: { gone: "lift" } };
    Doc.normalize(d);
    assert.ok(!("desk" in d.voices[0]), "emptied desk survives");
    const d2 = J(TERMS);
    d2.voices[0].desk = { fader: -3, trim: "garbage" };
    Doc.normalize(d2);
    assert.deepStrictEqual(d2.voices[0].desk, { fader: -3 });
  });
  ok("G7e every TRIMS word survives normalize on a live section id — the grid and the loader share one vocabulary", () => {
    const d = J(TERMS);
    const id = d.form.sections[0].id;
    assert.ok(Object.keys(NF.TRIMS).length >= 5, "TRIMS lost its words");
    for (const w of Object.keys(NF.TRIMS)) {
      d.voices[0].desk = { trim: { [id]: w } };
      Doc.normalize(d);
      assert.deepStrictEqual(d.voices[0].desk.trim, { [id]: w });
    }
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

  /* G10 — THE GREAT RENAME'S DOOR HOLDS (2026-09-01). Paul: "Rename
     everything to a genre... ONLY genre." 68 anchor keys changed, and every
     session, keep and share-resolved doc saved under an old key comes through
     normalize() — the one door — or it loads as GENRES[undefined] = {} with
     no error and the wrong sound. TEST THE ARTIFACT: not the map, the
     render — a doc saved under the old key must render byte-identically to
     the same doc under the new key, and a basis the map never named must
     pass through untouched (absent is today). */
  ok("G10 an old-key session folds at the door and renders byte-identically", () => {
    const P2 = require(R + "/nukernel/precompose.js");
    for (const [oldk, newk] of [["beatles", "beatgroup"], ["motown", "detroitsoul"],
                                ["air", "versailles"], ["portishead", "noirhop"]]) {
      const fresh = Doc.normalize(P2.genreToDocument(newk, 1));
      const legacy = J(fresh); legacy.basis = oldk;
      Doc.normalize(legacy);
      assert.strictEqual(legacy.basis, newk, oldk + " did not fold to " + newk);
      // scoreOf is the render this file already trusts (G8b): the events,
      // not the table. (`__v` and per-call counters make toGenre unequal.)
      assert.deepStrictEqual(J(Doc.scoreOf(legacy, GENRES, FLEET).events),
                             J(Doc.scoreOf(fresh, GENRES, FLEET).events),
                             oldk + " renders a different score than " + newk);
    }
    const un = Doc.normalize(P2.genreToDocument("tango", 1));
    const before = un.basis;
    Doc.normalize(un);
    assert.strictEqual(un.basis, before, "an unmapped basis moved at the door");
  });

  /* G10b — THE HIP-HOP SOUL SWAP: A RETIRED KEY AND A REUSED ONE (2026-09-04).
     Paul: "Do the swap." The two Uptown rows exchanged keys — the Jodeci
     record (Charlotte 1991) took `newjackswing2` and the Mary J. Blige record
     (New York 1992) took the bare `hiphopsoul` off it — so this table now has
     BOTH kinds of rename in it, and they are not the same fact and do not use
     the same door:
       · `hiphopsoul2` and `jodeci` are RETIRED. Nothing answers to them, so
         they fold in `document.js OLDKEYS` at every door, exactly like the 68.
       · `hiphopsoul` MOVED. It names a live row today, so folding it at
         `normalize()` would rewrite every FRESH Blige record into the Jodeci
         row forever — which is why it lives in MOVEDKEYS, which only
         `song.js migrate()` reads and only for a save older than VERSION 3.
     TEST THE ARTIFACT, the same as G10: the renders, not the maps. */
  ok("G10b the retired half folds and renders byte-identically, the reused key does not move", () => {
    const P2 = require(R + "/nukernel/precompose.js");
    for (const [oldk, newk] of [["hiphopsoul2", "hiphopsoul"],
                                ["jodeci", "newjackswing2"]]) {
      const fresh = Doc.normalize(P2.genreToDocument(newk, 1));
      const legacy = J(fresh); legacy.basis = oldk;
      Doc.normalize(legacy);
      assert.strictEqual(legacy.basis, newk, oldk + " did not fold to " + newk);
      assert.deepStrictEqual(J(Doc.scoreOf(legacy, GENRES, FLEET).events),
                             J(Doc.scoreOf(fresh, GENRES, FLEET).events),
                             oldk + " renders a different score than " + newk);
    }
    // ...AND THE REUSED KEY SURVIVES THE DOOR. This is the assertion the
    // MOVEDKEYS block exists for: a Blige record composed a millisecond ago
    // must come back out of normalize() as itself.
    const blige = Doc.normalize(P2.genreToDocument("hiphopsoul", 1));
    assert.strictEqual(blige.basis, "hiphopsoul", "the live key folded at the door");
    Doc.normalize(blige);
    assert.strictEqual(blige.basis, "hiphopsoul", "the live key folded on a second pass");
    assert.strictEqual(Doc.OLDKEYS.hiphopsoul, undefined,
      "a LIVE key is in OLDKEYS — every fresh record under it will be rewritten");
    assert.strictEqual(Doc.MOVEDKEYS.hiphopsoul, "newjackswing2");
  });

  /* G10c — THE SAVE DOOR IS THE ONE WITH A CLOCK (2026-09-04). A song saved
     before the swap said Jodeci when it said `hiphopsoul`; a song saved after
     it says Blige. Nothing in the bytes tells them apart except `v`, which is
     what `song.js` bumped to 3 for exactly this. Both walks are checked — a
     box's `stack[].g` and a session recipe's `parents` — because a moved key
     can sit in either, and the retired keys keep folding at any version. */
  ok("G10c migrate folds a moved key for a v:2 save and leaves a v:3 save alone", () => {
    const NuSong = require(R + "/nukernel/song.js");
    const save = (v) => ({ v, bpm: 92, slots: [], genres: {
                             "lab.x": { label: "Nowhere 1999",
                                        parents: { hiphopsoul: 0.5, jodeci: 0.25 } } },
                           song: [{ stack: [{ g: "hiphopsoul", slots: [0] }] },
                                  { stack: [{ g: "hiphopsoul2", slots: [0] }] }] });
    const old = NuSong.migrate(save(2));
    assert.strictEqual(old.song[0].stack[0].g, "newjackswing2",
      "a pre-swap save's hiphopsoul box did not fold to the Jodeci row");
    assert.strictEqual(old.song[1].stack[0].g, "hiphopsoul",
      "a pre-swap save's hiphopsoul2 box did not fold to the Blige row");
    assert.deepStrictEqual(Object.keys(old.genres["lab.x"].parents).sort(),
                           ["newjackswing2"],
      "an invention's parents did not fold (jodeci and hiphopsoul are one row)");
    const now = NuSong.migrate(save(NuSong.VERSION));
    assert.strictEqual(now.song[0].stack[0].g, "hiphopsoul",
      "a post-swap save's hiphopsoul box was rewritten into the Jodeci row");
    assert.strictEqual(now.song[1].stack[0].g, "hiphopsoul",
      "a retired key stopped folding at the current version");
    // a save with no version at all is older than every version
    const none = NuSong.migrate({ ...save(2), v: undefined });
    assert.strictEqual(none.song[0].stack[0].g, "newjackswing2",
      "an unversioned save did not fold the moved key");
  });

  /* ---- G11 · THE ONE RENAME DOOR (2026-09-02, slice 2c) ----------------
     Paul, B8: *"Motifs are editable using our existing interface … It should be
     easy to make new motifs."* A cell's name is an ADDRESS that four things
     point at — the bank's key, a `voice.material` STRING, every VALUE in a
     `voice.material` map, and the page's own `motifTab`/`cellSel` — so a
     rename is a WALK, and the 2026-09-01 genre-only-rename law says a walk
     like this gets ONE door. This is that door's gate: what moves, what does
     NOT move (the bank's order, which the gutter's ordinals are read off), and
     what is refused. */
  ok("G11 renameCell walks the bank, the string form and the map form", () => {
    const P2 = require(R + "/nukernel/precompose.js");
    const d = Doc.normalize(P2.genreToDocument("reggae", 3));
    const names = Object.keys(d.material.cells);
    const from = names[0], at = names.indexOf(from);
    // who pointed at it before
    const holds = (v, c) => { const m = v.material;
      return m === c || (m && typeof m === "object" &&
        Object.keys(m).some((k) => m[k] === c)); };
    const before = d.voices.filter((v) => holds(v, from)).map((v) => v.name);
    assert.ok(before.length, "the fixture has nobody reading " + from);
    assert.strictEqual(Doc.renameCell(d, from, "ostinato"), true);
    assert.ok(!Object.prototype.hasOwnProperty.call(d.material.cells, from),
      "the old key survived");
    assert.ok(d.material.cells.ostinato, "the new key is not in the bank");
    assert.deepStrictEqual(d.voices.filter((v) => holds(v, "ostinato"))
      .map((v) => v.name), before, "a reader was left pointing at a dead name");
    assert.strictEqual(d.voices.filter((v) => holds(v, from)).length, 0,
      "a reader still names the old cell");
    // THE BANK KEEPS ITS ORDER. The gutter's ordinals and `cellNames()[0]` are
    // read off `Object.keys`, so a rename that moved a cell to the end would
    // renumber every mark in the stripe for a change of spelling.
    assert.strictEqual(Object.keys(d.material.cells).indexOf("ostinato"), at,
      "the renamed cell moved place in the bank");
    // AND IT REFUSES RATHER THAN MERGES — a name in use would make `cellOf`
    // answer for whichever came first and would overwrite a tune.
    const other = Object.keys(d.material.cells).find((n) => n !== "ostinato");
    assert.strictEqual(Doc.renameCell(d, "ostinato", other), false);
    assert.strictEqual(Doc.renameCell(d, "ostinato", "  "), false);
    assert.strictEqual(Doc.renameCell(d, "ostinato", "ostinato"), false);
    assert.strictEqual(Doc.renameCell(d, "nosuchcell", "x"), false);
    assert.ok(d.material.cells.ostinato && d.material.cells[other],
      "a refused rename still moved something");
  });

  /* ---- G12 · THE BASS NAMES ITS OWN INSTRUMENT (2026-09-02, slice 2c) ---
     Paul, 2026-08-28: *"I've lost all ability to select or customize the
     bass."* avail.js's `sound.bassinstrument` tombstone named the fix in three
     lines and this is the one that lives in this file: `toGenre` carries the
     bass voice's `instrument` as `bassInstr`, and audio/plan.js `castOf` seats
     the bass at `bassInstr || POOL.bass || BASS_INSTR`.
     ABSENT IS TODAY, AND THAT IS THE HALF WORTH ASSERTING: precompose writes no
     bass instrument, so every record composed before this line existed hands
     the kernel the object it handed it yesterday — the key is not written at
     all rather than written as null. (The other end of the wire — the ENGINE's
     bass unit actually moving — is test/table.browser.js T8b (was band.browser.js B6c), which reads it off
     `__nuMix()` on the rendered page.) */
  ok("G12 toGenre carries the bass's instrument, and absent is today", () => {
    const P2 = require(R + "/nukernel/precompose.js");
    const d = Doc.normalize(P2.genreToDocument("reggae", 3));
    const bass = d.voices.find((v) => v.kind === "bass");
    assert.ok(bass, "the fixture has no bass to ask about");
    const g0 = Doc.toGenre(d, 0, GENRES, FLEET);
    assert.ok(!("bassInstr" in g0),
      "a record whose bass says nothing still wrote a key");
    bass.instrument = "slap_bass";
    const g1 = Doc.toGenre(d, 0, GENRES, FLEET);
    assert.strictEqual(g1.bassInstr, "slap_bass");
    // ...and it is the BASS's own field, not a line's: a record with no bass
    // says nothing whatever its lines carry.
    const nob = Doc.normalize(P2.genreToDocument("gregorian", 1));
    if (!nob.voices.some((v) => v.kind === "bass"))
      assert.ok(!("bassInstr" in Doc.toGenre(nob, 0, GENRES, FLEET)),
        "a record with no bass wrote a bass instrument");
  });

  /* G13 EVERY SHIPPED PRESET, AND A SAVE OF EVERY PAST VERSION, MIGRATES TO
     NuSong.VERSION AND VALIDATES (2026-09-03). The hour VERSION went 2 -> 3
     for the hip-hop soul swap, migrate() stamped only v:1 saves, so every
     v:2 preset and every saved session came back still saying 2 and
     validateSong refused it ("v: got 2, want 3 (run migrate first)") — and
     G10's alias-door tests were green the whole time, because they built
     their fixtures without a `v`. This is the check that was missing: the
     presets as shipped, plus a synthetic save at each version the box has
     ever written, through the same two calls adoptSong makes. A future
     VERSION bump that forgets a step fails here before it reaches a page. */
  ok("G13 every shipped preset and every past save version migrate and validate", () => {
    const NuSong = require(R + "/nukernel/song.js");
    const P = require(R + "/nukernel/presets.js");
    const list = P.PRESETS || P.presets || P.default || P;
    const arr = Array.isArray(list) ? list : Object.values(list);
    assert.ok(arr.length >= 5, "the preset table is missing");
    for (const p of arr) {
      const d = JSON.parse(JSON.stringify(p.data || p));
      const m = NuSong.migrate(d);
      assert.strictEqual(m.v, NuSong.VERSION, (p.name || "?") + " migrated to v " + m.v);
      const r = NuSong.validateSong(m);
      assert.ok(r.ok, (p.name || "?") + ": " + JSON.stringify(r.ok ? null : r.errors[0]));
    }
    const base = JSON.parse(JSON.stringify((arr[0].data || arr[0])));
    for (let v = 1; v < NuSong.VERSION; v++) {
      const d = JSON.parse(JSON.stringify(base)); d.v = v;
      const m = NuSong.migrate(d);
      assert.strictEqual(m.v, NuSong.VERSION, "a v:" + v + " save migrated to v " + m.v);
      assert.ok(NuSong.validateSong(m).ok, "a v:" + v + " save does not validate after migrate");
    }
  });
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
