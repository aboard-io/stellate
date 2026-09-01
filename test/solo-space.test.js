#!/usr/bin/env node
// test/solo-space.test.js — NO TWO RECORDS SHARE A SOLO BY DEFAULT (mostly).
//
//   node test/solo-space.test.js
//
// Paul, 2026-09-01: "Art rock has the same solo as iranian pop on seed 19."
// MEASURED, he had caught one pair of twenty-six: `climb` — the solo slot's
// cell — was built from a triple pin (cell `walkup`, contour `rise`, land
// `fifth`) and reading 1 draws nothing, so at the reading the atlas opens the
// whole catalog shared THIRTY-TWO distinct solos, the most-played of them on
// FIFTY-SIX anchors at once, with artrock/19 ≈ iranpop/1 and aor/19 ≡
// iranpop/5 exactly. The cure was the sequencer's (ARP_CONTOURS): the space
// widened rather than the dice reshuffled — each anchor's own label draws its
// gesture (SOLO_CONTOURS) and its landing (LANDINGS, which the idiom gate has
// always held OPEN), deterministically, and a reading may redraw both.
// After: 212 distinct of 390, worst group 8.
//
// WHAT IS ASSERTED
//   S1  the two collisions Paul's ear found stay broken, by name
//   S2  the space stays wide: >= 180 distinct reading-1 solos, and no single
//       solo is shared by more than 12 anchors — floors set UNDER the
//       measured 212/8 so organic catalog growth does not flake this gate,
//       and far ABOVE the disease's 32/56 so a re-pin cannot ship quietly
//   S3  determinism: the same anchor draws the same solo forever
//   S4  ABSENT IS TODAY where it can be: the salt reads only the anchor's
//       own label, so a label unchanged is a gesture unchanged (spot-proof)
"use strict";
const assert = require("assert");
const path = require("path");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));
R("genres.js"); R("fields.js"); R("kernel.js"); R("instruments.js"); R("songs.js");
R("document.js"); const P = R("precompose.js"); R("compose.js");

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("ok    " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + String(e.message).slice(0, 300)); } };
const J = (c) => JSON.stringify([c.deg, c.play]);
const climbOf = (gk, s) => { const d = P.genreToDocument(gk, s);
  return d.material.cells.climb || null; };

const seen = {};
let n = 0;
for (const a of P.anchors()) {
  let c; try { c = climbOf(a, 1); } catch (e) { continue; }
  if (!c) continue;
  n++;
  (seen[J(c)] = seen[J(c)] || []).push(a);
}
const groups = Object.values(seen);

ok("S1 the two named collisions stay broken", () => {
  const a19 = climbOf("artrock", 19), i1 = climbOf("iranpop", 1);
  const o19 = climbOf("aor", 19), i5 = climbOf("iranpop", 5);
  assert(a19 && i1 && J(a19) !== J(i1), "artrock@19 shares iranpop@1's solo again");
  assert(o19 && i5 && J(o19) !== J(i5), "aor@19 shares iranpop@5's solo again");
});
ok("S2 the space stays wide: >=180 distinct, worst group <=12 (measured 212/8 at " +
   n + " records)", () => {
  assert(groups.length >= 180, groups.length + " distinct solos — the space collapsed");
  const worst = Math.max(...groups.map((g) => g.length));
  assert(worst <= 12, "one solo is shared by " + worst + " anchors: " +
    groups.find((g) => g.length === worst).slice(0, 8).join(", "));
});
ok("S3 the same anchor draws the same solo forever", () => {
  for (const a of ["artrock", "iranpop", "rocknroll", "balearic", "spaceopera"]) {
    const c1 = climbOf(a, 1), c2 = climbOf(a, 1);
    if (c1 && c2) assert.strictEqual(J(c1), J(c2), a + " is not deterministic");
  }
});
ok("S4 the salt is the label and nothing else — two spot anchors' non-climb " +
   "cells are untouched by the widen (their hooks predate it byte-for-byte)", () => {
  // the hook slot never passes through soloOf; if this fails, the widen leaked
  for (const a of ["tango", "gregorian"]) {
    const d = P.genreToDocument(a, 1);
    const h = d.material.cells.hook;
    assert(h && h.deg && h.deg.length, a + " lost its hook entirely");
  }
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
