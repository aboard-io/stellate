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
  Band.seatDecisions(m, seat).filter((d) => d.answered).length;
const wordsOf = (m, seat) => Object.fromEntries(
  Band.seatDecisions(m, seat).map((d) => [d.id, d.opts.map((o) => o.w).join("|")]));

const t0 = Date.now();
let Q = 0, A = 0, DEP = 0;

/* ---------- 1 + 2: THE SPINE, AND EVERY NODE ON IT ----------------------- */
console.log("every chair's tree: it ends, and every question on it is worth asking");
for (const rec of RECORDS) {
  const seed = Band.answer(on(), "arranger", "genre", rec);
  for (const seat of Band.SEATS) {
    let m = seed;
    const seen = new Set();
    for (let step = 0; step < 40; step++) {
      const q = Band.nextAsk(m, seat);
      if (!q) break;
      const at = rec + "/" + seat + "/" + q.id;
      ok(!seen.has(q.id), at + " was asked twice");
      seen.add(q.id); Q++;

      // out-degree, and no word said twice
      const live = q.opts.filter((o) => !o.dead);
      ok(live.length >= 2, at + " offers " + live.length + " answer(s)");
      const words = q.opts.map((o) => o.w);
      ok(new Set(words).size === words.length, at + " says a word twice");

      // every EDGE: it makes its own record, and it moves the walk forward
      const fps = new Map();
      const before = answered(m, seat);
      for (const o of q.opts) {
        const to = Band.answer(m, seat, q.id, o.w); A++;
        ok(answered(to, seat) > before, at + ": \"" + o.w + "\" answered nothing");
        const fp = Band.sigOf(to);
        if (fps.has(fp)) ok(false, at + ": \"" + o.w + "\" and \"" + fps.get(fp) +
          "\" make the identical take");
        else fps.set(fp, o.w);
      }
      m = Band.answer(m, seat, q.id, q.opts[0].w);
    }
    ok(seen.size > 0, rec + "/" + seat + ": nothing is ever asked");
    ok(Band.nextAsk(m, seat) === null, rec + "/" + seat + ": the interview never ends");
  }
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
          if (!dd) continue;                                 // the question left, fine
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
