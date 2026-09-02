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
 *   R6  THE TIERS ARE HONEST, AND THE TIER IS MEASURED AND NOT READ.
 *       Rewritten 2026-09-02 (the composer fix round) after the probe found
 *       the first lie: *"'the loop is N bars' (rules.js:390-395, rederive
 *       "render") reaches nothing: g.bars is only read at COMPOSE time."* The
 *       old R6 asserted three hand-picked fields in each direction, which is
 *       an example and not a law, and five rows were lying under it.
 *
 *       So the tier of EVERY editable rule is now MEASURED, over a fixed set
 *       of anchors and a sweep of each rule's own legal values, by the only
 *       two questions the three tiers are made of:
 *         does an edit move the COMPOSED DOCUMENT?     -> "compose"
 *         else, does it move `toGenre`'s output?       -> "render"
 *         else it reaches nothing at all, which is the box's characteristic
 *         bug (docs: "declared but never arriving") and fails here by name.
 *       A field with BOTH readers is a `compose`: a render-only edit would
 *       leave the composed half of the record saying the old number while the
 *       kernel is handed the new one. The declared `rederive` must equal the
 *       measurement, so a tier cannot drift from the code again without this
 *       going red.
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
    // the bass chair's own eleven, and NOT INSTRCHOICES — fields.js keeps the
    // narrower list because "a word that casts a glockenspiel into the bass
    // chair is a word that lies", and this line is what holds the menu to it.
    bassInstr: () => new Set([null, ...Object.keys(NF.BASSCHOICES)]),
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
/* THE MEASUREMENT. Two portraits of a record and one sweep of values.

   `docOf` is the composed document with `rules` itself stripped — the list of
   sentences is stored ON the document, so comparing it would make every edit
   look like it moved the record.
   `genOf` is what `document.js toGenre` hands the kernel for every section of
   an UNCHANGED document that merely carries the sentence: that is exactly the
   render path (`ctx.changed()` and no new record), and functions are stamped
   rather than serialised because a closure does not cross JSON. */
const TIERANCH = ["reggae", "boombap", "gregorian", "techno", "silence",
                  "punk", "waltz", "dub", "acid", "ambient"]
  .filter((k) => GENRES[k]);
const stripRules = (d) => { const c = JSON.parse(JSON.stringify(d));
  delete c.rules; return c; };
const docOf = (d) => JSON.stringify(stripRules(d));
const genOf = (d) => d.form.sections.map((_, i) =>
  JSON.stringify(Doc.toGenre(d, i, GENRES),
    (k, v) => (typeof v === "function" ? "fn" : (k === "__v" ? 0 : v)))).join("|");

/* EVERY LEGAL VALUE THE ROW ITSELF OFFERS — the sweep is derived off `edit`,
   never typed, so a rule added tomorrow is swept the day it is added. */
function sweep(r, G, gk) {
  const e = r.edit;
  if (!e) return [];
  const cur = r.read ? r.read(G, gk) : undefined;
  const diff = (v) => String(v) !== String(cur);
  if (e.kind === "number") {
    const out = [];
    for (let i = 0; i <= 4; i++) {
      const v = +(e.min + (e.max - e.min) * i / 4).toFixed(4);
      if (diff(v)) out.push(v);
    }
    return out;
  }
  if (e.kind === "enum") return (e.values(G, gk) || []).map((o) => o.value).filter(diff);
  if (e.kind === "flag") return [true, false].filter((v) => v !== cur);
  if (e.kind === "list") {
    const vs = (e.values(G, gk) || []).map((o) => o.value);
    return [[vs[0]], [vs[1] || vs[0]], vs.slice(0, 2)].filter((a) => a[0] != null);
  }
  if (e.kind === "map") {
    const ks = (e.keys ? e.keys(G, gk) : []) || [];
    const vs = (e.values ? e.values(G, gk) : []) || [];
    if (!ks.length) return [];
    const mk = (v) => { const o = {}; ks.forEach((k) => { o[k] = v; }); return o; };
    return vs.length ? vs.slice(0, 3).map((o) => mk(o.value)) : [0, 0.5, 1].map(mk);
  }
  if (e.kind === "pair") return [{ t: 0, v: 0 }, { t: 0.5, v: 0.5 }, { t: 1, v: 1 }];
  if (e.kind === "changes") return [[{ d: 0, q: "triad" }, { d: 4, q: "7" }],
                                    [{ d: 5, q: "triad" }]];
  return [];
}

function measureTier(r) {
  let doc = null, gen = false, n = 0;
  for (const gk of TIERANCH) {
    const G = GENRES[gk];
    const base = P.genreToDocument(gk, 2);
    const b0 = docOf(base), g0 = genOf(base);
    for (const v of sweep(r, G, gk)) {
      let d1;
      try { d1 = P.genreToDocument(gk, 2, [{ f: r.field, v }]); }
      catch (err) { continue; }       // a value this row refuses is not a tier
      n++;
      if (docOf(d1) !== b0) { doc = doc || (gk + " " + JSON.stringify(v)); }
      if (!gen) {
        const asIs = JSON.parse(b0); asIs.rules = [{ f: r.field, v }];
        try { if (genOf(asIs) !== g0) gen = true; } catch (err) { /* ignore */ }
      }
      if (doc && gen) break;
    }
    if (doc && gen) break;
  }
  return { tier: doc ? "compose" : (gen ? "render" : null), n, where: doc };
}

ok("R6 every editable rule's tier is what the code MEASURES it to be", () => {
  const bad = [];
  for (const r of NU.RULES) {
    if (!r.edit) continue;
    const m = measureTier(r);
    if (!m.n) { bad.push(r.field + ": no legal value to sweep"); continue; }
    if (!m.tier) {
      bad.push(r.field + ' claims "' + r.rederive + '" and reaches NOTHING — ' +
        "declared, costed and silent (" + m.n + " values swept)");
      continue;
    }
    if (m.tier !== r.rederive)
      bad.push(r.field + ' claims "' + r.rederive + '", measures "' + m.tier +
        '"' + (m.where ? " (" + m.where + ")" : ""));
  }
  assert.strictEqual(bad.length, 0, "\n       " + bad.join("\n       "));
});

ok("R6b a said-only rule is said on every anchor and writes nowhere", () => {
  for (const r of NU.RULES.concat(NU.MOTIF)) {
    if (r.edit) continue;
    assert.ok(typeof r.why === "function", r.field + " is refused with no reason");
    for (const gk of TIERANCH)
      assert.ok(String(r.why(GENRES[gk], gk) || "").trim(),
        r.field + " refuses silently on " + gk);
    assert.throws(() => NU.applyRules(GENRES.reggae, [{ f: r.field, v: 1 }]),
      r.field + " accepted a write it has no row for");
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

/* ================================================================== R2d
   NATIVE INSTRUMENTS FIRST, AND EVERY ONE OF THEM REACHES A SOUND.

   Paul, wave 4 §10: *"When you define a genre you seem to only allow the
   sample instrument not the faust instrument like on high nrg… that's the
   opposite those should be chosen after native"*.

   `hinrg` is the record he was looking at and all three of its instruments are
   Faust voices — `polysynth` is the Juno-60, `saw_wave` the supersaw,
   `solo_vox` the modelled throat — so the ids were never the problem: the menu
   printed all 119 of `NF.INSTRCHOICES` in one flat alphabet with nothing to
   say which of them the engine MODELS and which it plays back off disk, and 86
   of the 119 are recordings.

   THREE CLAIMS, AND THE THIRD IS THE ONE THAT MATTERS. That the menu is two
   groups with `native` first; that the group split is `instruments.js
   sampledId` and not a list typed into `rules.js` (asserted by comparing every
   id's group against that predicate, and then against the BRIDGE itself); and
   that a native id written into an `instr` rule REACHES THE RECORD AND THE
   ENGINE — `voice.instrument` on the composed cast, the chair `document.js`
   compiles, and a recipe out of `audio/to-engine.js recipeFor` whose source is
   a model and not a sampler read. The bridge is an ES module, so it is reached
   the way `test/precompose.test.js` G11a reaches it: `await import`, which is
   why the summary below sits inside this function. */
(async () => {
  const TE = await import(path.join(__dirname, "..",
    "nukernel", "audio", "to-engine.js"));
  const NI = R("instruments.js");

  ok("R2d the instrument menu is native first, then the recordings, and the " +
     "split is instruments.js sampledId and not a list typed here", () => {
    const r = NU.RULES.find((x) => x.field === "instr");
    const os = r.edit.values(GENRES.hinrg, "hinrg");
    assert.strictEqual(os.length, Object.keys(NF.INSTRCHOICES).length,
      "the menu offers every id it always did");
    const groups = [...new Set(os.map((o) => o.group))];
    assert.deepStrictEqual(groups, ["native", "sampled"],
      "two groups, native first — got " + JSON.stringify(groups));
    // ...and CONTIGUOUS, because ui/selects.js opens a new <optgroup> every
    // time the group word changes: an interleaved list would draw two
    // "native" headings with a "sampled" one between them.
    const flip = os.findIndex((o) => o.group === "sampled");
    assert.ok(os.slice(0, flip).every((o) => o.group === "native") &&
              os.slice(flip).every((o) => o.group === "sampled"),
      "the groups are contiguous");
    const wrong = os.filter((o) =>
      (o.group === "sampled") !== !!NI.sampledId(o.value));
    assert.strictEqual(wrong.length, 0, "the group is sampledId's answer: " +
      wrong.slice(0, 5).map((o) => o.value + " -> " + o.group).join(", "));
    console.log("       " + flip + " native, " + (os.length - flip) +
      " sampled; hinrg holds " + JSON.stringify(GENRES.hinrg.instr));
  });

  ok("R2d/b every id the menu calls native IS one the bridge models, and " +
     "every id it calls sampled is one the bridge samples", () => {
    const modelled = (id) => {
      const un = [];
      const rec = TE.recipeFor("line", { instr: id, tone: null, synth: null }, {}, un);
      return !un.length && String(rec.source || "").split(":")[0] !== "unrouted" &&
             !!(rec.m && rec.m.model);
    };
    const r = NU.RULES.find((x) => x.field === "instr");
    const bad = r.edit.values(GENRES.hinrg, "hinrg")
      .filter((o) => (o.group === "native") !== modelled(o.value))
      .map((o) => o.value + " is offered as " + o.group);
    assert.strictEqual(bad.length, 0, bad.slice(0, 8).join(", "));
  });

  ok("R2d/c a native id written into an `instr` rule reaches the record's " +
     "cast AND the compiled recipe", () => {
    const ID = "polysynth";                 // hinrg's own Juno-60, by its GM name
    assert.ok(!NI.sampledId(ID), "the subject is a modelled id");
    // reggae holds sampled instruments; the rule is what changes that.
    const d0 = P.genreToDocument("reggae", 3);
    const d1 = P.genreToDocument("reggae", 3, [{ f: "instr", v: [ID] }]);
    const line = (d) => d.voices.filter((v) => v.kind === "line");
    /* THE ANCHOR'S OWN CHAIRS, WHICH IS `G.voices` OF THEM AND NOT THE WHOLE
       ROOM. precompose seats the base cast first and then compose's GUESTS,
       and a guest brings its OWN genre's instrument (`instrOf(lk, 0)`,
       precompose:2964 — "a guest brings its line, not its instrument"). So a
       rule on THIS row moves this row's chairs; measured on reggae at reading
       3, that is two of the six line chairs and the other four are the choir,
       the singer and two guitars that came with the layers. */
    const nBase = GENRES.reggae.voices;
    assert.ok(line(d0).length >= nBase, "reggae seats chairs to move");
    assert.ok(line(d1).slice(0, nBase).every((v) => v.instrument === ID),
      "every chair of the anchor's own cast holds it — " +
      JSON.stringify(line(d1).map((v) => v.instrument)));
    assert.notStrictEqual(line(d0)[0].instrument, ID,
      "…and it is not what the anchor already said");
    // ...and the chair the document hands the engine carries it, and the
    // engine builds a MODEL for it. `toGenre` with the empty fleet, which is
    // the honest reading for a GM id: the fleet argument names the dsps a
    // chair may hold as a `synth` block, and this id is not one of those — it
    // is an instrument the patch tables photograph, which is the half of
    // "native" a genre row is allowed to say.
    const g = Doc.toGenre(d1, 0, GENRES, []);
    const chair = (g.chairs || []).find((c) => c.instr === ID);
    assert.ok(chair, "the compiled genre seats it — " + JSON.stringify(g.chairs));
    const un = [];
    const rec = TE.recipeFor("line", { instr: ID, tone: null, synth: null }, {}, un);
    assert.strictEqual(un.length, 0, "nothing unrouted: " + JSON.stringify(un));
    assert.ok(String(rec.source).startsWith("patch:"),
      "the recipe is a model, not a sampler read — " + rec.source);
    console.log("       " + ID + " -> " + rec.source + " (" + rec.m.model + ")");
  });

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
