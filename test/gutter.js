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
     own items, in Paul's order. The level is reached by pressing #play, which
     is the only way a reader reaches it. */
  await p.evaluate(() => document.getElementById("play").click());
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
    "T3 · pressing #play takes the stripe to the play level, whose ↑ is the " +
    "root (" + JSON.stringify({ level: t3.level, up: t3.up, acts: t3.acts }) + ")");
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
  await p.evaluate(() => document.getElementById("play").click());   // the play level
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
