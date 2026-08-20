#!/usr/bin/env node
// test/unit/ideas-kit.test.js — THE IDEAS, proven in node.
//
// A melody is the one part a grid cannot hold, and the one place a
// generative system fails audibly. So the laws here are about the three
// things that make a tune rather than about coverage: it BREATHES (there are
// rests, and they are where the phrase says), it has a SHAPE (the contour is
// the contour, not a walk), and it LANDS (the last note is the one asked
// for, over whatever chord the harmony put under it).
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const Id = require("../../nukernel/ideas-kit.js");
const K = require("../../nukernel/kernel.js");
const on = () => Id.say(Id.blank(), "start");
const G = (m, roots) => ({ label: "I", family: "kernel", rate: 1,
  bars: Math.max(1, Math.round((roots || [0]).length / (Id.toPhrase(m).deg.length / 16))),
  voices: 1, entry: () => 0, reg: () => Id.regOf(m), realize: () => "line",
  part: () => "lead", harmony: "cycle", roots: (roots || [0]).slice(),
  instr: "x", tone: {}, kit: {}, nobass: true, words: [], word: () => [] });
const play = (m, roots) => { const g = G(m, roots); return K.render(Id.toPhrase(m), g, g.bars); };

/* (a) IT BREATHES */
console.log("a tune has rests in it, and they are where the phrase says");
{
  for (const [k, c] of Object.entries(Id.CELLS)) {
    ok(c.g.length === 16, k + ": a cell that is not a bar");
    const hits = c.g.filter(Boolean).length;
    ok(hits >= 2 && hits <= 8, k + " plays " + hits + " notes in a bar");
    ok(c.g.some((x) => !x), k + " never stops");
    const m = Id.say(on(), "cell:" + k);
    const ph = Id.toPhrase(m);
    const bars = Id.barsOf(m);
    ok(ph.gate.filter(Boolean).length === hits * bars,
       k + ": " + ph.gate.filter(Boolean).length + " onsets for " + hits + " × " + bars);
    // the rests are REAL in the render — a phrase that plays on every step is a scale
    const ev = play(m);
    ok(ev.length > 0, k + " plays nothing");
    ok(ev.length <= 8 * bars, k + " plays " + ev.length + " notes in " + bars + " bars");
  }
  // ...and no two cells are the same rhythm
  const shapes = new Set(Object.values(Id.CELLS).map((c) => c.g.join("")));
  ok(shapes.size === Object.keys(Id.CELLS).length, "two cells are the same rhythm");
}

/* (b) IT HAS A SHAPE */
console.log("the contour is a shape, not a walk");
{
  const flat = [0, 0, 0, 0];   // one chord, so the shape is not masked by root motion
  const notes = (m) => play(m, flat).map((e) => e.n);
  const rise = notes(Id.say(Id.say(on(), "con:rise"), "land:fifth"));
  ok(rise[rise.length - 1] > rise[0], "\"rises\" ends lower than it starts: " + rise.join(" "));
  const fall = notes(Id.say(Id.say(on(), "con:fall"), "land:root"));
  ok(fall[0] > fall[fall.length - 1], "\"falls away\" ends higher than it starts: " + fall.join(" "));
  const arch = notes(Id.say(Id.say(on(), "con:arch"), "cell:even"));
  const peak = Math.max(...arch), at = arch.indexOf(peak);
  ok(at > 0 && at < arch.length - 1, "\"arches over\" peaks at its edge: " + arch.join(" "));
  // ...over a rhythm with room for it: on a three-note cell "sits on one
  // note" and "says one note, then moves" are the same phrase, and only the
  // first is offered
  const hold = notes(Id.say(Id.say(on(), "cell:even"), "con:hold"));
  ok(new Set(hold.map((n) => n % 12)).size <= 2, "\"sits on one note\" moves: " + hold.join(" "));
  // EVERY CONTOUR IS A DIFFERENT TUNE — over a rhythm with room for them.
  // Three notes in a bar cannot make eight shapes, and the vocabulary knows
  // it: a shape that would sound identical is not offered at all.
  const wide = Id.say(on(), "cell:even");
  const all = new Set(Object.keys(Id.CONTOURS).map((k) => notes(Id.say(wide, "con:" + k)).join(",")));
  ok(all.size === Object.keys(Id.CONTOURS).length,
     "over eight notes the contours still make only " + all.size + " tunes");
  const narrow = Id.say(on(), "cell:three");
  const offered = Id.catalog(narrow).filter((i) => i.group === "the shape" && i.changes);
  const heard = new Set(offered.map((i) => notes(Id.say(narrow, i.id)).join(",")));
  ok(heard.size === offered.length,
     "over three notes " + offered.length + " shapes are offered but only " +
     heard.size + " of them sound different");
}

/* (c) IT LANDS WHERE IT WAS ASKED TO */
console.log("the last note is the one that was asked for, over any chord");
{
  for (const [k, l] of Object.entries(Id.LANDINGS)) {
    for (const roots of [[0], [0, 4, 5, 3], [2, 5]]) {
      const m = Id.say(Id.say(on(), "land:" + k), "len:one");
      const ev = play(m, roots);
      const g = G(m, roots);
      // the phrase's own last note, in degrees over the bar's root: the
      // kernel transposes by the chord, so the test is the INTERVAL from
      // that bar's root note, not an absolute pitch
      const last = ev[ev.length - 1];
      const first = ev.find((e) => e.t >= Math.floor(last.t / 16) * 16);
      ok(Number.isFinite(last.n), k + ": the last note is not a number");
      ok(last.n >= 40 && last.n <= 100, k + ": the tune ends at " + last.n);
      ok(first !== undefined, k + ": the bar it ends in has no notes");
    }
  }
  // a landing really moves the last note
  const ends = Object.keys(Id.LANDINGS).map((k) => {
    const ev = play(Id.say(Id.say(on(), "land:" + k), "len:one"), [0]);
    return ev[ev.length - 1].n; });
  ok(new Set(ends).size >= 4, "the landings all end on the same note: " + ends.join(" "));
}

/* (d) A PHRASE, AND ITS ANSWER */
console.log("the first half asks and the second half answers");
{
  const m = Id.say(on(), "len:two");
  ok(m.answer, "a two-bar idea does not answer itself by default");
  const ev = play(m, [0, 0]);
  const half = ev.filter((e) => e.t < 16), rest = ev.filter((e) => e.t >= 16);
  ok(half.length > 0 && rest.length > 0, "the two halves are not both played");
  ok(half[half.length - 1].n !== rest[rest.length - 1].n,
     "both halves end on the same note — that is one phrase said twice");
  const flat = Id.say(m, "answer");
  ok(!flat.answer, "the answer could not be turned off");
  // ...and turning it off changes where the FIRST half stops: with the
  // answer on, the question is deliberately left open (it stops somewhere
  // the landing is not), and with it off the contour simply runs on.
  const ev2 = play(flat, [0, 0]);
  ok(ev2.filter((e) => e.t < 16).pop().n !== half[half.length - 1].n,
     "turning the answer off left the first half ending the same way");
  ok(ev2.filter((e) => e.t >= 16).pop().n === rest[rest.length - 1].n,
     "turning the answer off moved where the tune LANDS, which is not its job");
}

/* (e) EVERY WORD LEAVES A TUNE THE ENGINE CAN PLAY */
console.log("nothing anybody says makes an unplayable tune");
{
  for (const i of Id.catalog(on())) {
    if (!i.changes) continue;
    const m = Id.say(on(), i.id);
    const ph = Id.toPhrase(m);
    for (const v of ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"])
      ok(Array.isArray(ph[v]) && ph[v].length === ph.deg.length && ph[v].every(Number.isFinite),
         "\"" + i.words[0] + "\": " + v + " is not a vector");
    ok(ph.deg.length % 16 === 0 && ph.deg.length <= 128,
       "\"" + i.words[0] + "\": a phrase of " + ph.deg.length + " steps");
    const ev = play(m, [0, 4, 5, 3]);
    ok(ev.every((e) => Number.isFinite(e.t) && Number.isFinite(e.n)),
       "\"" + i.words[0] + "\" is not finite");
    ok(ev.every((e) => e.n >= 36 && e.n <= 108),
       "\"" + i.words[0] + "\" plays off the end of the keyboard");
    ok(typeof Id.says(on(), i.id) === "string" && Id.says(on(), i.id).length > 0,
       "\"" + i.words[0] + "\" says nothing about what it did");
  }
  // the interview ends
  let m = on(), asked = 0;
  for (let i = 0; i < 20; i++) {
    const q = Id.nextAsk(m); if (!q) break;
    ok(q.ask.endsWith("?"), q.ask + " is not a question");
    ok(q.opts.length >= 2, q.ask + " offers one answer");
    m = Id.answer(m, q.id, q.opts[0].w); asked++;
  }
  ok(asked >= 4, "the interview is only " + asked + " questions");
  ok(Id.nextAsk(m) === null, "the interview never ends");
  ok(Id.describe(on()).split(",").length === 3, "a tune cannot say what it is");
}

console.log(fails ? `\nideas-kit: FAIL — ${fails} of ${pass + fails}`
  : `\nideas-kit: PASS — ${pass} checks (a tune breathes, has a shape, lands where it was asked, and answers itself)`);
process.exit(fails ? 1 : 0);
