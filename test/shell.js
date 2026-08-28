#!/usr/bin/env node
// test/shell.js — THE SHELL GATE (PROGRAM.md §5, deliverable D8).
//
// TEST THE ARTIFACT. Three features have shipped broken in this repo while
// every check passed, so nothing here reads nu.css: every number below is
// measured off the RENDERED page in a real browser at four real phone widths,
// with a drummer added first so the kit grid — the widest thing this page can
// draw — actually exists.
//
// AND IT WALKS ALL NINE TABS (2026-08-27). The page stopped being one scroll
// the day Paul asked for tabs, and a gate that surveyed "the page" after load
// was surveying the Where tab and calling it the shell: measured before this
// change, the first run against the tabbed page reported `axes 0 · panes 0 ·
// grids 0` at all four widths and passed A2 through A5 by having nothing to
// look at. So every geometric assertion below is made ONCE PER TAB PER WIDTH,
// through the page's own `window.__eightTab` — the same call the button's
// listener makes — and every message says which tab it was measured on.
//
// Eight assertions, one per line of §5's shell row:
//   A1  documentElement.scrollWidth === clientWidth at 320/375/430/820.
//       THE PAGE NEVER SCROLLS SIDEWAYS. Measured 2026-08-24 before the sheet:
//       390 against 375, because two seventeen-column grids were 382px wide.
//   A2  no <button>, <select> or input[type=number] under 44px tall.
//       Measured before: 23 buttons at 21px, 11 selects at 19px.
//       (EXCEPT A STEP. nu.css's control vocabulary, kind 7: a step in a
//       sixteen-step grid gets WCAG 2.2's 24px dense-grid floor, "and not
//       `--tap`". On 2026-08-27 the kit step changed WIDGET — the checkbox
//       became a velocity button, `.nu-kc` — and fell out of A3's dense-grid
//       lane into this blanket rule, though its density did not change: it is
//       still one of sixteen at `--cell`. So `.nu-kc` is measured with the
//       steps in A3, at the step floor, on both axes — not skipped.)
//   A3  every checkbox and radio — and, since 2026-08-27, every `.nu-kc` step
//       button — has a 24px tap target on both axes (WCAG 2.2 AA Target Size
//       Minimum). Measured before: 98 of them at 13x13.
//   A4  every .nu-pane has scrollHeight - clientHeight <= 1. `overflow-x: auto`
//       silently computes `overflow-y` to `auto` as well, so a pane is a
//       TWO-axis scroller and a table one pixel too tall hides a row.
//   A5  NO TABLE OVERFLOWS ITS CONTAINER. A table wider than the column it
//       sits in scrolls inside a `.nu-pane`; a table that fits needs no pane
//       and must not have one. (WAS: "every <table> has a .nu-pane parent",
//       which was true of every table on the page until Paul, 2026-08-25:
//       *"Rotate the drum kits and motif editors to be vertical. They'll fit
//       on a phone screen that way."* Steps run DOWN now, so the motif grid is
//       292.8px and the widest kit in the catalog 272px — both inside the
//       296px column a 320px phone leaves — and ui/eight.js `stepGrid` draws
//       them with no pane at all. The old line would now demand a scroll
//       container around a table that cannot scroll, and that container was
//       not neutral: it is the one Paul reported as "when I scroll right to
//       edit motifs and tap something it snaps left even though I'm not done
//       editing". So A5 asserts the thing the pane was ever FOR.)
//   A5c no `.nu-pane` wraps a rotated step grid (`table.nu-grid`) — the exact
//       unnecessary scroll container named above, kept out by name.
//   A6  ONE STICKY BAND, AND THE NAVIGATION IS A FIXED GUTTER (rewritten
//       2026-08-28). This check has been rewritten twice and both rewrites
//       were forced by Paul moving the navigation, so both are kept.
//       IT FIRST READ: "at scrollY 600/1400/2400 the .nu-bar sits at 0 and
//       EXACTLY ONE .nu-ax > h2 sits in 0 < top < 120 — and it is the heading
//       of the axis the viewport is actually inside. Two bands, never three."
//       IT THEN READ (2026-08-27, the tabs): "at every scroll position this
//       page can reach, on every tab, `.nu-bar` sits at 0 and `#toptabs` sits
//       at exactly `--bar-h`."
//       Paul, 2026-08-28: *"Come up with a strategy for running the nav icons
//       for a given modality down the right of the interface … There should be
//       one vertical stripe max with an 'up' icon to get to the parent
//       level"*, and then *"Make it a fixed gutter"* / *"Dont let anything go
//       under it."* There is no second band left to pin: `#toptabs` is
//       `#nu-tray`, `position: fixed` down the right edge, and it does not
//       move with the scroll because it is not in the scroll.
//       SO THE CLAIM IS THE ONE THAT IS STILL TRUE AT EVERY PIXEL: over the
//       whole height of every tab, `.nu-bar` sits at 0 once it has pinned, the
//       stripe sits at viewport top 0 and never moves, and no `.nu-ax > h2` is
//       `position: sticky` anywhere — the half that proves the old bands went
//       rather than being drawn twice.
//   A6b THE STRIPE IS ONE COLUMN AND IT NEVER SCROLLS SIDEWAYS. (It read "the
//       tab row NEVER SCROLLS SIDEWAYS … `.nu-row` wraps." A column that
//       wrapped would be the second stripe Paul's "one vertical stripe max"
//       forbids, so the check now counts DISTINCT BUTTON LEFTS as well: one
//       column, `scrollWidth === clientWidth`, at every width.)
//   A6c the marked mark is the open thing, AT A LEVEL OF SIBLINGS: exactly one
//       `<mark>` in the stripe, and its button is the only one with
//       `aria-pressed="true"`. At the root level that is `__eightTabNow()`; at
//       a sub-level it is that level's own open item, which is what
//       `__eightTray().on` reports. AT A LEVEL OF ACTIONS — the open motif's
//       fourteen transforms, which the page declares with `acts` since
//       2026-08-28 — nothing is marked, because none of fourteen writes is
//       "open", and the HEAD is what says where you are: "up — out of psalm,
//       back to the motifs".
//   A6d NINE TABS, IN PAUL'S WORDS, IN PAUL'S ORDER — read off the rendered
//       buttons of the ROOT level and compared to the literal list he wrote.
//   A6i NOTHING GOES UNDER THE GUTTER, and it is a layout law rather than a
//       z-index (Paul: *"Dont let anything go under it"*). On every tab, the
//       right edge of every laid-out block is <= the gutter's left edge, and
//       the document's own scrollWidth is unchanged. Boxes are not descended
//       into past a clipper (an <svg> viewport, an `overflow: auto` pane):
//       their contents run past on purpose and are not painted there, so what
//       is asserted is that the CLIPPER is inside the gutter.
//   A6j EVERY LEVEL IS REACHABLE AND `↑` CLIMBS ONE AT A TIME. Walk root ->
//       band -> root, root -> motifops -> motif -> root, root -> score ->
//       root through the stripe's own buttons, pressing `↑` until there is no
//       `↑` left, and assert there is none at the root — it is ABSENT rather
//       than refused, and ui/eight.js `THE STRIPE` carries the argument.
//       (Three deep since 2026-08-28: the Motif tab lands you in the open
//       motif's transforms and the bank is one `↑` above them.)
//   A6e A TAB REMEMBERS ITS SCROLL. Scroll a tall tab, leave it, come back:
//       the window is where you left it, and a tab never opened starts at 0.
//   A7  the .nu-bar is exactly --bar-h tall. `.nu-tabs { top: var(--bar-h) }`
//       is a promise about a number, and a fifth control in the bar that
//       wrapped would open a gap under the tab row that nothing else would
//       catch. (It said `.nu-ax > h2 { top: var(--bar-h) }` — the creditor of
//       the promise moved on 2026-08-27; the promise did not.)
//   A8  every `.nu-pane` that ACTUALLY SCROLLS and declares its first column
//       sticky keeps that column pinned: after pane.scrollLeft = 200 it has
//       moved <= 2px. (WAS: scoped to `.nu-pane` holding a `table.nu-grid`,
//       i.e. the step grid's lane label. There is no such pane any more — see
//       A5 — so that reading skipped at all four widths and asserted nothing.
//       The claim is about a sticky column over a scroll, and the page still
//       makes one: measured 2026-08-25 at 320px the board's channel strip
//       overflows by 36px and its first cell holds to 0.5px. The chord chart
//       also scrolls at 320/375 and its first cell is `static` on purpose —
//       six identical bar columns, no lane label to hold — so this reads
//       declared stickiness rather than demanding it.)
//
// Run:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/shell.js
// A bare chromium.launch() resolves shell build 1200, which is not installed on
// this machine, so the executable path is explicit and checked before use.

const fs = require("fs");
const path = require("path");

const URL = process.env.SHELL_URL || "http://localhost:8777/nukernel/index.html";
const WIDTHS = [320, 375, 430, 820];
/* (`STICKY_AT = 375` stood here — "the sticky trace runs once, at phone
   width". The trace is a sweep now and it runs on EVERY tab at EVERY width,
   because a band that holds on one tab and slips on another is exactly the
   failure the tabs introduce and the old single sample could not see.) */
const HEIGHT = 667;
const SETTLE = 2500;            // abcjs engraves on a promise; the page grows late

const CANDIDATES = [
  "chromium-1234/chrome-linux64/chrome",
  "chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
  "chromium-1217/chrome-linux64/chrome",
];
function executable() {
  const root = path.join(process.env.HOME, ".cache/ms-playwright");
  for (const c of CANDIDATES) {
    const p = path.join(root, c);
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no installed chromium under " + root + " (tried " + CANDIDATES.join(", ") + ")");
}

let FAILS = 0, SKIPS = 0;
const ok   = (m) => console.log("  ok   " + m);
const fail = (m) => { FAILS++; console.log("  FAIL " + m); };
const skip = (m) => { SKIPS++; console.log("  skip " + m); };
const is   = (cond, m) => (cond ? ok(m) : fail(m));

/* ---------- what the page says about itself, all in one round trip ------- */
const SURVEY = () => {
  const de = document.documentElement;
  const rect = (e) => e.getBoundingClientRect();
  // THE TAP TARGET OF A CHECKBOX IS NOT ALWAYS THE CHECKBOX. sheets.js clips
  // its radios to 1px on purpose (PROGRAM.md §2.3: visually hidden but
  // focusable, never `display:none`) and the <label> around it is the thing a
  // thumb hits — the browser forwards the tap. So the target is the larger of
  // the control's own box and its labelling <label>, which is the honest
  // measurement of the gesture rather than of the widget.
  const target = (e) => {
    const r = rect(e), l = e.closest("label");
    const lr = l ? rect(l) : r;
    return { w: Math.max(r.width, lr.width), h: Math.max(r.height, lr.height) };
  };
  const name = (e) => e.tagName.toLowerCase()
    + (e.dataset && e.dataset.k ? "[" + e.dataset.k + "]" : e.id ? "#" + e.id : "")
    + (e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : "");
  /* ON THE PAGE, OR NOT MEASURED (2026-08-27, the tabs). Eight of the nine
     panels are `display: none` at any moment and a `display: none` control is
     0x0 — so the first run of this gate against the tabbed page reported
     seventy controls "under 44px" and seventy-four checkboxes "under 24px",
     every one of them a control in a shut tab that had been built earlier in
     the walk. That is not a finding, it is the gate measuring furniture in
     another room. `getClientRects().length` is the browser's own answer to "is
     this laid out", it costs nothing, and it is the same question every
     assertion in this file is really asking: what does a thumb meet on the
     page in front of it. A tab that is OPEN is measured in full; a tab that is
     shut is measured when it is opened, which is what the walk is for. */
  const shown = (e) => e.getClientRects().length > 0;
  const all = (sel) => [...document.querySelectorAll(sel)].filter(shown);

  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    linked: !!document.querySelector('link[rel="stylesheet"]'),
    sheets: document.styleSheets.length,
    bars: all(".nu-bar").length,
    axes: all(".nu-ax").length,
    panes: all(".nu-pane").length,
    grids: all(".nu-grid").length,
    barH: document.querySelector(".nu-bar")
      ? +rect(document.querySelector(".nu-bar")).height.toFixed(2) : null,
    barVar: getComputedStyle(de).getPropertyValue("--bar-h").trim(),
    // A2 — every button/select/number, EXCEPT the kit's step buttons: a
    // `.nu-kc` is kind 7 in nu.css's vocabulary (one of sixteen, dense-grid
    // floor), so it is measured with the steps below, not against --tap.
    shortControls: all("button, select, input[type=number]")
      .filter((e) => !e.classList.contains("nu-kc"))
      .map((e) => ({ n: name(e), h: +rect(e).height.toFixed(1) }))
      .filter((x) => x.h < 44),
    // A3 — the dense-grid steps: checkboxes, radios, and (2026-08-27, the
    // widget change) the kit's `.nu-kc` velocity buttons, 24px both axes.
    smallBoxes: all("input[type=checkbox], input[type=radio], button.nu-kc")
      .map((e) => { const t = target(e); return { n: name(e), w: +t.w.toFixed(1), h: +t.h.toFixed(1) }; })
      .filter((x) => x.w < 24 || x.h < 24),
    // A4
    clippedPanes: all(".nu-pane")
      .map((p, i) => ({ i, over: p.scrollHeight - p.clientHeight }))
      .filter((x) => x.over > 1),
    // A5 — a <table> that is WIDER THAN THE BOX IT IS IN and has nothing to
    // scroll it. Measured off the rendered page, not off the class list: a
    // table is fine either way round, in a `.nu-pane` that can carry it or
    // loose in a column it fits inside. The +1 is the sub-pixel slack every
    // other measurement in this file already allows.
    // (This replaces a class-list test — "parentElement is a .nu-pane" — which
    // could not tell a table that needs a scroller from one that does not.)
    spillingTables: all("table")
      .map((t) => ({ t, host: t.parentElement }))
      .filter(({ t, host }) => host && t.scrollWidth > host.clientWidth + 1 &&
        !host.classList.contains("nu-pane"))
      .map(({ t, host }) => name(t) + " " + t.scrollWidth + "px in " +
        host.clientWidth + "px (" + (t.rows[0] ? t.rows[0].cells.length : 0) + " cols)"),
    // A5c — the rotated step grids take no pane. ui/eight.js `stepGrid`:
    // "an `overflow-x: auto` box around a table that cannot overflow is a
    // scroll container that exists only to catch gestures. It caught them."
    panedGrids: all(".nu-pane table.nu-grid")
      .map((t) => name(t) + " (" + (t.rows[0] ? t.rows[0].cells.length : 0) + " cols)"),
    // A5b — a pane holding more than one table is a nested-scroll bug waiting
    crowdedPanes: all(".nu-pane")
      .map((p, i) => ({ i, n: p.querySelectorAll("table").length }))
      .filter((x) => x.n !== 1),
    nestedPanes: all(".nu-pane .nu-pane").length,
    // the two lines that would kill both stickies without saying anything
    overflowSins: ["body", "#app"].map((s) => {
      const e = document.querySelector(s);
      return e ? s + ":" + getComputedStyle(e).overflowX : s + ":absent";
    }).filter((s) => !/visible/.test(s)),
  };
};

/* ---------- the two bands, swept rather than sampled ----------------------
   WAS "the sticky trace": three literal scroll stops (600/1400/2400, offset
   from #app after the atlas landed above it) and, at each, "exactly one pinned
   `.nu-ax > h2`". nu.css's own note had to explain that the claim could only
   be true at the three positions this function sampled, because at every seam
   between two axes there was a 73-78px window where both headings were in the
   band. There are no seams now: one panel is on the page at a time (Paul,
   2026-08-27, the tabs) and its heading is neither sticky nor visible.

   So this sweeps instead of sampling, and asks the claim that IS true at every
   pixel: the transport at 0, the tab row at exactly --bar-h, all the way down
   whatever this tab happens to be, and nothing else sticky anywhere. Ten stops
   rather than three, spread across the tab's own height, so a tall tab is
   swept where it is tall and a short one is not asked about scroll it does not
   have. */
const BANDS = async () => {
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const barH = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue("--bar-h")) || 52;
  const row = document.getElementById("nu-tray");
  const bar = document.querySelector(".nu-bar");
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  /* WHERE THE BANDS PIN, AND IT IS NOT ZERO. `#title` is above the transport
     and always has been, so at scrollY 0 the bar sits wherever the record's
     name leaves it (measured: 110.1 at 320px on the shipped chant, 76.5 at
     375) and neither band is pinned yet. That is not a failure — it is what
     `position: sticky` means — and the old three-stop version never had to say
     so because 600/1400/2400 were all far past it. A sweep from zero does, so
     the pin point is measured first and the claim is made about the stops that
     are past it. */
  window.scrollTo(0, 0);
  await raf();
  /* TWO PIN POINTS, NOT ONE, and that is the whole shape of a two-band page:
     the transport pins when the record's name has gone under it, and the tab
     row pins one band later — when the transport has taken the top --bar-h of
     the screen and the row has reached the underside of it. Measured at 320px
     on the shipped chant: the bar at 110.1 and the row at 228.7, so the row is
     at rest 118.6 below the bar (52 of transport plus the engine line's own
     room) and pins at y = 228.7 - 52 = 176.7. A single pin point would have
     asked the row to be pinned sixty-five pixels before it can be. */
  const pinBar = Math.ceil(bar.getBoundingClientRect().top);
  /* THE STRIPE HAS NO PIN POINT, 2026-08-28: it is `position: fixed`, so it is
     at viewport top 0 from the first frame and stays there. `pinRow` was the
     scroll at which `#toptabs` reached the underside of the transport; the
     number that replaces it is 0, and the claim it feeds is that the stripe's
     top is 0 at EVERY stop rather than past one. */
  const pinRow = 0;
  const out = [];
  for (let k = 0; k <= 10; k++) {
    window.scrollTo(0, Math.round(max * k / 10));
    await raf();
    out.push({ y: window.scrollY,
      barPinned: window.scrollY >= pinBar, rowPinned: window.scrollY >= pinRow,
      barTop: +bar.getBoundingClientRect().top.toFixed(1),
      rowTop: +row.getBoundingClientRect().top.toFixed(1),
      want: 0 });
  }
  window.scrollTo(0, 0);
  await raf();
  return {
    stops: out, pinBar, pinRow,
    // the half that proves the old band GONE rather than drawn twice
    stickyHeads: [...document.querySelectorAll(".nu-ax > h2, #atlas > h2")]
      .filter((h) => getComputedStyle(h).position === "sticky")
      .map((h) => h.textContent.trim()),
    // …and that the stripe itself never scrolls sideways, and is ONE column
    // (A6b). The list is the scroller; the <nav> is the frame.
    rowScroll: (() => { const l = document.querySelector(".nu-traylist");
      return [l.scrollWidth, l.clientWidth]; })(),
    rowCols: (() => { const lefts = new Set();
      for (const b of row.querySelectorAll("button"))
        lefts.add(Math.round(b.getBoundingClientRect().left));
      return lefts.size; })(),
    /* READ OFF `aria-label` AND NOT OFF THE TEXT, 2026-08-28. The nine tabs
       are glyphs now (Paul: "Please make all the tabs and top buttons into
       sensible icons to save space"), so `textContent` is "⊕Where" — the
       mark, the `.nu-vh` word, and on the open one the printed word too. The
       durable claim these three lines make is "the row names all nine places
       and the open one is marked", and the ACCESSIBLE NAME is where that claim
       lives now: it is what a screen reader is told, it is one string from one
       table (ui/glyph.js), and it is exactly what `aria-label` is for. A gate
       that drove by the visible face would have to be rewritten again the next
       time somebody changes a picture. */
    names: [...row.querySelectorAll("button")]
      .map((b) => (b.getAttribute("aria-label") || "").trim()),
    marks: [...row.querySelectorAll("mark")]
      .map((m) => (m.closest("button").getAttribute("aria-label") || "").trim()),
    pressed: [...row.querySelectorAll('button[aria-pressed="true"]')]
      .map((b) => (b.getAttribute("aria-label") || "").trim()),
    /* WHAT THE MARKED MARK SHOULD SAY. At the root it is the open tab; at a
       sub-level the stripe is showing that level's own siblings and the marked
       one is the item that level has open, which `__eightTray` reports off the
       same call the buttons make. `↑` is never marked. */
    now: (() => { const T = window.__eightTray();
      if (T.level === "root") return window.__eightTabNow();
      const b = T.on && document.querySelector('[data-k="' + T.on + '"]');
      return b ? (b.getAttribute("aria-label") || "").trim() : null; })(),
    level: window.__eightTray().level,
    /* ...AND WHETHER THIS LEVEL HAS A "HERE" TO MARK AT ALL (2026-08-28). The
       stripe's third depth is the open motif's fourteen transforms, and they
       are ACTIONS rather than siblings: none of them is open, pressing one
       writes the record, and marking one would be a lie about state. The page
       DECLARES that (`trayNow`'s `acts`, read back through `__eightTray`) and
       A6c below asks the declaration rather than guessing from an absence —
       the same discipline motif-frozen's A1 uses on `[data-live]`. What says
       where you are at such a level is the HEAD, so the head's own accessible
       name is read here and asserted to name the thing you are inside. */
    acts: window.__eightTray().acts,
    headSays: (() => { const u = document.querySelector('[data-k="trayup"]');
      return u ? (u.dataset.say || "").trim() : null; })(),
    rowH: +row.getBoundingClientRect().height.toFixed(1),
    rowLines: 1,
  };
};

/* ---------- A8: a sticky first column rides over the scroll --------------
   WAS: `p.querySelector("table.nu-grid")` — the step grid's lane label, which
   is the control this assertion was written for and which no longer sits in a
   pane at all (see A5). Scoped that way it found nothing at 320/375/430/820
   and skipped four times, and a check that always skips is a check that is not
   being made.

   What it is about is unchanged: a column that is pinned while the rest of the
   table slides under it. So the subject is now EVERY pane that genuinely
   scrolls and whose first cell DECLARES `position: sticky`. Measured
   2026-08-25 with a drummer hired: at 320px the board's channel strip
   overflows its pane by 36px and holds to 0.5px; the chord chart overflows by
   83px at 320 and 28 at 375 and its first cell is `static` — six identical bar
   columns with no label to pin — so it is correctly not a subject rather than
   a failure. Returns a LIST, because "the one pane that scrolls" was itself an
   assumption about a page that has since grown more of them. */
const LANE = async () => {
  const out = [];
  for (const pane of document.querySelectorAll(".nu-pane")) {
    if (!pane.getClientRects().length) continue;   // a shut tab's pane (2026-08-27)
    if (pane.scrollWidth - pane.clientWidth < 20) continue;
    const th = pane.querySelector("th:first-child") || pane.querySelector("td:first-child");
    if (!th || getComputedStyle(th).position !== "sticky") continue;
    const t = pane.querySelector("table");
    const before = th.getBoundingClientRect().left;
    pane.scrollLeft = 200;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const after = th.getBoundingClientRect().left;
    const got = pane.scrollLeft;
    pane.scrollLeft = 0;
    out.push({ what: (t && t.className) || "table", scrolled: got,
               moved: +Math.abs(after - before).toFixed(1) });
  }
  return out;
};

/* PAUL'S OWN LIST, TYPED ONCE, AS THE ONE THING IN THIS FILE THAT IS NOT READ
   OFF THE PAGE. Everything else here is measured; this is the sentence being
   measured AGAINST, so it has to be a quotation and not a reading —
   `window.__eightTabs()` would agree with the page no matter what the page
   said. Paul, 2026-08-27: "The tabs are: Where / Tempo / Key / Motif / Band /
   Mix / Produce / Score / Export." */
const PAULS_TABS = ["Where", "Tempo", "Key", "Motif", "Band",
                    "Mix", "Produce", "Score", "Export"];
// how long a tab is given to settle after it is opened. The Score engraves a
// whole record on a promise the first time it is asked; everything else is
// synchronous and the wait is only for layout.
const TAB_SETTLE = (t) => (t === "Score" ? 1800 : 600);

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: executable() });
  const errors = [];
  console.log("shell gate · " + URL);

  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
    page.on("pageerror", (e) => errors.push(width + ": " + e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(SETTLE);

    const tabs = await page.evaluate(() => window.__eightTabs && window.__eightTabs());
    if (!tabs || !tabs.length) {
      fail(width + " · the page has no __eightTabs probe — nothing below was measured");
      await page.close();
      continue;
    }
    // A6d — nine names, Paul's words, Paul's order, read off the RENDERED
    // buttons (not off the probe, which is the page agreeing with itself)
    /* A6d — nine names, Paul's words, Paul's order, read off the RENDERED
       buttons. THE READING MOVED FROM THE FACE TO THE NAME, 2026-08-28: the
       tabs are glyphs and the word is the button's `aria-label`, so this asks
       for the accessible name. It is a STRONGER check than the one it
       replaces, not a weaker one — it now also proves that no tab is a naked
       picture to a screen reader, which is the thing a row of icons can
       actually get wrong. A6g is the other half: the word is in the DOM too,
       so the page still reads as itself with the stylesheet off.
       A6g / A6h AND NOT A6e / A6f: both of those labels were already spoken
       for further down this file (the scroll-memory walk and the pane sweep),
       and two checks answering to one name is a report nobody can read. */
    /* OFF THE STRIPE'S ROOT LEVEL, 2026-08-28. This read `#toptabs button`,
       which was the whole row because the row was the whole hierarchy, drawn
       flat. The stripe draws ONE level, so the gate says which level it wants
       — `__eightUp()` is the `↑` button pressed, the same call the button
       makes — and then reads the nine off the list. It skips `↑` by construction
       (there is none at the root) and skips nothing else. */
    await page.evaluate(() => window.__eightUp());
    const rowNames = await page.evaluate(() =>
      [...document.querySelectorAll(".nu-traylist button")]
        .map((b) => (b.getAttribute("aria-label") || "").trim()));
    is(JSON.stringify(rowNames) === JSON.stringify(PAULS_TABS),
      "A6d " + width + " · nine tabs, Paul's words, Paul's order — "
      + JSON.stringify(rowNames));
    const rowWords = await page.evaluate(() =>
      [...document.querySelectorAll(".nu-traylist button")]
        .map((b) => { const v = b.querySelector(".nu-vh, mark .nu-vh");
                      return v ? v.textContent.trim() : null; }));
    is(JSON.stringify(rowWords) === JSON.stringify(PAULS_TABS),
      "A6g " + width + " · and every word is still IN the button, so the row "
      + "reads with the stylesheet off — " + JSON.stringify(rowWords));
    // A6h — every glyph on the page is decoration beside a name: a mark with
    // no `aria-label` on its button is the one failure an icon row can hide.
    const nakedGlyphs = await page.evaluate(() =>
      [...document.querySelectorAll("button .nu-g")]
        .map((g) => g.closest("button"))
        .filter((b) => !(b.getAttribute("aria-label") || "").trim() ||
                       !b.querySelector(".nu-vh"))
        .map((b) => b.dataset.k || b.id || "?"));
    is(nakedGlyphs.length === 0,
      "A6h " + width + " · no naked glyph — every mark has a word and a name "
      + JSON.stringify(nakedGlyphs));

    /* A6j — EVERY LEVEL IS REACHABLE, AND `↑` RETURNS (2026-08-28). Paul:
       *"There should be one vertical stripe max with an 'up' icon to get to
       the parent level."* Three of the nine tabs have a level inside them, and
       the whole claim of the stripe is that you can get into one and back out
       of it with the marks that are on the screen — so this drives the actual
       buttons rather than the probe: `.click()` on the tab's mark, `.click()`
       on `↑`, and the level is read after each.
       AND THERE IS NO `↑` AT THE ROOT. It is ABSENT rather than disabled, and
       that is a decision with a reason (ui/eight.js THE STRIPE: the refusal
       idiom is for an option the RECORD made unreachable, and "there is no
       level above the top" is a definition, not a fact that can change). A
       dead 44px target at the head of a 56px column is what this asserts is
       not there. */
    /* THE WALK IS A CHAIN AND NOT A ROUND TRIP SINCE 2026-08-28, because the
       gutter is three deep now. Paul: *"When I'm in a motif, the motif
       operations should be the right nav elements on the view. The up arrow to
       take me home should take me back to the motif picker."* So `Motif` lands
       you INSIDE the open motif — its fourteen transforms — and `↑` from there
       is the BANK, with a second `↑` for the nine. One press per level, the
       button the thumb presses, until there is no `↑` left; the chain of
       levels that walk produces is the assertion. (It read `["Motif",
       "motif"]` and one `.click()` on `↑` expecting the root, which is the
       shape of a two-deep stripe and would now fail for being right about
       yesterday.) A drum pattern has no transforms, so a record whose open
       cell is a beat lands on the bank instead — both are accepted below, and
       which one you get is `trayNow`'s arithmetic, not a branch here. */
    const levels = [];
    const now = () => page.evaluate(() => window.__eightTray());
    await page.evaluate(() => window.__eightUp());
    levels.push(["root", await now(), await page.$('[data-k="trayup"]')]);
    /* ...AND `Tempo` JOINED THE TABLE, 2026-08-28. Paul: *"When I'm in tempo,
       move the tempo nav to the right nav."* The eight tempo operations are a
       level of the stripe now (ui/eight.js `tempoTrayItems`) and `Tempo` lands
       on them, so it is a fourth tab with something inside it and the arrival
       table has to say so or this gate would go on proving a claim about a
       page that no longer exists. */
    for (const [word, want] of [["Band", ["band"]],
                                ["Tempo", ["tempo"]],
                                ["Motif", ["motifops", "motif"]],
                                ["Score", ["score"]]]) {
      await page.click('[data-k="toptab-' + word + '"]');
      await page.waitForTimeout(TAB_SETTLE(word));
      const into = await now();
      const chain = [into.level];
      for (let i = 0; i < 4; i++) {
        const up = await page.$('[data-k="trayup"]');
        if (!up) break;
        await up.click();
        await page.waitForTimeout(150);
        chain.push((await now()).level);
      }
      levels.push([word, into, want.concat(["root"]), chain]);
    }
    const rootUp = levels[0][2];
    is(!rootUp, "A6j " + width + " · no ↑ at the root level — it is absent, "
      + "not a dead button");
    const badLevel = levels.slice(1).filter(
      (L) => L[3].join(">") !== L[2].join(">") || !L[1].items.length);
    is(badLevel.length === 0,
      "A6j " + width + " · every level is reachable and ↑ climbs one at a "
      + "time to the root — "
      + levels.slice(1).map((L) => L[0] + ": " + L[3].join(" ↑ ") + " (" +
          L[1].items.length + " marks)").join(", "));

    /* A6k — THE LEVELS YOU REACH BY TAPPING A MARK, NOT BY OPENING A TAB
       (2026-08-28). The walk above proves that every tab's ARRIVAL level is
       reachable and climbs home; it says nothing about the levels that are one
       tap FURTHER in, and since tonight there are four of those. Paul, in one
       batch: *"Make the sections into nav items with the ability to add them
       and remove them and recharacterize and move them up and down"* and
       *"Make a new voice section for all voices."* So the band's `sections`
       mark opens the sections, a section's mark opens that section's three
       operations, and a voice's mark opens that voice's three facets — four
       depths under one tab, and `↑` must climb them one at a time.

       IT DRIVES THE MARKS, exactly as the walk above drives the tab buttons: a
       gate that descended with `__eightTray` would be proving that the probe
       agrees with itself. The section mark's key is read off the level rather
       than typed, because a section's id is the RECORD's (`c1`, `s0`, whatever
       precompose dealt it) and a gate that typed one would be asserting about
       one shipped record instead of about the stripe. */
    const deep = [];
    for (const [start, marks, want] of [
      ["Band", ["tabform", 0], ["section", "sections", "band", "root"]],
      ["Band", ["voice"], ["voice", "band", "root"]],
    ]) {
      await page.evaluate((t) => window.__eightTab(t), start);
      await page.waitForTimeout(TAB_SETTLE(start));
      let ok2 = true;
      for (const m of marks) {
        const L = await now();
        // a NUMBER is an index into the level that is showing; "voice" is the
        // first mark that is neither of the two song-level pair nor an add
        const k = typeof m === "number" ? L.items[m]
          : m === "voice" ? L.items.find((x) => x.startsWith("tab") &&
              x !== "tabform" && x !== "tabperformance")
          : m;
        if (!k) { ok2 = false; break; }
        await page.click('[data-k="' + k + '"]');
        await page.waitForTimeout(250);
      }
      if (!ok2) { deep.push([start, marks.join(">"), ["(no such mark)"]]); continue; }
      const chain = [(await now()).level];
      for (let i = 0; i < 5; i++) {
        const up = await page.$('[data-k="trayup"]');
        if (!up) break;
        await up.click();
        await page.waitForTimeout(200);
        chain.push((await now()).level);
      }
      deep.push([start, marks.join(">"), chain, want]);
    }
    const badDeep = deep.filter((D) => !D[3] || D[2].join(">") !== D[3].join(">"));
    is(badDeep.length === 0,
      "A6k " + width + " · a mark descends and ↑ climbs back one level at a "
      + "time — " + deep.map((D) => D[1] + ": " + D[2].join(" ↑ ")).join(", "));

    // THE KIT GRID IS THE WIDEST THING THIS PAGE DRAWS and the default record
    // has no drummer, so a gate that does not add one never measures it.
    // ...AND THE BUTTON THAT HIRES ONE IS INSIDE THE BAND TAB since 2026-08-27,
    // so the tab is opened first. Before this line the gate found no such
    // button on the tabbed page and skipped at all four widths.
    await page.evaluate(() => window.__eightTab("Band"));
    await page.waitForTimeout(TAB_SETTLE("Band"));
    const add = await page.$('[data-k="adddrums"]');
    if (add) { await add.click(); await page.waitForTimeout(1200); }
    else skip(width + " · no [data-k=adddrums] button — the kit grid was not measured");

    for (const tab of tabs) {
      await page.evaluate((t) => window.__eightTab(t), tab);
      await page.waitForTimeout(TAB_SETTLE(tab));
      const at = width + "/" + tab;
      const s = await page.evaluate(SURVEY);
      console.log("[" + at + "] scroll " + s.scrollWidth + "/" + s.clientWidth
        + " · h" + s.scrollHeight + " · bars " + s.bars + " · axes " + s.axes
        + " · panes " + s.panes + " · grids " + s.grids
        + " · sheets " + s.sheets + (s.linked ? " (linked)" : " (NO <link>)"));

      is(s.scrollWidth === s.clientWidth,
        "A1 " + at + " · no sideways scroll (" + s.scrollWidth + " vs " + s.clientWidth + ")");
      is(s.shortControls.length === 0,
        "A2 " + at + " · no control under 44px"
        + (s.shortControls.length ? " — " + s.shortControls.length + " short, e.g. "
           + s.shortControls.slice(0, 4).map((x) => x.n + "@" + x.h).join(", ") : ""));
      is(s.smallBoxes.length === 0,
        "A3 " + at + " · every checkbox/radio/step-button target >= 24px"
        + (s.smallBoxes.length ? " — " + s.smallBoxes.length + " small, e.g. "
           + s.smallBoxes.slice(0, 4).map((x) => x.n + "@" + x.w + "x" + x.h).join(", ") : ""));
      is(s.clippedPanes.length === 0,
        "A4 " + at + " · no pane clips vertically"
        + (s.clippedPanes.length ? " — " + JSON.stringify(s.clippedPanes) : ""));
      is(s.spillingTables.length === 0,
        "A5 " + at + " · no <table> overflows the box it is in"
        + (s.spillingTables.length ? " — spilling: " + s.spillingTables.join(", ") : ""));
      is(s.panedGrids.length === 0,
        "A5c " + at + " · no .nu-pane around a rotated step grid"
        + (s.panedGrids.length ? " — " + s.panedGrids.join(", ") : ""));
      is(s.crowdedPanes.length === 0 && s.nestedPanes === 0,
        "A5b " + at + " · one table per pane, no nesting"
        + (s.crowdedPanes.length ? " — " + JSON.stringify(s.crowdedPanes) : "")
        + (s.nestedPanes ? " — " + s.nestedPanes + " nested" : ""));
      // A7 — the promise --bar-h makes to the tab row
      if (s.bars !== 1) fail("A7 " + at + " · exactly one .nu-bar (found " + s.bars + ")");
      else {
        const want = parseFloat(s.barVar);
        is(Math.abs(s.barH - want) <= 0.5,
          "A7 " + at + " · .nu-bar is " + s.barH + "px, --bar-h says " + s.barVar);
      }
      is(s.overflowSins.length === 0,
        "A0 " + at + " · body and #app keep overflow-x: visible"
        + (s.overflowSins.length ? " — " + s.overflowSins.join(", ")
           + " (this kills BOTH sticky bands silently)" : ""));

      const lanes = await page.evaluate(LANE);
      if (!lanes.length)
        skip("A8 " + at + " · no pane with a sticky first column scrolls here");
      else for (const lane of lanes)
        is(lane.moved <= 2,
          "A8 " + at + " · " + lane.what + "'s sticky first column moved "
          + lane.moved + "px over a " + lane.scrolled + "px scroll");

      /* A6 / A6b / A6c — the ONE band and the fixed stripe, swept down this
         tab's whole height. `pinRow` is 0 since 2026-08-28 (the stripe is
         `position: fixed` and is at the top of the viewport from the first
         frame), so every stop is a stop the stripe is asked about and the
         "too short to pin" skip only ever fires for the transport. */
      const b = await page.evaluate(BANDS);
      const pinB = b.stops.filter((t) => t.barPinned);
      const pinR = b.stops.filter((t) => t.rowPinned);
      const badBar = pinB.filter((t) => Math.abs(t.barTop) > 0.5);
      const badRow = pinR.filter((t) => Math.abs(t.rowTop - t.want) > 0.5);
      const end = b.stops[b.stops.length - 1].y;
      if (!pinB.length)
        skip("A6 " + at + " · this tab is too short to pin the transport — the "
          + "whole panel is on the screen (page ends at y=" + end
          + ", the bar pins at " + b.pinBar + ")");
      else is(badBar.length === 0 && badRow.length === 0,
        "A6 " + at + " · over " + pinB.length + " pinned stops to y=" + end
        + ": .nu-bar at 0 and the stripe fixed at 0 ("
        + b.rowH + "px tall, level \"" + b.level + "\")"
        + (badBar.length ? " — bar off at " + JSON.stringify(badBar.slice(0, 3)) : "")
        + (badRow.length ? " — stripe off at " + JSON.stringify(badRow.slice(0, 3)) : ""));
      is(b.stickyHeads.length === 0,
        "A6 " + at + " · no axis heading is sticky any more — the navigation "
        + "is a fixed gutter" + (b.stickyHeads.length ? " — " + b.stickyHeads.join(", ") : ""));
      is(b.rowScroll[0] === b.rowScroll[1] && b.rowCols === 1,
        "A6b " + at + " · the stripe is ONE column and never scrolls sideways ("
        + b.rowScroll[0] + " vs " + b.rowScroll[1] + ", " + b.rowCols + " column)");
      /* A6c, IN ITS TWO CASES SINCE 2026-08-28. The claim is unchanged where
         it always applied — a level of SIBLINGS marks the open one, exactly
         once, in both the picture and the ARIA — and it is stated for the one
         level that has no siblings: the open motif's transforms, which the
         page declares as `acts`. There, nothing may be marked (fourteen
         `aria-pressed="false"` buttons would announce a state that does not
         exist) and the HEAD carries "you are here" by naming the motif. Paul:
         *"When I'm in a motif, the motif operations should be the right nav
         elements on the view."* */
      if (b.acts)
        is(b.marks.length === 0 && b.pressed.length === 0 &&
           /^up — out of \S/.test(b.headSays || ""),
          "A6c " + at + " · a level of ACTIONS marks nothing and the head says "
          + "where you are: " + JSON.stringify(b.headSays) + " (marks "
          + JSON.stringify(b.marks) + ", pressed " + JSON.stringify(b.pressed) + ")");
      else is(b.marks.length === 1 && b.marks[0] === b.now &&
         b.pressed.length === 1 && b.pressed[0] === b.now,
        "A6c " + at + " · one <mark>, one aria-pressed, and both say \"" + b.now
        + "\" (marks " + JSON.stringify(b.marks) + ", pressed "
        + JSON.stringify(b.pressed) + ")");
      /* A6i — NOTHING GOES UNDER THE GUTTER. Paul, 2026-08-28: *"Dont let
         anything go under it."* The gutter's width is taken OUT of the page
         (nu.css, `body { padding-inline }`), so this is a claim about flow and
         not about z-index: no laid-out block overlaps the stripe's band.

         AND IT NO LONGER KNOWS WHICH EDGE THE STRIPE IS ON (rewritten
         2026-08-28, hours after it was written). Paul: *"Move the right nav to
         the left so it doesn't interfere with the scroll on the right."* This
         read `const gl = tray.left` and failed anything whose `right` passed
         it — one number, and it only ever meant "the gutter is on the right".
         With the stripe at x=0 that number is 0 and EVERY block on the page is
         past it: fifty failures at five widths, all of them saying the page
         was under a gutter it is beside. The claim was never about a side; it
         is that nothing OVERLAPS the stripe's band, so that is what is asked,
         off the stripe's measured rectangle, and it holds on either edge with
         nothing here to edit if it moves again. (ui/glyph.js `place()` and
         nu.css `.nu-log` are the page's own two versions of the same lesson —
         see the list at nu.css `.nu-tray`.) */
      const G = await page.evaluate(() => {
        const tray = document.getElementById("nu-tray");
        const t = tray.getBoundingClientRect();
        const bad = [];
        const clips = (cs, c) => c.tagName.toLowerCase() === "svg" ||
          ["hidden", "auto", "scroll", "clip"].includes(cs.overflowX);
        const walk = (n) => { for (const c of n.children) {
          if (c === tray || c.id === "nu-say") continue;
          const cs = getComputedStyle(c);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const r = c.getBoundingClientRect();
          if (!r.width && !r.height) continue;
          if (r.right > t.left + 0.5 && r.left < t.right - 0.5)
            bad.push((c.id || String(c.className) || c.tagName)
                     + "@" + r.left.toFixed(1) + "-" + r.right.toFixed(1));
          if (!clips(cs, c)) walk(c); } };
        walk(document.body);
        return { gl: +t.left.toFixed(2), gr: +t.right.toFixed(2),
                 over: bad.slice(0, 5), overN: bad.length,
                 w: +t.width.toFixed(2) };
      });
      is(G.overN === 0,
        "A6i " + at + " · nothing under the " + G.w + "px gutter — its band is "
        + G.gl + "-" + G.gr + " and no block overlaps it"
        + (G.overN ? " — " + G.overN + " over: " + G.over.join(", ") : ""));
    }

    /* A6e — A TAB REMEMBERS ITS SCROLL, and it is measured on the two tallest
       tabs this record has rather than on a pair chosen by name: a tab with no
       scroll to lose cannot prove anything about losing it. The scroll is set
       with `window.scrollTo`, never with an element click — Playwright's own
       scroll-into-view centres its target and would manufacture the number
       being measured (ui/eight.js ANCHOR_MAX carries that finding). */
    const tall = await page.evaluate(async (settle) => {
      const out = [];
      for (const t of window.__eightTabs()) {
        window.__eightTab(t);
        await new Promise((r) => setTimeout(r, settle));
        out.push([t, document.documentElement.scrollHeight - window.innerHeight]);
      }
      return out.filter((x) => x[1] > 200).sort((a, b) => b[1] - a[1]).slice(0, 2);
    }, 350);
    if (tall.length < 2) skip("A6e " + width + " · fewer than two scrollable tabs");
    else {
      const [A, B] = tall.map((x) => x[0]);
      const walk = await page.evaluate(async ([A, B]) => {
        const go = async (t) => { window.__eightTab(t);
          await new Promise((r) => setTimeout(r, 350)); };
        await go(A); window.scrollTo(0, 400);
        await new Promise((r) => setTimeout(r, 150));
        const a1 = Math.round(window.scrollY);
        await go(B); const b1 = Math.round(window.scrollY);
        window.scrollTo(0, 220); await new Promise((r) => setTimeout(r, 150));
        await go(A); const a2 = Math.round(window.scrollY);
        await go(B); const b2 = Math.round(window.scrollY);
        return { a1, b1, a2, b2 };
      }, [A, B]);
      is(walk.a2 === walk.a1 && walk.b2 === 220,
        "A6e " + width + " · " + A + " left at " + walk.a1 + " came back at "
        + walk.a2 + "; " + B + " left at 220 came back at " + walk.b2
        + " (and " + B + " opened for the first time at " + walk.b1 + ")");
      is(walk.b1 === 0,
        "A6e " + width + " · a tab never opened starts at the top (" + B
        + " opened at " + walk.b1 + ")");
    }
    await page.close();
  }

  if (errors.length) { console.log("  note · " + errors.length + " pageerror(s):");
    for (const e of errors.slice(0, 5)) console.log("       " + e); }

  await browser.close();
  console.log(FAILS ? "\nFAIL — " + FAILS + " assertion(s) failed"
                    + (SKIPS ? ", " + SKIPS + " skipped" : "")
                    : "\nPASS — every shell assertion holds"
                    + (SKIPS ? " (" + SKIPS + " skipped)" : ""));
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
