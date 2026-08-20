#!/usr/bin/env node
// test/unit/nukernel.test.js — the nukernel gate.
//
//   node test/unit/nukernel.test.js
//
// This suite exists because of what actually went wrong. Three defects shipped
// and every check passed, because the checks asked "does this function run"
// rather than "does this input reach the output":
//
//   * the ghost-percussion layer could never fire, for any operator, because
//     accents are a subset of gates by construction and whole-pattern operators
//     preserve that containment;
//   * the `oct` vector was a no-op in all four genres — fold() ran AFTER the
//     octave was added and put every leap back where it started;
//   * `nudge` was clamped to the genre's own bar count as if it were a phase.
//
// The first two are INVISIBLE to per-function unit tests. rotate() rotates
// correctly in both; the bug is that the value never reaches the rendered
// events. So the centre of gravity here is SENSITIVITY — for every vector and
// every knob, perturbing it must change what comes out — plus the algebraic
// laws that make the operator set a group rather than a pile of functions.
"use strict";
const K = require("../../nukernel/kernel.js");
const { DEFAULT, GENRES, MODES, SCALES, FAMILIES } = require("../../nukernel/genres.js");

const GK = Object.keys(GENRES);

// FAST CORE (default) vs EXHAUSTIVE SWEEP (`--sweep`). Paul: "do you really
// need to pass 481,687 tests" — no. That number is a cross-product (110
// genres x seeds x bars), not 481,687 distinct laws — the file holds 1,270
// WRITTEN assertions — and two sections alone (the composer's own round trip,
// the songwriter's census) cost 127 of this file's ~250 seconds by asking the
// SAME question 110 times over instead of once. GK_SAMPLE is one genre per
// mechanism this suite has ever caught a real bug through — a family from
// each cluster in genres.js FAMILIES, every drum machine, the corpus-table
// genre, the singer cast, the FUNCTION genres (a role rather than a style),
// and hymn (the register fold's own worst case, printed at the bottom of
// every run) — so every LAW below still gets proved, just once instead of
// 110 times. `atLeast` carries the other half of that same idea for a
// handful of checks that are not laws but CENSUS SIZE claims ("the sweep saw
// over 100,000 notes — it is not sweeping"): the floor only means anything
// against the full cross-product, so it is asserted in SWEEP and relaxed to
// "non-zero" in FAST, which still catches the sweep going dead without
// flagging a smaller sample as a regression.
//
// A few checks are not laws or census claims but WALKS whose whole job IS
// the breadth, and stay on GK_FULL in BOTH modes, named explicitly at their
// own loop rather than folded into this switch: the byte-identity tripwires
// (this file's own history: "exactly 84 rows moved" when the singer came
// out, "the ride stopped carrying a stroke") and the coverage walks that
// catch a genre throwing on write (a rotted PLAN_OF/BPM row, a synth id
// naming no built dsp, a singer nobody armed) — sampling either one defeats
// its entire purpose, which is that no genre can hide behind the ones not
// drawn.
const SWEEP = process.argv.includes("--sweep");
const GK_FULL = GK.slice();
const GK_SAMPLE = [
  "simple",                                    // kernel: the zero, one bar
  "fugue", "gregorian", "bulgarian", "hymn",   // vox: modal harmony, choir cast, the register fold's worst case
  "acid", "boombap", "dnb", "trap",            // club: tr909/tr808, a sampled kit, a drum phrase
  "jazz",                                      // roots: reharm, the mined corpus tables, swing
  "reggae", "ska",                             // groove: offbeat, echo pipes; ska's horn is the register law's own adversarial case
  "motown", "isley",                           // soul: walks in on the bass, by tradition
  "beatles", "kraftwerk",                      // studio: singer cast over a full band, a motorik ostinato
  "rock",                                      // band: the plain four-on-the-floor backbeat
  "drone",                                     // drift: the STEADY dedup exemption lives here
  "solo", "vocal", "backing", "riff", "pad",   // parts: the FUNCTION genres — a role, not a style, each its own shape
];
if (!SWEEP) { GK.length = 0; GK.push(...GK_SAMPLE); }
// seed counts below were sized for the full sweep (16-40 deep, to catch a
// seed-rare pattern); a fast run keeps the same law on far fewer draws.
// `floor` lifts the fast-mode draw count for a law that is a COIN FLIP
// rather than a per-seed fact ("the key lift is drawn sometimes, not never
// or always") — three draws cannot tell a coin from a constant, so those
// specific call sites pass a floor sized to their own tolerance rather than
// widening every seed loop in the file.
const seedCount = (n, floor = 3) => SWEEP ? n : Math.min(n, floor);
const atLeast = (n, floorFull) => SWEEP ? n > floorFull : n > 0;

// (a --calibrate-sing mode lived here: the recipe that measured the espeak
// pitch ladders baked into nukernel/sing.js, 1260 utterances for nine singers.
// nukernel's singer came out on 2026-08-17 — nukernel/kernel-daw.html carries
// the tombstone and the reason — so there are no ladders left to calibrate.
// The PARENT's speech organ is untouched: engine/speech.js still sings on
// stellate.app, gated by test/gates/speech.test.js.)

// ---- node test/unit/nukernel.test.js --arrange-dom --------------------------
// NOT PART OF THE PURE-NODE GATE — §57, lane D1's own check ("a section is one
// shaded thing with its keys on top and no words anywhere", 2026-08-17).
// Guarded and early-returning exactly like --calibrate-sing just above, for
// the same reason: this file is otherwise pure node and CI-safe (no browser,
// no network), and `npm run test:unit` counts on that. It lives up here,
// beside the other flagged alternate mode, rather than after the pure-node
// sections' own process.exit(0) — code placed after that call would never
// run, flag or no flag, so this is the one place in the file a guard can
// actually intercept the flow before it.
//
// WHY A REAL BROWSER FOR THIS ONE: songrow.js's rebuild is real DOM (SVG
// icons, nested flexbox, a :has() selection ring, position:sticky) that a
// hand-rolled stub could get subtly wrong in ways that would pass against
// themselves rather than against the shipped file — exactly the mirror-drift
// §31's own header warns about. One chromium session proves structure,
// wiring and the rendered CSS together (VERIFICATION BUDGET: at most once),
// which is also cheaper than a stub plus a separate screenshot pass.
if (process.argv.includes("--arrange-dom")) {
  (async () => {
    const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
    const path = require("path");
    const ROOT = path.join(__dirname, "..", "..");
    let fails57 = 0, checks57 = 0;
    const ok57 = (cond, msg) => {
      checks57++;
      if (cond) console.log("  ok: " + msg);
      else { fails57++; console.error("  FAIL: " + msg); }
    };

    const srv = await serve(ROOT, 8975);
    const browser = await launchChromium();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = capturePageErrors(page);
    await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce`,
      { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
    await page.reload({ waitUntil: "networkidle" });
    // a composed multi-section song — the recipe the retired board gate used
    // uses — so there is more than one box and more than one phrase to test against.
    await page.selectOption("#composeg", "beatles");
    await page.click("#compose");
    await page.waitForTimeout(600);

    const box0 = () => page.$("#song .bgrp:first-child .box");
    const grp0 = "#song .bgrp:first-child";

    // ---- (a) THE ROW STRUCTURE, at 390 and at 1400 ----
    // the exact order Paul drew it: # · genre · section type · duplicate ·
    // add-empty-below · play · pin, then bars · mods · voice · rhythm · trans.
    const order = () => page.evaluate((sel) => {
      const grp = document.querySelector(sel);
      const head = [...grp.querySelector(".bhead").children].map(c =>
        c.dataset.cell || (c.className.match(/\bbi(dup|add|play|pin)\b/) || [null, "?"])[1]);
      const icons = [...grp.querySelector(".bicons").children].map(c => c.dataset.cell);
      return { head, icons };
    }, grp0);
    const wantHead = ["part", "genre", "role", "dup", "add", "play", "pin"];
    const wantIcons = ["bars", "mods", "voice", "rhythm", "trans"];
    const o390 = await order();
    ok57(JSON.stringify(o390.head) === JSON.stringify(wantHead),
      "§57(a) header cells at 390px: " + JSON.stringify(o390.head));
    ok57(JSON.stringify(o390.icons) === JSON.stringify(wantIcons),
      "§57(a) icon cells at 390px: " + JSON.stringify(o390.icons));
    await page.setViewportSize({ width: 1400, height: 1000 });
    const o1400 = await order();
    ok57(JSON.stringify(o1400.head) === JSON.stringify(wantHead),
      "§57(a) header cells at 1400px: " + JSON.stringify(o1400.head));
    ok57(JSON.stringify(o1400.icons) === JSON.stringify(wantIcons),
      "§57(a) icon cells at 1400px: " + JSON.stringify(o1400.icons));
    await page.setViewportSize({ width: 390, height: 844 });

    // ---- (b) PIN WORKS, both directions ----
    await (await box0()).$eval(".bicon.bipin", b => b.click());
    let pinned = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      return { boxOn: g.querySelector(".box").classList.contains("looped"),
               keyOn: g.querySelector(".bicon.bipin").classList.contains("on") };
    }, grp0);
    ok57(pinned.boxOn && pinned.keyOn, "§57(b) pinning box 1 did not light the row or the key");
    await (await box0()).$eval(".bicon.bipin", b => b.click());
    pinned = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      return { boxOn: g.querySelector(".box").classList.contains("looped"),
               keyOn: g.querySelector(".bicon.bipin").classList.contains("on") };
    }, grp0);
    ok57(!pinned.boxOn && !pinned.keyOn, "§57(b) unpinning box 1 left the row or the key lit");

    // ---- (c) PLAY WORKS ----
    await (await box0()).$eval(".bicon.biplay", b => b.click());
    await page.waitForFunction(() =>
      document.querySelector("#play").classList.contains("on"), null, { timeout: 8000 })
      .then(() => ok57(true, "§57(c) the header play key started the transport"))
      .catch(() => ok57(false, "§57(c) the header play key never started the transport"));
    await page.click("#play");                  // stop, so the screenshot is quiet
    await page.waitForTimeout(150);

    // ---- (d) ADD-EMPTY-BELOW INSERTS UNDER, AND FLAGS RED (the C1 law) ----
    const before = await page.evaluate(() => document.querySelectorAll("#song .bgrp").length);
    await (await box0()).$eval(".bicon.biadd", b => b.click());
    const after57 = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#song .bgrp")];
      const second = rows[1].querySelector(".box");
      return { count: rows.length, silent: second.classList.contains("noplay"),
               chips: second.querySelectorAll(".bch:not(.bplus)").length };
    });
    ok57(after57.count === before + 1,
      "§57(d) add-empty-below changed the song by " + (after57.count - before) + " boxes, not 1");
    ok57(after57.silent && after57.chips === 0,
      "§57(d) the new empty section did not flag red / had " + after57.chips + " phrases");
    // leave it in place — it is harmless to every check below (they all
    // address box 1 by name, and (f) wants a second, DIFFERENT box to prove
    // the ring moves, which this one serves as well as any) — deselect it
    // rather than deleting it, so the checks below are not also exercising
    // the # cell's delete key
    await page.evaluate(() => document.querySelectorAll("#song .bgrp")[1]
      .querySelector(".box").dispatchEvent(new MouseEvent("click", { bubbles: true })));

    // ---- (e) DISMISS TAKES ONLY ITS OWN PHRASE; THE BODY STILL OPENS COMPOSE ----
    // guarantee at least two phrases on box 1's strip before testing removal
    let n = await page.evaluate(sel =>
      document.querySelector(sel).querySelectorAll(".bch:not(.bplus)").length, grp0);
    while (n < 2) {
      await (await box0()).$eval(".bch.bplus", b => b.click());
      await page.click(".bbknew");
      await page.waitForTimeout(200);
      await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce#/song/0`,
        { waitUntil: "networkidle" });
      n = await page.evaluate(sel =>
        document.querySelector(sel).querySelectorAll(".bch:not(.bplus)").length, grp0);
    }
    const dismissedId = await page.evaluate(sel =>
      document.querySelector(sel).querySelector(".bchw .bch b.bcn").textContent, grp0);
    await (await box0()).$eval(".bchw .bcx", b => b.click());
    const afterDismiss = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      return { count: g.querySelectorAll(".bch:not(.bplus)").length,
               ids: [...g.querySelectorAll(".bch:not(.bplus) b.bcn")].map(e => e.textContent),
               page: document.querySelector("#chassis").dataset.page };
    }, grp0);
    ok57(afterDismiss.count === n - 1,
      "§57(e) the dismiss badge removed " + (n - afterDismiss.count) + " phrases, not 1");
    ok57(!afterDismiss.ids.includes(dismissedId),
      "§57(e) phrase " + dismissedId + " is still on the strip after its own dismiss");
    ok57(afterDismiss.page === "song",
      "§57(e) tapping the dismiss badge navigated away from Arrange");
    await (await box0()).$eval(".bchw .bch", b => b.click());
    const navved = await page.evaluate(() => document.querySelector("#chassis").dataset.page);
    ok57(navved === "compose", "§57(e) tapping a thumbnail's body did not open Compose");
    await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce#/song/0`,
      { waitUntil: "networkidle" });

    // ---- (f) SELECTION IS THE WHOLE SECTION, SHADED AND BORDERED AS ONE ----
    await page.evaluate(sel => document.querySelector(sel)
      .dispatchEvent(new MouseEvent("click", { bubbles: true })), grp0 + " .box");
    const sel1 = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      const cs = getComputedStyle(g);
      return { shadow: cs.boxShadow, bg: cs.backgroundColor };
    }, grp0);
    ok57(sel1.shadow !== "none", "§57(f) the selected section's rowgroup carries no ring");
    const grp1 = "#song .bgrp:nth-child(2)";
    await page.evaluate(sel => document.querySelector(sel)
      .dispatchEvent(new MouseEvent("click", { bubbles: true })), grp1 + " .box");
    const sel0after = await page.evaluate(sel =>
      getComputedStyle(document.querySelector(sel)).boxShadow, grp0);
    const sel1now = await page.evaluate(sel =>
      getComputedStyle(document.querySelector(sel)).boxShadow, grp1);
    ok57(sel0after === "none" && sel1now !== "none",
      "§57(f) the ring did not move with selection (was " + sel0after + " / " + sel1now + ")");

    // ---- (g) NO PANEL CONTAINS A PARAGRAPH OF PROSE ----
    for (const cell of ["mods", "voice", "trans"]) {
      await page.evaluate(sel => document.querySelector(sel)
        .dispatchEvent(new MouseEvent("click", { bubbles: true })), grp0 + " .box");
      await page.click(grp0 + " .bcell.c-" + cell);
      await page.waitForTimeout(80);
      const ps = await page.evaluate(() =>
        document.querySelectorAll("#rowpop .rpmount p").length);
      ok57(ps === 0, "§57(g) the " + cell + " panel still carries " + ps + " paragraph(s)");
    }

    // ---- (h) THE SHRINK KEY STAYS VISIBLE WHILE SCROLLING A LONG PANEL ----
    // position:sticky does not freeze the header at its OPENING position — it
    // holds a fixed offset once you scroll PAST that point. So the real proof
    // is that two DIFFERENT scroll depths land the header at the SAME spot
    // (stuck), not that it never moved from wherever it opened.
    await page.click(grp0 + " .bcell.c-genre");     // the chronological bank: the long one
    await page.waitForTimeout(120);
    await page.evaluate(() => document.querySelector(".deck").scrollBy(0, 600));
    await page.waitForTimeout(80);
    const stuckAt600 = await page.evaluate(() =>
      document.querySelector("#rowpop .rphead").getBoundingClientRect().top);
    await page.evaluate(() => document.querySelector(".deck").scrollBy(0, 400));
    await page.waitForTimeout(80);
    const stuckAt1000 = await page.evaluate(() =>
      document.querySelector("#rowpop .rphead").getBoundingClientRect().top);
    ok57(Math.abs(stuckAt1000 - stuckAt600) < 2,
      "§57(h) the panel header kept scrolling (" + stuckAt600 + " -> " + stuckAt1000 +
      ") instead of holding its stuck position");
    const shrinkVisible = await page.evaluate(() => {
      const r = document.querySelector("#rowpop .rpx").getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    });
    ok57(shrinkVisible, "§57(h) the shrink key scrolled out of the viewport");
    await page.click("#rowpop .rpx");

    // ---- the one screenshot ----
    await page.evaluate(() => document.querySelector(".deck").scrollTo(0, 0));
    await page.screenshot({
      path: "/home/ford/.claude/jobs/c1b341cb/tmp/arrange-390.png" });

    ok57(errs.length === 0, "§57 page errors: " + JSON.stringify(errs));
    await browser.close();
    srv.close();
    console.log("\n§57 arrange-dom: " + (checks57 - fails57) + "/" + checks57 + " checks pass");
    process.exit(fails57 ? 1 : 0);
  })().catch(e => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
  return;
}

// ---- node test/unit/nukernel.test.js --transport-dom ------------------------
// NOT PART OF THE PURE-NODE GATE — §58, lane B2's own check ("the transport is
// one row of keys, and under it the song says where it is", 2026-08-17).
// Guarded and early-returning exactly like --arrange-dom just above, for the
// same reason: this file is otherwise pure node and CI-safe, and a real
// chromium session is the only honest way to prove a flex row DOESN'T wrap —
// a hand-rolled layout stub could get that subtly wrong in a way that would
// pass against itself rather than against the shipped CSS.
if (process.argv.includes("--transport-dom")) {
  (async () => {
    const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
    const path = require("path");
    const ROOT = path.join(__dirname, "..", "..");
    let fails58 = 0, checks58 = 0;
    const ok58 = (cond, msg) => {
      checks58++;
      if (cond) console.log("  ok: " + msg);
      else { fails58++; console.error("  FAIL: " + msg); }
    };

    const srv = await serve(ROOT, 8976);
    const browser = await launchChromium();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = capturePageErrors(page);
    await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce`,
      { waitUntil: "networkidle" });

    // ---- (a) ONE ROW, at 390 and at 1400 ----
    // every child of .trow shares one bounding-box top — a flex row that
    // wrapped would split its children across two different tops instead.
    const oneRow = () => page.evaluate(() => {
      const kids = [...document.querySelector(".trow").children];
      const tops = kids.map(k => Math.round(k.getBoundingClientRect().top));
      return { tops, one: new Set(tops).size === 1 };
    });
    const r390 = await oneRow();
    ok58(r390.one, "§58(a) the transport wraps at 390px — tops: " + JSON.stringify(r390.tops));
    await page.setViewportSize({ width: 1400, height: 1000 });
    const r1400 = await oneRow();
    ok58(r1400.one, "§58(a) the transport wraps at 1400px — tops: " + JSON.stringify(r1400.tops));
    await page.setViewportSize({ width: 390, height: 844 });

    // ---- (b) THE LOOP TOGGLE DEFAULTS ON ----
    const loopDefault = await page.evaluate(() => document.getElementById("loop").getAttribute("aria-pressed"));
    ok58(loopDefault === "true", '§58(b) the loop toggle did not default to aria-pressed="true": ' + loopDefault);

    // ---- (c) EVERY CONTROL HAS AN ACCESSIBLE NAME ----
    const names = await page.evaluate(() => {
      const named = id => {
        const el = document.getElementById(id);
        return (el.getAttribute("aria-label") || "").trim();
      };
      const labelled = (forId) => {
        const l = document.querySelector(`label[for="${forId}"]`);
        return l ? l.textContent.trim() : "";
      };
      return {
        play: named("play"), compose: named("compose"), loop: named("loop"),
        reroll: named("reroll"), composeg: named("composeg"),
        bpm: labelled("bpm"), vol: labelled("vol"),
      };
    });
    for (const k of Object.keys(names))
      ok58(!!names[k], `§58(c) "${k}" accessible name: ${JSON.stringify(names[k])}`);

    // ---- (d) THE POSITION ROW: root genre / position / section, no ▶ ----
    await page.selectOption("#composeg", "rock");
    await page.click("#compose");
    await page.waitForTimeout(400);
    await page.click("#play");
    await page.waitForFunction(() =>
      document.getElementById("lcdpos").textContent !== "--", null, { timeout: 8000 })
      .then(() => ok58(true, "§58(d) the transport started and the position field moved"))
      .catch(() => ok58(false, "§58(d) the position field never left \"--\""));
    const row = await page.evaluate(() => ({
      genre: document.getElementById("posgenre").textContent.trim(),
      pos: document.getElementById("lcdpos").textContent.trim(),
      section: document.getElementById("possection").textContent.trim(),
      whole: document.getElementById("readout").textContent,
    }));
    ok58(!!row.genre, "§58(d) #posgenre: " + JSON.stringify(row.genre));
    ok58(!!row.pos && row.pos !== "--", "§58(d) #lcdpos: " + JSON.stringify(row));
    ok58(!!row.section, "§58(d) #possection: " + JSON.stringify(row.section));
    ok58(!row.whole.includes("▶"), '§58(d) the play glyph is still on the row: "' + row.whole + '"');
    await page.click("#play");                    // stop, so the screenshots are quiet
    await page.waitForTimeout(150);

    // ---- the two screenshots ----
    await page.screenshot({
      path: "/home/ford/.claude/jobs/c1b341cb/tmp/transport-390.png" });
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.screenshot({
      path: "/home/ford/.claude/jobs/c1b341cb/tmp/transport-1400.png" });

    ok58(errs.length === 0, "§58 page errors: " + JSON.stringify(errs));
    await browser.close();
    srv.close();
    console.log("\n§58 transport-dom: " + (checks58 - fails58) + "/" + checks58 + " checks pass");
    process.exit(fails58 ? 1 : 0);
  })().catch(e => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
  return;
}

// ---- node test/unit/nukernel.test.js --controls-dom -------------------------
// NOT PART OF THE PURE-NODE GATE — §59, lane C's own check, and it exists
// because Paul's three complaints about the song surface are all things only a
// real browser can answer ("everything that's clickable should be a button,
// lots of stuff has no border but it's clickable. All the buttons and text
// areas should be the same height. It's hard to see what different things
// are", 2026-08-17). Every one of these is a COMPUTED-STYLE question — a
// border that is `1px solid transparent` reads as a border in the source and
// as nothing on the glass; a height written six times in six rules looks
// deliberate in each of them. So the gate measures the rendered page:
//   (a) every button and select on the transport and the arrange surface
//       paints a border or a fill AT REST (no hover, the only state a thumb
//       ever sees),
//   (b) every one of them measures --ctl-h, at 390 and at 1400,
//   (c) the things that are NOT controls wear neither — which is the half
//       that gives the other half its meaning,
//   (d) the genre lozenge picks, and (e) the surprise key writes.
if (process.argv.includes("--controls-dom")) {
  (async () => {
    const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
    const path = require("path");
    const ROOT = path.join(__dirname, "..", "..");
    let fails59 = 0, checks59 = 0;
    const ok59 = (cond, msg) => {
      checks59++;
      if (cond) console.log("  ok: " + msg);
      else { fails59++; console.error("  FAIL: " + msg); }
    };

    const srv = await serve(ROOT, 8977);
    const browser = await launchChromium();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = capturePageErrors(page);
    await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce`,
      { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
    await page.reload({ waitUntil: "networkidle" });

    // ---- (d) THE LOZENGE IS THE PICKER ----
    // choosing a genre on the pill writes a song in it, and the pill then
    // SAYS that genre: one control, so one fact.
    await page.selectOption("#composeg", "acid");
    await page.waitForTimeout(900);
    const picked = await page.evaluate(() => ({
      loz: document.getElementById("posgenre").textContent.trim(),
      pick: document.getElementById("composeg").value,
      boxes: document.querySelectorAll("#song .box").length,
      // the pill must survive a status message taking the row: a sentence may
      // eat the readouts, never the way to pick a genre
      lozWide: document.querySelector(".genrelz").getBoundingClientRect().width,
    }));
    ok59(picked.pick === "acid" && picked.boxes > 4,
      "§59(d) picking a genre on the lozenge wrote a song: " + JSON.stringify(picked));
    ok59(picked.loz === "Chicago 1987",
      '§59(d) the lozenge names the genre it wrote: "' + picked.loz + '"');
    ok59(picked.lozWide > 40, "§59(d) the lozenge is on screen while a status message shows");

    // ---- (e) SURPRISE IS A KEY, not a menu item ----
    const before = await page.evaluate(() =>
      document.querySelectorAll("#song .box").length + ":" +
      [...document.getElementById("composeg").options].some(o => o.value === ""));
    await page.click("#surprise");
    // the play lamp is the transport ANSWERING, not the click landing — the
    // graph has to warm before the first sound, so this waits for the state
    // event rather than for a stopwatch
    const played = await page.waitForFunction(
      () => document.getElementById("play").classList.contains("on"), null, { timeout: 10000 })
      .then(() => true).catch(() => false);
    const after = await page.evaluate(() => ({
      pick: document.getElementById("composeg").value,
      loz: document.getElementById("posgenre").textContent.trim(),
      boxes: document.querySelectorAll("#song .box").length,
    }));
    ok59(after.boxes > 4 && !!after.pick && !!after.loz,
      "§59(e) the surprise key composed: " + JSON.stringify(after) + " (before " + before + ")");
    ok59(played, "§59(e) the surprise key started the record from the top");
    ok59(before.endsWith(":false"),
      '§59(e) the genre list holds genres and nothing else — "surprise me" left it for a key');

    // ---- (a)(b)(c) THE THREE LAWS, at both widths ----
    const audit = () => page.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const dressed = el => {
        const cs = getComputedStyle(el);
        const bordered = ["Top", "Right", "Bottom", "Left"].some(s =>
          parseFloat(cs["border" + s + "Width"]) > 0 &&
          cs["border" + s + "Style"] !== "none" &&
          !/rgba\(0, 0, 0, 0\)|transparent/.test(cs["border" + s + "Color"]));
        const filled = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
        return { bordered, filled };
      };
      const name = el => (el.id || el.className.toString().split(" ").slice(0, 2).join(".") ||
                          el.tagName.toLowerCase());
      const ctl = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue("--ctl-h"));
      const out = { ctl, naked: [], wrongH: [], dressedText: [] };
      // the two faders are the documented exception: an <input type=range> is
      // its own affordance (a track and a cap), and painting a box round it
      // would make it read as a key rather than as something that slides.
      const EXCEPT = new Set(["bpm", "vol"]);
      for (const root of [document.querySelector(".transport"),
                          document.getElementById("song")]) {
        for (const el of root.querySelectorAll("button,select,input")) {
          if (!vis(el)) continue;
          const d = dressed(el), h = el.getBoundingClientRect().height;
          if (!d.bordered && !d.filled && !EXCEPT.has(el.id)) out.naked.push(name(el));
          // .bcx is the dismiss BADGE riding on a thumbnail, not a control in
          // a row — the one height this law carves out, and it says so here
          if (Math.abs(h - ctl) > 1 && !el.classList.contains("bcx"))
            out.wrongH.push(name(el) + "=" + Math.round(h));
        }
      }
      // ...and the other half: a readout is not a control and must not look
      // like one. #lcdpos and #possection are the two fields on the transport
      // row that a person may NOT press.
      for (const id of ["lcdpos", "possection"]) {
        const el = document.getElementById(id);
        const d = dressed(el);
        if (d.bordered && d.filled) out.dressedText.push(id);
      }
      return out;
    });

    for (const [w, h] of [[390, 844], [1400, 1000]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(200);
      const a = await audit();
      ok59(a.naked.length === 0,
        "§59(a) at " + w + "px, clickable with no border and no fill: " + JSON.stringify(a.naked));
      ok59(a.wrongH.length === 0,
        "§59(b) at " + w + "px, controls off the --ctl-h " + a.ctl + "px baseline: " +
        JSON.stringify(a.wrongH));
      ok59(a.dressedText.length === 0,
        "§59(c) at " + w + "px, readouts wearing the key skin: " + JSON.stringify(a.dressedText));
      // and the page itself never grows past the glass: a long status sentence
      // in the transport once sized the whole chassis at ~1000px
      const doc = await page.evaluate(() => document.documentElement.scrollWidth);
      ok59(doc <= w, "§59(b) the document is " + doc + "px wide in a " + w + "px window");
      await page.screenshot({
        path: "/home/ford/.claude/jobs/c1b341cb/tmp/controls-" + w + ".png" });
    }

    ok59(errs.length === 0, "§59 page errors: " + JSON.stringify(errs));
    await browser.close();
    srv.close();
    console.log("\n§59 controls-dom: " + (checks59 - fails59) + "/" + checks59 + " checks pass");
    process.exit(fails59 ? 1 : 0);
  })().catch(e => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
  return;
}

let fails = 0, checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; console.error("  FAIL " + msg); }
};
const clone = o => JSON.parse(JSON.stringify(o));
const sig = ev => JSON.stringify(ev.map(e => [e.t, e.n, e.d, e.vel, e.acc, e.sld]));

// a phrase that exercises every vector: rests, accents, slides, octave leaps,
// a full velocity range and both signs of degree
const P = {
  deg:  [0, 3, -2, 5, 4, 0, -4, 2, 7, 3, 0, -1, 2, 6, 3, 1],
  oct:  [0, 0, 1, 0, -1, 0, 0, 0, 1, 0, 0, 0, -1, 1, 0, 0],
  vel:  [9, 5, 3, 8, 6, 4, 8, 2, 9, 6, 4, 7, 8, 3, 6, 5],
  inc:  [0, 1, 0, 0, -1, 0, 0, 0, 2, 0, 0, 0, 0, -1, 0, 0],
  stk:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  gate: [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
  acc:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  sld:  [0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0],
};
const allEvents = (p, g, bars) =>
  [...K.render(p, g, bars), ...K.drums(p, g, bars), ...K.bass(p, g, bars)]
    .sort((a, b) => a.t - b.t || (a.n || 0) - (b.n || 0));

// THE GENRE WITH THE PLAYER TAKEN OUT — the documented neutral of the
// performance layer (kernel.js: stress/phrase/touch, §39 below). A gate that
// measures WHAT WAS WRITTEN — a root shift, a bar schedule, the composer's
// topline — must read it through this, because the performance layer's whole
// job is to make bar 3 not bar 1 and no two notes equal, and a gate that reads
// "the first event in the bar" or "bar 0 == bar 2" is asking a question that
// only had one answer while nothing ever moved. Where a gate measures the
// PLAYING, it uses the shipped anchor and says so.
// THE PLAYER TAKEN OUT — the whole player. `orn` joined stress/phrase/touch
// when genres learned to lean, slide, flam and pass: an ornament policy is
// drawn on the same positional dice the hand is and it varies bar to bar, so
// leaving it in meant "with the player taken out" still handed back a
// different bar every pass, and the checks that exist to tell the phrase from
// the performance could not.
const plain = g => ({ ...g, stress: 0, phrase: 0, touch: null, orn: null });

// A GENRE THAT IS NOTHING BUT THE WASH. The pad path (kernel.js render) fires
// one voicing at the phrase's first gate and holds it to the next chord: it
// reads the GATE vector to know when and the VEL vector to know how hard, and
// by construction nothing else in a phrase can reach it — a held chord has no
// contour, no octave displacement, no slide, no accent and no ramp, and its
// duration is the chord's, not the gate's. Every anchor in the table used to
// have a line voice somewhere, so §1 and §10 could ask every one of them the same
// question; the FUNCTION genres brought the first anchor that is only a pad.
// The two gates say what a wash CAN be sensitive to rather than exempting a
// genre by name, and each of them then proves the exemption is not dead.
const allPad = g => Array.from({ length: g.voices }, (_, v) => K.partOf(g, v))
  .every(p => p === "pad");

/* ---------------------------------------------------------------- 0. THE ROSTER
   Genre KEYS are load-bearing — saves, presets, gates and compose all address
   genres by key — so display names may change freely (they became place-year
   names in 2026-08) but every key that has ever shipped must still exist.
   A rename that touched a key would silently orphan every saved song. */
console.log("roster — every shipped genre key still exists; labels are unique");
{
  const SHIPPED = ["simple", "fugue", "acid", "newwave", "vaporwave", "blues",
    "rock", "gregorian", "bulgarian", "spem", "counterpoint", "neoclassical",
    "drone", "sludge", "tango", "deathmetal", "eurythmics", "isley", "toto",
    "jodeci", "beatles", "steely", "postrock", "boombap", "trap", "house",
    "garage", "dnb", "disco", "funk", "motown", "rnb", "gospel", "reggae",
    "dub", "ska", "afrobeat", "bossa", "countrypop", "synthpop", "shoegaze",
    "citypop", "punk", "ambient", "techno", "solo", "vocal", "backing",
    "riff", "pad",
    // THE ANCESTORS (phase 2, 2026-08-16) — the eight the shopping order in
    // GENEALOGY.md demanded by name. Listed here the day they landed, which is
    // the point of this roster: a key becomes load-bearing the moment it can
    // appear in a saved song, not once somebody remembers to write it down.
    "jazz", "bodiddley", "chuckberry", "doowop", "skiffle", "minimalism",
    "kraftwerk", "electro"];
  for (const k of SHIPPED) ok(GENRES[k], "shipped genre key vanished: " + k);
  // GK_FULL: a duplicate or missing label anywhere in the 110 is the bug, and
  // this is a string compare over the table, not a render — full breadth
  // costs nothing here even in FAST mode.
  const labels = GK_FULL.map(k => GENRES[k].label);
  ok(new Set(labels).size === labels.length,
     "two genres display the same name");
  ok(GK_FULL.every(k => typeof GENRES[k].label === "string" && GENRES[k].label),
     "a genre has no display name");
}

/* ---------------------------------------------------------------- 1. SENSITIVITY
   Every vector must reach the output. This is the check the octave bug and the
   dead ghost layer both needed and neither had. */
console.log("sensitivity — perturbing each vector must change the render");
for (const gk of GK) {
  // A RAMP NEEDS MORE THAN ONE LOOP to be visible — it accumulates with the loop
  // index, so in a one-bar form (Simple) it multiplies by zero and is correctly
  // inert. Render four bars so inc/stk have somewhere to go.
  const g = GENRES[gk], bars = Math.max(4, g.bars), base = sig(allEvents(P, g, bars));
  // ...every vector, unless the genre is only a wash, in which case there are
  // exactly two (allPad, above) and they are still required to reach
  for (const key of (allPad(g) ? ["gate", "vel"]
    : ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"])) {
    const q = clone(P);
    if (key === "deg") q.deg = q.deg.map(d => d + 2);
    else if (key === "oct") q.oct = q.oct.map(() => 1);
    else if (key === "vel") q.vel = q.vel.map(() => 1);
    else if (key === "inc") q.inc = q.inc.map((_, i) => (i === 0 ? 2 : 0));
    else if (key === "stk") q.stk = q.stk.map((_, i) => (i === 0 ? 1 : 0));
    else q[key] = q[key].map((b, i) => (i % 2 ? b : b ? 0 : 1));
    const pad = gk === "vaporwave" && (key === "deg" || key === "oct");
    // a vaporwave PAD reads chord tones, so deg/oct legitimately do not reach
    // voice 0 — but they must still reach the line voice, so the whole-render
    // signature has to move regardless
    ok(sig(allEvents(q, g, bars)) !== base,
       gk + ": changing " + key + " did not change the rendered events" + (pad ? " (pad genre)" : ""));
  }
}
// ...and the exemption is not a dead branch: something in the table really is
// only a wash, or the two-key list above is silently covering nothing
ok(GK.some(gk => allPad(GENRES[gk])),
   "no genre in the table is all pad — the sensitivity exemption checks nothing");

/* ---------------------------------------------------------------- 2. GROUP LAWS
   The operator set is only searchable if it is closed and its elements have
   the inverses the algebra claims. */
console.log("group laws — inverses, involutions, identity");
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const N = P.deg.length;
ok(eq(K.rotate(0)(P), P), "rotate(0) is not the identity");
ok(eq(K.rotate(N)(P), P), "rotate(length) is not the identity");
for (let k = 1; k < N; k++)
  ok(eq(K.rotate(N - k)(K.rotate(k)(P)), P), "rotate(" + k + ") has no inverse");
ok(eq(K.reverse()(K.reverse()(P)), P), "reverse is not an involution");
ok(eq(K.invert(4)(K.invert(4)(P)), P), "invert is not an involution");
ok(eq(K.complement("acc")(K.complement("acc")(P)), P), "complement is not an involution");
ok(eq(K.transpose(-3)(K.transpose(3)(P)), P), "transpose has no inverse");
ok(eq(K.drop(3)(K.drop(3)(P)), K.drop(3)(P)), "drop is not idempotent");
ok(eq(K.fill(3)(K.fill(3)(P)), K.fill(3)(P)), "fill is not idempotent");
// SPLIT adds attacks inside long notes and is audible under any articulation —
// which duplicating a list element is not, because a held note swallows its copy
{
  const before = P.gate.filter(Boolean).length;
  ok(K.split(2)(P).gate.filter(Boolean).length > before, "split(2) added no attacks");
  ok(K.split(1)(P).gate.join("") === P.gate.join(""), "split(1) is not the identity");
  // under LEGATO — held notes, no gaps — a split must still produce extra
  // attacks, which duplicating a list element could never do
  const leg = g2 => K.render(g2, { ...GENRES.simple, artic: "legato" }, 4).length;
  ok(leg(K.split(2)(P)) > leg(P), "split is inaudible under legato — the whole point of it");
}

// DENSITY family. drop and fill are both lossy, so they are NOT inverses — and
// they do not commute. Both facts are load-bearing: the chips apply in the order
// you switch them on, and "drop 3 then add 3" is a real transformation rather
// than a no-op somebody will report as a bug.
ok(!eq(K.fill(3)(K.drop(3)(P)), P), "drop then fill claims to be the identity");
ok(!eq(K.fill(3)(K.drop(3)(P)), K.drop(3)(K.fill(3)(P))), "drop and fill commute");
ok(K.drop(1)(P).gate.every(g => g === 0), "drop(1) is not silence");
ok(K.fill(1)(P).gate.every(g => g === 1), "fill(1) is not every step");
// drop(1) must leave the KIT playing — that is the whole use of it
ok(K.drums(K.drop(1)(P), GENRES.acid, GENRES.acid.bars).length > 0,
   "drop(1) silenced the drums as well as the line");
ok(K.render(K.drop(1)(P), GENRES.acid, GENRES.acid.bars).length === 0,
   "drop(1) left pitched notes sounding");
// fill uncovers degrees the phrase was already holding silent, it does not
// invent them: every added note's pitch must come from the existing deg vector
{
  const before = new Set(K.render(P, GENRES.acid, GENRES.acid.bars).map(e => e.n));
  const after = K.render(K.fill(2)(P), GENRES.acid, GENRES.acid.bars);
  ok(after.length > before.size, "fill(2) added no notes");
}

// reverse must shift the slide vector: slide is EDGE-valued, and reversing it
// like a node vector leaves every slide on the wrong side of its transition
ok(!eq(K.reverse()(P).sld, [...P.sld].reverse()),
   "reverse treated sld as node-valued (the edge shift is missing)");

/* ---------------------------------------------------------------- 3. TOTALITY + PURITY
   Every operator is claimed to be total: any pattern in, a valid pattern out,
   no failure modes — and none of them may mutate their input. */
console.log("totality and purity");
const OPS = [K.rotate(5), K.rotate(-3), K.reverse(), K.transpose(9), K.transpose(-9),
             K.invert(0), K.invert(4), K.complement("gate"), K.complement("acc"),
             K.excerpt(2, 8), K.drop(1), K.drop(2), K.drop(3),
             K.fill(1), K.fill(2), K.fill(3), K.spread(2), K.spread(0.5), K.spread(0),
             K.split(2), K.split(3), K.split(4), K.del(1), K.del(2), K.del(4),
             K.only("acc", K.rotate(3)),
             K.crossmap("acc", "sld")];
const VECS = ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"];
const edge = [P, K.mapv(P, v => v.map(() => 0)), K.mapv(P, v => v.map(() => 1)),
              { ...clone(P), gate: new Array(N).fill(0) }];
for (const op of OPS) {
  for (const p0 of edge) {
    const before = clone(p0);
    let out;
    try { out = op(p0); } catch (e) { ok(false, "operator threw: " + e.message); continue; }
    ok(VECS.every(k => Array.isArray(out[k]) && out[k].length === N),
       "operator returned a malformed pattern");
    ok(VECS.every(k => out[k].every(Number.isFinite)), "operator produced a non-finite value");
    ok(eq(p0, before), "operator MUTATED its input");
  }
}

/* ---------------------------------------------------------------- 4. DETERMINISM */
console.log("determinism");
for (const gk of GK) {
  const g = GENRES[gk];
  ok(sig(allEvents(P, g, g.bars)) === sig(allEvents(P, g, g.bars)),
     gk + ": two renders of one input disagree");
}

/* ---------------------------------------------------------------- 5. THE OCTAVE LAW
   The regression that started this file. oct must move a pitched line by
   exactly twelve semitones per step, after the register fold. */
console.log("octave law — oct survives the register fold");
for (const gk of GK) {
  const g = GENRES[gk];
  const lineVoice = Array.from({ length: g.voices }, (_, v) => v)
    .find(v => g.realize(v) !== "pad");
  if (lineVoice == null) continue;
  const flat = clone(P); flat.oct = flat.oct.map(() => 0);
  const up = clone(P); up.oct = up.oct.map(() => 1);
  const a = K.render(flat, g, g.bars).filter(e => e.v === lineVoice).map(e => e.n);
  const b = K.render(up, g, g.bars).filter(e => e.v === lineVoice).map(e => e.n);
  ok(a.length === b.length && a.length > 0, gk + ": octave test found no comparable notes");
  ok(a.every((n, i) => b[i] - n === 12),
     gk + ": oct +1 did not raise the line by exactly 12 (fold is eating it)");
}

/* ---------------------------------------------------------------- 6. GHOST LAYER
   It fired for no operator at all until `only` existed, because accents are a
   subset of gates and whole-pattern operators preserve that. */
console.log("ghost layer fires");
{
  const g = GENRES.acid;
  const ghosts = K.drums(P, g, g.bars).filter(e => e.d === "p");
  ok(ghosts.length > 0, "acid ghost-percussion layer produced nothing");
  ok(ghosts.every(e => Number.isFinite(e.vel)), "ghost hits carry no velocity");
}

/* ---------------------------------------------------------------- 7. ENVELOPES
   Envelopes are a different type from operators: they act on the event stream
   and are a function of position, which no pattern operator can be. */
console.log("envelopes");
{
  const g = GENRES.acid, span = g.bars * 16 / g.rate;
  const ev = K.render(P, g, g.bars);
  const noop = K.envelope(ev, null, span);
  ok(sig(noop) === sig(ev), "envelope(null) changed the events");
  for (const kind of ["in", "out"]) {
    const out = K.envelope(ev, kind, span);
    ok(out.length === ev.length, "envelope " + kind + " changed the event count");
    ok(out.every(e => e.vel >= 0 && e.vel <= 9), "envelope " + kind + " left velocity out of range");
    const first = out[0].vel, last = out[out.length - 1].vel;
    ok(kind === "in" ? first < last : first > last,
       "envelope " + kind + " does not run in the right direction");
  }
  // monotone in the fade direction
  const fin = K.envelope(ev, "in", span);
  const byT = [...fin].sort((a, b) => a.t - b.t);
  const scaled = byT.map((e, i) => e.vel / Math.max(1, ev.slice().sort((a, b) => a.t - b.t)[i].vel));
  ok(scaled.every((v, i) => i === 0 || v >= scaled[i - 1] - 0.26), "fade in is not monotone");
}

/* ---------------------------------------------------------------- 8. HARMONY MODES */
console.log("harmony — modal, cycle, emergent");
{
  const modal = GENRES.acid;
  ok(Array.from({ length: 8 }, (_, b) => K.harm(P, modal, b)).every(r => r === 0),
     "modal harmony moved");
  const cyc = GENRES.vaporwave;
  ok(Array.from({ length: 8 }, (_, b) => K.harm(P, cyc, b))
       .every((r, b) => r === cyc.roots[b % cyc.roots.length]), "cycle harmony does not wrap");
  const em = GENRES.fugue;
  const roots = Array.from({ length: 4 }, (_, b) => K.harm(P, em, b));
  ok(new Set(roots).size > 1, "emergent harmony is constant (it should read the entries)");
  ok(roots.every(r => r >= 0 && r < 7), "emergent harmony left the mode");
}

/* ---------------------------------------------------------------- 9. SCALE + MODE OVERRIDES
   Both alphabets are per-genre facts. A subject may never sound a pitch class
   outside the scale it was read through. */
console.log("scale and mode overrides");
// Containment is relative to THE CHORD, not to the tonic. A cycle-harmony line
// is transposed by the bar's root — the blues riff goes up to the IV — so its
// pitch classes are the scale MOVED, and checking against the untransposed
// scale would forbid the thing that makes a progression audible.
for (const gk of GK) {
  const g = GENRES[gk], sc = g.scale || K.PENT, bs = 16 / g.rate;
  // THE ONE CARVE-OUT, and it is a single word wide: `approach` (kernel.js
  // ORNAMENTS, §59) is a chromatic lead-in — a semitone under a strong beat,
  // resolving on the next event — and being outside the alphabet is the whole
  // definition of it. The law above is about the SUBJECT, and an ornament is
  // not the subject. Every OTHER ornament this machine can emit — grace, pass,
  // flam, roll, and every mark a hand can write — is still held to it here,
  // which is why this filter names one tag rather than dropping `e.orn`.
  const ev = K.render(P, g, g.bars)
    .filter(e => g.realize(e.v) !== "pad" && e.orn !== "approach");
  for (let b = 0; b < g.bars; b++) {
    // A DIATONIC genre follows the chord by DEGREES, so its notes stay in ONE
    // scale all the way through — a stronger claim than the transposing kind,
    // and the check is stronger with it: root 0, no allowance for a moved
    // alphabet. (See render's `degShift`: transposing a seven-note subject by
    // semitones is what made tango and Eurythmics sound out of tune.)
    const root = (g.harmony === "cycle" && !g.diatonic)
      ? K.mp(K.harm(P, g, b), g.mode || undefined) : 0;
    const allowed = new Set(sc.map(x => (((x + root) % 12) + 12) % 12));
    // under a chord cycle a RAMPED note walks the chord's own rungs, and a
    // chord tone is not always in the pentatonic — that is the point of it.
    // The rungs come from chordsOf, so a genre whose prog carries a SEVENTH
    // licenses the seventh: blues' major third over I7 is the identity, not
    // a leak. Without a prog this is exactly the old [r, r+2, r+4] triad.
    if (g.harmony === "cycle")
      for (const c of K.chordsOf(P, g, b))
        for (const n of c.pcs) allowed.add(((n % 12) + 12) % 12);
    const bad = ev.filter(e => Math.floor(e.t / bs) === b)
                  .map(e => ((e.n % 12) + 12) % 12).filter(pc => !allowed.has(pc));
    ok(bad.length === 0,
       gk + " bar " + (b + 1) + ": pitch class outside the scale on that chord (" +
       [...new Set(bad)].join(",") + ")");
  }
}
for (const mk of Object.keys(MODES)) {
  const g = { ...GENRES.vaporwave, mode: MODES[mk] };
  const pcs = new Set(K.render(P, g, g.bars)
    .filter(e => g.realize(e.v) === "pad").map(e => ((e.n % 12) + 12) % 12));
  ok([...pcs].every(pc => MODES[mk].includes(pc)), mk + ": a pad chord left the mode");
  ok(pcs.size > 0, mk + ": no pad chord tones at all");
}

/* ---------------------------------------------------------------- 9b. CHROMATIC RANGE
   Two independent ways to change how wide a line is, and the whole point is
   that they are independent. spread MOVES THE NOTES within the alphabet;
   swapping the alphabet changes the width while leaving every degree — and so
   the exact contour — untouched. Both were flattened until the register fold
   stopped wrapping each note separately. */
console.log("chromatic range — spread moves notes, the alphabet moves width");
{
  const g = GENRES.simple;
  // ramp-free as well as octave-free: inc/stk move notes per LOOP, which is a
  // different axis from spread and would otherwise be read as spread failing
  const flat = { ...clone(P), oct: new Array(N).fill(0),
                 inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
  const span = p2 => { const n = K.render(p2, g, g.bars).map(e => e.n);
                       return n.length ? Math.max(...n) - Math.min(...n) : 0; };
  const dir = p2 => K.render(p2, g, g.bars).map(e => e.n)
                     .map((v, i, a) => (i ? Math.sign(v - a[i - 1]) : 0)).join("");

  // monotone increasing in k, and k=0 collapses to a single pitch
  const spans = [0, 0.5, 1, 2, 3].map(k => span(K.spread(k)(flat)));
  ok(spans[0] === 0, "spread(0) is not a monotone");
  ok(spans.every((s, i) => i === 0 || s > spans[i - 1]),
     "spread does not widen monotonically: " + spans.join(","));
  ok(!K.render(K.spread(2)(flat), g, g.bars).some((e, i, a) =>
       i && Math.abs(e.n - a[i - 1].n) > 60), "spread(2) produced an absurd leap");

  // the alphabet changes the width and NOTHING else
  const base = { span: span(flat), dir: dir(flat) };
  for (const [sc, wide] of [[SCALES.chromatic, false], [SCALES.whole, false],
                            [SCALES.augmented, true], [SCALES.quartal, true]]) {
    const gg = { ...g, scale: sc };
    const n = K.render(flat, gg, gg.bars).map(e => e.n);
    const s2 = Math.max(...n) - Math.min(...n);
    const d2 = n.map((v, i, a) => (i ? Math.sign(v - a[i - 1]) : 0)).join("");
    ok(d2 === base.dir, "swapping the alphabet changed the contour");
    ok(wide ? s2 > base.span : s2 < base.span,
       "alphabet of " + sc.length + " notes did not move the span the right way");
    // width per degree-step is exactly 12 / length
    ok(Math.abs(K.pitch(sc.length, sc) - K.pitch(0, sc) - 12) < 1e-9,
       "scale of " + sc.length + " does not span an octave in its own length");
  }
}

/* ---------------------------------------------------------------- 9c. THE RAMP CLIMBS
   inc and stk accumulate with the loop index, and the register fold must not
   chase them: computing the octave shift from the RAMPED degrees re-centred the
   line every few loops, so a rising arpeggio audibly fell back down. The ramp
   sits on top of the registration, exactly like oct. */
console.log("ramps climb monotonically and the fold does not chase them");
{
  const g = { ...GENRES.simple, bars: 8, incClamp: 0 };
  const base = { ...clone(P), inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
  const first = p2 => Array.from({ length: 8 }, (_, b) =>
    K.render(p2, g, 8).filter(e => Math.floor(e.t / 16) === b)[0].n);

  for (const [name, key, sign] of [["inc up", "inc", 1], ["inc down", "inc", -1],
                                   ["stk up", "stk", 1], ["stk down", "stk", -1]]) {
    const q = clone(base);
    q[key] = q[key].map((_, i) => (i === 0 ? sign : 0));
    const seq = first(q);
    const mono = seq.every((n, i) => i === 0 || (sign > 0 ? n >= seq[i - 1] : n <= seq[i - 1]));
    ok(mono, name + " is not monotone across loops: " + seq.join(" "));
    ok(Math.abs(seq[7] - seq[0]) > 6, name + " barely moved across eight loops: " + seq.join(" "));
  }
  // the three limit behaviours are three SHAPES, not three strengths
  {
    const q3 = clone(base); q3.stk = q3.stk.map((_, i) => (i === 0 ? 1 : 0));
    const seq = m => Array.from({ length: 12 }, (_, b) => K.rampOf(q3, 0, b, 4, m));
    const hold = seq("hold"), loop = seq("loop"), rev = seq("reverse");
    ok(hold.slice(4).every(v => v === 4), "hold does not settle at the limit: " + hold.join(" "));
    ok(loop[5] === 0 && loop[9] === 4, "loop does not wrap back to zero: " + loop.join(" "));
    ok(rev[5] === 3 && rev[8] === 0 && rev[9] === 1, "reverse does not turn round: " + rev.join(" "));
    ok(new Set([hold.join(), loop.join(), rev.join()]).size === 3,
       "the three limit modes are not three different shapes");
  }
  // and the clamp still bounds it
  const q2 = clone(base); q2.stk = q2.stk.map((_, i) => (i === 0 ? 1 : 0));
  const clamped = Array.from({ length: 8 }, (_, b) =>
    K.render(q2, { ...g, incClamp: 2 }, 8).filter(e => Math.floor(e.t / 16) === b)[0].n);
  ok(new Set(clamped.slice(3)).size === 1, "clamp 2 did not stop the ramp: " + clamped.join(" "));
}

/* ---------------------------------------------------------------- 9d. TIE + NEAREST ROOT
   Two things that keep a line playable rather than merely correct. */
console.log("tie merges repeats; the root shift takes the nearest octave");
{
  const rep = K.split(2)(P);
  const loose = K.render(rep, GENRES.simple, 4);
  const tied = K.render(rep, { ...GENRES.simple, artic: "tie" }, 4);
  ok(tied.length < loose.length, "tie did not merge any repeated notes");
  ok(Math.max(...tied.map(e => e.dur)) > Math.max(...loose.map(e => e.dur)),
     "tie produced no longer note than the untied version");
  // total sounding time, not the longest note: a note whose successor slides is
  // held full length under every articulation, so the max can tie
  const total = a => a.reduce((s, e) => s + e.dur, 0);
  ok(total(K.render(rep, { ...GENRES.simple, artic: "staccato" }, 4)) < total(loose),
     "staccato does not sound for less time than normal");

  // a cycle-harmony line must stay in ONE register: the root shift is folded to
  // the nearest octave, so the flat-VII drops two rather than climbing ten
  // MEASURE THE ROOT SHIFT ITSELF. A flat phrase — one degree, no octaves, no
  // ramp — renders one pitch per bar, so the bar-to-bar difference IS the root
  // shift and nothing else. Folded to the nearest octave it can never exceed a
  // tritone; unfolded, the flat-VII alone is ten.
  const flatP = { deg: new Array(N).fill(0), oct: new Array(N).fill(0),
                  vel: new Array(N).fill(5), inc: new Array(N).fill(0),
                  stk: new Array(N).fill(0), gate: new Array(N).fill(1),
                  acc: new Array(N).fill(0), sld: new Array(N).fill(0) };
  for (const gk of GK) {
    // the root shift is a fact about the HARMONY, so read it with the player
    // taken out: "the first event in the bar" is only a well-defined note while
    // no hand is moving onsets, and two voices whose registers differ by an
    // octave both start on the downbeat
    const g = plain(GENRES[gk]);
    if (g.harmony !== "cycle") continue;
    const bs = 16 / g.rate;
    const perBar = Array.from({ length: g.bars }, (_, b) =>
      K.render(flatP, g, g.bars).filter(e => g.realize(e.v) !== "pad" &&
        Math.floor(e.t / bs) === b).map(e => e.n)[0]);
    // each shift is folded against the TONIC into [-6..+6], so the widest gap
    // between any two bars is 12 — one octave, never more
    const xs = perBar.filter(x => x != null);
    const spread = Math.max(...xs) - Math.min(...xs);
    ok(spread <= 12, gk + ": root shifts spread " + spread +
       " semitones — not folded to the nearest octave");
  }
}

/* ---------------------------------------------------------------- 9e. ONE ALPHABET A BOX
   A layered genre must read the SAME subject alphabet as the one it is layered
   on. The layer inherits the section's mode but once did not inherit its
   `scale`, so an authority reading quartal played against a layer reading
   pentatonic — six semitones per degree-step against two point four. That does
   not sound like a missing override, it sounds like the tuning is broken. */
console.log("a layer reads the authority's alphabet");
{
  const SC = SCALES.quartal;
  const auth = { ...GENRES.rock, scale: SC };
  const layer = { ...GENRES.fugue, scale: SC, harmony: auth.harmony,
                  roots: auth.roots, rate: auth.rate };
  const pcOf = g2 => new Set(K.render(P, g2, 8)
    .filter(e => g2.realize(e.v) !== "pad").map(e => ((e.n % 12) + 12) % 12));
  const a = [...pcOf(auth)], l = [...pcOf(layer)];
  // both alphabets are the quartal set transposed by the shared roots, so the
  // layer can introduce no pitch class the authority could not also play
  const stray = l.filter(pc => !a.includes(pc));
  ok(stray.length === 0,
     "a layer sounded pitch classes its authority cannot: " + stray.join(","));
  // and the guard that would have caught it: drop the inherited scale and the
  // sets must diverge, or this test proves nothing
  const naive = { ...GENRES.fugue, harmony: auth.harmony, roots: auth.roots, rate: auth.rate };
  ok([...pcOf(naive)].some(pc => !a.includes(pc)),
     "the un-inherited case does not diverge — this check cannot fail");
}

/* ---------------------------------------------------------------- 10. NOTE DURATION
   A note lasts to the next gated step. The bug this replaced was every note
   being exactly one step, which is a row of 16ths, not a phrase. */
console.log("durations read the gate vector");
for (const gk of GK) {
  const g = GENRES[gk];
  const durs = new Set(K.render(P, g, g.bars).map(e => +e.dur.toFixed(3)));
  // a wash holds one chord to the next chord, so its durations are the
  // HARMONY's and are correctly all alike — the claim being made here is about
  // lines reading the gate vector (allPad, top of file)
  ok(durs.size > 1 || allPad(g), gk + ": every note has the same duration");
  ok([...durs].every(d => d > 0), gk + ": a note has non-positive duration");
}

/* ---------------------------------------------------------------- 11. SWING + RATE */
console.log("swing bends the grid; rate scales it");
{
  const straight = K.render(P, { ...GENRES.blues, swing: 0 }, 4).map(e => e.t);
  const swung = K.render(P, GENRES.blues, 4).map(e => e.t);
  ok(straight.length === swung.length, "swing changed the event count");
  ok(swung.some((t, i) => t !== straight[i]), "swing moved nothing");
  ok(swung.every((t, i) => t >= straight[i]), "swing moved a note EARLIER");
  const half = K.render(P, { ...GENRES.acid, rate: 0.5 }, 4);
  const full = K.render(P, GENRES.acid, 4);
  ok(Math.abs(Math.max(...half.map(e => e.t)) - 2 * Math.max(...full.map(e => e.t))) < 1e-9,
     "half-time did not double the span");
}

/* ---------------------------------------------------------------- 12. DRUM FILLS */
console.log("drum fills land on the last bar of the form");
for (const gk of GK) {
  const g = GENRES[gk];
  if (!g.fill) continue;
  const dr = K.drums(P, g, g.bars), bs = 16 / g.rate;
  const perBar = Array.from({ length: g.bars },
    (_, b) => dr.filter(e => Math.floor(e.t / bs) === b).length);
  ok(perBar[g.bars - 1] > perBar[0], gk + ": the fill bar is not busier than bar 1");
  ok(dr.some(e => e.fill), gk + ": no event is flagged as a fill");
}

/* ---------------------------------------------------------------- 12b. BASS ALWAYS SOUNDS
   The root bass reads the accent vector for its rhythm. A phrase with no
   accents — which is what every cleared or empty slot is — left it silent in
   four of five genres. A bass part must not depend on the tune being emphatic. */
console.log("bass sounds even when the phrase has no accents");
{
  const flat = { ...clone(P), acc: new Array(N).fill(0) };
  const empty = K.mapv(P, v => v.map(() => 0));
  for (const gk of GK) {
    const g = GENRES[gk];
    if (g.nobass) {                       // a genre may declare it has no bass at all
      ok(K.bass(P, g, g.bars).length === 0, gk + ": nobass genre emitted bass anyway");
      continue;
    }
    ok(K.bass(flat, g, g.bars).length > 0, gk + ": no bass when the phrase has no accents");
    ok(K.bass(empty, g, g.bars).length > 0, gk + ": no bass for an empty phrase");
    // and the accented case must not have drifted
    ok(K.bass(P, g, g.bars).length > 0, gk + ": no bass for an accented phrase");
  }
}

/* ---------------------------------------------------------------- 13. WALKING BASS */
console.log("walking bass arrives on the next root");
{
  const g = GENRES.blues, bs = 16, ev = K.bass(P, g, g.bars);
  ok(ev.length === g.bars * 4, "walking bass is not four notes a bar");
  for (let b = 0; b < g.bars; b++) {
    const bar = ev.filter(e => Math.floor(e.t / bs) === b);
    const nextRoot = ev.filter(e => Math.floor(e.t / bs) === (b + 1) % g.bars)[0];
    ok(Math.abs(bar[3].n - nextRoot.n) <= 2,
       "bar " + (b + 1) + ": the approach note does not land beside the next root");
  }
}

/* ---------------------------------------------------------------- 14. KIT OPERATORS
   A kit operator is total on kits the way a pattern operator is total on
   patterns — and the kit is now TWELVE lanes carrying FOUR vectors each
   (level · ?chance · ~nudge · !grace), so this section's alphabet widened with
   it. Three laws, each naming its own exceptions rather than waving at them:

     * ALPHABET. A lane vector is sixteen integers: 0 silent, 1 the old binary
       "on" (defer to kitVel and then the phrase), 2..9 an explicit velocity.
       The old check said "0 or 1", which was true only while a ghost snare was
       unwritable. ?chance is 0..9 odds, ~nudge is signed ninths of a step,
       !grace is 0..3 leading hits.
     * WRITES. An operator may write only the lanes it is DECLARED to write
       below. The list grew from two to twenty, because reaching the six lanes
       nothing could write was the point of the round — but every entry is
       named, so a typo that sprays toms through a house beat still fails.
     * FROM NOTHING. Only the "give this a beat" family may turn an EMPTY kit
       into a kit. Everything else VARIES a kit and returns {} for {} — the law
       `roll` always had in its comment and no test could state, and the one
       that stops a fugue growing a tom fill. */
console.log("kit operators are total; the alphabet is levels; only the declared write");
{
  // WHAT EACH OPERATOR MAY WRITE. A lane the base kit already has is always
  // allowed (that is varying, not inventing); this is the list of lanes an
  // operator may bring into existence, one entry per operator that does.
  const WRITES = {
    four: ["k"], offbeat: ["h"],
    ride: ["r"], tomtime: ["l"], pedal: ["f"], opens: ["o"],
    crash: ["x"], crashback: ["x"],
    backbeat: ["s"], onthree: ["s"], stickside: ["p"], claps: ["c"],
    tomfill: ["t", "m", "l"], tomrun: ["t", "m", "l"], tomroll: ["t", "m", "l"],
    disco: ["k", "o", "c"], stomp: ["k", "c", "h"], tresillo: ["k", "s", "h"],
    clave: ["p"], amen: ["k", "s", "r", "h"], motorik: ["k", "s", "h"],
    blast: ["k", "s", "r", "h"],
  };
  // ...and the ones that may write a kit onto NO kit at all: the named
  // patterns and the four-on-the-floor pair. "Give this a beat" is a different
  // request from "change this beat", and only these eleven answer the first.
  const FROM_NOTHING = new Set(["four", "offbeat", "crash", "crashback", "disco",
                                "stomp", "tresillo", "clave", "amen", "motorik", "blast"]);
  const RANGE = { "": [0, 9], "?": [0, 9], "~": [-4, 4], "!": [0, 3] };
  for (const gk of GK) {
    const g = GENRES[gk], base = g.kit || {};
    for (const [name, op] of Object.entries(K.KITOPS)) {
      const out = op(base);
      ok(out && typeof out === "object", gk + "/" + name + ": did not return a kit");
      for (const [key, vec] of Object.entries(out)) {
        const mark = /^[?~!]/.test(key) ? key[0] : "", lane = key.slice(mark ? 1 : 0);
        ok(!!K.LANES[lane], gk + "/" + name + ": \"" + key + "\" is not a lane or a sidecar");
        ok(Array.isArray(vec) && vec.length === 16,
           gk + "/" + name + ": " + key + " is not sixteen steps");
        const [lo, hi] = RANGE[mark] || [0, 9];
        ok(vec.every(x => Number.isInteger(x) && x >= lo && x <= hi),
           gk + "/" + name + ": " + key + " left the " + lo + ".." + hi + " alphabet");
        ok(base[lane] || (WRITES[name] || []).includes(lane),
           gk + "/" + name + ": invented lane " + lane + " out of nothing");
        // a sidecar without its lane is odds for a drum that is not there
        if (mark) ok(out[lane], gk + "/" + name + ": " + key + " is an orphan sidecar");
      }
      // and it must be a KIT: drums() has to accept whatever comes out
      ok(K.drums(P, { ...g, kit: out, fill: null }, g.bars).length >= 0,
         gk + "/" + name + ": drums() would not read the result");
    }
    // THE EMPTY KIT is the law's other half, and it is checked on every genre
    // because a kitless genre is exactly where it matters
    for (const [name, op] of Object.entries(K.KITOPS))
      ok((Object.keys(op({})).length > 0) === FROM_NOTHING.has(name),
         name + ": " + (FROM_NOTHING.has(name) ? "declared a writer but left {} empty"
                                               : "conjured a kit out of an empty one"));
    // the subtractive ones actually subtract
    ok(!("k" in K.KITOPS.nokick(base)), gk + ": nokick left a kick");
    ok(!Object.keys(K.KITOPS.nodrums(base)).length, gk + ": nodrums left a lane");
    if (base.k && base.s)
      ok(K.KITOPS.swap(base).k.join("") === base.s.join("") &&
         K.KITOPS.swap(base).s.join("") === base.k.join(""),
         gk + ": swap did not exchange the kick and the snare");
  }
  // double time is the bar's pattern read at twice the rate, not a busier lane
  const k = { h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] };
  ok(K.KITOPS.doubletime(k).k.join("") === "1000100010001000",
     "double time did not double the kick");
  ok(K.KITOPS.sparse(k).h.filter(Boolean).length === 4, "sparse did not thin to the quarters");
}

/* ---------------------------------------------------------------- 15. BASS STYLES
   Every style must SOUND, and the two that own their own rhythm must own it
   even when the phrase has no accents to read — which is the whole reason
   STYLEGRID exists, and is the bug the accent-reading bass had in a different
   shape. */
console.log("bass styles: each is a different part, and none of them is silent");
{
  const g = GENRES.rock, flat = { ...clone(P), acc: new Array(N).fill(0) };
  const shapes = {};
  for (const st of ["walk", "octaves", "fifths", "pedal", "eighths", "sixteenths", undefined]) {
    const gg = { ...g, bassStyle: st }, name = st || "roots";
    const ev = K.bass(P, gg, g.bars);
    ok(ev.length > 0, name + ": emitted no bass at all");
    ok(ev.every(e => e.n > 0 && Number.isFinite(e.n)), name + ": emitted a nonsense pitch");
    ok(K.bass(flat, gg, g.bars).length > 0, name + ": went silent on an unaccented phrase");
    shapes[name] = JSON.stringify(ev.map(e => [e.t, e.n]));
  }
  // they are genuinely different parts, not one part with a different label
  const seen = new Map();
  for (const [name, s] of Object.entries(shapes)) {
    ok(!seen.has(s), name + " renders identically to " + seen.get(s));
    seen.set(s, name);
  }
  ok(K.bass(P, { ...g, bassStyle: "eighths" }, 1).length === 8, "eighths is not eight a bar");
  ok(K.bass(P, { ...g, bassStyle: "sixteenths" }, 1).length === 16, "sixteenths is not sixteen a bar");
  // PEDAL refuses the progression — that is the definition of it
  const ped = K.bass(P, { ...g, bassStyle: "pedal" }, g.bars);
  ok(new Set(ped.map(e => e.n)).size === 1, "the pedal bass moved off the tonic");
  ok(new Set(K.bass(P, g, g.bars).map(e => e.n)).size > 1,
     "the root bass does NOT follow the progression (so pedal proves nothing)");
}

/* ---------------------------------------------------------------- 16. THE EDGES
   intro/outro are a third type: not timeless like an operator, not a curve over
   the section like an envelope, but a rewrite of ONE bar at a known end. That is
   what lets a drum fill be a different bar rather than a louder one — and the
   test that matters is exactly that: the fill bar must contain drum events the
   section never had. */
console.log("intro and outro rewrite the first and last bar");
{
  const g = GENRES.rock, bs = 16 / g.rate, span = g.bars * bs;
  const ev = [...K.render(P, g, g.bars),
              ...K.drums(P, g, g.bars).map(e => ({ ...e, kind: "hit" }))]
    .map(e => ({ kind: e.kind || "line", ...e })).sort((a, b) => a.t - b.t);
  const inBar = l => l.filter(e => e.t < bs);
  const lastBar = l => l.filter(e => e.t >= span - bs);

  ok(K.edges(ev, null, null, span, bs) === ev, "edges with no ends copied the stream");
  for (const k of Object.keys({ count: 1, hit: 1, solo: 1, kit: 1, swell: 1 })) {
    const out = K.intro(ev, k, span, bs);
    ok(out.every(e => Number.isFinite(e.t) && e.t >= 0), "intro " + k + ": a bad time");
    // NOTHING PAST THE FIRST BAR MOVES. An intro that quietly edited bar 6 would
    // be a transition in name only.
    ok(JSON.stringify(out.filter(e => e.t >= bs)) ===
       JSON.stringify(ev.filter(e => e.t >= bs)),
       "intro " + k + " changed the section after its own bar");
  }
  ok(inBar(K.intro(ev, "solo", span, bs)).every(e => e.kind === "line"),
     "intro solo left drums in the first bar");
  ok(inBar(K.intro(ev, "kit", span, bs)).every(e => e.kind === "hit"),
     "intro kit left the melody in the first bar");
  ok(inBar(K.intro(ev, "count", span, bs)).length === 4,
     "the count-in is not four clicks");

  for (const k of Object.keys({ fill: 1, roll: 1, crash: 1, break: 1, tail: 1, cut: 1 })) {
    const out = K.outro(ev, k, span, bs);
    ok(JSON.stringify(out.filter(e => e.t < span - bs)) ===
       JSON.stringify(ev.filter(e => e.t < span - bs)),
       "outro " + k + " changed the section before its own bar");
  }
  // THE FILL IS A DIFFERENT BAR. Snare hits the section did not have, and more
  // of them in the second half than the first — which is what makes it a fill
  // rather than a busier loop.
  const fl = lastBar(K.outro(ev, "fill", span, bs)).filter(e => e.d === "s");
  const was = lastBar(ev).filter(e => e.d === "s").length;
  ok(fl.length > was, "the drum fill added no snare (was " + was + ", now " + fl.length + ")");
  ok(fl.filter(e => e.t >= span - bs / 2).length > fl.filter(e => e.t < span - bs / 2).length,
     "the fill does not accelerate into the bar line");
  ok(fl.every(e => e.fill), "a fill event is not flagged as a fill");
  const roll = lastBar(K.outro(ev, "roll", span, bs)).filter(e => e.d === "s");
  const gaps = roll.map((e, i, a) => (i ? e.t - a[i - 1].t : null)).filter(x => x != null);
  ok(gaps.every((x, i) => i === 0 || x <= gaps[i - 1]), "the roll does not accelerate");
  ok(!lastBar(K.outro(ev, "tail", span, bs)).some(e => e.kind === "hit"),
     "outro tail left the drums playing");
  ok(lastBar(K.outro(ev, "break", span, bs)).every(e => e.kind === "hit"),
     "outro break left the melody playing");
  ok(K.outro(ev, "cut", span, bs).every(e => e.t < span - bs / 4), "cut did not cut");
  // THE CRASH IS ONE GESTURE — everything in the bar lands TOGETHER on the bar
  // line and nothing plays after it. What lands is the cymbal, the kick and the
  // band's own last chord: the bar used to hold the two drums alone, which on
  // the page is two events between two bars of sixty and by ear is a record
  // that ends its chorus by switching the band off.
  {
    const cb = lastBar(K.outro(ev, "crash", span, bs));
    ok(cb.every(e => Math.abs(e.t - (span - bs)) < 1e-9), "the crash is not one gesture");
    ok(cb.filter(e => e.kind === "hit").map(e => e.d).sort().join("") === "kx",
       "the crash bar is not exactly one cymbal and one kick");
    ok(cb.some(e => e.kind !== "hit"), "the band did not land on the crash");
  }
  // and the two ends compose without either eating the other
  const both = K.edges(ev, "count", "fill", span, bs);
  ok(inBar(both).length === 4, "the outro ate the intro");
  ok(lastBar(both).some(e => e.fill), "the intro ate the outro");
}

/* --------------------------------------------------------------- 16b. THE WIDER
   INTRO VOCABULARY — added because every composed song in every genre opened
   with a drum hit: four of the five original kinds are drum gestures, and the
   composer stamped count/hit on everything else. Six new kinds, each with a
   documented signature in bar one of the RENDERED stream (test-the-artifact:
   these checks read events, never config): padin = the pad alone, bassin = the
   bass alone, riser = a rising hat ramp replacing the bar, cold = the identity
   (the absence of an intro, named), stabs = the opening chord on a sparse
   grid, fade = the one two-bar kind (a one-bar fade already exists: swell).
   All total: an unknown name is the stream unchanged. */
console.log("the wider intro vocabulary — six ways in that are not a drum hit");
{
  // vaporwave: a pad voice, a line voice, a kit and a bass — every layer the
  // new kinds discriminate on, in one stream, tagged the way derive.js tags
  const g = GENRES.vaporwave, bs = 16 / g.rate, span = g.bars * bs;
  const ev = [...K.render(P, g, g.bars),
              ...K.drums(P, g, g.bars).map(e => ({ ...e, kind: "hit" })),
              ...K.bass(P, g, g.bars).map(e => ({ ...e, kind: "bass" }))]
    .map(e => ({ kind: e.kind || "line", ...e })).sort((a, b) => a.t - b.t);
  const inBar = l => l.filter(e => e.t < bs);
  const isPad = e => e.kind === "line" && e.part === "pad";

  // NEUTRALITY, the total-function half: unknown and null are the stream
  // itself — not a copy, the same reference — so a save from before this
  // vocabulary renders byte-identically to before it existed
  ok(K.intro(ev, "nonsense", span, bs) === ev, "an unknown intro was not a no-op");
  ok(K.intro(ev, null, span, bs) === ev, "a null intro was not a no-op");

  // every one-bar kind leaves bars 2+ untouched (fade owns two bars by
  // declaration and is held to its own fence below)
  for (const k of ["padin", "bassin", "riser", "cold", "stabs"]) {
    const out = K.intro(ev, k, span, bs);
    ok(out.every(e => Number.isFinite(e.t) && e.t >= 0), "intro " + k + ": a bad time");
    ok(JSON.stringify(out.filter(e => e.t >= bs)) ===
       JSON.stringify(ev.filter(e => e.t >= bs)),
       "intro " + k + " changed the section after its own bar");
  }

  // COLD is the identity, and the claim is not vacuous: the test stream really
  // does have kit and line together on the downbeat for cold to preserve
  ok(K.intro(ev, "cold", span, bs) === ev, "cold is not the identity");
  ok(ev.some(e => e.t === 0 && e.kind === "hit") &&
     ev.some(e => e.t === 0 && e.kind === "line"),
     "the cold-open claim is vacuous — no band on the test stream's downbeat");

  const pi = inBar(K.intro(ev, "padin", span, bs));
  ok(pi.length > 0 && pi.every(isPad), "padin bar one is not the pad alone");
  const bi = inBar(K.intro(ev, "bassin", span, bs));
  ok(bi.length > 0 && bi.every(e => e.kind === "bass"),
     "bassin bar one is not the bass alone");

  // the riser: sixteen hats, velocity never falling, genuinely rising, and
  // nothing else left in the bar — it replaces, it does not decorate
  const ri = inBar(K.intro(ev, "riser", span, bs));
  ok(ri.length === 16 && ri.every(e => e.d === "h"), "the riser is not sixteen hats");
  ok(ri.every((e, i) => i === 0 || e.vel >= ri[i - 1].vel) &&
     ri[ri.length - 1].vel > ri[0].vel, "the riser does not rise");

  // stabs: the opening chord refired short at three sparse grid points, and
  // nothing else — no drums, no line, no held pad
  const st = inBar(K.intro(ev, "stabs", span, bs));
  ok(st.length > 0 && st.every(e => e.kind === "line") &&
     new Set(st.map(e => e.t)).size === 3 &&
     st.every(e => e.dur <= bs / 16),
     "stabs bar one is not the chord on a sparse grid");

  // fade: scales and never deletes; bar one under bar two, bar two under its
  // own untouched self, bars 3+ byte-identical
  const fd = K.intro(ev, "fade", span, bs);
  const mean = (l, a, b2) => { const xs = l.filter(e => e.t >= a && e.t < b2);
    return xs.reduce((s2, e) => s2 + e.vel, 0) / Math.max(1, xs.length); };
  ok(fd.length === ev.length, "fade deleted events — it must only scale");
  ok(mean(fd, 0, bs) < mean(fd, bs, 2 * bs), "fade: bar one is not under bar two");
  ok(mean(fd, bs, 2 * bs) < mean(ev, bs, 2 * bs), "fade: bar two was not pulled down");
  ok(JSON.stringify(fd.filter(e => e.t >= 2 * bs)) ===
     JSON.stringify(ev.filter(e => e.t >= 2 * bs)), "fade reached past its two bars");

  // TOTAL MEANS A BAR OF SOMETHING: on a stream without their layer, padin
  // and bassin degrade to the line, never to dead air
  const lines = ev.filter(e => e.kind === "line" && !isPad(e));
  ok(inBar(K.intro(lines, "padin", span, bs)).length > 0,
     "padin on a padless stream is a bar of dead air");
  ok(inBar(K.intro(lines, "bassin", span, bs)).length > 0,
     "bassin on a bassless stream is a bar of dead air");
}

/* ---------------------------------------------------------------- 17. ENVELOPE SHAPES */
console.log("envelope shapes and cuts");
{
  const g = GENRES.acid, span = g.bars * 16 / g.rate, ev = K.render(P, g, g.bars);
  const mid = e => Math.abs(e.t - span / 2) < span / 8;
  const sw = K.envelope(ev, "swell", span);
  ok(sw.length === ev.length, "swell changed the event count");
  ok(sw.filter(mid).every(e => e.vel > 0), "the swell is silent in the middle");
  ok(sw[0].vel < sw.filter(mid)[0].vel && sw[sw.length - 1].vel < sw.filter(mid)[0].vel,
     "the swell does not rise and fall");
  const dk = K.envelope(ev, "duck", span);
  ok(dk.filter(mid).every(e => e.vel <= sw.filter(mid)[0].vel), "duck does not duck");
  ok(K.envelope(ev, "drop", span).every(e => e.t < span * 0.875), "drop left the last eighth");
  const st = K.envelope(ev, "stutter", span);
  ok(st.length >= ev.length, "stutter removed events instead of repeating them");
  ok(st.every(e => e.t < span), "stutter ran past the end of the section");
  ok(K.envelope(ev, "nonsense", span) === ev, "an unknown envelope was not a no-op");
}

/* ---------------------------------------------------------------- 18. SPLIT CLIMBS
   A split note's copies are not copies. The step's own ramp applies once per
   repeat, which is what turns split from a stutter into an arpeggio — and is
   what anyone who set a ramp AND split the note was asking for. A step with no
   ramp must be byte-identical to the old behaviour, or every existing song
   changes underneath its author. */
console.log("split applies the ramp once per repeat");
{
  const flat = { deg: new Array(N).fill(2), oct: new Array(N).fill(0),
                 vel: new Array(N).fill(5), inc: new Array(N).fill(0),
                 stk: new Array(N).fill(0),
                 gate: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
                 acc: new Array(N).fill(0), sld: new Array(N).fill(0) };
  ok(eq(K.split(4)(flat).deg, new Array(N).fill(2)),
     "a ramp-free split moved a degree — every existing song just changed");
  const ramp = clone(flat); ramp.inc = ramp.inc.map((_, i) => (i % 4 === 0 ? 1 : 0));
  const out = K.split(4)(ramp);
  // the note at step 0 lasts four steps and splits into 0,1,2,3 — climbing
  ok(out.deg.slice(0, 4).join(",") === "2,3,4,5",
     "split did not climb by the ramp: " + out.deg.slice(0, 4).join(","));
  ok(out.gate.slice(0, 4).every(Boolean), "split did not subdivide the note");
  // ...and each subdivision keeps the ramp, so it goes on climbing every loop
  ok(out.inc.slice(0, 4).every(x => x === 1), "a subdivision lost the ramp");
  const down = clone(ramp); down.inc = down.inc.map(x => -x);
  ok(K.split(4)(down).deg.slice(0, 4).join(",") === "2,1,0,-1", "a falling ramp did not fall");
  // and it is AUDIBLE as pitch, not just as data
  const g = { ...GENRES.simple, incClamp: 0 };
  const pitches = K.render(K.split(4)(ramp), g, 1).map(e => e.n).slice(0, 4);
  ok(new Set(pitches).size === 4, "the split arpeggio came out on one pitch: " + pitches.join(","));
  ok(pitches.every((n, i) => i === 0 || n > pitches[i - 1]), "the split arpeggio does not ascend");
}

/* ---------------------------------------------------------------- 19. SWING + GROOVE
   Swing bends the grid. Groove bends the grid AND the dynamics, per sixteenth.
   They are two knobs because they are two different claims, and the test that
   matters for both is that they move real events without breaking the stream. */
console.log("groove moves time and level, and never breaks the stream");
{
  const g = GENRES.rock, bs = 16 / g.rate;
  const ev = [...K.render(P, g, g.bars),
              ...K.drums(P, g, g.bars).map(e => ({ ...e, kind: "hit" }))]
    .sort((a, b) => a.t - b.t);
  ok(K.groove(ev, null, bs, 1) === ev, "groove(null) copied the stream");
  ok(K.groove(ev, "funk", bs, 0) === ev, "groove at amount 0 is not a no-op");
  for (const name of Object.keys(K.GROOVES)) {
    const out = K.groove(ev, name, bs, 1);
    ok(out.length === ev.length, name + ": changed the event count");
    ok(out.every(e => e.t >= 0 && Number.isFinite(e.t)), name + ": produced a bad time");
    ok(out.every(e => e.vel == null || (e.vel >= 0 && e.vel <= 9)),
       name + ": left velocity out of range");
    ok(out.every((e, i) => i === 0 || e.t >= out[i - 1].t), name + ": came back unsorted");
    // it has to actually DO something, and something you could hear
    const movedT = out.filter((e, i) => Math.abs(e.t - ev[i].t) > 1e-9).length;
    const movedV = out.filter((e, i) => e.vel !== ev[i].vel).length;
    ok(movedV > 0, name + ": changed no velocity at all");
    ok(K.GROOVES[name].push ? movedT > 0 : movedT === 0,
       name + ": its timing claim and what it did disagree");
    // and it must stay INSIDE the sixteenth it belongs to — a groove that walks
    // a note onto the next step is a rewrite, not a feel
    ok(out.every((e, i) => Math.abs(e.t - ev[i].t) < bs / 16),
       name + ": moved a note further than one sixteenth");
  }
  // amount is a dial: half the profile is half the departure
  const half = K.groove(ev, "funk", bs, 0.5), full = K.groove(ev, "funk", bs, 1);
  const dev = l => l.reduce((a, e, i) => a + Math.abs(e.t - ev[i].t), 0);
  ok(dev(half) < dev(full) && dev(half) > 0, "groove amount is not a dial");
  // SWING is the other one, and it is genre-level: a section that asks for
  // straight must get straight even from a genre that swings
  const swung = K.render(P, { ...GENRES.blues, swing: 1 / 3 }, 4).map(e => e.t);
  const flatT = K.render(P, { ...GENRES.blues, swing: 0 }, 4).map(e => e.t);
  ok(swung.some((t, i) => t > flatT[i]), "swing 1/3 moved nothing");
  ok(swung.every((t, i) => t >= flatT[i]), "swing moved a note earlier");
}

/* ---------------------------------------------------------------- 20. THE COMPOSER
   A generator that runs once per button click is the hardest kind of thing to
   trust: it is right nine times and you never see the tenth. So compose every
   genre at forty seeds and check every one — the whole point of keeping the
   arranger pure and seeded is that this is cheap. */
console.log("the composer writes songs that are songs");
{
  const C = require("../../nukernel/compose.js");
  const { NSLOTS } = require("../../nukernel/fields.js");
  // floor 15: several checks below are COIN-FLIP laws over `seeds` alone
  // (reggae opening on a bed, a phrase kind drawing enough gated notes to
  // judge) — three draws cannot tell a coin from a constant.
  const seeds = Array.from({ length: seedCount(40, 15) }, (_, i) => i + 1);
  let silent = 0, unused = 0, leaps = 0, notes = 0;
  for (const gk of GK) {
    for (const s of seeds) {
      const song = C.compose(gk, s), G = GENRES[gk];
      // the shape Load reads, or it cannot come back. The bank is VARIABLE
      // (1..NSLOTS) now and the composer sizes it to what the song needs —
      // its NINE kinds of material, no blank padding. The ninth is the verse
      // line: the chorus topline's own development, which is what makes the
      // singer a through-line rather than a part that turns up twice.
      // nine kinds of material — TEN on a machine record, whose tenth is the
      // 32-step sequencer line (compose.js MACHINE_SEQ, 2026-08-18: "I expect
      // it to really go")
      ok(song.v === 2 && (song.slots.length === 9 || song.slots.length === 10) &&
         song.slots.length <= NSLOTS && song.song.length >= 6,
         gk + "/" + s + ": not the saved shape");
      ok(song.bpm >= 70 && song.bpm <= 160, gk + "/" + s + ": bpm outside the control's range");
      // a phrase's lanes agree on ONE length, 16 or 32 (the machine line is
      // the composer's first pattern longer than a bar)
      ok(song.slots.every(p => {
        const n = p.deg.length;
        return (n === 16 || n === 32) && ["deg", "oct", "vel", "gate", "acc", "sld", "inc", "stk"]
          .every(k => Array.isArray(p[k]) && p[k].length === n && p[k].every(Number.isFinite));
      }), gk + "/" + s + ": a phrase is not a valid pattern");
      const used = new Set();
      for (const b of song.song) {
        ok(C.ROLES[b.role], gk + "/" + s + ": a section has no role");
        ok(b.stack.length && b.stack.every(e => GENRES[e.g]), gk + "/" + s + ": bad stack");
        // AN INTRO BED HAS NO PHRASE BY DESIGN — four bars of drums, then the
        // bass, then the tune, which is an arrangement rather than a fade. It
        // still has to make a sound, and out of the right layer: a drums-only
        // bed with a bass part in it is not a drums-only bed.
        const bed = !!C.BEDS[b.role];
        const blank = K.mapv(P, v => v.map(() => 0));
        // MIRROR genreOf EXACTLY. A kit operator replaces the kit, and the
        // engine also drops the FILL and the ghost lane with it — without
        // that, "no drums" still plays a fill on the last bar of the form and
        // a ghost-perc layer underneath, which is not no drums.
        const g3 = b.kit
          ? { ...G, kit: K.KITOPS[b.kit](G.kit || {}), fill: null,
              kits: !G.kits ? null : b.kit === "nodrums" ? null
                : G.kits.map(k4 => K.KITOPS[b.kit](k4)),
              ghost: b.kit === "nodrums" ? null : G.ghost }
          : G;
        const dr = K.drums(blank, g3, G.bars).length;
        const bs = K.bass(blank, { ...g3, nobass: b.bassop === "nobass" }, G.bars).length;
        if (bed) {
          ok(!b.stack[0].slots.length, gk + "/" + s + ": a " + b.role +
             " bed has a melody in it — it is a bed, that is the whole idea");
          // EACH BED IS ITS OWN LAYER, and the name says which. A section called
          // "drums" with a bass part in it is not the thing the label promises.
          const want = { drums: [1, 0], bass: [0, 1], groove: [1, 1] }[b.role];
          ok(!!dr === !!want[0] && !!bs === !!want[1],
             gk + "/" + s + ": the \"" + b.role + "\" bed has " + dr + " drums and " +
             bs + " bass");
        } else if (!b.stack[0].slots.length) {
          // THE SOLO BREAK — the second place an authority legally has no
          // phrase, and the whole point of the function genres: the host is
          // reduced to its own drums and a stacked part plays over it. It is
          // held to the three facts that make it that rather than a hole: the
          // box says so in `cue`, a layer is actually playing, and the host's
          // drums are still going. (Drums come from genre data, which is why
          // an empty slot list can silence the band without silencing the kit.)
          ok(b.cue === "solobreak", gk + "/" + s + "/" + b.role +
             ": the authority has no phrase and the box does not say why");
          ok(b.stack.slice(1).some(e => e.slots.length), gk + "/" + s + "/" + b.role +
             ": the authority stopped playing and nothing took over");
          ok(dr > 0, gk + "/" + s + "/" + b.role +
             ": a solo break with the drums switched off is four bars of one guitar");
        } else ok(b.stack[0].slots.length,
                  gk + "/" + s + "/" + b.role + ": a section with no phrase");
        ok(b.len >= 1 && b.nudge >= 0, gk + "/" + s + ": bad window");
        for (const e of b.stack) for (const i of e.slots) used.add(i);
        // EVERY SECTION MUST SOUND. A composed song with a silent bridge is the
        // failure nobody reports, because it reads as a deliberate pause.
        if (bed) continue;                    // measured above, on its own terms
        const g2 = { ...G, ...(b.mode ? { mode: MODES[b.mode] } : {}) };
        let ev = 0;
        for (const e of b.stack)
          for (const i of e.slots)
            ev += K.render(song.slots[i], g2, G.bars).length +
                  K.drums(song.slots[i], g2, G.bars).length +
                  K.bass(song.slots[i], g2, G.bars).length;
        if (!ev) { silent++; ok(false, gk + "/" + s + ": the " + b.role + " is silent"); }
      }
      // IT WRITES EIGHT PHRASES. If it only ever reaches for three it has not
      // arranged anything, it has looped one idea and labelled the loops — which
      // is exactly what the arc plan was doing before this check existed.
      if (used.size < 4) unused++;
    }
    // SEEDED, so a seed is a song: the composer is reproducible or it is a slot
    // machine, and a slot machine cannot be debugged.
    ok(JSON.stringify(C.compose(gk, 9)) === JSON.stringify(C.compose(gk, 9)),
       gk + ": the same seed composed two different songs");
    ok(JSON.stringify(C.compose(gk, 9)) !== JSON.stringify(C.compose(gk, 10)),
       gk + ": two different seeds composed the same song");
    // and the plan fits the genre — a fugue does not have a drop. NO fallback:
    // PLAN_OF must carry every genre (the coverage gate below enforces it)
    const plan = C.PLANS[C.PLAN_OF[gk]];
    ok(plan && plan[0] === "intro" && plan[plan.length - 1] === "outro",
       gk + ": the plan does not start with an intro and end with an outro");
  }
  ok(!silent, silent + " composed sections are silent");
  ok(!unused, unused + " composed songs use fewer than four of their eight phrases");
  {
    // THE BED INTRO SURVIVES THE WIDER VOCABULARY. It used to be near-mandatory
    // (seven of nine shapes) — now it is one option among thirteen, weighted
    // where the tradition really does walk in on the rhythm section: reggae
    // (groove family — bassin/drums/drumbass on the ballot) still opens on
    // beds routinely, and a kitless genre still never does, because there is
    // nothing to bring in one layer at a time.
    const beds = gk => seeds.reduce((n, s) => n +
      C.compose(gk, s).song.filter(b => C.BEDS[b.role]).length, 0);
    ok(beds("reggae") > 6, "the groove family never opens on a bed (" + beds("reggae") + ")");
    for (const gk of GK) {
      if (Object.keys(GENRES[gk].kit || {}).length) continue;
      ok(beds(gk) === 0, gk + " has no drums and was given a drum intro anyway");
    }
  }
  {
    // HOW SONGS OPEN, measured across the table — the gate on "everything in
    // every genre opens with a drum hit". Every composed song stamps its
    // chosen intro kind on the head box's `cue` (the honest name; the STORED
    // `intro` chip may be a downgraded neighbour until fields.js INLABEL
    // learns the new words). Across the whole table x 8 seeds the distribution must
    // not collapse: at least eight kinds in play, no kind above 40%, no genre
    // opening identically at all eight seeds, and the family leanings audible
    // in the counts.
    const kindOf = (gk, s) => {
      const head = C.compose(gk, s).song.find(b => b.role === "intro");
      return head && head.cue;
    };
    const cnt = {}, byFam = {};
    let total = 0, mono = 0;
    for (const gk of GK) {
      const fam = GENRES[gk].family, ks = new Set();
      for (let s = 1; s <= 8; s++) {
        const k = kindOf(gk, s);
        ok(!!k, gk + "/" + s + ": the head box carries no intro cue");
        cnt[k] = (cnt[k] || 0) + 1; total++;
        (byFam[fam] = byFam[fam] || {})[k] = (byFam[fam][k] || 0) + 1;
        ks.add(k);
      }
      if (ks.size < 2) mono++;
    }
    ok(Object.keys(cnt).length >= 8, "only " + Object.keys(cnt).length +
       " intro kinds in play across the whole table");
    for (const [k, n] of Object.entries(cnt))
      ok(n / total <= 0.4, "intro kind \"" + k + "\" opens " +
         Math.round(100 * n / total) + "% of all songs — the vocabulary collapsed");
    ok(mono === 0, mono + " genres open identically at all eight seeds");
    // three family leanings, spot-checked as a share of the family's songs
    const share = (fam, kinds) => {
      const m = byFam[fam] || {}, all = Object.values(m).reduce((a, b) => a + b, 0);
      return kinds.reduce((a, k) => a + (m[k] || 0), 0) / Math.max(1, all);
    };
    ok(share("club", ["riser", "kit", "cold"]) >= 0.5,
       "club does not lean riser/kit/cold");
    // family LEAN is a weighted-ballot statistic — real at the full roster
    // (13 soul genres x 8 seeds), noisy at the two-genre fast sample, so FAST
    // only asks that the bass-walk-in happens at all, not that it dominates.
    ok(SWEEP ? share("soul", ["bassin", "stabs", "drumbass"]) >= 0.4
             : share("soul", ["bassin", "stabs", "drumbass"]) > 0,
       "soul does not walk in on the bass");
    ok(share("drift", ["padin", "fade", "solo", "swell"]) >= 0.5,
       "drift does not lean padin/fade/solo/swell");
    // ...and no family opens on percussion wall to wall
    for (const [fam, m] of Object.entries(byFam))
      ok(["padin", "bassin", "fade", "solo", "swell", "stabs", "cold"]
           .some(k => m[k]), fam + ": every opening is a drum gesture");
    // the ballots are covered and legal: one per family, every vote a kind the
    // kernel edge or the bed path knows — and every anchor `intro` field too
    const KINDS = new Set(["count", "hit", "solo", "kit", "swell", "padin",
                           "bassin", "riser", "cold", "stabs", "fade",
                           "drums", "drumbass", "quote"]);
    for (const [fam] of FAMILIES) {
      ok(Array.isArray(C.INTRO_LEAN[fam]) && C.INTRO_LEAN[fam].length,
         fam + ": no INTRO_LEAN ballot");
      for (const k of C.INTRO_LEAN[fam] || [])
        ok(KINDS.has(k), fam + ": unknown intro kind \"" + k + "\" on the ballot");
    }
    for (const gk of GK)
      if (GENRES[gk].intro != null)
        ok(KINDS.has(GENRES[gk].intro), gk + ": anchor intro \"" +
           GENRES[gk].intro + "\" is not a known kind");
    // THE REGISTRY BRIDGE HOLDS: whatever the cue says, the stored chip is a
    // value the loader's enum accepts (§21's round-trip proves it the long way)
    const INLABEL2 = require("../../nukernel/fields.js").INLABEL;
    for (const gk of ["rock", "house", "funk", "ambient", "fugue", "dub"])
      for (let s = 1; s <= 8; s++)
        for (const b of C.compose(gk, s).song)
          ok(b.intro == null || INLABEL2[b.intro] != null,
             gk + "/" + s + ": stored intro \"" + b.intro + "\" is not in the registry");
    // THE ANCHOR'S SAY IS AUDIBLE: the genres whose identity dictates their
    // opening lead with it — the fugue with the subject alone, dub on the bass
    const lead = gk => { const m = {};
      for (let s = 1; s <= 16; s++) { const k = kindOf(gk, s); m[k] = (m[k] || 0) + 1; }
      return Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]; };
    ok(lead("fugue") === "solo", "fugue does not lead with the subject alone");
    ok(lead("dub") === "bassin", "dub does not walk in on the bass");
    // THE BAND ENTERS AFTER THE DOOR: whatever the intro did, the first verse
    // carries no FADE of its own — a padin or riser opening resolves into a
    // full section, not a second arrival. It does carry a DYNAMIC (the arc
    // decides how big a verse is against the chorus it points at), and the two
    // are different fields of the same enum: a fade touches zero and is an
    // entrance, a dynamic never does and is a size. Written as the fade list
    // rather than as `== null` so it stays a check about arriving twice.
    const FADES = new Set(["in", "swell", "duck", "drop", "stutter"]);
    for (const gk of ["house", "rock", "ambient"])
      for (let s = 1; s <= 8; s++) {
        const song = C.compose(gk, s);
        const vi = song.song.findIndex(b => b.role === "verse");
        ok(vi > 0 && !FADES.has(song.song[vi].env),
           gk + "/" + s + ": the verse after the intro fades instead of entering");
      }
  }
  {
    let spent = 0;
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), u = new Set();
      for (const b of song.song) for (const e of b.stack) for (const i of e.slots) u.add(i);
      spent += u.size;
    }
    const avg = spent / (GK.length * seeds.length);
    ok(avg >= 5.5, "the composer spends only " + avg.toFixed(1) + " of its eight phrases on average");
  }
  // THE PHRASES ARE WALKS, NOT NOISE. A tune moves mostly by step; if the
  // average interval is a fifth, the composer is a random number generator with
  // a nice comment on it. The HOOK KINDS get a looser fence on purpose: the
  // climax is a DESIGNED leap (one note raised above everything, that is its
  // job) and the cell joins of an A A B A' layout are two more — their noise
  // check is the motif-repetition gate below, which no random walk can pass.
  for (const kind of ["hook", "topline", "answer", "riff", "counter", "climb"]) {
    const fence = kind === "hook" || kind === "topline" ? 0.38 : 0.25;
    let big = 0, all = 0;
    for (const s of seeds) {
      const p = C.phrase(C.rng(s * 31), kind);
      const on = p.deg.filter((_, i) => p.gate[i]);
      for (let i = 1; i < on.length; i++) { all++; if (Math.abs(on[i] - on[i - 1]) > 2) big++; }
    }
    ok(all > 20, kind + ": too few notes to judge");
    ok(big / all < fence, kind + ": " + Math.round(100 * big / all) +
       "% of its intervals are leaps — that is noise, not a phrase");
  }
  void leaps; void notes;
}

/* ---------------------------------------------------------------- 21. THE LOADER
   song.js is the one gate every song passes — localStorage, files, presets,
   the composer — and until it was pure it was tested only by a browser. Now
   the whole contract is provable here: round trip, typed errors, migration. */
console.log("the loader — round trip, typed errors, clamps, migration");
{
  const S = require("../../nukernel/song.js");
  const F = require("../../nukernel/fields.js");
  const NI = require("../../nukernel/instruments.js");
  const C = require("../../nukernel/compose.js");
  const { PRESETS } = require("../../nukernel/presets.js");
  const seeds = Array.from({ length: seedCount(40) }, (_, i) => i + 1);

  // (a) ROUND TRIP: everything the composer can emit, the loader accepts —
  // the contract that used to be one browser smoke check, now exhaustive.
  for (const gk of GK) for (const s of seeds) {
    const res = S.validateSong(C.compose(gk, s));
    ok(res.ok, gk + "/" + s + ": the loader refused a composed song — " +
       (res.errors[0] && res.errors[0].path));
  }
  // ...and through the full path, any-version in
  ok(S.load(C.compose("rock", 3)).ok, "load() refused a composed song");

  // (b) REGISTRY COVERAGE: every fields.js entry is complete. The registry is
  // the single definition of every control, so an incomplete entry is a chip
  // the palette cannot draw or a field validation cannot check.
  for (const f of F.FIELDS) {
    ok(typeof f.key === "string" && f.key, "a fields entry has no key");
    ok(f.scope === "box" || f.scope === "layer", f.key + ": scope is not box|layer");
    ok(typeof f.tab === "string" && f.tab, f.key + ": no palette tab");
    ok(typeof f.group === "string" && f.group, f.key + ": no group title");
    if (f.type === "int") {
      ok(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min <= f.max,
         f.key + ": int field without a [min,max]");
      ok(Number.isFinite(f.default) && f.default >= f.min && f.default <= f.max,
         f.key + ": default outside its own range");
      continue;
    }
    // "num" is the fader-offset family: a range, no table, absent-by-default
    // (null, not 0 — absent must stay the one spelling of "no offset")
    if (f.type === "num") {
      ok(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min <= f.max,
         f.key + ": num field without a [min,max]");
      ok(f.default === null, f.key + ": num default is not null (absent = no offset)");
      continue;
    }
    // "eq" is the strip-EQ family: a band list instead of a table, absent
    // (flat) by default — the bands themselves are checked in §37d
    if (f.type === "eq") {
      ok(Array.isArray(f.bands) && f.bands.length, f.key + ": eq field without a band list");
      ok(f.default === null, f.key + ": eq default is not null (absent = flat)");
      continue;
    }
    ok(f.table && typeof f.table === "object" && Object.keys(f.table).length,
       f.key + ": no value table");
    ok(f.labels && Object.keys(f.table).every(k => f.labels[k] != null),
       f.key + ": a table value has no label");
    if (f.type === "list") ok(Array.isArray(f.default), f.key + ": list default is not []");
    else ok(f.default === null, f.key + ": enum default is not null (absent = genre's own)");
  }
  // the registry and the constructor agree on what a box IS
  {
    const b = S.emptyBox();
    for (const f of F.FIELDS)
      if (f.type !== "vox") ok(f.key in b, "emptyBox is missing registry field " + f.key);
    const wrapped = { v: 2, slots: [S.blank()], song: [b], bpm: 126, vol: 80 };
    ok(S.validateSong(wrapped).ok, "emptyBox does not validate");
  }

  // (c) EXHAUSTIVE TOGGLE: every value in the registry, applied to a fresh
  // box, must produce a song the loader accepts — so no palette chip can ever
  // write a song that refuses to come back.
  const trial = box => S.validateSong(
    { v: 2, slots: [S.blank()], song: [box], bpm: 126, vol: 80 });
  for (const f of F.FIELDS) {
    if (f.type === "int" || f.type === "num") continue;  // clamped, checked below
    if (f.type === "eq") {                               // every band, one at a time
      for (const bd of f.bands) {
        const b = S.emptyBox(); b[f.key] = { [bd.key]: 6 };
        const r = trial(b);
        ok(r.ok, f.key + "." + bd.key + " on the box: loader refused — " +
           (r.errors[0] && r.errors[0].path));
      }
      continue;
    }
    for (const k of Object.keys(f.table)) {
      const b = S.emptyBox();
      if (f.type === "list") b[f.key] = [k];
      else if (f.type === "vox") b.vox = { [f.key]: k };
      // a "parts" table lists PART NAMES, and the value under one is a mix
      // entry — so the exhaustive toggle exercises the real map shape (an
      // entry per name, carrying one of every sub-field it can carry)
      else if (f.type === "parts")
        b[f.key] = { [k]: { fx: ["chorus"], rev: "wet", echo: "touch",
                            lvl: "hush", pan: "l", mute: true, solo: false } };
      else b[f.key] = k;
      let r = trial(b);
      ok(r.ok, f.key + "=" + k + " on the box: loader refused — " +
         (r.errors[0] && r.errors[0].path));
      if (f.scope === "layer") {                     // and on a stack entry
        const b2 = S.emptyBox();
        if (f.type === "list") b2.stack[0][f.key] = [k];
        else if (f.type === "vox") b2.stack[0].vox = { [f.key]: k };
        else b2.stack[0][f.key] = k;
        r = trial(b2);
        ok(r.ok, f.key + "=" + k + " on a layer: loader refused — " +
           (r.errors[0] && r.errors[0].path));
      }
    }
  }
  // typed errors: a bad value names its field instead of shrugging
  {
    const b = S.emptyBox(); b.rev = "soaked";
    const r = trial(b);
    ok(!r.ok && /\.rev$/.test(r.errors[0].path),
       "a bad send did not name its own field: " + JSON.stringify(r.errors[0]));
  }
  // the clamps: a hand-edited len of 1e9 comes back as MAX_LEN, not a hung tab
  {
    const b = S.emptyBox(); b.len = 1e9; b.nudge = -5;
    const r = trial(b);
    ok(r.ok && r.song.song[0].len === F.MAX_LEN && r.song.song[0].nudge === 0,
       "len/nudge are not clamped into range: " +
       (r.ok ? r.song.song[0].len + "/" + r.song.song[0].nudge : "rejected"));
  }
  // the filter rule: unknown ops/fx are dropped, never fatal — a song loses an
  // obsolete chip rather than losing itself
  {
    const b = S.emptyBox(); b.ops = ["rev", "nonsense"]; b.fx = ["chorus", "nonsense"];
    const r = trial(b);
    ok(r.ok && r.song.song[0].ops.join(",") === "rev" &&
       r.song.song[0].fx.join(",") === "chorus",
       "the ops/fx filter rule does not filter");
  }

  // (d) GENRE COVERAGE: a genre is instrument + plan + tempo as much as it is
  // a kit — and none of them may default silently. Three tables used to fall
  // back (piano / pop plan / 120 bpm) and nothing could notice a rotted entry.
  // GK_FULL: this IS the coverage walk that catches a genre throwing on
  // write (CLAUDE.md: "a genre added without them throws the moment anyone
  // presses WRITE") — a sample can't tell a rotted row from a row not drawn.
  for (const gk of GK_FULL) {
    const g = GENRES[gk];
    ok(typeof g.instr === "string" ||
       (Array.isArray(g.instr) && g.instr.length && g.instr.every(x => typeof x === "string")),
       gk + ": no `instr` in genres.js");
    for (let v = 0; v < g.voices; v++)
      ok(typeof NI.instrOf(gk, v) === "string", gk + ": instrOf failed for voice " + v);
    ok(C.PLANS[C.PLAN_OF[gk]], gk + ": no PLAN_OF entry");
    ok(Number.isFinite(C.BPM[gk]) && C.BPM[gk] >= 70 && C.BPM[gk] <= 160,
       gk + ": no BPM entry in the control's range");
  }
  // ...and the miss is LOUD, not a polite piano
  {
    let threw = false;
    try { NI.instrOf("no_such_genre", 0); } catch (e) { threw = true; }
    ok(threw, "instrOf did not throw for a genre without an instrument");
  }
  // ...and every id NAMES A REAL SAMPLER. instrOf proves the field exists;
  // this proves the string means something — a typo'd id used to sail through
  // node and fail only in a browser with the sample layer fetched. The
  // registry is a classic window-global script, so it is read here the way
  // the page reads it: evaluated, not required.
  {
    const vm = require("vm"), fs = require("fs"), path = require("path");
    const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(
      path.join(__dirname, "../../engine/registry-data.js"), "utf8"), ctx);
    const SAMPLERS = (ctx.__REGISTRY && ctx.__REGISTRY.SAMPLERS) || {};
    ok(Object.keys(SAMPLERS).length > 100, "registry-data.js did not yield SAMPLERS");
    ok(SAMPLERS[NI.BASS_INSTR], "BASS_INSTR is not a registry sampler");
    for (const gk of GK) {
      const e = GENRES[gk].instr, ids = Array.isArray(e) ? e : [e];
      for (const id of ids)
        ok(!!SAMPLERS[id], gk + ": instr \"" + id + "\" is not a SAMPLERS id");
    }
  }

  // (e) MIGRATION: the shipped preset (v:1, pre-stack, pre-mixer) and a v:1
  // fixture with every legacy wrinkle still load after the v:2 bump.
  {
    const r = S.load(PRESETS[0].data);
    ok(r.ok, "the shipped preset no longer loads: " +
       JSON.stringify(r.errors && r.errors[0]));
    ok(PRESETS[0].data.v === 1, "migrate MUTATED the shipped preset literal");
    const r2 = S.load(PRESETS[0].data);
    ok(r2.ok, "the shipped preset does not survive being loaded twice");
    // ...and EVERY shipped preset, whatever its vintage: the radio-dial four
    // are composer output frozen as literals, and they take the same door
    for (const p of PRESETS) {
      const ra = S.load(p.data), rb = S.load(p.data);
      ok(ra.ok && rb.ok, "shipped preset \"" + p.name + "\" no longer loads twice: " +
         JSON.stringify((ra.errors || rb.errors || [])[0]));
    }
  }
  {
    const oldPhrase = () => ({ deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                               vel: new Array(16).fill(5), gate: new Array(16).fill(1),
                               acc: new Array(16).fill(0), sld: new Array(16).fill(0) });
    const v1 = { v: 1, slots: [oldPhrase(), oldPhrase()],   // short bank, no inc/stk
                 song: [{ genre: "acid", slots: [0], len: 4, nudge: 0,
                          ops: ["rev"], del: "some" }],     // pre-stack, old `del`
                 bpm: 126, vol: 80 };
    const r = S.load(v1);
    ok(r.ok, "a v:1 save no longer loads: " + JSON.stringify(r.errors && r.errors[0]));
    if (r.ok) {
      const b = r.song.song[0];
      ok(b.stack && b.stack[0].g === "acid", "the stack climb is gone");
      ok(b.echo === "some" && !("del" in b), "del was not renamed to echo");
      // variable banks: a short bank KEEPS its length now (it used to be
      // padded to a fixed eight) — the only growth left is reference cover,
      // and this save's one reference (slot 0) is already covered
      ok(r.song.slots.length === 2, "a 2-slot v:1 bank did not stay 2 slots " +
         "(got " + r.song.slots.length + ")");
      ok(r.song.slots.every(p => Array.isArray(p.inc) && Array.isArray(p.stk)),
         "the ramp vectors were not backfilled");
      ok(r.song.v === 2, "migrate did not stamp the current version");
    }
  }

  // (f) THE GROOVE LIFT — the groove belongs to the SONG now, the way the
  // tempo does ("one drummer for the record", 2026-08-16). Four claims: the
  // registry no longer says `groove` (the ONE place validation, the palette
  // and the audio walk all lost the box field), the composer emits it at song
  // level and it round-trips, an old per-box save adopts the groove most
  // sections agree on (ties to the first — the authority), and the shipped
  // presets — every one of them per-box vintage — come through lifted.
  {
    ok(!F.FIELDS.some(f => f.key === "groove"),
       "fields.js still carries a per-section groove entry");
    ok(F.GROOVELABEL && Object.keys(F.GROOVELABEL).length >= 5,
       "GROOVELABEL left the registry — the song control has no vocabulary");
    // the composer: song-level, boxes clean, and the value survives the loader
    let grooved = 0;
    for (const s of seeds.slice(0, 12)) {
      const c = C.compose("isley", s);
      ok(c.song.every(b => b.groove === undefined),
         "isley/" + s + ": the composer still stamps a groove on boxes");
      const r = S.load(c);
      ok(r.ok && (r.song.groove || null) === (c.groove || null),
         "isley/" + s + ": the song-level groove did not round-trip");
      if (c.groove != null) grooved++;
    }
    ok(grooved > 0, "the composer never draws a groove for isley — the ballot is dead");
    // the lift itself: majority wins, the box field dies on the way through
    const mkB = g2 => { const b = S.emptyBox();
                       if (g2 !== undefined) b.groove = g2; return b; };
    const lift = boxes => S.load(
      { v: 2, slots: [S.blank()], song: boxes, bpm: 126, vol: 80 });
    let r = lift([mkB("funk"), mkB("dub"), mkB("dub")]);
    ok(r.ok && r.song.groove === "dub",
       "the majority groove did not win the lift: " + (r.ok && r.song.groove));
    ok(r.ok && r.song.song.every(b => !("groove" in b)),
       "the lift left per-box grooves behind");
    // ...ties go to the FIRST section carrying one — the authority
    r = lift([mkB("funk"), mkB("dub")]);
    ok(r.ok && r.song.groove === "funk",
       "a tie did not go to the authority section: " + (r.ok && r.song.groove));
    r = lift([mkB(null), mkB("push"), mkB("laidback")]);
    ok(r.ok && r.song.groove === "push",
       "a leading null outvoted the first real groove: " + (r.ok && r.song.groove));
    // ...an all-null save stays flat, a groove-free save normalizes to null
    r = lift([mkB(null), mkB(null)]);
    ok(r.ok && r.song.groove === null, "an all-null lift invented a groove");
    r = lift([mkB(), mkB()]);
    ok(r.ok && r.song.groove === null,
       "a groove-free save did not normalize to song groove null");
    // ...a v:1 save takes the same lift on its way up the versions
    const rv1 = S.load({ v: 1, slots: [S.blank()],
                         song: [{ genre: "acid", slots: [0], len: 4, nudge: 0,
                                  ops: [], groove: "push" }],
                         bpm: 126, vol: 80 });
    ok(rv1.ok && rv1.song.groove === "push" && !("groove" in rv1.song.song[0]),
       "a v:1 save did not lift its groove");
    // ...an unknown SONG groove drops to null, never fatal — the tempo's policy
    r = S.load({ v: 2, slots: [S.blank()], song: [S.emptyBox()],
                 groove: "sludgy", bpm: 126, vol: 80 });
    ok(r.ok && r.song.groove === null,
       "an unknown song groove was not dropped to null");
    // the shipped presets: every box comes through clean, and at least one
    // record lifts a real groove (they are composer output, per-box vintage)
    let liftedPresets = 0;
    for (const p of PRESETS) {
      const rp = S.load(p.data);
      ok(rp.ok && rp.song.song.every(b => !("groove" in b)),
         "preset \"" + p.name + "\" kept a per-box groove");
      if (rp.ok && rp.song.groove != null) liftedPresets++;
    }
    ok(liftedPresets > 0,
       "no shipped preset lifted a groove — the lift is dead on real data");
  }

  // (g) THE SWING LIFT — the same move made twice ("nothing in a section
  // tells time", 2026-08-16): swing left the boxes for the song exactly the
  // way the groove did, so it takes exactly the groove's claims — the
  // registry no longer says `swing`, the composer emits it at song level and
  // it round-trips, an old per-box save adopts the majority (ties to the
  // authority), and the shipped presets come through lifted.
  {
    ok(!F.FIELDS.some(f => f.key === "swing"),
       "fields.js still carries a per-section swing entry");
    ok(F.SWINGLABEL && Object.keys(F.SWINGLABEL).length >= 5,
       "SWINGLABEL left the registry — the song control has no vocabulary");
    // the composer: song-level, boxes clean, and the value survives the loader
    let swung = 0;
    for (const s of seeds.slice(0, 12)) {
      const c = C.compose("isley", s);
      ok(c.song.every(b => b.swing === undefined),
         "isley/" + s + ": the composer still stamps a swing on boxes");
      const r = S.load(c);
      ok(r.ok && (r.song.swing || null) === (c.swing || null),
         "isley/" + s + ": the song-level swing did not round-trip");
      if (c.swing != null) swung++;
    }
    ok(swung > 0, "the composer never draws a swing for isley — the ballot is dead");
    // the lift itself: majority wins, the box field dies on the way through
    const mkB = v => { const b = S.emptyBox();
                       if (v !== undefined) b.swing = v; return b; };
    const lift = boxes => S.load(
      { v: 2, slots: [S.blank()], song: boxes, bpm: 126, vol: 80 });
    let r = lift([mkB("light"), mkB("shuffle"), mkB("shuffle")]);
    ok(r.ok && r.song.swing === "shuffle",
       "the majority swing did not win the lift: " + (r.ok && r.song.swing));
    ok(r.ok && r.song.song.every(b => !("swing" in b)),
       "the lift left per-box swings behind");
    // ...ties go to the FIRST section carrying one — the authority
    r = lift([mkB("light"), mkB("shuffle")]);
    ok(r.ok && r.song.swing === "light",
       "a tie did not go to the authority section: " + (r.ok && r.song.swing));
    r = lift([mkB(null), mkB("hard"), mkB("swing")]);
    ok(r.ok && r.song.swing === "hard",
       "a leading null outvoted the first real swing: " + (r.ok && r.song.swing));
    // ...an all-null save stays default, a swing-free save normalizes to null
    r = lift([mkB(null), mkB(null)]);
    ok(r.ok && r.song.swing === null, "an all-null lift invented a swing");
    r = lift([mkB(), mkB()]);
    ok(r.ok && r.song.swing === null,
       "a swing-free save did not normalize to song swing null");
    // ...a v:1 save takes the same lift on its way up the versions
    const rv1 = S.load({ v: 1, slots: [S.blank()],
                         song: [{ genre: "acid", slots: [0], len: 4, nudge: 0,
                                  ops: [], swing: "shuffle" }],
                         bpm: 126, vol: 80 });
    ok(rv1.ok && rv1.song.swing === "shuffle" && !("swing" in rv1.song.song[0]),
       "a v:1 save did not lift its swing");
    // ...an unknown SONG swing drops to null, never fatal — the tempo's policy
    r = S.load({ v: 2, slots: [S.blank()], song: [S.emptyBox()],
                 swing: "wonky", bpm: 126, vol: 80 });
    ok(r.ok && r.song.swing === null,
       "an unknown song swing was not dropped to null");
    // ...and BOTH lifts ride one save together without crosstalk
    const both = S.load({ v: 2, slots: [S.blank()],
                          song: [Object.assign(S.emptyBox(),
                                               { groove: "dub", swing: "shuffle" })],
                          bpm: 126, vol: 80 });
    ok(both.ok && both.song.groove === "dub" && both.song.swing === "shuffle" &&
       !("groove" in both.song.song[0]) && !("swing" in both.song.song[0]),
       "the groove and swing lifts interfere on one save");
    // the shipped presets: every box comes through clean, and at least one
    // record lifts a real swing (they are composer output, per-box vintage)
    let liftedPresets = 0;
    for (const p of PRESETS) {
      const rp = S.load(p.data);
      ok(rp.ok && rp.song.song.every(b => !("swing" in b)),
         "preset \"" + p.name + "\" kept a per-box swing");
      if (rp.ok && rp.song.swing != null) liftedPresets++;
    }
    ok(liftedPresets > 0,
       "no shipped preset lifted a swing — the lift is dead on real data");
  }

  // (h) THE INSTR LIFT — the third move in the family ("the band is hired for
  // the record, not the scene", 2026-08-16): the per-layer `instr` override
  // left the stack entries for ONE song-level INSTRUMENT POOL, keyed by CHAIR
  // (the kernel's own roles plus the bass). Claims: the registry no longer
  // says `instr` (registry death), the chair vocabulary exists, an old save's
  // overrides lift per chair — majority wins, ties to the authority section,
  // the entry field dies — an explicit pool beats stragglers, junk filters to
  // null, and the pool round-trips.
  {
    ok(!F.FIELDS.some(f => f.key === "instr"),
       "fields.js still carries a per-layer instr entry");
    ok(Array.isArray(F.POOLCHAIRS) && F.POOLCHAIRS.length === 8 &&
       F.POOLCHAIRS.includes("bass") && F.POOLCHAIRS.includes("line") &&
       !F.POOLCHAIRS.includes("drums"),
       "POOLCHAIRS is not the seven roles plus the bass (drums excluded)");
    ok(Object.keys(F.INSTRCHOICES).length >= 40,
       "INSTRCHOICES left the registry — the pool has no vocabulary");
    // one override on a ska box casts BOTH its chairs (stab voice 0, lead
    // voice 1 — the kernel's own scheme), because the old field spoke for
    // every voice of its layer
    const box = (gk, instr) => {
      const b = S.emptyBox(); b.stack[0].g = gk;
      if (instr !== undefined) b.stack[0].instr = instr;
      return b;
    };
    const lift = boxes => S.load(
      { v: 2, slots: [S.blank()], song: boxes, bpm: 126, vol: 80 });
    let r = lift([box("ska", "flute"), box("ska", "trumpet"), box("ska", "trumpet")]);
    ok(r.ok && r.song.pool && r.song.pool.lead === "trumpet" &&
       r.song.pool.stab === "trumpet",
       "the majority instrument did not win the lift per chair: " +
       JSON.stringify(r.ok && r.song.pool));
    ok(r.ok && r.song.song.every(b => b.stack.every(e => !("instr" in e))),
       "the lift left per-layer instr overrides behind");
    // ...ties go to the FIRST section carrying one — the authority
    r = lift([box("ska", "flute"), box("ska", "trumpet")]);
    ok(r.ok && r.song.pool && r.song.pool.lead === "flute",
       "a tie did not go to the authority section: " +
       JSON.stringify(r.ok && r.song.pool));
    // the chair follows the kernel's assignment INCLUDING the part chip — the
    // same three-step read the scheduler makes
    const pb = box("ska", "marimba"); pb.stack[0].part = "riff";
    r = lift([pb]);
    ok(r.ok && r.song.pool && r.song.pool.riff === "marimba" && !r.song.pool.lead,
       "the lift ignores the part chip the scheduler honours: " +
       JSON.stringify(r.ok && r.song.pool));
    // a save already carrying a pool wins over straggler overrides — the
    // groove's own both-present rule — and the entry field still dies
    r = S.load({ v: 2, slots: [S.blank()], song: [box("ska", "flute")],
                 pool: { lead: "violin" }, bpm: 126, vol: 80 });
    ok(r.ok && r.song.pool.lead === "violin" && !r.song.pool.stab &&
       r.song.song.every(b => b.stack.every(e => !("instr" in e))),
       "an explicit pool did not beat the lift, or the field survived");
    // FILTER at both levels (an unknown chair or id is dropped, never fatal —
    // the ops/fx rule), and an emptied pool normalizes to null
    r = S.load({ v: 2, slots: [S.blank()], song: [S.emptyBox()],
                 pool: { lead: "kazoo9000", drums: "trumpet", zzz: "trumpet" },
                 bpm: 126, vol: 80 });
    ok(r.ok && r.song.pool === null,
       "junk chairs and ids did not filter away to a null pool");
    // the pool round-trips byte-for-byte through the loader
    r = lift([box("ska", "trumpet")]);
    const rt = S.load(JSON.parse(JSON.stringify(r.song)));
    ok(rt.ok && JSON.stringify(rt.song.pool) === JSON.stringify(r.song.pool),
       "the pool does not round-trip through the loader");
    // no shipped writer emits the retired field
    for (const p of PRESETS) {
      const rp = S.load(p.data);
      ok(rp.ok && rp.song.song.every(b => b.stack.every(e => !("instr" in e))),
         "preset \"" + p.name + "\" kept a per-layer instr");
    }
  }
}

/* ---------------------------------------------------------------- 22. NEUTRALITY
   Every field the composition-depth round added is OPT-IN: absent must render
   byte-identically to the field set to its documented neutral value, and the
   old semantics must still be derivable from first principles. This is the
   gate that lets the depth land without moving a single existing song. */
console.log("neutrality — absent equals neutral for every new field");
{
  const sig2 = ev => JSON.stringify(ev.map(e => [e.t, e.n, e.d, e.dur, e.vel, e.acc, e.sld]));
  // reference genres left unwired FOR THESE FIELDS on purpose — they are the
  // control group for the composition-depth surface. (They are not a control
  // group for everything: the performance layer wires four of the five, and
  // its own absent-equals-neutral law is §39(b), which strips the three fields
  // it added rather than pretending nobody set them.)
  // (acid left this control group on 2026-08-18: its drum mix is a kitVel
  // hand now, so it is wired for one of the fields under test — motorik is
  // the machine-four control in its place.)
  for (const gk of ["motorik", "fugue", "vaporwave", "gregorian", "rock"]) {
    const g = GENRES[gk];
    const neutral = { ...g, maxHold: 0, key: 0, period: null, kits: null,
                      kitVel: null, prog: null, pipes: null, part: null, anchor: 0 };
    ok(sig2(allEvents(P, g, g.bars)) === sig2(allEvents(P, neutral, g.bars)),
       gk + ": neutral values do not render identically to absent fields");
  }
  // the OLD PAD SEMANTICS, recomputed from scratch: a progression-less pad is
  // the bar's mode triad, per-note folded, one chord a bar, held a whole bar
  {
    const g = GENRES.vaporwave, md = g.mode || K.MODE, ctr = 60 + 12 * g.reg(0);
    const pads = K.render(P, g, g.bars).filter(e => e.v === 0);
    for (let b = 0; b < g.bars; b++) {
      const r = K.harm(P, g, b);
      const want = [r, r + 2, r + 4].map(d => K.fold(K.mp(d, md), ctr)).sort((x, y) => x - y);
      const got = pads.filter(e => Math.abs(e.t - b * 16 / g.rate) < 1e-9)
                      .map(e => e.n).sort((x, y) => x - y);
      ok(JSON.stringify(got) === JSON.stringify(want),
         "vaporwave bar " + b + ": pad chord is not the old fold(mp) voicing");
      ok(pads.every(e => Math.abs(e.dur - 16 / g.rate) < 1e-9),
         "vaporwave: a prog-less pad no longer holds the whole bar");
    }
  }
  // the OLD DURATION SEMANTICS: without maxHold, dur is exactly the span to
  // the next gate, scaled by the articulation, slide-held where the successor
  // slides — recomputed here so a silent regression in the cap has a witness
  {
    const g = GENRES.simple, sp = K.spans(P.gate);
    const ev = K.render(P, g, 1);
    let k = 0;
    for (let i = 0; i < 16; i++) {
      if (!P.gate[i]) continue;
      const legato = P.sld[(i + sp[i]) % 16] ? 1 : 0.92;
      ok(Math.abs(ev[k].dur - sp[i] * legato) < 1e-9,
         "simple step " + i + ": dur is not span × articulation any more");
      k++;
    }
  }
}

/* ---------------------------------------------------------------- 23. PROGRESSION
   Chord OBJECTS — quality, inversion, borrow, beats, cadence — and the gate is
   the recon's own: sevenths are audible or they do not exist. Every assertion
   reads the RENDERED events; a prog that is declared and never voiced fails. */
console.log("progression — quality, inversion, half-bar chords, cadence, voice leading");
{
  const pcsOf = ev => new Set(ev.map(e => ((e.n % 12) + 12) % 12));
  const barOf = (ev, b, bs) => ev.filter(e => e.t >= b * bs && e.t < (b + 1) * bs);
  const base = { label: "t", rate: 1, bars: 4, voices: 2, entry: () => 0, reg: v => v - 1,
                 realize: v => (v === 0 ? "pad" : "line"), kit: {}, harmony: "cycle",
                 roots: [0, 3, 4, 0], word: () => [] };
  const all = g2 => [...K.render(P, g2, g2.bars), ...K.bass(P, g2, g2.bars)];

  // (a) DOM7 REACHES THE OUTPUT: the V7's major third (pc 11 over a minor
  // tonic) sounds in the dom7 bar and does not sound without the prog
  const withP = { ...base, prog: [{ d: 0 }, { d: 3 }, { d: 4, q: "dom7" }, { d: 0 }] };
  ok(pcsOf(barOf(all(withP), 2, 16)).has(11),
     "a dom7 chord never sounded its major third — the prog is decoration");
  ok(!pcsOf(barOf(all(base), 2, 16)).has(11),
     "the triad control already contains pc 11 — the dom7 gate proves nothing");
  // ...and the SEVENTH is a rung the ramp can land on (chordWalk honors quality)
  {
    const g7 = { ...base, voices: 1, realize: () => "line", incClamp: 0, bars: 8,
                 roots: [0], prog: [{ d: 0, q: "dom7" }] };
    const ramp = { ...clone(P), deg: new Array(N).fill(0), oct: new Array(N).fill(0),
                   inc: P.gate.map((g3, i) => (i === 0 ? 1 : 0)), stk: new Array(N).fill(0) };
    ok(pcsOf(K.render(ramp, g7, 8)).has(10),
       "a ramp over a dom7 never landed on the seventh — the rungs are still triadic");
  }

  // (b) INVERSION: inv:1 puts the THIRD under the band — the bass bar's pc is
  // the third's, not the root's
  {
    const inv = { ...base, roots: [0, 0, 0, 0], prog: [{ d: 0, inv: 1 }] };
    const bpc = new Set(K.bass(P, inv, 4).map(e => ((e.n % 12) + 12) % 12));
    ok(bpc.has(3) && !bpc.has(0),
       "inv:1 did not move the bass to the third (got " + [...bpc].join(",") + ")");
  }

  // (c) BEATS: two chords in ONE bar — the half-bar turnaround that used to be
  // inexpressible. The pad must emit at two distinct times inside the bar.
  {
    const half = { ...base, prog: [[{ d: 0, beats: 8 }, { d: 4, q: "dom7", beats: 8 }],
                                   { d: 3 }, { d: 4 }, { d: 0 }] };
    const padT = new Set(K.render(P, half, 4).filter(e => e.part === "pad" && e.t < 16)
      .map(e => e.t));
    ok(padT.size === 2 && padT.has(0) && padT.has(8),
       "beats:8 did not split the bar into two chords (t = " + [...padT].join(",") + ")");
  }

  // (c2) THE SECOND CHORD OF A SPLIT BAR IS NOT PAD-ONLY. The stab path and
  // the ramp's chordWalk already read chordFor(i); the bass and the line's
  // root shift must too, or the half-bar turnaround the beats field exists
  // for never reaches the parts that carry the harmony.
  {
    // bossa's bar 2 packs ii7–V7 into one bar; the fifths bass must sound the
    // V's root (pc 7) somewhere in the dominant half — the feature the anchor
    // exists to prove. Read through plain(): this measures WHAT WAS WRITTEN,
    // and bossa is a PLAYED anchor (stress .42, phrase .4, touch t=.06). The
    // shipped anchor does voice the V root, dead on the dominant half's
    // downbeat — and the hand pushes it 8 ms EARLY, to t=23.9918, so a window
    // cut at the raw step boundary threw the very note it was looking for one
    // hundredth of a beat over the edge. The bug was never in the bass walk
    // (chordsOf is already read per step here) nor in the anchor's beats
    // split; it was a gate asking a written question of a performed stream.
    const bpc = K.bass(P, plain(GENRES.bossa), 4)
      .filter(e => e.t >= 24 && e.t < 32).map(e => ((e.n % 12) + 12) % 12);
    ok(bpc.includes(7), "bossa's half-bar V7 never reaches the bass: " + bpc.join(","));
    // ...and the LINE's root shift is per-chord: a ramp-free line over a
    // split bar moves with the second chord where an all-I control does not
    const b1 = { label: "t", rate: 1, bars: 1, voices: 1, entry: () => 0,
                 reg: () => 0, realize: () => "line", kit: {}, harmony: "cycle",
                 roots: [0], word: () => [] };
    const flat2 = { ...clone(P), inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
    const pcsHalf = prog => [...new Set(K.render(flat2, { ...b1, prog }, 1)
      .filter(e => e.t >= 8).map(e => ((e.n % 12) + 12) % 12))].sort((x, y) => x - y);
    ok(JSON.stringify(pcsHalf([[{ d: 0, beats: 8 }, { d: 4, beats: 8 }]])) !==
       JSON.stringify(pcsHalf([[{ d: 0 }]])),
       "the line's root shift ignores the second chord of a beats-split bar");
  }

  // (d) CADENCE: withCadence lands a different chord on the section's last bar
  {
    const cad = { ...base, prog: K.withCadence([{ d: 0 }], 4, { d: 4, q: "dom7" }) };
    const ev2 = K.render(P, cad, 4).filter(e => e.part === "pad");
    ok(JSON.stringify([...pcsOf(barOf(ev2, 3, 16))].sort()) !==
       JSON.stringify([...pcsOf(barOf(ev2, 0, 16))].sort()),
       "the cadence bar voices the same pcs as bar 1 — withCadence never landed");
  }

  // (e) VOICE LEADING: under a prog, each voice of a pad chord moves at most a
  // tritone to its counterpart in the next chord — the stateless per-note fold
  // could leap an octave. Grouped by chord, because a dom7 has four voices
  // where a triad has three and voice j maps to prev[j % prev.length].
  {
    const pads = K.render(P, withP, 4).filter(e => e.part === "pad");
    const byT = [...new Set(pads.map(e => e.t))].sort((a, b) => a - b)
      .map(t => pads.filter(e => e.t === t).map(e => e.n));
    ok(byT.length >= 4, "the prog pad did not sound one chord a bar");
    for (let c = 1; c < byT.length; c++)
      byT[c].forEach((n, j) => ok(Math.abs(n - byT[c - 1][j % byT[c - 1].length]) <= 6,
        "pad voice leapt " + Math.abs(n - byT[c - 1][j % byT[c - 1].length]) +
        " semitones into chord " + c));
  }

  // (f) THE WIRED GENRE: blues' I7 sounds its major third in the walking bass
  // (tones 1-3 of bar 1 are root-third-fifth of a DOMINANT chord now), and
  // stripping the prog restores the minor walk — so the field provably
  // reaches the output of a shipping genre, not just a synthetic one
  {
    const firstBar = K.bass(P, GENRES.blues, 12).filter(e => e.t < 12)
      .map(e => ((e.n % 12) + 12) % 12);
    ok(firstBar.includes(4), "blues walk never sounds the I7's major third");
    const stripped = K.bass(P, { ...GENRES.blues, prog: null }, 12)
      .filter(e => e.t < 12).map(e => ((e.n % 12) + 12) % 12);
    ok(stripped.includes(3) && !stripped.includes(4),
       "prog-less blues does not walk the minor triad — the control is broken");
  }
  // (g) THE PROG/ROOTS LAW: a genre carrying both must agree bar for bar —
  // roots is the skeleton the layers and the UI read, prog is the voicing
  for (const gk of GK) {
    const g = GENRES[gk];
    if (!g.prog) continue;
    ok(g.harmony === "cycle", gk + ": prog on a non-cycle harmony");
    for (let b2 = 0; b2 < g.roots.length; b2++) {
      const slot = K.at(g.prog, b2), c = Array.isArray(slot) ? slot[0] : slot;
      ok((c.d || 0) === K.at(g.roots, b2),
         gk + " bar " + b2 + ": prog root " + c.d + " disagrees with roots " +
         K.at(g.roots, b2));
    }
  }
  // (h) LAYERS ARE PROG-FREE: the render path hands a layer the authority's
  // roots but not its prog, so a prog-carrying layer would play its own
  // chords against the box's. The composer's stackable list must stay clean
  // until the layer path learns to inherit prog.
  {
    const C2 = require("../../nukernel/compose.js");
    for (const gk of GK)
      for (const s of [1, 2, 3])
        for (const b of C2.compose(gk, s).song)
          for (const e of b.stack.slice(1))
            ok(!GENRES[e.g].prog,
               gk + "/" + s + ": composed a prog-carrying genre (" + e.g + ") as a layer");
  }
}

/* ---------------------------------------------------------------- 24. REST
   maxHold caps the hold so a hole in the gate vector is SILENCE. The failing
   assertion for a read-and-discarded field is the sum-of-durations drop —
   a config check would pass on a cap that never reaches dur. */
console.log("rest — maxHold turns gate holes into silence");
{
  const gap = { ...clone(P), gate: [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,1,0],
                sld: new Array(N).fill(0) };
  const g = GENRES.simple, capped = { ...g, maxHold: 2 };
  const evF = K.render(gap, g, 2), evC = K.render(gap, capped, 2);
  const total = a => a.reduce((s, e) => s + e.dur, 0);
  ok(evC.length === evF.length, "maxHold changed the note count — it must only stop notes");
  ok(Math.max(...evC.map(e => e.dur)) <= 2, "maxHold 2 left a note longer than 2 steps");
  ok(total(evC) < total(evF),
     "capped Σdur is not smaller — the cap never reached the rendered durations");
  ok(sig(K.render(gap, { ...g, maxHold: 0 }, 2)) === sig(evF) &&
     JSON.stringify(K.render(gap, { ...g, maxHold: 0 }, 2).map(e => e.dur)) ===
     JSON.stringify(evF.map(e => e.dur)),
     "maxHold: 0 is not the documented neutral value");
  // a SLIDE is a physical connection — the cap must not cut it
  const slide = clone(gap); slide.sld[7] = 1;              // slide INTO step 7
  const evS = K.render(slide, capped, 1);
  ok(Math.abs(evS[0].dur - 7) < 1e-9,
     "maxHold cut a note whose successor slides (dur " + evS[0].dur + ", want 7)");
  // the wired genres breathe: a slide-free phrase never exceeds the cap
  for (const gk of ["blues", "isley", "jodeci"]) {
    const g2 = GENRES[gk], flat = { ...clone(P), sld: new Array(N).fill(0) };
    const durs = K.render(flat, g2, g2.bars)
      .filter(e => e.part !== "pad").map(e => e.dur * g2.rate);
    ok(Math.max(...durs) <= g2.maxHold + 1e-9,
       gk + ": a line note outlasts its own maxHold (" + Math.max(...durs) + ")");
  }
}

/* ---------------------------------------------------------------- 25. BAR SCHEDULE
   The sixth type: a per-bar operator word gives a section a 2/4/8-bar period.
   Position-dependent and PRE-render — it changes which notes exist mid-section,
   which none of the other five types can do. */
console.log("bar schedule — a period is a sentence, not a restated bar");
{
  const g = { ...GENRES.rock,
              period: [[], [K.drop(2)], [], [K.drop(3), K.only("gate", K.rotate(4))]] };
  const perBar = g2 => Array.from({ length: 4 }, (_, b) =>
    JSON.stringify(K.render(P, g2, 4).filter(e => e.v === 0 &&
      Math.floor(e.t / 16) === b).map(e => [+(e.t % 16).toFixed(3), e.n])));
  const bars = perBar(g);
  ok(new Set(bars).size >= 3, "a four-entry period produced fewer than 3 distinct bars");
  const count = s => JSON.parse(s).length;
  ok(count(bars[1]) < count(bars[0]), "the thinned bar of the period is not thinner");
  ok(sig(allEvents(P, { ...GENRES.rock, period: null }, 4)) ===
     sig(allEvents(P, GENRES.rock, 4)), "period: null is not the neutral value");
  // sensitivity: perturbing ONE entry of the schedule must change the render
  const tweaked = { ...g, period: [[], [K.drop(2)], [K.rotate(1)], [K.drop(3), K.only("gate", K.rotate(4))]] };
  ok(sig(K.render(P, tweaked, 4)) !== sig(K.render(P, g, 4)),
     "perturbing a period entry changed nothing — the schedule is not being read");
  // the FUNCTION form is per-voice: call-and-response as data
  const cr = { ...GENRES.rock,
               period: (v, s) => (s % 2 === (v === 0 ? 1 : 0) ? [K.drop(1)] : []) };
  const evCR = K.render(P, cr, 4);
  ok(evCR.filter(e => e.v === 0 && Math.floor(e.t / 16) % 2 === 1).length === 0 &&
     evCR.filter(e => e.v === 0 && Math.floor(e.t / 16) % 2 === 0).length > 0 &&
     evCR.filter(e => e.v === 1 && Math.floor(e.t / 16) % 2 === 0).length === 0,
     "the per-voice period form does not alternate the voices");
  // the wired genre: beatles bar 4 is the thinned cadence bar
  {
    const b4 = K.render(P, GENRES.beatles, 4).filter(e => Math.floor(e.t / 16) === 3);
    const b1 = K.render(P, GENRES.beatles, 4).filter(e => Math.floor(e.t / 16) === 0);
    ok(b4.length < b1.length, "beatles' four-bar sentence does not breathe on bar 4");
  }
}

/* ---------------------------------------------------------------- 26. MAJOR
   There was no major key in nukernel at all — mixolydian faked brightness in
   three genres. The gate hears the major third and the major seventh in the
   RENDERED stream, and holds romanOf to both the old minor readout and the
   honest major one. */
console.log("major — ionian, lydian, melodic; major scales; honest numerals");
{
  const pcs = ev => new Set(ev.map(e => ((e.n % 12) + 12) % 12));
  const gM = { ...GENRES.simple, harmony: "cycle", roots: [0],
               mode: MODES.ionian, scale: SCALES.major, diatonic: true };
  const line = pcs(K.render(P, gM, 4));
  ok([...line].every(pc => MODES.ionian.includes(pc)),
     "an ionian line leaked outside the major scale: " + [...line].join(","));
  ok(line.has(4) && line.has(11),
     "a major-scale line never sounded the major third and seventh");
  // a pad in ionian voices a MAJOR triad — pc 4 over the tonic
  const gPad = { ...GENRES.vaporwave, mode: MODES.ionian, roots: [0, 3, 4, 0] };
  ok(pcs(K.render(P, gPad, 4).filter(e => e.v === 0)).has(4),
     "an ionian pad never voiced a major third — the mode is declared and unread");
  // both new subject alphabets span an octave in their own length
  for (const sc of [SCALES.major, SCALES.majpent])
    ok(Math.abs(K.pitch(sc.length, sc) - K.pitch(0, sc) - 12) < 1e-9,
       "a major alphabet does not span an octave in its own length");
  // romanOf: derived case equals the old hardcoded minor list, and reads major
  // honestly — the old table would have called ionian's I "i"
  ok(JSON.stringify(K.ROMAN) === JSON.stringify(["i", "ii°", "III", "iv", "v", "VI", "VII"]),
     "ROMAN no longer matches the shipped minor readout");
  ok(JSON.stringify(K.romanOf(MODES.ionian)) ===
     JSON.stringify(["I", "ii", "iii", "IV", "V", "vi", "vii°"]),
     "romanOf(ionian) is wrong: " + K.romanOf(MODES.ionian).join(" "));
  ok(JSON.stringify(K.romanOf(MODES.mixo)) ===
     JSON.stringify(["I", "ii", "iii°", "IV", "v", "vi", "VII"]),
     "romanOf(mixolydian) is wrong: " + K.romanOf(MODES.mixo).join(" "));
}

/* ---------------------------------------------------------------- 27. KEY
   An integer semitone key, applied AFTER registration — +7 is the value the
   register fold would eat (the octave law's mirror), and the BASS is the
   consumer transpose() could never reach, so a diff of 0 there is the failing
   assertion for a field that never lands. */
console.log("key — every pitched consumer moves by exactly the key, after the fold");
{
  for (const gk of ["rock", "vaporwave", "blues"]) {
    const g0 = { ...GENRES[gk], key: 0 }, g7 = { ...GENRES[gk], key: 7 };
    for (const [name, f] of [["render", K.render], ["bass", K.bass]]) {
      const a = f(P, g0, g0.bars), b = f(P, g7, g7.bars);
      ok(a.length === b.length && a.length > 0, gk + "/" + name + ": key changed the event count");
      ok(a.every((e, i) => b[i].n - e.n === 7 && b[i].t === e.t &&
                           Math.abs(b[i].dur - e.dur) < 1e-9),
         gk + "/" + name + ": key +7 is not a uniform +7 (the register fold ate it)");
    }
    ok(sig(K.drums(P, g7, g7.bars)) === sig(K.drums(P, g0, g0.bars)),
       gk + ": the key moved the drums");
  }
}

/* ---------------------------------------------------------------- 28. PARTS
   A part is an ASSIGNMENT of policy to a performer. The stab is the proof
   role: chord-locked, its own gate — every rendered pitch class must be a
   member of that bar's chord, the assertion that fails if chordLock is
   declared and never applied. */
console.log("parts — lead/riff separate, labels swap streams, the stab is chord-locked");
{
  const base = { label: "t", rate: 1, bars: 4, voices: 2, entry: () => 0, reg: () => 0,
                 realize: () => "line", kit: {}, harmony: "modal", word: () => [] };
  const A = { ...base, part: ["lead", "riff"] }, B = { ...base, part: ["riff", "lead"] };
  const mean = ev => ev.reduce((s, e) => s + e.n, 0) / ev.length;
  const evA = K.render(P, A, 4), evB = K.render(P, B, 4);
  const lead = evA.filter(e => e.part === "lead"), riff = evA.filter(e => e.part === "riff");
  ok(lead.length > 0 && riff.length > 0, "part tags did not reach the rendered events");
  ok(Math.abs(mean(lead) - mean(riff)) >= 7,
     "lead and riff sit " + Math.abs(mean(lead) - mean(riff)).toFixed(1) +
     " semitones apart — parts are labels, not policies");
  // swapping the labels swaps the streams exactly (modulo which voice index)
  const strip = ev => JSON.stringify(ev.map(e => [e.t, e.n, +e.dur.toFixed(6), e.vel]));
  ok(strip(evA.filter(e => e.part === "lead")) === strip(evB.filter(e => e.part === "lead")) &&
     strip(evA.filter(e => e.part === "riff")) === strip(evB.filter(e => e.part === "riff")),
     "swapping part labels did not swap the rendered streams");
  // the shim: a partless genre renders with the old realize() split, tagged
  ok(K.render(P, GENRES.rock, 4).every(e => e.part === "line"),
     "a partless line genre is not tagged with the shim part");
  ok(K.render(P, GENRES.vaporwave, 4).some(e => e.part === "pad"),
     "a partless pad genre lost its pad tag");
  // THE STAB: fires on its own gate, voices the sounding chord
  {
    const st = { ...base, voices: 1, part: ["stab"], harmony: "cycle",
                 roots: [0, 3], prog: [{ d: 0, q: "7" }, { d: 3, q: "7" }] };
    const ev2 = K.render(P, st, 4);
    const gates = P.gate.filter(Boolean).length;
    ok(ev2.length === 4 * gates * 4,
       "the stab did not fire one chord per gated step (got " + ev2.length + ")");
    for (const e of ev2) {
      const bar = Math.floor(e.t / 16);
      const cs = K.chordsOf(P, st, bar)[0];
      ok(cs.pcSet.has(((e.n % 12) + 12) % 12),
         "a stab pitch left its bar's chord: " + e.n + " in bar " + bar);
    }
    ok(Math.max(...ev2.map(e => e.dur)) <= 1,
       "a stab rings longer than its policy's hold");
  }
}

/* ---------------------------------------------------------------- 29. PIPES
   The seventh type: timeless AND pitch-aware, on the rendered stream. Each
   pipe's gate is the recon's: harmonize adds only chord tones, echoCanon
   copies later/quieter/inside the bar, breathe shortens without deleting,
   strum spreads a chord's attacks. All seeded, all total. */
console.log("pipes — harmonize, echoCanon, breathe, strum: seeded, total, chord-aware");
{
  const base = { ...GENRES.rock, bars: 4 };
  const dry = K.render(P, base, 4);
  // determinism first: the same pipes render twice identically
  const wet = g2 => K.render(P, g2, 4);
  {
    const g2 = { ...base, pipes: [{ id: "harmonize", p: 0.7 }] };
    ok(sig(wet(g2)) === sig(wet(g2)), "a piped render is not deterministic");
  }
  // harmonize: strictly more events, every ADDED pitch class in its bar's chord
  {
    const g2 = { ...base, pipes: [{ id: "harmonize", p: 1 }] };
    const ev2 = wet(g2), added = ev2.filter(e => e.pipe === "harmonize");
    ok(ev2.length > dry.length && added.length > 0, "harmonize added nothing at p:1");
    for (const e of added) {
      const bar = Math.floor(e.t / 16);
      ok(K.chordsOf(P, base, bar)[0].pcSet.has(((e.n % 12) + 12) % 12),
         "harmonize added a non-chord tone in bar " + bar);
      ok(e.n > 0, "harmonize produced a nonsense pitch");
    }
    ok(sig(wet({ ...base, pipes: null })) === sig(dry), "pipes: null is not neutral");
    ok(sig(wet({ ...base, pipes: [{ id: "nonsense" }] })) === sig(dry),
       "an unknown pipe id is not a no-op — pipes are supposed to be total");
  }
  // harmonize UNDER A KEY: render() bakes g.key into every pitch, so the chord
  // set the pipe snaps to must be the KEYED one — at key 2 every added note
  // sits in the +2-transposed sounding chord. Snapping to the un-keyed set is
  // arbitrary intervals against the transposed band, which is the bug.
  {
    const g2 = { ...base, key: 2, pipes: [{ id: "harmonize", p: 1 }] };
    const added = wet(g2).filter(e => e.pipe === "harmonize");
    ok(added.length > 0, "harmonize added nothing under a key");
    for (const e of added) {
      const keyed = new Set([...K.chordsOf(P, base, Math.floor(e.t / 16))[0].pcSet]
        .map(pc => (pc + 2) % 12));
      ok(keyed.has(((e.n % 12) + 12) % 12),
         "harmonize under key 2 added a note outside the KEYED chord in bar " +
         Math.floor(e.t / 16) + " (pc " + (((e.n % 12) + 12) % 12) + ")");
    }
  }
  // echoCanon: every copy is later, quieter, and inside its source's chord bar
  {
    const ev2 = wet({ ...base, pipes: [{ id: "echoCanon", delay: 3 }] });
    const added = ev2.filter(e => e.pipe === "echoCanon");
    ok(added.length > 0, "echoCanon copied nothing");
    for (const e of added) {
      ok(e.t === e.echoOf + 3, "an echo is not exactly its delay late");
      ok(Math.floor(e.t / 16) === Math.floor(e.echoOf / 16),
         "an echo crossed its source's chord bar");
    }
    const srcVel = t => dry.find(e2 => e2.t === t) || { vel: 9 };
    ok(added.every(e => e.vel < srcVel(e.echoOf).vel || srcVel(e.echoOf).vel <= 1),
       "an echo is not quieter than its source");
  }
  // breathe: note count unchanged, Σdur strictly decreased
  {
    const ev2 = wet({ ...base, pipes: [{ id: "breathe" }] });
    const total = a => a.reduce((s, e) => s + e.dur, 0);
    ok(ev2.length === dry.length, "breathe changed the note count");
    ok(total(ev2) < total(dry), "breathe did not shorten anything");
  }
  // strum: a pad chord's voices leave the grid, direction alternating per chord
  {
    const g2 = { ...GENRES.vaporwave, pipes: [{ id: "strum", spread: 0.1 }] };
    const pads = K.render(P, g2, 4).filter(e => e.part === "pad");
    const bar0 = pads.filter(e => e.t < 32 / 2).sort((a, b) => a.t - b.t);
    ok(new Set(bar0.map(e => e.t)).size === 3, "strum left the chord as one attack");
    ok(bar0[0].n < bar0[2].n, "the first strummed chord does not roll upward");
    const bar1 = pads.filter(e => e.t >= 32 && e.t < 64).sort((a, b) => a.t - b.t);
    ok(bar1[0].n > bar1[2].n, "the second chord does not roll back down — no alternation");
    // the wired genre: isley's Rhodes rolls
    const ip = K.render(P, GENRES.isley, 8).filter(e => e.part === "pad" && e.t < 16);
    ok(new Set(ip.map(e => e.t)).size > 1, "isley's strum pipe never reached the pad");
  }
}

/* ---------------------------------------------------------------- 30. KIT SCHEDULE + DYNAMICS
   kits[] is read per bar — POSITIONS must differ between bars, so a schedule
   wired only into velocity fails. kitVel gives a lane its own dynamics — the
   kick's rendered velocities must stop being the melody's. */
console.log("kit schedule and kit dynamics");
{
  const g = GENRES.rock;
  const A = g.kit, B = K.KITOPS.swap(g.kit);
  const sched = { ...g, kits: [A, B], fill: null };
  const dr = K.drums(P, sched, 4);
  // positions QUANTIZED to the grid: the schedule's question is which steps
  // fire, and since the hand law an acoustic kit carries per-bar micro-timing
  // (the same hit breathes differently in bar 3), which is not the schedule
  const shape = b => JSON.stringify(dr.filter(e => Math.floor(e.t / 16) === b)
    .map(e => [Math.round(e.t % 16), e.d]).sort());
  ok(shape(0) !== shape(1), "kits[A,B]: bar 2 has bar 1's positions — the schedule is unread");
  ok(shape(0) === shape(2) && shape(1) === shape(3), "the kit schedule does not cycle");
  ok(sig(K.drums(P, { ...g, kits: null }, 4)) === sig(K.drums(P, g, 4)),
     "kits: null is not the neutral value");
  // kitVel: the kick stops borrowing the tune's velocity vector
  {
    const kv = { ...g, kitVel: { k: [9,1,1,1, 8,1,1,1, 9,1,1,1, 8,1,1,1] } };
    const kick = K.drums(P, kv, 1).filter(e => e.d === "k");
    const kickSteps = g.kit.k.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
    ok(kick.every((e, j) => e.vel === kv.kitVel.k[kickSteps[j]]),
       "kitVel.k is not the kick's rendered velocity");
    ok(JSON.stringify(kick.map(e => e.vel)) !==
       JSON.stringify(kickSteps.map(i => P.vel[i])),
       "the kick still borrows the melody's velocities under kitVel");
    // ...and the other lanes do NOT inherit it: since the hand law an
    // acoustic kit's hats follow the HAND contour (varied, never the kick's
    // 9-1-1-1 row and never one flat loudness), so the leak signature is a
    // hat at the kick row's ghost value or a flat hat line
    const hat = K.drums(P, kv, 1).filter(e => e.d === "h");
    ok(!hat.every((e, j) => e.vel === kv.kitVel.k[g.kit.h.map((x, i) => (x ? i : -1))
      .filter(i => i >= 0)[j]]), "kitVel on one lane leaked into another");
    ok(new Set(hat.map(e => e.vel)).size >= 3,
       "an acoustic kit's hats play one flat loudness — the hand law is unread");
  }
  // the wired genre: toto's hat hand is its own, kick untouched
  {
    const t = GENRES.toto, off = { ...t, kitVel: null };
    const hats = g2 => K.drums(P, g2, 1).filter(e => e.d === "h").map(e => e.vel);
    ok(JSON.stringify(hats(t)) !== JSON.stringify(hats(off)),
       "toto's kitVel never reached the hats");
    const kicks = g2 => K.drums(P, g2, 1).filter(e => e.d === "k").map(e => e.vel);
    ok(JSON.stringify(kicks(t)) === JSON.stringify(kicks(off)),
       "toto's kitVel leaked onto the kick");
  }
}

/* ---------------------------------------------------------------- 31. THE ARRANGER'S ARC
   Song-level shape: a prechorus that lifts, a peak chorus that is measurably
   bigger than the first, a chorus with its OWN melody, hooks with a motif, a
   breath and one climax — all read from RENDERED events, never from config.

   §31 AND §33 RUN THE REAL ui/derive.js. They used to run hand-copied mirrors
   of genreOf/sectionEvents, and the mirror drifted: deleting the shipped key
   wiring left every mirror check green, and the mirror's full-form render hid
   a cadence landing outside the box's window. The UMD data tier is published
   onto a stub window (the exact shape ui/deps.js reads) and derive.js is
   imported for real — so a wiring change in the shipped file fails HERE. */
(async () => {
const D = await (async () => {
  globalThis.window = globalThis;
  window.NuKernel = K;
  window.NuGenres = require("../../nukernel/genres.js");
  // (window.NuSing was published here too — the singer's plan tier, which
  // ui/deps.js read. It came out on 2026-08-17; §74 holds the proof.)
  window.NuFields = require("../../nukernel/fields.js");
  window.NuSong = require("../../nukernel/song.js");
  window.NuInstruments = require("../../nukernel/instruments.js");
  window.NuCompose = require("../../nukernel/compose.js");
  window.PRESETS = require("../../nukernel/presets.js").PRESETS;
  // the big engine's sampler registry: ui/deps.js snapshots window.__REGISTRY
  // the moment it first evaluates (which is THIS import), so it must be on the
  // stub now or §45's playWindow would see zero zones and prove nothing about
  // the real extents
  window.__REGISTRY = require("../../engine/registry-data.js");
  return import("../../nukernel/ui/derive.js");
})();
console.log("the song groove — one drummer for the record, and it reaches the schedule");
{
  // THE SCORE-LEVEL CLAIM behind the move: the groove is sectionEvents' own
  // argument now (the box no longer spells it), and changing it moves the
  // SCHEDULED TIMES while leaving pitches and lanes untouched — which is what
  // "a groove, not a different drummer" means, measured on the same stream the
  // transport buckets into bars. No audio render needed: the schedule IS the
  // artifact at this layer.
  const S = require("../../nukernel/song.js");
  const b = S.emptyBox(); b.stack[0].slots = [0];
  const slots = [P];
  const flat = D.sectionEvents(b, slots, null).ev;
  const funk = D.sectionEvents(b, slots, "funk").ev;
  ok(flat.length > 0 && flat.length === funk.length,
     "the song groove added or dropped events (" + flat.length + " vs " + funk.length + ")");
  // pitches and lanes untouched: the same multiset of (kind, pitch-or-drum,
  // voice). Velocity is deliberately absent — a groove leans on levels too.
  const ident = ev => ev.map(e =>
    [e.kind, e.n != null ? e.n : e.d, e.v == null ? "" : e.v].join("|")).sort().join(";");
  ok(ident(flat) === ident(funk),
     "changing the song groove moved pitches or lanes, not just time");
  // ...but the TIMING moved: the scheduled times are a different multiset
  const times = ev => JSON.stringify(
    ev.map(e => +e.t.toFixed(4)).sort((x, y) => x - y));
  ok(times(flat) !== times(funk),
     "changing the song groove moved no scheduled event in time");
  // and sectionRender's cache tells grooves apart — the groove left the box's
  // JSON, so the signature must carry it or an edit keeps the old feel
  const ra = D.sectionRender(b, slots, null), rb = D.sectionRender(b, slots, "funk");
  ok(ra !== rb && times(ra.ev) !== times(rb.ev),
     "sectionRender's cache serves the old groove after a song-groove change");

  // ...AND THE SONG SWING, the same claim one argument over ("nothing in a
  // section tells time"): sectionEvents' fourth argument moves the SCHEDULED
  // TIMES while the note content is identical — one feel for the record, not
  // a different band.
  const straight = D.sectionEvents(b, slots, null, null).ev;
  const shuffled = D.sectionEvents(b, slots, null, "shuffle").ev;
  ok(straight.length > 0 && straight.length === shuffled.length,
     "the song swing added or dropped events (" +
     straight.length + " vs " + shuffled.length + ")");
  ok(ident(straight) === ident(shuffled),
     "changing the song swing moved pitches or lanes, not just time");
  ok(times(straight) !== times(shuffled),
     "changing the song swing moved no scheduled event in time");
  // late, never early: swing only delays the odd sixteenths
  {
    const a = straight.map(e => e.t).sort((x, y) => x - y);
    const c = shuffled.map(e => e.t).sort((x, y) => x - y);
    ok(c.every((t, i) => t >= a[i] - 1e-9),
       "the song swing moved a note EARLIER");
  }
  // "straight" is the explicit zero: it OVERRIDES a swinging genre's own
  // lean, which null (the default) must LEAVE STANDING — swing is identity at
  // the genre, and the two spellings being different is the whole distinction
  {
    const sw = JSON.parse(JSON.stringify(b)); sw.stack[0].g = "isley";
    const own = D.sectionEvents(sw, slots, null, null).ev;      // the lean stands
    const zeroed = D.sectionEvents(sw, slots, null, "straight").ev;
    ok(times(own) !== times(zeroed),
       "song swing 'straight' does not override the genre's own lean " +
       "(or null stripped it — either way the two spellings collapsed)");
  }
  // the cache tells swings apart too
  const rc = D.sectionRender(b, slots, null, "shuffle");
  ok(rc !== ra && times(rc.ev) !== times(ra.ev),
     "sectionRender's cache serves the old swing after a song-swing change");
}
console.log("song arc, prechorus, topline — the radio shape, measured on ui/derive.js");
{
  const C = require("../../nukernel/compose.js");
  const NF = require("../../nukernel/fields.js");
  // floor 16: (a) below reads seeds.slice(0, 16) and wants >=14 of them to
  // land a real chorus pair, and the key-lift coin needs enough draws to
  // land strictly between "never" and "always".
  const seeds = Array.from({ length: seedCount(30, 16) }, (_, i) => i + 1);

  // the REAL render path: everything a box plays, windowed to nudge+len,
  // enveloped, edged and grooved — the stream the transport schedules
  const sectionEv = (song, b) => D.sectionEvents(b, song.slots).ev;

  // (a) THE ARC IS AUDIBLE: mean level of the LAST chorus beats the FIRST in
  // at least 90% of songs, measured as rendered velocity × the box's level
  for (const gk of ["rock", "beatles", "isley"]) {
    let up = 0, n2 = 0;
    for (const s of seeds.slice(0, 16)) {
      const song = C.compose(gk, s), G = GENRES[gk];
      const ch = song.song.filter(b => b.role === "chorus" && !b.cue);
      if (ch.length < 2) continue;
      n2++;
      const level = b => {
        const ev2 = sectionEv(song, b).filter(e => e.kind === "line" && e.part !== "pad");
        const mv = ev2.reduce((a, e) => a + (e.vel == null ? 5 : e.vel), 0) /
                   Math.max(1, ev2.length);
        return mv * NF.LEVELS[b.lvl || "norm"];
      };
      if (level(ch[ch.length - 1]) > level(ch[0])) up++;
    }
    ok(n2 >= 14, gk + ": songs are missing their choruses");
    ok(up / n2 >= 0.9, gk + ": the last chorus outweighs the first in only " +
       Math.round(100 * up / n2) + "% of songs — the arc never reaches the render");
  }
  // ...and the peak chorus carries the extra layer; the key lift, when drawn,
  // moves the rendered pitches by exactly its own amount.
  //
  // RELATIVE TO THE SONG'S OWN KEY, not to zero. Since "a song knows what key
  // it is in" the composer derives a tonic off the genre's name and stamps it
  // on EVERY box, so `b.key` is no longer "the truck-driver lift or nothing" —
  // it is the record's key, which is a number, and reading it as a flag said
  // every chorus was lifted. HOME is the key the record opens in; a lift is a
  // peak chorus that has left it.
  {
    let lifted = 0;
    for (const s of seeds) {
      const song = C.compose("rock", s);
      const home = song.song[0].key || 0;
      const ch = song.song.filter(b => b.role === "chorus" && !b.cue);
      const last = ch[ch.length - 1];
      ok(last.stack.length >= 2, "rock/" + s + ": the peak chorus has no extra layer");
      if ((last.key || 0) !== home) {
        lifted++;
        // every PITCHED consumer — lines, layers AND the bass — moves by
        // exactly the lift; the drums (no n) are untouched by construction
        const lift = (last.key || 0) - home;
        const a = sectionEv(song, { ...last, key: home }).filter(e => e.n != null);
        const b = sectionEv(song, last).filter(e => e.n != null);
        ok(a.length === b.length && a.every((e, i) => b[i].n - e.n === lift),
           "rock/" + s + ": the truck-driver lift does not move the band by +" + lift);
      }
    }
    ok(lifted > 3 && lifted < seeds.length, "the key lift is never/always drawn (" +
       lifted + "/" + seeds.length + ") — it should be a coin, not a constant");
  }

  // (b) THE PRECHORUS EXISTS and points forward: stored under a legal role
  // (fields.js owns the vocabulary — the cue carries the honest name), riser
  // armed, cadence stamped — and the dominant sounds INSIDE THE RENDERED
  // WINDOW. A prechorus renders bars [0, len) with len = half the form, so a
  // cadence landed on the form's last bar is a lift that never plays; the
  // checks below read the same windowed stream the transport schedules.
  {
    const song = C.compose("beatles", 5);
    const pre = song.song.filter(b => b.cue === "prechorus");
    ok(pre.length === 2, "the song plan does not carry two prechoruses");
    pre.forEach((b, i) => {
      ok(C.ROLES[b.role], "a prechorus is stored under an illegal role: " + b.role);
      // NEITHER OF THEM FADES IN. Both point forward — riser armed, dominant
      // cadence stamped — and they are different sizes: the first arrives
      // (`cresc`, from half level up past the written one) and the second
      // pushes (`lift`, held flat then climbing hard).
      //
      // The first one used to be `in`, a fade from ZERO, on the argument that a
      // band only has a desk problem if it fades up TWICE. easeEdges finished
      // that thought: a fade from silence is something a RECORD does at its
      // ends, and in the middle of one it is a bar nobody can hear between two
      // bars playing forty events. `cresc` is the same gesture with a floor.
      // (mot "rise" came OFF this record on 2026-08-18: the era law strips
      // filter moves from pre-1964 records, and Liverpool 1962 is one — and
      // the rise compiled to an hpf sweep the desk has never had a home for
      // (audio/desk.js deskSweeps), so the word was config that rendered
      // nothing. The lift is the env and the cadence.)
      ok(b.env === (i ? "lift" : "cresc") && b.mot == null && b.cadence,
         "prechorus " + i + " does not lift (env " + b.env + " / mot " + b.mot +
         " / cadence " + !!b.cadence + ")");
      // the cadence reaches the BASS in the window's last bar: its root is
      // the dominant's, not the prog's own final chord. READ AGAINST THE
      // SECTION'S OWN KEY — the record has a tonic now and the whole band is
      // stamped with it, so a bare pc 7 is only the dominant of a song in the
      // one key that used to be assumed.
      const r = D.sectionEvents(b, song.slots), bs = 16 / r.g.rate;
      const home = ((((b.key || 0) % 12) + 12) % 12);
      const bpc = r.ev.filter(e => e.kind === "bass" && e.t >= (r.bars - 1) * bs)
        .map(e => ((((e.n - home) % 12) + 12) % 12));
      ok(bpc.length > 0 && bpc.every(pc => pc === 7 || pc === 6),
         "the beatles prechorus cadence never reaches the bass in the rendered window: " +
         bpc.join(","));
    });
    // ...and where the genre HAS a pad, the cadence's dominant third actually
    // SOUNDS: isley's Rhodes voices the V7 in the window's last bar — pc 11,
    // which dorian does not contain, so only the cadence can put it there
    {
      const song2 = C.compose("isley", 5);
      const b2 = song2.song.find(b3 => b3.cue === "prechorus");
      ok(!!b2, "isley's song plan lost its prechorus");
      const r2 = D.sectionEvents(b2, song2.slots), bs2 = 16 / r2.g.rate;
      const home2 = ((((b2.key || 0) % 12) + 12) % 12);   // ...and the same, in isley's key
      const pcs2 = new Set(r2.ev
        .filter(e => e.kind === "line" && e.part === "pad" && e.t >= (r2.bars - 1) * bs2)
        .map(e => ((((e.n - home2) % 12) + 12) % 12)));
      ok(pcs2.has(11),
         "the prechorus cadence never sounds the dominant's third in the rendered window");
    }
    ok(C.PLANS.song.includes("prechorus") && C.PLANS.dance.includes("build"),
       "the plans lost their lift sections");
  }

  // (c) NO SECTION RESTATES ITS NEIGHBOUR: consecutive same-role sections
  // render differently — the dance plan's double drop is the hard case
  for (const gk of ["acid", "eurythmics"]) {
    for (const s of seeds.slice(0, 10)) {
      const song = C.compose(gk, s);
      for (let i = 1; i < song.song.length; i++) {
        const a = song.song[i - 1], b = song.song[i];
        if (a.role !== b.role || C.BEDS[b.role] || a.cue !== b.cue) continue;
        ok(sig(sectionEv(song, a)) !== sig(sectionEv(song, b)),
           gk + "/" + s + ": two consecutive " + b.role + "s render identically");
      }
    }
  }

  // (d) THE CHORUS HAS ITS OWN MELODY: slot 5 (the topline) leads every chorus
  // and is absent from every verse's own deal
  for (const s of seeds.slice(0, 10)) {
    const song = C.compose("rock", s);
    for (const b of song.song) {
      // ...and where a SINGER took the chorus (compose.js: the topline moves off
      // the band and onto a `vocal` layer, because a chorus sung in unison by
      // the guitar player and the singer is one line twice) the topline leads
      // THAT layer. Either way it is what the chorus opens with.
      if (b.role === "chorus" && !b.cue) {
        const tune = b.stack.find(e => e.slots[0] === 5);
        ok(!!tune, "a chorus does not lead with the topline");
        ok(!tune || tune === b.stack[0] || tune.g === "vocal" || tune.g === "backing",
           "the chorus's topline is on a layer that is not the band and not the singer: " +
           (tune && tune.g));
      }
      if (b.role === "verse" && !b.cue)
        ok(!b.stack[0].slots.includes(5), "a verse borrowed the chorus's topline");
    }
  }

  // (e) THE TOPLINE WRITER, measured from rendered events over 100 hooks:
  // the motif returns (bars 0-3 == 4-7 in pitch and relative time), the breath
  // is real silence at the bar's end under a singer's maxHold, and exactly one
  // note is both the highest and the loudest
  {
    // the TOPLINE WRITER is compose.js's, so it is measured with the player
    // taken out — a phrase whose climax is the one loudest note is a fact about
    // what was written, and the performance layer exists precisely to stop the
    // rendered velocities being the written ones
    const g = plain(GENRES.simple), gSing = { ...g, maxHold: 2 };
    for (let s = 1; s <= 60; s++) {
      const p = C.phrase(C.rng(s * 17), s % 2 ? "hook" : "topline");
      const q = clone(p); q.sld = q.sld.map(() => 0);      // slides are exempt from the cap
      const ev2 = K.render(q, gSing, 1);
      const cell = a => JSON.stringify(a.map(e => [+(e.t % 4).toFixed(3), e.n, e.vel]));
      ok(cell(ev2.filter(e => e.t < 4)) === cell(ev2.filter(e => e.t >= 4 && e.t < 8)),
         "hook/" + s + ": the motif does not return in the rendered stream");
      ok(ev2.every(e => e.t < 14 && e.t + e.dur <= 15.5),
         "hook/" + s + ": no breath — the bar's end is not silent");
      const top = Math.max(...ev2.map(e => e.n));
      const peaks = ev2.filter(e => e.n === top);
      ok(peaks.length === 1 && peaks[0].vel === 9 &&
         ev2.filter(e => e.vel === 9).length === 1,
         "hook/" + s + ": the climax is not one note that is highest AND loudest");
    }
  }
}

/* ---------------------------------------------------------------- 32. CONFUSION
   Going from 23 to 45 genres is exactly where a table starts containing
   duplicates, and the big engine already learned this lesson: its matrix must
   stay diagonal-dominant at 274/274. This is nukernel's version — a feature
   vector per genre computed from the RENDERED events only (never a config
   field), a weighted distance over every pair, and a floor under the closest
   one. Two genres with different labels and identical music fail by
   construction, which the relabelled-clone canary proves on every run. */
console.log("confusion — every genre is provably not a relabelled neighbour");
{
  const C = require("../../nukernel/compose.js");
  // the vector: kick and snare STEP SETS (positions, not counts — a schedule
  // wired only into velocity would not move them), hat/perc/line densities,
  // the chordal share (pads + stabs), mean duration and the silent fraction
  // (real only since maxHold exists), the pitch-class profile of everything
  // pitched, the harmonic rhythm read off the BASS (distinct per-bar note
  // sets — the consumer a decorative prog cannot reach), measured swing, bass
  // density and register, wall-clock bar seconds (invariant under the
  // rate×2/bpm÷2 relabel), the form length, and the RENDERED voice count.
  const featOf = (gk, g, bpm) => {
    const bars = g.bars, bs = 16 / g.rate;
    const line = K.render(P, g, bars);
    const dr = K.drums(P, g, bars);
    const ba = K.bass(P, g, bars);
    const step = e => ((Math.round(e.t * g.rate) % 16) + 16) % 16;
    const lane = ds => { const v = new Array(16).fill(0);
      for (const e of dr) if (ds.includes(e.d)) v[step(e)] = 1; return v; };
    const f = [], w = [];
    const push = (x, wt) => { f.push(x); w.push(wt); };
    for (const x of lane(["k"])) push(x, 1 / 8);
    for (const x of lane(["s", "c"])) push(x, 1 / 8);
    push(Math.min(1, dr.filter(e => e.d === "h" || e.d === "o").length / bars / 16), 1);
    push(Math.min(1, dr.filter(e => e.d === "p").length / bars / 16), 0.5);
    const mel = line.filter(e => e.part !== "pad" && e.part !== "stab");
    push(line.length ? (line.length - mel.length) / line.length : 0, 1);
    // LOG-SCALED, NOT CLAMPED: Math.min(1, …) saturated at one voice's worth
    // of sixteenths, which hid a 360- vs 80-event render difference (spem vs
    // counterpoint) and left those pairs separated only by declared scalars
    push(Math.log2(1 + mel.length / bars) / 6, 1.5);
    const durs = mel.map(e => e.dur * g.rate);
    push(durs.length ? Math.min(1, durs.reduce((a, b) => a + b, 0) / durs.length / 8) : 0, 1);
    let covered = 0, end = 0;
    for (const [a, b] of mel.map(e => [e.t, e.t + e.dur]).sort((x, y) => x[0] - y[0])) {
      covered += Math.max(0, Math.min(b, bars * bs) - Math.max(a, end));
      end = Math.max(end, b);
    }
    push(1 - covered / (bars * bs), 1);
    const pcv = new Array(12).fill(0);
    for (const e of [...line, ...ba]) pcv[((e.n % 12) + 12) % 12] = 1;
    for (const x of pcv) push(x, 1 / 6);
    const bassBars = new Set(Array.from({ length: bars }, (_, b) =>
      JSON.stringify([...new Set(ba.filter(e => e.t >= b * bs && e.t < (b + 1) * bs)
        .map(e => e.n))].sort((x, y) => x - y))));
    push(bars > 1 ? (bassBars.size - 1) / (bars - 1) : 0, 1.5);
    const odd = [...line, ...dr].map(e => (e.t * g.rate) % 2).filter(x => x >= 1);
    push(odd.length ? Math.min(1, (odd.reduce((a, x) => a + (x - 1), 0) / odd.length) / 0.5) : 0, 1);
    push(Math.min(1, ba.length / bars / 16), 1);
    push(ba.length ? ba.reduce((a, e) => a + e.n, 0) / ba.length / 127 : 0, 1);
    // ONE wall-clock feature instead of raw bpm + raw rate: bar SECONDS.
    // Every render feature above is rate-normalized (step() multiplies by
    // g.rate, durations scale by it), so a clone with rate doubled and bpm
    // halved renders wall-clock-identical audio — separate bpm/rate features
    // measured that relabel 0.07 apart and the gate passed the exact
    // duplicate it exists to forbid. Bar seconds is invariant under the
    // relabel and still separates genuine tempo differences.
    push(Math.log2((16 / g.rate) * (60 / (4 * (bpm == null ? C.BPM[gk] : bpm)))) / 4, 1.5);
    push(g.bars / 12, 0.75);
    // the voice count is MEASURED from the rendered stream, not declared
    push(new Set(line.map(e => e.v)).size / 8, 1);
    return { f, w };
  };
  const dist = (a, b) => {
    let s = 0, tw = 0;
    for (let i = 0; i < a.f.length; i++) { s += a.w[i] * Math.abs(a.f[i] - b.f[i]); tw += a.w[i]; }
    return s / tw;
  };
  // THE FLOOR. Measured on the shipped table (post config-scalar purge) the
  // closest true pair (gregorian vs counterpoint — genuinely siblings) sits
  // at 0.035; a relabel that only moved the tempo ten bpm, or the compensated
  // rate×2/bpm÷2 clone, measures under 0.003. 0.03 splits those worlds with
  // headroom, and the render is deterministic so there is no flake in it.
  const EPS = 0.03;
  const F = {};
  // GK_FULL: the whole claim is that NO pair among every shipped genre is a
  // relabel of another — a sample can only prove the pairs it happens to
  // draw apart, which is a different and much weaker claim.
  for (const gk of GK_FULL) F[gk] = featOf(gk, GENRES[gk]);
  for (let i = 0; i < GK_FULL.length; i++)
    for (let j = i + 1; j < GK_FULL.length; j++) {
      const d = dist(F[GK_FULL[i]], F[GK_FULL[j]]);
      ok(d > EPS, GK_FULL[i] + " and " + GK_FULL[j] + " render " + d.toFixed(4) +
         " apart — closer than " + EPS + ", one is a relabel of the other");
    }
  // the canaries: a relabelled clone measures zero, a clone that only changed
  // its tempo still fails, and — the compensated case — a clone with rate
  // doubled and bpm halved plays wall-clock-identical audio and must ALSO
  // measure as a clone, or the floor is being cleared by config relabels
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock })) < EPS / 10,
     "a byte-identical clone does not measure as a clone — the metric is broken");
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock }, C.BPM.rock + 10)) < EPS,
     "a tempo-only relabel clears the floor — the gate proves nothing");
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock, rate: GENRES.rock.rate * 2 },
                         C.BPM.rock / 2)) < EPS / 10,
     "a rate-doubled bpm-halved clone — audio-identical by construction — " +
     "does not measure as a clone: config scalars are doing the separating");
  // every declared neighbour is a real genre, so the identity comments and the
  // matrix stay honest together (GK_FULL: a table walk, no render)
  for (const gk of GK_FULL)
    if (GENRES[gk].near)
      ok(!!GENRES[GENRES[gk].near],
         gk + ": declares an unknown nearest neighbour \"" + GENRES[gk].near + "\"");
}

/* ---------------------------------------------------------------- 33. THE BOX SURFACE (P4)
   The depth fields as BOX fields — key/prog/period/breath/pipe/part — wired
   in ui/derive.js genreOf, plus the automation vocabulary. boxGenre runs the
   REAL genreOf (imported above as D — the mirror it replaced could not fail
   when the shipped wiring changed). Every assertion reads RENDERED events;
   the neutrality row proves null == absent byte for byte. */
console.log("the box surface — key/prog/period/breath/pipe/part/auto reach the render");
{
  const NF = require("../../nukernel/fields.js");
  const NG = require("../../nukernel/genres.js");
  const S = require("../../nukernel/song.js");
  const C = require("../../nukernel/compose.js");

  // the REAL ui/derive.js genreOf, fed a box-shaped section (a box always has
  // an authority; layer-scope fields read through optOf's sec fallback)
  const keyOfG = new Map(Object.keys(GENRES).map(k => [GENRES[k], k]));
  const boxGenre = (G, sec) =>
    D.genreOf({ stack: [{ g: keyOfG.get(G), slots: [] }], nudge: 0, ...sec }, null);
  const rsig = g2 => sig(allEvents(P, g2, g2.bars));

  // NEUTRALITY: a box with every depth field null renders byte-identically
  // to the bare genre — the extension of §22's law to the box surface
  const NUL = { key: null, prog: null, period: null, breath: null,
                pipe: null, part: null, cadence: null, auto: [] };
  for (const gk of ["rock", "blues", "beatles", "isley", "vaporwave", "house", "reggae"]) {
    const G = GENRES[gk];
    ok(rsig(boxGenre(G, NUL)) === rsig(G),
       gk + ": a box with every depth field null does not render identically to absent");
  }

  // KEY: "2" moves every pitched consumer by exactly +2 and the drums by 0 —
  // the string form is what a chip writes, the number form what compose writes
  for (const kv of ["2", 2]) {
    const G = GENRES.rock, g2 = boxGenre(G, { ...NUL, key: kv });
    const a = [...K.render(P, G, G.bars), ...K.bass(P, G, G.bars)];
    const b = [...K.render(P, g2, g2.bars), ...K.bass(P, g2, g2.bars)];
    ok(a.length === b.length && a.every((e, i) => b[i].n - e.n === 2 && b[i].t === e.t),
       "box key " + JSON.stringify(kv) + " is not a uniform +2 on the pitched stream");
    ok(sig(K.drums(P, g2, g2.bars)) === sig(K.drums(P, G, G.bars)),
       "box key moved the drums");
  }

  // PROG: a named prog with sevenths widens the pad's pitch-class set; "off"
  // strips a genre's own prog back to the triads (blues' control from §23f)
  {
    const G = GENRES.vaporwave;
    const pcsPad = g2 => new Set(K.render(P, g2, g2.bars)
      .filter(e => e.part === "pad" && e.t < 16 / g2.rate).map(e => ((e.n % 12) + 12) % 12));
    const plain = pcsPad(G), seventh = pcsPad(boxGenre(G, { ...NUL, prog: "jack7" }));
    ok(seventh.size > plain.size,
       "box prog jack7 did not widen the pad's first chord (" +
       plain.size + " -> " + seventh.size + " pcs)");
    const off = K.bass(P, boxGenre(GENRES.blues, { ...NUL, prog: "off" }), 12)
      .filter(e => e.t < 12).map(e => ((e.n % 12) + 12) % 12);
    ok(off.includes(3) && !off.includes(4),
       "prog \"off\" did not strip blues back to the minor walk: " + off.join(","));
  }

  // PROG ON A MODAL GENRE: a named progression makes the harmony a CYCLE.
  // chordsOf ignores g.prog whenever harmony !== "cycle", so the chip used to
  // validate, light, and change nothing on ~19 of 45 genres — the shipped
  // depth surface silently inert. "off"/absent still leave modal modal.
  {
    const F2 = GENRES.funk;
    ok(rsig(boxGenre(F2, { ...NUL, prog: "blues12" })) !== rsig(F2),
       "prog \"blues12\" on a modal genre changes nothing — the chip is inert");
    ok(rsig(boxGenre(F2, { ...NUL, prog: "off" })) === rsig(F2),
       "prog \"off\" on a modal genre is not neutral");
    ok(rsig(boxGenre(F2, { ...NUL, cadence: { d: 4, q: "dom7" } })) === rsig(F2),
       "a bare cadence (no prog to land on) is not neutral on a modal genre");
  }

  // PERIOD: "4bar" lifts bar 3 (dens3 = more gates), "2bar" alternates,
  // "1bar" strips a genre's own sentence (beatles carries one)
  {
    const G = GENRES.rock;
    // THE WRITTEN NOTES, not the decorated ones (`!e.orn`): the period is a
    // claim about how many GATES a bar opens, and rock ornaments — a grace or
    // a flam thrown per note on its own dice adds a note to whichever bar it
    // lands in, which is exactly enough to level 12 against 11.
    const counts = g2 => Array.from({ length: 4 }, (_, b) =>
      K.render(P, g2, 4).filter(e => e.v === 0 && !e.orn && Math.floor(e.t / 16) === b).length);
    const four = counts(boxGenre(G, { ...NUL, period: "4bar" }));
    ok(four[2] > four[0], "period 4bar: bar 3 is not busier than bar 1 (" + four.join(",") + ")");
    // TIMES ONLY, on the one-voice genre: P carries a ramp, so pitches climb
    // per loop and would read as the period failing when it is the ramp working
    const barSig = (g2, b) => JSON.stringify(K.render(P, g2, 4)
      .filter(e => e.v === 0 && Math.floor(e.t / 16) === b)
      .map(e => +(e.t % 16).toFixed(3)));
    // plain() AFTER genreOf, never before: boxGenre finds the section's genre
    // key by identity, and a copy is not the anchor
    const g2b = plain(boxGenre(GENRES.simple, { ...NUL, period: "2bar" }));
    ok(barSig(g2b, 0) !== barSig(g2b, 1) && barSig(g2b, 0) === barSig(g2b, 2) &&
       barSig(g2b, 1) === barSig(g2b, 3),
       "period 2bar is not an alternating two-bar sentence");
    const B = GENRES.beatles;
    ok(rsig(boxGenre(B, { ...NUL, period: "1bar" })) === rsig({ ...B, period: null }) &&
       rsig(boxGenre(B, { ...NUL, period: "1bar" })) !== rsig(B),
       "period 1bar does not strip the genre's own sentence");
  }

  // BREATH: "2" caps the hold so the gate hole is silence; "none" is the
  // explicit uncap — it must lengthen a genre that carries its own maxHold
  {
    const gap = { ...clone(P), gate: [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,1,0],
                  sld: new Array(N).fill(0) };
    const total = a => a.reduce((s, e) => s + e.dur, 0);
    const G = GENRES.simple;
    const evF = K.render(gap, G, 2);
    const evC = K.render(gap, boxGenre(G, { ...NUL, breath: "2" }), 2);
    ok(evC.length === evF.length && Math.max(...evC.map(e => e.dur)) <= 2 &&
       total(evC) < total(evF),
       "breath \"2\" does not cap the hold in the rendered durations");
    // the GAPPED phrase again: P's own spans never exceed 2 steps, so blues'
    // maxHold 4 never binds on it and the uncap would measure as a tie
    const B = GENRES.blues;
    ok(total(K.render(gap, boxGenre(B, { ...NUL, breath: "none" }), B.bars)) >
       total(K.render(gap, B, B.bars)),
       "breath \"none\" does not uncap a genre that carries its own maxHold");
  }

  // PIPE: "3rds" adds chord-locked events; "off" strips a genre's own pipes
  // (isley ships a strum); "strum" spreads a pad chord's attacks
  {
    const G = GENRES.rock;
    const wet = K.render(P, boxGenre(G, { ...NUL, pipe: "3rds" }), 4);
    const added = wet.filter(e => e.pipe === "harmonize");
    ok(wet.length > K.render(P, G, 4).length && added.length > 0,
       "pipe 3rds added nothing to the rendered stream");
    for (const e of added)
      ok(K.chordsOf(P, G, Math.floor(e.t / 16))[0].pcSet.has(((e.n % 12) + 12) % 12),
         "a box-armed harmonize added a non-chord tone");
    const I = GENRES.isley;
    ok(rsig(boxGenre(I, { ...NUL, pipe: "off" })) === rsig({ ...I, pipes: null }) &&
       rsig(boxGenre(I, { ...NUL, pipe: "off" })) !== rsig(I),
       "pipe \"off\" does not strip the genre's own pipes");
    const V = boxGenre(GENRES.vaporwave, { ...NUL, pipe: "strum" });
    const pad0 = K.render(P, V, 4).filter(e => e.part === "pad" && e.t < 16 / V.rate);
    ok(new Set(pad0.map(e => e.t)).size > 1, "pipe strum left the pad as one attack");
  }

  // PART: "stab" chord-locks every line event; "auto" is the genre's own
  {
    const G = GENRES.rock;
    const ev = K.render(P, boxGenre(G, { ...NUL, part: "stab" }), 4);
    ok(ev.length > 0 && ev.every(e => e.part === "stab"),
       "part \"stab\" did not reassign every voice of the box");
    // ORNAMENTS ARE NOT THE PART'S PITCHES. "stab" chord-locks the notes the
    // part scheme places; a grace, an approach or a flam is a decoration
    // played into one of them, and a neighbour of a chord tone is a non-chord
    // tone by definition — §59 is where those are held to the bar's alphabet.
    for (const e of ev) {
      if (e.orn) continue;
      const c = K.chordsOf(P, G, Math.floor(e.t / 16));
      ok(c.some(ch => ch.pcSet.has(((e.n % 12) + 12) % 12)),
         "a box-level stab pitch left its bar's chord");
    }
    ok(rsig(boxGenre(G, { ...NUL, part: "auto" })) === rsig(G),
       "part \"auto\" is not the genre's own scheme");
  }

  // TABLE INTEGRITY: every preset speaks vocabulary that exists — a period
  // op key outside OPS or a pipe id outside PIPES would be a chip that
  // validates and then silently does nothing
  for (const [k, w] of Object.entries(NF.PERIODS))
    for (const list of w) for (const opk of list)
      ok(!!NF.OPS[opk], "PERIODS." + k + " names unknown op \"" + opk + "\"");
  for (const [k, set] of Object.entries(NF.PIPESETS))
    for (const p of set)
      ok(!!K.PIPES[p.id], "PIPESETS." + k + " names unknown pipe \"" + p.id + "\"");
  for (const k of Object.keys(NF.PROGCHOICES))
    ok(k === "off" || !!NG.PROGS[k], "PROGCHOICES names unknown prog \"" + k + "\"");
  for (const [k, v] of Object.entries(NF.BREATHS))
    ok(Number.isFinite(v), "BREATHS." + k + " is not a number");

  // AUTOSHAPE: the palette's point-list writer, provable in node. There is no
  // ARMING to cover any more — a lane is no longer a ramp scheduled on an
  // AudioParam but a value READ per bar (cutoff -> the engine's own master
  // sweep) or per NOTE (level -> the note's amp), so the whole of it is
  // arithmetic, and audio/desk.js laneAt is where it lives.
  {
    const beats = 16;
    for (const param of Object.keys(NF.AUTOPARAMS)) {
      const R = NF.AUTOPARAMS[param];
      ok(NF.autoShape(param, "off", beats) === null, param + ": off is not null");
      for (const shape of ["open", "close", "rise", "fall", "pump"]) {
        const a = NF.autoShape(param, shape, beats);
        ok(a && a.param === param && a.shape === shape &&
           (a.curve === "lin" || a.curve === "exp") && Array.isArray(a.points),
           param + "/" + shape + ": malformed entry");
        ok(a.points.every(pt => pt.length === 2 && pt.every(Number.isFinite) &&
           pt[0] >= 0 && pt[0] <= beats + 0.9 &&
           pt[1] >= Math.min(R.lo, R.hi) - 1e-6 && pt[1] <= Math.max(R.lo, R.hi) + 1e-6),
           param + "/" + shape + ": a point leaves the beat span or the value range");
      }
      const o = NF.autoShape(param, "open", beats), c2 = NF.autoShape(param, "close", beats);
      ok(o.points[0][1] < o.points[o.points.length - 1][1] ===
         (c2.points[0][1] > c2.points[c2.points.length - 1][1]),
         param + ": open and close do not run in opposite directions");
      ok(NF.autoShape(param, "pump", beats).points.length === 2 * beats,
         param + ": pump is not two points a beat");
    }
    // a written shape survives the loader — the palette's exact output
    const b = S.emptyBox();
    b.auto = [NF.autoShape("cutoff", "open", 16)];
    const r = S.validateSong({ v: 2, slots: [S.blank()], song: [b], bpm: 126, vol: 80 });
    ok(r.ok && r.song.song[0].auto.length === 1,
       "a palette-written automation entry does not survive validation: " +
       JSON.stringify(r.errors && r.errors[0]));
    // ...and malformed points are refused loudly, naming their path
    const bad = S.emptyBox();
    bad.auto = [{ param: "cutoff", points: [[0, NaN]] }];
    const rb = S.validateSong({ v: 2, slots: [S.blank()], song: [bad], bpm: 126, vol: 80 });
    ok(!rb.ok && /auto\[0\]\.points$/.test(rb.errors[0].path),
       "NaN automation points did not fail with a typed error");
  }

  // THE COMPOSER USES THE SURFACE: choruses draw the "4bar" preset, bridges
  // the "2bar" one, and the peak drop of a dance plan carries a real point
  // list on a public param — all through the same loader as everything else
  {
    // floor 20 == n: only 20 to begin with, over two fixed genres — cheap
    // regardless of mode, and >10/20 needs real depth to not be a coin flip.
    const seeds = Array.from({ length: seedCount(20, 20) }, (_, i) => i + 1);
    let four = 0, two = 0, autos = 0;
    for (const s of seeds) {
      const song = C.compose("rock", s);
      for (const b of song.song) {
        if (b.role === "chorus" && b.period === "4bar") four++;
        if (b.role === "bridge" && b.period === "2bar") two++;
        if (b.period != null) ok(!!NF.PERIODS[b.period],
          "rock/" + s + ": composed period \"" + b.period + "\" is not a preset name");
      }
      const dance = C.compose("house", s);
      const drops = dance.song.filter(b => b.role === "drop");
      const peak = drops[drops.length - 1];
      if (peak && peak.auto && peak.auto.length) {
        autos++;
        ok(peak.auto.every(a => NF.AUTOPARAMS[a.param] && a.points.length),
           "house/" + s + ": the peak drop's automation is not a real point list");
      }
    }
    ok(four > 4, "composed choruses never draw the 4bar sentence (" + four + ")");
    ok(two > 10, "composed bridges do not sway on the 2bar preset (" + two + ")");
    ok(autos === seeds.length,
       "the peak drop carries automation in only " + autos + "/" + seeds.length + " songs");
  }

  // THE INTERREGNUM MIGRATION: a save written between P2b and P4 carries the
  // bar schedule as a raw array; migrate turns a recognized one into its
  // preset name and drops an unrecognized one, so the evening's saves live
  {
    const mk = period => ({ v: 2, slots: [S.blank()],
      song: [Object.assign(S.emptyBox(), { period })], bpm: 126, vol: 80 });
    const r1 = S.load(mk([[], [], ["dens3"], []]));
    ok(r1.ok && r1.song.song[0].period === "4bar",
       "an array-form 4bar period did not migrate to its preset name");
    const r2 = S.load(mk([["rev"], ["inv"], ["rot5"]]));
    ok(r2.ok && r2.song.song[0].period == null,
       "an unrecognized array period was not dropped on migration");
  }
}

/* ---------------------------------------------------------------- 33b. THE AUTHORITY LAW
   A stacked layer plays through the BOX's harmony — prog and period stay the
   authority's alone (the comment sectionEvents itself carries). A layer that
   keeps its own prog is half the band in a different song: stacking blues on
   house had the layer voice-leading blues12 against the box's changes, and a
   layered beatles kept its own four-bar sentence. Both read through the REAL
   derive path. */
console.log("a stacked layer plays the authority's changes, not its own");
{
  // (a) the box's prog chip must REACH the layer: a layer following its own
  // prog is deaf to a change in the authority's changes
  const mk = prog => ({ stack: [{ g: "house", slots: [0] }, { g: "blues", slots: [0] }],
                        ops: [], prog, len: 4, nudge: 0 });
  const layerEv = sec => JSON.stringify(D.sectionEvents(sec, [P]).ev
    .filter(e => e.layer === "blues").map(e => [e.t, e.n]));
  ok(layerEv(mk(null)) !== layerEv(mk("jack7")),
     "the box's prog never reaches a stacked layer — it plays its own changes");
  // (b) a layered beatles must NOT keep its own four-bar sentence: the layer's
  // bar 4 renders as many notes as its bar 1 once the period is stripped
  const fb = { stack: [{ g: "funk", slots: [0] }, { g: "beatles", slots: [0] }],
               ops: [], len: 4, nudge: 0 };
  const lev = D.sectionEvents(fb, [P]).ev.filter(e => e.layer === "beatles");
  const bs34 = 16 / D.sectionEvents(fb, [P]).g.rate;
  const perBar = b => lev.filter(e => Math.floor(e.t / bs34) === b).length;
  ok(perBar(3) === perBar(0),
     "a stacked layer kept its own bar schedule (bar 4 " + perBar(3) +
     " notes vs bar 1 " + perBar(0) + ")");
}

/* ---------------------------------------------------------------- 34. KIT OPS × KIT SCHEDULE
   drums() prefers g.kits over g.kit, so a kit operator applied to the kit
   alone is a no-op on a schedule genre — dnb's breakdown kept its full
   two-bar break under a "no drums" chip, and only the composer's intro
   guard ever noticed. Read through the REAL derive path. */
console.log("kit operators reach the kit schedule (g.kits)");
{
  const box = kit => ({ stack: [{ g: "dnb", slots: [0] }], ops: [], kit,
                        len: 4, nudge: 0 });
  const hits = kit => D.sectionEvents(box(kit), [P]).ev.filter(e => e.kind === "hit");
  ok(hits(null).length > 0, "dnb renders no drums at all — this section proves nothing");
  ok(hits("nodrums").length === 0,
     "kit \"nodrums\" left " + hits("nodrums").length + " hits on a kits-schedule genre");
  ok(hits("nokick").length > 0 && hits("nokick").every(e => e.d !== "k"),
     "kit \"nokick\" left kicks on a kits-schedule genre");
  // `four` WRITES the lane: a kick on every quarter of every scheduled bar
  const four = hits("four").filter(e => e.d === "k");
  ok(four.length === 16,
     "kit \"four\" did not straighten the kick over the schedule (" + four.length + " kicks)");
}

/* ---------------------------------------------------------------- 35. GENRE FAMILIES
   The palette clusters the genre bank under FAMILIES headers, and the table
   is only trustworthy if it is TOTAL: every genre in exactly one family,
   every family key naming a real genre, every stamped `family` field from
   the allowed set. A genre missing from the table would silently vanish
   from the sound page — the palette draws the clusters, not GENRES. */
console.log("every genre carries exactly one family from the palette's set");
{
  // `parts` is the one cluster that is not a tradition: the FUNCTION genres,
  // whose identity is a role rather than a style (genres.js)
  const ALLOWED = new Set(["kernel", "vox", "club", "soul", "groove",
                           "band", "studio", "drift", "roots", "parts"]);
  ok(Array.isArray(FAMILIES) && FAMILIES.length === ALLOWED.size,
     "FAMILIES is not the allowed set (" + (FAMILIES || []).length + " families)");
  const seen = new Map();                       // genre key -> how many families
  for (const [fam, keys] of FAMILIES) {
    ok(ALLOWED.has(fam), "family \"" + fam + "\" is not in the allowed set");
    ok(keys.length > 0, "family \"" + fam + "\" is empty");
    for (const k of keys) {
      ok(!!GENRES[k], "family \"" + fam + "\" names unknown genre \"" + k + "\"");
      seen.set(k, (seen.get(k) || 0) + 1);
    }
  }
  // GK_FULL: a table walk, no render — cheap, and a coverage walk by nature
  // (the whole claim is that NO genre is missing or doubled).
  for (const gk of GK_FULL) {
    ok(seen.get(gk) === 1, "genre \"" + gk + "\" is in " + (seen.get(gk) || 0) +
       " families — must be exactly one");
    ok(ALLOWED.has(GENRES[gk].family), "genre \"" + gk + "\" carries family \"" +
       GENRES[gk].family + "\" — not in the allowed set");
  }
}

/* ---------------------------------------------------------------- 36. VARIABLE BANKS
   The phrase bank is 1..NSLOTS now (default one, [+] grows it), and the
   loader stopped padding to a fixed eight. What must hold: any legal size
   round-trips at ITS OWN length, byte-identically; the fences refuse 0 and
   NSLOTS+1; an old save whose box references past a short bank still loads
   (grown with blanks to cover the reference — the repair that replaces the
   old blanket pad); and the composer's output — the 8-slot case every old
   save is — survives the loader unchanged. */
console.log("variable banks — round trip at any size, migrate 8->N, reference cover");
{
  const S = require("../../nukernel/song.js");
  const F = require("../../nukernel/fields.js");
  const C = require("../../nukernel/compose.js");
  const mkSong = n => ({ v: 2,
    slots: Array.from({ length: n }, (_, i) => {
      const p = S.blank(); p.gate[0] = 1; p.deg[0] = i % 7; return p; }),
    song: [{ ...S.emptyBox(), stack: [{ g: "acid", slots: [Math.max(0, n - 1)] }] }],
    bpm: 126, vol: 80 });
  // round trip at several sizes: the bank comes back at its own length, and
  // the phrases come back byte-identical (no pad, no trim, no re-order)
  for (const n of [1, 2, 5, 8, F.NSLOTS]) {
    const raw = mkSong(n), r = S.load(JSON.parse(JSON.stringify(raw)));
    ok(r.ok, "a " + n + "-slot song does not load: " +
       JSON.stringify(r.errors && r.errors[0]));
    if (r.ok) {
      ok(r.song.slots.length === n, "a " + n + "-slot bank came back as " +
         r.song.slots.length);
      ok(JSON.stringify(r.song.slots) === JSON.stringify(raw.slots),
         "a " + n + "-slot bank did not round-trip byte-identically");
      // ...and the loaded song saves and loads AGAIN at the same length
      const r2 = S.load(JSON.parse(JSON.stringify(r.song)));
      ok(r2.ok && r2.song.slots.length === n,
         "a " + n + "-slot bank does not survive a second trip");
    }
  }
  // the fences: an empty bank and an over-full one are refused, with the
  // slots path named
  {
    const r0 = S.load({ ...mkSong(1), slots: [] });
    ok(!r0.ok && r0.errors[0].path === "slots", "an empty bank was not refused");
    const r17 = S.load(mkSong(F.NSLOTS + 1));
    ok(!r17.ok && r17.errors[0].path === "slots",
       "a " + (F.NSLOTS + 1) + "-slot bank was not refused");
  }
  // a phrase index past the cap is refused (the box check, not the bank one)
  {
    const raw = mkSong(2);
    raw.song[0].stack[0].slots = [F.NSLOTS];
    const r = S.load(raw);
    ok(!r.ok, "a phrase index of " + F.NSLOTS + " (past the cap) was accepted");
  }
  // REFERENCE COVER: older builds padded every bank to eight, so a short-
  // banked save could legally point at a slot the pad was about to create.
  // The bank grows with blanks to cover the highest reference — never past
  // it, never truncated.
  {
    const raw = mkSong(2);
    raw.song[0].stack[0].slots = [0, 5];
    const r = S.load(raw);
    ok(r.ok && r.song.slots.length === 6,
       "a bank of 2 referencing slot 6 did not grow to 6 (got " +
       (r.ok ? r.song.slots.length : JSON.stringify(r.errors[0])) + ")");
    ok(r.ok && r.song.slots.slice(2).every(p =>
         p.gate.every(g => !g)),
       "the reference-cover growth is not blank");
  }
  // MIGRATE 8->N: the 8-slot era is just one legal size now. Composer output
  // (the shape every recent save has) loads with its bank untouched — same
  // length, same bytes — across a spread of genres and seeds.
  for (const gk of ["acid", "rock", "fugue"]) {
    for (const s of [3, 11]) {
      const song = C.compose(gk, s);
      const r = S.load(JSON.parse(JSON.stringify(song)));
      ok(r.ok, gk + "/" + s + ": composer output does not load: " +
         JSON.stringify(r.errors && r.errors[0]));
      ok(r.ok && r.song.slots.length === song.slots.length &&
         JSON.stringify(r.song.slots) === JSON.stringify(song.slots),
         gk + "/" + s + ": an 8-slot composed bank did not migrate unchanged");
    }
  }
}

/* ---------- 37. A HIT AT ZERO IS A HIT ------------------------------------
   The kit-velocity vectors and the groove profiles both legitimately produce
   drum events at velocity 0 — boombap and funk emit six between them on the
   default phrase. The player must treat that as a SILENT HIT, not as "this
   kit cannot play that lane": the second reading falls through to the
   oscillator stub, and ten beeps came out of one 45-genre browser sweep
   because of it. This gate is the event-side half (the browser half is the
   fallback counter): the kernel really does emit them, so the audio tier
   really is asked the question, and anyone who "fixes" it by clamping
   velocities up here will see this fail. */
{
  let zeros = 0, from = [];
  for (const [gk, g] of Object.entries(GENRES)) {
    let n = 0;
    for (const e of K.drums(DEFAULT, g, 4)) if ((e.vel == null ? 5 : e.vel) <= 0) n++;
    if (n) { zeros += n; from.push(gk); }
  }
  ok(zeros > 0, "no genre emits a zero-velocity drum event any more — if that is " +
     "deliberate, delete this check; if it is a clamp, the silent-hit path just " +
     "went untested");
  ok(from.length >= 1, "zero-velocity drum events come from: " + from.join(", "));
}
console.log("a hit at zero is a hit — the kernel emits silent drum events on purpose");

/* ---------- 37b. THE FULL KIT ---------------------------------------------
   THE ARTIST: "There are many different drum sets. You are not using them."
   Literally true and measurable: found/samples/drums/<kit>/ has carried twelve
   samples per kit since extraction and instruments.js named six, so there were
   no toms, no ride, no crash and no pedal hat anywhere in the instrument, and
   kernel.js spelled its crashes "o" — an open hat — because there was no
   cymbal lane to write.

   Every check below reads RENDERED EVENTS, not config, because that is the
   house law this suite exists to enforce: an operator that returns a lovely
   kit nothing plays is the same bug as the dead ghost layer. Each operator's
   DOCUMENTED SIGNATURE is the thing asserted — a tom fill puts toms in the
   last quarter, linear means no two lanes on a tick, humanize moves times and
   not counts, a chance vector is the same dice every render. */
console.log("the full kit — twelve lanes, four vectors, and what each operator does");
{
  const NF = require("../../nukernel/fields.js");
  const NC = require("../../nukernel/compose.js");
  const drumsOf = (g, bars) => K.drums(P, g, bars == null ? g.bars : bars);
  const lanesIn = ev => new Set(ev.map(e => e.d));
  const at16 = (t, bs) => Math.round(((t % bs) + bs) % bs * 16 / bs);
  // A KIT WITH SOMETHING IN EVERY HAND: a kick, a backbeat, and a hat figure
  // that is FOUR-periodic on purpose — straight eighths are their own rotation
  // by two and their own densification, so a degenerate hat lane would report
  // three working operators as dead ones.
  const BASE = { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
                 s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
                 h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] };
  const G1 = { ...GENRES.simple, kit: BASE, kits: null, fill: null, ghost: null,
               kitVel: null, bars: 2, rate: 1 };
  const play = kit => K.drums(P, { ...G1, kit }, 2);
  const opEv = name => play(K.KITOPS[name](BASE));

  // (a) THE REGISTRY AGREES WITH THE KERNEL. A lane the kernel can write and
  // instruments.js cannot name is a silent drum — the browser's fallback
  // oscillator, which the audio gate fails on.
  {
    const NI = require("../../nukernel/instruments.js");
    const NF2 = require("../../nukernel/fields.js");
    const NG2 = require("../../nukernel/genres.js");
    ok(Object.keys(K.LANES).length === 12, "the kit is not twelve lanes");
    for (const d of Object.keys(K.LANES)) {
      ok(NI.DRUMFILE[d], "lane " + d + " (" + K.LANES[d].name + ") has no sample file");
      ok(NF2.DRUMLANES[d], "lane " + d + " has no name in the field registry");
      ok(NG2.DRUMNAME[d], "lane " + d + " has no column heading in DRUMNAME");
    }
    for (const d of Object.keys(NI.DRUMFILE))
      ok(K.LANES[d], "DRUMFILE names \"" + d + "\", which is not a lane");
    // ...and the genre table cannot name one either. drums() skips a key it
    // does not recognise, so a typo'd lane letter in genres.js is a drum part
    // that never plays and never complains — this is the check that says so.
    for (const gk of GK) {
      const g = GENRES[gk];
      for (const kit of [g.kit, g.fill, ...(g.kits || [])])
        for (const key of Object.keys(kit || {}))
          ok(K.LANES[key.replace(/^[?~!]/, "")],
             gk + ": kit key \"" + key + "\" is not a lane — it will never sound");
      for (const d of Object.keys(g.kitVel || {}))
        ok(K.LANES[d], gk + ": kitVel names \"" + d + "\", which is not a lane");
      for (const d of Object.keys(g.kitProb || {}))
        ok(K.LANES[d], gk + ": kitProb names \"" + d + "\", which is not a lane");
    }
    // ...and the files really are on disk, in every kit, when the media layer
    // is present. CI runs with no found/ at all, so this is skipped rather
    // than faked — the registry checks above still hold there.
    const fs = require("fs"), path = require("path");
    const root = path.join(__dirname, "..", "..", "found", "samples", "drums");
    if (fs.existsSync(root))
      for (const kit of fs.readdirSync(root).filter(x => !x.startsWith(".")))
        for (const [d, file] of Object.entries(NI.DRUMFILE))
          ok(fs.existsSync(path.join(root, kit, file)),
             kit + " has no " + file + " for lane " + d);
  }

  // (b) EVERY LANE IS REACHABLE — in a rendered stream, from the shipped
  // vocabulary alone. Six of them had no way in at all before this round.
  {
    const seen = new Set();
    for (const gk of GK) for (const e of drumsOf(GENRES[gk])) seen.add(e.d);
    const fromGenres = new Set(seen);
    for (const name of Object.keys(K.KITOPS)) for (const e of opEv(name)) seen.add(e.d);
    const bs = 16, span = 2 * bs;
    const stream = play(BASE).map(e => ({ ...e, kind: "hit" }));
    for (const kind of Object.keys(NF.OUTLABEL))
      for (const e of K.outro(stream, kind, span, bs)) if (e.d) seen.add(e.d);
    for (const kind of Object.keys(NF.INLABEL))
      for (const e of K.intro(stream, kind, span, bs)) if (e.d) seen.add(e.d);
    for (const d of Object.keys(K.LANES))
      ok(seen.has(d), "lane " + d + " (" + K.LANES[d].name + ") is unreachable — " +
         "no genre, operator or edge can produce one");
    // and the genre table itself must use more than the old six, or the kit
    // grew only in the palette
    for (const d of ["r", "x", "t", "m", "l", "f"])
      ok(fromGenres.has(d), "no genre plays a " + K.LANES[d].name + " — the new lanes " +
         "exist but the table was never wired to them");
  }

  // (c) THE OPERATORS' DOCUMENTED SIGNATURES, one assertion per claim.
  {
    const base = play(BASE);
    // RIDE — the timekeeping hand moves, and it is one hand: the hats are gone
    // and the ride carries their part. It carries the PHRASING, not every
    // stroke. This used to assert stroke-for-stroke equality, and that is the
    // law that made afrobeat's twelve-step hat into sixteen bars of solid
    // cymbal: a ride is ONE plate that rings for seconds, and twelve strokes a
    // bar into it is not time, it is fifteen overlapping copies of a wash the
    // ear names "crash". So the two claims are now what a hand on metal can
    // actually do (kernel.js moveTime) — it plays nowhere the hat did not, and
    // it plays no faster than an eighth, because the plate has to speak.
    const ride = opEv("ride");
    ok(!lanesIn(ride).has("h") && lanesIn(ride).has("r"), "ride: the hats did not move");
    const rideAt = [...new Set(ride.filter(e => e.d === "r").map(e => at16(e.t, 16)))]
      .sort((a, b) => a - b);
    const hatAt = new Set(base.filter(e => e.d === "h").map(e => at16(e.t, 16)));
    ok(rideAt.length && rideAt.every(i => hatAt.has(i)),
       "ride: the ride is playing a stroke the hats never played");
    ok(rideAt.every((i, q) => q === 0 || i - rideAt[q - 1] >= 2),
       "ride: two ride strokes land closer than an eighth — the plate is still ringing");
    ok(ride.filter(e => e.d === "k").length === base.filter(e => e.d === "k").length,
       "ride: the kick moved too — only the timekeeping hand may");
    // TOM FILL — toms, in the last quarter of every bar, and the hand that was
    // keeping time is off it there
    const tf = opEv("tomfill");
    for (const b of [0, 1]) {
      const q = tf.filter(e => e.t >= b * 16 + 12 && e.t < (b + 1) * 16);
      ok(q.some(e => K.TOMS.includes(e.d)), "tomfill: bar " + b + " has no toms in the last quarter");
      ok(!q.some(e => e.d === "h"), "tomfill: the hats are still playing over the fill");
      ok(!tf.some(e => K.TOMS.includes(e.d) && at16(e.t, 16) < 12),
         "tomfill: a tom landed outside the last quarter");
    }
    // ...and the OUTRO tom fill is the once-a-section one: the last bar only
    {
      const bs = 16, span = 4 * bs;
      const ev = K.drums(P, { ...G1, bars: 4 }, 4).map(e => ({ ...e, kind: "hit" }));
      const out = K.outro(ev, "tomfill", span, bs);
      ok(out.some(e => K.TOMS.includes(e.d) && e.t >= span - bs),
         "outro tomfill: no toms in the last bar");
      ok(!out.some(e => K.TOMS.includes(e.d) && e.t < span - bs),
         "outro tomfill: toms leaked into the section");
      ok(out.some(e => e.d === "x"), "outro tomfill: it does not land on a crash");
      ok(JSON.stringify(out.filter(e => e.t < span - bs)) ===
         JSON.stringify(ev.filter(e => e.t < span - bs)),
         "outro tomfill changed the section before its own bar");
    }
    // LINEAR — no two lanes on one tick, which is the whole definition
    {
      const lin = opEv("linear"), byT = new Map();
      for (const e of lin) byT.set(e.t, (byT.get(e.t) || 0) + 1);
      ok([...byT.values()].every(n => n === 1),
         "linear: two limbs landed on the same tick");
      ok(lin.length > 0 && lin.length < base.length,
         "linear: nothing was taken away — it is a constraint, not a colour");
      // it keeps the kick's downbeat: the dealing order is the drummer's
      ok(lin.some(e => e.d === "k" && e.t === 0), "linear: the kick lost the downbeat");
    }
    // GHOSTS — quiet snares that were not there, and the loud ones untouched
    {
      const gh = opEv("ghosts"), sn = e => e.d === "s";
      ok(gh.filter(sn).length > base.filter(sn).length, "ghosts: no snares were added");
      ok(gh.filter(sn).some(e => e.vel === 2), "ghosts: the added snares are not ghosts");
      ok(gh.filter(e => sn(e) && e.t % 4 === 0).length === base.filter(sn).length,
         "ghosts: the backbeat was rewritten");
    }
    // FLAM and DRAG — one and two grace hits before every snare, each quieter
    // than the hit it leads and landing in front of it
    for (const [name, n] of [["flams", 1], ["drags", 2]]) {
      const ev = opEv(name), sn = ev.filter(e => e.d === "s");
      ok(sn.length === base.filter(e => e.d === "s").length * (n + 1),
         name + ": not " + n + " grace hit(s) per snare");
      for (const e of sn.filter(x => x.grace)) {
        ok(e.vel < 9 && e.vel >= 1, name + ": a grace note is not quieter");
        ok(sn.some(x => !x.grace && x.t > e.t && x.t - e.t <= 0.4),
           name + ": a grace note does not lead a hit");
      }
    }
    // KICK DOUBLES, CRASH, the snare placements — each is one claim
    ok(opEv("kickdoubles").filter(e => e.d === "k").length >
       base.filter(e => e.d === "k").length, "kickdoubles: no doubles");
    ok(opEv("crash").some(e => e.d === "x" && e.t === 0 && e.vel === 9),
       "crash: no crash on the downbeat");
    ok(opEv("backbeat").filter(e => e.d === "s").every(e => at16(e.t, 16) % 8 === 4),
       "backbeat: the snare is not on 2 and 4");
    ok(opEv("onthree").filter(e => e.d === "s").every(e => at16(e.t, 16) === 8),
       "onthree: the snare is not on 3 alone");
    ok(!lanesIn(opEv("stickside")).has("s") && lanesIn(opEv("stickside")).has("p"),
       "stickside: the snare hand did not turn the stick over");
    ok(lanesIn(opEv("pedal")).has("f"), "pedal: no pedal hat");
    ok(lanesIn(opEv("opens")).has("o"), "opens: the hat never opens");
    // DYNAMICS — the level operators change velocity and nothing else
    for (const name of ["accents", "crescendo", "soft", "loud"]) {
      const ev = opEv(name);
      ok(ev.length === base.length, name + ": changed the event COUNT — it is a level");
      ok(ev.map(e => e.t).join() === base.map(e => e.t).join(),
         name + ": moved a hit — it is a level");
      ok(ev.map(e => e.vel).join() !== base.map(e => e.vel).join(),
         name + ": did not change a single velocity");
    }
    ok(opEv("loud").every(e => e.vel === 9) && opEv("soft").every(e => e.vel === 3),
       "soft/loud are not the two ends of the level alphabet");
    // HUMANIZE — moves times, never counts; and it is the same take every time
    {
      const hu = opEv("humanize");
      ok(hu.length === base.length, "humanize: added or removed a hit");
      ok(hu.map(e => e.d).sort().join() === base.map(e => e.d).sort().join(),
         "humanize: the lanes changed");
      ok(hu.some((e, i) => e.t !== base[i].t), "humanize: nothing moved off the grid");
      ok(hu.every(e => Math.abs(e.t - Math.round(e.t)) < 0.5),
         "humanize: a hit strayed more than half a step");
      ok(JSON.stringify(hu) === JSON.stringify(opEv("humanize")),
         "humanize: two renders differ — the hand is not seeded");
      // ...and the per-BAR field version moves bar 2 differently from bar 1
      const field = K.drums(P, { ...G1, humanize: 0.08 }, 2);
      ok(field.length === base.length, "g.humanize: added or removed a hit");
      const shift = b => field.filter(e => Math.floor(e.t / 16) === b)
        .map((e, i) => +(e.t - base.filter(x => Math.floor(x.t / 16) === b)[i].t).toFixed(4));
      ok(shift(0).join() !== shift(1).join(),
         "g.humanize: bar 2 is nudged exactly like bar 1 — that is a vector, not a hand");
      ok(field.every(e => e.t >= 0 && e.t < 32), "g.humanize: a hit left its section");
      // every hit stays in the bar it was written in, or the fill moves house
      ok(field.every((e, i) => Math.floor(e.t / 16) === Math.floor(base[i].t / 16)),
         "g.humanize: a hit crossed a bar line");
    }
    // TIGHT is the inverse, and it really is the machine: every hit on the
    // grid, every level back to "just play it"
    {
      const ti = play(K.KITOPS.tight(K.KITOPS.humanize(BASE)));
      ok(ti.every(e => Number.isInteger(e.t)), "tight: a hit is still off the grid");
      ok(ti.length === base.length, "tight: the hits themselves changed");
    }
    // PROBABILITY — deterministic per seed, different across seeds, and it
    // only ever removes. This is the one operator whose bar 2 differs.
    {
      const mk = seed => K.drums(P, { ...G1, kit: K.KITOPS.maybe(BASE), kitSeed: seed }, 8);
      const a = mk(0), b2 = mk(0), c = mk(9);
      ok(sig(a) === sig(b2), "maybe: two renders of one seed differ");
      ok(sig(a) !== sig(c), "maybe: the seed does not reach the dice");
      const full = K.drums(P, { ...G1, kit: BASE }, 8);
      ok(a.length < full.length, "maybe: nothing was ever dropped");
      ok(a.length > full.length * 0.5, "maybe: it dropped more than half the kit");
      const bar = n => a.filter(e => Math.floor(e.t / 16) === n).length;
      ok([0, 1, 2, 3, 4, 5, 6, 7].map(bar).some(n => n !== bar(0)),
         "maybe: every bar drops the same hits — the draw is not per bar");
      // the kick and the downbeats are exempt by declaration
      ok(a.filter(e => e.d === "k").length === full.filter(e => e.d === "k").length,
         "maybe: the kick was thinned, and it is declared exempt");
      // chaos is the heavier hand
      const ch = K.drums(P, { ...G1, kit: K.KITOPS.chaos(BASE) }, 8);
      ok(ch.length < a.length, "chaos is not heavier than maybe");
    }
    // PER-LANE — the seven verbs touch one lane and leave the rest alone
    for (const d of ["k", "s", "h"]) {
      for (const verb of ["rot", "thin", "dens", "half", "dbl", "roll", "disp"]) {
        const name = d + "." + verb, ev = opEv(name);
        ok(K.KITOPS[name], name + " is not in the operator table");
        for (const other of ["k", "s", "h"].filter(x => x !== d))
          ok(JSON.stringify(ev.filter(e => e.d === other)) ===
             JSON.stringify(base.filter(e => e.d === other)),
             name + ": it moved the " + K.LANES[other].name);
        ok(JSON.stringify(ev.filter(e => e.d === d)) !==
           JSON.stringify(base.filter(e => e.d === d)),
           name + ": it did nothing to its own lane");
      }
      // thin really thins, dens really fills, disp moves time and not the grid
      ok(opEv(d + ".thin").filter(e => e.d === d).length <
         base.filter(e => e.d === d).length, d + ".thin: no thinner");
      ok(opEv(d + ".dens").filter(e => e.d === d).length >
         base.filter(e => e.d === d).length, d + ".dens: no denser");
      const dp = opEv(d + ".disp").filter(e => e.d === d);
      ok(dp.length === base.filter(e => e.d === d).length, d + ".disp: added a hit");
      ok(dp.every(e => !Number.isInteger(e.t)), d + ".disp: nothing was laid back");
    }
    // THE NAMED PATTERNS are five different beats, not five labels
    {
      const named = ["disco", "stomp", "tresillo", "clave", "amen", "motorik", "blast"];
      const sigs = new Set(named.map(n => sig(opEv(n))));
      ok(sigs.size === named.length, "two named patterns render identically");
      ok(opEv("amen").some(e => e.vel === 2), "the amen break has no ghost snares");
      ok(lanesIn(opEv("blast")).has("r"), "the blast beat is not ridden");
    }
  }

  // (d) NEUTRALITY, the widening's half of the house law: a level of 1 is the
  // old binary "on", an absent sidecar is no sidecar, and the three new genre
  // fields are inert when unset. If any of this moves, every saved song moves.
  {
    const g0 = { ...G1 };
    ok(sig(K.drums(P, g0, 4)) ===
       sig(K.drums(P, { ...g0, kitProb: null, humanize: 0, kitSeed: 0 }, 4)),
       "the new kit fields are not neutral when absent");
    // level 1 renders exactly as the binary vector it replaced
    const ones = K.mapKit(BASE, v => v.map(x => (x ? 1 : 0)));
    ok(sig(K.drums(P, { ...g0, kit: ones }, 4)) === sig(K.drums(P, g0, 4)),
       "a level-1 kit is not the old binary kit");
    // a chance of 9 is certainty; a chance of 0 is silence
    const all9 = { ...BASE, "?h": new Array(16).fill(9) };
    ok(K.drums(P, { ...g0, kit: all9 }, 4).length === K.drums(P, g0, 4).length,
       "a chance of 9 dropped a hit");
    const none = { ...BASE, "?h": new Array(16).fill(0) };
    ok(!K.drums(P, { ...g0, kit: none }, 4).some(e => e.d === "h"),
       "a chance of 0 still played");
    // the sidecars are not lanes: nothing named "?h" is ever an event
    ok(!K.drums(P, { ...g0, kit: all9 }, 4).some(e => !K.LANES[e.d]),
       "a sidecar was rendered as a drum");
  }

  // (e) FILL VARIETY — the artist's other complaint, one layer up. Every
  // composed song used to end every section with the same accelerating snare;
  // the arranger now deals outro kinds from a family ballot on its own salted
  // stream, so a genre varies across seeds AND genres differ from each other.
  {
    const kindsFor = gk => {
      const s2 = new Set();
      for (let seed = 1; seed <= 12; seed++)
        for (const b of NC.compose(gk, seed).song) if (b.outro) s2.add(b.outro);
      return s2;
    };
    const kitted = GK.filter(gk => Object.keys(GENRES[gk].kit || {}).length);
    for (const gk of kitted) {
      const ks = kindsFor(gk);
      ok(ks.size >= 4, gk + ": only " + ks.size + " kind(s) of ending across twelve " +
         "seeds — the fills are not varying");
      ok([...ks].some(k => ["tomfill", "hatrun", "hush", "doubles"].includes(k)),
         gk + ": never reaches a fill that is not a snare roll");
    }
    // ...and two genres do not end alike: the ballots are per family
    const rock = [...kindsFor("rock")].sort().join(), club = [...kindsFor("house")].sort().join();
    ok(rock !== club, "rock and house end their sections with the same vocabulary");
    // a kitless genre never gets handed a drum fill
    for (const gk of GK.filter(g2 => !Object.keys(GENRES[g2].kit || {}).length))
      for (const k of kindsFor(gk))
        ok(["tail", "cut", "hush", "crash", "break"].includes(k),
           gk + " has no drums but was given the \"" + k + "\" ending");
    // the kit chips the arranger reaches for are real operators, and it uses
    // more than the eight it knew before the kit grew
    const kits = new Set();
    for (const gk of kitted) for (let seed = 1; seed <= 8; seed++)
      for (const b of NC.compose(gk, seed).song) if (b.kit) kits.add(b.kit);
    for (const k of kits) ok(K.KITOPS[k], "the arranger deals \"" + k + "\", which is not an operator");
    ok(kits.size >= 20, "the arranger reaches for only " + kits.size + " kit operators " +
       "out of " + Object.keys(K.KITOPS).length);
  }
}

/* ---------- 37c. THE PER-PART MIX, the half that is pure -------------------
   "Not every track should go through the effects." The audio half of that
   answer — a sub-bus per part under the section channel — is nodes, and it is
   gated where nodes can be measured (test/browser/nukernel-drums.test.js §E,
   which renders one part treated and another untouched and correlates their
   spectra). What lives HERE is everything upstream of a node: the address
   vocabulary, the chair numbering, the resolution to engine values, and the
   loader's contract — because a mix you cannot save is a mix you do not have.

   The law under all of it: ABSENT IS TODAY. A box with no `parts` must resolve
   to no sub-bus at all, or every song ever saved changes sound. */
console.log("the per-part mix — addresses, chairs, defaults, and what the loader keeps");
{
  const F = require("../../nukernel/fields.js");
  const S = require("../../nukernel/song.js");
  const NI = require("../../nukernel/instruments.js");

  // (a) THE VOCABULARY COVERS THE KERNEL. A role the kernel can assign and the
  // desk cannot name is a voice with no address — it would fall to `line` and
  // silently share a strip with the melody. This is the join that rots first,
  // so it is checked against kernel.js PARTS itself rather than against a copy.
  for (const p of Object.keys(K.PARTS))
    ok(F.PARTNAMES[p], "kernel part \"" + p + "\" has no mix address in PARTNAMES");
  for (const p of ["bass", "drums"])
    ok(F.PARTNAMES[p], "the desk cannot address the " + p + " — it is a track too");
  for (const p of Object.keys(F.PARTNAMES))
    ok(F.PARTLABEL[p], "part address \"" + p + "\" has no label");

  // (b) CHAIRS. The first voice of a role keeps the bare name; the rest take an
  // ordinal, counted across the WHOLE box. Post rock (pad + two clean guitars)
  // and rock (two crunch guitars) are the two real shapes this exists for.
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok(eq(F.chairKeys(["pad", "line", "line"]), ["pad", "line", "line2"]),
     "chairKeys did not number a genre's second line");
  ok(eq(F.chairKeys(["line", "line"]), ["line", "line2"]), "two lines did not separate");
  ok(eq(F.chairKeys(["stab", "lead"]), ["stab", "lead"]),
     "two different roles were given ordinals they do not need");
  ok(eq(F.chairKeys([]), []), "chairKeys is not total over the empty stack");
  ok(eq(F.chairKeys(["nonsense"]), ["line"]),
     "an unknown role did not fall back to the line address");
  // every address chairKeys can mint is one the loader accepts, at any depth
  {
    const deep = F.chairKeys(new Array(F.MAX_CHAIRS + 3).fill("pad"));
    ok(deep.every(k => F.okPartKey(k)),
       "chairKeys minted an address its own validator refuses: " + deep.join(","));
    ok(new Set(deep.slice(0, F.MAX_CHAIRS)).size === F.MAX_CHAIRS,
       "the first " + F.MAX_CHAIRS + " chairs are not distinct addresses");
  }
  ok(!F.okPartKey("line1"), "\"line1\" is a second spelling of \"line\" — it must not validate");
  ok(!F.okPartKey("line0") && !F.okPartKey("line99") && !F.okPartKey("zzz") &&
     !F.okPartKey("") && !F.okPartKey(null),
     "okPartKey accepted something that is not an address");
  ok(F.partChairLabel("line2") === "line 2" && F.partChairLabel("drums") === "drums",
     "a chair does not read as words: " + F.partChairLabel("line2"));

  // ...and the addresses a REAL genre produces are the ones the desk expects.
  // instrOf/partOf is the same walk audio/mixer.js voiceRoster does.
  for (const gk of GK) {
    const g = GENRES[gk];
    const keys = F.chairKeys(Array.from({ length: g.voices }, (_, v) => K.partOf(g, v)));
    ok(keys.length === g.voices, gk + ": one address per voice, got " + keys.length);
    ok(new Set(keys).size === keys.length, gk + ": two voices share an address (" +
       keys.join(",") + ") — one strip would treat both");
    for (const k of keys) ok(F.okPartKey(k), gk + ": minted a bad address " + k);
  }

  // (c) DEFAULTS ARE NEUTRAL, and neutral is the sound the page already makes.
  // resolvePartMix is the one place a part entry becomes engine numbers, so
  // "absent is today" is provable right here: nothing set, nothing changed.
  {
    const d = F.resolvePartMix(null);
    ok(d.fx.length === 0 && d.rev === 0 && d.del === 0 && d.lvl === 1 && d.pan === 0 &&
       d.mute === false && d.solo === false && d.fader === 0,
       "an absent part entry does not resolve to neutral: " + JSON.stringify(d));
    ok(JSON.stringify(F.resolvePartMix({})) === JSON.stringify(d),
       "an empty entry is not the same as an absent one");
    // ...and a SET value is the registry's own number, not a second table
    const m = F.resolvePartMix({ rev: "wet", echo: "touch", lvl: "hush", pan: "l",
                                 fx: ["chorus", "phaser"], mute: true });
    ok(m.rev === F.SENDS.wet && m.del === F.SENDS.touch && m.lvl === F.LEVELS.hush &&
       m.pan === F.PANS.l && m.mute === true,
       "resolvePartMix does not read the shipped tables: " + JSON.stringify(m));
    ok(m.del === F.SENDS.touch, "the `echo` field did not reach the `del` bus value");
    // the insert budget is the box's, per part — three chips is the ceiling
    // everywhere or a nine-part song is a wall of effects
    const many = F.resolvePartMix({ fx: Object.keys(F.FX) });
    ok(many.fx.length === F.MAX_FX,
       "a part chain is not capped at MAX_FX (" + many.fx.length + ")");
    ok(F.resolvePartMix({ fx: ["nonsense"] }).fx.length === 0, "an unknown insert survived");
    ok(F.resolvePartMix({ rev: "soaked" }).rev === 0,
       "an unknown send did not fall back to the neutral default");
    // THE FADER OFFSET: a dB number over the automated value — clamped to the
    // registry row's range, held to 0.1 dB, and garbage resolves to 0 (no
    // offset), never to silence
    ok(F.resolvePartMix({ fader: -6 }).fader === -6, "a set fader did not resolve");
    ok(F.resolvePartMix({ fader: -99 }).fader === -24 &&
       F.resolvePartMix({ fader: 99 }).fader === 12,
       "the fader offset is not clamped to the registry's own range");
    ok(F.resolvePartMix({ fader: -3.14159 }).fader === -3.1,
       "the fader offset is not held to 0.1 dB");
    ok(F.resolvePartMix({ fader: "loud" }).fader === 0 &&
       F.resolvePartMix({ fader: NaN }).fader === 0,
       "a garbage fader did not resolve to no-offset");
  }

  // (d) THE REGISTRY IS COMPLETE, by the same rules FIELDS itself is held to
  // (§21b) — an incomplete sub-field is a chip the palette cannot draw.
  for (const f of F.PARTMIX) {
    ok(typeof f.key === "string" && f.key, "a PARTMIX entry has no key");
    if (f.type === "flag") { ok(f.default === false, f.key + ": a flag defaults to true"); continue; }
    if (f.type === "num") {
      ok(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min <= f.max,
         f.key + ": num field without a [min,max]");
      ok(f.default === null, f.key + ": num default is not null");
      continue;
    }
    if (f.type === "eq") {
      ok(f.bands === F.EQ_BANDS, f.key + ": a part's EQ does not ride the one band list");
      ok(f.default === null, f.key + ": eq default is not null (absent = flat)");
      continue;
    }
    ok(f.table && Object.keys(f.table).length, f.key + ": no value table");
    ok(f.labels && Object.keys(f.table).every(k => f.labels[k] != null),
       f.key + ": a table value has no label");
    if (f.type === "list") ok(Array.isArray(f.default) && f.max === F.MAX_FX,
      f.key + ": a part list without [] and MAX_FX");
    else ok(f.default === null, f.key + ": enum default is not null");
  }
  // the registry entry itself, and the constructor that seeds it
  {
    const fld = F.FIELD.parts;
    ok(fld && fld.type === "parts" && fld.scope === "box" && fld.default === null,
       "the `parts` field is not a box-scope, absent-by-default registry entry");
    ok("parts" in S.emptyBox() && S.emptyBox().parts === null,
       "emptyBox does not seed `parts` absent");
  }

  // (e) THE LOADER. Keys filter, values reject — the split matters, and the
  // reason is a genre A/B: `pad2` is a legal address this box may not have a
  // chair for right now, and losing it on save would mean clicking a genre and
  // back silently ate the mix.
  const trial = box => S.validateSong(
    { v: 2, slots: [S.blank()], song: [box], bpm: 126, vol: 80 });
  {
    const b = S.emptyBox();
    b.parts = { lead: { fx: ["chorus", "nonsense"], rev: "wet" },
                pad2: { pan: "l" },                 // legal address, maybe no chair
                nonsense: { lvl: "hush" },          // not an address at all
                line: {} };                         // nothing set
    const r = trial(b);
    ok(r.ok, "the loader refused a legal per-part mix: " + JSON.stringify(r.errors[0]));
    const p = r.ok && r.song.song[0].parts;
    // `fx` LEFT PARTMIX ("a track sends to a bus and nothing else",
    // 2026-08-17): a track carries three sends and no insert chain, so a
    // saved per-part `fx` is now an unrecognized key and is dropped exactly
    // the way `nonsense` below is — never thrown, never migrated. This block
    // used to assert the FILTER rule on it and crashed the whole gate on
    // undefined the day the field went, which took every section after this
    // one with it; the claim that is left is the one the loader still makes.
    ok(p && p.lead && p.lead.fx === undefined,
       "a retired per-part `fx` chain survived the load");
    ok(p && p.lead && p.lead.rev === "wet",
       "a part entry lost its send when its retired keys were dropped");
    ok(p && p.pad2 && p.pad2.pan === "l",
       "an address with no chair in this box was dropped — a genre A/B would eat it");
    ok(p && !("nonsense" in p), "a key that is not an address survived the load");
    ok(p && !("line" in p), "an entry with nothing set was not normalized away");
  }
  {
    const b = S.emptyBox(); b.parts = { lead: { lvl: "soaked" } };
    const r = trial(b);
    ok(!r.ok && /\.parts\.lead\.lvl$/.test(r.errors[0].path),
       "a bad part level did not name its own field: " + JSON.stringify(r.errors[0]));
  }
  {
    const b = S.emptyBox(); b.parts = { lead: { mute: "yes" } };
    ok(!trial(b).ok, "a non-boolean mute was accepted");
    const b2 = S.emptyBox(); b2.parts = [{ lead: {} }];
    ok(!trial(b2).ok, "an array was accepted where the desk wants a map");
    const b3 = S.emptyBox(); b3.parts = { lead: 3 };
    ok(!trial(b3).ok, "a number was accepted where the desk wants a mix entry");
  }
  // (f) ABSENT IS TODAY, through the whole door: a song with no `parts` comes
  // back with no `parts`, and one whose entries all normalize away does too —
  // so there is exactly one spelling of "unmixed" for the mixer to skip on.
  {
    const b = S.emptyBox();
    const r = trial(b);
    ok(r.ok && r.song.song[0].parts === null, "an unmixed box did not come back unmixed");
    const b2 = S.emptyBox(); b2.parts = { lead: {}, drums: {} };
    const r2 = trial(b2);
    ok(r2.ok && r2.song.song[0].parts === null,
       "a map of empty entries did not normalize to absent");
    // and it survives the round trip that every save takes
    const b3 = S.emptyBox(); b3.parts = { drums: { pan: "l", solo: true } };
    const once = trial(b3);
    ok(once.ok, "a soloed kit did not validate");
    const twice = S.load(JSON.parse(JSON.stringify(once.song)));
    ok(twice.ok && JSON.stringify(twice.song.song[0].parts) ===
       JSON.stringify(once.song.song[0].parts),
       "the per-part mix is not stable across a save/load round trip");
  }
  // (f2) THE FADER OFFSETS through the loader — the len/nudge policy at both
  // scopes: garbage rejects and names its field, a wild number clamps, and 0
  // normalizes away so "no offset" keeps one spelling (absent).
  {
    const b = S.emptyBox(); b.parts = { lead: { fader: -6.16 } };
    const r = trial(b);
    ok(r.ok && r.song.song[0].parts.lead.fader === -6.2,
       "a part fader did not load at 0.1 dB: " +
       JSON.stringify(r.ok && r.song.song[0].parts));
    const bz = S.emptyBox(); bz.parts = { lead: { fader: 0 } };
    const rz = trial(bz);
    ok(rz.ok && rz.song.song[0].parts === null,
       "a zero part fader did not normalize to absent");
    const bj = S.emptyBox(); bj.parts = { lead: { fader: "loud" } };
    const rj = trial(bj);
    ok(!rj.ok && /\.parts\.lead\.fader$/.test(rj.errors[0].path),
       "a garbage part fader did not name its own field");
    const bb = S.emptyBox(); bb.fader = -99;
    const rb = trial(bb);
    ok(rb.ok && rb.song.song[0].fader === -24,
       "a wild box fader did not clamp to the registry range");
    const b0 = S.emptyBox(); b0.fader = 0;
    ok(trial(b0).ok && trial(b0).song.song[0].fader === null,
       "a zero box fader did not normalize to absent");
    const bx = S.emptyBox(); bx.fader = "hot";
    const rx = trial(bx);
    ok(!rx.ok && /\.fader$/.test(rx.errors[0].path),
       "a garbage box fader did not name its own field");
  }
  // (g) A v:1 SAVE HAS NO DESK AND MUST NOT GROW ONE. `parts` is additive, so
  // there is no migration to write — which is exactly the claim worth holding.
  {
    const ph = () => ({ deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                        vel: new Array(16).fill(5), gate: new Array(16).fill(1),
                        acc: new Array(16).fill(0), sld: new Array(16).fill(0) });
    const r = S.load({ v: 1, slots: [ph()], bpm: 126, vol: 80,
                       song: [{ genre: "acid", slots: [0], len: 4, nudge: 0, ops: [] }] });
    ok(r.ok && r.song.song[0].parts == null,
       "a v:1 save came back carrying a per-part mix it never had");
  }
  // and the instrument table is untouched by any of this — the desk addresses
  // chairs, it does not re-seat them
  ok(typeof NI.stripFor("clean_guitar", false) === "object",
     "stripFor stopped answering — the per-part desk must not touch the strips");
}

/* ---------- 37b. THE MASTER BUS -------------------------------------------
   The other end of the desk. §37 proves a box can treat one chair; this proves
   the song can treat everything, and — the part that actually matters — that a
   song which asks for NOTHING resolves to exactly the chain audio/graph.js has
   always built. The graph keys its whole absent-is-today branch on that, and
   the offline bounce renders through the same builder, so a drift here is a
   background carrier that does not match the foreground.

   Pure node: fields.js and song.js only. The audible half (the spectrum moves,
   the blob carries it) is the browser gates' job — nukernel-audio's shape
   correlation and nukernel-survival's carrier read. */
console.log("the master bus — globals, defaults, and what the loader keeps");
{
  const F = require("../../nukernel/fields.js");
  const S = require("../../nukernel/song.js");

  // (a) THE REGISTRY IS COMPLETE, by the rules PARTMIX and FIELDS are held to
  for (const f of F.MASTER) {
    ok(typeof f.key === "string" && f.key, "a MASTER entry has no key");
    ok(typeof f.label === "string" && f.label, f.key + ": no silkscreen label");
    ok(f.table && Object.keys(f.table).length, f.key + ": no value table");
    ok(f.labels && Object.keys(f.table).every(k => f.labels[k] != null),
       f.key + ": a table value has no label");
    ok(f.default === null, f.key + ": a global defaults to something");
    // NO "OFF" ENTRY, anywhere. A chip is a toggle and the empty option is how
    // a global clears, so an explicit off/flat/normal would be a second
    // spelling of absent — and two spellings of a default is what song.js and
    // the graph both normalize away.
    for (const k of Object.keys(f.table))
      ok(!/^(off|none|flat|normal)$/.test(k),
         f.key + ": '" + k + "' is a second spelling of the default");
  }
  ok(F.MASTER.every(f => F.MASTERBY[f.key] === f), "MASTERBY is not the same table");

  // (b) ABSENT IS TODAY. The default glue is live.js's bus compressor at
  // -22/2.2 into the RESTAGED x1.4 makeup (2026-08-16: at x2.2 a composed
  // song's peaks sat pinned on the brickwall — fields.js GLUES has the
  // measured numbers), the brickwall at -1.5 — and resolveMaster must land on
  // them from nothing, from {}, and from a spec full of values the build does
  // not recognize.
  {
    const d = F.resolveMaster(null);
    ok(d.glue.thr === -22 && d.glue.knee === 28 && d.glue.ratio === 2.2 &&
       d.glue.atk === 0.015 && d.glue.rel === 0.25 && d.glue.makeup === 1.4,
       "the resolved glue is not the shipped default bus compressor: " + JSON.stringify(d.glue));
    ok(d.ceiling.thr === -1.5 && d.ceiling.push === 1 && d.ceiling.clip === 0,
       "the resolved ceiling is not the brickwall graph.js always built: " +
       JSON.stringify(d.ceiling));
    ok(d.drive === null && d.tape === null && d.space === null &&
       d.width === null && d.tilt === null,
       "an unset global resolved to something the graph would build a node for: " +
       JSON.stringify(d));
    const j = JSON.stringify(d);
    ok(JSON.stringify(F.resolveMaster({})) === j, "{} is not the same as absent");
    ok(JSON.stringify(F.resolveMaster({ drive: "nonsense", ceiling: "nuclear" })) === j,
       "an unrecognized value did not fall back to today");
    // …and the two explicit names for today's numbers really are today's
    ok(JSON.stringify(F.resolveMaster({ glue: "glue", ceiling: "open" })) === j,
       "choosing 'glue'/'open' by hand is not the same chain as choosing nothing");
  }

  // (c) A SET VALUE IS THE REGISTRY'S OWN NUMBER, not a second table, and the
  // resolved objects are COPIES — the graph reads them into AudioParams and a
  // shared literal would be one edit away from rewriting the table.
  {
    const m = F.resolveMaster({ drive: "crush", glue: "squash", tape: "worn",
                                space: "hall", width: "mono", tilt: "dark",
                                ceiling: "louder" });
    ok(m.drive === F.DRIVES.crush, "drive did not resolve through DRIVES");
    ok(m.glue.ratio === F.GLUES.squash.ratio, "glue did not resolve through GLUES");
    ok(m.tape.wob === F.TAPES.worn.wob && m.tape.sat === F.TAPES.worn.sat,
       "tape did not resolve through TAPES");
    ok(m.space.mix === F.SPACES.hall.mix, "space did not resolve through SPACES");
    ok(m.width === F.WIDTHS.mono, "width did not resolve through WIDTHS");
    ok(m.tilt === F.TILTS.dark, "tilt did not resolve through TILTS");
    ok(m.ceiling.push === F.CEILINGS.louder.push, "ceiling did not resolve through CEILINGS");
    ok(m.glue !== F.GLUES.squash && m.tape !== F.TAPES.worn && m.space !== F.SPACES.hall,
       "resolveMaster handed out the shipped table object itself");
    // mono is 0, which is FALSY and the exact value a lazy `if (width)` drops
    ok(F.resolveMaster({ width: "mono" }).width === 0,
       "width 'mono' resolved to null — a falsy engine value was read as absent");
  }

  // (d) masterIsDefault answers the surface's question, not a shape question
  ok(F.masterIsDefault(null) && F.masterIsDefault({}) &&
     F.masterIsDefault({ drive: null }) && F.masterIsDefault({ drive: "nonsense" }),
     "masterIsDefault called a no-op spec a treatment");
  ok(!F.masterIsDefault({ drive: "hair" }) && !F.masterIsDefault({ width: "mono" }),
     "masterIsDefault called a real treatment a default");

  // (e) THE LOADER. Keys filter (the vocabulary will move), values REJECT (an
  // unknown ceiling means the file is from a build this one cannot honestly
  // play), and absent has one spelling on the way out.
  const trialM = master => S.validateSong(
    { v: 2, slots: [S.blank()], song: [S.emptyBox()], master, bpm: 126, vol: 80 });
  {
    const r = trialM({ drive: "dirt", tape: "worn", nonsense: "x", tilt: null });
    ok(r.ok, "the loader refused a legal master: " + JSON.stringify(r.errors[0]));
    ok(r.ok && JSON.stringify(r.song.master) === '{"drive":"dirt","tape":"worn"}',
       "the master did not come back filtered and ordered: " +
       JSON.stringify(r.ok && r.song.master));
    const bad = trialM({ ceiling: "nuclear" });
    ok(!bad.ok && bad.errors[0].path === "master.ceiling",
       "a bad global did not name its own field: " + JSON.stringify(bad.errors[0]));
    ok(!trialM([{ drive: "dirt" }]).ok, "an array was accepted where the bus wants a map");
    ok(!trialM(7).ok, "a number was accepted where the bus wants a map");
  }
  // (f) ABSENT IS TODAY THROUGH THE WHOLE DOOR — including a v:1 save, which
  // never had a master and must not grow one
  {
    ok(trialM(undefined).song.master === null, "a song with no master came back with one");
    ok(trialM({}).song.master === null, "an empty master did not normalize to absent");
    ok(trialM({ drive: null }).song.master === null,
       "a master of nulls did not normalize to absent");
    const ph = () => ({ deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                        vel: new Array(16).fill(5), gate: new Array(16).fill(1),
                        acc: new Array(16).fill(0), sld: new Array(16).fill(0) });
    const r = S.load({ v: 1, slots: [ph()], bpm: 126, vol: 80,
                       song: [{ genre: "acid", slots: [0], len: 4, nudge: 0, ops: [] }] });
    ok(r.ok && r.song.master === null,
       "a v:1 save came back carrying a master bus it never had");
  }
  // (g) …and it survives the round trip every save takes
  {
    const once = trialM({ space: "cavern", width: "huge", glue: "pump" });
    ok(once.ok, "a full master did not validate");
    const twice = S.load(JSON.parse(JSON.stringify(once.song)));
    ok(twice.ok && JSON.stringify(twice.song.master) === JSON.stringify(once.song.master),
       "the master bus is not stable across a save/load round trip");
  }
}

/* ---------- 37c. THE SHARED-BUS TRIMS -------------------------------------
   The rack's knobs (fields.js BUSES): reverb/echo/room return trims plus the
   echo's two internals, the master-bus law one shelf down. The claim that
   matters is the same one: a song that asks for NOTHING resolves to the graph
   exactly as built — ret ×1, fb/tone null — because audio/graph.js keys its
   as-built branch on that, and the offline bounce bakes the same resolution
   into every window. Pure node; the audible half is the browser gates'. */
console.log("the shared buses — the rack registry, defaults, and the loader");
{
  const F = require("../../nukernel/fields.js");
  const S = require("../../nukernel/song.js");

  // (a) the registry is complete and self-describing — a knob with no table
  // or label is a control a surface cannot draw
  ok(Array.isArray(F.BUSES) && F.BUSES.length === 3 &&
     F.BUSES.map(b => b.bus).join(",") === "rev,echo,room",
     "the bus registry does not name the graph's own shared roster");
  for (const b of F.BUSES) {
    ok(typeof b.label === "string" && b.label, b.bus + " has no label");
    ok(b.knobs.some(k => k.key === "ret"), b.bus + " has no return knob");
    for (const k of b.knobs) {
      ok(k.table && k.labels && Object.keys(k.table).length >= 2,
         b.bus + "." + k.key + " has no table/labels");
      ok(Object.keys(k.table).every(x => k.labels[x]),
         b.bus + "." + k.key + " has a value with no label");
      ok(k.default === null, b.bus + "." + k.key + " defaults to something — " +
         "absent must be the graph as built");
    }
  }
  ok(F.BUSES.every(b => F.BUSBY[b.bus] === b), "BUSBY is not the same table");

  // (b) ABSENT IS THE GRAPH AS BUILT: every ret ×1, echo internals untouched
  {
    const d = F.resolveBuses(null);
    ok(d.rev.ret === 1 && d.echo.ret === 1 && d.room.ret === 1,
       "an absent spec did not resolve every return to unity");
    ok(d.echo.fb === null && d.echo.tone === null,
       "an absent spec touched the echo's own constants");
    const j = JSON.stringify(d);
    ok(JSON.stringify(F.resolveBuses({})) === j, "{} is not the same as absent");
    ok(JSON.stringify(F.resolveBuses({ rev: { ret: "soaked" } })) === j,
       "junk values did not resolve as absent");
  }
  // (c) a set spec resolves through its own tables
  {
    const m = F.resolveBuses({ rev: { ret: "hot" }, echo: { fb: "less", tone: "dark" },
                               room: { ret: "down" } });
    ok(m.rev.ret === 1.6 && m.room.ret === 0.5,
       "return trims did not resolve through the table");
    ok(m.echo.fb === 0.22 && m.echo.tone === 1400 && m.echo.ret === 1,
       "the echo knobs did not resolve independently");
  }
  // (d) busesIsDefault answers the normalizer's question
  ok(F.busesIsDefault(null) && F.busesIsDefault({}) &&
     F.busesIsDefault({ rev: { ret: "nonsense" } }),
     "busesIsDefault called a no-op spec a treatment");
  ok(!F.busesIsDefault({ room: { ret: "down" } }),
     "busesIsDefault called a real trim a default");

  // (e) THE LOADER — the master's split at both levels: bus and knob KEYS
  // filter, knob VALUES reject, absent keeps one spelling
  const trialB = buses => S.validateSong(
    { v: 2, slots: [S.blank()], song: [S.emptyBox()], buses, bpm: 126, vol: 80 });
  {
    const r = trialB({ rev: { ret: "up" }, junkbus: { x: 1 }, echo: { junkknob: "x" } });
    ok(r.ok, "the loader refused a legal buses spec: " + JSON.stringify(r.errors && r.errors[0]));
    ok(r.ok && JSON.stringify(r.song.buses) === '{"rev":{"ret":"up"}}',
       "buses did not come back filtered: " + JSON.stringify(r.ok && r.song.buses));
    const bad = trialB({ rev: { ret: "soaked" } });
    ok(!bad.ok && bad.errors[0].path === "buses.rev.ret",
       "a bad trim did not name its own field: " + JSON.stringify(bad.errors[0]));
    ok(!trialB([{ rev: 1 }]).ok, "an array was accepted where the rack wants a map");
    ok(trialB(undefined).song.buses === null, "a song with no buses came back with some");
    ok(trialB({}).song.buses === null, "an empty buses spec did not normalize to absent");
    ok(trialB({ rev: {} }).song.buses === null,
       "a map of empty entries did not normalize to absent");
  }
  // (f) …and the round trip every save takes
  {
    const once = trialB({ echo: { ret: "dim", fb: "more" }, room: { ret: "hot" } });
    ok(once.ok, "a full buses spec did not validate");
    const twice = S.load(JSON.parse(JSON.stringify(once.song)));
    ok(twice.ok && JSON.stringify(twice.song.buses) === JSON.stringify(once.song.buses),
       "the bus trims are not stable across a save/load round trip");
  }
}

/* ---------- 37d. THE STRIP EQ ---------------------------------------------
   "Every strip earns its tone": LO/MID/HI on every channel strip, LO/HI on
   the bus returns (fields.js EQ_BANDS / BUS_EQ_BANDS). The audible half —
   biquads in the built chain, bytes moving under a +12 dB shelf — is the
   browser gate's (nukernel-drums eqProbe, which also holds the zero-nodes
   claim at graph level). What lives here is everything upstream of a node:
   the band registry, the dB policy, the resolvers, and the loader — under the
   one law that matters most: FLAT IS ABSENT, with exactly one spelling, or
   every song ever saved changes graph. */
console.log("the strip EQ — bands, the dB policy, the resolvers, and the loader");
{
  const F = require("../../nukernel/fields.js");
  const S = require("../../nukernel/song.js");

  // (a) THE BAND LIST IS BUILDABLE: key/label for the surface, type/freq (and
  // the bell's q) for the node — graph.buildEq reads exactly these.
  ok(Array.isArray(F.EQ_BANDS) && F.EQ_BANDS.map(b => b.key).join(",") === "lo,mid,hi",
     "the strip EQ is not the three bands lo,mid,hi");
  for (const b of F.EQ_BANDS) {
    ok(typeof b.label === "string" && b.label, b.key + " has no silkscreen label");
    ok(["lowshelf", "peaking", "highshelf"].includes(b.type),
       b.key + ": type " + b.type + " is not a biquad the builder can make");
    ok(Number.isFinite(b.freq) && b.freq > 20 && b.freq < 16000,
       b.key + ": frequency " + b.freq + " is not on the audible desk");
  }
  ok(F.EQ_BANDS[1].type === "peaking" && Number.isFinite(F.EQ_BANDS[1].q),
     "the mid bell has no Q — a peaking biquad at default Q is a different EQ");
  // the bus pair IS the strip's own shelves — same objects, one frequency per
  // word, and the registry rows all point at the one list
  ok(F.BUS_EQ_BANDS.length === 2 && F.BUS_EQ_BANDS[0] === F.EQ_BANDS[0] &&
     F.BUS_EQ_BANDS[1] === F.EQ_BANDS[2],
     "the bus pair is not the strip's own lo/hi shelves");
  ok(F.BUSES.every(b => b.eq === F.BUS_EQ_BANDS),
     "a bus registry row does not carry the shared band pair");
  ok(F.FIELD.eq && F.FIELD.eq.type === "eq" && F.FIELD.eq.scope === "box" &&
     F.FIELD.eq.bands === F.EQ_BANDS && F.FIELD.eq.default === null,
     "the section strip's eq is not a box-scope, absent-by-default registry entry");
  ok("eq" in S.emptyBox() && S.emptyBox().eq === null,
     "emptyBox does not seed `eq` absent");

  // (b) THE dB POLICY — the fader's, at the EQ's own range: clamp ±12, hold
  // to 0.1 dB, garbage resolves to 0 (flat), never to anything audible
  ok(F.eqDb(6) === 6 && F.eqDb(-6) === -6, "a set band did not survive eqDb");
  ok(F.eqDb(99) === 12 && F.eqDb(-99) === -12, "eqDb is not clamped to ±12");
  ok(F.eqDb(3.14159) === 3.1, "eqDb is not held to 0.1 dB");
  ok(F.eqDb(NaN) === 0 && F.eqDb("loud") === 0 && F.eqDb(null) === 0,
     "garbage did not resolve to flat");

  // (c) RESOLUTION: null is FLAT is "build zero filter nodes", with every
  // no-op spelling collapsing onto it; a non-flat spec resolves EVERY band
  ok(F.resolveEq(null) === null && F.resolveEq({}) === null,
     "an absent spec did not resolve to null");
  ok(F.resolveEq({ lo: 0, mid: 0, hi: 0 }) === null,
     "an all-zero spec is a second spelling of flat");
  ok(F.resolveEq({ lo: "loud", mid: NaN }) === null,
     "junk bands did not resolve as flat");
  {
    const r = F.resolveEq({ lo: 12, hi: -3.14 });
    ok(r.lo === 12 && r.mid === 0 && r.hi === -3.1,
       "a set spec did not resolve totally: " + JSON.stringify(r));
  }
  // a band the strip lacks is not a treatment: `mid` on a bus pair is flat
  ok(F.resolveEq({ mid: 6 }, F.BUS_EQ_BANDS) === null,
     "a band the bus pair lacks resolved to a treatment");
  ok(F.eqIsFlat(null) && F.eqIsFlat({ lo: 0 }) && !F.eqIsFlat({ lo: 3 }),
     "eqIsFlat does not answer the normalizer's question");

  // (d) THE RESOLVERS CARRY IT — part, and bus
  ok(F.resolvePartMix(null).eq === null && F.resolvePartMix({ eq: { lo: 0 } }).eq === null,
     "an untouched part strip did not resolve flat");
  ok(F.resolvePartMix({ eq: { lo: 4 } }).eq.lo === 4,
     "a part's set band did not resolve through eqDb");
  ok(F.resolveBuses(null).rev.eq === null,
     "an absent buses spec grew a return EQ");
  ok(F.resolveBuses({ rev: { eq: { hi: 6 } } }).rev.eq.hi === 6,
     "a return's set band did not resolve");
  ok(F.busesIsDefault({ rev: { eq: { lo: 0 } } }),
     "a flat return EQ counted as a treatment — setBuses would keep it");
  ok(!F.busesIsDefault({ rev: { eq: { lo: 3 } } }),
     "a real return EQ counted as the default — setBuses would drop it");

  // (e) THE LOADER, at all three doors. Band KEYS filter, VALUES take the
  // fader's policy (garbage rejects, wild clamps, zero normalizes away).
  const trial = mut => {
    const b = S.emptyBox(); const s = { v: 2, slots: [S.blank()], song: [b], bpm: 126, vol: 80 };
    mut(b, s); return S.validateSong(s);
  };
  {
    const r = trial(b => { b.eq = { lo: 3.14159, mid: 0, junk: 5 }; });
    ok(r.ok && JSON.stringify(r.song.song[0].eq) === '{"lo":3.1}',
       "the box eq did not come back filtered+clamped: " +
       JSON.stringify(r.ok && r.song.song[0].eq));
    const bad = trial(b => { b.eq = { mid: "loud" }; });
    ok(!bad.ok && bad.errors[0].path === "song[0].eq.mid",
       "a garbage band did not name its own field: " + JSON.stringify(bad.errors[0]));
    ok(!trial(b => { b.eq = [3]; }).ok, "an array was accepted where the strip wants a map");
    ok(trial(b => { b.eq = { lo: 0, hi: 0 }; }).song.song[0].eq === null,
       "an all-zero box eq did not normalize to absent");
    ok(trial(b => { b.eq = { lo: 99 }; }).song.song[0].eq.lo === 12,
       "a wild band did not clamp to the registry's own range");
  }
  {
    const r = trial(b => { b.parts = { lead: { eq: { hi: -6 } } }; });
    ok(r.ok && r.song.song[0].parts.lead.eq.hi === -6,
       "a part's eq did not survive the loader");
    ok(trial(b => { b.parts = { lead: { eq: { hi: 0 } } }; }).song.song[0].parts === null,
       "a flat part eq did not normalize the whole entry away");
    // string garbage, deliberately: a NaN cannot survive the JSON round trip
    // every save takes (it lands as null, which is a legal empty band)
    const bad = trial(b => { b.parts = { lead: { eq: { lo: "loud" } } }; });
    ok(!bad.ok && bad.errors[0].path === "song[0].parts.lead.eq.lo",
       "a part's garbage band did not name its field: " + JSON.stringify(bad.errors[0]));
  }
  {
    const r = trial((b, s) => { s.buses = { rev: { eq: { lo: 3, mid: 6 } } }; });
    ok(r.ok && JSON.stringify(r.song.buses) === '{"rev":{"eq":{"lo":3}}}',
       "the bus pair did not filter the band it lacks: " +
       JSON.stringify(r.ok && r.song.buses));
    const bad = trial((b, s) => { s.buses = { echo: { eq: { hi: "x" } } }; });
    ok(!bad.ok && bad.errors[0].path === "buses.echo.eq.hi",
       "a return's garbage band did not name its field: " + JSON.stringify(bad.errors[0]));
    ok(trial((b, s) => { s.buses = { room: { eq: { lo: 0 } } }; }).song.buses === null,
       "a flat return eq did not normalize the buses map to absent");
  }
  // (f) …and the round trip every save takes, at all three homes at once
  {
    const once = trial((b, s) => {
      b.eq = { mid: -2.5 };
      b.parts = { drums: { eq: { lo: 6 } } };
      s.buses = { rev: { ret: "up", eq: { hi: -4 } } };
    });
    ok(once.ok, "a full eq spec did not validate: " +
       JSON.stringify(once.errors && once.errors[0]));
    const twice = S.load(JSON.parse(JSON.stringify(once.song)));
    ok(twice.ok &&
       JSON.stringify(twice.song.song[0].eq) === JSON.stringify(once.song.song[0].eq) &&
       JSON.stringify(twice.song.song[0].parts) === JSON.stringify(once.song.song[0].parts) &&
       JSON.stringify(twice.song.buses) === JSON.stringify(once.song.buses),
       "the strip EQ is not stable across a save/load round trip");
  }
}

/* ---------- 38. THE DISSONANCE CENSUS -------------------------------------
   THE EARS SAID "TANGO IS INHARMONIC. COUNTERPOINT IS INHARMONIC." Nothing in
   this suite could have caught that: every check above asks whether a value
   reaches the output, and a wrong note reaches the output perfectly. So this
   section measures the one thing none of the others do — what the notes sound
   like AGAINST EACH OTHER — over every genre, several composed seeds, and both
   the one-phrase box and the multi-phrase box, with the phrases DEALT ACROSS
   VOICES exactly as ui/derive.js deals them (voice v gets phrase v % n; render
   every voice from one phrase and the lines move in lockstep, which hides
   every clash that only exists because two parts move independently).

   Four measurements, all normalized per bar or per sounding moment:
     (a) ic1   simultaneous SEMITONE collisions       (minor 2nd / major 7th)
     (b) ic6   simultaneous TRITONE collisions
     (c) nct%  non-chord AND non-scale tones landing on strong beats
     (d) mb/mp the (a)+(b) weight that is melody-vs-BASS and melody-vs-PAD

   HOW A PREPARED DISSONANCE IS TOLD FROM A WRONG NOTE, which is the whole
   reason this is a census and not a clash counter. A fugue's suspensions and a
   blues' passing tones are CORRECT and must not be scored. Four rules, applied
   in order to every overlapping pair:

     1. THE CHORD'S OWN COLOUR IS NOT A CLASH. If both pitch classes are in the
        sounding chord, the dissonance is the chord — a maj7 owns an ic1, a
        dom7 owns an ic6 — and twelve bars of blues must not read as twelve
        bars of mistake.
     2. THE ACCUSED IS THE NOTE OUTSIDE THE CHORD. If neither is in it, the one
        that entered LAST is the dissonance against the standing note; and a
        pad or stab voice is never the accused while a line is available, since
        its notes ARE the harmony by construction.
     3. PREPARED AND RESOLVED IS FORGIVEN. Approached by step (or tied over)
        AND left by step is a suspension, a passing tone or a neighbour — the
        species-counterpoint licence — and scores zero. So does an APPROACH
        TONE with no preparation at all: a note that steps into a chord tone of
        the chord it lands in is an appoggiatura, and it is the definition of a
        walking bass's fourth beat. (Without that clause the walk read as the
        worst clash in the table, which was a census bug and not a genre one.)
     4. WHAT IS LEFT IS A WRONG NOTE: leapt into, leapt out of, and outside the
        harmony. Weighted by how long the two actually overlap, and discounted
        with register — a minor second inside one octave is the complaint; the
        same interval class three octaves apart is a colour.

   WHAT IT FOUND, and both were confirmed before anything was theorized:
     * COUNTERPOINT was the worst genre in the table that is not supposed to be
       dissonant. Both voices play the same rhythm, so invert(c) makes their
       degrees SUM to a constant and the vertical interval is a function of the
       sum alone; sums 2, 3 and 6 (mod 7) are the only three that put a
       semitone or a tritone on a common degree, and the word used 6 and 2.
     * TANGO held minor ninths against its own pad in half its bars: `diatonic`
       keeps the line in the key, the dominant is the one chord in a minor key
       whose scale is NOT the tonic's, and the answering voice's transpose(-2)
       is a third below the SCALE rather than below the chord.
   Fixes: the axis (genres.js) and `anchor` (kernel.js). Census after: 2.00 ->
   0.00 and 1.19 -> 0.40.

   THE GATE. BASELINE is the measured value of every genre, not a wish; the
   ceiling is baseline x 1.5 + 0.20 applied identically to every genre, so one
   that regresses into clashiness fails AND IS NAMED while ordinary churn does
   not. On top of that one absolute BAR, set at the 90th percentile of the
   measured distribution rounded up to the next 0.25 — and the only way past it
   is the ALLOW list, one entry with one reason, never a higher bar.
   `NUKERNEL_CENSUS=1` prints the full ranked table. */
console.log("dissonance census — what the notes sound like against each other");
{
  const C = require("../../nukernel/compose.js");
  const pcOf = n => ((n % 12) + 12) % 12;
  const ICv = (a, b) => { const d = Math.abs(a - b) % 12; return Math.min(d, 12 - d); };

  // ui/derive.js's deal, plus the bass (which follows the first phrase there too)
  const dealt = (g, phs, bars) => {
    const out = [];
    phs.forEach((ph, pi) => {
      for (const e of K.render(ph, g, bars)) if (e.v % phs.length === pi) out.push(e);
    });
    for (const e of K.bass(phs[0], g, bars)) out.push({ ...e, part: "bass", v: -1 });
    return out.filter(e => e.n != null && e.dur > 0).sort((a, b) => a.t - b.t || a.n - b.n);
  };

  function measure(g, phs, bars) {
    const ph = phs[0], NN = ph.deg.length, rate = g.rate, key = g.key | 0;
    const ev = dealt(g, phs, bars);
    if (!ev.length) return null;

    // chords, KEYED — render adds g.key to every pitch and chordsOf does not
    const cache = new Map();
    const chordAt = t => {
      const step = t * rate, bar = Math.floor(step / NN + 1e-9);
      let cs = cache.get(bar);
      if (!cs) {
        cs = K.chordsOf(ph, g, bar).map(c =>
          ({ ...c, pcSet: new Set(c.pcs.map(n => pcOf(n + key))) }));
        cache.set(bar, cs);
      }
      const s = ((step % NN) + NN) % NN;
      return cs.find(c => s >= c.start - 1e-9 && s < c.start + c.len) || cs[cs.length - 1];
    };

    const byV = new Map();
    for (const e of ev) { if (!byV.has(e.v)) byV.set(e.v, []); byV.get(e.v).push(e); }
    const idxOf = new Map();
    for (const [, list] of byV) list.forEach((e, i) => idxOf.set(e, i));
    const neighbours = e => {
      const list = byV.get(e.v), i = idxOf.get(e);
      let prev = null, next = null;
      for (let j = i - 1; j >= 0; j--)
        if (list[j].t < e.t - 1e-9) { if (!prev || list[j].t > prev.t) prev = list[j]; else break; }
      for (let j = i + 1; j < list.length; j++) if (list[j].t > e.t + 1e-9) { next = list[j]; break; }
      return { prev, next };
    };
    // RULES 3 AND 4, in order
    const verdict = a => {
      const { prev, next } = neighbours(a);
      const prepared = prev && Math.abs(a.n - prev.n) <= 2;    // tied over, or stepped into
      const stepOut = next && Math.abs(next.n - a.n) <= 2;
      if (prepared && stepOut) return "ok";                    // suspension / passing / neighbour
      if (stepOut && chordAt(next.t).pcSet.has(pcOf(next.n))) return "ok";   // appoggiatura
      if (!scalePcs.has(pcOf(a.n))) return "wrong";            // out of key AND unresolved
      if (prepared || stepOut) return "ok";                    // in key, connected one side
      return "wrong";                                           // in key, leapt to and left
    };

    const scalePcs = new Set();
    for (const d of (g.scale || K.PENT)) scalePcs.add(pcOf(d + key));
    for (const d of (g.mode || K.MODE)) scalePcs.add(pcOf(d + key));

    const out = { bars, ic1: 0, ic6: 0, ic1raw: 0, ic6raw: 0, nct: 0, notes: 0,
                  mb: 0, mp: 0, all: 0, worst: [] };
    const chordy = p => p === "pad" || p === "stab";
    const active = [];
    for (const e of ev) {
      for (let i = active.length - 1; i >= 0; i--)
        if (active[i].t + active[i].dur <= e.t + 1e-9) active.splice(i, 1);
      for (const o of active) {
        const ov = Math.min(o.t + o.dur, e.t + e.dur) - e.t;
        if (ov <= 1e-9) continue;
        const dur = Math.min(ov * rate, 4);            // steps of overlap, capped
        out.all += dur;                                // the denominator: all sonority
        const ic = ICv(o.n, e.n);
        if (ic !== 1 && ic !== 6) continue;
        const gap = Math.abs(o.n - e.n);
        const w = dur * (gap <= 15 ? 1 : gap <= 27 ? 0.5 : 0.25);
        if (ic === 1) out.ic1raw += w; else out.ic6raw += w;
        const c = chordAt(e.t);
        const inO = c.pcSet.has(pcOf(o.n)), inE = c.pcSet.has(pcOf(e.n));
        if (inO && inE) continue;                      // rule 1
        let acc = !inE ? e : o;                        // rule 2
        if (!inO && !inE) acc = o.t > e.t ? o : e;
        let other = acc === e ? o : e;
        if (chordy(acc.part) && !chordy(other.part)) { const t = acc; acc = other; other = t; }
        if (verdict(acc) !== "wrong") continue;
        if (ic === 1) out.ic1 += w; else out.ic6 += w;
        if (acc.part === "bass" || other.part === "bass") out.mb += w;
        if (chordy(acc.part) || chordy(other.part)) out.mp += w;
        out.worst.push({ w, ic, step: acc.t * rate, n: acc.n, on: other.n,
                         who: (acc.part || "line") + " vs " + (other.part || "line") });
      }
      active.push(e);
    }
    // (c) a foreign tone on a strong beat: in neither the chord nor the key
    for (const e of ev) {
      if (chordy(e.part) || e.part === "bass") continue;
      const step = e.t * rate;
      if (Math.abs(step - Math.round(step)) > 1e-6 || Math.round(step) % 4 !== 0) continue;
      out.notes++;
      const pc = pcOf(e.n);
      if (!chordAt(e.t).pcSet.has(pc) && !scalePcs.has(pc)) out.nct++;
    }
    return out;
  }

  // THE MATERIAL: the seed phrase plus the composer's own bank at four seeds,
  // each read twice — as a one-phrase box and as a multi-phrase one
  const SEEDS = [1, 5, 7, 11], KINDS = [0, 1, 2, 3, 5];   // hook answer riff counter topline
  function census(gk) {
    const g = GENRES[gk], bars = Math.max(4, g.bars), sets = [[DEFAULT]];
    for (const s of SEEDS) {
      const sl = C.compose(gk, s).slots;
      sets.push(KINDS.map(i => sl[i]));
      sets.push([sl[0]]);
    }
    const tot = { ic1: 0, ic6: 0, ic1raw: 0, ic6raw: 0, nct: 0, mb: 0, mp: 0,
                  bars: 0, all: 0, notes: 0 };
    const worst = [];
    for (const set of sets) {
      const m = measure(g, set.slice(0, Math.max(1, g.voices)), bars);
      if (!m) continue;
      for (const k of Object.keys(tot)) if (k !== "bars") tot[k] += m[k];
      tot.bars += m.bars;
      worst.push(...m.worst);
    }
    const per = k => (tot.bars ? tot[k] / tot.bars : 0);
    return { gk, pct: tot.all ? 100 * (tot.ic1 + tot.ic6) / tot.all : 0,
             ic1: per("ic1"), ic6: per("ic6"), ic1raw: per("ic1raw"), ic6raw: per("ic6raw"),
             nct: tot.notes ? 100 * tot.nct / tot.notes : 0, mb: per("mb"), mp: per("mp"),
             worst: worst.sort((a, b) => b.w - a.w).slice(0, 5) };
  }

  // THE MEASURED DISTRIBUTION — every genre's own number, re-baked with
  // `NUKERNEL_CENSUS=1` when a deliberate change moves one. Not a wish list:
  // blues really is at 3.95 and simple really is at 0.
  const BASELINE = {
    blues: 3.95, spem: 2.17, deathmetal: 1.73, shoegaze: 1.72, vaporwave: 1.64,
    ambient: 1.46, garage: 1.43, sludge: 1.27, steely: 1.04, countrypop: 0.89,
    eurythmics: 0.75, bulgarian: 0.74, isley: 0.72, afrobeat: 0.63, funk: 0.61,
    punk: 0.55, ska: 0.52, rnb: 0.46, beatles: 0.43, postrock: 0.43,
    tango: 0.40, drone: 0.35, jodeci: 0.28, disco: 0.27, bossa: 0.23,
    neoclassical: 0.19, toto: 0.17, motown: 0.15, citypop: 0.11, house: 0.09,
    newwave: 0.07, synthpop: 0.05, boombap: 0.04, gospel: 0.03, rock: 0.03,
    simple: 0, fugue: 0, acid: 0, gregorian: 0, counterpoint: 0,
    trap: 0, dnb: 0, reggae: 0, dub: 0, techno: 0,
    // THE ANCESTORS, measured the day they landed (NUKERNEL_CENSUS=1). Every
    // one is under the 1.5 bar, so none of them needs an ALLOW entry — which
    // is worth saying for the two that could have gone either way: chuck berry
    // sounds a major third against a ♭7 twelve bars out of twelve and still
    // reads 0.95 (a third of blues's 3.95) because the double stop is a fourth
    // and fourths are not in the census's alphabet, and doo-wop's 0.85 is
    // almost entirely bass-vs-riff, which is what `anchor: 2` already halved.
    chuckberry: 0.95, doowop: 0.85, electro: 0.77, kraftwerk: 0.43,
    minimalism: 0.29, jazz: 0.14, bodiddley: 0, skiffle: 0,
    // THE FUNCTION GENRES all measure zero, and the reason is the same one for
    // all five: a part carries no progression of its own and reads the same
    // pentatonic the rest of the table does, so standalone there is nothing for
    // it to be out of tune WITH. The number that matters for these is the one
    // the census cannot see — a part STACKED on a host — which is what §40's
    // Beatles test measures instead.
    solo: 0, vocal: 0, backing: 0, riff: 0, pad: 0,
    // THE TWENTY-NINE ROOMS, measured the day after they landed
    // (NUKERNEL_CENSUS=1), appended the way the ancestors were rather than
    // merged into the sorted rows above — these are their own first
    // measurement, not a re-bake of anyone else's. Twenty-five of the
    // twenty-nine come in under the 1.5 bar. FOUR DO NOT and are on ALLOW
    // below, each for a mechanism you can name.
    screamo: 3.26, confessionalpop: 2.18, drill: 1.95, sophistirock: 1.79,
    industrialmetal: 1.17, latinpop: 0.81, merseybeat: 0.78, hymn: 0.65,
    psychpop: 0.62, jamband: 0.56, synthduo: 0.40, boyband: 0.37, emo: 0.33,
    yuletide: 0.32, darkrnb: 0.29, powerballad: 0.28, reggaeton: 0.26,
    roboticpop: 0.24, retrofunkpop: 0.23, worldfolk: 0.20, bigroom: 0.13,
    clubpop: 0.11, blueeyedsoul: 0.10, crooner: 0.09, ebm: 0.06, kpop: 0.04,
    bigbeat: 0.03, folkduo: 0, motorik: 0,
    // THE TWENTY-THREE, measured the day they landed (NUKERNEL_CENSUS=1) and
    // appended for the same reason: a first measurement, never a re-bake of a
    // neighbour's. Twenty come in under the 1.5 bar, several of them at a flat
    // zero (softfolk, grebo, bleeptechno, industrialrock and industrialbreaks
    // sound one line over a root and nothing else). THREE ARE OVER and are on
    // ALLOW below, all three by the same inherited mechanism.
    altcountry: 2.39, janglepop: 2.38, indiedance: 1.72, spacerock: 1.11,
    songwriterpiano: 0.96, yachtrock: 0.91, musichallrock: 0.80,
    melodictechno: 0.79, dancepostpunk: 0.61, singersongwriter: 0.59,
    analogsynthpop: 0.45, postpunk: 0.44, coastrock: 0.38, orchpsych: 0.30,
    madchester: 0.29, gothicpop: 0.28, gothsynth: 0.25, yachtsoul: 0.21,
    industrialbreaks: 0.01, softfolk: 0, grebo: 0, bleeptechno: 0,
    industrialrock: 0,
  };
  const ceilOf = b => b * 1.5 + 0.20;      // one headroom rule for every genre

  // THE BAR — the 90th percentile of the measured distribution above, rounded
  // up to the next 0.25. Derived, not chosen: recompute it when the table is
  // re-baked. Everything over it must be on ALLOW.
  //
  // AND IT STAYS AT 1.5 with eighty-seven genres in the table. Recomputing the
  // rule over the widened distribution says 1.75, and that is exactly the move
  // the paragraph below forbids: it would drop shoegaze and vaporwave under
  // the bar and turn two argued exemptions into dead ones, which is a bar
  // loosened to suit the table rather than a table held to the bar.
  const BAR = 1.5;
  // LEGITIMATELY DISSONANT, one reason each. This list is the ONLY way past
  // the bar; raising the bar to admit a genre would exempt the whole table.
  const ALLOW = {
    blues: "the ♭5 blue note is in the subject's scale and in none of the " +
           "twelve dominant sevenths — the flat third against the major IV is the sound",
    spem: "eight independent voices under `emergent` harmony: the chord the census " +
          "measures against is a triad no voice plays, and Renaissance polyphony " +
          "is collision by construction",
    deathmetal: "locrian, where the tonic sonority is itself a tritone — the ♭5 is home",
    shoegaze: "the genre IS a held second: both guitars play the same phrase one " +
              "degree apart, which its own entry calls detune as counterpoint",
    vaporwave: "the semitone follow lands a pentatonic minor third over a major III — " +
               "the blues' mechanism exactly, and the haze is the point",
    // THE FOUR OF THE TWENTY-NINE that came in over the bar on their first
    // measurement. Two of them are a scale — the material is dissonant and
    // that is the genre — and two are one held note, which is a different
    // claim and the one to point an ear at.
    screamo: "it declares death metal's own locrian scale and mode, so the same " +
             "sentence applies: the tonic sonority is a tritone and the ♭2 over it " +
             "is the scream",
    drill: "harmonic minor under modal harmony — the ♭6 against the ♮7 is an " +
           "augmented second, the one interval nothing else in the table plays, " +
           "and it is the whole menace of the genre",
    confessionalpop: "legato lines with maxHold 3 SUSTAIN THROUGH THE CHANGE, so " +
                     "the diatonic tritone (the IV's fourth held into the V's " +
                     "leading tone) reads as unprepared by construction — the " +
                     "suspension is the writing, but this one is worth a listen",
    sophistirock: "the same held-note mechanism as confessionalpop, over a dorian " +
                  "with both the ♭3 and the ♮6 — sophisti-pop's extended chords are " +
                  "suspensions that do not resolve inside the bar; also worth a listen",
    // THE THREE OF THE TWENTY-THREE that came in over the bar, and all three
    // by the mechanism the two rows above already name: a long maxHold under
    // `cycle` harmony, which is a line that is still sounding when the chord
    // moves. They are not a new kind of clash, they are the SAME one inherited
    // — which is why each names its own mode as well, because the interval the
    // hold lands on is the mode's, not the mechanism's.
    altcountry: "mixolydian at maxHold 3 — the held ♭7 is what a pedal-steel bend " +
                "leaves ringing over the IV, and mixolydian's ♭7 against the IV's " +
                "own third is the semitone the census counts; it is the twang",
    janglepop: "the LONGEST hold in the table (maxHold 4) over ionian `cycle` " +
               "changes — a rung-out open chord on a twelve-string is a suspension " +
               "that outlives its bar by design; worth an ear more than the other two",
    indiedance: "mixolydian at maxHold 3 over a four-to-the-floor cycle: altcountry's " +
                "interval on madchester's clock, and the loose ringing guitar over a " +
                "moving bass is the whole joke of the genre",
  };

  // GK_FULL: every genre carries its own baked BASELINE ceiling and the
  // allowance list is keyed by name (down to two genres checked by name at
  // the bottom) — a regression ceiling is a coverage law, not a sample of
  // one, and the whole census cost well under a second at 110 anyway.
  const rows = GK_FULL.map(census).sort((a, b) => b.pct - a.pct);
  const f = x => x.toFixed(2).padStart(7);
  if (process.env.NUKERNEL_CENSUS) {
    console.log("  genre           %bad    ic1    ic6  (raw1) (raw6)   nct%     mb     mp");
    for (const r of rows)
      console.log("  " + r.gk.padEnd(14) + f(r.pct) + f(r.ic1) + f(r.ic6) +
                  f(r.ic1raw) + f(r.ic6raw) + f(r.nct) + f(r.mb) + f(r.mp));
  } else {
    console.log("  worst six: " + rows.slice(0, 6)
      .map(r => r.gk + " " + r.pct.toFixed(2)).join("  ") +
      "   (NUKERNEL_CENSUS=1 for all " + GK_FULL.length + ")");
  }

  for (const r of rows) {
    const base = BASELINE[r.gk];
    ok(base != null, r.gk + ": no census baseline — a new genre must be measured " +
       "and baked into BASELINE, not left unmeasured");
    if (base == null) continue;
    const worst = r.worst[0];
    ok(r.pct <= ceilOf(base) + 1e-9,
       r.gk + " REGRESSED INTO CLASHINESS: " + r.pct.toFixed(2) + "% of its sonority is " +
       "unprepared semitone/tritone, ceiling " + ceilOf(base).toFixed(2) + "% (baseline " +
       base.toFixed(2) + "). Worst: " + (worst
         ? "ic" + worst.ic + " at step " + worst.step.toFixed(0) + ", " + worst.who +
           ", " + worst.n + " against " + worst.on
         : "n/a"));
    ok(r.pct <= BAR + 1e-9 || ALLOW[r.gk],
       r.gk + " is over the " + BAR + "% bar at " + r.pct.toFixed(2) + "% and is not on " +
       "the allowance list. Fix it, or add it with a REASON — do not raise the bar");
  }
  // the allowance list may not rot into a mute button
  for (const gk of Object.keys(ALLOW))
    ok(BASELINE[gk] > BAR, gk + " is on the allowance list but measures " +
       BASELINE[gk] + "%, under the bar — a dead exemption is an exemption nobody checked");
  // and the two the ears named stay fixed, by name
  ok(rows.find(r => r.gk === "counterpoint").pct <= 0.35,
     "counterpoint: the inversion axis has drifted back onto a semitone sum");
  ok(rows.find(r => r.gk === "tango").pct <= 0.70,
     "tango: the held note is off the chord again — check `anchor`");
}

/* ---------- 39. DYNAMICS ----------------------------------------------------
   THE EARS SAID "everything plays around the same. There are no crescendos or
   decrescendos inside of the music. There is no organic difference in the sound
   of the notes." Measured, they were exactly right and the number was damning:
   every one of the 45 genres rendered a mean velocity of 6.90, a standard
   deviation of 1.45 and a range of 4..9 — the SAME three numbers for all of
   them — because all 45 read the same eight values off the phrase's vel vector
   and nothing downstream was a function of where a note sat or which pass this
   was. Three flat sources, repeating identically every loop.

   Everything here reads the RENDERED STREAM, and the two halves are measured
   separately: the PERFORMANCE (kernel.js stress/phrase/touch — per note, per
   bar) and the ARC (the `env` dynamics — per section, dealt by the composer
   across the song). The last check is the one that keeps the whole layer
   honest: the machines are frozen by fingerprint, so "opt-in" is a fact rather
   than a claim. */
console.log("dynamics — metrical stress, phrase arch, the hand, and the section arc");
{
  const crypto = require("crypto");
  const fp = ev => crypto.createHash("sha1").update(JSON.stringify(ev.map(e =>
    [+e.t.toFixed(6), e.n, e.d, +(e.dur || 0).toFixed(6), e.vel, e.acc, e.sld]))).digest("hex").slice(0, 16);
  const sd = xs => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
  };
  const barsOf = (ev, bs, n) => Array.from({ length: n }, (_, b) =>
    ev.filter(e => e.t >= b * bs && e.t < (b + 1) * bs));

  // (a) THE MACHINES ARE FROZEN. techno/acid/house/trap declare no dynamics, and
  // these are the sha1s of their full streams taken the commit BEFORE the
  // performance layer existed. A machine genre that starts breathing fails here
  // by name, which is the only way "absent is byte-identical" stays true rather
  // than remaining true by luck.
  // ...and ELECTRO, the fifth machine, whose fingerprint was taken the day it
  // landed rather than before the layer existed — there is no "before" for an
  // anchor that arrived after it. The contract is the same one: an 808 says
  // its weight with an accent switch (`kitVel`), so if this genre ever starts
  // breathing it fails here by name.
  // (acid re-measured 2026-08-18: its 909 gained a kitVel hand — kick 9,
  // clap 8, open-hat 7, tick 3/4 — and the record moved to 124. kitVel is the
  // accent switch the electro row's own comment blesses; stress/phrase/touch
  // stay undeclared, so the machine still does not breathe.)
  const MACHINE = { techno: "036036ec46edb986", acid: "6442d27c8bfb9828",
                    house: "2f1c41112ac01206", trap: "addcf7d93d0fdcfa",
                    electro: "1b4dccccfb127a5e" };
  for (const gk of Object.keys(MACHINE)) {
    const g = GENRES[gk], bars = Math.max(4, g.bars);
    ok(fp(allEvents(P, g, bars)) === MACHINE[gk],
       gk + ": a machine genre no longer renders what it rendered before the " +
       "performance layer existed — dynamics must stay opt-in");
    ok(!g.stress && !g.phrase && !g.touch,
       gk + ": a machine genre declares dynamics — the fingerprint above is the " +
       "contract, this is the reason it holds");
  }

  // (b) NEUTRALITY, the §22 law for the three new fields: the documented
  // neutral value renders byte-identically to the field being absent.
  for (const gk of ["funk", "blues", "gregorian", "vaporwave"]) {
    const g = GENRES[gk], bare = { ...g }, zeroed = { ...g, stress: 0, phrase: 0, touch: null };
    delete bare.stress; delete bare.phrase; delete bare.touch;
    ok(fp(allEvents(P, bare, g.bars)) === fp(allEvents(P, zeroed, g.bars)),
       gk + ": stress/phrase/touch neutral values are not the same as absent");
    // ...and each one on its own must MOVE the stream, or it is a dead field
    for (const f of [{ stress: 0.6 }, { phrase: 0.6 }, { touch: { t: 0.06, v: 1 } }])
      ok(fp(allEvents(P, { ...zeroed, ...f }, g.bars)) !== fp(allEvents(P, zeroed, g.bars)),
         gk + ": " + Object.keys(f)[0] + " does not reach the rendered stream");
  }

  // (c) VARIANCE ROSE, and it rose per genre rather than on average: the flat
  // 1.45 was the whole complaint. Every genre that declares a hand must spread
  // its velocities wider than the phrase vector alone does, and the range must
  // open DOWNWARD — the old stream never went under 4, so the bottom half of
  // the scale did not exist.
  {
    let wired = 0, wider = 0, lower = 0;
    for (const gk of GK) {
      const g = GENRES[gk];
      if (!g.stress && !g.phrase && !g.touch) continue;
      wired++;
      const vs = K.render(DEFAULT, g, g.bars).map(e => e.vel);
      const flat = K.render(DEFAULT, plain(g), g.bars).map(e => e.vel);
      if (sd(vs) > sd(flat) + 1e-9) wider++;
      if (Math.min(...vs) < Math.min(...flat)) lower++;
      ok(Math.max(...vs) <= 9 && Math.min(...vs) >= 0,
         gk + ": the performance layer put a velocity outside 0..9");
    }
    // EXHAUSTIVE, not mostly: every genre either declares all three fields or is
    // one of the four machines that declare none on purpose. A genre that
    // resolves to neither renders flat forever and nothing else would say so.
    for (const gk of GK) {
      const g = GENRES[gk];
      ok(MACHINE[gk] != null || (g.stress != null && g.phrase != null && g.touch != null),
         gk + ": no dynamics row — it is neither a declared machine nor a genre " +
         "with stress/phrase/touch, so it will render flat forever");
    }
    // "GK.length - |MACHINE|" only equals "genres in GK that are not
    // machines" when GK is the whole catalog; counted directly it holds at
    // any sample size, fast or sweep.
    const expectWired = GK.filter(gk => MACHINE[gk] == null).length;
    ok(wired === expectWired,
       wired + " genres declare dynamics; expected " +
       expectWired + " (everything but the machines)");
    ok(wider >= wired - 2, "only " + wider + "/" + wired + " wired genres widened " +
       "their velocity spread; the flat 1.45 is what this layer exists to break");
    ok(lower >= wired * 0.6, "only " + lower + "/" + wired + " genres reached below " +
       "their written floor — the dynamic room is at the bottom of the scale");
  }

  // (d) NO TWO PASSES ARE THE SAME BAR. The hand is redrawn per bar, so a
  // genre that declares `touch` must render bar 3 differently from bar 1 — in
  // velocity, in onset, or both. This is the "every rendition of a bar is
  // numerically the same bar" complaint, as an assertion.
  for (const gk of ["funk", "blues", "boombap", "rock", "gregorian"]) {
    const g = GENRES[gk], bs = 16 / g.rate, n = Math.max(4, g.bars);
    const ev = K.render(DEFAULT, g, n).filter(e => e.v === 0);
    const cells = barsOf(ev, bs, n).map(bar =>
      JSON.stringify(bar.map(e => [+((e.t % bs) * g.rate).toFixed(3), e.vel])));
    ok(new Set(cells).size >= Math.min(3, n),
       gk + ": " + new Set(cells).size + " distinct bars in " + n + " — the loop is " +
       "playing the identical numbers every pass");
    // ...and it is the HAND doing it, not the notes: with the player taken out
    // the same bars are identical again
    const flatCells = barsOf(K.render(DEFAULT, plain(g), n).filter(e => e.v === 0), bs, n)
      .map(bar => JSON.stringify(bar.map(e => [+((e.t % bs) * g.rate).toFixed(3), e.vel])));
    ok(new Set(flatCells).size < new Set(cells).size,
       gk + ": the bars differ with the player taken out too — this is the phrase, " +
       "not the performance");
  }

  // (e) DETERMINISM. Seeded, not random: two renders of one state are the same
  // stream, or the whole artifact stops being reproducible.
  for (const gk of ["funk", "tango", "neoclassical"])
    ok(fp(allEvents(P, GENRES[gk], GENRES[gk].bars)) ===
       fp(allEvents(P, GENRES[gk], GENRES[gk].bars)),
       gk + ": two renders of one state differ — the hand is not seeded");

  // (f) THE PHRASE PEAK LANDS ON THE CONTOUR PEAK. Built by hand: a bar with an
  // unambiguous high note in the middle, read through a genre that is all
  // phrase and nothing else, so the tent is the only term moving.
  {
    const arch = { deg:  [0, 1, 2, 3, 5, 3, 2, 1, 0, 1, 2, 1, 0, 1, 0, 1],
                   oct:  new Array(16).fill(0), vel: new Array(16).fill(5),
                   inc:  new Array(16).fill(0), stk: new Array(16).fill(0),
                   gate: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                   acc:  new Array(16).fill(0), sld: new Array(16).fill(0) };
    const g = { ...plain(GENRES.simple), phrase: 0.9 };
    const ev = K.render(arch, g, 1);
    const flat = K.render(arch, plain(GENRES.simple), 1);
    const top = Math.max(...ev.map(e => e.n));
    const pk = ev.findIndex(e => e.n === top);
    ok(pk > 0, "the test phrase has no interior peak — the fixture is wrong");
    ok(ev[pk].vel === Math.max(...ev.map(e => e.vel)),
       "the phrase's highest note is not its loudest — the tent does not peak on " +
       "the contour");
    ok(ev[0].vel < ev[pk].vel && ev[ev.length - 1].vel < ev[pk].vel,
       "the phrase does not taper to both ends (" + ev.map(e => e.vel).join(",") + ")");
    // the AGOGIC half: the peak is held longer than it was written, and no
    // other note is
    ok(ev[pk].dur > flat[pk].dur + 1e-9,
       "the peak note is not held any longer — the agogic half of the accent is missing");
    ok(ev.every((e, i) => i === pk || Math.abs(e.dur - flat[i].dur) < 1e-9),
       "a note that is not the peak changed length — the agogic is not agogic");
    // and it never runs into the note after it, nor past its own cap
    ok(ev.every((e, i) => i + 1 >= ev.length || e.t + e.dur <= ev[i + 1].t + 1e-9),
       "the lengthened peak overlaps the note after it — that is a tie, not an accent");
    const capped = K.render(arch, { ...g, maxHold: 1 }, 1);
    ok(capped.every(e => e.dur <= 1 / GENRES.simple.rate + 1e-9),
       "the agogic peak grew past maxHold — breath is not optional");
  }

  // (g) METRICAL ACCENT IS A HIERARCHY, and it is one in the OUTPUT: on a
  // phrase whose written velocities are all equal, the downbeat outweighs the
  // beat, the beat outweighs the "and", and the "and" outweighs the sixteenth
  // between them. Scaled per genre, so a genre with a bigger `stress` separates
  // them further.
  {
    const even = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                   vel: new Array(16).fill(5), inc: new Array(16).fill(0),
                   stk: new Array(16).fill(0), gate: new Array(16).fill(1),
                   acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
    const at2 = (g, i) => K.render(even, g, 1).filter(e => e.v === 0)[i].vel;
    const g = { ...plain(GENRES.simple), stress: 0.8 };
    ok(at2(g, 0) > at2(g, 4) && at2(g, 4) > at2(g, 2) && at2(g, 2) >= at2(g, 1),
       "the metrical hierarchy is not in the rendered velocities (" +
       [0, 4, 2, 1].map(i => at2(g, i)).join(">") + ")");
    const soft2 = { ...plain(GENRES.simple), stress: 0.25 };
    ok(at2(g, 0) - at2(g, 1) > at2(soft2, 0) - at2(soft2, 1),
       "stress does not scale — a heavier genre must separate the beats further");
    ok(K.stressAt(0, 12) === 1 && K.stressAt(3, 12) === 0.3 && K.stressAt(6, 12) === 0.55,
       "a twelve-step bar does not stress its three beats");
  }

  // (h) THE SECTION ARC. Six new `env` shapes, and the property that separates
  // them from the four fades is that they never reach zero — a dynamic is a
  // size, not an entrance.
  {
    const g = GENRES.rock, span = g.bars * 16 / g.rate;
    const ev = K.render(P, g, g.bars);
    const lvl = out => {
      const a = [...out].sort((x, y) => x.t - y.t);
      const half = Math.floor(a.length / 2);
      const mean = xs => xs.reduce((s, e) => s + e.vel, 0) / xs.length;
      return [mean(a.slice(0, half)), mean(a.slice(half))];
    };
    for (const kind of ["cresc", "dim", "arch", "lift", "soft", "big"]) {
      const out = K.envelope(ev, kind, span);
      ok(out.length === ev.length, kind + " changed the event count — it is a curve, not a cut");
      ok(out.every(e => e.vel >= 0 && e.vel <= 9), kind + " left a velocity out of 0..9");
      ok(out.every(e => e.vel > 0), kind + " silenced a note — a dynamic is not a fade");
    }
    const cr = lvl(K.envelope(ev, "cresc", span));
    ok(cr[1] > cr[0] * 1.3, "a crescendo section does not climb (" +
       cr.map(x => x.toFixed(2)).join(" -> ") + ")");
    const dm = lvl(K.envelope(ev, "dim", span));
    ok(dm[1] < dm[0] * 0.8, "a diminuendo does not fall away");
    const lf = lvl(K.envelope(ev, "lift", span));
    ok(lf[1] > lf[0] * 1.15, "a build does not build");
    // the arch peaks in the MIDDLE and comes back — which `swell` does too, and
    // the difference is that the arch is still audible at both ends
    const ar = K.envelope(ev, "arch", span).sort((a, b) => a.t - b.t);
    ok(ar[0].vel > 0.5 * ev.sort((a, b) => a.t - b.t)[0].vel,
       "the arch starts as quietly as a fade — it is supposed to be a shape, not an entrance");
    // soft vs big is the whole point: the same bar, two sizes
    const sm = lvl(K.envelope(ev, "soft", span))[0], bg = lvl(K.envelope(ev, "big", span))[0];
    ok(bg > sm * 1.4, "big is not measurably bigger than soft (" + sm.toFixed(2) +
       " vs " + bg.toFixed(2) + ") — the chorus cannot outweigh the verse");
    ok(K.envelope(ev, "big", span).every(e => e.vel <= 9),
       "big pushed a velocity past the ceiling");
  }
}

/* ---------- 39b. THE ARRANGED DYNAMIC, measured on ui/derive.js ------------
   §39 proves the shapes work; this proves the COMPOSER spends them, on the
   real render path, over the whole table. The complaint was about listening to
   a composed song, so the check has to be about one. */
console.log("the arranged dynamic — the chorus outweighs the verse, on the real render path");
{
  const C = require("../../nukernel/compose.js");
  const seeds = Array.from({ length: seedCount(12) }, (_, i) => i + 1);
  const meanVel = ev => (ev.length
    ? ev.reduce((s, e) => s + (e.vel == null ? 5 : e.vel), 0) / ev.length : 0);
  // (a) EVERY SECTION IS DEALT A DYNAMIC. A composed song with eight flat
  // boxes in the middle of it is the record the ears were complaining about.
  {
    let flat = 0, total2 = 0;
    for (const gk of GK) for (const s of seeds.slice(0, 4)) {
      for (const b of C.compose(gk, s).song) { total2++; if (!b.env) flat++; }
    }
    ok(flat / total2 <= 0.2, flat + "/" + total2 + " composed sections carry no " +
       "level shape at all — the arc is not being spent");
  }
  // (b) AND IT IS AUDIBLE IN THE EVENTS: the last chorus of a song outweighs
  // the verse before it, measured as mean rendered velocity through the real
  // sectionEvents path (window, envelope, edges, groove — everything) TIMES
  // the box's own level, which is §31(a)'s measure and is the honest one.
  //
  // IT WAS NOT, until the singer landed on the verses. `lvl` was left out of
  // this row while the verse was the band alone; put a lead vocal on it — a
  // topline with accents and a velocity-9 climax in it — and the verse's mean
  // velocity climbs to within a tenth of the drop's on a house record, and
  // four of twelve seeds measured backwards. Nothing about the arrangement was
  // wrong: the peak carries `lvl: "fwd"` (×1.35 at the desk, fields.js LEVELS)
  // and the verse does not, and a section's size is what the mixer does with
  // it as much as what the velocities say. Reading one and not the other was
  // the measurement's bug rather than the composer's.
  const LV = require("../../nukernel/fields.js").LEVELS;
  for (const gk of ["rock", "beatles", "isley", "funk", "house"]) {
    let bigger = 0, n2 = 0;
    for (const s of seeds) {
      const song = C.compose(gk, s);
      const ci = song.song.map((b, i) => [b, i]).filter(([b]) =>
        (b.cue || b.role) === "chorus" || (b.cue || b.role) === "drop").pop();
      if (!ci) continue;
      const vi = song.song.slice(0, ci[1]).map((b, i) => [b, i])
        .filter(([b]) => b.role === "verse" && !b.cue).pop();
      if (!vi) continue;
      n2++;
      const lvl = b => LV[b.lvl || "norm"];
      const cv = meanVel(D.sectionEvents(ci[0], song.slots).ev) * lvl(ci[0]);
      const vv = meanVel(D.sectionEvents(vi[0], song.slots).ev) * lvl(vi[0]);
      if (cv > vv) bigger++;
    }
    ok(n2 > 0 && bigger >= n2 - 1, gk + ": the last chorus is louder than the verse " +
       "before it in only " + bigger + "/" + n2 + " songs — the arc is not reaching " +
       "the notes");
  }
  // (c) THE WHOLE SONG HAS A SHAPE: across a composed record the per-section
  // mean velocity must actually vary — one number for every section is the
  // "everything plays around the same" complaint at song scale.
  for (const gk of ["rock", "funk", "house", "gregorian"]) {
    const song = C.compose(gk, 5);
    const means = song.song.map(b => meanVel(D.sectionEvents(b, song.slots).ev))
      .filter(x => x > 0);
    const lo = Math.min(...means), hi = Math.max(...means);
    ok(hi - lo >= 1.2, gk + ": the loudest section of a composed song is only " +
       (hi - lo).toFixed(2) + " velocity above the quietest — the record is flat");
  }
}

/* ---------- 39c. THE SECOND KIND OF DYNAMICS, the pure half -----------------
   §39 and §39b prove velocity has range and shape in the STREAM. That range
   still only moved LOUDNESS: a note played harder was the same note turned up,
   which is the other half of "there is no organic difference in the sound of
   the notes". audio/voices.js now maps velocity onto timbre — a per-note high
   shelf tilted by velocity with the strike on top of it, a shorter amp attack,
   a sample-start offset, and the synth voices' own cutoff/env-amount — off the
   per-family table in instruments.js.

   The audible claim needs a browser and lives in nukernel-drums (G), where the
   control is the same instrument in the one role that has no response. What is
   PURE is the table: every family the strip walk can name has a response or is
   deliberately without one, the numbers are in range, and — the load-bearing
   one — the curve is zero at the default velocity, because that is what lets
   the player skip the shelf node entirely and leave today's path alone. */
console.log("the second kind of dynamics — the response table and its neutral");
{
  const NI = require("../../nukernel/instruments.js");
  const { DYN, dynFor, dynCurve, DYN_BRIGHT, DYN_ATK,
          familyOf, stripFor, STRIPS, BASS_INSTR } = NI;

  // (a) ONE FAMILY WALK, TWO READERS. dynFor and stripFor must answer about the
  // same instrument from the same table, or a guitar lands on the guitar strip
  // with the generic response — the drift a shared familyOf exists to stop.
  for (const [id, pad, want] of [["crunch_guitar", false, "dirty"],
      ["clean_guitar", false, "guitar"], ["rock_organ", false, "organ"],
      ["ahh_choir", false, "vox"], ["trumpet", false, "brass"], ["flute", false, "reed"],
      ["violin", false, "bowed"], ["marimba", false, "mallet"],
      ["strings_slow", false, "strings"], ["halo_pad", false, "pad"],
      ["yamaha_grand_piano", false, "keys"], ["clean_guitar", true, "pad"],
      ["nothing_at_all", false, "lead"]]) {
    ok(familyOf(id, pad) === want, id + (pad ? " (pad)" : "") + " reads as family " +
       familyOf(id, pad) + ", not " + want);
    ok(stripFor(id, pad) === STRIPS[want], id + ": stripFor and familyOf disagree");
    ok(dynFor(id, pad) === (DYN[want] || null),
       id + ": dynFor and familyOf disagree");
  }
  // the bass chair is reached by id — nothing in the regex table claims it
  ok(dynFor(BASS_INSTR, false) === DYN.bass,
     "the bass chair did not get the bass response (it would take `lead`)");

  // (b) THE TWO SILENT FAMILIES ARE SILENT ON PURPOSE. A drawbar organ has no
  // velocity response in the instrument, and a pad is the one voice a per-note
  // transient shelf would chop. Absent must mean absent, not zeroed: the player
  // branches on null and builds no node at all — which is also what makes the
  // browser gate's control possible, since `pad` is a role any instrument can
  // be put in.
  for (const fam of ["organ", "pad"])
    ok(DYN[fam] == null, fam + " grew a dynamic response — it must stay absent, " +
       "which is how voices.js keeps that path byte-identical");
  ok(dynFor("rock_organ", false) === null && dynFor("anything", true) === null,
     "an organ or a pad answered a response object rather than null");

  // (c) THE TABLE IS COMPLETE AND IN RANGE. Every family the walk can produce
  // either has all five numbers or is one of the two above; a half-filled row
  // is a NaN in a filter frequency.
  const fams = new Set(["dirty", "guitar", "organ", "vox", "brass", "reed", "bowed",
                        "mallet", "strings", "pad", "keys", "lead"]);
  for (const f of fams)
    ok(DYN[f] != null || f === "organ" || f === "pad",
       "family " + f + " has neither a response nor a documented reason to lack one");
  for (const [k, d] of Object.entries(DYN)) {
    ok(STRIPS[k] != null, "DYN names " + k + ", which is not a strip family");
    ok(d.tilt > 0 && d.tilt <= 18, k + ": tilt " + d.tilt + " dB is not a sane swing");
    ok(d.corner >= 400 && d.corner <= 6000,
       k + ": corner " + d.corner + " Hz is not where an instrument's brightness starts");
    ok(d.bite >= 0 && d.bite <= 8, k + ": bite " + d.bite + " dB out of range");
    ok(d.dec > 0 && d.dec <= 0.3, k + ": dec " + d.dec + " is not a short settle");
    ok(d.hand >= 0 && d.hand <= 1, k + ": hand " + d.hand + " out of 0..1");
  }
  ok(new Set(Object.values(DYN).map(d => d.tilt)).size >= 6,
     "every family swings by the same amount — a table of one number is a constant");
  // the ORDERING is the physical claim the table makes, and it is worth one
  // line: a trumpet's timbre moves further with the breath than a string
  // section's does, and a plucked string is more strike than a bowed one
  ok(DYN.brass.tilt > DYN.strings.tilt && DYN.mallet.hand > DYN.bowed.hand,
     "the table has lost its physical ordering — brass must swing further than a " +
     "string section, and a mallet must be more strike than a bow");

  // (d) THE NEUTRAL IS EXACTLY NEUTRAL. This is the whole byte-identity claim,
  // written as arithmetic: at the default velocity the shelf is 0 dB (a literal
  // bypass — which is why the player builds no node at all), the attack is
  // today's 0.006 and the start offset is 0. dynCurve is IMPORTED rather than
  // re-derived: it is the same four lines the player writes onto AudioParams,
  // and a second copy here would be a gate on a copy.
  for (const [k, d] of Object.entries(DYN)) {
    const n = dynCurve(0, d);
    ok(n.db === 0 && n.peakDb === 0 && n.atk === DYN_ATK && n.skip === 0,
       k + ": the curve is not the identity at the default velocity (" +
       JSON.stringify(n) + ") — the skip in voices.js would be a lie");
  }
  // …and it MOVES either side of it, monotonically, in the direction an
  // instrument moves: softer is darker, harder is brighter with a brighter
  // onset still, and the front edge shortens all the way up.
  {
    const d = DYN.keys;
    const soft = dynCurve(-1, d), hard = dynCurve(1, d), half = dynCurve(-0.5, d);
    ok(soft.db < half.db && half.db < 0,
       "a softer note is not darker: " + soft.db.toFixed(1) + " / " + half.db.toFixed(1) + " dB");
    ok(hard.db > 0, "a harder note is not brighter (" + hard.db.toFixed(1) + " dB)");
    // the asymmetry is deliberate — the one-layer sample IS the firm note, so
    // taking its top away is honest and adding to it is invention
    ok(hard.db < -soft.db && Math.abs(hard.db - -soft.db * DYN_BRIGHT) < 1e-9,
       "the loud side is not DYN_BRIGHT of the soft side — the asymmetry documented " +
       "beside DYN is what keeps the shelf from inventing high end the font never had");
    ok(hard.peakDb > hard.db && soft.peakDb === soft.db,
       "the strike is not a loud-side-only transient (" + hard.peakDb.toFixed(1) + " / " +
       soft.peakDb.toFixed(1) + ")");
    ok(hard.atk < DYN_ATK && soft.atk > DYN_ATK,
       "the amp attack does not track the hand: " + hard.atk + " / " + soft.atk);
    ok(hard.atk >= 0.003,
       "the hardest attack is under sampler.js's own 3 ms floor (" + hard.atk + ")");
    ok(hard.skip > 0 && hard.skip <= 0.006 && soft.skip === 0,
       "the sample-start offset is not a hard-hit-only few ms (" + hard.skip + ")");
    // a ghosted note is the extreme the vel vector really produces (0..9 with
    // the default at 5), so the curve has to stay sane one step past full soft
    const ghost = dynCurve(-1.25, DYN.brass);
    ok(ghost.db > -24 && ghost.db < soft.db,
       "the softest note the vel vector can write is " + ghost.db.toFixed(1) + " dB down — " +
       "past about -24 the note has stopped being the instrument and started being a mute");
  }
}

/* ---------- 40. THE FUNCTION GENRES ----------------------------------------
   "What is a Beatles song without a couple of solos. You should also have some
   vocal melodies. So I can see a Beatles song where only the drums remain, but
   the solo plays."

   A FUNCTION GENRE is one whose identity is a ROLE and not a style — solo,
   vocal, backing, riff, pad (genres.js, the `parts` family). Everything below
   is measured on the RENDERED EVENT STREAM through the real ui/derive.js,
   because every claim here is exactly the kind that config can satisfy and
   audio cannot: a genre can declare `nobass` and still emit a bass, a layer can
   declare that it inherits the host's changes and still play its own, and a
   "solo section" can be a box with a solo LAYER on it that nobody can hear.

   Four things:
     (a) THE CONTRACT — a part carries nothing that would fight its host, and
         answers the PARTS chair its name promises, so the per-part mixer can
         address it.
     (b) THE BEATLES TEST, literally: a box whose authority is reduced to drums
         with a solo stacked over it. Drums from the HOST, notes from the LAYER,
         no bass, and both in every bar — plus the two controls that make it a
         proof rather than a description: stripping the authority must leave the
         drum stream byte-identical, and swapping the host must move the solo.
     (c) THE COMPOSER really places them, across the table and across seeds.
     (d) THE SINGER BREATHES — rest ratio and leap distribution, vocal against
         the instrumental leads, on the same phrases. */
console.log("function genres — the part, the Beatles test, and what a singer does");
{
  const C = require("../../nukernel/compose.js");
  const NS = require("../../nukernel/song.js");
  const PARTS5 = ["solo", "vocal", "backing", "riff", "pad"];

  // (a) THE CONTRACT. The layer law (ui/derive.js) hands a stacked genre the
  // authority's harmony, roots, prog, key, mode, rate and swing and drops its
  // kit and bass — so a part that declares any of those is declaring something
  // that will be silently thrown away in the only place it is meant to be used,
  // which is worse than declaring nothing.
  const CHAIR = { solo: "lead", vocal: "lead", backing: "counter",
                  riff: "riff", pad: "pad" };
  for (const gk of PARTS5) {
    const g = GENRES[gk];
    ok(g.family === "parts", gk + ": a function genre outside the `parts` family");
    ok(!Object.keys(g.kit || {}).length && !g.kits,
       gk + ": a part brought its own drums — the host owns the kit");
    ok(g.nobass === true, gk + ": a part brought its own bass — the host owns the bass");
    ok(!g.prog && !g.roots && g.harmony === "modal",
       gk + ": a part carries harmony of its own; stacked, it would follow its " +
       "chords against the box's — half the band in a different song");
    ok(g.voices === 1, gk + ": a part is one part (" + g.voices + " voices)");
    ok(K.partOf(g, 0) === CHAIR[gk], gk + ": answers the \"" + K.partOf(g, 0) +
       "\" chair, not \"" + CHAIR[gk] + "\" — the mixer would address it as " +
       "something it is not");
    ok(C.LAYERABLE.includes(gk), gk + ": a part that the arranger may not stack");
    // and it must SOUND on its own, because it is a genre in the palette and
    // somebody will click it first
    ok(K.render(P, g, g.bars).length > 0, gk + ": renders nothing on its own");
  }
  // the ballots are covered and legal: every family votes, every vote names a
  // real function genre, and the one empty ballot is the deliberate one
  for (const [fam] of FAMILIES) {
    const b = C.SOLO_LEAN[fam];
    ok(Array.isArray(b), fam + ": no SOLO_LEAN ballot — its solos would fall back");
    for (const w of b || []) ok(PARTS5.includes(w),
      fam + ": votes for \"" + w + "\", which is not a function genre");
  }
  ok(C.SOLO_LEAN.parts.length === 0, "a function genre calls a soloist of its own");

  // (b) THE BEATLES TEST. Built by hand and pushed through the LOADER, because
  // a hand-built box the loader would reject is not a thing a person can make.
  const beatlesTest = (host, layerG, hostSlots) => {
    const box = NS.skeleton(host, "solo");
    box.stack = [{ g: host, slots: hostSlots || [] }, { g: layerG, slots: [0] }];
    box.bassop = "nobass";
    // the kit operator the composer writes on a break, and for the reason it
    // writes it: `accents` puts a real level on every lane, so the drums stop
    // borrowing their dynamics from the melody that just stopped playing
    box.kit = "accents";
    box.len = 4;
    const r = NS.load({ v: NS.VERSION, slots: [clone(P)], song: [box], bpm: 120, vol: 80 });
    ok(r.ok, "the Beatles test box does not load: " +
       JSON.stringify(r.errors && r.errors[0]));
    return r.ok ? { box: r.song.song[0], out: D.sectionEvents(r.song.song[0], r.song.slots) }
                : null;
  };
  {
    const t = beatlesTest("beatles", "solo");
    ok(!!t, "the Beatles test never rendered");
    if (t) {
      const ev = t.out.ev;
      const hits = ev.filter(e => e.kind === "hit");
      const line = ev.filter(e => e.kind === "line");
      const bass = ev.filter(e => e.kind === "bass");
      ok(hits.length > 0, "only the drums remain — and they do not: no drum events");
      ok(bass.length === 0, "the bass is still playing under the solo break");
      ok(line.length > 0, "the solo does not play");
      // EVERY note is the layer's: the authority contributed none, which is
      // what "reduced to drums" means as a fact about the stream
      ok(line.every(e => e.layer === "solo"),
         line.filter(e => e.layer !== "solo").length +
         " of the notes came from the host — it was supposed to have stopped");
      // ...and the drums really are the HOST's: beatles' own kit lanes
      const lanes = new Set(hits.map(e => e.d));
      const own = new Set(Object.keys(GENRES.beatles.kit));
      ok([...lanes].every(l => own.has(l)) && lanes.size > 1,
         "the drums under the solo are not the host's kit: " + [...lanes].join(","));
      // ONE BAR APART, not just in total: an aggregate check passes a section
      // where the drums play the first bar and the solo plays the last
      const bs = 16 / t.out.g.rate;
      for (let b = 0; b < t.out.bars; b++) {
        const inBar = xs => xs.some(e => e.t >= b * bs && e.t < (b + 1) * bs);
        ok(inBar(hits), "bar " + b + " of the solo break has no drums");
        ok(inBar(line), "bar " + b + " of the solo break has no solo");
      }
    }
  }
  // THE TWO CONTROLS. Without these the test above is a description of what
  // the composer happened to write rather than a proof of the mechanism.
  {
    // 1. STRIPPING THE AUTHORITY LEAVES THE KIT ALONE, note for note. The
    // drums are GENRE data and the phrase is not, which is the whole reason
    // the strip is expressible at all — the same box with and without the
    // host's melody must render the identical drum stream, and lose exactly
    // the host's half of the notes.
    //
    // WHY BOTH BOXES CARRY `accents`, and it is the finding rather than a
    // convenience: the kit's velocity chain (kernel.js drums) falls through to
    // the MELODY's velocity wherever a lane's cell is the bare 1, so on an
    // unoperated kit this comparison FAILS — the grid is identical and every
    // velocity drops to a flat 5, because the line whose dynamics the kick was
    // borrowing has stopped. That is why the composer writes a level-writing
    // kit op on every break (compose.js BREAK_KIT), and it is the one thing
    // about the strip that is a workaround rather than a mechanism.
    const t = beatlesTest("beatles", "solo");
    const f = beatlesTest("beatles", "solo", [0]);
    ok(f && t, "the control box does not load");
    if (f && t) {
      const drum = xs => JSON.stringify(xs.filter(e => e.kind === "hit")
        .map(e => [+e.t.toFixed(6), e.d, e.vel]));
      ok(drum(f.out.ev) === drum(t.out.ev),
         "taking the host's phrase away changed its drums — the strip is not a strip");
      ok(f.out.ev.filter(e => e.kind === "line").length >
         t.out.ev.filter(e => e.kind === "line").length,
         "the stripped box plays as many notes as the full band");
      // ...and the drums under the break are AUDIBLE, which the grid check
      // cannot see: a kit playing velocity 0 is a kit that renders and does
      // not sound
      const dv = t.out.ev.filter(e => e.kind === "hit").map(e => e.vel);
      ok(Math.max(...dv) >= 6 && dv.filter(v => v > 0).length / dv.length > 0.9,
         "the drums under the solo break render but barely sound (max vel " +
         Math.max(...dv) + ")");
    }
    // 2. THE SOLO READS THE HOST. Same layer, same phrase, two different
    // authorities: if the rendered notes are the same stream, the layer is
    // playing its own harmony and the inheritance is decorative.
    const a = beatlesTest("beatles", "solo"), b = beatlesTest("sludge", "solo");
    ok(a && b && JSON.stringify(a.out.ev.filter(e => e.kind === "line").map(e => e.n)) !==
       JSON.stringify(b.out.ev.filter(e => e.kind === "line").map(e => e.n)),
       "the same solo over two different hosts renders the same notes — it is " +
       "not inheriting the authority's changes");
    // ...and a KEY on the box moves the part with the band, every note of it
    const k = beatlesTest("beatles", "vocal");
    if (k) {
      const lifted = D.sectionEvents({ ...k.box, key: 3 }, [clone(P)]);
      const x = k.out.ev.filter(e => e.n != null), y = lifted.ev.filter(e => e.n != null);
      ok(x.length === y.length && x.every((e, i) => y[i].n - e.n === 3),
         "the singer does not modulate with the band");
    }
  }

  // (c) THE COMPOSER PLACES THEM. Not "can" — does, across the table.
  {
    const seeds = Array.from({ length: seedCount(40) }, (_, i) => i + 1);
    let soloSecs = 0, withPart = 0, strips = 0, chorusParts = 0;
    const used = new Set();
    for (const gk of GK) {
      const kit = Object.keys(GENRES[gk].kit || {}).length > 0;
      for (const s of seeds) {
        for (const b of C.compose(gk, s).song) {
          const parts = b.stack.slice(1).filter(e => PARTS5.includes(e.g));
          for (const e of parts) used.add(e.g);
          if (b.role === "solo") {
            soloSecs++;
            if (parts.length) withPart++;
            if (b.cue === "solobreak") {
              strips++;
              ok(kit, gk + "/" + s + ": a kitless genre was given a solo BREAK — " +
                 "there are no drums for the band to be reduced to");
              ok(b.bassop === "nobass" && !b.stack[0].slots.length,
                 gk + "/" + s + ": a solobreak that did not strip the host");
            }
          } else if (b.role === "chorus" && parts.length) chorusParts++;
        }
      }
    }
    // every family but `parts` has a soloist, so all but five genres * their
    // seeds must carry one — written as a share so a table edit does not
    // require re-counting by hand. The FLOORS below are census-size claims
    // (atLeast: real in SWEEP, non-degenerate in FAST — a 21-genre sample
    // also over-weights the five `parts` genres 5x versus their true 4.5%
    // share, so the RATIO itself is only a fair claim at full breadth).
    ok(atLeast(soloSecs, 400), "only " + soloSecs + " solo sections in the whole sweep");
    ok(SWEEP ? withPart / soloSecs >= 0.85 : withPart > 0,
       "only " + Math.round(100 * withPart / soloSecs) +
       "% of solo sections have anybody playing the solo");
    // the strip is a COIN, not a constant: always would make every solo section
    // a drum break, never would mean the Beatles test is unreachable in practice
    ok(atLeast(strips, 60) && strips < soloSecs * 0.6,
       strips + " solo breaks out of " + soloSecs + " solo sections — the strip " +
       "should be a coin on a genre with a kit, not a constant");
    ok(atLeast(chorusParts, 200), "only " + chorusParts + " choruses carry a part layer — " +
       "the odd chorus was supposed to get one too");
    for (const gk of PARTS5)
      ok(used.has(gk), gk + ": the arranger never once calls for it");
  }

  // (d) WHAT A SINGER DOES, measured against what a lead player does, on the
  // SAME phrases — the composer's own toplines, so the only difference is the
  // genre. Two numbers, both read off the rendered stream, and both defined
  // carefully enough to mean what they say:
  //
  //   BREATH SHARE  the share of the section taken by silences of at least a
  //                 BEAT. Not "rest ratio": a staccato lead is silent for half
  //                 of every note and breathes not at all, so total silence
  //                 measures articulation and calls it phrasing. A breath is a
  //                 STRUCTURAL hole — three steps or more — and on that
  //                 definition the instrumental leads score exactly zero.
  //   LEAP SHARE    the share of intervals wider than a major third, counted
  //                 over MOVES only. A repeated note is not a small interval,
  //                 it is not an interval; counting unisons let `split` — which
  //                 emits its subdivisions on one degree — flatter any genre
  //                 that subdivides into looking like a smooth singer.
  const feel = gk => {
    const g = GENRES[gk], bars = 8, bs = 16 / g.rate;
    let breath = 0, n = 0, ivals = 0, big = 0, span = 0;
    for (let s = 1; s <= 12; s++) {
      // ...and NOT the ornaments (`!e.orn`). This measures how a part is
      // WRITTEN — a singer steps, a soloist leaps — and `solo` grew an
      // ornament policy of its own ("a note can lean, slide, flam or pass"),
      // whose graces and flams are neighbours and unisons by construction. Left
      // in, they halved the soloist's measured leap and the singer came out
      // wider than the horn, which is a fact about decoration, not about line.
      const ev = K.render(C.compose("beatles", s).slots[5], g, bars)
        .filter(e => e.part !== "pad" && !e.orn).sort((a, b) => a.t - b.t);
      if (!ev.length) continue;
      n++;
      let end = 0, sil = 0;
      for (const e of ev) {
        const gap = (e.t - end) * g.rate;
        if (gap >= 3) sil += gap;
        end = Math.max(end, e.t + e.dur);
      }
      const tail = (bars * bs - end) * g.rate;
      if (tail >= 3) sil += tail;
      breath += sil / (bars * 16);
      for (let i = 1; i < ev.length; i++) {
        const d = Math.abs(ev[i].n - ev[i - 1].n);
        if (!d) continue;
        ivals++; span += d; if (d > 4) big++;
      }
    }
    return { breath: breath / n, leap: big / ivals, mean: span / ivals };
  };
  {
    const v = feel("vocal"), s = feel("solo"), b = feel("simple");
    // MEASURED at the commit that added these, on twelve of the composer's own
    // toplines: vocal breath 0.149 / leap 0.287 / mean 3.81 semitones; solo
    // 0.000 / 0.449 / 5.09; the same phrase through `simple` 0.000 / 0.498 /
    // 5.48; through `beatles` 0.000 / 0.726 / 11.26. The fences sit between
    // those, not on them.
    ok(v.breath > 0.10, "the vocal spends " + (100 * v.breath).toFixed(0) +
       "% of the section in a real rest — it is not breathing");
    ok(s.breath < 0.02 && b.breath < 0.02, "an instrumental lead breathes too (" +
       s.breath.toFixed(3) + " / " + b.breath.toFixed(3) + ") — the measurement is " +
       "counting articulation as phrasing, so it proves nothing about the singer");
    ok(v.leap < 0.35, (100 * v.leap).toFixed(0) + "% of the vocal's moves are " +
       "leaps wider than a third — that is an instrument, not a voice");
    ok(v.leap < s.leap * 0.75, "the vocal (" + v.leap.toFixed(3) + ") does not leap " +
       "measurably less than the solo (" + s.leap.toFixed(3) + ")");
    ok(v.mean < s.mean - 0.8, "the vocal's mean interval (" + v.mean.toFixed(2) +
       " semitones) is not narrower than the solo's (" + s.mean.toFixed(2) + ")");
    // ...and the breath is REAL SILENCE at the end of the bar, which is the one
    // thing maxHold and the `breathe` pipe exist to produce
    const g = GENRES.vocal, bs = 16 / g.rate;
    for (let s2 = 1; s2 <= 12; s2++) {
      const ev = K.render(C.compose("beatles", s2).slots[5], g, 4);
      for (let bar = 0; bar < 4; bar++) {
        const end = (bar + 1) * bs;
        ok(!ev.some(e => e.t < end && e.t + e.dur > end - 0.6 / g.rate),
           "vocal/" + s2 + ": bar " + bar + " sings straight through the bar line");
      }
    }
    // the singer's instrument is a VOICE and it sits where a voice sits: the
    // registry's own window for solo_vox is [50, 84] (instruments.js RANGES)
    const NI = require("../../nukernel/instruments.js");
    for (const gk of ["vocal", "backing"]) {
      const id = NI.instrOf(gk, 0), win = NI.RANGES[id];
      ok(!!win, gk + ": " + id + " has no declared range — it may not be a voice");
      const ns = K.render(C.compose("beatles", 3).slots[5], GENRES[gk], 4).map(e => e.n);
      const mean = ns.reduce((a, x) => a + x, 0) / ns.length;
      ok(mean >= win[0] && mean <= win[1], gk + ": sings at a mean of " +
         mean.toFixed(0) + ", outside " + id + "'s own window " + win.join(".."));
    }
  }
}

/* ------------------------------------------- 41. DRESSING THE RECORD
   Two measured complaints, both about the composer rather than the engine.

     "When you generate a song and there are global effects apply them globally
      not per module."  MEASURED: a composed song set NO master at all —
      `compose("beatles", 3)` handed back eleven boxes, zero effects on any of
      them and `master` unset, which the loader normalizes to null, which the
      graph reads as the stock chain. Every composed record in every genre
      landed on one mastering.

     "You have stopped adding elements from other genres into the randomly
      generated songs."  MEASURED: 10.7% of boxes carried a second genre, and
      ELEVEN genres never stacked at all — acid, newwave, vaporwave,
      eurythmics, trap, house, garage, dnb, disco, dub, techno. All eleven
      arrange on the DANCE plan, and the only two roles that could call for a
      layer were `chorus` and `solo`, which a dance plan does not have.

   The fences below are the numbers this stage defends, not aspirations: a
   third of boxes carry a guest, sectional effects are confined to the three
   roles that genuinely depart, and every song is mastered its family's way.

   THE HOUSE LAW APPLIES UNEVENLY HERE and it is worth being honest about
   where. The guest and the solo break are read off the RENDERED EVENT STREAM
   through the real ui/derive.js — a layer that renders nothing is exactly the
   failure this suite exists for. The master cannot be: it is a bus, and
   nothing at this tier makes a sample. So it is proved as far as it can be —
   through the real loader, and through fields.js's own resolveMaster into the
   engine numbers audio/graph.js builds from — and the audio-tier gate that
   hears it is a browser gate, named in the report. */
console.log("dressing the record — the master bus and the guest genre");
{
  const C = require("../../nukernel/compose.js");
  const NF = require("../../nukernel/fields.js");
  const NS = require("../../nukernel/song.js");
  // floor 20: (e) below goes looking for a solo break in composed "beatles"
  // songs at roughly even odds per seed — too few draws and "the arranger
  // has stopped writing them" is indistinguishable from "we didn't ask enough".
  const seeds = Array.from({ length: seedCount(40, 20) }, (_, i) => i + 1);
  const FAM = Object.fromEntries(FAMILIES.map(([f, ks]) => [f, ks]));

  // (a) EVERY COMPOSED SONG IS MASTERED — and it survives the loader, which is
  // the only door the composer gets. An unloadable master is a song the
  // composer can write and a person cannot open.
  {
    let keys = 0, songs = 0, seven = [];
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), m = song.master;
      songs++;
      ok(m && typeof m === "object", gk + "/" + s + ": composed a song with no master");
      if (!m) continue;
      ok(!NF.masterIsDefault(m), gk + "/" + s + ": the master is a second spelling " +
         "of absent — " + JSON.stringify(m));
      // in the registry's own order, so the saved file reads the way the desk
      // is laid out — and an unknown key could not survive this either
      ok(JSON.stringify(Object.keys(m)) ===
         JSON.stringify(NF.MASTER.map(f => f.key).filter(k => m[k] != null)),
         gk + "/" + s + ": master keys are not in MASTER's order");
      // THROUGH THE LOADER, UNCHANGED — which is the check that the VALUES are
      // legal too, and a stronger one than reading the tables here: the loader
      // filters unknown keys and rejects unknown values, so anything the
      // composer spelled wrong comes back quietly smaller (or not at all) and
      // this equality is what notices.
      //
      // A QUARTER OF THE SWEEP, and the reason is cost rather than confidence:
      // load() deep-validates every step of every slot and every field of
      // every box, which is a millisecond a song and two full seconds of this
      // suite. The ballots are small — ten seeds of fifty genres draws every
      // value in every table many times over — and every OTHER claim here runs
      // the full forty.
      if (s <= 10) {
        const r = NS.load(song);
        ok(r.ok, gk + "/" + s + ": the composed song does not load: " +
           JSON.stringify(r.errors && r.errors[0]));
        ok(r.ok && JSON.stringify(r.song.master) === JSON.stringify(m),
           gk + "/" + s + ": the loader changed the master to " +
           JSON.stringify(r.ok && r.song.master));
      }
      // ...and it is a DIFFERENT CHAIN, in engine numbers, not just a
      // different word: resolveMaster is what audio/graph.js builds from.
      const A = NF.resolveMaster(m), B = NF.resolveMaster(null);
      ok(JSON.stringify(A) !== JSON.stringify(B),
         gk + "/" + s + ": the master resolves to exactly the stock chain");
      const n = Object.keys(m).length;
      keys += n;
      if (n === NF.MASTER.length) seven.push(gk);
    }
    // RESTRAINT, as a distribution. Every knob turned on every record is not a
    // master, it is a preset demo — measured at 4.53 globals of seven when this
    // landed, and exactly one anchor asks for the whole desk.
    const mean = keys / songs;
    ok(mean > 3 && mean < 5.5, "the average composed master moves " + mean.toFixed(2) +
       " of " + NF.MASTER.length + " globals — a master is a few decisions, not a sweep");
    ok(new Set(seven).size <= 1 && (!seven.length || seven[0] === "shoegaze"),
       "more than one genre turns every knob on the desk: " +
       [...new Set(seven)].join(","));
  }

  // (b) FAMILY-APPROPRIATE, and each of these is a BALLOT WITH NO NULL IN IT
  // one tier down (compose.js MASTER_LEAN) — a promise the table makes and this
  // reads back off the composed songs. Tape and glue on a soul record, a room
  // on a choir, a ceiling on a club track: the producer's defaults, by tradition.
  {
    const must = {
      soul:   m => m.tape != null,
      roots:  m => m.tape != null,
      club:   m => m.ceiling != null && m.ceiling !== "open",
      drift:  m => m.space != null,
      vox:    m => m.space != null,
      groove: m => m.space != null,
      band:   m => m.drive != null,
      // a studio record is EDITED, not squashed
      studio: m => m.glue != null && m.glue !== "pump" && m.glue !== "squash",
      // and a lone part is not a record: nothing is being fought on the bus
      parts:  m => m.drive == null && m.ceiling !== "loud" && m.ceiling !== "louder",
    };
    const WHY = {
      soul: "tape", roots: "tape", club: "a ceiling that is not open",
      drift: "a room", vox: "a room", groove: "a room", band: "drive on the bus",
      studio: "glue that is not pumped", parts: "no bus fight at all",
    };
    for (const [fam, ks] of FAMILIES) {
      if (!must[fam]) continue;
      for (const gk of ks) for (const s of seeds.slice(0, 12)) {
        const m = C.compose(gk, s).master || {};
        ok(must[fam](m), gk + "/" + s + " (" + fam + "): a " + fam + " record wants " +
           WHY[fam] + " — got " + JSON.stringify(m));
      }
    }
    // THE HANDFUL WHOSE MASTER IS THE SOUND (compose.js MASTER_GENRE). Not a
    // lean: the anchor's own row, and if it stops winning the genre stops
    // sounding like itself.
    const OWN = {
      vaporwave: m => m.tape === "wow" || m.tape === "worn",
      dub:       m => m.space === "cavern" || m.space === "hall",
      sludge:    m => m.drive === "crush" || m.drive === "dirt",
      techno:    m => m.ceiling === "loud" || m.ceiling === "louder",
      shoegaze:  m => m.width === "huge" || m.width === "wide",
      gregorian: m => m.space === "cavern" || m.space === "hall",
    };
    for (const gk of Object.keys(OWN))
      for (const s of seeds.slice(0, 12))
        ok(OWN[gk](C.compose(gk, s).master || {}),
           gk + "/" + s + ": its own master row did not win — " +
           JSON.stringify(C.compose(gk, s).master));
    // ...AND STRUCTURALLY, not on the dice. `glue: "glue"` and `ceiling:
    // "open"` are the stock chain under their own names (fields.js
    // GLUEDFLT/CEILDFLT), so a row whose every ballot can draw a null or a
    // stock word has a draw that resolves to exactly no master at all — which
    // is the whole complaint, recurring at one in three thousand seeds where
    // no sweep would find it. Every row must carry one ballot that ALWAYS
    // moves something.
    {
      const STOCK = { glue: "glue", ceiling: "open" };
      const moves = row => Object.keys(row).some(k =>
        row[k].every(v => v != null && v !== STOCK[k]));
      for (const [fam, row] of Object.entries(C.MASTER_LEAN))
        ok(moves(row), fam + ": every one of its master ballots can draw a null or " +
           "the desk's own default — some seed of it resolves to no master at all");
      // the anchor rows are read ON TOP of a family row, so they may be as
      // partial as they like; what they may not be is misspelled
      for (const [gk, row] of Object.entries(C.MASTER_GENRE)) {
        ok(GENRES[gk], "MASTER_GENRE names " + gk + ", which is not a genre");
        for (const [k, ballot] of Object.entries(row)) {
          ok(NF.MASTERBY[k], gk + ": masters a global the registry lacks (" + k + ")");
          for (const v of ballot)
            ok(v == null || (NF.MASTERBY[k] &&
               Object.prototype.hasOwnProperty.call(NF.MASTERBY[k].table, v)),
               gk + "." + k + ": votes for " + v + ", which is not in the table");
        }
      }
    }
    // THE SHIPPED PRESETS ARE MASTERED TOO. Six hand-authored songs are the
    // first sound anybody hears, and a fix that dressed the generated records
    // and left the demos on the stock chain would have fixed the measurement
    // rather than the complaint.
    for (const p of require("../../nukernel/presets.js").PRESETS) {
      const m = p.data.master;
      ok(m && !NF.masterIsDefault(m), p.name + ": a shipped preset with no master");
      const r = NS.load(p.data);
      ok(r.ok && JSON.stringify(r.song.master) === JSON.stringify(m),
         p.name + ": the loader does not keep its master (" +
         JSON.stringify(r.ok ? r.song.master : r.errors[0]) + ")");
      ok(m && JSON.stringify(NF.resolveMaster(m)) !==
              JSON.stringify(NF.resolveMaster(null)),
         p.name + ": its master resolves to exactly the stock chain");
    }
    // SALTED, like every other ballot: one seed across the table must not
    // master fifty records the same way
    const at1 = new Set(GK.map(gk => JSON.stringify(C.compose(gk, 1).master)));
    // census floor (atLeast): >20 of 110 is the calibrated claim; a 21-genre
    // sample cannot clear an absolute floor sized for five times its own
    // population, so FAST only asks that the masters are not all one chain
    ok(atLeast(at1.size, 20), "only " + at1.size + " distinct masters across " + GK.length +
       " genres at one seed — the stream is not genre-salted");
    // and deterministic: a seed is a record, master included
    for (const gk of ["beatles", "techno", "dub"])
      ok(JSON.stringify(C.compose(gk, 9).master) === JSON.stringify(C.compose(gk, 9).master),
         gk + ": the master is not a function of (genre, seed)");
  }

  // (c) THE GUEST — the rate, the floor, the affinity and the restraint — and
  // (f) in the same pass, because both are census questions over every box of
  // every composed song and two sweeps of that is two sweeps.
  //
  // (f) SECTIONAL EFFECTS ARE SECTIONAL: the other half of "apply them
  // globally". Now that the bus is dressed, a per-box chain is reserved for the
  // section that genuinely departs — the bridge underwater, the breakdown, the
  // pedal under a solo — and nothing else in the plan gets one. Only the
  // DRESSED boxes are checked in detail; the legality of every chip on every
  // other box is what the loader in (a) already proved, twice per song.
  {
    const ZEROED = ["acid", "newwave", "vaporwave", "eurythmics", "trap", "house",
                    "garage", "dnb", "disco", "dub", "techno"];
    const SECTIONAL = new Set(["bridge", "breakdown", "solo"]);
    let boxes = 0, withGuest = 0, twoGuest = 0, threeGuest = 0, dressed = 0;
    const per = {}, distinct = [], twoRoles = new Set();
    // GK_FULL: ZEROED below names eleven specific genres by their old
    // regression, and "no genre at zero" is a coverage claim over the whole
    // catalog — seeds still runs at the fast count, so this stays cheap.
    for (const gk of GK_FULL) {
      const G = GENRES[gk], fam = G.family, ownFx = (G.fx || []).length;
      // WHO THIS HOST MAY CALL: the family's guest ballot plus its solo cast.
      // Anything else in a composed stack means a uniform draw crept back in,
      // which is how a techno track ended up with plainchant over it.
      const allowed = new Set([...(C.GUEST_LEAN[fam] || C.GUEST_LEAN.kernel),
                               ...(C.SOLO_LEAN[fam] || C.SOLO_LEAN.kernel)]);
      per[gk] = [0, 0];
      for (const s of seeds) {
        const song = C.compose(gk, s), names = new Set();
        for (const b of song.song) {
          boxes++; per[gk][1]++;
          // THE SINGER IS NOT A GUEST, and the census has to know it or every
          // number here stops meaning anything. A record's own voice is on the
          // payroll — it carries the verses and the choruses now (compose.js,
          // the through-line round) — so counting it as a visitor put the
          // "guest rate" at 54% and reported three-guest boxes that are a
          // band with a singer and one horn player. `as: "voice"` is how the
          // stack entry says which it is; the loader carries the key through.
          const gs = b.stack.slice(1).filter(e => e.as !== "voice");
          if (gs.length) { withGuest++; per[gk][0]++; }
          if (gs.length >= 2) { twoGuest++; twoRoles.add(b.role); }
          if (gs.length >= 3) threeGuest++;
          for (const e of gs) {
            names.add(e.g);
            // ON THE BALLOT and not the host itself. `allowed` is the family's
            // guest ballot plus its solo cast, and the ballots are held to
            // LAYERABLE structurally below — so this one check covers the
            // affinity law and the stackability law at once. Anything else in
            // a composed stack means a uniform draw crept back in, which is
            // how a techno track ended up with plainchant over it.
            ok(e.g !== gk && allowed.has(e.g), gk + "/" + s + ": stacked " + e.g +
               ", which is not on the " + fam + " ballot — the guest is being " +
               "drawn at random again");
            // and it must have something to play: an empty slot list on a
            // layer is a guest who was booked and never turned up
            ok(Array.isArray(e.slots) && e.slots.length,
               gk + "/" + s + ": " + e.g + " is stacked with nothing to play");
          }
          // ...and the box's own effects chain, where the section added to it
          if (b.fx.length > ownFx) {
            dressed++;
            ok(SECTIONAL.has(b.role), gk + "/" + s + ": a sectional effect landed " +
               "on a " + b.role + " — per-box fx are for the section that departs, " +
               "and everything global belongs on the master now");
            ok(b.fx.length <= NF.MAX_FX && new Set(b.fx).size === b.fx.length &&
               b.fx.every(k => NF.FX[k]),
               gk + "/" + s + ": a bad effects chain — " + JSON.stringify(b.fx));
          }
        }
        distinct.push(names.size);
      }
    }
    const fxShare = dressed / boxes;
    console.log("  sectional fx on " + (100 * fxShare).toFixed(1) + "% of boxes (" +
                dressed + "/" + boxes + "), three roles only");
    ok(fxShare > 0.04 && fxShare < 0.15, (100 * fxShare).toFixed(1) + "% of boxes carry " +
       "a sectional effect — reserved means a handful, and a handful means it happens");
    const rate = withGuest / boxes;
    console.log("  guest rate " + (100 * rate).toFixed(1) + "% of boxes (" +
                withGuest + "/" + boxes + "), " + twoGuest + " boxes with two");
    // THE BAND THIS STAGE DEFENDS: a third. Below a quarter and the complaint
    // is unfixed; above 40% and every other section has a stranger on it,
    // which is the mush the restraint rules exist to prevent.
    ok(rate >= 0.25 && rate <= 0.40, "the guest rate is " + (100 * rate).toFixed(1) +
       "% — outside the 25–40% band this stage defends");
    // NO GENRE AT ZERO, and the eleven that used to be are named so the
    // regression cannot come back quietly as "the average is fine"
    for (const gk of GK_FULL) {
      const [g, b] = per[gk];
      ok(g > 0, gk + ": never once hosts a guest");
      ok(g / b >= 0.15, gk + ": only " + (100 * g / b).toFixed(0) + "% of its boxes " +
         "carry a guest — every genre must be able to host one");
    }
    for (const gk of ZEROED)
      ok(per[gk][0] > 0, gk + ": still at zero — it was one of the eleven");
    // RESTRAINT. Never three, and two only where a chorus can carry it: the
    // singer plus the colour that arrives for the last one.
    ok(threeGuest === 0, threeGuest + " boxes stack three guests — that is mush");
    ok([...twoRoles].every(r2 => r2 === "chorus"),
       "two guests landed outside a chorus: " + [...twoRoles].join(","));
    // ...and a song has a CAST, not a shuffle: the guest comes back, which is
    // the whole musical point of drawing them once
    const mean = distinct.reduce((a, b) => a + b, 0) / distinct.length;
    ok(mean < 3.2, "a composed song calls on " + mean.toFixed(2) + " different " +
       "guest genres on average — that is a shuffle, not an arrangement");
    ok(Math.max(...distinct) <= 5, "one song called " + Math.max(...distinct) +
       " different guests");
    // THE BALLOTS THEMSELVES: every family votes, every vote is stackable, and
    // no vote carries a prog (§23h proves the same law on the composed output;
    // this catches a bad ballot entry that the dice have not reached yet)
    for (const [fam] of FAMILIES) {
      const b = C.GUEST_LEAN[fam];
      ok(Array.isArray(b) && b.length >= 2, fam + ": no usable GUEST_LEAN ballot");
      for (const w of b || []) {
        ok(C.LAYERABLE.includes(w), fam + ": votes for " + w + ", which is not stackable");
        ok(!GENRES[w].prog, fam + ": votes for " + w + ", which carries a prog");
      }
    }
  }

  // (d) THE GUEST IS AUDIBLE, on the real render path. A stacked genre that
  // contributes no events is a config change, and this suite exists because
  // three of those shipped green.
  {
    let checked = 0;
    for (const gk of GK) {
      for (const s of seeds.slice(0, 4)) {
        const song = C.compose(gk, s);
        for (const b of song.song) {
          if (b.stack.length < 2) continue;
          const ev = D.sectionEvents(b, song.slots).ev;
          const mine = ev.filter(e => e.layer);
          ok(mine.length > 0, gk + "/" + s + " (" + b.role + "): " +
             b.stack.slice(1).map(e => e.g).join("+") + " is stacked and plays nothing");
          // ...and it is a SECOND voice, not a replacement: the host is still
          // playing under it wherever the section did not deliberately strip
          // the authority (the solo break, which is the one place it does)
          if (b.stack[0].slots.length)
            ok(ev.some(e => !e.layer && e.kind === "line"),
               gk + "/" + s + " (" + b.role + "): the guest silenced the host");
          checked++;
          break;                                    // one box per song is enough
        }
      }
    }
    ok(atLeast(checked, 149), "only " + checked + " guested sections were rendered");
    // THE CAST IS TWO NAMES, and they are two: the peak's arrival is only an
    // arrival if it has not already been on the record.
    for (const gk of GK) for (const s of seeds.slice(0, 10)) {
      const c = C.guestCast(GENRES[gk], gk, C.rng(s * 7919 + 13));
      ok(c && c.a !== gk && c.b !== gk, gk + ": cast itself as its own guest");
      ok(c && c.a !== c.b, gk + ": drew the same guest twice — the peak brings " +
         "nobody new");
    }
  }

  // (e) THE BEATLES TEST IN A REAL COMPOSED SONG. §40 proves the mechanism on a
  // hand-built box; the ask was that the arranger actually writes one — "a
  // Beatles song where only the drums remain, but the solo plays" — so this
  // goes looking for it in compose("beatles", …) and renders what it finds.
  {
    let found = 0, proved = 0;
    for (const s of seeds) {
      const song = C.compose("beatles", s);
      for (const b of song.song) {
        if (b.cue !== "solobreak") continue;
        found++;
        const out = D.sectionEvents(b, song.slots), ev = out.ev;
        const hits = ev.filter(e => e.kind === "hit");
        const line = ev.filter(e => e.kind === "line");
        const bass = ev.filter(e => e.kind === "bass");
        ok(hits.length > 0, "beatles/" + s + ": the solo break has no drums");
        ok(bass.length === 0, "beatles/" + s + ": the bass plays under the break");
        ok(line.length > 0, "beatles/" + s + ": nobody takes the solo");
        ok(line.every(e => e.layer), "beatles/" + s + ": " +
           line.filter(e => !e.layer).length + " notes came from the host — it was " +
           "supposed to have stopped");
        // the drums are the HOST's kit, which is what makes it a Beatles song
        // with somebody else's solo over it rather than two records at once.
        // MEASURED EXCEPT THE LAST BAR, and that is a finding rather than a
        // convenience: a composed solo section carries an `outro` fill, and a
        // fill speaks a wider vocabulary than the genre's bar — beatles/1 ends
        // on a crash, which is a lane its kit does not otherwise own. §40's
        // hand-built box has no ending, which is why it can ask for all of them.
        const own = new Set(Object.keys(GENRES.beatles.kit));
        const bs = 16 / out.g.rate, body = (out.bars - 1) * bs;
        const inBody = hits.filter(e => e.t < body);
        ok(inBody.length > 0 && inBody.every(e => own.has(e.d)),
           "beatles/" + s + ": the drums under the break are not the host's kit (" +
           [...new Set(inBody.filter(e => !own.has(e.d)).map(e => e.d))].join(",") + ")");
        ok(new Set(inBody.map(e => e.d)).size > 1,
           "beatles/" + s + ": the break is one drum lane, not a kit");
        proved++;
        break;
      }
    }
    ok(found >= 8, "only " + found + " of " + seeds.length + " Beatles songs contain " +
       "a solo break — the arranger has stopped writing them");
    ok(proved === found, "a composed solo break did not render as one");
  }

}

/* ------------------------------------------- 42. THE SONGWRITER'S READ
   Five criticisms and one correction, from reading beatles/5, postrock/2 and
   citypop/4 as charts rather than as configuration. Every one of them is about
   the ARRANGER — the engine could already say all of this and was never asked
   to — and every one is measured here on the rendered stream through the real
   ui/derive.js, because "the composer wrote a stop" and "the section has a
   hole in it" are different claims and only the second one is music.

     (a) SECTION LENGTH WAS INVERTED across the table.
     (b) BREAK THE SYMMETRY — irregular lengths, and only where they belong.
     (c) DYNAMICS NEED A MEMORY — position, not just role.
     (d) THERE ARE NO STOPS.
     (e) THE VOCAL IS A GUEST AND SHOULD BE THE THROUGH-LINE.
     (f) THE INTRO NEVER QUOTES ANYTHING. */
console.log("the songwriter's read — lengths, irregularity, memory, stops, voice, quote");
{
  const C = require("../../nukernel/compose.js");
  const NF = require("../../nukernel/fields.js");
  const NS = require("../../nukernel/song.js");
  // floor 16 == n: this whole section's censuses run over FIXED genre lists
  // (8, then 4 named genres) sliced against `seeds`, so shrinking it further
  // only starves those slices — 16 was already the small end.
  const seeds = Array.from({ length: seedCount(16, 16) }, (_, i) => i + 1);
  const meanVel = ev => (ev.length
    ? ev.reduce((s, e) => s + (e.vel == null ? 5 : e.vel), 0) / ev.length : 0);
  const lvlOf = b => NF.LEVELS[b.lvl || "norm"];
  const median = xs => xs.slice().sort((a, b) => a - b)[xs.length >> 1];
  // THE COMPOSER'S OWN WORD FOR A SECTION, imported rather than re-derived.
  // `cue || role` is the wrong read for the three passes this section tests:
  // the head intro's cue carries its intro KIND and a solo break's carries
  // "solobreak", so the raw read made a bulgarian record's opening bar look
  // like a solo section — and a gate that re-derives a policy is a gate that
  // can agree with a bug.
  const word = C.sectionWord;

  // (a) HOW LONG A SECTION IS, per family — the correction that came with the
  // five. "Beatles gets 8-bar sections while citypop gets 2- and 4-bar ones,
  // but groove music needs LONGER to sit in the pocket and the pop song is the
  // one that can move fast." It was inverted because the section length WAS
  // the genre's form length (`G.bars`), which is a different question: a form
  // length is how long the pattern takes to come back, a section length is how
  // long you stay in it. citypop's form is 4 bars and its verse should not be.
  //
  // Measured in STEPS rather than bars, because a bar is not a duration: a
  // half-time genre's bar is twice as long, and comparing 8 bars of rock with
  // 8 bars of vaporwave compares two different amounts of time.
  {
    const by = {};
    for (const gk of GK) {
      const g = GENRES[gk], steps = C.fullLen(g) * 16 / g.rate;
      (by[g.family] = by[g.family] || []).push(steps);
      // and the section never stops the genre's own pattern half way through
      ok(C.fullLen(g) % g.bars === 0, gk + ": a section of " + C.fullLen(g) +
         " bars cuts its own " + g.bars + "-bar form off mid-phrase");
      ok(C.fullLen(g) >= g.bars && C.fullLen(g) <= NF.MAX_LEN,
         gk + ": section length " + C.fullLen(g) + " is not a usable window");
      ok(C.halfLen(g) >= 2 && C.halfLen(g) < C.fullLen(g),
         gk + ": the half-length roles are not shorter than a section");
    }
    // THE FENCE, and it is the correction stated as a number: the two families
    // whose music is a groove you settle into sit at twice the duration of the
    // families that write verses and choruses. 256 steps against 128, measured.
    const pop = Math.max(median(by.studio), median(by.soul), median(by.roots),
                         median(by.band));
    for (const fam of ["club", "groove"])
      ok(median(by[fam]) >= 2 * 128 && median(by[fam]) >= 1.5 * 128,
         fam + ": its median section is " + median(by[fam]) + " steps — groove " +
         "music needs longer than a pop verse to sit in the pocket");
    ok(median(by.studio) <= 128 && median(by.soul) <= 128,
       "the pop families are not the ones that move fast (" + median(by.studio) +
       " / " + median(by.soul) + " steps)");
    void pop;
    // ...and the anchors the read actually named
    ok(C.fullLen(GENRES.citypop) === 8 && C.fullLen(GENRES.beatles) === 8,
       "citypop and beatles do not arrange at the same section length (" +
       C.fullLen(GENRES.citypop) + " / " + C.fullLen(GENRES.beatles) + ")");
    ok(C.fullLen(GENRES.dub) === 16 && C.fullLen(GENRES.house) === 16,
       "the groove and floor anchors still arrange in four-bar sections");
    // AND IT REACHES THE RENDER: the box's window really is that many bars
    for (const gk of ["citypop", "house", "dub", "beatles", "blues", "vaporwave"]) {
      const song = C.compose(gk, 3);
      const v = song.song.find(b => b.role === "verse" && !b.cue && !b.bend);
      ok(!!v, gk + ": no plain verse to measure");
      if (v) {
        const r = D.sectionEvents(v, song.slots);
        // the window is the box's own length; since the sixteen-bar law
        // (2026-08-18) a long verse may have given the length back, so the
        // family answer is fullLen OR its half — never anything else
        ok(r.bars === v.len &&
           (v.len === C.fullLen(GENRES[gk]) || v.len === Math.max(2, Math.floor(C.fullLen(GENRES[gk]) / 2))),
           gk + ": the verse renders " + r.bars + " bars against len " + v.len);
      }
    }
  }

  // ---- ONE SWEEP, three censuses. (b), (c) and (e) are all questions about
  // every box of every composed song, and three sweeps of that is three sweeps.
  const CEN = { sec: 0, bent: 0, sqSec: 0, sqBent: 0, kinds: {}, stops: {},
                stopSec: 0, dupSongs: 0, songs: 0, steadyDup: 0, steadySongs: 0,
                chorus: 0, chorusVoice: 0, verse: 0, verseVoice: 0,
                soloLayers: 0, soloLoose: 0, twoVisits: 0, quotes: 0 };
  for (const gk of GK) {
    const G = GENRES[gk], singer = C.singerOf(G, gk), steady = !!C.STEADY[gk];
    for (const s of seeds) {
      const song = C.compose(gk, s), by = {};
      CEN.songs++; if (steady) CEN.steadySongs++;
      let visits = 0, lastStop = -9;
      song.song.forEach((b, i) => {
        if (C.BEDS[b.role]) return;
        const w = word(b);
        CEN.sec++;
        if (C.SQUARE[G.family]) { CEN.sqSec++; if (b.bend) CEN.sqBent++; }
        if (b.bend) { CEN.bent++; CEN.kinds[b.bend] = (CEN.kinds[b.bend] || 0) + 1; }
        if (b.stop) {
          CEN.stopSec++; CEN.stops[b.stop] = (CEN.stops[b.stop] || 0) + 1;
          ok(i - lastStop >= 2, gk + "/" + s + ": two stops in adjacent sections");
          lastStop = i;
        }
        (by[w] = by[w] || []).push(b.env);
        const voice = b.stack.filter(e => e.as === "voice");
        ok(voice.length <= 1, gk + "/" + s + ": two singers on one box");
        ok(voice.every(e => e.g === singer), gk + "/" + s + ": the voice layer is " +
           (voice[0] && voice[0].g) + ", not the record's singer " + singer);
        if (singer) {
          if (w === "chorus") { CEN.chorus++; if (voice.length) CEN.chorusVoice++; }
          if (w === "verse") { CEN.verse++; if (voice.length) CEN.verseVoice++; }
        }
        for (const e of b.stack.slice(1)) if (e.g === "solo") {
          CEN.soloLayers++;
          if (b.role === "solo") continue;
          if (w === "chorus") visits++; else CEN.soloLoose++;
        }
      });
      if (visits > 1) CEN.twoVisits++;
      // the stop kinds are never repeated inside one record
      const ks = song.song.filter(b => b.stop).map(b => b.stop);
      ok(new Set(ks).size === ks.length, gk + "/" + s + ": the same stop twice");
      // and no two sections of one role carry the same dynamic
      let dup = false;
      for (const v of Object.values(by)) if (new Set(v).size !== v.length) dup = true;
      if (dup) { CEN.dupSongs++; if (steady) CEN.steadyDup++; }
      if (!steady)
        ok(!dup, gk + "/" + s + ": two sections of one role carry the same dynamic — " +
           JSON.stringify(by));
      if (song.song[0].cue === "quote") CEN.quotes++;
    }
  }

  // (b) BREAK THE SYMMETRY. "Real pop breaks its own clock: the truncated
  // verse, the extra 2-bar turnaround, the chorus that arrives a bar early."
  //
  // THE DISTRIBUTION THIS DEFENDS, and it is not a uniform dice roll on the
  // length field — it is four named gestures at four named positions
  // (compose.js BENDS), so an irregular section is always irregular ABOUT
  // something: `early` takes a bar off the lift so the chorus lands before you
  // counted it, `short` cuts two bars off a later verse, `turn` adds the
  // two-bar turnaround into a verse, `long` runs the last chorus out. Measured
  // at ~16% of the non-bed sections of a breakable genre, which is one or two
  // a record — an event rather than a tic — and exactly 0% of the square ones.
  {
    const breakable = CEN.sec - CEN.sqSec;
    const rate = CEN.bent / breakable;
    console.log("  irregular lengths on " + (100 * rate).toFixed(1) + "% of breakable " +
                "sections (" + CEN.bent + "/" + breakable + "), " + CEN.sqBent +
                " on square ones; " + JSON.stringify(CEN.kinds));
    ok(rate >= 0.08 && rate <= 0.25, (100 * rate).toFixed(1) + "% of breakable " +
       "sections are irregular — outside the 8–25% band this stage defends");
    ok(CEN.sqBent === 0, CEN.sqBent + " irregular sections in a family whose " +
       "arithmetic is load-bearing — a fugue keeps its arithmetic");
    for (const k of Object.keys(C.BENDS))
      ok(atLeast(CEN.kinds[k] || 0, 20), "the \"" + k + "\" gesture fired " +
         (CEN.kinds[k] || 0) + " times — a vocabulary entry the dice never reach");
    // ...and every square FAMILY is really represented, so the zero above is a
    // fact about restraint rather than about an empty set
    ok(atLeast(CEN.sqSec, 3000), "only " + CEN.sqSec + " square sections in the sweep — " +
       "the zero proves nothing");
    // AND IT REACHES THE RENDER. A length that does not move the window is a
    // number in a file: the bent box must render exactly its own bars, and the
    // same box unbent must render a different number of them.
    let proved = 0;
    for (const gk of GK) {
      if (C.SQUARE[GENRES[gk].family]) continue;
      for (const s of [3, 9]) {
        const song = C.compose(gk, s);
        for (const b of song.song) {
          if (!b.bend) continue;
          const on = D.sectionEvents(b, song.slots);
          const off = D.sectionEvents({ ...b, len: b.len - C.BENDS[b.bend] }, song.slots);
          ok(on.bars === b.len && on.bars !== off.bars,
             gk + "/" + s + ": the \"" + b.bend + "\" bend does not move the window");
          // the square length it departed from is a whole number of forms; the
          // bent one is a bar early or two bars long, which is the point
          ok(off.bars % GENRES[gk].bars === 0 || off.bars === C.halfLen(GENRES[gk]),
             gk + "/" + s + ": the unbent length was not square to begin with");
          proved++;
          break;
        }
      }
    }
    ok(atLeast(proved, 20), "only " + proved + " bent sections were rendered");
  }

  // (c) DYNAMICS NEED A MEMORY. "The second verse is bigger than the first
  // because the band has walked in; the last chorus is the biggest thing in
  // the record; a bridge can be the quietest. No two sections of the same role
  // in one song should carry the same dynamic unless the song is deliberately
  // flat." The per-song distinctness is asserted in the sweep above, box by
  // box; what is left is the exemption and the sound.
  {
    console.log("  " + CEN.dupSongs + "/" + CEN.songs + " songs repeat a same-role " +
                "dynamic, all of them deliberately flat (" + CEN.steadyDup + "/" +
                CEN.steadySongs + " STEADY songs do)");
    // THE EXEMPTION IS LIVE, which is the half of a carve-out that usually is
    // not checked: `drone` and `ambient` are one idea held for a record, they
    // are handed the bare role constants, and they really do repeat. If they
    // stopped, the branch above would be silently covering nothing.
    ok(CEN.dupSongs === CEN.steadyDup && atLeast(CEN.steadyDup, 10),
       "the flat-song exemption covers " + CEN.steadyDup + " songs of " +
       CEN.dupSongs + " that repeat — it is either dead or leaking");
    ok(Object.keys(C.STEADY).length <= 3,
       "the deliberately-flat list has grown into an excuse: " +
       Object.keys(C.STEADY).join(","));
    // THE ARC IS MONOTONE WHERE IT PROMISES TO BE: the ladder walks a role
    // group from the back, so the LAST member keeps what it was dealt and the
    // earlier ones step down (compose.js DYNLADDER, ordered by the mean of the
    // curve each word compiles to).
    {
      const meanOf = k => { let s = 0; for (let i = 0; i <= 20; i++) s += K.SHAPES[k](i / 20);
                            return s / 21; };
      // NON-DECREASING, not strictly increasing, and the one flat step is the
      // interesting one: `dim` and `cresc` both average 0.810 — the same
      // loudness travelled in opposite directions. They are two different
      // things to hear and the same thing to measure, so they sit adjacent and
      // the ends are what carry the strict claim.
      for (let i = 1; i < C.DYNLADDER.length; i++)
        ok(meanOf(C.DYNLADDER[i]) >= meanOf(C.DYNLADDER[i - 1]),
           "DYNLADDER is not ordered by size: " + C.DYNLADDER[i - 1] + " (" +
           meanOf(C.DYNLADDER[i - 1]).toFixed(3) + ") > " + C.DYNLADDER[i]);
      ok(meanOf(C.DYNLADDER[C.DYNLADDER.length - 1]) > meanOf(C.DYNLADDER[0]) + 0.3,
         "the top and bottom of the dynamics ladder are the same size");
    }
    // AND IT IS AUDIBLE: verse 2 outweighs verse 1 on the real render path, in
    // the genres that have two verses and a band to walk in with. Measured at
    // 94/96 when this landed — the two misses are seeds where the first verse
    // drew a denser deal, which is an arrangement rather than a bug.
    let up = 0, n2 = 0;
    for (const gk of ["rock", "beatles", "funk", "motown", "citypop", "gospel",
                      "countrypop", "steely"])
      for (const s of seeds.slice(0, 12)) {
        const song = C.compose(gk, s);
        const vs = song.song.filter(b => b.role === "verse" && !b.cue);
        if (vs.length < 2) continue;
        n2++;
        const at = b => meanVel(D.sectionEvents(b, song.slots).ev) * lvlOf(b);
        if (at(vs[1]) > at(vs[0])) up++;
      }
    ok(n2 > 80 && up / n2 >= 0.9, "the second verse is bigger than the first in only " +
       up + "/" + n2 + " songs — the arc has no memory of where it is");
    // ...and the BRIDGE is allowed to be the quietest thing on the record,
    // which the old table (bridge 0.45, verse 0.50, no ramp) could not express
    {
      let quieter = 0, n3 = 0;
      for (const gk of ["rock", "beatles", "steely", "toto"])
        for (const s of seeds.slice(0, 10)) {
          const song = C.compose(gk, s);
          const br = song.song.find(b => b.role === "bridge");
          const vs = song.song.filter(b => b.role === "verse" && !b.cue);
          if (!br || !vs.length) continue;
          n3++;
          const at = b => meanVel(D.sectionEvents(b, song.slots).ev) * lvlOf(b);
          if (at(br) < Math.max(...vs.map(at))) quieter++;
        }
      ok(n3 > 30 && quieter / n3 >= 0.6, "the bridge is quieter than the loudest " +
         "verse in only " + quieter + "/" + n3 + " songs");
    }
  }

  // (d) THERE ARE NO STOPS. There are now, and each of the five is REUSED from
  // a table that already had it — `drop` is the envelope that silences the last
  // eighth of a section, cut/break/tail/hush are four of the ten outro edges.
  // Nothing was added to the kernel; what was missing was an arranger with an
  // opinion about where a hole goes (compose.js placeStops).
  //
  // EVERY CLAIM BELOW IS THE HOLE ITSELF, on the rendered stream. That matters
  // more here than anywhere else in this file, because four of the five kinds
  // were already reachable as ordinary end-of-section fills — the regression
  // this guards is not "the word is missing", it is "the word is there and the
  // bar is full".
  {
    console.log("  stops on " + (100 * CEN.stopSec / CEN.sec).toFixed(1) + "% of " +
                "sections (" + CEN.stopSec + "/" + CEN.sec + "), " +
                JSON.stringify(CEN.stops));
    const rate = CEN.stopSec / CEN.sec;
    ok(rate >= 0.08 && rate <= 0.22, (100 * rate).toFixed(1) + "% of sections stop — " +
       "outside the 8–22% band: below it the record has no holes in it, above it " +
       "a hole is the texture rather than the moment");
    for (const k of Object.keys(C.STOPS))
      ok(atLeast(CEN.stops[k] || 0, 40), "the \"" + k + "\" stop fired " +
         (CEN.stops[k] || 0) + " times — the arranger never reaches it");
    // WHERE THEY LAND. The policy says: before the peak, at the end of a
    // bridge, or once more on a verse/chorus/solo — and never on a bed, an
    // intro, the outro or the peak itself, because a record's own ending is
    // not a stop, it is the end.
    let beforePeak = 0, bridges = 0, songsWithStop = 0;
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s);
      let peak = -1;
      song.song.forEach((b, i) => { const w = word(b);
        if (w === "chorus" || w === "drop") peak = i; });
      let any = false;
      song.song.forEach((b, i) => {
        if (!b.stop) return;
        any = true;
        const w = word(b);
        ok(!C.BEDS[b.role] && w !== "intro" && w !== "outro" && i !== peak,
           gk + "/" + s + ": a stop landed on the " + w + " — the record's own " +
           "ending is not a stop");
        ok(i === peak - 1 || w === "bridge" || w === "verse" || w === "chorus" ||
           w === "solo", gk + "/" + s + ": a stop landed on a " + w +
           ", which is not a place the policy puts one");
        if (i === peak - 1) beforePeak++;
        else if (w === "bridge") bridges++;
      });
      if (any) songsWithStop++;
    }
    ok(atLeast(beforePeak, 300), "only " + beforePeak + " records put a hole before the " +
       "last chorus — that is the one the brief names");
    ok(atLeast(bridges, 60), "only " + bridges + " bridges stop at the end");
    ok(songsWithStop / CEN.songs >= 0.6, "only " +
       Math.round(100 * songsWithStop / CEN.songs) + "% of records have a stop in " +
       "them at all");
    // ...AND EACH KIND IS THE HOLE IT CLAIMS TO BE. One rendered assertion per
    // kind, written as what is MISSING from the last bar (or the last eighth),
    // plus the differential — the same box without the stop puts the events
    // back. `cut` gets a tolerance of a sixteenth because groove() runs last
    // and nudges the surviving events in time.
    const proved = {};
    for (const gk of GK) for (const s of seeds.slice(0, 10)) {
      const song = C.compose(gk, s);
      for (const b of song.song) {
        if (!b.stop || proved[b.stop] > 12) continue;
        proved[b.stop] = (proved[b.stop] || 0) + 1;
        const r = D.sectionEvents(b, song.slots), bs = 16 / r.g.rate, span = r.bars * bs;
        const last = r.ev.filter(e => e.t >= span - bs);
        const at = gk + "/" + s + " (" + b.stop + " on " + word(b) + "): ";
        if (b.stop === "drop") {
          // the hole is the section's last eighth AND AT MOST ITS LAST BAR: a
          // hole is measured in bars, so a sixteen-bar section drops for one of
          // them and not for two (kernel.js envelope says why)
          const hole = span - Math.min(span / 8, bs);
          ok(!r.ev.some(e => e.t >= hole), at + "the hole before the drop is not " +
             "silent — " + r.ev.filter(e => e.t >= hole).length + " events in it");
          ok(r.ev.some(e => e.t >= span - bs && e.t < hole) || span / 8 >= bs,
             at + "the drop silenced more than the last bar");
        } else if (b.stop === "cut")
          ok(!r.ev.some(e => e.t > span - bs / 4 + bs / 16),
             at + "the band did not stop before the bar line");
        else if (b.stop === "hush") {
          // A HUSH THINS AND FALLS; it does not empty. The hole is the bar's
          // second HALF — two beats of air is plenty of room to notice — with
          // one cymbal on the last sixteenth, and the first half plays the
          // section's own material getting quieter into it. It used to delete
          // the whole bar, which by ear is not a hush, it is the transport
          // dropping out: thirty-four events, then one, then thirty.
          const hole = last.filter(e => e.t < span - bs / 16 && e.t >= span - bs / 2);
          ok(!hole.length, at + "the hole before the cymbal has " + hole.length +
             " events in it");
          const cym = last.filter(e => e.t >= span - bs / 16);
          ok(cym.length === 1 && cym[0].kind === "hit",
             at + "the hush does not land one cymbal on the last sixteenth");
          const fell = last.filter(e => e.t < span - bs / 2);
          ok(fell.length > 1, at + "the hush emptied the bar instead of thinning it");
        } else if (b.stop === "tail")
          ok(!last.some(e => e.kind === "hit"),
             at + "the drums are still playing the last bar");
        else if (b.stop === "break")
          ok(last.length > 0 && !last.some(e => e.kind !== "hit"),
             at + "the band did not drop out under the drums");
        // the differential: without the stop there is more music in the bar
        const off = D.sectionEvents(b.stop === "drop" ? { ...b, env: "big" }
                                                      : { ...b, outro: null }, song.slots);
        ok(off.ev.length >= r.ev.length, at + "removing the stop removed events");
      }
    }
    for (const k of Object.keys(C.STOPS))
      ok(proved[k] > 5, "the \"" + k + "\" stop was never rendered (" +
         (proved[k] || 0) + ")");
    // THE KITLESS BALLOT IS THE TWO THAT ARE ABOUT THE BAND. `break` and `tail`
    // are defined by what the drums do, so on a choir they are silent no-ops —
    // the same argument OUTRO_NOKIT already makes for the fills.
    for (const k of [...C.STOP_NOKIT.peak, ...C.STOP_NOKIT.bridge,
                     ...C.STOP_NOKIT.loose])
      ok(k === "drop" || k === "cut", "a kitless genre may stop with \"" + k +
         "\", which is a fact about drums it does not have");
    for (const gk of GK) {
      if (Object.keys(GENRES[gk].kit || {}).length) continue;
      for (const s of seeds.slice(0, 6))
        for (const b of C.compose(gk, s).song)
          ok(!b.stop || b.stop === "drop" || b.stop === "cut",
             gk + "/" + s + ": a kitless genre stopped with \"" + b.stop + "\"");
    }
  }

  // (d2) AN EDGE IS A GESTURE, NOT A GAP — the same claim as (d) read from the
  // other side. (d) proves the holes the arranger MEANT are there; this proves
  // the ones it did not mean are not, and it is the check that would have
  // caught the complaint that prompted it: "often halfway through a section the
  // whole tone of the song just changes and there's a pause."
  //
  // Nobody wrote that pause. It was three defensible gestures stacking — a drop
  // opening on a bare cymbal, a section ending by hushing to nothing, a
  // breakdown fading up from silence — dealt often enough on a ten-box record
  // that one landed every few sections. So the gate is a CENSUS over the whole
  // song rather than an assertion about any one gesture: walk the bar list the
  // transport actually schedules and count the bars that are near-empty
  // BETWEEN TWO FULL ONES, which is the only arrangement in which a thin bar
  // reads as the machine stopping. A thin bar after a thin bar is a breakdown;
  // a thin bar at the end of the record is an ending.
  //
  // Measured before the repair: 541 such bars across 110 genres × 4 seeds, in
  // four families — 192 hushes, 150 hits, 145 fades from silence, 64 drops.
  // After: 102, of which 87 are the composed `drop` STOP, which is the one hole
  // that is the whole point (at most one to a record, at most one bar wide, and
  // never beside another edge). The budget below is written against that.
  {
    const census = { bars: 0, gaps: [], byStop: 0 };
    for (const gk of GK) for (const s of seeds.slice(0, 4)) {
      const song = C.compose(gk, s);
      const bars = D.songBars(song.song, song.slots, song.groove, song.swing);
      if (!bars.length) continue;
      census.bars += bars.length;
      const last = bars[bars.length - 1].si;
      // AUDIBLE, not present: a fade to zero leaves every event in the stream
      // at velocity 0, which is exactly the bar nobody can hear.
      const aud = bars.map(b => b.ev.filter(e => (e.vel == null ? 5 : e.vel) > 0).length);
      for (let i = 1; i + 1 < bars.length; i++) {
        if (bars[i].si === last) continue;         // the record is allowed to leave
        if (Math.min(aud[i - 1], aud[i + 1]) < 8 || aud[i] > 4) continue;
        const sec = song.song[bars[i].si];
        if (sec.stop) { census.byStop++; continue; }
        census.gaps.push(gk + "/" + s + " bar " + i + " (" + sec.role + ", intro " +
          sec.intro + " / outro " + sec.outro + " / env " + sec.env + "): " +
          aud[i - 1] + " → " + aud[i] + " → " + aud[i + 1] + " events");
      }
    }
    console.log("  " + census.gaps.length + " unmeant gap bars and " + census.byStop +
                " composed stops in " + census.bars + " bars");
    ok(census.gaps.length <= 20, census.gaps.length + " near-empty bars sit between " +
       "two full ones without a stop being written there — an edge is a gesture, " +
       "not a gap. First five:\n    " + census.gaps.slice(0, 5).join("\n    "));
    // ...AND NO TWO EDGES BACK TO BACK, which is the arranger half of the same
    // law (compose.js easeEdges): however many edges a record deals, an ending
    // gesture and the next section's opening gesture never share a bar line.
    let stacked = 0;
    for (const gk of GK) for (const s of seeds.slice(0, 6)) {
      const song = C.compose(gk, s).song;
      for (let i = 1; i < song.length; i++)
        if (C.THIN_IN[song[i].intro] &&
            (C.THIN_OUT[song[i - 1].outro] || song[i - 1].env === "drop" ||
             song[i - 1].env === "stutter")) stacked++;
    }
    ok(!stacked, stacked + " seams stack a thinning ending against a thinning " +
       "opening — two edges landed back to back");
    // ...and a fade from SILENCE only where the record itself starts or stops.
    let mid = 0;
    for (const gk of GK) for (const s of seeds.slice(0, 6)) {
      const song = C.compose(gk, s).song;
      const head = song.findIndex(b => !C.BEDS[b.role] && b.role !== "intro");
      let tail = song.length;
      while (tail > 0 && song[tail - 1].role === "outro") tail--;
      for (let i = head < 0 ? song.length : head; i < tail; i++)
        if (song[i].env === "in" || song[i].env === "out") mid++;
    }
    ok(!mid, mid + " interior sections fade from or to silence — a fade is a " +
       "thing a record does at its ends");
  }

  // (e) THE VOCAL IS A GUEST, AND IT SHOULD BE THE THROUGH-LINE. Measured on
  // beatles/5 before this: the `vocal` layer appeared on the BRIDGE only while
  // every chorus carried a `solo`. Backwards, and structurally so — there was
  // no such thing as the record's singer, only a per-section coin over a ballot
  // that also held the lead guitarist.
  {
    console.log("  the voice carries " + CEN.chorusVoice + "/" + CEN.chorus +
                " choruses and " + CEN.verseVoice + "/" + CEN.verse + " verses; " +
                CEN.soloLayers + " solo layers, " + CEN.soloLoose + " outside a " +
                "solo section");
    ok(atLeast(CEN.chorus, 800) && CEN.chorusVoice === CEN.chorus,
       "the singer misses " + (CEN.chorus - CEN.chorusVoice) + " choruses of " +
       CEN.chorus + " — a chorus is the thing the singer is for");
    ok(atLeast(CEN.verse, 800) && (!SWEEP || CEN.verseVoice / CEN.verse >= 0.75),
       "the singer carries only " + Math.round(100 * CEN.verseVoice / CEN.verse) +
       "% of verses — the voice is meant to be the through-line, not a visitor");
    // THE SOLO IS WHAT VISITS: one section, maybe one chorus, and nowhere else.
    ok(CEN.soloLoose === 0, CEN.soloLoose + " solo layers landed outside a solo " +
       "section and outside the one chorus the soloist visits");
    ok(CEN.twoVisits === 0, CEN.twoVisits + " records let the soloist visit two " +
       "choruses — \"one section, maybe a chorus\"");
    ok(atLeast(CEN.soloLayers, 200), "only " + CEN.soloLayers + " solo layers in the sweep — " +
       "confined should not mean absent");
    // WHO SINGS is a decision, and both override tables are live: the anchors
    // inside a singing family that have no topline, and the one filed with the
    // drones that is a genre of songs.
    for (const gk of Object.keys(C.INSTRUMENTAL))
      ok(GENRES[gk] && !C.singerOf(GENRES[gk], gk), gk + ": declared instrumental " +
         "and given a singer anyway");
    ok(C.singerOf(GENRES.shoegaze, "shoegaze") === "vocal",
       "shoegaze is a genre of songs and lost its singer to its family row");
    ok(!C.singerOf(GENRES.drone, "drone") && !C.singerOf(GENRES.vocal, "vocal"),
       "a drone or a lone voice booked itself a singer");
    // THE VOICE IS ON THE RECORD, in events: the layer renders, it is the
    // topline material, and the host is still playing under it.
    let heard = 0;
    for (const gk of ["beatles", "rock", "motown", "citypop", "gospel", "house"])
      for (const s of seeds.slice(0, 6)) {
        const song = C.compose(gk, s);
        for (const b of song.song) {
          const v = b.stack.find(e => e.as === "voice");
          if (!v || word(b) !== "chorus" && word(b) !== "drop") continue;
          const ev = D.sectionEvents(b, song.slots).ev;
          const mine = ev.filter(e => e.layer === v.g && e.kind === "line");
          ok(mine.length > 0, gk + "/" + s + ": the singer is on the box and not " +
             "in the render");
          ok(ev.some(e => !e.layer && e.kind !== "hit"),
             gk + "/" + s + ": the singer silenced the band");
          heard++;
          break;
        }
      }
    ok(atLeast(heard, 29), "only " + heard + " sung sections were rendered");
    // AND IT IS ONE TUNE. "The same topline, developing" — slot 8 is written
    // from slot 5's own first half (compose.js phrase(), the `head` argument),
    // so the verse opens with the chorus's melody note for note and then
    // answers it differently. Read off the rendered stream with the player
    // taken out, because this is a fact about what was WRITTEN.
    {
      const g = plain(GENRES.simple), bs = 16 / g.rate;
      let same = 0, diff = 0;
      for (const s of seeds) {
        const song = C.compose("beatles", s);
        const sig2 = (i, lo, hi) => JSON.stringify(
          K.render(song.slots[i], g, 1)
            .filter(e => e.t >= lo && e.t < hi)
            .map(e => [+e.t.toFixed(4), e.n, e.vel]));
        // the first half bar is the same tune
        if (sig2(5, 0, bs / 2) === sig2(8, 0, bs / 2)) same++;
        // ...and the second half is not, or it is not a development, it is a copy
        if (sig2(5, bs / 2, bs) !== sig2(8, bs / 2, bs)) diff++;
        ok(sig2(5, 0, bs / 2).length > 4,
           "beatles/" + s + ": the topline renders nothing to develop");
      }
      ok(same === seeds.length, "the verse line opens with the chorus topline in " +
         "only " + same + "/" + seeds.length + " songs — it is a second tune, not " +
         "a development");
      ok(diff >= seeds.length - 1, "the verse line and the chorus topline are the " +
         "same phrase in " + (seeds.length - diff) + " songs — that is a repeat, " +
         "not a development");
    }
  }

  // ---- AND ALL THREE NEW KEYS SURVIVE THE ONE DOOR. `bend`, `stop` and the
  // stack entry's `as` are CARRIED keys, not registry fields — the same trick
  // `cue` has always played: the loader validates what the registry knows and
  // passes the rest through untouched. That is only true as long as nobody
  // adds a strip, and a composer whose arrangement notes are quietly eaten on
  // save writes songs that read differently the second time they are opened.
  {
    let carried = 0;
    for (const gk of GK) for (const s of seeds.slice(0, 4)) {
      const song = C.compose(gk, s), r = NS.load(JSON.parse(JSON.stringify(song)));
      ok(r.ok, gk + "/" + s + ": a composed song does not load: " +
         JSON.stringify(r.errors && r.errors[0]));
      if (!r.ok) continue;
      ok(r.song.slots.length === song.slots.length,
         gk + "/" + s + ": the loader resized the phrase bank");
      song.song.forEach((b, i) => {
        const q = r.song.song[i];
        ok(q.len === b.len, gk + "/" + s + ": the loader clamped a bent length " +
           b.len + " to " + q.len);
        ok(q.bend === b.bend && q.stop === b.stop && q.cue === b.cue,
           gk + "/" + s + ": the loader ate the arrangement notes on box " + i);
        ok(JSON.stringify(q.stack.map(e => e.as || null)) ===
           JSON.stringify(b.stack.map(e => e.as || null)),
           gk + "/" + s + ": the loader ate the singer's badge on box " + i);
        if (b.bend || b.stop) carried++;
      });
    }
    ok(atLeast(carried, 100), "only " + carried + " bent-or-stopped boxes went through the " +
       "loader — the round trip proves nothing");
  }

  // (f) THE INTRO NEVER QUOTES ANYTHING. "The classic pop intro is the chorus
  // hook stated instrumentally — Day Tripper, A Hard Day's Night. It must be
  // the SAME material the chorus later sings, or it is not a quote."
  {
    ok(atLeast(CEN.quotes, 40), "only " + CEN.quotes + " records open by quoting the hook");
    // the three families that cannot mean it do not vote for it: a choir does
    // not state its own chorus on an instrument, a drift record has no hook,
    // and a lone part has no chorus to quote FROM
    for (const fam of ["vox", "drift", "parts"])
      ok(!C.INTRO_LEAN[fam].includes("quote"),
         fam + ": votes to quote a hook it does not have");
    ok(["band", "studio", "soul", "roots", "groove", "kernel"]
        .every(f => C.INTRO_LEAN[f].includes("quote")),
       "a song-writing family cannot open on its own hook");
    let n2 = 0, shared = 0, control = 0;
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), head = song.song[0];
      if (head.cue !== "quote") continue;
      n2++;
      // STRUCTURAL: the intro STATES slot 5 — it is dealt first, so it is the
      // material voice 0 plays — and slot 5 is what the record later sings, the
      // chorus's own topline, which is the only place in this composer that
      // slot ever goes.
      //
      // This used to read `slots === "[5]"`, and pinning the ONE-slot deal is
      // what let the defect in §51(b) live here: a box hands each phrase to
      // every voice v ≡ pi (mod nP), so one slot is not one voice, it is the
      // same rendered phrase on all of them — the hook and its own octave, with
      // the composer having already taken the drums and the bass off. "Alone"
      // has to be a statement about the MATERIAL, so it is written that way:
      // the topline leads the deal, and what is beside it may only be `sparse`
      // (two notes a bar, its own walk) — never a second real part.
      ok(head.stack.length === 1 && head.stack[0].slots[0] === 5 &&
         head.stack[0].slots.slice(1).every(i => i === 6),
         gk + "/" + s + ": a quote intro is not stating the topline alone " +
         "(slots " + JSON.stringify(head.stack[0].slots) + ")");
      const later = song.song.slice(1).find(b =>
        b.stack.some(e => e.slots.includes(5)));
      ok(!!later, gk + "/" + s + ": the intro quotes a hook the record never states");
      if (!later) continue;
      // RENDERED, and this is the assertion that makes it a quote rather than a
      // coincidence of indices: PERTURB THE MATERIAL. Move slot 5's degrees and
      // BOTH streams must move — the intro's and the chorus's — because they
      // are reading the same phrase. Then the control: moving slot 0 (the hook,
      // which the intro is NOT playing) must leave the intro alone. Two
      // sensitivity checks in opposite directions, which is the form this suite
      // uses everywhere a value has to be shown reaching the output.
      const line = (b, sl) => JSON.stringify(D.sectionEvents(b, sl).ev
        .filter(e => e.kind === "line").map(e => [+e.t.toFixed(4), e.n]));
      const bump = i => {
        const sl = song.slots.map(p => clone(p));
        sl[i].deg = sl[i].deg.map(d => d + 2);
        return sl;
      };
      const up5 = bump(5), up0 = bump(0);
      const i0 = line(head, song.slots), c0 = line(later, song.slots);
      ok(i0.length > 4, gk + "/" + s + ": the quote renders no notes");
      ok(line(head, up5) !== i0, gk + "/" + s + ": moving the topline did not move " +
         "the quote — the intro is not playing it");
      if (line(later, up5) !== c0) shared++;
      if (line(head, up0) === i0) control++;
    }
    ok(atLeast(n2, 40), "only " + n2 + " quote intros were rendered");
    // THE CHORUS SIDE IS NOT 100%, and the exception is the same one §1 carries
    // for vaporwave: a genre whose voice 0 realizes as a PAD reads chord tones
    // and by construction cannot hear a degree vector, so a chorus that deals
    // the topline to a wash renders a quote of it that no perturbation of the
    // phrase can move. Measured at one record in fifty-nine; the intro side,
    // asserted above, is exact.
    ok(shared >= n2 - Math.ceil(n2 * 0.05),
       "the intro and the chorus read the same phrase in only " +
       shared + "/" + n2 + " records — one of them is quoting something else");
    ok(control === n2, "the quote intro moved when the HOOK moved in " +
       (n2 - control) + " records — it is not playing the topline");
    // ...and the pitch content really does land inside the chorus's, most of
    // the time. NOT always, and the exceptions are honest rather than
    // tolerated: a genre whose harmony is `emergent` derives its chords from
    // whichever phrase the section's authority leads with, so the intro's tune
    // and the chorus's tune are voiced over two different sets of chords; and
    // the peak chorus sometimes takes the truck-driver key. Measured at 91%.
    let inside = 0, m = 0;
    const pcs = ev => new Set(ev.filter(e => e.kind === "line" && e.n != null)
      .map(e => ((e.n % 12) + 12) % 12));
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), head = song.song[0];
      if (head.cue !== "quote") continue;
      const later = song.song.slice(1).find(b => b.stack.some(e => e.slots.includes(5)));
      if (!later) continue;
      m++;
      const a = pcs(D.sectionEvents(head, song.slots).ev);
      const b2 = pcs(D.sectionEvents(later, song.slots).ev);
      if (a.size && [...a].every(p => b2.has(p))) inside++;
    }
    ok(atLeast(m, 40) && (!SWEEP || inside / m >= 0.8),
       "the quote's pitch content sits inside the " +
       "chorus's in only " + inside + "/" + m + " records");
  }
}

/* (43 WAS THE SINGER, and the singer is gone — 2026-08-17. It held the pure
   half of nukernel/sing.js: the syllable split, the word banks, the note
   selection, the harmony intervals and the measured espeak rungs. The organ
   was removed whole because engine/speech.js builds a fresh Emscripten heap
   per utterance — its determinism law — and a song asking for 127 syllables
   took Safari out of memory mid-bar. §74's one-line tombstone below says what
   is left to check, which is that nothing here sings at all.) */

/* ---------------------------------------------------------------- 44. THE MACHINES
   The classic drum machines (fields.js DRUMKITS tr808/tr909/tr606/cr78) — every
   claim a SCORE can answer, answered here rather than in a browser.

   ONE DRUM SYSTEM, as of this round. There used to be two: audio/machines.js
   synthesized four boxes out of oscillator banks for the live page, while
   audio/to-engine.js named the parent's kick_808/kick909 for the tape and had
   no row at all for the 606 — so the same song played a different drum machine
   depending on which path you were listening to. machines.js is gone; the
   MACHINE_KIT + drumVoice table in to-engine.js is the whole routing layer, and
   audio/voices.js reads it for the page exactly as toEngine reads it for the
   record. What this section gates is that ONE-NESS:
     (a) the digital genres resolve to the machine their comments name, every
         drumkit any genre names is vocabulary, and the machine/sampled split
         is agreed by DRUMKITS and isMachine both;
     (b) the silent-drum law, restated for a routing table: every lane the
         kernel can write resolves to a REAL parent module on every kit — the
         four machines, a sampled kit, and no kit at all — and the model names
         the table uses are the parent's own, held against the maps in
         state-engine.js voiceUnits so a borrowed value cannot drift;
     (c) ONE TABLE, TWO READERS: the live player imports it rather than keeping
         a second opinion, and the retired synthesis stays retired;
     (d) the machine kits' DESK rows (instruments.js MACHINEMIX, which is what
         survives of machines.js — a mix, not a sound) name real lanes and ride
         DRUMMIX through the one merge;
     (e) the machines do not move a single scheduled event: drumkit is a SOUND
         choice, and swapping it must leave the rendered stream identical to
         the millisecond — measured on ui/derive.js's own sectionEvents, the
         stream the transport schedules.
   to-engine.js is a browser ES module; audio/package.json is the module-type
   marker (the ui/ pattern) that lets this gate import it, and ui/deps.js
   resolves against the same stub window §31 built. */
console.log("the machines — genre→kit, one drum table, and the schedule does not move");
{
  const NF = require("../../nukernel/fields.js");
  const M = await import("../../nukernel/audio/to-engine.js");
  const MACHINES = ["tr808", "tr909", "tr606", "cr78"];

  // (a) the genre→kit table, and the vocabulary behind it
  const WANT = { acid: "tr909", house: "tr909", techno: "tr909",
                 trap: "tr808", jodeci: "tr808",
                 newwave: "cr78", eurythmics: "cr78", synthpop: "cr78" };
  for (const [g, want] of Object.entries(WANT))
    ok(GENRES[g].drumkit === want,
       g + " plays \"" + GENRES[g].drumkit + "\", not the " + want + " its own comments name");
  for (const gk of GK)
    if (GENRES[gk].drumkit)
      ok(NF.DRUMKITS[GENRES[gk].drumkit],
         gk + ": drumkit \"" + GENRES[gk].drumkit + "\" is not in DRUMKITS — an unloadable kit");
  for (const k of MACHINES) {
    ok(NF.DRUMKITS[k], k + " is missing from DRUMKITS — the palette cannot offer it");
    ok(M.isMachine(k), k + " is in DRUMKITS but to-engine.js MACHINE_KIT has no row " +
       "for it — the tape would play the default kit while the page played a machine");
  }
  // ...and the sampled six stayed sampled: isMachine must not claim them, or
  // loadKit stops fetching their files
  for (const k of ["acoustic", "brush", "electronic", "jazz", "power", "room"])
    ok(!M.isMachine(k), k + " is a sampled directory and a machine at once");

  // (b) EVERY LANE, EVERY KIT, A REAL MODULE. The kits that route through the
  // machine rows, one that routes through a sampled kit, and the no-kit case
  // the fallback plays — a lane a genre can write and this table cannot name is
  // a silent drum whichever path is listening.
  const fs44 = require("fs"), path44 = require("path");
  const DSPDIR = path44.join(__dirname, "../../engine/faust/dsp");
  const seen = new Set();
  for (const kit of [...MACHINES, "acoustic", null]) {
    const mods = [];
    for (const d of Object.keys(K.LANES)) {
      const V = M.drumVoice(kit, d);
      ok(V && V.module, (kit || "no kit") + "/" + d + " (" + K.LANES[d].name +
         "): the drum table names no parent voice — a silent drum");
      if (!V) continue;
      seen.add(V.module);
      mods.push(V.module);
      ok(V.durB > 0 && V.lvl > 0 && V.gain > 0,
         (kit || "no kit") + "/" + d + ": nonsense row " + JSON.stringify(V));
    }
    console.log("  " + (kit || "no kit") + ": " + mods.length + " lanes -> " +
                [...new Set(mods)].join(" "));
  }
  for (const mod of seen)
    ok(fs44.existsSync(path44.join(DSPDIR, mod + ".dsp")),
       "the drum table names \"" + mod + "\", which is not a module in engine/faust/dsp");
  // ...and the MODEL NAMES are the parent's own, held against voiceUnits itself
  // so a borrowed spelling cannot drift into a lane that resolves to nothing
  const seSrc44 = fs44.readFileSync(
    path44.join(__dirname, "../../engine/faust/voices/state-engine.js"), "utf8");
  const mapOf = (re) => { const mm = seSrc44.match(re); return mm ? new Function("return {" + mm[1] + "}")() : null; };
  const PK = mapOf(/units\.kick = \{ module: \{([^}]*)\}/);
  const PS = mapOf(/units\.snare = \{ module: \{([^}]*)\}/);
  const PH = mapOf(/units\.hat = \{ module: \{([^}]*)\}/);
  ok(PK && PS && PH, "cannot find the parent's drum model maps in state-engine voiceUnits");
  ok(Object.keys(M.MACHINE_KIT).length === MACHINES.length,
     "MACHINE_KIT covers " + Object.keys(M.MACHINE_KIT).length + " of " + MACHINES.length +
     " machines — an uncovered box plays the default kit on the tape");
  for (const [kit, row] of Object.entries(M.MACHINE_KIT)) {
    ok(!PK || PK[row.kickModel], kit + ": kickModel \"" + row.kickModel + "\" is not one the parent knows");
    ok(!PS || PS[row.snareModel], kit + ": snareModel \"" + row.snareModel + "\" is not one the parent knows");
    ok(!PH || PH[row.hatModel], kit + ": hatModel \"" + row.hatModel + "\" is not one the parent knows");
    ok(!PK || M.drumVoice(kit, "k").module === PK[row.kickModel],
       kit + ": the page's kick module is not the one the parent resolves for \"" + row.kickModel + "\"");
    ok(!PS || M.drumVoice(kit, "s").module === PS[row.snareModel],
       kit + ": the page's snare module is not the one the parent resolves for \"" + row.snareModel + "\"");
    ok(!PH || M.drumVoice(kit, "h").module === PH[row.hatModel],
       kit + ": the page's hat module is not the one the parent resolves for \"" + row.hatModel + "\"");
    ok(row.tune > 0.5 && row.tune < 2, kit + ": tune " + row.tune + " is outside the parent's own knob range");
  }

  // (c) ONE TABLE, ONE READER. There used to be two readers and the check was
  // that they agreed; there is one engine now, so the check is that there is
  // one table: to-engine.js's MACHINE_KIT + drumVoice is the whole routing
  // layer, nothing else in nukernel names a parent drum module, and neither of
  // the two retired synthesis paths is back.
  for (const f of ["nukernel/audio/machines.js", "nukernel/audio/voices.js"])
    ok(!fs44.existsSync(path44.join(__dirname, "../..", f)),
       f + " is back — a dormant second drum engine beside the real one");
  for (const f of ["desk.js", "plan.js", "live.js", "fonts.js"]) {
    const src = fs44.readFileSync(path44.join(__dirname, "../../nukernel/audio", f), "utf8");
    ok(!/"(kick_boom|kick_808|kick909|snare_noise|snare_crack|snare_clap|hat_noise|hat_metal)"/
         .test(src),
       "audio/" + f + " names a drum module directly — that is a second drum table");
  }

  // (d) the DESK rows, which is all that survives of the machines here: a mix,
  // not a sound. No punch/sus (there is no sample to shape), and the one merge
  // still rides DRUMMIX — pan comes through from the base row.
  const NI44 = window.NuInstruments;
  for (const kit of MACHINES) {
    const rows = NI44.MACHINEMIX[kit] || {};
    ok(Object.keys(rows).length === Object.keys(K.LANES).length,
       kit + ": MACHINEMIX covers " + Object.keys(rows).length + " of " +
       Object.keys(K.LANES).length + " lanes");
    for (const [d, row] of Object.entries(rows)) {
      ok(K.LANES[d], kit + ": MACHINEMIX names \"" + d + "\", which is not a lane");
      ok(row.room >= 0 && row.room <= 1 && (row.lvl == null || row.lvl > 0) &&
         row.punch == null && row.sus == null,
         kit + "/" + d + ": MACHINEMIX row is not sane (" + JSON.stringify(row) + ")");
      const m = NI44.mixFor(kit, d);
      ok(m.pan === (row.pan != null ? row.pan : NI44.DRUMMIX[d].pan),
         kit + "/" + d + ": mixFor does not ride the DRUMMIX base row");
      ok(NI44.laneKey(kit, d) === kit + "|" + d,
         kit + "/" + d + ": a lane with its own row must earn its own strip");
    }
  }

  // (c) THE SCHEDULE DOES NOT MOVE. Event offsets are in steps and a step is
  // 60/bpm/4 seconds, so identical steps are identical milliseconds at every
  // tempo — asserted anyway in ms at the default 120, so the claim is stated
  // in the unit it is heard in. The whole stream must be byte-identical:
  // kind, lane, pitch, velocity, accent, and time.
  {
    const C = require("../../nukernel/compose.js");
    const stepMs = 60 / 120 / 4 * 1000;
    for (const gk of Object.keys(WANT)) {
      const song = C.compose(gk, 7);
      const b = song.song.find(x => x.stack && x.stack.some(en => en.g === gk)) || song.song[0];
      const evOf = dk => D.sectionEvents({ ...JSON.parse(JSON.stringify(b)), drumkit: dk },
                                         song.slots).ev;
      const a = evOf("electronic"), z = evOf(GENRES[gk].drumkit);
      ok(a.length === z.length, gk + ": swapping the kit sound changed the EVENT COUNT (" +
         a.length + " vs " + z.length + ") — a drum machine rewrote the score");
      let maxDms = 0, moved = 0;
      for (let i = 0; i < Math.min(a.length, z.length); i++) {
        const d1 = Math.abs((a[i].off || 0) - (z[i].off || 0)) * stepMs;
        if (d1 > maxDms) maxDms = d1;
        if (JSON.stringify(a[i]) !== JSON.stringify(z[i])) moved++;
      }
      ok(maxDms === 0, gk + ": a scheduled event moved " + maxDms.toFixed(3) + " ms " +
         "under a kit-sound swap — drumkit is leaking into the scheduler");
      ok(moved === 0, gk + ": " + moved + " event(s) differ under a kit-sound swap — " +
         "the machines must not move a single scheduled event");
    }
  }
}

/* ------------------------------- 45. A TRUMPET KNOWS WHERE IT LIVES
   The INSTRUMENT-REGISTER LAW, gated at the score. The parent states it in two
   tiers (engine/faust/voices/state-engine.js INSTRUMENT_RANGE + the mapEvents
   per-note fold; engine/csd-engine.js SAMPLER REGISTER HOME), and nukernel has
   the same two after Paul heard the gap: "the ska trumpet is squeaky"
   (2026-08-16) — ska's composed horn reaches MIDI 100 against a ceiling of 84.

   ONE TABLE, NOT TWO, as of the one-engine round. The window used to be read
   off a nukernel copy of the ranges (instruments.js RANGES) beside a nukernel
   copy of the zone spans (audio/voices.js playWindow); it is now
   SE.INSTRUMENT_RANGE and the resolved unit's own stretch bounds —
   audio/plan.js windowOf — which is the SAME table the parent's per-note fold
   uses as the net under this. Two copies of a register table is how a page and
   a tape come to disagree about where a trumpet lives.

   Four claims, all score-level (the schedule IS the artifact at this layer —
   no renders, no browser):
     (a) the WINDOW is real and borrowed: every id a genre can voice resolves
         to a parent sampler spec with an honest window, and where nukernel's
         own RANGES row names the same id the values still match the parent's,
         because a surface that shows a range must show the one that binds;
     (b) the SWEEP — every scheduled pitched note, all genres × seeds ×
         adversarial casting, lands inside its instrument's window after the
         home, and the composed ska horn in particular;
     (c) CONTOUR — the home moves whole octaves, one constant per SEAT, so
         interval signs are untouched;
     (d) ONE RESOLVER — the compile is deterministic and there is exactly one
         thing in nukernel that translates a bar for the engine. */
console.log("the register law — the table, the home, and the per-note fold");
{
  // the audio tier's browser surface, stubbed only as far as import needs
  globalThis.addEventListener = globalThis.addEventListener || (() => {});
  globalThis.document = globalThis.document ||
    { visibilityState: "visible", addEventListener: () => {} };
  globalThis.localStorage = globalThis.localStorage ||
    { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const ST = await import("../../nukernel/ui/state.js");
  const P45 = await import("../../nukernel/audio/plan.js");
  const { SE, K: K45, E: E45 } = await P45.warmEngine();
  const NI = require("../../nukernel/instruments.js");
  const C = require("../../nukernel/compose.js");
  const fs = require("fs"), path = require("path");

  // (a) THE WINDOW IS REAL AND BORROWED. Every choosable id resolves through
  // the parent's own sampled library to a unit with an honest window; and where
  // nukernel keeps a RANGES row for the same id (the surface reads it), it says
  // what the parent says.
  const choosable = new Set([NI.BASS_INSTR]);
  for (const g of Object.values(GENRES)) {
    const e = g.instr;
    if (Array.isArray(e)) e.forEach(x => choosable.add(x));
    else if (e) choosable.add(e);
  }
  const lib45 = (() => { const st = { seed: 1, foundSources: [] };
    K45.applySampledOnly(st, 1); return st.samplerLib || {}; })();
  let noWin = 0;
  for (const id of choosable) {
    const spec = lib45[id];
    ok(!!spec, id + " is choosable but the parent's sampled library has no spec for it");
    if (!spec || spec.synth) continue;
    const u = SE.pitchedUnit("melody", { model: "sampler", sampler: spec },
                             { bpm: 120, seed: 1, sampledOnly: true });
    if (!P45.windowOf(SE, u)) noWin++;
  }
  ok(noWin === 0, noWin + " choosable instrument(s) resolve to no honest window — " +
     "a squeak nothing can stop");
  for (const id of Object.keys(NI.RANGES))
    if (SE.INSTRUMENT_RANGE[id])
      ok(SE.INSTRUMENT_RANGE[id][0] === NI.RANGES[id][0] &&
         SE.INSTRUMENT_RANGE[id][1] === NI.RANGES[id][1],
         id + ": nukernel says [" + NI.RANGES[id] + "] but the parent says [" +
         SE.INSTRUMENT_RANGE[id] + "] — borrowed values must not drift");

  // (b) THE SWEEP + (c) CONTOUR. Every genre × three seeds as composed, plus
  // the adversarial casting: a piccolo-ish music box on sludge's floor-scraping
  // line, a palm-muted guitar on ska's horn line, a trumpet on sludge. The
  // resolution is the SHIPPED one — plan.compile() is what the engine is fed —
  // so this measures the artifact, not a mirror of it.
  const NF45 = require("../../nukernel/fields.js");
  const seeds = [1, 3, 7];
  const cases = [];
  for (const gk of GK) for (const s of seeds) cases.push([gk, s, null]);
  cases.push(["sludge", 3, "music_box"], ["ska", 3, "palm_muted_guitar"],
             ["sludge", 7, "trumpet"]);
  const SKAHORN = NI.instrOf("ska", 1);
  let total = 0, out = 0, badHome = 0, skaSeen = 0, skaOut = 0;
  for (const [gk, seed, over] of cases) {
    const raw = C.compose(gk, seed);
    if (over) {
      raw.pool = {};
      for (const c of NF45.POOLCHAIRS) if (c !== "bass") raw.pool[c] = over;
    }
    ST.adoptSong(raw, "gate");
    P45.compile();
    const seats = P45.seats(), homes = P45.homes(), units = P45.unitTable();
    // (c) the home is a WHOLE OCTAVE and one constant per seat, which is what
    // the arrays being per-seat says structurally; assert the octave half here
    for (const h of homes) if (!Number.isInteger(h)) badHome++;
    // (b) THE NOTE THE ENGINE ACTUALLY PLAYS. The bar's events carry the WRITTEN
    // pitch; the frequency a voice sounds at is what SE.mapEvents resolves —
    // the parent's per-note fold is the net under the whole-line home, and
    // reading the events before it would be measuring the intention. So the
    // check runs the shipped mapper over the shipped bar and reads `sets.freq`,
    // which is the number the sampler is handed.
    const win = seats.map((s, v) => P45.windowOf(SE, units["v" + v]));
    const state45 = P45.parentState();
    // ONE MAP PER SONG, not per bar. The register law is a fact about NOTES and
    // the mapper is pure over its event list, so the bars are concatenated (each
    // bar's beats pushed out by the bars before it) and resolved in one call —
    // a hundred-fold fewer calls for the same hundred thousand notes, which is
    // the difference between a gate people run and a gate people skip.
    const all = { pitched: [], drums: [], found: [], sfx: [], srcById: {}, totalBeats: 0 };
    let at = 0;
    for (let i = 0; i < P45.barCount(); i++) {
      const b = P45.barPlan(i);
      for (const e of b.ev.pitched) all.pitched.push({ ...e, beat: e.beat + at });
      at += b.ev.totalBeats;
    }
    all.totalBeats = at;
    for (const e of SE.mapEvents(E45, state45, all, { units }).events) {
      if (e.drum || String(e.unit)[0] !== "v") continue;
      const v = +String(e.unit).slice(1);
      const w = win[v];
      total++;
      if (!w || !e.sets || !(e.sets.freq > 0)) continue;
      const midi = 69 + 12 * Math.log2(e.sets.freq / 440);
      if (midi < w[0] - 0.6 || midi > w[1] + 0.6) out++;
      if (!over && gk === "ska" && seats[v] && seats[v].instr === SKAHORN) {
        skaSeen++;
        if (midi < w[0] - 0.6 || midi > w[1] + 0.6) skaOut++;
      }
    }
  }
  ok(total > 100000, "the sweep saw only " + total + " notes — it is not sweeping");
  ok(out === 0, out + " scheduled note(s) land outside their instrument's window");
  ok(badHome === 0, badHome + " register-home violation(s): a home that is not a whole octave");
  ok(skaSeen > 0, "ska's horn never appeared in the sweep — this gate is proving nothing");
  ok(skaOut === 0, "ska schedules " + skaOut + " " + SKAHORN + " note(s) outside " +
     "their window — still squeaky");

  // (d) ONE RESOLVER: the compile is deterministic over the same state, and
  // exactly one file in nukernel calls the translator — the structural half of
  // "the page and the tape cannot disagree", since there is one of each now.
  ST.adoptSong(C.compose("ska", 3), "gate");
  const snap = () => { P45.compile();
    return JSON.stringify(Array.from({ length: P45.barCount() }, (_, i) => P45.barPlan(i).ev)); };
  ok(snap() === snap(), "compile is not deterministic — two plays would be two songs");
  {
    const dir = path.join(__dirname, "../../nukernel/audio");
    const callers = fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "to-engine.js")
      .filter(f => /from "\.\/to-engine\.js"/.test(fs.readFileSync(path.join(dir, f), "utf8")));
    ok(callers.length === 1 && callers[0] === "plan.js",
       "to-engine.js has " + callers.length + " readers (" + callers.join(", ") +
       ") — one translator, or the two paths are free to disagree again");
  }

  /* ------------------------------- 46. THE BAND IS HIRED FOR THE RECORD
     The INSTRUMENT POOL, gated at the score: one pool per song, one pick per
     chair, resolved by the same walk the cast makes. Three claims:
       (a) a pooled trumpet reaches EVERY section's scheduled lead;
       (b) the register law applies to the pooled chair unchanged;
       (c) a NULL pool is the genre's own band, byte-identical. */
  console.log("the instrument pool — one band for the record, and it reaches the schedule");
  {
    const D46 = await import("../../nukernel/ui/derive.js");
    const raw = C.compose("house", 3);
    ST.adoptSong(raw, "gate");
    const before = snap();
    const raw2 = C.compose("house", 3); raw2.pool = { lead: "trumpet" };
    ST.adoptSong(raw2, "gate");
    ok(JSON.stringify(ST.POOL) === JSON.stringify({ lead: "trumpet" }),
       "adoptSong did not land the pool in state");
    P45.compile();
    const seats = P45.seats(), units = P45.unitTable();
    const tr = seats.filter(s => s.instr === "trumpet" && !s.synth);
    ok(tr.length > 0, "the pooled trumpet never reached the cast");
    // every pitched seat that is a LEAD chair resolves to the pool's pick
    let mis = 0;
    for (const sec of ST.SONG) {
      for (const ent of D46.stackOf(sec)) {
        const g = GENRES[ent.g]; if (!g) continue;
        for (let v = 0; v < g.voices; v++)
          if (D46.chairOf(sec, ent, v) === "lead" &&
              D46.instrIdOf(sec, ent.g, v, ST.POOL) !== "trumpet") mis++;
      }
    }
    ok(mis === 0, mis + " lead chair(s) resolve past the pool");
    // (b) and the register law follows it — read, again, off what the mapper
    // resolves rather than off what was written
    let tout = 0, tn = 0;
    const tw = tr.map(s => P45.windowOf(SE, units["v" + seats.indexOf(s)]));
    const stateP = P45.parentState();
    const allP = { pitched: [], drums: [], found: [], sfx: [], srcById: {}, totalBeats: 0 };
    let atP = 0;
    for (let i = 0; i < P45.barCount(); i++) {
      const b = P45.barPlan(i);
      for (const e of b.ev.pitched) allP.pitched.push({ ...e, beat: e.beat + atP });
      atP += b.ev.totalBeats;
    }
    allP.totalBeats = atP;
    for (const e of SE.mapEvents(E45, stateP, allP, { units }).events) {
      if (e.drum || String(e.unit)[0] !== "v") continue;
      const si = tr.indexOf(seats[+String(e.unit).slice(1)]);
      if (si < 0 || !tw[si] || !e.sets || !(e.sets.freq > 0)) continue;
      const midi = 69 + 12 * Math.log2(e.sets.freq / 440);
      tn++;
      if (midi < tw[si][0] - 0.6 || midi > tw[si][1] + 0.6) tout++;
    }
    ok(tn > 20 && tout === 0, "the pooled trumpet escapes its register (" + tout +
       " of " + tn + ") — the home does not follow the pool");
    // (c) cast, then clear
    ST.setPoolChair("lead", null);
    ok(ST.POOL === null, "clearing the one cast chair did not normalize to null");
    ok(snap() === before, "a cleared pool is not byte-identical to the genre's own band");
  }
}
/* ------------------------------- 47. THE DESK STOPS FLATTERING
   THE DERIVED PER-PART TONE, gated at the model (audio/desk.js
   derivedPartTone / derivedSecEq / mergeEq / resolvedPart — no DOM, no
   render). Paul, on the shipped board, 2026-08-16: "All the EQ settings and
   all the faders are always the same and never move… but never inside a
   song." Both halves were structural: resolvePartMix answered (1, flat) for
   every unmixed chair, and nothing seeded an EQ, so the desk showed a row of
   identical units however different the music was. The claims:
     (a) ANTI-FLATTEN, within a section: on composed songs the per-part
         resolved (gain, eq) tuples are NOT all identical;
     (b) ANTI-FLATTEN, across sections: within one composed song, some part's
         tuple DIFFERS between sections — a song that evolves shows a desk
         that evolves (the shading reads the composed arc's own sec.lvl/env);
     (c) a USER value is an absolute override over the derived, never a sum,
         and unset bands keep answering with the derived value;
     (d) FLAT-WHEN-NO-SOURCE: a chair with no tonal character (family in no
         FAM_EQ row, role seat 0, no section words) resolves to the exact
         identity and builds NO part spec — absent-is-today survives where
         nothing derives;
     (e) SINGLE APPLICATION: each part appears in chanSpec exactly once, its
         spec eq IS resolvedPart's eq (one tone stage, the displayed one), and
         the genre's character seeds the SECTION strip only;
     (f) the whole spec is deterministic — the offline bounce builds from the
         same chanSpec, so the carrier carries the derivation by construction. */
console.log("the desk stops flattering — derived per-part (gain, eq)");
{
  const MX = await import("../../nukernel/audio/desk.js");
  const ST = await import("../../nukernel/ui/state.js");
  const C = require("../../nukernel/compose.js");
  const S = require("../../nukernel/song.js");
  const tup = (sec, k) => {
    const r = MX.resolvedPart(sec, k);
    return JSON.stringify([r.gain, r.eq]);
  };
  // (a) + (b) across five composed songs — measured before being asserted:
  // beatles' `line` chair takes 7 distinct tuples over 11 sections
  for (const gk of ["beatles", "rock", "vaporwave", "postrock", "motown"]) {
    ST.adoptSong(C.compose(gk, 3), "gate");
    let within = false;
    for (const sec of ST.SONG) {
      const keys = MX.partKeysOf(sec);
      if (keys.length >= 2 && new Set(keys.map(k => tup(sec, k))).size > 1) {
        within = true; break;
      }
    }
    ok(within, gk + ": every part resolves the identical (gain, eq) tuple — " +
       "the desk is flattering again");
    const byKey = new Map();
    for (const sec of ST.SONG) for (const k of MX.partKeysOf(sec)) {
      if (!byKey.has(k)) byKey.set(k, new Set());
      byKey.get(k).add(tup(sec, k));
    }
    ok([...byKey.values()].some(s => s.size > 1),
       gk + ": no part's resolved tuple moves across sections — the song " +
       "evolves and the desk does not");
  }
  // (c) override beats derived — absolute per band, multiplied on gain
  {
    ST.adoptSong(C.compose("rock", 3), "gate");
    const sec = ST.SONG.find(s => MX.partKeysOf(s).length >= 2);
    const k = MX.partKeysOf(sec).find(x => x !== "drums");
    sec.parts = { [k]: { eq: { mid: 5 }, fader: -6, lvl: "hush" } };
    const r = MX.resolvedPart(sec, k);
    const t = MX.derivedPartTone(sec, k);
    ok(r.eq && r.eq.mid === 5,
       "a set band is not absolute over the derived (got " +
       JSON.stringify(r.eq) + " over derived " + JSON.stringify(t.eq) + ")");
    for (const b of ["lo", "hi"]) if (t.eq && t.eq[b])
      ok(r.eq[b] === t.eq[b], "an unset " + b + " band stopped answering with " +
         "the derived value under a neighbouring override");
    ok(Math.abs(r.gain - 0.4 * Math.pow(10, (t.db - 6) / 20)) < 1e-3,
       "hush × fader −6 does not ride the derived seating (gain " + r.gain +
       ", derived " + t.db + " dB)");
    sec.parts = null;
  }
  // (d) flat-when-no-source: dnb's first chair is family `lead` (no FAM_EQ
  // row), role seat 0, and a bare skeleton box has no section words — the
  // identity, and the identity builds nothing
  {
    const sec = S.skeleton("dnb", null);
    const keys = MX.partKeysOf(sec);
    const t = MX.derivedPartTone(sec, keys[0]);
    ok(t.db === 0 && t.eq === null,
       "a chair with no tonal source derived " + JSON.stringify(t) +
       " — flat-when-no-source is broken");
    const r0 = MX.resolvedPart(sec, keys[0]);
    ok(r0.gain === 1 && r0.eq === null,
       "the identity chair " + keys[0] + " resolved to " + JSON.stringify(r0) +
       " — absent-is-today no longer survives where nothing derives");
    ok(MX.derivedSecEq(sec) === null,
       "dnb's mid-range tone derived a section EQ — the character thresholds " +
       "have widened past neutral");
  }
  // (e) single application + (f) determinism, on one composed box
  {
    ST.adoptSong(C.compose("beatles", 3), "gate");
    const sec = ST.SONG.find(s => MX.partKeysOf(s).length >= 2);
    const spec = (x) => MX.partKeysOf(x).map(k => ({ key: k, ...MX.resolvedPart(x, k) }));
    ok(JSON.stringify(spec(sec)) === JSON.stringify(spec(sec)),
       "the resolved desk is not deterministic — two bars would be two mixes");
    const parts = spec(sec);
    const seen = new Set();
    for (const p of parts) {
      ok(!seen.has(p.key), "part " + p.key + " appears twice in one spec — " +
         "the tone stage would build twice");
      seen.add(p.key);
      ok(JSON.stringify(p.eq) === JSON.stringify(MX.resolvedPart(sec, p.key).eq),
         p.key + ": the built eq is not the displayed eq — the board is lying " +
         "about the graph");
    }
    // the genre's character is the section strip's and only the section
    // strip's: chairs on two genres with different tone but the same family
    // derive the same part eq, so the character cannot be applied twice
    const g = ST.SONG && MX.derivedSecEq(sec);
    if (g) {
      const merged = MX.mergeEq(MX.derivedSecEq(sec), sec.eq);
      ok(merged && ["lo", "mid", "hi"].every(b => merged[b] === (g[b] || 0)),
         "the untouched section strip does not carry the genre's derived " +
         "character (" + JSON.stringify(merged) + " vs " + JSON.stringify(g) + ")");
    }
  }
}

/* ------------------------------- 48. GENEALOGY — genre as mixture
   Every real (place-year) anchor declares `parents` (weighted references to
   other anchors — the historical claim) and `wants` (the ancestors phase 2
   still owes the catalog); the fit that measures the claims is
   nukernel/genealogy.js. The whole layer is ANNOTATION: the one hard law here
   is (d), that stripping it changes zero rendered bytes — the same
   absent-equals-neutral discipline as §22, proved by deletion rather than
   trusted by review. */
console.log("genealogy — parents reference real anchors, and annotation is inert");
{
  const FN = new Set(["simple", "solo", "vocal", "backing", "riff", "pad"]);
  const real = GK.filter(k => !FN.has(k));
  // (a) COVERAGE + SHAPE: every real anchor declares both fields; parents
  // reference existing non-function anchors, never themselves; weights are
  // positive and sum to ~1 where any are declared at all
  for (const gk of real) {
    const g = GENRES[gk];
    ok(g.parents && typeof g.parents === "object" && !Array.isArray(g.parents),
       gk + ": no parents annotation");
    ok(Array.isArray(g.wants) && g.wants.every(w => typeof w === "string" && w),
       gk + ": wants is not a list of ancestor names");
    for (const [p, w] of Object.entries(g.parents || {})) {
      ok(!!GENRES[p], gk + ": parent " + p + " is not an anchor in the table");
      ok(p !== gk, gk + " is its own parent");
      ok(!FN.has(p), gk + ": parent " + p + " is a function genre — a role " +
         "has a job, not children");
      ok(typeof w === "number" && Number.isFinite(w) && w > 0,
         gk + ": parent weight for " + p + " is not a positive number");
    }
    const ws = Object.values(g.parents || {});
    if (ws.length) {
      const s = ws.reduce((a, b) => a + b, 0);
      ok(Math.abs(s - 1) < 0.05,
         gk + ": parent weights sum to " + s.toFixed(3) + ", not ~1");
    }
  }
  // ...and the function genres declare nothing: a role is not a tradition
  for (const gk of GK) if (FN.has(gk))
    ok(!("parents" in GENRES[gk]) && !("wants" in GENRES[gk]),
       gk + ": a function genre grew a lineage");
  // (b) ROOTS ARE ARGUED, NOT ACCIDENTAL: an empty parents object is a claim,
  // and every root except gregorian (the one true root) must at least name
  // what it is missing — {} beside an empty wants is an anchor nobody thought
  // about, and only chant has earned that silence
  const roots = real.filter(k => !Object.keys(GENRES[k].parents).length);
  ok(roots.includes("gregorian"),
     "gregorian is no longer a root — something claims to predate chant");
  ok(roots.length <= 8, roots.length + " roots — the lineage layer is " +
     "under-declared, half the table has gone orphan");
  for (const r of roots) if (r !== "gregorian")
    ok(GENRES[r].wants.length > 0,
       r + ": empty parents AND empty wants — an unargued root");
  // (c) THE PARENT GRAPH IS A DAG: nobody is their own ancestor
  {
    const state = new Map();
    const cyc = k => {
      if (state.get(k) === 1) return true;
      if (state.get(k) === 2) return false;
      state.set(k, 1);
      for (const p of Object.keys(GENRES[k].parents || {})) if (cyc(p)) return true;
      state.set(k, 2);
      return false;
    };
    ok(!real.some(cyc), "the parent graph has a cycle");
  }
  // (d) BYTE IDENTITY: the annotation reaches NOTHING. Render every genre
  // with and without parents/wants — identical events, or the fields have
  // silently become behavior
  for (const gk of GK) {
    const g = GENRES[gk], bars = Math.max(4, g.bars);
    const stripped = { ...g };
    delete stripped.parents; delete stripped.wants;
    ok(sig(allEvents(P, g, bars)) === sig(allEvents(P, stripped, bars)),
       gk + ": stripping the lineage annotation changed the rendered events");
  }
  // (e) THE FIT RUNS and produces finite numbers: features, weights, R2 and
  // residue are all real, so GENEALOGY.md can never be regenerated from NaNs
  const GY = require("../../nukernel/genealogy.js");
  for (const gk of real)
    ok(GY.featuresOf(gk).every(Number.isFinite),
       gk + ": a genealogy feature is not finite");
  const fits = GY.fitAll();
  // GY.fitAll() fits the WHOLE catalog regardless of GK's sample — the
  // coverage claim is only true against the full roster
  ok(fits.length === GK_FULL.filter(k => !FN.has(k)).length,
     "the fit does not cover every real anchor");
  for (const f of fits) {
    ok(Number.isFinite(f.r2) && f.r2 >= 0 && f.r2 <= 1,
       f.key + ": fit R2 is not a finite number in [0,1]");
    ok(Number.isFinite(f.residRms) && f.residRms >= 0,
       f.key + ": fit residue is not finite");
    ok(f.fitted.every(w => Number.isFinite(w) && w >= 0),
       f.key + ": a fitted parent weight is negative or NaN");
    if (!f.root)
      ok(Math.abs(f.fitted.reduce((a, b) => a + b, 0) - 1) < 1e-6,
         f.key + ": normalized fitted weights do not sum to 1");
  }
}

/* ------------------------------- 48. ONE TONALITY, EVERY ADDED VOICE SPEAKS IT
   THE MASTER HARMONIZATION ENGINE (kernel.js harmonizeStage, wired at
   ui/derive.js sectionEvents through masterCtx). Paul: "when we add patterns
   and sub voices to sections, that is when a tonality happens — there should
   be a master harmonization engine." The claims, all score-level:

     (a) THE DON'T-LOSE-WHAT-WE-HAVE LAW: a single-layer song renders
         BYTE-IDENTICAL to the pre-change engine. REF below was measured at
         HEAD b1adc27 (2026-08-16, before harmonizeStage existed): sha1 of
         every section of compose(gk, seed) for seeds 1..3, each section's
         stack truncated to its authority. Recomputed here and held equal,
         genre by genre. Plus the structural half: harmonizeStage on a stream
         with nothing to conform returns the SAME ARRAY.
     (b) MULTI-LAYER CONFORMANCE, measured against baked PRE-change numbers
         (same corpus, same metric code, measured at the same HEAD):
         strong-beat chord-tone coverage strictly up, sustained cross-layer
         minor-second grinds down to ~0, every conformable note inside the
         governing scale or the sounding chord, stacked cross-layer unisons
         down, and the whole render deterministic twice.
     (c) THE AUTHORITY IS UNTOUCHED: strip the layer's events from a stacked
         render and what remains is the single-layer render, byte for byte.
     (d) THE EMERGENT RULING: fugue/spem/counterpoint (the whole
         `harmony:"emergent"` roster — the counterpoint family) do NOT opt
         out. Their harm() walk IS a per-bar timeline, and a layer agreeing
         with it is the continuo's job; their own voices are authority voices
         and never move (that is (c)). The drones the question worried about
         are not emergent at all — drone is `modal`, sludge and ambient are
         `cycle`, having WRITTEN their timelines down — so a drone is always
         an authority voice and cannot be made to stop droning.

   The metric reads the FINAL stream sectionEvents ships (windowed, edged,
   grooved) through D.masterCtx — the same context the engine corrects by, so
   the measurement and the engine cannot drift apart. Grinds obey the census's
   rule 1 (§38): a chord-tone-vs-chord-tone second is the chord's own colour
   and never counts. */
console.log("the master harmonization engine — one tonality, every added voice speaks it");
{
  const crypto = require("crypto");
  const C = require("../../nukernel/compose.js");
  const S = require("../../nukernel/song.js");
  const sha = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
  const evsig = ev => JSON.stringify(ev.map(e =>
    [e.t, e.n, e.d, e.v, e.vel, e.acc, e.sld, e.dur, e.kind, e.layer || ""]));

  // (a) byte-identity — REF measured pre-change at HEAD b1adc27, 2026-08-16.
  // Two rows have moved SINCE, and deliberately: steely and afrobeat are the
  // only genres whose seeds 1-3 draw the `ride` operator, and the ride stopped
  // carrying a sixteenth-note hat stroke for stroke (kernel.js moveTime — the
  // crash-wash fix). A hash here is a tripwire on accidental drift, so an
  // argued change to the drums re-measures it; it does not get weakened.
  // ...and TWELVE more moved on 2026-08-16, for the two repairs in §51, with an
  // argued reason each. blues and jazz are the anchors themselves: the blues
  // kit's off-beat eighths are now placed by hand in the nudge lane, and the
  // jazz comment beside them stopped claiming a shuffle can be read off the
  // swing dial — it bends odd sixteenths, and both kits are written on even
  // ones. bossa draws `ride`/`tomtime`, which no longer sweep the LEFT FOOT
  // onto the plate it was already playing under. The other nine never touched
  // their anchors at all: they draw a solo-edged opening, whose first bar now
  // sounds ONE lane instead of the whole pitched layer ("a quote IS the melody
  // alone", compose.js), or a quote whose deal changed. The forty-six rows
  // that draw none of the three did NOT move, which is what says these are
  // those three changes and not a fourth.
  // ...AND RE-MEASURED WHOLE on 2026-08-17, for the two changes of that night
  // and no others. A song KNOWS WHAT KEY IT IS IN now — the composer derives a
  // tonic off the genre's own name and stamps it on every box — so every
  // pitched number in this stream moved by a constant per genre; and 29 genres
  // grew an ORNAMENT POLICY, which adds graces, flams, approaches and rolls to
  // the lines they decorate. Both are argued, both have their own gates (§63
  // and §59 respectively), and a tripwire whose two tripwires are proven
  // elsewhere is re-measured rather than weakened. TWO rows did not move at
  // all — techno and backing, the two whose derived tonic lands on zero and
  // which ornament nothing — and that is what says this is those two changes
  // and not a third.
  // ...AND TWICE MORE, later the same night, for the singer: first because a
  // genre's own `sing` finally reached ui/derive.js (sixty-three rows moved),
  // then because the singer learned to phrase and MIN_NOTE came off (the same
  // rows again). BOTH OF THOSE ARE UNDONE. The espeak organ came out whole on
  // 2026-08-17 — the fresh Emscripten heap it needs per utterance took Safari
  // out of memory at 127 syllables a song; nukernel/kernel-daw.html carries
  // the tombstone — so ui/derive.js appends no `sing` events at all and every
  // signature returns to the band's own stream. RE-MEASURED WHOLE against
  // that, and the diff is the proof rather than a promise: exactly 84 rows
  // moved — the 84 that declared a singer — and every one of the 87 rows this
  // table carried BEFORE the singer landed (HEAD 2ad58c1) came back to that
  // commit's hash, character for character. THE TWENTY-SIX THAT DECLARED NO
  // SINGER (postrock, house, dub, techno, ambient, jazz, drone, tango, the
  // function genres) did not move at all, exactly as they sat still through
  // both singer rounds. That is what says this is the singer coming out and
  // nothing else riding along with it.
  // ...AND ONCE MORE, on 2026-08-18, for the SEAMS: an edge is a gesture, not a
  // gap. Four gestures were rewritten where they had been leaving a near-empty
  // bar between two full ones — a `hit` intro now costs a beat instead of the
  // whole first bar, a `hush` outro thins and falls into its hole instead of
  // deleting the bar, a `crash` lands the band's own chord with the cymbal
  // instead of switching the band off, and the `drop` envelope's hole is capped
  // at one bar — plus a new arranger pass (compose.js easeEdges) that keeps a
  // fade-from-silence at the record's own ends and never lets two thinning
  // edges land back to back. 106 of 110 rows moved, which is what a change to
  // the shared edge vocabulary looks like; the four that did not — gregorian,
  // hymn, motorik and backing — deal none of the four gestures at seeds 1/2/3,
  // and that is what says this is the seams and nothing riding along with them.
  // The measured claim is in the census the change was made against: bars that
  // are near-empty between two full ones fell from 541 to 102 across 110 genres
  // × 4 seeds, and 87 of the 102 left are the composed `drop` STOP, at most one
  // to a record and now at most one bar wide.
  // ...AND ONE ROW, on 2026-08-18, for the SINGERS (§77). Four records that
  // said in their own words that a person was singing got one, and three of
  // them cost this table nothing at all: gospel, rnb and darkrnb only swapped
  // WHICH instrument a chair already had (a section standing in for a soloist,
  // a Roland string-choir standing in for a throat), and an instrument id is
  // not a score. `confessionalpop` is the one that moved, because it is the one
  // that gained a chair: both of its instruments were its identity, so the
  // voice had to sit beside them rather than take one, and a third voice is a
  // third stream of events. EXACTLY ONE OF 110 ROWS, which is the whole claim
  // this round makes about the other 109.
  // (`NUKERNEL_REF=1` prints this block, below.)
// (re-measured 2026-08-18: the sixteen-bar law, the era law, the
  // instrumental-cast law and the machine line — 28 genres' composed
  // records changed by argument; the commit carries the reasons.)
  const REF = { simple: "1bc5928ecc4c", fugue: "dabf3451bc56",
    acid: "89216dff87dc", newwave: "ae3805f144ab",
    vaporwave: "e9d90a45402d", blues: "b8556e374706", rock: "7ed6e7823b28",
    gregorian: "ba0f27385ffc", bulgarian: "b4443fedf749",
    spem: "38d8911045b9", counterpoint: "b6eb0a3f8c98",
    neoclassical: "d6901221c508", drone: "6ccd49d4d442",
    sludge: "c0920188d206", tango: "5fdbdee5ff08",
    deathmetal: "616ae65cc466", eurythmics: "49ac4aee2208",
    isley: "57d1d5a45cd3", toto: "66b2c2120c95", jodeci: "76e685510e04",
    beatles: "593e6da08ffd", steely: "107aec95725c",
    postrock: "158192a3da07", boombap: "126821faa96f", trap: "fe4461aebb90",
    house: "2e723c46d7d2", garage: "2774679a9e05", dnb: "33e85a127690",
    disco: "2f4da6621f13", funk: "d72aff9f131e", motown: "6fe748524a9e",
    rnb: "a319e8a7e212", gospel: "15b6fe4a7cc0", reggae: "bd0401a875f1",
    dub: "e1982bdc1822", ska: "8152c037406c", afrobeat: "515bdd57b1f4",
    bossa: "eea38807f78b", countrypop: "508d48bcec38",
    synthpop: "646712dee82f", shoegaze: "dc57e27ef9fe",
    citypop: "7422d4bcebc3", punk: "4b6af4138778", ambient: "3b7e853fedcb",
    techno: "d09b7ce4a8cd", jazz: "dee85985f1f1", bodiddley: "226d8d526b50",
    chuckberry: "c127d6eec6f0", doowop: "944dc51099c3",
    skiffle: "cc710f0540a0", minimalism: "4292a1ae23f0",
    kraftwerk: "4fa1f2eb961b", electro: "67916d4e5384",
    hymn: "8d5cbbc2f790", crooner: "93217fb551cb", yuletide: "5590c4ef5d85",
    merseybeat: "7474611c758c", psychpop: "f76376c0e6d6",
    bigbeat: "5a356ff36ee0", drill: "ac035d75cf11", clubpop: "f5a60f566551",
    powerballad: "eb70b9ea94fe", retrofunkpop: "282d2564b305",
    reggaeton: "464ee83adb83", latinpop: "800268e1e9a4",
    kpop: "a5ff3e8b54fa", boyband: "3d1a4e2e5010", emo: "865ef54b02db",
    screamo: "87b9c2606424", confessionalpop: "9a68f4dd051f",
    darkrnb: "f504a72492ea", bigroom: "6ead5a814488",
    blueeyedsoul: "6bd8ec6c35c9", folkduo: "19d32f689966",
    worldfolk: "5e373d1d113c", jamband: "19c2bc74e2f3",
    sophistirock: "c9f4a980bbc3", motorik: "5eda4735ff86",
    roboticpop: "95c3e8e56881", industrialmetal: "9324c16b04fe",
    ebm: "ce5ad2a44fea", synthduo: "fb0a872494b0",
    musichallrock: "1b95624032cb", orchpsych: "7a23efe7ab5e",
    altcountry: "5ff06cdaec71", yachtsoul: "1894c15448bc",
    yachtrock: "47c6e514a1e6", songwriterpiano: "90a13926e81f",
    softfolk: "df86fa1e2cd7", singersongwriter: "f4caf12bf245",
    coastrock: "d37bd8764bf0", spacerock: "a784bea92e46",
    grebo: "da7cfb7086d0", melodictechno: "100e653229cd",
    bleeptechno: "db4ee878cbd0", industrialbreaks: "ebe9a18a9380",
    industrialrock: "3a0679f8c36b", analogsynthpop: "bc6e73fca79c",
    gothsynth: "80d6711288ba", gothicpop: "f2ff33468636",
    postpunk: "f679a8d7bdd8", dancepostpunk: "84e2c82c1aa9",
    madchester: "aaf9d0de020a", janglepop: "013c85c3e9a9",
    indiedance: "395eebcea290", solo: "e19a9b7ba0df", vocal: "19c0b11b9f68",
    backing: "dc681b7608c8", riff: "79a83db951e2", pad: "b9d3acb4a9f8" };
  // RE-MEASURING IS A COMMAND, not a hand copy off a failure log: the table
  // above is 110 rows and a deliberate change moves most of them at once, so
  // `NUKERNEL_REF=1` prints the whole block ready to paste, the way the
  // dissonance census's own NUKERNEL_CENSUS=1 already does for BASELINE. It
  // prints; it never writes. Weakening the tripwire is still the thing you
  // may not do — re-measuring it, with the reason recorded above, is the
  // thing you must.
  // GK_FULL: the byte-identity tripwire — its whole job is that NOTHING
  // moved except what the commit message argues, and a sample can't tell
  // "unchanged" from "not looked at" (this file's own history: "exactly 84
  // rows moved" when the singer came out — a claim only 110 rows can make).
  const fresh = {};
  for (const gk of GK_FULL) {
    let acc = "";
    for (const seed of [1, 2, 3]) {
      const song = C.compose(gk, seed);
      for (const sec of song.song) {
        const one = clone(sec);
        one.stack = [one.stack[0]];
        acc += evsig(D.sectionEvents(one, song.slots, song.groove, song.swing).ev);
      }
    }
    fresh[gk] = sha(acc);
    if (process.env.NUKERNEL_REF) continue;
    if (!REF[gk]) { ok(false, gk + ": no pre-change reference hash — a new " +
      "genre needs its single-layer baseline measured and added to REF"); continue; }
    ok(fresh[gk] === REF[gk],
       gk + ": a single-layer song no longer renders byte-identical to the " +
       "pre-harmonization engine (the authority moved)");
  }
  if (process.env.NUKERNEL_REF) {
    let line = "  const REF = {";
    for (const gk of GK_FULL) {
      const t = " " + gk + ': "' + fresh[gk] + '",';
      if (line.length + t.length > 76) { console.log(line); line = "   "; }
      line += t;
    }
    console.log(line.replace(/,$/, " };"));
  }
  {
    const arr = [{ t: 0, n: 60, dur: 1, kind: "line", v: 0 }];
    ok(K.harmonizeStage(arr, { conform: () => false, chords: () => [],
       scalePcs: new Set(), stepsPerBar: 16, rate: 1 }) === arr,
       "harmonizeStage with nothing to conform did not return the same array");
  }

  // ---- the measurement kit (identical to the pre-change recipe) ------------
  const pcOf = n => ((n % 12) + 12) % 12;
  const chordAtT = (ctx, cache, t) => {
    const step = t * ctx.rate, bar = Math.floor(step / ctx.stepsPerBar + 1e-9);
    let cs = cache.get(bar);
    if (!cs) { cs = ctx.chords(bar); cache.set(bar, cs); }
    const s = ((step % ctx.stepsPerBar) + ctx.stepsPerBar) % ctx.stepsPerBar;
    return cs.find(c => s >= c.start - 1e-9 && s < c.start + c.len) || cs[cs.length - 1];
  };
  function hMetrics(ev, ctx) {
    const cache = new Map();
    // NOT THE ORNAMENTS. Every number below was hand-measured against the
    // stream a layer CONTRIBUTES, and the harmonization engine conforms
    // exactly those notes; a grace or a flam is added after the fact, by the
    // ornament pass, on top of a note already conformed. Counting them moved
    // the strong-beat totals (house+blues 12 -> 16) and read as a baseline
    // that had rotted, when nothing about the harmonization had changed.
    const isL = e => !e.orn && ctx.conform(e) && e.dur > 0;
    const L = ev.filter(isL);
    const beat = ctx.stepsPerBar / 4;
    let strongOn = 0, strongTot = 0, viol = 0;
    for (const e of L) {
      const c = chordAtT(ctx, cache, e.t), pc = pcOf(e.n);
      const inC = c.pcSet.has(pc);
      const s = e.t * ctx.rate;
      const sb = ((s % ctx.stepsPerBar) + ctx.stepsPerBar) % ctx.stepsPerBar;
      const r = Math.round(sb);
      if (Math.abs(sb - r) < 0.45 && r % beat === 0) { strongTot++; if (inC) strongOn++; }
      if (!inC && !ctx.scalePcs.has(pc)) viol++;
    }
    const pitched = ev.filter(e => e.n != null && e.dur > 0 && !e.d &&
      e.kind !== "sing" && (e.kind === "line" || e.kind === "bass"));
    let grinds = 0, unis = 0;
    const minOv = 0.9 / ctx.rate;
    for (let i = 0; i < pitched.length; i++)
      for (let j = i + 1; j < pitched.length; j++) {
        const a = pitched[i], b = pitched[j];
        if (!isL(a) && !isL(b)) continue;
        if (a.v === b.v) continue;
        const ov = Math.min(a.t + a.dur, b.t + b.dur) - Math.max(a.t, b.t);
        if (ov < minOv) continue;
        const ic = Math.abs(a.n - b.n) % 12;
        if (ic === 1 || ic === 11) {
          const c = chordAtT(ctx, cache, Math.max(a.t, b.t));
          if (!(c.pcSet.has(pcOf(a.n)) && c.pcSet.has(pcOf(b.n)))) grinds++;
        }
        if (a.n === b.n && (a.layer || null) !== (b.layer || null)) unis++;
      }
    return { strongOn, strongTot, viol, grinds, unis, layerNotes: L.length };
  }

  // (b) + (c) + (d) on constructed stacks — the layer phrase leans wide and
  // offbeat so it genuinely has non-chord material to conform
  const P2 = {
    deg:  [1, 4, 2, 6, -3, 1, 5, 3, 0, 2, 4, 1, -2, 5, 2, 0],
    oct:  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0],
    vel:  [7, 5, 6, 8, 5, 6, 7, 5, 8, 6, 5, 7, 6, 5, 7, 6],
    inc:  new Array(16).fill(0), stk: new Array(16).fill(0),
    gate: [1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0],
    acc:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    sld:  new Array(16).fill(0),
  };
  const slots2 = [P, P2];
  // PRE measured at HEAD b1adc27 (pre-change), same corpus, same metric code:
  //   pair                      cover      viol grinds unis
  //   house+blues                6/12       14    7     0
  //   vaporwave+acid            10/21       24   20    29
  //   rock+bulgarian            10/24       16   32     1
  //   tango+gregorian           16/24       16   39     8
  //   funk+citypop               6/9         6   23     0
  //   fugue+acid                 8/21        0    0     5
  //   spem+simple                3/12        0    4     5
  //   counterpoint+vaporwave     8/12        0    5     1
  const PREPAIR = {
    "house+blues": { on: 6, tot: 12, unis: 0 },
    "vaporwave+acid": { on: 10, tot: 21, unis: 29 },
    "rock+bulgarian": { on: 10, tot: 24, unis: 1 },
    "tango+gregorian": { on: 16, tot: 24, unis: 8 },
    "funk+citypop": { on: 6, tot: 9, unis: 0 },
    "fugue+acid": { on: 8, tot: 21, unis: 5 },
    "spem+simple": { on: 3, tot: 12, unis: 5 },
    "counterpoint+vaporwave": { on: 8, tot: 12, unis: 1 },
  };
  const EMERGENT = new Set(["fugue", "spem", "counterpoint"]);
  for (const [a, l] of [["house", "blues"], ["vaporwave", "acid"],
                        ["rock", "bulgarian"], ["tango", "gregorian"],
                        ["funk", "citypop"], ["fugue", "acid"],
                        ["spem", "simple"], ["counterpoint", "vaporwave"]]) {
    const b = S.emptyBox();
    b.stack[0] = { g: a, slots: [0] };
    b.stack.push({ g: l, slots: [1] });
    const ctx = D.masterCtx(b, slots2);
    const ev = D.sectionEvents(b, slots2, null, null).ev;
    const m = hMetrics(ev, ctx), pre = PREPAIR[a + "+" + l], id = a + "+" + l;
    ok(m.layerNotes > 0, id + ": the layer contributed no conformable notes");
    ok(m.strongTot === pre.tot && m.strongOn === m.strongTot && m.strongOn > pre.on,
       id + ": strong-beat chord-tone coverage is not strictly up (" +
       m.strongOn + "/" + m.strongTot + " vs pre " + pre.on + "/" + pre.tot + ")");
    ok(m.grinds === 0, id + ": " + m.grinds + " sustained cross-layer minor " +
       "seconds survive the harmonize stage");
    ok(m.viol === 0, id + ": " + m.viol + " layer notes outside the governing " +
       "scale and the sounding chord");
    ok(pre.unis === 0 ? m.unis === 0 : m.unis < pre.unis,
       id + ": stacked cross-layer unisons not spread (" + m.unis +
       " vs pre " + pre.unis + ")");
    // (c) the authority is untouched: strip the layer and the singer, and the
    // stacked render IS the single-layer render
    const solo = clone(b); solo.stack = [solo.stack[0]];
    ok(evsig(ev.filter(e => !e.layer && e.kind !== "sing")) ===
       evsig(D.sectionEvents(solo, slots2, null, null).ev.filter(e => e.kind !== "sing")),
       id + ": the harmonize stage moved an authority event");
    // determinism, twice
    ok(evsig(D.sectionEvents(b, slots2, null, null).ev) === evsig(ev),
       id + ": two renders of one stacked box differ");
    // (d) the emergent ruling holds where the authority IS emergent
    if (EMERGENT.has(a))
      ok(GENRES[a].harmony === "emergent" && m.viol === 0 && m.strongOn === m.strongTot,
         id + ": an emergent authority's layer does not conform — the ruling " +
         "(participate, timeline read off the voices) broke");
  }
  // the ruling's roster and its boundary: emergent is exactly the counterpoint
  // family, and the drones are NOT emergent — drone vamps one modal chord,
  // sludge/ambient wrote their cycles down — so a drone is never conformable
  // GK_FULL: names the exact roster, so it is a catalog-wide fact, not one
  // about whichever emergent genres the sample happened to draw
  ok(GK_FULL.filter(k => GENRES[k].harmony === "emergent").sort().join(",") ===
     "counterpoint,fugue,spem",
     "the emergent roster changed — re-argue the §48 ruling genre by genre");
  ok(GENRES.drone.harmony === "modal" && GENRES.sludge.harmony === "cycle" &&
     GENRES.ambient.harmony === "cycle",
     "a drone-family genre changed harmony mode — the §48 ruling's boundary " +
     "needs re-reading");

  // (b) on COMPOSED stacked sections — the corpus the arranger actually ships.
  // PRE measured at HEAD b1adc27: cover 1966/2477, viol 1105, grinds 1773,
  // unis 820 over 93 stacked sections (beatles/rock/house/vaporwave/motown ×
  // seeds 1..3). "Down to ~0" is asserted as ≤ 12 grinds (0.7% of pre) and
  // ≤ 60 unisons (7% of pre) so ordinary churn breathes; coverage and the
  // scale law are exact.
  {
    const tot = { strongOn: 0, strongTot: 0, viol: 0, grinds: 0, unis: 0, layerNotes: 0 };
    let stacked = 0;
    for (const gk of ["beatles", "rock", "house", "vaporwave", "motown"]) {
      for (const seed of [1, 2, 3]) {
        const song = C.compose(gk, seed);
        for (const sec of song.song) {
          if ((sec.stack || []).length < 2) continue;
          stacked++;
          const m = hMetrics(
            D.sectionEvents(sec, song.slots, song.groove, song.swing).ev,
            D.masterCtx(sec, song.slots));
          for (const k of Object.keys(tot)) tot[k] += m[k];
        }
      }
    }
    ok(stacked >= 80, "the composed corpus lost its stacked sections (" +
       stacked + ") — the multi-layer claims are measuring nothing");
    ok(tot.strongOn === tot.strongTot && tot.strongOn > 1966,
       "composed corpus: strong-beat chord-tone coverage not strictly up (" +
       tot.strongOn + "/" + tot.strongTot + " vs pre 1966/2477)");
    ok(tot.viol === 0, "composed corpus: " + tot.viol +
       " layer notes outside the governing scale and the sounding chord");
    ok(tot.grinds <= 12, "composed corpus: " + tot.grinds +
       " sustained cross-layer minor seconds (pre 1773, shipped at 6)");
    ok(tot.unis <= 60, "composed corpus: " + tot.unis +
       " stacked cross-layer unisons (pre 820, shipped at 39)");
  }
}

/* ------------------------------- 49. MUSIC BREATHES
   Two claims Paul made in two sentences — "tempo changes never happen, but
   music slows down and speeds up" and "solos have a bar or a few notes of
   lead-in, as do drum phrases and so forth" — measured where they are made:
   ui/derive.js songBars, the one walk from boxes to bars that both the live
   transport and the offline bounce read. Score level, no renders: the bar list
   IS the artifact at this layer, and both features are facts about it.

     (a) THE TEMPO MOVES — bar durations really vary across a composed song,
         the curve is CONTINUOUS at every bar line (a jump would be a tempo
         change, which is the one thing forbidden), the gestures land at
         section ends rather than inside sections, and the last bar of the song
         is the slowest thing in it.
     (b) IT IS THE SAME CLOCK EVERYWHERE — the transport's bar list carries the
         warped durations, and the bounce measures its bars off `barSteps * sd`
         (anchored in the shipped text), so the carrier cannot drift from the
         live graph.
     (c) OFF IS TODAY — with rubato off every bar is exactly 16/rate steps and
         every offset is exactly its event's own time, so the device escape
         hatch (ui/state.js RUBATO) returns the timeline that existed before
         any of this.
     (d) A VOICE ANNOUNCES ITSELF — a lane that enters gets a pickup, the
         pickup LANDS on the bar line it leads to, it speaks the chord it is
         arriving into, it stays within an octave of the note it leads to and
         rides that note's register home, it never plays the arrival itself,
         and it never double-hits or plays over what it borrowed.
     (e) BOTH ARE SEEDED — compiled twice, byte for byte the same. */
console.log("music breathes — the tempo map and the lead-ins");
{
  // the same browser stubs §45 installs, stated again because a section must
  // not depend on another section having run first
  globalThis.addEventListener = globalThis.addEventListener || (() => {});
  globalThis.document = globalThis.document ||
    { visibilityState: "visible", addEventListener: () => {} };
  globalThis.localStorage = globalThis.localStorage ||
    { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const ST49 = await import("../../nukernel/ui/state.js");
  const T49 = await import("../../nukernel/audio/plan.js");
  const NS49 = require("../../nukernel/song.js");
  const C49 = require("../../nukernel/compose.js");
  const fs49 = require("fs"), path49 = require("path");
  const load = (gk, seed) => {
    const r = NS49.load(C49.compose(gk, seed));
    ok(r.ok, "compose(" + gk + "," + seed + ") no longer loads — §49 is measuring nothing");
    return r.song;
  };
  const bars = (s, o) => D.songBars(s.song, s.slots, s.groove, s.swing, null, o || {});
  const plainOf = s => bars(s, { rubato: false, pickups: false });

  /* (a) THE TEMPO MOVES, and moves like a musician */
  {
    const s = load("house", 7), tl = bars(s), flat = plainOf(s);
    const durs = tl.map(b => b.barSteps), nom = flat.map(b => b.barSteps);
    ok(tl.length === flat.length && tl.length > 20,
       "the tempo map changed how many bars there are (" + tl.length + " vs " +
       flat.length + ") — it may only change how long they last");
    ok(new Set(durs.map(d => d.toFixed(6))).size > 5,
       "every bar of a composed song lasts the same time — the tempo does not move");
    // the whole point: a bar is not its nominal length, and no bar is silly
    const ratio = durs.map((d, i) => d / nom[i]);
    ok(Math.max(...ratio) / Math.min(...ratio) > 1.02,
       "the tempo moves by less than two percent across a whole song (" +
       ((Math.max(...ratio) / Math.min(...ratio) - 1) * 100).toFixed(2) +
       "%) — that is a grid with a rounding error, not a band");
    ok(ratio.every(r => r > 0.6 && r < 1.7),
       "a bar left the tempo map's own rate clamp — the clock is no longer musical");
    // CONTINUITY, the law that makes this breathing rather than automation:
    // the rate at the end of a bar IS the rate at the start of the next
    let jumps = 0;
    for (let i = 1; i < tl.length; i++)
      if (tl[i - 1].tempo[1] !== tl[i].tempo[0]) jumps++;
    ok(jumps === 0, jumps + " tempo JUMP(S) at a bar line — a jump is a tempo " +
       "change, which is the one thing this may never be");
    // the gestures live at section ENDS. Inside a section only the drift moves,
    // and it moves slowly; a closing bar moves several times as far.
    // (a bar that OPENS a section is a seam bar too: it is the one recovering
    // from the gesture the closing bar made, which is where "a tempo" happens)
    let insideMax = 0, closingMax = 0, closings = 0;
    for (let i = 0; i < tl.length; i++) {
      const closing = i === tl.length - 1 || tl[i + 1].si !== tl[i].si;
      const move = Math.abs(tl[i].tempo[1] / tl[i].tempo[0] - 1);
      if (closing) { closings++; closingMax = Math.max(closingMax, move); }
      else if (!tl[i].first) insideMax = Math.max(insideMax, move);
    }
    ok(closings >= 5 && closingMax > 4 * insideMax && closingMax > 0.02,
       "the ritards do not land at section ends (closing move " +
       (closingMax * 100).toFixed(2) + "%, inside-section move " +
       (insideMax * 100).toFixed(2) + "%)");
    ok(insideMax > 0, "nothing moves inside a section at all — the human drift " +
       "underneath the arrangement has gone flat");
    // THE FINAL RITARD: the last bar of the song is the slowest bar in it
    const last = ratio[ratio.length - 1];
    ok(last === Math.max(...ratio) && last > 1.03,
       "the song does not end with a ritard (last bar " + last.toFixed(3) +
       "× nominal, slowest " + Math.max(...ratio).toFixed(3) + "×)");
    // ...and a single box on loop is NOT a song ending every four bars
    const one = { song: [s.song[1]], slots: s.slots, groove: s.groove, swing: s.swing };
    const loop = bars(one);
    const lr = loop.map((b, i) => b.barSteps / plainOf(one)[i].barSteps);
    ok(Math.max(...lr) / Math.min(...lr) < 1.02,
       "a single box slows down at the end of every pass — a loop is not an ending");
    // ONE SEAM THAT SLOWS AND ONE THAT PUSHES: a build running at its drop
    // accelerates, everything else leans back
    const dance = load("dnb", 5), dtl = bars(dance);
    let slower = 0, faster = 0;
    for (let i = 0; i < dtl.length; i++)
      if (i === dtl.length - 1 || dtl[i + 1].si !== dtl[i].si) {
        const m = dtl[i].tempo[1] / dtl[i].tempo[0];
        if (m < 0.995) slower++; else if (m > 1.005) faster++;
      }
    ok(slower >= 2, "no seam in a composed song slows into the next section");
    ok(faster >= 1, "no seam in a composed dance song pushes into its drop — " +
       "the accelerando out of a build never fires");
  }

  /* (b) ONE CLOCK for the live tick and the rendered carrier */
  {
    ST49.adoptSong(C49.compose("house", 7), "gate");
    const TL = T49.compile();
    const durs = TL.map(b => b.barSteps);
    ok(new Set(durs.map(d => d.toFixed(6))).size > 5,
       "the transport's bar list carries no tempo map — the live tick plays a grid");
    ok(TL.every(b => b.steps > 0 && Math.abs(b.barSteps - b.steps) < b.steps * 0.6),
       "a transport bar lost its musical grid (`steps`) or its clock ran away from it");
    // AND THE ENGINE IS HANDED THE SAME NUMBER. There used to be a second reader
    // here — the carrier's own bar durations, anchored in bounce.js's text, so
    // the tape could not drift from the graph. There is one engine now, so the
    // check is that the one handoff carries the warp: `barBeats` is what
    // engine/faust/live/live.js asks per bar (opts.barBeats), and it must be the
    // bar list's own length, not a nominal one.
    const beats = TL.map((b, i) => T49.barBeatsAt(i));
    ok(beats.every((v, i) => Math.abs(v - TL[i].barSteps / 4) < 1e-12),
       "audio/plan.js hands the engine a bar length that is not the bar list's — " +
       "the engine would play a grid under a song that breathes");
    ok(new Set(beats.map(v => v.toFixed(6))).size > 5,
       "every bar handed to the engine is the same length — the tempo map stops " +
       "at the handoff");
    const dSrc49 = fs49.readFileSync(
      path49.join(__dirname, "../../nukernel/ui/derive.js"), "utf8");
    ok(/export function songBars/.test(dSrc49) &&
       /songBars/.test(fs49.readFileSync(
         path49.join(__dirname, "../../nukernel/audio/plan.js"), "utf8")),
       "audio/plan.js does not build its timeline with ui/derive.js songBars — " +
       "there are two walks again");
  }

  /* (c) OFF IS TODAY */
  {
    const s = load("rock", 3);
    const flat = plainOf(s);
    let bad = 0, evs = 0;
    for (const b of flat) {
      if (Math.abs(b.barSteps - 16 / b.g.rate) > 1e-12) bad++;
      if (b.tempo) bad++;
    }
    // every offset is exactly the event's own time minus the bars before it,
    // which is the arithmetic the timeline did before there was a tempo map
    const byBox = new Map();
    for (const b of flat) {
      const n = byBox.get(b.si) || 0;
      for (const e of b.ev) {
        evs++;
        if (Math.abs(e.off - (e.t - n * b.barSteps)) > 1e-9 &&
            !(e.t / b.barSteps >= flat.filter(x => x.si === b.si).length)) bad++;
      }
      byBox.set(b.si, n + 1);
    }
    ok(evs > 200 && bad === 0, bad + " bar(s)/event(s) moved with the tempo map " +
       "OFF — the escape hatch does not return the timeline that was there before");
    // ...and turning it ON moves TIME and nothing else: same notes, same lanes
    const on = bars(s, { pickups: false });
    const ident = tl => tl.flatMap(b => b.ev.map(e =>
      [e.kind, e.n != null ? e.n : e.d, e.v == null ? "" : e.v, e.vel].join("|")))
      .sort().join(";");
    const flat2 = bars(s, { rubato: false, pickups: false });
    ok(ident(on) === ident(flat2),
       "the tempo map moved a pitch, a lane or a level — it may only move time");
    ok(JSON.stringify(on.map(b => +b.barSteps.toFixed(6))) !==
       JSON.stringify(flat2.map(b => +b.barSteps.toFixed(6))),
       "the tempo map moved no bar at all");
    // the escape hatch is a DEVICE setting, not a song field: it never rides a save
    ok(typeof ST49.setRubato === "function" && !/rubato/.test(ST49.songJSON()),
       "the rubato escape hatch is missing, or it has leaked into the saved song " +
       "— the tempo is derived from the arrangement, not stored beside it");
  }

  /* (d) THE LEAD-INS */
  {
    // three arrangements that make an entrance happen on purpose, beside the
    // composed corpus: the drums arrive, a stacked solo voice arrives, the
    // bass arrives
    const mk = (g, over) =>
      Object.assign(NS49.skeleton(g, null), { stack: [{ g, slots: [0] }] }, over);
    const build = song => {
      const r = NS49.load({ v: NS49.VERSION, slots: [P], song, bpm: 120 });
      ok(r.ok, "§49's hand-built song no longer loads: " +
         JSON.stringify(r.errors && r.errors[0]));
      return r.song;
    };
    const drumsIn = build([mk("rock", { kit: "nodrums", role: "breakdown" }),
                           mk("rock", { role: "chorus" })]);
    const soloIn = build([mk("rock", { role: "verse" }),
                          Object.assign(mk("rock", { role: "solo" }),
                            { stack: [{ g: "rock", slots: [0] }, { g: "acid", slots: [0] }] })]);
    const bassIn = build([mk("rock", { bassop: "nobass", role: "breakdown" }),
                          mk("rock", { role: "chorus" })]);
    const seamOf = tl => tl.findIndex((b, i) => tl[i + 1] && tl[i + 1].si !== b.si);
    for (const [name, s, kind] of [["the drums", drumsIn, "hit"],
                                   ["a solo voice", soloIn, "line"],
                                   ["the bass", bassIn, "bass"]]) {
      const tl = bars(s), i = seamOf(tl);
      const pu = tl[i].ev.filter(e => e.pu && e.kind === kind);
      ok(pu.length >= 2, name + " enters with no lead-in (" + pu.length +
         " pickup events in the closing bar)");
      // it LANDS: the last pickup event ends exactly on the bar line it leads to
      const lastEnd = Math.max(...pu.map(e => e.off + (e.dur || 0)));
      // a pitched pickup ENDS on the line (its last note abuts the arrival); a
      // drum fill is struck rather than held, so its last hit must land inside
      // the final beat before the line and never past it
      ok(kind === "hit"
         ? (lastEnd < tl[i].barSteps && lastEnd > tl[i].barSteps - tl[i].barSteps / 4)
         : Math.abs(lastEnd - tl[i].barSteps) < 1e-6,
         name + "'s lead-in does not land on the bar line (ends " +
         lastEnd.toFixed(4) + " of " + tl[i].barSteps.toFixed(4) + ")");
      // it belongs to the box it announces, and only to a seam bar
      ok(pu.every(e => e.puSi === tl[i + 1].si),
         name + "'s pickup is not tagged with the box it announces");
      ok(tl.every((b, j) => j === i || !b.ev.some(e => e.pu && e.puSi != null)),
         name + ": a pickup appeared in a bar that is not a seam");
    }
    // A DRUM LEAD-IN ARRIVES ON THE ARRIVING KIT, and only there
    {
      const tl = bars(drumsIn), i = seamOf(tl);
      const pu = tl[i].ev.filter(e => e.pu && e.kind === "hit");
      ok(pu.length > 0 && pu.every(e => e.kit === D.kitOf(drumsIn.song[1])),
         "the drum lead-in plays the kit of the box whose bar it borrows — the " +
         "box that (by construction) has no kit at all");
      const lanes = new Set(tl[i + 1].ev.filter(e => e.kind === "hit").map(e => e.d));
      ok(pu.every(e => lanes.has(e.d)),
         "the drum lead-in plays a lane the arriving kit does not have");
    }
    // THE THINNING LAW: nothing of the pickup's own kind survives in the
    // window it borrowed, and no drum pickup lands on top of an existing hit
    {
      const tl = bars(soloIn), flat = plainOf(soloIn), i = seamOf(tl);
      const pu = tl[i].ev.filter(e => e.pu && e.kind === "line");
      const w0 = Math.min(...pu.map(e => e.off));
      const left = tl[i].ev.filter(e => !e.pu && e.kind === "line" && !e.pad &&
                                        e.off >= w0 - 1e-9);
      ok(pu.length > 0 && left.length === 0,
         left.length + " outgoing line event(s) still play under the pickup that " +
         "borrowed their beat");
      ok(flat[i].ev.filter(e => e.kind === "line" && !e.pad && e.off >= w0).length > 0,
         "the outgoing box had nothing in the borrowed window — the thinning " +
         "law is being proved against silence");
      // sustains are TRIMMED to the borrow, not left ringing through it
      ok(tl[i].ev.every(e => e.pu || e.kind !== "line" || e.pad ||
                             !(e.dur > 0) || e.off + e.dur <= w0 + 1e-6),
         "an outgoing line sustains through the borrowed window");
    }
    /* the composed corpus: every law at once, over real songs. Each
       genre/seed pays a real audio-plan compile() (this loop alone was 24s
       of the old fast run), and every claim below except the pickup-count
       floor is an EXACTNESS law (=== 0) that a smaller draw still proves —
       fewer repeats only lowers the odds of CATCHING a rare violation, the
       same trade the rest of this file makes. SWEEP restores the full 21. */
    const seen = { pu: 0, songs: 0, seams: 0 };
    let offChord = 0, offRange = 0, onArrival = 0, repeat = 0, doubles = 0,
        badHome = 0, strayBar = 0;
    for (const gk of SWEEP ? ["house", "rock", "dnb", "jazz", "acid", "vaporwave", "blues"]
                           : ["house", "dnb", "jazz"]) {
      if (!GENRES[gk]) continue;
      for (const seed of SWEEP ? [1, 5, 9] : [1, 5]) {
        // through the SHIPPED path, not a private call: adoptSong + the
        // transport's own builder, so the register home is really stamped and
        // the home law below is measuring something
        const s = load(gk, seed);
        ST49.adoptSong(C49.compose(gk, seed), "gate");
        const tl = T49.compile();
        seen.songs++;
        // the arrival chord of each box, read through the SAME masterCtx the
        // engine corrects by (§48's discipline: one reading, not two)
        const arrivalOf = si => {
          const ctx = D.masterCtx(s.song[si], s.slots);
          const cs = ctx.chords(Math.max(0, s.song[si].nudge | 0));
          const c = cs.find(x => x.start === 0) || cs[0];
          return { pcs: new Set([...c.pcSet, ...ctx.scalePcs]) };
        };
        for (let i = 0; i < tl.length; i++) {
          const pu = tl[i].ev.filter(e => e.pu);
          if (!pu.length) continue;
          const seam = i === tl.length - 1 || tl[i + 1].si !== tl[i].si;
          if (!seam) strayBar++;
          seen.seams++;
          seen.pu += pu.length;
          const pitched = pu.filter(e => e.kind !== "hit").sort((a, b) => a.off - b.off);
          if (pitched.length) {
            const into = pitched[0].puSi, legal = arrivalOf(into).pcs;
            // the entering voice's own first note in the box it announces
            const first = tl.find(b => b.si === into).ev
              .filter(e => !e.pu && e.kind === pitched[0].kind &&
                           (e.kind !== "line" || (e.v === pitched[0].v && !e.pad)))
              .sort((a, b) => a.off - b.off)[0];
            for (const e of pitched) {
              if (!legal.has(((e.n % 12) + 12) % 12)) offChord++;
              if (first && Math.abs(e.n - first.n) > 12) offRange++;
              if (first && e.kind === "line" && (e.home || 0) !== (first.home || 0)) badHome++;
            }
            if (first && pitched[pitched.length - 1].n === first.n) onArrival++;
            for (let k = 1; k < pitched.length; k++)
              if (pitched[k].n === pitched[k - 1].n) repeat++;
          }
          const u = tl[i].barSteps / 16;
          for (const e of pu.filter(x => x.kind === "hit"))
            for (const o of tl[i].ev)
              if (o !== e && o.kind === "hit" && o.d === e.d &&
                  Math.abs(o.off - e.off) < 0.5 * u) doubles++;
        }
      }
    }
    ok(atLeast(seen.pu, 40) && atLeast(seen.seams, 12),
       "the composed corpus produced only " + seen.pu + " pickup event(s) across " +
       seen.seams + " seam(s) — the lead-ins are not reaching real songs");
    ok(strayBar === 0, strayBar + " pickup(s) landed in a bar that is not a seam");
    ok(offChord === 0, offChord + " pickup note(s) speak neither the chord they " +
       "arrive into nor the governing scale — the harmonize law does not reach them");
    ok(offRange === 0, offRange + " pickup note(s) sit more than an octave from " +
       "the note they lead to");
    ok(badHome === 0, badHome + " pickup note(s) ride a different register home " +
       "from their own arrival — the lead-in would enter an octave out");
    ok(onArrival === 0, onArrival + " pickup(s) end ON the note the entering " +
       "voice is about to play — a lead-in leads to the arrival, it does not play it");
    ok(repeat === 0, repeat + " repeated note(s) inside a pickup — a run that " +
       "repeats a note is not a run");
    ok(doubles === 0, doubles + " pickup hit(s) land on top of an existing hit " +
       "in the same lane");
    // pickups OFF is the timeline without them, and nothing else
    {
      const s = load("house", 7);
      const off = bars(s, { rubato: false, pickups: false });
      const on = bars(s, { rubato: false });
      ok(off.every(b => b.ev.every(e => !e.pu)) &&
         on.some(b => b.ev.some(e => e.pu)),
         "the pickups switch does not switch the pickups");
      ok(off.length === on.length &&
         off.every((b, i) => Math.abs(b.barSteps - on[i].barSteps) < 1e-12),
         "the lead-ins changed how long a bar is — they may only change what is in one");
    }
  }

  /* (e) SEEDED, both of them */
  {
    const s = load("dnb", 5);
    const j = tl => JSON.stringify(tl.map(b =>
      [b.si, b.barSteps, b.tempo, b.ev.map(e =>
        [e.kind, e.off, e.dur, e.n, e.d, e.vel, e.pu || 0, e.puSi == null ? -1 : e.puSi])]));
    ok(j(bars(s)) === j(bars(s)),
       "songBars is not deterministic — the tempo map or the pickups roll fresh " +
       "dice per compile, and the bounce would render a different record");
    ST49.adoptSong(C49.compose("dnb", 5), "gate");
    const k = TL2 => JSON.stringify(TL2.map(b => [b.si, b.barSteps, b.ev]));
    ok(k(T49.compile()) === k(T49.compile()),
       "buildTimeline is not deterministic with the tempo map and the lead-ins in it");
  }
}

/* ------------------------------- 50. THE LOOP ENDS WHERE THE MUSIC DOES,
   AND THE TAPE CARRIES THE WHOLE BAND
   Two reports from Paul, one week after the tempo map landed, and they turned
   out to be two halves of one mistake — code that still measured MUSIC WITH A
   RULER after the music started breathing:

     "I play Liverpool. It's repeating itself off by a beat or two."
     "I switch out of the browser. One phrase repeats over and over — no
      drums — but there's no doubling."

   §49 proved the bar list breathes. This section proves that everything which
   asks the bar list HOW LONG SOMETHING IS gets the breathed answer:

     (a) THE PASS-LENGTH LAW — a box's stamped span is exactly the sum of its
         own bars, on the clock and on the grid, for every genre and seed and
         with rubato both ways. And it has TEETH: the nominal multiplication
         everything used to do (one bar × the bar count) is measurably wrong,
         which is the beat Paul heard.
     (b) NO RULER LEFT — the three readers that used to multiply (the live
         tick's automation arm, the bounce's, the playhead) read the stamp,
         anchored in the shipped text.
     (c) THE WRAP IS THE MUSIC'S OWN END — the song duration the transport
         reports, the tape length the bounce plans, and the sum of the bar
         list are one number.
     (d) CARRIER PARITY — the bounce's plan renders every bar of the live walk
         exactly once, in order, at the time the live walk puts it. This is the
         assertion that would have caught "no drums": a tape that is not the
         whole bar list is not the song.
     (e) THE INSURANCE TAPE IS A WHOLE PHRASE. It did not used to be. Measured
         on the shipped arithmetic as it stood, the 4-second bar-aligned head of
         a composed song was one or two bars — ONE bar of Lagos 1971, 2.17 s,
         with the bass alone in it — and 5 of these 8 songs had no drums in the
         fragment at all. Looping that is the report Paul made twice: "one
         phrase over and over, no drums" and "the crash loops and loops on a
         different tempo". Desktop stopped handing it to the ear; iOS in the
         first stretch could not, because there the alternative is silence.
         So the CUT MOVED to a box boundary — the composer's own section, whole
         — and this section holds the four things that has to mean: it is at
         least one COMPLETE box and never a truncated one, the cap refuses a
         second box rather than knifing the first, it wraps on a bar the
         composer stamped as a box opening (so the loop is a downbeat the music
         has, under the full tape's own timing law), and its drum-lane census is
         exactly the census of the boxes in it. The carrier still only hands it
         to the ear where the alternative is silence.

   WHAT IS DELIBERATELY NOT ON THE TEMPO MAP, so nobody reads its absence as an
   oversight: the ECHO and the tempo-synced sends (audio/graph.js barSec, set
   once per box from that box's dtime chip). A tape echo is a machine with a
   time on it; a band that breathes does not reach over and re-tune the delay
   bar by bar, and the drift a rubato bar puts on a dotted eighth is single-
   digit milliseconds. Every SCHEDULED EVENT, and every span a box is said to
   have, does ride the map — that is what (a)-(d) hold. */
console.log("the loop ends where the music does, and the tape carries the whole band");
{
  // audio/bounce.js reads the platform off the page at module evaluation (the
  // ?bgtest predicate and the render knobs), so the stub window needs the two
  // globals a browser would have. Nothing here plays; the plan is pure.
  globalThis.location = globalThis.location || { search: "" };
  globalThis.navigator = globalThis.navigator ||
    { userAgent: "node", platform: "", maxTouchPoints: 0, hardwareConcurrency: 4 };
  globalThis.Audio = globalThis.Audio || function () {};
  const ST50 = await import("../../nukernel/ui/state.js");
  const T50 = await import("../../nukernel/audio/plan.js");
  const NS50 = require("../../nukernel/song.js");
  const C50 = require("../../nukernel/compose.js");
  const fs50 = require("fs"), path50 = require("path");
  const src50 = f => fs50.readFileSync(path50.join(__dirname, "../../nukernel/", f), "utf8");
  const load50 = (gk, seed) => {
    const r = NS50.load(C50.compose(gk, seed));
    ok(r.ok, "compose(" + gk + "," + seed + ") no longer loads — §50 measures nothing");
    return r.song;
  };
  const bars50 = (s, o) => D.songBars(s.song, s.slots, s.groove, s.swing, null, o || {});
  // a spread of the corpus rather than one song: the tempo map's gestures are
  // chosen by ROLE, so a genre whose composer writes no breakdown never sees
  // the biggest ritard and would prove the law only where it is easy
  const CORPUS50 = [["beatles", 7], ["beatles", 1234], ["afrobeat", 7], ["jazz", 5],
                    ["house", 7], ["rock", 3], ["dnb", 5], ["punk", 3]];

  /* (a) THE PASS-LENGTH LAW, and the beat it is worth */
  {
    let worstBeats = 0, worstAt = "";
    for (const [gk, seed] of CORPUS50) {
      const s = load50(gk, seed);
      for (const rub of [true, false]) {
        const tl = bars50(s, { rubato: rub });
        // the stamp is on EVERY bar, and it is the sum of the run it belongs to
        const runs = [];
        for (let i = 0; i < tl.length;) {
          let j = i;
          while (j < tl.length && tl[j].si === tl[i].si && (j === i || !tl[j].first)) j++;
          runs.push([i, j]); i = j;
        }
        let bad = 0;
        for (const [a, b] of runs) {
          let sum = 0, nom = 0;
          for (let i = a; i < b; i++) { sum += tl[i].barSteps; nom += tl[i].steps; }
          for (let i = a; i < b; i++) {
            const x = tl[i];
            if (Math.abs(x.boxSteps - sum) > 1e-9 || Math.abs(x.boxNom - nom) > 1e-9) bad++;
            if (x.boxBars !== b - a || x.barIn !== i - a) bad++;
          }
        }
        ok(bad === 0, gk + "/" + seed + (rub ? "" : " (rubato off)") + ": " + bad +
           " bar(s) carry a box span that is not the sum of the box's own bars — " +
           "the pass length and the music have come apart again");
        // OFF IS TODAY: with the tempo map off the stamp IS the old multiplication
        if (!rub) {
          let off = 0;
          for (const b of tl) if (Math.abs(b.boxSteps - b.boxBars * b.barSteps) > 1e-9) off++;
          ok(off === 0, gk + "/" + seed + ": the box span is not bars × barSteps with " +
             "the tempo map off — the escape hatch no longer returns the old timeline");
        } else {
          // ...and ON, the old multiplication is WRONG. This is the teeth: if
          // this ever stops failing, §50 is measuring a grid again.
          for (const b of tl) {
            const beats = Math.abs(b.boxSteps - b.boxBars * b.barSteps) / 4;
            if (beats > worstBeats) { worstBeats = beats; worstAt = gk + "/" + seed; }
          }
        }
      }
    }
    ok(worstBeats > 0.4, "the nominal box length (one bar × the bar count) is never " +
       "more than " + worstBeats.toFixed(3) + " of a beat out across the corpus — " +
       "either the tempo stopped moving or this section is measuring the grid");
    console.log("  worst nominal-vs-real box length: " + worstBeats.toFixed(3) +
                " beats (" + worstAt + ")");
  }

  /* (b) NO RULER LEFT — the readers, in the shipped text. There used to be
     three (the live tick's automation arm, the bounce's, the playhead) and two
     of them were the second engine's. What is left is the two that survive one
     engine: the playhead asks the bar list how far through the box it is, and
     the desk's automation is stretched onto the warped box by the bar list's
     own ratio rather than by a nominal multiplication. */
  {
    const p50 = src50("audio/plan.js"), l50 = src50("audio/live.js"),
          m50 = src50("ui/main.js");
    ok(/boxNom \|\| bar\.boxSteps\) \/ bar\.boxSteps/.test(p50) ||
       /bar\.boxSteps > 0 \? \(bar\.boxNom/.test(p50),
       "audio/plan.js stretches an automation lane onto something other than the " +
       "box's own warped span — a sweep that ends where the box does not");
    for (const [f, src] of [["audio/plan.js", p50], ["audio/live.js", l50]])
      ok(!/barSteps \* sd \* boxBars/.test(src),
         "a `barSteps × boxBars` box length is back in " + f + " — that is the " +
         "ruler the tempo map made a lie");
    ok(/transport\.passAt\(/.test(m50) && !/sec\.len \* 16 \/ rate/.test(m50),
       "ui/main.js computes the playhead from the nominal box again — the fill bar " +
       "and the LCD would wrap a beat before or after the music does");
    ok(/export function passAt/.test(l50),
       "audio/live.js no longer exports passAt — the playhead has nowhere " +
       "honest to ask how far through the box it is");
  }

  /* (c) ONE NUMBER FOR THE END OF THE SONG */
  {
    for (const [gk, seed] of CORPUS50.slice(0, 4)) {
      ST50.adoptSong(C50.compose(gk, seed), "gate");
      T50.compile();                     // songDurSec reads the COMPILED list
      const TL = T50.compile(), sd = T50.stepDur();
      const sum = TL.reduce((a, b) => a + b.barSteps, 0) * sd;
      ok(Math.abs(T50.songDurSec() - sum) < 1e-9,
         gk + "/" + seed + ": the transport's song duration is not the sum of its " +
         "bars — the live loop wraps somewhere other than the end of the music");
    }
  }

  /* (d) AND (e) WERE THE CARRIER'S — the bounce's window plan covering the bar
     list exactly once, and the insurance tape being a whole box rather than a
     truncated phrase. Both were properties of a SECOND ENGINE rendering the
     same song beside the live one, and the whole class of question ("does the
     tape play the same bars as the page") stops being askable when there is one
     engine: the bars the ear hears are the bars audio/plan.js compiled, because
     nothing else produces any. What replaced the carrier's own promise is the
     BOUND in audio/live.js — a deadline, a ceiling of two attempts, and a
     demotion written down rather than retried — which §76 holds. */

}

/* ------------------------------- 52. A GENRE YOU INVENTED IS A GENRE THE SONG
                                       CAN PLAY
   The LAB's kept candidates, all the way through: the RECIPE they are stored
   as, the song that carries them, the schedule they render, the chronology they
   sort into, and the CLI that writes one into the catalog by hand.

   WHY A RECIPE AND NOT AN ANCHOR, restated here because it is what every check
   below is really testing: half a genre is closures and JSON drops a function
   without a word, so a saved candidate would come back as a genre with no
   behaviour at all. What travels is the four facts it takes to MAKE it —
   parents and weights, the bench seed, the presses per material field, and
   whatever a person wrote instead — and nukernel/lab.js `rebuild` walks them
   back. That is only true if the walk is deterministic and if the stride lives
   in exactly one place, which is §52a.
------------------------------------------------------------------------- */
console.log("a genre you invented — the recipe, the song, the schedule, the atlas, the promotion");
{
  const LAB52 = require("../../nukernel/lab.js");
  const NS52 = require("../../nukernel/song.js");
  const P52 = require("../../nukernel/promote-genre.js");
  const fs52 = require("fs");
  const path52 = require("path");
  const j52 = x => JSON.stringify(x);
  // two parents from different families, so the cross is a real cross and the
  // material rollers have something to disagree about
  const REC = { label: "Sheffield 2031", parents: { house: 0.55, jazz: 0.45 }, seed: 7 };

  /* --- 52a. the recipe rebuilds to the same genre, twice, and the stride is
     one number. A kept genre that came back DIFFERENT on the next reload would
     be the worst failure this feature can have: silent, and only in the fields
     somebody had rolled. */
  {
    const a = LAB52.rebuild(REC), b = LAB52.rebuild(clone(REC));
    ok(j52(a.candidate.kit) === j52(b.candidate.kit) &&
       j52(a.candidate.roots) === j52(b.candidate.roots) &&
       String(a.candidate.word) === String(b.candidate.word),
       "the same recipe rebuilds to a different genre — a kept genre would not " +
       "survive a reload");
    ok(a.candidate.label === "Sheffield 2031",
       "rebuild does not carry the coined label onto the candidate");
    // the presses move the draft, and move it REPEATABLY
    const p1 = LAB52.rebuild({ ...REC, rolls: { roots: 3 } });
    const p2 = LAB52.rebuild({ ...REC, rolls: { roots: 3 } });
    ok(j52(p1.candidate.roots) === j52(p2.candidate.roots),
       "a pressed roll is not repeatable — (parents, seed, presses) is supposed " +
       "to name a draft");
    ok(LAB52.seedAt(7, 3) === 7 + 3 * LAB52.SEED_STRIDE,
       "seedAt does not walk by SEED_STRIDE — the page and the loader would " +
       "disagree about which draft a press names");
    // a hand edit is never re-rolled, whatever the presses say
    const mineKit = { k: [9,0,0,0, 0,0,0,0, 9,0,0,0, 0,0,0,0] };
    const hand = LAB52.rebuild({ ...REC, rolls: { kit: 5 }, mine: { kit: mineKit } });
    ok(j52(hand.candidate.kit) === j52(mineKit),
       "the dice took back a field a person wrote — the roll key's whole " +
       "contract is that they do not");
  }

  /* --- 52b. the song carries it: save -> load -> the same recipe, and the
     box that names it is still naming it. */
  const key52 = NS52.sessionKey(REC.label);
  {
    ok(NS52.isSessionKey(key52) && !GENRES[key52],
       "the session key " + key52 + " collides with the catalog — the namespace " +
       "is supposed to make that impossible");
    ok(NS52.sessionKey(REC.label, { [key52]: 1 }) !== key52,
       "two genres coined with the same name take the same key");
    const box = Object.assign(NS52.emptyBox(), { stack: [{ g: key52, slots: [0] }] });
    const raw = { v: NS52.VERSION, slots: [NS52.blank()], song: [box],
                  genres: { [key52]: REC }, bpm: 126 };
    const r = NS52.load(clone(raw));
    ok(r.ok, "a song carrying an invented genre does not load: " + j52(r.errors[0]));
    ok(r.ok && j52(r.song.genres[key52]) === j52(REC),
       "the recipe did not survive the loader unchanged");
    ok(r.ok && r.song.song[0].stack[0].g === key52,
       "the box stopped naming its own genre on the way through");
    // ...and the round trip: what the loader hands back is what it takes back
    const again = NS52.load(clone(r.song));
    ok(again.ok && j52(again.song.genres) === j52(r.song.genres),
       "load(load(x)) is not load(x) — the save shape is not stable");

    // THE REFUSALS. Each one is a law with a reason, so each one is checked.
    const bad = (mut, why) => {
      const x = clone(raw); mut(x);
      const res = NS52.load(x);
      ok(!res.ok, "the loader accepted " + why);
    };
    bad(x => { x.genres[key52].label = "Sheffield"; }, "a genre with no coined year");
    bad(x => { x.genres[key52].parents = {}; }, "a genre with no parents");
    bad(x => { x.genres[key52].parents = { house: 0 }; }, "a parent with no weight");
    bad(x => { x.genres.house = REC; }, "a session entry keyed on a catalog anchor");
    bad(x => { x.genres.sheffield2031 = REC; }, "a session entry outside the namespace");

    // ...and the DEGRADE, which is the opposite policy on purpose: a box naming
    // a genre the song does not carry plays as `simple` and SAYS SO, because
    // refusing would lose the record to save the genre.
    const orphan = clone(raw); delete orphan.genres;
    const od = NS52.load(orphan);
    ok(od.ok, "a song whose invented genre is missing refuses to load at all");
    ok(od.ok && od.song.song[0].stack[0].g === NS52.FALLBACK_GENRE,
       "the orphaned box did not fall back to " + NS52.FALLBACK_GENRE);
    ok(od.notes.length === 1 && od.notes[0].got === key52 &&
       od.notes[0].chose === NS52.FALLBACK_GENRE,
       "the loader degraded quietly — 'report what you chose' is the whole rule");
    // and a recipe whose PARENT left the catalog is dropped with a note rather
    // than refused: a lineage is a claim about a table that grows and renames
    const gone = clone(raw); gone.genres[key52].parents = { nosuchgenre: 1 };
    const gd = NS52.load(gone);
    ok(gd.ok && !gd.song.genres[key52] && gd.notes.length >= 1,
       "a recipe with a vanished parent is not dropped with a note");
    // the OLD law is untouched: an unknown CATALOG key still refuses
    const unknown = clone(raw);
    unknown.song[0].stack[0].g = "nosuchgenre"; delete unknown.genres;
    ok(!NS52.load(unknown).ok,
       "an unknown catalog genre stopped being an error — the degrade is only " +
       "for the namespace");
  }

  /* --- 52c. it plays like any other genre. Not "it renders" — it renders the
     SAME SCHEDULE the identical anchor renders under a catalog key, which is
     the only way to say that nothing downstream treats it as a special case. */
  {
    const built = LAB52.rebuild(REC);
    const cand = built.candidate;
    ok(LAB52.ok(built.problems),
       "the bench refuses its own rebuild: " +
       built.problems.filter(p => p.level === "error").map(p => p.msg).join("; "));
    // seat the same object twice — once under a session key, once under a
    // catalog-shaped one — and render both through the kernel the scheduler
    // calls. ui/derive.js genreOf is a single `GENRES[key]` index, so this is
    // that lookup with the namespace on one side of it.
    GENRES[key52] = cand;
    GENRES.__catalog_twin__ = cand;
    try {
      for (const fn of ["render", "drums", "bass"]) {
        const a = K[fn](DEFAULT, GENRES[key52], cand.bars);
        const b = K[fn](DEFAULT, GENRES.__catalog_twin__, cand.bars);
        ok(j52(a) === j52(b) && a.length,
           "a session genre's " + fn + "() is not the catalog's — the one " +
           "lookup path has grown a second branch");
      }
      // and it is a real genre, not a silent one
      ok(K.render(DEFAULT, GENRES[key52], cand.bars).length > 0 &&
         K.drums(DEFAULT, GENRES[key52], cand.bars).length > 0,
         "the invented genre renders nothing — it would be a silent section");
    } finally { delete GENRES[key52]; delete GENRES.__catalog_twin__; }
  }

  /* --- 52d. THE ATLAS. The genre menu is one chronological list and an
     invented genre sorts into it by the year it coined. The sort itself is
     ui/palette.js chronoGenres (a browser module); its LAW is a trailing year
     on the label, which is what song.js gates and what is checked here. */
  {
    const year = s => { const m = /(\d{3,4})\s*$/.exec(s); return m ? +m[1] : null; };
    ok(year(REC.label) === 2031,
       "the coined label does not end in a year — it would fall into the " +
       "yearless FUNCTION-genre bucket at the bottom of the menu");
    const dated = Object.keys(GENRES).filter(k => year(GENRES[k].label) != null);
    const merged = dated.concat([key52])
      .sort((a, b) => (a === key52 ? 2031 : year(GENRES[a].label)) -
                      (b === key52 ? 2031 : year(GENRES[b].label)) ||
                      (a < b ? -1 : a > b ? 1 : 0));
    const at = merged.indexOf(key52);
    ok(at === merged.length - 1,
       "a 2031 genre does not sort past every anchor in the table");
    const before = year(GENRES[merged[at - 1]].label);
    ok(before != null && before <= 2031,
       "the merged chronology is not ordered around the invented genre");
    // ...and one dated BEFORE the newest anchor lands inside the list, not at
    // an end — a chronology that only ever appends is not a chronology
    const mid = dated.concat(["__mid__"])
      .sort((a, b) => (a === "__mid__" ? 1975 : year(GENRES[a].label)) -
                      (b === "__mid__" ? 1975 : year(GENRES[b].label)));
    const mi = mid.indexOf("__mid__");
    ok(mi > 0 && mi < mid.length - 1,
       "a genre coined at 1975 does not land between the anchors it belongs " +
       "between");
  }

  /* --- 52e. PROMOTE, exercised against a COPY of the catalog and never the
     catalog itself. The tool's own verify requires the spliced file and
     compares the anchor that comes back out of it to the genre that went in;
     this checks that the copy is byte-untouched except where it should be, and
     that the refusals refuse. */
  {
    const dir = path52.join(__dirname, "..", "..", "nukernel");
    const gsrc = path52.join(dir, "genres.js"), csrc = path52.join(dir, "compose.js");
    // the copies live BESIDE the originals on purpose: genres.js and compose.js
    // require their neighbours by relative path, so a copy in a temp directory
    // resolves nothing and the splice could never be loaded back
    const gcopy = path52.join(dir, "__promote_gate_genres.js");
    const ccopy = path52.join(dir, "__promote_gate_compose.js");
    const rfile = path52.join(dir, "__promote_gate_recipe.json");
    const before = { g: fs52.readFileSync(gsrc, "utf8"), c: fs52.readFileSync(csrc, "utf8") };
    fs52.writeFileSync(gcopy, before.g);
    fs52.writeFileSync(ccopy, before.c);
    fs52.writeFileSync(rfile, j52(REC));
    const args = extra => ["--recipe", rfile, "--genres", gcopy, "--compose", ccopy]
      .concat(extra);
    try {
      // the dry run: both spliced files are REQUIRED and their anchors compared
      // to the bench's, so reaching here at all is the serialization proof
      const dry = P52.run(args(["--key", "__gate_genre__"]));
      ok(fs52.readFileSync(gcopy, "utf8") === before.g &&
         fs52.readFileSync(ccopy, "utf8") === before.c,
         "a dry run wrote to the file — --write is supposed to be the only writer");
      ok(/__gate_genre__: \{/.test(dry.genres) && dry.compose.includes("__gate_genre__: "),
         "the splice did not put the genre in both files");
      ok(dry.fam === GENRES.house.family,
         "the promoted anchor did not join its dominant parent's family");
      ok(!/\n\s*family:/.test(dry.anchor) && !/\n\s*stress:/.test(dry.anchor),
         "the anchor writes its own family/dynamics — both are STAMPED at load, " +
         "and a second losing copy in the literal is exactly the rot the stamp " +
         "exists to prevent");
      ok(/parents: \{ house: 0.55, jazz: 0.45 \}/.test(dry.anchor),
         "the lineage annotation is not written as the anchors write it");
      ok(/\n\s*wants: \[\],/.test(dry.anchor), "the anchor carries no `wants` line");
      ok(dry.anchor.split("\n").every(l => l.length <= 95),
         "the promoted anchor runs past the widest line in genres.js");

      // now WRITE it, and prove the copy still loads and still holds the genre
      P52.run(args(["--key", "__gate_genre__", "--write"]));
      const after = { g: fs52.readFileSync(gcopy, "utf8"), c: fs52.readFileSync(ccopy, "utf8") };
      ok(after.g !== before.g && after.c !== before.c, "--write wrote nothing");
      ok(before.g === fs52.readFileSync(gsrc, "utf8") &&
         before.c === fs52.readFileSync(csrc, "utf8"),
         "the real catalog was touched — the gate must only ever splice a copy");
      delete require.cache[require.resolve(gcopy)];
      delete require.cache[require.resolve(ccopy)];
      const G2 = require(gcopy), C2 = require(ccopy);
      const anchor = G2.GENRES.__gate_genre__;
      ok(!!anchor, "the written copy does not hold the promoted genre");
      ok(anchor && anchor.label === REC.label && anchor.family === dry.fam,
         "the promoted anchor came back with the wrong name or family");
      ok(anchor && typeof anchor.word === "function" &&
         Array.isArray(anchor.word(0, 0)),
         "the promoted `word` is not a closure the kernel can call — a rolled " +
         "word is serialized from its TABLE, never from its toString");
      ok(C2.BPM.__gate_genre__ === dry.bpm,
         "the tempo row did not land — the composer would write a NaN tempo");
      // THE ARTIFACT, not the literal: the anchor read back out of the file
      // must play what the bench played
      const cand = LAB52.rebuild(REC).candidate;
      for (const fn of ["render", "drums", "bass"])
        ok(j52(K[fn](DEFAULT, anchor, anchor.bars)) ===
           j52(K[fn](DEFAULT, cand, cand.bars)),
           "the promoted anchor's " + fn + "() is not the genre that was kept");
      // every other anchor is untouched: a splice that reformatted its
      // neighbours would be a splice nobody could review
      // G2 is loaded from a copy of the REAL (full) genres.js, plus the one
      // promoted anchor — GK_FULL is the catalog size to compare against.
      ok(Object.keys(G2.GENRES).length === GK_FULL.length + 1,
         "the splice changed the size of the table by something other than one");
      for (const k of ["house", "jazz", "simple", "pad"])
        ok(j52(K.render(DEFAULT, G2.GENRES[k], G2.GENRES[k].bars)) ===
           j52(K.render(DEFAULT, GENRES[k], GENRES[k].bars)),
           "promoting a genre changed what " + k + " plays");

      // THE REFUSALS
      const refuses = (extra, why) => {
        let threw = false;
        try { P52.run(args(extra)); } catch (e) { threw = true; }
        ok(threw, "promote did not refuse " + why);
      };
      refuses(["--key", "house"], "a key the catalog already holds");
      refuses(["--key", "not a key"], "a key that is not an identifier");
      fs52.writeFileSync(rfile, j52({ ...REC, parents: { solo: 1 } }));
      refuses(["--key", "__gate_two__"], "a FUNCTION genre as a parent");
      fs52.writeFileSync(rfile, j52({ ...REC, label: "Chicago 1986" }));
      refuses(["--key", "__gate_two__"], "a label the table already carries");
    } finally {
      for (const f of [gcopy, ccopy, rfile]) { try { fs52.unlinkSync(f); } catch (e) { /* never made */ } }
    }
  }
}

/* §53 WAS THE TAPE'S WRAP and §54 WAS THE CARRIER'S TRUTH TABLE (one engine,
   2026-08-18). Both were about audio/bounce.js — a 2,165-line offline render
   that pressed the whole song into an fMP4 loop and handed it to an <audio>
   element so a sleeping tab kept playing. Every one of those jobs is
   engine/faust/live/live.js's WAV-FIRST path, which nukernel now simply takes:
   the same media element, the same continuous append, the same reason (media is
   the one thing an OS keeps alive), rendered by the same engine that renders
   the desktop stream instead of by a second one.
   The arithmetic those sections held is not lost — the muxer is
   engine/faust/codec/fmp4.js and its gate is test/unit/fmp4.test.js, which is
   where the frame-count and tfdt laws were always really held. What replaced
   the carrier's truth table is §76's: the engine gets a DEADLINE and a CEILING
   and demotes in writing, which is the half the carrier never had and the half
   that killed the tab on iOS. */

/* ------------------------------- 55. A URL FOR EVERY ROOM IN THE HOUSE
   ui/pages.js's router, run FOR REAL — imported as the module it is (the §31
   window-stub trick, extended with just enough of document/location/history/
   EventTarget for the router's own code to execute) rather than a hand
   rewrite of its logic that could drift from the shipped file and still
   pass. Reads the RENDERED result: chassis.dataset.page, location.hash and
   the history stack a click, a URL load, or a back/forward actually leaves
   behind — never the source. */
console.log("§55 — a url for every room in the house");
{
  globalThis.window = globalThis;
  window.NuKernel = K;
  window.NuGenres = require("../../nukernel/genres.js");
  window.NuFields = require("../../nukernel/fields.js");
  window.NuSong = require("../../nukernel/song.js");
  window.NuInstruments = require("../../nukernel/instruments.js");
  window.NuCompose = require("../../nukernel/compose.js");
  window.PRESETS = require("../../nukernel/presets.js").PRESETS;
  window.__REGISTRY = require("../../engine/registry-data.js");

  // ui/touch.js reads matchMedia/navigator/performance at import time;
  // ui/pages.js reads document/location/history/addEventListener. None of it
  // needs to be a browser, only real enough that the router's own code runs
  // rather than a stub standing in for it.
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.navigator = { vibrate: null };
  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  const bus = new EventTarget();
  globalThis.addEventListener = bus.addEventListener.bind(bus);
  globalThis.removeEventListener = bus.removeEventListener.bind(bus);
  globalThis.dispatchEvent = bus.dispatchEvent.bind(bus);

  class Elem {
    constructor(page) { this.dataset = { page }; this._attrs = {}; this._on = {}; }
    setAttribute(k, v) { this._attrs[k] = String(v); }
    getAttribute(k) { return this._attrs[k]; }
    addEventListener(t, fn) { (this._on[t] = this._on[t] || []).push(fn); }
    click(mods) {
      const ev = Object.assign({ defaultPrevented: false, button: 0 }, mods,
        { preventDefault() { ev.defaultPrevented = true; } });
      for (const fn of (this._on.click || [])) fn(ev);
      return ev;
    }
  }
  const chassis55 = new Elem(); chassis55.dataset = { page: "song" };
  const pkeys55 = ["compose", "song", "mix", "lab"].map(p => new Elem(p));
  globalThis.document = {
    getElementById: id => (id === "chassis" ? chassis55 : null),
    querySelectorAll: sel => (sel === ".pkey" ? pkeys55 : []),
  };

  let hist55 = [""], hi55 = 0;
  const hashOf55 = u => { const s = String(u), i = s.indexOf("#");
                           return i < 0 ? "" : s.slice(i); };
  globalThis.location = { hash: "" };
  globalThis.history = {
    pushState(_s, _t, u) {
      hist55 = hist55.slice(0, hi55 + 1); hist55.push(hashOf55(u));
      hi55 = hist55.length - 1; globalThis.location.hash = hist55[hi55];
    },
    replaceState(_s, _t, u) { hist55[hi55] = hashOf55(u); globalThis.location.hash = hist55[hi55]; },
    back() { if (hi55 > 0) { hi55--; globalThis.location.hash = hist55[hi55];
                              globalThis.dispatchEvent(new Event("popstate")); } },
    forward() { if (hi55 < hist55.length - 1) { hi55++; globalThis.location.hash = hist55[hi55];
                              globalThis.dispatchEvent(new Event("popstate")); } },
  };

  const PG = await import("../../nukernel/ui/pages.js");
  const ST = await import("../../nukernel/ui/state.js");

  // (a) EVERY PAGE REACHABLE BY URL: the rail carries a real href (a
  // right-click has something to copy), and a plain click lands the chassis
  // on that page carrying the CURRENT index, not a bare page name a listener
  // has to correct after the fact.
  for (const p of ["compose", "song", "mix", "lab"]) {
    const k = pkeys55.find(e => e.dataset.page === p);
    const ev = k.click();
    ok(ev.defaultPrevented, "§55(a) clicking the " + p + " rail key did not take the click");
    ok(chassis55.dataset.page === p,
       "§55(a) the " + p + " rail key did not land on its page (got " + chassis55.dataset.page + ")");
    const want = "#/" + p + (p === "compose" ? "/" + ST.slot
      : (p === "song" || p === "mix") ? "/" + ST.viewSec : "");
    ok(location.hash === want,
       "§55(a) " + p + " landed on " + location.hash + ", not " + want);
  }
  // a modified click (new tab) is left to the real href — the router must
  // not swallow it or navigate in-page underneath it
  {
    const before = chassis55.dataset.page;
    const ev = pkeys55.find(e => e.dataset.page === "compose").click({ metaKey: true });
    ok(!ev.defaultPrevented, "§55(a) a cmd-click on a rail key was swallowed");
    ok(chassis55.dataset.page === before, "§55(a) a cmd-click navigated in-page too");
  }

  // (b) LOAD-FROM-URL RESTORES THE PAGE: a shared link lands on what the
  // sender was looking at — the phrase on Compose, the section on Arrange —
  // not on whichever page the markup happens to open on.
  ST.putPhrase(1, ST.SLOTS[0]);          // a real slot 1 to restore into
  {
    location.hash = "#/compose/1";
    PG.initRoute();
    ok(chassis55.dataset.page === "compose",
       "§55(b) #/compose/1 did not land on Compose");
    ok(ST.slot === 1, "§55(b) #/compose/1 did not restore slot 1 (got " + ST.slot + ")");
  }
  {
    location.hash = "#/song/2";
    PG.initRoute();
    ok(chassis55.dataset.page === "song", "§55(b) #/song/2 did not land on Arrange");
    ok(ST.viewSec === 2, "§55(b) #/song/2 did not restore section 2 (got " + ST.viewSec + ")");
  }
  // an unrecognised fragment writes the CURRENT state back rather than
  // leaving a lie in the address bar, and does it as a REPLACE (no new entry)
  {
    const lenBefore = hist55.length;
    location.hash = "#/nonsense";
    PG.initRoute();
    ok(chassis55.dataset.page === "song", "§55(b) a bad fragment changed the page");
    ok(location.hash === "#/song/2", "§55(b) a bad fragment was not corrected (got " + location.hash + ")");
    ok(hist55.length === lenBefore, "§55(b) correcting a bad fragment pushed a history entry");
  }

  // (c) BACK/FORWARD WALKS THE HISTORY the way a person expects: three real
  // navigations push three entries, and the browser's own back/forward key
  // (simulated as a popstate, since that's what a real back button fires)
  // steps the chassis back through them without this file touching setPage.
  {
    PG.setPage("song"); PG.setPage("mix"); PG.setPage("lab");
    ok(chassis55.dataset.page === "lab", "§55(c) three setPage calls did not land on lab");
    history.back();
    ok(chassis55.dataset.page === "mix",
       "§55(c) back() did not return to mix (got " + chassis55.dataset.page + ")");
    history.back();
    ok(chassis55.dataset.page === "song",
       "§55(c) a second back() did not return to song (got " + chassis55.dataset.page + ")");
    history.forward();
    ok(chassis55.dataset.page === "mix",
       "§55(c) forward() did not return to mix (got " + chassis55.dataset.page + ")");
  }
  console.log("  every rail key has an href, a load restores page+index, back/forward walk the stack");

  // (d) NO LAYOUT BRANCH ABOVE THE PHONE BREAKPOINT, in the CHASSIS/RAIL
  // region this lane owns (kernel-daw.css carries other, unrelated
  // @media (max-width:899px) blocks — the song table's own phone grid among
  // them — that belong to other lanes and are not this claim). The chassis's
  // three zones and the rail used to live entirely behind that breakpoint,
  // with a separate >=900px rule undoing them for a desk; both gates are
  // gone from the source text itself, which is the one claim only the
  // source can prove, so it is read here rather than re-derived from
  // computed style.
  {
    const css = require("fs").readFileSync(
      require("path").join(__dirname, "../../nukernel/kernel-daw.css"), "utf8");
    ok(css.includes("body{padding:0}"),
       "§55(d) the chassis's body{padding:0} left the file entirely");
    ok(!css.includes("@media (max-width:899px){\n  body{padding:0}"),
       "§55(d) the chassis block is still gated behind the 899px breakpoint");
    ok(!/\.deck,\.page\{display:contents\}/.test(css),
       "§55(d) the desk's chassis dissolve (.deck,.page{display:contents}) is still in the file");
    ok(!/\.pagerail\{display:none\}/.test(css),
       "§55(d) .pagerail{display:none} — the desk-hides-the-rail rule — is still in the file");
    ok(/\.pagerail\{[^}]*display:grid/.test(css),
       "§55(d) .pagerail no longer paints unconditionally");
    console.log("  kernel-daw.css: the chassis/rail block is ungated, no desk dissolve remains");
  }
}

/* ------------------------------- 56. A PHRASE IS AS LONG AS THE MUSIC NEEDS
   song.js's persistence half of "phrases may be up to 128 steps"
   (2026-08-17) — score-level, not DOM: blank()/okPhrase read a phrase's
   length off the vectors themselves rather than assuming sixteen, so this
   reads that contract straight off nukernel/song.js, the way a save/load
   round trip actually exercises it. ui/editor.js's grid/tray/playhead half
   is proved on the rendered page instead (test/browser/nukernel-phrase-editor.test.js)
   — this file stays pure node. */
console.log("§56 — a phrase is as long as the music needs");
{
  const S56 = require("../../nukernel/song.js");
  const z56 = n => new Array(n).fill(0);
  const phrase56 = n => ({ deg: z56(n), oct: z56(n), vel: new Array(n).fill(5),
                           inc: z56(n), stk: z56(n), gate: z56(n), acc: z56(n), sld: z56(n) });
  const song56 = (slots) => ({
    v: S56.VERSION, slots, bpm: null, genres: null, master: null, buses: null,
    groove: null, swing: null, pool: null,
    song: [{ stack: [{ g: "simple", slots: [0] }], len: 4, nudge: 0, ops: [], fx: [] }],
  });

  // (a) blank()/z() default to sixteen (every existing caller writes them
  // bare) but take whatever length a caller — ui/editor.js's grow/shrink —
  // actually asks for.
  {
    const b16 = S56.blank(), b128 = S56.blank(128);
    ok(b16.deg.length === 16 && b16.gate.length === 16,
       "§56(a) blank() with no argument is not sixteen steps");
    ok(b128.deg.length === 128 && b128.sld.length === 128,
       "§56(a) blank(128) did not build a 128-step phrase");
    ok(S56.PHRASE_MIN === 1 && S56.PHRASE_MAX === 128,
       "§56(a) PHRASE_MIN/PHRASE_MAX are not exported as 1/128 (got " +
       S56.PHRASE_MIN + "/" + S56.PHRASE_MAX + ")");
  }

  // (b) validateSong ACCEPTS 1..128, at whatever length the vectors agree
  // on — not nailed to sixteen, and not merely "whatever the first vector
  // says" (every one of the eight must match).
  {
    for (const n of [1, 17, 64, 128]) {
      const r = S56.validateSong(song56([phrase56(n)]));
      ok(r.ok, "§56(b) a " + n + "-step phrase was refused: " +
         (r.errors[0] && JSON.stringify(r.errors[0])));
      if (r.ok) ok(r.song.slots[0].deg.length === n,
        "§56(b) a " + n + "-step phrase round-tripped at a different length (" +
        r.song.slots[0].deg.length + ")");
    }
    const over = S56.validateSong(song56([phrase56(129)]));
    ok(!over.ok, "§56(b) a 129-step phrase was accepted — PHRASE_MAX did not hold");
    const zero = S56.validateSong(song56([phrase56(0)]));
    ok(!zero.ok, "§56(b) a zero-length phrase was accepted");
    // one vector shorter than the rest of the SAME phrase — the length is
    // read off deg, so every other vector must be held to it explicitly
    const uneven = phrase56(32); uneven.oct = z56(16);
    const uv = S56.validateSong(song56([uneven]));
    ok(!uv.ok, "§56(b) a phrase whose vectors disagree in length was accepted");
  }

  // (c) migrate()'s ramp-vector backfill (old saves missing inc/stk) reads
  // the phrase's OWN length off deg rather than assuming sixteen — every
  // real old save IS sixteen, so this proves the fix on a synthetic phrase
  // at another length, the case that would have silently mismatched before.
  // The backfill only runs on the v:1 path (migrate()'s own early return
  // skips it for v:2), which is also what makes it safe to assume real old
  // saves are always sixteen — no v:2 writer has ever omitted inc/stk.
  {
    const raw = song56([phrase56(32)]); raw.v = 1;
    delete raw.slots[0].inc; delete raw.slots[0].stk;
    const m = S56.migrate(raw);
    ok(Array.isArray(m.slots[0].inc) && m.slots[0].inc.length === 32,
       "§56(c) migrate() backfilled inc at length " +
       (m.slots[0].inc && m.slots[0].inc.length) + ", not the phrase's own 32");
    ok(Array.isArray(m.slots[0].stk) && m.slots[0].stk.length === 32,
       "§56(c) migrate() backfilled stk at length " +
       (m.slots[0].stk && m.slots[0].stk.length) + ", not the phrase's own 32");
    const r = S56.validateSong(m);
    ok(r.ok, "§56(c) a migrated phrase failed validation: " +
       (r.errors[0] && JSON.stringify(r.errors[0])));
  }
  console.log("  song.js: blank()/okPhrase read a phrase's length off its own vectors, 1..128");
}

/* ------------------------------- 58. TWENTY-NINE MORE ROOMS
   Lane E1's own check (2026-08-17), for the twenty-nine genres added by that
   pass: every one of them renders a non-silent score, names a real sampler
   (the same registry-backed check §(d) above runs for the whole table, run
   again here so a failure names the batch), and is measurably different from
   the anchors it declares as parents and from its own `near` neighbour — the
   thing "shipping a dud quietly" would look like is a new genre whose
   rendered events are byte-identical to the genre it claims lineage from. */
console.log("twenty-nine more rooms — non-silent, real instruments, distinguishable from parents");
{
  const ADDED = ["hymn", "crooner", "yuletide", "merseybeat", "psychpop", "bigbeat",
    "drill", "clubpop", "powerballad", "retrofunkpop", "reggaeton", "latinpop",
    "kpop", "boyband", "emo", "screamo", "confessionalpop", "darkrnb", "bigroom",
    "blueeyedsoul", "folkduo", "worldfolk", "jamband", "sophistirock", "motorik",
    "roboticpop", "industrialmetal", "ebm", "synthduo"];
  ok(ADDED.length === 29, "the roster itself drifted from 29: " + ADDED.length);
  for (const gk of ADDED)
    ok(!!GENRES[gk], gk + ": named in the roster but missing from GENRES");

  // (a) NON-SILENT: the same [render, drums, bass] walk every other section
  // in this file reads, at each genre's own bar count.
  for (const gk of ADDED) {
    const g = GENRES[gk], bars = Math.max(4, g.bars);
    const ev = allEvents(P, g, bars);
    ok(ev.length > 0, gk + ": renders silent — zero events at " + bars + " bars");
  }

  // (b) A REAL SAMPLER: instrOf must not throw, and every id it can return
  // must be a key in the registry's SAMPLERS table — the same check §(d)
  // above runs for the shipped 58, run again so a failure names this batch.
  {
    const NI = require("../../nukernel/instruments.js");
    const vm = require("vm"), fs = require("fs"), path = require("path");
    const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(
      path.join(__dirname, "../../engine/registry-data.js"), "utf8"), ctx);
    const SAMPLERS = (ctx.__REGISTRY && ctx.__REGISTRY.SAMPLERS) || {};
    ok(Object.keys(SAMPLERS).length > 100, "registry-data.js did not yield SAMPLERS");
    for (const gk of ADDED) {
      const g = GENRES[gk];
      for (let v = 0; v < g.voices; v++)
        ok(typeof NI.instrOf(gk, v) === "string", gk + ": instrOf failed for voice " + v);
      const ids = Array.isArray(g.instr) ? g.instr : [g.instr];
      for (const id of ids)
        ok(!!SAMPLERS[id], gk + ": instr \"" + id + "\" is not a SAMPLERS id");
    }
  }

  // (c) DISTINGUISHABLE FROM ITS OWN LINEAGE: a genre that renders byte-for-
  // byte identical to a declared parent or its `near` neighbour is not a new
  // room, it is the old one wearing a new door sign. Compared on the shared
  // DEFAULT phrase (the same one every render in this file uses) so a genre
  // whose only "difference" was a fact about the composer's own phrase bank
  // does not pass by accident.
  for (const gk of ADDED) {
    const g = GENRES[gk];
    const rivals = new Set(Object.keys(g.parents || {}));
    if (g.near) rivals.add(g.near);
    ok(rivals.size > 0, gk + ": no parents and no `near` — nothing to prove distinct from");
    for (const p of rivals) {
      const bars = Math.max(4, g.bars, GENRES[p].bars);
      ok(sig(allEvents(P, g, bars)) !== sig(allEvents(P, GENRES[p], bars)),
         gk + ": renders identical to its own parent/neighbour \"" + p + "\"");
    }
  }

  // (d) FAMILY + DYNAMICS: every anchor added must resolve `family` (the
  // FAMILIES stamp) and stress/phrase/touch (the DYNAMICS/DYN_FAMILY stamp,
  // §39's own exhaustive law) — a genre that resolves to neither renders flat
  // forever, and §39 above only proves that of the shipped 58.
  for (const gk of ADDED) {
    const g = GENRES[gk];
    ok(!!g.family, gk + ": no family — the palette and the dynamics stamp both miss it");
    ok(g.stress != null && g.phrase != null && g.touch != null,
       gk + ": no dynamics row — neither a club-family override nor a family fallback landed");
  }
  console.log("  58: " + ADDED.length + " genres — non-silent, real samplers, distinct from lineage");
}

/* §59 — A NOTE CAN LEAN, SLIDE, FLAM OR PASS ---------------------------------
   The ninth type (kernel.js ORNAMENTS), in both halves: the `orn` MARKS a hand
   writes on a step, and the genre PASS that adds what a style would add. The
   four things this has to prove are the four ways it could ship broken, and
   three of them are the ways features have shipped broken here before:

     (a) every mark reaches the score, and does the specific thing it claims —
         a grace is a different pitch before the beat, a flam is the SAME pitch
         before the beat, a roll is n strikes inside the note's own length;
     (b) the marks BEAT the pass: on a genre with a policy, a marked step plays
         its mark and nothing the policy would have chosen instead;
     (c) the pass is deterministic — two renders of one state are byte-equal,
         tags included, and it is the SEED that decides, not the clock;
     (d) nothing moved. Every term is opt-in and a genre with no `g.orn` row
         renders exactly what it rendered the commit before this one — held
         against hashes measured on the PRE-CHANGE kernel, the same tripwire
         idiom §39's five machines already keep (and those five are in the list
         below, at the same values, which is how this table proves it is
         measuring the same thing they are). */
console.log("§59 — a note can lean, slide, flam or pass");
{
  const crypto = require("crypto");
  const fp = ev => crypto.createHash("sha1").update(JSON.stringify(ev.map(e =>
    [+e.t.toFixed(6), e.n, e.d, +(e.dur || 0).toFixed(6), e.vel, e.acc, e.sld])))
    .digest("hex").slice(0, 12);
  const ORN = K.ORN;
  // a plain rising-and-falling line: every gated step two apart, so there is
  // always room in front of a note for something to lean into it
  const LINE = {
    deg:  [0, 0, 2, 0, 4, 0, 5, 0, 7, 0, 5, 0, 4, 0, 2, 0],
    oct:  new Array(16).fill(0), vel: new Array(16).fill(6),
    inc:  new Array(16).fill(0), stk: new Array(16).fill(0),
    gate: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    acc:  new Array(16).fill(0), sld: new Array(16).fill(0),
  };
  const withMarks = f => {
    const p = clone(LINE);
    p.orn = new Array(16).fill(0);
    f(p.orn);
    return p;
  };
  // `simple` carries no ornament policy, so anything in ITS stream is the mark
  // and only the mark — the pass cannot be the explanation for what shows up
  const plainG = GENRES.simple;
  const v0 = ev => ev.filter(e => e.v === 0).sort((a, b) => a.t - b.t);
  const base = v0(K.render(LINE, plainG, 1));

  // (a) THE MARKS, one at a time, each read off the RENDERED stream
  {
    const marked = 4;                       // the fifth step, a gated note
    const at = ev => ev.findIndex(e => Math.abs(e.t - base[2].t) < 1e-9);
    ok(base.length === 8, "the test line did not render its eight notes");

    const gr = v0(K.render(withMarks(o => { o[marked] = ORN.grace; }), plainG, 1));
    ok(gr.length === base.length + 1, "a grace mark did not add exactly one note");
    const gi = at(gr);
    ok(gi > 0, "the graced note is not in the stream at its own time");
    const lead = gr[gi - 1];
    ok(lead.orn === "grace", "the note before a graced note is not tagged a grace");
    ok(lead.n !== gr[gi].n, "a grace note is the same pitch as the note it decorates");
    ok(lead.t < gr[gi].t, "the grace does not sound before the beat");
    ok(lead.vel < gr[gi].vel, "the grace is not quieter than its note");
    ok(lead.t + lead.dur <= gr[gi].t + 1e-9, "the grace runs into the note it leads");

    const fl = v0(K.render(withMarks(o => { o[marked] = ORN.flam; }), plainG, 1));
    ok(fl.length === base.length + 1, "a flam mark did not add exactly one note");
    const fi = at(fl);
    ok(fl[fi - 1].orn === "flam", "the note before a flammed note is not tagged a flam");
    ok(fl[fi - 1].n === fl[fi].n, "a flam stroke is NOT the same pitch — that is a grace");
    ok(fl[fi - 1].t < fl[fi].t, "the flam stroke does not sound before the beat");

    for (const [mark, parts] of [[ORN.roll2, 2], [ORN.roll3, 3], [ORN.roll4, 4]]) {
      const rl = v0(K.render(withMarks(o => { o[marked] = mark; }), plainG, 1));
      ok(rl.length === base.length + parts - 1,
         "a roll of " + parts + " did not put " + parts + " strikes in the stream");
      const ri = at(rl), strokes = rl.slice(ri, ri + parts);
      ok(strokes.every(e => e.n === base[2].n),
         "a roll of " + parts + " changed the note's pitch");
      ok(strokes.every(e => e.orn === "roll"),
         "a roll of " + parts + " left a stroke untagged");
      const span = strokes[parts - 1].t + strokes[parts - 1].dur - strokes[0].t;
      ok(span <= base[2].dur + 1e-9,
         "a roll of " + parts + " sounds longer than the note it subdivides");
      // the strokes must not MEET end to end, or a `tie` genre folds the roll
      // straight back into the one long note it came from
      for (let k = 1; k < parts; k++)
        ok(strokes[k].t - (strokes[k - 1].t + strokes[k - 1].dur) > 1e-6,
           "a roll of " + parts + " has strokes that meet end to end");
    }
    // ...and an unmarked phrase is the phrase, exactly
    ok(fp(v0(K.render(withMarks(() => {}), plainG, 1))) === fp(base),
       "an all-zero orn vector is not the same as no orn vector");
  }

  // (b) THE MARKS BEAT THE PASS. blues declares grace and pass; mark every
  // gated step a FLAM and the stream must carry flams and nothing else.
  {
    const g = GENRES.blues;
    ok(!!g.orn, "blues lost its ornament policy — this check would pass vacuously");
    const loose = K.render(LINE, g, 4).filter(e => e.orn);
    ok(loose.length > 0, "blues' own ornament pass produced nothing to be beaten");
    const allFlam = withMarks(o => { for (let i = 0; i < 16; i++) if (LINE.gate[i]) o[i] = ORN.flam; });
    const tags = new Set(K.render(allFlam, g, 4).filter(e => e.orn).map(e => e.orn));
    ok(tags.size === 1 && tags.has("flam"),
       "the genre pass ornamented a step the hand had already marked: " +
       [...tags].join("/"));
  }

  // (c) DETERMINISM, and the seed is what decides it
  {
    for (const gk of ["jazz", "gregorian", "drill", "funk"]) {
      const g = GENRES[gk];
      const a = K.render(P, g, 4), b = K.render(P, g, 4);
      ok(JSON.stringify(a) === JSON.stringify(b),
         gk + ": two renders of one state are not identical — the pass is not seeded");
      ok(a.some(e => e.orn), gk + ": an ornament policy that reaches no note at all");
    }
    const j = GENRES.jazz;
    ok(fp(K.render(P, j, 4)) !== fp(K.render(P, { ...j, kitSeed: (j.kitSeed | 0) + 1 }, 4)),
       "jazz ornaments identically at two different seeds — the dice are not thrown");
    // every term must reach the stream on its own, or it is a dead field
    for (const [term, tag] of [["pass", "pass"], ["approach", "approach"],
                               ["grace", "grace"], ["flam", "flam"], ["roll", "roll"]]) {
      const g = { ...plainG, orn: { [term]: 1 } };
      ok(K.render(P, g, 4).some(e => e.orn === tag),
         "the `" + term + "` term never reaches the rendered stream");
    }
  }

  // (c2) THE CARVE-OUT IS ONE WORD WIDE. §9 forbids a pitch class outside the
  // bar's own alphabet and now lets `approach` past, because a chromatic
  // lead-in is outside by definition. That exemption is only honest if nothing
  // ELSE this file emits is outside — so the same containment is re-proved
  // here for every other tag, on every genre that ornaments, against the same
  // set §9 builds. If a grace or a passing tone ever leaves the key, it fails
  // HERE rather than sliding through the hole the approach needed.
  {
    let checked = 0;
    for (const gk of Object.keys(GENRES)) {
      const g = GENRES[gk];
      if (!g.orn) continue;
      const sc = g.scale || K.PENT, bs = 16 / g.rate;
      for (let b = 0; b < g.bars; b++) {
        const root = (g.harmony === "cycle" && !g.diatonic)
          ? K.mp(K.harm(P, g, b), g.mode || undefined) : 0;
        const allowed = new Set(sc.map(x => (((x + root) % 12) + 12) % 12));
        if (g.harmony === "cycle")
          for (const c of K.chordsOf(P, g, b))
            for (const n of c.pcs) allowed.add(((n % 12) + 12) % 12);
        const bad = K.render(P, g, g.bars)
          .filter(e => e.orn && e.orn !== "approach" && Math.floor(e.t / bs) === b)
          .filter(e => !allowed.has(((e.n % 12) + 12) % 12));
        checked++;
        ok(bad.length === 0, gk + " bar " + (b + 1) + ": a " +
           (bad[0] || {}).orn + " ornament left the bar's alphabet");
      }
    }
    ok(checked > 40, "the containment law was checked on almost nothing (" + checked + ")");
  }

  // (d) NOTHING MOVED. Measured on the kernel at HEAD 7fc30e9, the commit
  // before the ninth type existed, over the same allEvents() recipe §39 uses.
  // A genre appears here because it has NO ornament policy: the whole claim of
  // this lane is that such a genre is untouched, and a hash is the only way to
  // say that out loud. If a row moves, either an ornament leaked into a genre
  // that declared none, or somebody gave it a policy and owes this table a
  // re-measurement with an argued reason — it does not get weakened.
  {
    const FROZEN = {
      // (acoustic-kit rows re-measured 2026-08-19: the HAND LAW — an
      // acoustic kit is played by a hand by default, so these rows moved
      // by argument; the machine rows did not move, which is the law
      // proving itself.) simple: "47f696fee4b2", ambient: "1a68804b1e4a",
      drone: "977ce5507005", vaporwave: "e816f4b25c7d", kraftwerk: "da1af676f72d",
      disco: "cd4fbb90a180", rnb: "df510d2bdb36", dub: "a3a70994da87",
      bossa: "569bc9a76144", synthpop: "58bff8df43db", shoegaze: "e30c4bfa2fa0",
      citypop: "29be11ac1a88", newwave: "95d03b9fb4fe", doowop: "90898fe89360",
      minimalism: "560d7e0977bc", toto: "7df4e47e134e", beatles: "66d29703ad8e",
      steely: "c05013ed477b", postrock: "ba4c7a772eff", neoclassical: "497406f3443e",
      // §39's five machines, at the same values that section freezes them at —
      // which is what says this table and that one are measuring one thing
      techno: "036036ec46ed", acid: "6442d27c8bfb",   // acid re-measured 2026-08-18 (kitVel hand; no orn policy)
      house: "2f1c41112ac0",
      trap: "addcf7d93d0f", electro: "1b4dccccfb12",
      pad: "8fc2877a4554", riff: "b70f7f837d8d", vocal: "18fdd7ab8497",
      backing: "e0cbb6146f64" };
    for (const gk of Object.keys(FROZEN)) {
      const g = GENRES[gk];
      ok(!g.orn, gk + ": now carries an ornament policy — this row is a claim " +
         "that it does not, and one of the two is wrong");
      ok(fp(allEvents(P, g, Math.max(4, g.bars))) === FROZEN[gk],
         gk + ": a genre with no ornament policy no longer renders what it " +
         "rendered before the ninth type existed");
    }
    // and the pass itself is a no-op for them, object-identically: `ornament`
    // hands back the very array it was given rather than a rebuilt copy
    const arr = [{ t: 0, n: 60, dur: 1, v: 0, vel: 5 }];
    ok(K.ornament(arr, plainG, { stepsPerBar: 16, rate: 4, pcs: null }) === arr,
       "the ornament pass rebuilt the stream for a genre that has no policy");
  }
  console.log("  59: marks, the genre pass, and " +
              Object.keys(GENRES).filter(k => GENRES[k].orn).length +
              " genres that ornament");
}


/* §62 WAS THE DESK IS THREE BUSES AND A FADER — the node-level proof that
   audio/mixer.js built the strip it declared, against a stub AudioContext that
   counted the nodes (one engine, 2026-08-18). There is no channel strip to
   count: the desk is a model that writes level, pan, sends and tone onto the
   parent's own voice units, and the buses are the parent's four
   (render-core's { dry, rev, del, pp }). What the board's numbers mean is
   gated at the model in §47, and the mapping onto the parent is §76. */

/* ---------------------------------------------------------------- 63. THE KEY
   "How do I change key? … There should be a variety of keys … defaulting per
   genre … I should be able to change keys … occasionally … songs should
   change keys" (Paul). fields.js widened `key` from a truck-driver's ±few to
   the full twelve tonics (plus a real "minor" chip beside the modal ones);
   compose.js derives a genre's own tonic and occasionally moves off it. Every
   claim below is read off the RENDERED score, through the REAL ui/derive.js
   (§31's own law) — never off the saved box. */
console.log("a song knows what key it is in, and sometimes it decides to move");
{
  const NF = require("../../nukernel/fields.js");
  const NS2 = require("../../nukernel/song.js");
  const C = require("../../nukernel/compose.js");

  // (a) TRANSPOSITION IS EXACT. fields.js's own claim is that `key` is added
  // in the kernel AFTER registration, so a phrase (degrees, never absolute
  // pitches) cannot be broken by it — that was already true before this
  // round; this reads it off K.render rather than assuming it, the way every
  // other claim in this gate does.
  {
    const G = GENRES.beatles;
    const at0 = K.render(P, { ...G, key: 0 }, 4);
    const at5 = K.render(P, { ...G, key: 5 }, 4);
    ok(at0.length > 0 && at0.length === at5.length,
       "changing the key changed which notes played, not just their pitch");
    ok(at0.every((e, i) => {
      const f = at5[i];
      return f && Math.abs(f.t - e.t) < 1e-9 && f.dur === e.dur && f.v === e.v &&
             f.vel === e.vel && f.acc === e.acc && f.sld === e.sld && f.n === e.n + 5;
    }), "key +5 did not transpose every note by exactly 5 semitones and nothing else");
  }

  // (b) fields.js's own widened table: the old seven values kept their exact
  // meaning (a save from before this round still plays the note it always
  // played), and it now spans a real octave with a name on every one of them.
  {
    const old = { "-3": -3, "-2": -2, "-1": -1, "1": 1, "2": 2, "3": 3, "4": 4 };
    ok(Object.keys(old).every(k => NF.KEYS[k] === old[k]),
       "a pre-existing saved key value changed meaning");
    ok(Object.keys(NF.KEYS).length === 12 &&
       new Set(Object.values(NF.KEYS).map(v => ((v % 12) + 12) % 12)).size === 12,
       "the tonic picker is not the full twelve");
    ok(NF.KEYLABEL["0"] === "C" && /^[A-G]/.test(NF.KEYLABEL["-6"]),
       "a tonic chip carries jargon instead of a note name");
  }

  // (c) A SONG WITH NO KEY SET IS BYTE-IDENTICAL TO BEFORE. skeleton()'s own
  // default is unchanged (null, "as the genre asks"), and an absent key still
  // renders exactly as an explicit 0 does — the house law §33 already holds
  // for every other field, read here for this one.
  {
    const gk = "isley";
    const b = NS2.skeleton(gk, "verse"); b.stack[0].slots = [0];
    ok(b.key === null, "skeleton()'s own default for key moved off null");
    const evNull = D.sectionEvents(b, [P]).ev;
    const ev0 = D.sectionEvents({ ...b, key: 0 }, [P]).ev;
    ok(evNull.length > 0 && JSON.stringify(evNull) === JSON.stringify(ev0),
       "an absent key no longer renders identically to an explicit 0");
  }

  // (d) A SECTION KEY CHANGE LANDS ON THE SECTION BOUNDARY, NOT A BAR EARLY.
  // Two independent sections — a plain verse and a bridge modulated a minor
  // third up — each rendered whole. If the modulation leaked a bar early it
  // would show up as a mismatch inside the verse's OWN last bar; if it landed
  // late it would show up in the bridge's first. Neither happens: every note
  // of the bridge, including its very first, sits exactly a minor third above
  // the same step of the (unmodulated) verse — the whole box moves together,
  // by construction, because `key` is one value for the section's whole
  // window and not a per-bar fact.
  {
    const gk = "isley";
    const secA = NS2.skeleton(gk, "verse"); secA.stack[0].slots = [0]; secA.len = 4;
    const secB = NS2.skeleton(gk, "bridge"); secB.stack[0].slots = [0];
    secB.len = 4; secB.key = 3;
    const line = b => D.sectionEvents(b, [P]).ev
      .filter(e => e.kind === "line" && e.n != null)
      .sort((x, y) => x.t - y.t || x.v - y.v);
    const evA = line(secA), evB = line(secB);
    ok(evA.length > 0 && evA.length === evB.length,
       "the two sections did not render the same shape of events");
    ok(evA.every((e, i) => Math.abs(evB[i].t - e.t) < 1e-9 && evB[i].n === e.n + 3),
       "the bridge's key did not land uniformly across its whole length " +
       "(a bar early or a bar late from the boundary)");
  }

  // (e) A MODULATING GENRE MODULATES DETERMINISTICALLY. "beatles" is a
  // song-plan genre with both a peak chorus (the truck-driver +2) and a
  // harmonically functional bridge (the relative-minor gesture) — the two
  // places compose.js ever moves a box off the song's own key. Composing the
  // same (genre, seed) twice must choose the same keys both times.
  {
    const gk = "beatles";
    for (const seed of [3, 11, 42]) {
      const keysOf = () => C.compose(gk, seed).song.map(b => (b.key == null ? null : b.key));
      const k1 = keysOf(), k2 = keysOf();
      ok(JSON.stringify(k1) === JSON.stringify(k2),
         gk + "/" + seed + ": composing twice at one seed picked different keys");
    }
  }

  // (f) …AND IT IS NEVER GRATUITOUS AND NEVER ABSENT. Across forty seeds of a
  // song-plan genre, some records modulate and some do not — the "occasional"
  // Paul asked for, measured rather than assumed.
  {
    const gk = "beatles";
    let moved = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const song = C.compose(gk, seed);
      const base = song.song[0].key;
      if (song.song.some(b => b.key !== base)) moved++;
    }
    ok(moved > 0 && moved < 40,
       gk + ": key changes are either never gratuitous nor never happen (" +
       moved + "/40)");
  }

  // (g) A GENRE DECLARES THE KEY IT LIVES IN — not the same one every time.
  // Two different genres get two different tonics far more often than one in
  // twelve genres would collide by chance, and one genre's tonic is stable
  // across every seed (a record does not re-key itself between takes).
  {
    const sample = ["beatles", "isley", "rock", "simple", "jazz", "dub", "punk"]
      .filter(gk => GENRES[gk]);
    const tonics = sample.map(gk => C.compose(gk, 1).song[0].key);
    ok(new Set(tonics).size > 1,
       "every sampled genre defaulted to the same tonic (" + tonics.join(",") + ")");
    for (const gk of sample) {
      const t1 = C.compose(gk, 1).song[0].key, t2 = C.compose(gk, 9).song[0].key;
      ok(t1 === t2, gk + ": the genre's own default key moved between seeds");
    }
  }

  // (h) THE MAJOR/MINOR CHIP. "minor" is a real, choosable value now (not
  // just an absent field reading as one) and it OVERRIDES a genre's own
  // colour, the way every other explicit chip does — read on newwave, the one
  // shipped anchor whose own mode is not natural minor (mixolydian).
  {
    // its VALUE is unused by design (fields.js's own note) — what the picker
    // and song.js's okEnum both need is the KEY, and that is what this checks
    ok(Object.prototype.hasOwnProperty.call(NF.KEYMODES, "minor"),
       "'minor' is not a legal value of the key-mode field");
    const gk = "newwave", secOwn = NS2.skeleton(gk, "verse");
    secOwn.stack[0].slots = [0]; secOwn.len = 4;
    const secMinor = { ...secOwn, mode: "minor" };
    const own = D.sectionEvents(secOwn, [P]).ev.filter(e => e.kind === "line" && e.n != null);
    const min = D.sectionEvents(secMinor, [P]).ev.filter(e => e.kind === "line" && e.n != null);
    ok(own.length && min.length &&
       JSON.stringify(own.map(e => e.n)) !== JSON.stringify(min.map(e => e.n)),
       "choosing 'minor' on a genre with its own mode changed nothing");
  }

  console.log("  63: a variety of keys, a genre's own default, a modulation " +
              "that lands on the boundary and never happens twice by accident");
}

/* ---------------------------------------------------------------- 64. THE DRUM PHRASE
   Lane C3, built on lanes C1/C2's own infrastructure (the plain editor, the
   `orn` marks): a phrase can be a DRUM PATTERN now — kernel.js kind:"drum",
   a lane grid (DRUM_LANES) of composite marks (DMARK: hit/accent/ghost/flam/
   roll of two-three-four, four of the eight values literally `orn`'s own) —
   instead of a melodic line. Dropped into a section's lead slot it OVERRIDES
   that section's genre kit for exactly its own bars; taken back out, the
   genre's own kit plays again. Every claim below is read off the RENDERED
   score, through the REAL ui/derive.js sectionEvents (§31's own law), never
   off the saved phrase or box. */
console.log("a drum phrase is a phrase you can hear the machine in, and it takes the kit");
{
  const NS64 = require("../../nukernel/song.js");
  const hitsOf = ev => ev.filter(e => e.kind === "hit");
  const lanesOf = ev => [...new Set(ev.map(e => e.d))].sort();
  // a genre whose own kit is known to voice more than the two lanes the drum
  // phrase below writes, so "the genre's own lane is gone" is a real claim
  const gk = GENRES.dnb && GENRES.dnb.kit && GENRES.dnb.kit.h ? "dnb"
    : GK.find(g2 => GENRES[g2].kit && GENRES[g2].kit.h && GENRES[g2].kit.k);
  const baseBox = () => { const b = NS64.emptyBox(); b.stack[0].g = gk; b.len = 4; return b; };
  const genreKit = hitsOf(D.sectionEvents(baseBox(), []).ev);
  ok(genreKit.length && lanesOf(genreKit).includes("h"),
     gk + ": no genre-kit baseline to override (no hats in its own kit)");

  // (a) THE OVERRIDE IS TOTAL. A drum phrase in the lead slot plays ONLY its
  // own lanes — none of the genre's, including the hats every bar of its own
  // kit carries — and every hit lands on the lane and step the phrase wrote.
  {
    const dp = NS64.blankDrum();
    dp.k = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    dp.s = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
    const b = baseBox(); b.stack[0].slots = [0];
    const ev = hitsOf(D.sectionEvents(b, [dp]).ev);
    ok(ev.length > 0 && lanesOf(ev).join(",") === "k,s",
       "a drum phrase's lanes did not replace the genre kit's (" + lanesOf(ev).join(",") + ")");
    ok(!ev.some(e => e.d === "h"),
       "the genre's own hat kept sounding under a drum phrase");
    // the phrase's own steps, not the genre's rhythm: a kick on every 4th
    // sixteenth, four bars of it — read at the genre's own rate rather than
    // assumed, since a drum phrase's sixteen steps still play at g.rate
    const gRate = D.genreOf(b, b.stack[0]).rate, period = 16 / gRate;
    const kSteps = new Set(ev.filter(e => e.d === "k").map(e => e.t % period));
    const want = [0, 4, 8, 12].map(s => s / gRate);
    ok(kSteps.size === 4 && want.every(t => kSteps.has(t)),
       "the drum phrase's own kick pattern did not reach the score (" +
       [...kSteps].join(",") + " vs " + want.join(","));
  }

  // (b) REMOVE IT AND THE GENRE'S OWN KIT COMES BACK, byte for byte — the
  // SAME box, drum phrase taken back out of the slot, against a box that
  // never held one at all.
  {
    const held = baseBox(); held.stack[0].slots = [0];
    const dp = NS64.blankDrum(); dp.k[0] = 1;
    const withPhrase = hitsOf(D.sectionEvents(held, [dp]).ev);
    ok(withPhrase.length && lanesOf(withPhrase).join(",") === "k",
       "setup: the held drum phrase did not override anything to remove");
    held.stack[0].slots = [];                 // take it back out
    const removed = D.sectionEvents(held, [dp]).ev;
    const neverHad = D.sectionEvents(baseBox(), []).ev;
    ok(removed.length && JSON.stringify(removed) === JSON.stringify(neverHad),
       "taking the drum phrase out of the slot did not restore the genre's " +
       "own kit byte-for-byte");
    // and a MELODIC phrase in that same slot renders the genre's kit too —
    // the override is the phrase's KIND, not the slot it sits in
    const bMel = baseBox(); bMel.stack[0].slots = [0];
    const melodicInSlot = D.sectionEvents(bMel, [NS64.blank()]).ev;
    ok(lanesOf(hitsOf(melodicInSlot)).includes("h"),
       "a melodic phrase in the lead slot did not render the genre's own kit");
  }

  // (c) ACCENT, FLAM AND ROLL EACH CHANGE THE SCORE AS CLAIMED, read through
  // the same sectionEvents pipeline (a) and (b) used, not off K.drums alone.
  {
    const K64 = require("../../nukernel/kernel.js");
    const mk = mark => { const dp = NS64.blankDrum(); dp.s[4] = mark; return dp; };
    const b = baseBox(); b.stack[0].slots = [0];
    const hitOf = (mark, at) => hitsOf(D.sectionEvents(b, [mk(mark)]).ev)
      .filter(e => e.d === "s" && Math.abs(e.t - at) < 0.9);

    const normal = hitOf(K64.DMARK.HIT, 4);
    ok(normal.length === 1 && normal[0].vel === 5 && !normal[0].acc,
       "a plain hit mark did not render as one ordinary hit");

    const accent = hitOf(K64.DMARK.ACCENT, 4);
    ok(accent.length === 1 && accent[0].acc === true && accent[0].vel > normal[0].vel,
       "the accent mark did not raise the level or flag the accent");

    const ghost = hitOf(K64.DMARK.GHOST, 4);
    ok(ghost.length === 1 && ghost[0].vel < normal[0].vel,
       "the ghost mark did not lower the level");

    const flam = hitOf(K64.DMARK.FLAM, 4);
    ok(flam.length === 2 && flam.some(e => e.grace) && flam.some(e => !e.grace),
       "a flam did not add a quieter grace hit ahead of the beat (" +
       JSON.stringify(flam) + ")");

    const roll3 = hitOf(K64.DMARK.ROLL3, 4);
    ok(roll3.length === 3 && roll3.every(e => e.roll === 3) &&
       new Set(roll3.map(e => e.t)).size === 3,
       "a roll of three did not strike three times inside the step (" +
       JSON.stringify(roll3.map(e => e.t)) + ")");
  }

  // (d) A DRUM PHRASE SURVIVES SAVE AND LOAD — song.js's own path, not a
  // hand-rolled shortcut around it: migrate() then validateSong(), same as
  // any file this build opens.
  {
    const dp = NS64.blankDrum();
    dp.k[0] = 1; dp.s[4] = 2; dp.h = new Array(16).fill(1); dp.h[3] = 4;
    dp.swing = 2;
    const raw = { v: NS64.VERSION, slots: [dp], song: [
      { stack: [{ g: gk, slots: [0] }], len: 4, nudge: 0, ops: [], fx: [] } ] };
    const { ok: loadedOk, song, errors } = NS64.validateSong(NS64.migrate(raw));
    ok(loadedOk, "a song holding a drum phrase failed to load: " +
       JSON.stringify(errors[0]));
    const back = song && song.slots[0];
    ok(back && back.kind === "drum" && back.swing === 2 &&
       JSON.stringify(back.k) === JSON.stringify(dp.k) &&
       JSON.stringify(back.h) === JSON.stringify(dp.h),
       "the drum phrase did not round-trip through save/load intact");
  }

  // (e) THE OPS CHOKE POINT HOLDS. A box's `ops` chips are melodic-line
  // transforms (kernel.js word()) that a drum phrase has no deg/gate for —
  // they must pass over it rather than reach into it, at the one place
  // (word()) rather than a second guard in the scheduler.
  {
    const dp = NS64.blankDrum(); dp.k = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    const b = baseBox(); b.stack[0].slots = [0]; b.stack[0].ops = ["rev"];
    let threw = false, ev = [];
    try { ev = hitsOf(D.sectionEvents(b, [dp]).ev); } catch (e) { threw = true; }
    ok(!threw, "an 'ops' chip crashed rendering a drum phrase's lead slot");
    ok(ev.length && lanesOf(ev).join(",") === "k",
       "an 'ops' chip changed which lanes a drum phrase plays");
  }

  console.log("  64: a drum phrase overrides the kit and only the kit, " +
              "accent/flam/roll reach the score, it survives an ops chip, " +
              "and it saves and loads whole");
}

/* §65 WAS COMING BACK FROM THE TAPE and §66 WAS THE LOAD CHIP'S ARITHMETIC
   (one engine, 2026-08-18). Both were about the SEAM between two engines: a
   rendered carrier handing the ear back to a live WebAudio graph, and a monitor
   measuring how much of the live scheduler's budget that graph had burned.
   There is no handback, because there is nothing to hand back to — the parent
   engine is the only thing making sound, and its own route (ring or media) is
   its choice to make and to report (audio/live.js routeNote). Its load ratio is
   the number the chip reads now, and it is measured where the rendering
   happens rather than by a timer on this page. The lessons those sections were
   written from live in the parent: docs/WAV-FIRST.md, docs/history/ZERO-STATIC.md
   and the browser gates over engine/faust/live/. */

/* §68 WAS TWENTY-THREE MORE ROOMS — the reverb, echo and character-effect
   buses audio/graph.js built for this page (one engine, 2026-08-18). The rooms
   are the parent's: five reverbs, fx_bus, master_mb and master_limit, resolved
   by SE.reverbColor / SE.fxParams / SE.masterMb from the state the stream was
   opened with, and gated in the engine that renders them. What nukernel keeps
   is the SURFACE — a box says how wet it is and the desk writes that onto the
   unit's own `rev` and `del` (audio/desk.js deskUnits). §76 holds the absence
   of the second set. */

/* §69 WAS THE VOICE'S GRIT AND THE HORN'S TREMOLO, built as a WebAudio chain
   in audio/graph.js and cached per chair in audio/voices.js (one engine,
   2026-08-18). Both files are gone. The feature is not: per-voice character is
   the parent's STRIP stage inside its own note chain (state-engine
   STRIP_PROFILES -> sampler.js SamplerLive), which is where nukernel's desk
   now writes its tone (audio/desk.js stripWith). One stage, gated once, in the
   engine that renders it. */

/* (§70 was the vocal polyphony — doubles, octaves, harmony parts and the
   deterministic lean that keeps a double from summing to +6 dB. It was built
   on the espeak singer and went out with it on 2026-08-17.) */

/* §71 THE MACHINES GET PLAYED BY THE MACHINES. Lane G2's own check
   (2026-08-17): five anchors whose identity is a specific synthesizer
   (motorik/roboticpop/ebm on the Model D, synthduo on a Juno-60, bigroom's
   drop lead on a supersaw) play it instead of a sampled stand-in wearing
   its name — the same law §68(f) proved for the batch before this one.
   (The round also gave 84 idioms a declared SINGER, and (b) below held them
   to it; both the singers and the check went out with the espeak organ.)

   Two claims, both at the SCORE level (the audio half is a one-time offline
   render read back as decoded PCM, reported alongside this file, not inside
   it — a node gate cannot open an AudioContext):
     (a) EVERY GENRE STILL RENDERS — the whole catalog, not just the 84 that
         changed, on the same [render, drums, bass] walk §58/§68 already use.
     (c) EVERY SYNTH FIELD REACHES A BUILT MODULE — the five new ones by name,
         and the other ten already in the table, so a typo in `dsp` cannot
         hide behind "someone else's genre passed this before". */
console.log("the catalog renders, and the machines get played by the machines");
{
  const fs71 = require("fs"), path71 = require("path");

  // ---- (a) NOTHING WENT SILENT. All 110, this genre's own bar count, the
  // catalog-wide walk — a synth-field typo that made driveSynth throw would
  // show up here as an exception, not just as dropped notes. GK_FULL: this
  // IS the coverage walk that catches a genre throwing on write — a sample
  // proves the sampled genres render, not that nothing was missed.
  let rendered = 0;
  for (const gk of GK_FULL) {
    const g = GENRES[gk], bars = Math.max(4, g.bars);
    let ev;
    try { ev = allEvents(P, g, bars); }
    catch (e) { ok(false, gk + ": allEvents threw — " + e.message); continue; }
    ok(ev.length > 0, gk + ": renders silent at " + bars + " bars");
    rendered++;
  }
  ok(rendered === GK_FULL.length, "§71(a) " + (GK_FULL.length - rendered) + " genres never reached the render walk");

  // ((b) held the 84 armed singers to their own boxes. It went out with the
  // espeak organ on 2026-08-17 — nukernel/kernel-daw.html has the tombstone.)

  // ---- (c) EVERY `synth` FIELD NAMES A REAL, BUILT FAUST MODULE. The five
  // this round added, checked by name and by dsp — a genre whose identity IS
  // a machine (Paul's note) has to actually reach that machine.
  const NEW_SYNTH71 = { motorik: "modeld", roboticpop: "modeld", ebm: "modeld",
    synthduo: "juno60", bigroom: "supersaw" };
  for (const [gk, dsp] of Object.entries(NEW_SYNTH71))
    ok(GENRES[gk].synth && GENRES[gk].synth.dsp === dsp,
       gk + ": synth.dsp is \"" + (GENRES[gk].synth && GENRES[gk].synth.dsp) +
       "\", expected \"" + dsp + "\"");
  const distDir71 = path71.join(__dirname, "../../engine/faust/dist");
  // GK_FULL: "exactly 15" is a fact about the whole catalog, not the sample
  const allSynth71 = GK_FULL.filter(gk => GENRES[gk].synth);
  ok(allSynth71.length === 15, "§71(c) the synth-bearing roster drifted from 15: " + allSynth71.length);
  for (const gk of allSynth71) {
    const spec = GENRES[gk].synth;
    // every DX7 alg module addresses its params at /DX7/... regardless of
    // which algorithm compiled it (VOICES.md's own dx7 contract) — root
    // "DX7" is the one deliberate exception to "root names its own dsp"
    ok(spec.root === spec.dsp || (spec.dsp.startsWith("dx7_") && spec.root === "DX7"),
       gk + ": synth.root \"" + spec.root + "\" matches neither synth.dsp nor the DX7 address");
    ok(fs71.existsSync(path71.join(distDir71, spec.dsp + "-module.wasm")),
       gk + ": " + spec.dsp + "-module.wasm is not a built Faust module");
    ok(fs71.existsSync(path71.join(distDir71, spec.dsp + "-meta.json")),
       gk + ": " + spec.dsp + "-meta.json is not a built Faust module");
    for (const [k, v] of Object.entries(spec.set || {}))
      ok(typeof v === "number" && isFinite(v), gk + ": synth.set." + k + " is not a finite number");
    // the lineOnly ones (synthduo, bigroom) must leave a pad voice sampled —
    // that is the whole reason lineOnly exists rather than a whole-genre swap
    if (spec.lineOnly) {
      const g = GENRES[gk];
      let hasPad = false;
      for (let v = 0; v < g.voices; v++) if (g.realize(v) === "pad") hasPad = true;
      ok(hasPad, gk + ": carries lineOnly but has no pad voice for it to protect");
    }
  }

  console.log("  71: " + rendered + " genres render, and " + allSynth71.length +
              " synth fields (5 new) all reach a built Faust module");
}

/* §72 WAS THE BREATH LFO, and it is the parent's breath now (one engine,
   2026-08-18). Its one surviving check read audio/graph.js for a per-context
   WeakMap cache on the tremolo oscillators — a bug that could only exist in a
   page that built its own oscillators for its own bounce. There is one engine
   and one context; per-voice character is engine/faust/voices/sampler.js's
   STRIP stage, gated where it lives. §76 holds the absence. */

/* §73 WAS THE CARRIER, and the carrier is gone (2026-08-17). It held the
   arithmetic of audio/stream-carrier.js — the overlap-add join, the µs->sample
   conversion, the running tfdt — for an architecture that was cancelled: the
   second lane never shipped, nothing imported the file, and the tape that DID
   ship (audio/bounce.js) muxes against engine/faust/codec/fmp4.js directly and
   carries its own seam handling. The device lessons those checks were written
   from are not lost — they live in the parent muxer and in its own node gate,
   test/unit/fmp4.test.js, which is where they were always really held. */


/* §74 THE SINGER IS GONE, and this one line is the whole check (2026-08-17).
   nukernel had an espeak singer — sing.js planned the syllables, audio/sing.js
   synthesized and vocoded them, syllabary.js held the words — and it was
   removed whole because engine/speech.js builds a fresh Emscripten heap per
   utterance (the determinism law: espeak's wavegen consumes libc rand()) and
   a 127-syllable song took Safari out of memory mid-bar. A gate for a deleted
   organ is dead weight; a gate that proves it is DELETED is worth a line,
   because the way this comes back is somebody re-wiring it without reading
   why. The PARENT's organ is untouched and still sings on stellate.app —
   engine/speech.js, gated by test/gates/speech.test.js. */
console.log("the singer is gone, and the parent still sings");
{
  const fs74 = require("fs"), path74 = require("path");
  const has = (p) => fs74.existsSync(path74.join(__dirname, "../..", p));
  for (const f of ["nukernel/sing.js", "nukernel/audio/sing.js",
                   "nukernel/syllabary.js"])
    ok(!has(f), f + " is back — the espeak singer was removed on purpose");
  const html = fs74.readFileSync(
    path74.join(__dirname, "../../nukernel/kernel-daw.html"), "utf8");
  // a <script src>, not the word: the tombstone comment beside it NAMES the
  // file on purpose, and a check that could not tell the two apart would be
  // fixed by deleting the explanation
  ok(!/<script[^>]+speech\.js/.test(html),
     "kernel-daw.html loads the parent's speech organ again — nukernel does not sing");
  ok(has("engine/speech.js"),
     "the PARENT's speech organ went missing — this round must not have touched it");
  console.log("  the singer is out of nukernel; engine/speech.js is untouched");
}


/* ---------------------------------------------------------------- 75. THE MIRROR
   THE PAGE AND THE TAPE PLAY THE SAME INSTRUMENT, or they do not.

   The live scheduler now asks to-engine.js patchForInstr for a chair's voice
   exactly as the press walk does, so a genre casting a clean guitar gets the
   parent's amp on both paths. Three tables decide what that instrument DOES
   with a note, and they live in the parent (engine/faust/voices/state-engine.js
   MODEL_DYN, VOICE_TYPE and the vowel alphabet) because the press resolves them
   there. The page cannot read them: kernel-daw.html loads no state-engine — the
   press walk runs in a worker — so to-engine.js mirrors the rows.

   A mirror is a copy, and a copy drifts silently: change the plectrum range in
   the parent and the tape gets a new guitar while the page keeps the old one,
   and nothing fails. So the mirror is held against the parent's own source text
   (§44's idiom, for §44's reason) through the SPEC A NOTE IS ACTUALLY PLAYED
   WITH, not through a private export — the artifact, not the intent. */
console.log("the mirror — the page's physical controls are the parent's own");
{
  const fs75 = require("fs"), path75 = require("path");
  const M75 = await import("../../nukernel/audio/to-engine.js");
  const se75 = fs75.readFileSync(
    path75.join(__dirname, "../../engine/faust/voices/state-engine.js"), "utf8");
  const litOf = (re) => { const m = se75.match(re); return m ? new Function("return {" + m[1] + "}")() : null; };
  const DYN = litOf(/const MODEL_DYN = \{([\s\S]*?)\n  \};/);
  const VT = litOf(/const VOICE_TYPE = \{([\s\S]*?)\n  \};/);
  const VW = (se75.match(/const VOWELS = "([a-z]+)";/) || [])[1];
  ok(DYN && VT && VW, "cannot find MODEL_DYN / VOICE_TYPE / VOWELS in state-engine.js — " +
     "the mirror below is unheld, and a drift in either copy is now silent");

  // (a) the physical control, per module — asked through a chair that casts it
  const CAST = { stk_guitar: "clean_guitar", stk_piano: "yamaha_grand_piano",
                 mallet: "vibraphone",
                 voice_lead: "solo_vox" };
  // ...AND THE MODULES THE PAGE DELIBERATELY DOES NOT CAST. voice_choir is the
  // parent's four-singer chorale and nukernel no longer reaches it from any
  // instrument id: Paul, 2026-08-18, "use sampled choruses for choral
  // arrangements", so ahh_choir/ohh_voices/space_voice fall through to the
  // sampled library. The dyn row upstairs is still correct and still the
  // parent's; it is simply not this page's to play. Named here rather than
  // deleted from the table above, so that "the parent grew a dyn row nobody
  // casts" keeps catching the case it was written for — a module arriving with
  // no chair by accident — instead of being blunted to let this one through.
  const UNCAST = new Set(["voice_choir"]);
  for (const dsp of Object.keys(DYN || {})) {
    if (UNCAST.has(dsp)) continue;
    const id = CAST[dsp];
    ok(id, "the parent grew a dyn row for \"" + dsp + "\" and no nukernel chair casts it — " +
       "either wire it or this table is telling the page about an instrument it cannot play");
    if (!id) continue;
    const sp = M75.patchForInstr(id, GENRES.blues.tone, false);
    ok(sp && sp.dsp === dsp, id + " no longer patches to " + dsp);
    const mine = (sp && sp.live && sp.live.dyn) || {};
    ok(JSON.stringify(mine) === JSON.stringify(DYN[dsp]),
       dsp + ": the page plays " + JSON.stringify(mine) + " where the tape plays " +
       JSON.stringify(DYN[dsp]) + " — one note, two instruments");
  }

  // (b) who is singing, and how high they go: every voice type the parent knows,
  // asked through a mouth that names it
  for (const [name, row] of Object.entries(VT || {})) {
    const sp = M75.patchForInstr("solo_vox", { mouth: { voice: name } }, false);
    const L = (sp && sp.live) || {};
    ok(L.voice === row.n, "voice type " + name + " is index " + L.voice +
       " on the page and " + row.n + " on the tape — the page sings through another throat's formants");
    ok(L.lo === row.lo && L.hi === row.hi,
       name + ": the page folds into " + L.lo + "-" + L.hi + " Hz and the tape into " +
       row.lo + "-" + row.hi + " — the same line lands an octave apart");
  }

  // (c) the vowel alphabet, in the parent's own order
  const wk = M75.patchForInstr("solo_vox", { mouth: { vowels: VW } }, false);
  ok(JSON.stringify((wk && wk.live && wk.live.vowels) || []) ===
     JSON.stringify([...(VW || "")].map((_, i) => i)),
     "the page spells the vowels \"" + VW + "\" in a different order than the formant tables do");
}

/* ---------------------------------------------------------------- 76. ONE ENGINE
   Paul, three times, and finally in the plainest terms: "Are you reusing the
   scheduler and audio engine we built Claude or making yet another one … It's
   not even that hard!!!! They're the same except for the buses but those are
   trivial."

   He was right and the measurement agreed. nukernel had grown a SECOND ENGINE
   beside engine/faust/ — 7,753 lines of it:

     audio/transport.js   735   its own scheduler      vs live/live.js
     audio/mixer.js      1184   its own channel strips vs the Faust bus structure
     audio/graph.js      1395   its own master+reverbs vs fx_bus + reverb_*.dsp
     audio/bounce.js     2165   its own render         vs press/render-core.js
     audio/voices.js     1204   its own voice routing
     audio/assets.js      219   its own zone decode    vs sampler.js
     audio/survival.js    296   its own pocket survival vs the WAV-FIRST path
     audio/press-*.js     555   its own press driver

   and every bug of the two days before this round was a SEAM between the two:
   the desk absent from the tape, drums playing a different 606 on each path,
   velocity meaning a filter on one side and a fader on the other, and a render
   that never completed on WebKit — which killed the tab on iOS, because an
   OfflineAudioContext there cannot build a Faust worklet and nothing bounded
   the retry.

   This section is what stops it growing back. Four claims, all readable in
   node, because the way a second engine returns is one file at a time:

     (a) THE NINE ARE GONE, and no shipped file imports one.
     (b) ONE TRANSLATOR. audio/to-engine.js has exactly one reader, so the live
         path and anything that renders cannot be handed different notes — that
         disagreement was the bug three separate times.
     (c) NOTHING IN nukernel/audio/ OPENS AN AudioContext, builds a node, or
         schedules a note. If it did, that would be the second engine again,
         whatever it was called.
     (d) THE FAILURE IS BOUNDED, in the shipped source: a deadline, a ceiling,
         and a demotion that is written down rather than retried. */
console.log("one engine: the second one is gone and cannot come back quietly");
{
  const fs76 = require("fs"), path76 = require("path");
  const AUD = path76.join(__dirname, "../../nukernel/audio");
  const rd = (f) => fs76.readFileSync(path76.join(AUD, f), "utf8");
  const GONE = ["transport.js", "graph.js", "mixer.js", "voices.js", "bounce.js",
                "assets.js", "survival.js", "press-window.js", "press-worker.js"];

  /* (a) THE NINE ARE GONE */
  for (const f of GONE)
    ok(!fs76.existsSync(path76.join(AUD, f)),
       "nukernel/audio/" + f + " is back — that is the second engine returning");
  const shipped = [];
  for (const dir of ["nukernel", "nukernel/audio", "nukernel/ui"])
    for (const f of fs76.readdirSync(path76.join(__dirname, "../..", dir)))
      if (f.endsWith(".js")) shipped.push([dir + "/" + f,
        fs76.readFileSync(path76.join(__dirname, "../..", dir, f), "utf8")]);
  for (const [name, src] of shipped)
    for (const g of GONE)
      ok(!new RegExp('from "[^"]*audio/' + g.replace(".", "\\.") + '"').test(src),
         name + " still imports audio/" + g);

  /* (b) ONE TRANSLATOR */
  {
    const readers = fs76.readdirSync(AUD).filter(f => f.endsWith(".js") && f !== "to-engine.js")
      .filter(f => /from "\.\/to-engine\.js"/.test(rd(f)));
    ok(readers.length === 1 && readers[0] === "plan.js",
       "audio/to-engine.js has readers [" + readers.join(", ") + "] — one translator, " +
       "or the two paths are free to disagree about the same bar again");
  }

  /* (c) THE AUDIO TIER MAKES NO AUDIO */
  {
    const files = fs76.readdirSync(AUD).filter(f => f.endsWith(".js"));
    ok(files.length === 6, "nukernel/audio now holds " + files.length +
       " modules (" + files.join(", ") + ") — six is the whole tier: the bridge, " +
       "the plan, the desk, the driver, the font choice and the offline cache " +
       "(offline.js registers the service worker and warms the record's own " +
       "samples; it makes no sound either, and the ban below still holds it)");
    const BANNED = [
      [/new (Offline)?AudioContext\b/, "opens an AudioContext"],
      [/createGain|createBiquadFilter|createConvolver|createDynamicsCompressor|createWaveShaper|createDelay|createOscillator|createBufferSource/,
       "builds a WebAudio node"],
      [/audioWorklet\.addModule/, "loads a worklet"],
      [/startRendering\(/, "renders offline"],
    ];
    for (const f of files) {
      // audio/live.js may READ the engine's context for the clock — that is the
      // parent's context, not one of its own — so the ban is on CREATING, which
      // is what every pattern above matches.
      const src = rd(f);
      for (const [re, what] of BANNED)
        ok(!re.test(src), "audio/" + f + " " + what + " — the audio tier is a " +
           "translator and a desk; the engine that makes sound is engine/faust/");
    }
  }

  /* (d) THE FAILURE IS BOUNDED */
  {
    const L = rd("live.js");
    ok(/const DEADLINE_MS = \d+/.test(L),
       "audio/live.js has no deadline — an engine that never starts is the iOS bug");
    ok(/const MAX_TRIES = [12]\b/.test(L),
       "audio/live.js has no ceiling on attempts, or the ceiling is above two");
    ok(/clearTimeout\(deadlineTimer\)/.test(L),
       "the deadline is never cleared — it would fire over a healthy engine");
    ok(!/setInterval\([^)]*open\(|setTimeout\([^)]*open\(/.test(L),
       "audio/live.js re-opens the engine on a timer — an unbounded retry is " +
       "exactly what turned a WebKit quirk into a dead tab");
    ok(/capped = \{ why/.test(L) || /st\.capped = \{ why/.test(L),
       "the give-up carries no reason — a silent demotion is the failure wearing a field");
  }

  console.log("  76: nine modules gone, one translator, no node built here, " +
              "and the engine has a deadline and a ceiling");
}

/* ---------------------------------------------------------------- 77. THE CAST
   THE RECORDS THAT HAVE A SINGER GET ONE.

   engine/faust/dsp/voice_tract.lib and its two seatings — voice_lead on a line,
   voice_choir under the harmony — were built, compiled into dist/ and routed by
   audio/to-engine.js, and this is the second organ in this project to be fully
   wired and never asked for. The first was the espeak singer: its field
   defaulted to null, no genre declared it, and nobody ever heard a note of it.
   An organ nobody asks for is an organ that does not exist, so the check that
   matters is not "does the module compile" — it is "which records sing", by
   name, so that un-arming one is a failing test rather than a silence.

   Six claims, all readable off the SCORE:

     (a) THE ROSTER, named. Adding or dropping a singer must be a deliberate
         edit to this list, which is the whole defence against the espeak shape.
     (b) EVERY SINGER RESOLVES TO A MODULE THAT IS ACTUALLY THERE — the dsp
         source and the compiled dist/ wasm both, because a cast that resolves
         to a missing module is silence wearing a name.
     (c) THE CHAIR IS THE ONE INTENDED. A lead takes the tune (the genre's own
         `realize` says "line"); a section is a PAD in the parent whatever chair
         asked for it, which is the chorale case's own law.
     (d) NOBODY LOST THE INSTRUMENT THAT WAS THE RECORD. Paul's test, verbatim:
         a Philadelphia soul record without its Rhodes is not an improvement.
         Every singing genre still carries a non-vocal instrument, and the four
         cast this round each still carry the named one.
     (e) THE INSTRUMENTAL CATALOGUE IS BYTE-IDENTICAL, held against HEAD through
         the rendered events — not the config — so "we left techno alone" is
         measured rather than asserted.
     (f) THE COMPASS. A voice unit is not a sampler, and it used to be refused
         the whole-line octave home for exactly that reason — windowOf answered
         null for anything without a `sampler`, so all a sung part got was the
         parent's PER-NOTE fold into the voice type's window, and a line wider
         than that window came back with its intervals rewritten. windowOf now
         reads the compass a voice declares, so the pair BEFORE (the bare fold)
         and AFTER (the fold under the home) is printed per part: it is the
         number that says whether a chosen voice type can say the part at all,
         and it is what made `hymn` castable. */
console.log("the cast — the records that have a singer get one");
{
  const fs77 = require("fs"), path77 = require("path"), cp77 = require("child_process");
  const ROOT77 = path77.join(__dirname, "../..");
  const TE77 = await import("../../nukernel/audio/to-engine.js");
  const instrAt = (g, v) => (Array.isArray(g.instr)
    ? g.instr[Math.min(v, g.instr.length - 1)] : g.instr);

  // WHO SINGS, and on which chair. Written out rather than derived, because a
  // roster derived from the table it is checking cannot notice the table
  // losing a row — which is exactly how an organ goes quiet without failing.
  // THE CAST, AND IT IS LEADS ONLY NOW. Paul, 2026-08-18: "Keep it a soloist and
  // use sampled choruses for choral arrangements." So every CHOIR chair this
  // table used to name has gone back to the sampled library — ahh_choir,
  // ohh_voices and space_voice are no longer patched to a throat at all
  // (audio/to-engine.js PATCH_VOICE) — and what reaches voice_lead is the one id
  // that means one singer in front: solo_vox.
  //
  // The rows below are therefore the whole roster, and the roster check under
  // them is unchanged in intent: it still fails if a record gains a voice nobody
  // argued for or loses one silently, which is exactly how the espeak singer came
  // to exist unheard. The choral genres are not untested by this going away —
  // they are tested as what they now are, sampled voices, by the walks that check
  // every unit resolves to something present.
  const CAST77 = {
    gospel:          [[1, "lead",  "alto"]],
    rnb:             [[1, "lead",  "alto"]],
    darkrnb:         [[0, "lead",  "countertenor"]],
    confessionalpop: [[2, "lead",  "alto"]],
    garage:          [[1, "lead",  "alto"]],
    doowop:          [[2, "lead",  "tenor"]],
    skiffle:         [[1, "lead",  "tenor"]],
    crooner:         [[0, "lead",  "bass"]],
    yuletide:        [[0, "lead",  "alto"]],
    powerballad:     [[0, "lead",  "soprano"]],
    boyband:         [[0, "lead",  "countertenor"]],
    vocal:           [[0, "lead",  "alto"]],
  };
  const MODULE_OF = { lead: "voice_lead", choir: "voice_choir" };

  /* (a) THE ROSTER — GK_FULL: this IS the coverage walk (a record that
     gained or lost a voice with nobody arguing for it, unheard) — the exact
     failure mode named in its own comment is invisible to a sample. */
  {
    const singing = [];
    for (const gk of GK_FULL) {
      const g = GENRES[gk];
      for (let v = 0; v < (g.voices || 1); v++)
        if (TE77.voiceForInstr(instrAt(g, v), g.tone)) { singing.push(gk); break; }
    }
    const want = Object.keys(CAST77).sort();
    ok(JSON.stringify(singing.slice().sort()) === JSON.stringify(want),
       "the singing roster is [" + singing.sort().join(" ") + "] and the cast says [" +
       want.join(" ") + "] — a record either gained a voice nobody argued for or " +
       "lost one silently, which is how the espeak singer came to exist unheard");
    console.log("  (a) " + singing.length + " of " + GK_FULL.length + " genres sing");
  }

  /* (b) EVERY SINGER RESOLVES TO A MODULE THAT IS ACTUALLY THERE */
  for (const [gk, rows] of Object.entries(CAST77)) {
    const g = GENRES[gk];
    for (const [v, seat, voice] of rows) {
      const id = instrAt(g, v);
      const sp = TE77.voiceForInstr(id, g.tone);
      ok(!!sp, gk + " voice " + v + " (" + id + ") reaches no throat at all");
      if (!sp) continue;
      ok(sp.dsp === MODULE_OF[seat], gk + " voice " + v + " sings through " + sp.dsp +
         " where the cast says " + MODULE_OF[seat]);
      ok(sp.set.voice === voice, gk + " voice " + v + " is a " + sp.set.voice +
         " and the cast says " + voice + " — two singing genres sounding like the " +
         "same patch twice is the whole thing the voice type exists to stop");
      // the module, on disk, both halves: a cast that resolves to a missing
      // wasm is a silence with a name on it
      ok(fs77.existsSync(path77.join(ROOT77, "engine/faust/dsp", sp.dsp + ".dsp")),
         gk + ": engine/faust/dsp/" + sp.dsp + ".dsp is missing");
      ok(fs77.existsSync(path77.join(ROOT77, "engine/faust/dist", sp.dsp + "-module.wasm")),
         gk + ": " + sp.dsp + " is not compiled into engine/faust/dist — the cast is silent");
      // the mouth reaches the module: a vowel walk and a compass, not a default
      ok(sp.live && sp.live.vowels && sp.live.vowels.length >= 1 &&
         sp.live.lo > 0 && sp.live.hi > sp.live.lo,
         gk + " voice " + v + ": the mouth carries no vowel walk or no compass");
      // and the genre actually SAYS who is singing, rather than inheriting the
      // patch id's default — the field that makes a crooner not a soprano
      ok(g.tone && g.tone.mouth && g.tone.mouth.voice,
         gk + " casts a voice and declares no mouth — it would sing the GM id's " +
         "default, which is the same singer every other genre gets");
    }
  }

  /* (c) THE CHAIR IS THE ONE INTENDED */
  {
    const src77 = fs77.readFileSync(path77.join(ROOT77, "nukernel/audio/to-engine.js"), "utf8");
    ok(/voice_lead:\s*\{\s*model:\s*"singer",\s*role:\s*"melody"\s*\}/.test(src77),
       "to-engine.js no longer seats voice_lead on the melody strip — a lead that " +
       "is not on the lead chair is a backing vocal");
    ok(/voice_choir:\s*\{\s*model:\s*"chorale",\s*role:\s*"pad"\s*\}/.test(src77),
       "to-engine.js no longer seats voice_choir on the pad strip — the melody " +
       "strip's high-pass takes the body out of four people");
    for (const [gk, rows] of Object.entries(CAST77)) {
      const g = GENRES[gk];
      for (const [v, seat] of rows) {
        const realize = g.realize ? g.realize(v) : "line";
        if (seat === "lead")
          ok(realize === "line", gk + " voice " + v + " sings the LEAD off a \"" +
             realize + "\" chair — a soloist takes the tune or is not a soloist");
      }
    }
  }

  /* (d) NOBODY LOST THE INSTRUMENT THAT WAS THE RECORD */
  {
    // the four cast this round, and the thing each one was not allowed to lose
    const KEPT = { gospel: ["percussive_organ"], rnb: ["legend_ep_2"],
                   darkrnb: ["halo_pad"],
                   confessionalpop: ["steel_string_guitar", "polysynth"],
                   // the pipes hold the hymn's bass part, which at MIDI 7-38 is
                   // nobody's part to sing — and keep the record a band
                   hymn: ["church_organ"] };
    for (const [gk, must] of Object.entries(KEPT)) {
      const g = GENRES[gk];
      const cast = [];
      for (let v = 0; v < (g.voices || 1); v++) cast.push(instrAt(g, v));
      for (const id of must)
        ok(cast.includes(id), gk + " lost " + id + " to the singer — a Philadelphia " +
           "soul record without its Rhodes is not an improvement");
    }
    // and nothing anywhere became all voice: a record is a band, EXCEPT where
    // the record genuinely is nothing but people. Four sacred rooms, four men
    // round one microphone, and the two utility rows the cast pool deals from —
    // named, so that a genre joining this list is an argument somebody made
    // rather than a guitar that quietly vanished under a singer.
    const ACAPPELLA = new Set(["gregorian", "spem", "bulgarian", "backing",
                               "doowop", "vocal"]);
    for (const gk of Object.keys(CAST77)) {
      const g = GENRES[gk];
      let played = 0;
      for (let v = 0; v < (g.voices || 1); v++)
        if (!TE77.voiceForInstr(instrAt(g, v), g.tone)) played++;
      ok(played > 0 || ACAPPELLA.has(gk),
         gk + " is nothing but voices — every instrument on the record was " +
         "displaced by the singer");
    }
  }

  /* (e) THE INSTRUMENTAL CATALOGUE IS BYTE-IDENTICAL — GK_FULL: the
     byte-identity tripwire against HEAD, and its whole claim is "nothing
     ELSE moved" — a sample can only vouch for the genres it happened to
     draw. */
  {
    // HEAD's own genres.js, loaded beside the working one. Evaluated rather
    // than written to disk: the file is a classic IIFE that requires
    // ./kernel.js, so it only needs a module shim and the real kernel.
    let HEADG = null;
    try {
      const src = cp77.execSync("git show HEAD:nukernel/genres.js",
        { cwd: ROOT77, encoding: "utf8", maxBuffer: 32 << 20 });
      const mod = { exports: {} };
      new Function("module", "exports", "require", src)(
        mod, mod.exports, (p) => require(p === "./kernel.js" ? "../../nukernel/kernel.js" : p));
      HEADG = mod.exports.GENRES;
    } catch (e) { HEADG = null; }
    ok(!!HEADG, "cannot load HEAD's genres.js — the untouched half of the catalogue " +
       "is unheld, and this round could have moved a genre nobody was looking at");
    if (HEADG) {
      let same = 0;
      for (const gk of GK_FULL) {
        if (CAST77[gk]) continue;
        const a = GENRES[gk], b = HEADG[gk];
        ok(!!b, gk + " is new and was not part of casting singers");
        if (!b) continue;
        const bars = a.bars || 8;
        const mine = sig(K.render(P, a, bars)) + "|" + sig(K.drums(P, a, bars)) +
                     "|" + sig(K.bass(P, a, bars));
        const head = sig(K.render(P, b, bars)) + "|" + sig(K.drums(P, b, bars)) +
                     "|" + sig(K.bass(P, b, bars));
        ok(mine === head, gk + " renders differently than it did at HEAD — casting " +
           "singers moved a genre that was deliberately instrumental");
        ok(JSON.stringify(a.instr) === JSON.stringify(b.instr),
           gk + "'s instrument cast moved and it has no singer");
        ok(JSON.stringify(a.tone) === JSON.stringify(b.tone),
           gk + "'s tone block moved and it has no singer");
        if (mine === head) same++;
      }
      // hymn IS cast now, and the one thing that must not have moved with it is
      // the SCORE: the register home moves a line at the plan, not at the
      // composer, so the notes a hymnal prints are the notes it printed before.
      {
        const h = GENRES.hymn, hb = HEADG.hymn;
        ok(sig(K.render(P, h, h.bars)) === sig(K.render(P, hb, hb.bars)),
           "hymn's four parts render differently than they did at HEAD — casting " +
           "the congregation was supposed to change who sings the line, not the line");
      }
      console.log("  (e) " + same + " untouched genres render byte-identical to HEAD");
    }
  }

  /* (f) THE COMPASS, MEASURED */
  {
    // the parent's own windows, read off its source the way §75 reads the rest
    // of the mirror — a copy of these numbers is how the page and the tape came
    // to disagree about where a trumpet lives
    const se77 = fs77.readFileSync(
      path77.join(ROOT77, "engine/faust/voices/state-engine.js"), "utf8");
    const m77 = se77.match(/const VOICE_TYPE = \{([\s\S]*?)\n  \};/);
    const VT77 = m77 ? new Function("return {" + m77[1] + "}")() : null;
    ok(!!VT77, "cannot read VOICE_TYPE out of state-engine.js — the compass below is guesswork");
    const midiOf = (hz) => 69 + 12 * Math.log2(hz / 440);
    // the parent's fold, verbatim in shape: octaves down to the ceiling, then
    // octaves up to the floor, PER NOTE (mapEvents; there is no whole-line home
    // for a unit that is not a sampler — audio/plan.js windowOf returns null)
    const foldTo = (n, lo, hi) => { let m = n; while (m > hi) m -= 12; while (m < lo) m += 12; return m; };
    // ...and the WHOLE-LINE HOME above it, which a voice now gets. This is the
    // shipped function, not a copy: audio/plan.js homeFor is what the compile
    // calls, and windowOf hands it exactly [midi(freqMin), midi(freqMax)] for a
    // throat, which is the compass VOICE_TYPE above declares.
    const P77 = await import("../../nukernel/audio/plan.js");
    const NEW77 = new Set(["gospel", "rnb", "darkrnb", "confessionalpop", "hymn"]);
    const rows77 = [];
    for (const [gk, rows] of Object.entries(CAST77)) {
      if (!VT77) break;
      const g = GENRES[gk];
      // DEFAULT, not the torture phrase P every section above renders. P exists
      // to make every vector move — octave leaps in both directions, degrees
      // out to a seventh — and it is three octaves wide before a genre's own
      // register touches it, so measuring a throat against it says something
      // about the test phrase and nothing about the cast. This is the seed the
      // page actually boots with, so this is the line the record actually sings.
      const ev = K.render(DEFAULT, g, g.bars || 8);
      for (const [v, seat, voice] of rows) {
        const ps = ev.filter(e => e.v === v).sort((a, b) => a.t - b.t).map(e => e.n);
        if (!ps.length) continue;
        const W = VT77[voice];
        ok(!!W, gk + " voice " + v + " names a voice type the parent has never heard of: " + voice);
        if (!W) continue;
        const lo = midiOf(W.lo), hi = midiOf(W.hi);
        const dmgOf = (f) => {
          let moved = 0;
          for (let i = 1; i < ps.length; i++) if (f[i] - f[i - 1] !== ps[i] - ps[i - 1]) moved++;
          return ps.length > 1 ? moved / (ps.length - 1) : 0;
        };
        // BEFORE is the per-note fold standing alone, which is all a voice used
        // to get; AFTER is the same fold under the whole-line home. The pair is
        // the measurement that made hymn castable, so both are printed.
        const bare = dmgOf(ps.map(p => foldTo(p, lo, hi)));
        const home = P77.homeFor(ps, [lo, hi]) * 12;
        const dmg = dmgOf(ps.map(p => foldTo(p + home, lo, hi)));
        rows77.push([gk, v, seat, voice, Math.min(...ps), Math.max(...ps), dmg, bare, home / 12]);
        // THE HARD FLOOR, for the whole roster: above four intervals in five
        // rewritten, the fold is louder than the tune and the part is not being
        // sung, it is being wrapped.
        ok(dmg <= 0.8, gk + " voice " + v + ": a " + voice + " folds " +
           (dmg * 100).toFixed(0) + "% of the line's intervals — the part is " +
           (Math.max(...ps) - Math.min(...ps)) + " semitones wide and that throat has " +
           Math.round(hi - lo));
        // and the four cast THIS round were chosen against this number, so they
        // are held tighter: the type had to be both the right singer and one
        // that can say the part
        if (NEW77.has(gk))
          ok(dmg < 0.5, gk + " voice " + v + " was cast this round onto a " + voice +
             " that rewrites " + (dmg * 100).toFixed(0) + "% of its intervals — a wrong " +
             "voice is worse than no voice");
      }
    }
    rows77.sort((a, b) => b[7] - a[7]);
    for (const [gk, v, seat, voice, lo, hi, dmg, bare, home] of rows77)
      console.log("  (f) " + (gk + " v" + v).padEnd(22) + seat.padEnd(6) +
                  voice.padEnd(13) + ("MIDI " + lo + "-" + hi).padEnd(14) +
                  ("home " + (home >= 0 ? "+" : "") + home).padEnd(10) +
                  "fold " + (bare * 100).toFixed(0) + "% -> " + (dmg * 100).toFixed(0) + "%");
  }
}

/* ---------------------------------------------------------------- 78. WHAT REACHES THE ENGINE
   THREE THINGS THE PLAN HANDS THE PARENT, AND ONE WALK THAT ASKS FOR ALL OF THEM.

   audio/plan.js barPlan is a PURE function over a song — the same answer for the
   live walk and for anything that renders — so every question below is a walk in
   node over the shipped compile, not a session in a browser. That matters
   because all three of these shipped broken while every check passed: the page
   said "0v · stream", the console named a line inside a worker, and nothing in
   test/ was reading the table the engine was actually being handed.

     (a) NOTHING SHIPS NAMELESS. Every unit in every box's table either plays a
         sampler or names a module compiled into engine/faust/dist, and so does
         every INSERT on it. The desk's chips used to be appended raw — the
         `{type, params}` recipe dialect, which is the INPUT to state-engine
         insertChain and carried no `module` — so the renderer interpolated
         `undefined` into a wasm URL on every box with an effect chip. That is
         the "engine error: loadDSPFactory" a listener saw, and once a loader
         guard made it throw it was the whole song. Both ends are fixed now
         (fields.js fxChain names the module, audio/desk.js insertsFor finishes
         the recipe through the parent's chain), and this is the walk that says
         so for every box rather than for the one somebody happened to play.
     (b) A WIDE UNIT KEEPS ITS WIDTH. The renderer tests a unit's INSERT chain
         before it tests `u.stereo`, so a chained unit renders through a mono
         buffer and only channel 0 survives — four singers arrive as one. So
         nothing stereo may reach the engine carrying inserts.
     (c) A SUNG PART GETS A REGISTER HOME. windowOf answers for a throat now, so
         homeFor moves a whole sung line into the voice's compass before the
         parent's per-note fold can wrap it note by note. Measured as the fold
         damage that found the bug: the share of a part's intervals the engine
         rewrites, before the home and after it. */
console.log("what reaches the engine — a name, a width, and a register to sing in");
{
  const fs78 = require("fs"), path78 = require("path");
  const ROOT78 = path78.join(__dirname, "../..");
  const ST78 = await import("../../nukernel/ui/state.js");
  const P78 = await import("../../nukernel/audio/plan.js");
  const { SE: SE78 } = await P78.warmEngine();
  const C78 = require("../../nukernel/compose.js");
  const TE78 = await import("../../nukernel/audio/to-engine.js");
  // WHO SINGS, derived — §77(a) is where the roster is PINNED by hand, so
  // deriving it here reads the same list without a second copy to drift.
  // The main walk below compiles a real audio plan per genre x seed (a P78
  // .compile()), which is the same cost class as §45's instrument-pool sweep
  // — too expensive to keep at GK_FULL (it alone cost 60s of the old fast
  // run). Sampled like everything else; the floors are `atLeast`, and SWEEP
  // is what makes "nothing ships nameless" a claim about the whole catalog.
  const SINGERS78 = GK.filter((gk) => {
    const g = GENRES[gk];
    for (let v = 0; v < (g.voices || 1); v++)
      if (TE78.voiceForInstr(Array.isArray(g.instr)
        ? g.instr[Math.min(v, g.instr.length - 1)] : g.instr, g.tone)) return true;
    return false;
  });
  // what is actually compiled and servable. A module id that is not a file here
  // is a 404 at the worklet, which is the same silence as no module at all.
  const DIST78 = new Set(fs78.readdirSync(path78.join(ROOT78, "engine/faust/dist"))
    .filter(f => f.endsWith("-module.wasm")).map(f => f.slice(0, -12)));
  const SEEDS78 = [1, 3, 7];

  // ONE WALK, ONE BAR PER BOX. The desk is a per-BOX fact (a section's chips, a
  // part's chips, the box's own sends), so the first bar of every box is the
  // whole space of unit tables a song can hand the engine — and asking every bar
  // of every genre at every seed is the same answer several hundred thousand
  // times, which is the difference between a gate people run and one they skip.
  let nUnits78 = 0, nIns78 = 0, nBox78 = 0, stereo78 = 0;
  const nameless78 = [], wide78 = [];
  for (const gk of GK) for (const sd of SEEDS78) {
    ST78.adoptSong(C78.compose(gk, sd), "gate");
    P78.compile();
    const TL78 = P78.timeline();
    for (let i = 0; i < TL78.length; i++) {
      if (!TL78[i].first) continue;
      const bp = P78.barPlan(i);
      if (!bp) continue;
      nBox78++;
      for (const [key, u] of Object.entries(bp.units)) {
        if (!u || key.slice(0, 2) === "__") continue;
        nUnits78++;
        if (!u.sampler && !(u.module && DIST78.has(u.module)))
          nameless78.push(gk + "/" + sd + " " + key + " unit module=" + u.module);
        if (u.stereo) {
          stereo78++;
          if (u.inserts && u.inserts.length)
            wide78.push(gk + "/" + sd + " " + key + " " + u.module + " carries " +
                        u.inserts.length + " insert(s)");
        }
        for (const eff of (u.inserts || [])) {
          nIns78++;
          if (!eff || !eff.module || !DIST78.has(eff.module))
            nameless78.push(gk + "/" + sd + " " + key + " insert type=" +
                            (eff && eff.type) + " module=" + (eff && eff.module));
        }
      }
    }
  }

  /* (a) NOTHING SHIPS NAMELESS */
  ok(atLeast(nUnits78, 5000) && atLeast(nIns78, 5000),
     "the walk saw " + nUnits78 + " units and " + nIns78 + " inserts — it is not walking");
  ok(nameless78.length === 0, nameless78.length + " thing(s) reach the engine with no " +
     "module the loader can fetch, first three: " + nameless78.slice(0, 3).join(" | ") +
     " — an effect with no module is a 404 in a URL and, with the loader guarded, silence");
  console.log("  (a) " + nUnits78 + " units + " + nIns78 + " inserts across " + nBox78 +
              " boxes, every one of them named");

  /* (b) A WIDE UNIT KEEPS ITS WIDTH */
  ok(atLeast(stereo78, 100), "only " + stereo78 + " stereo unit(s) in the whole catalogue — " +
     "this claim is proving nothing");
  ok(wide78.length === 0, wide78.length + " stereo unit(s) reach the engine with an " +
     "insert chain, first three: " + wide78.slice(0, 3).join(" | ") + " — the renderer " +
     "folds a chained unit to channel 0, so those arrive mono");
  {
    // WHY the law is the law, held against the engine's own source: the insert
    // branch is tested BEFORE the stereo branch, so a chain wins and the width
    // never reaches the wide buses. If that order ever changes, this whole
    // trade (the chorus, or the room) is worth reopening.
    const sr78 = fs78.readFileSync(
      path78.join(ROOT78, "engine/faust/live/stream-renderer.js"), "utf8");
    ok(/if \(ubuf\) \{[\s\S]{0,400}?\} else if \(u\.stereo && buses\.wL\)/.test(sr78),
       "stream-renderer no longer folds a chained unit to channel 0 before it looks " +
       "at u.stereo — audio/desk.js widthKept is trading away inserts for a width " +
       "the engine may now be able to keep anyway");
  }
  {
    // and the choir that started it, by name: gregorian's section arrives wide,
    // pooled and spread — the four singers, not one of them four times
    ST78.adoptSong(C78.compose("gregorian", 1), "gate");
    P78.compile();
    const U = P78.barPlan(0).units;
    // (the named example was gregorian's four-singer chorale until 2026-08-18,
    // when the choral ids went back to the sampled library — "use sampled
    // choruses for choral arrangements". The LAW below is unchanged and is the
    // thing that mattered: a stereo unit reaches the engine with no insert
    // chain, because the insert branch in renderUnitWindow is tested BEFORE
    // u.stereo and folds it to channel 0. It is now checked over every stereo
    // unit the catalogue emits rather than over one record that happened to
    // demonstrate it.)
    const ch = Object.entries(U).find(([k, u]) => u && u.stereo === true);
    if (ch) {
      const u = ch[1];
      ok(u.stereo === true && !(u.inserts && u.inserts.length),
         "a stereo unit reaches the engine stereo=" + u.stereo + " with " +
         ((u.inserts || []).length) + " insert(s) — its width dies in the chain");
      ok(u.pool >= 2 && u.params.spread > 0 && u.params.drift > 0 && u.params.width > 0,
         "gregorian's choir arrives with pool " + u.pool + ", spread " + u.params.spread +
         ", drift " + u.params.drift + ", width " + u.params.width + " — a choir with no " +
         "spread is one singer");
      console.log("  (b) " + stereo78 + " stereo units, none chained; gregorian's choir " +
                  "pool " + u.pool + " spread " + (+u.params.spread).toFixed(2) +
                  " width " + (+u.params.width).toFixed(2));
    }
  }

  /* (c) A SUNG PART GETS A REGISTER HOME */
  {
    // the parent's own compasses, read off its source (the §77(f) mirror), so a
    // window this file asserts is the window the engine folds into
    const se78 = fs78.readFileSync(
      path78.join(ROOT78, "engine/faust/voices/state-engine.js"), "utf8");
    const mv78 = se78.match(/const VOICE_TYPE = \{([\s\S]*?)\n  \};/);
    const VT78 = mv78 ? new Function("return {" + mv78[1] + "}")() : null;
    ok(!!VT78, "cannot read VOICE_TYPE out of state-engine.js");
    const midiOf78 = (hz) => 69 + 12 * Math.log2(hz / 440);
    // the five throats, as the parent declares them: none of them is wider than
    // ~25 semitones, which is the whole reason a wide part needs a HOME and not
    // just a fold
    if (VT78) for (const [n, V] of Object.entries(VT78))
      ok(midiOf78(V.hi) - midiOf78(V.lo) >= 12,
         "the " + n + " throat is narrower than an octave — no line fits it in key");
    const foldTo78 = (n, w) => { let m = n; while (m > w[1]) m -= 12; while (m < w[0]) m += 12; return m; };

    // A CEILING IS NOT A WINDOW. Every synth unit carries the base freqMax
    // (4000 Hz) and most declare no floor at all, and those must still answer
    // null — the home is for a part with somewhere to be, not for every voice
    // in the catalogue suddenly moving an octave.
    {
      const bare = SE78.pitchedUnit("melody", { model: "saw" },
                                    { bpm: 120, seed: 1, sampledOnly: true });
      ok(bare.freqMax > 0 && !(bare.freqMin > 0),
         "a plain saw now declares a floor — the null case below is no longer the null case");
      ok(P78.windowOf(SE78, bare) === null,
         "windowOf answers a window for a unit that declares only a ceiling — every " +
         "synth in the table would start moving octaves it never moved before");
    }

    let before78 = 0, after78 = 0, parts78 = 0, worst78 = 0, hymnParts = 0;
    const rows78 = [];
    for (const gk of SINGERS78) for (const sd of SEEDS78) {
      ST78.adoptSong(C78.compose(gk, sd), "gate");
      P78.compile();
      const homes = P78.homes(), units = P78.unitTable();
      const notes = new Map();
      for (const bar of P78.timeline()) for (const e of bar.ev)
        if (e._seat != null && e.n != null) {
          let a = notes.get(e._seat); if (!a) notes.set(e._seat, a = []);
          a.push(e.n);
        }
      for (const [v, ps] of notes) {
        const u = units["v" + v];
        if (!u || !u.module || u.module.slice(0, 6) !== "voice_" || ps.length < 2) continue;
        const w = P78.windowOf(SE78, u);
        ok(!!w, gk + "/" + sd + " v" + v + ": a " + u.module + " still answers no window " +
           "— the throat has no register to be moved into");
        if (!w) continue;
        // the window IS the compass the parent folds into, not a number this
        // file invented: freqMin/freqMax are the voice type's own two Hz
        ok(Math.abs(w[0] - midiOf78(u.freqMin)) < 1e-9 &&
           Math.abs(w[1] - midiOf78(u.freqMax)) < 1e-9,
           gk + " v" + v + ": windowOf and the unit's declared compass disagree");
        const dmg = (f) => { let mv = 0;
          for (let i = 1; i < ps.length; i++) if (f[i] - f[i - 1] !== ps[i] - ps[i - 1]) mv++;
          return mv / (ps.length - 1); };
        const bare = dmg(ps.map(p => foldTo78(p, w)));
        const h = homes[v] * 12;
        const home = dmg(ps.map(p => foldTo78(p + h, w)));
        before78 += bare; after78 += home; parts78++;
        worst78 = Math.max(worst78, home);
        if (gk === "hymn") { hymnParts++; rows78.push([gk + "/" + sd, v, u.module, ps, w, h, bare, home]); }
        // THE HARD FLOOR, on the line the engine is handed rather than on the
        // genre alone: a composed song stacks layers, so a seat can be wider
        // than any one genre writes, and past three intervals in five rewritten
        // the fold is louder than the tune.
        ok(home <= 0.6, gk + "/" + sd + " v" + v + ": a " + u.module + " still folds " +
           (home * 100).toFixed(0) + "% of the line's intervals after the home — the " +
           "part is " + (Math.max(...ps) - Math.min(...ps)) + " semitones wide and the " +
           "throat has " + Math.round(w[1] - w[0]));
      }
    }
    // THE FLOOR IS A COVERAGE CHECK, NOT A TARGET. It exists so this measurement
    // cannot pass by measuring nothing. It was 100 while the sung roster included
    // every choral part; since the choral ids went back to the sampled library
    // (2026-08-18) the roster is LEADS, and the whole catalogue offers 69. Set
    // below that so a genuine collapse still trips it, and stated rather than
    // quietly deleted — a floor tuned to whatever the code currently does is not
    // a floor.
    ok(atLeast(parts78, 40), "only " + parts78 + " sung part(s) measured — the roster is not singing");
    // THE ABSOLUTE BOUND, NOT THE HALVING. This asserted that the register home
    // roughly HALVED the roster's fold damage, which it did on 2026-08-18 when
    // the roster was mostly wide CHORAL parts — hymn's three at 31 semitones
    // against a 25-semitone throat were the whole point of the measurement. The
    // choral ids went back to the sampled library the same day ("use sampled
    // choruses for choral arrangements"), so the sung roster is now LEADS, which
    // sit inside a throat's compass already and have almost no damage to halve.
    //
    // The home is not thereby pointless — it is the parent's REGISTER HOME law
    // and it still moves any voice or synth line whole rather than per note; it
    // is simply no longer measurable as a big before/after on this roster. So
    // the claim becomes the one that still means something and is stricter per
    // part: no sung line may fold more than 60% of its intervals, checked above
    // on each part, and the aggregate is reported rather than gated.
    ok(after78 <= before78 + 1e-9,
       "the register home made the roster's fold damage WORSE — " +
       (before78 / parts78 * 100).toFixed(1) + "% to " +
       (after78 / parts78 * 100).toFixed(1) + "%");
    console.log("  (c) " + parts78 + " sung parts: fold " +
                (before78 / parts78 * 100).toFixed(1) + "% -> " +
                (after78 / parts78 * 100).toFixed(1) + "% (worst part " +
                (worst78 * 100).toFixed(0) + "%)");
    for (const [gk, v, mod, ps, w, h, bare, home] of rows78.slice(0, 6))
      console.log("      " + (gk + " v" + v).padEnd(14) + mod.padEnd(12) +
                  ("MIDI " + Math.min(...ps) + "-" + Math.max(...ps)).padEnd(14) +
                  ("home " + (h / 12 >= 0 ? "+" : "") + h / 12).padEnd(10) +
                  "fold " + (bare * 100).toFixed(0) + "% -> " + (home * 100).toFixed(0) + "%");
  }
}

console.log("\nnukernel (" + (SWEEP ? "sweep" : "fast") + "): " + (checks - fails) + "/" + checks +
            " checks pass across " + GK.length + " genres" +
            (SWEEP ? "" : " of " + GK_FULL.length +
              " (node test/unit/nukernel.test.js --sweep for the full catalog)"));
if (fails) { console.error("nukernel: " + fails + " FAILURE(S)"); process.exit(1); }
process.exit(0);
})().catch(e => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
