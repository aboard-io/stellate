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

// A KIT LANE IS ANY KEY IN THE KERNEL'S OWN `LANES` MAP. `DRUM_LANES` is
// something else — the seven lanes a drum PHRASE (kind:"drum") may use — and
// holding kits against it said the mid and floor toms did not exist, on a
// kernel that has routed t/m/l to tomHi/tom/tomLo all along.
const D = require("../../nukernel/drums-kit.js");
const K = require("../../nukernel/kernel.js");
const KITLANE = (l) => Object.prototype.hasOwnProperty.call(K.LANES, l);
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
  // a key is either a LANE or one of the kernel's own sidecars beside a lane
  // ("!k" grace, "~k" nudge, "?k" chance) — the drummer's hands
  for (const lane of Object.keys(g.kit))
    ok(KITLANE(lane) ||
       (/^[!~?]/.test(lane) && KITLANE(lane.slice(1))),
       "kit key \"" + lane + "\" is neither a kernel lane nor a sidecar on one");
  for (const bar of g.kits) for (const [lane, v] of Object.entries(bar)) {
    ok(KITLANE(lane) ||
       (/^[!~?]/.test(lane) && KITLANE(lane.slice(1))),
       "a bar carries a key the kernel has no name for: " + lane);
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

/* (d2) NOTHING A WORD CAN SAY MAKES A NUMBER THAT IS NOT A NUMBER.
   "When I click swing audio stops": the model handed the kernel the WORD
   "swing" where swing(g,i) wants a number, every event time became NaN and
   the engine stopped. One word, one silent machine — so every instruction
   is now rendered and every time, duration and velocity checked finite. */
console.log("every word leaves the render finite");
{
  const walk = (m0, depth) => {
    for (const i of D.offered(m0)) {
      const m1 = D.say(m0, i.id);
      const ev = render(m1, 4);
      for (const e of ev) {
        ok(Number.isFinite(e.t), "\"" + i.words[0] + "\" renders an event at t=" + e.t);
        ok(e.dur == null || Number.isFinite(e.dur), "\"" + i.words[0] + "\" renders dur=" + e.dur);
        ok(e.vel == null || Number.isFinite(e.vel), "\"" + i.words[0] + "\" renders vel=" + e.vel);
      }
      // ...and the genre it hands the engine carries no WORD where the
      // kernel reads a number
      const g = D.toGenre(m1);
      for (const k of ["swing", "humanize", "rate", "bars", "voices"])
        ok(g[k] == null || typeof g[k] === "number",
           "\"" + i.words[0] + "\" puts " + JSON.stringify(g[k]) + " in genre." + k +
           ", which the kernel reads as a number");
      if (depth > 0) walk(m1, depth - 1);
    }
  };
  walk(D.say(D.blank(), "start"), 1);
}

/* (d3) THE GROOVE VOCABULARY IS REAL, AND ITS OWN. Every style is sixteen
   steps of kernel lanes, non-empty, and DISTINCT from every other — a name
   that plays another name's bar is a name that means nothing. (Nothing here
   is copied from any transcription: see the note over GROOVES.) */
console.log("every groove is sixteen real steps, and no two are the same");
{
  const seen = new Map();
  const grooves = Object.entries(D.V).filter(([id]) => id.startsWith("groove:"));
  ok(grooves.length >= 40, "the groove vocabulary is only " + grooves.length + " deep");
  for (const [id, i] of grooves) {
    const m = i.apply(D.say(D.blank(), "start"));
    let hits = 0;
    for (const [lane, v] of Object.entries(m.kit)) {
      ok(KITLANE(lane) ||
         (/^[!~?]/.test(lane) && KITLANE(lane.slice(1))),
         i.words[0] + ": key " + lane + " is neither a lane nor a sidecar");
      ok(Array.isArray(v) && v.length === 16, i.words[0] + ": " + lane + " is not sixteen steps");
      if (KITLANE(lane)) hits += v.filter(Boolean).length;
    }
    ok(hits >= 4, i.words[0] + " has " + hits + " hits in it");
    ok(render(m, 1).length > 0, i.words[0] + " renders nothing");
    const sig = JSON.stringify(m.kit);
    ok(!seen.has(sig), i.words[0] + " is the same bar as " + seen.get(sig));
    seen.set(sig, i.words[0]);
  }
}

/* (d4) THE DRUMMER'S OWN WORDS reach the render as DYNAMICS, not just
   placement: a ghost arrives quieter and an accent louder. */
console.log("ghosts and accents are velocities, not decorations");
{
  let m = D.say(D.say(D.blank(), "start"), "groove:rock");
  const snare = (mm) => render(mm, 1).filter(e => e.d === "s").map(e => e.vel);
  const plain = snare(m);
  const ghosted = snare(D.say(m, "drum:ghost notes"));
  ok(ghosted.length > plain.length, "GHOST NOTES added no notes");
  ok(Math.min(...ghosted) < Math.min(...plain) || Math.min(...ghosted) <= 3,
     "the ghosts are not quieter than the backbeat (" + ghosted.join(",") + ")");
  const acc = render(D.say(m, "drum:accent the downbeats"), 1).filter(e => e.d === "k");
  ok(acc.some(e => e.vel >= 9), "ACCENT THE DOWNBEATS made nothing louder");
  const ride = D.say(m, "drum:ride it, not the hats");
  ok(!D.has(ride.kit, "h") && D.has(ride.kit, "p"),
     "RIDE IT did not move the ostinato off the hats");
}

/* (d5) THE HANDS ARE REAL. A flam is an extra, quieter hit in FRONT of the
   beat; a lay-back moves the hit late; a breathing hat does not play the
   same number of hits in every bar. All three are kernel sidecars, and all
   three are checked in the render rather than in the model. */
console.log("flams land in front, lay-backs land late, a breathing hat varies");
{
  const base = D.say(D.say(D.blank(), "start"), "groove:rock");
  const at = (m, d) => render(m, 1).filter(e => e.d === d).map(e => +e.t.toFixed(2));
  const plain = at(base, "s");
  const flam = at(D.say(base, "drum:flam the backbeat"), "s");
  ok(flam.length > plain.length, "FLAM THE BACKBEAT added no grace note");
  ok(flam.some(t => plain.some(p => t < p && p - t < 0.5)),
     "the flam is not in FRONT of the beat: " + flam.join(","));
  const late = at(D.say(base, "drum:lay the snare back"), "s");
  ok(late.every((t, i) => t > plain[i]), "LAY THE SNARE BACK did not move it late");
  const br = D.say(base, "drum:let the hats breathe");
  const b1 = render(br, 2).filter(e => e.d === "h" && e.t < 16).length;
  const b2 = render(br, 2).filter(e => e.d === "h" && e.t >= 16).length;
  ok(b1 !== b2 || b1 < 8, "a BREATHING hat plays every bar identically (" + b1 + "/" + b2 + ")");
  const straight = D.say(D.say(base, "drum:flam the backbeat"), "drum:play it straight again");
  ok(Object.keys(straight.kit).every(k => !/^[!~?]/.test(k)),
     "PLAY IT STRAIGHT AGAIN left a hand on the kit");
}

/* (d6) THE DRUMMER'S INTERVIEW. Nine questions in the order a drummer
   answers them, every answer a real change to the part, and the sheet is
   what was DECIDED rather than what the kit happens to look like. */
console.log("a drummer sits down and answers nine questions");
{
  let m = D.say(D.blank(), "start");
  const asked = [];
  for (let i = 0; i < 20; i++) {
    const q = D.nextAsk(m);
    if (!q) break;
    ok(q.ask.endsWith("?"), "\"" + q.ask + "\" is not a question");
    ok(q.opts.length >= 2, q.ask + " offers " + q.opts.length + " answer(s)");
    asked.push(q.id);
    const before = JSON.stringify(D.toGenre(m));
    // the FIRST option is the affirmative one (a backbeat, timekeeping,
    // fills); walking the last of every question is a drummer answering
    // "nothing, nowhere, none" and is checked separately below
    const pick = q.opts[0];
    m = D.answer(m, q.id, pick.w);
    ok((m.answers || {})[q.id] === pick.w, q.ask + ": the answer was not recorded");
    // ...and answering must not re-open a question already answered
    for (const id of asked.slice(0, -1))
      ok((m.answers || {})[id], "answering " + q.id + " un-answered " + id);
    void before;
  }
  ok(asked.length >= 9, "the interview is only " + asked.length + " questions long");
  ok(asked[0] === "tempo", "the first question is " + asked[0] + ", not the tempo");
  ok(asked.indexOf("record") < asked.indexOf("job"),
     "the drummer is asked their job before what kind of record it is");
  ok(D.nextAsk(m) === null, "the interview never ends");
  ok(render(m, 4).length > 20, "a fully answered interview yields only " +
     render(m, 4).length + " hits");
  // ...and the drummer who answers "nothing, nowhere, none" still plays
  // something: the interview cannot produce silence by being answered
  {
    let bare = D.say(D.blank(), "start");
    for (let i = 0; i < 20; i++) { const q = D.nextAsk(bare); if (!q) break;
      bare = D.answer(bare, q.id, q.opts[q.opts.length - 1].w); }
    ok(render(bare, 4).length > 0, "answering every question the sparsest way is silence");
  }
  // every option of every question is playable
  for (const d of D.decisions(m)) for (const o of d.opts) {
    const m2 = D.answer(m, d.id, o.w);
    for (const e of render(m2, 4)) ok(Number.isFinite(e.t), d.id + "/" + o.w + " renders NaN");
  }
}

/* (e) EVERY MACHINE WORD NAMES A KIT THE ENGINE HAS */
console.log("every machine word is a kit the engine can route");
{
  const NF = require("../../nukernel/fields.js");
  const KITS = new Set(Object.keys(NF.DRUMKITS || {}));
  for (const [id, i] of Object.entries(D.V)) {
    if (!id.startsWith("kit:")) continue;
    const name = id.slice(4);
    ok(KITS.has(name), "\"" + i.words[0] + "\" names kit \"" + name +
       "\", which is not one the engine knows (" + [...KITS].join(", ") + ")");
  }
}

/* (e) THE TOMS ARE THREE DRUMS, THE HATS CAN COME DOWN, AND A GROOVE CAN BE
       A SENTENCE — the three things a drummer whose signature is space and
       melodic toms would find missing. */
console.log("three toms, a hand that can come down, and two bars that differ");
{
  const base = D.say({ ...D.blank(), on: true }, "groove:breakbeat");
  const ev = (m) => K.drums(P, D.toGenre(m), 4);
  const lanes = (m) => new Set(ev(m).map((e) => e.d));
  // (e1) three separate toms, each its own drum in the render
  const tom = D.say(base, "drum:a tom melody");
  for (const l of ["t", "m", "l"])
    ok(lanes(tom).has(l), "\"a tom melody\" never sounds the " + K.LANES[l].name);
  const at = (m, l) => ev(m).filter((e) => e.d === l).map((e) => e.t % 16);
  ok(at(tom, "t")[0] < at(tom, "m")[0] && at(tom, "m")[0] < at(tom, "l")[0],
     "the tom melody does not walk high to low: " +
     JSON.stringify([at(tom, "t")[0], at(tom, "m")[0], at(tom, "l")[0]]));
  const down = D.say(base, "drum:walk the toms down");
  ok(["t", "m", "l"].every((l) => lanes(down).has(l)), "walking the toms down uses one tom");
  // ...and they are drums the kernel knows, played by the right units
  for (const l of ["t", "m", "l"]) ok(K.LANES[l] && K.LANES[l].kind === "tom",
    l + " is not a tom to the kernel");
  // (e2) PLAY THE SONG: the hand comes down, the record keeps standing up
  const song = D.say(base, "drum:play the song");
  const count = (m, l) => ev(m).filter((e) => e.d === l).length;
  ok(count(song, "h") < count(base, "h"), "\"play the song\" left the hats where they were");
  ok(count(song, "h") <= count(base, "h") / 2,
     "the hand only came down from " + count(base, "h") + " to " + count(song, "h"));
  ok(count(song, "k") === count(base, "k"), "playing the song moved the kick");
  ok(count(song, "s") === count(base, "s"), "playing the song moved the backbeat");
  ok(count(song, "p") === 0 && count(song, "o") === 0, "the decoration stayed");
  ok(ev(song).every((e) => Number.isFinite(e.vel)), "\"play the song\" renders a velocity that is not a number");
  ok(ev(song).length > 0, "playing the song stopped the drums");
  // (e3) A SENTENCE: two bars, the second answering the first
  const bar = (m, b) => JSON.stringify(ev(m).filter((e) => e.t >= b * 16 && e.t < (b + 1) * 16)
    .map((e) => [e.d, +(e.t - b * 16).toFixed(2)]));
  ok(bar(base, 0) === bar(base, 1), "a plain groove already differs bar to bar");
  const said = D.say(base, "answer");
  ok(!!said.answer, "\"answer yourself\" was not recorded");
  ok(bar(said, 0) !== bar(said, 1), "the answer bar is the same bar again");
  ok(bar(said, 0) === bar(said, 2) && bar(said, 1) === bar(said, 3),
     "the sentence is not two bars long");
  ok(bar(said, 0) === bar(base, 0), "answering changed the bar that asks");
  ok(JSON.stringify(D.say(said, "answer").answer) === "false",
     "the sentence cannot be taken back");
  ok(bar(D.say(said, "answer"), 0) === bar(D.say(said, "answer"), 1),
     "taking the answer back left it in");
  // every one of them still renders something a machine can play
  for (const m of [tom, down, song, said])
    ok(ev(m).every((e) => Number.isFinite(e.t) && Number.isFinite(e.vel) && K.LANES[e.d]),
       "a new word rendered something the kit has no drum for");
}

console.log(fails ? "\ndrums-kit: FAIL — " + fails + " of " + (pass + fails)
  : "drums-kit: PASS — " + pass + " checks (the sequence, the exactness law, "
    + "a bar you can say, and a genre the engine plays)");
process.exit(fails ? 1 : 0);
