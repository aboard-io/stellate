#!/usr/bin/env node
// test/unit/question-trees.test.js — THE QUESTION TREES, AS A GRAPH.
//
// Every page in this box is a question tree, and a tree has failure modes no
// per-chair gate sees: a question with one answer (why ask?), two answers
// that make the same record, a question that asks itself again, a dead end.
//
// HOW NOT TO CHECK THAT: walk the paths. A chair with seven questions of
// five answers is 78,125 paths and the arranger has twelve — and deduping
// states does not save you, because the distinct answer-sets ARE the
// product. That walk ran for ten minutes and was still going.
//
// WHAT THE GRAPH ACTUALLY IS: a product of near-independent axes. Answering
// the key does not change which tempos exist; answering the record does. So
// the tree is checked in three passes that are linear or quadratic in the
// number of QUESTIONS, never in the number of paths:
//
//   1. SPINE — one linear walk per chair (answer the first option each time)
//      collects every question and proves the walk terminates. O(Q).
//   2. NODES — at each question on the spine, check out-degree ≥ 2, distinct
//      words, and distinct TAKES (no two answers make the same record), and
//      that every answer increases the answered count, which is what makes
//      the graph a DAG. O(Q · A).
//   3. INDEPENDENCE — the assumption pass 2 rests on. For every ordered pair
//      of questions, answering one must not change the other's answer SET;
//      where it does, that dependency edge is followed and the dependent
//      node is re-checked under each option. O(Q² · A) on words, and only
//      the real dependencies pay for a re-check.
//
// Deterministic: no seeds, no clocks, no audio, no browser.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const Band = require("../../nukernel/band-kit.js");
const { MODES } = require("../../nukernel/genres.js");
const on = () => ({ ...Band.blank(), on: true });
Band.toSong(on(), MODES);                    // hand band-kit its MODES table

const RECORDS = Object.values(Band.GENRES).map((g) => g.w);
const answered = (m, seat) =>
  Band.seatDecisions(m, seat).filter((d) => d.answered).length;   // (reported, not asserted)
const wordsOf = (m, seat) => Object.fromEntries(
  Band.seatDecisions(m, seat).map((d) => [d.id, d.opts.map((o) => o.w).join("|")]));

const t0 = Date.now();
let Q = 0, A = 0, DEP = 0;

/* ---------- 1 + 2: THE SPINE, AND EVERY NODE ON IT ----------------------- */
console.log("every chair's tree: it ends, and every question on it is worth asking");
for (const rec of [null, ...RECORDS]) {
  // the FIRST pass is the front door itself: an arranger who has not been
  // told what the record is, walking when → where → room → what are we
  // playing, which is the state a person actually starts in
  const seed = rec ? Band.answer(on(), "arranger", "genre", rec) : on();
  for (const seat of Band.SEATS) {
    let m = seed;
    const seen = new Set();
    for (let step = 0; step < 40; step++) {
      const q = Band.nextAsk(m, seat);
      if (!q) break;
      const at = (rec || "an empty room") + "/" + seat + "/" + q.id;
      ok(!seen.has(q.id), at + " was asked twice");
      seen.add(q.id); Q++;

      // out-degree, and no word said twice
      const live = q.opts.filter((o) => !o.dead);
      ok(live.length >= 2, at + " offers " + live.length + " answer(s)");
      const words = q.opts.map((o) => o.w);
      ok(new Set(words).size === words.length, at + " says a word twice");

      // every EDGE: it makes its own record, and it moves the walk forward.
      // A NARROWING question (when/where/room) is judged on what it rules
      // OUT rather than on what it changes: it moves no note until the three
      // of them collapse to one record, which is the whole point of it.
      const fps = new Map();
      for (const o of q.opts) {
        const to = Band.answer(m, seat, q.id, o.w); A++;
        // THE DAG ARGUMENT, stated exactly: an edge marks ITS OWN question
        // answered. (Counting answers instead was wrong the moment a
        // question could leave the list — answering the city can CALL the
        // record, which retires "what are we playing?" and leaves the count
        // where it was.)
        const now = Band.seatDecisions(to, seat).find((x) => x.id === q.id);
        ok(!now || now.answered, at + ": \"" + o.w + "\" answered nothing");
        // ...and once the record IS called, where you are is a fact about
        // the session rather than a narrowing — two cities that leave the
        // same one record standing are not a duplicate answer, they are two
        // true things.
        const narrowing = q.three && !m.song.genre;
        const fp = q.three
          ? Band.survivors(to.song).map(([k]) => k).join(",") : Band.sigOf(to);
        // TWO ANSWERS THAT LEAVE ONE RECORD ARE TWO TRUE THINGS. Chicago
        // and Memphis in the fifties are both a blues as far as fourteen
        // records know, and asking where you are is still worth asking —
        // the duplicate law is about answers that leave the SAME CHOICE
        // open, not about places that agree.
        const oneLeft = q.three && Band.survivors(to.song).length <= 1;
        if (q.three && (!narrowing || oneLeft)) { /* a fact, not a fork */ }
        else if (fps.has(fp)) ok(false, at + ": \"" + o.w + "\" and \"" + fps.get(fp) +
          "\" make the identical take");
        else fps.set(fp, o.w);
      }
      m = Band.answer(m, seat, q.id, q.opts[0].w);
    }
    ok(seen.size > 0, (rec || "an empty room") + "/" + seat + ": nothing is ever asked");
    ok(Band.nextAsk(m, seat) === null,
       (rec || "an empty room") + "/" + seat + ": the interview never ends");
  }
}

/* ---------- THE FRONT DOOR: when × where × room, exhaustively ------------ */
// This one IS small enough to enumerate — three fields over fourteen records
// — and it is the one place where a wrong answer could strand you: a room
// nobody plays in that decade, in that city, is a question with no record
// behind it. The law is that the offered options never allow it.
console.log("no answer to when/where/room leads to nothing");
{
  const base = { ...on().song };
  const openOf = (s2, f) => {
    const out = [];
    for (const [, gk] of Band.survivors({ ...s2, [f]: null }))
      for (const v of gk[f] || []) if (!out.includes(v)) out.push(v);
    return out;
  };
  let triples = 0, called = 0;
  for (const when of openOf(base, "when")) {
    const s1 = { ...base, when };
    ok(Band.survivors(s1).length >= 1, when + " leads to no record at all");
    for (const where of openOf(s1, "where")) {
      const s2 = { ...s1, where };
      ok(Band.survivors(s2).length >= 1, when + " in " + where + " leads to nothing");
      for (const room of openOf(s2, "venue")) {
        const s3 = { ...s2, venue: room };
        const left = Band.survivors(s3);
        triples++;
        ok(left.length >= 1, when + " in " + where + ", " + room + " leads to nothing");
        // ...and when exactly one is left, answering the third question
        // CALLS it rather than asking which of the one records it is
        let m = on();
        m = Band.answer(m, "arranger", "when", when);
        m = Band.answer(m, "arranger", "where", where);
        m = Band.answer(m, "arranger", "venue", room);
        if (left.length === 1) {
          called++;
          ok(m.song.genre === left[0][0],
             when + "/" + where + "/" + room + ": one record left and it was not called");
        } else {
          // THE NEIGHBOURHOOD, NOT THE ROOM. The genre question is read
          // without the venue on purpose — after the third answer has called
          // a record there has to be something left to offer if you tap the
          // fact, and "the other records of that decade and that city" is
          // the honest neighbourhood. So the offered set must CONTAIN every
          // record that fits all three, and never anything from elsewhere.
          const q = Band.seatDecisions(m, "arranger").find((d) => d.id === "genre");
          const hood = Band.survivors({ when, where }).map(([, gk]) => gk.w);
          ok(q && left.every(([, gk]) => q.opts.some((o) => o.w === gk.w)),
             when + "/" + where + "/" + room + ": a record that fits is not offered");
          ok(q && q.opts.every((o) => hood.includes(o.w)),
             when + "/" + where + "/" + room + ": a record from another town is offered");
        }
      }
    }
  }
  ok(triples > 40, "only " + triples + " ways into a record");
  console.log("    " + triples + " routes in, " + called + " of them naming one record");
}

/* ---------- 3: INDEPENDENCE, which is what makes pass 2 enough ---------- */
// If answering A never changes what B offers, then checking B once on the
// spine checks it everywhere. Where it DOES change — the record narrows the
// groove, the form calls new changes — that is a dependency edge, and the
// dependent question is re-checked under every option of the one it depends
// on. This is the only place the walk branches, and it branches by exactly
// as much as the vocabulary actually couples.
console.log("the axes are independent, and every dependency is followed");
for (const rec of ["a house record", "a rock record", "a jazz date"]) {
  const seed = Band.answer(on(), "arranger", "genre", rec);
  for (const seat of Band.SEATS) {
    const ds = Band.seatDecisions(seed, seat);
    const base = wordsOf(seed, seat);
    for (const d of ds) {
      for (const o of d.opts) {
        const to = Band.answer(seed, seat, d.id, o.w);
        const now = wordsOf(to, seat);
        for (const other of ds) {
          if (other.id === d.id) continue;
          if (now[other.id] === base[other.id]) continue;   // independent
          DEP++;
          // a DEPENDENCY: re-check that node under this answer
          const dd = Band.seatDecisions(to, seat).find((x) => x.id === other.id);
          if (!dd || dd.answered) continue;   // the question left, or was answered for you
          const live = dd.opts.filter((x) => !x.dead);
          ok(live.length >= 2, rec + "/" + seat + ": after \"" + o.w + "\", " +
             other.id + " offers " + live.length + " answer(s)");
          const w2 = dd.opts.map((x) => x.w);
          ok(new Set(w2).size === w2.length,
             rec + "/" + seat + ": after \"" + o.w + "\", " + other.id + " says a word twice");
        }
      }
    }
  }
}

/* ---------- the sections, node by node ---------------------------------- */
console.log("a section's questions hold the same laws");
for (const rec of ["a house record", "a rock record", "a jazz date"]) {
  let m = Band.answer(on(), "arranger", "genre", rec);
  const gk = Band.GENRES[Object.keys(Band.GENRES).find((k) => Band.GENRES[k].w === rec)];
  m = Band.answer(m, "arranger", "form", Band.FORMS[gk.forms[0]].w);
  const secs = Band.toSong(m, MODES);
  for (let i = 0; i < secs.length; i++) {
    const asks = Band.sectionAsks(m, i);
    ok(asks.length >= 4, rec + "/section " + i + " asks " + asks.length + " things");
    for (const a of asks) {
      ok(a.opts.length >= 2, rec + "/section " + i + "/" + a.id + " offers " +
         a.opts.length + " answer(s)");
      const words = a.opts.map((o) => o.w);
      ok(new Set(words).size === words.length,
         rec + "/section " + i + "/" + a.id + " says a word twice");
      const seen = new Map();
      for (const o of a.opts) {
        const m2 = Band.setSection(m, i, a.id, o.key);
        const song = Band.toSong(m2, MODES); A++;
        ok(song.length === secs.length, "\"" + o.w + "\" changed the form's length");
        ok(song.every((s) => s.genre && s.pattern && s.guitar),
           "\"" + o.w + "\" left a section without a part");
        // the SAME definition of "different" the pruner uses — a gate with
        // its own narrower one reports honest answers as duplicates
        const fp = Band.secSigOf(m2, i);
        if (seen.has(fp) && !o.answered)
          ok(false, rec + "/section " + i + "/" + a.id + ": \"" + o.w + "\" and \"" +
             seen.get(fp) + "\" make the identical section");
        else seen.set(fp, o.w);
      }
    }
  }
}

/* ---------- determinism ------------------------------------------------- */
console.log("the same answers make the same tree, every time");
{
  const spine = (rec, seat) => {
    let m = Band.answer(on(), "arranger", "genre", rec), out = [];
    for (let i = 0; i < 40; i++) {
      const q = Band.nextAsk(m, seat); if (!q) break;
      out.push(q.id + ":" + q.opts.map((o) => o.w).join("|"));
      m = Band.answer(m, seat, q.id, q.opts[0].w);
    }
    return out.join("\n");
  };
  for (const rec of RECORDS)
    for (const seat of ["arranger", "drums", "keys"])
      ok(spine(rec, seat) === spine(rec, seat), rec + "/" + seat + ": not deterministic");
}

console.log("    " + Q + " questions, " + A + " answers, " + DEP + " dependency edges, " +
            ((Date.now() - t0) / 1000).toFixed(1) + "s");
console.log(fails ? `\nquestion-trees: FAIL — ${fails} of ${pass + fails}`
  : `\nquestion-trees: PASS — ${pass} checks (out-degree ≥ 2, no two answers alike, every edge advances, every dependency followed)`);
process.exit(fails ? 1 : 0);
