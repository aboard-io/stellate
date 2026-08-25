#!/usr/bin/env node
// test/shell.js — THE SHELL GATE (PROGRAM.md §5, deliverable D8).
//
// TEST THE ARTIFACT. Three features have shipped broken in this repo while
// every check passed, so nothing here reads nu.css: every number below is
// measured off the RENDERED page in a real browser at four real phone widths,
// with a drummer added first so the kit grid — the widest thing this page can
// draw — actually exists.
//
// Eight assertions, one per line of §5's shell row:
//   A1  documentElement.scrollWidth === clientWidth at 320/375/430/820.
//       THE PAGE NEVER SCROLLS SIDEWAYS. Measured 2026-08-24 before the sheet:
//       390 against 375, because two seventeen-column grids were 382px wide.
//   A2  no <button>, <select> or input[type=number] under 44px tall.
//       Measured before: 23 buttons at 21px, 11 selects at 19px.
//   A3  every checkbox and radio has a 24px tap target on both axes (WCAG 2.2
//       AA Target Size Minimum). Measured before: 98 of them at 13x13.
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
//   A6  at scrollY 600/1400/2400 the .nu-bar sits at 0 and EXACTLY ONE
//       .nu-ax > h2 sits in 0 < top < 120 — and it is the heading of the axis
//       the viewport is actually inside. Two bands, never three.
//   A7  the .nu-bar is exactly --bar-h tall. `.nu-ax > h2 { top: var(--bar-h) }`
//       is a promise about a number, and a third control in the bar that wraps
//       opens a gap under the heading that nothing else would catch.
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
const STICKY_AT = 375;          // the sticky trace runs once, at phone width
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

  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    scrollHeight: de.scrollHeight,
    linked: !!document.querySelector('link[rel="stylesheet"]'),
    sheets: document.styleSheets.length,
    bars: document.querySelectorAll(".nu-bar").length,
    axes: document.querySelectorAll(".nu-ax").length,
    panes: document.querySelectorAll(".nu-pane").length,
    grids: document.querySelectorAll(".nu-grid").length,
    barH: document.querySelector(".nu-bar")
      ? +rect(document.querySelector(".nu-bar")).height.toFixed(2) : null,
    barVar: getComputedStyle(de).getPropertyValue("--bar-h").trim(),
    // A2
    shortControls: [...document.querySelectorAll("button, select, input[type=number]")]
      .map((e) => ({ n: name(e), h: +rect(e).height.toFixed(1) }))
      .filter((x) => x.h < 44),
    // A3
    smallBoxes: [...document.querySelectorAll("input[type=checkbox], input[type=radio]")]
      .map((e) => { const t = target(e); return { n: name(e), w: +t.w.toFixed(1), h: +t.h.toFixed(1) }; })
      .filter((x) => x.w < 24 || x.h < 24),
    // A4
    clippedPanes: [...document.querySelectorAll(".nu-pane")]
      .map((p, i) => ({ i, over: p.scrollHeight - p.clientHeight }))
      .filter((x) => x.over > 1),
    // A5 — a <table> that is WIDER THAN THE BOX IT IS IN and has nothing to
    // scroll it. Measured off the rendered page, not off the class list: a
    // table is fine either way round, in a `.nu-pane` that can carry it or
    // loose in a column it fits inside. The +1 is the sub-pixel slack every
    // other measurement in this file already allows.
    // (This replaces a class-list test — "parentElement is a .nu-pane" — which
    // could not tell a table that needs a scroller from one that does not.)
    spillingTables: [...document.querySelectorAll("table")]
      .map((t) => ({ t, host: t.parentElement }))
      .filter(({ t, host }) => host && t.scrollWidth > host.clientWidth + 1 &&
        !host.classList.contains("nu-pane"))
      .map(({ t, host }) => name(t) + " " + t.scrollWidth + "px in " +
        host.clientWidth + "px (" + (t.rows[0] ? t.rows[0].cells.length : 0) + " cols)"),
    // A5c — the rotated step grids take no pane. ui/eight.js `stepGrid`:
    // "an `overflow-x: auto` box around a table that cannot overflow is a
    // scroll container that exists only to catch gestures. It caught them."
    panedGrids: [...document.querySelectorAll(".nu-pane table.nu-grid")]
      .map((t) => name(t) + " (" + (t.rows[0] ? t.rows[0].cells.length : 0) + " cols)"),
    // A5b — a pane holding more than one table is a nested-scroll bug waiting
    crowdedPanes: [...document.querySelectorAll(".nu-pane")]
      .map((p, i) => ({ i, n: p.querySelectorAll("table").length }))
      .filter((x) => x.n !== 1),
    nestedPanes: [...document.querySelectorAll(".nu-pane .nu-pane")].length,
    // the two lines that would kill both stickies without saying anything
    overflowSins: ["body", "#app"].map((s) => {
      const e = document.querySelector(s);
      return e ? s + ":" + getComputedStyle(e).overflowX : s + ":absent";
    }).filter((s) => !/visible/.test(s)),
  };
};

/* ---------- the sticky trace, which needs to scroll and settle ----------- */
const STICKY = async () => {
  const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const barH = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue("--bar-h")) || 52;
  const out = [];
  // THE THREE STOPS ARE MEASURED FROM #app, NOT FROM THE TOP OF THE DOCUMENT.
  // They were literal 600/1400/2400 until 2026-08-24, when D6 put a world map
  // above #app ("a slider for time and a world map on top") — 600px of atlas,
  // so y=600 landed the reader in the map, which is not an axis and has no
  // heading to pin, and this assertion failed on a page that was behaving
  // exactly as designed. The thing under test is "the heading on the screen is
  // the heading of the axis you are inside", which is a claim about #app; the
  // offset is what keeps the three stops asking it.
  const top0 = (document.getElementById("app") || document.body).offsetTop;
  for (const want of [top0 + 600, top0 + 1400, top0 + 2400]) {
    window.scrollTo(0, want);
    await raf();
    const y = window.scrollY;
    const bar = document.querySelector(".nu-bar");
    // WHICH AXIS AM I IN? The one whose box straddles the line just under the
    // bar — that is the point the reader's eye is on, and its heading is the
    // heading that has to be on the screen.
    const probe = barH + 1;
    const inside = [...document.querySelectorAll(".nu-ax")].find((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= probe && r.bottom > probe;
    });
    const pinned = [...document.querySelectorAll(".nu-ax > h2")]
      .map((h) => ({ text: h.textContent.trim(), top: +h.getBoundingClientRect().top.toFixed(1),
                     mine: !!inside && inside.contains(h) }))
      .filter((h) => h.top > 0 && h.top < 120);
    out.push({ want, y,
      barTop: bar ? +bar.getBoundingClientRect().top.toFixed(1) : null,
      inside: inside ? (inside.querySelector("h2") || {}).textContent : null,
      pinned });
  }
  window.scrollTo(0, 0);
  await raf();
  return out;
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
    // THE KIT GRID IS THE WIDEST THING THIS PAGE DRAWS and the default record
    // has no drummer, so a gate that does not add one never measures it.
    const add = await page.$('[data-k="adddrums"]');
    if (add) { await add.click(); await page.waitForTimeout(1200); }
    else skip(width + " · no [data-k=adddrums] button — the kit grid was not measured");

    const s = await page.evaluate(SURVEY);
    console.log("[" + width + "] scroll " + s.scrollWidth + "/" + s.clientWidth
      + " · h" + s.scrollHeight + " · bars " + s.bars + " · axes " + s.axes
      + " · panes " + s.panes + " · grids " + s.grids
      + " · sheets " + s.sheets + (s.linked ? " (linked)" : " (NO <link>)"));

    is(s.scrollWidth === s.clientWidth,
      "A1 " + width + " · no sideways scroll (" + s.scrollWidth + " vs " + s.clientWidth + ")");
    is(s.shortControls.length === 0,
      "A2 " + width + " · no control under 44px"
      + (s.shortControls.length ? " — " + s.shortControls.length + " short, e.g. "
         + s.shortControls.slice(0, 4).map((x) => x.n + "@" + x.h).join(", ") : ""));
    is(s.smallBoxes.length === 0,
      "A3 " + width + " · every checkbox/radio target >= 24px"
      + (s.smallBoxes.length ? " — " + s.smallBoxes.length + " small, e.g. "
         + s.smallBoxes.slice(0, 4).map((x) => x.n + "@" + x.w + "x" + x.h).join(", ") : ""));
    is(s.clippedPanes.length === 0,
      "A4 " + width + " · no pane clips vertically"
      + (s.clippedPanes.length ? " — " + JSON.stringify(s.clippedPanes) : ""));
    is(s.spillingTables.length === 0,
      "A5 " + width + " · no <table> overflows the box it is in"
      + (s.spillingTables.length ? " — spilling: " + s.spillingTables.join(", ") : ""));
    is(s.panedGrids.length === 0,
      "A5c " + width + " · no .nu-pane around a rotated step grid"
      + (s.panedGrids.length ? " — " + s.panedGrids.join(", ") : ""));
    is(s.crowdedPanes.length === 0 && s.nestedPanes === 0,
      "A5b " + width + " · one table per pane, no nesting"
      + (s.crowdedPanes.length ? " — " + JSON.stringify(s.crowdedPanes) : "")
      + (s.nestedPanes ? " — " + s.nestedPanes + " nested" : ""));
    // A7 — the promise --bar-h makes to .nu-ax > h2
    if (s.bars !== 1) fail("A7 " + width + " · exactly one .nu-bar (found " + s.bars + ")");
    else {
      const want = parseFloat(s.barVar);
      is(Math.abs(s.barH - want) <= 0.5,
        "A7 " + width + " · .nu-bar is " + s.barH + "px, --bar-h says " + s.barVar);
    }
    is(s.overflowSins.length === 0,
      "A0 " + width + " · body and #app keep overflow-x: visible"
      + (s.overflowSins.length ? " — " + s.overflowSins.join(", ")
         + " (this kills BOTH sticky bands silently)" : ""));

    const lanes = await page.evaluate(LANE);
    if (!lanes.length)
      skip("A8 " + width + " · no pane with a sticky first column scrolls at this width");
    else for (const lane of lanes)
      is(lane.moved <= 2,
        "A8 " + width + " · " + lane.what + "'s sticky first column moved "
        + lane.moved + "px over a " + lane.scrolled + "px scroll");

    if (width === STICKY_AT) {
      const trace = await page.evaluate(STICKY);
      for (const t of trace) {
        const at = "A6 y=" + t.y + (t.y !== t.want ? " (asked " + t.want + ", page ends there)" : "");
        is(t.barTop === 0, at + " · .nu-bar pinned at 0 (was " + t.barTop + ")");
        if (t.pinned.length !== 1)
          fail(at + " · exactly one pinned .nu-ax > h2 — found " + t.pinned.length
            + " [" + t.pinned.map((p) => p.text + "@" + p.top).join(" | ") + "]");
        else
          is(t.pinned[0].mine, at + " · pinned heading is \"" + t.pinned[0].text
            + "\" and the viewport is inside \"" + String(t.inside).trim() + "\"");
      }
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
