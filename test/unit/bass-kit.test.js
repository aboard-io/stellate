#!/usr/bin/env node
// test/unit/bass-kit.test.js — THE BASS PLAYER, proven in node.
//
// The drummer's gate asks whether a word changes the KIT. A bassist's part
// is a line through HARMONY, so this one asks the questions that only make
// sense once there are changes: does the key move the notes, do the changes
// move the roots, does the job change the shape of the line, and does every
// answer still render something finite that the engine can play.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const B = require("../../nukernel/bass-kit.js");
const K = require("../../nukernel/kernel.js");
const { MODES } = require("../../nukernel/genres.js");
const P = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
  vel: new Array(16).fill(6), inc: new Array(16).fill(0), stk: new Array(16).fill(0),
  gate: new Array(16).fill(0), acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
const line = (m) => { const g = B.toGenre(m, MODES); return K.bass(P, g, g.bars); };
const sig = (ev) => JSON.stringify(ev.map(e => [+e.t.toFixed(3), e.n]));

/* (a) IT PLAYS AT ALL */
console.log("a bass, picked up, plays a line");
{
  let m = B.blank();
  ok(line(m).length === 0 || !m.on, "a bass nobody picked up is playing");
  m = B.say(m, "start");
  ok(line(m).length > 0, "picking up the bass plays nothing");
  ok(line(m).every(e => Number.isFinite(e.t) && Number.isFinite(e.n)),
     "the line has notes that are not numbers");
}

/* (b) THE INTERVIEW */
console.log("a bassist answers the tune first: key, changes, then the job");
{
  let m = B.say(B.blank(), "start");
  const asked = [];
  for (let i = 0; i < 20; i++) {
    const q = B.nextAsk(m); if (!q) break;
    ok(q.ask.endsWith("?"), q.ask + " is not a question");
    ok(q.opts.length >= 2, q.ask + " offers one answer");
    asked.push(q.id);
    m = B.answer(m, q.id, q.opts[0].w);
    ok((m.answers || {})[q.id] === q.opts[0].w, q.ask + ": the answer was not recorded");
    for (const id of asked.slice(0, -1))
      ok((m.answers || {})[id], "answering " + q.id + " un-answered " + id);
  }
  ok(asked.length >= 9, "the interview is only " + asked.length + " questions");
  ok(asked[0] === "key", "a bassist is asked " + asked[0] + " before the key");
  ok(asked.indexOf("changes") < asked.indexOf("job"),
     "the bassist is asked their job before the changes");
  ok(B.nextAsk(m) === null, "the interview never ends");
  ok(line(m).length > 4, "a fully answered interview plays " + line(m).length + " notes");
}

/* (c) THE ANSWERS ARE THE MUSIC */
console.log("the key moves the notes, the changes move the roots, the job the shape");
{
  const base = B.say(B.blank(), "start");
  const inC = line(base), inF = line(B.say(base, "key:F"));
  ok(sig(inC) !== sig(inF), "changing the key changed no note");
  ok(inF.length === inC.length, "changing the key changed how many notes there are");
  const four = line(base), blues = line(B.say(base, "chg:twelvebar"));
  ok(blues.length > four.length, "a twelve-bar blues is not longer than a four-bar vamp");
  // HARMONY IS ONLY VISIBLE UNDER A LINE THAT FOLLOWS IT. The default job is
  // HOLD THE ROOT, which is a pedal point and plays one note however the
  // changes move — correctly. So the questions about changes and mode are
  // asked of a WALKING line, which is the one that has to know them.
  const walk = (m) => line(B.say(m, "style:walk"));
  const oneW = walk(B.say(base, "chg:onechord")), bluesW = walk(B.say(base, "chg:twelvebar"));
  ok(new Set(bluesW.map(e => e.n)).size > new Set(oneW.map(e => e.n)).size,
     "walked, the blues changes visit no more notes than one chord all night");
  const held = line(B.say(base, "style:root")), walked = line(B.say(base, "style:walk"));
  ok(sig(held) !== sig(walked), "HOLD THE ROOT and WALK IT play the same line");
  ok(new Set(walked.map(e => e.n)).size > new Set(held.map(e => e.n)).size,
     "walking it visits no more notes than holding the root");
  const low = line(B.say(base, "down"));
  ok(Math.min(...low.map(e => e.n)) < Math.min(...four.map(e => e.n)),
     "DOWN AN OCTAVE did not go lower");
  const majW = walk(B.say(base, "chg:onechord"));
  const minW = walk(B.say(B.say(base, "chg:onechord"), "minor"));
  ok(sig(minW) !== sig(majW), "walked, MAKE IT MINOR changed nothing");
  ok(minW.some((e, i) => e.n < majW[i].n),
     "the minor line is not lower anywhere than the major one — where is the third?");
}

/* (c2) THE NOTES HAVE LENGTH, and the words that say so are heard */
// "Short, off the string" and "let them ring" moved the model and nothing
// else: the bass gated every note to 94% of the gap whatever anybody said,
// which is a bass with no envelope. They are rendered facts now.
console.log("how long a note is held is something a bassist can say");
{
  const base = B.say(B.blank(), "start");
  const dur = (m) => line(m)[0].dur;
  const shorter = B.answer(base, "notes", "short, off the string");
  const longer = B.answer(base, "notes", "let them ring");
  ok(dur(shorter) < dur(base), "short notes are " + dur(shorter).toFixed(2) +
     " against a normal " + dur(base).toFixed(2));
  ok(dur(longer) > dur(base), "let them ring is " + dur(longer).toFixed(2));
  ok(dur(shorter) < dur(longer) * 0.7, "the two ends of the articulation are the same length");
  for (const m of [base, shorter, longer])
    ok(line(m).every((e) => e.dur > 0 && Number.isFinite(e.dur)), "a note of no length");
  // ...and the chair has a sound of its own rather than the engine's default
  const t = B.toGenre(base, MODES).bassTone;
  ok(t && t.cut > 0 && t.rel > 0, "the bass chair carries no tone of its own");
}

/* (c3) A FIGURE: A BASS LINE, WRITTEN OUT */
// Density words cannot say what an acid line is. A figure can: these
// sixteenths, that octave, an accent there, a slide into the next note —
// and the 303's accent and slide reach the engine, which nothing in the
// vocabulary could set before.
console.log("named lines, and a bar you can write one note at a time");
{
  const base = B.say(B.blank(), "start");
  const ev = (m) => { const g = B.toGenre(m, MODES); return K.bass(P, g, g.bars); };
  ok(Object.keys(B.FIGURES).length >= 6, "only " + Object.keys(B.FIGURES).length + " lines to call");
  for (const [k, f] of Object.entries(B.FIGURES)) {
    ok(f.grid.length === 16, k + ": a figure that is not a bar");
    ok(f.grid.some(Boolean), k + ": a figure with no notes in it");
    for (const v of ["oct", "acc", "sld"])
      if (f[v]) ok(f[v].length === 16 && f[v].every((x) => Number.isFinite(x)),
        k + ": " + v + " is not sixteen numbers");
    const m = B.say(base, "fig:" + k);
    const line = ev(m);
    ok(line.length > 0, k + " plays nothing");
    ok(line.every((e) => Number.isFinite(e.t) && Number.isFinite(e.n)), k + " is not finite");
    // the figure's own notes, in the render
    const inBar = line.filter((e) => e.t < 16);
    ok(inBar.length === f.grid.filter(Boolean).length,
       k + ": " + inBar.length + " notes for a figure of " + f.grid.filter(Boolean).length);
    if (f.acc && f.acc.some(Boolean)) ok(inBar.some((e) => e.acc), k + ": no accent survived");
    if (f.sld && f.sld.some(Boolean)) ok(inBar.some((e) => e.sld), k + ": no slide survived");
    if (f.oct && f.oct.some(Boolean))
      ok(new Set(inBar.map((e) => e.n)).size > 1, k + ": the octave jump never happened");
    ok(B.say(m, "fig:" + k) === m || JSON.stringify(B.say(m, "fig:" + k).fig) ===
       JSON.stringify(m.fig), k + ": saying it twice changed it");
  }
  // AN ACID LINE IS THE POINT: sixteenths, octaves, accents, slides
  const acid = ev(B.say(base, "fig:acid")).filter((e) => e.t < 16);
  ok(acid.length >= 8, "an acid line of " + acid.length + " notes");
  ok(acid.some((e) => e.acc) && acid.some((e) => e.sld) &&
     new Set(acid.map((e) => e.n)).size > 1, "an acid line with no acid in it");
  // THE BAR: one note at a time, and the three marks a note can carry
  let mine = B.say(base, "note:3");
  ok(ev(mine).filter((e) => e.t < 16).some((e) => Math.round(e.t) === 3),
     "a note said on the a of one did not sound there");
  mine = B.say(mine, "oct:3");
  ok(ev(mine).filter((e) => Math.round(e.t) === 3)[0].n >
     ev(B.say(base, "note:3")).filter((e) => Math.round(e.t) === 3)[0].n,
     "the octave did not go up");
  mine = B.say(B.say(mine, "acc:0"), "sld:0");
  const one = ev(mine).filter((e) => e.t === 0)[0];
  ok(one && one.acc === 1 && one.sld === 1, "the accent and the slide did not land on the one");
  // said again, taken back
  ok(!B.say(B.say(base, "note:3"), "note:3").fig.grid[3], "a note could not be taken out");
  ok(!B.say(base, "note:3").fig.grid[7], "writing one note wrote another");
  // ...and the figure can be forgotten
  ok(B.say(B.say(base, "fig:acid"), "fig:none").fig === null, "the figure could not be dropped");
}

/* (d) EVERY WORD, AND EVERY ANSWER, LEAVES SOMETHING PLAYABLE */
console.log("nothing a bassist can say makes an unplayable line");
{
  let m = B.say(B.blank(), "start");
  for (const i of B.offered(m)) {
    const m2 = B.say(m, i.id);
    const ev = line(m2);
    ok(ev.every(e => Number.isFinite(e.t) && Number.isFinite(e.n) && Number.isFinite(e.dur || 0)),
       "\"" + i.words[0] + "\" renders a note that is not a number");
    const g = B.toGenre(m2, MODES);
    for (const k of ["rate", "bars", "voices", "key"])
      ok(typeof g[k] === "number", "\"" + i.words[0] + "\" puts " + JSON.stringify(g[k]) +
         " in genre." + k);
    ok(Array.isArray(g.roots) && g.roots.length === g.bars,
       "\"" + i.words[0] + "\": the changes and the bar count disagree");
  }
  for (const d of B.decisions(m)) for (const o of d.opts) {
    const m2 = B.answer(m, d.id, o.w);
    ok(line(m2).every(e => Number.isFinite(e.n)), d.id + "/" + o.w + " renders NaN");
  }
  // every instrument the player can pick up is one the pool offers
  const NF = require("../../nukernel/fields.js");
  const CH = Array.isArray(NF.INSTRCHOICES) ? NF.INSTRCHOICES : Object.keys(NF.INSTRCHOICES || {});
  for (const id of Object.keys(B.INSTRUMENTS))
    ok(CH.includes(id), "the bass can pick up \"" + id + "\", which the pool does not offer");
  // every style names a bassStyle the kernel reads
  for (const [k, v] of Object.entries(B.STYLES))
    ok(["walk", "octaves", "fifths", "pedal", "eighths", "sixteenths"].includes(v),
       "style " + k + " names \"" + v + "\", which kernel.bass does not know");
}

console.log(fails ? "\nbass-kit: FAIL — " + fails + " of " + (pass + fails)
  : "bass-kit: PASS — " + pass + " checks (it plays, the interview ends, the answers ARE "
    + "the music, and nothing said makes an unplayable line)");
process.exit(fails ? 1 : 0);
