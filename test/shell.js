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
//   A5c no `.nu-pane` wraps a rotated step grid (`table.nu-grid`) THAT FITS —
//       the exact unnecessary scroll container named above, kept out by name.
//       (WAS "no `.nu-pane` wraps a rotated step grid" full stop, until
//       2026-09-03: the drum editor offers the whole twelve-lane kit now and a
//       twelve-lane grid is 454px against a 224px deck at 320px. A grid that
//       genuinely spills takes the same pane A5 demands of every other table;
//       what stays banned is a scroller around a grid that cannot scroll,
//       which is the one Paul reported catching his gestures.)
//   A6  THERE IS NO STICKY BAND LEFT, AND THE NAVIGATION IS A FIXED GUTTER
//       (rewritten 2026-08-29). This check has been rewritten three times and
//       every rewrite was forced by Paul moving the navigation, so all of them
//       are kept.
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
//       IT THEN READ (2026-08-28, the fixed gutter): "over the whole height of
//       every tab, `.nu-bar` sits at 0 once it has pinned, the stripe sits at
//       viewport top 0 and never moves, and no `.nu-ax > h2` is `position:
//       sticky` anywhere — the half that proves the old bands went rather than
//       being drawn twice."
//       Paul, 2026-08-29: *"Get rid of the play buttons and the title of the
//       song"* / *"Add a permanent play button to the top of the nav."* THE
//       BAND IS DELETED — `.nu-bar` and `<h1 id="title">` with it, tombstoned
//       in index.html and in nu.css at THE .nu-bar IS GONE — and the transport
//       is a level of the gutter. So the first half of the sentence had no
//       subject: measured against the shipped page, `document.querySelector(
//       ".nu-bar")` was null and this gate did not fail, it THREW ("Cannot
//       read properties of null (reading \'getBoundingClientRect\')") and
//       stopped the run at the first tab.
//       SO THE CLAIM IS WHAT SURVIVED THE DELETION, AND IT IS THE STRONGER
//       HALF: over the whole height of every tab, at eleven stops from 0 to
//       the bottom, the stripe sits at viewport top 0 and never moves — it is
//       `position: fixed`, so there is no pin point to wait for and EVERY stop
//       is asserted rather than only the ones past a pin — and no `.nu-ax >
//       h2` is `position: sticky` anywhere, which is the half that proves both
//       old bands went rather than being drawn twice.
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
//   A7  ONE GUTTER, AND IT IS EXACTLY --tray-w WIDE (rewritten 2026-08-29).
//       IT READ: "the .nu-bar is exactly --bar-h tall. `.nu-tabs { top:
//       var(--bar-h) }` is a promise about a number, and a fifth control in
//       the bar that wrapped would open a gap under the tab row that nothing
//       else would catch." (And before that: "`.nu-ax > h2 { top: var(--bar-h)
//       }` — the creditor of the promise moved on 2026-08-27; the promise did
//       not.")
//       THE BAND IS GONE ON PURPOSE (Paul, 2026-08-29 — see A6), so this line
//       was measuring furniture that had been deleted: against the shipped
//       page it failed thirty-six times with "exactly one .nu-bar (found 0)",
//       which is a stale gate and not a regression.
//       WHAT IT WAS EVER FOR: the page's chrome EXISTS, there is exactly ONE
//       of it, and it is the size the stylesheet declares — because the rest
//       of the layout is arithmetic on that number. All three are still
//       promises and the number is `--tray-w` now: `body { padding-inline:
//       calc(var(--gl) + var(--tray-w)) --gr }` is the whole of "nothing goes
//       under the gutter" (nu.css), so a `.nu-tray` a pixel wider than its
//       token is a stripe standing on the page, and a second `.nu-tray` is the
//       second stripe A6b already forbids by geometry.
//       SO: exactly one LAID-OUT `.nu-tray`, and its border box is `--tray-w`
//       wide, on every tab at every width. The token is `calc(56px +
//       env(safe-area-inset-left, 0px))` — a substitution, not a computed
//       length, so `getPropertyValue` hands back the calc() text — and it is
//       therefore RESOLVED BY THE PAGE off a probe element rather than parsed
//       here or typed as 56.
//       IT DOES NOT RE-TEST THE TRANSPORT. That `#play` is in `.nu-trayhead`
//       at every level, and what pressing it does, is test/gutter.js T2/T3.
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
    /* A7 — THE GUTTER, WHICH IS WHAT `bars` / `barH` / `barVar` COUNTED
       UNTIL 2026-08-29. They read `.nu-bar` and `--bar-h`; the band is
       deleted and the chrome that carries the same promise is `.nu-tray` at
       `--tray-w`. `trays` is filtered by `shown` like everything else here,
       so a stripe that is on the page but not laid out is not one. */
    trays: all(".nu-tray").length,
    axes: all(".nu-ax").length,
    panes: all(".nu-pane").length,
    grids: all(".nu-grid").length,
    trayW: document.querySelector(".nu-tray")
      ? +rect(document.querySelector(".nu-tray")).width.toFixed(2) : null,
    /* THE TOKEN, RESOLVED BY THE PAGE. `--tray-w` is `calc(56px +
       env(safe-area-inset-left, 0px))`, and an unregistered custom property
       is a token stream: `getPropertyValue("--tray-w")` returns that calc()
       text, which `parseFloat` reads as NaN. So the page is asked what the
       declaration MEANS — one off-screen `box-sizing: border-box` div whose
       inline-size IS `var(--tray-w)`, measured and removed — which keeps the
       notch in the answer and keeps the number out of this file. (The old
       `barVar` could be parsed because `--bar-h` was a bare length; that is
       the only reason it worked, not a rule.) */
    trayVar: (() => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;left:-9999px;top:0;" +
        "block-size:1px;inline-size:var(--tray-w);box-sizing:border-box";
      document.body.appendChild(probe);
      const w = +rect(probe).width.toFixed(2);
      probe.remove();
      return w;
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
  const row = document.getElementById("nu-tray");
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo(0, 0);
  await raf();
  const pinRow = 0;
  const out = [];
  for (let k = 0; k <= 10; k++) {
    window.scrollTo(0, Math.round(max * k / 10));
    await raf();
    /* `rowLeft` joins `rowTop` on 2026-08-29: "fixed" is a claim about both
       axes and the stripe changed edges once already (nu.css, THE GUTTER MOVED
       TO THE LEFT). What is asserted is that it does not MOVE under the
       scroll, so the left is compared against its own first reading rather
       than against a side typed here. */
    out.push({ y: window.scrollY,
      rowPinned: window.scrollY >= pinRow,
      rowTop: +row.getBoundingClientRect().top.toFixed(1),
      rowLeft: +row.getBoundingClientRect().left.toFixed(1),
      want: 0 });
  }
  window.scrollTo(0, 0);
  await raf();
  return {
    stops: out, pinRow,
    // the half that proves the old bands GONE rather than drawn twice
    stickyHeads: [...document.querySelectorAll(".nu-ax > h2, #atlas > h2")]
      .filter((h) => getComputedStyle(h).position === "sticky")
      .map((h) => h.textContent.trim()),
    // …and that the stripe itself never scrolls sideways, and is ONE column
    // (A6b). The list is the scroller; the <nav> is the frame.
    rowScroll: (() => { const l = document.querySelector(".nu-traylist");
      return [l.scrollWidth, l.clientWidth]; })(),
    /* ON THE PAGE, OR NOT COUNTED (2026-09-02) — this file's own `shown()`
       rule, which every other measurement here already obeys and which this
       one did not need until today. The play options are seated in the foot
       permanently and FOLDED when the door is shut (Paul: *"Move the play/stop
       button to the bottom, along with opts and where"*), so three buttons are
       in the DOM at every moment and laid out only when a hand opens them — a
       `display: none` button reports left 0, which is a second distinct left
       and a "two column" stripe that no eye could ever see. The claim is
       unchanged and is about what a reader meets: every mark that is ON the
       page shares one left. */
    /* ...AND ONE MARK MADE OF TWO TARGETS IS NOT A SECOND COLUMN
       (2026-09-03). Paul: *"Instead of a popup for seed, just get rid of the
       word seed and put the number. I tap the die and there's a new number. I
       tap the number and I can enter a new number by hand."* The seed's word
       stood in column 2 of the mark's own grid (`.nu-ic` is glyph + word) and
       the number stands exactly where it stood — the difference is that it is
       now pressable, which the DOM cannot express inside another button. What
       A6b is FOR is Paul's "one vertical stripe max": a second COLUMN OF MARKS
       is a second stripe. `.nu-seedrow`'s two targets are one mark and are
       counted as one — the die's left, which is the stripe's — and the row is
       asserted to stay inside the gutter by A6i like everything else. */
    rowCols: (() => { const lefts = new Set();
      for (const b of row.querySelectorAll("button")) {
        if (!b.getClientRects().length) continue;
        const box = b.closest(".nu-seedrow") || b;
        lefts.add(Math.round(box.getBoundingClientRect().left));
      }
      return lefts.size; })(),
    /* READ OFF `aria-label` AND NOT OFF THE TEXT, 2026-08-28. The ten tabs
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
    /* `if (T.level === "root") return window.__eightTabNow()` STOOD HERE and
       it was exact while the root level was the tab row: the marked mark WAS
       the open tab and its name WAS the tab's word. Neither is true now
       (2026-09-02): the open tab may be `Where`, whose mark is the foot's name
       plate and whose word is the RECORD's name; and with several branches
       open the marked row is the deepest open thing inside the open tab, not
       the tab row. `__eightTray().on` is the one answer to "which mark is the
       marked one", it is what `paintTray` paints from, and reading it here is
       what makes this a comparison of two readings of one fact rather than a
       gate reciting the page back to itself. */
    now: (() => { const T = window.__eightTray();
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
    /* (`headSays` STOOD HERE — the ↑'s own `data-say`, "up — out of psalm,
       back to the motifs", which was A6c's answer to "what says where you are
       on a level that marks nothing". There is no ↑ and there is no level; the
       marked ancestor row is the answer now, and it is on the screen the whole
       time, which is what the 2026-08-28 refusal of a disabled ↑ said the
       marked mark would be.) */
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
                   fifths, the mode, the scale, the harmony, the diatonic line,
                   the changes, and the pointer to the board.
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
const PAULS_TABS = ["Where", "Motifs", "Band",
                    "Produce", "Score", "Video",
                    "Screensaver", "Export"];
const NAV_ROWS = PAULS_TABS.filter((t) => t !== "Where");
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
    /* `__eightUp()` IS "FOLD EVERYTHING" NOW (2026-09-02). It was the ↑
       pressed until there was no ↑ left; there is no ↑ (Paul: *"We should
       never need the 'up' icon because we can expand multiple levels of
       interface option"*), and what the nine callers of it have always meant
       is "put the stripe back where the tabs are". On a tree that is folding
       every open branch, which leaves exactly the twelve rows this reads. */
    await page.evaluate(() => window.__eightUp());
    const rowNames = await page.evaluate(() =>
      [...document.querySelectorAll(".nu-traylist button")]
        .map((b) => (b.getAttribute("aria-label") || "").trim()));
    is(JSON.stringify(rowNames) === JSON.stringify(NAV_ROWS),
      "A6d " + width + " · twelve rows, Paul's words, Paul's order — "
      + JSON.stringify(rowNames));
    const rowWords = await page.evaluate(() =>
      [...document.querySelectorAll(".nu-traylist button")]
        .map((b) => { const v = b.querySelector(".nu-vh, mark .nu-vh");
                      return v ? v.textContent.trim() : null; }));
    is(JSON.stringify(rowWords) === JSON.stringify(NAV_ROWS),
      "A6g " + width + " · and every word is still IN the button, so the row "
      + "reads with the stylesheet off — " + JSON.stringify(rowWords));
    /* ...AND THE THIRTEENTH IS IN THE FOOT, WEARING THE RECORD'S NAME. Paul:
       *"Move the play/stop button to the bottom, along with opts and where"*
       and *"The name of the genre should be obvious."* The plate keeps the
       tab's own address (`toptab-Where`) because an address does not move when
       a row does, and its WORD is the record's human name rather than the word
       "Where" — which is the whole point of moving it. */
    const plate = await page.evaluate(() => {
      const b = document.querySelector('.nu-trayfoot [data-k="toptab-Where"]');
      if (!b) return null;
      const v = b.querySelector(".nu-vh"), s2 = b.querySelector(".nu-sub2");
      return { word: v ? v.textContent.trim() : null,
               sub: s2 ? s2.textContent.trim() : null,
               inList: !!document.querySelector('.nu-traylist [data-k="toptab-Where"]') };
    });
    is(!!plate && !plate.inList && !!plate.word,
      "A6d " + width + " · …and Where is a name plate in the foot, not a row "
      + "in the list — " + JSON.stringify(plate));
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
    /* ===== A6j / A6k / A6l — THE WALK IS AN EXPAND/COLLAPSE NOW ==========
       REWRITTEN 2026-09-02. Paul: *"we should really work hard on nesting
       options inside the left nav … We should never need the 'up' icon because
       we can expand multiple levels of interface option."*

       WHAT THE THREE OF THEM ASSERTED, and every one of these claims survives
       in a form a tree can make:
         · A6j drove `[data-k="toptab-<word>"]` and then `[data-k="trayup"]` up
           to four times, asserting the exact chain of LEVELS a tab descends
           into and climbs out of, plus "there is no ↑ at the root — it is
           absent, not a dead button". The chain is gone with the levels; the
           ABSENCE of ↑ is now a claim about the whole page rather than about
           the root, and it is stronger for it.
         · A6k drove a mark one level FURTHER in (`tabform` → a section →
           `secup/secdown/secdrop`) and climbed back. Descending is expanding
           and climbing is folding, and both are the SAME mark pressed twice —
           which is the sentence Paul's instruction is made of.
         · A6l (2026-09-01, and the newest of the three) opened a voice and
           asserted the four facets arrived as `.nu-sub` rows at the band level,
           the voice wearing `aria-expanded`, one <mark> still on the page. That
           is exactly this wave's claim with `subs === 4` and `.nu-sub` swapped
           for a DEPTH — which is what "the 'ghosted' sections are doubling UX
           elements" replaced them with. */
    const nowT = () => page.evaluate(() => window.__eightTree());
    /* THE BOX BOOTS ON THE BLANK STATE NOW (2026-09-02, Paul: *"Add a
       'silence' genre at the top of the genre list. This is a blank state."*)
       and a blank state has NO PLAYERS — which is the point of it. The three
       walks below are about what a MEMBER row does, so the gate hires one, the
       way a reader would: the `+ line` mark in the Band branch. Said out loud
       rather than done quietly, because "there is a voice to open" was an
       assumption this file made for free until today. */
    await page.evaluate(() => window.__eightUp());
    await page.waitForTimeout(100);
    await page.click('[data-k="toptab-Band"]');
    await page.waitForTimeout(TAB_SETTLE("Band"));
    /* ...AND THE HIRE IS ON THE TABLE SINCE 2026-09-05 (TABLE.md §9a). The
       stripe's `addvoice` went with the rest of the Band branch's ops; the
       offer it filed onto is the adder cell at the end of the player axis,
       `tcol-add|line`, which is build-the-band's own address and is in the DOM
       whenever the Band pane is drawn. */
    if (!(await page.$('[data-k="tabvoice2"]')) &&
        !(await nowT()).rows.some((r) => r.depth === 1 && /^tab/.test(r.key))) {
      const add = await page.$('#pan-band [data-k="tcol-add|line"]');
      if (add) { await add.click(); await page.waitForTimeout(900); }
    }
    const anyUp = await page.$('[data-k="trayup"]');
    is(!anyUp, "A6j " + width + " · there is no ↑ anywhere on the page — it is "
      + "absent, not a dead button, and not at any depth");

    /* A6j — A TAB EXPANDS, AND PRESSING IT AGAIN FOLDS. Five tabs have
       children and the arrival opens them; the sixth press folds them back.
       Driven through the BUTTONS, exactly as the ↑ walk was, because a gate
       that expanded with `__eightExpand` would be proving the probe agrees
       with itself. */
    const walk = [];
    /* THREE, NOT FOUR, SINCE 2026-09-07: `Mix` was the fourth and the Mix tab
       is deleted (TABLE.md §10b step 3 — the board is the MIX row's master in
       the Band table, and its five stage buttons are inside the board again).
       The claim is about a tab WITH CHILDREN and the page has three of them. */
    for (const word of ["Band", "Motifs", "Score"]) {
      await page.evaluate(() => window.__eightUp());
      await page.waitForTimeout(120);
      await page.click('[data-k="toptab-' + word + '"]');
      await page.waitForTimeout(TAB_SETTLE(word));
      const open = await nowT();
      await page.click('[data-k="toptab-' + word + '"]');
      await page.waitForTimeout(300);
      const shut = await nowT();
      walk.push({ word,
        kids: open.rows.filter((r) => r.depth === 1).length,
        exp: open.expanded.indexOf("toptab-" + word) >= 0,
        folded: shut.rows.filter((r) => r.depth > 0).length,
        marks: open.rows.filter((r) => r.on).length });
    }
    const badWalk = walk.filter((w) =>
      !w.exp || w.kids < 1 || w.folded !== 0 || w.marks !== 1);
    is(badWalk.length === 0,
      "A6j " + width + " · every tab with children unfolds them on arrival and "
      + "folds them on the next press, with one mark throughout — "
      + walk.map((w) => w.word + ":" + w.kids).join(", ")
      + (badWalk.length ? " — BAD " + JSON.stringify(badWalk) : ""));

    /* A6k — OPENING STRUCTURE FOLDS BAND: ONE PATH.
       REWRITTEN IN PLACE 2026-09-02 (wave 4). Paul: *"Only allow one expansion
       (or nested expansion) of the left nav at one time."*

       WHAT IT ASSERTED AND WHY IT IS THE OPPOSITE NOW. It read *"A6k — TWO
       BRANCHES OPEN AT ONCE, WHICH IS THE WHOLE ASK. Open Band, open
       Structure, and both stand: two rows wear `aria-expanded="true"`, the
       rows of both are on the stripe at depth 1"* — Paul's 2026-08-28 sentence
       (*"we can expand multiple levels of interface option"*) read as a
       FOREST. He has withdrawn the plural and kept the depth: multiple LEVELS
       still stand at once (root → child → grandchild, which is what A6l
       measures and what the ↑ was deleted for), but only ONE CHAIN of them.
       So the same gesture is driven and the assertion is inverted: after
       opening Structure, Band's branch is gone, Structure's rows are on the
       stripe, exactly one row wears `aria-expanded="true"`, and there is still
       exactly ONE <mark> — shell A6c's law, unchanged, met by a path.
       `__eightTree().expanded` IS THE PATH, root first, so it is asserted as a
       chain and not as a set. */
    await page.evaluate(() => window.__eightUp());
    await page.waitForTimeout(120);
    /* ...AND THE PAIR IT DRIVES IS `Motifs` AND `Band` SINCE 2026-09-04,
       because `Structure` is deleted (TABLE.md §6 ¶A) and its sections are
       CHILDREN of Band now — "opening Structure folds Band" cannot be asked of
       two branches that are one branch. The claim is unchanged and so is the
       gesture: open one tab with children, open another, and the first must be
       gone — one expanded ancestor, one <mark>, and the arriving tab's own
       rows on the stripe. Band is the second of the two here so the assertion
       can still name the rows it expects: the players AND the sections, which
       is the whole of what the wave-2c stripe says the Band tab is. */
    await page.click('[data-k="toptab-Motifs"]');
    await page.waitForTimeout(TAB_SETTLE("Motifs"));
    await page.click('[data-k="toptab-Band"]');
    await page.waitForTimeout(TAB_SETTLE("Band"));
    const both = await page.evaluate(() => {
      const T = window.__eightTree();
      return { exp: T.expanded,
        expandedRows: [...document.querySelectorAll('#nu-tray [aria-expanded="true"]')]
          .map((b) => b.dataset.k || b.id).filter((k) => k !== "playops"),
        marks: document.querySelectorAll("#nu-tray mark").length,
        motifs: T.rows.some((r) => r.depth === 1 && /^motiftab-/.test(r.key)),
        band: T.rows.some((r) => r.depth === 1 && /^tab/.test(r.key)),
        secs: T.rows.some((r) => r.depth === 1 && /^secnav/.test(r.key)) };
    });
    is(both.expandedRows.length === 1 && both.marks === 1 &&
       !both.motifs && both.band && both.secs &&
       both.exp.length === 1 && both.exp[0] === "toptab-Band",
      "A6k " + width + " · opening Band folds Motifs; one path — one "
      + "expanded ancestor, its players AND its sections on the stripe, one "
      + "<mark> — " + JSON.stringify(both));

    /* A6l — A BAND ROW IS A JUMP, AND THE OPS IT USED TO CARRY ARE ON THE
       TABLE. THE THIRD REWRITE OF THIS CHECK AND THE ONLY ONE THAT IS ABOUT A
       LAW RATHER THAN A COUNT. It read `r.subs === 4` off `.nu-traylist
       .nu-sub` when the four were `inst · mix · plays · per-section`; wave 2c
       made them one act (`remove`) and it read "at least one row at depth 2".
       TABLE.md §9a (APPROVED 2026-09-05) settles it in the other direction —
       Paul: *"Move all the nav into the table, I should be able to add players
       without using the nav and sections too. I click band and all further
       operations are buttons around the table."* — so the claim is now:

         · a member row and a section row have NO CHILDREN AT ALL. Nothing at
           depth 2 anywhere on the stripe while you stand on Band, which is
           what "no op lives in the nav" looks like from the tree's side;
         · the row still carries the state and the single <mark>, because the
           jump IS the state — a childless row that stopped being markable
           would have moved the mark up to the tab, which is the failure the
           2026-09-01 discipline names;
         · and every op that left is REACHABLE, at its own address, in the
           sheet the jump just opened. A deletion nobody can undo by tapping is
           a lost control, so this reads the table rather than trusting the
           inventory: `tcol-del|<voice>` in the open column sheet, and
           `trow-up|<id> · trow-down|<id> · trow-dup|<id> · trow-del|<id>` in
           the open row sheet — the same four verbs, one surface over. */
    {
      await page.evaluate(() => window.__eightUp());
      await page.waitForTimeout(120);
      await page.click('[data-k="toptab-Band"]');
      await page.waitForTimeout(TAB_SETTLE("Band"));
      const L0 = await nowT();
      const vk = (L0.rows.find((r) => r.depth === 1 && /^tab/.test(r.key)) || {}).key;
      if (vk) {
        await page.click('[data-k="' + vk + '"]');
        await page.waitForTimeout(500);
        const r = await page.evaluate((key) => {
          const T = window.__eightTree();
          const b = document.querySelector('[data-k="' + key + '"]');
          const name = key.replace(/^tab/, "");
          return { deep: T.rows.filter((x) => x.depth === 2).map((x) => x.key),
                   exp: b ? b.getAttribute("aria-expanded") : null,
                   pressedOnParent: b ? b.getAttribute("aria-pressed") : null,
                   marks: document.querySelectorAll("#nu-tray mark").length,
                   depthAttr: [...document.querySelectorAll(".nu-traylist [data-depth]")]
                     .length,
                   /* THE OP, ON THE TABLE, IN THE SHEET THE JUMP OPENED. */
                   del: !!document.querySelector(
                     '#pan-band [data-k="' + CSS.escape("tcol-del|" + name) + '"]'),
                   hire: ["line", "bass", "drums"].filter((k) =>
                     document.querySelector(
                       '#pan-band [data-k="' + CSS.escape("tcol-add|" + k) + '"]')).length };
        }, vk);
        is(r.deep.length === 0 && r.exp === null &&
           r.pressedOnParent === "true" && r.marks === 1 && r.depthAttr > 0 &&
           r.del && r.hire === 3,
          "A6l " + width + " · a player row is a JUMP: no children, no "
          + "aria-expanded, it wears the state and the one <mark>, and its "
          + "`remove` and the three hires are on the table — " + JSON.stringify(r));
        /* ...AND A SECTION IS THE OTHER HALF OF THE SAME BRANCH. Its four
           operations were the depth-2 branch of ACTIONS here; they are the
           first line of its ROW SHEET now, which the jump opens. */
        const sk = (await nowT()).rows
          .filter((x) => x.depth === 1 && /^secnav/.test(x.key))[0];
        if (sk) {
          await page.click('[data-k="' + sk.key + '"]');
          await page.waitForTimeout(600);
          const rs = await page.evaluate((key) => {
            const T = window.__eightTree();
            const id = key.replace(/^secnav/, "");
            const at = (k) => !!document.querySelector(
              '#pan-band [data-k="' + CSS.escape(k) + '"]');
            return { deep: T.rows.filter((x) => x.depth === 2).map((x) => x.key),
                     marks: document.querySelectorAll("#nu-tray mark").length,
                     ops: ["trow-up|", "trow-down|", "trow-dup|", "trow-del|"]
                       .filter((k) => at(k + id)).length,
                     add: at("trow-add") };
          }, sk.key);
          is(rs.deep.length === 0 && rs.marks === 1 && rs.ops === 4 && rs.add,
            "A6l " + width + " · …and a section row is a jump too: nothing at "
            + "depth 2, one <mark>, and its four operations plus `+ section` "
            + "are on the table at their own addresses — " + JSON.stringify(rs));
        } else skip(width + " · no section row for A6l");
      } else skip(width + " · no member row for A6l");
    }

    // THE KIT GRID IS THE WIDEST THING THIS PAGE DRAWS and the default record
    // has no drummer, so a gate that does not add one never measures it.
    // ...AND THE BUTTON THAT HIRES ONE IS INSIDE THE BAND TAB since 2026-08-27,
    // so the tab is opened first. Before this line the gate found no such
    // button on the tabbed page and skipped at all four widths.
    // ...AND IT IS THE TABLE'S OFFER SINCE 2026-09-05 (TABLE.md §9a, "no op
    // lives in the nav"): `adddrums` was a row in the Band branch of the
    // stripe and is `tcol-add|drums` on the player axis's adder cell, which is
    // the address the T7 inventory filed it onto the day the ops left the tray.
    await page.evaluate(() => window.__eightTab("Band"));
    await page.waitForTimeout(TAB_SETTLE("Band"));
    const add = await page.$('#pan-band [data-k="tcol-add|drums"]');
    if (add) { await add.click(); await page.waitForTimeout(1200); }
    else skip(width + " · no [data-k=tcol-add|drums] button — the kit grid was not measured");

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
      /* A7 — the promise --tray-w makes to the whole page's flow.
         (WAS "the promise --bar-h makes to the tab row": `if (s.bars !== 1)
         fail("exactly one .nu-bar") else Math.abs(s.barH - parseFloat(s.barVar))
         <= 0.5`. Same three claims — one piece of chrome, laid out, at the size
         the sheet declares — asked of the chrome that exists. See A7 above.) */
      if (s.trays !== 1) fail("A7 " + at + " · exactly one .nu-tray (found " + s.trays + ")");
      else is(Math.abs(s.trayW - s.trayVar) <= 0.5,
        "A7 " + at + " · the gutter is " + s.trayW + "px, --tray-w resolves to "
        + s.trayVar + "px");
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

      /* A6 / A6b / A6c — the fixed stripe, swept down this tab's whole
         height. `pinRow` is 0 since 2026-08-28 (the stripe is `position:
         fixed` and is at the top of the viewport from the first frame), so
         EVERY stop is a stop the stripe is asked about.
         AND THERE IS NO SKIP LEFT (2026-08-29). This read `const pinB =
         b.stops.filter((t) => t.barPinned)` and, when a tab was short enough
         to fit on the screen, skipped with "this tab is too short to pin the
         transport". That escape belonged to `position: sticky`: a band that
         has not been scrolled to its pin is not late, it is not pinned yet.
         Nothing here is sticky any more — the band is deleted (A6) — so a
         short tab is not an excuse and the assertion is made at all eleven
         stops on every tab, scrollY 0 included. */
      const b = await page.evaluate(BANDS);
      const pinR = b.stops.filter((t) => t.rowPinned);
      const x0 = b.stops[0].rowLeft;
      const badRow = pinR.filter((t) => Math.abs(t.rowTop - t.want) > 0.5 ||
        Math.abs(t.rowLeft - x0) > 0.5);
      const end = b.stops[b.stops.length - 1].y;
      is(badRow.length === 0 && pinR.length === b.stops.length,
        "A6 " + at + " · over " + pinR.length + " stops to y=" + end
        + ": the stripe is fixed at top 0, x=" + x0 + " ("
        + b.rowH + "px tall, level \"" + b.level + "\")"
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
      /* THE ACTS CASE IS REWRITTEN, 2026-09-02, AND ITS OLD FORM IS QUOTED
         ABOVE. It read: `b.marks.length === 0 && b.pressed.length === 0 &&
         /^up — out of \S/.test(b.headSays)` — nothing marked, and the HEAD's
         ↑ sentence naming the thing you were inside. Two things reverse it,
         both Paul's: *"We should never need the 'up' icon"* deletes the head
         and its sentence, and *"we should really work hard on nesting options
         inside the left nav"* means the stripe is never one level, so "this
         level is a level of ACTIONS" is no longer a fact about the stripe at
         all — it is a fact about a BRANCH, and the branch itself is the open
         thing and wears the mark.
         THE LAW IS UNCHANGED AND IS THE ONE BELOW: exactly one <mark> and one
         `aria-pressed="true"` in the stripe, on the deepest open thing. What
         the acts declaration still buys is that none of a branch's ACTION rows
         may be marked — fourteen `aria-pressed="false"` transforms would tell a
         screen reader there is a state to be in — and that is asserted on the
         rendered page by test/nav-tree.js, where the branch can be opened on
         purpose rather than caught wherever this sweep happens to land. */
      is(b.marks.length === 1 && b.marks[0] === b.now &&
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
          /* THE SCREEN-READER BOXES ARE NOT ON THE SCREEN (2026-08-30). When
             the outer gutter went to zero (Paul: "Get rid of all margins and
             padding on the outside of the views"), this sweep failed 36 times
             on H2@55.0-56.0 — every one of them the sr-only recipe (.nu-ax >
             h2 and its kin: 1x1px, margin -1px, clip-path inset(50%)), whose
             negative margin parks an INVISIBLE box one pixel into the tray's
             band now that content starts at the tray's own edge. Nothing is
             painted there — clip-path clips the whole box — so "under the
             gutter" was never true of them; with 12px of page gutter they
             merely never got close enough for the stage to notice they exist.
             A clipped-to-nothing box is skipped the way display:none is. */
          if (cs.clipPath && cs.clipPath.indexOf("inset") === 0
              && parseFloat(cs.width) <= 1 && parseFloat(cs.height) <= 1) continue;
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
