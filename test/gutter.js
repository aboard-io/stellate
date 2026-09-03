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
 *       so it's always there." #rewrite is in the FOOT, above the ? and the
 *       log, at every level, still carrying #reading and still reseeding —
 *       and the play level has LOST it (a mark cannot be in two places)
 *  T10  "Label all the icons with tiny short labels underneath." Every mark
 *       in the gutter wears its own `.nu-vh` word, the visible word IS the
 *       accessible name (an extraction, not a second dictionary), no label is
 *       clipped by its 47px mark, the 44px floor survives — and the COLUMN IS
 *       MEASURED at both phones and reported, because "every level fits at
 *       320x568" is not true, was not true before this round, and cannot be
 *       made true at a 44px tap floor (T10b carries the arithmetic)
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
      /* `.nu-trayhead #play` STOOD HERE and there is no head (2026-09-02).
         Paul: *"Move the play/stop button to the bottom, along with opts and
         where."* The claim is unchanged and is the whole word "permanent": the
         mark is in the ONE box `paintTray` never empties, at every state the
         tabs reach. That box is `.nu-trayfoot` now. */
      const head = document.querySelector(".nu-trayfoot #play");
      seen.push(lvl);
      if (!head) missing.push(lvl);
      window.__eightUp();
      await new Promise((r) => setTimeout(r, 20));
    }
    return { seen, missing, tabs: tabs.length,
             /* AND #play IS THE LAST CHILD OF THE FOOT. "At the bottom" is a
                geometry claim and the geometry is DOM order — the foot has no
                `position` and no `margin: auto`, so what is last is at the
                floor. Asserted as a fact about the tree rather than as a
                pixel, because a pixel would pass on a foot that had been
                re-ordered and re-positioned back. */
             last: (() => { const f = document.querySelector(".nu-trayfoot");
               return f && f.lastElementChild ? f.lastElementChild.id : null; })() };
  });
  /* `t2.tabs === 9` STOOD HERE AND HAD BEEN RED SINCE 2026-09-01 — it counted
     the root's `toptab-` buttons against a literal nine while `TABS` had grown
     to eleven (Video, Screensaver) and now thirteen (Rules, Structure). A
     literal was the wrong shape for it from the start: what the walk is about
     is "#play survives every tab", not "there are N tabs", and the number of
     tabs is `__eightTabs()`'s to say. The one number this file still asserts
     about the list is that `Where` is NOT in it — Paul, 2026-09-02: *"Move the
     play/stop button to the bottom, along with opts and where"* — which is the
     one thing a count would have caught and a derivation would not. */
  const t2n = await p.evaluate(() => ({
    tabs: window.__eightTabs().length,
    where: !!document.querySelector('.nu-traylist [data-k="toptab-Where"]'),
    footWhere: !!document.querySelector('.nu-trayfoot [data-k="toptab-Where"]') }));
  check(t2.tabs === t2n.tabs - 1 && !t2.missing.length,
    "T2 · #play is in .nu-trayfoot at every state the tabs reach (" +
    t2.tabs + " rows for " + t2n.tabs + " tabs, states " +
    JSON.stringify([...new Set(t2.seen)]) +
    ", missing " + JSON.stringify(t2.missing) + ")");
  check(!t2n.where && t2n.footWhere && t2.last === "play",
    "T2 · …Where left the list for the foot and #play is the last thing in it" +
    " (in list " + t2n.where + ", in foot " + t2n.footWhere +
    ", last " + JSON.stringify(t2.last) + ")");
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
     where, and holds that it is still the same five-position spinner. */
  await p.evaluate(() => document.getElementById("playops").click());
  await p.waitForTimeout(300);
  const t3 = await p.evaluate(() => {
    const box = document.querySelector(".nu-trayopts");
    const has = (id) => !!document.getElementById(id);
    const tap = [...document.querySelectorAll(".nu-traylist button")]
      .map((n) => +n.getBoundingClientRect().height.toFixed(1));
    return { open: !!(box && !box.hidden),
             expanded: document.getElementById("playops").getAttribute("aria-expanded"),
             inFoot: !!document.querySelector(".nu-trayfoot .nu-trayopts"),
             opts: [...(box ? box.children : [])]
               .map((n) => n.id || n.className).filter((x) => x),
             foot: !!document.querySelector(".nu-trayfoot #play"),
             five: ["play", "rewrite", "take", "voicing", "vol"].filter(has),
             reading: (document.getElementById("reading") || {}).textContent,
             minTap: tap.length ? Math.min(...tap) : 0,
             trayW: +document.querySelector(".nu-tray").getBoundingClientRect().width.toFixed(1),
             trayVar: (() => { const d = document.createElement("div");
               d.style.cssText = "position:absolute;left:-9999px;top:0;block-size:1px;" +
                 "inline-size:var(--tray-w);box-sizing:border-box";
               document.body.appendChild(d);
               const w = +d.getBoundingClientRect().width.toFixed(1);
               d.remove(); return w; })() };
  });
  check(t3.open && t3.expanded === "true" && t3.inFoot,
    "T3 · pressing #playops unfolds the play options inside the foot and the " +
    "door says so (" + JSON.stringify({ open: t3.open, expanded: t3.expanded,
                                        inFoot: t3.inFoot }) + ")");
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
  /* T3c — THE VOICING STANDS DIRECTLY ABOVE PLAY/STOP, on the artifact and in
     two ways that cannot both be a coincidence: DOM order (it is #play's
     immediately preceding sibling, in the same foot) and GEOMETRY (its bottom
     edge is the play mark's top edge). Both, because the first is what a
     screen reader walks and the second is what a thumb reaches — this gutter
     has been rearranged five times and the thing that keeps breaking is one
     of those two agreeing with the ask while the other does not.
     AND IT IS STILL THE SPINNER. Five positions cycled with a real pointer
     press at the mark's OWN RECT (never `page.click`, which scrolls its target
     into view and manufactures jumps — the harness law), reading the word the
     control paints on itself, and it must come back round to where it began:
     a control that moved house and lost a mode would pass every check above. */
  const t3c = await p.evaluate(() => {
    const v = document.getElementById("voicing"), pl = document.getElementById("play");
    const box = document.querySelector(".nu-trayopts");
    if (!v || !pl) return { missing: true };
    const vr = v.getBoundingClientRect(), pr = pl.getBoundingClientRect();
    return { inFoot: !!v.closest(".nu-trayfoot"),
             inFold: !!(box && box.contains(v)),
             nextIsPlay: v.nextElementSibling === pl,
             sameParent: v.parentElement === pl.parentElement,
             abuts: Math.abs(vr.bottom - pr.top) <= 1,
             above: vr.bottom <= pr.top + 1,
             tall: +vr.height.toFixed(1),
             word: (v.querySelector(".nu-vh") || {}).textContent,
             aria: v.getAttribute("aria-label") };
  });
  check(t3c.inFoot && !t3c.inFold && t3c.nextIsPlay && t3c.sameParent &&
        t3c.above && t3c.abuts,
    "T3c · #voicing is out of the fold and stands directly above #play — the " +
    "next sibling in the same foot, its bottom edge on the play mark's top " +
    "(" + JSON.stringify(t3c) + ")");
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
     not move the stripe and the door must not touch the record. It read the
     `play` LEVEL through `__eightTray().level`; the level is gone (see T3
     above) and the fold is what carries the claim, so the reading is
     `aria-expanded` and the shape of the tree, both of which are on the page.
     STRONGER THAN IT WAS, in one way worth naming: it now also asserts that
     pressing play does not change WHICH BRANCHES ARE OPEN, which is a thing a
     tree can newly get wrong and a single level could not. */
  const t3b = await p.evaluate(async () => {
    const shape = () => JSON.stringify(window.__eightTray().items);
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
             boxShut: !!document.querySelector(".nu-trayopts[hidden]") };
  });
  check(t3b.afterStart.shape === t3b.before && t3b.afterStop.shape === t3b.before
        && t3b.afterStart.open === "true" && t3b.afterStop.open === "true"
        && t3b.afterStart.word === "stop" && t3b.afterStop.word === "play",
    "T3 · …and the transport does not move the stripe: play then stop leave " +
    "the tree and the door exactly as they were, while the mark reads " +
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
     which is the check the move belongs to. */
  check(t3.five.length === 5 && t3.foot === true,
    "T3 · …and the transport's controls are on the page — #play in the " +
    "FOOT: " + JSON.stringify(t3.five));
  /* `t3.trayW === 56` STOOD HERE AND IT WAS THE LITERAL, NOT THE TOKEN. Paul,
     2026-09-02: *"it should be bigger with bigger type"* — `--tray-w` is
     `clamp(72px, 24vw, 136px)` now, so a number typed here would have to be
     re-typed at every width this file measures at. What the check was ever
     about is that the stripe IS the token, which is shell A7's own probe (an
     off-screen `box-sizing: border-box` div whose inline-size is
     `var(--tray-w)`), asked here so the two files cannot drift. The 44px tap
     floor is untouched and is the half of this that a bigger column could
     newly break by giving a mark a third line. */
  check(t3.minTap >= 44 && Math.abs(t3.trayW - t3.trayVar) <= 0.5,
    "T3 · …every mark in it is a thumb (" + t3.minTap + " CSS px) inside a " +
    "gutter that IS --tray-w (" + t3.trayW + " / " + t3.trayVar + ")");

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
  /* ...AND THE DOOR IS A TOGGLE, SO IT IS OPENED IDEMPOTENTLY (2026-09-02).
     The play options were a LEVEL, and `__eightTab` above reset the level on
     every step of the deepest-tab walk — so an unconditional click always
     re-entered it. They are a FOLD in the foot now and a fold survives a tab
     change, which is the point of it; an unconditional click would therefore
     CLOSE the fold this check needs open. The gate asks the page whether it is
     open, exactly as a hand would look. */
  await p.evaluate(() => { const box = document.querySelector(".nu-trayopts");
    if (box && box.hidden) document.getElementById("playops").click(); });
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

  /* ---- T9 THE DIE IS PERMANENT, IN THE FOOT, ABOVE THE ? -------------- */
  /* Paul, 2026-08-30: *"Move the die icon to right above the question mark so
     it's always there."*

     THREE CLAIMS AND THEY ARE THREE DIFFERENT KINDS OF FACT, so they are
     three checks: WHERE it stands (the foot's own order, read off the
     rendered children), that it stands there AT EVERY LEVEL (the walk T2
     makes for #play, made again for this mark — "permanent" is a claim about
     every level and a check at the root would pass on a button that vanished
     the moment you opened the Band), and that it STILL DOES ITS JOB (the
     reading moves and the record starts, which is the whole gesture; a mark
     that moved house and lost its listener is exactly the bug a geometry
     check cannot see).
     AND THE PLAY LEVEL LOST IT, which is the other half of "a mark cannot be
     in two places" — asserted as an ABSENCE from `__eightTray().items`
     alongside the presence of the new mode mark, because two #rewrites would
     be two owners of one gesture. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(150);
  /* THE FOOT IS SIX MARKS NOW AND THE ORDER IS THE ARGUMENT (2026-09-02).
     Paul: *"Move the play/stop button to the bottom, along with opts and
     where."* It read "the die is in the FOOT, directly above the ? and the
     log" — three marks, two of them readouts — and it still is; what joined
     them is the record's NAME above it (*"The name of the genre should be
     obvious"*) and the transport below it. Reading down: the countdown, the
     name, the seed, the ?, the log, the play options when they are unfolded,
     the door, and play at the floor. Asserted as an ORDER rather than as
     three indices, because there are six of them and an index arithmetic that
     grows with the row is the thing that breaks silently.
     …AND FIVE, LATER THE SAME DAY: Paul, *"Get rid of explain — that's the
     genre editor's work now."* The `explain` step comes out of the list and
     nothing takes its place — the order is the argument and the argument did
     not change, it got one clause shorter. Because this is an ORDER and not
     an index arithmetic, that is a one-word edit, which is what the paragraph
     above was promising. */
  const t9 = await p.evaluate(() => {
    const foot = document.querySelector(".nu-trayfoot");
    const kids = [...foot.children].map((n) =>
      n.id || n.dataset.k || n.className || n.tagName.toLowerCase());
    const at = (k) => kids.indexOf(k);
    const order = ["toptab-Where", "rewrite", "logger",
                   "nu-trayopts", "playops", "play"].map(at);
    return { kids, order, gone: kids.indexOf("explain"),
             die: at("rewrite"), log: at("logger"),
             inList: !!document.querySelector(".nu-traylist #rewrite"),
             tap: +document.getElementById("rewrite")
                    .getBoundingClientRect().height.toFixed(1),
             reading: !!document.querySelector("#rewrite #reading") };
  });
  check(t9.order.every((n, i) => n >= 0 && (i === 0 || n > t9.order[i - 1]))
        && !t9.inList && t9.gone < 0,
    "T9 · the foot reads where · seed · log · [opts] · opts · play, in " +
    "that order, with no ? anywhere in it, and the die is not in the list — " +
    JSON.stringify(t9.kids));
  check(t9.tap >= 44 && t9.reading,
    "T9 · …still a thumb (" + t9.tap + " px) and still carrying #reading");
  /* AT EVERY LEVEL. The same walk T2 makes for #play — the nine tabs pressed,
     which is what puts the stripe on each of its sub-levels — plus the play
     level, which no tab reaches. */
  const t9b = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const missing = [], seen = [];
    for (const name of window.__eightTabs()) {
      window.__eightTab(name); await wait(60);
      const lvl = window.__eightTray().level;
      seen.push(lvl);
      if (!document.querySelector(".nu-trayfoot #rewrite")) missing.push(lvl);
      window.__eightUp(); await wait(30);
    }
    document.getElementById("playops").click(); await wait(120);
    const play = window.__eightTray();
    if (!document.querySelector(".nu-trayfoot #rewrite")) missing.push("play");
    const inFold = [...document.querySelectorAll(".nu-trayopts *")]
      .map((n) => n.id).filter((x) => x);
    document.getElementById("playops").click(); await wait(80);
    return { missing, seen: [...new Set(seen)], items: play.items, inFold };
  });
  check(!t9b.missing.length,
    "T9 · …in the foot at every state the tabs reach and with the play " +
    "options unfolded (" + JSON.stringify(t9b.seen) + ", missing " +
    JSON.stringify(t9b.missing) + ")");
  /* `items.indexOf("tp.rewrite") < 0 && items.indexOf("tp.mode") === 0` STOOD
     HERE and both halves were about a LEVEL's item list. The play group is a
     fold in the foot (T3), so the same two claims are read off the fold's own
     children: the die is not in it — "a mark cannot be in two places", the
     2026-08-30 law, unchanged — and the MODE is first, which is the 2026-08-30
     argument for the order ("it is the only one of the four that says what
     pressing ▶ will DO"). */
  check(t9b.inFold.indexOf("rewrite") < 0 && t9b.inFold[0] === "playmode",
    "T9 · …and the fold LOST the die — a mark cannot be in two places, and " +
    "the mode is still first: " + JSON.stringify(t9b.inFold));
  /* AND IT STILL RESEEDS. The press is the whole gesture: the seed moves, the
     digit on the button moves with it (Paul, 2026-08-27: "I clicked rewrite
     multiple times and never saw a different seed"), and the record starts,
     because #rewrite has gone through `startNow` since the day it landed. */
  /* AND THE PRESS IS TWO PRESSES NOW (2026-09-02). Paul: *"When I click seed
     pop up a vertical slider from zero to 2^16."* The die OPENS the flyout;
     the roll is inside it, under the word "roll", and it calls `rewriteNow` —
     the same function `album` calls, which is still the one reseed path this
     box has. Everything this check asserts is unchanged: the seed moves, the
     digit on the mark moves with it, the accessible name carries the number,
     and the record starts (#rewrite has gone through `startNow` since the day
     it landed). */
  const t9c = await p.evaluate(async () => {
    const rd = () => document.getElementById("reading").textContent;
    const was = rd();
    document.getElementById("rewrite").click();       // the flyout
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector('[data-k="seed-roll"]').click();
    await new Promise((r) => setTimeout(r, 700));
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
    "T9 · …and it still reseeds through the flyout's roll: reading " +
    t9c.was + " -> " + t9c.now + ", and the name says it too (" +
    JSON.stringify(t9c.name) + ")");

  /* ---- T10 EVERY MARK WEARS ITS WORD, AND THE COLUMN IS MEASURED ------ */
  /* Paul, 2026-08-30: *"Label all the icons with tiny short labels
     underneath."*

     THE LABEL IS THE `.nu-vh` SPAN UNHIDDEN — one string, from the table that
     owns the name, in the `aria-label` and on the screen (ui/glyph.js
     `paintIcon` has put it in every mark since the marks landed). So the
     check is not "there is some text": it is that the VISIBLE word is the
     ACCESSIBLE name, mark by mark, which is what makes it an extraction and
     not a second dictionary. Two marks are exempt by construction and named
     rather than skipped: `#playops`, whose face IS its word ("opts", no
     glyph, nothing to reveal), and the room fader, which is not a button —
     its word is asserted separately, off the <input>'s own `aria-label`.

     AND NOTHING IS CLIPPED. `.nu-traylist` is `overflow-x: hidden`, so a
     label wider than its 47px mark would be trimmed in silence — which is the
     bug this round measured and fixed (performance 62.4px, instrument 54.0,
     backwards 52.5, all before `min-inline-size: 0`). Every label's box is
     asserted INSIDE its button's box. */
  const t10 = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const bad = [], wide = [], small = [];
    const sweep = () => {
      for (const b of document.querySelectorAll("#nu-tray button")) {
        /* ON THE PAGE, OR NOT MEASURED (2026-09-02) — shell.js's own `shown()`
           rule, borrowed here for the reason it was written there: "that is not
           a finding, it is the gate measuring furniture in another room". The
           play options are seated in the foot permanently now and FOLDED away
           when the door is shut (Paul: *"Move the play/stop button to the
           bottom, along with opts and where"*), so three controls that are in
           the DOM at every moment are laid out only when a hand has opened
           them — and a `display: none` control is 0x0 and has no label box.
           The sweep opens the fold below and measures them there, which is
           where a thumb meets them. */
        if (!b.getClientRects().length) continue;
        const v = b.querySelector(".nu-vh");
        const k = b.id || b.dataset.k || "?";
        /* `#playops` WAS EXEMPT BY ID BECAUSE ITS FACE WAS ITS WORD, and it is
           not any more (2026-09-02): `GLYPH.act.opts` gave it the ⚙ nu.css had
           been carrying the debt for, so it is spelled like every other mark
           and is measured like one. The exemption is gone rather than kept. */
        if (!v) { bad.push([k, "no label"]); continue; }
        const r = v.getBoundingClientRect(), br = b.getBoundingClientRect();
        const name = (b.getAttribute("aria-label") || "").trim();
        if (!r.width || !r.height) bad.push([k, "label not drawn"]);
        /* ...AND `#rewrite` IS THE ONE MARK WHOSE WORD IS NOT ITS NAME, BY
           DESIGN AND WITH A REASON (2026-09-02). Paul asked for a seed slider
           on this button; its SUBJECT is the seed and the word an eye reads
           under the die is "seed", while its accessible NAME stays
           `"rewrite " + n` — which is what a screen reader is told the press
           will do, carries the number, and is what eleven gates and
           test/motif-frozen.js call this control by (T9c below asserts exactly
           that string). One node, two honest names. Every OTHER mark in the
           gutter is still an extraction and is still checked as one. */
        // the name may carry a number or a refusal's reason; the WORD is its head
        else if (b.id !== "rewrite" && name !== v.textContent.trim() &&
                 name.indexOf(v.textContent.trim()) !== 0)
          bad.push([k, v.textContent + " vs " + name]);
        /* BOTH AXES. Sideways is where the gutter clips (`.nu-traylist` is
           `overflow-x: hidden`); DOWNWARD is where a flex column clips, and
           it did: a three-line label on an overflowing level was squeezed
           into a 44px mark by the default `flex-shrink: 1` while the box
           still reported the tap floor (nu.css `.nu-traylist > *`). A check
           that only measured width would have passed on that. */
        if (r.left < br.left - 0.5 || r.right > br.right + 0.5 ||
            r.top < br.top - 0.5 || r.bottom > br.bottom + 0.5)
          wide.push([k, v.textContent, +r.width.toFixed(1),
                     +br.width.toFixed(1), +r.height.toFixed(1),
                     +br.height.toFixed(1)]);
        if (br.height < 44) small.push([k, +br.height.toFixed(1)]);
      }
    };
    sweep();
    for (const name of window.__eightTabs()) {
      window.__eightTab(name); await wait(60); sweep(); window.__eightUp();
      await wait(30);
    }
    { const box = document.querySelector(".nu-trayopts");
      if (box && box.hidden) document.getElementById("playops").click(); }
    await wait(120); sweep();
    const room = document.querySelector(".nu-trayvol .nu-vh");
    const out = { bad, wide, small,
      room: room ? room.textContent : null,
      roomName: document.getElementById("vol").getAttribute("aria-label"),
      mode: (document.querySelector("#playmode .nu-vh") || {}).textContent };
    { const box = document.querySelector(".nu-trayopts");
      if (box && !box.hidden) document.getElementById("playops").click(); }
    await wait(80);
    return out;
  });
  check(!t10.bad.length,
    "T10 · every mark in the gutter — head, list and foot — wears its own " +
    "word, and the word IS the accessible name " + JSON.stringify(t10.bad));
  check(!t10.wide.length,
    "T10 · …and no label is clipped: every one is inside its mark's box " +
    JSON.stringify(t10.wide));
  check(!t10.small.length,
    "T10 · …and the 44px tap floor survived the labels " +
    JSON.stringify(t10.small));
  check(t10.room === t10.roomName && t10.room === "room",
    "T10 · the room fader is labelled off its own control's aria-label (" +
    JSON.stringify(t10.room) + " / " + JSON.stringify(t10.roomName) + ")");

  /* T10b — THE ARITHMETIC, AT BOTH PHONES, AND IT IS REPORTED RATHER THAN
     WISHED. The ask was "every level fits at 320x568 with no list scroll".
     IT DOES NOT, IT DID NOT BEFORE THIS ROUND, AND NO TYPE SIZE CAN MAKE IT:
     measured on the SHIPPED page the morning of 2026-08-30 at 320x568, the
     root was 441px of marks against a 360px list (over by 81), the fourteen
     motif operations 689 against 303 (over by 386), the tempo level 391 and
     the band level 342 against the same 303. Nine 44px targets are 396px
     before a single gap — the TAP FLOOR is the binding constraint, not the
     words. What this round adds on top of that is 0 to 14px a level for the
     labels and 44px of LIST for the die, which is a mark in the foot now:
     after, at the same width, root 441/316, tempo 405/259, motifops 703/259.
     nu.css THE MARKS WEAR THEIR WORDS carries the whole table and the three
     things that could give if Paul wants the scroll back.

     SO THIS CHECK ASSERTS THE TWO THINGS THAT CAN HONESTLY BE ASSERTED:
       · at 390x844 — the phone this box is drawn for — every level fits
         except the fourteen motif operations, which is the one level that has
         never fitted anywhere;
       · at 320x568 every mark is REACHABLE: the list is a scroller, and after
         scrolling it to the end the last mark of the longest level is inside
         the list's own box. Nothing is silently clipped, which is the law;
         "nothing scrolls" was never a law and is not one now
         (`.nu-traylist`'s standing promise: "it scrolls if a future level
         does not fit").
     The numbers are PRINTED either way, so the next round can see what the
     gutter costs without re-measuring it. */
  const levelsAt = async () => p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const list = () => document.querySelector(".nu-traylist");
    const out = [];
    const take = () => { const L = window.__eightTray(), l = list();
      out.push({ level: L.level, n: L.items.length,
                 h: +l.clientHeight.toFixed(0), want: +l.scrollHeight.toFixed(0) }); };
    take();
    for (const name of window.__eightTabs()) {
      window.__eightTab(name); await wait(60); take(); window.__eightUp();
      await wait(30);
    }
    { const box = document.querySelector(".nu-trayopts");
      if (box && box.hidden) document.getElementById("playops").click(); }
    await wait(120); take();
    { const box = document.querySelector(".nu-trayopts");
      if (box && !box.hidden) document.getElementById("playops").click(); }
    await wait(60);
    const seen = {}; const uniq = [];
    for (const r of out) if (!seen[r.level]) { seen[r.level] = 1; uniq.push(r); }
    return uniq;
  });
  /* T10b — WHAT THE TREE COSTS, MEASURED AND REPORTED (2026-09-02).
     It read `over.length === 1 && over[0].level === "motifops"`: at 390x844
     exactly ONE level might overflow the list, and it had to be the fourteen
     motif transforms. That was an exact claim about a stripe that drew ONE
     level; a tree draws twelve tab rows plus every open branch, so overflow is
     the ORDINARY state and "one level overflows" stopped being a fact about
     the design the moment Paul asked for nesting.
     WHAT REPLACES IT IS THE CLAIM THAT STILL MEANS SOMETHING, and it is the
     one T10c has always made at the other width: the list is a SCROLLER and
     nothing is clipped in silence. So this asserts the ROOT — the twelve tabs
     with nothing expanded — still fits at the phone this box is drawn for,
     which is the state a reader arrives in and the one number a bigger column
     could newly have broken. Everything else is measured and PRINTED, so the
     next round can see what the tree costs without re-measuring it. */
  await p.evaluate(() => window.__eightUp());
  await p.waitForTimeout(200);
  const t10b = await levelsAt();
  const reach390 = await p.evaluate(async () => {
    const l = document.querySelector(".nu-traylist");
    l.scrollTop = l.scrollHeight;
    await new Promise((r) => setTimeout(r, 120));
    const last = l.querySelector("button:last-of-type");
    const lr = last.getBoundingClientRect(), br = l.getBoundingClientRect();
    return { k: last.dataset.k, inside: lr.bottom <= br.bottom + 1,
             sideways: document.documentElement.scrollWidth -
                       document.documentElement.clientWidth };
  });
  check(reach390.inside && reach390.sideways === 0,
    "T10 · at 390x844 the list SCROLLS and the last mark of the tree (" +
    reach390.k + ") is reachable, and nothing goes sideways. What the tree " +
    "costs, measured: " + JSON.stringify(t10b.map((r) =>
      r.level + " " + r.want + "/" + r.h)));
  await p.setViewportSize({ width: 320, height: 568 });
  await p.waitForTimeout(400);
  const t10c = await levelsAt();
  const reach = await p.evaluate(async () => {
    /* THE LONGEST STATE THE TREE HAS, MADE BY HAND: the Motif tab, whose
       arrival opens the bank AND the open cell's fourteen transforms. It was
       `__eightTab("Motif")` alone while that was a LEVEL; on a tree the tab
       unfolds the bank and the cell has to be opened for the transforms, which
       is the same two facts the old `motifops` level carried in one word. */
    window.__eightTab("Motif");
    await new Promise((r) => setTimeout(r, 200));
    const cell = document.querySelector('.nu-traylist [data-k^="motiftab-"]');
    if (cell) { cell.click(); await new Promise((r) => setTimeout(r, 200)); }
    const l = document.querySelector(".nu-traylist");
    l.scrollTop = l.scrollHeight;
    await new Promise((r) => setTimeout(r, 120));
    const last = l.querySelector("button:last-of-type");
    const lr = last.getBoundingClientRect(), br = l.getBoundingClientRect();
    return { level: window.__eightTray().level,
             k: last.dataset.k, inside: lr.bottom <= br.bottom + 1,
             scrolled: l.scrollTop > 0,
             sideways: document.documentElement.scrollWidth -
                       document.documentElement.clientWidth };
  });
  await p.evaluate(() => window.__eightUp());
  check(reach.inside && reach.scrolled && reach.sideways === 0,
    "T10 · at 320x568 the list SCROLLS and every mark is reachable — the " +
    "last of the " + reach.level + " level (" + reach.k + ") is inside the " +
    "list after scrolling, and nothing goes sideways. The column, measured: " +
    JSON.stringify(t10c.map((r) => r.level + " " + r.want + "/" + r.h)));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(400);

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
  const t8gone = await p.evaluate(() => ({
    mark: !!document.querySelector('#nu-tray [data-k="explain"]'),
    byId: !!document.getElementById("explain"),
    panel: !!document.getElementById("nu-explain"),
    rules: !!document.querySelector('.nu-traylist [data-k="toptab-Rules"]'),
    log: !!document.querySelector('#nu-tray .nu-trayfoot [data-k="logger"]') }));
  check(!t8gone.mark && !t8gone.byId && !t8gone.panel,
    "T8 · the ? mark and its panel are GONE from the rendered page — " +
    JSON.stringify(t8gone));
  check(t8gone.rules && t8gone.log,
    "T8 · …with the genre editor a root nav row in its place and the log " +
    "still in the foot where it stood — the explainer moved house, the " +
    "readout did not");


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
    const tap = async (k) => {
      const b = document.querySelector('#nu-tray [data-k="' + k + '"]');
      if (!b || b.disabled) return false;
      b.click(); await wait(120); return true;
    };
    /* THE SECTIONS ARE `Structure`'s NOW (2026-09-02). Paul: *"It should be
       top level, not buried under band, and below band."* This walked
       Band → `tabform` → the sections; the tab IS the sections, so the
       `tabform` hop is gone and the tab's own arrival unfolds them. */
    /* DOWN TO ONE SECTION, AND THE BOUND IS A SAFETY RAIL RATHER THAN A
       COUNT (2026-09-02). It read `i < 8`, which was the record this file was
       measured against — "5 sections / 36 bars / 149.1 s" in the paragraph
       above — and the record T7 leaves behind carries THIRTEEN now, so eight
       taps left five sections standing and the check under this loop read
       "5 section, 28 bars, 15.29 s" and went red for the arithmetic rather
       than for anything the gutter does. The loop's own exit is the honest
       one — it stops when there is one section left — and the number here only
       has to be larger than any record the composer deals. */
    for (let i = 0; i < 32; i++) {                   // down to one section
      window.__eightTab("Structure"); await wait(120);
      const secs = [...document.querySelectorAll("#nu-tray .nu-traylist button")]
        .filter((b) => /^secnav/.test(b.dataset.k || ""));
      if (secs.length <= 1) break;
      secs[secs.length - 1].click(); await wait(150);
      if (!await tap("secdrop")) break;
    }
    /* AND THE EIGHT TEMPO OPERATIONS ARE IN THE PANEL (2026-09-02). Paul: *"The
       left nav elements for tweaking tempo should be brought inside tempo."*
       Same `data-k`, same eight verbs, same refusals — a `#nu-tray` scope is
       what changed, so this taps the panel instead. */
    const tapPanel = async (k) => {
      const b = document.querySelector('#pan-tempo [data-k="' + k + '"]');
      if (!b || b.disabled) return false;
      b.click(); await wait(120); return true;
    };
    window.__eightTab("Tempo"); await wait(150);     // and as fast as it counts
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
  await p.evaluate(() => { window.__eightUp();
                           document.getElementById("playops").click(); });
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
