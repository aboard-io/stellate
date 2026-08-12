#!/usr/bin/env node
// acid.test.js — sixteen steps and a filter (engine/acid.js).
"use strict";
const A = require("../../engine/acid.js"), E = require("../../engine/csd-engine.js"), K = require("../../engine/genre-kernel.js");
let f = 0, c = 0;
const ok = (x, m) => { c++; if (!x) { f++; console.log("  FAIL " + m); } };
const base = () => JSON.parse(JSON.stringify((function (t) { return t.state || t; })(K.track("acidhouse", { seed: 7 }))));

console.log("\n1. the three per-step flags are the instrument");
{
  const r = A.build(base(), {});
  ok(r.live === 12 && r.accents === 3 && r.slides === 2, "the default pattern has rests, accents and slides");
  // SLIDE IS DURATION: a sliding step reaches the next live one so the mono
  // voice glides; a plain step is short and re-triggers.
  const st = A.EMPTY();
  st[0] = A.step(1, 0, 1, 0); st[4] = A.step(1, 7, 0, 0);
  const cell = A.cell(st);
  ok(cell[0][1] === 2, "a sliding step lasts all the way to the next (" + cell[0][1] + " beats)");
  const st2 = A.EMPTY();
  st2[0] = A.step(1, 0, 0, 0); st2[4] = A.step(1, 7, 0, 0);
  ok(A.cell(st2)[0][1] < 0.5, "a plain step is short, so the envelope re-triggers");
  // ACCENT rides the 5th cell element — the engine change that made this possible
  const st3 = A.EMPTY(); st3[0] = A.step(1, 0, 0, 1); st3[2] = A.step(1, 0, 0, 0);
  const c3 = A.cell(st3);
  ok(c3[0][4] > c3[1][4], "an accented step carries a higher amp multiplier");
  const ev = E.buildEvents(A.build(base(), { steps: st3 }).state).pitched.filter((e) => e.voice === "bass");
  const amps = [...new Set(ev.map((e) => Math.round(e.amp * 50)))];
  ok(amps.length > 1, "and that reaches the rendered events as two distinct levels");
}

console.log("\n2. the 303 stays a 303");
{
  const r = A.build(base(), {});
  const I = r.state.instruments.bass;
  // sampledOnly would otherwise rewrite the bass to a GM patch and the genre
  // would evaporate — tb303 is 2 anchors out of 274 and it IS acid house
  ok(I.model === "tb303" && !I.sampler, "the bass is the synth, never a sample");
  ok(I.inserts.some((x) => x.type === "filtersweep"), "and it carries the filter sweep");
  const dry = A.build(base(), { filter: { sweepDepth: 0 } });
  ok(dry.state.instruments.bass.inserts.length === 0, "sweep depth 0 removes the insert rather than sweeping by nothing");
  for (const id of A.FILTER_IDS) ok(A.FILTER[id].min <= A.FILTER[id].def && A.FILTER[id].def <= A.FILTER[id].max, id + " default is inside its range");
  // every bass-playing section plays the one line: acid house is one pattern and
  // the arrangement is the filter
  const secs = (r.state.sections || []).filter((s) => s.bass && s.bass !== "off");
  ok(secs.length > 0 && secs.every((s) => s.bass === "acid_303"), "every bass section plays the one pattern");
  const ev = E.buildEvents(r.state);
  ok(ev.pitched.filter((e) => e.voice === "bass").length > 100, "and it renders");
  ok(ev.drums.length > 50, "over a kit");
}

console.log("\n3. a pattern rides a URL");
{
  for (const t of [A.DEFAULT(), A.EMPTY(), Array.from({ length: 16 }, (_, i) => A.step(1, i, i % 3 === 0, i % 4 === 0))]) {
    const s = A.encode(t);
    const back = A.decode(s);
    ok(A.encode(back) === s, "round-trips: " + s);
    ok(back.length === 16, "always sixteen steps");
  }
  // THE BUG THIS CAUGHT: accent was letter CASE, and "0".toUpperCase() is "0" —
  // so semitones 0-9 could not be accented, and an accented root is the most
  // common event in a 303 line. Flags are their own characters now.
  for (let semi = 0; semi < 12; semi++) {
    const t = A.EMPTY(); t[0] = A.step(1, semi, 0, 1);
    ok(A.decode(A.encode(t))[0].accent === true, "semitone " + semi + " can carry an accent");
  }
  ok(A.decode("ZZZZ~~~~....????").length === 16, "junk decodes to something valid, never longer than the bar");
  ok(A.decode("").filter((x) => x.on).length === 0, "empty is silence");
}
console.log("\n" + (f ? "FAIL" : "PASS") + " — " + (c - f) + "/" + c + " checks");
process.exit(f ? 1 : 0);
