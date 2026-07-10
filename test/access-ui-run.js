#!/usr/bin/env node
// test/access-ui-run.js — THE ACCESSIBLE-PAGE GATE. Drives access.html headless
// and asserts the alternate, screen-reader-first UI is a real, playing instrument
// that reuses the same deterministic engine as the map:
//   (a) the module boots with ZERO page/console errors (the imported map modules
//       don't throw on a page without the SVG/panels — the #boot/#bgChip stubs +
//       not importing panels.js/starmap.js hold);
//   (b) the genre menus populate to all 228 kernel genres and S.playing is seeded
//       before any Play (so "Now playing" reads and Play has a target);
//   (c) HOLD mode: pick a genre, Play → real sound (RMS above the boot floor) and
//       the weights resolve to that genre;
//   (d) A/B blend via the explicit-weights path resolves to the two chosen genres;
//   (e) JOURNEY mode: two stops, Play → the traveler walks (S.waypoints set,
//       travel advances) with real sound and zero errors;
//   (f) determinism sanity: same seed+genre yields the same mixed bpm/progression
//       on the accessible page as a direct kernel mix (it IS the same engine).
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/access-ui-run.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const path = require("path");
const K = require("../engine/genre-kernel.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8951;
const RMS_FLOOR = 0.0008;

const fail = m => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0;
const ok = m => { checks++; console.log("  ok:", m); };

async function waitAudio(page, bars) {
  // poll the live handle RMS until real sound, up to a generous cap
  return page.waitForFunction(f => {
    try { const h = window.__ACCESS.handle(); return h && h.rms() > f; } catch (e) { return false; }
  }, RMS_FLOOR, { timeout: 25000 });
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/access.html`);

  // (a)+(b) boot, no errors, menus populated, target seeded
  await page.waitForFunction(() => window.__S && window.__ACCESS && document.getElementById("genreSel").options.length > 0, { timeout: 20000 });
  await page.waitForTimeout(300);
  const kernelGenres = Object.keys(K.GENRES).length;
  const menu = await page.evaluate(() => ({
    genreOpts: document.getElementById("genreSel").options.length,
    blendOpts: document.getElementById("blendSel").options.length,
    journeyOpts: document.getElementById("journeyAdd").options.length,
    macros: document.getElementById("macroList").querySelectorAll("input[type=range]").length,
    playing: !!window.__S.playing,
    seed: window.__S.seed,
  }));
  if (menu.genreOpts === kernelGenres) ok(`genre menu = all ${kernelGenres} genres`);
  else fail(`genre menu ${menu.genreOpts} != kernel ${kernelGenres}`);
  if (menu.blendOpts === kernelGenres + 1) ok(`blend menu = ${kernelGenres} + none`);
  else fail(`blend menu ${menu.blendOpts} != ${kernelGenres + 1}`);
  if (menu.macros === 8) ok("8 shape sliders"); else fail(`${menu.macros} shape sliders != 8`);
  if (menu.playing) ok("S.playing seeded before Play"); else fail("S.playing null before Play");

  // deterministic seed for the rest
  await page.evaluate(() => { window.__S.seed = 42; });

  // (c) HOLD: pick techno, play, expect real sound + techno-dominant weights
  await page.evaluate(() => {
    const s = document.getElementById("genreSel"); s.value = "techno";
    s.dispatchEvent(new Event("change"));
    document.getElementById("playBtn").click();
  });
  await waitAudio(page);
  await page.waitForTimeout(500);
  const hold = await page.evaluate(() => ({
    rms: window.__ACCESS.handle().rms(),
    dom: (window.__S.weights[0] || {}).g,
    domW: (window.__S.weights[0] || {}).w,
  }));
  if (hold.rms > RMS_FLOOR) ok(`HOLD techno: real sound (rms ${hold.rms.toFixed(4)})`);
  else fail(`HOLD techno: no sound (rms ${hold.rms})`);
  if (hold.dom === "techno" && hold.domW > 0.85) ok(`HOLD weights = techno ${(hold.domW * 100) | 0}%`);
  else fail(`HOLD weights dom=${hold.dom} w=${hold.domW}`);

  // (d) A/B blend while live: techno + jungle 40%
  await page.evaluate(() => {
    const b = document.getElementById("blendSel"); b.value = "jungle"; b.dispatchEvent(new Event("change"));
    const a = document.getElementById("blendAmt"); a.value = "40"; a.dispatchEvent(new Event("input"));
  });
  await page.waitForTimeout(300);
  const blend = await page.evaluate(() => window.__S.weights.map(w => [w.g, Math.round(w.w * 100)]));
  const gs = blend.map(b => b[0]);
  if (gs.includes("techno") && gs.includes("jungle")) ok(`A/B blend resolves both: ${blend.map(b => b.join(" ")).join(", ")}`);
  else fail(`A/B blend missing a genre: ${JSON.stringify(blend)}`);

  // stop, then (e) JOURNEY: two stops
  await page.evaluate(() => document.getElementById("playBtn").click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('input[name="mode"][value="journey"]').click();
    window.__ACCESS.setJourney(["house", "gabber"]);   // two audible genres (ambient never primes — pre-existing engine issue on both UIs)
    document.getElementById("playBtn").click();
  });
  await waitAudio(page);
  const seg0 = await page.evaluate(() => { window.__seg0 = window.__S.travel.seg + window.__S.travel.t; return window.__seg0; });
  // the traveler only advances on onBar (a chord-bar ≈ a few seconds) — poll for
  // real forward motion rather than sampling one tight window
  let advanced = false;
  try {
    await page.waitForFunction(() => (window.__S.travel.seg + window.__S.travel.t) > window.__seg0 + 1e-4, {}, { timeout: 20000 });
    advanced = true;
  } catch (e) {}
  const jr = await page.evaluate(() => ({
    rms: window.__ACCESS.handle().rms(),
    wp: window.__S.waypoints.length,
    prog: window.__S.travel.seg + window.__S.travel.t,
  }));
  if (jr.wp === 2) ok("JOURNEY: 2 waypoints set"); else fail(`JOURNEY waypoints=${jr.wp}`);
  if (jr.rms > RMS_FLOOR) ok(`JOURNEY: real sound (rms ${jr.rms.toFixed(4)})`); else fail(`JOURNEY: no sound`);
  if (advanced) ok(`JOURNEY: traveler advanced (${seg0.toFixed(4)} -> ${jr.prog.toFixed(4)})`);
  else fail(`JOURNEY: traveler stuck at ${jr.prog}`);

  await page.evaluate(() => document.getElementById("playBtn").click());

  // (f) determinism: the page's mix == a direct kernel mix for seed 42 / techno
  const direct = K.mix([{ g: "techno", w: 1 }], { seed: 42 });
  const pageMix = await page.evaluate(() => {
    window.__S.seed = 42;
    const s = document.getElementById("genreSel"); s.value = "techno";
    document.getElementById("blendSel").value = ""; document.getElementById("blendSel").dispatchEvent(new Event("change"));
    s.dispatchEvent(new Event("change"));
    return { bpm: window.__S.playing.bpm, prog: window.__S.playing.progression };
  });
  if (pageMix.bpm === direct.bpm && pageMix.prog === direct.progression)
    ok(`determinism: page mix == kernel mix (bpm ${direct.bpm}, ${direct.progression})`);
  else fail(`determinism mismatch: page ${pageMix.bpm}/${pageMix.prog} vs kernel ${direct.bpm}/${direct.progression}`);

  // (a) errors
  if (errs.length === 0) ok("zero page errors");
  else fail(`page errors: ${JSON.stringify(errs.slice(0, 5))}`);

  await browser.close();
  srv.close();
  console.log(process.exitCode ? `\nACCESS-UI: FAILED` : `\nACCESS-UI: PASS (${checks} checks)`);
}
main().catch(e => { console.error(e); process.exit(1); });
