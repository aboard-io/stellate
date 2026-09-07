#!/usr/bin/env node
/* test/fxamt.test.js — A ROW STATES HOW MUCH OF ITS OWN EFFECT, AND IT REACHES
 * THE SOUND (2026-09-07, the auto-wah round).
 *
 * WHY THIS FILE EXISTS. Paul, on the real app: *"I don't know what you did to
 * Bleak prog but it's overall really hot and distorted. Too much auto-wah
 * maybe?"* Measured on the rendered artifact — `bleakprog` seed 1, 24 bars,
 * pressed through the real engine — the auto-wah alone was worth +4.28 dB of
 * RMS and MINUS 4.79 dB of crest factor, on a record whose own note calls it
 * "the sparsest of the eighteen new rows". It was the SECOND complaint about
 * the same shared number (`funkrock`, 2026-09-03) and the third about a shared
 * effect default (`minneapolissound`'s flanger, 2026-09-06), because
 * `fields.js FX` holds ONE set of parameters per chip and five different
 * musics were being served by it.
 *
 * SO THE ROW SAYS. `fxAmt` on a genre row, keyed by chip, in the desk's own
 * enum words — `fxAmt: { wah: "half" }`, or `{ wah: { wet: "half", a: "low" } }`
 * for the module's face params. `precompose.js fxAmtOnto` writes it onto the
 * chair's desk entry as `fxw<n>`/`fxa<n>`/`fxb<n>`, which is the slot dialect
 * `fields.js fxChainFor` has resolved since 2026-08-27 — so the value rides
 * the wire the board's own knobs ride and no second door was cut.
 *
 *   F1  ABSENT IS TODAY, OVER THE WHOLE CATALOGUE. Every anchor at seeds 1-3
 *       composed twice — once as shipped, once with `fxAmt` deleted from the
 *       catalogue row — and the two are byte-identical for every row that does
 *       not declare one. This is `dynfigure.test.js` §C2's shape: the claim
 *       that a new optional field changes nothing where it is not stated is
 *       MEASURED over all 502 rows, not asserted. The rows that DO declare one
 *       must differ, and only those.
 *   F2  THE AMOUNT REACHES THE ENGINE'S OWN RECIPE, through the real chain and
 *       not a re-implementation of it: `genreToDocument` -> `desk-doc.js
 *       deskPartsOf` (the walk ui/eight.js puts on every box as `parts`) ->
 *       `fields.js fxChainFor` (what audio/desk.js `partsOf` calls) -> the
 *       `{type, module, params}` insert the renderer builds. The chip's `mix`
 *       must equal `FXWETS[word]`, and a face word must land on the param
 *       `FXFACE` names, at that param's own span.
 *   F3  THE VOCABULARY IS CHECKED AND AN UNKNOWN WORD IS DROPPED — the
 *       paranoid half every enum in this tree gets. A wet no table holds, a
 *       wet on a chip whose module declares no `mix` slider (`sweep`), a face
 *       word on a chip that has no such face param, and an amount for a chip
 *       the row does not name: each writes nothing rather than reaching the
 *       DSP as a number it does not read.
 *   F4  WHAT THE CATALOGUE DECLARES IS PLAYABLE AND ARRIVES. Every `fxAmt` a
 *       row states names a chip that row's `fx` actually names, in words the
 *       tables hold — and, the "declared but never arriving" counter-gate,
 *       every one of them is MEASURED to move that record's compiled document.
 *       A number that costs nothing is this box's characteristic bug.
 *   F5  THE FIVE AUTO-WAH ROWS ARE THE ROWS THAT MOVED, and every other row in
 *       the catalogue composes to the bytes it composed before the field
 *       existed.
 *
 * RUN:  node test/fxamt.test.js
 */
"use strict";
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));
const NG = R("genres.js"), P = R("precompose.js"), Doc = R("document.js");
const NF = R("fields.js"), DD = R("desk-doc.js");
const { GENRES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};
const ANCHORS = P.anchors();
const SEEDS = [1, 2, 3];
const fp = (k, s) => crypto.createHash("sha1")
  .update(JSON.stringify(Doc.normalize(P.genreToDocument(k, s))))
  .digest("hex").slice(0, 16);

/* compose a row as if it declared exactly this `fxAmt` (or none). The
   catalogue object is what `precompose` reads, so the swap is on the row
   itself and it is put back afterwards — dynfigure.test.js `asIf`'s idiom, and
   for its reason: no second door into the compiler. */
function asIf(k, amt, fn) {
  const g = GENRES[k];
  const had = Object.prototype.hasOwnProperty.call(g, "fxAmt"), was = g.fxAmt;
  if (amt === undefined) delete g.fxAmt; else g.fxAmt = amt;
  try { return fn(); }
  finally { if (had) g.fxAmt = was; else delete g.fxAmt; }
}
const SAYS = ANCHORS.filter((k) => GENRES[k] && GENRES[k].fxAmt != null);

/* ---------------------------------------------------------------- F1 ----- */
ok("F1 absent is byte-identical — every row that states no fxAmt composes " +
   "to the bytes it composed before the field existed (" + ANCHORS.length +
   " rows x " + SEEDS.length + " seeds)", () => {
  const moved = [];
  for (const k of ANCHORS) {
    if (GENRES[k] && GENRES[k].fxAmt != null) continue;   // F5 owns these
    for (const s of SEEDS) {
      const now = fp(k, s);
      const bare = asIf(k, undefined, () => fp(k, s));
      if (now !== bare) moved.push(k + "/" + s);
    }
  }
  assert.deepStrictEqual(moved.slice(0, 8), [],
    moved.length + " documents moved with nothing declared");
});

/* ---------------------------------------------------------------- F5 ----- */
ok("F5 ...and the rows that DO state one are exactly the rows that move", () => {
  const still = [];
  for (const k of SAYS) {
    const same = SEEDS.every((s) => fp(k, s) === asIf(k, undefined, () => fp(k, s)));
    if (same) still.push(k);
  }
  assert.deepStrictEqual(still, [],
    "rows declare an fxAmt that costs the document nothing: " + still.join(" "));
  assert.ok(SAYS.length > 0, "no row declares fxAmt — the field is dead");
  console.log("      " + SAYS.length + " rows state an amount: " + SAYS.join(" "));
});

/* ---------------------------------------------------------------- F2 ----- */
// the chain the ENGINE is handed, resolved through the real walk: the chair
// entries ui/eight.js puts on the box, then audio/desk.js's own resolver.
function chainsOf(gk, seed) {
  const doc = Doc.normalize(P.genreToDocument(gk, seed || 1));
  const parts = DD.deskPartsOf(doc, GENRES) || {};
  const out = {};
  for (const [chair, ent] of Object.entries(parts)) out[chair] = NF.fxChainFor(ent);
  return out;
}
const chipIn = (chains, type) => {
  for (const c of Object.values(chains))
    for (const ins of c) if (ins.type === type) return ins;
  return null;
};

ok("F2a a declared wet reaches the insert recipe as the module's own mix", () => {
  const bad = [];
  for (const w of Object.keys(NF.FXWETS)) {
    const ins = asIf("bleakprog", { wah: w }, () => chipIn(chainsOf("bleakprog"), "wah"));
    if (!ins) { bad.push(w + ": no wah insert at all"); continue; }
    if (ins.module !== "insert_wah") bad.push(w + ": module " + ins.module);
    if (ins.params.mix !== NF.FXWETS[w])
      bad.push(w + ": mix " + ins.params.mix + " want " + NF.FXWETS[w]);
  }
  assert.deepStrictEqual(bad, [], bad.join("; "));
});

ok("F2b ...and the object form's face words land on the params FXFACE names, " +
   "each across that param's own declared span", () => {
  const face = NF.FXFACE.wah;                       // [ sens 0..1, base 80..1200 ]
  const bad = [];
  for (const [word, frac] of Object.entries(NF.FXPOTS)) {
    const ins = asIf("bleakprog", { wah: { a: word, b: word } },
      () => chipIn(chainsOf("bleakprog"), "wah"));
    if (!ins) { bad.push(word + ": no insert"); continue; }
    const wantA = +(face[0].min + frac * (face[0].max - face[0].min)).toFixed(4);
    const wantB = +(face[1].min + frac * (face[1].max - face[1].min)).toFixed(4);
    if (ins.params[face[0].key] !== wantA)
      bad.push(word + " a: " + ins.params[face[0].key] + " want " + wantA);
    if (ins.params[face[1].key] !== wantB)
      bad.push(word + " b: " + ins.params[face[1].key] + " want " + wantB);
  }
  assert.deepStrictEqual(bad, [], bad.join("; "));
});

ok("F2c the bare-string form is the wet and nothing else", () => {
  const a = asIf("bleakprog", { wah: "half" }, () => chipIn(chainsOf("bleakprog"), "wah"));
  const b = asIf("bleakprog", { wah: { wet: "half" } }, () => chipIn(chainsOf("bleakprog"), "wah"));
  assert.deepStrictEqual(a, b, "a word and { wet: word } must resolve the same");
  assert.strictEqual(a.params.mix, NF.FXWETS.half);
  // every other param is still the table's
  for (const [k, v] of Object.entries(NF.FX.wah.params))
    if (k !== "mix") assert.strictEqual(a.params[k], v, k + " moved");
});

/* ---------------------------------------------------------------- F3 ----- */
ok("F3a an amount no table holds is dropped, not passed to the DSP", () => {
  const base = asIf("bleakprog", undefined, () => chipIn(chainsOf("bleakprog"), "wah"));
  for (const junk of [{ wah: "soaked" }, { wah: 0.5 }, { wah: { wet: "loud" } },
                      { wah: { a: "gigantic", b: null } }, { wah: [] }, { wah: true }]) {
    const got = asIf("bleakprog", junk, () => chipIn(chainsOf("bleakprog"), "wah"));
    assert.deepStrictEqual(got, base, "junk reached the insert: " + JSON.stringify(junk));
  }
  for (const junk of [[], "half", 7]) {
    const got = asIf("bleakprog", junk, () => chipIn(chainsOf("bleakprog"), "wah"));
    assert.deepStrictEqual(got, base, "an fxAmt of the wrong shape was read: " + JSON.stringify(junk));
  }
});

ok("F3b an amount for a chip the row does not name reaches nothing", () => {
  const base = asIf("bleakprog", undefined, () => chainsOf("bleakprog"));
  const got = asIf("bleakprog", { chorus: "full", flanger: "full", tremolo: "dry" },
    () => chainsOf("bleakprog"));
  assert.deepStrictEqual(got, base, "a chip the row never named was given a knob");
});

ok("F3c ...and `echo` is a send, so its slot number is not its position in `fx`", () => {
  // bleakprog declares fx: ["echo","wah"]; soundFxOf drops echo, so the wah is
  // slot 1. Keying by chip is what makes that invisible to the row author.
  assert.deepStrictEqual(GENRES.bleakprog.fx, ["echo", "wah"], "the row moved");
  const doc = asIf("bleakprog", { wah: "half" },
    () => Doc.normalize(P.genreToDocument("bleakprog", 1)));
  const ents = Object.values(DD.deskPartsOf(doc, GENRES) || {}).filter((e) => e.fx);
  assert.ok(ents.length, "no chair carries the chip");
  for (const e of ents) {
    assert.strictEqual(e.fx.indexOf("wah"), 0, "the wah is not slot 1: " + JSON.stringify(e.fx));
    assert.strictEqual(e.fxw1, "half", "the wet was written to the wrong slot");
    assert.ok(e.fxw2 == null && e.fxw3 == null, "a slot nobody asked for was written");
  }
});

ok("F3d a wet on a chip whose module declares no mix slider is refused", () => {
  // `sweep` is the one: a swept resonant lowpass is a REPLACEMENT, not a blend,
  // and fields.js already refuses the knob on the board for the same reason.
  assert.strictEqual(NF.fxHasMix("sweep"), false, "sweep grew a mix");
  const row = ANCHORS.find((k) => (GENRES[k].fx || []).indexOf("sweep") >= 0);
  assert.ok(row, "no row names sweep");
  const base = asIf(row, undefined, () => chainsOf(row));
  const got = asIf(row, { sweep: "dry" }, () => chainsOf(row));
  assert.deepStrictEqual(got, base, "a wet was written onto a chip with no mix");
});

/* ---------------------------------------------------------------- F4 ----- */
ok("F4 every fxAmt the catalogue states is playable: a chip the row names, " +
   "in words the tables hold", () => {
  const bad = [];
  for (const k of SAYS) {
    const g = GENRES[k], amt = g.fxAmt, fx = g.fx || [];
    if (typeof amt !== "object" || Array.isArray(amt)) { bad.push(k + ": fxAmt is not a map"); continue; }
    for (const [chip, v] of Object.entries(amt)) {
      if (fx.indexOf(chip) < 0) { bad.push(k + ": states " + chip + " but its fx is [" + fx + "]"); continue; }
      if (!Object.prototype.hasOwnProperty.call(NF.FX, chip)) { bad.push(k + ": " + chip + " is not a chip"); continue; }
      const spec = typeof v === "string" ? { wet: v } : v;
      if (!spec || typeof spec !== "object" || Array.isArray(spec)) { bad.push(k + "." + chip + ": bad shape"); continue; }
      for (const [sk, sv] of Object.entries(spec)) {
        if (sk === "wet") {
          if (!Object.prototype.hasOwnProperty.call(NF.FXWETS, String(sv)))
            bad.push(k + "." + chip + ": wet `" + sv + "` is not an FXWETS word");
          else if (!NF.fxHasMix(chip))
            bad.push(k + "." + chip + ": a wet on a chip with no mix slider");
        } else if (sk === "a" || sk === "b") {
          const face = (NF.FXFACE[chip] || [])[sk === "a" ? 0 : 1];
          if (!face) bad.push(k + "." + chip + ": " + chip + " has no `" + sk + "` face param");
          else if (!Object.prototype.hasOwnProperty.call(NF.FXPOTS, String(sv)))
            bad.push(k + "." + chip + "." + sk + ": `" + sv + "` is not an FXPOTS word");
        } else bad.push(k + "." + chip + ": unknown key `" + sk + "`");
      }
    }
  }
  assert.deepStrictEqual(bad, [], bad.join("\n      "));
});

ok("F4b ...and it ARRIVES: every declared amount is measured on the chain the " +
   "engine is handed, not merely written down", () => {
  const bad = [];
  for (const k of SAYS) {
    const bare = asIf(k, undefined, () => chainsOf(k));
    const now = chainsOf(k);
    if (JSON.stringify(now) === JSON.stringify(bare)) { bad.push(k + ": the insert chain did not move"); continue; }
    for (const [chip, v] of Object.entries(GENRES[k].fxAmt)) {
      const spec = typeof v === "string" ? { wet: v } : v;
      const ins = chipIn(now, NF.FX[chip].type || chip);
      if (!ins) { bad.push(k + ": no " + chip + " insert reaches the engine"); continue; }
      if (spec.wet != null && ins.params.mix !== NF.FXWETS[spec.wet])
        bad.push(k + "." + chip + ": mix " + ins.params.mix + " want " + NF.FXWETS[spec.wet]);
      for (const [sk, j] of [["a", 0], ["b", 1]]) {
        if (spec[sk] == null) continue;
        const f = NF.FXFACE[chip][j];
        const want = +(f.min + NF.FXPOTS[spec[sk]] * (f.max - f.min)).toFixed(4);
        if (ins.params[f.key] !== want)
          bad.push(k + "." + chip + "." + f.key + ": " + ins.params[f.key] + " want " + want);
      }
    }
  }
  assert.deepStrictEqual(bad, [], bad.join("\n      "));
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
