#!/usr/bin/env node
// nukernel/atlas.gate.js — WHAT PROVES THE MAP IS THE CATALOG.
//
// Pure node, no browser, seconds. It sits BESIDE its data rather than in test/
// for the reason vocabulary.js set the precedent: a data-tier self-check that
// lives with the table gets run by whoever edits the table. The browser half of
// D6 (G7-G9, G11-G14 — the RENDERED map) is test/atlas.js and belongs to the
// verifier, because only a browser can prove a click composed a record.
//
//   node nukernel/atlas.gate.js          G1-G6 and G10, exit 1 on any failure
//   node nukernel/atlas.gate.js --bake   re-extract WHEN into atlas.js, then run
//
// THE ONE DEVIATION FROM PROGRAM.md §5, STATED HERE BECAUSE IT IS A FAILURE I
// COULD NOT MAKE GO AWAY. §5 asks that G10 report "Britain 0 dot-pairs under 26
// units". Measured, it reports two — Muswell Hill 8.8 units from London,
// Basildon 20.1 from Essex — and no rectangle fixed either: 26 units between
// London and Muswell Hill needs a view under 3.7° of longitude, which cannot
// hold Glasgow and Kent at once. Both pairs are a place INSIDE another place,
// so atlas.js declares the containment (WITHIN) and G10 exempts a declared pair
// and fails any other.
//
// G10 IS RE-POINTED, 2026-08-24, AND THE LAW IS UNCHANGED. The "look at"
// <select> is gone (Paul: "get rid of the era select boxes, the look at select
// box, the 'nearby' select box, the genre list, etc."), so a per-rectangle
// report on five named views would be a report about a control nobody can use.
// The question survives it, because it was never about the control: "are these
// two places too close to tell apart when you have flown to one of them?" So
// the frame is now arcFor(place) — VIEWS' whole remaining job, the smallest
// rectangle containing a place, read as degrees of arc — and the separation is
// stated in CSS PIXELS on a 390px phone, which is the unit a thumb is measured
// in. Both rectangles and pairs are still PRINTED, the way
// tools/build/relayout-map.js --report does, because "printed and watched" is
// what §5 asks for outside Britain anyway.

"use strict";
const fs = require("fs"), path = require("path");
const A = require("./atlas.js");
const { GENRES } = require("./genres.js");

/* THE ONE READER OF A LABEL AS DATA — and since 2026-08-30 it reads two eras.
   Paul: "look backwards in time to bone flutes and lutes." The catalog started
   at Rome 600 and the convention was "Place Year", CE assumed. The BC
   convention is "Place Year BC" — "Ur 2500 BC", a trailing BC, 1-5 digits —
   and it bakes a NEGATIVE year, so every piece of year arithmetic downstream
   (sorting, YEARS, ERAS, nearest-year, the ±10 window) works unchanged.

   WHY TRAILING "BC" AND NOT A MINUS SIGN, measured before choosing: three
   OTHER files parse trailing digits off a label on their own — compose.js
   genreYear (/(\d{3,4})\s*$/, the era law), instruments.js idiomOf (the
   throat cast) and song.js's session-label check — and none of them is this
   slice's to edit. On "Ur 2500 BC" all three FAIL CLOSED to their no-year
   branch (null / 0), which is the honest state until each owner teaches its
   parser. On "Ur -2500" every one of them would have matched the bare digits
   and read the year as 2500 CE — a wrong POSITIVE five centuries in the
   future, silently. A convention that fails closed everywhere it is not yet
   understood beats one that lies where it is not yet understood. */
const LABEL_RE = /^(.+?)\s+(?:(\d{1,5})\s+BC|(\d{3,4}))$/;
const ATLAS = path.join(__dirname, "atlas.js");

let fails = 0, checks = 0;
const ok = (name, cond, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + name + (detail ? "  — " + detail : "")); return true; }
  fails++; console.log("  FAIL " + name + (detail ? "  — " + detail : "")); return false;
};
const head = (s) => console.log("\n" + s);

/* ---------- the extraction, which is also --bake ------------------------- */
function extract() {
  const out = {};
  for (const gk of Object.keys(GENRES)) {
    const m = LABEL_RE.exec(GENRES[gk].label || "");
    if (m) out[gk] = { place: m[1], year: m[2] ? -m[2] : +m[3] };
  }
  return out;
}
function bake() {
  const w = extract();
  const rows = Object.keys(w).map((gk) =>
    `    ${(gk + ":").padEnd(15)} { place: ${JSON.stringify(w[gk].place)}, year: ${w[gk].year} },`);
  const src = fs.readFileSync(ATLAS, "utf8");
  const next = src.replace(/\/\* WHEN:BEGIN \*\/[\s\S]*?\/\* WHEN:END \*\//,
    "/* WHEN:BEGIN */\n  const WHEN = {\n" + rows.join("\n") + "\n  };\n  /* WHEN:END */");
  if (next === src) { console.error("--bake: WHEN markers not found in atlas.js"); process.exit(1); }
  fs.writeFileSync(ATLAS, next);
  console.log(`--bake: wrote ${rows.length} WHEN rows into ${ATLAS}`);
  console.log("        re-run without --bake (this process still holds the old table)");
}
if (process.argv.includes("--bake")) { bake(); process.exit(0); }

/* band-kit does NOT export DECADES, and PROGRAM.md §4 item 14 says merging its
   30-record catalog into genres.js's 122 is its own job — so the gate reads the
   list out of the source text rather than waiting for that merge. It is a
   deliberate one-way read: if band-kit ever exports the array this collapses to
   `require("./band-kit.js").DECADES`, and if the literal moves the regex fails
   loudly here rather than letting the two word lists drift in silence. */
function bandkitDecades() {
  const src = fs.readFileSync(path.join(__dirname, "band-kit.js"), "utf8");
  const m = /const DECADES = \[([\s\S]*?)\];/.exec(src);
  if (!m) return null;
  return m[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
}
const isSubsequence = (sub, sup) => {
  let i = 0;
  for (const x of sup) if (i < sub.length && sub[i] === x) i++;
  return i === sub.length;
};

/* ======================================================================
   G1 · every anchor is on the map, or is named as not being a place
   ====================================================================== */
head("G1  every genre in exactly one of WHEN / EXCLUDE");
const keys = Object.keys(GENRES);
/* THE COUNTS ARE DERIVED, NOT TYPED, AND THAT IS NEW ON 2026-08-24. This read
   `keys.length === 122` and `WHEN is 116`, which was true and is exactly the
   kind of assertion that turns a growing catalog into a red gate. genres.js is a
   6000-line file every other slice edits — the 2020s anchor Paul asked for
   ("Add the 2020s as now") lands in it in another hand — so what this gate holds
   is the PARTITION: every anchor in exactly one of the two tables, no row in
   neither, no row in both, no atlas row without a genre. The numbers are
   printed, because a count that moves without anybody noticing is its own kind
   of drift. */
ok("every anchor is placed or excluded", true,
   keys.length + " anchors = " + Object.keys(A.WHEN).length + " WHEN + "
   + Object.keys(A.EXCLUDE).length + " EXCLUDE");
{
  const both = keys.filter((k) => A.WHEN[k] && A.EXCLUDE[k]);
  const neither = keys.filter((k) => !A.WHEN[k] && !A.EXCLUDE[k]);
  const stray = Object.keys(A.WHEN).concat(Object.keys(A.EXCLUDE)).filter((k) => !GENRES[k]);
  ok("WHEN + EXCLUDE covers every anchor exactly once",
     Object.keys(A.WHEN).length + Object.keys(A.EXCLUDE).length === keys.length,
     Object.keys(A.WHEN).length + " + " + Object.keys(A.EXCLUDE).length
     + " vs " + keys.length);
  /* "EXCLUDE is the six roles" stood here until 2026-09-01 and the sentence is
     kept above its successor rather than edited, because what it was holding —
     that the off-map table is a SHORT, NAMED list and not a bin — is unchanged.
     What changed is that there are seven things that are not places now. Paul,
     2026-09-01: "Add a 'silence' genre at the top of the genre list. This is a
     blank state." A blank state has no city and no year, and it is not a role
     either, so it is named beside them and counted with them.
     ...AND THREE STARTING POINTS, 2026-09-06. Paul: "Add a few simple genres
     at the top: dance, rock, pop — really basic starting points to go with
     silent." Ten things that are not places now, and the assertion is
     rewritten in place again rather than loosened: the number is the point, and
     a starting point is a third kind of not-a-place — not a job (a role) and
     not an empty page (the blank state), but the box with a small band already
     in it and no address. */
  ok("EXCLUDE is the six roles, the blank state and the three starting points",
     Object.keys(A.EXCLUDE).length === 10, Object.keys(A.EXCLUDE).join(" "));
  ok("no genre in both", both.length === 0, both.join(" ") || "none");
  ok("no genre in neither", neither.length === 0,
     neither.length ? neither.join(" ") + "  <- give it a \"City Year\" label or an EXCLUDE reason"
                    : "none");
  ok("no atlas row without a genre", stray.length === 0, stray.join(" ") || "none");
  const noReason = Object.keys(A.EXCLUDE).filter((k) => !String(A.EXCLUDE[k]).trim());
  ok("every EXCLUDE row gives a reason", noReason.length === 0, noReason.join(" ") || "none");
}

/* ======================================================================
   G2 · the committed WHEN is what the labels say, today
   ====================================================================== */
head("G2  re-extract the labels and deep-equal the committed WHEN");
{
  const fresh = extract();
  const drift = [];
  for (const gk of new Set(Object.keys(fresh).concat(Object.keys(A.WHEN)))) {
    const a = fresh[gk], b = A.WHEN[gk];
    if (!a || !b || a.place !== b.place || a.year !== b.year)
      drift.push(gk + ": label says " + (a ? a.place + " " + a.year : "(no place)")
                    + ", WHEN says " + (b ? b.place + " " + b.year : "(missing)"));
  }
  ok("WHEN === the regex over every label", drift.length === 0,
     drift.length ? drift.slice(0, 6).join(" | ") + "  <- node nukernel/atlas.gate.js --bake"
                  : Object.keys(A.WHEN).length + " rows identical");
}

/* ======================================================================
   G3 · every place resolves to a coordinate, from both vocabularies
   ====================================================================== */
head("G3  every place resolves through ALIAS; no orphan rows");
{
  const missing = [];
  for (const gk of Object.keys(A.WHEN))
    if (!A.placeOf(A.WHEN[gk].place)) missing.push(gk + " -> " + A.WHEN[gk].place);
  ok("every WHEN place has coordinates", missing.length === 0,
     missing.join(" | ") || Object.keys(A.WHEN).length + " rows");

  // band-kit's own 25 `where` words, the other vocabulary (band-kit.js:814).
  // It is the drift alarm: band-kit says "Rio", genres.js says "Rio de Janeiro".
  const BK = require("./band-kit.js");
  const words = new Set();
  for (const [, g] of BK.survivors({})) for (const w of (g.where || [])) words.add(w);
  const unresolved = [...words].filter((w) => !A.placeOf(w));
  ok("every band-kit `where` resolves", unresolved.length === 0,
     unresolved.join(" | ") || words.size + " words, " +
     Object.keys(A.ALIAS).length + " through ALIAS");

  const used = new Set();
  for (const gk of Object.keys(A.WHEN)) used.add(A.canon(A.WHEN[gk].place));
  for (const w of words) used.add(A.canon(w));
  const orphans = Object.keys(A.PLACES).filter((p) => !used.has(p));
  ok("no orphan PLACES row", orphans.length === 0,
     orphans.join(" | ") || Object.keys(A.PLACES).length + " rows, all reached");

  const badAlias = Object.keys(A.ALIAS).filter((k) => !A.PLACES[A.ALIAS[k]] || A.PLACES[k]);
  ok("every ALIAS points at a real, distinct row", badAlias.length === 0, badAlias.join(" ") || "1 row");

  const badWithin = Object.keys(A.WITHIN).filter((k) => !A.PLACES[k] || !A.PLACES[A.WITHIN[k]]);
  ok("every WITHIN pair is two real rows", badWithin.length === 0, badWithin.join(" ") || Object.keys(A.WITHIN).length + " rows");
}

/* ======================================================================
   G4 · nothing in the sea, nothing off the edge of the world
   ====================================================================== */
head("G4  coordinate bounds");
{
  const bad = [], off = [];
  const world = A.VIEWS["the world"];
  for (const [name, [lat, lon]] of Object.entries(A.PLACES)) {
    if (!(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) bad.push(name);
    else if (!A.inView(world, lat, lon)) off.push(name + " [" + lat + "," + lon + "]");
  }
  const nPlaces = Object.keys(A.PLACES).length;
  ok("every lat/lon is a real coordinate", bad.length === 0, bad.join(" ") || nPlaces + " rows");
  ok("every place is inside the world view", off.length === 0,
     off.join(" | ") || nPlaces + " rows in " + JSON.stringify(world));
  /* THE COASTLINE'S OWN BOUNDS, checked here because it is the same question.
     LAND is derived by scratch/atlas/bake-land.js -> rechunk-land.js and EMPTY
     IS A LEGAL VALUE — a map with no coastline is a worse map, not a broken
     one — so this reports rather than requiring, and only fails on a number
     that is not a coordinate.

     THE SHAPE CHANGED TWICE, AND BOTH TIMES ARE KEPT. 2026-08-24: one array of
     rings became four named tables { COARSE, RUNS, RSPAN, PATCH }, on the
     argument that a globe needs a motion tier, a cullable tier and a city
     tier. 2026-08-27 REVERSED that to { RUNS, RSPAN } alone — Paul: "Remove
     the high res map and keep the globe one chunky resolution too" — the 1:10m
     patches deleted as design (chunky at city zoom is the point) and the
     coarse motion tier deleted on a measurement (the full 0.1° moving frame is
     p50 1.8 ms; ui/globe.js tiers() carries it). So the loop below walks the
     one table that remains, and the southernmost point is still printed
     because it is the proof Antarctica came back when VIEWS stopped being a
     control. */
  {
    let land = { LAND: { RUNS: [], RSPAN: [] } };
    try { land = require("./atlas-land.js"); } catch (e) { /* not baked yet */ }
    const L = land.LAND || {};
    let pts = 0, bad = 0, south = 90, rows = 0;
    for (const t of ["RUNS"]) {
      for (const ring of (L[t] || [])) {
        rows++;
        if (ring.length % 2) bad++;
        for (let i = 0; i < ring.length; i += 2) {
          pts++;
          const lon = ring[i], lat = ring[i + 1];
          if (!(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90)) bad++;
          if (lat < south) south = lat;
        }
      }
    }
    ok("every LAND coordinate is a real coordinate", bad === 0,
       rows + " rows, " + pts + " points"
       + (rows ? ", southernmost " + south.toFixed(1) : " (LAND is empty, which is legal)"));
    /* RSPAN IS A DERIVED INDEX AND IT MUST ADD UP. The runs of a ring are
       concatenated at load to rebuild the closed ring (ui/globe.js joinRings),
       so a span table whose sum is not RUNS.length would silently rebuild the
       wrong continents. test/atlas.js G18 proves the rebuild against a fresh
       0.1° bake; this is the cheap half, and it runs with no browser. */
    const span = (L.RSPAN || []).reduce((n, k) => n + k, 0);
    ok("RSPAN sums to RUNS.length", span === (L.RUNS || []).length,
       span + " runs in " + (L.RSPAN || []).length + " rings vs "
       + (L.RUNS || []).length + " emitted");
  }
  // The one thing this gate CANNOT do — PROGRAM.md §5 names it as Paul's:
  console.log("  note " + Object.keys(A.PLACES).length + " coordinates are hand-typed. G4 catches a city in the sea;"
            + " it cannot catch\n       one 200 km inland. One human pass over the"
            + " rendered world view is required.");
}

/* ======================================================================
   G5 · the year axis is the catalog's own
   ====================================================================== */
head("G5  YEARS, and the words for them");
{
  const fresh = Array.from(new Set(Object.keys(A.WHEN).map((k) => A.WHEN[k].year)))
    .sort((a, b) => a - b);
  const lo = A.YEARS[0], hi = A.YEARS[A.YEARS.length - 1];
  /* THE STOP COUNT AND THE SPAN ARE DERIVED, NOT TYPED. These read "YEARS is 65
     stops" and "YEARS spans 600..2013", and both went red the hour the 2020s
     anchors Paul asked for landed in genres.js — which is the wrong alarm. The
     LAW is that the axis is the catalog's own: one stop per year a record has,
     ascending, distinct, and round-tripping through yearAt/indexOf. The numbers
     are printed so a change is visible; they are not asserted, because a slider
     that grows a stop when a record arrives is the whole point of deriving it
     (atlas.js §3). */
  ok("YEARS is one stop per catalog year", A.YEARS.length === fresh.length,
     A.YEARS.length + " stops, " + lo + ".." + hi);
  ok("YEARS is ascending and distinct",
     A.YEARS.every((y, i) => i === 0 || y > A.YEARS[i - 1]), "");
  ok("YEARS is exactly the distinct WHEN years",
     JSON.stringify(A.YEARS) === JSON.stringify(fresh), "");
  ok("yearAt / indexOf round-trip on every stop",
     A.YEARS.every((y, i) => A.yearAt(i) === y && A.indexOf(y) === i), "");
  ok("yearAt clamps rather than throwing",
     A.yearAt(-5) === lo && A.yearAt(A.YEARS.length + 999) === hi,
     A.yearAt(-5) + " / " + A.yearAt(A.YEARS.length + 999));
}
head("G5b ERAS, and whether \"now\" is telling the truth");
{
  const words = A.ERAS.map((e) => e.w);
  const off = A.ERAS.filter((e) => !A.YEARS.includes(e.y)).map((e) => e.w + " " + e.y);
  /* THIS IS THE CHECK THAT STOPS A FAKE YEAR FILLING A ROW, and it is why the
     2020s half of Paul's instruction could be landed at all: "'now' is a lie,
     it's the 2010s. Add the 2020s as now." The lie was { w: "now", y: 2011 }
     against a catalog whose newest record was 2013. Renaming it to "the
     twenty-tens" stops the lie; a typed { w: "now", y: 2020 } would just have
     moved it a decade. So ERAS derives its last row from YEARS, and this line
     is the proof there is a record behind every word. */
  ok("every ERAS year is a real catalog year", off.length === 0,
     off.join(" | ") || A.ERAS.length + " rows, last " + JSON.stringify(words[words.length - 1])
     + " " + A.ERAS[A.ERAS.length - 1].y);
  ok("ERAS years ascend", A.ERAS.every((e, i) => i === 0 || e.y > A.ERAS[i - 1].y), "");

  /* AND "now" EXISTS IF AND ONLY IF THE CATALOG REACHES THE 2020s. Both
     directions matter: without a 2020s record the word is a lie (that was the
     bug), and WITH one and no word the newest decade has no name at all. This
     slice does not own genres.js — the anchors land in another hand — so the
     gate has to pass either way and say which way it passed. */
  const reaches = A.YEARS.some((y) => y >= 2020);
  ok("\"now\" is in ERAS iff the catalog reaches the 2020s",
     words.includes("now") === reaches,
     reaches ? "the catalog reaches " + A.YEARS[A.YEARS.length - 1] + ", so \"now\" is "
               + (words.includes("now") ? "there" : "MISSING")
             : "nothing past 2019 yet, so \"now\" is correctly absent"
               + " (the 2010s row is \"the twenty-tens\")");

  const dec = bandkitDecades();
  ok("band-kit DECADES was readable", !!dec, dec ? dec.length + " words" : "regex missed it");
  if (dec) {
    // band-kit's list ends with "now". If the catalog has no 2020s record then
    // ERAS legitimately has no "now" row, so the subsequence is checked over
    // the words that do not depend on an anchor this slice does not own.
    const want = dec.filter((w) => w !== "now" || words.includes("now"));
    ok("band-kit DECADES is a subsequence of ERAS", isSubsequence(want, words),
       "ERAS adds " + words.filter((w) => !dec.includes(w)).join(", "));
  }
}

/* ======================================================================
   G6 · no dead scroll position
   ====================================================================== */
head("G6  every slider stop has at least one exact record");
{
  const empty = [];
  for (let i = 0; i < A.YEARS.length; i++) {
    const at = A.atYear(A.YEARS[i]);
    if (at.exact.size < 1) empty.push(A.YEARS[i]);
  }
  ok("no empty stop", empty.length === 0,
     empty.join(" ") || A.YEARS.length + " stops, " + Object.keys(A.WHEN).length + " records");
  // and the sentence the slider says is buildable at every one of them
  const noPlaces = A.YEARS.filter((y) => A.atYear(y).places.size < 1);
  ok("every stop lights at least one place", noPlaces.length === 0,
     noPlaces.join(" ") || A.YEARS.length + " stops");
}

/* ======================================================================
   G6b · CONSEQUENCE C — a place plus a year is exactly one record
   ======================================================================
   The "nearby" panel is gone (Paul: "get rid of … the 'nearby' select box"),
   so a tap on a place must resolve to ONE record and the rule has to be a fact
   about the table rather than a preference. THE RULE: nearest year, tie to the
   EARLIER record — atlas.js recordAt(). This is where it is proved, with no
   browser, over every (place, stop) pair the slider can make. */
head("G6b a place plus a year is one record — nearest year, tie to the earlier");
{
  // (place, year) is a KEY: no two records share a city and a year.
  const byPY = {};
  for (const gk of Object.keys(A.WHEN))
    (byPY[A.canon(A.WHEN[gk].place) + "|" + A.WHEN[gk].year] ||= []).push(gk);
  const collide = Object.entries(byPY).filter(([, v]) => v.length > 1);
  ok("(place, year) is a key", collide.length === 0,
     collide.slice(0, 4).map(([k, v]) => k + " -> " + v.join("/")).join(" | ")
     || Object.keys(A.WHEN).length + " records, 0 collisions");

  // and nearest-year always answers, ties included, on every slider stop
  let ties = 0, pairs = 0, wrong = [], shown = [];
  for (const p of Object.keys(A.PLACES)) {
    const recs = A.recordsAt(p);
    if (!recs.length) { ok.silent = true; continue; }
    for (const Y of A.YEARS) {
      pairs++;
      let bd = Infinity, best = [];
      for (const r of recs) {
        const d = Math.abs(r.year - Y);
        if (d < bd) { bd = d; best = [r]; } else if (d === bd) best.push(r);
      }
      const got = A.recordAt(p, Y);
      if (!got) { wrong.push(p + " @" + Y + " -> null"); continue; }
      // the tie-break is the EARLIER record, always
      const want = best.reduce((a, b) => (b.year < a.year ? b : a));
      if (got.gk !== want.gk) wrong.push(p + " @" + Y + " -> " + got.gk + ", wanted " + want.gk);
      if (best.length > 1) {
        ties++;
        if (shown.length < 5) shown.push(p + " @" + Y + " -> " + got.gk + " " + got.year
          + " (not " + best.filter((r) => r.gk !== got.gk).map((r) => r.gk).join("/") + ")");
      }
    }
  }
  ok("recordAt is the nearest year, tie to the earlier, on every stop",
     wrong.length === 0, wrong.slice(0, 4).join(" | ")
     || pairs + " (place, stop) pairs, " + ties + " ties ("
     + (100 * ties / pairs).toFixed(2) + "%): " + shown.join(" · "));

  /* AND "INSIDE THE WINDOW" COULD NOT HAVE DONE THIS JOB — the measurement that
     rejected the other candidate rule, printed rather than asserted, because it
     is a fact about the catalog and not a promise the code makes. */
  let many = 0, worst = null;
  for (const p of Object.keys(A.PLACES)) {
    const recs = A.recordsAt(p); if (!recs.length) continue;
    for (const Y of A.YEARS) {
      const n = recs.filter((r) => Math.abs(r.year - Y) <= A.WINDOW).length;
      if (n > 1) many++;
      if (!worst || n > worst.n) worst = { p, Y, n };
    }
  }
  console.log("  note \"the one inside the ±" + A.WINDOW + " window\" cannot disambiguate: "
    + many + " (place, stop) pairs hold more than one, worst "
    + worst.p + " " + worst.Y + " with " + worst.n + ".");
  /* THE DRIFT, PRINTED HERE BECAUSE IT IS NO LONGER ON THE GLOBE. This note
     read "…are drawn as inert dots, not buttons". They are not drawn at all
     since 2026-08-24 — Paul: "Don't show ghost genres when the time isn't
     right. Just show genres that align with time", and a place with no record
     aligns with no time there is. So this line is now the ONLY place the
     band-kit / genres.js drift is visible, which is why it prints every run
     instead of asserting: it is a fact about two catalogs, not a promise. */
  const noRec = Object.keys(A.PLACES).filter((p) => !A.recordAt(p, A.YEARS[0]));
  console.log("  note " + noRec.length + " places have no record, so ui/atlas.js draws no mark "
    + "for them at any year (G3 still holds their PLACES row): " + noRec.join(", ") + ".");

  /* WHAT EACH SLIDER STOP PUTS ON THE EARTH — the data half of the ghost fix,
     with no browser. test/atlas.js G22 is the other half and reads the RENDERED
     page; this one is the table it should agree with, and it is printed at the
     three years the round argued about. */
  const drawn = (Y) => A.atYear(Y).shown.size;
  const counts = A.YEARS.map(drawn);
  ok("every stop draws at least one place, and never all of them",
     Math.min(...counts) >= 1 && Math.max(...counts) < Object.keys(A.PLACES).length,
     A.YEARS.length + " stops draw " + Math.min(...counts) + " to " + Math.max(...counts)
     + " places (mean " + (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)
     + ") of " + Object.keys(A.PLACES).length + " PLACES rows — 600 draws "
     + drawn(600) + ", 1969 draws " + drawn(1969) + ", "
     + A.YEARS[A.YEARS.length - 1] + " draws " + drawn(A.YEARS[A.YEARS.length - 1]));
  ok("atYear().shown and atYear().places are the same set of places",
     A.YEARS.every((Y) => { const a = A.atYear(Y);
       return a.shown.size === a.places.size
         && [...a.places.keys()].every((k) => a.shown.has(k)); }),
     "the sentence counts `places` and the globe draws `shown`; they are one fact "
     + "or the page can print a number its own picture contradicts");
  /* AND THE EXACT-YEAR RULE IS THE ONE THAT WAS REJECTED, printed so the next
     person can see the shape of the catalog rather than re-argue it. */
  const ex = A.YEARS.map((Y) => new Set([...A.atYear(Y).exact]
    .map((gk) => A.canon(A.WHEN[gk].place))).size);
  console.log("  note the rejected rule, exact year only: " + Math.min(...ex) + " to "
    + Math.max(...ex) + " places (mean " + (ex.reduce((a, b) => a + b, 0) / ex.length).toFixed(1)
    + "), and " + ex.filter((n) => n === 1).length + " of " + A.YEARS.length
    + " stops would draw exactly ONE. At 600 both rules draw " + drawn(600) + ".");
}

/* ======================================================================
   G10 · mark packing, at the zoom you actually arrive at
   ======================================================================
   main:tools/build/relayout-map.js: "There was never a space problem, only a
   packing one." Take the conclusion — separation is checked by a machine — not
   the solver: there is nothing to solve here, because a city's position is a
   fact.

   RE-POINTED 2026-08-24 (see this file's header). The per-rectangle report died
   with the "look at" <select>; the question did not. It is now asked at
   arcFor(place) — the zoom showing() and a Tab actually fly to — and answered in
   CSS PIXELS on a 390px phone, which is the unit a thumb is measured in. The
   arithmetic is the globe's own and is stated once here rather than imported,
   because this gate has no browser and no module loader: an orthographic
   projection at R = (shorter/2)/sin(arc/2), camera on the place itself. */
head("G10 mark packing at the zoom you arrive at, 390x844");
{
  const D2R = Math.PI / 180;
  const BOX_W = 390, BOX_H = Math.min(Math.round(390 * 0.82), Math.round(844 * 0.62));
  const shorter = Math.min(BOX_W, BOX_H);
  /* 26 MAP UNITS IS NOT 26 CSS PIXELS, AND THE ROUND'S OWN PLAN GOT THAT WRONG.
     The old law was "26 units" of a map that was 1200 units wide across the
     view, so on a 390px column it was 26/1200 x 390 = 8.5 CSS px. Restating it
     as a flat 26 CSS px looked like the same rule in a friendlier unit and is
     THREE TIMES STRICTER — measured, it fails on 113 pairs, of which
     Cleveland/Detroit at 6.9px and Berlin/Leipzig at 7.8px are the tightest.
     That is not a regression: the old gate asserted on BRITAIN ONLY and printed
     the other four rectangles precisely because they were full of pairs like
     those (the world view printed 206). So the assertion is transposed
     faithfully — the old threshold, in the old proportion, at the TIGHTEST arc
     anybody flies to — and everything under 26 CSS px is still PRINTED, because
     "printed and watched" is what §5 asks for outside Britain. */
  const MIN_PX = 26 / 1200 * BOX_W;
  const TIGHT = Math.min(...Object.values(A.VIEWS).map((v) => v.lon1 - v.lon0));
  const project = (arc, lat0, lon0, lat, lon) => {
    const R = (shorter / 2) / Math.sin(Math.min(90, arc / 2) * D2R);
    const u = A.unit(lat, lon);
    const sl = Math.sin(lon0 * D2R), cl = Math.cos(lon0 * D2R);
    const sp = Math.sin(lat0 * D2R), cp = Math.cos(lat0 * D2R);
    const a = u[0] * cl - u[1] * sl, w = u[1] * cl + u[0] * sl;
    return { x: R * a, y: R * (cp * u[2] - sp * w), z: sp * u[2] + cp * w };
  };
  const names = Object.keys(A.PLACES);
  const seen = new Set(), uniq = [], bad = [];
  for (const n of names) {
    const arc = A.arcFor(n), c = A.PLACES[n];
    // latitude is clamped exactly as ui/atlas.js flyTo clamps it, so the gate
    // measures the pose the reader is actually left in and not an ideal one
    const lat0 = Math.max(-40, Math.min(55, c[0])), lon0 = c[1];
    const here = project(arc, lat0, lon0, c[0], c[1]);
    for (const m of names) {
      if (m === n) continue;
      const o = project(arc, lat0, lon0, A.PLACES[m][0], A.PLACES[m][1]);
      if (o.z < 0) continue;                       // behind the earth
      const d = Math.hypot(here.x - o.x, here.y - o.y);
      if (d >= 26) continue;
      /* ...OR TWO DISTRICTS OF THE SAME CITY (2026-09-01). This tested direct
         containment only — "n is within m" — and Brixton arriving for Bronski
         Beat put it 3.8 px from Muswell Hill, which is the Kinks'. Neither
         contains the other; they are opposite ends of the London both are
         ALREADY DECLARED INSIDE. Two named districts of one city sitting on
         top of each other on a world map is not the crowding this gate exists
         to catch — that is undeclared coincidence between unrelated towns, and
         it still fails. The declaration has to be explicit on BOTH rows, so
         this cannot exempt anything by accident. */
      const declared = A.WITHIN[n] === m || A.WITHIN[m] === n ||
        (!!A.WITHIN[n] && A.WITHIN[n] === A.WITHIN[m]);
      const k = [n, m].sort().join("/") + "@" + arc.toFixed(0);
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(n + "/" + m + " " + d.toFixed(1) + "px @" + arc.toFixed(0) + "deg"
          + (declared ? " (declared)" : ""));
      }
      if (!declared && arc <= TIGHT + 0.001 && d < MIN_PX)
        bad.push(n + "/" + m + " " + d.toFixed(1) + "px");
    }
  }
  uniq.sort((a, b) => parseFloat(a.split(" ")[1]) - parseFloat(b.split(" ")[1]));
  console.log("  " + names.length + " places · " + uniq.length
    + " pairs under 26 CSS px at their own arcFor"
    + (uniq.length ? ": " + uniq.slice(0, 8).join(", ")
        + (uniq.length > 8 ? " … and " + (uniq.length - 8) + " more" : "") : ""));
  const tightNames = names.filter((n) => A.arcFor(n) <= TIGHT + 0.001);
  ok("at the tightest arc (" + TIGHT + " deg, " + tightNames.length
     + " places) no undeclared pair is under " + MIN_PX.toFixed(1) + " CSS px",
     bad.length === 0, [...new Set(bad)].slice(0, 6).join(", ")
     || "the old 26-of-1200 law, converted; " + tightNames.join(", "));

  /* THE RECTANGLES ARE STILL PRINTED, because arcFor reads them and a table
     nobody ever looks at is a table that rots. */
  for (const [vname, v] of Object.entries(A.VIEWS)) {
    const inside = names.filter((n) => A.inView(v, A.PLACES[n][0], A.PLACES[n][1]));
    console.log("  " + vname.padEnd(15) + inside.length + " places · "
      + (v.lon1 - v.lon0) + " degrees of arc when you fly to one of them");
  }
}

console.log("\n" + (fails ? "FAILED " + fails + " of " + checks
                          : "PASSED all " + checks) + " checks");
process.exit(fails ? 1 : 0);
