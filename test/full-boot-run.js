#!/usr/bin/env node
// full-boot-run.js — the REAL FULL-APP BOOT smoke gate (browser battery).
//
// THE BUG THIS CATCHES (prod outage 2026-07-11): the star-cruise headless probes
// serve app/main.js as an INERT stub (installOfflineRoute neutralizeMain:true) so
// they never pay the real full-app boot — meaning a boot-time crash (e.g. a genre
// missing from app/world.js POS sending computeGenreLayout into its relaxation and
// collapsing the WebGL renderer) ships silently: blank app, no 🛸, all probes green.
//
// This gate loads the REAL index.html with the REAL app/main.js boot
// (neutralizeMain:false) and asserts the app actually came up:
//   - page did NOT crash (page.on('crash'))
//   - ZERO console/page errors (capturePageErrors)
//   - window.GenreKernel + window.__S + window.__STARCRUISE are defined
//   - the ✦ view chip is present (aliens is now a VIEW, not a separate 🛸 chip)
//   - 4 chips in #chips (play / view / bg / cfg)
//   - the starmap rendered (an svg/canvas exists)
// Exits nonzero on ANY failure.
//
//   node test/full-boot-run.js
//
// Needs the pinned chromium (requireChromium:true) — it's the ONE gate that
// exercises the real boot, so it lives in the this-box browser battery, not CI.
"use strict";
const { serve, launchChromium, capturePageErrors, installOfflineRoute } = require("./probe-harness.js");
const PORT = 8795;

(async () => {
  const srv = await serve(process.cwd(), PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await installOfflineRoute(page, PORT, { neutralizeMain: false }); // REAL main.js boot
  let crashed = false;
  page.on("crash", () => { crashed = true; });

  const t0 = Date.now();
  try { await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "domcontentloaded", timeout: 40000 }); }
  catch (e) { errs.push("GOTO: " + e.message); }
  await page.waitForTimeout(8000);
  const bootMs = Date.now() - t0;

  const r = await page.evaluate(() => ({
    viewChip: !!document.getElementById("viewChip"),
    starcruise: !!(window.__STARCRUISE && window.__STARCRUISE.start),
    GenreKernel: typeof window.GenreKernel,
    __S: typeof window.__S,
    __STARCRUISE: typeof window.__STARCRUISE,
    chips: document.querySelectorAll("#chips .chip").length,
    starmapEls: document.querySelectorAll("svg, canvas, #map, .star").length,
  })).catch((e) => ({ evalFail: "EVAL-FAIL (page crashed?): " + e.message }));

  await browser.close(); srv.close();

  console.log("full-boot-run — REAL app/main.js boot");
  console.log("  bootMs=" + bootMs + "  crashed=" + crashed);
  console.log("  errors:\n" + (errs.length ? errs.map((e) => "    " + e).join("\n") : "    (none)"));
  console.log("  state: " + JSON.stringify(r));

  const fails = [];
  if (crashed) fails.push("page CRASHED (page.on('crash'))");
  if (errs.length) fails.push(errs.length + " console/page error(s)");
  if (r.evalFail) fails.push(r.evalFail);
  else {
    if (r.GenreKernel !== "object") fails.push("window.GenreKernel not defined (got " + r.GenreKernel + ")");
    if (r.__S === "undefined") fails.push("window.__S not defined");
    if (r.__STARCRUISE === "undefined") fails.push("window.__STARCRUISE not defined");
    if (!r.viewChip) fails.push("#viewChip (the ✦ view cycle) missing");
    if (!r.starcruise) fails.push("window.__STARCRUISE (aliens view controller) missing");
    if (r.chips !== 4) fails.push("expected 4 chips in #chips (play/view/bg/cfg), got " + r.chips);
    if (r.starmapEls < 1) fails.push("starmap did not render (no svg/canvas/#map/.star)");
  }

  if (fails.length) {
    console.error("\n  FAIL — real full-app boot broke:");
    for (const f of fails) console.error("      - " + f);
    process.exit(1);
  }
  console.log("\n  PASS — real full-app boot is healthy (✦ view chip + __STARCRUISE present, starmap rendered).");
  process.exit(0);
})();
