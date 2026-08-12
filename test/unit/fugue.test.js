#!/usr/bin/env node
// fugue.test.js — THE FUGUE KERNEL (engine/fugue.js).
//
// The claim is that a fugue is one subject plus a word in a small group. The
// failure modes are specific: a transform that is not the symmetry it claims to
// be, an exposition whose voices do not actually enter in turn, entries that
// fall off the end of the cell and vanish silently, and a "drumless" piece that
// still renders percussion.
"use strict";
const F = require("../../engine/fugue.js");
const E = require("../../engine/csd-engine.js");
const K = require("../../engine/genre-kernel.js");

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  FAIL " + m); } };
const head = (s) => console.log("\n" + s);
const base = () => JSON.parse(JSON.stringify((function (t) { return t.state || t; })(K.track("neoclassical", { seed: 7 }))));
const key = (s) => s.map((n) => n.join(",")).join("|");

head("1. the transforms are the symmetries they claim to be");
{
  const S = F.DEFAULT_SUBJECT;
  // THE KLEIN FOUR-GROUP: R and I are involutions and they commute, so
  // {1, R, I, RI} is closed and every element is its own inverse.
  for (const t of ["inversion", "retrograde", "retro-inversion"]) {
    ok(key(F.transform(F.transform(S, t), t)) === key(S), t + " is its own inverse");
  }
  ok(key(F.retrograde(F.invert(S))) === key(F.invert(F.retrograde(S))), "R and I commute");
  ok(key(F.transform(S, "retro-inversion")) === key(F.retrograde(F.invert(S))), "RI is R∘I");
  ok(key(F.transform(S, "subject")) === key(S), "the identity is the identity");
  // and the four are DISTINCT on a subject that is not symmetric
  const four = new Set(["subject", "inversion", "retrograde", "retro-inversion"].map((t) => key(F.transform(S, t))));
  ok(four.size === 4, "the four symmetries give four different lines (got " + four.size + ")");

  // INVERSION mirrors about the subject's own axis, so it keeps its range and
  // stays inside the ladder — inverting about a fixed degree would shove a low
  // subject off the top
  const inv = F.invert(S);
  const range = (x) => Math.max(...x.map((n) => n[2])) - Math.min(...x.map((n) => n[2]));
  ok(range(inv) === range(S), "inversion preserves the range");
  ok(inv.every((n) => n[2] >= 0 && n[2] < F.LADDER), "and stays inside the ladder");
  ok(inv.every((n, i) => n[0] === S[i][0]), "inversion moves pitch only, never time");

  // RETROGRADE reverses time and nothing else
  const ret = F.retrograde(S);
  ok(F.spanOf(ret) === F.spanOf(S), "retrograde preserves the span");
  ok(ret[0][2] === S[S.length - 1][2], "the last note of the subject starts the retrograde");
  ok(ret.map((n) => n[2]).join() === S.map((n) => n[2]).slice().reverse().join(), "the pitches are reversed");

  // AUGMENTATION and DIMINUTION are a scaling whose product is the identity
  ok(F.spanOf(F.transform(S, "augmentation")) === F.spanOf(S) * 2, "augmentation doubles the span");
  ok(F.spanOf(F.transform(S, "diminution")) === F.spanOf(S) / 2, "diminution halves it");
  ok(key(F.scale(F.scale(S, 2), 0.5)) === key(S), "A ∘ D = 1");
  ok(F.transform(S, "augmentation").every((n, i) => n[2] === S[i][2]), "a scaling moves time only, never pitch");
}

head("2. the exposition is an exposition");
{
  const p = F.plan({ voices: 3 });
  ok(p.entries.length === 3, "three voices, three entries");
  ok(p.entries.map((e) => e.role).join() === "subject,answer,subject", "they alternate subject and answer");
  ok(p.entries[1].shift === 2, "the answer is +2 ladder degrees — the fifth of the voicing");
  ok(p.entries.every((e, i) => i === 0 || e.at > p.entries[i - 1].at), "each voice enters after the one before");
  ok(p.entries[1].at === p.span, "and at exactly one subject-length, with no overlap");

  // STRETTO compresses the entries without changing the subject
  const st = F.plan({ voices: 3, overlap: 0.5 });
  ok(st.entries[1].at === p.span / 2, "stretto 0.5 brings the answer in halfway through");
  ok(st.total < p.total, "so the exposition is shorter (" + st.total + " vs " + p.total + ")");
  ok(key(st.subject) === key(p.subject), "and the subject is untouched");

  // TOTAL IS WHERE THE LAST NOTE STOPS, not where the last entry starts. An
  // augmented entry runs twice the subject's length, and accumulating only the
  // stepped gaps left it finishing past the end of its own piece — which drew an
  // entry bar wider than its track and scrolled the page sideways.
  for (const t of F.TRANSFORMS) {
    const q = F.plan({ voices: 3, later: [t] });
    const last = q.entries[q.entries.length - 1];
    const end = last.at + F.spanOf(F.transform(q.subject, last.transform));
    ok(end <= q.total + 1e-6, "with " + t + ", the last entry ends inside the plan (" + end + " <= " + q.total + ")");
  }
  for (const v of [2, 3, 4]) ok(F.plan({ voices: v }).entries.length === v, v + " voices");
  ok(F.plan({ voices: 9 }).entries.length === 4, "more than four voices clamps to four");
}

head("3. every entry reaches the cell");
{
  // THE BUG THIS EXISTS FOR: a cell spans ONE CHORD BAR, and a three-voice
  // exposition spans three subject-lengths — so at the stock cb=8 the third
  // voice's entry landed past the end and was dropped SILENTLY. The chord bar is
  // sized to the plan now.
  for (const voices of [2, 3, 4]) for (const overlap of [1, 0.5]) {
    const r = F.build(base(), { voices, overlap });
    const notes = r.cells.upper.length + r.cells.lower.length;
    const want = r.plan.entries.length * r.plan.subject.length;
    ok(notes === want, voices + " voices at overlap " + overlap + ": all " + want + " notes reach a cell (got " + notes + ")");
    ok(r.state.chordEvery >= r.plan.total, "the chord bar covers the plan (" + r.state.chordEvery + " >= " + r.plan.total + ")");
  }
  // the lower voice must actually exist for 3+
  ok(F.build(base(), { voices: 3 }).cells.lower.length > 0, "a third voice reaches the counter cell");
  ok(F.build(base(), { voices: 2 }).cells.lower.length === 0, "a two-voice fugue needs no counter voice");
  // cells are in the shipped phrase-cell format
  const c = F.build(base(), { voices: 3, later: ["inversion", "augmentation"] }).cells;
  for (const n of c.upper.concat(c.lower)) {
    ok(n.length === 4 && n[1] > 0 && n[2] >= 0 && n[2] <= 3 && (n[3] === 0 || n[3] === 1),
      "every cell note is [beat, dur, leadIndex 0..3, oct 0|1]");
  }
}

head("4. it renders, and it renders a fugue");
{
  const r = F.build(base(), { voices: 3, later: ["inversion", "retrograde"], cycles: 2, pads: true });
  const ev = E.buildEvents(r.state);
  ok(ev.pitched.length > 80, "real pitched material (" + ev.pitched.length + ")");
  // A FUGUE HAS NO DRUM KIT — and `drums:"off"` is not enough to say so, because
  // state.thunk puts a tom under a fraction of lead notes. 49 of them, measured.
  ok(ev.drums.length === 0, "and no percussion at all (" + ev.drums.length + " drum events)");
  // COUNTERPOINT means notes SOUNDING AT ONCE in different registers. Testing for
  // an exact shared beat found three, because the tape humanises every onset by a
  // few milliseconds — so exact equality is the wrong question. Overlap is the
  // right one: does a note begin while another is still ringing?
  const mel = ev.pitched.filter((e) => e.voice === "melody").sort((a, b) => a.beat - b.beat);
  let overlaps = 0;
  for (let i = 0; i < mel.length; i++) {
    for (let j = i + 1; j < mel.length && mel[j].beat < mel[i].beat + mel[i].dur; j++) {
      if (mel[j].pch !== mel[i].pch) overlaps++;
    }
  }
  ok(overlaps > 20, "voices sound together — " + overlaps + " overlapping pairs at different pitches");
  // determinism
  ok(JSON.stringify(E.buildEvents(F.build(base(), { voices: 3 }).state))
    === JSON.stringify(E.buildEvents(F.build(base(), { voices: 3 }).state)), "the same options render byte-identically");
  // a change of subject must change the music
  const other = F.build(base(), { voices: 3, subject: [[0, 1, 3], [1, 1, 0], [2, 1, 5], [3, 1, 2]] });
  ok(JSON.stringify(E.buildEvents(other.state).pitched) !== JSON.stringify(ev.pitched), "a different subject is a different piece");
  // every transform must survive the whole pipeline
  let threw = 0;
  for (const t of F.TRANSFORMS) {
    try { E.buildEvents(F.build(base(), { voices: 3, later: [t] }).state); } catch (e) { threw++; console.log("  " + t + " threw: " + e.message); }
  }
  ok(threw === 0, "all " + F.TRANSFORMS.length + " transforms render");
  // and across a spread of base anchors, since any of them can lend the sound
  let bad = 0;
  for (const g of ["neoclassical", "citypop", "ambient", "ragtime", "dub"]) {
    if (!K.GENRES[g]) continue;
    const st = JSON.parse(JSON.stringify((function (t) { return t.state || t; })(K.track(g, { seed: 7 }))));
    const e = E.buildEvents(F.build(st, { voices: 3 }).state);
    if (e.pitched.length < 40 || e.drums.length) { bad++; console.log("  " + g + ": " + e.pitched.length + " pitched, " + e.drums.length + " drums"); }
  }
  ok(bad === 0, "every probed base renders a drumless, playable fugue");
}

console.log("\n" + (fails ? "FAIL" : "PASS") + " — " + (checks - fails) + "/" + checks + " checks");
process.exit(fails ? 1 : 0);
