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
    !!(window.__eightTab && window.__eightTab("Motif") === "Motif"));
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

  // B1 — the drag lands only on the lattice, and the badge agrees
  const landed = [];
  for (const f of [0.03, 0.21, 0.37, 0.52, 0.68, 0.83, 0.97]) {
    const pit = await boxOf(".nu-pit", spot.i);
    const x = pit.x + pit.w * f, y = pit.y + pit.h / 2;
    await page.mouse.move(pit.x + pit.w / 2, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 4 });
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
  is(new Set(landed.map((l) => l.deg)).size >= 4,
    "B1 · the drags actually moved across the bar (" +
    new Set(landed.map((l) => l.deg)).size + " distinct degrees)");

  // B2 — the tap cycle: 1/4/7 and never 0; the document holds round(v*9/7)
  const seen = [];
  for (let t = 0; t < 8; t++) {
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

  await browser.close();
  console.log(FAILS ? "\n" + FAILS + " failed" : "\nall checks pass");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
