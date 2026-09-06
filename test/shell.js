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
//       (…EXCEPT `[data-pane="table"]`, which since 2026-09-05 is the sonic
//       spreadsheet's scrollport on purpose so its instrument heads have
//       something to stick against. The exemption is measured and argued at
//       the `clippedPanes` field below.)
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
//   A5c no `.nu-pane` wraps a rotated step grid (`table.nu-grid`) THAT FITS —
//       the exact unnecessary scroll container named above, kept out by name.
//       (WAS "no `.nu-pane` wraps a rotated step grid" full stop, until
//       2026-09-03: the drum editor offers the whole twelve-lane kit now and a
//       twelve-lane grid is 454px against a 224px deck at 320px. A grid that
//       genuinely spills takes the same pane A5 demands of every other table;
//       what stays banned is a scroller around a grid that cannot scroll,
//       which is the one Paul reported catching his gestures.)
//   A6  THERE IS NO STICKY BAND LEFT, AND THE NAVIGATION IS A FIXED BAR
//       (rewritten four times, and every rewrite was forced by Paul moving the
//       navigation, so all of them are kept).
//       IT FIRST READ: "at scrollY 600/1400/2400 the .nu-bar sits at 0 and
//       EXACTLY ONE .nu-ax > h2 sits in 0 < top < 120 — and it is the heading
//       of the axis the viewport is actually inside. Two bands, never three."
//       IT THEN READ (2026-08-27, the tabs): "at every scroll position this
//       page can reach, on every tab, `.nu-bar` sits at 0 and `#toptabs` sits
//       at exactly `--bar-h`."
//       IT THEN READ (2026-08-28, the fixed gutter — Paul: *"Come up with a
//       strategy for running the nav icons … down the right of the interface"*
//       / *"Make it a fixed gutter"* / *"Dont let anything go under it"*): the
//       stripe sits at viewport top 0 and never moves, and no `.nu-ax > h2` is
//       `position: sticky` anywhere — the half that proves the old bands went
//       rather than being drawn twice. (2026-08-29 deleted `.nu-bar` and
//       `<h1 id="title">` with the transport row, so the first half of the
//       sentence had no subject and this gate THREW rather than failing.)
//       AND NOW (2026-09-09, TABLE.md §10b steps 6 and 7) THE GUTTER IS
//       DELETED TOO. Paul: *"…then have a hamburger menu for score, video,
//       screensaver, and have genre, dice, playstop along the bottom — a real
//       mobile app now with everything in the table and the nav space
//       reclaimed."* The chrome is a `.nu-bar` again — at the FOOT this time,
//       full width — so the claim turns ninety degrees with it and is
//       otherwise word for word what it was: over the whole height of every
//       surface, at eleven stops from 0 to the bottom, the bar's BOTTOM is the
//       viewport's bottom, its LEFT is 0 and its WIDTH is the page's own
//       width, none of the three moves, and no `.nu-ax > h2` is sticky
//       anywhere. It is `position: fixed`, so there is no pin point to wait
//       for and EVERY stop is asserted, scrollY 0 included.
//   A6b THE BAR IS ONE ROW AND IT NEVER SCROLLS SIDEWAYS. (It read "the tab
//       row NEVER SCROLLS SIDEWAYS", then "the stripe is ONE COLUMN and never
//       scrolls sideways", counting distinct button LEFTS. A bar that wrapped
//       would be a second row of chrome at the foot — the trade the gutter's
//       deletion was made to avoid — so the count is distinct button TOPS.
//       `.nu-seedrow`'s two targets are one mark and are counted at the row's
//       own top, which is the 2026-09-03 amendment kept.)
//   A6c AT MOST ONE `<mark>`, AND IT IS THE OPEN SHEET. It read "exactly one
//       <mark> in the stripe, and its button is the only one with
//       `aria-pressed="true"`", and EXACTLY was right while the chrome was a
//       list of PLACES one of which you were always standing in. The table is
//       not a place you opened: it is the page. So standing on it is the state
//       in which nothing in the chrome is marked — a mark on the ≡ would say
//       you were inside the menu, a mark on the genre plate would say the
//       globe was open — and while a SHEET is open exactly one row wears both
//       channels and both say the same word. `__eightTabNow()` decides which
//       it should be, so this is a comparison of two readings of one fact.
//   A6d THE HAMBURGER IS THE FOUR VIEWERS AND THE LOG, in `TABS`' own order,
//       read off the RENDERED buttons — Paul's list minus `Where` (the bar's
//       genre plate, a picker) and `Band` (the page). …AND THE GENRE IS A
//       PLATE IN THE BAR wearing the RECORD's name, not a row in the menu.
//   A6g …and every word is still IN the button as a `.nu-vh`, so the menu
//       reads with the stylesheet off. A6h: no naked glyph, page-wide.
//   A6i NOTHING GOES UNDER THE CHROME, and it is a layout law rather than a
//       z-index (Paul: *"Dont let anything go under it."* — said about the
//       gutter, and the same sentence about the bar). Both bands' room is
//       taken OUT of the page (nu.css `body { padding-block-start }` and
//       `{ padding-block-end }`), so this is a claim about FLOW. IT IS
//       MEASURED AT TWO SCROLL POSITIONS and that is what the turn cost: a
//       vertical gutter is beside the page at every scroll, but any page
//       taller than the screen crosses a FOOT bar's band in viewport
//       coordinates half way down it. What the law means about a foot bar is
//       that the page reserves the room, so the sweep runs at scrollY = max
//       for the bar and at scrollY = 0 for the top strip. Boxes are not
//       descended into past a clipper, and a `[data-sheet]` panel is judged by
//       its contents rather than by its own box, for the same reason.
//   A6j THERE IS NO TRAY, AND A VIEWER IS A SHEET WITH A WAY OUT. It drove
//       `[data-k="trayup"]` up a chain of levels (2026-08-28), then asserted
//       the ↑'s ABSENCE at every depth of a tree (2026-09-02), and now asserts
//       the absence of the whole apparatus — no ↑, no `#nu-tray` /
//       `.nu-traylist` / `.nu-trayfoot` / `.nu-traycut`, nothing wearing
//       `[data-depth]`. What replaced it is DRIVEN: each of the four viewers
//       is opened from the hamburger's own button, asserted to be one
//       full-width `[data-sheet]` panel with a close on the screen and the
//       menu shut behind it, and the close is pressed and must land back on
//       the table with the table drawn.
//       (A6k IS RETIRED. It asserted ONE OPEN PATH in the tree — open Band,
//       open Score, and the first branch is gone. There is no tree; what it
//       protected, that you are never shown two navigations at once, is A6j's
//       count of exactly one `[data-sheet]`.)
//   A6l THE OPS ARE ON THE TABLE. TABLE.md §9a, Paul: *"Move all the nav into
//       the table, I should be able to add players without using the nav and
//       sections too."* It read off the stripe that a player row and a section
//       row had NO CHILDREN and off the TABLE that every op those children
//       carried is at its own address in the sheet the row opens. The first
//       half is free now (there are no rows), so what is driven is the second,
//       from the table's own heads — idempotently, because a head is a TOGGLE
//       and `tablePanel` lands an arrival by CLICKING the head it wants open,
//       so after a hire the new player's sheet is ALREADY open and a gate that
//       presses it once has shut it (measured: `{"del":false}` at all four
//       widths, with the sheet standing open in the frame before the tap).
//   A6e A TAB REMEMBERS ITS SCROLL. Scroll a tall surface, leave it, come
//       back: the window is where you left it, and one never opened starts at
//       0. (This is why a sheet is IN FLOW and not `position: fixed` — nu.css
//       carries the measurement at `.nu-pan[data-sheet]`.)
//   A7  ONE BAR, AND IT IS EXACTLY --bar-h TALL. The name is back where it
//       started: it was `--bar-h` for the sticky transport, `--tray-w` for the
//       gutter, and it is `--bar-h` again for the foot bar. The claim never
//       moved — the page's chrome EXISTS, there is exactly ONE of it, and it
//       is the size the stylesheet declares — because the rest of the layout
//       is arithmetic on that number: `body { padding-block-end: calc(var(
//       --bar-h) + var(--s3)) }` is the whole of "nothing goes under the bar",
//       so a `.nu-bar` a pixel taller than its token is a bar standing on the
//       page and a second `.nu-bar` is the second row A6b forbids by geometry.
//       The token carries an `env()` and is a substitution rather than a
//       computed length, so it is RESOLVED BY THE PAGE off a probe element.
//       IT DOES NOT RE-TEST THE TRANSPORT. That `#play` is in the bar in every
//       state, and what pressing it does, is test/gutter.js T2/T3.
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
    /* A7 — THE BAR, AND THE NAME IS BACK WHERE IT STARTED. `bars` / `barH` /
       `barVar` read `.nu-bar` and `--bar-h` until 2026-08-29, then the band was
       deleted and the chrome was `.nu-tray` at `--tray-w`; the gutter is
       deleted in its turn (2026-09-09, TABLE.md §10b step 7) and the chrome is
       a `.nu-bar` at `--bar-h` again — at the FOOT this time, and full width.
       The claim never moved: the page's chrome exists, there is exactly one of
       it, and it is the size the stylesheet declares, because the rest of the
       layout is arithmetic on that number (`body { padding-block-end }`).
       Filtered by `shown` like everything else here. */
    bars: all(".nu-bar").length,
    axes: all(".nu-ax").length,
    panes: all(".nu-pane").length,
    grids: all(".nu-grid").length,
    barH: document.querySelector(".nu-bar")
      ? +rect(document.querySelector(".nu-bar")).height.toFixed(2) : null,
    /* THE TOKEN, RESOLVED BY THE PAGE, and the probe is the one the gutter
       taught this file to build. `--bar-h` is
       `calc(var(--tap) + var(--s1) + var(--s1) + env(safe-area-inset-bottom))`
       — an unregistered custom property is a token stream, so
       `getPropertyValue("--bar-h")` hands back that calc() text and
       `parseFloat` reads NaN. The page is asked what the declaration MEANS:
       one off-screen `box-sizing: border-box` div whose BLOCK size is
       `var(--bar-h)`, measured and removed, which keeps the home indicator in
       the answer and keeps the number out of this file. */
    barVar: (() => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;left:-9999px;top:0;" +
        "inline-size:1px;block-size:var(--bar-h);box-sizing:border-box";
      document.body.appendChild(probe);
      const h = +rect(probe).height.toFixed(2);
      probe.remove();
      return h;
    })(),
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
    /* A4 — ...EXCEPT THE ONE PANE THAT IS DELIBERATELY A TWO-AXIS SCROLLER
       (2026-09-05). Every other pane on this page is a WIDE table in a column
       that scrolls sideways, and a vertical overflow there is a row hidden by
       accident — which is the whole of this check and why it exists.
       The table's own pane is the other thing: Paul, using it, *"we should
       have sticky headers for instruments and sections"*, and a `position:
       sticky` head needs a scrollport to stick inside. `.nu-sheetwrap` is
       capped to the band between the top strip and the foot bar and
       `.nu-pane[data-pane="table"]` takes what is left and scrolls BOTH ways
       (nu.css carries the arithmetic and the two laws it weighs). Its vertical
       overflow is the feature; measured at 320/390/1280 on Kingston 1969, the
       pane has 913 · 913 · 862 px to give and the page itself has NONE
       (documentElement.scrollHeight === clientHeight), which is what keeps the
       bar's promise. test/table.browser.js T9s2 asserts the heads hold over
       it; this line only stops asserting the opposite. */
    clippedPanes: all(".nu-pane")
      .filter((p) => p.dataset.pane !== "table")
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
    /* A5c — a rotated step grid takes no pane IT DOES NOT NEED. ui/eight.js
       `stepGrid`: "an `overflow-x: auto` box around a table that CANNOT
       overflow is a scroll container that exists only to catch gestures. It
       caught them."
       THE CLAUSE THAT MOVED, 2026-09-03, and it is the four words the
       original argument already turned on: *that cannot overflow*. This read
       `.nu-pane table.nu-grid` — any pane at all — and the drum editor can now
       be twelve lanes wide (Paul: *"give me some more appropriate options, we
       seem to have only four elements in most of our kits"*), which is 454px
       against the 224px deck a 320px phone leaves — MEASURED, and it is also
       what jazz's seven-column kit was already doing before any of this.
       A5 demands a pane of every other table that spills; forbidding one here
       would have left the page scrolling sideways instead, which is the
       defect, not the fix. So this flags the pane the argument was about: one
       around a grid that FITS. */
    panedGrids: all(".nu-pane table.nu-grid")
      .filter((t) => t.parentElement &&
        t.scrollWidth <= t.parentElement.clientWidth + 1)
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

/* ---------- the one stripe, swept rather than sampled ---------------------
   WAS "the sticky trace": three literal scroll stops (600/1400/2400, offset
   from #app after the atlas landed above it) and, at each, "exactly one pinned
   `.nu-ax > h2`". nu.css's own note had to explain that the claim could only
   be true at the three positions this function sampled, because at every seam
   between two axes there was a 73-78px window where both headings were in the
   band. There are no seams now: one panel is on the page at a time (Paul,
   2026-08-27, the tabs) and its heading is neither sticky nor visible.

   So this sweeps instead of sampling, and asks the claim that IS true at every
   pixel: the stripe at viewport top 0, all the way down whatever this tab
   happens to be, and nothing sticky anywhere. Ten stops rather than three,
   spread across the tab's own height, so a tall tab is swept where it is tall
   and a short one is not asked about scroll it does not have.

   AND IT IS ONE BAND, NOT TWO, SINCE 2026-08-29. Two paragraphs stood here and
   both are kept because both are the reason the shape of this sweep is what it
   is. THE FIRST: "WHERE THE BANDS PIN, AND IT IS NOT ZERO. `#title` is above
   the transport and always has been, so at scrollY 0 the bar sits wherever the
   record's name leaves it (measured: 110.1 at 320px on the shipped chant, 76.5
   at 375) and neither band is pinned yet. That is not a failure — it is what
   `position: sticky` means — and the old three-stop version never had to say so
   because 600/1400/2400 were all far past it. A sweep from zero does, so the
   pin point is measured first and the claim is made about the stops that are
   past it." THE SECOND: "TWO PIN POINTS, NOT ONE, and that is the whole shape
   of a two-band page: the transport pins when the record's name has gone under
   it, and the tab row pins one band later … Measured at 320px on the shipped
   chant: the bar at 110.1 and the row at 228.7 … pins at y = 228.7 - 52 =
   176.7."

   THERE IS NO PIN POINT LEFT TO MEASURE. Paul deleted the heading and the band
   on 2026-08-29 ("Get rid of the play buttons and the title of the song"), and
   the one piece of chrome left is `position: fixed` — at viewport top 0 from
   the first frame, with nothing above it to hold it down and nothing to wait
   for. So `pinBar` is gone with the band it measured (it read `bar
   .getBoundingClientRect().top` off a null and threw), `pinRow` stays 0, and
   the arithmetic that survives is the strongest form of the claim: EVERY stop
   is asserted, including scrollY 0, rather than only the stops past a pin. */
const BANDS = async () => {
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const bar = document.getElementById("nu-bar");
  /* (`const top = document.querySelector(".nu-top")` STOOD HERE and was read by
     nothing. `.nu-top` is deleted — TABLE.md §13a.1, *"Nothing is fixed but the
     bottom bar"* — and the sweep below has one band to assert, which is what
     this check has said since the heading and the old `.nu-bar` went in
     2026-08-29.) */
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo(0, 0);
  await raf();
  const out = [];
  for (let k = 0; k <= 10; k++) {
    window.scrollTo(0, Math.round(max * k / 10));
    await raf();
    /* WHAT "FIXED AT THE FOOT" IS, AS TWO NUMBERS. The bar's BOTTOM is the
       viewport's bottom and its LEFT is 0 — both compared against the viewport
       rather than against a constant typed here, so a bar that moved edges
       again would be caught by the same line. `position: fixed` means there is
       no pin point to wait for: every stop is asserted, scrollY 0 included. */
    const r = bar.getBoundingClientRect();
    out.push({ y: window.scrollY,
      barBottom: +r.bottom.toFixed(1),
      barLeft: +r.left.toFixed(1),
      barWidth: +r.width.toFixed(1),
      wantBottom: window.innerHeight,
      wantWidth: document.documentElement.clientWidth });
  }
  window.scrollTo(0, 0);
  await raf();
  return {
    stops: out,
    // the half that proves the old bands GONE rather than drawn twice
    stickyHeads: [...document.querySelectorAll(".nu-ax > h2, #atlas > h2")]
      .filter((h) => getComputedStyle(h).position === "sticky")
      .map((h) => h.textContent.trim()),
    /* A6b — THE BAR IS ONE ROW AND NEVER SCROLLS SIDEWAYS. It is the same
       claim `.nu-traylist` answered as "one column that never scrolls
       sideways", turned ninety degrees with the chrome: a bar that wrapped
       would be a second row of chrome at the foot, which is the trade the
       gutter's deletion was made to avoid. DISTINCT BUTTON TOPS, not lefts,
       for the same reason the stripe counted lefts.
       ONE MARK MADE OF TWO TARGETS IS NOT A SECOND ROW (2026-09-03, kept):
       `.nu-seedrow` holds the die AND the number, which is two buttons and one
       mark, so a button inside it is counted at the row's own top. */
    barScroll: [bar.scrollWidth, bar.clientWidth],
    barRows: (() => { const tops = new Set();
      for (const b of bar.querySelectorAll("button")) {
        if (!b.getClientRects().length) continue;
        const box = b.closest(".nu-seedrow") || b;
        tops.add(Math.round(box.getBoundingClientRect().top));
      }
      return tops.size; })(),
    /* READ OFF `aria-label` AND NOT OFF THE TEXT (2026-08-28, kept whole). The
       chrome is glyphs, so `textContent` is "≡menu"; the durable claim is
       "every control in the chrome names itself", and the ACCESSIBLE NAME is
       where that claim lives — one string from one table (ui/glyph.js). */
    names: [...document.querySelectorAll("#nu-chrome button")]
      .filter((b) => b.getClientRects().length)
      .map((b) => (b.getAttribute("aria-label") || "").trim()),
    /* A6c — AT MOST ONE `<mark>`, AND IT IS THE OPEN SHEET.
       THE LAW IS AMENDED BY ONE WORD AND THE AMENDMENT IS THE POINT
       (2026-09-09). It read "exactly one <mark> in the stripe, and its button
       is the only one with aria-pressed=true", and "exactly" was right while
       the chrome was a list of PLACES one of which you were always standing
       in. The table is not a place you opened: it is the page. So when no
       sheet is open the honest reading is that NOTHING in the chrome is
       marked — a mark on the ≡ would say you were inside the menu, and a mark
       on the genre plate would say the globe was open — and when a sheet IS
       open exactly one row wears both channels. `null` is the "no sheet" state
       and the assertion below reads `__eightTabNow()` to know which it should
       be, which keeps this a comparison of two readings of one fact. */
    marks: [...document.querySelectorAll("#nu-chrome mark")]
      .map((m) => (m.closest("button").getAttribute("aria-label") || "").trim()),
    pressed: [...document.querySelectorAll('#nu-chrome button[aria-pressed="true"]')]
      .map((b) => (b.getAttribute("aria-label") || "").trim()),
    /* WHAT THE MARKED MARK SHOULD SAY, if there is one. The open SHEET's own
       row: `Score` / `Video` / `Screensaver` / `Export` in the hamburger, and
       WHERE is the bar's genre plate, whose accessible name is the tab's word
       (its visible word is the record's name — see A6d). */
    open: window.__eightTabNow(),
    want: (() => {
      const t = window.__eightTabNow();
      if (t === "Band") return null;
      const b = document.querySelector('[data-k="toptab-' + t + '"]');
      return b ? (b.getAttribute("aria-label") || "").trim() : null;
    })(),
    barH: +bar.getBoundingClientRect().height.toFixed(1),
    /* THE TOP STRIP'S HEIGHT IS ZERO BY CONSTRUCTION SINCE 2026-09-05
       (TABLE.md §13a.1). `.nu-top` is deleted and <body> reserves nothing at
       the head of the page: the ≡ is the bar's last button and the × is the
       open sheet's own header. It is reported rather than dropped, because
       "the second fixed band is 0" is the claim this round makes. */
    topH: 0,
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
    /* THE FIRST th THAT IS A COLUMN, 2026-09-06. A8's subject is "this pane's
       sticky first COLUMN", and since TABLE.md §10b the Band pane's first `<th>`
       is a MERGED row's — TIME, spanning every column — which has no column to
       be: its width is its containing block's, so a sticky box has nowhere to
       travel and it slid 88 of a 200px scroll the hour the row landed. The
       merged row pins its own LINE instead (`.nu-sphead`, which is the pane's
       width inside a cell that is the table's), and that is a different claim,
       measured by test/table.browser.js T10a. Here the corner is what is asked
       about, exactly as it was before the row existed. */
    const th = [...pane.querySelectorAll("th")].find((x) => x.colSpan === 1) ||
               pane.querySelector("td:first-child");
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
   Mix / Produce / Score / Export."
   ...AND A TENTH, 2026-09-01: "add a major icon and section: Video." It goes
   between Score and Export because those three are the record LOOKED AT rather
   than composed — the staff, the film, and the file you take away — and the
   quotation above is kept whole rather than edited, because it was true when
   he said it and the change is a new sentence, not a correction of the old
   one. This gate stays a QUOTATION either way: it is what the page is measured
   against, so it may only ever move when he moves it.
   ...AND AN ELEVENTH, 2026-09-01: "Bring back the screensaver from stellate
   as a new view like the video view." "Like the video view" places it — beside
   Video, in the looked-at family between Score and Export — and, like Video's
   line above, it is a new sentence added to the list, not an edit of any old
   one. */
/* ...AND A TWELFTH AND A THIRTEENTH, 2026-09-02, both from the composer
   round and both NEW SENTENCES rather than edits of the ten above:
     · *"I click the genre, it starts to play, and there's a new view: A genre
       editor appears. This is the 'Rules' section; it'll need a new icon in
       the left nav."* — `Rules`, straight after `Where`, because it is what a
       genre IS and every other tab is a view of what its rules dealt.
     · *"Sections/Structure has the same challenges. … It should be top level,
       not buried under band, and below band. Bring performance into
       structure."* — `Structure`, directly after `Band`, exactly where he put
       it, in his own words.
   AND ONE OF THE THIRTEEN IS NOT IN THE LIST, which is the first time the tab
   ORDER and the SCREEN POSITION have diverged on this page. Paul, the same
   round: *"Move the play/stop button to the bottom, along with opts and
   where."* So `Where` is a permanent name plate in the FOOT — the answer to
   *"The name of the genre should be obvious"* — and the stripe's scrolling
   list holds the other twelve. The quotation stays whole and stays THE
   quotation: `NAV_ROWS` is derived from it by dropping the one row Paul moved,
   so a tab added to his list is added to the walk by existing, and the fact
   that `Where` left the list is asserted separately, below, where it can be
   read as the claim it is. */
/* ...AND AN AMENDMENT WITH A DATE ON IT, 2026-09-04 (nukernel/TABLE.md §8,
   approved by Paul on 2026-09-03: *"When done, build the table according to
   the spec"*). The list loses two rows and renames two words, and every one of
   those moves is a sentence of the spec rather than a tidy-up:
     · *"Tempo and Key fold into one Time structure."*  -> `Time`
     · *"Motif becomes Motifs and stays."*              -> `Motifs`
     · *"get rid of everything it replaces … Band and Structure are DELETED,
       not hidden."*                                    -> `Structure` goes
   Nothing Structure named left the page: its sections are the Band TABLE's
   rows (children of `Band` in this same stripe), its five grids are the row
   sheet and the cell sheet, and its performance block is the table's footer.
   The 2026-08-27 quotation above is kept whole; this is the amendment under
   it, which is how every previous change to this list was made. */
/* ...AND A SECOND AMENDMENT, 2026-09-06 (nukernel/TABLE.md §10, approved by
   Paul on 2026-09-05). The list loses two more rows, and both are HIS
   sentence: *"we could integrate rules into a special row, time + key into a
   special row … a real mobile app now with everything in the table and the nav
   space reclaimed."* §10b orders the work — TIME first, RULES second — and
   each is a merged row at the top of the Band table's own sheet:
     · `Time`   -> the TIME row  (`ttime`):  the tempo and its nine marks, the
                   meter, the swing, the groove, the breathing, the circle of
                   fifths, the mode, the scale, and the pointer to the board.
     · `Rules`  -> the RULES row (`trules`): `ui/rules.js`'s whole panel — the
                   name plate, the eight axis blocks, every sentence with its
                   control, the palettes and the resets — unchanged, seated.
   `#pan-tempo` and `#rulesdeck` are out of index.html with the two tabs, and
   the Rules branch of the stripe (the eight axis jumps) goes with them: a jump
   link into a row you have already opened is a control that does what the
   scroll you are already doing does. The 2026-08-27 quotation stays whole;
   this is the second amendment under it, made the way the first one was. */
/* ...AND A THIRD AMENDMENT, 2026-09-07 (nukernel/TABLE.md §10b step 3, the
   same approval). The list loses one more row and it is the same sentence
   again — *"then do the same with the mix and produce"*:
     · `Mix`  -> the MIX row: one cell per voice column carrying that player's
                 own channel strip (`tmix|<voice>`), and the MASTER as a merged
                 row under them (`tmix`) whose sheet is the board — the rack,
                 its five stages and the section-automation grid, all inside
                 the `#boardpanel` ui/engineer.js has always built.
   `#deck` is out of index.html with the tab, and the Mix branch of the stripe
   (the five stage rows) goes with it: the five are BUTTONS INSIDE THE BOARD
   again, at the same `boardtab|<kind>|<key>` addresses, because a board whose
   plates can only be switched from a branch of a tab that no longer exists is
   four plates lost. The 2026-08-27 quotation stays whole; this is the third
   amendment under it. */
/* ...AND A SEVENTH AMENDMENT, 2026-09-05 (TABLE.md §13f). Two lines of Paul's,
   and the head of the table reads RULES · TIME · CHORDS · MOTIFS now:
     · *"Put rules above time"* — the rules are what the record IS before a
       hand touches a number, so they stand over the tempo they set. Nothing
       moved but the order: `trules` and `ttime` are the addresses they were,
       and every walk in this file reads the head by `data-special` or by
       `data-k` and not by index.
     · *"Add chords below time and move chord stuff into it"* — a NEW row,
       `tchords`, holding the changes grid, the harmony cycle and the melody
       flag, all MOVED out of the TIME sheet at the addresses they already had
       (`prog<n>d`, `sel|alphabet.quality|bar<n>`, `prog-add`, `prog-cut`,
       `sel|alphabet.harmony`, `diatonic`). Key, mode and scale stay in TIME —
       they are the alphabet a record counts WITH — and so does the board
       pointer, which is TIME's back matter. `test/table-inventory.json` files
       the five under `chords-row`; T7's own walk reads the `open` each names,
       so nothing in this file drives them by hand. */
/* ...AND THE FOURTH AND FIFTH AMENDMENTS, 2026-09-08 (TABLE.md §10b steps 4
   and 5). `Motifs` and `Produce` leave this list the way `Time`, `Rules` and
   `Mix` left it: each is a merged ROW of the Band table now — the bank with
   its previews and provenance above the column heads (`tmotifs`), the
   producer's deals and notes under the mix in the footer (`tproduce`) — and
   `#pan-motif` and `#produce` are out of index.html with the two tabs. Paul's
   2026-08-27 sentence is quoted whole above and is not edited; what these
   amendments record is that five of its nine words are rows of one sheet now,
   which is the sentence he replaced it with on 2026-09-05. */
const PAULS_TABS = ["Where", "Band", "Score", "Video",
                    "Screensaver", "Export"];
/* ...AND THE SIXTH AMENDMENT, 2026-09-09 (TABLE.md §10b steps 6 and 7): the
   TRAY is deleted, so there is no list of tabs on the screen at all. What the
   chrome offers is the HAMBURGER's four — `TABS` minus `Where`, which is the
   bar's genre plate, and minus `Band`, which is the page — and the log under a
   rule. Paul's own sentence for it is *"a hamburger menu for score, video,
   screensaver"*; Export rides with them for the reason Screensaver does. */
const MENU_ROWS = PAULS_TABS.filter((t) => t !== "Where" && t !== "Band");
// how long a tab is given to settle after it is opened. The Score engraves a
// whole record on a promise the first time it is asked; everything else is
// synchronous and the wait is only for layout.
// the Video deck opens a <video> and a WebGL context, so it gets the
// Score's grace rather than the synchronous 600ms
const TAB_SETTLE = (t) => (t === "Score" || t === "Video" ? 1800 : 600);

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
    /* ===== A6d / A6g / A6h — WHAT THE CHROME OFFERS AND WHAT IT CALLS IT ===
       REWRITTEN 2026-09-09 (TABLE.md §10b steps 6 and 7, the tray deleted).
       Paul: *"…then have a hamburger menu for score, video, screensaver, and
       have genre, dice, playstop along the bottom."*

       WHAT A6d ASSERTED AND WHAT SURVIVES. It read the tab words off the
       stripe's ROOT LEVEL and compared them to Paul's own list, in his order.
       There is no root level; the list is the HAMBURGER's, and it is `TABS`
       minus the two rows that are not viewers — `Where` (the bar's genre
       plate, a picker) and `Band` (the table, which is the page). So the words
       are the four Paul named plus Export, in the order the one owner keeps
       them in, read off the RENDERED buttons and never off `__eightMenu()`,
       which would be the page agreeing with itself.
       A6g is the other half and did not change: the word is in the DOM as a
       `.nu-vh`, so the page reads as itself with the stylesheet off.
       AND `__eightUp()` STILL MEANS "PUT THE PAGE BACK WHERE THE TABS ARE",
       which is now close the sheet and shut the menu — the same two taps a
       hand makes, and the same shim its nine callers have always compared
       against "root". */
    await page.evaluate(() => window.__eightUp());
    await page.click("#burger");
    await page.waitForTimeout(200);
    const rowNames = await page.evaluate(() =>
      [...document.querySelectorAll("#nu-menu button")]
        /* THE HEAD OF THE ACCESSIBLE NAME, because the log's carries its
           count — one node, two names, and the one this list is about is the
           SUBJECT's. TWO SHAPES SINCE THE TEXT PASS (2026-09-05): the empty
           form is still "log — nothing yet" and the counted one is "log ({n})",
           so a split on the em dash alone reads "log (1)" back whole and this
           line passes only while nothing has been logged yet. It went red in
           test/text-diet.test.js the same hour, on the same node, for exactly
           that reason. Both suffixes come off. */
        .map((b) => (b.getAttribute("aria-label") || "").trim()
                     .replace(/\s*\(\d+\)\s*$/, "").split(/ — |,/)[0].trim()));
    is(JSON.stringify(rowNames) === JSON.stringify(MENU_ROWS.concat(["log"])),
      "A6d " + width + " · the hamburger is the four viewers and the log, in "
      + "TABS' own order — " + JSON.stringify(rowNames));
    const rowWords = await page.evaluate(() =>
      [...document.querySelectorAll("#nu-menu button")]
        .map((b) => { const v = b.querySelector(".nu-vh, mark .nu-vh");
                      return v ? v.textContent.trim() : null; }));
    is(JSON.stringify(rowWords) === JSON.stringify(MENU_ROWS.concat(["log"])),
      "A6g " + width + " · and every word is still IN the button, so the menu "
      + "reads with the stylesheet off — " + JSON.stringify(rowWords));
    /* ...AND THE GENRE IS A PLATE IN THE BAR, WEARING THE RECORD'S NAME. Paul:
       *"have genre, dice, playstop along the bottom"* and *"The name of the
       genre should be obvious."* The plate keeps the tab's own address
       (`toptab-Where`) because an address does not move when a row does, and
       its WORD is the record's human name rather than the word "Where" —
       which is the whole point of it being there. It is in the BAR and in
       neither the menu nor a list, which is what the third field reads. */
    const plate = await page.evaluate(() => {
      const b = document.querySelector('#nu-bar [data-k="toptab-Where"]');
      if (!b) return null;
      const v = b.querySelector(".nu-vh"), s2 = b.querySelector(".nu-sub2");
      return { word: v ? v.textContent.trim() : null,
               sub: s2 ? s2.textContent.trim() : null,
               inMenu: !!document.querySelector('#nu-menu [data-k="toptab-Where"]') };
    });
    is(!!plate && !plate.inMenu && !!plate.word,
      "A6d " + width + " · …and the genre is a name plate in the BAR, not a "
      + "row in the hamburger — " + JSON.stringify(plate));
    /* ===== A6m — THE GENRE PLATE IS A DOOR, AND A DOOR SHUTS (2026-09-06) ==
       Paul: *"When I tap the button of the bottom left showing the genre close
       the picker and take me back to the compose view."* It called
       `showTab("Where")` unconditionally, so the second press of the button
       that had just opened the picker did nothing at all and the only way back
       was the × at the far corner of the glass.
       THREE THINGS ARE ASSERTED AND THE THIRD IS THE ONE THAT MATTERS. The
       press OPENS (the picker is the one `[data-sheet]` on the page); the same
       press CLOSES (back on `Band`, no sheet, the table drawn — the same
       landing `A6j` demands of every viewer's ×); and CLOSING WRITES NOTHING —
       the record is byte-identical across the round trip, because a way out of
       a picker that spent a slot would be a picker you could not leave without
       paying for it. The button's own state is read off the artifact in both
       halves: `aria-expanded` says what the next press will do, and the
       accessible name stays the record's own word, which is what makes the
       plate worth having in the bar at all (A6d, just above). */
    await page.evaluate(() => window.__eightUp());
    await page.waitForTimeout(150);
    const docWas = await page.evaluate(() => JSON.stringify(window.__eightDoc()));
    const readPlate = () => page.evaluate(() => {
      const b = document.querySelector('#nu-bar [data-k="toptab-Where"]');
      return { tab: window.__eightTabNow(),
               sheets: document.querySelectorAll(".nu-pan[data-sheet]").length,
               table: document.querySelectorAll("#pan-band table").length,
               expanded: b.getAttribute("aria-expanded"),
               controls: b.getAttribute("aria-controls"),
               pressed: b.getAttribute("aria-pressed"),
               label: (b.getAttribute("aria-label") || "").trim(),
               doc: JSON.stringify(window.__eightDoc()) };
    });
    await page.click('#nu-bar [data-k="toptab-Where"]');
    await page.waitForTimeout(700);
    const opened = await readPlate();
    await page.click('#nu-bar [data-k="toptab-Where"]');
    await page.waitForTimeout(700);
    const shut = await readPlate();
    is(opened.tab === "Where" && opened.sheets === 1 &&
       opened.expanded === "true" && opened.pressed === "true" &&
       opened.controls === "atlas" && opened.label === plate.word &&
       shut.tab === "Band" && shut.sheets === 0 && shut.table === 1 &&
       shut.expanded === "false" && shut.pressed === "false" &&
       shut.label === plate.word && shut.doc === docWas,
      "A6m " + width + " · the genre plate opens the picker and the SAME press "
      + "closes it back to the table, with the record untouched — open "
      + JSON.stringify(opened.tab) + "/expanded " + opened.expanded
      + ", shut " + JSON.stringify(shut.tab) + "/expanded " + shut.expanded
      + ", " + shut.table + " table, name " + JSON.stringify(shut.label)
      + ", record " + (shut.doc === docWas ? "byte-identical" : "CHANGED"));
    await page.evaluate(() => window.__eightUp());
    await page.waitForTimeout(150);
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

    /* ===== A6j — THERE IS NO TRAY, AND A VIEWER IS A SHEET WITH A WAY OUT ==
       REWRITTEN 2026-09-09, AND IT IS THE THIRD REWRITE OF THIS LINE. It drove
       `[data-k="trayup"]` up a chain of levels (2026-08-28), then asserted the
       ↑'s ABSENCE at every depth of a tree (2026-09-02), and now asserts the
       absence of the whole apparatus — no `↑`, no `#nu-tray`, no
       `.nu-traylist`, no `.nu-trayfoot`, nothing at a `[data-depth]`. A
       deletion that left one of the five behind would be a second navigation
       standing beside the first, which is the failure every rewrite of this
       check has been about.
       AND WHAT REPLACED IT IS DRIVEN, not assumed: each of the four viewers is
       opened from the hamburger's own button, asserted to be a `[data-sheet]`
       panel over the table with a close that is on the screen, and the close
       is pressed and must land back on the table with the table drawn. That is
       the round trip the ↑ chain used to make, made by the marks a thumb has. */
    const gone = await page.evaluate(() => ({
      up: document.querySelectorAll('[data-k="trayup"]').length,
      tray: document.querySelectorAll("#nu-tray, .nu-tray, .nu-traylist, "
                                      + ".nu-trayfoot, .nu-traycut").length,
      depth: document.querySelectorAll("[data-depth]").length,
    }));
    is(gone.up === 0 && gone.tray === 0 && gone.depth === 0,
      "A6j " + width + " · there is no ↑, no gutter and no depth anywhere on "
      + "the page — " + JSON.stringify(gone));

    const sheets = [];
    for (const word of MENU_ROWS) {
      await page.evaluate(() => window.__eightUp());
      await page.waitForTimeout(120);
      await page.click("#burger");
      await page.waitForTimeout(150);
      await page.click('[data-k="toptab-' + word + '"]');
      await page.waitForTimeout(TAB_SETTLE(word));
      const open = await page.evaluate(() => {
        const c = document.getElementById("sheetclose");
        const pan = document.querySelector(".nu-pan[data-sheet]");
        const r = pan ? pan.getBoundingClientRect() : null;
        /* FULL WIDTH IS THE PAGE'S COLUMN AND NOT THE VIEWPORT'S: a sheet is
           in flow (nu.css carries why), so it is `clientWidth` less the page's
           own two gutters, which is exactly what the table gets. */
        return { tab: window.__eightTabNow(),
                 sheets: document.querySelectorAll(".nu-pan[data-sheet]").length,
                 full: !!r && r.width >= document.documentElement.clientWidth - 30,
                 want: true,
                 close: !!c && !c.hidden && !!c.getClientRects().length,
                 menuShut: !window.__eightMenu().open };
      });
      await page.click("#sheetclose");
      await page.waitForTimeout(600);
      const back = await page.evaluate(() => ({
        tab: window.__eightTabNow(),
        sheets: document.querySelectorAll(".nu-pan[data-sheet]").length,
        table: document.querySelectorAll("#pan-band table").length }));
      sheets.push({ word, open, back });
    }
    const badSheet = sheets.filter((x) =>
      x.open.tab !== x.word || x.open.sheets !== 1 || !x.open.close ||
      !x.open.menuShut || x.open.full !== x.open.want ||
      x.back.tab !== "Band" || x.back.sheets !== 0 || x.back.table !== 1);
    is(badSheet.length === 0,
      "A6j " + width + " · every viewer in the hamburger opens as ONE "
      + "full-width sheet over the table with a close, and the close lands "
      + "back on the table — " + sheets.map((x) => x.word).join(", ")
      + (badSheet.length ? " — BAD " + JSON.stringify(badSheet) : ""));

    /* ===== A6l — THE OPS ARE ON THE TABLE, AND A6k IS RETIRED =============
       A6k asserted ONE OPEN PATH in the tree — open Band, open Score, and the
       first branch is gone. There is no tree and there are no branches: the
       claim it protected (you can never be shown two navigations at once) is
       A6j's `[data-sheet]` count of exactly one, above, which is the same
       sentence about the surface that replaced it. It is retired with its
       reason rather than rewritten into something it never said.

       A6l SURVIVES WHOLE, and it always was the durable one: TABLE.md §9a,
       Paul — *"Move all the nav into the table, I should be able to add
       players without using the nav and sections too."* What it read off the
       stripe was that a player row and a section row had NO CHILDREN; what it
       read off the TABLE was that every op those children used to carry is at
       its own address in the sheet the row opens. The first half is now free
       (there are no rows), so what is driven is the second half, from the
       table's own heads — which is where a thumb has reached them since the
       tray's Band branch became two jump links. A deletion nobody can undo by
       tapping is a lost control, so this reads the rendered table. */
    {
      await page.evaluate(() => window.__eightUp());
      await page.waitForTimeout(120);
      await page.evaluate(() => window.__eightTab("Band"));
      await page.waitForTimeout(TAB_SETTLE("Band"));
      /* THE BOX BOOTS ON THE BLANK STATE (2026-09-02, Paul: *"Add a 'silence'
         genre at the top of the genre list. This is a blank state."*) and a
         blank state has NO PLAYERS, which is the point of it. So the gate
         hires one the way a reader does, and since 2026-09-05 (TABLE.md §13e,
         Paul: *"Don't pop up an interface when I add a section or a voice.
         Just add it."*) that is ONE tap on the head's `+`, which CARRIES the
         address of the hire it will make — `tcol-add|` and the first kind the
         band has not got. The three adder buttons that stood in the head row
         took 22ch of a phone; the `+` takes `--tap`. */
      const anyCol = await page.$('#pan-band th.nu-colhead button');
      if (!anyCol) {
        const add = await page.$('#pan-band thead th.nu-plushead .nu-plusbtn');
        if (add) { await add.click(); await page.waitForTimeout(900); }
      }
      const head = await page.$('#pan-band th.nu-colhead button[data-k^="tcol|"]');
      if (head) {
        /* THE NAME IS READ OFF THE HEAD BEFORE THE TAP, not off an
           `aria-expanded` after it: the head is a TOGGLE and the sheet it
           opens is a row of the `<tbody>`, so which button carries the open
           state is the accordion's business and not this check's. What is
           asserted is that the ops for THIS player are on the page once its
           own head has been pressed. */
        /* IT IS OPENED IDEMPOTENTLY, WHICH IS `__eightRow`'S OWN DISCIPLINE
           AND WAS MEASURED HERE (2026-09-09). A head is a TOGGLE, and
           `tablePanel` lands an arrival by CLICKING the head it wants open —
           so a head may already be open when this arrives and a gate that
           presses it once would have shut it. (A HIRE no longer lands at all
           since 2026-09-05 — TABLE.md §13e, Paul: *"Just add it."* — so the
           discipline now stands for every other arrival rather than for this
           one; it is kept because it is what makes the tap idempotent.) Measured: `{"name":"line 1",
           "del":false}` at all four widths, with the sheet standing open in
           the frame before the tap. */
        const name = await page.evaluate((h) => h.dataset.k.slice(5), head);
        if (await page.evaluate((h) => h.getAttribute("aria-expanded") !== "true",
                                head)) await head.click();
        await page.waitForTimeout(500);
        const rdel = await page.evaluate((name) => ({ name,
          del: !!document.querySelector(
            '#pan-band [data-k="' + CSS.escape("tcol-del|" + name) + '"]') }),
          name);
        /* ...AND THE THREE HIRES ARE IN THAT SAME SHEET (2026-09-05, §13e).
           They spent an afternoon behind a `+` and an ADD sheet — two taps
           from rest — and the sheet is deleted: each `+` fires ONE offer now
           (the head's, the kind the band has not got), so the place that holds
           all three whatever the record already has is `colOps`, the sheet
           this player's own column head has just opened. One tap from rest,
           beside the player's own `remove`. */
        const r = Object.assign({}, rdel, await page.evaluate(() => {
          const at = (k) => !!document.querySelector(
            '#pan-band [data-k="' + CSS.escape(k) + '"]');
          return { hire: ["line", "bass", "drums"]
                     .filter((k) => at("tcol-add|" + k)).length }; }));
        is(!!r.name && r.del && r.hire === 3,
          "A6l " + width + " · a player's `remove` AND the three hires are in "
          + "the sheet its own column head opens, one tap from rest; the `+` "
          + "at the head of the axis fires the one the band has not got — "
          + JSON.stringify(r));
        const rowHead = await page.$('#pan-band th.nu-srowh button[data-k^="trow|"]');
        if (rowHead) {
          const rowId = await page.evaluate((h) => h.dataset.k.slice(5), rowHead);
          if (await page.evaluate((h) => h.getAttribute("aria-expanded") !== "true",
                                  rowHead)) await rowHead.click();
          await page.waitForTimeout(600);
          const rs0 = await page.evaluate((id) => {
            const at = (k) => !!document.querySelector(
              '#pan-band [data-k="' + CSS.escape(k) + '"]');
            return { id,
                     ops: ["trow-up|", "trow-down|", "trow-dup|", "trow-del|"]
                       .filter((k) => at(k + id)).length };
          }, rowId);
          /* `+ section` IS IN THIS SHEET AND ON THE GRID'S FOOT (§13e): the
             row sheet's own `rowOps` carries `trow-add`, and so does the `+`
             row at the foot of the grid, which fires it on the tap. One
             address, two places a thumb can be. */
          const rs = Object.assign({}, rs0, await page.evaluate(() => ({
            add: !!document.querySelector('#pan-band [data-k="trow-add"]'),
            plus: !!document.querySelector(
              '#pan-band tbody tr.nu-addrow th .nu-plusbtn[data-k="trow-add"]')
          })));
          is(!!rs.id && rs.ops === 4 && rs.add && rs.plus,
            "A6l " + width + " · …and a section's four operations plus "
            + "`+ section` are on the table at their own addresses, the last "
            + "of them on the `+` at the grid's foot — "
            + JSON.stringify(rs));
          /* AND IT SHUTS THE DOOR IT OPENED (2026-09-05). A6l opens a column
             head and then a row head to read the ops inside each, and the
             accordion keeps one of them open: a section's sheet seats the
             CHORD CHART, which is a second `<table>` in this pane, and A5b
             (*"one table per pane"*) measured the Band tab a few lines later
             and reported it nested, four times over. It was invisible until
             2026-09-05 only because a hire USED to land on the new player and
             replace this sheet with a column's (TABLE.md §13e deletes that
             landing). A gate that opens a door closes it. */
          if (await page.evaluate((h) => h.getAttribute("aria-expanded") === "true",
                                  rowHead)) await rowHead.click();
          await page.waitForTimeout(400);
        } else skip(width + " · no section row head for A6l");
      } else skip(width + " · no player column head for A6l");
    }

    // THE KIT GRID IS THE WIDEST THING THIS PAGE DRAWS and the default record
    // has no drummer, so a gate that does not add one never measures it.
    // ...AND THE BUTTON THAT HIRES ONE IS INSIDE THE BAND TAB since 2026-08-27,
    // so the tab is opened first. Before this line the gate found no such
    // button on the tabbed page and skipped at all four widths.
    // ...AND IT IS THE TABLE'S OFFER SINCE 2026-09-05 (TABLE.md §9a, "no op
    // lives in the nav"): `adddrums` was a row in the Band branch of the
    // stripe and is `tcol-add|drums`, which is the address the T7 inventory
    // filed it onto the day the ops left the tray. It spent one afternoon
    // inside an ADD sheet (§13a.5); since TABLE.md §13e the head row's `+` IS
    // that address on a record with no drummer, which is this one, so the hire
    // is one tap and the address has not moved.
    await page.evaluate(() => window.__eightTab("Band"));
    await page.waitForTimeout(TAB_SETTLE("Band"));
    /* ...AND IT ONLY HIRES WHERE THERE IS NO DRUMMER. The `+` carries the
       kind the band has NOT got, so on a record that already has a kit
       `tcol-add|drums` is not on the table at all — it is in any column
       head's sheet — and a gate that read its absence as "no offer" would
       skip the widest thing this page draws on the one record that has it. */
    const hasKit = await page.evaluate(() =>
      (window.__eightDoc().voices || []).some((v) => v.kind === "drums"));
    const add = hasKit ? null : await page.$('#pan-band [data-k="tcol-add|drums"]');
    if (add) { await add.click(); await page.waitForTimeout(1200); }
    else if (!hasKit)
      skip(width + " · no [data-k=tcol-add|drums] button — the kit grid was not measured");

    for (const tab of tabs) {
      await page.evaluate((t) => window.__eightTab(t), tab);
      await page.waitForTimeout(TAB_SETTLE(tab));
      const at = width + "/" + tab;
      const s = await page.evaluate(SURVEY);
      console.log("[" + at + "] scroll " + s.scrollWidth + "/" + s.clientWidth
        + " · h" + s.scrollHeight + " · trays " + s.trays + " · axes " + s.axes
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
      /* A7 — the promise `--bar-h` makes to the whole page's flow, which is
         the promise `--tray-w` made and the promise the FIRST `--bar-h` made
         before it. `body { padding-block-end: calc(var(--bar-h) + var(--s3)) }`
         is the whole of "nothing goes under the bar" (nu.css), so a `.nu-bar`
         a pixel taller than its token is a bar standing on the page, and a
         second `.nu-bar` is the second row A6b already forbids by geometry. */
      if (s.bars !== 1) fail("A7 " + at + " · exactly one .nu-bar (found " + s.bars + ")");
      else is(Math.abs(s.barH - s.barVar) <= 0.5,
        "A7 " + at + " · the bar is " + s.barH + "px, --bar-h resolves to "
        + s.barVar + "px");
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

      /* A6 / A6b / A6c — THE BAR, SWEPT DOWN THIS SURFACE'S WHOLE HEIGHT.
         It is `position: fixed`, so there is no pin point to wait for and
         EVERY stop is a stop the bar is asked about, scrollY 0 included. The
         claim turned ninety degrees with the chrome (2026-09-09): the gutter's
         "top 0 and never moves" is the bar's "bottom is the viewport's bottom,
         left is 0, width is the page's own width, and none of the three moves
         over the whole scroll". */
      const b = await page.evaluate(BANDS);
      const x0 = b.stops[0].barLeft;
      const badBar = b.stops.filter((t) =>
        Math.abs(t.barBottom - t.wantBottom) > 0.5 ||
        Math.abs(t.barLeft - x0) > 0.5 || x0 !== 0 ||
        Math.abs(t.barWidth - t.wantWidth) > 0.5);
      const end = b.stops[b.stops.length - 1].y;
      is(badBar.length === 0,
        "A6 " + at + " · over " + b.stops.length + " stops to y=" + end
        + ": the bar is fixed at the foot, full width (" + b.barH
        + "px tall, x=" + x0 + ")"
        + (badBar.length ? " — bar off at " + JSON.stringify(badBar.slice(0, 3)) : ""));
      is(b.stickyHeads.length === 0,
        "A6 " + at + " · no axis heading is sticky any more — the navigation "
        + "is a fixed bar" + (b.stickyHeads.length ? " — " + b.stickyHeads.join(", ") : ""));
      is(b.barScroll[0] === b.barScroll[1] && b.barRows === 1,
        "A6b " + at + " · the bar is ONE row and never scrolls sideways ("
        + b.barScroll[0] + " vs " + b.barScroll[1] + ", " + b.barRows + " row)");
      /* A6c — AT MOST ONE MARK, AND IT IS THE OPEN SHEET. See the note in
         BANDS: "exactly one" was a law about a chrome that was a list of
         places; the table is the page and not one of them, so standing on it
         is the state in which nothing is marked. Both channels still agree,
         which is the half that has never moved. */
      is(b.marks.length === b.pressed.length &&
         b.marks.length === (b.want == null ? 0 : 1) &&
         (b.want == null || (b.marks[0] === b.want && b.pressed[0] === b.want)),
        "A6c " + at + " · on \"" + b.open + "\" the chrome wears "
        + b.marks.length + " <mark> and " + b.pressed.length
        + " aria-pressed, and they say " + JSON.stringify(b.want)
        + " (marks " + JSON.stringify(b.marks) + ", pressed "
        + JSON.stringify(b.pressed) + ")");
      /* A6i — NOTHING GOES UNDER THE BAR (or under the top strip). Paul,
         2026-08-28: *"Dont let anything go under it."* The sentence is about
         the gutter and it is the same sentence about the bar: the chrome's
         height is taken OUT of the page (nu.css, `body { padding-block-end }`
         and `padding-block-start`), so this is a claim about FLOW and not
         about z-index — no laid-out block overlaps either band.

         IT NO LONGER KNOWS WHICH EDGE THE CHROME IS ON, and that generality is
         what let this check survive the chrome moving twice: it was written
         for a gutter on the right, kept working when the gutter went left, and
         now reads two horizontal bands with nothing here to edit. Boxes are
         not descended into past a clipper (an `<svg>` viewport, an `overflow:
         auto` pane): their contents run past on purpose and are not painted
         there, so what is asserted is that the CLIPPER is inside the page.
         (ui/glyph.js `place()` and nu.css `.nu-strip-out` are the page's own
         two versions of the same lesson.) */
      /* IT IS MEASURED AT TWO SCROLL POSITIONS AND THAT IS WHAT THE TURN
         COST (2026-09-09). A vertical gutter is beside the page at every
         scroll, so one reading answered it; a horizontal bar is at the FOOT of
         the viewport, and any page taller than the screen crosses that band in
         viewport coordinates while you are half way down it — measured, the
         first draft failed on `#app@55.2-1280.5`, which is a 1280px-tall
         column doing exactly what a scrolling page does. What "nothing goes
         under it" MEANS about a foot bar is that the page RESERVES the room:
         at the END of the scroll the last block stops above the bar. So the
         sweep runs at scrollY = max for the bar's band and at scrollY = 0 for
         the top strip's, which is where each band's own claim is decidable. */
      const G = await page.evaluate(async () => {
        const raf = () => new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)));
        const chrome = document.getElementById("nu-chrome");
        const clips = (cs, c) => c.tagName.toLowerCase() === "svg" ||
          ["hidden", "auto", "scroll", "clip"].includes(cs.overflowX);
        const sweep = (t) => {
          const bad = [];
          const walk = (n) => { for (const c of n.children) {
            if (c === chrome || c.id === "nu-say") continue;
            const cs = getComputedStyle(c);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            /* THE SCREEN-READER BOXES ARE NOT ON THE SCREEN (2026-08-30,
               kept): the sr-only recipe is 1x1px with `clip-path: inset(50%)`
               and a negative margin, so nothing is painted there. Skipped the
               way display:none is. */
            if (cs.clipPath && cs.clipPath.indexOf("inset") === 0
                && parseFloat(cs.width) <= 1 && parseFloat(cs.height) <= 1) continue;
            const r = c.getBoundingClientRect();
            if (!r.width && !r.height) continue;
            /* ...AND A SHEET IS NOT UNDER THE CHROME, IT IS BEHIND IT. A
               `.nu-pan[data-sheet]` is `position: fixed; inset: 0` — the whole
               viewport by construction — and it reserves both bands INSIDE
               itself with padding, exactly as <body> does. The walk descends
               into it and judges its contents, which is the same rule one line
               up makes about a clipper. Anything else `position: fixed` is
               chrome by definition and is judged the same way. */
            const own = cs.position === "fixed" ||
                        (c.hasAttribute && c.hasAttribute("data-sheet"));
            if (!own &&
                r.bottom > t.top + 0.5 && r.top < t.bottom - 0.5 &&
                r.right > t.left + 0.5 && r.left < t.right - 0.5)
              bad.push((c.id || String(c.className) || c.tagName)
                       + "@" + r.top.toFixed(1) + "-" + r.bottom.toFixed(1));
            if (!clips(cs, c)) walk(c); } };
          walk(document.body);
          return bad;
        };
        const y0 = window.scrollY;
        const max = Math.max(0, document.documentElement.scrollHeight
                                - window.innerHeight);
        window.scrollTo(0, 0); await raf();
        /* ONE BAND SINCE 2026-09-05 (TABLE.md §13a.1). `.nu-top` was a fixed
           plate at the top corner and <body> reserved `--top-h` under it; both
           are deleted, so the only chrome anything can be under is the bar. The
           query is kept as a null so the claim reads as "there was a second
           band and there is not", and it is asserted at zero below. */
        const top = document.querySelector(".nu-top");
        const badTop = top ? sweep(top.getBoundingClientRect()) : [];
        window.scrollTo(0, max); await raf();
        const barR = document.getElementById("nu-bar").getBoundingClientRect();
        const badBar = sweep(barR);
        window.scrollTo(0, y0); await raf();
        const bad = badTop.concat(badBar);
        return { bands: [top ? [0, +top.getBoundingClientRect().bottom.toFixed(1)] : null,
                         [+barR.top.toFixed(1), +barR.bottom.toFixed(1)]],
                 max, over: bad.slice(0, 5), overN: bad.length };
      });
      is(G.overN === 0,
        "A6i " + at + " · nothing under the chrome — its two bands are "
        + JSON.stringify(G.bands) + " and no block overlaps either"
        + (G.overN ? " — " + G.overN + " over: " + G.over.join(", ") : ""));
    }

    /* A6e — A TAB REMEMBERS ITS SCROLL, and it is measured on the two tallest
       tabs this record has rather than on a pair chosen by name: a tab with no
       scroll to lose cannot prove anything about losing it. The scroll is set
       with `window.scrollTo`, never with an element click — Playwright's own
       scroll-into-view centres its target and would manufacture the number
       being measured (ui/eight.js ANCHOR_MAX carries that finding).

       AND IT ASKS EACH TAB FOR A DEPTH THAT TAB HAS (rewritten 2026-08-29).
       IT READ: `out.filter((x) => x[1] > 200)` … `window.scrollTo(0, 220)` …
       `is(walk.a2 === walk.a1 && walk.b2 === 220)` — two typed numbers, 200
       and 220, from a page that was 110px taller at the top of every tab.
       Paul's 2026-08-29 round deleted `<h1 id="title">` and the whole `.nu-bar`
       (see A6/A7) and every panel came up that much shorter, which broke this
       line in both directions at once: at 820 the Mix tab's whole scroll is
       218px, so `scrollTo(0, 220)` landed at 218, came back at 218, and was
       reported as a memory failure against a number the tab could not reach —
       and at 320/375/430 only ONE tab was left over 200, so the check skipped
       and asserted nothing at three of the four widths.
       So the depth is now a fraction of the tab's OWN scroll, measured at the
       moment it is set, and the claim is `came back where it was left` rather
       than `came back at 220`. The floor comes down with it: a tab that can
       scroll at all is a tab that can forget, and `b0 > 0` is asserted so the
       check can never pass by leaving both tabs at the top. */
    const tall = await page.evaluate(async (settle) => {
      const out = [];
      for (const t of window.__eightTabs()) {
        window.__eightTab(t);
        await new Promise((r) => setTimeout(r, settle));
        out.push([t, document.documentElement.scrollHeight - window.innerHeight]);
      }
      return out.filter((x) => x[1] > 40).sort((a, b) => b[1] - a[1]).slice(0, 2);
    }, 350);
    if (tall.length < 2) skip("A6e " + width + " · fewer than two scrollable tabs");
    else {
      const [A, B] = tall.map((x) => x[0]);
      const walk = await page.evaluate(async ([A, B]) => {
        const go = async (t) => { window.__eightTab(t);
          await new Promise((r) => setTimeout(r, 350)); };
        /* six tenths of whatever THIS tab can scroll, read back off the window
           rather than assumed: a browser clamps a scroll it cannot make and a
           gate that did not read the clamp was asserting about a pixel that
           does not exist on the page. */
        const put = async () => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, Math.round(max * 0.6));
          await new Promise((r) => setTimeout(r, 150));
          return Math.round(window.scrollY);
        };
        await go(A); const a1 = await put();
        await go(B); const b1 = Math.round(window.scrollY);
        const b0 = await put();
        await go(A); const a2 = Math.round(window.scrollY);
        await go(B); const b2 = Math.round(window.scrollY);
        return { a1, b1, b0, a2, b2 };
      }, [A, B]);
      is(walk.a2 === walk.a1 && walk.b2 === walk.b0 && walk.b0 > 0,
        "A6e " + width + " · " + A + " left at " + walk.a1 + " came back at "
        + walk.a2 + "; " + B + " left at " + walk.b0 + " came back at " + walk.b2
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
