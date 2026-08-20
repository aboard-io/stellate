#!/usr/bin/env node
// test/unit/keys-kit.test.js — THE KEYS PLAYER, proven in node.
//
// The drummer's gate asks whether a word changes the KIT and the bassist's
// whether it changes the LINE. A keys player is the first chair that plays
// HARMONY, so this one asks the questions only chords raise: does the part
// the kernel is handed exist, does the phrase say where the hands fall, do
// the notes voice the changes rather than sitting on one chord, and does
// every job leave something the engine can play.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const Ky = require("../../nukernel/keys-kit.js");
const K = require("../../nukernel/kernel.js");
const G = { label: "T", family: "kernel", rate: 1, bars: 4,
  entry: () => 0, harmony: "cycle", roots: [0, 4, 5, 3],
  words: [], word: () => [], kit: {}, nobass: true };
const genreOf = (m) => { const kg = Ky.toGenre(m); return { ...G, ...kg,
  voices: 1, tone: kg.tone }; };
const play = (m) => K.render(Ky.toPattern(m), genreOf(m), 4);
const on = () => Ky.say(Ky.blank(), "start");

/* (a) A PAIR OF HANDS PLAYS SOMETHING */
console.log("a keys player sits down and plays the changes");
{
  const m = on();
  ok(!Ky.blank().on, "the keys are playing before anybody sat down");
  const ev = play(m);
  ok(ev.length > 0, "sitting down played nothing");
  ok(ev.every((e) => Number.isFinite(e.t) && Number.isFinite(e.n)),
     "a note that is not a number");
  // A CHORD IS SEVERAL NOTES AT ONCE — that is the whole reason for the chair
  const atZero = ev.filter((e) => e.t === 0);
  ok(atZero.length >= 3, "the first chord is " + atZero.length + " note(s)");
  // ...AND THE CHORDS MOVE with the changes rather than sitting on one
  const bars = [0, 1, 2, 3].map((b) => ev.filter((e) => e.t >= b * 16 && e.t < (b + 1) * 16)
    .map((e) => e.n).sort().join(","));
  ok(new Set(bars).size > 1, "every bar plays the same chord: " + bars[0]);
}

/* (b) EVERY JOB IS A PART THE KERNEL HAS, AND A PHRASE */
console.log("every job is a kernel part and a phrase, and every one of them plays");
{
  const PARTS = ["pad", "stab", "riff", "counter", "line", "drone"];
  for (const [k, j] of Object.entries(Ky.JOBS)) {
    ok(!!j.w && !!j.says, k + " has no words");
    if (j.part) ok(PARTS.includes(j.part), k + ": the kernel has no part called " + j.part);
    ok(j.gate.length === 16, k + ": a phrase that is not a bar");
    const m = Ky.say(on(), "job:" + k);
    ok(m.job === k, k + " was not taken");
    const ev = play(m);
    if (k === "out") {
      ok(ev.length === 0, "laying out played " + ev.length + " notes");
      continue;
    }
    ok(ev.length > 0, k + " plays nothing");
    ok(ev.every((e) => Number.isFinite(e.t) && Number.isFinite(e.n)), k + " is not finite");
    ok(Ky.toPattern(m).gate.some(Boolean), k + ": a phrase with no hands in it");
    // the phrase is the shape song.js blank() makes, or the loader refuses it
    const p = Ky.toPattern(m);
    for (const v of ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"])
      ok(Array.isArray(p[v]) && p[v].length === 16 && p[v].every(Number.isFinite),
         k + ": " + v + " is not sixteen numbers");
  }
  // the jobs are not all the same phrase
  const shapes = new Set(Object.keys(Ky.JOBS).map((k) =>
    JSON.stringify(Ky.toPattern(Ky.say(on(), "job:" + k)).gate)));
  ok(shapes.size >= 5, "the jobs are " + shapes.size + " different phrases");
}

/* (c) THE INSTRUMENT IS ONE THE POOL CAN CAST */
console.log("every instrument named is one nukernel's own genres name");
{
  const fs = require("fs");
  const src = fs.readFileSync(require("path").join(__dirname, "../../nukernel/genres.js"), "utf8");
  const known = new Set((src.match(/"[a-z0-9_]+"/g) || []).map((x) => x.slice(1, -1)));
  for (const id of Object.keys(Ky.INSTRUMENTS))
    ok(known.has(id), "no genre in the catalog plays \"" + id + "\", so the pool cannot cast it");
  for (const id of Object.keys(Ky.INSTRUMENTS)) {
    const m = { ...on(), instr: id };
    ok(genreOf(m).instr === id, id + " does not reach the genre");
    ok(play(m).length > 0, id + " plays nothing");
  }
}

/* (d) THE PANEL, THE REGISTER AND THE BAR */
console.log("a synth you can open, a register you can move, and a bar you can write");
{
  const m = on();
  for (const p of Ky.PANEL)
    for (const o of p.opts) {
      const m2 = Ky.say(m, "mach:" + p.id + ":" + o.w);
      ok(genreOf(m2).tone[p.key] === o.v, p.id + "/" + o.w + ": the tone says " +
         genreOf(m2).tone[p.key]);
      ok(play(m2).length > 0, p.id + "/" + o.w + " silenced the keys");
    }
  const low = Ky.say(m, "reg:low"), high = Ky.say(m, "reg:top");
  ok(play(low)[0].n < play(high)[0].n, "the register does not move the notes");
  // THE BAR belongs to the jobs that can hear it. A pad is held to the next
  // chord by the kernel — extra hits inside the bar read as a stutter — so
  // the places are not offered to one, and they are offered to a stab.
  ok(!Ky.rhythmic(m), "a pad is being offered places in the bar it cannot play");
  const comp = Ky.say(m, "job:comp");
  ok(Ky.rhythmic(comp), "comping cannot be told where the chords fall");
  const bar = Ky.say(comp, "hit:2");
  ok(Ky.gateOf(bar)[2] === 1, "a chord on the and of one did not land");
  ok(play(bar).some((e) => Math.round(e.t) % 16 === 2), "the new chord never sounded");
  ok(Ky.gateOf(Ky.say(bar, "hit:2"))[2] === 0, "the chord could not be taken out");
  ok(Ky.catalog(m).filter((i) => i.group === "the bar").every((i) => !i.changes),
     "a pad was offered a place in the bar");
  // ...and a hand-written bar survives a job word (which resets to the job's own)
  ok(Ky.gateOf(Ky.say(bar, "job:skank")).join() === Ky.JOBS.skank.gate.join(),
     "asking for a new job kept the old bar");
}

/* (e) THE INTERVIEW ENDS, AND EVERY ANSWER PLAYS */
console.log("the interview ends, and nothing anybody says makes it unplayable");
{
  let m = on();
  const asked = [];
  for (let i = 0; i < 20; i++) {
    const q = Ky.nextAsk(m); if (!q) break;
    ok(q.ask.endsWith("?"), q.ask + " is not a question");
    ok(q.opts.length >= 2, q.ask + " offers one answer");
    asked.push(q.id);
    for (const o of q.opts) {
      const m2 = Ky.answer(m, q.id, o.w);
      const ev = play(m2);
      ok(ev.every((e) => Number.isFinite(e.n)), q.id + "/" + o.w + " is not finite");
    }
    m = Ky.answer(m, q.id, q.opts[0].w);
  }
  ok(asked.length >= 6, "the interview is only " + asked.length + " questions");
  ok(Ky.nextAsk(m) === null, "the interview never ends");
  // every word in the tray, too
  for (const i of Ky.catalog(on())) {
    if (!i.changes) continue;
    const m2 = Ky.say(on(), i.id);
    ok(play(m2).every((e) => Number.isFinite(e.n)),
       "\"" + i.words[0] + "\" made something unplayable");
    ok(typeof Ky.says(on(), i.id) === "string" && Ky.says(on(), i.id).length > 0,
       "\"" + i.words[0] + "\" says nothing about what it did");
  }
}

console.log(fails ? `\nkeys-kit: FAIL — ${fails} of ${pass + fails}`
  : `\nkeys-kit: PASS — ${pass} checks (a chair that plays harmony: every job a kernel part, every instrument castable, the chords move with the changes)`);
process.exit(fails ? 1 : 0);
