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

   `who` is `song.seeded`'s own word, and it is worth getting right because
   THIS PARAGRAPH USED TO SAY THE OPPOSITE. It read: *"named" if a hand said
   it, "chose" if the record did, null if nobody has yet* — and the first
   third of that is backwards. `song.seeded` is the RECORD's ledger, not a
   ledger of everybody: band-kit.js:577 says it "names the rows a RECORD put
   there", and `answer()` (band-kit.js:4079) takes a row OFF it the moment a
   hand touches one, in exactly one place, because "a hand answering takes the
   row off the record's ledger — which is the whole of `a hand always
   outranks`". So a person's answer leaves NO MARK AT ALL. The three states
   are:

     "named"  a record named it as it was called (band-kit.js:3019 —
              `const how = "named"`, the engineer's five included). ANOTHER
              TAKE MAY RE-ROLL IT.
     "chose"  a record or a take chose it (band-kit.js:3106, and `allSeeded` /
              `stampSeeds` for everything a roll decided). ANOTHER TAKE KEEPS
              IT.
     null     nobody is on the ledger — either the question is unanswered, or
              A PERSON ANSWERED IT. `handAt` is precisely `answered && !seeded`
              (band-kit.js:579).

   The named/chose distinction IS the one the take law turns on — band-kit.js
   :2511, "the dice rolls what the record NAMED and keeps what it CHOSE" — so
   it belongs in the structure the page reads rather than being re-derived by
   the page. A page that wants "did a person say this?" reads `who === null`
   together with a non-null `answer`, which is the same test band-kit's own
   `handSaid` makes.

   The HEAD of a question is declared on the question's own row (`head`),
   in the file where the question is defined — band-kit.js for the arranger
   and the engineer, the kit files for the players, askable.js for the knobs,
   chair.js for the families a pitched chair shares. This module does not
   decide it and MUST NOT: a heading here would be the same second source of
   truth one layer down. A row with no declared head lands under a null
   head, which is a visible defect rather than a silent one.

   (A LINE HERE CITED `test/unit/every-head.test.js` AS HOLDING THAT AT ZERO
   "across all thirty records, called and rolled". THERE IS NO SUCH FILE.
   There is no `test/unit/` directory on this branch, and
   `git log --all --diff-filter=A -- test/unit/every-head.test.js` returns
   nothing — it has never existed in this repository, on any branch, at any
   commit (checked 2026-08-25). A comment that points at a gate nobody wrote
   is worse than no comment: it reads as coverage and it survives review
   because reviewers do not `ls` the citations. The claim is a good one and
   somebody should write it; until then it stands here as an unheld invariant
   and says so.)

   Pure: same model in, same tree out, no rendering and nothing cached. */
(function (root, factory) {
  const api = factory(
    typeof require !== "undefined" ? require("./band-kit.js") : root.NuBand);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuInterview = api;
})(typeof self !== "undefined" ? self : this, function (Band) {
  "use strict";

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

     And the model's order CANNOT be the thing that moves: it is the order a
     person is asked in.

     (THIS CITED `test/unit/offer-identity.test.js` AS FINGERPRINTING
     `seatDecisions` ORDER BYTE FOR BYTE. There is no such file and there
     never has been — same check as above, `git log --all --diff-filter=A`
     returns nothing for it, 2026-08-25. Same conclusion too: it is an
     invariant this module RELIES ON and nothing currently holds. What DOES
     exist and is adjacent is `test/gates-cache.js` and the `gates` gate,
     which content-keys the EXTRACTED option table; the order a seat is asked
     in is not in it.) So the head gathers, and
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

  return { interviewOf, everyAsk, askOf, seatOf };
});
