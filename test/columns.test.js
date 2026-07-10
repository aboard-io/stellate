#!/usr/bin/env node
// columns.test.js — COLUMNAR EVENTS gates (vector-kernel STEP 1, docs/NEXT.md
// §5b; engine/columns.js + the two converted passes in csd-engine.js).
//   node test/columns.test.js            all gates (full catalog A/B, ~1 min)
//   node test/columns.test.js --hashes   (internal) print buildEvents hashes
//                                        for all genres x seeds 1,7 as JSON
//
// Gates, in order:
//   1  round-trip        fromColumns(toColumns(rows)) on ADVERSARIAL rows —
//                        missing fields, extra fields, bend objects, solo
//                        flags, null/undefined/NaN/±0, non-numeric field
//                        values, empty rows — JSON byte-identical, key
//                        insertion order preserved, present-with-undefined
//                        vs absent distinguished
//   2  compute round-trip a column transform lands in fromColumns output;
//                        untouched rows/keys stay byte-identical
//   3  helpers           map/scale/shift respect masks + array operands;
//                        where/and build correct masks; ops are in-place
//   4  writeBack         mask-gated (a row that never had the field never
//                        grows it); view mode works for writeBack and
//                        fromColumns refuses it; reserved field names refused
//   5  catalog A/B       THE BYTE-IDENTITY GATE: buildEvents through the
//                        COLUMNAR passes (this process) vs the SCALAR twins
//                        (child process, CSD_SCALAR_PASSES=1) — sha256 of
//                        JSON.stringify(buildEvents(K.track(g,{seed}))) for
//                        ALL kernel genres x seeds {1,7} must be equal.
//                        This is the permanent A/B: both implementations live
//                        in csd-engine.js, so the proof reruns forever (no
//                        stale committed baseline to drift).
//   6  determinism       the columnar path builds twice byte-equal
"use strict";
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const C = require("../engine/columns.js");
const E = require("../engine/csd-engine.js");
const K = require("../engine/genre-kernel.js");

const SEEDS = [1, 7];
const sha = (o) => crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex");

function catalogHashes() {
  const out = {};
  for (const g of Object.keys(K.GENRES))
    for (const seed of SEEDS)
      out[`${g}/s${seed}`] = sha(E.buildEvents(K.track(g, { seed })));
  return out;
}

// internal mode: emit hashes (the child runs this with CSD_SCALAR_PASSES=1)
if (process.argv.includes("--hashes")) {
  process.stdout.write(JSON.stringify(catalogHashes()));
  process.exit(0);
}

let fails = 0;
function gate(name, fn) {
  try { fn(); console.log("PASS  " + name); }
  catch (e) { fails++; console.log("FAIL  " + name + " — " + e.message); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

// the adversarial fabric: every shape the engine's event lists can carry
const adversarial = () => [
  { beat: 0, dur: 0.5, amp: 0.3, voice: "melody", pch: "8.04" },            // the plain pitched row
  { drum: "snare", beat: 1.5, amp: 0.8, pp: 0.6, open: true },              // drum row, missing dur
  { beat: 2, dur: 1, amp: undefined, bend: { depth: 0.3, rate: 2 }, solo: true }, // present-with-undefined + nested object
  { beat: 3.25 },                                                            // nothing but beat
  { amp: 0.5, beat: 4, dur: 0.25, extra: [1, 2, 3], nested: { a: { b: 1 } } }, // amp-first key order + arrays
  { beat: 5, dur: "long", amp: null },                                       // non-numeric field value, null amp
  { beat: 6, amp: 0, dur: 0, accent: 0.923, slide: 1 },                      // zeros are still numeric columns
  { beat: 7, amp: -0, dur: NaN, echo: 1, harm: undefined },                  // ±0 / NaN stay columns
  {},                                                                         // the empty row
];

gate("round-trip: adversarial rows JSON-identical, key order + absent-vs-undefined preserved", () => {
  const rows = adversarial();
  const want = JSON.stringify(rows);
  const cols = C.toColumns(rows, ["beat", "dur", "amp"]);
  const back = C.fromColumns(cols);
  assert(JSON.stringify(back) === want, "JSON drift after round-trip");
  for (let i = 0; i < rows.length; i++)
    assert(JSON.stringify(Object.keys(back[i])) === JSON.stringify(Object.keys(rows[i])),
      "key-order drift on row " + i);
  assert("amp" in back[2] && back[2].amp === undefined, "row 2 lost its present-with-undefined amp");
  assert(!("dur" in back[3]) && !("amp" in back[3]), "row 3 grew fields it never had");
  assert(back[5].dur === "long" && back[5].amp === null, "non-numeric field values not preserved");
  assert(Object.is(back[7].amp, -0) && Number.isNaN(back[7].dur), "±0/NaN not preserved through columns");
  assert(back[2].bend === rows[2].bend, "nested objects should ride by reference");
  assert(JSON.stringify(rows) === want, "toColumns mutated its input");
});

gate("compute round-trip: a transformed column lands in fromColumns; the rest is untouched", () => {
  const rows = adversarial();
  const cols = C.toColumns(rows, ["beat", "amp"]);
  C.shift(cols.beat, 10, cols.mask.beat);
  C.scale(cols.amp, 0.5, cols.mask.amp);
  const back = C.fromColumns(cols);
  assert(back[0].beat === 10 && back[0].amp === 0.15, "transform did not land");
  assert(back[3].beat === 13.25 && !("amp" in back[3]), "mask leak on row 3");
  assert(back[5].dur === "long" && back[5].amp === null, "rest fields drifted");
  assert("amp" in back[2] && back[2].amp === undefined, "undefined amp drifted (mask 0 must not compute)");
});

gate("helpers: map/scale/shift masked + array operands, where/and, in-place", () => {
  const col = Float64Array.from([1, 2, 3, 4]);
  const m = Uint8Array.from([1, 0, 1, 0]);
  const r = C.shift(col, 10, m);
  assert(r === col, "shift must be in-place");
  assert(String(col) === "11,2,13,4", "masked scalar shift wrong: " + col);
  C.shift(col, Float64Array.from([1, 1, 1, 1]));
  assert(String(col) === "12,3,14,5", "unmasked array shift wrong: " + col);
  C.scale(col, Float64Array.from([2, 2, 2, 2]), m);
  assert(String(col) === "24,3,28,5", "masked array scale wrong: " + col);
  C.map(col, (v, i) => v + i, m);
  assert(String(col) === "24,3,30,5", "masked map wrong: " + col);
  const w = C.where(col, (v) => v > 10);
  assert(String(w) === "1,0,1,0", "where wrong: " + w);
  assert(String(C.and(w, Uint8Array.from([1, 1, 0, 0]))) === "1,0,0,0", "and wrong");
});

gate("writeBack: mask-gated into the ORIGINAL objects; view mode; reserved names refused", () => {
  const rows = [{ beat: 1, amp: 0.5, voice: "pad" }, { beat: 2 }, { beat: 3, amp: null }];
  const keep = rows.map((r) => JSON.stringify(Object.keys(r)));
  const cols = C.toColumns(rows, ["beat", "amp"], { view: true });
  assert(cols.keys === null && cols.rest === null, "view mode must skip keys/rest");
  C.scale(cols.amp, 2, cols.mask.amp);
  C.shift(cols.beat, 1);
  C.writeBack(cols, rows);
  assert(rows[0].beat === 2 && rows[0].amp === 1 && rows[0].voice === "pad", "writeBack values wrong");
  assert(rows[1].beat === 3 && !("amp" in rows[1]), "writeBack invented amp on row 1");
  assert(rows[2].amp === null, "writeBack clobbered a null amp (mask 0)");
  for (let i = 0; i < rows.length; i++)
    assert(JSON.stringify(Object.keys(rows[i])) === keep[i], "writeBack changed key order on row " + i);
  let threw = false;
  try { C.fromColumns(cols); } catch (e) { threw = true; }
  assert(threw, "fromColumns must refuse a {view:true} compute view");
  threw = false;
  try { C.toColumns(rows, ["rest"]); } catch (e) { threw = true; }
  assert(threw, "reserved field name must be refused");
});

gate("catalog A/B: columnar vs scalar buildEvents byte-identical over ALL genres x seeds " + SEEDS.join(","), () => {
  assert(process.env.CSD_SCALAR_PASSES !== "1", "parent must run the columnar path");
  const columnar = catalogHashes();
  const out = execFileSync(process.execPath, [__filename, "--hashes"], {
    env: Object.assign({}, process.env, { CSD_SCALAR_PASSES: "1" }),
    maxBuffer: 64 * 1024 * 1024,
  });
  const scalar = JSON.parse(String(out));
  const keys = Object.keys(columnar);
  assert(keys.length === Object.keys(scalar).length && keys.length >= 456,
    "coverage lost: " + keys.length + " vs " + Object.keys(scalar).length);
  const drift = keys.filter((k) => columnar[k] !== scalar[k]);
  assert(drift.length === 0, drift.length + " drifted, first: " + drift.slice(0, 5).join(", "));
  console.log("      " + keys.length + " buildEvents hashes byte-equal (columnar == scalar)");
});

gate("determinism: the columnar path builds twice byte-equal", () => {
  for (const g of ["jungle", "vaporwave", "mallsoft"]) {
    const a = sha(E.buildEvents(K.track(g, { seed: 7 })));
    const b = sha(E.buildEvents(K.track(g, { seed: 7 })));
    assert(a === b, g + " drifted between two builds");
  }
});

console.log(fails ? `\ncolumns.test: ${fails} FAILED` : "\ncolumns.test: all gates green");
process.exit(fails ? 1 : 0);
