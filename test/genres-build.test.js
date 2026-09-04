// test/genres-build.test.js — THE SHIPPED CATALOGUE IS WHAT THE ROWS SAY.
//
// Paul, 2026-09-02: "Are you sure we shouldn't move everything including the
// closures into sqlite and go the other direction — manage the data as data and
// then export it as JSON or even JS for operation and distribution? That feels
// like it might allow the most flexibility."
//
// So `nukernel/genres.js` is now GENERATED — 421 row files under
// `nukernel/genres/`, the shared tables in `nukernel/genres-tables.js`, and
// `tools/genres/build.js` writing the shipped script from the two. This gate is
// the thing that makes that arrangement true rather than merely intended, and
// it is the gates.js / wiki.js precedent exactly: the artifact is COMMITTED so
// the browser needs no build step, and a gate holds the committed bytes to
// being byte-for-byte what the source says. Edit the artifact and this fails.
//
// FOUR LAWS, in the order they are worth:
//
//   G1  the shipped nukernel/genres.js equals a fresh build, byte for byte.
//   G2  every row file validates the row grammar. The two throw-by-name laws
//       compose.js has always carried (`plan` and `bpm` are required, never
//       defaulted) MOVE HERE, where they are caught before a build rather than
//       at the moment somebody presses play. Plus: the label law (a row has a
//       "Place Year" label if and only if it declares `parents` — the six
//       function roles and the blank state are the rows with no history), the
//       parents law (every named parent exists, and none of them is LATER than
//       its child), and the template law (every closure kind is one the grammar
//       knows).
//   G3  the closure round trip: every template in the catalogue, emitted back
//       to source, parsed, called over v = 0..8 and s = 0..7, and compared to
//       the live closure the shipped file exports — with `word`'s returned
//       OPERATORS actually applied to a reference phrase, because a count of
//       operators would pass while the operators changed underneath it (the
//       lesson test/document.test.js's portrait() already learned).
//   G4  the tables file is still the shape the builder splices: three regions,
//       and it loads as a module on its own.
//
// Pure node: no DOM, no window, no audio, no render.
"use strict";
const fs = require("fs");
const path = require("path");
const R = path.resolve(__dirname, "..");
const { build, readRows } = require(R + "/tools/genres/build.js");
const { emit, validate, KINDS } = require(R + "/tools/genres/grammar.js");
const NG = require(R + "/nukernel/genres.js");
const T = require(R + "/nukernel/genres-tables.js");
// the one owner of what a THROAT word may be (the extraction of the engine's
// own VOICE_TYPE) — G2 holds every row's `throat` closure to it
const NF = require(R + "/nukernel/fields.js");

const GENRES = NG.GENRES;
let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

/* ========================================================================
   G1 · the shipped file is a fresh build
   ===================================================================== */
console.log("G1  nukernel/genres.js is what nukernel/genres/ says");
ok("byte for byte", () => {
  const have = fs.readFileSync(R + "/nukernel/genres.js", "utf8");
  const want = build();
  if (have === want) return;
  const a = have.split("\n"), b = want.split("\n");
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  throw new Error("first difference at line " + (i + 1) +
    "\n         shipped: " + JSON.stringify(a[i]) +
    "\n         built:   " + JSON.stringify(b[i]) +
    "\n       run: node tools/genres/build.js");
});

/* ========================================================================
   G2 · every row file validates the grammar
   ===================================================================== */
console.log("G2  the row grammar");
const rows = readRows();
const KEYS = new Set(rows.map(([k]) => k));
/* atlas.gate.js:57 owns this regex for the map's sake; it is re-stated here
   because the label law and the geography law are two different laws that
   happen to read the same string. */
const LABEL_RE = /^(.+?)\s+(?:(\d{1,5})\s+BC|(\d{3,4}))$/;
const yearOf = (label) => {
  const m = LABEL_RE.exec(label || "");
  return m ? (m[2] ? -Number(m[2]) : Number(m[3])) : null;
};

ok("the directory and the catalogue agree", () => {
  assert(rows.length === Object.keys(GENRES).length,
    rows.length + " row files, " + Object.keys(GENRES).length + " rows in GENRES");
  assert(rows.map(([k]) => k).join() === Object.keys(GENRES).join(),
    "_order.json and the shipped GENRES are in different orders");
});

ok("plan and bpm on every row (compose.js's two throw-by-name laws)", () => {
  const bad = rows.filter(([, r]) => typeof r.plan !== "string" || typeof r.bpm !== "number");
  assert(!bad.length, bad.map(([k]) => k).join(", ") + " — compose() throws by name on " +
    "a genre missing either, and DEFAULTS refuses to cover them on purpose");
});

ok("a label is a Place Year exactly when the row has parents", () => {
  const bad = [];
  for (const [k, r] of rows) {
    const dated = yearOf(r.label) !== null;
    const historied = !!r.parents;
    if (dated !== historied)
      bad.push(k + " (" + JSON.stringify(r.label) + (dated ? ", dated but no parents" :
        ", parents but no place-year label") + ")");
  }
  assert(!bad.length, bad.join("; ") + " — a role has a job, not a history, and a " +
    "record has a place and a year");
});

/* NOT LATER, WHICH IS NOT THE SAME AS EARLIER. Nine edges in this catalogue
   join two rows of the SAME year and every one of them is legal: a music and
   the music it immediately answered can share a date, because the table's year
   is the year of a named RECORD and not of a scene. The law is `py > y`, and
   it is written that way on purpose — GENRES.md §2, `parents`. */
ok("every parent exists and none is later than its child", () => {
  const bad = [];
  let ties = 0;
  for (const [k, r] of rows) {
    const y = yearOf(r.label);
    for (const p of Object.keys(r.parents || {})) {
      if (!KEYS.has(p)) { bad.push(k + " <- " + p + " (no such row)"); continue; }
      const py = yearOf((rows.find(([n]) => n === p) || [, {}])[1].label);
      if (y !== null && py !== null && py > y) bad.push(k + " (" + y + ") <- " + p + " (" + py + ")");
      if (y !== null && py !== null && py === y) ties++;
    }
  }
  assert(!bad.length, bad.join("; "));
  console.log("       " + ties + " same-year edges, all legal");
});

/* A WEIGHT IS A SHARE OF THE CHILD (GENRES.md §2, `parents`). The shares need
   NOT sum to 1 — what a row does not attribute it invented, and that residue
   is what the genealogy program measures — but they must not sum to MORE than
   1, because a row cannot be more than all of itself. 35 rows were over it on
   2026-09-03 (shoegaze 1.50, deathmetal 1.45, ambient and berlinschool 1.40)
   and every one was the same accident: a parent PAID over the years, its
   weight added, none of the old ones reduced. All 35 were rescaled with their
   ratios untouched; each records the move in its own note. */
ok("a weight is a share in (0, 1] and a row's shares sum to at most 1", () => {
  const bad = [], sums = [];
  for (const [k, r] of rows) {
    if (!r.parents) continue;
    const ws = Object.entries(r.parents);
    for (const [p, w] of ws)
      if (typeof w !== "number" || !(w > 0) || w > 1)
        bad.push(k + " <- " + p + " weighs " + JSON.stringify(w) +
                 " — a share is a number in (0, 1]");
    const s = ws.reduce((a, [, w]) => a + (+w || 0), 0);
    if (ws.length) sums.push(s);          // `parents: {}` is a declared ROOT, not a sum
    if (s > 1.0000001)
      bad.push(k + "'s " + ws.length + " shares sum to " + s.toFixed(2) +
               " — a row cannot be more than all of itself; rescale the ratios " +
               "it already asserts rather than inventing a new one");
  }
  assert(!bad.length, bad.join("; "));
  const whole = sums.filter((s) => Math.abs(s - 1) < 1e-9).length;
  const roots = rows.filter(([, r]) => r.parents && !Object.keys(r.parents).length).length;
  console.log("       " + sums.length + " rows name an ancestor; " + whole +
              " attribute all of themselves, " + (sums.length - whole) +
              " keep a residue (the invention); " + roots +
              " declare `parents: {}` and are roots");
});

ok("every closure is a template kind the grammar knows", () => {
  for (const [k, r] of rows)
    for (const f of ["entry", "reg", "realize", "word"]) {
      assert(r[f], k + " has no " + f + " — every row carries the four closures");
      validate(r[f], k + "." + f);
    }
  /* ...AND THE FIFTH, WHICH IS OPTIONAL (2026-09-04). `throat` names whose
     voice sings each chair and only fifteen rows state one, so the assertion
     it can carry is the other half: whatever a row DOES say has to be a
     template the grammar knows AND has to answer with a word the engine can
     model, over every chair the row seats. A throat this build has no formant
     table for is dropped at two doors already (precompose.seatThroat,
     document.normalize) — this is where it is caught instead of swallowed. */
  const said = [];
  for (const [k, r] of rows) {
    if (!r.throat) continue;
    said.push(k);
    validate(r.throat, k + ".throat");
    const fn = eval("(" + emit(r.throat) + ")");
    for (let v = 0; v < (r.voices || 1); v++) {
      const w = fn(v);
      assert(NF.isThroat(w), k + ".throat(" + v + ") = " + JSON.stringify(w) +
        " — not one of " + NF.THROATS().join(", "));
    }
  }
  console.log("       " + said.length + " rows name their chairs' throats: " +
              said.join(" "));
});

ok("the note is prose, not markup", () => {
  const bad = rows.filter(([, r]) => r.note !== undefined &&
    (typeof r.note !== "string" || /\*\//.test(r.note)));
  assert(!bad.length, bad.map(([k]) => k).join(", ") + " — a note is re-emitted as " +
    "a // comment block and must survive the trip");
});

/* ========================================================================
   G3 · the closure round trip
   ===================================================================== */
console.log("G3  emit(template) behaves like the closure the box loaded");
const SEED = T.DEFAULT;
/* an operator is compared by WHAT IT DOES, never by being a function */
const applied = (x) => {
  if (typeof x !== "function") return x;
  try { return x(JSON.parse(JSON.stringify(SEED))); }
  catch (e) { return "OPERR:" + e.message; }
};
const shape = (r) => JSON.stringify(Array.isArray(r) ? r.map(applied) : applied(r));

// THE ROW COUNT IN THIS TITLE IS A LITERAL AND IT GOES STALE (2026-09-03,
// shift 4): it read 421 while the catalogue was 453, because six rounds of
// new anchors landed and nobody was reading the title. It is not asserted on
// — G3's own report prints the real call count below — so it is corrected
// here rather than turned into a second copy of a number `_order.json`
// already owns.
ok("479 rows x 4 closures x v 0..8 x s 0..7", () => {
  const K = require(R + "/nukernel/kernel.js");
  const { rotate, reverse, transpose, invert, complement, excerpt, only, drop, fill, del,
          split, spread, keep } = K;
  const { MODES, SCALES, PROGS, MOUTHS, BLUES, DIATONIC, SUNG, offbeats, breath, tuned } = T;
  void [rotate, reverse, transpose, invert, complement, excerpt, only, drop, fill, del,
        split, spread, keep, MODES, SCALES, PROGS, MOUTHS, BLUES, DIATONIC, SUNG,
        offbeats, breath, tuned];
  let calls = 0, kinds = {};
  for (const [k, r] of rows)
    // `throat` rides the same round trip where a row states one — the law is
    // `emit(match(f))` must BEHAVE like f, and an optional closure is not
    // exempt from it.
    for (const f of ["entry", "reg", "realize", "word", "throat"]) {
      if (!r[f]) continue;
      kinds[r[f].kind] = (kinds[r[f].kind] || 0) + 1;
      const fn = eval("(" + emit(r[f]) + ")");     // the template, made a function again
      const live = GENRES[k][f];
      for (let v = 0; v <= 8; v++) for (let s = 0; s <= 7; s++) {
        let a, b;
        try { a = shape(fn(v, s)); } catch (e) { a = "ERR:" + e.message; }
        try { b = shape(live(v, s)); } catch (e) { b = "ERR:" + e.message; }
        calls++;
        assert(a === b, k + "." + f + "(v=" + v + ", s=" + s + ")\n         template: " +
          a + "\n         shipped:   " + b);
      }
    }
  console.log("       " + calls + " calls; kinds " + JSON.stringify(kinds));
});

/* ========================================================================
   G4 · the tables file is the shape the builder splices
   ===================================================================== */
console.log("G4  nukernel/genres-tables.js");
ok("three spliced regions, each non-empty", () => {
  const txt = fs.readFileSync(R + "/nukernel/genres-tables.js", "utf8");
  for (const name of ["DOC", "HEAD", "FOOT"]) {
    const a = txt.indexOf("/*#region " + name + "*/");
    const b = txt.indexOf("/*#endregion " + name + "*/");
    assert(a >= 0 && b > a, "no " + name + " region");
    assert(txt.slice(a, b).trim().split("\n").length > 3, name + " region is empty");
  }
});
ok("it loads as a module and carries the stamp", () => {
  assert(typeof T.stamp === "function", "no stamp()");
  assert(Array.isArray(T.MODES.ionian), "no MODES");
  assert(Array.isArray(T.SCALES.major), "no SCALES");
});
ok("the grammar's kinds are the ones the emitter writes", () => {
  for (const kind of KINDS) assert(typeof emit === "function" && kind, kind);
  const used = new Set(rows.flatMap(([, r]) =>
    ["entry", "reg", "realize", "word", "throat"]
      .filter((f) => r[f]).map((f) => r[f].kind)));
  for (const kind of used) assert(KINDS.includes(kind), "unknown kind in use: " + kind);
});

console.log("\n" + (fail ? "FAIL" : "PASS") + "  " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
