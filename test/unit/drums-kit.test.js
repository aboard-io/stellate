// test/unit/drums-kit.test.js — THE DRUM MACHINE YOU TALK TO, proven in node.
//
//   (a) the sequence: ADD DRUMS · BREAKBEAT · HATS · FOURTH MEASURE FILL —
//       each one compiles, each one CHANGES the rendered drums.
//   (b) THE EXACTNESS LAW, again: a word is offered only when it would change
//       something, and every offered word does.
//   (c) THE BAR IS SAYABLE: every sixteenth has a drummer's name, saying it
//       puts a hit there, saying it again takes it out.
//   (d) what the model makes is a GENRE the engine already plays: every lane
//       is a kernel DRUM_LANE, the fills land on their own bar and nowhere
//       else, and the whole thing renders through K.drums.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const D = require("../../nukernel/drums-kit.js");
const K = require("../../nukernel/kernel.js");
const P = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
  vel: new Array(16).fill(6), inc: new Array(16).fill(0), stk: new Array(16).fill(0),
  gate: new Array(16).fill(0), acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
const render = (m, bars) => K.drums(P, D.toGenre(m), bars || 4);
const sig = (ev) => JSON.stringify(ev.map(e => [+e.t.toFixed(4), e.d, e.vel]));

/* (a) THE SEQUENCE */
console.log("the sequence: add drums · breakbeat · hats · fourth measure fill");
{
  let m = D.blank();
  ok(render(m).length === 0, "a machine nobody spoke to is making noise");
  ok(D.offered(m).length === 1 && D.offered(m)[0].words[0] === "add drums",
     "the first word is not ADD DRUMS");
  const seq = ["start", "groove:breakbeat", "lane:hats", "fill:4"];
  let prev = sig(render(m));
  for (const id of seq) {
    const said = D.says(m, id);
    ok(!!said, id + " says nothing about what it did");
    m = D.say(m, id);
    const now = sig(render(m));
    ok(now !== prev, id + " changed nothing in the rendered drums");
    prev = now;
  }
  ok(render(m).length > 20, "four instructions in and the kit is nearly silent");
  ok(m.fills["4"] === true, "the fourth measure fill did not land on the model");
}

/* (b) THE EXACTNESS LAW */
console.log("every word offered would change something, and does");
{
  let m = D.say(D.blank(), "start");
  // walk a few states deep so the offer set is exercised, not just its head
  const walk = (m0, depth) => {
    for (const i of D.offered(m0)) {
      const before = sig(render(m0));
      const m1 = D.say(m0, i.id);
      ok(sig(render(m1)) !== before || JSON.stringify(m1) !== JSON.stringify(m0),
         "\"" + i.words[0] + "\" is offered and changes nothing");
      if (depth > 0) walk(m1, depth - 1);
    }
  };
  walk(m, 1);
  // ...and nothing that would change nothing is offered
  const after = D.say(m, "groove:four");
  ok(!D.offered(after).some(i => i.id === "groove:four"),
     "the groove already playing is still on offer");
}

/* (c) THE BAR IS SAYABLE */
console.log("every sixteenth has a name, and saying it programs the kit");
{
  let m = D.say(D.blank(), "start");
  const words = D.stepsFor("k").filter(i => i.step != null).map(i => i.words[0]);
  ok(words.length === 16, "a bar has " + words.length + " named places, not 16");
  ok(words[0] === "on one" && words[6] === "on the and of two" && words[15] === "on the a of four",
     "the counting is not a drummer's: " + words.slice(0, 4).join(" / "));
  const at6 = () => !!m.kit.k[6];
  const was = at6();
  m = D.say(m, "step:k:6");
  ok(at6() !== was, "saying a place did not put a hit there");
  m = D.say(m, "step:k:6");
  ok(at6() === was, "saying it again did not take it out");
  // a shape is the same question asked bigger
  m = D.say(m, "shape:h:on every sixteenth");
  ok(m.kit.h.every(Boolean), "ON EVERY SIXTEENTH did not fill the hats");
  m = D.say(m, "shape:h:nowhere");
  ok(!m.kit.h.some(Boolean), "NOWHERE did not empty the hats");
}

/* (d) IT IS A GENRE THE ENGINE PLAYS */
console.log("the model is a genre: real lanes, real bars, real fills");
{
  let m = D.say(D.blank(), "start");
  m = D.say(m, "groove:boombap");
  m = D.say(m, "fill:4");
  const g = D.toGenre(m);
  ok(g.bars === 4 && Array.isArray(g.kits) && g.kits.length === 4,
     "the genre does not carry four bars");
  for (const lane of Object.keys(g.kit))
    ok(K.DRUM_LANES.includes(lane), "lane \"" + lane + "\" is not a kernel drum lane");
  for (const bar of g.kits) for (const [lane, v] of Object.entries(bar)) {
    ok(K.DRUM_LANES.includes(lane), "a bar carries a lane the kernel has no name for");
    ok(Array.isArray(v) && v.length === 16, "a lane is not sixteen steps");
  }
  // the fill is on the FOURTH bar and nowhere else
  const ev = render(m, 4);
  const barOf = (e) => Math.floor(e.t / 16);
  const toms = ev.filter(e => e.d === "t");
  ok(toms.length > 0, "a fill with no toms in it");
  ok(toms.every(e => barOf(e) === 3), "the fourth-measure fill leaked into another bar");
  const b0 = sig(ev.filter(e => barOf(e) === 0)), b3 = sig(ev.filter(e => barOf(e) === 3));
  ok(b0 !== b3, "the fill bar renders the same as bar one");
  // the feel words reach the render
  let m2 = D.say(m, "looser");
  ok(sig(render(m2)) !== sig(render(m)), "LOOSER changed nothing in the timing");
  let m3 = D.say(m, "harder");
  ok(sig(render(m3)) !== sig(render(m)), "HARDER changed nothing in the velocities");
  let m4 = D.say(m, "kit:tr808");
  ok(D.toGenre(m4).drumkit === "tr808", "the machine word did not reach the kit sound");
}

console.log(fails ? "\ndrums-kit: FAIL — " + fails + " of " + (pass + fails)
  : "drums-kit: PASS — " + pass + " checks (the sequence, the exactness law, "
    + "a bar you can say, and a genre the engine plays)");
process.exit(fails ? 1 : 0);
