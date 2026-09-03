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
 * N2  ONE PATH: opening Structure folds Band — one `aria-expanded="true"`
 *     ancestor, only its children on the stripe, and exactly ONE <mark>
 *     (rewritten in place 2026-09-02; the old claim and Paul's reversal of it
 *     are at the check itself)
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
 * N8  A LEVEL LOOKS LIKE ONE: three depths on the stripe wear three inks on
 *     three grounds, monotonically quieter and deeper, each clearing 4.5:1 for
 *     the word AND its second line; the indent is depth x a step of at least
 *     0.7ch, and it is measured NOT to be what clipped any label
 * N9  the MOTIF that is sounding lights up while the record plays and goes
 *     dark on stop — a class plus `aria-current`, never a mark, and a join and
 *     not a floodlight (a cell nobody reads in this section stays dark)
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

  /* ---- N2 ONE PATH, AND ARRIVING SOMEWHERE FOLDS WHERE YOU WERE ------- */
  /* REWRITTEN IN PLACE 2026-09-02 (wave 4). Paul: *"Only allow one expansion
     (or nested expansion) of the left nav at one time."*

     WHAT IT SAID: *"THE WHOLE ASK, IN ONE STATE: open Band, open Structure,
     and both stand."* That was his 2026-08-28 sentence — *"we can expand
     multiple levels of interface option"* — read as a forest, and the plural
     he has now withdrawn is BRANCHES, not LEVELS: root → child → grandchild
     still stand together (N3 and the shell's A6l both drive three deep), but
     one chain of them. The same two taps are made and the assertion is
     inverted, which is what "rewritten in place" means for a gate: opening
     Structure takes Band's branch with it.
     STILL DRIVEN THROUGH THE BUTTONS a thumb presses — a walk that expanded
     through `__eightExpand` would be proving the probe agrees with itself —
     and `T.expanded` is read as the PATH, root first, because that is what
     ui/eight.js `setChain` now guarantees it is. */
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
    /* `tabperformance` IS A CHILD OF STRUCTURE and its key starts with `tab`
       — the address it wore at the band level, kept because an address does
       not move when a row moves (ui/eight.js sectionTrayItems says so). So
       "how many BAND members are on the stripe" cannot be `/^tab/` alone; it
       was harmless while both branches stood and it counts one row too many
       the moment the claim is that Band is folded. */
    return { doors, exp: T.expanded,
      band: T.rows.filter((r) => r.depth === 1 && /^tab/.test(r.key) &&
                                 r.key !== "tabperformance").length,
      secs: T.rows.filter((r) => r.depth === 1 && /^secnav/.test(r.key)).length,
      marks: document.querySelectorAll("#nu-tray mark").length,
      pressed: [...document.querySelectorAll('#nu-tray [aria-pressed="true"]')]
        .map((x) => x.dataset.k || x.id),
      on: T.mark };
  });
  check(two.doors.length === 1 && two.band === 0 && two.secs > 0 &&
        two.exp.length === 1 && two.exp[0] === "toptab-Structure",
    "N2 · opening Structure folds Band; one path — " + two.doors.length +
    " expanded ancestor (" + JSON.stringify(two.doors) + "), " + two.band +
    " member rows and " + two.secs + " section rows on the stripe, the open " +
    "path " + JSON.stringify(two.exp));
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
     1280 at the ceiling. Measured with a branch OPEN, because that is the
     state a bigger column and a deeper indent could newly break — an indent
     that moved a button's own left would make the stripe two columns, which is
     the bug nu.css's 2026-09-01 refusal of a 10px MARGIN was written about.
     (It said "with two branches OPEN" and made two clicks to get them; since
     2026-09-02 the second click FOLDS the first — one path — so the two clicks
     are kept, because what they build is still the deepest state the widths
     have to hold, and the sentence is the one that changed.) */
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
        /* THE SEED ROW IS ONE MARK OF TWO TARGETS (2026-09-03, Paul: "get rid
           of the word seed and put the number. I tap the die and there's a
           new number. I tap the number and I can enter a new number by
           hand"). The die and the number sit side by side in `.nu-seedrow`;
           their shared row's left is the stripe's, so the row is what is
           counted — test/shell.js A6b's own reading. */
        const box = b.closest(".nu-seedrow") || b;
        lefts.add(Math.round(box.getBoundingClientRect().left));
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
    "N4 · with a branch open the stripe is ONE column, every mark is 44+, " +
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
      /* THE ? CAME OUT OF THIS LIST 2026-09-02 (Paul: *"Get rid of explain
         — that's the genre editor's work now."*). It is an ORDER and not an
         index arithmetic, so the retirement is one word deleted; the rest of
         the foot is asserted to be exactly where it was. */
      /* AND `rewrite` BECAME `nu-seedrow` 2026-09-03: the die and the number
         share one foot child (the row), so the foot's order is read at the
         row. The die is still the row's first button (test/seed.js S1). */
      const want = ["toptab-Where", "nu-seedrow", "logger",
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
    "N5 · the foot reads where · die+number · log · opts · play and #play is its " +
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
       engine", and this is a schedule, not a measurement.
       ...AND IT IS THE ROW'S OWN EDGE BAR SINCE 2026-09-02 (wave 4). Paul:
       *"The expanded left nav needs more alignment. Icons run into icons
       now."* Every row in the list reserves a 3px transparent inline-start
       border now, so that a child row's depth bar and a root row's glyph start
       at the same x; the sounding lamp lights THAT bar rather than laying an
       inset shadow inside it, which on a child row would have drawn a second
       3px bar beside the first. One spelling, one bar, one x, at every depth —
       so this reads `border-inline-start-color` and the colour law it is
       asserting has not moved an inch. */
    shadow: (() => { const b = document.querySelector("#nu-tray .is-sounding");
      return b ? getComputedStyle(b).borderInlineStartColor : null; })(),
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
    "N6 · …and its edge bar is the playhead's red (--clock " + onNow.clock +
    "), never " +
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

  /* ---- N8 A LEVEL IS INDENTED, AND IT HAS A COLOUR OF ITS OWN --------- */
  /* Paul, 2026-09-03: *"Indent nav items according to hierarchy level, just
     enough to be obviously visible, and change color by levels of hierarchy."*

     WHAT THIS CAN CATCH THAT A STYLESHEET READING CANNOT. The rules are three
     `color-mix()`es and a token, and every one of them resolves against a
     ground that is decided by the CASCADE — the marked row is cobalt, the
     stripe's own panel is white, and a `:not()` in the wrong place silently
     out-ranks the playhead's lamp. So this reads the RENDERED colour off each
     row, resolves the ground it is actually standing on by walking up until
     something is opaque, and computes the contrast itself. Nothing here is
     read off nu.css.

     THE FOUR CLAIMS:
       · three depths are on the stripe at once and each wears a DISTINCT ink
         on a DISTINCT ground (a depth cue that is one colour is not a depth
         cue — which is exactly what shipped before this round: `--dim` on one
         wash for every child row at every depth);
       · MONOTONIC — the deeper the row the quieter the ink and the deeper the
         ground, so three levels read as a thing inside a thing;
       · every level clears 4.5:1, THE WORD AND ITS SECOND LINE BOTH (the old
         pair measured 4.42 and 4.06, which is how a contrast floor gets lost:
         nobody measured the row, only the token);
       · the indent is exactly `depth × step`, the step is at least 0.7ch of
         the word's own font at the phone width, and IT IS NOT WHAT CLIPPED
         ANYTHING — the set of ellipsised labels at the shipped step is the
         same set as one pixel below it, measured in place at both widths. */
  const REND = () => {
    const cvs = document.createElement("canvas"); cvs.width = cvs.height = 1;
    const c2 = cvs.getContext("2d", { willReadFrequently: true });
    /* every colour through a canvas: a `color-mix()` computes to
       `color(srgb …)` and a contrast formula needs bytes. */
    const bytes = (v) => { c2.clearRect(0, 0, 1, 1); c2.fillStyle = "#000";
      c2.fillStyle = v; c2.fillRect(0, 0, 1, 1);
      const d = c2.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
    const lum = (v) => { const f = (x) => { x /= 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
      const [r, g, b] = bytes(v);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b);
      return +(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2)); };
    const ground = (el) => { let n = el;
      while (n) { const bg = getComputedStyle(n).backgroundColor;
        if (bg && !/rgba\(0, 0, 0, 0\)/.test(bg) && bg !== "transparent") return bg;
        n = n.parentElement; }
      return "rgb(255, 255, 255)"; };
    const tray = document.getElementById("nu-tray");
    const list = document.querySelector(".nu-traylist");
    const rows = [...list.querySelectorAll("button")];
    const clipped = () => rows.filter((b) => { const vh = b.querySelector(".nu-vh");
      return vh && vh.scrollWidth > vh.clientWidth + 1; }).map((b) => b.dataset.k);
    const step = parseFloat(getComputedStyle(tray).getPropertyValue("--nu-indent"));
    const now = clipped();
    tray.style.setProperty("--nu-indent", (step - 1) + "px");
    void list.offsetHeight;
    const under = clipped();
    tray.style.removeProperty("--nu-indent");
    const ch = (() => { const vh = list.querySelector(".nu-vh");
      const s = document.createElement("span");
      s.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
      s.style.font = getComputedStyle(vh).font; s.textContent = "0";
      document.body.append(s);
      const w = s.getBoundingClientRect().width; s.remove(); return +w.toFixed(2); })();
    const byDepth = {};
    for (const b of rows) {
      /* the MARKED row is skipped: it is cobalt because it is where you are,
         which is a different fact from what level it is on, and the mark's own
         white-on-`--hand` is measured by nu.css's own note (7.10:1). */
      if (b.getAttribute("aria-pressed") === "true") continue;
      const d = b.dataset.depth ? +b.dataset.depth : 0;
      if (byDepth[d]) continue;
      const vh = b.querySelector(".nu-vh"), sub = b.querySelector(".nu-sub2");
      const bg = ground(b);
      byDepth[d] = { k: b.dataset.k,
        ink: getComputedStyle(vh).color, bg,
        ratio: ratio(getComputedStyle(vh).color, bg),
        subRatio: sub ? ratio(getComputedStyle(sub).color, bg) : null,
        subInk: sub ? getComputedStyle(sub).color : null,
        inkL: +lum(getComputedStyle(vh).color).toFixed(4),
        bgL: +lum(bg).toFixed(4),
        pad: +parseFloat(getComputedStyle(vh).paddingInlineStart).toFixed(1) };
    }
    return { byDepth, step, ch, now, under,
             lefts: [...new Set(rows.filter((b) => b.getClientRects().length)
               .map((b) => Math.round(b.getBoundingClientRect().left)))].length };
  };
  const levels = {};
  for (const w of [390, 1280]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(350);
    await p.evaluate(() => window.__eightUp());
    await p.waitForTimeout(150);
    await p.click('[data-k="toptab-Motif"]');
    await p.waitForTimeout(600);
    const cell = await p.evaluate(() => (window.__eightTree().rows
      .find((r) => /^motiftab-/.test(r.key)) || {}).key || null);
    if (cell) { await p.click('[data-k="' + cell + '"]'); await p.waitForTimeout(500); }
    levels[w] = await p.evaluate(REND);
  }
  for (const w of [390, 1280]) {
    const L = levels[w], d = L.byDepth;
    const three = d[0] && d[1] && d[2];
    const inks = three ? new Set([d[0].ink, d[1].ink, d[2].ink]) : new Set();
    const bgs = three ? new Set([d[0].bg, d[1].bg, d[2].bg]) : new Set();
    check(three && inks.size === 3 && bgs.size === 3,
      "N8 " + w + " · three depths, three inks, three grounds — " +
      JSON.stringify(three ? { 0: [d[0].ink, d[0].bg], 1: [d[1].ink, d[1].bg],
                               2: [d[2].ink, d[2].bg] } : d));
    check(three && d[0].inkL < d[1].inkL && d[1].inkL < d[2].inkL &&
          d[0].bgL > d[1].bgL && d[1].bgL > d[2].bgL,
      "N8 " + w + " · …and it is MONOTONIC: the ink quietens and the ground " +
      "deepens with every level — ink " + (three ? [d[0].inkL, d[1].inkL, d[2].inkL] : "?") +
      ", ground " + (three ? [d[0].bgL, d[1].bgL, d[2].bgL] : "?"));
    const ratios = three ? [d[0].ratio, d[1].ratio, d[2].ratio] : [];
    const subs = three ? [d[0].subRatio, d[1].subRatio, d[2].subRatio]
      .filter((x) => x != null) : [];
    check(three && ratios.every((r) => r >= 4.5) && subs.every((r) => r >= 4.5),
      "N8 " + w + " · …and every level clears 4.5:1, the word (" +
      JSON.stringify(ratios) + ") and its second line (" + JSON.stringify(subs) +
      ") on the ground each actually stands on");
    check(three && L.step >= 6 && d[0].pad === 0 &&
          Math.abs(d[1].pad - L.step) < 0.6 &&
          Math.abs(d[2].pad - 2 * L.step) < 0.6 &&
          (w > 400 || L.step >= 0.7 * L.ch) && L.lefts === 1,
      "N8 " + w + " · …and the indent is depth × " + L.step + "px (" +
      (L.step / L.ch).toFixed(2) + "ch) on the WORD, " +
      JSON.stringify(three ? [d[0].pad, d[1].pad, d[2].pad] : []) +
      ", with every button still on one left edge (" + L.lefts + ")");
    check(L.now.length === L.under.length &&
          L.now.every((k) => L.under.indexOf(k) >= 0),
      "N8 " + w + " · …and the indent is not what clipped anything: " +
      L.now.length + " ellipsised labels at " + L.step + "px and the same " +
      L.under.length + " at " + (L.step - 1) + "px " +
      JSON.stringify(L.now.filter((k) => L.under.indexOf(k) < 0)));
  }

  /* ---- N9 THE MOTIF THAT IS SOUNDING LIGHTS UP ----------------------- */
  /* Paul, 2026-09-03: *"When motifs are open, light them up in the left nav
     when playing."* — N6's lamp, one branch over, and it is a HARDER claim
     than N6's: a player either sounds or does not, but a CELL is sounding only
     in the sections that read it, so a lamp that lit the whole bank would look
     exactly as alive and mean nothing. Hence the two halves below: something
     lights, and NOT EVERYTHING does.
     WHERE THE FACT COMES FROM (ui/eight.js `lightMotifs`): the sounding
     section's own `cellAt(voice, si)` — the same call `motifLabels` hangs the
     score's `.nu-mot` caps from — joined to `lightBand`'s sounding players. So
     a lit row is a cell that somebody who is sounding is reading right now,
     and a row nobody reads cannot light: every lit row's second line says
     "read by …", which is asserted here because it is the cheap proof that the
     lamp went through the record rather than through a timer. */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  await p.click('[data-k="toptab-Motif"]');
  await p.waitForTimeout(600);
  const bank = await p.evaluate(() => window.__eightTree().rows
    .filter((r) => /^motiftab-/.test(r.key))
    .map((r) => ({ key: r.key, sub: r.sub })));
  await p.evaluate(() => document.getElementById("play").click());
  const motLit = await p.waitForFunction(
    () => document.querySelectorAll('#nu-tray [data-k^="motiftab-"].is-sounding')
      .length > 0, null, { timeout: 15000 }).then(() => true).catch(() => false);
  const mot = await p.evaluate(() => {
    const lit = [...document.querySelectorAll("#nu-tray .is-sounding")];
    return { lit: lit.map((b) => b.dataset.k),
             current: [...document.querySelectorAll('#nu-tray [aria-current="true"]')]
               .map((b) => b.dataset.k),
             marks: document.querySelectorAll("#nu-tray mark").length,
             pressed: document.querySelectorAll('#nu-tray [aria-pressed="true"]').length,
             bar: lit.length ? getComputedStyle(lit[0]).borderInlineStartColor : null,
             clock: getComputedStyle(document.documentElement)
               .getPropertyValue("--clock").trim(),
             meter: getComputedStyle(document.documentElement)
               .getPropertyValue("--meter").trim() };
  });
  const motRows = mot.lit.filter((k) => /^motiftab-/.test(k));
  check(motLit && motRows.length > 0 &&
        mot.lit.every((k) => /^motiftab-/.test(k)),
    "N9 · a motif lights up within 15 s of #play: " + JSON.stringify(mot.lit) +
    " of the bank's " + bank.length + " cells");
  check(motRows.length < bank.length &&
        motRows.every((k) => { const r = bank.find((x) => x.key === k);
          return r && /read by/.test(r.sub || ""); }),
    "N9 · …and it is a JOIN and not a floodlight: " + motRows.length + " of " +
    bank.length + " cells lit, every one of them a cell somebody reads (" +
    JSON.stringify(motRows.map((k) => (bank.find((x) => x.key === k) || {}).sub)) + ")");
  check(mot.marks === 1 && mot.pressed === 1 &&
        mot.current.length === mot.lit.length &&
        mot.lit.every((k) => mot.current.indexOf(k) >= 0),
    "N9 · …and lit is a CLASS plus `aria-current`, never a mark: still one " +
    "<mark> and one aria-pressed in the stripe, and aria-current is on " +
    "exactly the lit rows (" + JSON.stringify(mot.current) + ")");
  check(!!mot.bar && (!rgb(mot.clock) || mot.bar.indexOf(rgb(mot.clock)) >= 0) &&
        (!rgb(mot.meter) || mot.bar.indexOf(rgb(mot.meter)) < 0),
    "N9 · …and the lamp is the playhead's red (--clock " + mot.clock +
    ") and never the measured green: " + JSON.stringify(mot.bar));
  await p.evaluate(() => document.getElementById("play").click());
  const motDark = await p.waitForFunction(
    () => document.querySelectorAll("#nu-tray .is-sounding").length === 0 &&
          document.querySelectorAll('#nu-tray [aria-current="true"]').length === 0,
    null, { timeout: 8000 }).then(() => true).catch(() => false);
  check(motDark,
    "N9 · …and on stop every motif goes dark and gives up its aria-current");

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
