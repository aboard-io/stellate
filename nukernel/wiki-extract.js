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

const MUSICAL = /\b(music|song|genre|band|sing|sung|chant|danc|rhythm|melod|album|instrument|orchestra|choir|choral|vocal|opera|hymn|tune|drum|guitar|piano|record|compos|repertoire|ensemble|percussion|techno|jazz|blues|folk|funk|reggae|ballad|swing|house\b|pop\b|rock\b|rap\b|soul\b|beat\b|hip.hop)/i;

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
  counterpoint: { q: "Counterpoint", why: "Vienna 1725 is Fux's Gradus ad Parnassum and the article covers species counterpoint, which is what this row teaches the kernel." },
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
  industrialbreaks: { q: "Meat Beat Manifesto", why: "Swindon 1989 is this act's own town and year. `Industrial breaks` is not an article and the sample-collage tradition the comment names has none either.", kind: "artist" },
  industrialrock: { q: "Industrial rock", why: "Cleveland 1989 is Pretty Hate Machine; the genre article exists, so the band link is unnecessary." },
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
