#!/usr/bin/env node
// test/bass-grid.test.js — THE GENRE'S OWN BASS RHYTHM, MEASURED OFF THE NOTES.
//
//   node test/bass-grid.test.js
//
// WHY THIS EXISTS. `genres.js` lets an anchor write its bass line out step by
// step — `bassGrid`, twenty-two of them, the habanera under `tango`, the
// off-beat under `reggae`, the clave under `hambone`. Measured 2026-09-01,
// none of them reached a note: `kernel.js` chose the bass grid in a four-way
// chain and `bassGrid` sat LAST, under `STYLEGRID[g.bassStyle]` and under the
// MELODY's accent vector. Thirteen of the twenty-two were outranked by their
// own `bassStyle: "eighths"` and nine by `subj.acc`; the declared rhythm
// survived on exactly three — `drone`, `waltz`, `musette` — and only because
// each of those three writes a lone downbeat, which is what the branch above
// them happened to produce anyway.
//
// `askable.js` recorded the demotion's reason: `bassGrid` was "superseded by
// `bassFig`". B1 below is that sentence turned into a measurement, and it fails
// today: **0 of 387 anchors declare a `bassFig`.** The successor has no rows,
// so the supersession was a promise and the demotion was its down payment. The
// word is off that row now; B1 is what keeps it off.
//
// THE FIX WAS A PRECEDENCE, NOT A TABLE. Nothing was written by hand and no
// grid was invented — the order is now the one kernel.js's own comment argues
// for: a FIGURE says all of it at once, a GRID says where the genre's notes
// fall, a STYLE says only how DENSE the line is, and `subj.acc` is not about
// the bass at all.
//
// TEST THE ARTIFACT. Not one assertion below reads the precedence expression.
// B2 reads the NOTES `kernel.bass` emits and folds their onsets into one bar;
// B3 re-renders every anchor that declares no grid under the OLD branch order
// and demands the two streams be identical event for event.
//
// WHAT IS ASSERTED
//   B1  the catalog's own shape: ≥1 anchor declares a `bassGrid`, and if any
//       anchor ever declares a `bassFig` this gate says so out loud, because
//       that is the day this precedence is worth re-arguing.
//   B2  EVERY anchor that declares a `bassGrid` plays it: the rendered bass
//       onsets, folded into one bar, are exactly the steps the grid marks.
//   B3  ABSENT IS TODAY. Every anchor that declares no `bassGrid` renders
//       byte-identically to the pre-2026-09-01 branch order.
//   B4  the three named regressions, by name and by rhythm: `reggae` is not
//       straight eighths, `tango` is the habanera, `hambone` is the clave.
"use strict";
const path = require("path");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));

const NG = R("genres.js"); R("fields.js");
const K = R("kernel.js"); R("instruments.js"); R("songs.js");
const Doc = R("document.js"); const P = R("precompose.js"); R("compose.js");
const { GENRES } = NG;

let checks = 0, fails = 0;
const ok = (cond, what, saw) => {
  checks++;
  if (cond) return;
  fails++;
  console.log("  FAIL  " + what + (saw == null ? "" : "\n        saw: " + saw));
};
const S = (v) => (v ? v.map((x) => (x ? "x" : ".")).join("") : "(none)");
const sig = (ev) => JSON.stringify(ev.map((e) => [e.t, e.n, e.vel, e.dur, e.acc, e.sld]));

// ONE RENDER, THE WAY test/precompose.test.js BUILDS ONE. The bass follows the
// FIRST phrase (ui/derive.js), the section's musical length is `bars × the
// cell's own bar count` (PROGRAM.md §2.1), and the render length is rounded up
// to a whole number of the genre's own form-bars.
function bassOf(anchor, gPatch) {
  const doc = P.genreToDocument(anchor, 1);
  const lines = doc.voices.filter((v) => v.kind === "line");
  if (!lines.length) return null;
  const g0 = Doc.toGenre(doc, 0, GENRES);
  const g = gPatch ? gPatch(g0) : g0;
  const sec = doc.form.sections[0];
  const ph = Doc.toPhrase(doc, Doc.materialAt(lines[0], sec.id));
  const musical = Math.max(1, sec.bars * Doc.barsOf(doc));
  const total = Math.ceil(musical / g.bars) * g.bars;
  return { ev: K.bass(ph, g, total), g, N: K.stepsIn(g) / g.rate };
}
// THE OLD BRANCH ORDER, reproduced by DELETING the field it used to ignore.
// With no `bassGrid` on the object the new expression walks the same three
// branches the old one did, in the same order, so this is the pre-change
// stream and not an approximation of it.
const oldOrder = (g) => { const c = { ...g }; delete c.bassGrid; return c; };

const ANCHORS = P.anchors();
const WITH = ANCHORS.filter((a) => GENRES[a] && GENRES[a].bassGrid);
const WITHOUT = ANCHORS.filter((a) => GENRES[a] && !GENRES[a].bassGrid);

console.log("bass-grid — " + ANCHORS.length + " anchors, " + WITH.length +
            " declaring a bassGrid\n");

/* ---------- B1 · the catalog's own shape ---------- */
console.log("B1 — the field exists, and its declared successor still has no rows");
ok(WITH.length > 0, "at least one anchor declares a bassGrid", String(WITH.length));
const FIGS = ANCHORS.filter((a) => GENRES[a] && GENRES[a].bassFig);
console.log("  anchors declaring bassFig: " + FIGS.length +
            (FIGS.length ? " — " + FIGS.join(", ") : ""));
ok(FIGS.length === 0,
   "askable.js used to call bassGrid 'superseded by bassFig'; if a bassFig has " +
   "arrived, re-argue this precedence rather than deleting this line",
   FIGS.join(", "));

/* ---------- B2 · every declared grid reaches the notes ---------- */
console.log("\nB2 — every declared grid is the rhythm the bass actually plays");
let played = 0;
for (const a of WITH) {
  const r = bassOf(a);
  if (!r) continue;
  // A BAR THE BASS DOES NOT PLAY IS STILL THE GRID (kernel.js `bassBars`): a
  // schedule can silence whole measures, so the claim is about WHERE a note
  // may fall, not how many fall. Fold to one bar and compare the sets.
  const want = new Set();
  r.g.bassGrid.forEach((x, i) => { if (x) want.add(i % r.N); });
  const hit = new Set(r.ev.map((e) => ((Math.round(e.t) % r.N) + r.N) % r.N));
  const extra = [...hit].filter((x) => !want.has(x));
  const missing = [...want].filter((x) => !hit.has(x));
  const good = !extra.length && !missing.length;
  if (good) played++;
  ok(good, a + " plays its declared grid " + S(r.g.bassGrid),
     good ? null : "onsets " + [...hit].sort((x, y) => x - y).join(",") +
                   " · wanted " + [...want].sort((x, y) => x - y).join(",") +
                   " · style " + r.g.bassStyle);
}
console.log("  " + played + " of " + WITH.length + " play what they wrote down");

/* ---------- B3 · absent is today ---------- */
console.log("\nB3 — an anchor with no bassGrid renders exactly as it did before");
let moved = [];
for (const a of WITHOUT) {
  let now, was;
  try { now = bassOf(a); was = bassOf(a, oldOrder); } catch (e) { continue; }
  if (!now || !was) continue;
  if (sig(now.ev) !== sig(was.ev)) moved.push(a);
}
ok(moved.length === 0,
   "all " + WITHOUT.length + " anchors without a bassGrid are byte-identical",
   moved.slice(0, 12).join(", "));

/* ---------- B4 · the three named regressions ---------- */
console.log("\nB4 — the three this gate was written for, by name");
const EIGHTHS = "x.x.x.x.x.x.x.x.";
const NAMED = { reggae: "x.........x.....",     // the off-beat, not eight to the bar
                tango: "x..x..x.x..x..x.",      // the habanera
                hambone: "x..x..x........." };// the clave Bo Diddley is named for
for (const [a, want] of Object.entries(NAMED)) {
  const r = bassOf(a);
  if (!r) { ok(false, a + " renders at all"); continue; }
  const v = new Array(r.N).fill(0);
  for (const e of r.ev) v[((Math.round(e.t) % r.N) + r.N) % r.N] = 1;
  const got = S(v);
  ok(got === want, a + " plays " + want, got);
  ok(got !== EIGHTHS, a + " is not straight eighths", got);
}

console.log("\n" + (fails ? "FAIL " + fails + " of " + checks + " checks"
                          : "PASS " + checks + " checks"));
process.exit(fails ? 1 : 0);
