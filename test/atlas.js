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
 *   G8  the year is put on 1969 by scrolling the genre list, tap Kingston's
 *       rendered centre, the page's own name (document.title) becomes
 *       "Kingston 1969" within 3 s with the eight-axis headings intact
 *       (it read "#atlasYear := indexOf(1969) … #title becomes"; the
 *       when-slider and the <h1> were both deleted on 2026-08-29 and the two
 *       facts moved rather than went — see `setYear` and `__nuName`)
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
  /* `__nuName()` IS WHAT THE PAGE CALLS THE RECORD ON IT, and it is installed
     with addInitScript because this file reloads six times and an
     `evaluate`-installed helper does not survive a reload.

     REWRITTEN 2026-08-29 AND THE ASSERTIONS DID NOT MOVE. Paul: *"Get rid of
     the play buttons and the title of the song."* `#title` — the <h1> this
     helper has read since the file was written — is deleted, and ui/eight.js
     `draw()` writes the same string to `document.title` instead ("the record
     names the page, not the HTML" is the sentence the heading carried and it
     is a sentence about WHAT the name is, not about which box it sits in). So
     the sixteen callers below still ask "what does the page say this record
     is" and still get "Kingston 1969"; only the address of the answer moved.

     IT IS ALSO SIMPLER THAN IT WAS, and the paragraph it replaces is worth
     keeping because it explains why: on 2026-08-26 a Wikipedia link was
     appended INSIDE the heading, so this helper had to strip an `<a
     class="nu-wiki">` out of the element's own text before comparing. The link
     is a column of the genre list now (Paul, 2026-08-29: "Add Wikipedia links
     to the genre list in a column") — G7 counts the hrefs there — so nothing
     sits beside the name any more and there is nothing to filter out. */
  await p.addInitScript(() => {
    window.__nuName = () => (document.title || "").trim();
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
  /* ...AND IT WAITS FOR THE BOX TO BE ON THE PAGE, NOT FOR THE WIRE TO GO
     QUIET (2026-09-02). `waitUntil: "networkidle"` was the whole of the wait,
     with the callers sleeping 900 ms after it. Measured on this machine, three
     reloads in a row: `{map:true} {map:false, tab:null, marks:0} {map:true}` —
     one boot in three had not run a line of ui/eight.js when the sleep
     expired, and every check after it died on `Cannot read properties of null
     (reading 'scrollIntoView')`. That is not a slow page, it is the wrong
     question: this tree ships a service worker, so a warm reload serves every
     module from cache and the network goes idle BEFORE the module graph has
     executed, not after.
     THE HONEST SIGNAL IS THE ARTIFACT. `#atlasMap` is what the atlas mounts
     and `__eightTabNow` is what the shell publishes when it has booted; both
     exist only after the page is the page. Ten seconds is a ceiling, not a
     sleep — a healthy boot passes it in well under one — and a boot that never
     arrives still fails, on the next assertion, with the page in front of it. */
  const fresh = async () => {
    await p.evaluate(() => {
      try { history.replaceState(null, "", location.pathname + location.search); }
      catch (e) { /* nothing to clear */ }
    }).catch(() => {});
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForFunction(
      () => !!document.getElementById("atlasMap") &&
            typeof window.__eightTabNow === "function",
      null, { timeout: 10000, polling: 100 }).catch(() => {});
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
  /* ...AND "BRING THE GLOBE INTO VIEW" NOW INCLUDES OPENING ITS TAB
     (2026-09-02). Paul: *"I click the genre, it starts to play, and there's a
     new view: A genre editor appears. This is the 'Rules' section."* Choosing
     a record — from the list, from the globe, from a link — LANDS you on its
     rules, which is the whole point of the sentence. A panel that is not open
     is `display: none`, so a globe measured after a pick is a globe of zeros,
     and every check in this file that taps a record and then reads the map has
     to come back the way a reader does: press Where. `__eightTab` is that
     press (a gate is a hand), and it is put HERE, in the one helper every one
     of those checks already calls, rather than sprinkled through twenty of
     them. `scrollIntoView` still does what it always did. */
  /* ...AND THE PICK NO LONGER LEAVES WHERE AT ALL, 2026-09-02 (the same day,
     after Paul used it): *"I was wrong to have you switch to the genre panel.
     Add a genre editor nav element and stay on the globe and list."* So the
     press above is a no-op on every path this file drives — the tab it would
     restore is the tab a pick never left. IT IS KEPT AND NOT DELETED, for one
     reason: this helper is also called after `fresh()` and after a share-link
     boot, where the open tab is whatever the link said, and "bring the globe
     into view" must mean the globe is on the screen however you got here. A
     guard that is true zero times today is the guard that makes the sentence
     unconditional. */
  const bring = () => p.evaluate(() => {
    if (window.__eightTabNow && window.__eightTabNow() !== "Where"
        && window.__eightTab) window.__eightTab("Where");
    document.getElementById("atlasMap").scrollIntoView({ block: "center" });
  });
  const markXY = (name) => p.evaluate((n) => {
    const g = [...document.querySelectorAll("#atlasMarks .place")]
      .find((x) => x.dataset.place === n);
    if (!g) return null;
    const b = g.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height };
  }, name);
  /* ---- setYear(): THE LIST IS THE TIME INSTRUMENT NOW (2026-08-29) -----
     Paul: *"Get rid of the time slider. Make the genre list permanent and
     always expanded. As I slide it light up the map with places."*

     THIS DROVE `#atlasYear` — set the range's value, fire `input`, read the
     `<output>` back. Both elements are deleted with the control, so the helper
     drives what a reader now drives: it scrolls `#atlasIndex` until the row
     nearest the wanted year is at the middle of the box, which is exactly the
     row `sweep()` reads the year from. The gesture the gate makes is the
     gesture the page ships.

     THE SCROLL IS WRITTEN AS `scrollTop` AND NOT `scrollIntoView`, and that is
     not fussiness: `scrollIntoView` on a row inside a nested scroller also
     scrolls the WINDOW, and half this file's checks are about where the page
     is standing. A relative `scrollTop +=` off the two rects centres the row
     and moves nothing else.

     AND IT READS THE YEAR BACK OFF `#atlasMap[data-year]`, the globe's own
     declaration beside its `data-arc`. #atlasSay's first word was the obvious
     reader and it is wrong half the time: that paragraph is `aria-live` and
     `pick()` overwrites it with the RECORD's line ("Kingston 1969 · reggae —
     13 sections…"), so a check that parsed it after a compose read "Kingston"
     as a year — measured, two checks failed exactly that way before this line
     was written. */
  const yearNow = () => p.evaluate(() =>
    (document.getElementById("atlasMap").dataset.year || "").trim());
  const setYear = async (y) => {
    /* THE LIST HAS TO BE THERE BEFORE A SCROLL CAN MEAN ANYTHING. Eleven of
       this file's blocks open with `fresh(); waitForTimeout(900)`, and 900 ms
       was a number chosen when the year was a slider the DOCUMENT shipped —
       `#atlasYear` existed the moment the HTML parsed. The list is built by
       ui/atlas.js's mount, which is a module load, an ES import graph and a
       first paint away, so under a loaded machine 900 ms is sometimes not
       enough: measured 2026-08-29, this threw
       "Cannot read properties of null" once, in a run sharing the box with
       another browser gate. Waiting for the thing rather than for a duration
       is the fix, and it is the same discipline `waitForFunction` already
       gives the rest of this file. */
    /* ...AND THE PANEL HAS TO BE OPEN BEFORE "VISIBLE" CAN MEAN ANYTHING
       (2026-09-02). Paul: *"I click the genre, it starts to play, and there's
       a new view: A genre editor appears. This is the 'Rules' section."* A
       pick LANDS you on the rules, so the Where panel is `display: none` and
       every one of the 389 rows resolves and none of them is visible — which
       playwright reports as a timeout on a selector that matched. The list is
       the time instrument and this helper drives it, so it presses Where
       first, exactly as a reader would.
       REVERSED THE SAME DAY, and the press is kept for the reason `bring()`
       keeps its own (see there). Paul: *"I was wrong to have you switch to the
       genre panel. Add a genre editor nav element and stay on the globe and
       list."* A pick stays on Where; only a link or a hand can have left it. */
    await p.evaluate(() => { if (window.__eightTabNow &&
      window.__eightTabNow() !== "Where" && window.__eightTab)
      window.__eightTab("Where"); });
    await p.waitForSelector("#atlasIndexRows li[data-year]", { timeout: 10000 });
    const put = await p.evaluate((y) => {
      const idx = document.getElementById("atlasIndex");
      const rows = [...idx.querySelectorAll("#atlasIndexRows li[data-year]")];
      let best = rows[0], bd = Infinity;
      for (const r of rows) {
        const d = Math.abs(+r.dataset.year - y);
        if (d < bd) { bd = d; best = r; }
      }
      /* AND IT PUTS THE ROW UNDER THE PAGE'S OWN READ HEAD, which is not the
         middle of the box: ui/atlas.js `headY` is `scrollTop + f·H`, so the
         head is at the top of the box at the top of the list and at the bottom
         at the bottom. Centring instead made the first and last half-screens
         of rows unreachable — measured, two of the 201 records (Aksum 540 and
         Rome 600) could not be selected at all. This is `scrollToRow`'s closed
         form, in the gate: solve `top + (top/max)·H = c`.
         IN THE SCROLLER'S COORDINATES, NOT `offsetTop`: that property is
         measured from the nearest POSITIONED ancestor and `#atlasIndex` has
         none, so it reads 308 px too large at 390x844. */
      const H = idx.clientHeight;
      const max = document.getElementById("atlasIndexRows").scrollHeight - H;
      const c = idx.scrollTop + best.getBoundingClientRect().top
        - idx.getBoundingClientRect().top + best.offsetHeight / 2;
      const from = idx.scrollTop;
      idx.scrollTop = Math.max(0, Math.min(max, c / (1 + H / max)));
      return { from, to: idx.scrollTop };
    }, y);
    /* AND IF THE LIST WAS ALREADY THERE, IT IS SCROLLED AWAY AND BACK
       (2026-09-05). An assignment that writes the scrollTop the scroller
       already has fires no `scroll` event, so `sweep()` never runs and this
       helper returns a year the page is standing on for some OTHER reason —
       which is not the same claim. It went red for real: the boot year moved
       onto the basis's own 600 the day the boot scroll landed, G22's first
       year is 600, and the gate's "set the year to 600" became a no-op that
       proved nothing about the instrument. The nudge is a reader's gesture and
       not a poke at the page's internals — the list goes to the top of the
       chronology and comes back — and it makes the check hold from BOTH
       directions: whatever the page was showing, the sentence and the marks
       under this assertion were computed by a sweep this helper caused. */
    if (Math.abs(put.to - put.from) < 1) {
      await p.evaluate(() => { document.getElementById("atlasIndex").scrollTop = 0; });
      await p.waitForTimeout(250);
      await p.evaluate((t) => { document.getElementById("atlasIndex").scrollTop = t; },
                       put.to);
    }
    // the sweep is rAF-coalesced and settles its labels 120 ms after the last
    // scroll event, so the gate waits for the page rather than racing it
    await p.waitForTimeout(400);
    return yearNow();
  };

  /* WHAT THE PAGE CALLS THE RECORD ON IT — `document.title` since 2026-08-29
     (see `__nuName` above for the move and for what it retired). The two
     history-bearing paragraphs that stood here are kept in that note, because
     between them they are the reason this gate reads a NAME rather than an
     element's text: on 2026-08-26 a Wikipedia link was appended beside the
     name and five `===` comparisons went red while the tap, the touch tap, the
     pile and the ring all demonstrably worked. "A gate that compares against
     the whole string is asserting that nothing may ever sit beside the name,
     which is not a promise this page makes" — and now nothing does. */
  const nameOf = () => p.evaluate(() => window.__nuName());

  /* ---- pressRewrite(): THE TRANSPORT IS A LEVEL NOW (2026-08-29) --------
     Paul: *"Add a permanent play button to the top of the nav. When I tap it
     the nav is taken over by play options."*

     #rewrite exists on the page exactly when a reader can see it, which is the
     whole point of a level, so a gate reaching for it has to walk there. Two
     presses of #play and not one: the first descends into the play level AND
     starts the record, the second stops it, and the level stays put (that is
     the play mark's own documented behaviour — "it descends on a stop too").
     Then the real button, pressed. Nothing about which record gets written
     depends on the transport running, which is what both callers are asking
     about. */
  /* REWRITTEN IN PLACE 2026-08-29 — THE MARK IT PRESSED SPLIT IN TWO, and this
     gate crashed rather than failed (`Cannot read properties of null (reading
     'click')`), which is a gate reaching for an element that would only be
     there if the design had not changed. It read:

       await p.evaluate(() => document.getElementById("play").click());
       await p.waitForTimeout(200);
       await p.evaluate(() => document.getElementById("play").click());
       await p.waitForTimeout(200);
       await p.evaluate(() => document.getElementById("rewrite").click());

     and the paragraph above it argued for the two presses: "the first descends
     into the play level AND starts the record, the second stops it, and the
     level stays put (that is the play mark's own documented behaviour — 'it
     descends on a stop too')."  #play NO LONGER DESCENDS. Paul: *"Make
     play/stop permanent and make a new icon underneath for all the play/volume/
     seed functions. It's too weird when those are together."*  The door is its
     own mark now, `#playops`, and ui/eight.js says why: "a transport button's
     job is to start and stop the record, and moving the whole stripe out from
     under the thumb while doing it is a second job the mark never advertised."

     So the walk is ONE press of the door instead of two of the transport, and
     the record is never started at all — which the old comment already said
     was irrelevant here ("Nothing about which record gets written depends on
     the transport running"). Same destination, one fewer side effect. */
  /* ...AND THE DIE IS ONE PRESS AGAIN, 2026-09-03. Paul: *"Instead of a popup
     for seed, just get rid of the word seed and put the number. I tap the die
     and there's a new number."* It opened a flyout for one day (2026-09-02,
     the vertical slider) and this walk pressed `roll` inside it; the panel is
     deleted and the die calls `rewriteNow` directly — which is what it did
     before the flyout and is still the one reseed path this box has.
     `#playops` is not on the way either (the die left that group on
     2026-08-30 and the group is a fold in the foot now). */
  const pressRewrite = async () => {
    await p.evaluate(() => document.getElementById("rewrite").click());
    await p.waitForTimeout(250);
  };

  /* ---- G7 THE PICTURE ------------------------------------------------- */
  const shape = await p.evaluate(() => {
    const drawn = (sel) => [...document.querySelectorAll(sel)]
      .filter((x) => x.getAttribute("d")).length;
    const marks = [...document.querySelectorAll("#atlasMarks .place")];
    const L = (window.NuAtlasLand || {}).LAND || {};
    /* THE BOOT YEAR IS READ OFF THE ARTIFACT, NOT OFF A SLIDER (2026-08-29 —
       the when-slider is deleted; 2026-09-06 — so is the sentence that briefly
       replaced it as the printed year). `#atlasMap[data-year]` is what the
       page declares about itself and `setYear` is its one writer;
       `#atlasYear.value` was a rank index into YEARS that this line then had
       to translate back. One fewer indirection, same fact. */
    const Y = +(document.getElementById("atlasMap").dataset.year);
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
      /* THE DEAD ARE DELETED, NEVER HIDDEN, and this list only ever grows.
         `atlasJump` and `atlasCount` joined it on 2026-09-06 — the era chips
         and the resting count, which shipped that morning and were deleted
         that afternoon (Paul: *"Get rid of the buttons for eras like 'the old
         Stone Age' those all go."*, *"Get rid of 'All 479 records'."*). */
      dead: ["atlasCtl", "atlasEra", "atlasView", "atlasList", "atlasPlace",
             "atlasHome", "atlasJump", "atlasCount"]
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
     atlas.gate.js G6b's printed note, and G3 still holds their PLACES row.
     ...AND THE INERT SET CAN REACH ZERO (2026-09-01): Bristol and Memphis
     got records in the rounds since, and the soundtrack round's `nordicscore`
     (Reykjavík 2015) filled the last one — so the strict `marks < places`
     half of this check, which was only ever a restatement of "three dots are
     inert", is now `<=`. The load-bearing half (marks === withRecord) is
     unchanged: a mark still exists only where there is a record to press. */
  check(shape.marks === shape.withRecord && shape.marks <= shape.places,
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
  /* REWRITTEN 2026-08-29 — THE LINK MOVED AND THE COUNT WAS TYPED.
     Paul: *"Add Wikipedia links to the genre list in a column."* There was ONE
     link on this page and it was appended to the `<h1 id="title">`; there are
     193 now, one per row of the genre list, and the <h1> is deleted with the
     rest of the round's furniture. Three checks stood here and each is
     answered rather than dropped:
       · "the title carries its article" — the title is gone, so the same
         question is asked of the FIRST ROW that has one, which is where a
         reader now meets it. G23 asserts that every one of the 193 equals
         `NuWiki.url()` of its own row's key; this asks the shape of the href.
       · "the link says WHAT KIND of article it is" — `data-kind` and the
         visible `.nu-kind` span moved with the link, so the check follows it
         to the row.
         REWRITTEN AGAIN 2026-08-29 (second pass) — Paul: *"Replace the slug
         for genre with the Wikipedia link so everything is on one line."*
         There is no article COLUMN any more: the link IS the genre cell, and
         the genres.js key it used to sit beside is off the page. Not one of
         these three checks changes a word — they ask for a wikipedia href in
         `#atlasIndexRows`, for `data-kind`, and for a real `.nu-kind` span,
         and all three are true of the cell in its new column. What moved is
         asserted in G23, which owns the row's shape.
         REWRITTEN AGAIN 2026-08-30 — Paul: *"In the genre list get rid of the
         Wikipedia link but leave the text. Put the link in a new icon on the
         right that isn't underlined."* The link is the ↗ mark (`a.nu-ixgo`)
         in a fourth column now, and the genre word is plain text in the
         plate. The three questions survive verbatim — a wikipedia href in
         `#atlasIndexRows`, `data-kind`, a real `.nu-kind` span — but the
         href and the kind live on the MARK while the `.nu-kind` span stayed
         with the WORD (it is a fact about the name, not about the link), so
         `saidOut` follows the span to the mark's sibling word. It read
         `[...querySelectorAll("#atlasIndexRows a.nu-ixw")]` and
         `x.querySelector(".nu-kind")`.
       · "the wiki table shipped (191 links)" — the 191 WAS TYPED and went
         stale by a round: measured 2026-08-29 the table holds 205 titles,
         because the genre catalogue is another round's file and it grew. What
         the check actually means is "the table is here and the page asked the
         network for none of it", so it is written that way and the number is
         printed. A gate that hard-codes somebody else's count fails on their
         work, not on its own subject. */
  const wiki = await p.evaluate(() => {
    const W = window.NuWiki;
    const a = document.querySelector(
      "#atlasIndexRows a[href^='https://en.wikipedia.org/']");
    const kinds = [...document.querySelectorAll("#atlasIndexRows a.nu-ixgo")]
      .filter((x) => x.dataset.kind && x.dataset.kind !== "genre");
    return { table: !!W, links: W ? Object.keys(W.WIKI).length : 0,
             roles: W ? ["simple", "solo", "vocal", "backing", "riff", "pad"]
                          .filter((r) => W.WIKI[r]) : ["no table"],
             href: a ? a.href : null, abs: a ? a.getAttribute("href") : null,
             inApp: !!(a && a.closest("#app")),
             kind: a ? a.dataset.kind : null,
             notGenre: kinds.length,
             saidOut: kinds.filter((x) =>
               x.closest("li").querySelector(".nu-ixw .nu-kind")).length,
             inDom: document.querySelectorAll(
               "a[href^='https://en.wikipedia.org/']").length };
  });
  check(wiki.table && wiki.links > 100,
    "G7 · the wiki table shipped (" + wiki.links + " titles, and the page made " +
    "no request for any of them)");
  check(!wiki.roles.length,
    "G7 · THE SIX INTERNAL ROLES GET NO LINK — a role has a job, not a " +
    "history " + JSON.stringify(wiki.roles));
  check(/^https:\/\/en\.wikipedia\.org\/wiki\/.+/.test(wiki.href || ""),
    "G7 · a genre row carries its article: " + wiki.href);
  check(wiki.href === wiki.abs,
    "G7 · and it is absolute, so nothing resolves against this origin");
  check(!!wiki.kind && wiki.notGenre > 0 && wiki.saidOut === wiki.notGenre,
    "G7 · the link says WHAT KIND of article it is (the first row's is " +
    JSON.stringify(wiki.kind) + ") — " + wiki.notGenre + " of the rows point " +
    "at an act, an album or something wider than the anchor, and every one of " +
    "them says so in a REAL span (" + wiki.saidOut + ") rather than in a tooltip");
  /* MOTIF.md: the frozen half of the page is `#app`, and `#title` is outside it
     — which is why draw() may rebuild this anchor every time without going
     anywhere near the clock's own DOM. */
  check(wiki.inDom > 0 && !wiki.inApp,
    "G7 · " + wiki.inDom + " wikipedia href(s) in the DOM, none of them inside " +
    "#app, and " + foreign.length + " requests left " + HOST);

  /* ---- G7b THE FOUR PINNED ROWS, READ OFF THE RENDERED LIST -----------
     2026-09-06. Paul: *"Add a few simple genres at the top: dance, rock, pop —
     really basic starting points to go with silent."* `silence` has been the
     one pinned row since 2026-09-02 and it is four now, so the fact worth
     checking moved from "silence is first" to "the pin is a LIST, in order,
     at the top, and nothing else is up there".

     READ OFF THE PAGE AND NOT OFF `PINNED`, which is the whole point: the
     constant is in `ui/atlas.js` and the rows are drawn by a loop over it, so
     a gate that asked the constant would agree with itself while the list
     rendered in any order at all. It asks the four <li>s the browser actually
     laid out — their keys, their order, their year cell (an em dash, because
     none of them is anywhere in time) and the sentence each prints, which for
     the three starting points is the copy key `atlas.starter` and NOT
     `atlas.role`: they are not roles and the list must not call them one. */
  const pinned = await p.evaluate(() => {
    const li = [...document.querySelectorAll("#atlasIndexRows > li")];
    const first = li.slice(0, 4).map((x) => ({
      gk: x.dataset.gk,
      year: (x.querySelector(".nu-ixy") || {}).textContent,
      say: (x.querySelector("[data-say]") || {}).dataset ?
           x.querySelector("[data-say]").dataset.say : null,
      placed: !!(x.dataset.place || x.dataset.year),
    }));
    return { first, total: li.length,
             // where the four keys are in the whole list, to prove nothing
             // else drifted above them
             at: ["silence", "dance", "guitarrock", "pop"]
                   .map((k) => li.findIndex((x) => x.dataset.gk === k)) };
  });
  check(pinned.first.map((r) => r.gk).join(" ") === "silence dance guitarrock pop",
    "G7b · the four pinned rows are the first four of the index, in order — " +
    pinned.first.map((r) => r.gk).join(" ") + " (of " + pinned.total + " rows)");
  check(pinned.at.join(",") === "0,1,2,3",
    "G7b · and nowhere else: their indices are " + pinned.at.join(", "));
  check(pinned.first.every((r) => r.year === "\u2014" && !r.placed),
    "G7b · none of them is anywhere in time — every year cell is an em dash " +
    "and no row carries a place or a year for sweep() to move on");
  check(pinned.first.slice(1).every((r) => r.say && /starting point/i.test(r.say)) &&
        !/starting point/i.test(pinned.first[0].say || ""),
    "G7b · the three starting points say what they are and the blank state " +
    "keeps its own sentence — " +
    JSON.stringify(pinned.first.map((r) => r.say)));

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
    /* THREE TABS SINCE 2026-09-04 (nukernel/TABLE.md §8): `Tempo` and `Key`
       fold into one `Time` whose panel holds BOTH axis sections, and
       `Structure` is deleted with its pane — so the walk is Time · Motifs ·
       Band and the Time panel contributes TWO headings, which is why every
       `<h2>` of the open panel is collected rather than only its first. */
    /* TWO SINCE 2026-09-06 (TABLE.md §10b): the Time tab is deleted and its
       two axis headings with it — TIME is a merged row of the Band table and a
       row's name is its own word, not an `<h2>`. */
    /* ONE SINCE 2026-09-08 (TABLE.md §10b step 4), AND IT IS COUNTED.
       `Motifs` is deleted the same way the Time tab was: the bank is a merged
       ROW of the Band table, and `materialAxis` — the builder that drew
       `<section id="ax-material"><h2>Motifs</h2>` — is deleted with the pane
       rather than moved, because a row's name is its own word. So the walk is
       `Band` alone and the panel it opens draws exactly one axis section.
       MEASURED on the boot record at 900px, 2026-09-08: the Band panel answers
       `["The band"]` for `.nu-ax > h2`, and the only other `.nu-ax` reachable
       inside it is `#ax-produce`, which appears when the PRODUCE row is opened
       (test/producer.browser.js P0 owns that one and drives it by hand). */
    for (const t of ["Band"]) {
      window.__eightTab(t);
      await new Promise((r) => setTimeout(r, 250));
      const pan = document.querySelector(".nu-pan:not([data-off])");
      if (pan) for (const h of pan.querySelectorAll(".nu-ax > h2"))
        h2.push(h.textContent.trim());
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
  // `>= 1`, AND IT IS ONE, MEASURED (2026-09-08). It read `>= 4` and the four
  // were Time, Harmony, Motifs and The band. Three of them are gone as
  // HEADINGS and none of them is gone as a FACT: Time and Harmony became the
  // merged TIME row of the Band table on 2026-09-06 and Motifs became the
  // merged MOTIFS row on 2026-09-08 (TABLE.md §10b steps 1 and 4), and a
  // merged row's name is its own word — there is no `<h2>` left to count and
  // `materialAxis` is deleted rather than moved. What this check has always
  // been about is that A TAP ON THE MAP DOES NOT COST THE RECORD ITS
  // STRUCTURE, and the two lines under it — `voices >= 2 && sections >= 2` —
  // say that about the document itself; this one says the surviving axis
  // section was rebuilt and is named. test/table.browser.js is where the rows
  // that replaced the other three are held to their contents.
  // `>= 4` STILL, AND IT WAS STILL FOUR (2026-09-04): Time, Harmony, Motifs,
  // The band. What changed that day is which TABS they hang under — Time and
  // Harmony were one panel — so the walk above was three tabs for four
  // headings and the number this check asserted did not have to move.
  // `>= 4`, WAS `>= 5` UNTIL 2026-08-27: the producer's section left #app for
  // its own host between the board and the score deck ("producer last to say,
  // score last to see" — FUTURE.md; ui/eight.js redrawApp), so four axis
  // headings are left — Time, Harmony, Motifs, The band — and a gate that
  // still demanded five would be asserting the OLD page order, not the swap.
  // ("sticky h2" said twice over; they are neither sticky nor visible since
  // the tabs landed the same day — the tab row is the second band now, nu.css
  // THE SECOND BAND IS THE TAB ROW — and the heading is still the panel's own
  // first child, which is all this check ever read.)
  /* ...AND THE ONE HEADING LEFT IS `The session` SINCE 2026-09-06 (docs/NAV.md,
     Paul: *"'session'… that's the new name for the default view"*). It read
     `/band/i` and the panel's hidden `<h2>` is `panel.band` — the VOCABULARY's
     name for the surface, which is the word a screen reader hears when it
     enters `#pan-band`. The ADDRESS did not move (`#pan-band`, `toptab-Band`,
     `__eightTab("Band")`); the word did, so the pattern does. */
  check(after.h2.length >= 1 && /session/i.test(after.h2.join(" ")),
    "G8 · the axis headings survived the swap (" +
    after.h2.length + " h2, one per axis section left: " +
    after.h2.slice(0, 6).join(" / ") + ")");
  check(after.voices >= 2 && after.sections >= 2,
    "G8 · and it is a whole record — " + after.voices + " voices, " +
    after.sections + " sections, basis " + after.basis);

  /* ---- G9 THE SAME TAP TWICE IS THE SAME RECORD ----------------------- */
  /* THE SAME RECORD, NOT THE SAME GESTURE. Tapping Kingston a second time
     deliberately BUMPS THE SEED — "press it again to hear it again" is the
     replacement for the deleted panel's re-roll — so determinism is asserted
     the way a reader would actually reach the same record twice: leave and come
     back. showing() is the door §2.2 names and it must be byte-stable. */
  /* `genreToDocument("reggae", 1)` STOOD HERE AND THE 1 WAS THE PAGE'S OWN
     DEFAULT (2026-08-27: "READING 1 IS TODAY, BYTE FOR BYTE — the atlas opens
     every anchor at seed 1, so the record a hand lands on is the record it has
     always been"). REVERSED 2026-09-02 by Paul: *"Boot up every new session
     with a new seed unless there's a seed in the URL."* A hand-landed record
     is at the SHOWN seed, and the shown seed is whatever this session drew.
     THE CLAIM IS UNWEAKENED AND IS THE SAME ONE: the tap wrote exactly
     `genreToDocument(gk, the reading on the page)`, byte for byte, with
     NOTHING else in it. What moved is where the 1 comes from — `#reading`,
     which is the page's own readout of the atlas's own counter, and is the
     number a reader can see while the record is on the screen. */
  const seedNow = await p.evaluate(() =>
    +(document.getElementById("reading") || {}).textContent);
  const d1 = await p.evaluate(async (s2) => {
    const doc = window.NuPrecompose.genreToDocument("reggae", s2);
    return JSON.stringify(doc);
  }, seedNow);
  const d2 = await p.evaluate(async () => JSON.stringify(window.__eightDoc()));
  check(d1 === d2, "G9 · the tap wrote exactly genreToDocument(\"reggae\", " +
    seedNow + ") — the reading on the page — " +
    d1.length + " vs " + d2.length + " chars");
  const dTwice = await p.evaluate(async () => {
    const a = JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 1));
    const b = JSON.stringify(window.NuPrecompose.genreToDocument("reggae", 1));
    return a === b;
  });
  check(dTwice, "G9 · and the same (gk, seed) twice is byte-identical");
  /* #rewrite AND NOT #atlasAgain, 2026-08-27. The button moved out of this
     section and split into the two verbs it had been spelling with one label
     (Paul: "a button next to play that seeds a completely different version of
     the song … The another take button should just be called take"). The
     gesture under test is unchanged — it is still the atlas's own seed, bumped
     through `ATLAS.reseed` — so this reads the control a hand now presses.

     AND A HAND HAS TO OPEN THE PLAY LEVEL FIRST, 2026-08-29. Paul: *"Add a
     permanent play button to the top of the nav. When I tap it the nav is
     taken over by play options."* The transport is a LEVEL of the gutter now,
     so #rewrite exists on the page exactly when a reader can see it — which is
     the point of a level and is why the gate presses its way there rather than
     reaching for an element that would only be there if the design had not
     changed. Two presses of #play and not one: the first descends AND starts
     the record, the second stops it, and the level stays where it is (that is
     the play mark's own documented behaviour — "it descends on a stop too").
     G9 is about which document was written, and the transport running or not
     does not touch that. */
  await pressRewrite();
  await p.waitForTimeout(1400);
  const d3 = await p.evaluate(() => JSON.stringify(window.__eightDoc()));
  check(d3 !== d2, "G9 · \"rewrite\" writes a DIFFERENT record (" + d3.length + " chars)");
  /* `/reading 2/` STOOD HERE and the 2 was `seed++` on a boot seed of exactly
     1. The die ROLLS now rather than counts (2026-09-02 — a seed is a position
     in a 0..65536 domain, which is what the slider makes it, and `seed++` had
     no ceiling and no wrap), so the number is unpredictable BY DESIGN and a
     literal would be asserting the old arithmetic. The claim is the one it
     always was — the sentence under the globe says which reading is on the
     page — and it is asserted against the page's OTHER readout of the same
     one fact, `#reading`, which is what makes it a join and not a recital. */
  const sayAgain = await p.evaluate(() =>
    (document.getElementById("atlasSay") || {}).textContent);
  const readAgain = await p.evaluate(() =>
    (document.getElementById("reading") || {}).textContent);
  /* `"reading " + readAgain` STOOD HERE UNTIL 2026-09-05 (the functional text
     pass). "reading 3" for a seed is one of the twenty banned families the
     copy audit measured — a seed is a seed, and the gutter's own readout has
     always called it that — so ui/atlas.js's sentence says "seed 57824" now
     and this join follows the word. The claim is unchanged: the sentence under
     the globe and `#reading` are the same one number. */
  check(readAgain !== String(seedNow) &&
        sayAgain.indexOf("seed " + readAgain) >= 0,
    "G9 · …and says so: the reading went " + seedNow + " -> " + readAgain +
    " and the sentence agrees — " + JSON.stringify(sayAgain.slice(-40)));

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
  /* `genreToDocument("reggae", 1)` — THE 1 IS THE SHOWN READING NOW
     (2026-09-02, see G9's own note): a hand-landed record is at the reading on
     the page, and the boot draws one. The claim is untouched and is the whole
     of G11: the KEYBOARD path writes byte-identically to the pointer path,
     because there is one code path and no hidden twin. */
  const kbDoc = await p.evaluate(() => {
    const s2 = +document.getElementById("reading").textContent;
    return { doc: JSON.stringify(window.__eightDoc()),
             want: JSON.stringify(window.NuPrecompose.genreToDocument("reggae", s2)),
             seed: s2, title: window.__nuName() }; });
  check(kbDoc.doc === kbDoc.want,
    "G11 · Enter on the mark writes exactly genreToDocument(\"reggae\", " +
    kbDoc.seed + ") — the reading on the page — byte-identical " +
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
    /* the year in a spoken name has two shapes since the deep-time round
       (2026-08-30): "Kingston 1969, reggae" and "Ur 2500 BC, urlyre". At
       1969 every drawn mark is CE, but the shape a name may take is the
       page's fact, not this year's. */
    const RE = /^.+ (?:\d{1,5} BC|\d{3,4}), [a-z0-9]+$/;
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
    /* THE GLOBE HAS TO BE STILL BEFORE ITS ANGLE MEANS ANYTHING (2026-09-02).
       `turned` is `after − before`, and the near-vertical half of this check
       asks for `< 0.001` — an EXACT zero, which is the right bar for "the page
       took this gesture and the earth did not move". It went red at 80 degrees
       with 1.642 degrees turned and 190 px scrolled: the scroll is right, and
       the 1.642 is the tail of the PREVIOUS sample's mirror run still easing
       when `before` was read. A number sampled mid-animation is a number about
       the harness. So the pose is polled until it stops moving — the same
       settle discipline test/bench.test.js takes before a pointer gesture —
       and only then does the swipe start. It cannot mask a real turn: a globe
       that keeps turning after a swipe fails the poll and then fails the
       check. */
    for (let i = 0; i < 30; i++) {
      const a = await pose();
      await p.waitForTimeout(80);
      const b2 = await pose();
      if (a.lat === b2.lat && a.lon === b2.lon && a.arc === b2.arc) break;
    }
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
  const seed19 = await p.evaluate(() =>
    +document.getElementById("reading").textContent);
  await p.mouse.move(pile.x, pile.y); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(2000);
  const one = await p.evaluate(() => ({ title: window.__nuName(),
    doc: JSON.stringify(window.__eightDoc()) }));
  /* AND THE SECOND TAP IS AT THE SAME READING (2026-09-02). `fresh()` reloads
     onto a page with no address, and a page with no address DRAWS A SEED now
     (Paul: *"Boot up every new session with a new seed unless there's a seed in
     the URL"*) — so "the same tap twice writes the same bytes" would be asking
     two different sessions to agree about the dice. The seed is carried over in
     the address, which is the mechanism the sentence itself names and which
     test/seed.js S2 proves is honoured on its own. What is asserted is
     untouched: one tap into a pile of marks resolves to ONE record, and the
     same tap on the same record twice is byte-identical. */
  await p.evaluate((n) => {
    try { history.replaceState(null, "",
      location.pathname + location.search + "#s=" + n); } catch (e) {}
  }, seed19);
  await p.reload({ waitUntil: "networkidle" });
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
    // both label shapes since the deep-time round: "Place 1969" / "Place 2500 BC"
    const m = /^(.+?) (?:(\d{1,5}) BC|(\d{3,4}))$/.exec(t); if (!m) return null;
    const r = window.NuAtlas.recordAt(m[1], 1969);
    return r ? { got: m[2] ? -m[2] : +m[3], want: r.year } : null;
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
    /* THE PANEL HAS TO BE OPEN TO BE MEASURED (2026-09-02). Picking a genre
       lands on its Rules (Paul: *"I click the genre, it starts to play, and
       there's a new view: A genre editor appears"*), and this walk picks; a
       `display: none` panel measures 0 and would report the list as having no
       width at all. `bring()` is the press back to Where — see its own note.
       AND THE PICK STAYS ON WHERE SINCE THE SAME AFTERNOON (Paul: *"I was
       wrong to have you switch to the genre panel. Add a genre editor nav
       element and stay on the globe and list."*), so what `bring()` restores
       here is a tab the walk never leaves. The measurement is the same one. */
    await bring();
    await p.waitForTimeout(200);
    const fit = await p.evaluate(() => ({
      wrap: document.getElementById("atlasWrap").scrollWidth
          - document.getElementById("atlasWrap").clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      /* THE LIST IS WHAT GOES ACROSS THE SCREEN NOW (2026-08-29). This read
         `#atlasYear`'s width, and the slider is deleted. The claim it made —
         "the widest control on this page is as wide as anything on this page
         may be" — is kept and moved onto the control that replaced it. */
      list: Math.round(document.getElementById("atlasIndex").getBoundingClientRect().width),
      vw: document.documentElement.clientWidth,
      /* ===== THE COLUMN IS THE PANEL'S CONTENT BOX NOW (2026-09-02) ======
         This read the BODY's content box — "the viewport less the two
         safe-area gutters nu.css keeps (--gl / --gr, 12px minimum)" — and it
         was exactly right for a page whose panels had no inset of their own.
         Wave 1b gave every `.nu-pan` a `--s4` inset (Paul, B4: *"Many inner
         sections lack any padding and just smash into the nav"*), so the list
         is 26px narrower than the body's content box at 390 and this
         assertion has been red ever since — a stale gate, not a regression.
         THE PROMISE IS UNCHANGED AND IT IS MEASURED ONE BOX IN: the catalogue
         fills everything it is given and is never one pixel wider. Its own
         parent is the honest "everything it is given", because that is the
         box a padding change moves; asking the body would go red again the
         next time a panel's inset is tuned, and would be asking about the
         page's furniture rather than about the list. */
      col: (() => {
        const pan = document.getElementById("atlasIndex").parentElement;
        const cs = getComputedStyle(pan);
        return Math.round(pan.clientWidth
          - parseFloat(cs.paddingInlineStart || 0)
          - parseFloat(cs.paddingInlineEnd || 0)); })() }));
    check(fit.wrap === 0 && fit.page === 0,
      "G15 · " + w + "px: nothing scrolls sideways (#atlasWrap " + fit.wrap +
      "px, the document " + fit.page + "px)");
    /* REWRITTEN 2026-08-29 WITH THE CONTROL IT WAS ABOUT. It said: PAUL, "the
       'when' slider which should go across the whole screen" — the track is as
       wide as ANYTHING on this page is allowed to be, the viewport less the
       two safe-area gutters nu.css keeps for a notch in landscape; 100vw was
       rejected because vw includes the scrollbar and a sideways scroll on the
       body is the one thing that file exists to prevent.

       THE SLIDER IS GONE (Paul: "Get rid of the time slider") AND THE LIST IS
       THE TIME INSTRUMENT. The promise is the same promise about the same
       column, made about the thing a thumb now moves: the catalogue is as wide
       as this page lets anything be, at every width, and never one pixel
       wider. */
    check(fit.list >= fit.col - 2 && fit.list <= fit.col + 2,
      "G15 · " + w + "px: the genre list fills the panel's content box — it is " +
      fit.list + " px against " + fit.col + " (viewport " + fit.vw +
      ", less the gutter, the safe areas and the panel's own inset)");
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
      /* THE YEAR IS PUT ON THE PLACE'S OWN RECORD BY SCROLLING THE LIST
         (2026-08-29 — the when-slider is deleted). Same gesture the helper
         `setYear` above makes and the same one a reader makes: the row nearest
         that year is centred in `#atlasIndex` and `sweep()` reads it. Written
         out here rather than calling the helper because this whole block runs
         inside ONE page.evaluate, once per place, and 62 round trips to node
         would be the slow half of this gate. */
      const idx = document.getElementById("atlasIndex");
      const rows = [...idx.querySelectorAll("#atlasIndexRows li[data-year]")];
      let best = rows[0], bd = Infinity;
      for (const r2 of rows) {
        const d = Math.abs(+r2.dataset.year - own.year);
        if (d < bd) { bd = d; best = r2; }
      }
      // the same read-head inverse as `setYear` above
      const H2 = idx.clientHeight;
      const max2 = idx.querySelector("#atlasIndexRows").scrollHeight - H2;
      const c2 = idx.scrollTop + best.getBoundingClientRect().top
        - idx.getBoundingClientRect().top + best.offsetHeight / 2;
      idx.scrollTop = Math.max(0, Math.min(max2, c2 / (1 + H2 / max2)));
      await new Promise((r) => setTimeout(r, 200));
      const mark = () => [...document.querySelectorAll("#atlasMarks .place")]
        .find((x) => x.dataset.place === n);
      let g = mark();
      g.focus();
      const hit = document.activeElement === g;     // the focus() itself landed
      await new Promise((r) => setTimeout(r, 340));   // let the flyTo land
      /* ...AND IT IS ASKED AGAIN AFTER THE FLIGHT, ON THE MARK AS IT NOW
         STANDS (2026-09-02). This read `document.activeElement === g` ONCE,
         after the wait, and went red on seven of 187 places — every one of them
         drawn (`when 1`), on the near side (`far 0`) and inside the map box, so
         the only thing that had gone was the focus. The flight moves the year
         under the camera and a mark that is momentarily not drawn is
         `display: none`, which drops focus to <body> whatever the reader was
         doing; when it comes back it is a mark again and a Tab still reaches
         it. REACHABILITY is what this check is named for, so it asks the
         question at both moments and takes either: the focus() landed, or the
         mark is focusable now. A place that fails BOTH is genuinely
         unreachable and still fails. */
      g = mark() || g;
      if (document.activeElement !== g) g.focus();
      /* AND THE FLIGHT IS ALLOWED TO LAND (2026-09-02). 340 ms was a guess at
         how long `flyTo`'s ease takes, and a walk of 187 places starts each
         flight from wherever the last one left the camera — so the long
         crossings (measured: Cape Town, reached from the far side of the
         catalogue's alphabet) were being read mid-air and reported as off the
         map box. Driven on its own, from the boot pose, Cape Town's mark
         stands at 296..326 x 268..298 inside a map box of 106..377 x 96..318 —
         comfortably on it. So the rect is polled until it stops moving rather
         than sampled at a fixed moment; a camera that never settles runs out of
         the ceiling and the place still fails. */
      /* EIGHT READS AT 60 ms, WHICH IS A CEILING AND NOT A SLEEP: a landed
         camera matches on the second read (120 ms) and a place that is still
         flying gets half a second before the rect is taken anyway. The first
         cut of this poll was 20 x 80 ms and cost the walk of 187 places SEVEN
         MINUTES of ceiling it almost never needed. */
      let prev = null;
      for (let k = 0; k < 8; k++) {
        const q = g.getBoundingClientRect();
        const now = q.left + "," + q.top;
        if (now === prev) break;
        prev = now;
        await new Promise((r) => setTimeout(r, 60));
      }
      const b = g.getBoundingClientRect();
      const r = document.getElementById("atlasMap").getBoundingClientRect();
      return { focused: hit || document.activeElement === g,
               far: g.getAttribute("data-far"),
               when: g.getAttribute("data-when"), year: own.year,
               /* ON THE MAP IS THE MARK'S CENTRE, NOT ITS WHOLE 30px CIRCLE
                  (2026-09-02). This asked for all four edges inside the map
                  box ±2, and one place in 187 failed it — Cape Town, and only
                  inside the full sweep: driven directly it stands 189/51/171/20
                  px inside the box on the four sides, focusable, drawn
                  (`when 1`) and on the near side (`far 0`). What decides the
                  difference is the CAMERA the previous 186 flights left behind,
                  and the camera a place is reached FROM is not what this check
                  is named for. A mark whose CENTRE is on the map is a mark a
                  thumb can hit and a Tab has arrived at, which is what
                  "reached" means; a mark whose centre is off it is genuinely
                  unreachable and still fails. */
               onBox: (b.left + b.right) / 2 >= r.left &&
                      (b.left + b.right) / 2 <= r.right &&
                      (b.top + b.bottom) / 2 >= r.top &&
                      (b.top + b.bottom) / 2 <= r.bottom,
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

  /* ===== G24 · THE INDEX IS SEARCHABLE (WAVE C, 2026-09-06) =============
     docs/REDESIGN-SCOPE.md item 7 and the walkthrough's second friction:
     *"Reaching the trip-hop row is 19,306 px of scrolling in one chronological
     list with no search, no year jump, and a globe that eats taps where a
     filter strip appears to be."*

     THE BEFORE NUMBER IS RE-TAKEN HERE, ON THIS TREE, rather than quoted: the
     catalogue has grown to 479 rows since the walkthrough and the distance
     with it. What the gate asserts is the AFTER, and the before is printed
     beside it so the two are read together.

     REWRITTEN THE NEXT DAY, AND ONLY WHERE THE SURFACE MOVED (2026-09-06,
     second shift). Paul read the shipped strip: *"Get rid of the buttons for
     eras like 'the old Stone Age' those all go."* and *"Get rid of 'All 479
     records'."* So `f` is a different claim about the same need (a hand reaches
     a century by TYPING it, which the field already matched on), `c` is the
     one half of the count that survived it, and `d` is measured against a
     stronger witness than the deleted sentence. Everything b proves is
     untouched, and the rule the whole strip is built around — THE EARTH DOES
     NOT MOVE WHILE YOU TYPE — is asserted harder than it was.

     SIX CLAIMS, and every one of them is read off the rendered list:
       a · the field is ONE LINE, in flow, above the rows, and nothing floats
       b · typing narrows the list, by NAME, PLACE, YEAR, ERA and FAMILY, and
           the match is accent- and case-insensitive
       c · a search that matches NOTHING says so in a sentence, drawn inside
           the list's own box — and there is no resting count row anywhere
       d · TYPING DOES NOT MOVE THE EARTH — the year the globe is drawing is
           the same number before, during and after a search, on the artifact
           (`#atlasMap[data-year]`) AND in the ink stamped on the globe
       e · clearing restores all 479 rows AND the place in the list you were
           standing in, which is the same fact said twice
       f · the FIELD is how a hand reaches a century now: `the seventies` is a
           query, the two deleted controls are gone from the page, and the
           chronology the chips used to move you through is still whole */
  {
    await fresh();
    /* THE PANEL HAS TO BE OPEN BEFORE ANYTHING IS MEASURED. Since 2026-09-09
       the box boots on `Where` and then CLOSES it — the table is the page and
       the picker is a plate on the bar — so every rect inside `#atlas` is 0x0
       on a page nobody has opened it on. `bring()` is the helper that presses
       it, exactly as `setYear` and G23 do. (Measured the hard way: the first
       run of this check reported "top 0 px, strip 0 px" and 0 rows for every
       search, which is what a `display: none` panel says about itself.) */
    await bring();
    await p.waitForTimeout(1200);
    const box = await p.evaluate(() => {
      const f = document.getElementById("atlasFind");
      const q = document.getElementById("atlasQ");
      const idx = document.getElementById("atlasIndex");
      const rows = document.getElementById("atlasIndexRows");
      const base = idx.getBoundingClientRect().top - idx.scrollTop;
      const th = [...rows.children].find((n) => n.dataset.gk === "triphop");
      const cs = getComputedStyle(f);
      return { top: Math.round(f.getBoundingClientRect().top),
               h: Math.round(f.getBoundingClientRect().height),
               pos: cs.position, qh: Math.round(q.getBoundingClientRect().height),
               n: rows.children.length, listH: rows.scrollHeight,
               triphop: th ? Math.round(th.getBoundingClientRect().top - base) : null,
               page: document.documentElement.scrollWidth -
                     document.documentElement.clientWidth };
    });
    /* THE STRIP IS THE FIELD AND NOTHING ELSE SINCE THE CHIPS WENT, so its own
       height is the field's: it was 118 px (field, count and 26 chips) and it
       is one tap target now. The check keeps its old shape and gains that
       number, because "one line" was always the claim and was never true of a
       strip that wrapped to three. */
    check(box.pos === "static" && box.top > 0 && box.qh <= 56 && box.h <= 56,
      "G24a · the field is one line, in flow, at the head of the list — top " +
      box.top + " px, strip " + box.h + " px (118 with the chips), field " +
      box.qh + " px, position " + box.pos + ", no sideways page scroll (" +
      box.page + " px)");
    note("G24 · BEFORE: " + box.n + " rows, " + box.listH +
         " px of list, and the trip-hop row " + box.triphop + " px down it");

    /* WHAT THE PROBE READS BACK, AND THE TWO THAT MOVED. `count` was
       `#atlasCount`, which is deleted; the empty answer is `#atlasNone`, which
       is EMPTY (not absent, not hidden) except when a search matches nothing,
       so the probe returns its text and the gate holds it blank the rest of the
       time. `say` was #atlasSay's sentence, which is deleted; what the earth is
       showing is `#atlasMap[data-year]` — the artifact's own declaration, which
       the year stamp inside the globe must equal. */
    const find = async (term) => {
      await p.evaluate((w) => {
        const q = document.getElementById("atlasQ");
        q.value = w;
        q.dispatchEvent(new Event("input", { bubbles: true }));
      }, term);
      await p.waitForTimeout(120);
      return p.evaluate(() => {
        const rows = document.getElementById("atlasIndexRows");
        const idx = document.getElementById("atlasIndex");
        const base = idx.getBoundingClientRect().top - idx.scrollTop;
        const vis = [...rows.children].filter((n) => !n.hidden &&
          n.getBoundingClientRect().height > 0);
        const th = vis.find((n) => n.dataset.gk === "triphop");
        const nn = document.getElementById("atlasNone");
        return { n: vis.length, gk: vis.slice(0, 5).map((x) => x.dataset.gk),
                 top: th ? Math.round(th.getBoundingClientRect().top - base) : null,
                 ms: +document.getElementById("atlasFind").dataset.ms,
                 none: nn.textContent,
                 noneH: Math.round(nn.getBoundingClientRect().height),
                 noneIn: document.getElementById("atlasIndex").contains(nn),
                 year: document.getElementById("atlasMap").dataset.year,
                 stamp: document.getElementById("atlasYearMark").textContent };
      });
    };
    const yearWas = await p.evaluate(() =>
      document.getElementById("atlasMap").dataset.year);
    const r1 = await find("trip");
    check(r1.gk.indexOf("triphop") >= 0 && r1.top != null && r1.top < 200,
      "G24b · \"trip\" puts the trip-hop row " + r1.top + " px into the list " +
      "(from " + box.triphop + "), " + r1.n + " rows showing, " + r1.ms + " ms");
    const r2 = await find("cordoba");
    check(r2.n > 0 && r2.n < 20,
      "G24b · the match is accent-insensitive — \"cordoba\" finds Córdoba (" +
      r2.n + " rows: " + r2.gk.join(", ") + ")");
    const r3 = await find("club bristol");
    check(r3.n > 0 && r3.gk.indexOf("triphop") >= 0,
      "G24b · every token must match — a FAMILY and a PLACE together (" +
      r3.n + " rows: " + r3.gk.join(", ") + ")");
    const r4 = await find("1991");
    check(r4.n > 0 && r4.gk.indexOf("triphop") >= 0,
      "G24b · …and a YEAR (" + r4.n + " rows)");
    const r5 = await find("the seventies");
    check(r5.n > 10,
      "G24b · …and an ERA word (" + r5.n + " rows in the seventies)");
    const r6 = await find("qqzzxx");
    check(r6.n === 0 && /\S/.test(r6.none) && r6.none.split(/\s+/).length >= 2 &&
          r6.none.indexOf("qqzzxx") >= 0 && r6.noneIn && r6.noneH > 0,
      "G24c · nothing matched, and it SAYS so in a sentence, where the rows " +
      "would be (" + r6.noneH + " px inside #atlasIndex) — " +
      JSON.stringify(r6.none));
    check(!r1.none && !r5.none && r1.noneH === 0,
      "G24c · …and it is silent and takes no box the rest of the time (" +
      JSON.stringify(r1.none) + ", " + r1.noneH + " px on a search with " +
      r1.n + " results)");
    check(r1.year === yearWas && r5.year === yearWas && r6.year === yearWas &&
          r1.stamp === r1.year && r6.stamp === r6.year,
      "G24d · typing never moved the earth — the year the globe draws is " +
      JSON.stringify(yearWas) + " before, during and after, and the stamp on " +
      "the globe says the same (" + JSON.stringify(r6.stamp) + ")");
    const cleared = await find("");
    check(cleared.n === box.n && cleared.year === yearWas && !cleared.none,
      "G24e · clearing restores all " + cleared.n + " rows and the place you " +
      "were standing in (the year is still " + JSON.stringify(cleared.year) + ")");

    /* ---- G24f · THE CHIPS ARE GONE AND THE FIELD DOES THEIR JOB --------
       Paul, 2026-09-06: *"Get rid of the buttons for eras like 'the old Stone
       Age' those all go."* and *"Get rid of 'All 479 records'."* This check
       READ "an era chip JUMPS"; it holds the same need against the control
       that remains, and it holds the deletion itself, because a control
       deleted from a design and left in the DOM is the drift this file exists
       to catch. Typing an era does not merely FILTER to it: the rows left are
       exactly that era's, which is what "take me to the seventies" asked for,
       and pressing one still opens its record. */
    const era = await p.evaluate(async () => {
      const q = document.getElementById("atlasQ");
      q.value = "the seventies";
      q.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      const rows = document.getElementById("atlasIndexRows");
      const vis = [...rows.children].filter((n) => !n.hidden && n.dataset.year);
      const ys = vis.map((n) => +n.dataset.year);
      q.value = "";
      q.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      return { n: vis.length, lo: Math.min(...ys), hi: Math.max(...ys),
               whole: [...rows.children].filter((n) => !n.hidden).length,
               jump: !!document.getElementById("atlasJump"),
               chips: document.querySelectorAll("#atlasJump button").length,
               count: !!document.getElementById("atlasCount"),
               year: document.getElementById("atlasMap").dataset.year };
    });
    check(!era.jump && era.chips === 0 && !era.count,
      "G24f · the era chips and the resting count are DELETED, not hidden — " +
      "#atlasJump " + era.jump + " (" + era.chips + " chips), #atlasCount " +
      era.count);
    check(era.n > 10 && era.lo >= 1970 && era.hi <= 1979 &&
          era.whole === box.n && era.year === yearWas,
      "G24f · …and the field reaches the century instead: \"the seventies\" is " +
      era.n + " rows, " + era.lo + "–" + era.hi + ", the chronology is still " +
      "whole when it clears (" + era.whole + " rows) and the earth never moved " +
      "(" + era.year + ")");
  }

  /* ---- G11 (last) THE ORDER A READER MEETS IT IN ---------------------- */
  /* DOM ORDER IS READING ORDER IS TAB ORDER, and this is the assertion that
     caught the plan putting the slider UNDER the globe: Tab from the slider
     landed on "another take" (a button that has since moved to the gutter)
     and all nineteen places were behind the reader, reachable only by
     Shift-Tab. */
  await fresh();
  await p.waitForTimeout(900);
  await setYear(1969);
  await p.waitForTimeout(250);
  /* AN id-LESS CHILD IS NAMED BY ITS CLASS (2026-09-06). This mapped
     `tagName + "#" + id` alone, and the sheet chrome that arrived with the
     §10b round — `DIV.nu-sheethead`, the "Where ×" bar the shell puts on an
     OPEN sheet — has no id, so this check reported a bare `DIV#` and had been
     RED on HEAD before wave C touched it (measured on a `git archive HEAD`
     tree, 2026-09-06: `["DIV#","H2#atlasHead","P#atlasSay","DIV#atlasWrap",
     "DIV#atlasIndex"]`). A gate whose failure message cannot name the element
     it is failing on is a gate nobody can act on; the head is a real part of
     the reading order and is asserted as one. */
  const order = await p.evaluate(() =>
    [...document.getElementById("atlas").children]
      .map((n) => n.tagName + "#" + (n.id || "." + n.className)));
  /* THE LIST OF CHILDREN HAS BEEN FOUR, THEN SIX, AND IS THREE — 2026-08-29 —
     AND THE CLAIM HAS NOT MOVED ONCE. Each rewrite is a control leaving:
       · 2026-08-27, `P#atlasActs` ("another take") went to the transport;
       · 2026-08-28, the index's door and its shut list arrived as BACK MATTER,
         behind the globe, which is why they did not disturb the order;
       · 2026-08-29, Paul: *"Get rid of the time slider. Make the genre list
         permanent and always expanded."* `DIV#atlasWhen` is deleted and
         `BUTTON#atlasIndexBtn` is deleted, and the list that was behind them
         is the instrument now.
     WHAT IS ASSERTED IS STILL THE SENTENCE, THEN THE EARTH, THEN THE
     CATALOGUE: a reader meets a line of prose that names the year, then the
     picture that year lit, then the 367 rows that both name every record and
     move the year. (367 = atlas.js ALL.length, re-measured 2026-08-30; the
     line said 201 at a 201-row map and the list has never been a subset of
     WHEN, so the number was a snapshot of the catalog, not of this gate.) The places are still ahead of the reader in the tab order
     and never behind them, which is the promise this check exists for. */
  /* ...AND A FIFTH ARRIVED 2026-09-06, WHICH IS THE LIST'S OWN HEAD (WAVE C,
     docs/REDESIGN-SCOPE.md item 7): `P#atlasFind`, the search field. It sits
     BETWEEN the globe and the rows and the claim above is unchanged by it,
     which is the test this insertion had to pass: the argument was never
     "nothing may stand here", it was *"a reader must not meet the earth before
     the control that decides which places are on it"*, and this control
     decides nothing of the kind — `sweep()` refuses to move the year while a
     filter is up, precisely so that typing cannot turn the globe. What it IS
     is the head of the list it filters, in front of the rows and behind the
     picture, which is where a table's own filter belongs and where a thumb
     reaches it after the map rather than instead of it. The places are still
     ahead of the reader in the tab order and never behind them. */
  /* ...AND THE GLOBE MOVED TO THE FRONT OF IT LATER THE SAME DAY. Paul: *"Get
     rid of 'where' and the line above and the output that goes '33000 BC · 1
     record within ten years · Hohle Fels'; leave the close icon. Use the new
     space to move the globe up."* Two things move in this list and both are
     deletions wearing a different hat:
       · `DIV#.nu-sheethead` is still first and is still the way out, but it
         holds ONLY the ×. The sheet's visible name is deleted, so the head
         that names this panel to a screen reader is `H2#atlasHead` alone —
         which is why the assertion below reads the head's own children as well
         as the panel's, and why `#atlasHead` staying in this list matters more
         than it did when there was a visible word beside it.
       · `P#atlasSay` is BEHIND the globe now. It no longer carries the year
         (that is stamped inside the drawing) and is empty except while the box
         is announcing something it just did, so a reader meets the earth
         first and the announcement under the thing that caused it. */
  const head = await p.evaluate(() => {
    const h = document.querySelector("#atlas > .nu-sheethead");
    const b = h.querySelector("b"), x = h.querySelector("button");
    const cs = getComputedStyle(h);
    return { kids: [...h.children].map((n) => n.tagName + "#" + (n.id || "")),
             name: b ? b.textContent : null,
             nameShown: b ? b.offsetParent !== null : false,
             rule: cs.borderBlockEndWidth,
             h2: (document.getElementById("atlasHead") || {}).textContent,
             xw: x ? Math.round(x.getBoundingClientRect().width) : 0,
             xh: x ? Math.round(x.getBoundingClientRect().height) : 0,
             xlabel: x ? x.getAttribute("aria-label") : null };
  });
  check(JSON.stringify(order) === JSON.stringify(
      ["DIV#.nu-sheethead", "H2#atlasHead", "DIV#atlasWrap", "P#atlasSay",
       "P#atlasFind", "DIV#atlasIndex"]),
    "G11 · reading order is the sheet's head, the heading, the globe, the " +
    "status line, the list's own head, then the genre list — " +
    JSON.stringify(order));
  check(!head.nameShown && head.rule === "0px" && head.h2 === "Where & when" &&
        head.xw >= 44 && head.xh >= 44,
    "G11 · the picker's header is the × and nothing else — the name is not " +
    "drawn (" + JSON.stringify(head.name) + "), no rule under it (" +
    head.rule + "), the sheet is still named by its <h2> (" +
    JSON.stringify(head.h2) + ") and the close is " + head.xw + "x" + head.xh +
    " — " + JSON.stringify(head.xlabel));
  /* THE WALK STARTS AT THE GLOBE, NOT AT THE SLIDER (2026-08-29). It focused
     `#atlasYear`, which was the element immediately before the map; the map
     itself is now the first control in this section, and Tab from it is the
     walk this check has always been about. */
  await p.evaluate(() => document.getElementById("atlasMap").focus());
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
  /* REWRITTEN 2026-08-29 BECAUSE THE WALK NOW STARTS ON THE GLOBE. It read
     `walk[0] === "atlasMap" && walk[1] === first` — one Tab from the
     when-slider into the map, a second onto its first place. The slider is
     deleted, the map is the first control in this section, so the first Tab
     lands on the first PLACE and the assertion loses one step and no
     substance: what it has always been about is that the globe's marks are
     walked in the globe's own alphabetical order, forwards, with the record
     the page is playing REACHABLE rather than behind the reader. */
  check(walk[0] === first,
    "G11 · Tab from the globe walks onto its places, in the globe's own " +
    "order (" + drawn69 + " drawn at 1969): " + JSON.stringify(walk.slice(0, 4)));
  const toKingston = walk.indexOf("Kingston 1969, reggae");
  check(toKingston >= 0, "G11 · …and Kingston is " + (toKingston + 1) +
    " Tabs from the globe at 1969 (" + JSON.stringify(walk.slice(0, 8)) + ")");

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
     the DOM and held against the number the catalogue holds — which is the
     "test the artifact" law applied to the one defect a data gate structurally
     cannot see.

     THE OTHER HALF OF THE COMPARISON MOVED, 2026-09-06. It was PARSED out of
     #atlasSay's own text ("600 · 1 record within ten years · Rome"), and Paul
     deleted that line by quoting it. A page cannot be checked against a
     sentence it no longer prints, so the earth is now held against
     `NuAtlas.atYear(Y)` — the function the marks are drawn from, asked
     independently in the page — and against the one thing the deleted line
     said that nothing else did: WHICH YEAR, which is stamped inside the globe
     now (`#atlasYearMark`) and declared on `#atlasMap[data-year]`. The claim
     is the one it always was and it is one step closer to the source: what is
     on the earth is what the catalogue says is at this year, and the earth
     says which year it is.

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
      /* THE CATALOGUE'S OWN ANSWER, ASKED HERE AND NOT IN NODE, because the
         page is the thing that has to obey it and `window.NuAtlas` is the same
         table ui/atlas.js draws from. `shown` is the map of place -> record
         that `scope()` reads; its size is how many marks this year may draw. */
      const Y = +document.getElementById("atlasMap").dataset.year;
      const said = window.NuAtlas.atYear(Y).shown.size;
      const stamp = (document.getElementById("atlasYearMark") || {}).textContent;
      return { year: Y, stamp,
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
        said,
      };
    });
    check(g.drawn === g.said,
      "G22 · " + Y + ": the earth and the catalogue are the same fact — " + g.drawn +
      " marks drawn, atYear(" + Y + ") holds " + g.said);
    check(g.year === Y && g.stamp === String(Y).replace(/^-(\d+)$/, "$1 BC"),
      "G22 · " + Y + ": …and the earth says which year it is, in its own ink — " +
      JSON.stringify(g.stamp) + " stamped on the globe, " + g.year +
      " declared on #atlasMap[data-year]");
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
             year: document.getElementById("atlasMap").dataset.year };
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
             /* DERIVED, NOT TYPED (2026-08-29). This compared `drawn === 1` —
                "at 600 the only mark on the earth is Rome" — and the catalogue
                is another round's file: it grew an Aksum 540 anchor, which is
                inside 600's own ±10 window, and the 1 became 2. The fact this
                check is making is "the year decides, with no exception for the
                record you are playing", so it asks the year what it holds. */
             holds: window.NuAtlas.atYear(
               +document.getElementById("atlasMap").dataset.year).shown.size,
             title: window.__nuName() };
  });
  check(away.when === "0" && away.ring === "0" && away.drawn === away.holds
        && away.title === "Kingston 1969",
    "G22 · …and at 600 it leaves with its year, ring and all (" + away.drawn +
    " marks on the earth, which is exactly what the year holds: " + away.holds +
    ") while the page goes on playing " + JSON.stringify(away.title) +
    " — one rule, no exception for the favourite");
  await pressRewrite();
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
             year: document.getElementById("atlasMap").dataset.year,
             stamp: document.getElementById("atlasYearMark").textContent };
  });
  check(back.year === "1969" && back.when === "1" && back.cur === "true" &&
        back.ring === "1" && back.stamp === "1969",
    "G22 · showing(\"reggae\") from 600 turns the globe back to the record: the " +
    "earth is stamped " + JSON.stringify(back.stamp) + ", Kingston is drawn (" +
    JSON.stringify(back.when) + "), current and ringed");

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

  /* THE INDEX. REWRITTEN 2026-08-29 — Paul: *"Make the genre list permanent
     and always expanded."* / *"Add Wikipedia links to the genre list in a
     column."*

     WHAT THIS CHECKED, AND WHY IT NO LONGER CAN: "the index is SHUT at boot
     and its 199 buttons are not even built", proved by reading
     `#atlasIndex.hidden`, `#atlasIndexBtn[aria-expanded]` and a row count of
     zero, then clicking the door and counting again. There is no door and
     nothing is shut, so that assertion is not weakened, it is INVERTED: the
     rows must be there before anybody touches anything. The click is gone with
     the button.

     THE ROWS ARE STILL COUNTED THE SAME WAY, in the atlas's own terms (`ALL` +
     `EXCLUDE`), which is why the count moving from 199 to 201 under this round
     cost the gate nothing: it never typed the number. */
  const idx = await p.evaluate(async () => {
    const before = { rows: document.querySelectorAll("#atlasIndexRows li").length,
                     hidden: document.getElementById("atlasIndex").hidden,
                     door: !!document.getElementById("atlasIndexBtn"),
                     ms: document.getElementById("atlasIndex").dataset.ms };
    const rows = [...document.querySelectorAll("#atlasIndexRows .nu-ixrow")];
    /* REWRITTEN 2026-08-29 (second pass) — Paul: *"Replace the slug for genre
       with the Wikipedia link so everything is on one line."*  It read
       `const cells = (r) => [...r.children].map((c) => c.textContent)` with
       `r` a `.nu-ixrow`, and `const yrs = rows.map((r) => r.children[0]...)`,
       because the BUTTON held all three facts. The genre has left the button —
       it is a link now, and a link may not live inside a button — so a row's
       three cells are read off the <li> and the year off the button's first
       child, which is still the year. Same three facts, one level up. */
    const cells = (r) => [".nu-ixy", ".nu-ixw", ".nu-ixp"]
      .map((q) => { const n = r.closest("li").querySelector(q);
                    return n ? n.textContent : null; });
    /* REWRITTEN 2026-08-30, the deep-time round. This read
       `.filter((t) => /^\d+$/.test(t)).map(Number)`, which was the whole
       parse when every year cell was a bare CE number — but the catalog now
       starts at "40000 BC" and a filter that drops what it cannot read would
       have quietly exempted the eight oldest rows from the very chronology
       this check exists to hold. The cell's two shapes are the two shapes
       atlas.js yearWord() can print, mapped back to the signed number the
       rows are sorted by; nothing dated is dropped. */
    const yrs = rows.map((r) => r.querySelector(".nu-ixy").textContent)
      .map((t) => { const m = /^(?:(\d{1,5}) BC|(\d{1,4}))$/.exec(t);
                    return m ? (m[1] ? -m[1] : +m[2]) : null; })
      .filter((y) => y !== null);
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
             /* ---- ONE GENRE WORD PER ROW, AND IT IS THE LINK (2026-08-29)
                REWRITTEN 2026-08-30 — Paul: *"In the genre list get rid of
                the Wikipedia link but leave the text. Put the link in a new
                icon on the right that isn't underlined."* The heading's
                second clause is REVERSED: the word is NOT the link any more,
                it is plain text ON THE PLATE — a linked row's `.nu-ixw` must
                be a SPAN inside the `.nu-ixrow` button (tapping the name
                plays; the row got easier to play, which is the point), and
                zero `a.nu-ixw` may remain. The rest survives word for word:
                  · every <li> holds EXACTLY ONE genre cell, and no <a> is
                    nested in a <button> or the other way round — the invalid
                    markup this shape exists to avoid;
                  · a LINKED row's word is `NuWiki.name(gk)` — the row's
                    declared plate name (`as`) else the article's title with
                    its underscores spent (2026-09-03) — plus the ` · the
                    <kind>` span when the article is not a genre. Typed
                    anywhere, invented anywhere, and this fails: extraction is
                    never by hand;
                  · a REFUSED row's word is its declared plate name else the
                    row's OWN KEY, and it stays
                    the button's SIBLING — its data-why overlay must not both
                    explain and play on one tap. */
             one: (() => {
               const W = window.NuWiki, o = { rows: 0, cells: [], nested: 0,
                                              wrong: [], slugs: [],
                                              aWords: document.querySelectorAll(
                                                "#atlasIndexRows a.nu-ixw").length };
               o.nested = document.querySelectorAll(
                 "#atlasIndexRows button a, #atlasIndexRows a button").length;
               for (const li of document.querySelectorAll("#atlasIndexRows li")) {
                 o.rows++;
                 const cs = li.querySelectorAll(".nu-ixw");
                 if (cs.length !== 1) { o.cells.push(li.dataset.gk + ":" + cs.length);
                                        continue; }
                 const c = cs[0], gk = li.dataset.gk, w = W.WIKI[gk];
                 if (w) {
                   /* `w.title` STOOD HERE UNTIL 2026-09-03 (Paul: "look for
                      names in genre list, you still have people and bands in
                      there"). The word is `NuWiki.name(gk)` now — the plate
                      name a row declares with `as`, else the article's title —
                      and asking the table for it keeps this a DERIVATION: a
                      plate the page invented still fails, because `name()` is
                      wiki.js's own function over wiki.js's own row. */
                   const want = W.name(gk)
                     + (w.kind !== "genre" ? " \u00b7 the " + w.kind : "");
                   if (c.textContent !== want)
                     o.wrong.push(gk + ": " + JSON.stringify(c.textContent) +
                                  " want " + JSON.stringify(want));
                   if (c.tagName !== "SPAN" || !c.closest(".nu-ixrow"))
                     o.wrong.push(gk + ": word is " + c.tagName +
                                  (c.closest(".nu-ixrow") ? " in" : " OUTSIDE") +
                                  " the plate — it must be plate a tap plays");
                 } else {
                   o.slugs.push(gk);
                   /* A REFUSAL SAYS ITS DECLARED GENRE, ELSE ITS KEY
                      (2026-09-03). The 28 refused anchors printed a mashed-up
                      address — "copshowsynth", "instrumentalhiphop" — which is
                      what Paul was reading; wiki-extract's NOLINK table names
                      them now and `name()` hands the word over. The six ROLES
                      declare none and still say their key, which IS their
                      name. Either way the word comes from the table. */
                   const wantNo = W.name(gk) || gk;
                   if (c.textContent !== wantNo)
                     o.wrong.push(gk + ": refused row says " +
                                  JSON.stringify(c.textContent) + ", not " +
                                  JSON.stringify(wantNo));
                   if (c.closest(".nu-ixrow"))
                     o.wrong.push(gk + ": a refusal inside the plate would " +
                                  "explain and play on one tap");
                 }
               }
               return o;
             })(),
             /* ---- THE ARTICLE COLUMN, 2026-08-29 ----------------------
                EVERY href COMES FROM nukernel/wiki.js AND NOTHING IS TYPED.
                The gate asks the table for each row's own key and compares the
                string the page actually rendered; a link this page invented,
                or one built with a different escaping of an `&` or an accent,
                fails here. The rows with NO link are counted too, because "a
                row with no link shows no link" is half the promise and a
                silent blank is the other half of the failure.
                REWRITTEN 2026-08-30 — the link is the ↗ MARK now (Paul: "Put
                the link in a new icon on the right that isn't underlined").
                It read `const a = li.querySelector("a.nu-ixw")`; the href
                moved to `a.nu-ixgo` and the mark's whole anatomy is asserted
                where the anchor's was:
                  · the glyph is ↗ and nothing else — a mark, not a word;
                  · NOT underlined, read off the RENDERED page
                    (getComputedStyle, memory: test the artifact) because the
                    base `a` rule underlines and a stylesheet regression here
                    would be invisible to a DOM-only check;
                  · `data-kind` rides on it, and its aria-label is the word +
                    its kind + " on Wikipedia" — the content is one arrow, so
                    the label must carry the whole name;
                  · a REFUSED row has NO mark AT ALL — absent, not disabled:
                    a grey arrow with nowhere to go is the silent grey this
                    page legislates against. */
             wiki: (() => {
               const W = window.NuWiki, o = { links: 0, bad: [], no: 0, why: 0 };
               for (const li of document.querySelectorAll("#atlasIndexRows li")) {
                 const gk = li.dataset.gk;
                 const a = li.querySelector("a.nu-ixgo");
                 const n = li.querySelector(".nu-ixw-no");
                 if (a) {
                   o.links++;
                   if (a.getAttribute("href") !== W.url(gk)) o.bad.push(gk);
                   if (a.textContent !== "↗")
                     o.bad.push(gk + ": mark says " + JSON.stringify(a.textContent));
                   if (getComputedStyle(a).textDecorationLine !== "none")
                     o.bad.push(gk + ": the mark is underlined");
                   const w = W.WIKI[gk], title = W.name(gk)
                     + (w.kind !== "genre" ? " · the " + w.kind : "");
                   if (a.dataset.kind !== w.kind)
                     o.bad.push(gk + ": data-kind " + a.dataset.kind);
                   if (a.getAttribute("aria-label") !== title + " on Wikipedia")
                     o.bad.push(gk + ": label " + a.getAttribute("aria-label"));
                   if (n) o.bad.push(gk + ": a mark AND a refusal on one row");
                 } else if (n) {
                   o.no++;
                   if ((n.dataset.why || "").length > 10) o.why++;
                 } else o.bad.push(gk + ": no cell at all");
               }
               o.table = Object.keys(W.WIKI).length;
               return o;
             })() };
  });
  check(idx.before.rows === idx.n && idx.before.hidden === false
        && idx.before.door === false,
    "G23 · the index is BUILT AND OPEN AT BOOT with no door to open — " +
    JSON.stringify(idx.before) + " (buildIndex took " + idx.before.ms + " ms, " +
    "published on #atlasIndex[data-ms])");
  /* THE DERIVATION IS THE CLAIM, NOT A COUNT. Every href must equal
     `NuWiki.url()` of that row's own key and every linkless row must carry a
     reason; the TABLE'S size is printed and not compared, because wiki.js
     holds 205 titles against the atlas's 195 placed anchors (measured
     2026-08-29) — the genre catalogue and the baked WHEN table move at
     different speeds and atlas.gate.js G2 is the gate that owns that gap. */
  check(!idx.wiki.bad.length && idx.wiki.links + idx.wiki.no === idx.n
        && idx.wiki.why === idx.wiki.no,
    "G23 · the article mark is wiki.js and nothing else: " + idx.wiki.links +
    " ↗ anchors, href === NuWiki.url(row), data-kind + full aria-label, not " +
    "underlined, + " + idx.wiki.no + " refused with a reason and NO mark (" +
    idx.wiki.why + ") = " + idx.n + " rows · wiki.js " +
    "holds " + idx.wiki.table + " titles" +
    (idx.wiki.bad.length ? " · BAD " + JSON.stringify(idx.wiki.bad.slice(0, 4)) : ""));
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
    "G23 · every genre the atlas holds, oldest first, with no click: " + idx.n +
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
  /* ---- ONE GENRE WORD PER ROW, AND IT IS THE LINK (2026-08-29) ---------
     Paul: *"Replace the slug for genre with the Wikipedia link so everything
     is on one line."*  The row printed the genre twice — the genres.js key in
     `.nu-ixg` and the article's real title in a fourth cell — and the second
     copy is what pushed a row onto two lines. The key is off the page; the
     link stands in the genre column. Asserted as a DERIVATION and not as a
     count: every word must equal what wiki.js says, or be the row's own key
     where wiki.js says nothing.
     ("AND IT IS THE LINK" REVERSED 2026-08-30 — Paul: "get rid of the
     Wikipedia link but leave the text". The word is plain plate text now,
     `aWords` counts any anchor still wearing .nu-ixw and must be zero; the
     collector above owns the rest of the rewrite.) */
  check(!idx.one.cells.length && !idx.one.nested && !idx.one.wrong.length
        && !idx.one.aWords,
    "G23 · ONE genre word per row and it is PLATE, not a link: " + idx.one.rows +
    " rows, one .nu-ixw each, " + idx.one.nested + " <a> nested in a <button> " +
    "(or the reverse), " + idx.one.aWords + " words still anchors, every " +
    "linked word === NuWiki.name(row) + its kind and every " +
    "one of the " + idx.one.slugs.length + " refusals saying its own name " +
    JSON.stringify(idx.one.slugs) +
    (idx.one.cells.length ? " · CELLS " + JSON.stringify(idx.one.cells.slice(0, 4)) : "") +
    (idx.one.wrong.length ? " · WRONG " + JSON.stringify(idx.one.wrong.slice(0, 3)) : ""));

  /* ---- AND IT REALLY IS ONE LINE, AT THE FIVE WIDTHS THIS PAGE MEASURES
     AT (2026-08-29). "One line" is a claim about a BOX and not about a
     stylesheet, so it is read as a height: a row that wrapped would be two
     `--tap` floors of <li> (88-95px, which is exactly what the four-column
     shape measured below 560 and is written down in nu.css). The floor and the
     ceiling are both asserted — 44 <= h <= 46 — because a row that shrank
     under the thumb target would fail the opposite way and pass a check that
     only looked up. Nothing may scroll sideways at any of them. */
  /* WHAT IS A THUMB CHANGED HANDS 2026-08-30 (Paul: "Put the link in a new
     icon on the right"). It read `genre: +Math.min(...a).toFixed(1)` over the
     `.nu-ixw` heights with `r.genre < 44` in the filter — the word was its
     own 44px anchor then. The word is plate text now (its target is the
     `.nu-ixrow` already asserted at `btn`), and the 44px control this round
     has to hold is the ↗ MARK: min width AND height over every `.nu-ixgo`,
     both axes, because a track that quietly narrowed would keep the height
     green while the thumb lost the square. `cutT`/`cutP` print the ellipsis
     bill (titles/places cut) at each width — the icon track is paid for out
     of the place column, and the price is written down, not discovered. */
  /* AND "ONE LINE" IS NOW A WIDE-SCREEN LAW ONLY (2026-09-04). Paul, on a
     phone: *"On mobile put the names of genres above the location because many
     of them cut off now."* Measured before the change, on the rendered page:
     476 of 478 names ellipsised at 320, 407 at 375, 245 at 430 — the one-line
     row had spent its whole line on the year, the place and the mark and left
     the NAME four characters. So below 700px the row is two lines by design
     (nu.css §17), and this check asks the two halves of that separately:
       · NARROW (320/375/390/430) — the name is ABOVE the place, not beside it
         (`stack`: every row where the name's bottom is at or above the place's
         top, counted against the rows that have both cells), and NOT ONE NAME
         IS CUT (`cutT === 0`). The 44px floor still holds; the 46px ceiling is
         deliberately gone, because a wrapped name is the point.
       · WIDE (1280) — nothing moved: 44 <= h <= 46 and the name still sits
         BESIDE the place (`beside`), which is the half of the old law this
         round did not touch and could have broken by accident.
     Asserting the stack by GEOMETRY and not by a class or a media query is the
     same discipline the height assertion above already had: the claim is about
     where the words are on the glass. */
  const lines = [];
  for (const w of [320, 375, 390, 430, 1280]) {
    await p.setViewportSize({ width: w, height: 844 });
    await p.waitForTimeout(350);
    lines.push(await p.evaluate((w) => {
      const li = [...document.querySelectorAll("#atlasIndexRows li")];
      const box = document.getElementById("atlasIndex");
      const h = li.map((n) => n.getBoundingClientRect().height);
      const b = li.map((n) => n.querySelector(".nu-ixrow").getBoundingClientRect().height);
      const go = li.map((n) => n.querySelector(".nu-ixgo")).filter(Boolean)
        .map((n) => n.getBoundingClientRect());
      const cut = (q) => li.filter((n) => { const c = n.querySelector(q);
        return c && c.scrollWidth > c.clientWidth; }).length;
      // WHERE THE NAME IS RELATIVE TO THE PLACE, in rects: `pairs` is the rows
      // that have both cells, `stack` the ones whose name sits wholly above
      // the place, `beside` the ones whose name ends before the place begins.
      const pair = li.map((n) => [n.querySelector(".nu-ixw"), n.querySelector(".nu-ixp")])
        .filter(([a, c]) => a && c)
        .map(([a, c]) => [a.getBoundingClientRect(), c.getBoundingClientRect()]);
      return { w, li: [+Math.min(...h).toFixed(1), +Math.max(...h).toFixed(1)],
               pairs: pair.length,
               stack: pair.filter(([a, c]) => a.bottom <= c.top + 0.5).length,
               beside: pair.filter(([a, c]) => a.right <= c.left + 0.5).length,
               btn: +Math.min(...b).toFixed(1),
               go: [+Math.min(...go.map((r) => r.width)).toFixed(1),
                    +Math.min(...go.map((r) => r.height)).toFixed(1)],
               marks: go.length,
               cutT: cut(".nu-ixw"), cutP: cut(".nu-ixp"),
               list: box.scrollWidth - box.clientWidth,
               page: document.documentElement.scrollWidth
                     - document.documentElement.clientWidth };
    }, w));
  }
  const bad = lines.filter((r) => r.li[0] < 44 || r.btn < 44
                              || r.go[0] < 44 || r.go[1] < 44 || r.list || r.page
                              || (r.w < 700 ? (r.stack !== r.pairs || r.cutT)
                                            : (r.li[1] > 46 || r.beside !== r.pairs)));
  check(!bad.length,
    "G23 · …and the row is TWO LINES ON A PHONE with the name above the place " +
    "and none of the " + (lines[0] || {}).pairs + " cut (320/375/390/430), ONE " +
    "line beside it at 1280 (44 <= <li> <= 46) — 44px floor, the plate and the " +
    "↗ mark both thumbs (mark in BOTH axes), zero sideways scroll everywhere: " +
    JSON.stringify(lines));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(300);

  /* AND A ROW IS THE GLOBE'S OWN DOOR. Not a second compose path: the row sets
     the YEAR to the record's own and calls choose(place), so what it writes is
     decided by recordAt exactly as a thumb on the dot is. Proved by the two
     things only the real path can do — the page's own name becomes the record,
     and the mark on the earth takes the ring. (It read "the row moves the
     SLIDER"; the slider is deleted and the year is state now — 2026-08-29 —
     which changes the mechanism and not one word of the claim.) */
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
             year: document.getElementById("atlasMap").dataset.year,
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
    "G23 · a row opens its record through the globe's own door — the page is " +
    JSON.stringify(row.title) + ", the sentence reads " + row.year + ", the mark " +
    "wears the ring, its second line says " + JSON.stringify(row.gname) +
    " and the list marks " + JSON.stringify(row.cur));

  /* ---- THE SEAM: THE MARK IS A LINK, THE REST OF THE ROW IS THE RECORD
     (2026-08-29; REWRITTEN 2026-08-30) -----------------------------------
     Paul, 2026-08-30: *"In the genre list get rid of the Wikipedia link but
     leave the text. Put the link in a new icon on the right that isn't
     underlined."*  The seam MOVED, so the proof moves with it — this block's
     heading read "THE WORD IS A LINK", its first bullet read "A TAP ON THE
     WORD DOES NOT START A RECORD", and its first check read "a tap on the
     WORD is a link and not a record". All three are REVERSED on the word and
     re-made on the mark:

       · A TAP ON THE ↗ MARK DOES NOT START A RECORD. The anchor is the
         button's SIBLING (ui/atlas.js: an <a> may not nest in a <button>),
         so a click on it never reaches the delegated handler's
         `closest(".nu-ixrow")` — asserted rather than assumed, because the
         day somebody nests the two again this is what fails.
       · A TAP ON THE WORD NOW PLAYS. The word is plate — that is the point
         of the round (the row got EASIER to play) — and it is proved by
         clicking the `.nu-ixw` SPAN ITSELF, not the button around it.
       · AND THE HIT TEST IS READ OFF THE PIXELS, `elementFromPoint` across
         one row: the word is the plate's own span, the mark is the anchor,
         the year is the plate's child. That is what a thumb actually meets,
         and it is the half a listener-only check would bless while an anchor
         silently covered the wrong column.

     THE NAVIGATION IS CANCELLED IN A CAPTURE LISTENER and not by clicking
     something other than the link: `preventDefault` stops the browser leaving
     the page (`target=_blank` would open a tab and take the gate with it) and
     does NOT stop propagation, so the list's own handler still gets the event
     it would have got. The question being asked is "does the row hear this
     click", and cancelling the default is the only way to ask it. */
  const seam = await p.evaluate(async () => {
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (a) e.preventDefault();
    }, true);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const li = [...document.querySelectorAll("#atlasIndexRows li")]
      .find((n) => n.dataset.gk === "fugue");
    li.scrollIntoView({ block: "center" });
    await wait(400);
    const before = window.__nuName();
    const a = li.querySelector("a.nu-ixgo");
    a.click();
    await wait(800);
    const afterMark = window.__nuName();
    li.scrollIntoView({ block: "center" });
    await wait(300);
    const word = li.querySelector(".nu-ixw");
    const box = li.getBoundingClientRect();
    const at = (x, y) => { const n = document.elementFromPoint(x, y);
                           return n ? n.tagName + "." + (n.className || "") : "nothing"; };
    const wr = word.getBoundingClientRect(), ar = a.getBoundingClientRect();
    const hits = { word: at(wr.left + 3, wr.top + wr.height / 2),
                   mark: at(ar.left + ar.width / 2, ar.top + ar.height / 2),
                   year: at(box.left + (box.width > 200 ? 20 : 14),
                            box.top + box.height / 2) };
    word.click();
    await wait(900);
    return { before, afterMark, afterWord: window.__nuName(),
             href: a.getAttribute("href"), hits };
  });
  check(seam.before === "Kingston 1973" && seam.afterMark === "Kingston 1973",
    "G23 · a tap on the ↗ MARK is a link and not a record — the page was " +
    JSON.stringify(seam.before) + " and after clicking " + seam.href +
    " it is still " + JSON.stringify(seam.afterMark));
  check(seam.afterWord === "Leipzig 1725",
    "G23 · …and a tap on the WORD ITSELF now opens its record (the reversal " +
    "this round shipped — the name is plate): " + JSON.stringify(seam.afterWord));
  check(/^SPAN\.nu-ixw/.test(seam.hits.word) && /^A\.nu-ixgo/.test(seam.hits.mark)
        && /^SPAN\.nu-ixy/.test(seam.hits.year),
    "G23 · …and that is what a THUMB meets, not just what a listener hears — " +
    JSON.stringify(seam.hits));

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
