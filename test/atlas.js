#!/usr/bin/env node
/* test/atlas.js — D6's BROWSER gate. THE GLOBE, READ OFF THE RENDERED PAGE.
 *
 * Paul, 2026-08-24, four sentences that are this round:
 *   "I need the ability to zoom in and out on the map. Why don't you make the
 *    map 3d and zoomable like google earth but keep it black and white."
 *   "Get rid of all ux for navigating except for the 'when' slider which should
 *    go across the whole screen and the 3d globe. get rid of the era select
 *    boxes, the look at select box, the 'nearby' select box, the genre list."
 *   "'now' is a lie, it's the 2010s. Add the 2020s as now."
 *   "Don't make 'Details' collapsible."
 * and a fifth, after looking at the deployed page:
 *   "Don't show ghost genres when the time isn't right. Just show genres that
 *    align with time."
 *
 * nukernel/atlas.gate.js proves the DATA — every anchor placed, coordinates in
 * bounds, every slider stop with a record, and that a place plus a year is
 * exactly one record. It cannot prove that a thumb landing on Kingston writes a
 * Kingston record, because that is DOM, an SVG hit test, a precompose call and a
 * whole-page redraw. This file is all of that:
 *
 *   G7  every non-localhost request aborted (THE OFFLINE LAW), no pageerror,
 *       one mark per PLACES row and a button for every place with a record, the
 *       land drawn from LAND.RUNS, and BOOT ON THE WHOLE EARTH
 *   G8  #atlasYear := indexOf(1969), tap Kingston's rendered centre, #title
 *       becomes "Kingston 1969" within 3 s with the eight-axis headings intact
 *   G9  the same tap twice is byte-identical; the bar's "rewrite" differs
 *   G11 THE GLOBE IS THE KEYBOARD PATH — the headline of this round
 *   G12 tap boxes >= 28 CSS px at the whole earth, >= 44 at 20 degrees or closer
 *   G13 a vertical swipe scrolls the PAGE and does not turn the globe; a
 *       horizontal swipe turns the GLOBE and does not scroll the page
 *   G14 no performance entry names another host
 *   G15 every place reached by focus (which flies the camera) and activated, at
 *       six widths — REACHABILITY, not simultaneous visibility
 *   G16 a scroll that BEGINS on a dot is not a tap
 *   G17 ZOOM ON EVERY INPUT, AND THE GLOBE IDLES
 *   G18 the land table is derived
 *   G19 the pile resolves
 *   G20 THE PINCH ANCHORS ON YOUR FINGERS — a POSITION, not a scale — and so
 *       does the wheel, on the cursor
 *   G21 a straight DIAGONAL drag turns the globe, and a near-vertical swipe
 *       still scrolls the page
 *   G22 NO GHOSTS — the marks on the earth and the sentence above it are the
 *       same number, at 600, at 1969 and at the last stop, and no accessible
 *       name says "nothing near"
 *
 * WHAT CHANGED AND WHY, so the next reader can see which promises moved:
 *   · G7 counted "62 dots and 62 hit circles in the world view" and checked the
 *     "look at" <select> read "the world". There is no <select>; the marks are
 *     <g role="button">, and "opens on the world" is now an ARC — 180 degrees,
 *     read off #atlasMap's own data-arc. Its mark count moved TWICE: first to
 *     "one mark per PLACES row, and three of them are honestly inert dots
 *     rather than buttons", then — Paul, "Just show genres that align with
 *     time" — to "one mark per place that HAS a record, and the year decides
 *     which of those are drawn". Both counts are asserted, because the second
 *     one is only meaningful next to the first.
 *   · G12's near-side selector gained [data-when="1"]. An undrawn mark is
 *     display:none and measures 0x0, so a tap-size gate that saw one would
 *     report 0 CSS px and fail for a reason that has nothing to do with thumbs.
 *   · G15 was rewritten a SECOND time, and it got stronger rather than weaker:
 *     it walked all 62 places at ONE year, which stops meaning anything the
 *     moment a year draws 19 of them. It now sets the slider to each place's
 *     OWN record year first — "every place is reachable at the year its record
 *     was made" — so it still touches all 62 and now proves the slider and the
 *     globe agree place by place.
 *   · G11's far-side probe moved off 1969. It focused Tokyo at 1969 to show a
 *     far-side mark is reachable; Tokyo's record is 1984 and at 1969 there is
 *     now no Tokyo to focus. The promise is unchanged and it is made at 1984,
 *     where Tokyo is both real and behind the earth from the boot camera.
 *   · G11 was "the fallback listbox gives the SAME document as the dot". THE
 *     LISTBOX IS GONE, and it is not deleted from the gate, it is REWRITTEN:
 *     the globe's own marks are the accessible path, so there is one code path
 *     instead of a visible one and a hidden twin.
 *   · G15 was "all 62 places tapped in the world view". A globe has a far side,
 *     so simultaneous visibility is no longer the honest assertion —
 *     reachability is, and focus flying the camera is what makes it true.
 *   · G17 and G19 are new; G18 is new and is the extraction law applied to a
 *     table whose shape changed.
 *   · G20 and G21 are new, and they are the two defects the globe's own verifier
 *     found and deliberately left for Paul to rule on (GLOBE.md, "Still open"
 *     1 and 2). He said keep going. Both are on the sentence the atlas exists
 *     for — "I scroll to a time, click a place, and now i've got a song" — on a
 *     phone, and neither could have been caught by a gate that reads `arc` or
 *     counts pixels of scroll: one is a POSITION after a zoom, the other is who
 *     owns a gesture.
 *
 * TEST THE ARTIFACT. Nothing here asks a module what it would draw. The tap is a
 * real pointer at a real client coordinate computed from the mark's own rendered
 * position, because ui/atlas.js picks the nearest mark in SCREEN space and a
 * synthetic .click() would take a different code path than the thumb does.
 *
 *   node test/atlas.js
 *   node test/atlas.js --page http://localhost:8777/nukernel/index.html
 *
 * Playwright is borrowed (NODE_PATH=/home/ford/ftrain-2025/node_modules) and the
 * executable path is EXPLICIT — chromium.launch() with no path resolves shell
 * build 1200, which is not installed on this machine.
 */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE = arg("--page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const HOST = new URL(PAGE).host;
const ROOT = path.join(__dirname, "..");

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };
const note = (what) => notes.push("     " + what);

/* ======================================================================
   G18 · THE LAND TABLE IS DERIVED — pure node, so it runs first and cheap
   ======================================================================
   "The conversion is done by EXTRACTION, never by hand" is the standing law and
   atlas-land.js's own header says "do not hand-edit". The file's SHAPE changed
   twice: 2026-08-24 one array of rings became { COARSE, RUNS, RSPAN, PATCH },
   and 2026-08-27 that was REVERSED to { RUNS, RSPAN } alone — Paul: "Remove
   the high res map and keep the globe one chunky resolution too" — so the 1:10m
   PATCH tier and the 0.8° COARSE motion tier are deleted, and the one table is
   the 0.1° runs at every zoom (the removal's measurement lives in ui/globe.js
   tiers()). The law restated against the current shape has two halves:

   1. THE RINGS REBUILD. RUNS holds each ring cut into overlapping runs of at
      most 96 points; consecutive runs share one point; RSPAN says how many runs
      each ring has. ui/globe.js concatenates them at load. If that inverse is
      not exact the globe draws different continents from the ones that were
      baked, and nothing else would notice.
   2. THE WHOLE FILE RE-DERIVES. This used to run `bake-land.js --check`, which
      needs the two Natural Earth GeoJSONs on disk and was skipped without them
      (the offline law applies to the gate too). RE-POINTED 2026-08-27: the
      committed file is now bake-land's RUNS passed through
      scratch/atlas/rechunk-land.js, and THAT script is idempotent — run on its
      own output it re-emits its own output byte-identically — so `rechunk-land
      --check` proves the same "extracted, never hand-edited" fact with no
      sources and no network, on a train. (bake-land.js stays read-only as the
      provenance of the numbers; a re-bake from Natural Earth is now the chain
      bake-land.js -> rechunk-land.js, stated in both headers.) */
function g18() {
  let L = null;
  try { L = require(path.join(ROOT, "nukernel/atlas-land.js")).LAND; } catch (e) {}
  if (!L) { check(false, "G18 · nukernel/atlas-land.js does not load"); return; }
  const empty = !(L.RUNS || []).length;
  if (empty) { note("G18 · LAND is empty, which is legal (the offline law): nothing to derive"); return; }

  const SPLIT = 96;
  const over = (L.RUNS || []).filter((r) => r.length / 2 > SPLIT).length;
  check(over === 0, "G18 · every run is at most " + SPLIT + " points — the cap-cull unit ("
    + L.RUNS.length + " runs, longest " + Math.max(...L.RUNS.map((r) => r.length / 2)) + ")");
  const span = (L.RSPAN || []).reduce((n, k) => n + k, 0);
  check(span === L.RUNS.length, "G18 · RSPAN sums to RUNS.length (" + span + " / "
    + L.RUNS.length + " in " + L.RSPAN.length + " rings)");

  // the inverse ui/globe.js performs at load, performed here independently
  const rings = []; let i = 0;
  for (const k of L.RSPAN) {
    const ring = L.RUNS[i].slice();
    for (let j = 1; j < k; j++) ring.push(...L.RUNS[i + j].slice(2));
    i += k; rings.push(ring);
  }
  const pts = rings.reduce((n, r) => n + r.length / 2, 0);
  const runPts = L.RUNS.reduce((n, r) => n + r.length / 2, 0);
  // every shared point is counted twice in RUNS and once in the rebuilt ring
  const shared = L.RUNS.length - L.RSPAN.length;
  check(pts === runPts - shared, "G18 · the rings rebuild exactly — " + rings.length
    + " rings, " + pts + " points, " + shared + " shared join points reclaimed");
  const bad = rings.filter((r) => r.length < 8 || r.length % 2).length;
  check(bad === 0, "G18 · every rebuilt ring is a well-formed [lon,lat,…] (" + bad + " bad)");

  /* the byte-identity half — re-pointed 2026-08-27 from `bake-land.js --check`
     (which needed the Natural Earth GeoJSONs and was skipped when they were
     absent) to `rechunk-land.js --check`, which needs nothing: the extraction
     is idempotent over its own output, so it always runs. */
  try {
    const out = execFileSync(process.execPath,
      [path.join(ROOT, "scratch/atlas/rechunk-land.js"), "--check"],
      { encoding: "utf8", timeout: 60000 });
    check(true, "G18 · a fresh rechunk is byte-identical to the committed file — "
      + out.trim().split("—").pop().trim());
  } catch (e) {
    check(false, "G18 · atlas-land.js DIFFERS from a fresh rechunk (re-derive, never hand-edit): "
      + String(e.stderr || e.message).trim().slice(0, 200));
  }
}

(async () => {
  g18();

  const b = await chromium.launch({ executablePath: EXE });
  /* 390x844 is the phone the whole round is measured on, and G12 is stated in
     CSS px at exactly that width, so the gate opens there. G15 walks 320 / 375 /
     390 / 430 / 760 / 1280 at the end and puts 390 back. */

  const p = await b.newPage({ viewport: { width: 390, height: 844 },
                              deviceScaleFactor: 2, hasTouch: true });
  /* ---- A SWIPE NEEDS A PAGE THAT CAN SCROLL (2026-08-27) ---------------
     Paul: *"Why don't we make tabs at the top level and let go of the idea of
     scrolling everything? The tabs are: Where / Tempo / Key / Motif / Band /
     Mix / Produce / Score / Export."* G13, G16 and G21 each assert that a
     vertical swipe on the globe SCROLLS THE PAGE by more than 100px, which
     was a safe thing to ask of a document that was seventeen thousand pixels
     tall. The atlas is one panel now: measured the day the tabs landed, at
     390x844 the `Where` tab's whole document is 844px — exactly the viewport,
     zero to scroll — and all three checks failed with "0 -> 0 px" on a page
     that was behaving perfectly.

     THE CLAIM IS NOT RETIRED AND MUST NOT BE. It is the one Paul reported
     twice ("I don't know where that's from", and the swipe that composed a
     reggae record) and it is about who owns a vertical gesture that starts on
     the map — the page, never the globe. What it needs is a page with somewhere
     to go, so the checks that need one run at 390x600 (a phone in landscape,
     which is a real reading of this page) where the same panel leaves 131px of
     scroll, and everything else runs at the 844 the rest of this file measures
     at. The globe's own size is width-driven — measured 300px tall at every
     height from 480 to 844 — so nothing else in the gesture changes.

     600 WAS THE HEIGHT BOTH HALVES SURVIVED AT, AND THE PANEL MOVED UNDER IT
     (2026-08-28). The room to scroll is (panel - H), so this number is a
     measurement of a layout and not a constant, and the layout changed in
     795f4c7 "one gutter down the right, and nothing goes under it": the `Where`
     panel went from 735px tall to 608, the globe from 300px to 254, and its
     centre from y=557 up to y=401. 735 - 600 left 135px to scroll into; 608 -
     600 leaves 8, and G13/G16/G21 have been failing "0 -> 0" and "0 -> 8" ever
     since — on a page that is behaving perfectly, which is the SECOND time this
     stage has reported its own geometry as a defect in the globe.

     MEASURED TODAY, at 390 wide, and this is the whole of the argument:

       · the `Where` panel is 608px cold and 643 with 1969's longer sentence in
         it; the globe spans document y 274..528 (centre 401), Kingston's mark
         y=420 — every one of them viewport-height-independent, because the
         globe is width-driven and nothing in this panel is sized in vh.
       · every label and every child of one computes `pointer-events: none`
         (106 of 106, no backplate rects), `#atlasIndexBtn` is `position:
         static` / `touch-action: auto` and sits BELOW the globe, `#atlasIndex`
         is hidden at 0px, and `elementsFromPoint` at the globe's centre returns
         the land path inside #atlasMap. Nothing new is standing in the
         gesture's way.
       · the lock is doing its job and says so in the failure text itself: the
         near-vertical drags turned the earth 0.000 degrees and the page moved
         by exactly its maximum. The globe declined the gesture; the page had
         nowhere to take it.

     460 IS THE HEIGHT NOW, and the reason 460 was rejected in the note above no
     longer holds: it was rejected because the globe's centre sat at y=557 and
     the drags began off the bottom of the screen, and the globe's centre is at
     401 now. At 460 there are 148px of scroll cold and 183 with the sentence
     wrapped, the globe's on-screen half runs 274..460, and every path these
     three checks draw starts inside it — G13 at c.y-120 = 281, G21 at c.y-60 =
     341, G16 on Kingston at 420 — while each still asks for more than 100px of
     scroll. THE CLAIM IS UNCHANGED AND NOT ONE ASSERTION IS RELAXED: what moved
     is the stage, and it moved because the page it stands on did.

     AND IF THIS FAILS AGAIN, MEASURE THE PANEL FIRST. `608 - SHORT_H > 100` is
     the whole precondition; a round that adds a control under the globe makes
     it truer and a round that takes one away makes it false, and neither is a
     defect in who owns a swipe. */
  const SHORT_H = 460;
  const setH = async (h) => { await p.setViewportSize({ width: 390, height: h });
    await p.waitForTimeout(250); };
  const shortPage = () => setH(SHORT_H);
  const tallPage = () => setH(844);
  /* AND THE SWIPE HAS TO START WITH SOMEWHERE TO GO. `bring()` is
     `scrollIntoView({ block: "center" })`, which on a one-panel page lands on
     the BOTTOM of the document — measured at 390x460: the map centred puts
     scrollY at 256 of a 256px maximum, and an upward swipe then scrolled the
     page from 256 to 256 and this gate reported a defect that was its own
     starting position. The swipe paths therefore start at the top instead.
     560 is the height that makes both halves true at once: the globe is 300px
     tall and sits 250px down, so at scrollY 0 the whole of it is on screen
     (bottom 550 of 560) and there are still 171px of document below to scroll
     into — more than the 100 the three checks ask for. */
  const bringLow = async () => {
    /* `bring()` FIRST AND THE TOP SECOND, and the order is not cosmetic. The
       atlas parks its render loop when the section leaves the viewport (G17 is
       the check that it does, and G17 itself scrolls to the bottom of the
       document to prove it), and `dataset.lat/lon` — which `pose()` reads — is
       written by that loop. Measured: with only a `scrollTo(0, 0)` after G17
       and G20, three straight diagonals came back "0.0 deg turned" and two of
       them scrolled the page, which is the parked observer and not the lock.
       `scrollIntoView` is what wakes it; the scroll to the top is what leaves
       the swipe somewhere to go. */
    await bring();
    await p.waitForTimeout(250);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(300); };
  const errs = [], foreign = [];
  /* `__nuName()` IS THE SAME READING AS `nameOf()` BELOW, INSIDE THE PAGE, and
     it is installed with addInitScript because this file reloads six times and
     an `evaluate`-installed helper does not survive a reload. See the long note
     at `nameOf` for why the record's name stopped being the whole of `#title`. */
  await p.addInitScript(() => {
    window.__nuName = () => {
      const t = document.getElementById("title");
      if (!t) return null;
      return [...t.childNodes]
        .filter((n) => !(n.nodeType === 1 && n.classList.contains("nu-wiki")))
        .map((n) => n.textContent).join("").trim();
    };
  });
  /* ---- fresh(): A RELOAD ONTO A PAGE WITH NO ADDRESS (2026-08-27) -------
     Every `p.reload()` in this file meant "start this page over from nothing",
     and eleven of them said so by reloading. That stopped being true the day
     the page got an address: ui/eight.js now writes `#at=<place>&y=<year>&s=<
     seed>&t=<tab>` with `history.replaceState` on every slider move, globe tap
     and rewrite (Paul, 2026-08-27: "I'd like to be able to link to a
     place/time/seed" / "Update the url with those"), and a reload keeps the
     fragment — which is the whole feature. MEASURED: G11's reload landed on
     the fragment G9 had just left behind at reading 3, so "Enter on the mark
     writes exactly genreToDocument('reggae', 1)" failed against a page that
     was correctly restoring a seed of 3.

     THE ASSERTION IS NOT WEAKENED AND THE FEATURE IS NOT WORKED AROUND: the
     gate now asks for the thing it always meant. The fragment is cleared with
     the page's own mechanism first, so what reloads is a link-less page — a
     reader arriving at the bare URL — which is exactly the state each of these
     eleven checks was written against. (A link that IS followed is the round's
     own check and lives outside this file: it is a second browser context on
     the URL the Export tab hands you.) */
  const fresh = async () => {
    await p.evaluate(() => {
      try { history.replaceState(null, "", location.pathname + location.search); }
      catch (e) { /* nothing to clear */ }
    }).catch(() => {});
    await p.reload({ waitUntil: "networkidle" });
  };

  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });

  /* G7, first half: THE WIRE IS CUT. Anything that is not this origin is
     ABORTED rather than allowed and counted — a gate that merely NOTICES a CDN
     fetch still lets the page work in the test and break on a train. */
  await p.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    if (new URL(u).host === HOST) return route.continue();
    foreign.push(u);
    return route.abort();
  });
  await p.goto(PAGE, { waitUntil: "networkidle" });
  await p.waitForFunction(() => !!document.getElementById("atlasMap"),
    null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(600);

  const booted = await p.evaluate(() => ({
    map: !!document.getElementById("atlasMap"),
    data: !!window.NuAtlas, pre: !!window.NuPrecompose,
    doc: typeof window.__eightDoc === "function" }));
  check(booted.map, "the atlas mounted — #atlasMap is in the page");
  check(booted.data && booted.pre, "NuAtlas and NuPrecompose are loaded");
  if (!booted.map || !booted.data || !booted.doc) {
    for (const n of notes) console.log(n);
    for (const f of fails) console.log(f);
    console.log("\nFAILED — the atlas is not mounted; the rest cannot run.");
    await b.close(); process.exit(1);
  }

  const cdp = await p.context().newCDPSession(p);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: (pts || []).map((q, i) => ({ x: q.x, y: q.y, id: i,
      radiusX: 12, radiusY: 12, force: 1 })) });
  const centre = () => p.evaluate(() => {
    const r = document.getElementById("atlasMap").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  });
  const pose = () => p.evaluate(() => {
    const d = document.getElementById("atlasMap").dataset;
    return { arc: +d.arc, lat: +d.lat, lon: +d.lon };
  });
  const bring = () => p.evaluate(() =>
    document.getElementById("atlasMap").scrollIntoView({ block: "center" }));
  const markXY = (name) => p.evaluate((n) => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === n);
    if (!g) return null;
    const b = g.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height };
  }, name);
  const setYear = (y) => p.evaluate((y) => {
    const r = document.getElementById("atlasYear");
    r.value = String(window.NuAtlas.indexOf(y));
    r.dispatchEvent(new Event("input", { bubbles: true }));
    return document.getElementById("atlasYearOut").textContent;
  }, y);

  /* THE RECORD'S NAME IS NOT THE WHOLE OF `#title` ANY MORE — REWRITTEN
     2026-08-26, and the page was right on every one of the six checks this
     changed. Until the wiki round `#title.textContent` was exactly the anchor's
     label ("Kingston 1969"), so four checks here compared it to that string
     with `===` and a fifth parsed it with `/^(.+) (\d{3,4})$/`. Paul, 2026-08-26:
     "add actual Wikipedia links for each genre we have at the top by the title"
     — so `ui/eight.js draw()` now appends `<a class="nu-wiki">` (and, on the 31
     rows that are not a plain genre article, a `.nu-kind` span inside it) to the
     same element, and the textContent reads "Kingston 1969 Reggae". Every one of
     those five went red while the tap, the touch tap, the pile and the ring all
     demonstrably worked — G22's own ring assertion passed in the same run off
     the same click.

     So the name is read as the element's OWN text with the link taken out,
     which is what "the record names the page" always meant, and the link is
     asserted separately where it belongs (G7 counts the hrefs). A gate that
     compares against the whole string is asserting that nothing may ever sit
     beside the name, which is not a promise this page makes. */
  const nameOf = () => p.evaluate(() => window.__nuName());

  /* ---- G7 THE PICTURE ------------------------------------------------- */
  const shape = await p.evaluate(() => {
    const drawn = (sel) => [...document.querySelectorAll(sel)]
      .filter((x) => x.getAttribute("d")).length;
    const marks = [...document.querySelectorAll("#atlasMarks .place")];
    const L = (window.NuAtlasLand || {}).LAND || {};
    const Y = window.NuAtlas.YEARS[+document.getElementById("atlasYear").value];
    return {
      marks: marks.length,
      buttons: marks.filter((m) => m.getAttribute("role") === "button").length,
      drawn: marks.filter((m) => m.getAttribute("data-when") === "1").length,
      places: Object.keys(window.NuAtlas.PLACES).length,
      withRecord: Object.keys(window.NuAtlas.PLACES)
        .filter((n) => window.NuAtlas.recordAt(n, 1969)).length,
      bootYear: Y,
      bootShown: window.NuAtlas.atYear(Y).shown.size,
      fill: drawn("#atlasLandFill path"), line: drawn("#atlasLandLine path"),
      grat: drawn("#atlasGrat path"),
      rings: (L.RSPAN || []).length, runs: (L.RUNS || []).length,
      arc: +document.getElementById("atlasMap").dataset.arc,
      section: document.getElementById("atlas").tagName,
      head: (document.getElementById("atlasHead") || {}).textContent,
      dead: ["atlasCtl", "atlasEra", "atlasView", "atlasList", "atlasPlace", "atlasHome"]
        .filter((i) => document.getElementById(i)),
      selects: document.querySelectorAll("#atlas select").length,
    };
  });
  /* ONE MARK PER PLACE THAT HAS A RECORD, AND EVERY MARK IS A BUTTON. This was
     "one mark per PLACES row" plus "three of them are honestly inert dots".
     Paul, 2026-08-24: "Don't show ghost genres when the time isn't right. Just
     show genres that align with time." A dot with no record aligns with no time
     there is, so Bristol, Memphis and Reykjavík are not drawn at all — the
     drift they record stays visible where drift belongs, in
     atlas.gate.js G6b's printed note, and G3 still holds their PLACES row. */
  check(shape.marks === shape.withRecord && shape.marks < shape.places,
    "G7 · one mark per place that HAS a record (" + shape.marks + " marks, " +
    shape.places + " PLACES rows) — the " + (shape.places - shape.marks) +
    " placeless rows are not drawn at any year");
  check(shape.buttons === shape.marks,
    "G7 · every mark is a button (" + shape.buttons + "/" + shape.marks +
    ") — a mark now exists only where there is something to press");
  check(shape.drawn === shape.bootShown && shape.drawn < shape.marks,
    "G7 · and the YEAR decides which of them are on the earth: " + shape.drawn +
    " drawn at the boot year " + shape.bootYear + ", exactly atYear().shown (" +
    shape.bootShown + "), out of " + shape.marks + " marks");
  check(shape.fill > 0 && shape.fill <= shape.rings,
    "G7 · the land is drawn from LAND.RUNS, rebuilt into rings: " + shape.fill +
    " filled paths from " + shape.rings + " rings (" + shape.runs +
    " runs; a ring behind the earth draws nothing, so <= is the law)");
  check(shape.grat > 0, "G7 · the graticule is drawn (" + shape.grat + " lines)");
  check(shape.arc === 180,
    "G7 · boot opens on the WHOLE EARTH, not zoomed to Rome (arc " + shape.arc + " degrees)");
  // "Where & when" since 2026-08-27 — FUTURE.md §5: "keep the name, fix the
  // case". Same heading, same survival claim.
  check(shape.section === "SECTION" && shape.head === "Where & when",
    "G7 · Paul: \"Don't make 'Details' collapsible.\" — #atlas is a <" +
    shape.section.toLowerCase() + "> and its heading survived mount() (" +
    JSON.stringify(shape.head) + ")");
  check(shape.dead.length === 0 && shape.selects === 0,
    "G7 · the deleted navigation is DELETED, not hidden — " +
    (shape.dead.length ? JSON.stringify(shape.dead) : "no #atlasCtl/#atlasEra/#atlasView/" +
     "#atlasList/#atlasPlace/#atlasHome") + ", " + shape.selects + " <select> in the section");
  check(!foreign.length, "G7 · THE OFFLINE LAW: no request left " + HOST +
    " " + JSON.stringify(foreign.slice(0, 3)));

  /* ---- G7 · THE LINKS ARE LINKS, NOT FETCHES --------------------------
     Paul, 2026-08-26: "add actual Wikipedia links for each genre we have at the
     top by the title". A LINK IS NOT A FETCH — the whole claim — and it is only
     worth anything asserted TOGETHER with the `foreign` check five lines up:
     the offline law holds WITH a wikipedia href in the DOM. Extended here
     rather than written as a new gate because these two facts are one fact.
     Nothing below clicks a link; clicking is the reader's choice, not the
     page's. */
  const wiki = await p.evaluate(() => {
    const W = window.NuWiki;
    const a = document.querySelector("#title a[href^='https://en.wikipedia.org/']");
    return { table: !!W, links: W ? Object.keys(W.WIKI).length : 0,
             roles: W ? ["simple", "solo", "vocal", "backing", "riff", "pad"]
                          .filter((r) => W.WIKI[r]) : ["no table"],
             href: a ? a.href : null, abs: a ? a.getAttribute("href") : null,
             inApp: !!(a && a.closest("#app")),
             kind: a ? a.dataset.kind : null,
             inDom: document.querySelectorAll(
               "a[href^='https://en.wikipedia.org/']").length };
  });
  check(wiki.table && wiki.links === 191,
    "G7 · the wiki table shipped (" + wiki.links + " links, and the page made " +
    "no request for any of them)");
  check(!wiki.roles.length,
    "G7 · THE SIX INTERNAL ROLES GET NO LINK — a role has a job, not a " +
    "history " + JSON.stringify(wiki.roles));
  check(/^https:\/\/en\.wikipedia\.org\/wiki\/.+/.test(wiki.href || ""),
    "G7 · the title carries its article: " + wiki.href);
  check(wiki.href === wiki.abs,
    "G7 · and it is absolute, so nothing resolves against this origin");
  check(!!wiki.kind,
    "G7 · the link says WHAT KIND of article it is (" + wiki.kind + ") — 31 of " +
    "the 191 are an act, an album or something wider than the anchor");
  /* MOTIF.md: the frozen half of the page is `#app`, and `#title` is outside it
     — which is why draw() may rebuild this anchor every time without going
     anywhere near the clock's own DOM. */
  check(wiki.inDom > 0 && !wiki.inApp,
    "G7 · " + wiki.inDom + " wikipedia href(s) in the DOM, none of them inside " +
    "#app, and " + foreign.length + " requests left " + HOST);

  /* ---- G8 SCROLL TO 1969, TAP KINGSTON, GET A REGGAE RECORD ----------- */
  const out69 = await setYear(1969);
  check(out69 === "1969", "G8 · the slider reads 1969 (" + JSON.stringify(out69) + " of " +
    (await p.evaluate(() => window.NuAtlas.YEARS.length)) + " stops)");
  await p.waitForTimeout(250);
  await bring();
  await p.waitForTimeout(120);
  const k1 = await markXY("Kingston");
  check(!!k1, "G8 · Kingston has a mark on screen at the whole earth");
  if (k1) { await p.mouse.move(k1.x, k1.y); await p.mouse.down(); await p.mouse.up(); }
  const gotTitle = await p.waitForFunction(
    () => window.__nuName() === "Kingston 1969",
    null, { timeout: 4000 }).then(() => true).catch(() => false);
  /* WHAT A SWAP HAS TO LEAVE STANDING, READ THE WAY IT IS NOW DRAWN
     (2026-08-27). This counted `#app .nu-ax > h2` on the spot, which worked
     while the whole record was one scroll under the map. Paul the same day:
     *"Why don't we make tabs at the top level and let go of the idea of
     scrolling everything? The tabs are: Where / Tempo / Key / Motif / Band /
     Mix / Produce / Score / Export."* The tap that swaps the record is on the
     WHERE tab, and on the Where tab `#app` is empty — every axis is behind a
     tab of its own and is built when it is opened. So the four axis tabs are
     opened after the tap, through the page's own `window.__eightTab`, and
     their headings collected; the claim ("the eight-axis headings survived the
     swap") is exactly the claim it was, asked of the page that exists. */
  const after = await p.evaluate(async () => {
    const h2 = [];
    for (const t of ["Tempo", "Key", "Motif", "Band"]) {
      window.__eightTab(t);
      await new Promise((r) => setTimeout(r, 250));
      const pan = document.querySelector(".nu-pan:not([data-off])");
      const h = pan && pan.querySelector(".nu-ax > h2");
      if (h) h2.push(h.textContent.trim());
    }
    window.__eightTab("Where");
    await new Promise((r) => setTimeout(r, 250));
    return {
    title: window.__nuName(),
    h2,
    basis: window.__eightDoc().basis,
    voices: window.__eightDoc().voices.length,
    sections: window.__eightDoc().form.sections.length }; });
  check(gotTitle, "G8 · one tap on Kingston at 1969 makes #title read " +
    JSON.stringify(after.title) + " within 4 s");
  // `>= 4`, WAS `>= 5` UNTIL 2026-08-27: the producer's section left #app for
  // its own host between the board and the score deck ("producer last to say,
  // score last to see" — FUTURE.md; ui/eight.js redrawApp), so four axis
  // headings are left — Time, Harmony, Motifs, The band — and a gate that
  // still demanded five would be asserting the OLD page order, not the swap.
  // ("sticky h2" said twice over; they are neither sticky nor visible since
  // the tabs landed the same day — the tab row is the second band now, nu.css
  // THE SECOND BAND IS THE TAB ROW — and the heading is still the panel's own
  // first child, which is all this check ever read.)
  check(after.h2.length >= 4, "G8 · the eight-axis headings survived the swap (" +
    after.h2.length + " h2, one per axis tab: " + after.h2.slice(0, 6).join(" / ") + ")");
  check(after.voices >= 2 && after.sections >= 2,
    "G8 · and it is a whole record — " + after.voices + " voices, " +
    after.sections + " sections, basis " + after.basis);

  /* ---- G9 THE SAME TAP TWICE IS THE SAME RECORD ----------------------- */
  /* THE SAME RECORD, NOT THE SAME GESTURE. Tapping Kingston a second time
     deliberately BUMPS THE SEED — "press it again to hear it again" is the
     replacement for the deleted panel's re-roll — so determinism is asserted
     the way a reader would actually reach the same record twice: leave and come
     back. showing() is the door §2.2 names and it must be byte-stable. */
  const d1 = await p.evaluate(async () => {
    const doc = window.NuPrecompose.genreToDocument("reggae", 1);
    return JSON.stringify(doc);
  });
  const d2 = await p.evaluate(async () => JSON.stringify(window.__eightDoc()));
  check(d1 === d2, "G9 · the tap wrote exactly genreToDocument(\"reggae\", 1) — " +
    d1.length + " vs " + d2.length + " chars");
  const dTwice = await p.evaluate(async () => {
    const a = JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 1));
    const b = JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 1));
    return a === b;
  });
  check(dTwice, "G9 · and the same (gk, seed) twice is byte-identical");
  /* #rewrite AND NOT #atlasAgain, 2026-08-27. The button moved to the .nu-bar
     and split into the two verbs it had been spelling with one label (Paul:
     "a button next to play that seeds a completely different version of the
     song … The another take button should just be called take"). The gesture
     under test is unchanged — it is still the atlas's own seed, bumped through
     `ATLAS.reseed` — so this reads the control a hand now presses. */
  await p.evaluate(() => document.getElementById("rewrite").click());
  await p.waitForTimeout(1400);
  const d3 = await p.evaluate(() => JSON.stringify(window.__eightDoc()));
  check(d3 !== d2, "G9 · \"rewrite\" writes a DIFFERENT record (" + d3.length + " chars)");
  const sayAgain = await p.evaluate(() =>
    (document.getElementById("atlasSay") || {}).textContent);
  check(/reading 2/.test(sayAgain), "G9 · …and says so: " + JSON.stringify(sayAgain.slice(-40)));

  /* ---- G11 THE GLOBE IS THE KEYBOARD PATH ---------------------------- */
  /* THE HEADLINE OF THIS ROUND. There is no listbox to be a second door. The
     mark IS the control: focus it, press Enter, and the page must hold exactly
     the record a pointer would have written. */
  const kb = await p.evaluate(async () => {
    // reset the seed the way a reader does: compose something else, come back
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === "Kingston");
    return { tabindex: g.getAttribute("tabindex"), role: g.getAttribute("role"),
             label: g.getAttribute("aria-label") };
  });
  check(kb.role === "button" && kb.tabindex === "0",
    "G11 · Kingston is a real focusable control — role=" + JSON.stringify(kb.role) +
    " tabindex=" + JSON.stringify(kb.tabindex));
  check(kb.label === "Kingston 1969, reggae",
    "G11 · and it is NAMED: " + JSON.stringify(kb.label));

  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await p.waitForTimeout(250);
  await bring();
  const viaKey = await p.evaluate(async () => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === "Kingston");
    g.focus();
    return { active: document.activeElement === g };
  });
  check(viaKey.active, "G11 · focus() lands ON the mark (document.activeElement is the <g>)");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(2200);
  const kbDoc = await p.evaluate(() => ({
    doc: JSON.stringify(window.__eightDoc()),
    want: JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 1)),
    title: window.__nuName() }));
  check(kbDoc.doc === kbDoc.want,
    "G11 · Enter on the mark writes exactly genreToDocument(\"reggae\", 1) — byte-identical " +
    "to the pointer path, one code path and no hidden twin (" + kbDoc.doc.length + " chars)");
  check(/Kingston/.test(kbDoc.title || ""),
    "G11 · …and the page says so: #title is " + JSON.stringify(kbDoc.title));

  /* AND THE TAB ORDER IS SCOPED BY THE SLIDER. 62 tab stops in front of a
     2264 px document is hostile; the year has already done the work. */
  const tabs = await p.evaluate(() => {
    const on = [...document.querySelectorAll('#atlasMarks .place[tabindex="0"]')];
    const want = Object.keys(window.NuAtlas.PLACES).filter((n) => {
      const r = window.NuAtlas.recordAt(n, 1969);
      return r && Math.abs(r.year - 1969) <= window.NuAtlas.WINDOW;
    });
    const RE = /^.+ \d{3,4}, [a-z0-9]+$/;
    return { n: on.length, want: want.length,
      drawn: document.querySelectorAll('#atlasMarks .place[data-when="1"]').length,
      all: document.querySelectorAll("#atlasMarks .place").length,
      named: on.filter((g) => RE.test(g.getAttribute("aria-label") || "")).length,
      sample: on.slice(0, 3).map((g) => g.getAttribute("aria-label")) };
  });
  check(tabs.n === tabs.want && tabs.n < tabs.all && tabs.n === tabs.drawn,
    "G11 · the tab order IS the drawn set: " + tabs.n + " tabbable at 1969, " +
    tabs.drawn + " drawn, out of " + tabs.all + " marks — with the ghosts gone the " +
    "two sets are one set (they were 19 and 62)");
  check(tabs.named === tabs.n,
    "G11 · every one of them names a place, a year and a genre key (" + tabs.named + "/" +
    tabs.n + "): " + JSON.stringify(tabs.sample));

  /* AND A FAR-SIDE MARK IS STILL REACHABLE, which is the thing display:none
     could not do: focus flies the camera to it.

     TWO REMOVALS LIVE ON THIS SECTION AND THEY ARE NOT THE SAME REMOVAL, which
     is the whole reason this check is here. THE YEAR removes a mark with
     `display: none` — it is not there, so nothing may reach it. THE FAR SIDE
     removes it with `opacity: 0; pointer-events: none` — it IS there, you just
     cannot see it from where you are standing, and focus turns the earth to it.
     Measured: focus() on a visibility:hidden or display:none element does
     nothing, so getting these two the same way round is load-bearing.

     AT 1984, NOT 1969, and that is the ghost fix showing up in the gate: Tokyo's
     record is citypop 1984, so at 1969 there is now no Tokyo mark to focus.
     Same promise, made at a year where the place exists — and Tokyo is still
     behind the earth there, 169.7 degrees from the boot camera at lon -30. */
  await setYear(1984);
  await p.waitForTimeout(250);
  const farReach = await p.evaluate(async () => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === "Tokyo");
    const before = { far: g.getAttribute("data-far"), ti: g.getAttribute("tabindex") };
    g.focus();
    const focused = document.activeElement === g;
    await new Promise((r) => setTimeout(r, 700));
    return { before, focused, far: g.getAttribute("data-far"),
             when: g.getAttribute("data-when"),
             lon: +document.getElementById("atlasMap").dataset.lon };
  });
  check(farReach.focused && farReach.far === "0" && farReach.when === "1",
    "G11 · a mark on the FAR side is still focusable and focus flies the camera to it — " +
    "Tokyo at 1984 was data-far=" + JSON.stringify(farReach.before.far) + ", is now " +
    JSON.stringify(farReach.far) + " (data-when " + JSON.stringify(farReach.when) +
    "), camera at lon " + farReach.lon);
  /* AND THE OTHER REMOVAL, PROVED AT THE SAME MARK: at a year Tokyo does not
     hold, it is not there at all — no tab stop, no name, nothing under a thumb.

     THE YEAR IS DERIVED, REWRITTEN 2026-08-26, AND THE PAGE WAS RIGHT. This
     check used to type 1969, because Tokyo's only record was citypop 1984 and
     1969 is fifteen years away. The world round put **enka, Tokyo 1969** in the
     catalog, so at 1969 the mark is now correctly drawn, named and tabbable —
     and this assertion went red for the one reason a gate must never go red,
     which is that the catalog grew a record. Typing a second year would only
     move the tripwire; the fact the check is making is "a year this place does
     not hold", so it now ASKS the page which years those are and takes the
     first one above the far-side year. It cannot go stale again. */
  const goneYear = await p.evaluate((from) => window.NuAtlas.YEARS
    .filter((y) => y > from && !window.NuAtlas.atYear(y).shown.has("Tokyo"))[0], 1984);
  check(goneYear != null, "G11 · there is a stop above 1984 that Tokyo does not hold (" +
    goneYear + ")");
  await setYear(goneYear);
  await p.waitForTimeout(250);
  const gone = await p.evaluate(() => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === "Tokyo");
    g.focus();
    return { when: g.getAttribute("data-when"), ti: g.getAttribute("tabindex"),
             disp: g.getAttribute("display"), label: g.getAttribute("aria-label"),
             box: g.getBoundingClientRect().width,
             focused: document.activeElement === g };
  });
  check(gone.when === "0" && gone.ti === "-1" && gone.disp === "none"
        && !gone.label && gone.box === 0 && !gone.focused,
    "G11 · …and at " + goneYear + " that same Tokyo mark is GONE, not dimmed — data-when " +
    JSON.stringify(gone.when) + ", tabindex " + JSON.stringify(gone.ti) + ", display " +
    JSON.stringify(gone.disp) + ", aria-label " + JSON.stringify(gone.label) +
    ", " + gone.box + " px wide, focus() refused. It used to be a 0.34-opacity dot " +
    "named \"Tokyo 1984, citypop (nothing near " + goneYear + ")\".");
  await setYear(1969);

  /* ---- G12 TAP BOXES ON A PHONE --------------------------------------- */
  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await bring();
  await p.waitForTimeout(200);
  /* THE NEAR SIDE ONLY, AND THAT IS THE HONEST SET. A mark behind the earth is
     `opacity: 0; pointer-events: none` — it is still named and still in the tab
     order, which is the point of G11, but it is not a tap target and a promise
     about its size would be a promise about something you cannot hit. */
  /* [data-when="1"] JOINED THE SELECTOR, and it is not cosmetic: a mark the
     year does not hold is display:none and measures 0x0, so without it this
     gate reads "smallest tap box 0.0 CSS px" and fails for a reason that has
     nothing to do with thumbs. The near side ONLY is still the honest set — a
     mark behind the earth is opacity 0 and pointer-events none, still named and
     still in the tab order (that is G11), and a promise about the size of
     something you cannot hit would be a promise about nothing. */
  const hitAt = () => p.evaluate(() => {
    const w = [...document.querySelectorAll(
      '#atlasMarks .place[data-when="1"][data-far="0"] .hit')]
      .map((c) => c.getBoundingClientRect().width);
    return { min: w.length ? Math.min(...w) : 0, n: w.length,
             far: document.querySelectorAll(
               '#atlasMarks .place[data-when="1"][data-far="1"]').length,
             arc: +document.getElementById("atlasMap").dataset.arc };
  });
  const world = await hitAt();
  check(world.min >= 28, "G12 · whole earth (arc " + world.arc + "): smallest tap box " +
    world.min.toFixed(1) + " CSS px at 390x844 (>= 28, " + world.n + " marks on the near side, "
    + world.far + " behind the earth)");
  const zoomTo = (a) => p.evaluate((a) => {
    const svg = document.getElementById("atlasMap"), r = svg.getBoundingClientRect();
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: Math.log(a / +svg.dataset.arc) / 0.0022,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      bubbles: true, cancelable: true }));
  }, a);
  await zoomTo(18); await p.waitForTimeout(300);
  const close = await hitAt();
  check(close.min >= 44, "G12 · at arc " + close.arc + " degrees: smallest tap box " +
    close.min.toFixed(1) + " CSS px (>= 44, " + close.n + " on the near side) — the target " +
    "grows as the marks spread out, because a 44px circle at the whole earth would mean " +
    "overlapping targets all over Europe");

  /* ---- G17 ZOOM ON EVERY INPUT, AND THE GLOBE IDLES ------------------- */
  /* THE ZOOM IS THE FEATURE Paul asked for first, so every way in is driven for
     real: a wheel, a trackpad pinch (which arrives as a wheel with ctrlKey), a
     two-finger touch pinch through CDP, and the keyboard. There are NO on-screen
     +/- buttons — "get rid of all ux for navigating except for the 'when'
     slider … and the 3d globe" — so `+`/`-` is the accessible route and it is
     driven here as a real keypress, not as a synthesised gesture. */
  await fresh();
  await p.waitForTimeout(900);
  await bring();
  await p.waitForTimeout(200);
  const a0 = (await pose()).arc;
  const c = await centre();
  await p.mouse.move(c.x, c.y);
  await p.mouse.wheel(0, -600); await p.waitForTimeout(250);
  const aWheel = (await pose()).arc;
  check(aWheel < a0 * 0.8, "G17 · a real WHEEL zooms in: " + a0 + " -> " + aWheel + " degrees");
  await p.evaluate(() => {
    const svg = document.getElementById("atlasMap"), r = svg.getBoundingClientRect();
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: -40, ctrlKey: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      bubbles: true, cancelable: true }));
  });
  await p.waitForTimeout(200);
  const aPinchPad = (await pose()).arc;
  check(aPinchPad < aWheel * 0.75,
    "G17 · a TRACKPAD PINCH (wheel + ctrlKey, which is how one arrives) zooms harder: " +
    aWheel + " -> " + aPinchPad);
  // a real two-finger touch pinch
  const before2 = (await pose()).arc;
  await touch("touchStart", [{ x: c.x - 40, y: c.y }, { x: c.x + 40, y: c.y }]);
  for (let i = 1; i <= 6; i++) {
    await touch("touchMove", [{ x: c.x - 40 - i * 8, y: c.y }, { x: c.x + 40 + i * 8, y: c.y }]);
    await p.waitForTimeout(20);
  }
  await touch("touchEnd", []);
  await p.waitForTimeout(250);
  const after2 = (await pose()).arc;
  check(after2 < before2 * 0.9, "G17 · a real two-finger TOUCH PINCH zooms: " +
    before2 + " -> " + after2 + " degrees");
  await p.evaluate(() => document.getElementById("atlasMap").focus());
  const beforeK = (await pose()).arc;
  await p.keyboard.press("-"); await p.keyboard.press("-"); await p.waitForTimeout(300);
  const afterK = (await pose()).arc;
  check(afterK > beforeK * 1.5, "G17 · the KEYBOARD zooms out: " + beforeK + " -> " + afterK +
    " degrees on two presses of \"-\" (there are no on-screen +/- buttons: a pair of " +
    "buttons is UX for navigating)");
  for (let i = 0; i < 30; i++) await p.keyboard.press("+");
  await p.waitForTimeout(400);
  const floor = (await pose()).arc;
  for (let i = 0; i < 40; i++) await p.keyboard.press("-");
  await p.waitForTimeout(400);
  const ceil = (await pose()).arc;
  check(floor === 0.5 && ceil === 180,
    "G17 · the range is a hard clamp at both ends: " + floor + " degrees (about " +
    (2 * Math.asin(Math.sin(0.25 * Math.PI / 180)) * 6371).toFixed(0) +
    " km across a phone) to " + ceil + " degrees (one earth)");

  /* AND IT IDLES. requestAnimationFrame runs ONLY while a pointer is down, a
     glide is spending its budget or a flyTo is in flight. The control is the
     same page with the section scrolled off, because the page has other rAF
     users and the honest number is the DIFFERENCE. */
  const idle = await p.evaluate(async () => {
    document.getElementById("atlasMap").scrollIntoView({ block: "center" });
    await new Promise((r) => setTimeout(r, 400));
    let n = 0; const real = window.requestAnimationFrame;
    window.requestAnimationFrame = function (f) { n++; return real.call(window, f); };
    let writes = 0;
    const mo = new MutationObserver((rs) => { writes += rs.length; });
    mo.observe(document.getElementById("atlasMap"), { attributes: true, subtree: true });
    await new Promise((r) => setTimeout(r, 2000));
    mo.disconnect(); window.requestAnimationFrame = real;
    return { n, writes };
  });
  check(idle.n === 0 && idle.writes === 0,
    "G17 · ON SCREEN AND STILL: " + idle.n + " requestAnimationFrame calls and " +
    idle.writes + " attribute writes in 2 s — the steady state is exactly zero work, " +
    "which is the only reason a render loop may sit beside a Faust worklet");
  const off = await p.evaluate(async () => {
    // start a glide, then take the section off screen mid-flight
    const svg = document.getElementById("atlasMap");
    const r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (t, x, y) => svg.dispatchEvent(new PointerEvent(t,
      { pointerId: 9, pointerType: "mouse", clientX: x, clientY: y, bubbles: true }));
    ev("pointerdown", cx - 60, cy);
    for (let i = 0; i < 6; i++) ev("pointermove", cx - 60 + i * 20, cy);
    ev("pointerup", cx + 60, cy);
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 500));
    let n = 0; const real = window.requestAnimationFrame;
    window.requestAnimationFrame = function (f) { n++; return real.call(window, f); };
    await new Promise((r) => setTimeout(r, 1500));
    window.requestAnimationFrame = real;
    return n;
  });
  check(off === 0, "G17 · OFF SCREEN: the loop is cancelled mid-glide — " + off +
    " rAF calls in 1.5 s with the section scrolled away");

  /* ---- G13 A SWIPE ON THE MAP STILL SCROLLS THE PAGE ------------------ */
  await shortPage();
  await bringLow();
  const ta = await p.evaluate(() =>
    getComputedStyle(document.getElementById("atlasMap")).touchAction);
  check(/pan-y/.test(ta), "G13 · the globe's touch-action is " + JSON.stringify(ta) +
    " — a vertical swipe belongs to the page");
  const c2 = await centre();
  const vBefore = await p.evaluate(() => ({ y: window.scrollY,
    lat: +document.getElementById("atlasMap").dataset.lat,
    lon: +document.getElementById("atlasMap").dataset.lon }));
  await touch("touchStart", [{ x: c2.x, y: c2.y - 120 }]);   // ABOVE — see SHORT_H
  for (let i = 1; i <= 12; i++) {
    await touch("touchMove", [{ x: c2.x, y: c2.y - 120 - i * 24 }]);
    await p.waitForTimeout(16);
  }
  await touch("touchEnd", []);
  await p.waitForTimeout(700);
  const vAfter = await p.evaluate(() => ({ y: window.scrollY,
    lat: +document.getElementById("atlasMap").dataset.lat,
    lon: +document.getElementById("atlasMap").dataset.lon }));
  check(vAfter.y - vBefore.y > 100,
    "G13 · a real VERTICAL swipe scrolls the page (" + vBefore.y + " -> " + vAfter.y + " px)");
  check(Math.abs(vAfter.lat - vBefore.lat) < 0.001 && Math.abs(vAfter.lon - vBefore.lon) < 0.001,
    "G13 · …and the globe does not move at all — the 8px axis lock, because pan-y alone does " +
    "NOT stop the browser handing us the pointermoves (lat " + vBefore.lat + " -> " +
    vAfter.lat + ", lon " + vBefore.lon + " -> " + vAfter.lon + ")");

  await bring();
  await p.waitForTimeout(200);
  const c3 = await centre();
  const hBefore = await p.evaluate(() => ({ y: window.scrollY,
    lon: +document.getElementById("atlasMap").dataset.lon }));
  await touch("touchStart", [{ x: c3.x - 100, y: c3.y }]);
  for (let i = 1; i <= 12; i++) {
    await touch("touchMove", [{ x: c3.x - 100 + i * 16, y: c3.y }]);
    await p.waitForTimeout(16);
  }
  await touch("touchEnd", []);
  await p.waitForTimeout(900);
  const hAfter = await p.evaluate(() => ({ y: window.scrollY,
    lon: +document.getElementById("atlasMap").dataset.lon }));
  const turned = Math.abs(((hAfter.lon - hBefore.lon + 540) % 360) - 180);
  check(turned > 5 && hAfter.y === hBefore.y,
    "G13 · a real HORIZONTAL swipe turns the globe " + turned.toFixed(1) +
    " degrees and scrolls the page " + (hAfter.y - hBefore.y) + " px");

  await tallPage();

  /* ---- G20 THE PINCH ANCHORS ON YOUR FINGERS -------------------------- */
  /* THIS GATE ASSERTS A POSITION, NOT A SCALE, and that is the whole point of
     it. The globe shipped with a pinch that zoomed correctly and panned about
     the middle of the box: `arc` was perfect and the city was gone. Measured
     before the fix, 390x844, Provence 99.7 px off the middle — 30.4 px off the
     fingers after one 1.8x pinch, 83.8 px after two, above the top edge of the
     box, so "drag the cluster near, pinch in, tap the one you want" could not be
     finished. A gate that watched `arc` would have passed every one of those.

     So: put two fingers ON A PLACE that is about 100 px from the middle, spread
     them, and the place has to still be under them. The scale is checked too,
     but only to prove the pinch DID something — a pinch that did nothing would
     hold the position perfectly. */
  await fresh();
  await p.waitForTimeout(900);
  /* THE SLIDER GOES TO 1969 FIRST, and that is a repair the ghost round owes
     this gate rather than a change to what it proves. The pinch needs A PLACE
     about 100 px off the middle to grab; it used to have 62 to choose from at
     any year, and now the boot year draws exactly one (600, Rome). Rome happens
     to land at 106.7 px and the check passes on it — but a gate whose subject is
     chosen from a pool of one is one catalog edit away from failing for a reason
     that has nothing to do with pinching. 1969 puts nineteen places on the earth
     and the picker takes whichever is nearest 100 px. */
  await setYear(1969);
  await bring();
  await p.waitForTimeout(300);
  /* The mark's own transform, not its bounding box: the position the renderer
     computed, to the 0.1 viewBox unit it is written at. */
  const ctm = (name) => p.evaluate((n) => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === n);
    if (!g) return null;
    const m = g.getScreenCTM();
    return { x: m.e, y: m.f, far: g.dataset.far === "1" };
  }, name);
  const pinchAt = async (x, y, f) => {
    const s0 = 34, s1 = 34 * f;
    await touch("touchStart", [{ x: x - s0, y }, { x: x + s0, y }]);
    for (let i = 1; i <= 8; i++) {
      const d = s0 + (s1 - s0) * i / 8;
      await touch("touchMove", [{ x: x - d, y }, { x: x + d, y }]);
      await p.waitForTimeout(12);
    }
    await touch("touchEnd", []);
    await p.waitForTimeout(320);          // let the gesture settle before reading
  };
  const cBox = await centre();
  const offCentre = await p.evaluate(({ cx, cy }) => {
    // [data-when="1"] as well as [data-far="0"]: a mark the year does not draw
    // is display:none, and its stale data-far would offer it as a pinch target.
    const near = [...document.querySelectorAll(
      '#atlasMarks .place[data-when="1"][data-far="0"]')]
      .map((g) => { const m = g.getScreenCTM();
        return { name: g.dataset.place, x: m.e, y: m.f, d: Math.hypot(m.e - cx, m.f - cy) }; })
      .filter((q) => q.d > 40 && q.d < 140);
    near.sort((a, b) => Math.abs(a.d - 100) - Math.abs(b.d - 100));
    return near[0] || null;
  }, { cx: cBox.x, cy: cBox.y });
  check(!!offCentre, "G20 · there is a place about 100 px off the middle to pinch on"
    + (offCentre ? " (" + offCentre.name + ", " + offCentre.d.toFixed(1) + " px)" : ""));
  if (offCentre) {
    const arc0 = (await pose()).arc;
    let fx = offCentre.x, fy = offCentre.y, worst = 0, went = null;
    for (let i = 0; i < 2; i++) {
      await pinchAt(fx, fy, 1.8);
      const now = await ctm(offCentre.name);
      if (!now) { went = "the mark left the page"; break; }
      const off = Math.hypot(now.x - fx, now.y - fy);
      if (off > worst) worst = off;
      const inBox = now.x >= cBox.x - cBox.w / 2 && now.x <= cBox.x + cBox.w / 2
                 && now.y >= cBox.y - cBox.h / 2 && now.y <= cBox.y + cBox.h / 2;
      if (!inBox) { went = offCentre.name + " left the box at "
        + now.x.toFixed(0) + "," + now.y.toFixed(0); break; }
      fx = now.x; fy = now.y;              // the fingers stay on the place
    }
    const arc1 = (await pose()).arc;
    check(!went && worst <= 6,
      "G20 · " + offCentre.name + " stays under the fingers through two 1.8x pinches — "
      + (went || "worst " + worst.toFixed(1) + " px off the pinch midpoint, still in the box"));
    check(arc1 < arc0 * 0.5,
      "G20 · …and the pinch really did zoom (arc " + arc0.toFixed(1) + " -> "
      + arc1.toFixed(2) + " degrees), so the position above is not a no-op passing");
  }

  /* AND THE WHEEL ANCHORS ON THE CURSOR, which is the same defect from the
     desktop end: the handler set `arc` and nothing else. Measured before the
     fix at 1280x900 — four notches with the cursor parked on Paris put Paris
     178.8 px from the cursor, eight notches 521 px, and by twelve it was off
     the box and the wheel had nothing left under the cursor to zoom. */
  {
    const c = await centre();
    const target = await p.evaluate(({ cx, cy }) => {
      const near = [...document.querySelectorAll('#atlasMarks .place[data-far="0"]')]
        .map((g) => { const m = g.getScreenCTM();
          return { name: g.dataset.place, x: m.e, y: m.f, d: Math.hypot(m.e - cx, m.f - cy) }; })
        .filter((q) => q.d > 30 && q.d < 120);
      near.sort((a, b) => Math.abs(a.d - 70) - Math.abs(b.d - 70));
      return near[0] || null;
    }, { cx: c.x, cy: c.y });
    if (target) {
      await p.mouse.move(target.x, target.y);
      for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(50); }
      await p.waitForTimeout(300);
      const now = await ctm(target.name);
      const off = now ? Math.hypot(now.x - target.x, now.y - target.y) : Infinity;
      check(off <= 6, "G20 · the WHEEL zooms toward the cursor too — " + target.name
        + " is " + off.toFixed(1) + " px from the cursor after four notches");
    } else {
      note("G20 · no near-side mark 30-120 px off the middle for the wheel check");
    }
  }

  /* ---- G21 A DIAGONAL DRAG IS THE GLOBE'S, A NEAR-VERTICAL SWIPE IS THE
          PAGE'S ------------------------------------------------------- */
  /* The lock used to be `dx > dy`, a 45-degree line, so a straight 60-degree
     drag — an ordinary "move this up and to the left" — turned the earth 0.0
     degrees and scrolled the page instead; you had to lead sideways and then
     curve. It is an angle now (ui/atlas.js LOCK_DEG = 25) and `touch-action:
     pan-y` alone could not deliver it: the browser had already given the
     gesture to the compositor on its own 45-degree line, so the touchmove has
     to say no as well.

     EVERY DRAG HERE IS STRAIGHT — no sideways lead — because a lead is exactly
     the workaround this gate exists to make unnecessary. And each one is undone
     by its mirror, because a run of up-left drags parks phi0 on the +-85 clamp
     and the next tilt then reads 0.0 for a reason that has nothing to do with
     the lock (a harness bug found and fixed here, not a page defect).

     TWO PROMISES, AND THE SECOND IS THE ONE THAT PROTECTS THE READER: a page
     that will not scroll under a thumb is a worse bug than a globe that will
     not turn. */
  /* `low` — RUN THIS DRAG ON A PAGE THAT HAS SOMEWHERE TO SCROLL (2026-08-27).
     The two halves of G21 want opposite things from the page, and only one of
     them changed when the tabs landed:

       THE DIAGONALS assert `scrolled === 0`, so they keep running exactly where
       they always ran — the file's own 390x844, starting 60px BELOW the globe's
       centre. Moved onto the short page they came back "0.0 deg turned" while
       scrolling 100px, and the identical drag on a cold page at the same height
       turned 144 degrees and scrolled nothing: something G20's pinches leave
       behind that only a scrollable page exposes. That is ui/atlas.js's
       question and not this block's, so it is written down here rather than
       hidden again by the geometry that was hiding it.

       THE NEAR-VERTICAL PAIR assert `scrolled > 100`, which on a one-panel
       Where tab needs the short page and a start ABOVE the centre — SHORT_H. */
  const straight = async (deg, len, low) => {
    if (low) await bringLow();
    else { await p.evaluate(() => window.scrollTo(0, 0));
           await p.waitForTimeout(120);
           await bring();
           await p.waitForTimeout(250); }
    const c = await centre();
    const x0 = c.x + 60, y0 = c.y + (low ? -60 : 60);
    const r = deg * Math.PI / 180;
    const dx = -len * Math.cos(r), dy = -len * Math.sin(r);
    const before = await pose();
    const y0s = await p.evaluate(() => window.scrollY);
    const run = async (sx, sy, ex, ey) => {
      await touch("touchStart", [{ x: sx, y: sy }]);
      for (let i = 1; i <= 12; i++) {
        await touch("touchMove", [{ x: sx + (ex - sx) * i / 12, y: sy + (ey - sy) * i / 12 }]);
        await p.waitForTimeout(12);
      }
      await touch("touchEnd", []);
      await p.waitForTimeout(320);
    };
    await run(x0, y0, x0 + dx, y0 + dy);
    const after = await pose();
    const y1s = await p.evaluate(() => window.scrollY);
    await run(x0 + dx, y0 + dy, x0, y0);            // the mirror, to put phi0 back
    return { deg,
      turned: Math.abs(((after.lon - before.lon + 540) % 360) - 180)
            + Math.abs(after.lat - before.lat),
      scrolled: y1s - y0s };
  };
  const diag = [];
  for (const deg of [30, 45, 60]) diag.push(await straight(deg, 140, false));
  const badDiag = diag.filter((d) => !(d.turned > 5 && d.scrolled === 0));
  check(!badDiag.length, "G21 · a STRAIGHT diagonal drag turns the globe and does not "
    + "scroll the page, at " + diag.map((d) => d.deg + " deg: " + d.turned.toFixed(1)
    + " deg turned / " + d.scrolled + " px scrolled").join(", "));
  await shortPage();
  const vert = [];
  for (const deg of [80, 90]) vert.push(await straight(deg, 260, true));
  const badVert = vert.filter((v) => !(v.scrolled > 100 && v.turned < 0.001));
  check(!badVert.length, "G21 · …AND A NEAR-VERTICAL SWIPE STILL SCROLLS THE PAGE, at "
    + vert.map((v) => v.deg + " deg: " + v.scrolled + " px scrolled / "
    + v.turned.toFixed(3) + " deg turned").join(", "));
  await tallPage();

  /* ---- G19 THE PILE RESOLVES ----------------------------------------- */
  /* At the whole earth the European marks pile up. The rule is nearest year,
     tie to the earlier (atlas.gate.js G6b proves it over the table); this proves
     the PICTURE agrees — paint order is descending |record year - slider year|,
     so the mark on top is the one the slider is pointing at, and the same tap
     twice writes the same bytes. */
  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await bring();
  await p.waitForTimeout(300);
  const pile = await p.evaluate(() => {
    // the tightest pile of in-window marks on screen: London and its neighbours
    const on = [...document.querySelectorAll('#atlasMarks .place[data-far="0"]')]
      .filter((g) => g.getAttribute("role") === "button");
    let best = null;
    for (const a of on) for (const b of on) {
      if (a === b) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const d = Math.hypot(ra.left - rb.left, ra.top - rb.top);
      if (!best || d < best.d) best = { d, a: a.dataset.place, b: b.dataset.place,
        x: (ra.left + rb.left) / 2 + ra.width / 2, y: (ra.top + rb.top) / 2 + ra.height / 2 };
    }
    return best;
  });
  note("G19 · the tightest pair of in-window marks on a 390px phone is " +
    pile.a + "/" + pile.b + " at " + pile.d.toFixed(1) + " CSS px");
  await p.mouse.move(pile.x, pile.y); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(2000);
  const one = await p.evaluate(() => ({ title: window.__nuName(),
    doc: JSON.stringify(window.__eightDoc()) }));
  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await bring();
  await p.waitForTimeout(300);
  await p.mouse.move(pile.x, pile.y); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(2000);
  const two = await p.evaluate(() => ({ title: window.__nuName(),
    doc: JSON.stringify(window.__eightDoc()) }));
  check(one.doc === two.doc && one.title === two.title,
    "G19 · a tap into the pile resolves to ONE record and the same tap twice writes the " +
    "same bytes — " + JSON.stringify(one.title) + " (" + one.doc.length + " chars)");
  const near69 = await p.evaluate((t) => {
    const m = /^(.+) (\d{3,4})$/.exec(t); if (!m) return null;
    const r = window.NuAtlas.recordAt(m[1], 1969);
    return r ? { got: +m[2], want: r.year } : null;
  }, one.title);
  check(near69 && near69.got === near69.want,
    "G19 · …and it is the record NEAREST the slider's year, not the first in the DOM (" +
    JSON.stringify(one.title) + ", nearest to 1969 is " + (near69 || {}).want + ")");

  /* ---- G16 A SCROLL THAT BEGINS ON A DOT IS NOT A TAP ----------------- */
  await shortPage();
  /* The bug this pins, measured 2026-08-24 before the fix: slider at 1969, one
     vertical touch swipe beginning on the Kingston dot, and the box composed a
     reggae record — #title "Rome 600" -> "Kingston 1969", the page from y=192 to
     y=3441. The pick fired on pointerdown, which arrives before the browser has
     decided the gesture is a scroll. Only a real touch stream can catch it. */
  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await bringLow();
  const k2 = await markXY("Kingston");
  const s0 = await p.evaluate(() => ({ y: window.scrollY,
    title: window.__nuName() }));
  await touch("touchStart", [k2]);
  for (let i = 1; i <= 10; i++) {
    await touch("touchMove", [{ x: k2.x, y: k2.y - i * 22 }]);
    await p.waitForTimeout(16);
  }
  await touch("touchEnd", []);
  await p.waitForTimeout(1600);
  const s1 = await p.evaluate(() => ({ y: window.scrollY,
    title: window.__nuName() }));
  check(s1.y - s0.y > 100, "G16 · a real vertical touch swipe BEGINNING on the Kingston mark " +
    "scrolls the page (" + s0.y + " -> " + s1.y + " px)");
  check(s1.title === s0.title, "G16 · …and composes nothing: #title is still " +
    JSON.stringify(s1.title));
  await bring();
  await p.waitForTimeout(200);
  const k3 = await markXY("Kingston");
  await touch("touchStart", [k3]);
  await p.waitForTimeout(40);
  await touch("touchEnd", []);
  await p.waitForTimeout(2200);
  const tapped = await p.evaluate(() => ({ title: window.__nuName(),
    say: document.getElementById("atlasSay").textContent }));
  check(tapped.title === "Kingston 1969",
    "G16 · a real touch TAP at the same coordinate still writes the record — #title " +
    JSON.stringify(tapped.title));

  /* ---- G15 EVERY PLACE IS REACHABLE, AT SIX WIDTHS -------------------- */
  /* WAS "all 62 places tapped in the world view". A globe has a FAR SIDE, so
     simultaneous visibility stopped being an honest assertion the moment the map
     became one. What replaced it is not weaker: every place must be REACHED —
     focus, which flies the camera, then Enter — and must compose its own record.
     A place that cannot be turned to fails this, and so does one whose mark is
     drawn but inert. */
  for (const w of [320, 375, 390, 430, 760, 1280]) {
    await p.setViewportSize({ width: w, height: 844 });
    await p.waitForTimeout(350);
    const fit = await p.evaluate(() => ({
      wrap: document.getElementById("atlasWrap").scrollWidth
          - document.getElementById("atlasWrap").clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      slider: Math.round(document.getElementById("atlasYear").getBoundingClientRect().width),
      vw: document.documentElement.clientWidth,
      // what the widest thing on this page is allowed to be: the viewport less
      // the two safe-area gutters nu.css keeps (--gl / --gr, 12px minimum)
      col: Math.round(document.body.getBoundingClientRect().width
        - parseFloat(getComputedStyle(document.body).paddingInlineStart || 0)
        - parseFloat(getComputedStyle(document.body).paddingInlineEnd || 0)) }));
    check(fit.wrap === 0 && fit.page === 0,
      "G15 · " + w + "px: nothing scrolls sideways (#atlasWrap " + fit.wrap +
      "px, the document " + fit.page + "px)");
    /* PAUL: "the 'when' slider which should go across the whole screen." The
       track is as wide as ANYTHING on this page is allowed to be — the viewport
       less the two safe-area gutters nu.css keeps for a notch in landscape. The
       row itself is full-bleed to the screen edge (the .nu-bar idiom at
       nu.css:112) and re-pays the gutter as padding; 100vw was rejected because
       vw includes the scrollbar and a sideways scroll on the body is the one
       thing that file exists to prevent. */
    check(fit.slider >= fit.col - 2,
      "G15 · " + w + "px: the when-slider goes across the whole screen — the track is " +
      fit.slider + " px, the widest anything on this page may be is " + fit.col +
      " (viewport " + fit.vw + " less the safe gutters)");
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(300);
  await fresh();
  await p.waitForTimeout(900);
  await bring();
  /* AND EVERY PLACE IS WALKED AT ITS OWN RECORD'S YEAR, which is the second
     rewrite of this gate and the one Paul's "just show genres that align with
     time" forced. It used to focus all 62 marks with the slider left wherever
     the previous check had put it. That was an honest test of a globe where
     every place was drawn at every year and it stops meaning anything the
     moment a year draws nineteen of them: 43 of the 62 would have been
     display:none, and a gate that skipped them would have quietly shrunk to
     "the places this one year happens to hold".

     So the slider is MOVED TO THE PLACE FIRST. The promise gets stronger, not
     weaker: every place in the catalog is still touched, and each one now also
     proves that the year of its own record puts it on the earth — the slider
     and the globe agreeing, place by place, 62 times. */
  const names = await p.evaluate(() => [...document.querySelectorAll("#atlasMarks .place")]
    .map((g) => ({ n: g.dataset.place, btn: g.getAttribute("role") === "button" })));
  let reached = 0; const missed = [];
  for (const row of names) {
    const got = await p.evaluate(async (n) => {
      // recordsAt is year-ascending, so [0] is the place's earliest record —
      // one deterministic year per place, and the same one on every run.
      const own = window.NuAtlas.recordsAt(n)[0];
      const sl = document.getElementById("atlasYear");
      sl.value = String(window.NuAtlas.indexOf(own.year));
      sl.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
      const g = [...document.querySelectorAll("#atlasMarks .place")]
        .find((x) => x.dataset.place === n);
      g.focus();
      await new Promise((r) => setTimeout(r, 340));   // let the flyTo land
      const b = g.getBoundingClientRect();
      const r = document.getElementById("atlasMap").getBoundingClientRect();
      return { focused: document.activeElement === g, far: g.getAttribute("data-far"),
               when: g.getAttribute("data-when"), year: own.year,
               onBox: b.left >= r.left - 2 && b.right <= r.right + 2
                   && b.top >= r.top - 2 && b.bottom <= r.bottom + 2,
               label: g.getAttribute("aria-label") };
    }, row.n);
    if (got.focused && got.far === "0" && got.when === "1" && got.onBox) reached++;
    else missed.push(row.n + " " + JSON.stringify(got));
  }
  check(reached === names.length,
    "G15 · " + reached + " of " + names.length + " places are REACHED by focus at the " +
    "year of their own record — the slider puts the place on the earth, focus flies the " +
    "camera to it, so a far-side place is one Tab away rather than unreachable" +
    (missed.length ? " — missed " + JSON.stringify(missed.slice(0, 4)) : ""));

  /* ---- G11 (last) THE ORDER A READER MEETS IT IN ---------------------- */
  /* DOM ORDER IS READING ORDER IS TAB ORDER, and this is the assertion that
     caught the plan putting the slider UNDER the globe: Tab from the slider
     landed on "another take" (a button that has since moved to the .nu-bar)
     and all nineteen places were behind the reader,
     reachable only by Shift-Tab. The sentence names the year, the slider sets
     it, the globe shows what it lit. */
  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await p.waitForTimeout(250);
  const order = await p.evaluate(() =>
    [...document.getElementById("atlas").children].map((n) => n.tagName + "#" + n.id));
  /* FOUR, NOT FIVE, SINCE 2026-08-27: `P#atlasActs` held "another take" and
     both are gone — the gesture is `#rewrite` in the .nu-bar now. The claim
     this check makes did not change: the sentence names the year, the slider
     sets it, the globe shows what it lit, and the places are behind the
     slider in the tab order rather than in front of it.

     SIX SINCE 2026-08-28, and the claim is unchanged AGAIN because the two new
     children are BEHIND the globe rather than in front of it. Paul: "Let me
     click to see a big list of all the genres in chronological order." The
     index's button and its (closed) list are back matter — the door and the
     chronology come after the two controls Paul asked to be left with, so the
     reader still meets the sentence, then the slider, then the earth. That
     ORDER is the whole assertion, which is why the list is checked here rather
     than in a gate of its own. */
  check(JSON.stringify(order) === JSON.stringify(
      ["H2#atlasHead", "P#atlasSay", "DIV#atlasWhen", "DIV#atlasWrap",
       "BUTTON#atlasIndexBtn", "DIV#atlasIndex"]),
    "G11 · reading order is heading, sentence, when-slider, globe, then the " +
    "index's door and its list — " + JSON.stringify(order));
  await p.evaluate(() => document.getElementById("atlasYear").focus());
  const walk = [];
  // THE PRESS COUNT IS DERIVED — REWRITTEN 2026-08-26, THE THIRD TIME THIS
  // NUMBER WENT STALE AND THE LAST. The tab order IS the drawn set in the
  // globe's own alphabetical DOM order, so how far along it Kingston sits is a
  // fact about how many places the catalog holds in this year's ±10 window, and
  // that number has now moved twice: the Africa round put Addis Ababa, Bamako
  // and Kinshasa ahead of it and nine presses became twelve; the world round of
  // 2026-08-26 took 1969 from 33 drawn marks to 45 — Bangkok, Barcelona,
  // Barranquilla, Cairo and more, all ahead of K — and twelve presses stopped
  // reaching it too. Each time the PAGE was right and only the transcript was
  // wrong. So the walk is now as long as the drawn set (plus the globe itself
  // and a margin), read off the page, and what is asserted is the PROMISE that
  // was always the point: Tab from the slider lands in the globe, then on its
  // places in alphabetical order, and the record the page is playing is
  // REACHABLE FROM THE SLIDER GOING FORWARD rather than behind the reader.
  // The distance is printed, not asserted — it is a measurement of the catalog,
  // not a claim about the design.
  const drawn69 = await p.evaluate(() =>
    document.querySelectorAll('#atlasMarks .place[tabindex="0"]').length);
  const first = await p.evaluate(() => {
    const g = [...document.querySelectorAll('#atlasMarks .place[tabindex="0"]')][0];
    return g ? g.getAttribute("aria-label") : null;
  });
  for (let i = 0; i < drawn69 + 3; i++) {
    await p.keyboard.press("Tab");
    await p.waitForTimeout(30);
    walk.push(await p.evaluate(() => {
      const a = document.activeElement;
      return a.id || a.getAttribute("aria-label") || a.tagName;
    }));
    if (walk[walk.length - 1] === "Kingston 1969, reggae") break;
  }
  check(walk[0] === "atlasMap" && walk[1] === first,
    "G11 · Tab from the slider walks INTO the globe and then its places, in the " +
    "globe's own order (" + drawn69 + " drawn at 1969): " + JSON.stringify(walk.slice(0, 4)));
  const toKingston = walk.indexOf("Kingston 1969, reggae");
  check(toKingston > 0, "G11 · …and Kingston is " + (toKingston + 1) +
    " Tabs from the slider at 1969 (" + JSON.stringify(walk.slice(0, 8)) + ")");

  /* ---- G22 NO GHOSTS -------------------------------------------------- */
  /* PAUL, 2026-08-24, after looking at the deployed page: "Don't show ghost
     genres when the time isn't right. Just show genres that align with time."
     What he was reading, measured at 600 before this round: all 65 marks drawn,
     with accessible names like "Antwerp 1551, pavane (nothing near 600)",
     "Atlanta 2003, trap (nothing near 600)", "Basildon, in Essex 1980,
     analogsynthpop (nothing near 600)" — a world full of records that do not
     exist yet, each politely announcing that it does not exist yet.

     THIS GATE READS THE RENDERED PAGE, not the table, because the table was
     never wrong: atYear() has answered this correctly the whole time and the
     marks simply did not obey it. So the number on the earth is COUNTED off
     the DOM, the number in the sentence is PARSED out of #atlasSay's own text,
     and the two are compared — which is the "test the artifact" law applied to
     the one defect a data gate structurally cannot see.

     THREE YEARS: 600 (Paul's, and the thinnest — one place), 1969 (the one the
     rest of this file is written at), and the last stop (the far end of the
     slider, where a fencepost error would live). */
  await fresh();
  await p.waitForTimeout(900);
  const last = await p.evaluate(() => window.NuAtlas.YEARS[window.NuAtlas.YEARS.length - 1]);
  for (const Y of [600, 1969, last]) {
    await setYear(Y);
    await p.waitForTimeout(300);
    const g = await p.evaluate(() => {
      const marks = [...document.querySelectorAll("#atlasMarks .place")];
      const on = marks.filter((m) => m.getAttribute("data-when") === "1");
      const say = document.getElementById("atlasSay").textContent || "";
      /* THE SENTENCE COMPRESSED 2026-08-27 (FUTURE.md §5: "600 · 1 record
         within ten years · Rome" — keep the data, drop the tour guide), and
         the parse moved with it. It read `/— (\d+) places? on the globe/`;
         the place COUNT left the words and became the list itself, so the
         number to hold against the earth is now the list: the named places
         plus the "+N more" tail sum to atYear's place count, and that sum is
         what `said` carries. The claim is unchanged — the earth and the
         sentence are the same fact, read off the artifact. */
      const m = say.match(/^\d+ · \d+ records? within ten years · (.+)$/);
      let said = -1;
      if (m) {
        const parts = m[1].split(", ");
        const plus = /^\+(\d+) more$/.exec(parts[parts.length - 1] || "");
        said = plus ? (parts.length - 1) + (+plus[1]) : parts.length;
      }
      return {
        drawn: on.length,
        tabbable: marks.filter((m2) => m2.getAttribute("tabindex") === "0").length,
        /* THE NEAR SIDE ONLY, and the first draft of this line failed on it,
           which is worth keeping: at 2023 Chandigarh is drawn, named and
           tabbable and its box is 0x0, because paint() writes no radii for a
           mark behind the earth and this one has never been in front of it.
           That is the r=0 rule at the mark constructor doing its job — zero is
           the honest size for something that has not been drawn — not a ghost.
           A ghost is a mark you can reach for a record that is not there; a
           far-side mark is a record that IS there, on the other side of the
           world, one focus away from the camera turning to it. */
        near: on.filter((m2) => m2.getAttribute("data-far") === "0").length,
        boxed: on.filter((m2) => m2.getAttribute("data-far") === "0"
          && m2.getBoundingClientRect().width > 0).length,
        hidden: marks.length - on.length,
        hiddenNamed: marks.filter((m2) => m2.getAttribute("data-when") === "0"
          && m2.getAttribute("aria-label")).length,
        hiddenBoxed: marks.filter((m2) => m2.getAttribute("data-when") === "0"
          && m2.getBoundingClientRect().width > 0).length,
        ghosts: marks.filter((m2) => /nothing near/
          .test(m2.getAttribute("aria-label") || "")).length,
        said, say,
      };
    });
    check(g.drawn === g.said,
      "G22 · " + Y + ": the earth and the sentence are the same fact — " + g.drawn +
      " marks drawn, the sentence says " + g.said + ". " + JSON.stringify(g.say));
    check(g.ghosts === 0,
      "G22 · " + Y + ": no accessible name says \"nothing near\" (" + g.ghosts +
      " of " + (g.drawn + g.hidden) + " marks) — the disclaimer is gone because " +
      "the mark it disclaimed is gone");
    check(g.hidden > 0 && g.hiddenNamed === 0 && g.hiddenBoxed === 0,
      "G22 · " + Y + ": the " + g.hidden + " marks the year does not hold are GONE, not " +
      "dimmed — " + g.hiddenNamed + " of them carry a name, " + g.hiddenBoxed +
      " of them occupy a box");
    check(g.tabbable === g.drawn && g.boxed === g.near,
      "G22 · " + Y + ": what you can see is what you can Tab to — " + g.drawn +
      " drawn, " + g.tabbable + " tabbable, " + g.near + " of them on the near side and " +
      g.boxed + " of those with a real box (a far-side mark is reachable, not visible)");
  }

  /* AND showing(gk) STILL TURNS THE GLOBE TO A RECORD, which is the handle
     PROGRAM.md §2.2 names and the one thing a year filter could quietly break:
     the mark it wants to ring may be one the current year does not draw.

     DRIVEN THROUGH THE PAGE'S OWN CONTROLS, not by reaching for the function.
     The atlas is the only caller of ctx.setDocument, and eight.js calls
     ATLAS.showing(DOC.basis) back at the end of it, so the round trip is real:
       1 · the slider to 1969, tap Kingston — the page is playing reggae
       2 · the slider to 600 — Kingston leaves with every other 1969 mark, ring
           and all. That is the rule, not a bug: showing() moves the slider TO
           the record on every swap, so the only way to lose the ring is to go
           and look at a different year, and at a different year the globe is
           answering the question the slider is asking.
       3 · "rewrite" (the .nu-bar's, 2026-08-27) — reseed -> pick -> setDocument
           -> showing("reggae"),
           from 600. The slider must JUMP BACK to 1969 and Kingston must be
           drawn, ringed and current again. */
  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await p.waitForTimeout(250);
  await bring();
  await p.waitForTimeout(120);
  const kRing = await markXY("Kingston");
  if (kRing) { await p.mouse.move(kRing.x, kRing.y); await p.mouse.down(); await p.mouse.up(); }
  await p.waitForFunction(
    () => window.__nuName() === "Kingston 1969",
    null, { timeout: 4000 }).catch(() => {});
  await bring();
  await p.waitForTimeout(400);
  const lit = await p.evaluate(() => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === "Kingston");
    return { when: g.getAttribute("data-when"), cur: g.getAttribute("aria-current"),
             ring: g.querySelector(".ring").getAttribute("opacity"),
             year: document.getElementById("atlasYearOut").textContent };
  });
  check(lit.when === "1" && lit.cur === "true" && lit.ring === "1",
    "G22 · the record the page is playing wears the ring — Kingston at " + lit.year +
    ": data-when " + JSON.stringify(lit.when) + ", aria-current " + JSON.stringify(lit.cur) +
    ", ring opacity " + JSON.stringify(lit.ring));
  await setYear(600);
  await bring();
  await p.waitForTimeout(400);
  const away = await p.evaluate(() => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === "Kingston");
    return { when: g.getAttribute("data-when"), ring: g.querySelector(".ring").getAttribute("opacity"),
             drawn: document.querySelectorAll('#atlasMarks .place[data-when="1"]').length,
             title: window.__nuName() };
  });
  check(away.when === "0" && away.ring === "0" && away.drawn === 1
        && away.title === "Kingston 1969",
    "G22 · …and at 600 it leaves with its year, ring and all (" + away.drawn +
    " mark on the earth) while the page goes on playing " + JSON.stringify(away.title) +
    " — one rule, no exception for the favourite");
  await p.evaluate(() => document.getElementById("rewrite").click());
  await p.waitForTimeout(900);
  /* AND THE SECTION IS BROUGHT BACK ON SCREEN BEFORE THE MARKS ARE READ. This
     check went green, then red, then green on the same code, and the reason is
     a feature: setDocument redraws the whole page, which can push #atlasWrap
     out of the viewport, and the atlas's IntersectionObserver then parks the
     render loop and sets `dirty` instead of painting to a screen nobody is
     looking at (G17's "the steady state is exactly zero work"). So the slider
     read 1969 while the marks still carried 600. Scrolling it back is what a
     reader does, and it spends the dirty flag on the next frame. */
  await bring();
  await p.waitForTimeout(500);
  const back = await p.evaluate(() => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === "Kingston");
    return { when: g.getAttribute("data-when"), cur: g.getAttribute("aria-current"),
             ring: g.querySelector(".ring").getAttribute("opacity"),
             year: document.getElementById("atlasYearOut").textContent,
             say: document.getElementById("atlasSay").textContent };
  });
  check(back.year === "1969" && back.when === "1" && back.cur === "true" && back.ring === "1",
    "G22 · showing(\"reggae\") from 600 turns the globe back to the record: the slider " +
    "reads " + back.year + ", Kingston is drawn (" + JSON.stringify(back.when) +
    "), current and ringed. " + JSON.stringify(back.say.slice(0, 60)));

  /* ---- G23 THE GENRE UNDER THE PLACE, AND THE CHRONOLOGY --------------
     Paul, 2026-08-28, two sentences: *"Put the names of the genres under the
     locations on the map."* and *"Let me click to see a big list of all the
     genres in chronological order."*

     BOTH ARE READ OFF THE RENDERED PAGE, which is the only way either can be
     proved: the second line's TEXT is written by paint() out of `shown`, its
     INK is written by the greedy crowding pass on settle, and its POSITION is
     a transform shared with the dot — three different code paths, one visible
     result, and a source reading would bless a genre name that no reader ever
     sees. (memory: "test the artifact".) */
  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await p.waitForTimeout(300);
  await bring();
  await p.waitForTimeout(300);
  const g23 = await p.evaluate(() => {
    const box = document.getElementById("atlasMap").getBoundingClientRect();
    const labs = [...document.querySelectorAll("#atlasNames .lab")];
    const shown = window.NuAtlas.atYear(1969).shown;
    const out = { inked: 0, paired: 0, wrong: [], drift: [], clipped: [], names: [] };
    for (const lg of labs) {
      const place = lg.dataset.place;
      const [t1, t2] = lg.querySelectorAll("text");
      if (!t1 || !t2) { out.wrong.push(place + ": one line"); continue; }
      const o1 = +t1.getAttribute("opacity"), o2 = +t2.getAttribute("opacity");
      if (lg.getAttribute("data-far") === "1" || !(o1 > 0)) continue;
      out.inked++;
      // ONE DECISION FOR BOTH LINES: the place is inked, so the genre is too,
      // at exactly the same ink. A genre name floating with no place over it,
      // or a place whose genre never arrived, is the bug this asserts against.
      if (o2 === o1) out.paired++;
      // …AND IT IS THE RECORD THE TAP WOULD PICK. Same object choose() reads.
      const r = shown.get(place);
      if (!r || t2.textContent !== r.gk)
        out.wrong.push(place + ": " + JSON.stringify(t2.textContent) +
                       " vs " + (r && r.gk));
      // THE TWO NODES CARRY THE MARK'S OWN TRANSFORM — the no-smear promise,
      // asserted as the string rather than as a pixel distance.
      const g = document.querySelector('#atlasMarks .place[data-place="' +
        place.replace(/"/g, '\\"') + '"]');
      if (!g || g.getAttribute("transform") !== lg.getAttribute("transform"))
        out.drift.push(place);
      // AND NEITHER LINE RUNS OFF THE MAP. A clipped word is not a label.
      for (const t of [t1, t2]) {
        const b = t.getBoundingClientRect();
        if (b.width && (b.left < box.left - 1 || b.right > box.right + 1))
          out.clipped.push(place + "/" + t.textContent);
      }
      out.names.push(t1.textContent + "/" + t2.textContent);
    }
    return out;
  });
  check(g23.inked > 0 && g23.paired === g23.inked && !g23.wrong.length,
    "G23 · every name on the earth is TWO lines — the place, and under it the " +
    "genre the tap would pick: " + g23.inked + " inked, " + g23.paired +
    " with the genre at the same ink, " + g23.wrong.length + " wrong " +
    JSON.stringify(g23.wrong.slice(0, 3)) + " · " + JSON.stringify(g23.names.slice(0, 4)));
  check(!g23.drift.length,
    "G23 · …and both lines ride the mark's own transform, so a drag cannot " +
    "smear them off their dot (" + g23.drift.length + " adrift)");
  check(!g23.clipped.length,
    "G23 · …and neither line runs off the map — a name that would overflow the " +
    "right edge is mirrored to the left of its dot (" + g23.clipped.length +
    " clipped " + JSON.stringify(g23.clipped.slice(0, 3)) + ")");

  /* THE INDEX. Closed at boot (it is back matter, not the front door), built
     on the click, 199 rows — every genre genres.js has, the 193 with a place
     and a year in year order and the six ROLES after them, which have neither
     and are not pretended into the sequence. */
  const idx = await p.evaluate(async () => {
    const btn = document.getElementById("atlasIndexBtn");
    const before = { rows: document.querySelectorAll("#atlasIndexRows li").length,
                     hidden: document.getElementById("atlasIndex").hidden,
                     expanded: btn.getAttribute("aria-expanded") };
    btn.click();
    await new Promise((r) => setTimeout(r, 60));
    const rows = [...document.querySelectorAll("#atlasIndexRows .nu-ixrow")];
    const cells = (r) => [...r.children].map((c) => c.textContent);
    const yrs = rows.map((r) => r.children[0].textContent)
      .filter((t) => /^\d+$/.test(t)).map(Number);
    let ooo = 0;
    for (let i = 1; i < yrs.length; i++) if (yrs[i] < yrs[i - 1]) ooo++;
    const doc = document.documentElement;
    const A = window.NuAtlas;
    return { before, n: rows.length, dated: yrs.length, ooo,
             first: cells(rows[0]), last: cells(rows[rows.length - 1]),
             catalogue: Object.keys(window.NuGenres.GENRES)
               .filter((k) => k.indexOf("lab.eight.") !== 0).length,
             placed: A.ALL.length, roles: Object.keys(A.EXCLUDE).length,
             /* THE RESIDUE, PRINTED AND NOT ASSERTED — see the check below.

                `lab.eight.N` IS NOT A GENRE AND MUST NEVER BE BAKED. The page
                registers one such row per SECTION of the record currently open
                into the same shared GENRES table (ui/eight.js `GK`, and see
                precompose.js:381 / ui/produce.js:16 / document.js:327). They are
                session rows — they change every time Paul opens a different
                record — so counting them here read as "5 anchors are missing
                from WHEN" and sent the reader to `--bake`, which would have
                written five rows of the open song into the atlas's permanent
                table. Measured 2026-08-28: the note said 5 unbaked of 206;
                excluding the prefix it says 201 of 201, all baked. */
             unbaked: Object.keys(window.NuGenres.GENRES)
               .filter((k) => !A.WHEN[k] && !A.EXCLUDE[k]
                           && k.indexOf("lab.eight.") !== 0),
             tap: Math.min(...rows.slice(0, 40)
               .map((r) => r.getBoundingClientRect().height)),
             hscroll: doc.scrollWidth - doc.clientWidth,
             expanded: document.getElementById("atlasIndexBtn")
               .getAttribute("aria-expanded") };
  });
  check(idx.before.hidden === true && idx.before.rows === 0
        && idx.before.expanded === "false" && idx.expanded === "true",
    "G23 · the index is SHUT at boot and its 199 buttons are not even built — " +
    JSON.stringify(idx.before) + " -> expanded " + JSON.stringify(idx.expanded));
  /* EVERY GENRE THE ATLAS HOLDS, AND THE CLAIM IS SAID IN THE ATLAS'S OWN
     TERMS RATHER THAN IN genres.js's. `ALL` (193 place-and-year rows) plus
     `EXCLUDE` (6 roles) IS the atlas's catalogue, and the list is exactly it —
     the 193 in year order and the 6 that have no year after them, not
     pretended into the sequence.

     genres.js CAN BE AHEAD OF IT, AND THAT IS NOT THIS LIST'S BUG TO CARRY.
     `WHEN` is BAKED from the labels by `node nukernel/atlas.gate.js --bake`
     and atlas.gate.js G2 is the gate that fails when a new anchor's label has
     not been baked in yet; an index that closed the gap by parsing `label` at
     draw time would be exactly what nukernel/atlas.js's header forbids ("the
     day somebody writes 'London, 1979' the map silently loses a record"). So
     the residue is PRINTED here with its owner named — the same idiom as
     atlas.gate.js G6b's placeless rows — and asserted where it belongs. */
  check(idx.n === idx.placed + idx.roles && idx.dated === idx.placed
        && idx.ooo === 0,
    "G23 · one click, every genre the atlas holds, oldest first: " + idx.n +
    " rows = " + idx.placed + " placed + " + idx.roles + " roles, " + idx.ooo +
    " out of order · " + JSON.stringify(idx.first) + " … " +
    JSON.stringify(idx.last) +
    (idx.unbaked.length ? " · NOTE " + idx.unbaked.length + " of genres.js's " +
      idx.catalogue + " are not in WHEN yet (" +
      JSON.stringify(idx.unbaked.slice(0, 6)) +
      ") — run `node nukernel/atlas.gate.js --bake`; atlas.gate.js G2 owns that gap"
      : " · genres.js has " + idx.catalogue + ", all baked"));
  check(idx.tap >= 44 && idx.hscroll === 0,
    "G23 · …and a row is a thumb (" + idx.tap + " CSS px) with no horizontal " +
    "page scroll (" + idx.hscroll + " px)");

  /* AND A ROW IS THE GLOBE'S OWN DOOR. Not a second compose path: the row moves
     the SLIDER to the record's year and calls choose(place), so what it writes
     is decided by recordAt exactly as a thumb on the dot is. Proved by the two
     things only the real path can do — #title becomes the record, and the mark
     on the earth takes the ring. */
  await p.evaluate(() => {
    const r = [...document.querySelectorAll("#atlasIndexRows .nu-ixrow")]
      .find((x) => x.dataset.gk === "dub");
    r.scrollIntoView({ block: "center" }); r.click();
  });
  await p.waitForFunction(() => window.__nuName() === "Kingston 1973",
    null, { timeout: 5000 }).catch(() => {});
  await bring();
  await p.waitForTimeout(400);
  const row = await p.evaluate(() => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === "Kingston");
    return { title: window.__nuName(),
             year: document.getElementById("atlasYearOut").textContent,
             ring: g && g.querySelector(".ring").getAttribute("opacity"),
             gname: [...document.querySelectorAll("#atlasNames .lab")]
               .filter((l) => l.dataset.place === "Kingston")
               .map((l) => l.querySelectorAll("text")[1].textContent)[0],
             cur: [...document.querySelectorAll(
               '#atlasIndexRows .nu-ixrow[aria-current="true"]')]
               .map((x) => x.dataset.gk) };
  });
  check(row.title === "Kingston 1973" && row.year === "1973" && row.ring === "1"
        && row.gname === "dub" && JSON.stringify(row.cur) === JSON.stringify(["dub"]),
    "G23 · a row opens its record through the globe's own door — #title " +
    JSON.stringify(row.title) + ", the slider reads " + row.year + ", the mark " +
    "wears the ring, its second line says " + JSON.stringify(row.gname) +
    " and the list marks " + JSON.stringify(row.cur));

  /* ---- G14 NOBODY PHONED HOME ----------------------------------------- */
  const hosts = await p.evaluate((h) => [...new Set(
    performance.getEntriesByType("resource").map((e) => new URL(e.name).host))]
    .filter((x) => x && x !== h), HOST);
  check(!hosts.length, "G14 · every resource came from " + HOST + " " + JSON.stringify(hosts));
  check(!errs.length, "G7 · zero pageerrors / console errors " + JSON.stringify(errs.slice(0, 3)));

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  /* THE DENOMINATOR COUNTED THE FAILURES TWICE (fixed 2026-08-28). It read
     `fails + oks + fails`, so the run that reported "FAILED 3 of 108" had
     actually made 105 checks and passed 102 of them — and the round that read
     that line went looking for 108 passes that never existed. A gate that
     cannot count its own checks is a gate that argues with itself about
     whether it is green. */
  const ok = notes.filter((n) => /^ok/.test(n)).length;
  console.log(fails.length ? "\nFAILED " + fails.length + " of " + (ok + fails.length) :
    "\nALL PASS (" + ok + " checks)  " + PAGE);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
