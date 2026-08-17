#!/usr/bin/env node
// test/browser/nukernel-groove.test.js — THE SONG-TIME CONTROL PROBE.
//
//   node test/browser/nukernel-groove.test.js
//
// The groove moved from box scope to SONG scope ("the groove belongs to the
// song, the way the tempo does", 2026-08-16), and the SWING followed it the
// same day ("nothing in a section tells time") — taking the whole TIMING cell
// with it: the cell's two genuinely-per-pattern survivors, the nudge stepper
// and the articulation bank, moved into PATTERN MODS. test/unit/nukernel.test.js
// proves the model — the registry lost both box fields, the migration lifts
// old saves, the schedule moves under the song groove AND the song swing —
// but the CONTROLS are DOM, and the unit gate cannot see whether the page
// actually offers them (or has stopped offering the retired ones). This is
// the one DOM probe both moves get, and it is DOM-only on purpose: no play
// button, no analyser, no render budget — those gates already exist and the
// song's time reaches them through the same buildTimeline it always walked.
//
//   (A) the GROOVE and SWING controls EXIST, once each, in the session bank,
//       legended, and read their current value (a fresh page is flat/default);
//   (B) loading a shipped preset — per-box vintage, migrated on the way in —
//       lands the LIFTED groove and swing in the controls, the exact values
//       the loader computes for the same bytes in node;
//   (C) changing each COMMITS: state moves and the debounced save carries the
//       song-level fact (and no box-level one);
//   (D) NOTHING IN A SECTION TELLS TIME: no TIMING cell exists on any row, no
//       cell menu of any section surface offers a swing or groove bank, and
//       the two survivors — nudge and articulation — work from the PATTERN
//       MODS menu into state.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8957;                 // a PREFERENCE — the harness walks past a busy port

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// the EXPECTED lifted values, computed in node from the same bytes the page
// ships — the probe asserts agreement, it does not re-derive the majority rule
const S = require("../../nukernel/song.js");
const { PRESETS } = require("../../nukernel/presets.js");
const loaded = PRESETS.map(p => ({ name: p.name, r: S.load(p.data) }));
const lifted = loaded.find(x => x.r.ok && x.r.song.groove != null);
const liftedSw = loaded.find(x => x.r.ok && x.r.song.swing != null);

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });
  // a fresh store, whatever an earlier run left behind
  await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
  await page.reload({ waitUntil: "networkidle" });

  // THE SINGLE-LAYOUT SHELL (2026-08-16): #groove/#swing/#preset moved onto
  // the Mix page's session drawer, and a page not showing is display:none —
  // so every control this file drives has to be navigated to first, the same
  // goPage the audio and survival gates already carry.
  const goPage = async (p) => {
    await page.click(`.pkey[data-page="${p}"]`);
    await page.waitForFunction(
      (n) => document.getElementById("chassis").dataset.page === n, p,
      { timeout: 10000 });
  };
  // ...and the session drawer itself is a closed <details> ("move all the
  // sound definition and saving functionality into mix"), so #preset/#groove/
  // #swing are hidden until it is opened.
  const openSession = async () => {
    await page.evaluate(() => {
      const d = document.getElementById("preset").closest("details");
      if (d && !d.open) d.open = true;
    });
  };
  await goPage("mix");
  await openSession();

  // (A) the controls exist, once each, legended, and read the current value
  for (const [id, legend, blank] of [["groove", "groove", "flat"],
                                     ["swing", "swing", "default"]]) {
    const n = await page.locator("#" + id).count();
    if (n !== 1) fail(`expected exactly one #${id} control, found ${n}`);
    else ok(`the ${legend.toUpperCase()} control exists, once`);
    const leg = await page.locator(`label.gctl:has(#${id}) .glab`).textContent();
    if (!new RegExp("^" + legend + "$", "i").test((leg || "").trim()))
      fail(`the control's legend reads "${leg}", not ${legend.toUpperCase()}`);
    else ok(`it is legended ${legend.toUpperCase()} in the session bank`);
    const v = await page.inputValue("#" + id);
    if (v !== "") fail(`a fresh page's ${legend} reads "${v}", not ${blank}`);
    else ok(`a fresh page reads ${blank}`);
    const opts = await page.locator(`#${id} option`).allTextContents();
    if (opts.length < 6) fail(`the ${legend} control offers only ${opts.length} choices: ${opts.join(", ")}`);
    else ok(`it offers the vocabulary: ${opts.join(", ")}`);
  }

  // (B) a shipped preset's per-box grooves AND swings arrive LIFTED
  if (!lifted) fail("no shipped preset lifts a groove — the unit gate should have caught this");
  else {
    await page.selectOption("#preset", lifted.name);
    await page.waitForTimeout(200);
    const v = await page.inputValue("#groove");
    if (v !== lifted.r.song.groove)
      fail(`preset "${lifted.name}" should lift groove "${lifted.r.song.groove}", ` +
           `the control reads "${v}"`);
    else ok(`preset "${lifted.name}" lands its lifted groove: ${v}`);
  }
  if (!liftedSw) fail("no shipped preset lifts a swing — the unit gate should have caught this");
  else {
    await page.selectOption("#preset", liftedSw.name);
    await page.waitForTimeout(200);
    const v = await page.inputValue("#swing");
    if (v !== liftedSw.r.song.swing)
      fail(`preset "${liftedSw.name}" should lift swing "${liftedSw.r.song.swing}", ` +
           `the control reads "${v}"`);
    else ok(`preset "${liftedSw.name}" lands its lifted swing: ${v}`);
  }

  // (C) changing each commits — state moves, and the save carries the song fact
  {
    await page.selectOption("#groove", "dub");
    await page.selectOption("#swing", "shuffle");
    await page.waitForTimeout(400);              // past the 250 ms save debounce
    const got = await page.evaluate(async () => {
      const stm = await import("/nukernel/ui/state.js");
      const raw = JSON.parse(localStorage.getItem("nukernel.song.v1") || "null");
      return { g: stm.GROOVE, sw: stm.SWING,
               savedG: raw && raw.groove, savedSw: raw && raw.swing,
               boxed: !!(raw && raw.song && raw.song.some(b => b &&
                 (b.groove != null || b.swing != null))) };
    });
    if (got.g !== "dub") fail(`state GROOVE is ${got.g}, not dub`);
    else ok("the groove change reaches state");
    if (got.sw !== "shuffle") fail(`state SWING is ${got.sw}, not shuffle`);
    else ok("the swing change reaches state");
    if (got.savedG !== "dub") fail(`the save carries groove ${got.savedG}, not dub`);
    else ok("the groove commits to the save, at song level");
    if (got.savedSw !== "shuffle") fail(`the save carries swing ${got.savedSw}, not shuffle`);
    else ok("the swing commits to the save, at song level");
    if (got.boxed) fail("the save still carries a per-box groove or swing");
    else ok("no box in the save carries a groove or a swing");
  }

  // (D) NOTHING IN A SECTION TELLS TIME. No TIMING cell anywhere in the song
  // table; and no cell menu the section surface can open offers a swing or
  // groove bank. The two survivors work from PATTERN MODS into state.
  // (The second half of this used to count `.shead .h-timing` — a TIMING
  // header cell. The header row is gone from the whole app, so that locator
  // became vacuously zero; the count it is replaced with is STRICTLY wider
  // than the .bcell one it joins, because it sweeps the layer sub-rows too.)
  // A fresh page first: the preset loaded above carries its own nudges, and
  // the stepper claim below is exact (0 -> 1).
  await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
  await page.reload({ waitUntil: "networkidle" });
  await goPage("song");                    // the row/.bcell surface lives on Arrange
  {
    const tCells = await page.locator('.bcell[data-cell="timing"]').count();
    const tAny = await page.locator('#song [data-cell="timing"]').count();
    if (tCells || tAny)
      fail(`a TIMING surface survives (${tCells} row cells, ${tAny} in the table)`);
    else ok("no TIMING cell exists — not on a row, not on a layer sub-row");

    // walk EVERY distinct cell menu a section row offers
    const kinds = await page.locator(".box").first()
      .locator(".bcell").evaluateAll(els => els.map(e => e.dataset.cell));
    const pop = page.locator("#rowpop");
    for (const k of kinds) {
      await page.locator(".box").first()
        .locator(`.bcell[data-cell="${k}"]`).click();
      await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
      const swingChips = await pop.locator('.pchip[data-kind="swing"]').count();
      const grooveChips = await pop.locator('.pchip[data-kind="groove"]').count();
      if (swingChips || grooveChips)
        fail(`the ${k.toUpperCase()} menu offers time ` +
             `(${swingChips} swing, ${grooveChips} groove chips)`);
      await page.keyboard.press("Escape");
    }
    ok(`no cell menu (${kinds.join(", ")}) offers a swing or groove control`);

    // the survivors: nudge and artic live in PATTERN MODS, and they WORK
    await page.locator(".box").first().locator('.bcell[data-cell="mods"]').click();
    await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
    const nud = pop.locator('.rpstep', { hasText: /nudge/ })
                   .locator('button[aria-label="one bar of nudge more"]');
    if (!(await nud.count())) fail("the MODS menu has no nudge stepper");
    else {
      await nud.click();
      const nudged = await page.evaluate(async () => {
        const stm = await import("/nukernel/ui/state.js");
        return stm.SONG[0].nudge;
      });
      if (nudged !== 1) fail(`the MODS nudge stepper wrote ${nudged}, not 1`);
      else ok("the nudge stepper works from the MODS menu into state");
    }
    const artChip = pop.locator('.pchip[data-kind="artic"][data-value="staccato"]');
    if (!(await artChip.count())) fail("the MODS menu has no articulation bank");
    else {
      await artChip.click();
      const artic = await page.evaluate(async () => {
        const stm = await import("/nukernel/ui/state.js");
        const b = stm.SONG[0];
        return b.stack[0].artic != null ? b.stack[0].artic : b.artic;
      });
      if (artic !== "staccato")
        fail(`the MODS artic chip wrote ${JSON.stringify(artic)}, not staccato`);
      else ok("the articulation bank works from the MODS menu into state");
    }
    await page.keyboard.press("Escape");
  }

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  await browser.close();
  await srv.close();
  console.log(process.exitCode ? `\nFAILED (${checks} passed)` : `\nPASS (${checks} checks)`);
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
