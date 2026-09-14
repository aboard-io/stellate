// test/motifedit.test.js — the arithmetic under the motif editor (2026-09-14).
// Run: node test/motifedit.test.js
import assert from "node:assert/strict";
import { spanAt, noteList, nudgePitch, lengthen, shorten, toRest, writeNote,
         likeAt, setMark, markOf, DEG_MAX } from "../nukernel/ui/motifedit.js";

const cell = (play, deg, extra = {}) =>
  ({ kind: "line", play: play.split(""), deg, ...extra });

let ok = 0;
const check = (name, fn) => { fn(); ok++; console.log("ok  " + name); };

check("a note's span runs over its holds and stops at a rest or a note", () => {
  const H = cell("nhhrnhnr", [2, 0, 0, 0, 4, 0, 1, 0]);
  assert.deepEqual(spanAt(H, 0), { at: 0, len: 3 });
  assert.deepEqual(spanAt(H, 2), { at: 0, len: 3 });
  assert.equal(spanAt(H, 3), null);
  assert.deepEqual(spanAt(H, 5), { at: 4, len: 2 });
  assert.deepEqual(noteList(H).map((s) => s.at), [0, 4, 6]);
});

check("a hold with nothing before it is silence", () => {
  assert.equal(spanAt(cell("hhn", [0, 0, 0]), 1), null);
});

check("pitch moves by degree and stops at the range", () => {
  const H = cell("nr", [DEG_MAX - 1, 0]);
  assert.equal(nudgePitch(H, 0, 1), true);
  assert.equal(H.deg[0], DEG_MAX);
  assert.equal(nudgePitch(H, 0, 1), false);
  assert.equal(nudgePitch(H, 1, 1), false, "a rest has no pitch");
});

check("longer grows into a rest and never over the next note", () => {
  const H = cell("nrn", [0, 0, 0]);
  assert.equal(lengthen(H, 0), true);
  assert.equal(H.play.join(""), "nhn");
  assert.equal(lengthen(H, 0), false);
});

check("shorter gives the last step back to silence, and a note keeps one step", () => {
  const H = cell("nhh", [0, 0, 0]);
  assert.equal(shorten(H, 0), true);
  assert.equal(H.play.join(""), "nhr");
  shorten(H, 0);
  assert.equal(shorten(H, 0), false);
  assert.equal(H.play.join(""), "nrr");
});

check("a note made a rest takes its holds and its marks with it", () => {
  const H = cell("nhn", [3, 0, 1], { acc: [1, 0, 0], alt: [1, 0, 0] });
  assert.equal(toRest(H, 0), true);
  assert.equal(H.play.join(""), "rrn");
  assert.equal(H.acc[0], 0);
  assert.equal(H.alt[0], 0);
});

check("a tapped rest becomes a note that fills it and borrows the last pitch", () => {
  const H = cell("nrrrrn", [4, 0, 0, 0, 0, 1], { vel: [7, 0, 0, 0, 0, 5] });
  const like = likeAt(H, 1);
  assert.deepEqual(like, { deg: 4, vel: 7 });
  assert.equal(writeNote(H, 1, 4, like), true);
  assert.equal(H.play.join(""), "nnhhhn");
  assert.equal(H.deg[1], 4);
  assert.equal(H.vel[1], 7);
});

check("a written note stops at the first thing that is not a rest", () => {
  const H = cell("rrnr", [0, 0, 2, 0]);
  writeNote(H, 0, 4, { deg: 1 });
  assert.equal(H.play.join(""), "nhnr");
});

check("a slide and an articulation are one mark, and setting one clears the other", () => {
  const H = cell("nr", [0, 0]);
  setMark(H, 0, 4);
  assert.equal(markOf(H, 0), 4);
  setMark(H, 0, 1);
  assert.equal(markOf(H, 0), 1);
  assert.equal(H.sld[0], 0);
});

console.log(`\nALL PASS (${ok} checks)`);
