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
 * N2  ONE PATH: opening Band folds Score — one `aria-expanded="true"`
 *     ancestor, only its children on the stripe, and exactly ONE <mark>
 *     (rewritten in place 2026-09-02; the old claim and Paul's reversal of it
 *     are at the check itself. It read "opening Band folds MOTIFS" until
 *     2026-09-08: the Motifs tab is deleted with its pane and the second
 *     branch is `Score`, which is the only other one `TABKIDS` has left)
 * N3  a set of ACTIONS marks nothing — the fourteen motif transforms carry no
 *     aria-pressed at all (the 2026-08-28 law: fourteen `aria-pressed="false"`
 *     buttons would tell a screen reader there is a state to be in). It said
 *     "a BRANCH of actions" until 2026-09-08 and drove the stripe; the
 *     transforms are the MOTIFS row's sheet now and the tree has no branch of
 *     actions left at all — the tombstone at the check carries the measurement
 * N4  every mark in the gutter is a thumb (44px) and the stripe is ONE column
 *     that never scrolls sideways, at 320 / 375 / 430 / 1280
 * N5  the foot reads where · seed · ? · log · opts · play, and #play is the
 *     LAST child of the foot in every state the tree can be in
 * N6  a band member LIGHTS UP while it sounds and goes dark when the record
 *     stops — a class on the button, never a <mark>, and it is the playhead's
 *     red and not the meter's green
 * N8  A LEVEL LOOKS LIKE ONE: the depths on the stripe wear an ink and a
 *     ground apiece, monotonically quieter and deeper, each clearing 4.5:1 for
 *     the word AND its second line; the indent is depth x a step of at least
 *     0.7ch, and it is measured NOT to be what clipped any label. It said
 *     THREE depths until 2026-09-08; the tree is two levels deep now and the
 *     tombstone at the check carries the count and where the third went
 * N9  the MOTIF that is sounding lights up while the record plays and goes
 *     dark on stop — a join and not a floodlight (a cell nobody reads in this
 *     section stays dark). It was a row of the STRIPE until 2026-09-08; it is
 *     a row of the BANK, in the Band table's MOTIFS row, since — same
 *     `lightMotifs`, same `--clock`, and the tombstone at the check says
 *     which half of the old spelling went with the stripe
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
  /* THE PAIR IS `Score` THEN `Band` SINCE 2026-09-08 (TABLE.md §10b step 4).
     IT READ: *"THE PAIR IS `Motifs` THEN `Band` SINCE 2026-09-04 (TABLE.md
     wave 2c). `Structure` is deleted and its sections are CHILDREN OF BAND, so
     the two branches this gate needs cannot be Band and Structure any more —
     they are one branch."* `Motifs` is deleted the same way and one step
     further in: the bank is a merged ROW of the Band table (`tmotifs`,
     `__eightMotif`), so the tab, its `motiftab-` rows and `motifTrayItems` are
     all gone. THE SECOND BRANCH IS THE ONLY OTHER ONE THERE IS — measured on
     the boot record 2026-09-08, `TABKIDS` answers for `Band` and `Score` and
     for nothing else, and every other root row is childless. `Score`'s branch
     is the score's two views (`deck.view.not` / `deck.view.roll`), which is a
     branch of two and enough to be folded.
     The claim and the gesture are unchanged: open a tab with children, open
     another, and the first must be gone. Band arrives SECOND so the assertion
     can name what its branch holds after wave 2c — the players AND the
     sections, which is the table's two lists said downwards. */
  await p.click('[data-k="toptab-Score"]');
  await p.waitForTimeout(700);
  await p.click('[data-k="toptab-Band"]');
  await p.waitForTimeout(700);
  const two = await p.evaluate(() => {
    const T = window.__eightTree();
    const doors = [...document.querySelectorAll('#nu-tray [aria-expanded="true"]')]
      .map((x) => x.dataset.k || x.id).filter((k) => k !== "playops");
    return { doors, exp: T.expanded,
      /* `motifs:` STOOD HERE and counted `motiftab-` rows — the bank as a
         branch of the stripe, deleted 2026-09-08. What is counted is the
         branch that was folded, and that is Score's two views. */
      views: T.rows.filter((r) => r.depth === 1 && /^deck\.view\./.test(r.key)).length,
      band: T.rows.filter((r) => r.depth === 1 && /^tab/.test(r.key)).length,
      secs: T.rows.filter((r) => r.depth === 1 && /^secnav/.test(r.key)).length,
      marks: document.querySelectorAll("#nu-tray mark").length,
      pressed: [...document.querySelectorAll('#nu-tray [aria-pressed="true"]')]
        .map((x) => x.dataset.k || x.id),
      on: T.mark };
  });
  check(two.doors.length === 1 && two.views === 0 && two.secs > 0 &&
        two.exp.length === 1 && two.exp[0] === "toptab-Band",
    "N2 · opening Band folds Score; one path — " + two.doors.length +
    " expanded ancestor (" + JSON.stringify(two.doors) + "), " + two.views +
    " score-view rows, " + two.band + " player rows and " + two.secs +
    " section rows on the stripe, the open path " + JSON.stringify(two.exp));
  check(two.marks === 1 && two.pressed.length === 1 &&
        two.pressed[0] === two.on,
    "N2 · …and exactly ONE <mark> and one aria-pressed, on the deepest open " +
    "thing inside the tab you are standing in (" + JSON.stringify(two.on) + ")");

  /* ---- N3 A SET OF ACTIONS MARKS NOTHING ----------------------------- */
  /* The 2026-08-28 law: "fourteen `aria-pressed=false` buttons would tell a
     screen reader there is a state to be in". The motif transforms are the set
     that has always carried it.

     RE-POINTED 2026-09-08 (TABLE.md §10b step 4), AND HALF OF IT RETIRED WITH
     A MEASUREMENT. IT READ: *"The 2026-08-28 law, re-made about a BRANCH
     instead of a level … The motif transforms are the branch that has always
     carried it; the section's three operations are the other one. What says
     where you are is the branch's own mark, which IS pressed — that is the
     part the tree changed, and it is asserted here rather than assumed."* It
     opened `toptab-Motifs`, opened a `motiftab-<name>` row under it, and read
     the fourteen `motifop-*`/`motiftime-*` rows at DEPTH 2.

     THERE IS NO BRANCH OF ACTIONS IN THE TREE ANY MORE, and that is a fact
     about the design rather than a gap in this file. The section's operations
     left the stripe on 2026-09-05 (TABLE.md §9a, *"NO OP LIVES IN THE NAV: the
     tray keeps the Band tab and, at most, jump links"*) and the motif's
     fourteen left with the pane on 2026-09-08 — they are a line at the foot of
     the opened motif's sheet, back under the tune they rewrite. MEASURED on
     the boot record the same day: `grep 'acts:' ui/eight.js` finds no tree
     node that declares it, and `__eightTree()` answers with rows at depth 0
     and depth 1 and nothing deeper, in every state the stripe can be driven
     into. So the two halves that were about the BRANCH — that its children
     carry `acts`, and that the mark sits on the parent motif — are retired
     with the branch that made them true; N2 above still holds the stripe to
     exactly one mark and one aria-pressed.

     WHAT IS KEPT IS THE LAW ITSELF, at the fourteen buttons' new address. The
     door is `__eightMotif(name)` — the two taps a thumb makes, `tmotifs` and
     then that motif's `open` — and the reading is the same one: not one of
     them may carry the attribute at all. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  const motifName = await p.evaluate(() => (window.__eightBank() || [])[0] || null);
  const inMotif = motifName &&
    await p.evaluate((n) => window.__eightMotif(n), motifName);
  if (!inMotif) check(false, "N3 · no motif in the bank to open (" +
    JSON.stringify(motifName) + ")");
  else {
    await p.waitForTimeout(500);
    const acts = await p.evaluate(() => {
      const ops = [...document.querySelectorAll(
        '#pan-band [data-k^="motifop-"], #pan-band [data-k^="motiftime-"]')];
      return { n: ops.length, keys: ops.map((b) => b.dataset.k),
               pressed: ops.filter((b) => b.hasAttribute("aria-pressed"))
                 .map((b) => b.dataset.k),
               marks: document.querySelectorAll("#nu-tray mark").length,
               trayPressed: [...document.querySelectorAll(
                 '#nu-tray [aria-pressed="true"]')].map((b) => b.dataset.k) };
    });
    check(acts.n === 14 && acts.pressed.length === 0 && acts.marks === 1 &&
          acts.trayPressed.length === 1,
      "N3 · the open motif's " + acts.n + " transforms are a set of ACTIONS: " +
      "not one of them carries aria-pressed, and the stripe still wears " +
      acts.marks + " mark on " + JSON.stringify(acts.trayPressed) + " (" +
      JSON.stringify(acts.pressed) + ")");
  }
  await p.evaluate(() => window.__eightMotif(null));
  await p.waitForTimeout(200);

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
      /* `toptab-Motifs` STOOD HERE and is `toptab-Score` since 2026-09-08:
         the Motifs tab is deleted with its pane and Score is the other branch
         (see N2's own note, which carries the measurement). The two clicks are
         kept for the reason the paragraph above gives — what they build is
         still the deepest state the widths have to hold. */
      const other = document.querySelector('[data-k="toptab-Score"]');
      if (other) other.click();
      await new Promise((r) => setTimeout(r, 400));
      const band = document.querySelector('[data-k="toptab-Band"]');
      if (band) band.click();
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
  /* THE SECTIONS ARE IN THIS BRANCH TOO SINCE 2026-09-04 (TABLE.md wave 2c),
     and the sounding SECTION lights the same way the sounding player does — so
     "everything lit is a member" is no longer the claim; "every lit PLAYER row
     is a member of this band" is, and the section lamp is asserted beside it
     rather than tripping this one. `secnav*` rows are the table's own rows and
     `lightSections` has lit them since before the table existed. */
  const litMembers = onNow.lit.filter((k) => /^tab/.test(k || ""));
  const litSecs = onNow.lit.filter((k) => /^secnav/.test(k || ""));
  check(lit && litMembers.length > 0 && members.length > 0 &&
        litMembers.every((k) => members.indexOf(k) >= 0) &&
        onNow.lit.every((k) => /^(tab|secnav)/.test(k || "")),
    "N6 · a band member lights up within 6 s of #play (and " + litSecs.length +
    " section row) on the record in the " +
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

     TWO DEPTHS SINCE 2026-09-08, AND IT IS COUNTED RATHER THAN WISHED.
     IT READ: *"three depths are on the stripe at once"*, and it built them by
     opening `toptab-Motifs` and then a `motiftab-<name>` row under it — the
     bank at depth 1 and that motif's fourteen transforms at depth 2. The
     Motifs tab is deleted with its pane (TABLE.md §10b step 4) and it was
     carrying THE LAST DEPTH-2 BRANCH THE TREE HAD: the section's ops went on
     2026-09-05 (§9a, "NO OP LIVES IN THE NAV") and the mix's plate rows went
     with step 3, so what is left in `TABKIDS` is `Band` (players + sections)
     and `Score` (two views), and no node in either declares `kids`. MEASURED
     on the boot record 2026-09-08, at both widths below: `__eightTree()`
     answers with rows at depth 0 and depth 1 and nothing deeper, in every
     state a hand can drive the stripe into.
     So the COUNT is two and the LAW is untouched — nu.css still writes a third
     level and the moment a branch grows one this reads it, because the shape
     below is `byDepth` and not three named rows. What is asserted is that
     every depth the stripe actually has wears its own ink on its own ground,
     quietening and deepening as it goes.

     THE FOUR CLAIMS:
       · the depths on the stripe each wear a DISTINCT ink on a DISTINCT
         ground (a depth cue that is one colour is not a depth cue — which is
         exactly what shipped before this round: `--dim` on one wash for every
         child row at every depth);
       · MONOTONIC — the deeper the row the quieter the ink and the deeper the
         ground, so the levels read as a thing inside a thing;
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
    /* THE DEEPEST STATE THE STRIPE HAS, MADE BY HAND. It was `toptab-Motifs`
       and then a `motiftab-` row under it; it is `toptab-Band` and then one of
       its rows, which is as far down as the tree goes (see the count above).
       The child is CLICKED and not merely present, because a marked row is
       skipped by `REND` and the walk has to leave an unmarked one at each
       depth to read. */
    await p.click('[data-k="toptab-Band"]');
    await p.waitForTimeout(600);
    const kid = await p.evaluate(() => (window.__eightTree().rows
      .find((r) => r.depth === 1) || {}).key || null);
    if (kid) { await p.click('[data-k="' + kid + '"]'); await p.waitForTimeout(500); }
    levels[w] = await p.evaluate(REND);
  }
  for (const w of [390, 1280]) {
    const L = levels[w], d = L.byDepth;
    /* THE DEPTHS THE STRIPE ACTUALLY HAS, IN ORDER, and there have to be at
       least two of them — one level is not a hierarchy and a gate that read a
       single row would pass on a tree that had lost its children. (It read
       `const three = d[0] && d[1] && d[2]` until 2026-09-08; the tombstone
       above carries the count and where the third went.) */
    const D = Object.keys(d).map(Number).sort((a, b2) => a - b2);
    const deep = D.length >= 2 && D.every((n, i) => n === i);
    const inks = deep ? new Set(D.map((n) => d[n].ink)) : new Set();
    const bgs = deep ? new Set(D.map((n) => d[n].bg)) : new Set();
    check(deep && inks.size === D.length && bgs.size === D.length,
      "N8 " + w + " · " + D.length + " depths, " + inks.size + " inks, " +
      bgs.size + " grounds — " +
      JSON.stringify(deep ? D.map((n) => [d[n].ink, d[n].bg]) : d));
    check(deep && D.every((n, i) => i === 0 ||
            (d[n].inkL > d[D[i - 1]].inkL && d[n].bgL < d[D[i - 1]].bgL)),
      "N8 " + w + " · …and it is MONOTONIC: the ink quietens and the ground " +
      "deepens with every level — ink " +
      JSON.stringify(deep ? D.map((n) => d[n].inkL) : "?") + ", ground " +
      JSON.stringify(deep ? D.map((n) => d[n].bgL) : "?"));
    const ratios = deep ? D.map((n) => d[n].ratio) : [];
    const subs = deep ? D.map((n) => d[n].subRatio).filter((x) => x != null) : [];
    check(deep && ratios.every((r) => r >= 4.5) && subs.every((r) => r >= 4.5),
      "N8 " + w + " · …and every level clears 4.5:1, the word (" +
      JSON.stringify(ratios) + ") and its second line (" + JSON.stringify(subs) +
      ") on the ground each actually stands on");
    check(deep && L.step >= 6 &&
          D.every((n) => Math.abs(d[n].pad - n * L.step) < 0.6) &&
          (w > 400 || L.step >= 0.7 * L.ch) && L.lefts === 1,
      "N8 " + w + " · …and the indent is depth × " + L.step + "px (" +
      (L.step / L.ch).toFixed(2) + "ch) on the WORD, " +
      JSON.stringify(deep ? D.map((n) => d[n].pad) : []) +
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
     and a row nobody reads cannot light, which is the cheap proof that the
     lamp went through the record rather than through a timer.

     THE LAMP MOVED WITH THE BANK, 2026-09-08 (TABLE.md §10b step 4), AND THE
     CLAIM IS RE-POINTED RATHER THAN RETIRED — the fact is the same fact, from
     the same `lightMotifs`, on the surface the bank is drawn on now.
     WHAT IT SAID AND WHAT IS GONE WITH THE STRIPE'S OWN ROWS: *"every lit
     row's second line says 'read by …'"*, and *"lit is a CLASS plus
     `aria-current`, never a mark: still one <mark> and one aria-pressed in the
     stripe, and aria-current is on exactly the lit rows"*. Those were true of
     a `motiftab-<name>` BUTTON in `#nu-tray`, where a lamp had to be
     distinguishable from a mark; there are no motif rows in the stripe at all
     now (`motifTrayItems` is deleted with the pane) and the bank's lamp is a
     `<span class="nu-banklamp">` beside the name — a sibling, not the button,
     so there is no attribute on a control to get wrong and nothing to
     distinguish it from a mark. `.nu-motlamp` is its other half, on the SHUT
     row's head, and it carries the sounding motif's NAME.
     WHAT SURVIVES UNCHANGED, and it is every claim that was about the RECORD:
     something lights within 15 s of #play, NOT everything does, every lit row
     is one somebody reads (its own `readby|<motif>|<voice>` strip is the
     reading), the paint is the playhead's red and never the measured green,
     and every lamp goes out on stop.
     THE DOOR IS `__eightMotif(null)` — `tmotifs` pressed, standing on the bank
     — which is the two taps a thumb makes and the same hand `__eightRow` is. */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  const onBank = await p.evaluate(() => window.__eightMotif(null));
  await p.waitForTimeout(600);
  const bank = await p.evaluate(() => window.__eightBank());
  check(onBank && bank.length > 1,
    "N9 · the bank is open in the table's MOTIFS row — " + bank.length +
    " cells " + JSON.stringify(bank.slice(0, 4)));
  await p.evaluate(() => document.getElementById("play").click());
  const motLit = await p.waitForFunction(
    () => document.querySelectorAll("#pan-band .nu-banklamp > i").length > 0,
    null, { timeout: 15000 }).then(() => true).catch(() => false);
  const mot = await p.evaluate(() => {
    const rows = [...document.querySelectorAll("#pan-band .nu-bankrow")];
    const on = rows.filter((r) => r.querySelector(".nu-banklamp > i"));
    const nameOf = (r) => { const b = r.querySelector('[data-k^="motifpoint|"]');
      return b ? b.dataset.k.split("|")[1] : null; };
    return { of: rows.length, lit: on.map(nameOf),
             /* THE PROOF THAT SOMEBODY READS IT: the row's own read-by strip,
                which the bank draws from the record's cell maps. A lit row
                with no reader would be a floodlight. */
             readers: on.map((r) => [...r.querySelectorAll('[data-k^="readby|"]')]
               .map((b) => b.dataset.k).length),
             head: (document.querySelector(".nu-motlamp") || {}).textContent,
             dot: on.length ? getComputedStyle(on[0].querySelector(".nu-banklamp > i"))
               .backgroundColor : null,
             clock: getComputedStyle(document.documentElement)
               .getPropertyValue("--clock").trim(),
             meter: getComputedStyle(document.documentElement)
               .getPropertyValue("--meter").trim() };
  });
  check(motLit && mot.lit.length > 0 && mot.lit.every((n) => !!n),
    "N9 · a motif lights up within 15 s of #play: " + JSON.stringify(mot.lit) +
    " of the bank's " + mot.of + " cells");
  check(mot.lit.length < mot.of && mot.readers.every((n) => n > 0),
    "N9 · …and it is a JOIN and not a floodlight: " + mot.lit.length + " of " +
    mot.of + " cells lit, every one of them a cell somebody reads (" +
    JSON.stringify(mot.readers) + ")");
  check(!!mot.dot && (!rgb(mot.clock) || mot.dot.indexOf(rgb(mot.clock)) >= 0) &&
        (!rgb(mot.meter) || mot.dot.indexOf(rgb(mot.meter)) < 0),
    "N9 · …and the lamp is the playhead's red (--clock " + mot.clock +
    ") and never the measured green: " + JSON.stringify(mot.dot));
  await p.evaluate(() => document.getElementById("play").click());
  const motDark = await p.waitForFunction(
    () => document.querySelectorAll("#pan-band .nu-banklamp > i").length === 0,
    null, { timeout: 8000 }).then(() => true).catch(() => false);
  check(motDark,
    "N9 · …and on stop every motif in the bank goes dark");

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
