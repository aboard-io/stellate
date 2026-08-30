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
       · Bray — `hammerhorror`, the village whose studios Hammer shot
         Dracula in; ~43 km west of London, checked against the Britain
         arc at the gate (the Basildon distance, mirrored).
       · Sheffield — `idm`, Warp's own town; the sisters precedent asked
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
    "Manila": [14.60, 120.98], "Matanzas": [23.04, -81.58], "Mazatlán": [23.25, -106.41],
    "Memphis": [35.15, -90.05], "Mexico City": [19.43, -99.13],
    "Miami": [25.76, -80.19], "Milan": [45.46, 9.19],
    "Monterrey": [25.67, -100.32],
    "Mumbai": [19.08, 72.88], "Munich": [48.14, 11.58], "Muswell Hill": [51.59, -0.14],
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
    "St. Louis": [38.63, -90.20], "Stourbridge": [52.46, -2.15],
    "Swindon": [51.56, -1.78], "Taipei": [25.03, 121.57],
    "Tampa": [27.95, -82.46], "Teaneck": [40.89, -74.02],
    "Tehran": [35.69, 51.39], "Tetouan": [35.57, -5.37],
    "Tokyo": [35.68, 139.65],
    "Toronto": [43.65, -79.38], "Tulsa": [36.15, -95.99],
    "Tralles": [37.85, 27.84],
    "Ugarit": [35.60, 35.78], "Ur": [30.96, 46.10],
    "Oxyrhynchus": [28.53, 30.66],
    "Valledupar": [10.46, -73.25],
    "Washington": [38.91, -77.04], "Winchester": [51.06, -1.31],
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
       and Madrid; `ziryab` to Baghdad and Fez — the Córdoba/
       Constantinople rule, fourth application); PRAGUE and TBILISI
       are plain European geography (Garland's Europe volume runs to
       the Caucasus and says so); EPULU is the Ituri forest, the
       map's first dot in the DR Congo's east and its first
       rainforest interior anywhere.
       NOT RAYNE, AND CONSIDERED: `cajun`'s own town measures inside
       Lafayette's dot (25 km — the Southall situation, sibling towns
       WITHIN cannot relate), so the anchor takes the session city
       instead (New Orleans, 27 April 1928), the skokiaan
       a-record-is-the-honest-row ruling. NOT SELJORD: Lindeman's
       collecting parish lands 35 km from Notodden's dungeonsynth dot,
       under any plausible floor at the Europe arc — the anchor takes
       the city of publication (Christiania), which the Kinshasa rule
       spells Oslo. */
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
    "Muswell Hill": "London",       // a north London suburb; the Kinks' own
    "Harlem": "New York",           // uptown Manhattan
    "Greenwich Village": "New York",// lower Manhattan
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
    spem:           { place: "London", year: 1570 },
    counterpoint:   { place: "Vienna", year: 1725 },
    neoclassical:   { place: "Berlin", year: 2011 },
    drone:          { place: "New York", year: 1964 },
    sludge:         { place: "New Orleans", year: 1991 },
    tango:          { place: "Buenos Aires", year: 1935 },
    deathmetal:     { place: "Tampa", year: 1990 },
    eurythmics:     { place: "London", year: 1983 },
    isley:          { place: "Teaneck", year: 1973 },
    toto:           { place: "Los Angeles", year: 1982 },
    jodeci:         { place: "Charlotte", year: 1991 },
    beatles:        { place: "Liverpool", year: 1962 },
    steely:         { place: "Los Angeles", year: 1977 },
    postrock:       { place: "Austin", year: 2003 },
    boombap:        { place: "New York", year: 1994 },
    trap:           { place: "Atlanta", year: 2003 },
    house:          { place: "Chicago", year: 1986 },
    garage:         { place: "London", year: 1999 },
    dnb:            { place: "London", year: 1994 },
    disco:          { place: "New York", year: 1977 },
    funk:           { place: "Cincinnati", year: 1967 },
    motown:         { place: "Detroit", year: 1965 },
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
    ambient:        { place: "London", year: 1978 },
    techno:         { place: "Detroit", year: 1988 },
    jazz:           { place: "New York", year: 1945 },
    bodiddley:      { place: "Chicago", year: 1955 },
    chuckberry:     { place: "St. Louis", year: 1955 },
    doowop:         { place: "Harlem", year: 1955 },
    skiffle:        { place: "London", year: 1956 },
    minimalism:     { place: "New York", year: 1967 },
    kraftwerk:      { place: "Düsseldorf", year: 1977 },
    electro:        { place: "New York", year: 1982 },
    hymn:           { place: "Boston", year: 1831 },
    crooner:        { place: "Los Angeles", year: 1953 },
    yuletide:       { place: "New York", year: 1942 },
    merseybeat:     { place: "Liverpool", year: 1963 },
    psychpop:       { place: "London", year: 1968 },
    bigbeat:        { place: "Essex", year: 1997 },
    drill:          { place: "Chicago", year: 2012 },
    clubpop:        { place: "New York", year: 1983 },
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
    folkduo:        { place: "Greenwich Village", year: 1964 },
    worldfolk:      { place: "Johannesburg", year: 1986 },
    jamband:        { place: "San Francisco", year: 1972 },
    sophistirock:   { place: "London", year: 1986 },
    motorik:        { place: "Düsseldorf", year: 1974 },
    roboticpop:     { place: "Düsseldorf", year: 1978 },
    // WAX TRAX! IS THE SHOP'S CITY, NOT THE SHOP'S YEAR. The store began in
    // Denver in 1974 and moved; the Lincoln Park storefront opened November
    // 1978; the LABEL's first release is 1980 and the record this row is
    // written from — Ministry's Cold Life, the label's first hit — is 1981.
    // Chicago is unambiguous, the year is the one the article itself picks
    // out, and both of this row's Chicago children sit seven and eight years
    // later on the same dot.
    waxtrax:        { place: "Chicago", year: 1981 },
    industrialmetal: { place: "Chicago", year: 1988 },
    ebm:            { place: "Chicago", year: 1989 },
    synthduo:       { place: "London", year: 1985 },
    musichallrock:  { place: "Muswell Hill", year: 1966 },
    orchpsych:      { place: "Oklahoma City", year: 1999 },
    altcountry:     { place: "Chicago", year: 1996 },
    yachtsoul:      { place: "San Francisco", year: 1976 },
    yachtrock:      { place: "Austin", year: 1979 },
    songwriterpiano: { place: "New York", year: 1971 },
    softfolk:       { place: "Chapel Hill", year: 1970 },
    singersongwriter: { place: "New York", year: 1972 },
    coastrock:      { place: "Sausalito", year: 1977 },
    spacerock:      { place: "London", year: 1973 },
    grebo:          { place: "Stourbridge", year: 1990 },
    melodictechno:  { place: "Kent", year: 1991 },
    bleeptechno:    { place: "Manchester", year: 1989 },
    industrialbreaks: { place: "Swindon", year: 1989 },
    industrialrock: { place: "Cleveland", year: 1989 },
    analogsynthpop: { place: "Basildon", year: 1980 },
    gothsynth:      { place: "Basildon", year: 1990 },
    gothicpop:      { place: "Crawley", year: 1987 },
    postpunk:       { place: "Manchester", year: 1979 },
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
    classical:      { place: "Vienna", year: 1785 },
    nocturne:       { place: "Paris", year: 1835 },
    romantic:       { place: "Vienna", year: 1876 },
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
    guqin:          { place: "Beijing", year: 1956 },
    sizhu:          { place: "Shanghai", year: 1920 },
    dhrupad:        { place: "Delhi", year: 1955 },
    carnatic:       { place: "Chennai", year: 1935 },
    gagaku:         { place: "Nara", year: 752 },
    ziryab:         { place: "Córdoba", year: 822 },
    qiyan:          { place: "Medina", year: 705 },
    hardingfele:    { place: "Oslo", year: 1849 },
    tasnif:         { place: "Tehran", year: 1924 },
    scotsfiddle:    { place: "Edinburgh", year: 1796 },
    dufay:          { place: "Florence", year: 1436 },
    ballad:         { place: "London", year: 1666 },
    operaseria:     { place: "London", year: 1724 },
    modinha:        { place: "Lisbon", year: 1775 },
    lundu:          { place: "Lisbon", year: 1798 },
    lied:           { place: "Vienna", year: 1814 },
    habanera:       { place: "Havana", year: 1860 },
    spirituals:     { place: "Nashville", year: 1871 },
    danzon:         { place: "Matanzas", year: 1879 },
    maxixe:         { place: "Rio de Janeiro", year: 1895 },
    cemilbey:       { place: "Istanbul", year: 1910 },
    neworleans:     { place: "New Orleans", year: 1923 },
    boogiewoogie:   { place: "Chicago", year: 1928 },
    deltablues:     { place: "Clarksdale", year: 1929 },
    hendrix:        { place: "London", year: 1967 },
    glam:           { place: "London", year: 1971 },
    krautrock:      { place: "Cologne", year: 1971 },
    berlinschool:   { place: "Berlin", year: 1972 },
    phillysoul:     { place: "Philadelphia", year: 1972 },
    quietstorm:     { place: "Los Angeles", year: 1975 },
    moroder:        { place: "Munich", year: 1977 },
    gothicrock:     { place: "Northampton", year: 1979 },
    italodisco:     { place: "Milan", year: 1982 },
    miamibass:      { place: "Miami", year: 1986 },
    newjackswing:   { place: "New York", year: 1987 },
    hardcorerave:   { place: "Essex", year: 1991 },
    gfunk:          { place: "Los Angeles", year: 1992 },
    crunk:          { place: "Memphis", year: 1997 },
    grime:          { place: "London", year: 2003 },
    dubstep:        { place: "London", year: 2005 },
    mawsili:        { place: "Baghdad", year: 800 },
    kassia:         { place: "Constantinople", year: 843 },
    sequence:       { place: "St. Gallen", year: 884 },
    winchester:     { place: "Winchester", year: 1000 },
    hildegard:      { place: "Bingen", year: 1151 },
    josquin:        { place: "Venice", year: 1502 },
    monteverdi:     { place: "Venice", year: 1610 },
    schutz:         { place: "Dresden", year: 1636 },
    contradanza:    { place: "Havana", year: 1803 },
    holler:         { place: "South Carolina", year: 1853 },
    operetta:       { place: "London", year: 1878 },
    musichall:      { place: "London", year: 1892 },
    satie:          { place: "Paris", year: 1888 },
    march:          { place: "Washington", year: 1889 },
    broadway:       { place: "New York", year: 1927 },
    territoryband:  { place: "Kansas City", year: 1932 },
    stockhausen:    { place: "Cologne", year: 1956 },
    modaljazz:      { place: "New York", year: 1959 },
    brill:          { place: "New York", year: 1960 },
    garagerock:     { place: "Portland", year: 1963 },
    beachboys:      { place: "Los Angeles", year: 1966 },
    psychrock:      { place: "San Francisco", year: 1966 },
    velvets:        { place: "New York", year: 1966 },
    zodiak:         { place: "Berlin", year: 1968 },
    winstons:       { place: "Washington", year: 1969 },
    progrock:       { place: "Isle of Wight", year: 1970 },
    sabbath:        { place: "Workington", year: 1969 },
    blockparty:     { place: "Bronx", year: 1973 },
    pfunk:          { place: "Detroit", year: 1975 },
    ymo:            { place: "Tokyo", year: 1978 },
    nwobhm:         { place: "London", year: 1980 },
    thrash:         { place: "San Francisco", year: 1983 },
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
    seikilos:       { place: "Tralles", year: 100 },
    oxyrhynchus:    { place: "Oxyrhynchus", year: 300 },
    hardcore:       { place: "Washington", year: 1980 },
    honkytonk:      { place: "Fort Worth", year: 1941 },
    westernswing:   { place: "Tulsa", year: 1940 },
    dreampop:       { place: "London", year: 1984 },
    doom:           { place: "Stockholm", year: 1986 },
    jpop:           { place: "Tokyo", year: 1999 },
    dunstaple:      { place: "London", year: 1420 },
    deathrock:      { place: "Pomona", year: 1982 },
    batcave:        { place: "London", year: 1982 },
    coldwave:       { place: "Rennes", year: 1979 },
    sisters:        { place: "York", year: 1981 },
    gothicmetal:    { place: "Halifax", year: 1991 },
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
    skokiaan:       { place: "Bulawayo", year: 1947 },
    acidjazz:       { place: "London", year: 1988 },
    kruderdorfmeister: { place: "Vienna", year: 1993 },
    portishead:     { place: "Bristol", year: 1994 },
    tricky:         { place: "Bristol", year: 1995 },
    morcheeba:      { place: "London", year: 1996 },
    lamb:           { place: "Manchester", year: 1996 },
    djshadow:       { place: "San Francisco", year: 1996 },
    thieverycorporation: { place: "Washington", year: 1996 },
    air:            { place: "Versailles", year: 1998 },
    massiveattack:  { place: "Bristol", year: 1998 },
    stgermain:      { place: "Paris", year: 2000 },
    royksopp:       { place: "Tromsø", year: 2001 },
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
    korngold:       { place: "Los Angeles", year: 1938 },
    herrmann:       { place: "Los Angeles", year: 1960 },
    morricone:      { place: "Rome", year: 1966 },
    barry:          { place: "London", year: 1962 },
    carpenter:      { place: "Los Angeles", year: 1978 },
    miamivice:      { place: "Miami", year: 1984 },
    sitcom:         { place: "Los Angeles", year: 1983 },
    seinfeld:       { place: "Los Angeles", year: 1989 },
    waltz:          { place: "Vienna", year: 1867 },
    musette:        { place: "Paris", year: 1880 },
    tarab:          { place: "Cairo", year: 1934 },
    dastgah:        { place: "Tehran", year: 1925 },
    jingju:         { place: "Beijing", year: 1918 },
    khyal:          { place: "Mumbai", year: 1965 },
    gamelan:        { place: "Surakarta", year: 1956 },
    tapemusic:      { place: "Paris", year: 1948 },
    // the ledger round's eleven (2026-08-30) — every dot the payment of
    // a written want; Honolulu is the map's first Pacific dot and the
    // reason the empty region below closed
    hammerhorror:   { place: "Bray", year: 1958 },
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
  };
  /* WHEN:END */

  /* THE SIX THAT ARE NOT PLACES. genres.js:306 already ruled on them: "The six
     FUNCTION genres … declare nothing: a role has a job, not a history." A role
     is not a city and 1969 is not a fact about a pad. They are named HERE, with
     a reason each, so that a 123rd genre arriving with no atlas row FAILS gate
     G1 by name instead of vanishing quietly off the map. */
  const EXCLUDE = {
    simple:  "a role, not a record — the plain default, with no history",
    solo:    "a role: whoever is taking it, wherever the record is from",
    vocal:   "a role: the voice out front, in any city",
    backing: "a role: the voices behind it, in any city",
    riff:    "a role: the figure the record is built on",
    pad:     "a role: the sustained thing underneath",
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
               // measured that dot blocked in advance, and `sabbath` takes
               // its first named performance instead; the wall held) and
               // the Isle of Wight. CONSTANTINOPLE is the one
               // that needs its sentence, because Istanbul — the same
               // coordinates — sits in the Middle East row below: the dot is
               // `kassia`, Constantinople 843, Byzantine chant answering to
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
               // is `seikilos`, Tralles 100, a Greek song in Greek notation
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
               "Edinburgh"],
    "North America": ["Atlanta", "Austin", "Boston", "Chapel Hill", "Charlotte",
                      "Chicago", "Cincinnati", "Cleveland", "Detroit",
                      "Greenwich Village", "Harlem", "Clarksdale", "Kansas City", "Lafayette",
                      "Las Vegas", "Los Angeles", "Memphis", "Miami", "Nashville",
                      "New Orleans", "New York", "Oklahoma City", "Orlando",
                      "Philadelphia", "Portland", "San Diego", "San Francisco",
                      "Sausalito", "Sedalia", "St. Louis", "Tampa", "Teaneck",
                      "Toronto",
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
                      "Galax", "Hot Springs"],
    // Mexico is here and not in North America, which is a choice and is the
    // one Garland's own volumes make: the musical basin is Ibero-American,
    // and a Sinaloan banda has more to say to a Colombian cumbia than to a
    // Nashville record.
    "Latin America and the Caribbean":
      ["Barranquilla", "Buenos Aires", "Cusco", "Guadalajara", "Havana",
       "Kingston", "Matanzas", "Mazatlán", "Mexico City", "Monterrey",
       "Port of Spain",
       "Recife", "Rio de Janeiro", "San Juan", "Santo Domingo", "São Paulo",
       "Valledupar"],
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
               // Bulawayo (skokiaan, the first Zimbabwean dot) and Cape
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
                  "Taipei", "Tokyo"],
    // Surakarta (2026-08-30, the walls-down round's own dot): `gamelan`
    // landed at Lokananta's city the same morning this row was last read,
    // and the region gate (G11d) caught the dot with no region within the
    // day — central Java, the same island Jakarta already proves.
    "Southeast Asia": ["Bangkok", "Ho Chi Minh City", "Jakarta", "Manila",
                       "Phnom Penh", "Surakarta"],
    "South Asia": ["Chandigarh", "Chennai", "Delhi", "Faisalabad",
                   "Jalandhar", "Mumbai"],
    // Turkey and Iran sit here rather than in Europe or in Central Asia, and
    // Istanbul is the case that forces the decision: the city is on two
    // continents and the MUSIC — makam, usul, the arabesk string orchestra —
    // answers to Cairo and Tehran, not to Vienna.
    // TETOUAN JOINS ORAN IN THIS ROW, for the reason the Africa comment above
    // already gives: Garland's volume 6 covers the Maghreb, and the Andalusian
    // nuba answers to Fez, Algiers and Cairo rather than to Bamako.
    // AND CÓRDOBA JOINS TETOUAN (2026-08-29), which looks odd beside
    // Barcelona-in-Europe until you ask the Garland question the Tetouan
    // comment already answered: the dot is `ziryab`, Córdoba 822, the
    // Umayyad court school whose repertory IS the nuba's — volume 6
    // material, answering to Baghdad and Fez, not to a Spain that would
    // not exist for six centuries. The geography follows the record, the
    // way Kinshasa's spelling followed the map.
    // AND BAGHDAD JOINS (2026-08-29) — the dot is `mawsili`, Baghdad 800,
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
    "Middle East": ["Baghdad", "Cairo", "Córdoba", "Istanbul", "Medina",
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
    "Australia and the Pacific": ["Honolulu"],
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
      // ...and the fourteen-hundreds arrived 2026-08-30 with dunstaple,
      // "London 1420": the century had records (dufay 1436) but no word,
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
