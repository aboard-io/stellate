/* ===== THE NAV TREE — the gutter, expanded (2026-09-02) ==================
 *
 * Paul, the composer round: *"The left nav is very good. I think it should be
 * bigger with bigger type and we should really work hard on nesting options
 * inside the left nav … keeping everything vertically scrollable and usable.
 * We should never need the 'up' icon because we can expand multiple levels of
 * interface option."* And: *"Move the play/stop button to the bottom, along
 * with opts and where."* And: *"I need you to light them up when playing them
 * actively in the nav."*
 *
 * WHY THIS IS ITS OWN GATE AND NOT A CLAUSE IN test/shell.js. shell sweeps the
 * whole page at five widths and asks the stripe one question per tab; what a
 * TREE can newly get wrong is a shape you have to BUILD — two branches open at
 * once, a child four rows below its parent, a mark that stayed on an ancestor,
 * a lamp that never goes out. Every one of those needs a page driven into a
 * state on purpose, which is what this file does.
 *
 * N1  no ↑ anywhere, at any depth, on any tab — it is ABSENT, not disabled
 * N2  two branches stand open together: two `aria-expanded="true"` ancestors,
 *     both their children on the stripe at depth 1, and exactly ONE <mark>
 * N3  a branch of ACTIONS marks nothing — its rows carry no aria-pressed at
 *     all (the 2026-08-28 law: fourteen `aria-pressed="false"` buttons would
 *     tell a screen reader there is a state to be in)
 * N4  every mark in the gutter is a thumb (44px) and the stripe is ONE column
 *     that never scrolls sideways, at 320 / 375 / 430 / 1280
 * N5  the foot reads where · seed · ? · log · opts · play, and #play is the
 *     LAST child of the foot in every state the tree can be in
 * N6  a band member LIGHTS UP while it sounds and goes dark when the record
 *     stops — a class on the button, never a <mark>, and it is the playhead's
 *     red and not the meter's green
 * N7  the list is the ONE thing that shrinks: with Band expanded at 390x844 the
 *     stripe overflows, `.nu-traylist` clips it (scrollHeight > clientHeight),
 *     and once it is scrolled to its end the LAST row stands clear of the foot
 *     and `elementFromPoint` on its centre answers that row and not the foot's
 *     genre plate. Written 2026-09-02 against the probe report's defect 1 —
 *     *"The nav list draws UNDERNEATH the pinned foot and those rows cannot be
 *     tapped"* — which measured the last row's layout box while it was scrolled
 *     out of view and read a clipped row as an unclipped one. nu.css carries
 *     the whole re-measurement beside `.nu-traylist`.
 *
 * RUN:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/nav-tree.js
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

/* serve.sh's handler exactly, on a port the OS gives us (test/all.js's own, and
   test/gutter.js's — the ring engine wants a SharedArrayBuffer and a page that
   is not cross-origin isolated is a different page from the one that ships). */
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

const WIDTHS = [320, 375, 430, 1280];
const RECORD = "#at=Kingston&y=1969&s=1";

(async () => {
  const srv = PAGE_ARG ? null : await standUpServer();
  const BASE = PAGE_ARG ||
    ("http://localhost:" + srv.port + "/nukernel/index.html");
  const b = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 },
                              hasTouch: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

  /* THE RECORD IS NAMED IN THE ADDRESS AND SO IS ITS SEED. The box boots on
     the BLANK STATE now (Paul: "Add a 'silence' genre … This is a blank
     state"), which has no players — and a gate about band members needs a
     band. `s=1` because a fragment that names a place and no seed would draw
     one, and a gate that re-rolls its own subject is a gate that measures a
     different record every run. */
  await p.goto(BASE + RECORD, { waitUntil: "load" });
  await p.waitForTimeout(3000);

  const tree = () => p.evaluate(() => window.__eightTree());

  /* ---- N1 THERE IS NO ↑, ANYWHERE ------------------------------------ */
  /* It is ABSENT and not a dead button, which is the 2026-08-28 refusal of a
     disabled ↑ kept whole — "a permanently dead 44px target at the head of a
     56px column is the most expensive furniture on this page" — and extended:
     there is no level to go up FROM. Asked on every tab, because the old ↑ was
     drawn by a level's own head and a leftover would only appear on one. */
  const upFound = await p.evaluate(async () => {
    const seen = [];
    for (const name of window.__eightTabs()) {
      window.__eightTab(name);
      await new Promise((r) => setTimeout(r, 60));
      if (document.querySelector('[data-k="trayup"]')) seen.push(name);
    }
    return seen;
  });
  check(upFound.length === 0,
    "N1 · there is no ↑ on any tab — it is absent, not a dead button " +
    JSON.stringify(upFound));

  /* ---- N2 TWO BRANCHES OPEN AT ONCE ---------------------------------- */
  /* THE WHOLE ASK, IN ONE STATE: open Band, open Structure, and both stand.
     Driven through the BUTTONS a thumb presses — a walk that expanded through
     `__eightExpand` would be proving the probe agrees with itself. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  await p.click('[data-k="toptab-Band"]');
  await p.waitForTimeout(700);
  await p.click('[data-k="toptab-Structure"]');
  await p.waitForTimeout(700);
  const two = await p.evaluate(() => {
    const T = window.__eightTree();
    const doors = [...document.querySelectorAll('#nu-tray [aria-expanded="true"]')]
      .map((x) => x.dataset.k || x.id).filter((k) => k !== "playops");
    return { doors,
      band: T.rows.filter((r) => r.depth === 1 && /^tab/.test(r.key)).length,
      secs: T.rows.filter((r) => r.depth === 1 && /^secnav/.test(r.key)).length,
      marks: document.querySelectorAll("#nu-tray mark").length,
      pressed: [...document.querySelectorAll('#nu-tray [aria-pressed="true"]')]
        .map((x) => x.dataset.k || x.id),
      on: T.mark };
  });
  check(two.doors.length === 2 && two.band > 0 && two.secs > 0,
    "N2 · Band and Structure stand open together — " + two.doors.length +
    " expanded ancestors (" + JSON.stringify(two.doors) + "), " + two.band +
    " member rows and " + two.secs + " section rows on the stripe at once");
  check(two.marks === 1 && two.pressed.length === 1 &&
        two.pressed[0] === two.on,
    "N2 · …and exactly ONE <mark> and one aria-pressed, on the deepest open " +
    "thing inside the tab you are standing in (" + JSON.stringify(two.on) + ")");

  /* ---- N3 A BRANCH OF ACTIONS MARKS NOTHING -------------------------- */
  /* The 2026-08-28 law, re-made about a BRANCH instead of a level: "fourteen
     `aria-pressed="false"` buttons would tell a screen reader there is a state
     to be in". The motif transforms are the branch that has always carried it;
     the section's three operations are the other one. What says where you are
     is the branch's own mark, which IS pressed — that is the part the tree
     changed, and it is asserted here rather than assumed. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  await p.click('[data-k="toptab-Motif"]');
  await p.waitForTimeout(700);
  const cellKey = await p.evaluate(() => {
    const T = window.__eightTree();
    return (T.rows.find((r) => /^motiftab-/.test(r.key)) || {}).key || null;
  });
  if (!cellKey) check(false, "N3 · no motif row to open");
  else {
    await p.click('[data-k="' + cellKey + '"]');
    await p.waitForTimeout(500);
    const acts = await p.evaluate((k) => {
      const T = window.__eightTree();
      const kids = T.rows.filter((r) => r.depth === 2);
      const pressed = kids.filter((r) => {
        const b = document.querySelector('[data-k="' + r.key + '"]');
        return b && b.hasAttribute("aria-pressed");
      }).map((r) => r.key);
      const par = document.querySelector('[data-k="' + k + '"]');
      return { n: kids.length, acts: kids.every((r) => r.acts), pressed,
               parentPressed: par ? par.getAttribute("aria-pressed") : null,
               marks: document.querySelectorAll("#nu-tray mark").length };
    }, cellKey);
    check(acts.n > 0 && acts.acts && acts.pressed.length === 0 &&
          acts.parentPressed === "true" && acts.marks === 1,
      "N3 · the open motif's " + acts.n + " transforms are a branch of ACTIONS: " +
      "not one of them carries aria-pressed, and the mark is on the motif " +
      "itself (" + JSON.stringify(acts) + ")");
  }

  /* ---- N4 EVERY MARK IS A THUMB AND THE STRIPE IS ONE COLUMN --------- */
  /* At the four widths `--tray-w`'s clamp bends at: 320 and 375 below the
     96px hinge (the mark is a column), 430 above it (the mark is a row), and
     1280 at the ceiling. Measured with two branches OPEN, because that is the
     state a bigger column and a deeper indent could newly break — an indent
     that moved a button's own left would make the stripe two columns, which is
     the bug nu.css's 2026-09-01 refusal of a 10px MARGIN was written about. */
  const widths = [];
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: 844 });
    await p.waitForTimeout(400);
    await p.evaluate(async () => {
      window.__eightUp();
      await new Promise((r) => setTimeout(r, 100));
      const band = document.querySelector('[data-k="toptab-Band"]');
      if (band) band.click();
      await new Promise((r) => setTimeout(r, 400));
      const st = document.querySelector('[data-k="toptab-Structure"]');
      if (st) st.click();
    });
    await p.waitForTimeout(700);
    widths.push(await p.evaluate((w2) => {
      const list = document.querySelector(".nu-traylist");
      const lefts = new Set(); let minTap = 999;
      for (const b of document.querySelectorAll("#nu-tray button")) {
        if (!b.getClientRects().length) continue;
        const r = b.getBoundingClientRect();
        lefts.add(Math.round(r.left));
        minTap = Math.min(minTap, r.height);
      }
      return { w: w2, cols: lefts.size, minTap: +minTap.toFixed(1),
               listSide: list.scrollWidth - list.clientWidth,
               page: document.documentElement.scrollWidth -
                     document.documentElement.clientWidth,
               rows: window.__eightTree().rows.length };
    }, w));
  }
  const badW = widths.filter((r) => r.cols !== 1 || r.minTap < 44 ||
                                    r.listSide !== 0 || r.page !== 0);
  check(badW.length === 0,
    "N4 · with two branches open the stripe is ONE column, every mark is 44+, " +
    "and nothing scrolls sideways at 320/375/430/1280 — " +
    JSON.stringify(widths) + (badW.length ? " · BAD " + JSON.stringify(badW) : ""));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(400);

  /* ---- N5 THE FOOT, AND #play IS THE LAST THING IN IT ----------------- */
  /* Paul: *"Move the play/stop button to the bottom, along with opts and
     where."* The foot is at the floor because it is LAST and #play is at the
     floor of the foot for the same reason — no `position`, no `margin: auto`.
     Asserted in EVERY state the tree can be in, because the one thing a
     repaint could do to it is reorder the box it never touches. */
  const feet = await p.evaluate(async () => {
    const seen = [], bad = [];
    const read = (where) => {
      const f = document.querySelector(".nu-trayfoot");
      const kids = [...f.children].map((n) =>
        n.id || n.dataset.k || n.className || n.tagName.toLowerCase());
      const want = ["toptab-Where", "rewrite", "explain", "logger",
                    "playops", "play"];
      const at = want.map((k) => kids.indexOf(k));
      const ok = at.every((n, i) => n >= 0 && (i === 0 || n > at[i - 1])) &&
                 f.lastElementChild.id === "play";
      seen.push(where);
      if (!ok) bad.push([where, kids]);
    };
    read("boot");
    for (const name of window.__eightTabs()) {
      window.__eightTab(name);
      await new Promise((r) => setTimeout(r, 80));
      read(name);
    }
    document.getElementById("playops").click();
    await new Promise((r) => setTimeout(r, 150));
    read("opts open");
    document.getElementById("playops").click();
    await new Promise((r) => setTimeout(r, 100));
    return { seen: seen.length, bad };
  });
  check(feet.bad.length === 0,
    "N5 · the foot reads where · seed · ? · log · opts · play and #play is its " +
    "last child, in all " + feet.seen + " states — " + JSON.stringify(feet.bad));

  /* ---- N6 A BAND MEMBER LIGHTS UP WHILE IT SOUNDS -------------------- */
  /* Paul: *"I need you to light them up when playing them actively in the
     nav."*  It is a CLASS on the button and never a <mark>: the mark means the
     open thing, and a record with six players sounding would be six marks and
     a lie about where you are. So this reads the class, asserts that no extra
     <mark> appeared with it, and asserts that it GOES OUT — a lamp that cannot
     turn off is the "declared but never arriving" bug from the other end.
     THE RECORD IS THE ONE IN THE ADDRESS, playing from #play, and the gate
     waits for the lamp rather than sleeping a fixed time: the engine has a
     real runway (audio/live.js) and a fixed sleep would be a coin toss. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  await p.click('[data-k="toptab-Band"]');
  await p.waitForTimeout(700);
  const members = await p.evaluate(() =>
    window.__eightTree().rows.filter((r) => r.depth === 1 && /^tab/.test(r.key))
      .map((r) => r.key));
  await p.evaluate(() => document.getElementById("play").click());
  const lit = await p.waitForFunction(
    () => document.querySelectorAll(".nu-traylist .is-sounding").length > 0,
    null, { timeout: 6000 }).then(() => true).catch(() => false);
  const onNow = await p.evaluate(() => ({
    lit: [...document.querySelectorAll("#nu-tray .is-sounding")]
      .map((b) => b.dataset.k),
    marks: document.querySelectorAll("#nu-tray mark").length,
    pressedLit: [...document.querySelectorAll("#nu-tray .is-sounding")]
      .filter((b) => b.getAttribute("aria-pressed") === "true").length,
    /* THE PAINT IS THE PLAYHEAD'S RED AND NOT THE METER'S GREEN, read off the
       rendered box shadow rather than off the class list: `--clock` means "this
       is where the record is" and `--meter` means "a number came back from the
       engine", and this is a schedule, not a measurement. */
    shadow: (() => { const b = document.querySelector("#nu-tray .is-sounding");
      return b ? getComputedStyle(b).boxShadow : null; })(),
    clock: getComputedStyle(document.documentElement)
      .getPropertyValue("--clock").trim(),
    meter: getComputedStyle(document.documentElement)
      .getPropertyValue("--meter").trim() }));
  check(lit && onNow.lit.length > 0 && members.length > 0 &&
        onNow.lit.every((k) => members.indexOf(k) >= 0),
    "N6 · a band member lights up within 6 s of #play on the record in the " +
    "address: " + JSON.stringify(onNow.lit) + " of " + JSON.stringify(members));
  check(onNow.marks === 1 && onNow.pressedLit <= 1,
    "N6 · …and the lamp is a CLASS, not a mark: still exactly one <mark> in " +
    "the stripe (" + onNow.marks + ")");
  const rgb = (v) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(v);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return "rgb(" + (n >> 16) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ")";
  };
  check(!!onNow.shadow && onNow.shadow !== "none" &&
        (!rgb(onNow.clock) || onNow.shadow.indexOf(rgb(onNow.clock)) >= 0) &&
        (!rgb(onNow.meter) || onNow.shadow.indexOf(rgb(onNow.meter)) < 0),
    "N6 · …and it is the playhead's red (--clock " + onNow.clock + "), never " +
    "the measured green (--meter " + onNow.meter + "): " +
    JSON.stringify(onNow.shadow));
  await p.evaluate(() => document.getElementById("play").click());
  const dark = await p.waitForFunction(
    () => document.querySelectorAll("#nu-tray .is-sounding").length === 0,
    null, { timeout: 6000 }).then(() => true).catch(() => false);
  check(dark,
    "N6 · …and every lamp goes out when the record stops");

  /* ---- N7 THE LIST SHRINKS, THE FOOT DOES NOT ------------------------ */
  /* The foot is `flex: 0 0 auto` and LAST; the list is the only `flex: 1 1
     auto` in the stripe and carries `min-block-size: 0` so it may shrink below
     its content. Those three facts together are what makes a tall tree ONE
     stripe instead of a column of rows drawn over the transport. This asserts
     them the only way that means anything — by driving the stripe into a state
     that overflows and then reaching for the row at the bottom of it. */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  await p.click('[data-k="toptab-Band"]');
  await p.waitForTimeout(700);
  const shrink = await p.evaluate(() => {
    const list = document.querySelector(".nu-traylist");
    const foot = document.querySelector(".nu-trayfoot");
    const cs = getComputedStyle(list), fs = getComputedStyle(foot);
    const before = { over: list.scrollHeight - list.clientHeight,
                     rows: list.children.length,
                     grow: cs.flexGrow, shrink: cs.flexShrink,
                     min: cs.minBlockSize, ovf: cs.overflowY,
                     footGrow: fs.flexGrow, footShrink: fs.flexShrink,
                     footLast: document.querySelector("#nu-tray")
                       .lastElementChild === foot };
    list.scrollTop = list.scrollHeight;         // a thumb-swipe to the end
    const last = list.lastElementChild;
    const r = last.getBoundingClientRect();
    const f = foot.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2,
                                          r.top + r.height / 2);
    return { ...before, lastK: last.dataset.k,
             clear: +(f.top - r.bottom).toFixed(1),
             hit: hit ? (hit.dataset.k || hit.id || hit.className) : null };
  });
  check(shrink.over > 0 && shrink.shrink !== "0" && shrink.min === "0px" &&
        shrink.ovf === "auto" && shrink.footGrow === "0" &&
        shrink.footShrink === "0" && shrink.footLast,
    "N7 · with Band open the stripe overflows by " + shrink.over + "px over " +
    shrink.rows + " rows and the LIST is the child that shrinks (the foot is " +
    "0 0 auto and last) — " + JSON.stringify(shrink));
  /* `>= -1` AND NOT `>= 0`: the list's own bottom edge and the foot's top edge
     are the same line, and a rect read back off a fractional layout lands a
     tenth of a pixel either side of it (measured: -0.1). The claim is that the
     row is not UNDER the foot, and a tenth of a pixel is not under anything —
     `elementFromPoint` on the row's own centre is the assertion that matters
     and it is the one beside this. */
  check(shrink.clear >= -1 && shrink.hit === shrink.lastK,
    "N7 · …and scrolled to its end the last row (" + shrink.lastK + ") stands " +
    shrink.clear + "px clear of the foot and takes its own tap: " +
    "elementFromPoint says " + JSON.stringify(shrink.hit));

  check(!errs.length, "N· zero pageerrors / console errors " +
    JSON.stringify(errs.slice(0, 4)));

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " +
    (fails.length + notes.length) + " checks"
    : "\nALL PASS (" + notes.length + " checks)  " + BASE);
  await b.close();
  if (srv) srv.proc.kill();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
