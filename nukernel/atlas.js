// nukernel/atlas.js — WHERE AND WHEN THE RECORDS ARE.
//
// Paul, 2026-08-24: "i liked when it asked a few questions about when and where
// but how about this: a slider for time and a world map on top that shows where
// the genres are happening! I scroll to a time, click a place, and now i've got
// a song."
//
// This file is the DATA tier of that: it composes nothing and draws nothing. It
// answers four questions — which records are where, which are when, where a
// place is on a sphere, and where that lands in a rectangle. ui/atlas.js draws
// it; precompose.js writes the record.
//
// WHAT IT REPLACES, AND WHY THE OLD DOOR WAS ROTTED. band-kit.js:1790-1831
// already asks "when is it? / where are you? / where do you play?", and its
// DECADES list at :1820 already does PLAN.md Phase 3's "century first, then
// decade where it matters". But it reads `when`/`where`/`venue` off band-kit's
// OWN catalog (band-kit.js:814), and that catalog has THIRTY records — measured
// 2026-08-24, `survivors({})` returns 30 where genres.js has 122. The when/where
// question on this branch reaches a different, smaller catalog than the page's.
// This one reaches all 116 that have a place. Two place vocabularies is also
// already a drift: band-kit says "Rio", genres.js says "Rio de Janeiro", which
// is what ALIAS is for and what gate G3 watches.
//
// THE YEAR IS EXTRACTED, NOT PARSED AT RUNTIME AND NOT MIGRATED. Three ways to
// get a year out of `label: "Kingston 1969"`, and the reasons the other two
// lost: (a) parse at draw time — `label` is a DISPLAY string, so the day
// somebody writes "London, 1979" the map silently loses a record, and a silent
// loss is the failure mode this repo has legislated against; (b) add `year:` and
// `place:` to 116 genres.js entries — a 6000-line file every other slice is
// editing, and geography is not a musical fact: a genre is a point in the eight
// axes and a city's latitude is not one of them. So (c): extract ONCE with a
// regex, commit the output below, and re-run the same regex in the gate
// (atlas.gate.js G2) demanding deep-equality. Zero runtime parsing, zero
// migration, and an alarm the moment the label and the map disagree.
// `node nukernel/atlas.gate.js --bake` rewrites the WHEN block in place.
//
// UMD, like every sibling in the data tier (genres.js:23, precompose.js:45): no
// DOM, no window, node-requirable, so the gate calls every one of these
// functions with no browser anywhere.
(function (root) {
  "use strict";

  /* ======================================================================
     1 · PLACES — the hand-written, checked, committed geography
     ======================================================================
     65 rows: the 62 cities that appear in a genres.js label, plus Bristol,
     Memphis and Reykjavík, which only band-kit's smaller catalog names (G3
     holds every band-kit `where` word to a row here, so the two vocabularies
     cannot drift further apart than they already have).

     AND SIX MORE ON 2026-08-25 — Aksum, Accra, Addis Ababa, Kinshasa, Bamako
     and Oran — with the African history round (Paul: "fix the afrobeat
     parents and add the missing African history"). MEASURED before it: of 124
     place-year anchors, FIVE were on the African continent, in three cities,
     and none older than 1971, against SIX in the Afro-diaspora. Aksum is now
     the oldest dot on the map, sixty years the far side of Rome.

     KINSHASA IS SPELLED KINSHASA THOUGH THE RECORD SAYS 1960, when the city
     was Léopoldville. G3 below enforces ONE SPELLING PER PLACE and a second
     name for the same coordinates would put two dots where there is one city
     — the same reason ALIAS exists for Rio. The old name is in the anchor's
     comment, which is where a historical fact that is not a map dot belongs.

     CAIRO, CHANDIGARH AND GUADALAJARA ARRIVED ON 2026-08-24 with the 2020s
     anchors Paul asked for ("'now' is a lie, it's the 2010s. Add the 2020s as
     now") — mahraganat, punjabipop and corridotumbado. Geography follows the
     catalog, never the other way round: a row here with no record behind it
     fails G3 as an orphan, which is why these three landed the same hour their
     labels did and not before.

     AND THIRTY-EIGHT MORE ON 2026-08-26, with the world round (Paul: "Fill in
     lots of world historical genres including non western stuff over a long
     period of time"). MEASURED before it: of 133 place-year anchors, 107 —
     80.5% — were Western Europe or North America, and the USA and the UK held
     88 of them. The thirty-eight rows below are the geography sixty new
     anchors need: Havana, Mexico City, Barranquilla, Valledupar, Santo
     Domingo, Port of Spain, Recife, São Paulo, Cusco, Monterrey, Mazatlán,
     Freetown, Nairobi, Douala, Luanda, Abidjan, Shanghai, Hong Kong, Taipei,
     Jakarta, Bangkok, Manila, Ho Chi Minh City, Phnom Penh, Mumbai,
     Faisalabad, Jalandhar, Istanbul, Tehran, Kabul, Piraeus, Lisbon,
     Barcelona, Dublin, Guča, Kansas City, Sedalia and Lafayette.

     THIRTY-SEVEN, NOT THIRTY-EIGHT: Southall was drafted and withdrawn, and
     the reason is measured in the WITHIN block below.

     TWO OF THEM ARE SPELLED IN THE MODERN NAME THOUGH THE RECORD IS OLDER,
     which is the Kinshasa precedent above applied twice more and for the same
     gate: `nhacvang` is "Ho Chi Minh City 1968", when the city was Saigon,
     and `filmi` is "Mumbai 1960", when it was Bombay. G3 enforces ONE
     SPELLING PER PLACE and a second name for the same coordinates would put
     two dots where there is one city. Both old names are in the anchors'
     comments, which is where a historical fact that is not a map dot belongs.

     AND THE ONES THAT ARE NOT HERE, NAMED SO NOBODY RE-DERIVES THEM. Four
     Tier-1 anchors were written and held back because no coordinate for them
     could be PROVED to stand on land: Honolulu, Honiara, Pointe-à-Pitre and
     Naha. `atlas-land.js` bakes Natural Earth's physical "land" and the
     nearest baked point to Honolulu is 33.9 degrees away, to Honiara 9.0, to
     Naha 5.3 and to Pointe-à-Pitre 5.5 — there are no Pacific islands, no
     Ryukyus and no Lesser Antilles in the file at all. Those dots would draw
     over open water. The wall is the bake, not the music, and it is why
     Australia and the Pacific is the world round's one empty region.
     [HONOLULU LANDED 2026-08-30, the ledger round: the bake was re-run
     with the city in PLACES, whose PKEEP box keeps Oahu's ring, and the
     region opened with `exotica`. Honiara, Naha and Pointe-à-Pitre are
     still held back — nobody has written their anchors yet, and each
     will need its ring kept the same way.]

     AND SIX MORE ON 2026-08-29, with the genealogy round ("how can we
     add lots more related genres quickly across time"): Clarksdale,
     Cologne, Córdoba, Matanzas, Munich, Nara and Northampton — the
     geography thirty-two new anchors need, and per the rule above, landed the same
     hour their labels did. Córdoba's REGIONS row is the Middle East, and
     the comment at that table has the Garland argument. Nara is the
     catalog's first Japanese dot outside Tokyo and its oldest East Asian
     one by twelve centuries.

     AND SEVEN MORE ON 2026-08-30, with the deep-time round (Paul: "look
     backwards in time to bone flutes and lutes"): Hohle Fels, Jiahu, Ur,
     Ugarit, Delphi, Tralles and Oxyrhynchus — the geography eight ancient
     anchors need, landed the same hour their labels did, per the standing
     rule. Four are SITES rather than living cities (Hohle Fels is a cave in
     the Swabian Jura, Jiahu a village site in Wuyang County, Ur is Tell
     el-Muqayyar, Ugarit is Ras Shamra) and the dot is the site's own
     coordinates, the way Provence takes the region's centre — a site that
     has a fixed archaeological location is BETTER geography than a city
     centre, not worse. Tralles is under modern Aydın and Oxyrhynchus under
     el-Bahnasa; both keep the ancient name because the RECORD is ancient
     (the Kinshasa rule, run backwards for the first time: there the modern
     name won because the city is the living thing, here the ancient name
     wins because the site is the remembered thing, and no modern music
     claims either dot). Rome takes NO new row: Rome 17 BC and Rome 600 are
     the same city and the same coordinates, two eras apart — the first
     two-records-one-place pair to straddle the BC/CE boundary; the year
     does the separating, exactly as Cairo 1932/1964 established.

     Decimal degrees, 2dp, city centre. REGIONS (Provence, Essex, Kent) take the
     region's rough centre. NEIGHBOURHOODS (Harlem, Greenwich Village, Muswell
     Hill) take the neighbourhood's, not the city's — Muswell Hill is not
     London, and the Kinks knew it.

     THESE ROWS ARE THE ONE THING IN THIS SLICE A MACHINE CANNOT CHECK.
     Gate G4 catches a city in the sea (bounds) and G10 catches two dots on top
     of each other; neither can catch one 200 km off. PROGRAM.md §5 names one
     human pass over the rendered world view as required, and this comment is
     the pointer to it. */
  const PLACES = {
    "Abidjan": [5.32, -4.03], "Accra": [5.60, -0.19],
    "Addis Ababa": [9.03, 38.74], "Aksum": [14.13, 38.72],
    "Antwerp": [51.22, 4.40], "Atlanta": [33.75, -84.39],
    "Austin": [30.27, -97.74], "Baghdad": [33.31, 44.37], "Bamako": [12.64, -8.00],
    "Bangkok": [13.75, 100.50], "Barcelona": [41.39, 2.17],
    "Barranquilla": [10.96, -74.80], "Basildon": [51.57, 0.46],
    "Beijing": [39.90, 116.41], "Bingen": [49.97, 7.90],
    "Berlin": [52.52, 13.40], "Boston": [42.36, -71.06],
    "Bristol": [51.45, -2.59], "Bronx": [40.84, -73.87],
    "Buenos Aires": [-34.60, -58.38],
    /* NINE MORE ON 2026-08-30, the goth-and-globe round: the goth
       family tree (Pomona, Rennes, Notodden, Traverse City, Halifax,
       York) and jazz's geography (Cape Town, Oslo, Bulawayo) — the
       first dots in Zimbabwe and Norway, and the map's southernmost
       city. */
    "Bulawayo": [-20.15, 28.58], "Cape Town": [-33.93, 18.42],
    "Halifax": [53.72, -1.86],
    "Montreal": [45.50, -73.57],
    "Notodden": [59.56, 9.26], "Oslo": [59.91, 10.75],
    "Pomona": [34.06, -117.76], "Rennes": [48.11, -1.68],
    "Traverse City": [44.76, -85.62], "York": [53.96, -1.08],
    /* NOT LEEDS, AND MEASURED: the Sisters of Mercy are a Leeds band
       and the round drafted "Leeds 1985" — the dot lands 5.8 CSS px
       from Halifax at the Britain arc, under G10's 8.5 px floor, and
       the two are sibling towns WITHIN cannot relate (the Southall
       situation exactly). The anchor took the band's first datable
       performance instead — Alcuin College, York, 16 February 1981,
       the show the band itself celebrates — the Workington-not-
       Birmingham ruling replayed. This note is here so nobody
       re-derives the attempt. */
    "Cairo": [30.04, 31.24], "Chandigarh": [30.73, 76.78],
    "Chapel Hill": [35.91, -79.06], "Charlotte": [35.23, -80.84],
    "Chennai": [13.08, 80.27],
    "Chicago": [41.88, -87.63], "Cincinnati": [39.10, -84.51],
    "Constantinople": [41.01, 28.98],
    "Clarksdale": [34.20, -90.57], "Cleveland": [41.50, -81.69],
    "Cologne": [50.94, 6.96], "Córdoba": [37.89, -4.78],
    "Crawley": [51.11, -0.19],
    "Cusco": [-13.53, -71.97], "Delhi": [28.61, 77.21],
    "Delphi": [38.48, 22.50],
    "Detroit": [42.33, -83.05],
    "Douala": [4.05, 9.77], "Dresden": [51.05, 13.74],
    "Dublin": [53.35, -6.26], "Durban": [-29.86, 31.02],
    "Düsseldorf": [51.23, 6.78], "Essex": [51.75, 0.50],
    "Faisalabad": [31.42, 73.08], "Florence": [43.77, 11.26],
    "Fort Worth": [32.76, -97.33],
    "Freetown": [8.48, -13.23], "Glasgow": [55.86, -4.25],
    "Greenwich Village": [40.73, -74.00], "Guadalajara": [20.67, -103.35],
    /* THE LEDGER ROUND'S FIVE, 2026-08-30 ("Fill in missing genres that
       are wanted") — geography follows the catalog, per the standing
       rule, each landing the hour its label did:
       · Bray — `horrorscore`, the village whose studios Hammer shot
         Dracula in; ~43 km west of London, checked against the Britain
         arc at the gate (the Basildon distance, mirrored).
       · Sheffield — `idm`, Warp's own town; the leedsgoth precedent asked
         the Britain-arc question and the gate answers it (Halifax and
         Manchester are both over the floor from here).
       · Bucharest — `lautari`, the Scaune neighbourhood's guild; NOTE
         Clejani (taraf) sits ~35 km southwest and the pair is measured
         at the gate, not assumed.
       · Maramureș — `doina`, Bartók's 1912 collecting ground: a REGION
         row like Provence, the county's rough centre, because the
         cylinders were cut village by village.
       · HONOLULU — `exotica`, and the first Pacific dot on the map. The
         four-anchors-held-back note below said "the wall is the bake,
         not the music"; the bake was RE-RUN this round with Honolulu in
         PLACES, whose PKEEP box keeps Oahu's ring (the 1:50m source has
         the island at 0.02° from the city), so the dot stands on land
         and the empty region below stops being empty. */
    /* THE DREAM-POP ROUND'S ONE DOT, 2026-08-31, AND ITS THREE REFUSALS.
       Paul: "I guess we need Slowdive and Galaxie 500 too right?" Two rows
       landed; only ONE new place did, and the other two candidates are
       written down here so nobody re-derives the attempt.
       · SUTTON COURTENAY — `ambientpop`, the village whose Courtyard studio the
         album infobox names ("Courtyard (Sutton Courtenay)") and that
         Halstead's own quoted sentence points at, "we had to start the record
         again back in Oxfordshire". The `Bray` ruling, replayed: a village
         named for its studio. Measured 9.3 CSS px from Swindon and 11.2 from
         Bray at the Britain arc — it CLEARS the 8.5 px floor by less than a
         pixel, and that thinness is the note: the Thames Valley corridor is
         now nearly full and the next row through here should measure first.
       · NOT READING, though Slowdive is a Reading band and the Pomona rule
         asks for the band's town. Measured 5.1 px from Bray, under the floor,
         and the two are sibling Thames Valley towns that WITHIN cannot relate
         — the Leeds/Halifax rejection above at almost the same distance (5.8).
         LONDON WAS NOT THE PROBLEM and the round's own guess was wrong about
         that: Reading clears London at 15.3 px.
       · NOT WESTON-SUPER-MARE, the album's second studio, drafted after
         Reading fell: 7.7 px from Bristol, under the floor.
       · NOT CAMBRIDGE, MASSACHUSETTS — `slowcore`'s infobox origin, and the
         most dangerous of the three because it would have PASSED. It lands
         0.2 px from Boston: the same dot with a second name. G10 asserts only
         at the tightest arc (Britain, 11 deg) and Cambridge MA's arcFor is 64
         deg (North America), so the gate would have printed the collision to
         its watch list and exited 0. The refusal is human, made against the
         printed number, and the ZIM supplied the alternative in body text —
         "The band played gigs in Boston and New York City" — so the row takes
         Boston, a dot the map already draws. NO new North American place. */
    "Sutton Courtenay": [51.64, -1.28],
    /* THREE DOTS FOR THE 2026-09-01 ROUND, and only three: of the six places
       Paul's ten acts come from, Brixton measures 6 km from London and Meols
       11 km from Liverpool, so both are the dot they sit inside rather than a
       second name for it (the Cambridge/Boston ruling, applied again). And
       Radiohead's own Abingdon lands 3 km from Sutton Courtenay above — which
       is Slowdive's village — so that row takes Oxford, 12 km clear, rather
       than wearing another band's town. */
    "Oxford": [51.75, -1.26], "Vancouver": [49.28, -123.12],
    "Brixton": [51.46, -0.11],
    /* THE SOUNDTRACK ROUND'S TWO DOTS AND ONE REFUSAL, 2026-09-01 (Paul:
       "add lots of movie soundtracks especially the Hans Zimmer type...
       Star Wars etc."), geography following the catalog per the rule:
       · NOT DENHAM — `spaceopera`'s first label, the Buckinghamshire
         village whose Anvil Studios scoring stage held the March 1977
         main-title sessions. The Sutton Courtenay note above warned "the
         next row through here should measure first"; it was measured, and
         G10 said no: 4.0 CSS px from Bray at the Britain arc (floor 8.5),
         6.9 from London, 7.8 from Brixton, 6.5 from Muswell Hill —
         FOUR undeclared pairs, and Bray is a sibling village WITHIN
         cannot relate (the Reading ruling at 5.1 px, replayed at 4.0).
         The row takes Los Angeles 1979, the revival's own scoring stage
         on the other coast — a dot the map already draws, the Cambridge/
         Boston recovery — and its genres.js comment keeps Denham in
         prose where the label could not.
       · SANTA MONICA — `epichybrid`, the studio complex the epic-hybrid
         idiom was built in; ~23 km from the Los Angeles dot, the
         Brixton/London question asked on another coast, and it clears at
         the North America arc where Denham could not clear Britain's.
       · WELLINGTON — `fantasyscore`, the year the biggest orchestral
         commission on earth moved there; the FIRST New Zealand dot, and
         the second entry in the Australia-and-the-Pacific region row
         Honolulu unblocked (the land bake holds both islands). */
    "Santa Monica": [34.02, -118.49],
    "Wellington": [-41.29, 174.78],
    "Beirut": [33.89, 35.50],
    "Bray": [51.51, -0.70], "Sheffield": [53.38, -1.47],
    "Bucharest": [44.43, 26.10], "Maramureș": [47.67, 24.00],
    "Honolulu": [21.31, -157.86],
    "Guča": [43.78, 20.23], "Harlem": [40.81, -73.94], "Havana": [23.13, -82.38],
    "Ho Chi Minh City": [10.82, 106.63], "Hohle Fels": [48.38, 9.75],
    "Hong Kong": [22.32, 114.17],
    "Houston": [29.76, -95.37], "Isle of Wight": [50.69, -1.32],
    "Istanbul": [41.01, 28.98], "Jakarta": [-6.21, 106.85],
    "Jiahu": [33.61, 113.66],
    "Johannesburg": [-26.20, 28.05], "Kabul": [34.53, 69.17],
    "Kansas City": [39.10, -94.58], "Kent": [51.20, 0.75],
    "Kingston": [17.97, -76.79], "Kinshasa": [-4.32, 15.31],
    "Lafayette": [30.22, -92.02], "Lagos": [6.52, 3.38],
    "Las Vegas": [36.17, -115.14], "Leipzig": [51.34, 12.37],
    "Lisbon": [38.72, -9.14], "Liverpool": [53.41, -2.98],
    "London": [51.51, -0.13], "Los Angeles": [34.05, -118.24],
    "Luanda": [-8.84, 13.23], "Manchester": [53.48, -2.24],
    /* MACON joined 2026-09-03 with `southernrock` (The Allman Brothers
       Band, 1969), and the crowding is MEASURED and declared rather than
       discovered later: at the North America arc it lands 5.8 CSS px from
       Atlanta and 6.0 px from Athens, both under the 8.5 px floor G10
       enforces — but G10 applies that law to BRITAIN only, and the precedent
       in this table is closer still (Asbury Park at 3.0 px from New York,
       Teaneck at 1.1). No WITHIN row: Macon is its own city 130 km down the
       road, not a district of Atlanta, and Capricorn Records, the Big House
       and the whole southern-rock roster were there and not there. */
    "Macon": [32.84, -83.63],
    "Manila": [14.60, 120.98], "Matanzas": [23.04, -81.58], "Mazatlán": [23.25, -106.41],
    "Memphis": [35.15, -90.05], "Mexico City": [19.43, -99.13],
    "Miami": [25.76, -80.19], "Milan": [45.46, 9.19],
    /* MINNEAPOLIS joined 2026-09-03 with `minneapolissound` (Prince, 1999),
       and unlike Asbury Park a year of rounds ago there is nothing to declare:
       at the North America arc its nearest neighbours in this table are
       Chicago (569 km) and Nashville (1,161 km), which is the widest berth any
       new North American dot has had since Sedalia. No ALIAS and no WITHIN —
       the record was cut at Kiowa Trail in Chanhassen, twenty miles out, and
       Chanhassen is a suburb of the city the SOUND is named after rather than
       the Versailles/Paris relation that door exists for. The label follows
       the article's own name, `Minneapolis sound`. */
    "Minneapolis": [44.98, -93.27],
    "Monterrey": [25.67, -100.32],
    "Mumbai": [19.08, 72.88], "Munich": [48.14, 11.58], "Muswell Hill": [51.59, -0.14],
    /* ASBURY PARK joined 2026-09-02 with `heartlandrock` (Born to Run), and
       the crowding is MEASURED and declared rather than discovered later: at
       the North America arc it lands 3.0 CSS px from New York and 5.7 px from
       Philadelphia, both under the 8.5 px floor G10 enforces — but G10 applies
       that law to BRITAIN only (25 places at an 11-degree arc), so the gate
       stays green. The precedent is already in this table and is closer still:
       "Teaneck" (psychsoul 1973) sits 1.1 px from New York as its own plain
       dot, with no ALIAS and no WITHIN, and Sausalito, Greenwich Village,
       Harlem, Muswell Hill and Brixton are the same pattern. No WITHIN row was
       added: Monmouth County is not the Versailles/Paris relation that door
       exists for, and Asbury Park is the shore town the E Street Band is from,
       not a district of New York. */
    "Asbury Park": [40.22, -74.01],
    "Nairobi": [-1.29, 36.82], "Nara": [34.69, 135.80], "Nashville": [36.16, -86.78],
    "New Orleans": [29.95, -90.07], "New York": [40.71, -74.01],
    "Northampton": [52.24, -0.90], "Nuremberg": [49.45, 11.08],
    "Oklahoma City": [35.47, -97.52], "Oran": [35.70, -0.63],
    "Orlando": [28.54, -81.38], "Paris": [48.86, 2.35],
    "Philadelphia": [39.95, -75.17], "Phnom Penh": [11.56, 104.92],
    "Piraeus": [37.94, 23.65], "Port of Spain": [10.65, -61.51],
    "Portland": [45.52, -122.68], "Provence": [43.75, 5.50],
    "Recife": [-8.05, -34.88], "Reims": [49.26, 4.03],
    "Reykjavík": [64.15, -21.94], "Rio de Janeiro": [-22.91, -43.17],
    "Rome": [41.90, 12.50], "San Diego": [32.72, -117.16],
    "San Francisco": [37.77, -122.42], "San Juan": [18.47, -66.11],
    "Santo Domingo": [18.47, -69.90], "São Paulo": [-23.55, -46.63], "Jalandhar": [31.33, 75.58],
    /* THE MIDI-CORPUS ROUND'S SIX NEW DOTS (2026-09-02). Four are plain
       geography and two need their sentence.
         Seattle       `grunge` 1991 and `postgrunge` 1995 — Sub Pop's city
                       and the scene word's own. Nevermind's tape was cut at
                       Sound City in Van Nuys and the row still says Seattle,
                       for the reason `madchester` and `bristolsound`
                       already give: a scene word takes the room the music
                       came out of, not the desk it was mixed on.
         Berkeley      `poppunk` 1994 — Fantasy Studios, where Dookie was
                       cut. It sits seventeen kilometres from San Francisco
                       and G10 lists the pair as a NOTE rather than a
                       failure: the 8.5 px floor is enforced at the BRITISH
                       arc only, and `Pomona` has sat forty-four kilometres
                       from Los Angeles since the goth round on exactly that
                       reading. This note is here so nobody re-derives it.
         Long Beach    `skapunk` 1996 — Sublime's city, ~30 km from Los
                       Angeles, the Pomona ruling again.
         Virginia Beach  `contemporaryrnb` 1997 — Master Sound, where Supa
                       Dupa Fly was cut, and the city both Missy Elliott and
                       Timbaland are from. The first dot in Virginia.
       ATHENS IS THIS TABLE'S GEORGIA, not Greece's, and the collision is
       declared here rather than left to be discovered: `collegerock` is
       R.E.M.'s college town at 33.96N, and the Greek capital's music is on
       this map already as `Piraeus` (rebetiko, its port). A future Greek row
       reuses Piraeus or picks a key that is not this one — PLACES is keyed
       by the NAME and two cities cannot share it. The Murmur tape was cut at
       Reflection Sound in Charlotte, which is already here for `newjackswing2`;
       the Seattle ruling above decides between the two.
       KYOTO is the Constantinople rule run once more: Tokyo is on this map
       for four rows of Japanese popular music, and `chiptune` (Kyoto 1985)
       answers to a games company three hundred and seventy kilometres down
       the country rather than to Shibuya. Two Japanese cities, two musics,
       and the geography follows the record both times. */
    "Athens": [33.96, -83.38], "Berkeley": [37.87, -122.27],
    /* THE GENRE-QA ROUND, BATCH C'S FIVE NEW DOTS (2026-09-03) — beyond the
       Anglosphere and the metal wing. THE CROWDING WAS MEASURED BEFORE THE
       DOTS WERE WRITTEN, each in the smallest VIEWS rectangle that contains
       it, against every place already in WHEN, in the same 1200-unit frame
       G10 asks its 26-unit question in. All five clear it:
         Hamburg     `schlager` 1960 and `powermetal` 1985 — Polydor's city
                     and Helloween's, twenty-five years apart. ONE DOT, TWO
                     LABELS, DIFFERENT YEARS, which is legal and is already
                     the Boston (1831/1989/1994) and Havana (five rows)
                     pattern. Nearest at the Europe arc: Leipzig 68.4 units,
                     Berlin 75.0.
         Helsinki    `iskelma` 1955 — Olavi Virta's city and Rytmi's. The
                     first Finnish dot; nearest is Stockholm at 145.7.
         Kitee       `symphonicmetal` 1997 — a North Karelian town of ten
                     thousand, and the dot follows the RECORD's band rather
                     than a studio, the Seattle ruling. 260.7 from Stockholm,
                     330.1 from Maramureș: the emptiest corner of the Europe
                     view.
         Santiago    `nuevacancion` 1966 — Violeta Parra's city and RCA
                     Victor Chile's. THE MAP'S FIRST CHILEAN DOT, and it fills
                     the gap the atlas's own header (line ~76) has listed as
                     wanted since it was written. 109.7 units from Buenos
                     Aires at "the south" arc, the widest clearance of the
                     five relative to its neighbours.
         Westfield   `metalcore` 2002 — Zing Studios, Westfield MA, where
                     Alive or Just Breathing was cut, sixty-five kilometres
                     west of Boston. The tightest of the five and still
                     clear: 32.0 units from Boston and from the Bronx, 33.3
                     from Teaneck, all above G10's 26-unit floor, and G10 in
                     any case asserts at the BRITAIN arc only. No WITHIN row:
                     Westfield is not in Boston, it is up the Connecticut
                     River, and the Asbury Park ruling one round earlier is
                     the precedent for a plain dot in the same situation. */
    "Hamburg": [53.55, 9.99], "Helsinki": [60.17, 24.94],
    "Kitee": [62.10, 30.14], "Santiago": [-33.45, -70.67],
    "Westfield": [42.13, -72.75],
    "Kyoto": [35.01, 135.77], "Long Beach": [33.77, -118.19],
    /* THE MOTOWN-AND-FOUR-ACTS ROUND'S THREE DOTS (2026-09-03, Paul: "We
       also need Public Enemy, Digable Planets, Pharcyde, Mary J. Blige").
       All three are North American and every separation below is MEASURED at
       that arc and declared here rather than discovered later; G10 enforces
       its 8.5 px floor at the BRITAIN arc only, which is the reading Asbury
       Park wrote down and Teaneck (1.1 px from New York since 1973) has been
       living under for six rounds.
         Long Island   `politicalhiphop` 1988 — Public Enemy is Nassau County
                       (Roosevelt, the WBAU studio at Adelphi in Garden City,
                       Spectrum City), and the desks that cut Nation of
                       Millions were in Manhattan: the Seattle ruling gives
                       the label to the room the music came out of, not the
                       desk it was mixed on. 1.7 px from the Bronx, 2.0 from
                       Brooklyn and Harlem, 2.2 from New York. NO WITHIN ROW,
                       and that is the whole point of the label: Nassau and
                       Suffolk are not a district of the city — the Asbury
                       Park case exactly, a place a band is FROM rather than
                       a neighbourhood of the place next to it. The dot sits
                       at western-central Long Island, between Roosevelt and
                       Hauppauge.
         Brooklyn      `jazzrap` 1993 — Digable Planets' own borough, and
                       the borough this map has been missing while holding
                       the Bronx (1973), Harlem (1955) and Greenwich Village
                       (1961). 0.3 px from New York, which is closer than
                       Teaneck and is why WITHIN below declares it: a borough
                       of the city is the Harlem relation exactly, and the
                       declaration also makes it a SIBLING of Harlem and
                       Greenwich Village under the 2026-09-01 rule.
         South Central `althiphop` 1992 — the Pharcyde's own district, taken
                       because `gfunk` already holds "Los Angeles 1992" and a
                       label is unique: the two records really are two Los
                       Angeleses, and the row says so. 0.3 px from Los
                       Angeles, 0.9 from Santa Monica, 1.3 from Long Beach.
                       WITHIN declares it inside Los Angeles, which is what it
                       is — a district, not a shore town. */
    "Long Island": [40.75, -73.45], "Brooklyn": [40.68, -73.94],
    "South Central": [34.00, -118.28],
    "Seattle": [47.61, -122.33], "Virginia Beach": [36.85, -75.98],
    "Sausalito": [37.86, -122.49], "Sedalia": [38.70, -93.23],
    "Seoul": [37.57, 126.98], "Shanghai": [31.23, 121.47],
    "Sofia": [42.70, 23.32], "South Carolina": [34.00, -81.03],
    "St. Gallen": [47.42, 9.37], "Stockholm": [59.33, 18.07],
    /* SURAKARTA, 2026-08-30, the walls-down round: `gamelan` is dated by
       Lokananta — "established on 29 October 1956 at Surakarta", the
       first record label of Indonesia, whose catalog is the largest
       collection of gamelan recordings anywhere — and geography follows
       the catalog, never the other way round. Central Java is baked
       land (Jakarta's dot proves the island), so the G-series land
       check holds without a re-bake. */
    "Surakarta": [-7.57, 110.82],
    /* THE UNLOCKING ROUND'S TWO, 2026-08-30 ("Unlock the missing stuff.
       Get qiyan working") — geography follows the catalog, as always.
       · Medina — `qiyan`, Azza al-Mayla's majlis; the map's first dot on
         the Arabian peninsula, ~340 km north of Mecca and 900 km south
         of Baghdad, so no packing question arises against any existing
         Middle East dot. It files in the MIDDLE EAST row below by the
         Garland logic that already put Córdoba and Baghdad there.
       · Edinburgh — `scotsfiddle`, Nathaniel Gow's firm at 41 North
         Bridge; 66 km east of Glasgow, which is the Basildon distance
         doubled and clears the arc check the way Bray did. */
    "Edinburgh": [55.95, -3.19], "Medina": [24.47, 39.61],
    /* THE INDIA-AND-CHINA BATCH'S SIX NEW DOTS (2026-09-03). Paul, going to
       bed: "we really need to fill in India and China in the classical
       period." The six were MEASURED BEFORE THEY WERE WRITTEN, in G10's own
       arithmetic — an orthographic projection at R = (shorter/2)/sin(arc/2)
       on a 390x844 phone, at the arcFor() the map actually flies to — and
       every number below is that run rather than a distance in kilometres.
       THE BASELINE FIRST, because without it a small number looks alarming:
       EIGHTEEN pairs already in this table are tighter than the tightest of
       these six, and one of them is the exact comparison — NARA/KYOTO, two
       Japanese dots at 0.90 px measured at the same 180-degree arc these
       Chinese dots are measured at, drawn as separate dots since the
       deep-time round. New York/Teaneck is 0.95, San Francisco/Berkeley 0.82,
       Paris/Versailles 0.92. G10 in any case asserts its floor at the BRITISH
       arc only, and none of these is in Britain.
         Lucknow    `tappa` 1780 and `thumri` 1856 — Asaf-ud-Daula's capital
                    and Wajid Ali Shah's, seventy-six years apart. ONE DOT,
                    TWO LABELS, DIFFERENT YEARS, which is legal and is already
                    the Hamburg (1960/1985) and Havana (five rows) pattern.
                    10.5 px from Delhi, 14.9 from Chandigarh: the widest
                    berth of the six and no question to ask.
         Thanjavur  `kriti` 1810 and `varnam` 1830, the same arrangement in
                    the south. 7.1 px from Chennai, 28.5 from Mumbai — looser
                    than Atlanta/Macon (5.8 px), which this table declared and
                    kept a day earlier. AND THE VILLAGE THAT WAS REFUSED IS
                    THE POINT OF THIS ENTRY: Tyagaraja lived and is buried at
                    Thiruvaiyaru, where the Aradhana is held, and that is 13 km
                    from Thanjavur — closer than Sutton Courtenay is to
                    Abingdon, a pair this table refused on 12 km with the
                    sentence "that row takes Oxford, 12 km clear, rather than
                    wearing another band's town". So the label takes the
                    kingdom his own article dates him by ("Thiruvaiyaru,
                    Thanjavur Maratha kingdom") and the village lives in the
                    row's comment.
         Suzhou     `kunqu` 1598 — Kunshan and Taicang are both in this
                    prefecture and the style is named for one of them. 2.1 px
                    from Shanghai, which is New York/Teaneck (0.95) and
                    Asbury Park (3.0) with the same answer: its own city, no
                    ALIAS, no WITHIN.
         Wuxi       `pipaqu` 1819 — Hua Qiuping's city and the Hua
                    Collection's. THE TIGHTEST OF THE SIX AND IT IS DECLARED
                    RATHER THAN DISCOVERED: 0.85 px from Suzhou, added in the
                    same round, and 2.9 from Shanghai. That is the Nara/Kyoto
                    number to two decimal places (0.90) and eighteen existing
                    pairs are tighter, so it is inside this table's practice
                    and not a new low. No ALIAS and no WITHIN: Wuxi is not a
                    district of Suzhou, it is its own prefecture up the lake,
                    and the Hua Collection is a Wuxi book — the article names
                    the school after the city. A future round that decides
                    Jiangnan should be one dot should move BOTH, and this note
                    is where it will find the numbers.
         Xi'an      `qinqiang` 1807 — Shaanxi's capital, and the dot follows
                    the province the article names ("originated in Shaanxi
                    Province of Qing China in 1807") to the city its own
                    Shaanxi box heads with, because a province is not
                    somewhere a map can fly to. 11.1 px from Jiahu, 22.7 from
                    Beijing: the emptiest quarter of China on this map.
         Suizhou    `yayue` 433 BC — Leigudun, Zengdu District, Suizhou,
                    Hubei, where the tomb of Marquis Yi and its 65 bells were
                    excavated in 1978. 5.4 px from Jiahu, the region's other
                    deep-time dot and its only near neighbour; Atlanta/Macon
                    is 5.8 and was declared and kept. The two of them are now
                    the whole of Chinese antiquity on this map, six millennia
                    apart. */
    "Lucknow": [26.85, 80.95], "Thanjavur": [10.79, 79.14],
    "Suzhou": [31.30, 120.59], "Wuxi": [31.49, 120.31],
    "Xi'an": [34.34, 108.94], "Suizhou": [31.69, 113.38],
    /* GWALIOR, 2026-09-04, AND IT IS A RE-DATING RATHER THAN A NEW ANCHOR —
       the first dot this table has added for a row it already had. Paul:
       "Move dhrupad back in time." `dhrupad` was Delhi 1955, the Dagar
       brothers at All India Radio, and that label was costing the catalogue
       three real edges: `badakhyal` (Delhi 1740), `tappa` (Lucknow 1780) and
       `thumri` (Lucknow 1856) each argued in its own note that it could not
       declare the ancestor everybody knows it has, because no parent may be
       later than its child. The row is GWALIOR 1501 now — the centre of
       "Man Singh Tomar (fl. 1486-1516) of Gwalior", the Dhrupad article's own
       parenthesis — and the three children declare it. The geography follows
       the catalogue, as always, and the dot was MEASURED BEFORE IT WAS
       WRITTEN, in G10's own arithmetic on a 390x844 phone at the arcFor()
       the map actually flies to (180 degrees; India has no view rectangle
       of its own):
         7.1 px from DELHI   (282 km) — the sultanate Man Singh paid tribute
                                        to and fought off for thirty years
         7.1 px from LUCKNOW (284 km) — `tappa` and `thumri`, two of the
                                        three rows this move unblocks
        13.0 px from Chandigarh, 15.6 from Jalandhar, 24.1 from Mumbai.
       7.1 IS NOT A NEW LOW AND IT IS NOT EVEN A NEW NUMBER: Thanjavur/Chennai
       is 7.1 px, declared and kept in the entry directly above this one the
       night before, and eighteen pairs in this table are tighter than the
       tightest of that batch (Wuxi/Suzhou 0.85, Nara/Kyoto 0.90, New
       York/Teaneck 0.95). It sits under MIN_PX (8.45) and therefore PRINTS
       in G10's under-26 list, which is what §5 asks for outside Britain;
       G10 asserts at the British arc only and Gwalior is not in Britain.
       No ALIAS and no WITHIN: Gwalior is not a district of Delhi or of
       Lucknow, it is a fort city 280 km from each, and the three-way spacing
       is the widest any Indian addition has had. */
    "Gwalior": [26.22, 78.18],
    "St. Louis": [38.63, -90.20], "Stourbridge": [52.46, -2.15],
    "Swindon": [51.56, -1.78], "Taipei": [25.03, 121.57],
    /* SYDNEY joined 2026-09-03 with `worship` (Hillsong, "Shout to the
       Lord", recorded 1993) — the map's FIRST DOT ON THE AUSTRALIAN
       MAINLAND, and the answer to a sentence this file has carried since the
       world round: "Australia's own two candidates are blocked MUSICALLY
       instead: manikay has no yidaki id and no bar." That block was never
       about the coastline — the land bake holds the continent, which is why
       the old declaration reached for a musical reason rather than a
       geographic one — and this row is not blocked either way: it is a band
       with a kit, a bar and a 4/4 measured over ten corpus files. No
       crowding question arises anywhere near it; the nearest dot on this map
       is Wellington, 2,225 km across the Tasman, which is the loosest
       packing any new place has ever had here. */
    "Sydney": [-33.87, 151.21],
    "Tampa": [27.95, -82.46], "Teaneck": [40.89, -74.02],
    "Tehran": [35.69, 51.39], "Tetouan": [35.57, -5.37],
    "Tokyo": [35.68, 139.65],
    "Toronto": [43.65, -79.38], "Tulsa": [36.15, -95.99],
    "Tralles": [37.85, 27.84],
    "Ugarit": [35.60, 35.78], "Ur": [30.96, 46.10],
    "Oxyrhynchus": [28.53, 30.66],
    "Valledupar": [10.46, -73.25],
    "Washington": [38.91, -77.04], "Winchester": [51.06, -1.31],
    /* WEST HAMPSTEAD joined 2026-09-03 with `bluesrock` (John Mayall with
       Eric Clapton, the Beano album). The label is a street corner because
       the SCENE and the DESK are the same one: Decca Studios stood at 165
       Broadhurst Gardens and Klooks Kleek, the club the Bluesbreakers were
       a fixture at, was upstairs at the Railway Hotel around the corner.
       "London 1966" was not available in any case — `indojazz` holds it.
       MEASURED at the Britain arc: 1.5 CSS px from Muswell Hill, 1.6 from
       London, 3.0 from Brixton, all far under G10's 8.5 px floor, which is
       why this is one of the four names with a WITHIN row below rather than
       a plain dot like Asbury Park. The declaration exempts it from London
       directly and from the other two as SIBLINGS (the 2026-09-01 clause).
       The nearest dot the declaration does not cover is Bray at 9.3 px,
       which clears the floor by under a pixel — the Sutton Courtenay
       margin, and the reason this dot is legal at all. */
    "West Hampstead": [51.55, -0.19],
    /* FOUR DOTS FOR THE 2026-09-07 ROUND, and every one of them is a place a
       (place, year) collision made necessary rather than a place somebody
       preferred. G6b holds (place, year) to being a KEY, so a row whose true
       city and true year are already spoken for must find the NEXT TRUE FACT
       — never the next true-ish one, which is the softrock/Lagos lesson
       (scratch/genre-qa/SHIFT-5.md §2) written down as a rule.

       ST JOHN'S WOOD carries TWO records six years apart, which is the whole
       argument for it: `englishpsych` (Piper at the Gates of Dawn, Feb-May
       1967) and `studioprog` (The Dark Side of the Moon, Jun 1972-Feb 1973)
       were both made in Abbey Road Studios, NW8, by the same band under the
       same EMI contract, and `London 1967` and `London 1973` are held by
       `acidrock` and `spacerock`. This is not the desk-not-the-room lie: the
       Floyd were an EMI house band for a decade and Studio 3 is where both
       records were played as well as mixed. 1.7 CSS px from London at the
       Britain arc, so it declares WITHIN, the Muswell Hill case a fourth time.

       THE BOWERY is CBGB, 315 Bowery, which is where `artpunk` (Television,
       Marquee Moon) played four nights a week for two years; `New York 1977`
       is `disco`'s. A named block of lower Manhattan on the Greenwich Village
       precedent, 2 km uptown of it.

       HUNTINGTON PARK is where `speedmetal` (Slayer) formed in 1981 and where
       three of the four lived; `Los Angeles 1986` is `smoothjazz`'s. A city of
       the Gateway Cities 9 km south-east of downtown, the South Central
       relation exactly.

       ASTON TIRROLD is the Berkshire cottage Traffic rented in 1967 and wrote
       in until they broke up — "getting it together in the country" was coined
       about this house — and `London 1970` is `newsfanfare`'s. It measures
       11 km from Sutton Courtenay, so it takes that dot's own WITHIN row and
       the two are siblings under the 2026-09-01 clause. */
    "St John's Wood": [51.53, -0.17],
    "Bowery": [40.72, -73.99],
    "Huntington Park": [33.98, -118.22],
    "Aston Tirrold": [51.57, -1.18],
    "Workington": [54.64, -3.55],
    "Venice": [45.44, 12.32], "Vienna": [48.21, 16.37],
    // ...AND TWO ON 2026-08-30, the downtempo round. TROMSØ is the
    // northernmost dot on the map by nearly six degrees over Reykjavík
    // — 300 km inside the Arctic Circle, and above the Europe view's
    // lat1 68, so it flies at the world arc; the nearest dots
    // (Notodden, Oslo) are ten degrees south and no packing question
    // arises. VERSAILLES is the opposite case and is declared in
    // WITHIN below: its own commune, but inside INSEE's unité urbaine
    // de Paris, ~1.8 CSS px from the Paris dot at the Europe arc.
    "Tromsø": [69.65, 18.96], "Versailles": [48.80, 2.13],
    /* NINE MORE ON 2026-08-30, the folk-floor round. GALAX and HOT
       SPRINGS are the Blue Ridge, two counties' worth of the round's
       Appalachian pair; CARNA is Connemara, the map's first Irish dot
       outside Dublin; CLEJANI is a village on the Wallachian plain
       (the taraf's own, the Pomona/Kinks rule); GALATINA is deep
       Salento; GRANADA joins Córdoba's peninsula but files in EUROPE
       where Córdoba files in the Middle East row — the geography
       follows the record both times (`flamenco` answers to Seville
       and Madrid; `andalusi` to Baghdad and Fez — the Córdoba/
       Constantinople rule, fourth application); PRAGUE and TBILISI
       are plain European geography (Garland's Europe volume runs to
       the Caucasus and says so); EPULU is the Ituri forest, the
       map's first dot in the DR Congo's east and its first
       rainforest interior anywhere.
       NOT RAYNE, AND CONSIDERED: `cajun`'s own town measures inside
       Lafayette's dot (25 km — the Southall situation, sibling towns
       WITHIN cannot relate), so the anchor takes the session city
       instead (New Orleans, 27 April 1928), the tsabatsaba
       a-record-is-the-honest-row ruling. NOT SELJORD: Lindeman's
       collecting parish lands 35 km from Notodden's dungeonsynth dot,
       under any plausible floor at the Europe arc — the anchor takes
       the city of publication (Christiania), which the Kinshasa rule
       spells Oslo. */
    /* TWO ON 2026-09-03, the classical-period round (Paul: "we're missing
       Mendelssohn and Brahms and so forth, we should have lots of
       representative classical genres"). THE CROWDING WAS MEASURED BEFORE THE
       DOTS WERE WRITTEN, in the same 1200-unit frame G10 asks its 26-unit
       question in, in the smallest VIEWS rectangle that contains each:
         MOSCOW    `ballet` 1877 — Swan Lake at the Bolshoi, and THE MAP'S
                   FIRST RUSSIAN DOT. It sits at lon 37.6, outside the Europe
                   rectangle's east edge (32), so it flies at the world arc,
                   where its nearest neighbours are Kitee 33.6 units, Helsinki
                   46.0 and Tbilisi 54.1 — all clear of the 26-unit floor, and
                   the emptiest quadrant left on the map.
         WEIMAR    `symphonicpoem` 1854 — Liszt's six years as Kapellmeister
                   to the Grand Duke, and the Hoftheater where Les Preludes
                   was first played. IT IS 23.2 UNITS FROM LEIPZIG AT THE
                   EUROPE ARC, WHICH IS UNDER THE 26-UNIT FLOOR, and that is
                   declared here rather than discovered later. G10 asserts at
                   the BRITAIN arc only, so the gate stays green; the
                   precedent in this table is closer still (Asbury Park 3.0
                   CSS px from New York, Teaneck 1.1, Macon 5.8 from Atlanta),
                   and 23.2 units is 7.5 CSS px on a 390px column. NO WITHIN
                   ROW: Weimar is a ducal capital eighty kilometres down the
                   road from Leipzig, not a district of it — the Macon ruling,
                   applied in Thuringia. Nearest after Leipzig: Nuremberg
                   32.6, Dresden 50.8, Berlin 54.3. */
    "Moscow": [55.76, 37.62], "Weimar": [50.98, 11.33],
    "Carna": [53.31, -9.84], "Clejani": [44.33, 25.68],
    "Epulu": [1.42, 28.58], "Galatina": [40.17, 18.17],
    "Galax": [36.66, -80.92], "Granada": [37.18, -3.60],
    "Hot Springs": [35.89, -82.83], "Prague": [50.08, 14.44],
    "Tbilisi": [41.72, 44.79],
  };

  /* ONE SPELLING PER PLACE. band-kit.js:814's house record says it comes from
     "Rio"; genres.js's bossa says "Rio de Janeiro". Rather than edit either
     catalog — the merge of the two is its own job, PROGRAM.md §4 item 14 — the
     map resolves both to one dot, and G3 fails the day a third spelling shows
     up without a row here. */
  const ALIAS = { "Rio": "Rio de Janeiro" };

  /* ONE PLACE INSIDE ANOTHER — declared, because a machine cannot tell.
     PROGRAM.md §5 G10 asks that the Britain view report ZERO dot-pairs closer
     than 26 map units. Measured 2026-08-24 it reports exactly two, and no
     rectangle fixes either: Muswell Hill is 8.8 units from London and Basildon
     is 20.1 from Essex, and separating Muswell Hill from London by 26 units
     needs a view under 3.7° of longitude — which cannot hold Glasgow and Kent
     at the same time. The pairs are not a packing bug; they are the fact that a
     neighbourhood is IN its city and a town is IN its county. So the
     containment is written down, G10 exempts a declared pair and still fails
     any other, and ui/atlas.js says "Muswell Hill, in London" in the Nearby
     list — which is the recovery path a thumb between them actually needs.
     (The alternative, moving a dot until a gate is happy, would be putting the
     Kinks somewhere they never lived.) */
  const WITHIN = {
    // SUTTON COURTENAY IS IN OXFORD'S COUNTY, declared 2026-09-01 because G10
    // measured the pair at 3.2 CSS px — well under its 8.5 floor — the moment
    // Radiohead arrived. The two are 12 km apart in Oxfordshire: the village
    // Slowdive recorded in and the county town Radiohead is filed under. This
    // is the Muswell Hill case exactly, and declaring it is the honest answer
    // where moving one of them would have been a lie about where a band is
    // from. (Radiohead's own Abingdon is 3 km from the village and would have
    // been worse; Oxford is the furthest TRUE dot available to that row.)
    "Sutton Courtenay": "Oxford",
    "Brixton": "London",            // a south London district; Bronski Beat's own
    "Muswell Hill": "London",       // a north London suburb; the Kinks' own
    /* WEST HAMPSTEAD, 2026-09-03, with `bluesrock`. Decca Studios and Klooks
       Kleek are both on this half-mile of north-west London, and the dot
       measures 1.6 CSS px from London, 1.5 from Muswell Hill and 3.0 from
       Brixton at the Britain arc — every one under G10's 8.5 floor. The row
       is here rather than a plain dot because Britain is the one arc the gate
       ASSERTS on: London is direct containment, and the other two are
       siblings under the 2026-09-01 clause. This is the Muswell Hill case a
       third time and the honest answer is the same one. */
    "West Hampstead": "London",     // Decca and Klooks Kleek, NW6
    "Harlem": "New York",           // uptown Manhattan
    "Greenwich Village": "New York",// lower Manhattan
    // ...and the Motown-and-four-acts round's two (2026-09-03). BROOKLYN is
    // a borough of the city and measures 0.3 CSS px from it, closer than
    // Teaneck; declaring it makes it a sibling of Harlem and Greenwich
    // Village under the 2026-09-01 sibling rule as well as a child of New
    // York. SOUTH CENTRAL is a district of Los Angeles at 0.3 px — the same
    // relation, on the other coast. NOT declared, and deliberately: `Long
    // Island`, which joined in the same round at 2.2 px from New York. Nassau
    // and Suffolk are not a district of the city and saying they were to
    // quiet a gate is the Sausalito lie; it stays a plain dot, the way Asbury
    // Park does.
    "Brooklyn": "New York",         // a borough of the city
    "South Central": "Los Angeles", // a district of the city
    // ...and the 2026-09-07 round's four, each argued at its coordinate above.
    // ST JOHN'S WOOD is direct containment (NW8) and a sibling of the other
    // three London districts; ASTON TIRROLD takes Sutton Courtenay's own
    // parent so the two Oxfordshire villages are siblings rather than an
    // undeclared 11 km coincidence, which is the case that clause was written
    // for. THE BOWERY and HUNTINGTON PARK are the Greenwich Village and South
    // Central relations on the two coasts.
    "St John's Wood": "London",     // NW8; Abbey Road Studios
    "Aston Tirrold": "Oxford",      // the Berkshire cottage, 11 km from Sutton Courtenay
    "Bowery": "New York",           // lower Manhattan; CBGB at 315
    "Huntington Park": "Los Angeles", // a Gateway city, 9 km south-east
    "Basildon": "Essex",            // a town in the county
    // VERSAILLES IS ITS OWN COMMUNE AND A PRÉFECTURE, and this row is
    // still not a Sausalito lie (see that note below): INSEE's unité
    // urbaine de Paris — the continuous built-up area — contains
    // Versailles, the way Greater London contains Muswell Hill, and
    // the dot lands ~1.8 CSS px from Paris at the Europe arc. The
    // label keeps the town because the scene is NAMED for it (the
    // press called Air's wave "the Versailles sound", and the ZIM's
    // own first line on the band is "from Versailles"); the map says
    // "Versailles, in Paris" in the Nearby list, which is the thumb's
    // recovery path between two dots two pixels apart.
    "Versailles": "Paris",          // in the Paris unité urbaine (INSEE)
    // NOT HERE, AND MEASURED: Southall. The world round's `bhangra` was
    // drafted as "Southall 1986" — the daytimer circuit, which is where UK
    // bhangra actually was — and the dot lands 4.9 CSS px from Muswell Hill
    // at the Britain arc, under G10's 8.5 px floor. Declaring it inside
    // London does not help: G10 exempts a declared PAIR, and Southall and
    // Muswell Hill are SIBLINGS, two districts of one city, which is the one
    // relation this table cannot say. Moving the dot to Birmingham measures
    // 4.5 px from Stourbridge and to Wolverhampton 3.8 px, so it is not a
    // Southall problem — Britain is simply full. The anchor went to
    // Jalandhar 1972 instead, which is the older and more directly ancestral
    // label anyway, and this note is here so nobody re-derives the attempt.
    // NOT HERE: Sausalito. It is 2.1 map units from San Francisco in the North
    // America view and it would be convenient to declare — but it is its own
    // town across the Golden Gate, not a district of anything, and a
    // containment table that says otherwise to quiet a gate is a table that
    // lies. G10 prints the pair for that view and nobody asserts on it.
  };

  /* ======================================================================
     2 · WHEN — 291 rows, BAKED from the genres.js labels
     ======================================================================
     GENERATED. Do not hand-edit: `node nukernel/atlas.gate.js --bake` rewrites
     everything between the two markers, and G2 fails if it drifts. The regex is
     /^(.+?)\s+(?:(\d{1,5})\s+BC|(\d{3,4}))$/ over `GENRES[gk].label`, and it is
     the ONLY place a label is ever read as anything but a display string.

     BC YEARS ARE NEGATIVE NUMBERS (2026-08-30, the deep-time round — Paul:
     "look backwards in time to bone flutes and lutes"). The label convention
     is "Place Year BC" ("Ur 2500 BC"); the bake writes `year: -2500`, and all
     the arithmetic below — the ascending sort, YEARS, nearest-year,
     the window — runs on the signed number with no special case anywhere.
     What a PERSON reads is yearWord() at the bottom of this file, the one
     owner of turning -2500 back into "2500 BC"; the two label reconstructions
     in this file (recordAt, ALL) go through it so `place + year` round-trips
     to the exact genres.js label in both eras. atlas.gate.js's LABEL_RE
     comment has the measurement for why the convention is a trailing word and
     not a minus sign. */
  /* WHEN:BEGIN */
  const WHEN = {
    fugue:          { place: "Leipzig", year: 1725 },
    acid:           { place: "Chicago", year: 1987 },
    newwave:        { place: "London", year: 1979 },
    vaporwave:      { place: "Portland", year: 2011 },
    blues:          { place: "Chicago", year: 1952 },
    rock:           { place: "London", year: 1969 },
    gregorian:      { place: "Rome", year: 600 },
    bulgarian:      { place: "Sofia", year: 1975 },
    polychoral:     { place: "London", year: 1570 },
    counterpoint:   { place: "Vienna", year: 1725 },
    neoclassical:   { place: "Berlin", year: 2011 },
    drone:          { place: "New York", year: 1964 },
    sludge:         { place: "New Orleans", year: 1991 },
    tango:          { place: "Buenos Aires", year: 1935 },
    deathmetal:     { place: "Tampa", year: 1990 },
    synthsoul:      { place: "London", year: 1983 },
    psychsoul:      { place: "Teaneck", year: 1973 },
    psychsoul2:     { place: "Detroit", year: 1968 },
    aor:            { place: "Los Angeles", year: 1982 },
    newjackswing2:  { place: "Charlotte", year: 1991 },
    hiphopsoul:     { place: "New York", year: 1992 },
    beatgroup:      { place: "Liverpool", year: 1962 },
    jazzrock:       { place: "Los Angeles", year: 1977 },
    postrock:       { place: "Austin", year: 2003 },
    boombap:        { place: "New York", year: 1994 },
    politicalhiphop: { place: "Long Island", year: 1988 },
    althiphop:      { place: "South Central", year: 1992 },
    jazzrap:        { place: "Brooklyn", year: 1993 },
    trap:           { place: "Atlanta", year: 2003 },
    house:          { place: "Chicago", year: 1986 },
    garage:         { place: "London", year: 1999 },
    dnb:            { place: "London", year: 1994 },
    disco:          { place: "New York", year: 1977 },
    funk:           { place: "Cincinnati", year: 1967 },
    detroitsoul:    { place: "Detroit", year: 1965 },
    northernsoul:   { place: "Manchester", year: 1970 },
    progressivesoul: { place: "Detroit", year: 1971 },
    rnb:            { place: "Philadelphia", year: 1994 },
    gospel:         { place: "Chicago", year: 1932 },
    reggae:         { place: "Kingston", year: 1969 },
    dub:            { place: "Kingston", year: 1973 },
    ska:            { place: "Kingston", year: 1962 },
    afrobeat:       { place: "Lagos", year: 1971 },
    bossa:          { place: "Rio de Janeiro", year: 1958 },
    countrypop:     { place: "Nashville", year: 1945 },
    synthpop:       { place: "Basildon", year: 1981 },
    shoegaze:       { place: "London", year: 1991 },
    citypop:        { place: "Tokyo", year: 1984 },
    punk:           { place: "New York", year: 1976 },
    artpunk:        { place: "Bowery", year: 1977 },
    ambient:        { place: "London", year: 1978 },
    techno:         { place: "Detroit", year: 1988 },
    jazz:           { place: "New York", year: 1945 },
    hambone:        { place: "Chicago", year: 1955 },
    rocknroll:      { place: "St. Louis", year: 1955 },
    rockabilly:     { place: "Memphis", year: 1954 },
    doowop:         { place: "Harlem", year: 1955 },
    skiffle:        { place: "London", year: 1956 },
    minimalism:     { place: "New York", year: 1967 },
    dusseldorfschool: { place: "Düsseldorf", year: 1977 },
    electro:        { place: "New York", year: 1982 },
    hymn:           { place: "Boston", year: 1831 },
    crooner:        { place: "Los Angeles", year: 1931 },
    yuletide:       { place: "New York", year: 1942 },
    merseybeat:     { place: "Liverpool", year: 1963 },
    psychpop:       { place: "London", year: 1968 },
    bigbeat:        { place: "Essex", year: 1997 },
    drill:          { place: "Chicago", year: 2012 },
    clubpop:        { place: "New York", year: 1983 },
    gospelpop:      { place: "New York", year: 1985 },
    powerballad:    { place: "Los Angeles", year: 1991 },
    retrofunkpop:   { place: "Los Angeles", year: 2013 },
    reggaeton:      { place: "San Juan", year: 2004 },
    latinpop:       { place: "Miami", year: 2001 },
    kpop:           { place: "Seoul", year: 2012 },
    boyband:        { place: "Orlando", year: 1997 },
    emo:            { place: "Chicago", year: 1999 },
    screamo:        { place: "San Diego", year: 1994 },
    confessionalpop: { place: "Nashville", year: 2008 },
    darkrnb:        { place: "Toronto", year: 2011 },
    bigroom:        { place: "Las Vegas", year: 2012 },
    blueeyedsoul:   { place: "Philadelphia", year: 1976 },
    fmsoul:         { place: "New York", year: 1988 },
    folkduo:        { place: "Greenwich Village", year: 1964 },
    worldfolk:      { place: "Johannesburg", year: 1986 },
    jamband:        { place: "San Francisco", year: 1972 },
    progfolk:       { place: "Aston Tirrold", year: 1970 },
    sophistirock:   { place: "London", year: 1986 },
    motorik:        { place: "Düsseldorf", year: 1974 },
    roboticpop:     { place: "Düsseldorf", year: 1978 },
    industrialdance: { place: "Chicago", year: 1981 },
    industrialmetal: { place: "Chicago", year: 1988 },
    ebm:            { place: "Chicago", year: 1989 },
    synthduo:       { place: "London", year: 1985 },
    fmpop:          { place: "Oslo", year: 1985 },
    musichallrock:  { place: "Muswell Hill", year: 1966 },
    orchpsych:      { place: "Oklahoma City", year: 1999 },
    altcountry:     { place: "Chicago", year: 1996 },
    yachtsoul:      { place: "San Francisco", year: 1976 },
    yachtrock:      { place: "Austin", year: 1979 },
    songwriterpiano: { place: "New York", year: 1971 },
    softfolk:       { place: "Chapel Hill", year: 1970 },
    singersongwriter: { place: "New York", year: 1972 },
    coastrock:      { place: "Sausalito", year: 1977 },
    folkrock:       { place: "Los Angeles", year: 1965 },
    countryrock:    { place: "Nashville", year: 1968 },
    heartlandrock:  { place: "Asbury Park", year: 1975 },
    southernrock:   { place: "Macon", year: 1969 },
    rootsrock:      { place: "Berkeley", year: 1969 },
    chamberpop:     { place: "Boston", year: 1994 },
    spacerock:      { place: "London", year: 1973 },
    studioprog:     { place: "St John's Wood", year: 1973 },
    bleakprog:      { place: "London", year: 1976 },
    rockopera:      { place: "Provence", year: 1979 },
    stadiumprog:    { place: "London", year: 1987 },
    grebo:          { place: "Stourbridge", year: 1990 },
    melodictechno:  { place: "Kent", year: 1991 },
    bleeptechno:    { place: "Manchester", year: 1989 },
    industrialbreaks: { place: "Swindon", year: 1989 },
    industrialrock: { place: "Cleveland", year: 1989 },
    analogsynthpop: { place: "Basildon", year: 1980 },
    gothsynth:      { place: "Basildon", year: 1990 },
    gothicpop:      { place: "Crawley", year: 1987 },
    postpunk:       { place: "Manchester", year: 1979 },
    avantfunk:      { place: "New York", year: 1980 },
    dancepostpunk:  { place: "Manchester", year: 1983 },
    madchester:     { place: "Manchester", year: 1990 },
    janglepop:      { place: "Manchester", year: 1984 },
    indiedance:     { place: "Glasgow", year: 1990 },
    organum:        { place: "Paris", year: 1200 },
    troubadour:     { place: "Provence", year: 1210 },
    estampie:       { place: "Paris", year: 1300 },
    arsnova:        { place: "Reims", year: 1360 },
    pavane:         { place: "Antwerp", year: 1551 },
    continuo:       { place: "Florence", year: 1602 },
    concerto:       { place: "Venice", year: 1725 },
    oratorio:       { place: "Dublin", year: 1742 },
    classical:      { place: "Vienna", year: 1785 },
    symphony:       { place: "Vienna", year: 1788 },
    stringquartet:  { place: "Vienna", year: 1782 },
    pianosonata:    { place: "Vienna", year: 1802 },
    requiem:        { place: "Vienna", year: 1791 },
    nocturne:       { place: "Paris", year: 1835 },
    etude:          { place: "Paris", year: 1833 },
    characterpiece: { place: "London", year: 1832 },
    concertoverture: { place: "Berlin", year: 1826 },
    romantic:       { place: "Vienna", year: 1876 },
    variations:     { place: "Vienna", year: 1873 },
    symphonicpoem:  { place: "Weimar", year: 1854 },
    grandopera:     { place: "Paris", year: 1831 },
    musicdrama:     { place: "Munich", year: 1865 },
    nationalism:    { place: "Prague", year: 1874 },
    ballet:         { place: "Moscow", year: 1877 },
    verismo:        { place: "Rome", year: 1890 },
    impressionism:  { place: "Paris", year: 1894 },
    barcarolle:     { place: "Paris", year: 1881 },
    parlor:         { place: "New York", year: 1892 },
    amapiano:       { place: "Johannesburg", year: 2020 },
    afrobeats:      { place: "Lagos", year: 2021 },
    hyperpop:       { place: "London", year: 2021 },
    bailefunk:      { place: "Rio de Janeiro", year: 2022 },
    corridotumbado: { place: "Guadalajara", year: 2023 },
    punjabipop:     { place: "Chandigarh", year: 2022 },
    mahraganat:     { place: "Cairo", year: 2021 },
    bedroompop:     { place: "Los Angeles", year: 2020 },
    zema:           { place: "Aksum", year: 540 },
    highlife:       { place: "Accra", year: 1957 },
    marabi:         { place: "Johannesburg", year: 1935 },
    mbube:          { place: "Johannesburg", year: 1939 },
    ethiojazz:      { place: "Addis Ababa", year: 1969 },
    congorumba:     { place: "Kinshasa", year: 1960 },
    kwaito:         { place: "Johannesburg", year: 1994 },
    mandeguitar:    { place: "Bamako", year: 1970 },
    rai:            { place: "Oran", year: 1985 },
    son:            { place: "Havana", year: 1928 },
    bolero:         { place: "Havana", year: 1948 },
    mambo:          { place: "Mexico City", year: 1950 },
    salsa:          { place: "New York", year: 1973 },
    cumbia:         { place: "Barranquilla", year: 1960 },
    vallenato:      { place: "Valledupar", year: 1975 },
    samba:          { place: "Rio de Janeiro", year: 1939 },
    choro:          { place: "Rio de Janeiro", year: 1900 },
    forro:          { place: "Recife", year: 1950 },
    merengue:       { place: "Santo Domingo", year: 1955 },
    bachata:        { place: "Santo Domingo", year: 1992 },
    calypso:        { place: "Port of Spain", year: 1956 },
    soca:           { place: "Port of Spain", year: 1979 },
    mento:          { place: "Kingston", year: 1952 },
    rocksteady:     { place: "Kingston", year: 1966 },
    dancehall:      { place: "Kingston", year: 1985 },
    huayno:         { place: "Cusco", year: 1965 },
    mariachi:       { place: "Guadalajara", year: 1950 },
    nortena:        { place: "Monterrey", year: 1955 },
    banda:          { place: "Mazatlán", year: 1938 },
    tropicalia:     { place: "São Paulo", year: 1968 },
    rockenespanol:  { place: "Buenos Aires", year: 1967 },
    nuevacancion:   { place: "Santiago", year: 1966 },
    palmwine:       { place: "Freetown", year: 1950 },
    kwela:          { place: "Johannesburg", year: 1955 },
    mbaqanga:       { place: "Johannesburg", year: 1964 },
    soukous:        { place: "Kinshasa", year: 1985 },
    benga:          { place: "Nairobi", year: 1972 },
    makossa:        { place: "Douala", year: 1972 },
    hiplife:        { place: "Accra", year: 1998 },
    kizomba:        { place: "Luanda", year: 1995 },
    coupedecale:    { place: "Abidjan", year: 2003 },
    shidaiqu:       { place: "Shanghai", year: 1940 },
    enka:           { place: "Tokyo", year: 1969 },
    trot:           { place: "Seoul", year: 1965 },
    cantopop:       { place: "Hong Kong", year: 1984 },
    mandopop:       { place: "Taipei", year: 2003 },
    kroncong:       { place: "Jakarta", year: 1935 },
    dangdut:        { place: "Jakarta", year: 1975 },
    lukthung:       { place: "Bangkok", year: 1970 },
    manilasound:    { place: "Manila", year: 1976 },
    nhacvang:       { place: "Ho Chi Minh City", year: 1968 },
    khmerrock:      { place: "Phnom Penh", year: 1970 },
    filmi:          { place: "Mumbai", year: 1960 },
    qawwali:        { place: "Faisalabad", year: 1988 },
    bhangra:        { place: "Jalandhar", year: 1972 },
    shaabi:         { place: "Cairo", year: 1978 },
    aljil:          { place: "Cairo", year: 1988 },
    arabesk:        { place: "Istanbul", year: 1980 },
    anadolurock:    { place: "Istanbul", year: 1972 },
    iranpop:        { place: "Tehran", year: 1974 },
    kabulpop:       { place: "Kabul", year: 1972 },
    rebetiko:       { place: "Piraeus", year: 1935 },
    fado:           { place: "Lisbon", year: 1955 },
    rumbacatalana:  { place: "Barcelona", year: 1970 },
    irishtrad:      { place: "Dublin", year: 1963 },
    balkanbrass:    { place: "Guča", year: 1985 },
    ragtime:        { place: "Sedalia", year: 1899 },
    swing:          { place: "Kansas City", year: 1938 },
    bluegrass:      { place: "Nashville", year: 1946 },
    sacredharp:     { place: "Philadelphia", year: 1844 },
    zydeco:         { place: "Lafayette", year: 1955 },
    newsfanfare:    { place: "London", year: 1970 },
    breakingnews:   { place: "New York", year: 2006 },
    jumpblues:      { place: "Los Angeles", year: 1946 },
    tinpanalley:    { place: "New York", year: 1924 },
    chorale:        { place: "Nuremberg", year: 1586 },
    belcanto:       { place: "Milan", year: 1831 },
    serial:         { place: "Vienna", year: 1923 },
    taqsim:         { place: "Cairo", year: 1932 },
    firqa:          { place: "Cairo", year: 1964 },
    nuba:           { place: "Tetouan", year: 1790 },
    yayue:          { place: "Suizhou", year: -433 },
    kunqu:          { place: "Suzhou", year: 1598 },
    huiju:          { place: "Beijing", year: 1790 },
    qinqiang:       { place: "Xi'an", year: 1807 },
    guqin:          { place: "Beijing", year: 1956 },
    pipaqu:         { place: "Wuxi", year: 1819 },
    sizhu:          { place: "Shanghai", year: 1920 },
    dhrupad:        { place: "Gwalior", year: 1501 },
    badakhyal:      { place: "Delhi", year: 1740 },
    tappa:          { place: "Lucknow", year: 1780 },
    thumri:         { place: "Lucknow", year: 1856 },
    kriti:          { place: "Thanjavur", year: 1810 },
    varnam:         { place: "Thanjavur", year: 1830 },
    carnatic:       { place: "Chennai", year: 1935 },
    gagaku:         { place: "Nara", year: 752 },
    andalusi:       { place: "Córdoba", year: 822 },
    isorhythm:      { place: "Florence", year: 1436 },
    ballad:         { place: "London", year: 1666 },
    operaseria:     { place: "London", year: 1724 },
    modinha:        { place: "Lisbon", year: 1775 },
    lundu:          { place: "Lisbon", year: 1798 },
    lied:           { place: "Vienna", year: 1814 },
    habanera:       { place: "Havana", year: 1860 },
    spirituals:     { place: "Nashville", year: 1871 },
    danzon:         { place: "Matanzas", year: 1879 },
    maxixe:         { place: "Rio de Janeiro", year: 1895 },
    ottoman:        { place: "Istanbul", year: 1910 },
    neworleans:     { place: "New Orleans", year: 1923 },
    boogiewoogie:   { place: "Chicago", year: 1928 },
    deltablues:     { place: "Clarksdale", year: 1929 },
    bluesrock:      { place: "West Hampstead", year: 1966 },
    boogierock:     { place: "San Francisco", year: 1977 },
    acidrock:       { place: "London", year: 1967 },
    glam:           { place: "London", year: 1971 },
    krautrock:      { place: "Cologne", year: 1971 },
    berlinschool:   { place: "Berlin", year: 1972 },
    phillysoul:     { place: "Philadelphia", year: 1972 },
    quietstorm:     { place: "Los Angeles", year: 1975 },
    eurodisco:      { place: "Munich", year: 1977 },
    gothicrock:     { place: "Northampton", year: 1979 },
    italodisco:     { place: "Milan", year: 1982 },
    miamibass:      { place: "Miami", year: 1986 },
    newjackswing:   { place: "New York", year: 1987 },
    hardcorerave:   { place: "Essex", year: 1991 },
    gfunk:          { place: "Los Angeles", year: 1992 },
    crunk:          { place: "Memphis", year: 1997 },
    grime:          { place: "London", year: 2003 },
    dubstep:        { place: "London", year: 2005 },
    abbasid:        { place: "Baghdad", year: 800 },
    sticheron:      { place: "Constantinople", year: 843 },
    sequence:       { place: "St. Gallen", year: 884 },
    winchester:     { place: "Winchester", year: 1000 },
    antiphon:       { place: "Bingen", year: 1151 },
    francoflemish:  { place: "Venice", year: 1502 },
    secondapratica: { place: "Venice", year: 1610 },
    sacredconcerto: { place: "Dresden", year: 1636 },
    contradanza:    { place: "Havana", year: 1803 },
    holler:         { place: "South Carolina", year: 1853 },
    operetta:       { place: "London", year: 1878 },
    musichall:      { place: "London", year: 1892 },
    furnituremusic: { place: "Paris", year: 1888 },
    march:          { place: "Washington", year: 1889 },
    broadway:       { place: "New York", year: 1927 },
    territoryband:  { place: "Kansas City", year: 1932 },
    cologneschool:  { place: "Cologne", year: 1956 },
    modaljazz:      { place: "New York", year: 1959 },
    girlgroup:      { place: "New York", year: 1960 },
    garagerock:     { place: "Portland", year: 1963 },
    baroquepop:     { place: "Los Angeles", year: 1966 },
    psychrock:      { place: "San Francisco", year: 1966 },
    englishpsych:   { place: "St John's Wood", year: 1967 },
    protopunk:      { place: "New York", year: 1966 },
    deadpanglam:    { place: "London", year: 1972 },
    zodiak:         { place: "Berlin", year: 1968 },
    amenbreak:      { place: "Washington", year: 1969 },
    progrock:       { place: "Isle of Wight", year: 1970 },
    heavymetal:     { place: "Workington", year: 1969 },
    blockparty:     { place: "Bronx", year: 1973 },
    psychfunk:      { place: "Detroit", year: 1975 },
    neworleansfunk: { place: "New Orleans", year: 1969 },
    deepfunk:       { place: "Cincinnati", year: 1970 },
    jazzfunk:       { place: "San Francisco", year: 1973 },
    gogo:           { place: "Washington", year: 1978 },
    boogie:         { place: "New York", year: 1981 },
    minneapolissound: { place: "Minneapolis", year: 1982 },
    arenafunk:      { place: "Minneapolis", year: 1984 },
    newjackband:    { place: "Minneapolis", year: 1991 },
    technopop:      { place: "Tokyo", year: 1978 },
    nwobhm:         { place: "London", year: 1980 },
    thrash:         { place: "San Francisco", year: 1983 },
    speedmetal:     { place: "Huntington Park", year: 1986 },
    progmetal:      { place: "San Francisco", year: 1988 },
    powermetal:     { place: "Hamburg", year: 1985 },
    metalcore:      { place: "Westfield", year: 2002 },
    triphop:        { place: "Bristol", year: 1991 },
    chopped:        { place: "Houston", year: 1995 },
    synthwave:      { place: "Paris", year: 2010 },
    footwork:       { place: "Chicago", year: 2013 },
    gqom:           { place: "Durban", year: 2016 },
    hohlefels:      { place: "Hohle Fels", year: -33000 },
    jiahu:          { place: "Jiahu", year: -6000 },
    urlyre:         { place: "Ur", year: -2500 },
    hurrian:        { place: "Ugarit", year: -1400 },
    delphic:        { place: "Delphi", year: -128 },
    carmen:         { place: "Rome", year: -17 },
    skolion:        { place: "Tralles", year: 100 },
    oxyrhynchus:    { place: "Oxyrhynchus", year: 300 },
    hardcore:       { place: "Washington", year: 1980 },
    honkytonk:      { place: "Fort Worth", year: 1941 },
    westernswing:   { place: "Tulsa", year: 1940 },
    nashvillesound: { place: "Nashville", year: 1957 },
    mountaincountry: { place: "Nashville", year: 1971 },
    outlawcountry:  { place: "Austin", year: 1973 },
    dreampop:       { place: "London", year: 1984 },
    slowcore:       { place: "Boston", year: 1989 },
    ambientpop:     { place: "Sutton Courtenay", year: 1993 },
    balearic:       { place: "Montreal", year: 2011 },
    artrock:        { place: "Oxford", year: 1997 },
    baggy:          { place: "Manchester", year: 1988 },
    softrock:       { place: "London", year: 1974 },
    electroindustrial: { place: "Vancouver", year: 1986 },
    electropop:     { place: "Chicago", year: 1983 },
    artpop:         { place: "Kent", year: 1985 },
    worldbeat:      { place: "London", year: 1977 },
    beiruttarab:    { place: "Beirut", year: 1957 },
    hinrg:          { place: "Brixton", year: 1984 },
    newpop:         { place: "Liverpool", year: 1980 },
    doom:           { place: "Stockholm", year: 1986 },
    jpop:           { place: "Tokyo", year: 1999 },
    contenanceangloise: { place: "London", year: 1420 },
    deathrock:      { place: "Pomona", year: 1982 },
    batcave:        { place: "London", year: 1982 },
    coldwave:       { place: "Rennes", year: 1979 },
    leedsgoth:      { place: "York", year: 1981 },
    gothicmetal:    { place: "Halifax", year: 1991 },
    symphonicmetal: { place: "Kitee", year: 1997 },
    dungeonsynth:   { place: "Notodden", year: 1994 },
    witchhouse:     { place: "Traverse City", year: 2010 },
    gypsyjazz:      { place: "Paris", year: 1934 },
    latinjazz:      { place: "New York", year: 1947 },
    descarga:       { place: "Havana", year: 1957 },
    capejazz:       { place: "Cape Town", year: 1974 },
    tradjazz:       { place: "London", year: 1954 },
    indojazz:       { place: "London", year: 1966 },
    japanjazz:      { place: "Tokyo", year: 1974 },
    nordicjazz:     { place: "Oslo", year: 1970 },
    tsabatsaba:     { place: "Bulawayo", year: 1947 },
    acidjazz:       { place: "London", year: 1988 },
    viennadownbeat: { place: "Vienna", year: 1993 },
    noirhop:        { place: "Bristol", year: 1994 },
    knowlewest:     { place: "Bristol", year: 1995 },
    chillout:       { place: "London", year: 1996 },
    torchbreaks:    { place: "Manchester", year: 1996 },
    instrumentalhiphop: { place: "San Francisco", year: 1996 },
    downtempo:      { place: "Washington", year: 1996 },
    versailles:     { place: "Versailles", year: 1998 },
    bristolsound:   { place: "Bristol", year: 1998 },
    nujazz:         { place: "Paris", year: 2000 },
    tromso:         { place: "Tromsø", year: 2001 },
    shanty:         { place: "London", year: 1961 },
    appalachia:     { place: "Hot Springs", year: 1916 },
    oldtime:        { place: "Galax", year: 1935 },
    klezmer:        { place: "New York", year: 1923 },
    georgian:       { place: "Tbilisi", year: 1966 },
    nordicfolk:     { place: "Oslo", year: 1853 },
    chanson:        { place: "Paris", year: 1936 },
    taraf:          { place: "Clejani", year: 1986 },
    flamenco:       { place: "Granada", year: 1922 },
    mbuti:          { place: "Epulu", year: 1958 },
    nursery:        { place: "London", year: 1744 },
    polka:          { place: "Prague", year: 1837 },
    cajun:          { place: "New Orleans", year: 1928 },
    tarantella:     { place: "Galatina", year: 1959 },
    seannos:        { place: "Carna", year: 1957 },
    barbershop:     { place: "New York", year: 1910 },
    photoplay:      { place: "Cleveland", year: 1913 },
    goldenagescore: { place: "Los Angeles", year: 1938 },
    suspensescore:  { place: "Los Angeles", year: 1960 },
    spaghettiwestern: { place: "Rome", year: 1966 },
    spyscore:       { place: "London", year: 1962 },
    horrorsynth:    { place: "Los Angeles", year: 1978 },
    copshowsynth:   { place: "Miami", year: 1984 },
    sitcom:         { place: "Los Angeles", year: 1983 },
    sitcomsting:    { place: "Los Angeles", year: 1989 },
    spaceopera:     { place: "Los Angeles", year: 1979 },
    epichybrid:     { place: "Santa Monica", year: 2010 },
    trailerscore:   { place: "Los Angeles", year: 2012 },
    crimejazz:      { place: "Los Angeles", year: 1955 },
    fantasyscore:   { place: "Wellington", year: 2001 },
    nordicscore:    { place: "Reykjavík", year: 2015 },
    dramascore:     { place: "Los Angeles", year: 1999 },
    frontierscore:  { place: "Los Angeles", year: 1958 },
    waltz:          { place: "Vienna", year: 1867 },
    musette:        { place: "Paris", year: 1880 },
    schlager:       { place: "Hamburg", year: 1960 },
    iskelma:        { place: "Helsinki", year: 1955 },
    tarab:          { place: "Cairo", year: 1934 },
    dastgah:        { place: "Tehran", year: 1925 },
    jingju:         { place: "Beijing", year: 1918 },
    khyal:          { place: "Mumbai", year: 1965 },
    gamelan:        { place: "Surakarta", year: 1956 },
    tapemusic:      { place: "Paris", year: 1948 },
    horrorscore:    { place: "Bray", year: 1958 },
    idm:            { place: "Sheffield", year: 1992 },
    exotica:        { place: "Honolulu", year: 1957 },
    muwashshah:     { place: "Cairo", year: 1200 },
    zajal:          { place: "Córdoba", year: 1150 },
    soundsystem:    { place: "Kingston", year: 1950 },
    jubilee:        { place: "Nashville", year: 1909 },
    rumba:          { place: "Matanzas", year: 1956 },
    lautari:        { place: "Bucharest", year: 1906 },
    doina:          { place: "Maramureș", year: 1912 },
    chazzanut:      { place: "New York", year: 1912 },
    qiyan:          { place: "Medina", year: 705 },
    hardingfele:    { place: "Oslo", year: 1849 },
    tasnif:         { place: "Tehran", year: 1924 },
    scotsfiddle:    { place: "Edinburgh", year: 1796 },
    grunge:         { place: "Seattle", year: 1991 },
    postgrunge:     { place: "Seattle", year: 1995 },
    britpop:        { place: "Manchester", year: 1994 },
    postbritpop:    { place: "London", year: 2000 },
    poppunk:        { place: "Berkeley", year: 1994 },
    numetal:        { place: "Los Angeles", year: 2000 },
    glammetal:      { place: "Los Angeles", year: 1987 },
    funkrock:       { place: "Los Angeles", year: 1984 },
    blackmetal:     { place: "Oslo", year: 1993 },
    skapunk:        { place: "Long Beach", year: 1996 },
    collegerock:    { place: "Athens", year: 1983 },
    raprock:        { place: "New York", year: 1986 },
    southernhiphop: { place: "Atlanta", year: 1996 },
    contemporaryrnb: { place: "Virginia Beach", year: 1997 },
    trance:         { place: "Berlin", year: 1994 },
    eurodance:      { place: "Milan", year: 1993 },
    teenpop:        { place: "Stockholm", year: 1998 },
    retrosoul:      { place: "London", year: 2006 },
    neotraditional: { place: "Nashville", year: 1990 },
    smoothjazz:     { place: "Los Angeles", year: 1986 },
    chiptune:       { place: "Kyoto", year: 1985 },
    ccm:            { place: "Nashville", year: 1978 },
    worship:        { place: "Sydney", year: 1993 },
    indiefolk:      { place: "London", year: 2009 },
    powerpop:       { place: "Memphis", year: 1972 },
    skatepunk:      { place: "Los Angeles", year: 1988 },
    indietronica:   { place: "Seattle", year: 2003 },
  };
  /* WHEN:END */

  /* THE SIX THAT ARE NOT PLACES. genres.js:306 already ruled on them: "The six
     FUNCTION genres … declare nothing: a role has a job, not a history." A role
     is not a city and 1969 is not a fact about a pad. They are named HERE, with
     a reason each, so that a 123rd genre arriving with no atlas row FAILS gate
     G1 by name instead of vanishing quietly off the map. */
  const EXCLUDE = {
    /* ...AND THE BLANK STATE, WHICH IS THE SEVENTH AND IS NOT A ROLE
       (2026-09-01). Paul: "Add a 'silence' genre at the top of the genre list.
       This is a blank state." The six above are FUNCTIONS — a job, not a
       history. `silence` is a seventh kind of not-a-place: it is where the box
       starts before a hand has chosen anything, and there is no city and no
       year at which nothing was played. The gate's assertion is rewritten in
       place — "six roles" becomes "six roles and the blank state" — rather
       than loosened, because the number is still the point. */
    /* THE VALUE IS A COPY KEY, NOT A SENTENCE (2026-09-05, the functional text
       pass). It held seven hand-written paragraphs — "a role: the voices
       behind it, in any city" — and ui/atlas.js printed them straight onto the
       index row as its accessible name and its `data-why`. This file is a
       classic <script> and is also `require`d by atlas.gate.js in node, so it
       may not call `COPY.t` at load time; it holds the ADDRESS of the sentence
       and ui/atlas.js reads it at the moment the row is drawn (TABLE.md §12b).
       Six of the seven share one sentence because they are one fact; `silence`
       is the seventh kind of not-a-place and keeps its own. */
    silence: "atlas.silence",
    /* ...AND THE THREE STARTING POINTS, WHICH ARE THE EIGHTH, NINTH AND TENTH
       KIND OF NOT-A-PLACE (2026-09-06). Paul: "Add a few simple genres at the
       top: dance, rock, pop — really basic starting points to go with silent."
       They are here on `silence`'s own argument, one step further along: a
       blank state is where the box starts with nobody playing, and these are
       where it starts with a small band already seated. Neither is a role and
       neither is a record — there is no city and no year at which
       dance-in-general, rock-in-general or pop-in-general was played, and
       inventing one would be this table's first lie. The rows themselves say
       so the same way (`nukernel/genres/dance.json` and its two siblings), and
       genres-build G2 is what lets them: a "Place Year" label IF AND ONLY IF
       the row declares parents, so a row with no history takes a plain word.
       `guitarrock` and not `rock` because `rock` is London 1969 and has been
       that key in every saved session this box has written; the reason is
       argued in full in that row's own note.
       The gate's assertion below is rewritten in place — "six roles and the
       blank state" becomes "...and the three starting points" — rather than
       loosened, because the number is still the point. */
    dance:      "atlas.starter",
    guitarrock: "atlas.starter",
    pop:        "atlas.starter",
    simple:  "atlas.role",
    solo:    "atlas.role",
    vocal:   "atlas.role",
    backing: "atlas.role",
    riff:    "atlas.role",
    pad:     "atlas.role",
  };

  /* ======================================================================
     2b · THE COVERAGE FRAME — nine regions, and the empty ones NAMED
     ======================================================================
     WORLD.md §4: "'All major historical world genres' cannot be a list you
     finish; it can be a GRID you fill — nine Garland regions x the functions
     each region's music performs … The stopping rule is the grid, not the
     number: a cell is filled or DECLARED EMPTY WITH A REASON, exactly as
     `EXCLUDE` declares the six roles that are not places."

     So this is EXCLUDE's twin, one tier up: which region each dot is in, and
     for the regions with no dot, why not. It is a table of PLACES and not of
     genres, because a region is a fact about geography and geography is what
     this file owns — a genre's region is then its place's, derived, and the
     day a genre moves city its region moves with it.

     WHY IT IS TYPED AND NOT DERIVED FROM THE COORDINATES, which was tried
     first: ordered latitude/longitude boxes cannot separate Monterrey
     (25.67, -100.32) from Austin (30.27, -97.74) without a box that follows
     the Rio Grande, and a box that follows a river is a hand-typed table
     wearing arithmetic. The rows below are hand-typed and SAY so, exactly
     the way the PLACES coordinates above do — and G12 holds them to PLACES
     in both directions, so a new dot with no region fails by name and a
     region row with no dot fails as an orphan.

     THE POINT OF THE TABLE IS THE LAST TWO ROWS. Australia and the Pacific
     is EMPTY and the reason is not musical; Central Asia holds exactly one
     dot. Both are printed on every run of test/precompose.js, because "the
     map is the alarm, not the specification" only works if somebody sees the
     alarm. */
  const REGIONS = {
    "Europe": ["Antwerp", "Barcelona", "Basildon", "Berlin", "Bristol",
               "Oxford", "Brixton",
               "Cologne", "Crawley",
               "Dublin", "Düsseldorf", "Essex", "Florence", "Glasgow", "Guča",
               "Milan", "Munich", "Northampton", "Nuremberg",
               "Kent", "Leipzig", "Lisbon", "Liverpool", "London", "Manchester",
               "Muswell Hill", "Paris", "Piraeus", "Provence", "Reims",
               "Reykjavík", "Rome", "Sofia", "Stourbridge", "Swindon", "Venice",
               "Vienna",
               // THE DEBTS ROUND'S SEVEN (2026-08-29). Six are plain European
               // geography: Bingen, Dresden, St. Gallen, Winchester,
               // Workington (NOT Birmingham — the Southall note below
               // measured that dot blocked in advance, and `heavymetal` takes
               // its first named performance instead; the wall held) and
               // the Isle of Wight. CONSTANTINOPLE is the one
               // that needs its sentence, because Istanbul — the same
               // coordinates — sits in the Middle East row below: the dot is
               // `sticheron`, Constantinople 843, Byzantine chant answering to
               // Rome and Athens six centuries before the Ottoman court music
               // that put Istanbul where Garland's volume 6 puts it. Two
               // names, one harbour, two musics, and the geography follows
               // the record both times — Córdoba's own rule, run in reverse.
               "Bingen", "Constantinople", "Dresden",
               "Isle of Wight", "St. Gallen", "Winchester", "Workington",
               // ...AND THE DEEP-TIME ROUND'S THREE (2026-08-30). Hohle Fels
               // and Delphi are plain European geography. TRALLES needs its
               // sentence, because it sits in Anatolia and Istanbul — the
               // same peninsula — is in the Middle East row below: the dot
               // is `skolion`, Tralles 100, a Greek song in Greek notation
               // on a Greek stele, answering to Delphi and Athens fifteen
               // centuries before makam. The geography follows the record —
               // the Córdoba/Constantinople rule, applied a third time.
               "Delphi", "Hohle Fels", "Tralles",
               // ...and the forward debts' one (2026-08-30): Stockholm,
               // plain European geography, the doom row's own city.
               "Stockholm",
               // ...and the goth-and-globe round's five (2026-08-30):
               // Rennes, York, Halifax, Notodden and Oslo — plain
               // European geography, the goth wing's towns and the
               // first Norwegian dots on the map.
               "Halifax", "Notodden", "Oslo", "Rennes", "York",
               // ...and the downtempo round's two (2026-08-30): Versailles
               // (declared inside Paris in WITHIN) and Tromsø, the map's
               // northernmost dot and the third Norwegian one.
               "Tromsø", "Versailles",
               // ...and the folk-floor round's six (2026-08-30). Carna,
               // Clejani, Galatina and Prague are plain European
               // geography. GRANADA files here while Córdoba sits in the
               // Middle East row — two Andalusian dots, two musics: the
               // 1922 Concurso answers to Seville and Madrid, the 822
               // court school to Baghdad and Fez (the Córdoba/
               // Constantinople rule, run forward this time). TBILISI is
               // Garland's own filing: the Europe volume runs to the
               // Caucasus, and a three-part table song answers to no
               // maqam.
               "Carna", "Clejani", "Galatina", "Granada", "Prague",
               "Tbilisi",
               // ...and the ledger round's four (2026-08-30): Bray,
               // Sheffield, Bucharest and Maramureș — plain European
               // geography, the horror stage, Warp's town, the lăutari's
               // neighbourhood and Bartók's collecting ground.
               "Bray", "Sheffield", "Bucharest", "Maramureș",
               // ...and the unlocking round's one (2026-08-30):
               // EDINBURGH, plain European geography, the second
               // Scottish dot and the Gow family's publishing town.
               "Edinburgh",
               // ...and the dream-pop round's one (2026-08-31): SUTTON
               // COURTENAY, `ambientpop`'s Oxfordshire studio village. Its
               // three refused siblings are in the PLACES ledger above.
               // (the soundtrack round, 2026-09-01, added NO British dot:
               // Denham was refused at the gate — the PLACES ledger above
               // has the measurement.)
               // ...and the genre-QA round's one (2026-09-03): WEST
               // HAMPSTEAD, `bluesrock`'s half-mile of NW6 — Decca Studios
               // on Broadhurst Gardens and Klooks Kleek round the corner.
               // It is the fourth name in this list with a WITHIN row
               // rather than a plain dot, and the PLACES ledger above has
               // the four measurements that made that the honest answer.
               // ...and the genre-QA round's batch C (2026-09-03): three
               // plain northern-European dots — HAMBURG (`schlager` 1960
               // and `powermetal` 1985, one dot and two labels twenty-five
               // years apart), HELSINKI (`iskelma` 1955, the first Finnish
               // dot) and KITEE (`symphonicmetal` 1997, the second, a town
               // of ten thousand in North Karelia). The three measurements
               // are in the PLACES ledger above.
               "Sutton Courtenay", "West Hampstead",
               // ...and the eighteen-row round of 2026-09-07 adds two English
               // dots, both forced by a (place, year) collision and both
               // declared WITHIN a dot this list already holds: ST JOHN'S WOOD
               // (Abbey Road NW8, carrying `englishpsych` 1967 and `studioprog`
               // 1973 — London 1967 is `acidrock`'s and London 1973 is
               // `spacerock`'s) and ASTON TIRROLD (Traffic's Berkshire cottage,
               // 11 km from Sutton Courtenay above — London 1970 is
               // `newsfanfare`'s). The measurements are in the PLACES ledger.
               "St John's Wood", "Aston Tirrold",
               "Hamburg", "Helsinki", "Kitee",
               // ...and the classical-period round's two (2026-09-03).
               // WEIMAR is plain German geography — `symphonicpoem` 1854,
               // Liszt's Hoftheater — and the PLACES ledger above has its
               // crowding measurement, which is the tightest European one
               // in the table (23.2 units from Leipzig, under the floor,
               // declared). MOSCOW needs its sentence for the opposite
               // reason: it is the map's FIRST RUSSIAN DOT (`ballet` 1877,
               // Swan Lake at the Bolshoi) and it files in Europe on
               // Tbilisi's own ruling three comments up — Garland's Europe
               // volume runs to the Caucasus, and a Moscow ballet score
               // answers to Vienna and Paris and to no maqam. It is also
               // the only name in this row that falls OUTSIDE the Europe
               // rectangle (lon 37.6 against the edge at 32) and therefore
               // flies at the world arc.
               "Moscow", "Weimar"],
    "North America": ["Santa Monica",
                      "Vancouver", "Atlanta", "Austin", "Boston", "Chapel Hill", "Charlotte",
                      "Chicago", "Cincinnati", "Cleveland", "Detroit",
                      "Greenwich Village", "Harlem", "Clarksdale", "Kansas City", "Lafayette",
                      "Las Vegas", "Los Angeles", "Memphis", "Miami", "Nashville",
                      "New Orleans", "New York", "Oklahoma City", "Orlando",
                      "Montreal", "Philadelphia", "Portland", "San Diego",
                      "San Francisco",
                      "Sausalito", "Sedalia", "St. Louis", "Tampa", "Teaneck",
                      "Toronto",
                      // ...and the Chordonomicon-gaps round's one (2026-09-02):
                      // Asbury Park, for `heartlandrock` — PLACES says what it
                      // measured about the crowding and why it is a plain dot.
                      "Asbury Park",
                      // ...and the MIDI-corpus round's five (2026-09-02):
                      // Seattle, Berkeley, Long Beach, Athens and
                      // Virginia Beach — plain North American geography,
                      // the 1983-2000 guitar-band and R&B wing's towns.
                      // Athens is Georgia's, and PLACES says why.
                      "Athens", "Berkeley", "Long Beach", "Seattle",
                      "Virginia Beach",
                      // ...and the funk round's one (2026-09-03): Minneapolis,
                      // for `minneapolissound`. The round's other five reuse
                      // dots this arc already holds — Cincinnati, New Orleans,
                      // San Francisco, Washington and New York.
                      "Minneapolis",
                      // ...and the genre-QA round's one (2026-09-03): MACON,
                      // for `southernrock` — Capricorn Records' town. The
                      // round's other four reuse dots this arc already holds
                      // (Memphis, Nashville, Austin and Berkeley), and the
                      // sixth row is British. PLACES says what Macon measured.
                      "Macon",
                      // ...and the Motown-and-four-acts round's three
                      // (2026-09-03): LONG ISLAND for `politicalhiphop` (a
                      // region standing where a city cannot, the South
                      // Carolina precedent, and a plain dot for the Asbury
                      // Park reason), BROOKLYN for `jazzrap` and SOUTH
                      // CENTRAL for `althiphop` — the last two declared
                      // inside their cities in WITHIN, the Harlem relation.
                      // The round's other four rows reuse dots this arc
                      // already holds: Detroit twice, Manchester (Britain)
                      // and New York. PLACES has the three measurements.
                      "Long Island", "Brooklyn", "South Central",
                      // ...and the eighteen-row round of 2026-09-07 adds two,
                      // one per coast, each declared WITHIN the city beside it:
                      // THE BOWERY (CBGB at 315, `artpunk` 1977 — New York 1977
                      // is `disco`'s) and HUNTINGTON PARK (where Slayer formed
                      // in 1981, `speedmetal` 1986 — Los Angeles 1986 is
                      // `smoothjazz`'s).
                      "Bowery", "Huntington Park",
                      // ...and the debts round's four (2026-08-29): Washington
                      // (a march and a B-side eighty years apart), the Bronx,
                      // Houston, and SOUTH CAROLINA — a state standing where a
                      // city cannot: Olmsted's holler names no town, and the
                      // dot is the state's own centre, the Provence/Essex
                      // precedent one column over.
                      "Bronx", "Houston", "South Carolina", "Washington",
                      // ...and the forward debts' two (2026-08-30): the
                      // 1940s' missing Texas and Oklahoma country rooms.
                      "Fort Worth", "Tulsa",
                      // ...and the goth-and-globe round's two (2026-08-30):
                      // Pomona (deathrock's LA County town, the Kinks rule)
                      // and Traverse City, Michigan (Salem's own).
                      "Pomona", "Traverse City",
                      // ...and the folk-floor round's two (2026-08-30):
                      // the Blue Ridge pair, Hot Springs (Sharp in Jane
                      // Gentry's kitchen, 1916) and Galax (the fiddlers'
                      // convention, 1935).
                      "Galax", "Hot Springs",
                      // ...and the genre-QA round's batch C (2026-09-03):
                      // WESTFIELD, Massachusetts — `metalcore` 2002, Zing
                      // Studios, sixty-five kilometres west of Boston and
                      // measured clear of it (32.0 units, against G10's
                      // 26-unit floor). A plain dot, no WITHIN row, on the
                      // Asbury Park ruling of one round earlier.
                      "Westfield"],
    // Mexico is here and not in North America, which is a choice and is the
    // one Garland's own volumes make: the musical basin is Ibero-American,
    // and a Sinaloan banda has more to say to a Colombian cumbia than to a
    // Nashville record.
    "Latin America and the Caribbean":
      ["Barranquilla", "Buenos Aires", "Cusco", "Guadalajara", "Havana",
       "Kingston", "Matanzas", "Mazatlán", "Mexico City", "Monterrey",
       "Port of Spain",
       "Recife", "Rio de Janeiro", "San Juan", "Santo Domingo", "São Paulo",
       "Valledupar",
       // ...and the genre-QA round's batch C (2026-09-03): SANTIAGO,
       // `nuevacancion` 1966 — the map's first Chilean dot, and one of the
       // names this file's own header has listed as wanted since it was
       // written.
       "Santiago"],
    // CAIRO AND ORAN ARE IN THE MIDDLE EAST ROW AND NOT IN THIS ONE, which
    // is Garland's own division and not a claim about continents: the
    // Encyclopedia's volume 6 is "The Middle East" and it covers Egypt and
    // the Maghreb, because a shaabi record answers to Beirut and Istanbul
    // rather than to Lagos. Aksum stays here — Ethiopian sacred chant is in
    // volume 1 and belongs to it.
    "Africa": ["Abidjan", "Accra", "Addis Ababa", "Aksum", "Bamako",
               "Douala", "Durban", "Freetown", "Johannesburg", "Kinshasa",
               "Lagos", "Luanda", "Nairobi",
               // ...and the goth-and-globe round's two (2026-08-30):
               // Bulawayo (tsabatsaba, the first Zimbabwean dot) and Cape
               // Town (capejazz), the map's southernmost city.
               "Bulawayo", "Cape Town",
               // ...and the folk-floor round's one (2026-08-30): Epulu,
               // the Ituri forest — Turnbull's own camp, the map's first
               // dot in the rainforest interior.
               "Epulu"],
    // Jiahu (2026-08-30) is the region's oldest dot by seven millennia —
    // a Neolithic site on the Huai River plain, Garland's East Asia volume
    // opens with exactly these flutes.
    "East Asia": ["Beijing", "Hong Kong", "Jiahu", "Nara", "Seoul", "Shanghai",
                  "Taipei", "Tokyo",
                  // ...and the MIDI-corpus round's one (2026-09-02):
                  // Kyoto, `chiptune`'s own city — plain Japanese
                  // geography, and Nara is already here to prove it.
                  "Kyoto",
                  // ...and the India-and-China batch's four (2026-09-03):
                  // Suzhou, Wuxi, Xi'an and Suizhou. G11d catches a dot with
                  // no region within the day, so they are filed the morning
                  // they are added rather than the morning after — all four
                  // are mainland China and three of them are within four
                  // hundred kilometres of dots already in this row.
                  "Suzhou", "Wuxi", "Xi'an", "Suizhou"],
    // Surakarta (2026-08-30, the walls-down round's own dot): `gamelan`
    // landed at Lokananta's city the same morning this row was last read,
    // and the region gate (G11d) caught the dot with no region within the
    // day — central Java, the same island Jakarta already proves.
    "Southeast Asia": ["Bangkok", "Ho Chi Minh City", "Jakarta", "Manila",
                       "Phnom Penh", "Surakarta"],
    "South Asia": ["Chandigarh", "Chennai", "Delhi", "Faisalabad",
                   "Jalandhar", "Mumbai",
                   // ...and the India-and-China batch's two (2026-09-03):
                   // Lucknow, 440 km east of Delhi, and Thanjavur, 330 km
                   // south of Chennai — the two courts this table's Indian
                   // rows were made in and had no dots for.
                   "Lucknow", "Thanjavur",
                   // ...and the dhrupad re-dating's one (2026-09-04):
                   // GWALIOR, 282 km south of Delhi and 284 km west of
                   // Lucknow — Man Singh Tomar's fort city, and the third
                   // point of a triangle whose other two corners were
                   // already here. It is the only dot in this row that
                   // arrived for a genre the table ALREADY HAD: `dhrupad`
                   // moved from Delhi 1955 to Gwalior 1501 so that three
                   // eighteenth- and nineteenth-century rows could declare
                   // it a parent. The PLACES ledger above has the run.
                   "Gwalior"],
    // Turkey and Iran sit here rather than in Europe or in Central Asia, and
    // Istanbul is the case that forces the decision: the city is on two
    // continents and the MUSIC — makam, usul, the arabesk string orchestra —
    // answers to Cairo and Tehran, not to Vienna.
    // TETOUAN JOINS ORAN IN THIS ROW, for the reason the Africa comment above
    // already gives: Garland's volume 6 covers the Maghreb, and the Andalusian
    // nuba answers to Fez, Algiers and Cairo rather than to Bamako.
    // AND CÓRDOBA JOINS TETOUAN (2026-08-29), which looks odd beside
    // Barcelona-in-Europe until you ask the Garland question the Tetouan
    // comment already answered: the dot is `andalusi`, Córdoba 822, the
    // Umayyad court school whose repertory IS the nuba's — volume 6
    // material, answering to Baghdad and Fez, not to a Spain that would
    // not exist for six centuries. The geography follows the record, the
    // way Kinshasa's spelling followed the map.
    // AND BAGHDAD JOINS (2026-08-29) — the dot is `abbasid`, Baghdad 800,
    // the Abbasid court the whole row answers to; volume 6's own centre.
    // AND THE DEEP-TIME ROUND'S THREE (2026-08-30): Ur and Ugarit are
    // Mesopotamia and the Levant, the row's own deepest past — Garland
    // volume 6 opens its history with exactly these lyres and this tablet.
    // OXYRHYNCHUS is Egypt, the same Garland ruling that put Cairo here;
    // that its one record is a CHRISTIAN hymn in Greek does not move the
    // dot, any more than zema's church moved Aksum out of Africa.
    // ...AND MEDINA JOINS (2026-08-30, the unlocking round) — the row's
    // first dot on the Arabian peninsula and the oldest Arab record on
    // the map, `qiyan` (Medina 705), ninety-five years upstream of the
    // Baghdad dot beside it and a hundred and seventeen upstream of the
    // Córdoba one. No Garland argument is even needed here: the Hejaz is
    // the Middle East by every filing anyone has ever used, and the two
    // rows it parents are already in this row.
    "Middle East": ["Beirut", "Baghdad", "Cairo", "Córdoba", "Istanbul", "Medina",
                    "Oran", "Oxyrhynchus", "Tehran", "Tetouan", "Ugarit",
                    "Ur"],
    "Central Asia": ["Kabul"],
    // THE NINTH REGION OPENS, 2026-08-30 (the ledger round). It was
    // declared EMPTY below with the sentence "one re-bake of the
    // coastline unblocks the Pacific half of this row" — the re-bake
    // happened this round (Honolulu in PLACES, PKEEP keeping Oahu's
    // ring out of the 1:50m source), and `exotica` (Honolulu 1957) is
    // the region's first record. Honiara, and Australia's own two
    // musically-blocked candidates, are still owed — see the reversed
    // declaration just below, kept as history.
    // ...and the soundtrack round's one (2026-09-01): WELLINGTON, the
    // region's second dot and its first south of the equator — the row
    // Honolulu unblocked now has a pair.
    // ...and the genre-QA round's one (2026-09-03): SYDNEY, for `worship`.
    // The region's third dot, its second south of the equator and its first
    // on a continent rather than an island — the half of this row the
    // ledger's old declaration said was "blocked musically instead".
    "Australia and the Pacific": ["Honolulu", "Wellington", "Sydney"],
  };
  /* THE EMPTY CELL, DECLARED — AND THEN FILLED (2026-08-30). The
     declaration below held from the world round until the ledger round
     re-baked the coastline; it is kept verbatim as the record of WHY the
     region was empty, with the table above now holding the dot it said a
     re-bake would unblock. REGIONS_EMPTY is empty and stays exported —
     the gates iterate it and a region going empty again must land here
     with a reason, exactly as before.
     The old declaration, verbatim: "no dot in this region can be PROVED
     to stand on land: atlas-land.js bakes Natural Earth's physical land
     and holds no Pacific islands at all — the nearest baked point to
     Honolulu is 33.9 degrees away and to Honiara 9.0 — so hapa-haole
     (Honolulu 1915) and Melanesian string band (Honiara 1975) were
     written, measured, and held back rather than drawn over open water.
     Australia's own two candidates are blocked musically instead:
     manikay has no yidaki id and no bar. One re-bake of the coastline
     unblocks the Pacific half of this row." */
  const REGIONS_EMPTY = {};

  /* ======================================================================
     3 · THE DERIVED YEAR AXIS
     ======================================================================
     65 stops, one per year the catalog actually has. Derived at load and never
     typed: the day a genre is added with a new year the slider grows a stop by
     itself. THIS IS THE SCALE FUNCTION — `yearAt(i) = YEARS[i]` — and the whole
     argument for it is density. Measured 2026-08-24: 17 records before 1900,
     5 in 1900-49, 94 from 1950. A linear 600→2013 slider spends 72% of its
     travel on 22 records. Rank spends every stop on a year that EXISTS (G6),
     so there is no dead scroll position anywhere on the control. */
  const YEARS = Array.from(new Set(Object.keys(WHEN).map((k) => WHEN[k].year)))
    .sort((a, b) => a - b);

  /* THE WORDS FOR THE YEARS. band-kit's own DECADES (band-kit.js:1820-1824),
     GROW-ONLY — every existing word keeps its place, so every existing tap
     still lands — plus the two the band page cannot reach: five records sit in
     the thirties and forties (gospel 1932, tango 1935, yuletide 1942, jazz
     1945, countrypop 1945) and band-kit's list jumps 1800s -> the fifties.
     Each `y` is the FIRST catalog year of its era, so the menu always lands on
     a real record. G5b holds both halves of that.

     "NOW" WAS A LIE AND IT IS NOW DERIVED. Paul, 2026-08-24: "'now' is a lie,
     it's the 2010s. Add the 2020s as now." He is right and it was worse than he
     said: this row read { w: "now", y: 2011 } while the catalog's newest record
     was retrofunkpop, Los Angeles 2013, and nothing in genres.js was past 2013
     — all 116 checked. So the 2011 row is renamed to what it actually is, and
     "now" becomes a row that EXISTS ONLY IF THE CATALOG REACHES THE 2020s.

     DERIVED, NOT TYPED, because this slice does not own genres.js and the 2020s
     anchor lands there in a parallel hand. A hard-coded { w: "now", y: 2020 }
     would be the same lie one decade later — G5b's law is that every ERAS year
     is a real catalog year, and a word with no record behind it is exactly what
     that law exists to catch. The day an anchor with a 2020s label lands, YEARS
     grows a stop by itself (it is derived from WHEN) and this row appears with
     the real year of that record in it. Nothing else has to change.

     The era <select> is gone with the rest of the navigation UX, so ERAS is no
     longer a control at all: it supplies the word in #atlasSay and it is what
     G5b measures. */
  const ERAS = (() => {
    const rows = [
      // DEEP TIME ARRIVED 2026-08-30 (Paul: "look backwards in time to bone
      // flutes and lutes"). Five era words for the forty millennia the
      // catalog now reaches below Aksum, each `y` the FIRST catalog year of
      // its era per this table's own rule, each a REAL record: the Hohle
      // Fels flute (33000 BC — the artifact's own ~35,000 BP, not the
      // tradition's 43,000), the Jiahu gudi (6000 BC), the Ur lyres
      // (2500 BC; the bronze age also holds Ugarit 1400 BC), the Delphic
      // Hymns (128 BC; antiquity also holds Rome 17 BC), and the Seikilos
      // epitaph (Tralles 100; the first centuries also hold Oxyrhynchus
      // 300). G5b holds every one of these to an anchor standing behind it.
      { w: "the old stone age",     y: -33000 },
      { w: "the new stone age",     y: -6000 },
      { w: "the bronze age",        y: -2500 },
      { w: "antiquity",             y: -128 },
      { w: "the first centuries",   y: 100 },
      // THE FIVE-HUNDREDS ARRIVED 2026-08-25 with zema, "Aksum 540" — the
      // oldest record in the catalog and the first era word that is not
      // European. G5b's law is satisfied the only way it can be: 540 is a
      // real catalog year, because an anchor is standing behind it.
      { w: "the five-hundreds",     y: 540 },
      { w: "the six-hundreds",      y: 600 },  { w: "the twelve-hundreds",   y: 1200 },
      { w: "the thirteen-hundreds", y: 1300 },
      // ...and the fourteen-hundreds arrived 2026-08-30 with contenanceangloise,
      // "London 1420": the century had records (isorhythm 1436) but no word,
      // because this table's rule is that each `y` is the FIRST catalog
      // year of its era and until this round the century's first year was
      // taken for granted under "the thirteen-hundreds". GROW-ONLY holds:
      // every earlier word keeps its place.
      { w: "the fourteen-hundreds", y: 1420 },
      { w: "the fifteen-hundreds",  y: 1551 },
      { w: "the sixteen-hundreds",  y: 1602 }, { w: "the seventeen-hundreds", y: 1725 },
      { w: "the eighteen-hundreds", y: 1835 },
      // ...and the two eras the world round put records into, 2026-08-26.
      // The catalog jumped from 1892 to 1932 and now holds Rio de Janeiro
      // 1900 (choro), Havana 1928 (son) and Piraeus 1935 (rebetiko) in
      // between. Same law as every row here: the `y` is a REAL catalog year
      // with an anchor standing behind it, and the list stays GROW-ONLY, so
      // band-kit's DECADES is still a subsequence of it (G5b holds both).
      { w: "the nineteen-hundreds", y: 1900 }, { w: "the twenties",         y: 1928 },
      { w: "the thirties",          y: 1932 },
      { w: "the forties",           y: 1942 }, { w: "the fifties",           y: 1952 },
      // ...and "the sixties" moved 1962 -> 1960 in the same hand, because the
      // rule this table states one paragraph up is that each `y` is the FIRST
      // catalog year of its era, and Kinshasa 1960 is now earlier than
      // Kingston 1962. The word is unchanged; the record it lands on is a
      // year older.
      { w: "the sixties",           y: 1960 }, { w: "the seventies",         y: 1970 },
      { w: "the eighties",          y: 1980 }, { w: "the nineties",          y: 1990 },
      { w: "the two-thousands",     y: 2001 }, { w: "the twenty-tens",       y: 2011 },
    ];
    const now = YEARS.find((y) => y >= 2020);
    if (now != null) rows.push({ w: "now", y: now });
    return rows;
  })();

  /* ======================================================================
     4 · VIEWS — NO LONGER THE ZOOM. NOW THE TABLE arcFor() READS.
     ======================================================================
     REVERSED 2026-08-24, and the paragraph that stood here is kept underneath
     because reversing a decision silently is how the next person makes it
     again. Paul: "Get rid of all ux for navigating except for the 'when' slider
     which should go across the whole screen and the 3d globe. get rid of the
     era select boxes, the look at select box, the 'nearby' select box, the
     genre list, etc." The "look at" <select> WAS this table, so this table
     stops being a control.

     WHAT IT SAID, AND ALL OF IT WAS TRUE OF A PLATE CARRÉE: "A named rectangle
     is the WHOLE zoom mechanism. No pan, no pinch, no gesture state machine —
     the parent's 400-line gestures.js exists to drag waypoints and there are
     none here — and it fixes density and thumb size at once: the Britain view
     puts London and Manchester 78 map units apart where the world view puts
     them 10. (Gate G10 is that measurement, and it is why Britain has a
     rectangle at all.)"

     WHAT IT IS FOR NOW: `arcFor(place)` below asks which of these rectangles is
     the smallest one containing a place, and turns its width into DEGREES OF
     ARC for ui/globe.js to fly to. Five rows of taste about how close you want
     to stand to Manchester, kept as data instead of thrown away and re-guessed
     as a constant. `project`, `heightOf` and `inView` survive with it: they are
     no longer how the page draws, they are the frame gate G10 measures dot
     packing in, which is a question about GEOGRAPHY and not about a projection.

     SEOUL AND TOKYO GET NO RECTANGLE OF THEIR OWN, on purpose: two places, two
     records, and they are 1,150 km apart, which is legible in the world view.
     Do not "fix" this by adding an Asia row — add one when a record makes two
     Japanese cities collide. */
  const VIEWS = {
    "the world":     { lon0: -170, lon1: 180, lat0: -58,  lat1: 78 },
    "Britain":       { lon0: -8,   lon1: 3,   lat0: 49.5, lat1: 58.5 },
    "Europe":        { lon0: -25,  lon1: 32,  lat0: 34,   lat1: 68 },
    "North America": { lon0: -128, lon1: -64, lat0: 16,   lat1: 50 },
    "the south":     { lon0: -90,  lon1: 45,  lat0: -40,  lat1: 25 },
  };

  /* THE MAP WAS 1200 UNITS WIDE, ALWAYS, and its height was DERIVED. Plate
     carrée with SQUARE degrees: one scale for both axes, so no dot was ever
     stretched and the viewBox aspect ratio carried the crop. Two
     multiplications, no trigonometry, invertible in one line.

     NOTHING DRAWS THROUGH THIS ANY MORE — ui/globe.js is an orthographic
     projection of a sphere and `unit()` below is its entry point. It stays
     because gate G10 measures dot packing in it, and because a rectangle is the
     right frame for that question: "are these two places too close to tell
     apart" is about where the cities are, not about which pose the camera
     happens to be in. */
  const W = 1200;
  const project = (v, lat, lon) => {
    const s = W / (v.lon1 - v.lon0);
    return { x: (lon - v.lon0) * s, y: (v.lat1 - lat) * s };
  };
  const heightOf = (v) => (v.lat1 - v.lat0) * (W / (v.lon1 - v.lon0));
  const inView = (v, lat, lon) =>
    lon >= v.lon0 && lon <= v.lon1 && lat >= v.lat0 && lat <= v.lat1;

  /* ======================================================================
     5 · THE QUESTIONS
     ====================================================================== */
  const canon = (name) => (ALIAS[name] || name);
  const placeOf = (name) => {
    const c = canon(name);
    return PLACES[c] ? PLACES[c].slice() : null;
  };

  // BUILT ONCE, at load. 116 rows walked per slider tick, five times a drag,
  // is work nothing asked for; the table is immutable because WHEN is.
  const BYPLACE = {};
  for (const gk of Object.keys(WHEN)) {
    const p = canon(WHEN[gk].place);
    (BYPLACE[p] || (BYPLACE[p] = [])).push(gk);
  }
  for (const p of Object.keys(BYPLACE)) {
    BYPLACE[p].sort((a, b) => WHEN[a].year - WHEN[b].year || (a < b ? -1 : a > b ? 1 : 0));
  }

  /* The label is REBUILT, not stored: `place + " " + year` is exactly the
     genres.js label the regex matched, which is the whole point of G2. Storing
     a copy would be the second source of truth this file exists to avoid. */
  const recordsAt = (place) => (BYPLACE[canon(place)] || []).map((gk) => ({
    gk, year: WHEN[gk].year, label: WHEN[gk].place + " " + WHEN[gk].year,
  }));

  /* IT FILTERS. REVERSED 2026-08-24, AND THE PARAGRAPH IT REVERSES IS KEPT
     UNDERNEATH, because reversing a decision silently is how the next person
     makes it again.

     IT USED TO READ: "IT LIGHTS, IT DOES NOT FILTER. ‘At that moment’ means
     the decade around it: a record made in 1969 is still happening in 1975, a
     map that hides everything else is lying about the world, and a map whose
     dots appear and vanish under a dragging thumb is unusable. So every place
     stays drawn and clickable at every slider position; what the year changes
     is BRIGHTNESS, which names are drawn, and the sentence in #atlasSay."

     PAUL LOOKED AT IT: "Don’t show ghost genres when the time isn’t right.
     Just show genres that align with time." MEASURED on the deployed page at
     600: all 65 marks drawn, and their accessible names read "Antwerp 1551,
     pavane (nothing near 600)", "Atlanta 2003, trap (nothing near 600)" — a
     world full of records that do not exist yet, each politely announcing that
     it does not exist yet. BRIGHTNESS was not enough of a difference to be a
     difference: fill-opacity 0.34 against 1 is a dim dot, and a dim dot is
     still a dot on a map of where the music is.

     BOTH HALVES OF THE OLD PARAGRAPH SURVIVE ANYWAY, WHICH IS WHY THE WINDOW
     AND NOT THE EXACT YEAR IS WHAT NOW DRAWS. Measured over all 69 stops:

       exact year only   1 to 5 places, mean 1.8 — and 37 of the 69 stops hold
                         exactly ONE place. A globe with one dot at more than half
                         its stops is not a map, it is a list of 69 records with an
                         earth behind it, and a dragging thumb replaces the whole
                         picture on every tick.
       ±10 years        1 to 27 places, mean 14.6. Dots enter and leave one or
                         two at a time under a drag, and "a record made in 1969
                         is still happening in 1975" stays true.

     AND AT PAUL’S OWN YEAR THE TWO ARE THE SAME NUMBER: 600 draws exactly ONE
     place either way — Rome. So the window costs nothing against the complaint
     and keeps the map a map everywhere else.

     `shown` IS THE NEW ANSWER AND IT IS THE ONLY ONE. The section had FOUR
     facts about "what is here now" — the dots, the tab order, the labels and
     the sentence — and three of them already used the window; only the dots
     disagreed. They now all read this one Map, so the sentence above the globe
     and the marks on it cannot say different things (test/atlas.js G22). */
  const WINDOW = 10;
  function atYear(Y) {
    const exact = new Set(), near = new Set(), places = new Map();
    for (const gk of Object.keys(WHEN)) {
      const d = Math.abs(WHEN[gk].year - Y);
      if (d === 0) exact.add(gk); else if (d <= WINDOW) near.add(gk); else continue;
      const p = canon(WHEN[gk].place);
      const e = places.get(p) || { n: 0, exact: 0 };
      e.n++; if (d === 0) e.exact++;
      places.set(p, e);
    }
    /* ONE ROW PER PLACE THE YEAR DRAWS, carrying THE record that place resolves
       to — recordAt’s nearest-year rule, so the dot, its name and what Enter
       writes are decided in one line instead of three. `places` (counts) and
       `shown` (records) always have the same keys: a place is in `places`
       because one of its records is inside the window, and recordAt returns the
       NEAREST record, which is then inside it too. */
    const shown = new Map();
    for (const p of places.keys()) shown.set(p, recordAt(p, Y));
    return { exact, near, places, shown };
  }

  const clamp = (i, lo, hi) => (i < lo ? lo : i > hi ? hi : i);
  const yearAt = (i) => YEARS[clamp(i | 0, 0, YEARS.length - 1)];
  /* the largest i with YEARS[i] <= y; 0 below the bottom of the catalog, so a
     caller that hands in 1966 (a year no record has) lands on 1965 rather than
     on nothing. */
  const indexOf = (y) => {
    let out = 0;
    for (let i = 0; i < YEARS.length; i++) if (YEARS[i] <= y) out = i; else break;
    return out;
  };

  /* nearby() IS GONE, AND THIS IS ITS TOMBSTONE. Paul, 2026-08-24: "get rid of
     the era select boxes, the look at select box, the 'nearby' select box, the
     genre list, etc."

     WHAT IT DID: "WHO ELSE THE THUMB MIGHT HAVE MEANT. The recovery path for a
     tap that was aiming at Manchester and landed on London: measured in MAP
     units in the current view, so it tightens automatically when the view zooms
     in." It fed a panel of buttons under the map, and its `cap` argument was
     the fix for the panel offering twenty of them — seven rows standing between
     the reader and the records they came for.

     WHY IT DOES NOT COME BACK. The panel was a recovery path for a map you
     could not zoom. THE GLOBE'S ZOOM IS CONTINUOUS, 180° of arc down to 0.5°,
     so "you meant Manchester, not London" is answered by moving closer instead
     of by reading a list — and the two things that made the miss likely are
     both gone too (a fixed rectangle, and a pile of dots you could not
     separate). What replaces the DISAMBIGUATION half of its job is
     `recordAt()` below plus the tie rule in ui/atlas.js `nearest()`: distance
     decides which marks are candidates, and among marks a thumb cannot separate
     (within 4 CSS px of the closest) the record nearest the slider's year wins.
     (This said "plus PAINT ORDER: at a pile, the mark on top is the one the
     slider is pointing at." That was reversed while the round was still open,
     and the reason is worth keeping: in SVG, paint order IS document order IS
     TAB order, so sorting the marks by distance from the slider's year sorted
     the KEYBOARD as well — Tab from the slider walked the places furthest from
     the year first, with Kingston near the end of nineteen. The marks stay
     alphabetical and the determinism lives in the hit test, where it costs the
     reader nothing.)

     A DEAD EXPORT IS A TRAP, so it left the `api` object with the function.
     BYPLACE, `inView` and `project` all survive and a future recovery panel
     could be rebuilt from them in a dozen lines — but it would need a reason
     the globe does not already answer. */

  /* ======================================================================
     6 · THE SPHERE — the one home for this trigonometry
     ======================================================================
     A right-handed unit vector: +z through 0°N 0°E, +y through the north pole,
     +x through 0°N 90°E. ui/globe.js rotates these by the camera's two angles
     and NEVER calls sin or cos for a point — a frame is 6 multiplies and 4 adds
     per point, and only the camera needs trig. That is the whole reason this
     lives in the data tier rather than in the renderer: two files computing
     "where is Kingston on a sphere" is two files that can disagree about it,
     and the hit test and the picture must agree by construction. */
  const D2R = Math.PI / 180;
  const unit = (lat, lon) => {
    const la = lat * D2R, lo = lon * D2R, cl = Math.cos(la);
    return [cl * Math.sin(lo), cl * Math.cos(lo), Math.sin(la)];
  };

  /* EVERY PLACE, PRE-MULTIPLIED, BUILT ONCE AT LOAD AND FROZEN. One row x 3
     floats. The renderer walks this every frame; recomputing four trig calls
     per place per frame is work nothing asked for, and a frozen table cannot be
     written to by a view that meant to write to its own copy. */
  const UNITS = Object.freeze(Object.keys(PLACES).reduce((o, n) => {
    o[n] = Object.freeze(unit(PLACES[n][0], PLACES[n][1])); return o;
  }, {}));

  /* CONSEQUENCE C OF THE STRIP-DOWN, AS ONE FUNCTION. With the "nearby" panel
     gone, a tap on a place must resolve to EXACTLY ONE record, deterministically.
     THE RULE IS: NEAREST YEAR; A TIE GOES TO THE EARLIER RECORD. It was measured
     twice, independently, by two designers who did not see each other's numbers:

       · (place, year) is a KEY — 0 collisions among all 116 records. So a place
         plus an exact year has never been ambiguous and cannot become so without
         a gate noticing.
       · Nearest-year is a tie in well under 1% of the (place, stop) pairs the
         slider can make — 13 of 4,030 when it was first measured over 62 places
         and 65 stops, 16 of 4,278 after the 2020s anchors landed — and every
         tie is exactly two records. The EARLIER one is the right answer in
         every printed case: Kingston @1971 -> reggae (not dub),
         London @1971 -> rock (not spacerock), Chicago @1942 -> gospel (not
         blues), London @1962 -> skiffle, Austin @1991 -> yachtrock.
       · "The one inside the window" CANNOT disambiguate and was rejected on the
         measurement: 243 (place, stop) pairs hold more than one record inside
         ±10 years, and New York 1973 holds EIGHT. Nearest-year always can, and
         needs no fallback for the outside case.

     A place with no record returns null — today Bristol, Memphis and Reykjavik,
     which only band-kit’s smaller catalog names. THEY ARE NOT DRAWN AT ALL,
     and that is the 2026-08-24 reversal of "ui/atlas.js draws them as dim inert
     dots and NOT as buttons: a button that does nothing is worse than a dot
     that is honestly inert." True as far as it went, and the round that
     followed went further: Paul, "Don’t show ghost genres when the time isn’t
     right. Just show genres that align with time." A dot with NO record aligns
     with no time there is; an inert dot on a map of where the music is says
     "music happened in Bristol" and then refuses to say what. The drift stays
     VISIBLE where drift belongs — atlas.gate.js G6b prints the list every run,
     and G3 still holds every band-kit `where` word to a PLACES row — rather
     than on the reader’s globe. */
  function recordAt(place, Y) {
    const l = BYPLACE[canon(place)];
    if (!l || !l.length) return null;
    let best = null, bd = Infinity;
    // BYPLACE is sorted year-ascending (above), so a strict `<` keeps the
    // EARLIER record on a tie without a second comparison.
    for (const gk of l) {
      const d = Math.abs(WHEN[gk].year - Y);
      if (d < bd) { bd = d; best = gk; }
    }
    return best === null ? null
      : { gk: best, year: WHEN[best].year, label: WHEN[best].place + " " + yearWord(WHEN[best].year) };
  }

  /* VIEWS' WHOLE REMAINING JOB: how close to stand to a place, in DEGREES OF
     ARC across the shorter side of the globe's box. The smallest rectangle that
     contains the place wins, and its longitude span IS the arc — a rectangle
     11° wide was a view you could read Britain in, so 11° of arc is how close
     you fly for a Manchester record.

     NOT A CONTROL, and never rendered as one. ui/atlas.js calls it from
     showing() and from the focus handler; nothing on the page offers it.
     Clamped to the globe's own range so a table edit cannot ask for a zoom the
     renderer will not give. */
  const arcFor = (place) => {
    const c = placeOf(place);
    let span = 180;
    if (c) for (const v of Object.values(VIEWS)) {
      const s = v.lon1 - v.lon0;
      if (inView(v, c[0], c[1]) && s < span) span = s;
    }
    return Math.max(0.5, Math.min(180, span));
  };

  /* THE FALLBACK'S ORDER, and the map's label pass, want the same list: every
     record, year ascending, then place, then key. Derived here so the view and
     the gate cannot sort it two different ways. */
  /* THE YEAR, AS A PERSON READS IT — the ONE owner of "-2500 is 2500 BC".
     A raw negative is arithmetic, not a year anybody says; a CE year prints
     exactly as it always has, no "AD", because that is what every label since
     Rome 600 already looked like. Everything that PRINTS a year (the list's
     year cell, the marks' spoken names, the sentence, pick()'s progress line)
     goes through this; everything that COMPUTES on a year (sorting, the
     window, dataset attributes the gates read back) stays on the signed
     number. */
  const yearWord = (y) => (y < 0 ? (-y) + " BC" : String(y));

  const ALL = Object.keys(WHEN).map((gk) => ({
    gk, place: canon(WHEN[gk].place), year: WHEN[gk].year,
    label: WHEN[gk].place + " " + yearWord(WHEN[gk].year),
  })).sort((a, b) => a.year - b.year
    || (a.place < b.place ? -1 : a.place > b.place ? 1 : 0)
    || (a.gk < b.gk ? -1 : a.gk > b.gk ? 1 : 0));

  const eraOf = (y) => {
    let w = ERAS[0].w;
    for (const e of ERAS) if (e.y <= y) w = e.w; else break;
    return w;
  };

  const api = { PLACES, ALIAS, WITHIN, REGIONS, REGIONS_EMPTY, WHEN, EXCLUDE, YEARS, ERAS, VIEWS, ALL, W, WINDOW,
                UNITS, unit, recordAt, arcFor,
                project, heightOf, inView, placeOf, recordsAt, atYear,
                yearAt, indexOf, eraOf, yearWord, canon };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuAtlas = api;
})(typeof self !== "undefined" ? self : this);
