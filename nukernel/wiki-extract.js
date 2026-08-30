#!/usr/bin/env node
/* nukernel/wiki-extract.js — WHICH WIKIPEDIA ARTICLE EACH ANCHOR IS, RESOLVED.
 *
 * (Paul, 2026-08-26: "Kiwix is running on this box. Use it to look up genres
 * then add actual Wikipedia links for each genre we have at the top by the
 * title.")
 *
 * The same species as nukernel/gates-extract.js and nukernel/knobs-extract.js,
 * and it lives beside them for the same reason: a table somebody TYPES is a
 * second source of truth and it rots. So this is a program that asks the local
 * Wikipedia what each anchor's article actually is, and writes the answer down.
 * `nukernel/wiki.js` is its output and carries a DO-NOT-EDIT banner;
 * `nukernel/WIKI.md` is the same derivation written for a human to read;
 * `--check` re-derives both and exits non-zero if the shipped files disagree.
 *
 *     node nukernel/wiki-extract.js [--check] [--only KEY] [-v]
 *
 * Exit 0 ok · 1 the tree and the ZIM disagree · 2 no kiwix on this box (skip).
 *
 * ---------------------------------------------------------------------------
 * KIWIX IS A BUILD-TIME TOOL, NOT A RUNTIME ONE
 *
 * `kiwix-serve` on localhost:8888 serves
 * /mnt/sources/kiwix/zim/wikipedia_en_all_maxi_2026-02.zim — the whole English
 * Wikipedia of February 2026, on this box, offline. This file talks to it. THE
 * PAGE NEVER DOES. nukernel/index.html plays and draws with the wire cut and
 * may not fetch anything, so the resolution happens ONCE, here, and what ships
 * is the table plus a plain `<a href="https://en.wikipedia.org/wiki/…">`.
 * A LINK IS NOT A FETCH: an anchor element with an href costs no request until
 * a reader clicks it, and clicking it is the reader's choice, not the page's.
 * test/atlas.js G7 aborts every non-localhost request and G14 reads
 * performance.getEntriesByType("resource") — both stay green with 191 wikipedia
 * hrefs in the DOM, and that is the proof, not an argument.
 *
 * NODE ONLY, in no script tag, in no service-worker list. What ships beside the
 * page is wiki.js.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DERIVED AND WHAT IS DECLARED, BECAUSE IT IS NOT ALL ONE THING
 *
 * DISAMBIGUATION IS THE WHOLE JOB AND A WRONG LINK IS WORSE THAN NONE. The
 * genre KEY is not the search term: `punk` is Punk rock and not the subculture,
 * `garage` is UK garage because the anchor's own label says London 1999,
 * `drill` is Drill music because it says Chicago 2012, `minimalism` is Minimal
 * music and not the art movement, `classical` is the Classical PERIOD and not
 * the whole tradition. No amount of string-mangling gets those right — the
 * first-ranked hit for "punk rock" in this ZIM is "List of punk rock bands,
 * L–Z" — so the CHOICE is declared below in ASK, one row per anchor, each
 * carrying the sentence that justifies it against the anchor's own facts (its
 * label's city and year, its `parents`, its `wants`, its comment in genres.js).
 * That row is the thing a human checks.
 *
 * EVERYTHING ELSE IS DERIVED, and the derivation is what makes the row
 * checkable rather than a claim:
 *   · the article EXISTS         — 200 from /content/<book>/<Title>;
 *   · the CANONICAL title        — 302 chains and kiwix's meta-refresh stubs are
 *                                  followed, so "Merseybeat" lands on Beat
 *                                  music and "Punjabi hip hop" on Music of
 *                                  Punjab, under the name Wikipedia files it;
 *   · the LEAD SENTENCE          — pulled out of the article and written into
 *                                  WIKI.md beside the reason, so checking the
 *                                  table means reading two sentences that have
 *                                  to agree, not trusting one.
 *
 * FIVE REJECTIONS, AND EVERY ONE OF THEM CAUGHT A REAL MISTAKE
 *
 *   404          — "Punjabi pop", "Balkan brass band", "Industrial breaks",
 *                  "Motown Sound", "Jeel music" are not articles.
 *   DISAMBIGUATION — a lead that says a word "may/might/can/could refer to".
 *                  `Mbube` is one; the genre is Mbube (genre). `New Order` is
 *                  one; the band is New Order (band). `Rai` is one; the
 *                  Algerian music is Raï, and the diaeresis is the difference.
 *   NO ARTICLE THERE — kiwix's own footer ("This article is issued from
 *                  Wikipedia…") turning up in the first 900 characters. This is
 *                  what caught `Forro`, which says "could refer to" rather than
 *                  "may refer to" and passed every text test: an ethnic group
 *                  in São Tomé, their creole, and the music, which is at Forró.
 *                  THE ACCENT WAS THE WHOLE LINK.
 *   A SECTION, NOT AN ARTICLE — kiwix serves a redirect-to-#fragment as a tiny
 *                  meta-refresh stub. "Melodic techno" is one: it points at
 *                  Styles_of_house_music#M, a line in a list. A line in a list
 *                  is not this genre's article and linking it would send a
 *                  reader to the wrong place with the right word on it.
 *   NOT ABOUT MUSIC — the lead, with its hatnotes stripped, must contain a word
 *                  from MUSICAL below. `Zema` passes every other test and is a
 *                  GENUS OF ASIAN PLANTHOPPERS. The Ethiopian chant this
 *                  anchor means is filed at Ethiopian chant. The hatnote strip
 *                  matters: Zema's own hatnote says "For Ethiopian liturgical
 *                  chant, see…", which would have let the planthopper through.
 *
 * A rejected row is not silently swapped for a guess. It fails the run, loudly,
 * with the code — and an anchor that has no article gets NO LINK and appears in
 * MISSES, printed on the page and in WIKI.md.
 *
 * ---------------------------------------------------------------------------
 * THE SIX ROLES GET NO LINK
 *
 * `simple`, `solo`, `vocal`, `backing`, `riff`, `pad` are internal roles, not
 * music: they are what a chair DOES on this record. "Solo (music)" hung on a
 * row that means "this chair plays alone" would be the caricature failure in
 * miniature — a real article, a real word, and a lie about what the row is.
 * They are listed by name in ROLES and the run asserts the emitted table has no
 * entry for any of them.
 *
 * ---------------------------------------------------------------------------
 * FOUR KINDS OF ROW, AND THE PAGE SHOWS WHICH
 *
 * Most anchors are a genre and link to that genre's article. Some are not, and
 * pretending otherwise is how a table stops being checkable:
 *
 *   genre    the article names this genre.                              (160)
 *   artist   genres.js names the anchor for ONE act in brackets and
 *            Wikipedia has no article for the style — `[Ned's Atomic
 *            Dustbin]` has Grebo (music) and stays a genre, `[The Kinks]`
 *            does not and links the band.                                 (20)
 *   work     the anchor is an ERA of one act, and the record IS the era:
 *            analogsynthpop is "[Depeche Mode, Speak & Spell era]" and
 *            gothsynth is "[Depeche Mode, Violator era]" — the same band
 *            nine years apart, which two links to Depeche Mode would erase
 *            and two links to the two albums say exactly.                   (4)
 *   broader  no article for this genre; the nearest true article is wider.
 *            punjabipop lands on Music of Punjab because "Punjabi hip hop"
 *            redirects there and there is nothing narrower. Marked, not hidden.
 *                                                                           (7)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const HOST = process.env.KIWIX_HOST || "localhost";
const PORT = Number(process.env.KIWIX_PORT || 8888);
const BOOK = "wikipedia_en_all_maxi_2026-02";
const OUT_JS = path.join(__dirname, "wiki.js");
const OUT_MD = path.join(__dirname, "WIKI.md");

/* THE SIX INTERNAL ROLES. Not music — see the header. */
const ROLES = ["simple", "solo", "vocal", "backing", "riff", "pad"];

/* A lead that contains none of these IN ITS FIRST 600 CHARACTERS is not an
 * article about music. The list is deliberately wide (a Kabul film-song scene
 * and a Sacred Harp tunebook do not share vocabulary) and its only job is to
 * catch the planthopper. 600 rather than 400 because Tropicália opens with a
 * pronunciation guide and an alternative name before it says what it is, while
 * the planthopper never gets round to music at all. */
/* "may refer to" is not the only wording a disambiguation page uses — `Forro`
 * says "could refer to" and would otherwise have shipped, pointing a Recife
 * 1950 anchor at an ethnic group in Sao Tome. */
const DISAMB = /\b(may|might|can|could)\s+(also\s+)?refer to\b|\bis a (disambiguation|list of)\b/i;

/* `trip.hop` joined 2026-08-30, the downtempo round, for the same reason
 * `hip.hop` was always here: Massive Attack's lead is "an English trip hop
 * collective formed in 1988 in Bristol" — every noun in it is a place, a
 * person or the genre itself, and the genre's own name was the one word the
 * guard did not know. The guard's job is the planthopper, not the founders
 * of trip hop. */
const MUSICAL = /\b(music|song|genre|band|sing|sung|chant|danc|rhythm|melod|album|instrument|orchestra|choir|choral|vocal|opera|hymn|tune|drum|guitar|piano|record|compos|repertoire|ensemble|percussion|techno|jazz|blues|folk|funk|reggae|ballad|swing|house\b|pop\b|rock\b|rap\b|soul\b|beat\b|hip.hop|trip.hop)/i;

/* ---------------------------------------------------------------------------
 * ASK — THE DISAMBIGUATION, ONE ROW PER ANCHOR, WITH ITS REASON.
 *
 * `q` is the title to ask the ZIM for; the run canonicalises it, so a row may
 * name the word a reader would type and let the redirect do the filing.
 * `why` is the sentence that has to survive being read next to the article's
 * own lead in WIKI.md. `kind` defaults to "genre".
 * ------------------------------------------------------------------------ */
const ASK = {

  /* ---- THE ORIGINAL TABLE ---------------------------------------------- */
  fugue:      { q: "Fugue", why: "the form itself; Leipzig 1725 is Bach at the Thomasschule and the article is about the subject-and-answer machinery this anchor implements." },
  acid:       { q: "Acid house", why: "Chicago 1987 is Phuture's Acid Tracks. Not Acid (disambiguation) and not LSD: the 303 squelch has its own genre article." },
  newwave:    { q: "New wave music", why: "London 1979, the Buggles-and-Cars record the comment names. `New Wave` alone is the film movement." },
  vaporwave:  { q: "Vaporwave", why: "unambiguous; Portland 2011 is the scene the article dates." },
  blues:      { q: "Blues", why: "the generic article, not Chicago blues, although the label says Chicago 1952: ten anchors here descend from this row as `blues` (gospel, funk, rock, swing, countrypop, skiffle, zydeco, bluegrass, jamband, bodiddley) and it is the table's blues parent. The label sets the SOUND (twelve bars, electric); the link names the music." },
  rock:       { q: "Rock music", why: "the generic parent of a dozen rows here. Not Rock (geology), not Rock (disambiguation)." },
  gregorian:  { q: "Gregorian chant", why: "Rome 600 is the tradition's own attributed date; `Gregorian` alone is a calendar." },
  bulgarian:  { q: "Bulgarian State Television Female Vocal Choir", why: "the anchor's comment names Le Mystere des Voix Bulgares, and that record IS this choir — the ensemble whose held-second diaphony this row is written from. Not Music of Bulgaria, which is a country survey; not the album, which is one release of the choir's work.", kind: "artist" },
  spem:       { q: "Spem in alium", why: "the anchor is one PIECE — Tallis's forty-voice motet — and its article is that piece.", kind: "work" },
  // REWRITTEN 2026-08-29 (Paul: "Why is counterpoint in 1725"). The date is
  // right and the row's NAME is what was wrong — see the long paragraph above
  // the anchor in genres.js. `Species counterpoint` was tried as the target
  // and REJECTED by this file's own rule: it is not an article, it is a
  // meta-refresh stub pointing at `Counterpoint#Species_counterpoint`, and a
  // line in an article is not this row's article.
  counterpoint: { q: "Counterpoint", why: "Vienna 1725 dates FUX'S BOOK and not the practice: Gradus ad Parnassum is the species method this row implements, and counterpoint itself runs from organum around 900 through Josquin and Palestrina — which is why this anchor's parents are `gregorian` and `organum` (Paris 1200) rather than nothing. The article is the practice at that full width and its own species section is the part this row teaches the kernel. `Species counterpoint` is a redirect to a section, not an article." },
  neoclassical: { q: "Contemporary classical music", why: "Berlin 2011, parents ambient/postrock/minimalism — sustained strings under a turning piano figure. THREE CANDIDATES WERE REJECTED BY READING WHAT THEY SAY: `Neoclassicism (music)` is Stravinsky in the 1920s; `Neoclassical new-age music` redirects to New-age music, whose lead is about yoga and massage; `Neoclassical dark wave` is a goth genre. This is wider than the anchor and it is the only one that is not simply a different music.", kind: "broader" },
  drone:      { q: "Drone music", why: "New York 1964 is La Monte Young; `Drone` alone is an aircraft." },
  sludge:     { q: "Sludge metal", why: "New Orleans 1991; the i-to-flat-II phrygian riff at half speed is this article's subject." },
  tango:      { q: "Tango music", why: "the MUSIC, not Tango (dance) — this anchor casts instruments and a bandoneon register, not steps." },
  deathmetal: { q: "Death metal", why: "Tampa 1990 is the article's own scene and date." },
  eurythmics: { q: "Eurythmics", why: "the anchor is named for the act; London 1983 is Sweet Dreams. Not Eurhythmics, the Dalcroze method, which is a different word.", kind: "artist" },
  isley:      { q: "The Isley Brothers", why: "Teaneck 1973 is 3 + 3; the anchor is this band's Rhodes-and-fuzz chassis.", kind: "artist" },
  toto:       { q: "Toto (band)", why: "Los Angeles 1982 is Toto IV. Not Toto the dog, not Toto (Wizard of Oz).", kind: "artist" },
  jodeci:     { q: "Jodeci", why: "Charlotte 1991 is Forever My Lady; the anchor is this group's gospel-over-swingbeat sound.", kind: "artist" },
  beatles:    { q: "The Beatles", why: "Liverpool 1962; the anchor's eight declared parents are this band's own reading list.", kind: "artist" },
  steely:     { q: "Steely Dan", why: "Los Angeles 1977 is Aja; the anchor is the jazz-schooled studio-band idiom that band named.", kind: "artist" },
  postrock:   { q: "Post-rock", why: "Austin 2003; the arrival-by-crescendo shape the article describes." },
  boombap:    { q: "Boom bap", why: "New York 1994, and the article is about the drum idiom rather than hip hop at large — which is right, because this row IS the kit and the chop." },
  trap:       { q: "Trap music", why: "Atlanta 2003, the half-time snare and tied 808. Not Trap music (EDM), which is the festival derivative bigroom already covers." },
  house:      { q: "House music", why: "Chicago 1986. The generic article, not Chicago house: nine rows here descend from `house`, which makes this the table's house parent." },
  garage:     { q: "UK garage", why: "the key alone is ambiguous — garage rock is a different music — and the LABEL settles it: London 1999, the broken kick and the two-bar shuffle, which is UK garage and not the Nuggets sound." },
  dnb:        { q: "Drum and bass", why: "London 1994; `dnb` is not a word Wikipedia files under." },
  disco:      { q: "Disco", why: "New York 1977; unambiguous." },
  funk:       { q: "Funk", why: "Cincinnati 1967 is James Brown at King; the generic article, and this row is the table's funk parent." },
  motown:     { q: "Motown", why: "Detroit 1965. The article covers both the label and the Sound — `Motown Sound` and `The Motown Sound` are not separate articles, the first 404s and the second redirects here." },
  rnb:        { q: "Contemporary R&B", why: "Philadelphia 1994, the nineties production this row is written from. NOT Rhythm and blues, which is the 1940s music `blues` and `funk` already cover." },
  gospel:     { q: "Black gospel music", why: "Chicago 1932 is Thomas Dorsey at Pilgrim Baptist, which is precisely this article's subject; Gospel music is the wider umbrella including white Southern gospel, and the parents here (blues .75) say which one this is." },
  reggae:     { q: "Reggae", why: "Kingston 1969; unambiguous." },
  dub:        { q: "Dub music", why: "Kingston 1973 is King Tubby; `Dub` alone is film dubbing." },
  ska:        { q: "Ska", why: "Kingston 1962, the first wave — which is what parents mento/blues/jazz/calypso describe, not 2 Tone." },
  afrobeat:   { q: "Afrobeat", why: "Lagos 1971 is Fela. Deliberately NOT Afrobeats, which is a different music forty years later and has its own anchor two rows down — the single most confusable pair in this table." },
  bossa:      { q: "Bossa nova", why: "Rio de Janeiro 1958 is Chega de Saudade." },
  countrypop: { q: "Country music", why: "the KEY says countrypop but the LABEL says Nashville 1945, which predates the country-pop crossover by twenty-five years, and the parents (gospel .5, blues .5) are country's own roots. This row is the table's generic country parent — bluegrass, altcountry, folkduo, skiffle and confessionalpop all descend from it. Country pop goes to `confessionalpop`, whose Nashville 2008 label IS that crossover." },
  synthpop:   { q: "Synth-pop", why: "Basildon 1981 is Depeche Mode's own town and year; the hyphen is Wikipedia's filing." },
  shoegaze:   { q: "Shoegaze", why: "London 1991; unambiguous." },
  citypop:    { q: "City pop", why: "Tokyo 1984; unambiguous." },
  punk:       { q: "Punk rock", why: "New York 1976, the Ramones' year. NOT Punk subculture and NOT Punk (disambiguation): this anchor is three chords and a downstroke, which is the music." },
  ambient:    { q: "Ambient music", why: "London 1978 is Music for Airports; `Ambient` alone is a disambiguation." },
  techno:     { q: "Techno", why: "Detroit 1988. The generic article rather than Detroit techno, because six rows here descend from `techno` and this is the table's techno parent — the same ruling `blues` and `house` take." },
  jazz:       { q: "Jazz", why: "the LABEL says New York 1945, which is bebop exactly, and the ornament table confirms it (this row plays bebop's approach note; ethiojazz is defined as this row with that term removed). The link is still the generic article, because nine anchors descend from `jazz` as the table's jazz parent and `swing` already holds the previous era in its own row." },
  bodiddley:  { q: "Bo Diddley", why: "Chicago 1955; the anchor is the man's hambone rhythm.", kind: "artist" },
  chuckberry: { q: "Chuck Berry", why: "St. Louis 1955; the anchor is his blues-over-country double-stop idiom.", kind: "artist" },
  doowop:     { q: "Doo-wop", why: "Harlem 1955; unambiguous." },
  skiffle:    { q: "Skiffle", why: "London 1956 is Lonnie Donegan; unambiguous." },
  minimalism: { q: "Minimal music", why: "New York 1967 is Reich and Riley. NOT Minimalism, which is the visual-art movement — the single easiest wrong link in this table." },
  kraftwerk:  { q: "Kraftwerk", why: "Dusseldorf 1977 is Trans-Europe Express; the anchor is named for the band.", kind: "artist" },
  electro:    { q: "Electro (music)", why: "New York 1982 is Planet Rock. The bare `Electro` is a disambiguation page." },
  hymn:       { q: "Hymn", why: "Boston 1831 is Lowell Mason; the article covers the sung hymn, and `Hymn tune` is the narrower melody-only article this row's four voices exceed." },
  crooner:    { q: "Crooner", why: "Los Angeles 1953; the article is about the singing style, which is what this row's rate and `anchor` rule implement." },
  yuletide:   { q: "Christmas music", why: "New York 1942 is White Christmas. There is no article for the big-band Christmas standard as a genre; this is the genre article that contains it." },
  merseybeat: { q: "Merseybeat", why: "Liverpool 1963; the word redirects to Beat music, which is where Wikipedia files it, and the run follows that." },
  psychpop:   { q: "Psychedelic pop", why: "London 1968; NOT Psychedelic rock, which is jamband's and khmerrock's neighbourhood — this row is a pop song with a choir on it." },
  bigbeat:    { q: "Big beat", why: "Essex 1997 is the Prodigy and Fatboy Slim." },
  drill:      { q: "Drill music", why: "the key alone could be a marching exercise or a power tool; the LABEL says Chicago 2012, which is this article's own origin sentence." },
  clubpop:    { q: "Dance-pop", why: "New York 1983, a pop chorus over a club floor — the article's own definition. `Club pop` is not a title Wikipedia carries." },
  powerballad: { q: "Sentimental ballad", why: "Los Angeles 1991. `Power ballad` in this ZIM is not an article — it is a meta-refresh into Sentimental_ballad#Power_ballads, a section — so the link is the article that section lives in, which is wider than the anchor.", kind: "broader" },
  latinpop:   { q: "Latin pop", why: "Miami 2001; the article covers the rock-band-plus-Latin-percussion crossover this row's parents spell out." },
  reggaeton:  { q: "Reggaeton", why: "San Juan 2004; unambiguous." },
  kpop:       { q: "K-pop", why: "Seoul 2012; unambiguous." },
  boyband:    { q: "Boy band", why: "Orlando 1997; the article is about the format, which is what this row's lead-and-two-backing scheme is." },
  emo:        { q: "Emo", why: "Chicago 1999; the music article, not Emo (disambiguation)." },
  screamo:    { q: "Screamo", why: "San Diego 1994; unambiguous." },
  confessionalpop: { q: "Country pop", why: "Nashville 2008 is exactly the crossover this article dates and describes — a country record that lifts into the pop half, which is this row's verse-acoustic/chorus-synth device. See `countrypop`, which takes Country music because its 1945 label predates this." },
  darkrnb:    { q: "Alternative R&B", why: "Toronto 2011 is the article's own founding scene; `Dark R&B` redirects into it." },
  bigroom:    { q: "Big room house", why: "Las Vegas 2012; the build-and-drop this row writes as `kits` is the article's subject." },
  blueeyedsoul: { q: "Blue-eyed soul", why: "Philadelphia 1976 is Hall & Oates at Sigma Sound." },
  folkduo:    { q: "American folk music revival", why: "Greenwich Village 1964 is that revival's own address and peak year; there is no article for the two-voices-and-a-guitar format itself." },
  worldfolk:  { q: "World music", why: "Johannesburg 1986 is Graceland, and this row is the folk-songwriter-meets-African-guitar crossover the article names. It is also the row WORLD.md flags as the caricature risk, which is a reason to link the honest umbrella rather than a specific tradition it is not." },
  jamband:    { q: "Jam band", why: "San Francisco 1972; unambiguous." },
  sophistirock: { q: "Sophisti-pop", why: "London 1986. The anchor's own name is a variant of this article's title and its jazz-schooled-band-on-a-Hammond description is the article's subject." },
  motorik:    { q: "Motorik", why: "Dusseldorf 1974; the article is about the beat, which is what this row is (kick and snare together, no fill, ever)." },
  roboticpop: { q: "The Man-Machine", why: "Dusseldorf 1978 IS this album, and it is what separates this row from `motorik`: the same band's machine pulse folded into a vocoder verse-chorus song. Two links to Kraftwerk would erase the distinction the two rows exist to draw.", kind: "work" },
  waxtrax:    { q: "Wax Trax! Records", why: "Chicago 1981 is a LABEL row and the label article is the subject — the batcave/zodiak/brill precedent, a room that ships because the record is its own. The article names the discography this row is written from ('The first official Wax Trax! release was Strike Under's Immediate Action twelve inch EP in 1980... it was the release of Cold Life by Ministry in 1981—along with the licensing of Front 242's Endless Riddance EP—that set the stage'). `Wax Trax!` was PROBED and it is not a second article — this ZIM redirects it here, so the store lives as a section of the label's page and there is no shop/label fork to get wrong (which is why the row's own comment has to do the dating work: the shop is Denver 1974 and Chicago 1978, the label 1980, and this row is 1981). Not `Ministry (band)`, which is `industrialmetal`'s own act seven years on and would collapse the parent into the child. KIND is `broader` on the zodiak/batcave ruling — a label, like a venue, is none of this table's four kinds, and broader is the nearest true word: the imprint contained the scene the row anchors. (`motown` is `genre` instead because that article covers the label AND the Sound under one title; this one does not.)", kind: "broader" },
  industrialmetal: { q: "Industrial metal", why: "Chicago 1988 is Ministry's Land of Rape and Honey." },
  ebm:        { q: "Electronic body music", why: "Chicago 1989; the anchor's comment spells the acronym out." },
  musichallrock: { q: "The Kinks", why: "Muswell Hill 1966 is this band's own postcode and Face to Face's year. There is no article for a rock band playing music-hall changes, and `Music hall` is the Edwardian stage tradition the anchor's own comment says is a MISSING rung here — linking it would name the ancestor as the thing.", kind: "artist" },
  orchpsych:  { q: "The Flaming Lips", why: "Oklahoma City 1999 is The Soft Bulletin. `Chamber pop` is the arranging tradition the anchor's comment explicitly calls its missing rung, so it is the wrong link; the band is the subject.", kind: "artist" },
  altcountry: { q: "Alternative country", why: "Chicago 1996 is Wilco's Being There, and this article's scene." },
  yachtsoul:  { q: "Boz Scaggs", why: "San Francisco 1976 is Silk Degrees. Yacht rock is taken by the row named for it and this row is explicitly the SOUL half — Isley's Rhodes under Motown polish — so the artist the comment names is the honest subject.", kind: "artist" },
  yachtrock:  { q: "Yacht rock", why: "Austin 1979 is Christopher Cross; the article is about exactly this studio-craft radio sound." },
  songwriterpiano: { q: "Carole King", why: "New York 1971 is Tapestry. There is no genre article for Brill-Building changes sung from the piano bench, and the anchor's comment names her.", kind: "artist" },
  softfolk:   { q: "James Taylor", why: "Chapel Hill 1970 is Sweet Baby James and his own town; the comment names him and the Carolina fingerstyle it is built on has no article of its own.", kind: "artist" },
  singersongwriter: { q: "Singer-songwriter", why: "New York 1972. The comment names Carly Simon, but unlike the four rows above it this one has a real genre article under its own key, and the article is about exactly this figure." },
  coastrock:  { q: "Fleetwood Mac", why: "Sausalito 1977 is Rumours, recorded at the Record Plant in that town. The California folk-rock crossover this row is named for has no anchor and no single article; the band's is the honest one.", kind: "artist" },
  spacerock:  { q: "Space rock", why: "London 1973 is The Dark Side of the Moon; the genre article exists and names Pink Floyd, so the band link is unnecessary." },
  grebo:      { q: "Grebo (music)", why: "Stourbridge 1990. The bare `Grebo` is not the music; the parenthetical article is, and it names the Stourbridge scene this row's two-bass joke comes from." },
  melodictechno: { q: "Orbital (band)", why: "Kent 1991 is the Hartnolls' own county and Orbital's year, and `Melodic techno` in this ZIM is not an article — it is a meta-refresh into Styles_of_house_music#M, one line in a list. The duo the comment names has a real article.", kind: "artist" },
  bleeptechno: { q: "Bleep techno", why: "Manchester 1989 is 808 State, and the article covers the Yorkshire scene the anchor's comment calls its missing rung — the genre is right even though the city in the label is the crossover rather than the source." },
  industrialbreaks: { q: "Meat Beat Manifesto", why: "Swindon 1989 is this act's own town and year — the article's own first sentence ('formed in 1987 in Swindon') and Storm the Studio, the 1989 LP that Wax Trax! licensed for the US and that, the article says, is why they 'got pigeonholed as an industrial act'. `Industrial breaks` is not an article and the sample-collage tradition the comment names has none either. The row is named for a style and linked to an act, which is the `winstons` shape and the standing argument for renaming the key itself.", kind: "artist" },
  industrialrock: { q: "Pretty Hate Machine", why: "REPOINTED 2026-08-30, off `Industrial rock` and onto the RECORD. Cleveland 1989 is one album made by one man in one studio's down-time, and the genre article cannot check this row's fields — the album article can, and it contradicted them on nearly every axis until this round: 'a heavily synthesizer-driven electronic sound', the four synthesizers by name, 'samples from his record collection for all the drum sounds', and the mix law the row is now built on ('Rough and first takes of vocals and guitar were used to contrast the quantized drums and bass'). The `spem`/`winstons` reading — the anchor is an ERA of one act and the record IS the era.", kind: "work" },
  analogsynthpop: { q: "Speak & Spell (album)", why: "Basildon 1980 and the comment says '[Depeche Mode, Speak & Spell era]'. The ERA is the anchor — bright filter, low resonance, one monosynth — and linking the band would make this row and `gothsynth` the same link for two deliberately different records.", kind: "work" },
  gothsynth:  { q: "Violator (album)", why: "Basildon 1990 and the comment says '[Depeche Mode, Violator era]' — the same band nine years on, dark and resonant. See `analogsynthpop`: the two albums say what one band link would erase.", kind: "work" },
  gothicpop:  { q: "The Cure", why: "Crawley 1987 is this band's own town and Kiss Me, Kiss Me, Kiss Me. `Gothic rock` is what the comment calls this row's MISSING rung, so it is the wrong link.", kind: "artist" },
  postpunk:   { q: "Post-punk", why: "Manchester 1979 is Unknown Pleasures; the genre article exists and covers it." },
  dancepostpunk: { q: "New Order (band)", why: "Manchester 1983 is Blue Monday — the exact turn the comment describes. The bare `New Order` is a disambiguation page of political movements, and `Dance-punk` is a different, later genre.", kind: "artist" },
  madchester: { q: "Madchester", why: "Manchester 1990; the article is the scene, which is what this row is." },
  janglepop:  { q: "Jangle pop", why: "Manchester 1984 is The Smiths' debut; the genre article covers the chiming-guitar idiom the row implements as swing on a straight grid." },
  indiedance: { q: "Indie dance", why: "Glasgow 1990. The word redirects to Alternative dance, which is where Wikipedia files this crossover, and the run follows the redirect." },

  /* ---- THE ANCESTORS — the European line the table filled in ------------ */
  organum:    { q: "Organum", why: "Paris 1200 is Perotin at Notre-Dame; unambiguous." },
  troubadour: { q: "Troubadour", why: "Provence 1210; the article is the tradition, and this row's single line over a drone is its music." },
  estampie:   { q: "Estampie", why: "Paris 1300; unambiguous." },
  arsnova:    { q: "Ars nova", why: "Reims 1360 is Machaut; unambiguous." },
  pavane:     { q: "Pavane", why: "Antwerp 1551 is Susato's dance books. The article is the Renaissance dance and its music; Pavane (Faure) is a different page." },
  continuo:   { q: "Basso continuo", why: "Florence 1602 is Caccini's Le nuove musiche — a solo line over a figured bass, which is what this row is. (An earlier reading of this row said the word redirects to Figured bass; the ZIM says otherwise — Basso continuo is its own article, and the run's canonicalisation is what settled it.)" },
  concerto:   { q: "Concerto", why: "Venice 1725 is Vivaldi at the Pieta; the ritornello form this row alternates is the article's subject." },
  classical:  { q: "Classical period (music)", why: "Vienna 1785 is Mozart. NOT Classical music, which is the whole tradition from Perotin to now and would swallow eight other rows in this table — the period article is the one that means what this anchor means." },
  nocturne:   { q: "Nocturne", why: "Paris 1835 is Chopin; the article's own first illustration is a Chopin nocturne." },
  romantic:   { q: "Romantic music", why: "Vienna 1876 is Brahms's First. Not Romanticism, which is the literary and visual movement." },
  barcarolle: { q: "Barcarolle", why: "Paris 1881 is Offenbach; the article is the boat-song form in 6/8 that this row's meter implements." },
  parlor:     { q: "Parlour music", why: "New York 1892 is the parlour-song publishing trade; `Parlor song` redirects here and the run follows it." },

  /* ---- THE MODERN WORLD — 2020s -------------------------------------- */
  amapiano:   { q: "Amapiano", why: "Johannesburg 2020; unambiguous, and the ZIM's first hit." },
  afrobeats:  { q: "Afrobeats", why: "Lagos 2021. The terminal `s` is the whole distinction from `afrobeat` (Lagos 1971) fifty years earlier, and Wikipedia keeps them as two articles for the same reason this table keeps two rows." },
  hyperpop:   { q: "Hyperpop", why: "London 2021; unambiguous." },
  bailefunk:  { q: "Funk carioca", why: "Rio de Janeiro 2022. `Baile funk` and `Brazilian funk` both redirect here; this is Wikipedia's own title for the music, and it is emphatically not Funk." },
  corridotumbado: { q: "Corridos tumbados", why: "Guadalajara 2023; the article's own subject and region." },
  punjabipop: { q: "Music of Punjab", why: "Chandigarh 2022. There is NO article for the 2020s Punjabi pop wave — `Punjabi pop` 404s and both `Punjabi music` and `Punjabi hip hop` redirect here. This is the nearest true article and it is WIDER than the anchor, which is why it is marked broader rather than passed off as the genre.", kind: "broader" },
  mahraganat: { q: "Mahraganat", why: "Cairo 2021; unambiguous." },
  bedroompop: { q: "Lo-fi music", why: "Los Angeles 2020. `Bedroom pop` is a meta-refresh into Lo-fi_music#Bedroom_pop, a section; the article that section lives in is the honest link and is wider than the anchor. It is also the right family: this row is about DYNAMICS, a whispered vocal an inch from the microphone, which is what lo-fi means.", kind: "broader" },

  /* ---- AFRICA ---------------------------------------------------------- */
  zema:       { q: "Ethiopian chant", why: "Aksum 540 is the Ethiopian Orthodox tradition attributed to Yared. THE BARE WORD `Zema` IS A GENUS OF ASIAN PLANTHOPPERS in this ZIM — it passes every check except the one that reads what the article is about. Wikipedia files the chant here." },
  highlife:   { q: "Highlife", why: "Accra 1957; unambiguous." },
  marabi:     { q: "Marabi", why: "Johannesburg 1935; unambiguous." },
  mbube:      { q: "Mbube (genre)", why: "Johannesburg 1939. The bare `Mbube` is a disambiguation page listing Solomon Linda's song, this genre and a Speed Racer character; the parenthetical article is the singing style this row's unaccompanied four-part writing implements." },
  ethiojazz:  { q: "Ethio-jazz", why: "Addis Ababa 1969 is Mulatu Astatke; the hyphen is Wikipedia's filing." },
  congorumba: { q: "Congolese rumba", why: "Kinshasa 1960. NOT Rumba, which is the Cuban parent this row's `wants` names separately as afro-cuban son." },
  kwaito:     { q: "Kwaito", why: "Johannesburg 1994; unambiguous." },
  mandeguitar: { q: "Music of Mali", why: "Bamako 1970. `Mande music` is a meta-refresh into Music_of_Mali#Mande_music, a section; the article it lives in is the honest link. The anchor's key names an instrument technique and Wikipedia has no article for it, so this row is wider than the anchor by two steps and says so.", kind: "broader" },
  rai:        { q: "Raï", why: "Oran 1985. THE DIAERESIS IS LOAD-BEARING: the bare `Rai` is a disambiguation page, and the Algerian music is filed under Raï." },
  palmwine:   { q: "Palm-wine music", why: "Freetown 1950; unambiguous, and it names the Kru sailors' guitar this row's `wants` asks for." },
  kwela:      { q: "Kwela", why: "Johannesburg 1955; unambiguous." },
  mbaqanga:   { q: "Mbaqanga", why: "Johannesburg 1964; unambiguous." },
  soukous:    { q: "Soukous", why: "Kinshasa 1985; unambiguous." },
  benga:      { q: "Benga music", why: "Nairobi 1972. The bare `Benga` is a Nigerian place; the article with `music` is the Luo guitar style." },
  makossa:    { q: "Makossa", why: "Douala 1972; unambiguous." },
  hiplife:    { q: "Hiplife", why: "Accra 1998; unambiguous, and the article's own definition is highlife plus hip hop, which is this row's parent vector." },
  kizomba:    { q: "Kizomba", why: "Luanda 1995; unambiguous." },
  coupedecale: { q: "Coupé-décalé", why: "Abidjan 2003; the accents are Wikipedia's own title and the unaccented spelling 404s." },

  /* ---- LATIN AMERICA AND THE CARIBBEAN --------------------------------- */
  son:        { q: "Son cubano", why: "Havana 1928. NOT Son (music) and not the Mexican sones — the Cuban form, which is the one seven rows here descend from." },
  bolero:     { q: "Bolero", why: "Havana 1948, and the article's own first line says it is about the CUBAN genre of song; the Spanish dance is at Bolero (Spanish dance) and Ravel is at Boléro. This is the rare case where the bare word is already the right one." },
  mambo:      { q: "Mambo (music)", why: "Mexico City 1950 is Perez Prado's own address; the bare `Mambo` is a disambiguation." },
  salsa:      { q: "Salsa music", why: "New York 1973 is Fania. The bare `Salsa` is a sauce." },
  cumbia:     { q: "Cumbia", why: "Barranquilla 1960; the article is the Colombian tradition and its diaspora, which is what this row and vallenato both sit in." },
  vallenato:  { q: "Vallenato", why: "Valledupar 1975 is the form's own town." },
  samba:      { q: "Samba", why: "Rio de Janeiro 1939. The article is explicitly the MUSIC genre; Samba (Brazilian dance) and Samba (ballroom dance) are separate." },
  choro:      { q: "Choro", why: "Rio de Janeiro 1900; unambiguous." },
  forro:      { q: "Forró", why: "Recife 1950. THE ACCENT IS LOAD-BEARING: unaccented `Forro` is a disambiguation page for an ethnic group in São Tomé, their creole, and this music." },
  merengue:   { q: "Merengue music", why: "Santo Domingo 1955. The bare `Merengue` is the meringue confection disambiguation." },
  bachata:    { q: "Bachata (music)", why: "Santo Domingo 1992; the parenthetical is Wikipedia's filing." },
  calypso:    { q: "Calypso music", why: "Port of Spain 1956. The bare `Calypso` is a Greek nymph and a Jacques Cousteau ship." },
  soca:       { q: "Soca music", why: "Port of Spain 1979 is Lord Shorty; the bare `Soca` is a disambiguation." },
  mento:      { q: "Mento", why: "Kingston 1952; unambiguous, and it is the ska row's largest declared parent." },
  rocksteady: { q: "Rocksteady", why: "Kingston 1966; unambiguous." },
  dancehall:  { q: "Dancehall", why: "Kingston 1985; the article is the Jamaican genre, not the building." },
  huayno:     { q: "Huayno", why: "Cusco 1965; unambiguous." },
  mariachi:   { q: "Mariachi", why: "Guadalajara 1950 is the ensemble's own home state capital." },
  nortena:    { q: "Norteno (music)", why: "Monterrey 1955. Wikipedia files it accented and parenthesised; the bare word is a demonym." },
  banda:      { q: "Banda music", why: "Mazatlan 1938; the bare `Banda` is a disambiguation." },
  tropicalia: { q: "Tropicália", why: "São Paulo 1968 is the manifesto album's year. The article is the MOVEMENT — art, poetry and music together — which is right, because this anchor's own comment says its method is collage and its `cannot` holds the seams." },

  /* ---- EAST AND SOUTHEAST ASIA ----------------------------------------- */
  shidaiqu:   { q: "Shidaiqu", why: "Shanghai 1940; unambiguous." },
  enka:       { q: "Enka", why: "Tokyo 1969; unambiguous." },
  trot:       { q: "Trot (music)", why: "Seoul 1965. The bare `Trot` is a horse gait; the parenthetical is the Korean genre." },
  cantopop:   { q: "Cantopop", why: "Hong Kong 1984; unambiguous." },
  mandopop:   { q: "Mandopop", why: "Taipei 2003; unambiguous." },
  kroncong:   { q: "Kroncong", why: "Jakarta 1935; unambiguous, and the article names the Portuguese sailors' music this row's `wants` asks for." },
  dangdut:    { q: "Dangdut", why: "Jakarta 1975; unambiguous." },
  lukthung:   { q: "Luk thung", why: "Bangkok 1970; Wikipedia files it as two words." },
  manilasound: { q: "Manila sound", why: "Manila 1976 is Hotdog and the Cinema Audio sessions, which is the article's own scene." },
  nhacvang:   { q: "Yellow music", why: "Ho Chi Minh City 1968. `Nhạc vàng` is a meta-refresh into Yellow_music#Vietnam, a section, and yellow music IS the phrase's translation. The article covers TWO separate musics under that name — the Shanghai one is `shidaiqu`, which has its own row and its own article — so this link is wider than the anchor and the reader lands one section above what they wanted.", kind: "broader" },
  khmerrock:  { q: "Cambodian rock", why: "Phnom Penh 1970. The word redirects to Cambodian rock (1960s-1970s), which is precisely this row's period, and the run follows the redirect." },

  /* ---- SOUTH ASIA, THE MIDDLE EAST AND NORTH AFRICA -------------------- */
  filmi:      { q: "Filmi", why: "Mumbai 1960; unambiguous, and it names the playback-singing tradition four other rows descend from." },
  qawwali:    { q: "Qawwali", why: "Faisalabad 1988 is Nusrat Fateh Ali Khan's own city." },
  bhangra:    { q: "Bhangra (music)", why: "Jalandhar 1972. Bhangra (dance) is a different article and this row casts instruments, not steps." },
  shaabi:     { q: "Shaabi", why: "Cairo 1978, and the article's first line says Egyptian — which matters, because the same word names a Moroccan music this row is not." },
  aljil:      { q: "Al Jeel", why: "Cairo 1988. `Jeel music` 404s; Wikipedia files the genre under this spelling." },
  arabesk:    { q: "Arabesque (Turkish music)", why: "Istanbul 1980 is Orhan Gencebay's decade. `Arabesque (music)` in this ZIM is a meta-refresh into a disambiguation page, and `Arabesk` is a disambiguation listing an airline alliance and a novel sequence." },
  anadolurock: { q: "Anatolian rock", why: "Istanbul 1972; unambiguous." },
  iranpop:    { q: "Iranian pop music", why: "Tehran 1974 is the Golha-era pop this row's `wants` names; `Persian pop music` redirects here and the run follows it." },
  kabulpop:   { q: "Music of Afghanistan", why: "Kabul 1972 is Radio Afghanistan's own golden decade. There is no article for the Kabul film-song pop itself; this is the nearest true one and it is wider than the anchor.", kind: "broader" },

  /* ---- EUROPE, VERNACULAR AND HISTORICAL ------------------------------- */
  rebetiko:   { q: "Rebetiko", why: "Piraeus 1935; unambiguous." },
  fado:       { q: "Fado", why: "Lisbon 1955; unambiguous." },
  rumbacatalana: { q: "Rumba catalana", why: "Barcelona 1970. The word redirects to Catalan rumba, Wikipedia's own title, and the run follows it; it is not the Cuban rumba." },
  irishtrad:  { q: "Irish traditional music", why: "Dublin 1963 is the ballad-group revival; the article is the tradition and names the O'Neill collection this row's `wants` asks for." },
  balkanbrass: { q: "Balkan brass", why: "Guča 1985 is the trumpet festival's own town and the article's own subject. `Balkan brass band` 404s." },

  /* ---- NORTH AMERICAN VERNACULAR --------------------------------------- */
  ragtime:    { q: "Ragtime", why: "Sedalia 1899 is Joplin's own town and Maple Leaf Rag's year." },
  swing:      { q: "Swing music", why: "Kansas City 1938 is Basie. The bare `Swing` is a disambiguation and Swung note is the rhythm rather than the music." },
  bluegrass:  { q: "Bluegrass music", why: "Nashville 1946 is Monroe with Scruggs; the bare `Bluegrass` is a grass and a region of Kentucky." },
  sacredharp: { q: "Sacred Harp", why: "Philadelphia 1844 is the tunebook's own publication decade; the article is the shape-note tradition." },
  zydeco:     { q: "Zydeco", why: "Lafayette 1955 is Clifton Chenier's own city." },

  /* ---- MUSIC WRITTEN TO BRAND A BROADCAST ------------------------------ */
  // Both rows point at the SAME article on purpose, the way the ten blues
  // descendants share `Blues`: what these two anchors have in common is the
  // commission, not the sound. "Television news music is used by television
  // stations to brand their news operations" is the article's own first line,
  // and it is exactly what both records are. The difference between them is
  // internal to this table (1970 has a tune, 2006 has a hit), and a link
  // cannot carry it — the anchors' own comments do.
  newsfanfare: { q: "Television news music", why: "London 1970. `News music` redirects here and the run follows it. Not News at Ten, which is the programme rather than the music, and not Production music, which is the library trade this cue was written for but is wider than the genre.", kind: "broader" },
  breakingnews: { q: "Television news music", why: "New York 2006. Not CBS Evening News, which is the programme whose relaunch Horner scored; a genre row does not link a bulletin.", kind: "broader" },

  /* ---- THE TWO MOST-WANTED MISSING ANCESTORS (2026-08-29) --------------- */
  // Not a taste round: these two were chosen by counting `wants` across the
  // catalogue. Six anchors named jump blues and five named tin pan alley,
  // more than named anything else, and both now exist.
  jumpblues:  { q: "Jump blues", why: "Los Angeles 1946 is Louis Jordan's Choo Choo Ch'Boogie on Decca, and the article is about exactly this music — the small swing band playing a shuffle at a dance tempo. Not Blues, which is this row's own parent and a different, slower thing; not Rhythm and blues, which is the wider trade name the jump bands were sold under." },
  tinpanalley: { q: "Tin Pan Alley", why: "New York 1924, Youmans and Gershwin. The article is the PUBLISHING DISTRICT and its trade, which is wider than the anchor: this row is the thirty-two-bar song those firms sold, not the firms. There is no article for the song form itself — `Thirty-two-bar form` exists but is a form, and this row is the repertory, the harmony and the trade together.", kind: "broader" },

  /* ---- WESTERN ART MUSIC, THE THREE HOLES THE TABLE NAMED --------------- */
  chorale:    { q: "Chorale", why: "Nuremberg 1586 is Osiander, and this article's own third bullet is what this row implements: a hymn tune \"presented in a homophonic or homorhythmic harmonisation, usually four-part harmony\". Not Chorale (disambiguation) and not Choir, which is the hatnote's own warning. Not `Lutheran chorale` either, which is the repertory of tunes rather than the four-part setting technique." },
  belcanto:   { q: "Bel canto", why: "Milan 1831 is Bellini's Norma at La Scala. The article is the singing style and the repertory together, which is what the anchor is — a long line over an accompaniment that gets out of its way. Not Opera, which is four centuries wide, and not Norma (opera), which is one work where this row is an idiom." },
  serial:     { q: "Twelve-tone technique", why: "Vienna 1923 is Schoenberg's op. 25, and this is the article for the METHOD — prime, inversion, retrograde and retrograde inversion — which is exactly what this row's operator schedule plays. Deliberately NOT `Serialism`, which is the wider postwar movement that took the method to duration and dynamics; the anchor implements the row and not the movement, and the key is a shortening rather than a claim." },

  /* ---- ARABIC ----------------------------------------------------------- */
  taqsim:     { q: "Taqsim", why: "Cairo 1932, the Congress of Arab Music. The article is the form itself and its first paragraph is this anchor's own argument — the improvisation starts in the lower ajnas of a maqam and climbs. Not `Taksim`, which is the disambiguation the article hatnotes to, and not `Taksim Square`." },
  firqa:      { q: "Firqa", why: "Cairo 1964 is Enta Omri. The article is this exact ensemble — \"a similar ensemble called takht typically comprised between two and five musicians, the firqa generally numbers eight or more\" — and it names Umm Kulthum in its own third paragraph. Not Firqa (military), which the hatnote warns about; not Umm Kulthum, which is the singer where this row is her band." },
  nuba:       { q: "Andalusi nubah", why: "Tetouan 1790 is al-Ha'ik's kunnash. `Nuba (music)` and `Andalusian classical music` both redirect here and the run follows them. The article is the SUITE — the thing this row is — where Andalusi music at large would be the tradition it sits inside. Not `Nuubaat`, which the hatnote sends the Algerian form to." },

  /* ---- CHINESE ---------------------------------------------------------- */
  guqin:      { q: "Guqin", why: "Beijing 1956, the Music Research Institute's qin survey. The article is the instrument and its repertory together, which is right for a row whose entire identity is one instrument played alone. Not `Guzheng`, which is the other Chinese zither and a different music; not Chinese music, which is a continent." },
  sizhu:      { q: "Jiangnan sizhu", why: "Shanghai 1920, the teahouse clubs. The article is this regional chamber tradition by name. Not `Sizhu`, which would be the wider silk-and-bamboo category across several provinces, and not Music of China." },

  /* ---- INDIAN ----------------------------------------------------------- */
  dhrupad:    { q: "Dhrupad", why: "Delhi 1955, the Dagar brothers at All India Radio. The article is the form — alap, then a composition in a long tala — and it is the older half of Hindustani art music, which is precisely the half this row models. Not `Hindustani classical music`, which is the tradition and would collapse the distinction between this row and the khyal this round refused to write." },
  carnatic:   { q: "Carnatic music", why: "Chennai 1935 is Ariyakudi's concert order. The article is the South Indian system as a whole, which is wider than the anchor — the row is one kacheri's shape — and it is the only honest target: `Kacheri` is not an article and `Kriti` is one item inside the concert. The link names the system; the label names the format.", kind: "broader" },

  /* ---- THE GENEALOGY ROUND (2026-08-29) --------------------------------- */
  gagaku:     { q: "Gagaku", why: "Nara 752 is the Tōdai-ji eye-opening ceremony; the article is the Japanese court tradition itself, whose own history section dates exactly that performance. Not Music of Japan, which is a country survey." },
  ziryab:     { q: "Ziryab", why: "Córdoba 822 is his documented arrival at the Umayyad court, and the article is the man and the school he founded — there is no article for Andalusi court song at this date and the founder IS how the tradition names its own origin (nuba's row one table over wants him by name).", kind: "artist" },
  dufay:      { q: "Nuper rosarum flores", why: "the anchor is one PIECE and one performance — Florence 1436, the Duomo consecration — and its article is that piece, the spem precedent exactly. Not Guillaume Du Fay, which is the composer's whole life; the row implements the motet's isorhythm, not the man.", kind: "work" },
  ballad:     { q: "Ballad", why: "London 1666 is Mrs Knipp singing Barbara Allen in Pepys's diary. The article is the narrative song form itself, whose lead is about exactly the Anglo-Scottish stock this row anchors. Not `Barbara Allen (song)` — a single song where the row is the tradition's shape — and not Ballade, the piano genre.", kind: "broader" },
  operaseria: { q: "Opera seria", why: "London 1724 is Giulio Cesare at the King's Theatre; the article is the genre by name, da capo machinery and all. Not Opera, which is four centuries wide; not Giulio Cesare, which is one work where this row is the format." },
  modinha:    { q: "Modinha", why: "Lisbon 1775 is Caldas Barbosa in the salons; the article is the Luso-Brazilian sentimental song by name and cites him in its own first paragraphs." },
  lundu:      { q: "Lundu (dance)", why: "Lisbon 1798 is the Viola de Lereno. Bare `Lundu` is a disambiguation (a Sarawak town is on it); the parenthesized article is the Afro-Brazilian dance-song this row is, music and dance being one article there." },
  lied:       { q: "Lied", why: "Vienna 1814 is Gretchen am Spinnrade; the article is the German art song itself. Not Art song, which is the international category, and not Franz Schubert, who is one master of it." },
  habanera:   { q: "Habanera (music)", why: "Havana 1860 is La Paloma. The title is a redirect and the run follows it to Contradanza, which is the honest landing: the article covers the Cuban contradanza AND its habanera offspring as one history, and there is no separate habanera article in this ZIM. The row is the cell; the article is the family that carried it.", kind: "broader" },
  spirituals: { q: "Spirituals", why: "Nashville 1871 is the Fisk Jubilee Singers' first tour; the article is the repertory itself and the Fisk story is in its own body. Not Gospel music, which is this row's CHILD one table over; not Fisk Jubilee Singers, which is the choir where the row is the music." },
  danzon:     { q: "Danzón", why: "Matanzas 1879 is Las alturas de Simpson, and the article dates exactly that premiere in its lead. The accent is the article title; the key drops it the way `forro` does." },
  maxixe:     { q: "Maxixe (dance)", why: "Rio de Janeiro 1895 is Corta-Jaca. Bare `Maxixe` is hatnoted against the Mozambican city and the gemstone; the parenthesized article is the Brazilian tango, dance and music in one." },
  cemilbey:   { q: "Tanburi Cemil Bey", why: "Istanbul 1910 is his Orfeon 78s; the run follows the redirect to the name Wikipedia files him under. An ARTIST anchor on the toto/steely precedent — the Ottoman instrumental tradition has no genre article in this ZIM and this player's records are the tradition's own reference recordings.", kind: "artist" },
  neworleans: { q: "Dixieland", why: "New Orleans 1923 is King Oliver's Creole Jazz Band; the run follows the redirect to Dixieland jazz, which is the article this music is filed under — its lead names the New Orleans ensemble style, the collective improvisation and the two-beat this row implements. `New Orleans Jazz` itself is a disambiguation page." },
  boogiewoogie: { q: "Boogie-woogie", why: "Chicago 1928 is Pine Top's Boogie Woogie, named in the article's own history section. Not Boogie, which is the later disco derivative; not Boogie rock." },
  deltablues: { q: "Delta blues", why: "Clarksdale 1929 is Pony Blues; the article is the regional style by name, Patton in its first paragraph. Not Blues, which is this row's CHILD in this table's own genealogy (Chicago 1952 declares Clarksdale as parent)." },
  hendrix:    { q: "Jimi Hendrix", why: "London 1967 is Purple Haze; an ARTIST anchor because the style has no other name — `Psychedelic rock` is a scene this table reaches through psychpop and the row is one guitarist's vocabulary.", kind: "artist" },
  glam:       { q: "Glam rock", why: "London 1971 is Get It On; the article is the genre by name and dates itself to exactly this record and this TV appearance. Not Glitter rock, which redirects here anyway; not T. Rex, which is one band." },
  krautrock:  { q: "Krautrock", why: "Cologne 1971 is Tago Mago; the article is the genre by name, Can in its first paragraphs. Not Kosmische Musik, which is the Berlin half — this table now holds that separately as berlinschool." },
  berlinschool: { q: "Kosmische Musik", why: "Berlin 1972 is Irrlicht. `Berlin School of electronic music` was tried FIRST and rejected by this file's own rule — in this ZIM it is a meta-refresh stub into Krautrock#Kosmische_Musik, a section, and a line in an article is not this row's article. Kosmische Musik is a real article, it is the name the Ohr label sold Schulze and Tangerine Dream under in exactly these years, and it is the honest width: wider than the Berlin sequencer school alone, narrower than krautrock, whose own separate article the `krautrock` row keeps.", kind: "broader" },
  phillysoul: { q: "Philadelphia soul", why: "Philadelphia 1972 is Back Stabbers; the article is the Gamble-and-Huff sound by name, Sigma Sound and MFSB in its body. Not Philadelphia International Records, which is the label where the row is the music." },
  quietstorm: { q: "Quiet storm", why: "Los Angeles 1975 is Smokey's album; the article is the format, and the album and the WHUR program that named it are both in its lead. Not A Quiet Storm, the album itself — the row is the format the record fathered." },
  moroder:    { q: "Giorgio Moroder", why: "Munich 1977 is I Feel Love; an ARTIST anchor on the eurythmics precedent — the producer is the genre, and `Eurodisco` is a wider basin this table reaches through italodisco. Not Donna Summer, who sang it: the row is the machine under her.", kind: "artist" },
  gothicrock: { q: "Gothic rock", why: "Northampton 1979 is Bela Lugosi's Dead, the article's own founding record. Not Goth subculture, which is the wardrobe; not Bauhaus (band), which is one act where the row is the genre they started." },
  italodisco: { q: "Italo disco", why: "Milan 1982 is Dirty Talk; the article is the genre by name. Not Eurodisco, the wider basin; not Spacer disco. The hyphenless spelling is the article's own." },
  miamibass:  { q: "Miami bass", why: "Miami 1986 is Throw the D; the article is the genre by name, the 808 sub culture its first paragraph." },
  newjackswing: { q: "New jack swing", why: "New York 1987 is I Want Her; the article is the genre by name and Teddy Riley is its own second sentence." },
  hardcorerave: { q: "Breakbeat hardcore", why: "Essex 1991 is Charly; the article is the breakbeat hardcore continuum by name — the music between acid house and jungle that this row anchors. Not Happy hardcore, which is one later fork; not Rave, which is a party and not a genre." },
  gfunk:      { q: "G-funk", why: "Los Angeles 1992 is Nuthin' but a 'G' Thang; the article is the genre by name, The Chronic its own centerpiece. Not West Coast hip hop, which is the region." },
  crunk:      { q: "Crunk", why: "Memphis 1997 is Tear da Club Up '97; the article is the genre by name, Three 6 Mafia and Lil Jon both in it. Not Crunkcore, the later screamo hybrid." },
  grime:      { q: "Grime music", why: "London 2003 is Boy in da Corner; the article is the genre (this ZIM files it at Grime music; `Grime (music genre)` redirects there and the run follows it). Not Dizzee Rascal, who is one MC." },
  dubstep:    { q: "Dubstep", why: "London 2005 is Midnight Request Line; the article is the genre by name and Croydon is in its first paragraph. Not Brostep, the 2010s American fork this row deliberately is not." },

  /* ---- THE DEBTS ROUND (2026-08-29) — thirty-seven anchors --------------- */
  mawsili:    { q: "Ishaq al-Mawsili", why: "Baghdad 800; the row is the Abbasid court school and Ishaq is its codifier and theorist — his article credits him with 'a comprehensive theoretical system for Arab music... without Ancient Greek influence' — where the Kitab al-Aghani, which documents the repertory, is a book about songs rather than the songs. THE SECOND CLAUSE OF THIS SENTENCE USED TO READ 'and Ziryab's own teacher' AND WAS FALSE, corrected 2026-08-30: this ZIM says Ziryab's teacher was Ishaq's FATHER Ibrahim ('the musician Ibrahim al-Mawsili was Ziryab's teacher'), and Ishaq's own article calls Ziryab a rival, not a pupil. The link is kept on Ishaq because the anchor is the SCHOOL and he is its theorist; whether Baghdad 800 should instead point at Ibrahim (742-804, Harun al-Rashid's favourite, and the year is his) is a named next ask, not a silent re-point.", kind: "artist" },
  kassia:     { q: "Kassia", why: "Constantinople 843; the earliest woman whose music survives under her own name, and the article is her. Not Kasos, where she died; not the Hymn of Kassiani alone, which has no article of its own in this ZIM.", kind: "artist" },
  sequence:   { q: "Sequence (musical form)", why: "St. Gallen 884 is Notker's Liber Hymnorum and the article is the liturgical form he wrote it for. Not Sequence (music), which is the harmonic technique; not Sequence alone, which is mathematics." },
  winchester: { q: "Winchester Troper", why: "the anchor is the manuscript pair itself — the earliest practical collection of polyphony — and the article is those manuscripts.", kind: "work" },
  hildegard:  { q: "Hildegard of Bingen", why: "Bingen 1151 is the Ordo Virtutum and the Symphonia; the row is chant by a named composer and the article is the composer.", kind: "artist" },
  josquin:    { q: "Josquin des Prez", why: "Venice 1502 is Petrucci's Misse Josquin, the first single-composer print; the row is Franco-Flemish polyphony at its height and the article is the man the market chose to prove it with.", kind: "artist" },
  monteverdi: { q: "Vespro della Beata Vergine", why: "Venice 1610 is this print — the row argues from the work, prima and seconda pratica in one binding, so the article is the work rather than Claudio Monteverdi at full career width.", kind: "work" },
  schutz:     { q: "Heinrich Schütz", why: "Dresden 1636 is the Musikalische Exequien; the row is the German concerted style he carried over the Alps and the article is the man — the Exequien's own article is one funeral, the row is the bridge from chorale to fugue.", kind: "artist" },
  contradanza:{ q: "Contradanza", why: "Havana 1803 is San Pascual Bailón; the article is the Cuban form by name and names it as habanera's parent in its own first lines. Not Contredanse, the European ballroom parent; not Habanera (aria), which is Bizet." },
  holler:     { q: "Field holler", why: "South Carolina 1853 is Olmsted's eyewitness print; the article is the work-song form by name, Lomax's recordings in its own text." },
  operetta:   { q: "Operetta", why: "London 1878 is H.M.S. Pinafore; the article is the light-opera form at full width, which is what `tinpanalley`'s paid want names. Savoy opera — the London form by name — was READ and passed over on the anchor's own scope: the row parents Tin Pan Alley through the form, not through one theatre." },
  musichall:  { q: "Music hall", why: "London 1892 is Marie Lloyd's Oh! Mr Porter; the article is the British form and its halls. Not Concert hall; not Music Hall (disambiguation)." },
  satie:      { q: "Erik Satie", why: "Paris 1888 is the Trois Gymnopédies; the row is named for the man and the article is the man. Not Gymnopaedia, the Greek festival the title puns on.", kind: "artist" },
  march:      { q: "March (music)", why: "Washington 1889 is The Washington Post; the article is the form by name. Not March the month; not The Washington Post the newspaper, nor its own march's article, which is one strain of the row." },
  broadway:   { q: "Show Boat", why: "New York 1927 is this opening night at the Ziegfeld; the row argues from the work that bolted song to story, so the article is the work — Broadway theatre is a street and Musical theatre is every century of it.", kind: "work" },
  territoryband: { q: "Territory band", why: "Kansas City 1932 is Moten Swing; the article is the circuit-band institution by name, VFW halls and one-nighters in its first paragraph." },
  stockhausen: { q: "Karlheinz Stockhausen", why: "Cologne 1956 is Gesang der Jünglinge at the WDR; the row is named for the man three anchors wanted by name, and the article is the man. The work's own article was the runner-up; the wants said stockhausen.", kind: "artist" },
  modaljazz:  { q: "Modal jazz", why: "New York 1959 is Kind of Blue; the article is the practice by name with that record as its own centerpiece." },
  brill:      { q: "Brill Building (genre)", why: "New York 1960 is Will You Love Me Tomorrow; this ZIM files the SOUND at Brill Building (genre) and the office building at Brill Building — the row is the sound, so the parenthesis is the whole link." },
  garagerock: { q: "Garage rock", why: "Portland 1963 is Louie Louie; the article is the genre by name. Not UK garage, which is the table's own `garage`; not Garage punk, the later fusion." },
  beachboys:  { q: "The Beach Boys", why: "Los Angeles 1966 is Pet Sounds; the anchor is named for the band and the article is the band.", kind: "artist" },
  psychrock:  { q: "Psychedelic rock", why: "San Francisco 1966 is the Trips Festival; the article is the genre by name. Not Acid rock, the heavier fork; not Psychedelia at large." },
  velvets:    { q: "The Velvet Underground", why: "New York 1966 is the Scepter sessions; the anchor is named for the band and the article is the band. Not the banana album's own article — the row is the band's drone-under-song idea, not one release.", kind: "artist" },
  zodiak:     { q: "Zodiak Free Arts Lab", why: "Berlin 1968; the article is the room itself, Schnitzler and Roedelius in its first sentence. A venue is none of this table's four kinds — broader is the nearest true word: the room contained the scene the row anchors.", kind: "broader" },
  winstons:   { q: "Amen break", why: "Washington 1969 is Amen, Brother; the article is the seven seconds the two paying rows (dnb, hardcorerave) actually wanted, with the band, the B-side and Coleman's four bars as its own subject. The Winstons' band article is the runner-up; the debt was the break.", kind: "work" },
  progrock:   { q: "Progressive rock", why: "Isle of Wight 1970 is ELP playing Mussorgsky with cannons; the article is the genre by name. Not Progressive rock (radio format)." },
  sabbath:    { q: "Black Sabbath", why: "Workington 1969 is the first show under the name — and the article is the band, whose own text supplies the date. Not Black Sabbath (album) or (song); the row is the act that founded the wing.", kind: "artist" },
  blockparty: { q: "Old-school hip hop", why: "Bronx 1973 is 1520 Sedgwick Avenue; this ZIM files the era at Old-school hip-hop and the run follows the hyphen. Not Hip hop music at fifty years' width; not DJ Kool Herc alone, who is the row's named performer rather than its music." },
  pfunk:      { q: "Parliament-Funkadelic", why: "Detroit 1975 is Mothership Connection; `P-Funk` redirects here and the collective is the row's subject. Not Psychedelic funk, the generic fork the hatnote separates.", kind: "artist" },
  ymo:        { q: "Yellow Magic Orchestra", why: "Tokyo 1978 is the first album with Firecracker; the anchor is named for the band and the article is the band.", kind: "artist" },
  nwobhm:     { q: "New wave of British heavy metal", why: "London 1980 is Iron Maiden's debut; the article is the movement by name. Not NWOBHM (EP), the Darkthrone tribute the hatnote warns about." },
  thrash:     { q: "Thrash metal", why: "San Francisco 1983 is Kill 'Em All; the article is the genre by name, NWOBHM and hardcore punk its own first stylistic origins — the row's exact parents and want." },
  triphop:    { q: "Trip hop", why: "Bristol 1991 is Blue Lines; the article is the genre by name with Bristol in its cultural-origins line." },
  chopped:    { q: "Chopped and screwed", why: "Houston 1995 is 3 'N the Mornin'; the article is the technique-become-genre by name, DJ Screw its own subject. Not the MC Breed album; not Chopped 'n' Skrewed, the T-Pain song." },
  synthwave:  { q: "Synthwave", why: "Paris 2010 is Nightcall; the article is the retro genre by name. Not Cold wave (music) or Minimal wave, which the hatnote separates — those are the 1980s term's other meanings." },
  footwork:   { q: "Footwork (genre)", why: "Chicago 2013 is Double Cup; the parenthesis is the whole link — Footwork alone is the dance and the disambiguation." },
  gqom:       { q: "Gqom", why: "Durban 2016 is Ice Drop; the article is the genre by name, Durban in its first line." },

  /* ---- THE DEEP-TIME ROUND (2026-08-30) — eight anchors ------------------
     Every row below links a NAMED ARTIFACT or NAMED NOTATED PIECE, because
     that is what each anchor is argued from; none of the eight is a "genre"
     in Wikipedia's filing and the kinds say so. */
  // `Hohle Fels Flute` was tried FIRST and rejected by the run itself: in
  // this ZIM it is a meta-refresh stub onto Paleolithic_flute#Early_flutes —
  // a SECTION, not an article — which is this file's own counterpoint rule.
  // The group article is the honest fallback and the flute is its subject's
  // centrepiece; `Hohle Fels` alone is the cave and mostly the Venus.
  hohlefels:  { q: "Paleolithic flutes", why: "Hohle Fels 33000 BC is the griffon-vulture-radius flute with five finger holes; its own title is a section redirect in this ZIM, so the link is the Aurignacian flute group whose article carries the find, the dating and the cave by name.", kind: "broader" },
  jiahu:      { q: "Gudi (instrument)", why: "Jiahu 6000 BC is the crane-bone flutes as playable INSTRUMENTS — the 1999 Nature blowing test is this article's own subject matter — so the instrument article wins over `Jiahu`, the site survey (millet, proto-writing, fermentation), which mentions the flutes in passing.", kind: "broader" },
  urlyre:     { q: "Lyres of Ur", why: "Ur 2500 BC is these four instruments from the Royal Cemetery — Golden, Queen's, Silver and Bull-Headed, each named with its museum in the article's own first lines — and the article is exactly them.", kind: "work" },
  hurrian:    { q: "Hurrian songs", why: "Ugarit 1400 BC is tablet h.6 and its siblings; the article is the tablet collection by name, with h.6, the nid qabli colophon and the five rival readings all in its own text. There is no separate article for h.6 alone in this ZIM.", kind: "work" },
  delphic:    { q: "Delphic Hymns", why: "Delphi 128 BC is the two paeans on the Treasury wall and the article is those two pieces, composers named in its first section.", kind: "work" },
  carmen:     { q: "Carmen Saeculare", why: "Rome 17 BC is Horace's hymn for the Ludi Saeculares and the article is the poem-and-performance itself, the acta inscription in its own text. Not Horace at full career width; not Secular Games, which is the festival around it.", kind: "work" },
  seikilos:   { q: "Seikilos epitaph", why: "Tralles 100 is the stele itself — the oldest complete surviving composition — and the article is the stele, its melody transcribed in the article's own body.", kind: "work" },
  oxyrhynchus:{ q: "Oxyrhynchus hymn", why: "Oxyrhynchus 300 is P.Oxy. XV 1786 and the article is that papyrus — the oldest notated Christian music, its diatonic octave and anapaestic metre in its own description. Not Oxyrhynchus, the town and its whole papyrus hoard.", kind: "work" },

  /* ---- THE SAME ROUND'S FORWARD HALF (2026-08-30) — seven anchors -------- */
  hardcore:   { q: "Hardcore punk", why: "Washington 1980 is Pay to Cum; the article is the genre by name with Bad Brains and D.C. in its own history. Not Hardcore (the disambiguation), not Breakbeat hardcore, which is the table's own hardcorerave." },
  // The genre's own names were tried FIRST and both rejected by the run's
  // own rules: `Honky-tonk` is a DISAMBIGUATION page in this ZIM and
  // `Honky-tonk music` is a meta-refresh stub onto Honky-tonk#Music — a
  // section, not an article. The named performer is the jodeci/toto
  // precedent and the honest remainder.
  honkytonk:  { q: "Ernest Tubb", why: "Fort Worth 1941 is Walking the Floor Over You and the article is the man who cut it — the Texas Troubadour whose electric barroom band is this row's whole cast; the genre's own titles resolve to a disambiguation and a section stub in this ZIM, and a wrong link is worse than a narrower true one.", kind: "artist" },
  westernswing: { q: "Western swing", why: "Tulsa 1940 is New San Antonio Rose from the Cain's Ballroom band; the article is the genre by name, Wills its own centerpiece." },
  dreampop:   { q: "Dream pop", why: "London 1984 is Treasure; the article is the genre by name and the Cocteau Twins are in its first lines. Not Shoegaze, the table's own child row." },
  doom:       { q: "Doom metal", why: "Stockholm 1986 is Epicus Doomicus Metallicus, the record whose title names the article's subject. Not Doom (the game); not Candlemass alone, who are the row's named performers." },
  jpop:       { q: "J-pop", why: "Tokyo 1999 is First Love; the article is the genre by name, the J-WAVE coinage in its own history. Not City pop, the table's own upstream row on the same dot." },
  dunstaple:  { q: "John Dunstaple", why: "London 1420 is the Old Hall Manuscript, but the ROW is the contenance angloise — the sound the continent named for this man, which is how dufay's want spelled it — so the article is the man. Old Hall Manuscript was read and passed over for the same reason schutz links Schütz and not the Exequien: the row is the practice he names, not one book of it.", kind: "artist" },

  /* ---- THE GOTH-AND-GLOBE ROUND (2026-08-30) ---------------------------- */
  deathrock:  { q: "Deathrock", why: "Pomona 1982 is Only Theatre of Pain; the article is the genre by name, Christian Death first in its own list of bands, Los Angeles its stated origin. Not to be confused with Death metal — the article's own hatnote says so." },
  batcave:    { q: "Batcave (club)", why: "London 1982 is 69 Dean Street, opened 21 July 1982; the article is the club-night itself, 'the birthplace of the Southern English goth subculture' in its own lead, with Specimen running it. Not Batcave, which is Batman's cellar. A venue is none of this table's four kinds — broader is the nearest true word, the zodiak ruling.", kind: "broader" },
  coldwave:   { q: "Cold wave (music)", why: "Rennes 1979 is Dantzig Twist; the article is the European post-punk sub-genre — late 1970s France, Poland and Belgium in its own lead. Not Cold wave, the weather article, and not the American coldwave its hatnote points at (a 1990s industrial-metal scene)." },
  sisters:    { q: "The Sisters of Mercy", why: "York 1981 is the first datable show of the definitive formation — the article's own account — and the anchor is this band's chassis: Doktor Avalanche under two guitars and a baritone. Not Sisters of Mercy, the religious organisation, which the article's hatnote separates.", kind: "artist" },
  gothicmetal: { q: "Gothic metal", why: "Halifax 1991 is Paradise Lost's Gothic, the record whose title names the article's subject; origins heavy metal, gothic rock and death-doom in its own infobox, early 1990s United Kingdom." },
  dungeonsynth: { q: "Dungeon synth", why: "Notodden 1994 is Mortiis's Født til å Herske; the article is the genre by name — dark ambient and black metal origins, early 1990s Norway, Mortiis in its own text." },
  witchhouse: { q: "Witch house", why: "Traverse City 2010 is Salem's King Night; the article is the genre (the electronic microgenre, its own hatnote separating other witch houses), chopped and screwed first in its stylistic origins. The label follows the named record; the article's own scene dating (c. 2006-2007) is in the row's comment." },
  gypsyjazz:  { q: "Gypsy jazz", why: "Paris 1934 is the Quintette du Hot Club de France's first Ultraphone session and the article's own dating is 'c. 1934, Paris'. Wikipedia files the music here rather than at jazz manouche, which settled the row's key." },
  latinjazz:  { q: "Latin jazz", why: "New York 1947 is Manteca; the article is the genre by name. It is WIDER than the row — it covers the Afro-Brazilian branch too — but it is the article that names this music, the same ruling blues and house take." },
  descarga:   { q: "Descarga", why: "Havana 1957 is Cachao's Panart jam session; the article is the genre by name — son cubano, rumba and mambo origins, the Havana scene of the mid-1950s in its own infobox." },
  capejazz:   { q: "Cape jazz", why: "Cape Town 1974 is Mannenberg, whose own article files it as Cape jazz; the genre article names Cape Town and lists marabi in its topics, which is the row's dominant parent." },
  tradjazz:   { q: "Trad jazz", why: "London 1954 is the Chris Barber Band's New Orleans Joys; the article is the British revival by name — Humphrey Lyttelton in its own images — and not Dixieland, which its hatnote sends the ORIGINAL style to (that is the table's neworleans)." },
  indojazz:   { q: "Indo jazz", why: "London 1966 is the Harriott-Mayer Indo-Jazz Suite (Atlantic); the article is the genre by name, jazz and Indian classical music its stated origins." },
  japanjazz:  { q: "Japanese jazz", why: "Tokyo 1974 is the Tsuyoshi Yamamoto Trio's Midnight Sugar on Three Blind Mice; the article is the genre by name (Jazz in Japan redirects here), a jazu kissa in its own lead photographs." },
  nordicjazz: { q: "Nordic jazz", why: "Oslo 1970 is Afric Pepperbird, the Jan Garbarek Quartet at Bendiksen for ECM; the article is the genre by name — jazz, Nordic folk music and modal jazz its stated origins, 1960s-1970s Scandinavia." },
  skokiaan:   { q: "Skokiaan", why: "Bulawayo 1947 is the record itself — August Musarurwa's tune, cut by the Cold Storage Commission's band in the tsaba-tsaba style the article says succeeded marabi. The winstons ruling: tsaba-tsaba has no article in this ZIM and the honest row is the record, so the link is the song's own article.", kind: "work" },

  /* ---- THE DOWNTEMPO ROUND (2026-08-30) ---------------------------------
   * Twelve anchors; the ruling that matters is at the round header in
   * genres.js: Blue Lines is `triphop`'s anchor, so Massive Attack's own
   * row anchors on Mezzanine and the two rows never claim one record.
   * Ten of the twelve are artist rows and link the act, the velvets/
   * sisters precedent — Wikipedia has no article for "the Portishead
   * sound", and the band article is the honest subject. */
  acidjazz:   { q: "Acid jazz", why: "London 1988 is Galliano's Frederick Lies Still, Acid Jazz AJ001 — the article's own origin sentence: 'originated in clubs in London during the 1980s with the rare groove movement'. The genre article exists and names the Brand New Heavies scene, so no band link is needed." },
  kruderdorfmeister: { q: "Kruder & Dorfmeister", why: "Vienna 1993 is G-Stoned, recorded at G-Stone Studio per the ZIM's own infobox. The anchor is named for the duo and the article's first line is this row's sound — 'trip hop/downtempo'. Not the K&D Sessions, a remix album of other people's records.", kind: "artist" },
  portishead: { q: "Portishead (band)", why: "Bristol 1994 is Dummy. The bare `Portishead` is the Somerset town the band is named for — the parenthetical article is the band, and the band is the subject: Barrow, Gibbons, Utley, the torch song on a turntable.", kind: "artist" },
  tricky:     { q: "Tricky (musician)", why: "Bristol 1995 is Maxinquaye. The bare `Tricky` is an adjective; the ZIM files the man at Tricky (rapper) and the run follows that redirect. Born and raised in Bristol, an early member of Massive Attack — the article's own first paragraph is this row's argument.", kind: "artist" },
  morcheeba:  { q: "Morcheeba", why: "London 1996 is Who Can You Trust? (Indochina, 1 April 1996, the ZIM's infobox). The anchor is named for the band and the article is the band — the Godfrey brothers and Skye Edwards, the slide guitar over the loop.", kind: "artist" },
  lamb:       { q: "Lamb (electronic band)", why: "Manchester 1996 is Lamb (Fontana, 30 September 1996). The bare `Lamb` is the animal; the parenthetical article is the duo, and its own lead names this row's three parents — trip hop, drum and bass and jazz.", kind: "artist" },
  djshadow:   { q: "DJ Shadow", why: "San Francisco 1996 is Endtroducing....., cut at The Glue Factory per the album article's infobox. The man's article, not the album's: only one row anchors on his work, so the work-link precedent (roboticpop) does not apply.", kind: "artist" },
  thieverycorporation: { q: "Thievery Corporation", why: "Washington 1996 is Sounds from the Thievery Hi-Fi, first released 1996 per the album article. The anchor is named for the duo; the article's own lead lists this row's shelf — dub, acid jazz, bossa nova — and its guest singers.", kind: "artist" },
  air:        { q: "Air (French band)", why: "Versailles 1998 is Moon Safari. The bare `Air` is the atmosphere; the parenthetical article is the duo, and its first line — 'a French music duo from Versailles' — is the dot's own justification.", kind: "artist" },
  massiveattack: { q: "Massive Attack", why: "Bristol 1998 is Mezzanine — NOT Blue Lines, which is `triphop`'s anchor (a record pays one debt; the ruling is at the round header). The band article rather than the album: no second Massive Attack row exists for a band link to erase, so the roboticpop work-link precedent does not apply.", kind: "artist" },
  stgermain:  { q: "St Germain (musician)", why: "Paris 2000 is Tourist, on Blue Note. The bare `St Germain` is a Paris quarter and a count; the parenthetical article is Ludovic Navarre, whose style the lead gives as 'house music and nu jazz' — this row exactly.", kind: "artist" },
  royksopp:   { q: "Röyksopp", why: "Tromsø 2001 is Melody A.M. (Wall of Sound, 13 September 2001). The diaeresis is the filing, the Forró lesson again; the article's first line — 'a Norwegian electronic music duo from Tromsø' — is the dot, per the Kinks/Pomona rule.", kind: "artist" },

  /* ---- THE FOLK-FLOOR ROUND (2026-08-30) -------------------------------- */
  shanty:     { q: "Sea shanty", why: "London 1961 is Stan Hugill's Shanties from the Seven Seas, the last working shantyman's own collection; the article is the work-song genre it documents. Not Shanty (a hut)." },
  appalachia: { q: "Appalachian music", why: "Hot Springs 1916 is Cecil Sharp collecting from Jane Gentry — the ballad half of exactly this article's subject. There is no separate article for Appalachian balladry; the regional-music article is the honest width, and `oldtime` one row over holds the string-band half." },
  oldtime:    { q: "Old-time music", why: "Galax 1935 is the first Old Fiddlers' Convention, which the article's own genre this row is; NOT Country music, which is `countrypop`'s link and this row's child." },
  klezmer:    { q: "Klezmer", why: "New York 1923 is Naftule Brandwein's Victor sides; the article is the tradition those records carried onto shellac. Unambiguous." },
  georgian:   { q: "Chakrulo", why: "the anchor is argued from one recording — the Radio Tbilisi Chakrulo of 1966, the cut NASA sealed onto the Voyager Golden Record — and the article is that song, the spem one-piece precedent. Music of Georgia (country) is a survey, the bulgarian row's own rejection.", kind: "work" },
  nordicfolk: { q: "Ludvig Mathias Lindeman", why: "Oslo 1853 is the first volume of Lindeman's Ældre og nyere norske Fjeldmelodier, and the article is its collector — 'most noted for compiling Norwegian folk music', its own lead. There is no article for the Norwegian medieval ballad as a genre in this ZIM.", kind: "artist" },
  chanson:    { q: "Chanson réaliste", why: "Paris 1936 is Piaf's first Polydor sides and the article is the street-song style they belong to. NOT Chanson, which covers eight centuries and would make the row an umbrella." },
  taraf:      { q: "Lăutari", why: "Clejani 1986 is the village taraf on the Ocora tapes; the article is the musician class whose trade the row is — the Crooner precedent, a music filed under its performers. Taraf de Haïdouks is the same players five years later under a Belgian label's name, and linking the band would date the row wrong.", kind: "genre" },
  flamenco:   { q: "Flamenco", why: "Granada 1922 is the Concurso de Cante Jondo; the genre article, not Cante jondo (a subset) and not the Concurso article (an event this row is dated by, not the music itself)." },
  mbuti:      { q: "Pygmy music", why: "Epulu 1958 is Colin Turnbull's Ituri recordings; the article is the hocket-and-yodel polyphony of the Central African foragers, which is precisely this row's subject. Mbuti alone is the people, not the music." },
  nursery:    { q: "Nursery rhyme", why: "London 1744 is Tommy Thumb's Pretty Song Book, the oldest surviving printed collection; the genre article rather than the book's own, because the row is the tradition and the book is its earliest dated artifact." },
  polka:      { q: "Polka", why: "Prague 1837 is the ballroom craze's own documented arrival; unambiguous — the article is the dance music, and this table casts the band, not the steps (the tango ruling)." },
  cajun:      { q: "Cajun music", why: "New Orleans 1928 is Joe Falcon's Allons à Lafayette, the first Cajun record and this article's own opening fact. Not Zydeco, which is the neighbour row this one now parents." },
  tarantella: { q: "Pizzica", why: "Galatina 1959 is De Martino and Carpitella taping the tarantate; the article is the Salento form those reels hold. NOT Tarantella, which is the wider Italian family including the polite Neapolitan ballroom version — the key keeps the familiar word, the link keeps the honest one." },
  // Sean-nós singing was TRIED and rejected by this file's own guard: its
  // lead paragraph ends "the term can also refer to sean-nós dance", which
  // trips DISAMB — a false positive, but the guard errs closed on purpose
  // and the singer is the honest subject anyway (the Kinks precedent).
  seannos:    { q: "Joe Heaney", why: "Carna 1957 is Seosamh Ó hÉanaí's first Gael-Linn sides and the article is that singer — 'an Irish traditional (sean nós) singer from Connemara', its own first line. `Sean-nós singing` trips the disambiguation guard on its own lead's closing sentence, and a guard that errs closed stays closed.", kind: "artist" },
  barbershop: { q: "Barbershop music", why: "New York 1910 is the American Quartet's Play That Barber Shop Chord (Victor); the genre article, not Barbershop quartet (the ensemble format) and not A cappella (the wider texture)." },
  // Photoplay music was TRIED and rejected by the music guard: its one-line
  // lead is under the 140-character floor, so the derivation reads the next
  // paragraph, which says "repertory" where the guard knows "repertoire" —
  // errs closed, stays closed. The composer the row already names is the
  // honest subject, and his lead says "photoplay music" in quotation marks.
  photoplay:  { q: "J. S. Zamecnik", why: "Cleveland 1913 is Zamecnik's Sam Fox Moving Picture Music vol. 1, and the article is its composer — 'best known for the photoplay music he composed for use during silent films', the lead's own words. `Photoplay music` exists but fails this file's own lead-paragraph guard; the artist link is the Kinks precedent.", kind: "artist" },
  korngold:   { q: "Erich Wolfgang Korngold", why: "Los Angeles 1938 is The Adventures of Robin Hood; there is no article for the golden-age orchestral score as a genre (Film score is a craft survey), so the row links the composer whose Oscar made the idiom a profession — the Kinks/artist precedent.", kind: "artist" },
  herrmann:   { q: "Bernard Herrmann", why: "Los Angeles 1960 is Psycho's string score; no genre article exists for the modernist suspense score, so the row links its composer — 'best known for his work in composing for films', the lead's own words.", kind: "artist" },
  morricone:  { q: "Ennio Morricone", why: "Rome 1966 is Il buono, il brutto, il cattivo, scored at RCA Italiana; Spaghetti Western is a film article, not a music one, so the row links the composer the way korngold and herrmann do.", kind: "artist" },
  barry:      { q: "James Bond Theme", why: "London 1962 IS this record — Monty Norman's tune in John Barry's arrangement, CTS Studios, June 1962 — and the article is that piece, the spem/roboticpop one-work precedent. Linking John Barry would blur which desk the row anchors; linking Monty Norman would restart a lawsuit.", kind: "work" },
  carpenter:  { q: "John Carpenter", why: "Los Angeles 1978 is Halloween, scored by its director; the film's article is a picture, not a music, and the score has no article of its own, so the row links the composer — whose lead names him a composer in its first sentence.", kind: "artist" },
  miamivice:  { q: "Jan Hammer", why: "Miami 1984 is the Miami Vice pilot score; the show's article fails the music test on its face (a crime drama), and Crockett's Theme has no article in this ZIM, so the row links the man at the Fairlight — the Kinks/artist precedent.", kind: "artist" },
  sitcom:     { q: "Where Everybody Knows Your Name", why: "Los Angeles 1983 IS this record — the Cheers main title, Portnoy/Hart Angelo — and the article is that song, the one-work precedent. Theme music is a two-line generality and Sitcom is television, not music.", kind: "work" },

  /* ---- THE WALLS-DOWN ROUND (2026-08-30) — eight exemplars for the five
     felled walls; every target below was probed against this ZIM before
     the anchor was written, which is why two labels moved off the famous
     names (jingju to the 1918 premiere, gamelan to Lokananta). */
  waltz:      { q: "Waltz", why: "Vienna 1867 is the Blue Danube's premiere (the piece's own article dates it to the 15th of February 1867 at a Wiener Männergesang-Verein concert), but the anchor is the GENRE, not one piece — `Viennese waltz` in this ZIM is a ballroom-dance article ('a form of ballroom dance'), so the music links the parent form, whose own lead carries the triple time this row finally counts." },
  musette:    { q: "Bal-musette", why: "Paris 1880 is the article's own dating — 'first became popular in Paris in the 1880s' — and its lead carries both facts the row is built on: the bagpipe rooms, and the accordion that replaced them. Émile Vacher and Charles Péguri are the players it names for the era." },
  tarab:      { q: "Tarab", why: "Cairo 1934 is Umm Kulthum on the Egyptian Radio's inaugural broadcast (her own article's sentence). The article is the CONCEPT — the listening culture whose feedback loop the row's cannot admits it cannot close — 'applied to a style of music and musical performance in which such emotional states are evoked', which is wider than one singer and narrower than Arabic music. Not Umm Kulthum: firqa's row already ruled the singer is not the music. Not Arabic maqam, which is the theory this row's ALPHABET cites.", kind: "broader" },
  dastgah:    { q: "Dastgah", why: "Tehran 1925 is Qamar-ol-Moluk Vaziri's first sides (her article dates them); the run follows the redirect to Dastgāh, 'the standard musical system in Persian art music' — the system itself, which is what the anchor claims: shur with its koron second, sayable since cents landed. Not Radif (music), which is the pedagogical repertory the row's cannot admits it does not hold." },
  jingju:     { q: "Peking opera", why: "Beijing 1918 is the Hegemon-King premiere — the play's article says 'initially performed by Yang Xiaolou and Shang Xiaoyun in 1918 in Beijing' — and the genre article is the form itself, whose banshi this anchor writes as a paces row. The label sits on the ZIM-dated performance rather than on Mei Lanfang's fame; his 1922 revision is in the anchor's comment where a fact that is not a date belongs." },
  khyal:      { q: "Khyal", why: "Mumbai 1965 is Amir Khan's LP decade (his article has him in Bombay from 1934 and the honours dating the sixties peak); the article is the form — 'a major form of Hindustani classical music' — and its own lead separates it from dhrupad, which is precisely the distinction the dhrupad row's why preserved when this row was still refused." },
  gamelan:    { q: "Gamelan", why: "Surakarta 1956 is Lokananta — 'established on 29 October 1956 at Surakarta', the first record label of Indonesia, whose own article calls its gamelan holdings the biggest collection there is — and the genre article is the ensemble tradition itself. Not Slendro, which is the tuning the row's MODES key cites; not Gamelan gong kebyar, which is the Balinese branch this Javanese label year does not claim." },
  tapemusic:  { q: "Musique concrète", why: "Paris 1948 is Schaeffer's Cinq études de bruits on the RTF, and the article is the tradition itself, whose first sentence is about composing with recorded sound — the premise the sampling round made partly sayable and the row's cannot prices honestly. Not Tape music, which this ZIM treats as the broader Anglo studio practice; not Pierre Schaeffer, the man where this row is the method." },

  /* THE LEDGER ROUND, 2026-08-30 — eleven rows, each probed against this
     ZIM before its anchor was written (the gamelan/jingju method). */
  hammerhorror: { q: "James Bernard (composer)", why: "Bray 1958 is Bernard's score for Hammer's Dracula, shot at Bray Studios, and the composer is the honest musical subject this ZIM holds: no genre article exists for the scoring school ('Hammer horror' is the studio's brand, `Hammer Film Productions` a company page — the muzak wall), and the film's own article was probed and refused by the extractor as not about music. The man's article IS about the scores.", kind: "artist" },
  idm:        { q: "Intelligent dance music", why: "Sheffield 1992 is Warp's Artificial Intelligence compilation — the Warp Records article dates the label to Sheffield 1989 and says the 1992 compilation 'helped establish intelligent dance music' — and the genre article is the subject, whose own lead carries the home-listening clause the row's family filing cites." },
  exotica:    { q: "Exotica", why: "Honolulu 1957 is Martin Denny's Exotica (his article: recorded December 1956, released 1957, by the combo playing the Shell Bar at the Hawaiian Village on Oahu), and the genre article opens by dating the term to that album's name. Not Martin Denny, the man where this row is the genre; not Quiet Village, one tune with two owners (Baxter 1951, Denny 1957)." },
  muwashshah: { q: "Muwashshah", why: "Cairo 1200 is Ibn Sanā' al-Mulk's Dār aṭ-ṭirāz — his article calls it 'the most complete contemporary description of the genre' — and the form's own article carries the Andalusi origin and the fact the row stands on: 'it was sung and performed musically.' Not Ibn Sanā' al-Mulk, the anthologist where this row is the form." },
  zajal:      { q: "Zajal", why: "Córdoba 1150 is Ibn Quzman's dīwān — the Zajal article's own first dated fact ('the earliest recorded zajal poet was Ibn Quzman of al-Andalus who lived from 1078 to 1160') — and the article is the strophic vernacular form itself. Not Ibn Quzman, the poet where this row is the song." },
  soundsystem: { q: "Sound system (Jamaican)", why: "Kingston 1950 is Tom the Great Sebastian — the sound system article's own culture, and Tom's article dates Tom Wong's system to 1950 and calls it 'the all-time giant of sound systems'. The article is the practice: the stacks, the exclusives, the deejay — which is what the anchor claims, on the blockparty precedent." },
  jubilee:    { q: "Fisk Jubilee Singers", why: "Nashville 1909 is the group's own recording of Swing Low, Sweet Chariot — the article's first paragraph carries the National Recording Registry honour and the date — and no separate article for the jubilee-quartet school exists in this ZIM; the group IS the school's founding institution.", kind: "artist" },
  rumba:      { q: "Cuban rumba", why: "Matanzas 1956 is Los Muñequitos de Matanzas' first LP on Puchito (their article's own dates: founded 1952 as Conjunto Guaguancó Matancero, first LP 1956), and the genre article is the street form itself — voices, tumbadoras, claves. Not Guaguancó, one of the three styles; not the band, where this row is the music." },
  lautari:    { q: "Lăutari", why: "Bucharest 1906 is Grigoraș Dinicu's Hora staccato — his article dates the showpiece and files him under 'Lăutărească music', born in Scaune, 'the neighborhood of the lăutari' — and the Lăutari article is the hereditary guild itself, which is what the anchor claims. Not Dinicu, the guild's most famous son." },
  doina:      { q: "Doina", why: "Maramureș 1912 is Bartók's collecting year — the article's own sentence: 'Béla Bartók discovered the doina in Northern Transylvania in 1912' — and the article is the form: free-rhythm, melismatic, compared by the article itself to the taksim, which is the row's own near." },
  chazzanut:  { q: "Hazzan", why: "New York 1912 is Yossele Rosenblatt's arrival at Ohab Zedek, Harlem — his article dates the post and the 78-era fame that followed — and the Hazzan article is the office and its art, which is what klezmer's want ('the cantorial nusach') names. Not Nusach, the liturgical-rite article that never reaches the throat; not Rosenblatt, the man where this row is the art.", kind: "broader" },

  /* THE UNLOCKING ROUND, 2026-08-30 — four refusals defeated, and each
     target was probed HERE before its anchor was written, the same order
     the gamelan/jingju method set. Two of the four link a PERSON where
     the obvious genre title fails a test this extractor already runs. */
  qiyan:      { q: "Azza al-Mayla", why: "Medina 705 is her own death year and her own city — 'Azza al-Mayla (7th-century - d. 705) was a Medinan Qiyan musician, composer, singer, poet and teacher', the whole label in one clause. NOT `Qiyan`, and the reason is this extractor's own MUSICAL test: that article is filed under forced labour and slavery and its lead is 'a social class of women, trained as entertainers' — the institution, correct and not about music, where this anchor is a singer and a repertory. The named woman IS how this tradition survives being named.", kind: "artist" },
  hardingfele: { q: "Myllarguten", why: "Oslo 1849 is Ole Bull's Christiania concert with him — his article dates it to February 1849 and counts the 1500 in the hall — and the man is the honest subject the way `nordicfolk` links Lindeman rather than a genre. NOT `Hardanger fiddle`, which is an INSTRUMENT article (bridges, understrings, twenty tunings) where this row is a repertory; NOT `Slått`, which 404s, nor `Slatt`, which is an empty stub in this ZIM — a title with no body.", kind: "artist" },
  tasnif:     { q: "Tasnif", why: "Tehran 1924 is Qamar singing Morq-e sahar at a Tehran hotel (that song's article dates the performance), and the form's own article is the subject: 'one of the several forms of Persian music... a composed song in a slow metre', with the constitutional-era wave this label sits inside named in its own third paragraph. Not Morq-e sahar, one song where this row is the form; not Dastgah, which is the row next door's link and a different music." },
  scotsfiddle: { q: "Scottish fiddling", why: "Edinburgh 1796 is Nathaniel Gow's publishing firm at 41 North Bridge (his article's own sentence), but the anchor is the TRADITION, not the man — the appalachia precedent, where Sharp's collecting year labels a row that links Appalachian music. The article is the playing style itself, 'distinguished from other folk fiddling styles by its particular precision of execution', and it names both Gows in its own body. Not Niel Gow, the father whose collections this ZIM cannot date; not Strathspey, which is a disambiguation page here (a Highland district and a shinty team are on it)." },
};

/* ---------------------------------------------------------------------------
 * NOLINK — ANCHORS THAT GET NO LINK, WITH THE REASON, ON PURPOSE.
 *
 * A wrong link is worse than none, so an anchor whose article cannot be found
 * with confidence is declared here rather than pointed at the nearest word that
 * looks like it. These are printed as MISSES in wiki.js and in WIKI.md, and the
 * page shows the title with no link at all.
 * ------------------------------------------------------------------------ */
const NOLINK = {
  retrofunkpop: "Los Angeles 2013 — the 2010s retro-funk pop revival has no article of its own in this ZIM. `Retro-funk` redirects to Funk, which is already this row's own parent and a different, older music; Nu-disco is disco's revival, not funk's. The nearest honest targets are individual singles (Treasure, Uptown Funk), and a genre row does not link a single.",
  synthduo: "London 1985 — the anchor's comment names no act, only the field that separates it from `synthpop` (legato where synthpop is staccato). There is no article for a two-person synth act as a genre, `Synth-pop` belongs to the row it separates FROM, and guessing at Erasure or the Pet Shop Boys would be inventing a fact the table does not hold.",
  seinfeld: "Los Angeles 1989 — the composer is the honest subject and this ZIM cannot name him: `Jonathan Wolff` is a disambiguation page (a philosopher shares the name) and `Jonathan Wolff (composer)` is not an article here. `Seinfeld` is a television article whose lead never reaches music, and the slap-bass sting has no article of its own. A wrong link is worse than none.",
};

/* ---------------------------------------------------------------------------
 * THE ZIM
 * ------------------------------------------------------------------------ */
function get(p) {
  return new Promise((res, rej) => {
    const req = http.get({ host: HOST, port: PORT, path: p }, (r) => {
      let b = ""; r.setEncoding("utf8");
      r.on("data", (d) => (b += d));
      r.on("end", () => res({ code: r.statusCode, loc: r.headers.location, body: b }));
    });
    req.on("error", rej);
    req.setTimeout(20000, () => { req.destroy(new Error("timeout")); });
  });
}
/* PERCENT-ENCODE, and leave `&` and `'` ENCODED on purpose. Wikipedia's own
 * canonical URL for Contemporary R&B carries a bare ampersand, but this string
 * ends up in an href, and a bare `&` in markup is the start of an entity. %26
 * resolves identically at en.wikipedia.org and at kiwix (both checked), and it
 * cannot be mis-escaped by whoever writes the anchor. The four that ARE put
 * back are the ones Wikipedia titles use structurally — `Electro_(music)`,
 * `Spem_in_alium` — and that no HTML context can misread. */
const enc = (t) => encodeURIComponent(t).replace(/%3A/g, ":").replace(/%2C/g, ",")
  .replace(/%21/g, "!").replace(/%28/g, "(").replace(/%29/g, ")");
const under = (t) => t.trim().replace(/ /g, "_");

/* Kiwix serves a REDIRECT TO A #FRAGMENT as a tiny meta-refresh page rather
 * than a 302 — that is how "Melodic techno" (-> Styles_of_house_music#M) hides
 * from an HTTP-status-only check. Both kinds are followed; a fragment target is
 * caught by the caller, because a section of a list is not this genre's
 * article. */
const META = /<meta[^>]+http-equiv="refresh"[^>]+URL='\.\/([^']+)'/i;

/** Strip markup to text. Hatnotes go FIRST: "For Ethiopian liturgical chant,
 *  see…" on the planthopper page would otherwise satisfy MUSICAL. */
function plain(body) {
  let s = body;
  const i = s.indexOf("<section"); if (i > 0) s = s.slice(i);
  return s
    .replace(/<div[^>]*class="[^"]*hatnote[^"]*"[\s\S]*?<\/div>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<table[\s\S]*?<\/table>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/\[\s*\d+\s*\]/g, " ")
    .replace(/\s+/g, " ").trim();
}

/** The first <p> in the article body with at least 140 characters of prose in
 *  it. Anything shorter is a caption or a one-line stub, and a page with none
 *  at all is a list — which is what a disambiguation page is. */
function firstPara(body) {
  let s = body;
  const i = s.indexOf("<section"); if (i > 0) s = s.slice(i);
  s = s.replace(/<div[^>]*class="[^"]*hatnote[^"]*"[\s\S]*?<\/div>/gi, " ")
       .replace(/<style[\s\S]*?<\/style>/gi, " ")
       .replace(/<script[\s\S]*?<\/script>/gi, " ")
       .replace(/<table[\s\S]*?<\/table>/gi, " ");
  const paras = s.match(/<p\b[\s\S]*?<\/p>/gi) || [];
  for (const p of paras) {
    const t = plain(p);
    if (t.length >= 140 && !/^This article is issued from Wikipedia/i.test(t)) return t;
  }
  return null;
}

/** Ask the ZIM for a title. Returns the canonical title, its lead, or a reason
 *  it is not usable. Nothing here is a guess: every branch is a fact about what
 *  the ZIM served. */
async function resolve(q) {
  let title = under(q), seen = [];
  for (let hop = 0; hop < 8; hop++) {
    if (seen.includes(title)) return { bad: "redirect loop " + seen.join(" -> ") };
    seen.push(title);
    const r = await get("/content/" + BOOK + "/" + enc(title));
    if (r.code === 302 && r.loc) { title = decodeURIComponent(r.loc.split("/").pop()); continue; }
    if (r.code !== 200) return { bad: "HTTP " + r.code + " for " + title };
    const m = META.exec(r.body);
    if (m) {
      const t = decodeURIComponent(m[1]);
      if (t.includes("#")) return { bad: "a SECTION, not an article: " + title + " -> " + t };
      title = t; continue;
    }
    const text = plain(r.body);
    /* THE LEAD IS THE FIRST REAL PARAGRAPH, not the first 400 characters of the
       page. Kiwix's markup opens with the title twice, then whatever infobox,
       sidebar or image caption the article carries — Blues begins "Culture
       Religion Politics Civic/economic groups Sports…", which is a navbox — and
       a table of contents is not evidence that the article is what the reason
       says it is. firstPara() takes the first <p> with real prose in it, which
       is the sentence a human would check. */
    const lead = firstPara(r.body);
    if (!lead) return { bad: "no lead paragraph (a list or a stub): " + title };
    if (DISAMB.test(lead) || /\(disambiguation\)$/.test(title))
      return { bad: "DISAMBIGUATION page: " + title };
    /* kiwix appends "This article is issued from Wikipedia…" to every page. On
       a real article it is thousands of characters down; when it turns up in
       the first 900 there is no article there. This is what caught `Forro`,
       which says "could refer to" instead of "may refer to" and slipped the
       test above — a disambiguation page for a Sao Tomean ethnic group, its
       creole, and the Brazilian music, which is at Forró. */
    if (/This article is issued from Wikipedia/i.test(text.slice(0, 900)))
      return { bad: "no article there (kiwix footer at " +
        text.search(/This article is issued from Wikipedia/i) + " chars): " + title };
    if (!MUSICAL.test(lead.slice(0, 600)))
      return { bad: "NOT ABOUT MUSIC: " + title + " — " + lead.slice(0, 90) };
    return { title, lead: lead.slice(0, 260).trim() };
  }
  return { bad: "too many redirects from " + q };
}

/* ---------------------------------------------------------------------------
 * THE RUN
 * ------------------------------------------------------------------------ */
const ARGV = process.argv.slice(2);
const CHECK = ARGV.includes("--check");
const VERBOSE = ARGV.includes("-v");
const ONLY = (() => { const i = ARGV.indexOf("--only"); return i < 0 ? null : ARGV[i + 1]; })();
const URLBASE = "https://en.wikipedia.org/wiki/";

function urlFor(title) { return URLBASE + enc(under(title)); }

/* EXIT 2 IS "NOT ON THIS BOX", AND IT IS NOT A FAILURE. The ZIM is 100GB of
 * Wikipedia sitting on one machine; a gate that runs `--check` on a laptop
 * without it would fail for a reason that has nothing to do with the tree. So
 * an unreachable kiwix exits 2 with the sentence that says so, and a runner
 * treats 2 as a skip and 1 as a fail. (verify.sh's own macOS problem, again:
 * a check that cannot run everywhere has to say which it is doing.) */
async function alive() {
  try { await get("/"); return true; } catch (e) { return false; }
}

async function main() {
  if (!(await alive())) {
    console.error("wiki-extract: kiwix-serve is not answering on " + HOST + ":" + PORT +
      " — this table can only be re-derived on a box carrying " + BOOK + ".\n" +
      "  start it, or set KIWIX_HOST/KIWIX_PORT. SKIPPING (exit 2), not failing.");
    process.exit(2);
  }
  const GENRES = require("./genres.js").GENRES;
  const keys = Object.keys(GENRES);

  /* ONE OWNER PER FACT: the roster is genres.js's, not a list typed in here.
     An anchor added tomorrow fails this run until it is answered for. */
  const asked = new Set([...Object.keys(ASK), ...Object.keys(NOLINK), ...ROLES]);
  const unanswered = keys.filter((k) => !asked.has(k));
  const stale = [...asked].filter((k) => !GENRES[k]);
  if (unanswered.length) fail("no ASK/NOLINK row for: " + unanswered.join(", "));
  if (stale.length) fail("ASK/NOLINK names anchors genres.js does not have: " + stale.join(", "));
  for (const r of ROLES) if (ASK[r]) fail("THE SIX ROLES GET NO LINK — " + r + " has an ASK row");

  const table = {}, misses = [], evidence = {}, broken = [];
  const order = keys.filter((k) => (ONLY ? k === ONLY : true));
  let n = 0;
  for (const k of order) {
    if (ROLES.includes(k)) continue;
    if (NOLINK[k]) { misses.push({ key: k, label: GENRES[k].label || k, why: NOLINK[k] }); continue; }
    const a = ASK[k];
    const r = await resolve(a.q);
    n++;
    /* EVERY bad row, not the first: a rejection is a fact about the ZIM and
       fixing them one run at a time is 190 round trips per typo. */
    if (r.bad) { broken.push(k + " (" + a.q + "): " + r.bad); continue; }
    table[k] = { title: r.title, kind: a.kind || "genre", why: a.why };
    evidence[k] = r.lead;
    if (VERBOSE) console.log(String(n).padStart(3) + "  " + k.padEnd(18) +
      r.title + (under(a.q) === r.title ? "" : "   <- " + under(a.q)));
  }

  for (const r of ROLES) if (table[r]) fail("a role got a link: " + r);
  if (broken.length) fail(broken.length + " anchors did not resolve:\n  " + broken.join("\n  "));

  const built = new Date().toISOString().slice(0, 10);
  const js = renderJs(table, misses, built, GENRES);
  const md = renderMd(table, misses, evidence, built, GENRES);

  if (CHECK) {
    let bad = 0;
    for (const [f, want] of [[OUT_JS, js], [OUT_MD, md]]) {
      const have = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
      /* the build date is the one line allowed to differ — it is a stamp, not
         a derivation, and a --check that fails every midnight is a check that
         gets switched off. */
      const strip = (s) => s.replace(/"built": "\d{4}-\d\d-\d\d"/, "").replace(/Derived \d{4}-\d\d-\d\d/, "");
      if (strip(have) !== strip(want)) { console.error("DRIFT: " + path.relative(ROOT, f) + " disagrees with the ZIM"); bad++; }
    }
    if (bad) { console.error("\nre-run `node nukernel/wiki-extract.js` and commit the result."); process.exit(1); }
    console.log("ok · " + Object.keys(table).length + " links and " + misses.length +
      " misses re-derived from " + BOOK + " and identical to what ships.");
    return;
  }

  fs.writeFileSync(OUT_JS, js);
  fs.writeFileSync(OUT_MD, md);
  const kinds = {};
  for (const k in table) kinds[table[k].kind] = (kinds[table[k].kind] || 0) + 1;
  console.log("wrote " + path.relative(ROOT, OUT_JS) + " and " + path.relative(ROOT, OUT_MD));
  console.log("  " + Object.keys(table).length + " links  " +
    JSON.stringify(kinds) + "   " + misses.length + " misses   " +
    ROLES.length + " roles unlinked   " + keys.length + " anchors");
  for (const m of misses) console.log("  MISS  " + m.key + " (" + m.label + ")");
}

function fail(msg) { console.error("wiki-extract: " + msg); process.exit(1); }

function renderJs(table, misses, built, GENRES) {
  const rows = Object.keys(table).map((k) =>
    "    " + JSON.stringify(k) + ": " + JSON.stringify(table[k])).join(",\n");
  const miss = misses.map((m) => "    " + JSON.stringify(m)).join(",\n");
  return `// nukernel/wiki.js — GENERATED BY nukernel/wiki-extract.js — DO NOT EDIT.
//
// WHICH WIKIPEDIA ARTICLE EACH ANCHOR IS. Not typed: resolved against a local
// copy of the whole English Wikipedia (${BOOK}) served by
// kiwix-serve on this box, one title at a time, with the article's own lead
// sentence read back to prove the article is what the reason says it is.
// Re-derive with \`node nukernel/wiki-extract.js\`; \`--check\` fails if this
// file and the ZIM disagree. The evidence is nukernel/WIKI.md.
//
// THE PAGE MAKES NO REQUEST FOR ANY OF THIS. A link is not a fetch: what ships
// is an href, and it costs nothing until a reader chooses to click it.
// test/atlas.js G7 aborts every non-localhost request and G14 reads back every
// resource the page actually loaded; both stay green with these hrefs in the
// DOM.
//
//   title  the CANONICAL article, after redirects — url() builds the href.
//   kind   genre | artist | work | broader. Not every anchor is a genre and
//          the page says which, because a row that hides it stops being
//          checkable (see WIKI.md).
//   why    the sentence that justifies THIS article over the near misses,
//          argued from the anchor's own label, parents, wants and comment.
//
// MISSES are anchors with no link ON PURPOSE — a wrong link is worse than
// none. The six internal roles (${ROLES.join(", ")})
// are not in here at all: a role has a job, not a history.
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuWiki = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const BOOK = ${JSON.stringify(BOOK)};
  const BASE = ${JSON.stringify(URLBASE)};
  const WIKI = {
${rows}
  };
  const MISSES = [
${miss}
  ];
  /* ONE OWNER FOR THE HREF. The table holds the TITLE, which is the fact;
     the URL is built from it here so no caller has to know how a Wikipedia
     title becomes a path — and so a title with an accent in it (Forró,
     Coupé-décalé, Nhạc vàng, Norteño, Guča) is encoded once, correctly. */
  function url(key) {
    const w = WIKI[key];
    return w ? BASE + encodeURIComponent(w.title.replace(/ /g, "_"))
      .replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%21/g, "!")
      .replace(/%28/g, "(").replace(/%29/g, ")") : null;
  }
  return {
    "built": "${built}",
    "from": "nukernel/wiki-extract.js",
    "book": BOOK,
    "counts": { "links": ${Object.keys(table).length}, "misses": ${misses.length}, "roles": ${ROLES.length}, "anchors": ${Object.keys(GENRES).length} },
    WIKI, MISSES, url,
  };
});
`;
}

function renderMd(table, misses, evidence, built, GENRES) {
  const kinds = {};
  for (const k in table) kinds[table[k].kind] = (kinds[table[k].kind] || 0) + 1;
  const L = [];
  L.push("# The wiki table — which article, and why");
  L.push("");
  L.push("GENERATED BY `nukernel/wiki-extract.js` — DO NOT EDIT. Derived " + built +
    " against `" + BOOK + "`, the whole English Wikipedia of February 2026, served by " +
    "`kiwix-serve` on this box. Re-derive with `node nukernel/wiki-extract.js`; " +
    "`--check` fails if this file and the ZIM disagree.");
  L.push("");
  L.push("**This file exists to be READ.** Disambiguation is the whole job and a wrong " +
    "link is worse than none, so every row below carries two sentences that have to agree: " +
    "**WHY** is the argument from the anchor's own facts (its label's city and year, its " +
    "`parents`, its `wants`, its comment in `genres.js`), and **LEAD** is the first thing " +
    "the article itself says. If they disagree, the link is wrong and the row is the place " +
    "you find out.");
  L.push("");
  L.push("| | count |");
  L.push("|---|---|");
  L.push("| anchors in `genres.js` | " + Object.keys(GENRES).length + " |");
  L.push("| linked | " + Object.keys(table).length + " |");
  for (const k of Object.keys(kinds).sort()) L.push("|   · " + k + " | " + kinds[k] + " |");
  L.push("| misses (no link, on purpose) | " + misses.length + " |");
  L.push("| internal roles (never linked) | " + ROLES.length + " |");
  L.push("");
  L.push("`kind` is `genre` when the article names this genre; `artist` when `genres.js` " +
    "names the anchor for one act in brackets and Wikipedia has no article for the style; " +
    "`work` when the anchor is an ERA of one act and the record is the era; `broader` when " +
    "the nearest true article is wider than the anchor. Everything that is not `genre` is " +
    "listed again at the foot of this file, because those are the rows worth arguing about.");
  L.push("");
  L.push("## The misses");
  L.push("");
  if (!misses.length) L.push("None.");
  for (const m of misses) {
    L.push("**`" + m.key + "` — " + m.label + "** — no link.");
    L.push("");
    L.push("> " + m.why);
    L.push("");
  }
  L.push("## The table");
  L.push("");
  for (const k of Object.keys(table)) {
    const t = table[k], g = GENRES[k];
    L.push("### `" + k + "` — " + (g.label || k) + " → [" + t.title.replace(/_/g, " ") + "](" + urlFor(t.title) + ")");
    L.push("");
    if (t.kind !== "genre") L.push("*kind: " + t.kind + "*");
    if (t.kind !== "genre") L.push("");
    L.push("- **why** " + t.why);
    L.push("- **lead** " + (evidence[k] || "").replace(/\|/g, "\\|"));
    L.push("");
  }
  const odd = Object.keys(table).filter((k) => table[k].kind !== "genre");
  L.push("## Every row that is not a genre article");
  L.push("");
  L.push("| key | label | kind | article |");
  L.push("|---|---|---|---|");
  for (const k of odd) L.push("| `" + k + "` | " + (GENRES[k].label || "") + " | " +
    table[k].kind + " | [" + table[k].title.replace(/_/g, " ") + "](" + urlFor(table[k].title) + ") |");
  L.push("");
  return L.join("\n");
}

main().catch((e) => fail(String(e && e.stack || e)));
