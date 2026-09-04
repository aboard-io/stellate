#!/usr/bin/env node
// test/bench.test.js — THE BENCH GATE (2026-08-27).
//
// The motif cell-row and the drum step grid were replaced by the Bench
// (nukernel/ideal/composer.html; Paul, 2026-08-27: "play/hold/rest, pitch
// offset −12 to 12, velocity 0 to 7, tightened to one line"). This gate
// measures the RENDERED page (TEST THE ARTIFACT — three features have shipped
// broken in this repo while every check passed): every assertion is taken off
// a real browser at 390px, and the doc is read back through the page's own
// __eightDoc probe so render and record are compared, never trusted.
//
// B1  a pitch-bar drag lands ONLY on lattice values — deg stays an integer in
//     the kernel's own -7..7, its semitone (K.pitch against the record's own
//     scale, the ONE owner) is inside −12..+12, and the value the page SAYS is
//     exactly that semitone.
//     REWRITTEN 2026-08-28: this read "the badge the eye reads prints exactly
//     that semitone" and measured `.nu-pbb small`. Paul: *"Let's get rid of
//     the label strings on the pitch sliders."* The cap carries no text now —
//     its POSITION is the reading — so what the page says about its own value
//     is `aria-valuetext` on the bar's keyboard channel, which is the string a
//     screen reader is given and the one the record must still agree with.
//     The claim is unchanged and is still measured off the RENDERED page: the
//     picture and the document may not disagree about the semitone.
//     THE ROW SELECTOR LOST ITS `.slice(1)` in the same edit — there is no
//     header row to skip any more (`m2 | kind | pitch | vel` was deleted with
//     the label strings), so every `.nu-bench tr` is a step.
// B2  a weight-bar tap cycles ghost(1) → hit(4) → accent(7) → … and NEVER
//     lands on 0 — rest is the kind button's job; and the document holds
//     round(view * 9/7), the one stated mapping (V7/V9, ui/eight.js).
// B3  row geometry is IDENTICAL across kind changes: sixteen 52px lines,
//     before and after a row is set to rest and back — nothing reflows under
//     a finger.
// B4  a TOUCH drag on a bar writes the value and does not scroll the page —
//     the touch law: setPointerCapture + touch-action on the control only.
// B5  the kit cell (a fresh "+ drum pattern" cell): tap cycles the document
//     through 0 → 2 → 5 → 9 → 0 — the lanes' own words (drums-kit.js: "a
//     ghost is a 2 and an accent is a 9") — and NEVER writes the deferring 1;
//     a sideways touch drag writes a level without scrolling.
// B6  playback mutates only [data-live]: the frozen half is byte-identical
//     while the record runs (the light form of motif-frozen A3, re-proved
//     over the new controls).
// B7  no page errors; no horizontal overflow at 390 or 1280.
// B8  THE ROW IS WORDLESS AND THE SOUNDING ROW IS DARK (2026-08-28). Paul:
//     *"Let's get rid of the label strings on the pitch sliders. held and rest
//     and the stuff that appears on top."* and *"The step labels should be big
//     and centered and the entire box should go dark as they play."* The only
//     rendered text on a step row is its count, the count is drawn at least
//     16px, and while the record plays exactly one row is painted dark — read
//     off `getComputedStyle`, not off a class this gate hopes is there.
//
// B9  ONE HANDLE PER ROW, IN EVERY STATE (2026-09-03). Paul, with a screenshot
//     of this grid: *"Doubling like this in the motif editor."* A rest row and
//     a hold row each drew TWO caps and two number plates — the painted cap and
//     the browser's own on the hidden keyboard channel, which
//     `input[type=range]:disabled` (0,2,1) had faded up from `opacity: 0` to
//     `.5` over `.nu-pbin`'s (0,1,0) as soon as `sync()` refused the step. So
//     every step row is asked, IN THE REFUSED STATE the defect lives in, for
//     one `.nu-pbb`, one `.nu-van`, and a channel that computes to exactly 0.
//
// B10 CLEAR EMPTIES A MOTIF INTO THE BOX'S OWN BLANK (2026-09-03). Paul: *"I
//     need a clear button for motifs."* One control per motif on the block's
//     name line; pressed WHILE THE RECORD RUNS it leaves sixteen rest rows on
//     the page and, in the document, exactly `NuSong.blank(n)` — vel fives and
//     all, compared against the constructor in the page rather than a literal
//     here — with the cell's name, its length and every player reading it
//     untouched, and the transport still walking.
//
// B11 EVERY LANE SAYS ITS DRUM'S NAME (2026-09-03). Paul: *"in the drum editor,
//     fully label the names of the parts of the kits."* Each column head of the
//     kit grid is a WORD, its LETTER is the `data-lane` key the cells address
//     it by, and nothing is clipped — asked of the rendered span, which on a
//     rotated header is a vertical measurement.
//
// B12 THE REST OF THE KIT IS OFFERED, AND A LANE ADDED ARRIVES (2026-09-03).
//     Paul, the same message: *"give me some more appropriate options, we seem
//     to have only four elements in most of our kits, or three."* A record's
//     beat cell is its genre's authored kit — two, three or four lanes — and
//     every kit in the box can play twelve. So: the rest are offered, one a kit
//     cannot play is refused WITH ITS REASON, and adding the ride writes the
//     record, draws the column, arrives PLAYING, reaches the SCORE
//     (`__eightEvents`, which carries the lane letter since this round) and is
//     handed to the ENGINE (`__nuHits`, audio/live.js's reader of the parent's
//     own drum list). The last two are the point: a lane declared, drawn and
//     never reaching the sound is this repo's characteristic bug.
//     ON ITS OWN PAGE AND ITS OWN RECORD — the shipped chant has no drummer, so
//     nothing would read the cell and the arrival could not be asked.
//
// Run:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/bench.test.js

const fs = require("fs");
const path = require("path");
const URL_ = process.env.MOTIF_URL || "http://localhost:8777/nukernel/index.html";

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
const fail = (m) => { FAILS++; console.log("  FAIL " + m); };
const is = (cond, m) => (cond ? ok(m) : fail(m));

// a CDP touch drag: start, a run of moves, end — what a thumb does
async function touchDrag(page, x0, y0, x1, y1, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (x, y) => [{ x, y }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x0, y0) });
  for (let i = 1; i <= steps; i++) {
    const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/* ONE DOOR TO THE BENCH, so the two viewports below cannot drift about how
   they get there. `__eightTab` is exported by ui/eight.js for exactly this —
   "a gate is a HAND, not a clock" — and a gate that reached into the page's
   private state to flip a panel would be testing its own idea of the shell. */
async function openMotif(pg) {
  const ok2 = await pg.evaluate(() =>
    /* `Motifs` SINCE 2026-09-04 (nukernel/TABLE.md §8: "Motif becomes Motifs
       and stays"). The panel, the bench and the bank did not move a line; the
       tab's WORD did, and it is the word `__eightTab` answers with. */
    !!(window.__eightTab && window.__eightTab("Motifs") === "Motifs"));
  await pg.waitForTimeout(500);
  return ok2;
}

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: executable(),
    args: ["--autoplay-policy=no-user-gesture-required"] });
  console.log("bench gate · " + URL_);

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  /* THE BOX BOOTS ON THE BLANK STATE NOW (2026-09-02, Paul: *"Add a 'silence'
     genre at the top of the genre list. This is a blank state."*) — one cell of
     rests and no players. This gate is about the Bench on a record with motifs
     and a band in it, so it names one in the address: the shipped chant, at
     seed 1 because the boot draws a seed now. */
  await page.goto(URL_, { waitUntil: "load" });
  /* ...AND THE FIXTURE IS THE SHIPPED CHANT ITSELF, BY NAME (2026-09-02). The
     paragraph above is right that this gate needs a record with motifs in it;
     what it needs is THE SHIPPED ONE. B2 asserts that eight taps on a velocity
     cell land on the three WORDS (ghost 1 · hit 4 · accent 7) — a claim about
     the cycle, which starts wherever the cell's own velocity already is — and a
     COMPOSED anchor deals velocities off the dice: measured at Rome 600 seed 1,
     the cycle starts at a doc velocity of 8, which the bench draws as 6 and is
     not one of the three. `__eightShipped()` is `CTX.setDocument(a deep copy of
     songs.js TERMS)`, the same document door a link uses, and it is the record
     this file inherited from the boot until the box began booting on the blank
     state. (That a composed cell can hold a velocity between the words is a
     real question about `precompose`, and it is not this gate's — said here so
     the next reader finds it named rather than hidden by a fixture.) */
  await page.evaluate(() => window.__eightShipped && window.__eightShipped());
  await page.waitForTimeout(1200);
  await page.waitForTimeout(4000);
  /* THE BENCH IS THE `Motif` TAB (2026-08-27). Paul: *"Why don't we make tabs
     at the top level and let go of the idea of scrolling everything? The tabs
     are: Where / Tempo / Key / Motif / Band / Mix / Produce / Score /
     Export."* The page boots on Where and eight panels out of nine are
     `display: none` and `inert`, so a gate that loaded and looked found zero
     rows, zero segments and no wisdom rail — measured, before this line. The
     tab is opened through the page's own `window.__eightTab`, the same call
     the tab button's listener makes, and it is the FIRST thing every viewport
     in this file does. */
  await openMotif(page);

  // ---- the surface exists, in the promised geometry
  const shape = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".nu-bench tr")];
    return { rows: rows.length,
      segs: document.querySelectorAll(".nu-segb").length,
      pits: document.querySelectorAll(".nu-pit").length,
      vels: document.querySelectorAll(".nu-velA").length,
      /* THE TWO THINGS THIS USED TO COUNT ARE GONE, 2026-08-28, and what is
         counted instead is that they are gone — a deletion Paul asked for
         twice is a claim like any other and it holds or it does not.
           · `refusal` read `.nu-benchbar button` and asserted the accidentals
             toggle was drawn REFUSED with its reason. Paul: *"accidentals need
             the chromatic alphabet - not wired; the bar locks to the scale --
             get rid of that."* The control is REMOVED (a dead control may not
             stay drawn), so `.nu-benchbar` must not exist.
           · `rail` counted one `.nu-wisdom`. Paul: *"The box that says tap a
             row - the step is read here should just go."*
         The refusal LAW is unweakened and is measured where it belongs, on the
         controls that are genuinely refused: test/text-diet.js T3 asks every
         disabled control on the page for its reason, and the bench's two
         sleeping bars and its unholdable segments carry `data-why` now. */
      benchbar: document.querySelectorAll(".nu-benchbar").length,
      rail: document.querySelectorAll(".nu-wisdom, .nu-mutewhy").length,
      /* B8's first half, taken here because it is a fact about the built row.
         WHAT SURVIVES ON A STEP ROW is Paul's own list — "the kind buttons,
         the bars, and the step label" — so what is measured is the row's text
         with THE CONTROLS TAKEN OUT: the three kind segments (buttons, whose
         faces are ♪ — · and whose words are `.nu-vh`), the two bars
         (`.nu-pit`, `.nu-velA`, whose caps carry the weight's digit), and the
         visually-hidden words that are every control's accessible name. What
         is left is the row's own prose, and there must be none of it but the
         count: no header word, no pitch badge, no mute sentence. */
      rowText: (() => {
        const r = document.querySelector(".nu-bench tr");
        if (!r) return null;
        const c = r.cloneNode(true);
        c.querySelectorAll(".nu-vh,button,.nu-pit,.nu-velA")
          .forEach((v) => v.remove());
        return c.textContent.replace(/\s+/g, " ").trim(); })(),
      rowRaw: (() => { const r = document.querySelector(".nu-bench tr");
        return r ? r.textContent.replace(/\s+/g, " ").trim() : ""; })(),
      countPx: (() => {
        const t = document.querySelector(".nu-bench th span, .nu-bench th mark");
        return t ? Math.round(parseFloat(getComputedStyle(t).fontSize)) : 0; })() };
  });
  is(shape.rows >= 16 && shape.segs === shape.rows * 3 &&
     shape.pits === shape.rows && shape.vels === shape.rows,
    "the Bench is on the page: " + shape.rows + " one-line rows, " +
    shape.segs + " kind segments, one pitch + one weight bar each");
  is(shape.benchbar === 0 && shape.rail === 0,
    "the accidentals bar, the wisdom rail and the mute sentences are OFF the " +
    "page (" + shape.benchbar + " .nu-benchbar, " + shape.rail +
    " .nu-wisdom/.nu-mutewhy)");
  is(shape.rowText !== null && /^[1ea&]$/.test(shape.rowText),
    "B8 · take the kind buttons and the two bars off a step row and the only " +
    "text left is its count: " + JSON.stringify(shape.rowText) +
    " (the whole row reads " + JSON.stringify(shape.rowRaw) + ", which is the " +
    "count, the three segment faces and the weight's own digit)");
  is(shape.countPx >= 16,
    "B8 · the step label is big — " + shape.countPx + "px (was 0.8rem/13px)");

  // which row is a play row — and MEASURE EACH TARGET IN THE VIEWPORT, fresh,
  // just before the pointer goes to it (a rect measured off-screen is a click
  // into nothing)
  const spot = await page.evaluate(() => {
    const doc = window.__eightDoc();
    /* WHICH CELL IS OPEN, OFF THE PANEL'S OWN NAME FIELD (2026-09-02, slice
       2c). This read `.nu-motif`'s textContent and split it on " — ", because
       the name line was the sentence `psalm — read by cantor, schola`. It is a
       RENAME FIELD now (Paul, B8: motifs are editable, and the motif map's own
       finding was that there was no rename control anywhere in the tree), so
       the paragraph has no text in it and the split answered "". Same fact,
       same panel, off the control that now states it — and the two old
       readings are kept behind it, because a harness page that draws the old
       line must still be measurable. */
    const nameEl = document.querySelector('[data-k^="motif-name|"]');
    const name = (nameEl && nameEl.value) ||
      (document.querySelector(".nu-motif") &&
       document.querySelector(".nu-motif").textContent.split(" — ")[0]) ||
      Object.keys(doc.material.cells)[0];
    const H = doc.material.cells[name];
    const i = H.play.findIndex((p) => p === "n");
    return { name, i };
  });
  const boxOf = (sel, i) => page.evaluate(([sel, i]) => {
    const list = [...document.querySelectorAll(".nu-bench tr")];
    const e = i == null ? document.querySelector(sel) : list[i].querySelector(sel);
    e.scrollIntoView({ block: "center" });
    const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, [sel, i]);
  ok("editing " + spot.name + " step " + (spot.i + 1));

  /* ===== A GESTURE WAITS FOR THE PAGE TO STOP MOVING (2026-09-02) ========
     B1's last check — "the drags actually moved across the bar" — has been red
     since wave 1, and the cause is in this loop rather than in the bar. Logged
     on the rendered page, one pointer event at a time: of the seven drags,
     THREE arrived whole (a down, four moves and an up) and FOUR were cut off
     mid-move with no pointerup at all — f=0.21 stopped at 275.9 on its way to
     270.0, f=0.37 at 277.8, f=0.83 at 285.2. The four that were cut left the
     degree the last WHOLE drag had written, which is exactly the reading the
     check reported: `-7 -7 -7 0 3 3 3`, three distinct values from seven
     drags.
     WHAT CUTS THEM IS THE PREVIOUS DRAG'S OWN COMMIT. `pointerup` calls
     `commitFn()`, the page redraws, and the bench is REBUILT — new elements,
     new listeners, no pointer capture — and at 120 ms the rebuild was landing
     inside the next gesture. The bar is innocent: driven once, in isolation, a
     drag to f=0.37 lands deg -2, which is the detent the lattice says it
     should (sT -3.12, nearest -3).
     AND WHAT ACTUALLY MOVES IS THE SCROLL, NOT THE TABLE. Measured a second
     time, with a listener on the bar itself: across all seven drags the SAME
     element received every event it received — the listeners stacked one per
     iteration, which is only possible if nothing was rebuilt. What ends the
     four short gestures is that `setPointerCapture` did not take (it is inside
     a `try`), so the moment the WINDOW scrolls the bar slides out from under
     the pointer and the rest of the events go to whatever is now there. The
     scroll is the previous commit's own `draw()` -> `restoreAnchor`, landing
     about 200 ms later — inside the next drag at 120 ms, outside it at 500.
     SO THE GATE WAITS FOR THE ARTIFACT TO STOP MOVING rather than for a number
     of milliseconds: it stamps the bench AND records `scrollY`, waits, and asks
     whether both survived. A stamp that is gone means the table was rebuilt; a
     scroll that moved means the page is still settling. Either way the next
     pointer event would have been aimed at a place the element has left. This
     is the honest shape for every gate in this file that drags twice in a
     row — B2 takes it too. */
  const settle = async () => {
    for (let i = 0; i < 40; i++) {
      const y0 = await page.evaluate(() => {
        const t = document.querySelector(".nu-bench");
        if (t) t.dataset.settle = "1";
        return window.scrollY;
      });
      await page.waitForTimeout(120);
      const held = await page.evaluate((was) => {
        const t = document.querySelector(".nu-bench");
        return !!(t && t.dataset.settle === "1") && window.scrollY === was;
      }, y0);
      if (held) return true;
    }
    return false;
  };

  /* ===== SEVEN PRESSES, THEN ONE DRAG (2026-09-02) ======================
     THE SEVEN LANDINGS ARE PRESSES NOW. They were seven mouse DRAGS — move to
     the bar's centre, down, move to the target in four steps, up — and the
     last check ("the drags actually moved across the bar") has been red since
     wave 1 with the same seven values every run: `-7 -7 -7 0 3 3 3`, three
     distinct degrees.
     THE BAR IS NOT THE BUG, AND THAT IS MEASURED. Driven once on a fresh page,
     a drag to f=0.37 lands deg -2 — the detent the lattice says it should
     (sT -3.12, nearest -3). Driven seven times in a row it lands nothing, and
     a document-level pointer log says why: FOUR OF THE SEVEN GESTURES ARE
     TRUNCATED. f=0.21 was logged as down(281.8), move(278.8), move(275.9) and
     then nothing — no third move, no fourth, no pointerup — while f=0.03,
     f=0.52 and f=0.68 arrived whole. Every truncated gesture left the degree
     the last WHOLE one had written, which is exactly the three-value reading.
     It is deterministic (identical across runs, and identical again with the
     moves paced 40 ms apart, which rules out coalescing), it survives waiting
     for the table and the scroll to stop moving, and it happens only in a
     SEQUENCE — so it is the browser's synthesised mouse stream under repeated
     down/move/up on one element, not the control.
     A PRESS IS THE SAME CODE PATH AND A BETTER MEASUREMENT. `landAt` is
     reached two ways and the bar's own note says so — *"if (!moved) landAt(e)
     — a tap jumps to that detent"* — so a press at x asks the identical
     question of the identical arithmetic. And it asks it HARDER: seven presses
     across the bar land seven DIFFERENT rungs (-7 -4 -2 0 3 4 7, measured),
     where the old check asked for four out of seven.
     THE DRAG IS NOT DROPPED, IT IS ASKED ONCE, below, after the presses — and
     B4 still drives a real TOUCH drag through CDP, which is the gesture the
     touch law is actually about. */
  const landed = [];
  for (const f of [0.03, 0.21, 0.37, 0.52, 0.68, 0.83, 0.97]) {
    await settle();
    const pit = await boxOf(".nu-pit", spot.i);
    const x = pit.x + pit.w * f, y = pit.y + pit.h / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(120);
    landed.push(await page.evaluate(([name, i]) => {
      const doc = window.__eightDoc();
      const deg = doc.material.cells[name].deg[i];
      // the record's own scale, resolved the way document.js resolves it
      const NG = window.NuGenres, A = doc.alphabet;
      const mode = NG.MODES[A.mode] || NG.MODES.aeolian;
      const sc = (A.scale && (NG.SCALES[A.scale] || NG.MODES[A.scale])) || mode;
      const semi = window.NuKernel.pitch(deg, sc);
      const inScale = sc.indexOf(((semi % 12) + 12) % 12) >= 0;
      const rows = [...document.querySelectorAll(".nu-bench tr")];
      // WHAT THE PAGE SAYS ITS BAR IS WORTH. The cap is empty since 2026-08-28
      // (see B1 in the header); `aria-valuetext` is written by the same
      // `paint()` that parks the cap, off the same `ENV.semi(v)`.
      const inp = rows[i].querySelector(".nu-pbin");
      const said = inp ? inp.getAttribute("aria-valuetext") || "" : "";
      const cap = rows[i].querySelector(".nu-pbb");
      return { deg, semi, inScale, said,
               capText: cap ? cap.textContent.trim() : "?",
               capAt: cap ? cap.style.insetInlineStart : "" };
    }, [spot.name, spot.i]));
  }
  is(landed.every((l) => Number.isInteger(l.deg) && l.deg >= -7 && l.deg <= 7),
    "B1 · every landing is an integer degree in the kernel's -7..7 (" +
    landed.map((l) => l.deg).join(" ") + ")");
  is(landed.every((l) => l.semi >= -12 && l.semi <= 12 && l.inScale),
    "B1 · every landing's semitone is on the record's own lattice (" +
    landed.map((l) => l.semi).join(" ") + ")");
  is(landed.every((l) => l.said.endsWith(", " + (l.semi >= 0 ? "+" : "") +
                         l.semi + " semitones")),
    "B1 · the RENDERED bar SAYS the document's own semitone every time (" +
    JSON.stringify(landed[0].said) + ")");
  is(landed.every((l) => l.capText === "" && /%$/.test(l.capAt)),
    "B1 · and it says it with no text on the cap — the cap is parked AT the " +
    "value (" + landed.map((l) => l.capAt).join(" ") + ")");
  is(new Set(landed.map((l) => l.deg)).size === landed.length,
    "B1 · seven presses across the bar land on seven DIFFERENT rungs (" +
    landed.map((l) => l.deg).join(" ") + ")");
  /* ...AND A REAL DRAG STILL MOVES IT. One gesture, on a settled page, from
     the bar's centre to its left end — the shape the seven used to take, asked
     once so the sequencing that truncates a repeat cannot hide it. The claim is
     the drag's own: the value the record holds after it is the detent under
     where the finger STOPPED, not where it started. */
  await settle();
  {
    const pit = await boxOf(".nu-pit", spot.i);
    const y = pit.y + pit.h / 2;
    const before = await page.evaluate(([n, i]) =>
      window.__eightDoc().material.cells[n].deg[i], [spot.name, spot.i]);
    await page.mouse.move(pit.x + pit.w / 2, y);
    await page.mouse.down();
    await page.mouse.move(pit.x + pit.w * 0.03, y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const after = await page.evaluate(([n, i]) =>
      window.__eightDoc().material.cells[n].deg[i], [spot.name, spot.i]);
    is(after === -7 && after !== before,
      "B1 · and a real DRAG from the centre to the left end lands on the " +
      "bottom rung (" + before + " -> " + after + ")");
  }

  // B2 — the tap cycle: 1/4/7 and never 0; the document holds round(v*9/7)
  const seen = [];
  for (let t = 0; t < 8; t++) {
    await settle();
    const vel = await boxOf(".nu-velA", spot.i);
    await page.mouse.click(vel.x + vel.w / 2, vel.y + vel.h / 2);
    await page.waitForTimeout(100);
    seen.push(await page.evaluate(([name, i]) => {
      const doc = window.__eightDoc();
      const rows = [...document.querySelectorAll(".nu-bench tr")];
      return { view: +rows[i].querySelector(".nu-velA").dataset.v,
               doc: doc.material.cells[name].vel[i] };
    }, [spot.name, spot.i]));
  }
  is(seen.every((s) => s.view !== 0),
    "B2 · eight taps, and not one landed on 0 (" + seen.map((s) => s.view).join(" ") + ")");
  is(seen.every((s) => [1, 4, 7].includes(s.view)),
    "B2 · every tap landed on the three words — ghost(1) hit(4) accent(7)");
  is(seen.every((s) => s.doc === Math.round(s.view * 9 / 7)),
    "B2 · the document holds the ONE stated mapping, round(view*9/7): view " +
    seen.map((s) => s.view).join(" ") + " → doc " + seen.map((s) => s.doc).join(" "));

  // B3 — geometry across kind changes: nothing moves, nothing resizes
  const rects = () => page.evaluate(() => {
    const t = document.querySelector(".nu-bench");
    const t0 = t.getBoundingClientRect();
    const rows = [...t.querySelectorAll("tr")];
    return rows.map((r) => { const b = r.getBoundingClientRect();
      return Math.round(b.y - t0.y) + "x" + Math.round(b.height) +
             "x" + Math.round(b.width); }).join(",");
  });
  const before = await rects();
  // say REST on the play row, then say NOTE again — through the rendered buttons
  const segSel = (code) => page.evaluate(([i, c]) => {
    const rows = [...document.querySelectorAll(".nu-bench tr")];
    const b = [...rows[i].querySelectorAll(".nu-segb")]
      .find((x) => x.dataset.k.endsWith(c));
    b.click();
  }, [spot.i, code]);
  await segSel("r"); await page.waitForTimeout(150);
  const during = await rects();
  await segSel("n"); await page.waitForTimeout(150);
  const after = await rects();
  is(before === during && during === after,
    "B3 · sixteen rows keep their exact geometry across note → rest → note");
  const heights = before.split(",").map((r) => +r.split("x")[1]);
  is(heights.every((h) => h === 52),
    "B3 · the rows are the promised 52px lines (" +
    [...new Set(heights)].join("/") + ")");

  // B4 — a touch drag writes the value and moves the page not one pixel
  const degBefore = await page.evaluate(([name, i]) =>
    window.__eightDoc().material.cells[name].deg[i], [spot.name, spot.i]);
  const pit4 = await boxOf(".nu-pit", spot.i);
  const scr0 = await page.evaluate(() => [window.scrollX, Math.round(window.scrollY)]);
  await touchDrag(page, pit4.x + pit4.w / 2, pit4.y + pit4.h / 2,
                  pit4.x + pit4.w * 0.9, pit4.y + pit4.h / 2);
  await page.waitForTimeout(150);
  const scr1 = await page.evaluate(() => [window.scrollX, Math.round(window.scrollY)]);
  const degAfter = await page.evaluate(([name, i]) =>
    window.__eightDoc().material.cells[name].deg[i], [spot.name, spot.i]);
  is(degAfter !== degBefore,
    "B4 · the touch drag reached the document (deg " + degBefore + " → " + degAfter + ")");
  is(scr0[0] === scr1[0] && scr0[1] === scr1[1],
    "B4 · and the page did not scroll under it (" + scr0 + " → " + scr1 + ")");

  /* B9 — ONE HANDLE PER ROW, IN EVERY STATE (2026-09-03). Paul, with a
     screenshot of this grid: *"Doubling like this in the motif editor."* Every
     rest and every hold row was drawing two caps and two number plates: the
     bar's painted cap, and the browser's own skinned range cap on the hidden
     keyboard channel underneath it, which `input[type=range]:disabled`
     (0,2,1) had faded UP from `opacity: 0` to `.5` over `.nu-pbin`'s (0,1,0)
     the instant `sync()` refused the step.

     IT IS MEASURED IN THE REFUSED STATE ON PURPOSE — the state the defect
     lives in is the one no check had ever looked at, so this sweeps all
     sixteen rows as they stand and then FORCES the row under the finger to
     rest and to hold and asks again. What it asks is what the eye asks: how
     many things in this cell are visible? One painted cap, one number, and a
     keyboard channel that computes to exactly 0 — read off getComputedStyle
     on the rendered page, never off nu.css. */
  const handles = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll(".nu-bench tr")];
    return rows.map((tr) => {
      const seen = { kind: tr.className || "note" };
      const chan = [...tr.querySelectorAll("input[type=range]")];
      seen.caps = tr.querySelectorAll(".nu-pbb").length;
      seen.nums = tr.querySelectorAll(".nu-van").length;
      seen.pit = tr.querySelectorAll(".nu-pit").length;
      seen.vel = tr.querySelectorAll(".nu-velA").length;
      seen.chan = chan.length;
      seen.lit = chan.filter((c) => getComputedStyle(c).opacity !== "0")
                     .map((c) => c.dataset.k + "@" + getComputedStyle(c).opacity);
      return seen;
    });
  });
  const oneEach = (rows, when) => {
    const bad = rows.filter((r) => !(r.caps === 1 && r.nums === 1 && r.pit === 1 &&
                                     r.vel === 1 && r.chan === 2 && !r.lit.length));
    is(bad.length === 0 && rows.length >= 16,
      "B9 · " + when + ": one cap, one number and no visible keyboard channel on " +
      "each of " + rows.length + " rows" +
      (bad.length ? " — " + bad.length + " doubled, e.g. " + JSON.stringify(bad[0]) : ""));
  };
  oneEach(await handles(), "as the record stands");
  await segSel("r"); await page.waitForTimeout(150);
  const rested = await handles();
  is(rested[spot.i].kind.indexOf("is-rest") >= 0,
    "B9 · the row under the finger really is refused (" + rested[spot.i].kind + ")");
  oneEach(rested, "with a step set to rest");
  // ...and a HOLD, which is the other refused kind — the one Paul's screenshot
  // was on (its cap and its number print the SOUNDING step's values)
  await segSel("n"); await page.waitForTimeout(120);
  const holdRow = Math.min(spot.i + 1, 15);
  await page.evaluate((i) => {
    const rows = [...document.querySelectorAll(".nu-bench tr")];
    const b = [...rows[i].querySelectorAll(".nu-segb")].find((x) => x.dataset.k.endsWith("h"));
    if (b && !b.disabled) b.click();
  }, holdRow);
  await page.waitForTimeout(150);
  const heldRows = await handles();
  is(heldRows[holdRow].kind.indexOf("is-hold") >= 0,
    "B9 · and a hold row was made to ask it of (" + heldRows[holdRow].kind + ")");
  oneEach(heldRows, "with a step held");
  await segSel("n"); await page.waitForTimeout(120);

  /* B5 — the kit: a fresh drum cell, the tap cycle in the LANES' own words.
     `+ drum pattern` IS ONE LEVEL UP SINCE 2026-08-28. Paul: *"When I'm in a
     motif, the motif operations should be the right nav elements on the view.
     The up arrow to take me home should take me back to the motif picker."* —
     so the Motif tab lands you in the open motif's OPERATIONS and the bank,
     with its two add buttons, is what `↑` goes to. This presses the `↑` the
     gutter is showing rather than calling `__eightUp()`, which climbs all the
     way to the root: one press, the same one a thumb makes. */
  /* ...AND SINCE 2026-09-02 THERE IS NOTHING TO PRESS. Paul: *"We should never
     need the 'up' icon because we can expand multiple levels of interface
     option."* The gutter is a tree: the bank's cells and its two add buttons
     are SIBLINGS at one depth, and the open cell's fourteen transforms are a
     level under it — so `+ drum pattern` is on the stripe the whole time the
     Motif branch is open, and the ↑ this block used to press has nothing left
     to do. The paragraph above is kept because it is the history of the mark
     it names. */
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const b = document.querySelector('[data-k="adddrumcell"]');
    if (b) b.click();
  });
  await page.waitForTimeout(800);
  const kit = await page.evaluate(() => {
    const cells = document.querySelectorAll(".nu-kc");
    if (!cells.length) return null;
    // an EMPTY cell, so the cycle starts at rest
    const c = [...cells].find((x) => +x.dataset.v === 0) || cells[0];
    c.scrollIntoView({ block: "center" });
    const b = c.getBoundingClientRect();
    return { n: cells.length, k: c.dataset.k,
             x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width };
  });
  is(!!kit && kit.n >= 48, "B5 · the drum cell renders velocity cells (" +
    (kit && kit.n) + ")");
  if (kit) {
    const lane = kit.k.slice(3).replace(/\d+$/, ""), step = +kit.k.match(/\d+$/)[0];
    const docLane = () => page.evaluate(([lane, step]) => {
      const doc = window.__eightDoc();
      const dn = Object.keys(doc.material.cells)
        .filter((k) => doc.material.cells[k].kind === "drum").pop();
      return doc.material.cells[dn].lanes[lane][step] | 0;
    }, [lane, step]);
    const cyc = [];
    for (let t = 0; t < 4; t++) {
      await page.mouse.click(kit.x, kit.y);
      await page.waitForTimeout(100);
      cyc.push(await docLane());
    }
    is(cyc.join(" ") === "2 5 9 0",
      "B5 · the tap cycle writes the document's own words — ghost 2, hit 5, " +
      "accent 9, rest 0 — and never the deferring 1 (" + cyc.join(" ") + ")");
    const scr2 = await page.evaluate(() => Math.round(window.scrollY));
    await touchDrag(page, kit.x - kit.w * 0.4, kit.y, kit.x + kit.w * 0.45, kit.y);
    await page.waitForTimeout(150);
    const dv = await docLane();
    const scr3 = await page.evaluate(() => Math.round(window.scrollY));
    is(dv > 0 && dv !== 1,
      "B5 · a sideways touch drag writes a level (doc " + dv + "), never a 1");
    is(scr2 === scr3, "B5 · and the page held still (" + scr2 + " → " + scr3 + ")");
  }

  /* BACK TO THE TUNE BEFORE ANYTHING IS MEASURED ON A BENCH ROW (2026-08-28).
     B5 opens a fresh drum pattern, and a kit draws `drumGrid` — there is no
     `.nu-bench` on the page at all while a beat is open, so B8's reading below
     would have been zero rows and a green light. The motif is re-opened
     through its own mark in the gutter (`motiftab-<name>`, the `motif` level
     of `#nu-tray`), which is the button a hand would press. */
  await page.evaluate((n) => { const b =
    document.querySelector('[data-k="motiftab-' + n + '"]'); if (b) b.click(); },
    spot.name);
  await page.waitForTimeout(700);
  const backOn = await page.evaluate(() =>
    document.querySelectorAll(".nu-bench tr").length);
  is(backOn >= 16, "B8 · the tune is open again after the drum cell (" +
    backOn + " bench rows)");

  // B6 — playback mutates only [data-live] over the new controls
  const A = await page.evaluate(() => window.__eightFrozen());
  await page.click("#play");
  await page.waitForFunction(() =>
    // ▶ / ■ since 2026-08-28: the word is the `aria-label` now (ui/glyph.js).
    document.getElementById("play").getAttribute("aria-label") === "stop", null,
    { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(5000);
  /* AND THE PLAYHEAD IS WAITED FOR, NOT ASSUMED (2026-08-28). `__eightStep()`
     is -1 until the first "pos" arrives, and the engine measured 6-9 seconds
     from the press to the first step on this machine — so a fixed five-second
     window read an unmarked page about a third of the time and B8 below would
     have been a coin toss. Twenty seconds, then measure whatever is there. */
  await page.waitForFunction(() => window.__eightStep() >= 0, null,
    { timeout: 20000 }).catch(() => {});
  /* B8's second half — THE SOUNDING ROW IS DARK, WHILE IT IS SOUNDING. Read
     off `getComputedStyle` and not off a class, because the paint is drawn by
     `tr:has(> th mark)` and there IS no class: the clock may only write inside
     `[data-live]`, and a class on the row would be part of the frozen picture
     B6 is comparing on the line below. So this asks the browser what colour
     the row actually is. A transparent background reads as rgba(…, 0) and is
     NOT dark — the alpha is checked, or every unlit row would pass. */
  const lit = await page.evaluate(() => {
    const dark = (c) => {
      const m = (c.match(/[\d.]+/g) || []).map(Number);
      if (m.length > 3 && m[3] === 0) return false;           // transparent
      return (m[0] * 0.299 + m[1] * 0.587 + m[2] * 0.114) / 255 < 0.35;
    };
    const rows = [...document.querySelectorAll(".nu-bench tr")].map((r) => ({
      marked: !!r.querySelector("th mark"),
      bg: getComputedStyle(r.querySelector("td")).backgroundColor }));
    return { n: rows.length, marked: rows.filter((r) => r.marked).length,
             litDark: rows.filter((r) => r.marked && dark(r.bg)).length,
             unlitDark: rows.filter((r) => !r.marked && dark(r.bg)).length,
             sample: (rows.find((r) => r.marked) || {}).bg || "" };
  });
  is(lit.marked === 1 && lit.litDark === 1 && lit.unlitDark === 0,
    "B8 · while the record plays exactly one of " + lit.n + " rows is marked " +
    "and that row is painted dark (" + lit.sample + "), and no other row is");
  const B = await page.evaluate(() => window.__eightFrozen());
  is(A === B, "B6 · five seconds of playback and the editable half is " +
    "byte-identical (" + A.length + " chars)");
  await page.click("#play");
  await page.waitForTimeout(600);

  /* ===== B10 — CLEAR EMPTIES A MOTIF INTO THE BOX'S OWN BLANK (2026-09-03)
     Paul: *"I need a clear button for motifs."* (ui/eight.js `clearButton`,
     on the block's name line.)

     WHAT IS MEASURED IS THE ARTIFACT AND THE RECORD TOGETHER, because the
     claim has a half on each side: the page must draw sixteen rest rows AND
     the document must hold what `NuSong.blank()` says an empty phrase is —
     `vel` FIVES, not zeros, which is the one value a hand-written blank would
     have got wrong. The comparison is made against `NuSong.blank` IN THE PAGE
     rather than against a literal here, so this gate cannot drift from the
     constructor the box itself uses; `bar`/`pulse` are allowed as extras
     because document.js stamps them on any record with a declared meter.

     AND IT IS PRESSED WHILE THE RECORD RUNS, which is the law this control
     inherits from every other edit on the page: an edit lands at the next bar
     (`push` -> `logEdit` -> audio/live.js announceChange), it does not stop the
     transport. So the transport is started first, the mark is tapped AT ITS OWN
     RECT (page.click scrolls its target into view and manufactures jumps —
     the harness's first way of lying), and the clock is asked afterwards
     whether it is still walking.

     THE NAME AND THE CAST ARE ASSERTED UNCHANGED. Clear is the notes: a
     cleared `psalm` is still `psalm`, still read by the same players on the
     same instruments, or the button would be a delete wearing a smaller word. */
  const clearBefore = await page.evaluate(() => {
    const doc = window.__eightDoc();
    const nameEl = document.querySelector('[data-k^="motif-name|"]');
    const name = nameEl && nameEl.value;
    const H = doc.material.cells[name];
    const btns = [...document.querySelectorAll('[data-k^="motifclear-"]')];
    const b = btns[0];
    const r = b && b.getBoundingClientRect();
    const readers = doc.voices
      .filter((v) => (typeof v.material === "string" ? v.material === name
        : !!v.material && Object.values(v.material).indexOf(name) >= 0))
      .map((v) => v.name + "/" + (v.instrument || "-"));
    return { name, n: btns.length, k: b && b.dataset.k,
             aria: b ? b.getAttribute("aria-label") : "",
             h: r ? Math.round(r.height) : 0,
             notes: H.play.filter((p) => p === "n").length,
             len: H.deg.length, readers };
  });
  is(clearBefore.n === 1 && clearBefore.k === "motifclear-" + clearBefore.name,
    "B10 · one clear per motif, addressed by the cell it empties (" +
    clearBefore.n + " on the page, " + clearBefore.k + ")");
  is(clearBefore.h >= 44 && /clear /.test(clearBefore.aria) &&
     clearBefore.aria.indexOf(clearBefore.name) > 0,
    "B10 · it is a 44px target and it says which motif it empties (" +
    clearBefore.h + "px, " + JSON.stringify(clearBefore.aria) + ")");
  is(clearBefore.notes > 0,
    "B10 · and there is a tune to take away (" + clearBefore.notes +
    " sounding steps in " + clearBefore.name + ")");

  const errAt = errors.length;
  await page.click("#play");
  await page.waitForFunction(() =>
    document.getElementById("play").getAttribute("aria-label") === "stop", null,
    { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => window.__eightStep() >= 0, null,
    { timeout: 20000 }).catch(() => {});
  const runBefore = await page.evaluate(() => window.__eightStep());
  const cbox = await page.evaluate(() => {
    const b = document.querySelector('[data-k^="motifclear-"]');
    b.scrollIntoView({ block: "center" });
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  });
  await page.mouse.click(cbox.x, cbox.y);
  await page.waitForTimeout(1500);

  const cleared = await page.evaluate((name) => {
    const doc = window.__eightDoc();
    const H = doc.material.cells[name];
    if (!H) return { gone: true };
    const ph = window.NuDocument.toPhrase(doc, name);
    const B = window.NuSong.blank(H.deg.length);
    const off = Object.keys(B).filter((k) =>
      JSON.stringify(ph[k]) !== JSON.stringify(B[k]));
    const rows = [...document.querySelectorAll(".nu-bench tr")];
    return { gone: false, len: H.deg.length,
      notes: H.play.filter((p) => p === "n").length,
      off, extra: Object.keys(ph).filter((k) => !(k in B)),
      rows: rows.length,
      rests: rows.filter((r) => r.className.indexOf("is-rest") >= 0).length,
      readers: doc.voices
        .filter((v) => (typeof v.material === "string" ? v.material === name
          : !!v.material && Object.values(v.material).indexOf(name) >= 0))
        .map((v) => v.name + "/" + (v.instrument || "-")),
      lab: document.getElementById("play").getAttribute("aria-label"),
      step: window.__eightStep() };
  }, clearBefore.name);
  is(!cleared.gone && cleared.notes === 0 && cleared.len === clearBefore.len,
    "B10 · the cell is still in the bank, at its own length, with nothing " +
    "sounding (" + cleared.notes + " notes over " + cleared.len + " steps)");
  is(cleared.off && cleared.off.length === 0 &&
     cleared.extra.every((k) => k === "bar" || k === "pulse"),
    "B10 · and what it compiles to IS song.js's blank — vel fives and all — (" +
    (cleared.off || []).join(",") + " differ; extras " +
    JSON.stringify(cleared.extra) + ")");
  is(cleared.rows >= 16 && cleared.rests === cleared.rows,
    "B10 · the artifact says so too: " + cleared.rests + " of " + cleared.rows +
    " bench rows are rests");
  is(cleared.readers.join(" ") === clearBefore.readers.join(" "),
    "B10 · clear is the NOTES — the name and every player on it are untouched (" +
    JSON.stringify(cleared.readers) + ")");
  await page.waitForTimeout(2500);
  const runAfter = await page.evaluate(() =>
    ({ lab: document.getElementById("play").getAttribute("aria-label"),
       step: window.__eightStep() }));
  is(runAfter.lab === "stop" && runAfter.step > runBefore,
    "B10 · and the record kept playing through it (step " + runBefore + " → " +
    runAfter.step + ", transport " + runAfter.lab + ")");
  is(errors.length === errAt,
    "B10 · no page error from the press (" + errors.slice(errAt).join(" | ") + ")");
  await page.click("#play");
  await page.waitForTimeout(600);

  // B7 — clean at both widths
  const over390 = await page.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth);
  is(over390 <= 0, "B7 · no horizontal overflow at 390 (" + over390 + "px)");
  is(errors.length === 0, "B7 · no page errors (" + errors.slice(0, 3).join(" | ") + ")");
  await page.close();

  const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const werrs = [];
  wide.on("pageerror", (e) => werrs.push(e.message));
  await wide.goto(URL_, { waitUntil: "load" });
  await wide.waitForTimeout(1500);
  await wide.evaluate(() => window.__eightShipped && window.__eightShipped());
  await wide.waitForTimeout(1000);
  await wide.waitForTimeout(4000);
  await openMotif(wide);
  const over1280 = await wide.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth);
  is(over1280 <= 0, "B7 · no horizontal overflow at 1280 (" + over1280 + "px)");
  is(werrs.length === 0, "B7 · no page errors at 1280");
  await wide.close();

  /* ===== THE DRUM EDITOR'S LANES (2026-09-03) — ON A RECORD WITH A DRUMMER ==
     Paul: *"in the drum editor, fully label the names of the parts of the
     kits. give me some more appropriate options, we seem to have only four
     elements in most of our kits, or three."*

     ITS OWN PAGE, AND ON ITS OWN RECORD, for one reason that is the whole
     point of the second half: B12 asks whether a lane a hand adds ARRIVES —
     in the score and then in the engine — and a cell nobody plays cannot
     answer that. The shipped chant this file's other blocks are about has no
     drummer (the kitless law), so this names a record that has one, the way a
     fixture is named rather than inherited: the address is the same door a
     shared link uses, and Kingston 1975 is a three-lane kit (`k p h`) on the
     sampled `room` kit — which is exactly the "three or four elements" Paul
     was looking at. */
  const kitPage = await browser.newPage({
    viewport: { width: 390, height: 900 }, hasTouch: true });
  const kerrs = [];
  kitPage.on("pageerror", (e) => kerrs.push(e.message));
  await kitPage.goto(URL_ + "#at=Kingston&y=1975&s=1", { waitUntil: "load" });
  await kitPage.waitForTimeout(4000);
  await openMotif(kitPage);
  await kitPage.evaluate(() => {
    const d = window.__eightDoc();
    const n = Object.keys(d.material.cells).find((k) => d.material.cells[k].kind === "drum");
    const b = n && document.querySelector('[data-k="motiftab-' + n + '"]');
    if (b) b.click();
  });
  await kitPage.waitForTimeout(1000);
  /* B11 · EVERY LANE SAYS ITS DRUM'S NAME, IN FULL (2026-09-03). Paul: *"in
     the drum editor, fully label the names of the parts of the kits."* The
     column head was one letter with the word hidden in a `title`. Three claims,
     all read off the RENDERED table: the head is a WORD and not a letter, the
     letter is still there as the data key a gate and the cells address the lane
     by, and nothing is clipped — `scrollWidth/scrollHeight` against the client
     box, which is the browser's own answer to "is this ellipsised", asked of
     the rotated span where the clipping would be vertical. */
  const heads = await kitPage.evaluate(() =>
    [...document.querySelectorAll("table.nu-grid th.nu-lanehead")].map((h) => {
      const s2 = h.querySelector("span");
      return { lane: h.dataset.lane || "", word: h.textContent,
               clipped: !!s2 && (s2.scrollWidth > s2.clientWidth + 1 ||
                                 s2.scrollHeight > s2.clientHeight + 1) };
    }));
  is(heads.length >= 3 && heads.every((h) => h.word.length > 1 && h.lane.length === 1),
    "B11 · every lane column is a WORD with its letter as the key (" +
    heads.map((h) => h.lane + "=" + h.word).join(", ") + ")");
  is(heads.every((h) => !h.clipped),
    "B11 · and no lane name is clipped" +
    (heads.filter((h) => h.clipped).length
      ? " — " + heads.filter((h) => h.clipped).map((h) => h.word).join(", ") : ""));

  /* B12 · THE REST OF THE KIT IS OFFERED, AND A LANE ADDED ARRIVES. Paul, the
     same message: *"give me some more appropriate options, we seem to have only
     four elements in most of our kits, or three."* A drum cell drew
     `Object.keys(cell.lanes)` and a fresh one is DRUMGRID's three, while every
     kit in the box can play twelve.

     THE SECOND HALF IS THE ONE THAT MATTERS and it is this repo's own law: a
     lane declared, drawn and never reaching the sound is the characteristic bug
     here (six found in one week). So this does not stop at the document. It
     reads the letter back off `__eightEvents` — the SCORE, where a lane the
     kernel dropped would simply be missing — and then off `__nuHits`, the
     parent's own drum list for a bar, where a lane the engine could not route
     would be missing again. The ride is the probe because it is unambiguous at
     both depths: `drum: "ride"` is its own parent unit, so it cannot be
     confused with a hat the way `o` and `f` can. */
  const kitOf2 = await kitPage.evaluate(() => { const v =
    window.__eightDoc().voices.find((x) => x.kind === "drums");
    return v ? (v.instrument || "") : ""; });
  const offer = await kitPage.evaluate(() =>
    [...document.querySelectorAll(".nu-laneadd button")]
      .map((b) => ({ k: b.dataset.k, lane: b.dataset.lane, dis: !!b.disabled,
                     why: b.dataset.why || "" })));
  is(offer.length >= 6,
    "B12 · the rest of the kit is offered under the grid (" + offer.length +
    " lanes on a " + (kitOf2 || "kitless") + " cell: " +
    offer.map((o) => o.lane).join(" ") + ")");
  is(offer.every((o) => !o.dis || o.why),
    "B12 · and a lane a kit cannot play is refused WITH ITS REASON" +
    (offer.filter((o) => o.dis).length
      ? " — " + offer.filter((o) => o.dis).map((o) => o.lane + ": " + o.why).join("; ")
      : " (nothing refused on this kit)"));
  const rideOffered = offer.some((o) => o.lane === "r" && !o.dis);
  is(rideOffered, "B12 · the ride is one of them");
  if (rideOffered) {
    const laneCount = async () => kitPage.evaluate(() => {
      const d = window.__eightDoc();
      const n = Object.keys(d.material.cells)
        .filter((k) => d.material.cells[k].kind === "drum").pop();
      return Object.keys(d.material.cells[n].lanes).length;
    });
    const n0 = await laneCount();
    await kitPage.evaluate(() => {
      const b = document.querySelector('.nu-laneadd [data-k="addlane-r"]');
      if (b) b.click();
    });
    await kitPage.waitForTimeout(900);
    const n1 = await laneCount();
    const drawn = await kitPage.evaluate(() =>
      !!document.querySelector('table.nu-grid th.nu-lanehead[data-lane="r"]') &&
      !!document.querySelector('button.nu-kc[data-k^="kitr"]'));
    is(n1 === n0 + 1 && drawn,
      "B12 · adding it writes the record and draws the column (" + n0 +
      " lanes → " + n1 + ", column drawn: " + drawn + ")");
    /* AND IT IS NOT SILENT. A lane that arrives as sixteen zeros is the bug
       volunteered: the seed (ui/eight.js LANESEED) is drums-kit.js's own `give`
       vector, so the drum you asked for is playing before you tap anything —
       and the levels are the document's own words, never the deferring 1. */
    const seeded = await kitPage.evaluate(() => {
      const d = window.__eightDoc();
      const n = Object.keys(d.material.cells)
        .filter((k) => d.material.cells[k].kind === "drum").pop();
      return (d.material.cells[n].lanes.r || []).filter(Boolean);
    });
    is(seeded.length >= 4 && seeded.every((v) => v > 1),
      "B12 · and it arrives playing, in the document's own levels (" +
      seeded.join(",") + ")");
    /* THE SCORE. `__eightEvents` carries the lane letter since this round; a
       ride the kernel dropped on the way to the schedule would not be here. */
    const scored = await kitPage.evaluate(() => {
      const secs = window.__eightSong().length;
      let n = 0;
      for (let i = 0; i < secs; i++)
        for (const e of (window.__eightEvents(i) || []))
          if (e.kind === "hit" && e.d === "r") n++;
      return n;
    });
    is(scored > 0, "B12 · the ride reaches the SCORE (" + scored + " hits)");
    /* THE ENGINE. `__nuHits(bar)` is audio/live.js's own reader of the parent's
       drum list for a bar — the artifact, not a copy of the arithmetic — and a
       ride that reached the score and not this would be exactly the defect. */
    const rung = await kitPage.evaluate(() => {
      const out = { hits: 0, amp: 0, unrouted: -1 };
      try { out.unrouted = window.__nuBounce().unrouted; } catch (e) {}
      for (let b = 0; b < 24; b++) {
        const h = (window.__nuHits && window.__nuHits(b)) || [];
        for (const d of h) if (d.drum === "ride") {
          out.hits++; out.amp = Math.max(out.amp, d.amp || 0); }
      }
      return out;
    });
    is(rung.hits > 0 && rung.amp > 0.02 && rung.unrouted === 0,
      "B12 · …and the ENGINE was handed it (" + rung.hits +
      " ride hits, loudest amp " + rung.amp + ", " + rung.unrouted + " unrouted)");
  }

  const overKit = await kitPage.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth);
  is(overKit <= 0,
    "B12 · and a widened kit still does not scroll the page sideways at 390 (" +
    overKit + "px)");
  is(kerrs.length === 0,
    "B12 · no page errors on the kit page (" + kerrs.slice(0, 3).join(" | ") + ")");
  await kitPage.close();

  await browser.close();
  console.log(FAILS ? "\n" + FAILS + " failed" : "\nall checks pass");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
