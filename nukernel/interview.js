/* interview.js — THE RECORD AS QUESTIONS AND ANSWERS, and nothing else.
   (Paul, 2026-08-23: "The page should be generated from the data model
   though right" / "make a structure that has the questions and answers in
   it".)

   band-kit already knows every question and every option. What it did not
   have was ONE VALUE holding the whole interview at once, so the page had
   to go and fetch it seat by seat and then decide, in a table of its own,
   where each question belonged. That table was a second source of truth
   about the model, living in the view, and a question added to a kit file
   fell through it silently.

   So: interviewOf(model, MODES) returns a plain JSON tree — no functions,
   no DOM, no engine — that IS the document:

     { seats:    [ { seat, heads: [ { head, questions: [ Q ] } ] } ],
       sections: [ { at, role, bars, questions: [ Q ] } ] }

     Q = { id, ask, answer, who, options: [ { w, chosen } ] }

   `who` is the provenance ledger's word for who decided it: "named" if a
   hand said it, "chose" if the record did, null if nobody has yet. That
   distinction is the one the take law turns on, so it belongs in the
   structure the page reads rather than being re-derived by the page.

   The HEAD of a question is declared on the question's own row (`head`),
   in the file where the question is defined — band-kit.js for the arranger
   and the engineer, the kit files for the players, askable.js for the knobs,
   chair.js for the families a pitched chair shares. This module does not
   decide it and MUST NOT: a heading here would be the same second source of
   truth one layer down. A row with no declared head lands under a null
   head, which is a visible defect rather than a silent one — and
   test/unit/every-head.test.js holds that at zero across all thirty
   records, called and rolled.

   Pure: same model in, same tree out, no rendering and nothing cached. */
"use strict";

const Band = require("./band-kit.js");

/* one question, flattened: what was asked, what every answer would be, and
   which one is true. `active` on an option means "this is the word that was
   said"; `answered` means "this is already true of the record" — a record
   can arrive on an answer nobody said, which is exactly what `who` tells
   you. Options keep the model's order. */
const askOf = (row, seat, who) => ({
  id: row.id,
  seat,
  head: row.head || null,
  ask: row.ask || row.who || row.id,
  answer: row.answered != null ? row.answered : null,
  who: who || null,
  options: (row.opts || []).map((o) => ({
    w: o.w,
    chosen: !!(o.active || o.answered),
  })),
});

/* the ledger says "seat/id" -> "named" | "chose" */
const whoOf = (m, seat, id) => ((m.song || {}).seeded || {})[seat + "/" + id] || null;

/* a seat's questions, grouped by the head each row declares — the whole
   grouping rule, and the reason the page needs no table.

   ONE HEAD, ONE GROUP. This walked the rows and opened a new group every
   time the head CHANGED, which is the same rule read one row at a time. It
   is not the same answer: the model's order interleaves the headings, and
   measured on a rolled record that run rule gave 37 headings for 29 distinct
   heads — the arranger saying "the form" three times and "the tune" three
   times, the drummer saying "the feel" and "the fills" twice apiece, keys
   and guitar saying "the sound" twice. A heading that appears three times in
   one chair is a heading that has stopped naming anything.

   And the model's order CANNOT be the thing that moves: `seatDecisions`
   order is fingerprinted byte for byte by test/unit/offer-identity.test.js,
   because it is the order a person is asked in. So the head gathers, and
   nothing else changes: heads come out in the order their FIRST row does,
   and inside a head the rows keep exactly the order the model gave them.
   Both of those are the model's own facts — there is still no table. */
function seatOf(m, seat) {
  const rows = Band.seatDecisions(m, seat) || [];
  const heads = [];
  const byHead = new Map();
  for (const row of rows) {
    const head = row.head || null;
    let cur = byHead.get(head);
    if (!cur) { cur = { head, questions: [] }; byHead.set(head, cur); heads.push(cur); }
    cur.questions.push(askOf(row, seat, whoOf(m, seat, row.id)));
  }
  return { seat, heads };
}

/* THE WHOLE INTERVIEW. MODES is the mode table genres.js exports; it is
   needed only to compose the record far enough to know what its sections
   are, which is what the per-section questions hang off. */
function interviewOf(m, MODES) {
  const song = Band.toSong(m, MODES) || [];
  return {
    seats: Band.SEATS.map((s) => seatOf(m, s)),
    sections: song.map((sec, i) => ({
      at: i,
      role: sec.role || null,
      bars: sec.bars != null ? sec.bars : null,
      questions: (Band.sectionAsks(m, i, MODES) || [])
        .map((row) => askOf(row, "section:" + i, null)),
    })),
  };
}

/* every question in one flat list, in document order — for a gate that
   wants to say something about all of them without walking the tree */
const everyAsk = (iv) => [].concat(
  ...iv.seats.map((s) => [].concat(...s.heads.map((h) => h.questions))),
  ...iv.sections.map((s) => s.questions));

module.exports = { interviewOf, everyAsk, askOf, seatOf };
