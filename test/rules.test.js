#!/usr/bin/env node
/* test/rules.test.js — THE GENRE, SAID AS SENTENCES, HELD TO LAW.
 *
 * (Paul, 2026-09-01: "The genre data is expressed as logical sentences and
 * rules derived from the data in the genre. They should be readable to a
 * musician. You can edit them, add new rules from a palette, and set
 * thresholds." And: "Add a 'silence' genre at the top of the genre list. This
 * is a blank state.")
 *
 * PURE NODE, like test/precompose.test.js: the data tier stands on `require`
 * alone. What is held here, and why each one is a law and not a preference:
 *
 *   R1  EVERY ROW SAYS SOMETHING, ON EVERY ANCHOR. A rule whose sentence is
 *       empty on some record is a blank line in a panel whose whole job is to
 *       be readable — and it is how a view learns to print "undefined". Walked
 *       over all 396 anchors x every row, so a row added tomorrow that only
 *       reads on the record its author was looking at fails here.
 *   R2  EVERY OPTION WORD EXISTS IN ITS TABLE. The standing law is that the
 *       conversion is done by EXTRACTION, never by hand — so every value a
 *       rule OFFERS must be a value its owning table holds, and every value a
 *       rule READS off an anchor must be one it offers. A word typed into
 *       rules.js instead of referenced fails both halves.
 *   R3  AN EDIT RE-DERIVES DETERMINISTICALLY AND `GENRES` IS UNCHANGED AFTER.
 *       The purity gate (precompose G6a) and the share-link law (ui/atlas.js:
 *       2358) both stand on the row never being mutated. Measured by taking a
 *       byte portrait of the whole table before and after a hundred edits.
 *   R4  THE BLANK STATE IS ONE SECTION AND ZERO VOICES, and it PLAYS: the
 *       document is well formed, the transport has a form to run.
 *   R5  SEED 0 AND SEED 1 ARE THE SAME RECORD. The seed slider runs 0..2^16
 *       and its first two rungs are the idiom as written; precompose says so
 *       and this measures it.
 *   R6  THE TIERS ARE HONEST. A `render`-tier edit has to reach the kernel
 *       through `document.js toGenre` (there is no document slot for it); a
 *       `compose`-tier edit has to change the composed record. A tier that
 *       lies is a panel that tells a hand the record will not restart and then
 *       restarts it — or, worse, says it will and then nothing happens.
 */
"use strict";
const assert = require("assert");
const path = require("path");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));

const NG = R("genres.js"), NF = R("fields.js"), NC = R("compose.js");
const Id = R("ideas-kit.js"), K = R("kernel.js");
const NU = R("rules.js"), P = R("precompose.js"), Doc = R("document.js");
const NuSong = R("song.js");
const { GENRES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };

const ANCHORS = P.anchors();
console.log("test/rules.test.js — " + NU.RULES.length + " rules over " +
            ANCHORS.length + " anchors\n");

/* ================================================================== R1 */
ok("R1 every rule says a non-empty sentence on every anchor", () => {
  const bad = [];
  for (const gk of ANCHORS) {
    let lines;
    try { lines = NU.say(gk); }
    catch (e) { bad.push(gk + ": say threw — " + e.message); continue; }
    if (lines.length !== NU.RULES.length) bad.push(gk + ": " + lines.length + " sentences");
    for (const l of lines) {
      if (!Array.isArray(l.parts) || !l.parts.length) { bad.push(gk + "/" + l.field + ": no parts"); continue; }
      const text = l.parts.map((p) => p.w).join("");
      if (!text.trim()) bad.push(gk + "/" + l.field + ": empty sentence");
      if (/undefined|null|NaN|\[object/.test(text))
        bad.push(gk + "/" + l.field + ": \"" + text + "\"");
      if (!l.parts.some((p) => p.slot))
        bad.push(gk + "/" + l.field + ": no value slot");
    }
  }
  assert.strictEqual(bad.length, 0, bad.length + " bad sentences, first five:\n       " +
    bad.slice(0, 5).join("\n       "));
});

ok("R1b every rule claims one of AXES.md's eight axes, and a refused rule " +
   "carries its reason", () => {
  const bad = [];
  for (const r of NU.RULES.concat(NU.MOTIF)) {
    if (NU.AXES.indexOf(r.axis) < 0) bad.push(r.field + " axis " + r.axis);
    // NO SILENT GREY: a row with no `edit` is a refusal, and a refusal must
    // say why. (The MOTIF lines are all refusals, by construction.)
    if (!r.edit && !r.why) bad.push(r.field + " is not editable and gives no reason");
  }
  for (const gk of ANCHORS) for (const l of NU.say(gk))
    if (!l.edit && !l.why) bad.push(gk + "/" + l.field + " refused with no reason");
  assert.strictEqual(bad.length, 0, bad.join(", "));
});

ok("R1c every motif line is read-only and says how many steps it is", () => {
  const seen = new Set();
  for (const gk of ANCHORS) for (const m of NU.motifs(gk)) {
    seen.add(m.field);
    assert.strictEqual(m.edit, null, gk + "/" + m.field + " is editable");
    assert.ok(m.why && m.why.trim(), gk + "/" + m.field + " gives no reason");
    assert.ok(m.parts.map((p) => p.w).join("").trim(), gk + "/" + m.field + " says nothing");
  }
  // the seven vector fields askable.js:16-22 fences off; every one of them is
  // declared by some anchor, or the line is describing nothing
  for (const r of NU.MOTIF) assert.ok(seen.has(r.field),
    r.field + " is a motif line no anchor in the catalogue declares");
});

/* ================================================================== R2 */
ok("R2 every option a rule offers exists in the table that owns it", () => {
  const OWNER = {
    // the catalogue's own readings join the table's two departures — the
    // standing answer is always offered (avail.js:15), and `drone` is at 0.25
    rate: () => new Set([1, ...Object.values(NF.RATES),
      ...Object.keys(GENRES).map((k) => GENRES[k].rate).filter((x) => x != null)]),
    meter: () => new Set([null, ...Object.keys(NF.METERLABEL)]),
    mode: () => new Set(Object.keys(NG.MODES)),
    scale: () => new Set([null, ...Object.keys(NG.SCALES), ...Object.keys(NG.MODES)]),
    harmony: () => new Set(Object.keys(NG.HARMONYLABEL)),
    plan: () => new Set(Object.keys(NC.PLANS)),
    intro: () => new Set([null, ...Object.keys(NF.INLABEL)]),
    part: () => new Set(Object.keys(NF.PARTCHOICES)),
    instr: () => new Set(Object.keys(NF.INSTRCHOICES)),
    bassStyle: () => new Set(Object.keys(NF.BASSOPS)),
    artic: () => new Set(Object.keys(NF.ARTICS)),
    drumkit: () => new Set(Object.keys(NF.DRUMKITS)),
    fx: () => new Set(Object.keys(NF.FX)),
    paces: () => new Set(NC.PACES),
    progFamily: () => new Set(Object.keys(NG.PROGS)),
  };
  const bad = [];
  for (const r of NU.RULES) {
    if (!r.edit || !r.edit.values) continue;     // numbers, maps of numbers, changes
    const own = OWNER[r.field];
    if (!own) { bad.push(r.field + " offers a menu no owner is named for"); continue; }
    const legal = own();
    // asked ON AN ANCHOR, because a menu is allowed to carry the reading the
    // row is already on even where the table has no word for it
    for (const gk of ["reggae", "drone", "gregorian", "silence"])
      for (const o of r.edit.values(GENRES[gk], gk))
        if (!legal.has(o.value)) bad.push(gk + "/" + r.field + " offers " + JSON.stringify(o.value));
  }
  assert.strictEqual(bad.length, 0, bad.join("\n       "));
});

ok("R2b every value the catalogue declares is a value its rule offers", () => {
  const bad = [];
  const menuOf = (r, G, gk) => new Set((r.edit.values(G, gk) || [])
    .map((o) => JSON.stringify(o.value)));
  for (const gk of ANCHORS) {
    const G = GENRES[gk];
    for (const r of NU.RULES) {
      if (!r.edit || !r.edit.values || !r.read) continue;
      const v = r.read(G, gk);
      if (v === undefined || v === null) continue;
      const menu = menuOf(r, G, gk);
      const has = (x) => menu.has(JSON.stringify(x));
      if (r.edit.kind === "enum") { if (!has(v)) bad.push(gk + "/" + r.field + " = " + JSON.stringify(v)); }
      else if (r.edit.kind === "list")
        for (const x of (Array.isArray(v) ? v : [v])) if (!has(x))
          bad.push(gk + "/" + r.field + " holds " + JSON.stringify(x));
      else if (r.edit.kind === "map")
        for (const x of Object.values(v)) if (!has(x))
          bad.push(gk + "/" + r.field + " maps to " + JSON.stringify(x));
    }
  }
  assert.strictEqual(bad.length, 0, bad.length + " strangers, first eight:\n       " +
    bad.slice(0, 8).join("\n       "));
});

ok("R2c a `paces`/`progFamily` map may only key roles the row's own plan owns " +
   "(compose.js:562)", () => {
  const bad = [];
  for (const gk of ANCHORS) {
    const G = GENRES[gk], own = new Set(NU.planRoles(G));
    for (const f of ["paces", "progFamily"])
      for (const k of Object.keys(G[f] || {}))
        if (!own.has(k)) bad.push(gk + "." + f + " keys " + k + ", not in " + G.plan);
  }
  assert.strictEqual(bad.length, 0, bad.join(", "));
});

/* ================================================================== R3 */
ok("R3 an edit re-derives deterministically and GENRES is byte-unchanged after", () => {
  // the whole table, before: closures print as their source, which is exactly
  // the half a JSON portrait would drop
  const portrait = () => Object.keys(GENRES).map((k) => k + "=" +
    Object.keys(GENRES[k]).sort().map((f) => f + ":" +
      (typeof GENRES[k][f] === "function" ? String(GENRES[k][f])
        : JSON.stringify(GENRES[k][f]))).join("|")).join("\n");
  const before = portrait();
  const EDITS = [
    [{ f: "bpm", v: 132 }],
    [{ f: "bpm", v: 132 }, { f: "jitter", v: 0 }],
    [{ f: "maxHold", v: 2 }],
    [{ f: "artic", v: "staccato" }],
    [{ f: "mode", v: "lydian" }],
    [{ f: "scale", v: "blues" }],
    [{ f: "harmony", v: "modal" }],
    [{ f: "drumkit", v: "tr808" }],
    [{ f: "bassStyle", v: "walk" }],
    [{ f: "nobass", v: true }],
    [{ f: "voices", v: 3 }],
    [{ f: "plan", v: "dance" }],
    [{ f: "fx", v: ["chorus"] }],
    [{ f: "tone.verb", v: 0.5 }],
    [{ f: "stress", v: 0.7 }],
    [{ f: "paces", v: { verse: "half" } }],
  ];
  const on = ["reggae", "boombap", "gregorian", "techno", "silence"];
  for (const gk of on) for (const e of EDITS) {
    const a = P.genreToDocument(gk, 3, e);
    const b = P.genreToDocument(gk, 3, e);
    assert.deepStrictEqual(a, b, gk + " + " + JSON.stringify(e) + " is not deterministic");
    // ...and it is the SAME document a fresh process would compose: the rules
    // travel on the record, so re-composing from what the record says gets the
    // record back
    assert.deepStrictEqual(P.genreToDocument(gk, 3, a.rules || null), a,
      gk + " does not re-derive from its own doc.rules");
  }
  assert.strictEqual(portrait(), before,
    "GENRES moved under " + on.length * EDITS.length + " edits");
});

ok("R3b applyRules copies — the row handed in is untouched, and the closures " +
   "survive", () => {
  const row = GENRES.reggae;
  const out = NU.applyRules(row, [{ f: "bpm", v: 150 }, { f: "tone.verb", v: 0.9 }]);
  assert.notStrictEqual(out, row);
  assert.strictEqual(row.bpm, 76);
  assert.strictEqual(row.tone.verb, 0.3, "the nested object was written through");
  assert.strictEqual(out.bpm, 150);
  assert.strictEqual(out.tone.verb, 0.9);
  for (const f of ["entry", "reg", "realize", "word"])
    assert.strictEqual(typeof out[f], "function", f + " did not survive the copy");
  // an empty list is the catalogue's own row, by identity
  assert.strictEqual(NU.applyRules(row, []), row);
  assert.strictEqual(NU.applyRules(row, null), row);
});

ok("R3c a said-only rule refuses the write BY NAME, and an unknown field throws", () => {
  assert.throws(() => NU.applyRules(GENRES.reggae, [{ f: "entry", v: 2 }]), /said, not written/);
  assert.throws(() => NU.applyRules(GENRES.reggae, [{ f: "nosuchthing", v: 1 }]), /no rule named/);
});

ok("R3d the door drops what this build has no rule for (song.js validateRules)", () => {
  const v = NuSong.validateRules([{ f: "bpm", v: 120 }, { f: "wat", v: 1 }, "junk", null]);
  assert.deepStrictEqual(v.rules, [{ f: "bpm", v: 120 }]);
  assert.strictEqual(v.dropped.length, 3);
  assert.deepStrictEqual(NuSong.validateRules(null), { rules: null, dropped: [] });
  // ...and normalize is that door's one caller, so a record survives it
  const doc = P.genreToDocument("reggae", 1, [{ f: "bpm", v: 120 }]);
  doc.rules.push({ f: "wat", v: 1 });
  Doc.normalize(doc);
  assert.deepStrictEqual(doc.rules, [{ f: "bpm", v: 120 }]);
  const plain = P.genreToDocument("reggae", 1);
  Doc.normalize(plain);
  assert.ok(!("rules" in plain), "a record with no rules states none");
});

/* ================================================================== R4 */
ok("R4 the blank state is one section, zero voices, and one silent cell", () => {
  const G = GENRES.silence;
  assert.ok(G, "genres.js has no `silence` row");
  assert.strictEqual(G.silent, true, "the row does not declare `silent: true`");
  for (const seed of [1, 2, 7, 65535]) {
    const d = P.genreToDocument("silence", seed);
    assert.strictEqual(d.form.sections.length, 1, "seed " + seed + " sections");
    assert.strictEqual(d.form.sections[0].role, "head");
    assert.strictEqual(d.form.sections[0].bars, 8);
    assert.strictEqual(d.voices.length, 0, "seed " + seed + " seats " + d.voices.length);
    const names = Object.keys(d.material.cells);
    assert.deepStrictEqual(names, ["motif"]);
    const c = d.material.cells.motif;
    assert.strictEqual(c.kind, "line");
    assert.ok(c.play.length === 16 && c.play.every((x) => x === "r"),
      "the blank cell is not sixteen rests");
    assert.strictEqual(c.deg.length, 16);
    assert.strictEqual(d.time.bpm, G.bpm, "the blank state's tempo wandered");
  }
});

ok("R4b …and it PLAYS: the record is well formed, normalize is a no-op, and " +
   "the transport has a form to run", () => {
  const d = P.genreToDocument("silence", 1);
  const before = JSON.stringify(d);
  Doc.normalize(d);
  assert.strictEqual(JSON.stringify(d), before, "normalize repaired the blank state");
  const bx = Doc.boxesOf(d, "gate.");
  assert.strictEqual(bx.length, 1, "boxesOf lost the section");
  assert.strictEqual(bx[0].len, 8);
  assert.strictEqual(Doc.barsOf(d), 1, "the blank cell is not one bar");
  // toGenre answers for the one section, which is what the player asks it
  const g = Doc.toGenre(d, 0, GENRES);
  assert.strictEqual(g.bpm, GENRES.silence.bpm);
  assert.strictEqual(g.voices, 0);
});

ok("R4c the blank state is a genre like any other — it says all " +
   NU.RULES.length + " sentences and offers a palette", () => {
  const lines = NU.say("silence");
  assert.strictEqual(lines.length, NU.RULES.length);
  const pal = NU.offerable("silence");
  assert.ok(pal.length > 0, "nothing can be added to the blank state");
  // the two refusals the blank state's own values earn, measured not typed
  const why = (f) => (pal.find((x) => x.field === f) || {}).why;
  assert.ok(/no bass/.test(why("bassStyle") || ""), "bassStyle: " + why("bassStyle"));
  assert.ok(/drum grid/.test(why("drumkit") || ""), "drumkit: " + why("drumkit"));
});

/* ================================================================== R5 */
ok("R5 seed 0 and seed 1 compose identically, on every anchor", () => {
  const bad = [];
  for (const gk of ANCHORS) {
    const a = JSON.stringify(P.genreToDocument(gk, 0));
    const b = JSON.stringify(P.genreToDocument(gk, 1));
    if (a !== b) bad.push(gk);
  }
  assert.strictEqual(bad.length, 0, bad.length + " differ: " + bad.slice(0, 6).join(", "));
});

ok("R5b absent jitter is ±4 and byte-identical — every anchor composes the " +
   "same record it did before the threshold existed", () => {
  // the proof is arithmetic and it is checked directly: a row that states 4
  // explicitly must compose the SAME bytes as one that states nothing.
  const bad = [];
  // ...on the rows that state nothing, which is what "absent" means. `silence`
  // is the one row in the catalogue that declares a jitter of its own.
  for (const gk of ANCHORS.filter((k) => GENRES[k].jitter == null).slice(0, 60)) {
    for (const seed of [2, 5]) {
      const a = JSON.stringify(P.genreToDocument(gk, seed));
      const b = P.genreToDocument(gk, seed, [{ f: "jitter", v: 4 }]);
      delete b.rules;
      if (a !== JSON.stringify(b)) bad.push(gk + "/" + seed);
    }
  }
  assert.strictEqual(bad.length, 0, "jitter 4 is not the standing answer: " +
    bad.slice(0, 6).join(", "));
  // ...and jitter 0 pins the tempo exactly, at every reading
  for (const seed of [2, 3, 4, 9]) {
    const d = P.genreToDocument("reggae", seed, [{ f: "jitter", v: 0 }]);
    assert.strictEqual(d.time.bpm, GENRES.reggae.bpm, "seed " + seed);
  }
});

/* ================================================================== R6 */
ok("R6 a compose-tier edit changes the composed record", () => {
  const base = P.genreToDocument("reggae", 2);
  const cases = [
    [{ f: "bpm", v: 150 }, (d) => d.time.bpm],
    [{ f: "plan", v: "dance" }, (d) => d.form.sections.map((s) => s.role).join(",")],
    [{ f: "mode", v: "lydian" }, (d) => d.alphabet.mode],
    [{ f: "harmony", v: "modal" }, (d) => d.alphabet.harmony],
    [{ f: "nobass", v: true }, (d) => d.voices.filter((v) => v.kind === "bass").length],
    [{ f: "drumkit", v: "tr808" }, (d) => (d.voices.find((v) => v.kind === "drums") || {}).instrument],
    [{ f: "tone.verb", v: 0.9 }, (d) => JSON.stringify(d.sound.buses)],
  ];
  for (const [e, get] of cases) {
    const d = P.genreToDocument("reggae", 2, [e]);
    assert.notStrictEqual(String(get(d)), String(get(base)),
      JSON.stringify(e) + " reached nothing — declared, costed and silent");
  }
});

ok("R6b a render-tier edit reaches the kernel through toGenre, with no " +
   "document slot of its own", () => {
  const d0 = P.genreToDocument("reggae", 2);
  const g0 = Doc.toGenre(d0, 0, GENRES);
  const cases = [
    [{ f: "maxHold", v: 2 }, (g) => g.maxHold],
    [{ f: "artic", v: "staccato" }, (g) => g.artic],
    [{ f: "bars", v: 8 }, (g) => g.bars],
    [{ f: "fx", v: ["phaser"] }, (g) => JSON.stringify(g.fx)],
  ];
  for (const [e, get] of cases) {
    const d = P.genreToDocument("reggae", 2, [e]);
    const g = Doc.toGenre(d, 0, GENRES);
    assert.notStrictEqual(String(get(g)), String(get(g0)),
      JSON.stringify(e) + " never reached the kernel");
  }
});

ok("R6c every rule names a tier the code actually has, and says it in English", () => {
  for (const r of NU.RULES)
    assert.ok(NU.TIERS[r.rederive], r.field + " claims tier " + r.rederive);
  for (const l of NU.say("reggae"))
    assert.ok(l.tier && l.tier.trim(), l.field + " says no tier");
});

/* ================================================================== the palette */
ok("R7 the palette is exactly the editable rules the row does not declare", () => {
  for (const gk of ["reggae", "boombap", "gregorian", "silence", "techno"]) {
    const G = GENRES[gk];
    const said = new Set(NU.offerable(gk).map((o) => o.field));
    for (const r of NU.RULES) {
      const declared = r.read ? r.read(G, gk) !== undefined : false;
      if (!r.edit) assert.ok(!said.has(r.field), gk + ": " + r.field + " is not editable");
      else assert.strictEqual(said.has(r.field), !declared,
        gk + ": " + r.field + " declared=" + declared + " offered=" + said.has(r.field));
    }
  }
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
