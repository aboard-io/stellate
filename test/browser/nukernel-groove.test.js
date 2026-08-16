#!/usr/bin/env node
// test/browser/nukernel-groove.test.js — THE SONG-GROOVE CONTROL PROBE.
//
//   node test/browser/nukernel-groove.test.js
//
// The groove moved from box scope to SONG scope ("the groove belongs to the
// song, the way the tempo does", 2026-08-16). test/unit/nukernel.test.js
// proves the model — the registry lost the box field, the migration lifts old
// saves, the schedule moves under the song groove — but the CONTROL is DOM,
// and the unit gate cannot see whether the page actually offers it. This is
// the one DOM probe the move gets, and it is DOM-only on purpose: no play
// button, no analyser, no render budget — those gates already exist and the
// groove reaches them through the same buildTimeline they always walked.
//
//   (A) the control EXISTS, once, in the session bank, labeled GROOVE, and
//       reads its current value (a fresh page is flat);
//   (B) loading a shipped preset — per-box vintage, migrated on the way in —
//       lands the LIFTED groove in the control, the exact value the loader
//       computes for the same bytes in node;
//   (C) changing it COMMITS: state moves and the debounced save carries the
//       song-level groove (and no box-level one);
//   (D) the TIMING popup no longer offers a groove bank — swing stays, the
//       per-section field is gone at the registry and therefore here.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8957;                 // a PREFERENCE — the harness walks past a busy port

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// the EXPECTED lifted groove, computed in node from the same bytes the page
// ships — the probe asserts agreement, it does not re-derive the majority rule
const S = require("../../nukernel/song.js");
const { PRESETS } = require("../../nukernel/presets.js");
const lifted = PRESETS.map(p => ({ name: p.name, r: S.load(p.data) }))
  .find(x => x.r.ok && x.r.song.groove != null);

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

  // (A) the control exists, once, legended, and reads the current value
  {
    const n = await page.locator("#groove").count();
    if (n !== 1) fail(`expected exactly one #groove control, found ${n}`);
    else ok("the GROOVE control exists, once");
    const legend = await page.locator('label.gctl:has(#groove) .glab').textContent();
    if (!/^groove$/i.test((legend || "").trim()))
      fail(`the control's legend reads "${legend}", not GROOVE`);
    else ok("it is legended GROOVE in the session bank");
    const v = await page.inputValue("#groove");
    if (v !== "") fail(`a fresh page's groove reads "${v}", not flat`);
    else ok("a fresh page reads flat");
    const opts = await page.locator("#groove option").allTextContents();
    if (opts.length < 6) fail(`the control offers only ${opts.length} choices: ${opts.join(", ")}`);
    else ok(`it offers the vocabulary: ${opts.join(", ")}`);
  }

  // (B) a shipped preset's per-box grooves arrive LIFTED into the control
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

  // (C) changing it commits — state moves, and the save carries the song fact
  {
    await page.selectOption("#groove", "dub");
    await page.waitForTimeout(400);              // past the 250 ms save debounce
    const got = await page.evaluate(async () => {
      const stm = await import("/nukernel/ui/state.js");
      const raw = JSON.parse(localStorage.getItem("nukernel.song.v1") || "null");
      return { state: stm.GROOVE, saved: raw && raw.groove,
               boxed: !!(raw && raw.song && raw.song.some(b => b && b.groove != null)) };
    });
    if (got.state !== "dub") fail(`state GROOVE is ${got.state}, not dub`);
    else ok("the change reaches state");
    if (got.saved !== "dub") fail(`the save carries groove ${got.saved}, not dub`);
    else ok("the change commits to the save, at song level");
    if (got.boxed) fail("the save still carries a per-box groove");
    else ok("no box in the save carries a groove");
  }

  // (D) the TIMING popup: swing stays, the groove bank is gone
  {
    await page.locator(".box").first().locator('.bcell[data-cell="timing"]').click();
    await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
    const pop = page.locator("#rowpop");
    const grooveChips = await pop.locator('.pchip[data-kind="groove"]').count();
    const grooveBank = await pop.locator(".plabel", { hasText: /^groove$/i }).count();
    if (grooveChips || grooveBank)
      fail(`the TIMING popup still offers groove (${grooveChips} chips, ${grooveBank} banks)`);
    else ok("the TIMING popup no longer offers groove");
    const swingChips = await pop.locator('.pchip[data-kind="swing"]').count();
    if (!swingChips) fail("the TIMING popup lost its swing bank too — swing stays per section");
    else ok(`swing stays per section (${swingChips} chips)`);
    await page.keyboard.press("Escape");
  }

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  await browser.close();
  await srv.close();
  console.log(process.exitCode ? `\nFAILED (${checks} passed)` : `\nPASS (${checks} checks)`);
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
