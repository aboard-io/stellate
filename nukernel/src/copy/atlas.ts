// nukernel/src/copy/atlas.ts — ONE PAGE OF THE CATALOGUE (strings.ts merges it).
//
// where — ui/atlas.js, atlas.js, atlas.gate.js, ui/globe.js: the globe, the genre index, the year
//
// The voice is DESIGN.md §4; the budgets are a chip or a face ≤ 6 words and a
// sentence beside a refused control ≤ 12, held by test/copy.test.js. A key is
// a surface and a meaning (`cell.default`, `refuse.noArticle`), never a
// fragment of a sentence: whole sentences only, with {name} / {n} / {unit}
// placeholders, so a second language can put them in its own order.
//
// WHAT IS DATA ON THIS SURFACE AND THEREFORE NOT HERE. A genre name, a place
// name and a year are catalogue rows — `Kingston`, `1969`, `reggae`, `Nordic
// folk music` — and they arrive as {name} / {place} / {year} / {region}. So do
// the era words (atlas.js ERAS: "the sixties"), which band-kit's DECADES is a
// subsequence of and atlas.gate.js G5b holds to it. Nothing here spells a row.
//
// AND THE ONE BIG DELETION THIS PAGE STANDS FOR. Every genre row carries an
// internal research note — dates, keys in backticks, a quoted reviewer, up to
// 1,546 characters — and the index shipped it verbatim as the link's `title`
// and, on a row with no article, as `aria-label` + `data-say` + `data-why`:
// 484 of the copy audit's 592 deletions, one template. The note stays in the
// genre JSON for the gates and the report; a reader gets the destination
// (`atlas.wiki.title`) or the plain reason a row has no link
// (`atlas.noArticle` · `atlas.role.say` · `atlas.silence.say`).

import type { Table } from "./api.js";

export const ATLAS: Table = {
  /* ===== THE GLOBE ====================================================== */
  "atlas.globe.aria": "Globe of records — drag to turn, plus and minus to zoom",
  "atlas.mark.aria": "{place} {year}, {name}",
  /* a place inside a larger one: "Greenwich Village, in New York 1964, folkduo" */
  "atlas.markWithin.aria": "{place}, in {region} {year}, {name}",

  /* ===== THE GENRE INDEX ================================================ */
  "atlas.index.aria": "All {n} genres, oldest first",
  "atlas.row.aria": "Play {name} — {place}, {year}",
  /* the seven rows that are not places: a part, and the empty record */
  "atlas.rowRole.aria": "Play {name}",
  "atlas.place.any": "any place",
  "atlas.place.none": "no place",

  /* ===== THE ARTICLE MARK (the ↗ in the fourth column) ================== */
  "atlas.wiki.title": "Open {name} on Wikipedia",
  "atlas.wiki.aria": "{name} on Wikipedia",
  /* an article that is not the genre itself — the broader subject, the work,
     the artist. The word rides beside the name in its own quiet span. */
  "atlas.wiki.kind": "· the {kind}",
  "atlas.wiki.kindAria": "{name} · the {kind} on Wikipedia",

  /* ===== A ROW WITH NO ARTICLE ==========================================
     Three reasons, three sentences, and none of them is the research note.
     Each is also the row's `data-why`, which two gates read back off the
     rendered page to prove that a row with no link still says why. */
  "atlas.noArticle": "No Wikipedia article",
  "atlas.noArticle.aria": "{name}, no Wikipedia article",
  "atlas.role.say": "A part, not a genre — plays anywhere",
  "atlas.role.aria": "{name} — a part, not a genre",
  "atlas.silence.say": "Empty — nothing chosen yet",
  "atlas.silence.aria": "{name} — nothing chosen yet",
  /* A STARTING POINT (2026-09-06). Paul: *"Add a few simple genres at the top:
     dance, rock, pop — really basic starting points to go with silent."* Three
     rows that are neither a role nor a record: a small band already seated, in
     no city and no year, waiting to be changed. The word had to exist because
     they were printing "a role" and they are not one. */
  "atlas.starter.say": "A starting point — a plain band to change",
  "atlas.starter.aria": "{name} — a starting point to change",

  /* ===== THE YEAR, IN WORDS — DELETED 2026-09-06 ========================
     Paul, of the line over the globe: *"Get rid of 'where' and the line above
     and the output that goes '33000 BC · 1 record within ten years · Hohle
     Fels'."* Four keys went with it — `atlas.yearSay` and the three it
     assembled itself from (`atlas.record.one` / `.other`, `atlas.places.more`)
     — and nothing else on the page had ever asked for them.
     WHERE THE FACTS WENT, because a deleted sentence has to say that. The YEAR
     is stamped inside the globe's own drawing (`ui/atlas.js stampYear`), where
     it is DATA — `yearWord(Y)` — and needs no key. The RECORD COUNT is the
     marks themselves, which is what the sentence existed to be checked
     against. The PLACES are each mark's own `atlas.mark.aria`, and the index
     row's `atlas.row.aria`, both of which name the place, the year and the
     genre already. */

  /* ===== WRITING A RECORD =============================================== */
  "atlas.writing": "Writing {where}…",
  /* (`atlas.wrote` AND `atlas.wroteSeed` STOOD HERE to 2026-09-06. Paul:
     *"We don't need this with the genre picker at all: 'Bristol 1994 ·
     noirhop — 14 sections, 9 players, take 0 · seed 28138' stop producing
     it."* The receipt is deleted with its keys: the place and the genre are
     the record's name in the top strip, the sections and the players are the
     grid you land on, and the take and the seed are the seed control's own
     face. `atlas.writing` and `atlas.cannotWrite` below are the sentences the
     page cannot otherwise show, and they stay.) */
  "atlas.cannotWrite": "Cannot write {name} yet",
  "atlas.pickPlace": "Pick a place first",
  "atlas.noRecordAt": "{place} — no record at {year}",
  "atlas.noPlace.say": "{name} has no place on the map",

  /* ===== FINDING A GENRE IN THE INDEX ===================================
     (2026-09-06. `nukernel/ui/atlas.js` grew a search field and a strip of
     century chips over the chronological index — wave C item 7 of
     docs/REDESIGN-SCOPE.md, off the walkthrough's *"reaching the trip-hop row
     is 19,306 px of scrolling"*.)

     THREE OF THE EIGHT ARE LEFT, ONE DAY LATER. Paul read the shipped strip
     and deleted two of its three controls — *"Get rid of the buttons for eras
     like 'the old Stone Age' those all go."* and *"Get rid of 'All 479
     records'."* — so `atlas.era.aria`, `atlas.era.chip`, `atlas.find.all.one`
     / `.other` and `atlas.find.some` are deleted here with them. There is no
     chip group to name and no resting count to print.

     WHAT THE THREE SURVIVORS DO:
       · the FIELD is the only control over the list, so its name says what it
         matches on — a name or a place, the two things a person arrives
         knowing. It also matches the era word, which is how a hand reaches a
         century now that the chips are gone: `the seventies` is a query.
       · `atlas.find.none` names WHAT was searched for, because a filter that
         says only "nothing" leaves a person wondering whether it heard them.
         It is the ONE thing kept out of the deleted count, and it is drawn
         where the rows would be rather than in a permanent row above them: a
         search that matches nothing must still say why.

     Every one is inside its budget — a face is six words, an `.aria` is a
     sentence of twelve — and every placeholder is the name the call site
     passes. */
  "atlas.find.aria": "Find a genre by name or place",
  "atlas.find.hint": "Find a genre",
  /* THE CLEAR SAYS WHAT IT UNDOES, not what it is (2026-09-06, Paul: "let me
     easily dismiss the letters I've entered"). "Clear" alone on a page with a
     dozen clearable things tells a screen reader nothing about which. */
  "atlas.find.clear": "Clear the search",
  "atlas.find.none": "Nothing matches {q}",

  /* ===== A SHARE LINK THAT DOES NOT RESOLVE ============================= */
  "atlas.linkNoPlace.say": "{place} is not a place on this globe",
  "atlas.linkBlank.say": "That link names no place on this globe",
  "atlas.linkYear.say": "{year} is not a year",
  "atlas.linkRecord.say": "{place} has no record on this globe",
};
