#!/usr/bin/env node
// full-boot-run.js — the REAL FULL-APP BOOT smoke gate (browser battery).
//
// THE BUG THIS CATCHES (a production outage): the star-cruise headless probes
// serve app/main.js as an INERT stub (installOfflineRoute neutralizeMain:true) so
// they never pay the real full-app boot — meaning a boot-time crash (e.g. a genre
// missing from app/world.js POS sending computeGenreLayout into its relaxation and
// collapsing the WebGL renderer) ships silently: blank app, no 🛸, all probes green.
//
// This gate loads the REAL index.html with the REAL app/main.js boot
// (neutralizeMain:false) and asserts the app actually came up:
//   - page did NOT crash (page.on('crash'))
//   - ZERO console/page errors (capturePageErrors)
//   - window.GenreKernel + window.__S are defined
//   - the ✦ view chip is present (aliens is now a VIEW, not a separate 🛸 chip)
//   - the aliens controller is DEFERRED — window.__STARCRUISE is undefined after a
//     real boot (app/starcruise.js is not a boot-path script any more) — but its
//     loader hook window.__ensureStarcruise is published by app/panels.js, and
//     awaiting it brings the controller up. Both halves are asserted: the cut is
//     real AND the view still works.
//   - 3 chips in #chips (play / view / cfg — there is no ▢/▦ bg chip)
//   - the starmap rendered (an svg/canvas exists)
// Exits nonzero on ANY failure.
//
//   node test/full-boot-run.js
//
// Needs the pinned chromium (requireChromium:true) — it's the ONE gate that
// exercises the real boot, so it lives in the this-box browser battery, not CI.
"use strict";
const { serve, launchChromium, capturePageErrors, installOfflineRoute, ensureStarcruise } = require("./probe-harness.js");
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
    GenreKernel: typeof window.GenreKernel,
    __S: typeof window.__S,
    // DEFERRED ALIENS: the controller must be ABSENT after a clean boot, and its
    // loader hook must be present (app/panels.js publishes it at module eval).
    __STARCRUISE: typeof window.__STARCRUISE,
    ensureHook: typeof window.__ensureStarcruise,
    chips: document.querySelectorAll("#chips .chip").length,
    starmapEls: document.querySelectorAll("svg, canvas, #map, .star").length,
  })).catch((e) => ({ evalFail: "EVAL-FAIL (page crashed?): " + e.message }));

  // …then arm the deferred import and prove the aliens view still comes up.
  let starcruise = false;
  if (!r.evalFail) {
    try {
      await ensureStarcruise(page);
      starcruise = await page.evaluate(() => !!(window.__STARCRUISE && window.__STARCRUISE.start));
    } catch (e) { errs.push("ENSURE-STARCRUISE: " + e.message); }
  }

  await browser.close(); srv.close();

  console.log("full-boot-run — REAL app/main.js boot");
  console.log("  bootMs=" + bootMs + "  crashed=" + crashed);
  console.log("  errors:\n" + (errs.length ? errs.map((e) => "    " + e).join("\n") : "    (none)"));
  console.log("  state: " + JSON.stringify(r) + "  starcruiseAfterEnsure=" + starcruise);

  const fails = [];
  if (crashed) fails.push("page CRASHED (page.on('crash'))");
  if (errs.length) fails.push(errs.length + " console/page error(s)");
  if (r.evalFail) fails.push(r.evalFail);
  else {
    if (r.GenreKernel !== "object") fails.push("window.GenreKernel not defined (got " + r.GenreKernel + ")");
    if (r.__S === "undefined") fails.push("window.__S not defined");
    if (r.__STARCRUISE !== "undefined") fails.push("window.__STARCRUISE defined at boot — the aliens controller is back on the boot path");
    if (r.ensureHook !== "function") fails.push("window.__ensureStarcruise (the aliens loader hook) missing — got " + r.ensureHook);
    if (!r.viewChip) fails.push("#viewChip (the ✦ view cycle) missing");
    if (!starcruise) fails.push("window.__ensureStarcruise() did not bring up the aliens view controller");
    if (r.chips !== 3) fails.push("expected 3 chips in #chips (play/view/cfg), got " + r.chips);
    if (r.starmapEls < 1) fails.push("starmap did not render (no svg/canvas/#map/.star)");
  }

  if (fails.length) {
    console.error("\n  FAIL — real full-app boot broke:");
    for (const f of fails) console.error("      - " + f);
    process.exit(1);
  }
  console.log("\n  PASS — real full-app boot is healthy (✦ view chip present, aliens controller deferred then loadable, starmap rendered).");
  process.exit(0);
})();
