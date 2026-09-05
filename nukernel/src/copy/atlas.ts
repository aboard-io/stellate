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

  /* ===== THE YEAR, IN WORDS ============================================= */
  "atlas.yearSay": "{year} · {records} within ten years · {places}",
  "atlas.record.one": "{n} record",
  "atlas.record.other": "{n} records",
  "atlas.places.more": "{places}, +{n} more",

  /* ===== WRITING A RECORD =============================================== */
  "atlas.writing": "Writing {where}…",
  "atlas.wrote": "{where} · {name} — {sections}, {voices}, take {take}",
  "atlas.wroteSeed": "{where} · {name} — {sections}, {voices}, take {take} · seed {seed}",
  "atlas.cannotWrite": "Cannot write {name} yet",
  "atlas.pickPlace": "Pick a place first",
  "atlas.noRecordAt": "{place} — no record at {year}",
  "atlas.noPlace.say": "{name} has no place on the map",

  /* ===== A SHARE LINK THAT DOES NOT RESOLVE ============================= */
  "atlas.linkNoPlace.say": "{place} is not a place on this globe",
  "atlas.linkBlank.say": "That link names no place on this globe",
  "atlas.linkYear.say": "{year} is not a year",
  "atlas.linkRecord.say": "{place} has no record on this globe",
};
