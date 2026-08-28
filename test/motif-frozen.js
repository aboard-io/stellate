#!/usr/bin/env node
// test/motif-frozen.js — THE FROZEN-INTERFACE GATE.
//
// Paul, 2026-08-24, and it is the whole reason this file exists:
//
//   "When playing -- Don't change motifs visually or change the editing
//    interface. It's too confusing when it changes. Instead, show the fully
//    composed motif ABOVE the editable version of the motif."
//
// So there are two claims to prove, and one of them is a NEGATIVE — the hard
// kind. THE EDITABLE HALF OF #app DOES NOT CHANGE when the transport starts,
// when a section boundary goes past, or when the transport stops; and the
// composed half DOES, or the page has simply frozen and passes by doing
// nothing.
//
// TEST THE ARTIFACT (three features have shipped broken in this repo while
// every check passed): nothing here reads ui/eight.js. Every assertion is a
// string taken off the RENDERED page in a real browser, at 390px and at
// 1400px, because the 1516 ms rebuild that started this round only showed up
// on the wide viewport.
//
// THE EXCLUSION IS THE PAGE'S OWN, NOT THIS FILE'S. `window.__eightFrozen()`
// clones #app and calls `replaceChildren()` on every `[data-live]` — a DOM
// operation over a set only the builders can join. This gate cannot invent a
// permission for a surface that misbehaves; it can only ask what eight.js
// declared. A1 closes the smuggling hole: nothing inside a [data-live] may be
// an editing control, or "put it in a data-live" becomes a way past A3.
//
// A1  no input/select/textarea/button/fieldset inside any [data-live]
// A2  the LIVE SURFACE exists WHILE STOPPED and is captioned — nothing that
//     the clock writes on may be conditional on `playing`, because a block
//     that appears on play is the editing interface changing, which is the
//     complaint itself. REWRITTEN 2026-08-26, and the page was right: this
//     used to read "both staves per measure exist while stopped" and count
//     `#staff [data-live="played"] > p > div` against `#staff > p > div`. That
//     was a transcript of a layout Paul reversed the next morning — "you don't
//     need to show me the interpreted notation for a motif, only the pure
//     representation, because now I have the sheet music" — so the composed
//     staff per motif was deleted (ui/eight.js's own header says so, and
//     `__eightCaptions` was rewritten with a note explaining what it reads
//     now). The PROMISE is unchanged and is the only thing A2 ever meant, so
//     it is now asserted against whatever the page DECLARES live, the way the
//     rest of this file already works: one staff per motif is the new truth
//     and is asserted as such.
// A3  the frozen half is byte-identical across play + two section boundaries
// A4  ...and the live half moved: at least one composed caption changed. An
//     independent second proof that a boundary happened, and it fails a "fix"
//     that froze the composed staff along with everything else.
// A5  nothing inside #app moved RELATIVE TO #app — the first fieldset, which
//     is above the staves, and the band axis, which is below them and is the
//     one that a composed staff changing height would push. Measured against
//     #app and not against the document on purpose: pressing play makes the
//     engine readout appear (0 -> 18px, so #app itself drops 34px), and that
//     readout is OUTSIDE #app, is D1's whole point, and happens on your press
//     rather than on the clock. It is named here rather than asserted away —
//     the fix is a line reserve in the shell, which this gate does not own.
// A6  abcjs was asked to draw at most once per line voice per boundary — the
//     change detector in repaintPlayed() works
// A7  no longtask >= 100 ms AT A SECTION BOUNDARY, and none at all after the
//     engine has started. Measured before this round: 409/436 ms at 390px and
//     419/1516 ms at 1400px, every one of them a draw() on the clock. Measured
//     after: two tasks, 170 ms at +215 ms and 119 ms at +1045 ms, both inside
//     the first second of the press and neither anywhere near a boundary —
//     that is audio/live.js building the plan and starting the worklet, which
//     is your gesture and not the clock. So the window before START_QUIET is
//     printed and allowed, and everything after it must be silent.
// A8  stopping does not rebuild either — C === A, the second draw() that used
//     to hang off `transport:state`
// A9  ...AND THE SAME LAW ACROSS THE NINE TABS (2026-08-27). Paul: *"Why don't
//     we make tabs at the top level and let go of the idea of scrolling
//     everything? The tabs are: Where / Tempo / Key / Motif / Band / Mix /
//     Produce / Score / Export."* A3 asks whether the CLOCK writes on the
//     editing interface; A9 asks whether MOVING BETWEEN TABS while the record
//     plays does — thirty seconds of playback across three tab switches, back
//     to the tab you started on, and the frozen half byte-identical.
//
//     WHY IT COMES BACK TO THE SAME TAB BEFORE IT LOOKS. `__eightFrozen`
//     snapshots `#app`, which holds the four axis panels — Tempo, Key, Motif,
//     Band — and switching between them writes `data-off` and `inert` on two
//     of them, which is the SHELL'S state and not the record's. Comparing
//     across a switch would therefore be comparing two different, correct
//     pages. Compared at the same tab, with all four panels warmed before the
//     baseline so none of them is rebuilt during the walk, the snapshot covers
//     ALL FOUR PANELS AT ONCE — so a clock that wrote into the Band panel
//     while the walk was standing on it fails this check from the Motif tab,
//     which is the strongest form of the claim available.
//
//     AND PLAYBACK IS NOT INTERRUPTED: the step is read before and after and
//     must have advanced, and the transport must still say `stop`. A tab that
//     stopped the record would pass a frozen-DOM check by silence.
//
// Run:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/motif-frozen.js
// A bare chromium.launch() resolves a shell build that is not installed here,
// so the executable is explicit and checked before use; and the page needs
// cross-origin isolation for SharedArrayBuffer, which is what serve.sh gives.

const fs = require("fs");
const path = require("path");

const URL = process.env.MOTIF_URL || "http://localhost:8777/nukernel/index.html";
const WIDTHS = [390, 1400];
const HEIGHT = 844;
const SETTLE = 4000;            // abcjs engraves on a promise; the page grows late
// HOW LONG THE ENGINE IS ALLOWED TO BE BUSY AFTER THE PRESS. The two long
// tasks measured on 2026-08-24 land at +215 ms and +1045 ms and are the audio
// starting, not the page redrawing; the first section boundary landed at
// +22.5 s. Three seconds separates the two by an order of magnitude.
const START_QUIET = 3000;

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
  throw new Error("no installed chromium under " + root);
}

let FAILS = 0;
const ok = (m) => console.log("  ok   " + m);
/* WHAT THE PLAY BUTTON SAYS, AND IT IS ITS NAME AND NOT ITS TEXT (rewritten
   2026-08-28). Five places in this file read
   `document.getElementById("play").textContent` and compared it to "play" or
   "stop". That was exact for as long as the button WAS its word — and it
   stopped being one on 2026-08-28, when Paul asked for marks: *"Please make
   all the tabs and top buttons into sensible icons to save space."* The button
   is `<button><span class="nu-ic"><span class="nu-g">■</span><span
   class="nu-vh">stop</span></span></button>` now, so its `textContent` is
   "■stop" and every one of those five comparisons was false forever: A2 said
   the transport was already running on a page that had not been touched, and
   A9 said the record would not start again while it was audibly playing.

   THE LAW THAT SETTLES WHAT TO READ INSTEAD is the button's own (ui/glyph.js):
   "every button that carries a mark also carries its full word in `aria-label`
   and in a `.nu-vh` span", and the word on this one is still "the NEXT tap".
   The ACCESSIBLE NAME is what a person is told the button says, so it is what
   a gate asking "what does the button say" must read — and it is the string
   this file was always comparing against, unchanged: "play" or "stop".
   `aria-label` first, the `.nu-vh` word second, `textContent` last, because
   the last is what a page with no marks at all would still answer. */
const PLAYWORD = () => {
  const b = document.getElementById("play");
  if (!b) return "";
  const a = (b.getAttribute("aria-label") || "").trim();
  if (a) return a;
  const v = b.querySelector(".nu-vh");
  return ((v ? v.textContent : b.textContent) || "").trim();
};

const fail = (m) => { FAILS++; console.log("  FAIL " + m); };
const is = (cond, m) => (cond ? ok(m) : fail(m));

// WHERE TWO STRINGS PART, said as the ELEMENT and not as an offset. A diff
// that prints "character 41,203" names the file; a diff that prints the two
// hundred characters around it names the thing that moved, which is what
// somebody reading a red gate actually needs.
function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 90);
  return "at char " + i + " of " + a.length + "/" + b.length +
    "\n        before: …" + a.slice(from, i + 110).replace(/\n/g, " ") +
    "\n        after : …" + b.slice(from, i + 110).replace(/\n/g, " ");
}

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: executable(),
    args: ["--autoplay-policy=no-user-gesture-required"] });
  console.log("motif-frozen gate · " + URL);

  for (const width of WIDTHS) {
    console.log("[" + width + "]");
    const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(SETTLE);
    /* ---- WARM EVERY TAB, THEN STAND ON `Motif` (2026-08-27) --------------
       Paul: *"Why don't we make tabs at the top level and let go of the idea
       of scrolling everything?"* Two consequences for this file, and neither
       of them is a change to what it claims.

       ONE: a panel is not built until it is first opened (ui/eight.js
       `buildTab`, the mount-on-demand law), so the whole of the walk below is
       warmed here — the frozen half must exist before it can be frozen, and a
       panel built DURING the walk would be a legitimate rebuild that A3 and A9
       would read as a violation. `Score` is warmed too: `__eightCaptions` and
       A4's whole proof are the deck's caption, and the deck is a tab.

       TWO: the gate then stands on `Motif`, because "the editable half" is
       what this file is about and the motifs are its sharpest case — the
       staves A2 counts and the bench A3's bytes are made of.

       A SHUT PANEL IS STILL IN `#app` AND IS STILL FROZEN. `__eightFrozen`
       snapshots the whole of #app, so all four axis panels are inside every
       string below, whichever one is on the screen. That is deliberate: it is
       what lets A9 prove the clock wrote nothing into the Band panel while the
       walk was standing on it. */
    const tabs = await page.evaluate(() => window.__eightTabs && window.__eightTabs());
    if (!tabs || !tabs.length) { fail(width + " · the page has no __eightTabs probe"); break; }
    for (const t of tabs) {
      await page.evaluate((tt) => window.__eightTab(tt), t);
      await page.waitForTimeout(t === "Score" ? 1500 : 350);
    }
    await page.evaluate(() => window.__eightTab("Motif"));
    await page.waitForTimeout(800);

    // ---- the page has to have the probes, or nothing below means anything
    const probed = await page.evaluate(() => !!(window.__eightFrozen &&
      window.__eightEngraves && window.__eightSec && window.__eightCaptions));
    if (!probed) { fail(width + " · the page has no __eightFrozen probe"); break; }

    // A1 — the excluded set contains no editing interface at all
    /* PAGE-WIDE SINCE 2026-08-27, WITH THE BOARD'S TWO VALUES NAMED AS THE
       EXCEPTION THEY ALWAYS WERE. This was `#app`-scoped, which was right for a
       page where every live block was in #app. Two of them are not any more:
       the score and the piano roll moved to the deck at the foot on 2026-08-27
       and then to the `Score` tab the same day, so the smuggling check — "put
       it in a data-live and it is a way past A3" — had a door in it.

       AND WIDENING IT FOUND A REAL DECLARATION RATHER THAN A DEFECT. The board
       declares `[data-live="meter"]` on its meters and `[data-live="trimrow"]`
       on the section grid, and ui/engineer.js says exactly why: "the board sits
       outside #app, where the transport feed is free to write, but a surface
       the clock writes on declares itself rather than relying on where it
       happens to be mounted." The trim grid is a table of BUTTONS whose ROW the
       clock marks once a beat; a control inside it is the design.

       So the exemption is BY DECLARED VALUE and not by address. `meter` and
       `trimrow` are the board's two and are named here; `count`, `score`,
       `roll` and any value a future round adds may hold no control at all, and
       a new value that does fails this line by existing rather than inheriting
       the board's permission because of where it was mounted. */
    const BOARD_LIVE = ["meter", "trimrow"];
    const smuggled = await page.evaluate((exempt) => [...document.querySelectorAll(
      "[data-live] input, [data-live] select, [data-live] textarea," +
      " [data-live] button, [data-live] fieldset")]
      .filter((e) => !exempt.includes(e.closest("[data-live]").dataset.live))
      .map((e) => e.tagName.toLowerCase() + (e.dataset.k ? "[" + e.dataset.k + "]" : "")),
      BOARD_LIVE);
    const declared = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll("[data-live]")]
        .map((e) => e.dataset.live))].sort());
    is(smuggled.length === 0,
      "A1 " + width + " · no control inside any [data-live] the page declares, " +
      "outside the board's own " + JSON.stringify(BOARD_LIVE) + " — the page " +
      "declares " + JSON.stringify(declared) + " (" + smuggled.join(", ") + ")");

    // A2 — the live surface exists WHILE STOPPED, and one staff per motif
    const shape = await page.evaluate(() => ({
      svgs: document.querySelectorAll("#staff svg").length,
      // WHATEVER THE PAGE DECLARES LIVE, not a value this file remembers.
      // ui/eight.js's header is explicit that the set of `data-live` values
      // moves — "played" existed for one day and is gone — and that the RULE
      // "never was a number". So the query is `[data-live]` minus the playhead
      // cells, which are counted separately because there are twenty-odd of
      // them in the form table and they are not blocks.
      /* AND THE LIVE BLOCKS ARE NO LONGER ALL IN #app (2026-08-27). This
         counted `#app [data-live]` and its own note already said the set
         moves — "a THIRD data-live value existed for one day … TWO remain".
         What it did not anticipate is one of the two LEAVING #app: `score`
         went to the deck at the foot and then to the Score tab, so this
         reading was 0 on a page whose live surface was fine, and A2 was about
         to fail for a reason that has nothing to do with what A2 claims.
         The claim — "nothing the clock writes on may be conditional on
         `playing`" — was never about an address. */
      lives: document.querySelectorAll('[data-live]:not([data-live="count"])').length,
      counts: document.querySelectorAll('[data-live="count"]').length,
      written: document.querySelectorAll("#staff > p > div").length,
      caps: window.__eightCaptions(),
      // the button's NAME, not its text — see PLAYWORD above
      playing: (() => { const b = document.getElementById("play"); if (!b) return ""; const a = (b.getAttribute("aria-label") || "").trim(); if (a) return a; const v = b.querySelector(".nu-vh"); return ((v ? v.textContent : b.textContent) || "").trim(); })(),
    }));
    console.log("     " + shape.svgs + " staves · " + shape.lives + " live blocks · " +
      shape.counts + " count cells · " + shape.written + " written measures");
    is(shape.playing === "play", "A2 " + width + " · the transport is stopped to start with");
    is(shape.lives > 0,
      "A2 " + width + " · the live surface is already there while STOPPED (" +
      shape.lives + " live blocks, " + shape.counts + " count cells) — a block " +
      "that appears on play is the interface changing");
    // ONE STAFF PER MOTIF, WHICH IS THE REVERSAL STATED AS A TRUTH. It was two
    // — the written measure and a composed staff over it — until Paul asked
    // for "only the pure representation, because now I have the sheet music".
    is(shape.written > 0 && shape.svgs === shape.written,
      "A2 " + width + " · ONE staff per written measure, not two (" + shape.svgs +
      " svgs, " + shape.written + " written measures)");
    is(shape.caps.length > 0 && shape.caps.every((c) => c && c.length > 3),
      "A2 " + width + " · every live block is captioned while STOPPED: " +
      JSON.stringify(shape.caps));

    // ---- the before picture, and the instruments
    const A = await page.evaluate(() => window.__eightFrozen());
    const before = await page.evaluate(() => {
      // the long tasks are collected from the moment play is pressed; the
      // buffer is installed first so nothing is missed in the gap
      window.__longs = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries())
        window.__longs.push({ d: Math.round(e.duration),
                              at: Math.round(e.startTime - window.__t0) }); })
        .observe({ entryTypes: ["longtask"] });
      window.__t0 = performance.now();
      // POSITIONS RELATIVE TO #app. See A5's note: the engine readout is
      // outside #app and appears on the press, which moves #app itself.
      const rel = (sel) => { const e = document.querySelector(sel);
        const a = document.getElementById("app");
        return e ? Math.round(e.getBoundingClientRect().top -
                              a.getBoundingClientRect().top) : -1; };
      return { caps: window.__eightCaptions(), eng: window.__eightEngraves(),
               si: window.__eightSec(), step: window.__eightStep(),
               top: rel("#app fieldset"), band: rel("#app > .nu-pan:not([data-off]) > .nu-ax"),
               scroll: Math.round(document.scrollingElement.scrollTop),
               voices: window.__eightDoc().voices.filter((v) => v.kind === "line").length,
               bpm: window.__eightDoc().time.bpm,
               bars: window.__eightDoc().form.sections.map((s) => s.bars) };
    });

    // ---- play, and PROVE the boundaries rather than waiting for them.
    // Measured 2026-08-24: the first boundary landed at ~26 s on a section
    // arithmetic predicts at 16.5 s, because the engine runs a runway. A fixed
    // sleep would be a coin toss.
    await page.click("#play");
    await page.waitForFunction(() => (() => { const b = document.getElementById("play"); if (!b) return ""; const a = (b.getAttribute("aria-label") || "").trim(); if (a) return a; const v = b.querySelector(".nu-vh"); return ((v ? v.textContent : b.textContent) || "").trim(); })() === "stop",
      null, { timeout: 15000 }).catch(() => {});
    const budget = ((before.bars[0] || 4) + (before.bars[1] || 4)) * 4 * 60 /
      Math.max(30, before.bpm) * 1000 + 25000;
    const t0 = Date.now();
    const seq = [before.si], at = [];
    while (seq.length < 3 && Date.now() - t0 < budget) {
      await page.waitForTimeout(100);
      const now = await page.evaluate(() => ({ si: window.__eightSec(),
        t: Math.round(performance.now() - window.__t0) }));
      if (now.si !== seq[seq.length - 1]) { seq.push(now.si); at.push(now.t); }
    }
    const crossed = seq.length - 1;
    console.log("     sections seen: " + seq.join(" → ") + "  at " +
      at.map((x) => (x / 1000).toFixed(1) + "s").join(", "));
    is(crossed >= 2, "  · two section boundaries crossed (" + seq.join(" → ") + ")");

    const after = await page.evaluate(() => {
      const rel = (sel) => { const e = document.querySelector(sel);
        const a = document.getElementById("app");
        return e ? Math.round(e.getBoundingClientRect().top -
                              a.getBoundingClientRect().top) : -1; };
      return { caps: window.__eightCaptions(), eng: window.__eightEngraves(),
               step: window.__eightStep(), longs: window.__longs.slice(),
               top: rel("#app fieldset"), band: rel("#app > .nu-pan:not([data-off]) > .nu-ax"),
               scroll: Math.round(document.scrollingElement.scrollTop) };
    });
    const B = await page.evaluate(() => window.__eightFrozen());

    // A3 — THE ASSERTION THE ROUND EXISTS FOR
    is(A === B, "A3 " + width + " · the editable half is byte-identical across " +
      crossed + " boundaries (" + A.length + " chars)" +
      (A === B ? "" : "\n        " + firstDiff(A, B)));

    // A4 — ...and the live half is alive. The caption always names the
    // sounding section, so a boundary MUST move it.
    is(JSON.stringify(after.caps) !== JSON.stringify(before.caps),
      "A4 " + width + " · a composed caption moved: " +
      JSON.stringify(before.caps) + " → " + JSON.stringify(after.caps));
    is(after.step !== before.step,
      "A4 " + width + " · the playhead is running (step " + before.step +
      " → " + after.step + ")");

    // A5 — nothing inside #app moved, above the staves OR below them, and
    // nothing was scroll-jacked. The band axis is the load-bearing half: it
    // sits under every composed block, so a composed staff or a caption that
    // changed height would show up here and nowhere else.
    is(after.top === before.top, "A5 " + width + " · the first fieldset is where it was " +
      "in #app (" + before.top + " → " + after.top + ")");
    /* WAS `#ax-band`, WHICH IS BEHIND A TAB NOW (2026-08-27). The claim is
       "everything BELOW the staves is where it was", and what it was measuring
       is a box whose top moves if any live block above it changes height. The
       band axis was that box while the page was one scroll; on the Motif tab
       it is `display: none` and reads 0, which is a number that cannot move
       and therefore an assertion that asserts nothing. The open panel's own
       `.nu-ax` is the box that is actually under the staves now — its top is
       what a composed staff or a caption growing a line would push. */
    is(after.band === before.band, "A5 " + width + " · the open panel's axis — " +
      "everything under the staves — is where it was in #app (" +
      before.band + " → " + after.band + ")");
    is(after.scroll === before.scroll, "A5 " + width + " · the scroll was not moved (" +
      before.scroll + " → " + after.scroll + ")");

    // A6 — the change detector
    const grew = after.eng - before.eng, cap = before.voices * crossed;
    is(grew <= cap, "A6 " + width + " · " + grew + " abcjs renders across " + crossed +
      " boundaries (at most " + cap + " — one per line voice per boundary)");

    // A7 — the main thread, and WHEN each task landed
    const say = (e) => e.d + " ms at +" + (e.at / 1000).toFixed(1) + "s";
    const start = after.longs.filter((e) => e.d >= 100 && e.at < START_QUIET);
    const bad = after.longs.filter((e) => e.d >= 100 && e.at >= START_QUIET);
    if (start.length) console.log("     the engine starting: " +
      start.map(say).join(", ") + " (allowed — your press, not the clock)");
    is(bad.length === 0, "A7 " + width + " · no long task >= 100 ms after the engine " +
      "started, and none at a boundary (" + (bad.length ? bad.map(say).join(", ")
        : String(after.longs.filter((e) => e.at >= START_QUIET).length) +
          " short tasks, longest " + Math.max(0, ...after.longs
            .filter((e) => e.at >= START_QUIET).map((e) => e.d)) + " ms") + ")");

    // A8 — stopping does not rebuild either
    await page.click("#play");
    await page.waitForFunction(() => (() => { const b = document.getElementById("play"); if (!b) return ""; const a = (b.getAttribute("aria-label") || "").trim(); if (a) return a; const v = b.querySelector(".nu-vh"); return ((v ? v.textContent : b.textContent) || "").trim(); })() === "play",
      null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    const C = await page.evaluate(() => window.__eightFrozen());
    is(C === A, "A8 " + width + " · stop did not rebuild the editable half" +
      (C === A ? "" : "\n        " + firstDiff(A, C)));

    /* ---- A9 — THIRTY SECONDS OF PLAYBACK ACROSS THREE TAB SWITCHES ------
       The record is started again (A8 stopped it) and left running while the
       walk moves Motif -> Score -> Mix -> Band -> Motif. Three switches is
       Paul's own number for this round's brief; the fourth move is the way
       back, without which the comparison would be between two different tabs
       rather than between two moments.

       WHAT IS PROVED, in the order it matters: the record is still playing
       (the button still says stop and the step advanced), and `#app` — all
       four axis panels at once — is byte for byte what it was before the
       walk. A tab switch that rebuilt a panel, a clock that wrote outside a
       `[data-live]`, or a switch that stopped the transport each fail exactly
       one of those and none of them can fail quietly. */
    await page.click("#play");
    const running = await page.waitForFunction(
      () => (() => { const b = document.getElementById("play"); if (!b) return ""; const a = (b.getAttribute("aria-label") || "").trim(); if (a) return a; const v = b.querySelector(".nu-vh"); return ((v ? v.textContent : b.textContent) || "").trim(); })() === "stop",
      null, { timeout: 15000 }).then(() => true).catch(() => false);
    if (!running) fail("A9 " + width + " · the record would not start again");
    else {
      const D0 = await page.evaluate(() => window.__eightFrozen());
      const s0 = await page.evaluate(() => window.__eightStep());
      const t0 = Date.now();
      const walked = [];
      for (const t of ["Score", "Mix", "Band", "Motif"]) {
        await page.evaluate((tt) => window.__eightTab(tt), t);
        // ~7.5s a leg: four legs is the thirty seconds of playback asked for
        await page.waitForTimeout(7500);
        walked.push(t + "@" + (await page.evaluate(() => window.__eightTabMs())).toFixed(1) + "ms");
      }
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const D1 = await page.evaluate(() => window.__eightFrozen());
      const end = await page.evaluate(() => ({
        step: window.__eightStep(),
        word: (() => { const b = document.getElementById("play"); if (!b) return ""; const a = (b.getAttribute("aria-label") || "").trim(); if (a) return a; const v = b.querySelector(".nu-vh"); return ((v ? v.textContent : b.textContent) || "").trim(); })(),
        tab: window.__eightTabNow() }));
      is(end.word === "stop" && end.step !== s0,
        "A9 " + width + " · " + secs + "s of playback survived the walk " +
        walked.join(" -> ") + " (step " + s0 + " -> " + end.step +
        ", the transport says \"" + end.word + "\")");
      is(D1 === D0,
        "A9 " + width + " · and the frozen half is byte-identical back on " +
        end.tab + " (" + D0.length + " chars)" +
        (D1 === D0 ? "" : "\n        " + firstDiff(D0, D1)));
      await page.click("#play");
      await page.waitForTimeout(500);
    }

    is(errors.length === 0, "  · no page errors (" + errors.slice(0, 3).join(" | ") + ")");
    await page.close();
  }

  await browser.close();
  console.log(FAILS ? "\n" + FAILS + " failed" : "\nall checks pass");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
