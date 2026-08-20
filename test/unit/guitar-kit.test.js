#!/usr/bin/env node
// test/unit/guitar-kit.test.js — THE GUITARIST, proven in node. Same laws as
// the keys chair (every job a kernel part, every instrument castable, a job
// that lays out is silent) plus the one that makes it a guitar and not a
// second keyboard: it chugs, it strums the offbeat, and its dirt is a
// CASTING decision because GM ships clean/overdrive/distortion as separate
// recordings.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const Gt = require("../../nukernel/guitar-kit.js");
const K = require("../../nukernel/kernel.js");
const G = (m) => { const g = Gt.toGenre(m); return { label: "G", family: "kernel",
  rate: 1, bars: 4, voices: 1, entry: () => 0, reg: () => g.reg,
  realize: () => (g.pad ? "pad" : "line"), part: () => g.part || "line",
  harmony: "cycle", roots: [0, 4, 5, 3], instr: g.instr, tone: g.tone,
  kit: {}, nobass: true, words: [], word: () => [] }; };
const play = (m) => K.render(Gt.toPattern(m), G(m), 4);
const on = () => Gt.say(Gt.blank(), "start");

console.log("a guitar is picked up, and it plays the changes");
{
  const m = on();
  ok(play(m).length > 0, "picking it up played nothing");
  ok(play(m).every((e) => Number.isFinite(e.n) && Number.isFinite(e.t)), "not finite");
  const bars = [0, 1, 2, 3].map((b) => play(m).filter((e) => e.t >= b * 16 && e.t < (b + 1) * 16)
    .map((e) => e.n).join(","));
  ok(new Set(bars).size > 1, "every bar is the same chord: " + bars[0]);
}

console.log("every job is a kernel part, its own phrase, and playable");
{
  const PARTS = ["riff", "stab", "counter", "line", "pad", "lead"];
  const shapes = new Set();
  for (const [k, j] of Object.entries(Gt.JOBS)) {
    if (j.part) ok(PARTS.includes(j.part), k + ": no kernel part called " + j.part);
    ok(j.gate.length === 16, k + ": a phrase that is not a bar");
    const m = Gt.say(on(), "job:" + k);
    if (k === "out") { ok(play(m).length === 0, "laying out played " + play(m).length); continue; }
    ok(play(m).length > 0, k + " plays nothing");
    shapes.add(j.gate.join(""));
    const p = Gt.toPattern(m);
    for (const v of ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"])
      ok(Array.isArray(p[v]) && p[v].length === 16 && p[v].every(Number.isFinite),
         k + ": " + v + " is not sixteen numbers");
  }
  ok(shapes.size >= 6, "the jobs are only " + shapes.size + " different phrases");
  // WHAT MAKES IT A GUITAR: the chug is eighths down low, and the chop is
  // offbeats with nothing on the beat
  const chug = Gt.JOBS.chug, chop = Gt.JOBS.skank;
  ok(chug.gate.filter(Boolean).length === 8 && chug.reg < 0, "the chug is not low eighths");
  ok([0, 4, 8, 12].every((i) => !chop.gate[i]) && [2, 6, 10, 14].every((i) => chop.gate[i]),
     "the offbeat chop lands on the beat");
}

console.log("the dirt is an instrument, and only ones the pool can cast");
{
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "../../nukernel/genres.js"), "utf8");
  const known = new Set((src.match(/"[a-z0-9_]+"/g) || []).map((x) => x.slice(1, -1)));
  for (const id of Object.keys(Gt.INSTRUMENTS)) {
    ok(known.has(id), "no genre in the catalog plays \"" + id + "\"");
    ok(/guitar/.test(id), id + " is not a guitar");
    const m = { ...on(), instr: id };
    ok(Gt.toGenre(m).instr === id, id + " does not reach the genre");
    ok(play(m).length > 0, id + " plays nothing");
  }
  ok(Object.keys(Gt.INSTRUMENTS).length >= 6,
     "only " + Object.keys(Gt.INSTRUMENTS).length + " guitars to choose from");
}

console.log("an amp you can turn, a neck you can move up, and a bar you can write");
{
  const m = on();
  for (const p of Gt.PANEL)
    for (const o of p.opts) {
      const m2 = Gt.say(m, "mach:" + p.id + ":" + o.w);
      ok(Gt.toGenre(m2).tone[p.key] === o.v, p.id + "/" + o.w + ": the amp says " +
         Gt.toGenre(m2).tone[p.key]);
      ok(play(m2).length > 0, p.id + "/" + o.w + " silenced it");
    }
  ok(Gt.toGenre(Gt.say(m, "reg:low")).reg < Gt.toGenre(Gt.say(m, "reg:high")).reg,
     "the neck does not move");
  // a held chord does not hear the bar; a strum does
  ok(!Gt.rhythmic(Gt.say(m, "job:ring")), "a ringing chord was offered places in the bar");
  ok(Gt.rhythmic(m), "a strum cannot be told where it falls");
  const bar = Gt.say(m, "hit:3");
  ok(Gt.gateOf(bar)[3] === 1, "a strum on the a of one did not land");
  ok(Gt.gateOf(Gt.say(bar, "hit:3"))[3] === 0, "it could not be taken out");
}

console.log("the interview ends, and nothing anybody says makes it unplayable");
{
  let m = on(), asked = 0;
  for (let i = 0; i < 20; i++) {
    const q = Gt.nextAsk(m); if (!q) break;
    ok(q.ask.endsWith("?"), q.ask + " is not a question");
    ok(q.opts.length >= 2, q.ask + " offers one answer");
    for (const o of q.opts) {
      const m2 = Gt.answer(m, q.id, o.w);
      ok(play(m2).every((e) => Number.isFinite(e.n)), q.id + "/" + o.w + " is not finite");
    }
    m = Gt.answer(m, q.id, q.opts[0].w); asked++;
  }
  ok(asked >= 4, "the interview is only " + asked + " questions");
  ok(Gt.nextAsk(m) === null, "the interview never ends");
  for (const i of Gt.catalog(on())) {
    if (!i.changes) continue;
    const m2 = Gt.say(on(), i.id);
    ok(play(m2).every((e) => Number.isFinite(e.n)), "\"" + i.words[0] + "\" is unplayable");
    ok(Gt.says(on(), i.id).length > 0, "\"" + i.words[0] + "\" says nothing");
  }
}

console.log(fails ? `\nguitar-kit: FAIL — ${fails} of ${pass + fails}`
  : `\nguitar-kit: PASS — ${pass} checks (a guitar chugs, chops the offbeat, casts its own dirt, and plays the changes)`);
process.exit(fails ? 1 : 0);
