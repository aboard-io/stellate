#!/usr/bin/env node
/* test/gutter.js — THE TRANSPORT IS THE BAR AT THE FOOT AND THE HAMBURGER AT
 * THE CORNER, READ OFF THE RENDERED PAGE.
 *
 * THE FILE IS STILL CALLED gutter.js AND THERE IS NO GUTTER (2026-09-09,
 * nukernel/TABLE.md §10b steps 6 and 7). Paul, looking at the nav beside the
 * v271 grid: *"…then have a hamburger menu for score, video, screensaver, and
 * have genre, dice, playstop along the bottom — a real mobile app now with
 * everything in the table and the nav space reclaimed."* `#nu-tray`, its list,
 * its foot, its cut, its `--tray-w` column and the whole tree behind it — the
 * levels, `TABKIDS`, `TABSUB`, `paintTray`, `trayRow`, `trayNow`, `tapNode`,
 * `expanded`/`chain`, and the three probes `__eightTray` / `__eightTree` /
 * `__eightExpand` — are deleted from ui/eight.js and nu.css. What replaced
 * them is three fixed boxes: `.nu-top` (the × and the ≡ at the top corner),
 * `#nu-menu` (four viewers and the log, hanging from the ≡), and `.nu-bar`
 * (the foot, full width: the genre plate, the seed row, and the transport).
 * The name of this file is kept for the reason its claims are kept — every
 * check below is about the same SUBJECT, which is where a thumb finds the
 * transport and what it does when it gets there, and renaming the file would
 * lose eleven rounds of argument to a `git log --follow` nobody runs.
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
 *   T1  the <h1> is GONE and the record still names the page. (The other half
 *       of this claim — "and the .nu-bar is gone" — is RETIRED 2026-09-09: the
 *       bar is back, at the foot, and it is now the subject of T2 and T3. The
 *       tombstone is at the block itself.)
 *   T2  #play is the LAST child of .nu-bartp inside #nu-bar and is ON THE
 *       SCREEN in EVERY state this page has — the table and each of the five
 *       sheets — and it toggles the record
 *   T3  the bar and its #playops fold draw exactly the inventory below and no
 *       ninth thing, and the bar's box IS `--bar-h`
 *   T4  A REAL POINTER DRAG on the vertical room fader changes the value and
 *       leaves window.scrollY where it was — THE TOUCH LAW, on the artifact.
 *       The fader is opened through #playops in the bar now; nothing else
 *       about the law moved
 *   T5  the genre list is built and open at boot, every row a thumb, with a
 *       Wikipedia column whose every href is NuWiki.url(the row's own key) —
 *       in the WHERE SHEET, which the bar's genre plate opens
 *   T6  scrolling the list changes WHICH marks are lit, by count and by name
 *   T7  a tap on a place writes its record, STARTS it, and leaves the mark
 *       centred within a pixel and measurably larger — three numbers
 *   T8  RETIRED 2026-09-02 (Paul: "Get rid of explain — that's the genre
 *       editor's work now") — the ? mark and its panel are asserted ABSENT
 *       and the Rules row present; the two hundred and fifty lines that drove
 *       the panel are tombstoned at the block itself. What they said:
 *       the ? mark (Paul, 2026-08-30: "add a ? Icon above the log icon that
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
 *   T9  Paul, 2026-08-30: "Move the die icon to right above the question mark
 *       so it's always there." #rewrite is in `#nu-bar` inside `.nu-seedrow`,
 *       ON THE SCREEN in every state, still carrying #reading and still
 *       reseeding — and the play fold has LOST it (a mark cannot be in two
 *       places). "Above the question mark and the log" is retired with the
 *       column that had an above: the log is a row of the hamburger now, and
 *       what the die stands beside is asserted as the bar's own ORDER
 *  T10  "Label all the icons with tiny short labels underneath." Every mark
 *       in the chrome wears its own `.nu-vh` word and that word IS the head of
 *       the accessible name (an extraction, not a second dictionary), with the
 *       die's documented exemption; no label is drawn outside its mark's box;
 *       the 44px floor is measured IN BOTH AXES — and the BAR'S ROW is
 *       measured at both phones and reported, in place of the column
 *       arithmetic that is tombstoned at T10b with the gutter it was about
 *  T11  "There are three play modes possible—loop, once, and album which keeps
 *       making new songs." The mark cycles fields.js PLAYMODES, and each
 *       position is DRIVEN TO THE END OF A FOUR-BAR RECORD made by hand:
 *       loop keeps going, once stops itself, album's reading moves
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

  /* ---- T1 THE HEADING IS GONE ----------------------------------------- */
  /* AND THE FACT IT CARRIED IS NOT. "Get rid of … the title of the song"
     deletes a heading; it does not delete the answer to "which record is on
     this page". ui/eight.js draw() writes that answer to `document.title`, so
     what is asserted is BOTH halves — the furniture is gone AND the fact
     survives — because a round that removed the name entirely would pass a
     check that only looked for an absence.

     ===== AND HALF OF THIS CLAIM IS RETIRED, 2026-09-09 ==================
     IT READ: *"T1 · no #title heading and no .nu-bar on the page (h1 …, bars
     …)"*, and the second half was true for eleven days and is now false BY
     DESIGN. `.nu-bar` was deleted on 2026-08-29 when the gutter took the
     transport ("Get rid of the play buttons and the title of the song" ->
     nu.css THE .nu-bar IS GONE, forty-one rules); the gutter is deleted in
     turn and Paul asked for the row back by name — *"have genre, dice,
     playstop along the bottom — a real mobile app now"* — so `.nu-bar` is on
     the page again, fixed at the FOOT rather than sticky at the head, holding
     three things instead of five. A gate that still asserted `bars === 0`
     would be asserting the absence of the thing this round shipped.
     WHAT THE HALF WAS FOR IS NOT LOST, IT MOVED HOUSE: "there is exactly one
     of these and it is the shape the page promises" is T3's `bars === 1` and
     the `--bar-h` token check beside it, and "the transport is reachable from
     everywhere" is T2's walk. Both are stronger there than a count of zero was
     here, because both read what the bar HOLDS.
     The `#title` half is untouched and is asserted below: no round since
     2026-08-29 has proposed giving the song a heading again, and the page
     still has to say which record it is. */
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
  check(!t1.h1,
    "T1 · no #title heading on the page (h1 " + t1.h1 + "). The .nu-bar half " +
    "of this check is retired with the gutter — see the tombstone above; the " +
    "page draws " + t1.bars + " of them and T3 is what holds that number");
  check(t1.title === t1.label && !!t1.label,
    "T1 · …and the record still names the page: document.title is " +
    JSON.stringify(t1.title) + " for basis " + JSON.stringify(t1.basis));
  check(t1.sideways === 0,
    "T1 · …and nothing scrolls sideways at 390 (" + t1.sideways + " px)");

  /* ---- T2 THE PLAY MARK IS PERMANENT --------------------------------- */
  /* IN EVERY STATE THE PAGE HAS, WHICH IS THE WHOLE WORD "permanent". The
     states used to be the stripe's LEVELS and the walk pressed the tab rows to
     reach them; there is no stripe and no level, so the states are the SIX
     SURFACES `__eightTabs()` names — the table (`Band`, the resting state) and
     the five sheets — and the walk opens each one with `__eightTab`, which is
     the same `showTab` the buttons call ("a gate is a hand").

     AND "PERMANENT" IS NOW A GEOMETRY CLAIM AND NOT ONLY A DOM ONE, which is
     the one thing this round makes newly breakable. In the gutter the mark was
     in a fixed column that was always laid out, so being IN `.nu-trayfoot` was
     the whole of being on the screen. `.nu-bar` is fixed at the FOOT and the
     five sheets are IN FLOW with `min-block-size: calc(100dvh - --top-h -
     --bar-h - --s3)` (nu.css A PANEL AS A SHEET) — so a sheet that forgot to
     reserve the bar's height, or a z-index that let a sheet paint over it,
     would leave the button in the DOM and under the paper. Both are asserted:
     the rect has height, its bottom is inside the viewport, and its top is not
     above it.

     AND #play IS THE LAST CHILD OF `.nu-bartp`. "At the right-hand end, under
     a thumb" is a geometry claim and the geometry is DOM order — `.nu-bartp`
     is a plain `flex-direction: row` with no `order` and no `margin: auto`, so
     what is last is at the end. Asserted as a fact about the tree rather than
     as a pixel, because a pixel would pass on a row that had been re-ordered
     and re-positioned back. */
  const t2 = await p.evaluate(async () => {
    const seen = [], missing = [], offscreen = [], notLast = [];
    for (const name of window.__eightTabs()) {
      window.__eightTab(name);
      await new Promise((r) => setTimeout(r, 120));
      seen.push(name);
      const b = document.querySelector("#nu-bar .nu-bartp #play");
      if (!b) { missing.push(name); continue; }
      const r = b.getBoundingClientRect();
      if (!(r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1))
        offscreen.push([name, +r.top.toFixed(1), +r.bottom.toFixed(1)]);
      const tp = document.querySelector("#nu-bar .nu-bartp");
      if (!tp || tp.lastElementChild !== b) notLast.push(name);
    }
    window.__eightUp();
    await new Promise((r) => setTimeout(r, 120));
    return { seen, missing, offscreen, notLast,
             last: (() => { const f = document.querySelector("#nu-bar .nu-bartp");
               return f && f.lastElementChild ? f.lastElementChild.id : null; })() };
  });
  /* `t2.tabs === 9` STOOD HERE AND HAD BEEN RED SINCE 2026-09-01 — it counted
     the root's `toptab-` buttons against a literal nine while `TABS` had grown
     to eleven (Video, Screensaver) and then thirteen (Rules, Structure). A
     literal was the wrong shape for it from the start: what the walk is about
     is "#play survives every surface", not "there are N of them", and the
     number is `__eightTabs()`'s to say. THE ONE ARRANGEMENT THIS FILE STILL
     ASSERTS ABOUT THE LIST is the §10a division, and it is now two facts
     rather than one: `Where` is the BAR's plate and not a menu row (Paul,
     2026-09-02: *"Move the play/stop button to the bottom, along with opts and
     where"*), and `Band` is in NEITHER, because the table is the page and not
     a view you opened (nu.css A PANEL AS A SHEET). Everything else `TABS`
     holds is a menu row, derived — `MENUROWS()` filters those same two names —
     so the check is `menu rows === tabs - 2`, by name and not by count. */
  const t2n = await p.evaluate(() => {
    const m = window.__eightMenu();
    return { tabs: window.__eightTabs(),
             rows: m.rows.map((r) => r.key),
             open: m.open,
             barWhere: !!document.querySelector('#nu-bar [data-k="toptab-Where"]'),
             menuWhere: !!document.querySelector('#nu-menu [data-k="toptab-Where"]'),
             menuBand: !!document.querySelector('#nu-menu [data-k="toptab-Band"]'),
             barBand: !!document.querySelector('#nu-bar [data-k="toptab-Band"]'),
             tray: [typeof window.__eightTray, typeof window.__eightTree,
                    typeof window.__eightExpand] };
  });
  const wantRows = t2n.tabs.filter((n) => n !== "Where" && n !== "Band")
    .map((n) => "toptab-" + n);
  check(!t2.missing.length && !t2.offscreen.length && !t2.notLast.length,
    "T2 · #play is the last child of #nu-bar .nu-bartp AND on the screen in " +
    "every state this page has (" + JSON.stringify(t2.seen) + " — missing " +
    JSON.stringify(t2.missing) + ", off-screen " + JSON.stringify(t2.offscreen) +
    ", not last " + JSON.stringify(t2.notLast) + ")");
  check(t2n.barWhere && !t2n.menuWhere && !t2n.menuBand && !t2n.barBand &&
        JSON.stringify(t2n.rows) === JSON.stringify(wantRows) &&
        t2.last === "play",
    "T2 · …Where is the BAR's plate, Band is nowhere (it is the page), and " +
    "the hamburger is the rest of TABS: " + JSON.stringify(t2n.rows) +
    " for tabs " + JSON.stringify(t2n.tabs) + ", last in the bar " +
    JSON.stringify(t2.last));
  /* AND THE STRIPE'S THREE PROBES ARE GONE, ASSERTED — because "we deleted it"
     is a claim about the rendered page like any other, and a `__eightTray` that
     came back as a shim over the bar would let every retired check in this
     file quietly go green again against a shape nobody ships. */
  check(t2n.tray.every((t) => t === "undefined"),
    "T2 · …and __eightTray / __eightTree / __eightExpand no longer exist on " +
    "the page " + JSON.stringify(t2n.tray));
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

  /* ---- T3 THE BAR'S INVENTORY, COUNTED ------------------------------- */
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
  /* ===== THE PLAY GROUP IS A FOLD IN THE FOOT, NOT A LEVEL (2026-09-02) ===
     Paul: *"Move the play/stop button to the bottom, along with opts and
     where."* The four controls were the `play` LEVEL of the stripe — the whole
     list replaced by them, `__eightTray().level === "play"`, `up: "root"`,
     `acts: true` — and a level is a set of siblings you stand among. These
     four never were that (a mode, a take, a voicing and a fader), and reaching
     them cost the entire tree. They unfold ABOVE their own door inside the
     foot now, and the door still wears `aria-expanded`, which is the half of
     the 2026-08-29 split ("It's too weird when those are together") that was
     always the real one.
     WHAT IS ASSERTED IS THE SAME THREE THINGS, about a fold instead of a
     level: the door opens it, the controls are IN it, and it is inside
     `.nu-trayfoot` — so nothing about reaching the transport depends on where
     the tree happens to be standing.
     THREE CONTROLS, NOT FOUR, SINCE 2026-09-03 (Paul: *"Move the 'sung/all
     analog' etc spinner button to the main area right above play/stop and out
     of opts."*). The voicing left the fold and stands under it; T3c holds
     where, and holds that it is still the same five-position spinner.

     ===== AND "FIVE CONTROLS AND NO SIXTH" IS RE-COUNTED, 2026-09-09 =======
     It was a claim about a LEVEL of the stripe, then about a FOLD in the
     gutter's foot, and it is now a claim about the WHOLE BAR, which holds four
     things the level never did. THE RIGHT ANSWER IS TO REPORT THE REAL
     INVENTORY AND ASSERT IT EXACTLY, rather than to keep a number that has
     been wrong at every one of the four shapes this transport has had.
     Measured on the rendered page at 390x844 the morning of 2026-09-09:

       #nu-bar         > toptab-Where · .nu-seedrow · .nu-bartp
       .nu-seedrow     > #rewrite · #seedval · #seedin · .nu-seedwait · .nu-count
       .nu-bartp       > .nu-baropts · #playops · #voicing · #play
       .nu-baropts     > #playmode · #take · .nu-vs (the room, #vol)

     — eight controls and a name plate, where the level had five. The two
     non-controls in the seed row are the countdowns (`.nu-seedwait`, the
     seed's own; `.nu-count`, the general one, which moved here from the foot
     of the gutter and still stands down while the seed's is up), and they are
     the clock's one square inch of the bar: `data-live="pending"` on both.
     WHAT THE OLD NUMBER WAS PROTECTING is a sixth control appearing in the
     transport without anybody arguing for it, and an exact four-list is a
     stronger form of that than a count: it catches an addition, a deletion,
     AND a re-parenting, and it prints what it found. */
  await p.evaluate(() => document.getElementById("playops").click());
  await p.waitForTimeout(300);
  const t3 = await p.evaluate(() => {
    const box = document.querySelector(".nu-baropts");
    const has = (id) => !!document.getElementById(id);
    const kids = (sel) => { const n = document.querySelector(sel);
      return n ? [...n.children].map((c) => c.id || c.dataset.k || c.className ||
                                            c.tagName.toLowerCase()) : null; };
    const tap = [...document.querySelectorAll("#nu-bar button")]
      .filter((n) => n.getClientRects().length)
      .map((n) => +n.getBoundingClientRect().height.toFixed(1));
    return { open: !!(box && !box.hidden),
             expanded: document.getElementById("playops").getAttribute("aria-expanded"),
             inBar: !!document.querySelector("#nu-bar .nu-bartp .nu-baropts"),
             opts: [...(box ? box.children : [])]
               .map((n) => n.id || n.className).filter((x) => x),
             tp: !!document.querySelector("#nu-bar .nu-bartp #play"),
             five: ["play", "rewrite", "take", "voicing", "vol"].filter(has),
             reading: (document.getElementById("reading") || {}).textContent,
             minTap: tap.length ? Math.min(...tap) : 0,
             bars: document.querySelectorAll(".nu-bar").length,
             /* THE INVENTORY, OFF THE RENDERED TREE. */
             bar: kids("#nu-bar"), seed: kids("#nu-bar .nu-seedrow"),
             bartp: kids("#nu-bar .nu-bartp"),
             /* AND THE BAR'S BOX IS THE TOKEN. `--bar-h` is a PROMISE the
                body's own `padding-block-end` is arithmetic on (nu.css: "a bar
                that came out a pixel taller than its own token would be a
                pixel of the page under the bar and nothing would say so"), so
                the box and the token are read separately and compared. The
                token is asked for the way shell A7 asks — an off-screen
                `box-sizing: border-box` div — so the two files cannot drift on
                how a custom property is measured. */
             barH: +document.querySelector(".nu-bar")
                     .getBoundingClientRect().height.toFixed(2),
             barTok: (() => { const d = document.createElement("div");
               d.style.cssText = "position:absolute;left:-9999px;top:0;" +
                 "inline-size:1px;box-sizing:border-box;block-size:var(--bar-h)";
               document.body.appendChild(d);
               const h = +d.getBoundingClientRect().height.toFixed(2);
               d.remove(); return h; })() };
  });
  check(t3.open && t3.expanded === "true" && t3.inBar,
    "T3 · pressing #playops unfolds the play options inside the bar and the " +
    "door says so (" + JSON.stringify({ open: t3.open, expanded: t3.expanded,
                                        inBar: t3.inBar }) + ")");
  /* THE INVENTORY, ASSERTED EXACTLY AND PRINTED EITHER WAY. */
  check(JSON.stringify(t3.bar) ===
          JSON.stringify(["toptab-Where", "nu-seedrow", "nu-bartp"]) &&
        JSON.stringify(t3.seed) ===
          JSON.stringify(["rewrite", "seedval", "seedin", "nu-seedwait",
                          "nu-count"]) &&
        JSON.stringify(t3.bartp) ===
          JSON.stringify(["nu-baropts", "playops", "voicing", "play"]),
    "T3 · …and the bar holds exactly what it holds and no ninth thing: " +
    JSON.stringify({ bar: t3.bar, seed: t3.seed, bartp: t3.bartp,
                     fold: t3.opts }));
  /* THREE IN THE FOLD SINCE 2026-09-03, AND THE FOURTH IS ASSERTED OUT OF IT.
     Paul: *"Move the 'sung/all analog' etc spinner button to the main area
     right above play/stop and out of opts."* — so the fold holds the mode, the
     take and the fader, and `#voicing` being absent from it is half the ask.
     The other half is T3c below: where it stands instead. */
  check(["playmode", "take"].every((id) =>
          t3.opts.some((c) => c === id || /nu-vs/.test(c))) &&
        !t3.opts.includes("voicing"),
    "T3 · …and the three controls are IN the fold, the voicing OUT of it: " +
    JSON.stringify(t3.opts));
  /* T3c — THE VOICING STANDS DIRECTLY BESIDE PLAY/STOP, on the artifact and in
     two ways that cannot both be a coincidence: DOM order (it is #play's
     immediately preceding sibling, in the same box) and GEOMETRY (its trailing
     edge is at the play mark's leading edge, one row gap away). Both, because
     the first is what a screen reader walks and the second is what a thumb
     reaches — this transport has been rearranged six times and the thing that
     keeps breaking is one of those two agreeing with the ask while the other
     does not.

     "ABOVE" WAS THE COLUMN'S WORD FOR "NEXT TO" (2026-09-09). Paul's sentence
     is *"Move the 'sung/all analog' etc spinner button to the main area right
     above play/stop and out of opts"*, said about a 96px vertical stripe where
     the neighbour on the way to ▶ was the one overhead. `.nu-bartp` is a
     `flex-direction: row`, so the same neighbour is now to the LEFT, and the
     check reads `vr.right ≈ pr.left` where it read `vr.bottom ≈ pr.top`. The
     ask is unchanged and the axis is the page's; asserting "above" here would
     be asserting the gutter.
     THE GAP IS THE ROW'S OWN AND IS MEASURED RATHER THAN ASSUMED. `.nu-bartp`
     declares `gap: var(--s1)`, so the two rects do not touch the way a column's
     stacked marks did; what is asserted is that nothing stands BETWEEN them
     (the gap is the token's, not another control's width) and the number is
     printed. Measured 2026-09-09 at 390x844: 4px.
     AND IT IS STILL THE SPINNER. Five positions cycled with a real pointer
     press at the mark's OWN RECT (never `page.click`, which scrolls its target
     into view and manufactures jumps — the harness law), reading the word the
     control paints on itself, and it must come back round to where it began:
     a control that moved house and lost a mode would pass every check above. */
  const t3c = await p.evaluate(() => {
    const v = document.getElementById("voicing"), pl = document.getElementById("play");
    const box = document.querySelector(".nu-baropts");
    if (!v || !pl) return { missing: true };
    const vr = v.getBoundingClientRect(), pr = pl.getBoundingClientRect();
    return { inBar: !!v.closest("#nu-bar .nu-bartp"),
             inFold: !!(box && box.contains(v)),
             nextIsPlay: v.nextElementSibling === pl,
             sameParent: v.parentElement === pl.parentElement,
             gap: +(pr.left - vr.right).toFixed(1),
             before: vr.right <= pr.left + 0.5,
             sameRow: Math.abs(vr.top - pr.top) <= 1,
             tall: +vr.height.toFixed(1),
             word: (v.querySelector(".nu-vh") || {}).textContent,
             aria: v.getAttribute("aria-label") };
  });
  check(t3c.inBar && !t3c.inFold && t3c.nextIsPlay && t3c.sameParent &&
        t3c.before && t3c.sameRow && t3c.gap >= 0 && t3c.gap <= 16,
    "T3c · #voicing is out of the fold and stands directly beside #play — the " +
    "next sibling in the same .nu-bartp, on the same row, its trailing edge " +
    "one row gap from the play mark (" + JSON.stringify(t3c) + ")");
  const t3cModes = await (async () => {
    const seen = [];
    for (let i = 0; i < 6; i++) {
      const r = await p.evaluate(() => {
        const v = document.getElementById("voicing"), b = v.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2,
                 word: (v.querySelector(".nu-vh") || {}).textContent };
      });
      seen.push(r.word);
      await p.mouse.click(r.x, r.y);      // the mark's own rect, not page.click
      await p.waitForTimeout(200);
    }
    return seen;
  })();
  check(new Set(t3cModes.slice(0, 5)).size === 5 &&
        t3cModes[5] === t3cModes[0],
    "T3c · …and it is still the five-position spinner where it now stands: " +
    JSON.stringify(t3cModes) + " — pressed at its own rect, every mode " +
    "distinct, and the sixth press comes back round");
  /* AND THE SPLIT ITSELF, ASSERTED — the thing Paul asked for, which is that
     these two marks do ONE JOB EACH. A stop must not move the stripe, and the
     door must not touch the record. Without this the two could quietly fuse
     again and every check above would still pass. */
  /* T3b — THE SPLIT ITSELF, WHICH IS THE THING PAUL ASKED FOR AND THE THING
     THAT COULD QUIETLY UN-HAPPEN: these two marks do ONE JOB EACH. A stop must
     not move the chrome and the door must not touch the record. It read the
     `play` LEVEL through `__eightTray().level`, then the tree's `items` when
     the level became a fold; there is no tray and no tree, so the SHAPE is
     what the chrome has instead — which surface is open (`__eightTabNow`),
     what the hamburger says (`__eightMenu`, rows and their lit marks and
     whether it is open at all), and the fold's own children. All three are
     read through the page's own probes, which are the same doors the buttons
     use.
     IT IS THE SAME CLAIM IT ALWAYS WAS AND IT IS BROADER NOW: pressing play
     may not open a sheet, may not move the `<mark>` from one viewer to
     another, may not open or shut the menu, and may not re-parent a control
     of the fold. The stripe could get one of those wrong; the chrome can get
     four. */
  const t3b = await p.evaluate(async () => {
    const shape = () => JSON.stringify([window.__eightTabNow(),
      window.__eightMenu(),
      [...document.querySelectorAll(".nu-baropts *")].map((n) => n.id)
        .filter(Boolean)]);
    const word = () => (document.getElementById("play")
      .getAttribute("aria-label") || "").trim();
    const opened = () => document.getElementById("playops")
      .getAttribute("aria-expanded");
    const before = shape();
    document.getElementById("play").click();          // start, with the fold open
    await new Promise((r) => setTimeout(r, 250));
    const afterStart = { shape: shape(), word: word(), open: opened() };
    document.getElementById("play").click();          // stop
    await new Promise((r) => setTimeout(r, 250));
    const afterStop = { shape: shape(), word: word(), open: opened() };
    document.getElementById("playops").click();       // the door closes again
    await new Promise((r) => setTimeout(r, 250));
    return { before, afterStart, afterStop,
             closedShape: shape(),
             expanded: opened(),
             boxShut: !!document.querySelector(".nu-baropts[hidden]") };
  });
  check(t3b.afterStart.shape === t3b.before && t3b.afterStop.shape === t3b.before
        && t3b.afterStart.open === "true" && t3b.afterStop.open === "true"
        && t3b.afterStart.word === "stop" && t3b.afterStop.word === "play",
    "T3 · …and the transport does not move the chrome: play then stop leave " +
    "the open surface, the hamburger and the fold exactly as they were, " +
    "while the mark reads " +
    JSON.stringify([t3b.afterStart.word, t3b.afterStop.word]));
  check(t3b.expanded === "false" && t3b.boxShut &&
        t3b.closedShape === t3b.before,
    "T3 · …and the door shuts the way it opened, saying so: aria-expanded " +
    JSON.stringify(t3b.expanded) + ", the fold hidden " + t3b.boxShut);
  /* AND IT IS RE-OPENED FOR T4, which measures the fader and needs the level
     it lives on. Said out loud rather than left as a side effect of the check
     above: shutting the door is an assertion here, not the state the rest of
     this file runs in. */
  await p.evaluate(() => document.getElementById("playops").click());
  await p.waitForTimeout(250);
  /* SIX CONTROLS NOW, AND ONE OF THE FIVE MOVED OUT OF THE LEVEL, 2026-08-30.
     This read "the five transport controls are on the page — #play in the
     head, the other four in the level", and Paul moved the die: *"Move the
     die icon to right above the question mark so it's always there."* So
     what is asserted here is that all six exist and #play is in the head;
     WHERE the die stands and what the level holds instead of it are T9's,
     which is the check the move belongs to.
     (`t3.foot` IS `t3.tp`: the ONE box that never empties is `.nu-bartp` inside
     `#nu-bar`. Nothing rebuilds the bar at all — `paintChrome` repaints faces
     in place — which is the same structural guarantee `.nu-trayfoot` gave and
     is the mechanical half of the word "permanent".) */
  check(t3.five.length === 5 && t3.tp === true,
    "T3 · …and the transport's controls are on the page — #play in the " +
    ".nu-bartp: " + JSON.stringify(t3.five));
  /* `t3.trayW === 56`, THEN `t3.trayW === t3.trayVar`, STOOD HERE, AND THE
     COLUMN IS DELETED. What that check was ever about is that the ONE BOX THE
     TRANSPORT LIVES IN IS THE TOKEN THE REST OF THE PAGE BUDGETS AGAINST — for
     the stripe that was `--tray-w` against its width; for the bar it is
     `--bar-h` against its height, and it matters MORE here, because the body's
     `padding-block-end: calc(var(--bar-h) + var(--s3))` is what keeps the last
     row of the table off the floor. A bar a pixel taller than its token is a
     pixel of the page underneath it and nothing would say so. Measured
     2026-09-09 at 320, 390 and 430: the box is 50.39 and the token is 50.39 at
     all three, while the row's tallest control renders 44 — the difference is
     spent inside the bar's own padding, which is what nu.css says it is for.
     EXACTLY ONE BAR, which is the live half of T1's retired `bars === 0`: two
     `.nu-bar`s would be two transports and the second one would be a fixed box
     over the first.
     The 44px tap floor is asserted here in the BLOCK axis only. Both axes are
     T10's, where the round's one red lives — see the tap-floor check there. */
  check(t3.minTap >= 44 && Math.abs(t3.barH - t3.barTok) <= 0.5 &&
        t3.bars === 1,
    "T3 · …every mark in it is a thumb tall (" + t3.minTap + " CSS px) in the " +
    "one bar on the page (" + t3.bars + ") whose box IS --bar-h (" + t3.barH +
    " / " + t3.barTok + ")");

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
     is a MEASUREMENT and not an assumption: the six panels are different
     heights and the tallest one moves as the record does, so the gate asks
     each tab how much overflow it has and stands on the deepest one. (The
     first version picked `Band` by name; measured at 390x844 on the boot
     record it had 0 px of overflow, and the scroll half of the check would
     have passed vacuously against a page that could not move.)
     AND A SHEET STILL SCROLLS THE WINDOW, which is why this walk survives the
     bar round unchanged. nu.css A PANEL AS A SHEET: the first draft made a
     sheet a fixed box with its own scroll and `window.scrollY` stopped moving
     on four of the six surfaces; what shipped is a panel IN FLOW with the
     chrome's two bands reserved, so the document is the scroller everywhere
     and `scrollY` means what this check needs it to mean. */
  const deepest = await p.evaluate(async () => {
    let best = null;
    /* `Time` LEFT THIS WALK WITH ITS TAB, 2026-09-06 (TABLE.md §10b): it is a
       merged ROW of the Band table, and Band is already in the list.
       ...AND SO DID `Motifs`, `Mix` AND `Produce`, 2026-09-07/08 (§10b steps
       3, 4 and 5) — all three are rows of that same table now. The list was a
       TYPED copy of `TABS`' words and it had already drifted (it still named
       `Mix` a round after the Mix tab was deleted, and `__eightTab` on a word
       that is not a tab is a no-op, so the walk measured the same panel twice
       and called it two tabs). It is `window.__eightTabs()` since — the page's
       own answer, in the page's own order, which cannot drift from `TABS`.
       (Six names as of 2026-09-09: Where, Band, Score, Video, Screensaver,
       Export. Five of them are SHEETS and Band is the page.) */
    for (const name of window.__eightTabs()) {
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
  /* ...AND THE DOOR IS A TOGGLE, SO IT IS OPENED IDEMPOTENTLY (2026-09-02).
     The play options were a LEVEL, and `__eightTab` above reset the level on
     every step of the deepest-tab walk — so an unconditional click always
     re-entered it. They are a FOLD now and a fold survives a tab change, which
     is the point of it; an unconditional click would therefore CLOSE the fold
     this check needs open. The gate asks the page whether it is open, exactly
     as a hand would look. */
  await p.evaluate(() => { const box = document.querySelector(".nu-baropts");
    if (box && box.hidden) document.getElementById("playops").click(); });
  await p.waitForTimeout(300);
  /* `.nu-trayvol .nu-vs-track` STOOD HERE. nu.css deleted the `.nu-trayvol`
     rule with the other forty, and for an afternoon ui/eight.js still WORE the
     class (`el("span", null, "nu-vs nu-vs-tall nu-trayvol")`) — a name that
     styled nothing and pointed at a box that had moved house. It was reported
     rather than fixed here, because this gate owns no app file, and the class
     is off the span now. Either way the fader is addressed by the FOLD IT IS
     IN, which is what a thumb reaches and what nu.css actually styles
     (`.nu-baropts .nu-vs-tall`): a gate that asked for a dead class would be
     asserting the gutter one more time. */
  const room = await p.evaluate(() => {
    const t = document.querySelector(".nu-baropts .nu-vs-track");
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, top: r.y + 8, bot: r.y + r.height - 8,
             scrollable: document.documentElement.scrollHeight - window.innerHeight,
             y: window.scrollY, v: +document.getElementById("vol").value };
  });
  if (!room) check(false, "T4 · there is no fader inside the .nu-baropts fold");
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
      out: (document.querySelector(".nu-baropts .nu-vs-val") || {}).textContent }));
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


  /* ---- THE TRANSPORT, PUT DOWN ON PURPOSE ---------------------------- */
  /* #play IS A TOGGLE AND A GATE THAT CLICKS IT IS NOT PRESSING "STOP" — it
     is pressing "the other one". Worse, a start is ASYNCHRONOUS: the engine
     takes seconds to open, `playing` is false the whole time, and a second
     click during the wait QUEUES ANOTHER START rather than cancelling the
     first (audio/live.js `setPendingStart`). The first draft of T11 lost
     four checks to exactly that — a rewrite in T9 left a start in flight, the
     drive's click stopped the record it meant to begin, and sixty seconds of
     silence were measured and reported as a dead control.
     So: `press(want)` reads the mark's own word — the fact a thumb reads —
     and only presses when the word disagrees with what is wanted; `quiet()`
     waits for a start in flight to LAND before pressing stop, and then waits
     for the stop. Both are hands, not doors: they press #play. */
  const press = (want) => p.evaluate((w) => {
    const b = document.getElementById("play");
    const on = (b.getAttribute("aria-label") || "").trim() === "stop";
    if (on !== w) b.click();
    return on;
  }, want);
  const quiet = async () => {
    for (let i = 0; i < 60; i++) {                   // let a start land first
      const s = await p.evaluate(() => ({ playing: window.__nuBounce().playing,
                                          state: window.__nuBounce().state }));
      if (s.playing || s.state !== "starting") break;
      await p.waitForTimeout(500);
    }
    await press(false);
    for (let i = 0; i < 20; i++) {
      if (!await p.evaluate(() => window.__nuBounce().playing)) break;
      await p.waitForTimeout(200);
    }
    return p.evaluate(() => window.__nuBounce().playing);
  };

  /* ---- T9 THE DIE IS PERMANENT, IN THE BAR, BESIDE THE GENRE ---------- */
  /* Paul, 2026-08-30: *"Move the die icon to right above the question mark so
     it's always there."* …and 2026-09-09: *"have genre, dice, playstop along
     the bottom."*

     THREE CLAIMS AND THEY ARE THREE DIFFERENT KINDS OF FACT, so they are
     three checks: WHERE it stands (the bar's own order, read off the rendered
     children), that it stands there IN EVERY STATE (the walk T2 makes for
     #play, made again for this mark — "permanent" is a claim about every
     surface and a check on the table alone would pass on a button that
     vanished the moment you opened a sheet), and that it STILL DOES ITS JOB
     (the reading moves and the record starts, which is the whole gesture; a
     mark that moved house and lost its listener is exactly the bug a geometry
     check cannot see).
     AND THE PLAY FOLD LOST IT, which is the other half of "a mark cannot be
     in two places" — asserted as an ABSENCE from the fold's own children
     alongside the presence of the mode mark, because two #rewrites would be
     two owners of one gesture.

     ===== "ABOVE THE QUESTION MARK AND THE LOG" IS RETIRED, 2026-09-09 =====
     It was true of a COLUMN and a column is the only shape that has an
     "above". The ? went on 2026-09-02 (Paul: *"Get rid of explain"*, T8's
     tombstone); the LOG went into the hamburger on 2026-09-09, because it is
     the fifth thing on this page that is a readout and not a control, and its
     count rides the ≡ itself so it is on the screen with the menu shut. What
     the die stands beside now is the genre plate on one side and the
     transport on the other, which is Paul's own sentence in his own order, and
     that ORDER is what is asserted — three boxes in the bar, five children in
     the seed row, four in the transport. An order and not an index
     arithmetic, for the reason it always was: an arithmetic that grows with
     the row is the thing that breaks silently. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  const t9 = await p.evaluate(() => {
    const bar = document.querySelector("#nu-bar");
    const kids = [...bar.children].map((n) =>
      n.id || n.dataset.k || n.className || n.tagName.toLowerCase());
    /* THE SEED IS A ROW OF FIVE SINCE 2026-09-09, and the die is its first
       child. Paul, 2026-09-03: *"Instead of a popup for seed, just get rid of
       the word seed and put the number. I tap the die and there's a new
       number. I tap the number and I can enter a new number by hand."* — two
       gestures on one subject are two targets, and a button inside a button is
       not a thing the DOM has. What joined the row this round is the GENERAL
       COUNTDOWN (`.nu-count`), which was the head of the gutter's foot and is
       on the number now "because that is where a hand looking at a number
       wants to be told when it will be heard"; it stands down while the seed's
       own wait is up, so exactly one of the two is ever drawn. */
    const seed = [...bar.querySelector(".nu-seedrow").children].map((n) =>
      n.id || n.dataset.k || n.className || n.tagName.toLowerCase());
    return { kids, seed,
             gone: kids.indexOf("explain"),
             barLog: !!document.querySelector("#nu-bar [data-k=\"logger\"]"),
             menuLog: !!document.querySelector("#nu-menu [data-k=\"logger\"]"),
             /* AND THE LOG IS THE LAST ROW OF THE MENU, AFTER THE RULE. The
                `<hr class="nu-viewcut">` is the §10a division drawn: four
                things you LOOK AT, then a readout. Read off the rendered
                children rather than off `MENUROWS()`, which does not know the
                rule exists. */
             menuTail: (() => { const m = document.getElementById("nu-menu");
               if (!m) return null;
               return [...m.children].slice(-2).map((n) =>
                 n.dataset.k || n.className || n.tagName.toLowerCase()); })(),
             inFold: !!document.querySelector(".nu-baropts #rewrite"),
             tap: +document.getElementById("rewrite")
                    .getBoundingClientRect().height.toFixed(1),
             num: +document.getElementById("seedval")
                    .getBoundingClientRect().height.toFixed(1),
             reading: !!document.querySelector("#nu-bar .nu-seedrow #seedval #reading") };
  });
  check(JSON.stringify(t9.kids) ===
          JSON.stringify(["toptab-Where", "nu-seedrow", "nu-bartp"]) &&
        JSON.stringify(t9.seed) ===
          JSON.stringify(["rewrite", "seedval", "seedin", "nu-seedwait",
                          "nu-count"]) &&
        !t9.inFold && t9.gone < 0,
    "T9 · the bar reads genre · seed · transport and the seed row reads die · " +
    "number · field · wait · countdown, in that order, with no ? anywhere in " +
    "it and the die nowhere else — " +
    JSON.stringify({ bar: t9.kids, seed: t9.seed }));
  check(!t9.barLog && t9.menuLog &&
        JSON.stringify(t9.menuTail) === JSON.stringify(["nu-viewcut", "logger"]),
    "T9 · …and the log left the transport for the hamburger, below the rule " +
    "that divides the viewers from the readout (in the bar " + t9.barLog +
    ", in the menu " + t9.menuLog + ", tail " + JSON.stringify(t9.menuTail) + ")");
  check(t9.tap >= 44 && t9.num >= 44 && t9.reading,
    "T9 · …still a thumb TALL (die " + t9.tap + " px, number " + t9.num +
    " px) and still carrying #reading, which is the number's own target now");
  /* IN EVERY STATE. The same walk T2 makes for #play — the six surfaces
     opened, the table and the five sheets — plus the fold, which no surface
     reaches. AND IT IS THE SAME TWO READINGS T2 TAKES: the mark is in
     `#nu-bar .nu-seedrow`, and its rect is on the screen. A die under a sheet
     is a die that is not always there, and the DOM cannot tell you that. */
  const t9b = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const missing = [], offscreen = [], seen = [];
    const look = (where) => {
      const b = document.querySelector("#nu-bar .nu-seedrow #rewrite");
      if (!b) { missing.push(where); return; }
      const r = b.getBoundingClientRect();
      if (!(r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1))
        offscreen.push([where, +r.top.toFixed(1), +r.bottom.toFixed(1)]);
    };
    for (const name of window.__eightTabs()) {
      window.__eightTab(name); await wait(120);
      seen.push(name);
      look(name);
      window.__eightUp(); await wait(60);
    }
    document.getElementById("playops").click(); await wait(150);
    look("the fold");
    const inFold = [...document.querySelectorAll(".nu-baropts *")]
      .map((n) => n.id).filter((x) => x);
    document.getElementById("playops").click(); await wait(80);
    return { missing, offscreen, seen, inFold };
  });
  check(!t9b.missing.length && !t9b.offscreen.length,
    "T9 · …in the bar and on the screen in every state, and with the play " +
    "options unfolded (" + JSON.stringify(t9b.seen) + ", missing " +
    JSON.stringify(t9b.missing) + ", off-screen " +
    JSON.stringify(t9b.offscreen) + ")");
  /* `items.indexOf("tp.rewrite") < 0 && items.indexOf("tp.mode") === 0` STOOD
     HERE and both halves were about a LEVEL's item list. The play group is a
     fold (T3), so the same two claims are read off the fold's own children:
     the die is not in it — "a mark cannot be in two places", the 2026-08-30
     law, unchanged — and the MODE is first, which is the 2026-08-30 argument
     for the order ("it is the only one of the four that says what pressing ▶
     will DO"). */
  check(t9b.inFold.indexOf("rewrite") < 0 && t9b.inFold[0] === "playmode",
    "T9 · …and the fold LOST the die — a mark cannot be in two places, and " +
    "the mode is still first: " + JSON.stringify(t9b.inFold));
  /* AND IT STILL RESEEDS. The press is the whole gesture: the seed moves, the
     digit on the button moves with it (Paul, 2026-08-27: "I clicked rewrite
     multiple times and never saw a different seed"), and the record starts,
     because #rewrite has gone through `startNow` since the day it landed. */
  /* AND THE PRESS IS ONE PRESS AGAIN (2026-09-03). It was one until
     2026-09-02, then two (the die opened a flyout and `roll` inside it
     rolled); Paul, the next day: *"Instead of a popup for seed, just get rid
     of the word seed and put the number. I tap the die and there's a new
     number."* `rewriteNow` never moved — it is still the one reseed path this
     box has and still the function `album` calls — so everything this check
     asserts is what it always asserted: the seed moves, the digit moves with
     it, the accessible name carries the number, and the record starts
     (#rewrite has gone through `startNow` since the day it landed). */
  const t9c = await p.evaluate(async () => {
    const rd = () => document.getElementById("reading").textContent;
    const was = rd();
    document.getElementById("rewrite").click();       // one press, one roll
    await new Promise((r) => setTimeout(r, 900));
    const now = rd();
    const name = document.getElementById("rewrite").getAttribute("aria-label");
    return { was, now, name, playing: window.__nuBounce().playing };
  });
  // ...and the box is put down again, ON PURPOSE — see `quiet` above. The
  // rewrite STARTS the record (it always has: #rewrite goes through
  // `startNow`), and a start left in flight is the state every check after
  // this one would have inherited.
  await quiet();
  check(t9c.now !== t9c.was && t9c.name === "rewrite " + t9c.now,
    "T9 · …and it still reseeds in one press: reading " +
    t9c.was + " -> " + t9c.now + ", and the name says it too (" +
    JSON.stringify(t9c.name) + ")");

  /* ---- T10 EVERY MARK WEARS ITS WORD, AND THE BAR'S ROW IS MEASURED --- */
  /* Paul, 2026-08-30: *"Label all the icons with tiny short labels
     underneath."*

     THE LABEL IS THE `.nu-vh` SPAN — one string, from the table that owns the
     name, in the `aria-label` and in the DOM (ui/glyph.js `paintIcon` has put
     it in every mark since the marks landed). So the check is not "there is
     some text": it is that the WORD IS THE HEAD OF THE ACCESSIBLE NAME, mark
     by mark, which is what makes it an extraction and not a second dictionary.

     ===== AND WHERE THE WORD IS *VISIBLE* IS NOW THREE ANSWERS, 2026-09-09 ==
     In the gutter this was one answer: `#nu-tray .nu-vh` un-hid the span in an
     87px column and ellipsised it, which is exactly what Paul asked for and
     what the 47px clipping bug was about. The chrome has three boxes and they
     spend their room differently, and the split is MEASURED here rather than
     assumed:
       · `#nu-menu` un-hides it whole — a 30ch plate holds "Screensaver" at
         body size, "which is the one thing the gutter could never afford";
       · the bar's GENRE PLATE un-hides it as the first of two lines (the wiki
         name over the place and year), which is `nameRecord`'s whole job;
       · every OTHER mark in the bar and both marks in `.nu-top` fall back to
         `.nu-vh`'s original four declarations and are 1x1 and out of flow —
         measured 2026-09-09 at 390x844: burger, playmode, take, playops,
         voicing, play and the die are all 1x1, and toptab-Where is 142.9x19.
     THAT IS A DESIGN FACT WITH A REASON — `.nu-bar { block-size: var(--bar-h) }`
     is the tap floor plus two `--s1`s and has no second line to give — BUT IT
     IS ALSO A HALF-RETREAT FROM A THING PAUL ASKED FOR BY NAME, so it is
     PRINTED in the check below rather than passed over. The LAW this gate
     holds is the one that survives every arrangement: the word exists, it is
     the head of the name, and it reads as itself with the stylesheet off.

     TWO MARKS ARE EXEMPT BY CONSTRUCTION and named rather than skipped: the
     DIE, whose word Paul deleted (*"just get rid of the word seed and put the
     number"* — nu.css keeps the span out of flow so the mark stays 44px and
     the page still reads as itself with no stylesheet), and `#seedval`, the
     number, which has no `.nu-vh` at all because the number IS the word. Both
     are asked for the things every mark is asked for instead: an accessible
     NAME, and the tap floor.

     AND NOTHING IS CLIPPED. `#nu-menu` is `overflow-y: auto` and the bar is
     `flex-wrap: nowrap`, so a label wider than its mark would be trimmed in
     silence — which is the bug the gutter round measured and fixed
     (performance 62.4px, instrument 54.0, backwards 52.5, all before
     `min-inline-size: 0`). Every label's box is asserted INSIDE its button's
     box, which is a claim about the un-hidden ones and a tautology about the
     1x1 ones; it is applied to both because the day a bar mark gets its word
     back is the day it needs to be true.

     AND THE 44px FLOOR IS MEASURED IN BOTH AXES NOW, which is the one thing
     this round newly breaks and the reason this check is red. In the gutter,
     `#nu-tray button { min-inline-size: var(--tap) }` gave every mark its 44px
     of width and the sweep only had to watch the BLOCK axis (where a
     three-line label was being squeezed by `flex-shrink: 1`). That selector
     was deleted with the stripe and `.nu-bar button` declares only
     `min-block-size: var(--tap)` — so the bar's marks are as wide as their
     glyph plus padding and no wider. See the check for the numbers. */
  const t10 = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const bad = [], wide = [], small = [], shown = [], hidden = [];
    const sweep = () => {
      /* `#nu-tray button` STOOD HERE. The chrome is three boxes and they are
         all inside `#nu-chrome`, which is the `<nav>` ui/eight.js `chromeRow`
         fills — so one scope still reaches every mark, exactly as one scope
         did when the mark was in a stripe. */
      for (const b of document.querySelectorAll("#nu-chrome button")) {
        /* ON THE PAGE, OR NOT MEASURED (2026-09-02) — shell.js's own `shown()`
           rule, borrowed here for the reason it was written there: "that is not
           a finding, it is the gate measuring furniture in another room". Three
           kinds of mark in this chrome are in the DOM at every moment and laid
           out only when a hand has opened something: the fold's three controls,
           the hamburger's five rows, and `#sheetclose`, which is `hidden` until
           a sheet is up. A `display: none` control is 0x0 and has no label box.
           The sweep opens each of the three below and measures them there,
           which is where a thumb meets them. */
        if (!b.getClientRects().length) continue;
        const v = b.querySelector(".nu-vh");
        const k = b.id || b.dataset.k || "?";
        const br = b.getBoundingClientRect();
        const name = (b.getAttribute("aria-label") || "").trim();
        /* THE 44px FLOOR, IN BOTH AXES, FOR EVERY MARK IN THE CHROME. It was
           two rules — height for the labelled marks, both axes for the seed
           row's two — and they are one rule now, because the reason the seed
           row got the stricter one (a mark with no word in flow is a mark
           whose width is its glyph's) is true of seven marks in the bar. */
        /* ONE ENTRY PER MARK AND NOT ONE PER SWEEP. This sweep runs eight
           times (the resting table, the six surfaces, the hamburger, the
           fold), so an undersized mark reported once a pass turns a four-mark
           finding into thirty-two entries and the reader has to count them to
           see it is four. The failure is a property of the MARK, so it is
           filed against the mark's key. */
        if ((br.height < 44 - 0.5 || br.width < 44 - 0.5) &&
            !small.some((s) => s[0] === k))
          small.push([k, +br.height.toFixed(1), +br.width.toFixed(1)]);
        /* ...AND THE SEED ROW IS THE ONE PLACE WITH NO WORD AT ALL
           (2026-09-03), which is a named exemption and not a hole. Paul:
           *"Instead of a popup for seed, just get rid of the word seed and put
           the number."* The word under the die WAS "seed" and it is the word
           he named; what stands beside the picture now is `#seedval`, the
           number, which is its own target. So these two are measured for
           everything else this sweep measures — the 44px floor in both axes
           and an accessible NAME — and are not asked for a `.nu-vh` they
           deliberately do not have. Every OTHER mark in the chrome is still an
           extraction and is still checked as one.
           (`#rewrite` DOES still carry a hidden span reading "seed" — nu.css
           `.nu-seedrow > #rewrite .nu-vh` puts `.nu-vh`'s original four
           declarations back on it so the page reads as itself with the
           stylesheet off. Its accessible name is `"rewrite " + n`, which is
           what the press will DO and what eleven gates call this control by, so
           the word is deliberately NOT the head of the name here and this
           branch is why that is a decision and not a failure.) */
        if (b.closest(".nu-seedrow")) {
          if (!name) bad.push([k, "no accessible name"]);
          continue;
        }
        if (!v) { bad.push([k, "no label"]); continue; }
        const r = v.getBoundingClientRect();
        const laid = getComputedStyle(v).position !== "absolute";
        (laid ? shown : hidden).push([k, v.textContent.trim(),
                                      +r.width.toFixed(1), +r.height.toFixed(1)]);
        if (!v.textContent.trim()) bad.push([k, "label has no text"]);
        /* the name may carry a number or a refusal's reason; the WORD is its
           head — READ WITHOUT REGARD TO CASE, because the two strings come out
           of two catalogue conventions that DESIGN.md §4 sets on purpose and
           the text pass (7cf0d37) applied to all of them: a glyph's word is a
           tiny lower-case label under a mark (`glyph.act.close` is "close")
           and an accessible name is a sentence-cased verb phrase ("Verbs for
           actions" — all 53 `*.aria` keys in the catalogue begin with a
           capital, "Close {name}" among them). `#sheetclose` is the one mark
           where a visible word and an `*.aria` name meet, so it was the only
           one this read could catch, and it has read "close vs Close Where" on
           every tab since the text pass — v281 fails it identically, so it is
           older than the design pass. A capital is not a different word; a
           different word is. */
        else if (name.toLowerCase() !== v.textContent.trim().toLowerCase() &&
                 name.toLowerCase().indexOf(v.textContent.trim().toLowerCase()) !== 0)
          bad.push([k, v.textContent + " vs " + name]);
        /* BOTH AXES. Sideways is where a fixed row clips (`.nu-bar` is
           `flex-wrap: nowrap`); DOWNWARD is where a flex column clips, and it
           did in the gutter: a three-line label was squeezed into a 44px mark
           by the default `flex-shrink: 1` while the box still reported the tap
           floor. A check that only measured width would have passed on that. */
        if (r.left < br.left - 0.5 || r.right > br.right + 0.5 ||
            r.top < br.top - 0.5 || r.bottom > br.bottom + 0.5)
          wide.push([k, v.textContent, +r.width.toFixed(1),
                     +br.width.toFixed(1), +r.height.toFixed(1),
                     +br.height.toFixed(1)]);
      }
    };
    sweep();
    /* THE THREE THAT HAVE TO BE OPENED TO BE MEASURED, in the order a hand
       opens them: a sheet (which is what raises `#sheetclose`), the hamburger,
       and the play fold. */
    for (const name of window.__eightTabs()) {
      window.__eightTab(name); await wait(90); sweep(); window.__eightUp();
      await wait(40);
    }
    window.__eightMenuOpen(true); await wait(150); sweep();
    window.__eightMenuOpen(false); await wait(80);
    { const box = document.querySelector(".nu-baropts");
      if (box && box.hidden) document.getElementById("playops").click(); }
    await wait(150); sweep();
    /* `.nu-trayvol .nu-vh` STOOD HERE and the naive re-point — `.nu-baropts
       .nu-vh` — WAS RED IN ITS FIRST RUN, which is worth writing down because
       it is the same class of mistake this whole file is about. The fold's
       first `.nu-vh` is `#playmode`'s, so the check read *"the room fader is
       labelled off its own control's aria-label ("loop" / "room")"* — a gate
       measuring the wrong control and reporting it as the app's fault. The
       fader is the one thing in the fold that is not a button, so it is scoped
       by the chassis it IS (`.nu-vs`, ui/engineer.js `vchassis`) and not by the
       box it sits in. */
    const room = document.querySelector(".nu-baropts .nu-vs .nu-vh");
    const out = { bad, wide, small, shown, hidden,
      room: room ? room.textContent : null,
      roomName: document.getElementById("vol").getAttribute("aria-label"),
      /* AND THE ≡ WEARS THE LOG'S BADGE, which is the promise `.nu-trayfoot`
         made about the log button ("always there, at a size that never
         changes") kept on a page where the log is behind a door. The badge is
         the `.nu-n` `paintBadge` writes, and the burger's accessible name is
         its own word FIRST and the count after it — "menu, 3 lines" — so the
         extraction law above passes on it for the same reason `#rewrite`'s
         would if it still had a visible word. */
      burgerBadge: !!document.querySelector("#burger .nu-n"),
      logs: window.__nuLog().length,
      burgerName: (document.getElementById("burger") ||
        { getAttribute: () => null }).getAttribute("aria-label"),
      mode: (document.querySelector("#playmode .nu-vh") || {}).textContent };
    { const box = document.querySelector(".nu-baropts");
      if (box && !box.hidden) document.getElementById("playops").click(); }
    await wait(80);
    return out;
  });
  check(!t10.bad.length,
    "T10 · every mark in the chrome — the top strip, the hamburger and the " +
    "bar — wears its own word, and the word IS the head of the accessible " +
    "name " + JSON.stringify(t10.bad) + ". Where the word is VISIBLE, " +
    "measured: " + JSON.stringify(t10.shown) + "; where it is `.nu-vh` and " +
    "1x1 (no second line in a --bar-h row): " +
    JSON.stringify(t10.hidden.map((h) => h[0])));
  check(!t10.wide.length,
    "T10 · …and no label is clipped: every one is inside its mark's box " +
    JSON.stringify(t10.wide));
  /* THE ONE RED THIS ROUND LEAVES STANDING, AND IT IS THE APP'S AND NOT THE
     GATE'S. nu.css AND THE 44px FLOOR THE GUTTER'S OWN RULE USED TO CARRY says
     of `#nu-tray button, #boardtabs button, .nu-decktabs > button`: *"the
     first selector is deleted with the stripe. The other two are not … The
     chrome's own three boxes each declare it above, on the buttons they
     hold."* TWO OF THE THREE DO. `.nu-top > button` declares
     `min-inline-size: var(--tap)` and `#nu-menu > button` declares
     `inline-size: 100%`; `.nu-bar button` declares `min-block-size: var(--tap)`
     ONLY, so four marks in the row Paul asked for by name come out narrower
     than a thumb. Measured on the rendered page 2026-09-09 at 320, 390 and 430
     — the same at all three, because the marks are `flex: 0 0 auto` and their
     width is a glyph plus `--s3` of padding, which is exactly why the number
     wobbles with the glyph (`#voicing` measures 33.7 wearing ⌁ and 29.3
     wearing the mode this gate leaves it in):
         #play    31.8 x 44        #voicing  29.3-33.7 x 44
         #rewrite 33.7 x 44        #playops  34.2 x 44
     — against a 44px floor this page has held since the marks landed and which
     nu.css states, in that same block, is a floor because *"an <svg> brought
     its own 40px of width; a glyph brings 10-30px, so `←` in a 2px-padded
     button is a 20px target — under half the floor."* This is that sentence
     happening. The fix is one declaration in nu.css (`.nu-bar button {
     min-inline-size: var(--tap) }`, which the bar has the room for — measured
     at 320 the row's six visible marks come to 299.3px of an available 304)
     and this gate does not own that file, so it is REPORTED as a red rather
     than softened into a green. A gate that lowered its own floor to match the
     page would be the harness lying. */
  check(!t10.small.length,
    "T10 · …and the 44px tap floor holds IN BOTH AXES " +
    JSON.stringify(t10.small));
  check(t10.room === t10.roomName && t10.room === "room",
    "T10 · the room fader is labelled off its own control's aria-label (" +
    JSON.stringify(t10.room) + " / " + JSON.stringify(t10.roomName) + ")");
  /* THE BADGE IS ASSERTED AGAINST THE LOG'S OWN LENGTH AND NOT AS A BARE
     TRUTH. `paintBadge` writes `num: logs.length || null`, and `paintIcon`
     draws no `.nu-n` for a null — so "there is a badge" is only a claim while
     there is something to count, and a check that demanded one unconditionally
     would go red on a page nobody had made a sound on. By the time this runs
     the box has played, stopped and reseeded, so the honest form is the
     BICONDITIONAL: a badge exactly when there are lines. */
  check(t10.burgerBadge === (t10.logs > 0) &&
        /^menu/.test(String(t10.burgerName || "")),
    "T10 · …and the ≡ carries the log's badge, so the count is on the screen " +
    "with the menu shut, while its NAME still begins with its own word (" +
    JSON.stringify(t10.burgerName) + ", badge " + t10.burgerBadge + " for " +
    t10.logs + " lines)");

  /* ===== T10b IS RETIRED WITH THE COLUMN IT WAS ARITHMETIC ABOUT ========
     (2026-09-09, TABLE.md §10b steps 6 and 7.)

     WHAT IT ASSERTED, so nobody mourns the wrong thing. The ask was *"every
     level fits at 320x568 with no list scroll"*, and T10b's whole job was to
     say IN NUMBERS that it never did and never could: measured on the SHIPPED
     page the morning of 2026-08-30 at 320x568, the root was 441px of marks
     against a 360px list (over by 81), the fourteen motif operations 689
     against 303 (over by 386), the tempo level 391 and the band level 342
     against that same 303. NINE 44px TARGETS ARE 396px BEFORE A SINGLE GAP —
     the tap floor was the binding constraint, not the type size — and the
     round that added the labels put 0-14px a level on top of it and 44px of
     list back by moving the die into the foot: after, at the same width, root
     441/316, tempo 405/259, motifops 703/259. What it therefore CHECKED, once
     the exact claim was abandoned, was the honest pair: at 390x844 the tree's
     longest state is reachable, and at 320x568 every mark is reachable because
     `.nu-traylist` is a scroller and the last mark of the longest level is
     inside the list's box after scrolling to the end. `levelsAt()` printed
     every level's `want/have` at both phones so the next round could read the
     cost without re-measuring it.

     WHY IT GOES: there is no list, no level, no `.nu-traylist` to scroll and
     no column to fit anything in. Paul: *"…a real mobile app now with
     everything in the table and the nav space reclaimed."* The whole subject —
     "how many 44px marks can a 96-to-176px vertical stripe stack before the
     reader has to scroll it" — was reclaimed along with the space.
     AND THE OUTSTANDING RED GOES WITH IT. `N8 390 · the indent is not what
     clipped anything` (2026-09-08) held a 96px gutter word box against a 7px
     `--nu-indent` and said the indent was innocent; both numbers are about
     `[data-depth]` rules and a `.nu-traylist` that are deleted, so the finding
     is retired rather than carried forward as a red nobody can act on.

     WHAT REPLACES IT IS THE SAME KIND OF CLAIM ABOUT THE ROW: a bar cannot
     scroll and must not wrap (`.nu-bar` is `flex-wrap: nowrap` and its
     `block-size` is `--bar-h`, a token the body's own padding is arithmetic
     on), so the failure mode is not "you have to scroll to reach it", it is
     "it went sideways, or it grew, or a mark got squeezed under the floor".
     Those three are measured at BOTH PHONES and PRINTED either way, which is
     what the note this block replaces already promised: the next round can see
     what the chrome costs without re-measuring it. */
  const barAt = async () => p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const bar = document.querySelector(".nu-bar");
    const br = bar.getBoundingClientRect();
    const tok = (v) => { const d = document.createElement("div");
      d.style.cssText = "position:absolute;left:-9999px;top:0;inline-size:1px;" +
        "box-sizing:border-box;block-size:" + v;
      document.body.appendChild(d);
      const h = +d.getBoundingClientRect().height.toFixed(2); d.remove(); return h; };
    /* ONE LINE, READ AS ONE `top`. A wrapped bar is a bar whose children sit on
       two rows, and the cheapest true reading of that is the number of distinct
       rounded `top`s among them — cheaper and less brittle than comparing the
       row's height to the sum of its parts, which a `gap` and a `padding` both
       lie about. */
    const tops = new Set([...bar.children]
      .map((c) => Math.round(c.getBoundingClientRect().top)));
    const marks = [...bar.querySelectorAll("button")]
      .filter((n) => n.getClientRects().length)
      .map((n) => [n.id || n.dataset.k, +n.getBoundingClientRect().width.toFixed(1),
                   +n.getBoundingClientRect().height.toFixed(1)]);
    /* AND THE MENU AND THE FOLD ARE OPENED AND MEASURED WHERE THEY LAND. Both
       hang off a fixed box at a corner, so the thing that can go wrong at a
       narrow phone is that one of them runs off the screen — which no amount
       of DOM reading finds. */
    window.__eightMenuOpen(true); await wait(180);
    const m = document.getElementById("nu-menu").getBoundingClientRect();
    const menu = { x: +m.x.toFixed(1), right: +m.right.toFixed(1),
                   h: +m.height.toFixed(1), bottom: +m.bottom.toFixed(1),
                   scrolls: document.getElementById("nu-menu").scrollHeight -
                            document.getElementById("nu-menu").clientHeight,
                   inside: m.x >= -0.5 && m.right <= window.innerWidth + 0.5 &&
                           m.bottom <= window.innerHeight + 0.5 };
    window.__eightMenuOpen(false); await wait(100);
    document.getElementById("playops").click(); await wait(220);
    const f = document.querySelector(".nu-baropts").getBoundingClientRect();
    const fold = { x: +f.x.toFixed(1), right: +f.right.toFixed(1),
                   top: +f.top.toFixed(1), h: +f.height.toFixed(1),
                   inside: f.x >= -0.5 && f.right <= window.innerWidth + 0.5 &&
                           f.top >= -0.5 };
    document.getElementById("playops").click(); await wait(120);
    return { w: window.innerWidth, h: window.innerHeight,
             rows: tops.size,
             box: +br.height.toFixed(2), tok: tok("var(--bar-h)"),
             topTok: tok("var(--top-h)"),
             marks, menu, fold,
             sideways: document.documentElement.scrollWidth -
                       document.documentElement.clientWidth };
  });
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(200);
  const bar390 = await barAt();
  check(bar390.rows === 1 && Math.abs(bar390.box - bar390.tok) <= 0.5 &&
        bar390.sideways === 0 && bar390.menu.inside && bar390.fold.inside,
    "T10 · at 390x844 the bar is ONE row that IS --bar-h (" + bar390.box + "/" +
    bar390.tok + "), nothing goes sideways (" + bar390.sideways + "), and both " +
    "doors land on the screen. The row, measured: " +
    JSON.stringify(bar390.marks) + " · menu " + JSON.stringify(bar390.menu) +
    " · fold " + JSON.stringify(bar390.fold));
  await p.setViewportSize({ width: 320, height: 568 });
  await p.waitForTimeout(400);
  const bar320 = await barAt();
  check(bar320.rows === 1 && Math.abs(bar320.box - bar320.tok) <= 0.5 &&
        bar320.sideways === 0 && bar320.menu.inside && bar320.fold.inside,
    "T10 · …and at 320x568, the width this file has always reported rather " +
    "than wished at: one row of " + bar320.box + "/" + bar320.tok + ", zero " +
    "sideways, both doors inside the glass. The row, measured: " +
    JSON.stringify(bar320.marks) + " · menu " + JSON.stringify(bar320.menu) +
    " · fold " + JSON.stringify(bar320.fold));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(400);

  /* ---- T5 THE LIST IS PERMANENT, AND IT HAS AN ARTICLE COLUMN --------- */
  /* BACK TO THE TABLE FIRST, THEN THE PLATE. It read: *"the stripe is standing
     on the play level after T4, and a level draws exactly one set of siblings —
     the nine tabs are not among them, so a query for `[data-k="toptab-Where"]`
     finds nothing and a click on nothing leaves the gate reading a `display:
     none` panel and measuring zeros."* THE HAZARD IS THE SAME AND ITS SHAPE
     CHANGED: there are no levels, so the plate is always in the bar and always
     findable — but WHERE is a SHEET now, and a sheet that is not open wears
     `data-off` + `inert` and is `display: none`, so every measurement below
     would read a globe of zeros. `__eightUp()` closes whatever sheet T4 left
     open and shuts the menu (it is "close the sheet and shut the menu" since
     2026-09-09); the plate in `#nu-bar` is then pressed, which is the gesture a
     reader makes and the one the genre plate exists for — Paul, §10a: *"genre
     … opens WHERE, the globe, as a sheet — it is a picker."*
     IT IS THE BUTTON AND NOT `__eightTab("Where")`, deliberately: T7 below
     uses the probe, and having ONE of the two arrivals go through the rendered
     mark is what keeps the plate's own listener under test. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  await p.evaluate(() => {
    const b = document.querySelector('#nu-bar [data-k="toptab-Where"]');
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
      /* `a.nu-ixw` STOOD HERE AND HAD BEEN RED SINCE 2026-08-30 — Paul: *"In
         the genre list get rid of the Wikipedia link but leave the text. Put
         the link in a new icon on the right that isn't underlined."* The word
         became a plain `<span class="nu-ixw">` that PLAYS and the link became
         a sibling `<a class="nu-ixgo">↗`, so this selector matched nothing,
         `links` reported 0, and nearly every row fell into `bad`. Fixed to the
         split the page actually draws; the claim is unchanged and is the
         stronger half of it — every href on the page is `NuWiki.url()` of that
         row's own key, nothing typed. */
      const gk = n.dataset.gk, a = n.querySelector("a.nu-ixgo"),
            x = n.querySelector(".nu-ixw-no");
      if (a) { links++; if (a.getAttribute("href") !== W.url(gk)) bad.push(gk); }
      else if (x) { no++; if (!(x.dataset.why || "").length) noWhy.push(gk); }
      else bad.push(gk + ": no article cell at all");
    }
    const hs = li.map((n) => n.querySelector(".nu-ixrow").getBoundingClientRect().height);
    /* `.nu-ixw` STOOD HERE AND IT WAS THE WRONG ELEMENT since 2026-08-30 —
       Paul: *"get rid of the Wikipedia link but leave the text. Put the link
       in a new icon on the right that isn't underlined."* The word became a
       plain span INSIDE the row button (its tap target is the button, which
       `minRow` already measures at 44) and the LINK became a separate `↗`
       anchor in a `--tap` track of its own. So the thing whose height this
       check is about — a target a thumb has to hit and miss the row with — is
       `a.nu-ixgo`. A row with no article has no such target at all and is
       measured as 44, which is the row's own floor and is what it is. */
    const as = li.map((n) => { const a = n.querySelector("a.nu-ixgo");
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
      const as = li.map((n) => { const a = n.querySelector("a.nu-ixgo");
        return a ? a.getBoundingClientRect().height : 44; });
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
  /* `window.__eightUp()` STOOD HERE AND IT WOULD NOW UNDO THE WHOLE CHECK
     (2026-09-09). It meant "fold the stripe back to the root" and the open TAB
     survived it, so the atlas T5 and T6 have been reading was still on the
     page. `__eightUp` is CLOSE THE SHEET AND SHUT THE MENU now — the two taps
     a hand makes to get back to the table — so calling it here would put
     `data-off` + `inert` on `#atlas` and every rect measured below would be a
     zero: a globe nobody was looking at, reported as a mark that did not grow.
     What the line was ever for is "be somewhere the check can run from", and
     that is now said forwards: make sure WHERE is the open sheet. */
  await p.evaluate(() => window.__eightTab("Where"));
  await p.waitForTimeout(400);
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
  /* ...AND THE READER IS PUT BACK ON THE GLOBE TO LOOK AT IT (2026-09-02).
     Paul: *"I click the genre, it starts to play, and there's a new view: A
     genre editor appears. This is the 'Rules' section."* Choosing a record now
     LANDS you on its rules, which is the whole point of the sentence — and a
     panel that is not open is `display: none`, so every measurement below
     would read a globe of zeros and report "the mark did not grow" about a
     mark nobody was looking at. Coming back to Where is what a hand does, and
     the three claims this check makes are about what the tap did to the MAP,
     which survives the trip. */
  await p.evaluate(() => window.__eightTab("Where"));
  await p.waitForTimeout(700);
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
  /* ===== …AND THE MARK IS RETIRED, 2026-09-02 ==========================
     Paul, after using the composer: *"Get rid of explain — that's the genre
     editor's work now."*

     TWO HUNDRED AND FIFTY LINES CAME OUT HERE, and it is worth saying exactly
     what they were holding so nobody mourns the wrong thing. T8a-h drove the ?
     mark and the panel behind it: the seat in the foot at every level, the
     door's `aria-expanded`, the eight axis headings, the zero-bytes-moved
     proof over a playing second, the tappable lineage that NAVIGATES, the
     verbatim `cannot`, the verbatim EXCLUDE sentence, five widths with no
     sideways scroll, and the 2026-08-30 form reversal ("it's hard to parse").
     WHAT THEY WERE PROVING IS STILL PROVED, one tab over. Every one of those
     facts is an EXTRACTION over the tables that own it, that extraction is
     `ui/xtab.js` (which survives — it is the half of ui/explain.js that
     ui/rules.js reads), and the surface it is drawn on now is the Rules panel,
     which is the genre editor Paul asked for in B6 and which has controls
     where the ? had values. Its own gate is test/rules.browser.js. What is
     deleted here is a gate on a DOOR that no longer exists — pressing
     `[data-k="explain"]` in a foot that has no such mark is the vacuous-green
     shape this file legislates against, so it is deleted rather than softened.
     THE ABSENCE IS ASSERTED, ONCE, BELOW — because "we removed it" is a claim
     about the rendered page like any other, and a ? that came back in a foot
     nobody was looking at is exactly the drift a tombstone is for. */
  /* AND THE SCOPE IS `#nu-chrome`, 2026-09-09 — `#nu-tray` is deleted, and a
     query against a selector that matches nothing NO MATTER WHAT THE PAGE DOES
     is the vacuous green this whole file legislates against. `#nu-chrome` is
     the `<nav>` that replaced it and holds all three of the chrome's boxes, so
     a ? that came back anywhere a thumb could reach it is caught. */
  const t8gone = await p.evaluate(() => ({
    mark: !!document.querySelector('#nu-chrome [data-k="explain"]'),
    byId: !!document.getElementById("explain"),
    panel: !!document.getElementById("nu-explain"),
    /* THE GENRE EDITOR IS THE TABLE'S RULES ROW SINCE 2026-09-06 (TABLE.md
       §10b step 2), so what stands in the ? mark's place is that row's own
       head and not a tray row — the claim ("the editor is reachable") is
       unchanged; only where it is reached moved. */
    rules: !!document.querySelector('#pan-band [data-k="trules"]'),
    /* ...AND THE LOG STANDS IN THE HAMBURGER SINCE 2026-09-09, which is the
       same "the readout did not move house, only its wall did" claim one
       surface out. It read `#nu-tray .nu-trayfoot [data-k="logger"]`. */
    log: !!document.querySelector('#nu-menu [data-k="logger"]') }));
  check(!t8gone.mark && !t8gone.byId && !t8gone.panel,
    "T8 · the ? mark and its panel are GONE from the rendered page — " +
    JSON.stringify(t8gone));
  check(t8gone.rules && t8gone.log,
    "T8 · …with the genre editor a row of the table in its place and the log " +
    "a row of the hamburger — the explainer moved house, the readout only " +
    "changed walls");


  /* ---- T11 THREE PLAY MODES, AND EACH ONE REACHES THE TRANSPORT ------- */
  /* Paul, 2026-08-30: *"There are three play modes possible—loop, once, and
     album which keeps making new songs. Let me set that with a three state
     icon in opt."*

     THIS IS THE "NO KNOB THAT CANNOT REACH THE SOUND" CHECK AND IT IS THE
     REASON THIS FILE GOT LONGER BY A MINUTE OF WALL CLOCK. A three-state icon
     is trivial to draw and trivial to draw DEAD: album is exactly the kind of
     control that could cycle its mark, log its line, satisfy every geometry
     assertion above and quietly do nothing at the end of the record. So the
     record is DRIVEN TO ITS END, three times, and what is asserted is what
     the transport did.

     THE RECORD IS MADE SHORT BY HAND, WITH THE PAGE'S OWN CONTROLS — the
     sections level's `remove` pressed until one section is left, then the
     tempo level's `twice the tempo` / `a little faster` / `double time`. No
     probe writes the document: a gate is a hand, and a four-bar record made
     by pressing the buttons is a record this box can actually be in. Measured
     on the boot record: 5 sections / 36 bars / 149.1 s becomes 1 section /
     4 bars / 2.2 s, which the engine plays out in about ten seconds counting
     its own eight-second prefill.

     WHAT EACH POSITION HAS TO PROVE:
       loop  — the control. Past the end of the record it is STILL PLAYING and
               the reading has NOT moved. Without this one, `once` and `album`
               could both be passing on an engine that stops by itself.
       once  — `playing` goes false at the seam and the mark reads "play"
               again (the word on it is the next tap).
       album — the READING MOVES and the box is playing again: that is the
               rewrite gesture taken by the clock, through `ATLAS.reseed`,
               which is the seed's one owner. */
  const shorten = () => p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    /* (A `#nu-tray` `tap` STOOD HERE and had no reader left once the delete
       moved: the only stripe key this function pressed was `secdrop`, and the
       stripe presses no ops at all now. The two scoped tappers below are the
       whole of it — one for the table, one for the tempo panel.) */
    /* ...AND THEY ARE `Band`'s AGAIN SINCE 2026-09-04 (nukernel/TABLE.md wave
       2c), which is not a reversal of Paul's "not buried under band": the Band
       tab IS the sections now — the table's rows, one tap from its arrival,
       beside its columns — so `Structure` has no tab to be top-level in.

       THE DELETE IS THE TABLE'S SINCE 2026-09-05 (TABLE.md §9a: *"NO OP LIVES
       IN THE NAV: the tray keeps the Band tab and, at most, jump links"*).
       `secdrop` was a CHILD of the section row in the stripe and is gone with
       the whole branch of acts; the row op it filed onto — `trow-del|<id>`, in
       that section's own ROW SHEET — is where it has been since wave 2b, and
       the gesture here is the same two taps it always was.
       ...AND BOTH TAPS ARE THE TABLE'S SINCE 2026-09-09. The first of them was
       the tray's `secnav<id>` JUMP — *"tapping `secnav<id>` runs `openSection`,
       which writes `formSec`, and `tablePanel` lands the arrival by clicking
       `trow|<id>` … driving it this way keeps the jump link itself under test,
       which is the only thing left on that branch worth breaking"* — and there
       is no tray to jump FROM. `trow|<id>` is the row head a thumb presses in
       the table itself, which is where `openSection` was landing anyway, so
       the gesture is unchanged and one indirection shorter. WHICH SECTIONS
       THERE ARE IS THE DOCUMENT'S ANSWER (`__eightDoc().form.sections`) and
       not a scrape of `[data-k^="trow|"]`, because the table draws `trow|` row
       heads for PLAYERS as well as sections and a scrape would have deleted
       whichever of the two the DOM happened to end with. */
    /* DOWN TO ONE SECTION, AND THE BOUND IS A SAFETY RAIL RATHER THAN A
       COUNT (2026-09-02). It read `i < 8`, which was the record this file was
       measured against — "5 sections / 36 bars / 149.1 s" in the paragraph
       above — and the record T7 leaves behind carries THIRTEEN now, so eight
       taps left five sections standing and the check under this loop read
       "5 section, 28 bars, 15.29 s" and went red for the arithmetic rather
       than for anything the gutter does. The loop's own exit is the honest
       one — it stops when there is one section left — and the number here only
       has to be larger than any record the composer deals. */
    const tapTable = async (k) => {
      const b = document.querySelector('#pan-band [data-k="' + CSS.escape(k) + '"]');
      if (!b || b.disabled) return false;
      b.click(); await wait(150); return true;
    };
    /* AND THE ROW HEAD IS OPENED IDEMPOTENTLY, which is `__eightRow`'s own law
       said again for a row that has no probe: *"a gate that opened TIME twice
       would have closed it with the second tap."* MEASURED, because the first
       draft of this loop did not do it and the failure was exact and silent:
       deleting a section leaves the table with the PREVIOUS section's row
       already open, so the next iteration's unconditional click SHUT the sheet
       it needed, `trow-del|s11` was not on the page, the loop broke on its own
       guard, and the check under it read "10 section, 60 bars, 32.75 s" — a
       red about a record that was never shortened rather than about anything
       the transport does. The gate asks the row whether it is open, which is
       what a hand does with an accordion. */
    const openRow = async (id) => {
      const at = () => document.querySelector(
        '#pan-band [data-k="' + CSS.escape("trow|" + id) + '"]');
      const b = at();
      if (!b) return false;
      if (b.getAttribute("aria-expanded") !== "true") { b.click(); await wait(250); }
      const n = at();
      return !!n && n.getAttribute("aria-expanded") === "true";
    };
    for (let i = 0; i < 32; i++) {                   // down to one section
      window.__eightTab("Band"); await wait(200);
      const secs = window.__eightDoc().form.sections;
      if (secs.length <= 1) break;
      const id = secs[secs.length - 1].id;
      if (!await openRow(id)) break;                 // the row head opens the sheet
      if (!await tapTable("trow-del|" + id)) break;
    }
    /* AND THE EIGHT TEMPO OPERATIONS ARE IN THE PANEL (2026-09-02). Paul: *"The
       left nav elements for tweaking tempo should be brought inside tempo."*
       Same `data-k`, same eight verbs, same refusals — a `#nu-tray` scope is
       what changed, so this taps the panel instead. */
    /* ...AND THE PANEL IS THE TABLE'S TIME ROW SINCE 2026-09-06 (TABLE.md
       §10b step 1): same `data-k`, same eight verbs, same refusals, and the
       scope is `#pan-band` because the Time TAB is deleted. */
    const tapPanel = async (k) => {
      const b = document.querySelector('#pan-band [data-k="' + k + '"]');
      if (!b || b.disabled) return false;
      b.click(); await wait(120); return true;
    };
    window.__eightRow("time"); await wait(400);      // and as fast as it counts
    await tapPanel("tempo-twice the tempo");
    for (let i = 0; i < 12; i++) await tapPanel("tempo-a little faster");
    await tapPanel("tempo-double time");
    window.__eightUp(); await wait(120);
    return { secs: window.__eightDoc().form.sections.length,
             bpm: window.__eightDoc().time.bpm,
             bars: window.__nuRender().bars,
             dur: +window.__nuBounce().durSec.toFixed(2) };
  });
  /* WHAT THE TRANSPORT IS DOING, AND WHY IF IT IS DOING NOTHING. The engine's
     own state travels with every sample — `state`, `stage` and `lastError` —
     because "the record stopped" and "the engine gave up" are two different
     findings and a check that could not tell them apart would blame this
     round for the box's weather. */
  const tstate = () => p.evaluate(() => {
    const b = window.__nuBounce();
    return { reading: (document.getElementById("reading") || {}).textContent,
             mode: window.__eightPlayMode(),
             playing: b.playing, state: b.state, stage: b.stage,
             err: b.lastError || null,
             bar: (() => { try { const m = window.__nuMix();
                                 return m ? m.bar : null; } catch (e) { return null; } })(),
             word: (document.getElementById("play").getAttribute("aria-label") || "").trim() };
  });
  // `press` and `quiet` are defined above T9, where the first start in this
  // file is made; every drive below goes through them.
  const drive = async (want, secs) => {              // play, and watch
    const t0 = Date.now();
    let sounded = false, hit = null, prev = "";
    const trail = [];
    await press(true);
    while (Date.now() - t0 < secs * 1000) {
      const s = await tstate();
      const k = [s.playing, s.state, s.err, s.reading].join("/");
      if (k !== prev) { trail.push(((Date.now() - t0) / 1000).toFixed(1) + "s " + k);
                        prev = k; }
      if (s.playing) sounded = true;
      if (sounded && want(s)) { hit = { ...s, at: +((Date.now() - t0) / 1000).toFixed(1) }; break; }
      await p.waitForTimeout(300);
    }
    return { sounded, hit, last: await tstate(), trail: trail.slice(0, 8),
             log: await p.evaluate(() => window.__nuLog().slice(0, 6)
               .map((L) => L.kind + ":" + L.what)) };
  };

  /* THE MARK ITSELF FIRST: three states, in the table's order, each one drawn
     from fields.js PLAYMODES and each one saying its own word. */
  /* AND THE DOOR IS OPENED IDEMPOTENTLY, T4's rule made here for T4's reason.
     It was an unconditional click and that was safe while the play options
     were a LEVEL, because the `__eightUp()` beside it reset the level first.
     A fold survives `__eightUp` — which is the whole point of a fold — so an
     unconditional click would CLOSE it on any run that reached here with it
     already open, and `#playmode` would be a 0x0 box with no word. The gate
     asks the page whether it is open, exactly as a hand would look. */
  await p.evaluate(() => { window.__eightUp();
    const box = document.querySelector(".nu-baropts");
    if (box && box.hidden) document.getElementById("playops").click(); });
  await p.waitForTimeout(250);
  const t11a = await p.evaluate(async () => {
    const seen = [];
    for (let i = 0; i < 4; i++) {
      const b = document.getElementById("playmode");
      seen.push([window.__eightPlayMode(),
                 (b.querySelector(".nu-vh") || {}).textContent,
                 (b.querySelector(".nu-g") || {}).textContent]);
      b.click(); await new Promise((r) => setTimeout(r, 80));
    }
    return { seen, table: Object.keys(window.NuFields.PLAYMODES),
             marks: Object.values(window.NuFields.PLAYMODES).map((m) => m.g) };
  });
  check(JSON.stringify(t11a.seen.map((s) => s[0])) ===
          JSON.stringify(t11a.table.concat(t11a.table[0])) &&
        t11a.seen.every((s, i) => s[1] === t11a.table[i % 3] &&
                                  s[2] === t11a.marks[i % 3]),
    "T11 · the mark cycles the three states of fields.js PLAYMODES and wears " +
    "each one's own mark and word: " + JSON.stringify(t11a.seen));

  const short = await shorten();
  check(short.bars > 0 && short.dur < 12,
    "T11 · the record is made short BY HAND — " + short.secs + " section, " +
    short.bars + " bars, " + short.dur + " s (from 5 / 36 / 149.1)");

  /* loop — the control: past the end, still going, same reading. */
  await p.evaluate(() => window.__eightPlayMode("loop"));
  const before = await tstate();
  const loop = await drive((s) => !s.playing || s.reading !== before.reading,
                           16 + short.dur * 3);
  check(loop.sounded && !loop.hit && loop.last.playing,
    "T11 · loop is what the box already did: " + (16 + short.dur * 3).toFixed(0) +
    " s past a " + short.dur + " s record it is still playing and the reading " +
    "has not moved (" + JSON.stringify(loop.last) + " · " +
    JSON.stringify(loop.trail) + " · " + JSON.stringify(loop.log) + ")");
  await quiet();

  /* once — it stops itself at the seam. */
  await p.evaluate(() => window.__eightPlayMode("once"));
  const once = await drive((s) => !s.playing, 60);
  check(!!once.hit && once.hit.word === "play",
    "T11 · once plays the record to its end and STOPS — playing went false " +
    "at " + (once.hit ? once.hit.at : "never") + " s and the mark reads " +
    JSON.stringify(once.last.word) + " again (" + JSON.stringify(once.last) +
    " · " + JSON.stringify(once.trail) + ")");

  /* album — the clock takes the rewrite gesture. */
  const short2 = await shorten();
  await p.evaluate(() => window.__eightPlayMode("album"));
  const was = await tstate();
  const album = await drive((s) => s.reading !== was.reading, 90);
  check(!!album.hit,
    "T11 · album writes another record at the end of this one — the reading " +
    "moved " + was.reading + " -> " + (album.hit ? album.hit.reading : "never") +
    " at " + (album.hit ? album.hit.at : "-") + " s on a " + short2.dur +
    " s record, and it is playing again (" + album.last.playing + ")");
  await p.evaluate(() => window.__eightPlayMode("loop"));
  await quiet();

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
