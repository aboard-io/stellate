#!/usr/bin/env node
/* test/gutter.js — THE TRANSPORT IS A LEVEL OF THE GUTTER, READ OFF THE
 * RENDERED PAGE.
 *
 * Paul, 2026-08-29, four sentences in one breath:
 *   "Get rid of the play buttons and the title of the song"
 *   "Add a permanent play button to the top of the nav. When I tap it the nav
 *    is taken over by play options. The volume slider is now vertical"
 *   "Get rid of the time slider. Make the genre list permanent and always
 *    expanded. As I slide it light up the map with places. When I tap a place
 *    start playing and zoom in the map on that place."
 *   "Add Wikipedia links to to the genre list in a column"
 *
 * WHY THIS IS A FILE AND NOT SIX MORE CHECKS IN test/atlas.js. That gate owns
 * THE MAP — what is drawn, what a thumb on a dot writes, what a keyboard can
 * reach — and it is 1,700 lines of that one subject. This round moved the
 * TRANSPORT and deleted two pieces of furniture, which is a claim about the
 * page's shell; the four checks that belong to the map (the list is the time
 * instrument, the tap zooms) are asserted there, in the gate that already
 * knows how to hold a globe still. What is here is the shell.
 *
 * EVERY ASSERTION IS AGAINST THE RENDERED ARTIFACT. This box has shipped three
 * features that were correct in source and invisible on the page (memory:
 * "test the artifact"), and two of the six checks below are exactly that kind:
 * a vertical slider that computes the right value and steals the page's scroll
 * is a bug no source reading finds, and a lit ring is an attribute written by
 * a paint pass three call frames away from the scroll that caused it.
 *
 *   T1  the <h1> and the .nu-bar are GONE, and the record still names the page
 *   T2  #play is in the tray's head at EVERY level, and it toggles the record
 *   T3  the play level draws the five transport controls and no sixth
 *   T4  A REAL POINTER DRAG on the vertical room fader changes the value and
 *       leaves window.scrollY where it was — THE TOUCH LAW, on the artifact
 *   T5  the genre list is built and open at boot, every row a thumb, with a
 *       Wikipedia column whose every href is NuWiki.url(the row's own key)
 *   T6  scrolling the list changes WHICH marks are lit, by count and by name
 *   T7  a tap on a place writes its record, STARTS it, and leaves the mark
 *       centred within a pixel and measurably larger — three numbers
 *   T8  the ? mark (Paul, 2026-08-30: "add a ? Icon above the log icon that
 *       fully explains every aspect of a genre"): present in the foot at
 *       every level, directly above the log; opens/closes with
 *       aria-expanded; the panel is organized by the EIGHT AXES (AXES.md's
 *       own eight headings); playback does not rebuild it while open (the
 *       [data-live] law, read as bytes over a playing second); the parents
 *       are tappable and NAVIGATE through the atlas door; hohlefels shows
 *       its `cannot` VERBATIM against genres.js; a role shows EXCLUDE's own
 *       sentence; no sideways scroll at five widths and 44px targets.
 *       REVERSED IN FORM 2026-08-30 (Paul, on the first shipped panel: "The
 *       question mark icon produces tons of stuff but it's hard to parse.
 *       It should be in tables and give a sense of what leads into what.
 *       It's very repetitive.") — T8h below holds the reversal to the
 *       artifact: the LINEAGE FLOW is the panel's first section and its
 *       generations are year-ordered; every axis is a <table> with no
 *       all-empty row; and the duplicated-fact probe that MEASURED the
 *       shipped panel's repetition now bounds it
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/gutter.js
 *       (it stands up its own COOP/COEP server on a port the OS picks, the
 *        same handler serve.sh and test/all.js use, because the ring engine
 *        wants a SharedArrayBuffer and a page that is not cross-origin
 *        isolated is a different page from the one that ships.)
 */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const { spawn } = require("child_process");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const ROOT = path.join(__dirname, "..");
const PAGE_ARG = arg("--page", null);

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "ok   " : "FAIL ") + what); };

/* serve.sh's handler exactly, on a port the OS gives us (test/all.js's own). */
const SERVER_PY = `
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=sys.argv[1]))
print(srv.server_address[1], flush=True)
srv.serve_forever()
`;
function standUpServer() {
  const proc = spawn("python3", ["-c", SERVER_PY, ROOT],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    proc.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc, port: +m[1] }); } });
    proc.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

(async () => {
  const srv = PAGE_ARG ? null : await standUpServer();
  const PAGE = PAGE_ARG ||
    ("http://localhost:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 },
                              hasTouch: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await p.goto(PAGE, { waitUntil: "load" });
  await p.waitForTimeout(2500);

  /* ---- T1 THE HEADING AND THE BAND ARE GONE --------------------------- */
  /* AND THE FACT THEY CARRIED IS NOT. "Get rid of … the title of the song"
     deletes a heading; it does not delete the answer to "which record is on
     this page". ui/eight.js draw() writes that answer to `document.title`, so
     what is asserted is BOTH halves — the furniture is gone AND the fact
     survives — because a round that removed the name entirely would pass a
     check that only looked for an absence. */
  const t1 = await p.evaluate(() => ({
    h1: !!document.getElementById("title"),
    bars: document.querySelectorAll(".nu-bar").length,
    title: document.title,
    basis: window.__eightDoc ? window.__eightDoc().basis : null,
    label: window.__eightDoc && window.NuGenres
      ? ((window.NuGenres.GENRES[window.__eightDoc().basis] || {}).label
         || window.__eightDoc().basis) : null,
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check(!t1.h1 && t1.bars === 0,
    "T1 · no #title heading and no .nu-bar on the page (h1 " + t1.h1 +
    ", bars " + t1.bars + ")");
  check(t1.title === t1.label && !!t1.label,
    "T1 · …and the record still names the page: document.title is " +
    JSON.stringify(t1.title) + " for basis " + JSON.stringify(t1.basis));
  check(t1.sideways === 0,
    "T1 · …and nothing scrolls sideways at 390 (" + t1.sideways + " px)");

  /* ---- T2 THE PLAY MARK IS PERMANENT --------------------------------- */
  /* AT EVERY LEVEL, WHICH IS THE WHOLE WORD "permanent". The stripe is walked
     the way a thumb walks it — the nine tabs are pressed, which is what puts
     the stripe on each of its sub-levels ("opening a tab IS going into it") —
     and #play must be in `.nu-trayhead` at every stop. A check that only
     looked at the root would pass on a button that vanished the moment you
     opened the Band. */
  const t2 = await p.evaluate(async () => {
    const seen = [], missing = [];
    const tabs = [...document.querySelectorAll('#nu-tray .nu-traylist button')]
      .map((x) => x.dataset.k).filter((k) => k && k.indexOf("toptab-") === 0);
    for (const k of tabs) {
      const btn = document.querySelector('#nu-tray [data-k="' + k + '"]');
      if (!btn) continue;
      btn.click();
      await new Promise((r) => setTimeout(r, 40));
      const lvl = window.__eightTray().level;
      const head = document.querySelector(".nu-trayhead #play");
      seen.push(lvl);
      if (!head) missing.push(lvl);
      window.__eightUp();
      await new Promise((r) => setTimeout(r, 20));
    }
    return { seen, missing, tabs: tabs.length };
  });
  check(t2.tabs === 9 && !t2.missing.length,
    "T2 · #play is in .nu-trayhead at every level the nine tabs reach (" +
    t2.tabs + " tabs, levels " + JSON.stringify([...new Set(t2.seen)]) +
    ", missing " + JSON.stringify(t2.missing) + ")");
  /* AND IT PLAYS AND STOPS. The word on it is the NEXT tap, so the accessible
     name is the readout: "play" -> press -> "stop" -> press -> "play". */
  const word = () => p.evaluate(() =>
    (document.getElementById("play").getAttribute("aria-label") || "").trim());
  const w0 = await word();
  await p.evaluate(() => document.getElementById("play").click());
  await p.waitForTimeout(400);
  const w1 = await word();
  await p.evaluate(() => document.getElementById("play").click());
  await p.waitForTimeout(400);
  const w2 = await word();
  check(w0 === "play" && w1 === "stop" && w2 === "play",
    "T2 · …and one mark plays and stops the record: " +
    JSON.stringify([w0, w1, w2]));

  /* ---- T3 THE PLAY LEVEL ---------------------------------------------- */
  /* FIVE CONTROLS, AND WHERE EACH ONE STANDS IS PART OF THE CLAIM. #play is in
     the HEAD (that is what makes it permanent); the other four are the level's
     own items, in Paul's order.

     THIS READ "the level is reached by pressing #play, which is the only way a
     reader reaches it", AND IT IS REVERSED, 2026-08-29. Paul, on the shipped
     stripe: *"Make play/stop permanent and make a new icon underneath for all
     the play/volume/seed functions. It's too weird when those are together."*
     #play now only starts and stops the record; #playops, the mark directly
     under it, is the door. T2 above still proves the toggle, and it proves it
     WITHOUT arriving here — which is the whole point of the split. */
  await p.evaluate(() => document.getElementById("playops").click());
  await p.waitForTimeout(300);
  const t3 = await p.evaluate(() => {
    const L = window.__eightTray();
    const list = [...document.querySelectorAll(".nu-traylist > *")]
      .filter((n) => n.nodeType === 1)
      .map((n) => n.id || n.className);
    const has = (id) => !!document.getElementById(id);
    const tap = [...document.querySelectorAll(".nu-traylist button")]
      .map((n) => +n.getBoundingClientRect().height.toFixed(1));
    return { level: L.level, up: L.up, acts: L.acts, items: L.items, list,
             head: !!document.querySelector(".nu-trayhead #play"),
             five: ["play", "rewrite", "take", "voicing", "vol"].filter(has),
             reading: (document.getElementById("reading") || {}).textContent,
             minTap: tap.length ? Math.min(...tap) : 0,
             trayW: +document.querySelector(".nu-tray").getBoundingClientRect().width.toFixed(1) };
  });
  check(t3.level === "play" && t3.up === "root" && t3.acts === true,
    "T3 · pressing #playops takes the stripe to the play level, whose ↑ is " +
    "the root (" + JSON.stringify({ level: t3.level, up: t3.up, acts: t3.acts }) + ")");
  /* AND THE SPLIT ITSELF, ASSERTED — the thing Paul asked for, which is that
     these two marks do ONE JOB EACH. A stop must not move the stripe, and the
     door must not touch the record. Without this the two could quietly fuse
     again and every check above would still pass. */
  const t3b = await p.evaluate(async () => {
    const lvl = () => window.__eightTray().level;
    const word = () => (document.getElementById("play")
      .getAttribute("aria-label") || "").trim();
    document.getElementById("play").click();          // start, from the play level
    await new Promise((r) => setTimeout(r, 250));
    const afterStart = { level: lvl(), word: word() };
    document.getElementById("play").click();          // stop
    await new Promise((r) => setTimeout(r, 250));
    const afterStop = { level: lvl(), word: word() };
    document.getElementById("playops").click();       // the door closes again
    await new Promise((r) => setTimeout(r, 250));
    return { afterStart, afterStop, closed: lvl(),
             expanded: document.getElementById("playops")
               .getAttribute("aria-expanded") };
  });
  check(t3b.afterStart.level === "play" && t3b.afterStop.level === "play"
        && t3b.afterStart.word === "stop" && t3b.afterStop.word === "play",
    "T3 · …and the transport does not move the stripe: play then stop both " +
    "leave the level at " + JSON.stringify(t3b.afterStop.level) +
    " while the mark reads " + JSON.stringify([t3b.afterStart.word, t3b.afterStop.word]));
  check(t3b.closed === "root" && t3b.expanded === "false",
    "T3 · …and the door shuts the way it opened, saying so: level " +
    JSON.stringify(t3b.closed) + ", aria-expanded " + JSON.stringify(t3b.expanded));
  /* AND IT IS RE-OPENED FOR T4, which measures the fader and needs the level
     it lives on. Said out loud rather than left as a side effect of the check
     above: shutting the door is an assertion here, not the state the rest of
     this file runs in. */
  await p.evaluate(() => document.getElementById("playops").click());
  await p.waitForTimeout(250);
  check(t3.five.length === 5 && t3.head === true,
    "T3 · …and the five transport controls are on the page — #play in the " +
    "head, the other four in the level: " + JSON.stringify(t3.five) +
    ", items " + JSON.stringify(t3.items));
  check(t3.minTap >= 44 && t3.trayW === 56,
    "T3 · …every mark in it is a thumb (" + t3.minTap + " CSS px) inside the " +
    "56px gutter (" + t3.trayW + ")");

  /* ---- T4 THE TOUCH LAW ON THE VERTICAL FADER ------------------------- */
  /* THE ONE CHECK THIS ROUND MOST NEEDED. A vertical slider in a fixed gutter
     is exactly where a scroll-steal lives: the finger travels down the screen,
     the page takes it, and the fader either does nothing or does something
     while the document runs away underneath. So the drag is a REAL CDP touch
     sequence — not `input.value = x`, which proves nothing about a thumb — and
     TWO facts are read: the value moved, and `window.scrollY` did not.
     THE PAGE IS PUT SOMEWHERE IT COULD SCROLL FROM FIRST. A scrollY of 0 that
     is still 0 proves nothing if the document is one screen tall, so the gate
     opens a tab that is taller than the viewport and scrolls into it; if the
     page will not scroll at all the check says so rather than passing. */
  /* THE PAGE HAS TO BE SOMEWHERE IT COULD SCROLL FROM, and which tab that is
     is a MEASUREMENT and not an assumption: the nine panels are different
     heights and the tallest one moves as the record does, so the gate asks
     each tab how much overflow it has and stands on the deepest one. (The
     first version picked `Band` by name; measured at 390x844 on the boot
     record it had 0 px of overflow, and the scroll half of the check would
     have passed vacuously against a page that could not move.) */
  const deepest = await p.evaluate(async () => {
    let best = null;
    for (const name of ["Where", "Tempo", "Key", "Motif", "Band", "Mix",
                        "Produce", "Score", "Export"]) {
      window.__eightTab(name);
      await new Promise((r) => setTimeout(r, 120));
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (!best || over > best.over) best = { name, over };
    }
    window.__eightTab(best.name);
    await new Promise((r) => setTimeout(r, 200));
    window.scrollTo(0, Math.min(240, best.over));
    return best;
  });
  await p.waitForTimeout(300);
  /* `#play` STOOD HERE AND IT IS `#playops` NOW, 2026-08-29 — the split Paul
     asked for ("Make play/stop permanent and make a new icon underneath for
     all the play/volume/seed functions"). The walk above ends in
     `__eightTab`, which sets the level from TRAYSUB, so the door has to be
     opened again to reach the fader — and it is the DOOR that opens it now.
     Pressing #play here would have started the record instead, which is the
     confusion the split removes. */
  await p.evaluate(() => document.getElementById("playops").click());   // the play level
  await p.waitForTimeout(300);
  const room = await p.evaluate(() => {
    const t = document.querySelector(".nu-trayvol .nu-vs-track");
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, top: r.y + 8, bot: r.y + r.height - 8,
             scrollable: document.documentElement.scrollHeight - window.innerHeight,
             y: window.scrollY, v: +document.getElementById("vol").value };
  });
  if (!room) check(false, "T4 · there is no .nu-trayvol fader on the play level");
  else {
    const cdp = await p.context().newCDPSession(p);
    const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", {
      type, touchPoints: type === "touchEnd" ? []
        : [{ x: room.x, y, radiusX: 8, radiusY: 8 }] });
    await touch("touchStart", room.top);
    for (let i = 1; i <= 14; i++)
      await touch("touchMove", room.top + i * (room.bot - room.top) / 14);
    await touch("touchEnd", room.bot);
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({
      v: +document.getElementById("vol").value, y: window.scrollY,
      out: (document.querySelector(".nu-trayvol .nu-vs-val") || {}).textContent }));
    check(room.scrollable > 0 && room.y > 0,
      "T4 · the page CAN scroll and is scrolled before the drag — the " +
      JSON.stringify(deepest.name) + " tab is the deepest at 390x844 (" +
      deepest.over + " px of overflow) and the window is at " + room.y +
      " — otherwise the second half of this check would be vacuous");
    check(after.v !== room.v && after.v <= 5,
      "T4 · a real touch drag DOWN the fader moves the room: " + room.v +
      " -> " + after.v + " (" + JSON.stringify(after.out) + ")");
    check(after.y === room.y,
      "T4 · …and the page does not move a pixel under it: scrollY " + room.y +
      " -> " + after.y);
  }

  /* ---- T5 THE LIST IS PERMANENT, AND IT HAS AN ARTICLE COLUMN --------- */
  /* BACK TO THE ROOT FIRST, THEN THE TAB. The stripe is standing on the play
     level after T4, and a level draws exactly one set of siblings — the nine
     tabs are not among them, so a query for `[data-k="toptab-Where"]` finds
     nothing and a click on nothing leaves the gate reading a `display: none`
     panel and measuring zeros. `__eightUp()` is the `↑` pressed until there is
     no `↑` left, which is the gesture a reader makes. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  await p.evaluate(() => {
    const b = document.querySelector('#nu-tray [data-k="toptab-Where"]');
    if (b) b.click();
  });
  await p.waitForTimeout(600);
  const t5 = await p.evaluate(() => {
    const idx = document.getElementById("atlasIndex");
    const li = [...document.querySelectorAll("#atlasIndexRows li")];
    const W = window.NuWiki;
    const bad = [], noWhy = [];
    let links = 0, no = 0;
    for (const n of li) {
      const gk = n.dataset.gk, a = n.querySelector("a.nu-ixw"),
            x = n.querySelector(".nu-ixw-no");
      if (a) { links++; if (a.getAttribute("href") !== W.url(gk)) bad.push(gk); }
      else if (x) { no++; if (!(x.dataset.why || "").length) noWhy.push(gk); }
      else bad.push(gk + ": no article cell at all");
    }
    const hs = li.map((n) => n.querySelector(".nu-ixrow").getBoundingClientRect().height);
    const as = li.map((n) => { const a = n.querySelector(".nu-ixw");
                               return a ? a.getBoundingClientRect().height : 44; });
    return { rows: li.length, hidden: idx.hidden, door: !!document.getElementById("atlasIndexBtn"),
             when: !!document.getElementById("atlasWhen"), ms: idx.dataset.ms,
             links, no, bad, noWhy, table: Object.keys(W.WIKI).length,
             minRow: +Math.min(...hs).toFixed(1), minA: +Math.min(...as).toFixed(1),
             listScroll: idx.scrollWidth - idx.clientWidth,
             page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  check(t5.rows > 0 && t5.hidden === false && t5.door === false && t5.when === false,
    "T5 · the genre list is built and open at boot, with no door and no " +
    "when-slider: " + t5.rows + " rows, hidden " + t5.hidden + ", #atlasIndexBtn " +
    t5.door + ", #atlasWhen " + t5.when + " (built in " + t5.ms + " ms)");
  /* WHAT IS ASSERTED IS THE DERIVATION, NOT A COUNT. Every href on the page
     must equal `NuWiki.url()` of that row's own key — nothing typed, nothing
     invented, no second escaping of an `&` or an accent — and every row that
     has no link must carry a REASON. The table's own size is printed and NOT
     compared: measured 2026-08-29, wiki.js holds 205 titles while the atlas
     draws 195 placed anchors, because the genre catalogue and the atlas's
     baked WHEN table move at different speeds (atlas.gate.js G2 owns that
     gap). A gate that equated the two would fail on somebody else's round. */
  check(!t5.bad.length && !t5.noWhy.length && t5.links + t5.no === t5.rows,
    "T5 · every article href is NuWiki.url(the row's own key) — " + t5.links +
    " links + " + t5.no + " refused = " + t5.rows + " rows, each refusal " +
    "carrying its reason (wiki.js holds " + t5.table + " titles; the extra " +
    "rows are anchors the atlas has not baked a place for)" +
    (t5.bad.length ? " · BAD " + JSON.stringify(t5.bad.slice(0, 4)) : ""));
  check(t5.minRow >= 44 && t5.minA >= 44 && t5.listScroll === 0 && t5.page === 0,
    "T5 · …a row and its link are both thumbs (" + t5.minRow + " / " + t5.minA +
    " CSS px) and nothing scrolls sideways (list " + t5.listScroll + ", page " +
    t5.page + ")");
  /* THE SAME THREE, AT THE FIVE WIDTHS THE BAR ARITHMETIC WAS MEASURED AT. */
  const widths = [];
  for (const w of [320, 375, 390, 430, 1280]) {
    await p.setViewportSize({ width: w, height: 844 });
    await p.waitForTimeout(350);
    widths.push(await p.evaluate((w) => {
      const li = [...document.querySelectorAll("#atlasIndexRows li")];
      const idx = document.getElementById("atlasIndex");
      const hs = li.map((n) => n.querySelector(".nu-ixrow").getBoundingClientRect().height);
      const as = li.map((n) => n.querySelector(".nu-ixw").getBoundingClientRect().height);
      return { w, row: +Math.min(...hs).toFixed(1), a: +Math.min(...as).toFixed(1),
               list: idx.scrollWidth - idx.clientWidth,
               page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, w));
  }
  const badW = widths.filter((r) => r.row < 44 || r.a < 44 || r.list || r.page);
  check(!badW.length,
    "T5 · …at 320/375/390/430/1280: every row 44+, every article 44+, zero " +
    "sideways scroll — " + JSON.stringify(widths));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(300);

  /* ---- T6 SLIDING THE LIST LIGHTS THE MAP ----------------------------- */
  /* THE LIT SET IS READ OFF THE MARKS' OWN RINGS, which is the only honest
     place: `lit` is a Set inside a closure, the ring is what a reader sees,
     and the whole feature is the second one following the first. It is
     asserted BY NAME and not only by count — a check that watched a number
     move would pass on a scroll that lit a different eight places at random. */
  const litNow = () => p.evaluate(() => ({
    lit: [...document.querySelectorAll("#atlasMap .place")]
      .filter((g) => g.querySelector(".ring").getAttribute("opacity") === "0.45")
      .map((g) => g.dataset.place).sort(),
    here: [...document.querySelectorAll("#atlasMap .place")]
      .filter((g) => g.querySelector(".ring").getAttribute("opacity") === "1")
      .map((g) => g.dataset.place),
    year: document.getElementById("atlasSay").textContent.split(" ")[0],
  }));
  const goTo = async (y) => {
    await p.evaluate((y) => {
      const idx = document.getElementById("atlasIndex");
      const rows = [...idx.querySelectorAll("#atlasIndexRows li[data-year]")];
      let best = rows[0], bd = Infinity;
      for (const r of rows) { const d = Math.abs(+r.dataset.year - y);
                              if (d < bd) { bd = d; best = r; } }
      /* THE PAGE'S OWN READ-HEAD INVERSE, in the scroller's own coordinates.
         ui/atlas.js `headY` is `scrollTop + f·H` and NOT the middle of the box
         (the middle cannot reach the first or last half-screen of rows), so
         this is `scrollToRow`'s closed form. `offsetTop` is not used because
         it is relative to the nearest POSITIONED ancestor and this scroller
         has none — 308 px out at 390x844. Both stories are in ui/atlas.js. */
      const H = idx.clientHeight;
      const max = idx.querySelector("#atlasIndexRows").scrollHeight - H;
      const c = idx.scrollTop + best.getBoundingClientRect().top
        - idx.getBoundingClientRect().top + best.offsetHeight / 2;
      idx.scrollTop = Math.max(0, Math.min(max, c / (1 + H / max)));
    }, y);
    await p.waitForTimeout(450);
    return litNow();
  };
  const a1 = await goTo(1969);
  const a2 = await goTo(1985);
  const same = JSON.stringify(a1.lit) === JSON.stringify(a2.lit);
  check(a1.lit.length > 0 && a2.lit.length > 0 && !same,
    "T6 · scrolling the list changes which marks are lit: at " + a1.year +
    " " + a1.lit.length + " lit " + JSON.stringify(a1.lit.slice(0, 4)) +
    " · at " + a2.year + " " + a2.lit.length + " lit " +
    JSON.stringify(a2.lit.slice(0, 4)));
  /* AND THE LIT SET IS EXACTLY THE VISIBLE ROWS' PLACES — the strong form of
     the check, and the one that caught the round's only real bug. The first
     build measured the rows with `offsetTop`, which is relative to the nearest
     POSITIONED ancestor and therefore to <body> here: 308 px out at 390x844,
     which lit three rows' worth of the WRONG places. A count-only check passed
     it, because a wrong six is still a six.

     THE EXPECTATION IS BUILT FROM THE RENDERED ROWS, by rect, with two
     exclusions that are the page's own law and not a fudge:
       · the record on the page wears the FULL ring, never the lit one;
       · a mark on the FAR SIDE of the earth has no ink written at all
         ("a mark behind the earth cannot be seen" — ui/atlas.js paint()), so
         a row for Tokyo lights nothing while Tokyo is behind the globe. That
         is the page being right, and a gate that expected a ring there would
         be the harness lying. */
  const t6 = await p.evaluate(() => {
    const idx = document.getElementById("atlasIndex");
    const box = idx.getBoundingClientRect();
    const vis = [...document.querySelectorAll("#atlasIndexRows li")]
      .filter((n) => { const q = n.getBoundingClientRect();
                       return q.bottom > box.top + 1 && q.top < box.bottom - 1; });
    const here = [...document.querySelectorAll("#atlasMap .place")]
      .filter((g) => g.querySelector(".ring").getAttribute("opacity") === "1")
      .map((g) => g.dataset.place);
    const near = new Set([...document.querySelectorAll(
      '#atlasMap .place[data-when="1"][data-far="0"]')].map((g) => g.dataset.place));
    const want = [...new Set(vis.map((n) => n.dataset.place).filter(Boolean))]
      .filter((n) => near.has(n) && !here.includes(n)).sort();
    const lit = [...document.querySelectorAll("#atlasMap .place")]
      .filter((g) => g.querySelector(".ring").getAttribute("opacity") === "0.45")
      .map((g) => g.dataset.place).sort();
    return { rows: vis.length, want, lit };
  });
  check(JSON.stringify(t6.lit) === JSON.stringify(t6.want) && t6.want.length > 0,
    "T6 · …and the lit marks are EXACTLY the visible rows' near-side places: " +
    t6.rows + " rows on screen -> " + JSON.stringify(t6.want) + ", lit " +
    JSON.stringify(t6.lit));
  /* AND THE RING KEEPS ITS TWO STRENGTHS APART. The record the page is playing
     wears the full ring and never the half one, however far the reader has
     scrolled — one vocabulary, two intensities, and the stronger one wins. */
  check(a2.here.length <= 1 && !a2.lit.includes(a2.here[0]),
    "T6 · …and the record on the page keeps the FULL ring, never the lit one (" +
    JSON.stringify(a2.here) + ")");

  /* ---- T7 A TAP ON A PLACE PLAYS IT AND ARRIVES AT IT ----------------- */
  /* Paul: *"When I tap a place start playing and zoom in the map on that
     place."* THREE NUMBERS AND NOT AN EYE:
       · the ARC — how much of the earth the box shows — must fall, and it
         must land at `ARRIVE` (20 degrees, this file's own "you are reading
         one city" zoom);
       · the mark's centre must end within a pixel of the map's centre, which
         is what "on that place" means geometrically;
       · the mark must be BIGGER, and this is the one number in the round that
         needed correcting rather than assuming. THE DOT DELIBERATELY SHRINKS
         AS YOU ARRIVE — ui/atlas.js: "6 CSS px of radius at the whole earth,
         where a dot is the only thing marking a city; 4 at a city, where the
         coastline under it is doing that job" — so a check that measured the
         dot would fail a page that is behaving exactly as designed. What grows
         is the TAP BOX (HIT_MIN 15 -> HIT_MAX 23 CSS px, reached at arc <= 20),
         and the mark's bounding rect is the union of its circles, so the rect
         is the honest reading of "larger".
     AND THE TRANSPORT MUST BE RUNNING, read off #play's own accessible name,
     which is the word for the NEXT tap: "stop" means it is playing. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  await goTo(1969);
  const before7 = await p.evaluate(() => {
    const g = document.querySelector('#atlasMap .place[data-place="Kingston"]');
    const r = g.getBoundingClientRect();
    const m = document.getElementById("atlasMap").getBoundingClientRect();
    return { arc: +document.getElementById("atlasMap").dataset.arc,
             w: +r.width.toFixed(2),
             dx: +Math.abs(r.x + r.width / 2 - (m.x + m.width / 2)).toFixed(2),
             dy: +Math.abs(r.y + r.height / 2 - (m.y + m.height / 2)).toFixed(2),
             play: document.getElementById("play").getAttribute("aria-label"),
             title: document.title,
             at: { x: r.x + r.width / 2, y: r.y + r.height / 2 } };
  });
  await p.mouse.click(before7.at.x, before7.at.y);
  await p.waitForTimeout(2600);
  const after7 = await p.evaluate(() => {
    const g = document.querySelector('#atlasMap .place[data-place="Kingston"]');
    const r = g.getBoundingClientRect();
    const m = document.getElementById("atlasMap").getBoundingClientRect();
    return { arc: +document.getElementById("atlasMap").dataset.arc,
             w: +r.width.toFixed(2),
             dx: +Math.abs(r.x + r.width / 2 - (m.x + m.width / 2)).toFixed(2),
             dy: +Math.abs(r.y + r.height / 2 - (m.y + m.height / 2)).toFixed(2),
             play: document.getElementById("play").getAttribute("aria-label"),
             title: document.title };
  });
  check(after7.title === "Kingston 1969" && after7.play === "stop",
    "T7 · a tap on a place writes its record AND starts it: the page is " +
    JSON.stringify(after7.title) + " and #play says " +
    JSON.stringify(after7.play) + " (it said " + JSON.stringify(before7.play) +
    " on " + JSON.stringify(before7.title) + ")");
  check(after7.arc === 20 && after7.arc < before7.arc,
    "T7 · …and the map zooms in on it: arc " + before7.arc + "° -> " +
    after7.arc + "°");
  check(after7.dx <= 1 && after7.dy <= 1,
    "T7 · …the mark ends CENTRED: " + before7.dx + "/" + before7.dy +
    " px from the map's middle -> " + after7.dx + "/" + after7.dy);
  check(after7.w > before7.w,
    "T7 · …and LARGER, measured on its tap box, which is what grows when you " +
    "arrive (the dot itself shrinks on purpose): " + before7.w + " -> " +
    after7.w + " CSS px");

  /* ---- T8 THE ? MARK EXPLAINS THE RECORD'S GENRE ----------------------- */
  /* Paul, 2026-08-30: *"add a ? Icon above the log icon that fully explains
     every aspect of a genre."* Every assertion below is against the RENDERED
     panel, and the strong checks are byte-for-byte against the tables that
     own the facts (genres.js `cannot`, atlas.js EXCLUDE) — the panel's whole
     law is extraction, so the gate holds it to the extracted bytes. */

  /* T8a — the mark is in the foot at EVERY level, directly above the log.
     The same walk T2 does: entering a tab IS entering its level. */
  const t8a = await p.evaluate(() => {
    const at = (where) => {
      const q = document.querySelector('#nu-tray .nu-trayfoot [data-k="explain"]');
      const log = document.querySelector('#nu-tray .nu-trayfoot [data-k="logger"]');
      const above = q && log &&
        !!(q.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        q.getBoundingClientRect().bottom <= log.getBoundingClientRect().top + 1;
      return { where, there: !!q, above,
               exp: q ? q.getAttribute("aria-expanded") : null };
    };
    const out = [at("root")];
    for (const name of window.__eightTabs()) {
      window.__eightTab(name); out.push(at(name));
    }
    window.__eightUp(); window.__eightUp();
    return out;
  });
  const t8bad = t8a.filter((r) => !r.there || !r.above || r.exp == null);
  check(!t8bad.length,
    "T8 · the ? mark is in the foot, directly above the log, wearing " +
    "aria-expanded, at every level (" + t8a.length + " stops" +
    (t8bad.length ? "; missing at " + JSON.stringify(t8bad) : "") + ")");

  /* T8b — it opens, the page is the eight axes, and the record is playing
     from T7, so a playing second must not move a byte of it: the [data-live]
     law read off the artifact (the panel is outside #app and outside every
     [data-live] subtree; only a hand may write it). */
  await p.evaluate(() => document.getElementById("explain").click());
  await p.waitForTimeout(200);
  const t8b = await p.evaluate(() => {
    const q = document.getElementById("explain");
    const pn = document.getElementById("nu-explain");
    return { exp: q.getAttribute("aria-expanded"),
             open: !!pn && !pn.hidden,
             heads: pn ? [...pn.querySelectorAll("h3")].map((h) => h.textContent) : [],
             bytes: pn ? pn.innerHTML : "",
             playing: document.getElementById("play").getAttribute("aria-label") };
  });
  const AXES8 = ["Time", "Alphabet", "Material", "Form",
                 "Development", "Cast", "Sound", "Performance"];
  check(t8b.exp === "true" && t8b.open,
    "T8 · the ? opens its page and says so (aria-expanded " + t8b.exp + ")");
  check(AXES8.every((a) => t8b.heads.includes(a)),
    "T8 · …organized by the eight axes: headings " + JSON.stringify(t8b.heads));
  await p.waitForTimeout(1200);
  const t8live = await p.evaluate(() => ({
    bytes: document.getElementById("nu-explain").innerHTML,
    playing: document.getElementById("play").getAttribute("aria-label") }));
  check(t8b.playing === "stop" && t8live.playing === "stop" &&
        t8live.bytes === t8b.bytes,
    "T8 · …and a playing second moved ZERO bytes of the open panel " +
    "(the [data-live] law; " + t8b.bytes.length + " bytes, #play says " +
    JSON.stringify(t8live.playing) + ")");

  /* T8c — a parent is a door: tapping it navigates through the atlas door
     (the list rows' own seam) and the panel follows the record. */
  const t8pre = await p.evaluate(() => {
    const b = document.querySelector("#nu-explain .nu-xgo[data-gk]");
    return { basis: window.__eightDoc().basis,
             gk: b ? b.dataset.gk : null,
             label: b && window.NuGenres.GENRES[b.dataset.gk]
               ? window.NuGenres.GENRES[b.dataset.gk].label : null };
  });
  check(!!t8pre.gk,
    "T8 · the panel for " + JSON.stringify(t8pre.basis) +
    " offers a tappable relation (" + JSON.stringify(t8pre.gk) + ")");
  await p.evaluate(() =>
    document.querySelector("#nu-explain .nu-xgo[data-gk]").click());
  await p.waitForTimeout(900);
  const t8c = await p.evaluate(() => ({
    basis: window.__eightDoc().basis,
    title: document.title,
    open: !document.getElementById("nu-explain").hidden,
    h2: (document.querySelector("#nu-explain h2") || {}).textContent }));
  check(t8c.basis === t8pre.gk && t8c.title === t8pre.label &&
        t8c.open && t8c.h2 === t8pre.label,
    "T8 · …tapping it NAVIGATES and the open panel follows: basis " +
    JSON.stringify(t8pre.basis) + " -> " + JSON.stringify(t8c.basis) +
    ", page " + JSON.stringify(t8c.title) + ", panel h2 " +
    JSON.stringify(t8c.h2));

  /* T8d — hohlefels: the `cannot` is shown VERBATIM (the row's own bytes),
     and a root renders honestly (parents: {} says so, it does not grey). */
  await p.evaluate(() =>
    document.querySelector('.nu-ixrow[data-gk="hohlefels"]').click());
  await p.waitForTimeout(900);
  const t8d = await p.evaluate(() => {
    const pn = document.getElementById("nu-explain");
    return { basis: window.__eightDoc().basis,
             open: !pn.hidden,
             cannot: [...pn.querySelectorAll(".nu-xcannot li")]
               .map((n) => n.textContent),
             want: window.NuGenres.GENRES.hohlefels.cannot,
             root: /none declared/.test(pn.textContent) };
  });
  check(t8d.basis === "hohlefels" && t8d.open &&
        JSON.stringify(t8d.cannot) === JSON.stringify(t8d.want) &&
        t8d.want.length === 3,
    "T8 · hohlefels shows what the box CANNOT say, verbatim against " +
    "genres.js (" + t8d.cannot.length + " of " +
    (t8d.want || []).length + " admissions, byte-equal " +
    (JSON.stringify(t8d.cannot) === JSON.stringify(t8d.want)) + ")");
  check(t8d.root,
    "T8 · …and a record with no parents says so (a root, declared, not a blank)");

  /* ---- T8h THE FORM REVERSAL (Paul, 2026-08-30) ------------------------ */
  /* "The question mark icon produces tons of stuff but it's hard to parse.
     It should be in tables and give a sense of what leads into what. It's
     very repetitive." MEASURED ON THE SHIPPED PANEL before the rewrite
     (2026-08-30, waltz open, text-node probe): "as written" printed 41
     times, "a line, 12 steps" 8 times, "the row says" 3 times, 3229 chars —
     those numbers are the dated record of what "very repetitive" was. The
     checks below hold each of the three sentences to the RENDERED panel on
     the same deep record (waltz: three generations up, two children). */
  await p.evaluate(() =>
    document.querySelector('.nu-ixrow[data-gk="waltz"]').click());
  await p.waitForTimeout(900);
  const t8h = await p.evaluate(() => {
    const pn = document.getElementById("nu-explain");
    /* 1 · "what leads into what": the flow is the panel's FIRST section,
       ancestors above, the bold record between, children below, every
       generation ordered by its lines' own data-year stamps */
    const firstH3 = pn.querySelector("h3").textContent;
    const kin = [...pn.querySelectorAll(".nu-xkin")].map((n) => ({
      d: +n.style.getPropertyValue("--d") || 0,
      dir: n.dataset.dir || (n.classList.contains("nu-xme") ? "me" : null),
      year: n.dataset.year != null ? +n.dataset.year : null }));
    const ups = kin.filter((k) => k.dir === "up");
    const downs = kin.filter((k) => k.dir === "down");
    const meAt = kin.findIndex((k) => k.dir === "me");
    const genOrdered = (rows) => {
      const byD = {};
      rows.forEach((r) => (byD[r.d] = byD[r.d] || []).push(r.year));
      return Object.keys(byD).every((d) => byD[d].every((y, i) =>
        !i || y == null || byD[d][i - 1] == null || byD[d][i - 1] <= y));
    };
    /* 2 · "in tables": eight of them, in the page's own table language, and
       no row whose every value cell is blank (a table of dashes is noise) */
    const tables = pn.querySelectorAll("table").length;
    let emptyRows = 0;
    pn.querySelectorAll("table tr").forEach((tr) => {
      const tds = [...tr.querySelectorAll("td")].slice(1);
      if (tr.querySelector("td") && tds.length &&
          tds.every((td) => !td.textContent.trim())) emptyRows++;
    });
    /* 3 · "very repetitive", as a bound: no text node of 10+ chars may
       appear more than 3 times (the shipped panel had one at 8), and
       "as written" is bounded by the voice rows — each voice's plan says
       it at most once now, counted, never chanted (it was 41) */
    const counts = {};
    const walk = (n) => { for (const c of n.childNodes) {
      if (c.nodeType === 3) { const t = c.textContent.trim();
        if (t.length >= 10) counts[t] = (counts[t] || 0) + 1; }
      else walk(c); } };
    walk(pn);
    const worst = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const txt = pn.textContent;
    let i = 0, aw = 0;
    while ((i = txt.indexOf("as written", i)) >= 0) { aw++; i += 10; }
    const voices = (window.__eightDoc().voices || []).length;
    /* and the thumb's way down the long panel: eight one-word anchors that
       scroll the PANEL, never the page */
    const jumps = [...pn.querySelectorAll(".nu-xjump")].map((b) => b.textContent);
    const wasAt = pn.scrollTop;
    const snd = [...pn.querySelectorAll(".nu-xjump")]
      .find((b) => b.textContent === "Sound");
    if (snd) snd.click();
    return { basis: window.__eightDoc().basis, firstH3,
             ups: ups.length, downs: downs.length, meAt,
             upGens: new Set(ups.map((k) => k.d)).size,
             ordered: genOrdered(ups) && genOrdered(downs),
             tables, emptyRows, worst, aw, voices, jumps,
             wasAt, jumped: pn.scrollTop, pageY: window.scrollY };
  });
  check(t8h.basis === "waltz" && t8h.firstH3 === "Lineage" &&
        t8h.ups >= 1 && t8h.upGens >= 2 && t8h.meAt > 0 && t8h.downs >= 1,
    "T8h · the LINEAGE FLOW is the hero: first heading " +
    JSON.stringify(t8h.firstH3) + ", " + t8h.ups + " ancestors over " +
    t8h.upGens + " generations ABOVE, the record between (line " +
    t8h.meAt + "), " + t8h.downs + " children BELOW");
  check(t8h.ordered,
    "T8h · …and every generation reads oldest-first by its own data-year");
  check(t8h.tables === 8 && t8h.emptyRows === 0,
    "T8h · the eight axes are eight TABLES with no all-empty row (" +
    t8h.tables + " tables, " + t8h.emptyRows + " blank rows)");
  check((!t8h.worst || t8h.worst[1] <= 3) && t8h.aw <= t8h.voices + 1,
    "T8h · the repetition probe passes where the shipped panel failed " +
    "(was 41ד as written”, 8ד a line, 12 steps”): worst 10+-char dupe " +
    JSON.stringify(t8h.worst) + ", “as written” ×" + t8h.aw +
    " <= voices+1 (" + (t8h.voices + 1) + ")");
  check(t8h.jumps.length === 8 && t8h.jumped > t8h.wasAt && t8h.pageY === 0,
    "T8h · the eight-word anchor strip jumps WITHIN the panel: scrollTop " +
    t8h.wasAt + " -> " + t8h.jumped + ", page still at " + t8h.pageY +
    " (" + t8h.jumps.join(" ") + ")");

  /* T8e — the widths and the thumb: no sideways scroll at FIVE widths with
     the panel open (five since 2026-08-30 — the tables and the flow's
     indents are new geometry), and a tappable relation is 44px of target. */
  const t8widths = {};
  for (const wpx of [320, 375, 390, 430, 1280]) {
    await p.setViewportSize({ width: wpx, height: wpx > 1000 ? 900 : 700 });
    await p.waitForTimeout(350);
    t8widths[wpx] = await p.evaluate(() =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth);
  }
  await p.setViewportSize({ width: 320, height: 700 });
  await p.waitForTimeout(300);
  const t8e = await p.evaluate(() => {
    const b = document.querySelector("#nu-explain button.nu-xgo");
    return { target: b ? b.getBoundingClientRect().height : 0 };
  });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(300);
  check(Object.values(t8widths).every((v) => v === 0),
    "T8 · nothing scrolls sideways with the panel open at any of the five " +
    "widths " + JSON.stringify(t8widths));
  check(t8e.target >= 44,
    "T8 · …and a tappable relation is a thumb's target at 320: " +
    t8e.target.toFixed(1) + " px >= 44");

  /* T8f — a ROLE renders honestly: EXCLUDE's own sentence, verbatim. */
  await p.evaluate(() =>
    document.querySelector('.nu-ixrow[data-gk="pad"]').click());
  await p.waitForTimeout(900);
  const t8f = await p.evaluate(() => {
    const pn = document.getElementById("nu-explain");
    return { basis: window.__eightDoc().basis,
             text: pn.textContent,
             want: "a role has a job, not a history — " +
                   window.NuAtlas.EXCLUDE.pad };
  });
  check(t8f.basis === "pad" && t8f.text.includes(t8f.want),
    "T8 · a role shows EXCLUDE's own sentence verbatim: " +
    JSON.stringify(t8f.want));

  /* T8g — and it CLOSES cleanly, both ways: the toggle and Escape. */
  await p.evaluate(() => document.getElementById("explain").click());
  const t8shut = await p.evaluate(() => ({
    exp: document.getElementById("explain").getAttribute("aria-expanded"),
    hid: document.getElementById("nu-explain").hidden }));
  await p.evaluate(() => document.getElementById("explain").click());
  await p.keyboard.press("Escape");
  const t8esc = await p.evaluate(() => ({
    exp: document.getElementById("explain").getAttribute("aria-expanded"),
    hid: document.getElementById("nu-explain").hidden }));
  check(t8shut.exp === "false" && t8shut.hid &&
        t8esc.exp === "false" && t8esc.hid,
    "T8 · it closes on the toggle AND on Escape, and aria-expanded says so " +
    "(toggle " + t8shut.exp + "/" + t8shut.hid + ", Escape " + t8esc.exp +
    "/" + t8esc.hid + ")");

  check(!errs.length,
    "T· zero pageerrors / console errors " + JSON.stringify(errs.slice(0, 3)));

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  const ok = notes.filter((n) => /^ok/.test(n)).length;
  console.log(fails.length ? "\nFAILED " + fails.length + " of " + (ok + fails.length)
    : "\nALL PASS (" + ok + " checks)  " + PAGE);
  await b.close();
  if (srv) srv.proc.kill();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
