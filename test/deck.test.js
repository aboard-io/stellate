#!/usr/bin/env node
// test/deck.test.js — THE SCORE DECK GATE (2026-08-27).
//
// The engraved score moved to the foot of the page (nukernel/ideal/
// score-deck.html; FUTURE.md Phase 3) and gained motif brackets, a vertical
// piano roll and an export row. Every assertion here reads the RENDERED page
// or the exported BYTES (TEST THE ARTIFACT), never the wiring:
//
// D1  every motif label's text is a member of the record's own
//     material.cells keys — extracted, zero typed strings — and there is at
//     least one label on the staff. AND (2026-08-27, Paul: "The names of the
//     motifs should appear in the score below the parts when they are used as
//     notes") each label is checked against ITS OWN PART: its text equals the
//     cell that voice reads in that section, it is a cell that KIND of voice
//     may read, and it is drawn in the gap under that voice's staff and above
//     the next one — the geometry read off the page, not off the wiring.
// D7  the identity stays in view while the paper scrolls (Paul, 2026-08-27:
//     "The score cuts off in the wrong place on mobile so I don't know which
//     instrument or key I'm looking at… maybe we put the key above the
//     score"): the key line above the engraving carries the record's key,
//     mode and meter; the pinned gutter carries every part name; and at BAR 8
//     — the paper scrolled a box and a half away — both are still non-empty
//     and still inside the viewport, at 390 and at 1280.
// D2  one clock, two views: flipping notation → piano roll → notation while
//     the record plays never loses the place (the step keeps advancing and
//     never resets), and the deck's DOM mutates ONLY inside [data-live]
//     while the record runs (the tabs and export buttons are still).
// D3  the WAV press is real: two presses of the same record are BYTE-EQUAL
//     (sha256 over the whole file), the bytes decode as canonical
//     44.1k/16-bit stereo PCM with nonzero RMS, and the duration matches the
//     score's own length.
// D4  the MIDI export parses back with OUR OWN reader. REVERSAL 2026-08-30
//     (the played-record .mid): this line read "every note's tick position
//     equals the score fold's `at` in ticks", and that score fold was
//     buildScore() — the NOTATED staff, quantized, ornament-free. Paul: "My
//     guess is you're not capturing these timing subtleties with MIDI
//     export" — measured true (iranpop hook: 112 played events, 23
//     ornaments, 74 fractional onsets; the .mid had none of them). The .mid
//     now folds the PLAYED record through export/score.js scoreOf — the
//     .als's own fold, one fold two writers — so D4b compares the parsed
//     bytes against the played lanes: one track per SEAT plus the conductor,
//     every note at round(beat × TPQ), and two exports byte-identical.
//     The tom lanes still come out DISTINCT (t/m/l → GM 50/47/45) in D4a —
//     LANE_GM and writeSmf are untouched by the reversal.
// D5  the export row is honest: four cards, each button either live or
//     `disabled` beside a non-empty reason (.nu-why) — nothing greys
//     silently, nothing pretends. (Which cards are live is a roster that
//     moves: MP3 became a button on 2026-08-29 — see the note at the
//     assertion — and test/mp3.test.js is what tests its output.)
// D6  no page errors; no horizontal overflow at 390 or 1280; screenshots to
//     the wave directory.
//
// Run:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/deck.test.js

const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const URL_ = process.env.MOTIF_URL || "http://localhost:8777/nukernel/index.html";
const SHOTS = process.env.DECK_SHOTS || "/home/ford/.claude/jobs/c1b341cb/tmp/wave4";

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

/* OPEN A TAB THE WAY A THUMB DOES. `window.__eightTab` is ui/eight.js's own
   export for a gate — "a gate is a HAND, not a clock" — and it is the same
   call the tab button's click listener makes, so nothing here is a private
   door into the shell. The Score is given longer because opening it engraves
   the whole record on a promise the first time it is asked. */
async function openTabs(pg, names) {
  for (const n of names) {
    await pg.evaluate((t) => window.__eightTab && window.__eightTab(t), n);
    await pg.waitForTimeout(n === "Score" ? 1500 : 400);
  }
}

let FAILS = 0;
const ok = (m) => console.log("  ok   " + m);
const fail = (m) => { FAILS++; console.log("  FAIL " + m); };
const is = (cond, m) => (cond ? ok(m) : fail(m));

/* D7's reading, taken off the RENDERED page: the key line above the engraving
   and every voice name in the pinned gutter, each as viewport pixels and as
   text. "Readable" is asserted as both — a rect inside the window and a
   non-empty string — because either one alone passes for a label that is
   there and blank, or one that says a word off the left edge of the phone
   (which is exactly what the gutter did until 2026-08-27). */
async function identity(pg) {
  await pg.locator("#scoredeck .nu-ribbon").scrollIntoViewIfNeeded();
  await pg.waitForTimeout(200);
  return pg.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = (e) => {
      const b = e.getBoundingClientRect();
      return { text: (e.textContent || "").trim(),
               left: Math.round(b.left), right: Math.round(b.right),
               top: Math.round(b.top), bottom: Math.round(b.bottom),
               inside: b.left >= -1 && b.right <= vw + 1 &&
                       b.top >= -1 && b.bottom <= vh + 1 && b.width > 1 };
    };
    const kl = document.querySelector("#scoredeck .nu-keyline");
    const names = [...document.querySelectorAll(
      "#scoredeck .nu-gutter text.abcjs-voice-name")];
    const S = window.__eightScore();
    return { key: kl ? rect(kl) : null, names: names.map(rect),
             step: S.step, x: S.x, lit: S.lit, boxW: S.boxW, gut: S.gut,
             over: document.scrollingElement.scrollWidth - window.innerWidth };
  });
}
const readable = (r) => !!r && r.inside && r.text.length > 0;

(async () => {
  // ---- D4a (node): the tom fix lives in the export layer, proved on bytes --
  const smf = await import(pathToFileURL(path.join(__dirname, "..",
    "nukernel", "export", "smf.js")).href);
  {
    const SCOREHEAD = { k: "F", s: "c", p: "c", c: "c", t: "e", m: "d", l: "A",
                        h: "!style=x!g", o: "!style=x!g", f: "!style=x!D",
                        r: "!style=x!f", x: "!style=x!a" };   // ui/eight.js's table
    const dm = smf.headGM(SCOREHEAD);
    is(dm.e === 50 && dm.d === 47 && dm.A === 45,
      "D4a toms map DISTINCT in the export layer (e/d/A → " +
      [dm.e, dm.d, dm.A].join("/") + ", the engine's own fold says 47/47/47)");
    const bytes = smf.writeSmf({ bpm: 120, beatsPerBar: 4, stepsPerBar: 16,
      voices: [{ name: "kit", clef: "perc", notes: [
        { at: 0, len: 1, midi: "e" }, { at: 4, len: 1, midi: "d" },
        { at: 8, len: 1, midi: "A" }] }] }, { drumMap: dm });
    const p = smf.parseSmf(bytes);
    const keys = p.tracks[1].notes.map((n) => n.key);
    is(JSON.stringify(keys) === JSON.stringify([50, 47, 45]) &&
       p.tracks[1].notes.every((n) => n.ch === 9),
      "D4a parse-back: three toms are three GM keys on channel 10 (" +
      keys.join(",") + ")");
  }

  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: executable() });
  const errors = [];
  const page = await (await browser.newContext({
    viewport: { width: 1280, height: 900 } })).newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  /* THE BOX BOOTS ON THE BLANK STATE (2026-09-02). Paul, the composer round:
     *"Add a 'silence' genre at the top of the genre list. This is a blank
     state."* — one eight-bar section, ZERO voices, one cell of rests. This gate
     is about a record with a band in it, so it names one in the address, the way
     a link does: the shipped chant, at seed 1 because the boot draws a seed now
     (*"Boot up every new session with a new seed unless there's a seed in the
     URL"*) and a gate that re-rolled its own subject would measure a different
     record every run. */
  await page.goto(URL_ + CHANT, { waitUntil: "load", timeout: 60000 });
  /* THE DECK IS TWO TABS NOW (2026-08-27). Paul: *"Why don't we make tabs at
     the top level … The tabs are: Where / Tempo / Key / Motif / Band / Mix /
     Produce / Score / Export."* The notation and the roll are `Score`; the
     export row was promoted out of the deck to `Export`. The page boots on
     `Where`, and a panel is not built until it is first opened (mount on
     demand), so BOTH are opened here — Export first, so its four cards exist
     in the DOM for D5 to read, then Score, which is where every geometric
     assertion below is made. Measured before this line: the gate hung for 30s
     on `__eightScore().steps > 0` against a Score panel that had never been
     built. */
  await openTabs(page, ["Export", "Score"]);
  await page.waitForFunction(() => window.__deckState && window.__eightScore &&
    window.__eightScore().steps > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1000);

  // ---- D1 — the labels are extraction, not typing, AND they are per part ---
  const d1 = await page.evaluate(() => window.__deckState());
  is(d1.brackets.length > 0, "D1 · the staff carries motif labels (" +
    d1.brackets.length + ")");
  const alien = d1.brackets.filter((t) => !d1.cells.includes(t));
  is(alien.length === 0, "D1 · every label text IS a material.cells key (" +
    d1.brackets.join(", ") + " ⊆ " + d1.cells.join(", ") + ")" +
    (alien.length ? " — alien: " + alien.join(", ") : ""));
  // …and every one of them names the cell ITS OWN PART reads there. `reads`
  // is the page's own `cellAt` per voice per section (with the bass's
  // exception folded in, because a bass reads the first line's motif); a label
  // that does not equal it is a name declared and never arriving.
  const vnames = d1.reads.map((r) => r.voice);
  const wrong = d1.labels.filter((L) => {
    const r = d1.reads[vnames.indexOf(L.voice)];
    return !r || r.cells[L.si] !== L.text;
  });
  is(d1.labels.length > 0 && wrong.length === 0,
    "D1 · every label equals the cell THAT PART reads in THAT section (" +
    d1.labels.length + " labels over " + vnames.length + " parts)" +
    (wrong.length ? " — wrong: " + wrong.map((L) => L.voice + "@" + L.si +
      "=" + L.text).join(", ") : ""));
  // …and it is a cell that KIND of voice may read at all (avail.js cellsFor:
  // a grid is not a line, and a line cell under the kit would be a lie about
  // what the drummer can be handed)
  const badKind = d1.labels.filter((L) =>
    !(d1.cellsFor[vnames.indexOf(L.voice)] || []).includes(L.text));
  is(badKind.length === 0, "D1 · every label is a cell its voice's KIND can " +
    "read (avail.js cellsFor)" + (badKind.length ? " — " +
      badKind.map((L) => L.voice + "=" + L.text).join(", ") : ""));
  // …and it is drawn BELOW that part: in the gap between its own staff's
  // bottom line and the next staff's top line, which is what "below the
  // parts" means as geometry
  const misplaced = d1.labels.filter((L) => {
    const vi = vnames.indexOf(L.voice), st = d1.staves[vi];
    if (!st) return true;
    const below = vi + 1 < d1.staves.length ? d1.staves[vi + 1].top : Infinity;
    return !(L.top >= st.bottom && L.top + 12 <= below);
  });
  is(misplaced.length === 0, "D1 · every label hangs in the gap UNDER its own " +
    "staff (" + d1.labels.map((L) => L.voice + "@" + L.top).slice(0, 4).join(", ") +
    "…)" + (misplaced.length ? " — misplaced: " + misplaced.length : ""));

  // ---- D7 — the identity is in view (the key line + the pinned names) ------
  is(!!d1.keyline && d1.keyline.length > 4,
    "D7 · a key line stands above the engraving: \"" + d1.keyline + "\"");
  is(!!d1.gutter && d1.gutter.names.length === vnames.length &&
     d1.gutter.names.every((n) => n.text && n.text.trim()),
    "D7 · the pinned gutter carries every part name (" +
    (d1.gutter ? d1.gutter.names.map((n) => n.text).join(", ") : "none") +
    " for " + vnames.length + " parts)");
  is(!!d1.gutter && d1.gutter.clefs >= vnames.length &&
     d1.gutter.meters >= vnames.length,
    "D7 1280 · …and at this width the clef and the meter are pinned with them " +
    "(" + (d1.gutter ? d1.gutter.clefs + " clefs / " + d1.gutter.meters +
    " meters" : "none") + ") — they were dropped with the chunks until today");

  // ---- D5 — the export row wears true states -------------------------------
  const exps = d1.exports;
  /* FOUR FORMATS AND A LINK, 2026-08-27. This read `exps.length === 4` and the
     four it meant are named below by key — WAV, MIDI, MP3, Ableton — which is
     the claim that is actually load-bearing and which is asserted as such now.
     A fifth card joined them the same day, the share link ("a share link IS an
     export — it is the fourth thing you can take out of this box, beside the
     WAV, the MIDI and the (refused) MP3, and it is the only one of the four
     that costs nothing to make", ui/eight.js `shareCard`), so a bare count was
     going to read as a defect the first time somebody added a way out of the
     box. The rule the count was standing in for is the one below it and is
     unchanged: EVERY card is either live or refused with a reason. */
  const FORMATS = ["deck.exp.wav", "deck.exp.mid", "deck.exp.mp3", "deck.exp.als"];
  const keys = exps.map((e) => e.k);
  is(FORMATS.every((k) => keys.includes(k)),
    "D5 · the four format cards are all drawn — " + JSON.stringify(FORMATS) +
    " in " + JSON.stringify(keys));
  is(keys.includes("deck.exp.copy"),
    "D5 · …and the share link is the fifth card (" + exps.length + " in all)");
  for (const e of exps) {
    const honest = e.label && (!e.disabled || (e.why && e.why.length > 20));
    is(honest, "D5 · " + (e.k || "?") + " " +
      (e.disabled ? "refused with its reason: \"" + (e.why || "").slice(0, 60) + "…\""
                  : "live (\"" + e.label + "\")"));
  }
  /* MP3 CROSSED THE LINE, 2026-08-29. This pair read "WAV and MIDI are LIVE
     buttons" / "MP3 and Ableton are refusals, not dead controls", and the
     second half of that is no longer true: export/mp3.js encodes the press
     with the vendored lamejs in a worker, so the card is a button. The rule
     the assertion was standing for is untouched and is the loop above —
     every card is either live or refused with a reason. Only the roster of
     which is which moved, and it moves again the day the Ableton splice
     lands. What the MP3 button actually PRODUCES is not this gate's business
     and never was: test/mp3.test.js clicks it, catches the download and
     decodes those bytes back. */
  /* ...AND ABLETON CROSSED IT THE SAME DAY, later the same day. The line
     above said "it moves again the day the Ableton splice lands", and this is
     that day: the pair below read "WAV, MIDI and MP3 are LIVE buttons" /
     "Ableton is a refusal, not a dead control", and the second half is gone
     because the refusal is. export/als-page.js splices the donor IN THE PAGE
     — nukernel/export/donor.js carries it in the module graph, nothing is
     fetched — so all four format cards are buttons and there is no refusal
     left in this row to assert. The rule these assertions stand for is
     untouched and is still the loop above: every card is either live or
     refused with a reason. What the .als button actually PRODUCES is not this
     gate's business, exactly as with the MP3: test/als-page.browser.js clicks
     it, catches the download, un-gzips it and holds the bytes to
     tools/ableton/als-gate.js. */
  is(FORMATS.every((k) => !exps.find((e) => e.k === k).disabled),
    "D5 · all four format cards are LIVE buttons — " + JSON.stringify(FORMATS));

  // ---- D6 — geometry + shots ----------------------------------------------
  fs.mkdirSync(SHOTS, { recursive: true });
  const over1280 = await page.evaluate(() =>
    document.scrollingElement.scrollWidth - window.innerWidth);
  is(over1280 <= 1, "D6 · no horizontal overflow at 1280 (" + over1280 + "px)");
  await page.locator("#scoredeck").screenshot({
    path: path.join(SHOTS, "deck-notation-1280.png") });
  await page.evaluate(() => window.__deckView("roll"));
  await page.waitForTimeout(300);
  await page.locator("#scoredeck").screenshot({
    path: path.join(SHOTS, "deck-roll-1280.png") });
  await page.evaluate(() => window.__deckView("not"));

  // ---- D2 — one clock, two views, and only [data-live] moves ---------------
  await page.click("#play");
  const started = await page.waitForFunction(() =>
    // THE PLAY BUTTON IS A MARK SINCE 2026-08-28 (▶ / ■) and its WORD is its
    // `aria-label` — still "the next tap", still written by `say()` alone.
    document.getElementById("play").getAttribute("aria-label") === "stop" &&
    window.__eightScore().step > 0.5, null, { timeout: 45000 })
    .then(() => true).catch(() => false);
  is(started, "D2 · the record started (the deck's clock is running)");
  if (started) {
    const s1 = await page.evaluate(() => window.__eightScore().step);
    await page.evaluate(() => window.__deckView("roll"));
    await page.waitForTimeout(700);
    const s2 = await page.evaluate(() => ({ step: window.__eightScore().step,
      view: window.__deckState().view }));
    await page.evaluate(() => window.__deckView("not"));
    await page.waitForTimeout(700);
    const s3 = await page.evaluate(() => ({ step: window.__eightScore().step,
      view: window.__deckState().view }));
    is(s2.view === "roll" && s3.view === "not",
      "D2 · the tab actually flips (roll → notation)");
    is(s2.step > s1 && s3.step > s2.step,
      "D2 · the clock never lost the place across two flips (" +
      s1.toFixed(1) + " → " + s2.step.toFixed(1) + " → " + s3.step.toFixed(1) + ")");
    // the frozen half of the DECK: with the roll up, watch every mutation for
    // 2.5s of playback — each must land inside a [data-live] subtree
    await page.evaluate(() => window.__deckView("roll"));
    const stray = await page.evaluate(async () => {
      const root = document.getElementById("scoredeck");
      const bad = [];
      const inLive = (n) => {
        for (let e = n; e && e !== root; e = e.parentNode)
          if (e.dataset && e.dataset.live != null) return true;
        return false;
      };
      const mo = new MutationObserver((muts) => {
        for (const m of muts) if (!inLive(m.target))
          bad.push(m.type + ":" + (m.target.className || m.target.nodeName));
      });
      mo.observe(root, { subtree: true, childList: true, attributes: true,
                         characterData: true });
      await new Promise((r) => setTimeout(r, 2500));
      mo.disconnect();
      return bad.slice(0, 5);
    });
    is(stray.length === 0, "D2 · playback mutates the deck ONLY inside " +
      "[data-live] (" + (stray.length ? stray.join(", ") : "0 strays") + ")");
    await page.screenshot({ path: path.join(SHOTS, "deck-roll-playing-1280.png"),
      clip: await page.locator("#scoredeck").boundingBox() });
    await page.evaluate(() => window.__deckView("not"));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, "deck-notation-playing-1280.png"),
      clip: await page.locator("#scoredeck").boundingBox() });

    /* ---- D7 at BAR 8 — the paper has run away and the identity has not ----
       The engraved score is the ONE lawful horizontal scroller on this page
       and it is scrolled by the CLOCK, so "scroll the paper to bar 8" is said
       the only way this surface can say it: let the record play there. Bar 8
       is step 128 (sixteen steps to the measure, SCORE_SPB), by which point
       the picture has moved better than a box and a half — everything the
       first system stated has left the screen, which is precisely the moment
       Paul could not tell what he was looking at. */
    const gotTo8 = await page.waitForFunction(
      () => window.__eightScore().step >= 128, null, { timeout: 120000 })
      .then(() => true).catch(() => false);
    is(gotTo8, "D7 1280 · the record reached bar 8 (the paper scrolled away)");
    const at8 = await identity(page);
    /* WHAT "THE PAPER HAS RUN AWAY" MEANS, AND IT IS NOT A BOX WIDTH. The
       engraving is spaced by the MUSIC, not by the window, so a wide screen
       holds more bars and scrolls fewer pixels to reach bar 8 (measured
       2026-08-27: 552px at 390, 179px at 1280). What has to be true for the
       ask is the same at both: the record's OWN opening statement — the names
       and clef abcjs drew once, at the head of the one system — has gone past
       the left edge, so everything still legible there is legible because it
       was PINNED. That is `x > gut`. */
    is(at8.x > at8.gut, "D7 1280 · …and the engraving's own margin has left " +
      "the box: " + Math.round(at8.x) + "px of scroll past a " + at8.gut +
      "px gutter (box " + at8.boxW + "px)");
    is(readable(at8.key), "D7 1280 · the key line is still readable at bar 8: " +
      "\"" + (at8.key ? at8.key.text : "") + "\"");
    is(at8.names.length > 0 && at8.names.every(readable),
      "D7 1280 · every part name is still readable at bar 8 (" +
      at8.names.map((n) => n.text + " @" + n.left + "-" + n.right).join(", ") + ")");
    is(at8.lit > 0, "D7 1280 · …and the clock is still inking sounding notes " +
      "red while it does (" + at8.lit + " lit)");
    is(at8.over <= 1, "D7 1280 · no page-level horizontal scroll at bar 8 (" +
      at8.over + "px) — only the paper's own rail");
    await page.locator("#scoredeck .nu-ribbon").screenshot({
      path: path.join(SHOTS, "score-bar8-1280.png") });
  }
  await page.click("#play");   // stop — the presses below get the whole CPU
  await page.waitForTimeout(800);

  // ---- D4b — the .mid, parsed back against the PLAYED record ---------------
  /* REVERSAL, 2026-08-30 (see D4 in the header): this block compared the
     bytes to the NOTATED fold — `r.score` was buildScore()'s voices and the
     gate re-quantized "ticks per score step". The probe hands the PLAYED
     lanes now (export/score.js scoreOf, absolute quarter-note beats, GM keys
     resolved), so the equality is against the timeline the speakers play:
     one track per seat, every note at round(beat × TPQ). D4c below is the
     determinism half — two exports, byte-identical. */
  const d4 = await page.evaluate(async () => {
    const r = await window.__deckSmf();
    if (!r) return null;
    const TPQ = r.parsed.division;
    const rank = (n) => (n === "drums" ? 2 : n === "bass" ? 1 : 0);
    const names = Object.keys(r.lanes)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    const want = [], got = [];
    names.forEach((nm, i) => {
      for (const n of r.lanes[nm])
        for (const m of (Array.isArray(n.midi) ? n.midi : [n.midi]))
          want.push((i + 1) + "@" + Math.round(n.beat * TPQ) + ":" +
                    Math.max(0, Math.min(127, m | 0)));
      for (const n of r.parsed.tracks[i + 1].notes)
        got.push((i + 1) + "@" + n.tick + ":" + n.key);
    });
    want.sort(); got.sort();
    let firstDiff = null;
    for (let i = 0; i < Math.max(want.length, got.length); i++)
      if (want[i] !== got[i]) { firstDiff = (want[i] || "∅") + " vs " + (got[i] || "∅"); break; }
    // the timing subtleties the reversal exists for: onsets OFF the old
    // sixteenth-step grid (TPQ/4 ticks), counted so the report can show them
    const offGrid = r.parsed.tracks.slice(1).reduce((s, t) =>
      s + t.notes.filter((n) => n.tick % (TPQ / 4) !== 0).length, 0);
    return { n: r.parsed.tracks.length, nv: names.length,
             want: want.length, got: got.length, firstDiff, offGrid,
             tempo: r.parsed.tracks[0].tempo, bytes: r.bytes.length };
  });
  is(!!d4, "D4b · the page folded the played record to a .mid (" + (d4 ? d4.bytes : 0) + " bytes)");
  if (d4) {
    is(d4.n === d4.nv + 1, "D4b · SMF type 1, one track per seat + conductor (" +
      d4.n + " tracks for " + d4.nv + " seats)");
    is(d4.want === d4.got && !d4.firstDiff,
      "D4b · parse-back equality against the PLAYED fold: " + d4.got +
      " notes, every tick at round(beat × TPQ)" +
      (d4.firstDiff ? " — first diff " + d4.firstDiff : "") +
      " (" + d4.offGrid + " off the old step grid)");
    is(d4.tempo != null, "D4b · the conductor track carries the record's tempo");
  }
  // ---- D4c — the .mid is deterministic: two exports, byte-identical --------
  const d4c = await page.evaluate(async () => {
    const a = await window.__deckSmf(), b = await window.__deckSmf();
    if (!a || !b) return null;
    return { same: a.bytes.length === b.bytes.length &&
                   a.bytes.every((x, i) => x === b.bytes[i]),
             len: a.bytes.length };
  });
  is(!!d4c && d4c.same, "D4c · two .mid exports are byte-identical (" +
    (d4c ? d4c.len : 0) + " bytes)");

  // ---- D3 — the WAV press: bytes, duration, determinism --------------------
  console.log("     pressing the record twice (this renders the whole song, offline)…");
  const w1 = await page.evaluate(() => window.__deckPressWav()
    .catch((e) => ({ err: String((e && e.message) || e) })));
  const w2 = await page.evaluate(() => window.__deckPressWav()
    .catch((e) => ({ err: String((e && e.message) || e) })));
  is(!w1.err && !w2.err, "D3 · both presses completed" +
    (w1.err || w2.err ? " — " + (w1.err || w2.err) : ""));
  if (!w1.err && !w2.err) {
    is(w1.head.riff === "RIFF" && w1.head.wave === "WAVE" && w1.head.fmt === 1 &&
       w1.head.ch === 2 && w1.head.sr === 44100 && w1.head.bits === 16,
      "D3 · the bytes decode: canonical 44.1 kHz / 16-bit / stereo PCM");
    is(w1.rms > 0.01, "D3 · the render is not silence (RMS " + w1.rms + ")");
    is(Math.abs(w1.durSec - w1.songSec) < 0.1,
      "D3 · duration matches the score (" + w1.durSec + "s vs " +
      w1.songSec + "s of score)");
    is(w1.sha === w2.sha, "D3 · BYTE-DETERMINISTIC across two presses (sha " +
      w1.sha.slice(0, 16) + "…)");
  }

  is(errors.length === 0, "  · no page errors (" + errors.slice(0, 3).join(" | ") + ")");
  await page.close();

  // ---- 390: the deck exists on a phone and nothing scrolls sideways --------
  const p390 = await (await browser.newContext({
    viewport: { width: 390, height: 844 } })).newPage();
  p390.on("pageerror", (e) => errors.push("390: " + String(e).slice(0, 160)));
  await p390.goto(URL_ + CHANT, { waitUntil: "load", timeout: 60000 });
  await openTabs(p390, ["Export", "Score"]);
  await p390.waitForFunction(() => window.__deckState && window.__eightScore &&
    window.__eightScore().steps > 0, null, { timeout: 30000 });
  await p390.waitForTimeout(1200);
  const m = await p390.evaluate(() => ({
    over: document.scrollingElement.scrollWidth - window.innerWidth,
    brackets: window.__deckState().brackets.length,
  }));
  is(m.over <= 1, "D6 390 · no horizontal overflow (" + m.over + "px)");
  is(m.brackets > 0, "D6 390 · the motif labels survive the phone (" + m.brackets + ")");

  /* ---- D7 at 390 — the phone, which is where the ask came from -----------
     Stopped first (the identity has to be right before the paper moves), then
     at bar 8. THE TRADE IS PRINTED rather than asserted at a number: what the
     pinned gutter costs the paper is a fact about this record at this width,
     and a gate that froze it would fail on the next record. What is ASSERTED
     is the thing Paul asked for — that the instrument and the key are still
     on the screen when the music is nine bars away from where it started. */
  const s390 = await p390.evaluate(() => window.__deckState());
  const i390 = await identity(p390);
  is(readable(i390.key), "D7 390 · the key line stands above the score: \"" +
    (i390.key ? i390.key.text : "") + "\"");
  is(i390.names.length === s390.reads.length && i390.names.every(readable),
    "D7 390 · every part name is pinned and legible (" +
    i390.names.map((n) => n.text).join(", ") + ")");
  console.log("     390 · the gutter takes " + (s390.gutter ? s390.gutter.w : 0) +
    "px of a " + i390.boxW + "px box for the part names");
  await p390.locator("#scoredeck .nu-ribbon").screenshot({
    path: path.join(SHOTS, "score-390.png") });
  await p390.click("#play");
  const got390 = await p390.waitForFunction(
    () => window.__eightScore().step >= 128, null, { timeout: 120000 })
    .then(() => true).catch(() => false);
  is(got390, "D7 390 · the record reached bar 8 on the phone");
  const a390 = await identity(p390);
  is(a390.x > a390.gut, "D7 390 · the paper ran " + Math.round(a390.x) +
    "px, past a " + a390.gut + "px gutter in a " + a390.boxW + "px box");
  is(readable(a390.key) && a390.names.length && a390.names.every(readable),
    "D7 390 · key line AND every part name still readable at bar 8 (" +
    (a390.key ? a390.key.text : "") + " | " +
    a390.names.map((n) => n.text + " @" + n.left + "-" + n.right).join(", ") + ")");
  is(a390.lit > 0, "D7 390 · the clock is still inking sounding notes red (" +
    a390.lit + " lit)");
  is(a390.over <= 1, "D7 390 · no page-level horizontal scroll at bar 8 (" +
    a390.over + "px)");
  await p390.locator("#scoredeck .nu-ribbon").screenshot({
    path: path.join(SHOTS, "score-bar8-390.png") });
  await p390.click("#play");
  await p390.waitForTimeout(400);
  await p390.locator("#scoredeck").screenshot({
    path: path.join(SHOTS, "deck-notation-390.png") });
  await p390.evaluate(() => window.__deckView("roll"));
  await p390.waitForTimeout(300);
  await p390.locator("#scoredeck").screenshot({
    path: path.join(SHOTS, "deck-roll-390.png") });
  await p390.close();

  await browser.close();
  console.log(FAILS ? "\n" + FAILS + " failed" : "\nall checks pass");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
